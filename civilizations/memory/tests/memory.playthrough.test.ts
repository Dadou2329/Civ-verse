/**
 * Memory Civilization — headless playthroughs.
 *
 * The story is played the way a player would: walking (A* with the player's size, so an
 * unreachable place fails), interacting through the same pipeline as the game, answering
 * dialogues, skipping cinematics, saving and reloading. Each test checks that shards really
 * change perception and dialogue, that consent is enforced, and that the ending is reachable on
 * both paths of Act II and for every decision of Act III.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { advance, advanceDialogue, choose, createHeadlessGame, flush, skipCinematics, talk, walkTo, type HeadlessGame } from '@engine/core/testing/headless';
import { parseSave } from '@engine/core/save/saveFormat';
import type { GameSession } from '@engine/core/sim/session';
import type { ChamberApi } from '../mechanics/chamber';
import type { OfferingApi } from '../mechanics/garden';

const Q = { q0: 'MEM_Q00_EVEIL', q1: 'MEM_Q01_MELODIE', q2: 'MEM_Q02_REGISTRE', q3: 'MEM_Q03_RECONSTRUCTION', q4: 'MEM_Q04_SUJET_ZERO' };

type Act2Path = 'aide' | 'echange';
type Decision = 'accept' | 'silasRefuses' | 'leaRefuses';

async function start(opts: { doorCompleted?: boolean } = {}): Promise<HeadlessGame> {
  const game = await createHeadlessGame(new GlobContentProvider());
  if (opts.doorCompleted) game.session.multiverse.markCompleted('door');
  await game.session.loadCivilization('memory', { fresh: true });
  await advance(game.session, 0.3);
  return game;
}

const chamber = (s: GameSession) => s.civ!.mechanics.get('memory.chamber')!.api as ChamberApi;
const offering = (s: GameSession) => s.civ!.mechanics.get('memory.offering')!.api as OfferingApi;
const inv = (s: GameSession) => s.civ!.ctx.inventory;
const visible = (s: GameSession, id: string) => s.world!.entities.get(id)!.visible;
/** French typography uses no-break spaces (before « : ? ! » etc.): compare texts without them. */
const norm = (t: string | undefined) => (t ?? '').replace(/[\u00a0\u202f]/g, ' ');
const notified = (game: HeadlessGame, text: string) => game.ui.notifications.some((n) => norm(n.text) === norm(text));

async function interact(session: GameSession, entityId: string, offerId?: string, kind: 'primary' | 'secondary' = 'primary'): Promise<boolean> {
  await walkTo(session, entityId);
  const ok = await session.interaction.interactWith(entityId, kind, offerId);
  await flush();
  return ok;
}

async function openDoor(session: GameSession, doorId: string): Promise<void> {
  if (session.entityApi(doorId)?.behavior<{ isOpen: boolean }>('core.door')?.isOpen) return;
  const ok = await interact(session, doorId, 'open');
  if (!ok) throw new Error(`Porte refusée : ${doorId}`);
  await advance(session, 0.3);
}

async function waitFor(session: GameSession, test: () => boolean, seconds = 20): Promise<void> {
  for (let t = 0; t < seconds && !test(); t += 0.25) await advance(session, 0.25);
  expect(test()).toBe(true);
}

/** Prologue: the bench, the amber shard, the first echo, Oriane and the tutorial. */
async function prologue(game: HeadlessGame, jules: 'keep' | 'yours'): Promise<void> {
  const s = game.session;
  expect(s.cinematics.current?.id).toBe('M01_marche');
  // Subtitles name their speaker in French, even for a speaker given as a text key.
  await advance(s, 1);
  expect(s.cinematics.subtitleView()?.speaker).toBe('Iris');
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('« Un anniversaire. Mes sept ans. Le gâteau était au citron. »');
  await skipCinematics(s);
  await flush();
  expect(s.quests.status(Q.q0)).toBe('active');
  expect(chamber(s).state('ambre')).toBe('possede');
  expect(s.vars.get('memory.shardsOwned')).toBe(1);

  // Touching the shard: the woman's voice.
  chamber(s).examine('ambre');
  await advance(s, 0.2);
  const touch = s.civ!.ctx.ui.store.get<{ text: string }>('memory.touch');
  expect(norm(touch?.text)).toBe('« Ne me laisse pas me vendre une deuxième fois. »');
  expect(s.quests.isObjectiveDone(Q.q0, 'examiner')).toBe(true);

  // Far from a memory device, nothing can be anchored.
  expect(chamber(s).canManipulate()).toBe(false);
  expect(chamber(s).anchor('ambre')).toBe(false);

  // A young man hesitates to sell his first kiss.
  await talk(s, 'jules', jules === 'keep' ? ['keep'] : ['price', 'yours']);
  expect(s.vars.get('memory.julesChoice')).toBe(jules === 'keep' ? 'garde' : 'vend');

  // The sign of the Métier: a silhouette crosses the market backwards (M02), then Oriane.
  await walkTo(s, 'echo_enseigne', { reach: 1.5 });
  await advance(s, 0.5);
  expect(s.cinematics.current?.id).toBe('M02_premier_echo');
  await skipCinematics(s);
  await advance(s, 1);
  expect(s.vars.get('memory.firstEcho')).toBe(true);
  expect(s.dialogue.view()?.dialogueId).toBe('oriane');
  await choose(s, 'nothing');
  await advanceDialogue(s);
  expect(s.vars.get('memory.metOriane')).toBe(true);
  expect(s.dialogue.seen('oriane', 'intro3')).toBe(true);
  expect(s.quests.stage(Q.q0)).toBe('atelier');

  // Oriane walks back to her workshop.
  await waitFor(s, () => s.world!.entities.get('oriane')!.position.x < 20, 40);
  await openDoor(s, 'porte_atelier');
  await talk(s, 'oriane', ['how']);
  expect(chamber(s).state('chemin')).toBe('possede');

  // Anchoring at the table: the shard of one's own steps draws the path of arrival.
  await walkTo(s, 'table_emplacements');
  expect(chamber(s).canManipulate()).toBe(true);
  expect(visible(s, 'pas_1')).toBe(false);
  expect(chamber(s).anchor('ambre')).toBe(true);
  expect(chamber(s).anchor('chemin')).toBe(true);
  await advance(s, 0.3);
  expect(s.vars.get('memory.shardsEquipped')).toBe(2);
  expect(visible(s, 'pas_1')).toBe(true);
  // ...and removing it erases the footprints again: observable and reversible.
  expect(chamber(s).remove('chemin')).toBe(true);
  await advance(s, 0.3);
  expect(visible(s, 'pas_1')).toBe(false);
  expect(s.quests.status(Q.q0)).toBe('completed');
  expect(inv(s).has('memory:diapason')).toBe(true);
  expect(s.quests.status(Q.q1)).toBe('active');
  // The diapason lets the player anchor anywhere.
  expect(chamber(s).anchor('chemin')).toBe(true);
  await advance(s, 0.3);
  expect(visible(s, 'pas_1')).toBe(true);
}

/** Act I: Silas's song, the stele, the three childhood objects, the second shard. */
async function actOne(game: HeadlessGame, honest: boolean): Promise<void> {
  const s = game.session;
  // Silas's song, heard with the amber shard anchored, shows two children (echo).
  await walkTo(s, 'silas');
  await advance(s, 0.5);
  expect(s.vars.get('memory.songEcho')).toBe(true);
  await talk(s, 'silas', ['song', 'who', honest ? 'truth' : 'lie']);
  expect(s.dialogue.seen('silas', 'intro3')).toBe(true);
  expect(Number(s.vars.get('memory.silasTrust'))).toBe(honest ? 1 : 0);
  expect(s.quests.stage(Q.q1)).toBe('jardin');

  // The same stele, with and without the shard.
  expect(s.entityApi('stele_lea')!.props<{ model: string }>('core.model').model).toBe('memory:stele_lea');
  expect(chamber(s).remove('ambre')).toBe(true);
  await advance(s, 0.6);
  expect(s.entityApi('stele_lea')!.props<{ model: string }>('core.model').model).toBe('memory:stele');
  expect(await interact(s, 'stele_lea', 'observe')).toBe(true);
  expect(notified(game, 'Les lettres ont fondu dans la pierre, comme de la cire. Impossible de lire le nom.')).toBe(true);
  expect(s.vars.get('memory.steleRead')).toBeUndefined();
  expect(chamber(s).anchor('ambre')).toBe(true);
  await advance(s, 0.6);
  expect(await interact(s, 'stele_lea', 'observe')).toBe(true);
  expect(notified(game, "Avec l'éclat ambré, les lettres remontent à la surface : « LÉA ».")).toBe(true);
  expect(s.vars.get('memory.steleRead')).toBe(true);
  await advance(s, 3);
  const echoes = s.civ!.mechanics.get('memory.echoes')!.api as { played(id: string): boolean };
  expect(echoes.played('trois_objets')).toBe(true);
  // The echo can be replayed at will (secondary action on the stele).
  await advance(s, 11);
  expect(await interact(s, 'stele_lea', 'echo', 'secondary')).toBe(true);

  // The three childhood objects.
  for (const id of ['objet_cerf_volant', 'objet_tasse', 'objet_clochette']) expect(await interact(s, id, 'take')).toBe(true);
  await advance(s, 0.3);
  expect(s.vars.get('memory.objectsFound')).toBe(3);

  // A wrong order gives the objects back.
  const o = offering(s);
  await walkTo(s, 'socle_2');
  o.place('socle_1', 'memory:tasse');
  o.place('socle_2', 'memory:cerf_volant');
  o.place('socle_3', 'memory:clochette');
  await advance(s, 1.5);
  expect(o.solved).toBe(false);
  expect(o.held().length).toBe(3);
  // The order of the echo: kite, chipped cup, little bell. The last one goes through the
  // pedestal interaction itself (only one object left in hand: placed directly).
  o.place('socle_1', 'memory:cerf_volant');
  o.place('socle_2', 'memory:tasse');
  expect(await interact(s, 'socle_3', 'place')).toBe(true);
  await advance(s, 0.5);
  expect(o.solved).toBe(true);
  expect(s.entityApi('socle_3')!.props<{ model: string }>('core.model').model).toBe('memory:pedestal_bell');
  expect(chamber(s).state('jardin')).toBe('possede');
  expect(notified(game, 'Souvenir retrouvé : Le goûter des noms')).toBe(true);

  // The second shard reveals a name and a date.
  chamber(s).examine('jardin');
  await advance(s, 0.3);
  expect(s.quests.status(Q.q1)).toBe('completed');
  expect(s.quests.status(Q.q2)).toBe('active');
  expect(s.vars.get('memory.shardsEquipped')).toBe(2);
}

/** Act II: the House of Absences, Oriane's confession, the price of the record, Vel, Léa. */
async function actTwo(game: HeadlessGame, path: Act2Path): Promise<void> {
  const s = game.session;
  // Anchoring the garden shard changes how people react (recognition without a cause).
  expect(chamber(s).anchor('jardin')).toBe(true);
  await advance(s, 0.6);
  expect(s.vars.get('memory.recognition.silas')).toBe('sensation');
  expect(s.vars.get('memory.recognition.aurele')).toBe('sensation');

  await openDoor(s, 'porte_absences');
  await talk(s, 'margaux', ['know']);
  expect(s.dialogue.seen('margaux', 'm_know')).toBe(true);
  await talk(s, 'aurele');
  expect(s.dialogue.seen('aurele', 'song')).toBe(true);
  await talk(s, 'jules');
  const julesKept = s.vars.get('memory.julesChoice') === 'garde';
  expect(s.dialogue.seen('jules', julesKept ? 'home_keep' : 'home_sold')).toBe(true);
  expect(s.quests.stage(Q.q2)).toBe('oriane');

  await openDoor(s, 'porte_atelier');
  await talk(s, 'oriane', ['fix']);
  expect(s.vars.get('memory.orianeConfessed')).toBe(true);
  expect(s.quests.stage(Q.q2)).toBe('piste');

  // The record of lot 212 is not public.
  expect(await interact(s, 'fiche_vente')).toBe(false);
  if (path === 'aide') {
    await talk(s, 'bastien', ['other']);
    expect(s.vars.get('memory.bastienAsked')).toBe(true);
    await openDoor(s, 'porte_atelier');
    expect(await interact(s, 'liasse_bastien', 'take')).toBe(true);
    expect(inv(s).has('memory:registre_lots')).toBe(true);
    await talk(s, 'bastien');
    expect(inv(s).has('memory:registre_lots')).toBe(false);
    expect(chamber(s).state('chemin')).toBe('possede');
    expect(visible(s, 'pas_1')).toBe(true);
  } else {
    await talk(s, 'bastien', ['trade', 'yes']);
    // The trade costs a memory: its state becomes « cédé », and the clue of the path is lost.
    expect(chamber(s).state('chemin')).toBe('cede');
    expect(chamber(s).isAnchored('chemin')).toBe(false);
    await advance(s, 0.3);
    expect(visible(s, 'pas_1')).toBe(false);
    expect(chamber(s).anchor('chemin')).toBe(false);
  }
  expect(s.vars.get('memory.tradeChoice')).toBe(path);
  expect(s.vars.get('memory.ficheAccess')).toBe(true);

  expect(await interact(s, 'fiche_vente')).toBe(true);
  expect(s.vars.get('memory.ficheRead')).toBe(true);
  await waitFor(s, () => s.dialogue.isActive, 5);
  expect(s.dialogue.view()?.dialogueId).toBe('confrontation_vel');
  await choose(s, 'consent');
  await advanceDialogue(s);
  expect(s.vars.get('memory.velConfronted')).toBe(true);
  // Oriane's answer depends on the path.
  expect(s.dialogue.seen('confrontation_vel', path === 'aide' ? 'c_help_or' : 'c_trade_or')).toBe(true);
  expect(s.dialogue.seen('confrontation_vel', path === 'aide' ? 'c_trade_or' : 'c_help_or')).toBe(false);

  // Léa refuses at once that her memory be given back without her.
  await talk(s, 'lea', ['remember', 'restore']);
  expect(notified(game, 'Léa refuse la restauration.')).toBe(true);
  expect(s.vars.get('memory.leaConsent')).toBeUndefined();
  expect(s.quests.status(Q.q2)).toBe('completed');
  expect(s.quests.status(Q.q3)).toBe('active');
}

/** Act III: the song to the end, the reconstruction, the White Room, the consent. */
async function actThree(game: HeadlessGame, honest: boolean, decision: Decision): Promise<void> {
  const s = game.session;
  await talk(s, 'silas', ['play', honest ? 'truth' : 'evade']);
  expect(s.vars.get('memory.songComplete')).toBe(true);
  await openDoor(s, 'porte_atelier');
  await talk(s, 'oriane');
  expect(chamber(s).state('vente')).toBe('possede');
  expect(s.quests.stage(Q.q3)).toBe('chambre');

  // The lamp stays dark until the reconstructed memory is anchored (chamber full: make room).
  expect(await interact(s, 'lampe_resonance')).toBe(false);
  if (chamber(s).slots.every(Boolean)) expect(chamber(s).remove('jardin')).toBe(true);
  expect(chamber(s).anchor('vente')).toBe(true);
  expect(await interact(s, 'lampe_resonance')).toBe(true);
  await advance(s, 1.5);
  expect(s.world!.id).toBe('chambre_blanche');
  await waitFor(s, () => s.cinematics.current?.id === 'M03_chambre_blanche', 3);
  await skipCinematics(s);
  await advance(s, 0.5);
  expect(s.vars.get('memory.whiteRoomSeen')).toBe(true);
  expect(visible(s, 'porte_fantome_1')).toBe(false);
  expect(await interact(s, 'retour_atelier')).toBe(true);
  await advance(s, 1.5);
  expect(s.world!.id).toBe('reminence');
  expect(s.quests.stage(Q.q3)).toBe('consentement');

  // Léa and Silas are in the workshop.
  if (decision === 'leaRefuses') {
    await talk(s, 'lea', ['impose']);
    expect(s.vars.get('memory.leaConsent')).toBe('refuse');
    expect(notified(game, 'Léa refuse la restauration.')).toBe(true);
    expect(s.dialogue.seen('lea', 'silas_q')).toBe(false);
  } else {
    await talk(s, 'lea', ['ask', decision === 'accept' ? 'truth' : 'soften']);
    expect(s.vars.get('memory.leaConsent')).toBe('accepte');
  }
  // The key lines are said in every case.
  expect(s.dialogue.seen('lea', decision === 'leaRefuses' ? 'key_lea_refused' : 'key_lea')).toBe(true);
  expect(s.dialogue.seen('lea', decision === 'leaRefuses' ? 'key_silas_refused' : 'key_silas')).toBe(true);
  if (decision === 'accept') {
    expect(s.vars.get('memory.restorationOutcome')).toBe('acceptee');
    expect(chamber(s).state('vente')).toBe('restaure');
    expect(notified(game, 'Souvenir restauré.')).toBe(true);
  } else {
    expect(s.vars.get('memory.restorationOutcome')).toBe('refusee');
    expect(chamber(s).state('vente')).toBe('possede');
    if (decision === 'silasRefuses') {
      expect(s.vars.get('memory.silasConsent')).toBe('refuse');
      expect(notified(game, 'Silas refuse la restauration.')).toBe(true);
    }
  }
  await advance(s, 4.5);
  expect(s.quests.status(Q.q3)).toBe('completed');
  expect(s.quests.status(Q.q4)).toBe('active');
  expect(s.vars.get('memory.recognition.silas')).toBe(decision === 'accept' ? 'lie' : 'reconnu');
}

/** Denouement: the register of copies, Sujet Zéro, the White Room, the Rémanence. */
async function denouement(game: HeadlessGame, decision: Decision, doorCompleted = false): Promise<void> {
  const s = game.session;
  expect(await interact(s, 'armoire_copies')).toBe(false);
  await talk(s, 'oriane', ['change', 'show']);
  expect(s.vars.get('memory.illegalCopiesExposed')).toBe(true);
  await advance(s, 0.5);
  expect(visible(s, 'affiche_copies')).toBe(true);
  expect(visible(s, 'etiquette_sujet_zero')).toBe(true);
  expect(s.world!.entities.get('file_1')!.position.z).toBeLessThan(25);

  expect(await interact(s, 'armoire_copies')).toBe(true);
  expect(s.cinematics.current?.id).toBe('M04_sujet_zero');
  s.cinematics.skip();
  await advance(s, 2);
  expect(s.vars.get('memory.sujetZero')).toBe(true);
  expect(chamber(s).originOf('ambre')).toBe('memory.shard.ambre.revealed');
  expect(norm(s.civ!.ctx.t(chamber(s).originOf('ambre')))).toBe('SUJET ZÉRO — TRANSFERT INTERMONDE');
  expect(s.world!.id).toBe('chambre_blanche');
  expect(s.cinematics.current?.id).toBe(doorCompleted ? 'M04b_vision_seuil' : 'M04b_vision');
  await skipCinematics(s);
  await advance(s, 0.5);
  expect(visible(s, 'porte_fantome_3')).toBe(true);
  expect(visible(s, 'porte_seuil')).toBe(doorCompleted);
  expect(visible(s, 'retour_atelier')).toBe(false);

  let finished = false;
  s.bus.on('civ.finished', () => (finished = true));
  expect(await interact(s, 'remanence', 'take')).toBe(true);
  await advance(s, 3.5);
  expect(s.multiverse.hasFragment('remanence')).toBe(true);
  expect(s.world!.id).toBe('reminence');
  const outcome = decision === 'accept' ? 'acceptee' : 'refusee';
  expect(s.cinematics.current?.id).toBe(`M05_epilogue_${outcome}`);
  await skipCinematics(s);
  await advance(s, 0.5);
  const end = game.ui.endScreens[0]!;
  expect(norm(end.title)).toBe("FIN DU PROLOGUE — LE NOM QU'ON T'A VOLÉ");
  expect(norm(end.subtitle)).toBe('Un souvenir attend ailleurs.');
  expect(end.lines?.map(norm)).toContain('Rémanence obtenue.');
  expect(end.lines?.some((l) => l.includes('seuil se souvient'))).toBe(doorCompleted);
  expect(finished).toBe(true);
  expect(s.vars.get('memory.finished')).toBe(true);
  expect(s.multiverse.progress('memory').completed).toBe(true);
  expect(s.multiverse.getFlag('memory.restoration')).toBe(outcome);
}

describe('Memory Civilization — parcours complet', () => {
  it('help path, honest player: Silas accepts the restoration', async () => {
    const game = await start();
    await prologue(game, 'keep');
    await actOne(game, true);
    await actTwo(game, 'aide');
    await actThree(game, true, 'accept');
    await denouement(game, 'accept');
    expect(game.session.logHub.errors()).toEqual([]);
  }, 180_000);

  it('trade path, a comforting lie: Silas refuses, and they meet as strangers', async () => {
    const game = await start();
    await prologue(game, 'yours');
    await actOne(game, false);
    await actTwo(game, 'echange');
    await actThree(game, false, 'silasRefuses');
    await denouement(game, 'silasRefuses');
    expect(game.session.logHub.errors()).toEqual([]);
  }, 180_000);

  it('Léa refuses when the restoration is imposed; the Door civilization leaves its trace', async () => {
    const game = await start({ doorCompleted: true });
    await prologue(game, 'keep');
    await actOne(game, true);
    await actTwo(game, 'aide');
    await actThree(game, true, 'leaRefuses');
    await denouement(game, 'leaRefuses', true);
  }, 180_000);

  it('honesty is not enough without trust: an honest answer after earlier lies still gets a refusal', async () => {
    const game = await start();
    await prologue(game, 'keep');
    await actOne(game, false);
    await actTwo(game, 'aide');
    const s = game.session;
    // Evasive about the song, then honest at the end: trust 1 < 2.
    await actThreeUntilConsent(game, false);
    await talk(s, 'lea', ['ask', 'truth']);
    expect(s.dialogue.seen('lea', 'refuse_gentle')).toBe(true);
    expect(s.vars.get('memory.restorationOutcome')).toBe('refusee');
  }, 180_000);

  it('shards, slots, the puzzle and the choices persist through a save and a reload', async () => {
    const game = await start();
    await prologue(game, 'yours');
    await actOne(game, true);
    await actTwo(game, 'echange');
    const s = game.session;
    const raw = JSON.parse(JSON.stringify(s.buildSaveGame('slot1', 'test')));
    const { save } = parseSave(raw);

    const game2 = await createHeadlessGame(new GlobContentProvider());
    await game2.session.applySaveGame(save);
    await game2.session.loadCivilization('memory');
    await advance(game2.session, 0.5);
    const s2 = game2.session;
    expect(chamber(s2).state('ambre')).toBe('possede');
    expect(chamber(s2).state('chemin')).toBe('cede');
    expect(chamber(s2).state('jardin')).toBe('possede');
    expect([...chamber(s2).slots]).toEqual([...chamber(s).slots]);
    expect(offering(s2).solved).toBe(true);
    expect(s2.vars.get('memory.tradeChoice')).toBe('echange');
    expect(s2.vars.get('memory.julesChoice')).toBe('vend');
    expect(s2.vars.get('memory.recognition.silas')).toBe('sensation');
    expect(s2.quests.status(Q.q3)).toBe('active');
    expect(s2.cinematics.current).toBeNull();
    // Global state is separate: nothing was granted yet.
    expect(s2.multiverse.hasFragment('remanence')).toBe(false);
    await actThree(game2, true, 'accept');
    await denouement(game2, 'accept');
  }, 180_000);
});

/** Act III up to the consent scene (used by the trust test). */
async function actThreeUntilConsent(game: HeadlessGame, honest: boolean): Promise<void> {
  const s = game.session;
  await talk(s, 'silas', ['play', honest ? 'truth' : 'evade']);
  await openDoor(s, 'porte_atelier');
  await talk(s, 'oriane');
  if (chamber(s).slots.every(Boolean)) chamber(s).remove('jardin');
  chamber(s).anchor('vente');
  expect(await interact(s, 'lampe_resonance')).toBe(true);
  await advance(s, 1.5);
  await waitFor(s, () => s.cinematics.current?.id === 'M03_chambre_blanche', 3);
  await skipCinematics(s);
  await advance(s, 0.5);
  expect(await interact(s, 'retour_atelier')).toBe(true);
  await advance(s, 1.5);
  expect(s.quests.stage(Q.q3)).toBe('consentement');
}
