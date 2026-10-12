/**
 * NPC locomotion: follows A* paths with the same kinematic body as the player, turns smoothly,
 * detects when stuck, re-paths, and reports arrival. Animation state (idle/walk/run) and facing
 * are written to the entity's view state for the renderer.
 */
import { KinematicBody, DEFAULT_MOVEMENT } from '../physics/body';
import { findPath, simplifyPath } from '../nav/pathfinder';
import type { SceneWorld } from '../world/sceneWorld';
import type { RuntimeEntity } from '../world/entity';
import { angleDelta, type Vec3, RAD2DEG, DEG2RAD } from '../util/math';

export interface MotorMoveOptions {
  speed?: number;
  run?: boolean;
  stopDistance?: number;
  timeout?: number;
}

export class NpcMotor {
  readonly body: KinematicBody;
  private path: Vec3[] | null = null;
  private index = 0;
  private goal: Vec3 | null = null;
  private resolveFn: ((arrived: boolean) => void) | null = null;
  private speed = 1.6;
  private stopDistance = 0.4;
  private elapsed = 0;
  private timeout = 30;
  private stuckTime = 0;
  private lastProgressPos: Vec3 = { x: 0, y: 0, z: 0 };
  private repaths = 0;
  /** Facing target yaw in radians (null = keep). */
  facing: number | null = null;
  walkSpeed = 1.6;
  runSpeed = 3.4;

  constructor(
    private readonly entity: RuntimeEntity,
    private readonly world: SceneWorld,
    height = 1.8,
  ) {
    this.body = new KinematicBody(
      { ...DEFAULT_MOVEMENT, height, eyeHeight: height * 0.9, walkSpeed: this.walkSpeed, sprintSpeed: this.runSpeed, groundAccel: 10, stepHeight: 0.6 },
      entity.id,
      { ...entity.position },
    );
  }

  get moving(): boolean {
    return this.goal !== null;
  }

  moveTo(target: Vec3, opts: MotorMoveOptions = {}): Promise<boolean> {
    this.cancel(false);
    this.speed = opts.speed ?? (opts.run ? this.runSpeed : this.walkSpeed);
    this.stopDistance = opts.stopDistance ?? 0.4;
    this.timeout = opts.timeout ?? 30;
    this.elapsed = 0;
    this.repaths = 0;
    this.goal = { ...target };
    this.plan();
    return new Promise((resolve) => {
      this.resolveFn = resolve;
    });
  }

  /** Stops moving; pending moveTo promises resolve false. */
  cancel(arrived = false): void {
    const r = this.resolveFn;
    this.resolveFn = null;
    this.goal = null;
    this.path = null;
    this.entity.view.speed = 0;
    r?.(arrived);
  }

  /** Places the body exactly at the entity position (after teleports). */
  syncFromEntity(): void {
    this.body.teleport({ ...this.entity.position });
  }

  private plan(): void {
    if (!this.goal) return;
    const raw = findPath(this.world.collision, this.body.position, this.goal, {
      width: Math.min(0.6, this.body.params.width),
      height: this.body.params.height,
      goalRadius: Math.max(0.6, this.stopDistance + 0.3),
      ignoreOwner: this.entity.id,
      maxNodes: 12000,
    });
    this.path = raw ? simplifyPath(raw) : null;
    this.index = this.path && this.path.length > 1 ? 1 : 0;
    this.lastProgressPos = { ...this.body.position };
    this.stuckTime = 0;
  }

  update(dt: number): void {
    const e = this.entity;
    let wishX = 0;
    let wishZ = 0;
    if (this.goal) {
      this.elapsed += dt;
      const toGoal = Math.hypot(this.goal.x - this.body.position.x, this.goal.z - this.body.position.z);
      if (toGoal <= this.stopDistance && Math.abs(this.goal.y - this.body.position.y) < 1.6) {
        this.cancel(true);
      } else if (this.elapsed > this.timeout) {
        this.cancel(false);
      } else {
        // Without a path, walk straight toward the goal (open areas, small offsets).
        const wp = this.path && this.index < this.path.length ? this.path[this.index]! : this.goal;
        const dx = wp.x - this.body.position.x;
        const dz = wp.z - this.body.position.z;
        const d = Math.hypot(dx, dz);
        if (this.path && d < 0.3 && this.index < this.path.length - 1) this.index++;
        if (d > 1e-3) {
          wishX = dx / d;
          wishZ = dz / d;
          this.facing = Math.atan2(dx, dz);
        }
        const moved = Math.hypot(this.body.position.x - this.lastProgressPos.x, this.body.position.z - this.lastProgressPos.z);
        if (moved > 0.25) {
          this.lastProgressPos = { ...this.body.position };
          this.stuckTime = 0;
        } else {
          this.stuckTime += dt;
          if (this.stuckTime > 1.2) {
            if (++this.repaths > 3) this.cancel(false);
            else this.plan();
          }
        }
      }
    }
    this.body.step(this.world.collision, { wishX, wishZ, sprint: false, jump: false, speedOverride: this.speed }, dt);
    const p = this.body.position;
    const movedNow = Math.hypot(p.x - e.position.x, p.z - e.position.z);
    e.view.speed = dt > 0 ? movedNow / dt : 0;
    if (movedNow > 1e-5 || p.y !== e.position.y) {
      e.position = { x: p.x, y: p.y, z: p.z };
      e.revision++;
      this.world.syncColliders(e);
    }
    if (this.facing !== null) {
      const current = e.rotation[1] * DEG2RAD;
      const delta = angleDelta(current, this.facing);
      const step = Math.sign(delta) * Math.min(Math.abs(delta), dt * 7);
      if (Math.abs(delta) > 1e-3) {
        e.rotation[1] = (current + step) * RAD2DEG;
        e.revision++;
        this.world.syncColliders(e);
      } else this.facing = null;
    }
    e.view.animation = e.view.speed > 2.5 ? 'run' : e.view.speed > 0.2 ? 'walk' : e.view.animation === 'walk' || e.view.animation === 'run' ? 'idle' : e.view.animation;
  }
}
