/**
 * Procedural item icons (pixel-art style, drawn on a canvas). No image files.
 */
import type { IconSpec } from '@engine/core/inventory/items';
import { hexToRgb, shade, rgbToHex } from '@engine/core/util/color';

const cache = new Map<string, string>();
const S = 32;

export function iconDataUrl(spec: IconSpec): string {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const base = spec.color;
  const dark = rgbToHex(shade(hexToRgb(base), -0.4));
  const light = rgbToHex(shade(hexToRgb(base), 0.35));
  const accent = spec.accent ?? light;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  if (spec.glow) {
    const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    grad.addColorStop(0, `${base}aa`);
    grad.addColorStop(1, `${base}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  switch (spec.shape) {
    case 'key':
      px(4, 10, 10, 10, dark);
      px(6, 12, 6, 6, 'transparent');
      g.clearRect(7, 13, 4, 4);
      px(5, 11, 8, 2, base);
      px(5, 17, 8, 2, base);
      px(5, 11, 2, 8, base);
      px(11, 11, 2, 8, base);
      px(13, 14, 15, 3, base);
      px(13, 14, 15, 1, light);
      px(22, 17, 2, 4, base);
      px(26, 17, 2, 5, base);
      break;
    case 'document':
    case 'letter':
    case 'scroll':
      px(7, 4, 18, 24, base);
      px(7, 4, 18, 2, light);
      for (let y = 9; y < 25; y += 3) px(10, y, 12, 1, dark);
      if (spec.shape === 'letter') px(18, 20, 5, 5, accent);
      if (spec.shape === 'scroll') {
        px(5, 3, 22, 3, dark);
        px(5, 26, 22, 3, dark);
      }
      break;
    case 'plaque':
      px(5, 9, 22, 14, dark);
      px(6, 10, 20, 12, base);
      px(6, 10, 20, 2, light);
      px(9, 14, 14, 1, accent);
      px(9, 17, 10, 1, accent);
      px(15, 4, 2, 6, dark);
      break;
    case 'shard':
    case 'gem':
    case 'fragment': {
      g.fillStyle = base;
      g.beginPath();
      if (spec.shape === 'fragment') {
        g.moveTo(8, 6);
        g.lineTo(24, 4);
        g.lineTo(27, 18);
        g.lineTo(14, 28);
        g.lineTo(5, 17);
      } else {
        g.moveTo(16, 3);
        g.lineTo(25, 13);
        g.lineTo(16, 29);
        g.lineTo(7, 13);
      }
      g.closePath();
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.moveTo(16, 5);
      g.lineTo(21, 13);
      g.lineTo(16, 16);
      g.closePath();
      g.fill();
      g.strokeStyle = dark;
      g.lineWidth = 1;
      g.stroke();
      break;
    }
    case 'coin':
    case 'ring':
    case 'circle':
      g.fillStyle = dark;
      g.beginPath();
      g.arc(16, 16, 11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = base;
      g.beginPath();
      g.arc(16, 16, 9, 0, Math.PI * 2);
      g.fill();
      if (spec.shape === 'ring') {
        g.clearRect(12, 12, 8, 8);
      } else {
        g.fillStyle = light;
        g.fillRect(12, 10, 3, 3);
      }
      break;
    case 'gear':
    case 'dial':
      g.fillStyle = base;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(16 + Math.cos(a) * 11 - 2, 16 + Math.sin(a) * 11 - 2, 4, 4);
      }
      g.beginPath();
      g.arc(16, 16, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dark;
      g.beginPath();
      g.arc(16, 16, 4, 0, Math.PI * 2);
      g.fill();
      if (spec.shape === 'dial') px(15, 7, 2, 9, accent);
      break;
    case 'ingot':
      px(6, 14, 20, 10, dark);
      px(8, 12, 16, 10, base);
      px(8, 12, 16, 2, light);
      break;
    case 'spring':
      for (let y = 6; y < 26; y += 4) px(9, y, 14, 2, base);
      px(9, 6, 2, 20, dark);
      break;
    case 'flask':
      px(13, 4, 6, 8, dark);
      px(8, 12, 16, 15, base);
      px(10, 14, 4, 6, light);
      break;
    case 'book':
      px(7, 5, 18, 23, base);
      px(7, 5, 3, 23, dark);
      px(12, 9, 10, 2, accent);
      break;
    case 'box':
      px(6, 8, 20, 18, base);
      px(6, 8, 20, 3, light);
      px(15, 8, 2, 18, dark);
      break;
    case 'eye':
      g.fillStyle = base;
      g.beginPath();
      g.ellipse(16, 16, 13, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dark;
      g.beginPath();
      g.arc(16, 16, 4, 0, Math.PI * 2);
      g.fill();
      break;
    case 'hand':
      px(10, 12, 12, 14, base);
      for (let i = 0; i < 4; i++) px(10 + i * 3, 5 + (i === 0 || i === 3 ? 3 : 0), 2, 8, base);
      px(22, 15, 4, 3, base);
      px(14, 17, 4, 4, accent);
      break;
    case 'note':
      px(18, 5, 2, 18, base);
      g.fillStyle = base;
      g.beginPath();
      g.ellipse(15, 23, 5, 4, -0.4, 0, Math.PI * 2);
      g.fill();
      px(18, 5, 7, 3, base);
      break;
    case 'bell':
      g.fillStyle = base;
      g.beginPath();
      g.moveTo(16, 4);
      g.quadraticCurveTo(26, 8, 26, 24);
      g.lineTo(6, 24);
      g.quadraticCurveTo(6, 8, 16, 4);
      g.fill();
      px(14, 24, 4, 4, dark);
      break;
    case 'cup':
      px(8, 10, 14, 14, base);
      px(22, 13, 4, 7, dark);
      px(8, 10, 14, 2, light);
      g.clearRect(10, 10, 3, 3);
      break;
    case 'kite':
      g.fillStyle = base;
      g.beginPath();
      g.moveTo(16, 3);
      g.lineTo(26, 13);
      g.lineTo(16, 24);
      g.lineTo(6, 13);
      g.closePath();
      g.fill();
      px(16, 24, 1, 6, dark);
      px(13, 27, 3, 2, accent);
      break;
    case 'feather':
      g.fillStyle = base;
      g.beginPath();
      g.ellipse(16, 15, 5, 12, 0.6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = dark;
      g.beginPath();
      g.moveTo(8, 26);
      g.lineTo(23, 5);
      g.stroke();
      break;
    case 'star':
      g.fillStyle = base;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 5 : 12;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      break;
    case 'hammer':
      // Handle (accent) and a heavy head.
      g.save();
      g.translate(16, 16);
      g.rotate(-Math.PI / 4);
      px(-2, -4, 4, 18, accent);
      px(-2, -4, 1, 18, rgbToHex(shade(hexToRgb(accent), 0.25)));
      px(-9, -12, 18, 8, base);
      px(-9, -12, 18, 2, light);
      px(-9, -6, 18, 2, dark);
      g.restore();
      break;
    case 'wrench':
      g.save();
      g.translate(16, 16);
      g.rotate(-Math.PI / 4);
      px(-2, -6, 4, 18, base);
      px(-2, -6, 1, 18, light);
      px(-6, -13, 12, 6, base);
      g.clearRect(-2, -13, 4, 4);
      px(-2, 12, 4, 3, dark);
      g.restore();
      break;
    case 'mask':
      g.fillStyle = base;
      g.beginPath();
      g.moveTo(5, 10);
      g.quadraticCurveTo(16, 4, 27, 10);
      g.lineTo(26, 18);
      g.quadraticCurveTo(21, 26, 16, 22);
      g.quadraticCurveTo(11, 26, 6, 18);
      g.closePath();
      g.fill();
      px(5, 10, 22, 2, light);
      g.clearRect(9, 13, 5, 3);
      g.clearRect(18, 13, 5, 3);
      px(15, 16, 2, 4, dark);
      px(8, 20, 2, 2, accent);
      px(22, 19, 2, 2, accent);
      break;
    case 'glove':
      px(9, 12, 14, 14, base);
      for (let i = 0; i < 4; i++) px(9 + i * 3.5, 5 + (i === 0 || i === 3 ? 3 : 0), 3, 8, base);
      px(5, 15, 5, 4, base);
      px(9, 24, 14, 3, accent);
      px(9, 12, 14, 1, light);
      break;
    case 'shield':
      g.fillStyle = base;
      g.beginPath();
      g.moveTo(6, 6);
      g.lineTo(26, 6);
      g.lineTo(25, 18);
      g.quadraticCurveTo(16, 28, 16, 28);
      g.quadraticCurveTo(7, 22, 7, 18);
      g.closePath();
      g.fill();
      px(6, 6, 20, 2, light);
      px(15, 8, 2, 18, accent);
      px(8, 13, 16, 2, accent);
      break;
    case 'lens':
      g.strokeStyle = dark;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(14, 14, 8, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = `${base}cc`;
      g.beginPath();
      g.arc(14, 14, 6.5, 0, Math.PI * 2);
      g.fill();
      px(10, 10, 3, 2, '#ffffff');
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(20, 20);
      g.lineTo(27, 27);
      g.stroke();
      break;
    case 'seal':
      px(12, 4, 8, 12, accent);
      px(12, 4, 8, 2, light);
      g.fillStyle = base;
      g.beginPath();
      g.arc(16, 21, 8, 0, Math.PI * 2);
      g.fill();
      px(12, 19, 8, 1, dark);
      px(15, 17, 2, 8, dark);
      break;
    case 'bracelet':
      g.strokeStyle = base;
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(16, 17, 10, 7, 0, 0, Math.PI * 2);
      g.stroke();
      px(13, 7, 6, 6, accent);
      px(14, 8, 4, 4, light);
      break;
    case 'wheel':
      g.strokeStyle = base;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(16, 16, 11, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.beginPath();
        g.moveTo(16, 16);
        g.lineTo(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10);
        g.stroke();
      }
      px(13, 13, 6, 6, dark);
      break;
  }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
