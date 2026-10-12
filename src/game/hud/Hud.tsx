import { useEffect, useReducer } from 'react';
import { useController, useSession, useT } from '../hooks';
import { useUi } from '../state/uiStore';
import { DialoguePanel } from './DialoguePanel';
import { Crosshair, InteractionPrompt } from './Prompt';
import { ObjectiveTracker } from './Objectives';
import { LocationTitle, Notifications } from './Notifications';
import { Barks, CinematicOverlay, ScreenFx, useCinematicHidesHud } from './Cinematic';
import { AbilityBar } from './Abilities';
import { CivHudSlot, CivPanels } from './CivUi';
import { ConfirmDialog, DocumentViewer, EndScreen } from './Modals';
import { Journal } from './Journal';
import { InventoryPanel } from './Inventory';
import { PauseMenu, SaveSlots } from './Pause';
import { DebugOverlay } from './Debug';
import { SettingsPanel } from '../screens/Settings';
import { Modal } from '../ui/common';
import type { HudElement } from '@engine/core/sim/api';

/** Everything displayed on top of the 3D view while playing. */
export function Hud() {
  const controller = useController();
  const session = useSession();
  const t = useT();
  const overlay = useUi((s) => s.overlay);
  const hidden = useUi((s) => s.hiddenHud);
  const debug = useUi((s) => s.debug);
  const docModal = useUi((s) => s.document);
  const endScreen = useUi((s) => s.endScreen);
  const panels = useUi((s) => s.panels);
  const confirm = useUi((s) => s.confirm);
  const set = useUi((s) => s.set);
  const cinematicHides = useCinematicHidesHud();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const modal = !!docModal || !!endScreen || panels.length > 0 || !!confirm;

  // Menu hotkeys (gameplay keys are handled by the 3D view).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || modal) return;
      const b = controller.settings.bindings;
      const is = (a: keyof typeof b) => b[a].includes(e.code);
      if (session.dialogue.isActive || session.cinematics.current) return;
      if (is('pause') && overlay === null && e.code !== 'Escape') {
        controller.openOverlay('pause');
      } else if (is('journal')) {
        e.preventDefault();
        if (overlay === 'journal') controller.closeOverlay();
        else if (overlay === null) controller.openOverlay('journal');
      } else if (is('inventory') && !hidden.includes('inventory')) {
        e.preventDefault();
        if (overlay === 'inventory') controller.closeOverlay();
        else if (overlay === null) controller.openOverlay('inventory');
      } else if (is('debug')) {
        e.preventDefault();
        set({ debug: !useUi.getState().debug });
      } else if (is('colliders') && controller.view) {
        e.preventDefault();
        controller.view.showColliders = !controller.view.showColliders;
      } else if (is('quicksave') && overlay === null) {
        e.preventDefault();
        void controller.save('slot1');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, session, overlay, modal, hidden, set]);

  // Losing pointer lock (Escape) while playing opens the pause menu.
  useEffect(() => {
    const onLockChange = () => {
      const view = controller.view;
      if (!view) return;
      if (!view.input.pointerLocked && view.playing && useUi.getState().overlay === null && !modal) controller.openOverlay('pause');
      bump();
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [controller, modal]);

  const show = (el: HudElement) => !hidden.includes(el) && !cinematicHides;
  const pointerLocked = controller.view?.input.pointerLocked ?? false;

  return (
    <div className="cv-hud" data-testid="hud">
      <ScreenFx />
      <CinematicOverlay />
      {!cinematicHides && (
        <>
          {show('crosshair') && !session.dialogue.isActive && <Crosshair />}
          {show('prompt') && !session.dialogue.isActive && <InteractionPrompt />}
          <div className="cv-hud__top-left">
            <CivHudSlot slot="top-left" />
          </div>
          <div className="cv-hud__top-center">
            <CivHudSlot slot="top-center" />
          </div>
          <div className="cv-hud__top-right">
            {show('objectives') && <ObjectiveTracker />}
            <CivHudSlot slot="top-right" />
          </div>
          <div className="cv-hud__bottom-left">
            <CivHudSlot slot="bottom-left" />
          </div>
          <div className="cv-hud__bottom-center">
            {show('abilities') && <AbilityBar />}
            <CivHudSlot slot="bottom-center" />
          </div>
          <div className="cv-hud__bottom-right">
            <CivHudSlot slot="bottom-right" />
          </div>
          <CivHudSlot slot="center" />
          <CivHudSlot slot="overlay" />
          <Barks />
        </>
      )}
      {show('notifications') && <Notifications />}
      {show('location') && <LocationTitle />}
      <DialoguePanel />
      <CivPanels />
      <DocumentViewer />
      <ConfirmDialog />
      <EndScreen />
      {overlay === 'pause' && <PauseMenu />}
      {overlay === 'journal' && <Journal />}
      {overlay === 'inventory' && <InventoryPanel />}
      {overlay === 'save' && <SaveSlots mode="save" />}
      {overlay === 'load' && <SaveSlots mode="load" />}
      {overlay === 'settings' && (
        <Modal onClose={() => set({ overlay: 'pause' })} className="cv-settings-modal">
          <SettingsPanel onClose={() => set({ overlay: 'pause' })} />
        </Modal>
      )}
      {debug && <DebugOverlay />}
      {controller.settings.showFps && !debug && controller.view && <div className="cv-fps">{controller.view.stats.fps.toFixed(0)} i/s</div>}
      {!pointerLocked && overlay === null && !modal && !session.dialogue.isActive && (
        <button type="button" className="cv-click-to-play" onClick={() => controller.view?.input.requestPointerLock()} data-testid="click-to-play">
          {t('ui.clickToPlay')}
        </button>
      )}
    </div>
  );
}
