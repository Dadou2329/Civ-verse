/**
 * GameSession — the headless heart of CIVILIZATIONVERSE.
 *
 * Owns every engine service (registries, variables, multiverse, story systems, player, physics)
 * and runs one civilization at a time through an explicit lifecycle:
 *
 *   register (manifests) → validate → load (code + content) → initialize (mechanics)
 *   → start (enter scene) → pause/resume → save → unload → dispose
 *
 * Everything a civilization registers lives in its DisposableScope; unloading disposes the scope
 * and unregisters the pack's definitions, so nothing keeps running in another civilization.
 * The renderer (GameView) and the UI attach to a session; tests drive it directly.
 */
import { EventBus } from '../events/eventBus';
import { Localizer, type MessageParams, type StringTable } from '../i18n/localizer';
import { LogHub, type Logger } from '../util/logger';
import { DisposableScope, type Disposable, toDisposable } from '../util/disposable';
import { BlockRegistry } from '../voxel/blocks';
import { ModelRegistry } from '../voxel/modelRegistry';
import { ItemRegistry, Inventory } from '../inventory/items';
import { LogicRegistry } from '../logic/registry';
import { LogicInterpreter } from '../logic/interpreter';
import { RuleEngine } from '../logic/rules';
import { VariableStore } from '../state/variables';
import { MultiverseState, type GlobalState } from '../state/multiverse';
import { SimClock } from './clock';
import { PresentationBus } from './presentation';
import { HeadlessUi, type UiBridge } from './uiBridge';
import { PlayerController } from './player';
import { DialogueSystem } from '../story/dialogue';
import { QuestSystem } from '../story/quests';
import { CinematicSystem } from '../story/cinematics';
import { InteractionSystem } from './interaction';
import { BehaviorSystem } from './behaviorSystem';
import { SceneWorld } from '../world/sceneWorld';
import { RuntimeEntity } from '../world/entity';
import { createCivContext, createEntityApi } from './contexts';
import type {
  AbilityDefinition,
  BehaviorDefinition,
  HudDefinition,
  MechanicDefinition,
  MusicDefinition,
  PanelDefinition,
  SoundDefinition,
  ViewEffectDefinition,
  VisualDefinition,
} from '../packs/definitions';
import { type ContentProvider, type LoadedPack, loadPack, loadSceneDoc, validateManifest, type ContentIssue } from '../packs/pack';
import type { PackManifest, SceneDoc, EntityDoc, CharacterDoc } from '../content/schemas';
import type { CivContext, EntityApi, LifecyclePhase, RunMode, ViewBridge } from './api';
import { normalizeProps, type PropSchema } from '../props/props';
import {
  type LocalCivState,
  type SaveGame,
  type SceneState,
  type EntityState,
  SAVE_FORMAT,
  SAVE_FORMAT_VERSION,
  migrateCivState,
  migrateVersioned,
} from '../save/saveFormat';
import { satisfies } from '../util/semver';
import { toError } from '../util/assert';
import type { Vec3 } from '../util/math';
import { DEG2RAD, RAD2DEG } from '../util/math';
import { registerEngineBuiltins } from './builtins';
import { ENGINE_API_VERSION, ENGINE_VERSION } from '../version';
import engineLocaleFr from '../../locales/fr-FR.json';

export interface SessionOptions {
  mode: RunMode;
  provider: ContentProvider;
  ui?: UiBridge;
  locale?: string;
  /** Record presentation requests (headless tests). */
  recordPresentation?: boolean;
  logHub?: LogHub;
}

export interface ActiveCiv {
  id: string;
  manifest: PackManifest;
  pack: LoadedPack;
  scope: DisposableScope;
  sceneScope: DisposableScope | null;
  ctx: CivContext;
  mechanics: Map<string, { def: MechanicDefinition<unknown, unknown, PropSchema>; state: unknown; api: unknown; failed: string | null }>;
  settings: Map<string, Record<string, unknown>>;
  panels: Map<string, PanelDefinition>;
  panelResolvers: Map<string, (result: unknown) => void>;
  panelLocks: Map<string, Disposable>;
  abilities: Map<string, AbilityDefinition>;
  inputBindings: Map<string, { key: string; label: string }>;
  inputHandlers: Map<string, Set<() => void>>;
  lifecycle: Map<LifecyclePhase, Set<(info: { sceneId: string }) => void>>;
  sceneStates: Map<string, SceneState>;
  uiStore: Map<string, unknown>;
  uiStoreSubs: Map<string, Set<(v: unknown) => void>>;
  playTime: number;
  huds: HudDefinition[];
}

export interface CivSnapshotOptions {
  /** Include the live scene state (default true). */
  includeScene?: boolean;
}

export class GameSession {
  readonly mode: RunMode;
  readonly provider: ContentProvider;
  readonly logHub: LogHub;
  readonly log: Logger;
  readonly i18n: Localizer;
  readonly bus: EventBus;
  readonly presentation: PresentationBus;
  ui: UiBridge;
  readonly clock: SimClock;
  readonly blocks = new BlockRegistry();
  readonly models = new ModelRegistry();
  readonly items = new ItemRegistry();
  readonly logicRegistry = new LogicRegistry();
  readonly behaviorDefs = new Map<string, { def: BehaviorDefinition<PropSchema, unknown>; owner: string }>();
  readonly sounds = new Map<string, { def: SoundDefinition; owner: string }>();
  readonly music = new Map<string, { def: MusicDefinition; owner: string }>();
  readonly visuals = new Map<string, { def: VisualDefinition; owner: string }>();
  readonly viewEffects = new Map<string, { def: ViewEffectDefinition; owner: string }>();
  readonly vars: VariableStore;
  readonly multiverse = new MultiverseState();
  readonly interpreter: LogicInterpreter;
  readonly rules: RuleEngine;
  readonly dialogue: DialogueSystem;
  readonly quests: QuestSystem;
  readonly cinematics: CinematicSystem;
  readonly player = new PlayerController();
  readonly inventory = new Inventory();
  readonly interaction: InteractionSystem;
  readonly behaviors: BehaviorSystem;
  readonly manifests = new Map<string, PackManifest>();
  readonly manifestIssues = new Map<string, string[]>();
  readonly loadedPacks = new Map<string, LoadedPack>();
  /** Saved local states of civilizations (current one is refreshed on snapshot). */
  readonly civStates = new Map<string, LocalCivState>();
  readonly contentIssues: ContentIssue[] = [];
  civ: ActiveCiv | null = null;
  world: SceneWorld | null = null;
  view: ViewBridge | null = null;
  private _paused = false;
  private pauseReasons = new Set<string>();
  private changeListeners = new Set<() => void>();
  private entityApis = new WeakMap<RuntimeEntity, EntityApi>();
  private readonly inputDown = new Set<string>();
  private loading = false;
  private disposed = false;
  private engineListenerBaseline = 0;

  private constructor(opts: SessionOptions) {
    this.mode = opts.mode;
    this.provider = opts.provider;
    this.logHub = opts.logHub ?? new LogHub(500, opts.mode !== 'headless');
    this.log = this.logHub.logger('session');
    this.i18n = new Localizer(opts.locale ?? 'fr-FR');
    this.i18n.addTable('engine', 'fr-FR', engineLocaleFr as StringTable);
    this.bus = new EventBus((err, name) => this.logHub.logger('événements').error(`Erreur dans un écouteur de "${name}"`, err));
    this.presentation = new PresentationBus(opts.recordPresentation ?? opts.mode === 'headless');
    this.ui = opts.ui ?? new HeadlessUi();
    this.clock = new SimClock((err, where) => this.logHub.logger('temps').error(`Erreur dans ${where}`, err));
    this.vars = new VariableStore((name, value, previous) => {
      this.bus.emit('var.changed', { name, value, previous });
    });
    this.vars.setGlobalReader((path) => this.multiverse.read(path));
    this.interpreter = new LogicInterpreter(this.logicRegistry, () => this.civ?.ctx ?? null, this.logHub.logger('logique'), () => this.clock.now);
    this.rules = new RuleEngine(this.bus, this.interpreter, () => this.world?.id ?? null);
    const lockPlayer = (reason: string): Disposable => {
      const a = this.player.lockMovement(reason);
      const b = this.player.lockLook(reason);
      return toDisposable(() => {
        a.dispose();
        b.dispose();
      });
    };
    this.dialogue = new DialogueSystem({
      getDoc: (id) => this.civ?.pack.dialogues.get(id),
      interpreter: this.interpreter,
      bus: this.bus,
      t: (k) => this.t(k),
      speakerName: (id, doc) => this.speakerName(id, doc.speakers?.[id]?.name),
      speakerEntity: (id, doc, fallback) => {
        if (id === 'player' || id === 'narrator') return null;
        const explicit = doc.speakers?.[id]?.entity;
        if (explicit) return explicit;
        if (this.world?.entities.has(id)) return id;
        return fallback;
      },
      lockPlayer,
      presentation: this.presentation,
      log: this.logHub.logger('dialogue'),
    });
    this.quests = new QuestSystem({
      interpreter: this.interpreter,
      bus: this.bus,
      t: (k, p) => this.t(k, p),
      notify: (text, kind) => this.notify(text, kind),
      readVar: (n) => this.vars.get(n),
      now: () => this.clock.now,
      log: this.logHub.logger('quêtes'),
    });
    this.cinematics = new CinematicSystem({
      getDoc: (id) => this.civ?.pack.cinematics.get(id),
      interpreter: this.interpreter,
      bus: this.bus,
      t: (k) => this.t(k),
      speakerName: (id) => this.speakerName(id),
      actors: {
        position: (id) => this.world?.entities.get(id)?.position ?? (id === 'player' ? this.player.position : null),
        moveTo: (id, target, speed) => void this.entityApi(id)?.moveTo(target, { speed }),
        teleport: (id, p) => {
          if (id === 'player') this.player.teleport(p);
          else this.entityApi(id)?.setPosition(p);
        },
        setYaw: (id, deg) => {
          if (id === 'player') this.player.yaw = deg * DEG2RAD;
          else this.entityApi(id)?.setYaw(deg);
        },
        lookAt: (id, target) => this.entityApi(id)?.lookAt(target),
        animate: (id, name) => this.entityApi(id)?.playAnimation(name),
        expression: (id, e) => this.entityApi(id)?.setExpression(e),
        setVisible: (id, v) => {
          const api = this.entityApi(id);
          if (api) api.visible = v;
        },
        say: (id, text) => this.entityApi(id)?.say(text),
      },
      playerEye: () => this.player.eye,
      presentation: this.presentation,
      lockPlayer,
      log: this.logHub.logger('cinématique'),
    });
    this.behaviors = new BehaviorSystem(this);
    this.interaction = new InteractionSystem(this);
    // Quests react to every gameplay event (conditions and event matchers).
    this.bus.onAny((name, payload) => {
      if (this.civ && !name.startsWith('ui.')) this.quests.evaluate(name, payload);
    });
    registerEngineBuiltins(this);
    this.engineListenerBaseline = this.bus.listenerCount;
  }

  /** Creates a session and reads every pack manifest. */
  static async create(opts: SessionOptions): Promise<GameSession> {
    const s = new GameSession(opts);
    await s.refreshManifests();
    return s;
  }

  // -------------------------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------------------------

  t(key: string, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }

  get paused(): boolean {
    return this._paused;
  }

  /** Pauses the simulation for a reason (pause menu, panel, editor). Reasons stack. */
  setPaused(reason: string, paused: boolean): void {
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    const next = this.pauseReasons.size > 0;
    if (next !== this._paused) {
      this._paused = next;
      for (const cb of this.civ?.lifecycle.get(next ? 'pause' : 'resume') ?? []) {
        try {
          cb({ sceneId: this.world?.id ?? '' });
        } catch (err) {
          this.log.error('Erreur dans un rappel pause/reprise', err);
        }
      }
      this.changed();
    }
  }

  onChange(cb: () => void): Disposable {
    this.changeListeners.add(cb);
    return toDisposable(() => this.changeListeners.delete(cb));
  }

  /** Notifies UI observers that session-level state changed (civ, scene, pause...). */
  changed(): void {
    for (const l of this.changeListeners) l();
  }

  notify(text: string, kind: 'info' | 'success' | 'warning' | 'denied' | 'quest' | 'item' | 'memory' | 'discovery' = 'info', duration = 3.5, icon?: string): void {
    this.ui.notify({ id: Math.floor(Math.random() * 1e9), text, kind, duration, icon });
  }

  speakerName(id: string, explicitKey?: string): string | null {
    if (explicitKey) return this.t(explicitKey);
    if (id === 'player') return this.t('core.speaker.player');
    if (id === 'narrator') return null;
    const e = this.world?.entities.get(id);
    const npc = e?.components.get('core.npc');
    const nameKey = npc?.props.name;
    if (typeof nameKey === 'string' && nameKey) return this.t(nameKey);
    return id;
  }

  entityApi(id: string): EntityApi | null {
    const e = this.world?.entities.get(id);
    if (!e) return null;
    let api = this.entityApis.get(e);
    if (!api) {
      api = createEntityApi(this, e);
      this.entityApis.set(e, api);
    }
    return api;
  }

  /** Character appearance from any loaded pack (civilization first, then libraries). */
  characterDoc(id: string): CharacterDoc | undefined {
    const own = this.civ?.pack.characters.get(id);
    if (own) return own;
    for (const p of this.loadedPacks.values()) {
      const c = p.characters.get(id);
      if (c) return c;
    }
    return undefined;
  }

  /** Effective props of a mechanic's settings (Civilization Rules editor). */
  settingsOf(mechanicId: string): Record<string, unknown> {
    return this.civ?.settings.get(mechanicId) ?? {};
  }

  // -------------------------------------------------------------------------------------------
  // Packs
  // -------------------------------------------------------------------------------------------

  async refreshManifests(): Promise<void> {
    this.manifests.clear();
    this.manifestIssues.clear();
    for (const raw of await this.provider.listManifests()) {
      const id = typeof raw === 'object' && raw !== null ? String((raw as { id?: unknown }).id ?? '?') : '?';
      const { manifest, issues } = validateManifest(raw, `${id}/manifest.json`);
      if (!manifest) {
        this.manifestIssues.set(id, issues);
        this.log.error(`Manifeste invalide pour "${id}" :\n${issues.join('\n')}`);
        continue;
      }
      if (!satisfies(ENGINE_API_VERSION, manifest.engineApi)) {
        const msg = `Le pack "${id}" requiert l'API ${manifest.engineApi} (moteur : ${ENGINE_API_VERSION}).`;
        this.manifestIssues.set(id, [msg]);
        this.log.error(msg);
        continue;
      }
      this.manifests.set(manifest.id, manifest);
      // Names, descriptions and fragments must be readable before the pack itself is loaded
      // (civilization selection, multiverse registry).
      try {
        const table = await this.provider.readJson(manifest.id, 'locales/fr-FR.json');
        if (table && typeof table === 'object') this.i18n.addTable(`${manifest.id}#manifeste`, 'fr-FR', table as StringTable);
      } catch {
        this.log.warn(`Aucune table française pour « ${manifest.id} » (locales/fr-FR.json).`);
      }
    }
  }

  civilizations(): PackManifest[] {
    return [...this.manifests.values()].filter((m) => m.kind === 'civilization').sort((a, b) => a.order - b.order);
  }

  /** Loads (once) and registers a library or civilization pack's definitions and content. */
  private async ensurePack(id: string, chain: string[] = []): Promise<LoadedPack> {
    const existing = this.loadedPacks.get(id);
    if (existing) return existing;
    if (chain.includes(id)) throw new Error(`Dépendance circulaire entre packs : ${[...chain, id].join(' → ')}`);
    const manifest = this.manifests.get(id);
    if (!manifest) throw new Error(`Pack introuvable ou invalide : "${id}".`);
    for (const dep of manifest.dependencies) await this.ensurePack(dep, [...chain, id]);
    const pack = await loadPack(this.provider, manifest);
    for (const issue of pack.issues) {
      this.contentIssues.push(issue);
      const line = `${issue.pack}/${issue.file} : ${issue.message}`;
      if (issue.severity === 'error') this.logHub.logger('contenu').error(line);
      else this.logHub.logger('contenu').warn(line);
    }
    this.registerPack(pack);
    this.loadedPacks.set(id, pack);
    return pack;
  }

  private registerPack(pack: LoadedPack): void {
    const owner = pack.manifest.id;
    const d = pack.defs;
    const guard = (what: string, fn: () => void) => {
      try {
        fn();
      } catch (err) {
        this.log.error(`${owner} : enregistrement impossible (${what})`, err);
      }
    };
    for (const b of d.blocks) guard(`bloc ${b.id}`, () => this.blocks.register(b, owner));
    for (const m of d.models) guard(`modèle ${m.id}`, () => this.models.register(m, owner));
    for (const i of pack.items) guard(`objet ${i.id}`, () => this.items.register(i, owner));
    for (const a of d.actions) guard(`action ${a.id}`, () => this.logicRegistry.addAction(a, owner));
    for (const c of d.conditions) guard(`condition ${c.id}`, () => this.logicRegistry.addCondition(c, owner));
    for (const e of d.events) guard(`événement ${e.id}`, () => this.logicRegistry.addEvent(e, owner));
    for (const b of d.behaviors) {
      const prev = this.behaviorDefs.get(b.id);
      if (prev && prev.owner !== owner) this.log.error(`Composant ${b.id} déjà défini par ${prev.owner}.`);
      else this.behaviorDefs.set(b.id, { def: b, owner });
    }
    for (const s of d.sounds) this.sounds.set(s.id, { def: s, owner });
    for (const m of d.music) this.music.set(m.id, { def: m, owner });
    for (const v of d.visuals) this.visuals.set(v.component, { def: v, owner });
    for (const v of d.viewEffects) this.viewEffects.set(v.channel, { def: v, owner });
    for (const [locale, table] of pack.locales) this.i18n.addTable(owner, locale, table);
  }

  private unregisterPack(owner: string): void {
    this.blocks.unregisterOwner(owner);
    this.models.unregisterOwner(owner);
    this.items.unregisterOwner(owner);
    this.logicRegistry.unregisterOwner(owner);
    for (const map of [this.behaviorDefs, this.sounds, this.music, this.visuals, this.viewEffects] as Map<string, { owner: string }>[]) {
      for (const [k, v] of [...map]) if (v.owner === owner) map.delete(k);
    }
    this.i18n.removeNamespace(owner);
    this.loadedPacks.delete(owner);
  }

  // -------------------------------------------------------------------------------------------
  // Civilization lifecycle
  // -------------------------------------------------------------------------------------------

  get isLoading(): boolean {
    return this.loading;
  }

  /**
   * Loads and starts a civilization. With `fresh`, its local state is reset (the multiverse is
   * kept); otherwise the saved local state (if any) is restored.
   */
  async loadCivilization(civId: string, opts: { fresh?: boolean; scene?: string; spawn?: string } = {}): Promise<void> {
    if (this.disposed) throw new Error('Session libérée.');
    if (this.loading) throw new Error('Un chargement est déjà en cours.');
    this.loading = true;
    this.changed();
    try {
      if (this.civ) await this.unloadCivilization();
      const manifest = this.manifests.get(civId);
      if (!manifest) throw new Error(this.t('core.error.civNotFound', { id: civId }));
      if (manifest.kind !== 'civilization') throw new Error(`"${civId}" est une bibliothèque, pas une civilisation jouable.`);
      if (opts.fresh) this.civStates.delete(civId);
      const pack = await this.ensurePack(civId);
      let saved = this.civStates.get(civId) ?? null;
      if (saved) {
        const migrated = migrateCivState(saved, manifest.stateVersion, pack.module.migrations);
        saved = migrated.state;
        for (const w of migrated.warnings) this.log.info(w);
      }
      const scope = new DisposableScope(`civ:${civId}`, (err) => this.log.error(`Libération (${civId})`, err));
      const civ: ActiveCiv = {
        id: civId,
        manifest,
        pack,
        scope,
        sceneScope: null,
        ctx: null as unknown as CivContext,
        mechanics: new Map(),
        settings: new Map(),
        panels: new Map(pack.defs.panels.map((p) => [p.id, p])),
        panelResolvers: new Map(),
        panelLocks: new Map(),
        abilities: new Map(pack.defs.abilities.map((a) => [a.id, a])),
        inputBindings: new Map(),
        inputHandlers: new Map(),
        lifecycle: new Map(),
        sceneStates: new Map(Object.entries(saved?.scenes ?? {})),
        uiStore: new Map(),
        uiStoreSubs: new Map(),
        playTime: saved?.playTime ?? 0,
        huds: pack.defs.huds,
      };
      this.civ = civ;
      civ.ctx = createCivContext(this, civ, scope);

      // Restore local state.
      this.vars.restore((saved?.vars ?? {}) as Record<string, never>, civId);
      this.inventory.restore(saved?.inventory ?? []);
      this.quests.load([...pack.quests.values()]);
      if (saved) this.quests.restore(saved.quests as never);
      this.dialogue.restore(saved?.dialogue ?? { seen: [], chosen: [] });
      this.rules.firedOnce.clear();
      for (const r of saved?.rulesFired ?? []) this.rules.firedOnce.add(r);
      this.player.resetCivilizationState();
      this.player.title = saved?.player.title ?? null;

      // Mechanic settings (Civilization Rules editor).
      for (const m of pack.defs.mechanics) {
        if (m.settings) {
          const { value, issues } = normalizeProps(m.settings, pack.rules.settings[m.id] ?? {});
          for (const i of issues) this.logHub.logger('règles').warn(`${m.id}.${i.path} : ${i.message}`);
          civ.settings.set(m.id, value as Record<string, unknown>);
        }
      }

      // Mechanics in dependency order.
      for (const def of this.orderMechanics(pack.defs.mechanics)) {
        const state = migrateVersioned(saved?.mechanics[def.id], def.state, () => (def.state ? def.state.initial() : undefined), def.id, (m) =>
          this.log.warn(m),
        );
        const record = { def, state, api: undefined as unknown, failed: null as string | null };
        civ.mechanics.set(def.id, record);
        try {
          record.api = def.setup(civ.ctx, state as never, (civ.settings.get(def.id) ?? {}) as never);
        } catch (err) {
          record.failed = toError(err).message;
          this.log.error(`La mécanique ${def.id} a échoué à l'initialisation`, err);
        }
      }
      for (const hud of civ.huds) scope.add(this.ui.registerHud(hud, civId));
      for (const el of manifest.hud.hide) this.ui.setHudVisible(el as never, false);
      for (const a of civ.abilities.values()) if (a.autoGrant) this.player.abilities.add(a.id);
      for (const a of saved?.player.abilities ?? []) if (civ.abilities.has(a)) this.player.abilities.add(a);
      this.rules.load(pack.logic);

      const firstTime = !this.multiverse.progress(civId).started || !saved;
      this.multiverse.markStarted(civId);
      if (firstTime) this.multiverse.recordAwakening();

      const entry = manifest.entry;
      const sceneId = opts.scene ?? saved?.scene ?? entry?.scene;
      if (!sceneId) throw new Error(`Aucune scène d'entrée pour "${civId}".`);
      const restorePos = saved && !opts.scene && !opts.spawn ? saved.player : null;
      await this.enterScene(sceneId, opts.spawn ?? (restorePos ? undefined : entry?.spawn), {
        position: restorePos ? { x: restorePos.position[0], y: restorePos.position[1], z: restorePos.position[2] } : undefined,
        yaw: restorePos?.yaw,
        pitch: restorePos?.pitch,
      });
      this.runLifecycle('start');
      this.bus.emit('civ.started', { civId });
      this.quests.evaluate();
    } catch (err) {
      this.log.error('Chargement de la civilisation impossible', err);
      if (this.civ) await this.unloadCivilization({ keepState: true }).catch((e) => this.log.error('Nettoyage impossible', e));
      throw err;
    } finally {
      this.loading = false;
      this.changed();
    }
  }

  private orderMechanics(defs: MechanicDefinition<unknown, unknown, PropSchema>[]): MechanicDefinition<unknown, unknown, PropSchema>[] {
    const byId = new Map(defs.map((d) => [d.id, d]));
    const out: MechanicDefinition<unknown, unknown, PropSchema>[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (d: MechanicDefinition<unknown, unknown, PropSchema>, chain: string[]) => {
      const s = state.get(d.id);
      if (s === 'done') return;
      if (s === 'visiting') throw new Error(`Dépendance circulaire entre mécaniques : ${[...chain, d.id].join(' → ')}`);
      state.set(d.id, 'visiting');
      for (const dep of d.dependsOn ?? []) {
        const dd = byId.get(dep);
        if (!dd) throw new Error(`La mécanique ${d.id} dépend de ${dep}, introuvable.`);
        visit(dd, [...chain, d.id]);
      }
      state.set(d.id, 'done');
      out.push(d);
    };
    for (const d of defs) visit(d, []);
    return out;
  }

  runLifecycle(phase: LifecyclePhase): void {
    for (const cb of [...(this.civ?.lifecycle.get(phase) ?? [])]) {
      try {
        cb({ sceneId: this.world?.id ?? '' });
      } catch (err) {
        this.log.error(`Erreur dans le cycle de vie "${phase}"`, err);
      }
    }
  }

  /** Unloads the active civilization. Its local state is kept in memory unless `keepState` is false. */
  async unloadCivilization(opts: { keepState?: boolean } = {}): Promise<void> {
    const civ = this.civ;
    if (!civ) return;
    if (opts.keepState !== false) {
      try {
        this.civStates.set(civ.id, this.snapshotCivState());
      } catch (err) {
        this.log.error('Instantané de la civilisation impossible', err);
      }
    }
    this.runLifecycle('unload');
    this.bus.emit('civ.unloading', { civId: civ.id });
    this.dialogue.abort();
    this.cinematics.abort();
    this.exitScene();
    for (const [id, resolve] of civ.panelResolvers) {
      resolve(null);
      this.ui.closePanel(id);
    }
    civ.panelLocks.forEach((l) => l.dispose());
    civ.scope.dispose();
    this.rules.unload();
    this.quests.load([]);
    this.vars.clearNamespace(civ.id);
    this.inventory.clear();
    this.dialogue.restore({ seen: [], chosen: [] });
    this.player.resetCivilizationState();
    this.ui.resetCiv(civ.id);
    this.unregisterPack(civ.id);
    this.pauseReasons.clear();
    this._paused = false;
    this.inputDown.clear();
    this.civ = null;
    this.changed();
  }

  /** Listener count above the engine baseline (isolation diagnostics). */
  get leakedListeners(): number {
    return this.bus.listenerCount - this.engineListenerBaseline;
  }

  // -------------------------------------------------------------------------------------------
  // Scenes
  // -------------------------------------------------------------------------------------------

  async enterScene(sceneId: string, spawnId?: string, place: { position?: Vec3; yaw?: number; pitch?: number } = {}): Promise<void> {
    const civ = this.civ;
    if (!civ) throw new Error('Aucune civilisation active.');
    const doc = await loadSceneDoc(this.provider, civ.pack, sceneId);
    this.exitScene();
    const world = new SceneWorld(doc, this.blocks);
    const saved = civ.sceneStates.get(sceneId);
    for (const [x, y, z, id] of saved?.voxelEdits ?? []) world.setBlock(x, y, z, id);
    const sceneScope = civ.scope.child(`scene:${sceneId}`);
    civ.sceneScope = sceneScope;
    this.world = world;
    const removed = new Set(saved?.removed ?? []);
    for (const ed of doc.entities) {
      if (removed.has(ed.id)) {
        world.removedEntities.add(ed.id);
        continue;
      }
      world.addEntity(this.prepareEntity(new RuntimeEntity(ed), saved?.entities[ed.id]));
    }
    for (const ed of saved?.spawned ?? []) world.addEntity(this.prepareEntity(new RuntimeEntity(ed, true, true), saved?.entities[ed.id]));
    for (const e of world.entities.values()) this.behaviors.instantiate(e, saved?.entities[e.id]);
    world.computeLight();
    this.placePlayer(world, spawnId, place);
    this.registerPlayerCollider();
    this.changed();
    this.runLifecycle('sceneEnter');
    this.bus.emit('scene.entered', { sceneId });
    const env = doc.environment;
    if (env.music !== null) this.presentation.emit({ type: 'music', id: env.music, fade: 2 });
    if (env.ambience !== null) this.presentation.emit({ type: 'ambience', id: env.ambience, fade: 2 });
  }

  private prepareEntity(e: RuntimeEntity, st: EntityState | undefined): RuntimeEntity {
    if (!st) return e;
    if (st.position) e.position = { x: st.position[0], y: st.position[1], z: st.position[2] };
    if (st.yaw !== undefined) e.rotation[1] = st.yaw;
    if (st.visible !== undefined) e.visible = st.visible;
    if (st.enabled !== undefined) e.enabled = st.enabled;
    return e;
  }

  private placePlayer(world: SceneWorld, spawnId: string | undefined, place: { position?: Vec3; yaw?: number; pitch?: number }): void {
    if (place.position) {
      this.player.teleport(place.position);
      this.player.setLook(place.yaw ?? 0, place.pitch ?? 0);
      return;
    }
    const spawns = [...world.entities.values()].filter((e) => e.has('core.spawn'));
    const spawn = (spawnId ? world.entities.get(spawnId) : undefined) ?? spawns.find((s) => s.components.get('core.spawn')?.props.isDefault) ?? spawns[0];
    if (spawnId && !world.entities.get(spawnId)) this.log.warn(`Point d'apparition introuvable : ${spawnId}`);
    if (spawn) {
      const ground = world.groundAt(spawn.position.x, spawn.position.z, spawn.position.y + 0.5);
      this.player.teleport({ x: spawn.position.x, y: ground ?? spawn.position.y, z: spawn.position.z });
      this.player.setLook(spawn.yaw * DEG2RAD, 0);
    } else {
      const v = world.volume;
      const x = v.sizeX / 2;
      const z = v.sizeZ / 2;
      this.player.teleport({ x, y: (world.groundAt(x, z, v.sizeY) ?? v.sizeY) + 0.01, z });
      this.log.warn(`Aucun point d'apparition dans la scène ${world.id}.`);
    }
  }

  private registerPlayerCollider(): void {
    const w = this.world;
    if (!w) return;
    w.colliders.set({ id: 'player#body', owner: 'player', box: this.player.body.box(), solid: true, pickable: false, enabled: true });
  }

  /** Captures the live scene state into the civilization's scene states and disposes the scene. */
  exitScene(): void {
    const civ = this.civ;
    const world = this.world;
    if (!civ || !world) return;
    this.runLifecycle('sceneExit');
    this.bus.emit('scene.exiting', { sceneId: world.id });
    civ.sceneStates.set(world.id, this.captureSceneState(world));
    this.dialogue.abort();
    this.cinematics.abort();
    this.behaviors.destroyAll();
    civ.sceneScope?.dispose();
    civ.sceneScope = null;
    this.world = null;
    this.interaction.reset();
    this.changed();
  }

  /** Changes scene with a fade (used by portals and the core.changeScene action). */
  async changeScene(sceneId: string, spawnId?: string): Promise<void> {
    this.presentation.emit({ type: 'fx', fx: 'fade', params: { to: 1, seconds: 0.5 } });
    const lock = this.player.lockMovement('transition');
    try {
      await this.enterScene(sceneId, spawnId);
    } finally {
      lock.dispose();
      this.presentation.emit({ type: 'fx', fx: 'fade', params: { to: 0, seconds: 0.8 } });
    }
  }

  captureSceneState(world: SceneWorld): SceneState {
    const entities: Record<string, EntityState> = {};
    const spawned: EntityDoc[] = [];
    for (const e of world.entities.values()) {
      const st = this.behaviors.captureEntityState(e);
      if (st) entities[e.id] = st;
      if (e.spawned && e.persistent) spawned.push({ ...e.doc, position: [e.position.x, e.position.y, e.position.z], rotation: [...e.rotation] });
    }
    const voxelEdits: SceneState['voxelEdits'] = [];
    const v = world.volume;
    for (const [index, id] of world.voxelEdits) {
      const x = index % v.sizeX;
      const z = Math.floor(index / v.sizeX) % v.sizeZ;
      const y = Math.floor(index / (v.sizeX * v.sizeZ));
      voxelEdits.push([x, y, z, id]);
    }
    return { entities, spawned, removed: [...world.removedEntities], voxelEdits };
  }

  /** Spawns an entity at runtime in the current scene. */
  spawnEntity(doc: EntityDoc, persistent: boolean): RuntimeEntity {
    const world = this.world;
    if (!world) throw new Error('Aucune scène chargée.');
    if (world.entities.has(doc.id)) throw new Error(`Une entité "${doc.id}" existe déjà.`);
    const e = new RuntimeEntity(doc, true, persistent);
    world.addEntity(e);
    this.behaviors.instantiate(e, undefined);
    return e;
  }

  despawnEntity(id: string): void {
    const world = this.world;
    const e = world?.entities.get(id);
    if (!world || !e) return;
    this.behaviors.destroy(e);
    world.removeEntity(id);
  }

  // -------------------------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------------------------

  update(rawDt: number): void {
    if (!this.civ || !this.world || this.loading) return;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    if (this._paused) return;
    this.civ.playTime += dt;
    this.multiverse.addPlayTime(this.civ.id, dt);
    this.clock.advance(dt);
    const world = this.world;
    if (!world) return;
    const ev = this.player.update(world.collision, dt);
    if (ev.jumped) this.bus.emit('player.jumped', {});
    if (ev.landed !== null) this.bus.emit('player.landed', { fallSpeed: ev.landed });
    world.colliders.updateBox('player#body', this.player.body.box());
    this.behaviors.update(dt);
    this.behaviors.updateMotors(dt);
    this.cinematics.update(dt);
    this.interaction.refresh();
    const region = world.flushLight();
    if (region) this.presentation.emit({ type: 'voxelsChanged', min: region.min, max: region.max });
  }

  // -------------------------------------------------------------------------------------------
  // Input actions (civilization-defined keys and abilities)
  // -------------------------------------------------------------------------------------------

  /** Called by the view when a key is pressed during gameplay. Returns true if consumed. */
  handleKey(code: string, down: boolean): boolean {
    const civ = this.civ;
    if (!civ) return false;
    let consumed = false;
    for (const [actionId, b] of civ.inputBindings) {
      if (b.key !== code) continue;
      consumed = true;
      if (down) {
        if (this.inputDown.has(actionId)) continue;
        this.inputDown.add(actionId);
        if (this._paused || this.player.movementLocked) continue;
        for (const h of [...(civ.inputHandlers.get(actionId) ?? [])]) {
          try {
            h();
          } catch (err) {
            this.log.error(`Erreur de l'action d'entrée ${actionId}`, err);
          }
        }
      } else this.inputDown.delete(actionId);
    }
    if (down) {
      for (const id of this.player.abilities) {
        const a = civ.abilities.get(id);
        if (a && a.key === code) {
          consumed = true;
          void this.activateAbility(id);
        }
      }
    }
    return consumed;
  }

  isInputDown(actionId: string): boolean {
    return this.inputDown.has(actionId);
  }

  async activateAbility(id: string): Promise<boolean> {
    const civ = this.civ;
    const a = civ?.abilities.get(id);
    if (!civ || !a || !this.player.abilities.has(id)) return false;
    if (this._paused || this.player.movementLocked || this.dialogue.isActive || this.cinematics.current) return false;
    if ((this.player.cooldowns.get(id) ?? 0) > 0) return false;
    try {
      if (a.canActivate && !a.canActivate(civ.ctx)) return false;
      const r = await a.activate(civ.ctx);
      if (r === false) return false;
      if (a.cooldown) this.player.cooldowns.set(id, a.cooldown);
      this.bus.emit('ability.used', { abilityId: id });
      return true;
    } catch (err) {
      this.log.error(`Erreur de la capacité ${id}`, err);
      return false;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Panels (civilization UI that can pause the game)
  // -------------------------------------------------------------------------------------------

  openPanel(id: string, props: Record<string, unknown>): Promise<unknown> {
    const civ = this.civ;
    const def = civ?.panels.get(id);
    if (!civ || !def) {
      this.log.error(`Panneau inconnu : ${id}`);
      return Promise.resolve(null);
    }
    civ.panelResolvers.get(id)?.(null);
    return new Promise((resolve) => {
      civ.panelResolvers.set(id, resolve);
      if (def.pausesGame !== false) civ.panelLocks.set(id, this.player.lockMovement(`panneau:${id}`));
      this.ui.openPanel(def, civ.id, props);
      this.bus.emit('ui.panelOpened', { panelId: id });
    });
  }

  closePanel(id: string, result: unknown): void {
    const civ = this.civ;
    if (!civ) return;
    const resolve = civ.panelResolvers.get(id);
    civ.panelResolvers.delete(id);
    civ.panelLocks.get(id)?.dispose();
    civ.panelLocks.delete(id);
    this.ui.closePanel(id);
    if (resolve) {
      this.bus.emit('ui.panelClosed', { panelId: id });
      resolve(result ?? null);
    }
  }

  isPanelOpen(id: string): boolean {
    return this.civ?.panelResolvers.has(id) ?? false;
  }

  // -------------------------------------------------------------------------------------------
  // Saves
  // -------------------------------------------------------------------------------------------

  snapshotCivState(opts: CivSnapshotOptions = {}): LocalCivState {
    const civ = this.civ;
    if (!civ) throw new Error('Aucune civilisation active.');
    for (const cb of civ.lifecycle.get('beforeSave') ?? []) {
      try {
        cb({ sceneId: this.world?.id ?? '' });
      } catch (err) {
        this.log.error('Erreur avant sauvegarde', err);
      }
    }
    const scenes: Record<string, SceneState> = Object.fromEntries(civ.sceneStates);
    if (this.world && opts.includeScene !== false) scenes[this.world.id] = this.captureSceneState(this.world);
    const mechanics: LocalCivState['mechanics'] = {};
    for (const [id, m] of civ.mechanics) {
      if (m.def.state) mechanics[id] = { version: m.def.state.version, state: structuredClone(m.state) };
    }
    const p = this.player.position;
    return {
      civId: civ.id,
      packVersion: civ.manifest.packVersion,
      stateVersion: civ.manifest.stateVersion,
      savedAt: new Date().toISOString(),
      scene: this.world?.id ?? civ.manifest.entry?.scene ?? '',
      player: {
        position: [p.x, p.y, p.z],
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        abilities: [...this.player.abilities],
        title: this.player.title,
      },
      vars: this.vars.snapshot(civ.id),
      inventory: this.inventory.entries(),
      quests: this.quests.snapshot(),
      dialogue: this.dialogue.snapshot(),
      rulesFired: [...this.rules.firedOnce],
      mechanics,
      scenes,
      playTime: civ.playTime,
    };
  }

  buildSaveGame(slot: string, label: string): SaveGame {
    if (this.civ) this.civStates.set(this.civ.id, this.snapshotCivState());
    return {
      format: SAVE_FORMAT,
      formatVersion: SAVE_FORMAT_VERSION,
      engineVersion: ENGINE_VERSION,
      savedAt: new Date().toISOString(),
      slot,
      label,
      global: this.multiverse.snapshot(),
      currentCiv: this.civ?.id ?? null,
      civs: Object.fromEntries(this.civStates),
    };
  }

  /** Replaces global and per-civilization states with a save (does not start a civilization). */
  async applySaveGame(save: SaveGame): Promise<void> {
    if (this.civ) await this.unloadCivilization({ keepState: false });
    this.multiverse.replace(save.global as GlobalState);
    this.civStates.clear();
    for (const [id, st] of Object.entries(save.civs)) this.civStates.set(id, st);
    this.changed();
  }

  /** New game: empty multiverse and civilization states. */
  async resetAll(): Promise<void> {
    if (this.civ) await this.unloadCivilization({ keepState: false });
    this.civStates.clear();
    this.multiverse.replace(new MultiverseState().snapshot());
    this.changed();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.unloadCivilization({ keepState: false });
    this.clock.reset();
    this.changeListeners.clear();
  }

  // -------------------------------------------------------------------------------------------
  // Helpers used by contexts and tools
  // -------------------------------------------------------------------------------------------

  /** Current scene document (Studio playtest compares with the edited one). */
  get sceneDoc(): SceneDoc | null {
    return this.world?.doc ?? null;
  }

  playerYawDeg(): number {
    return this.player.yaw * RAD2DEG;
  }
}
