/**
 * Runtime state of the loaded scene: voxels, baked light, colliders, entities and runtime voxel
 * edits. Behavior instantiation lives in sim/behaviorSystem.ts.
 */
import type { SceneDoc } from '../content/schemas';
import type { BlockRegistry } from '../voxel/blocks';
import { AIR_ID } from '../voxel/blocks';
import type { VoxelVolume, Box3i } from '../voxel/volume';
import { unionBox } from '../voxel/volume';
import { PaletteInfo } from '../voxel/paletteInfo';
import { LightField, type PointLightSource } from '../voxel/light';
import { ColliderSet } from '../physics/colliders';
import { CollisionWorld } from '../physics/collision';
import { rotatedBounds, type AABB } from '../physics/aabb';
import { volumeFromDoc } from './sceneVoxels';
import type { RuntimeEntity, ColliderPart } from './entity';
import type { Vec3 } from '../util/math';
import { hexToRgb } from '../util/color';

export interface EntityLight {
  entityId: string;
  /** Offset from the entity position (meters). */
  offset: [number, number, number];
  level: number;
  color: string;
}

export class SceneWorld {
  readonly id: string;
  readonly volume: VoxelVolume;
  readonly light: LightField;
  readonly colliders = new ColliderSet();
  readonly collision: CollisionWorld;
  readonly entities = new Map<string, RuntimeEntity>();
  /** Runtime voxel edits relative to the scene document (cell index → block id). */
  readonly voxelEdits = new Map<number, string | null>();
  readonly removedEntities = new Set<string>();
  private info: PaletteInfo;
  private pendingLight: Box3i | null = null;
  private entityLights = new Map<string, EntityLight[]>();
  private lightSourcesDirty = false;
  /** Incremented when entities are added/removed (view sync). */
  entitiesRevision = 0;
  private voxelListeners = new Set<(box: Box3i) => void>();

  constructor(
    readonly doc: SceneDoc,
    private readonly blocks: BlockRegistry,
  ) {
    this.id = doc.id;
    this.volume = volumeFromDoc(doc.voxels);
    this.info = new PaletteInfo(this.volume.palette, blocks);
    this.light = new LightField(this.volume);
    this.collision = new CollisionWorld(this.volume, () => this.paletteInfo(), this.colliders);
    this.volume.onChange((box) => {
      this.pendingLight = this.pendingLight ? unionBox(this.pendingLight, box) : box;
      for (const l of this.voxelListeners) l(box);
    });
  }

  paletteInfo(): PaletteInfo {
    this.info = PaletteInfo.sync(this.info, this.volume, this.blocks);
    return this.info;
  }

  /** Full light computation (scene load). */
  computeLight(): void {
    this.applyLightSources();
    this.light.computeAll(this.paletteInfo());
    this.pendingLight = null;
    this.lightSourcesDirty = false;
  }

  /**
   * Applies pending light updates (voxel edits, moved/toggled light sources). Returns the
   * recomputed region (for re-meshing) or null.
   */
  flushLight(): Box3i | null {
    let region: Box3i | null = null;
    if (this.lightSourcesDirty) {
      const before = this.light.getSources();
      this.applyLightSources();
      const after = this.light.getSources();
      for (const s of [...before, ...after]) {
        const b: Box3i = { min: [s.x, s.y, s.z], max: [s.x, s.y, s.z] };
        this.pendingLight = this.pendingLight ? unionBox(this.pendingLight, b) : b;
      }
      this.lightSourcesDirty = false;
    }
    if (this.pendingLight) {
      region = this.light.update(this.paletteInfo(), this.pendingLight);
      this.pendingLight = null;
    }
    return region;
  }

  onVoxelsChanged(cb: (box: Box3i) => void): () => void {
    this.voxelListeners.add(cb);
    return () => this.voxelListeners.delete(cb);
  }

  setEntityLights(entityId: string, lights: EntityLight[]): void {
    if (lights.length === 0) this.entityLights.delete(entityId);
    else this.entityLights.set(entityId, lights);
    this.lightSourcesDirty = true;
  }

  private applyLightSources(): void {
    const sources: PointLightSource[] = [];
    for (const [entityId, lights] of this.entityLights) {
      const e = this.entities.get(entityId);
      if (!e || !e.visible || !e.enabled) continue;
      for (const l of lights) {
        const c = hexToRgb(l.color);
        const m = Math.max(c.r, c.g, c.b) || 1;
        const lvl = Math.max(0, Math.min(15, l.level));
        sources.push({
          x: Math.floor(e.position.x + l.offset[0]),
          y: Math.floor(e.position.y + l.offset[1]),
          z: Math.floor(e.position.z + l.offset[2]),
          r: (lvl * c.r) / m,
          g: (lvl * c.g) / m,
          b: (lvl * c.b) / m,
        });
      }
    }
    this.light.setSources(sources);
  }

  markLightSourcesDirty(): void {
    this.lightSourcesDirty = true;
  }

  /** Runtime voxel edit, recorded for saves. */
  setBlock(x: number, y: number, z: number, id: string | null): void {
    if (!this.volume.inBounds(x, y, z)) return;
    const value = id === AIR_ID ? null : id;
    if (this.volume.set(x, y, z, value)) this.voxelEdits.set(this.volume.index(x, y, z), value);
  }

  /** Batched runtime edit of a box (inclusive corners). */
  fillBlocks(from: readonly [number, number, number], to: readonly [number, number, number], id: string | null): void {
    const x0 = Math.min(from[0], to[0]);
    const x1 = Math.max(from[0], to[0]);
    const y0 = Math.min(from[1], to[1]);
    const y1 = Math.max(from[1], to[1]);
    const z0 = Math.min(from[2], to[2]);
    const z1 = Math.max(from[2], to[2]);
    this.volume.batch(() => {
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.setBlock(x, y, z, id);
    });
  }

  addEntity(e: RuntimeEntity): void {
    this.entities.set(e.id, e);
    this.entitiesRevision++;
  }

  removeEntity(id: string): RuntimeEntity | undefined {
    const e = this.entities.get(id);
    if (!e) return undefined;
    this.entities.delete(id);
    this.colliders.removeOwner(id);
    if (this.entityLights.delete(id)) this.lightSourcesDirty = true;
    if (!e.spawned) this.removedEntities.add(id);
    this.entitiesRevision++;
    return e;
  }

  /** Updates (or creates/removes) a collider part of an entity. */
  setCollider(e: RuntimeEntity, part: string, local: AABB | null, opts: { solid?: boolean; pickable?: boolean } = {}): void {
    const colliderId = `${e.id}#${part}`;
    if (!local) {
      e.colliderParts.delete(part);
      this.colliders.remove(colliderId);
      return;
    }
    const cp: ColliderPart = { local: { ...local }, solid: opts.solid ?? true, pickable: opts.pickable ?? true };
    e.colliderParts.set(part, cp);
    this.colliders.set({
      id: colliderId,
      owner: e.id,
      box: rotatedBounds(e.position.x, e.position.y, e.position.z, cp.local, e.yaw),
      solid: cp.solid,
      pickable: cp.pickable,
      enabled: e.visible && e.enabled,
    });
  }

  /** Recomputes an entity's collider boxes after it moved/rotated or changed visibility. */
  syncColliders(e: RuntimeEntity): void {
    for (const [part, cp] of e.colliderParts) {
      const id = `${e.id}#${part}`;
      this.colliders.updateBox(id, rotatedBounds(e.position.x, e.position.y, e.position.z, cp.local, e.yaw));
      this.colliders.setEnabled(id, e.visible && e.enabled);
    }
    if (this.entityLights.has(e.id)) this.lightSourcesDirty = true;
  }

  /** Ground height near a position (for spawning/teleport), or null. */
  groundAt(x: number, z: number, nearY: number): number | null {
    const info = this.paletteInfo();
    const vx = Math.floor(x);
    const vz = Math.floor(z);
    for (let y = Math.min(this.volume.sizeY - 1, Math.floor(nearY) + 2); y >= 0; y--) {
      const p = this.volume.getIndex(vx, y, vz);
      if (info.solid[p]) return info.shape[p] === 2 ? y + 0.5 : y + 1;
    }
    return null;
  }

  entityAt(p: Vec3, radius: number): RuntimeEntity[] {
    const out: RuntimeEntity[] = [];
    for (const e of this.entities.values()) {
      if (Math.hypot(e.position.x - p.x, e.position.y - p.y, e.position.z - p.z) <= radius) out.push(e);
    }
    return out;
  }
}
