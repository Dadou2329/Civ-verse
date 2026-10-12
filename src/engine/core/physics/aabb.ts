/** Axis-aligned bounding box in world units. */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export const aabb = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB => ({
  minX,
  minY,
  minZ,
  maxX,
  maxY,
  maxZ,
});

/** Box of a character standing at feet position (x, y, z). */
export function bodyBox(x: number, y: number, z: number, width: number, height: number): AABB {
  const h = width / 2;
  return { minX: x - h, minY: y, minZ: z - h, maxX: x + h, maxY: y + height, maxZ: z + h };
}

export function overlaps(a: AABB, b: AABB, eps = 0): boolean {
  return a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minY < b.maxY - eps && a.maxY > b.minY + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps;
}

export function containsPoint(a: AABB, x: number, y: number, z: number): boolean {
  return x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY && z >= a.minZ && z <= a.maxZ;
}

export function offsetBox(a: AABB, dx: number, dy: number, dz: number): AABB {
  return { minX: a.minX + dx, minY: a.minY + dy, minZ: a.minZ + dz, maxX: a.maxX + dx, maxY: a.maxY + dy, maxZ: a.maxZ + dz };
}

/** Box grown to include its displacement by (dx, dy, dz). */
export function sweptBox(a: AABB, dx: number, dy: number, dz: number): AABB {
  return {
    minX: Math.min(a.minX, a.minX + dx),
    minY: Math.min(a.minY, a.minY + dy),
    minZ: Math.min(a.minZ, a.minZ + dz),
    maxX: Math.max(a.maxX, a.maxX + dx),
    maxY: Math.max(a.maxY, a.maxY + dy),
    maxZ: Math.max(a.maxZ, a.maxZ + dz),
  };
}

/** Box from center and half extents. */
export function boxFromCenter(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): AABB {
  return { minX: cx - hx, minY: cy - hy, minZ: cz - hz, maxX: cx + hx, maxY: cy + hy, maxZ: cz + hz };
}

/**
 * Axis-aligned bounds of a box (given by local min/max around an origin) rotated by `yawDeg`
 * around Y. Exact for multiples of 90°, conservative otherwise.
 */
export function rotatedBounds(
  ox: number,
  oy: number,
  oz: number,
  local: AABB,
  yawDeg: number,
): AABB {
  const r = (yawDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const xs = [local.minX, local.maxX];
  const zs = [local.minZ, local.maxZ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const x of xs)
    for (const z of zs) {
      // Babylon left-handed rotation around Y: x' = x cos + z sin, z' = -x sin + z cos.
      const rx = x * c + z * s;
      const rz = -x * s + z * c;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minZ = Math.min(minZ, rz);
      maxZ = Math.max(maxZ, rz);
    }
  const snap = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    minX: ox + snap(minX),
    minY: oy + local.minY,
    minZ: oz + snap(minZ),
    maxX: ox + snap(maxX),
    maxY: oy + local.maxY,
    maxZ: oz + snap(maxZ),
  };
}
