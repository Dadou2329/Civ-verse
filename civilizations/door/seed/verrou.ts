/**
 * Seed of the scene "verrou": the vertical city of Verrou (Faubourg Bas, Galerie des Métiers,
 * Archives du Haut). Generates the first version of content/scenes/verrou.scene.json.
 */
import { SceneBuilder, fillBox, clearBox, stairs, cylinder, cone, pyramidRoof, scatter, house, doorSpot, railing, deco, light, sign, zone, npc, type SceneDoc, type EnvironmentDoc, type Vec3Tuple, type HouseStyle, type HouseOptions } from '@sdk/build';
import { SIZE, G0, G1, G2, L, at } from './layout.ts';

export const VERROU_ENV: EnvironmentDoc = {
  sky: { top: '#34435a', horizon: '#c4a07f', bottom: '#2a2b30', stars: 0.12, sunDisc: true, discColor: '#ffd9a6' },
  sun: { direction: [-0.32, -0.6, 0.73], color: '#ffd2a0', intensity: 1.05 },
  ambient: { color: '#8f98ad', intensity: 0.66 },
  hemi: { sky: '#a3b2c8', ground: '#5c4b3b', intensity: 0.55 },
  fog: { color: '#948a86', density: 0.011 },
  blockLight: 1.15,
  particles: { preset: 'dust', density: 0.35 },
  music: 'door:music.faubourg',
  ambience: 'door:amb_drips',
  post: { exposure: 1.14, contrast: 1.08, saturation: 0.96, bloom: 0.42, vignette: 0.38 },
};

const SLUM: HouseStyle = { wall: 'door:slum_plaster', base: 'door:damp_stone', trim: 'door:weathered_planks', roof: 'door:soot_roof', floor: 'door:weathered_planks', window: 'core:frosted_glass' };
const SLUM_B: HouseStyle = { ...SLUM, wall: 'door:slum_plaster_brace', roof: 'core:roof_slate' };
const SLUM_C: HouseStyle = { ...SLUM, wall: 'door:damp_bricks', trim: 'door:damp_stone', roof: 'door:soot_roof' };
const WORKSHOP: HouseStyle = { wall: 'door:damp_bricks', base: 'door:damp_stone', trim: 'core:beam_dark', roof: 'core:roof_red', floor: 'core:planks_oak', window: 'core:glass_amber' };
const GALLERY: HouseStyle = { wall: 'door:warm_brick', base: 'door:damp_stone', trim: 'door:copper_patina', roof: 'core:roof_red', floor: 'door:gallery_tiles', window: 'core:glass_amber' };
const GALLERY_B: HouseStyle = { ...GALLERY, wall: 'core:plaster_ochre', trim: 'door:warm_brick', roof: 'core:roof_red' };
const UPPER: HouseStyle = { wall: 'door:archive_stone', base: 'door:archive_stone', trim: 'door:archive_trim', roof: 'core:roof_blue', floor: 'door:archive_floor', window: 'core:glass' };

/** A private door: the house exists, but it is not part of the prototype. */
function privateDoor(s: SceneBuilder, id: string, o: HouseOptions, side: 'n' | 's' | 'e' | 'w', at_: number, text = 'door.lock.private'): void {
  const d = doorSpot(o, side, at_);
  s.entity(
    id,
    d.pos,
    {
      'core.door': { model: 'door:door_rank0', name: 'door.door.house' },
      'door.lock': { variant: 'sealed', deniedText: text },
    },
    { yaw: d.yaw, folder: s.folder },
  );
}

export function buildVerrou(): SceneDoc {
  const s = new SceneBuilder('verrou', 'door.scene.verrou', SIZE, VERROU_ENV);
  terrain(s);
  s.inFolder('Faubourg Bas', () => faubourg(s));
  s.inFolder('Galerie des Métiers', () => galerie(s));
  s.inFolder('Archives du Haut', () => archives(s));
  return s.build({ camera: { position: [48, 30, 6], target: [48, 12, 40] }, notes: 'Généré par civilizations/door/seed/verrou.ts puis édité dans le Studio.' });
}

// =================================================================================================
// Terrain: three tiers separated by retaining walls
// =================================================================================================

function terrain(s: SceneBuilder): void {
  const v = s.volume;
  const [sx, , sz] = SIZE;
  fillBox(v, [0, 0, 0], [sx - 1, G0 - 2, sz - 1], 'core:stone');
  fillBox(v, [0, G0 - 1, 0], [sx - 1, G0 - 1, 49], 'door:damp_stone');
  // Tier 1 (gallery) and its retaining wall facing the Faubourg.
  fillBox(v, [0, G0 - 1, 50], [sx - 1, G1 - 2, 86], 'door:damp_stone');
  fillBox(v, [0, G1 - 1, 50], [sx - 1, G1 - 1, 86], 'door:warm_brick');
  fillBox(v, [0, G0, 50], [sx - 1, G1 - 2, 50], 'door:damp_bricks');
  // Tier 2 (archives) and its retaining wall facing the gallery.
  fillBox(v, [0, G1 - 1, 87], [sx - 1, G2 - 2, sz - 1], 'door:damp_stone');
  fillBox(v, [0, G2 - 1, 87], [sx - 1, G2 - 1, sz - 1], 'door:archive_floor');
  fillBox(v, [0, G1, 87], [sx - 1, G2 - 2, 87], 'door:warm_brick');
  // Buttresses and drain stains on the lower retaining wall.
  for (let x = 4; x < sx - 2; x += 9) {
    if (x >= 44 && x <= 52) continue;
    fillBox(v, [x, G0, 49], [x + 1, G1 - 3, 49], 'door:damp_stone');
    fillBox(v, [x, G1 - 2, 49], [x + 1, G1 - 2, 49], 'door:damp_stone_slab');
  }
  for (let x = 2; x < sx - 2; x += 7) fillBox(v, [x, G0 + 1, 50], [x, G1 - 4, 50], 'core:mossy_bricks');
  // Upper retaining wall: brick with a pale band.
  fillBox(v, [0, G2 - 2, 87], [sx - 1, G2 - 2, 87], 'door:archive_trim');
}

// =================================================================================================
// Faubourg Bas — Cour des Sans-Seuil (zone A) and Atelier de Mira (zone B)
// =================================================================================================

function faubourg(s: SceneBuilder): void {
  const v = s.volume;
  const y = G0;

  // --- Enclosure: outer walls hide the edge of the world ---------------------------------------
  fillBox(v, [0, y, 0], [95, y + 11, 1], 'door:damp_bricks');
  fillBox(v, [94, y, 0], [95, y + 11, 49], 'door:damp_bricks');
  fillBox(v, [0, y, 0], [1, y + 11, 49], 'door:damp_bricks');
  for (let x = 0; x < 96; x += 2) v.set(x, y + 12, 0, 'door:damp_bricks');

  // --- Paving --------------------------------------------------------------------------------------
  fillBox(v, [28, y - 1, 16], [68, y - 1, 41], 'door:damp_cobble');
  fillBox(v, [12, y - 1, 2], [91, y - 1, 5], 'core:gravel');
  fillBox(v, [12, y - 1, 2], [15, y - 1, 49], 'core:gravel');
  fillBox(v, [41, y - 1, 42], [54, y - 1, 49], 'core:cobble');
  fillBox(v, [65, y - 1, 2], [68, y - 1, 41], 'door:damp_cobble');
  // Puddles in the low spots.
  for (const [px, pz] of [
    [36, 34],
    [57, 20],
    [14, 12],
    [66, 30],
    [44, 44],
  ] as const) {
    v.set(px, y - 1, pz, 'door:dark_water');
    v.set(px + 1, y - 1, pz, 'door:dark_water');
    v.set(px, y - 1, pz + 1, 'door:dark_water');
    v.set(px, y - 2, pz, 'door:damp_stone');
    v.set(px + 1, y - 2, pz, 'door:damp_stone');
    v.set(px, y - 2, pz + 1, 'door:damp_stone');
  }

  // --- The rampart and the cell that was never built -------------------------------------------
  fillBox(v, [2, y, 2], [11, y + 12, 49], 'door:damp_stone');
  fillBox(v, [11, y, 2], [11, y + 12, 49], 'door:damp_bricks');
  for (let z = 2; z <= 49; z += 2) v.set(11, y + 13, z, 'door:damp_bricks');
  for (let z = 6; z < 48; z += 8) fillBox(v, [11, y + 3, z], [11, y + 3, z + 1], 'core:mossy_bricks');
  const c = L.cell;
  clearBox(v, [c.x0, y, c.z0], [c.x1, y + 2, c.z1]);
  fillBox(v, [c.x0, y - 1, c.z0], [c.x1, y - 1, c.z1], 'door:damp_stone');
  v.set(c.x0, y, c.z1, 'core:hay');
  v.set(11, y, 27, null);
  v.set(11, y + 1, 27, null);
  s.entity(
    'cell_door',
    [L.cellDoor[0], y, L.cellDoor[2]],
    {
      'core.door': { model: 'door:door_handleless', name: 'door.door.cell', openSound: 'core:door_open' },
      'door.lock': { variant: 'palm' },
      'door.memory': { descriptions: ['door.memory.cell.1', 'door.memory.cell.2', 'door.memory.cell.3'] },
    },
    { yaw: 90 },
  );
  light(s, 'cell_light', [9.5, y + 2.2, 27.5], '#9fb2d4', 9);
  s.entity('cell_poussiere', [9, y + 1, 27.5], { 'core.particles': { preset: 'dust', color: '#c8d4e8', rate: 0.8, size: [3, 2.5, 3] } });
  s.entity('spawn_cell', L.spawnCell, { 'core.spawn': { isDefault: true } }, { yaw: 90 });
  s.entity(
    'cell_plaque',
    [12.07, y + 1.15, 25.6],
    {
      'core.model': { model: 'door:notice_plaque', collider: 'none' },
      'core.readable': {
        title: 'door.doc.cellPlaque.title',
        pages: ['door.doc.cellPlaque.1', 'door.doc.cellPlaque.2'],
        style: 'plaque',
        size: [1.0, 0.7, 0.3],
        offset: [0, 0.3, 0],
        actions: [{ type: 'core.setVar', var: 'door.readCellPlaque', value: true }],
      },
    },
    { yaw: 90 },
  );
  s.entity('trig_cell_exit', at(13, y, 27), {
    'core.trigger': {
      size: [3, 3, 3],
      once: true,
      onEnter: [
        { type: 'core.completeObjective', quest: 'DOOR_Q00_REVEIL', objective: 'sortir' },
        { type: 'core.say', entity: 'noe', text: 'door.bark.noe.hey', seconds: 3 },
        { type: 'core.lookAt', entity: 'noe', target: 'player' },
      ],
    },
  });

  // --- West houses (along the rampart alley) ---------------------------------------------------
  const hw1: HouseOptions = { x0: 16, z0: 6, x1: 27, z1: 15, y, h: 6, style: SLUM, roofAxis: 'z', doors: [{ side: 'e', at: 10 }] };
  house(v, hw1);
  privateDoor(s, 'porte_maison_rempart', hw1, 'e', 10);
  const hw2: HouseOptions = { x0: 16, z0: 19, x1: 27, z1: 30, y, h: 7, style: SLUM_B, roofAxis: 'z', doors: [{ side: 'e', at: 26 }] };
  house(v, hw2);
  privateDoor(s, 'porte_maison_volets', hw2, 'e', 26, 'door.lock.privateVoice');
  const hw3: HouseOptions = { x0: 16, z0: 34, x1: 27, z1: 45, y, h: 6, style: SLUM_C, roofAxis: 'z', doors: [{ side: 'e', at: 39 }] };
  house(v, hw3);
  privateDoor(s, 'porte_tonnelier', hw3, 'e', 39);
  // Elias's poster on the wall facing the square.
  s.entity(
    'affiche_elias_cour',
    [28.04, y + 1.2, 21.5],
    {
      'core.model': { model: 'door:poster_missing', collider: 'none' },
      'core.readable': {
        title: 'door.doc.poster.title',
        pages: ['door.doc.poster.1', 'door.doc.poster.2', 'door.doc.poster.3'],
        style: 'poster',
        size: [0.9, 1.1, 0.2],
        offset: [0, 0.45, 0],
        actions: [{ type: 'door.foundPoster' }],
      },
    },
    { yaw: 90 },
  );
  // Noé's nook at the dead end of the alley.
  fillBox(v, [12, y, 48], [15, y + 3, 49], 'door:weathered_planks');
  clearBox(v, [12, y, 48], [15, y + 2, 48]);
  fillBox(v, [12, y + 3, 45], [15, y + 3, 48], 'door:weathered_planks_slab');
  s.entity('caisse_noe', [13.5, y, 47.5], {
    'core.model': { model: 'door:crate_marked' },
    'core.pickup': {
      item: 'door:disque',
      size: [0.9, 0.9, 0.9],
      offset: [0, 0.35, 0],
      hideOnTake: false,
      condition: { type: 'core.var', var: 'door.noeCrateTold', op: '==', value: true },
    },
    'core.interactable': {
      prompt: 'door.prompt.crate',
      condition: { type: 'core.var', var: 'door.noeCrateTold', op: '!=', value: true },
      actions: [{ type: 'core.notify', text: 'door.notify.crateNailed', kind: 'info' }],
      size: [0.9, 0.9, 0.9],
      offset: [0, 0.35, 0],
    },
  }, { yaw: 180 });
  deco(s, 'core:barrel', [15.0, y, 48.2]);
  // Hay, sacks and a cat-sized clutter of the alley.
  scatter(v, [12, y, 3], [15, y + 1, 44], 'core:tall_grass', 0.08, 41, ['core:gravel']);

  // --- South row ---------------------------------------------------------------------------------
  // Ancienne serrurerie de Brun (visitable).
  const lock: HouseOptions = { x0: 33, z0: 6, x1: 43, z1: 15, y, h: 6, style: WORKSHOP, roofAxis: 'x', doors: [{ side: 'n', at: 38 }] };
  house(v, lock);
  const ld = doorSpot(lock, 'n', 38);
  s.entity(
    'porte_serrurerie',
    ld.pos,
    { 'core.door': { model: 'door:door_rank0', name: 'door.door.locksmith' }, 'door.lock': { variant: 'rank', rank: 0 } },
    { yaw: ld.yaw },
  );
  sign(s, 'enseigne_serrurerie', [38.5, y + 2.75, 16.04], 0, 'door.sign.locksmith', [2.2, 0.5, 0.05]);
  // Interior: dusty workbench, broken locks, the copper spring.
  deco(s, 'core:workbench', [38.5, y, 8.0], 180);
  deco(s, 'core:shelf', [34.6, y, 10.5], 90);
  deco(s, 'core:shelf', [42.4, y, 10.5], 270);
  deco(s, 'door:key_wall', [36.5, y + 1.1, 7.04], 0);
  deco(s, 'core:crate', [41.5, y, 13.5]);
  deco(s, 'core:lantern', [35.5, y, 13.5]);
  s.entity('ressort_cuivre', [38.4, y + 0.95, 8.3], { 'core.pickup': { item: 'door:ressort', size: [0.5, 0.4, 0.5], offset: [0, 0, 0] } });
  zone(s, 'zone_serrurerie', [38.5, y, 10.5], [9, 5, 8], 'door.zone.locksmith', { showTitle: true });
  s.entity('particules_serrurerie', [38.5, y + 1, 10.5], { 'core.particles': { preset: 'dust', color: '#d8c7a0', rate: 1.2, size: [8, 3, 7] } });

  const weavers: HouseOptions = { x0: 45, z0: 6, x1: 55, z1: 15, y, h: 7, style: SLUM_B, roofAxis: 'x', doors: [{ side: 'n', at: 50 }] };
  house(v, weavers);
  privateDoor(s, 'porte_tisserands', weavers, 'n', 50);
  const shop: HouseOptions = { x0: 57, z0: 6, x1: 64, z1: 14, y, h: 5, style: SLUM_C, roofAxis: 'z', doors: [{ side: 'n', at: 60 }] };
  house(v, shop);
  privateDoor(s, 'porte_echoppe', shop, 'n', 60, 'door.lock.closedShop');

  // --- Cour du Puits (back yard of the south row) ------------------------------------------------
  fillBox(v, [66, y - 1, 4], [78, y - 1, 14], 'door:damp_cobble');
  s.entity('puits', [L.well[0], y, L.well[2]], {
    'core.model': { model: 'core:well' },
    'core.interactable': {
      prompt: 'door.prompt.well',
      once: true,
      size: [1.6, 1.4, 1.6],
      offset: [0, 0.7, 0],
      actions: [
        { type: 'core.playSound', sound: 'core:mechanism', at: 'puits' },
        { type: 'core.wait', seconds: 1.2 },
        { type: 'core.giveItem', item: 'door:goupille' },
        { type: 'core.notify', text: 'door.notify.well', kind: 'discovery' },
      ],
    },
  });
  deco(s, 'core:barrel', [76.5, y, 6.5]);
  deco(s, 'core:barrel', [77.4, y, 7.6]);
  deco(s, 'core:crate', [67.5, y, 13.0]);
  railing(v, [66, 15], [78, 15], y, 'core:hedge');
  v.set(68, y, 15, null);
  v.set(67, y, 15, null);

  // --- Plaza: the dry fountain and its benches -------------------------------------------------
  s.entity('fontaine', L.fountain, { 'core.model': { model: 'door:fountain_dry', collider: 'auto' } });
  for (const [bx, bz, yaw] of [
    [43.5, 23.5, 0],
    [52.5, 23.5, 0],
    [43.5, 33.5, 180],
    [52.5, 33.5, 180],
  ] as const)
    deco(s, 'core:bench', [bx, y, bz], yaw);
  for (const [lx, lz] of [
    [33.5, 18.5],
    [62.5, 18.5],
    [33.5, 39.5],
    [62.5, 39.5],
    [47.5, 42.5],
  ] as const)
    deco(s, 'core:lamp_post', [lx, y, lz]);
  deco(s, 'core:cart', [58.5, y, 34.5], 200);
  deco(s, 'core:barrel', [31.0, y, 31.0]);
  deco(s, 'core:barrel', [31.0, y, 32.0]);
  deco(s, 'core:crate', [64.0, y, 25.5]);
  deco(s, 'core:sign_post', [30.5, y, 17.5], 90);
  zone(s, 'zone_cour', [47.5, y, 25], [92, 12, 50], 'door.zone.court', { subtitle: 'door.zone.court.subtitle', music: 'door:music.faubourg', ambience: 'door:amb_drips' });

  // --- North row: guard post, the gallery gate, the house of care ------------------------------
  const post: HouseOptions = { x0: 30, z0: 42, x1: 40, z1: 49, y, h: 5, style: SLUM_C, roofAxis: 'x', flatRoof: 'door:damp_stone_slab', windowEvery: 0 };
  house(v, post);
  clearBox(v, [33, y, 42], [37, y + 2, 42]);
  sign(s, 'enseigne_poste', [35, y + 3.6, 41.94], 180, 'door.sign.guardPost', [2.6, 0.5, 0.05]);
  deco(s, 'core:desk', [35.5, y, 47.4], 180);
  deco(s, 'core:chair', [35.5, y, 48.4], 180);
  deco(s, 'door:key_wall', [32.5, y + 1.1, 48.93], 180);
  deco(s, 'core:lantern', [38.5, y, 47.5]);
  deco(s, 'core:banner_red', [31.2, y + 1, 45.5], 90);

  // The gate: a monumental opening in the retaining wall, framed in gold.
  fillBox(v, [45, y, 50], [50, y + 4, 50], 'door:warm_brick');
  fillBox(v, [45, y + 4, 50], [50, y + 4, 50], 'door:mark_gold');
  fillBox(v, [45, y, 49], [45, y + 3, 49], 'door:warm_brick');
  fillBox(v, [50, y, 49], [50, y + 3, 49], 'door:warm_brick');
  clearBox(v, [47, y, 50], [48, y + 2, 50]);
  s.entity(
    'porte_galerie',
    L.galleryGate,
    {
      'core.door': { model: 'door:door_rank1', name: 'door.door.gallery', width: 2, height: 3 },
      'door.lock': { variant: 'rank', rank: 1 },
      'door.memory': { descriptions: ['door.memory.gate.1', 'door.memory.gate.2'], examineVar: 'door.gateEngravingSeen' },
    },
    { yaw: 0 },
  );
  sign(s, 'enseigne_galerie', [48, y + 3.5, 49.92], 180, 'door.sign.gallery', [3.2, 0.55, 0.05], 'carved', { text: '#f1d78a', bg: '#5a3a22' });
  npc(s, 'tomas', L.gateGuard, 180, {
    character: 'door:tomas',
    name: 'door.npc.tomas',
    dialogue: 'tomas',
    barks: ['door.bark.tomas.1', 'door.bark.tomas.2'],
    barkInterval: 22,
  });
  s.entity('trig_porte_galerie', at(47, y, 46), {
    'core.trigger': {
      size: [8, 3, 5],
      once: true,
      onEnter: [{ type: 'core.completeObjective', quest: 'DOOR_Q01_EMPREINTE', objective: 'porte' }],
    },
  });

  light(s, 'lumiere_palier_galerie', [47.5, y + 2.5, 52.5], '#ffc27a', 11);

  // House of care (dispensary): rank 1 door, the mother outside.
  const care: HouseOptions = { x0: 55, z0: 42, x1: 66, z1: 49, y, h: 6, style: SLUM_B, roofAxis: 'x', doors: [{ side: 's', at: 61 }] };
  house(v, care);
  const cd = doorSpot(care, 's', 61);
  s.entity(
    'porte_soins',
    cd.pos,
    {
      'core.door': { model: 'door:door_rank1', name: 'door.door.care' },
      'door.lock': { variant: 'rank', rank: 1 },
    },
    { yaw: cd.yaw },
  );
  sign(s, 'enseigne_soins', [60.5, y + 2.75, 41.94], 180, 'door.sign.care', [2.4, 0.5, 0.05]);
  for (const bx of [57.5, 60.5, 64.0]) deco(s, 'core:bed', [bx, y, 47.2], 0);
  deco(s, 'core:shelf', [56.6, y, 44.5], 90);
  deco(s, 'core:lantern', [62.5, y, 44.0]);
  s.entity('marque_mere_dedans', L.motherInside, { 'core.marker': { note: 'La mère, au chevet de son fils, après la scène.' } });
  npc(
    s,
    'mere',
    L.mother,
    0,
    {
      character: 'door:mere',
      name: 'door.npc.mother',
      dialogue: 'mere',
      barks: ['door.bark.mother.1', 'door.bark.mother.2', 'door.bark.mother.3'],
      barkInterval: 9,
      lookAtPlayer: false,
    },
  );
  npc(s, 'garde_soins', L.guardSoins, 180, {
    character: 'door:garde',
    name: 'door.npc.guard',
    dialogue: 'garde_soins',
    barks: ['door.bark.guardCare.1'],
    barkInterval: 26,
  });
  s.entity('son_toux', [60.5, y + 1, 45.5], { 'door.ambientLoop': { sound: 'door:cough', every: 11, condition: { type: 'core.var', var: 'door.motherSceneDone', op: '!=', value: true } } });
  s.entity('trig_scene_mere', at(58, y, 37), {
    'core.trigger': {
      size: [14, 3, 10],
      once: true,
      condition: {
        type: 'core.all',
        of: [
          { type: 'core.var', var: 'door.metMira', op: '==', value: true },
          { type: 'core.var', var: 'door.motherSceneDone', op: '!=', value: true },
        ],
      },
      onEnter: [{ type: 'core.playCinematic', cinematic: 'C_mere' }],
    },
  });
  s.entity('marque_varen_mere', L.varenMotherScene, { 'core.marker': { note: 'Varen ouvre la porte de la maison de soins.' } });
  npc(s, 'varen', L.varenPost, 180, {
    character: 'door:varen',
    name: 'door.npc.varen',
    dialogue: 'varen',
    lookDistance: 6,
  });

  // --- East block: Atelier de Mira (visitable), the mother's house, the east row ----------------
  const ws: HouseOptions = { x0: 69, z0: 17, x1: 82, z1: 30, y, h: 6, style: WORKSHOP, roofAxis: 'z', doors: [{ side: 'w', at: 24 }], windowSides: ['w', 's', 'n'] };
  house(v, ws);
  const wd = doorSpot(ws, 'w', 24);
  s.entity(
    'porte_atelier',
    wd.pos,
    { 'core.door': { model: 'door:door_rank0', name: 'door.door.workshop' }, 'door.lock': { variant: 'rank', rank: 0 } },
    { yaw: wd.yaw },
  );
  sign(s, 'enseigne_atelier', [68.94, y + 2.8, 24.5], 270, 'door.sign.workshop', [2.6, 0.55, 0.05]);
  zone(s, 'zone_atelier', [75.5, y, 23.5], [12, 5, 12], 'door.zone.workshop', { subtitle: 'door.zone.workshop.subtitle' });
  // Interior: imprint bench, test door, key wall, shelves, a drawer full of refused keys.
  s.entity('etabli_empreinte', L.miraBench, {
    'core.model': { model: 'door:imprint_bench' },
    'core.interactable': {
      prompt: 'door.prompt.bench',
      size: [1.9, 1.4, 1.0],
      offset: [0, 0.7, 0],
      condition: { type: 'door.imprintReady' },
      hideIfUnavailable: false,
      unavailableReason: 'door.prompt.bench.missing',
      actions: [{ type: 'door.openImprint' }],
      tone: 'special',
    },
  }, { yaw: 180 });
  deco(s, 'door:test_door', [80.0, y, 20.5], 270);
  deco(s, 'door:key_wall', [73.0, y + 1.1, 29.93], 180);
  deco(s, 'core:shelf', [81.4, y, 26.5], 270);
  deco(s, 'core:workbench', [71.5, y, 19.0], 90);
  deco(s, 'core:lantern', [74.0, y, 19.0]);
  deco(s, 'core:lantern', [80.5, y, 28.5]);
  deco(s, 'core:books_stack', [71.4, y + 0.95, 18.6]);
  s.entity('tiroir_cles', [81.4, y, 22.5], {
    'core.model': { model: 'core:cabinet' },
    'core.interactable': {
      prompt: 'door.prompt.drawer',
      size: [0.8, 1.0, 1.0],
      offset: [0, 0.5, 0],
      actions: [{ type: 'core.showDocument', title: 'door.doc.drawer.title', pages: ['door.doc.drawer.1', 'door.doc.drawer.2'], style: 'paper' }],
    },
  }, { yaw: 270 });
  light(s, 'lumiere_atelier', [75.5, y + 3, 23.5], '#ffb070', 14);
  light(s, 'lumiere_etabli', [76.5, y + 2, 26.0], '#ffc890', 11);
  npc(s, 'mira', L.mira, 270, {
    character: 'door:mira',
    name: 'door.npc.mira',
    dialogue: 'mira',
    barks: ['door.bark.mira.1', 'door.bark.mira.2'],
    barkInterval: 30,
  });

  const mh: HouseOptions = { x0: 70, z0: 33, x1: 80, z1: 41, y, h: 5, style: SLUM, roofAxis: 'x', doors: [{ side: 'w', at: 37 }] };
  house(v, mh);
  privateDoor(s, 'porte_maison_mere', mh, 'w', 37, 'door.lock.motherHouse');
  const e1: HouseOptions = { x0: 85, z0: 6, x1: 92, z1: 18, y, h: 8, style: SLUM_C, roofAxis: 'z', doors: [{ side: 'w', at: 12 }] };
  house(v, e1);
  privateDoor(s, 'porte_est_1', e1, 'w', 12);
  const e2: HouseOptions = { x0: 85, z0: 22, x1: 92, z1: 34, y, h: 7, style: SLUM, roofAxis: 'z', doors: [{ side: 'w', at: 28 }] };
  house(v, e2);
  privateDoor(s, 'porte_est_2', e2, 'w', 28, 'door.lock.privateVoice');
  const e3: HouseOptions = { x0: 84, z0: 38, x1: 92, z1: 48, y, h: 9, style: SLUM_B, roofAxis: 'z', doors: [{ side: 'w', at: 43 }] };
  house(v, e3);
  privateDoor(s, 'porte_est_3', e3, 'w', 43);
  // Laundry lines and clutter between the houses.
  for (const [lx, lz] of [
    [83.5, 20.5],
    [83.5, 36.5],
  ] as const)
    deco(s, 'core:barrel', [lx, y, lz]);

  // --- Inhabitants -----------------------------------------------------------------------------------
  npc(s, 'noe', L.noeStart, 270, {
    character: 'door:noe',
    name: 'door.npc.noe',
    dialogue: 'noe',
    speed: 2.4,
  });
  s.entity('marque_noe_cour', at(44, y, 27), { 'core.marker': { note: 'Noé attend sur la place après sa rencontre.' } });
  npc(s, 'balayeur', at(38, y, 26), 120, {
    character: 'door:balayeur',
    name: 'door.npc.sweeper',
    dialogue: 'balayeur',
    mode: 'wander',
    wanderRadius: 3,
    speed: 0.9,
    barks: ['door.bark.sweeper.1', 'door.bark.sweeper.2'],
    barkInterval: 20,
  });
  npc(s, 'lavandiere', at(70, y, 11), 90, {
    character: 'door:lavandiere',
    name: 'door.npc.washer',
    dialogue: 'lavandiere',
    barks: ['door.bark.washer.1', 'door.bark.washer.2'],
    barkInterval: 24,
  });
  npc(s, 'gamin', at(53, y, 27), 200, {
    character: 'core:child',
    name: 'door.npc.kid',
    dialogue: 'gamin',
    mode: 'wander',
    wanderRadius: 4,
    speed: 1.8,
  });

  // --- Epilogue markers --------------------------------------------------------------------------
  s.entity('spawn_epilogue', L.spawnEpilogue, { 'core.spawn': {} }, { yaw: 0 });
  s.entity('marque_mira_epilogue', L.miraEpilogue, { 'core.marker': {} });
  s.entity('marque_varen_epilogue', L.varenEpilogue, { 'core.marker': {} });
  s.entity('marque_noe_epilogue', L.noeEpilogue, { 'core.marker': {} });
  s.entity(
    'registre_abandonne',
    [48.5, y + 0.63, 29.85],
    {
      'core.model': { model: 'door:ledger_open', collider: 'none' },
      'core.readable': {
        title: 'door.doc.abandoned.title',
        pages: ['door.doc.abandoned.1', 'door.doc.abandoned.2'],
        style: 'register',
        size: [0.9, 0.4, 0.7],
        offset: [0, 0, 0],
      },
      'core.conditional': { states: [{ when: { type: 'core.var', var: 'door.epilogue', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
    },
    { yaw: 10 },
  );
}

// =================================================================================================
// Galerie des Métiers (zone C) and Poste du Registre (zone D)
// =================================================================================================

function galerie(s: SceneBuilder): void {
  const v = s.volume;
  const y = G1;

  // Street paving and the balustrade overlooking the Faubourg.
  fillBox(v, [2, y - 1, 51], [93, y - 1, 60], 'door:gallery_tiles');
  railing(v, [2, 50], [93, 50], y, 'core:iron_bars');
  gateTunnel(s);
  // Stairwell of the gate tunnel: railings around the opening.
  railing(v, [63, 54], [73, 54], y);
  railing(v, [63, 51], [63, 53], y);
  s.entity('spawn_galerie', L.galleryArrival, { 'core.spawn': {} }, { yaw: 0 });
  s.entity('trig_arrivee_galerie', L.stairTop, {
    'core.trigger': {
      size: [3, 3, 3],
      once: true,
      onEnter: [{ type: 'core.completeObjective', quest: 'DOOR_Q01_EMPREINTE', objective: 'franchir' }],
    },
  });

  // The ravine and the suspended bridge.
  clearBox(v, [20, 3, 51], [28, y - 1, 86]);
  fillBox(v, [20, 2, 51], [28, 2, 86], 'door:dark_water');
  fillBox(v, [20, 1, 51], [28, 1, 86], 'door:damp_stone');
  for (let z = 53; z < 86; z += 6) {
    fillBox(v, [20, 8, z], [28, 8, z], 'door:copper_patina');
  }
  fillBox(v, [20, y - 1, 54], [28, y - 1, 56], 'door:weathered_planks_slab');
  railing(v, [19, 51], [19, 53], y);
  railing(v, [19, 57], [19, 86], y);
  railing(v, [29, 51], [29, 53], y);
  railing(v, [29, 57], [29, 86], y);
  railing(v, [20, 53], [28, 53], y, 'core:iron_bars');
  railing(v, [20, 57], [28, 57], y, 'core:iron_bars');
  for (const x of [19, 29]) {
    for (const z of [53, 57]) fillBox(v, [x, y, z], [x, y + 2, z], 'core:log_oak');
  }
  s.entity('brume_ravin', [24.5, 6, 68.5], { 'core.particles': { preset: 'smoke', color: '#8c9aa6', rate: 1.4, size: [8, 4, 30] } });
  zone(s, 'zone_pont', [24.5, y, 55.5], [9, 4, 3], 'door.zone.bridge', { showTitle: true });

  // --- East section: shops, the Poste du Registre -----------------------------------------------
  const lamps: HouseOptions = { x0: 31, z0: 61, x1: 40, z1: 71, y, h: 6, style: GALLERY_B, roofAxis: 'z', doors: [{ side: 's', at: 35 }] };
  house(v, lamps);
  privateDoor(s, 'porte_lampes', lamps, 's', 35, 'door.lock.closedShop');
  sign(s, 'enseigne_lampes', [35.5, y + 2.75, 60.94], 180, 'door.sign.lamps', [2.6, 0.5, 0.05]);
  const clock: HouseOptions = { x0: 72, z0: 61, x1: 80, z1: 71, y, h: 7, style: GALLERY, roofAxis: 'z', doors: [{ side: 's', at: 76 }] };
  house(v, clock);
  privateDoor(s, 'porte_horlogerie', clock, 's', 76, 'door.lock.closedShop');
  sign(s, 'enseigne_horlogerie', [76.5, y + 2.75, 60.94], 180, 'door.sign.clock', [2.6, 0.5, 0.05]);
  const tea: HouseOptions = { x0: 82, z0: 61, x1: 92, z1: 74, y, h: 8, style: GALLERY_B, roofAxis: 'z', doors: [{ side: 's', at: 87 }] };
  house(v, tea);
  privateDoor(s, 'porte_the', tea, 's', 87);
  sign(s, 'enseigne_the', [87.5, y + 2.75, 60.94], 180, 'door.sign.tea', [2.6, 0.5, 0.05]);
  const behind: HouseOptions = { x0: 31, z0: 74, x1: 46, z1: 85, y, h: 9, style: GALLERY, roofAxis: 'x' };
  house(v, behind);
  const behind2: HouseOptions = { x0: 72, z0: 74, x1: 92, z1: 85, y, h: 10, style: GALLERY_B, roofAxis: 'x' };
  house(v, behind2);

  // Market stalls along the balustrade and the copper pipes of the gallery.
  for (const [sx, model] of [
    [34.5, 'core:stall_red'],
    [40.5, 'core:stall_blue'],
    [80.5, 'core:stall_red'],
    [87.5, 'core:stall_blue'],
  ] as const)
    deco(s, model, [sx, y, 52.2], 0);
  for (const lx of [32.5, 44.5, 60.5, 78.5, 90.5]) deco(s, 'core:lamp_post', [lx, y, 51.5]);
  deco(s, 'door:pipes', [42.5, y + 3.2, 60.92], 180);
  deco(s, 'door:pipes', [82.5, y + 3.6, 60.92], 180);
  npc(s, 'marchande', at(40, y, 54), 180, {
    character: 'door:marchande',
    name: 'door.npc.merchant',
    dialogue: 'marchande',
    barks: ['door.bark.merchant.1', 'door.bark.merchant.2', 'door.bark.merchant.3'],
    barkInterval: 16,
  });
  npc(s, 'porteur', at(84, y, 57), 270, {
    character: 'core:citizen_b',
    name: 'door.npc.porter',
    dialogue: 'porteur',
    mode: 'wander',
    wanderRadius: 5,
    barks: ['door.bark.porter.1'],
    barkInterval: 28,
  });
  zone(s, 'zone_galerie', [47.5, y, 68], [92, 10, 36], 'door.zone.gallery', { subtitle: 'door.zone.gallery.subtitle', music: 'door:music.galerie', ambience: 'core:amb_city' });

  // Poste du Registre.
  const reg: HouseOptions = { x0: 49, z0: 61, x1: 70, z1: 81, y, h: 9, style: { ...GALLERY, wall: 'door:warm_brick', window: 'core:glass_amber' }, roofAxis: 'x', windowSides: ['s', 'e', 'w'] };
  house(v, reg);
  clearBox(v, [56, y, 61], [57, y + 2, 61]);
  fillBox(v, [55, y + 3, 61], [58, y + 3, 61], 'door:copper_patina');
  sign(s, 'enseigne_registre', [56.95, y + 4.3, 60.94], 180, 'door.sign.registry', [3.4, 0.6, 0.05], 'carved', { text: '#f1d78a', bg: '#4a2e1c' });
  s.entity(
    'affiche_elias_galerie',
    [52.5, y + 1.2, 60.95],
    {
      'core.model': { model: 'door:poster_missing', collider: 'none' },
      'core.readable': {
        title: 'door.doc.poster.title',
        pages: ['door.doc.poster.1', 'door.doc.poster.2', 'door.doc.poster.3'],
        style: 'poster',
        size: [0.9, 1.1, 0.2],
        offset: [0, 0.45, 0],
        actions: [{ type: 'door.foundPoster' }],
      },
    },
    { yaw: 180 },
  );
  // Counter (guichet) with a grille: only the clerk window is open.
  fillBox(v, [50, y, 69], [69, y, 69], 'core:planks_dark');
  fillBox(v, [50, y + 1, 69], [69, y + 2, 69], 'core:iron_bars');
  clearBox(v, [54, y + 1, 69], [56, y + 1, 69]);
  clearBox(v, [59, y, 69], [61, y + 2, 69]);
  fillBox(v, [50, y + 3, 69], [69, y + 3, 69], 'door:copper_patina');
  // Varen's office (east of the hall).
  fillBox(v, [63, y, 62], [63, y + 4, 68], 'door:warm_brick');
  clearBox(v, [63, y, 65], [63, y + 1, 65]);
  s.entity(
    'porte_bureau_varen',
    [63.5, y, 65.5],
    { 'core.door': { model: 'door:door_rank1', name: 'door.door.office' }, 'door.lock': { variant: 'rank', rank: 1 } },
    { yaw: 90 },
  );
  deco(s, 'core:desk', [66.5, y, 64.2], 0);
  deco(s, 'core:chair', [66.5, y, 63.4], 0);
  deco(s, 'core:cabinet', [69.4, y, 67.0], 270);
  deco(s, 'door:paper_stack', [66.2, y + 0.82, 64.3]);
  s.entity('marque_bureau_varen', L.varenOffice, { 'core.marker': { note: 'Bureau de Varen (actes II et III).' } });
  // Hall furniture.
  deco(s, 'core:bench', [52.5, y, 64.0], 90);
  deco(s, 'core:bench', [60.5, y, 63.4], 0);
  deco(s, 'core:lantern', [50.6, y, 67.5]);
  deco(s, 'door:ledger_open', [55.5, y + 1.0, 69.5], 0);
  s.entity(
    'registre_transferts',
    [55.5, y + 1.05, 69.0],
    {
      'core.readable': {
        title: 'door.doc.transfers.title',
        pages: ['door.doc.transfers.1', 'door.doc.transfers.2', 'door.doc.transfers.3'],
        style: 'register',
        size: [0.9, 0.4, 0.6],
        offset: [0, 0, 0],
        actions: [
          { type: 'core.setVar', var: 'door.foundTransferTrace', value: true },
          { type: 'core.notify', text: 'door.notify.newLead', kind: 'discovery' },
        ],
      },
    },
  );
  npc(s, 'greffier', L.clerk, 180, {
    character: 'door:greffier',
    name: 'door.npc.clerk',
    dialogue: 'greffier',
    lookDistance: 5,
  });
  // Restricted part: corridor and the archive room of transfers.
  fillBox(v, [50, y, 73], [69, y + 3, 73], 'door:warm_brick');
  clearBox(v, [59, y, 73], [61, y + 2, 73]);
  for (const sx of [53, 57, 63, 67]) fillBox(v, [sx, y, 76], [sx, y + 2, 79], 'core:bookshelf');
  s.entity(
    'armoire_dossiers',
    L.docsCabinet,
    {
      'core.model': { model: 'core:cabinet' },
      'core.pickup': {
        item: 'door:ordre_transfert',
        prompt: 'door.prompt.searchCabinet',
        size: [0.9, 1.2, 0.9],
        offset: [0, 0.6, 0],
        hideOnTake: false,
        condition: { type: 'core.var', var: 'door.foundTransferTrace', op: '==', value: true },
        actions: [{ type: 'door.addEvidence', evidence: 'ordre' }],
      },
      'core.interactable': {
        prompt: 'door.prompt.cabinet',
        condition: { type: 'core.var', var: 'door.foundTransferTrace', op: '!=', value: true },
        actions: [{ type: 'core.notify', text: 'door.notify.cabinetUnknown', kind: 'info' }],
        size: [0.9, 1.2, 0.9],
        offset: [0, 0.6, 0],
      },
    },
    { yaw: 90 },
  );
  deco(s, 'core:lantern', [65.5, y, 79.4]);
  light(s, 'lumiere_archives_transferts', [59.5, y + 2.6, 77.5], '#ffc27a', 10);
  s.entity('marque_ronde_a', L.patrolA, { 'core.marker': {} });
  s.entity('marque_ronde_b', L.patrolB, { 'core.marker': {} });
  s.entity('marque_raccompagne', L.escortOut, { 'core.marker': { note: 'Où le garde raccompagne le joueur surpris.' } });
  s.entity('couloir_controle', at(59, y, 75), {
    'door.restricted': { size: [20, 4, 11], offset: [0, 0, 0], name: 'door.zone.restricted', escortTo: 'marque_raccompagne', allowedWhen: { type: 'core.var', var: 'door.registryPass', op: '==', value: true } },
  });
  npc(
    s,
    'garde_ronde',
    L.patrolA,
    0,
    { character: 'door:garde', name: 'door.npc.patrol', dialogue: 'garde_ronde', mode: 'patrol', patrol: ['marque_ronde_a', 'marque_ronde_b'], patrolWait: 6, speed: 1.1, lookAtPlayer: false },
    { 'door.watcher': { range: 7, fov: 110, zone: 'couloir_controle' } },
  );
  zone(s, 'zone_registre', [59.5, y, 71], [20, 6, 19], 'door.zone.registry', { subtitle: 'door.zone.registry.subtitle' });

  // --- West section: the pawnshop, the Archivist and the double-sealed door ---------------------
  const pawn: HouseOptions = { x0: 3, z0: 61, x1: 15, z1: 73, y, h: 7, style: GALLERY_B, roofAxis: 'z', doors: [{ side: 's', at: 9 }] };
  house(v, pawn);
  const pd = doorSpot(pawn, 's', 9);
  s.entity('porte_clou_dore', pd.pos, { 'core.door': { model: 'door:door_rank1', name: 'door.door.pawn' }, 'door.lock': { variant: 'rank', rank: 1 } }, { yaw: pd.yaw });
  sign(s, 'enseigne_clou', [9.5, y + 2.75, 60.94], 180, 'door.sign.pawn', [2.6, 0.5, 0.05], 'plaque', { text: '#f1d78a', bg: '#3b2a1c' });
  fillBox(v, [4, y, 67], [14, y, 67], 'core:planks_dark');
  clearBox(v, [11, y, 67], [11, y, 67]);
  for (const sx of [4, 14]) deco(s, 'core:shelf', [sx + 0.5, y, 70.5], sx === 4 ? 90 : 270);
  deco(s, 'core:key_rack', [9.5, y + 1.3, 72.93], 180);
  deco(s, 'core:chest', [12.5, y, 71.5], 180);
  deco(s, 'core:lantern', [6.5, y, 68.5]);
  s.entity('coffre_saisies', L.sealedChest, {
    'core.model': { model: 'core:chest' },
    'core.pickup': {
      item: 'door:plaque_elias',
      prompt: 'door.prompt.chest',
      size: [0.9, 0.8, 0.7],
      offset: [0, 0.4, 0],
      hideOnTake: false,
      actions: [{ type: 'door.addEvidence', evidence: 'plaque' }],
    },
  }, { yaw: 180 });
  npc(s, 'odran', L.odran, 180, { character: 'door:odran', name: 'door.npc.odran', dialogue: 'odran', barks: ['door.bark.odran.1'], barkInterval: 25 });
  zone(s, 'zone_clou', [9, y, 67], [11, 5, 11], 'door.zone.pawn');

  fillBox(v, [2, y - 1, 74], [18, y - 1, 86], 'door:gallery_tiles');
  deco(s, 'core:desk', [14.5, y, 84.0], 180);
  deco(s, 'core:books_stack', [14.2, y + 0.82, 84.1]);
  deco(s, 'core:lamp_post_blue', [6.5, y, 84.5]);
  deco(s, 'core:lamp_post_blue', [17.0, y, 78.5]);
  npc(s, 'eda', L.eda, 180, { character: 'door:eda', name: 'door.npc.eda', dialogue: 'eda', lookDistance: 6 });
  // The double-sealed door in the upper retaining wall.
  fillBox(v, [8, y, 87], [13, y + 4, 87], 'door:archive_stone');
  fillBox(v, [8, y + 4, 87], [13, y + 4, 87], 'door:mark_seal');
  clearBox(v, [10, y, 87], [11, y + 2, 87]);
  s.entity(
    'porte_archives',
    L.archivesDoor,
    { 'core.door': { model: 'door:door_rank2', name: 'door.door.archives', width: 2, height: 3 }, 'door.lock': { variant: 'rank', rank: 2 } },
    { yaw: 0 },
  );
  sign(s, 'enseigne_archives', [11, y + 4.55, 86.92], 180, 'door.sign.archives', [3.2, 0.55, 0.05], 'carved', { text: '#cfe3ff', bg: '#3a4552' });
  // Archives stair inside the upper wall.
  clearBox(v, [9, y, 88], [12, y + 3, 90]);
  stairs(v, [13, y, 88], 'x+', 12, 3, 'door:archive_stone', { slab: 'door:archive_stone_slab', fillBelow: true, clearAbove: 4 });
  for (let x = 15; x <= 27; x += 6) {
    const step = Math.floor((x - 13) / 2);
    v.set(x, y + step + 3, 91, 'core:lamp_blue');
  }
  light(s, 'lumiere_palier_archives', [10.5, y + 2.5, 89.5], '#9cc8ff', 10);
  zone(s, 'zone_seuil_archives', [10, y, 80], [16, 6, 12], 'door.zone.archivesThreshold');
}

/** Gate tunnel: a landing behind the gallery gate, then a stair climbing east inside the retaining
 * wall; its upper part opens into the gallery floor (carved after the street paving). */
function gateTunnel(s: SceneBuilder): void {
  const v = s.volume;
  const y = G0;
  clearBox(v, [46, y, 51], [49, y + 3, 53]);
  stairs(v, [50, y, 51], 'x+', 12, 3, 'door:damp_stone', { slab: 'door:damp_stone_slab', fillBelow: true, clearAbove: 4 });
  for (let x = 52; x <= 64; x += 6) {
    const step = Math.floor((x - 50) / 2);
    v.set(x, y + step + 3, 54, 'core:lamp_warm');
  }
  for (const x of [53, 59]) {
    const step = Math.floor((x - 50) / 2);
    fillBox(v, [x, y + step + 2, 50], [x, y + step + 3, 50], 'core:iron_bars');
  }
}

// =================================================================================================
// Archives du Haut (zone E)
// =================================================================================================

function archives(s: SceneBuilder): void {
  const v = s.volume;
  const y = G2;
  railing(v, [2, 87], [93, 87], y, 'core:iron_bars');
  // Stairwell of the archives stair.
  railing(v, [28, 91], [36, 91], y);
  railing(v, [28, 88], [28, 90], y);
  s.entity('spawn_archives', L.archivesArrival, { 'core.spawn': {} }, { yaw: 0 });
  for (const lx of [30.5, 46.5, 62.5]) deco(s, 'core:lamp_post_blue', [lx, y, 93.5]);

  // The Archives: one long hall of registers, the gear room to the east.
  const hall: HouseOptions = { x0: 26, z0: 96, x1: 72, z1: 117, y, h: 11, style: UPPER, flatRoof: 'door:archive_stone_slab', windowEvery: 4, windowSides: ['s', 'n'] };
  house(v, hall);
  clearBox(v, [38, y, 96], [40, y + 3, 96]);
  fillBox(v, [37, y + 4, 96], [41, y + 4, 96], 'door:archive_trim');
  sign(s, 'enseigne_archives_haut', [39.5, y + 5.6, 95.92], 180, 'door.sign.archivesHall', [4, 0.6, 0.05], 'carved', { text: '#cfe3ff', bg: '#3a4552' });
  // Pillars with blue lamps.
  for (const px of [31, 37, 43, 49]) {
    for (const pz of [101, 107, 113]) {
      fillBox(v, [px, y, pz], [px, y + 10, pz], 'door:archive_stone');
      v.set(px, y + 4, pz - 1, 'core:lamp_blue');
    }
  }
  // Rows of registers.
  for (const rz of [99, 104, 110, 115]) {
    for (const [x0, x1] of [
      [28, 35],
      [41, 51],
    ] as const)
      fillBox(v, [x0, y, rz], [x1, y + 2, rz], 'core:bookshelf');
  }
  clearBox(v, [28, y, 110], [35, y + 2, 110]);
  for (const [lx, lz] of [
    [29.5, 102.5],
    [45.5, 102.5],
    [33.5, 112.5],
  ] as const)
    deco(s, 'door:paper_stack', [lx, y, lz], 15);
  s.entity(
    'registre_secret',
    L.register,
    {
      'core.model': { model: 'door:lectern' },
      'core.interactable': {
        prompt: 'door.prompt.register',
        size: [1.0, 1.4, 0.8],
        offset: [0, 0.7, 0],
        once: true,
        condition: { type: 'core.questStatus', quest: 'DOOR_Q03_ARCHIVES', status: 'active' },
        hideIfUnavailable: false,
        unavailableReason: 'door.prompt.register.locked',
        actions: [{ type: 'core.playCinematic', cinematic: 'C03_registre' }],
        tone: 'special',
      },
    },
    { yaw: 180 },
  );
  light(s, 'lumiere_registre', [40.5, y + 2.2, 109.5], '#bcd8ff', 9);
  zone(s, 'zone_archives', [49, y, 106.5], [46, 11, 21], 'door.zone.archives', { subtitle: 'door.zone.archives.subtitle', music: 'door:music.archives', ambience: 'core:amb_interior' });

  // Gear room.
  fillBox(v, [53, y, 97], [53, y + 10, 116], 'door:archive_stone');
  clearBox(v, [53, y, 104], [53, y + 3, 106]);
  fillBox(v, [54, y, 116], [71, y + 9, 116], 'door:gear_plate');
  fillBox(v, [71, y, 97], [71, y + 9, 116], 'door:gear_plate');
  s.entity('roue_engrenage', L.gearWheel, { 'core.model': { model: 'door:gear_wheel', collider: 'none' }, 'door.spinner': { speed: 8, axis: 'z' } }, { yaw: 180 });
  s.entity('roue_engrenage_2', [57.5, y + 3.2, 115.7], { 'core.model': { model: 'door:gear_wheel', collider: 'none' }, 'door.spinner': { speed: -12, axis: 'z' } }, { yaw: 180, scale: [0.6, 0.6, 1] });
  deco(s, 'door:pipes', [62.5, y + 7.5, 115.9], 180);
  deco(s, 'door:pipes', [70.9, y + 3.0, 106.5], 270);
  s.entity('son_engrenages', [62.5, y + 2, 110.5], { 'core.sound': { sound: 'door:amb_gears', volume: 0.7 } });
  light(s, 'lumiere_engrenages', [62.5, y + 3, 108.5], '#ffcf8a', 12);
  zone(s, 'zone_engrenages', [62.5, y, 106.5], [17, 9, 19], 'door.zone.gears');
  // The hidden hatch and the stair to the erased corridor: a stair descends westward under the
  // hall floor; only its upper part (the hatch) opens into the gear room.
  const hz = L.hatch;
  clearBox(v, [41, 24, hz.z0], [hz.x1, y - 2, hz.z1]);
  fillBox(v, [41, 23, hz.z0], [hz.x1, 23, hz.z1], 'door:erased_stone');
  stairs(v, [48, 24, hz.z0], 'x+', 7, 3, 'door:erased_stone', { slab: 'door:erased_stone_slab', fillBelow: true, clearAbove: 4 });
  fillBox(v, [41, y - 1, hz.z0], [hz.x0 - 1, y - 1, hz.z1], 'door:archive_floor');
  fillBox(v, [hz.x0, y - 1, hz.z0], [hz.x1, y - 1, hz.z1], 'door:gear_plate');
  for (const lz of [hz.z0 - 1, hz.z1 + 1]) v.set(44, 26, lz, 'core:crystal_violet');
  s.entity('passage_efface', L.portalDown, {
    'core.portal': { scene: 'porte_absente', spawn: 'spawn_arrivee', mode: 'walk', size: [1.6, 2.4, 2.6], prompt: 'door.prompt.descend' },
  });
  light(s, 'lumiere_passage', [42.5, 25.5, 104.5], '#7d6bb0', 6);

  // Towers and spires: the city above that the Faubourg only sees from below.
  for (const [tx, tz, h] of [
    [26, 96, 22],
    [72, 96, 20],
    [26, 117, 26],
    [72, 117, 24],
  ] as const) {
    cylinder(v, [tx + 0.5, tz + 0.5], 3.6, y, y + h, 'door:archive_stone', { hollow: true });
    cone(v, [tx + 0.5, tz + 0.5], 4.6, y + h + 1, 8, 'core:roof_blue');
    v.set(tx, y + h + 9, tz, 'core:lamp_blue');
  }
  cylinder(v, [49.5, 106.5], 2.6, y + 11, y + 26, 'door:archive_stone', { hollow: true });
  cone(v, [49.5, 106.5], 3.4, y + 27, 6, 'core:roof_blue');
  // Rich houses on either side of the archive plaza.
  for (const o of [
    { x0: 3, z0: 92, x1: 20, z1: 108 },
    { x0: 77, z0: 92, x1: 93, z1: 106 },
    { x0: 77, z0: 108, x1: 93, z1: 118 },
  ]) {
    const opts: HouseOptions = { ...o, y, h: 8, style: UPPER, flatRoof: 'door:archive_stone_slab' };
    const top = house(v, opts);
    pyramidRoof(v, [o.x0, top + 1, o.z0], [o.x1, top + 1, o.z1], top + 1, 'core:roof_blue', 1);
  }
  zone(s, 'zone_haut', [48, y, 92], [92, 10, 9], 'door.zone.upperTerrace', { showTitle: false, music: 'door:music.archives' });
}

/** Used by the cinematic generator. */
export function cellCenter(): Vec3Tuple {
  return [9, G0 + 1.6, 27.5];
}
