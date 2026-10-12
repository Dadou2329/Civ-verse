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
 */
export default defineConfig(({ command }) => {
  const buildStudio = process.env.CIV_BUILD_STUDIO === '1';
  const input: Record<string, string> = { main: path.resolve(repoRoot, 'index.html') };
  if (command === 'serve' || buildStudio) input.studio = path.resolve(repoRoot, 'studio.html');

  return {
    root: repoRoot,
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
      sourcemap: true,
      chunkSizeWarningLimit: 4000,
      rolldownOptions: { input },
    },
    define: {
      __CIV_STUDIO_AVAILABLE__: JSON.stringify(command === 'serve'),
    },
  };
});
