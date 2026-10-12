import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Repository root (two levels up from tools/vite). */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const r = (p: string) => path.resolve(repoRoot, p);

/**
 * Module aliases shared by Vite, Vitest and tsx. Keep in sync with `paths` in tsconfig.json.
 * Regex finds are used so that `@sdk` and `@sdk/x` resolve independently.
 */
export const civAliases = [
  { find: /^@sdk$/, replacement: r('src/sdk/index.ts') },
  { find: /^@sdk\/(.*)$/, replacement: r('src/sdk/$1') },
  { find: /^@engine\/(.*)$/, replacement: r('src/engine/$1') },
  { find: /^@studio\/(.*)$/, replacement: r('src/studio/$1') },
  { find: /^@game\/(.*)$/, replacement: r('src/game/$1') },
  { find: /^@civs\/(.*)$/, replacement: r('civilizations/$1') },
];
