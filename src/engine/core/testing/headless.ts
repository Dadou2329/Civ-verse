/**
 * Helpers to drive a GameSession without rendering (unit tests, playthrough tests, tools).
 */
import { GameSession } from '../sim/session';
import type { ContentProvider } from '../packs/pack';
import { HeadlessUi } from '../sim/uiBridge';
import { findPath } from '../nav/pathfinder';
import type { Vec3 } from '../util/math';
import { yawTowards, pitchTowards, distance } from '../util/math';

export interface HeadlessGame {
  session: GameSession;
  ui: HeadlessUi;
}

export async function createHeadlessGame(provider: ContentProvider): Promise<HeadlessGame> {
  const ui = new HeadlessUi();
  const session = await GameSession.create({ mode: 'headless', provider, ui, recordPresentation: true });
  return { session, ui };
}

/** Lets pending promise continuations run (async actions chain through microtasks). */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

/** Advances simulated time in fixed steps, flushing async logic between steps. */
export async function advance(session: GameSession, seconds: number, step = 1 / 30): Promise<void> {
  let t = 0;
  while (t < seconds - 1e-9) {
    const dt = Math.min(step, seconds - t);
    session.update(dt);
    t += dt;
    await flush(2);
  }
  await flush();
}

/** Ends the running cinematic (if any) the way a player skipping it would. */
export async function skipCinematics(session: GameSession, max = 5): Promise<void> {
  for (let i = 0; i < max && session.cinematics.current; i++) {
    session.cinematics.skip();
    await flush();
  }
}

/** Advances dialogue lines without choices until a choice or the end. */
export async function advanceDialogue(session: GameSession, maxLines = 50): Promise<void> {
  for (let i = 0; i < maxLines; i++) {
    await flush();
    const v = session.dialogue.view();
    if (!v || !v.canAdvance) return;
    session.dialogue.advance();
  }
  throw new Error('Dialogue trop long ou en boucle.');
}

/** Picks a dialogue choice then advances until the next choice or the end. */
export async function choose(session: GameSession, choiceId: string): Promise<void> {
  await advanceDialogue(session);
  const v = session.dialogue.view();
  if (!v) throw new Error(`Aucun dialogue actif pour choisir "${choiceId}".`);
  if (!v.choices.some((c) => c.id === choiceId)) {
    throw new Error(`Choix "${choiceId}" indisponible (choix : ${v.choices.map((c) => c.id).join(', ') || 'aucun'}) dans ${v.dialogueId}/${v.nodeId}.`);
  }
  session.dialogue.choose(choiceId);
  await advanceDialogue(session);
}

/** Plays a whole dialogue, answering with the given choices in order. */
export async function talk(session: GameSession, entityId: string, choices: string[] = []): Promise<void> {
  await walkTo(session, entityId);
  const ok = await session.interaction.interactWith(entityId);
  if (!ok) throw new Error(`Impossible de parler à ${entityId}.`);
  await flush();
  for (const c of choices) await choose(session, c);
  await advanceDialogue(session);
  if (session.dialogue.isActive) throw new Error(`Le dialogue avec ${entityId} n’est pas terminé (${session.dialogue.view()?.nodeId}).`);
}

/**
 * Checks that the player can physically walk to an entity (A* with the player's dimensions,
 * jumps up to 1.2 m, closed doors block), then places the player next to it facing it.
 * Throws when unreachable: this is what proves that a level has no dead end.
 */
export async function walkTo(session: GameSession, entityId: string, opts: { reach?: number } = {}): Promise<Vec3[]> {
  const world = session.world;
  if (!world) throw new Error('Aucune scène chargée.');
  const e = world.entities.get(entityId);
  if (!e) throw new Error(`Entité introuvable : ${entityId}`);
  const reach = opts.reach ?? 2.2;
  const from = session.player.position;
  if (distance(from, e.position) <= reach) {
    face(session, e.position);
    return [];
  }
  const path = findPath(world.collision, from, e.position, {
    jumpHeight: 1.2,
    goalRadius: reach,
    ignoreOwner: 'player',
    maxNodes: 60000,
  });
  if (!path) {
    throw new Error(`Inaccessible à pied : ${entityId} depuis (${from.x.toFixed(1)}, ${from.y.toFixed(1)}, ${from.z.toFixed(1)}) dans "${world.id}".`);
  }
  const end = path[path.length - 1]!;
  session.player.teleport(end);
  face(session, e.position);
  await advance(session, 0.2);
  return path;
}

export function face(session: GameSession, target: Vec3): void {
  const eye = session.player.eye;
  session.player.setLook(yawTowards(eye, target), pitchTowards(eye, { x: target.x, y: target.y + 1, z: target.z }));
}
