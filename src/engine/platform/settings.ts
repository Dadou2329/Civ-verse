/**
 * Player settings (Paramètres), stored per browser in localStorage.
 */
import type { QualityLevel } from '../view/quality';
import type { AudioVolumes } from '../audio/audioEngine';

export type GameAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'secondary'
  | 'journal'
  | 'inventory'
  | 'pause'
  | 'skip'
  | 'debug'
  | 'colliders'
  | 'quicksave';

export interface GameSettings {
  mouseSensitivity: number;
  invertY: boolean;
  /** Vertical field of view in degrees. */
  fov: number;
  quality: QualityLevel;
  headBob: boolean;
  volumes: AudioVolumes;
  subtitles: 'small' | 'medium' | 'large';
  /** Dialogue text speed in characters per second (0 = instant). */
  textSpeed: number;
  showFps: boolean;
  showMarkers: boolean;
  locale: string;
  bindings: Record<GameAction, string[]>;
}

export const DEFAULT_BINDINGS: Record<GameAction, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  secondary: ['KeyF'],
  journal: ['KeyJ'],
  inventory: ['KeyI', 'Tab'],
  pause: ['Escape', 'KeyP'],
  skip: ['Space', 'Enter'],
  debug: ['F3'],
  colliders: ['F4'],
  quicksave: ['F5'],
};

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1,
  invertY: false,
  fov: 72,
  quality: 'high',
  headBob: true,
  volumes: { master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.7, ui: 0.7 },
  subtitles: 'medium',
  textSpeed: 55,
  showFps: false,
  showMarkers: true,
  locale: 'fr-FR',
  bindings: DEFAULT_BINDINGS,
};

const KEY = 'civverse.settings.v1';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      volumes: { ...DEFAULT_SETTINGS.volumes, ...(parsed.volumes ?? {}) },
      bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings ?? {}) },
    };
  } catch (err) {
    console.warn('[paramètres] lecture impossible, valeurs par défaut', err);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    console.warn('[paramètres] enregistrement impossible', err);
  }
}
