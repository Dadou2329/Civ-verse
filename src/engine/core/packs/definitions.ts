/**
 * Definition kinds a civilization pack can contribute.
 *
 * A pack's modules (auto-discovered under `mechanics/`, `ui/`, `models/`...) export values created
 * by these `define*` helpers. The pack loader collects every exported definition, so adding a new
 * mechanic never requires editing a central list.
 */
import type { InferProps, PropSchema } from '../props/props';
import type { BehaviorContext, BehaviorInstance, CivContext, HudSlot, LogicScope } from '../sim/api';
import type { BlockDef } from '../voxel/blocks';
import type { ModelBuildFn, ModelOptions } from '../voxel/microModel';
import type { ConditionData, ActionData } from '../logic/types';
import type { SoundRecipe, MusicRecipe } from '../audio/recipes';
import type { IconSpec } from '../inventory/items';

export type DefinitionKind =
  | 'mechanic'
  | 'behavior'
  | 'action'
  | 'condition'
  | 'event'
  | 'item'
  | 'ability'
  | 'block'
  | 'model'
  | 'sound'
  | 'music'
  | 'hud'
  | 'panel'
  | 'visual'
  | 'viewEffect'
  | 'itemUse';

interface Branded<K extends DefinitionKind> {
  readonly __kind: K;
  readonly id: string;
}

// ---------------------------------------------------------------------------------------------
// Mechanics
// ---------------------------------------------------------------------------------------------

export interface StateSpec<S> {
  /** Increment when the state shape changes; provide a migration for the previous version. */
  version: number;
  initial: () => S;
  /** migrate[n] converts a state saved at version n into version n + 1. */
  migrate?: Record<number, (old: unknown) => unknown>;
}

export interface MechanicDefinition<S = unknown, Api = unknown, Settings extends PropSchema = PropSchema> extends Branded<'mechanic'> {
  /** French label (Studio). */
  label: string;
  description?: string;
  state?: StateSpec<S>;
  /** Settings edited in the Civilization Rules editor (stored in content/rules.json). */
  settings?: Settings;
  /** Other mechanics that must be set up first. */
  dependsOn?: string[];
  setup(ctx: CivContext, state: S, settings: InferProps<Settings>): Api | void;
}

export function defineMechanic<S = undefined, Api = void, Settings extends PropSchema = Record<string, never>>(
  def: Omit<MechanicDefinition<S, Api, Settings>, '__kind'>,
): MechanicDefinition<S, Api, Settings> {
  return { __kind: 'mechanic', ...def };
}

// ---------------------------------------------------------------------------------------------
// Behaviors (entity components)
// ---------------------------------------------------------------------------------------------

export interface BehaviorStateSpec<P, S> {
  version: number;
  initial: (props: P) => S;
  migrate?: Record<number, (old: unknown) => unknown>;
}

export interface BehaviorDefinition<Sch extends PropSchema = PropSchema, S = unknown> extends Branded<'behavior'> {
  label: string;
  description?: string;
  /** Studio grouping ("Narration", "Portes", "Mémoire"...). */
  category?: string;
  props: Sch;
  state?: BehaviorStateSpec<InferProps<Sch>, S>;
  /** Components automatically added alongside this one in the Studio. */
  requires?: string[];
  /** Hidden from the "Ajouter un composant" menu. */
  internal?: boolean;
  create(ctx: BehaviorContext<InferProps<Sch>, S>): BehaviorInstance | void;
}

export function defineBehavior<Sch extends PropSchema, S = undefined>(
  def: Omit<BehaviorDefinition<Sch, S>, '__kind'>,
): BehaviorDefinition<Sch, S> {
  return { __kind: 'behavior', ...def };
}

// ---------------------------------------------------------------------------------------------
// Logic: actions, conditions, events
// ---------------------------------------------------------------------------------------------

export interface ActionDefinition<Sch extends PropSchema = PropSchema> extends Branded<'action'> {
  label: string;
  description?: string;
  category?: string;
  props: Sch;
  run(ctx: CivContext, props: InferProps<Sch>, scope: LogicScope): void | Promise<void>;
  /**
   * Whether the action must still run when a cinematic is skipped (default true). Purely
   * presentational actions (sounds, camera effects) set false.
   */
  essential?: boolean;
  /** One-line French summary for the Studio ("Donner 1 × Clé vierge"). */
  summarize?(props: InferProps<Sch>): string;
}

export function defineAction<Sch extends PropSchema>(def: Omit<ActionDefinition<Sch>, '__kind'>): ActionDefinition<Sch> {
  return { __kind: 'action', ...def };
}

export interface ConditionDefinition<Sch extends PropSchema = PropSchema> extends Branded<'condition'> {
  label: string;
  description?: string;
  category?: string;
  props: Sch;
  test(ctx: CivContext, props: InferProps<Sch>, scope: LogicScope): boolean;
  summarize?(props: InferProps<Sch>): string;
}

export function defineCondition<Sch extends PropSchema>(def: Omit<ConditionDefinition<Sch>, '__kind'>): ConditionDefinition<Sch> {
  return { __kind: 'condition', ...def };
}

/** Documents an event so the Studio can offer it in rules and objective triggers. */
export interface EventDefinition<Sch extends PropSchema = PropSchema> extends Branded<'event'> {
  label: string;
  description?: string;
  /** Payload fields (used to build "where" filters). */
  fields: Sch;
}

export function defineEvent<Sch extends PropSchema>(def: Omit<EventDefinition<Sch>, '__kind'>): EventDefinition<Sch> {
  return { __kind: 'event', ...def };
}

// ---------------------------------------------------------------------------------------------
// Items & abilities
// ---------------------------------------------------------------------------------------------

export interface ItemActionDef {
  id: string;
  /** Localization key of the action label ("Lire", "Examiner"). */
  label: string;
  condition?: ConditionData | null;
  actions: ActionData[];
}

export interface ItemDefinition extends Branded<'item'> {
  /** Localization keys. */
  name: string;
  description: string;
  icon: IconSpec;
  category: 'key' | 'quest' | 'document' | 'tool' | 'consumable' | 'equipment' | 'collectible' | 'misc';
  stackable?: boolean;
  maxStack?: number;
  /** Quest items cannot be dropped or sold. */
  questItem?: boolean;
  tags?: string[];
  actions?: ItemActionDef[];
  /** Equipment slot id when equippable (« mask », « gloves »…): equipped items are worn. */
  slot?: string;
  /** Abilities granted while the item is equipped in its slot. */
  grants?: string[];
  /** Holdable item: shown in the hand and used with the mouse buttons (see defineItemUse). */
  held?: HeldItemSpec;
}

/** A use of a held item, stored like an action: a registered type plus its props. */
export interface ItemUseData {
  type: string;
  [field: string]: unknown;
}

export interface HeldItemSpec {
  /** Model shown in the hand (first person) and in characters' hands. */
  model?: string;
  /** First-person placement relative to the camera: offset in meters (right, up, forward). */
  offset?: [number, number, number];
  /** Rotation in degrees (x, y, z). */
  rotation?: [number, number, number];
  scale?: number;
  /** Seconds after taking the item in hand before it can be used (default 0.3). */
  drawTime?: number;
  /** Left click (attack / use). */
  primary?: ItemUseData | null;
  /** Right click (guard / aim / alternate use). */
  secondary?: ItemUseData | null;
}

export function defineItem(def: Omit<ItemDefinition, '__kind'>): ItemDefinition {
  return { __kind: 'item', ...def };
}

export interface AbilityDefinition extends Branded<'ability'> {
  /** Localization keys. */
  name: string;
  description: string;
  /** Default key (KeyboardEvent.code). */
  key: string;
  icon: IconSpec;
  cooldown?: number;
  /** Granted automatically when the civilization starts. */
  autoGrant?: boolean;
  canActivate?(ctx: CivContext): boolean;
  /** Returns false when the activation did nothing (no cooldown applied). */
  activate(ctx: CivContext): void | boolean | Promise<void | boolean>;
}

export function defineAbility(def: Omit<AbilityDefinition, '__kind'>): AbilityDefinition {
  return { __kind: 'ability', ...def };
}

/** First-person animations of the hand (the held item's view model). */
export type HandAnimation = 'swing' | 'swingHeavy' | 'thrust' | 'raise' | 'charge' | 'use' | 'cast' | 'inspect' | 'recoil';

export interface HandApi {
  /** Plays a hand animation for `seconds` (uses wait for nothing: animations are visual). */
  play(animation: HandAnimation, seconds: number): void;
  /** Holds a pose until released (guard raised, lens up, charge): returns the release function. */
  hold(animation: HandAnimation): () => void;
}

export type ItemUseMode = 'press' | 'hold' | 'charge';

export interface ItemUseContext<P> {
  readonly ctx: CivContext;
  readonly props: P;
  /** Item in hand (null: the empty hand, see `ctx.equipment.setUnarmed`). */
  readonly itemId: string | null;
  readonly button: 'primary' | 'secondary';
  /** Seconds since the button was pressed (hold and charge uses). */
  readonly heldFor: number;
  /** True in `stop` when the use was interrupted (dialogue, hit, item change) rather than released. */
  readonly cancelled: boolean;
  readonly hand: HandApi;
}

/**
 * What a mouse button does with an item in hand (« Frapper », « Parer », « Réparer »…). Uses are
 * registered like actions: items reference them by type with their props (content/items.json or
 * code), so the Studio edits them with the same fields.
 *
 * - `press`: `start` runs once per click.
 * - `hold`: `start` on press, `update` every frame while held, `stop` on release.
 * - `charge`: like hold; `stop` receives `heldFor` to tell a quick tap from a charged release.
 */
export interface ItemUseDefinition<Sch extends PropSchema = PropSchema> extends Branded<'itemUse'> {
  /** French label (Studio). */
  label: string;
  category?: string;
  description?: string;
  props: Sch;
  mode: ItemUseMode;
  /** Localization key of the verb shown next to the mouse button in the HUD (« Frapper »). */
  hint?: string;
  /** Seconds before the same button can be used again (default: props.cooldown or 0). */
  cooldown?: (props: InferProps<Sch>) => number;
  /**
   * Contextual verb shown for the item in hand, every frame (« Réparer la pompe » while aiming at
   * it). Null falls back to `hint`.
   */
  aim?(use: ItemUseContext<InferProps<Sch>>): string | null;
  /** Returns false when nothing happened (no cooldown). */
  start?(use: ItemUseContext<InferProps<Sch>>): boolean | void;
  update?(use: ItemUseContext<InferProps<Sch>>, dt: number): void;
  stop?(use: ItemUseContext<InferProps<Sch>>): void;
}

export function defineItemUse<Sch extends PropSchema>(def: Omit<ItemUseDefinition<Sch>, '__kind'>): ItemUseDefinition<Sch> {
  return { __kind: 'itemUse', ...def };
}

// ---------------------------------------------------------------------------------------------
// Assets: blocks, models, sounds, music
// ---------------------------------------------------------------------------------------------

export interface BlockDefinition extends BlockDef {
  readonly __kind: 'block';
}

export function defineBlock(def: BlockDef): BlockDefinition {
  return { __kind: 'block', ...def };
}

export interface ModelDefinition extends Branded<'model'>, ModelOptions {
  label: string;
  category?: string;
  build: ModelBuildFn;
}

export function defineModel(def: Omit<ModelDefinition, '__kind'>): ModelDefinition {
  return { __kind: 'model', ...def };
}

export interface SoundDefinition extends Branded<'sound'> {
  label: string;
  category: 'sfx' | 'ui' | 'ambience' | 'voice';
  recipe: SoundRecipe;
}

export function defineSound(def: Omit<SoundDefinition, '__kind'>): SoundDefinition {
  return { __kind: 'sound', ...def };
}

export interface MusicDefinition extends Branded<'music'> {
  label: string;
  recipe: MusicRecipe;
}

export function defineMusic(def: Omit<MusicDefinition, '__kind'>): MusicDefinition {
  return { __kind: 'music', ...def };
}

// ---------------------------------------------------------------------------------------------
// UI and view extensions (typed precisely in @sdk/ui and @sdk/view)
// ---------------------------------------------------------------------------------------------

/** Opaque UI component reference (a React component; typed in @sdk/ui). */
export type UiComponentRef = (props: never) => unknown;

export interface HudDefinition extends Branded<'hud'> {
  slot: HudSlot;
  order?: number;
  component: UiComponentRef;
  /** Shown only while the condition holds. */
  visibleWhen?: ConditionData | null;
}

export interface PanelDefinition extends Branded<'panel'> {
  component: UiComponentRef;
  /** Pauses the simulation while open (default true). */
  pausesGame?: boolean;
  /** Localization key of the panel title (accessibility). */
  title?: string;
}

/** Visual adapter for a component type (typed with Babylon in @sdk/view). */
export interface VisualDefinition extends Branded<'visual'> {
  /** Component type this visual renders. */
  component: string;
  create: (viewCtx: unknown, entity: unknown) => { update?(dt: number): void; dispose(): void };
}

/** Handler of `ctx.fx.custom(channel, payload)` presentation requests (typed in @sdk/view). */
export interface ViewEffectDefinition extends Branded<'viewEffect'> {
  channel: string;
  handle: (viewCtx: unknown, payload: Record<string, unknown>) => void;
}

export type AnyDefinition =
  | MechanicDefinition<never, unknown, PropSchema>
  | BehaviorDefinition<PropSchema, never>
  | ActionDefinition<PropSchema>
  | ConditionDefinition<PropSchema>
  | EventDefinition<PropSchema>
  | ItemDefinition
  | AbilityDefinition
  | BlockDefinition
  | ModelDefinition
  | SoundDefinition
  | MusicDefinition
  | HudDefinition
  | PanelDefinition
  | VisualDefinition
  | ViewEffectDefinition
  | ItemUseDefinition<PropSchema>;

export interface CollectedDefinitions {
  mechanics: MechanicDefinition<unknown, unknown, PropSchema>[];
  behaviors: BehaviorDefinition<PropSchema, unknown>[];
  actions: ActionDefinition<PropSchema>[];
  conditions: ConditionDefinition<PropSchema>[];
  events: EventDefinition<PropSchema>[];
  items: ItemDefinition[];
  abilities: AbilityDefinition[];
  blocks: BlockDefinition[];
  models: ModelDefinition[];
  sounds: SoundDefinition[];
  music: MusicDefinition[];
  huds: HudDefinition[];
  panels: PanelDefinition[];
  visuals: VisualDefinition[];
  viewEffects: ViewEffectDefinition[];
  itemUses: ItemUseDefinition<PropSchema>[];
}

export function emptyDefinitions(): CollectedDefinitions {
  return {
    mechanics: [],
    behaviors: [],
    actions: [],
    conditions: [],
    events: [],
    items: [],
    abilities: [],
    blocks: [],
    models: [],
    sounds: [],
    music: [],
    huds: [],
    panels: [],
    visuals: [],
    viewEffects: [],
    itemUses: [],
  };
}

export function isDefinition(value: unknown): value is AnyDefinition {
  return typeof value === 'object' && value !== null && typeof (value as { __kind?: unknown }).__kind === 'string' && typeof (value as { id?: unknown }).id === 'string';
}

/**
 * Collects every definition exported by a set of modules (the result of import.meta.glob).
 * Arrays of definitions are also accepted (e.g. `export const blocks = [defineBlock(...), ...]`).
 */
export function collectDefinitions(modules: Record<string, unknown>, into = emptyDefinitions()): CollectedDefinitions {
  const seen = new Set<unknown>();
  const visit = (value: unknown) => {
    if (seen.has(value)) return;
    if (Array.isArray(value)) {
      seen.add(value);
      value.forEach(visit);
      return;
    }
    if (!isDefinition(value)) return;
    seen.add(value);
    const d = value as AnyDefinition;
    switch (d.__kind) {
      case 'mechanic':
        into.mechanics.push(d as unknown as MechanicDefinition<unknown, unknown, PropSchema>);
        break;
      case 'behavior':
        into.behaviors.push(d as unknown as BehaviorDefinition<PropSchema, unknown>);
        break;
      case 'action':
        into.actions.push(d);
        break;
      case 'condition':
        into.conditions.push(d);
        break;
      case 'event':
        into.events.push(d);
        break;
      case 'item':
        into.items.push(d);
        break;
      case 'ability':
        into.abilities.push(d);
        break;
      case 'block':
        into.blocks.push(d);
        break;
      case 'model':
        into.models.push(d);
        break;
      case 'sound':
        into.sounds.push(d);
        break;
      case 'music':
        into.music.push(d);
        break;
      case 'hud':
        into.huds.push(d);
        break;
      case 'panel':
        into.panels.push(d);
        break;
      case 'visual':
        into.visuals.push(d);
        break;
      case 'viewEffect':
        into.viewEffects.push(d);
        break;
      case 'itemUse':
        into.itemUses.push(d as unknown as ItemUseDefinition<PropSchema>);
        break;
    }
  };
  for (const mod of Object.values(modules)) {
    if (typeof mod !== 'object' || mod === null) continue;
    for (const exported of Object.values(mod as Record<string, unknown>)) visit(exported);
  }
  return into;
}
