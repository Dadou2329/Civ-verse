/**
 * Finite voxel volume (palette-compressed).
 *
 * Cell (x, y, z) occupies [x, x+1] × [y, y+1] × [z, z+1] in world units (1 block = 1 m), relative
 * to the scene origin. Index layout is Y-major (layers), which compresses well because the upper
 * part of a world is mostly air.
 */
import { AIR_ID } from './blocks';

export interface Box3i {
  min: [number, number, number];
  /** Inclusive maximum corner. */
  max: [number, number, number];
}

export type VolumeChangeListener = (box: Box3i) => void;

export class VoxelVolume {
  readonly data: Uint16Array;
  private _palette: string[] = [AIR_ID];
  private paletteIndex = new Map<string, number>([[AIR_ID, 0]]);
  private listeners = new Set<VolumeChangeListener>();
  private batchDepth = 0;
  private pending: Box3i | null = null;
  private _revision = 0;

  constructor(
    readonly sizeX: number,
    readonly sizeY: number,
    readonly sizeZ: number,
    data?: Uint16Array,
    palette?: string[],
  ) {
    if (![sizeX, sizeY, sizeZ].every((n) => Number.isInteger(n) && n > 0 && n <= 1024)) {
      throw new Error(`Dimensions de volume invalides : ${sizeX}×${sizeY}×${sizeZ}`);
    }
    const n = sizeX * sizeY * sizeZ;
    if (data && data.length !== n) throw new Error('Taille des données de volume incohérente.');
    this.data = data ?? new Uint16Array(n);
    if (palette) {
      if (palette[0] !== AIR_ID) throw new Error(`La palette doit commencer par ${AIR_ID}.`);
      this._palette = [...palette];
      this.paletteIndex = new Map(palette.map((id, i) => [id, i]));
    }
  }

  get palette(): readonly string[] {
    return this._palette;
  }

  get revision(): number {
    return this._revision;
  }

  get cellCount(): number {
    return this.data.length;
  }

  index(x: number, y: number, z: number): number {
    return x + this.sizeX * (z + this.sizeZ * y);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ;
  }

  /** Palette index at a cell (0 = air, also for out-of-bounds cells). */
  getIndex(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.data[x + this.sizeX * (z + this.sizeZ * y)]!;
  }

  get(x: number, y: number, z: number): string {
    return this._palette[this.getIndex(x, y, z)]!;
  }

  paletteIndexOf(id: string): number {
    let i = this.paletteIndex.get(id);
    if (i === undefined) {
      if (this._palette.length >= 65535) throw new Error('Palette de blocs pleine (65535 types).');
      i = this._palette.length;
      this._palette.push(id);
      this.paletteIndex.set(id, i);
    }
    return i;
  }

  /** Sets a cell; `null` or AIR_ID clears it. Out-of-bounds writes are ignored and return false. */
  set(x: number, y: number, z: number, id: string | null): boolean {
    if (!this.inBounds(x, y, z)) return false;
    const pi = id === null || id === AIR_ID ? 0 : this.paletteIndexOf(id);
    const idx = x + this.sizeX * (z + this.sizeZ * y);
    if (this.data[idx] === pi) return false;
    this.data[idx] = pi;
    this.markDirty({ min: [x, y, z], max: [x, y, z] });
    return true;
  }

  setIndex(x: number, y: number, z: number, paletteIdx: number): void {
    if (!this.inBounds(x, y, z)) return;
    const idx = x + this.sizeX * (z + this.sizeZ * y);
    if (this.data[idx] === paletteIdx) return;
    this.data[idx] = paletteIdx;
    this.markDirty({ min: [x, y, z], max: [x, y, z] });
  }

  /** Groups many edits into a single change notification. */
  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.pending) {
        const box = this.pending;
        this.pending = null;
        this.emit(box);
      }
    }
  }

  onChange(listener: VolumeChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Signals an externally performed modification (e.g. bulk data load). */
  markDirty(box: Box3i): void {
    if (this.batchDepth > 0) {
      this.pending = this.pending ? unionBox(this.pending, box) : { min: [...box.min], max: [...box.max] };
      return;
    }
    this.emit(box);
  }

  private emit(box: Box3i): void {
    this._revision++;
    for (const l of this.listeners) l(box);
  }

  clone(): VoxelVolume {
    return new VoxelVolume(this.sizeX, this.sizeY, this.sizeZ, new Uint16Array(this.data), [...this._palette]);
  }

  /** Counts cells per block id (diagnostics, palette compaction). */
  histogram(): Map<string, number> {
    const counts = new Uint32Array(this._palette.length);
    for (let i = 0; i < this.data.length; i++) counts[this.data[i]!]!++;
    const out = new Map<string, number>();
    counts.forEach((c, i) => {
      if (c > 0) out.set(this._palette[i]!, c);
    });
    return out;
  }

  /** Removes unused palette entries (keeps air at 0). Returns the number removed. */
  compactPalette(): number {
    const used = new Uint8Array(this._palette.length);
    used[0] = 1;
    for (let i = 0; i < this.data.length; i++) used[this.data[i]!] = 1;
    const remap = new Uint16Array(this._palette.length);
    const next: string[] = [];
    this._palette.forEach((id, i) => {
      if (used[i]) {
        remap[i] = next.length;
        next.push(id);
      }
    });
    const removed = this._palette.length - next.length;
    if (removed === 0) return 0;
    for (let i = 0; i < this.data.length; i++) this.data[i] = remap[this.data[i]!]!;
    this._palette = next;
    this.paletteIndex = new Map(next.map((id, i) => [id, i]));
    return removed;
  }

  /** Replaces a block id by another everywhere (e.g. renamed asset during migration). */
  remapId(from: string, to: string): void {
    const i = this.paletteIndex.get(from);
    if (i === undefined || i === 0) return;
    const existing = this.paletteIndex.get(to);
    if (existing === undefined) {
      this._palette[i] = to;
      this.paletteIndex.delete(from);
      this.paletteIndex.set(to, i);
    } else {
      for (let k = 0; k < this.data.length; k++) if (this.data[k] === i) this.data[k] = existing;
    }
    this.markDirty({ min: [0, 0, 0], max: [this.sizeX - 1, this.sizeY - 1, this.sizeZ - 1] });
  }
}

export function unionBox(a: Box3i, b: Box3i): Box3i {
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}

export function normalizeBox(a: readonly number[], b: readonly number[]): Box3i {
  return {
    min: [Math.min(a[0]!, b[0]!), Math.min(a[1]!, b[1]!), Math.min(a[2]!, b[2]!)],
    max: [Math.max(a[0]!, b[0]!), Math.max(a[1]!, b[1]!), Math.max(a[2]!, b[2]!)],
  };
}
