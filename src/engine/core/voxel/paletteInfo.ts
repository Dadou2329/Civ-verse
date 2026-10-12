/**
 * Per-palette-index block properties packed in typed arrays for the hot loops
 * (meshing, lighting, collision, raycasts).
 */
import { BlockRegistry, type ResolvedBlockDef } from './blocks';
import { hexToRgb } from '../util/color';
import type { VoxelVolume } from './volume';

export const SHAPE_AIR = 0;
export const SHAPE_CUBE = 1;
export const SHAPE_SLAB = 2;
export const SHAPE_CROSS = 3;

export const LAYER_OPAQUE = 0;
export const LAYER_CUTOUT = 1;
export const LAYER_TRANSLUCENT = 2;
export const LAYER_EMISSIVE = 3;

export class PaletteInfo {
  readonly size: number;
  readonly solid: Uint8Array;
  readonly opaque: Uint8Array;
  readonly shape: Uint8Array;
  readonly layer: Uint8Array;
  readonly emitR: Uint8Array;
  readonly emitG: Uint8Array;
  readonly emitB: Uint8Array;
  readonly defs: ResolvedBlockDef[];
  readonly registryRevision: number;

  constructor(palette: readonly string[], registry: BlockRegistry) {
    const n = palette.length;
    this.size = n;
    this.registryRevision = registry.revision;
    this.solid = new Uint8Array(n);
    this.opaque = new Uint8Array(n);
    this.shape = new Uint8Array(n);
    this.layer = new Uint8Array(n);
    this.emitR = new Uint8Array(n);
    this.emitG = new Uint8Array(n);
    this.emitB = new Uint8Array(n);
    this.defs = [];
    for (let i = 0; i < n; i++) {
      const def = registry.getOrMissing(palette[i]!);
      this.defs.push(def);
      if (i === 0) {
        this.shape[i] = SHAPE_AIR;
        continue;
      }
      this.solid[i] = def.solid ? 1 : 0;
      this.opaque[i] = def.opaque ? 1 : 0;
      this.shape[i] = def.shape === 'slab' ? SHAPE_SLAB : def.shape === 'cross' ? SHAPE_CROSS : SHAPE_CUBE;
      this.layer[i] =
        def.layer === 'cutout' ? LAYER_CUTOUT : def.layer === 'translucent' ? LAYER_TRANSLUCENT : def.layer === 'emissive' ? LAYER_EMISSIVE : LAYER_OPAQUE;
      if (def.light && def.light.level > 0) {
        const c = hexToRgb(def.light.color);
        const lvl = Math.min(15, Math.max(0, Math.round(def.light.level)));
        const m = Math.max(c.r, c.g, c.b) || 1;
        this.emitR[i] = Math.round((lvl * c.r) / m);
        this.emitG[i] = Math.round((lvl * c.g) / m);
        this.emitB[i] = Math.round((lvl * c.b) / m);
      }
    }
  }

  /** Returns a PaletteInfo matching the volume palette, rebuilding only when needed. */
  static sync(prev: PaletteInfo | null, volume: VoxelVolume, registry: BlockRegistry): PaletteInfo {
    if (prev && prev.size === volume.palette.length && prev.registryRevision === registry.revision) return prev;
    return new PaletteInfo(volume.palette, registry);
  }
}
