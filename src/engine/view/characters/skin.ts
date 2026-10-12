/**
 * Stylized humanoid characters: body layout + procedural pixel-art skin.
 *
 * Pure module (no Babylon): given a CharacterDoc it produces the boxes of each body part (in
 * "pixels" of 1/16 m before scaling), their UV nets, and the RGBA texture. Faces are repainted for
 * expressions and blinks. All designs are original.
 */
import type { CharacterDoc } from '../../core/content/schemas';
import { hexToRgb, mixRgb, shade, type RGB } from '../../core/util/color';
import { Rng, hashString } from '../../core/util/rng';

export const TEX_SIZE = 256;
/** Texels per model pixel. */
export const K = 2;

export type BoneName = 'root' | 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
export type FaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoxPart {
  name: string;
  bone: BoneName;
  /** Min corner relative to the bone pivot (px). */
  min: [number, number, number];
  size: [number, number, number];
  uv: Record<FaceName, Rect>;
  omit?: FaceName[];
}

export interface CharacterLayout {
  boxes: BoxPart[];
  /** Pivots (px): body/legs relative to root, head/arms relative to body. */
  pivots: Record<Exclude<BoneName, 'root'>, [number, number, number]>;
  heightPx: number;
  /** Meters per pixel (character height scaling). */
  scale: number;
  dims: { legH: number; torsoH: number; torsoW: number; torsoD: number; armW: number; armH: number; head: number };
}

export type Expression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'worried' | 'determined' | 'closed';

/** Simple shelf allocator for UV nets. */
class Atlas {
  private x = 0;
  private y = 0;
  private rowH = 0;
  alloc(w: number, h: number): { x: number; y: number } {
    if (this.x + w > TEX_SIZE) {
      this.x = 0;
      this.y += this.rowH;
      this.rowH = 0;
    }
    if (this.y + h > TEX_SIZE) throw new Error('Texture de personnage pleine.');
    const r = { x: this.x, y: this.y };
    this.x += w;
    this.rowH = Math.max(this.rowH, h);
    return r;
  }
}

function net(atlas: Atlas, w: number, h: number, d: number): Record<FaceName, Rect> {
  const W = Math.ceil(w * K);
  const H = Math.ceil(h * K);
  const D = Math.ceil(d * K);
  const o = atlas.alloc(2 * D + 2 * W, D + H);
  return {
    top: { x: o.x + D, y: o.y, w: W, h: D },
    bottom: { x: o.x + D + W, y: o.y, w: W, h: D },
    right: { x: o.x, y: o.y + D, w: D, h: H },
    front: { x: o.x + D, y: o.y + D, w: W, h: H },
    left: { x: o.x + D + W, y: o.y + D, w: D, h: H },
    back: { x: o.x + 2 * D + W, y: o.y + D, w: W, h: H },
  };
}

export function layoutCharacter(doc: CharacterDoc): CharacterLayout {
  const body = doc.build.body;
  const child = body === 'child';
  const legH = child ? 8 : 12;
  const torsoH = child ? 9 : 12;
  const torsoW = body === 'broad' ? 10 : 8;
  const torsoD = 4;
  const armW = body === 'slim' || child ? 3 : 4;
  const armH = child ? 9 : 12;
  const head = 8;
  const heightPx = legH + torsoH + head;
  const targetM = 1.8 * doc.build.height;
  const scale = targetM / heightPx;
  const atlas = new Atlas();
  const boxes: BoxPart[] = [];
  const add = (name: string, bone: BoneName, min: [number, number, number], size: [number, number, number], omit?: FaceName[]) => {
    boxes.push({ name, bone, min, size, uv: net(atlas, size[0], size[1], size[2]), omit });
  };
  add('head', 'head', [-head / 2, 0, -head / 2], [head, head, head]);
  add('torso', 'body', [-torsoW / 2, 0, -torsoD / 2], [torsoW, torsoH, torsoD]);
  add('armL', 'armL', [-armW / 2, -(armH - 2), -2], [armW, armH, 4]);
  add('armR', 'armR', [-armW / 2, -(armH - 2), -2], [armW, armH, 4]);
  add('legL', 'legL', [-2, -legH, -2], [4, legH, 4]);
  add('legR', 'legR', [-2, -legH, -2], [4, legH, 4]);
  // Outer hair layer (slightly larger than the head, transparent where there is no hair).
  if (doc.hair.style !== 'bald') add('hair', 'head', [-4.4, -0.2, -4.4], [8.8, 8.6, 8.8], ['bottom']);
  // Hair volumes.
  if (doc.hair.style === 'bun') add('bun', 'head', [-2, 8, -3.5], [4, 3, 4]);
  if (doc.hair.style === 'ponytail') add('ponytail', 'head', [-1.5, 1, -6], [3, 6, 2]);
  if (doc.hair.style === 'braids') {
    add('braidL', 'head', [-5, -4, -1], [2, 7, 2]);
    add('braidR', 'head', [3, -4, -1], [2, 7, 2]);
  }
  if (doc.hair.style === 'mohawk') add('mohawk', 'head', [-1, 8, -4], [2, 2.5, 8]);
  // Long skirts/robes cover the legs with a single box.
  if (doc.outfit.style === 'robe' || doc.outfit.style === 'dress') add('skirt', 'body', [-torsoW / 2 - 0.5, -legH * 0.72, -torsoD / 2 - 0.5], [torsoW + 1, legH * 0.72 + 1, torsoD + 1]);
  if (doc.outfit.style === 'coat') add('coatTail', 'body', [-torsoW / 2 - 0.3, -5, -torsoD / 2 - 0.3], [torsoW + 0.6, 5.5, torsoD + 0.6], ['top']);
  for (const acc of doc.accessories) {
    switch (acc.type) {
      case 'hat':
        add('hatBrim', 'head', [-6, 7.6, -6], [12, 1, 12]);
        add('hatCrown', 'head', [-4.5, 8.4, -4.5], [9, 4, 9]);
        break;
      case 'cap':
        add('cap', 'head', [-4.5, 6.5, -4.5], [9, 2.5, 9]);
        add('capVisor', 'head', [-3.5, 6.5, 4.4], [7, 0.8, 3]);
        break;
      case 'helmet':
        add('helmet', 'head', [-4.6, 4.5, -4.6], [9.2, 4.2, 9.2], ['bottom']);
        break;
      case 'hood':
        add('hood', 'head', [-4.8, -0.4, -4.8], [9.6, 9.4, 9.6], ['front', 'bottom']);
        break;
      case 'goggles':
        add('goggles', 'head', [-4.5, 4.6, -4.5], [9, 2, 9]);
        break;
      case 'scarf':
        add('scarf', 'body', [-torsoW / 2 - 0.4, torsoH - 2, -torsoD / 2 - 0.6], [torsoW + 0.8, 2.6, torsoD + 1.2]);
        break;
      case 'satchel':
        add('satchel', 'body', [torsoW / 2 - 1, 1, -torsoD / 2 - 1.5], [3, 4, 2]);
        break;
      case 'cape':
        add('cape', 'body', [-torsoW / 2, -legH * 0.7, -torsoD / 2 - 1], [torsoW, torsoH + legH * 0.7, 1]);
        break;
      case 'plaque': {
        // Worn on the chest: below a pendant, in front of an apron.
        const has = (type: string) => doc.accessories.some((a) => a.type === type);
        add('plaque', 'body', [-1.5, torsoH - 6 - (has('pendant') ? 2.5 : 0), torsoD / 2 + (has('apron') ? 0.6 : 0)], [3, 2.5, 0.6]);
        break;
      }
      case 'apron':
        add('apron', 'body', [-torsoW / 2 + 1, -legH * 0.6, torsoD / 2], [torsoW - 2, torsoH - 3 + legH * 0.6, 0.6]);
        break;
      case 'epaulettes':
        add('epauletteL', 'armL', [-armW / 2 - 0.3, 0.5, -2.3], [armW + 0.6, 1.2, 4.6]);
        add('epauletteR', 'armR', [-armW / 2 - 0.3, 0.5, -2.3], [armW + 0.6, 1.2, 4.6]);
        break;
      case 'flower':
        add('flower', 'head', [2, 7, 1], [2, 2, 2]);
        break;
      case 'veil':
        add('veil', 'head', [-4.6, -3, -4.8], [9.2, 11, 1], []);
        break;
      case 'keyring':
        add('keyring', 'body', [-torsoW / 2 - 1, 0, 0], [1.2, 3, 1.2]);
        break;
      case 'mask':
        add('mask', 'head', [-4.3, 0.6, 4.45], [8.6, 7, 0.8]);
        break;
      case 'halfmask':
        add('mask', 'head', [-4.3, 3, 4.45], [8.6, 3.8, 0.8]);
        break;
      default:
        break; // painted accessories (glasses, badge, gloves, pendant, belt, bandana)
    }
  }
  return {
    boxes,
    pivots: {
      body: [0, legH, 0],
      head: [0, torsoH, 0],
      armL: [-(torsoW / 2 + armW / 2), torsoH - 2, 0],
      armR: [torsoW / 2 + armW / 2, torsoH - 2, 0],
      legL: [-2, legH, 0],
      legR: [2, legH, 0],
    },
    heightPx,
    scale,
    dims: { legH, torsoH, torsoW, torsoD, armW, armH, head },
  };
}

// ---------------------------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------------------------

class Canvas {
  readonly data = new Uint8Array(TEX_SIZE * TEX_SIZE * 4);
  set(x: number, y: number, c: RGB, a = 1): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= TEX_SIZE || y >= TEX_SIZE) return;
    const i = (y * TEX_SIZE + x) * 4;
    this.data[i] = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
    this.data[i + 1] = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
    this.data[i + 2] = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
    this.data[i + 3] = Math.round(a * 255);
  }
  clear(r: Rect): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.set(x, y, { r: 0, g: 0, b: 0 }, 0);
  }
  fill(r: Rect, c: RGB, rng?: Rng, vary = 0.04, alpha = 1): void {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) this.set(x, y, rng ? shade(c, (rng.next() - 0.5) * 2 * vary) : c, alpha);
  }
  /** Fills a rectangle given in model pixels within a face rect (px coordinates from top-left). */
  px(face: Rect, px: number, py: number, pw: number, ph: number, c: RGB, a = 1): void {
    for (let y = 0; y < ph * K; y++) for (let x = 0; x < pw * K; x++) this.set(face.x + px * K + x, face.y + py * K + y, c, a);
  }
  /** Single texel inside a face (texel coordinates). */
  tx(face: Rect, x: number, y: number, c: RGB, a = 1): void {
    if (x < 0 || y < 0 || x >= face.w || y >= face.h) return;
    this.set(face.x + x, face.y + y, c, a);
  }
}

function faces(b: BoxPart, names: FaceName[] = ['front', 'back', 'right', 'left', 'top', 'bottom']): Rect[] {
  return names.map((n) => b.uv[n]);
}

export interface SkinResult {
  pixels: Uint8Array;
  layout: CharacterLayout;
  /** Repaints the face for an expression (and returns the same pixel buffer). */
  setExpression(expr: Expression): Uint8Array;
}

export function paintCharacter(doc: CharacterDoc): SkinResult {
  const layout = layoutCharacter(doc);
  const cv = new Canvas();
  const rng = new Rng(hashString(doc.id));
  const C = (hex: string) => hexToRgb(hex);
  const skin = C(doc.skin);
  const skinDark = shade(skin, -0.18);
  const hair = C(doc.hair.color);
  const top = C(doc.outfit.top);
  const bottom = C(doc.outfit.bottom);
  const shoes = C(doc.outfit.shoes);
  const accent = C(doc.outfit.accent);
  const trim = doc.outfit.trim ? C(doc.outfit.trim) : shade(accent, -0.1);
  const box = (name: string) => layout.boxes.find((b) => b.name === name);
  const acc = (type: string) => doc.accessories.find((a) => a.type === type);
  const d = layout.dims;

  // --- Head ----------------------------------------------------------------------------------
  const head = box('head')!;
  for (const f of faces(head)) cv.fill(f, skin, rng, 0.025);
  // Neck shadow under the chin.
  cv.px(head.uv.bottom, 0, 0, 8, 8, skinDark);

  // --- Hair layer ------------------------------------------------------------------------------
  const hairBox = box('hair');
  const style = doc.hair.style;
  const hairPix = (c: RGB) => shade(c, (rng.next() - 0.5) * 0.12);
  if (hairBox) {
    for (const f of faces(hairBox)) cv.clear(f);
    const hb = hairBox.uv;
    const rows = (f: Rect, fromTop: number) => {
      const n = Math.round(fromTop * K);
      for (let y = 0; y < Math.min(n, f.h); y++) for (let x = 0; x < f.w; x++) cv.tx(f, x, y, hairPix(hair));
    };
    cv.fill(hb.top, hair, rng, 0.06);
    const sideDepth = { short: 3, long: 8.6, bun: 3, ponytail: 3, curly: 4.5, braids: 4, mohawk: 0, swept: 3.5, bob: 6, bald: 0 }[style] ?? 3;
    const backDepth = { short: 4, long: 8.6, bun: 6, ponytail: 5, curly: 5, braids: 6, mohawk: 0, swept: 4, bob: 6.5, bald: 0 }[style] ?? 4;
    rows(hb.left, sideDepth);
    rows(hb.right, sideDepth);
    rows(hb.back, backDepth);
    // Fringe on the front.
    const fringe = style === 'swept' ? 2.5 : style === 'curly' ? 2 : style === 'mohawk' ? 0 : 1.2;
    for (let y = 0; y < Math.round(fringe * K); y++) {
      for (let x = 0; x < hb.front.w; x++) {
        const swept = style === 'swept' ? y < Math.round(fringe * K) - Math.floor(x / 4) : true;
        if (swept) cv.tx(hb.front, x, y, hairPix(hair));
      }
    }
    if (style === 'curly') {
      for (const f of [hb.left, hb.right, hb.back, hb.front]) {
        const edge = Math.round((f === hb.front ? fringe : f === hb.back ? backDepth : sideDepth) * K);
        for (let x = 0; x < f.w; x += 3) cv.tx(f, x, edge, hairPix(hair));
      }
    }
    if (style === 'mohawk') {
      cv.clear(hb.top);
      for (let y = 0; y < hb.top.h; y++) for (let x = Math.floor(hb.top.w / 2) - 2; x < Math.floor(hb.top.w / 2) + 2; x++) cv.tx(hb.top, x, y, hairPix(hair));
    }
    // Long hair falls onto the shoulders: paint the back of the torso top too.
    if (style === 'long') {
      const torso = box('torso')!;
      cv.px(torso.uv.back, 0, 0, d.torsoW, 4, hair);
    }
  }
  for (const n of ['bun', 'ponytail', 'braidL', 'braidR', 'mohawk']) {
    const b = box(n);
    if (b) for (const f of faces(b)) cv.fill(f, hair, rng, 0.08);
  }

  // --- Torso -----------------------------------------------------------------------------------
  const torso = box('torso')!;
  for (const f of faces(torso)) cv.fill(f, top, rng, 0.03);
  const tf = torso.uv.front;
  const neckline = (w: number) => cv.px(tf, d.torsoW / 2 - w / 2, 0, w, 1, skin);
  switch (doc.outfit.style) {
    case 'tunic':
      neckline(3);
      cv.px(tf, d.torsoW / 2 - 0.5, 1, 1, 2, skinDark);
      cv.px(tf, 0, d.torsoH - 3, d.torsoW, 1, accent);
      break;
    case 'shirt':
      neckline(2);
      for (let y = 2; y < d.torsoH - 1; y += 3) cv.px(tf, d.torsoW / 2 - 0.5, y, 1, 1, accent);
      break;
    case 'coat':
      neckline(2);
      cv.px(tf, d.torsoW / 2 - 2, 0, 1, d.torsoH, shade(top, -0.15));
      cv.px(tf, d.torsoW / 2 + 1, 0, 1, d.torsoH, shade(top, -0.15));
      for (let y = 3; y < d.torsoH; y += 3) cv.px(tf, d.torsoW / 2 + 2, y, 1, 1, accent);
      break;
    case 'robe':
      neckline(2);
      cv.px(tf, d.torsoW / 2 - 0.5, 0, 1, d.torsoH, trim);
      break;
    case 'dress':
      neckline(4);
      cv.px(tf, 0, d.torsoH - 4, d.torsoW, 1, accent);
      break;
    case 'vest': {
      const shirt = C('#e8e0d0');
      cv.px(tf, d.torsoW / 2 - 1, 0, 2, d.torsoH, shirt);
      neckline(2);
      for (let y = 3; y < d.torsoH; y += 3) cv.px(tf, d.torsoW / 2 + 1, y, 1, 1, accent);
      break;
    }
    case 'uniform':
      neckline(2);
      cv.px(tf, 0, 0, d.torsoW, 1, trim);
      cv.px(tf, d.torsoW / 2 - 0.5, 1, 1, d.torsoH - 1, shade(top, -0.12));
      for (let y = 2; y < d.torsoH - 2; y += 2) cv.px(tf, d.torsoW / 2 - 1.5, y, 1, 1, accent);
      cv.px(tf, 0, d.torsoH - 3, d.torsoW, 1, C('#2a2420'));
      cv.px(tf, d.torsoW / 2 - 1, d.torsoH - 3, 2, 1, accent);
      break;
    case 'rags':
      neckline(3);
      for (let i = 0; i < 4; i++) cv.px(tf, rng.int(0, d.torsoW - 2), rng.int(1, d.torsoH - 2), 2, 2, shade(top, rng.range(-0.2, 0.15)));
      for (let x = 0; x < d.torsoW; x += 2) cv.px(tf, x, d.torsoH - 1, 1, 1, shade(top, -0.25));
      break;
  }
  if (acc('belt')) cv.px(tf, 0, d.torsoH - 2, d.torsoW, 1, C(acc('belt')!.color));
  if (acc('badge')) cv.px(tf, 1, 3, 2, 2, C(acc('badge')!.color));
  if (acc('pendant')) {
    cv.px(tf, d.torsoW / 2 - 0.5, 1, 1, 2, C(acc('pendant')!.accent ?? '#c9a24a'));
    cv.px(tf, d.torsoW / 2 - 1, 3, 2, 2, C(acc('pendant')!.color));
  }
  // Back: collar and shading.
  cv.px(torso.uv.back, 0, 0, d.torsoW, 1, shade(top, -0.1));

  // --- Arms ------------------------------------------------------------------------------------
  const hands = acc('gloves') ? C(acc('gloves')!.color) : skin;
  for (const n of ['armL', 'armR']) {
    const arm = box(n)!;
    const sleeve = doc.outfit.style === 'vest' ? C('#e8e0d0') : top;
    for (const f of faces(arm)) cv.fill(f, sleeve, rng, 0.03);
    for (const fname of ['front', 'back', 'right', 'left'] as FaceName[]) {
      const f = arm.uv[fname];
      cv.px(f, 0, d.armH - 3, f.w / K, 3, hands);
      cv.px(f, 0, d.armH - 4, f.w / K, 1, doc.outfit.style === 'uniform' ? trim : shade(sleeve, -0.12));
    }
    cv.fill(arm.uv.bottom, hands);
    if (doc.outfit.style === 'tunic' || doc.outfit.style === 'dress' || doc.outfit.style === 'rags') {
      // Short sleeves.
      for (const fname of ['front', 'back', 'right', 'left'] as FaceName[]) cv.px(arm.uv[fname], 0, 5, arm.uv[fname].w / K, d.armH - 8, skin);
    }
  }

  // --- Legs ------------------------------------------------------------------------------------
  for (const n of ['legL', 'legR']) {
    const leg = box(n)!;
    for (const f of faces(leg)) cv.fill(f, bottom, rng, 0.03);
    for (const fname of ['front', 'back', 'right', 'left'] as FaceName[]) {
      cv.px(leg.uv[fname], 0, d.legH - 2, 4, 2, shoes);
      cv.px(leg.uv[fname], 0, d.legH - 3, 4, 1, shade(bottom, -0.15));
    }
    cv.fill(leg.uv.bottom, shade(shoes, -0.2));
  }

  // --- Long garments and accessories -------------------------------------------------------------
  const skirt = box('skirt');
  if (skirt) {
    for (const f of faces(skirt)) cv.fill(f, doc.outfit.style === 'robe' ? top : bottom, rng, 0.04);
    cv.px(skirt.uv.front, 0, skirt.size[1] - 1, skirt.size[0], 1, trim);
    cv.px(skirt.uv.back, 0, skirt.size[1] - 1, skirt.size[0], 1, trim);
  }
  const coatTail = box('coatTail');
  if (coatTail) for (const f of faces(coatTail)) cv.fill(f, shade(top, -0.04), rng, 0.03);
  const paintSolid = (name: string, c: RGB, alpha = 1) => {
    const b = box(name);
    if (b) for (const f of faces(b)) cv.fill(f, c, rng, 0.05, alpha);
  };
  for (const a of doc.accessories) {
    const col = C(a.color);
    const ac = a.accent ? C(a.accent) : shade(col, 0.25);
    switch (a.type) {
      case 'hat':
        paintSolid('hatBrim', shade(col, -0.08));
        paintSolid('hatCrown', col);
        cv.px(box('hatCrown')!.uv.front, 0, 3, 9, 1, ac);
        break;
      case 'cap':
        paintSolid('cap', col);
        paintSolid('capVisor', shade(col, -0.15));
        break;
      case 'helmet': {
        paintSolid('helmet', col);
        const hb = box('helmet')!;
        cv.px(hb.uv.front, 0, 3, 9.2, 1, ac);
        cv.clear({ x: hb.uv.front.x + 3 * K, y: hb.uv.front.y + 4 * K, w: 3 * K, h: 1 });
        break;
      }
      case 'hood': {
        paintSolid('hood', col);
        break;
      }
      case 'goggles': {
        const g = box('goggles')!;
        for (const f of faces(g)) cv.clear(f);
        for (const fname of ['back', 'right', 'left'] as FaceName[]) cv.px(g.uv[fname], 0, 0.6, g.uv[fname].w / K, 0.8, shade(col, -0.3));
        cv.px(g.uv.front, 0, 0.6, 9, 0.8, shade(col, -0.3));
        cv.px(g.uv.front, 1.5, 0, 2.5, 2, col);
        cv.px(g.uv.front, 5, 0, 2.5, 2, col);
        cv.px(g.uv.front, 2, 0.5, 1.5, 1, C('#9fd2ea'));
        cv.px(g.uv.front, 5.5, 0.5, 1.5, 1, C('#9fd2ea'));
        break;
      }
      case 'scarf':
        paintSolid('scarf', col);
        cv.px(box('scarf')!.uv.front, 1, 0, 2, 2.6, ac);
        break;
      case 'satchel':
        paintSolid('satchel', col);
        // Strap across the torso front.
        for (let i = 0; i < d.torsoH; i++) cv.px(tf, Math.max(0, d.torsoW - 1 - Math.floor((i * d.torsoW) / d.torsoH)), i, 1, 1, shade(col, -0.2));
        break;
      case 'cape':
        paintSolid('cape', col);
        break;
      case 'plaque': {
        paintSolid('plaque', col);
        const p = box('plaque')!;
        cv.px(p.uv.front, 0.5, 0.5, 2, 0.5, ac);
        cv.px(p.uv.front, 0.5, 1.5, 2, 0.5, ac);
        break;
      }
      case 'apron':
        paintSolid('apron', col);
        cv.px(box('apron')!.uv.front, 1, 4, 3, 2, shade(col, -0.12));
        break;
      case 'epaulettes':
        paintSolid('epauletteL', col);
        paintSolid('epauletteR', col);
        break;
      case 'flower':
        paintSolid('flower', col);
        break;
      case 'veil':
        paintSolid('veil', col, 0.85);
        break;
      case 'keyring':
        paintSolid('keyring', col);
        break;
      case 'mask':
      case 'halfmask':
        paintMask(cv, box('mask')!, col, ac, a.pattern ?? 'plain', a.type === 'mask' ? 7.6 : 6.8, rng);
        break;
      case 'bandana': {
        const hb = box('hair')?.uv.front ?? head.uv.front;
        cv.px(hb, 0, 0.6, 8.8, 1.5, col);
        break;
      }
      default:
        break;
    }
  }

  const result: SkinResult = {
    pixels: cv.data,
    layout,
    setExpression(expr: Expression) {
      paintFace(cv, head.uv.front, doc, expr);
      if (acc('glasses')) paintGlasses(cv, head.uv.front, C(acc('glasses')!.color));
      return cv.data;
    },
  };
  result.setExpression('neutral');
  return result;
}

function paintGlasses(cv: Canvas, f: Rect, c: RGB): void {
  for (const ex of [1.5, 4.5]) {
    cv.px(f, ex, 3.5, 2, 0.5, c);
    cv.px(f, ex, 5, 2, 0.5, c);
    cv.px(f, ex, 3.5, 0.5, 2, c);
    cv.px(f, ex + 1.5, 3.5, 0.5, 2, c);
  }
  cv.px(f, 3.5, 4, 1, 0.5, c);
}

/**
 * Paints a mask box. `top` is the head-local height of the mask's top edge: the eye holes are cut
 * where the eyes of the face are (head-local y 3 to 4), so the character still looks through it.
 */
function paintMask(cv: Canvas, b: BoxPart, col: RGB, ac: RGB, pattern: string, top: number, rng: Rng): void {
  const f = b.uv.front;
  const w = b.size[0];
  const h = b.size[1];
  for (const face of faces(b)) cv.fill(face, shade(col, -0.12), rng, 0.03);
  cv.fill(f, col, rng, 0.04);
  // Darker rim.
  cv.px(f, 0, 0, w, 0.5, shade(col, -0.2));
  cv.px(f, 0, h - 0.5, w, 0.5, shade(col, -0.2));
  const eyeY = top - 4.1;
  const holes = [1.7, 5.2];
  switch (pattern) {
    case 'ember':
      // Glowing cracks, like cooling ash.
      for (const [x, y, len] of [
        [1, 1.2, 2],
        [6, 0.8, 1.5],
        [2.5, h - 2.2, 2.5],
        [5.5, h - 1.6, 2],
      ] as const)
        for (let i = 0; i < len * 2; i++) cv.px(f, x + i * 0.5, y + (i % 2) * 0.5, 0.5, 0.5, ac);
      break;
    case 'threads':
      for (let i = 0; i < 6; i++) for (let k = 0; k < h * 2; k++) cv.px(f, (i * 1.6 + k * 0.5) % w, k * 0.5, 0.5, 0.5, shade(ac, (k % 3) * 0.05));
      break;
    case 'rivets':
      cv.px(f, 0, eyeY + 1.6, w, 0.6, shade(ac, -0.1));
      for (const x of [0.5, w - 1]) for (const y of [0.6, h - 1.1]) cv.px(f, x, y, 0.5, 0.5, ac);
      break;
    case 'lens':
      for (const x of holes) {
        cv.px(f, x - 0.5, eyeY - 0.5, 2.6, 0.5, ac);
        cv.px(f, x - 0.5, eyeY + 1.2, 2.6, 0.5, ac);
        cv.px(f, x - 0.5, eyeY - 0.5, 0.5, 2.2, ac);
        cv.px(f, x + 1.6, eyeY - 0.5, 0.5, 2.2, ac);
      }
      break;
    case 'ornate':
      for (let x = 0.5; x < w - 0.5; x += 1.5) cv.px(f, x, 0, 0.5, 1, ac);
      cv.px(f, w / 2 - 0.5, 0.8, 1, 1, shade(ac, 0.2));
      cv.px(f, 0.5, h - 1, w - 1, 0.5, ac);
      break;
    case 'mirror':
      // No eyes: a mirror face with a bright diagonal streak.
      for (let i = 0; i < 6; i++) cv.px(f, 1 + i, h - 1.5 - i, 1, 0.5, mixRgb(col, { r: 1, g: 1, b: 1 }, 0.7));
      return;
    case 'split':
      cv.px(f, w / 2, 0, w / 2, h, ac);
      break;
    default:
      break;
  }
  for (const x of holes) cv.px(f, x, eyeY, 1.6, 1.2, { r: 0, g: 0, b: 0 }, 0);
}

/** Paints eyes, brows, nose and mouth on the head front (8×8 px). */
function paintFace(cv: Canvas, f: Rect, doc: CharacterDoc, expr: Expression): void {
  const skin = hexToRgb(doc.skin);
  const rng = new Rng(hashString(doc.id) + 7);
  // Reset face area below the fringe (rows 2..8).
  for (let y = 2 * K; y < f.h; y++) for (let x = 0; x < f.w; x++) cv.tx(f, x, y, shade(skin, (rng.next() - 0.5) * 0.04));
  const eyeC = hexToRgb(doc.eyes);
  const brow = hexToRgb(doc.face.brows ?? doc.hair.color);
  const white = { r: 0.96, g: 0.95, b: 0.92 };
  const dark = shade(skin, -0.45);
  const lip = mixRgb(skin, { r: 0.65, g: 0.25, b: 0.25 }, 0.45);
  // Texel coordinates (16×16 face at K=2).
  const eyeRow = 8;
  const eyes = [3, 10]; // left-on-screen, right-on-screen (x of the 3-texel wide eye)
  const wide = expr === 'surprised';
  const closed = expr === 'closed';
  for (const ex of eyes) {
    if (closed) {
      for (let x = 0; x < 3; x++) cv.tx(f, ex + x, eyeRow + 1, dark);
      continue;
    }
    const h = wide ? 3 : expr === 'happy' ? 1 : 2;
    const y0 = expr === 'happy' ? eyeRow + 1 : eyeRow;
    for (let y = 0; y < h; y++) for (let x = 0; x < 3; x++) cv.tx(f, ex + x, y0 + y, white);
    // Pupil (inner side) with a tiny highlight.
    const px = ex === eyes[0] ? ex + 1 : ex + 1;
    for (let y = 0; y < h; y++) cv.tx(f, px, y0 + y, eyeC);
    cv.tx(f, px + (ex === eyes[0] ? 1 : -1), y0 + h - 1, shade(eyeC, -0.3));
    if (h >= 2) cv.tx(f, px, y0, shade(eyeC, 0.45));
  }
  // Brows.
  const browY = eyeRow - 2 - (wide ? 1 : 0);
  for (const [i, ex] of eyes.entries()) {
    for (let x = 0; x < 3; x++) {
      let y = browY;
      const inner = i === 0 ? x === 2 : x === 0;
      const outer = i === 0 ? x === 0 : x === 2;
      if (expr === 'angry' || expr === 'determined') y += inner ? 1 : 0;
      if (expr === 'sad' || expr === 'worried') y += outer ? 1 : 0;
      if (expr === 'worried' && inner) y -= 1;
      cv.tx(f, ex + x, y, brow);
    }
  }
  // Nose.
  cv.tx(f, 7, eyeRow + 2, shade(skin, -0.12));
  cv.tx(f, 8, eyeRow + 2, shade(skin, -0.12));
  // Mouth.
  const my = 13;
  switch (expr) {
    case 'happy':
      for (let x = 5; x <= 10; x++) cv.tx(f, x, my, dark);
      cv.tx(f, 4, my - 1, dark);
      cv.tx(f, 11, my - 1, dark);
      break;
    case 'sad':
      for (let x = 6; x <= 9; x++) cv.tx(f, x, my - 1, dark);
      cv.tx(f, 5, my, dark);
      cv.tx(f, 10, my, dark);
      break;
    case 'surprised':
      for (let y = my - 1; y <= my + 1; y++) for (let x = 7; x <= 8; x++) cv.tx(f, x, y, dark);
      break;
    case 'angry':
      for (let x = 5; x <= 10; x++) cv.tx(f, x, my, dark);
      break;
    default:
      for (let x = 6; x <= 9; x++) cv.tx(f, x, my, lip);
      cv.tx(f, 6, my, dark);
      cv.tx(f, 9, my, dark);
  }
  const fc = doc.face;
  if (fc.freckles) for (const [x, y] of [[3, 11], [5, 11], [10, 11], [12, 11], [4, 12], [11, 12]] as const) cv.tx(f, x, y, shade(skin, -0.2));
  if (fc.blush) for (const x of [2, 3, 12, 13]) cv.tx(f, x, 11, mixRgb(skin, { r: 0.9, g: 0.4, b: 0.4 }, 0.4));
  if (fc.wrinkles) {
    cv.tx(f, 2, eyeRow + 1, shade(skin, -0.15));
    cv.tx(f, 13, eyeRow + 1, shade(skin, -0.15));
    for (let x = 6; x <= 9; x++) cv.tx(f, x, 4, shade(skin, -0.08));
  }
  if (fc.scar) for (let i = 0; i < 4; i++) cv.tx(f, 12 - i, 5 + i * 2, mixRgb(skin, { r: 0.75, g: 0.45, b: 0.45 }, 0.6));
  if (fc.beard) {
    const bc = hexToRgb(fc.beard);
    for (let y = 12; y < 16; y++) for (let x = 2; x < 14; x++) if (y > 12 || x < 5 || x > 10) cv.tx(f, x, y, shade(bc, (rng.next() - 0.5) * 0.1));
  }
  if (fc.mustache) {
    const mc = hexToRgb(fc.mustache);
    for (let x = 5; x <= 10; x++) cv.tx(f, x, my - 1, mc);
  }
}
