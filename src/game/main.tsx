import { createRoot } from 'react-dom/client';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/game.css';
import { GameController } from './controller';
import { GameApp } from './GameApp';

async function boot() {
  const el = document.getElementById('app');
  if (!el) throw new Error('#app introuvable');
  const root = createRoot(el);
  try {
    const controller = await GameController.create();
    root.render(<GameApp controller={controller} />);
    if (import.meta.hot) {
      // Content edited in Civilization Studio: reload the game to pick it up.
      import.meta.hot.on('civ:content-changed', () => {
        if (!controller.session.civ) location.reload();
      });
      // A pack script changed: outside of a game, reload to run the new code.
      import.meta.hot.on('civ:code-changed', () => {
        if (!controller.session.civ) location.reload();
        else controller.session.notify(controller.session.t('ui.dev.codeChanged'), 'info', 6);
      });
    }
  } catch (err) {
    console.error(err);
    el.innerHTML = '';
    const msg = document.createElement('pre');
    msg.className = 'cv-fatal';
    msg.textContent = `CIVILIZATIONVERSE n’a pas pu démarrer.\n\n${(err as Error).message}`;
    el.appendChild(msg);
  }
}

void boot();
