/**
 * Construction kit: high-level voxel building operations.
 *
 * Used by world seed scripts (through '@sdk/build'), so that towns, castles, slums, temples or
 * laboratories are built from walls, floors, roofs and stairs rather than individual cube
 * coordinates. All operations are batched (one change notification).
 */
import type { Box3i, VoxelVolume } from './volume';
import { normalizeBox } from './volume';
import { AIR_ID } from './blocks';
import { Rng } from '../util/rng';

export type V3 = readonly [number, number, number];
export type Axis = 'x' | 'z';
export type Dir4 = 'x+' | 'x-' | 'z+' | 'z-';

const box = (a: V3, b: V3): Box3i => normalizeBox(a, b);

function forBox(b: Box3i, fn: (x: number, y: number, z: number) => void): void {
  for (let y = b.min[1]; y <= b.max[1]; y++)
    for (let z = b.min[2]; z <= b.max[2]; z++) for (let x = b.min[0]; x <= b.max[0]; x++) fn(x, y, z);
}

export function fillBox(vol: VoxelVolume, a: V3, b: V3, id: string | null): void {
  vol.batch(() => forBox(box(a, b), (x, y, z) => vol.set(x, y, z, id)));
}

export function clearBox(vol: VoxelVolume, a: V3, b: V3): void {
  fillBox(vol, a, b, null);
}

/** Four vertical walls of a box (no floor/ceiling). */
export function walls(vol: VoxelVolume, a: V3, b: V3, id: string): void {
  const bb = box(a, b);
  vol.batch(() =>
    forBox(bb, (x, y, z) => {
      if (x === bb.min[0] || x === bb.max[0] || z === bb.min[2] || z === bb.max[2]) vol.set(x, y, z, id);
    }),
  );
}

export interface HollowOptions {
  floor?: string | null;
  ceiling?: string | null;
  /** Clear the interior (default true). */
  clearInside?: boolean;
}

/** Room: walls + optional floor and ceiling, interior cleared. */
export function hollowBox(vol: VoxelVolume, a: V3, b: V3, wallId: string, opts: HollowOptions = {}): void {
  const bb = box(a, b);
  vol.batch(() => {
    if (opts.clearInside !== false) {
      clearBox(vol, [bb.min[0] + 1, bb.min[1] + 1, bb.min[2] + 1], [bb.max[0] - 1, bb.max[1] - 1, bb.max[2] - 1]);
    }
    walls(vol, bb.min, bb.max, wallId);
    const floorId = opts.floor === undefined ? wallId : opts.floor;
    const ceilId = opts.ceiling === undefined ? wallId : opts.ceiling;
    if (floorId) fillBox(vol, [bb.min[0], bb.min[1], bb.min[2]], [bb.max[0], bb.min[1], bb.max[2]], floorId);
    if (ceilId) fillBox(vol, [bb.min[0], bb.max[1], bb.min[2]], [bb.max[0], bb.max[1], bb.max[2]], ceilId);
  });
}

/** Horizontal layer at height y over an XZ rectangle. */
export function floor(vol: VoxelVolume, a: V3, b: V3, y: number, id: string): void {
  const bb = box(a, b);
  fillBox(vol, [bb.min[0], y, bb.min[2]], [bb.max[0], y, bb.max[2]], id);
}

/** Replaces `from` (or any non-air block when null) by `to` inside a box. */
export function replace(vol: VoxelVolume, a: V3, b: V3, from: string | null, to: string | null): number {
  let n = 0;
  vol.batch(() =>
    forBox(box(a, b), (x, y, z) => {
      const cur = vol.get(x, y, z);
      if (from === null ? cur !== AIR_ID : cur === from) {
        if (vol.set(x, y, z, to)) n++;
      }
    }),
  );
  return n;
}

/** 3D line (Bresenham-like, by sampling). */
export function line(vol: VoxelVolume, a: V3, b: V3, id: string | null): void {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]), 1);
  vol.batch(() => {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      vol.set(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), id);
    }
  });
}

/**
 * Staircase climbing one block per step in direction `dir`, `width` blocks wide.
 * With a slab id, half steps are inserted for a smooth walk (no jumping needed).
 */
export function stairs(
  vol: VoxelVolume,
  start: V3,
  dir: Dir4,
  steps: number,
  width: number,
  id: string,
  opts: { slab?: string; fillBelow?: boolean; clearAbove?: number } = {},
): void {
  const [dx, dz] = dirVec(dir);
  // Perpendicular for width.
  const px = dz !== 0 ? 1 : 0;
  const pz = dx !== 0 ? 1 : 0;
  const clearAbove = opts.clearAbove ?? 3;
  vol.batch(() => {
    for (let s = 0; s < steps; s++) {
      for (let w = 0; w < width; w++) {
        const bx = start[0] + dx * s * (opts.slab ? 2 : 1) + px * w;
        const bz = start[2] + dz * s * (opts.slab ? 2 : 1) + pz * w;
        const by = start[1] + s;
        if (opts.slab) {
          // Half step then full step.
          if (opts.fillBelow) for (let y = start[1]; y < by; y++) vol.set(bx, y, bz, id);
          vol.set(bx, by, bz, opts.slab);
          for (let k = 1; k <= clearAbove; k++) vol.set(bx, by + k, bz, null);
          const fx = bx + dx;
          const fz = bz + dz;
          if (opts.fillBelow) for (let y = start[1]; y < by; y++) vol.set(fx, y, fz, id);
          vol.set(fx, by, fz, id);
          for (let k = 1; k <= clearAbove; k++) vol.set(fx, by + k, fz, null);
        } else {
          if (opts.fillBelow) for (let y = start[1]; y < by; y++) vol.set(bx, y, bz, id);
          vol.set(bx, by, bz, id);
          for (let k = 1; k <= clearAbove; k++) vol.set(bx, by + k, bz, null);
        }
      }
    }
  });
}

export function dirVec(dir: Dir4): [number, number] {
  switch (dir) {
    case 'x+':
      return [1, 0];
    case 'x-':
      return [-1, 0];
    case 'z+':
      return [0, 1];
    case 'z-':
      return [0, -1];
  }
}

/**
 * Gable roof over the XZ rectangle [a, b] starting at height `baseY`, ridge along `axis`.
 * Uses full blocks with slab edges; gable ends are filled with `gableId`.
 */
export function gableRoof(
  vol: VoxelVolume,
  a: V3,
  b: V3,
  baseY: number,
  axis: Axis,
  roofId: string,
  opts: { slab?: string; gableId?: string; overhang?: number; ridgeId?: string } = {},
): number {
  const bb = box(a, b);
  const oh = opts.overhang ?? 1;
  const x0 = bb.min[0] - (axis === 'z' ? oh : 0);
  const x1 = bb.max[0] + (axis === 'z' ? oh : 0);
  const z0 = bb.min[2] - (axis === 'x' ? oh : 0);
  const z1 = bb.max[2] + (axis === 'x' ? oh : 0);
  // Span across the ridge.
  const spanMin = axis === 'x' ? z0 : x0;
  const spanMax = axis === 'x' ? z1 : x1;
  const runMin = axis === 'x' ? x0 : z0;
  const runMax = axis === 'x' ? x1 : z1;
  const half = (spanMax - spanMin) / 2;
  let top = baseY;
  vol.batch(() => {
    for (let s = spanMin; s <= spanMax; s++) {
      const fromEdge = Math.min(s - spanMin, spanMax - s);
      const h = baseY + fromEdge;
      top = Math.max(top, h);
      for (let r = runMin; r <= runMax; r++) {
        const x = axis === 'x' ? r : s;
        const z = axis === 'x' ? s : r;
        const isRidge = fromEdge >= Math.floor(half);
        vol.set(x, h, z, isRidge && opts.ridgeId ? opts.ridgeId : roofId);
        // Gable walls at both run ends (inside the building footprint only).
        const atGable = r === (axis === 'x' ? bb.min[0] : bb.min[2]) || r === (axis === 'x' ? bb.max[0] : bb.max[2]);
        const insideSpan = s > (axis === 'x' ? bb.min[2] : bb.min[0]) && s < (axis === 'x' ? bb.max[2] : bb.max[0]);
        if (opts.gableId && atGable && insideSpan) {
          for (let y = baseY; y < h; y++) vol.set(x, y, z, opts.gableId);
        }
      }
    }
  });
  return top;
}

/** Pyramid (hip) roof: concentric rings rising one block per ring. */
export function pyramidRoof(vol: VoxelVolume, a: V3, b: V3, baseY: number, roofId: string, overhang = 1, capId?: string): number {
  const bb = box(a, b);
  let x0 = bb.min[0] - overhang;
  let x1 = bb.max[0] + overhang;
  let z0 = bb.min[2] - overhang;
  let z1 = bb.max[2] + overhang;
  let y = baseY;
  vol.batch(() => {
    while (x0 <= x1 && z0 <= z1) {
      for (let x = x0; x <= x1; x++) {
        vol.set(x, y, z0, roofId);
        vol.set(x, y, z1, roofId);
      }
      for (let z = z0; z <= z1; z++) {
        vol.set(x0, y, z, roofId);
        vol.set(x1, y, z, roofId);
      }
      x0++;
      x1--;
      z0++;
      z1--;
      y++;
    }
    if (capId) vol.set(Math.floor((bb.min[0] + bb.max[0]) / 2), y, Math.floor((bb.min[2] + bb.max[2]) / 2), capId);
  });
  return y;
}

/** Vertical cylinder (tower). */
export function cylinder(
  vol: VoxelVolume,
  center: readonly [number, number],
  radius: number,
  y0: number,
  y1: number,
  id: string | null,
  opts: { hollow?: boolean; thickness?: number } = {},
): void {
  const th = opts.thickness ?? 1;
  vol.batch(() => {
    for (let y = y0; y <= y1; y++) {
      for (let x = Math.floor(center[0] - radius - 1); x <= Math.ceil(center[0] + radius + 1); x++) {
        for (let z = Math.floor(center[1] - radius - 1); z <= Math.ceil(center[1] + radius + 1); z++) {
          const d = Math.hypot(x + 0.5 - center[0], z + 0.5 - center[1]);
          if (d <= radius && (!opts.hollow || d > radius - th)) vol.set(x, y, z, id);
          else if (opts.hollow && d <= radius - th) vol.set(x, y, z, null);
        }
      }
    }
  });
}

/** Cone (round tower roof). */
export function cone(vol: VoxelVolume, center: readonly [number, number], radius: number, baseY: number, height: number, id: string): void {
  vol.batch(() => {
    for (let k = 0; k < height; k++) {
      const r = radius * (1 - k / height);
      for (let x = Math.floor(center[0] - radius - 1); x <= Math.ceil(center[0] + radius + 1); x++) {
        for (let z = Math.floor(center[1] - radius - 1); z <= Math.ceil(center[1] + radius + 1); z++) {
          const d = Math.hypot(x + 0.5 - center[0], z + 0.5 - center[1]);
          if (d <= r + 0.35 && d > r - 1.2) vol.set(x, baseY + k, z, id);
        }
      }
    }
  });
}

/** Sphere / dome. */
export function sphere(vol: VoxelVolume, c: V3, radius: number, id: string | null, opts: { hollow?: boolean; upperHalfOnly?: boolean } = {}): void {
  vol.batch(() => {
    for (let y = Math.floor(c[1] - radius); y <= Math.ceil(c[1] + radius); y++) {
      if (opts.upperHalfOnly && y < c[1]) continue;
      for (let z = Math.floor(c[2] - radius); z <= Math.ceil(c[2] + radius); z++) {
        for (let x = Math.floor(c[0] - radius); x <= Math.ceil(c[0] + radius); x++) {
          const d = Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1], z + 0.5 - c[2]);
          if (d <= radius && (!opts.hollow || d > radius - 1.1)) vol.set(x, y, z, id);
        }
      }
    }
  });
}

/** Rounded arch opening through a wall plane. `axis` is the wall's horizontal direction. */
export function arch(vol: VoxelVolume, base: V3, width: number, height: number, axis: Axis, depth: number, id: string | null = null): void {
  const radius = width / 2;
  vol.batch(() => {
    for (let w = 0; w < width; w++) {
      const cx = w + 0.5 - radius;
      const archTop = height - radius + Math.sqrt(Math.max(0, radius * radius - cx * cx));
      for (let h = 0; h < Math.ceil(archTop); h++) {
        for (let d = 0; d < depth; d++) {
          const x = base[0] + (axis === 'x' ? w : d);
          const z = base[2] + (axis === 'x' ? d : w);
          vol.set(x, base[1] + h, z, id);
        }
      }
    }
  });
}

/** Rectangular opening (doorway / window) cut in a wall, optionally glazed. */
export function opening(vol: VoxelVolume, base: V3, width: number, height: number, axis: Axis, fill: string | null = null, depth = 1): void {
  vol.batch(() => {
    for (let w = 0; w < width; w++)
      for (let h = 0; h < height; h++)
        for (let d = 0; d < depth; d++) {
          const x = base[0] + (axis === 'x' ? w : d);
          const z = base[2] + (axis === 'x' ? d : w);
          vol.set(x, base[1] + h, z, fill);
        }
  });
}

/** Randomly places `id` on top of solid ground in an area (decoration: plants, rubble). */
export function scatter(vol: VoxelVolume, a: V3, b: V3, id: string, density: number, seed: number, onlyOn?: readonly string[]): number {
  const bb = box(a, b);
  const rng = new Rng(seed);
  let n = 0;
  vol.batch(() => {
    for (let z = bb.min[2]; z <= bb.max[2]; z++) {
      for (let x = bb.min[0]; x <= bb.max[0]; x++) {
        if (!rng.chance(density)) continue;
        for (let y = bb.max[1]; y > bb.min[1]; y--) {
          const below = vol.get(x, y - 1, z);
          if (vol.get(x, y, z) === AIR_ID && below !== AIR_ID) {
            if (!onlyOn || onlyOn.includes(below)) {
              vol.set(x, y, z, id);
              n++;
            }
            break;
          }
        }
      }
    }
  });
  return n;
}

/** A copied voxel region (also the payload of structure prefabs). */
export interface VoxelRegion {
  size: [number, number, number];
  palette: string[];
  data: Uint16Array;
}

export function copyRegion(vol: VoxelVolume, a: V3, b: V3): VoxelRegion {
  const bb = box(a, b);
  const size: [number, number, number] = [bb.max[0] - bb.min[0] + 1, bb.max[1] - bb.min[1] + 1, bb.max[2] - bb.min[2] + 1];
  const palette: string[] = [AIR_ID];
  const index = new Map<string, number>([[AIR_ID, 0]]);
  const data = new Uint16Array(size[0] * size[1] * size[2]);
  let i = 0;
  for (let y = 0; y < size[1]; y++)
    for (let z = 0; z < size[2]; z++)
      for (let x = 0; x < size[0]; x++) {
        const id = vol.get(bb.min[0] + x, bb.min[1] + y, bb.min[2] + z);
        let pi = index.get(id);
        if (pi === undefined) {
          pi = palette.length;
          palette.push(id);
          index.set(id, pi);
        }
        data[i++] = pi;
      }
  return { size, palette, data };
}

/** Rotates a region by quarter turns around Y (clockwise seen from above). */
export function rotateRegion(region: VoxelRegion, quarterTurns: number): VoxelRegion {
  const q = ((quarterTurns % 4) + 4) % 4;
  if (q === 0) return region;
  const [sx, sy, sz] = region.size;
  const nsx = q % 2 ? sz : sx;
  const nsz = q % 2 ? sx : sz;
  const out = new Uint16Array(region.data.length);
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        let nx = x;
        let nz = z;
        if (q === 1) {
          nx = sz - 1 - z;
          nz = x;
        } else if (q === 2) {
          nx = sx - 1 - x;
          nz = sz - 1 - z;
        } else if (q === 3) {
          nx = z;
          nz = sx - 1 - x;
        }
        out[nx + nsx * (nz + nsz * y)] = region.data[x + sx * (z + sz * y)]!;
      }
  return { size: [nsx, sy, nsz], palette: [...region.palette], data: out };
}

export function pasteRegion(vol: VoxelVolume, region: VoxelRegion, at: V3, opts: { skipAir?: boolean } = {}): Box3i {
  const [sx, sy, sz] = region.size;
  const skipAir = opts.skipAir ?? true;
  vol.batch(() => {
    let i = 0;
    for (let y = 0; y < sy; y++)
      for (let z = 0; z < sz; z++)
        for (let x = 0; x < sx; x++) {
          const pi = region.data[i++]!;
          if (pi === 0 && skipAir) continue;
          vol.set(at[0] + x, at[1] + y, at[2] + z, pi === 0 ? null : region.palette[pi]!);
        }
  });
  return { min: [at[0], at[1], at[2]], max: [at[0] + sx - 1, at[1] + sy - 1, at[2] + sz - 1] };
}

/** Mirrors a region along X or Z. */
export function mirrorRegion(region: VoxelRegion, axis: Axis): VoxelRegion {
  const [sx, sy, sz] = region.size;
  const out = new Uint16Array(region.data.length);
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const nx = axis === 'x' ? sx - 1 - x : x;
        const nz = axis === 'z' ? sz - 1 - z : z;
        out[nx + sx * (nz + sz * y)] = region.data[x + sx * (z + sz * y)]!;
      }
  return { size: [sx, sy, sz], palette: [...region.palette], data: out };
}

/** Highest non-air cell at (x, z) at or below `fromY` (-1 if none). */
export function surfaceY(vol: VoxelVolume, x: number, z: number, fromY = vol.sizeY - 1): number {
  for (let y = fromY; y >= 0; y--) if (vol.get(x, y, z) !== AIR_ID) return y;
  return -1;
}
