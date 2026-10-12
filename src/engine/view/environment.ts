/**
 * Scene environment: sky dome, sun & shadows, hemispheric fill light, fog, post-processing,
 * glow, and smooth transitions when the story changes the atmosphere.
 */
import {
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  Effect,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  ShadowGenerator,
  Vector3,
  type Camera,
  type Mesh,
  type AbstractMesh,
} from '@babylonjs/core';
import type { EnvironmentDoc } from '../core/content/schemas';
import { hexToRgb, mixRgb, type RGB } from '../core/util/color';
import type { QualityProfile } from './quality';

Effect.ShadersStore['civSkyVertexShader'] = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

Effect.ShadersStore['civSkyFragmentShader'] = `
precision highp float;
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 bottomColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 discColor;
uniform float stars;
uniform float sunDisc;
uniform float time;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main(void) {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizonColor, bottomColor, pow(clamp(-h, 0.0, 1.0), 0.4));
  float sd = max(dot(d, -sunDir), 0.0);
  col += sunColor * (pow(sd, 24.0) * 0.28 + pow(sd, 6.0) * 0.08) * sunDisc;
  col = mix(col, discColor, smoothstep(0.9993, 0.9997, sd) * sunDisc);
  if (stars > 0.0 && h > 0.02) {
    vec3 cell = floor(d * 260.0);
    float s = hash(cell);
    float tw = 0.65 + 0.35 * sin(time * 2.0 + s * 40.0);
    col += vec3(smoothstep(0.9965, 1.0, s)) * stars * tw * smoothstep(0.02, 0.25, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

interface EnvState {
  top: RGB;
  horizon: RGB;
  bottom: RGB;
  stars: number;
  sunDisc: number;
  disc: RGB;
  sunDir: [number, number, number];
  sunColor: RGB;
  sunIntensity: number;
  ambient: RGB;
  ambientIntensity: number;
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;
  fog: RGB;
  fogDensity: number;
  blockLight: number;
  exposure: number;
  contrast: number;
  saturation: number;
  bloom: number;
  vignette: number;
}

function stateFrom(env: EnvironmentDoc): EnvState {
  return {
    top: hexToRgb(env.sky.top),
    horizon: hexToRgb(env.sky.horizon),
    bottom: hexToRgb(env.sky.bottom),
    stars: env.sky.stars,
    sunDisc: env.sky.sunDisc ? 1 : 0,
    disc: hexToRgb(env.sky.discColor ?? env.sun.color),
    sunDir: [...env.sun.direction] as [number, number, number],
    sunColor: hexToRgb(env.sun.color),
    sunIntensity: env.sun.intensity,
    ambient: hexToRgb(env.ambient.color),
    ambientIntensity: env.ambient.intensity,
    hemiSky: hexToRgb(env.hemi.sky),
    hemiGround: hexToRgb(env.hemi.ground),
    hemiIntensity: env.hemi.intensity,
    fog: hexToRgb(env.fog.color),
    fogDensity: env.fog.density,
    blockLight: env.blockLight,
    exposure: env.post.exposure,
    contrast: env.post.contrast,
    saturation: env.post.saturation,
    bloom: env.post.bloom,
    vignette: env.post.vignette,
  };
}

function lerpState(a: EnvState, b: EnvState, t: number): EnvState {
  const n = (x: number, y: number) => x + (y - x) * t;
  const c = (x: RGB, y: RGB) => mixRgb(x, y, t);
  return {
    top: c(a.top, b.top),
    horizon: c(a.horizon, b.horizon),
    bottom: c(a.bottom, b.bottom),
    stars: n(a.stars, b.stars),
    sunDisc: n(a.sunDisc, b.sunDisc),
    disc: c(a.disc, b.disc),
    sunDir: [n(a.sunDir[0], b.sunDir[0]), n(a.sunDir[1], b.sunDir[1]), n(a.sunDir[2], b.sunDir[2])],
    sunColor: c(a.sunColor, b.sunColor),
    sunIntensity: n(a.sunIntensity, b.sunIntensity),
    ambient: c(a.ambient, b.ambient),
    ambientIntensity: n(a.ambientIntensity, b.ambientIntensity),
    hemiSky: c(a.hemiSky, b.hemiSky),
    hemiGround: c(a.hemiGround, b.hemiGround),
    hemiIntensity: n(a.hemiIntensity, b.hemiIntensity),
    fog: c(a.fog, b.fog),
    fogDensity: n(a.fogDensity, b.fogDensity),
    blockLight: n(a.blockLight, b.blockLight),
    exposure: n(a.exposure, b.exposure),
    contrast: n(a.contrast, b.contrast),
    saturation: n(a.saturation, b.saturation),
    bloom: n(a.bloom, b.bloom),
    vignette: n(a.vignette, b.vignette),
  };
}

/** Applies a partial environment patch (same shape as EnvironmentDoc) to a state. */
function patchState(base: EnvState, patch: Record<string, unknown>): EnvState {
  const out = { ...base };
  const rgb = (v: unknown, fb: RGB) => (typeof v === 'string' ? hexToRgb(v) : fb);
  const num = (v: unknown, fb: number) => (typeof v === 'number' ? v : fb);
  const sky = patch.sky as Record<string, unknown> | undefined;
  if (sky) {
    out.top = rgb(sky.top, out.top);
    out.horizon = rgb(sky.horizon, out.horizon);
    out.bottom = rgb(sky.bottom, out.bottom);
    out.stars = num(sky.stars, out.stars);
    if (typeof sky.sunDisc === 'boolean') out.sunDisc = sky.sunDisc ? 1 : 0;
    out.disc = rgb(sky.discColor, out.disc);
  }
  const sun = patch.sun as Record<string, unknown> | undefined;
  if (sun) {
    if (Array.isArray(sun.direction)) out.sunDir = sun.direction as [number, number, number];
    out.sunColor = rgb(sun.color, out.sunColor);
    out.sunIntensity = num(sun.intensity, out.sunIntensity);
  }
  const amb = patch.ambient as Record<string, unknown> | undefined;
  if (amb) {
    out.ambient = rgb(amb.color, out.ambient);
    out.ambientIntensity = num(amb.intensity, out.ambientIntensity);
  }
  const hemi = patch.hemi as Record<string, unknown> | undefined;
  if (hemi) {
    out.hemiSky = rgb(hemi.sky, out.hemiSky);
    out.hemiGround = rgb(hemi.ground, out.hemiGround);
    out.hemiIntensity = num(hemi.intensity, out.hemiIntensity);
  }
  const fog = patch.fog as Record<string, unknown> | undefined;
  if (fog) {
    out.fog = rgb(fog.color, out.fog);
    out.fogDensity = num(fog.density, out.fogDensity);
  }
  out.blockLight = num(patch.blockLight, out.blockLight);
  const post = patch.post as Record<string, unknown> | undefined;
  if (post) {
    out.exposure = num(post.exposure, out.exposure);
    out.contrast = num(post.contrast, out.contrast);
    out.saturation = num(post.saturation, out.saturation);
    out.bloom = num(post.bloom, out.bloom);
    out.vignette = num(post.vignette, out.vignette);
  }
  return out;
}

const c3 = (c: RGB, k = 1) => new Color3(c.r * k, c.g * k, c.b * k);

export class EnvironmentRenderer {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphericLight;
  readonly shadows: ShadowGenerator | null;
  readonly glow: GlowLayer | null;
  readonly pipeline: DefaultRenderingPipeline | null;
  private sky: Mesh;
  private skyMat: ShaderMaterial;
  private state: EnvState;
  private from: EnvState | null = null;
  private to: EnvState | null = null;
  private tTotal = 0;
  private tElapsed = 0;
  private time = 0;
  private vignetteBoost = 0;
  /** Called when ambient values change (voxel materials). */
  onAmbient: ((r: number, g: number, b: number, blockScale: number) => void) | null = null;

  constructor(
    private readonly scene: Scene,
    camera: Camera,
    env: EnvironmentDoc,
    readonly quality: QualityProfile,
  ) {
    this.state = stateFrom(env);
    scene.clearColor = new Color4(0, 0, 0, 1);
    scene.ambientColor = new Color3(0, 0, 0);
    scene.fogMode = Scene.FOGMODE_EXP2;

    this.sun = new DirectionalLight('soleil', new Vector3(-0.4, -1, -0.3), scene);
    this.sun.position = new Vector3(60, 120, 60);
    this.hemi = new HemisphericLight('ciel', new Vector3(0, 1, 0), scene);
    this.hemi.specular = new Color3(0, 0, 0);

    if (quality.shadowMapSize > 0) {
      const sg = new ShadowGenerator(quality.shadowMapSize, this.sun);
      sg.usePercentageCloserFiltering = quality.shadowFilter === 'pcf';
      sg.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      sg.bias = 0.0008;
      sg.normalBias = 0.02;
      sg.darkness = 0.15;
      this.sun.autoUpdateExtends = true;
      this.sun.autoCalcShadowZBounds = true;
      this.shadows = sg;
    } else this.shadows = null;

    this.sky = MeshBuilder.CreateSphere('ciel-dôme', { diameter: 1600, segments: 24, sideOrientation: 1 }, scene);
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;
    this.sky.applyFog = false;
    this.skyMat = new ShaderMaterial(
      'ciel-matière',
      scene,
      { vertex: 'civSky', fragment: 'civSky' },
      {
        attributes: ['position'],
        uniforms: ['worldViewProjection', 'topColor', 'horizonColor', 'bottomColor', 'sunDir', 'sunColor', 'discColor', 'stars', 'sunDisc', 'time'],
      },
    );
    this.skyMat.backFaceCulling = false;
    this.skyMat.disableDepthWrite = true;
    this.sky.material = this.skyMat;
    this.sky.renderingGroupId = 0;

    this.glow = quality.glow ? new GlowLayer('lueur', scene, { blurKernelSize: 48, mainTextureRatio: 0.5 }) : null;
    if (this.glow) this.glow.intensity = 0.65;

    if (quality.postProcess) {
      const p = new DefaultRenderingPipeline('rendu', true, scene, [camera]);
      p.samples = quality.msaa;
      p.fxaaEnabled = quality.fxaa;
      p.bloomEnabled = quality.bloom;
      p.bloomThreshold = 0.78;
      p.bloomKernel = 64;
      p.bloomScale = 0.5;
      p.imageProcessingEnabled = true;
      p.imageProcessing.toneMappingEnabled = true;
      p.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      p.imageProcessing.vignetteEnabled = true;
      p.imageProcessing.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
      p.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
      this.pipeline = p;
    } else {
      this.pipeline = null;
      scene.imageProcessingConfiguration.toneMappingEnabled = true;
      scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    }
    this.apply(this.state);
  }

  /** Replaces the environment instantly (scene load, editor changes). */
  set(env: EnvironmentDoc): void {
    this.from = null;
    this.to = null;
    this.state = stateFrom(env);
    this.apply(this.state);
  }

  /** Smoothly transitions toward a patched environment. */
  transition(patch: Record<string, unknown>, seconds: number): void {
    const target = patchState(this.to ?? this.state, patch);
    if (seconds <= 0) {
      this.state = target;
      this.from = this.to = null;
      this.apply(target);
      return;
    }
    this.from = { ...this.state };
    this.to = target;
    this.tTotal = seconds;
    this.tElapsed = 0;
  }

  /** Temporary extra vignette (effects). */
  pulseVignette(amount: number): void {
    this.vignetteBoost = Math.max(this.vignetteBoost, amount);
  }

  addGlowMesh(mesh: AbstractMesh): void {
    this.glow?.addIncludedOnlyMesh(mesh as Mesh);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.from && this.to) {
      this.tElapsed += dt;
      const t = Math.min(1, this.tElapsed / this.tTotal);
      const e = t * t * (3 - 2 * t);
      this.state = lerpState(this.from, this.to, e);
      if (t >= 1) {
        this.from = null;
        this.to = null;
      }
      this.apply(this.state);
    }
    this.vignetteBoost = Math.max(0, this.vignetteBoost - dt * 0.6);
    if (this.pipeline) this.pipeline.imageProcessing.vignetteWeight = 1.2 + (this.state.vignette + this.vignetteBoost) * 6;
    this.skyMat.setFloat('time', this.time);
  }

  private apply(s: EnvState): void {
    const sc = this.scene;
    this.skyMat.setColor3('topColor', c3(s.top));
    this.skyMat.setColor3('horizonColor', c3(s.horizon));
    this.skyMat.setColor3('bottomColor', c3(s.bottom));
    this.skyMat.setColor3('sunColor', c3(s.sunColor));
    this.skyMat.setColor3('discColor', c3(s.disc, 1.6));
    this.skyMat.setFloat('stars', s.stars);
    this.skyMat.setFloat('sunDisc', s.sunDisc);
    const dir = new Vector3(s.sunDir[0], s.sunDir[1], s.sunDir[2]).normalize();
    this.skyMat.setVector3('sunDir', dir);
    this.sun.direction = dir;
    this.sun.position = dir.scale(-150);
    this.sun.diffuse = c3(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    this.hemi.diffuse = c3(s.hemiSky);
    this.hemi.groundColor = c3(s.hemiGround);
    this.hemi.intensity = s.hemiIntensity;
    sc.fogColor = c3(s.fog);
    sc.fogDensity = s.fogDensity;
    const amb = c3(s.ambient, s.ambientIntensity);
    this.onAmbient?.(amb.r, amb.g, amb.b, s.blockLight);
    const ip = this.pipeline?.imageProcessing ?? sc.imageProcessingConfiguration;
    ip.exposure = s.exposure;
    ip.contrast = s.contrast;
    if (this.pipeline) {
      this.pipeline.bloomWeight = s.bloom;
      this.pipeline.imageProcessing.colorCurvesEnabled = s.saturation !== 1;
      if (this.pipeline.imageProcessing.colorCurves) this.pipeline.imageProcessing.colorCurves.globalSaturation = (s.saturation - 1) * 100;
    }
  }

  /** Current ambient for late subscribers. */
  emitAmbient(): void {
    const amb = c3(this.state.ambient, this.state.ambientIntensity);
    this.onAmbient?.(amb.r, amb.g, amb.b, this.state.blockLight);
  }

  get fogColor(): RGB {
    return this.state.fog;
  }

  dispose(): void {
    this.pipeline?.dispose();
    this.glow?.dispose();
    this.shadows?.dispose();
    this.sky.dispose();
    this.skyMat.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}
