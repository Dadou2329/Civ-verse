/**
 * Client of the dev-only file API (tools/vite/civDevPlugin.ts). Only usable under `npm run dev`.
 */
export interface DevFile {
  path: string;
  content: string;
  mtimeMs: number;
}

export interface DevDiagnostic {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  category: 'error' | 'warning' | 'suggestion' | 'message';
  code: number;
}

export class DevApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`/__civ/api/${route}`, {
    method,
    headers: { 'x-civ-studio': '1', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DevApiError(res.status, `Réponse invalide du serveur de développement (${res.status}).`);
  }
  if (!res.ok) throw new DevApiError(res.status, (data as { error?: string }).error ?? `Erreur ${res.status}`);
  return data as T;
}

export const devApi = {
  available(): boolean {
    return __CIV_STUDIO_AVAILABLE__;
  },
  listPacks: () => call<{ packs: { id: string; files: string[] }[] }>('GET', 'packs'),
  readFile: (path: string) => call<DevFile>('GET', `file?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string, expectedMtimeMs?: number | null) =>
    call<{ path: string; mtimeMs: number; backup: string | null }>('PUT', `file?path=${encodeURIComponent(path)}`, { content, expectedMtimeMs }),
  deleteFile: (path: string) => call<{ path: string; backup: string | null }>('DELETE', `file?path=${encodeURIComponent(path)}`),
  typecheck: (paths: string[]) => call<{ diagnostics: DevDiagnostic[]; ms: number }>('POST', 'typecheck', { paths }),
  scaffold: (pack: string, kind: 'behavior' | 'action' | 'condition' | 'mechanic', name: string) =>
    call<{ path: string; id: string; exportName: string }>('POST', 'scaffold', { pack, kind, name }),
};
