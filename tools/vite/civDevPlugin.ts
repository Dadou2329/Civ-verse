/**
 * Civilization Studio development server plugin.
 *
 * Exposes a small, tightly scoped HTTP API used by Civilization Studio to read and write
 * civilization content and gameplay scripts inside the repository. It ONLY exists while the
 * Vite dev server runs (`apply: 'serve'`): production builds never contain a file-writing API.
 *
 * Safety rules (see docs/DECISIONS.md, ADR-006):
 * - every request must carry the `x-civ-studio: 1` header (blocks simple cross-site requests);
 * - the Host header must be a loopback address (DNS-rebinding protection);
 * - when the browser sends an Origin, it must be this server itself, and Sec-Fetch-Site may not
 *   be same-site or cross-site (another local web page cannot drive the API);
 * - paths are repository-relative, must live under `civilizations/<pack>/<allowed dir>/` (or be
 *   the pack's manifest.json), must
 *   use an allowed extension, and must resolve (after symlinks) inside the repository;
 * - writes are atomic (temp file + rename) and the previous version is copied to `.civ-backups/`;
 * - deletes move the file to `.civ-backups/` instead of destroying it.
 */
import type { Plugin } from 'vite';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from './aliases.ts';
import { createTypecheckService, type TypecheckService } from './typecheckService.ts';
import { scaffoldScript, type ScaffoldRequest } from './scaffold.ts';
import { READABLE_EXTENSIONS, WRITABLE_EXTENSIONS, WRITABLE_PACK_DIRS } from '../../src/engine/platform/devApiRules.ts';

const API_PREFIX = '/__civ/api/';
const MAX_BODY_BYTES = 32 * 1024 * 1024;

/** Where the API reads and writes: the repository (tests pass a temporary directory). */
interface DevRoots {
  repo: string;
  civ: string;
  backups: string;
}

function rootsOf(repo: string): DevRoots {
  return { repo, civ: path.join(repo, 'civilizations'), backups: path.join(repo, '.civ-backups') };
}

const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;

export class CivApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Validates and resolves a repository-relative pack path. Exported for unit tests. */
export function resolvePackPath(relPath: string, mode: 'read' | 'write', root: string = repoRoot): string {
  if (typeof relPath !== 'string' || relPath.length === 0 || relPath.length > 512) {
    throw new CivApiError(400, 'Chemin manquant ou trop long.');
  }
  if (relPath.includes('\0') || relPath.includes('\\') || path.isAbsolute(relPath)) {
    throw new CivApiError(400, 'Chemin invalide.');
  }
  const normalized = path.posix.normalize(relPath);
  if (normalized !== relPath || normalized.startsWith('..') || normalized.split('/').includes('..')) {
    throw new CivApiError(400, 'Chemin non normalisé ou sortant du dépôt.');
  }
  const parts = normalized.split('/');
  if (parts[0] !== 'civilizations' || parts.length < 3) {
    throw new CivApiError(403, 'Seuls les fichiers de civilizations/<pack>/ sont accessibles.');
  }
  const packId = parts[1] ?? '';
  if (!PACK_ID_RE.test(packId)) throw new CivApiError(400, `Identifiant de pack invalide : ${packId}`);
  const ext = path.posix.extname(normalized);
  if (mode === 'write') {
    const dir = parts[2] ?? '';
    const isManifest = parts.length === 3 && dir === 'manifest.json';
    if (!isManifest && (!(WRITABLE_PACK_DIRS as readonly string[]).includes(dir) || parts.length < 4)) {
      throw new CivApiError(403, `Écriture interdite hors de : ${WRITABLE_PACK_DIRS.join(', ')}.`);
    }
    if (!(WRITABLE_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new CivApiError(403, `Extension non autorisée en écriture : ${ext}`);
    }
  } else if (!(READABLE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new CivApiError(403, `Extension non autorisée en lecture : ${ext}`);
  }
  for (const segment of parts) {
    if (segment.startsWith('.')) throw new CivApiError(400, 'Les fichiers cachés ne sont pas accessibles.');
  }
  const abs = path.resolve(root, normalized);
  if (!abs.startsWith(path.join(root, 'civilizations') + path.sep)) throw new CivApiError(403, 'Chemin hors de civilizations/.');
  return abs;
}

/** Ensures that the real (symlink-resolved) location of `abs` stays inside civilizations/. */
async function assertRealPathInside(abs: string, civRoot: string): Promise<void> {
  let probe = abs;
  // Walk up to the first existing ancestor and resolve it.
  for (;;) {
    try {
      const real = await fsp.realpath(probe);
      const realRoot = await fsp.realpath(civRoot);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        throw new CivApiError(403, 'Lien symbolique sortant de civilizations/ refusé.');
      }
      return;
    } catch (err) {
      if (err instanceof CivApiError) throw err;
      const parent = path.dirname(probe);
      if (parent === probe) throw new CivApiError(500, 'Résolution de chemin impossible.');
      probe = parent;
    }
  }
}

function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

/** Rejects requests that do not come from a page of this dev server. Exported for unit tests. */
export function checkRequestOrigin(headers: IncomingHttpHeaders): void {
  if (headers['x-civ-studio'] !== '1') throw new CivApiError(403, 'En-tête x-civ-studio requis.');
  if (!isLoopbackHost(headers.host)) throw new CivApiError(403, 'Hôte non local refusé.');
  const origin = headers.origin;
  if (origin !== undefined) {
    let originHost: string | null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== headers.host) throw new CivApiError(403, 'Origine étrangère refusée.');
  }
  const site = headers['sec-fetch-site'];
  if (site === 'cross-site' || site === 'same-site') throw new CivApiError(403, 'Requête venant d’un autre site refusée.');
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new CivApiError(413, 'Contenu trop volumineux.');
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

async function backupFile(abs: string, reason: 'write' | 'delete', roots: DevRoots): Promise<string | null> {
  if (!fs.existsSync(abs)) return null;
  const rel = path.relative(roots.repo, abs);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(roots.backups, `${rel}.${stamp}.${reason}.bak`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(abs, dest);
  return path.relative(roots.repo, dest);
}

async function atomicWrite(abs: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, content, 'utf8');
  await fsp.rename(tmp, abs);
}

interface PackListing {
  id: string;
  files: string[];
}

async function listPackFiles(roots: DevRoots): Promise<PackListing[]> {
  const out: PackListing[] = [];
  const entries = await fsp.readdir(roots.civ, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PACK_ID_RE.test(entry.name)) continue;
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const child of await fsp.readdir(dir, { withFileTypes: true })) {
        if (child.name.startsWith('.') || child.name === 'node_modules') continue;
        const abs = path.join(dir, child.name);
        if (child.isDirectory()) await walk(abs);
        else if ((READABLE_EXTENSIONS as readonly string[]).includes(path.extname(child.name))) {
          files.push(path.relative(roots.repo, abs).split(path.sep).join('/'));
        }
      }
    };
    await walk(path.join(roots.civ, entry.name));
    files.sort();
    out.push({ id: entry.name, files });
  }
  return out;
}

/** Recently written paths, used to tag the HMR notification as coming from the Studio. */
const recentStudioWrites = new Map<string, number>();

export function civDevPlugin(opts: { root?: string } = {}): Plugin {
  const roots = rootsOf(opts.root ?? repoRoot);
  let typecheck: TypecheckService | null = null;

  const handle = async (req: IncomingMessage, res: ServerResponse, route: string, query: URLSearchParams) => {
    checkRequestOrigin(req.headers);
    const method = req.method ?? 'GET';

    if (route === 'packs' && method === 'GET') {
      send(res, 200, { packs: await listPackFiles(roots) });
      return;
    }

    if (route === 'file') {
      const rel = query.get('path') ?? '';
      if (method === 'GET') {
        const abs = resolvePackPath(rel, 'read', roots.repo);
        await assertRealPathInside(abs, roots.civ);
        if (!fs.existsSync(abs)) throw new CivApiError(404, `Fichier introuvable : ${rel}`);
        const stat = await fsp.stat(abs);
        const content = await fsp.readFile(abs, 'utf8');
        send(res, 200, { path: rel, content, mtimeMs: stat.mtimeMs });
        return;
      }
      if (method === 'PUT') {
        const abs = resolvePackPath(rel, 'write', roots.repo);
        await assertRealPathInside(abs, roots.civ);
        const raw = await readBody(req);
        let parsed: { content: string; expectedMtimeMs?: number | null };
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          throw new CivApiError(400, 'Corps JSON invalide.');
        }
        if (typeof parsed.content !== 'string') throw new CivApiError(400, 'Champ "content" manquant.');
        if (rel.endsWith('.json')) {
          try {
            JSON.parse(parsed.content);
          } catch (err) {
            throw new CivApiError(422, `JSON invalide, fichier non écrit : ${(err as Error).message}`);
          }
        }
        // Optimistic concurrency: refuse to overwrite a file changed on disk since it was loaded.
        if (typeof parsed.expectedMtimeMs === 'number' && fs.existsSync(abs)) {
          const current = (await fsp.stat(abs)).mtimeMs;
          if (Math.abs(current - parsed.expectedMtimeMs) > 1) {
            throw new CivApiError(409, 'Le fichier a été modifié sur le disque depuis son ouverture.');
          }
        }
        const backup = await backupFile(abs, 'write', roots);
        recentStudioWrites.set(abs, Date.now());
        await atomicWrite(abs, parsed.content);
        const stat = await fsp.stat(abs);
        typecheck?.invalidate(abs);
        send(res, 200, { path: rel, mtimeMs: stat.mtimeMs, backup });
        return;
      }
      if (method === 'DELETE') {
        const abs = resolvePackPath(rel, 'write', roots.repo);
        await assertRealPathInside(abs, roots.civ);
        if (!fs.existsSync(abs)) throw new CivApiError(404, `Fichier introuvable : ${rel}`);
        const backup = await backupFile(abs, 'delete', roots);
        await fsp.unlink(abs);
        typecheck?.invalidate(abs);
        send(res, 200, { path: rel, backup });
        return;
      }
    }

    if (route === 'typecheck' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { paths?: string[] };
      const files = (body.paths ?? []).map((p) => {
        const abs = resolvePackPath(p, 'read', roots.repo);
        return abs;
      });
      typecheck ??= createTypecheckService(roots.repo);
      const started = Date.now();
      const diagnostics = typecheck.check(files);
      send(res, 200, { diagnostics, ms: Date.now() - started });
      return;
    }

    if (route === 'scaffold' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as ScaffoldRequest;
      let result: Awaited<ReturnType<typeof scaffoldScript>>;
      try {
        result = await scaffoldScript(body, (rel) => resolvePackPath(rel, 'write', roots.repo));
      } catch (err) {
        if (err instanceof CivApiError) throw err;
        throw new CivApiError(400, (err as Error).message);
      }
      send(res, 200, result);
      return;
    }

    throw new CivApiError(404, `Route inconnue : ${method} ${route}`);
  };

  return {
    name: 'civ-dev-api',
    apply: 'serve',
    configureServer(s) {
      s.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(API_PREFIX)) {
          next();
          return;
        }
        const parsed = new URL(url, 'http://localhost');
        const route = parsed.pathname.slice(API_PREFIX.length);
        handle(req, res, route, parsed.searchParams).catch((err: unknown) => {
          const status = err instanceof CivApiError ? err.status : 500;
          const message = err instanceof Error ? err.message : String(err);
          if (status >= 500) s.config.logger.error(`[civ-dev-api] ${message}`);
          send(res, status, { error: message });
        });
      });
    },
    // `hotUpdate` (not the legacy `handleHotUpdate`, which Vite only calls for edits) so that
    // created and deleted files are covered too: a new script matches the `import.meta.glob` of its
    // pack, and Vite's default answer to that would be a full page reload. Ordered last, after
    // Vite's own glob plugin has added the modules whose globs match the file.
    hotUpdate: {
      order: 'post',
      handler(options) {
        const rel = path.relative(roots.repo, options.file).split(path.sep).join('/');
        // Content files (scenes, dialogues, quests, locales...) are loaded by the Studio through
        // this API and by the game through lazy imports. Pack scripts (mechanics, UI, views,
        // assets) are re-imported by the Studio. Neither may force-reload the Studio: Vite's
        // default propagation is replaced by a custom event that each page handles itself.
        // Content documents, French texts and the manifest (the game imports manifests eagerly:
        // without this, saving the manifest from the Studio would reload the whole page).
        const content = /^civilizations\/[^/]+\/((content|locales)\/.+|manifest)\.json$/.test(rel);
        const script = /^civilizations\/([^/]+)\/(?!seed\/|tests\/).+\.tsx?$/.exec(rel);
        if (!content && !(script && !rel.endsWith('.test.ts'))) return undefined;
        // The concerned modules are invalidated with an HMR timestamp so that the next import
        // (re-import of the pack, next load of a civilization) gets the new code or content.
        for (const mod of options.modules) this.environment.moduleGraph.invalidateModule(mod, new Set(), options.timestamp, true);
        if (this.environment.name === 'client') {
          const writtenAt = recentStudioWrites.get(options.file);
          const fromStudio = writtenAt !== undefined && Date.now() - writtenAt < 5000;
          const change = options.type === 'create' ? 'created' : options.type === 'delete' ? 'deleted' : 'changed';
          if (content) this.environment.hot.send({ type: 'custom', event: 'civ:content-changed', data: { path: rel, fromStudio, change } });
          else this.environment.hot.send({ type: 'custom', event: 'civ:code-changed', data: { path: rel, pack: script![1], fromStudio, change } });
        }
        return [];
      },
    },
  };
}
