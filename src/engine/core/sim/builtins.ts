/**
 * Registers the engine's own components, actions, conditions and events (owner "engine").
 */
import type { GameSession } from './session';
import { coreActions } from '../logic/coreActions';
import { coreConditions } from '../logic/coreConditions';
import { coreEvents } from '../logic/coreEvents';
import { spawnBehavior, markerBehavior, modelBehavior, colliderBehavior, lightBehavior, soundBehavior, particlesBehavior, signBehavior } from '../behaviors/world';
import { doorBehavior, portalBehavior } from '../behaviors/doors';
import { npcBehavior } from '../behaviors/npc';
import { interactableBehavior, pickupBehavior, readableBehavior } from '../behaviors/interactive';
import { triggerBehavior, zoneBehavior } from '../behaviors/volumes';
import { conditionalBehavior } from '../behaviors/conditional';
import type { BehaviorDefinition } from '../packs/definitions';
import type { PropSchema } from '../props/props';

export const ENGINE_BEHAVIORS = [
  spawnBehavior,
  markerBehavior,
  modelBehavior,
  colliderBehavior,
  lightBehavior,
  soundBehavior,
  particlesBehavior,
  signBehavior,
  doorBehavior,
  portalBehavior,
  npcBehavior,
  interactableBehavior,
  pickupBehavior,
  readableBehavior,
  triggerBehavior,
  zoneBehavior,
  conditionalBehavior,
] as unknown as BehaviorDefinition<PropSchema, unknown>[];

export function registerEngineBuiltins(session: GameSession): void {
  for (const b of ENGINE_BEHAVIORS) session.behaviorDefs.set(b.id, { def: b, owner: 'engine' });
  for (const a of coreActions) session.logicRegistry.addAction(a as never, 'engine');
  for (const c of coreConditions) session.logicRegistry.addCondition(c as never, 'engine');
  for (const e of coreEvents) session.logicRegistry.addEvent(e as never, 'engine');
}
