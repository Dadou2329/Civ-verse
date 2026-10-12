/**
 * Kinematic character body: the movement model shared by the player and NPCs.
 *
 * Features: smooth exponential acceleration/deceleration, gravity, coyote time, jump buffering,
 * automatic step-up (slabs, stair steps up to `stepHeight`), ground snapping when walking down,
 * ceiling bumps, and a decaying `stepOffset` the camera uses to hide step pops.
 * Civilization mechanics extend movement through modifiers in the player controller
 * (see sim/player.ts), not by editing this class.
 */
import type { AABB } from './aabb';
import { bodyBox, offsetBox } from './aabb';
import type { CollisionWorld } from './collision';
import type { Vec3 } from '../util/math';

export interface MovementParams {
  width: number;
  height: number;
  eyeHeight: number;
  walkSpeed: number;
  sprintSpeed: number;
  /** Exponential approach rate toward the target velocity on the ground (1/s). */
  groundAccel: number;
  /** Same in the air (lower = less air control). */
  airAccel: number;
  gravity: number;
  maxFallSpeed: number;
  jumpSpeed: number;
  stepHeight: number;
  coyoteTime: number;
  jumpBuffer: number;
  canJump: boolean;
  /** No gravity, vertical control through wishY (used by abilities and debug fly). */
  flying: boolean;
  /** Ignores collisions entirely (debug only). */
  noclip: boolean;
}

export const DEFAULT_MOVEMENT: MovementParams = {
  width: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 4.4,
  sprintSpeed: 6.8,
  groundAccel: 13,
  airAccel: 2.6,
  gravity: 27,
  maxFallSpeed: 48,
  jumpSpeed: 8.6,
  stepHeight: 0.6,
  coyoteTime: 0.11,
  jumpBuffer: 0.13,
  canJump: true,
  flying: false,
  noclip: false,
};

export interface MoveInput {
  /** Desired horizontal direction in world space (length ≤ 1). */
  wishX: number;
  wishZ: number;
  /** Vertical wish for flying (-1..1). */
  wishY?: number;
  sprint: boolean;
  /** Jump pressed this frame (edge). */
  jump: boolean;
  /** Overrides the speed (m/s) computed from walk/sprint. */
  speedOverride?: number;
}

export interface BodyStepEvents {
  jumped: boolean;
  /** Vertical speed at landing (m/s, positive) or null if no landing happened. */
  landed: number | null;
  stepped: boolean;
  blocked: boolean;
}

const MAX_SUBSTEP = 1 / 120;

export class KinematicBody {
  readonly position: Vec3;
  readonly velocity: Vec3 = { x: 0, y: 0, z: 0 };
  grounded = false;
  /** Positive after stepping up, negative after snapping down; decays to 0 (camera smoothing). */
  stepOffset = 0;
  private coyote = 0;
  private jumpBufferTimer = 0;
  private fallSpeed = 0;

  constructor(
    public params: MovementParams,
    /** Entity id used to ignore the body's own colliders. */
    readonly owner: string,
    position: Vec3,
  ) {
    this.position = { ...position };
  }

  box(): AABB {
    return bodyBox(this.position.x, this.position.y, this.position.z, this.params.width, this.params.height);
  }

  teleport(p: Vec3): void {
    this.position.x = p.x;
    this.position.y = p.y;
    this.position.z = p.z;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.stepOffset = 0;
    this.grounded = false;
  }

  step(world: CollisionWorld, input: MoveInput, dt: number): BodyStepEvents {
    const ev: BodyStepEvents = { jumped: false, landed: null, stepped: false, blocked: false };
    if (dt <= 0) return ev;
    if (input.jump) this.jumpBufferTimer = this.params.jumpBuffer;
    let remaining = Math.min(dt, 0.1);
    while (remaining > 1e-6) {
      const h = Math.min(MAX_SUBSTEP, remaining);
      remaining -= h;
      this.substep(world, input, h, ev);
    }
    this.stepOffset *= Math.exp(-14 * dt);
    if (Math.abs(this.stepOffset) < 1e-3) this.stepOffset = 0;
    return ev;
  }

  private substep(world: CollisionWorld, input: MoveInput, h: number, ev: BodyStepEvents): void {
    const p = this.params;
    const v = this.velocity;
    const wasGrounded = this.grounded;
    this.coyote = wasGrounded ? p.coyoteTime : Math.max(0, this.coyote - h);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - h);

    const speed = input.speedOverride ?? (input.sprint ? p.sprintSpeed : p.walkSpeed);
    const wl = Math.hypot(input.wishX, input.wishZ);
    const wx = wl > 1 ? input.wishX / wl : input.wishX;
    const wz = wl > 1 ? input.wishZ / wl : input.wishZ;
    const rate = wasGrounded || p.flying ? p.groundAccel : p.airAccel;
    const k = 1 - Math.exp(-rate * h);
    v.x += (wx * speed - v.x) * k;
    v.z += (wz * speed - v.z) * k;

    if (p.flying) {
      v.y += ((input.wishY ?? 0) * speed - v.y) * k;
    } else {
      if (p.canJump && this.jumpBufferTimer > 0 && this.coyote > 0) {
        v.y = p.jumpSpeed;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBufferTimer = 0;
        ev.jumped = true;
      }
      v.y = Math.max(v.y - p.gravity * h, -p.maxFallSpeed);
    }

    if (p.noclip) {
      this.position.x += v.x * h;
      this.position.y += v.y * h;
      this.position.z += v.z * h;
      this.grounded = false;
      return;
    }

    const start = this.box();
    const mdx = v.x * h;
    const mdy = v.y * h;
    const mdz = v.z * h;
    const res = world.move(start, mdx, mdy, mdz, this.owner);
    let fx = res.dx;
    let fy = res.dy;
    let fz = res.dz;
    let grounded = false;

    if (res.hitY) {
      if (mdy < 0) {
        grounded = true;
        if (!wasGrounded) ev.landed = Math.max(this.fallSpeed, -v.y);
      }
      v.y = 0;
    }

    // Step-up: blocked horizontally while on the ground → try climbing a small ledge.
    if ((res.hitX || res.hitZ) && (wasGrounded || grounded) && p.stepHeight > 0 && !ev.jumped) {
      const up = world.move(start, 0, p.stepHeight, 0, this.owner);
      const raised = offsetBox(start, 0, up.dy, 0);
      const fwd = world.move(raised, mdx, 0, mdz, this.owner);
      const moved = offsetBox(raised, fwd.dx, 0, fwd.dz);
      const down = world.move(moved, 0, -up.dy - 0.02, 0, this.owner);
      const stepH = Math.hypot(fwd.dx, fwd.dz);
      const flatH = Math.hypot(res.dx, res.dz);
      const rise = up.dy + down.dy;
      if (down.hitY && stepH > flatH + 1e-5 && rise > 1e-3) {
        fx = fwd.dx;
        fz = fwd.dz;
        fy = rise;
        grounded = true;
        v.y = 0;
        this.stepOffset += rise;
        ev.stepped = true;
      }
    }

    this.position.x += fx;
    this.position.y += fy;
    this.position.z += fz;

    if (Math.abs(fx - mdx) > 1e-6 && !ev.stepped) {
      v.x = 0;
      ev.blocked = true;
    }
    if (Math.abs(fz - mdz) > 1e-6 && !ev.stepped) {
      v.z = 0;
      ev.blocked = true;
    }

    // Ground snapping when walking off a small ledge (stairs going down).
    if (!grounded && wasGrounded && v.y <= 0 && !ev.jumped && !p.flying) {
      const probe = world.move(this.box(), 0, -p.stepHeight, 0, this.owner);
      if (probe.hitY && probe.dy < 0) {
        this.position.y += probe.dy;
        this.stepOffset += probe.dy;
        grounded = true;
        v.y = 0;
      }
    }

    this.grounded = grounded;
    this.fallSpeed = grounded ? 0 : Math.max(this.fallSpeed, -v.y);
  }
}
