/**
 * First-person view of the item in hand: its model placed at the bottom right of the screen,
 * drawn over the world (separate rendering group, so it never sinks into walls), lit like the
 * place the player stands in, swaying with steps and mouse look, and animated by the hand state
 * of the equipment system (drawing, strikes, guard, charge, tool work, recoil).
 *
 * Items without a model get a simple tool shape in the colors of their icon.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, VertexData, type Camera, type Scene } from '@babylonjs/core';
import type { GameSession } from '../core/sim/session';
import type { HandAnimation } from '../core/packs/definitions';
import { DEG2RAD, angleDelta, damp } from '../core/util/math';
import { hexToRgb } from '../core/util/color';

const DEFAULT_OFFSET: [number, number, number] = [0.26, -0.24, 0.5];
/** Held tilted forward and inward, like a tool in a relaxed hand (radians). */
const DEFAULT_TILT: [number, number, number] = [0.35, -0.25, -0.12];
const RENDER_GROUP = 1;

interface Pose {
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
}

const ZERO: Pose = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };

/** Offsets of the poses kept while a button is held. */
const HELD_POSES: Partial<Record<HandAnimation, Pose>> = {
  raise: { px: -0.2, py: 0.07, pz: 0.02, rx: -0.15, ry: 0.55, rz: 0.15 },
  charge: { px: 0.06, py: 0.07, pz: -0.14, rx: -0.55, ry: -0.1, rz: 0.35 },
  use: { px: -0.1, py: 0.03, pz: 0.12, rx: 0.25, ry: 0.25, rz: 0 },
  cast: { px: -0.12, py: 0.06, pz: 0.16, rx: -0.3, ry: 0.2, rz: 0 },
  inspect: { px: -0.16, py: 0.05, pz: 0.02, rx: 0.2, ry: 0.9, rz: 0.2 },
};

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Offsets of a one-shot animation at normalized time p (0 → 1). */
function oneShot(animation: HandAnimation | 'draw', p: number): Pose {
  const bump = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
  switch (animation) {
    case 'draw': {
      const k = 1 - easeOut(p);
      return { px: 0.04 * k, py: -0.45 * k, pz: 0, rx: 0.9 * k, ry: 0, rz: 0.2 * k };
    }
    case 'swing':
    case 'swingHeavy': {
      const a = animation === 'swingHeavy' ? 1.35 : 1;
      // Back (wind), then across (strike), then home.
      const s = p < 0.2 ? -p / 0.2 : p < 0.55 ? -1 + (2 * (p - 0.2)) / 0.35 : 1 - (p - 0.55) / 0.45;
      return { px: -0.2 * s * a, py: (0.05 - 0.07 * Math.abs(s)) * a, pz: 0.08 * bump, rx: (animation === 'swingHeavy' ? -0.7 : -0.25) * s, ry: 0.65 * s * a, rz: 0.55 * s * a };
    }
    case 'thrust':
      return { px: -0.08 * bump, py: 0.03 * bump, pz: 0.3 * bump, rx: -0.25 * bump, ry: 0.15 * bump, rz: 0 };
    case 'recoil':
      return { px: 0.03 * bump, py: 0.02 * bump, pz: -0.1 * bump, rx: 0.3 * bump, ry: 0, rz: -0.1 * bump };
    case 'use':
      return { px: -0.04 * bump, py: -0.04 * bump, pz: 0.08 * bump, rx: 0.35 * bump, ry: 0.1 * bump, rz: 0 };
    case 'cast':
      return { px: -0.1 * bump, py: 0.1 * bump, pz: 0.2 * bump, rx: -0.45 * bump, ry: 0.15 * bump, rz: 0 };
    case 'inspect':
      return { px: -0.15 * bump, py: 0.05 * bump, pz: 0, rx: 0.15 * bump, ry: 0.9 * bump, rz: 0.2 * bump };
    case 'raise':
    case 'charge':
      return { ...(HELD_POSES[animation] ?? ZERO), px: (HELD_POSES[animation]?.px ?? 0) * bump, py: (HELD_POSES[animation]?.py ?? 0) * bump };
    default:
      return ZERO;
  }
}

export class HeldItemView {
  private readonly root: TransformNode;
  private readonly holder: TransformNode;
  private meshes: Mesh[] = [];
  private readonly opaque: StandardMaterial;
  private readonly emissive: StandardMaterial;
  private itemId: string | null | undefined = undefined;
  private bobPhase = 0;
  private bobAmount = 0;
  private swayX = 0;
  private swayY = 0;
  private lastYaw = 0;
  private lastPitch = 0;
  private poseWeight = 0;
  private poseKind: HandAnimation | null = null;
  private show = 0;
  private time = 0;

  constructor(
    private readonly scene: Scene,
    camera: Camera,
    private readonly session: GameSession,
    private readonly lightAt: (p: { x: number; y: number; z: number }) => [number, number, number, number],
  ) {
    this.root = new TransformNode('main_vue', scene);
    this.root.parent = camera;
    this.holder = new TransformNode('main_objet', scene);
    this.holder.parent = this.root;
    this.opaque = new StandardMaterial('main_opaque', scene);
    this.opaque.specularColor = new Color3(0.05, 0.05, 0.05);
    this.emissive = new StandardMaterial('main_émissif', scene);
    this.emissive.disableLighting = true;
    this.emissive.emissiveColor = new Color3(1, 1, 1);
  }

  private clear(): void {
    for (const m of this.meshes) m.dispose();
    this.meshes = [];
    for (const child of this.holder.getChildren()) child.dispose();
  }

  private rebuild(itemId: string | null): void {
    this.clear();
    this.itemId = itemId;
    if (!itemId) return;
    const def = this.session.items.get(itemId);
    if (!def?.held) return;
    const spec = def.held;
    const modelId = spec.model;
    if (modelId && this.session.models.has(modelId)) {
      const built = this.session.models.build(modelId);
      for (const part of built.parts) {
        const node = new TransformNode(`main_${part.name}`, this.scene);
        node.parent = this.holder;
        node.position.set(part.pivot[0], part.pivot[1], part.pivot[2]);
        for (const [arr, mat] of [
          [part.opaque, this.opaque],
          [part.emissive, this.emissive],
          [part.transparent, this.opaque],
        ] as const) {
          if (!arr) continue;
          const mesh = new Mesh(`main_${part.name}_maillage`, this.scene);
          const vd = new VertexData();
          vd.positions = arr.positions;
          vd.normals = arr.normals;
          vd.colors = arr.colors;
          vd.indices = arr.indices;
          vd.applyToMesh(mesh, false);
          mesh.material = mat;
          mesh.parent = node;
          this.meshes.push(mesh);
        }
      }
    } else {
      // No model: a small tool in the colors of the item's icon.
      const color = hexToRgb(def.icon.color);
      const accent = hexToRgb(def.icon.accent ?? '#5a3d24');
      const handle = MeshBuilder.CreateBox('main_manche', { width: 0.028, height: 0.2, depth: 0.028 }, this.scene);
      handle.position.y = -0.02;
      const head = MeshBuilder.CreateBox('main_tête', { width: 0.075, height: 0.055, depth: 0.055 }, this.scene);
      head.position.y = 0.1;
      for (const [mesh, c] of [
        [handle, accent],
        [head, color],
      ] as const) {
        const colors: number[] = [];
        const n = mesh.getTotalVertices();
        for (let i = 0; i < n; i++) colors.push(c.r, c.g, c.b, 1);
        mesh.setVerticesData('color', colors);
        mesh.material = this.opaque;
        mesh.parent = this.holder;
        this.meshes.push(mesh);
      }
    }
    for (const m of this.meshes) {
      m.renderingGroupId = RENDER_GROUP;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
    const s = spec.scale ?? 1;
    this.holder.scaling.set(s, s, s);
  }

  update(dt: number): void {
    const session = this.session;
    const hand = session.equipment.hand;
    if (hand.item !== this.itemId) this.rebuild(hand.item);
    if (this.meshes.length === 0) return;
    this.time += dt;
    const player = session.player;
    const hidden =
      !!session.cinematics.cameraPose() || session.dialogue.isActive || session.combat.player.defeated || player.lookLocked || !session.world;
    this.show += ((hidden ? 0 : 1) - this.show) * damp(hidden ? 16 : 9, dt);
    this.root.setEnabled(this.show > 0.02);
    if (this.show <= 0.02) return;

    const spec = session.items.get(hand.item ?? '')?.held;
    const base = spec?.offset ?? DEFAULT_OFFSET;
    const rot = spec?.rotation ? spec.rotation.map((d) => d * DEG2RAD) : DEFAULT_TILT;
    const pose: Pose = { px: base[0], py: base[1] - (1 - this.show) * 0.5, pz: base[2], rx: rot[0]!, ry: rot[1]!, rz: rot[2]! };
    const add = (o: Pose, w = 1) => {
      pose.px += o.px * w;
      pose.py += o.py * w;
      pose.pz += o.pz * w;
      pose.rx += o.rx * w;
      pose.ry += o.ry * w;
      pose.rz += o.rz * w;
    };

    // Pose kept while a button is held (guard, charge, work), blended in and out.
    if (hand.pose) this.poseKind = hand.pose;
    this.poseWeight += ((hand.pose ? 1 : 0) - this.poseWeight) * damp(hand.pose ? 16 : 10, dt);
    if (this.poseKind && this.poseWeight > 0.001) {
      add(HELD_POSES[this.poseKind] ?? ZERO, this.poseWeight);
      if (this.poseKind === 'charge' || this.poseKind === 'use') {
        const j = this.poseKind === 'charge' ? 0.004 : 0.006;
        add({ px: Math.sin(this.time * 47) * j, py: Math.cos(this.time * 39) * j, pz: 0, rx: 0, ry: 0, rz: 0 }, this.poseWeight);
      }
    }
    if (hand.animation) add(oneShot(hand.animation, hand.time / Math.max(0.05, hand.duration)));

    // Steps and mouse look.
    const body = player.body;
    const speed = Math.hypot(body.velocity.x, body.velocity.z);
    this.bobAmount += ((body.grounded && speed > 0.5 ? Math.min(1, speed / 5) : 0) - this.bobAmount) * damp(8, dt);
    this.bobPhase += speed * dt * 1.9;
    add({ px: Math.cos(this.bobPhase) * 0.012 * this.bobAmount, py: Math.sin(this.bobPhase * 2) * 0.014 * this.bobAmount - 0.01 * this.bobAmount, pz: 0, rx: 0, ry: 0, rz: 0 });
    const dYaw = angleDelta(this.lastYaw, player.yaw);
    const dPitch = player.pitch - this.lastPitch;
    this.lastYaw = player.yaw;
    this.lastPitch = player.pitch;
    const k = damp(10, dt);
    this.swayX += (Math.max(-0.08, Math.min(0.08, -dYaw * 0.9)) - this.swayX) * k;
    this.swayY += (Math.max(-0.06, Math.min(0.06, dPitch * 0.7)) - this.swayY) * k;
    add({ px: this.swayX * 0.5, py: this.swayY * 0.5, pz: 0, rx: this.swayY, ry: this.swayX * 1.5, rz: 0 });

    this.holder.position.set(pose.px, pose.py, pose.pz);
    this.holder.rotation.set(pose.rx, pose.ry, pose.rz);

    // Lit like the place the player stands in.
    const eye = player.eye;
    const [sky, r, g, b] = this.lightAt({ x: eye.x, y: eye.y, z: eye.z });
    const bright = Math.max(0.32 + 0.68 * sky, Math.min(1, Math.max(r, g, b) * 1.1));
    this.opaque.diffuseColor.set(bright, bright, bright);
    this.opaque.emissiveColor.set(bright * 0.22, bright * 0.22, bright * 0.22);
  }

  dispose(): void {
    this.clear();
    this.holder.dispose();
    this.root.dispose();
    this.opaque.dispose();
    this.emissive.dispose();
  }
}
