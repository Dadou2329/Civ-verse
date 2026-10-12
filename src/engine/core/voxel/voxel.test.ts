import { describe, expect, it } from 'vitest';
import { BlockRegistry, AIR_ID } from './blocks';
import { VoxelVolume } from './volume';
import { decodeRle, encodeRle, base64ToBytes, bytesToBase64 } from './codec';
import { PaletteInfo } from './paletteInfo';
import { LightField } from './light';
import { buildAtlas } from './textures/atlas';
import { meshChunk } from './mesher';
import { raycastVoxels } from './raycast';
import { copyRegion, fillBox, gableRoof, hollowBox, pasteRegion, rotateRegion, stairs } from './construct';
import { listTextureGenerators, generateTile } from './textures/generators';

function registry(): BlockRegistry {
  const r = new BlockRegistry();
  r.register({ id: 'test:stone', label: 'Pierre', textures: { all: { gen: 'stone', colors: ['#808080'] } } }, 'test');
  r.register({ id: 'test:slab', label: 'Dalle', shape: 'slab', textures: { all: { gen: 'stone', colors: ['#707070'] } } }, 'test');
  r.register({ id: 'test:glass', label: 'Verre', transparency: 'blend', textures: { all: { gen: 'glass', colors: ['#aaccff', '#444444'] } } }, 'test');
  r.register({ id: 'test:lamp', label: 'Lampe', emissive: true, light: { level: 14, color: '#ffaa55' }, textures: { all: { gen: 'lamp', colors: ['#ffcc88', '#333333'] } } }, 'test');
  return r;
}

describe('voxel codec', () => {
  it('round-trips RLE data and base64', () => {
    const data = new Uint16Array(5000);
    for (let i = 0; i < data.length; i++) data[i] = i % 97 < 50 ? 0 : (i % 7) + 1;
    data[4999] = 300;
    const encoded = encodeRle(data);
    expect(decodeRle(encoded, data.length)).toEqual(data);
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 255, 7]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('rejects inconsistent lengths', () => {
    const encoded = encodeRle(new Uint16Array(10));
    expect(() => decodeRle(encoded, 11)).toThrow();
  });
});

describe('volume', () => {
  it('stores blocks through a palette and compacts it', () => {
    const v = new VoxelVolume(8, 8, 8);
    v.set(1, 2, 3, 'test:stone');
    v.set(2, 2, 3, 'test:glass');
    expect(v.get(1, 2, 3)).toBe('test:stone');
    v.set(2, 2, 3, null);
    expect(v.compactPalette()).toBe(1);
    expect(v.palette).toEqual([AIR_ID, 'test:stone']);
    expect(v.get(1, 2, 3)).toBe('test:stone');
  });

  it('batches change notifications', () => {
    const v = new VoxelVolume(8, 8, 8);
    const boxes: unknown[] = [];
    v.onChange((b) => boxes.push(b));
    fillBox(v, [0, 0, 0], [3, 0, 3], 'test:stone');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toEqual({ min: [0, 0, 0], max: [3, 0, 3] });
  });
});

describe('lighting', () => {
  it('lights open air with sky light and darkens a closed room', () => {
    const reg = registry();
    const v = new VoxelVolume(16, 12, 16);
    fillBox(v, [0, 0, 0], [15, 0, 15], 'test:stone');
    hollowBox(v, [4, 1, 4], [10, 6, 10], 'test:stone');
    const info = new PaletteInfo(v.palette, reg);
    const light = new LightField(v);
    light.computeAll(info);
    expect(light.sample(1, 1, 1)[0]).toBe(1);
    expect(light.sample(7, 3, 7)[0]).toBe(0);
    // Opening a doorway (the room floor is at y=1, interior air starts at y=2) lets sky light in.
    v.set(4, 2, 7, null);
    v.set(4, 3, 7, null);
    light.update(new PaletteInfo(v.palette, reg), { min: [4, 2, 7], max: [4, 3, 7] });
    expect(light.sample(5, 2, 7)[0]).toBeGreaterThan(0.8);
    expect(light.sample(7, 3, 7)[0]).toBeGreaterThan(0);
    // Closing it again restores darkness (region recompute removes stale light).
    v.set(4, 2, 7, 'test:stone');
    v.set(4, 3, 7, 'test:stone');
    light.update(new PaletteInfo(v.palette, reg), { min: [4, 2, 7], max: [4, 3, 7] });
    expect(light.sample(7, 3, 7)[0]).toBe(0);
  });

  it('propagates colored block light from emissive blocks', () => {
    const reg = registry();
    const v = new VoxelVolume(16, 8, 16);
    hollowBox(v, [0, 0, 0], [15, 7, 15], 'test:stone');
    v.set(8, 1, 8, 'test:lamp');
    const info = new PaletteInfo(v.palette, reg);
    const light = new LightField(v);
    light.computeAll(info);
    const near = light.sample(8, 2, 8);
    const far = light.sample(2, 1, 2);
    expect(near[1]).toBeGreaterThan(far[1]);
    expect(near[1]).toBeGreaterThan(near[3]); // orange: more red than blue
  });
});

describe('mesher', () => {
  const reg = registry();

  function mesh(v: VoxelVolume) {
    const info = new PaletteInfo(v.palette, reg);
    const specs = info.defs.flatMap((d) => [BlockRegistry.faceTexture(d, 0), BlockRegistry.faceTexture(d, 2), BlockRegistry.faceTexture(d, 3)]);
    const atlas = buildAtlas(specs);
    const light = new LightField(v);
    light.computeAll(info);
    return meshChunk({ volume: v, info, atlas, light }, 0, 0, 0);
  }

  it('emits only visible faces with Babylon front-face winding', () => {
    const v = new VoxelVolume(16, 16, 16);
    v.set(5, 5, 5, 'test:stone');
    v.set(6, 5, 5, 'test:stone');
    const m = mesh(v);
    const opaque = m.layers.opaque!;
    // Two cubes sharing one face: 10 visible faces × 4 vertices.
    expect(opaque.vertexCount).toBe(40);
    for (let t = 0; t < opaque.indices.length; t += 3) {
      const [a, b, c] = [opaque.indices[t]!, opaque.indices[t + 1]!, opaque.indices[t + 2]!];
      const p = (i: number) => [opaque.positions[i * 3]!, opaque.positions[i * 3 + 1]!, opaque.positions[i * 3 + 2]!];
      const [pa, pb, pc] = [p(a), p(b), p(c)];
      const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!];
      const w = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
      const cross = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
      const n = [opaque.normals[a * 3]!, opaque.normals[a * 3 + 1]!, opaque.normals[a * 3 + 2]!];
      expect(cross[0]! * n[0]! + cross[1]! * n[1]! + cross[2]! * n[2]!).toBeLessThan(0);
    }
  });

  it('puts transparent and emissive blocks in their own layers', () => {
    const v = new VoxelVolume(16, 16, 16);
    v.set(1, 1, 1, 'test:glass');
    v.set(3, 1, 1, 'test:lamp');
    v.set(5, 1, 1, 'test:slab');
    const m = mesh(v);
    expect(m.layers.translucent?.vertexCount).toBe(24);
    expect(m.layers.emissive?.vertexCount).toBe(24);
    const slab = m.layers.opaque!;
    expect(Math.max(...Array.from(slab.positions).filter((_, i) => i % 3 === 1))).toBe(1.5);
  });
});

describe('raycast', () => {
  it('hits the first solid block and reports the face normal', () => {
    const reg = registry();
    const v = new VoxelVolume(16, 16, 16);
    v.set(8, 2, 3, 'test:stone');
    const info = new PaletteInfo(v.palette, reg);
    const hit = raycastVoxels(v, info, { x: 8.5, y: 2.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10);
    expect(hit).not.toBeNull();
    expect([hit!.x, hit!.y, hit!.z]).toEqual([8, 2, 3]);
    expect(hit!.normal).toEqual([0, 0, -1]);
    expect(hit!.distance).toBeCloseTo(2.5);
  });

  it('only hits the lower half of slabs', () => {
    const reg = registry();
    const v = new VoxelVolume(8, 8, 8);
    v.set(4, 1, 4, 'test:slab');
    const info = new PaletteInfo(v.palette, reg);
    expect(raycastVoxels(v, info, { x: 4.5, y: 1.8, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10)).toBeNull();
    expect(raycastVoxels(v, info, { x: 4.5, y: 1.2, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10)?.z).toBe(4);
  });
});

describe('construction kit', () => {
  it('builds stairs, roofs and rotates copied regions', () => {
    const v = new VoxelVolume(32, 16, 32);
    stairs(v, [2, 0, 2], 'x+', 4, 2, 'test:stone');
    expect(v.get(5, 3, 2)).toBe('test:stone');
    expect(v.get(5, 3, 3)).toBe('test:stone');
    const top = gableRoof(v, [10, 0, 10], [16, 0, 14], 5, 'x', 'test:stone');
    expect(top).toBeGreaterThan(5);
    const region = copyRegion(v, [2, 0, 2], [5, 3, 3]);
    const rotated = rotateRegion(region, 1);
    expect(rotated.size).toEqual([2, 4, 4]);
    pasteRegion(v, rotated, [20, 0, 20]);
    expect(v.get(20, 0, 20) !== AIR_ID || v.get(21, 0, 20) !== AIR_ID).toBe(true);
  });
});

describe('procedural textures', () => {
  it('generates every registered texture deterministically', () => {
    for (const gen of listTextureGenerators()) {
      const a = generateTile(gen, ['#8a6a4a', '#3a2a1a', '#c8a882', '#556677', '#aa3333', '#33aa55'], 3);
      const b = generateTile(gen, ['#8a6a4a', '#3a2a1a', '#c8a882', '#556677', '#aa3333', '#33aa55'], 3);
      expect(a.length).toBe(16 * 16 * 4);
      expect(a).toEqual(b);
    }
  });
});
