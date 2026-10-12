/**
 * Content file formats (validated with Zod; error messages in French).
 *
 * Every content file carries `format` and `version` so that future engine updates can migrate
 * old files. All formats are at version 1 and no content migration exists yet: a format change
 * must add one (see docs/VERSIONING.md). The Studio reads and writes exactly these shapes.
 */
import { z } from 'zod';
import { EASING_NAMES } from '../util/easing';
import { LOCAL_ID_RE, PACK_ID_RE } from '../util/ids';
import { ICON_SHAPES } from '../inventory/items';

z.config(z.locales.fr());

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'Couleur #rrggbb attendue' });
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const localId = z.string().regex(LOCAL_ID_RE, { error: 'Identifiant local invalide (lettres, chiffres, _ et -)' });
const looseRecord = z.record(z.string(), z.unknown());

export const ConditionSchema = z.looseObject({ type: z.string().min(1) });
export const ActionSchema = z.looseObject({ type: z.string().min(1), note: z.string().optional() });
export const EventMatchSchema = z.object({ event: z.string().min(1), where: looseRecord.optional() });

// ---------------------------------------------------------------------------------------------
// Pack manifest
// ---------------------------------------------------------------------------------------------

export const ThemeSchema = z.object({
  accent: hex,
  accentSoft: hex.optional(),
  panel: z.string().optional(),
  panelBorder: z.string().optional(),
  text: hex.optional(),
  textDim: hex.optional(),
  /** CSS font-family for body text. */
  font: z.string().optional(),
  /** CSS font-family for titles. */
  titleFont: z.string().optional(),
});

export const ManifestSchema = z.object({
  format: z.literal('civverse.pack'),
  version: z.literal(1),
  id: z
    .string()
    .regex(PACK_ID_RE)
    // Namespaces the engine owns: its registrations ("engine"), the multiverse variables
    // ("global.*") and the game interface texts ("ui.*").
    .refine((id) => !['engine', 'global', 'ui'].includes(id), { error: 'Identifiant de pack réservé par le moteur (engine, global, ui).' }),
  kind: z.enum(['civilization', 'library']).default('civilization'),
  /** Localization keys. */
  name: z.string(),
  description: z.string(),
  tagline: z.string().optional(),
  packVersion: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, { error: 'Version x.y.z attendue (ex. 1.2.0)' }),
  /** Semver range of the engine API this pack was written for. */
  engineApi: z.string(),
  dependencies: z.array(z.string()).default([]),
  entry: z.object({ scene: localId, spawn: localId }).optional(),
  scenes: z.array(localId).default([]),
  /** Version of the pack's local save state (bump + migrate when it changes). */
  stateVersion: z.number().int().min(1).default(1),
  /** Multiverse writes allowed to this pack ("fragments.threshold", "flags.door.*"). */
  globalWrites: z.array(z.string()).default([]),
  fragments: z
    .array(z.object({ id: localId, name: z.string(), hint: z.string(), icon: z.enum(ICON_SHAPES as unknown as [string, ...string[]]).optional() }))
    .default([]),
  theme: ThemeSchema.optional(),
  cover: z.object({ colors: z.array(hex).min(2), motif: z.string() }).optional(),
  hud: z.object({ hide: z.array(z.string()).default([]) }).default({ hide: [] }),
  /** Order in the civilization selection screen. */
  order: z.number().default(100),
  credits: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type PackManifest = z.infer<typeof ManifestSchema>;

// ---------------------------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------------------------

export const EntityDocSchema = z.object({
  id: localId,
  /** Editor label (French). Player-visible names come from components (text keys). */
  name: z.string().optional(),
  position: vec3,
  /** Degrees. */
  rotation: vec3.optional(),
  scale: vec3.optional(),
  tags: z.array(z.string()).optional(),
  /** Hierarchy folder in the Studio ("Quartier bas/Maisons"). */
  folder: z.string().optional(),
  components: z.record(z.string(), looseRecord),
  /** Editor-only flags. */
  editor: z.object({ locked: z.boolean().optional(), hidden: z.boolean().optional() }).optional(),
});
export type EntityDoc = z.infer<typeof EntityDocSchema>;

export const EnvironmentSchema = z.object({
  sky: z.object({
    top: hex,
    horizon: hex,
    bottom: hex,
    /** Star field intensity 0..1. */
    stars: z.number().min(0).max(1).default(0),
    sunDisc: z.boolean().default(true),
    /** Optional moon/sun disc color. */
    discColor: hex.optional(),
  }),
  sun: z.object({ direction: vec3, color: hex, intensity: z.number().min(0) }),
  /** Ambient sky light applied to voxels (scaled by baked sky light). */
  ambient: z.object({ color: hex, intensity: z.number().min(0) }),
  /** Hemispheric light for characters and props. */
  hemi: z.object({ sky: hex, ground: hex, intensity: z.number().min(0) }),
  fog: z.object({ color: hex, density: z.number().min(0) }),
  /** Multiplier of baked block light (lanterns...). */
  blockLight: z.number().min(0).default(1),
  particles: z.object({ preset: z.string(), density: z.number().min(0) }).nullable().default(null),
  music: z.string().nullable().default(null),
  ambience: z.string().nullable().default(null),
  post: z
    .object({
      exposure: z.number().default(1),
      contrast: z.number().default(1.05),
      saturation: z.number().default(1),
      bloom: z.number().min(0).default(0.35),
      vignette: z.number().min(0).default(0.35),
    })
    .default({ exposure: 1, contrast: 1.05, saturation: 1, bloom: 0.35, vignette: 0.35 }),
});
export type EnvironmentDoc = z.infer<typeof EnvironmentSchema>;

export const VoxelDataSchema = z.object({
  size: z.tuple([z.number().int().min(1).max(1024), z.number().int().min(1).max(1024), z.number().int().min(1).max(1024)]),
  palette: z.array(z.string()).min(1),
  encoding: z.literal('rle16-b64'),
  data: z.string(),
});
export type VoxelDataDoc = z.infer<typeof VoxelDataSchema>;

export const SceneSchema = z.object({
  format: z.literal('civverse.scene'),
  version: z.literal(1),
  id: localId,
  /** Localization key of the location name. */
  name: z.string(),
  environment: EnvironmentSchema,
  voxels: VoxelDataSchema,
  entities: z.array(EntityDocSchema),
  editor: z
    .object({
      camera: z.object({ position: vec3, target: vec3 }).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});
export type SceneDoc = z.infer<typeof SceneSchema>;

// ---------------------------------------------------------------------------------------------
// Dialogues
// ---------------------------------------------------------------------------------------------

export const DialogueChoiceSchema = z.object({
  id: localId,
  text: z.string(),
  next: z.string().nullable().optional(),
  condition: ConditionSchema.nullable().optional(),
  actions: z.array(ActionSchema).optional(),
  /** Hidden after being chosen once. */
  once: z.boolean().optional(),
  /** When the condition fails: hide (default) or show disabled. */
  showDisabled: z.boolean().optional(),
});

export const DialogueNodeSchema = z.object({
  id: localId,
  /** Entity id, 'player', 'narrator' or a key of `speakers`. */
  speaker: z.string().optional(),
  /** Localization key. Empty = routing node (not displayed). */
  text: z.string().default(''),
  expression: z.string().optional(),
  animation: z.string().optional(),
  actions: z.array(ActionSchema).optional(),
  choices: z.array(DialogueChoiceSchema).optional(),
  next: z.string().nullable().optional(),
  branches: z.array(z.object({ condition: ConditionSchema, next: z.string() })).optional(),
  end: z.boolean().optional(),
  editor: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type DialogueNodeDoc = z.infer<typeof DialogueNodeSchema>;

export const DialogueSchema = z.object({
  format: z.literal('civverse.dialogue'),
  version: z.literal(1),
  id: localId,
  title: z.string().optional(),
  speakers: z.record(z.string(), z.object({ name: z.string(), entity: z.string().optional() })).optional(),
  start: z.string(),
  nodes: z.array(DialogueNodeSchema).min(1),
});
export type DialogueDoc = z.infer<typeof DialogueSchema>;

// ---------------------------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------------------------

export const ObjectiveSchema = z.object({
  id: localId,
  text: z.string(),
  optional: z.boolean().optional(),
  hidden: z.boolean().optional(),
  completeWhen: ConditionSchema.nullable().optional(),
  completeOn: EventMatchSchema.nullable().optional(),
  /** Progress display "{value}/{count}" read from a variable. */
  progress: z.object({ var: z.string(), count: z.number().int().min(1) }).optional(),
  /** Entity id shown with a marker when tracked. */
  target: z.string().optional(),
  targetScene: z.string().optional(),
});
export type ObjectiveDoc = z.infer<typeof ObjectiveSchema>;

export const StageSchema = z.object({
  id: localId,
  description: z.string(),
  objectives: z.array(ObjectiveSchema),
  /** 'all' (default) or 'any' (alternative solutions). */
  completion: z.enum(['all', 'any']).default('all'),
  onComplete: z.array(ActionSchema).optional(),
  next: z.string().nullable().optional(),
});
export type StageDoc = z.infer<typeof StageSchema>;

export const QuestSchema = z.object({
  format: z.literal('civverse.quest'),
  version: z.literal(1),
  id: localId,
  title: z.string(),
  summary: z.string(),
  kind: z.enum(['main', 'side']).default('main'),
  order: z.number().default(0),
  autoStart: z.boolean().default(false),
  startWhen: ConditionSchema.nullable().optional(),
  startOn: EventMatchSchema.nullable().optional(),
  stages: z.array(StageSchema).min(1),
  onStart: z.array(ActionSchema).optional(),
  onComplete: z.array(ActionSchema).optional(),
  failWhen: ConditionSchema.nullable().optional(),
  onFail: z.array(ActionSchema).optional(),
});
export type QuestDoc = z.infer<typeof QuestSchema>;

// ---------------------------------------------------------------------------------------------
// Cinematics
// ---------------------------------------------------------------------------------------------

const easing = z.enum(EASING_NAMES as unknown as [string, ...string[]]);
const targetRef = z.union([vec3, z.string()]);

export const CameraKeySchema = z.object({
  t: z.number().min(0),
  position: vec3,
  target: vec3.optional(),
  /** Entity id or 'player' to look at (overrides target). */
  lookAt: z.string().optional(),
  fov: z.number().min(10).max(120).optional(),
  roll: z.number().optional(),
  ease: easing.optional(),
  /** Cut instead of interpolating from the previous key. */
  cut: z.boolean().optional(),
});

export const ActorKeySchema = z.object({
  t: z.number().min(0),
  moveTo: targetRef.optional(),
  speed: z.number().optional(),
  teleport: vec3.optional(),
  yaw: z.number().optional(),
  lookAt: z.union([targetRef, z.null()]).optional(),
  animation: z.string().optional(),
  expression: z.string().optional(),
  visible: z.boolean().optional(),
  say: z.string().optional(),
});

export const CinematicTrackSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('camera'), keys: z.array(CameraKeySchema) }),
  z.object({
    type: z.literal('subtitle'),
    items: z.array(z.object({ t: z.number().min(0), duration: z.number().min(0.1), speaker: z.string().optional(), text: z.string() })),
  }),
  z.object({ type: z.literal('actor'), entity: z.string(), keys: z.array(ActorKeySchema) }),
  z.object({
    type: z.literal('audio'),
    items: z.array(
      z.object({
        t: z.number().min(0),
        sound: z.string().optional(),
        music: z.string().nullable().optional(),
        at: targetRef.optional(),
        volume: z.number().optional(),
      }),
    ),
  }),
  z.object({ type: z.literal('fx'), items: z.array(z.looseObject({ t: z.number().min(0), fx: z.string() })) }),
  z.object({
    type: z.literal('actions'),
    items: z.array(z.object({ t: z.number().min(0), actions: z.array(ActionSchema), essential: z.boolean().optional() })),
  }),
]);
export type CinematicTrackDoc = z.infer<typeof CinematicTrackSchema>;

export const CinematicSchema = z.object({
  format: z.literal('civverse.cinematic'),
  version: z.literal(1),
  id: localId,
  title: z.string().optional(),
  duration: z.number().min(0.1),
  skippable: z.boolean().default(true),
  letterbox: z.boolean().default(true),
  lockPlayer: z.boolean().default(true),
  hideHud: z.boolean().default(true),
  returnCamera: z.enum(['blend', 'cut']).default('blend'),
  tracks: z.array(CinematicTrackSchema),
  onComplete: z.array(ActionSchema).optional(),
});
export type CinematicDoc = z.infer<typeof CinematicSchema>;

// ---------------------------------------------------------------------------------------------
// Logic rules
// ---------------------------------------------------------------------------------------------

export const RuleSchema = z.object({
  id: localId,
  name: z.string().optional(),
  enabled: z.boolean().default(true),
  once: z.boolean().default(false),
  /** Restricts the rule to a scene. */
  scene: z.string().optional(),
  when: EventMatchSchema,
  if: ConditionSchema.nullable().optional(),
  then: z.array(ActionSchema),
  else: z.array(ActionSchema).optional(),
});
export type RuleDoc = z.infer<typeof RuleSchema>;

export const LogicSchema = z.object({
  format: z.literal('civverse.logic'),
  version: z.literal(1),
  id: localId,
  title: z.string().optional(),
  rules: z.array(RuleSchema),
});
export type LogicDoc = z.infer<typeof LogicSchema>;

// ---------------------------------------------------------------------------------------------
// Items, characters, prefabs, rules (mechanic settings)
// ---------------------------------------------------------------------------------------------

export const IconSchema = z.object({
  shape: z.enum(ICON_SHAPES as unknown as [string, ...string[]]),
  color: hex,
  accent: hex.optional(),
  glow: z.boolean().optional(),
});

/** A mouse button of an item in hand: a registered item use and its props (see defineItemUse). */
export const ItemUseSchema = z.looseObject({ type: z.string() });

export const HeldItemSchema = z.object({
  model: z.string().optional(),
  offset: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  scale: z.number().positive().optional(),
  drawTime: z.number().min(0).optional(),
  primary: ItemUseSchema.nullable().optional(),
  secondary: ItemUseSchema.nullable().optional(),
});

export const ItemDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: IconSchema,
  category: z.enum(['key', 'quest', 'document', 'tool', 'consumable', 'equipment', 'collectible', 'misc']),
  stackable: z.boolean().optional(),
  maxStack: z.number().int().min(1).optional(),
  questItem: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  slot: z.string().optional(),
  grants: z.array(z.string()).optional(),
  held: HeldItemSchema.optional(),
  actions: z.array(z.object({ id: localId, label: z.string(), condition: ConditionSchema.nullable().optional(), actions: z.array(ActionSchema) })).optional(),
});

export const ItemsSchema = z.object({
  format: z.literal('civverse.items'),
  version: z.literal(1),
  items: z.array(ItemDocSchema),
});

export const ACCESSORY_TYPES = [
  'hat',
  'cap',
  'hood',
  'goggles',
  'glasses',
  'scarf',
  'satchel',
  'cape',
  'plaque',
  'apron',
  'badge',
  'gloves',
  'pendant',
  'helmet',
  'epaulettes',
  'belt',
  'bandana',
  'flower',
  'veil',
  'keyring',
  /** Face mask (covers the face; eye holes unless its pattern is « mirror »). */
  'mask',
  /** Half mask (eyes and nose). */
  'halfmask',
] as const;

/** Painted motif of masks (and future painted accessories). */
export const ACCESSORY_PATTERNS = ['plain', 'ember', 'threads', 'rivets', 'lens', 'ornate', 'mirror', 'split'] as const;

export const CharacterSchema = z.object({
  id: z.string(),
  /** Localization key of the display name. */
  name: z.string(),
  build: z.object({
    body: z.enum(['adult', 'slim', 'broad', 'child', 'elder']).default('adult'),
    height: z.number().min(0.6).max(1.3).default(1),
  }),
  skin: hex,
  eyes: hex,
  hair: z.object({
    style: z.enum(['short', 'long', 'bun', 'ponytail', 'curly', 'bald', 'braids', 'mohawk', 'swept', 'bob']),
    color: hex,
  }),
  face: z
    .object({
      brows: hex.optional(),
      beard: hex.nullable().optional(),
      mustache: hex.nullable().optional(),
      freckles: z.boolean().optional(),
      blush: z.boolean().optional(),
      scar: z.boolean().optional(),
      wrinkles: z.boolean().optional(),
    })
    .default({}),
  outfit: z.object({
    style: z.enum(['tunic', 'coat', 'robe', 'dress', 'vest', 'uniform', 'rags', 'shirt']),
    top: hex,
    bottom: hex,
    shoes: hex,
    accent: hex,
    trim: hex.optional(),
  }),
  accessories: z.array(z.object({ type: z.enum(ACCESSORY_TYPES), color: hex, accent: hex.optional(), pattern: z.enum(ACCESSORY_PATTERNS).optional() })).default([]),
  idle: z.enum(['calm', 'nervous', 'proud', 'tired', 'playful']).default('calm'),
  voicePitch: z.number().min(0.5).max(2).default(1),
});
export type CharacterDoc = z.infer<typeof CharacterSchema>;

export const CharactersSchema = z.object({
  format: z.literal('civverse.characters'),
  version: z.literal(1),
  characters: z.array(CharacterSchema),
});

export const PrefabSchema = z.object({
  format: z.literal('civverse.prefab'),
  version: z.literal(1),
  id: localId,
  label: z.string(),
  category: z.string().default('Divers'),
  voxels: VoxelDataSchema.optional(),
  /** Entities with positions relative to the prefab origin (min corner). */
  entities: z.array(EntityDocSchema).default([]),
});
export type PrefabDoc = z.infer<typeof PrefabSchema>;

export const RulesSchema = z.object({
  format: z.literal('civverse.rules'),
  version: z.literal(1),
  settings: z.record(z.string(), looseRecord),
});
export type RulesDoc = z.infer<typeof RulesSchema>;

export const LocaleSchema = z.record(z.string(), z.string());

/** Formats Zod issues as French lines "chemin : message". */
export function formatIssues(error: z.ZodError, prefix = ''): string[] {
  return error.issues.map((i) => {
    const path = [prefix, ...i.path.map(String)].filter(Boolean).join('.');
    return path ? `${path} : ${i.message}` : i.message;
  });
}
