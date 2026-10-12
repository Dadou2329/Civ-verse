/**
 * Seed of the scene « rives »: the Rives Basses of Viremasque — the hero's home district — and,
 * above it on the cliff, the upper tiers of the city seen from below.
 */
import { SceneBuilder, fillBox, clearBox, gableRoof, scatter, line, type EnvironmentDoc, type VoxelVolume } from '@sdk/build';
import { deco, light, model, npc, sign } from '@sdk/build';
import { SIZE, G, ATELIER, CANAL, QUAI_SUD, QUAI_NORD, PONTS, MARCHE, BUREAU, ESTRADE, MOULIN, RAIL, railY, ECHAFAUDAGES, STATION, ETAGES, P } from './layout.ts';
import { buildChapitre1 } from './chapitre1.ts';

/** Shorthands for the conditions of the Prologue quest. */
const stage = (st: string) => ({ type: 'core.questStage', quest: 'prologue', stage: st });
const hasItem = (item: string) => ({ type: 'core.hasItem', item, count: 1 });

export const RIVES_ENV: EnvironmentDoc = {
  sky: { top: '#3f7fc4', horizon: '#f2d9b0', bottom: '#8a7a68', stars: 0, sunDisc: true },
  // Morning sun from the south-east: the faces turned toward the cliff (north) are lit.
  sun: { direction: [-0.35, -0.75, 0.55], color: '#fff0d6', intensity: 1.15 },
  ambient: { color: '#b8a890', intensity: 0.6 },
  hemi: { sky: '#cfe0f2', ground: '#8a6a4a', intensity: 0.55 },
  fog: { color: '#e8dcc6', density: 0.0045 },
  blockLight: 1,
  particles: { preset: 'dust', density: 0.12 },
  music: 'mask:music.rives',
  ambience: 'mask:amb_rives',
  post: { exposure: 1.05, contrast: 1.04, saturation: 1.12, bloom: 0.3, vignette: 0.25 },
} as EnvironmentDoc;

type V3 = [number, number, number];

/** Sets several voxels at once: put(v, [x, y, z, id], …). */
function put(v: VoxelVolume, ...cells: [number, number, number, string][]): void {
  for (const [x, y, z, id] of cells) v.set(x, y, z, id);
}


interface Facade {
  base: string;
  upper: string;
  trim: string;
  roof: string;
  shutter: string;
}

const FACADES: Facade[] = [
  { base: 'mask:enduit_ocre', upper: 'mask:colombage_ocre', trim: 'mask:poutre', roof: 'mask:tuile', shutter: 'mask:bois_bleu' },
  { base: 'mask:enduit_rose', upper: 'mask:colombage_rose', trim: 'mask:poutre', roof: 'mask:tuile', shutter: 'mask:bois_vert' },
  { base: 'mask:enduit_creme', upper: 'mask:enduit_creme', trim: 'mask:bois_bleu', roof: 'mask:tuile_vernie', shutter: 'mask:bois_jaune' },
  { base: 'mask:brique_rives', upper: 'mask:colombage_ocre', trim: 'mask:poutre', roof: 'mask:tuile', shutter: 'mask:bois_rouge' },
  { base: 'mask:enduit_ocre', upper: 'mask:enduit_rose', trim: 'mask:bois_sarcelle', roof: 'mask:tuile', shutter: 'mask:bois_sarcelle' },
];

/**
 * A two-storey house of the Rives: plinth, painted shutters on both floors, a door on the street
 * side, half-timber upstairs and a terracotta roof. Closed (the inside is not visited).
 */
function maison(v: VoxelVolume, x0: number, z0: number, x1: number, z1: number, f: Facade, door: 'n' | 's', floors = 2): number {
  const h = floors * 4 + 1;
  fillBox(v, [x0, G - 3, z0], [x1, G - 1, z1], 'mask:pierre_usee');
  for (let y = G; y < G + h; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const edgeX = x === x0 || x === x1;
        const edgeZ = z === z0 || z === z1;
        if (!edgeX && !edgeZ) continue;
        let id = y < G + 4 ? f.base : f.upper;
        if (y === G) id = 'mask:pierre_usee';
        if ((edgeX && edgeZ) || y === G + 4 || y === G + h - 1) id = f.trim;
        v.set(x, y, z, id);
      }
  // Windows with shutters on both long sides, every 3 blocks.
  for (let fl = 0; fl < floors; fl++) {
    const wy = G + 1 + fl * 4;
    for (let x = x0 + 2; x <= x1 - 2; x += 3) {
      for (const z of [z0, z1]) {
        put(v, [x, wy, z, 'mask:vitre_atelier'], [x, wy + 1, z, 'mask:vitre_atelier']);
        const out = z === z0 ? z - 1 : z + 1;
        if (x - 1 > x0) put(v, [x - 1, wy, out, f.shutter], [x - 1, wy + 1, out, f.shutter]);
        if (x + 1 < x1) put(v, [x + 1, wy, out, f.shutter], [x + 1, wy + 1, out, f.shutter]);
      }
    }
  }
  // Door (painted wood, closed) in the middle of the street side.
  const dx = Math.floor((x0 + x1) / 2);
  const dz = door === 'n' ? z1 : z0;
  put(v, [dx, G, dz, f.shutter], [dx, G + 1, dz, f.shutter], [dx, G + 2, dz, f.trim]);
  const step = door === 'n' ? dz + 1 : dz - 1;
  v.set(dx, G - 1, step, 'mask:pierre_usee');
  return gableRoof(v, [x0, G + h, z0], [x1, G + h, z1], G + h, 'x', f.roof, { gableId: f.upper, overhang: 1 });
}

function ground(v: VoxelVolume): void {
  const [sx, , sz] = SIZE;
  fillBox(v, [0, 0, 0], [sx - 1, 3, sz - 1], 'mask:pierre_usee');
  fillBox(v, [0, 4, 0], [sx - 1, G - 2, sz - 1], 'mask:terre');
  fillBox(v, [0, G - 1, 0], [sx - 1, G - 1, sz - 1], 'mask:pave_chaud');
  // Canal: stone walls, water, quays on both sides.
  fillBox(v, [0, 3, CANAL.z0], [sx - 1, G - 1, CANAL.z1], 'mask:moellons');
  clearBox(v, [0, 4, CANAL.z0 + 1], [sx - 1, G - 1, CANAL.z1 - 1]);
  fillBox(v, [0, 4, CANAL.z0 + 1], [sx - 1, CANAL.water, CANAL.z1 - 1], 'mask:eau_canal');
  fillBox(v, [0, G - 1, QUAI_SUD.z0], [sx - 1, G - 1, QUAI_SUD.z1], 'mask:quai');
  fillBox(v, [0, G - 1, QUAI_NORD.z0], [sx - 1, G - 1, QUAI_NORD.z1], 'mask:quai');
  // Low parapets along the water, interrupted at the bridges.
  for (let x = 0; x < sx; x++) {
    if (PONTS.some((p) => x >= p && x <= p + 3)) continue;
    if (x % 9 === 4) continue;
    put(v, [x, G, CANAL.z0, 'mask:pierre_usee_dalle'], [x, G, CANAL.z1, 'mask:pierre_usee_dalle']);
  }
  // Bridges: painted wooden decks with railings.
  for (const p of PONTS) {
    fillBox(v, [p, G - 1, CANAL.z0], [p + 3, G - 1, CANAL.z1], 'mask:planches');
    fillBox(v, [p, G - 2, CANAL.z0 + 1], [p + 3, G - 2, CANAL.z1 - 1], 'mask:poutre');
    for (const x of [p, p + 3]) fillBox(v, [x, G, CANAL.z0 + 1], [x, G, CANAL.z1 - 1], 'mask:bois_rouge');
  }
  // Grass and wild plants along the edges and between the stones.
  scatter(v, [0, G, 0], [sx - 1, G, CANAL.z0 - 1], 'mask:herbe_folle', 0.018, 11, ['mask:pave_chaud']);
  scatter(v, [0, G, QUAI_NORD.z1 + 1], [sx - 1, G, 99], 'mask:herbe_folle', 0.012, 12, ['mask:pave_chaud']);
  scatter(v, [0, G, 0], [sx - 1, G, 99], 'mask:fleurs_rouges', 0.004, 13, ['mask:pave_chaud']);
}

function atelier(s: SceneBuilder): void {
  const v = s.volume;
  const { x0, x1, z0, z1, roomY } = ATELIER;
  fillBox(v, [x0, G - 3, z0], [x1, G - 1, z1], 'mask:pierre_usee');
  fillBox(v, [x0 + 1, G - 1, z0 + 1], [x1 - 1, G - 1, z1 - 1], 'mask:planches');
  for (let y = G; y <= roomY + 4; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const edgeX = x === x0 || x === x1;
        const edgeZ = z === z0 || z === z1;
        if (!edgeX && !edgeZ) continue;
        let id = y < roomY - 1 ? 'mask:brique_rives' : 'mask:colombage_ocre';
        if ((edgeX && edgeZ) || y === roomY - 1 || y === roomY + 4) id = 'mask:poutre';
        v.set(x, y, z, id);
      }
  // Upstairs floor.
  fillBox(v, [x0 + 1, roomY - 1, z0 + 1], [x1 - 1, roomY - 1, z1 - 1], 'mask:planches');
  // Stairs along the west wall, rising southward from the gate side: a half step then a full
  // step per meter (walkable without jumping), filled underneath. The upper floor is open above
  // the steps that need headroom; a railing closes the opening upstairs.
  const rise = roomY - G;
  for (let k = 0; k < rise; k++) {
    const y = G + k;
    const zHalf = z1 - 1 - 2 * k;
    for (const x of [x0 + 1, x0 + 2]) {
      if (k > 0) fillBox(v, [x, G, zHalf], [x, y - 1, zHalf], 'mask:planches');
      v.set(x, y, zHalf, 'mask:planches_dalle');
      fillBox(v, [x, G, zHalf - 1], [x, y, zHalf - 1], 'mask:planches');
    }
  }
  // (Headroom: a 1.8 m body on a step must clear the floor above, also while stepping down.)
  clearBox(v, [x0 + 1, roomY - 1, z1 - 2 * rise + 2], [x0 + 2, roomY - 1, z1 - 2 * rise + 6]);
  fillBox(v, [x0 + 3, roomY, z1 - 2 * rise + 2], [x0 + 3, roomY, z1 - 2 * rise + 6], 'mask:bois_rouge');
  fillBox(v, [x0 + 1, roomY, z1 - 2 * rise + 7], [x0 + 2, roomY, z1 - 2 * rise + 7], 'mask:bois_rouge');
  // Workshop gate and windows (north, on the quay); the room's window above the gate.
  clearBox(v, [x0 + 5, G, z1], [x0 + 8, G + 2, z1]);
  for (const x of [x0 + 11, x0 + 12, x0 + 13]) put(v, [x, G + 1, z1, 'mask:vitre_atelier'], [x, G + 2, z1, 'mask:vitre_atelier']);
  clearBox(v, [x0 + 7, roomY + 1, z1], [x0 + 9, roomY + 2, z1]);
  fillBox(v, [x0 + 7, roomY, z1 + 1], [x0 + 9, roomY, z1 + 1], 'mask:bois_vert');
  put(v, [x0 + 7, roomY + 1, z1 + 1, 'mask:fleurs_rouges'], [x0 + 9, roomY + 1, z1 + 1, 'mask:fleurs_rouges'], [x0 + 8, roomY + 1, z1 + 1, 'mask:herbe_folle']);
  for (const x of [x0 + 2, x0 + 13]) put(v, [x, roomY + 1, z0, 'mask:vitre_atelier'], [x, roomY + 2, z0, 'mask:vitre_atelier']);
  gableRoof(v, [x0, roomY + 5, z0], [x1, roomY + 5, z1], roomY + 5, 'x', 'mask:tuile', { gableId: 'mask:colombage_ocre', overhang: 1 });
  // Sign over the gate.
  sign(s, 'enseigne_atelier', [x0 + 7, G + 3.2, z1 + 0.56], 0, 'mask.sign.atelier', [4, 0.8, 0.1], 'plaque', { text: '#f6ead8', bg: '#2f6a66' });
  // Lights: two in the workshop, one in the room.
  for (const [x, y, z] of [
    [x1 - 1, G + 3, z1 - 1],
    [x1 - 1, G + 3, z0 + 3],
    [x1 - 1, roomY + 2, z0 + 4],
  ] as V3[])
    v.set(x, y, z, 'mask:lanterne');
  s.inFolder('Atelier', () => {
    // Warm light in the room and the workshop (the windows alone leave them too dark).
    light(s, 'lumiere_chambre', [38.5, roomY + 2.6, 29.5], '#ffcf96', 13);
    light(s, 'lumiere_chambre_lit', [41.5, roomY + 2.4, 25.5], '#ffc38a', 11);
    light(s, 'lumiere_atelier', [38.5, G + 3.4, 28.5], '#ffc890', 13);
    // Upstairs: the hero's room.
    model(s, 'lit', 'mask:lit', P.lit, 0);
    fillBox(v, [x1 - 2, roomY, z1 - 2], [x1 - 1, roomY, z1 - 1], 'mask:planches_dalle');
    s.entity(
      'trophee',
      P.trophee,
      {
        'core.model': { model: 'mask:trophee' },
        'core.readable': { title: 'mask.doc.trophee.title', pages: ['mask.doc.trophee.1', 'mask.doc.trophee.2'], style: 'plaque', prompt: 'mask.prompt.trophee', size: [0.6, 0.8, 0.6], offset: [0, 0.4, 0] },
      },
      { yaw: 200 },
    );
    s.entity(
      'carte',
      P.carte,
      {
        'core.model': { model: 'mask:carte_viremasque' },
        'core.readable': {
          title: 'mask.doc.carte.title',
          pages: ['mask.doc.carte.1', 'mask.doc.carte.2', 'mask.doc.carte.3'],
          style: 'paper',
          prompt: 'mask.prompt.carte',
          size: [0.4, 1.2, 1.2],
          offset: [0, 0, 0],
          actions: [{ type: 'core.completeObjective', quest: 'prologue', objective: 'carte' }],
        },
      },
      { yaw: 270 },
    );
    s.entity(
      'affiche',
      P.affiche,
      {
        'core.model': { model: 'mask:affiche_epreuves' },
        'core.readable': {
          title: 'mask.doc.affiche.title',
          pages: ['mask.doc.affiche.1', 'mask.doc.affiche.2', 'mask.doc.affiche.3'],
          style: 'poster',
          prompt: 'mask.prompt.affiche',
          size: [0.9, 1.1, 0.5],
          offset: [0, 0, 0],
          actions: [{ type: 'core.completeObjective', quest: 'prologue', objective: 'affiche' }],
        },
      },
      { yaw: 0 },
    );
    s.entity('support_masque', P.support, { 'core.model': { model: 'mask:support_masque' } }, { yaw: 180 });
    // Where the opening cinematic leaves the hero: at the window, turned toward the stairs.
    s.entity('apres_fenetre', [37.6, roomY, 33.4], { 'core.spawn': {} }, { yaw: 225 });
    fillBox(v, [x0 + 3, roomY, z1 - 2], [x0 + 4, roomY, z1 - 2], 'mask:planches_dalle');
    s.entity(
      'cle_atelier',
      [P.table[0], P.table[1] + 0.5, P.table[2]],
      {
        'core.model': { model: 'mask:cle_atelier', collider: 'none' },
        'core.pickup': { item: 'mask:cle_atelier', prompt: 'mask.prompt.cle', size: [0.6, 0.5, 0.6], offset: [0, 0.1, 0] },
      },
      { yaw: 90 },
    );
    // Downstairs: the workshop.
    model(s, 'etabli', 'mask:etabli', P.etabli, 0);
    model(s, 'etagere', 'mask:etagere', P.etagere, 270);
    s.entity(
      'roue_rechange',
      P.roue,
      {
        'core.model': { model: 'mask:roue', collider: 'none' },
        'core.pickup': { item: 'mask:roue_rechange', prompt: 'mask.prompt.roue', size: [1, 1.1, 0.7], offset: [0, 0.55, 0] },
      },
      { yaw: 0 },
    );
    deco(s, 'mask:tonneau', [x1 - 1.7, G, z0 + 2.2]);
    deco(s, 'mask:caisse', [x1 - 1.6, G, z1 - 3.5], 15);
    npc(s, 'nora', P.nora, 180, { character: 'mask:nora', name: 'mask.npc.nora', dialogue: 'p01_nora', lookAtPlayer: true, barks: ['mask.bark.nora.1', 'mask.bark.nora.2'], barkInterval: 24 });
    s.entity('nora_chariot', P.noraChariot, { 'core.marker': {} }, { yaw: 230 });
    // Leaving the workshop: Lys calls the hero over (or reminds him of his key).
    s.entity('declencheur_lys', P.sortieAtelier, {
      'core.trigger': {
        size: [7, 3, 2.4],
        once: true,
        condition: { type: 'core.all', of: [stage('chambre'), hasItem('mask:cle_atelier')] },
        onEnter: [{ type: 'core.startDialogue', dialogue: 'p01_lys', entity: 'lys' }],
      },
    });
    s.entity('declencheur_sans_cle', P.sortieAtelier, {
      'core.trigger': {
        size: [7, 3, 2.4],
        once: false,
        condition: { type: 'core.all', of: [stage('chambre'), { type: 'core.not', condition: hasItem('mask:cle_atelier') }] },
        onEnter: [
          { type: 'core.say', entity: 'lys', text: 'mask.bark.lys.cle', seconds: 4 },
          { type: 'core.notify', text: 'mask.tuto.cle', kind: 'info' },
        ],
      },
    });
  });
}

function rueDesRives(s: SceneBuilder): void {
  const v = s.volume;
  // South bank: rows of houses facing the quay, alleys between them, laundry over the alleys.
  const front: [number, number][] = [
    [8, 20],
    [48, 58],
    [60, 71],
    [74, 85],
    [88, 99],
    [104, 115],
    [118, 130],
  ];
  front.forEach(([a, b], i) => maison(v, a, 24 + (i % 2), b, 35, FACADES[i % FACADES.length]!, 'n', i % 3 === 1 ? 3 : 2));
  const back: [number, number][] = [
    [8, 22],
    [26, 40],
    [44, 56],
    [60, 74],
    [78, 92],
    [96, 108],
    [112, 126],
  ];
  back.forEach(([a, b], i) => maison(v, a, 6, b, 16 + (i % 2), FACADES[(i + 2) % FACADES.length]!, 'n', 2));
  // Laundry over the alleys.
  for (const [x, z, yaw] of [
    [25.5, 28.5, 90],
    [46.5, 30.5, 90],
    [72.5, 29.5, 90],
    [101.5, 30.5, 90],
    [36, 19.5, 0],
    [84, 19.5, 0],
  ] as V3[])
    deco(s, 'mask:corde_linge', [x, G + 4.5, z], yaw);
  // Quay furniture.
  for (let x = 6; x < 140; x += 14) {
    deco(s, 'mask:lampadaire', [x + 0.5, G, QUAI_SUD.z1 - 0.2], 180);
    deco(s, 'mask:lampadaire', [x + 7.5, G, QUAI_NORD.z0 + 0.2], 0);
  }
  for (const [x, z] of [
    [22.5, 37.5],
    [58.5, 37.2],
    [86.5, 37.4],
    [55.5, 50.2],
  ])
    deco(s, 'mask:pot_fleurs', [x!, G, z!]);
  deco(s, 'mask:banc', [P.bastien[0], G, 41.2], 180);
  deco(s, 'mask:banc', [92.5, G, 41.2], 180);
  deco(s, 'mask:barque', [64.5, CANAL.water - 0.3, 44.5], 90);
  deco(s, 'mask:barque', [126.5, CANAL.water - 0.3, 45.2], 80);
  for (const [x, z] of [
    [27.5, 38.5],
    [61.5, 39.2],
    [108.5, 38.6],
  ])
    deco(s, 'mask:caisse', [x!, G, z!], 20);
  deco(s, 'mask:sacs', [29.5, G, 39.2]);
  // The broken cart in front of the workshop: straighten the axle with the key, then fix the
  // wheel with three hammer blows (its « health » only opens once the axle is straight).
  s.entity(
    'chariot',
    P.chariot,
    {
      'core.model': { model: 'mask:chariot_casse' },
      'core.toolTarget': {
        tool: 'cle',
        label: 'mask.use.essieu',
        holdSeconds: 1.6,
        once: true,
        condition: { type: 'core.all', of: [stage('roue'), hasItem('mask:roue_rechange')] },
        onUse: [
          { type: 'core.takeItem', item: 'mask:roue_rechange', count: 1, silent: true },
          { type: 'core.setProp', entity: 'chariot', component: 'core.model', prop: 'model', value: 'mask:chariot' },
          { type: 'core.setVar', var: 'mask.essieuAligne', value: true },
          { type: 'core.emit', event: 'mask.prologue.essieu', payload: {} },
        ],
        size: [2.8, 1.4, 1.6],
        offset: [0, 0.7, 0],
      },
      'core.health': {
        max: 24,
        faction: 'neutral',
        onlyHurtBy: ['marteau', 'braise'],
        invulnerable: true,
        knockback: 0,
        onDefeat: 'stay',
        showBar: false,
        hitSound: 'core:thud',
        immuneSound: 'core:thud',
        defeatSound: 'mask:roue_fixee',
        defeatActions: [
          { type: 'core.setVar', var: 'mask.roueFixee', value: true },
          { type: 'core.emit', event: 'mask.prologue.roueFixee', payload: {} },
        ],
      },
    },
    { yaw: 90, folder: 'Atelier' },
  );
}

function marche(s: SceneBuilder): void {
  const v = s.volume;
  const { x0, x1, z0, z1 } = MARCHE;
  fillBox(v, [x0, G - 1, z0], [x1, G - 1, z1], 'mask:pierre_usee');
  for (let x = x0; x <= x1; x += 4) for (let z = z0; z <= z1; z += 4) v.set(x, G - 1, z, 'mask:quai');
  // A low round fountain in the middle of the square.
  const cx = 73;
  const cz = 64;
  for (let x = cx - 4; x <= cx + 4; x++)
    for (let z = cz - 4; z <= cz + 4; z++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d <= 4.2 && d > 3.2) v.set(x, G, z, 'mask:moellons');
      else if (d <= 3.2) v.set(x, G - 1, z, 'mask:eau_canal');
    }
  fillBox(v, [cx, G, cz], [cx, G + 2, cz], 'mask:moellons');
  v.set(cx, G + 3, cz, 'mask:braise');
  // Houses around the square.
  // (West of the square, leaving the view from the hero's window open on the upper city.)
  maison(v, 20, 54, 32, 66, FACADES[1]!, 's', 2);
  maison(v, 20, 70, 31, 79, FACADES[3]!, 's', 3);
  maison(v, 50, 84, 58, 96, FACADES[0]!, 's', 2);
  maison(v, 76, 84, 92, 96, FACADES[4]!, 's', 2);
  // Stalls and their sellers.
  s.inFolder('Marché', () => {
    model(s, 'etal_fruits', 'mask:etal_fruits', [58.5, G, 58.5], 90);
    model(s, 'etal_tissus', 'mask:etal_tissus', [58.5, G, 70.5], 90);
    model(s, 'etal_masques', 'mask:etal_masques', [86.5, G, 70.5], 270);
    model(s, 'etal_fruits_2', 'mask:etal_fruits', [86.5, G, 58.5], 270);
    // Mireille (fruit) and Octave (fabric), rivals for the best corner of the square (Chapter I).
    npc(s, 'marchande_fruits', [56.5, G, 58.5], 90, { character: 'mask:marchande_fruits', name: 'mask.npc.mireille', dialogue: 'c1_mireille', barks: ['mask.bark.fruits.1', 'mask.bark.fruits.2'], barkInterval: 18 });
    npc(s, 'marchand_tissus', [56.5, G, 70.5], 90, { character: 'mask:marchand_tissus', name: 'mask.npc.octave', dialogue: 'c1_octave', barks: ['mask.bark.tissus.1'], barkInterval: 22 });
    npc(s, 'marchande_masques', [88.5, G, 70.5], 270, { character: 'mask:marchande_masques', name: 'mask.npc.marchande_masques', barks: ['mask.bark.masques.1', 'mask.bark.masques.2'], barkInterval: 20 });
    npc(s, 'habitant_marche_1', [70.5, G, 56.5], 0, { character: 'mask:habitant_b', name: 'mask.npc.habitant', mode: 'wander', wanderRadius: 7, speed: 1.2 });
    npc(s, 'habitant_marche_2', [78.5, G, 74.5], 180, { character: 'mask:habitant_d', name: 'mask.npc.habitante', mode: 'wander', wanderRadius: 6, speed: 1.1 });
    npc(s, 'enfant_marche', [74.5, G, 60.5], 90, { character: 'mask:enfant_a', name: 'mask.npc.enfant', mode: 'wander', wanderRadius: 5, speed: 2.2, barks: ['mask.bark.enfant.1'], barkInterval: 25 });
  });
  // The registration office (Chapter I): stone, a counter window and the city's mark.
  const b = BUREAU;
  fillBox(v, [b.x0, G - 1, b.z0], [b.x1, G - 1, b.z1], 'mask:pierre_usee');
  for (let y = G; y < G + 9; y++)
    for (let x = b.x0; x <= b.x1; x++)
      for (let z = b.z0; z <= b.z1; z++) {
        if (x !== b.x0 && x !== b.x1 && z !== b.z0 && z !== b.z1) continue;
        v.set(x, y, z, y === G || y === G + 8 ? 'mask:moellons' : 'mask:enduit_creme');
      }
  fillBox(v, [b.x0, G + 9, b.z0], [b.x1, G + 9, b.z1], 'mask:tuile_vernie_dalle');
  clearBox(v, [b.x0, G, b.z0 + 6], [b.x0, G + 2, b.z0 + 9]);
  for (const z of [b.z0 + 2, b.z0 + 13]) put(v, [b.x0, G + 4, z, 'mask:vitre_atelier'], [b.x0, G + 5, z, 'mask:vitre_atelier']);
  sign(s, 'enseigne_bureau', [b.x0 - 0.06, G + 4, b.z0 + 8], 270, 'mask.sign.bureau', [5, 1, 0.1], 'plaque', { text: '#f2e6c8', bg: '#3a4a5a' });
  // The candidates' stage (Chapter I).
  const e = ESTRADE;
  fillBox(v, [e.x0, G, e.z0], [e.x1, G, e.z1], 'mask:planches');
  for (const x of [e.x0, e.x1]) fillBox(v, [x, G + 1, e.z1], [x, G + 5, e.z1], 'mask:poutre');
  fillBox(v, [e.x0, G + 5, e.z1], [e.x1, G + 5, e.z1], 'mask:fil_banniere');
}

function moulin(s: SceneBuilder): void {
  const v = s.volume;
  const m = MOULIN;
  // A tall stone tower against the cliff: the lift shaft to the Toits du Fil.
  for (let y = G; y < ETAGES.fil.y + 6; y++)
    for (let x = m.x0; x <= m.x0 + 10; x++)
      for (let z = m.z0 + 6; z <= m.z1 + 2; z++) {
        if (x !== m.x0 && x !== m.x0 + 10 && z !== m.z0 + 6 && z !== m.z1 + 2) continue;
        v.set(x, y, z, y % 6 === 0 ? 'mask:poutre' : 'mask:moellons');
      }
  for (let y = G + 3; y < ETAGES.fil.y; y += 4) v.set(m.x0 + 5, y, m.z0 + 6, 'mask:vitre_atelier');
  gableRoof(v, [m.x0, ETAGES.fil.y + 6, m.z0 + 6], [m.x0 + 10, ETAGES.fil.y + 6, m.z1 + 2], ETAGES.fil.y + 6, 'z', 'mask:tuile', { overhang: 1 });
  // The mill race and the great wheel.
  fillBox(v, [m.x0 + 11, G - 1, m.z0 + 4], [m.x1 + 1, G - 1, m.z0 + 14], 'mask:moellons');
  fillBox(v, [m.x0 + 12, G - 2, m.z0 + 5], [m.x1, G - 1, m.z0 + 13], 'mask:eau_canal');
  model(s, 'roue_moulin', 'mask:roue_moulin', [m.x0 + 15.5, G - 3, m.z0 + 9.5], 90);
  sign(s, 'enseigne_moulin', [m.x0 + 10.6, G + 4, m.z0 + 9], 90, 'mask.sign.moulin', [4, 0.8, 0.1], 'plaque', { text: '#3a2418', bg: '#e2b23c' });
}

function monteCharge(s: SceneBuilder): void {
  const v = s.volume;
  // Loading dock carved into the cliff, where the wagon waits under its winch.
  const top = RAIL.top;
  clearBox(v, [RAIL.x - 5, top.y + 1, top.z], [RAIL.x + 5, top.y + 6, top.z + 6]);
  fillBox(v, [RAIL.x - 5, top.y, top.z], [RAIL.x + 5, top.y, top.z + 6], 'mask:planches');
  for (const x of [RAIL.x - 6, RAIL.x + 6]) fillBox(v, [x, top.y + 1, top.z], [x, top.y + 6, top.z], 'mask:poutre');
  fillBox(v, [RAIL.x - 6, top.y + 7, top.z], [RAIL.x + 6, top.y + 7, top.z], 'mask:poutre');
  fillBox(v, [RAIL.x - 5, top.y + 1, top.z + 3], [RAIL.x - 2, top.y + 4, top.z + 6], 'mask:metal_rouille');
  fillBox(v, [RAIL.x + 3, top.y + 1, top.z + 4], [RAIL.x + 5, top.y + 3, top.z + 6], 'mask:metal_rivete');
  put(v, [RAIL.x - 4, top.y + 5, top.z + 1, 'mask:lanterne'], [RAIL.x + 4, top.y + 5, top.z + 1, 'mask:lanterne']);
  sign(s, 'enseigne_monte_charge', [RAIL.x + 0.5, top.y + 7.5, top.z - 0.08], 180, 'mask.sign.monteCharge', [5, 0.8, 0.1], 'plaque', { text: '#f6ead8', bg: '#7a2a1e' });
  // The inclined rail on its trestle, down to the market.
  for (let z = RAIL.bottom.z; z <= RAIL.top.z; z++) {
    const y = railY(z);
    fillBox(v, [RAIL.x, y, z], [RAIL.x + 1, y, z], 'mask:rail');
    put(v, [RAIL.x - 1, y, z, 'mask:poutre'], [RAIL.x + 2, y, z, 'mask:poutre']);
    if (z % 5 === 0) for (let yy = G; yy < y; yy++) put(v, [RAIL.x - 1, yy, z, 'mask:poutre'], [RAIL.x + 2, yy, z, 'mask:poutre']);
  }
  // Buffer stop at the bottom; the market stalls the wagon must not reach are just beyond.
  fillBox(v, [RAIL.x - 1, G, RAIL.bottom.z - 1], [RAIL.x + 2, G + 1, RAIL.bottom.z - 1], 'mask:metal_rivete');
  // Scaffold platforms (jump from one to the next), then the brake station.
  for (const p of ECHAFAUDAGES) {
    fillBox(v, [p.x0, p.top, p.z0], [p.x1, p.top, p.z1], 'mask:planches');
    for (const [x, z] of [
      [p.x0, p.z0],
      [p.x1, p.z0],
      [p.x0, p.z1],
      [p.x1, p.z1],
    ])
      for (let y = G; y < p.top; y++) v.set(x!, y, z!, 'mask:poutre');
  }
  const st = STATION;
  fillBox(v, [st.x0, st.top, st.z0], [st.x1, st.top, st.z1], 'mask:planches');
  for (const [x, z] of [
    [st.x0, st.z0],
    [st.x1, st.z0],
    [st.x0, st.z1],
    [st.x1, st.z1],
  ])
    for (let y = G; y < st.top; y++) v.set(x!, y, z!, 'mask:poutre');
  fillBox(v, [st.x0, st.top + 1, st.z1], [st.x1, st.top + 1, st.z1], 'mask:bois_rouge');
  line(v, [st.x1, st.top + 1, st.z0 + 3], [st.x1, st.top + 1, st.z1], 'mask:bois_rouge');
  v.set(st.x0, st.top + 1, st.z1 - 1, 'mask:lanterne');
  s.inFolder('Monte-charge', () => {
    s.entity('rail_haut', P.railHaut, { 'core.marker': {} });
    s.entity('rail_bas', P.railBas, { 'core.marker': {} });
    s.entity('wagon', P.railHaut, {
      'core.model': { model: 'mask:wagon', collider: 'none' },
      'mask.monteCharge': {
        from: 'rail_haut',
        to: 'rail_bas',
        duration: 64,
        dangerAt: 0.86,
        holdSeconds: 4,
        pullBackTo: 0.5,
        holdLines: ['mask.lift.hold.1', 'mask.lift.hold.2', 'mask.lift.hold.3'],
      },
    });
    s.entity('levier', P.levier, {
      'core.model': { model: 'mask:levier' },
      'core.interactable': {
        prompt: 'mask.prompt.levier',
        size: [0.8, 1.8, 0.8],
        offset: [0, 0.9, 0],
        once: true,
        tone: 'danger',
        condition: stage('monte_charge'),
        actions: [
          { type: 'core.setProp', entity: 'levier', component: 'core.model', prop: 'model', value: 'mask:levier_tire' },
          { type: 'core.playSound', sound: 'mask:grincement', at: 'levier', volume: 1 },
          { type: 'core.setVar', var: 'mask.levierTire', value: true },
          { type: 'core.emit', event: 'mask.prologue.levier', payload: {} },
        ],
      },
    });
    s.entity(
      'frein',
      P.frein,
      {
        'core.model': { model: 'mask:frein' },
        'core.health': {
          max: 1,
          faction: 'neutral',
          onlyHurtBy: ['braise'],
          invulnerable: true,
          knockback: 0,
          onDefeat: 'stay',
          showBar: false,
          hitSound: 'core:clang',
          immuneSound: 'core:clang',
          defeatSound: 'mask:grincement',
          defeatActions: [
            { type: 'core.setProp', entity: 'frein', component: 'core.model', prop: 'model', value: 'mask:frein_libre' },
            { type: 'core.setVar', var: 'mask.freinLibere', value: true },
            { type: 'core.emit', event: 'mask.prologue.freinLibere', payload: {} },
          ],
        },
      },
      { yaw: 270 },
    );
    s.entity('repere_rampe', P.rampe, {
      // Fires once Juno is there too (she runs over the east bridge).
      'core.trigger': {
        size: [9, 4, 7],
        once: true,
        condition: { type: 'core.all', of: [stage('juno'), { type: 'core.var', var: 'mask.junoAuMonteCharge', op: '==', value: true }] },
        onEnter: [{ type: 'core.emit', event: 'mask.prologue.rampe', payload: {} }],
      },
    });
    s.entity('declencheur_station', P.station, { 'core.trigger': { size: [7, 3, 6], once: true, condition: stage('monte_charge'), onEnter: [] } });
    s.entity('juno_rampe', P.junoRampe, { 'core.marker': {} }, { yaw: 20 });
    s.entity('juno_station', P.junoStation, { 'core.marker': {} }, { yaw: 220 });
  });
  // The stalls below the rail and the people the wagon would hit.
  model(s, 'etal_bas_1', 'mask:etal_fruits', [111.5, G, 57.5], 0);
  model(s, 'etal_bas_2', 'mask:etal_tissus', [124.5, G, 57.5], 0);
  deco(s, 'mask:caisse', [116.5, G, 59.5]);
  deco(s, 'mask:caisse', [121.5, G, 60.2], 30);
  npc(s, 'habitante_bas', [113.5, G, 55.5], 0, { character: 'mask:habitant_a', name: 'mask.npc.habitante', barks: ['mask.bark.bas.1'], barkInterval: 30 });
  npc(s, 'enfant_bas', [119.5, G, 54.5], 0, { character: 'mask:enfant_b', name: 'mask.npc.enfant', mode: 'wander', wanderRadius: 3, speed: 1.6 });
  npc(s, 'habitant_bas', [123.5, G, 55.2], 0, { character: 'mask:habitant_c', name: 'mask.npc.habitant' });
}

/** Where a courier stands on the roof of each house of the Toits du Fil (filled by etages()). */
const ROOFS: V3[] = [];

/** The upper tiers of Viremasque, rising on the cliff north of the Rives (decor seen from below). */
function etages(s: SceneBuilder): void {
  const v = s.volume;
  const [sx] = SIZE;
  const tiers = [ETAGES.fil, ETAGES.milieu, ETAGES.verre, ETAGES.or];
  for (const t of tiers) fillBox(v, [0, G, t.z0], [sx - 1, t.y - 1, SIZE[2] - 1], 'mask:falaise');
  // Ivy and plants on the cliff face.
  scatter(v, [0, G, ETAGES.fil.z0], [sx - 1, ETAGES.fil.y - 1, ETAGES.fil.z0], 'mask:lierre', 0.18, 21);
  for (const t of tiers) fillBox(v, [0, t.y - 1, t.z0], [sx - 1, t.y - 1, t.z1], t === ETAGES.fil ? 'mask:quai' : t === ETAGES.or ? 'mask:or_marbre' : 'mask:pierre_usee');
  // Toits du Fil: bright houses, awnings, banners, rope bridges between roofs.
  const fil = ETAGES.fil;
  const colors = ['mask:fil_facade_bleue', 'mask:fil_facade_jaune', 'mask:fil_facade_corail'];
  ROOFS.length = 0;
  for (let i = 0, x = 4; x < sx - 12; i++, x += 11 + (i % 3)) {
    const w = 7 + (i % 3);
    const h = 6 + ((i * 5) % 4);
    const z0 = fil.z0 + 2 + (i % 2) * 2;
    fillBox(v, [x, fil.y, z0], [x + w, fil.y + h, z0 + 7], colors[i % 3]!);
    clearBox(v, [x + 1, fil.y, z0 + 1], [x + w - 1, fil.y + h - 1, z0 + 6]);
    for (let wx = x + 2; wx < x + w; wx += 3) v.set(wx, fil.y + h - 3, z0, 'mask:vitre_atelier');
    fillBox(v, [x - 1, fil.y + h + 1, z0 - 1], [x + w + 1, fil.y + h + 1, z0 + 8], i % 2 ? 'mask:toile_rayee' : 'mask:tuile_vernie_dalle');
    put(v, [x + 1, fil.y + h - 1, z0 - 1, 'mask:fil_banniere'], [x + 1, fil.y + h - 2, z0 - 1, 'mask:fil_banniere']);
    // The awning is a slab on even houses, a full block on odd ones.
    ROOFS.push([x + w / 2 + 0.5, fil.y + h + (i % 2 ? 2 : 1.5), z0 + 3.5]);
  }
  for (let x = 14; x < sx - 14; x += 22) line(v, [x, fil.y + 9, fil.z0 + 5], [x + 8, fil.y + 9, fil.z0 + 5], 'mask:planches_dalle');
  // Middle tier: the red walls of the Bastion de Fer (east, a wall walk between its towers) and
  // painted houses (west).
  const mid = ETAGES.milieu;
  for (let x = 84; x < sx; x++)
    for (let y = mid.y; y < mid.y + 7; y++)
      for (const z of [mid.z0 + 1, mid.z0 + 2]) v.set(x, y, z, y < mid.y + 6 ? 'mask:fer_pierre' : 'mask:fer_metal');
  for (let x = 85; x < sx; x += 2) v.set(x, mid.y + 7, mid.z0 + 1, 'mask:fer_pierre');
  for (const tx of [88, 108, 128]) {
    fillBox(v, [tx, mid.y, mid.z0], [tx + 6, mid.y + 12, mid.z0 + 6], 'mask:fer_pierre');
    fillBox(v, [tx - 1, mid.y + 12, mid.z0 - 1], [tx + 7, mid.y + 12, mid.z0 + 7], 'mask:fer_metal');
  }
  for (let x = 6; x < 76; x += 14) {
    fillBox(v, [x, mid.y, mid.z0 + 2], [x + 9, mid.y + 6, mid.z0 + 8], 'mask:enduit_creme');
    fillBox(v, [x - 1, mid.y + 7, mid.z0 + 1], [x + 10, mid.y + 7, mid.z0 + 9], 'mask:tuile_vernie_dalle');
  }
  // Terrasses de Verre: glass halls on pale stone.
  const verre = ETAGES.verre;
  for (let x = 8; x < 80; x += 18) {
    fillBox(v, [x, verre.y, verre.z0 + 1], [x + 12, verre.y + 7, verre.z0 + 6], 'mask:verre_terrasse');
    fillBox(v, [x, verre.y, verre.z0 + 1], [x, verre.y + 7, verre.z0 + 6], 'mask:verre_pierre');
    fillBox(v, [x + 12, verre.y, verre.z0 + 1], [x + 12, verre.y + 7, verre.z0 + 6], 'mask:verre_pierre');
    fillBox(v, [x, verre.y + 8, verre.z0 + 1], [x + 12, verre.y + 8, verre.z0 + 6], 'mask:verre_pierre');
  }
  // Jardins d'Or: hedges, gilded colonnade, and the Tour de l'Accord above everything.
  const or = ETAGES.or;
  for (let x = 4; x < sx - 4; x += 6) fillBox(v, [x, or.y, or.z0 + 1], [x + 3, or.y + 1, or.z0 + 2], 'mask:jardin_haie');
  for (let x = 30; x < 110; x += 5) fillBox(v, [x, or.y, or.z0 + 4], [x, or.y + 5, or.z0 + 4], 'mask:or_dore');
  fillBox(v, [30, or.y + 6, or.z0 + 3], [110, or.y + 6, or.z0 + 5], 'mask:or_marbre');
  // A ravine cut through the gardens, crossed by a suspended footbridge (nobles walk over it).
  const pont = { x0: 77, x1: 83 };
  clearBox(v, [pont.x0, verre.y, or.z0], [pont.x1, or.y + 6, or.z1]);
  fillBox(v, [pont.x0, or.y - 1, or.z0 + 1], [pont.x1, or.y - 1, or.z0 + 5], 'mask:planches_dalle');
  for (const z of [or.z0 + 1, or.z0 + 5]) {
    line(v, [pont.x0, or.y, z], [pont.x1, or.y, z], 'mask:grille');
    for (const x of [pont.x0, pont.x1]) fillBox(v, [x, or.y, z], [x, or.y + 2, z], 'mask:or_dore');
  }
  const tx = 68;
  const tz = 140;
  for (let y = or.y; y < SIZE[1] - 3; y++) {
    const r = y < or.y + 8 ? 3 : y < SIZE[1] - 8 ? 2 : 1;
    for (let x = tx - r; x <= tx + r; x++) for (let z = tz - r; z <= tz + r; z++) v.set(x, y, z, 'mask:tour_pierre');
  }
  fillBox(v, [tx - 1, SIZE[1] - 3, tz - 1], [tx + 1, SIZE[1] - 2, tz + 1], 'mask:tour_lumiere');
  // People up there: couriers leaping between roofs, a Fer guard stopping a cart at the edge of
  // the Fil tier, another on the Bastion wall, nobles crossing the footbridge.
  s.inFolder('Étages', () => {
    const roof = (i: number): V3 => ROOFS[i]!;
    npc(s, 'coursier_toits_1', roof(0), 90, { character: 'mask:coursier_a', name: 'mask.npc.coursier', interactable: false, lookAtPlayer: false }, { 'mask.voltige': { points: [roof(0), roof(1), roof(2), roof(3), roof(2), roof(1)], speed: 7, hop: 3, pause: 0.4 } });
    npc(s, 'coursier_toits_2', roof(7), 270, { character: 'mask:coursier_b', name: 'mask.npc.coursier', interactable: false, lookAtPlayer: false }, { 'mask.voltige': { points: [roof(7), roof(8), roof(9), roof(8)], speed: 8, hop: 2.5, pause: 0.8 } });
    model(s, 'charrette_fil', 'mask:chariot', P.charrette, 90);
    npc(s, 'charretier', [P.charrette[0] - 2.4, fil.y, P.charrette[2]], 90, { character: 'mask:habitant_c', name: 'mask.npc.habitant', interactable: false, lookAtPlayer: false });
    npc(s, 'garde_fil', [P.charrette[0] + 8.5, fil.y, P.charrette[2]], 270, { character: 'mask:garde_fer', name: 'mask.npc.garde_fer', interactable: false, lookAtPlayer: false });
    s.entity('garde_fil_halte', [P.charrette[0] + 2.6, fil.y, P.charrette[2]], { 'core.marker': {} }, { yaw: 270 });
    s.entity('garde_rempart_a', [96.5, mid.y + 7, mid.z0 + 1.5], { 'core.marker': {} });
    s.entity('garde_rempart_b', [106.5, mid.y + 7, mid.z0 + 1.5], { 'core.marker': {} });
    npc(s, 'garde_rempart', [100.5, mid.y + 7, mid.z0 + 1.5], 90, { character: 'mask:garde_fer', name: 'mask.npc.garde_fer', interactable: false, lookAtPlayer: false, mode: 'patrol', patrol: ['garde_rempart_a', 'garde_rempart_b'], patrolWait: 3, speed: 1.3 });
    s.entity('noble_a', [74.5, or.y, or.z0 + 3.5], { 'core.marker': {} });
    s.entity('noble_b', [96.5, or.y, or.z0 + 3.5], { 'core.marker': {} });
    npc(s, 'noble_jardins', [76.5, or.y, or.z0 + 3.5], 90, { character: 'mask:noble_or', name: 'mask.npc.noble_or', interactable: false, lookAtPlayer: false, mode: 'patrol', patrol: ['noble_a', 'noble_b'], patrolWait: 4, speed: 1 });
  });
}

function habitants(s: SceneBuilder): void {
  s.inFolder('Habitants', () => {
    npc(s, 'lys', P.lys, 120, { character: 'mask:lys', name: 'mask.npc.lys', dialogue: 'p01_lys', lookAtPlayer: true });
    npc(s, 'bastien', P.bastien, 200, { character: 'mask:bastien', name: 'mask.npc.bastien', dialogue: 'p01_bastien', lookAtPlayer: true });
    npc(s, 'ada', P.ada, 225, { character: 'mask:ada', name: 'mask.npc.ada', dialogue: 'p01_clients', barks: ['mask.bark.ada.1', 'mask.bark.ada.2'], barkInterval: 16 });
    npc(s, 'pol', P.pol, 45, { character: 'mask:pol', name: 'mask.npc.pol', dialogue: 'p01_clients', barks: ['mask.bark.pol.1', 'mask.bark.pol.2'], barkInterval: 19 });
    // Juno is one of the couriers on the roofs until she comes down to the workshop.
    const r = (i: number): V3 => ROOFS[i]!;
    npc(s, 'juno', r(4), 90, { character: 'mask:juno', name: 'mask.npc.juno', dialogue: 'p01_juno', lookAtPlayer: true }, { 'mask.voltige': { points: [r(4), r(5), r(6), r(5)], loop: true, speed: 8.5, hop: 2.8, pause: 0.7 } });
    s.entity('juno_arrivee', P.junoArrivee, { 'core.marker': {} }, { yaw: 270 });
    s.entity('juno_atelier', P.junoAtelier, { 'core.marker': {} }, { yaw: 200 });
    // Juno's way to the freight lift: along the south quay, over the east bridge.
    s.entity('pont_juno', [PONTS[1]! + 1.5, G, QUAI_SUD.z1 - 0.4], { 'core.marker': {} });
    s.entity('pont_juno_nord', [PONTS[1]! + 1.5, G, QUAI_NORD.z0 + 1.6], { 'core.marker': {} });
    npc(s, 'habitant_quai_1', [64.5, G, 38.5], 90, { character: 'mask:habitant_e', name: 'mask.npc.habitant', mode: 'wander', wanderRadius: 6, speed: 1, barks: ['mask.bark.quai.1'], barkInterval: 28 });
    npc(s, 'habitant_quai_2', [96.5, G, 49.5], 270, { character: 'mask:habitant_f', name: 'mask.npc.habitant', mode: 'wander', wanderRadius: 8, speed: 1.3 });
    npc(s, 'enfant_quai', [56.5, G, 38.8], 0, { character: 'mask:enfant_b', name: 'mask.npc.enfant', mode: 'wander', wanderRadius: 4, speed: 2, barks: ['mask.bark.enfant.2'], barkInterval: 22 });
  });
  // Scrap lying around (optional errand for Nora).
  s.inFolder('Ferraille', () => {
    for (const [i, pos] of (
      [
        [24.5, G, 38.4],
        [53.5, G, 37.6],
        [21.5, G, 19.5],
        [66.5, G, 50.5],
      ] as V3[]
    ).entries())
      s.entity(
        `ferraille_${i + 1}`,
        pos,
        { 'core.model': { model: 'mask:ferraille', collider: 'none' }, 'core.pickup': { item: 'mask:ferraille', prompt: 'mask.prompt.ferraille', size: [0.8, 0.5, 0.8], offset: [0, 0.2, 0] } },
        { yaw: i * 70 },
      );
  });
}

export function buildRives(): ReturnType<SceneBuilder['build']> {
  const s = new SceneBuilder('rives', 'mask.scene.rives', SIZE, RIVES_ENV);
  ground(s.volume);
  etages(s);
  rueDesRives(s);
  atelier(s);
  marche(s);
  moulin(s);
  monteCharge(s);
  habitants(s);
  buildChapitre1(s, RIVES_ENV);
  s.entity('spawn_chambre', P.spawnChambre, { 'core.spawn': { isDefault: true } }, { yaw: 0 });
  s.entity('spawn_quai', [38.5, G, 40.5], { 'core.spawn': {} }, { yaw: 90 });
  s.entity('zone_rives', [72, G, 50], { 'core.zone': { name: 'mask.zone.rives', subtitle: 'mask.zone.rives.sub', size: [144, 24, 100], offset: [0, -2, 0], showTitle: false, music: '', ambience: '' } });
  s.entity('zone_monte_charge', [116, G, 80], { 'core.zone': { name: 'mask.zone.monteCharge', subtitle: '', size: [20, 20, 44], offset: [0, -2, 0], showTitle: false, music: '', ambience: '' } });
  light(s, 'lumiere_fontaine', [73.5, G + 3.5, 64.5], '#ffb070', 10);
  return s.build({ camera: { position: [38, 30, 10], target: [40, 10, 40] } });
}
