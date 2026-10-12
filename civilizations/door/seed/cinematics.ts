/**
 * Cinematics of the Door civilization, generated from the same layout as the scenes so that
 * cameras frame the right places. After generation the JSON files are edited in the Studio's
 * cinematic editor. Every cinematic is skippable: story-critical changes live in `actions`
 * tracks marked essential or in `onComplete`, which also run when the player skips.
 */
import type { CinematicDoc } from '@sdk/build';
import { A, G0, G2, L } from './layout.ts';

type Key = { t: number; position: [number, number, number]; target?: [number, number, number]; lookAt?: string; fov?: number; ease?: string; cut?: boolean };
const cam = (keys: Key[]) => ({ type: 'camera' as const, keys });
const subs = (items: { t: number; duration: number; speaker?: string; text: string }[]) => ({ type: 'subtitle' as const, items });

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

/** C01 — Éveil: from the floor of the cell to the door without a handle (≤ 20 s). */
function c01(): CinematicDoc {
  const eye: [number, number, number] = [L.spawnCell[0], G0 + 1.62, L.spawnCell[2]];
  return doc(
    'C01_eveil',
    'C01 — Éveil',
    15,
    [
      cam([
        { t: 0, position: [8.2, G0 + 0.45, 27.1], target: [9.6, G0 + 2.6, 27.6], fov: 62 },
        { t: 5, position: [8.4, G0 + 1.3, 27.5], target: [11.5, G0 + 1.2, 27.5], ease: 'inOutSine' },
        { t: 10, position: [10.1, G0 + 1.4, 27.4], target: [11.6, G0 + 1.1, 27.6], ease: 'inOutSine', fov: 52 },
        { t: 14.5, position: eye, target: [11.5, G0 + 1.4, 27.5], ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 1.5, duration: 3.5, text: 'door.cin.c01.1' },
        { t: 5.5, duration: 4.2, text: 'door.cin.c01.2' },
        { t: 10.2, duration: 4.3, text: 'door.cin.c01.3' },
      ]),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 1, to: 0, seconds: 3.5 }] },
      {
        type: 'audio',
        items: [
          { t: 0.4, sound: 'core:door_locked', at: 'cell_door' },
          { t: 9.8, sound: 'core:heartbeat' },
        ],
      },
    ],
    [{ type: 'core.startQuest', quest: 'DOOR_Q00_REVEIL' }],
  );
}

/** C02 — Rang 1: the golden engraving answers, then a look over the gallery (≤ 12 s). */
function c02(): CinematicDoc {
  return doc(
    'C02_rang1',
    'C02 — Rang 1',
    12,
    [
      cam([
        { t: 0, position: [48, G0 + 2.4, 43.5], target: [48, G0 + 2.2, 50.5], fov: 58, cut: true },
        { t: 4, position: [48, G0 + 2.0, 47.2], target: [48, G0 + 2.6, 51], ease: 'inOutSine' },
        { t: 4.6, position: [58, 28, 40], target: [70, 21, 63], fov: 66, cut: true },
        { t: 11.5, position: [80, 24.5, 52], target: [57, 22, 67], ease: 'inOutSine' },
      ]),
      subs([
        { t: 0.4, duration: 3.8, text: 'door.cin.c02.1' },
        { t: 5.2, duration: 5.6, text: 'door.cin.c02.2' },
      ]),
      { type: 'audio', items: [{ t: 1.2, sound: 'core:unlock', at: 'porte_galerie' }, { t: 4.6, music: 'door:music.galerie' }] },
      { type: 'fx', items: [{ t: 1.2, fx: 'flash', color: '#f1d78a', seconds: 0.5 }] },
    ],
    [{ type: 'core.music', music: 'door:music.faubourg', fade: 3 }],
  );
}

/** C03 — Révélation du registre: close-up on the palm print (≤ 15 s). */
function c03(): CinematicDoc {
  const [rx, , rz] = L.register;
  return doc(
    'C03_registre',
    'C03 — Révélation du registre',
    14,
    [
      cam([
        { t: 0, position: [rx, G2 + 1.95, rz - 1.25], target: [rx, G2 + 1.1, rz + 0.1], fov: 50 },
        { t: 7, position: [rx + 0.05, G2 + 1.55, rz - 0.55], target: [rx, G2 + 1.12, rz + 0.1], ease: 'inOutSine', fov: 40 },
        { t: 13.5, position: [rx, G2 + 1.62, rz - 1.6], target: [rx, G2 + 1.2, rz + 0.2], ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 0.5, duration: 3.8, text: 'door.cin.c03.1' },
        { t: 4.6, duration: 4.0, text: 'door.cin.c03.2' },
        { t: 9.0, duration: 4.6, text: 'door.cin.c03.3' },
      ]),
      { type: 'audio', items: [{ t: 0.2, sound: 'core:page' }, { t: 8.9, sound: 'door:palm_awaken' }] },
      { type: 'fx', items: [{ t: 8.9, fx: 'flash', color: '#ffd889', seconds: 0.9 }] },
    ],
    [
      { type: 'core.setVar', var: 'door.registerRead', value: true },
      { type: 'core.setVar', var: 'door.palmRevealed', value: true },
      { type: 'core.completeQuest', quest: 'DOOR_Q03_ARCHIVES' },
    ],
  );
}

/** C04 — La Porte Absente: the voice, the palm, the wall that was never there (≈ 22 s). */
function c04b(): CinematicDoc {
  return doc(
    'C04b_porte',
    'C04 — La Porte Absente (ouverture)',
    22,
    [
      cam([
        { t: 0, position: [19.6, A.floor + 1.75, 29.2], target: [20, A.floor + 1.8, A.seamZ], fov: 62 },
        { t: 5.5, position: [20.2, A.floor + 1.9, 30.6], target: [20, A.floor + 1.6, A.seamZ], ease: 'inOutSine' },
        { t: 10, position: [20, A.floor + 2.1, 31.4], target: [20, A.floor + 1.4, 40], ease: 'inOutSine', fov: 72 },
        { t: 15.5, position: [20, A.floor + 2.25, 32.6], target: [A.plaque[0], A.plaque[1], A.plaque[2]], ease: 'inOutSine', fov: 46 },
        { t: 21.5, position: [A.playerStand[0], A.floor + 1.62, A.playerStand[2]], target: [20, A.floor + 1.5, 34], ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 0.6, duration: 4.6, speaker: 'door.speaker.voice', text: 'door.cin.c04b.voice' },
        { t: 6.4, duration: 4.0, text: 'door.cin.c04b.1' },
        { t: 10.8, duration: 4.4, text: 'door.cin.c04b.2' },
        { t: 15.6, duration: 4.4, text: 'door.cin.c04b.3' },
      ]),
      { type: 'audio', items: [{ t: 0.2, sound: 'door:voice' }, { t: 5.8, sound: 'door:palm_awaken' }, { t: 9, music: 'door:music.absente' }] },
      {
        type: 'fx',
        items: [
          { t: 5.8, fx: 'flash', color: '#ffe2a8', seconds: 1.2 },
          { t: 5.8, fx: 'shake', intensity: 0.25, seconds: 1.2 },
        ],
      },
      {
        type: 'actions',
        items: [
          {
            t: 6,
            essential: true,
            actions: [
              { type: 'core.setBlocks', from: [19, A.floor, A.seamZ], to: [20, A.floor + 4, A.seamZ], block: '' },
              { type: 'core.setVar', var: 'door.absentDoorShown', value: true },
              { type: 'core.setVar', var: 'door.palmRevealed', value: true },
            ],
          },
          { t: 6.6, essential: true, actions: [{ type: 'core.openDoor', entity: 'porte_absente', silent: true }] },
          {
            t: 7,
            actions: [
              { type: 'core.environment', patch: { fog: { color: '#120c26', density: 0.018 }, ambient: { color: '#7a70b8', intensity: 0.45 } }, seconds: 4 },
            ],
          },
        ],
      },
      { type: 'actor', entity: 'mira', keys: [{ t: 6.5, lookAt: [20, A.floor + 1.5, 34], expression: 'surprised' }] },
      { type: 'actor', entity: 'varen', keys: [{ t: 6.8, lookAt: [20, A.floor + 1.5, 34], expression: 'worried' }] },
    ],
    [{ type: 'core.completeObjective', quest: 'DOOR_Q04_PORTE_ABSENTE', objective: 'ouvrir' }],
  );
}

/** C04 — coupe au noir avant de franchir le seuil (≈ 5 s). */
function c04c(): CinematicDoc {
  return doc(
    'C04c_coupe',
    'C04 — La Porte Absente (coupe)',
    5,
    [
      cam([
        { t: 0, position: [20, A.floor + 1.62, 32.7], target: [20, A.floor + 1.5, 36] },
        { t: 5, position: [20, A.floor + 1.62, 33.2], target: [20, A.floor + 1.5, 38], ease: 'inSine' },
      ]),
      subs([{ t: 0.6, duration: 4.2, text: 'door.cin.c04c.1' }]),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 0, to: 1, seconds: 3.2 }] },
      { type: 'audio', items: [{ t: 0, music: null }, { t: 0.2, sound: 'door:voice' }] },
    ],
    [
      { type: 'core.setVar', var: 'door.epilogue', value: true },
      { type: 'core.changeScene', scene: 'verrou', spawn: 'spawn_epilogue' },
    ],
    { returnCamera: 'cut' },
  );
}

/** C05 — Épilogue, in two variants depending on the answer given to Varen. */
function c05(variant: 'ecoute' | 'ouvre'): CinematicDoc {
  const key = variant === 'ecoute' ? 'listen' : 'open';
  return doc(
    `C05_epilogue_${variant}`,
    `C05 — Épilogue (${variant === 'ecoute' ? 'écoute' : 'ouverture immédiate'})`,
    30,
    [
      cam([
        { t: 0, position: [47, G0 + 8, 13], target: [48, G0 + 1, 30], fov: 60 },
        { t: 10, position: [44, G0 + 3.2, 22.5], target: [48, G0 + 1.4, 31], ease: 'inOutSine' },
        { t: 15, position: [52.5, G0 + 2.4, 27], target: [50.5, G0 + 1.4, 31.5], ease: 'inOutSine', fov: 52 },
        { t: 20.5, position: [41.2, G0 + 2.0, 26.4], target: [43.5, G0 + 1.3, 29.5], ease: 'inOutSine' },
        { t: 25, position: [48, G0 + 9, 18], target: [48, G0 + 6, 50], ease: 'inOutSine', fov: 62 },
        { t: 30, position: [48, G0 + 14, 14], target: [48, G0 + 12, 60], ease: 'inOutSine' },
      ]),
      subs([
        { t: 2.5, duration: 3.6, speaker: 'door.npc.washer', text: 'door.cin.c05.rumor1' },
        { t: 6.4, duration: 3.8, speaker: 'door.npc.sweeper', text: 'door.cin.c05.rumor2' },
        { t: 10.5, duration: 4.4, speaker: 'door.npc.mira', text: `door.cin.c05.mira.${key}` },
        { t: 15.2, duration: 4.8, speaker: 'door.npc.varen', text: `door.cin.c05.varen.${key}` },
        { t: 20.4, duration: 4.2, speaker: 'door.npc.noe', text: 'door.cin.c05.noe' },
        { t: 25, duration: 4.6, text: 'door.cin.c05.final' },
      ]),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 1, to: 0, seconds: 2.5 }, { t: 28, fx: 'fade', from: 0, to: 1, seconds: 2 }] },
      { type: 'audio', items: [{ t: 0, music: 'door:music.fin' }] },
      {
        type: 'actions',
        items: [
          {
            t: 0,
            essential: true,
            actions: [
              { type: 'door.setRank', rank: 1, silent: true },
              { type: 'core.teleportEntity', entity: 'mira', target: 'marque_mira_epilogue', yaw: 200 },
              { type: 'core.teleportEntity', entity: 'noe', target: 'marque_noe_epilogue', yaw: 120 },
              { type: 'core.teleportEntity', entity: 'varen', target: 'marque_varen_epilogue', yaw: 180 },
            ],
          },
        ],
      },
      { type: 'actor', entity: 'varen', keys: [{ t: 15.5, animation: 'kneel' }, { t: 17.5, animation: 'idle', lookAt: 'player' }] },
      { type: 'actor', entity: 'mira', keys: [{ t: 10.6, lookAt: 'player', animation: 'talk' }, { t: 15, animation: 'idle' }] },
      { type: 'actor', entity: 'noe', keys: [{ t: 20.5, lookAt: 'player', animation: 'wave' }] },
    ],
    [
      { type: 'core.showEndScreen', title: 'door.end.title', subtitle: 'door.end.subtitle', lines: ['door.end.line1', 'door.end.line2'] },
      { type: 'core.setVar', var: 'door.finished', value: true },
      { type: 'core.finishCivilization' },
    ],
  );
}

/** The mother refused at the house of care (Act I, event-driven). */
function cMere(): CinematicDoc {
  return doc(
    'C_mere',
    'Acte I — La mère devant la maison de soins',
    26,
    [
      cam([
        { t: 0, position: [55.5, G0 + 2.2, 34.5], target: [61.5, G0 + 1.2, 41.5], fov: 60 },
        { t: 8, position: [57.8, G0 + 2.0, 36.8], target: [60.8, G0 + 1.5, 40.2], ease: 'inOutSine' },
        { t: 16.5, position: [57.2, G0 + 1.9, 37.4], target: [61.5, G0 + 1.3, 42.5], ease: 'inOutSine' },
        { t: 21.5, position: [56.8, G0 + 1.8, 36.2], lookAt: 'varen', ease: 'inOutSine', fov: 50 },
        { t: 26, position: [56.8, G0 + 1.75, 35.6], lookAt: 'varen', ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 0.5, duration: 3.5, speaker: 'door.npc.mother', text: 'door.cin.mere.1' },
        { t: 4.2, duration: 3.4, speaker: 'door.npc.guard', text: 'door.cin.mere.2' },
        { t: 7.8, duration: 2.8, speaker: 'door.npc.mother', text: 'door.cin.mere.3' },
        { t: 11.0, duration: 2.6, speaker: 'door.npc.varen', text: 'door.cin.mere.4' },
        { t: 13.8, duration: 2.2, speaker: 'door.npc.guard', text: 'door.cin.mere.5' },
        { t: 16.1, duration: 2.2, speaker: 'door.npc.varen', text: 'door.cin.mere.6' },
        { t: 18.5, duration: 3.2, speaker: 'door.npc.varen', text: 'door.cin.mere.7' },
        { t: 22.0, duration: 3.6, speaker: 'door.npc.varen', text: 'door.cin.mere.8' },
      ]),
      {
        type: 'audio',
        items: [
          { t: 0.1, sound: 'door:knock', at: 'porte_soins' },
          { t: 2.2, sound: 'door:cough', at: 'porte_soins' },
          { t: 7.6, sound: 'door:knock', at: 'porte_soins' },
          { t: 16.4, sound: 'core:unlock', at: 'porte_soins' },
        ],
      },
      {
        type: 'actor',
        entity: 'mere',
        keys: [
          { t: 0, teleport: [L.mother[0], G0, L.mother[2]], yaw: 0, animation: 'interact', expression: 'worried' },
          { t: 7.8, animation: 'surprised', lookAt: 'garde_soins' },
          { t: 17.2, moveTo: 'marque_mere_dedans', speed: 2.4 },
        ],
      },
      { type: 'actor', entity: 'garde_soins', keys: [{ t: 4.2, lookAt: 'mere', animation: 'shake' }, { t: 13.8, lookAt: 'varen' }] },
      {
        type: 'actor',
        entity: 'varen',
        keys: [
          { t: 0, teleport: [52.5, G0, 41.5], yaw: 90, visible: true },
          { t: 7.5, moveTo: 'marque_varen_mere', speed: 2.0 },
          { t: 11.0, lookAt: 'garde_soins', animation: 'point' },
          { t: 16.1, animation: 'interact' },
          { t: 18.5, lookAt: 'garde_soins' },
          { t: 22.0, lookAt: 'player', expression: 'determined' },
        ],
      },
      { type: 'actions', items: [{ t: 16.5, essential: true, actions: [{ type: 'core.openDoor', entity: 'porte_soins', silent: true }] }] },
    ],
    [
      { type: 'core.teleportEntity', entity: 'mere', target: 'marque_mere_dedans', yaw: 0 },
      { type: 'core.setProp', entity: 'mere', component: 'core.npc', prop: 'barks', value: [] },
      { type: 'core.setVar', var: 'door.motherSceneDone', value: true },
      { type: 'core.closeDoor', entity: 'porte_soins' },
      {
        type: 'core.if',
        condition: { type: 'door.rankAtLeast', rank: 1 },
        then: [{ type: 'core.teleportEntity', entity: 'varen', target: 'marque_bureau_varen', yaw: 180 }],
        else: [{ type: 'core.teleportEntity', entity: 'varen', target: 'marque_varen_mere', yaw: 200 }],
      },
    ],
  );
}

export function buildCinematics(): CinematicDoc[] {
  return [c01(), c02(), c03(), c04b(), c04c(), c05('ecoute'), c05('ouvre'), cMere()];
}
