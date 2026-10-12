/**
 * Procedural block textures (16×16 pixel art, seamless).
 *
 * Every block texture is generated from a small recipe { gen, colors, seed, params }. This keeps
 * all art original, lets packs define their own looks without image files, and allows a future
 * graphics upgrade to swap generators (or real images) without touching worlds or gameplay.
 *
 * Generators are pure functions (no DOM): they run in the browser, in workers and in Node tests.
 */
import { Rng, hash3 } from '../../util/rng';
import { type RGB, hexToRgb, mixRgb, shade } from '../../util/color';

export const TILE_SIZE = 16;

export class TileCanvas {
  readonly size: number;
  readonly data: Float32Array; // RGBA in 0..1
  constructor(size = TILE_SIZE) {
    this.size = size;
    this.data = new Float32Array(size * size * 4);
  }
  private idx(x: number, y: number): number {
    const s = this.size;
    const xx = ((x % s) + s) % s;
    const yy = ((y % s) + s) % s;
    return (yy * s + xx) * 4;
  }
  set(x: number, y: number, c: RGB, a = 1): void {
    const i = this.idx(x, y);
    this.data[i] = c.r;
    this.data[i + 1] = c.g;
    this.data[i + 2] = c.b;
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const i = this.idx(x, y);
    return { r: this.data[i]!, g: this.data[i + 1]!, b: this.data[i + 2]! };
  }
  alpha(x: number, y: number): number {
    return this.data[this.idx(x, y) + 3]!;
  }
  setAlpha(x: number, y: number, a: number): void {
    this.data[this.idx(x, y) + 3] = a;
  }
  /** Multiplies brightness of a pixel. */
  shadePx(x: number, y: number, k: number): void {
    const i = this.idx(x, y);
    this.data[i] = this.data[i]! * k;
    this.data[i + 1] = this.data[i + 1]! * k;
    this.data[i + 2] = this.data[i + 2]! * k;
  }
  blend(x: number, y: number, c: RGB, t: number): void {
    const cur = this.get(x, y);
    this.set(x, y, mixRgb(cur, c, t), this.alpha(x, y));
  }
  fill(c: RGB, a = 1): void {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.set(x, y, c, a);
  }
  toBytes(): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, this.data[i]!)) * 255);
    return out;
  }
}

export interface TexContext {
  t: TileCanvas;
  rng: Rng;
  seed: number;
  /** Palette colors with derived fallbacks: c(0) base, c(1) dark, c(2) light, c(3+) accents. */
  c: (i: number) => RGB;
  p: (name: string, fallback: number) => number;
}

export type TextureGenerator = (ctx: TexContext) => void;

const S = TILE_SIZE;

/** Seamless value noise over the tile (periodic in x and y with period `cells`). */
export function tileNoise(x: number, y: number, cells: number, seed: number): number {
  const fx = (x / S) * cells;
  const fy = (y / S) * cells;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const u = tx * tx * (3 - 2 * tx);
  const v = ty * ty * (3 - 2 * ty);
  const w = (n: number) => ((n % cells) + cells) % cells;
  const a = hash3(w(x0), w(y0), 0, seed);
  const b = hash3(w(x0 + 1), w(y0), 0, seed);
  const c = hash3(w(x0), w(y0 + 1), 0, seed);
  const d = hash3(w(x0 + 1), w(y0 + 1), 0, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Two-octave seamless noise in [0,1). */
export function tileFbm(x: number, y: number, seed: number): number {
  return 0.65 * tileNoise(x, y, 4, seed) + 0.35 * tileNoise(x, y, 8, seed + 17);
}

function grain(ctx: TexContext, amount: number): void {
  const { t } = ctx;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = hash3(x, y, 7, ctx.seed) - 0.5;
      t.shadePx(x, y, 1 + n * amount);
    }
  }
}

function noiseFill(ctx: TexContext, base: RGB, amount: number, cells = 4): void {
  const { t } = ctx;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = tileNoise(x, y, cells, ctx.seed) - 0.5;
      t.set(x, y, shade(base, n * amount));
    }
  }
}

/** Wrapping distance on the tile torus. */
function wrapDist(ax: number, ay: number, bx: number, by: number): number {
  let dx = Math.abs(ax - bx);
  let dy = Math.abs(ay - by);
  if (dx > S / 2) dx = S - dx;
  if (dy > S / 2) dy = S - dy;
  return Math.hypot(dx, dy);
}

const generators: Record<string, TextureGenerator> = {
  flat(ctx) {
    ctx.t.fill(ctx.c(0));
  },

  checker(ctx) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) ctx.t.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? ctx.c(0) : ctx.c(1));
  },

  noise(ctx) {
    noiseFill(ctx, ctx.c(0), ctx.p('amount', 0.12));
    grain(ctx, ctx.p('grain', 0.08));
  },

  stone(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileFbm(x, y, ctx.seed);
        let c = shade(ctx.c(0), (n - 0.5) * 0.22);
        if (n > 0.72) c = mixRgb(c, ctx.c(2), 0.35);
        if (n < 0.28) c = mixRgb(c, ctx.c(1), 0.35);
        t.set(x, y, c);
      }
    }
    // Hairline cracks.
    const cracks = ctx.p('cracks', 2);
    for (let k = 0; k < cracks; k++) {
      let x = ctx.rng.int(0, S - 1);
      let y = ctx.rng.int(0, S - 1);
      const len = ctx.rng.int(3, 6);
      for (let i = 0; i < len; i++) {
        t.blend(x, y, ctx.c(1), 0.55);
        x += ctx.rng.int(-1, 1);
        y += ctx.rng.chance(0.6) ? 1 : 0;
      }
    }
    grain(ctx, 0.07);
  },

  cobble(ctx) {
    const { t, rng } = ctx;
    const n = ctx.p('stones', 7);
    const seeds: { x: number; y: number; tone: number }[] = [];
    for (let i = 0; i < n; i++) seeds.push({ x: rng.range(0, S), y: rng.range(0, S), tone: rng.range(-0.18, 0.18) });
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let d1 = Infinity;
        let d2 = Infinity;
        let best = seeds[0]!;
        for (const s of seeds) {
          const d = wrapDist(x + 0.5, y + 0.5, s.x, s.y);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = s;
          } else if (d < d2) d2 = d;
        }
        const edge = d2 - d1;
        if (edge < 0.9) {
          t.set(x, y, shade(ctx.c(1), (tileNoise(x, y, 8, ctx.seed) - 0.5) * 0.2));
        } else {
          let c = shade(ctx.c(0), best.tone + (tileNoise(x, y, 8, ctx.seed + 3) - 0.5) * 0.12);
          if (edge < 1.8) c = shade(c, -0.12);
          t.set(x, y, c);
        }
      }
    }
    // Bevel highlight on the upper-left of stones.
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const here = t.get(x, y);
        const up = t.get(x, y - 1);
        if (luminance(up) < luminance(here) - 0.12) t.blend(x, y, ctx.c(2), 0.25);
      }
    }
    grain(ctx, 0.06);
  },

  bricks(ctx) {
    const { t, rng } = ctx;
    const bw = ctx.p('w', 8);
    const bh = ctx.p('h', 4);
    const rows = S / bh;
    const tones: number[][] = [];
    for (let r = 0; r < rows; r++) {
      tones.push([]);
      for (let k = 0; k < S / bw + 1; k++) tones[r]!.push(rng.range(-0.14, 0.14));
    }
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / bh);
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = 0; x < S; x++) {
        const lx = (x + offset) % S;
        const col = Math.floor(lx / bw);
        const mortarY = y % bh === bh - 1;
        const mortarX = lx % bw === bw - 1;
        if (mortarY || mortarX) {
          t.set(x, y, shade(ctx.c(1), (hash3(x, y, 1, ctx.seed) - 0.5) * 0.1));
          continue;
        }
        let c = shade(ctx.c(0), tones[row]![col]! + (tileNoise(x, y, 8, ctx.seed) - 0.5) * 0.12);
        if (y % bh === 0) c = mixRgb(c, ctx.c(2), 0.18);
        if (y % bh === bh - 2 || lx % bw === bw - 2) c = shade(c, -0.08);
        t.set(x, y, c);
      }
    }
    grain(ctx, 0.05);
  },

  stoneBricks(ctx) {
    const { t, rng } = ctx;
    const bw = ctx.p('w', 8);
    const bh = ctx.p('h', 8);
    const tones = Array.from({ length: 8 }, () => rng.range(-0.1, 0.1));
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / bh);
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = 0; x < S; x++) {
        const lx = (x + offset) % S;
        const col = Math.floor(lx / bw);
        const ly = y % bh;
        const cx = lx % bw;
        if (ly === bh - 1 || cx === bw - 1) {
          t.set(x, y, ctx.c(1));
          continue;
        }
        let c = shade(ctx.c(0), tones[(row * 3 + col) % tones.length]! + (tileFbm(x, y, ctx.seed) - 0.5) * 0.16);
        if (ly === 0 || cx === 0) c = mixRgb(c, ctx.c(2), 0.28);
        if (ly === bh - 2 || cx === bw - 2) c = shade(c, -0.12);
        t.set(x, y, c);
      }
    }
    grain(ctx, 0.05);
  },

  planks(ctx) {
    const { t, rng } = ctx;
    const ph = ctx.p('h', 4);
    const rows = S / ph;
    const joints = Array.from({ length: rows }, () => rng.int(0, S - 1));
    const tones = Array.from({ length: rows }, () => rng.range(-0.1, 0.1));
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / ph);
      for (let x = 0; x < S; x++) {
        const ly = y % ph;
        if (ly === ph - 1) {
          t.set(x, y, ctx.c(1));
          continue;
        }
        const streak = tileNoise(x * 0.25, y * 2, 8, ctx.seed + row) - 0.5;
        let c = shade(ctx.c(0), tones[row]! + streak * 0.22);
        if (ly === 0) c = mixRgb(c, ctx.c(2), 0.2);
        if (x === joints[row]) c = ctx.c(1);
        if ((x === (joints[row]! + 1) % S || x === (joints[row]! + S - 2) % S) && ly === 1) c = shade(ctx.c(1), 0.15);
        t.set(x, y, c);
      }
    }
    grain(ctx, 0.05);
  },

  paintedPlanks(ctx) {
    generators.planks!(ctx);
    const paint = ctx.c(3);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wood = ctx.t.get(x, y);
        const chipped = tileNoise(x, y, 8, ctx.seed + 9) > 0.78;
        if (!chipped) ctx.t.set(x, y, mixRgb(wood, shade(paint, luminance(wood) - 0.45), 0.78));
      }
    }
  },

  logSide(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const groove = tileNoise(x * 2, y * 0.3, 8, ctx.seed);
        let c = shade(ctx.c(0), (groove - 0.5) * 0.3);
        if (groove < 0.3) c = mixRgb(c, ctx.c(1), 0.6);
        t.set(x, y, c);
      }
    }
    grain(ctx, 0.07);
  },

  logTop(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d > 7) {
          t.set(x, y, ctx.c(1));
          continue;
        }
        const ring = Math.sin(d * 1.9 + tileNoise(x, y, 4, ctx.seed) * 2);
        t.set(x, y, shade(ctx.c(0), ring * 0.08 + (d < 1.5 ? 0.06 : 0)));
      }
    }
  },

  tiles(ctx) {
    const { t, rng } = ctx;
    const size = ctx.p('tile', 8);
    const checker = ctx.p('checker', 0);
    const tones = Array.from({ length: 16 }, () => rng.range(-0.06, 0.06));
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (x % size === size - 1 || y % size === size - 1) {
          t.set(x, y, ctx.c(1));
          continue;
        }
        const ti = Math.floor(x / size) + Math.floor(y / size) * (S / size);
        const alt = checker && (Math.floor(x / size) + Math.floor(y / size)) % 2 === 1;
        let c = shade(alt ? ctx.c(2) : ctx.c(0), tones[ti % 16]! + (tileNoise(x, y, 8, ctx.seed) - 0.5) * 0.06);
        if (x % size === 0 || y % size === 0) c = shade(c, 0.07);
        t.set(x, y, c);
      }
    }
    grain(ctx, 0.04);
  },

  roofTiles(ctx) {
    const { t, rng } = ctx;
    const rh = 4;
    const sw = ctx.p('w', 4);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rh);
      const off = row % 2 ? sw / 2 : 0;
      for (let x = 0; x < S; x++) {
        const lx = (x + off) % S;
        const col = Math.floor(lx / sw);
        const ly = y % rh;
        const cx = (lx % sw) - (sw - 1) / 2;
        const tone = (hash3(col, row, 3, ctx.seed) - 0.5) * 0.18;
        let c = shade(ctx.c(0), tone + (rh - 1 - ly) * 0.04);
        const roundedEdge = ly === rh - 1 && Math.abs(cx) > sw / 2 - 1.2;
        if (roundedEdge || Math.abs(cx) > sw / 2 - 0.6) c = ctx.c(1);
        if (ly === 0 && Math.abs(cx) < sw / 2 - 1) c = mixRgb(c, ctx.c(2), 0.25);
        t.set(x, y, c);
      }
    }
    void rng;
    grain(ctx, 0.05);
  },

  plaster(ctx) {
    const { t, rng } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileFbm(x, y, ctx.seed);
        let c = shade(ctx.c(0), (n - 0.5) * 0.1);
        if (tileNoise(x, y, 4, ctx.seed + 5) > 0.82) c = mixRgb(c, ctx.c(1), 0.25);
        t.set(x, y, c);
      }
    }
    if (ctx.p('cracks', 1) > 0 && rng.chance(0.7)) {
      let x = rng.int(0, S - 1);
      let y = rng.int(0, 4);
      for (let i = 0; i < 6; i++) {
        t.blend(x, y, ctx.c(1), 0.5);
        x += rng.int(-1, 1);
        y += 1;
      }
    }
    grain(ctx, 0.04);
  },

  timber(ctx) {
    generators.plaster!(ctx);
    const { t } = ctx;
    const beam = ctx.c(2);
    const w = ctx.p('beam', 2);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const border = x < w || x >= S - w || (ctx.p('top', 1) && y < w) || (ctx.p('bottom', 1) && y >= S - w);
        const brace = ctx.p('brace', 0) !== 0 && Math.abs((ctx.p('brace', 0) > 0 ? x : S - 1 - x) - y) < w * 0.75;
        if (border || brace) t.set(x, y, shade(beam, (tileNoise(x * 0.4, y * 2, 8, ctx.seed) - 0.5) * 0.18));
      }
    }
    grain(ctx, 0.04);
  },

  metal(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const streak = tileNoise(x * 0.2, y * 3, 8, ctx.seed) - 0.5;
        let c = shade(ctx.c(0), streak * 0.14);
        if (x === 0 || y === 0) c = mixRgb(c, ctx.c(2), 0.35);
        if (x === S - 1 || y === S - 1) c = mixRgb(c, ctx.c(1), 0.5);
        t.set(x, y, c);
      }
    }
    if (ctx.p('rivets', 1)) {
      for (const [rx, ry] of [
        [2, 2],
        [13, 2],
        [2, 13],
        [13, 13],
      ] as const) {
        t.set(rx, ry, ctx.c(2));
        t.set(rx + 1, ry + 1, ctx.c(1));
      }
    }
    const patina = ctx.p('patina', 0);
    if (patina > 0) {
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) if (tileFbm(x, y, ctx.seed + 11) > 1 - patina) t.blend(x, y, ctx.c(3), 0.75);
      }
    }
    grain(ctx, 0.03);
  },

  polished(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const band = Math.sin((x + y) * 0.45 + ctx.seed) * 0.5 + 0.5;
        let c = mixRgb(ctx.c(0), ctx.c(2), band * 0.35);
        if (x === 0 || y === 0) c = mixRgb(c, ctx.c(2), 0.4);
        if (x === S - 1 || y === S - 1) c = mixRgb(c, ctx.c(1), 0.5);
        t.set(x, y, c);
      }
    }
    for (let k = 0; k < 4; k++) t.set(ctx.rng.int(1, 14), ctx.rng.int(1, 14), shade(ctx.c(2), 0.4));
  },

  glass(ctx) {
    const { t } = ctx;
    const alpha = ctx.p('alpha', 0.28);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const frame = x === 0 || y === 0 || x === S - 1 || y === S - 1;
        if (frame) {
          t.set(x, y, ctx.c(1), 1);
          continue;
        }
        const streak = Math.abs(x - y - 3) < 1 || Math.abs(x - y + 5) < 0.6;
        t.set(x, y, streak ? shade(ctx.c(0), 0.5) : ctx.c(0), streak ? Math.min(1, alpha + 0.3) : alpha);
      }
    }
  },

  frosted(ctx) {
    const { t } = ctx;
    const alpha = ctx.p('alpha', 0.72);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileFbm(x, y, ctx.seed);
        const frame = ctx.p('frame', 1) && (x === 0 || y === 0 || x === S - 1 || y === S - 1);
        if (frame) t.set(x, y, ctx.c(1), 1);
        else t.set(x, y, shade(ctx.c(0), (n - 0.5) * 0.12), alpha + (n - 0.5) * 0.1);
      }
    }
  },

  dirt(ctx) {
    noiseFill(ctx, ctx.c(0), 0.18, 8);
    for (let k = 0; k < 7; k++) ctx.t.set(ctx.rng.int(0, 15), ctx.rng.int(0, 15), ctx.rng.chance(0.5) ? ctx.c(1) : ctx.c(2));
    grain(ctx, 0.08);
  },

  grassTop(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileFbm(x, y, ctx.seed);
        let c = shade(ctx.c(0), (n - 0.5) * 0.25);
        if (hash3(x, y, 2, ctx.seed) > 0.86) c = mixRgb(c, ctx.c(2), 0.5);
        if (hash3(x, y, 4, ctx.seed) < 0.06) c = mixRgb(c, ctx.c(1), 0.5);
        t.set(x, y, c);
      }
    }
  },

  grassSide(ctx) {
    const dirtCtx: TexContext = { ...ctx, c: (i) => ctx.c(i + 3) };
    generators.dirt!(dirtCtx);
    const { t } = ctx;
    for (let x = 0; x < S; x++) {
      const depth = 2 + Math.floor(hash3(x, 0, 9, ctx.seed) * 3);
      for (let y = 0; y < depth; y++) t.set(x, y, shade(ctx.c(0), (hash3(x, y, 3, ctx.seed) - 0.5) * 0.2 - y * 0.04));
    }
  },

  sand(ctx) {
    noiseFill(ctx, ctx.c(0), 0.08, 8);
    grain(ctx, 0.12);
  },

  leaves(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileFbm(x, y, ctx.seed);
        const hole = hash3(x, y, 5, ctx.seed) < ctx.p('holes', 0.14);
        t.set(x, y, shade(mixRgb(ctx.c(0), ctx.c(2), n > 0.6 ? 0.4 : 0), (n - 0.5) * 0.3), hole ? 0 : 1);
      }
    }
  },

  cloth(ctx) {
    const { t } = ctx;
    const stripes = ctx.p('stripes', 0);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const weave = (x + y) % 2 === 0 ? 0.04 : -0.04;
        let base = ctx.c(0);
        if (stripes > 0 && Math.floor(y / stripes) % 2 === 1) base = ctx.c(2);
        t.set(x, y, shade(base, weave + (tileNoise(x, y, 4, ctx.seed) - 0.5) * 0.08));
      }
    }
  },

  carpet(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
        let c = ctx.c(0);
        if (edge === 1) c = ctx.c(2);
        else if (edge === 0) c = ctx.c(1);
        else {
          const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
          if (Math.abs(d - 4) < 0.6) c = ctx.c(3);
        }
        t.set(x, y, shade(c, (x + y) % 2 ? 0.03 : -0.03));
      }
    }
  },

  books(ctx) {
    const { t, rng } = ctx;
    const shelf = ctx.c(1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) t.set(x, y, shade(ctx.c(0), (tileNoise(x, y, 8, ctx.seed) - 0.5) * 0.1));
    const rowsY = [
      [1, 7],
      [9, 15],
    ] as const;
    const spineColors = [ctx.c(3), ctx.c(4), ctx.c(5), ctx.c(2), shade(ctx.c(3), -0.25)];
    for (const [y0, y1] of rowsY) {
      let x = 1;
      while (x < 15) {
        const w = rng.int(1, 2);
        const h = rng.int(4, 6);
        const col = rng.pick(spineColors);
        for (let xx = x; xx < Math.min(15, x + w); xx++) {
          for (let yy = y1 - h; yy < y1; yy++) t.set(xx, yy, shade(col, xx === x ? 0.12 : -0.05));
          t.set(xx, y1 - h + 1, shade(col, 0.3));
        }
        x += w + (rng.chance(0.2) ? 1 : 0);
      }
      for (let xx = 0; xx < S; xx++) t.set(xx, y1, shelf);
      void y0;
    }
    for (let y = 0; y < S; y++) {
      t.set(0, y, shelf);
      t.set(15, y, shelf);
    }
  },

  crystal(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const facet = Math.floor((x * 0.7 + y * 1.3 + tileNoise(x, y, 4, ctx.seed) * 6) / 3) % 3;
        let c = facet === 0 ? ctx.c(0) : facet === 1 ? ctx.c(2) : ctx.c(1);
        if (hash3(x, y, 8, ctx.seed) > 0.93) c = shade(ctx.c(2), 0.5);
        t.set(x, y, c);
      }
    }
  },

  lamp(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
        if (edge < ctx.p('frame', 2)) {
          t.set(x, y, shade(ctx.c(1), (hash3(x, y, 1, ctx.seed) - 0.5) * 0.1));
        } else {
          const d = Math.hypot(x - 7.5, y - 7.5) / 8;
          t.set(x, y, mixRgb(shade(ctx.c(0), 0.35), ctx.c(0), Math.min(1, d * 1.2)));
        }
      }
    }
    // Lattice bars.
    for (let i = 0; i < S; i++) {
      t.blend(7, i, ctx.c(1), 0.6);
      t.blend(i, 7, ctx.c(1), 0.6);
    }
  },

  mosaic(ctx) {
    const { t } = ctx;
    const colors = [ctx.c(0), ctx.c(2), ctx.c(3), ctx.c(4)];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (x % 4 === 3 || y % 4 === 3) {
          t.set(x, y, ctx.c(1));
          continue;
        }
        const cell = hash3(Math.floor(x / 4), Math.floor(y / 4), 6, ctx.seed);
        const col = colors[Math.floor(cell * colors.length)]!;
        t.set(x, y, shade(col, (hash3(x, y, 2, ctx.seed) - 0.5) * 0.1 + (x % 4 === 0 || y % 4 === 0 ? 0.08 : 0)));
      }
    }
  },

  marble(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const turb = tileFbm(x, y, ctx.seed) * 5;
        const vein = Math.abs(Math.sin(((x + y) / S) * Math.PI * 2 + turb));
        let c = shade(ctx.c(0), (tileNoise(x, y, 4, ctx.seed + 2) - 0.5) * 0.06);
        if (vein < 0.12) c = mixRgb(c, ctx.c(1), 0.6);
        else if (vein < 0.22) c = mixRgb(c, ctx.c(1), 0.2);
        t.set(x, y, c);
      }
    }
  },

  ornament(ctx) {
    const { t } = ctx;
    generators.stone!(ctx);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const band = y < 3 || y > 12;
        if (band) {
          const motif = (x + (y < 3 ? 0 : 2)) % 4 < 2;
          t.set(x, y, motif ? ctx.c(3) : shade(ctx.c(3), -0.3));
          if (y === 0 || y === 15) t.set(x, y, shade(ctx.c(3), -0.45));
        }
      }
    }
  },

  grate(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const bar = x % 4 === 1 || x % 4 === 2;
        const band = y === 2 || y === 3 || y === 12 || y === 13;
        if (bar || band) t.set(x, y, shade(ctx.c(0), x % 4 === 1 || y % 2 === 0 ? 0.12 : -0.12), 1);
        else t.set(x, y, ctx.c(0), 0);
      }
    }
  },

  paper(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let c = shade(ctx.c(0), (tileNoise(x, y, 8, ctx.seed) - 0.5) * 0.08);
        if (y % 3 === 2 && x > 1 && x < 14 && ctx.p('lines', 1)) c = mixRgb(c, ctx.c(1), 0.35);
        t.set(x, y, c);
      }
    }
  },

  rune(ctx) {
    generators.stoneBricks!(ctx);
    const { t } = ctx;
    // A simple closed glyph: ring with a vertical stroke (generic, original symbol).
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (Math.abs(d - 4.5) < 0.6 || (Math.abs(x - 7.5) < 0.6 && y > 3 && y < 12)) t.set(x, y, ctx.c(3));
      }
    }
  },

  lockPlate(ctx) {
    generators.metal!({ ...ctx, p: (n, f) => (n === 'rivets' ? 1 : ctx.p(n, f)) });
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 7.5, y - 6);
        if (d < 2.2 || (Math.abs(x - 7.5) < 1 && y >= 6 && y <= 11)) t.set(x, y, shade(ctx.c(1), -0.5));
      }
    }
  },

  panel(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
        let c = shade(ctx.c(0), (tileNoise(x * 0.4, y * 2, 8, ctx.seed) - 0.5) * 0.12);
        if (edge === 0) c = ctx.c(1);
        else if (edge === 2) c = shade(c, -0.14);
        else if (edge === 3) c = shade(c, 0.1);
        t.set(x, y, c);
      }
    }
  },

  darkstone(ctx) {
    generators.stone!(ctx);
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) if (hash3(x, y, 12, ctx.seed) > 0.94) t.set(x, y, ctx.c(3));
    }
  },

  /** Cross-shaped plant with flower heads (cutout): c0 stem, c1 dark stem, c2 flower, c3 flower center. */
  plant(ctx) {
    const { t, rng } = ctx;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) t.set(x, y, ctx.c(0), 0);
    const stems = ctx.p('stems', 4);
    for (let k = 0; k < stems; k++) {
      let x = 2 + Math.floor((k + 0.5) * (12 / stems)) + rng.int(-1, 1);
      const top = rng.int(3, 7);
      for (let y = S - 1; y >= top; y--) {
        t.set(x, y, y % 3 === 0 ? ctx.c(1) : ctx.c(0), 1);
        if (rng.chance(0.18)) x += rng.chance(0.5) ? 1 : -1;
        x = Math.max(1, Math.min(14, x));
        if (rng.chance(0.25) && y > top + 2) t.set(x + (rng.chance(0.5) ? 1 : -1), y, ctx.c(0), 1);
      }
      if (ctx.p('flowers', 1)) {
        for (const [dx, dy] of [
          [0, -1],
          [-1, 0],
          [1, 0],
          [0, 1],
        ] as const)
          t.set(x + dx, top + dy, ctx.c(2), 1);
        t.set(x, top, ctx.c(3), 1);
      }
    }
  },

  /** Grass tuft (cutout). */
  grassTuft(ctx) {
    const { t, rng } = ctx;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) t.set(x, y, ctx.c(0), 0);
    for (let k = 0; k < 9; k++) {
      let x = rng.int(1, 14);
      const h = rng.int(5, 12);
      for (let i = 0; i < h; i++) {
        const y = S - 1 - i;
        t.set(x, y, shade(i > h * 0.6 ? ctx.c(2) : ctx.c(0), (rng.next() - 0.5) * 0.15), 1);
        if (rng.chance(0.2)) x = Math.max(0, Math.min(15, x + (rng.chance(0.5) ? 1 : -1)));
      }
    }
  },

  thatch(ctx) {
    const { t } = ctx;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const strand = tileNoise(x * 3 + y * 0.5, y * 0.5, 8, ctx.seed);
        let c = shade(ctx.c(0), (strand - 0.5) * 0.35);
        if (strand < 0.25) c = mixRgb(c, ctx.c(1), 0.5);
        if (strand > 0.8) c = mixRgb(c, ctx.c(2), 0.4);
        t.set(x, y, c);
      }
    }
  },
};

function luminance(c: RGB): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

export function listTextureGenerators(): string[] {
  return Object.keys(generators).sort();
}

export function hasTextureGenerator(name: string): boolean {
  return name in generators;
}

/** Registers an additional generator (packs may contribute their own looks). */
export function registerTextureGenerator(name: string, gen: TextureGenerator): void {
  generators[name] = gen;
}

/** Generates a 16×16 RGBA tile from a recipe. Unknown generators produce the "missing" checker. */
export function generateTile(gen: string, colors: readonly string[], seed = 0, params: Record<string, number> = {}): Uint8ClampedArray {
  const parsed = colors.map((c) => hexToRgb(c));
  const base = parsed[0] ?? { r: 1, g: 0, b: 1 };
  const derived = (i: number): RGB => {
    const c = parsed[i];
    if (c) return c;
    if (i === 1) return shade(base, -0.35);
    if (i === 2) return shade(base, 0.25);
    return shade(base, i % 2 ? -0.2 : 0.15);
  };
  const t = new TileCanvas(S);
  const fullSeed = (seed * 7919 + hashColors(colors)) >>> 0;
  const ctx: TexContext = {
    t,
    rng: new Rng(fullSeed),
    seed: fullSeed,
    c: derived,
    p: (name, fallback) => params[name] ?? fallback,
  };
  const g = generators[gen] ?? generators.checker!;
  if (!generators[gen]) {
    ctx.c = (i) => (i === 0 ? { r: 1, g: 0, b: 1 } : { r: 0.1, g: 0.1, b: 0.1 });
  }
  t.fill(ctx.c(0));
  g(ctx);
  return t.toBytes();
}

function hashColors(colors: readonly string[]): number {
  let h = 2166136261;
  for (const c of colors) for (let i = 0; i < c.length; i++) h = Math.imul(h ^ c.charCodeAt(i), 16777619);
  return h >>> 0;
}
