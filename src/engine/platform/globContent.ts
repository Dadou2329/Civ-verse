/**
 * Content provider backed by Vite's import.meta.glob: manifests are bundled eagerly, pack code
 * and content files are lazily loaded chunks. Adding a pack directory is enough for it to appear.
 */
import type { ContentProvider, PackModule } from '../core/packs/pack';

const manifestModules = import.meta.glob('/civilizations/*/manifest.json', { eager: true, import: 'default' });
const packModules = import.meta.glob('/civilizations/*/pack.ts');
const contentModules = import.meta.glob(['/civilizations/*/content/**/*.json', '/civilizations/*/locales/*.json'], { import: 'default' });

const PATH_RE = /^\/civilizations\/([^/]+)\/(.+)$/;

function split(path: string): { pack: string; rel: string } | null {
  const m = PATH_RE.exec(path);
  return m ? { pack: m[1]!, rel: m[2]! } : null;
}

export class GlobContentProvider implements ContentProvider {
  async listManifests(): Promise<unknown[]> {
    return Object.values(manifestModules).map((m) => structuredClone(m));
  }

  async loadPackModule(packId: string): Promise<PackModule> {
    const loader = packModules[`/civilizations/${packId}/pack.ts`];
    if (!loader) throw new Error(`pack.ts introuvable pour "${packId}".`);
    const mod = (await loader()) as { default?: PackModule };
    if (!mod.default) throw new Error(`civilizations/${packId}/pack.ts doit exporter definePack(...) par défaut.`);
    return mod.default;
  }

  async listFiles(packId: string): Promise<string[]> {
    const out: string[] = [];
    for (const path of Object.keys(contentModules)) {
      const s = split(path);
      if (s && s.pack === packId) out.push(s.rel);
    }
    return out.sort();
  }

  async readJson(packId: string, relPath: string): Promise<unknown> {
    const loader = contentModules[`/civilizations/${packId}/${relPath}`];
    if (!loader) throw new Error(`Fichier de contenu introuvable : ${packId}/${relPath}`);
    return structuredClone(await loader());
  }
}
