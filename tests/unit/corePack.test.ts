import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { loadPack, validateManifest } from '@engine/core/packs/pack';
import { BlockRegistry } from '@engine/core/voxel/blocks';
import { buildAtlas } from '@engine/core/voxel/textures/atlas';
import { hasTextureGenerator } from '@engine/core/voxel/textures/generators';
import { buildModel } from '@engine/core/voxel/microModel';

describe('core library pack', () => {
  it('loads without content issues and every asset builds', async () => {
    const provider = new GlobContentProvider();
    const raw = (await provider.listManifests()).find((m) => (m as { id: string }).id === 'core');
    const { manifest, issues } = validateManifest(raw);
    expect(issues).toEqual([]);
    const pack = await loadPack(provider, manifest!);
    expect(pack.issues).toEqual([]);
    expect(pack.defs.blocks.length).toBeGreaterThan(60);
    expect(pack.defs.models.length).toBeGreaterThan(25);
    expect(pack.defs.sounds.length).toBeGreaterThan(20);

    const reg = new BlockRegistry();
    for (const b of pack.defs.blocks) {
      reg.register(b, 'core');
      for (const face of [0, 2, 3]) expect(hasTextureGenerator(BlockRegistry.faceTexture(reg.get(b.id)!, face).gen)).toBe(true);
    }
    const atlas = buildAtlas(reg.all().flatMap((d) => [0, 2, 3].map((f) => BlockRegistry.faceTexture(d, f))));
    expect(atlas.tiles.size).toBeGreaterThan(50);

    for (const m of pack.defs.models) {
      const built = buildModel(m.build, m);
      expect(built.voxelCount, m.id).toBeGreaterThan(0);
      const size = built.bounds.max.map((v, i) => v - built.bounds.min[i]!);
      expect(Math.max(...size), m.id).toBeLessThan(4);
    }
    expect(pack.characters.size).toBeGreaterThanOrEqual(6);
  });
});
