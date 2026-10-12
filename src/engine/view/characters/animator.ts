/**
 * Procedural character animation: walk/run cycles driven by real movement speed, idle styles,
 * talking, head look-at, gestures (wave, point, nod, shake, kneel, cross arms...) and eye blinks.
 * Poses are blended smoothly so state changes never pop.
 */
import type { CharacterRig } from './rig';
import type { Expression } from './skin';
import { angleDelta, clamp, damp, type Vec3 } from '../../core/util/math';

export interface AnimatorInput {
  dt: number;
  /** Horizontal speed in m/s. */
  speed: number;
  /** Current animation name (from the simulation: idle, walk, run, or a gesture). */
  animation: string;
  loop: boolean;
  /** World point to look at (head), or null. */
  lookAt: Vec3 | null;
  /** Character world position and yaw (radians). */
  position: Vec3;
  yaw: number;
  talking: boolean;
  expression: string;
  /** Combat state of a core.combatant ('chase', 'recover'…): a guard stance between gestures. */
  stance?: string | null;
}

type Pose = Record<'bodyX' | 'bodyY' | 'bodyZ' | 'headX' | 'headY' | 'armLX' | 'armLZ' | 'armRX' | 'armRZ' | 'legLX' | 'legRX', number>;

const ZERO: Pose = { bodyX: 0, bodyY: 0, bodyZ: 0, headX: 0, headY: 0, armLX: 0, armLZ: 0, armRX: 0, armRZ: 0, legLX: 0, legRX: 0 };

const GESTURES = new Set([
  'wave',
  'point',
  'nod',
  'shake',
  'kneel',
  'interact',
  'cross',
  'surprised',
  'sad',
  'bow',
  'talk',
  // Combat (core.combatant, core.health).
  'combat_idle',
  'windup',
  'attack',
  'slam',
  'cast',
  'block',
  'stagger',
  'defeat',
  'yield',
  'cheer',
]);

export class CharacterAnimator {
  private phase = 0;
  private t = Math.random() * 10;
  private pose: Pose = { ...ZERO };
  private gesture: string | null = null;
  private gestureTime = 0;
  private gestureLoop = false;
  private blinkTimer = 2 + Math.random() * 3;
  private blinking = 0;
  private lastAnimation = '';
  private bodyDrop = 0;

  constructor(private readonly rig: CharacterRig) {}

  update(input: AnimatorInput): void {
    const { dt } = input;
    this.t += dt;
    if (input.animation !== this.lastAnimation) {
      this.lastAnimation = input.animation;
      if (GESTURES.has(input.animation)) {
        this.gesture = input.animation;
        this.gestureTime = 0;
        this.gestureLoop = input.loop;
      } else if (input.animation === 'idle') {
        this.gesture = null;
      }
    }
    if (this.gesture) {
      this.gestureTime += dt;
      if (!this.gestureLoop && this.gestureTime > gestureDuration(this.gesture)) this.gesture = null;
    }
    const target: Pose = { ...ZERO };
    const style = this.rig.doc.idle;
    const walk = clamp(input.speed / 1.6, 0, 1);
    const run = clamp((input.speed - 2.4) / 1.5, 0, 1);
    const stride = 0.55 + run * 0.35;
    this.phase += (input.speed * dt) / (stride * this.rig.scale * 16 * 0.55);

    // Idle breathing and style.
    const breath = Math.sin(this.t * 1.7);
    target.armLZ = -0.05 - breath * 0.02;
    target.armRZ = 0.05 + breath * 0.02;
    target.headX = breath * 0.015;
    if (style === 'proud') target.bodyX = -0.05;
    if (style === 'tired') {
      target.bodyX = 0.12;
      target.headX += 0.15;
    }
    if (style === 'nervous') {
      target.headY = Math.sin(this.t * 2.3) * 0.25 * Math.max(0, Math.sin(this.t * 0.7));
      target.armLX = Math.sin(this.t * 3.1) * 0.05;
    }
    if (style === 'playful') target.bodyZ = Math.sin(this.t * 2.2) * 0.04;
    if (this.rig.doc.build.body === 'elder') target.bodyX += 0.1;

    // Locomotion.
    if (walk > 0.01) {
      const s = Math.sin(this.phase);
      const amp = 0.55 * walk + 0.35 * run;
      target.legLX = s * amp;
      target.legRX = -s * amp;
      target.armLX = -s * amp * 0.75;
      target.armRX = s * amp * 0.75;
      target.bodyX = target.bodyX * (1 - walk) + run * 0.12;
      target.headX *= 1 - walk;
    }

    // Talking: nods and small gestures.
    if (input.talking && walk < 0.1) {
      target.headX += Math.sin(this.t * 6.5) * 0.05 * (0.5 + 0.5 * Math.sin(this.t * 1.3));
      target.armRX = -0.35 - Math.max(0, Math.sin(this.t * 2.1)) * 0.35;
      target.armRZ = 0.15;
    }

    // Gestures.
    this.bodyDrop = 0;
    if (this.gesture) this.applyGesture(this.gesture, this.gestureTime, target);
    else if (input.stance === 'chase' || input.stance === 'recover') this.applyGesture('combat_idle', this.t, target);

    // Head look-at (relative to body yaw).
    if (input.lookAt && !(this.gesture === 'shake')) {
      const dx = input.lookAt.x - input.position.x;
      const dz = input.lookAt.z - input.position.z;
      const headY = this.rig.root.position.y + (this.rig.dims().legH + this.rig.dims().torsoH + 4) * this.rig.scale;
      const dy = input.lookAt.y - headY;
      const local = angleDelta(input.yaw, Math.atan2(dx, dz));
      target.headY = clamp(local, -1.1, 1.1);
      target.headX = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.6);
    }

    // Smooth blend toward the target pose.
    const k = damp(12, dt);
    for (const key of Object.keys(target) as (keyof Pose)[]) this.pose[key] += (target[key] - this.pose[key]) * k;

    const b = this.rig.bones;
    const p = this.pose;
    b.body.rotation.set(p.bodyX, p.bodyY, p.bodyZ);
    b.head.rotation.set(p.headX, p.headY, 0);
    b.armL.rotation.set(p.armLX, 0, p.armLZ);
    b.armR.rotation.set(p.armRX, 0, p.armRZ);
    b.legL.rotation.set(p.legLX, 0, 0);
    b.legR.rotation.set(p.legRX, 0, 0);
    const bob = Math.abs(Math.sin(this.phase)) * 0.045 * walk;
    const rest = this.rig.rest.body;
    b.body.position.set(rest[0], rest[1] + bob - this.bodyDrop, rest[2]);

    // Expressions and blinks.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinking <= 0) {
      this.blinking = 0.13;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }
    if (this.blinking > 0) this.blinking -= dt;
    const expr = (this.blinking > 0 ? 'closed' : input.expression) as Expression;
    this.rig.setExpression(isExpression(expr) ? expr : 'neutral');
  }

  private applyGesture(g: string, t: number, p: Pose): void {
    const wave = Math.sin(t * 9);
    switch (g) {
      case 'wave':
        p.armRZ = 2.5;
        p.armRX = -0.2 + wave * 0.25;
        break;
      case 'point':
        p.armRX = -1.45;
        p.armRZ = 0.1;
        break;
      case 'interact':
        p.armRX = -1.1 + Math.sin(Math.min(t, 0.6) * 5) * 0.2;
        break;
      case 'nod':
        p.headX = Math.sin(t * 10) * 0.25;
        break;
      case 'shake':
        p.headY = Math.sin(t * 11) * 0.4;
        break;
      case 'cross':
        p.armLX = -0.95;
        p.armRX = -0.95;
        p.armLZ = 0.75;
        p.armRZ = -0.75;
        break;
      case 'surprised':
        p.armLX = -0.5;
        p.armRX = -0.5;
        p.armLZ = -0.5;
        p.armRZ = 0.5;
        p.headX = -0.15;
        p.bodyX = -0.08;
        break;
      case 'sad':
        p.headX = 0.45;
        p.bodyX = 0.12;
        p.armLZ = -0.02;
        p.armRZ = 0.02;
        break;
      case 'bow':
        p.bodyX = 0.55;
        p.headX = 0.2;
        break;
      case 'kneel': {
        const legH = this.rig.dims().legH * this.rig.scale;
        this.bodyDrop = legH * 0.42;
        p.legLX = -1.45;
        p.legRX = 0.25;
        p.bodyX = 0.1;
        break;
      }
      case 'talk':
        p.armRX = -0.5 + wave * 0.15;
        p.armLX = -0.3 - wave * 0.1;
        break;
      // ---- Combat ----
      case 'combat_idle':
        // Guard stance: fists up, weight forward (the legs keep walking).
        p.armLX = -1.0 + Math.sin(this.t * 3) * 0.05;
        p.armRX = -1.2 + Math.sin(this.t * 3 + 1) * 0.05;
        p.armLZ = 0.35;
        p.armRZ = -0.3;
        p.bodyX += 0.12;
        break;
      case 'windup': {
        // Drawn back, arm high: readable from afar.
        const k = Math.min(1, t / 0.25);
        p.armRX = -2.7 * k;
        p.armRZ = 0.35 * k;
        p.armLX = -0.8 * k;
        p.bodyY = 0.55 * k;
        p.bodyX = -0.12 * k;
        p.headX = -0.1 * k;
        break;
      }
      case 'attack': {
        const k = Math.min(1, t / 0.12);
        p.armRX = -2.7 + 2.5 * k;
        p.armRZ = 0.35 - 0.5 * k;
        p.armLX = -0.4;
        p.bodyY = 0.55 - 1.0 * k;
        p.bodyX = -0.12 + 0.4 * k;
        break;
      }
      case 'slam': {
        const k = Math.min(1, t / 0.18);
        p.armLX = p.armRX = -2.9 + 2.6 * k;
        p.bodyX = -0.15 + 0.55 * k;
        this.bodyDrop = this.rig.dims().legH * this.rig.scale * 0.2 * k;
        break;
      }
      case 'cast':
        p.armLX = p.armRX = -1.5;
        p.armLZ = 0.15;
        p.armRZ = -0.15;
        p.bodyX = -0.08;
        break;
      case 'block':
        p.armLX = -1.4;
        p.armLZ = 0.6;
        p.armRX = -0.9;
        p.bodyX = 0.1;
        break;
      case 'stagger':
        p.bodyX = -0.3 + Math.sin(t * 14) * 0.08 * Math.max(0, 1 - t);
        p.bodyZ = Math.sin(t * 9) * 0.12 * Math.max(0, 1 - t);
        p.headX = -0.35;
        p.armLZ = -0.9;
        p.armRZ = 0.9;
        break;
      case 'defeat': {
        const legH = this.rig.dims().legH * this.rig.scale;
        const k = Math.min(1, t / 0.5);
        this.bodyDrop = legH * 0.45 * k;
        p.legLX = -1.45 * k;
        p.legRX = -1.2 * k;
        p.bodyX = 0.75 * k;
        p.headX = 0.4 * k;
        p.armLX = p.armRX = 0.3 * k;
        break;
      }
      case 'yield': {
        const legH = this.rig.dims().legH * this.rig.scale;
        this.bodyDrop = legH * 0.42;
        p.legLX = -1.45;
        p.legRX = 0.25;
        p.armLZ = -2.6;
        p.armRZ = 2.6;
        p.headX = 0.25;
        break;
      }
      case 'cheer':
        p.armLZ = -2.7 + wave * 0.1;
        p.armRZ = 2.7 - wave * 0.1;
        p.bodyX = -0.1;
        break;
    }
  }
}

function gestureDuration(g: string): number {
  switch (g) {
    case 'combat_idle':
    case 'windup':
    case 'block':
    case 'defeat':
    case 'yield':
      // Held until the simulation asks for another animation.
      return Infinity;
    case 'attack':
      return 0.45;
    case 'slam':
      return 0.6;
    case 'cast':
      return 0.5;
    case 'stagger':
      return 1.1;
    case 'cheer':
      return 2.5;
    case 'wave':
      return 2;
    case 'nod':
    case 'shake':
      return 1.2;
    case 'point':
    case 'interact':
      return 1.6;
    case 'surprised':
      return 1.5;
    default:
      return 3;
  }
}

const EXPRESSIONS = new Set(['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried', 'determined', 'closed']);
function isExpression(e: string): e is Expression {
  return EXPRESSIONS.has(e);
}
