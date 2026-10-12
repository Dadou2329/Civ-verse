/**
 * The Studio's working copies of a civilization's files.
 *
 * Documents are loaded from disk (through the dev server's scoped file API), edited in memory by
 * commands (see history.ts) and written back on « Enregistrer ». Each change gets a new revision
 * number; a document is dirty while its revision differs from the one last saved, so undoing back
 * to the saved state makes it clean again.
 *
 * Content documents are replaced immutably by edits (unchanged entities keep their identity),
 * which lets the scene editor refresh only what changed.
 */
import { classifyContentPath } from '@engine/core/packs/pack';
import type { ContentOverlay } from '@engine/platform/overlayContent';

export type DocKind =
  | 'manifest'
  | 'scene'
  | 'dialogue'
  | 'quest'
  | 'cinematic'
  | 'logic'
  | 'prefab'
  | 'items'
  | 'characters'
  | 'rules'
  | 'locale'
  | 'script'
  | 'style'
  | 'other';

export interface StudioDoc {
  /** Repository-relative path: "civilizations/door/content/dialogues/noe.dialogue.json". */
  readonly path: string;
  readonly pack: string;
  /** Path inside the pack: "content/dialogues/noe.dialogue.json". */
  readonly rel: string;
  readonly kind: DocKind;
  /** Content id ("noe") for content files, file name otherwise. */
  readonly id: string;
  /** Parsed JSON for content files, text for scripts and styles. */
  data: unknown;
  loaded: boolean;
  /** Modification time on disk when last read or written (null: not on disk yet). */
  mtimeMs: number | null;
  revision: number;
  savedRevision: number;
  isNew: boolean;
  deleted: boolean;
}

export interface ProjectIO {
  readonly writable: boolean;
  /** Repository-relative file paths of each pack. */
  listPacks(): Promise<{ id: string; files: string[] }[]>;
  read(path: string): Promise<{ content: string; mtimeMs: number | null }>;
  write(path: string, content: string, expectedMtimeMs: number | null): Promise<{ mtimeMs: number; backup: string | null }>;
  remove(path: string): Promise<{ backup: string | null }>;
}

export interface SaveReport {
  saved: string[];
  failed: { path: string; error: string }[];
}

let revisionCounter = 0;
export function nextRevision(): number {
  return ++revisionCounter;
}

export function packPath(pack: string, rel: string): string {
  return `civilizations/${pack}/${rel}`;
}

export function splitPath(path: string): { pack: string; rel: string } {
  const m = /^civilizations\/([^/]+)\/(.+)$/.exec(path);
  if (!m) throw new Error(`Chemin hors des civilisations : ${path}`);
  return { pack: m[1]!, rel: m[2]! };
}

export function kindOf(rel: string): { kind: DocKind; id: string } {
  if (rel === 'manifest.json') return { kind: 'manifest', id: 'manifest' };
  const c = classifyContentPath(rel);
  const base = rel.split('/').pop() ?? rel;
  if (c) return { kind: c.kind as DocKind, id: c.id ?? base.replace(/\.json$/, '') };
  if (/\.tsx?$/.test(rel)) return { kind: 'script', id: base };
  if (rel.endsWith('.css')) return { kind: 'style', id: base };
  return { kind: 'other', id: base };
}

/** Documents loaded with the pack (JSON content); scripts are read when opened. */
function isContentKind(kind: DocKind): boolean {
  return kind !== 'script' && kind !== 'style' && kind !== 'other';
}

export class StudioProject {
  readonly docs = new Map<string, StudioDoc>();
  packs: { id: string; files: string[] }[] = [];
  private listeners = new Set<(paths: string[]) => void>();
  /** Hooks run before a document is serialized (the scene editor refreshes voxel data). */
  readonly beforeSerialize = new Set<(doc: StudioDoc) => void>();

  constructor(readonly io: ProjectIO) {}

  onChange(cb: (paths: string[]) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  emit(paths: string[]): void {
    for (const l of this.listeners) l(paths);
  }

  get writable(): boolean {
    return this.io.writable;
  }

  async refreshListing(): Promise<void> {
    this.packs = await this.io.listPacks();
    const listed = new Set<string>();
    for (const p of this.packs) {
      for (const path of p.files) {
        listed.add(path);
        if (this.docs.has(path)) continue;
        const { pack, rel } = splitPath(path);
        const { kind, id } = kindOf(rel);
        this.docs.set(path, { path, pack, rel, kind, id, data: null, loaded: false, mtimeMs: null, revision: 0, savedRevision: 0, isNew: false, deleted: false });
      }
    }
    // Files deleted outside the Studio disappear, unless they hold unsaved edits (saving them
    // will write them again).
    for (const [path, doc] of this.docs) {
      if (!listed.has(path) && !doc.isNew && !this.isDirty(doc)) this.docs.delete(path);
    }
    this.emit([]);
  }

  /** Reads every content document of a pack (manifest, scenes, dialogues, locales...). */
  async loadPack(packId: string): Promise<void> {
    if (this.packs.length === 0) await this.refreshListing();
    const pending = [...this.docs.values()].filter((d) => d.pack === packId && !d.loaded && isContentKind(d.kind));
    await Promise.all(pending.map((d) => this.load(d.path)));
    this.emit(pending.map((d) => d.path));
  }

  /** Reads one document from disk (content parsed as JSON, scripts as text). */
  async load(path: string): Promise<StudioDoc> {
    const doc = this.require(path);
    const { content, mtimeMs } = await this.io.read(path);
    doc.data = isContentKind(doc.kind) ? JSON.parse(content) : content;
    doc.mtimeMs = mtimeMs;
    doc.loaded = true;
    doc.revision = doc.savedRevision = nextRevision();
    return doc;
  }

  /** Re-reads a clean document changed on disk by someone else. Dirty documents are kept. */
  async reloadIfClean(path: string): Promise<boolean> {
    const doc = this.docs.get(path);
    if (!doc || !doc.loaded || this.isDirty(doc)) return false;
    await this.load(path);
    this.emit([path]);
    return true;
  }

  doc(path: string): StudioDoc | undefined {
    return this.docs.get(path);
  }

  require(path: string): StudioDoc {
    const d = this.docs.get(path);
    if (!d) throw new Error(`Document inconnu : ${path}`);
    return d;
  }

  docsOf(pack: string, kind?: DocKind): StudioDoc[] {
    return [...this.docs.values()].filter((d) => d.pack === pack && !d.deleted && (!kind || d.kind === kind)).sort((a, b) => a.path.localeCompare(b.path));
  }

  isDirty(doc: StudioDoc): boolean {
    // A document created then removed before any save leaves nothing to write.
    if (doc.isNew && doc.deleted) return false;
    return doc.isNew || doc.deleted || doc.revision !== doc.savedRevision;
  }

  dirty(): StudioDoc[] {
    return [...this.docs.values()].filter((d) => d.loaded && this.isDirty(d));
  }

  /** Replaces a document's data (used by commands; `revision` identifies the version). */
  setData(path: string, data: unknown, revision: number): void {
    const doc = this.require(path);
    doc.data = data;
    doc.revision = revision;
    this.emit([path]);
  }

  /** Marks a document changed without replacing its data (live voxel edits). */
  touch(path: string, revision: number): void {
    const doc = this.require(path);
    doc.revision = revision;
    this.emit([path]);
  }

  /** Creates a new document (written on the next save). */
  create(pack: string, rel: string, data: unknown): StudioDoc {
    const path = packPath(pack, rel);
    const existing = this.docs.get(path);
    if (existing && !existing.deleted) throw new Error(`Le fichier existe déjà : ${path}`);
    const { kind, id } = kindOf(rel);
    const rev = nextRevision();
    const doc: StudioDoc = { path, pack, rel, kind, id, data, loaded: true, mtimeMs: existing?.mtimeMs ?? null, revision: rev, savedRevision: existing ? existing.savedRevision : -1, isNew: !existing, deleted: false };
    this.docs.set(path, doc);
    this.emit([path]);
    return doc;
  }

  setDeleted(path: string, deleted: boolean): void {
    const doc = this.require(path);
    doc.deleted = deleted;
    this.emit([path]);
  }

  serialize(doc: StudioDoc): string {
    for (const hook of this.beforeSerialize) hook(doc);
    if (typeof doc.data === 'string') return doc.data;
    return `${JSON.stringify(doc.data, null, 2)}\n`;
  }

  async save(doc: StudioDoc): Promise<void> {
    if (!this.io.writable) throw new Error('Studio en lecture seule : le serveur de développement est nécessaire pour enregistrer.');
    if (doc.deleted) {
      if (!doc.isNew) await this.io.remove(doc.path);
      this.docs.delete(doc.path);
      this.emit([doc.path]);
      return;
    }
    const revision = doc.revision;
    const res = await this.io.write(doc.path, this.serialize(doc), doc.isNew ? null : doc.mtimeMs);
    doc.mtimeMs = res.mtimeMs;
    doc.savedRevision = revision;
    doc.isNew = false;
    const listing = this.packs.find((p) => p.id === doc.pack);
    if (listing && !listing.files.includes(doc.path)) listing.files.push(doc.path);
    this.emit([doc.path]);
  }

  async saveAll(): Promise<SaveReport> {
    const report: SaveReport = { saved: [], failed: [] };
    for (const doc of this.dirty()) {
      try {
        await this.save(doc);
        report.saved.push(doc.path);
      } catch (err) {
        report.failed.push({ path: doc.path, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return report;
  }

  /** Every loaded JSON document of the given packs, as the game would read them (playtest). */
  overlay(packIds: string[]): ContentOverlay {
    const files = new Map<string, unknown>();
    const deleted = new Set<string>();
    for (const doc of this.docs.values()) {
      if (!packIds.includes(doc.pack) || !doc.loaded || !isContentKind(doc.kind)) continue;
      const key = `${doc.pack}/${doc.rel}`;
      if (doc.deleted) {
        deleted.add(key);
        continue;
      }
      for (const hook of this.beforeSerialize) hook(doc);
      files.set(key, doc.data);
    }
    return { files, deleted };
  }
}
