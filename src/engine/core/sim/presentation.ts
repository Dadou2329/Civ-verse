/**
 * Presentation channel: requests from the simulation to the renderer/audio (sounds, music,
 * screen effects, animations, barks, environment changes, pack-specific effects).
 *
 * The simulation never calls the renderer directly. Headless runs record the requests so tests
 * can assert that, say, a door creak or a fade happened.
 */
import type { Vec3 } from '../util/math';
import { type Disposable, toDisposable } from '../util/disposable';

export type PresentationRequest =
  | { type: 'sound'; id: string; handle: number; at?: Vec3; entity?: string; volume?: number; pitch?: number; loop?: boolean }
  | { type: 'stopSound'; handle: number }
  | { type: 'music'; id: string | null; fade: number }
  | { type: 'ambience'; id: string | null; fade: number }
  | { type: 'fx'; fx: string; params: Record<string, unknown> }
  | { type: 'animation'; entity: string; name: string; loop: boolean; duration?: number }
  | { type: 'expression'; entity: string; expression: string }
  | { type: 'bark'; entity: string; text: string; seconds: number }
  | { type: 'environment'; patch: Record<string, unknown>; seconds: number }
  | { type: 'custom'; channel: string; payload: Record<string, unknown> }
  | { type: 'voxelsChanged'; min: [number, number, number]; max: [number, number, number] };

export type PresentationListener = (req: PresentationRequest) => void;

export class PresentationBus {
  private listeners = new Set<PresentationListener>();
  private recorded: PresentationRequest[] = [];
  private nextHandle = 1;

  constructor(private readonly record = false) {}

  newHandle(): number {
    return this.nextHandle++;
  }

  emit(req: PresentationRequest): void {
    if (this.record) {
      this.recorded.push(req);
      if (this.recorded.length > 2000) this.recorded.splice(0, 500);
    }
    for (const l of this.listeners) {
      try {
        l(req);
      } catch (err) {
        console.error('[présentation] erreur du rendu', err);
      }
    }
  }

  subscribe(listener: PresentationListener): Disposable {
    this.listeners.add(listener);
    return toDisposable(() => this.listeners.delete(listener));
  }

  /** Recorded requests (headless only). */
  history(): readonly PresentationRequest[] {
    return this.recorded;
  }

  clearHistory(): void {
    this.recorded = [];
  }
}
