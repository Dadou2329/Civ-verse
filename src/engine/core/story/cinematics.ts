/**
 * Cinematic timelines.
 *
 * A cinematic is a set of tracks evaluated over time: camera keys (interpolated, with easing and
 * look-at targets), actor keys (walk, teleport, look, animate, show/hide, bark), subtitles,
 * audio cues, screen effects and action items (game-state changes).
 *
 * Skipping is always safe: every remaining essential action item runs in order, actors jump to
 * their final positions, the last music cue is applied and `onComplete` runs — exactly the same
 * end state as watching to the end.
 */
import type { CinematicDoc, CinematicTrackDoc } from '../content/schemas';
import type { LogicInterpreter } from '../logic/interpreter';
import type { EventBus } from '../events/eventBus';
import type { Logger } from '../util/logger';
import type { Disposable } from '../util/disposable';
import type { PresentationBus } from '../sim/presentation';
import { type Vec3, fromTuple, lerp, lerpVec } from '../util/math';
import { ease, type EasingName } from '../util/easing';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
  roll: number;
}

export interface SubtitleView {
  speaker: string | null;
  text: string;
}

export interface CinematicActors {
  position(entity: string): Vec3 | null;
  moveTo(entity: string, target: Vec3, speed?: number): void;
  teleport(entity: string, p: Vec3): void;
  setYaw(entity: string, deg: number): void;
  lookAt(entity: string, target: Vec3 | null): void;
  animate(entity: string, name: string): void;
  expression(entity: string, expression: string): void;
  setVisible(entity: string, visible: boolean): void;
  say(entity: string, text: string): void;
}

export interface CinematicHost {
  getDoc(id: string): CinematicDoc | undefined;
  interpreter: LogicInterpreter;
  bus: EventBus;
  t(key: string): string;
  speakerName(id: string): string | null;
  actors: CinematicActors;
  playerEye(): Vec3;
  presentation: PresentationBus;
  lockPlayer(reason: string): Disposable;
  log: Logger;
}

interface TrackCursor {
  index: number;
}

interface Playing {
  doc: CinematicDoc;
  time: number;
  resolve: (r: { skipped: boolean }) => void;
  lock: Disposable | null;
  cursors: Map<CinematicTrackDoc, TrackCursor>;
  subtitles: { start: number; end: number; speaker: string | null; text: string }[];
  ending: boolean;
}

const DEFAULT_FOV = 70;

export class CinematicSystem {
  private playing: Playing | null = null;
  private pose: CameraPose | null = null;
  private subtitle: SubtitleView | null = null;
  private listeners = new Set<() => void>();
  /** Set when the camera must blend back to the player after the cinematic. */
  lastEnd: { id: string; blend: boolean; pose: CameraPose | null } | null = null;

  constructor(private readonly host: CinematicHost) {}

  get current(): CinematicDoc | null {
    return this.playing?.doc ?? null;
  }

  get time(): number {
    return this.playing?.time ?? 0;
  }

  cameraPose(): CameraPose | null {
    return this.playing ? this.pose : null;
  }

  subtitleView(): SubtitleView | null {
    return this.playing ? this.subtitle : null;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  play(id: string): Promise<{ skipped: boolean }> {
    const doc = this.host.getDoc(id);
    if (!doc) {
      this.host.log.error(`Cinématique introuvable : ${id}`);
      return Promise.resolve({ skipped: true });
    }
    if (this.playing) this.finish(true);
    return new Promise((resolve) => {
      const cursors = new Map<CinematicTrackDoc, TrackCursor>();
      for (const tr of doc.tracks) cursors.set(tr, { index: 0 });
      this.playing = {
        doc,
        time: 0,
        resolve,
        lock: doc.lockPlayer ? this.host.lockPlayer(`cinématique:${id}`) : null,
        cursors,
        subtitles: [],
        ending: false,
      };
      this.host.bus.emit('cinematic.started', { cinematicId: id });
      this.step(0);
      this.changed();
    });
  }

  update(dt: number): void {
    if (!this.playing || this.playing.ending) return;
    this.step(dt);
    if (this.playing && this.playing.time >= this.playing.doc.duration) this.finish(false);
  }

  skip(): void {
    const p = this.playing;
    if (!p || p.ending || !p.doc.skippable) return;
    this.finish(true);
  }

  private step(dt: number): void {
    const p = this.playing!;
    p.time = Math.min(p.doc.duration, p.time + dt);
    for (const track of p.doc.tracks) this.fireTrack(p, track, p.time, false);
    this.pose = this.evaluateCamera(p.doc, p.time);
    const active = p.subtitles.filter((s) => p.time >= s.start && p.time < s.end);
    const last = active[active.length - 1];
    const next = last ? { speaker: last.speaker, text: last.text } : null;
    if (next?.text !== this.subtitle?.text || next?.speaker !== this.subtitle?.speaker) {
      this.subtitle = next;
      this.changed();
    }
  }

  /** Fires the items of a track up to `time`. When `skipping`, presentation is reduced to end states. */
  private fireTrack(p: Playing, track: CinematicTrackDoc, time: number, skipping: boolean): void {
    const cur = p.cursors.get(track)!;
    const origin = `cinématique ${p.doc.id}`;
    switch (track.type) {
      case 'camera':
        return;
      case 'subtitle':
        while (cur.index < track.items.length && track.items[cur.index]!.t <= time) {
          const it = track.items[cur.index++]!;
          if (!skipping) {
            p.subtitles.push({
              start: it.t,
              end: it.t + it.duration,
              speaker: it.speaker ? this.host.speakerName(it.speaker) : null,
              text: this.host.t(it.text),
            });
          }
        }
        return;
      case 'actor':
        while (cur.index < track.keys.length && track.keys[cur.index]!.t <= time) {
          const k = track.keys[cur.index++]!;
          const a = this.host.actors;
          const e = track.entity;
          const resolveTarget = (ref: [number, number, number] | string): Vec3 | null =>
            typeof ref === 'string' ? (ref === 'player' ? this.host.playerEye() : a.position(ref)) : fromTuple(ref);
          if (k.teleport) a.teleport(e, fromTuple(k.teleport));
          if (k.moveTo !== undefined) {
            const target = resolveTarget(k.moveTo);
            if (target) {
              if (skipping) a.teleport(e, target);
              else a.moveTo(e, target, k.speed);
            }
          }
          if (k.yaw !== undefined) a.setYaw(e, k.yaw);
          if (k.lookAt !== undefined) a.lookAt(e, k.lookAt === null ? null : resolveTarget(k.lookAt));
          if (k.visible !== undefined) a.setVisible(e, k.visible);
          if (!skipping) {
            if (k.animation) a.animate(e, k.animation);
            if (k.expression) a.expression(e, k.expression);
            if (k.say) a.say(e, this.host.t(k.say));
          } else if (k.expression) a.expression(e, k.expression);
        }
        return;
      case 'audio':
        while (cur.index < track.items.length && track.items[cur.index]!.t <= time) {
          const it = track.items[cur.index++]!;
          if (it.music !== undefined) this.host.presentation.emit({ type: 'music', id: it.music, fade: 1.5 });
          if (it.sound && !skipping) {
            const at = it.at === undefined ? undefined : typeof it.at === 'string' ? (this.host.actors.position(it.at) ?? undefined) : fromTuple(it.at);
            this.host.presentation.emit({ type: 'sound', id: it.sound, handle: this.host.presentation.newHandle(), at, volume: it.volume });
          }
        }
        return;
      case 'fx':
        while (cur.index < track.items.length && track.items[cur.index]!.t <= time) {
          const it = track.items[cur.index++]!;
          if (skipping) continue;
          const { t: _t, fx, ...params } = it;
          this.host.presentation.emit({ type: 'fx', fx, params });
        }
        return;
      case 'actions':
        while (cur.index < track.items.length && track.items[cur.index]!.t <= time) {
          const it = track.items[cur.index++]!;
          if (skipping && it.essential === false) continue;
          void this.host.interpreter.run(it.actions, { origin, skipping });
        }
        return;
    }
  }

  private evaluateCamera(doc: CinematicDoc, time: number): CameraPose | null {
    return evaluateCameraTrack(doc, time, (lookAt) => {
      if (lookAt === 'player') return this.host.playerEye();
      const p = this.host.actors.position(lookAt);
      return p ? { x: p.x, y: p.y + 1.5, z: p.z } : null;
    });
  }

  private finish(skipped: boolean): void {
    const p = this.playing;
    if (!p || p.ending) return;
    p.ending = true;
    if (skipped) {
      for (const track of p.doc.tracks) this.fireTrack(p, track, Number.POSITIVE_INFINITY, true);
    }
    const lastPose = this.pose;
    p.lock?.dispose();
    this.playing = null;
    this.subtitle = null;
    this.pose = null;
    this.lastEnd = { id: p.doc.id, blend: p.doc.returnCamera === 'blend' && !skipped, pose: lastPose };
    void (async () => {
      await this.host.interpreter.run(p.doc.onComplete, { origin: `cinématique ${p.doc.id}/fin`, skipping: skipped });
      this.host.bus.emit('cinematic.ended', { cinematicId: p.doc.id, skipped });
      p.resolve({ skipped });
    })();
    this.changed();
  }

  /** Stops without running remaining items (scene unload). */
  abort(): void {
    const p = this.playing;
    if (!p) return;
    p.lock?.dispose();
    this.playing = null;
    this.subtitle = null;
    this.pose = null;
    p.resolve({ skipped: true });
    this.changed();
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}

/**
 * Camera pose of a cinematic at a given time (keys interpolated with their easing; `cut` keys
 * jump). Shared by the player and by Civilization Studio's timeline preview.
 */
export function evaluateCameraTrack(doc: CinematicDoc, time: number, lookAtTarget: (lookAt: string) => Vec3 | null): CameraPose | null {
  const track = doc.tracks.find((t) => t.type === 'camera');
  if (!track || track.type !== 'camera' || track.keys.length === 0) return null;
  const keys = track.keys;
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1]!.t <= time) i++;
  const k0 = keys[i]!;
  const k1 = keys[i + 1];
  const targetOf = (k: typeof k0): Vec3 => {
    if (k.lookAt) {
      const p = lookAtTarget(k.lookAt);
      if (p) return p;
    }
    if (k.target) return fromTuple(k.target);
    const pos = fromTuple(k.position);
    return { x: pos.x, y: pos.y, z: pos.z + 1 };
  };
  if (!k1 || k1.cut || time <= k0.t) {
    return { position: fromTuple(k0.position), target: targetOf(k0), fov: k0.fov ?? DEFAULT_FOV, roll: k0.roll ?? 0 };
  }
  const span = Math.max(1e-6, k1.t - k0.t);
  const a = ease((k1.ease ?? 'inOutSine') as EasingName, (time - k0.t) / span);
  return {
    position: lerpVec(fromTuple(k0.position), fromTuple(k1.position), a),
    target: lerpVec(targetOf(k0), targetOf(k1), a),
    fov: lerp(k0.fov ?? DEFAULT_FOV, k1.fov ?? k0.fov ?? DEFAULT_FOV, a),
    roll: lerp(k0.roll ?? 0, k1.roll ?? 0, a),
  };
}
