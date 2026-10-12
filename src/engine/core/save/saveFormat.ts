/**
 * Save game format.
 *
 *   SaveGame
 *   ├─ global: GlobalState              (multiverse, shared by every civilization)
 *   ├─ currentCiv
 *   └─ civs: { [civId]: LocalCivState } (isolated per civilization)
 *
 * Every level is versioned: `formatVersion` (this file), `global.schemaVersion`, each civ's
 * `stateVersion` (pack-defined, migrated by the pack), and each mechanic/behavior state version.
 * A save layout, multiverse state or civilization state that cannot be migrated (or comes from a
 * newer version) aborts the load with an explicit French error. A mechanic or component state
 * without a migration falls back to its initial value, with a warning in the log. Unknown keys of
 * the save's top level, of the multiverse state and of each civilization state are kept.
 */
import { z } from 'zod';
import type { EntityDoc } from '../content/schemas';
import type { GlobalState } from '../state/multiverse';
import { GLOBAL_SCHEMA_VERSION } from '../state/multiverse';
import type { QuestState } from '../story/quests';
import type { JsonValue } from '../util/json';

export const SAVE_FORMAT = 'civverse.save';
export const SAVE_FORMAT_VERSION = 1;

export interface VersionedState {
  version: number;
  state: unknown;
}

export interface EntityState {
  position?: [number, number, number];
  yaw?: number;
  visible?: boolean;
  enabled?: boolean;
  overrides?: Record<string, Record<string, JsonValue>>;
  states?: Record<string, VersionedState>;
}

export interface SceneState {
  entities: Record<string, EntityState>;
  /** Persistent entities spawned at runtime. */
  spawned: EntityDoc[];
  /** Scene entities removed at runtime. */
  removed: string[];
  /** Runtime voxel edits: [x, y, z, blockId | null]. */
  voxelEdits: [number, number, number, string | null][];
}

export interface LocalCivState {
  civId: string;
  packVersion: string;
  stateVersion: number;
  savedAt: string;
  scene: string;
  player: {
    position: [number, number, number];
    yaw: number;
    pitch: number;
    abilities: string[];
    title: string | null;
  };
  vars: Record<string, JsonValue>;
  inventory: { id: string; count: number }[];
  quests: { states: Record<string, QuestState>; tracked: string | null };
  dialogue: { seen: string[]; chosen: string[] };
  rulesFired: string[];
  mechanics: Record<string, VersionedState>;
  scenes: Record<string, SceneState>;
  playTime: number;
}

export interface SaveGame {
  format: typeof SAVE_FORMAT;
  formatVersion: number;
  engineVersion: string;
  savedAt: string;
  slot: string;
  label: string;
  global: GlobalState;
  currentCiv: string | null;
  civs: Record<string, LocalCivState>;
}

const versioned = z.object({ version: z.number().int(), state: z.unknown() });

const LocalCivStateSchema = z.looseObject({
  civId: z.string(),
  packVersion: z.string(),
  stateVersion: z.number().int(),
  savedAt: z.string(),
  scene: z.string(),
  player: z.looseObject({
    position: z.tuple([z.number(), z.number(), z.number()]),
    yaw: z.number(),
    pitch: z.number(),
    abilities: z.array(z.string()),
    title: z.string().nullable(),
  }),
  vars: z.record(z.string(), z.unknown()),
  inventory: z.array(z.object({ id: z.string(), count: z.number() })),
  quests: z.object({ states: z.record(z.string(), z.unknown()), tracked: z.string().nullable() }),
  dialogue: z.object({ seen: z.array(z.string()), chosen: z.array(z.string()) }),
  rulesFired: z.array(z.string()),
  mechanics: z.record(z.string(), versioned),
  scenes: z.record(z.string(), z.unknown()),
  playTime: z.number(),
});

export const SaveGameSchema = z.looseObject({
  format: z.literal(SAVE_FORMAT),
  formatVersion: z.number().int(),
  engineVersion: z.string(),
  savedAt: z.string(),
  slot: z.string(),
  label: z.string(),
  global: z.looseObject({
    schemaVersion: z.number().int(),
    protagonist: z.looseObject({ awakenings: z.number(), title: z.string().nullable(), createdAt: z.string() }),
    fragments: z.record(z.string(), z.object({ civ: z.string(), acquiredAt: z.string() })),
    flags: z.record(z.string(), z.unknown()),
    civs: z.record(z.string(), z.unknown()),
  }),
  currentCiv: z.string().nullable(),
  civs: z.record(z.string(), LocalCivStateSchema),
});

export class SaveLoadError extends Error {}

/**
 * Engine-level save migrations: migrations[n] upgrades formatVersion n → n + 1.
 * Version 1 is the first format; add entries here when the save layout changes.
 */
const FORMAT_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};
const GLOBAL_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

/** Validates and upgrades raw save data. Throws SaveLoadError with a French message on failure. */
export function parseSave(raw: unknown): { save: SaveGame; warnings: string[] } {
  const warnings: string[] = [];
  if (typeof raw !== 'object' || raw === null) throw new SaveLoadError('Sauvegarde illisible (données absentes).');
  let data = structuredClone(raw) as Record<string, unknown>;
  if (data.format !== SAVE_FORMAT) throw new SaveLoadError('Ce fichier n’est pas une sauvegarde CIVILIZATIONVERSE.');
  let v = Number(data.formatVersion);
  if (!Number.isInteger(v) || v < 1) throw new SaveLoadError('Version de sauvegarde invalide.');
  if (v > SAVE_FORMAT_VERSION) {
    throw new SaveLoadError(`Sauvegarde créée par une version plus récente du jeu (format ${v}). Mettez le jeu à jour.`);
  }
  while (v < SAVE_FORMAT_VERSION) {
    const m = FORMAT_MIGRATIONS[v];
    if (!m) throw new SaveLoadError(`Aucune migration de sauvegarde depuis le format ${v}.`);
    data = m(data);
    v++;
    data.formatVersion = v;
    warnings.push(`Sauvegarde migrée vers le format ${v}.`);
  }
  const global = data.global as Record<string, unknown> | undefined;
  if (global) {
    let gv = Number(global.schemaVersion);
    if (gv > GLOBAL_SCHEMA_VERSION) {
      throw new SaveLoadError(`État multivers créé par une version plus récente du jeu (version ${gv}). Mettez le jeu à jour.`);
    }
    while (gv < GLOBAL_SCHEMA_VERSION) {
      const m = GLOBAL_MIGRATIONS[gv];
      if (!m) throw new SaveLoadError(`Aucune migration de l'état multivers depuis la version ${gv}.`);
      data.global = m(data.global as Record<string, unknown>);
      gv++;
      (data.global as Record<string, unknown>).schemaVersion = gv;
    }
  }
  const parsed = SaveGameSchema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ');
    throw new SaveLoadError(`Sauvegarde corrompue ou incompatible : ${details}`);
  }
  return { save: parsed.data as unknown as SaveGame, warnings };
}

/**
 * Upgrades a civilization's local state with the pack's migrations
 * (migrations[n] converts stateVersion n into n + 1).
 */
export function migrateCivState(
  state: LocalCivState,
  targetVersion: number,
  migrations: Record<number, (s: LocalCivState) => LocalCivState> | undefined,
): { state: LocalCivState; warnings: string[] } {
  const warnings: string[] = [];
  let s = structuredClone(state);
  if (s.stateVersion > targetVersion) {
    throw new SaveLoadError(
      `La sauvegarde de « ${s.civId} » provient d'une version plus récente de la civilisation (état ${s.stateVersion} > ${targetVersion}).`,
    );
  }
  while (s.stateVersion < targetVersion) {
    const from = s.stateVersion;
    const m = migrations?.[from];
    if (!m) throw new SaveLoadError(`Aucune migration d’état pour « ${s.civId} » depuis la version ${from}.`);
    // The version is set here, whatever the migration did with it.
    s = { ...m(s), stateVersion: from + 1 };
    warnings.push(`État de « ${s.civId} » migré vers la version ${s.stateVersion}.`);
  }
  return { state: s, warnings };
}

/** Applies a definition's state migrations (mechanics and behaviors). */
export function migrateVersioned<S>(
  saved: VersionedState | undefined,
  spec: { version: number; migrate?: Record<number, (old: unknown) => unknown> } | undefined,
  fallback: () => S,
  label: string,
  warn: (msg: string) => void,
): S {
  if (!saved || !spec) return fallback();
  let { version, state } = saved;
  if (version > spec.version) {
    warn(`${label} : état sauvegardé plus récent (v${version} > v${spec.version}), valeurs par défaut utilisées.`);
    return fallback();
  }
  while (version < spec.version) {
    const m = spec.migrate?.[version];
    if (!m) {
      warn(`${label} : pas de migration depuis v${version}, valeurs par défaut utilisées.`);
      return fallback();
    }
    state = m(state);
    version++;
  }
  return state as S;
}
