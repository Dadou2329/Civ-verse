/**
 * Small building kit for Verrou's seed: houses, railings and the usual entity shapes.
 * Seeds are development tools (run with `npm run civ -- seed door`); the scene JSON they
 * produce is then edited in Civilization Studio.
 */
import { type SceneBuilder, type VoxelVolume, fillBox, clearBox, gableRoof, type Vec3Tuple } from '@sdk/build';

export type Side = 'n' | 's' | 'e' | 'w';

export interface HouseStyle {
  wall: string;
  /** Lowest course (plinth). */
  base?: string;
  /** Corner posts and top band. */
  trim: string;
  roof: string;
  floor: string;
  /** Window block (null = no windows). */
  window: string | null;
}

export interface HouseOptions {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Walking height of the ground floor. */
  y: number;
  /** Wall height in blocks. */
  h: number;
  style: HouseStyle;
  roofAxis?: 'x' | 'z';
  /** Door openings (cut in the wall; doors are entities placed separately). */
  doors?: { side: Side; at: number; width?: number; height?: number }[];
  /** Window spacing along walls (0 = none). */
  windowEvery?: number;
  windowSides?: Side[];
  /** Flat roof instead of a gable (terraces). */
  flatRoof?: string;
  roofOverhang?: number;
}

/** Builds a closed house and returns the roof top height. Interiors are left empty. */
export function house(v: VoxelVolume, o: HouseOptions): number {
  const { x0, z0, x1, z1, y, h, style } = o;
  // Foundations below the floor so houses on slopes never float.
  fillBox(v, [x0, y - 3, z0], [x1, y - 1, z1], style.base ?? style.wall);
  fillBox(v, [x0 + 1, y - 1, z0 + 1], [x1 - 1, y - 1, z1 - 1], style.floor);
  clearBox(v, [x0 + 1, y, z0 + 1], [x1 - 1, y + h + 6, z1 - 1]);
  for (let yy = y; yy < y + h; yy++) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edgeX = x === x0 || x === x1;
        const edgeZ = z === z0 || z === z1;
        if (!edgeX && !edgeZ) continue;
        const corner = edgeX && edgeZ;
        let id = style.wall;
        if (yy === y && style.base) id = style.base;
        if (corner || yy === y + h - 1) id = style.trim;
        v.set(x, yy, z, id);
      }
    }
  }
  // Windows.
  const every = o.windowEvery ?? 3;
  if (style.window && every > 0) {
    const sides = o.windowSides ?? ['n', 's', 'e', 'w'];
    const isDoor = (side: Side, pos: number) => (o.doors ?? []).some((d) => d.side === side && pos >= d.at - 1 && pos <= d.at + (d.width ?? 1));
    for (const side of sides) {
      const alongX = side === 'n' || side === 's';
      const from = (alongX ? x0 : z0) + 2;
      const to = (alongX ? x1 : z1) - 2;
      for (let p = from; p <= to; p += every) {
        if (isDoor(side, p)) continue;
        for (let yy = y + 1; yy <= Math.min(y + 2, y + h - 2); yy++) {
          if (alongX) v.set(p, yy, side === 's' ? z0 : z1, style.window);
          else v.set(side === 'w' ? x0 : x1, yy, p, style.window);
        }
      }
    }
  }
  for (const d of o.doors ?? []) cutDoor(v, o, d.side, d.at, d.width ?? 1, d.height ?? 2);
  if (o.flatRoof) {
    fillBox(v, [x0, y + h, z0], [x1, y + h, z1], o.flatRoof);
    return y + h;
  }
  const axis = o.roofAxis ?? (x1 - x0 >= z1 - z0 ? 'x' : 'z');
  return gableRoof(v, [x0, y + h, z0], [x1, y + h, z1], y + h, axis, style.roof, { gableId: style.wall, overhang: o.roofOverhang ?? 1 });
}

function cutDoor(v: VoxelVolume, o: { x0: number; z0: number; x1: number; z1: number; y: number }, side: Side, at: number, width: number, height: number) {
  for (let w = 0; w < width; w++) {
    for (let k = 0; k < height; k++) {
      if (side === 'n') v.set(at + w, o.y + k, o.z1, null);
      else if (side === 's') v.set(at + w, o.y + k, o.z0, null);
      else if (side === 'e') v.set(o.x1, o.y + k, at + w, null);
      else v.set(o.x0, o.y + k, at + w, null);
    }
  }
}

/** Door entity position and yaw for an opening cut by `house` (centered, at walking height). */
export function doorSpot(o: { x0: number; z0: number; x1: number; z1: number; y: number }, side: Side, at: number, width = 1): { pos: Vec3Tuple; yaw: number } {
  const c = at + width / 2;
  switch (side) {
    case 'n':
      return { pos: [c, o.y, o.z1 + 0.5], yaw: 0 };
    case 's':
      return { pos: [c, o.y, o.z0 + 0.5], yaw: 180 };
    case 'e':
      return { pos: [o.x1 + 0.5, o.y, c], yaw: 90 };
    case 'w':
      return { pos: [o.x0 + 0.5, o.y, c], yaw: 270 };
  }
}

/** Iron railing (one block high) along a straight line at height y. */
export function railing(v: VoxelVolume, a: [number, number], b: [number, number], y: number, id = 'core:iron_bars'): void {
  fillBox(v, [a[0], y, a[1]], [b[0], y, b[1]], id);
}

// ------------------------------------------------------------------------------------------------
// Entity shapes
// ------------------------------------------------------------------------------------------------

export function model(s: SceneBuilder, id: string, modelId: string, pos: Vec3Tuple, yaw = 0, extra: Record<string, unknown> = {}): void {
  s.entity(id, pos, { 'core.model': { model: modelId, ...extra } }, { yaw });
}

let autoId = 0;
/** Decorative model with an automatic id (lamps, barrels, crates...). */
export function deco(s: SceneBuilder, modelId: string, pos: Vec3Tuple, yaw = 0, extra: Record<string, unknown> = {}): void {
  const base = modelId.split(':')[1] ?? 'deco';
  let id: string;
  do id = `${base}_${++autoId}`;
  while (s.has(id));
  model(s, id, modelId, pos, yaw, extra);
}

export function light(s: SceneBuilder, id: string, pos: Vec3Tuple, color: string, level: number): void {
  s.entity(id, pos, { 'core.light': { color, level, offset: [0, 0, 0] } });
}

export function sign(s: SceneBuilder, id: string, pos: Vec3Tuple, yaw: number, text: string, size: Vec3Tuple, style = 'plaque', colors: { text?: string; bg?: string } = {}): void {
  s.entity(id, pos, { 'core.sign': { text, size, style, color: colors.text ?? '#2a1d12', background: colors.bg ?? '#d9c39a' } }, { yaw });
}

export function zone(
  s: SceneBuilder,
  id: string,
  pos: Vec3Tuple,
  size: Vec3Tuple,
  name: string,
  opts: { subtitle?: string; music?: string; ambience?: string; showTitle?: boolean } = {},
): void {
  s.entity(id, pos, {
    'core.zone': { name, subtitle: opts.subtitle ?? '', size, offset: [0, 0, 0], showTitle: opts.showTitle ?? true, music: opts.music ?? '', ambience: opts.ambience ?? '' },
  });
}

export function npc(s: SceneBuilder, id: string, pos: Vec3Tuple, yaw: number, props: Record<string, unknown>, extra: Record<string, Record<string, unknown>> = {}, tags?: string[]): void {
  s.entity(id, pos, { 'core.npc': props, ...extra }, { yaw, tags });
}
