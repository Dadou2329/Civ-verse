/**
 * Typed gameplay events.
 *
 * Packs add their own events with declaration merging:
 *
 *   declare module '@engine/core/events/eventMap' {
 *     interface CivEventMap { 'door.rankChanged': { rank: number; previous: number } }
 *   }
 *
 * and describe them for the Studio with `defineEvent(...)` (payload fields, label).
 * Events not declared in TypeScript can still be emitted (payload: Record<string, unknown>),
 * which is what data-driven rules do.
 */
export interface CivEventMap {
  'civ.started': { civId: string };
  'civ.unloading': { civId: string };
  'scene.entered': { sceneId: string };
  'scene.exiting': { sceneId: string };
  'zone.entered': { zoneId: string; name: string };
  'zone.exited': { zoneId: string };
  'trigger.entered': { triggerId: string };
  'trigger.exited': { triggerId: string };
  'entity.interacted': { entityId: string; interaction: string };
  'interaction.blocked': { entityId: string; interaction: string; reason: string; by: string };
  'door.opened': { entityId: string };
  'door.closed': { entityId: string };
  'item.acquired': { itemId: string; count: number; total: number };
  'item.removed': { itemId: string; count: number; total: number };
  'item.used': { itemId: string; action: string };
  'var.changed': { name: string; value: unknown; previous: unknown };
  'dialogue.started': { dialogueId: string; entityId: string | null };
  'dialogue.node': { dialogueId: string; nodeId: string };
  'dialogue.choice': { dialogueId: string; nodeId: string; choiceId: string };
  'dialogue.ended': { dialogueId: string; lastNode: string | null };
  'quest.started': { questId: string };
  'quest.stageChanged': { questId: string; stageId: string; previous: string | null };
  'quest.objectiveCompleted': { questId: string; objectiveId: string };
  'quest.completed': { questId: string };
  'quest.failed': { questId: string };
  'cinematic.started': { cinematicId: string };
  'cinematic.ended': { cinematicId: string; skipped: boolean };
  'npc.arrived': { entityId: string };
  'player.jumped': Record<string, never>;
  'player.landed': { fallSpeed: number };
  'ability.used': { abilityId: string };
  'multiverse.fragmentAcquired': { fragmentId: string; civId: string };
  'save.completed': { slot: string };
  'ui.panelOpened': { panelId: string };
  'ui.panelClosed': { panelId: string };
}

export type CivEventName = keyof CivEventMap & string;

/** Payload type of an event: typed for declared events, a record for data-defined ones. */
export type EventPayload<K extends string> = K extends keyof CivEventMap ? CivEventMap[K] : Record<string, unknown>;
