/**
 * Micro-voxel models: detailed props (lanterns, furniture, signs, machines, door panels...)
 * built from small colored voxels (default 1/16 m), meshed with per-vertex ambient occlusion.
 *
 * Models are code-defined recipes (`defineModel({ build(b) { ... } })`), referenced by stable ids
 * ("core:lantern"). Gameplay never depends on the geometry: replacing a model's recipe — or the
 * whole renderer — does not affect quests or mechanics. Named parts (with pivots) can be animated
 * by the view (e.g. a door panel rotating around its hinge).
 */
import { hexToRgb, shade, type RGB } from '../util/color';
import { Rng } from '../util/rng';

export interface ModelOptions {
  /** Micro-voxel edge length in meters (default 1/16). */
  voxelSize?: number;
  /** Collision: 'auto' = bounds of the model, 'none', or explicit local box in meters. */
  collider?: 'auto' | 'none' | { min: [number, number, number]; max: [number, number, number] };
  /** Light baked into the voxel light field at the model position. */
  light?: { level: number; color: string; offset?: [number, number, number] };
  /** Entity origin relative to the model bounds (default bottom-center). */
  anchor?: 'bottom-center' | 'center' | 'min';
  /** Targetable by the interaction ray (default true). */
  pickable?: boolean;
  tags?: string[];
}

export type ModelBuildFn = (b: ModelBuilder) => void;

export interface VoxelPaint {
  color: string;
  emissive?: boolean;
  /** 0..1 alpha; < 1 renders in the transparent pass. */
  alpha?: number;
  /** Random brightness variation per voxel (0..0.3). */
  vary?: number;
}

interface PartData {
  pivot: [number, number, number];
  voxels: Map<number, { rgb: RGB; emissive: boolean; alpha: number }>;
}

const KEY_BITS = 10;
const OFFSET = 512;
const pack = (x: number, y: number, z: number) => ((x + OFFSET) << (KEY_BITS * 2)) | ((y + OFFSET) << KEY_BITS) | (z + OFFSET);
const unpack = (k: number): [number, number, number] => [
  ((k >> (KEY_BITS * 2)) & 1023) - OFFSET,
  ((k >> KEY_BITS) & 1023) - OFFSET,
  (k & 1023) - OFFSET,
];

export class ModelBuilder {
  private parts = new Map<string, PartData>();
  private current: PartData;
  private rng: Rng;

  constructor(seed = 1) {
    this.current = { pivot: [0, 0, 0], voxels: new Map() };
    this.parts.set('main', this.current);
    this.rng = new Rng(seed);
  }

  /** Switches to (or creates) a named part. `pivot` is in voxel units (rotation center). */
  part(name: string, pivot: [number, number, number] = [0, 0, 0]): this {
    let p = this.parts.get(name);
    if (!p) {
      p = { pivot, voxels: new Map() };
      this.parts.set(name, p);
    }
    this.current = p;
    return this;
  }

  set(x: number, y: number, z: number, paint: VoxelPaint | string): this {
    const p = typeof paint === 'string' ? { color: paint } : paint;
    let rgb = hexToRgb(p.color);
    if (p.vary) rgb = shade(rgb, (this.rng.next() - 0.5) * 2 * p.vary);
    this.current.voxels.set(pack(x, y, z), { rgb, emissive: !!p.emissive, alpha: p.alpha ?? 1 });
    return this;
  }

  /** Fills the half-open box [min, max). */
  box(min: [number, number, number], max: [number, number, number], paint: VoxelPaint | string): this {
    for (let y = min[1]; y < max[1]; y++) for (let z = min[2]; z < max[2]; z++) for (let x = min[0]; x < max[0]; x++) this.set(x, y, z, paint);
    return this;
  }

  /** Box outline: only the shell of [min, max). */
  shell(min: [number, number, number], max: [number, number, number], paint: VoxelPaint | string): this {
    for (let y = min[1]; y < max[1]; y++)
      for (let z = min[2]; z < max[2]; z++)
        for (let x = min[0]; x < max[0]; x++) {
          if (x === min[0] || y === min[1] || z === min[2] || x === max[0] - 1 || y === max[1] - 1 || z === max[2] - 1) this.set(x, y, z, paint);
        }
    return this;
  }

  clear(min: [number, number, number], max: [number, number, number]): this {
    for (let y = min[1]; y < max[1]; y++) for (let z = min[2]; z < max[2]; z++) for (let x = min[0]; x < max[0]; x++) this.current.voxels.delete(pack(x, y, z));
    return this;
  }

  /** Vertical cylinder centered on (cx, cz) (voxel coordinates, may be fractional). */
  cylinder(cx: number, cz: number, radius: number, y0: number, y1: number, paint: VoxelPaint | string, hollow = false): this {
    for (let y = y0; y < y1; y++)
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++)
        for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d <= radius && (!hollow || d > radius - 1.05)) this.set(x, y, z, paint);
        }
    return this;
  }

  /** Cylinder lying along X (wheels, gears, barrels on their side). */
  cylinderX(cy: number, cz: number, radius: number, x0: number, x1: number, paint: VoxelPaint | string, hollow = false): this {
    for (let x = x0; x < x1; x++)
      for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++)
        for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
          const d = Math.hypot(y + 0.5 - cy, z + 0.5 - cz);
          if (d <= radius && (!hollow || d > radius - 1.05)) this.set(x, y, z, paint);
        }
    return this;
  }

  /** Cylinder lying along Z. */
  cylinderZ(cx: number, cy: number, radius: number, z0: number, z1: number, paint: VoxelPaint | string, hollow = false): this {
    for (let z = z0; z < z1; z++)
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++)
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= radius && (!hollow || d > radius - 1.05)) this.set(x, y, z, paint);
        }
    return this;
  }

  sphere(cx: number, cy: number, cz: number, radius: number, paint: VoxelPaint | string): this {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++)
      for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++)
        for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz) <= radius) this.set(x, y, z, paint);
        }
    return this;
  }

  line(a: [number, number, number], b: [number, number, number], paint: VoxelPaint | string): this {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.set(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), paint);
    }
    return this;
  }

  /** Random number source (deterministic per model). */
  random(): number {
    return this.rng.next();
  }

  /** @internal */
  _parts(): Map<string, PartData> {
    return this.parts;
  }
}

export interface ModelMeshArrays {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
}

export interface ModelPartMesh {
  name: string;
  /** Pivot in meters, relative to the model origin (anchor). */
  pivot: [number, number, number];
  opaque: ModelMeshArrays | null;
  emissive: ModelMeshArrays | null;
  transparent: ModelMeshArrays | null;
}

export interface BuiltModel {
  parts: ModelPartMesh[];
  /** Local bounds in meters relative to the origin (anchor). */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  voxelCount: number;
}

const FACE_DIRS: { n: [number, number, number]; corners: [number, number, number][]; shade: number }[] = [
  { n: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.82 },
  { n: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.82 },
  { n: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], shade: 0.6 },
  { n: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.92 },
  { n: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.72 },
];
const AO = [0.55, 0.7, 0.85, 1];

class ArrBuilder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  count = 0;
  finish(): ModelMeshArrays | null {
    if (!this.count) return null;
    return {
      positions: Float32Array.from(this.positions),
      normals: Float32Array.from(this.normals),
      colors: Float32Array.from(this.colors),
      indices: Uint32Array.from(this.indices),
      vertexCount: this.count,
    };
  }
}

/** Runs a model recipe and meshes it. Pure and deterministic. */
export function buildModel(build: ModelBuildFn, opts: ModelOptions = {}, seed = 1): BuiltModel {
  const b = new ModelBuilder(seed);
  build(b);
  const size = opts.voxelSize ?? 1 / 16;
  const parts = b._parts();
  // Bounds over all parts (voxel units).
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let voxelCount = 0;
  for (const p of parts.values()) {
    for (const k of p.voxels.keys()) {
      const [x, y, z] = unpack(k);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);
      maxZ = Math.max(maxZ, z + 1);
      voxelCount++;
    }
  }
  if (voxelCount === 0) {
    return { parts: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] }, voxelCount: 0 };
  }
  const anchor = opts.anchor ?? 'bottom-center';
  const ox = anchor === 'min' ? minX : (minX + maxX) / 2;
  const oy = anchor === 'center' ? (minY + maxY) / 2 : minY;
  const oz = anchor === 'min' ? minZ : (minZ + maxZ) / 2;

  const out: ModelPartMesh[] = [];
  for (const [name, part] of parts) {
    if (part.voxels.size === 0) continue;
    const layers = { opaque: new ArrBuilder(), emissive: new ArrBuilder(), transparent: new ArrBuilder() };
    const occ = (x: number, y: number, z: number) => {
      const v = part.voxels.get(pack(x, y, z));
      return v !== undefined && v.alpha >= 1;
    };
    // The main part is expressed relative to the model origin (anchor); named parts relative to
    // their pivot (absolute builder coordinates) so the view can rotate them around it.
    const isMain = name === 'main';
    const px = isMain ? ox : part.pivot[0];
    const py = isMain ? oy : part.pivot[1];
    const pz = isMain ? oz : part.pivot[2];
    for (const [k, v] of part.voxels) {
      const [x, y, z] = unpack(k);
      const target = v.emissive ? layers.emissive : v.alpha < 1 ? layers.transparent : layers.opaque;
      for (const f of FACE_DIRS) {
        const nx = x + f.n[0];
        const ny = y + f.n[1];
        const nz = z + f.n[2];
        const neighbor = part.voxels.get(pack(nx, ny, nz));
        if (neighbor && (neighbor.alpha >= 1 || v.alpha < 1)) continue;
        const base = target.count;
        const aos: number[] = [];
        for (const c of f.corners) {
          const sx = f.n[0] !== 0 ? 0 : c[0] === 1 ? 1 : -1;
          const sy = f.n[1] !== 0 ? 0 : c[1] === 1 ? 1 : -1;
          const sz = f.n[2] !== 0 ? 0 : c[2] === 1 ? 1 : -1;
          let s1: [number, number, number];
          let s2: [number, number, number];
          if (f.n[0] !== 0) {
            s1 = [0, sy, 0];
            s2 = [0, 0, sz];
          } else if (f.n[1] !== 0) {
            s1 = [sx, 0, 0];
            s2 = [0, 0, sz];
          } else {
            s1 = [sx, 0, 0];
            s2 = [0, sy, 0];
          }
          const a = occ(nx + s1[0], ny + s1[1], nz + s1[2]);
          const bb = occ(nx + s2[0], ny + s2[1], nz + s2[2]);
          const d = occ(nx + s1[0] + s2[0], ny + s1[1] + s2[1], nz + s1[2] + s2[2]);
          const ao = v.emissive ? 3 : a && bb ? 0 : 3 - ((a ? 1 : 0) + (bb ? 1 : 0) + (d ? 1 : 0));
          aos.push(ao);
          target.positions.push((x + c[0] - px) * size, (y + c[1] - py) * size, (z + c[2] - pz) * size);
          target.normals.push(f.n[0], f.n[1], f.n[2]);
          const k2 = v.emissive ? 1 : AO[ao]! * f.shade;
          target.colors.push(v.rgb.r * k2, v.rgb.g * k2, v.rgb.b * k2, v.alpha);
          target.count++;
        }
        if (aos[0]! + aos[2]! > aos[1]! + aos[3]!) target.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
        else target.indices.push(base + 1, base + 3, base + 2, base + 1, base, base + 3);
      }
    }
    out.push({
      name,
      pivot: isMain ? [0, 0, 0] : [(px - ox) * size, (py - oy) * size, (pz - oz) * size],
      opaque: layers.opaque.finish(),
      emissive: layers.emissive.finish(),
      transparent: layers.transparent.finish(),
    });
  }
  return {
    parts: out,
    bounds: {
      min: [(minX - ox) * size, (minY - oy) * size, (minZ - oz) * size],
      max: [(maxX - ox) * size, (maxY - oy) * size, (maxZ - oz) * size],
    },
    voxelCount,
  };
}
