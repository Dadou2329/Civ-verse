/**
 * CIVILIZATIONVERSE — public runtime API seen by civilization code.
 *
 * Every mechanic, behavior, action and condition receives a context implementing these
 * interfaces. Everything registered through a context is owned by the civilization's scope and
 * released when it unloads (isolation guarantee). The same API runs headless (tests), in the game
 * and in Civilization Studio's playtest.
 *
 * Packs import these types from '@sdk' — never from engine internals.
 */
import type { Disposable, DisposableScope } from '../util/disposable';
import type { Logger } from '../util/logger';
import type { JsonValue } from '../util/json';
import type { Vec3 } from '../util/math';
import type { MessageParams } from '../i18n/localizer';
import type { ScopedEvents } from '../events/eventBus';
import type { MovementParams } from '../physics/body';
import type { ActionData, ConditionData } from '../logic/types';
import type { VarDeclaration } from '../state/variables';
import type { AABB } from '../physics/aabb';
import type { HandApi, ItemUseData } from '../packs/definitions';
import type {
  DamageInfo,
  Faction,
  GuardSpec,
  HitResult,
  PlayerCombatOptions,
  ProjectileSpec,
  StrikeHit,
  StrikeSpec,
  WaveSpec,
} from '../combat/combat';
import type { SwitchDecision, SwitchRequest } from '../equipment/equipment';

export type RunMode = 'play' | 'playtest' | 'headless';

// ---------------------------------------------------------------------------------------------
// Variables & multiverse
// ---------------------------------------------------------------------------------------------

export interface VariablesApi {
  get<T extends JsonValue = JsonValue>(name: string): T | undefined;
  /** Writes a variable of this civilization (`<civId>.*`). Other namespaces are refused. */
  set(name: string, value: JsonValue): void;
  add(name: string, delta: number): number;
  toggle(name: string): boolean;
  has(name: string): boolean;
  declare(name: string, decl: VarDeclaration): void;
  watch(name: string, cb: (value: JsonValue | undefined, previous: JsonValue | undefined) => void): Disposable;
  watchPrefix(prefix: string, cb: (value: JsonValue | undefined, previous: JsonValue | undefined, name: string) => void): Disposable;
}

export interface MultiverseApi {
  readonly protagonist: Readonly<{ awakenings: number; title: string | null }>;
  hasFragment(id: string): boolean;
  fragments(): string[];
  /** Requires "fragments.<id>" in the manifest's globalWrites. */
  grantFragment(id: string): void;
  getFlag(name: string): JsonValue | undefined;
  /** Requires a matching "flags.<pattern>" entry in the manifest's globalWrites. */
  setFlag(name: string, value: JsonValue): void;
  isCivCompleted(civId: string): boolean;
  /** Marks the current civilization as completed in the global state. */
  markCompleted(): void;
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------

export interface MovementState {
  position: Readonly<Vec3>;
  velocity: Vec3;
  grounded: boolean;
  /** World-space wish direction from input (length ≤ 1). */
  wish: { x: number; z: number };
  sprinting: boolean;
}

/** Extension point for civilization-specific movement (dash, double jump, slow fields...). */
export interface MovementModifier {
  id: string;
  /** Lower runs first. */
  priority?: number;
  /** Adjusts movement parameters every frame (speeds, gravity, jump...). */
  modifyParams?(params: MovementParams): void;
  /** Adjusts velocity after input, before collision (impulses, pulls). */
  modifyVelocity?(state: MovementState, dt: number): void;
  /** Return false to forbid jumping, true to allow (e.g. double jump in the air). */
  canJump?(state: MovementState): boolean | undefined;
  onJump?(): void;
  onLand?(fallSpeed: number): void;
}

export interface PlayerApi {
  readonly position: Readonly<Vec3>;
  readonly eye: Readonly<Vec3>;
  readonly forward: Readonly<Vec3>;
  readonly yaw: number;
  readonly pitch: number;
  readonly grounded: boolean;
  setPosition(p: Vec3): void;
  /** Teleports to a spawn entity of the current scene or a position. */
  teleport(target: string | Vec3, yawDeg?: number): void;
  setLook(yaw: number, pitch: number): void;
  lookAt(target: Vec3): void;
  /** Stacking locks: movement is frozen while at least one lock is held. */
  lockMovement(reason: string): Disposable;
  lockLook(reason: string): Disposable;
  readonly movementLocked: boolean;
  addMovementModifier(mod: MovementModifier): Disposable;
  /** Effective parameters after modifiers (read only). */
  readonly movement: Readonly<MovementParams>;
  /** Civilization-level base parameters (reset when the civilization unloads). */
  setBaseMovement(patch: Partial<MovementParams>): void;
  readonly abilities: {
    grant(id: string): void;
    revoke(id: string): void;
    has(id: string): boolean;
    list(): string[];
    /** Seconds before the ability can be used again. */
    cooldown(id: string): number;
  };
  /** How the world names the protagonist locally (e.g. "l’étranger sans plaque"). */
  readonly identity: { readonly title: string | null; setTitle(locKey: string | null): void };
  box(): AABB;
  /**
   * Moves the player at `velocity` (m/s) for `seconds`, ignoring input: dashes, grapple pulls,
   * scripted leaps. Without gravity the move can go up.
   */
  forceMove(velocity: Vec3, seconds: number, opts?: { gravity?: boolean }): void;
  readonly forcedMoving: boolean;
  cancelForcedMove(): void;
  /** Adds a velocity impulse (knockback, a jump pad). */
  impulse(velocity: Vec3): void;
}

// ---------------------------------------------------------------------------------------------
// World & entities
// ---------------------------------------------------------------------------------------------

export interface EntityQuery {
  tag?: string;
  component?: string;
  near?: { point: Vec3; radius: number };
}

export interface MoveToOptions {
  speed?: number;
  run?: boolean;
  /** Stop when within this distance (default 0.4). */
  stopDistance?: number;
  /** Give up after this many seconds (default 30). */
  timeout?: number;
}

export interface EntityApi {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly position: Readonly<Vec3>;
  /** Rotation around Y in degrees. */
  readonly yaw: number;
  setPosition(p: Vec3): void;
  setYaw(deg: number): void;
  visible: boolean;
  enabled: boolean;
  has(component: string): boolean;
  props<T = Record<string, unknown>>(component: string): T;
  /** Runtime override of a component prop (saved with the game). */
  setProp(component: string, key: string, value: JsonValue): void;
  /** Public API object returned by a behavior (`api` field of its instance). */
  behavior<T = unknown>(component: string): T | null;
  distanceToPlayer(): number;
  lookAt(target: Vec3 | 'player' | null): void;
  /** Walks along a navigation path (NPCs). Resolves true when arrived. */
  moveTo(target: Vec3 | string, opts?: MoveToOptions): Promise<boolean>;
  stop(): void;
  /** True while walking toward a moveTo target. */
  readonly moving: boolean;
  playAnimation(name: string, opts?: { loop?: boolean; duration?: number }): void;
  setExpression(expression: string): void;
  /** Short line shown above/near the character (localization key or text). */
  say(text: string, seconds?: number): void;
  /** Adds/replaces a collider part (local box relative to the entity position, rotated with yaw). */
  setCollider(part: string, local: AABB | null, opts?: { solid?: boolean; pickable?: boolean }): void;
  /** Light sources baked into the voxel light field (lanterns, glowing objects). */
  setLights(lights: { offset: [number, number, number]; level: number; color: string }[]): void;
  emit(event: string, payload?: Record<string, unknown>): void;
  /**
   * Walks this frame in a direction (combat movement: chasing, circling, backing off). Call it
   * every frame; without a call the entity stops. Cancels a moveTo in progress.
   */
  steer(direction: { x: number; z: number } | null, speed?: number): void;
  /** Velocity impulse (knockback, a leap). */
  push(velocity: Vec3): void;
  /** Presentation flag read by the entity's visuals (telegraphs, hit flashes…). Not saved. */
  setViewFlag(key: string, value: unknown): void;
  viewFlag<T = unknown>(key: string): T | undefined;
}

export interface RaycastResult {
  entity: EntityApi | null;
  block: { x: number; y: number; z: number; id: string; normal: [number, number, number] } | null;
  point: Vec3;
  distance: number;
}

export interface EntitySpawnDoc {
  id?: string;
  name?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  tags?: string[];
  components: Record<string, Record<string, unknown>>;
}

export interface WorldApi {
  readonly sceneId: string;
  entity(id: string): EntityApi | null;
  /** Like entity() but throws a clear error when missing. */
  require(id: string): EntityApi;
  query(q?: EntityQuery): EntityApi[];
  spawn(doc: EntitySpawnDoc, opts?: { persistent?: boolean }): EntityApi;
  despawn(id: string): void;
  getBlock(x: number, y: number, z: number): string;
  /** Runtime voxel edit (persisted in the save as a scene diff). */
  setBlock(x: number, y: number, z: number, blockId: string | null): void;
  /** Fills a box (inclusive corners) in one batched edit (one light/mesh update). */
  fillBlocks(from: [number, number, number], to: [number, number, number], blockId: string | null): void;
  raycast(origin: Vec3, dir: Vec3, maxDistance: number): RaycastResult | null;
  findPath(from: Vec3, to: Vec3): Vec3[] | null;
  /** Ground height below a point (feet position), or null. */
  groundAt(x: number, z: number, nearY: number): number | null;
  /** Geometry facts about a registered model (local bounds in meters, emitted light). */
  modelInfo(modelId: string): { bounds: { min: [number, number, number]; max: [number, number, number] }; light: { level: number; color: string; offset: [number, number, number] } | null; pickable: boolean } | null;
}

// ---------------------------------------------------------------------------------------------
// Inventory, quests, dialogue, cinematics
// ---------------------------------------------------------------------------------------------

export interface InventoryApi {
  add(itemId: string, count?: number, opts?: { silent?: boolean }): number;
  remove(itemId: string, count?: number, opts?: { silent?: boolean }): boolean;
  count(itemId: string): number;
  has(itemId: string, count?: number): boolean;
  list(): { id: string; count: number }[];
  /** Localized display name of an item. */
  nameOf(itemId: string): string;
  use(itemId: string, actionId?: string): Promise<void>;
}

export type QuestStatus = 'inactive' | 'active' | 'completed' | 'failed';

export interface QuestApi {
  start(id: string): void;
  status(id: string): QuestStatus;
  stage(id: string): string | null;
  setStage(id: string, stageId: string): void;
  completeObjective(id: string, objectiveId: string): void;
  isObjectiveDone(id: string, objectiveId: string): boolean;
  complete(id: string): void;
  fail(id: string): void;
  active(): string[];
  track(id: string | null): void;
}

export interface DialogueApi {
  /** Starts a dialogue; resolves when it ends. */
  start(dialogueId: string, opts?: { entity?: string }): Promise<{ lastNode: string | null }>;
  readonly active: boolean;
  seen(dialogueId: string, nodeId?: string): boolean;
  chose(dialogueId: string, choiceId: string): boolean;
}

export interface CinematicApi {
  play(id: string): Promise<{ skipped: boolean }>;
  skip(): void;
  readonly playing: string | null;
}

// ---------------------------------------------------------------------------------------------
// UI, audio, effects, input, time, scenes, logic
// ---------------------------------------------------------------------------------------------

export type NotificationKind = 'info' | 'success' | 'warning' | 'denied' | 'quest' | 'item' | 'memory' | 'discovery';

export interface NotifyOptions {
  kind?: NotificationKind;
  icon?: string;
  /** Seconds (default 3.5). */
  duration?: number;
}

export interface DocumentSpec {
  title: string;
  /** Paragraphs (already localized). */
  body: string[];
  /** Visual style hint: 'paper', 'register', 'poster', 'letter', 'plaque'... */
  style?: string;
  footer?: string;
}

/** Slots where civilization HUD components can be inserted. */
export type HudSlot = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center' | 'overlay';

/** Built-in HUD elements a civilization can hide or replace. */
export type HudElement =
  | 'crosshair'
  | 'prompt'
  | 'objectives'
  | 'notifications'
  | 'inventory'
  | 'abilities'
  | 'location'
  /** Six-slot bar of the items in hand. */
  | 'hotbar'
  /** Player health (civilizations with combat). */
  | 'health'
  /** Boss health bar. */
  | 'bossBar'
  /** Mouse button verbs and progress ring around the crosshair. */
  | 'handHints';

export interface UiApi {
  notify(text: string, opts?: NotifyOptions): void;
  showLocation(title: string, subtitle?: string): void;
  showDocument(doc: DocumentSpec): Promise<void>;
  /** Opens a civilization panel (registered with definePanel); resolves with its result. */
  openPanel<R = unknown>(id: string, props?: Record<string, unknown>): Promise<R | null>;
  closePanel(id: string, result?: unknown): void;
  isPanelOpen(id: string): boolean;
  setHudVisible(element: HudElement, visible: boolean): void;
  showEndScreen(spec: { title: string; subtitle?: string; lines?: string[] }): Promise<void>;
  confirm(spec: { title: string; message: string; confirm: string; cancel: string }): Promise<boolean>;
  /** Reactive key/value store shared with this civilization's React components. */
  readonly store: UiStoreApi;
}

export interface UiStoreApi {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  subscribe(key: string, cb: (value: unknown) => void): Disposable;
}

export interface SoundOptions {
  at?: Vec3 | string;
  volume?: number;
  pitch?: number;
  loop?: boolean;
}

export interface AudioApi {
  play(soundId: string, opts?: SoundOptions): { stop(): void };
  music(musicId: string | null, opts?: { fade?: number }): void;
  ambience(ambienceId: string | null, opts?: { fade?: number }): void;
}

export type FxKind = 'fade' | 'flash' | 'shake' | 'vignette' | 'fov' | 'tint' | 'blur' | 'letterbox';

export interface FxApi {
  /** Screen fade to `opacity` (0 = clear, 1 = opaque) over `seconds`. */
  fade(opacity: number, seconds: number, color?: string): Promise<void>;
  flash(color: string, seconds: number): void;
  shake(intensity: number, seconds: number): void;
  vignette(intensity: number, seconds: number, color?: string): void;
  fov(delta: number, seconds: number): void;
  tint(color: string | null, strength: number, seconds: number): void;
  /** Changes environment settings (sky, fog, sun...) with a transition. */
  environment(patch: Record<string, unknown>, seconds: number): void;
  /** Pack-defined presentation effect handled by a pack view module. */
  custom(channel: string, payload: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------------------------
// Equipment and combat
// ---------------------------------------------------------------------------------------------

export interface EquipmentApi {
  /** Item in hand (null = empty hand). */
  readonly held: string | null;
  /** The six hotbar slots (item ids or null). */
  hotbar(): (string | null)[];
  /** Selected hotbar slot (0–5). */
  readonly selected: number;
  /** Selects a hotbar slot. False when the change is refused (see guardSwitch). */
  select(index: number): boolean;
  /** Takes an item in hand (placed in the hotbar if needed); null empties the hand. */
  hold(itemId: string | null): boolean;
  /** Places an item in a hotbar slot (null clears it). */
  assign(index: number, itemId: string | null): boolean;
  /** Wears an item in its slot (definition `slot`), replacing the one worn there. */
  equip(itemId: string): boolean;
  unequip(slot: string): void;
  worn(slot: string): string | null;
  wornItems(): { slot: string; itemId: string }[];
  /** Whether a button of the item in hand can be used now. */
  ready(button?: 'primary' | 'secondary'): boolean;
  /** Seconds before the item in hand can be used (drawing it, attunement). */
  readonly drawRemaining: number;
  /** Delays the use of the item in hand (attunement, recoil). */
  delayUse(seconds: number): void;
  /** Interrupts the uses in progress (a shove, a fall): long uses stop without completing. */
  cancelUses(): void;
  /**
   * Rule applied when the player changes the item in hand: return `{ allow: false, reason }` to
   * refuse, `{ drawTime }` to make the new item usable later (a mask that needs attuning).
   */
  guardSwitch(fn: (change: SwitchRequest) => SwitchDecision | void): Disposable;
  /** Uses of the empty hand (a punch, a shove). */
  setUnarmed(spec: { primary?: ItemUseData | null; secondary?: ItemUseData | null }): void;
  /** Presses / releases a mouse button by code (tutorials, tests). */
  press(button: 'primary' | 'secondary'): boolean;
  release(button: 'primary' | 'secondary'): void;
  /** Progress ring under the crosshair (long uses); null hides it. */
  setProgress(progress: { label: string; value: number } | null): void;
  /** First-person hand animations. */
  readonly hand: HandApi;
}

export interface CombatApi {
  /** Gives the player health, damage, defeat and dodge in this civilization. */
  enablePlayer(opts?: PlayerCombatOptions): void;
  readonly enabled: boolean;
  readonly player: {
    readonly health: number;
    readonly maxHealth: number;
    readonly defeated: boolean;
    readonly guarding: boolean;
    readonly staggered: boolean;
    /** Seconds left of the riposte opened by a parry (0 = none). */
    readonly riposte: number;
  };
  /** Combat in progress (an enemy fights the player). */
  readonly inCombat: boolean;
  /** Damage and telegraph tuning of the player's difficulty setting. */
  readonly tuning: { readonly damageTaken: number; readonly telegraph: number; readonly parryBonus: number };
  damagePlayer(info: DamageInfo): HitResult;
  healPlayer(amount: number): void;
  setPlayerMaxHealth(max: number, refill?: boolean): void;
  /** Damages an entity with a `core.health` component. */
  damage(entityId: string, info: DamageInfo): HitResult;
  heal(entityId: string, amount: number): void;
  /** Staggers a combatant (it stops attacking for a moment). */
  stagger(entityId: string, seconds: number): void;
  /** Melee strike from the player's eyes: hits what is in front, nearest first. */
  strike(spec: StrikeSpec): StrikeHit[];
  /** Raises the player's guard until the returned function is called. */
  raiseGuard(spec?: GuardSpec): () => void;
  /** Sidestep with a moment of invulnerability (input direction, else backward). */
  dodge(direction?: { x: number; z: number }): boolean;
  /** Ignores blows for a while (cinematic moment, power). */
  setInvulnerable(seconds: number): void;
  /** Where the player gets back up after a defeat (an entity id or a position of this scene). */
  setCheckpoint(target?: string | Vec3, yawDeg?: number): void;
  spawnProjectile(spec: ProjectileSpec): void;
  spawnWave(spec: WaveSpec): void;
  /** Living entities hostile to `toward` (default: the player's side) around a point. */
  hostilesNear(point: Vec3, radius: number, toward?: Faction): EntityApi[];
  /** No voxel between two points. */
  lineOfSight(from: Vec3, to: Vec3): boolean;
  /** Declares that an entity fights the player this frame (combat music, regeneration). */
  reportEngaged(entityId: string): void;
  /**
   * Plays a music over the current one until the returned function is called. The highest
   * priority wins: 0 generic combat music, 1 encounters (default), 2 bosses.
   */
  pushMusic(musicId: string, priority?: number): () => void;
  /** Boss health bar shown at the top of the screen (null hides it). */
  setBossBar(bar: { entityId: string; name: string; title?: string; health: number; max: number; phase?: number } | null): void;
}

export interface InputApi {
  /** Declares an input action with a default key (KeyboardEvent.code) and a localized label. */
  bind(actionId: string, spec: { key: string; label: string }): Disposable;
  /** Called when the action key is pressed during gameplay. */
  onPressed(actionId: string, cb: () => void): Disposable;
  isDown(actionId: string): boolean;
}

export interface TimeApi {
  /** Simulation time in seconds (stops while paused). */
  readonly now: number;
  onUpdate(cb: (dt: number) => void): Disposable;
  after(seconds: number, cb: () => void): Disposable;
  every(seconds: number, cb: () => void): Disposable;
  wait(seconds: number): Promise<void>;
}

export interface SceneApi {
  readonly current: string;
  list(): string[];
  goTo(sceneId: string, spawnId?: string): Promise<void>;
}

export interface LogicScope {
  /** Entity hosting the logic ("$self"). */
  self?: string | null;
  event?: { name: string; payload: Record<string, unknown> } | null;
  /** Human-readable origin for traces ("règle rank1", "dialogue noe_cell/n3"). */
  origin?: string;
  /** True while fast-forwarding a skipped cinematic. */
  skipping?: boolean;
}

export interface LogicApi {
  run(actions: readonly ActionData[] | null | undefined, scope?: LogicScope): Promise<void>;
  test(condition: ConditionData | null | undefined, scope?: LogicScope): boolean;
}

export interface MechanicsApi {
  get<T = unknown>(id: string): T;
  has(id: string): boolean;
}

export type LifecyclePhase = 'start' | 'sceneEnter' | 'sceneExit' | 'pause' | 'resume' | 'beforeSave' | 'unload';

export interface LifecycleApi {
  on(phase: LifecyclePhase, cb: (info: { sceneId: string }) => void): Disposable;
}

export interface SettingsApi {
  /** Normalized settings of a mechanic (Civilization Rules editor, content/rules.json). */
  of<T = Record<string, unknown>>(mechanicId: string): T;
}

/**
 * Deliberate escape hatch to the rendering engine: `native` is `{ engine, scene }` (Babylon.js)
 * while a GameView renders the session (game, Studio playtest). Null headless and in the Studio's
 * editor viewport. Prefer visuals and view effects ('@sdk/view').
 */
export interface ViewBridge {
  readonly kind: 'babylon';
  readonly native: unknown;
}

export interface CivContext {
  readonly civId: string;
  readonly mode: RunMode;
  t(key: string, params?: MessageParams): string;
  readonly log: Logger;
  readonly events: ScopedEvents;
  readonly vars: VariablesApi;
  readonly multiverse: MultiverseApi;
  readonly player: PlayerApi;
  readonly world: WorldApi;
  readonly inventory: InventoryApi;
  readonly quests: QuestApi;
  readonly dialogue: DialogueApi;
  readonly cinematics: CinematicApi;
  readonly ui: UiApi;
  readonly audio: AudioApi;
  readonly fx: FxApi;
  readonly input: InputApi;
  readonly equipment: EquipmentApi;
  readonly combat: CombatApi;
  readonly time: TimeApi;
  readonly scenes: SceneApi;
  readonly logic: LogicApi;
  readonly mechanics: MechanicsApi;
  readonly lifecycle: LifecycleApi;
  readonly settings: SettingsApi;
  /** Owns everything registered by this context; disposed on unload. */
  readonly scope: DisposableScope;
  readonly view: ViewBridge | null;
}

// ---------------------------------------------------------------------------------------------
// Behaviors (entity components) and interactions
// ---------------------------------------------------------------------------------------------

export interface InteractionOffer {
  /** Stable id of the interaction ("talk", "open", "examine"...). */
  id?: string;
  /** Full localized prompt ("Parler à Mira"). */
  label: string;
  /** Secondary line (state, requirement) shown under the prompt. */
  detail?: string;
  /** Disabled offers are shown greyed out with `detail` as the reason. */
  enabled?: boolean;
  /** Visual tone of the prompt. */
  tone?: 'default' | 'locked' | 'danger' | 'special';
  priority?: number;
  /** 'primary' (E, default) or 'secondary' (F). */
  key?: 'primary' | 'secondary';
}

export interface InteractionAttempt {
  entityId: string;
  offer: InteractionOffer;
  /** Component type that made the offer. */
  source: string;
}

export interface InteractionBlock {
  /** Localized reason shown to the player. */
  reason: string;
  sound?: string;
  /** Extra data forwarded with the 'interaction.blocked' event. */
  data?: Record<string, unknown>;
}

export interface BehaviorInstance<Api = unknown> {
  /** Optional public API (entity.behavior(type) returns it). */
  api?: Api;
  update?(dt: number): void;
  interaction?(): InteractionOffer | InteractionOffer[] | null;
  /** Veto point called on every behavior of the entity before an interaction runs. */
  beforeInteract?(attempt: InteractionAttempt): InteractionBlock | null | void;
  onInteract?(attempt: InteractionAttempt): void | Promise<void>;
  /** Lets a behavior annotate another behavior's offer (e.g. a lock on a door prompt). */
  decorateOffer?(offer: InteractionOffer, source: string): InteractionOffer;
  onPropsChanged?(): void;
  /** Called when the entity is hidden/shown or enabled/disabled. */
  onVisibilityChanged?(visible: boolean): void;
  dispose?(): void;
}

export interface BehaviorContext<P = Record<string, unknown>, S = unknown> extends CivContext {
  readonly entity: EntityApi;
  /** Current effective props (scene values + runtime overrides). */
  readonly props: P;
  /** Persistent per-entity state (saved with the game). */
  readonly state: S;
  /** Component type id. */
  readonly component: string;
}
