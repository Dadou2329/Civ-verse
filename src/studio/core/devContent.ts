/**
 * Where the Studio reads files from.
 *
 * Under `npm run dev`, every read goes through the scoped file API (always the version on disk),
 * and pack code is re-imported with a version marker after a script changed, so the Studio runs
 * the new code without reloading the page. Without the dev server (a build made with
 * CIV_BUILD_STUDIO=1), the Studio only reads the bundled content and cannot write anything.
 */
import { devApi } from '@engine/platform/devApi';
import { GlobContentProvider } from '@engine/platform/globContent';
import type { ContentProvider, PackModule } from '@engine/core/packs/pack';
import type { ProjectIO } from './project';

const packVersions = new Map<string, number>();

/** Marks a pack's code as changed: the next load imports fresh modules. */
export function bumpPackCode(packId: string): void {
  packVersions.set(packId, (packVersions.get(packId) ?? 0) + 1);
}

async function importPack(packId: string): Promise<PackModule> {
  const v = packVersions.get(packId) ?? 0;
  const url = v > 0 ? `/civilizations/${packId}/pack.ts?studio=${v}` : `/civilizations/${packId}/pack.ts`;
  const mod = (await import(/* @vite-ignore */ url)) as { default?: PackModule };
  if (!mod.default) throw new Error(`civilizations/${packId}/pack.ts doit exporter definePack(...) par défaut.`);
  return mod.default;
}

/** Content provider reading the files on disk through the dev server. */
export class DevContentProvider implements ContentProvider {
  private listing: Promise<{ id: string; files: string[] }[]> | null = null;

  private packs(): Promise<{ id: string; files: string[] }[]> {
    this.listing ??= devApi.listPacks().then((r) => r.packs);
    return this.listing;
  }

  /** Forget the file listing (files were created or deleted). */
  invalidate(): void {
    this.listing = null;
  }

  async listManifests(): Promise<unknown[]> {
    const packs = await this.packs();
    const out: unknown[] = [];
    for (const p of packs) {
      const path = `civilizations/${p.id}/manifest.json`;
      if (!p.files.includes(path)) continue;
      out.push(JSON.parse((await devApi.readFile(path)).content));
    }
    return out;
  }

  loadPackModule(packId: string): Promise<PackModule> {
    return importPack(packId);
  }

  async listFiles(packId: string): Promise<string[]> {
    const pack = (await this.packs()).find((p) => p.id === packId);
    const prefix = `civilizations/${packId}/`;
    return (pack?.files ?? [])
      .filter((f) => f.endsWith('.json') && (f.startsWith(`${prefix}content/`) || f.startsWith(`${prefix}locales/`)))
      .map((f) => f.slice(prefix.length));
  }

  async readJson(packId: string, relPath: string): Promise<unknown> {
    return JSON.parse((await devApi.readFile(`civilizations/${packId}/${relPath}`)).content);
  }
}

/** Project file access through the dev server. */
export const devProjectIO: ProjectIO = {
  writable: true,
  listPacks: async () => (await devApi.listPacks()).packs,
  read: async (path) => {
    const f = await devApi.readFile(path);
    return { content: f.content, mtimeMs: f.mtimeMs };
  },
  write: async (path, content, expectedMtimeMs) => {
    const r = await devApi.writeFile(path, content, expectedMtimeMs);
    return { mtimeMs: r.mtimeMs, backup: r.backup };
  },
  remove: async (path) => {
    const r = await devApi.deleteFile(path);
    return { backup: r.backup };
  },
};

/** Read-only project access to the bundled content (no dev server). */
export function bundledProjectIO(provider = new GlobContentProvider()): ProjectIO {
  return {
    writable: false,
    listPacks: async () => {
      const manifests = (await provider.listManifests()) as { id: string }[];
      const out: { id: string; files: string[] }[] = [];
      for (const m of manifests) {
        const files = (await provider.listFiles(m.id)).map((rel) => `civilizations/${m.id}/${rel}`);
        out.push({ id: m.id, files: [`civilizations/${m.id}/manifest.json`, ...files] });
      }
      return out;
    },
    read: async (path) => {
      const m = /^civilizations\/([^/]+)\/(.+)$/.exec(path);
      if (!m) throw new Error(`Chemin invalide : ${path}`);
      if (m[2] === 'manifest.json') {
        const manifests = (await provider.listManifests()) as { id: string }[];
        const found = manifests.find((x) => x.id === m[1]);
        if (!found) throw new Error(`Manifeste introuvable : ${path}`);
        return { content: JSON.stringify(found), mtimeMs: null };
      }
      return { content: JSON.stringify(await provider.readJson(m[1]!, m[2]!)), mtimeMs: null };
    },
    write: () => Promise.reject(new Error('Studio en lecture seule.')),
    remove: () => Promise.reject(new Error('Studio en lecture seule.')),
  };
}
