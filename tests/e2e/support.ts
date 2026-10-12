/**
 * Shared helpers of the browser tests.
 *
 * The tests drive the real game and Civilization Studio with the keyboard and mouse, and read
 * the simulation state through the development hooks (`window.__civ`, `window.__studio`) only to
 * check results — or, where noted, to aim the camera, since mouse look needs pointer lock.
 *
 * The browser renders with SwiftShader (software WebGL) in CI containers: a few frames per
 * second, so the game advances slowly (frames are capped at 0.1 s of simulated time). Waits are
 * therefore conditions with long timeouts, never fixed sleeps that assume a frame rate.
 */
import { expect, type Page } from '@playwright/test';

export interface Vec {
  x: number;
  y: number;
  z: number;
}

/** Console errors and uncaught exceptions of the page (a test fails if any appear). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`exception : ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console : ${m.text()}`);
  });
  return errors;
}

/**
 * Before any page script: low graphics settings (software rendering) and no pointer lock, so
 * that keyboard events stay with the page and Échap behaves like an unlocked mouse.
 */
export async function prepareGame(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.resolve();
    } as typeof Element.prototype.requestPointerLock;
    try {
      if (!localStorage.getItem('civverse.settings.v1')) localStorage.setItem('civverse.settings.v1', JSON.stringify({ quality: 'low' }));
    } catch {
      // Storage unavailable: default settings.
    }
  });
}

/** Evaluates a function on the game session (`window.__civ.session`). */
export function onSession<T, A = undefined>(page: Page, fn: (session: never, arg: A) => T, arg?: A): Promise<T> {
  return page.evaluate(
    ([src, a]) => {
      const session = (window as unknown as { __civ?: { session: unknown } }).__civ?.session;
      if (!session) throw new Error('window.__civ absent (serveur de développement requis)');
      return new Function('session', 'arg', `return (${src})(session, arg);`)(session, a) as T;
    },
    [fn.toString(), arg] as const,
  );
}

export async function playerPosition(page: Page): Promise<Vec> {
  return onSession(page, (s: { player: { position: Vec } }) => ({ ...s.player.position }));
}

/** Waits until a condition on the session is true (polls; the game may run at a few frames per second). */
export async function waitForSession(page: Page, fn: (session: never) => boolean, timeout = 120_000, message = 'condition'): Promise<void> {
  await expect.poll(() => onSession(page, fn), { timeout, message }).toBe(true);
}

/** Holds a key until a condition is met (movement at a few frames per second). */
export async function holdKeyUntil(page: Page, code: string, fn: (session: never) => boolean, timeout = 90_000): Promise<void> {
  await page.keyboard.down(code);
  try {
    await waitForSession(page, fn, timeout, `touche ${code} maintenue`);
  } finally {
    await page.keyboard.up(code);
  }
}

/** Presses a key long enough for the next frame to see it. */
export async function tap(page: Page, code: string): Promise<void> {
  await page.keyboard.down(code);
  await page.waitForTimeout(400);
  await page.keyboard.up(code);
}

/**
 * Turns the player toward a point. Mouse look requires pointer lock, which these tests do not
 * use: the view direction is set through the session instead (movement, jumping and
 * interactions still go through the keyboard).
 */
export async function lookAt(page: Page, target: Vec): Promise<void> {
  await onSession(
    page,
    (s: { player: { eye: Vec; setLook(yaw: number, pitch: number): void } }, t: Vec) => {
      const e = s.player.eye;
      const yaw = Math.atan2(t.x - e.x, t.z - e.z);
      const pitch = -Math.atan2(t.y - e.y, Math.hypot(t.x - e.x, t.z - e.z));
      s.player.setLook(yaw, pitch);
    },
    target,
  );
}

/** Normalizes French no-break spaces for text comparisons. */
export const norm = (t: string | null | undefined) => (t ?? '').replace(/[\u00a0\u202f]/g, ' ');
