/**
 * Collision world: voxel grid + entity colliders.
 *
 * Movement is resolved axis by axis (Y, then X, then Z) by clipping the displacement against
 * every solid box in the swept volume — the robust approach used by most voxel games.
 * Volume borders act as invisible walls and the floor of the world is solid.
 */
import type { AABB } from './aabb';
import { offsetBox, sweptBox, overlaps } from './aabb';
import type { ColliderSet } from './colliders';
import type { VoxelVolume } from '../voxel/volume';
import { type PaletteInfo, SHAPE_SLAB } from '../voxel/paletteInfo';

export interface MoveResult {
  dx: number;
  dy: number;
  dz: number;
  hitX: boolean;
  hitY: boolean;
  hitZ: boolean;
}

const EPS = 1e-7;

export class CollisionWorld {
  private scratch: AABB[] = [];

  constructor(
    private volume: VoxelVolume | null,
    private infoProvider: () => PaletteInfo | null,
    readonly colliders: ColliderSet,
    /** Invisible walls at the volume borders (default true). */
    public borderWalls = true,
  ) {}

  setVolume(volume: VoxelVolume | null): void {
    this.volume = volume;
  }

  /** Collects solid boxes overlapping `box`. */
  gather(box: AABB, out: AABB[], ignoreOwner?: string): void {
    const vol = this.volume;
    const info = this.infoProvider();
    if (vol && info) {
      const x0 = Math.floor(box.minX);
      const y0 = Math.floor(box.minY);
      const z0 = Math.floor(box.minZ);
      const x1 = Math.floor(box.maxX - EPS);
      const y1 = Math.floor(box.maxY - EPS);
      const z1 = Math.floor(box.maxZ - EPS);
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          for (let x = x0; x <= x1; x++) {
            if (y < 0) {
              out.push({ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 1 });
              continue;
            }
            if (x < 0 || z < 0 || x >= vol.sizeX || z >= vol.sizeZ) {
              if (this.borderWalls) out.push({ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 1 });
              continue;
            }
            if (y >= vol.sizeY) continue;
            const p = vol.data[x + vol.sizeX * (z + vol.sizeZ * y)]!;
            if (!info.solid[p]) continue;
            const top = info.shape[p] === SHAPE_SLAB ? y + 0.5 : y + 1;
            out.push({ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: top, maxZ: z + 1 });
          }
        }
      }
    }
    this.colliders.querySolid(box, out, ignoreOwner);
  }

  /** True if `box` intersects any solid geometry. */
  isBlocked(box: AABB, ignoreOwner?: string): boolean {
    const list = this.scratch;
    list.length = 0;
    this.gather(box, list, ignoreOwner);
    for (const b of list) if (overlaps(box, b, 1e-5)) return true;
    return false;
  }

  /** Moves `box` by the displacement with sliding. Returns the applied displacement. */
  move(box: AABB, dx: number, dy: number, dz: number, ignoreOwner?: string): MoveResult {
    const list = this.scratch;
    list.length = 0;
    this.gather(sweptBox(box, dx, dy, dz), list, ignoreOwner);
    let cur = box;
    const ody = dy;
    for (const b of list) dy = clipY(b, cur, dy);
    cur = offsetBox(cur, 0, dy, 0);
    const odx = dx;
    for (const b of list) dx = clipX(b, cur, dx);
    cur = offsetBox(cur, dx, 0, 0);
    const odz = dz;
    for (const b of list) dz = clipZ(b, cur, dz);
    return { dx, dy, dz, hitX: dx !== odx, hitY: dy !== ody, hitZ: dz !== odz };
  }
}

function clipY(b: AABB, a: AABB, dy: number): number {
  if (a.maxX <= b.minX + EPS || a.minX >= b.maxX - EPS || a.maxZ <= b.minZ + EPS || a.minZ >= b.maxZ - EPS) return dy;
  if (dy > 0 && a.maxY <= b.minY + EPS) {
    const d = b.minY - a.maxY;
    if (d < dy) dy = Math.max(0, d);
  } else if (dy < 0 && a.minY >= b.maxY - EPS) {
    const d = b.maxY - a.minY;
    if (d > dy) dy = Math.min(0, d);
  }
  return dy;
}

function clipX(b: AABB, a: AABB, dx: number): number {
  if (a.maxY <= b.minY + EPS || a.minY >= b.maxY - EPS || a.maxZ <= b.minZ + EPS || a.minZ >= b.maxZ - EPS) return dx;
  if (dx > 0 && a.maxX <= b.minX + EPS) {
    const d = b.minX - a.maxX;
    if (d < dx) dx = Math.max(0, d);
  } else if (dx < 0 && a.minX >= b.maxX - EPS) {
    const d = b.maxX - a.minX;
    if (d > dx) dx = Math.min(0, d);
  }
  return dx;
}

function clipZ(b: AABB, a: AABB, dz: number): number {
  if (a.maxY <= b.minY + EPS || a.minY >= b.maxY - EPS || a.maxX <= b.minX + EPS || a.minX >= b.maxX - EPS) return dz;
  if (dz > 0 && a.maxZ <= b.minZ + EPS) {
    const d = b.minZ - a.maxZ;
    if (d < dz) dz = Math.max(0, d);
  } else if (dz < 0 && a.minZ >= b.maxZ - EPS) {
    const d = b.maxZ - a.minZ;
    if (d > dz) dz = Math.min(0, d);
  }
  return dz;
}
