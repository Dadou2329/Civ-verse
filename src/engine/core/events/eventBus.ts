import type { EventPayload } from './eventMap';
import { type Disposable, type DisposableScope, toDisposable } from '../util/disposable';

export type EventHandler<P> = (payload: P, eventName: string) => void;
export type AnyEventHandler = (eventName: string, payload: Record<string, unknown>) => void;

const MAX_DEPTH = 64;

/**
 * Synchronous typed event bus.
 *
 * - Handler errors are reported through `onError` and never stop delivery to other handlers.
 * - Re-entrant emission is allowed up to a fixed depth, beyond which the emission is refused and
 *   reported (protects against rule loops such as A → B → A).
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler<never>>>();
  private anyHandlers = new Set<AnyEventHandler>();
  private depth = 0;

  constructor(private readonly onError: (err: unknown, eventName: string) => void) {}

  on<K extends string>(name: K, handler: EventHandler<EventPayload<K>>): Disposable {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    const h = handler as EventHandler<never>;
    set.add(h);
    return toDisposable(() => {
      set.delete(h);
      if (set.size === 0) this.handlers.delete(name);
    });
  }

  once<K extends string>(name: K, handler: EventHandler<EventPayload<K>>): Disposable {
    const d = this.on(name, (payload, eventName) => {
      d.dispose();
      handler(payload, eventName);
    });
    return d;
  }

  onAny(handler: AnyEventHandler): Disposable {
    this.anyHandlers.add(handler);
    return toDisposable(() => this.anyHandlers.delete(handler));
  }

  emit<K extends string>(name: K, payload: EventPayload<K>): void {
    if (this.depth >= MAX_DEPTH) {
      this.onError(new Error(`Boucle d'événements détectée (profondeur ${MAX_DEPTH}) sur "${name}".`), name);
      return;
    }
    this.depth++;
    try {
      const set = this.handlers.get(name);
      if (set) {
        for (const h of [...set]) {
          if (!set.has(h)) continue;
          try {
            (h as EventHandler<EventPayload<K>>)(payload, name);
          } catch (err) {
            this.onError(err, name);
          }
        }
      }
      for (const h of [...this.anyHandlers]) {
        try {
          h(name, payload as Record<string, unknown>);
        } catch (err) {
          this.onError(err, name);
        }
      }
    } finally {
      this.depth--;
    }
  }

  /** Total number of subscriptions (diagnostics and isolation tests). */
  get listenerCount(): number {
    let n = this.anyHandlers.size;
    for (const s of this.handlers.values()) n += s.size;
    return n;
  }

  listenerCountFor(name: string): number {
    return this.handlers.get(name)?.size ?? 0;
  }
}

/** Event access bound to a DisposableScope: every subscription is released with the scope. */
export class ScopedEvents {
  constructor(
    private readonly bus: EventBus,
    private readonly scope: DisposableScope,
  ) {}

  on<K extends string>(name: K, handler: EventHandler<EventPayload<K>>): Disposable {
    return this.scope.add(this.bus.on(name, handler));
  }

  once<K extends string>(name: K, handler: EventHandler<EventPayload<K>>): Disposable {
    return this.scope.add(this.bus.once(name, handler));
  }

  onAny(handler: AnyEventHandler): Disposable {
    return this.scope.add(this.bus.onAny(handler));
  }

  emit<K extends string>(name: K, payload: EventPayload<K>): void {
    this.bus.emit(name, payload);
  }
}
