/**
 * Voxel A* pathfinding over standable positions.
 *
 * A node is a cell column (x, z) at a feet height (integer or half for slabs). Clearance is tested
 * with the same CollisionWorld as character physics, so entity colliders (closed doors, props,
 * invisible walls) are respected exactly like when walking. Used by NPC movement, scripted
 * "go to" actions, and headless level-reachability tests.
 */
import type { CollisionWorld } from '../physics/collision';
import type { Vec3 } from '../util/math';
import { bodyBox } from '../physics/aabb';

export interface PathOptions {
  /** Body width used for clearance (default 0.6). */
  width?: number;
  height?: number;
  /** Max rise without jumping (default 0.6 — slabs and stair half-steps). */
  stepHeight?: number;
  /** Max rise with a jump (default 0 = no jumping; the player can use 1.2). */
  jumpHeight?: number;
  maxDrop?: number;
  /** Stop when within this horizontal distance of the target (default 0.75). */
  goalRadius?: number;
  maxNodes?: number;
  /** Entity whose colliders are ignored (the walker itself). */
  ignoreOwner?: string;
  allowDiagonal?: boolean;
}

interface Node {
  x: number;
  z: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
  key: string;
}

class MinHeap {
  private items: Node[] = [];
  get size(): number {
    return this.items.length;
  }
  push(n: Node): void {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/** Finds where a character can stand in column (x, z) near height `nearY`. */
export function standHeight(
  world: CollisionWorld,
  x: number,
  z: number,
  nearY: number,
  maxUp: number,
  maxDown: number,
  width: number,
  height: number,
  ignoreOwner?: string,
): number | null {
  const cx = x + 0.5;
  const cz = z + 0.5;
  // Candidate heights in half-block increments, closest first.
  const candidates: number[] = [];
  const start = Math.round(nearY * 2) / 2;
  for (let d = 0; d <= Math.max(maxUp, maxDown) * 2; d++) {
    const up = start + d / 2;
    const down = start - d / 2;
    if (d === 0) candidates.push(start);
    else {
      if (up - nearY <= maxUp + 1e-6) candidates.push(up);
      if (nearY - down <= maxDown + 1e-6) candidates.push(down);
    }
  }
  for (const y of candidates) {
    const box = bodyBox(cx, y + 0.01, cz, width, height - 0.02);
    if (world.isBlocked(box, ignoreOwner)) continue;
    // Needs support right below the feet.
    const support = bodyBox(cx, y - 0.05, cz, width, 0.04);
    if (world.isBlocked(support, ignoreOwner)) return y;
  }
  return null;
}

export function findPath(world: CollisionWorld, from: Vec3, to: Vec3, opts: PathOptions = {}): Vec3[] | null {
  const width = opts.width ?? 0.6;
  const height = opts.height ?? 1.8;
  const stepH = opts.stepHeight ?? 0.6;
  const jumpH = opts.jumpHeight ?? 0;
  const maxDrop = opts.maxDrop ?? 3;
  const goalR = opts.goalRadius ?? 0.75;
  const maxNodes = opts.maxNodes ?? 30000;
  const diag = opts.allowDiagonal ?? true;
  const maxUp = Math.max(stepH, jumpH);

  const sx = Math.floor(from.x);
  const sz = Math.floor(from.z);
  const sy = standHeight(world, sx, sz, from.y, 0.6, 2, width, height, opts.ignoreOwner);
  if (sy === null) return null;
  const key = (x: number, z: number, y: number) => `${x},${z},${Math.round(y * 2)}`;
  const h = (x: number, z: number, y: number) => Math.hypot(x + 0.5 - to.x, z + 0.5 - to.z) + Math.abs(y - to.y) * 0.5;
  const open = new MinHeap();
  const best = new Map<string, number>();
  const startNode: Node = { x: sx, z: sz, y: sy, g: 0, f: h(sx, sz, sy), parent: null, key: key(sx, sz, sy) };
  open.push(startNode);
  best.set(startNode.key, 0);
  const closed = new Set<string>();
  let explored = 0;
  const dirs: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
  ];
  if (diag) dirs.push([1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]);

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed.has(cur.key)) continue;
    closed.add(cur.key);
    if (Math.hypot(cur.x + 0.5 - to.x, cur.z + 0.5 - to.z) <= goalR && Math.abs(cur.y - to.y) <= 1.6) {
      const path: Vec3[] = [];
      for (let n: Node | null = cur; n; n = n.parent) path.push({ x: n.x + 0.5, y: n.y, z: n.z + 0.5 });
      path.reverse();
      return path;
    }
    if (++explored > maxNodes) return null;
    for (const [dx, dz, cost] of dirs) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      const ny = standHeight(world, nx, nz, cur.y, maxUp, maxDrop, width, height, opts.ignoreOwner);
      if (ny === null) continue;
      const rise = ny - cur.y;
      if (rise > maxUp + 1e-6) continue;
      // Diagonals must not cut corners.
      if (dx !== 0 && dz !== 0) {
        const a = standHeight(world, cur.x + dx, cur.z, cur.y, maxUp, maxDrop, width, height, opts.ignoreOwner);
        const b = standHeight(world, cur.x, cur.z + dz, cur.y, maxUp, maxDrop, width, height, opts.ignoreOwner);
        if (a === null || b === null || Math.abs(a - cur.y) > stepH || Math.abs(b - cur.y) > stepH) continue;
      }
      // The body sweeps between the two cell centers at the higher of both heights: thin
      // colliders on the cell boundary (doors, bars) must block that transition.
      const topY = Math.max(cur.y, ny);
      const sweep = {
        minX: Math.min(cur.x, nx) + 0.5 - width / 2,
        maxX: Math.max(cur.x, nx) + 0.5 + width / 2,
        minY: topY + 0.01,
        maxY: topY + height - 0.02,
        minZ: Math.min(cur.z, nz) + 0.5 - width / 2,
        maxZ: Math.max(cur.z, nz) + 0.5 + width / 2,
      };
      if (world.isBlocked(sweep, opts.ignoreOwner)) continue;
      const k = key(nx, nz, ny);
      if (closed.has(k)) continue;
      const extra = rise > stepH + 1e-6 ? 2.5 : rise > 0 ? 0.3 : rise < -1 ? 0.5 : 0;
      const g = cur.g + cost + extra;
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      open.push({ x: nx, z: nz, y: ny, g, f: g + h(nx, nz, ny), parent: cur, key: k });
    }
  }
  return null;
}

/** Removes intermediate waypoints on straight lines (cheap smoothing). */
export function simplifyPath(path: Vec3[]): Vec3[] {
  if (path.length <= 2) return path;
  const out: Vec3[] = [path[0]!];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = path[i]!;
    const c = path[i + 1]!;
    const sameDir = Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.z - a.z) === Math.sign(c.z - b.z);
    const flat = b.y === a.y && c.y === b.y;
    const collinear = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < 1e-6;
    if (!(sameDir && flat && collinear)) out.push(b);
  }
  out.push(path[path.length - 1]!);
  return out;
}
