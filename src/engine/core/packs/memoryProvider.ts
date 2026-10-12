/**
 * In-memory content provider (tests, tools, generated content).
 */
import type { ContentProvider, PackModule } from './pack';

export interface MemoryPack {
  manifest: unknown;
  module: PackModule;
  /** Content files keyed by path relative to the pack root. */
  files: Record<string, unknown>;
}

export class MemoryContentProvider implements ContentProvider {
  constructor(private readonly packs: Record<string, MemoryPack>) {}

  async listManifests(): Promise<unknown[]> {
    return Object.values(this.packs).map((p) => structuredClone(p.manifest));
  }

  async loadPackModule(packId: string): Promise<PackModule> {
    const p = this.packs[packId];
    if (!p) throw new Error(`Pack inconnu : ${packId}`);
    return p.module;
  }

  async listFiles(packId: string): Promise<string[]> {
    return Object.keys(this.packs[packId]?.files ?? {}).sort();
  }

  async readJson(packId: string, relPath: string): Promise<unknown> {
    const f = this.packs[packId]?.files[relPath];
    if (f === undefined) throw new Error(`Fichier introuvable : ${packId}/${relPath}`);
    return structuredClone(f);
  }

  /** Replaces a file (tests simulating content edits). */
  setFile(packId: string, relPath: string, content: unknown): void {
    const p = this.packs[packId];
    if (!p) throw new Error(`Pack inconnu : ${packId}`);
    p.files[relPath] = content;
  }
}
