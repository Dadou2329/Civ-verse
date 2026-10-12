/**
 * Civilization pack code entry (`civilizations/<id>/pack.ts`) and content loading.
 *
 * A pack directory contains:
 *   manifest.json            identity, version, engine API, scenes, permissions, theme
 *   pack.ts                  definePack({ modules: import.meta.glob([...], { eager: true }) })
 *   mechanics/ ui/ models/   code modules (auto-discovered; each exports define*() values)
 *   content/                 scenes, dialogues, quests, cinematics, logic, items, characters,
 *                            prefabs, rules.json (Studio-editable JSON)
 *   locales/fr-FR.json       string table (French is required)
 */
import type { CollectedDefinitions, ItemDefinition } from './definitions';
import { collectDefinitions } from './definitions';
import type { LocalCivState } from '../save/saveFormat';
import {
  CharactersSchema,
  CinematicSchema,
  DialogueSchema,
  ItemsSchema,
  LocaleSchema,
  LogicSchema,
  ManifestSchema,
  PrefabSchema,
  QuestSchema,
  RulesSchema,
  SceneSchema,
  formatIssues,
  type CharacterDoc,
  type CinematicDoc,
  type DialogueDoc,
  type LogicDoc,
  type PackManifest,
  type PrefabDoc,
  type QuestDoc,
  type RulesDoc,
  type SceneDoc,
} from '../content/schemas';
import type { z } from 'zod';
import type { StringTable } from '../i18n/localizer';
import { ASSET_ID_RE, TYPE_ID_RE, packOfAsset, packOfType } from '../util/ids';

export interface PackModule {
  readonly __kind: 'pack';
  /** Code modules (usually `import.meta.glob([...], { eager: true })`). */
  modules: Record<string, unknown>;
  /** Migrations of the local save state: migrations[n] converts stateVersion n → n + 1. */
  migrations?: Record<number, (state: LocalCivState) => LocalCivState>;
}

export function definePack(def: Omit<PackModule, '__kind'>): PackModule {
  return { __kind: 'pack', ...def };
}

/** Where packs and their content come from (bundled game, Studio dev API, in-memory overlay). */
export interface ContentProvider {
  listManifests(): Promise<unknown[]>;
  loadPackModule(packId: string): Promise<PackModule>;
  /** Content files of a pack, relative to the pack root ("content/scenes/verrou.scene.json"). */
  listFiles(packId: string): Promise<string[]>;
  readJson(packId: string, relPath: string): Promise<unknown>;
}

export interface ContentIssue {
  pack: string;
  file: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface LoadedPack {
  manifest: PackManifest;
  module: PackModule;
  defs: CollectedDefinitions;
  dialogues: Map<string, DialogueDoc>;
  quests: Map<string, QuestDoc>;
  cinematics: Map<string, CinematicDoc>;
  logic: LogicDoc[];
  items: ItemDefinition[];
  characters: Map<string, CharacterDoc>;
  prefabs: Map<string, PrefabDoc>;
  rules: RulesDoc;
  locales: Map<string, StringTable>;
  /** sceneId → relative file path. */
  scenes: Map<string, string>;
  files: string[];
  issues: ContentIssue[];
}

const KIND_PATTERNS: { re: RegExp; kind: string }[] = [
  { re: /^content\/scenes\/([A-Za-z0-9_-]+)\.scene\.json$/, kind: 'scene' },
  { re: /^content\/dialogues\/([A-Za-z0-9_-]+)\.dialogue\.json$/, kind: 'dialogue' },
  { re: /^content\/quests\/([A-Za-z0-9_-]+)\.quest\.json$/, kind: 'quest' },
  { re: /^content\/cinematics\/([A-Za-z0-9_-]+)\.cinematic\.json$/, kind: 'cinematic' },
  { re: /^content\/logic\/([A-Za-z0-9_-]+)\.logic\.json$/, kind: 'logic' },
  { re: /^content\/prefabs\/([A-Za-z0-9_-]+)\.prefab\.json$/, kind: 'prefab' },
  { re: /^content\/items\.json$/, kind: 'items' },
  { re: /^content\/characters\.json$/, kind: 'characters' },
  { re: /^content\/rules\.json$/, kind: 'rules' },
  { re: /^locales\/([a-z]{2}-[A-Z]{2})\.json$/, kind: 'locale' },
];

export function classifyContentPath(relPath: string): { kind: string; id: string | null } | null {
  for (const { re, kind } of KIND_PATTERNS) {
    const m = re.exec(relPath);
    if (m) return { kind, id: m[1] ?? null };
  }
  return null;
}

export function validateManifest(raw: unknown, file = 'manifest.json'): { manifest: PackManifest | null; issues: string[] } {
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) return { manifest: null, issues: formatIssues(parsed.error, file) };
  return { manifest: parsed.data, issues: [] };
}

function parseWith<S extends z.ZodType>(schema: S, raw: unknown, pack: string, file: string, issues: ContentIssue[]): z.infer<S> | null {
  const r = schema.safeParse(raw);
  if (!r.success) {
    for (const m of formatIssues(r.error)) issues.push({ pack, file, severity: 'error', message: m });
    return null;
  }
  return r.data;
}

/** Loads and validates everything of a pack except scenes (loaded on demand). */
export async function loadPack(provider: ContentProvider, manifest: PackManifest): Promise<LoadedPack> {
  const id = manifest.id;
  const issues: ContentIssue[] = [];
  const module = await provider.loadPackModule(id);
  if (module.__kind !== 'pack') throw new Error(`pack.ts de "${id}" doit exporter definePack(...) par défaut.`);
  const defs = collectDefinitions(module.modules);
  const issues0 = checkDefinitionIds(id, defs);
  const files = await provider.listFiles(id);
  const out: LoadedPack = {
    manifest,
    module,
    defs,
    dialogues: new Map(),
    quests: new Map(),
    cinematics: new Map(),
    logic: [],
    items: [...defs.items],
    characters: new Map(),
    prefabs: new Map(),
    rules: { format: 'civverse.rules', version: 1, settings: {} },
    locales: new Map(),
    scenes: new Map(),
    files,
    issues,
  };
  issues.push(...issues0);
  const loads: Promise<void>[] = [];
  for (const file of files) {
    const cls = classifyContentPath(file);
    if (!cls) continue;
    if (cls.kind === 'scene') {
      out.scenes.set(cls.id!, file);
      continue;
    }
    loads.push(
      (async () => {
        let raw: unknown;
        try {
          raw = await provider.readJson(id, file);
        } catch (err) {
          issues.push({ pack: id, file, severity: 'error', message: `Lecture impossible : ${(err as Error).message}` });
          return;
        }
        const checkId = (docId: string) => {
          if (cls.id && docId !== cls.id) {
            issues.push({ pack: id, file, severity: 'warning', message: `L’identifiant "${docId}" ne correspond pas au nom du fichier.` });
          }
        };
        switch (cls.kind) {
          case 'dialogue': {
            const d = parseWith(DialogueSchema, raw, id, file, issues);
            if (d) {
              checkId(d.id);
              out.dialogues.set(d.id, d);
            }
            break;
          }
          case 'quest': {
            const d = parseWith(QuestSchema, raw, id, file, issues);
            if (d) {
              checkId(d.id);
              out.quests.set(d.id, d);
            }
            break;
          }
          case 'cinematic': {
            const d = parseWith(CinematicSchema, raw, id, file, issues);
            if (d) {
              checkId(d.id);
              out.cinematics.set(d.id, d);
            }
            break;
          }
          case 'logic': {
            const d = parseWith(LogicSchema, raw, id, file, issues);
            if (d) {
              checkId(d.id);
              out.logic.push(d);
            }
            break;
          }
          case 'prefab': {
            const d = parseWith(PrefabSchema, raw, id, file, issues);
            if (d) {
              checkId(d.id);
              out.prefabs.set(d.id, d);
            }
            break;
          }
          case 'items': {
            const d = parseWith(ItemsSchema, raw, id, file, issues);
            if (d) for (const item of d.items) out.items.push({ __kind: 'item', ...item } as ItemDefinition);
            break;
          }
          case 'characters': {
            const d = parseWith(CharactersSchema, raw, id, file, issues);
            if (d) for (const c of d.characters) out.characters.set(c.id, c);
            break;
          }
          case 'rules': {
            const d = parseWith(RulesSchema, raw, id, file, issues);
            if (d) out.rules = d;
            break;
          }
          case 'locale': {
            const d = parseWith(LocaleSchema, raw, id, file, issues);
            if (d) out.locales.set(cls.id!, d);
            break;
          }
        }
      })(),
    );
  }
  await Promise.all(loads);
  out.logic.sort((a, b) => a.id.localeCompare(b.id));
  if (manifest.kind === 'civilization' && !out.locales.has('fr-FR')) {
    issues.push({ pack: id, file: 'locales/fr-FR.json', severity: 'error', message: 'Table de traduction française obligatoire manquante.' });
  }
  for (const sceneId of manifest.scenes) {
    if (!out.scenes.has(sceneId)) {
      issues.push({ pack: id, file: 'manifest.json', severity: 'error', message: `Scène déclarée introuvable : ${sceneId}` });
    }
  }
  return out;
}

export async function loadSceneDoc(provider: ContentProvider, pack: LoadedPack, sceneId: string): Promise<SceneDoc> {
  const file = pack.scenes.get(sceneId);
  if (!file) throw new Error(`Scène inconnue dans "${pack.manifest.id}" : ${sceneId}`);
  const raw = await provider.readJson(pack.manifest.id, file);
  const r = SceneSchema.safeParse(raw);
  if (!r.success) throw new Error(`Scène ${sceneId} invalide :\n${formatIssues(r.error, file).slice(0, 8).join('\n')}`);
  return r.data;
}

/**
 * Identifier conventions of a pack's definitions (src/engine/core/util/ids.ts): types (behaviors,
 * actions, conditions, events, mechanics, abilities, HUD elements, panels, visuals, view effects)
 * are "<pack>.<name>", assets (blocks, models, sounds, music, items) are "<pack>:<name>" — with
 * the pack's own id, so that two packs can never register the same name.
 */
export function checkDefinitionIds(packId: string, defs: CollectedDefinitions): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const types = [...defs.mechanics, ...defs.behaviors, ...defs.actions, ...defs.conditions, ...defs.events, ...defs.abilities, ...defs.huds, ...defs.panels, ...defs.visuals, ...defs.viewEffects, ...defs.itemUses];
  const assets = [...defs.blocks, ...defs.models, ...defs.sounds, ...defs.music, ...defs.items];
  for (const d of types) {
    if (!TYPE_ID_RE.test(d.id) || packOfType(d.id) !== packId) issues.push({ pack: packId, file: 'pack.ts', severity: 'error', message: `Identifiant « ${d.id} » : « ${packId}.<nom> » attendu.` });
  }
  for (const d of assets) {
    if (!ASSET_ID_RE.test(d.id) || packOfAsset(d.id) !== packId) issues.push({ pack: packId, file: 'pack.ts', severity: 'error', message: `Identifiant « ${d.id} » : « ${packId}:<nom> » attendu.` });
  }
  return issues;
}
