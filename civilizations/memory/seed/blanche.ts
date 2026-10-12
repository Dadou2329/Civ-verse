/**
 * Seed of the scene "chambre_blanche": a minimal mental interior. It is visited twice:
 *  - Act III, through the resonance lamp: the echo of Silas's sale is reconstructed there (M03);
 *  - the denouement, after touching the initial shard: door silhouettes, a voice, the Rémanence.
 * Story state decides what is shown (core.conditional), so one small room serves both scenes.
 */
import { SceneBuilder, fillBox, clearBox, light, zone, type SceneDoc, type EnvironmentDoc } from '@sdk/build';
import { W, at } from './layout.ts';

export const BLANCHE_ENV: EnvironmentDoc = {
  sky: { top: '#f3f1f8', horizon: '#ffffff', bottom: '#e6e2ee', stars: 0, sunDisc: false },
  sun: { direction: [0.3, -1, 0.25], color: '#ffffff', intensity: 0.55 },
  ambient: { color: '#f2f0fa', intensity: 0.95 },
  hemi: { sky: '#ffffff', ground: '#d6cfe4', intensity: 0.7 },
  fog: { color: '#f5f3fa', density: 0.05 },
  blockLight: 1.0,
  particles: { preset: 'memory', density: 0.2 },
  music: 'memory:music.blanche',
  ambience: 'memory:amb_white',
  post: { exposure: 1.04, contrast: 0.94, saturation: 0.8, bloom: 0.45, vignette: 0.22 },
};

const VISION = { type: 'core.var', var: 'memory.sujetZero', op: '==', value: true };
const NOT_VISION = { type: 'core.var', var: 'memory.sujetZero', op: '!=', value: true };

export function buildBlanche(): SceneDoc {
  const [sx, sy, sz] = W.size;
  const s = new SceneBuilder('chambre_blanche', 'memory.scene.blanche', W.size, BLANCHE_ENV);
  const v = s.volume;
  const y = W.floor;
  // A white floor and far white walls that dissolve in the fog: no edges, no ceiling.
  fillBox(v, [0, 0, 0], [sx - 1, y - 1, sz - 1], 'memory:white');
  fillBox(v, [0, y, 0], [sx - 1, sy - 1, sz - 1], 'memory:white');
  clearBox(v, [1, y, 1], [sx - 2, sy - 1, sz - 2]);
  // A ring of light around the place where memories are replayed.
  const [cx, , cz] = W.center;
  for (let x = 0; x < sx; x++)
    for (let z = 0; z < sz; z++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d > 5.6 && d < 6.5) v.set(x, y - 1, z, 'memory:white_glow');
    }

  s.entity('spawn_blanche', W.spawn, { 'core.spawn': { isDefault: true } }, { yaw: 0 });
  s.entity('spawn_vision', at(15, y, 11), { 'core.spawn': {} }, { yaw: 0 });
  light(s, 'lumiere_centre', [cx, y + 3, cz], '#fff6ea', 12);

  s.inFolder('Acte III — reconstitution', () => {
    // The way back: the same lamp, seen from inside.
    s.entity('retour_atelier', W.returnPortal, {
      'core.model': { model: 'memory:resonance_lamp' },
      'core.portal': {
        scene: 'reminence',
        spawn: 'spawn_atelier',
        mode: 'interact',
        prompt: 'memory.prompt.wake',
        condition: { type: 'core.var', var: 'memory.whiteRoomSeen', op: '==', value: true },
        unavailable: 'memory.prompt.wake.wait',
        size: [1, 2.2, 1],
      },
      'core.conditional': { states: [{ when: NOT_VISION, visible: 'show' }], otherwise: 'hide' },
    });
  });

  s.inFolder('Dénouement — vision', () => {
    const doorTexts = ['memory.vision.door.1', 'memory.vision.door.2', 'memory.vision.door.3', 'memory.vision.door.4', 'memory.vision.door.5'];
    W.doors.forEach(([x, dy, z, yaw], i) => {
      s.entity(
        `porte_fantome_${i + 1}`,
        [x + 0.5, dy, z + 0.5],
        {
          'core.model': { model: 'memory:door_ghost' },
          'core.interactable': {
            prompt: 'memory.prompt.observeDoor',
            actions: [{ type: 'core.notify', text: doorTexts[i]!, kind: 'memory' }],
            size: [1.2, 2.2, 0.6],
            offset: [0, 1, 0],
          },
          'core.conditional': { states: [{ when: VISION, visible: 'show' }], otherwise: 'hide' },
        },
        { yaw },
      );
    });
    // Only if the Door civilization was completed: the threshold motif, faintly.
    const [tx, ty, tz, tyaw] = W.thresholdDoor;
    s.entity(
      'porte_seuil',
      [tx, ty, tz],
      {
        'core.model': { model: 'memory:door_ghost_seuil' },
        'core.interactable': {
          prompt: 'memory.prompt.observeDoor',
          actions: [
            { type: 'core.playSound', sound: 'memory:threshold' },
            { type: 'core.notify', text: 'memory.vision.threshold', kind: 'memory' },
          ],
          size: [1.2, 2.2, 0.6],
          offset: [0, 1, 0],
        },
        'core.conditional': {
          states: [{ when: { type: 'core.all', of: [VISION, { type: 'core.civCompleted', civ: 'door' }] }, visible: 'show' }],
          otherwise: 'hide',
        },
      },
      { yaw: tyaw },
    );
    s.entity('remanence', W.remanence, {
      'core.model': { model: 'memory:remanence' },
      'core.pickup': { item: 'memory:remanence', prompt: 'memory.prompt.remanence', size: [1.2, 1.2, 0.6], offset: [0, -0.6, 0] },
      'core.particles': { preset: 'memory', color: '#e8d8ff', rate: 3, size: [3, 3, 3] },
      'core.conditional': { states: [{ when: VISION, visible: 'show' }], otherwise: 'hide' },
    });
  });

  zone(s, 'zone_blanche', [cx, y, cz], [28, 10, 28], 'memory.zone.blanche', { subtitle: 'memory.zone.blanche.subtitle' });
  return s.build({ camera: { position: [15.5, 12, 2], target: [15.5, 2, 16] }, notes: 'Généré par civilizations/memory/seed/blanche.ts puis édité dans le Studio.' });
}
