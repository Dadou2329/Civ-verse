/**
 * First-person player controller (simulation side).
 *
 * The view feeds input intents (move axes, jump, sprint) and look angles; this class turns them
 * into movement through the shared KinematicBody, applies civilization movement modifiers, and
 * owns movement/look locks (dialogues, cinematics, panels), abilities and cooldowns.
 */
import { KinematicBody, DEFAULT_MOVEMENT, type MovementParams, type BodyStepEvents } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import type { MovementModifier, MovementState } from './api';
import { type Disposable, toDisposable } from '../util/disposable';
import { clamp, forwardFromYawPitch, type Vec3 } from '../util/math';

export interface PlayerIntent {
  /** -1..1 (W/S). */
  forward: number;
  /** -1..1 (D/A). */
  right: number;
  /** Vertical intent for flying modes (-1..1). */
  up: number;
  sprint: boolean;
  /** Jump pressed since last update (edge). */
  jump: boolean;
}

export const PITCH_LIMIT = (89 * Math.PI) / 180;

export class PlayerController {
  readonly body: KinematicBody;
  yaw = 0;
  pitch = 0;
  readonly intent: PlayerIntent = { forward: 0, right: 0, up: 0, sprint: false, jump: false };
  private civBase: Partial<MovementParams> = {};
  private modifiers: MovementModifier[] = [];
  private moveLocks = new Map<symbol, string>();
  private lookLocks = new Map<symbol, string>();
  private effective: MovementParams = { ...DEFAULT_MOVEMENT };
  readonly abilities = new Set<string>();
  readonly cooldowns = new Map<string, number>();
  title: string | null = null;
  /** Debug fly mode (Studio playtest). */
  debugFly = false;
  private lastEvents: BodyStepEvents | null = null;
  /** Scripted movement (dodge, dash, grapple pull) that overrides input for a short time. */
  private forced: { v: Vec3; remaining: number; gravity: boolean } | null = null;

  constructor(position: Vec3 = { x: 0, y: 0, z: 0 }) {
    this.body = new KinematicBody({ ...DEFAULT_MOVEMENT }, 'player', position);
  }

  get position(): Vec3 {
    return this.body.position;
  }

  get eye(): Vec3 {
    const p = this.body.position;
    return { x: p.x, y: p.y + this.effective.eyeHeight - this.body.stepOffset, z: p.z };
  }

  get forward(): Vec3 {
    return forwardFromYawPitch(this.yaw, this.pitch);
  }

  get movementLocked(): boolean {
    return this.moveLocks.size > 0;
  }

  get lookLocked(): boolean {
    return this.lookLocks.size > 0;
  }

  lockReasons(): string[] {
    return [...this.moveLocks.values(), ...this.lookLocks.values()];
  }

  lockMovement(reason: string): Disposable {
    const key = Symbol(reason);
    this.moveLocks.set(key, reason);
    return toDisposable(() => this.moveLocks.delete(key));
  }

  lockLook(reason: string): Disposable {
    const key = Symbol(reason);
    this.lookLocks.set(key, reason);
    return toDisposable(() => this.lookLocks.delete(key));
  }

  setLook(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** Applies mouse look deltas (ignored while look is locked). */
  addLook(dYaw: number, dPitch: number): void {
    if (this.lookLocked) return;
    this.setLook(this.yaw + dYaw, this.pitch + dPitch);
  }

  addModifier(mod: MovementModifier): Disposable {
    this.modifiers.push(mod);
    this.modifiers.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return toDisposable(() => {
      const i = this.modifiers.indexOf(mod);
      if (i >= 0) this.modifiers.splice(i, 1);
    });
  }

  get modifierCount(): number {
    return this.modifiers.length;
  }

  /**
   * Moves the player at `velocity` (m/s) for `seconds`, ignoring input (dodges, dashes, grapple
   * pulls). Without gravity the move can go up; with gravity only the horizontal part is forced
   * and the vertical speed is set once.
   */
  forceMove(velocity: Vec3, seconds: number, opts: { gravity?: boolean } = {}): void {
    const gravity = opts.gravity ?? true;
    this.forced = { v: { ...velocity }, remaining: Math.max(0, seconds), gravity };
    if (gravity) this.body.velocity.y = velocity.y;
  }

  /** True while a forced move runs. */
  get forcedMoving(): boolean {
    return this.forced !== null;
  }

  cancelForcedMove(): void {
    this.forced = null;
  }

  /** Adds a velocity impulse (knockback); it fades with the usual acceleration. */
  impulse(v: Vec3): void {
    this.body.velocity.x += v.x;
    this.body.velocity.y += v.y;
    this.body.velocity.z += v.z;
    if (v.y > 0) this.body.grounded = false;
  }

  setCivBase(patch: Partial<MovementParams>): void {
    this.civBase = { ...this.civBase, ...patch };
  }

  /** Called when a civilization unloads: drops its base parameters, modifiers and abilities. */
  resetCivilizationState(): void {
    this.civBase = {};
    this.modifiers = [];
    this.moveLocks.clear();
    this.lookLocks.clear();
    this.abilities.clear();
    this.cooldowns.clear();
    this.title = null;
    this.debugFly = false;
    this.forced = null;
  }

  get params(): Readonly<MovementParams> {
    return this.effective;
  }

  get lastStep(): BodyStepEvents | null {
    return this.lastEvents;
  }

  update(world: CollisionWorld, dt: number): BodyStepEvents {
    const params: MovementParams = { ...DEFAULT_MOVEMENT, ...this.civBase };
    for (const m of this.modifiers) m.modifyParams?.(params);
    if (this.debugFly) {
      params.flying = true;
      params.noclip = true;
      params.walkSpeed = 8;
      params.sprintSpeed = 18;
    }
    this.effective = params;
    this.body.params = params;

    const locked = this.movementLocked;
    const i = this.intent;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    // Right vector in Babylon's left-handed frame: (cos yaw, 0, -sin yaw).
    let wx = locked ? 0 : i.forward * fx + i.right * Math.cos(this.yaw);
    let wz = locked ? 0 : i.forward * fz - i.right * Math.sin(this.yaw);
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }
    const state: MovementState = {
      position: this.body.position,
      velocity: this.body.velocity,
      grounded: this.body.grounded,
      wish: { x: wx, z: wz },
      sprinting: i.sprint && !locked,
    };
    let jump = i.jump && !locked;
    if (jump) {
      for (const m of this.modifiers) {
        const r = m.canJump?.(state);
        if (r === false) jump = false;
      }
      // A modifier can grant an extra (air) jump: emulate by resetting vertical speed.
      if (jump && !this.body.grounded) {
        const allowAir = this.modifiers.some((m) => m.canJump?.(state) === true);
        if (allowAir) {
          this.body.velocity.y = params.jumpSpeed;
          jump = false;
          for (const m of this.modifiers) m.onJump?.();
        }
      }
    }
    for (const m of this.modifiers) m.modifyVelocity?.(state, dt);
    let ev: BodyStepEvents;
    const f = this.forced;
    if (f) {
      // The forced velocity is reached at once (very high acceleration), input is ignored.
      f.remaining -= dt;
      const horizontal = Math.hypot(f.v.x, f.v.z);
      const speed = f.gravity ? horizontal : Math.hypot(f.v.x, f.v.y, f.v.z);
      const k = speed > 1e-6 ? 1 / speed : 0;
      this.body.params = { ...params, groundAccel: 80, airAccel: 80, flying: !f.gravity || params.flying };
      ev = this.body.step(world, { wishX: f.v.x * k, wishZ: f.v.z * k, wishY: f.gravity ? 0 : f.v.y * k, sprint: false, jump: false, speedOverride: speed }, dt);
      this.body.params = params;
      if (f.remaining <= 0) this.forced = null;
    } else {
      ev = this.body.step(world, { wishX: state.wish.x, wishZ: state.wish.z, wishY: locked ? 0 : i.up, sprint: state.sprinting, jump }, dt);
    }
    if (ev.jumped) for (const m of this.modifiers) m.onJump?.();
    if (ev.landed !== null) for (const m of this.modifiers) m.onLand?.(ev.landed);
    i.jump = false;
    for (const [id, t] of this.cooldowns) {
      const left = t - dt;
      if (left <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, left);
    }
    this.lastEvents = ev;
    return ev;
  }

  teleport(p: Vec3, yawDeg?: number): void {
    this.body.teleport(p);
    if (yawDeg !== undefined) this.yaw = (yawDeg * Math.PI) / 180;
  }
}
