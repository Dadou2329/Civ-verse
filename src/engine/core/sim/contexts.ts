/**
 * Builds the runtime API objects (CivContext, BehaviorContext, EntityApi) given to pack code.
 *
 * Every registration goes through the context's DisposableScope, so unloading a civilization
 * (or destroying an entity) releases its listeners, timers, modifiers, UI and input bindings.
 */
import type {
  AudioApi,
  BehaviorContext,
  CinematicApi,
  CivContext,
  CombatApi,
  EquipmentApi,
  DialogueApi,
  EntityApi,
  FxApi,
  InputApi,
  InventoryApi,
  LifecycleApi,
  LogicApi,
  MechanicsApi,
  MultiverseApi,
  PlayerApi,
  QuestApi,
  SceneApi,
  SettingsApi,
  TimeApi,
  UiApi,
  VariablesApi,
  WorldApi,
  RaycastResult,
  MoveToOptions,
} from './api';
import type { GameSession, ActiveCiv } from './session';
import type { DisposableScope } from '../util/disposable';
import { toDisposable } from '../util/disposable';
import { ScopedEvents } from '../events/eventBus';
import type { RuntimeEntity, ComponentRecord } from '../world/entity';
import { pitchTowards, yawTowards, type Vec3, RAD2DEG, distance } from '../util/math';
import { raycastVoxels } from '../voxel/raycast';
import { findPath } from '../nav/pathfinder';
import type { JsonValue } from '../util/json';
import { NpcMotor } from './npcMotor';

export function createCivContext(session: GameSession, civ: ActiveCiv, scope: DisposableScope): CivContext {
  const civId = civ.id;
  const log = session.logHub.logger(civId);

  const vars: VariablesApi = {
    get: (name) => session.vars.get(name) as never,
    set(name, value) {
      if (!name.startsWith(`${civId}.`)) {
        throw new Error(`La civilisation "${civId}" ne peut écrire que ses variables (${civId}.*), pas "${name}".`);
      }
      session.vars.set(name, value);
    },
    add(name, delta) {
      const cur = session.vars.get(name);
      const next = (typeof cur === 'number' ? cur : 0) + delta;
      vars.set(name, next);
      return next;
    },
    toggle(name) {
      const next = !session.vars.get(name);
      vars.set(name, next);
      return next;
    },
    has: (name) => session.vars.has(name),
    declare(name, decl) {
      if (!name.startsWith(`${civId}.`)) throw new Error(`Variable hors de l’espace "${civId}." : ${name}`);
      session.vars.declare(name, decl);
    },
    watch: (name, cb) => scope.add(session.vars.watch(name, (v, p) => cb(v, p))),
    watchPrefix: (prefix, cb) => scope.add(session.vars.watchPrefix(prefix, cb)),
  };

  const multiverse: MultiverseApi = {
    get protagonist() {
      const p = session.multiverse.data.protagonist;
      return { awakenings: p.awakenings, title: p.title };
    },
    hasFragment: (id) => session.multiverse.hasFragment(id),
    fragments: () => session.multiverse.fragments(),
    grantFragment(id) {
      if (session.multiverse.grantFragment(id, civId, civ.manifest.globalWrites)) {
        session.bus.emit('multiverse.fragmentAcquired', { fragmentId: id, civId });
      }
    },
    getFlag: (name) => session.multiverse.getFlag(name),
    setFlag: (name, value) => session.multiverse.setFlag(name, value, civId, civ.manifest.globalWrites),
    isCivCompleted: (id) => session.multiverse.progress(id).completed,
    markCompleted: () => session.multiverse.markCompleted(civId),
  };

  const player: PlayerApi = {
    get position() {
      return { ...session.player.position };
    },
    get eye() {
      return session.player.eye;
    },
    get forward() {
      return session.player.forward;
    },
    get yaw() {
      return session.player.yaw;
    },
    get pitch() {
      return session.player.pitch;
    },
    get grounded() {
      return session.player.body.grounded;
    },
    setPosition: (p) => session.player.teleport(p),
    teleport(target, yawDeg) {
      if (typeof target === 'string') {
        const e = session.world?.entities.get(target);
        if (!e) throw new Error(`Point d’apparition introuvable : ${target}`);
        const ground = session.world!.groundAt(e.position.x, e.position.z, e.position.y + 0.5);
        session.player.teleport({ x: e.position.x, y: ground ?? e.position.y, z: e.position.z }, yawDeg ?? e.yaw);
      } else session.player.teleport(target, yawDeg);
    },
    setLook: (yaw, pitch) => session.player.setLook(yaw, pitch),
    lookAt(target) {
      const eye = session.player.eye;
      session.player.setLook(yawTowards(eye, target), pitchTowards(eye, target));
    },
    lockMovement: (reason) => scope.add(session.player.lockMovement(reason)),
    lockLook: (reason) => scope.add(session.player.lockLook(reason)),
    get movementLocked() {
      return session.player.movementLocked;
    },
    addMovementModifier: (mod) => scope.add(session.player.addModifier(mod)),
    get movement() {
      return session.player.params;
    },
    setBaseMovement: (patch) => session.player.setCivBase(patch),
    abilities: {
      grant(id) {
        if (!civ.abilities.has(id)) throw new Error(`Capacité inconnue : ${id}`);
        session.player.abilities.add(id);
        session.equipment.makePermanent(id);
        session.changed();
      },
      revoke(id) {
        session.player.abilities.delete(id);
        session.equipment.makePermanent(id);
        session.changed();
      },
      has: (id) => session.player.abilities.has(id),
      list: () => [...session.player.abilities],
      cooldown: (id) => session.player.cooldowns.get(id) ?? 0,
    },
    identity: {
      get title() {
        return session.player.title;
      },
      setTitle(key) {
        session.player.title = key;
        session.changed();
      },
    },
    box: () => session.player.body.box(),
    forceMove: (velocity, seconds, opts) => session.player.forceMove(velocity, seconds, opts),
    get forcedMoving() {
      return session.player.forcedMoving;
    },
    cancelForcedMove: () => session.player.cancelForcedMove(),
    impulse: (v) => session.player.impulse(v),
  };

  const world: WorldApi = {
    get sceneId() {
      return session.world?.id ?? '';
    },
    entity: (id) => session.entityApi(id),
    require(id) {
      const e = session.entityApi(id);
      if (!e) throw new Error(`Entité introuvable dans la scène "${session.world?.id}" : ${id}`);
      return e;
    },
    query(q = {}) {
      const w = session.world;
      if (!w) return [];
      const out: EntityApi[] = [];
      for (const e of w.entities.values()) {
        if (q.tag && !e.tags.includes(q.tag)) continue;
        if (q.component && !e.components.has(q.component)) continue;
        if (q.near && distance(e.position, q.near.point) > q.near.radius) continue;
        out.push(session.entityApi(e.id)!);
      }
      return out;
    },
    spawn(doc, opts) {
      const id = doc.id ?? `${civId}_${Math.random().toString(36).slice(2, 9)}`;
      const e = session.spawnEntity(
        { id, name: doc.name, position: doc.position, rotation: doc.rotation, tags: doc.tags, components: doc.components },
        opts?.persistent ?? false,
      );
      return session.entityApi(e.id)!;
    },
    despawn: (id) => session.despawnEntity(id),
    getBlock: (x, y, z) => session.world?.volume.get(x, y, z) ?? 'core:air',
    setBlock: (x, y, z, id) => session.world?.setBlock(x, y, z, id),
    fillBlocks: (from, to, id) => session.world?.fillBlocks(from, to, id),
    raycast(origin, dir, maxDistance): RaycastResult | null {
      const w = session.world;
      if (!w) return null;
      const vox = raycastVoxels(w.volume, w.paletteInfo(), origin, dir, maxDistance);
      const col = w.colliders.raycast(origin, dir, vox?.distance ?? maxDistance, (c) => c.owner !== 'player');
      if (col && (!vox || col.distance <= vox.distance)) {
        return { entity: session.entityApi(col.entry.owner), block: null, point: col.point, distance: col.distance };
      }
      if (vox) return { entity: null, block: { x: vox.x, y: vox.y, z: vox.z, id: vox.blockId, normal: vox.normal }, point: vox.point, distance: vox.distance };
      return null;
    },
    findPath: (from, to) => (session.world ? findPath(session.world.collision, from, to, { ignoreOwner: 'player' }) : null),
    groundAt: (x, z, nearY) => session.world?.groundAt(x, z, nearY) ?? null,
    modelInfo(modelId) {
      const def = session.models.get(modelId);
      if (!def) return null;
      const built = session.models.build(modelId);
      return {
        bounds: { min: [...built.bounds.min], max: [...built.bounds.max] },
        light: def.light ? { level: def.light.level, color: def.light.color, offset: def.light.offset ?? [0, (built.bounds.max[1] + built.bounds.min[1]) / 2, 0] } : null,
        pickable: def.pickable !== false,
      };
    },
  };

  const inventory: InventoryApi = {
    add(itemId, count = 1, opts) {
      const def = session.items.get(itemId);
      if (!def) throw new Error(`Objet inconnu : ${itemId}`);
      const total = session.inventory.add(itemId, count, def.stackable === false ? 1 : (def.maxStack ?? Infinity));
      if (!opts?.silent) session.notify(session.t('core.item.acquired', { name: session.t(def.name), count }), 'item', 3.5, itemId);
      session.bus.emit('item.acquired', { itemId, count, total });
      return total;
    },
    remove(itemId, count = 1, opts) {
      const ok = session.inventory.remove(itemId, count);
      if (ok) {
        const def = session.items.get(itemId);
        if (!opts?.silent && def) session.notify(session.t('core.item.removed', { name: session.t(def.name), count }), 'item', 3, itemId);
        session.bus.emit('item.removed', { itemId, count, total: session.inventory.count(itemId) });
      }
      return ok;
    },
    count: (id) => session.inventory.count(id),
    has: (id, count = 1) => session.inventory.count(id) >= count,
    list: () => session.inventory.entries(),
    nameOf: (id) => {
      const def = session.items.get(id);
      return def ? session.t(def.name) : id;
    },
    async use(itemId, actionId) {
      const def = session.items.get(itemId);
      if (!def || !session.inventory.count(itemId)) return;
      const action = actionId ? def.actions?.find((a) => a.id === actionId) : def.actions?.[0];
      if (!action) return;
      if (!session.interpreter.test(action.condition ?? null, { origin: `objet ${itemId}` })) return;
      session.bus.emit('item.used', { itemId, action: action.id });
      await session.interpreter.run(action.actions, { origin: `objet ${itemId}/${action.id}` });
    },
  };

  const quests: QuestApi = {
    start: (id) => session.quests.start(id),
    status: (id) => session.quests.status(id),
    stage: (id) => session.quests.stage(id),
    setStage: (id, st) => session.quests.setStage(id, st),
    completeObjective: (id, o) => session.quests.completeObjective(id, o),
    isObjectiveDone: (id, o) => session.quests.isObjectiveDone(id, o),
    complete: (id) => session.quests.complete(id),
    fail: (id) => session.quests.fail(id),
    active: () => session.quests.active(),
    track: (id) => session.quests.track(id),
  };

  const dialogue: DialogueApi = {
    start: (id, opts) => session.dialogue.start(id, opts),
    get active() {
      return session.dialogue.isActive;
    },
    seen: (d, n) => session.dialogue.seen(d, n),
    chose: (d, c) => session.dialogue.chose(d, c),
  };

  const cinematics: CinematicApi = {
    play: (id) => session.cinematics.play(id),
    skip: () => session.cinematics.skip(),
    get playing() {
      return session.cinematics.current?.id ?? null;
    },
  };

  const ui: UiApi = {
    notify: (text, opts) => session.notify(text, opts?.kind ?? 'info', opts?.duration ?? 3.5, opts?.icon),
    showLocation: (title, subtitle) => session.ui.showLocation(title, subtitle),
    showDocument: (doc) => {
      const lock = session.player.lockMovement('document');
      return session.ui.showDocument(doc).finally(() => lock.dispose());
    },
    openPanel: (id, props) => session.openPanel(id, props ?? {}) as never,
    closePanel: (id, result) => session.closePanel(id, result),
    isPanelOpen: (id) => session.isPanelOpen(id),
    setHudVisible(el, visible) {
      session.ui.setHudVisible(el, visible);
      scope.addFn(() => session.ui.setHudVisible(el, true));
    },
    showEndScreen: (spec) => session.ui.showEndScreen(spec),
    confirm: (spec) => session.ui.confirm(spec),
    store: {
      get: (key) => civ.uiStore.get(key) as never,
      set(key, value) {
        civ.uiStore.set(key, value);
        for (const cb of [...(civ.uiStoreSubs.get(key) ?? [])]) cb(value);
      },
      subscribe(key, cb) {
        let set = civ.uiStoreSubs.get(key);
        if (!set) {
          set = new Set();
          civ.uiStoreSubs.set(key, set);
        }
        const s = set;
        s.add(cb);
        return scope.add(toDisposable(() => s.delete(cb)));
      },
    },
  };

  const audio: AudioApi = {
    play(soundId, opts) {
      const handle = session.presentation.newHandle();
      let at: Vec3 | undefined;
      let entity: string | undefined;
      if (typeof opts?.at === 'string') entity = opts.at;
      else if (opts?.at) at = opts.at;
      session.presentation.emit({ type: 'sound', id: soundId, handle, at, entity, volume: opts?.volume, pitch: opts?.pitch, loop: opts?.loop });
      const stop = () => session.presentation.emit({ type: 'stopSound', handle });
      if (opts?.loop) scope.addFn(stop);
      return { stop };
    },
    music: (id, opts) => session.presentation.emit({ type: 'music', id, fade: opts?.fade ?? 2 }),
    ambience: (id, opts) => session.presentation.emit({ type: 'ambience', id, fade: opts?.fade ?? 2 }),
  };

  const fx: FxApi = {
    fade(opacity, seconds, color) {
      session.presentation.emit({ type: 'fx', fx: 'fade', params: { to: opacity, seconds, color } });
      return session.clock.wait(seconds);
    },
    flash: (color, seconds) => session.presentation.emit({ type: 'fx', fx: 'flash', params: { color, seconds } }),
    shake: (intensity, seconds) => session.presentation.emit({ type: 'fx', fx: 'shake', params: { intensity, seconds } }),
    vignette: (intensity, seconds, color) => session.presentation.emit({ type: 'fx', fx: 'vignette', params: { intensity, seconds, color } }),
    fov: (delta, seconds) => session.presentation.emit({ type: 'fx', fx: 'fov', params: { delta, seconds } }),
    tint: (color, strength, seconds) => session.presentation.emit({ type: 'fx', fx: 'tint', params: { color, strength, seconds } }),
    environment: (patch, seconds) => session.presentation.emit({ type: 'environment', patch, seconds }),
    custom: (channel, payload) => session.presentation.emit({ type: 'custom', channel, payload }),
  };

  const input: InputApi = {
    bind(actionId, spec) {
      civ.inputBindings.set(actionId, { ...spec });
      session.changed();
      return scope.add(
        toDisposable(() => {
          civ.inputBindings.delete(actionId);
          session.changed();
        }),
      );
    },
    onPressed(actionId, cb) {
      let set = civ.inputHandlers.get(actionId);
      if (!set) {
        set = new Set();
        civ.inputHandlers.set(actionId, set);
      }
      const s = set;
      s.add(cb);
      return scope.add(toDisposable(() => s.delete(cb)));
    },
    isDown: (id) => session.isInputDown(id),
  };

  const eq = session.equipment;
  const equipment: EquipmentApi = {
    get held() {
      return eq.held;
    },
    hotbar: () => [...eq.hotbar],
    get selected() {
      return eq.selected;
    },
    select: (i) => eq.select(i),
    hold: (id) => eq.hold(id),
    assign: (i, id) => eq.assign(i, id),
    equip: (id) => eq.equip(id),
    unequip: (slot) => eq.unequip(slot),
    worn: (slot) => eq.wornIn(slot),
    wornItems: () => [...eq.worn].map(([slot, itemId]) => ({ slot, itemId })),
    ready: (button) => eq.ready(button),
    get drawRemaining() {
      return eq.hand.drawRemaining;
    },
    delayUse: (s) => eq.delayUse(s),
    guardSwitch: (fn) => scope.add(eq.guardSwitch(fn)),
    setUnarmed: (spec) => eq.setUnarmed(spec),
    press: (b) => eq.press(b),
    release: (b) => eq.release(b),
    setProgress(p) {
      eq.progress = p ? { label: p.label, value: Math.min(1, Math.max(0, p.value)) } : null;
    },
    hand: eq.handApi,
  };

  const cb = session.combat;
  const combat: CombatApi = {
    enablePlayer: (opts) => cb.enablePlayer(opts),
    get enabled() {
      return cb.enabled;
    },
    player: {
      get health() {
        return cb.player.health;
      },
      get maxHealth() {
        return cb.player.maxHealth;
      },
      get defeated() {
        return cb.player.defeated;
      },
      get guarding() {
        return cb.guarding;
      },
      get staggered() {
        return cb.player.stagger > 0;
      },
      get riposte() {
        return Math.max(0, cb.player.riposteUntil - session.clock.now);
      },
    },
    get inCombat() {
      return cb.inCombat;
    },
    get tuning() {
      return cb.tuning;
    },
    damagePlayer: (info) => cb.damagePlayer(info),
    healPlayer: (n) => cb.healPlayer(n),
    setPlayerMaxHealth: (n, refill) => cb.setPlayerMaxHealth(n, refill),
    damage: (id, info) => cb.damage(id, info),
    heal: (id, n) => cb.healthOf(id)?.heal(n),
    stagger: (id, s) => cb.staggerEntity(id, s),
    strike: (spec) => cb.playerStrike(spec),
    raiseGuard: (spec) => {
      const release = cb.raiseGuard(spec);
      const d = scope.add(toDisposable(release));
      return () => d.dispose();
    },
    dodge: (dir) => cb.dodge(dir),
    setInvulnerable: (s) => cb.setInvulnerable(s),
    setCheckpoint(target, yawDeg) {
      if (target === undefined) return cb.setCheckpointHere();
      if (typeof target === 'string') {
        const e = session.world?.entities.get(target);
        if (!e) throw new Error(`Point de reprise introuvable : ${target}`);
        const ground = session.world!.groundAt(e.position.x, e.position.z, e.position.y + 0.5);
        cb.setCheckpoint({ x: e.position.x, y: ground ?? e.position.y, z: e.position.z }, ((yawDeg ?? e.yaw) * Math.PI) / 180);
      } else cb.setCheckpoint(target, ((yawDeg ?? session.playerYawDeg()) * Math.PI) / 180);
    },
    spawnProjectile: (spec) => cb.spawnProjectile(spec),
    spawnWave: (spec) => cb.spawnWave(spec),
    hostilesNear: (point, radius, toward) => cb.hostilesNear(point, radius, toward).map((h) => session.entityApi(h.entity.id)!),
    lineOfSight: (a, b) => cb.lineOfSight(a, b),
    reportEngaged: (id) => cb.reportEngaged(id),
    pushMusic(id, priority) {
      const token = cb.pushMusic(id, priority);
      const d = scope.add(toDisposable(() => cb.popMusic(token)));
      return () => d.dispose();
    },
    setBossBar(bar) {
      cb.bossBar = bar ? { entityId: bar.entityId, name: bar.name, title: bar.title ?? '', health: bar.health, max: bar.max, phase: bar.phase ?? 0 } : null;
    },
  };

  const time: TimeApi = {
    get now() {
      return session.clock.now;
    },
    onUpdate: (cb) => scope.add(session.clock.onUpdate(cb)),
    after: (s, cb) => scope.add(session.clock.after(s, cb)),
    every: (s, cb) => scope.add(session.clock.every(s, cb)),
    wait: (s) =>
      new Promise<void>((resolve) => {
        scope.add(session.clock.after(s, resolve));
      }),
  };

  const scenes: SceneApi = {
    get current() {
      return session.world?.id ?? '';
    },
    list: () => [...civ.pack.scenes.keys()],
    goTo: (sceneId, spawnId) => session.changeScene(sceneId, spawnId),
  };

  const logic: LogicApi = {
    run: (actions, s) => session.interpreter.run(actions, s),
    test: (cond, s) => session.interpreter.test(cond, s),
  };

  const mechanics: MechanicsApi = {
    get(id) {
      const m = civ.mechanics.get(id);
      if (!m) throw new Error(`Mécanique inconnue ou pas encore initialisée : ${id}`);
      return m.api as never;
    },
    has: (id) => civ.mechanics.has(id),
  };

  const lifecycle: LifecycleApi = {
    on(phase, cb) {
      let set = civ.lifecycle.get(phase);
      if (!set) {
        set = new Set();
        civ.lifecycle.set(phase, set);
      }
      const s = set;
      s.add(cb);
      return scope.add(toDisposable(() => s.delete(cb)));
    },
  };

  const settings: SettingsApi = {
    of: (id) => (civ.settings.get(id) ?? {}) as never,
  };

  return {
    civId,
    mode: session.mode,
    t: (key, params) => session.t(key, params),
    log,
    events: new ScopedEvents(session.bus, scope),
    vars,
    multiverse,
    player,
    world,
    inventory,
    quests,
    dialogue,
    cinematics,
    ui,
    audio,
    fx,
    input,
    equipment,
    combat,
    time,
    scenes,
    logic,
    mechanics,
    lifecycle,
    settings,
    scope,
    get view() {
      return session.view;
    },
  };
}

/** Behavior context: the civ context bound to the behavior's own scope + entity/props/state. */
export function createBehaviorContext(
  session: GameSession,
  civ: ActiveCiv,
  entity: RuntimeEntity,
  record: ComponentRecord,
  scope: DisposableScope,
): BehaviorContext<Record<string, unknown>, unknown> {
  const base = createCivContext(session, civ, scope);
  const api = session.entityApi(entity.id)!;
  // Accessors (not copied values): props/state change when overrides are applied or state restored.
  return {
    ...base,
    entity: api,
    component: record.type,
    get props() {
      return record.props;
    },
    get state() {
      return record.state;
    },
    get view() {
      return session.view;
    },
  };
}

/** Motors of moving entities (created by core.npc or on demand by moveTo). */
const motors = new WeakMap<RuntimeEntity, NpcMotor>();

export function motorOf(session: GameSession, e: RuntimeEntity, create = true): NpcMotor | null {
  let m = motors.get(e);
  if (!m && create && session.world) {
    const num = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);
    const npc = e.components.get('core.npc')?.props;
    const fighter = e.components.get('core.combatant')?.props;
    const height = num(npc?.height) ?? num(fighter?.height) ?? 1.8;
    const width = num(fighter?.width) ?? 0.6;
    m = new NpcMotor(e, session.world, height, width);
    motors.set(e, m);
  }
  return m ?? null;
}

export function dropMotor(e: RuntimeEntity): void {
  motors.get(e)?.cancel(false);
  motors.delete(e);
}

export function createEntityApi(session: GameSession, e: RuntimeEntity): EntityApi {
  const world = () => {
    const w = session.world;
    if (!w || w.entities.get(e.id) !== e) throw new Error(`L’entité ${e.id} n’est plus dans la scène.`);
    return w;
  };
  const resolveTarget = (target: Vec3 | string): Vec3 | null => {
    if (typeof target !== 'string') return target;
    if (target === 'player') return { ...session.player.position };
    return session.world?.entities.get(target)?.position ?? null;
  };
  const api: EntityApi = {
    id: e.id,
    get name() {
      const npcName = e.components.get('core.npc')?.props.name;
      return typeof npcName === 'string' && npcName ? session.t(npcName) : (e.doc.name ?? e.id);
    },
    get tags() {
      return e.tags;
    },
    get position() {
      return { ...e.position };
    },
    get yaw() {
      return e.rotation[1];
    },
    setPosition(p) {
      e.position = { ...p };
      e.revision++;
      motorOf(session, e, false)?.syncFromEntity();
      world().syncColliders(e);
    },
    setYaw(deg) {
      e.rotation[1] = deg;
      e.revision++;
      world().syncColliders(e);
    },
    get visible() {
      return e.visible;
    },
    set visible(v: boolean) {
      if (e.visible === v) return;
      e.visible = v;
      e.revision++;
      world().syncColliders(e);
      session.behaviors.visibilityChanged(e);
    },
    get enabled() {
      return e.enabled;
    },
    set enabled(v: boolean) {
      if (e.enabled === v) return;
      e.enabled = v;
      e.revision++;
      world().syncColliders(e);
      session.behaviors.visibilityChanged(e);
    },
    has: (c) => e.components.has(c),
    props: (c) => (e.components.get(c)?.props ?? {}) as never,
    setProp: (c, key, value: JsonValue) => session.behaviors.setProp(e, c, key, value),
    behavior: (c) => (e.components.get(c)?.instance?.api ?? null) as never,
    distanceToPlayer: () => distance(e.position, session.player.position),
    lookAt(target) {
      if (target === null) e.view.lookAt = null;
      else if (target === 'player') e.view.lookAt = session.player.eye;
      else e.view.lookAt = { ...target };
      if (target !== null) {
        const t = target === 'player' ? session.player.position : target;
        const m = motorOf(session, e, false);
        const yaw = yawTowards(e.position, t);
        if (m && !m.moving) m.facing = yaw;
        else if (!m) {
          e.rotation[1] = yaw * RAD2DEG;
          e.revision++;
        }
      }
    },
    moveTo(target, opts: MoveToOptions = {}) {
      const dest = resolveTarget(target);
      if (!dest) return Promise.resolve(false);
      const m = motorOf(session, e, true);
      if (!m) return Promise.resolve(false);
      return m.moveTo(dest, opts).then((arrived) => {
        if (arrived) session.bus.emit('npc.arrived', { entityId: e.id });
        return arrived;
      });
    },
    stop: () => motorOf(session, e, false)?.cancel(false),
    get moving() {
      return motorOf(session, e, false)?.moving ?? false;
    },
    playAnimation(name, opts) {
      e.view.animation = name;
      e.view.animationLoop = opts?.loop ?? false;
      session.presentation.emit({ type: 'animation', entity: e.id, name, loop: opts?.loop ?? false, duration: opts?.duration });
    },
    setExpression(expression) {
      e.view.expression = expression;
      session.presentation.emit({ type: 'expression', entity: e.id, expression });
    },
    say(text, seconds = 3.5) {
      session.presentation.emit({ type: 'bark', entity: e.id, text: session.i18n.maybe(text), seconds });
    },
    setCollider: (part, local, opts) => world().setCollider(e, part, local, opts),
    setLights: (lights) => world().setEntityLights(e.id, lights.map((l) => ({ entityId: e.id, ...l }))),
    emit: (event, payload = {}) => session.bus.emit(event, { entityId: e.id, ...payload }),
    steer: (direction, speed) => motorOf(session, e, true)?.steer(direction, speed),
    push: (v) => motorOf(session, e, true)?.push(v),
    setViewFlag(key, value) {
      if (value === undefined || value === null) delete e.view.flags[key];
      else e.view.flags[key] = value;
    },
    viewFlag: (key) => e.view.flags[key] as never,
  };
  return api;
}
