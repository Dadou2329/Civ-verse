/**
 * Particle presets (ambient atmosphere around the camera and core.particles entities).
 * The particle texture is generated procedurally (soft dot), no image file needed.
 */
import { Color4, Constants, ParticleSystem, RawTexture, Vector3, type Scene, type Texture } from '@babylonjs/core';
import { hexToRgb } from '../core/util/color';

let dotTexture: { scene: Scene; tex: RawTexture } | null = null;

function softDot(scene: Scene): Texture {
  if (dotTexture && dotTexture.scene === scene && !dotTexture.scene.isDisposed && dotTexture.tex.getInternalTexture()) return dotTexture.tex;
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(Math.pow(a, 1.8) * 255);
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, size, size, scene, true, false, Constants.TEXTURE_TRILINEAR_SAMPLINGMODE);
  tex.hasAlpha = true;
  dotTexture = { scene, tex };
  return tex;
}

export type ParticlePreset = 'dust' | 'embers' | 'motes' | 'smoke' | 'sparks' | 'memory' | 'stars' | 'rain';

export interface ParticleOptions {
  preset: ParticlePreset;
  color: string;
  /** Emission box size (m). */
  size: [number, number, number];
  rate: number;
  /** Global quality multiplier. */
  quality: number;
}

const c4 = (hex: string, a: number, k = 1) => {
  const c = hexToRgb(hex);
  return new Color4(c.r * k, c.g * k, c.b * k, a);
};

export function createParticles(scene: Scene, name: string, emitter: Vector3, opts: ParticleOptions): ParticleSystem {
  // Rain needs many short-lived streaks to read as rain.
  const capacity = Math.max(8, Math.round((opts.preset === 'rain' ? 1600 : 400) * opts.quality));
  const ps = new ParticleSystem(name, capacity, scene);
  ps.particleTexture = softDot(scene);
  ps.emitter = emitter;
  const [sx, sy, sz] = opts.size;
  ps.minEmitBox = new Vector3(-sx / 2, 0, -sz / 2);
  ps.maxEmitBox = new Vector3(sx / 2, sy, sz / 2);
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.gravity = new Vector3(0, 0, 0);
  const base = opts.color;
  const rate = opts.rate * opts.quality;
  switch (opts.preset) {
    case 'dust':
      ps.color1 = c4(base, 0.35);
      ps.color2 = c4(base, 0.2, 0.8);
      ps.colorDead = c4(base, 0);
      ps.minSize = 0.03;
      ps.maxSize = 0.07;
      ps.minLifeTime = 6;
      ps.maxLifeTime = 12;
      ps.emitRate = 14 * rate;
      ps.direction1 = new Vector3(-0.05, -0.02, -0.05);
      ps.direction2 = new Vector3(0.05, 0.04, 0.05);
      ps.minEmitPower = 0.1;
      ps.maxEmitPower = 0.25;
      break;
    case 'embers':
      ps.color1 = c4(base, 1, 1.4);
      ps.color2 = c4('#ff5a1a', 0.9, 1.2);
      ps.colorDead = c4('#ff5a1a', 0);
      ps.minSize = 0.03;
      ps.maxSize = 0.08;
      ps.minLifeTime = 1.5;
      ps.maxLifeTime = 3.5;
      ps.emitRate = 20 * rate;
      ps.direction1 = new Vector3(-0.2, 1, -0.2);
      ps.direction2 = new Vector3(0.2, 1.6, 0.2);
      ps.minEmitPower = 0.4;
      ps.maxEmitPower = 0.9;
      break;
    case 'motes':
      ps.color1 = c4(base, 0.9, 1.5);
      ps.color2 = c4(base, 0.5, 1.2);
      ps.colorDead = c4(base, 0);
      ps.minSize = 0.05;
      ps.maxSize = 0.12;
      ps.minLifeTime = 4;
      ps.maxLifeTime = 8;
      ps.emitRate = 6 * rate;
      ps.direction1 = new Vector3(-0.2, -0.1, -0.2);
      ps.direction2 = new Vector3(0.2, 0.2, 0.2);
      ps.minEmitPower = 0.1;
      ps.maxEmitPower = 0.3;
      break;
    case 'memory':
      ps.color1 = c4(base, 0.95, 1.6);
      ps.color2 = c4('#b98aff', 0.8, 1.4);
      ps.colorDead = c4(base, 0);
      ps.minSize = 0.04;
      ps.maxSize = 0.14;
      ps.minLifeTime = 5;
      ps.maxLifeTime = 10;
      ps.emitRate = 10 * rate;
      ps.direction1 = new Vector3(-0.1, 0.15, -0.1);
      ps.direction2 = new Vector3(0.1, 0.45, 0.1);
      ps.minEmitPower = 0.1;
      ps.maxEmitPower = 0.35;
      ps.minAngularSpeed = -1;
      ps.maxAngularSpeed = 1;
      break;
    case 'stars':
      ps.color1 = c4(base, 1, 2);
      ps.color2 = c4('#ffffff', 0.7, 1.5);
      ps.colorDead = c4(base, 0);
      ps.minSize = 0.02;
      ps.maxSize = 0.06;
      ps.minLifeTime = 1;
      ps.maxLifeTime = 3;
      ps.emitRate = 30 * rate;
      ps.direction1 = new Vector3(0, 0, 0);
      ps.direction2 = new Vector3(0, 0.05, 0);
      ps.minEmitPower = 0;
      ps.maxEmitPower = 0.05;
      break;
    case 'smoke':
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.color1 = c4(base, 0.25);
      ps.color2 = c4(base, 0.15, 0.8);
      ps.colorDead = c4(base, 0);
      ps.minSize = 0.4;
      ps.maxSize = 1.2;
      ps.minLifeTime = 3;
      ps.maxLifeTime = 6;
      ps.emitRate = 8 * rate;
      ps.direction1 = new Vector3(-0.1, 0.6, -0.1);
      ps.direction2 = new Vector3(0.1, 1, 0.1);
      ps.minEmitPower = 0.2;
      ps.maxEmitPower = 0.5;
      break;
    case 'sparks':
      ps.color1 = c4(base, 1, 1.8);
      ps.color2 = c4('#ffffff', 1, 1.5);
      ps.colorDead = c4(base, 0);
      ps.minSize = 0.02;
      ps.maxSize = 0.05;
      ps.minLifeTime = 0.3;
      ps.maxLifeTime = 0.8;
      ps.emitRate = 40 * rate;
      ps.direction1 = new Vector3(-1, 1, -1);
      ps.direction2 = new Vector3(1, 2, 1);
      ps.minEmitPower = 1;
      ps.maxEmitPower = 3;
      ps.gravity = new Vector3(0, -6, 0);
      break;
    case 'rain': {
      // Light streaks falling from the top of the box (stretched along their motion).
      ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
      ps.minEmitBox = new Vector3(-sx / 2, sy, -sz / 2);
      ps.maxEmitBox = new Vector3(sx / 2, sy, sz / 2);
      ps.color1 = c4(base, 0.6, 1.1);
      ps.color2 = c4(base, 0.45);
      ps.colorDead = c4(base, 0.2);
      ps.minSize = 0.3;
      ps.maxSize = 0.4;
      ps.minScaleX = 0.13;
      ps.maxScaleX = 0.17;
      ps.minScaleY = 3.2;
      ps.maxScaleY = 4.2;
      const fall = 11;
      ps.minLifeTime = Math.max(0.2, sy / fall);
      ps.maxLifeTime = Math.max(0.2, sy / fall);
      ps.emitRate = 900 * rate;
      ps.direction1 = new Vector3(0.04, -1, 0.02);
      ps.direction2 = new Vector3(0.1, -1, 0.06);
      ps.minEmitPower = fall * 0.95;
      ps.maxEmitPower = fall * 1.05;
      break;
    }
  }
  ps.start();
  return ps;
}
