/**
 * PLAY / STOP. The playtest runs the real game — the same GameController, GameView (renderer,
 * camera, audio, input) and HUD as index.html — on the Studio's working copies, so unsaved
 * changes are tested as they are. Saves go to memory only: the player's saves are never touched.
 */
import { useEffect, useRef, useState } from 'react';
import { GameController } from '@game/controller';
import { ControllerContext } from '@game/hooks';
import { ThemedRoot } from '@game/GameApp';
import { Hud } from '@game/hud/Hud';
import { ErrorScreen, Loading } from '@game/screens/Menus';
import { useUi } from '@game/state/uiStore';
import '@game/styles/game.css';
import { MemorySaveStorage } from '@engine/core/save/storage';
import { OverlayContentProvider } from '@engine/platform/overlayContent';
import type { Studio } from '../core/studio';

export interface PlaytestRequest {
  /** « Jouer ici »: the open scene, from the editor camera, without the opening events. */
  here: boolean;
  scene?: string;
  position?: { x: number; y: number; z: number };
  yaw?: number;
  pitch?: number;
}

export function Playtest({ studio, request, onStop }: { studio: Studio; request: PlaytestRequest; onStop: () => void }) {
  const [controller, setController] = useState<GameController | null>(null);
  const [run, setRun] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screen = useUi((s) => s.screen);

  useEffect(() => {
    document.documentElement.classList.add('st-playing');
    return () => document.documentElement.classList.remove('st-playing');
  }, []);

  // F8 stops the test even while the game holds the mouse (pointer lock).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F8') return;
      e.preventDefault();
      e.stopPropagation();
      if (document.pointerLockElement) document.exitPointerLock();
      onStop();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onStop]);

  useEffect(() => {
    let disposed = false;
    let c: GameController | null = null;
    const pack = studio.packId!;
    const deps = studio.session.manifests.get(pack)?.dependencies ?? [];
    const provider = new OverlayContentProvider(studio.provider, studio.project.overlay([pack, ...deps]));
    void (async () => {
      try {
        c = await GameController.create({ provider, mode: 'playtest', storage: new MemorySaveStorage() });
        if (disposed) {
          c.dispose();
          return;
        }
        setController(c);
      } catch (err) {
        studio.print('error', `Impossible de lancer le test : ${(err as Error).message}`);
        onStop();
      }
    })();
    return () => {
      disposed = true;
      c?.dispose();
      useUi.setState({ screen: 'boot', overlay: null, endScreen: null, document: null, panels: [], confirm: null, error: null });
    };
  }, [studio, run, onStop]);

  useEffect(() => {
    if (!controller || !canvasRef.current) return;
    controller.attachCanvas(canvasRef.current);
    const pack = studio.packId!;
    const opts = request.here
      ? { scene: request.scene, place: request.position ? { position: request.position, yaw: request.yaw, pitch: request.pitch } : undefined, quietStart: true }
      : {};
    studio.print('info', request.here ? `Test de « ${request.scene} » depuis la caméra de l’éditeur.` : `Test de « ${pack} » depuis le début.`);
    void controller.startPlaytest(pack, opts);
  }, [controller, studio, request]);

  // Leaving the game (pause menu « Quitter », end of the story) returns to the Studio — only once
  // this run has actually started, so a screen left over from a previous run is not mistaken for it.
  const started = useRef(false);
  useEffect(() => {
    started.current = false;
  }, [controller]);
  useEffect(() => {
    if (!controller) return;
    if (screen === 'loading' || screen === 'playing') started.current = true;
    else if (started.current && (screen === 'menu' || screen === 'civs')) onStop();
  }, [screen, controller, onStop]);

  // Errors of the playtest session are mirrored in the Studio's journal.
  useEffect(() => {
    if (!controller) return;
    return controller.session.logHub.subscribe((entry) => {
      if (entry.level === 'error') studio.print('error', `[test] ${entry.message}`);
      else if (entry.level === 'warn') studio.print('warning', `[test] ${entry.message}`);
    });
  }, [controller, studio]);

  return (
    <div className="st-playtest" data-testid="st-playtest">
      {controller && (
        <ControllerContext.Provider value={controller}>
          <ThemedRoot controller={controller}>
            <canvas key={run} ref={canvasRef} className="cv-canvas is-visible" data-testid="game-canvas" tabIndex={-1} />
            {screen === 'playing' && <Hud />}
            {screen === 'loading' && <Loading />}
            {screen === 'error' && <ErrorScreen />}
          </ThemedRoot>
        </ControllerContext.Provider>
      )}
      <div className="st-playtest__bar">
        <span>Test en cours — {request.here ? 'ici' : 'depuis le début'}</span>
        <span className="st-playtest__hint">Échap : libérer la souris · F8 : arrêter</span>
        <button type="button" className="st-btn st-btn--small" onClick={() => setRun((n) => n + 1)} title="Relancer le test">
          ↺ Recommencer
        </button>
        <button type="button" className="st-btn st-btn--small st-btn--stop" onClick={onStop} data-testid="st-stop">
          ■ Arrêter
        </button>
      </div>
    </div>
  );
}
