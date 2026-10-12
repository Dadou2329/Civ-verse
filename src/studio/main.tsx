import { createRoot } from 'react-dom/client';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/studio.css';
import { devApi } from '@engine/platform/devApi';
import { GlobContentProvider } from '@engine/platform/globContent';
import { Studio } from './core/studio';
import { DevContentProvider, bumpPackCode, bundledProjectIO, devProjectIO } from './core/devContent';
import { StudioApp } from './StudioApp';
import { viewportRef } from './hooks';

/**
 * Civilization Studio entry point (studio.html).
 *
 * Under `npm run dev` the Studio reads and writes the repository through the dev server's scoped
 * file API. In a build made with CIV_BUILD_STUDIO=1 that API does not exist: the Studio opens
 * read-only (no saving, no script editor).
 */
async function boot() {
  const el = document.getElementById('studio');
  if (!el) throw new Error('#studio introuvable');
  const root = createRoot(el);
  try {
    const dev = devApi.available();
    const provider = dev ? new DevContentProvider() : new GlobContentProvider();
    const studio = await Studio.create({ provider, io: dev ? devProjectIO : bundledProjectIO() });
    root.render(<StudioApp studio={studio} />);
    // Development hooks for the browser tests (tests/e2e): the Studio and its 3D viewport.
    if (import.meta.env.DEV) Object.assign(window, { __studio: studio, __studioViewport: viewportRef });
    const initial = new URLSearchParams(location.search).get('pack') ?? studio.packList().find((p) => p !== 'core') ?? null;
    if (initial) await studio.openPack(initial);
    if (import.meta.hot && provider instanceof DevContentProvider) {
      import.meta.hot.on('civ:code-changed', (data: { pack: string; path: string; change: 'created' | 'changed' | 'deleted' }) => {
        bumpPackCode(data.pack);
        provider.invalidate();
        studio.print('info', `${data.change === 'created' ? 'Script ajouté' : data.change === 'deleted' ? 'Script supprimé' : 'Script modifié'} : ${data.path}`);
        if (data.change !== 'changed') void studio.project.refreshListing().then(() => studio.changed());
        void studio.reloadPackCode(data.pack);
      });
      import.meta.hot.on('civ:content-changed', (data: { path: string; fromStudio: boolean; change: 'created' | 'changed' | 'deleted' }) => {
        provider.invalidate();
        if (data.change !== 'changed' && !data.fromStudio) void studio.project.refreshListing().then(() => studio.changed());
        if (data.change === 'changed' && !data.fromStudio) {
          void studio.project.reloadIfClean(data.path).then((reloaded) => {
            if (reloaded) {
              studio.print('info', `Rechargé depuis le disque : ${data.path}`, data.path);
              void studio.reloadOpenScene(data.path);
            }
            else if (studio.project.doc(data.path)?.loaded) studio.print('warning', `Modifié sur le disque pendant que vous l’éditiez : ${data.path}`, data.path);
          });
        }
      });
    }
  } catch (err) {
    console.error(err);
    el.innerHTML = '';
    const msg = document.createElement('pre');
    msg.style.cssText = 'padding:2rem;color:#e8705f;white-space:pre-wrap;font-family:monospace';
    msg.textContent = `Civilization Studio n’a pas pu démarrer.\n\n${(err as Error).message}`;
    el.appendChild(msg);
  }
}

void boot();
