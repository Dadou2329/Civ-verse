/**
 * Cinematics of the Mask civilization, generated from the same layout as the scenes so that the
 * cameras frame the right places, then edited in the Studio's cinematic editor. Every cinematic
 * can be skipped: story effects live in essential `actions` items or in `onComplete`.
 *
 * Voices are not synthesized: what characters say is shown as French subtitles.
 */
import type { CinematicDoc } from '@sdk/build';
import { G, ATELIER, P, JUNO_VOLTIGE } from './layout.ts';

type V3 = [number, number, number];
type Key = { t: number; position: V3; target?: V3; lookAt?: string; fov?: number; ease?: string; cut?: boolean };
const cam = (keys: Key[]) => ({ type: 'camera' as const, keys });
const subs = (items: { t: number; duration: number; speaker?: string; text: string }[]) => ({ type: 'subtitle' as const, items });
const EYE = 1.62;

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

/**
 * C00 — Matin aux Rives Basses (P00). First person: the hero puts on his Cendre mask, leans out of
 * the window toward the upper city (couriers on the roofs, a Fer guard stopping a cart, nobles on
 * a footbridge), then Lys shouts from the quay.
 */
function c00(): CinematicDoc {
  const room = ATELIER.roomY;
  const mask: V3 = [P.support[0], room + 1.02, P.support[2] - 0.22];
  const window: V3 = [38.5, room + 1.9, ATELIER.z1 + 0.3];
  const after: V3 = [37.6, room + EYE, 33.4];
  return doc(
    'C00_matin',
    'C00 — Matin aux Rives Basses',
    35,
    [
      cam([
        { t: 0, position: [P.spawnChambre[0], room + EYE, P.spawnChambre[2] + 0.4], target: mask, fov: 60 },
        { t: 4.4, position: [36.1, room + 1.55, 32.1], target: mask, fov: 50, ease: 'inOutSine' },
        { t: 7.2, position: [36.2, room + 1.4, 32.5], target: [36.4, room + 1.3, 33.8], fov: 44, ease: 'inOutSine' },
        { t: 9.4, position: [37.6, room + EYE, 33.3], target: [38.6, room + 2.1, 40], fov: 62, ease: 'inOutSine' },
        // At the window: the eye picks out the couriers, then the guard, then the footbridge.
        { t: 12.4, position: window, target: [35, 38.5, 104], fov: 26, ease: 'inOutSine' },
        { t: 15.4, position: window, target: [37, 38.8, 104], fov: 25, ease: 'linear' },
        { t: 16.6, position: window, target: [67, 31.4, 101], fov: 20, ease: 'inOutSine' },
        { t: 19.4, position: window, target: [68.5, 31.4, 101], fov: 20, ease: 'linear' },
        { t: 20.8, position: window, target: [80, 55.4, 139.5], fov: 22, ease: 'inOutSine' },
        { t: 22.8, position: window, target: [81, 55.6, 139.5], fov: 22, ease: 'linear' },
        { t: 26.6, position: [38.5, room + 1.8, ATELIER.z1 + 0.1], target: [70, 44, 126], fov: 62, ease: 'inOutSine' },
        // Leaning out beside the flower box to see Lys on the quay.
        { t: 28.2, position: [40.4, room + 2.3, ATELIER.z1 + 1.6], target: [P.lys[0], G + 1.3, P.lys[2]], fov: 40, ease: 'inOutSine' },
        { t: 31.4, position: [40.3, room + 2.2, ATELIER.z1 + 1.5], target: [P.lys[0], G + 1.4, P.lys[2]], fov: 38, ease: 'linear' },
        { t: 34.6, position: after, target: [after[0] - 3, room + 1.35, after[2] - 3], fov: 70, ease: 'inOutSine' },
      ]),
      subs([
        { t: 1, duration: 4.4, speaker: 'player', text: 'mask.cin.c00.1' },
        { t: 5.6, duration: 2.8, speaker: 'player', text: 'mask.cin.c00.2' },
        { t: 8.6, duration: 3.8, speaker: 'player', text: 'mask.cin.c00.3' },
        { t: 12.8, duration: 3.4, speaker: 'player', text: 'mask.cin.c00.4' },
        { t: 16.6, duration: 2.8, speaker: 'player', text: 'mask.cin.c00.5' },
        { t: 22.2, duration: 5.2, speaker: 'player', text: 'mask.cin.c00.6' },
        { t: 28.2, duration: 3.6, speaker: 'lys', text: 'mask.cin.c00.7' },
        { t: 31.8, duration: 3.1, speaker: 'player', text: 'mask.cin.c00.8' },
      ]),
      {
        type: 'fx',
        items: [
          { t: 0, fx: 'fade', from: 1, to: 0, seconds: 2.4 },
          { t: 7, fx: 'tint', color: '#ff7a2e', strength: 0.28, seconds: 0.25 },
          { t: 7.1, fx: 'vignette', intensity: 0.8 },
          { t: 8, fx: 'tint', color: null, strength: 0, seconds: 0.8 },
        ],
      },
      {
        type: 'audio',
        items: [
          { t: 0.2, sound: 'mask:cloches_ville' },
          { t: 6.9, sound: 'mask:masque_enfile' },
          { t: 27.8, sound: 'mask:cloches_ville', volume: 0.6 },
        ],
      },
      {
        type: 'actions',
        items: [
          {
            t: 6.9,
            essential: true,
            actions: [
              { type: 'core.setProp', entity: 'support_masque', component: 'core.model', prop: 'model', value: 'mask:support_masque_vide' },
              { type: 'core.giveItem', item: 'mask:masque_cendre', count: 1, silent: true },
              { type: 'core.equipItem', item: 'mask:masque_cendre' },
            ],
          },
          { t: 7.2, actions: [{ type: 'core.fx', channel: 'mask.embers', payload: { strength: 0.6 } }] },
          { t: 34.7, essential: true, actions: [{ type: 'core.teleportPlayer', spawn: 'apres_fenetre' }] },
        ],
      },
      // Up there, a Fer guard stops a cart at the edge of the Fil tier.
      { type: 'actor', entity: 'garde_fil', keys: [{ t: 13, moveTo: 'garde_fil_halte', speed: 2.2 }, { t: 17.2, animation: 'point' }] },
      { type: 'actor', entity: 'charretier', keys: [{ t: 17.8, animation: 'shake' }] },
      { type: 'actor', entity: 'lys', keys: [{ t: 27.6, lookAt: 'player', animation: 'wave' }, { t: 31.6, animation: 'point' }] },
    ],
    [
      { type: 'core.startQuest', quest: 'prologue' },
      { type: 'core.notify', text: 'mask.tuto.deplacement', kind: 'info' },
    ],
  );
}

/** C01 — Juno arrive en trombe (P01, after the wheel). */
function c01(): CinematicDoc {
  const juno = P.junoAtelier;
  return doc(
    'C01_juno',
    'C01 — Juno arrive en trombe',
    9.5,
    [
      cam([
        { t: 0, position: [44.2, G + 2.1, 41.6], target: [62, G + 1.4, 39.6], fov: 54 },
        { t: 2.6, position: [44, G + 2, 41.8], target: [52, G + 1.3, 40], fov: 52, ease: 'inOutSine' },
        { t: 4.8, position: [43.6, G + 1.9, 42.4], target: [juno[0], G + 1.45, juno[2]], fov: 46, ease: 'inOutSine' },
        { t: 9.5, position: [43.2, G + 1.8, 42.2], target: [juno[0] - 0.5, G + 1.5, juno[2] - 0.6], fov: 46, ease: 'linear' },
      ]),
      subs([
        { t: 0.8, duration: 2.8, speaker: 'juno', text: 'mask.cin.c01.1' },
        { t: 4.4, duration: 2.2, speaker: 'ada', text: 'mask.cin.c01.2' },
        { t: 6.8, duration: 2.5, speaker: 'juno', text: 'mask.cin.c01.3' },
      ]),
      {
        type: 'audio',
        items: [
          { t: 0.3, sound: 'mask:elan' },
          { t: 4.6, sound: 'core:thud', at: 'ada' },
        ],
      },
      { type: 'actor', entity: 'juno', keys: [{ t: 0.2, moveTo: 'juno_atelier', speed: 7.5 }, { t: 6.7, lookAt: 'lys', animation: 'talk' }] },
      { type: 'actor', entity: 'ada', keys: [{ t: 4.2, lookAt: 'juno', animation: 'surprised', expression: 'angry' }] },
      { type: 'actor', entity: 'lys', keys: [{ t: 2, lookAt: 'juno' }] },
      { type: 'actor', entity: 'nora', keys: [{ t: 2.4, lookAt: 'juno' }] },
    ],
    [{ type: 'core.startDialogue', dialogue: 'p01_juno', entity: 'juno', wait: false }],
  );
}

/** C02 — Le monte-charge fou (P02): the overheated brake gives way, the wagon rolls down. */
function c02(): CinematicDoc {
  const dock: V3 = [P.railHaut[0], P.railHaut[1] + 0.8, P.railHaut[2]];
  return doc(
    'C02_monte_charge',
    'C02 — Le monte-charge fou',
    12.8,
    [
      cam([
        { t: 0, position: [111.2, G + 2.6, 63.6], target: dock, fov: 48 },
        { t: 3.2, position: [111.4, G + 2.5, 64], target: dock, fov: 26, ease: 'inOutSine' },
        { t: 7, position: [111.4, G + 2.5, 64.2], target: dock, fov: 24, ease: 'linear' },
        { t: 7.4, position: [111.6, G + 2.4, 64.4], lookAt: 'wagon', fov: 34, ease: 'outCubic' },
        { t: 9.6, position: [111.8, G + 2.3, 64.8], lookAt: 'wagon', fov: 44, ease: 'linear' },
        { t: 12.8, position: [112.3, G + EYE, 65.6], target: [112.6, G + 2.6, 75], fov: 68, ease: 'inOutSine' },
      ]),
      subs([
        { t: 0.4, duration: 3.6, speaker: 'juno', text: 'mask.cin.c02.1' },
        { t: 4.2, duration: 2.8, speaker: 'player', text: 'mask.cin.c02.2' },
        { t: 7.3, duration: 2, speaker: 'juno', text: 'mask.cin.c02.3' },
        { t: 9.4, duration: 3.4, speaker: 'juno', text: 'mask.cin.c02.4' },
      ]),
      {
        type: 'audio',
        items: [
          { t: 0.3, sound: 'mask:vapeur', at: 'wagon' },
          { t: 3.6, sound: 'mask:vapeur', at: 'wagon' },
          { t: 6.8, sound: 'mask:grincement', at: 'wagon' },
          { t: 7, music: 'mask:music.danger' },
        ],
      },
      { type: 'fx', items: [{ t: 6.9, fx: 'shake', intensity: 0.35, seconds: 0.7 }] },
      { type: 'actions', items: [{ t: 7, essential: true, actions: [{ type: 'mask.startLift', lift: 'wagon' }] }] },
      { type: 'actor', entity: 'juno', keys: [{ t: 0, lookAt: 'wagon', animation: 'point' }, { t: 9.4, lookAt: 'player', animation: 'talk' }] },
      { type: 'actor', entity: 'habitante_bas', keys: [{ t: 7.6, lookAt: 'wagon', animation: 'surprised', say: 'mask.bark.bas.panique' }] },
      { type: 'actor', entity: 'habitant_bas', keys: [{ t: 8, lookAt: 'wagon', animation: 'surprised' }] },
    ],
    [
      { type: 'core.setProp', entity: 'juno', component: 'mask.voltige', prop: 'loop', value: false },
      {
        type: 'core.setProp',
        entity: 'juno',
        component: 'mask.voltige',
        prop: 'points',
        value: JUNO_VOLTIGE,
      },
      { type: 'core.notify', text: 'mask.tuto.sauter', kind: 'info' },
    ],
  );
}

/** C02b — Le frein grippé: subtitles only, the player keeps control (charge the Braise!). */
function c02b(): CinematicDoc {
  return doc(
    'C02b_frein',
    'C02b — Le frein est grippé',
    8.8,
    [
      subs([
        { t: 0.2, duration: 2.4, speaker: 'player', text: 'mask.cin.c02b.1' },
        { t: 2.8, duration: 2.6, speaker: 'juno', text: 'mask.cin.c02b.2' },
        { t: 5.6, duration: 3.2, speaker: 'juno', text: 'mask.cin.c02b.3' },
      ]),
      { type: 'audio', items: [{ t: 0, sound: 'core:clang', at: 'frein' }] },
      { type: 'actor', entity: 'juno', keys: [{ t: 2.8, lookAt: 'player', animation: 'point' }, { t: 5.6, animation: 'talk' }] },
    ],
    [],
    { letterbox: false, lockPlayer: false, hideHud: false, returnCamera: 'cut' },
  );
}

/** C03 — Le wagon s'arrête: the brake bites, the wagon stops above the stalls, the district cheers. */
function c03(): CinematicDoc {
  const brake: V3 = [P.frein[0], P.frein[1] + 0.6, P.frein[2]];
  return doc(
    'C03_arret',
    'C03 — Le monte-charge s’arrête',
    12,
    [
      cam([
        { t: 0, position: [113.4, P.frein[1] + 1.5, 85], target: brake, fov: 50 },
        { t: 4.4, position: [113.1, P.frein[1] + 1.6, 84.6], target: brake, fov: 46, ease: 'linear' },
        // From the market: the wagon has stopped up the rail...
        { t: 4.6, position: [117.5, G + 2.4, 49.2], lookAt: 'wagon', fov: 52, cut: true },
        { t: 6.4, position: [117.8, G + 2.3, 49.8], lookAt: 'wagon', fov: 46, ease: 'linear' },
        // ...and the people it would have hit cheer.
        { t: 6.5, position: [118.4, G + 1.9, 60.2], target: [118, G + 1.2, 55], fov: 58, cut: true },
        { t: 8.2, position: [118.3, G + 1.9, 59.8], target: [118, G + 1.3, 55], fov: 54, ease: 'linear' },
        { t: 8.4, position: [112.4, P.junoStation[1] + 1.7, 85.6], lookAt: 'juno', fov: 54, cut: true },
        { t: 12, position: [112.6, P.junoStation[1] + EYE, 86], lookAt: 'juno', fov: 62, ease: 'inOutSine' },
      ]),
      subs([
        { t: 0.3, duration: 2, speaker: 'player', text: 'mask.cin.c03.1' },
        { t: 2.4, duration: 2.2, speaker: 'juno', text: 'mask.cin.c03.2' },
        { t: 5, duration: 3, speaker: 'habitante_bas', text: 'mask.cin.c03.3' },
        { t: 8.6, duration: 3.2, speaker: 'juno', text: 'mask.cin.c03.4' },
      ]),
      {
        type: 'audio',
        items: [
          { t: 0.1, sound: 'mask:vapeur', at: 'frein' },
          { t: 4.7, sound: 'mask:acclamations' },
          { t: 4.7, music: 'mask:music.victoire' },
        ],
      },
      { type: 'actions', items: [{ t: 0, essential: true, actions: [{ type: 'mask.stopLift', lift: 'wagon' }] }] },
      { type: 'actor', entity: 'juno', keys: [{ t: 2.4, lookAt: 'player', animation: 'talk' }, { t: 8.6, animation: 'nod' }] },
      { type: 'actor', entity: 'habitante_bas', keys: [{ t: 4.7, lookAt: 'wagon', animation: 'wave' }] },
      { type: 'actor', entity: 'enfant_bas', keys: [{ t: 4.9, lookAt: 'wagon', animation: 'wave' }] },
      { type: 'actor', entity: 'habitant_bas', keys: [{ t: 5.2, animation: 'nod' }] },
    ],
    [{ type: 'core.emit', event: 'mask.prologue.lift_saved', payload: {} }],
  );
}

export function buildCinematics(): CinematicDoc[] {
  return [c00(), c01(), c02(), c02b(), c03()];
}
