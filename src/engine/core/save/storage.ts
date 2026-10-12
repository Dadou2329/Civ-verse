/**
 * Save storage abstraction. The browser implementation uses IndexedDB
 * (src/engine/platform/idbSaveStorage.ts); tests use MemorySaveStorage.
 */
import type { SaveGame } from './saveFormat';

export interface SaveSlotInfo {
  slot: string;
  label: string;
  savedAt: string;
  currentCiv: string | null;
  playTime: number;
}

export interface SaveStorage {
  list(): Promise<SaveSlotInfo[]>;
  load(slot: string): Promise<unknown | null>;
  save(slot: string, data: SaveGame): Promise<void>;
  delete(slot: string): Promise<void>;
}

export function slotInfo(save: SaveGame): SaveSlotInfo {
  const playTime = Object.values(save.civs).reduce((s, c) => s + (c.playTime ?? 0), 0);
  return { slot: save.slot, label: save.label, savedAt: save.savedAt, currentCiv: save.currentCiv, playTime };
}

export class MemorySaveStorage implements SaveStorage {
  private data = new Map<string, string>();

  async list(): Promise<SaveSlotInfo[]> {
    return [...this.data.values()].map((s) => slotInfo(JSON.parse(s) as SaveGame)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  async load(slot: string): Promise<unknown | null> {
    const s = this.data.get(slot);
    return s ? (JSON.parse(s) as unknown) : null;
  }
  async save(slot: string, data: SaveGame): Promise<void> {
    this.data.set(slot, JSON.stringify(data));
  }
  async delete(slot: string): Promise<void> {
    this.data.delete(slot);
  }
}
