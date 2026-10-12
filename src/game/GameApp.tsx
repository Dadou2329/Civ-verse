import { useEffect, useRef, type CSSProperties } from 'react';
import { ControllerContext, useSessionTick } from './hooks';
import type { GameController } from './controller';
import { useUi } from './state/uiStore';
import { CivSelect, Credits, ErrorScreen, Loading, MainMenu, Registry } from './screens/Menus';
import { SettingsPanel } from './screens/Settings';
import { Hud } from './hud/Hud';
import { ConfirmDialog } from './hud/Modals';

function ThemedRoot({ controller, children }: { controller: GameController; children: React.ReactNode }) {
  useSessionTick();
  const theme = controller.session.civ?.manifest.theme;
  const style = {
    '--civ-accent': theme?.accent ?? '#e8c27a',
    '--civ-accent-soft': theme?.accentSoft ?? '#7fb7d9',
    '--civ-panel': theme?.panel ?? 'rgba(14, 16, 22, 0.86)',
    '--civ-panel-border': theme?.panelBorder ?? 'rgba(232, 194, 122, 0.35)',
    '--civ-text': theme?.text ?? '#efe9dc',
    '--civ-text-dim': theme?.textDim ?? '#a8a296',
    '--civ-font': theme?.font ?? '"Alegreya Sans", system-ui, sans-serif',
    '--civ-title-font': theme?.titleFont ?? '"Cinzel", Georgia, serif',
  } as CSSProperties;
  return (
    <div className="cv-root" style={style} data-civ={controller.session.civ?.id ?? 'none'}>
      {children}
    </div>
  );
}

export function GameApp({ controller }: { controller: GameController }) {
  const screen = useUi((s) => s.screen);
  const settingsReturn = useUi((s) => s.settingsReturn);
  const set = useUi((s) => s.set);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      controller.attachCanvas(canvasRef.current);
      set({ screen: 'menu' });
    } catch (err) {
      set({ screen: 'error', error: (err as Error).message });
    }
  }, [controller, set]);

  return (
    <ControllerContext.Provider value={controller}>
      <ThemedRoot controller={controller}>
        <canvas ref={canvasRef} className={`cv-canvas ${screen === 'playing' ? 'is-visible' : ''}`} data-testid="game-canvas" tabIndex={-1} />
        {screen !== 'playing' && <div className="cv-backdrop" aria-hidden="true" />}
        {screen === 'menu' && <MainMenu />}
        {screen === 'civs' && <CivSelect />}
        {screen === 'registry' && <Registry />}
        {screen === 'credits' && <Credits />}
        {screen === 'settings' && (
          <div className="cv-screen-panel">
            <SettingsPanel onClose={() => set({ screen: settingsReturn })} />
          </div>
        )}
        {screen === 'loading' && <Loading />}
        {screen === 'error' && <ErrorScreen />}
        {screen === 'playing' && <Hud />}
        {screen !== 'playing' && <ConfirmDialog />}
      </ThemedRoot>
    </ControllerContext.Provider>
  );
}
