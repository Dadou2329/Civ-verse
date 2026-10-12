/**
 * Seed of the scene "reminence": the Marché des Éclats, the Atelier d'Oriane, the Maison des
 * Absences, the Jardin des Noms and the Salle de Vente.
 */
import {
  SceneBuilder,
  fillBox,
  clearBox,
  scatter,
  cylinder,
  cone,
  house,
  doorSpot,
  railing,
  deco,
  light,
  sign,
  zone,
  npc,
  model,
  type SceneDoc,
  type EnvironmentDoc,
  type HouseStyle,
  type HouseOptions,
  type Vec3Tuple,
} from '@sdk/build';
import { SIZE, G, R, TRAIL, at } from './layout.ts';

export const REMINENCE_ENV: EnvironmentDoc = {
  sky: { top: '#1f3442', horizon: '#c89a8a', bottom: '#241c2c', stars: 0.35, sunDisc: true, discColor: '#ffd2a8' },
  sun: { direction: [0.45, -0.55, -0.7], color: '#ffc89a', intensity: 0.95 },
  ambient: { color: '#8a90b0', intensity: 0.8 },
  hemi: { sky: '#a8b0d8', ground: '#4a3a4a', intensity: 0.7 },
  fog: { color: '#7a7088', density: 0.012 },
  blockLight: 1.25,
  particles: { preset: 'memory', density: 0.5 },
  music: 'memory:music.reminence',
  ambience: 'memory:amb_market',
  post: { exposure: 1.2, contrast: 1.05, saturation: 1.0, bloom: 0.55, vignette: 0.32 },
};

const PETROL: HouseStyle = { wall: 'memory:petrol_plaster', base: 'memory:black_stone', trim: 'memory:black_bricks', roof: 'memory:slate', floor: 'memory:amber_wood', window: 'memory:frosted_amber' };
const MAUVE: HouseStyle = { wall: 'memory:mauve_wood', base: 'memory:black_stone', trim: 'memory:black_bricks', roof: 'memory:slate', floor: 'memory:amber_wood', window: 'memory:frosted_mauve' };
const TEAL: HouseStyle = { wall: 'memory:teal_wood', base: 'memory:black_stone', trim: 'core:beam_dark', roof: 'memory:mauve_roof', floor: 'memory:amber_wood', window: 'memory:frosted_teal' };
const TIMBER: HouseStyle = { wall: 'memory:petrol_timber', base: 'memory:black_stone', trim: 'memory:black_bricks', roof: 'memory:mauve_roof', floor: 'memory:amber_wood', window: 'memory:frosted_amber' };
const SALLE: HouseStyle = { wall: 'memory:black_bricks', base: 'memory:black_stone', trim: 'core:ornate_trim', roof: 'memory:slate', floor: 'memory:mosaic', window: 'memory:frosted_mauve' };

function closedDoor(s: SceneBuilder, id: string, o: HouseOptions, side: 'n' | 's' | 'e' | 'w', pos: number, text = 'memory.lock.private'): void {
  const d = doorSpot(o, side, pos);
  s.entity(id, d.pos, { 'core.door': { model: 'core:door_dark', name: 'memory.door.house' }, 'memory.closed': { text } }, { yaw: d.yaw });
}

export function buildReminence(): SceneDoc {
  const s = new SceneBuilder('reminence', 'memory.scene.reminence', SIZE, REMINENCE_ENV);
  const v = s.volume;
  // Ground.
  fillBox(v, [0, 0, 0], [95, G - 2, 95], 'core:stone');
  fillBox(v, [0, G - 1, 0], [95, G - 1, 95], 'memory:paving');
  // Outer ring of tall facades hides the edge of the world.
  for (const [a, b] of [
    [
      [0, 0],
      [95, 1],
    ],
    [
      [0, 94],
      [95, 95],
    ],
    [
      [0, 0],
      [1, 95],
    ],
    [
      [94, 0],
      [95, 95],
    ],
  ] as [[number, number], [number, number]][]) {
    fillBox(v, [a[0], G, a[1]], [b[0], G + 9, b[1]], 'memory:black_bricks');
  }
  s.inFolder('Marché des Éclats', () => market(s));
  s.inFolder("Atelier d'Oriane", () => workshop(s));
  s.inFolder('Maison des Absences', () => absences(s));
  s.inFolder('Canal', () => canal(s));
  s.inFolder('Jardin des Noms', () => garden(s));
  s.inFolder('Salle de Vente', () => salle(s));
  s.inFolder('Chemin du banc', () => trail(s));
  s.inFolder('Ville', () => fillerHouses(s));
  s.inFolder('Ciel', () => {
    for (const [x, z] of [
      [30, 30],
      [66, 30],
      [48, 48],
      [20, 60],
      [76, 60],
      [48, 12],
    ] as const)
      s.entity(`fragments_toits_${x}_${z}`, [x + 0.5, G + 10, z + 0.5], { 'core.particles': { preset: 'memory', color: '#d6b4ff', rate: 1.6, size: [16, 6, 16] } });
  });
  return s.build({ camera: { position: [48, 24, 60], target: [48, 6, 30] }, notes: 'Généré par civilizations/memory/seed/reminence.ts puis édité dans le Studio.' });
}

// =================================================================================================

function inTriangle(x: number, z: number): boolean {
  const { sw, se, n } = R.market;
  const sign = (p: [number, number], a: [number, number], b: [number, number]) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const p: [number, number] = [x + 0.5, z + 0.5];
  const d1 = sign(p, sw, se);
  const d2 = sign(p, se, n);
  const d3 = sign(p, n, sw);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function market(s: SceneBuilder): void {
  const v = s.volume;
  for (let z = 20; z <= 58; z++) for (let x = 24; x <= 72; x++) if (inTriangle(x, z)) v.set(x, G - 1, z, 'memory:mosaic');
  // The Métier des souvenirs and the queue of sellers.
  s.entity('metier', R.loom, {
    'core.model': { model: 'memory:loom' },
    'memory.device': { radius: 3.5, prompt: 'memory.prompt.loom' },
    'core.sound': { sound: 'memory:machine', volume: 0.25 },
  });
  deco(s, 'memory:queue_rope', [47.5, G, 30.8], 0);
  sign(s, 'enseigne_metier', [48.5, G + 3.9, 26.9], 0, 'memory.sign.loom', [3.2, 0.55, 0.05], 'glow', { text: '#2a1a34', bg: '#e8d0ff' });
  s.entity('echo_enseigne', R.marketSign, {
    'memory.echoPoint': { echo: 'marche_rembobine', shard: '', radius: 2.5, size: [1, 1.8, 1], onFirst: [{ type: 'core.playCinematic', cinematic: 'M02_premier_echo', wait: false }] },
  });
  s.entity('marque_oriane_marche', at(41, G, 32), { 'core.marker': {} });
  npc(s, 'iris', R.sellerIris, 180, { character: 'memory:iris', name: 'memory.npc.iris', dialogue: 'iris', barks: ['memory.bark.iris.1'], barkInterval: 24 });
  npc(s, 'jules', R.sellerJules, 200, { character: 'memory:jules', name: 'memory.npc.jules', dialogue: 'jules', barks: ['memory.bark.jules.1', 'memory.bark.jules.2'], barkInterval: 18 });
  npc(s, 'file_1', R.queue[0]!, 180, { character: 'core:citizen_a', name: 'memory.npc.seller', dialogue: 'file', barks: ['memory.bark.queue.1'], barkInterval: 30 });
  npc(s, 'file_2', R.queue[1]!, 160, { character: 'core:citizen_c', name: 'memory.npc.seller', dialogue: 'file', barks: ['memory.bark.queue.2'], barkInterval: 34 });
  npc(s, 'file_3', R.queue[2]!, 200, { character: 'core:citizen_d', name: 'memory.npc.seller', dialogue: 'file', barks: ['memory.bark.queue.3'], barkInterval: 38 });
  // The bench where the protagonist wakes.
  deco(s, 'core:bench', R.bench, 180);
  s.entity('spawn_banc', R.spawn, { 'core.spawn': { isDefault: true } }, { yaw: 225 });
  // Silas and his song.
  npc(
    s,
    'silas',
    R.silas,
    120,
    {
      character: 'memory:silas',
      name: 'memory.npc.silas',
      dialogue: 'silas',
      barks: ['memory.bark.silas.1'],
      barkInterval: 26,
      idleAnimation: 'talk',
    },
    {
      'core.sound': { sound: 'memory:silas_song', volume: 0.75 },
      'memory.echoPoint': { echo: 'chanson_enfants', shard: 'ambre', radius: 3.5, size: [0.8, 1.9, 0.8], onFirst: [{ type: 'core.setVar', var: 'memory.songEcho', value: true }] },
      'memory.recognition': {
        levels: [
          { when: { type: 'core.var', var: 'memory.restorationOutcome', op: '==', value: 'acceptee' }, level: 'lie', barks: ['memory.bark.silas.restored'] },
          { when: { type: 'core.var', var: 'memory.restorationOutcome', op: '==', value: 'refusee' }, level: 'reconnu', barks: ['memory.bark.silas.strangers'] },
          { when: { type: 'memory.anchored', shard: 'jardin' }, level: 'sensation', barks: ['memory.bark.silas.sensation'] },
          { when: { type: 'core.always' }, level: 'inconnu', barks: ['memory.bark.silas.1', 'memory.bark.silas.2'] },
        ],
      },
    },
  );
  deco(s, 'memory:violin', [40.9, G + 0.02, 43.2], 30);
  s.entity('marque_silas_epilogue', R.silas, { 'core.marker': {} });
  s.entity('marque_lea_epilogue', at(41, G, 41), { 'core.marker': {} });
  s.entity('marque_lea_inconnue', at(45, G, 37), { 'core.marker': {} });
  s.entity('spawn_epilogue', at(49, G, 37), { 'core.spawn': {} }, { yaw: 225 });
  deco(s, 'core:lamp_post', [38.5, G, 43.5]);
  // Stalls around the triangle.
  for (const [x, z, yaw, m] of [
    [34, 27, 30, 'core:stall_blue'],
    [62, 27, 330, 'core:stall_red'],
    [36, 46, 120, 'core:stall_red'],
    [60, 46, 240, 'core:stall_blue'],
  ] as const)
    deco(s, m, [x + 0.5, G, z + 0.5], yaw);
  for (const [x, z] of [
    [30, 24],
    [66, 24],
    [48, 52],
    [44, 38],
    [53, 38],
  ] as const)
    deco(s, 'core:lamp_post_blue', [x + 0.5, G, z + 0.5]);
  npc(s, 'marchand', at(36, G, 29), 30, { character: 'memory:marchand', name: 'memory.npc.vendor', dialogue: 'marchand', barks: ['memory.bark.vendor.1', 'memory.bark.vendor.2'], barkInterval: 20 });
  zone(s, 'zone_marche', [48, G, 38], [52, 10, 40], 'memory.zone.market', { subtitle: 'memory.zone.market.subtitle', music: 'memory:music.reminence', ambience: 'memory:amb_market' });
}

function workshop(s: SceneBuilder): void {
  const v = s.volume;
  const w = R.workshop;
  const o: HouseOptions = { ...w, y: G, h: 6, style: TEAL, roofAxis: 'z', doors: [{ side: 'e', at: 37 }], windowSides: ['e', 'n', 's'] };
  house(v, o);
  // Wide frosted storefront.
  fillBox(v, [22, G + 1, 32], [22, G + 3, 35], 'memory:frosted_amber');
  fillBox(v, [22, G + 1, 39], [22, G + 3, 42], 'memory:frosted_amber');
  const d = doorSpot(o, 'e', 37);
  s.entity('porte_atelier', d.pos, { 'core.door': { model: 'core:door_ornate', name: 'memory.door.workshop', autoClose: 0 } }, { yaw: d.yaw });
  sign(s, 'enseigne_atelier', [22.96, G + 3.4, 37.5], 90, 'memory.sign.workshop', [2.8, 0.5, 0.05], 'plaque', { text: '#2a1a34', bg: '#e6d2b0' });
  s.entity('table_emplacements', R.slotTable, {
    'core.model': { model: 'memory:slot_table' },
    'memory.device': { radius: 3, prompt: 'memory.prompt.table' },
  }, { yaw: 180 });
  s.entity('lampe_resonance', R.resonanceLamp, {
    'core.model': { model: 'memory:resonance_lamp' },
    'core.portal': {
      scene: 'chambre_blanche',
      spawn: 'spawn_blanche',
      mode: 'interact',
      prompt: 'memory.prompt.lamp',
      condition: { type: 'core.all', of: [{ type: 'memory.anchored', shard: 'vente' }, { type: 'core.questStage', quest: 'MEM_Q03_RECONSTRUCTION', stage: 'chambre' }] },
      unavailable: 'memory.prompt.lamp.idle',
      size: [1, 2.2, 1],
    },
  });
  for (const [x, z] of [
    [9, 32],
    [9, 43],
  ] as const)
    fillBox(v, [x, G, z], [x, G + 2, z], 'memory:shard_vein');
  deco(s, 'core:shelf', [9.4, G, 36.5], 90);
  deco(s, 'core:workbench', [12.5, G, 31.4], 0);
  deco(s, 'core:books_stack', [12.1, G + 0.95, 31.3]);
  deco(s, 'memory:shard_violet', [10.5, G + 2.2, 32.5]);
  deco(s, 'memory:shard_teal', [10.6, G + 1.6, 43.2]);
  light(s, 'lumiere_atelier', [15.5, G + 3, 37.5], '#ffcf9a', 14);
  light(s, 'lumiere_atelier_fond', [11.5, G + 3, 33.5], '#e8c8ff', 12);
  light(s, 'lumiere_atelier_vitrine', [19.5, G + 3, 41.5], '#ffd8a0', 12);
  s.entity(
    'liasse_bastien',
    R.workshopDocs,
    {
      'core.model': { model: 'core:books_stack' },
      'core.pickup': {
        item: 'memory:registre_lots',
        prompt: 'memory.prompt.searchDocs',
        size: [0.8, 0.6, 0.8],
        offset: [0, 0.2, 0],
        hideOnTake: false,
        condition: { type: 'core.var', var: 'memory.bastienAsked', op: '==', value: true },
      },
    },
  );
  s.entity('spawn_atelier', at(13, G, 40), { 'core.spawn': {} }, { yaw: 90 });
  s.entity('marque_oriane_porte', at(24, G, 37), { 'core.marker': {} });
  s.entity('marque_oriane_atelier', R.orianeInside, { 'core.marker': {} });
  s.entity('marque_lea_atelier', R.leaInside, { 'core.marker': {} });
  s.entity('marque_silas_atelier', R.silasInside, { 'core.marker': {} });
  npc(
    s,
    'oriane',
    R.oriane,
    90,
    { character: 'memory:oriane', name: 'memory.npc.oriane', dialogue: 'oriane', lookDistance: 7 },
    {
      'memory.recognition': {
        levels: [
          { when: { type: 'core.var', var: 'memory.orianeConfessed', op: '==', value: true }, level: 'lie', barks: ['memory.bark.oriane.after'] },
          { when: { type: 'core.always' }, level: 'reconnu', barks: ['memory.bark.oriane.1'] },
        ],
      },
    },
  );
  zone(s, 'zone_atelier', [15, G, 37], [13, 6, 13], 'memory.zone.workshop', { subtitle: 'memory.zone.workshop.subtitle' });
}

function absences(s: SceneBuilder): void {
  const v = s.volume;
  const a = R.absences;
  const o: HouseOptions = { ...a, y: G, h: 6, style: TIMBER, roofAxis: 'z', doors: [{ side: 'w', at: 38 }], windowSides: ['w', 'n', 's'] };
  house(v, o);
  const d = doorSpot(o, 'w', 38);
  s.entity('porte_absences', d.pos, { 'core.door': { model: 'core:door_wood', name: 'memory.door.absences' } }, { yaw: d.yaw });
  sign(s, 'enseigne_absences', [73.96, G + 3.4, 38.5], 270, 'memory.sign.absences', [2.8, 0.5, 0.05]);
  for (const [x, z, yaw] of [
    [76, 32, 0],
    [87.5, 32, 0],
    [87.5, 44, 180],
  ] as const)
    deco(s, 'core:bed', [x + 0.5, G, z + 0.5], yaw);
  deco(s, 'core:table', [82.5, G, 38.5]);
  deco(s, 'core:chair', [81.5, G, 38.5], 90);
  deco(s, 'core:chair', [83.5, G, 38.5], 270);
  deco(s, 'memory:name_plaques', [80.5, G + 1.4, 45.94], 180);
  deco(s, 'core:candles', [82.5, G + 0.8, 38.5]);
  light(s, 'lumiere_absences', [82.5, G + 3, 38.5], '#ffc890', 13);
  light(s, 'lumiere_absences_lits', [80.5, G + 3, 33.5], '#e8c8ff', 11);
  npc(
    s,
    'margaux',
    R.margaux,
    270,
    { character: 'memory:margaux', name: 'memory.npc.margaux', dialogue: 'margaux' },
  );
  npc(
    s,
    'aurele',
    R.aurele,
    250,
    { character: 'memory:aurele', name: 'memory.npc.aurele', dialogue: 'aurele' },
    {
      'memory.recognition': {
        levels: [
          { when: { type: 'memory.anchored', shard: 'jardin' }, level: 'sensation', barks: ['memory.bark.aurele.song'] },
          { when: { type: 'core.always' }, level: 'inconnu', barks: ['memory.bark.aurele.1'] },
        ],
      },
    },
  );
  zone(s, 'zone_absences', [82, G, 38], [15, 6, 15], 'memory.zone.absences', { subtitle: 'memory.zone.absences.subtitle' });
  // Jules lives here too (after the market scene of the prologue he comes home).
  s.entity('marque_jules_maison', R.jules, { 'core.marker': {} });
}

function canal(s: SceneBuilder): void {
  const v = s.volume;
  clearBox(v, [2, 2, 60], [93, G - 1, 63]);
  fillBox(v, [2, 1, 60], [93, 1, 63], 'memory:black_stone');
  fillBox(v, [2, 2, 60], [93, 3, 63], 'memory:canal_water');
  fillBox(v, [2, 1, 59], [93, G - 1, 59], 'memory:black_stone');
  fillBox(v, [2, 1, 64], [93, G - 1, 64], 'memory:black_stone');
  // Parapets too high to jump over: the canal is deep.
  for (const z of [59, 64]) {
    railing(v, [2, z], [93, z], G, 'memory:black_bricks');
    railing(v, [2, z], [93, z], G + 1, 'memory:black_stone_slab');
  }
  for (const x0 of [38, 58]) {
    fillBox(v, [x0, G - 1, 59], [x0 + 3, G - 1, 64], 'memory:amber_wood');
    clearBox(v, [x0, G, 59], [x0 + 3, G + 1, 59]);
    clearBox(v, [x0, G, 64], [x0 + 3, G + 1, 64]);
    for (const x of [x0 - 1, x0 + 4]) {
      railing(v, [x, 59], [x, 64], G, 'memory:black_bricks');
      railing(v, [x, 59], [x, 64], G + 1, 'memory:black_stone_slab');
    }
    for (const z of [59, 64]) for (const x of [x0 - 1, x0 + 4]) deco(s, 'core:lantern', [x + 0.5, G + 1.5, z + 0.5]);
  }
  s.entity('reflets_canal', [48, 4, 61.5], { 'core.particles': { preset: 'motes', color: '#9ad8ff', rate: 1.2, size: [80, 2, 4] } });
}

function garden(s: SceneBuilder): void {
  const v = s.volume;
  const g = R.garden;
  fillBox(v, [g.x0, G - 1, g.z0], [g.x1, G - 1, g.z1], 'memory:garden_grass');
  // Gravel paths in a cross.
  fillBox(v, [46, G - 1, g.z0], [50, G - 1, g.z1], 'core:gravel');
  fillBox(v, [g.x0, G - 1, 78], [g.x1, G - 1, 80], 'core:gravel');
  // Hedges.
  for (const [x0, z0, x1, z1] of [
    [22, 68, 22, 92],
    [74, 68, 74, 92],
    [24, 92, 72, 92],
    [24, 74, 42, 74],
    [54, 84, 70, 84],
    [26, 84, 34, 84],
  ] as const)
    fillBox(v, [x0, G, z0], [x1, G + 1, z1], 'core:hedge');
  scatter(v, [g.x0 + 2, G, g.z0 + 1], [g.x1 - 2, G + 1, g.z1 - 1], 'memory:lavender', 0.06, 77, ['memory:garden_grass']);
  scatter(v, [g.x0 + 2, G, g.z0 + 1], [g.x1 - 2, G + 1, g.z1 - 1], 'core:tall_grass', 0.05, 91, ['memory:garden_grass']);
  // A shallow pond (one step deep: whoever walks in can climb out).
  fillBox(v, [58, G - 2, 68], [66, G - 2, 74], 'memory:black_stone');
  fillBox(v, [58, G - 1, 68], [66, G - 1, 74], 'memory:canal_water');
  // Arches.
  for (const z of [70, 88]) {
    fillBox(v, [45, G, z], [45, G + 3, z], 'memory:black_bricks');
    fillBox(v, [51, G, z], [51, G + 3, z], 'memory:black_bricks');
    fillBox(v, [45, G + 4, z], [51, G + 4, z], 'memory:black_bricks');
  }
  // Rows of small steles: names fading away.
  let k = 0;
  for (const [x, z] of [
    [27, 70],
    [31, 70],
    [35, 70],
    [27, 88],
    [31, 88],
    [56, 88],
    [60, 88],
    [64, 88],
    [68, 88],
    [56, 78],
    [70, 78],
    [27, 78],
    [38, 82],
  ] as const) {
    s.entity(`stele_${++k}`, at(x, G, z), {
      'core.model': { model: 'memory:stele_small' },
      'core.interactable': { prompt: 'memory.prompt.observe', actions: [{ type: 'core.notify', text: `memory.stele.small.${(k % 4) + 1}`, kind: 'info' }], size: [0.8, 1.2, 0.5], offset: [0, 0.5, 0] },
    }, { yaw: z > 80 ? 180 : 0 });
  }
  // The main stele: illegible without the shard, « LÉA » with it.
  s.entity(
    'stele_lea',
    R.stele,
    {
      'core.model': { model: 'memory:stele' },
      'memory.recollection': {
        shard: 'ambre',
        prompt: 'memory.prompt.observeStele',
        without: 'memory.stele.without',
        with: 'memory.stele.with',
        modelWithout: 'memory:stele',
        modelWith: 'memory:stele_lea',
        actionsWith: [
          { type: 'core.setVar', var: 'memory.steleRead', value: true },
          { type: 'core.wait', seconds: 2.5 },
          { type: 'memory.playEcho', echo: 'trois_objets' },
        ],
        size: [1, 1.8, 0.6],
      },
      'memory.echoPoint': { echo: 'trois_objets', shard: 'ambre', radius: 0, size: [1, 1.8, 0.6] },
    },
    { yaw: 180 },
  );
  for (const [i, p] of R.pedestals.entries()) {
    s.entity(`socle_${i + 1}`, p, { 'core.model': { model: 'memory:pedestal', collider: 'none' }, 'memory.pedestal': {} }, { yaw: 180 });
  }
  // The three childhood objects, scattered in the garden.
  s.entity('objet_cerf_volant', R.kite, { 'core.model': { model: 'memory:kite', collider: 'none' }, 'core.pickup': { item: 'memory:cerf_volant', size: [0.8, 1, 0.5], offset: [0, 0.3, 0] } }, { yaw: 90 });
  deco(s, 'core:bench', [R.cup[0], G, 71.4], 270);
  s.entity('objet_tasse', R.cup, { 'core.model': { model: 'memory:cup', collider: 'none' }, 'core.pickup': { item: 'memory:tasse', size: [0.5, 0.5, 0.5], offset: [0, 0, 0] } });
  fillBox(v, [36, G, 90], [36, G + 3, 90], 'memory:black_bricks');
  fillBox(v, [39, G, 90], [39, G + 3, 90], 'memory:black_bricks');
  fillBox(v, [36, G + 3, 89], [39, G + 3, 90], 'memory:black_bricks');
  s.entity('objet_clochette', R.bell, { 'core.model': { model: 'memory:bell', collider: 'none' }, 'core.pickup': { item: 'memory:clochette', size: [0.5, 0.6, 0.5], offset: [0, -0.2, 0] } });
  deco(s, 'core:lamp_post_blue', [44.5, G, 72.5]);
  deco(s, 'core:lamp_post_blue', [52.5, G, 86.5]);
  s.entity('fragments_jardin', [48, G + 2, 80], { 'core.particles': { preset: 'memory', color: '#c8a8ff', rate: 1.8, size: [20, 4, 16] } });
  zone(s, 'zone_jardin', [48, G, 79], [56, 10, 26], 'memory.zone.garden', { subtitle: 'memory.zone.garden.subtitle', music: 'memory:music.jardin' });
}

function salle(s: SceneBuilder): void {
  const v = s.volume;
  const r = R.salle;
  const o: HouseOptions = { ...r, y: G, h: 11, style: SALLE, flatRoof: 'memory:black_stone_slab', windowEvery: 4, windowSides: ['n', 'e', 'w'] };
  house(v, o);
  // Glass dome over the theater.
  for (let y = 0; y < 6; y++) cylinder(v, [42.5, 7.5], 7 - y * 1.1, G + 11 + y, G + 11 + y, 'memory:frosted_mauve', { hollow: true });
  // Monumental entrance, open (the Salle de Vente welcomes sellers).
  clearBox(v, [46, G, 18], [49, G + 3, 18]);
  fillBox(v, [45, G + 4, 18], [50, G + 4, 18], 'core:ornate_trim');
  sign(s, 'enseigne_salle', [47.95, G + 5.4, 18.96], 0, 'memory.sign.salle', [4.2, 0.6, 0.05], 'carved', { text: '#f2d8a8', bg: '#2a1e2e' });
  // Hall with the counter (the sales records lie on it); the theater is reached on both sides.
  fillBox(v, [43, G, 12], [53, G, 12], 'memory:amber_wood');
  fillBox(v, [36, G, 12], [38, G, 12], 'memory:amber_wood');
  fillBox(v, [58, G, 12], [60, G, 12], 'memory:amber_wood');
  // Theater: benches and the stage with the extraction machine.
  fillBox(v, [33, G, 3], [51, G, 6], 'memory:amber_wood_slab');
  s.entity('machine_extraction', R.machine, { 'core.model': { model: 'memory:extraction_machine' }, 'core.sound': { sound: 'memory:machine', volume: 0.35 } }, { yaw: 0 });
  for (const z of [8, 10]) for (const x of [35, 39, 43, 47]) deco(s, 'core:bench', [x + 0.5, G, z + 0.5], 180);
  deco(s, 'core:banner_blue', [33.2, G + 2, 6.5], 90);
  deco(s, 'core:banner_blue', [52.8, G + 2, 6.5], 270);
  // Archives wing.
  fillBox(v, [53, G, 3], [53, G + 4, 11], 'memory:black_bricks');
  clearBox(v, [53, G, 7], [53, G + 2, 8]);
  for (const z of [3, 9]) fillBox(v, [55, G, z], [65, G + 2, z], 'core:bookshelf');
  fillBox(v, [65, G, 4], [65, G + 2, 8], 'core:bookshelf');
  deco(s, 'core:desk', [60.5, G, 5.4], 0);
  deco(s, 'memory:register', [60.2, G + 0.82, 5.2], 10);
  s.entity(
    'armoire_copies',
    R.copiesCabinet,
    {
      'core.model': { model: 'core:cabinet' },
      'core.interactable': {
        prompt: 'memory.prompt.copies',
        size: [0.9, 1.4, 0.8],
        offset: [0, 0.6, 0],
        condition: { type: 'core.all', of: [{ type: 'core.questStatus', quest: 'MEM_Q04_SUJET_ZERO', status: 'active' }, { type: 'core.var', var: 'memory.illegalCopiesExposed', op: '==', value: true }] },
        hideIfUnavailable: false,
        unavailableReason: 'memory.prompt.copies.locked',
        once: true,
        actions: [{ type: 'core.playCinematic', cinematic: 'M04_sujet_zero' }],
        tone: 'special',
      },
    },
    { yaw: 270 },
  );
  s.entity('etiquette_sujet_zero', [R.copiesCabinet[0] - 0.47, G + 1.55, R.copiesCabinet[2]], {
    'core.sign': { text: 'memory.sign.subjectZero', size: [0.86, 0.2, 0.01], style: 'poster', color: '#3a2a1a', background: '#f2e8d2' },
    'core.conditional': { states: [{ when: { type: 'core.var', var: 'memory.illegalCopiesExposed', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
  }, { yaw: 270 });
  // The register of illegal copies, posted at the entrance once Oriane exposes it.
  s.entity('affiche_copies', [44.5, G + 1.7, 18.97], {
    'core.sign': { text: 'memory.sign.copies', size: [2.2, 1.1, 0.02], style: 'poster', color: '#2a1a2a', background: '#efe4cc' },
    'core.readable': {
      title: 'memory.doc.copies.title',
      pages: ['memory.doc.copies.1', 'memory.doc.copies.2', 'memory.doc.copies.3'],
      style: 'register',
      size: [2.2, 1.1, 0.3],
      offset: [0, -0.55, 0],
    },
    'core.conditional': { states: [{ when: { type: 'core.var', var: 'memory.illegalCopiesExposed', op: '==', value: true }, visible: 'show' }], otherwise: 'hide' },
  });
  // The sales record of lot 212, at the counter.
  s.entity(
    'fiche_vente',
    [48.5, G + 1.05, 12.5],
    {
      'core.model': { model: 'memory:register', collider: 'none' },
      'core.readable': {
        title: 'memory.doc.fiche.title',
        pages: ['memory.doc.fiche.1', 'memory.doc.fiche.2', 'memory.doc.fiche.3'],
        style: 'register',
        size: [0.9, 0.4, 0.7],
        offset: [0, 0, 0],
        condition: { type: 'core.var', var: 'memory.ficheAccess', op: '==', value: true },
        actions: [{ type: 'core.setVar', var: 'memory.ficheRead', value: true }],
      },
    },
  );
  light(s, 'lumiere_hall', [48.5, G + 3, 15.5], '#e8c8ff', 13);
  light(s, 'lumiere_scene', [42.5, G + 3, 6.5], '#d6b4ff', 13);
  light(s, 'lumiere_archives_salle', [60.5, G + 3, 6.5], '#ffd8a0', 12);
  npc(s, 'bastien', R.bastien, 0, { character: 'memory:bastien', name: 'memory.npc.bastien', dialogue: 'bastien', lookDistance: 5 });
  npc(s, 'vel', R.vel, 0, { character: 'memory:vel', name: 'memory.npc.vel', dialogue: 'vel', lookDistance: 6 });
  npc(
    s,
    'lea',
    R.lea,
    0,
    { character: 'memory:lea', name: 'memory.npc.lea', dialogue: 'lea', lookDistance: 5 },
    {
      'memory.recognition': {
        levels: [
          { when: { type: 'core.var', var: 'memory.restorationOutcome', op: 'exists' }, level: 'lie', barks: [] },
          { when: { type: 'core.var', var: 'memory.metLea', op: '==', value: true }, level: 'reconnu', barks: ['memory.bark.lea.1'] },
          { when: { type: 'core.always' }, level: 'inconnu', barks: [] },
        ],
      },
    },
  );
  s.entity('marque_oriane_salle', R.orianeSalle, { 'core.marker': {} });
  zone(s, 'zone_salle', [48, G, 10], [36, 12, 16], 'memory.zone.salle', { subtitle: 'memory.zone.salle.subtitle', music: 'memory:music.salle' });
  // Back door, where the path of the bench begins.
  s.volume.set(30, G, 8, null);
  s.volume.set(30, G + 1, 8, null);
  s.entity('porte_service', [30.5, G, 8.5], { 'core.door': { model: 'core:door_dark', name: 'memory.door.service' }, 'memory.closed': { text: 'memory.lock.service' } }, { yaw: 90 });
  s.entity('seuil_service', [29.2, G, 8.5], {
    'memory.recollection': {
      shard: 'chemin',
      prompt: 'memory.prompt.observeService',
      without: 'memory.service.without',
      with: 'memory.service.with',
      actionsWith: [{ type: 'core.setVar', var: 'memory.backDoorMemory', value: true }],
      size: [0.8, 1.8, 1.2],
    },
  });
  s.entity('marque_oriane_epilogue', at(45, G, 20), { 'core.marker': {} });
  s.entity('marque_lea_archives', R.lea, { 'core.marker': {} });
  // Where the queue of sellers goes once the register of copies is posted.
  for (const [i, [x, z]] of [
    [43, 21],
    [46, 22],
    [42, 23],
  ].entries())
    s.entity(`marque_file_affiche_${i + 1}`, at(x!, G, z!), { 'core.marker': {} });
  s.entity('marque_vel_epilogue', at(48, G, 17), { 'core.marker': {} });
}

function trail(s: SceneBuilder): void {
  TRAIL.forEach((p, i) => {
    s.entity(`pas_${i + 1}`, [p[0], p[1] + 0.05, p[2]] as Vec3Tuple, {
      'core.particles': { preset: 'motes', color: '#ffc070', rate: 0.6, size: [1, 0.3, 1] },
      'core.conditional': { states: [{ when: { type: 'memory.anchored', shard: 'chemin' }, visible: 'show' }], otherwise: 'hide' },
    });
  });
}

function fillerHouses(s: SceneBuilder): void {
  const v = s.volume;
  let n = 0;
  const add = (o: Omit<HouseOptions, 'y' | 'style'>, style: HouseStyle, door?: { side: 'n' | 's' | 'e' | 'w'; at: number }) => {
    const opts: HouseOptions = { ...o, y: G, style, doors: door ? [door] : [] };
    house(v, opts);
    if (door) closedDoor(s, `porte_maison_${++n}`, opts, door.side, door.at, n % 3 === 0 ? 'memory.lock.forgot' : 'memory.lock.private');
  };
  add({ x0: 4, z0: 46, x1: 16, z1: 56, h: 7, roofAxis: 'x' }, MAUVE, { side: 'e', at: 51 });
  add({ x0: 4, z0: 12, x1: 16, z1: 26, h: 8, roofAxis: 'z' }, PETROL, { side: 'e', at: 18 });
  add({ x0: 18, z0: 12, x1: 26, z1: 24, h: 6, roofAxis: 'z' }, TIMBER);
  add({ x0: 26, z0: 46, x1: 34, z1: 56, h: 6, roofAxis: 'x' }, PETROL, { side: 's', at: 30 });
  add({ x0: 62, z0: 46, x1: 70, z1: 56, h: 7, roofAxis: 'x' }, MAUVE, { side: 's', at: 66 });
  add({ x0: 76, z0: 48, x1: 90, z1: 56, h: 8, roofAxis: 'x' }, TEAL, { side: 'w', at: 52 });
  add({ x0: 70, z0: 6, x1: 90, z1: 24, h: 9, roofAxis: 'x' }, TIMBER, { side: 'w', at: 15 });
  add({ x0: 4, z0: 66, x1: 16, z1: 80, h: 7, roofAxis: 'z' }, MAUVE);
  add({ x0: 80, z0: 66, x1: 92, z1: 80, h: 7, roofAxis: 'z' }, PETROL);
  add({ x0: 4, z0: 82, x1: 16, z1: 92, h: 6, roofAxis: 'x' }, TEAL);
  add({ x0: 80, z0: 82, x1: 92, z1: 92, h: 8, roofAxis: 'x' }, TIMBER);
  // A bell tower over the market, the city's silhouette.
  cylinder(v, [88.5, 88.5], 3.2, G, G + 18, 'memory:black_bricks', { hollow: true });
  cone(v, [88.5, 88.5], 4.2, G + 19, 7, 'memory:mauve_roof');
  v.set(88, G + 26, 88, 'memory:amber_lamp');
  // Names nobody remembers, on the walls.
  deco(s, 'memory:name_plaques', [16.96, G + 1.4, 50.5], 90);
  deco(s, 'memory:name_plaques', [33.5, G + 1.4, 45.96], 180);
  deco(s, 'memory:name_plaques', [69.96, G + 1.4, 16.5], 270);
  model(s, 'plaques_marche', 'memory:name_plaques', [61.5, G + 1.4, 45.96], 180);
}
