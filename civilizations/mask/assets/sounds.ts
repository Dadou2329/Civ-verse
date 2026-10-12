import { defineMusic, defineSound, type InstrumentRecipe, type SoundLayer } from '@sdk';

/**
 * Viremasque's sounds and music, all procedural (original recipes, no recorded audio). The
 * Rives Basses theme is a bright workshop tune with soft percussion; the runaway lift gets a
 * driving chase; victories get short fanfares. Characters have no synthesized voice: their lines
 * are French subtitles.
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

export const maskSounds = [
  defineSound({
    id: 'mask:braise',
    label: 'Frappe Braise',
    category: 'sfx',
    recipe: {
      variation: 0.04,
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 500, freqEnd: 2200, q: 1.2 }, attack: 0.04, duration: 0.25, gain: 0.3 }),
        osc('sine', 120, { freqEnd: 45, delay: 0.08, duration: 0.4, gain: 0.45 }),
        noise('white', { filter: { type: 'bandpass', freq: 3600, q: 7 }, delay: 0.12, duration: 0.025, gain: 0.16, repeat: { count: 8, interval: 0.045, gainStep: -0.015, pitchStep: 0.05 } }),
      ],
    },
  }),
  defineSound({
    id: 'mask:masque_enfile',
    label: 'Masque enfilé',
    category: 'sfx',
    recipe: {
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 1500, q: 3 }, duration: 0.06, gain: 0.18 }),
        osc('triangle', 660, { delay: 0.08, attack: 0.02, duration: 0.5, gain: 0.07 }),
        osc('triangle', 990, { delay: 0.16, attack: 0.02, duration: 0.6, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:alarme',
    label: 'Cloche d’alarme du monte-charge',
    category: 'sfx',
    recipe: {
      layers: [
        osc('square', 880, { filter: { type: 'lowpass', freq: 2400 }, duration: 0.12, gain: 0.08, repeat: { count: 6, interval: 0.18 } }),
        osc('triangle', 1320, { duration: 0.1, gain: 0.05, repeat: { count: 6, interval: 0.18 } }),
      ],
    },
  }),
  defineSound({
    id: 'mask:grincement',
    label: 'Grincement de métal',
    category: 'sfx',
    recipe: {
      variation: 0.08,
      layers: [
        osc('sawtooth', 620, { freqEnd: 410, filter: { type: 'bandpass', freq: 900, q: 6 }, attack: 0.08, duration: 0.9, gain: 0.08, vibrato: { rate: 17, depth: 30 } }),
        noise('white', { filter: { type: 'bandpass', freq: 2600, q: 5 }, attack: 0.1, duration: 0.8, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:vapeur',
    label: 'Jet de vapeur',
    category: 'sfx',
    recipe: { layers: [noise('white', { filter: { type: 'highpass', freq: 2200 }, attack: 0.05, duration: 0.9, release: 0.4, gain: 0.16 })] },
  }),
  defineSound({
    id: 'mask:acclamations',
    label: 'Acclamations du quartier',
    category: 'sfx',
    recipe: {
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 900, q: 0.8 }, attack: 0.4, duration: 3, release: 1.2, gain: 0.22 }),
        noise('white', { filter: { type: 'bandpass', freq: 2200, q: 2 }, attack: 0.3, duration: 2.5, release: 1, gain: 0.08 }),
        osc('sine', 1800, { freqEnd: 2600, delay: 0.6, attack: 0.05, duration: 0.5, gain: 0.04 }),
        osc('sine', 2100, { freqEnd: 1500, delay: 1.3, attack: 0.05, duration: 0.6, gain: 0.04 }),
        noise('white', { filter: { type: 'bandpass', freq: 1800, q: 9 }, delay: 0.5, duration: 0.03, gain: 0.1, repeat: { count: 14, interval: 0.12, gainStep: -0.005 } }),
      ],
    },
  }),
  defineSound({
    id: 'mask:cloches_ville',
    label: 'Cloches de la ville',
    category: 'sfx',
    recipe: {
      layers: [
        ...[392, 523.25, 659.25, 783.99].map((f, i) => osc('sine', f, { delay: i * 0.45, duration: 2.4, release: 1.4, gain: 0.07 })),
        ...[392, 523.25, 659.25, 783.99].map((f, i) => osc('sine', f * 2.76, { delay: i * 0.45, duration: 1.2, release: 0.8, gain: 0.02 })),
      ],
    },
  }),
  defineSound({
    id: 'mask:roue_fixee',
    label: 'Roue fixée',
    category: 'sfx',
    recipe: {
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 500 }, duration: 0.18, gain: 0.5 }),
        noise('white', { filter: { type: 'bandpass', freq: 2400, q: 6 }, delay: 0.15, duration: 0.03, gain: 0.18, repeat: { count: 5, interval: 0.07 } }),
        osc('triangle', 330, { delay: 0.5, duration: 0.3, gain: 0.06 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:elan',
    label: 'Élan d’un Fil',
    category: 'sfx',
    recipe: {
      variation: 0.06,
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 700, freqEnd: 3800, q: 1.4 }, attack: 0.03, duration: 0.35, gain: 0.2 }),
        osc('sine', 440, { freqEnd: 1320, attack: 0.02, duration: 0.3, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:wagon_roule',
    label: 'Wagon qui roule',
    category: 'sfx',
    recipe: {
      loopSeconds: 2,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 260 }, attack: 0.2, duration: 2, release: 0.2, gain: 0.35 }),
        noise('white', { filter: { type: 'bandpass', freq: 1800, q: 8 }, duration: 0.03, gain: 0.1, repeat: { count: 8, interval: 0.25 } }),
      ],
    },
  }),
  // ---- Chapter I -----------------------------------------------------------------------------
  defineSound({
    id: 'mask:cran',
    label: 'Cran de réglage',
    category: 'sfx',
    recipe: {
      variation: 0.05,
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 3200, q: 8 }, duration: 0.025, gain: 0.22 }),
        osc('triangle', 1175, { delay: 0.03, duration: 0.12, gain: 0.08 }),
        osc('triangle', 1568, { delay: 0.09, duration: 0.18, gain: 0.06 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:glissade',
    label: 'Cagette qui glisse sur les planches mouillées',
    category: 'sfx',
    recipe: {
      variation: 0.1,
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 600, freqEnd: 1400, q: 2 }, attack: 0.05, duration: 1.1, release: 0.3, gain: 0.2 }),
        noise('white', { filter: { type: 'bandpass', freq: 4200, q: 6 }, delay: 0.1, duration: 0.6, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:pluie',
    label: 'Pluie sur les toits et les planches',
    category: 'sfx',
    recipe: {
      loopSeconds: 4,
      layers: [
        noise('pink', { filter: { type: 'highpass', freq: 900 }, attack: 0.5, duration: 4, release: 0.5, gain: 0.16 }),
        noise('white', { filter: { type: 'bandpass', freq: 5200, q: 1.5 }, attack: 0.5, duration: 4, release: 0.5, gain: 0.05 }),
        noise('white', { filter: { type: 'bandpass', freq: 2400, q: 9 }, delay: 0.2, duration: 0.02, gain: 0.06, repeat: { count: 12, interval: 0.31 } }),
      ],
    },
  }),
  defineSound({
    id: 'mask:tonnerre',
    label: 'Coup de tonnerre',
    category: 'sfx',
    recipe: {
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 900, freqEnd: 160 }, attack: 0.01, duration: 0.5, release: 2.6, gain: 0.7 }),
        noise('brown', { filter: { type: 'lowpass', freq: 220 }, delay: 0.4, attack: 0.3, duration: 1.8, release: 1.5, gain: 0.45 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:tampon',
    label: 'Coup de tampon',
    category: 'sfx',
    recipe: {
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 400 }, duration: 0.08, gain: 0.6 }),
        osc('sine', 160, { freqEnd: 70, duration: 0.15, gain: 0.3 }),
        osc('triangle', 784, { delay: 0.18, duration: 0.25, gain: 0.05 }),
        osc('triangle', 1046.5, { delay: 0.3, duration: 0.4, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'mask:sifflet',
    label: 'Coup de sifflet du départ',
    category: 'sfx',
    recipe: {
      layers: [osc('sine', 2350, { attack: 0.01, duration: 0.55, release: 0.1, gain: 0.12, vibrato: { rate: 34, depth: 90 } }), noise('white', { filter: { type: 'bandpass', freq: 2400, q: 4 }, duration: 0.5, gain: 0.04 })],
    },
  }),
  defineSound({
    id: 'mask:filament',
    label: 'Trame qui répond (filament bleu)',
    category: 'sfx',
    recipe: {
      layers: [
        osc('sine', 330, { freqEnd: 990, attack: 0.3, duration: 1.4, release: 0.6, gain: 0.08, vibrato: { rate: 6, depth: 14 } }),
        osc('triangle', 1320, { freqEnd: 1980, delay: 0.2, attack: 0.2, duration: 1.2, release: 0.5, gain: 0.03, vibrato: { rate: 11, depth: 25 } }),
        noise('white', { filter: { type: 'bandpass', freq: 6000, q: 5 }, delay: 0.3, attack: 0.4, duration: 1.1, release: 0.4, gain: 0.03 }),
        noise('white', { filter: { type: 'bandpass', freq: 3000, q: 10 }, delay: 1.6, duration: 0.04, gain: 0.15 }),
      ],
    },
  }),
  // ---- Ambience ------------------------------------------------------------------------------
  defineSound({
    id: 'mask:amb_rives',
    label: 'Rives Basses : marché, eau, marteaux',
    category: 'ambience',
    recipe: {
      loopSeconds: 12,
      layers: [
        noise('pink', { filter: { type: 'lowpass', freq: 700 }, attack: 1, duration: 12, release: 1, gain: 0.07 }),
        noise('brown', { filter: { type: 'bandpass', freq: 380, q: 0.6 }, attack: 1.5, duration: 12, release: 1.5, gain: 0.08 }),
        osc('triangle', 2093, { delay: 1.1, duration: 0.05, gain: 0.025, repeat: { count: 3, interval: 0.32 } }),
        osc('triangle', 1760, { delay: 6.4, duration: 0.05, gain: 0.02, repeat: { count: 4, interval: 0.3 } }),
        noise('white', { filter: { type: 'bandpass', freq: 3000, q: 10 }, delay: 3.2, duration: 0.04, gain: 0.03, repeat: { count: 2, interval: 0.4 } }),
        osc('sine', 1568, { delay: 9, duration: 0.12, gain: 0.015, vibrato: { rate: 9, depth: 40 } }),
      ],
    },
  }),
];

// ---- Music ---------------------------------------------------------------------------------------

const PLUCK: InstrumentRecipe = { wave: 'triangle', wave2: 'square', detune2: 5, attack: 0.004, decay: 0.32, sustain: 0.12, release: 0.25, filter: { type: 'lowpass', freq: 2600 }, gain: 0.1 };
const PAD: InstrumentRecipe = { wave: 'sawtooth', wave2: 'triangle', detune2: 8, attack: 0.5, decay: 0.6, sustain: 0.6, release: 1.2, filter: { type: 'lowpass', freq: 1100 }, gain: 0.035 };
const BASS: InstrumentRecipe = { wave: 'triangle', attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.2, filter: { type: 'lowpass', freq: 600 }, gain: 0.13 };
const KICK: InstrumentRecipe = { wave: 'sine', attack: 0.002, decay: 0.12, sustain: 0, release: 0.05, gain: 0.22 };
const TICK: InstrumentRecipe = { wave: 'triangle', attack: 0.001, decay: 0.04, sustain: 0, release: 0.02, gain: 0.05 };
const BRASS_LEAD: InstrumentRecipe = { wave: 'sawtooth', wave2: 'square', detune2: 4, attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.3, filter: { type: 'lowpass', freq: 2000 }, gain: 0.07 };

const repeat = (pattern: string, n: number) => Array.from({ length: n }, () => pattern).join(' ');

export const rivesTheme = defineMusic({
  id: 'mask:music.rives',
  label: 'Rives Basses — L’atelier qui chante',
  recipe: {
    bpm: 112,
    reverb: 0.25,
    loop: true,
    tracks: [
      {
        instrument: PLUCK,
        notes:
          'G4:0.5 B4:0.5 D5:1 B4:0.5 C5:0.5 A4:1 F#4:0.5 A4:0.5 C5:1 A4:0.5 B4:0.5 G4:1 E4:0.5 G4:0.5 B4:1 G4:0.5 A4:0.5 F#4:1 D4:0.5 F#4:0.5 A4:0.5 C5:0.5 B4:2 ' +
          'G4:0.5 B4:0.5 D5:1 E5:0.5 D5:0.5 B4:1 C5:0.5 E5:0.5 G5:1 E5:0.5 D5:0.5 C5:1 B4:0.5 G4:0.5 E4:1 A4:0.5 F#4:0.5 D4:1 G4:1 D4:0.5 B3:0.5 G3:2',
      },
      { instrument: PAD, notes: repeat('G3+B3+D4:4 D3+F#3+A3:4 E3+G3+B3:4 C3+E3+G3:2 D3+F#3+A3:2', 2) },
      { instrument: BASS, notes: repeat('G2:1 G2:0.5 D2:0.5 G2:1 D2:1 D2:1 D2:0.5 A1:0.5 D2:1 A1:1 E2:1 E2:0.5 B1:0.5 E2:1 B1:1 C2:1 C2:1 D2:1 D2:1', 2) },
      { instrument: KICK, notes: repeat('G1:1', 32) },
      { instrument: TICK, notes: repeat('-:0.5 A6:0.5', 32) },
    ],
  },
});

export const dangerTheme = defineMusic({
  id: 'mask:music.danger',
  label: 'Le monte-charge fou',
  recipe: {
    bpm: 148,
    reverb: 0.2,
    loop: true,
    tracks: [
      { instrument: { ...BASS, gain: 0.15 }, notes: repeat('E2:0.5 E2:0.5 E3:0.5 E2:0.5 G2:0.5 E2:0.5 A2:0.5 B2:0.5', 4) },
      { instrument: { ...PLUCK, gain: 0.08 }, notes: repeat('B4:0.5 E5:0.5 B4:0.5 G4:0.5', 4) + ' ' + repeat('C5:0.5 E5:0.5 C5:0.5 A4:0.5', 2) + ' ' + repeat('D5:0.5 F#5:0.5 D5:0.5 B4:0.5', 2) },
      { instrument: PAD, notes: 'E3+G3+B3:4 E3+G3+B3:4 C3+E3+A3:4 D3+F#3+B3:4' },
      { instrument: KICK, notes: repeat('E1:1', 16) },
      { instrument: TICK, notes: repeat('B6:0.5', 32) },
    ],
  },
});

export const victoryTheme = defineMusic({
  id: 'mask:music.victoire',
  label: 'Petite victoire des Rives',
  recipe: {
    bpm: 120,
    reverb: 0.35,
    loop: false,
    tracks: [
      { instrument: BRASS_LEAD, notes: 'G4:0.5 B4:0.5 D5:0.5 G5:1.5 F#5:0.5 E5:0.5 F#5:0.5 G5:3' },
      { instrument: PAD, notes: 'G3+B3+D4:2 C3+E3+G3:2 D3+F#3+A3:2 G3+B3+D4:2' },
      { instrument: BASS, notes: 'G2:2 C2:2 D2:2 G1:2' },
      { instrument: KICK, notes: 'G1:1 G1:1 G1:1 G1:1 G1:2 G1:2' },
    ],
  },
});

export const feteTheme = defineMusic({
  id: 'mask:music.fete',
  label: 'La fête du quartier',
  recipe: {
    bpm: 132,
    reverb: 0.3,
    loop: true,
    tracks: [
      {
        instrument: { ...PLUCK, gain: 0.11 },
        notes:
          'D5:0.5 D5:0.5 E5:0.5 F#5:0.5 A5:1 F#5:0.5 E5:0.5 D5:0.5 E5:0.5 F#5:0.5 E5:0.5 D5:1 B4:1 ' +
          'G4:0.5 B4:0.5 D5:0.5 G5:0.5 F#5:1 E5:0.5 D5:0.5 C#5:0.5 D5:0.5 E5:0.5 C#5:0.5 A4:2',
      },
      { instrument: PAD, notes: 'D3+F#3+A3:4 B2+D3+F#3:4 G2+B2+D3:4 A2+C#3+E3:4' },
      { instrument: BASS, notes: repeat('D2:1 A2:1', 2) + ' ' + repeat('B1:1 F#2:1', 2) + ' ' + repeat('G1:1 D2:1', 2) + ' ' + repeat('A1:1 E2:1', 2) },
      { instrument: KICK, notes: repeat('D1:1', 16) },
      { instrument: TICK, notes: repeat('-:0.5 A6:0.25 A6:0.25', 16) },
    ],
  },
});

export const qualificationTheme = defineMusic({
  id: 'mask:music.qualification',
  label: 'La qualification',
  recipe: {
    bpm: 138,
    reverb: 0.2,
    loop: true,
    tracks: [
      { instrument: { ...BRASS_LEAD, gain: 0.06 }, notes: 'A4:1 C5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 F5:1 D5:0.5 F5:0.5 E5:2 A4:1 C5:0.5 E5:0.5 A5:1 B5:0.5 C6:0.5 B5:1 G5:1 A5:2' },
      { instrument: PAD, notes: 'A2+C3+E3:4 F2+A2+C3:4 A2+C3+E3:4 G2+B2+D3:4' },
      { instrument: { ...BASS, gain: 0.14 }, notes: repeat('A1:0.5 A2:0.5', 8) + ' ' + repeat('G1:0.5 G2:0.5', 8) },
      { instrument: KICK, notes: repeat('A1:0.5 -:0.5', 16) },
      { instrument: TICK, notes: repeat('E6:0.5', 32) },
    ],
  },
});

export const vaurelTheme = defineMusic({
  id: 'mask:music.vaurel',
  label: 'Le cabinet du Grand Fixateur',
  recipe: {
    bpm: 60,
    reverb: 0.5,
    loop: false,
    tracks: [
      { instrument: { ...PAD, gain: 0.05, filter: { type: 'lowpass', freq: 700 } }, notes: 'D2+A2+D3:4 C#2+G#2+C#3:4' },
      { instrument: { wave: 'sine', attack: 0.01, decay: 1.2, sustain: 0, release: 0.8, gain: 0.07 }, notes: '-:1 A5:1 -:2 G#5:2 -:2' },
    ],
  },
});
