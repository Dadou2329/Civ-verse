/**
 * Security tests of Civilization Studio's development file API (tools/vite/civDevPlugin.ts).
 *
 * The middleware is exercised with real files in a temporary directory laid out like the
 * repository (never the repository itself): path validation, request origin checks, symlink
 * escapes, atomic writes with backups, optimistic concurrency, deletes kept as backups — and
 * the guarantee that production builds contain neither the API nor the Studio.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { UserConfig, ConfigEnv } from 'vite';
import { CivApiError, checkRequestOrigin, civDevPlugin, resolvePackPath } from './civDevPlugin.ts';
import viteConfig from '../../vite.config.ts';

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
interface Reply {
  status: number;
  json: Record<string, unknown> | null;
}

const LOCAL: IncomingHttpHeaders = { host: '127.0.0.1:5199', 'x-civ-studio': '1' };

function statusOf(fn: () => unknown): number | 'ok' {
  try {
    fn();
    return 'ok';
  } catch (err) {
    if (err instanceof CivApiError) return err.status;
    throw err;
  }
}

function mountApi(root: string): Middleware {
  const plugin = civDevPlugin({ root });
  let mw: Middleware | null = null;
  const fakeServer = { middlewares: { use: (fn: Middleware) => (mw = fn) }, config: { logger: { error: () => undefined } } };
  (plugin.configureServer as (s: unknown) => void)(fakeServer);
  if (!mw) throw new Error('middleware non installé');
  return mw;
}

function call(mw: Middleware, method: string, url: string, opts: { headers?: IncomingHttpHeaders; body?: unknown } = {}): Promise<Reply> {
  const chunks = opts.body === undefined ? [] : [Buffer.from(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))];
  const req = {
    method,
    url,
    headers: { ...LOCAL, ...opts.headers },
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  } as unknown as IncomingMessage;
  return new Promise((resolve) => {
    const res = {
      statusCode: 0,
      setHeader() {},
      end(payload: string) {
        resolve({ status: this.statusCode, json: JSON.parse(payload) as Record<string, unknown> });
      },
    };
    mw(req, res as unknown as ServerResponse, () => resolve({ status: -1, json: null }));
  });
}

const fileUrl = (rel: string) => `/__civ/api/file?path=${encodeURIComponent(rel)}`;

describe('resolvePackPath', () => {
  it('accepts content, scripts and the manifest of a pack', () => {
    expect(statusOf(() => resolvePackPath('civilizations/door/content/dialogues/noe.dialogue.json', 'write'))).toBe('ok');
    expect(statusOf(() => resolvePackPath('civilizations/door/mechanics/locks.ts', 'write'))).toBe('ok');
    expect(statusOf(() => resolvePackPath('civilizations/door/ui/RankPlaque.tsx', 'write'))).toBe('ok');
    expect(statusOf(() => resolvePackPath('civilizations/door/locales/fr-FR.json', 'write'))).toBe('ok');
    expect(statusOf(() => resolvePackPath('civilizations/door/manifest.json', 'write'))).toBe('ok');
    expect(statusOf(() => resolvePackPath('civilizations/door/seed/verrou.ts', 'read'))).toBe('ok');
  });

  it('rejects traversal, absolute, malformed and hidden paths', () => {
    for (const p of [
      '../package.json',
      'civilizations/../package.json',
      'civilizations/door/../../package.json',
      'civilizations/door/content/../../../etc/passwd',
      'civilizations/door/./content/a.json',
      '/etc/passwd',
      'civilizations\\door\\content\\a.json',
      'civilizations/door/content/a\0.json',
      '',
      `civilizations/door/content/${'a'.repeat(600)}.json`,
      'civilizations/door/content/.secret.json',
      'civilizations/Door/content/a.json',
    ]) {
      expect(statusOf(() => resolvePackPath(p, 'read')), p).toBe(400);
    }
  });

  it('keeps the rest of the repository out of reach', () => {
    for (const p of ['src/engine/core/sim/session.ts', 'package.json', 'node_modules/vite/package.json', 'tools/vite/civDevPlugin.ts', 'civilizations']) {
      expect(statusOf(() => resolvePackPath(p, 'read')), p).toBe(403);
    }
  });

  it('only writes JSON/TypeScript into the editable folders of a pack', () => {
    for (const p of [
      'civilizations/door/pack.ts',
      'civilizations/door/seed/verrou.ts',
      'civilizations/door/tests/door.playthrough.test.ts',
      'civilizations/door/assets/blocks.ts',
      'civilizations/door/content/script.js',
      'civilizations/door/content/page.html',
      'civilizations/door/content',
    ]) {
      expect(statusOf(() => resolvePackPath(p, 'write')), p).toBe(403);
    }
    expect(statusOf(() => resolvePackPath('civilizations/door/content/image.png', 'read'))).toBe(403);
  });
});

describe('checkRequestOrigin', () => {
  it('accepts the Studio page of this server', () => {
    expect(statusOf(() => checkRequestOrigin(LOCAL))).toBe('ok');
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, origin: 'http://127.0.0.1:5199', 'sec-fetch-site': 'same-origin' }))).toBe('ok');
    expect(statusOf(() => checkRequestOrigin({ host: 'localhost:5173', 'x-civ-studio': '1', origin: 'http://localhost:5173' }))).toBe('ok');
  });

  it('rejects requests without the header, from another host, origin or site', () => {
    expect(statusOf(() => checkRequestOrigin({ host: '127.0.0.1:5199' }))).toBe(403);
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, host: 'evil.example:5199' }))).toBe(403);
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, host: undefined }))).toBe(403);
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, origin: 'https://evil.example' }))).toBe(403);
    // Another local web application (other port) cannot drive the API either.
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, origin: 'http://127.0.0.1:3000' }))).toBe(403);
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, origin: 'null' }))).toBe(403);
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, 'sec-fetch-site': 'cross-site' }))).toBe(403);
    expect(statusOf(() => checkRequestOrigin({ ...LOCAL, 'sec-fetch-site': 'same-site' }))).toBe(403);
  });
});

describe('file API middleware (temporary repository)', () => {
  let root = '';
  let mw: Middleware;
  const pack = (rel: string) => path.join(root, 'civilizations', 'demo', rel);

  beforeAll(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'civ-api-'));
    for (const [rel, content] of Object.entries({
      'manifest.json': '{ "id": "demo" }\n',
      'content/dialogues/a.dialogue.json': '{ "id": "a" }\n',
      'mechanics/x.ts': 'export const x = 1;\n',
      'seed/s.ts': 'export const s = 1;\n',
      'content/.cache.json': '{}\n',
      'pack.ts': 'export default {};\n',
    })) {
      await fsp.mkdir(path.dirname(pack(rel)), { recursive: true });
      await fsp.writeFile(pack(rel), content);
    }
    await fsp.writeFile(path.join(root, 'secret.json'), '{ "secret": true }\n');
    // Symlinks leading out of civilizations/: a file and a directory.
    await fsp.symlink(path.join(root, 'secret.json'), pack('content/lien.json'));
    await fsp.symlink(root, pack('content/dehors'));
    mw = mountApi(root);
  });

  afterAll(async () => {
    if (root.startsWith(os.tmpdir())) await fsp.rm(root, { recursive: true, force: true });
  });

  it('refuses requests that are not from the Studio page', async () => {
    expect((await call(mw, 'GET', '/__civ/api/packs', { headers: { 'x-civ-studio': undefined } })).status).toBe(403);
    expect((await call(mw, 'GET', '/__civ/api/packs', { headers: { host: 'attacker.example' } })).status).toBe(403);
    expect((await call(mw, 'PUT', fileUrl('civilizations/demo/content/dialogues/a.dialogue.json'), { headers: { origin: 'https://attacker.example' }, body: { content: '{}' } })).status).toBe(403);
    expect(fs.readFileSync(pack('content/dialogues/a.dialogue.json'), 'utf8')).toBe('{ "id": "a" }\n');
  });

  it('lists pack files, without hidden files', async () => {
    const r = await call(mw, 'GET', '/__civ/api/packs');
    expect(r.status).toBe(200);
    const files = (r.json!.packs as { id: string; files: string[] }[]).find((p) => p.id === 'demo')!.files;
    expect(files).toEqual(expect.arrayContaining(['civilizations/demo/manifest.json', 'civilizations/demo/content/dialogues/a.dialogue.json', 'civilizations/demo/mechanics/x.ts']));
    expect(files.some((f) => f.includes('.cache'))).toBe(false);
  });

  it('reads a pack file, and nothing outside', async () => {
    const r = await call(mw, 'GET', fileUrl('civilizations/demo/content/dialogues/a.dialogue.json'));
    expect(r.status).toBe(200);
    expect(r.json!.content).toBe('{ "id": "a" }\n');
    expect(typeof r.json!.mtimeMs).toBe('number');
    expect((await call(mw, 'GET', fileUrl('civilizations/demo/../../secret.json'))).status).toBe(400);
    expect((await call(mw, 'GET', fileUrl('secret.json'))).status).toBe(403);
    // A symlink inside the pack that points outside civilizations/ is refused.
    expect((await call(mw, 'GET', fileUrl('civilizations/demo/content/lien.json'))).status).toBe(403);
    expect((await call(mw, 'GET', fileUrl('civilizations/demo/content/dehors/secret.json'))).status).toBe(403);
  });

  it('writes atomically and keeps the previous version as a backup', async () => {
    const rel = 'civilizations/demo/content/dialogues/a.dialogue.json';
    const r = await call(mw, 'PUT', fileUrl(rel), { headers: { origin: 'http://127.0.0.1:5199' }, body: { content: '{ "id": "a", "v": 2 }\n' } });
    expect(r.status).toBe(200);
    expect(fs.readFileSync(pack('content/dialogues/a.dialogue.json'), 'utf8')).toBe('{ "id": "a", "v": 2 }\n');
    const backup = path.join(root, String(r.json!.backup));
    expect(backup.startsWith(path.join(root, '.civ-backups') + path.sep)).toBe(true);
    expect(fs.readFileSync(backup, 'utf8')).toBe('{ "id": "a" }\n');
    // No temporary file is left next to the written file.
    expect(fs.readdirSync(pack('content/dialogues')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('never writes invalid JSON, a file changed on disk, or outside the editable folders', async () => {
    const rel = 'civilizations/demo/content/dialogues/a.dialogue.json';
    const before = fs.readFileSync(pack('content/dialogues/a.dialogue.json'), 'utf8');
    expect((await call(mw, 'PUT', fileUrl(rel), { body: { content: '{ "id": ' } })).status).toBe(422);
    expect((await call(mw, 'PUT', fileUrl(rel), { body: 'pas du json' })).status).toBe(400);
    const stale = (await call(mw, 'GET', fileUrl(rel))).json!.mtimeMs as number;
    expect((await call(mw, 'PUT', fileUrl(rel), { body: { content: '{}', expectedMtimeMs: stale - 5000 } })).status).toBe(409);
    expect(fs.readFileSync(pack('content/dialogues/a.dialogue.json'), 'utf8')).toBe(before);
    expect((await call(mw, 'PUT', fileUrl('civilizations/demo/seed/s.ts'), { body: { content: 'export {};' } })).status).toBe(403);
    expect((await call(mw, 'PUT', fileUrl('civilizations/demo/pack.ts'), { body: { content: 'export {};' } })).status).toBe(403);
    // Writing through a symlinked directory that leads outside is refused, nothing is created.
    expect((await call(mw, 'PUT', fileUrl('civilizations/demo/content/dehors/pwned.json'), { body: { content: '{}' } })).status).toBe(403);
    expect(fs.existsSync(path.join(root, 'pwned.json'))).toBe(false);
  });

  it('deletes by moving the file to the backups', async () => {
    const r = await call(mw, 'DELETE', fileUrl('civilizations/demo/mechanics/x.ts'));
    expect(r.status).toBe(200);
    expect(fs.existsSync(pack('mechanics/x.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(root, String(r.json!.backup)), 'utf8')).toBe('export const x = 1;\n');
    expect((await call(mw, 'DELETE', fileUrl('civilizations/demo/mechanics/x.ts'))).status).toBe(404);
  });

  it('scaffolds a script into mechanics/ from a template, never over an existing file', async () => {
    const r = await call(mw, 'POST', '/__civ/api/scaffold', { body: { pack: 'demo', kind: 'behavior', name: 'Porte à résonance' } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ path: 'civilizations/demo/mechanics/porteAResonance.ts', id: 'demo.porteAResonance' });
    const code = fs.readFileSync(pack('mechanics/porteAResonance.ts'), 'utf8');
    expect(code).toContain("id: 'demo.porteAResonance'");
    expect(code).toContain("from '@sdk'");
    expect((await call(mw, 'POST', '/__civ/api/scaffold', { body: { pack: 'demo', kind: 'behavior', name: 'Porte à résonance' } })).status).toBe(400);
    expect((await call(mw, 'POST', '/__civ/api/scaffold', { body: { pack: '../x', kind: 'behavior', name: 'a' } })).status).toBe(400);
    expect((await call(mw, 'POST', '/__civ/api/scaffold', { body: { pack: 'demo', kind: 'exec', name: 'a' } })).status).toBe(400);
  });

  it('answers unknown routes with 404 and leaves other URLs to Vite', async () => {
    expect((await call(mw, 'POST', '/__civ/api/exec', { body: {} })).status).toBe(404);
    expect((await call(mw, 'GET', '/src/main.tsx')).status).toBe(-1);
  });
});

describe('production builds', () => {
  const config = (command: ConfigEnv['command']) =>
    (viteConfig as unknown as (env: ConfigEnv) => UserConfig)({ command, mode: command === 'build' ? 'production' : 'development', isSsrBuild: false, isPreview: false });

  it('contain neither the file API nor Civilization Studio (unless explicitly requested)', () => {
    const prev = process.env.CIV_BUILD_STUDIO;
    delete process.env.CIV_BUILD_STUDIO;
    try {
      const build = config('build');
      const input = (build.build?.rolldownOptions?.input ?? {}) as Record<string, string>;
      expect(Object.keys(input)).toEqual(['main']);
      expect(build.define?.__CIV_STUDIO_AVAILABLE__).toBe('false');
      const api = (build.plugins ?? []).flat().find((p) => p && typeof p === 'object' && 'name' in p && p.name === 'civ-dev-api') as { apply?: string } | undefined;
      expect(api?.apply).toBe('serve');
      const dev = config('serve');
      expect(Object.keys((dev.build?.rolldownOptions?.input ?? {}) as Record<string, string>)).toEqual(['main', 'studio']);
      expect(dev.define?.__CIV_STUDIO_AVAILABLE__).toBe('true');
    } finally {
      if (prev !== undefined) process.env.CIV_BUILD_STUDIO = prev;
    }
  });
});
