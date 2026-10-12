import { describe, expect, it } from 'vitest';
import { BlockRegistry } from '../voxel/blocks';
import { VoxelVolume } from '../voxel/volume';
import { PaletteInfo } from '../voxel/paletteInfo';
import { fillBox, hollowBox, stairs } from '../voxel/construct';
import { ColliderSet } from '../physics/colliders';
import { CollisionWorld } from '../physics/collision';
import { aabb } from '../physics/aabb';
import { findPath, simplifyPath } from './pathfinder';

function setup() {
  const reg = new BlockRegistry();
  reg.register({ id: 't:stone', label: 'Pierre', textures: { all: { gen: 'stone', colors: ['#888888'] } } }, 't');
  reg.register({ id: 't:slab', label: 'Dalle', shape: 'slab', textures: { all: { gen: 'stone', colors: ['#888888'] } } }, 't');
  const vol = new VoxelVolume(40, 20, 40);
  fillBox(vol, [0, 0, 0], [39, 0, 39], 't:stone');
  let info = new PaletteInfo(vol.palette, reg);
  const colliders = new ColliderSet();
  const world = new CollisionWorld(vol, () => (info = PaletteInfo.sync(info, vol, reg)), colliders);
  return { vol, world, colliders };
}

describe('pathfinder', () => {
  it('walks around a room through its doorway', () => {
    const { vol, world } = setup();
    hollowBox(vol, [10, 1, 10], [20, 5, 20], 't:stone', { floor: null, ceiling: 't:stone' });
    vol.set(10, 1, 15, null);
    vol.set(10, 2, 15, null);
    const path = findPath(world, { x: 3.5, y: 1, z: 3.5 }, { x: 15.5, y: 1, z: 15.5 });
    expect(path).not.toBeNull();
    expect(path!.some((p) => Math.floor(p.x) === 10 && Math.floor(p.z) === 15)).toBe(true);
    expect(simplifyPath(path!).length).toBeLessThanOrEqual(path!.length);
  });

  it('climbs slab stairs but not a sheer wall, and respects colliders', () => {
    const { vol, world, colliders } = setup();
    fillBox(vol, [20, 1, 0], [39, 4, 39], 't:stone');
    expect(findPath(world, { x: 5.5, y: 1, z: 5.5 }, { x: 25.5, y: 5, z: 5.5 })).toBeNull();
    stairs(vol, [12, 1, 5], 'x+', 4, 1, 't:stone', { slab: 't:slab', fillBelow: true });
    const path = findPath(world, { x: 5.5, y: 1, z: 5.5 }, { x: 25.5, y: 5, z: 5.5 });
    expect(path).not.toBeNull();
    // A closed door collider across the stairs blocks the path again.
    colliders.set({ id: 'door', owner: 'door', box: aabb(10, 1, 0, 10.2, 4, 40), solid: true, pickable: true, enabled: true });
    expect(findPath(world, { x: 5.5, y: 1, z: 5.5 }, { x: 25.5, y: 5, z: 5.5 })).toBeNull();
  });
});
