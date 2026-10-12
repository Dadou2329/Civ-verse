/**
 * Helpers shared by the headless acceptance tests (tests/acceptance/*.test.ts).
 *
 * The tests drive the real packs (civilizations/door, civilizations/memory) through the same
 * GameSession, interaction pipeline and save format as the browser game, without rendering.
 */
import { expect } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { advance, advanceDialogue, choose, createHeadlessGame, flush, skipCinematics, talk, walkTo, type HeadlessGame } from '@engine/core/testing/headless';
import type { GameSession } from '@engine/core/sim/session';

export { advance, advanceDialogue, choose, flush, skipCinematics, talk, walkTo };
export type { HeadlessGame };

/** A fresh game session on the bundled packs, with the civilization loaded from its start. */
export async function startCiv(civId: string, game?: HeadlessGame): Promise<HeadlessGame> {
  const g = game ?? (await createHeadlessGame(new GlobContentProvider()));
  await g.session.loadCivilization(civId, { fresh: true });
  await advance(g.session, 0.3);
  return g;
}

/** Walks to an entity (A* — fails if unreachable) and uses its primary interaction. */
export async function interact(session: GameSession, entityId: string, offerId?: string): Promise<boolean> {
  await walkTo(session, entityId);
  const ok = await session.interaction.interactWith(entityId, 'primary', offerId);
  await flush();
  return ok;
}

export async function openDoor(session: GameSession, doorId: string): Promise<void> {
  if (session.entityApi(doorId)?.behavior<{ isOpen: boolean }>('core.door')?.isOpen) return;
  const ok = await interact(session, doorId, 'open');
  if (!ok) throw new Error(`Porte refusée : ${doorId}`);
  await advance(session, 0.3);
}

/** Walks into a trigger volume (reach in meters) and lets it fire. */
export async function goTo(session: GameSession, entityId: string, reach = 0.6): Promise<void> {
  await walkTo(session, entityId, { reach });
  await advance(session, 0.4);
}

export function doorIsOpen(session: GameSession, doorId: string): boolean {
  return !!session.entityApi(doorId)?.behavior<{ isOpen: boolean }>('core.door')?.isOpen;
}

/** French typography uses no-break spaces (before ':', '?', '!' and inside quotes): compare texts without them. */
export const norm = (t: string | undefined) => (t ?? '').replace(/[\u00a0\u202f]/g, ' ');

/**
 * Door prologue, played like a player: skip the awakening cinematic, open the handleless cell
 * door (palm), leave the cell, talk to Noé. Ends with DOOR_Q00_REVEIL completed.
 */
export async function doorPrologue(session: GameSession): Promise<void> {
  expect(session.cinematics.current?.id).toBe('C01_eveil');
  await skipCinematics(session);
  await flush();
  await openDoor(session, 'cell_door');
  await goTo(session, 'trig_cell_exit', 0.3);
  await talk(session, 'noe', ['from', 'thanks']);
}
