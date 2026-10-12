/** Plain 3D vector used by the headless core (render layers convert to their own types). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Compact JSON form used in content files. */
export type Vec3Tuple = [number, number, number];

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const fromTuple = (t: readonly number[]): Vec3 => ({ x: t[0] ?? 0, y: t[1] ?? 0, z: t[2] ?? 0 });
export const toTuple = (v: Vec3): Vec3Tuple => [v.x, v.y, v.z];
export const copyVec = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
export const addVec = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subVec = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scaleVec = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dotVec = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const lengthVec = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const distanceXZ = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export function normalizeVec(a: Vec3): Vec3 {
  const l = lengthVec(a);
  return l > 1e-9 ? scaleVec(a, 1 / l) : vec3();
}

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Shortest signed difference between two angles. */
export const angleDelta = (from: number, to: number): number => wrapAngle(to - from);

/** Frame-rate independent exponential smoothing factor. */
export const damp = (lambda: number, dt: number): number => 1 - Math.exp(-lambda * dt);

/**
 * Yaw/pitch → forward vector. Convention (shared with the Babylon view): left-handed Y-up,
 * yaw 0 looks toward +Z, positive pitch looks DOWN (Babylon camera.rotation.x convention).
 */
export function forwardFromYawPitch(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: -Math.sin(pitch), z: Math.cos(yaw) * cp };
}

/** Yaw that looks from `from` toward `to` (ignores height). */
export function yawTowards(from: Vec3, to: Vec3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Pitch that looks from `from` toward `to` (positive = down). */
export function pitchTowards(from: Vec3, to: Vec3): number {
  const dxz = Math.hypot(to.x - from.x, to.z - from.z);
  return -Math.atan2(to.y - from.y, dxz);
}
