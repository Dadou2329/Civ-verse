/**
 * Studio — the editor's controller. Owns the editing session (pack definitions and the scene
 * being edited, no behavior running), the working copies of the files, the undo history, the
 * selection and the tools. React components read it and call its methods; nothing in here
 * depends on the DOM or on Babylon, so it is unit-tested headlessly.
 */
import { GameSession } from '@engine/core/sim/session';
import { HeadlessUi } from '@engine/core/sim/uiBridge';
import type { ContentProvider } from '@engine/core/packs/pack';
import type { EntityDoc, SceneDoc } from '@engine/core/content/schemas';
import type { SceneWorld } from '@engine/core/world/sceneWorld';
import { volumeToDoc } from '@engine/core/world/sceneVoxels';
import { normalizeProps } from '@engine/core/props/props';
import type { StringTable } from '@engine/core/i18n/localizer';
import { frenchApostrophes } from '@engine/core/i18n/typography';
import { History } from './history';
import { StudioProject, packPath, type DocKind, type ProjectIO, type StudioDoc } from './project';
import { addEntities, changeDoc, clone, removeEntities, uniqueEntityId, updateEntities, voxelCommand, type VoxelChange } from './edits';
import type { EntityTemplate } from './templates';

export type ToolId = 'select' | 'place' | 'erase' | 'paint' | 'pick' | 'box';
export type GizmoMode = 'move' | 'rotate' | 'scale';

export interface StudioTab {
  /** = document path, or "scene" tabs keyed by path too. */
  path: string;
  kind: DocKind;
  title: string;
}

export interface LogLine {
  id: number;
  level: 'info' | 'success' | 'warning' | 'error';
  text: string;
  at: number;
  /** Document to open when the line is clicked. */
  path?: string;
}

export interface StudioOptions {
  io: ProjectIO;
  provider: ContentProvider;
}

let logId = 0;

export class Studio {
  readonly history = new History();
  readonly project: StudioProject;
  packId: string | null = null;
  scenePath: string | null = null;
  tabs: StudioTab[] = [];
  activeTab: string | null = null;
  selection: string[] = [];
  tool: ToolId = 'select';
  gizmo: GizmoMode = 'move';
  snap = { enabled: true, move: 0.5, rotate: 15, scale: 0.25 };
  block = 'core:stone';
  log: LogLine[] = [];
  busy: string | null = null;
  private listeners = new Set<() => void>();
  private version = 0;
  private voxelsDirty = false;
  private voxelUnsub: (() => void) | null = null;

  private constructor(
    readonly session: GameSession,
    readonly provider: ContentProvider,
    io: ProjectIO,
  ) {
    this.project = new StudioProject(io);
    this.project.beforeSerialize.add((doc) => this.flushVoxels(doc));
    this.project.onChange((paths) => {
      if (this.scenePath && paths.includes(this.scenePath)) this.syncWorld();
      this.changed();
    });
    this.history.onChange(() => this.changed());
  }

  static async create(opts: StudioOptions): Promise<Studio> {
    const session = await GameSession.create({ mode: 'playtest', provider: opts.provider, ui: new HeadlessUi(), locale: 'fr-FR' });
    const studio = new Studio(session, opts.provider, opts.io);
    await studio.project.refreshListing();
    return studio;
  }

  // ---------------------------------------------------------------------------------------------
  // Change notification (React reads the version through useSyncExternalStore)
  // ---------------------------------------------------------------------------------------------

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getVersion = (): number => this.version;

  changed(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  get writable(): boolean {
    return this.project.writable;
  }

  print(level: LogLine['level'], text: string, path?: string): void {
    this.log = [...this.log.slice(-299), { id: ++logId, level, text, at: Date.now(), path }];
    this.changed();
  }

  /** Player-facing text of a localization key (pack tables, engine table). */
  t(key: string): string {
    return key ? this.session.t(key) : '';
  }

  // ---------------------------------------------------------------------------------------------
  // Packs and documents
  // ---------------------------------------------------------------------------------------------

  /** Civilization and library packs found on disk. */
  packList(): string[] {
    return this.project.packs.map((p) => p.id).sort();
  }

  async openPack(packId: string): Promise<void> {
    this.busy = `Ouverture de « ${packId} »…`;
    this.changed();
    try {
      this.closeScene();
      await this.session.refreshManifests();
      const manifest = this.session.manifests.get(packId);
      for (const dep of manifest?.dependencies ?? []) await this.project.loadPack(dep);
      await this.project.loadPack(packId);
      await this.session.loadPackDefinitions(packId);
      this.syncLocales(packId);
      this.packId = packId;
      this.tabs = [];
      this.activeTab = null;
      this.history.clear();
      const entry = manifest?.entry?.scene ?? this.project.docsOf(packId, 'scene')[0]?.id;
      if (entry) await this.openDoc(packPath(packId, `content/scenes/${entry}.scene.json`));
      this.print('info', `Pack « ${packId} » ouvert.`);
    } finally {
      this.busy = null;
      this.changed();
    }
  }

  /** Opens a document in a tab (scenes become the scene being edited). */
  async openDoc(path: string): Promise<void> {
    const doc = this.project.require(path);
    if (!doc.loaded) await this.project.load(path);
    if (doc.kind === 'scene') await this.openScene(path);
    if (!this.tabs.some((t) => t.path === path)) this.tabs = [...this.tabs, { path, kind: doc.kind, title: titleOf(doc) }];
    this.activeTab = path;
    this.changed();
  }

  closeTab(path: string): void {
    this.tabs = this.tabs.filter((t) => t.path !== path);
    if (this.activeTab === path) this.activeTab = this.tabs[this.tabs.length - 1]?.path ?? null;
    if (path === this.scenePath) {
      const nextScene = this.tabs.find((t) => t.kind === 'scene');
      if (nextScene) void this.openScene(nextScene.path);
      else this.closeScene();
    }
    this.changed();
  }

  doc(path: string): StudioDoc | undefined {
    return this.project.doc(path);
  }

  // ---------------------------------------------------------------------------------------------
  // The scene being edited
  // ---------------------------------------------------------------------------------------------

  get world(): SceneWorld | null {
    return this.scenePath ? this.session.world : null;
  }

  sceneDoc(): SceneDoc | null {
    return this.scenePath ? (this.project.doc(this.scenePath)?.data as SceneDoc | undefined) ?? null : null;
  }

  async openScene(path: string): Promise<void> {
    if (this.scenePath === path && this.session.world) return;
    const doc = this.project.require(path);
    if (!doc.loaded) await this.project.load(path);
    this.closeScene();
    const world = this.session.openEditorWorld(doc.data as SceneDoc);
    this.scenePath = path;
    this.selection = [];
    this.voxelsDirty = false;
    this.voxelUnsub = world.onVoxelsChanged(() => (this.voxelsDirty = true));
    this.changed();
  }

  closeScene(): void {
    if (!this.scenePath) return;
    const doc = this.project.doc(this.scenePath);
    if (doc) this.flushVoxels(doc);
    this.voxelUnsub?.();
    this.voxelUnsub = null;
    this.session.closeEditorWorld();
    this.scenePath = null;
    this.selection = [];
    this.changed();
  }

  /** Writes the live voxels of the open scene into its document (before saving or playing). */
  private flushVoxels(doc: StudioDoc): void {
    if (doc.path !== this.scenePath || !this.voxelsDirty) return;
    const world = this.session.world;
    if (!world) return;
    doc.data = { ...(doc.data as SceneDoc), voxels: volumeToDoc(world.volume) };
    this.voxelsDirty = false;
  }

  /** Brings the editor world in line with the scene document (after an edit, undo or redo). */
  private syncWorld(): void {
    const world = this.session.world;
    const scene = this.sceneDoc();
    if (!world || !scene) return;
    const seen = new Set<string>();
    for (const ed of scene.entities) {
      seen.add(ed.id);
      const e = world.entities.get(ed.id);
      if (!e || e.doc !== ed) this.session.refreshEditorEntity(ed);
    }
    for (const id of [...world.entities.keys()]) if (!seen.has(id)) world.removeEntity(id);
    this.selection = this.selection.filter((id) => seen.has(id));
  }

  entity(id: string): EntityDoc | undefined {
    return this.sceneDoc()?.entities.find((e) => e.id === id);
  }

  select(ids: string[], mode: 'replace' | 'toggle' | 'add' = 'replace'): void {
    if (mode === 'replace') this.selection = [...ids];
    else if (mode === 'add') this.selection = [...new Set([...this.selection, ...ids])];
    else {
      const set = new Set(this.selection);
      for (const id of ids) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      }
      this.selection = [...set];
    }
    this.changed();
  }

  /** Records a change of the scene document. */
  editScene(label: string, produce: (scene: SceneDoc) => SceneDoc, mergeKey?: string): boolean {
    if (!this.scenePath) return false;
    return changeDoc<SceneDoc>(this.project, this.history, this.scenePath, label, produce, mergeKey);
  }

  /** Records a change of any document. */
  editDoc<T>(path: string, label: string, produce: (data: T) => T, mergeKey?: string): boolean {
    return changeDoc<T>(this.project, this.history, path, label, produce, mergeKey);
  }

  updateSelected(label: string, fn: (e: EntityDoc) => EntityDoc | void, mergeKey?: string): void {
    const ids = this.selection;
    if (ids.length === 0) return;
    this.editScene(label, (s) => updateEntities(s, ids, fn), mergeKey);
  }

  /** Adds an entity from a template at a position; its texts get localization keys. */
  addFromTemplate(tpl: EntityTemplate, position: [number, number, number]): string | null {
    const scene = this.sceneDoc();
    const pack = this.packId;
    if (!scene || !pack) return null;
    const id = uniqueEntityId(scene, tpl.base);
    const components = clone(tpl.components);
    return this.history.transaction(`Ajouter : ${tpl.label}`, () => {
      for (const [path, text] of Object.entries(tpl.texts ?? {})) {
        const [component, prop, index] = [path.split('.').slice(0, 2).join('.'), path.split('.')[2]!, path.split('.')[3]];
        const key = this.newTextKey(`${scene.id}.${id}.${prop}${index !== undefined ? `.${index}` : ''}`, text);
        const target = (components[component] ??= {});
        if (index !== undefined) {
          const list = Array.isArray(target[prop]) ? [...(target[prop] as unknown[])] : [];
          list[Number(index)] = key;
          target[prop] = list;
        } else target[prop] = key;
      }
      const doc: EntityDoc = { id, position: snapVec(position, 0.5), components };
      this.editScene(`Ajouter : ${tpl.label}`, (s) => addEntities(s, [doc]));
      this.selection = [id];
      return id;
    });
  }

  duplicateSelection(): void {
    const scene = this.sceneDoc();
    if (!scene || this.selection.length === 0) return;
    const taken = new Set<string>();
    const copies = this.selection
      .map((id) => scene.entities.find((e) => e.id === id))
      .filter((e): e is EntityDoc => !!e)
      .map((e) => {
        const copy = clone(e);
        copy.id = uniqueEntityId(scene, e.id, taken);
        taken.add(copy.id);
        copy.position = [e.position[0] + 1, e.position[1], e.position[2]];
        return copy;
      });
    this.editScene(copies.length > 1 ? `Dupliquer ${copies.length} entités` : `Dupliquer « ${copies[0]!.id} »`, (s) => addEntities(s, copies));
    this.selection = copies.map((c) => c.id);
    this.changed();
  }

  deleteSelection(): void {
    const ids = this.selection;
    if (ids.length === 0) return;
    this.editScene(ids.length > 1 ? `Supprimer ${ids.length} entités` : `Supprimer « ${ids[0]} »`, (s) => removeEntities(s, ids));
    this.selection = [];
    this.changed();
  }

  renameEntity(oldId: string, newId: string): string | null {
    const scene = this.sceneDoc();
    if (!scene || oldId === newId) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(newId)) return 'Identifiant invalide : lettres, chiffres, _ et - uniquement.';
    if (scene.entities.some((e) => e.id === newId)) return `L’identifiant « ${newId} » existe déjà.`;
    // The selection follows the new id (the world sync drops ids that no longer exist).
    this.selection = this.selection.map((id) => (id === oldId ? newId : id));
    this.editScene(`Renommer « ${oldId} »`, (s) => ({ ...s, entities: s.entities.map((e) => (e.id === oldId ? { ...clone(e), id: newId } : e)) }));
    this.changed();
    return null;
  }

  // ---------------------------------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------------------------------

  editVoxels(label: string, changes: VoxelChange[]): void {
    const path = this.scenePath;
    if (!path) return;
    const effective = changes.filter(([, , , b, a]) => b !== a);
    if (effective.length === 0) return;
    this.history.push(voxelCommand(this.project, path, label, effective, (p) => (p === this.scenePath ? this.session.world : null)));
  }

  /**
   * Starts a block stroke painted live in the viewport. `commit` records it as one undo step
   * (nothing is recorded if nothing changed).
   */
  beginVoxelStroke(label: string): { changes: VoxelChange[]; commit(): void } {
    const path = this.scenePath;
    const changes: VoxelChange[] = [];
    if (!path) return { changes, commit: () => undefined };
    const cmd = voxelCommand(this.project, path, label, changes, (p) => (p === this.scenePath ? this.session.world : null));
    return {
      changes,
      commit: () => {
        if (changes.length === 0) return;
        cmd.apply(); // the blocks are already there: this marks the scene changed
        this.history.push(cmd, { applied: true });
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Texts (localization keys of the active pack)
  // ---------------------------------------------------------------------------------------------

  localePath(pack = this.packId ?? ''): string {
    return packPath(pack, 'locales/fr-FR.json');
  }

  /** Creates a key "<pack>.<suffix>" (made unique) holding a French text. */
  newTextKey(suffix: string, text: string): string {
    const pack = this.packId!;
    const path = this.localePath(pack);
    let doc = this.project.doc(path);
    if (!doc) doc = this.project.create(pack, 'locales/fr-FR.json', {});
    const table = (doc.data ?? {}) as StringTable;
    const base = `${pack}.${suffix}`.replace(/[^A-Za-z0-9_.-]+/g, '_');
    let key = base;
    for (let i = 2; table[key] !== undefined; i++) key = `${base}_${i}`;
    this.editDoc<StringTable>(path, 'Nouveau texte', (t) => ({ ...t, [key]: frenchApostrophes(text) }));
    this.syncLocales(pack);
    return key;
  }

  /** Changes the French text of a key of the active pack (merging successive keystrokes). */
  setText(key: string, raw: string): void {
    const pack = this.packId;
    if (!pack) return;
    const text = frenchApostrophes(raw);
    const path = this.localePath(pack);
    if (!this.project.doc(path)) this.project.create(pack, 'locales/fr-FR.json', {});
    this.editDoc<StringTable>(path, 'Modifier un texte', (t) => (t[key] === text ? t : { ...t, [key]: text }), `texte:${key}`);
    this.syncLocales(pack);
  }

  /** Whether a key belongs to the active pack's table (editable here). */
  ownsKey(key: string): boolean {
    const table = this.project.doc(this.localePath())?.data as StringTable | undefined;
    return !!table && key in table;
  }

  /** Pushes the working locale tables into the session so names show edited texts. */
  syncLocales(pack: string): void {
    const doc = this.project.doc(this.localePath(pack));
    if (doc?.loaded && doc.data) this.session.i18n.addTable(pack, 'fr-FR', doc.data as StringTable);
  }

  // ---------------------------------------------------------------------------------------------
  // Undo, redo, save
  // ---------------------------------------------------------------------------------------------

  undo(): void {
    this.history.undo();
    if (this.packId) this.syncLocales(this.packId);
  }

  redo(): void {
    this.history.redo();
    if (this.packId) this.syncLocales(this.packId);
  }

  async saveAll(): Promise<boolean> {
    const dirty = this.project.dirty();
    if (dirty.length === 0) {
      this.print('info', 'Rien à enregistrer.');
      return true;
    }
    this.busy = 'Enregistrement…';
    this.changed();
    try {
      const report = await this.project.saveAll();
      for (const p of report.saved) this.print('success', `Enregistré : ${p}`, p);
      for (const f of report.failed) this.print('error', `Échec de l’enregistrement de ${f.path} : ${f.error}`, f.path);
      return report.failed.length === 0;
    } finally {
      this.busy = null;
      this.changed();
    }
  }

  /** Reloads a pack's code after one of its scripts changed (no page reload). */
  async reloadPackCode(packId: string): Promise<void> {
    if (!this.session.loadedPacks.has(packId)) return;
    const scene = this.scenePath;
    if (scene) {
      const doc = this.project.doc(scene);
      if (doc) this.flushVoxels(doc);
    }
    this.closeScene();
    try {
      await this.session.reloadPack(packId);
      if (this.packId && this.packId !== packId) await this.session.loadPackDefinitions(this.packId);
      if (this.packId) this.syncLocales(this.packId);
      this.print('success', `Code du pack « ${packId} » rechargé.`);
    } catch (err) {
      this.print('error', `Rechargement du code impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
    if (scene) await this.openScene(scene);
  }

  /** Normalized props of a component (defaults filled) — for display. */
  componentProps(type: string, raw: Record<string, unknown>): Record<string, unknown> {
    const def = this.session.behaviorDefs.get(type)?.def;
    return def ? (normalizeProps(def.props, raw).value as Record<string, unknown>) : raw;
  }
}

function snapVec(p: [number, number, number], step: number): [number, number, number] {
  return [Math.round(p[0] / step) * step, Math.round(p[1] / step) * step, Math.round(p[2] / step) * step];
}

const KIND_LABEL: Record<DocKind, string> = {
  manifest: 'Civilisation',
  scene: 'Scène',
  dialogue: 'Dialogue',
  quest: 'Quête',
  cinematic: 'Cinématique',
  logic: 'Logique',
  prefab: 'Préfabriqué',
  items: 'Objets',
  characters: 'Personnages',
  rules: 'Règles',
  locale: 'Textes',
  script: 'Script',
  style: 'Style',
  other: 'Fichier',
};

export function kindLabel(kind: DocKind): string {
  return KIND_LABEL[kind];
}

export function titleOf(doc: StudioDoc): string {
  if (doc.kind === 'items' || doc.kind === 'characters' || doc.kind === 'rules' || doc.kind === 'manifest') return KIND_LABEL[doc.kind];
  if (doc.kind === 'locale') return `Textes (${doc.id})`;
  return doc.id;
}
