/**
 * First-person camera: follows the simulated player eye, adds head bob, sprint FOV, screen shake,
 * frames the speaker during dialogues, follows cinematic camera poses and blends back afterwards.
 */
import { UniversalCamera, Vector3, type Scene } from '@babylonjs/core';
import type { GameSession } from '../core/sim/session';
import type { CameraPose } from '../core/story/cinematics';
import { DEG2RAD, angleDelta, damp, lerp, pitchTowards, yawTowards } from '../core/util/math';

export class CameraRig {
  readonly camera: UniversalCamera;
  baseFovDeg = 72;
  headBob = true;
  private bobPhase = 0;
  private bobAmount = 0;
  private fovOffset = 0;
  private fovFx = 0;
  private fovFxDecay = 0;
  private shakeIntensity = 0;
  private shakeTime = 0;
  private blendFrom: CameraPose | null = null;
  private blendT = 1;
  private lastCinematicEnd: unknown = null;

  constructor(scene: Scene) {
    this.camera = new UniversalCamera('caméra', new Vector3(0, 2, 0), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.05;
    this.camera.maxZ = 1200;
    this.camera.rotationQuaternion = null as never;
    this.camera.fov = this.baseFovDeg * DEG2RAD;
  }

  shake(intensity: number, seconds: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, seconds);
  }

  fovKick(delta: number, seconds: number): void {
    this.fovFx = delta;
    this.fovFxDecay = seconds > 0 ? Math.abs(delta) / seconds : 0;
  }

  update(session: GameSession, dt: number): void {
    const cam = this.camera;
    const pose = session.cinematics.cameraPose();
    if (pose) {
      cam.position.set(pose.position.x, pose.position.y, pose.position.z);
      cam.setTarget(new Vector3(pose.target.x, pose.target.y, pose.target.z));
      cam.rotation.z = pose.roll * DEG2RAD;
      cam.fov = pose.fov * DEG2RAD;
      this.blendT = 1;
      return;
    }
    // Start a blend when a cinematic just ended.
    const end = session.cinematics.lastEnd;
    if (end && end !== this.lastCinematicEnd) {
      this.lastCinematicEnd = end;
      if (end.blend && end.pose) {
        this.blendFrom = end.pose;
        this.blendT = 0;
      }
    }

    const player = session.player;
    // Dialogue framing: turn toward the speaker.
    const dv = session.dialogue.view();
    if (dv?.entityId && session.world) {
      const e = session.world.entities.get(dv.entityId);
      if (e) {
        const eye = player.eye;
        const head = { x: e.position.x, y: e.position.y + 1.55, z: e.position.z };
        const ty = yawTowards(eye, head);
        const tp = pitchTowards(eye, head);
        const k = damp(4, dt);
        player.setLook(player.yaw + angleDelta(player.yaw, ty) * k, player.pitch + (tp - player.pitch) * k);
      }
    }

    const body = player.body;
    const speed = Math.hypot(body.velocity.x, body.velocity.z);
    const moving = body.grounded && speed > 0.5;
    this.bobAmount += ((moving && this.headBob ? Math.min(1, speed / 5) : 0) - this.bobAmount) * damp(8, dt);
    this.bobPhase += speed * dt * 1.9;
    const bobY = Math.sin(this.bobPhase * 2) * 0.035 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.02 * this.bobAmount;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeIntensity * Math.min(1, this.shakeTime * 2);
      shakeX = (Math.random() - 0.5) * s * 0.06;
      shakeY = (Math.random() - 0.5) * s * 0.06;
    } else this.shakeIntensity = 0;

    const eye = player.eye;
    const right = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
    let px = eye.x + right.x * bobX;
    let py = eye.y + bobY;
    let pz = eye.z + right.z * bobX;
    let yaw = player.yaw + shakeX;
    let pitch = player.pitch + shakeY;

    const sprinting = player.intent.sprint && speed > player.params.walkSpeed + 0.3;
    this.fovOffset += ((sprinting ? 5 : 0) - this.fovOffset) * damp(6, dt);
    if (this.fovFx !== 0) {
      const sign = Math.sign(this.fovFx);
      this.fovFx -= sign * this.fovFxDecay * dt;
      if (Math.sign(this.fovFx) !== sign) this.fovFx = 0;
    }
    let fov = this.baseFovDeg + this.fovOffset + this.fovFx;

    if (this.blendFrom && this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / 0.8);
      const t = this.blendT * this.blendT * (3 - 2 * this.blendT);
      const from = this.blendFrom;
      const fy = yawTowards(from.position, from.target);
      const fp = pitchTowards(from.position, from.target);
      px = lerp(from.position.x, px, t);
      py = lerp(from.position.y, py, t);
      pz = lerp(from.position.z, pz, t);
      yaw = fy + angleDelta(fy, yaw) * t;
      pitch = lerp(fp, pitch, t);
      fov = lerp(from.fov, fov, t);
      if (this.blendT >= 1) this.blendFrom = null;
    }
    cam.position.set(px, py, pz);
    cam.rotation.set(pitch, yaw, 0);
    cam.fov = fov * DEG2RAD;
  }
}
