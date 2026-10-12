/**
 * Global multiverse state: what persists across civilizations.
 *
 * Kept deliberately small and explicit: protagonist identity, multiverse fragments, global flags
 * and per-civilization progress. Packs can read all of it but may only write what their manifest
 * declares in `globalWrites` ("fragments.threshold", "flags.door.*"). Items, abilities and local
 * story state never leak between worlds unless a pack explicitly writes a global flag.
 */
import type { JsonValue } from '../util/json';
import { deepClone } from '../util/json';

export const GLOBAL_SCHEMA_VERSION = 1;

export interface CivProgress {
  started: boolean;
  completed: boolean;
  lastPlayed: string | null;
  playTime: number;
}

export interface GlobalState {
  schemaVersion: number;
  protagonist: { awakenings: number; title: string | null; createdAt: string };
  fragments: Record<string, { civ: string; acquiredAt: string }>;
  flags: Record<string, JsonValue>;
  civs: Record<string, CivProgress>;
}

export function createGlobalState(now = new Date()): GlobalState {
  return {
    schemaVersion: GLOBAL_SCHEMA_VERSION,
    protagonist: { awakenings: 0, title: null, createdAt: now.toISOString() },
    fragments: {},
    flags: {},
    civs: {},
  };
}

/** "flags.door.*" matches "flags.door.finished"; exact strings match themselves. */
export function isWriteAllowed(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => (p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : p === path));
}

export class MultiverseState {
  private state: GlobalState;
  private listeners = new Set<() => void>();

  constructor(initial?: GlobalState) {
    this.state = initial ? deepClone(initial) : createGlobalState();
  }

  get data(): Readonly<GlobalState> {
    return this.state;
  }

  replace(state: GlobalState): void {
    this.state = deepClone(state);
    this.changed();
  }

  snapshot(): GlobalState {
    return deepClone(this.state);
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Read access used by `global.*` variables. */
  read(path: string): JsonValue | undefined {
    const [head, ...rest] = path.split('.');
    const key = rest.join('.');
    switch (head) {
      case 'fragments':
        return key ? (this.state.fragments[key] ? true : undefined) : Object.keys(this.state.fragments);
      case 'flags':
        return this.state.flags[key];
      case 'civs': {
        const [civ, field] = [rest[0] ?? '', rest[1] ?? ''];
        const p = this.state.civs[civ];
        if (!p) return undefined;
        return field ? (p as unknown as Record<string, JsonValue>)[field] : (p as unknown as JsonValue);
      }
      case 'protagonist':
        return key === 'awakenings' ? this.state.protagonist.awakenings : key === 'title' ? this.state.protagonist.title : undefined;
      default:
        return undefined;
    }
  }

  hasFragment(id: string): boolean {
    return id in this.state.fragments;
  }

  fragments(): string[] {
    return Object.keys(this.state.fragments);
  }

  grantFragment(id: string, civId: string, allowed: readonly string[]): boolean {
    if (!isWriteAllowed(`fragments.${id}`, allowed)) {
      throw new Error(`La civilisation "${civId}" n'est pas autorisée à écrire fragments.${id} (globalWrites du manifeste).`);
    }
    if (this.hasFragment(id)) return false;
    this.state.fragments[id] = { civ: civId, acquiredAt: new Date().toISOString() };
    this.changed();
    return true;
  }

  getFlag(name: string): JsonValue | undefined {
    return this.state.flags[name];
  }

  setFlag(name: string, value: JsonValue, civId: string, allowed: readonly string[]): void {
    if (!isWriteAllowed(`flags.${name}`, allowed)) {
      throw new Error(`La civilisation "${civId}" n'est pas autorisée à écrire flags.${name} (globalWrites du manifeste).`);
    }
    this.state.flags[name] = deepClone(value);
    this.changed();
  }

  progress(civId: string): CivProgress {
    return this.state.civs[civId] ?? { started: false, completed: false, lastPlayed: null, playTime: 0 };
  }

  markStarted(civId: string): void {
    const p = this.progress(civId);
    this.state.civs[civId] = { ...p, started: true, lastPlayed: new Date().toISOString() };
    this.changed();
  }

  markCompleted(civId: string): void {
    const p = this.progress(civId);
    this.state.civs[civId] = { ...p, started: true, completed: true, lastPlayed: new Date().toISOString() };
    this.changed();
  }

  addPlayTime(civId: string, seconds: number): void {
    const p = this.progress(civId);
    this.state.civs[civId] = { ...p, playTime: p.playTime + seconds };
  }

  recordAwakening(): void {
    this.state.protagonist.awakenings++;
    this.changed();
  }

  resetCivProgress(civId: string): void {
    delete this.state.civs[civId];
    this.changed();
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}
