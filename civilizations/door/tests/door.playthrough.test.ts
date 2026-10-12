/**
 * Door Civilization — headless playthroughs.
 *
 * These tests play the story the way a player would: walking (A* with the player's size, so a
 * level with no path fails), interacting through the same pipeline as the game (locks veto),
 * answering dialogues, skipping cinematics, saving and reloading. They prove that the ending is
 * reachable without dead ends, on each branch.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { advance, advanceDialogue, choose, createHeadlessGame, flush, skipCinematics, talk, walkTo, type HeadlessGame } from '@engine/core/testing/headless';
import { parseSave } from '@engine/core/save/saveFormat';
import type { GameSession } from '@engine/core/sim/session';

const Q = { q0: 'DOOR_Q00_REVEIL', q1: 'DOOR_Q01_EMPREINTE', q2: 'DOOR_Q02_ELIAS', q3: 'DOOR_Q03_ARCHIVES', q4: 'DOOR_Q04_PORTE_ABSENTE' };

async function start(): Promise<HeadlessGame> {
  const game = await createHeadlessGame(new GlobContentProvider());
  await game.session.loadCivilization('door', { fresh: true });
  await advance(game.session, 0.3);
  return game;
}

async function interact(session: GameSession, entityId: string, offerId?: string): Promise<boolean> {
  await walkTo(session, entityId);
  const ok = await session.interaction.interactWith(entityId, 'primary', offerId);
  await flush();
  return ok;
}

async function openDoor(session: GameSession, doorId: string): Promise<void> {
  const ok = await interact(session, doorId, 'open');
  if (!ok && !session.entityApi(doorId)?.behavior<{ isOpen: boolean }>('core.door')?.isOpen) throw new Error(`Porte refusée : ${doorId}`);
  await advance(session, 0.3);
}

async function goTo(session: GameSession, entityId: string, reach = 0.6): Promise<void> {
  await walkTo(session, entityId, { reach });
  await advance(session, 0.4);
}

const rank = (s: GameSession) => Number(s.vars.get('door.rank'));
const inv = (s: GameSession) => s.civ!.ctx.inventory;

/** Prologue + Act I up to the Porteur plaque and the gallery. */
async function prologueAndActOne(session: GameSession): Promise<void> {
  expect(session.cinematics.current?.id).toBe('C01_eveil');
  await skipCinematics(session);
  await flush();
  expect(session.quests.status(Q.q0)).toBe('active');

  // The handleless door answers the palm.
  await openDoor(session, 'cell_door');
  expect(session.vars.get('door.palmRevealed')).toBe(true);
  await goTo(session, 'trig_cell_exit', 0.3);
  expect(session.quests.isObjectiveDone(Q.q0, 'sortir')).toBe(true);

  // Without a plaque, rank locks do not answer.
  expect(rank(session)).toBe(-1);
  await talk(session, 'noe', ['from', 'thanks']);
  expect(rank(session)).toBe(0);
  expect(inv(session).has('door:plaque_r0')).toBe(true);
  expect(session.quests.status(Q.q0)).toBe('completed');
  expect(session.quests.status(Q.q1)).toBe('active');

  // The gallery gate refuses rank 0, with a contextual refusal.
  await walkTo(session, 'porte_galerie');
  expect(await session.interaction.interactWith('porte_galerie', 'primary', 'open')).toBe(false);
  await goTo(session, 'trig_porte_galerie', 0.5);
  expect(session.quests.isObjectiveDone(Q.q1, 'porte')).toBe(true);

  // Mira's workshop (rank 0 door) and her offer.
  await openDoor(session, 'porte_atelier');
  await talk(session, 'mira', ['what', 'rank', 'ok']);
  expect(session.vars.get('door.metMira')).toBe(true);
  expect(session.quests.stage(Q.q1)).toBe('pieces');

  // Three parts: Brun's old locksmith shop, the well, Noé's crate.
  await openDoor(session, 'porte_serrurerie');
  expect(await interact(session, 'ressort_cuivre')).toBe(true);
  expect(await interact(session, 'puits')).toBe(true);
  await advance(session, 1.5);
  expect(inv(session).has('door:goupille')).toBe(true);
  expect(await interact(session, 'caisse_noe')).toBe(true); // nailed: only the description
  expect(inv(session).has('door:disque')).toBe(false);
  await talk(session, 'noe', ['yes']);
  expect(await interact(session, 'caisse_noe', 'take')).toBe(true);
  expect(inv(session).has('door:disque')).toBe(true);
  await advance(session, 0.3);
  expect(session.quests.stage(Q.q1)).toBe('empreinte');

  // The mother is refused at the house of care; Varen opens it himself.
  await goTo(session, 'trig_scene_mere', 0.5);
  expect(session.cinematics.current?.id).toBe('C_mere');
  await skipCinematics(session);
  await flush();
  expect(session.vars.get('door.motherSceneDone')).toBe(true);

  // The engraving of the gate gives the dial pattern (examine with F).
  await walkTo(session, 'porte_galerie');
  expect(await session.interaction.interactWith('porte_galerie', 'secondary')).toBe(true);
  expect(session.vars.get('door.gateEngravingSeen')).toBe(true);

  // Three dials at Mira's workbench.
  await openDoor(session, 'porte_atelier').catch(() => undefined);
  expect(await interact(session, 'etabli_empreinte')).toBe(true);
  expect(session.ui instanceof Object).toBe(true);
  const imprint = session.civ!.mechanics.get('door.keyImprint')!.api as { check(d: number[]): boolean[]; submit(d: number[]): boolean; hint(): string[] | null };
  expect(imprint.hint()).toEqual(['tour', 'lune', 'main']);
  expect(imprint.check([2, 1, 4])).toEqual([true, false, true]);
  expect(imprint.submit([0, 0, 0])).toBe(false);
  expect(imprint.submit([2, 0, 4])).toBe(true);
  session.closePanel('door.imprint', { success: true });
  await advance(session, 1.6);
  expect(rank(session)).toBe(1);
  expect(inv(session).has('door:plaque_r1')).toBe(true);
  expect(inv(session).has('door:ressort')).toBe(false);
  expect(session.cinematics.current?.id).toBe('C02_rang1');
  await skipCinematics(session);
  await flush();
  expect(session.quests.stage(Q.q1)).toBe('franchir');

  // Rank 1 concretely opens the gate that refused before.
  await openDoor(session, 'porte_galerie');
  await goTo(session, 'trig_arrivee_galerie', 0.5);
  expect(session.quests.status(Q.q1)).toBe('completed');
  expect(session.quests.status(Q.q2)).toBe('active');
}

/** Act II: the trail of Elias, two pieces of evidence, the temporary rank 2. */
async function actTwo(session: GameSession, path: 'testimony' | 'report' | 'sneak'): Promise<void> {
  expect(await interact(session, 'affiche_elias_galerie')).toBe(true);
  expect(session.vars.get('door.foundEliasPoster')).toBe(true);
  expect(await interact(session, 'registre_transferts')).toBe(true);
  await advance(session, 0.2);
  expect(session.vars.get('door.foundTransferTrace')).toBe(true);
  expect(session.quests.stage(Q.q2)).toBe('preuves');

  if (path === 'testimony' || path === 'report') {
    // Back down to Mira, then up to Varen's office.
    await openDoor(session, 'porte_atelier').catch(() => undefined);
    await talk(session, 'mira', [path === 'testimony' ? 'testify' : 'forge']);
    await openDoor(session, 'porte_bureau_varen');
    await talk(session, 'varen', [path === 'testimony' ? 'testimony' : 'report']);
    expect(session.vars.get('door.registryPass')).toBe(true);
    expect(Number(session.vars.get('door.varenTrust') ?? 0)).toBe(path === 'testimony' ? 1 : -1);
  }
  // The transfer order in the archive room (watched by the patrol unless allowed).
  expect(await interact(session, 'armoire_dossiers', 'take')).toBe(true);
  expect(inv(session).has('door:ordre_transfert')).toBe(true);
  expect(session.vars.get('door.evidenceCount')).toBe(1);

  // Elias's plaque in the seized goods of the pawnshop.
  await openDoor(session, 'porte_clou_dore');
  await talk(session, 'odran', ['seized']);
  expect(await interact(session, 'coffre_saisies', 'take')).toBe(true);
  await advance(session, 0.3);
  expect(session.vars.get('door.evidenceCount')).toBe(2);
  expect(session.quests.status(Q.q2)).toBe('completed');
  expect(session.quests.status(Q.q3)).toBe('active');

  await talk(session, 'eda', ['where']);
  expect(rank(session)).toBe(2);
  expect(session.vars.get('door.rankTemporary')).toBe(true);
}

/** Act III: the register, the erased corridor, Varen, the absent door, the epilogue. */
async function actThree(game: HeadlessGame, answer: 'listen' | 'open'): Promise<void> {
  const { session } = game;
  await openDoor(session, 'porte_archives');
  expect(await interact(session, 'registre_secret')).toBe(true);
  expect(session.cinematics.current?.id).toBe('C03_registre');
  await skipCinematics(session);
  await advance(session, 0.5);
  expect(session.quests.status(Q.q3)).toBe('completed');
  expect(session.quests.status(Q.q4)).toBe('active');
  expect(session.world!.volume.get(59, 31, 104)).toBe('core:air');

  // Down the stair under the gear room: the portal changes scene.
  await goTo(session, 'passage_efface', 0.3);
  await advance(session, 1);
  expect(session.world!.id).toBe('porte_absente');
  expect(session.quests.stage(Q.q4)).toBe('couloir');

  await goTo(session, 'trig_entree_couloir', 0.5);
  await advance(session, 7);
  for (let i = 1; i <= 6; i++) expect(session.entityApi(`couloir_porte_${i}`)!.behavior<{ isOpen: boolean }>('core.door')!.isOpen).toBe(false);

  await goTo(session, 'trig_fond_couloir', 0.5);
  for (let i = 0; i < 40 && !session.dialogue.isActive; i++) await advance(session, 0.5);
  expect(session.dialogue.isActive).toBe(true);
  await choose(session, 'why');
  await choose(session, answer);
  await advanceDialogue(session);
  await advance(session, 0.5);
  expect(session.vars.get('door.finalChoice')).toBe(answer === 'listen' ? 'ecouter' : 'ouvrir');
  expect(session.cinematics.current?.id).toBe('C04b_porte');
  await skipCinematics(session);
  await advance(session, 0.5);
  expect(session.vars.get('door.absentDoorShown')).toBe(true);
  expect(session.entityApi('porte_absente')!.behavior<{ isOpen: boolean }>('core.door')!.isOpen).toBe(true);

  expect(await interact(session, 'fragment_seuil', 'take')).toBe(true);
  await advance(session, 1.5);
  expect(session.multiverse.hasFragment('threshold')).toBe(true);
  expect(session.cinematics.current?.id).toBe('C04c_coupe');
  let finished = false;
  session.bus.on('civ.finished', () => (finished = true));
  session.cinematics.skip(); // only C04c: the epilogue starts right after the scene change
  await advance(session, 1.5);
  expect(session.world!.id).toBe('verrou');
  expect(session.cinematics.current?.id).toBe(answer === 'listen' ? 'C05_epilogue_ecoute' : 'C05_epilogue_ouvre');
  await skipCinematics(session);
  await advance(session, 0.5);
  expect(game.ui.endScreens.map((e) => e.title)).toContain("FIN DU PROLOGUE — LA PORTE QUI N'EXISTE PAS");
  expect(game.ui.endScreens[0]!.subtitle).toBe("D'autres seuils attendent.");
  expect(finished).toBe(true);
  expect(session.multiverse.progress('door').completed).toBe(true);
  expect(session.multiverse.getFlag('door.finalChoice')).toBe(answer === 'listen' ? 'ecouter' : 'ouvrir');
  // The social system is not magically abolished: the temporary seal is gone.
  expect(rank(session)).toBe(1);
}

describe('Door Civilization — parcours complet', () => {
  it('main path: testimony of Mira, then listening to Varen', async () => {
    const game = await start();
    await prologueAndActOne(game.session);
    await actTwo(game.session, 'testimony');
    await actThree(game, 'listen');
    expect(game.session.logHub.errors()).toEqual([]);
  }, 120_000);

  it('alternate path: forged report, opening at once', async () => {
    const game = await start();
    await prologueAndActOne(game.session);
    await actTwo(game.session, 'report');
    await actThree(game, 'open');
    expect(Number(game.session.vars.get('door.varenTrust'))).toBe(-2);
  }, 120_000);

  it('the patrol escorts an intruder out, three times, then Varen summons the player', async () => {
    const game = await start();
    const s = game.session;
    await prologueAndActOne(s);
    expect(await interact(s, 'registre_transferts')).toBe(true);
    for (let i = 1; i <= 3; i++) {
      // Stand in the restricted area, right in front of the guard, wherever his round led him.
      const guard = s.entityApi('garde_ronde')!;
      for (let k = 0; k < 40 && Number(s.vars.get('door.suspicion') ?? 0) < i; k++) {
        const yaw = (guard.yaw * Math.PI) / 180;
        s.player.teleport({ x: guard.position.x + Math.sin(yaw) * 1.8, y: guard.position.y, z: Math.max(70.6, guard.position.z + Math.cos(yaw) * 1.8) });
        await advance(s, 0.25);
      }
      await advance(s, 4.5);
      expect(Number(s.vars.get('door.suspicion'))).toBe(i);
      expect(s.player.position.z).toBeLessThan(69);
    }
    expect(s.vars.get('door.varenSummons')).toBe(true);
    await openDoor(s, 'porte_bureau_varen');
    await talk(s, 'varen', ['summons']);
    expect(s.vars.get('door.registryPass')).toBe(true);
  }, 120_000);

  it('the evidence persists through a save and a reload', async () => {
    const game = await start();
    const s = game.session;
    await prologueAndActOne(s);
    await actTwo(s, 'testimony');
    const raw = JSON.parse(JSON.stringify(s.buildSaveGame('slot1', 'test')));
    const { save } = parseSave(raw);

    const game2 = await createHeadlessGame(new GlobContentProvider());
    await game2.session.applySaveGame(save);
    await game2.session.loadCivilization('door');
    await advance(game2.session, 0.3);
    const s2 = game2.session;
    expect(s2.vars.get('door.evidenceCount')).toBe(2);
    expect(inv(s2).has('door:ordre_transfert')).toBe(true);
    expect(inv(s2).has('door:plaque_elias')).toBe(true);
    expect(Number(s2.vars.get('door.rank'))).toBe(2);
    expect(s2.quests.status(Q.q3)).toBe('active');
    // Doors remember: the cell door was touched and opened.
    expect(s2.entityApi('cell_door')!.behavior<{ isOpen: boolean }>('core.door')!.isOpen).toBe(true);
    expect(s2.cinematics.current).toBeNull();
    await actThree(game2, 'listen');
  }, 120_000);
});
