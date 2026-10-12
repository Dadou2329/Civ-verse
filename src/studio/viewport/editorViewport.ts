/**
 * The Studio's 3D viewport. It renders the edited scene with exactly the renderers of the game
 * (voxels, models, characters, environment), plus editor helpers, a free camera, picking,
 * transform gizmos and block tools.
 *
 * Camera: hold the right mouse button and use ZQSD/WASD (A/E: down/up, Maj: faster), the wheel
 * moves forward, the middle button pans, F frames the selection.
 */
import {
  Color3,
  Engine,
  GizmoManager,
  Matrix,
  MeshBuilder,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
  type AbstractMesh,
  type LinesMesh,
  type Mesh,
  type Node,
  type TransformNode,
} from '@babylonjs/core';
import type { SceneWorld } from '@engine/core/world/sceneWorld';
import type { EnvironmentDoc } from '@engine/core/content/schemas';
import { raycastVoxels, type VoxelHit } from '@engine/core/voxel/raycast';
import { VoxelRenderer } from '@engine/view/voxelRenderer';
import { ModelRenderer } from '@engine/view/modelRenderer';
import { EntityViewManager } from '@engine/view/entityViews';
import { EnvironmentRenderer } from '@engine/view/environment';
import { QUALITY, type QualityLevel } from '@engine/view/quality';
import { DEG2RAD, RAD2DEG } from '@engine/core/util/math';
import type { Studio } from '../core/studio';
import type { VoxelChange } from '../core/edits';
import { updateEntity } from '../core/edits';

export interface PickResult {
  entityId: string | null;
  voxel: VoxelHit | null;
  /** World point under the cursor (voxel face or entity), for placing new things. */
  point: Vector3 | null;
}

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class EditorViewport {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: UniversalCamera;
  private world: SceneWorld | null = null;
  private env: EnvironmentRenderer | null = null;
  private voxels: VoxelRenderer | null = null;
  private models: ModelRenderer | null = null;
  entities: EntityViewManager | null = null;
  private envDoc: EnvironmentDoc | null = null;
  private gizmos: GizmoManager;
  private attachedId: string | null = null;
  private dragging = false;
  private selectionBox: LinesMesh | null = null;
  private selectionKey = '';
  private cursor: Mesh;
  private boxCorner: [number, number, number] | null = null;
  private stroke: { changes: VoxelChange[]; commit(): void; keys: Set<string> } | null = null;
  private keys = new Set<string>();
  private rmb = false;
  private mmb = false;
  private lastPointer = { x: 0, y: 0 };
  private yaw = 0;
  private pitch = -0.35;
  private unsub: () => void;
  private running = false;
  quality: QualityLevel = 'medium';
  /** Updated every frame for the status bar. */
  stats = { fps: 0, chunks: 0, pending: 0 };
  /** Hovered voxel/entity (status bar). */
  hover: PickResult = { entityId: null, voxel: null, point: null };
  /** Called when something the React UI shows changed (hover, box corner). */
  onUiChange: (() => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly studio: Studio,
  ) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true, adaptToDeviceRatio: true }, true);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.camera = new UniversalCamera('caméra-studio', new Vector3(0, 20, 0), this.scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.05;
    this.camera.maxZ = 1500;
    this.camera.fov = 70 * DEG2RAD;
    this.camera.rotationQuaternion = null as never;
    this.scene.activeCamera = this.camera;

    this.gizmos = new GizmoManager(this.scene, 1.4);
    this.gizmos.usePointerToAttachGizmos = false;
    this.gizmos.clearGizmoOnEmptyPointerEvent = false;
    this.applyGizmoMode();
    this.cursor = MeshBuilder.CreateBox('curseur-bloc', { size: 1.02 }, this.scene);
    const cm = new StandardMaterial('curseur-matière', this.scene);
    cm.emissiveColor = new Color3(1, 0.85, 0.35);
    cm.disableLighting = true;
    cm.wireframe = true;
    this.cursor.material = cm;
    this.cursor.isPickable = false;
    this.cursor.setEnabled(false);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    this.unsub = studio.subscribe(() => this.onStudioChange());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.engine.runRenderLoop(this.frame);
  }

  stop(): void {
    this.running = false;
    this.engine.stopRenderLoop(this.frame);
  }

  resize(): void {
    this.engine.resize();
  }

  private onResize = () => this.engine.resize();

  // ---------------------------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------------------------

  private frame = (): void => {
    const world = this.studio.world;
    if (world !== this.world) {
      if (world) this.build(world);
      else this.clear();
    }
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    if (this.world) {
      this.updateCamera(dt);
      const region = this.world.flushLight();
      if (region) this.voxels?.markBox(region, 1);
      this.voxels?.update();
      if (this.dragging) this.copyGizmoToEntity();
      this.entities?.sync(dt);
      this.env?.update(dt);
      this.syncGizmo();
      this.syncSelectionBox();
    }
    this.scene.render();
    this.stats = { fps: this.engine.getFps(), chunks: this.voxels?.chunkCount ?? 0, pending: this.voxels?.pendingChunks ?? 0 };
  };

  private build(world: SceneWorld): void {
    this.clear();
    this.world = world;
    const q = QUALITY[this.quality];
    const doc = this.studio.sceneDoc();
    const envDoc = doc?.environment ?? world.doc.environment;
    this.envDoc = envDoc;
    this.env = new EnvironmentRenderer(this.scene, this.camera, envDoc, q);
    const env = this.env;
    this.voxels = new VoxelRenderer(this.scene, world, this.studio.session.blocks, {
      shadows: env.shadows,
      excludeFromLights: [env.hemi],
      onEmissiveMesh: (m) => env.addGlowMesh(m),
      budgetMs: 10,
    });
    env.onAmbient = (r, g, b, s) => this.voxels?.setAmbient(r, g, b, s);
    env.emitAmbient();
    this.voxels.buildAll();
    this.models = new ModelRenderer(this.scene, this.studio.session.models, env.shadows);
    this.entities = new EntityViewManager(this.scene, this.studio.session, this.models, env, 'studio');
    this.entities.sync(0);
    const cam = doc?.editor?.camera;
    if (cam) this.lookFrom(new Vector3(...cam.position), new Vector3(...cam.target));
    else {
      const v = world.volume;
      this.lookFrom(new Vector3(v.sizeX / 2, v.sizeY * 0.8, -v.sizeZ * 0.1), new Vector3(v.sizeX / 2, v.sizeY * 0.2, v.sizeZ / 2));
    }
  }

  private clear(): void {
    this.gizmos.attachToNode(null);
    this.attachedId = null;
    this.selectionBox?.dispose();
    this.selectionBox = null;
    this.selectionKey = '';
    this.entities?.dispose();
    this.entities = null;
    this.models?.dispose();
    this.models = null;
    this.voxels?.dispose();
    this.voxels = null;
    this.env?.dispose();
    this.env = null;
    this.world = null;
    this.envDoc = null;
  }

  /** Rebuilds everything (quality change, blocks or models reloaded). */
  rebuild(): void {
    const w = this.world;
    this.clear();
    if (w) this.build(w);
  }

  private onStudioChange(): void {
    const doc = this.studio.sceneDoc();
    if (doc && this.env && doc.environment !== this.envDoc) {
      this.envDoc = doc.environment;
      this.env.set(doc.environment);
      this.env.emitAmbient();
    }
    this.applyGizmoMode();
    if (this.studio.tool === 'select') {
      this.cursor.setEnabled(false);
      this.boxCorner = null;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------------------------

  lookFrom(position: Vector3, target: Vector3): void {
    this.camera.position.copyFrom(position);
    const d = target.subtract(position);
    this.yaw = Math.atan2(d.x, d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.applyLook();
  }

  private applyLook(): void {
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    this.camera.rotation.set(-this.pitch, this.yaw, 0);
  }

  private forward(): Vector3 {
    return new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  private updateCamera(dt: number): void {
    if (!this.rmb) return;
    const k = this.keys;
    const f = this.forward();
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = Vector3.Zero();
    if (k.has('KeyW') || k.has('ArrowUp')) move.addInPlace(f);
    if (k.has('KeyS') || k.has('ArrowDown')) move.subtractInPlace(f);
    if (k.has('KeyD') || k.has('ArrowRight')) move.addInPlace(right);
    if (k.has('KeyA') || k.has('ArrowLeft')) move.subtractInPlace(right);
    if (k.has('KeyE')) move.y += 1;
    if (k.has('KeyQ')) move.y -= 1;
    if (move.lengthSquared() === 0) return;
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 28 : 9;
    this.camera.position.addInPlace(move.normalize().scale(speed * dt));
  }

  /** Puts the camera in front of the selection (F). */
  frameSelection(): void {
    const id = this.studio.selection[0];
    const root = id ? this.entities?.rootOf(id) : null;
    if (!root) return;
    const { min, max } = root.getHierarchyBoundingVectors(true);
    const center = Vector3.Center(min, max);
    const radius = Math.max(1.5, Vector3.Distance(min, max) / 2);
    const back = this.forward().scale(-radius * 2.4);
    this.lookFrom(center.add(back).add(new Vector3(0, radius * 0.4, 0)), center);
  }

  /** Position and look target of the camera (cinematic keys, « Jouer ici »). */
  cameraPose(): { position: [number, number, number]; target: [number, number, number]; yaw: number; pitch: number } {
    const p = this.camera.position;
    const t = p.add(this.forward().scale(4));
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z], yaw: this.yaw, pitch: this.pitch };
  }

  /** Shows a cinematic camera pose (timeline preview). */
  showPose(pose: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number } | null): void {
    if (!pose) {
      this.camera.fov = 70 * DEG2RAD;
      return;
    }
    this.lookFrom(new Vector3(pose.position.x, pose.position.y, pose.position.z), new Vector3(pose.target.x, pose.target.y, pose.target.z));
    this.camera.fov = pose.fov * DEG2RAD;
  }

  // ---------------------------------------------------------------------------------------------
  // Picking
  // ---------------------------------------------------------------------------------------------

  pick(clientX: number, clientY: number): PickResult {
    const world = this.world;
    if (!world) return { entityId: null, voxel: null, point: null };
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.engine.getRenderWidth() / Math.max(1, rect.width);
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const ray = this.scene.createPickingRay(x, y, Matrix.Identity(), this.camera);
    const hit = this.scene.pickWithRay(ray, (m) => m.isPickable && m.isEnabled() && entityIdOf(m) !== null);
    const vox = raycastVoxels(world.volume, world.paletteInfo(), ray.origin, ray.direction, 600, { includeNonSolid: true });
    const entityDist = hit?.hit ? hit.distance : Infinity;
    const voxDist = vox ? vox.distance : Infinity;
    if (entityDist < voxDist && hit?.pickedMesh) {
      return { entityId: entityIdOf(hit.pickedMesh), voxel: vox, point: hit.pickedPoint ?? null };
    }
    return { entityId: null, voxel: vox, point: vox ? new Vector3(vox.point.x, vox.point.y, vox.point.z) : null };
  }

  /** Where a new entity goes: on the block face at the center of the view. */
  placementPoint(): [number, number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const r = this.pick(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (r.voxel) {
      const [nx, ny, nz] = r.voxel.normal;
      return [r.voxel.x + 0.5 + nx * (ny === 0 ? 0.5 : 0), r.voxel.y + (ny > 0 ? 1 : ny < 0 ? -2 : 0), r.voxel.z + 0.5 + nz * (ny === 0 ? 0.5 : 0)];
    }
    const p = this.camera.position.add(this.forward().scale(6));
    return [p.x, p.y, p.z];
  }

  // ---------------------------------------------------------------------------------------------
  // Pointer and keys
  // ---------------------------------------------------------------------------------------------

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onPointerDown = (e: PointerEvent) => {
    this.canvas.focus();
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (e.button === 2) {
      this.rmb = true;
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      this.mmb = true;
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0 || !this.world) return;
    if (this.gizmos.isHovered) return; // the gizmo handles its own drag
    const tool = this.studio.tool;
    const r = this.pick(e.clientX, e.clientY);
    if (tool === 'select') {
      if (r.entityId) this.studio.select([r.entityId], e.ctrlKey || e.metaKey ? 'toggle' : e.shiftKey ? 'add' : 'replace');
      else if (!e.ctrlKey && !e.shiftKey) this.studio.select([]);
      return;
    }
    if (!r.voxel) return;
    if (tool === 'pick') {
      this.studio.block = r.voxel.blockId;
      this.studio.changed();
      return;
    }
    if (tool === 'box') {
      const cell = this.targetCell(r.voxel, !e.shiftKey);
      if (!this.boxCorner) {
        this.boxCorner = cell;
        this.onUiChange?.();
        return;
      }
      this.fillBox(this.boxCorner, cell, e.shiftKey ? null : this.studio.block);
      this.boxCorner = null;
      this.onUiChange?.();
      return;
    }
    // place / erase / paint: a stroke applied live, committed as one undo step on release.
    const label = tool === 'erase' ? 'Effacer des blocs' : tool === 'paint' ? 'Peindre des blocs' : 'Poser des blocs';
    this.stroke = { ...this.studio.beginVoxelStroke(label), keys: new Set() };
    this.canvas.setPointerCapture(e.pointerId);
    this.applyBrush(r.voxel);
  };

  private onPointerMove = (e: PointerEvent) => {
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (this.rmb) {
      this.yaw += dx * 0.0042;
      this.pitch -= dy * 0.0042;
      this.applyLook();
      return;
    }
    if (this.mmb) {
      const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.camera.position.addInPlace(right.scale(-dx * 0.03)).addInPlace(new Vector3(0, dy * 0.03, 0));
      return;
    }
    if (!this.world) return;
    const r = this.pick(e.clientX, e.clientY);
    this.hover = r;
    this.updateCursor(r);
    if (this.stroke && r.voxel && (e.buttons & 1) === 1) this.applyBrush(r.voxel);
    this.onUiChange?.();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 2) this.rmb = false;
    if (e.button === 1) this.mmb = false;
    if (e.button === 0 && this.stroke) {
      this.stroke.commit();
      this.stroke = null;
    }
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const step = Math.sign(e.deltaY) * -(e.shiftKey ? 6 : 2);
    this.camera.position.addInPlace(this.forward().scale(step));
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (this.rmb && MOVE_KEYS.has(e.code)) {
      this.keys.add(e.code);
      e.preventDefault();
    }
    if (e.code.startsWith('Shift')) this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.rmb = false;
    this.mmb = false;
  };

  /** Keyboard shortcuts of the viewport (called by the Studio shell when the view has focus). */
  handleShortcut(e: KeyboardEvent): boolean {
    if (this.rmb) return false;
    switch (e.code) {
      case 'KeyF':
        this.frameSelection();
        return true;
      case 'Escape':
        // Cancels a box being drawn; otherwise the Studio clears the selection.
        if (!this.boxCorner) return false;
        this.boxCorner = null;
        this.onUiChange?.();
        return true;
      default:
        return false;
    }
  }

  /** True while the right button is held (camera flight: letters move the camera). */
  get flying(): boolean {
    return this.rmb;
  }

  get pendingBoxCorner(): [number, number, number] | null {
    return this.boxCorner;
  }

  // ---------------------------------------------------------------------------------------------
  // Block tools
  // ---------------------------------------------------------------------------------------------

  /** Cell targeted by a block tool: the hit cell, or the empty cell in front of its face. */
  private targetCell(hit: VoxelHit, adjacent: boolean): [number, number, number] {
    return adjacent ? [hit.x + hit.normal[0], hit.y + hit.normal[1], hit.z + hit.normal[2]] : [hit.x, hit.y, hit.z];
  }

  private updateCursor(r: PickResult): void {
    const tool = this.studio.tool;
    if (tool === 'select' || !r.voxel) {
      this.cursor.setEnabled(false);
      return;
    }
    const c = this.targetCell(r.voxel, tool === 'place' || (tool === 'box' && !this.keys.has('ShiftLeft')));
    this.cursor.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
    this.cursor.setEnabled(true);
  }

  private applyBrush(hit: VoxelHit): void {
    const world = this.world;
    if (!world || !this.stroke) return;
    const tool = this.studio.tool;
    const cell = this.targetCell(hit, tool === 'place');
    const [x, y, z] = cell;
    const v = world.volume;
    if (x < 0 || y < 0 || z < 0 || x >= v.sizeX || y >= v.sizeY || z >= v.sizeZ) return;
    const key = `${x},${y},${z}`;
    if (this.stroke.keys.has(key)) return;
    const before = v.get(x, y, z);
    const after = tool === 'erase' ? null : this.studio.block;
    if (tool === 'paint' && before === null) return;
    if (before === after) return;
    this.stroke.keys.add(key);
    this.stroke.changes.push([x, y, z, before, after]);
    world.setBlock(x, y, z, after);
  }

  private fillBox(a: [number, number, number], b: [number, number, number], block: string | null): void {
    const world = this.world;
    if (!world) return;
    const v = world.volume;
    const min = [0, 1, 2].map((i) => Math.max(0, Math.min(a[i]!, b[i]!)));
    const max = [0, 1, 2].map((i) => Math.min([v.sizeX, v.sizeY, v.sizeZ][i]! - 1, Math.max(a[i]!, b[i]!)));
    const volume = (max[0]! - min[0]! + 1) * (max[1]! - min[1]! + 1) * (max[2]! - min[2]! + 1);
    if (volume > 200_000) {
      this.studio.print('warning', `Boîte trop grande (${volume} blocs, maximum 200 000).`);
      return;
    }
    const changes: VoxelChange[] = [];
    for (let y = min[1]!; y <= max[1]!; y++)
      for (let z = min[2]!; z <= max[2]!; z++)
        for (let x = min[0]!; x <= max[0]!; x++) {
          const before = v.get(x, y, z);
          if (before !== block) changes.push([x, y, z, before, block]);
        }
    this.studio.editVoxels(block ? `Remplir une boîte (${changes.length} blocs)` : `Vider une boîte (${changes.length} blocs)`, changes);
  }

  // ---------------------------------------------------------------------------------------------
  // Gizmos and selection outline
  // ---------------------------------------------------------------------------------------------

  private applyGizmoMode(): void {
    const g = this.gizmos;
    const mode = this.studio.gizmo;
    const active = this.studio.tool === 'select';
    g.positionGizmoEnabled = active && mode === 'move';
    g.rotationGizmoEnabled = active && mode === 'rotate';
    g.scaleGizmoEnabled = active && mode === 'scale';
    const snap = this.studio.snap;
    const pos = g.gizmos.positionGizmo;
    if (pos) {
      pos.snapDistance = snap.enabled ? snap.move : 0;
      this.hookDrag(pos);
    }
    const rot = g.gizmos.rotationGizmo;
    if (rot) {
      rot.snapDistance = snap.enabled ? snap.rotate * DEG2RAD : 0;
      rot.updateGizmoRotationToMatchAttachedMesh = false;
      this.hookDrag(rot);
    }
    const sc = g.gizmos.scaleGizmo;
    if (sc) {
      sc.snapDistance = snap.enabled ? snap.scale : 0;
      this.hookDrag(sc);
    }
  }

  private hooked = new WeakSet<object>();

  private hookDrag(gizmo: { onDragStartObservable: { add(cb: () => void): unknown }; onDragEndObservable: { add(cb: () => void): unknown } }): void {
    if (this.hooked.has(gizmo)) return;
    this.hooked.add(gizmo);
    gizmo.onDragStartObservable.add(() => {
      this.dragging = true;
    });
    gizmo.onDragEndObservable.add(() => {
      this.copyGizmoToEntity();
      this.dragging = false;
      this.commitTransform();
    });
  }

  private syncGizmo(): void {
    const id = this.studio.selection.length === 1 ? this.studio.selection[0]! : null;
    const root = id ? (this.entities?.rootOf(id) ?? null) : null;
    if (this.dragging) return;
    if (id !== this.attachedId || this.gizmos.attachedNode !== root) {
      this.attachedId = id;
      const locked = id ? this.studio.entity(id)?.editor?.locked : false;
      this.gizmos.attachToNode(locked ? null : root);
    }
  }

  /** While dragging, the entity follows its root (so view syncing does not undo the drag). */
  private copyGizmoToEntity(): void {
    const id = this.attachedId;
    const root = id ? this.entities?.rootOf(id) : null;
    const e = id ? this.world?.entities.get(id) : null;
    if (!root || !e) return;
    e.position = { x: root.position.x, y: root.position.y, z: root.position.z };
    const rot = root.rotationQuaternion ? root.rotationQuaternion.toEulerAngles() : root.rotation;
    e.rotation = [rot.x * RAD2DEG, rot.y * RAD2DEG, rot.z * RAD2DEG];
    e.scale = [root.scaling.x, root.scaling.y, root.scaling.z];
  }

  private commitTransform(): void {
    const id = this.attachedId;
    const root = id ? this.entities?.rootOf(id) : null;
    const e = id ? this.world?.entities.get(id) : null;
    if (!id || !root || !e) return;
    if (root.rotationQuaternion) {
      root.rotation = root.rotationQuaternion.toEulerAngles();
      root.rotationQuaternion = null;
    }
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const pos: [number, number, number] = [r3(e.position.x), r3(e.position.y), r3(e.position.z)];
    const rot: [number, number, number] = [r3(norm(e.rotation[0])), r3(norm(e.rotation[1])), r3(norm(e.rotation[2]))];
    const scl: [number, number, number] = [r3(e.scale[0]), r3(e.scale[1]), r3(e.scale[2])];
    const mode = this.studio.gizmo;
    this.studio.editScene(mode === 'move' ? `Déplacer « ${id} »` : mode === 'rotate' ? `Tourner « ${id} »` : `Redimensionner « ${id} »`, (s) =>
      updateEntity(s, id, (doc) => {
        doc.position = pos;
        if (rot.some((v) => v !== 0) || doc.rotation) doc.rotation = rot;
        if (scl.some((v) => v !== 1) || doc.scale) doc.scale = scl;
      }),
    );
  }

  private syncSelectionBox(): void {
    const ids = this.studio.selection;
    const roots = ids.map((id) => this.entities?.rootOf(id)).filter((r): r is TransformNode => !!r);
    const key = roots.map((r) => `${r.uniqueId}:${r.position.x.toFixed(2)},${r.position.y.toFixed(2)},${r.position.z.toFixed(2)},${r.rotation.y.toFixed(2)}`).join('|');
    if (key === this.selectionKey) return;
    this.selectionKey = key;
    this.selectionBox?.dispose();
    this.selectionBox = null;
    if (roots.length === 0) return;
    const lines: Vector3[][] = [];
    for (const root of roots) {
      let { min, max } = root.getHierarchyBoundingVectors(true);
      if (!isFinite(min.x) || Vector3.Distance(min, max) < 0.05) {
        min = root.position.add(new Vector3(-0.3, 0, -0.3));
        max = root.position.add(new Vector3(0.3, 0.6, 0.3));
      }
      const P = (x: number, y: number, z: number) => new Vector3(x, y, z);
      const [a, b] = [min, max];
      lines.push(
        [P(a.x, a.y, a.z), P(b.x, a.y, a.z), P(b.x, a.y, b.z), P(a.x, a.y, b.z), P(a.x, a.y, a.z)],
        [P(a.x, b.y, a.z), P(b.x, b.y, a.z), P(b.x, b.y, b.z), P(a.x, b.y, b.z), P(a.x, b.y, a.z)],
        [P(a.x, a.y, a.z), P(a.x, b.y, a.z)],
        [P(b.x, a.y, a.z), P(b.x, b.y, a.z)],
        [P(b.x, a.y, b.z), P(b.x, b.y, b.z)],
        [P(a.x, a.y, b.z), P(a.x, b.y, b.z)],
      );
    }
    this.selectionBox = MeshBuilder.CreateLineSystem('sélection', { lines }, this.scene) as LinesMesh;
    this.selectionBox.color = new Color3(1, 0.82, 0.3);
    this.selectionBox.isPickable = false;
    this.selectionBox.renderingGroupId = 1;
  }

  // ---------------------------------------------------------------------------------------------

  /** PNG of the current view (thumbnails, tests). */
  screenshot(): string {
    return this.canvas.toDataURL('image/png');
  }

  dispose(): void {
    this.stop();
    this.unsub();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.clear();
    this.gizmos.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}

function entityIdOf(mesh: AbstractMesh): string | null {
  let n: Node | null = mesh;
  while (n) {
    const id = (n.metadata as { entityId?: string } | null)?.entityId;
    if (id) return id;
    n = n.parent;
  }
  return null;
}

function norm(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return Math.abs(d - 360) < 1e-6 ? 0 : d;
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

