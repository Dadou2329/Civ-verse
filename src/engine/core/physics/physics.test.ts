import { describe, expect, it } from 'vitest';
import { BlockRegistry } from '../voxel/blocks';
import { VoxelVolume } from '../voxel/volume';
import { PaletteInfo } from '../voxel/paletteInfo';
import { fillBox } from '../voxel/construct';
import { ColliderSet } from './colliders';
import { CollisionWorld } from './collision';
import { DEFAULT_MOVEMENT, KinematicBody } from './body';
import { aabb } from './aabb';

function setup() {
  const reg = new BlockRegistry();
  reg.register({ id: 't:stone', label: 'Pierre', textures: { all: { gen: 'stone', colors: ['#888888'] } } }, 't');
  reg.register({ id: 't:slab', label: 'Dalle', shape: 'slab', textures: { all: { gen: 'stone', colors: ['#888888'] } } }, 't');
  const vol = new VoxelVolume(32, 16, 32);
  fillBox(vol, [0, 0, 0], [31, 0, 31], 't:stone');
  let info = new PaletteInfo(vol.palette, reg);
  const colliders = new ColliderSet();
  const world = new CollisionWorld(vol, () => (info = PaletteInfo.sync(info, vol, reg)), colliders);
  return { vol, world, colliders };
}

const idle = { wishX: 0, wishZ: 0, sprint: false, jump: false };
function simulate(body: KinematicBody, world: CollisionWorld, seconds: number, input = idle) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(body.step(world, input, 1 / 60));
  return events;
}

describe('kinematic body', () => {
  it('falls and lands on the ground', () => {
    const { world } = setup();
    const body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', { x: 5.5, y: 5, z: 5.5 });
    const events = simulate(body, world, 2);
    expect(body.grounded).toBe(true);
    expect(body.position.y).toBeCloseTo(1, 5);
    expect(events.some((e) => e.landed !== null)).toBe(true);
  });

  it('walks, accelerates smoothly and is stopped by walls', () => {
    const { vol, world } = setup();
    fillBox(vol, [10, 1, 0], [10, 3, 31], 't:stone');
    const body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', { x: 5.5, y: 1, z: 5.5 });
    body.step(world, { ...idle, wishX: 1 }, 1 / 60);
    expect(body.velocity.x).toBeGreaterThan(0);
    expect(body.velocity.x).toBeLessThan(DEFAULT_MOVEMENT.walkSpeed);
    simulate(body, world, 3, { ...idle, wishX: 1 });
    expect(body.position.x).toBeCloseTo(10 - DEFAULT_MOVEMENT.width / 2, 3);
  });

  it('steps up slabs and full stair steps of half blocks without jumping', () => {
    const { vol, world } = setup();
    vol.set(8, 1, 5, 't:slab');
    fillBox(vol, [9, 1, 0], [31, 1, 31], 't:stone');
    const body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', { x: 5.5, y: 1, z: 5.5 });
    simulate(body, world, 2, { ...idle, wishX: 1 });
    expect(body.position.x).toBeGreaterThan(9.5);
    expect(body.position.y).toBeCloseTo(2, 3);
  });

  it('cannot walk up a full block but can jump onto it', () => {
    const { vol, world } = setup();
    fillBox(vol, [8, 1, 0], [31, 1, 31], 't:stone');
    const body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', { x: 5.5, y: 1, z: 5.5 });
    simulate(body, world, 1.5, { ...idle, wishX: 1 });
    expect(body.position.x).toBeLessThan(8);
    body.step(world, { ...idle, wishX: 1, jump: true }, 1 / 60);
    simulate(body, world, 1, { ...idle, wishX: 1 });
    expect(body.position.y).toBeCloseTo(2, 3);
    expect(body.position.x).toBeGreaterThan(8);
  });

  it('jump reaches roughly 1.35 blocks', () => {
    const { world } = setup();
    const body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', { x: 5.5, y: 1, z: 5.5 });
    simulate(body, world, 0.5);
    let maxY = 0;
    body.step(world, { ...idle, jump: true }, 1 / 60);
    for (let i = 0; i < 90; i++) {
      body.step(world, idle, 1 / 60);
      maxY = Math.max(maxY, body.position.y);
    }
    expect(maxY - 1).toBeGreaterThan(1.2);
    expect(maxY - 1).toBeLessThan(1.6);
  });

  it('collides with entity colliders but ignores its own', () => {
    const { world, colliders } = setup();
    colliders.set({ id: 'door', owner: 'door', box: aabb(8, 1, 0, 8.2, 3, 32), solid: true, pickable: true, enabled: true });
    colliders.set({ id: 'self', owner: 'player', box: aabb(5, 1, 5, 6, 3, 6), solid: true, pickable: false, enabled: true });
    const body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', { x: 5.5, y: 1, z: 5.5 });
    simulate(body, world, 2, { ...idle, wishX: 1 });
    expect(body.position.x).toBeCloseTo(8 - 0.3, 3);
    colliders.setEnabled('door', false);
    simulate(body, world, 1, { ...idle, wishX: 1 });
    expect(body.position.x).toBeGreaterThan(9);
  });
});
