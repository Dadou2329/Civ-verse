/**
 * Keyboard and mouse input for gameplay: pointer lock, mouse look, action bindings with edge
 * detection. Keys are physical (KeyboardEvent.code), so WASD bindings are ZQSD on AZERTY layouts.
 */
import type { GameAction } from '../platform/settings';

export class InputManager {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private keyListeners = new Set<(code: string, down: boolean, e: KeyboardEvent) => boolean | void>();
  private cleanup: (() => void)[] = [];
  /** When false, gameplay keys are ignored (menus open). */
  enabled = true;
  bindings: Record<GameAction, string[]>;

  constructor(
    private readonly target: HTMLElement,
    bindings: Record<GameAction, string[]>,
  ) {
    this.bindings = bindings;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      let consumed = false;
      for (const l of this.keyListeners) if (l(e.code, true, e)) consumed = true;
      if (this.enabled && (consumed || this.isGameKey(e.code))) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.down.delete(e.code);
      for (const l of this.keyListeners) l(e.code, false, e);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === this.target) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
    };
    const onBlur = () => {
      this.down.clear();
      this.pressed.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);
    this.cleanup.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('blur', onBlur),
    );
  }

  private isGameKey(code: string): boolean {
    for (const codes of Object.values(this.bindings)) if (codes.includes(code)) return true;
    return false;
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestPointerLock(): void {
    if (this.pointerLocked) return;
    try {
      const r = this.target.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => undefined);
    } catch {
      // Pointer lock can be refused (iframe, quick re-lock): mouse look then needs a new click.
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  isDown(action: GameAction): boolean {
    if (!this.enabled) return false;
    return this.bindings[action].some((c) => this.down.has(c));
  }

  /** True once per key press. */
  consume(action: GameAction): boolean {
    let hit = false;
    for (const c of this.bindings[action]) {
      if (this.pressed.has(c)) {
        this.pressed.delete(c);
        hit = true;
      }
    }
    return hit && this.enabled;
  }

  /** Mouse movement since last call (pixels). */
  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return this.enabled ? r : { dx: 0, dy: 0 };
  }

  /** Clears pending edges at the end of a frame (unconsumed presses are dropped). */
  endFrame(): void {
    this.pressed.clear();
  }

  onKey(cb: (code: string, down: boolean, e: KeyboardEvent) => boolean | void): () => void {
    this.keyListeners.add(cb);
    return () => this.keyListeners.delete(cb);
  }

  /** Simulated input for automated tests and the Studio. */
  simulate(code: string, down: boolean): void {
    if (down) {
      this.pressed.add(code);
      this.down.add(code);
    } else this.down.delete(code);
  }

  dispose(): void {
    this.cleanup.forEach((f) => f());
    this.keyListeners.clear();
    this.exitPointerLock();
  }
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

const FR_KEY_NAMES: Record<string, string> = {
  Space: 'Espace',
  ShiftLeft: 'Maj',
  ShiftRight: 'Maj droite',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl droite',
  AltLeft: 'Alt',
  Escape: 'Échap',
  Enter: 'Entrée',
  Tab: 'Tab',
  Backspace: 'Retour',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

let layoutMap: Map<string, string> | null = null;
/** Loads the keyboard layout map (Chromium) so labels show "Z" instead of "W" on AZERTY. */
export async function loadKeyboardLayout(): Promise<void> {
  const kb = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    layoutMap = await kb.getLayoutMap();
  } catch {
    layoutMap = null;
  }
}

/** French display label of a physical key code. */
export function keyLabel(code: string): string {
  if (FR_KEY_NAMES[code]) return FR_KEY_NAMES[code]!;
  const fromLayout = layoutMap?.get(code);
  if (fromLayout) return fromLayout.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
