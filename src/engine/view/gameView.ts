/**
 * GameView — renders a GameSession with Babylon.js and feeds it player input.
 *
 * Frame: input → session.update(dt) → voxel/entity/environment sync → camera → audio → render.
 * The same building blocks (VoxelRenderer, EntityViewManager, EnvironmentRenderer) are used by
 * Civilization Studio's editor viewport, so editing and playtesting share one rendering path.
 */
import {
  Color3,
  Engine,
  MeshBuilder,
  Scene,
  SceneInstrumentation,
  Vector3,
  Matrix,
  type AbstractEngine,
  type LinesMesh,
  type ParticleSystem,
} from '@babylonjs/core';
import type { GameSession } from '../core/sim/session';
import type { SceneWorld } from '../core/world/sceneWorld';
import type { PresentationRequest } from '../core/sim/presentation';
import { VoxelRenderer } from './voxelRenderer';
import { ModelRenderer } from './modelRenderer';
import { EntityViewManager } from './entityViews';
import { EnvironmentRenderer } from './environment';
import { CameraRig } from './cameraRig';
import { QUALITY, type QualityLevel } from './quality';
import { createParticles, type ParticlePreset } from './particles';
import { AudioEngine } from '../audio/audioEngine';
import { InputManager } from '../input/inputManager';
import type { GameSettings } from '../platform/settings';
import type { Disposable } from '../core/util/disposable';

export interface FrameStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  vertices: number;
  chunks: number;
  pendingChunks: number;
  entities: number;
}

export interface GameViewOptions {
  canvas: HTMLCanvasElement;
  session: GameSession;
  settings: GameSettings;
  /** Reuse an existing engine (Studio playtest). */
  engine?: AbstractEngine;
}

export class GameView {
  readonly engine: AbstractEngine;
  readonly scene: Scene;
  readonly rig: CameraRig;
  readonly input: InputManager;
  readonly audio: AudioEngine;
  private models: ModelRenderer | null = null;
  private entities: EntityViewManager | null = null;
  private voxels: VoxelRenderer | null = null;
  private env: EnvironmentRenderer | null = null;
  private ambient: ParticleSystem | null = null;
  private world: SceneWorld | null = null;
  private qualityLevel: QualityLevel;
  private presentationSub: Disposable;
  private instrumentation: SceneInstrumentation;
  private ownsEngine: boolean;
  private colliderDebug: LinesMesh | null = null;
  private colliderRevision = -1;
  private keyUnsub: () => void;
  private running = false;
  /** True while the player controls the character (no menu open). */
  playing = false;
  showColliders = false;
  stats: FrameStats = { fps: 0, frameMs: 0, drawCalls: 0, vertices: 0, chunks: 0, pendingChunks: 0, entities: 0 };
  /** Called every frame after rendering (UI overlays positioned from the camera). */
  onAfterFrame: (() => void) | null = null;

  constructor(private readonly opts: GameViewOptions) {
    const { canvas, session, settings } = opts;
    this.ownsEngine = !opts.engine;
    this.engine =
      opts.engine ??
      new Engine(canvas, false, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: false, adaptToDeviceRatio: true }, true);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.rig = new CameraRig(this.scene);
    this.scene.activeCamera = this.rig.camera;
    this.qualityLevel = settings.quality;
    this.input = new InputManager(canvas, settings.bindings);
    this.audio = new AudioEngine(
      (id) => {
        const s = session.sounds.get(id);
        if (s) return { kind: 'sound', category: s.def.category, recipe: s.def.recipe };
        const m = session.music.get(id);
        if (m) return { kind: 'music', recipe: m.def.recipe };
        return null;
      },
      (id) => session.world?.entities.get(id)?.position ?? (id === 'player' ? session.player.position : null),
    );
    this.applySettings(settings);
    this.presentationSub = session.presentation.subscribe((req) => this.onPresentation(req));
    this.keyUnsub = this.input.onKey((code, down) => {
      this.audio.unlock();
      if (!this.playing) return false;
      return session.handleKey(code, down);
    });
    canvas.addEventListener('click', this.onCanvasClick);
    window.addEventListener('resize', this.onResize);
  }

  get session(): GameSession {
    return this.opts.session;
  }

  private onCanvasClick = () => {
    this.audio.unlock();
    if (this.playing) this.input.requestPointerLock();
  };

  private onResize = () => this.engine.resize();

  applySettings(s: GameSettings): void {
    this.rig.baseFovDeg = s.fov;
    this.rig.headBob = s.headBob;
    this.input.bindings = s.bindings;
    this.audio.setVolumes(s.volumes);
    if (s.quality !== this.qualityLevel) {
      this.qualityLevel = s.quality;
      if (this.world) this.buildWorld(this.world);
    }
    this.mouseSensitivity = s.mouseSensitivity;
    this.invertY = s.invertY;
  }

  private mouseSensitivity = 1;
  private invertY = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.engine.runRenderLoop(() => this.frame());
  }

  stop(): void {
    this.running = false;
    this.engine.stopRenderLoop();
  }

  private frame(): void {
    const t0 = performance.now();
    const session = this.session;
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    if (session.world !== this.world) {
      if (session.world) this.buildWorld(session.world);
      else this.clearWorld();
    }
    if (this.world && !session.isLoading) {
      this.handleInput();
      session.update(dt);
      this.voxels?.update();
      this.entities?.sync(dt);
      this.env?.update(dt);
      this.rig.update(session, dt);
      if (this.ambient) (this.ambient.emitter as Vector3).copyFrom(this.rig.camera.position);
      this.audio.update(this.rig.camera.position, session.player.forward);
      this.updateColliderDebug();
    }
    this.input.endFrame();
    this.scene.render();
    this.onAfterFrame?.();
    this.stats = {
      fps: this.engine.getFps(),
      frameMs: performance.now() - t0,
      drawCalls: this.instrumentation.drawCallsCounter.current,
      vertices: this.voxels?.vertexCount ?? 0,
      chunks: this.voxels?.chunkCount ?? 0,
      pendingChunks: this.voxels?.pendingChunks ?? 0,
      entities: this.entities?.count ?? 0,
    };
  }

  private handleInput(): void {
    const s = this.session;
    const p = s.player;
    const inp = this.input;
    if (!this.playing) {
      p.intent.forward = p.intent.right = 0;
      p.intent.jump = false;
      p.intent.sprint = false;
      inp.consumeLook();
      return;
    }
    if (s.cinematics.current) {
      if (inp.consume('skip')) s.cinematics.skip();
      p.intent.forward = p.intent.right = 0;
      inp.consumeLook();
      return;
    }
    const look = inp.consumeLook();
    const k = 0.0022 * this.mouseSensitivity;
    p.addLook(look.dx * k, look.dy * k * (this.invertY ? -1 : 1));
    p.intent.forward = (inp.isDown('forward') ? 1 : 0) - (inp.isDown('back') ? 1 : 0);
    p.intent.right = (inp.isDown('right') ? 1 : 0) - (inp.isDown('left') ? 1 : 0);
    p.intent.sprint = inp.isDown('sprint');
    p.intent.up = (inp.isDown('jump') ? 1 : 0) - (inp.isDown('sprint') ? 1 : 0);
    if (!s.dialogue.isActive) {
      if (inp.consume('jump')) p.intent.jump = true;
      if (inp.consume('interact')) void s.interaction.interact('primary');
      if (inp.consume('secondary')) void s.interaction.interact('secondary');
    }
  }

  private buildWorld(world: SceneWorld): void {
    this.clearWorld();
    this.world = world;
    const q = QUALITY[this.qualityLevel];
    this.engine.setHardwareScalingLevel(q.hardwareScaling / Math.max(1, window.devicePixelRatio || 1));
    const session = this.session;
    this.env = new EnvironmentRenderer(this.scene, this.rig.camera, world.doc.environment, q);
    const env = this.env;
    this.voxels = new VoxelRenderer(this.scene, world, session.blocks, {
      shadows: env.shadows,
      excludeFromLights: [env.hemi],
      onEmissiveMesh: (m) => env.addGlowMesh(m),
    });
    this.env.onAmbient = (r, g, b, blockScale) => this.voxels?.setAmbient(r, g, b, blockScale);
    this.env.emitAmbient();
    this.voxels.buildAll();
    this.models = new ModelRenderer(this.scene, session.models, this.env.shadows);
    this.entities = new EntityViewManager(this.scene, session, this.models, this.env, 'game');
    this.entities.sync(0);
    const particles = world.doc.environment.particles;
    if (particles && q.particles > 0) {
      this.ambient = createParticles(this.scene, 'ambiance', this.rig.camera.position.clone(), {
        preset: particles.preset as ParticlePreset,
        color: '#fff2d8',
        size: [28, 10, 28],
        rate: particles.density,
        quality: q.particles,
      });
      this.ambient.minEmitBox = new Vector3(-14, -4, -14);
      this.ambient.maxEmitBox = new Vector3(14, 6, 14);
    }
    // Preload the sounds this civilization uses.
    this.audio.preload([...session.sounds.keys()]);
  }

  private clearWorld(): void {
    this.ambient?.dispose();
    this.ambient = null;
    this.colliderDebug?.dispose();
    this.colliderDebug = null;
    this.entities?.dispose();
    this.entities = null;
    this.models?.dispose();
    this.models = null;
    this.voxels?.dispose();
    this.voxels = null;
    this.env?.dispose();
    this.env = null;
    this.world = null;
  }

  private onPresentation(req: PresentationRequest): void {
    this.audio.handle(req);
    switch (req.type) {
      case 'fx':
        if (req.fx === 'shake') this.rig.shake(Number(req.params.intensity ?? 0.3), Number(req.params.seconds ?? 0.6));
        else if (req.fx === 'fov') this.rig.fovKick(Number(req.params.delta ?? 6), Number(req.params.seconds ?? 1));
        else if (req.fx === 'vignette') this.env?.pulseVignette(Number(req.params.intensity ?? 0.5));
        break;
      case 'environment':
        this.env?.transition(req.patch, req.seconds);
        break;
      case 'voxelsChanged':
        this.voxels?.markBox({ min: req.min, max: req.max }, 1);
        break;
      case 'custom': {
        const handler = this.session.viewEffects.get(req.channel);
        if (handler && this.entities) {
          try {
            handler.def.handle(this.entities.ctx, req.payload);
          } catch (err) {
            this.session.log.error(`Effet de présentation "${req.channel}"`, err);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private updateColliderDebug(): void {
    const world = this.world;
    if (!world) return;
    if (!this.showColliders) {
      if (this.colliderDebug) {
        this.colliderDebug.dispose();
        this.colliderDebug = null;
        this.colliderRevision = -1;
      }
      return;
    }
    if (world.colliders.revision === this.colliderRevision && this.colliderDebug) return;
    this.colliderRevision = world.colliders.revision;
    this.colliderDebug?.dispose();
    const lines: Vector3[][] = [];
    for (const c of world.colliders.all()) {
      if (!c.enabled) continue;
      const b = c.box;
      const P = (x: number, y: number, z: number) => new Vector3(x, y, z);
      lines.push(
        [P(b.minX, b.minY, b.minZ), P(b.maxX, b.minY, b.minZ), P(b.maxX, b.minY, b.maxZ), P(b.minX, b.minY, b.maxZ), P(b.minX, b.minY, b.minZ)],
        [P(b.minX, b.maxY, b.minZ), P(b.maxX, b.maxY, b.minZ), P(b.maxX, b.maxY, b.maxZ), P(b.minX, b.maxY, b.maxZ), P(b.minX, b.maxY, b.minZ)],
        [P(b.minX, b.minY, b.minZ), P(b.minX, b.maxY, b.minZ)],
        [P(b.maxX, b.minY, b.maxZ), P(b.maxX, b.maxY, b.maxZ)],
      );
    }
    if (lines.length === 0) return;
    this.colliderDebug = MeshBuilder.CreateLineSystem('debug-collisions', { lines }, this.scene) as LinesMesh;
    this.colliderDebug.color = new Color3(1, 0.3, 0.4);
    this.colliderDebug.isPickable = false;
  }

  /** Screen position (CSS pixels) of a world point, or null when behind the camera. */
  project(p: { x: number; y: number; z: number }): { x: number; y: number } | null {
    const cam = this.rig.camera;
    const v = new Vector3(p.x, p.y, p.z);
    const toPoint = v.subtract(cam.position);
    if (Vector3.Dot(toPoint, cam.getForwardRay(1).direction) <= 0.05) return null;
    const vp = cam.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
    const projected = Vector3.Project(v, Matrix.Identity(), this.scene.getTransformMatrix(), vp);
    const scale = (this.engine.getRenderingCanvas()?.clientWidth ?? vp.width) / vp.width;
    return { x: projected.x * scale, y: projected.y * scale };
  }

  dispose(): void {
    this.stop();
    this.opts.canvas.removeEventListener('click', this.onCanvasClick);
    window.removeEventListener('resize', this.onResize);
    this.presentationSub.dispose();
    this.keyUnsub();
    this.clearWorld();
    this.input.dispose();
    this.audio.dispose();
    this.instrumentation.dispose();
    this.scene.dispose();
    if (this.ownsEngine) this.engine.dispose();
  }
}
