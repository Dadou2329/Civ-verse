import { defineMusic, defineSound, type SoundLayer } from '@sdk';

/**
 * Shared procedural sounds. No recorded audio is shipped: each id is a synthesis recipe that a
 * future update can replace with a recorded file without changing gameplay code.
 */
const osc = (wave: SoundLayer['wave'], freq: number, o: Partial<SoundLayer> = {}): SoundLayer => ({
  source: 'osc',
  wave,
  freq,
  attack: 0.005,
  duration: 0.3,
  release: 0.15,
  gain: 0.2,
  ...o,
});
const noise = (color: SoundLayer['noise'], o: Partial<SoundLayer> = {}): SoundLayer => ({
  source: 'noise',
  noise: color,
  attack: 0.003,
  duration: 0.2,
  release: 0.1,
  gain: 0.3,
  ...o,
});

export const coreSounds = [
  defineSound({
    id: 'core:door_open',
    label: 'Porte qui s’ouvre',
    category: 'sfx',
    recipe: {
      variation: 0.08,
      layers: [
        osc('sawtooth', 170, { freqEnd: 260, vibrato: { rate: 17, depth: 22 }, filter: { type: 'bandpass', freq: 850, q: 5 }, attack: 0.06, duration: 0.6, gain: 0.16 }),
        noise('brown', { filter: { type: 'lowpass', freq: 380 }, delay: 0.5, duration: 0.22, gain: 0.45 }),
      ],
    },
  }),
  defineSound({
    id: 'core:door_close',
    label: 'Porte qui se ferme',
    category: 'sfx',
    recipe: {
      variation: 0.06,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 320 }, duration: 0.35, gain: 0.7 }),
        osc('sine', 95, { freqEnd: 45, duration: 0.25, gain: 0.45 }),
        noise('white', { filter: { type: 'highpass', freq: 3200 }, duration: 0.05, gain: 0.12 }),
      ],
    },
  }),
  defineSound({
    id: 'core:door_locked',
    label: 'Porte verrouillée',
    category: 'sfx',
    recipe: {
      variation: 0.05,
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 2100, q: 4 }, duration: 0.06, gain: 0.3, repeat: { count: 4, interval: 0.075 } }),
        osc('square', 120, { filter: { type: 'lowpass', freq: 480 }, duration: 0.16, gain: 0.07 }),
      ],
    },
  }),
  defineSound({
    id: 'core:unlock',
    label: 'Déverrouillage',
    category: 'sfx',
    recipe: {
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 3200, q: 8 }, duration: 0.04, gain: 0.45 }),
        noise('white', { filter: { type: 'bandpass', freq: 2600, q: 8 }, delay: 0.13, duration: 0.05, gain: 0.55 }),
        osc('triangle', 1400, { freqEnd: 900, delay: 0.13, duration: 0.12, gain: 0.08 }),
      ],
    },
  }),
  defineSound({
    id: 'core:pickup',
    label: 'Objet ramassé',
    category: 'ui',
    recipe: {
      layers: [
        osc('sine', 880, { duration: 0.2, gain: 0.22 }),
        osc('sine', 1320, { delay: 0.08, duration: 0.32, gain: 0.2 }),
        osc('triangle', 2640, { delay: 0.08, duration: 0.2, gain: 0.04 }),
      ],
    },
  }),
  defineSound({
    id: 'core:notify',
    label: 'Notification',
    category: 'ui',
    recipe: { layers: [osc('sine', 1046, { duration: 0.6, gain: 0.12 }), osc('sine', 2093, { duration: 0.4, gain: 0.04 })] },
  }),
  defineSound({
    id: 'core:quest',
    label: 'Nouvelle quête',
    category: 'ui',
    recipe: {
      layers: [
        osc('triangle', 523.25, { duration: 0.35, gain: 0.15 }),
        osc('triangle', 659.25, { delay: 0.12, duration: 0.35, gain: 0.15 }),
        osc('triangle', 783.99, { delay: 0.24, duration: 0.8, gain: 0.17 }),
        osc('sine', 1567.98, { delay: 0.24, duration: 0.9, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'core:quest_complete',
    label: 'Quête terminée',
    category: 'ui',
    recipe: {
      layers: [
        osc('triangle', 523.25, { duration: 0.3, gain: 0.14 }),
        osc('triangle', 659.25, { delay: 0.1, duration: 0.3, gain: 0.14 }),
        osc('triangle', 783.99, { delay: 0.2, duration: 0.3, gain: 0.14 }),
        osc('triangle', 1046.5, { delay: 0.3, duration: 1.2, gain: 0.16 }),
        osc('sine', 523.25, { delay: 0.3, attack: 0.2, duration: 1.4, gain: 0.08 }),
      ],
    },
  }),
  defineSound({
    id: 'core:denied',
    label: 'Refus',
    category: 'ui',
    recipe: {
      layers: [
        osc('square', 150, { freqEnd: 110, filter: { type: 'lowpass', freq: 650 }, duration: 0.2, gain: 0.1 }),
        osc('square', 140, { freqEnd: 100, filter: { type: 'lowpass', freq: 600 }, delay: 0.13, duration: 0.2, gain: 0.08 }),
      ],
    },
  }),
  defineSound({ id: 'core:ui_click', label: 'Clic', category: 'ui', recipe: { layers: [osc('sine', 1800, { freqEnd: 1200, duration: 0.045, gain: 0.07 })] } }),
  defineSound({ id: 'core:ui_hover', label: 'Survol', category: 'ui', recipe: { layers: [osc('sine', 2400, { duration: 0.03, gain: 0.025 })] } }),
  defineSound({
    id: 'core:ui_open',
    label: 'Ouverture de panneau',
    category: 'ui',
    recipe: { layers: [noise('white', { filter: { type: 'bandpass', freq: 600, freqEnd: 2200, q: 1.2 }, attack: 0.06, duration: 0.22, gain: 0.08 })] },
  }),
  defineSound({
    id: 'core:ui_close',
    label: 'Fermeture de panneau',
    category: 'ui',
    recipe: { layers: [noise('white', { filter: { type: 'bandpass', freq: 2200, freqEnd: 600, q: 1.2 }, attack: 0.02, duration: 0.2, gain: 0.07 })] },
  }),
  defineSound({
    id: 'core:step_stone',
    label: 'Pas sur la pierre',
    category: 'sfx',
    recipe: { variation: 0.18, layers: [noise('pink', { filter: { type: 'bandpass', freq: 950, q: 1.3 }, attack: 0.002, duration: 0.09, gain: 0.16 })] },
  }),
  defineSound({
    id: 'core:step_wood',
    label: 'Pas sur le bois',
    category: 'sfx',
    recipe: {
      variation: 0.15,
      layers: [noise('brown', { filter: { type: 'bandpass', freq: 420, q: 2 }, duration: 0.1, gain: 0.28 }), osc('sine', 140, { freqEnd: 90, duration: 0.07, gain: 0.07 })],
    },
  }),
  defineSound({
    id: 'core:step_earth',
    label: 'Pas sur la terre',
    category: 'sfx',
    recipe: { variation: 0.2, layers: [noise('brown', { filter: { type: 'lowpass', freq: 700 }, duration: 0.1, gain: 0.22 })] },
  }),
  defineSound({
    id: 'core:step_metal',
    label: 'Pas sur le métal',
    category: 'sfx',
    recipe: { variation: 0.12, layers: [noise('white', { filter: { type: 'bandpass', freq: 2400, q: 6 }, duration: 0.08, gain: 0.12 }), osc('triangle', 520, { duration: 0.12, gain: 0.03 })] },
  }),
  defineSound({ id: 'core:land', label: 'Atterrissage', category: 'sfx', recipe: { layers: [noise('brown', { filter: { type: 'lowpass', freq: 260 }, duration: 0.18, gain: 0.45 })] } }),
  defineSound({ id: 'core:jump', label: 'Saut', category: 'sfx', recipe: { layers: [noise('pink', { filter: { type: 'bandpass', freq: 700 }, duration: 0.08, gain: 0.06 })] } }),
  defineSound({
    id: 'core:page',
    label: 'Feuilles de papier',
    category: 'sfx',
    recipe: { layers: [noise('white', { filter: { type: 'bandpass', freq: 2600, q: 0.8 }, attack: 0.02, duration: 0.28, gain: 0.1, repeat: { count: 2, interval: 0.14 } })] },
  }),
  defineSound({
    id: 'core:mechanism',
    label: 'Mécanisme',
    category: 'sfx',
    recipe: {
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 1800, q: 5 }, duration: 0.03, gain: 0.22, repeat: { count: 9, interval: 0.09, pitchStep: 0.02 } }),
        osc('sawtooth', 55, { filter: { type: 'lowpass', freq: 200 }, attack: 0.1, duration: 1.0, gain: 0.1 }),
      ],
    },
  }),
  defineSound({
    id: 'core:shimmer',
    label: 'Scintillement',
    category: 'sfx',
    recipe: {
      layers: [1318.5, 1568, 1975.5, 2637].map((f, i) => osc('sine', f, { delay: i * 0.07, attack: 0.02, duration: 1.1, gain: 0.05 })),
    },
  }),
  defineSound({
    id: 'core:whoosh',
    label: 'Souffle',
    category: 'sfx',
    recipe: { layers: [noise('white', { filter: { type: 'bandpass', freq: 380, freqEnd: 2400, q: 1 }, attack: 0.16, duration: 0.55, gain: 0.2 })] },
  }),
  defineSound({
    id: 'core:heartbeat',
    label: 'Battement de cœur',
    category: 'sfx',
    recipe: { layers: [osc('sine', 62, { freqEnd: 40, duration: 0.16, gain: 0.55 }), osc('sine', 58, { freqEnd: 38, delay: 0.24, duration: 0.18, gain: 0.45 })] },
  }),
  defineSound({
    id: 'core:bell',
    label: 'Cloche',
    category: 'sfx',
    recipe: {
      layers: [
        osc('sine', 440, { duration: 3, gain: 0.16 }),
        osc('sine', 1102, { duration: 2, gain: 0.07 }),
        osc('sine', 1610, { duration: 1.6, gain: 0.045 }),
        osc('sine', 2342, { duration: 1.1, gain: 0.03 }),
      ],
    },
  }),
  defineSound({
    id: 'core:impact',
    label: 'Impact sourd',
    category: 'sfx',
    recipe: { layers: [noise('brown', { filter: { type: 'lowpass', freq: 150 }, duration: 0.8, gain: 0.8 }), osc('sine', 52, { freqEnd: 30, duration: 0.6, gain: 0.55 })] },
  }),
  defineSound({
    id: 'core:low_drone',
    label: 'Bourdon grave',
    category: 'sfx',
    recipe: {
      layers: [
        osc('sawtooth', 55, { filter: { type: 'lowpass', freq: 180 }, attack: 0.8, duration: 4, gain: 0.13 }),
        osc('sine', 82.41, { attack: 1, duration: 4, gain: 0.09 }),
      ],
    },
  }),
  // ---- Combat and tools ---------------------------------------------------------------------
  defineSound({
    id: 'core:swing',
    label: 'Geste rapide',
    category: 'sfx',
    recipe: { variation: 0.08, layers: [noise('white', { filter: { type: 'bandpass', freq: 900, freqEnd: 2600, q: 1.4 }, attack: 0.03, duration: 0.18, gain: 0.16 })] },
  }),
  defineSound({
    id: 'core:swing_heavy',
    label: 'Geste lourd',
    category: 'sfx',
    recipe: {
      variation: 0.05,
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 420, freqEnd: 1600, q: 1.1 }, attack: 0.06, duration: 0.32, gain: 0.26 }),
        osc('sine', 110, { freqEnd: 70, attack: 0.05, duration: 0.3, gain: 0.12 }),
      ],
    },
  }),
  defineSound({
    id: 'core:hit',
    label: 'Coup qui porte',
    category: 'sfx',
    recipe: {
      variation: 0.1,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 900 }, duration: 0.14, gain: 0.55 }),
        osc('square', 180, { freqEnd: 70, filter: { type: 'lowpass', freq: 1200 }, duration: 0.12, gain: 0.12 }),
      ],
    },
  }),
  defineSound({
    id: 'core:clang',
    label: 'Coup sans effet (métal)',
    category: 'sfx',
    recipe: {
      variation: 0.06,
      layers: [
        osc('triangle', 1240, { duration: 0.5, gain: 0.09 }),
        osc('sine', 1870, { duration: 0.35, gain: 0.06 }),
        noise('white', { filter: { type: 'highpass', freq: 3000 }, duration: 0.05, gain: 0.12 }),
      ],
    },
  }),
  defineSound({
    id: 'core:block',
    label: 'Coup bloqué',
    category: 'sfx',
    recipe: {
      variation: 0.08,
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 700, q: 1.5 }, duration: 0.12, gain: 0.35 }),
        osc('triangle', 520, { freqEnd: 380, duration: 0.18, gain: 0.08 }),
      ],
    },
  }),
  defineSound({
    id: 'core:parry',
    label: 'Parade parfaite',
    category: 'sfx',
    recipe: {
      layers: [
        osc('triangle', 1568, { duration: 0.6, gain: 0.11 }),
        osc('sine', 2349, { delay: 0.02, duration: 0.5, gain: 0.07 }),
        noise('white', { filter: { type: 'highpass', freq: 2500 }, duration: 0.06, gain: 0.2 }),
      ],
    },
  }),
  defineSound({
    id: 'core:guard_break',
    label: 'Garde brisée',
    category: 'sfx',
    recipe: {
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 600 }, duration: 0.35, gain: 0.6 }),
        osc('sawtooth', 220, { freqEnd: 60, filter: { type: 'lowpass', freq: 900 }, duration: 0.35, gain: 0.12 }),
      ],
    },
  }),
  defineSound({
    id: 'core:guard_up',
    label: 'Garde levée',
    category: 'sfx',
    recipe: { variation: 0.05, layers: [noise('pink', { filter: { type: 'bandpass', freq: 1200, q: 2 }, attack: 0.01, duration: 0.07, gain: 0.12 })] },
  }),
  defineSound({
    id: 'core:hurt',
    label: 'Le joueur est touché',
    category: 'sfx',
    recipe: {
      variation: 0.06,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 500 }, duration: 0.22, gain: 0.5 }),
        osc('sine', 90, { freqEnd: 50, duration: 0.25, gain: 0.3 }),
      ],
    },
  }),
  defineSound({
    id: 'core:defeat',
    label: 'Le joueur tombe',
    category: 'sfx',
    recipe: {
      layers: [
        osc('sine', 196, { freqEnd: 65, attack: 0.05, duration: 1.6, gain: 0.18 }),
        osc('sine', 233, { freqEnd: 78, attack: 0.05, duration: 1.6, gain: 0.1 }),
        noise('brown', { filter: { type: 'lowpass', freq: 220 }, delay: 0.4, duration: 0.6, gain: 0.4 }),
      ],
    },
  }),
  defineSound({
    id: 'core:defeat_enemy',
    label: 'Adversaire vaincu',
    category: 'sfx',
    recipe: {
      variation: 0.08,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 400 }, delay: 0.05, duration: 0.5, gain: 0.5 }),
        osc('square', 330, { freqEnd: 90, filter: { type: 'lowpass', freq: 1400 }, duration: 0.45, gain: 0.07 }),
        noise('white', { filter: { type: 'bandpass', freq: 3200, q: 6 }, delay: 0.15, duration: 0.03, gain: 0.12, repeat: { count: 5, interval: 0.06, gainStep: -0.02 } }),
      ],
    },
  }),
  defineSound({
    id: 'core:dodge',
    label: 'Esquive',
    category: 'sfx',
    recipe: { variation: 0.08, layers: [noise('white', { filter: { type: 'bandpass', freq: 600, freqEnd: 1800, q: 0.9 }, attack: 0.02, duration: 0.22, gain: 0.14 })] },
  }),
  defineSound({
    id: 'core:windup',
    label: 'Adversaire qui prépare un coup',
    category: 'sfx',
    recipe: {
      variation: 0.05,
      layers: [
        osc('sawtooth', 140, { freqEnd: 260, filter: { type: 'lowpass', freq: 700 }, attack: 0.08, duration: 0.4, gain: 0.07 }),
        noise('white', { filter: { type: 'bandpass', freq: 2200, q: 8 }, duration: 0.03, gain: 0.08, repeat: { count: 3, interval: 0.08 } }),
      ],
    },
  }),
  defineSound({
    id: 'core:charge_ready',
    label: 'Coup chargé prêt',
    category: 'sfx',
    recipe: { layers: [osc('sine', 880, { duration: 0.18, gain: 0.07 }), osc('sine', 1320, { delay: 0.06, duration: 0.22, gain: 0.06 })] },
  }),
  defineSound({
    id: 'core:thud',
    label: 'Coup dans un mur',
    category: 'sfx',
    recipe: { variation: 0.1, layers: [noise('brown', { filter: { type: 'lowpass', freq: 380 }, duration: 0.1, gain: 0.45 })] },
  }),
  // ---- Ambiences (looped) -------------------------------------------------------------------
  defineSound({
    id: 'core:amb_wind',
    label: 'Vent',
    category: 'ambience',
    recipe: { loopSeconds: 8, layers: [noise('brown', { filter: { type: 'lowpass', freq: 520, freqEnd: 300 }, attack: 2.5, duration: 8, release: 2.5, gain: 0.22 })] },
  }),
  defineSound({
    id: 'core:amb_city',
    label: 'Rumeur de la ville',
    category: 'ambience',
    recipe: {
      loopSeconds: 10,
      layers: [
        noise('pink', { filter: { type: 'lowpass', freq: 650 }, attack: 1, duration: 10, release: 1, gain: 0.09 }),
        noise('white', { filter: { type: 'bandpass', freq: 2600, q: 9 }, delay: 2.3, duration: 0.05, gain: 0.04, repeat: { count: 3, interval: 2.7 } }),
      ],
    },
  }),
  defineSound({
    id: 'core:amb_interior',
    label: 'Intérieur calme',
    category: 'ambience',
    recipe: { loopSeconds: 6, layers: [osc('sine', 60, { attack: 1, duration: 6, release: 1, gain: 0.025 }), noise('brown', { filter: { type: 'lowpass', freq: 200 }, attack: 1, duration: 6, release: 1, gain: 0.04 })] },
  }),
  defineSound({
    id: 'core:amb_night',
    label: 'Nuit (grillons)',
    category: 'ambience',
    recipe: {
      loopSeconds: 6,
      layers: [
        osc('sine', 4300, { duration: 0.04, gain: 0.015, repeat: { count: 12, interval: 0.07 } }),
        osc('sine', 4100, { delay: 2.4, duration: 0.04, gain: 0.012, repeat: { count: 10, interval: 0.07 } }),
        noise('brown', { filter: { type: 'lowpass', freq: 300 }, attack: 1, duration: 6, release: 1, gain: 0.04 }),
      ],
    },
  }),
];

export const menuTheme = defineMusic({
  id: 'core:music.menu',
  label: 'Thème du multivers',
  recipe: {
    bpm: 62,
    reverb: 0.55,
    loop: true,
    tracks: [
      {
        instrument: { wave: 'sawtooth', wave2: 'triangle', detune2: 7, attack: 1.6, decay: 1, sustain: 0.65, release: 2.6, filter: { type: 'lowpass', freq: 900 }, gain: 0.07 },
        notes: 'D3+A3+F4:8 Bb2+F3+D4:8 G2+D3+Bb3:8 A2+E3+C#4:8',
      },
      {
        instrument: { wave: 'sine', attack: 0.004, decay: 1.4, sustain: 0, release: 1.6, gain: 0.11 },
        notes: '-:2 A4:2 F4:1 E4:1 D4:2 -:2 F4:1 G4:1 A4:2 Bb4:2 -:2 G4:2 F4:1 E4:1 D4:4 -:2 E4:2 C#4:2 A3:2 -:2',
      },
      {
        instrument: { wave: 'triangle', attack: 0.02, decay: 0.6, sustain: 0.4, release: 0.8, filter: { type: 'lowpass', freq: 500 }, gain: 0.09 },
        notes: 'D2:4 D2:4 Bb1:4 Bb1:4 G1:4 G1:4 A1:4 A1:4',
      },
    ],
  },
});
