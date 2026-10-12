/**
 * Voxel lighting: sky light (ambient light reaching a cell from the open sky) and colored block
 * light (lanterns, crystals, emissive blocks and entity light sources), each 0..15 per cell.
 *
 * Computed by flood fill like classic voxel games. Results are baked into mesh vertex data, so
 * any number of lanterns costs nothing at render time. Edits only recompute a bounded region:
 * light travels at most 15 cells, so cells farther than 16 cells (horizontally) from an edit
 * cannot change; sky columns are recomputed over the full height.
 */
import type { VoxelVolume, Box3i } from './volume';
import type { PaletteInfo } from './paletteInfo';

export interface PointLightSource {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

export const LIGHT_MAX = 15;
const MARGIN = 16;

/** Growable FIFO of cell indices. */
class IndexQueue {
  private buf: Int32Array;
  private head = 0;
  private tail = 0;
  constructor(capacity: number) {
    this.buf = new Int32Array(Math.max(1024, capacity));
  }
  get empty(): boolean {
    return this.head === this.tail;
  }
  reset(): void {
    this.head = 0;
    this.tail = 0;
  }
  push(i: number): void {
    if (this.tail === this.buf.length) {
      if (this.head > 0) {
        this.buf.copyWithin(0, this.head, this.tail);
        this.tail -= this.head;
        this.head = 0;
      }
      if (this.tail === this.buf.length) {
        const next = new Int32Array(this.buf.length * 2);
        next.set(this.buf);
        this.buf = next;
      }
    }
    this.buf[this.tail++] = i;
  }
  shift(): number {
    return this.buf[this.head++]!;
  }
}

export class LightField {
  readonly sky: Uint8Array;
  readonly r: Uint8Array;
  readonly g: Uint8Array;
  readonly b: Uint8Array;
  private readonly queue: IndexQueue;
  private sources: PointLightSource[] = [];

  constructor(readonly volume: VoxelVolume) {
    const n = volume.cellCount;
    this.sky = new Uint8Array(n);
    this.r = new Uint8Array(n);
    this.g = new Uint8Array(n);
    this.b = new Uint8Array(n);
    this.queue = new IndexQueue(1 << 16);
  }

  setSources(sources: readonly PointLightSource[]): void {
    this.sources = sources.map((s) => ({ ...s }));
  }

  getSources(): readonly PointLightSource[] {
    return this.sources;
  }

  computeAll(info: PaletteInfo): void {
    const v = this.volume;
    this.computeRegion(info, { min: [0, 0, 0], max: [v.sizeX - 1, v.sizeY - 1, v.sizeZ - 1] }, false);
  }

  /** Recomputes light after cells inside `changed` were modified. Returns the recomputed region. */
  update(info: PaletteInfo, changed: Box3i): Box3i {
    const v = this.volume;
    const region: Box3i = {
      min: [Math.max(0, changed.min[0] - MARGIN), 0, Math.max(0, changed.min[2] - MARGIN)],
      max: [Math.min(v.sizeX - 1, changed.max[0] + MARGIN), v.sizeY - 1, Math.min(v.sizeZ - 1, changed.max[2] + MARGIN)],
    };
    this.computeRegion(info, region, true);
    return region;
  }

  /** Light at a cell as 0..1 values [sky, r, g, b]. Above the volume = open sky. */
  sample(x: number, y: number, z: number): [number, number, number, number] {
    const v = this.volume;
    if (!v.inBounds(x, y, z)) return [y >= v.sizeY ? 1 : 0, 0, 0, 0];
    const i = v.index(x, y, z);
    return [this.sky[i]! / LIGHT_MAX, this.r[i]! / LIGHT_MAX, this.g[i]! / LIGHT_MAX, this.b[i]! / LIGHT_MAX];
  }

  private computeRegion(info: PaletteInfo, region: Box3i, seedFromBorder: boolean): void {
    const vol = this.volume;
    const sx = vol.sizeX;
    const sz = vol.sizeZ;
    const sy = vol.sizeY;
    const data = vol.data;
    const opaque = info.opaque;
    const [x0, y0, z0] = region.min;
    const [x1, y1, z1] = region.max;
    const sky = this.sky;
    const q = this.queue;

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        const base = sx * (z + sz * y);
        sky.fill(0, base + x0, base + x1 + 1);
        this.r.fill(0, base + x0, base + x1 + 1);
        this.g.fill(0, base + x0, base + x1 + 1);
        this.b.fill(0, base + x0, base + x1 + 1);
      }
    }

    // Sky columns: full light straight down until the first opaque cell.
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        for (let y = sy - 1; y >= 0; y--) {
          const i = x + sx * (z + sz * y);
          if (opaque[data[i]!]) break;
          if (y >= y0 && y <= y1) sky[i] = LIGHT_MAX;
        }
      }
    }

    // Seed only sky cells that can spread into a darker, non-opaque neighbor.
    q.reset();
    const layer = sx * sz;
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const i = x + sx * (z + sz * y);
          if (sky[i] !== LIGHT_MAX) continue;
          if (
            (x + 1 < sx && sky[i + 1]! < LIGHT_MAX - 1 && !opaque[data[i + 1]!]) ||
            (x > 0 && sky[i - 1]! < LIGHT_MAX - 1 && !opaque[data[i - 1]!]) ||
            (z + 1 < sz && sky[i + sx]! < LIGHT_MAX - 1 && !opaque[data[i + sx]!]) ||
            (z > 0 && sky[i - sx]! < LIGHT_MAX - 1 && !opaque[data[i - sx]!]) ||
            (y > 0 && sky[i - layer]! < LIGHT_MAX - 1 && !opaque[data[i - layer]!])
          ) {
            q.push(i);
          }
        }
      }
    }
    if (seedFromBorder) this.seedBorder(region, 'sky');
    this.floodSky(info);

    // Block light: emissive blocks and point sources.
    q.reset();
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const i = x + sx * (z + sz * y);
          const p = data[i]!;
          const er = info.emitR[p]!;
          const eg = info.emitG[p]!;
          const eb = info.emitB[p]!;
          if (er | eg | eb) {
            this.r[i] = er;
            this.g[i] = eg;
            this.b[i] = eb;
            q.push(i);
          }
        }
      }
    }
    for (const s of this.sources) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1 || s.z < z0 || s.z > z1) continue;
      if (!vol.inBounds(s.x, s.y, s.z)) continue;
      const i = vol.index(s.x, s.y, s.z);
      this.r[i] = Math.max(this.r[i]!, clampLevel(s.r));
      this.g[i] = Math.max(this.g[i]!, clampLevel(s.g));
      this.b[i] = Math.max(this.b[i]!, clampLevel(s.b));
      q.push(i);
    }
    if (seedFromBorder) this.seedBorder(region, 'block');
    this.floodBlock(info);
  }

  /** Pushes lit cells just outside the region (horizontally) so their light flows back in. */
  private seedBorder(region: Box3i, kind: 'sky' | 'block'): void {
    const vol = this.volume;
    const [x0, , z0] = region.min;
    const [x1, , z1] = region.max;
    const q = this.queue;
    const addIfLit = (x: number, y: number, z: number) => {
      if (!vol.inBounds(x, y, z)) return;
      const i = vol.index(x, y, z);
      if (kind === 'sky' ? this.sky[i]! > 1 : this.r[i]! > 1 || this.g[i]! > 1 || this.b[i]! > 1) q.push(i);
    };
    for (let y = 0; y < vol.sizeY; y++) {
      for (let x = x0; x <= x1; x++) {
        addIfLit(x, y, z0 - 1);
        addIfLit(x, y, z1 + 1);
      }
      for (let z = z0; z <= z1; z++) {
        addIfLit(x0 - 1, y, z);
        addIfLit(x1 + 1, y, z);
      }
    }
  }

  private floodSky(info: PaletteInfo): void {
    const vol = this.volume;
    const sx = vol.sizeX;
    const sz = vol.sizeZ;
    const sy = vol.sizeY;
    const layer = sx * sz;
    const data = vol.data;
    const opaque = info.opaque;
    const sky = this.sky;
    const q = this.queue;
    while (!q.empty) {
      const i = q.shift();
      const lv = sky[i]! - 1;
      if (lv <= 0) continue;
      const x = i % sx;
      const rest = (i - x) / sx;
      const z = rest % sz;
      const y = (rest - z) / sz;
      for (let d = 0; d < 6; d++) {
        let n: number;
        if (d === 0) {
          if (x + 1 >= sx) continue;
          n = i + 1;
        } else if (d === 1) {
          if (x === 0) continue;
          n = i - 1;
        } else if (d === 2) {
          if (z + 1 >= sz) continue;
          n = i + sx;
        } else if (d === 3) {
          if (z === 0) continue;
          n = i - sx;
        } else if (d === 4) {
          if (y + 1 >= sy) continue;
          n = i + layer;
        } else {
          if (y === 0) continue;
          n = i - layer;
        }
        if (lv > sky[n]! && !opaque[data[n]!]) {
          sky[n] = lv;
          q.push(n);
        }
      }
    }
  }

  private floodBlock(info: PaletteInfo): void {
    const vol = this.volume;
    const sx = vol.sizeX;
    const sz = vol.sizeZ;
    const sy = vol.sizeY;
    const layer = sx * sz;
    const data = vol.data;
    const opaque = info.opaque;
    const R = this.r;
    const G = this.g;
    const B = this.b;
    const q = this.queue;
    while (!q.empty) {
      const i = q.shift();
      const lr = R[i]! - 1;
      const lg = G[i]! - 1;
      const lb = B[i]! - 1;
      if (lr <= 0 && lg <= 0 && lb <= 0) continue;
      const x = i % sx;
      const rest = (i - x) / sx;
      const z = rest % sz;
      const y = (rest - z) / sz;
      for (let d = 0; d < 6; d++) {
        let n: number;
        if (d === 0) {
          if (x + 1 >= sx) continue;
          n = i + 1;
        } else if (d === 1) {
          if (x === 0) continue;
          n = i - 1;
        } else if (d === 2) {
          if (z + 1 >= sz) continue;
          n = i + sx;
        } else if (d === 3) {
          if (z === 0) continue;
          n = i - sx;
        } else if (d === 4) {
          if (y + 1 >= sy) continue;
          n = i + layer;
        } else {
          if (y === 0) continue;
          n = i - layer;
        }
        if (opaque[data[n]!]) continue;
        let changed = false;
        if (lr > R[n]!) {
          R[n] = lr;
          changed = true;
        }
        if (lg > G[n]!) {
          G[n] = lg;
          changed = true;
        }
        if (lb > B[n]!) {
          B[n] = lb;
          changed = true;
        }
        if (changed) q.push(n);
      }
    }
  }
}

function clampLevel(v: number): number {
  return Math.max(0, Math.min(LIGHT_MAX, Math.round(v)));
}
