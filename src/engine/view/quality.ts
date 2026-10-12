/**
 * Graphics quality presets (Paramètres → Graphismes).
 */
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityProfile {
  shadowMapSize: number;
  shadowFilter: 'none' | 'pcf';
  postProcess: boolean;
  bloom: boolean;
  msaa: number;
  fxaa: boolean;
  glow: boolean;
  /** Ambient particle multiplier. */
  particles: number;
  /** Hardware scaling level (1 = native resolution, 1.5 = 66 %). */
  hardwareScaling: number;
  viewDistance: number;
}

export const QUALITY: Record<QualityLevel, QualityProfile> = {
  low: { shadowMapSize: 0, shadowFilter: 'none', postProcess: false, bloom: false, msaa: 1, fxaa: true, glow: false, particles: 0.3, hardwareScaling: 1.5, viewDistance: 120 },
  medium: { shadowMapSize: 2048, shadowFilter: 'pcf', postProcess: true, bloom: true, msaa: 1, fxaa: true, glow: true, particles: 0.7, hardwareScaling: 1, viewDistance: 200 },
  high: { shadowMapSize: 4096, shadowFilter: 'pcf', postProcess: true, bloom: true, msaa: 4, fxaa: false, glow: true, particles: 1, hardwareScaling: 1, viewDistance: 300 },
  ultra: { shadowMapSize: 4096, shadowFilter: 'pcf', postProcess: true, bloom: true, msaa: 4, fxaa: true, glow: true, particles: 1.4, hardwareScaling: 0.85, viewDistance: 400 },
};
