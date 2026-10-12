/**
 * Non-voxel colliders (doors, props, NPC bodies, invisible walls, interaction volumes).
 *
 * Logical collision is independent from visual meshes: entities register boxes here, the
 * renderer can draw anything. The set is small (hundreds), so queries are brute force.
 */
import type { AABB } from './aabb';
import { overlaps } from './aabb';
import { rayBox } from '../voxel/raycast';
import type { Vec3 } from '../util/math';

export interface ColliderEntry {
  /** Unique collider id (usually "<entityId>" or "<entityId>#<part>"). */
  id: string;
  /** Owning entity id. */
  owner: string;
  box: AABB;
  /** Blocks movement. */
  solid: boolean;
  /** Can be targeted by the interaction ray. */
  pickable: boolean;
  /** Disabled colliders are ignored (hidden entities). */
  enabled: boolean;
}

export interface ColliderHit {
  entry: ColliderEntry;
  distance: number;
  point: Vec3;
  normal: [number, number, number];
}

export class ColliderSet {
  private entries = new Map<string, ColliderEntry>();
  private _revision = 0;

  get revision(): number {
    return this._revision;
  }

  get size(): number {
    return this.entries.size;
  }

  set(entry: ColliderEntry): void {
    this.entries.set(entry.id, { ...entry, box: { ...entry.box } });
    this._revision++;
  }

  updateBox(id: string, box: AABB): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.box = { ...box };
    this._revision++;
  }

  setEnabled(id: string, enabled: boolean): void {
    const e = this.entries.get(id);
    if (e && e.enabled !== enabled) {
      e.enabled = enabled;
      this._revision++;
    }
  }

  setSolid(id: string, solid: boolean): void {
    const e = this.entries.get(id);
    if (e && e.solid !== solid) {
      e.solid = solid;
      this._revision++;
    }
  }

  get(id: string): ColliderEntry | undefined {
    return this.entries.get(id);
  }

  remove(id: string): void {
    if (this.entries.delete(id)) this._revision++;
  }

  removeOwner(owner: string): void {
    for (const [id, e] of [...this.entries]) if (e.owner === owner) this.entries.delete(id);
    this._revision++;
  }

  all(): IterableIterator<ColliderEntry> {
    return this.entries.values();
  }

  /** Solid boxes overlapping `box`, excluding colliders owned by `ignoreOwner`. */
  querySolid(box: AABB, out: AABB[], ignoreOwner?: string): void {
    for (const e of this.entries.values()) {
      if (!e.enabled || !e.solid || e.owner === ignoreOwner) continue;
      if (overlaps(e.box, box)) out.push(e.box);
    }
  }

  overlapping(box: AABB, filter?: (e: ColliderEntry) => boolean): ColliderEntry[] {
    const out: ColliderEntry[] = [];
    for (const e of this.entries.values()) {
      if (!e.enabled) continue;
      if (filter && !filter(e)) continue;
      if (overlaps(e.box, box)) out.push(e);
    }
    return out;
  }

  raycast(origin: Vec3, dir: Vec3, maxDistance: number, filter?: (e: ColliderEntry) => boolean): ColliderHit | null {
    const len = Math.hypot(dir.x, dir.y, dir.z);
    if (len < 1e-9) return null;
    const dx = dir.x / len;
    const dy = dir.y / len;
    const dz = dir.z / len;
    let best: ColliderHit | null = null;
    for (const e of this.entries.values()) {
      if (!e.enabled) continue;
      if (filter && !filter(e)) continue;
      const b = e.box;
      const hit = rayBox(origin, dx, dy, dz, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
      if (!hit || hit.t > maxDistance) continue;
      if (!best || hit.t < best.distance) {
        best = {
          entry: e,
          distance: hit.t,
          point: { x: origin.x + dx * hit.t, y: origin.y + dy * hit.t, z: origin.z + dz * hit.t },
          normal: hit.normal,
        };
      }
    }
    return best;
  }
}
