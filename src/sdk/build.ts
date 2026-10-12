/**
 * World-building SDK: voxel volumes, the construction kit and scene document helpers.
 *
 * Used by world seed scripts (`civilizations/<id>/seed/*.ts`, run with `npm run civ -- seed <id>`)
 * and by Civilization Studio's building tools. A seed generates the first version of a scene;
 * afterwards the JSON file is the source of truth and is edited in the Studio.
 *
 *   const b = new SceneBuilder('verrou', 'door.scene.verrou', [96, 64, 112], ENV);
 *   fillBox(b.volume, [0, 0, 0], [95, 7, 111], 'core:stone');
 *   b.entity('cell_door', [12.5, 8, 30], { 'core.door': { model: 'door:door_handleless' } }, { yaw: 90 });
 *   return b.build();
 */
import { VoxelVolume } from '../engine/core/voxel/volume';
import { volumeToDoc } from '../engine/core/world/sceneVoxels';
import type { EntityDoc, EnvironmentDoc, SceneDoc } from '../engine/core/content/schemas';

export { VoxelVolume, type Box3i } from '../engine/core/voxel/volume';
export * from '../engine/core/voxel/construct';
export { volumeToDoc, volumeFromDoc } from '../engine/core/world/sceneVoxels';
export { AIR_ID } from '../engine/core/voxel/blocks';
export type { SceneDoc, EntityDoc, EnvironmentDoc, CinematicDoc, CinematicTrackDoc } from '../engine/core/content/schemas';
export { Rng } from '../engine/core/util/rng';

export type Vec3Tuple = [number, number, number];

export interface EntityOptions {
  /** Rotation around Y in degrees. */
  yaw?: number;
  name?: string;
  folder?: string;
  tags?: string[];
  scale?: Vec3Tuple;
}

/** Accumulates voxels and entities, then produces a scene document. */
export class SceneBuilder {
  readonly volume: VoxelVolume;
  private entities: EntityDoc[] = [];
  private ids = new Set<string>();
  /** Current hierarchy folder applied to new entities (Studio "Hiérarchie"). */
  folder: string | undefined;

  constructor(
    readonly id: string,
    readonly nameKey: string,
    size: Vec3Tuple,
    readonly environment: EnvironmentDoc,
  ) {
    this.volume = new VoxelVolume(size[0], size[1], size[2]);
  }

  /** Runs `fn` with entities grouped under a hierarchy folder. */
  inFolder(folder: string, fn: () => void): void {
    const prev = this.folder;
    this.folder = folder;
    try {
      fn();
    } finally {
      this.folder = prev;
    }
  }

  entity(id: string, position: Vec3Tuple, components: Record<string, Record<string, unknown>>, opts: EntityOptions = {}): EntityDoc {
    if (this.ids.has(id)) throw new Error(`Identifiant d'entité en double : ${id}`);
    this.ids.add(id);
    const doc: EntityDoc = {
      id,
      position: [round(position[0]), round(position[1]), round(position[2])],
      components,
    };
    if (opts.name) doc.name = opts.name;
    if (opts.yaw) doc.rotation = [0, opts.yaw, 0];
    if (opts.scale) doc.scale = opts.scale;
    if (opts.tags) doc.tags = opts.tags;
    const folder = opts.folder ?? this.folder;
    if (folder) doc.folder = folder;
    this.entities.push(doc);
    return doc;
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  build(editor?: SceneDoc['editor']): SceneDoc {
    return {
      format: 'civverse.scene',
      version: 1,
      id: this.id,
      name: this.nameKey,
      environment: this.environment,
      voxels: volumeToDoc(this.volume),
      entities: this.entities,
      ...(editor ? { editor } : {}),
    };
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export * from './buildKit';
