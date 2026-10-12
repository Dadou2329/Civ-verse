/**
 * Game UI state (React, zustand) and the UiBridge implementation used by the simulation.
 */
import { create } from 'zustand';
import type { UiBridge, UiNotification } from '@engine/core/sim/uiBridge';
import type { DocumentSpec, HudElement } from '@engine/core/sim/api';
import type { HudDefinition, PanelDefinition } from '@engine/core/packs/definitions';
import type { PresentationRequest } from '@engine/core/sim/presentation';
import { type Disposable, toDisposable } from '@engine/core/util/disposable';

export type Screen = 'boot' | 'menu' | 'civs' | 'settings' | 'registry' | 'credits' | 'loading' | 'playing' | 'error';
export type Overlay = null | 'pause' | 'journal' | 'inventory' | 'settings' | 'save' | 'load';

export interface Bark {
  id: number;
  entityId: string;
  text: string;
  until: number;
}

export interface UiState {
  screen: Screen;
  overlay: Overlay;
  /** Where "Paramètres" returns to. */
  settingsReturn: Screen;
  loadingLabel: string;
  error: string | null;
  notifications: UiNotification[];
  location: { title: string; subtitle?: string; key: number } | null;
  document: { spec: DocumentSpec; resolve: () => void } | null;
  endScreen: { spec: { title: string; subtitle?: string; lines?: string[] }; resolve: () => void } | null;
  confirm: { spec: { title: string; message: string; confirm: string; cancel: string }; resolve: (v: boolean) => void } | null;
  panels: { def: PanelDefinition; civId: string; props: Record<string, unknown> }[];
  huds: { def: HudDefinition; civId: string }[];
  hiddenHud: HudElement[];
  fade: { opacity: number; seconds: number; color: string };
  flash: { color: string; seconds: number; key: number } | null;
  tint: { color: string | null; strength: number; seconds: number };
  barks: Bark[];
  debug: boolean;
  set: (patch: Partial<UiState>) => void;
}

export const useUi = create<UiState>((set) => ({
  screen: 'boot',
  overlay: null,
  settingsReturn: 'menu',
  loadingLabel: '',
  error: null,
  notifications: [],
  location: null,
  document: null,
  endScreen: null,
  confirm: null,
  panels: [],
  huds: [],
  hiddenHud: [],
  fade: { opacity: 0, seconds: 0, color: '#000000' },
  flash: null,
  tint: { color: null, strength: 0, seconds: 0 },
  barks: [],
  debug: false,
  set: (patch) => set(patch),
}));

let counter = 1;

export class ReactUiBridge implements UiBridge {
  notify(n: UiNotification): void {
    const id = counter++;
    const entry = { ...n, id };
    // Removed by the HUD once it has been on screen for its duration (see Notifications.tsx), so
    // a notification raised while a cinematic hides the HUD is shown afterwards, not lost.
    useUi.setState((s) => ({ notifications: [...s.notifications.slice(-5), entry] }));
  }

  showLocation(title: string, subtitle?: string): void {
    const key = counter++;
    useUi.setState({ location: { title, subtitle, key } });
    setTimeout(() => {
      if (useUi.getState().location?.key === key) useUi.setState({ location: null });
    }, 4200);
  }

  showDocument(doc: DocumentSpec): Promise<void> {
    return new Promise((resolve) => {
      useUi.setState({
        document: {
          spec: doc,
          resolve: () => {
            useUi.setState({ document: null });
            resolve();
          },
        },
      });
    });
  }

  openPanel(def: PanelDefinition, civId: string, props: Record<string, unknown>): void {
    useUi.setState((s) => ({ panels: [...s.panels.filter((p) => p.def.id !== def.id), { def, civId, props }] }));
  }

  closePanel(id: string): void {
    useUi.setState((s) => ({ panels: s.panels.filter((p) => p.def.id !== id) }));
  }

  setHudVisible(element: HudElement, visible: boolean): void {
    useUi.setState((s) => ({ hiddenHud: visible ? s.hiddenHud.filter((e) => e !== element) : [...new Set([...s.hiddenHud, element])] }));
  }

  registerHud(def: HudDefinition, civId: string): Disposable {
    useUi.setState((s) => ({ huds: [...s.huds.filter((h) => h.def.id !== def.id), { def, civId }] }));
    return toDisposable(() => useUi.setState((s) => ({ huds: s.huds.filter((h) => h.def.id !== def.id) })));
  }

  showEndScreen(spec: { title: string; subtitle?: string; lines?: string[] }): Promise<void> {
    return new Promise((resolve) => {
      useUi.setState({
        endScreen: {
          spec,
          resolve: () => {
            useUi.setState({ endScreen: null });
            resolve();
          },
        },
      });
    });
  }

  confirm(spec: { title: string; message: string; confirm: string; cancel: string }): Promise<boolean> {
    return new Promise((resolve) => {
      useUi.setState({
        confirm: {
          spec,
          resolve: (v) => {
            useUi.setState({ confirm: null });
            resolve(v);
          },
        },
      });
    });
  }

  resetCiv(civId: string): void {
    useUi.setState((s) => ({
      panels: s.panels.filter((p) => p.civId !== civId),
      huds: s.huds.filter((h) => h.civId !== civId),
      hiddenHud: [],
      document: null,
      barks: [],
      location: null,
      fade: { opacity: 0, seconds: 0, color: '#000000' },
      tint: { color: null, strength: 0, seconds: 0 },
    }));
  }
}

/** Screen effects and barks coming from the presentation channel. */
export function handlePresentationForUi(req: PresentationRequest): void {
  if (req.type === 'fx') {
    const p = req.params;
    if (req.fx === 'fade') {
      // Without an explicit color, a fade continues the current one (a white fade stays white
      // through a scene change) and starts black from a clear screen.
      const current = useUi.getState().fade;
      const color = String(p.color ?? (current.opacity > 0.01 ? current.color : '#000000'));
      const to = { opacity: Number(p.to ?? 1), seconds: Number(p.seconds ?? 1), color };
      if (p.from !== undefined) {
        // Snap to the starting opacity first, then transition on the next frame.
        useUi.setState({ fade: { opacity: Number(p.from), seconds: 0, color } });
        requestAnimationFrame(() => requestAnimationFrame(() => useUi.setState({ fade: to })));
      } else useUi.setState({ fade: to });
    } else if (req.fx === 'flash') {
      useUi.setState({ flash: { color: String(p.color ?? '#ffffff'), seconds: Number(p.seconds ?? 0.6), key: counter++ } });
    } else if (req.fx === 'tint') {
      useUi.setState({ tint: { color: (p.color as string | null) ?? null, strength: Number(p.strength ?? 0.3), seconds: Number(p.seconds ?? 1) } });
    }
  } else if (req.type === 'bark') {
    const id = counter++;
    const bark: Bark = { id, entityId: req.entity, text: req.text, until: performance.now() + req.seconds * 1000 };
    useUi.setState((s) => ({ barks: [...s.barks.filter((b) => b.entityId !== req.entity), bark] }));
    setTimeout(() => useUi.setState((s) => ({ barks: s.barks.filter((b) => b.id !== id) })), req.seconds * 1000);
  }
}
