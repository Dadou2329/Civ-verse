export type EasingName =
  | 'linear'
  | 'inSine'
  | 'outSine'
  | 'inOutSine'
  | 'inQuad'
  | 'outQuad'
  | 'inOutQuad'
  | 'inCubic'
  | 'outCubic'
  | 'inOutCubic'
  | 'outBack'
  | 'step';

export const EASING_NAMES: readonly EasingName[] = [
  'linear',
  'inSine',
  'outSine',
  'inOutSine',
  'inQuad',
  'outQuad',
  'inOutQuad',
  'inCubic',
  'outCubic',
  'inOutCubic',
  'outBack',
  'step',
];

export function ease(name: EasingName | undefined, t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  switch (name ?? 'inOutSine') {
    case 'linear':
      return x;
    case 'inSine':
      return 1 - Math.cos((x * Math.PI) / 2);
    case 'outSine':
      return Math.sin((x * Math.PI) / 2);
    case 'inOutSine':
      return -(Math.cos(Math.PI * x) - 1) / 2;
    case 'inQuad':
      return x * x;
    case 'outQuad':
      return 1 - (1 - x) * (1 - x);
    case 'inOutQuad':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'inCubic':
      return x * x * x;
    case 'outCubic':
      return 1 - Math.pow(1 - x, 3);
    case 'inOutCubic':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'outBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    case 'step':
      return x < 1 ? 0 : 1;
  }
}
