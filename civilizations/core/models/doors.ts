import { defineModel, type ModelBuilder } from '@sdk';

/**
 * Door panels: 16 × 32 voxels (1 m × 2 m), 3 voxels thick, centered on the doorway.
 * The renderer rotates them around a hinge chosen by the core.door component.
 */
const W = 16;
const H = 32;
const D = 3;

function boardPanel(b: ModelBuilder, colors: [string, string, string]) {
  for (let x = 0; x < W; x++) {
    const c = x % 4 === 0 ? colors[1] : x % 4 === 3 ? colors[2] : colors[0];
    b.box([x, 0, 0], [x + 1, H, D], { color: c, vary: 0.035 });
  }
}

export const doorWood = defineModel({
  id: 'core:door_wood',
  label: 'Porte en bois',
  category: 'Portes',
  collider: 'none',
  build(b) {
    boardPanel(b, ['#7d5532', '#5f3f23', '#8f6439']);
    for (const z of [-1, D]) {
      b.box([1, 5, z], [W - 1, 7, z + 1], '#563920');
      b.box([1, 25, z], [W - 1, 27, z + 1], '#563920');
    }
    b.line([2, 8, D], [13, 23, D], '#563920');
    b.box([0, 5, D], [5, 7, D + 1], '#38383b');
    b.box([0, 25, D], [5, 27, D + 1], '#38383b');
    b.box([12, 14, D], [14, 18, D + 1], '#2c2c2e');
    b.set(13, 15, D + 1, '#b59a48');
    b.box([12, 14, -1], [14, 18, 0], '#2c2c2e');
  },
});

export const doorIron = defineModel({
  id: 'core:door_iron',
  label: 'Porte en fer',
  category: 'Portes',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [W, H, D], { color: '#4a4e55', vary: 0.04 });
    for (let y = 3; y < H; y += 6) for (let x = 2; x < W; x += 4) b.set(x, y, D, '#7d838c');
    // Small barred window.
    b.clear([5, 22, 0], [11, 28, D]);
    for (let x = 5; x < 11; x += 2) b.box([x, 22, 1], [x + 1, 28, 2], '#2d3035');
    b.shell([4, 21, 0], [12, 29, D], '#3a3d43');
    b.box([12, 13, D], [14, 17, D + 1], '#2a2c30');
    b.set(13, 14, D + 1, '#9aa0a8');
  },
});

export const doorOrnate = defineModel({
  id: 'core:door_ornate',
  label: 'Porte ornée',
  category: 'Portes',
  collider: 'none',
  build(b) {
    boardPanel(b, ['#c8b48e', '#a8936d', '#d8c6a2']);
    for (const z of [-1, D]) {
      b.shell([1, 1, z], [W - 1, H - 1, z + 1], '#c9a24a');
      b.shell([4, 6, z], [12, 14, z + 1], '#c9a24a');
      b.shell([4, 18, z], [12, 28, z + 1], '#c9a24a');
      b.set(8, 23, z, '#f1d78a');
      b.set(7, 23, z, '#f1d78a');
    }
    b.box([12, 14, D], [14, 17, D + 1], '#8a6a1e');
    b.set(13, 15, D + 1, '#f1d78a');
  },
});

export const doorDark = defineModel({
  id: 'core:door_dark',
  label: 'Porte noire',
  category: 'Portes',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [W, H, D], { color: '#1c1b20', vary: 0.03 });
    for (const z of [-1, D]) b.shell([1, 1, z], [W - 1, H - 1, z + 1], '#2c2a33');
  },
});
