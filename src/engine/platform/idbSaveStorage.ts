/**
 * Browser save storage: IndexedDB (via idb-keyval), with a localStorage fallback when IndexedDB
 * is unavailable (private windows of some browsers). Player saves never touch project files.
 */
import { createStore, get, set, del, entries, type UseStore } from 'idb-keyval';
import { SaveLoadError, type SaveGame } from '../core/save/saveFormat';
import { type SaveSlotInfo, type SaveStorage, slotInfo } from '../core/save/storage';

const LS_PREFIX = 'civverse.save.';

/** Slot summaries of the readable entries; a damaged entry is reported, not fatal. */
function summaries(raw: [string, string][]): SaveSlotInfo[] {
  const out: SaveSlotInfo[] = [];
  for (const [slot, json] of raw) {
    try {
      out.push(slotInfo(JSON.parse(json) as SaveGame));
    } catch (err) {
      console.warn(`[sauvegarde] emplacement « ${slot} » illisible`, err);
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function parseStored(slot: string, json: string | null | undefined): unknown | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new SaveLoadError(`La sauvegarde « ${slot} » est endommagée (données illisibles).`);
  }
}

export class BrowserSaveStorage implements SaveStorage {
  private store: UseStore | null = null;
  private fallback = false;

  constructor() {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('indexedDB indisponible');
      this.store = createStore('civilizationverse', 'saves');
    } catch {
      this.fallback = true;
    }
  }

  /** Runs an IndexedDB operation; only a failure of IndexedDB itself switches to localStorage. */
  private async useFallback<T>(fn: () => Promise<T>, fb: () => T): Promise<T> {
    if (this.fallback || !this.store) return fb();
    try {
      return await fn();
    } catch (err) {
      console.warn('[sauvegarde] IndexedDB indisponible, repli sur localStorage', err);
      this.fallback = true;
      return fb();
    }
  }

  async list(): Promise<SaveSlotInfo[]> {
    const raw = await this.useFallback(
      () => entries<string, string>(this.store!),
      () => {
        const out: [string, string][] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(LS_PREFIX)) out.push([k.slice(LS_PREFIX.length), localStorage.getItem(k) ?? '']);
        }
        return out;
      },
    );
    return summaries(raw);
  }

  async load(slot: string): Promise<unknown | null> {
    const json = await this.useFallback(
      () => get<string>(slot, this.store!),
      () => localStorage.getItem(LS_PREFIX + slot),
    );
    return parseStored(slot, json);
  }

  save(slot: string, data: SaveGame): Promise<void> {
    const json = JSON.stringify(data);
    return this.useFallback(
      () => set(slot, json, this.store!),
      () => localStorage.setItem(LS_PREFIX + slot, json),
    );
  }

  delete(slot: string): Promise<void> {
    return this.useFallback(
      () => del(slot, this.store!),
      () => localStorage.removeItem(LS_PREFIX + slot),
    );
  }
}
