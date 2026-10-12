/**
 * What Civilization Studio may write through the dev server's file API. Shared by the server
 * (tools/vite/civDevPlugin.ts, which enforces it) and the Studio (which shows the other files
 * read-only instead of failing on save).
 */

/** Folders of a pack the Studio may write: content, texts, and the code modules pack.ts loads. */
export const WRITABLE_PACK_DIRS = ['content', 'locales', 'mechanics', 'ui', 'view', 'assets', 'models'] as const;
export const WRITABLE_EXTENSIONS = ['.json', '.ts', '.tsx'] as const;
export const READABLE_EXTENSIONS = ['.json', '.ts', '.tsx', '.md', '.css'] as const;

/** Pack-relative path ("mechanics/locks.ts", "manifest.json") that the Studio may save. */
export function isWritablePackFile(rel: string): boolean {
  if (rel === 'manifest.json') return true;
  const parts = rel.split('/');
  if (parts.length < 2 || parts.some((p) => p === '' || p.startsWith('.') || p === '..')) return false;
  if (!(WRITABLE_PACK_DIRS as readonly string[]).includes(parts[0]!)) return false;
  const dot = rel.lastIndexOf('.');
  return dot > 0 && (WRITABLE_EXTENSIONS as readonly string[]).includes(rel.slice(dot));
}
