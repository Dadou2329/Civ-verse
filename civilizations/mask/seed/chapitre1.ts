/**
 * Seed of Chapter I « Courir plus haut » in the scene « rives »: the inside of the registration
 * office, the sorting automaton of the market, the box of old masks in the workshop, the
 * washerwomen's terrace and footbridge, the fountain corner of the two merchants, the qualifying
 * course against the cliff, the party masts and Vaurel's hidden study.
 */
import { clearBox, fillBox, deco, light, model, npc, sign, type EnvironmentDoc, type SceneBuilder, type VoxelVolume } from '@sdk/build';
import { G, BUREAU, CANAL, COURSE, CABINET, LAVOIR, MATS_FETE, P1, PASSERELLE } from './layout.ts';

type V3 = [number, number, number];
type Cond = Record<string, unknown>;

const Q = 'chapitre1';
const stage = (st: string): Cond => ({ type: 'core.questStage', quest: Q, stage: st });
const status = (st: string, quest = Q): Cond => ({ type: 'core.questStatus', quest, status: st });
const v = (name: string, value: unknown = true, op = '=='): Cond => ({ type: 'core.var', var: name, op, value });
const all = (...of: Cond[]): Cond => ({ type: 'core.all', of });
const any = (...of: Cond[]): Cond => ({ type: 'core.any', of });
const not = (condition: Cond): Cond => ({ type: 'core.not', condition });
const hasItem = (item: string, count = 1): Cond => ({ type: 'core.hasItem', item, count });
const seen = (dialogue: string, node: string): Cond => ({ type: 'core.dialogueSeen', dialogue, node });
const shownWhen = (when: Cond) => ({ 'core.conditional': { states: [{ when, visible: 'show' }], otherwise: 'hide' } });

/** Sets several voxels at once: put(v, [x, y, z, id], …). */
function put(vol: VoxelVolume, ...cells: [number, number, number, string][]): void {
  for (const [x, y, z, id] of cells) vol.set(x, y, z, id);
}

// ---------------------------------------------------------------------------------------------
// I01 — the registration office
// ---------------------------------------------------------------------------------------------

function bureau(s: SceneBuilder): void {
  const vol = s.volume;
  const b = BUREAU;
  fillBox(vol, [b.x0 + 1, G - 1, b.z0 + 1], [b.x1 - 1, G - 1, b.z1 - 1], 'mask:planches');
  // The counter across the hall: a wooden bar, glass panes above it except at the window.
  const cx = 103;
  fillBox(vol, [cx, G, b.z0 + 1], [cx, G, b.z1 - 1], 'mask:poutre');
  fillBox(vol, [cx, G + 1, b.z0 + 1], [cx, G + 2, 63], 'mask:vitre_atelier');
  fillBox(vol, [cx, G + 1, 68], [cx, G + 2, b.z1 - 1], 'mask:vitre_atelier');
  fillBox(vol, [cx, G + 3, b.z0 + 1], [cx, G + 3, b.z1 - 1], 'mask:poutre');
  // Lanterns on the walls.
  put(vol, [b.x0 + 1, G + 4, b.z0 + 4, 'mask:lanterne'], [b.x0 + 1, G + 4, b.z1 - 4, 'mask:lanterne'], [b.x1 - 1, G + 4, b.z0 + 7, 'mask:lanterne']);
  s.inFolder('Chapitre I/Bureau des inscriptions', () => {
    sign(s, 'enseigne_guichet', [cx - 0.06, G + 3.5, 65.5], 270, 'mask.sign.guichet', [3.2, 0.6, 0.1], 'plaque', { text: '#f2e6c8', bg: '#3a4a5a' });
    light(s, 'lumiere_bureau', [100.5, G + 4.5, 65.5], '#ffe0b0', 13);
    light(s, 'lumiere_guichet', [105, G + 3, 65.5], '#ffd8a0', 11);
    for (const [i, z] of [60.6, 63.4, 67.6, 70.4].entries()) model(s, `etagere_dossiers_${i + 1}`, 'mask:etagere', [b.x1 - 1.4, G, z], 270);
    deco(s, 'core:desk', [105.7, G, 65.5], 270);
    deco(s, 'core:books_stack', [cx + 0.5, G + 1, 64.5], 20, { collider: 'none' });
    deco(s, 'mask:banc', [b.x0 + 1.7, G, 63], 90);
    s.entity(
      'tableau_candidats',
      [100.5, G + 1.2, b.z1 - 0.06],
      {
        'core.model': { model: 'mask:affiche_epreuves' },
        'core.readable': {
          title: 'mask.doc.tableau.title',
          pages: ['mask.doc.tableau.1', 'mask.doc.tableau.2'],
          style: 'poster',
          prompt: 'mask.prompt.tableau',
          size: [0.9, 1.1, 0.5],
          offset: [0, 0, 0],
        },
      },
      { yaw: 180 },
    );
    npc(s, 'commis', P1.commis, 270, { character: 'mask:commis', name: 'mask.npc.commis', dialogue: 'c1_commis', lookAtPlayer: true, lookDistance: 6 });
    npc(s, 'candidat', [100.2, G, 60.4], 45, { character: 'mask:candidat_a', name: 'mask.npc.candidat', dialogue: 'c1_candidat', barks: ['mask.bark.candidat.1'], barkInterval: 26 });
    npc(s, 'candidate', [101.4, G, 70.4], 160, { character: 'mask:candidate_b', name: 'mask.npc.candidate', dialogue: 'c1_candidate', barks: ['mask.bark.candidate.1'], barkInterval: 31 });
    s.entity('juno_bureau', P1.junoBureau, { 'core.marker': {} }, { yaw: 270 });
    s.entity('juno_guichet', P1.junoGuichet, { 'core.marker': {} }, { yaw: 90 });
    s.entity('lys_porte', P1.lysPorte, { 'core.marker': {} }, { yaw: 90 });
    s.entity('lys_bureau', P1.lysBureau, { 'core.marker': {} }, { yaw: 120 });
  });
}

// ---------------------------------------------------------------------------------------------
// I02 — Précision: the sorting automaton; I03 — the box of old masks
// ---------------------------------------------------------------------------------------------

function precision(s: SceneBuilder): void {
  s.inFolder('Chapitre I/Précision', () => {
    s.entity(
      'automate_tri',
      P1.automate,
      {
        'core.model': { model: 'mask:automate_tri' },
        'core.interactable': {
          prompt: 'mask.prompt.automate',
          size: [1.3, 2, 1.3],
          offset: [0, 1, 0],
          condition: status('active'),
          actions: [{ type: 'core.startDialogue', dialogue: 'c1_automate', entity: 'automate_tri' }],
        },
        'core.toolTarget': {
          tool: 'cle',
          label: 'mask.use.regler',
          holdSeconds: 0,
          once: false,
          toolSound: false,
          condition: all(v('mask.ressortPose'), not(v('mask.automateRegle'))),
          onUse: [{ type: 'mask.calibrer', entity: 'automate_tri' }],
          size: [1.3, 2, 1.3],
          offset: [0, 1, 0],
        },
        'mask.calibrage': {
          mode: 'aiguille',
          successes: 3,
          period: 1.7,
          zone: 0.22,
          shrink: 0.03,
          missDelay: 0.8,
          label: 'mask.hud.reglage',
          help: 'mask.hud.reglageAide',
          showDistance: 4,
          condition: v('mask.ressortPose'),
          onMiss: [{ type: 'core.notify', text: 'mask.notify.reglageRate', kind: 'warning' }],
          onComplete: [
            { type: 'core.setVar', var: 'mask.automateRegle', value: true },
            { type: 'core.playSound', sound: 'mask:roue_fixee', at: 'automate_tri', volume: 1 },
            { type: 'core.say', entity: 'marchande_fruits', text: 'mask.bark.mireille.trie', seconds: 3 },
            { type: 'core.wait', seconds: 1.2 },
            { type: 'core.startDialogue', dialogue: 'c1_mireille', entity: 'marchande_fruits', wait: false },
          ],
        },
      },
      { yaw: 90 },
    );
    // In the workshop, by the workbench.
    s.entity(
      'caisse_vieux_masques',
      P1.caisseMasques,
      {
        'core.model': { model: 'mask:caisse_masques' },
        'core.interactable': {
          prompt: 'mask.prompt.caisseMasques',
          size: [1.1, 0.9, 0.9],
          offset: [0, 0.45, 0],
          condition: all(v('mask.automateExamine'), not(v('mask.ch1.masqueReagi'))),
          actions: [{ type: 'core.playCinematic', cinematic: 'C11_vieux_masques', wait: false }],
        },
      },
      { yaw: 0 },
    );
    model(s, 'banc_essai', 'mask:banc_essai', P1.bancEssai, 0, { collider: 'none' });
    s.entity('masque_fendu', P1.masqueFendu, { 'core.model': { model: 'mask:masque_fil_fendu', collider: 'none' }, 'core.conditional': { states: [], otherwise: 'hide' } }, { yaw: 0 });
    // Lys's work lamp over the bench, lit only while she tests the mask (C11): the workshop light
    // alone leaves the close-up too dark.
    s.entity('lampe_banc', [P1.masqueFendu[0], P1.masqueFendu[1] + 1.2, P1.masqueFendu[2] + 0.8], { 'core.light': { color: '#ffe2b8', level: 13, offset: [0, 0, 0] }, 'core.conditional': { states: [], otherwise: 'hide' } });
    s.entity('lys_atelier', P1.lysAtelier, { 'core.marker': {} }, { yaw: 150 });
    s.entity('heros_atelier', P1.herosAtelier, { 'core.spawn': {} }, { yaw: 180 });
  });
}

// ---------------------------------------------------------------------------------------------
// I02 — Courage: the washerwomen's footbridge in the rain
// ---------------------------------------------------------------------------------------------

/** Walking height of the footbridge deck at a given z (43 → 8 … 47 → 10). */
const deckTop = (z: number) => 8 + (z - 43) * 0.5;

function lavoir(s: SceneBuilder, clearSky: EnvironmentDoc): void {
  const vol = s.volume;
  const L = LAVOIR;
  // The terrace: a stone base and a plank deck, two meters above the quay.
  clearBox(vol, [L.x0, G, L.z0], [L.x1, G + 6, L.z1]);
  fillBox(vol, [L.x0, G, L.z0], [L.x1, G, L.z1], 'mask:moellons');
  fillBox(vol, [L.x0, G + 1, L.z0], [L.x1, G + 1, L.z1], 'mask:planches');
  // Half steps down to the quay on the east side.
  for (let z = L.z1 - 2; z <= L.z1; z++) put(vol, [L.x1 + 1, G, z, 'mask:moellons'], [L.x1 + 1, G + 1, z, 'mask:planches_dalle'], [L.x1 + 2, G, z, 'mask:moellons'], [L.x1 + 3, G, z, 'mask:pierre_usee_dalle']);
  // Railings: west side, north side, the canal side except where the footbridge leaves.
  fillBox(vol, [L.x0, L.top, L.z0], [L.x0, L.top, L.z1], 'mask:bois_rouge');
  fillBox(vol, [L.x0, L.top, L.z1], [L.x1, L.top, L.z1], 'mask:bois_rouge');
  fillBox(vol, [L.x0, L.top, L.z0], [PASSERELLE.x0 - 1, L.top, L.z0], 'mask:bois_rouge');
  fillBox(vol, [PASSERELLE.x1 + 1, L.top, L.z0], [L.x1, L.top, L.z0], 'mask:bois_rouge');
  fillBox(vol, [L.x1, L.top, L.z0], [L.x1, L.top, L.z1 - 3], 'mask:bois_rouge');
  // The washing basin.
  fillBox(vol, [L.x0 + 1, L.top, L.z0 + 1], [L.x0 + 4, L.top, L.z0 + 3], 'mask:moellons');
  fillBox(vol, [L.x0 + 2, L.top, L.z0 + 2], [L.x0 + 3, L.top, L.z0 + 2], 'mask:eau_canal');
  // The footbridge: a plank deck sloping down over the canal in half steps, posts in the water.
  const P = PASSERELLE;
  clearBox(vol, [P.x0 - 1, G, CANAL.z0], [P.x1 + 1, G, CANAL.z0]);
  clearBox(vol, [P.x0 - 1, G, CANAL.z1], [P.x1 + 1, G, CANAL.z1]);
  for (let z = CANAL.z0 + 1; z <= CANAL.z1; z++) {
    const top = deckTop(z);
    const full = Math.floor(top);
    for (let x = P.x0; x <= P.x1; x++) {
      fillBox(vol, [x, z === CANAL.z1 ? G : G - 1, z], [x, full - 1, z], 'mask:planches');
      if (top > full) vol.set(x, full, z, 'mask:planches_dalle');
    }
    for (const x of [P.x0 - 1, P.x1 + 1]) fillBox(vol, [x, G - 1, z], [x, Math.ceil(top), z], 'mask:bois_rouge');
  }
  s.inFolder('Chapitre I/Courage', () => {
    deco(s, 'mask:corde_linge', [20.5, G + 6.4, 50], 0);
    deco(s, 'mask:corde_linge', [20.5, G + 6.4, 48.8], 0);
    model(s, 'pile_cagettes_linge', 'mask:pile_cagettes', [25.2, L.top, 49.6], 0);
    deco(s, 'mask:cagette_linge', [24.6, L.top, 51.4], 30);
    npc(s, 'rosalie', P1.rosalie, 180, { character: 'mask:rosalie', name: 'mask.npc.rosalie', dialogue: 'c1_rosalie', barks: ['mask.bark.rosalie.1', 'mask.bark.rosalie.2'], barkInterval: 21 });
    // Three loose anchors along the deck, to fix with the key.
    const anchors: [string, V3, number][] = [
      ['ancrage_1', [P.x0 + 0.25, deckTop(46), 46.5], 90],
      ['ancrage_2', [P.x1 + 0.75, deckTop(45), 45.5], 270],
      ['ancrage_3', [P.x0 + 0.25, deckTop(44), 44.5], 90],
    ];
    for (const [id, pos, yaw] of anchors)
      s.entity(
        id,
        pos,
        {
          'core.model': { model: 'mask:ancrage_lache', collider: 'none' },
          'core.toolTarget': {
            tool: 'cle',
            label: 'mask.use.ancrage',
            holdSeconds: 1.4,
            once: true,
            condition: v('mask.courageDemande'),
            onUse: [
              { type: 'core.setProp', entity: id, component: 'core.model', prop: 'model', value: 'mask:ancrage' },
              { type: 'core.addVar', var: 'mask.ancrages', amount: 1 },
              { type: 'core.playSound', sound: 'mask:roue_fixee', at: id, volume: 0.8 },
            ],
            size: [0.9, 0.8, 0.9],
            offset: [0, 0.3, 0],
          },
        },
        { yaw },
      );
    // Two crates of laundry slide down the wet deck, each in its lane, during the rain.
    for (const [i, x, delay] of [
      [1, 23, 0],
      [2, 24, 2],
    ] as const) {
      s.entity(`glissade_haut_${i}`, [x, deckTop(47), 47.6], { 'core.marker': {} });
      s.entity(`glissade_bas_${i}`, [x, deckTop(43), 43.2], { 'core.marker': {} });
      s.entity(`cagette_glisse_${i}`, [x, deckTop(47), 47.6], {
        'core.model': { model: 'mask:cagette_linge', collider: 'none' },
        'mask.glissade': { from: `glissade_haut_${i}`, to: `glissade_bas_${i}`, condition: v('mask.pluie'), speed: 3.4, pause: 2.6, delay, push: 6, radius: 0.7 },
      });
    }
    s.entity('declencheur_pluie', [23, G, 45.5], {
      'core.trigger': {
        size: [5, 5, 7],
        once: true,
        condition: all(v('mask.courageDemande'), not(v('mask.preuve.courage'))),
        onEnter: [
          { type: 'core.setVar', var: 'mask.pluie', value: true },
          { type: 'core.say', entity: 'rosalie', text: 'mask.bark.rosalie.pluie', seconds: 4 },
          { type: 'core.wait', seconds: 1.5 },
          { type: 'core.notify', text: 'mask.tuto.pluie', kind: 'info' },
        ],
      },
    });
    const c = clearSky;
    s.entity('averse_lavoir', [21.5, G, 47.5], {
      'mask.averse': {
        condition: v('mask.pluie'),
        size: [16, 9, 14],
        env: {
          sky: { top: '#4a5a6e', horizon: '#8a96a2', bottom: '#5a5a5e' },
          sun: { color: '#d8dce6', intensity: 0.5 },
          ambient: { color: '#8a94a2', intensity: 0.5 },
          fog: { color: '#9aa4ae', density: 0.012 },
          post: { saturation: 0.85, contrast: 1, exposure: 0.95 },
        },
        envAfter: { sky: c.sky, sun: c.sun, ambient: c.ambient, fog: c.fog, post: c.post },
        fade: 2.5,
      },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// I02 — Entraide: the fountain corner
// ---------------------------------------------------------------------------------------------

function entraide(s: SceneBuilder): void {
  // The coveted corner, east of the fountain: warmer paving.
  fillBox(s.volume, [Math.floor(P1.emplacement[0]) - 1, G - 1, 60], [Math.floor(P1.emplacement[0]) + 2, G - 1, 69], 'mask:pave_chaud');
  s.inFolder('Chapitre I/Entraide', () => {
    for (const [i, pos] of P1.cagettes.entries())
      s.entity(
        `cagette_${i + 1}`,
        pos,
        {
          'core.model': { model: 'mask:cagette', collider: 'none' },
          'core.pickup': { item: 'mask:cagette', prompt: 'mask.prompt.cagette', condition: v('mask.entraideChoix', '', 'exists'), size: [0.7, 0.5, 0.6], offset: [0, 0.2, 0] },
        },
        { yaw: i * 35 },
      );
    s.entity('emplacement_fontaine', P1.emplacement, {
      'core.interactable': {
        prompt: 'mask.prompt.deposer',
        size: [1.6, 1.2, 1.6],
        offset: [0, 0.4, 0],
        condition: all(hasItem('mask:cagette'), not(v('mask.cagettesPosees', 3, '>='))),
        actions: [
          { type: 'core.takeItem', item: 'mask:cagette', count: 1, silent: true },
          { type: 'core.addVar', var: 'mask.cagettesPosees', amount: 1 },
          { type: 'core.playSound', sound: 'core:thud', at: 'emplacement_fontaine', volume: 0.8 },
        ],
      },
    });
    for (let i = 1; i <= 3; i++)
      s.entity(
        `cagette_posee_${i}`,
        [P1.emplacement[0] + (i - 2) * 0.55, G, P1.emplacement[2] + (i % 2) * 0.4],
        { 'core.model': { model: 'mask:cagette', collider: 'none' }, ...shownWhen(all(v('mask.cagettesPosees', i, '>='), not(v('mask.cagettesPosees', 3, '>=')))) },
        { yaw: i * 25 },
      );
    // The stalls once moved to the fountain (the old ones are hidden by the logic).
    const moved = v('mask.cagettesPosees', 3, '>=');
    s.entity('etal_fontaine_fruits', P1.etalFontaineFruits, { 'core.model': { model: 'mask:etal_fruits' }, ...shownWhen(moved) }, { yaw: 270 });
    s.entity('etal_fontaine_tissus', P1.etalFontaineTissus, { 'core.model': { model: 'mask:etal_tissus' }, ...shownWhen(moved) }, { yaw: 270 });
    s.entity('mireille_fontaine', P1.mireilleFontaine, { 'core.marker': {} }, { yaw: 270 });
    // Octave comes over to argue next to Mireille's stall, then goes back to his own.
    s.entity('octave_dispute', [57.4, G, 60.8], { 'core.marker': {} }, { yaw: 180 });
    s.entity('octave_etal', [56.5, G, 70.5], { 'core.marker': {} }, { yaw: 90 });
    s.entity('octave_fontaine', P1.octaveFontaine, { 'core.marker': {} }, { yaw: 270 });
  });
}

// ---------------------------------------------------------------------------------------------
// I04 — the qualifying course
// ---------------------------------------------------------------------------------------------

function parcours(s: SceneBuilder): void {
  const vol = s.volume;
  const c = COURSE;
  const { x0, x1 } = c.corridor;
  clearBox(vol, [x0, G, 89], [x1, G + 6, 96]);
  for (const z of c.murets) fillBox(vol, [x0, G, z], [x1, G, z], 'mask:moellons');
  // Ledges A and B in front of the cliff: stone, a plank top.
  for (const L of [c.A, c.B]) {
    clearBox(vol, [L.x0, G, L.z0], [L.x1, L.top + 3, L.z1]);
    fillBox(vol, [L.x0, G, L.z0], [L.x1, L.top - 2, L.z1], 'mask:moellons');
    fillBox(vol, [L.x0, L.top - 1, L.z0], [L.x1, L.top - 1, L.z1], 'mask:planches');
  }
  // C and D carved into the cliff, and the pit between them (down to the ledges' height).
  for (const L of [c.C, c.D]) {
    clearBox(vol, [L.x0, L.top, L.z0], [L.x1, L.top + 3, L.z1]);
    fillBox(vol, [L.x0, L.top - 1, L.z0], [L.x1, L.top - 1, L.z1], 'mask:planches');
  }
  clearBox(vol, [c.D.x1 + 1, c.A.top, c.C.z0], [c.C.x0 - 1, c.C.top + 3, c.C.z1]);
  // Lanterns along the course.
  put(vol, [c.A.x0, c.A.top, c.A.z1, 'mask:lanterne'], [c.B.x1, c.B.top, c.B.z1, 'mask:lanterne'], [c.C.x1, c.C.top, c.C.z1, 'mask:lanterne'], [c.D.x0, c.D.top, c.D.z1, 'mask:lanterne']);
  s.inFolder('Chapitre I/Qualification', () => {
    const ladder = (id: string, pos: V3, modelId: string, height: number, extra: Record<string, Record<string, unknown>> = {}) =>
      s.entity(id, pos, { 'core.model': { model: modelId, collider: 'none' }, 'core.ladder': { size: [1, height, 0.8], offset: [0, 0, -0.25], speed: 2.8 }, ...extra }, { yaw: 0 });
    ladder('echelle_1', [P1.echelle1[0], G, c.A.z0 - 0.15], 'mask:echelle', c.A.top - G);
    // The second ladder comes down once the training wheel turns.
    ladder('echelle_2', [P1.echelle2[0], c.B.top, c.C.z0 - 0.15], 'mask:echelle', c.C.top - c.B.top, shownWhen(v('mask.roueLancee')));
    s.entity(
      'roue_entrainement',
      [P1.roue[0], c.B.top, c.C.z0 - 0.38],
      {
        'core.model': { model: 'mask:roue_entrainement', collider: 'none' },
        'mask.calibrage': {
          mode: 'roue',
          successes: 1,
          period: 1.6,
          zone: 0.16,
          shrink: 0,
          missDelay: 0.6,
          label: 'mask.hud.roue',
          help: 'mask.hud.roueAide',
          showDistance: 4.5,
          interact: true,
          prompt: 'mask.use.roue',
          size: [1.8, 1.8, 0.8],
          offset: [0, 1, 0],
          onComplete: [
            { type: 'core.setVar', var: 'mask.roueLancee', value: true },
            { type: 'core.playSound', sound: 'mask:grincement', at: 'echelle_2', volume: 1 },
            { type: 'core.notify', text: 'mask.notify.roue', kind: 'success' },
          ],
        },
      },
      { yaw: 180 },
    );
    s.entity('drapeau_arrivee', P1.drapeau, { 'core.model': { model: 'mask:drapeau', collider: 'none' } }, { yaw: 90 });
    s.entity('depart_parcours', P1.departParcours, { 'core.spawn': {} }, { yaw: 0 });
    s.entity('apres_parcours', P1.apresParcours, { 'core.spawn': {} }, { yaw: 90 });
    s.entity(
      'arche_depart',
      P1.arche,
      {
        'core.model': { model: 'mask:arche_depart', collider: 'none' },
        'mask.parcours': {
          finish: 'drapeau_arrivee',
          finishRadius: 1.4,
          startSize: [6, 3, 2],
          restart: 'depart_parcours',
          timeLimit: 100,
          maxDrop: 4.5,
          condition: all(stage('qualification'), seen('c1_kael', 'k7'), not(v('mask.parcoursReussi'))),
          onStart: [
            { type: 'core.setVar', var: 'mask.roueLancee', value: false },
            { type: 'mask.reinitialiserReglage', entity: 'roue_entrainement' },
            { type: 'core.music', music: 'mask:music.qualification', fade: 0.5 },
            { type: 'core.notify', text: 'mask.notify.parcoursDepart', kind: 'info' },
          ],
          onFail: [
            { type: 'core.music', music: 'mask:music.rives', fade: 1.5 },
            { type: 'core.addVar', var: 'mask.parcoursEchecs', amount: 1 },
            { type: 'core.startDialogue', dialogue: 'c1_kael', entity: 'kael', wait: false },
          ],
          onFinish: [
            { type: 'core.setVar', var: 'mask.parcoursReussi', value: true },
            { type: 'core.music', music: 'mask:music.victoire', fade: 0.3 },
            { type: 'core.wait', seconds: 2.5 },
            { type: 'core.fade', opacity: 1, seconds: 0.6 },
            { type: 'core.teleportPlayer', spawn: 'apres_parcours' },
            { type: 'core.teleportEntity', entity: 'kael', target: 'kael_fin' },
            { type: 'core.fade', opacity: 0, seconds: 0.8 },
            { type: 'core.music', music: 'mask:music.rives', fade: 3 },
            { type: 'core.startDialogue', dialogue: 'c1_kael', entity: 'kael', wait: false },
          ],
        },
      },
      { yaw: 0 },
    );
    const qualif = any(stage('qualification'), status('completed'));
    npc(s, 'kael', P1.kael, 200, { character: 'mask:kael', name: 'mask.npc.kael', dialogue: 'c1_kael', lookAtPlayer: true, lookDistance: 7 }, shownWhen(qualif));
    s.entity('kael_fin', P1.kaelFin, { 'core.marker': {} }, { yaw: 270 });
    s.entity('juno_estrade', P1.junoEstrade, { 'core.marker': {} }, { yaw: 30 });
    s.entity('lys_estrade', P1.lysEstrade, { 'core.marker': {} }, { yaw: 20 });
    npc(s, 'spectateur_1', [60.8, G + 1, 82.8], 30, { character: 'mask:habitant_c', name: 'mask.npc.habitant', barks: ['mask.bark.spectateur.1', 'mask.bark.spectateur.2'], barkInterval: 17 }, shownWhen(qualif));
    npc(s, 'spectatrice_1', [71.6, G + 1, 83.2], 330, { character: 'mask:habitant_d', name: 'mask.npc.habitante', barks: ['mask.bark.spectatrice.1'], barkInterval: 23 }, shownWhen(qualif));
  });
}

// ---------------------------------------------------------------------------------------------
// The party around the fountain
// ---------------------------------------------------------------------------------------------

function fete(s: SceneBuilder): void {
  const party = v('mask.ch1.fete');
  s.inFolder('Chapitre I/Fête', () => {
    for (const [i, [x, z]] of MATS_FETE.entries()) model(s, `mat_fete_${i + 1}`, 'mask:mat_fete', [x + 0.5, G, z + 0.5], 0, { collider: 'custom', size: [0.3, 5.6, 0.3] });
    const [a, b] = [MATS_FETE[0]!, MATS_FETE[3]!];
    const midX = (a[0] + b[0] + 1) / 2;
    const midZ = (a[1] + b[1] + 1) / 2;
    // The garland's ends (1.25 m above its lowest lantern) at the top of the masts.
    const y = G + 4.3;
    s.entity('guirlande_sud', [midX, y, a[1] + 0.5], { 'core.model': { model: 'mask:guirlande', collider: 'none' }, ...shownWhen(party) }, { yaw: 0 });
    s.entity('guirlande_nord', [midX, y, b[1] + 0.5], { 'core.model': { model: 'mask:guirlande', collider: 'none' }, ...shownWhen(party) }, { yaw: 0 });
    s.entity('guirlande_ouest', [a[0] + 0.5, y, midZ], { 'core.model': { model: 'mask:guirlande', collider: 'none' }, ...shownWhen(party) }, { yaw: 90 });
    s.entity('guirlande_est', [b[0] + 0.5, y, midZ], { 'core.model': { model: 'mask:guirlande', collider: 'none' }, ...shownWhen(party) }, { yaw: 90 });
    const spots: [string, V3, number][] = [
      ['fete_ada', [70.4, G, 58.6], 20],
      ['fete_pol', [71.8, G, 58.3], 0],
      ['fete_bastien', [67.3, G, 61.6], 70],
      ['fete_nora', [67.4, G, 66.4], 110],
      ['fete_juno', [75.8, G, 69.4], 210],
      ['fete_lys', [73.8, G, 69.9], 180],
      ['fete_mireille', [77.6, G, 60.6], 300],
      ['fete_octave', [77.8, G, 67.4], 240],
      ['fete_rosalie', [70.6, G, 69.6], 150],
      ['fete_commis', [75.4, G, 58.5], 330],
      ['fete_heros', [72.6, G, 70.6], 180],
    ];
    for (const [id, pos, yaw] of spots) s.entity(id, pos, { 'core.marker': {} }, { yaw });
  });
}

// ---------------------------------------------------------------------------------------------
// The end of the chapter: Vaurel's study, hidden in the rock under the Jardins d'Or
// ---------------------------------------------------------------------------------------------

function cabinet(s: SceneBuilder): void {
  const vol = s.volume;
  const c = CABINET;
  fillBox(vol, [c.x0, c.floor, c.z0], [c.x1, c.floor + 6, c.z1], 'mask:or_marbre');
  clearBox(vol, [c.x0 + 1, c.floor + 1, c.z0 + 1], [c.x1 - 1, c.floor + 5, c.z1 - 1]);
  fillBox(vol, [c.x0 + 1, c.floor, c.z0 + 1], [c.x1 - 1, c.floor, c.z1 - 1], 'mask:tour_pierre');
  for (const x of [c.x0 + 1, c.x1 - 1]) fillBox(vol, [x, c.floor + 1, c.z1 - 1], [x, c.floor + 5, c.z1 - 1], 'mask:or_dore');
  s.inFolder('Chapitre I/Cabinet de Vaurel', () => {
    model(s, 'bureau_vaurel', 'mask:bureau_vaurel', P1.bureauVaurel, 180);
    for (const [i, x] of [101.6, 107.4].entries()) model(s, `etagere_vaurel_${i + 1}`, 'mask:etagere', [x, c.floor + 1, c.z1 - 1.5], 180);
    sign(s, 'liste_candidats', [P1.bureauVaurel[0] - 0.2, c.floor + 2, P1.bureauVaurel[2] - 0.32], 180, 'mask.doc.listeVaurel', [0.9, 0.42, 0.02], 'plaque', { text: '#2a1d12', bg: '#efe6d2' });
    light(s, 'lumiere_cabinet', [104.5, c.floor + 4, 139.5], '#ffe2b0', 11);
    light(s, 'lumiere_cabinet_violet', [102, c.floor + 3, 141.8], '#b48aff', 7);
    npc(s, 'vaurel', P1.vaurel, 180, { character: 'mask:vaurel', name: 'mask.npc.vaurel', interactable: false, lookAtPlayer: false });
  });
}

/** Everything Chapter I adds to the scene « rives ». */
export function buildChapitre1(s: SceneBuilder, clearSky: EnvironmentDoc): void {
  bureau(s);
  precision(s);
  lavoir(s, clearSky);
  entraide(s);
  parcours(s);
  fete(s);
  cabinet(s);
  s.entity('spawn_lendemain', P1.lendemain, { 'core.spawn': {} }, { yaw: 90 });
  s.entity('matin_estrade', [65.5, G, 79.8], { 'core.spawn': {} }, { yaw: 0 });
}
