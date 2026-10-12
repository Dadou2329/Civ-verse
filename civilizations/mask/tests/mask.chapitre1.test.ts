/**
 * Mask Civilization — headless playthrough of Chapter I « Courir plus haut ».
 *
 * Played the way a player would (same approach as mask.prologue.test.ts): walking with A* at the
 * player's size, interacting through the game's pipeline, the key in hand and the mouse buttons,
 * the qualifying course run with the player's own physics (low walls jumped, ladders climbed,
 * gaps jumped with a run-up, the training wheel launched with E), dialogues answered,
 * cinematics checked then skipped, saves reloaded.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { advance, advanceDialogue, createHeadlessGame, face, flush, skipCinematics, walkTo, type HeadlessGame } from '@engine/core/testing/headless';
import { findPath } from '@engine/core/nav/pathfinder';
import { parseSave } from '@engine/core/save/saveFormat';
import type { GameSession } from '@engine/core/sim/session';
import type { CalibrageApi } from '../mechanics/calibrage';
import type { ParcoursApi } from '../mechanics/parcours';
import { COURSE, G, LAVOIR } from '../seed/layout';

const CLE = 'mask:cle_atelier';
const MARTEAU = 'mask:marteau_cendre';
const MASQUE = 'mask:masque_cendre';
const DOSSIER = 'mask:dossier';
const RESSORT = 'mask:ressort_trame';
const Q = 'chapitre1';

/** French typography uses no-break spaces (before « : ? ! » etc.): compare texts without them. */
const norm = (t: string | undefined | null) => (t ?? '').replace(/[\u00a0\u202f]/g, ' ');
const inv = (s: GameSession) => s.civ!.ctx.inventory;
const stage = (s: GameSession) => s.quests.stage(Q);
const modelOf = (s: GameSession, id: string) => s.world!.entities.get(id)!.components.get('core.model')!.props.model;
const visible = (s: GameSession, id: string) => s.world!.entities.get(id)!.visible;
const calibrage = (s: GameSession, id: string) => s.entityApi(id)!.behavior<CalibrageApi>('mask.calibrage')!;
const parcours = (s: GameSession) => s.entityApi('arche_depart')!.behavior<ParcoursApi>('mask.parcours')!;
const notes = (game: HeadlessGame) => game.ui.notifications.map((n) => norm(n.text));
/** Walking height of the footbridge deck at a given z (43 → 8 … 47 → 10). */
const deckTop = (z: number) => 8 + (Math.floor(z) - 43) * 0.5;

async function start(): Promise<HeadlessGame> {
  const game = await createHeadlessGame(new GlobContentProvider());
  await game.session.loadCivilization('mask', { fresh: true });
  await advance(game.session, 0.3);
  return game;
}

async function reload(s: GameSession): Promise<HeadlessGame> {
  const { save } = parseSave(JSON.parse(JSON.stringify(s.buildSaveGame('slot1', 'test'))));
  const game = await createHeadlessGame(new GlobContentProvider());
  await game.session.applySaveGame(save);
  await game.session.loadCivilization('mask');
  await advance(game.session, 0.3);
  return game;
}

async function interact(s: GameSession, entityId: string, offerId?: string): Promise<boolean> {
  await walkTo(s, entityId);
  const ok = await s.interaction.interactWith(entityId, 'primary', offerId);
  await flush();
  return ok;
}

async function waitFor(s: GameSession, test: () => boolean, seconds = 20): Promise<void> {
  for (let t = 0; t < seconds && !test(); t += 0.1) await advance(s, 0.1);
  expect(test()).toBe(true);
}

/** Aims at a height `dy` above an entity's position, from where the player is. */
function aim(s: GameSession, id: string, dy = 0.7): void {
  const p = s.world!.entities.get(id)!.position;
  face(s, { x: p.x, y: p.y + dy - 1, z: p.z });
}

/** Holds a mouse button for `seconds`, then releases it. */
async function hold(s: GameSession, seconds: number): Promise<void> {
  s.equipment.press('primary');
  await advance(s, seconds);
  s.equipment.release('primary');
  await advance(s, 0.3);
}

/** Reads a dialogue line by line until a choice or its end: « Speaker: text ». */
async function lines(s: GameSession): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < 40; i++) {
    await flush();
    const v = s.dialogue.view();
    if (!v) break;
    if (v.text) out.push(`${v.speakerName ?? ''}: ${norm(v.text)}`);
    if (!v.canAdvance) break;
    s.dialogue.advance();
  }
  await flush();
  return out;
}

/** Picks a dialogue choice, then reads the lines that follow it. */
async function pick(s: GameSession, choiceId: string): Promise<string[]> {
  const v = s.dialogue.view();
  expect(v?.choices.map((c) => c.id)).toContain(choiceId);
  s.dialogue.choose(choiceId);
  return lines(s);
}

async function talkTo(s: GameSession, id: string): Promise<string[]> {
  await walkTo(s, id);
  expect(await s.interaction.interactWith(id, 'primary')).toBe(true);
  return lines(s);
}

/**
 * Steers the player toward (x, z) with its own physics (walking or running), jumping where
 * `jump` says. Stops within 0.25 m.
 */
async function steer(s: GameSession, x: number, z: number, opts: { sprint?: boolean; jump?: (p: { x: number; y: number; z: number }) => boolean; frames?: number } = {}): Promise<void> {
  const p = s.player;
  for (let i = 0; i < (opts.frames ?? 900); i++) {
    const dx = x - p.position.x;
    const dz = z - p.position.z;
    if (Math.hypot(dx, dz) < 0.25) break;
    p.setLook(Math.atan2(dx, dz), 0);
    p.intent.forward = 1;
    p.intent.sprint = !!opts.sprint;
    if (opts.jump?.(p.position) && p.body.grounded) p.intent.jump = true;
    s.update(1 / 60);
    p.intent.jump = false;
    await flush(1);
  }
  p.intent.forward = 0;
  p.intent.sprint = false;
  await advance(s, 0.25);
  // Let a jump or a hoist finish: back on the ground (or hanging on a ladder).
  for (let i = 0; i < 40 && !p.body.grounded && p.modifierCount === 0; i++) await advance(s, 0.05);
}

/** Waits for the needle of a mechanism to be well inside its zone (or outside it). */
async function waitNeedle(s: GameSession, id: string, inside: boolean): Promise<void> {
  const api = calibrage(s, id);
  const ok = () => {
    const [a, b] = api.zone;
    const n = api.needle;
    return inside ? n > a + 0.035 && n < b - 0.035 : n < a - 0.08 || n > b + 0.08;
  };
  for (let i = 0; i < 600 && !ok(); i++) {
    s.update(1 / 60);
    await flush(1);
  }
  expect(ok()).toBe(true);
}

/** A click with the item in hand. */
async function click(s: GameSession): Promise<void> {
  s.equipment.press('primary');
  s.update(1 / 60);
  s.equipment.release('primary');
  await advance(s, 0.35);
}

// ---------------------------------------------------------------------------------------------
// The chapter, step by step
// ---------------------------------------------------------------------------------------------

/**
 * The end of the Prologue (played in full by mask.prologue.test.ts): key in hand, hammer in the
 * bar, the quest completed. Then the next morning (C10) opens Chapter I.
 */
async function lendemain(game: HeadlessGame): Promise<void> {
  const s = game.session;
  await skipCinematics(s);
  await flush();
  expect(await interact(s, 'cle_atelier')).toBe(true);
  inv(s).add(MARTEAU, 1, { silent: true });
  s.vars.set('mask.junoRelais', true);
  s.quests.complete('prologue');
  await advance(s, 0.3);
  expect(s.quests.status('prologue')).toBe('completed');
  await waitFor(s, () => s.cinematics.current?.id === 'C10_lendemain', 10);
  await advance(s, 0.5);
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('Le lendemain matin.');
  await skipCinematics(s);
  await advance(s, 0.3);
  expect(s.quests.status(Q)).toBe('active');
  expect(stage(s)).toBe('bureau');
  expect(game.ui.locations).toContain('Chapitre I');
  // Juno waits in front of the registration office, on the ground (no more leaping on roofs).
  const juno = s.world!.entities.get('juno')!.position;
  expect(Math.hypot(juno.x - 95.2, juno.z - 66.5)).toBeLessThan(0.5);
  expect(juno.y).toBeCloseTo(G, 1);
  expect(s.equipment.hotbar.slice(0, 2)).toEqual([CLE, MARTEAU]);
}

/** I01 — the registration office: Juno's relay, the clerk's three validations, the file. */
async function bureau(game: HeadlessGame): Promise<void> {
  const s = game.session;
  // Without the relay, the clerk sends the candidate back.
  expect(await talkTo(s, 'commis')).toEqual(['Le commis: Les candidats se présentent avec leur relais. Le règlement, c’est le règlement.']);
  expect(s.vars.get('mask.dossierRecu')).not.toBe(true);

  let said = await talkTo(s, 'juno');
  expect(said[0]).toBe('Juno: Te voilà ! J’ai cru que tu allais faire la grasse matinée le jour le plus important de ta vie.');
  said = await pick(s, 'sourire');
  expect(said[0]).toBe('Juno: Celui qui dit « je répare votre toit et je ne partirai pas avec les gouttières ».');
  await advance(s, 0.2);
  expect(s.dialogue.isActive).toBe(false);
  expect(s.quests.isObjectiveDone(Q, 'juno')).toBe(true);

  // The key lines of I01, word for word (scenario).
  said = await talkTo(s, 'commis');
  expect(said.slice(0, 6)).toEqual([
    'Le commis: Nom, quartier, masque.',
    'Toi: Rives Basses, atelier de Nora. Cendre.',
    'Le commis: Vous êtes Cendre ? Alors il faut trois validations.',
    'Toi: Les autres n’en ont qu’une.',
    'Le commis: Les autres ne sont pas Cendre.',
    'Toi: Ah. C’est donc écrit comme ça.',
  ]);
  // Juno cannot bend the rule; Lys turns the chore into training.
  expect(said).toContain('Juno: Je ne peux pas tordre le règlement. Par contre, je peux t’aider à le battre à la course.');
  expect(said).toContain('Lys: Trois preuves ? Parfait. On en fait ton entraînement.');
  await advance(s, 0.3);
  expect(inv(s).has(DOSSIER)).toBe(true);
  expect(stage(s)).toBe('preuves');

  // The file can be read from the inventory: nothing signed yet.
  await inv(s).use(DOSSIER, 'lire');
  await flush();
  const doc = game.ui.documents.at(-1)!;
  expect(norm(doc.title)).toBe('Dossier de candidature — Épreuves de l’Ascension');
  expect(doc.body.map(norm)).toContain('Précision : à valider. (L’automate de tri du marché.)');
}

/** I02 Précision + I03 — the automaton, the box of old masks, the split Fil mask, the calibration. */
async function precision(game: HeadlessGame, opts: { linger?: boolean } = {}): Promise<void> {
  const s = game.session;
  const reacted: string[] = [];
  s.bus.on('mask.ch1.second_mask_reacted', () => reacted.push('reacted'));
  expect(await talkTo(s, 'automate_tri')).toEqual([
    'Toi: Le ressort de trame a sauté. Sans lui, l’automate trie les paquets… en les lançant par-dessus son épaule.',
    'Toi: Lys a une caisse de vieilleries à l’atelier, près de l’établi. Il y aura bien un ressort dedans.',
  ]);
  expect(s.vars.get('mask.automateExamine')).toBe(true);

  // I03 — in the workshop, Lys's box: the old split Fil mask answers the hero's weave.
  expect(await interact(s, 'caisse_vieux_masques')).toBe(true);
  await advance(s, 0.2);
  expect(s.cinematics.current?.id).toBe('C11_vieux_masques');
  const sub = () => `${s.cinematics.subtitleView()?.speaker ?? ''}: ${norm(s.cinematics.subtitleView()?.text)}`;
  const at = async (t: number) => advance(s, t - s.cinematics.time);
  await at(1.2);
  expect(sub()).toBe('Lys: Tiens, ton futur visage. Il manque une moitié et il grince, mais avec un peu de peinture…');
  await at(6.2);
  expect(sub()).toBe('Toi: Très drôle.');
  await at(15.6);
  expect(sub()).toBe('Lys: Tu as senti ça ?');
  await at(17.8);
  expect(sub()).toBe('Toi: J’ai eu l’impression… de voir le toit depuis le toit d’en face.');
  await at(21.4);
  expect(sub()).toBe('Lys: Ne le répète à personne. Les Fixateurs adorent confisquer ce qu’ils ne comprennent pas.');
  await at(25.2);
  expect(sub()).toBe('Toi: C’était un accident.');
  await at(27);
  expect(sub()).toBe('Lys: Alors évitons d’en avoir un deuxième sur la place du marché.');
  await skipCinematics(s);
  await advance(s, 0.3);
  expect(reacted).toEqual(['reacted']);
  expect(inv(s).has(RESSORT)).toBe(true);
  expect(visible(s, 'masque_fendu')).toBe(false);
  // No amnesia, no new power: the same Cendre mask, the same things in hand.
  expect(s.equipment.wornIn('masque')).toBe(MASQUE);
  expect(s.equipment.hotbar.slice(0, 2)).toEqual([CLE, MARTEAU]);
  // The journal gives the three simple lines (learned, what it changes, what to do).
  const thread = s.quests.view().find((q) => q.id === 'masque_fendu')!;
  expect(thread.status).toBe('active');
  const three = norm(thread.stageText).split('\n');
  expect(three.map((l) => l.split(' : ')[0])).toEqual(['Ce que j’ai appris', 'Ce que ça change', 'Ce que je vais faire']);

  // Back at the market: the spring goes in, then three timed turns of the key.
  expect(await talkTo(s, 'automate_tri')).toEqual(['Toi: Le ressort en place. Reste à régler l’automate : clé en main, et du doigté.']);
  expect(inv(s).has(RESSORT)).toBe(false);
  expect(modelOf(s, 'automate_tri')).toBe('mask:automate_tri_repare');
  expect(s.equipment.select(0)).toBe(true);
  await advance(s, 0.4);
  expect(s.equipment.held).toBe(CLE);
  await walkTo(s, 'automate_tri', { reach: 1.8 });
  aim(s, 'automate_tri', 1);
  const api = calibrage(s, 'automate_tri');
  // A miss: a screw pops out, nothing is lost.
  await waitNeedle(s, 'automate_tri', false);
  await click(s);
  expect(api.successes).toBe(0);
  expect(notes(game)).toContain('Clang ! Une vis saute. Recommence.');
  await advance(s, 0.9);
  for (let i = 1; i <= 3; i++) {
    await waitNeedle(s, 'automate_tri', true);
    await click(s);
    expect(api.successes).toBe(i);
  }
  expect(api.done).toBe(true);
  expect(s.vars.get('mask.automateRegle')).toBe(true);
  // Mireille, next to it, signs at once.
  await waitFor(s, () => s.dialogue.view()?.dialogueId === 'c1_mireille', 5);
  if (opts.linger) {
    // The last signature: whatever comes next waits until the player has finished reading.
    await advance(s, 6);
    expect(s.cinematics.current).toBeNull();
    expect(s.dialogue.view()?.dialogueId).toBe('c1_mireille');
  }
  expect((await lines(s))[0]).toBe('Mireille: Il trie ! Il trie même mieux qu’avant. Donne ton dossier, je signe : tu as des doigts d’horloger.');
  await advance(s, 0.2);
  expect(s.vars.get('mask.preuve.precision')).toBe(true);
}

/** I02 Courage — the washerwomen's footbridge, in the rain, with sliding crates. */
async function courage(game: HeadlessGame): Promise<void> {
  const s = game.session;
  const said = await talkTo(s, 'rosalie');
  expect(said[0]).toBe('Rosalie: Les ancrages de la passerelle ont lâché avec l’humidité. S’il repleut, toutes mes cagettes de linge vont descendre la pente !');
  expect(s.vars.get('mask.courageDemande')).toBe(true);
  // The footbridge is walkable without jumping, from the south quay up to the terrace.
  const path = findPath(s.world!.collision, { x: 23.5, y: G, z: 40.5 }, { x: 21.5, y: LAVOIR.top, z: 50 }, { jumpHeight: 0, maxNodes: 60000 });
  expect(path).not.toBeNull();

  // Onto the deck: the rain comes back.
  s.player.teleport({ x: 23.5, y: deckTop(45), z: 45.5 });
  await advance(s, 0.4);
  expect(s.vars.get('mask.pluie')).toBe(true);
  expect(s.entityApi('averse_lavoir')!.viewFlag('averse')).toBe(true);
  await advance(s, 1.6);
  expect(notes(game)).toContain('Les cagettes glissent sur les planches mouillées : fixe chaque ancrage (clé en main, clic maintenu) entre deux cagettes.');
  expect(s.equipment.select(0)).toBe(true);
  await fixAnchor(s, 'ancrage_1', [22.7, 45.6], 1);
  await fixAnchor(s, 'ancrage_2', [24.3, 44.6], 2);
  await fixAnchor(s, 'ancrage_3', [22.7, 43.6], 1);
  expect(s.vars.get('mask.ancrages')).toBe(3);
  await advance(s, 0.3);
  // The rain stops, Rosalie signs.
  expect(s.vars.get('mask.pluie')).toBe(false);
  await waitFor(s, () => s.dialogue.view()?.dialogueId === 'c1_rosalie', 5);
  expect((await lines(s))[0]).toBe('Rosalie: Tu es trempé, mais ma passerelle tient. Je signe, et je te prête une serviette.');
  await advance(s, 0.2);
  expect(s.vars.get('mask.preuve.courage')).toBe(true);
  expect(s.entityApi('averse_lavoir')!.viewFlag('averse')).toBeUndefined();
}

/** Holds the key on an anchor right after the crate of its lane went by (its run takes 1.4 s). */
async function fixAnchor(s: GameSession, id: string, [x, z]: [number, number], lane: number): Promise<void> {
  s.player.teleport({ x, y: deckTop(z), z });
  await advance(s, 0.2);
  const crate = `cagette_glisse_${lane}`;
  // Wait for the crate to slide down, then to vanish at the bottom.
  await waitFor(s, () => visible(s, crate), 10);
  await waitFor(s, () => !visible(s, crate), 10);
  aim(s, id, 0.3);
  await hold(s, 1.6);
  expect(modelOf(s, id)).toBe('mask:ancrage');
}

/** I02 Entraide — Mireille and Octave, the fountain corner, three crates. */
async function entraide(game: HeadlessGame, choice: 'collaboration' | 'repartition'): Promise<void> {
  const s = game.session;
  let said = await talkTo(s, 'marchande_fruits');
  expect(said.slice(0, 3)).toEqual([
    'Mireille: Le coin de la fontaine, c’est le mien depuis trois printemps !',
    'Octave: Depuis trois printemps, tes pêches tachent mes toiles.',
    'Mireille: Et tes toiles font de l’ombre à mes pêches !',
  ]);
  said = await pick(s, choice);
  expect(said[0]).toBe(choice === 'collaboration' ? 'Octave: … Des pêches sous mon auvent.' : 'Mireille: Le matin, c’est quand les gens ont faim.');
  await advance(s, 0.3);
  expect(s.vars.get('mask.entraideChoix')).toBe(choice);
  for (const id of ['cagette_1', 'cagette_2', 'cagette_3']) expect(await interact(s, id)).toBe(true);
  expect(inv(s).count('mask:cagette')).toBe(3);
  for (let i = 1; i <= 3; i++) {
    expect(await interact(s, 'emplacement_fontaine')).toBe(true);
    expect(s.vars.get('mask.cagettesPosees')).toBe(i);
  }
  expect(inv(s).count('mask:cagette')).toBe(0);
  // The stalls move to the fountain; the one who agreed first signs.
  await advance(s, 0.3);
  expect(visible(s, 'etal_fruits')).toBe(false);
  expect(visible(s, 'etal_fontaine_fruits')).toBe(true);
  expect(visible(s, 'etal_fontaine_tissus')).toBe(true);
  const signer = choice === 'collaboration' ? 'c1_octave' : 'c1_mireille';
  await waitFor(s, () => s.dialogue.view()?.dialogueId === signer, 40);
  said = await lines(s);
  expect(said[0]).toBe(
    choice === 'collaboration' ? 'Octave: Tu as plus de bon sens que la moitié du conseil. Je signe ton dossier.' : 'Mireille: Propre, net, sans dispute. Enfin, sans grosse dispute. Je signe ton dossier.',
  );
  await advanceDialogue(s);
  await advance(s, 0.2);
  expect(s.vars.get('mask.preuve.entraide')).toBe(true);
}

/** The district's party (C12), then the next morning at the stage. */
async function fete(game: HeadlessGame): Promise<void> {
  const s = game.session;
  expect(stage(s)).toBe('fete');
  await waitFor(s, () => s.cinematics.current?.id === 'C12_fete', 10);
  expect(visible(s, 'guirlande_sud')).toBe(true);
  await advance(s, 26.4 - s.cinematics.time);
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('Dossier complet. Qualification demain matin, sur l’estrade des candidatures.');
  await skipCinematics(s);
  await advance(s, 0.3);
  expect(stage(s)).toBe('qualification');
  expect(visible(s, 'kael')).toBe(true);
  const p = s.player.position;
  expect(Math.hypot(p.x - 65.5, p.z - 79.8)).toBeLessThan(0.6);
}

/**
 * The qualifying course with the player's physics: the two low walls, ladder 1, the gap to ledge
 * B, the training wheel (E at the right moment), ladder 2, and the long jump to the flag — or a
 * fall into the pit before it.
 */
async function runCourse(s: GameSession, opts: { fallInPit?: boolean } = {}): Promise<void> {
  const p = s.player;
  p.teleport({ x: 64, y: G + 1, z: 87.2 }, 0);
  await advance(s, 0.2);
  await steer(s, 64, 96.4, { jump: (q) => (q.z > 91.2 && q.z < 91.7) || (q.z > 94.2 && q.z < 94.7) });
  expect(parcours(s).status).toBe('running');
  // Past both walls, at the foot of ledge A (the last jump may land straight on the ladder).
  expect(p.position.z).toBeGreaterThan(COURSE.murets[1]! + 1);
  // Ladder 1: push against it to climb, the hero is hoisted onto ledge A.
  await steer(s, 64, 98.2);
  expect(p.position.y).toBeCloseTo(COURSE.A.top, 1);
  // A running jump over the gap to ledge B.
  await steer(s, 71.5, 98.2, { sprint: true, jump: (q) => q.x > 67.4 && q.x < 67.9 });
  expect(p.position.y).toBeCloseTo(COURSE.B.top, 1);
  expect(p.position.x).toBeGreaterThan(70);
  // The training wheel, launched with E when the red mark passes at the top.
  expect(visible(s, 'echelle_2')).toBe(false);
  await steer(s, 76.5, 98.4);
  aim(s, 'roue_entrainement', 1);
  s.interaction.refresh();
  expect(s.interaction.target?.entityId).toBe('roue_entrainement');
  await waitNeedle(s, 'roue_entrainement', true);
  expect(await s.interaction.interact('primary')).toBe(true);
  await advance(s, 0.2);
  expect(s.vars.get('mask.roueLancee')).toBe(true);
  expect(visible(s, 'echelle_2')).toBe(true);
  // Ladder 2, up to ledge C.
  await steer(s, 72.5, 98.8);
  await steer(s, 72.5, 101.2);
  expect(p.position.y).toBeCloseTo(COURSE.C.top, 1);
  if (opts.fallInPit) {
    // Walking off the edge without a jump: down into the pit, the run is lost.
    await steer(s, 67.2, 101.5, { frames: 240 });
    return;
  }
  // A run-up and the long jump to D, where the flag stands.
  await steer(s, 61.8, 101.5, { sprint: true, jump: (q) => q.x < 69.5 && q.x > 69.05 });
}

/** I04 — Kaël, a missed first try with his advice, then the qualification. */
async function qualification(game: HeadlessGame): Promise<void> {
  const s = game.session;
  const said = await talkTo(s, 'kael');
  expect(said.slice(0, 5)).toEqual([
    'Kaël: Tu es celui qui a arrêté le monte-charge ?',
    'Toi: Celui qui a sauvé les caisses et la réputation du service technique, oui.',
    'Kaël: Ici, personne ne va t’applaudir pour avoir un bon mot.',
    'Toi: Dommage. J’en avais préparé quatre.',
    'Kaël: Garde ton souffle pour la course.',
  ]);
  expect(s.dialogue.seen('c1_kael', 'k7')).toBe(true);
  expect(s.quests.isObjectiveDone(Q, 'kael')).toBe(true);

  // First try: a fall into the pit sends the runner back to the stage, with advice.
  await runCourse(s, { fallInPit: true });
  await waitFor(s, () => s.dialogue.view()?.dialogueId === 'c1_kael', 5);
  expect(parcours(s).fails).toBe(1);
  expect(parcours(s).status).toBe('idle');
  expect((await lines(s))[0]).toBe('Kaël: Tu prends l’échelle comme on prend un escalier. Avance contre elle et monte, sans sauter. Recommence.');
  const back = s.player.position;
  expect(back.z).toBeLessThan(89);
  expect(s.civ!.ctx.ui.store.get('mask.parcours')).toBeNull();

  // Second try, all the way to the flag.
  await runCourse(s);
  expect(parcours(s).status).toBe('done');
  expect(s.vars.get('mask.parcoursReussi')).toBe(true);
  expect(parcours(s).elapsed).toBeLessThan(100);
  // Back on the stage, Kaël signs (word for word, scenario).
  await waitFor(s, () => s.dialogue.view()?.dialogueId === 'c1_kael', 8);
  expect(await lines(s)).toEqual([
    'Kaël: Tu as gagné ta place sur la ligne de départ. Ne la gâche pas.',
    'Toi: C’est presque un compliment.',
    'Kaël: N’exagérons rien.',
  ]);
  await advance(s, 0.3);
  expect(s.vars.get('mask.kaelSigne')).toBe(true);
  expect(s.quests.status(Q)).toBe('completed');
}

/** The end of the chapter: Vaurel reads the list of the qualified (C13), no narrator. */
async function finChapitre(game: HeadlessGame): Promise<void> {
  const s = game.session;
  await waitFor(s, () => s.cinematics.current?.id === 'C13_vaurel', 8);
  expect(s.dialogue.isActive).toBe(false);
  await advance(s, 8.6 - s.cinematics.time);
  expect(s.cinematics.subtitleView()?.speaker).toBe('Vaurel');
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('Un Cendre qualifié. Tiens.');
  await skipCinematics(s);
  await advance(s, 6);
  expect(game.ui.locations).toContain('Fin du chapitre I');
  expect(notes(game).some((n) => n.startsWith('La suite, le chapitre II « Un pas sur le Fil », n’est pas encore disponible'))).toBe(true);
  expect(s.vars.get('mask.ch1.vaurelVu')).toBe(true);
  // The thread for Chapter II stays open in the journal.
  expect(s.quests.status('masque_fendu')).toBe('active');
}

describe('Mask — Chapitre I « Courir plus haut »', () => {
  it('can be played from the next morning to Vaurel’s list (précision, courage, entraide by collaboration)', async () => {
    const game = await start();
    const s = game.session;
    const events: string[] = [];
    s.bus.onAny((name) => {
      if (name.startsWith('mask.ch1.') && name !== 'mask.ch1.preuve') events.push(name);
    });
    await lendemain(game);
    await bureau(game);
    await precision(game);
    expect(notes(game)).toContain('Preuve validée : Précision (1/3)');
    await courage(game);
    expect(notes(game)).toContain('Preuve validée : Courage (2/3)');
    await entraide(game, 'collaboration');
    expect(notes(game)).toContain('Preuve validée : Entraide (3/3)');
    // The file now shows the three signatures.
    await inv(s).use(DOSSIER, 'lire');
    await flush();
    expect(game.ui.documents.at(-1)!.body.map(norm)).toEqual(
      expect.arrayContaining(['Précision : validée. Signé : Mireille, marchande de fruits.', 'Courage : validé. Signé : Rosalie, lavandière.', 'Entraide : validée. Signé : Octave, marchand de tissus.']),
    );
    await fete(game);
    await qualification(game);
    await finChapitre(game);
    expect(events).toEqual(['mask.ch1.second_mask_reacted', 'mask.ch1.proofs_complete', 'mask.ch1.qualifying_passed']);
  }, 420_000);

  it('the proofs can be taken in any order; sharing by turns makes Mireille the witness', async () => {
    const game = await start();
    const s = game.session;
    await lendemain(game);
    await bureau(game);
    await entraide(game, 'repartition');
    await inv(s).use(DOSSIER, 'lire');
    await flush();
    expect(game.ui.documents.at(-1)!.body.map(norm)).toContain('Entraide : validée. Signé : Mireille, marchande de fruits.');
    expect(notes(game)).toContain('Preuve validée : Entraide (1/3)');
    await courage(game);
    await precision(game, { linger: true });
    expect(notes(game)).toContain('Preuve validée : Précision (3/3)');
    await advance(s, 0.5);
    expect(stage(s)).toBe('fete');
    // The party starts once Mireille's lines are read.
    await waitFor(s, () => s.cinematics.current?.id === 'C12_fete', 10);
    expect(s.dialogue.isActive).toBe(false);
    await skipCinematics(s);
    await advance(s, 0.3);
    expect(await talkTo(s, 'marchand_tissus')).toEqual(['Octave: L’après-midi m’appartient. Le matin, je dors. Tout le monde y gagne.']);
  }, 420_000);

  it('slips are never a game over: the arch waits for Kaël, a hidden ladder cannot be climbed, time runs out, a crate shoves', async () => {
    const game = await start();
    const s = game.session;
    await lendemain(game);
    // Jump ahead to the qualification morning (the proofs are covered by the other tests).
    s.vars.set('mask.relaisJuno', true);
    s.vars.set('mask.dossierRecu', true);
    await advance(s, 0.2);
    for (const p of ['precision', 'courage', 'entraide']) s.vars.set(`mask.preuve.${p}`, true);
    s.vars.set('mask.preuves', 3);
    await advance(s, 0.3);
    await waitFor(s, () => s.cinematics.current?.id === 'C12_fete', 10);
    await skipCinematics(s);
    await advance(s, 0.3);
    expect(stage(s)).toBe('qualification');
    // Before Kaël's briefing the arch does nothing.
    s.player.teleport({ x: 64, y: G + 1, z: 87.2 }, 0);
    await advance(s, 0.2);
    await steer(s, 64, 91.9);
    expect(parcours(s).status).toBe('idle');
    await talkTo(s, 'kael');
    // The ladder of ledge B stays out of reach until the wheel turns.
    s.player.teleport({ x: 72.5, y: COURSE.B.top, z: 98.6 }, 0);
    await advance(s, 0.2);
    await steer(s, 72.5, 101, { frames: 180 });
    expect(s.player.position.y).toBeCloseTo(COURSE.B.top, 1);
    // A run that takes too long: back to the start, Kaël's advice, the clock reset.
    s.player.teleport({ x: 64, y: G + 1, z: 87.2 }, 0);
    await advance(s, 0.2);
    await steer(s, 64, 91.9);
    expect(parcours(s).status).toBe('running');
    const hud = () => s.civ!.ctx.ui.store.get<{ left: number }>('mask.parcours');
    expect(hud()!.left).toBe(100);
    await advance(s, 100.5);
    await waitFor(s, () => s.dialogue.view()?.dialogueId === 'c1_kael', 5);
    expect(parcours(s).fails).toBe(1);
    expect(hud()).toBeNull();
    await advanceDialogue(s);

    // On the footbridge, a sliding crate interrupts the key and shoves the hero down the slope.
    const game2 = await start();
    const s2 = game2.session;
    await lendemain(game2);
    s2.vars.set('mask.courageDemande', true);
    s2.vars.set('mask.pluie', true);
    await advance(s2, 0.3);
    expect(s2.equipment.select(0)).toBe(true);
    s2.player.teleport({ x: 22.9, y: deckTop(45), z: 45.6 });
    await advance(s2, 0.2);
    let hits = 0;
    s2.bus.on('mask.glissadeHit', () => hits++);
    // Start holding right when the crate of the lane appears at the top.
    await waitFor(s2, () => !visible(s2, 'cagette_glisse_1'), 10);
    await waitFor(s2, () => visible(s2, 'cagette_glisse_1'), 10);
    aim(s2, 'ancrage_1', 0.3);
    const z0 = s2.player.position.z;
    await hold(s2, 1.6);
    expect(hits).toBeGreaterThan(0);
    expect(modelOf(s2, 'ancrage_1')).toBe('mask:ancrage_lache');
    expect(s2.player.position.z).toBeLessThan(z0);
  }, 420_000);

  it('the rain, the course and the end of the chapter survive a save and a reload', async () => {
    const game = await start();
    const s = game.session;
    // Saved between the end of the Prologue and the next morning: the transition plays again.
    await skipCinematics(s);
    await flush();
    expect(await interact(s, 'cle_atelier')).toBe(true);
    s.quests.complete('prologue');
    await advance(s, 0.5);
    expect(s.cinematics.current).toBeNull();
    let game2 = await reload(s);
    let s2 = game2.session;
    expect(s2.cinematics.current?.id).toBe('C10_lendemain');
    await skipCinematics(s2);
    await advance(s2, 0.3);
    expect(stage(s2)).toBe('bureau');

    // Saved in the rain with one anchor fixed: it is still raining, the crates still slide.
    s2.vars.set('mask.relaisJuno', true);
    s2.vars.set('mask.dossierRecu', true);
    await advance(s2, 0.3);
    expect(stage(s2)).toBe('preuves');
    s2.vars.set('mask.courageDemande', true);
    s2.player.teleport({ x: 23.5, y: deckTop(45), z: 45.5 });
    await advance(s2, 0.4);
    expect(s2.vars.get('mask.pluie')).toBe(true);
    expect(s2.equipment.select(0)).toBe(true);
    await fixAnchor(s2, 'ancrage_1', [22.7, 45.6], 1);
    game2 = await reload(s2);
    s2 = game2.session;
    expect(s2.vars.get('mask.pluie')).toBe(true);
    expect(s2.entityApi('averse_lavoir')!.viewFlag('averse')).toBe(true);
    expect(modelOf(s2, 'ancrage_1')).toBe('mask:ancrage');
    expect(s2.vars.get('mask.ancrages')).toBe(1);
    await waitFor(s2, () => visible(s2, 'cagette_glisse_1') || visible(s2, 'cagette_glisse_2'), 10);

    // Saved once the three proofs are signed, before the party: the party plays at the reload.
    for (const p of ['precision', 'courage', 'entraide']) s2.vars.set(`mask.preuve.${p}`, true);
    s2.vars.set('mask.preuves', 3);
    await advance(s2, 0.5);
    expect(stage(s2)).toBe('fete');
    expect(s2.cinematics.current).toBeNull();
    game2 = await reload(s2);
    s2 = game2.session;
    expect(s2.cinematics.current?.id).toBe('C12_fete');
    await skipCinematics(s2);
    await advance(s2, 0.3);
    expect(stage(s2)).toBe('qualification');

    // Saved during a run: the clock and the wheel are where they were.
    await talkTo(s2, 'kael');
    s2.player.teleport({ x: 64, y: G + 1, z: 87.2 }, 0);
    await advance(s2, 0.2);
    await steer(s2, 64, 91.9);
    expect(parcours(s2).status).toBe('running');
    await advance(s2, 10);
    const elapsed = parcours(s2).elapsed;
    game2 = await reload(s2);
    s2 = game2.session;
    expect(parcours(s2).status).toBe('running');
    expect(parcours(s2).elapsed).toBeGreaterThanOrEqual(elapsed);
    expect(s2.civ!.ctx.ui.store.get<{ left: number }>('mask.parcours')!.left).toBeLessThanOrEqual(90);
  }, 420_000);
});
