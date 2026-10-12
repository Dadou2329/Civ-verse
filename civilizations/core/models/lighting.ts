import { defineModel, type ModelBuilder } from '@sdk';

function lanternBody(b: ModelBuilder, frame: string, glow: string, y0 = 0) {
  b.box([0, y0, 0], [8, y0 + 1, 8], frame);
  for (const [x, z] of [
    [0, 0],
    [7, 0],
    [0, 7],
    [7, 7],
  ] as const)
    b.box([x, y0 + 1, z], [x + 1, y0 + 9, z + 1], frame);
  b.box([1, y0 + 1, 1], [7, y0 + 9, 7], { color: glow, emissive: true });
  b.box([0, y0 + 9, 0], [8, y0 + 10, 8], frame);
  b.box([2, y0 + 10, 2], [6, y0 + 11, 6], frame);
  b.box([3, y0 + 11, 3], [5, y0 + 13, 5], frame);
}

export const lantern = defineModel({
  id: 'core:lantern',
  label: 'Lanterne',
  category: 'Éclairage',
  light: { level: 13, color: '#ffb35c', offset: [0, 0.35, 0] },
  build: (b) => lanternBody(b, '#2f2a25', '#ffcb6b'),
});

export const lanternBlue = defineModel({
  id: 'core:lantern_blue',
  label: 'Lanterne bleue',
  category: 'Éclairage',
  light: { level: 13, color: '#6fb0ff', offset: [0, 0.35, 0] },
  build: (b) => lanternBody(b, '#26303d', '#9fd4ff'),
});

export const lanternViolet = defineModel({
  id: 'core:lantern_violet',
  label: 'Lanterne violette',
  category: 'Éclairage',
  light: { level: 12, color: '#b98aff', offset: [0, 0.35, 0] },
  build: (b) => lanternBody(b, '#2b2433', '#d7b8ff'),
});

function lampPost(b: ModelBuilder, glow: string) {
  b.box([6, 0, 6], [10, 2, 10], '#2a2a2d');
  b.box([7, 2, 7], [9, 38, 9], '#33343a');
  b.box([7, 36, 7], [17, 37, 9], '#33343a');
  b.box([15, 33, 7], [16, 36, 9], '#33343a');
  // Hanging lantern at the end of the arm.
  const ox = 11;
  const oy = 23;
  const oz = 4;
  b.box([ox, oy, oz], [ox + 8, oy + 1, oz + 8], '#2a2a2d');
  for (const [x, z] of [
    [0, 0],
    [7, 0],
    [0, 7],
    [7, 7],
  ] as const)
    b.box([ox + x, oy + 1, oz + z], [ox + x + 1, oy + 9, oz + z + 1], '#2a2a2d');
  b.box([ox + 1, oy + 1, oz + 1], [ox + 7, oy + 9, oz + 7], { color: glow, emissive: true });
  b.box([ox, oy + 9, oz], [ox + 8, oy + 10, oz + 8], '#2a2a2d');
  b.box([ox + 3, oy + 10, oz + 3], [ox + 5, oy + 13, oz + 5], '#2a2a2d');
}

export const lampPostWarm = defineModel({
  id: 'core:lamp_post',
  label: 'Réverbère',
  category: 'Éclairage',
  collider: { min: [-0.12, 0, -0.12], max: [0.12, 2.4, 0.12] },
  light: { level: 14, color: '#ffb35c', offset: [0.45, 1.65, 0] },
  build: (b) => lampPost(b, '#ffcb6b'),
});

export const lampPostBlue = defineModel({
  id: 'core:lamp_post_blue',
  label: 'Réverbère bleu',
  category: 'Éclairage',
  collider: { min: [-0.12, 0, -0.12], max: [0.12, 2.4, 0.12] },
  light: { level: 14, color: '#6fb0ff', offset: [0.45, 1.65, 0] },
  build: (b) => lampPost(b, '#9fd4ff'),
});

export const candles = defineModel({
  id: 'core:candles',
  label: 'Bougies',
  category: 'Éclairage',
  collider: 'none',
  light: { level: 9, color: '#ffae4a', offset: [0, 0.2, 0] },
  build(b) {
    b.box([0, 0, 0], [8, 1, 6], '#6e5a3a');
    const candle = (x: number, z: number, h: number) => {
      b.box([x, 1, z], [x + 2, 1 + h, z + 2], '#efe4c8');
      b.set(x, 1 + h, z, { color: '#ffd27a', emissive: true });
      b.set(x, 2 + h, z, { color: '#fff2c0', emissive: true });
    };
    candle(1, 1, 5);
    candle(4, 2, 3);
    candle(5, 0, 4);
  },
});

export const brazier = defineModel({
  id: 'core:brazier',
  label: 'Brasero',
  category: 'Éclairage',
  light: { level: 14, color: '#ff8a3c', offset: [0, 0.7, 0] },
  build(b) {
    b.cylinder(6, 6, 2, 0, 8, '#2e2b28');
    b.cylinder(6, 6, 6, 8, 12, '#3a3632', true);
    b.cylinder(6, 6, 5, 9, 12, { color: '#ff7a2a', emissive: true });
    for (let i = 0; i < 6; i++) b.set(3 + i, 12 + (i % 3), 5 + (i % 2), { color: i % 2 ? '#ffd27a' : '#ff9a3c', emissive: true });
  },
});
