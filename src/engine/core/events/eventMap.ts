/**
 * Typed gameplay events of the engine.
 *
 * Packs describe their own events with `defineEvent(...)` (payload fields and label, shown in the
 * Studio's rule and objective editors). In TypeScript their payload is `Record<string, unknown>`:
 * packs only import '@sdk', so they do not augment this interface. Data-driven rules emit and
 * match events by name the same way.
 */
export interface CivEventMap {
  'civ.started': { civId: string };
  'civ.unloading': { civId: string };
  /** The civilization's story is over: the game returns to the civilization selection. */
  'civ.finished': { civId: string };
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
  /** An inventory action (`action` = its id) or a mouse button of the item in hand (`use` = the use type). */
  'item.used': { itemId: string; action: string; use?: string };
  /** The item in hand changed ('' = empty hand). */
  'item.held': { itemId: string; previous: string };
  /** A civilization rule refused the change of item in hand. */
  'item.switchRefused': { itemId: string; reason: string };
  'item.equipped': { itemId: string; slot: string };
  'item.unequipped': { itemId: string; slot: string };
  /** A tool finished its work on a `core.toolTarget` (repair, unlock…). */
  'tool.used': { itemId: string; entityId: string; tool: string };
  /** An entity with health was hit. */
  'combat.hit': { entityId: string; source: string; amount: number; health: number; outcome: string; tags: string[] };
  /** An entity with health was defeated. */
  'combat.defeated': { entityId: string; by: string };
  'combat.playerHit': { amount: number; source: string; health: number; outcome: string };
  'combat.playerDefeated': { by: string };
  'combat.playerRespawned': Record<string, never>;
  'combat.parried': { source: string; kind: string };
  'combat.blocked': { source: string; amount: number };
  'combat.guardBroken': { source: string };
  'combat.reflected': { source: string };
  /** Dodges and other player combat moves. */
  'combat.playerAction': { action: string };
  /** The player entered or left combat. */
  'combat.engaged': { engaged: boolean };
  'combat.encounterStarted': { encounterId: string };
  'combat.encounterWave': { encounterId: string; wave: number };
  'combat.encounterCompleted': { encounterId: string };
  'combat.encounterReset': { encounterId: string };
  'combat.bossPhase': { entityId: string; phase: number };
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
