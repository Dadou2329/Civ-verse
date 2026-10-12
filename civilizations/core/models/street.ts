import { defineModel, type ModelBuilder } from '@sdk';

export const well = defineModel({
  id: 'core:well',
  label: 'Puits',
  category: 'Rue',
  build(b) {
    for (let y = 0; y < 12; y++) b.cylinder(12, 12, 11, y, y + 1, { color: y % 4 === 3 ? '#6e6a64' : '#8a857c', vary: 0.08 }, true);
    b.cylinder(12, 12, 9.5, 0, 9, { color: '#0d1418' });
    for (const x of [2, 21]) b.box([x, 12, 11], [x + 2, 36, 13], '#5a3c22');
    b.box([1, 34, 11], [24, 36, 13], '#5a3c22');
    // Small roof.
    for (let i = 0; i < 6; i++) b.box([0 + i, 36 + i, 6], [24 - i, 37 + i, 18], { color: '#8e3b2b', vary: 0.05 });
    b.box([11, 24, 11], [13, 34, 13], '#3a3a3a');
    b.box([10, 20, 10], [14, 24, 14], '#6a4a2d');
  },
});

export const fence = defineModel({
  id: 'core:fence',
  label: 'Barrière',
  category: 'Rue',
  build(b) {
    for (const x of [0, 14]) b.box([x, 0, 0], [x + 2, 16, 2], '#6a4a2d');
    for (const y of [5, 11]) b.box([0, y, 0], [16, y + 2, 2], { color: '#7d5532', vary: 0.06 });
  },
});

export const signPost = defineModel({
  id: 'core:sign_post',
  label: 'Poteau indicateur',
  category: 'Rue',
  collider: { min: [-0.1, 0, -0.1], max: [0.1, 2, 0.1] },
  build(b) {
    b.box([7, 0, 7], [9, 32, 9], '#5a3c22');
    b.box([9, 24, 6], [22, 29, 10], { color: '#9a6c40', vary: 0.05 });
    b.box([-6, 18, 6], [7, 23, 10], { color: '#9a6c40', vary: 0.05 });
  },
});

export const cart = defineModel({
  id: 'core:cart',
  label: 'Charrette',
  category: 'Rue',
  build(b) {
    b.box([0, 8, 0], [28, 10, 16], { color: '#7d5532', vary: 0.05 });
    b.shell([0, 10, 0], [28, 16, 16], '#6a4a2d');
    b.clear([1, 10, 1], [27, 16, 15]);
    b.box([2, 10, 2], [12, 14, 14], '#c4a057');
    for (const z of [-2, 17]) b.cylinderZ(14, 6, 6, z, z + 1, '#4a3423', true);
    b.box([28, 9, 7], [44, 10, 9], '#5a3c22');
  },
});

export const plantPot = defineModel({
  id: 'core:plant_pot',
  label: 'Plante en pot',
  category: 'Rue',
  build(b) {
    b.cylinder(5, 5, 4, 0, 6, { color: '#a8583a', vary: 0.05 });
    b.cylinder(5, 5, 4.5, 6, 7, '#8e4a30');
    b.sphere(5, 11, 5, 5, { color: '#4d7830', vary: 0.12 });
    b.set(3, 14, 3, '#d0443a');
    b.set(7, 13, 6, '#f2d06a');
  },
});

function banner(b: ModelBuilder, cloth: string, emblem: string) {
  b.box([0, 30, 0], [16, 31, 2], '#3a2a1a');
  b.box([1, 6, 1], [15, 30, 2], { color: cloth, vary: 0.03 });
  for (let x = 1; x < 15; x += 2) b.box([x, 4, 1], [x + 1, 6, 2], cloth);
  b.box([6, 16, 0], [10, 22, 1], emblem);
  b.box([7, 14, 0], [9, 24, 1], emblem);
}

export const bannerRed = defineModel({
  id: 'core:banner_red',
  label: 'Bannière rouge',
  category: 'Rue',
  collider: 'none',
  build: (b) => banner(b, '#8c2a2a', '#d8b85a'),
});

export const bannerBlue = defineModel({
  id: 'core:banner_blue',
  label: 'Bannière bleue',
  category: 'Rue',
  collider: 'none',
  build: (b) => banner(b, '#2c4a78', '#d8d0c0'),
});

function stall(b: ModelBuilder, a: string, c: string) {
  b.box([0, 0, 0], [32, 14, 12], { color: '#7d5532', vary: 0.05 });
  b.box([0, 14, 0], [32, 15, 12], '#5a3c22');
  for (const x of [0, 30]) for (const z of [0, 10]) b.box([x, 15, z], [x + 2, 38, z + 2], '#5a3c22');
  for (let x = 0; x < 34; x++) {
    const col = Math.floor(x / 4) % 2 ? a : c;
    for (let i = 0; i < 6; i++) b.box([x - 1, 38 - i, -2 + i * 3], [x, 39 - i, 1 + i * 3], col);
  }
  // Goods on the counter.
  for (let i = 0; i < 6; i++) b.sphere(3 + i * 5, 16.5, 5, 1.8, ['#d0443a', '#e8a33a', '#7aa848'][i % 3]!);
  b.box([22, 15, 2], [30, 18, 9], '#c4a057');
}

export const stallRed = defineModel({
  id: 'core:stall_red',
  label: 'Étal (rouge)',
  category: 'Rue',
  collider: { min: [-1, 0, -0.4], max: [1, 1, 0.4] },
  build: (b) => stall(b, '#a8342c', '#e8e0cc'),
});

export const stallBlue = defineModel({
  id: 'core:stall_blue',
  label: 'Étal (bleu)',
  category: 'Rue',
  collider: { min: [-1, 0, -0.4], max: [1, 1, 0.4] },
  build: (b) => stall(b, '#2f5f8f', '#e8e0cc'),
});

export const statue = defineModel({
  id: 'core:statue',
  label: 'Statue',
  category: 'Rue',
  build(b) {
    b.box([0, 0, 0], [16, 8, 16], { color: '#8f8a82', vary: 0.05 });
    b.box([1, 8, 1], [15, 9, 15], '#a8a39a');
    const S = { color: '#b9b4aa', vary: 0.04 };
    b.box([5, 9, 6], [11, 24, 10], S);
    b.box([4, 22, 6], [12, 30, 10], S);
    b.box([2, 22, 7], [4, 30, 9], S);
    b.box([12, 24, 7], [14, 36, 9], S);
    b.box([6, 30, 6], [10, 36, 10], S);
  },
});

export const rubble = defineModel({
  id: 'core:rubble',
  label: 'Gravats',
  category: 'Rue',
  collider: 'none',
  build(b) {
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(b.random() * 14);
      const z = Math.floor(b.random() * 14);
      const s = 1 + Math.floor(b.random() * 3);
      b.box([x, 0, z], [x + s, Math.max(1, s - 1), z + s], { color: '#8a857c', vary: 0.12 });
    }
  },
});

export const crystalCluster = defineModel({
  id: 'core:crystal_cluster',
  label: 'Grappe de cristaux',
  category: 'Rue',
  light: { level: 10, color: '#b98aff', offset: [0, 0.4, 0] },
  build(b) {
    const shard = (x: number, z: number, h: number, c: string) => {
      for (let y = 0; y < h; y++) {
        const r = Math.max(0.6, 1.8 * (1 - y / h));
        b.cylinder(x, z, r, y, y + 1, { color: c, emissive: true, vary: 0.05 });
      }
    };
    shard(8, 8, 14, '#c9a2ff');
    shard(4, 9, 8, '#a87cf0');
    shard(11, 5, 10, '#e2ccff');
    shard(9, 12, 6, '#b48af5');
    b.cylinder(8, 8, 6, 0, 1, '#3a3440');
  },
});
