/**
 * Block types.
 *
 * Blocks are the 1 m construction unit of voxel worlds. They are referenced by stable asset ids
 * ("core:stone", "door:gilded_brick") so that their look can be upgraded without touching worlds.
 * Packs register blocks with `defineBlock` (see sdk). Textures are procedural recipes
 * (see ./textures) rather than image files, which keeps every asset original and replaceable.
 */
import { ASSET_ID_RE } from '../util/ids';

export type BlockShape = 'cube' | 'slab' | 'cross';
export type BlockMaterialSound = 'stone' | 'wood' | 'metal' | 'glass' | 'cloth' | 'earth' | 'plant' | 'crystal';
export type RenderLayer = 'opaque' | 'cutout' | 'translucent' | 'emissive';

export interface BlockTextureSpec {
  /** Procedural generator id (see TEXTURE_GENERATORS). */
  gen: string;
  /** Palette consumed by the generator: [base, dark, light, accent...] as #rrggbb. */
  colors: string[];
  seed?: number;
  params?: Record<string, number>;
}

export interface BlockFaceTextures {
  all?: BlockTextureSpec;
  top?: BlockTextureSpec;
  bottom?: BlockTextureSpec;
  side?: BlockTextureSpec;
}

export interface BlockDef {
  id: string;
  /** French label shown in the Studio palette. */
  label: string;
  category?: string;
  shape?: BlockShape;
  /** Collides with characters (default: true except for 'cross'). */
  solid?: boolean;
  /** Fully hides neighbor faces and blocks light (default: cube && !transparent). */
  opaque?: boolean;
  /** Rendered with transparency: 'cutout' (alpha test) or 'blend'. */
  transparency?: 'cutout' | 'blend';
  /** Faces are rendered full-bright and feed the glow effect. */
  emissive?: boolean;
  /** Block light emission (0..15) and its color. */
  light?: { level: number; color: string };
  textures: BlockFaceTextures;
  sound?: BlockMaterialSound;
}

export interface ResolvedBlockDef extends Required<Omit<BlockDef, 'light' | 'transparency' | 'category' | 'sound'>> {
  light: { level: number; color: string } | null;
  transparency: 'cutout' | 'blend' | null;
  category: string;
  sound: BlockMaterialSound;
  layer: RenderLayer;
}

export const AIR_ID = 'core:air';
export const MISSING_BLOCK_ID = 'core:missing';

function resolve(def: BlockDef): ResolvedBlockDef {
  const shape = def.shape ?? 'cube';
  const transparency = def.transparency ?? null;
  const solid = def.solid ?? shape !== 'cross';
  const opaque = def.opaque ?? (shape === 'cube' && transparency === null);
  const emissive = def.emissive ?? false;
  const layer: RenderLayer = emissive
    ? 'emissive'
    : transparency === 'blend'
      ? 'translucent'
      : transparency === 'cutout' || shape === 'cross'
        ? 'cutout'
        : 'opaque';
  return {
    id: def.id,
    label: def.label,
    category: def.category ?? 'Divers',
    shape,
    solid,
    opaque,
    transparency,
    emissive,
    light: def.light ?? null,
    textures: def.textures,
    sound: def.sound ?? 'stone',
    layer,
  };
}

/** Registry of block definitions available to the loaded packs. */
export class BlockRegistry {
  private defs = new Map<string, ResolvedBlockDef>();
  private owners = new Map<string, string>();
  private revisionCounter = 0;

  constructor() {
    this.register(
      {
        id: AIR_ID,
        label: 'Air',
        category: 'Système',
        solid: false,
        opaque: false,
        textures: { all: { gen: 'flat', colors: ['#000000'] } },
      },
      'engine',
    );
    this.register(
      {
        id: MISSING_BLOCK_ID,
        label: 'Bloc manquant',
        category: 'Système',
        textures: { all: { gen: 'checker', colors: ['#ff00ff', '#1a1a1a'] } },
      },
      'engine',
    );
  }

  get revision(): number {
    return this.revisionCounter;
  }

  register(def: BlockDef, owner: string): void {
    if (!ASSET_ID_RE.test(def.id)) throw new Error(`Identifiant de bloc invalide : "${def.id}" (attendu "pack:nom").`);
    if (!def.textures.all && !(def.textures.top && def.textures.side)) {
      throw new Error(`Le bloc ${def.id} doit définir textures.all ou textures.top + textures.side.`);
    }
    const existingOwner = this.owners.get(def.id);
    if (existingOwner && existingOwner !== owner) {
      throw new Error(`Le bloc ${def.id} est déjà défini par "${existingOwner}".`);
    }
    this.defs.set(def.id, resolve(def));
    this.owners.set(def.id, owner);
    this.revisionCounter++;
  }

  unregisterOwner(owner: string): void {
    for (const [id, o] of [...this.owners]) {
      if (o === owner) {
        this.defs.delete(id);
        this.owners.delete(id);
      }
    }
    this.revisionCounter++;
  }

  get(id: string): ResolvedBlockDef | undefined {
    return this.defs.get(id);
  }

  /** Definition or the visible "missing block" placeholder. */
  getOrMissing(id: string): ResolvedBlockDef {
    return this.defs.get(id) ?? this.defs.get(MISSING_BLOCK_ID)!;
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  all(): ResolvedBlockDef[] {
    return [...this.defs.values()];
  }

  /** Texture spec for a face: 0=+X 1=-X 2=+Y(top) 3=-Y(bottom) 4=+Z 5=-Z. */
  static faceTexture(def: ResolvedBlockDef, face: number): BlockTextureSpec {
    const t = def.textures;
    if (face === 2) return t.top ?? t.all ?? t.side!;
    if (face === 3) return t.bottom ?? t.top ?? t.all ?? t.side!;
    return t.side ?? t.all ?? t.top!;
  }
}

/** Canonical key of a texture spec (atlas deduplication). */
export function textureKey(spec: BlockTextureSpec): string {
  return JSON.stringify([spec.gen, spec.colors, spec.seed ?? 0, spec.params ?? {}]);
}
