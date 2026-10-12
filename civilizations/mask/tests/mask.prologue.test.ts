/**
 * Mask Civilization — headless playthrough of the Prologue « La place qu'on nous donne ».
 *
 * Played the way a player would: walking (A* with the player's size), interacting through the
 * same pipeline as the game, holding and using the items in hand with the mouse buttons, jumping
 * from scaffold to scaffold with the real player physics, answering dialogues, skipping
 * cinematics, saving and reloading.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { advance, advanceDialogue, choose, createHeadlessGame, face, flush, skipCinematics, walkTo, type HeadlessGame } from '@engine/core/testing/headless';
import { findPath } from '@engine/core/nav/pathfinder';
import { parseSave } from '@engine/core/save/saveFormat';
import type { GameSession } from '@engine/core/sim/session';
import type { HealthApi } from '@engine/core/combat/combat';
import type { LiftApi } from '../mechanics/lift';
import { ATELIER, ECHAFAUDAGES, G, P, STATION } from '../seed/layout';

const CLE = 'mask:cle_atelier';
const MARTEAU = 'mask:marteau_cendre';
const MASQUE = 'mask:masque_cendre';

async function start(): Promise<HeadlessGame> {
  const game = await createHeadlessGame(new GlobContentProvider());
  await game.session.loadCivilization('mask', { fresh: true });
  await advance(game.session, 0.3);
  return game;
}

/** French typography uses no-break spaces (before « : ? ! » etc.): compare texts without them. */
const norm = (t: string | undefined | null) => (t ?? '').replace(/[\u00a0\u202f]/g, ' ');
const inv = (s: GameSession) => s.civ!.ctx.inventory;
const stage = (s: GameSession) => s.quests.stage('prologue');
const lift = (s: GameSession) => s.entityApi('wagon')!.behavior<LiftApi>('mask.monteCharge')!;
const health = (s: GameSession, id: string) => s.entityApi(id)!.behavior<HealthApi>('core.health')!;
const modelOf = (s: GameSession, id: string) => s.world!.entities.get(id)!.components.get('core.model')!.props.model;

async function interact(s: GameSession, entityId: string, offerId?: string): Promise<boolean> {
  await walkTo(s, entityId);
  const ok = await s.interaction.interactWith(entityId, 'primary', offerId);
  await flush();
  return ok;
}

async function waitFor(s: GameSession, test: () => boolean, seconds = 20): Promise<void> {
  for (let t = 0; t < seconds && !test(); t += 0.25) await advance(s, 0.25);
  expect(test()).toBe(true);
}

/** Aims at the middle of an entity's height (its model or tool box), from where the player is. */
function aim(s: GameSession, id: string, dy = 0.7): void {
  const p = s.world!.entities.get(id)!.position;
  face(s, { x: p.x, y: p.y + dy - 1, z: p.z });
}

/** A short click of a mouse button with the item in hand. */
async function click(s: GameSession, button: 'primary' | 'secondary' = 'primary'): Promise<void> {
  s.equipment.press(button);
  await advance(s, 1 / 30);
  s.equipment.release(button);
  await advance(s, 0.5);
}

/** Holds a mouse button for `seconds`, then releases it. */
async function hold(s: GameSession, seconds: number, button: 'primary' | 'secondary' = 'primary'): Promise<void> {
  s.equipment.press(button);
  await advance(s, seconds);
  s.equipment.release(button);
  await advance(s, 0.3);
}

/**
 * Runs (or walks) and jumps north (+z) with the player's own physics: toward the edge of the
 * current platform (or against the step in front), jump, and land on the next one. Returns the
 * landing height.
 */
async function leapNorth(s: GameSession, x: number, edgeZ: number, landZ: number, sprint = true): Promise<number> {
  const p = s.player;
  p.setLook(0, 0);
  p.intent.forward = 1;
  p.intent.sprint = sprint;
  let jumped = false;
  let landed = false;
  let lastZ = p.position.z;
  let stalled = 0;
  for (let i = 0; i < 180 && !landed; i++) {
    stalled = Math.abs(p.position.z - lastZ) < 0.002 ? stalled + 1 : 0;
    lastZ = p.position.z;
    if (!jumped && p.body.grounded && (p.position.z >= edgeZ - 0.3 || stalled > 3)) {
      p.intent.jump = true;
      jumped = true;
    }
    s.update(1 / 60);
    p.intent.jump = false;
    // Keep on the platforms' axis.
    if (Math.abs(p.position.x - x) > 0.05) p.body.teleport({ x, y: p.position.y, z: p.position.z });
    if (jumped && p.body.grounded && p.position.z >= landZ) landed = true;
    await flush(1);
  }
  p.intent.forward = 0;
  p.intent.sprint = false;
  await advance(s, 0.3);
  expect(jumped).toBe(true);
  expect(landed).toBe(true);
  return p.position.y;
}

/** P00 — the room: the opening cinematic, the mask, the key, the poster and the map. */
async function chambre(game: HeadlessGame): Promise<void> {
  const s = game.session;
  expect(s.cinematics.current?.id).toBe('C00_matin');
  await advance(s, 1.2);
  // The hero presents his city himself, in French, under his own name in the subtitles.
  expect(s.cinematics.subtitleView()?.speaker).toBe('Toi');
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('Ici, c’est Viremasque. Chaque quartier a son rang, chaque rang a son masque.');
  await skipCinematics(s);
  await flush();
  // He has put on his Cendre mask: worn, the rank plaque appears (Fil and Fer known but locked).
  expect(s.equipment.wornIn('masque')).toBe(MASQUE);
  expect(modelOf(s, 'support_masque')).toBe('mask:support_masque_vide');
  expect(s.vars.get('mask.plaqueVisible')).toBe(true);
  expect(s.vars.get('mask.rank')).toBe(0);
  expect(s.vars.get('mask.rangsConnus')).toEqual(['cendre', 'fil', 'fer']);
  expect(s.quests.status('prologue')).toBe('active');
  expect(stage(s)).toBe('chambre');
  expect(s.player.position.y).toBeCloseTo(ATELIER.roomY, 1);

  // The key: picked up from the table, it goes straight into the hand.
  expect(await interact(s, 'cle_atelier')).toBe(true);
  expect(inv(s).has(CLE)).toBe(true);
  expect(s.equipment.held).toBe(CLE);
  expect(s.quests.isObjectiveDone('prologue', 'cle')).toBe(true);

  // The poster and the map (optional).
  expect(await interact(s, 'affiche')).toBe(true);
  expect(await interact(s, 'carte')).toBe(true);
  await advance(s, 0.2);
  expect(game.ui.documents.map((d) => norm(d.title))).toEqual(['Épreuves de l’Ascension', 'Viremasque, par moi']);
  expect(s.quests.isObjectiveDone('prologue', 'affiche')).toBe(true);
  expect(s.quests.isObjectiveDone('prologue', 'carte')).toBe(true);
}

/** P01 — the workshop: Lys, the spare wheel, the axle (key), the wheel (hammer), Juno. */
async function atelier(game: HeadlessGame): Promise<void> {
  const s = game.session;
  // Down the stairs and out: Lys calls out as soon as the hero steps onto the quay.
  await walkTo(s, 'declencheur_lys', { reach: 0.6 });
  await advance(s, 0.3);
  expect(s.dialogue.view()?.dialogueId).toBe('p01_lys');
  expect(norm(s.dialogue.view()?.text)).toBe('T’as encore passé la nuit à regarder l’affiche du concours ?');
  await advanceDialogue(s);
  await choose(s, 'supervise');
  await advanceDialogue(s);
  expect(s.dialogue.isActive).toBe(false);
  expect(s.dialogue.seen('p01_lys', 'intro7')).toBe(true);
  expect(stage(s)).toBe('roue');

  // The key does nothing on the cart without the spare part.
  await walkTo(s, 'chariot');
  aim(s, 'chariot');
  await hold(s, 2);
  expect(s.vars.get('mask.essieuAligne')).not.toBe(true);

  expect(await interact(s, 'roue_rechange')).toBe(true);
  expect(inv(s).has('mask:roue_rechange')).toBe(true);

  // Straightening the axle: hold the click with the key aimed at the cart.
  await walkTo(s, 'chariot');
  aim(s, 'chariot');
  expect(s.equipment.held).toBe(CLE);
  await hold(s, 2);
  expect(s.vars.get('mask.essieuAligne')).toBe(true);
  expect(inv(s).has('mask:roue_rechange')).toBe(false);
  expect(modelOf(s, 'chariot')).toBe('mask:chariot');
  expect(stage(s)).toBe('marteau');

  // Nora brings the hammer, which lands in the second slot of the bar.
  await waitFor(s, () => s.dialogue.view()?.dialogueId === 'p01_nora', 20);
  await advanceDialogue(s);
  expect(inv(s).has(MARTEAU)).toBe(true);
  expect(s.equipment.hotbar[1]).toBe(MARTEAU);
  expect(s.equipment.held).toBe(CLE);
  expect(s.equipment.select(1)).toBe(true);
  await advance(s, 0.5);
  expect(s.equipment.held).toBe(MARTEAU);
  expect(s.quests.isObjectiveDone('prologue', 'main')).toBe(true);

  // Three dry blows on the hub.
  await walkTo(s, 'chariot', { reach: 1.6 });
  aim(s, 'chariot');
  const cart = health(s, 'chariot');
  for (let i = 0; i < 3; i++) await click(s);
  expect(cart.defeated).toBe(true);
  expect(s.vars.get('mask.roueFixee')).toBe(true);
  expect(stage(s)).toBe('juno');

  // Juno arrives at full speed (C01), then asks for a mechanic.
  await waitFor(s, () => s.cinematics.current?.id === 'C01_juno', 5);
  await skipCinematics(s);
  await advance(s, 0.3);
  expect(s.dialogue.view()?.dialogueId).toBe('p01_juno');
  expect(norm(s.dialogue.view()?.text)).toBe('J’ai besoin d’un mécanicien. Pas d’un formulaire. La machine chauffe !');
  await advanceDialogue(s);
  expect(s.dialogue.seen('p01_juno', 'j7')).toBe(true);
  expect(s.dialogue.isActive).toBe(false);
  // She runs to the freight lift, over the east bridge.
  await waitFor(s, () => s.vars.get('mask.junoAuMonteCharge') === true, 60);
  const juno = s.world!.entities.get('juno')!.position;
  expect(Math.hypot(juno.x - P.junoRampe[0], juno.z - P.junoRampe[2])).toBeLessThan(2.5);
}

/** P02 — the runaway freight lift: the scaffolds, the lever, the Braise, Juno's offer. */
async function monteCharge(game: HeadlessGame, opts: { letItGetHeld?: boolean } = {}): Promise<void> {
  const s = game.session;
  await walkTo(s, 'repere_rampe', { reach: 1 });
  await advance(s, 0.3);
  expect(s.cinematics.current?.id).toBe('C02_monte_charge');
  await skipCinematics(s);
  await advance(s, 0.5);
  expect(lift(s).status).toBe('running');
  expect(stage(s)).toBe('monte_charge');
  const hud = s.civ!.ctx.ui.store.get<{ status: string; seconds: number }>('mask.lift');
  expect(hud?.status).toBe('running');
  expect(hud!.seconds).toBeGreaterThan(30);

  if (opts.letItGetHeld) {
    // Too slow: Juno anchors the wagon with her line and hauls it back up. Nobody is hurt.
    await waitFor(s, () => lift(s).status === 'held', 90);
    const heldAt = lift(s).progress;
    expect(game.ui.notifications.some((n) => norm(n.text).startsWith('Juno : « Je le tiens !'))).toBe(true);
    expect(s.civ!.ctx.ui.store.get<{ status: string }>('mask.lift')?.status).toBe('held');
    await advance(s, 2);
    expect(lift(s).progress).toBeLessThan(heldAt - 0.1);
    await waitFor(s, () => lift(s).status === 'running', 10);
  }

  // Up the scaffolds with real jumps (each one a step up and a gap), to the brake station.
  const x = 112.5;
  s.player.teleport({ x, y: G, z: ECHAFAUDAGES[0]!.z0 - 1.6 });
  await advance(s, 0.2);
  let y = await leapNorth(s, x, ECHAFAUDAGES[0]!.z0, ECHAFAUDAGES[0]!.z0 + 0.3, false);
  expect(y).toBeCloseTo(ECHAFAUDAGES[0]!.top + 1, 1);
  for (let i = 1; i < ECHAFAUDAGES.length; i++) {
    y = await leapNorth(s, x, ECHAFAUDAGES[i - 1]!.z1 + 1, ECHAFAUDAGES[i]!.z0 + 0.3);
    expect(y).toBeCloseTo(ECHAFAUDAGES[i]!.top + 1, 1);
  }
  y = await leapNorth(s, x, ECHAFAUDAGES[ECHAFAUDAGES.length - 1]!.z1 + 1, STATION.z0 + 0.3);
  expect(y).toBeCloseTo(STATION.top + 1, 1);
  await advance(s, 0.3);
  expect(s.quests.isObjectiveDone('prologue', 'station')).toBe(true);

  // The emergency lever: the brake is jammed.
  expect(health(s, 'frein').defeated).toBe(false);
  expect(await interact(s, 'levier')).toBe(true);
  await advance(s, 0.3);
  expect(modelOf(s, 'levier')).toBe('mask:levier_tire');
  expect(stage(s)).toBe('frein');
  // Juno's count runs as subtitles while the player keeps control.
  expect(s.cinematics.current?.id).toBe('C02b_frein');
  expect(s.player.movementLocked).toBe(false);
  await advance(s, 5.8);
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('À trois, tu tapes ! UN ! DEUX !');

  // A plain blow bounces off; the charged Braise frees it.
  await walkTo(s, 'frein', { reach: 1.5 });
  aim(s, 'frein', 0.6);
  expect(s.equipment.held).toBe(MARTEAU);
  await click(s);
  expect(health(s, 'frein').defeated).toBe(false);
  await advance(s, 0.4);
  await hold(s, 1.1);
  expect(health(s, 'frein').defeated).toBe(true);
  expect(modelOf(s, 'frein')).toBe('mask:frein_libre');

  // The wagon stops before the stalls; the district cheers (C03).
  await advance(s, 0.2);
  expect(s.cinematics.current?.id).toBe('C03_arret');
  expect(lift(s).status).toBe('stopped');
  expect(lift(s).progress).toBeLessThan(0.86);
  await advance(s, 0.4);
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('T’AS OUBLIÉ TROIS !');
  await advance(s, 2.2);
  expect(norm(s.cinematics.subtitleView()?.text)).toBe('JE L’AI PENSÉ TRÈS FORT !');
  await skipCinematics(s);
  await advance(s, 0.3);
  expect(s.civ!.ctx.ui.store.get('mask.lift')).toBeNull();

  // Juno owes a favour: a candidates' relay, not a sponsorship.
  expect(s.dialogue.view()?.dialogueId).toBe('p02_juno_fin');
  expect(norm(s.dialogue.view()?.text)).toBe('Bon. Tu sais courir et réparer sous pression. Les Épreuves commencent demain. Je te dois un service.');
  await advanceDialogue(s);
  await choose(s, 'merci');
  await advanceDialogue(s);
  expect(s.dialogue.seen('p02_juno_fin', 'f6')).toBe(true);
  await advance(s, 0.3);
  expect(s.quests.status('prologue')).toBe('completed');
}

describe('Mask — Prologue « La place qu’on nous donne »', () => {
  it('can be played from the room to Juno’s offer', async () => {
    const game = await start();
    await chambre(game);
    await atelier(game);
    await monteCharge(game);
    const s = game.session;
    expect(s.vars.get('mask.junoRelais')).toBe(true);
    // Talking to Juno again gives the appointment, not the arrival scene.
    await walkTo(s, 'juno');
    await s.interaction.interactWith('juno', 'primary');
    await flush();
    expect(s.dialogue.view()?.dialogueId).toBe('p01_juno');
    expect(norm(s.dialogue.view()?.text)).toContain('Demain matin, au bureau des inscriptions.');
  }, 240_000);

  it('if the player is too slow, Juno holds the wagon back and the player tries again', async () => {
    const game = await start();
    await chambre(game);
    await atelier(game);
    await monteCharge(game, { letItGetHeld: true });
  }, 240_000);

  it('the stairs are walkable without jumping, and the key is never forgotten for good', async () => {
    const game = await start();
    const s = game.session;
    await skipCinematics(s);
    await flush();
    // From the room down to the quay without a single jump (half steps of 0.5 m).
    const path = findPath(s.world!.collision, s.player.position, { x: P.sortieAtelier[0], y: G, z: P.sortieAtelier[2] }, { jumpHeight: 0, maxNodes: 60000 });
    expect(path).not.toBeNull();
    // Leaving without the key: Lys sends the hero back up.
    await walkTo(s, 'declencheur_sans_cle', { reach: 0.6 });
    await advance(s, 0.3);
    expect(s.dialogue.isActive).toBe(false);
    expect(game.ui.notifications.some((n) => norm(n.text) === 'Ta clé d’atelier est restée sur la table de ta chambre.')).toBe(true);
    // Talking to her gives the same reminder; the cart cannot be fixed before the briefing.
    await walkTo(s, 'lys');
    await s.interaction.interactWith('lys', 'primary');
    await flush();
    expect(s.dialogue.view()?.dialogueId).toBe('p01_lys');
    expect(norm(s.dialogue.view()?.text)).toContain('Ta clé !');
    await advanceDialogue(s);
    expect(stage(s)).toBe('chambre');
    expect(await interact(s, 'cle_atelier')).toBe(true);
    await walkTo(s, 'declencheur_lys', { reach: 0.6 });
    await advance(s, 0.3);
    expect(s.dialogue.view()?.dialogueId).toBe('p01_lys');
  }, 120_000);

  it('without the Cendre mask there is no Braise, and the plaque stays', async () => {
    const game = await start();
    const s = game.session;
    await chambre(game);
    s.equipment.unequip('masque');
    await advance(s, 0.2);
    expect(game.ui.notifications.some((n) => norm(n.text).startsWith('Sans masque, pas de Braise.'))).toBe(true);
    expect(s.vars.get('mask.plaqueVisible')).toBe(true);
    expect(s.equipment.equip(MASQUE)).toBe(true);
    expect(s.equipment.wornIn('masque')).toBe(MASQUE);
  }, 60_000);

  it('Nora’s scrap errand: four pieces on the quay for two pepper galettes', async () => {
    const game = await start();
    const s = game.session;
    await skipCinematics(s);
    await flush();
    for (const id of ['ferraille_1', 'ferraille_2', 'ferraille_3', 'ferraille_4']) expect(await interact(s, id)).toBe(true);
    expect(inv(s).count('mask:ferraille')).toBe(4);
    await walkTo(s, 'nora');
    await s.interaction.interactWith('nora', 'primary');
    await flush();
    expect(s.dialogue.view()?.dialogueId).toBe('p01_nora');
    await advanceDialogue(s);
    expect(s.dialogue.isActive).toBe(false);
    // Asked after the prologue's first step: she offers the errand from her workshop.
    s.quests.start('ferraille');
    await advance(s, 0.2);
    expect(s.quests.stage('ferraille')).toBe('rapporter');
    await s.interaction.interactWith('nora', 'primary');
    await flush();
    await advanceDialogue(s);
    expect(inv(s).count('mask:ferraille')).toBe(0);
    expect(inv(s).count('mask:galette')).toBe(2);
    await advance(s, 0.2);
    expect(s.quests.status('ferraille')).toBe('completed');
  }, 120_000);

  it('the run of the wagon, the lever and the jammed brake survive a save and a reload', async () => {
    const game = await start();
    await chambre(game);
    await atelier(game);
    const s = game.session;
    await walkTo(s, 'repere_rampe', { reach: 1 });
    await advance(s, 0.3);
    await skipCinematics(s);
    await advance(s, 5);
    const progress = lift(s).progress;
    expect(progress).toBeGreaterThan(0);
    const raw = JSON.parse(JSON.stringify(s.buildSaveGame('slot1', 'test')));
    const { save } = parseSave(raw);

    const game2 = await createHeadlessGame(new GlobContentProvider());
    await game2.session.applySaveGame(save);
    await game2.session.loadCivilization('mask');
    await advance(game2.session, 0.2);
    const s2 = game2.session;
    expect(s2.cinematics.current).toBeNull();
    expect(stage(s2)).toBe('monte_charge');
    expect(lift(s2).status).toBe('running');
    expect(lift(s2).progress).toBeGreaterThanOrEqual(progress);
    expect(s2.equipment.wornIn('masque')).toBe(MASQUE);
    expect(s2.equipment.hotbar.slice(0, 2)).toEqual([CLE, MARTEAU]);
    expect(modelOf(s2, 'chariot')).toBe('mask:chariot');
    expect(health(s2, 'chariot').defeated).toBe(true);
    // Juno resumes her leaps toward the station.
    await waitFor(s2, () => {
      const j = s2.world!.entities.get('juno')!.position;
      return Math.hypot(j.x - P.junoStation[0], j.z - P.junoStation[2]) < 0.6;
    }, 20);
    await monteChargeFromScaffolds(game2);
  }, 240_000);
});

/** The end of P02 for a game reloaded during the wagon's run. */
async function monteChargeFromScaffolds(game: HeadlessGame): Promise<void> {
  const s = game.session;
  s.player.teleport({ x: P.station[0], y: STATION.top + 1, z: P.station[2] });
  await advance(s, 0.3);
  expect(await interact(s, 'levier')).toBe(true);
  await advance(s, 0.3);
  expect(stage(s)).toBe('frein');
  await walkTo(s, 'frein', { reach: 1.5 });
  aim(s, 'frein', 0.6);
  await hold(s, 1.1);
  expect(health(s, 'frein').defeated).toBe(true);
  await advance(s, 0.3);
  await skipCinematics(s);
  await advance(s, 0.3);
  expect(s.dialogue.view()?.dialogueId).toBe('p02_juno_fin');
  await advanceDialogue(s);
  await choose(s, 'regret');
  await advanceDialogue(s);
  await advance(s, 0.3);
  expect(s.quests.status('prologue')).toBe('completed');
}
