/**
 * Seed of the scene "porte_absente": the erased corridor under the Archives and the starry void
 * behind the absent door.
 */
import { SceneBuilder, fillBox, clearBox, stairs, light, zone, type SceneDoc, type EnvironmentDoc } from '@sdk/build';
import { A, at } from './layout.ts';

export const ABSENTE_ENV: EnvironmentDoc = {
  sky: { top: '#05040a', horizon: '#120c22', bottom: '#020205', stars: 1, sunDisc: false },
  sun: { direction: [0.2, -1, 0.3], color: '#6e64a8', intensity: 0.25 },
  ambient: { color: '#5a5480', intensity: 0.3 },
  hemi: { sky: '#6d68a0', ground: '#1d1a26', intensity: 0.35 },
  fog: { color: '#0d0a18', density: 0.03 },
  blockLight: 1.35,
  particles: { preset: 'dust', density: 0.25 },
  music: 'door:music.absente',
  ambience: 'core:low_drone',
  post: { exposure: 1.0, contrast: 1.12, saturation: 0.9, bloom: 0.65, vignette: 0.55 },
};

export function buildAbsente(): SceneDoc {
  const s = new SceneBuilder('porte_absente', 'door.scene.absente', A.size, ABSENTE_ENV);
  const v = s.volume;
  const y = A.floor;
  const c = A.corridor;
  const top = y + c.h;

  // The starry expanse behind the end wall (a hollow shell of void blocks)...
  const zw = A.seamZ;
  fillBox(v, [0, 0, zw], [39, 33, 63], 'door:void');
  clearBox(v, [1, 1, zw + 1], [38, 32, 62]);
  // ...then solid rock for the corridor part, carved below.
  fillBox(v, [0, 0, 0], [39, top + 2, zw], 'door:erased_stone');

  // Arrival: the bottom of the stair coming down from the Archives.
  clearBox(v, [17, y, 1], [22, y + 5, 6]);
  stairs(v, [17, y, 4], 'z-', 3, 6, 'door:erased_bricks', { clearAbove: 3 });
  fillBox(v, [17, y, 1], [22, y + 5, 1], 'door:erased_bricks');
  s.entity('spawn_arrivee', A.spawn, { 'core.spawn': { isDefault: true } }, { yaw: 0 });

  // The corridor: too long, too straight, lined with doors that lead nowhere.
  clearBox(v, [c.x0, y, c.z0], [c.x1, top - 1, c.z1]);
  fillBox(v, [c.x0 - 1, y, c.z0], [c.x0 - 1, top - 1, c.z1], 'door:erased_bricks');
  fillBox(v, [c.x1 + 1, y, c.z0], [c.x1 + 1, top - 1, c.z1], 'door:erased_bricks');
  fillBox(v, [c.x0, y - 1, c.z0], [c.x1, y - 1, c.z1], 'door:erased_stone');
  for (let z = c.z0; z <= c.z1; z += 2) fillBox(v, [c.x0 + 1, y - 1, z], [c.x1 - 1, y - 1, z], 'door:erased_bricks');
  // Arches every five meters, violet crystals in the vault.
  for (let z = c.z0 + 2; z <= c.z1; z += 5) {
    fillBox(v, [c.x0, top - 1, z], [c.x1, top - 1, z], 'door:erased_bricks');
    v.set(c.x0, top - 2, z, 'door:erased_bricks');
    v.set(c.x1, top - 2, z, 'door:erased_bricks');
    v.set(19, top - 1, z + 2, 'core:crystal_violet');
    v.set(20, top - 1, z + 2, 'core:crystal_violet');
  }
  clearBox(v, [c.x0, y, 6], [c.x1, top - 1, 6]);
  // Doors in the side walls, each opening on bare brick.
  for (const d of A.doors) {
    v.set(d.x, y, d.z, null);
    v.set(d.x, y + 1, d.z, null);
    const behind = d.x < 19 ? d.x - 1 : d.x + 1;
    v.set(behind, y, d.z, 'door:erased_bricks');
    v.set(behind, y + 1, d.z, 'door:erased_bricks');
    fillBox(v, [d.x, y + 2, d.z], [d.x, y + 2, d.z], 'door:mark_gray');
    s.entity(
      d.id,
      [d.x + 0.5, y, d.z + 0.5],
      {
        'core.door': { model: d.model, name: 'door.door.nowhere', open: true, closeSound: 'door:slam' },
        'door.memory': { descriptions: ['door.memory.nowhere.1', 'door.memory.nowhere.2'] },
      },
      { yaw: d.yaw, folder: 'Couloir' },
    );
  }

  // The end wall and its impossible seam of light.
  fillBox(v, [c.x0 - 1, y - 1, zw], [c.x1 + 1, top, zw], 'door:erased_bricks');
  fillBox(v, [19, y, zw], [20, y + 2, zw], 'door:light_seam');
  v.set(19, y + 3, zw, 'door:light_seam');
  v.set(20, y + 4, zw, 'door:light_seam');
  s.entity('rai_lumiere', [20, y + 1.5, zw - 0.6], { 'core.particles': { preset: 'motes', color: '#ffe2a8', rate: 2.2, size: [2.5, 3, 1.5] } }, { folder: 'Couloir' });
  s.entity(
    'porte_absente',
    A.absentDoor,
    {
      'core.door': { model: 'door:door_black', name: 'door.door.absent', width: 2, height: 3, interactable: false, openSound: 'door:palm_awaken' },
      'door.lock': { variant: 'impossible' },
      'core.conditional': { states: [{ when: { type: 'core.var', var: 'door.absentDoorShown', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
    },
    { folder: 'Fin' },
  );
  s.entity(
    'plaque_orig',
    A.plaque,
    {
      'core.model': { model: 'door:plaque_orig', collider: 'none' },
      'core.conditional': { states: [{ when: { type: 'core.var', var: 'door.absentDoorShown', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
      'core.readable': {
        title: 'door.doc.orig.title',
        pages: ['door.doc.orig.1'],
        style: 'plaque',
        size: [0.9, 0.6, 0.3],
        offset: [0, -0.3, 0],
      },
    },
    { folder: 'Fin' },
  );
  s.entity(
    'fragment_seuil',
    A.fragment,
    {
      'core.model': { model: 'door:fragment', collider: 'none' },
      'core.pickup': {
        item: 'door:fragment_seuil',
        prompt: 'door.prompt.fragment',
        size: [0.7, 0.7, 0.7],
        offset: [0, -0.35, 0],
        condition: { type: 'core.var', var: 'door.absentDoorShown', op: '==', value: true },
      },
      'core.conditional': { states: [{ when: { type: 'core.var', var: 'door.absentDoorShown', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
    },
    { folder: 'Fin' },
  );
  // Nobody crosses the threshold in this prologue.
  s.entity('seuil_infranchissable', [20, y, zw + 0.9], { 'core.collider': { size: [4, 4, 0.4], offset: [0, 0, 0], solid: true, pickable: false } }, { folder: 'Fin' });

  // A ledge just beyond the threshold, above the starry depth.
  fillBox(v, [17, y - 1, zw + 1], [22, y - 1, zw + 1], 'door:erased_stone');
  s.entity('etoiles', [20, 14, 48], { 'core.particles': { preset: 'stars', color: '#e8e6ff', rate: 3, size: [34, 26, 26] } }, { folder: 'Fin' });

  // Light, sound and the arrival of Mira and Varen.
  light(s, 'lumiere_entree', [19.5, y + 2.5, 4.5], '#8a7cc8', 7);
  light(s, 'lumiere_seuil', [20, y + 1.5, zw - 1.2], '#ffe2a8', 13);
  zone(s, 'zone_couloir', [20, y, 20], [10, 8, 30], 'door.zone.corridor', { subtitle: 'door.zone.corridor.subtitle', music: 'door:music.absente' });
  for (const [id, pos, character, name] of [
    ['mira', A.miraEnter, 'door:mira', 'door.npc.mira'],
    ['varen', A.varenEnter, 'door:varen', 'door.npc.varen'],
  ] as const) {
    s.entity(
      id,
      pos,
      {
        'core.npc': { character, name, dialogue: 'confrontation', speed: 2.2, lookDistance: 8, interactable: false },
        'core.conditional': { states: [{ when: { type: 'core.var', var: 'door.alliesArrived', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
      },
      { yaw: 0, folder: 'Personnages' },
    );
  }
  s.entity('marque_mira_fond', A.miraArrive, { 'core.marker': {} }, { folder: 'Repères' });
  s.entity('marque_varen_fond', A.varenArrive, { 'core.marker': {} }, { folder: 'Repères' });
  s.entity('marque_joueur_fond', A.playerStand, { 'core.marker': {} }, { yaw: 0, folder: 'Repères' });
  s.entity('trig_entree_couloir', at(19, y, 9), { 'core.trigger': { size: [8, 4, 2], once: true } }, { folder: 'Déclencheurs' });
  s.entity('trig_fond_couloir', at(19, y, 29), { 'core.trigger': { size: [8, 4, 3], once: true } }, { folder: 'Déclencheurs' });

  return s.build({ camera: { position: [20, 12, 2], target: [20, 9, 30] }, notes: 'Généré par civilizations/door/seed/absente.ts.' });
}
