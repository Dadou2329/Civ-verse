/**
 * Simulation clock and timers. Time only advances through `advance(dt)` (paused while the game is
 * paused), which makes scripted waits deterministic in headless tests.
 */
import { type Disposable, toDisposable } from '../util/disposable';

interface Timer {
  at: number;
  interval: number | null;
  cb: () => void;
  alive: boolean;
}

export class SimClock {
  private _now = 0;
  private timers: Timer[] = [];
  private updaters = new Set<(dt: number) => void>();

  constructor(private readonly onError: (err: unknown, where: string) => void) {}

  get now(): number {
    return this._now;
  }

  after(seconds: number, cb: () => void): Disposable {
    const t: Timer = { at: this._now + Math.max(0, seconds), interval: null, cb, alive: true };
    this.timers.push(t);
    return toDisposable(() => {
      t.alive = false;
    });
  }

  every(seconds: number, cb: () => void): Disposable {
    const iv = Math.max(0.001, seconds);
    const t: Timer = { at: this._now + iv, interval: iv, cb, alive: true };
    this.timers.push(t);
    return toDisposable(() => {
      t.alive = false;
    });
  }

  wait(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.after(seconds, resolve);
    });
  }

  onUpdate(cb: (dt: number) => void): Disposable {
    this.updaters.add(cb);
    return toDisposable(() => this.updaters.delete(cb));
  }

  get timerCount(): number {
    return this.timers.filter((t) => t.alive).length;
  }

  get updaterCount(): number {
    return this.updaters.size;
  }

  advance(dt: number): void {
    this._now += dt;
    for (const u of [...this.updaters]) {
      try {
        u(dt);
      } catch (err) {
        this.onError(err, 'onUpdate');
      }
    }
    // Fire due timers in time order; callbacks may add new timers.
    for (let guard = 0; guard < 10000; guard++) {
      let next: Timer | null = null;
      for (const t of this.timers) if (t.alive && t.at <= this._now && (!next || t.at < next.at)) next = t;
      if (!next) break;
      if (next.interval !== null) next.at += next.interval;
      else next.alive = false;
      try {
        next.cb();
      } catch (err) {
        this.onError(err, 'minuterie');
      }
    }
    if (this.timers.length > 64) this.timers = this.timers.filter((t) => t.alive);
  }

  /** Cancels everything (session teardown). */
  reset(): void {
    for (const t of this.timers) t.alive = false;
    this.timers = [];
    this.updaters.clear();
    this._now = 0;
  }
}
