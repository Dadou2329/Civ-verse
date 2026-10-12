import { defineModel } from '@sdk';

const WOOD = '#7d5532';
const WOOD_DARK = '#5a3c22';
const WOOD_LIGHT = '#9a6c40';

export const barrel = defineModel({
  id: 'core:barrel',
  label: 'Tonneau',
  category: 'Mobilier',
  build(b) {
    for (let y = 0; y < 15; y++) {
      const r = 5.2 + Math.sin((y / 14) * Math.PI) * 0.9;
      b.cylinder(6, 6, r, y, y + 1, { color: WOOD, vary: 0.06 });
    }
    for (const y of [2, 12]) b.cylinder(6, 6, 6.3, y, y + 1, '#3b3b3e', true);
    b.cylinder(6, 6, 4.6, 15, 16, WOOD_DARK);
  },
});

export const crate = defineModel({
  id: 'core:crate',
  label: 'Caisse',
  category: 'Mobilier',
  build(b) {
    b.box([0, 0, 0], [14, 14, 14], { color: WOOD_LIGHT, vary: 0.05 });
    for (const [a, c] of [
      [0, 0],
      [13, 0],
      [0, 13],
      [13, 13],
    ] as const) {
      b.box([a, 0, c], [a + 1, 14, c + 1], WOOD_DARK);
      b.box([a, a, 0], [a + 1, a + 1, 14], WOOD_DARK);
    }
    b.shell([0, 0, 0], [14, 1, 14], WOOD_DARK);
    b.shell([0, 13, 0], [14, 14, 14], WOOD_DARK);
    b.line([1, 1, -1], [12, 12, -1], WOOD_DARK);
    b.line([1, 1, 14], [12, 12, 14], WOOD_DARK);
  },
});

export const table = defineModel({
  id: 'core:table',
  label: 'Table',
  category: 'Mobilier',
  build(b) {
    b.box([0, 12, 0], [16, 14, 12], { color: WOOD_LIGHT, vary: 0.04 });
    for (const [x, z] of [
      [1, 1],
      [13, 1],
      [1, 9],
      [13, 9],
    ] as const)
      b.box([x, 0, z], [x + 2, 12, z + 2], WOOD_DARK);
  },
});

export const desk = defineModel({
  id: 'core:desk',
  label: 'Bureau avec papiers',
  category: 'Mobilier',
  build(b) {
    b.box([0, 12, 0], [20, 14, 11], { color: WOOD_DARK, vary: 0.04 });
    b.box([0, 0, 0], [6, 12, 11], WOOD);
    b.box([1, 2, 11], [5, 5, 12], WOOD_LIGHT);
    b.box([1, 7, 11], [5, 10, 12], WOOD_LIGHT);
    b.box([18, 0, 1], [20, 12, 10], WOOD_DARK);
    b.box([8, 14, 2], [15, 15, 9], '#ece2c8');
    b.box([9, 15, 3], [14, 16, 8], '#e2d6b8');
    b.box([16, 14, 6], [18, 17, 8], '#1d1f2a');
    b.set(17, 17, 6, '#e8e0d0');
  },
});

export const chair = defineModel({
  id: 'core:chair',
  label: 'Chaise',
  category: 'Mobilier',
  build(b) {
    b.box([0, 7, 0], [8, 9, 8], WOOD);
    for (const [x, z] of [
      [0, 0],
      [6, 0],
      [0, 6],
      [6, 6],
    ] as const)
      b.box([x, 0, z], [x + 2, 7, z + 2], WOOD_DARK);
    b.box([0, 9, 6], [8, 19, 8], WOOD);
    b.box([1, 12, 5], [7, 16, 6], WOOD_LIGHT);
  },
});

export const bench = defineModel({
  id: 'core:bench',
  label: 'Banc',
  category: 'Mobilier',
  build(b) {
    b.box([0, 7, 0], [28, 9, 7], { color: WOOD, vary: 0.05 });
    for (const x of [2, 24]) b.box([x, 0, 1], [x + 2, 7, 6], WOOD_DARK);
    b.box([0, 9, 6], [28, 15, 7], WOOD_LIGHT);
  },
});

export const bed = defineModel({
  id: 'core:bed',
  label: 'Lit',
  category: 'Mobilier',
  build(b) {
    b.box([0, 0, 0], [16, 6, 30], WOOD_DARK);
    b.box([1, 6, 1], [15, 9, 29], '#e9e3d6');
    b.box([1, 9, 10], [15, 10, 29], { color: '#8a3b34', vary: 0.03 });
    b.box([3, 9, 2], [13, 11, 7], '#f4efe4');
    b.box([0, 6, 0], [16, 14, 2], WOOD);
  },
});

export const shelf = defineModel({
  id: 'core:shelf',
  label: 'Étagère',
  category: 'Mobilier',
  build(b) {
    b.box([0, 0, 0], [16, 1, 6], WOOD_DARK);
    b.box([0, 10, 0], [16, 11, 6], WOOD_DARK);
    b.box([0, 20, 0], [16, 21, 6], WOOD_DARK);
    b.box([0, 0, 5], [16, 30, 6], WOOD);
    b.box([0, 0, 0], [1, 30, 6], WOOD_DARK);
    b.box([15, 0, 0], [16, 30, 6], WOOD_DARK);
    const jar = (x: number, y: number, c: string) => {
      b.box([x, y, 1], [x + 3, y + 5, 4], { color: c, alpha: 0.85 });
      b.box([x, y + 5, 1], [x + 3, y + 6, 4], '#6a4a2d');
    };
    jar(2, 1, '#8fb3a0');
    jar(7, 1, '#c8a060');
    jar(11, 11, '#a07ab0');
    b.box([2, 11, 1], [4, 18, 5], '#8e2b2b');
    b.box([4, 11, 1], [6, 17, 5], '#2f5a8a');
    b.box([6, 11, 1], [7, 18, 5], '#3a7a4a');
    b.box([3, 21, 1], [12, 22, 5], '#d8cdb0');
  },
});

export const chest = defineModel({
  id: 'core:chest',
  label: 'Coffre',
  category: 'Mobilier',
  build(b) {
    b.box([0, 0, 0], [14, 8, 10], { color: WOOD, vary: 0.05 });
    b.box([0, 8, 0], [14, 11, 10], WOOD_DARK);
    for (const x of [2, 11]) b.box([x, 0, -1], [x + 1, 11, 11], '#3a3a3d');
    b.box([6, 6, -1], [8, 9, 0], '#b59a48');
  },
});

export const workbench = defineModel({
  id: 'core:workbench',
  label: 'Établi',
  category: 'Mobilier',
  build(b) {
    b.box([0, 12, 0], [24, 15, 12], { color: WOOD_LIGHT, vary: 0.05 });
    for (const [x, z] of [
      [1, 1],
      [21, 1],
      [1, 9],
      [21, 9],
    ] as const)
      b.box([x, 0, z], [x + 2, 12, z + 2], WOOD_DARK);
    b.box([2, 3, 2], [22, 4, 10], WOOD_DARK);
    // Vise.
    b.box([18, 15, 1], [22, 19, 5], '#4a4d52');
    b.box([19, 19, 2], [21, 20, 4], '#6d7178');
    // Tools.
    b.box([4, 15, 6], [11, 16, 7], '#6a4a2d');
    b.box([10, 15, 5], [12, 17, 8], '#55595f');
    b.box([13, 15, 3], [16, 16, 9], '#b8733f');
  },
});

export const keyRack = defineModel({
  id: 'core:key_rack',
  label: 'Tableau de clés',
  category: 'Mobilier',
  collider: { min: [-0.5, 0, -0.06], max: [0.5, 0.75, 0.06] },
  build(b) {
    b.box([0, 0, 0], [16, 12, 1], WOOD_DARK);
    b.shell([0, 0, 0], [16, 12, 2], WOOD);
    for (let i = 0; i < 6; i++) {
      const x = 2 + i * 2;
      b.set(x, 9, 2, '#8a8f96');
      b.box([x, 4, 2], [x + 1, 8, 3], i % 2 ? '#c9a24a' : '#9aa0a8');
      b.set(x, 3, 2, i % 2 ? '#c9a24a' : '#9aa0a8');
    }
  },
});

export const booksStack = defineModel({
  id: 'core:books_stack',
  label: 'Pile de livres',
  category: 'Mobilier',
  collider: 'none',
  build(b) {
    const colors = ['#8e2b2b', '#2f5a8a', '#3a7a4a', '#7a5a2a', '#5a3a6a'];
    let y = 0;
    colors.forEach((c, i) => {
      const w = 7 - (i % 2);
      b.box([i % 2, y, i % 3], [i % 2 + w, y + 2, (i % 3) + 5], c);
      b.box([i % 2 + 1, y, (i % 3) + 5], [i % 2 + w - 1, y + 2, (i % 3) + 5], '#efe6d0');
      y += 2;
    });
  },
});

export const cabinet = defineModel({
  id: 'core:cabinet',
  label: 'Classeur à tiroirs',
  category: 'Mobilier',
  build(b) {
    b.box([0, 0, 0], [16, 28, 10], { color: WOOD_DARK, vary: 0.03 });
    for (let y = 2; y < 28; y += 6) {
      for (const x of [1, 9]) {
        b.box([x, y, -1], [x + 6, y + 4, 0], WOOD);
        b.set(x + 3, y + 2, -2, '#c9a24a');
      }
    }
  },
});
