/**
 * Conversion between scene voxel documents and runtime volumes.
 */
import type { VoxelDataDoc } from '../content/schemas';
import { VoxelVolume } from '../voxel/volume';
import { VOXEL_ENCODING, decodeRle, encodeRle } from '../voxel/codec';
import { AIR_ID } from '../voxel/blocks';

export function volumeFromDoc(doc: VoxelDataDoc): VoxelVolume {
  const [sx, sy, sz] = doc.size;
  if (doc.encoding !== VOXEL_ENCODING) throw new Error(`Encodage voxel inconnu : ${doc.encoding}`);
  const palette = doc.palette.length > 0 && doc.palette[0] === AIR_ID ? doc.palette : [AIR_ID, ...doc.palette];
  const data = decodeRle(doc.data, sx * sy * sz);
  const max = palette.length - 1;
  for (let i = 0; i < data.length; i++) {
    if (data[i]! > max) throw new Error(`Index de palette ${data[i]} hors limites (palette de ${palette.length}).`);
  }
  return new VoxelVolume(sx, sy, sz, data, palette);
}

export function volumeToDoc(volume: VoxelVolume, compact = true): VoxelDataDoc {
  const v = compact ? volume.clone() : volume;
  if (compact) v.compactPalette();
  return {
    size: [v.sizeX, v.sizeY, v.sizeZ],
    palette: [...v.palette],
    encoding: VOXEL_ENCODING,
    data: encodeRle(v.data),
  };
}

export function emptyVoxelDoc(sx: number, sy: number, sz: number): VoxelDataDoc {
  return volumeToDoc(new VoxelVolume(sx, sy, sz));
}
