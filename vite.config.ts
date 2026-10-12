import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { civAliases, repoRoot } from './tools/vite/aliases.ts';
import { civDevPlugin } from './tools/vite/civDevPlugin.ts';

/**
 * Vite configuration.
 *
 * - `index.html`  → the game (always built).
 * - `studio.html` → Civilization Studio. Served in dev; excluded from production builds unless
 *   CIV_BUILD_STUDIO=1 (even then the file-writing API does not exist outside the dev server).
 * - CIV_BUILD_ARTIFACT=1 (`npm run build:artifact`): the game alone, for a claude.ai Artifact —
 *   relative paths, one script instead of hundreds of chunks (an Artifact holds at most 511
 *   files), no source maps, into `dist-artifact/`.
 */
export default defineConfig(({ command }) => {
  const artifact = process.env.CIV_BUILD_ARTIFACT === '1';
  const buildStudio = process.env.CIV_BUILD_STUDIO === '1' && !artifact;
  const input: Record<string, string> = { main: path.resolve(repoRoot, 'index.html') };
  if (command === 'serve' || buildStudio) input.studio = path.resolve(repoRoot, 'studio.html');

  return {
    root: repoRoot,
    base: artifact ? './' : '/',
    resolve: { alias: civAliases },
    plugins: [react(), civDevPlugin()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: false,
    },
    preview: { host: '127.0.0.1', port: 4173 },
    worker: { format: 'es' },
    // Pre-bundled at startup: otherwise opening the first script in the Studio would make Vite
    // discover the dependency, re-optimize and reload the page (losing unsaved edits).
    optimizeDeps: { include: ['monaco-editor'] },
    build: {
      target: 'es2022',
      sourcemap: !artifact,
      chunkSizeWarningLimit: artifact ? 12000 : 4000,
      ...(artifact ? { outDir: 'dist-artifact' } : {}),
      rolldownOptions: { input, ...(artifact ? { output: { codeSplitting: false } } : {}) },
    },
    define: {
      __CIV_STUDIO_AVAILABLE__: JSON.stringify(command === 'serve'),
    },
  };
});
