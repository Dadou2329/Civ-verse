/**
 * Data shapes of the logic system (stored in content JSON).
 *
 * A condition or action is an object with a registered `type` ("core.setVar", "door.hasRank"...)
 * plus the fields declared by that type's prop schema.
 */
export interface ConditionData {
  type: string;
  [field: string]: unknown;
}

export interface ActionData {
  type: string;
  /** Optional designer note shown in the Studio (never shown to players). */
  note?: string;
  [field: string]: unknown;
}

/** Event matcher used by rules and quest objectives. */
export interface EventMatch {
  event: string;
  /** Payload fields that must be equal (string values may reference "$self"). */
  where?: Record<string, unknown>;
}
