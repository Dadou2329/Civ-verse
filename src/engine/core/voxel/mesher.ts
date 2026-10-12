/**
 * Chunk mesher.
 *
 * Converts a 16³ region of a voxel volume into vertex arrays, one set per render layer.
 * Pure function (no Babylon): the view uploads the arrays, tests can inspect them, and the work
 * can move to a Web Worker later without changes.
 *
 * Per vertex it bakes:
 *  - `colors`: ambient occlusion (classic 3-neighbor AO) — RGBA,
 *  - `light`:  smooth voxel light (block light RGB + sky light × face shading) — RGBA,
 *  - UVs into the block texture atlas.
 */
import type { VoxelVolume } from './volume';
import { BlockRegistry, textureKey } from './blocks';
import type { AtlasLayout, AtlasTile } from './textures/atlas';
import type { LightField } from './light';
import {
  type PaletteInfo,
  LAYER_CUTOUT,
  LAYER_EMISSIVE,
  LAYER_OPAQUE,
  LAYER_TRANSLUCENT,
  SHAPE_AIR,
  SHAPE_CROSS,
  SHAPE_CUBE,
  SHAPE_SLAB,
} from './paletteInfo';

export const CHUNK_SIZE = 16;

export interface MeshArrays {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  light: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
}

export interface ChunkMesh {
  cx: number;
  cy: number;
  cz: number;
  layers: { opaque: MeshArrays | null; cutout: MeshArrays | null; translucent: MeshArrays | null; emissive: MeshArrays | null };
}

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  light: number[] = [];
  indices: number[] = [];
  count = 0;
  finish(): MeshArrays | null {
    if (this.count === 0) return null;
    return {
      positions: Float32Array.from(this.positions),
      normals: Float32Array.from(this.normals),
      uvs: Float32Array.from(this.uvs),
      colors: Float32Array.from(this.colors),
      light: Float32Array.from(this.light),
      indices: Uint32Array.from(this.indices),
      vertexCount: this.count,
    };
  }
}

/** Face table: normal, the 4 corners (unit cube, counter-clockwise seen from outside), tangent axes. */
interface FaceDef {
  n: [number, number, number];
  corners: [number, number, number][];
  /** UV per corner (u, v) with v = 0 at the top of the texture. */
  uv: [number, number][];
  shade: number;
}

// Corners are listed so that (c1-c0)×(c2-c0) points outward; emitFace reverses the order for
// Babylon's front-face convention.
const FACES: FaceDef[] = [
  // +X
  { n: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], shade: 0.8 },
  // -X
  { n: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], shade: 0.8 },
  // +Y (top)
  { n: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], shade: 1.0 },
  // -Y (bottom)
  { n: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], shade: 0.55 },
  // +Z
  { n: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], shade: 0.9 },
  // -Z
  { n: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], shade: 0.7 },
];

const AO_CURVE = [0.42, 0.62, 0.82, 1.0];
const aoScratch = [0, 0, 0, 0];
const FULL_BRIGHT: readonly [number, number, number, number] = [1, 1, 1, 1];

/** Perceptual light curve: level 0..15 → brightness. */
export function lightCurve(level: number, falloff = 0.82): number {
  if (level <= 0) return 0;
  return Math.pow(falloff, 15 - level);
}
const SKY_CURVE = Array.from({ length: 16 }, (_, l) => lightCurve(l, 0.8));
const BLOCK_CURVE = Array.from({ length: 16 }, (_, l) => lightCurve(l, 0.84));

export interface MesherContext {
  volume: VoxelVolume;
  info: PaletteInfo;
  atlas: AtlasLayout;
  light: LightField | null;
  /** Atlas tiles per palette index and face (filled lazily). */
  tileCache?: (AtlasTile | null)[];
}

function tileFor(ctx: MesherContext, paletteIdx: number, face: number): AtlasTile {
  const cache = (ctx.tileCache ??= []);
  const k = paletteIdx * 6 + face;
  let t = cache[k];
  if (t === undefined || t === null) {
    const def = ctx.info.defs[paletteIdx]!;
    const spec = BlockRegistry.faceTexture(def, face);
    t = ctx.atlas.tiles.get(textureKey(spec)) ?? null;
    if (!t) {
      // Texture missing from atlas (should not happen): fall back to the first tile.
      t = ctx.atlas.tiles.values().next().value ?? { index: 0, u0: 0, v0: 0, u1: 1, v1: 1, average: [1, 0, 1] };
    }
    cache[k] = t;
  }
  return t;
}

export function meshChunk(ctx: MesherContext, cx: number, cy: number, cz: number): ChunkMesh {
  const { volume, info } = ctx;
  const builders = [new Builder(), new Builder(), new Builder(), new Builder()];
  const x0 = cx * CHUNK_SIZE;
  const y0 = cy * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const x1 = Math.min(volume.sizeX, x0 + CHUNK_SIZE);
  const y1 = Math.min(volume.sizeY, y0 + CHUNK_SIZE);
  const z1 = Math.min(volume.sizeZ, z0 + CHUNK_SIZE);
  const opaque = info.opaque;
  const shapeArr = info.shape;
  const layerArr = info.layer;

  const getP = (x: number, y: number, z: number) => volume.getIndex(x, y, z);
  /** True when the cell hides faces and darkens corners. */
  const occludes = (x: number, y: number, z: number) => opaque[getP(x, y, z)] === 1;

  for (let y = y0; y < y1; y++) {
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const p = getP(x, y, z);
        const shape = shapeArr[p]!;
        if (shape === SHAPE_AIR) continue;
        const layer = layerArr[p]!;
        const b = builders[layer]!;
        if (shape === SHAPE_CROSS) {
          emitCross(ctx, b, p, x, y, z);
          continue;
        }
        const height = shape === SHAPE_SLAB ? 0.5 : 1;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f]!;
          const nx = x + face.n[0];
          const ny = y + face.n[1];
          const nz = z + face.n[2];
          // Slab top face is inside the cell: always visible.
          if (!(shape === SHAPE_SLAB && f === 2)) {
            const np = getP(nx, ny, nz);
            if (opaque[np]) continue;
            // Same transparent block next to itself (glass walls): skip the shared face.
            if (np === p && layer !== LAYER_OPAQUE && shapeArr[np] === SHAPE_CUBE) continue;
            // Slab under a slab or cube: hide the bottom face of the upper one only if neighbor is a full cube.
            if (shape === SHAPE_CUBE && shapeArr[np] === SHAPE_SLAB && f === 3) {
              // A cube above a slab: the cube bottom face is visible (gap of half a block) — keep it.
            }
          }
          emitFace(ctx, b, p, f, x, y, z, height, occludes, layer === LAYER_EMISSIVE);
        }
      }
    }
  }
  return {
    cx,
    cy,
    cz,
    layers: {
      opaque: builders[LAYER_OPAQUE]!.finish(),
      cutout: builders[LAYER_CUTOUT]!.finish(),
      translucent: builders[LAYER_TRANSLUCENT]!.finish(),
      emissive: builders[LAYER_EMISSIVE]!.finish(),
    },
  };
}

function emitFace(
  ctx: MesherContext,
  b: Builder,
  p: number,
  f: number,
  x: number,
  y: number,
  z: number,
  height: number,
  occludes: (x: number, y: number, z: number) => boolean,
  fullBright: boolean,
): void {
  const face = FACES[f]!;
  const tile = tileFor(ctx, p, f);
  const [nx, ny, nz] = face.n;
  // For the slab top face, light/AO are sampled in the slab's own cell layer.
  const isSlabTop = height < 1 && f === 2;
  const ox = x + (isSlabTop ? 0 : nx);
  const oy = y + (isSlabTop ? 0 : ny);
  const oz = z + (isSlabTop ? 0 : nz);
  const aoValues = aoScratch;
  const base = b.count;
  for (let c = 0; c < 4; c++) {
    const corner = face.corners[c]!;
    const cxw = corner[0];
    let cyw = corner[1];
    const czw = corner[2];
    if (height < 1) cyw = cyw * height;
    // Tangent offsets: for each axis that is not the normal axis, -1 or +1 depending on the corner.
    const sx = nx !== 0 ? 0 : corner[0] === 1 ? 1 : -1;
    const sy = ny !== 0 ? 0 : corner[1] === 1 ? 1 : -1;
    const sz = nz !== 0 ? 0 : corner[2] === 1 ? 1 : -1;
    let ao: number;
    let light: readonly [number, number, number, number];
    if (fullBright) {
      ao = 3;
      light = FULL_BRIGHT;
    } else {
      // Two side neighbors and the diagonal, in the layer in front of the face.
      let s1x = 0, s1y = 0, s2y = 0, s2z = 0;
      const s1z = 0, s2x = 0;
      if (nx !== 0) {
        s1y = sy;
        s2z = sz;
      } else if (ny !== 0) {
        s1x = sx;
        s2z = sz;
      } else {
        s1x = sx;
        s2y = sy;
      }
      const side1 = occludes(ox + s1x, oy + s1y, oz + s1z);
      const side2 = occludes(ox + s2x, oy + s2y, oz + s2z);
      const diag = occludes(ox + s1x + s2x, oy + s1y + s2y, oz + s1z + s2z);
      ao = side1 && side2 ? 0 : 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (diag ? 1 : 0));
      light = smoothLight(ctx, ox, oy, oz, s1x, s1y, s1z, s2x, s2y, s2z, side1, side2, diag, face.shade);
    }
    aoValues[c] = ao;
    b.positions.push(x + cxw, y + cyw, z + czw);
    b.normals.push(nx, ny, nz);
    const [u, v] = face.uv[c]!;
    // Side faces of slabs only show the lower half of the texture.
    const vv = height < 1 && f !== 2 && f !== 3 ? 0.5 + v * 0.5 : v;
    b.uvs.push(tile.u0 + (tile.u1 - tile.u0) * u, tile.v0 + (tile.v1 - tile.v0) * vv);
    const a = AO_CURVE[ao]!;
    b.colors.push(a, a, a, 1);
    b.light.push(light[0], light[1], light[2], light[3]);
    b.count++;
  }
  // Babylon (left-handed, clockwise front faces): (v1-v0)×(v2-v0) must point INTO the block, so
  // the outward-ordered corners are emitted in reverse. The diagonal joins the two brighter
  // corners, which avoids the classic AO "zig-zag" artifact.
  if (aoValues[0]! + aoValues[2]! > aoValues[1]! + aoValues[3]!) {
    b.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  } else {
    b.indices.push(base + 1, base + 3, base + 2, base + 1, base, base + 3);
  }
}

const lightScratch: [number, number, number, number] = [0, 0, 0, 0];
const lightAcc = new Float64Array(5);

function accumulateLight(ctx: MesherContext, x: number, y: number, z: number): void {
  const vol = ctx.volume;
  if (x < 0 || y < 0 || z < 0 || x >= vol.sizeX || y >= vol.sizeY || z >= vol.sizeZ) {
    if (y >= vol.sizeY) {
      lightAcc[0]! += 15;
      lightAcc[4]! += 1;
    }
    return;
  }
  const L = ctx.light!;
  const i = x + vol.sizeX * (z + vol.sizeZ * y);
  lightAcc[0]! += L.sky[i]!;
  lightAcc[1]! += L.r[i]!;
  lightAcc[2]! += L.g[i]!;
  lightAcc[3]! += L.b[i]!;
  lightAcc[4]! += 1;
}

function curveAt(arr: readonly number[], v: number): number {
  const lo = Math.floor(v);
  const t = v - lo;
  const a = arr[lo > 15 ? 15 : lo]!;
  const b = arr[lo + 1 > 15 ? 15 : lo + 1]!;
  return a + (b - a) * t;
}

/** Smooth per-vertex light (writes into a shared scratch tuple, copy before reuse). */
function smoothLight(
  ctx: MesherContext,
  ox: number,
  oy: number,
  oz: number,
  s1x: number,
  s1y: number,
  s1z: number,
  s2x: number,
  s2y: number,
  s2z: number,
  side1: boolean,
  side2: boolean,
  diag: boolean,
  faceShade: number,
): [number, number, number, number] {
  if (!ctx.light) {
    lightScratch[0] = 0;
    lightScratch[1] = 0;
    lightScratch[2] = 0;
    lightScratch[3] = faceShade;
    return lightScratch;
  }
  lightAcc.fill(0);
  accumulateLight(ctx, ox, oy, oz);
  if (!side1) accumulateLight(ctx, ox + s1x, oy + s1y, oz + s1z);
  if (!side2) accumulateLight(ctx, ox + s2x, oy + s2y, oz + s2z);
  if (!diag && !(side1 && side2)) accumulateLight(ctx, ox + s1x + s2x, oy + s1y + s2y, oz + s1z + s2z);
  const n = lightAcc[4]!;
  if (n === 0) {
    lightScratch[0] = 0;
    lightScratch[1] = 0;
    lightScratch[2] = 0;
    lightScratch[3] = 0;
    return lightScratch;
  }
  const shadeBlock = 0.82 + 0.18 * faceShade;
  lightScratch[0] = curveAt(BLOCK_CURVE, lightAcc[1]! / n) * shadeBlock;
  lightScratch[1] = curveAt(BLOCK_CURVE, lightAcc[2]! / n) * shadeBlock;
  lightScratch[2] = curveAt(BLOCK_CURVE, lightAcc[3]! / n) * shadeBlock;
  lightScratch[3] = curveAt(SKY_CURVE, lightAcc[0]! / n) * faceShade;
  return lightScratch;
}

function emitCross(ctx: MesherContext, b: Builder, p: number, x: number, y: number, z: number): void {
  const tile = tileFor(ctx, p, 0);
  const L = ctx.light;
  let light: [number, number, number, number] = [0, 0, 0, 0.9];
  if (L && ctx.volume.inBounds(x, y, z)) {
    const i = ctx.volume.index(x, y, z);
    light = [BLOCK_CURVE[L.r[i]!]!, BLOCK_CURVE[L.g[i]!]!, BLOCK_CURVE[L.b[i]!]!, SKY_CURVE[L.sky[i]!]! * 0.9];
  }
  const quads: [number, number, number, number][] = [
    [0.15, 0.15, 0.85, 0.85],
    [0.15, 0.85, 0.85, 0.15],
  ];
  for (const [ax, az, bx, bz] of quads) {
    for (const flip of [false, true]) {
      const base = b.count;
      const pts: [number, number, number, number, number][] = [
        [ax, 0, az, 0, 1],
        [ax, 1, az, 0, 0],
        [bx, 1, bz, 1, 0],
        [bx, 0, bz, 1, 1],
      ];
      const nxv = bz - az;
      const nzv = -(bx - ax);
      const len = Math.hypot(nxv, nzv) || 1;
      for (const [px, py, pz, u, v] of pts) {
        b.positions.push(x + px, y + py, z + pz);
        b.normals.push(((flip ? -1 : 1) * nxv) / len, 0, ((flip ? -1 : 1) * nzv) / len);
        b.uvs.push(tile.u0 + (tile.u1 - tile.u0) * u, tile.v0 + (tile.v1 - tile.v0) * v);
        b.colors.push(1, 1, 1, 1);
        b.light.push(light[0], light[1], light[2], light[3]);
        b.count++;
      }
      if (flip) b.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}

/** Number of chunks along each axis. */
export function chunkCounts(volume: VoxelVolume): [number, number, number] {
  return [Math.ceil(volume.sizeX / CHUNK_SIZE), Math.ceil(volume.sizeY / CHUNK_SIZE), Math.ceil(volume.sizeZ / CHUNK_SIZE)];
}
