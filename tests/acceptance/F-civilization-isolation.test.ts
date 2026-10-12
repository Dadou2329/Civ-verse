/**
 * Acceptance test F — Civilization isolation.
 *
 * "Load Door Civilization, activate its mechanic, switch to Memory Civilization, and verify
 * Door-specific systems do not keep running incorrectly."
 *
 * Played on the real packs in one GameSession, exactly as the game switches civilizations from
 * the selection screen. The engine-level guarantees (listeners, timers, registrations) are also
 * tested on a minimal fixture in src/engine/core/sim/session.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { createHeadlessGame } from '@engine/core/testing/headless';
import { advance, doorPrologue, flush, skipCinematics, startCiv, walkTo } from './helpers';

const doorIds = (ids: Iterable<string>) => [...ids].filter((id) => id.startsWith('door.') || id.startsWith('door:'));

describe('Test F — civilization isolation', () => {
  it('Door systems stop when Memory is loaded, and come back intact with Door', async () => {
    const game = await createHeadlessGame(new GlobContentProvider());
    const { session, ui } = game;
    const baselineTimers = session.clock.timerCount;
    await startCiv('door', game);
    await doorPrologue(session);

    // --- Door's mechanics are active -------------------------------------------------------
    // Rank system: the gallery gate (rank 1) refuses the rank-0 player and the refusal is
    // recorded by the access mechanic for its HUD stamp.
    await walkTo(session, 'porte_galerie');
    expect(await session.interaction.interactWith('porte_galerie', 'primary', 'open')).toBe(false);
    expect(session.civ!.ctx.ui.store.get<{ n: number }>('door.denied')?.n).toBe(1);
    // Its key binding opens the permissions panel; its HUD elements are registered.
    expect(session.handleKey('KeyR', true)).toBe(true);
    session.handleKey('KeyR', false);
    await flush();
    expect(ui.openPanels.has('door.permissions')).toBe(true);
    session.civ!.ctx.ui.closePanel('door.permissions');
    expect([...ui.huds.keys()]).toEqual(expect.arrayContaining(['door.rankPlaque', 'door.accessDenied']));
    // A timed Door effect is pending (temporary rank given by a Door action).
    await session.civ!.ctx.logic.run([{ type: 'door.setRank', rank: 2, temporary: true }]);
    expect(session.vars.get('door.rank')).toBe(2);
    expect(session.behaviorDefs.has('door.watcher')).toBe(true);
    expect(session.logicRegistry.action('door.setRank')).toBeDefined();
    const doorEvents: string[] = [];
    const spies = ['door.caught', 'door.accessDenied', 'door.rankChanged'].map((name) => session.bus.on(name, () => doorEvents.push(name)));

    // --- Switch to Memory ------------------------------------------------------------------
    await startCiv('memory', game);
    await skipCinematics(session);
    expect(session.civ?.id).toBe('memory');
    const frozenDoor = JSON.stringify(session.civStates.get('door'));

    // No Door definition remains registered…
    expect(doorIds(session.behaviorDefs.keys())).toEqual([]);
    expect(session.logicRegistry.action('door.setRank')).toBeUndefined();
    expect(session.logicRegistry.condition('door.rankAtLeast')).toBeUndefined();
    expect(session.blocks.has('door:damp_stone')).toBe(false);
    expect([...session.civ!.mechanics.keys()].filter((id) => id.startsWith('door.'))).toEqual([]);
    // …nor any Door interface, key binding or variable.
    expect(doorIds(ui.huds.keys())).toEqual([]);
    expect(doorIds(ui.openPanels.keys())).toEqual([]);
    expect([...ui.huds.keys()]).toEqual(expect.arrayContaining(['memory.chamberHud']));
    session.handleKey('KeyR', true);
    session.handleKey('KeyR', false);
    await flush();
    expect(ui.openPanels.has('door.permissions')).toBe(false);
    expect(session.vars.get('door.rank')).toBeUndefined();
    expect(session.i18n.has('door.rank.0')).toBe(false);
    expect(session.i18n.has('door.name')).toBe(true); // still listed on the selection screen

    // Memory plays for a while: Door's saved state does not move and no Door event fires.
    await walkTo(session, 'jules');
    await advance(session, 10);
    expect(JSON.stringify(session.civStates.get('door'))).toBe(frozenDoor);
    expect(doorEvents).toEqual([]);
    for (const spy of spies) spy.dispose();

    // --- Back to Door: its state is restored, Memory's systems are gone in turn -------------
    await session.loadCivilization('door');
    await flush();
    expect(session.vars.get('door.rank')).toBe(2);
    expect(session.vars.get('door.rankTemporary')).toBe(true);
    expect(session.quests.status('DOOR_Q00_REVEIL')).toBe('completed');
    expect(session.civ!.ctx.inventory.has('door:plaque_r0')).toBe(true);
    expect(ui.huds.has('memory.chamberHud')).toBe(false);
    expect(session.behaviorDefs.has('door.watcher')).toBe(true);
    expect([...session.behaviorDefs.keys()].filter((id) => id.startsWith('memory.'))).toEqual([]);
    expect(session.vars.get('memory.shardsOwned')).toBeUndefined();

    // Unloading leaves nothing behind: listeners and timers back to the engine baseline.
    await session.unloadCivilization();
    expect(session.leakedListeners).toBe(0);
    expect(session.clock.timerCount).toBe(baselineTimers);
    expect(session.player.modifierCount).toBe(0);
  });
});
