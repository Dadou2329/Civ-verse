import { defineModel, type ModelBuilder } from '@sdk';

/**
 * Verrou props. Units are micro-voxels (1/16 m); fronts face +Z (entity yaw rotates them).
 * Door panels are 16 × 32 voxels (1 m × 2 m) and are scaled by the door component for wider
 * gates. Gameplay never depends on these shapes: they can be redrawn freely.
 */
const W = 16;
const H = 32;
const D = 3;

function planks(b: ModelBuilder, colors: [string, string, string], vary = 0.05) {
  for (let x = 0; x < W; x++) {
    const c = x % 4 === 0 ? colors[1] : x % 4 === 3 ? colors[2] : colors[0];
    b.box([x, 0, 0], [x + 1, H, D], { color: c, vary });
  }
}

function handle(b: ModelBuilder, color: string, accent: string) {
  b.box([12, 14, D], [14, 18, D + 1], color);
  b.set(13, 15, D + 1, accent);
  b.box([12, 14, -1], [14, 18, 0], color);
}

// ------------------------------------------------------------------------------------------------
// Doors
// ------------------------------------------------------------------------------------------------

function handlelessDoor(b: ModelBuilder, lit: boolean) {
  planks(b, ['#6a5644', '#45372b', '#7d6650'], 0.06);
  for (const z of [-1, D]) {
    b.box([0, 3, z], [W, 5, z + 1], '#3a302a');
    b.box([0, 27, z], [W, 29, z + 1], '#3a302a');
  }
  // A plate in the shape of an open hand, where a handle should be.
  const plate = lit ? { color: '#ffd889', emissive: true } : { color: '#c9ab6c', vary: 0.04 };
  const lines = lit ? { color: '#fff3cf', emissive: true } : '#7a6440';
  b.box([5, 12, D], [11, 18, D + 1], plate);
  for (const x of [5, 7, 9]) b.box([x, 18, D], [x + 1, 22, D + 1], plate);
  b.box([10, 18, D], [11, 21, D + 1], plate);
  b.box([11, 13, D], [13, 15, D + 1], plate);
  b.line([6, 13, D + 1], [9, 16, D + 1], lines);
  b.line([6, 16, D + 1], [9, 13, D + 1], lines);
}

export const doorHandleless = defineModel({
  id: 'door:door_handleless',
  label: 'Porte sans poignée',
  category: 'Verrou — Portes',
  collider: 'none',
  build: (b) => handlelessDoor(b, false),
});

export const doorHandlelessLit = defineModel({
  id: 'door:door_handleless_lit',
  label: 'Porte sans poignée (marque éveillée)',
  category: 'Verrou — Portes',
  collider: 'none',
  light: { level: 7, color: '#ffd889', offset: [0, 1, 0.2] },
  build: (b) => handlelessDoor(b, true),
});

export const doorRank0 = defineModel({
  id: 'door:door_rank0',
  label: 'Porte de rang 0 (marque grise)',
  category: 'Verrou — Portes',
  collider: 'none',
  build(b) {
    planks(b, ['#6d5945', '#433528', '#80694f']);
    for (const z of [-1, D]) {
      b.box([1, 6, z], [W - 1, 8, z + 1], '#4c3b2b');
      b.box([1, 24, z], [W - 1, 26, z + 1], '#4c3b2b');
    }
    // The grey mark of the Sans-Seuil.
    b.box([5, 19, D], [11, 23, D + 1], '#8e8e8c');
    b.box([6, 20, D + 1], [10, 22, D + 2], '#6d6d6a');
    handle(b, '#3a3836', '#9c9a94');
  },
});

export const doorRank1 = defineModel({
  id: 'door:door_rank1',
  label: 'Porte de rang 1 (trait doré)',
  category: 'Verrou — Portes',
  collider: 'none',
  build(b) {
    planks(b, ['#8a5a36', '#5c3a21', '#a06c43'], 0.04);
    for (const z of [-1, D]) {
      b.shell([1, 1, z], [W - 1, H - 1, z + 1], '#5a3a22');
      // The engraved golden line with its three notches (the key pattern of the Porteurs).
      b.box([1, 20, z], [W - 1, 21, z + 1], '#e3b84d');
      for (const x of [4, 8, 11]) b.box([x, 21, z], [x + 1, 23, z + 1], '#e3b84d');
    }
    handle(b, '#7a5a1c', '#f1d78a');
  },
});

export const doorRank2 = defineModel({
  id: 'door:door_rank2',
  label: 'Porte de rang 2 (double sceau)',
  category: 'Verrou — Portes',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [W, H, D], { color: '#aeb7c0', vary: 0.03 });
    for (const z of [-1, D]) {
      b.shell([1, 1, z], [W - 1, H - 1, z + 1], '#7d8994');
      for (const cy of [11, 22]) {
        for (let x = 3; x < 13; x++)
          for (let y = cy - 5; y < cy + 5; y++) {
            const d = Math.hypot(x + 0.5 - 8, y + 0.5 - cy);
            if (d > 2.6 && d < 4.2) b.set(x, y, z, '#5d9eea');
            else if (d <= 1.2) b.set(x, y, z, '#3f6fb0');
          }
      }
    }
  },
});

export const doorBlack = defineModel({
  id: 'door:door_black',
  label: 'Porte noire (absente)',
  category: 'Verrou — Portes',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [W, H, D], { color: '#0d0c12', vary: 0.04 });
    for (let k = 0; k < 26; k++) {
      const x = Math.floor(b.random() * W);
      const y = Math.floor(b.random() * H);
      b.set(x, y, D - 1, { color: b.random() > 0.8 ? '#ffd27a' : '#d9d6ff', emissive: true });
    }
    for (const z of [-1, D]) {
      b.shell([0, 0, z], [W, H, z + 1], '#1c1a24');
      b.box([7, 13, z], [9, 17, z + 1], { color: '#ffe2a8', emissive: true });
      b.set(8, 17, z, { color: '#ffe2a8', emissive: true });
    }
  },
});

// ------------------------------------------------------------------------------------------------
// Walls, papers and documents
// ------------------------------------------------------------------------------------------------

export const posterMissing = defineModel({
  id: 'door:poster_missing',
  label: 'Affiche de disparu',
  category: 'Verrou — Papiers',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [12, 16, 1], { color: '#e8dfc8', vary: 0.03 });
    b.box([1, 13, 1], [11, 15, 2], '#9a2f25');
    // Sketched face.
    b.box([4, 6, 1], [8, 11, 2], '#c9b69a');
    b.box([4, 10, 1], [8, 12, 2], '#4a3527');
    b.set(5, 8, 1, '#2a2a2a');
    b.set(7, 8, 1, '#2a2a2a');
    b.box([5, 6, 1], [7, 7, 2], '#8a5a4a');
    for (const y of [2, 4]) b.box([2, y, 1], [10, y + 1, 2], '#5a4e42');
    b.set(6, 15, 1, '#5a5a5a');
  },
});

export const plaqueNotice = defineModel({
  id: 'door:notice_plaque',
  label: 'Plaque officielle',
  category: 'Verrou — Papiers',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [14, 9, 1], { color: '#8c8f93', vary: 0.03 });
    b.shell([0, 0, 1], [14, 9, 2], '#5e6266');
    for (const y of [2, 4, 6]) b.box([2, y, 1], [12, y + 1, 2], '#2f3236');
    for (const [x, y] of [
      [1, 1],
      [12, 1],
      [1, 7],
      [12, 7],
    ] as const)
      b.set(x, y, 2, '#c8ccd0');
  },
});

function openBook(b: ModelBuilder, y0: number, w = 12, d = 9) {
  b.box([0, y0, 0], [w, y0 + 1, d], '#5a2e22');
  b.box([1, y0 + 1, 1], [w / 2, y0 + 2, d - 1], '#efe6cf');
  b.box([w / 2, y0 + 1, 1], [w - 1, y0 + 2, d - 1], '#e6dcc2');
  // Ink lines on both pages.
  for (let z = 2; z < d - 1; z += 2) {
    b.box([2, y0 + 2, z], [w / 2 - 1, y0 + 3, z + 1], '#4a4038');
    b.box([w / 2 + 1, y0 + 2, z], [w - 2, y0 + 3, z + 1], '#6d6252');
  }
}

export const lecternRegister = defineModel({
  id: 'door:lectern',
  label: 'Lutrin avec registre',
  category: 'Verrou — Papiers',
  collider: { min: [-0.35, 0, -0.3], max: [0.35, 1.2, 0.3] },
  build(b) {
    b.box([6, 0, 4], [10, 2, 9], '#4a3322');
    b.box([7, 2, 5], [9, 15, 8], '#5c3f28');
    b.box([1, 15, 1], [15, 17, 12], '#5c3f28');
    b.box([2, 17, 2], [8, 18, 11], '#efe6cf');
    b.box([8, 17, 2], [14, 18, 11], '#e6dcc2');
    for (let z = 3; z < 11; z += 2) {
      b.box([3, 18, z], [7, 19, z + 1], '#5a4e42');
      b.box([9, 18, z], [13, 19, z + 1], '#5a4e42');
    }
    b.box([7, 17, 1], [9, 19, 12], '#3a2418');
  },
});

export const ledgerOpen = defineModel({
  id: 'door:ledger_open',
  label: 'Registre ouvert',
  category: 'Verrou — Papiers',
  collider: 'none',
  build(b) {
    openBook(b, 0, 14, 10);
  },
});

export const paperStack = defineModel({
  id: 'door:paper_stack',
  label: 'Liasse de documents',
  category: 'Verrou — Papiers',
  collider: 'none',
  build(b) {
    for (let i = 0; i < 6; i++) {
      const o = Math.floor(b.random() * 2);
      b.box([o, i, o], [9 + o, i + 1, 7 + o], { color: i % 2 ? '#e8dfc8' : '#d9cfb4', vary: 0.03 });
    }
    b.box([3, 6, 2], [6, 7, 5], '#9a2f25');
  },
});

// ------------------------------------------------------------------------------------------------
// Machines and furniture
// ------------------------------------------------------------------------------------------------

export const imprintBench = defineModel({
  id: 'door:imprint_bench',
  label: 'Établi d’empreinte',
  category: 'Verrou — Atelier',
  build(b) {
    // Heavy bench.
    b.box([0, 13, 0], [28, 16, 14], { color: '#6b4a2e', vary: 0.05 });
    for (const [x, z] of [
      [1, 1],
      [25, 1],
      [1, 11],
      [25, 11],
    ] as const)
      b.box([x, 0, z], [x + 2, 13, z + 2], '#4a3322');
    b.box([2, 4, 2], [26, 5, 12], '#5a3d27');
    // Vise and the three dials on a brass front plate.
    b.box([3, 16, 3], [10, 21, 9], '#4a4e55');
    b.box([4, 21, 4], [9, 23, 8], '#6a7078');
    b.box([11, 16, 9], [26, 26, 11], { color: '#b08a3e', vary: 0.04 });
    for (const cx of [14, 18.5, 23]) {
      b.cylinderZ(cx, 21, 2.2, 11, 12, '#e3c06a');
      b.set(Math.floor(cx), 22, 12, '#4a3a18');
      b.set(Math.floor(cx), 23, 12, '#4a3a18');
    }
    // Scattered tools.
    b.box([12, 16, 2], [18, 17, 3], '#8a8f96');
    b.box([20, 16, 3], [22, 18, 6], '#c4a057');
  },
});

export const testDoor = defineModel({
  id: 'door:test_door',
  label: 'Porte d’essai de Mira',
  category: 'Verrou — Atelier',
  build(b) {
    // Free-standing frame with a half-assembled lock mechanism.
    b.box([0, 0, 0], [3, 40, 4], '#5c3f28');
    b.box([21, 0, 0], [24, 40, 4], '#5c3f28');
    b.box([0, 40, 0], [24, 43, 4], '#5c3f28');
    b.box([3, 0, 1], [21, 36, 3], { color: '#8a6a48', vary: 0.05 });
    b.cylinderZ(12, 20, 5, 3, 4, '#c49c46', true);
    b.cylinderZ(12, 20, 2, 3, 5, '#8a6a1e');
    b.cylinderZ(17, 27, 3, 3, 4, '#b8733f', true);
    b.box([5, 9, 3], [9, 13, 5], '#4a4e55');
    b.line([12, 20, 4], [17, 27, 4], '#3a3a3a');
  },
});

export const keyWall = defineModel({
  id: 'door:key_wall',
  label: 'Mur de clés',
  category: 'Verrou — Atelier',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [32, 24, 1], { color: '#5a3d27', vary: 0.05 });
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 2 + col * 4 + (row % 2);
        const y = 3 + row * 5;
        const metal = ['#c49c46', '#9aa0a8', '#b8733f', '#7d838c'][(row * 7 + col) % 4]!;
        b.set(x, y + 3, 1, '#2c2c2e');
        b.box([x, y, 1], [x + 1, y + 3, 2], metal);
        b.box([x - 1, y - 2, 1], [x + 2, y, 2], metal);
        b.set(x + 1, y + 1, 1, metal);
      }
    }
  },
});

export const fountainDry = defineModel({
  id: 'door:fountain_dry',
  label: 'Fontaine sèche',
  category: 'Verrou — Rue',
  collider: { min: [-1.5, 0, -1.5], max: [1.5, 0.7, 1.5] },
  build(b) {
    for (let y = 0; y < 10; y++) {
      for (let x = -24; x < 24; x++)
        for (let z = -24; z < 24; z++) {
          const d = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) * 0.82 + Math.min(Math.abs(x + 0.5), Math.abs(z + 0.5)) * 0.42;
          if (d < 23 && (d > 19.5 || y < 2)) b.set(x, y, z, { color: y === 9 ? '#8c918a' : '#6e746d', vary: 0.07 });
        }
    }
    // Cracked basin floor and dead leaves.
    for (let k = 0; k < 40; k++) b.set(Math.floor(b.random() * 36) - 18, 2, Math.floor(b.random() * 36) - 18, b.random() > 0.5 ? '#6b4a2e' : '#8a6a3a');
    // Central pillar with a stone key on top.
    b.cylinder(0, 0, 4, 0, 26, { color: '#7a807a', vary: 0.05 });
    b.cylinder(0, 0, 5.5, 26, 28, '#8c918a');
    b.box([-1, 28, -1], [1, 44, 1], '#9a9f98');
    b.cylinderZ(0, 47, 4, -1, 1, '#9a9f98', true);
    for (const y of [32, 36]) b.box([1, y, -1], [5, y + 2, 1], '#9a9f98');
    // A dry spout.
    b.box([-1, 18, 4], [1, 20, 8], '#5f655e');
  },
});

export const crateMarked = defineModel({
  id: 'door:crate_marked',
  label: 'Caisse marquée à la craie',
  category: 'Verrou — Rue',
  build(b) {
    b.box([0, 0, 0], [12, 11, 12], { color: '#8a6a43', vary: 0.06 });
    b.shell([0, 0, 0], [12, 11, 12], '#6a4e2f');
    b.clear([1, 1, 0], [11, 10, 1]);
    b.box([1, 1, 0], [11, 10, 1], { color: '#94744b', vary: 0.05 });
    // Chalk mark: a small door with an arrow.
    b.box([4, 3, -1], [8, 4, 0], '#e8e8e2');
    b.box([4, 3, -1], [5, 8, 0], '#e8e8e2');
    b.box([7, 3, -1], [8, 8, 0], '#e8e8e2');
    b.box([4, 8, -1], [8, 9, 0], '#e8e8e2');
  },
});

export const pipeRun = defineModel({
  id: 'door:pipes',
  label: 'Tuyaux de cuivre',
  category: 'Verrou — Rue',
  collider: 'none',
  build(b) {
    b.cylinderX(4, 2, 1.6, 0, 32, '#b8733f');
    b.cylinderX(9, 2, 1.1, 0, 32, '#9c6234');
    for (const x of [3, 15, 27]) b.box([x, 2, 0], [x + 2, 11, 2], '#5e361c');
    b.box([14, 9, 0], [18, 13, 4], '#58a38a');
  },
});

export const gearWheel = defineModel({
  id: 'door:gear_wheel',
  label: 'Grande roue dentée',
  category: 'Verrou — Archives',
  anchor: 'center',
  collider: 'none',
  build(b) {
    const R = 22;
    for (let x = -R - 3; x <= R + 3; x++)
      for (let y = -R - 3; y <= R + 3; y++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        const a = Math.atan2(y + 0.5, x + 0.5);
        const tooth = Math.cos(a * 14) > 0.35 ? R + 3 : R;
        const spoke = Math.min(...[0, 1, 2, 3, 4, 5].map((k) => Math.abs(Math.sin(a - (k * Math.PI) / 3)) * d)) < 1.6;
        if ((d < tooth && d > R - 4) || (d < R - 3 && spoke) || d < 5) {
          for (let z = 0; z < 3; z++) b.set(x, y, z, { color: d < 5 ? '#e8c27a' : '#c49c46', vary: 0.05 });
        }
      }
  },
});

export const plaqueFloating = defineModel({
  id: 'door:plaque_orig',
  label: 'Plaque flottante « ORIG… »',
  category: 'Verrou — Couloir',
  anchor: 'center',
  collider: 'none',
  light: { level: 6, color: '#bcb8ff' },
  build(b) {
    b.box([0, 0, 0], [12, 7, 1], { color: '#9a9aa6', vary: 0.04 });
    b.shell([0, 0, 1], [12, 7, 2], '#6e6e7a');
    // "ORIG" in tiny glyph strokes, the rest scratched away.
    const glyph = { color: '#e8e6ff', emissive: true };
    b.box([2, 2, 1], [3, 5, 2], glyph);
    b.box([4, 2, 1], [5, 5, 2], glyph);
    b.set(3, 2, 1, glyph);
    b.set(3, 4, 1, glyph);
    b.box([6, 2, 1], [7, 5, 2], glyph);
    b.set(7, 4, 1, glyph);
    b.box([8, 2, 1], [9, 5, 2], glyph);
    for (let x = 9; x < 11; x++) b.set(x, 3, 1, '#4a4a55');
  },
});

export const thresholdFragment = defineModel({
  id: 'door:fragment',
  label: 'Fragment du Seuil',
  category: 'Verrou — Couloir',
  anchor: 'center',
  light: { level: 9, color: '#ffe2a8' },
  build(b) {
    // A fractured ring: a circle with a missing wedge and a crack.
    for (let x = -6; x < 6; x++)
      for (let y = -6; y < 6; y++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        const a = Math.atan2(y + 0.5, x + 0.5);
        if (d > 3.4 && d < 5.6 && !(a > 0.25 && a < 0.95)) b.set(x, y, 0, { color: '#e9c46a', emissive: true });
      }
    b.line([-2, -2, 1], [2, 2, 1], { color: '#fff4d8', emissive: true });
  },
});

export const palmPlate = defineModel({
  id: 'door:palm_plate',
  label: 'Empreinte de paume',
  category: 'Verrou — Couloir',
  collider: 'none',
  light: { level: 8, color: '#ffd889' },
  build(b) {
    const p = { color: '#ffd889', emissive: true };
    b.box([3, 0, 0], [9, 6, 1], p);
    for (const x of [3, 5, 7]) b.box([x, 6, 0], [x + 1, 10, 1], p);
    b.box([8, 6, 0], [9, 9, 1], p);
    b.box([9, 1, 0], [11, 3, 1], p);
  },
});
