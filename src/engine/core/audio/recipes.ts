/**
 * Procedural audio recipes (data only — synthesized by the WebAudio engine in src/engine/audio).
 *
 * The project ships no recorded audio: every sound effect, ambience and musical motif is an
 * original synthesis recipe. Recipes are plain data so packs can define them, the Studio can list
 * them, and a future update can swap any id for a recorded file without touching gameplay.
 */
export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type NoiseColor = 'white' | 'pink' | 'brown';

export interface FilterSpec {
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  freq: number;
  freqEnd?: number;
  q?: number;
}

export interface SoundLayer {
  source: 'osc' | 'noise';
  wave?: Waveform;
  noise?: NoiseColor;
  /** Oscillator frequency in Hz. */
  freq?: number;
  /** Frequency reached at the end of the layer (exponential sweep). */
  freqEnd?: number;
  /** Detune in cents. */
  detune?: number;
  filter?: FilterSpec;
  /** Start offset (s). */
  delay?: number;
  attack: number;
  /** Total duration of the layer (s), release included. */
  duration: number;
  release: number;
  gain: number;
  vibrato?: { rate: number; depth: number };
  /** Repeats the layer (rattles, clicks, footstep shuffles). */
  repeat?: { count: number; interval: number; pitchStep?: number; gainStep?: number };
}

export interface SoundRecipe {
  layers: SoundLayer[];
  gain?: number;
  /** Random pitch variation per play (0.05 = ±5 %). */
  variation?: number;
  /** Positional by default when played at a point. */
  spatial?: boolean;
  /** Reference distance for spatial attenuation (m). */
  refDistance?: number;
  /** Looped ambience: the layers are rendered then looped. */
  loopSeconds?: number;
}

export interface InstrumentRecipe {
  wave: Waveform;
  /** Second oscillator for richer tones. */
  wave2?: Waveform;
  detune2?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filter?: FilterSpec;
  gain: number;
  /** Octave shift. */
  octave?: number;
}

export interface MusicTrack {
  instrument: InstrumentRecipe;
  /**
   * Compact notation: space-separated "Note:beats" tokens ("C4:1 E4:0.5 -:1 G4:2").
   * Chords use "+" ("C3+G3:4"). "-" is a rest.
   */
  notes: string;
  gain?: number;
}

export interface MusicRecipe {
  bpm: number;
  tracks: MusicTrack[];
  loop?: boolean;
  /** Reverb amount 0..1. */
  reverb?: number;
}
