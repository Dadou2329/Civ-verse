/**
 * Entity visuals: maps entity components to renderable things and keeps them in sync with the
 * simulation. Built-in visuals: models, hinged doors, characters, signs, particles; pack visuals
 * come from VisualDefinitions (`defineVisual` in @sdk/view); the Studio adds editor helpers.
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type LinesMesh,
  type ParticleSystem,
  type Scene,
} from '@babylonjs/core';
import type { GameSession } from '../core/sim/session';
import type { RuntimeEntity } from '../core/world/entity';
import { DEG2RAD, damp, type Vec3 } from '../core/util/math';
import { hexToRgb } from '../core/util/color';
import type { ModelRenderer, ModelInstance } from './modelRenderer';
import { CharacterRig } from './characters/rig';
import { CharacterAnimator } from './characters/animator';
import { createParticles, type ParticlePreset } from './particles';
import type { EnvironmentRenderer } from './environment';
import type { QualityProfile } from './quality';

export interface ComponentVisual {
  update?(dt: number): void;
  dispose(): void;
  /** Meshes for editor picking/highlighting. */
  meshes?(): AbstractMesh[];
}

/** Read-only entity view given to pack visuals. */
export interface VisualEntity {
  readonly id: string;
  readonly position: Readonly<Vec3>;
  readonly yaw: number;
  readonly visible: boolean;
  readonly tags: readonly string[];
  /** Root node placed at the entity transform: attach meshes to it. */
  readonly root: TransformNode;
  props<T = Record<string, unknown>>(component: string): T;
  state<T = unknown>(component: string): T;
  /** Free-form presentation flags written by behaviors through view flags. */
  readonly flags: Readonly<Record<string, unknown>>;
}

export interface ViewContext {
  readonly scene: Scene;
  readonly mode: 'game' | 'studio';
  readonly quality: QualityProfile;
  readonly time: number;
  t(key: string, params?: Record<string, string | number>): string;
  createModel(modelId: string, name: string): ModelInstance | null;
  createParticles(preset: ParticlePreset, at: Vector3, opts: { color: string; size: [number, number, number]; rate: number }): ParticleSystem;
  addGlow(mesh: AbstractMesh): void;
  addShadowCaster(mesh: AbstractMesh): void;
  /** Light at a world position (0..1): [sky, r, g, b]. */
  lightAt(p: Vec3): [number, number, number, number];
}

interface EntityView {
  entity: RuntimeEntity;
  root: TransformNode;
  visuals: Map<string, ComponentVisual>;
  models: ModelInstance[];
  rig: CharacterRig | null;
  revision: number;
  propsRevision: number;
  lightTimer: number;
  helper: ComponentVisual | null;
}

export class EntityViewManager {
  private views = new Map<string, EntityView>();
  private worldRevision = -1;
  private time = 0;
  readonly ctx: ViewContext;
  showHelpers: boolean;

  constructor(
    private readonly scene: Scene,
    private readonly session: GameSession,
    private readonly models: ModelRenderer,
    private readonly env: EnvironmentRenderer,
    readonly mode: 'game' | 'studio',
  ) {
    this.showHelpers = mode === 'studio';
    const now = () => this.time;
    this.ctx = {
      scene,
      mode,
      quality: env.quality,
      get time() {
        return now();
      },
      t: (k, p) => session.t(k, p),
      createModel: (id, name) => {
        const inst = models.instantiate(id, name);
        return inst;
      },
      createParticles: (preset, at, opts) => createParticles(scene, `particules_${preset}`, at, { preset, quality: env.quality.particles, ...opts }),
      addGlow: (m) => env.addGlowMesh(m),
      addShadowCaster: (m) => env.shadows?.addShadowCaster(m, false),
      lightAt: (p) => session.world?.light.sample(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) ?? [1, 0, 0, 0],
    };
    models.onEmissiveInstance = (inst) => env.addGlowMesh(inst);
  }

  get count(): number {
    return this.views.size;
  }

  /** Root node of an entity's visuals (Studio selection/gizmos). */
  rootOf(entityId: string): TransformNode | null {
    return this.views.get(entityId)?.root ?? null;
  }

  meshesOf(entityId: string): AbstractMesh[] {
    const v = this.views.get(entityId);
    if (!v) return [];
    return v.root.getChildMeshes(false);
  }

  sync(dt: number): void {
    this.time += dt;
    const world = this.session.world;
    if (!world) {
      this.clear();
      return;
    }
    if (world.entitiesRevision !== this.worldRevision) {
      this.worldRevision = world.entitiesRevision;
      for (const [id, v] of [...this.views]) {
        if (world.entities.get(id) !== v.entity) this.destroyView(id);
      }
      for (const e of world.entities.values()) if (!this.views.has(e.id)) this.createView(e);
    }
    const stale: string[] = [];
    for (const v of this.views.values()) {
      if (v.propsRevision !== v.entity.propsRevision) stale.push(v.entity.id);
      else this.updateView(v, dt);
    }
    for (const id of stale) this.refresh(id);
  }

  /** Rebuilds an entity's visuals (after its components changed in the Studio). */
  refresh(entityId: string): void {
    const v = this.views.get(entityId);
    if (v) {
      this.destroyView(entityId);
      this.createView(v.entity);
    }
  }

  refreshAll(): void {
    for (const id of [...this.views.keys()]) this.refresh(id);
  }

  clear(): void {
    for (const id of [...this.views.keys()]) this.destroyView(id);
    this.worldRevision = -1;
  }

  setHelpersVisible(v: boolean): void {
    this.showHelpers = v;
    for (const view of this.views.values()) {
      view.helper?.dispose();
      view.helper = v ? this.createHelper(view) : null;
    }
  }

  private createView(e: RuntimeEntity): void {
    const root = new TransformNode(`entité_${e.id}`, this.scene);
    root.metadata = { entityId: e.id };
    const view: EntityView = { entity: e, root, visuals: new Map(), models: [], rig: null, revision: -1, propsRevision: e.propsRevision, lightTimer: 0, helper: null };
    this.views.set(e.id, view);
    for (const [type, record] of e.components) {
      try {
        const visual = this.createVisual(view, type, record.props);
        if (visual) view.visuals.set(type, visual);
      } catch (err) {
        this.session.log.error(`Visuel de ${e.id}/${type} impossible`, err);
      }
    }
    if (this.showHelpers) view.helper = this.createHelper(view);
    this.applyTransform(view);
  }

  private destroyView(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    for (const vis of v.visuals.values()) {
      try {
        vis.dispose();
      } catch (err) {
        this.session.log.error(`Libération du visuel de ${id}`, err);
      }
    }
    v.helper?.dispose();
    for (const m of v.models) m.dispose(this.env.shadows);
    v.rig?.dispose();
    v.root.dispose();
    this.views.delete(id);
  }

  private applyTransform(v: EntityView): void {
    const e = v.entity;
    v.root.position.set(e.position.x, e.position.y, e.position.z);
    v.root.rotation.set(e.rotation[0] * DEG2RAD, e.rotation[1] * DEG2RAD, e.rotation[2] * DEG2RAD);
    v.root.scaling.set(e.scale[0], e.scale[1], e.scale[2]);
    const visible = e.visible || (this.mode === 'studio' && !this.session.civ);
    v.root.setEnabled(visible);
    v.revision = e.revision;
  }

  private updateView(v: EntityView, dt: number): void {
    if (v.revision !== v.entity.revision) this.applyTransform(v);
    if (!v.root.isEnabled()) return;
    v.lightTimer -= dt;
    if (v.lightTimer <= 0) {
      v.lightTimer = 0.25;
      const p = v.entity.position;
      const [sky, r, g, b] = this.ctx.lightAt({ x: p.x, y: p.y + 1.2, z: p.z });
      const bright = Math.max(0.3 + 0.7 * sky, Math.min(1, Math.max(r, g, b) * 1.1));
      for (const m of v.models) m.setBrightness(bright);
      v.rig?.setLighting(sky, [r, g, b]);
    }
    for (const [type, vis] of v.visuals) {
      if (!vis.update) continue;
      try {
        vis.update(dt);
      } catch (err) {
        this.session.log.error(`Mise à jour du visuel ${v.entity.id}/${type}`, err);
        v.visuals.delete(type);
        vis.dispose();
      }
    }
  }

  private visualEntity(v: EntityView): VisualEntity {
    const e = v.entity;
    return {
      id: e.id,
      get position() {
        return e.position;
      },
      get yaw() {
        return e.rotation[1];
      },
      get visible() {
        return e.visible;
      },
      tags: e.tags,
      root: v.root,
      props: <T,>(c: string) => (e.components.get(c)?.props ?? {}) as T,
      state: <T,>(c: string) => e.components.get(c)?.state as T,
      get flags() {
        return e.view.flags;
      },
    };
  }

  private createVisual(v: EntityView, type: string, props: Record<string, unknown>): ComponentVisual | null {
    const e = v.entity;
    const packVisual = this.session.visuals.get(type);
    if (packVisual) return packVisual.def.create(this.ctx, this.visualEntity(v)) as ComponentVisual;
    switch (type) {
      case 'core.model': {
        const id = String(props.model ?? '');
        const inst = id ? this.models.instantiate(id, e.id) : null;
        if (!inst) return this.mode === 'studio' ? this.missingMarker(v) : null;
        inst.root.parent = v.root;
        v.models.push(inst);
        return { dispose: () => undefined };
      }
      case 'core.door':
        return this.doorVisual(v, props);
      case 'core.npc':
        return this.npcVisual(v, props);
      case 'core.sign':
        return this.signVisual(v, props);
      case 'core.particles': {
        const size = (props.size as [number, number, number]) ?? [3, 2, 3];
        const ps = this.ctx.createParticles(String(props.preset ?? 'dust') as ParticlePreset, v.root.position.clone(), {
          color: String(props.color ?? '#ffd9a0'),
          size,
          rate: Number(props.rate ?? 1),
        });
        return {
          update: () => {
            (ps.emitter as Vector3).copyFrom(v.root.position);
          },
          dispose: () => ps.dispose(),
        };
      }
      default:
        return null;
    }
  }

  private doorVisual(v: EntityView, props: Record<string, unknown>): ComponentVisual | null {
    const e = v.entity;
    const width = Number(props.width ?? 1);
    const height = Number(props.height ?? 2);
    const hingeRight = props.hinge === 'right';
    const hinge = new TransformNode(`${e.id}_charnière`, this.scene);
    hinge.parent = v.root;
    hinge.position.x = hingeRight ? width / 2 : -width / 2;
    const modelId = String(props.model ?? 'core:door_wood');
    const inst = this.models.instantiate(modelId, `${e.id}_porte`);
    if (inst) {
      inst.root.parent = hinge;
      inst.root.position.x = hingeRight ? -width / 2 : width / 2;
      inst.root.scaling.set(width, height / 2, 1);
      v.models.push(inst);
    }
    let angle = 0;
    return {
      update: (dt) => {
        const state = e.components.get('core.door')?.state as { open?: boolean } | undefined;
        const target = state?.open ? (hingeRight ? -1 : 1) * 1.75 : 0;
        angle += (target - angle) * damp(9, dt);
        hinge.rotation.y = angle;
      },
      dispose: () => hinge.dispose(),
    };
  }

  private npcVisual(v: EntityView, props: Record<string, unknown>): ComponentVisual | null {
    const e = v.entity;
    const doc = this.session.characterDoc(String(props.character ?? ''));
    if (!doc) {
      if (props.character) this.session.log.warn(`Apparence inconnue pour ${e.id} : ${String(props.character)}`);
      return this.mode === 'studio' ? this.missingMarker(v) : null;
    }
    const rig = new CharacterRig(this.scene, doc, e.id, this.env.shadows);
    rig.root.parent = v.root;
    v.rig = rig;
    const animator = new CharacterAnimator(rig);
    return {
      update: (dt) => {
        const dv = this.session.dialogue.view();
        const talking = !!dv && !dv.isPlayer && dv.entityId === e.id;
        animator.update({
          dt,
          speed: e.view.speed,
          animation: e.view.animation,
          loop: e.view.animationLoop,
          lookAt: e.view.lookAt,
          position: e.position,
          yaw: e.rotation[1] * DEG2RAD,
          talking,
          expression: e.view.expression,
        });
      },
      dispose: () => undefined,
    };
  }

  private signVisual(v: EntityView, props: Record<string, unknown>): ComponentVisual {
    const e = v.entity;
    const [w, h, depth] = (props.size as [number, number, number]) ?? [1, 0.5, 0.05];
    const d = Math.max(0.01, depth);
    // A plain board, and the text on both faces so it reads correctly from either side
    // (front = local +Z, like every model).
    const board = MeshBuilder.CreateBox(`${e.id}_panneau`, { width: w, height: h, depth: d }, this.scene);
    board.parent = v.root;
    board.position.y = h / 2;
    const boardMat = new StandardMaterial(`${e.id}_panneau_bois`, this.scene);
    const bgc = hexToRgb(String(props.background ?? '#d9c39a'));
    boardMat.diffuseColor = new Color3(bgc.r * 0.7, bgc.g * 0.7, bgc.b * 0.7);
    boardMat.specularColor = new Color3(0.03, 0.03, 0.03);
    board.material = boardMat;
    const resolution = 256;
    const tex = new DynamicTexture(`${e.id}_texte`, { width: Math.round(resolution * (w / h)), height: resolution }, this.scene, true);
    const mat = new StandardMaterial(`${e.id}_panneau_mat`, this.scene);
    mat.diffuseTexture = tex;
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    const style = String(props.style ?? 'plaque');
    const faces: Mesh[] = [];
    for (const side of [1, -1]) {
      const face = MeshBuilder.CreatePlane(`${e.id}_texte_${side > 0 ? 'avant' : 'arrière'}`, { width: w * 0.98, height: h * 0.96 }, this.scene);
      face.parent = board;
      face.position.z = side * (d / 2 + 0.003);
      if (side > 0) face.rotation.y = Math.PI;
      face.material = mat;
      face.isPickable = false;
      faces.push(face);
      if (style === 'glow') this.env.addGlowMesh(face);
    }
    if (style === 'glow') mat.emissiveTexture = tex;
    const draw = () => {
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      const size = tex.getSize();
      const bg = hexToRgb(String(props.background ?? '#d9c39a'));
      const fg = String(props.color ?? '#2a1d12');
      ctx.fillStyle = `rgb(${bg.r * 255},${bg.g * 255},${bg.b * 255})`;
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, size.width - 12, size.height - 12);
      const text = props.text ? this.session.t(String(props.text)) : '';
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = text.split('\n');
      const fontSize = Math.min(size.height / (lines.length + 0.6), 72);
      ctx.font = `${style === 'carved' ? '' : 'bold '}${fontSize}px "Alegreya Sans", "Cinzel", serif`;
      lines.forEach((line, i) => ctx.fillText(line, size.width / 2, size.height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.1, size.width - 24));
      tex.update(true);
    };
    draw();
    if (typeof document !== 'undefined' && document.fonts) void document.fonts.ready.then(draw);
    return {
      dispose: () => {
        for (const f of faces) f.dispose();
        board.dispose();
        boardMat.dispose();
        mat.dispose();
        tex.dispose();
      },
      meshes: () => [board, ...faces],
    };
  }

  private missingMarker(v: EntityView): ComponentVisual {
    const box = MeshBuilder.CreateBox(`${v.entity.id}_manquant`, { size: 0.5 }, this.scene);
    const mat = new StandardMaterial(`${v.entity.id}_manquant_mat`, this.scene);
    mat.emissiveColor = new Color3(1, 0, 1);
    mat.disableLighting = true;
    box.material = mat;
    box.parent = v.root;
    box.position.y = 0.25;
    return {
      dispose: () => {
        box.dispose();
        mat.dispose();
      },
      meshes: () => [box],
    };
  }

  /** Editor helpers: volumes, spawn arrows, markers, light bulbs. */
  private createHelper(v: EntityView): ComponentVisual | null {
    const e = v.entity;
    const meshes: AbstractMesh[] = [];
    const color = (hex: string) => {
      const c = hexToRgb(hex);
      return new Color3(c.r, c.g, c.b);
    };
    const boxLines = (size: [number, number, number], offset: [number, number, number], hex: string, centeredY: boolean) => {
      const [sx, sy, sz] = size;
      const [ox, oy, oz] = offset;
      const y0 = centeredY ? oy - sy / 2 : oy;
      const y1 = y0 + sy;
      const x0 = ox - sx / 2;
      const x1 = ox + sx / 2;
      const z0 = oz - sz / 2;
      const z1 = oz + sz / 2;
      const P = (x: number, y: number, z: number) => new Vector3(x, y, z);
      const lines = [
        [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), P(x0, y0, z0)],
        [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), P(x0, y1, z0)],
        [P(x0, y0, z0), P(x0, y1, z0)],
        [P(x1, y0, z0), P(x1, y1, z0)],
        [P(x1, y0, z1), P(x1, y1, z1)],
        [P(x0, y0, z1), P(x0, y1, z1)],
      ];
      const m = MeshBuilder.CreateLineSystem(`${e.id}_aide`, { lines }, this.scene) as LinesMesh;
      m.color = color(hex);
      m.parent = v.root;
      m.isPickable = false;
      meshes.push(m);
    };
    for (const [type, record] of e.components) {
      const p = record.props;
      if (type === 'core.trigger') boxLines(p.size as never, p.offset as never, '#ff9a3c', false);
      else if (type === 'core.zone') boxLines(p.size as never, p.offset as never, '#4ac0ff', false);
      else if (type === 'core.collider') boxLines(p.size as never, p.offset as never, '#ff4a6a', false);
      else if (type === 'core.portal') boxLines(p.size as never, [0, 0, 0], '#c07aff', false);
      else if (type === 'core.interactable' || type === 'core.pickup' || type === 'core.readable') boxLines(p.size as never, p.offset as never, '#7aff9a', true);
      else if (type === 'core.spawn' || type === 'core.marker' || type === 'core.light' || type === 'core.sound') {
        const hex = type === 'core.spawn' ? '#4aff8a' : type === 'core.marker' ? '#ffe14a' : type === 'core.light' ? String(p.color ?? '#ffcc66') : '#8ab4ff';
        const cone = MeshBuilder.CreateCylinder(`${e.id}_aide`, { diameterTop: 0, diameterBottom: 0.35, height: 0.6, tessellation: 4 }, this.scene);
        const mat = new StandardMaterial(`${e.id}_aide_mat`, this.scene);
        mat.emissiveColor = color(hex);
        mat.disableLighting = true;
        mat.alpha = 0.8;
        cone.material = mat;
        cone.parent = v.root;
        cone.position.y = type === 'core.light' ? Number((p.offset as number[] | undefined)?.[1] ?? 0.5) : 0.3;
        if (type === 'core.spawn') cone.rotation.x = Math.PI / 2;
        meshes.push(cone);
      }
    }
    if (meshes.length === 0) return null;
    return {
      dispose: () => meshes.forEach((m) => {
        m.material?.dispose();
        m.dispose();
      }),
      meshes: () => meshes,
    };
  }

  dispose(): void {
    this.clear();
  }
}

export function isMesh(m: AbstractMesh): m is Mesh {
  return m instanceof Mesh;
}
