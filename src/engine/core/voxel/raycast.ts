/**
 * Voxel raycasting (Amanatides & Woo DDA) with support for slabs.
 */
import type { VoxelVolume } from './volume';
import { type PaletteInfo, SHAPE_AIR, SHAPE_CROSS, SHAPE_SLAB } from './paletteInfo';
import type { Vec3 } from '../util/math';

export interface VoxelHit {
  x: number;
  y: number;
  z: number;
  /** Outward normal of the face that was hit (integer axis vector). */
  normal: [number, number, number];
  distance: number;
  point: Vec3;
  blockId: string;
}

export interface VoxelRayOptions {
  /** Also hit non-solid decorative blocks (plants). Default false. */
  includeNonSolid?: boolean;
  /** Treat cells outside the volume as empty (default) or stop at the boundary. */
}

export function raycastVoxels(
  volume: VoxelVolume,
  info: PaletteInfo,
  origin: Vec3,
  dir: Vec3,
  maxDistance: number,
  opts: VoxelRayOptions = {},
): VoxelHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len < 1e-9) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
  const frac = (v: number, s: number) => (s > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v));
  let tMaxX = stepX !== 0 ? frac(origin.x, stepX) * tDeltaX : Infinity;
  let tMaxY = stepY !== 0 ? frac(origin.y, stepY) * tDeltaY : Infinity;
  let tMaxZ = stepZ !== 0 ? frac(origin.z, stepZ) * tDeltaZ : Infinity;
  let normal: [number, number, number] = [0, 0, 0];
  let t = 0;
  // Guard against huge loops on degenerate input.
  const maxSteps = Math.ceil(maxDistance * 3) + 3;
  for (let i = 0; i < maxSteps && t <= maxDistance; i++) {
    const p = volume.getIndex(x, y, z);
    const shape = info.shape[p]!;
    if (shape !== SHAPE_AIR && (info.solid[p] || opts.includeNonSolid)) {
      if (shape === SHAPE_SLAB) {
        // Intersect the lower half box of the cell.
        const hit = rayBox(origin, dx, dy, dz, x, y, z, x + 1, y + 0.5, z + 1);
        if (hit && hit.t <= maxDistance) {
          return makeHit(volume, x, y, z, hit.normal, hit.t, origin, dx, dy, dz);
        }
      } else if (shape !== SHAPE_CROSS || opts.includeNonSolid) {
        return makeHit(volume, x, y, z, normal, t, origin, dx, dy, dz);
      }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, -stepZ];
    }
  }
  return null;
}

function makeHit(
  volume: VoxelVolume,
  x: number,
  y: number,
  z: number,
  normal: [number, number, number],
  t: number,
  origin: Vec3,
  dx: number,
  dy: number,
  dz: number,
): VoxelHit {
  return {
    x,
    y,
    z,
    normal,
    distance: t,
    point: { x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t },
    blockId: volume.get(x, y, z),
  };
}

/** Slab-style ray/AABB intersection. Returns entry distance and face normal, or null. */
export function rayBox(
  o: Vec3,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): { t: number; normal: [number, number, number] } | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  let n: [number, number, number] = [0, 0, 0];
  const axes: [number, number, number, number, [number, number, number], [number, number, number]][] = [
    [o.x, dx, minX, maxX, [-1, 0, 0], [1, 0, 0]],
    [o.y, dy, minY, maxY, [0, -1, 0], [0, 1, 0]],
    [o.z, dz, minZ, maxZ, [0, 0, -1], [0, 0, 1]],
  ];
  for (const [oo, d, mn, mx, nMin, nMax] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (oo < mn || oo > mx) return null;
      continue;
    }
    let t1 = (mn - oo) / d;
    let t2 = (mx - oo) / d;
    let n1 = nMin;
    let n2 = nMax;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      [n1, n2] = [n2, n1];
    }
    if (t1 > tMin) {
      tMin = t1;
      n = n1;
    }
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (tMax < 0) return null;
  return { t: Math.max(0, tMin), normal: n };
}
