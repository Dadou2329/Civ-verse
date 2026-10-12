/**
 * Cinematics of Chapter I « Courir plus haut » (same conventions as cinematics.ts: every one can be
 * skipped, story effects live in essential `actions` items or in `onComplete`, voices are French
 * subtitles).
 */
import type { CinematicDoc } from '@sdk/build';
import { G, P, P1, CABINET } from './layout.ts';

type V3 = [number, number, number];
type Key = { t: number; position: V3; target?: V3; lookAt?: string; fov?: number; ease?: string; cut?: boolean; roll?: number };
const cam = (keys: Key[]) => ({ type: 'camera' as const, keys });
const subs = (items: { t: number; duration: number; speaker?: string; text: string }[]) => ({ type: 'subtitle' as const, items });
const head = (p: V3, dy = 1.55): V3 => [p[0], p[1] + dy, p[2]];

function doc(id: string, title: string, duration: number, tracks: CinematicDoc['tracks'], onComplete: CinematicDoc['onComplete'] = [], extra: Partial<CinematicDoc> = {}): CinematicDoc {
  return {
    format: 'civverse.cinematic',
    version: 1,
    id,
    title,
    duration,
    skippable: true,
    letterbox: true,
    lockPlayer: true,
    hideHud: true,
    returnCamera: 'blend',
    tracks,
    onComplete,
    ...extra,
  };
}

/** The district's characters and where they go back to after the party. */
const HOMES: [string, V3, number][] = [
  ['ada', P.ada, 225],
  ['pol', P.pol, 45],
  ['bastien', P.bastien, 200],
  ['nora', P.nora, 180],
  ['rosalie', P1.rosalie, 180],
  ['commis', P1.commis, 270],
];

/** C10 — Le lendemain matin: from the end of the Prologue to Chapter I. */
function c10(): CinematicDoc {
  const npcDialogue = (entity: string, dialogue: string) => ({ type: 'core.setProp', entity, component: 'core.npc', prop: 'dialogue', value: dialogue });
  return doc(
    'C10_lendemain',
    'C10 — Le lendemain matin',
    9,
    [
      cam([
        { t: 0, position: [60, G + 5, 44], target: [96, G + 4, 64], fov: 55 },
        { t: 9, position: [62, G + 4.5, 46], target: [96, G + 3.4, 65.5], fov: 50, ease: 'linear' },
      ]),
      { type: 'fx', items: [
        { t: 0, fx: 'fade', from: 1, to: 1, seconds: 0.05 },
        { t: 3.2, fx: 'fade', from: 1, to: 0, seconds: 1.6 },
      ] },
      subs([{ t: 0.4, duration: 2.8, text: 'mask.cin.c10.1' }]),
      { type: 'audio', items: [{ t: 3.2, sound: 'mask:cloches_ville' }, { t: 3.2, music: 'mask:music.rives' }] },
      {
        type: 'actions',
        items: [
          {
            t: 0.2,
            essential: true,
            actions: [
              { type: 'core.teleportPlayer', spawn: 'spawn_lendemain' },
              { type: 'core.setProp', entity: 'juno', component: 'mask.voltige', prop: 'points', value: [] },
              { type: 'core.teleportEntity', entity: 'juno', target: 'juno_bureau' },
              npcDialogue('juno', 'c1_juno'),
              { type: 'core.teleportEntity', entity: 'lys', position: P.lys, yaw: 120 },
              npcDialogue('lys', 'c1_lys'),
              npcDialogue('nora', 'c1_nora'),
              npcDialogue('bastien', 'c1_bastien'),
              npcDialogue('ada', 'c1_voisins'),
              npcDialogue('pol', 'c1_voisins'),
              { type: 'core.startQuest', quest: 'chapitre1' },
              { type: 'core.setVar', var: 'mask.ch1.lendemain', value: true },
            ],
          },
        ],
      },
      { type: 'actor', entity: 'juno', keys: [{ t: 4, animation: 'wave' }] },
    ],
    // The chapter title is shown by the rule that plays this cinematic (also when it is skipped).
    [],
  );
}

/**
 * C11 — La boîte des vieux masques (I03): Lys shows the split Fil mask; its weave reaches for the
 * hero for a moment, then she cuts the power. He keeps his memories; the mask stays locked away.
 */
function c11(): CinematicDoc {
  const mask: V3 = [P1.masqueFendu[0], P1.masqueFendu[1], P1.masqueFendu[2]];
  const lys = P1.lysAtelier;
  const hero: V3 = [P1.herosAtelier[0], G + 1.62, P1.herosAtelier[2]];
  return doc(
    'C11_vieux_masques',
    'C11 — La boîte des vieux masques',
    35,
    [
      cam([
        { t: 0, position: [40.2, G + 1.9, 27.4], target: head(lys, 1.2), fov: 50 },
        { t: 6.8, position: [40, G + 1.8, 27], target: head(lys, 1.3), fov: 46, ease: 'linear' },
        { t: 7, position: hero, target: mask, fov: 46, cut: true },
        { t: 11, position: [mask[0] + 0.06, mask[1] + 0.22, mask[2] + 0.72], target: mask, fov: 36, ease: 'inOutSine' },
        // The weave answers: for an instant the hero sees the roofs from the roofs across.
        { t: 12.9, position: [mask[0] + 0.05, mask[1] + 0.2, mask[2] + 0.62], target: mask, fov: 32, ease: 'linear' },
        { t: 13, position: [47, 43.2, 106.5], target: [62, 39, 105], fov: 62, cut: true, roll: 6 },
        { t: 14.3, position: [48.5, 43, 106.2], target: [63, 39.1, 105.2], fov: 70, ease: 'linear', roll: -4 },
        { t: 14.4, position: [hero[0], hero[1] - 0.2, hero[2] + 0.2], target: head(lys, 1.5), fov: 58, cut: true, roll: 8 },
        { t: 17, position: [hero[0], hero[1] - 0.05, hero[2] + 0.2], target: head(lys, 1.55), fov: 52, ease: 'outCubic', roll: 0 },
        { t: 24.2, position: [hero[0] + 0.1, hero[1], hero[2] + 0.1], target: head(lys, 1.55), fov: 48, ease: 'linear' },
        { t: 24.4, position: [37.2, G + 1.7, 26.6], target: [39.4, G + 1.4, 24.6], fov: 50, cut: true },
        { t: 35, position: [37.4, G + 1.75, 26.9], target: [39.3, G + 1.3, 24.4], fov: 48, ease: 'linear' },
      ]),
      subs([
        { t: 0.8, duration: 5, speaker: 'lys', text: 'mask.cin.c11.1' },
        { t: 5.9, duration: 1.4, speaker: 'player', text: 'mask.cin.c11.2' },
        { t: 7.4, duration: 4.2, speaker: 'lys', text: 'mask.cin.c11.3' },
        { t: 15.2, duration: 2, speaker: 'lys', text: 'mask.cin.c11.4' },
        { t: 17.4, duration: 3.4, speaker: 'player', text: 'mask.cin.c11.5' },
        { t: 21, duration: 3.6, speaker: 'lys', text: 'mask.cin.c11.6' },
        { t: 24.8, duration: 1.6, speaker: 'player', text: 'mask.cin.c11.7' },
        { t: 26.6, duration: 3, speaker: 'lys', text: 'mask.cin.c11.8' },
        { t: 29.8, duration: 5, speaker: 'lys', text: 'mask.cin.c11.9' },
      ]),
      {
        type: 'fx',
        items: [
          { t: 11.8, fx: 'tint', color: '#7fe0ff', strength: 0.35, seconds: 0.6 },
          { t: 12, fx: 'vignette', intensity: 0.9 },
          { t: 12.2, fx: 'fov', delta: 10, seconds: 1.2 },
          { t: 13, fx: 'flash', color: '#bfefff', seconds: 0.25 },
          { t: 14.4, fx: 'flash', color: '#bfefff', seconds: 0.3 },
          { t: 14.4, fx: 'shake', intensity: 0.25, seconds: 0.6 },
          { t: 15.6, fx: 'tint', color: null, strength: 0, seconds: 1.6 },
        ],
      },
      {
        type: 'audio',
        items: [
          { t: 7.6, sound: 'core:mechanism', at: 'banc_essai' },
          { t: 11.8, sound: 'mask:filament' },
          { t: 14.4, sound: 'core:clang', at: 'banc_essai' },
          { t: 14.6, sound: 'mask:vapeur', at: 'banc_essai' },
        ],
      },
      {
        type: 'actions',
        items: [
          {
            t: 0,
            essential: true,
            actions: [
              { type: 'core.teleportEntity', entity: 'lys', target: 'lys_atelier' },
              { type: 'core.teleportPlayer', spawn: 'heros_atelier' },
              { type: 'core.setVisible', entity: 'masque_fendu', visible: true },
              { type: 'core.setVisible', entity: 'lampe_banc', visible: true },
            ],
          },
          { t: 11.9, actions: [{ type: 'core.fx', channel: 'mask.filament', payload: { from: mask, seconds: 2.4 } }] },
          {
            t: 34.6,
            essential: true,
            actions: [
              { type: 'core.setVisible', entity: 'masque_fendu', visible: false },
              { type: 'core.setVisible', entity: 'lampe_banc', visible: false },
              // The rule « masque_reagi » emits mask.ch1.second_mask_reacted (events are not sent while skipping).
              { type: 'core.setVar', var: 'mask.ch1.masqueReagi', value: true },
              { type: 'core.giveItem', item: 'mask:ressort_trame', count: 1, silent: false },
              { type: 'core.startQuest', quest: 'masque_fendu' },
            ],
          },
        ],
      },
      {
        type: 'actor',
        entity: 'lys',
        keys: [
          { t: 0, lookAt: 'player', animation: 'talk', expression: 'happy' },
          { t: 7.4, lookAt: mask, animation: 'interact', expression: 'determined' },
          { t: 14.4, animation: 'surprised', expression: 'surprised' },
          { t: 15.2, lookAt: 'player', expression: 'worried' },
          { t: 21, animation: 'talk' },
          { t: 26.6, animation: 'shake', expression: 'determined' },
          { t: 29.8, animation: 'talk', expression: 'neutral' },
        ],
      },
    ],
  );
}

/** C12 — La fête du quartier (I02, three proofs): an evening around the fountain, then the next morning. */
function c12(): CinematicDoc {
  const fountain: V3 = [73, G + 1.6, 64];
  const at = (id: string, pos: V3, yaw: number) => ({ type: 'core.teleportEntity', entity: id, position: pos, yaw });
  const evening = {
    sky: { top: '#3a3a78', horizon: '#f2a070', bottom: '#5a4050' },
    sun: { direction: [-0.8, -0.25, 0.3], color: '#ffb070', intensity: 0.7 },
    ambient: { color: '#a08890', intensity: 0.5 },
    fog: { color: '#d8a888', density: 0.006 },
  };
  const speakerShot = (t: number, marker: V3, from: V3, until: number): Key[] => [
    { t, position: from, target: head(marker, 1.45), fov: 42, cut: true },
    { t: until, position: [from[0] + 0.2, from[1], from[2] + 0.2], target: head(marker, 1.45), fov: 40, ease: 'linear' },
  ];
  const spot = (name: string): V3 => FETE[name]!;
  return doc(
    'C12_fete',
    'C12 — La fête du quartier',
    36,
    [
      cam([
        // Between the masts: the garlands above, the crowd in front of the fountain.
        { t: 0, position: [71, G + 4.5, 76], target: fountain, fov: 56 },
        { t: 3, position: [70.5, G + 4.2, 73.5], target: fountain, fov: 54, ease: 'linear' },
        ...speakerShot(3.1, spot('ada'), [71.6, G + 1.8, 61.6], 6.8),
        ...speakerShot(6.9, spot('bastien'), [69.9, G + 1.8, 63], 11),
        ...speakerShot(11.1, spot('pol'), [73.6, G + 1.8, 61.2], 15),
        ...speakerShot(15.1, spot('nora'), [70.2, G + 1.8, 66.6], 19.6),
        // Lys and Juno stand next to the hero and turn to him: their cameras are on his side.
        ...speakerShot(19.7, spot('lys'), [73.1, G + 1.8, 72.4], 22.6),
        ...speakerShot(22.7, spot('juno'), [74.7, G + 1.8, 71.8], 25.4),
        ...speakerShot(25.5, spot('commis'), [74.8, G + 1.8, 61.4], 29.4),
        { t: 29.5, position: [72.4, G + 1.62, 70.4], target: [73, G + 1.4, 64], fov: 60, cut: true },
        { t: 32, position: [72.4, G + 1.62, 70.4], target: [73, G + 1.6, 64], fov: 58, ease: 'linear' },
        // The next morning, at the stage.
        { t: 33.2, position: [64.6, G + 2.2, 77.6], target: [67, G + 2.4, 90], fov: 55, cut: true },
        { t: 36, position: [65, G + 2, 78.4], target: [67, G + 2.6, 92], fov: 55, ease: 'linear' },
      ]),
      subs([
        { t: 3.3, duration: 3.4, speaker: 'ada', text: 'mask.cin.c12.1' },
        { t: 7.1, duration: 3.8, speaker: 'bastien', text: 'mask.cin.c12.2' },
        { t: 11.3, duration: 3.6, speaker: 'pol', text: 'mask.cin.c12.3' },
        { t: 15.3, duration: 4.2, speaker: 'nora', text: 'mask.cin.c12.4' },
        { t: 19.9, duration: 2.6, speaker: 'lys', text: 'mask.cin.c12.8' },
        { t: 22.9, duration: 2.4, speaker: 'juno', text: 'mask.cin.c12.5' },
        { t: 25.7, duration: 3.6, speaker: 'commis', text: 'mask.cin.c12.6' },
        { t: 29.7, duration: 2.4, speaker: 'player', text: 'mask.cin.c12.7' },
        { t: 32.4, duration: 2.6, text: 'mask.cin.lendemain' },
      ]),
      {
        type: 'fx',
        items: [
          { t: 0, fx: 'fade', from: 1, to: 0, seconds: 1.4 },
          { t: 31.2, fx: 'fade', from: 0, to: 1, seconds: 1 },
          { t: 34.4, fx: 'fade', from: 1, to: 0, seconds: 1.4 },
        ],
      },
      {
        type: 'audio',
        items: [
          { t: 0, music: 'mask:music.fete' },
          { t: 0.4, sound: 'mask:acclamations' },
          { t: 26.2, sound: 'mask:tampon' },
          { t: 32.2, music: 'mask:music.rives' },
          { t: 33.4, sound: 'mask:cloches_ville' },
        ],
      },
      {
        type: 'actions',
        items: [
          {
            t: 0,
            essential: true,
            actions: [
              { type: 'core.setVar', var: 'mask.ch1.fete', value: true },
              { type: 'core.environment', patch: evening, seconds: 0 },
              ...Object.entries(FETE_ACTORS).map(([id, name]) => at(id, spot(name), FETE_YAW[name]!)),
              { type: 'core.teleportPlayer', spawn: 'fete_heros' },
            ],
          },
          {
            t: 32.2,
            essential: true,
            // The morning sky comes back through the rule that plays this cinematic (the environment
            // is presentation, not applied while skipping).
            actions: [
              ...HOMES.map(([id, pos, yaw]) => at(id, pos, yaw)),
              { type: 'core.teleportEntity', entity: 'marchande_fruits', target: 'mireille_fontaine' },
              { type: 'core.teleportEntity', entity: 'marchand_tissus', target: 'octave_fontaine' },
              { type: 'core.teleportEntity', entity: 'juno', target: 'juno_estrade' },
              { type: 'core.teleportEntity', entity: 'lys', target: 'lys_estrade' },
              { type: 'core.teleportPlayer', spawn: 'matin_estrade' },
              { type: 'core.setVar', var: 'mask.ch1.feteVue', value: true },
            ],
          },
        ],
      },
      { type: 'actor', entity: 'ada', keys: [{ t: 3.3, lookAt: 'player', animation: 'cheer', expression: 'happy' }] },
      // He bows with the hat at the end of his line, so the shot keeps his face while he speaks.
      { type: 'actor', entity: 'bastien', keys: [{ t: 7.1, lookAt: 'player', animation: 'talk', expression: 'happy' }, { t: 9.7, animation: 'bow' }] },
      { type: 'actor', entity: 'pol', keys: [{ t: 11.3, lookAt: 'player', animation: 'nod' }] },
      { type: 'actor', entity: 'nora', keys: [{ t: 15.3, lookAt: 'player', animation: 'talk', expression: 'happy' }] },
      { type: 'actor', entity: 'lys', keys: [{ t: 19.9, lookAt: 'player', animation: 'cheer', expression: 'happy' }] },
      { type: 'actor', entity: 'juno', keys: [{ t: 22.9, lookAt: 'player', animation: 'point', expression: 'happy' }] },
      { type: 'actor', entity: 'commis', keys: [{ t: 25.7, lookAt: 'player', animation: 'interact' }, { t: 26.2, animation: 'nod' }] },
      { type: 'actor', entity: 'marchande_fruits', keys: [{ t: 0.6, animation: 'cheer' }] },
      { type: 'actor', entity: 'marchand_tissus', keys: [{ t: 1, animation: 'wave' }] },
      { type: 'actor', entity: 'rosalie', keys: [{ t: 0.8, animation: 'cheer' }] },
    ],
    [],
  );
}

/** Where everyone stands at the party (markers of the scene seed, see seed/chapitre1.ts). */
const FETE: Record<string, V3> = {
  ada: [70.4, G, 58.6],
  pol: [71.8, G, 58.3],
  bastien: [67.3, G, 61.6],
  nora: [67.4, G, 66.4],
  juno: [75.8, G, 69.4],
  lys: [73.8, G, 69.9],
  mireille: [77.6, G, 60.6],
  octave: [77.8, G, 67.4],
  rosalie: [70.6, G, 69.6],
  commis: [75.4, G, 58.5],
};
const FETE_YAW: Record<string, number> = { ada: 20, pol: 0, bastien: 70, nora: 110, juno: 210, lys: 180, mireille: 300, octave: 240, rosalie: 150, commis: 330 };
const FETE_ACTORS: Record<string, string> = {
  ada: 'ada',
  pol: 'pol',
  bastien: 'bastien',
  nora: 'nora',
  juno: 'juno',
  lys: 'lys',
  marchande_fruits: 'mireille',
  marchand_tissus: 'octave',
  rosalie: 'rosalie',
  commis: 'commis',
};

/**
 * C13 — Le cabinet du Grand Fixateur (end of Chapter I): very briefly, Vaurel reads the list of
 * qualified candidates, stops on the hero's workshop and closes the file. No narrator.
 */
function c13(): CinematicDoc {
  // The plaque stands on its lower edge (seed/chapitre1.ts): its line of text is 0.21 m higher; the
  // hero's workshop number sits a little left of the middle, seen from the door.
  const list: V3 = [P1.bureauVaurel[0] - 0.2, CABINET.floor + 2.21, P1.bureauVaurel[2] - 0.32];
  const numero: V3 = [list[0] - 0.15, list[1], list[2]];
  const face = head(P1.vaurel, 1.62);
  return doc(
    'C13_vaurel',
    'C13 — Le cabinet du Grand Fixateur',
    17,
    [
      cam([
        { t: 0, position: [104.5, CABINET.floor + 2.9, 138.3], target: [104.4, CABINET.floor + 2, 140.6], fov: 42 },
        { t: 3.4, position: [104.4, CABINET.floor + 2.7, 138.5], target: list, fov: 34, ease: 'inOutSine' },
        { t: 7.2, position: [104.2, CABINET.floor + 2.35, 139.05], target: numero, fov: 28, ease: 'inOutSine' },
        { t: 7.4, position: [103.6, CABINET.floor + 2.5, 139], target: face, fov: 34, cut: true },
        { t: 11.6, position: [103.7, CABINET.floor + 2.45, 139.1], target: face, fov: 32, ease: 'linear' },
        { t: 11.8, position: [104.5, CABINET.floor + 3.4, 138.2], target: [104.5, CABINET.floor + 1.6, 140.8], fov: 50, cut: true },
        { t: 14, position: [104.5, CABINET.floor + 3.6, 137.9], target: [104.5, CABINET.floor + 1.6, 140.8], fov: 54, ease: 'linear' },
      ]),
      subs([{ t: 8, duration: 3, speaker: 'vaurel', text: 'mask.cin.c13.1' }]),
      {
        type: 'fx',
        items: [
          { t: 0, fx: 'fade', from: 1, to: 0, seconds: 1.2 },
          { t: 13.6, fx: 'fade', from: 0, to: 1, seconds: 1.2 },
          { t: 15.6, fx: 'fade', from: 1, to: 0, seconds: 1.2 },
        ],
      },
      {
        type: 'audio',
        items: [
          { t: 0, music: 'mask:music.vaurel' },
          { t: 11.9, sound: 'core:page', at: 'bureau_vaurel' },
          { t: 15.4, music: 'mask:music.rives' },
        ],
      },
      {
        type: 'actions',
        items: [
          { t: 11.9, actions: [{ type: 'core.setVisible', entity: 'liste_candidats', visible: false }] },
          {
            t: 15,
            essential: true,
            actions: [
              { type: 'core.teleportPlayer', spawn: 'apres_parcours' },
              { type: 'core.setVar', var: 'mask.ch1.vaurelVu', value: true },
            ],
          },
        ],
      },
      { type: 'actor', entity: 'vaurel', keys: [{ t: 0, lookAt: list }, { t: 8, expression: 'determined' }, { t: 11.7, animation: 'interact' }] },
    ],
    // The end titles come from the rule that plays this cinematic.
    [],
  );
}

export function buildCinematicsCh1(): CinematicDoc[] {
  return [c10(), c11(), c12(), c13()];
}
