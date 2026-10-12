/**
 * Cinematics of the Memory civilization, generated from the same layout as the scenes so that
 * cameras frame the right places, then edited in the Studio's cinematic editor. Every cinematic
 * can be skipped: story effects live in essential `actions` tracks or in `onComplete`.
 *
 * Voices are never synthesized: what characters say is shown as French subtitles.
 */
import type { CinematicDoc } from '@sdk/build';
import { G, R, W } from './layout.ts';

type V3 = [number, number, number];
type Key = { t: number; position: V3; target?: V3; lookAt?: string; fov?: number; ease?: string; cut?: boolean };
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

/** M01 — Le marché des souvenirs: a calm transaction at the Métier, then the bench (≤ 20 s). */
function m01(): CinematicDoc {
  const [lx, , lz] = R.loom;
  const eye: V3 = [R.spawn[0], G + 1.62, R.spawn[2]];
  return doc(
    'M01_marche',
    'M01 — Le marché des souvenirs',
    19,
    [
      cam([
        // From the side: Iris facing the Métier, her hand on the frame.
        { t: 0, position: [lx - 5.2, G + 1.8, lz + 2.6], target: [lx - 1.2, G + 1.3, lz + 1.6], fov: 52 },
        { t: 6.5, position: [lx - 4.2, G + 1.7, lz + 2.2], target: [lx - 0.9, G + 1.4, lz + 1.4], ease: 'inOutSine', fov: 44 },
        { t: 7, position: [lx + 3.6, G + 1.65, lz + 6.4], target: [R.sellerJules[0], G + 1.5, R.sellerJules[2]], fov: 50, cut: true },
        { t: 13.5, position: [lx + 2.6, G + 1.6, lz + 5.6], target: [R.sellerIris[0], G + 1.5, R.sellerIris[2]], ease: 'inOutSine' },
        { t: 14, position: [R.bench[0] + 1.2, G + 0.85, R.bench[2] + 0.4], target: [R.bench[0], G + 0.6, R.bench[2] - 0.2], fov: 46, cut: true },
        { t: 18.5, position: eye, target: [eye[0] - 2.8, G + 1.3, eye[2] - 2.8], ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 0.6, duration: 3.6, speaker: 'memory.npc.iris', text: 'memory.cin.m01.1' },
        { t: 4.4, duration: 2.5, text: 'memory.cin.m01.2' },
        { t: 7.4, duration: 2.8, speaker: 'memory.npc.jules', text: 'memory.cin.m01.3' },
        { t: 10.4, duration: 3.2, speaker: 'memory.npc.iris', text: 'memory.cin.m01.4' },
        { t: 14.2, duration: 4.4, text: 'memory.cin.m01.5' },
      ]),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 1, to: 0, seconds: 2.5 }, { t: 4.4, fx: 'flash', color: '#ffd8a0', seconds: 0.8 }] },
      { type: 'audio', items: [{ t: 3.8, sound: 'memory:machine', at: 'metier' }, { t: 4.4, sound: 'memory:echo' }, { t: 15, sound: 'memory:shard_touch' }] },
      {
        type: 'actor',
        entity: 'iris',
        keys: [
          { t: 0, animation: 'interact' },
          { t: 4.6, animation: 'idle', expression: 'neutral' },
          { t: 10.4, lookAt: 'jules', animation: 'talk' },
          { t: 13.6, animation: 'idle' },
        ],
      },
      { type: 'actor', entity: 'jules', keys: [{ t: 7.2, lookAt: 'iris', animation: 'talk', expression: 'worried' }, { t: 10.2, animation: 'idle' }] },
      { type: 'actions', items: [{ t: 0, essential: true, actions: [{ type: 'memory.giveShard', shard: 'ambre', silent: true }] }] },
    ],
    [{ type: 'core.startQuest', quest: 'MEM_Q00_EVEIL' }],
  );
}

/** M02 — Premier écho: a silhouette crosses the market backwards, from the bench (≤ 15 s). */
function m02(): CinematicDoc {
  const [sx, , sz] = R.marketSign;
  return doc(
    'M02_premier_echo',
    'M02 — Premier écho',
    12,
    [
      cam([
        { t: 0, position: [sx + 1.2, G + 1.7, sz + 1.6], target: [R.bench[0], G + 1.3, R.bench[2]], fov: 60 },
        { t: 5, position: [sx + 1.6, G + 1.9, sz + 1.2], target: [52, G + 1.2, 30], ease: 'inOutSine' },
        { t: 9.5, position: [sx + 1.0, G + 2.2, sz + 0.6], target: [46, G + 1.1, 26.5], ease: 'inOutSine', fov: 54 },
        { t: 12, position: [sx + 0.2, G + 1.62, sz + 1.2], target: [46, G + 1.4, 26], ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 0.4, duration: 3.6, text: 'memory.cin.m02.1' },
        { t: 4.3, duration: 3.4, text: 'memory.cin.m02.2' },
        { t: 8, duration: 3.6, text: 'memory.cin.m02.3' },
      ]),
    ],
    [{ type: 'core.setVar', var: 'memory.firstEcho', value: true }],
  );
}

/** M03 — Chambre Blanche: a silent reconstruction of why Silas sold his memory (25–45 s). */
function m03(): CinematicDoc {
  const [cx, y, cz] = W.center;
  return doc(
    'M03_chambre_blanche',
    'M03 — Chambre Blanche',
    32,
    [
      cam([
        { t: 0, position: [cx, y + 1.62, cz - 8], target: [cx, y + 1.2, cz], fov: 62 },
        { t: 8, position: [cx - 4.5, y + 2.1, cz - 2.5], target: [W.friendBed[0], y + 0.8, W.friendBed[2]], ease: 'inOutSine' },
        { t: 16, position: [cx + 3.5, y + 1.9, cz + 1], target: [cx, y + 1.3, cz - 3], ease: 'inOutSine', fov: 56 },
        { t: 24, position: [cx + 1.5, y + 1.7, cz - 4.5], target: [W.lea[0], y + 1.4, W.lea[2]], ease: 'inOutSine', fov: 50 },
        { t: 32, position: [W.spawn[0], y + 1.62, W.spawn[2]], target: [cx, y + 1.4, cz], ease: 'inOutSine', fov: 70 },
      ]),
      subs([
        { t: 2, duration: 4.5, text: 'memory.cin.m03.1' },
        { t: 8.5, duration: 4.5, text: 'memory.cin.m03.2' },
        { t: 14.5, duration: 4.5, text: 'memory.cin.m03.3' },
        { t: 20.5, duration: 4.5, text: 'memory.cin.m03.4' },
        { t: 26.5, duration: 5, text: 'memory.cin.m03.5' },
      ]),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 1, to: 0, seconds: 2.5, color: '#ffffff' }] },
      { type: 'audio', items: [{ t: 0.5, music: 'memory:music.blanche' }, { t: 1, sound: 'memory:echo' }, { t: 21, sound: 'memory:silas_song' }] },
      { type: 'actions', items: [{ t: 1, actions: [{ type: 'memory.playEcho', echo: 'chambre_vente' }] }] },
    ],
    [
      { type: 'core.setVar', var: 'memory.whiteRoomSeen', value: true },
      { type: 'core.notify', text: 'memory.notify.wake', kind: 'memory' },
    ],
  );
}

/** M04 — Sujet Zéro: the register of copies, then a fragmentary vision (≤ 20 s with M04b). */
function m04(): CinematicDoc {
  const [cx, , cz] = R.copiesCabinet;
  return doc(
    'M04_sujet_zero',
    'M04 — Révélation « Sujet Zéro »',
    11,
    [
      cam([
        { t: 0, position: [cx - 2.4, G + 1.75, cz + 0.6], target: [cx - 0.3, G + 1.45, cz], fov: 55 },
        { t: 5.5, position: [cx - 1.05, G + 1.6, cz + 0.05], target: [cx - 0.5, G + 1.55, cz], ease: 'inOutSine', fov: 36 },
        { t: 11, position: [cx - 0.85, G + 1.58, cz], target: [cx - 0.5, G + 1.55, cz], ease: 'inSine', fov: 30 },
      ]),
      subs([
        { t: 0.4, duration: 3.6, text: 'memory.cin.m04.1' },
        { t: 4.2, duration: 3, text: 'memory.cin.m04.2' },
        { t: 7.4, duration: 3.4, text: 'memory.cin.m04.3' },
      ]),
      { type: 'audio', items: [{ t: 0.2, sound: 'core:page' }, { t: 7.2, sound: 'memory:shard_touch' }, { t: 8, sound: 'memory:echo' }] },
      {
        type: 'fx',
        items: [
          { t: 7.4, fx: 'flash', color: '#ffffff', seconds: 0.4 },
          { t: 8.6, fx: 'flash', color: '#ffffff', seconds: 0.4 },
          { t: 9.2, fx: 'fade', from: 0, to: 1, seconds: 1.6, color: '#ffffff' },
        ],
      },
      { type: 'actions', items: [{ t: 4.2, essential: true, actions: [{ type: 'core.setVar', var: 'memory.sujetZero', value: true }] }] },
    ],
    [{ type: 'core.changeScene', scene: 'chambre_blanche', spawn: 'spawn_vision' }],
    { returnCamera: 'cut' },
  );
}

/** M04b — the vision: door silhouettes and a voice. A variant answers the Door civilization. */
function m04b(variant: 'base' | 'seuil'): CinematicDoc {
  const [cx, y, cz] = W.center;
  const seuil = variant === 'seuil';
  const [tx, , tz] = W.thresholdDoor;
  return doc(
    seuil ? 'M04b_vision_seuil' : 'M04b_vision',
    seuil ? 'M04 — Vision (motif du seuil)' : 'M04 — Vision',
    seuil ? 9 : 8,
    [
      cam(
        seuil
          ? [
              { t: 0, position: [cx, y + 5, cz - 7], target: [cx, y + 1.5, cz + 3], fov: 66 },
              { t: 4.5, position: [cx - 1.5, y + 2.2, cz + 4], target: [tx, y + 1.6, tz], ease: 'inOutSine', fov: 52 },
              { t: 9, position: [cx, y + 1.62, cz - 5], target: [cx, y + 1.6, cz + 4], ease: 'inOutSine', fov: 70 },
            ]
          : [
              { t: 0, position: [cx, y + 5, cz - 7], target: [cx, y + 1.5, cz + 3], fov: 66 },
              { t: 4, position: [cx + 3, y + 2.4, cz - 1], target: [W.doors[1]![0], y + 1.4, W.doors[1]![2]], ease: 'inOutSine' },
              { t: 8, position: [cx, y + 1.62, cz - 5], target: [cx, y + 1.6, cz + 4], ease: 'inOutSine', fov: 70 },
            ],
      ),
      subs(
        seuil
          ? [
              { t: 0.6, duration: 3.4, speaker: 'memory.speaker.echo', text: 'memory.cin.m04b.voice' },
              { t: 4.4, duration: 4.2, text: 'memory.cin.m04b.seuil' },
            ]
          : [
              { t: 0.6, duration: 3.4, speaker: 'memory.speaker.echo', text: 'memory.cin.m04b.voice' },
              { t: 4.3, duration: 3.4, text: 'memory.cin.m04b.1' },
            ],
      ),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 1, to: 0, seconds: 1.5, color: '#ffffff' }] },
      { type: 'audio', items: seuil ? [{ t: 0.4, sound: 'memory:echo' }, { t: 4.4, sound: 'memory:threshold' }] : [{ t: 0.4, sound: 'memory:echo' }] },
    ],
    [{ type: 'core.setVar', var: 'memory.visionSeen', value: true }],
  );
}

/** Epilogue in Réminence, in two variants depending on Silas's decision (≈ 26 s). */
function epilogue(outcome: 'acceptee' | 'refusee'): CinematicDoc {
  const ok = outcome === 'acceptee';
  return doc(
    `M05_epilogue_${outcome}`,
    `Épilogue (${ok ? 'restauration acceptée' : 'restauration refusée'})`,
    26,
    [
      cam([
        { t: 0, position: [48, G + 9, 50], target: [48, G + 1, 28], fov: 60 },
        { t: 5.5, position: [44.6, G + 2.4, 24.5], target: [45.5, G + 1.6, 19.4], ease: 'inOutSine', fov: 54 },
        { t: 11, position: [45.8, G + 2.0, 23.8], target: [48, G + 1.6, 18.5], ease: 'inOutSine' },
        { t: 11.5, position: [37.4, G + 1.9, 46.6], target: [41, G + 1.3, 42], fov: 50, cut: true },
        { t: 20.5, position: [38.6, G + 1.8, 45.2], target: [41.4, G + 1.3, 41.8], ease: 'inOutSine' },
        { t: 26, position: [48, G + 15, 44], target: [48, G + 13, 80], ease: 'inOutSine', fov: 62 },
      ]),
      subs([
        { t: 1, duration: 4.2, text: 'memory.cin.epi.1' },
        { t: 5.6, duration: 2.8, speaker: 'memory.npc.vel', text: 'memory.cin.epi.vel' },
        { t: 8.5, duration: 2.8, speaker: 'memory.npc.oriane', text: 'memory.cin.epi.oriane' },
        ...(ok
          ? [
              { t: 11.8, duration: 4, speaker: 'memory.npc.silas', text: 'memory.cin.epi.acceptee.1' },
              { t: 16, duration: 4, speaker: 'memory.npc.lea', text: 'memory.cin.epi.acceptee.2' },
            ]
          : [
              { t: 11.8, duration: 3.4, speaker: 'memory.npc.lea', text: 'memory.cin.epi.refusee.1' },
              { t: 15.4, duration: 4.4, speaker: 'memory.npc.silas', text: 'memory.cin.epi.refusee.2' },
            ]),
        { t: 21, duration: 4.6, text: 'memory.cin.epi.final' },
      ]),
      { type: 'fx', items: [{ t: 0, fx: 'fade', from: 1, to: 0, seconds: 2.5 }, { t: 24.4, fx: 'fade', from: 0, to: 1, seconds: 1.6 }] },
      { type: 'audio', items: [{ t: 0, music: 'memory:music.fin' }] },
      {
        type: 'actions',
        items: [
          {
            t: 0,
            essential: true,
            actions: [
              { type: 'core.teleportEntity', entity: 'oriane', target: 'marque_oriane_epilogue', yaw: 180 },
              { type: 'core.teleportEntity', entity: 'vel', target: 'marque_vel_epilogue', yaw: 0 },
              { type: 'core.teleportEntity', entity: 'silas', target: 'marque_silas_epilogue', yaw: 120 },
              { type: 'core.teleportEntity', entity: 'lea', target: ok ? 'marque_lea_epilogue' : 'marque_lea_inconnue', yaw: ok ? 300 : 240 },
            ],
          },
        ],
      },
      { type: 'actor', entity: 'oriane', keys: [{ t: 5.5, animation: 'interact' }, { t: 8.4, lookAt: 'vel', animation: 'talk' }, { t: 11, animation: 'idle' }] },
      { type: 'actor', entity: 'vel', keys: [{ t: 5.5, lookAt: 'oriane', animation: 'talk', expression: 'determined' }, { t: 8.4, animation: 'idle' }] },
      ok
        ? {
            type: 'actor',
            entity: 'silas',
            keys: [
              { t: 11.6, lookAt: 'lea', animation: 'talk' },
              { t: 16, animation: 'idle' },
            ],
          }
        : {
            type: 'actor',
            entity: 'silas',
            keys: [
              { t: 11.6, lookAt: 'lea', expression: 'surprised' },
              { t: 15.4, animation: 'talk', expression: 'neutral' },
              { t: 20, animation: 'idle' },
            ],
          },
      ok
        ? { type: 'actor', entity: 'lea', keys: [{ t: 11.6, lookAt: 'silas' }, { t: 16, animation: 'talk' }, { t: 20, animation: 'nod' }] }
        : {
            type: 'actor',
            entity: 'lea',
            keys: [
              { t: 11.6, moveTo: 'marque_lea_epilogue', speed: 1.4 },
              { t: 14.6, lookAt: 'silas', animation: 'wave' },
              { t: 15.4, animation: 'idle' },
            ],
          },
    ],
    [
      { type: 'core.setVar', var: 'memory.finished', value: true },
      {
        type: 'core.if',
        condition: { type: 'core.civCompleted', civ: 'door' },
        then: [{ type: 'core.showEndScreen', title: 'memory.end.title', subtitle: 'memory.end.subtitle', lines: ['memory.end.line1', `memory.end.${outcome}`, 'memory.end.seuil'] }],
        else: [{ type: 'core.showEndScreen', title: 'memory.end.title', subtitle: 'memory.end.subtitle', lines: ['memory.end.line1', `memory.end.${outcome}`] }],
      },
      { type: 'core.finishCivilization' },
    ],
  );
}

export function buildCinematics(): CinematicDoc[] {
  return [m01(), m02(), m03(), m04(), m04b('base'), m04b('seuil'), epilogue('acceptee'), epilogue('refusee')];
}
