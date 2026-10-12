import { defineModel, type ModelBuilder } from '@sdk';

/**
 * Réminence props (1/16 m voxels, fronts toward +Z). Shards are drawn as faceted crystals;
 * the machines of memory are brass, glass and dark wood.
 */
function crystal(b: ModelBuilder, color: string, light: string, size = 1) {
  const h = Math.round(8 * size);
  for (let y = 0; y < h; y++) {
    const r = (y < h / 2 ? y / (h / 2) : (h - y) / (h / 2)) * 2.6 * size + 0.4;
    for (let x = -3; x <= 3; x++)
      for (let z = -3; z <= 3; z++) {
        if (Math.abs(x) + Math.abs(z) * 0.8 <= r) b.set(x, y, z, { color: (x + y + z) % 3 === 0 ? light : color, emissive: true });
      }
  }
}

export const shardAmber = defineModel({
  id: 'memory:shard_amber',
  label: 'Éclat ambré',
  category: 'Réminence — Éclats',
  anchor: 'center',
  collider: 'none',
  light: { level: 7, color: '#ffb35c' },
  build: (b) => crystal(b, '#f0a040', '#ffe0a0'),
});

export const shardViolet = defineModel({
  id: 'memory:shard_violet',
  label: 'Éclat violet',
  category: 'Réminence — Éclats',
  anchor: 'center',
  collider: 'none',
  light: { level: 7, color: '#c08aff' },
  build: (b) => crystal(b, '#9a6ad8', '#e0c8ff'),
});

export const shardTeal = defineModel({
  id: 'memory:shard_teal',
  label: 'Éclat sarcelle',
  category: 'Réminence — Éclats',
  anchor: 'center',
  collider: 'none',
  light: { level: 7, color: '#7ad8d8' },
  build: (b) => crystal(b, '#3aa8a8', '#c8f4f4'),
});

export const loom = defineModel({
  id: 'memory:loom',
  label: 'Métier des souvenirs',
  category: 'Réminence — Machines',
  light: { level: 11, color: '#c08aff', offset: [0, 1.6, 0.2] },
  build(b) {
    // A tall loom of dark wood and brass, threaded with glowing memory strands.
    for (const x of [-22, 21]) b.box([x, 0, -4], [x + 3, 52, 4], { color: '#3a2a22', vary: 0.04 });
    b.box([-22, 49, -4], [24, 52, 4], '#3a2a22');
    b.box([-22, 6, -4], [24, 8, 4], '#3a2a22');
    for (let x = -18; x < 20; x += 3) {
      const color = ['#d6b4ff', '#ffd08a', '#9ad8ff'][Math.abs(x) % 3]!;
      b.box([x, 8, 0], [x + 1, 49, 1], { color, emissive: true, alpha: 0.85 });
    }
    // Brass spool and crank.
    b.cylinderX(44, -6, 3, -19, 21, '#c49c46');
    b.box([24, 26, -2], [28, 28, 2], '#c49c46');
    b.box([27, 22, -1], [28, 30, 1], '#8a6a1e');
    // A bench for the one who sells.
    b.box([-12, 0, 10], [12, 8, 16], { color: '#4a3a30', vary: 0.04 });
  },
});

export const slotTable = defineModel({
  id: 'memory:slot_table',
  label: "Table des trois emplacements",
  category: 'Réminence — Machines',
  light: { level: 6, color: '#ffd08a', offset: [0, 1.0, 0] },
  build(b) {
    b.box([0, 12, 0], [36, 15, 16], { color: '#3a2a24', vary: 0.04 });
    for (const [x, z] of [
      [1, 1],
      [33, 1],
      [1, 13],
      [33, 13],
    ] as const)
      b.box([x, 0, z], [x + 2, 12, z + 2], '#2a1e1a');
    // Three brass cups that hold the shards.
    for (const cx of [8, 18, 28]) {
      b.cylinder(cx, 8, 3.5, 15, 17, '#c49c46', true);
      b.cylinder(cx, 8, 2.2, 15, 16, { color: '#6a4a8a', emissive: true });
    }
    // Resonance lamp arm.
    b.box([34, 15, 6], [35, 32, 8], '#8a6a1e');
    b.box([24, 31, 6], [35, 32, 8], '#8a6a1e');
    b.sphere(24.5, 28, 7, 3, { color: '#ffe8c0', emissive: true, alpha: 0.9 });
  },
});

export const resonanceLamp = defineModel({
  id: 'memory:resonance_lamp',
  label: 'Lampe à résonance',
  category: 'Réminence — Machines',
  light: { level: 12, color: '#e8d8ff', offset: [0, 1.7, 0] },
  build(b) {
    b.cylinder(0, 0, 4, 0, 2, '#2a1e1a');
    b.box([-1, 2, -1], [1, 22, 1], '#8a6a1e');
    for (let y = 22; y < 34; y++) {
      const r = 5 - Math.abs(y - 28) * 0.6;
      b.cylinder(0, 0, r, y, y + 1, { color: '#e8d8ff', emissive: true, alpha: 0.85 }, true);
    }
    b.cylinder(0, 0, 1.6, 26, 30, { color: '#ffffff', emissive: true });
    b.box([-3, 34, -3], [3, 35, 3], '#c49c46');
  },
});

function stele(b: ModelBuilder, name: boolean) {
  b.box([0, 0, 0], [14, 3, 6], '#3c3a44');
  b.box([1, 3, 1], [13, 26, 5], { color: '#6a6872', vary: 0.05 });
  for (let x = 2; x < 12; x++) b.set(x, 26, 2, '#6a6872');
  b.box([3, 27, 1], [11, 28, 5], '#6a6872');
  if (name) {
    // « LÉA », drawn in glowing strokes.
    const g = { color: '#d8b8ff', emissive: true };
    b.box([3, 14, 5], [4, 20, 6], g);
    b.box([3, 14, 5], [5, 15, 6], g);
    b.box([6, 14, 5], [7, 20, 6], g);
    b.box([6, 14, 5], [8, 15, 6], g);
    b.box([6, 17, 5], [8, 18, 6], g);
    b.box([6, 19, 5], [8, 20, 6], g);
    b.set(7, 21, 5, g);
    b.box([9, 14, 5], [10, 19, 6], g);
    b.box([11, 14, 5], [12, 19, 6], g);
    b.box([9, 19, 5], [12, 20, 6], g);
    b.box([9, 17, 5], [12, 18, 6], g);
  } else {
    // Letters melted like sugar.
    for (let k = 0; k < 14; k++) b.set(3 + Math.floor(b.random() * 9), 14 + Math.floor(b.random() * 6), 5, '#4e4c56');
  }
}

export const steleBlank = defineModel({ id: 'memory:stele', label: 'Stèle aux lettres fondues', category: 'Réminence — Jardin', build: (b) => stele(b, false) });
export const steleLea = defineModel({
  id: 'memory:stele_lea',
  label: 'Stèle « LÉA »',
  category: 'Réminence — Jardin',
  light: { level: 6, color: '#c8a8ff', offset: [0, 1.1, 0.3] },
  build: (b) => stele(b, true),
});

export const steleSmall = defineModel({
  id: 'memory:stele_small',
  label: 'Petite stèle',
  category: 'Réminence — Jardin',
  build(b) {
    b.box([0, 0, 0], [10, 2, 5], '#3c3a44');
    b.box([1, 2, 1], [9, 16, 4], { color: '#6a6872', vary: 0.06 });
    b.box([2, 16, 1], [8, 17, 4], '#6a6872');
    for (let k = 0; k < 8; k++) b.set(2 + Math.floor(b.random() * 6), 8 + Math.floor(b.random() * 5), 4, '#4e4c56');
  },
});

function pedestal(b: ModelBuilder) {
  b.box([0, 0, 0], [10, 2, 10], '#3c3a44');
  b.box([2, 2, 2], [8, 12, 8], { color: '#5a5864', vary: 0.04 });
  b.box([1, 12, 1], [9, 14, 9], '#6a6872');
}

export const pedestalEmpty = defineModel({ id: 'memory:pedestal', label: 'Socle', category: 'Réminence — Jardin', build: pedestal });

export const kite = defineModel({
  id: 'memory:kite',
  label: 'Cerf-volant rouge',
  category: 'Réminence — Jardin',
  collider: 'none',
  build(b) {
    for (let y = 0; y < 12; y++) {
      const w = y < 6 ? y : 11 - y;
      b.box([6 - w, y, 0], [6 + w + 1, y + 1, 1], { color: y % 4 < 2 ? '#c8402a' : '#e8c040', vary: 0.03 });
    }
    b.line([6, 0, 0], [6, 11, 0], '#4a3020');
    b.line([1, 6, 0], [11, 6, 0], '#4a3020');
    for (let k = 0; k < 6; k++) b.set(6 + (k % 2), -1 - k, 0, k % 2 ? '#e8c040' : '#3a6aa8');
  },
});

export const cup = defineModel({
  id: 'memory:cup',
  label: 'Tasse ébréchée',
  category: 'Réminence — Jardin',
  collider: 'none',
  build(b) {
    b.cylinder(4, 4, 3.5, 0, 6, '#e8e0d0', true);
    b.cylinder(4, 4, 3.5, 0, 1, '#e8e0d0');
    b.box([7, 2, 3], [9, 5, 5], '#e8e0d0');
    b.box([3, 3, 0], [6, 4, 1], '#3a6aa8');
    b.clear([1, 5, 1], [3, 6, 3]);
  },
});

export const bell = defineModel({
  id: 'memory:bell',
  label: 'Clochette',
  category: 'Réminence — Jardin',
  collider: 'none',
  build(b) {
    for (let y = 0; y < 6; y++) b.cylinder(3, 3, 3 - y * 0.4, y, y + 1, '#d8b04a', true);
    b.box([2, 6, 2], [4, 8, 4], '#a8802a');
    b.box([2, -1, 2], [4, 0, 4], '#8a6a1e');
  },
});

export const pedestalKite = defineModel({ id: 'memory:pedestal_kite', label: 'Socle (cerf-volant)', category: 'Réminence — Jardin', build: (b) => withObject(b, 'kite') });
export const pedestalCup = defineModel({ id: 'memory:pedestal_cup', label: 'Socle (tasse)', category: 'Réminence — Jardin', build: (b) => withObject(b, 'cup') });
export const pedestalBell = defineModel({ id: 'memory:pedestal_bell', label: 'Socle (clochette)', category: 'Réminence — Jardin', build: (b) => withObject(b, 'bell') });

function withObject(b: ModelBuilder, what: 'kite' | 'cup' | 'bell') {
  pedestal(b);
  if (what === 'kite') {
    for (let y = 0; y < 8; y++) {
      const w = y < 4 ? y : 7 - y;
      b.box([5 - w, 14 + y, 4], [5 + w + 1, 15 + y, 5], y % 3 ? '#c8402a' : '#e8c040');
    }
  } else if (what === 'cup') {
    b.cylinder(5, 5, 2.5, 14, 18, '#e8e0d0', true);
    b.cylinder(5, 5, 2.5, 14, 15, '#e8e0d0');
    b.box([7, 15, 4], [9, 17, 6], '#e8e0d0');
  } else {
    for (let y = 0; y < 4; y++) b.cylinder(5, 5, 2.4 - y * 0.4, 14 + y, 15 + y, '#d8b04a', true);
    b.box([4, 18, 4], [6, 19, 6], '#a8802a');
  }
}

export const extractionMachine = defineModel({
  id: 'memory:extraction_machine',
  label: "Machine d'extraction",
  category: 'Réminence — Machines',
  light: { level: 10, color: '#c08aff', offset: [0, 2.2, 0] },
  build(b) {
    // The chair.
    b.box([-8, 0, -8], [8, 10, 8], { color: '#2a2026', vary: 0.03 });
    b.box([-8, 10, 4], [8, 30, 8], '#2a2026');
    b.box([-10, 10, -8], [-8, 16, 8], '#3a2a30');
    b.box([8, 10, -8], [10, 16, 8], '#3a2a30');
    // The crown of brass arms and glass tubes.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * 14);
      const z = Math.round(Math.sin(a) * 14);
      b.line([x, 8, z], [Math.round(x * 0.5), 40, Math.round(z * 0.5)], '#c49c46');
      b.box([x - 1, 0, z - 1], [x + 1, 8, z + 1], '#8a6a1e');
    }
    b.cylinder(0, 0, 8, 40, 42, '#c49c46', true);
    for (let y = 30; y < 40; y++) b.cylinder(0, 0, 3, y, y + 1, { color: '#d6b4ff', emissive: true, alpha: 0.8 }, true);
  },
});

export const violin = defineModel({
  id: 'memory:violin',
  label: 'Violon de Silas',
  category: 'Réminence — Objets',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [5, 9, 2], '#8a4a20');
    b.box([1, 9, 0], [4, 10, 2], '#8a4a20');
    b.box([2, 10, 0], [3, 17, 1], '#2a1a10');
    b.box([1, 17, 0], [4, 19, 1], '#2a1a10');
  },
});

export const namePlaques = defineModel({
  id: 'memory:name_plaques',
  label: 'Plaques des noms oubliés',
  category: 'Réminence — Rue',
  collider: 'none',
  build(b) {
    for (let k = 0; k < 6; k++) {
      const x = (k % 3) * 10;
      const y = Math.floor(k / 3) * 7;
      b.box([x, y, 0], [x + 8, y + 5, 1], { color: '#b8a888', vary: 0.04 });
      for (let i = 0; i < 4; i++) b.set(x + 2 + i, y + 2, 1, k % 2 ? '#5a4a3a' : '#8a7a6a');
    }
  },
});

export const queueRope = defineModel({
  id: 'memory:queue_rope',
  label: "Poteaux de file d'attente",
  category: 'Réminence — Rue',
  build(b) {
    for (const x of [0, 30]) {
      b.cylinder(x + 1, 1, 1.4, 0, 16, '#c49c46');
      b.cylinder(x + 1, 1, 2.2, 0, 1, '#2a2026');
    }
    for (let x = 2; x < 30; x++) b.set(x, 13 - Math.round(Math.sin((x / 30) * Math.PI) * 3), 1, '#8a2a3a');
  },
});

export const register = defineModel({
  id: 'memory:register',
  label: 'Registre des ventes',
  category: 'Réminence — Objets',
  collider: 'none',
  build(b) {
    b.box([0, 0, 0], [14, 1, 10], '#4a2a3a');
    b.box([1, 1, 1], [7, 2, 9], '#efe6cf');
    b.box([7, 1, 1], [13, 2, 9], '#e6dcc2');
    for (let z = 2; z < 9; z += 2) {
      b.box([2, 2, z], [6, 3, z + 1], '#4a4038');
      b.box([8, 2, z], [12, 3, z + 1], '#6a5a8a');
    }
  },
});

export const doorFrameGhost = defineModel({
  id: 'memory:door_ghost',
  label: 'Silhouette de porte',
  category: 'Chambre Blanche',
  collider: 'none',
  build(b) {
    const c = { color: '#d8d4e8', alpha: 0.55 };
    b.box([0, 0, 0], [2, 40, 2], c);
    b.box([18, 0, 0], [20, 40, 2], c);
    b.box([0, 38, 0], [20, 40, 2], c);
  },
});

export const doorFrameThreshold = defineModel({
  id: 'memory:door_ghost_seuil',
  label: 'Silhouette de porte (motif du seuil)',
  category: 'Chambre Blanche',
  collider: 'none',
  light: { level: 6, color: '#ffe2a8', offset: [0, 1.4, 0] },
  build(b) {
    const c = { color: '#ffe2a8', alpha: 0.7 };
    b.box([0, 0, 0], [2, 40, 2], c);
    b.box([18, 0, 0], [20, 40, 2], c);
    b.box([0, 38, 0], [20, 40, 2], c);
    // The fractured circle, faintly.
    for (let x = 4; x < 16; x++)
      for (let y = 14; y < 26; y++) {
        const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 20);
        const a = Math.atan2(y + 0.5 - 20, x + 0.5 - 10);
        if (d > 3.5 && d < 5.3 && !(a > 0.25 && a < 0.95)) b.set(x, y, 1, { color: '#ffe2a8', emissive: true });
      }
  },
});

export const remanence = defineModel({
  id: 'memory:remanence',
  label: 'Rémanence',
  category: 'Chambre Blanche',
  anchor: 'center',
  collider: 'none',
  light: { level: 9, color: '#e8d8ff' },
  build(b) {
    // A spiral of light that never closes.
    for (let i = 0; i < 70; i++) {
      const a = i * 0.32;
      const r = 1 + i * 0.07;
      b.set(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 0, { color: i % 5 === 0 ? '#ffffff' : '#d6b4ff', emissive: true });
    }
  },
});
