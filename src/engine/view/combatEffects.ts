/**
 * Combat in the world: projectiles, shockwaves, attack telegraphs on the ground (an arc or a
 * circle that fills up until the blow), a warning spark above the attacker, impact sparks, a punch
 * of the hit entity's scale, the fall of defeated props, and a ring around exposed weak points.
 *
 * Everything is read from the simulation each frame (combat state and entity view flags); nothing
 * is created for civilizations without combat.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, type AbstractMesh, type Scene, type TransformNode } from '@babylonjs/core';
import type { GameSession } from '../core/sim/session';
import type { RuntimeEntity } from '../core/world/entity';
import { hexToRgb } from '../core/util/color';
import { DEG2RAD, damp } from '../core/util/math';

interface Telegraph {
  kind: string;
  progress: number;
  range: number;
  arc: number;
  color: string;
}

interface TelegraphView {
  back: Mesh;
  front: Mesh;
  spark: Mesh;
  material: StandardMaterial;
  frontMaterial: StandardMaterial;
  key: string;
}

interface Spark {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  max: number;
}

interface EntityFx {
  lastHit: number;
  punch: number;
  fall: number;
  ring: Mesh | null;
}

const OUTCOME_COLORS: Record<string, string> = {
  hit: '#fff1c9',
  defeated: '#ffb36b',
  guardBroken: '#ffd27a',
  blocked: '#8fc8ff',
  immune: '#b9c2cc',
  parried: '#ffffff',
};

function emissiveMaterial(scene: Scene, name: string, hex: string, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  const c = hexToRgb(hex);
  m.disableLighting = true;
  m.emissiveColor = new Color3(c.r, c.g, c.b);
  m.alpha = alpha;
  m.backFaceCulling = false;
  return m;
}

export class CombatEffects {
  private projectiles = new Map<number, { mesh: Mesh; material: StandardMaterial }>();
  private waves = new Map<number, { mesh: Mesh; material: StandardMaterial }>();
  private telegraphs = new Map<string, TelegraphView>();
  private sparks: Spark[] = [];
  private entityFx = new Map<string, EntityFx>();
  private sparkMaterials = new Map<string, StandardMaterial>();

  constructor(
    private readonly scene: Scene,
    private readonly session: GameSession,
    private readonly rootOf: (entityId: string) => TransformNode | null,
    private readonly addGlow: (m: AbstractMesh) => void,
  ) {}

  update(dt: number): void {
    const world = this.session.world;
    if (!world) return;
    this.syncProjectiles();
    this.syncWaves();
    this.updateSparks(dt);
    const seen = new Set<string>();
    for (const e of world.entities.values()) {
      const flags = e.view.flags;
      if (flags.telegraph && e.visible) {
        seen.add(e.id);
        this.showTelegraph(e, flags.telegraph as Telegraph);
      }
      if (flags.hit !== undefined || flags.defeated || flags.exposed || this.entityFx.has(e.id)) this.updateEntity(e, dt);
    }
    for (const [id, t] of [...this.telegraphs]) {
      if (seen.has(id)) continue;
      this.disposeTelegraph(t);
      this.telegraphs.delete(id);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Projectiles and waves
  // -------------------------------------------------------------------------------------------

  private syncProjectiles(): void {
    const alive = new Set<number>();
    for (const p of this.session.combat.projectiles) {
      alive.add(p.id);
      let v = this.projectiles.get(p.id);
      if (!v) {
        const material = emissiveMaterial(this.scene, `projectile_${p.id}`, p.color);
        const mesh = MeshBuilder.CreateIcoSphere(`projectile_${p.id}`, { radius: Math.max(0.08, p.radius), subdivisions: 2 }, this.scene);
        mesh.material = material;
        mesh.isPickable = false;
        this.addGlow(mesh);
        v = { mesh, material };
        this.projectiles.set(p.id, v);
      }
      const c = hexToRgb(p.color);
      v.material.emissiveColor.set(c.r, c.g, c.b);
      v.mesh.position.set(p.position.x, p.position.y, p.position.z);
      v.mesh.rotation.y += 0.2;
    }
    for (const [id, v] of [...this.projectiles]) {
      if (alive.has(id)) continue;
      // Gone: a small burst where it ended.
      this.burst(v.mesh.position.clone(), '#ffd9a8', 6, 3);
      v.mesh.dispose();
      v.material.dispose();
      this.projectiles.delete(id);
    }
  }

  private syncWaves(): void {
    const alive = new Set<number>();
    for (const w of this.session.combat.waves) {
      alive.add(w.id);
      let v = this.waves.get(w.id);
      if (!v) {
        const material = emissiveMaterial(this.scene, `onde_${w.id}`, w.color, 0.55);
        const mesh = MeshBuilder.CreateCylinder(`onde_${w.id}`, { diameter: 1, height: 1, tessellation: 48, cap: Mesh.NO_CAP }, this.scene);
        mesh.material = material;
        mesh.isPickable = false;
        this.addGlow(mesh);
        v = { mesh, material };
        this.waves.set(w.id, v);
      }
      const d = Math.max(0.1, w.radius * 2);
      v.mesh.scaling.set(d, w.height, d);
      v.mesh.position.set(w.center.x, w.center.y + w.height / 2, w.center.z);
      v.material.alpha = 0.6 * (1 - Math.min(1, w.radius / Math.max(0.1, w.maxRadius)) * 0.7);
    }
    for (const [id, v] of [...this.waves]) {
      if (alive.has(id)) continue;
      v.mesh.dispose();
      v.material.dispose();
      this.waves.delete(id);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Telegraphs
  // -------------------------------------------------------------------------------------------

  private showTelegraph(e: RuntimeEntity, t: Telegraph): void {
    const circle = t.kind === 'slam' || t.kind === 'wave';
    const arcDeg = circle ? 360 : t.kind === 'lunge' ? 26 : t.kind === 'projectile' ? 16 : Math.min(360, t.arc);
    const radius = Math.max(0.6, t.kind === 'projectile' ? Math.min(t.range, 7) : t.range);
    const key = `${t.kind}|${arcDeg}|${radius.toFixed(2)}|${t.color}`;
    let v = this.telegraphs.get(e.id);
    if (v && v.key !== key) {
      this.disposeTelegraph(v);
      v = undefined;
    }
    if (!v) {
      const material = emissiveMaterial(this.scene, `signal_${e.id}`, t.color, 0.22);
      const frontMaterial = emissiveMaterial(this.scene, `signal_${e.id}_plein`, t.color, 0.5);
      const opts = { radius: 1, tessellation: Math.max(8, Math.round(arcDeg / 6)), arc: arcDeg / 360, sideOrientation: Mesh.DOUBLESIDE };
      const back = MeshBuilder.CreateDisc(`signal_${e.id}`, opts, this.scene);
      const front = MeshBuilder.CreateDisc(`signal_${e.id}_plein`, opts, this.scene);
      const spark = MeshBuilder.CreatePolyhedron(`signal_${e.id}_alerte`, { type: 1, size: 0.11 }, this.scene);
      back.material = material;
      front.material = frontMaterial;
      spark.material = frontMaterial;
      for (const m of [back, front, spark]) m.isPickable = false;
      this.addGlow(spark);
      v = { back, front, spark, material, frontMaterial, key };
      this.telegraphs.set(e.id, v);
    }
    // Discs lie on the ground; the arc is centered on the entity's facing.
    const yaw = e.rotation[1] * DEG2RAD;
    const start = Math.PI / 2 - yaw - (arcDeg * DEG2RAD) / 2;
    const p = Math.min(1, Math.max(0, t.progress));
    for (const [m, y, s] of [
      [v.back, 0.04, radius],
      [v.front, 0.05, radius * (0.15 + 0.85 * p)],
    ] as const) {
      m.position.set(e.position.x, e.position.y + y, e.position.z);
      // Rolled in its own plane first (so the arc starts at `start`), then laid flat: an angle a
      // of the disc becomes the ground direction (cos a, sin a) in (x, z).
      m.rotation.set(Math.PI / 2, 0, start);
      m.scaling.set(s, s, 1);
    }
    const pulse = 1 + Math.sin(p * Math.PI * 6) * 0.25;
    const top = this.session.world?.markerPoint(e) ?? { x: e.position.x, y: e.position.y + 2, z: e.position.z };
    v.spark.position.set(top.x, top.y + 0.25, top.z);
    v.spark.scaling.setAll(pulse * (0.7 + p * 0.6));
    v.spark.rotation.y += 0.15;
    v.frontMaterial.alpha = 0.35 + 0.35 * p;
  }

  private disposeTelegraph(v: TelegraphView): void {
    v.back.dispose();
    v.front.dispose();
    v.spark.dispose();
    v.material.dispose();
    v.frontMaterial.dispose();
  }

  // -------------------------------------------------------------------------------------------
  // Hits, falls, exposed weak points
  // -------------------------------------------------------------------------------------------

  private updateEntity(e: RuntimeEntity, dt: number): void {
    let fx = this.entityFx.get(e.id);
    const flags = e.view.flags;
    const hit = typeof flags.hit === 'number' ? flags.hit : 0;
    if (!fx) {
      fx = { lastHit: hit, punch: 0, fall: 0, ring: null };
      this.entityFx.set(e.id, fx);
    }
    const root = this.rootOf(e.id);
    const center = this.centerOf(e);
    if (hit !== fx.lastHit) {
      fx.lastHit = hit;
      const outcome = String(flags.hitOutcome ?? 'hit');
      fx.punch = outcome === 'immune' || outcome === 'blocked' ? 0.4 : 1;
      this.burst(new Vector3(center.x, center.y, center.z), OUTCOME_COLORS[outcome] ?? '#ffffff', outcome === 'defeated' ? 14 : 8, outcome === 'defeated' ? 4.5 : 3);
    }
    if (root) {
      const s = e.scale;
      if (fx.punch > 0) {
        fx.punch = Math.max(0, fx.punch - dt * 6);
        const k = 1 + Math.sin(fx.punch * Math.PI) * 0.08;
        root.scaling.set(s[0] * k, s[1] * (2 - k), s[2] * k);
      } else root.scaling.set(s[0], s[1], s[2]);
      // Props and creatures without a character body tip over when defeated.
      const hasRig = e.components.has('core.npc');
      const target = flags.defeated && !hasRig && !e.components.has('core.boss') ? 1 : 0;
      fx.fall += (target - fx.fall) * damp(target ? 5 : 10, dt);
      if (!hasRig) root.rotation.x = e.rotation[0] * DEG2RAD + fx.fall * 1.35;
    }
    if (flags.exposed && e.visible) {
      if (!fx.ring) {
        fx.ring = MeshBuilder.CreateTorus(`point_faible_${e.id}`, { diameter: 0.9, thickness: 0.05, tessellation: 32 }, this.scene);
        fx.ring.material = this.sparkMaterial('#7ff3ff');
        fx.ring.isPickable = false;
        this.addGlow(fx.ring);
      }
      fx.ring.position.set(center.x, center.y, center.z);
      fx.ring.rotation.x += dt * 2.2;
      fx.ring.rotation.y += dt * 1.4;
    } else if (fx.ring) {
      fx.ring.dispose();
      fx.ring = null;
    }
    if (fx.punch <= 0 && fx.fall < 0.001 && !fx.ring && !flags.defeated && hit === fx.lastHit && !flags.exposed) {
      // Nothing left to animate: forget the entity until its next hit.
      if (root) root.rotation.x = e.rotation[0] * DEG2RAD;
      this.entityFx.delete(e.id);
    }
  }

  private centerOf(e: RuntimeEntity): { x: number; y: number; z: number } {
    const box = this.session.combat.entityBox(e);
    return { x: (box.minX + box.maxX) / 2, y: box.minY + (box.maxY - box.minY) * 0.6, z: (box.minZ + box.maxZ) / 2 };
  }

  private sparkMaterial(hex: string): StandardMaterial {
    let m = this.sparkMaterials.get(hex);
    if (!m) {
      m = emissiveMaterial(this.scene, `étincelle_${hex}`, hex);
      this.sparkMaterials.set(hex, m);
    }
    return m;
  }

  private burst(at: Vector3, hex: string, count: number, speed: number): void {
    const material = this.sparkMaterial(hex);
    for (let i = 0; i < count; i++) {
      const mesh = MeshBuilder.CreateBox('étincelle', { size: 0.06 }, this.scene);
      mesh.material = material;
      mesh.isPickable = false;
      mesh.position.copyFrom(at);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      const v = new Vector3(Math.cos(a) * speed * (0.4 + Math.random() * 0.6), up * speed, Math.sin(a) * speed * (0.4 + Math.random() * 0.6));
      const max = 0.25 + Math.random() * 0.2;
      this.sparks.push({ mesh, velocity: v, life: max, max });
    }
  }

  private updateSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      s.velocity.y -= 12 * dt;
      s.mesh.position.addInPlace(s.velocity.scale(dt));
      s.mesh.scaling.setAll(Math.max(0.05, s.life / s.max));
    }
  }

  dispose(): void {
    for (const v of this.projectiles.values()) {
      v.mesh.dispose();
      v.material.dispose();
    }
    for (const v of this.waves.values()) {
      v.mesh.dispose();
      v.material.dispose();
    }
    for (const t of this.telegraphs.values()) this.disposeTelegraph(t);
    for (const s of this.sparks) s.mesh.dispose();
    for (const fx of this.entityFx.values()) fx.ring?.dispose();
    for (const m of this.sparkMaterials.values()) m.dispose();
    this.projectiles.clear();
    this.waves.clear();
    this.telegraphs.clear();
    this.sparks = [];
    this.entityFx.clear();
    this.sparkMaterials.clear();
  }
}
