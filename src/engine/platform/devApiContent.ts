/**
 * Content provider for Civilization Studio: reads content from the dev server file API (always
 * the current files on disk, never stale bundles); pack code still comes from the module graph.
 */
import { GlobContentProvider } from './globContent';
import { devApi } from './devApi';

export class DevApiContentProvider extends GlobContentProvider {
  private listing: Map<string, string[]> | null = null;

  async refresh(): Promise<void> {
    const r = await devApi.listPacks();
    this.listing = new Map(r.packs.map((p) => [p.id, p.files]));
  }

  override async listManifests(): Promise<unknown[]> {
    if (!this.listing) await this.refresh();
    const out: unknown[] = [];
    for (const [id, files] of this.listing!) {
      if (!files.includes(`civilizations/${id}/manifest.json`)) continue;
      out.push(JSON.parse((await devApi.readFile(`civilizations/${id}/manifest.json`)).content));
    }
    return out;
  }

  override async listFiles(packId: string): Promise<string[]> {
    if (!this.listing) await this.refresh();
    const prefix = `civilizations/${packId}/`;
    return (this.listing!.get(packId) ?? [])
      .filter((f) => f.endsWith('.json') && (f.startsWith(`${prefix}content/`) || f.startsWith(`${prefix}locales/`)))
      .map((f) => f.slice(prefix.length));
  }

  override async readJson(packId: string, relPath: string): Promise<unknown> {
    const r = await devApi.readFile(`civilizations/${packId}/${relPath}`);
    return JSON.parse(r.content);
  }
}
