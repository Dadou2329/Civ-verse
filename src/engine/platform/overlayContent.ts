/**
 * Content provider that layers unsaved Civilization Studio documents over another provider.
 *
 * Used by the Studio's playtest (PLAY): the game runs exactly what is being edited, including
 * files not yet written to disk, while the base provider supplies everything else.
 */
import type { ContentProvider, PackModule } from '../core/packs/pack';

export interface ContentOverlay {
  /** "<pack>/<relative path>" → parsed JSON document (manifests: "<pack>/manifest.json"). */
  files: Map<string, unknown>;
  /** "<pack>/<relative path>" of files deleted in the Studio but still on disk. */
  deleted?: Set<string>;
  /** Replaces pack code loading (hot-reloaded scripts in the Studio). */
  loadPackModule?: (packId: string) => Promise<PackModule>;
}

export class OverlayContentProvider implements ContentProvider {
  constructor(
    private readonly base: ContentProvider,
    private readonly overlay: ContentOverlay,
  ) {}

  async listManifests(): Promise<unknown[]> {
    const base = await this.base.listManifests();
    const out = base.map((m) => {
      const id = (m as { id?: unknown }).id;
      const override = typeof id === 'string' ? this.overlay.files.get(`${id}/manifest.json`) : undefined;
      return structuredClone(override ?? m);
    });
    // Packs that only exist in the Studio (not yet saved).
    for (const [key, doc] of this.overlay.files) {
      if (!key.endsWith('/manifest.json')) continue;
      const id = key.slice(0, -'/manifest.json'.length);
      if (!out.some((m) => (m as { id?: unknown }).id === id)) out.push(structuredClone(doc));
    }
    return out;
  }

  loadPackModule(packId: string): Promise<PackModule> {
    return this.overlay.loadPackModule ? this.overlay.loadPackModule(packId) : this.base.loadPackModule(packId);
  }

  async listFiles(packId: string): Promise<string[]> {
    const files = new Set(await this.base.listFiles(packId).catch(() => [] as string[]));
    const prefix = `${packId}/`;
    for (const key of this.overlay.files.keys()) {
      if (key.startsWith(prefix) && key !== `${packId}/manifest.json`) files.add(key.slice(prefix.length));
    }
    for (const key of this.overlay.deleted ?? []) if (key.startsWith(prefix)) files.delete(key.slice(prefix.length));
    return [...files].sort();
  }

  async readJson(packId: string, relPath: string): Promise<unknown> {
    const key = `${packId}/${relPath}`;
    if (this.overlay.deleted?.has(key)) throw new Error(`Fichier supprimé dans le Studio : ${key}`);
    const doc = this.overlay.files.get(key);
    if (doc !== undefined) return structuredClone(doc);
    return this.base.readJson(packId, relPath);
  }
}
