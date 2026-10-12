/**
 * Texture atlas packing for block textures.
 *
 * Each 16×16 tile is stored in a 32×32 cell whose borders contain the wrapped tile content
 * (cell pixel (x, y) = tile pixel ((x-8) mod 16, (y-8) mod 16)). Faces sample the central 16×16
 * area. Because every cell only contains its own tile, mipmap levels never blend neighboring
 * textures until a cell shrinks to one pixel — no visible seams at a distance.
 */
import type { BlockTextureSpec } from '../blocks';
import { textureKey } from '../blocks';
import { TILE_SIZE, generateTile } from './generators';

export const CELL_SIZE = 32;
const PAD = (CELL_SIZE - TILE_SIZE) / 2;
const COLUMNS = 16;

export interface AtlasTile {
  index: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Average color of the tile (0..1), handy for particles and distant LOD. */
  average: [number, number, number];
}

export interface AtlasLayout {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  tiles: Map<string, AtlasTile>;
}

export function buildAtlas(specs: Iterable<BlockTextureSpec>): AtlasLayout {
  const unique = new Map<string, BlockTextureSpec>();
  for (const s of specs) unique.set(textureKey(s), s);
  const count = Math.max(1, unique.size);
  const rows = Math.ceil(count / COLUMNS);
  const width = COLUMNS * CELL_SIZE;
  let height = CELL_SIZE;
  while (height < rows * CELL_SIZE) height *= 2;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const tiles = new Map<string, AtlasTile>();
  let index = 0;
  for (const [key, spec] of unique) {
    const tile = generateTile(spec.gen, spec.colors, spec.seed ?? 0, spec.params ?? {});
    const cx = (index % COLUMNS) * CELL_SIZE;
    const cy = Math.floor(index / COLUMNS) * CELL_SIZE;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let y = 0; y < CELL_SIZE; y++) {
      for (let x = 0; x < CELL_SIZE; x++) {
        const tx = (((x - PAD) % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
        const ty = (((y - PAD) % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
        const src = (ty * TILE_SIZE + tx) * 4;
        const dst = ((cy + y) * width + cx + x) * 4;
        pixels[dst] = tile[src]!;
        pixels[dst + 1] = tile[src + 1]!;
        pixels[dst + 2] = tile[src + 2]!;
        pixels[dst + 3] = tile[src + 3]!;
      }
    }
    for (let i = 0; i < tile.length; i += 4) {
      sr += tile[i]!;
      sg += tile[i + 1]!;
      sb += tile[i + 2]!;
    }
    const n = TILE_SIZE * TILE_SIZE * 255;
    tiles.set(key, {
      index,
      u0: (cx + PAD) / width,
      v0: (cy + PAD) / height,
      u1: (cx + PAD + TILE_SIZE) / width,
      v1: (cy + PAD + TILE_SIZE) / height,
      average: [sr / n, sg / n, sb / n],
    });
    index++;
  }
  return { width, height, pixels, tiles };
}
