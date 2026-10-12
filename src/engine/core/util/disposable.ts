/** Anything that releases resources when disposed. */
export interface Disposable {
  dispose(): void;
}

export type DisposeFn = () => void;

/** Wraps a function as a Disposable. Calling dispose twice is a no-op. */
export function toDisposable(fn: DisposeFn): Disposable {
  let done = false;
  return {
    dispose() {
      if (done) return;
      done = true;
      fn();
    },
  };
}

/**
 * Collects disposables and releases them in reverse registration order.
 *
 * Every registration a civilization makes through its context (event listeners, timers, UI
 * elements, input bindings, movement modifiers...) is tracked by a scope. Unloading the
 * civilization disposes the scope, which guarantees that nothing keeps running afterwards.
 */
export class DisposableScope implements Disposable {
  private items: Disposable[] = [];
  private children = new Set<DisposableScope>();
  private disposed = false;
  private readonly onError: (err: unknown) => void;

  constructor(
    readonly name: string,
    onError?: (err: unknown) => void,
  ) {
    this.onError =
      onError ??
      ((err) => {
        console.error(`[scope:${name}] erreur pendant la libération`, err);
      });
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Number of live registrations (children included). Used by isolation tests and diagnostics. */
  get size(): number {
    let n = this.items.length;
    for (const c of this.children) n += c.size;
    return n;
  }

  add<T extends Disposable>(item: T): T {
    if (this.disposed) {
      // Registering into a dead scope would leak: release immediately and report.
      this.safeDispose(item);
      this.onError(new Error(`Enregistrement refusé : le scope "${this.name}" est déjà libéré.`));
      return item;
    }
    this.items.push(item);
    return item;
  }

  addFn(fn: DisposeFn): Disposable {
    return this.add(toDisposable(fn));
  }

  /** Removes an item without disposing it (when the owner disposes it itself). */
  remove(item: Disposable): void {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  child(name: string): DisposableScope {
    const scope = new DisposableScope(`${this.name}/${name}`, this.onError);
    if (this.disposed) {
      scope.dispose();
      return scope;
    }
    this.children.add(scope);
    scope.addFn(() => this.children.delete(scope));
    return scope;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of [...this.children]) this.safeDispose(c);
    this.children.clear();
    const items = this.items;
    this.items = [];
    for (let i = items.length - 1; i >= 0; i--) this.safeDispose(items[i]!);
  }

  private safeDispose(item: Disposable): void {
    try {
      item.dispose();
    } catch (err) {
      this.onError(err);
    }
  }
}
