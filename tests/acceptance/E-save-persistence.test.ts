/**
 * Acceptance test E — Save persistence.
 *
 * "Save a game, reload it, and confirm meaningful progress remains."
 *
 * The save goes through the same path as the game's « Sauvegarder » (GameController.save):
 * GameSession.buildSaveGame → SaveStorage.save; loading is GameController.loadSlot's path:
 * SaveStorage.load → parseSave (validation + migrations) → applySaveGame → loadCivilization.
 * MemorySaveStorage stands in for IndexedDB (the browser E2E test covers IndexedDB and a page
 * reload). The reloaded session is a brand-new GameSession, so nothing survives in memory.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { createHeadlessGame } from '@engine/core/testing/headless';
import { MemorySaveStorage } from '@engine/core/save/storage';
import { parseSave, SaveLoadError, SAVE_FORMAT_VERSION } from '@engine/core/save/saveFormat';
import { advance, doorIsOpen, doorPrologue, flush, startCiv } from './helpers';

describe('Test E — save persistence', () => {
  it('Door: progress, inventory, world state, position and the multiverse survive a save and a reload', async () => {
    const storage = new MemorySaveStorage();
    const { session } = await startCiv('door');
    await doorPrologue(session);
    await advance(session, 1);
    const before = {
      position: { ...session.player.position },
      q0: session.quests.status('DOOR_Q00_REVEIL'),
      q1: session.quests.status('DOOR_Q01_EMPREINTE'),
      rank: session.vars.get('door.rank'),
      palm: session.vars.get('door.palmRevealed'),
    };
    expect(before.q0).toBe('completed');

    await storage.save('slot1', session.buildSaveGame('slot1', 'Test E'));
    expect((await storage.list()).map((s) => s.slot)).toEqual(['slot1']);

    // A new game session, as after closing and reopening the game.
    const { session: s2 } = await createHeadlessGame(new GlobContentProvider());
    const { save, warnings } = parseSave(await storage.load('slot1'));
    expect(warnings).toEqual([]);
    expect(save.formatVersion).toBe(SAVE_FORMAT_VERSION);
    expect(save.currentCiv).toBe('door');
    await s2.applySaveGame(save);
    await s2.loadCivilization(save.currentCiv!);
    await flush();

    // The opening cinematic is not replayed and the story continues where it was.
    expect(s2.cinematics.current).toBeNull();
    expect(s2.quests.status('DOOR_Q00_REVEIL')).toBe(before.q0);
    expect(s2.quests.status('DOOR_Q01_EMPREINTE')).toBe(before.q1);
    expect(s2.quests.isObjectiveDone('DOOR_Q00_REVEIL', 'sortir')).toBe(true);
    expect(s2.vars.get('door.rank')).toBe(before.rank);
    expect(s2.vars.get('door.palmRevealed')).toBe(before.palm);
    expect(s2.civ!.ctx.inventory.has('door:plaque_r0')).toBe(true);
    expect(s2.dialogue.seen('noe', 'intro1')).toBe(true);
    expect(doorIsOpen(s2, 'cell_door')).toBe(true);
    expect(s2.player.position.x).toBeCloseTo(before.position.x, 2);
    expect(s2.player.position.y).toBeCloseTo(before.position.y, 2);
    expect(s2.player.position.z).toBeCloseTo(before.position.z, 2);
    expect(s2.multiverse.progress('door').started).toBe(true);
  });

  it('keeps both civilizations in one save: Memory progress does not overwrite Door progress', async () => {
    const storage = new MemorySaveStorage();
    const game = await startCiv('door');
    const { session } = game;
    await doorPrologue(session);
    await startCiv('memory', game);
    const chamber = session.civ!.mechanics.get('memory.chamber')!.api as { examine(id: string): void };
    await advance(session, 0.2);
    session.cinematics.skip();
    await flush();
    chamber.examine('ambre');
    await advance(session, 0.2);
    expect(session.quests.isObjectiveDone('MEM_Q00_EVEIL', 'examiner')).toBe(true);
    await storage.save('auto', session.buildSaveGame('auto', 'Test E'));

    const { session: s2 } = await createHeadlessGame(new GlobContentProvider());
    const { save } = parseSave(await storage.load('auto'));
    expect(Object.keys(save.civs).sort()).toEqual(['door', 'memory']);
    await s2.applySaveGame(save);
    await s2.loadCivilization('memory');
    expect(s2.quests.isObjectiveDone('MEM_Q00_EVEIL', 'examiner')).toBe(true);
    await s2.loadCivilization('door');
    expect(s2.quests.status('DOOR_Q00_REVEIL')).toBe('completed');
    expect(s2.vars.get('door.rank')).toBe(0);
  });

  it('rejects damaged or newer saves with a French message instead of loading them half-way', async () => {
    const { session } = await startCiv('door');
    const good = JSON.parse(JSON.stringify(session.buildSaveGame('slot2', 'Test E'))) as Record<string, unknown>;

    expect(() => parseSave(null)).toThrow(SaveLoadError);
    expect(() => parseSave({ ...good, format: 'autre.chose' })).toThrow(/n’est pas une sauvegarde/);
    expect(() => parseSave({ ...good, formatVersion: SAVE_FORMAT_VERSION + 1 })).toThrow(/version plus récente/);
    const damaged = structuredClone(good) as { civs: Record<string, Record<string, unknown>> };
    delete damaged.civs.door!.player;
    expect(() => parseSave(damaged)).toThrow(/corrompue ou incompatible/);
  });
});
