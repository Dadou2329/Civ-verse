import { defineModel, type ModelBuilder, type VoxelPaint } from '@sdk';

/**
 * Props of Viremasque (fronts toward +Z). Masks and hand tools use small voxels (1/32 m) so they
 * read well in the hand; big machines use larger ones. Everything is drawn here: no prop comes
 * from the other civilizations.
 */

const WOOD = { color: '#8a5e36', vary: 0.06 };
const WOOD_DARK = { color: '#5a3a20', vary: 0.05 };
const IRON = { color: '#5c6064', vary: 0.05 };
const IRON_DARK = '#34383c';
const BRASS = '#c79a42';
const ASH = '#8f8a84';
const EMBER = { color: '#ff7a2e', emissive: true };

// ---------------------------------------------------------------------------------------------
// Masks
// ---------------------------------------------------------------------------------------------

/**
 * A half mask (forehead, eyes and nose bridge) facing +Z, centered on x = 0, at 1/48 m: about
 * 27 cm wide and 17 cm tall, its sides curving back like a face, with almond eye holes. Rows are
 * listed from the top; `detail(x, row)` may repaint a voxel (motifs). Two voxels thick, its lower
 * edge at `oy` and its front at `oz`.
 */
const HALF_MASK = [
  '...#######...',
  '.###########.',
  '#############',
  '##...###...##',
  '##...###...##',
  '.###.###.###.',
  '...#.###.#...',
  '.....###.....',
];

function halfMask(b: ModelBuilder, base: VoxelPaint | string, detail: (x: number, row: number) => VoxelPaint | string | null, oy = 0, oz = 0) {
  const half = (HALF_MASK[0]!.length - 1) / 2;
  HALF_MASK.forEach((line, row) => {
    const y = oy + HALF_MASK.length - 1 - row;
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== '#') continue;
      const x = i - half;
      const back = Math.round((Math.abs(x) / (half + 0.5)) ** 2 * 2.4);
      const paint = detail(x, row) ?? base;
      b.set(x, y, oz - back, paint).set(x, y, oz - back - 1, base);
    }
  });
  // The nose bridge stands out a little.
  for (let row = 3; row < HALF_MASK.length; row++) b.set(0, oy + HALF_MASK.length - 1 - row, oz + 1, base);
}

/** The ember cracks and the darker rim of the Cendre mask. */
const cendreDetail = (x: number, row: number): VoxelPaint | string | null => {
  if ((x === -4 && row === 1) || (x === -3 && row === 2) || (x === 4 && row === 5) || (x === 5 && row === 4) || (x === 2 && row === 0)) return EMBER;
  if (row === 0 || Math.abs(x) === 6) return '#6a6560';
  return null;
};

export const masqueCendre = defineModel({
  id: 'mask:masque_cendre',
  label: 'Masque de Cendre',
  category: 'Viremasque — Masques',
  voxelSize: 1 / 48,
  anchor: 'center',
  collider: 'none',
  build(b) {
    halfMask(b, { color: ASH, vary: 0.06 }, cendreDetail);
    // Leather strap.
    b.box([-7, 4, -6], [-6, 6, -1], '#4a3020').box([6, 4, -6], [7, 6, -1], '#4a3020');
  },
});

const VELVET = { color: '#3a2a34', vary: 0.04 };

/** A turned wooden stand with a dark velvet mannequin head (1/48 m), the mask on its face. */
function maskStand(b: ModelBuilder, withMask: boolean) {
  b.cylinder(0, 0, 7, 0, 2, WOOD_DARK);
  b.cylinder(0, 0, 1.6, 2, 44, WOOD);
  b.cylinder(0, 0, 3, 44, 47, WOOD_DARK);
  b.cylinder(0, 0, 2.6, 47, 51, VELVET);
  // Head: an ellipsoid 23 cm wide, 29 cm tall.
  const [rx, ry, rz] = [5.6, 7.2, 6];
  const cy = 58;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let z = -7; z <= 7; z++)
      for (let x = -6; x <= 6; x++) {
        const d = ((x + 0.5 - 0.5) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - 0.5) / rz) ** 2;
        if (d <= 1) b.set(x, y, z, VELVET);
      }
  if (withMask) {
    // The mask stands slightly off the dark velvet head so that it reads at a glance.
    halfMask(b, { color: '#a8a39c', vary: 0.05 }, cendreDetail, cy - 3, 8);
    for (const x of [-6, 6]) b.box([x, cy, -2], [x + 1, cy + 2, 6], '#4a3020');
  }
}

export const supportMasque = defineModel({
  id: 'mask:support_masque',
  label: 'Support de masque (avec le masque)',
  category: 'Viremasque — Masques',
  voxelSize: 1 / 48,
  build: (b) => maskStand(b, true),
});

export const supportMasqueVide = defineModel({
  id: 'mask:support_masque_vide',
  label: 'Support de masque (vide)',
  category: 'Viremasque — Masques',
  voxelSize: 1 / 48,
  build: (b) => maskStand(b, false),
});

// ---------------------------------------------------------------------------------------------
// Tools in hand
// ---------------------------------------------------------------------------------------------

export const cleAtelier = defineModel({
  id: 'mask:cle_atelier',
  label: 'Clé d’atelier',
  category: 'Viremasque — Outils',
  voxelSize: 1 / 32,
  anchor: 'center',
  collider: 'none',
  build(b) {
    // A heavy adjustable wrench: worn grip, steel shank, open jaw at the top.
    b.box([-1, 0, -1], [2, 7, 2], { color: '#6a3a22', vary: 0.08 });
    b.box([-1, 7, -1], [2, 14, 1], IRON);
    b.box([-3, 14, -1], [4, 16, 1], IRON);
    b.box([-3, 16, -1], [-1, 19, 1], IRON).box([2, 16, -1], [4, 18, 1], IRON);
    b.set(0, 15, 1, BRASS).set(1, 15, 1, BRASS);
  },
});

export const marteauCendre = defineModel({
  id: 'mask:marteau_cendre',
  label: 'Marteau de Cendre',
  category: 'Viremasque — Outils',
  voxelSize: 1 / 32,
  anchor: 'center',
  collider: 'none',
  build(b) {
    // Dark ash-wrapped handle, iron head with ember lines that glow when Braise charges.
    b.box([-1, 0, -1], [1, 15, 1], WOOD_DARK);
    for (const y of [2, 5, 8]) b.box([-1, y, -1], [1, y + 1, 1], ASH);
    b.box([-4, 15, -2], [5, 20, 2], IRON);
    b.box([-5, 16, -2], [-4, 19, 2], IRON_DARK).box([5, 16, -2], [6, 19, 2], IRON_DARK);
    for (const x of [-3, 0, 3]) b.set(x, 17, 2, EMBER);
    b.set(-2, 18, 2, EMBER).set(2, 16, 2, EMBER);
  },
});

// ---------------------------------------------------------------------------------------------
// Workshop
// ---------------------------------------------------------------------------------------------

/** A cart wheel turning around the X axis (a disc in the YZ plane), between x0 and x1. */
function wheelX(b: ModelBuilder, x0: number, x1: number, cy: number, cz: number, r: number) {
  b.cylinderX(cy, cz, r + 0.6, x0, x1, '#4a4e52', true);
  b.cylinderX(cy, cz, r - 0.4, x0, x1, { color: '#6a4426', vary: 0.05 }, true);
  b.cylinderX(cy, cz, 2, x0 - 1, x1 + 1, IRON_DARK);
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    for (let x = x0; x < x1; x++) b.line([x, Math.round(cy + Math.sin(ang) * 2), Math.round(cz + Math.cos(ang) * 2)], [x, Math.round(cy + Math.sin(ang) * (r - 1.5)), Math.round(cz + Math.cos(ang) * (r - 1.5))], WOOD);
  }
}

function cartBody(b: ModelBuilder) {
  // Bed of planks, side boards, shafts toward +Z.
  b.box([-9, 9, -16], [9, 11, 16], { color: '#9a6a3a', vary: 0.07 });
  b.box([-9, 11, -16], [-8, 15, 16], { color: '#b5402e', vary: 0.05 }).box([8, 11, -16], [9, 15, 16], { color: '#b5402e', vary: 0.05 });
  b.box([-9, 11, -16], [9, 15, -15], { color: '#b5402e', vary: 0.05 });
  b.box([-7, 9, 16], [-6, 10, 30], WOOD_DARK).box([6, 9, 16], [7, 10, 30], WOOD_DARK);
  b.box([-6, 9, 4], [6, 8, 6], IRON_DARK);
  // A few sacks and a toolbox in the bed.
  b.box([-6, 11, -12], [-1, 15, -6], { color: '#c8b48a', vary: 0.08 });
  b.box([1, 11, -10], [6, 14, -3], { color: '#6a4a2e', vary: 0.05 });
}

export const chariotCasse = defineModel({
  id: 'mask:chariot_casse',
  label: 'Chariot (roue arrachée)',
  category: 'Viremasque — Atelier',
  build(b) {
    cartBody(b);
    // One wheel in place, the other side resting on a crate, its bare axle sticking out.
    wheelX(b, -11, -9, 7, 0, 7);
    b.box([9, 0, -3], [14, 9, 3], { color: '#a87a48', vary: 0.07 });
    b.box([9, 6, -1], [12, 8, 1], IRON_DARK);
  },
});

export const chariot = defineModel({
  id: 'mask:chariot',
  label: 'Chariot réparé',
  category: 'Viremasque — Atelier',
  build(b) {
    cartBody(b);
    wheelX(b, -11, -9, 7, 0, 7);
    wheelX(b, 9, 11, 7, 0, 7);
  },
});

export const roue = defineModel({
  id: 'mask:roue',
  label: 'Roue de rechange',
  category: 'Viremasque — Atelier',
  build(b) {
    b.cylinderZ(0, 7, 7, -1, 1, { color: '#6a4426', vary: 0.05 }, true);
    b.cylinderZ(0, 7, 2, -2, 2, IRON_DARK);
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      b.line([Math.round(Math.cos(ang) * 2), Math.round(7 + Math.sin(ang) * 2), 0], [Math.round(Math.cos(ang) * 5.5), Math.round(7 + Math.sin(ang) * 5.5), 0], WOOD);
    }
    b.box([-1, 0, -2], [1, 1, 2], WOOD_DARK);
  },
});

export const etabli = defineModel({
  id: 'mask:etabli',
  label: 'Établi des Rives',
  category: 'Viremasque — Atelier',
  light: { level: 9, color: '#ffc070', offset: [0.6, 1.4, 0] },
  build(b) {
    b.box([-16, 12, -6], [16, 15, 6], { color: '#9a6e40', vary: 0.07 });
    for (const [x, z] of [
      [-15, -5],
      [13, -5],
      [-15, 3],
      [13, 3],
    ] as const)
      b.box([x, 0, z], [x + 2, 12, z + 2], WOOD_DARK);
    b.box([-15, 4, -5], [15, 5, 5], { color: '#7a5030', vary: 0.05 });
    // Vice, tools, a jar of screws, a lamp.
    b.box([-14, 15, 2], [-9, 19, 6], IRON).box([-13, 19, 3], [-10, 20, 7], IRON_DARK);
    b.box([-4, 15, -3], [3, 16, -2], IRON).box([2, 15, -4], [3, 16, 1], '#6a3a22');
    b.cylinder(6, -2, 1.5, 15, 19, { color: '#cfe6e6', alpha: 0.6 });
    b.box([9, 15, -4], [11, 26, -2], IRON_DARK).box([9, 25, -4], [14, 26, -2], IRON_DARK);
    b.box([12, 22, -4], [15, 25, -1], { color: '#ffd590', emissive: true });
    // Back board with hanging tools.
    b.box([-16, 15, -6], [16, 30, -5], { color: '#7a5030', vary: 0.05 });
    for (const x of [-12, -7, -2, 3]) b.box([x, 20, -5], [x + 2, 27, -4], x % 2 ? IRON : '#6a3a22');
  },
});

export const etagere = defineModel({
  id: 'mask:etagere',
  label: 'Étagère de pièces',
  category: 'Viremasque — Atelier',
  build(b) {
    for (const x of [-12, 11]) b.box([x, 0, -4], [x + 1, 32, 4], WOOD_DARK);
    for (const y of [0, 10, 20, 31]) b.box([-12, y, -4], [12, y + 1, 4], WOOD);
    for (let i = 0; i < 9; i++) {
      const x = -10 + (i % 3) * 7;
      const y = 1 + Math.floor(i / 3) * 10;
      if (i % 3 === 0) b.cylinderZ(x + 2, y + 3, 3, -2, 0, '#7a7e82', true);
      else if (i % 3 === 1) b.box([x, y, -2], [x + 4, y + 4, 2], { color: ['#b5402e', '#3f78a8', '#e2b23c'][i % 3]!, vary: 0.05 });
      else b.cylinder(x + 2, 0, 2, y, y + 5, { color: '#d6eee6', alpha: 0.6 });
    }
  },
});

export const lit = defineModel({
  id: 'mask:lit',
  label: 'Lit à courtepointe',
  category: 'Viremasque — Maison',
  build(b) {
    b.box([-9, 0, -16], [9, 6, 16], WOOD_DARK);
    b.box([-9, 6, -16], [9, 14, -15], WOOD);
    // Patchwork quilt.
    const patches = ['#b5402e', '#e2b23c', '#3f78a8', '#2f8a86', '#d88c78', '#efe2c2'];
    for (let x = -9; x < 9; x++) for (let z = -10; z < 16; z++) b.set(x, 6, z, { color: patches[(Math.floor((x + 9) / 4) + Math.floor((z + 10) / 4)) % patches.length]!, vary: 0.05 });
    b.box([-7, 6, -15], [7, 9, -10], '#f2ead6');
  },
});

export const trophee = defineModel({
  id: 'mask:trophee',
  label: 'Trophée de bricolage',
  category: 'Viremasque — Maison',
  voxelSize: 1 / 32,
  build(b) {
    // A cup soldered from a gear, two spoons and a pipe end — first prize of a district contest.
    b.box([-5, 0, -5], [5, 4, 5], WOOD_DARK);
    b.cylinder(0, 0, 1.5, 4, 10, BRASS);
    b.cylinder(0, 0, 6, 10, 12, BRASS);
    for (let y = 12; y < 20; y++) b.cylinder(0, 0, 3 + (y - 12) * 0.45, y, y + 1, BRASS, true);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      b.set(Math.round(Math.cos(ang) * 7), 11, Math.round(Math.sin(ang) * 7), '#a87a2a');
    }
    b.box([-9, 15, -1], [-7, 19, 1], '#b8b8b8').box([7, 15, -1], [9, 19, 1], '#b8b8b8');
  },
});

/** A board hung on a wall (map, poster): drawn on the +Z face. */
function board(b: ModelBuilder, w: number, h: number, paint: (x: number, y: number) => string) {
  b.box([-w / 2 - 1, 0, -1], [w / 2 + 1, h + 2, 0], WOOD_DARK);
  for (let y = 0; y < h; y++) for (let x = -w / 2; x < w / 2; x++) b.set(x, y + 1, 0, paint(x, y));
}

export const carteViremasque = defineModel({
  id: 'mask:carte_viremasque',
  label: 'Carte griffonnée de Viremasque',
  category: 'Viremasque — Maison',
  voxelSize: 1 / 32,
  anchor: 'center',
  build(b) {
    board(b, 28, 20, (x, y) => {
      // Tiers of the city from bottom (warm) to top (gold), with ink scribbles.
      const tier = Math.floor(y / 4);
      const col = ['#d8a35a', '#5ab4e0', '#9a3a30', '#cfeaff', '#e0b44a'][tier] ?? '#e8dcc0';
      if ((x + y * 3) % 11 === 0) return '#3a2a1e';
      if (Math.abs(x - Math.round(Math.sin(y * 0.7) * 6)) < 1) return '#3a2a1e';
      return (x + 14 + y) % 7 === 0 ? '#f2e6c8' : col;
    });
  },
});

export const afficheEpreuves = defineModel({
  id: 'mask:affiche_epreuves',
  label: 'Affiche des Épreuves de l’Ascension',
  category: 'Viremasque — Maison',
  voxelSize: 1 / 32,
  anchor: 'center',
  build(b) {
    board(b, 18, 26, (x, y) => {
      // A stylized ladder of five masks rising toward a sun.
      if (y > 20 && Math.hypot(x, y - 23) < 3) return '#f2c84a';
      if (Math.abs(x) < 1 && y < 20) return '#3a2a1e';
      if ((y === 4 || y === 9 || y === 14 || y === 19) && Math.abs(x) < 6) return ['#8f8a84', '#1e8aa8', '#7a2c26', '#7ac8ff', '#e0b44a'][Math.floor(y / 5)] ?? '#3a2a1e';
      return y < 3 ? '#b5402e' : '#efe2c2';
    });
  },
});

// ---------------------------------------------------------------------------------------------
// Streets, market, canal
// ---------------------------------------------------------------------------------------------

export const cordeLinge = defineModel({
  id: 'mask:corde_linge',
  label: 'Corde à linge',
  category: 'Viremasque — Rues',
  collider: 'none',
  pickable: false,
  voxelSize: 1 / 8,
  build(b) {
    // 6 m of rope sagging between two walls, with clothes drying.
    const colors = ['#efe2c2', '#3f78a8', '#b5402e', '#e2b23c', '#2f8a86', '#d88c78'];
    for (let x = -24; x <= 24; x++) {
      const sag = Math.round(((x / 24) ** 2 - 1) * 2);
      b.set(x, 2 + sag + 2, 0, '#d8cbb0');
      if (x % 6 === -1 || x % 6 === 5) continue;
      const k = Math.floor((x + 24) / 6);
      if (k % 2 === 0) for (let y = 0; y < 3; y++) b.set(x, 3 + sag - y, 0, { color: colors[k % colors.length]!, vary: 0.05 });
    }
  },
});

function awning(b: ModelBuilder, w: number, d: number, y: number, a: string, c: string) {
  for (let x = -w; x < w; x++) for (let z = -d; z < d; z++) b.set(x, y + Math.round((z + d) * 0.25), z, Math.floor((x + w) / 3) % 2 ? a : c);
}

function stall(b: ModelBuilder, goods: (x: number, z: number) => VoxelPaint | string | null, a: string, c: string) {
  b.box([-14, 12, -6], [14, 14, 6], { color: '#9a6e40', vary: 0.07 });
  for (const [x, z] of [
    [-14, -6],
    [12, -6],
    [-14, 4],
    [12, 4],
  ] as const)
    b.box([x, 0, z], [x + 2, 12, z + 2], WOOD_DARK);
  for (const x of [-14, 12]) b.box([x, 14, -7], [x + 2, 30, -5], WOOD_DARK);
  awning(b, 16, 9, 28, a, c);
  for (let x = -12; x < 12; x++)
    for (let z = -4; z < 5; z++) {
      const p = goods(x, z);
      if (p) b.set(x, 14, z, p);
    }
}

export const etalFruits = defineModel({
  id: 'mask:etal_fruits',
  label: 'Étal de fruits',
  category: 'Viremasque — Marché',
  build: (b) => stall(b, (x, z) => ((x + z * 3) % 4 === 0 ? null : { color: ['#e8743a', '#d83a2a', '#e2c23c', '#7ab04e'][(x * 7 + z) & 3]!, vary: 0.1 }), '#e8743a', '#efe2c2'),
});

export const etalTissus = defineModel({
  id: 'mask:etal_tissus',
  label: 'Étal de tissus',
  category: 'Viremasque — Marché',
  build: (b) => stall(b, (x) => ({ color: ['#3f78a8', '#2f8a86', '#d88c78', '#e2b23c'][Math.floor((x + 12) / 6) & 3]!, vary: 0.04 }), '#2f8a86', '#efe2c2'),
});

export const etalMasques = defineModel({
  id: 'mask:etal_masques',
  label: 'Étal de masques',
  category: 'Viremasque — Marché',
  build(b) {
    stall(b, () => null, '#b5402e', '#e2b23c');
    // Masks on display on a slanted board: ash, thread-blue, iron-red.
    const cols = [ASH, '#1e5a6a', '#6a2a26', ASH, '#d8b04a'];
    cols.forEach((col, i) => {
      const x0 = -11 + i * 5;
      b.box([x0, 15, -2], [x0 + 4, 18, -1], col);
      b.set(x0 + 1, 17, -1, '#1a1410').set(x0 + 2, 17, -1, '#1a1410');
    });
  },
});

export const caisse = defineModel({
  id: 'mask:caisse',
  label: 'Caisse de provisions',
  category: 'Viremasque — Marché',
  build(b) {
    b.box([-7, 0, -7], [7, 12, 7], { color: '#b08450', vary: 0.07 });
    for (const y of [0, 11]) b.box([-7, y, -7], [7, y + 1, 7], WOOD_DARK);
    for (const x of [-7, 6]) b.box([x, 0, -7], [x + 1, 12, 7], WOOD_DARK);
    // Stencilled district mark.
    b.box([-3, 4, 7], [3, 8, 8], '#b5402e');
  },
});

export const sacs = defineModel({
  id: 'mask:sacs',
  label: 'Sacs de grain',
  category: 'Viremasque — Marché',
  build(b) {
    for (const [x, z, h] of [
      [-6, -2, 9],
      [2, -3, 8],
      [-2, 4, 7],
    ] as const)
      b.sphere(x, h / 2, z, h / 2 + 0.5, { color: '#c8b48a', vary: 0.08 });
  },
});

export const tonneau = defineModel({
  id: 'mask:tonneau',
  label: 'Tonneau cerclé',
  category: 'Viremasque — Marché',
  build(b) {
    for (let y = 0; y < 16; y++) b.cylinder(0, 0, 5 + Math.sin((y / 15) * Math.PI) * 1.2, y, y + 1, { color: '#8a5a32', vary: 0.07 });
    for (const y of [2, 8, 13]) b.cylinder(0, 0, 6.3, y, y + 1, '#3e4246', true);
  },
});

export const lampadaire = defineModel({
  id: 'mask:lampadaire',
  label: 'Lampadaire des Rives',
  category: 'Viremasque — Rues',
  light: { level: 13, color: '#ffc070', offset: [0, 2.8, 0] },
  build(b) {
    b.cylinder(0, 0, 2, 0, 3, IRON_DARK);
    b.box([-1, 3, -1], [1, 44, 1], { color: '#3a3e42', vary: 0.04 });
    b.box([-1, 42, -1], [6, 43, 1], '#3a3e42');
    b.box([3, 34, -2], [8, 41, 3], { color: '#ffd590', emissive: true });
    b.box([2, 41, -3], [9, 42, 4], '#3a3e42');
  },
});

export const potFleurs = defineModel({
  id: 'mask:pot_fleurs',
  label: 'Pot de géraniums',
  category: 'Viremasque — Rues',
  build(b) {
    b.box([-4, 0, -4], [4, 6, 4], { color: '#b9572f', vary: 0.06 });
    for (let i = 0; i < 14; i++) {
      const x = -3 + ((i * 5) % 7);
      const z = -3 + ((i * 3) % 7);
      b.set(x, 6 + (i % 3), z, i % 3 ? { color: '#4f8a4a', vary: 0.1 } : { color: '#d83a2a', vary: 0.1 });
    }
  },
});

export const banc = defineModel({
  id: 'mask:banc',
  label: 'Banc du quai',
  category: 'Viremasque — Rues',
  build(b) {
    b.box([-12, 6, -3], [12, 8, 3], { color: '#3f78a8', vary: 0.05 });
    b.box([-12, 8, -3], [12, 14, -2], { color: '#3f78a8', vary: 0.05 });
    for (const x of [-11, 9]) b.box([x, 0, -3], [x + 2, 6, 3], IRON_DARK);
  },
});

export const barque = defineModel({
  id: 'mask:barque',
  label: 'Barque',
  category: 'Viremasque — Canal',
  collider: 'none',
  build(b) {
    for (let z = -20; z < 20; z++) {
      const w = Math.round(7 * Math.cos((z / 20) * (Math.PI / 2)));
      for (let x = -w; x <= w; x++) {
        b.set(x, 0, z, WOOD_DARK);
        if (Math.abs(x) === w) b.box([x, 1, z], [x + 1, 5, z + 1], { color: '#2f8a86', vary: 0.05 });
      }
    }
    b.box([-6, 3, -2], [7, 4, 1], WOOD);
  },
});

export const ferraille = defineModel({
  id: 'mask:ferraille',
  label: 'Tas de ferraille',
  category: 'Viremasque — Rues',
  collider: 'none',
  build(b) {
    b.box([-3, 0, -2], [3, 1, 3], IRON).box([-2, 1, -1], [2, 2, 1], '#8a5a3a');
    b.cylinderX(2, 2, 1.5, -4, 1, '#7a7e82', true);
    b.set(2, 2, -2, BRASS);
  },
});

// ---------------------------------------------------------------------------------------------
// The freight lift (Prologue)
// ---------------------------------------------------------------------------------------------

export const wagon = defineModel({
  id: 'mask:wagon',
  label: 'Wagon du monte-charge',
  category: 'Viremasque — Monte-charge',
  collider: 'none',
  light: { level: 8, color: '#ff8a3a', offset: [0, 0.6, -1.2] },
  build(b) {
    // Iron cradle on four wheels, loaded with provision crates; the brake glows red-hot.
    b.box([-10, 4, -18], [10, 6, 18], IRON);
    for (const x of [-10, 9]) b.box([x, 6, -18], [x + 1, 14, 18], { color: '#5c6064', vary: 0.05 });
    for (const z of [-18, 17]) b.box([-10, 6, z], [10, 14, z + 1], { color: '#5c6064', vary: 0.05 });
    for (const [x, z] of [
      [-8, -14],
      [-8, 10],
      [6, -14],
      [6, 10],
    ] as const)
      b.cylinderX(3, z + 2, 3, x, x + 2, IRON_DARK);
    for (const [x, z] of [
      [-8, -15],
      [1, -15],
      [-8, -4],
      [1, -4],
      [-4, 7],
    ] as const) {
      b.box([x, 6, z], [x + 7, 13, z + 7], { color: '#b08450', vary: 0.08 });
      b.box([x + 2, 9, z + 7], [x + 5, 11, z + 8], '#b5402e');
    }
    b.box([-4, 0, -20], [4, 4, -18], { color: '#ff5a1e', emissive: true });
  },
});

export const levier = defineModel({
  id: 'mask:levier',
  label: 'Levier de frein',
  category: 'Viremasque — Monte-charge',
  build(b) {
    b.box([-4, 0, -4], [4, 8, 4], IRON);
    b.box([-5, 8, -5], [5, 9, 5], IRON_DARK);
    b.part('manche', [0, 9, 0]);
    b.box([-1, 9, -1], [1, 26, 1], '#3a3e42');
    b.box([-2, 26, -2], [2, 29, 2], { color: '#b5402e', vary: 0.05 });
  },
});

export const leverTire = defineModel({
  id: 'mask:levier_tire',
  label: 'Levier de frein (tiré)',
  category: 'Viremasque — Monte-charge',
  build(b) {
    b.box([-4, 0, -4], [4, 8, 4], IRON);
    b.box([-5, 8, -5], [5, 9, 5], IRON_DARK);
    b.line([0, 9, 0], [0, 20, 12], '#3a3e42');
    b.line([1, 9, 0], [1, 20, 12], '#3a3e42');
    b.box([-2, 19, 11], [2, 22, 14], { color: '#b5402e', vary: 0.05 });
  },
});

export const frein = defineModel({
  id: 'mask:frein',
  label: 'Frein coincé (brûlant)',
  category: 'Viremasque — Monte-charge',
  light: { level: 10, color: '#ff6a2a', offset: [0, 0.5, 0.3] },
  build(b) {
    // A brake drum and its jaw, jammed and glowing: a Braise strike must free it.
    b.box([-8, 0, -6], [8, 4, 6], IRON_DARK);
    b.cylinderZ(0, 10, 7, -3, 3, IRON, true);
    b.cylinderZ(0, 10, 3, -4, 4, IRON_DARK);
    b.box([-9, 4, -4], [-6, 18, 4], { color: '#5c6064', vary: 0.05 });
    b.box([-6, 15, -3], [4, 17, 3], { color: '#ff5a1e', emissive: true });
    for (const [x, y] of [
      [3, 4],
      [-4, 6],
      [5, 13],
    ] as const)
      b.set(x, y, 3, { color: '#ffb05a', emissive: true });
  },
});

export const freinLibre = defineModel({
  id: 'mask:frein_libre',
  label: 'Frein débloqué',
  category: 'Viremasque — Monte-charge',
  build(b) {
    b.box([-8, 0, -6], [8, 4, 6], IRON_DARK);
    b.cylinderZ(0, 10, 7, -3, 3, IRON, true);
    b.cylinderZ(0, 10, 3, -4, 4, IRON_DARK);
    b.box([-9, 4, -4], [-6, 18, 4], { color: '#5c6064', vary: 0.05 });
    b.box([-6, 17, -3], [4, 19, 3], '#7a3a24');
  },
});

export const echafaudage = defineModel({
  id: 'mask:echafaudage',
  label: 'Échafaudage',
  category: 'Viremasque — Monte-charge',
  voxelSize: 1 / 8,
  build(b) {
    // A 2 × 2 m platform of planks on four posts (height 1.5 m).
    for (const [x, z] of [
      [-8, -8],
      [7, -8],
      [-8, 7],
      [7, 7],
    ] as const)
      b.box([x, 0, z], [x + 1, 12, z + 1], WOOD_DARK);
    b.box([-8, 11, -8], [8, 12, 8], { color: '#a67a4a', vary: 0.08 });
    b.line([-8, 1, -8], [7, 11, -8], WOOD_DARK);
  },
});

// ---------------------------------------------------------------------------------------------
// The lift mill
// ---------------------------------------------------------------------------------------------

export const roueMoulin = defineModel({
  id: 'mask:roue_moulin',
  label: 'Grande roue du moulin de levage',
  category: 'Viremasque — Moulin',
  voxelSize: 1 / 8,
  collider: 'none',
  pickable: false,
  build(b) {
    // A 7 m wheel of painted wood and iron with paddles, lying in the XY plane.
    b.cylinderZ(0, 28, 28, -2, 2, { color: '#7a5030', vary: 0.06 }, true);
    b.cylinderZ(0, 28, 26, -2, 2, { color: '#b5402e', vary: 0.05 }, true);
    b.cylinderZ(0, 28, 4, -4, 4, IRON_DARK);
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const cx = Math.cos(ang);
      const cy = Math.sin(ang);
      b.line([Math.round(cx * 4), Math.round(28 + cy * 4), 0], [Math.round(cx * 26), Math.round(28 + cy * 26), 0], WOOD);
      b.box([Math.round(cx * 29) - 1, Math.round(28 + cy * 29) - 1, -3], [Math.round(cx * 29) + 2, Math.round(28 + cy * 29) + 2, 3], WOOD_DARK);
    }
  },
});
