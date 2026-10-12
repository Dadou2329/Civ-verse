/**
 * Browser save storage: IndexedDB (via idb-keyval), with a localStorage fallback when IndexedDB
 * is unavailable (private windows of some browsers). Player saves never touch project files.
 */
import { createStore, get, set, del, entries, type UseStore } from 'idb-keyval';
import type { SaveGame } from '../core/save/saveFormat';
import { type SaveSlotInfo, type SaveStorage, slotInfo } from '../core/save/storage';

const LS_PREFIX = 'civverse.save.';

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

  list(): Promise<SaveSlotInfo[]> {
    return this.useFallback(
      async () => {
        const all = await entries<string, string>(this.store!);
        return all.map(([, v]) => slotInfo(JSON.parse(v) as SaveGame)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      },
      () => {
        const out: SaveSlotInfo[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(LS_PREFIX)) out.push(slotInfo(JSON.parse(localStorage.getItem(k)!) as SaveGame));
        }
        return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      },
    );
  }

  load(slot: string): Promise<unknown | null> {
    return this.useFallback(
      async () => {
        const v = await get<string>(slot, this.store!);
        return v ? (JSON.parse(v) as unknown) : null;
      },
      () => {
        const v = localStorage.getItem(LS_PREFIX + slot);
        return v ? (JSON.parse(v) as unknown) : null;
      },
    );
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
