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
 * - paths are repository-relative, must live under `civilizations/<pack>/<allowed dir>/` (or be
 *   the pack's manifest.json), must
 *   use an allowed extension, and must resolve (after symlinks) inside the repository;
 * - writes are atomic (temp file + rename) and the previous version is copied to `.civ-backups/`;
 * - deletes move the file to `.civ-backups/` instead of destroying it.
 */
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from './aliases.ts';
import { createTypecheckService, type TypecheckService } from './typecheckService.ts';
import { scaffoldScript, type ScaffoldRequest } from './scaffold.ts';

const API_PREFIX = '/__civ/api/';
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const CIV_ROOT = path.join(repoRoot, 'civilizations');
const BACKUP_ROOT = path.join(repoRoot, '.civ-backups');

/** Directories inside a pack that the Studio may write to. */
const WRITABLE_PACK_DIRS = ['content', 'mechanics', 'ui', 'locales', 'scripts'] as const;
const WRITABLE_EXTENSIONS = ['.json', '.ts', '.tsx'] as const;
const READABLE_EXTENSIONS = ['.json', '.ts', '.tsx', '.md', '.css'] as const;
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
export function resolvePackPath(relPath: string, mode: 'read' | 'write'): string {
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
  const abs = path.resolve(repoRoot, normalized);
  if (!abs.startsWith(CIV_ROOT + path.sep)) throw new CivApiError(403, 'Chemin hors de civilizations/.');
  return abs;
}

/** Ensures that the real (symlink-resolved) location of `abs` stays inside civilizations/. */
async function assertRealPathInside(abs: string): Promise<void> {
  let probe = abs;
  // Walk up to the first existing ancestor and resolve it.
  for (;;) {
    try {
      const real = await fsp.realpath(probe);
      const realRoot = await fsp.realpath(CIV_ROOT);
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

async function backupFile(abs: string, reason: 'write' | 'delete'): Promise<string | null> {
  if (!fs.existsSync(abs)) return null;
  const rel = path.relative(repoRoot, abs);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_ROOT, `${rel}.${stamp}.${reason}.bak`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(abs, dest);
  return path.relative(repoRoot, dest);
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

async function listPackFiles(): Promise<PackListing[]> {
  const out: PackListing[] = [];
  const entries = await fsp.readdir(CIV_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !PACK_ID_RE.test(entry.name)) continue;
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const child of await fsp.readdir(dir, { withFileTypes: true })) {
        if (child.name.startsWith('.') || child.name === 'node_modules') continue;
        const abs = path.join(dir, child.name);
        if (child.isDirectory()) await walk(abs);
        else if ((READABLE_EXTENSIONS as readonly string[]).includes(path.extname(child.name))) {
          files.push(path.relative(repoRoot, abs).split(path.sep).join('/'));
        }
      }
    };
    await walk(path.join(CIV_ROOT, entry.name));
    files.sort();
    out.push({ id: entry.name, files });
  }
  return out;
}

/** Recently written paths, used to tag the HMR notification as coming from the Studio. */
const recentStudioWrites = new Map<string, number>();

export function civDevPlugin(): Plugin {
  let server: ViteDevServer | null = null;
  let typecheck: TypecheckService | null = null;

  const handle = async (req: IncomingMessage, res: ServerResponse, route: string, query: URLSearchParams) => {
    if (req.headers['x-civ-studio'] !== '1') throw new CivApiError(403, 'En-tête x-civ-studio requis.');
    if (!isLoopbackHost(req.headers.host)) throw new CivApiError(403, 'Hôte non local refusé.');
    const method = req.method ?? 'GET';

    if (route === 'packs' && method === 'GET') {
      send(res, 200, { packs: await listPackFiles() });
      return;
    }

    if (route === 'file') {
      const rel = query.get('path') ?? '';
      if (method === 'GET') {
        const abs = resolvePackPath(rel, 'read');
        await assertRealPathInside(abs);
        if (!fs.existsSync(abs)) throw new CivApiError(404, `Fichier introuvable : ${rel}`);
        const stat = await fsp.stat(abs);
        const content = await fsp.readFile(abs, 'utf8');
        send(res, 200, { path: rel, content, mtimeMs: stat.mtimeMs });
        return;
      }
      if (method === 'PUT') {
        const abs = resolvePackPath(rel, 'write');
        await assertRealPathInside(abs);
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
        const backup = await backupFile(abs, 'write');
        recentStudioWrites.set(abs, Date.now());
        await atomicWrite(abs, parsed.content);
        const stat = await fsp.stat(abs);
        typecheck?.invalidate(abs);
        send(res, 200, { path: rel, mtimeMs: stat.mtimeMs, backup });
        return;
      }
      if (method === 'DELETE') {
        const abs = resolvePackPath(rel, 'write');
        await assertRealPathInside(abs);
        if (!fs.existsSync(abs)) throw new CivApiError(404, `Fichier introuvable : ${rel}`);
        const backup = await backupFile(abs, 'delete');
        await fsp.unlink(abs);
        typecheck?.invalidate(abs);
        send(res, 200, { path: rel, backup });
        return;
      }
    }

    if (route === 'typecheck' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { paths?: string[] };
      const files = (body.paths ?? []).map((p) => {
        const abs = resolvePackPath(p, 'read');
        return abs;
      });
      typecheck ??= createTypecheckService(repoRoot);
      const started = Date.now();
      const diagnostics = typecheck.check(files);
      send(res, 200, { diagnostics, ms: Date.now() - started });
      return;
    }

    if (route === 'scaffold' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as ScaffoldRequest;
      const result = await scaffoldScript(body, (rel) => resolvePackPath(rel, 'write'));
      send(res, 200, result);
      return;
    }

    throw new CivApiError(404, `Route inconnue : ${method} ${route}`);
  };

  return {
    name: 'civ-dev-api',
    apply: 'serve',
    configureServer(s) {
      server = s;
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
    handleHotUpdate(ctx) {
      // Content files (scenes, dialogues, quests, locales...) are loaded by the Studio through this
      // API and by the game through lazy imports. A change must never force-reload the Studio, so we
      // replace Vite's default propagation by a custom event that each app handles itself.
      const rel = path.relative(repoRoot, ctx.file).split(path.sep).join('/');
      if (/^civilizations\/[^/]+\/(content|locales)\//.test(rel) && rel.endsWith('.json')) {
        const writtenAt = recentStudioWrites.get(ctx.file);
        const fromStudio = writtenAt !== undefined && Date.now() - writtenAt < 5000;
        server?.ws.send({ type: 'custom', event: 'civ:content-changed', data: { path: rel, fromStudio } });
        return [];
      }
      return undefined;
    },
  };
}
