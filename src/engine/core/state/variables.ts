/**
 * Story variables: named, observable, JSON values ("door.rank", "memory.silasTrust").
 *
 * Each civilization owns the namespace equal to its id: it can only write `<civId>.*`.
 * `global.*` names are read-only views of the multiverse state (written through the
 * multiverse API, which enforces each pack's declared permissions).
 */
import type { JsonValue } from '../util/json';
import { deepClone, deepEqual } from '../util/json';
import { type Disposable, toDisposable } from '../util/disposable';

export type VarType = 'number' | 'boolean' | 'string' | 'json';

export interface VarDeclaration {
  type: VarType;
  default: JsonValue;
  /** French description shown in the Studio. */
  description?: string;
}

export type VarWatcher = (value: JsonValue | undefined, previous: JsonValue | undefined, name: string) => void;

export class VariableStore {
  private values = new Map<string, JsonValue>();
  private declarations = new Map<string, VarDeclaration>();
  private watchers = new Map<string, Set<VarWatcher>>();
  private prefixWatchers = new Map<string, Set<VarWatcher>>();
  private globalReader: (path: string) => JsonValue | undefined = () => undefined;

  constructor(private readonly onChange?: (name: string, value: JsonValue | undefined, previous: JsonValue | undefined) => void) {}

  /** Connects `global.*` reads to the multiverse state. */
  setGlobalReader(reader: (path: string) => JsonValue | undefined): void {
    this.globalReader = reader;
  }

  declare(name: string, decl: VarDeclaration): void {
    this.declarations.set(name, decl);
    if (!this.values.has(name)) this.values.set(name, deepClone(decl.default));
  }

  declarationOf(name: string): VarDeclaration | undefined {
    return this.declarations.get(name);
  }

  declarations_(): [string, VarDeclaration][] {
    return [...this.declarations.entries()];
  }

  get(name: string): JsonValue | undefined {
    if (name.startsWith('global.')) return this.globalReader(name.slice('global.'.length));
    return this.values.get(name);
  }

  has(name: string): boolean {
    return name.startsWith('global.') ? this.globalReader(name.slice(7)) !== undefined : this.values.has(name);
  }

  /** Raw write (namespace checks happen in the scoped API). */
  set(name: string, value: JsonValue): void {
    if (name.startsWith('global.')) throw new Error(`"${name}" est en lecture seule : utilisez l’API multivers.`);
    const decl = this.declarations.get(name);
    if (decl && !typeMatches(decl.type, value)) {
      throw new Error(`Type invalide pour ${name} : ${decl.type} attendu, reçu ${JSON.stringify(value)}.`);
    }
    const previous = this.values.get(name);
    if (deepEqual(previous, value)) return;
    const stored = deepClone(value);
    this.values.set(name, stored);
    this.notify(name, stored, previous);
  }

  delete(name: string): void {
    if (!this.values.has(name)) return;
    const previous = this.values.get(name);
    this.values.delete(name);
    this.notify(name, undefined, previous);
  }

  watch(name: string, watcher: VarWatcher): Disposable {
    return this.addWatcher(this.watchers, name, watcher);
  }

  /** Watches every variable starting with `prefix` (e.g. "door."). */
  watchPrefix(prefix: string, watcher: VarWatcher): Disposable {
    return this.addWatcher(this.prefixWatchers, prefix, watcher);
  }

  /** Snapshot of the variables of a namespace (for saves). */
  snapshot(namespace?: string): Record<string, JsonValue> {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of this.values) if (!namespace || k.startsWith(`${namespace}.`)) out[k] = deepClone(v);
    return out;
  }

  /** Restores values (without notifications) — used when loading a save. */
  restore(values: Record<string, JsonValue>, namespace?: string): void {
    if (namespace) for (const k of [...this.values.keys()]) if (k.startsWith(`${namespace}.`)) this.values.delete(k);
    for (const [k, v] of Object.entries(values)) this.values.set(k, deepClone(v));
    for (const [k, d] of this.declarations) if (!this.values.has(k)) this.values.set(k, deepClone(d.default));
  }

  clearNamespace(namespace: string): void {
    for (const k of [...this.values.keys()]) if (k.startsWith(`${namespace}.`)) this.values.delete(k);
    for (const k of [...this.declarations.keys()]) if (k.startsWith(`${namespace}.`)) this.declarations.delete(k);
  }

  names(): string[] {
    return [...this.values.keys()].sort();
  }

  private addWatcher(map: Map<string, Set<VarWatcher>>, key: string, watcher: VarWatcher): Disposable {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(watcher);
    return toDisposable(() => {
      set.delete(watcher);
      if (set.size === 0) map.delete(key);
    });
  }

  private notify(name: string, value: JsonValue | undefined, previous: JsonValue | undefined): void {
    for (const w of [...(this.watchers.get(name) ?? [])]) w(value, previous, name);
    for (const [prefix, set] of this.prefixWatchers) {
      if (name.startsWith(prefix)) for (const w of [...set]) w(value, previous, name);
    }
    this.onChange?.(name, value, previous);
  }
}

function typeMatches(type: VarType, value: JsonValue): boolean {
  switch (type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'json':
      return true;
  }
}

/** Compares two values with an operator used by conditions. */
export function compareValues(a: unknown, op: string, b: unknown): boolean {
  switch (op) {
    case '==':
      return deepEqual(a, b);
    case '!=':
      return !deepEqual(a, b);
    case '>':
      return typeof a === 'number' && typeof b === 'number' && a > b;
    case '>=':
      return typeof a === 'number' && typeof b === 'number' && a >= b;
    case '<':
      return typeof a === 'number' && typeof b === 'number' && a < b;
    case '<=':
      return typeof a === 'number' && typeof b === 'number' && a <= b;
    case 'exists':
      return a !== undefined && a !== null && a !== false;
    case 'missing':
      return a === undefined || a === null || a === false;
    case 'contains':
      return Array.isArray(a) ? a.some((x) => deepEqual(x, b)) : typeof a === 'string' && typeof b === 'string' && a.includes(b);
    default:
      return false;
  }
}

export const COMPARE_OPS = ['==', '!=', '>', '>=', '<', '<=', 'exists', 'missing', 'contains'] as const;
