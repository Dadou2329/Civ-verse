/**
 * Voxel data codec: run-length encoding of palette indices with LEB128 varints, stored as base64.
 * Format id "rle16-b64". Worlds of ~1.6 M cells typically encode to 30–200 KB.
 */
export const VOXEL_ENCODING = 'rle16-b64';

export function encodeRle(data: Uint16Array): string {
  const bytes: number[] = [];
  const pushVarint = (v: number) => {
    while (v >= 0x80) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v);
  };
  let i = 0;
  while (i < data.length) {
    const value = data[i]!;
    let run = 1;
    while (i + run < data.length && data[i + run] === value) run++;
    pushVarint(run);
    pushVarint(value);
    i += run;
  }
  return bytesToBase64(Uint8Array.from(bytes));
}

export function decodeRle(encoded: string, length: number): Uint16Array {
  const bytes = base64ToBytes(encoded);
  const out = new Uint16Array(length);
  let p = 0;
  let o = 0;
  const readVarint = () => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (p >= bytes.length) throw new Error('Données voxel tronquées.');
      const b = bytes[p++]!;
      result += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) return result;
      shift += 7;
      if (shift > 35) throw new Error('Varint voxel invalide.');
    }
  };
  while (p < bytes.length) {
    const run = readVarint();
    const value = readVarint();
    if (value > 0xffff) throw new Error('Index de palette voxel hors limites.');
    if (o + run > length) throw new Error('Données voxel plus longues que le volume.');
    out.fill(value, o, o + run);
    o += run;
  }
  if (o !== length) throw new Error(`Données voxel incomplètes (${o}/${length} cellules).`);
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + '==';
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)]!;
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)]!;
    const c = i + 2 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 2)]! : 0;
    const d = i + 3 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 3)]! : 0;
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Base64 invalide.');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len && i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (o < len && i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}
