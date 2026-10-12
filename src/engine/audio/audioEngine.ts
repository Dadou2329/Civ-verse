/**
 * WebAudio engine for procedural sound recipes and music.
 *
 * - Sound recipes are rendered once into AudioBuffers (OfflineAudioContext) and cached.
 * - World sounds are spatialized (HRTF panner) and can follow an entity.
 * - Music recipes are sequenced live (oscillators + envelopes + generated reverb).
 * - Five mixer buses: master, music, sfx, ambience, ui (Paramètres → Audio).
 */
import type { SoundRecipe, SoundLayer, MusicRecipe, InstrumentRecipe } from '../core/audio/recipes';
import type { PresentationRequest } from '../core/sim/presentation';
import type { Vec3 } from '../core/util/math';

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  ui: number;
}

export type ResolvedAudio =
  | { kind: 'sound'; category: 'sfx' | 'ui' | 'ambience' | 'voice'; recipe: SoundRecipe }
  | { kind: 'music'; recipe: MusicRecipe }
  | null;

const SAMPLE_RATE = 44100;

interface ActiveSound {
  src: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null;
  entity: string | null;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses: Record<keyof AudioVolumes, GainNode> | null = null;
  private reverb: ConvolverNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private active = new Map<number, ActiveSound>();
  private music: MusicPlayer | null = null;
  private musicId: string | null = null;
  private ambience: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private volumes: AudioVolumes = { master: 0.8, music: 0.6, sfx: 0.9, ambience: 0.7, ui: 0.8 };
  private pending: (() => void)[] = [];

  constructor(
    private readonly resolve: (id: string) => ResolvedAudio,
    private readonly entityPosition: (id: string) => Vec3 | null,
  ) {}

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (click/key) to satisfy autoplay policies. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const mk = (parent: AudioNode) => {
        const g = this.ctx!.createGain();
        g.connect(parent);
        return g;
      };
      const master = mk(this.ctx.destination);
      this.buses = { master, music: mk(master), sfx: mk(master), ambience: mk(master), ui: mk(master) };
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = makeImpulse(this.ctx, 2.6, 2.8);
      this.reverb.connect(this.buses.music);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const queued = this.pending;
    this.pending = [];
    for (const fn of queued) fn();
  }

  setVolumes(v: Partial<AudioVolumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.buses || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(this.buses) as (keyof AudioVolumes)[]) this.buses[k].gain.setTargetAtTime(this.volumes[k], t, 0.05);
  }

  /** Handles a presentation request from the simulation. */
  handle(req: PresentationRequest): void {
    switch (req.type) {
      case 'sound':
        void this.play(req.id, { handle: req.handle, at: req.at, entity: req.entity, volume: req.volume, pitch: req.pitch, loop: req.loop });
        break;
      case 'stopSound':
        this.stop(req.handle);
        break;
      case 'music':
        this.setMusic(req.id, req.fade);
        break;
      case 'ambience':
        void this.setAmbience(req.id, req.fade);
        break;
      default:
        break;
    }
  }

  private buffer(id: string, recipe: SoundRecipe): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id);
    if (!p) {
      p = renderRecipe(recipe).catch((err) => {
        console.error(`[audio] rendu impossible pour ${id}`, err);
        return null;
      });
      this.buffers.set(id, p);
    }
    return p;
  }

  /** Pre-renders sounds (called when a civilization loads). */
  preload(ids: string[]): void {
    for (const id of ids) {
      const r = this.resolve(id);
      if (r?.kind === 'sound') void this.buffer(id, r.recipe);
    }
  }

  async play(id: string, opts: { handle?: number; at?: Vec3; entity?: string; volume?: number; pitch?: number; loop?: boolean } = {}): Promise<void> {
    if (!this.ctx || !this.buses) {
      if (opts.loop) this.pending.push(() => void this.play(id, opts));
      return;
    }
    const r = this.resolve(id);
    if (!r || r.kind !== 'sound') {
      if (id) console.warn(`[audio] son inconnu : ${id}`);
      return;
    }
    const buf = await this.buffer(id, r.recipe);
    if (!buf || !this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!opts.loop;
    const variation = r.recipe.variation ?? 0;
    src.playbackRate.value = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * variation);
    const gain = ctx.createGain();
    gain.gain.value = (opts.volume ?? 1) * (r.recipe.gain ?? 1);
    src.connect(gain);
    const spatial = (opts.at || opts.entity) && r.category !== 'ui' && r.recipe.spatial !== false;
    let panner: PannerNode | null = null;
    if (spatial) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = r.recipe.refDistance ?? 2.5;
      panner.maxDistance = 60;
      panner.rolloffFactor = 1.1;
      const p = opts.at ?? (opts.entity ? this.entityPosition(opts.entity) : null);
      if (p) setPannerPosition(panner, p);
      gain.connect(panner);
      panner.connect(this.buses[r.category === 'ambience' ? 'ambience' : 'sfx']);
    } else {
      gain.connect(this.buses[r.category === 'ui' ? 'ui' : r.category === 'ambience' ? 'ambience' : 'sfx']);
    }
    const handle = opts.handle ?? -Math.floor(Math.random() * 1e9);
    this.active.set(handle, { src, gain, panner, entity: opts.entity ?? null });
    src.onended = () => this.active.delete(handle);
    src.start();
  }

  stop(handle: number): void {
    const a = this.active.get(handle);
    if (!a || !this.ctx) return;
    a.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    a.src.stop(this.ctx.currentTime + 0.4);
    this.active.delete(handle);
  }

  setMusic(id: string | null, fade = 2): void {
    if (id === this.musicId) return;
    this.musicId = id;
    if (!this.ctx || !this.buses) {
      this.pending.push(() => {
        this.musicId = null;
        this.setMusic(id, fade);
      });
      return;
    }
    this.music?.stop(fade);
    this.music = null;
    if (!id) return;
    const r = this.resolve(id);
    if (!r || r.kind !== 'music') {
      console.warn(`[audio] musique inconnue : ${id}`);
      return;
    }
    this.music = new MusicPlayer(this.ctx, this.buses.music, this.reverb!, r.recipe, fade);
  }

  async setAmbience(id: string | null, fade = 2): Promise<void> {
    if (this.ambience?.id === id) return;
    if (!this.ctx || !this.buses) {
      this.pending.push(() => void this.setAmbience(id, fade));
      return;
    }
    const ctx = this.ctx;
    const old = this.ambience;
    this.ambience = null;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.05, fade / 3));
      old.src.stop(ctx.currentTime + fade + 0.5);
    }
    if (!id) return;
    const r = this.resolve(id);
    if (!r || r.kind !== 'sound') return;
    const buf = await this.buffer(id, r.recipe);
    if (!buf || !this.ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(r.recipe.gain ?? 1, ctx.currentTime, Math.max(0.05, fade / 3));
    src.connect(gain).connect(this.buses.ambience);
    src.start();
    this.ambience = { id, src, gain };
  }

  /** Updates the listener and entity-attached sounds. */
  update(listener: Vec3, forward: Vec3): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    if (l.positionX) {
      l.positionX.value = listener.x;
      l.positionY.value = listener.y;
      l.positionZ.value = listener.z;
      // WebAudio is right-handed; the engine is left-handed (Z forward): flip Z.
      l.forwardX.value = forward.x;
      l.forwardY.value = forward.y;
      l.forwardZ.value = -forward.z;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
    for (const a of this.active.values()) {
      if (a.panner && a.entity) {
        const p = this.entityPosition(a.entity);
        if (p) setPannerPosition(a.panner, p);
      }
    }
    this.music?.tick();
  }

  stopAll(): void {
    for (const h of [...this.active.keys()]) this.stop(h);
    this.setMusic(null, 1);
    void this.setAmbience(null, 1);
  }

  dispose(): void {
    this.stopAll();
    void this.ctx?.close();
    this.ctx = null;
    this.buses = null;
  }
}

function setPannerPosition(p: PannerNode, v: Vec3): void {
  if (p.positionX) {
    p.positionX.value = v.x;
    p.positionY.value = v.y;
    p.positionZ.value = -v.z;
  }
}

// ---------------------------------------------------------------------------------------------
// Offline rendering of recipes
// ---------------------------------------------------------------------------------------------

function layerLength(l: SoundLayer): number {
  const rep = l.repeat ? (l.repeat.count - 1) * l.repeat.interval : 0;
  return (l.delay ?? 0) + rep + l.duration;
}

export async function renderRecipe(recipe: SoundRecipe): Promise<AudioBuffer> {
  const length = recipe.loopSeconds ?? Math.max(0.05, ...recipe.layers.map(layerLength)) + 0.05;
  const ctx = new OfflineAudioContext(1, Math.ceil(length * SAMPLE_RATE), SAMPLE_RATE);
  for (const layer of recipe.layers) {
    const count = layer.repeat?.count ?? 1;
    for (let i = 0; i < count; i++) {
      const t0 = (layer.delay ?? 0) + (layer.repeat ? i * layer.repeat.interval : 0);
      const pitchMul = 1 + (layer.repeat?.pitchStep ?? 0) * i;
      const gainMul = Math.max(0, 1 + (layer.repeat?.gainStep ?? 0) * i);
      scheduleLayer(ctx, layer, t0, pitchMul, gainMul, recipe.loopSeconds !== undefined && !layer.repeat);
    }
  }
  return ctx.startRendering();
}

function scheduleLayer(ctx: BaseAudioContext, l: SoundLayer, t0: number, pitchMul: number, gainMul: number, sustained: boolean): void {
  let source: AudioScheduledSourceNode;
  if (l.source === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = makeNoise(ctx, l.duration + 0.05, l.noise ?? 'white');
    source = n;
  } else {
    const o = ctx.createOscillator();
    o.type = l.wave ?? 'sine';
    const f0 = (l.freq ?? 440) * pitchMul;
    o.frequency.setValueAtTime(f0, t0);
    if (l.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, l.freqEnd * pitchMul), t0 + l.duration);
    if (l.detune) o.detune.value = l.detune;
    if (l.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = l.vibrato.rate;
      const depth = ctx.createGain();
      depth.gain.value = l.vibrato.depth;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + l.duration);
    }
    source = o;
  }
  let node: AudioNode = source;
  if (l.filter) {
    const f = ctx.createBiquadFilter();
    f.type = l.filter.type;
    f.frequency.setValueAtTime(l.filter.freq, t0);
    if (l.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(10, l.filter.freqEnd), t0 + l.duration);
    if (l.filter.q !== undefined) f.Q.value = l.filter.q;
    node.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  const peak = l.gain * gainMul;
  const attack = Math.max(0.001, l.attack);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (sustained) {
    g.gain.setValueAtTime(peak, t0 + l.duration - 0.01);
  } else {
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.001), t0 + l.duration);
  }
  node.connect(g).connect(ctx.destination);
  source.start(t0);
  source.stop(t0 + l.duration + 0.02);
}

function makeNoise(ctx: BaseAudioContext, seconds: number, color: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = Math.ceil(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w;
    else if (color === 'pink') {
      b0 = 0.997 * b0 + w * 0.029591;
      b1 = 0.985 * b1 + w * 0.032534;
      b2 = 0.95 * b2 + w * 0.048056;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 2.5;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.ceil(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// ---------------------------------------------------------------------------------------------
// Music sequencer
// ---------------------------------------------------------------------------------------------

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function noteFrequency(note: string): number | null {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(note.trim());
  if (!m) return null;
  const semis = NOTE_INDEX[m[1]!];
  if (semis === undefined) return null;
  const midi = (Number(m[2]) + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface NoteEvent {
  beat: number;
  beats: number;
  freqs: number[];
}

/** Parses "C4:1 E4+G4:2 -:1" into timed note events. Exported for tests. */
export function parseNotes(notes: string): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  let beat = 0;
  for (const token of notes.split(/\s+/).filter(Boolean)) {
    const [pitch, dur] = token.split(':');
    const beats = Number(dur ?? 1) || 1;
    if (pitch && pitch !== '-') {
      const freqs = pitch.split('+').map(noteFrequency).filter((f): f is number => f !== null);
      if (freqs.length) events.push({ beat, beats, freqs });
    }
    beat += beats;
  }
  return { events, length: beat };
}

class MusicPlayer {
  private out: GainNode;
  private tracks: { inst: InstrumentRecipe; events: NoteEvent[]; length: number; gain: number; next: number; loop: number }[];
  private startTime: number;
  private beatSeconds: number;
  private stopped = false;

  constructor(
    private readonly ctx: AudioContext,
    bus: GainNode,
    reverb: ConvolverNode,
    private readonly recipe: MusicRecipe,
    fade: number,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(1, ctx.currentTime, Math.max(0.05, fade / 3));
    this.out.connect(bus);
    const send = ctx.createGain();
    send.gain.value = recipe.reverb ?? 0.3;
    this.out.connect(send).connect(reverb);
    this.beatSeconds = 60 / recipe.bpm;
    this.startTime = ctx.currentTime + 0.1;
    this.tracks = recipe.tracks.map((t) => {
      const p = parseNotes(t.notes);
      return { inst: t.instrument, events: p.events, length: p.length, gain: t.gain ?? 1, next: 0, loop: 0 };
    });
    this.tick();
  }

  tick(): void {
    if (this.stopped) return;
    const horizon = this.ctx.currentTime + 0.6;
    for (const tr of this.tracks) {
      if (tr.events.length === 0 || tr.length <= 0) continue;
      for (let guard = 0; guard < 64; guard++) {
        const ev = tr.events[tr.next];
        if (!ev) {
          if (this.recipe.loop === false) break;
          tr.next = 0;
          tr.loop++;
          continue;
        }
        const t = this.startTime + (tr.loop * tr.length + ev.beat) * this.beatSeconds;
        if (t > horizon) break;
        if (t >= this.ctx.currentTime - 0.05) this.playNote(tr.inst, ev, t, tr.gain);
        tr.next++;
      }
    }
  }

  private playNote(inst: InstrumentRecipe, ev: NoteEvent, t: number, trackGain: number): void {
    const ctx = this.ctx;
    const dur = ev.beats * this.beatSeconds;
    const env = ctx.createGain();
    const peak = inst.gain * trackGain / Math.sqrt(ev.freqs.length);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + inst.attack);
    env.gain.setTargetAtTime(peak * inst.sustain, t + inst.attack, Math.max(0.01, inst.decay / 3));
    const releaseStart = t + Math.max(inst.attack, dur);
    env.gain.setTargetAtTime(0, releaseStart, Math.max(0.01, inst.release / 4));
    let dest: AudioNode = env;
    if (inst.filter) {
      const f = ctx.createBiquadFilter();
      f.type = inst.filter.type;
      f.frequency.value = inst.filter.freq;
      if (inst.filter.q) f.Q.value = inst.filter.q;
      f.connect(env);
      dest = f;
    }
    env.connect(this.out);
    const octave = Math.pow(2, inst.octave ?? 0);
    const end = releaseStart + inst.release + 0.1;
    for (const freq of ev.freqs) {
      const o = ctx.createOscillator();
      o.type = inst.wave;
      o.frequency.value = freq * octave;
      o.connect(dest);
      o.start(t);
      o.stop(end);
      if (inst.wave2) {
        const o2 = ctx.createOscillator();
        o2.type = inst.wave2;
        o2.frequency.value = freq * octave;
        o2.detune.value = inst.detune2 ?? 5;
        o2.connect(dest);
        o2.start(t);
        o2.stop(end);
      }
    }
  }

  stop(fade: number): void {
    this.stopped = true;
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.05, fade / 3));
    const out = this.out;
    setTimeout(() => out.disconnect(), (fade + 2) * 1000);
  }
}
