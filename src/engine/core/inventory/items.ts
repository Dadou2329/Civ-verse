/**
 * Item model. Items are declared with `defineItem` (code) or in `content/items.json` (data, Studio).
 * Icons are procedural specs painted by the UI layer, so no image files are needed.
 */
import type { ItemDefinition } from '../packs/definitions';

export type IconShape =
  | 'key'
  | 'document'
  | 'scroll'
  | 'letter'
  | 'plaque'
  | 'shard'
  | 'gem'
  | 'coin'
  | 'gear'
  | 'flask'
  | 'book'
  | 'fragment'
  | 'box'
  | 'ring'
  | 'eye'
  | 'hand'
  | 'note'
  | 'bell'
  | 'cup'
  | 'kite'
  | 'dial'
  | 'ingot'
  | 'spring'
  | 'feather'
  | 'star'
  | 'circle'
  | 'hammer'
  | 'wrench'
  | 'mask'
  | 'glove'
  | 'shield'
  | 'lens'
  | 'seal'
  | 'bracelet'
  | 'wheel';

export const ICON_SHAPES: readonly IconShape[] = [
  'key',
  'document',
  'scroll',
  'letter',
  'plaque',
  'shard',
  'gem',
  'coin',
  'gear',
  'flask',
  'book',
  'fragment',
  'box',
  'ring',
  'eye',
  'hand',
  'note',
  'bell',
  'cup',
  'kite',
  'dial',
  'ingot',
  'spring',
  'feather',
  'star',
  'circle',
  'hammer',
  'wrench',
  'mask',
  'glove',
  'shield',
  'lens',
  'seal',
  'bracelet',
  'wheel',
];

export interface IconSpec {
  shape: IconShape;
  color: string;
  accent?: string;
  /** Adds a soft glow (magical/memory items). */
  glow?: boolean;
}

export interface InventoryEntry {
  id: string;
  count: number;
}

/** Item registry for the active civilization (+ shared library). */
export class ItemRegistry {
  private defs = new Map<string, ItemDefinition>();
  private owners = new Map<string, string>();

  register(def: ItemDefinition, owner: string): void {
    const prev = this.owners.get(def.id);
    if (prev && prev !== owner) throw new Error(`L’objet ${def.id} est déjà défini par "${prev}".`);
    this.defs.set(def.id, def);
    this.owners.set(def.id, owner);
  }

  unregisterOwner(owner: string): void {
    for (const [id, o] of [...this.owners]) {
      if (o === owner) {
        this.defs.delete(id);
        this.owners.delete(id);
      }
    }
  }

  get(id: string): ItemDefinition | undefined {
    return this.defs.get(id);
  }

  all(): ItemDefinition[] {
    return [...this.defs.values()];
  }
}

/** Counted item container (the player's inventory, chests...). */
export class Inventory {
  private items = new Map<string, number>();
  private listeners = new Set<() => void>();

  count(id: string): number {
    return this.items.get(id) ?? 0;
  }

  add(id: string, n = 1, maxStack = Infinity): number {
    if (n <= 0) return this.count(id);
    const next = Math.min(maxStack, this.count(id) + n);
    this.items.set(id, next);
    this.emit();
    return next;
  }

  remove(id: string, n = 1): boolean {
    const cur = this.count(id);
    if (cur < n || n <= 0) return false;
    if (cur === n) this.items.delete(id);
    else this.items.set(id, cur - n);
    this.emit();
    return true;
  }

  entries(): InventoryEntry[] {
    return [...this.items.entries()].map(([id, count]) => ({ id, count }));
  }

  restore(entries: InventoryEntry[]): void {
    this.items = new Map(entries.filter((e) => e.count > 0).map((e) => [e.id, e.count]));
    this.emit();
  }

  clear(): void {
    this.items.clear();
    this.emit();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
