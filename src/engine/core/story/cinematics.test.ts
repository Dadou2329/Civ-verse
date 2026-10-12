import { describe, expect, it } from 'vitest';
import type { CinematicDoc } from '../content/schemas';
import { cameraKeyFov, evaluateCameraTrack, sortedTracks } from './cinematics';

const key = (t: number, x: number, fov?: number) => ({ t, position: [x, 2, 0] as [number, number, number], target: [x, 2, 5] as [number, number, number], ...(fov === undefined ? {} : { fov }) });

function cinematic(keys: ReturnType<typeof key>[]): CinematicDoc {
  return { format: 'civverse.cinematic', version: 1, id: 'test', duration: 10, tracks: [{ type: 'camera', keys }] } as unknown as CinematicDoc;
}

describe('cinematic camera', () => {
  it('a key without a field of view keeps the last one set before it (70° at first)', () => {
    const keys = [key(0, 0), key(2, 1, 50), key(4, 2), key(6, 3, 80)];
    expect([0, 1, 2, 3].map((i) => cameraKeyFov(keys, i))).toEqual([70, 50, 50, 80]);
    const doc = cinematic(keys);
    expect(evaluateCameraTrack(doc, 4, () => null)?.fov).toBe(50);
    // Between a key at 50° (inherited) and one at 80°, the field of view is interpolated.
    const mid = evaluateCameraTrack(doc, 5, () => null)!.fov;
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(80);
  });

  it('keys stored out of time order play in time order', () => {
    const doc = sortedTracks(cinematic([key(4, 2), key(0, 0, 40)]));
    const keys = (doc.tracks[0] as { keys: { t: number }[] }).keys;
    expect(keys.map((k) => k.t)).toEqual([0, 4]);
    expect(evaluateCameraTrack(doc, 4, () => null)?.fov).toBe(40);
    expect(evaluateCameraTrack(doc, 4, () => null)?.position.x).toBe(2);
  });
});
