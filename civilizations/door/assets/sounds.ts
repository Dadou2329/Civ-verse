import { defineMusic, defineSound, type SoundLayer } from '@sdk';

/**
 * Verrou's sound palette: locks, seals, mechanisms and four musical themes. All procedural
 * (original recipes, no recorded audio). The voice behind the absent door is a breath-like
 * texture: its words are shown as French subtitles, never synthesized speech.
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

export const doorSounds = [
  defineSound({
    id: 'door:palm_awaken',
    label: 'La marque de la paume s’éveille',
    category: 'sfx',
    recipe: {
      layers: [
        osc('sine', 110, { freqEnd: 220, attack: 0.4, duration: 2.2, release: 1, gain: 0.18 }),
        osc('triangle', 880, { attack: 0.02, delay: 0.5, duration: 1.6, release: 1.2, gain: 0.07, vibrato: { rate: 5, depth: 6 } }),
        osc('triangle', 1318.5, { attack: 0.02, delay: 0.75, duration: 1.4, release: 1.2, gain: 0.05 }),
        noise('pink', { filter: { type: 'bandpass', freq: 2400, freqEnd: 600, q: 3 }, attack: 0.3, duration: 1.8, gain: 0.08 }),
      ],
    },
  }),
  defineSound({
    id: 'door:rank_up',
    label: 'Nouveau rang',
    category: 'ui',
    recipe: {
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 500 }, duration: 0.18, gain: 0.55 }),
        osc('triangle', 523.25, { delay: 0.12, duration: 0.5, gain: 0.1 }),
        osc('triangle', 659.25, { delay: 0.24, duration: 0.5, gain: 0.1 }),
        osc('triangle', 783.99, { delay: 0.36, duration: 0.9, release: 0.6, gain: 0.11 }),
        osc('sine', 1567.98, { delay: 0.36, duration: 1.2, release: 0.9, gain: 0.04 }),
      ],
    },
  }),
  defineSound({
    id: 'door:access_denied',
    label: 'Accès refusé',
    category: 'sfx',
    recipe: {
      variation: 0.03,
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 1800, q: 5 }, duration: 0.05, gain: 0.4 }),
        noise('brown', { filter: { type: 'lowpass', freq: 260 }, delay: 0.04, duration: 0.25, gain: 0.6 }),
        osc('square', 98, { filter: { type: 'lowpass', freq: 400 }, delay: 0.06, duration: 0.45, gain: 0.07 }),
      ],
    },
  }),
  defineSound({
    id: 'door:dial_tick',
    label: 'Cran de cadran',
    category: 'ui',
    recipe: {
      variation: 0.12,
      layers: [noise('white', { filter: { type: 'bandpass', freq: 4200, q: 9 }, duration: 0.025, gain: 0.35 })],
    },
  }),
  defineSound({
    id: 'door:dial_set',
    label: 'Cadran enclenché',
    category: 'ui',
    recipe: {
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 2600, q: 7 }, duration: 0.04, gain: 0.5 }),
        osc('sine', 1760, { delay: 0.03, duration: 0.6, release: 0.5, gain: 0.06 }),
      ],
    },
  }),
  defineSound({
    id: 'door:imprint',
    label: 'Empreinte frappée',
    category: 'sfx',
    recipe: {
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 3000, q: 4 }, duration: 0.08, gain: 0.5, repeat: { count: 3, interval: 0.32, gainStep: 0.1 } }),
        osc('triangle', 1975, { duration: 0.4, gain: 0.06, repeat: { count: 3, interval: 0.32, pitchStep: 1.06 } }),
        noise('pink', { filter: { type: 'highpass', freq: 5000 }, delay: 1, attack: 0.05, duration: 0.8, gain: 0.08 }),
      ],
    },
  }),
  defineSound({
    id: 'door:slam',
    label: 'Porte qui claque',
    category: 'sfx',
    recipe: {
      variation: 0.07,
      refDistance: 4,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 240 }, duration: 0.5, release: 0.4, gain: 0.95 }),
        osc('sine', 70, { freqEnd: 38, duration: 0.45, gain: 0.5 }),
        noise('white', { filter: { type: 'bandpass', freq: 2200, q: 6 }, delay: 0.05, duration: 0.06, gain: 0.3, repeat: { count: 2, interval: 0.09 } }),
      ],
    },
  }),
  defineSound({
    id: 'door:knock',
    label: 'Coups à une porte',
    category: 'sfx',
    recipe: {
      layers: [noise('brown', { filter: { type: 'lowpass', freq: 600 }, duration: 0.09, gain: 0.8, repeat: { count: 3, interval: 0.28, gainStep: -0.1 } })],
    },
  }),
  defineSound({
    id: 'door:seal',
    label: 'Tampon de sceau',
    category: 'sfx',
    recipe: {
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 700 }, duration: 0.12, gain: 0.7 }),
        osc('sine', 392, { delay: 0.05, duration: 0.7, release: 0.6, gain: 0.07 }),
        osc('sine', 587.33, { delay: 0.05, duration: 0.7, release: 0.6, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'door:voice',
    label: 'Souffle de la Voix',
    category: 'voice',
    recipe: {
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 700, freqEnd: 1400, q: 2 }, attack: 0.6, duration: 3.4, release: 1.4, gain: 0.16 }),
        osc('sine', 55, { attack: 1, duration: 3.6, release: 1.5, gain: 0.12 }),
        osc('triangle', 440, { attack: 1.2, delay: 0.4, duration: 3, release: 1.4, gain: 0.025, vibrato: { rate: 3, depth: 10 } }),
      ],
    },
  }),
  defineSound({
    id: 'door:cough',
    label: 'Toux étouffée derrière une porte',
    category: 'sfx',
    recipe: {
      variation: 0.1,
      layers: [noise('pink', { filter: { type: 'bandpass', freq: 520, q: 1.6 }, attack: 0.01, duration: 0.16, gain: 0.35, repeat: { count: 3, interval: 0.24, gainStep: -0.08 } })],
    },
  }),
  // --- Ambiences ------------------------------------------------------------------------------
  defineSound({
    id: 'door:amb_drips',
    label: 'Ambiance — Faubourg humide',
    category: 'ambience',
    recipe: {
      loopSeconds: 8,
      layers: [
        noise('brown', { filter: { type: 'lowpass', freq: 300 }, attack: 1, duration: 8, release: 1, gain: 0.14 }),
        osc('sine', 1900, { freqEnd: 1300, duration: 0.07, gain: 0.05, delay: 0.7, repeat: { count: 5, interval: 1.45, pitchStep: 0.97 } }),
        osc('sine', 2300, { freqEnd: 1500, duration: 0.06, gain: 0.03, delay: 1.3, repeat: { count: 3, interval: 2.3 } }),
      ],
    },
  }),
  defineSound({
    id: 'door:amb_gears',
    label: 'Ambiance — Engrenages',
    category: 'ambience',
    recipe: {
      loopSeconds: 4,
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 3400, q: 10 }, duration: 0.03, gain: 0.1, repeat: { count: 16, interval: 0.25 } }),
        noise('brown', { filter: { type: 'lowpass', freq: 180 }, attack: 0.5, duration: 4, release: 0.5, gain: 0.2 }),
        osc('sawtooth', 48, { filter: { type: 'lowpass', freq: 160 }, attack: 0.5, duration: 4, release: 0.5, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'door:amb_void',
    label: 'Ambiance — Étendue étoilée',
    category: 'ambience',
    recipe: {
      loopSeconds: 10,
      layers: [
        osc('sine', 82.41, { attack: 3, duration: 10, release: 3, gain: 0.12, vibrato: { rate: 0.2, depth: 4 } }),
        osc('sine', 123.47, { attack: 4, duration: 10, release: 3, gain: 0.06 }),
        noise('pink', { filter: { type: 'bandpass', freq: 3000, q: 1 }, attack: 4, duration: 10, release: 3, gain: 0.03 }),
      ],
    },
  }),
];

const PAD = { wave: 'sawtooth', wave2: 'triangle', detune2: 6, attack: 1.4, decay: 1, sustain: 0.6, release: 2.2, filter: { type: 'lowpass', freq: 800 }, gain: 0.06 } as const;
const BELL = { wave: 'sine', attack: 0.004, decay: 1.2, sustain: 0, release: 1.4, gain: 0.1 } as const;
const PLUCK = { wave: 'triangle', attack: 0.004, decay: 0.35, sustain: 0.1, release: 0.4, filter: { type: 'lowpass', freq: 1800 }, gain: 0.08 } as const;
const BASS = { wave: 'triangle', attack: 0.02, decay: 0.6, sustain: 0.4, release: 0.8, filter: { type: 'lowpass', freq: 420 }, gain: 0.09 } as const;

export const doorMusic = [
  defineMusic({
    id: 'door:music.faubourg',
    label: 'Verrou — Le Faubourg Bas',
    recipe: {
      bpm: 66,
      reverb: 0.5,
      loop: true,
      tracks: [
        { instrument: PAD, notes: 'E3+B3+G4:8 C3+G3+E4:8 A2+E3+C4:8 B2+F#3+D#4:8' },
        { instrument: BELL, notes: '-:4 B4:1 G4:1 E4:2 -:4 C5:1 B4:1 G4:2 -:4 A4:1 G4:1 E4:2 -:2 F#4:2 D#4:4' },
        { instrument: BASS, notes: 'E2:4 E2:4 C2:4 C2:4 A1:4 A1:4 B1:4 B1:4' },
      ],
    },
  }),
  defineMusic({
    id: 'door:music.galerie',
    label: 'Verrou — La Galerie des Métiers',
    recipe: {
      bpm: 92,
      reverb: 0.35,
      loop: true,
      tracks: [
        { instrument: PLUCK, notes: 'D4:0.5 F#4:0.5 A4:0.5 F#4:0.5 D4:0.5 F#4:0.5 A4:1 G4:0.5 B4:0.5 D5:0.5 B4:0.5 G4:0.5 B4:0.5 D5:1 A4:0.5 C#5:0.5 E5:0.5 C#5:0.5 A4:0.5 C#5:0.5 E5:1 F#4:0.5 A4:0.5 D5:0.5 A4:0.5 F#4:2' },
        { instrument: { ...PAD, gain: 0.04 }, notes: 'D3+A3+F#4:4 G3+B3+D4:4 A3+C#4+E4:4 D3+A3+F#4:4' },
        { instrument: BASS, notes: 'D2:2 A2:2 G2:2 D2:2 A2:2 E2:2 D2:2 A1:2' },
      ],
    },
  }),
  defineMusic({
    id: 'door:music.archives',
    label: 'Verrou — Les Archives du Haut',
    recipe: {
      bpm: 54,
      reverb: 0.7,
      loop: true,
      tracks: [
        { instrument: { ...PAD, filter: { type: 'lowpass', freq: 1200 }, gain: 0.05 }, notes: 'F3+C4+Ab4:8 Db3+Ab3+F4:8 Eb3+Bb3+G4:8 C3+G3+E4:8' },
        { instrument: BELL, notes: '-:2 C5:2 Ab4:2 G4:2 -:2 F4:2 Ab4:2 Db5:2 -:2 Bb4:2 G4:2 Eb4:2 -:2 E4:2 G4:4' },
      ],
    },
  }),
  defineMusic({
    id: 'door:music.absente',
    label: 'Verrou — La Porte Absente',
    recipe: {
      bpm: 48,
      reverb: 0.85,
      loop: true,
      tracks: [
        { instrument: { ...PAD, wave: 'sine', wave2: 'sawtooth', detune2: 11, filter: { type: 'lowpass', freq: 600 }, gain: 0.07 }, notes: 'C2+G2+Db3:8 C2+Gb2+Db3:8' },
        { instrument: { ...BELL, gain: 0.07 }, notes: '-:6 G4:2 -:4 Db5:1 C5:3 -:8' },
      ],
    },
  }),
  defineMusic({
    id: 'door:music.fin',
    label: 'Verrou — D’autres seuils',
    recipe: {
      bpm: 60,
      reverb: 0.65,
      loop: true,
      tracks: [
        { instrument: PAD, notes: 'C3+G3+E4:8 A2+E3+C4:8 F2+C3+A3:8 G2+D3+B3:8' },
        { instrument: BELL, notes: '-:2 E5:2 D5:2 C5:2 -:2 E5:1 G5:1 A5:2 F5:2 -:2 D5:2 C5:2 B4:2 D5:4' },
        { instrument: BASS, notes: 'C2:4 C2:4 A1:4 A1:4 F1:4 F1:4 G1:4 G1:4' },
      ],
    },
  }),
];
