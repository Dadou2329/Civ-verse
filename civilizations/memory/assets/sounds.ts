import { defineMusic, defineSound, type SoundLayer } from '@sdk';

/**
 * Réminence's sounds. Silas's six-note song is the thread of the story: the same motif plays on
 * his violin, in the music of the market and, slowed down, in the White Room. Voices are never
 * synthesized: their words are French subtitles.
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

/** The song: D5 F5 E5 C5 D5 A4. */
export const SONG = [587.33, 698.46, 659.25, 523.25, 587.33, 440];

const violinNote = (freq: number, delay: number, duration = 0.5): SoundLayer =>
  osc('sawtooth', freq, { delay, attack: 0.06, duration, release: 0.25, gain: 0.07, filter: { type: 'lowpass', freq: 2200 }, vibrato: { rate: 5.5, depth: 7 } });

export const memorySounds = [
  defineSound({
    id: 'memory:silas_song',
    label: 'La chanson de Silas (violon)',
    category: 'sfx',
    recipe: {
      loopSeconds: 5,
      refDistance: 3,
      layers: SONG.map((f, i) => violinNote(f, 0.2 + i * 0.5, i === SONG.length - 1 ? 1.4 : 0.5)),
    },
  }),
  defineSound({
    id: 'memory:echo',
    label: 'Écho (souvenir qui remonte)',
    category: 'sfx',
    recipe: {
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 400, freqEnd: 2400, q: 2 }, attack: 1.2, duration: 2.2, release: 0.8, gain: 0.14 }),
        osc('sine', 880, { freqEnd: 440, attack: 0.9, duration: 2.4, release: 1, gain: 0.06, vibrato: { rate: 4, depth: 8 } }),
        osc('triangle', 1318.5, { delay: 1.1, duration: 1.2, release: 1, gain: 0.04 }),
      ],
    },
  }),
  defineSound({
    id: 'memory:anchor',
    label: 'Éclat ancré',
    category: 'ui',
    recipe: {
      layers: [
        osc('sine', 1046.5, { duration: 0.9, release: 0.7, gain: 0.09 }),
        osc('sine', 1567.98, { delay: 0.08, duration: 0.9, release: 0.7, gain: 0.07 }),
        osc('triangle', 2093, { delay: 0.16, duration: 0.6, release: 0.5, gain: 0.03 }),
      ],
    },
  }),
  defineSound({
    id: 'memory:remove',
    label: 'Éclat retiré',
    category: 'ui',
    recipe: {
      layers: [
        osc('sine', 1567.98, { freqEnd: 784, duration: 0.6, release: 0.4, gain: 0.08 }),
        noise('white', { filter: { type: 'highpass', freq: 6000 }, duration: 0.08, gain: 0.08 }),
      ],
    },
  }),
  defineSound({
    id: 'memory:shard_touch',
    label: 'Contact d’un éclat',
    category: 'sfx',
    recipe: {
      layers: [
        noise('pink', { filter: { type: 'bandpass', freq: 900, q: 3 }, attack: 0.4, duration: 1.8, release: 0.8, gain: 0.12 }),
        osc('sine', 659.25, { attack: 0.2, duration: 1.6, release: 1, gain: 0.05, vibrato: { rate: 6, depth: 5 } }),
      ],
    },
  }),
  defineSound({
    id: 'memory:place',
    label: 'Objet déposé sur un socle',
    category: 'sfx',
    recipe: {
      variation: 0.08,
      layers: [noise('brown', { filter: { type: 'lowpass', freq: 900 }, duration: 0.1, gain: 0.5 }), osc('triangle', 740, { delay: 0.05, duration: 0.3, gain: 0.05 })],
    },
  }),
  defineSound({
    id: 'memory:puzzle_ok',
    label: 'Énigme résolue',
    category: 'ui',
    recipe: { layers: SONG.slice(0, 3).map((f, i) => osc('triangle', f, { delay: i * 0.18, duration: 0.7, release: 0.5, gain: 0.08 })) },
  }),
  defineSound({
    id: 'memory:puzzle_wrong',
    label: 'Objets désaccordés',
    category: 'ui',
    recipe: { layers: [osc('triangle', 311.13, { duration: 0.5, gain: 0.07 }), osc('triangle', 293.66, { delay: 0.18, duration: 0.6, gain: 0.07 })] },
  }),
  defineSound({
    id: 'memory:machine',
    label: 'Machine d’extraction',
    category: 'sfx',
    recipe: {
      layers: [
        osc('sawtooth', 55, { filter: { type: 'lowpass', freq: 200 }, attack: 0.6, duration: 3, release: 1, gain: 0.12 }),
        noise('white', { filter: { type: 'bandpass', freq: 3200, q: 8 }, duration: 0.03, gain: 0.12, repeat: { count: 10, interval: 0.25 } }),
      ],
    },
  }),
  defineSound({
    id: 'memory:threshold',
    label: 'Motif du seuil (écho d’une autre civilisation)',
    category: 'sfx',
    recipe: {
      layers: [
        noise('white', { filter: { type: 'bandpass', freq: 1800, q: 6 }, duration: 0.04, gain: 0.08 }),
        osc('triangle', 392, { delay: 0.1, attack: 0.02, duration: 0.8, release: 1.2, gain: 0.06 }),
        osc('triangle', 587.33, { delay: 0.45, attack: 0.02, duration: 1.2, release: 1.6, gain: 0.05, vibrato: { rate: 3, depth: 4 } }),
      ],
    },
  }),
  defineSound({
    id: 'memory:amb_market',
    label: 'Ambiance — Marché des Éclats',
    category: 'ambience',
    recipe: {
      loopSeconds: 9,
      layers: [
        noise('pink', { filter: { type: 'lowpass', freq: 700 }, attack: 1, duration: 9, release: 1, gain: 0.1 }),
        osc('sine', 1760, { delay: 2.5, duration: 1.5, release: 1.2, gain: 0.015 }),
        noise('brown', { filter: { type: 'bandpass', freq: 300, q: 1 }, delay: 5, attack: 0.5, duration: 2, gain: 0.05 }),
      ],
    },
  }),
  defineSound({
    id: 'memory:amb_white',
    label: 'Ambiance — Chambre Blanche',
    category: 'ambience',
    recipe: {
      loopSeconds: 8,
      layers: [
        osc('sine', 220, { attack: 3, duration: 8, release: 3, gain: 0.05 }),
        osc('sine', 330, { attack: 4, duration: 8, release: 3, gain: 0.03 }),
        noise('white', { filter: { type: 'highpass', freq: 7000 }, attack: 3, duration: 8, release: 3, gain: 0.01 }),
      ],
    },
  }),
];

const PAD = { wave: 'triangle', wave2: 'sine', detune2: 5, attack: 1.6, decay: 1, sustain: 0.6, release: 2.4, filter: { type: 'lowpass', freq: 900 }, gain: 0.06 } as const;
const MUSIC_BOX = { wave: 'sine', attack: 0.003, decay: 1.1, sustain: 0, release: 1.2, gain: 0.09 } as const;
const VIOLIN = { wave: 'sawtooth', attack: 0.12, decay: 0.4, sustain: 0.7, release: 0.6, filter: { type: 'lowpass', freq: 1800 }, gain: 0.05 } as const;
const BASS = { wave: 'triangle', attack: 0.02, decay: 0.6, sustain: 0.4, release: 0.8, filter: { type: 'lowpass', freq: 400 }, gain: 0.08 } as const;

export const memoryMusic = [
  defineMusic({
    id: 'memory:music.reminence',
    label: 'Réminence — Le Marché des Éclats',
    recipe: {
      bpm: 84,
      reverb: 0.5,
      loop: true,
      tracks: [
        { instrument: PAD, notes: 'D3+F3+A3:6 Bb2+D3+F3:6 C3+E3+G3:6 A2+C#3+E3:6' },
        { instrument: MUSIC_BOX, notes: 'D5:1 F5:1 E5:1 C5:1 D5:1 A4:1 -:6 F5:1 E5:1 D5:1 C5:1 A4:2 -:6' },
        { instrument: BASS, notes: 'D2:3 A2:3 Bb1:3 F2:3 C2:3 G2:3 A1:3 E2:3' },
      ],
    },
  }),
  defineMusic({
    id: 'memory:music.jardin',
    label: 'Réminence — Le Jardin des Noms',
    recipe: {
      bpm: 60,
      reverb: 0.7,
      loop: true,
      tracks: [
        { instrument: { ...PAD, gain: 0.05 }, notes: 'F3+A3+C4:8 D3+F3+A3:8 Bb2+D3+F3:8 C3+E3+G3:8' },
        { instrument: MUSIC_BOX, notes: '-:4 A4:2 C5:2 -:4 F4:2 A4:2 -:4 D5:2 C5:2 -:4 E4:2 G4:2' },
      ],
    },
  }),
  defineMusic({
    id: 'memory:music.salle',
    label: 'Réminence — La Salle de Vente',
    recipe: {
      bpm: 72,
      reverb: 0.45,
      loop: true,
      tracks: [
        { instrument: { ...PAD, wave: 'sawtooth', filter: { type: 'lowpass', freq: 600 }, gain: 0.05 }, notes: 'C3+Eb3+G3:4 C3+Eb3+Ab3:4 Bb2+D3+F3:4 G2+B2+D3:4' },
        { instrument: { ...MUSIC_BOX, gain: 0.06 }, notes: 'G4:0.5 -:0.5 G4:0.5 -:0.5 Ab4:1 G4:1 -:4 F4:0.5 -:0.5 F4:0.5 -:0.5 G4:1 D4:1 -:4' },
        { instrument: BASS, notes: 'C2:2 C2:2 Ab1:2 Ab1:2 Bb1:2 Bb1:2 G1:2 G1:2' },
      ],
    },
  }),
  defineMusic({
    id: 'memory:music.blanche',
    label: 'Réminence — La Chambre Blanche',
    recipe: {
      bpm: 46,
      reverb: 0.9,
      loop: true,
      tracks: [
        { instrument: { ...PAD, wave: 'sine', gain: 0.06 }, notes: 'D4+A4:8 F4+C5:8' },
        { instrument: { ...VIOLIN, gain: 0.04 }, notes: '-:4 D5:2 F5:2 E5:2 C5:2 D5:2 A4:4 -:6' },
      ],
    },
  }),
  defineMusic({
    id: 'memory:music.fin',
    label: 'Réminence — Un souvenir attend ailleurs',
    recipe: {
      bpm: 66,
      reverb: 0.65,
      loop: true,
      tracks: [
        { instrument: PAD, notes: 'D3+F3+A3:8 G2+Bb2+D3:8 Bb2+D3+F3:8 A2+C#3+E3:8' },
        { instrument: VIOLIN, notes: 'D5:2 F5:2 E5:2 C5:2 D5:2 A4:6 -:2 F5:2 G5:2 A5:4 F5:2 E5:6' },
        { instrument: BASS, notes: 'D2:4 D2:4 G1:4 G1:4 Bb1:4 Bb1:4 A1:4 A1:4' },
      ],
    },
  }),
];
