/**
 * CIVILIZATIONVERSE Mechanics SDK — the only module civilization packs import (with '@sdk/ui'
 * for React HUD/panels and '@sdk/view' for custom rendering).
 *
 *   import { defineMechanic, defineBehavior, prop } from '@sdk';
 *
 * See HOW_TO_ADD_A_NEW_MECHANIC.md and docs/MECHANICS_SDK.md.
 */
export {
  definePack,
  type PackModule,
} from '../engine/core/packs/pack';
export {
  defineMechanic,
  defineBehavior,
  defineAction,
  defineCondition,
  defineEvent,
  defineItem,
  defineAbility,
  defineBlock,
  defineModel,
  defineSound,
  defineMusic,
  defineItemUse,
  type ItemUseDefinition,
  type ItemUseContext,
  type ItemUseData,
  type ItemUseMode,
  type HeldItemSpec,
  type HandApi,
  type HandAnimation,
  type MechanicDefinition,
  type BehaviorDefinition,
  type ActionDefinition,
  type ConditionDefinition,
  type EventDefinition,
  type ItemDefinition,
  type AbilityDefinition,
  type BlockDefinition,
  type ModelDefinition,
  type SoundDefinition,
  type MusicDefinition,
  type StateSpec,
} from '../engine/core/packs/definitions';
export { prop, defaultsOf, type PropSchema, type InferProps, type PropDef } from '../engine/core/props/props';
export type * from '../engine/core/sim/api';
export type { ActionData, ConditionData, EventMatch } from '../engine/core/logic/types';
export type { CivEventMap, EventPayload } from '../engine/core/events/eventMap';
export type { MovementParams } from '../engine/core/physics/body';
export { DEFAULT_MOVEMENT } from '../engine/core/physics/body';
export type { AABB } from '../engine/core/physics/aabb';
export type { BlockDef, BlockTextureSpec } from '../engine/core/voxel/blocks';
export type { ModelBuilder, VoxelPaint } from '../engine/core/voxel/microModel';
export type { SoundRecipe, SoundLayer, MusicRecipe, MusicTrack, InstrumentRecipe } from '../engine/core/audio/recipes';
export type { IconSpec, IconShape } from '../engine/core/inventory/items';
export type { Disposable } from '../engine/core/util/disposable';
export type { JsonValue } from '../engine/core/util/json';
export type { LocalCivState } from '../engine/core/save/saveFormat';
export * as vec from '../engine/core/util/math';
export type { Vec3 } from '../engine/core/util/math';
export { ease, type EasingName } from '../engine/core/util/easing';
export { hexToRgb, rgbToHex, mixRgb, shade, type RGB } from '../engine/core/util/color';
export { Rng, hashString } from '../engine/core/util/rng';
export { ENGINE_API_VERSION, ENGINE_VERSION } from '../engine/core/version';
export type { DoorApi } from '../engine/core/behaviors/doors';
export type { EncounterApi, ToolTargetApi } from '../engine/core/behaviors/combat';
export {
  isHostile,
  type Faction,
  type DamageInfo,
  type HitOutcome,
  type HitResult,
  type PlayerCombatOptions,
  type GuardSpec,
  type StrikeSpec,
  type StrikeHit,
  type ProjectileSpec,
  type WaveSpec,
  type HealthApi,
  type CombatantApi,
} from '../engine/core/combat/combat';
export { HOTBAR_SIZE, type SwitchDecision, type SwitchRequest, type EquipmentSnapshot } from '../engine/core/equipment/equipment';
