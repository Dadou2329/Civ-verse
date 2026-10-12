# Versioning

This document lists every version number used by CIVILIZATIONVERSE (engine, SDK/runtime API,
civilization packs, content documents, saves), the compatibility checks the code performs, and the
rules for changing them. Statements about behavior are taken from the code; paths are relative to
the repository root. Sections and items marked **Policy** are recommendations: the code does not
enforce them.

Main sources: `src/engine/core/version.ts`, `src/engine/core/util/semver.ts`,
`src/engine/core/content/schemas.ts`, `src/engine/core/packs/pack.ts`,
`src/engine/core/packs/definitions.ts`, `src/engine/core/sim/session.ts`,
`src/engine/core/save/saveFormat.ts`, `src/engine/core/state/multiverse.ts`,
`tools/cli/validateRunner.ts`, `tools/cli/newPack.ts`, `package.json`,
`civilizations/*/manifest.json`.

The save format and its migrations are described in detail in [SAVE_FORMAT.md](SAVE_FORMAT.md).

## Contents

1. [Version identifiers at a glance](#1-version-identifiers-at-a-glance)
2. [What each version means](#2-what-each-version-means)
3. [Compatibility checks at load time](#3-compatibility-checks-at-load-time)
4. [Bumping rules](#4-bumping-rules)
5. [Writing migrations](#5-writing-migrations)
6. [Deprecation policy (recommendations)](#6-deprecation-policy-recommendations)
7. [Changelog](#7-changelog)
8. [Limitations and known gaps](#8-limitations-and-known-gaps)

## 1. Version identifiers at a glance

| Identifier | Current value | Defined in | Form | Checked when loading |
|---|---|---|---|---|
| `ENGINE_VERSION` | `'0.1.0'` | `src/engine/core/version.ts` | semver | No. Written into saves as `engineVersion`; exported by `@sdk`. |
| `version` | `"0.1.0"` | `package.json` | semver | No. Read only by acceptance test J, which checks that it equals `ENGINE_VERSION`. |
| `ENGINE_API_VERSION` | `'1.0.0'` | `src/engine/core/version.ts` | semver | Yes, against each manifest's `engineApi`. |
| `engineApi` | `"^1.0.0"` (core, door, memory) | `civilizations/<id>/manifest.json` | semver range (subset, section 2.3) | Yes. |
| `packVersion` | `"0.1.0"` (core, door, memory) | `civilizations/<id>/manifest.json` | `x.y.z`, optional pre-release suffix | Syntax only. Copied into saves, never compared. |
| `stateVersion` | `1` (core, door, memory) | `civilizations/<id>/manifest.json` | integer ≥ 1, default 1 | Yes, against saved local states. |
| `format` / `version` of the manifest | `"civverse.pack"` / `1` | `civilizations/<id>/manifest.json` | literals | Yes (`ManifestSchema`). |
| `format` / `version` of content documents | 9 formats, all `1` | content JSON files | literals | Yes (schemas in `schemas.ts`). |
| Voxel `encoding` | `'rle16-b64'` (`VOXEL_ENCODING`) | `src/engine/core/voxel/codec.ts` | string id | Yes. |
| `SAVE_FORMAT` / `SAVE_FORMAT_VERSION` | `'civverse.save'` / `1` | `src/engine/core/save/saveFormat.ts` | literal / integer | Yes (`parseSave()`). |
| `GLOBAL_SCHEMA_VERSION` | `1` | `src/engine/core/state/multiverse.ts` | integer | Yes (`parseSave()`): older values migrated, newer values refused. |
| `state.version` of mechanics and behaviors | `1` for every definition of the engine and the shipped packs | each `defineMechanic` / `defineBehavior` | integer | Yes (`migrateVersioned()`), with fallback to the initial state. |
| Settings storage key | `civverse.settings.v1` | `src/engine/platform/settings.ts` | key suffix | No migration: stored values are merged over the defaults. |

## 2. What each version means

### 2.1 `ENGINE_VERSION` and `package.json`

```ts
// src/engine/core/version.ts
/** Engine version (semver). Bump on every release. */
export const ENGINE_VERSION = '0.1.0';
```

- `GameSession.buildSaveGame()` writes it into `SaveGame.engineVersion`.
- `src/sdk/index.ts` re-exports it, so packs can read it.
- It is not displayed in the game and not compared with anything on load.
- `package.json` has the same value (`"version": "0.1.0"`). The two are kept in step by hand;
  acceptance test J (`tests/acceptance/J-regression.test.ts`) fails when they differ. Nothing else
  reads the `package.json` version.

### 2.2 `ENGINE_API_VERSION` and the public API

```ts
// src/engine/core/version.ts
/**
 * Version of the public SDK/runtime API that packs target (`engineApi` in manifest.json).
 * Bump the major version on breaking API changes and document migrations in docs/VERSIONING.md.
 */
export const ENGINE_API_VERSION = '1.0.0';
```

What packs depend on:

- **SDK modules.** Pack code may only import the SDK. `eslint.config.js` applies
  `no-restricted-imports` to `civilizations/**/*.{ts,tsx}` (seeds and tests excluded), forbidding
  `@engine/*`, `../../src/*`, `../../../src/*`, `@studio/*` and `@game/*`. The SDK modules are:
  - `@sdk` → `src/sdk/index.ts`: `definePack`, the `define*` helpers, `prop`, the runtime context
    types of `src/engine/core/sim/api.ts`, the event map, `LocalCivState`, `ENGINE_VERSION`,
    `ENGINE_API_VERSION`, math and color utilities;
  - `@sdk/ui` → `src/sdk/ui.tsx` (HUD elements and panels, and `keyLabel` for showing a key);
  - `@sdk/view` → `src/sdk/view.ts` (custom rendering);
  - `@sdk/build` → `src/sdk/build.ts` (scene building for seed scripts).
- **Runtime contexts.** `src/engine/core/sim/api.ts` describes itself as the "public runtime API seen
  by civilization code": `CivContext`, `BehaviorContext`, `EntityApi`, `WorldApi`, and so on.
- **Engine definitions referenced by content.** Pack JSON uses behaviors, actions, conditions and
  events that the engine registers itself with owner `"engine"` (`registerEngineBuiltins()` in
  `src/engine/core/sim/builtins.ts`): `core.door`, `core.npc`, `core.setVar`, `core.grantFragment`,
  `civ.started`, ... The code does not say whether these ids and their props are covered by
  `ENGINE_API_VERSION`; section 4.2 treats them as covered (**Policy**).

Versioned separately: content document formats (section 2.6), the save format (section 2.8), and
the assets of the `core` library pack (`core:*` blocks, models and sounds, versioned by
`civilizations/core/manifest.json`), although some engine behaviors use them as prop defaults
(`core.door` defaults to model `core:door_wood` and sound `core:door_open`).

### 2.3 `engineApi` (manifest)

```ts
// src/engine/core/content/schemas.ts (ManifestSchema)
/** Semver range of the engine API this pack was written for. */
engineApi: z.string(),
```

The value is checked with `satisfies(ENGINE_API_VERSION, manifest.engineApi)`
(`src/engine/core/util/semver.ts`), which supports a subset of npm ranges:

| Range | Accepts | Note |
|---|---|---|
| `*` or empty string | any version | |
| `1.2.3`, `=1.2.3` | exactly `1.2.3` | |
| `>=1.2.3`, `>1.2.3`, `<=1.2.3`, `<1.2.3` | comparison | A space after the operator is allowed. |
| `~1.2.3` | `>=1.2.3` with the same major and minor | |
| `^1.2.3` | `>=1.2.3` with the same major | |
| `^0.2.3` | `>=0.2.3` with major 0 and minor 2 | Major 0 locks the minor. |
| `^0.0.3` | `>=0.0.3` with major 0 and minor 0 | npm accepts only `0.0.3`; here `0.0.5` is accepted too. |

Not supported, and therefore never satisfied (the pack is rejected): partial versions (`^1.0`,
`1`), wildcards inside a version (`1.x`), hyphen ranges, compound ranges (`>=1.0.0 <2.0.0`) and
alternatives (`^1.0.0 || ^2.0.0`). Pre-release and build suffixes are ignored on both sides:
`1.0.0-beta.1` satisfies `1.0.0`. `src/engine/core/util/semver.test.ts` tests the supported
operators and the rejection of compound ranges and x-ranges.

### 2.4 `packVersion` (manifest)

```ts
// src/engine/core/content/schemas.ts (ManifestSchema)
packVersion: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, { error: 'Version x.y.z attendue (ex. 1.2.0)' }),
```

- The regex is anchored: `1.0.0` and `1.0.0-beta.1` pass; `1.0`, `1.0.0abc` and build metadata
  (`1.0.0+build`) are refused with `Version x.y.z attendue (ex. 1.2.0)`.
- `snapshotCivState()` copies it into each saved `LocalCivState.packVersion`. No code compares it,
  in saves or between packs.
- Studio's manifest editor shows it as « Version du pack » (`src/studio/editors/ManifestEditor.tsx`).
  `npm run civ -- new-pack <id>` creates it as `0.1.0`.

### 2.5 `stateVersion` (manifest)

```ts
// src/engine/core/content/schemas.ts (ManifestSchema)
/** Version of the pack's local save state (bump + migrate when it changes). */
stateVersion: z.number().int().min(1).default(1),
```

```ts
// src/engine/core/packs/pack.ts
export interface PackModule {
  readonly __kind: 'pack';
  /** Code modules (usually `import.meta.glob([...], { eager: true })`). */
  modules: Record<string, unknown>;
  /** Migrations of the local save state: migrations[n] converts stateVersion n → n + 1. */
  migrations?: Record<number, (state: LocalCivState) => LocalCivState>;
}
```

- `snapshotCivState()` writes it into `LocalCivState.stateVersion`.
- `loadCivilization()` calls `migrateCivState(saved, manifest.stateVersion, pack.module.migrations)`.
- It only matters for `kind: "civilization"` packs: library packs have no local state.
- Studio's manifest editor shows it as « Version de l’état » (an integer, at least 1).

### 2.6 Content document `format` and `version`

The header of `src/engine/core/content/schemas.ts`:

> Every content file carries `format` and `version` so that future engine updates can migrate
> old files. All formats are at version 1 and no content migration exists yet: a format change
> must add one (see docs/VERSIONING.md). The Studio reads and writes exactly these shapes.

How such a migration could be added is described in section 5.2.

| `format` | Files | Schema |
|---|---|---|
| `civverse.pack` | `manifest.json` | `ManifestSchema` |
| `civverse.scene` | `content/scenes/<id>.scene.json` | `SceneSchema` |
| `civverse.dialogue` | `content/dialogues/<id>.dialogue.json` | `DialogueSchema` |
| `civverse.quest` | `content/quests/<id>.quest.json` | `QuestSchema` |
| `civverse.cinematic` | `content/cinematics/<id>.cinematic.json` | `CinematicSchema` |
| `civverse.logic` | `content/logic/<id>.logic.json` | `LogicSchema` |
| `civverse.prefab` | `content/prefabs/<id>.prefab.json` | `PrefabSchema` |
| `civverse.items` | `content/items.json` | `ItemsSchema` |
| `civverse.characters` | `content/characters.json` | `CharactersSchema` |
| `civverse.rules` | `content/rules.json` | `RulesSchema` |

Locale tables (`locales/<ll-CC>.json`) have no `format` or `version`: they are flat
`Record<string, string>` objects (`LocaleSchema`).

Every schema declares `version: z.literal(1)`, so a file is accepted only when `version` is exactly
`1`. Any other value is reported like any other schema error.

The value `1` is also written as a literal wherever documents are created:

- `src/studio/panels/Explorer.tsx` (new scene, dialogue, quest, cinematic, logic file);
- `src/studio/viewport/ViewportPanel.tsx` (new prefab);
- `src/sdk/build.ts` (`SceneBuilder`, used by seed scripts);
- `tools/cli/newPack.ts` (manifest and starting scene of a new pack);
- `civilizations/door/seed/cinematics.ts`, `civilizations/memory/seed/cinematics.ts`;
- `src/engine/core/packs/pack.ts` (default rules document when `content/rules.json` is absent).

### 2.7 Voxel encoding

```ts
// src/engine/core/voxel/codec.ts
/**
 * Voxel data codec: run-length encoding of palette indices with LEB128 varints, stored as base64.
 * Format id "rle16-b64". Worlds of ~1.6 M cells typically encode to 30–200 KB.
 */
export const VOXEL_ENCODING = 'rle16-b64';
```

The `voxels.encoding` of scenes and prefabs must be `'rle16-b64'` (`z.literal('rle16-b64')` in
`VoxelDataSchema`), and `volumeFromDoc()` (`src/engine/core/world/sceneVoxels.ts`) throws
`Encodage voxel inconnu : <encoding>` for any other value.

### 2.8 Save versions

| Version | Where | Meaning |
|---|---|---|
| `formatVersion` | `SaveGame`, target `SAVE_FORMAT_VERSION` | Layout of the save document. |
| `global.schemaVersion` | `GlobalState`, target `GLOBAL_SCHEMA_VERSION` | Layout of the multiverse state. |
| `civs.<id>.stateVersion` | `LocalCivState`, target = manifest `stateVersion` | Meaning of a pack's saved local state. |
| `version` of a `VersionedState` | mechanic and component states, target = definition `state.version` | Shape of one mechanic's or component's state. |
| `engineVersion`, `civs.<id>.packVersion` | `SaveGame`, `LocalCivState` | Recorded only. |

```ts
// src/engine/core/packs/definitions.ts
export interface StateSpec<S> {
  /** Increment when the state shape changes; provide a migration for the previous version. */
  version: number;
  initial: () => S;
  /** migrate[n] converts a state saved at version n into version n + 1. */
  migrate?: Record<number, (old: unknown) => unknown>;
}

export interface BehaviorStateSpec<P, S> {
  version: number;
  initial: (props: P) => S;
  migrate?: Record<number, (old: unknown) => unknown>;
}
```

See [SAVE_FORMAT.md, section 8](SAVE_FORMAT.md#8-versions-and-migrations) for the exact behavior
of each level.

## 3. Compatibility checks at load time

### 3.1 Pack manifests: `GameSession.refreshManifests()`

Runs when a session is created (`GameSession.create()`) and when Civilization Studio opens a pack
(`Studio.openPack()`) or reloads one (`GameSession.reloadPack()`).

```ts
// src/engine/core/sim/session.ts (refreshManifests)
const { manifest, issues } = validateManifest(raw, `${id}/manifest.json`);
if (!manifest) {
  this.manifestIssues.set(id, issues);
  this.log.error(`Manifeste invalide pour "${id}" :\n${issues.join('\n')}`);
  continue;
}
if (!satisfies(ENGINE_API_VERSION, manifest.engineApi)) {
  const msg = `Le pack "${id}" requiert l’API ${manifest.engineApi} (moteur : ${ENGINE_API_VERSION}).`;
  this.manifestIssues.set(id, [msg]);
  this.log.error(msg);
  continue;
}
this.manifests.set(manifest.id, manifest);
```

`validateManifest()` checks the manifest against `ManifestSchema` (`format`, `version`,
`packVersion` syntax, `stateVersion`, ...). A rejected pack:

- is not added to `session.manifests`, so it is not offered on the civilization selection screen;
  that screen shows `ui.civs.invalidPacks` with the number of rejected packs;
- makes every pack that depends on it fail to load: `ensurePack()` throws
  `Pack introuvable ou invalide : "<id>".`;
- makes `npm run validate` print `✗ <id>/manifest.json : <message>`, count an error and exit with
  code 1 (`tools/cli/validateRunner.ts`).

Packs are bundled into the game build (`src/engine/platform/globContent.ts` loads
`/civilizations/*/manifest.json` with `import.meta.glob`), so in practice this check runs against
the packs of the same repository.

### 3.2 Dependencies: `ensurePack()`

`dependencies` lists pack ids only; a manifest cannot express which version of a dependency it
needs. A missing or rejected dependency fails with `Pack introuvable ou invalide : "<id>".`, and a
cycle fails with `Dépendance circulaire entre packs : a → b → a`.

### 3.3 Content documents: `loadPack()` and `loadSceneDoc()`

- `loadPack()` (`src/engine/core/packs/pack.ts`) validates every content file with its schema
  (`parseWith()`). An invalid file, including one with an unexpected `format` or `version`, is
  skipped and reported as a `ContentIssue` of severity `error`. The pack still loads.
  `GameSession.adoptPack()` (called by `ensurePack()` and `reloadPack()`) logs the issues;
  `npm run validate` and the Studio's diagnostics report them.
- Scenes are validated when they are entered: `loadSceneDoc()` throws
  `Scène <id> invalide :` followed by the first 8 issues.
- Voxel data is decoded by `volumeFromDoc()` when a `SceneWorld` is created, which checks the
  encoding (section 2.7).

### 3.4 Saves

| Check | Where | On failure |
|---|---|---|
| `format === 'civverse.save'` | `parseSave()` | Load refused |
| `formatVersion` integer, `1 ≤ formatVersion ≤ SAVE_FORMAT_VERSION` | `parseSave()` | Load refused |
| Layout migrations from `formatVersion` | `parseSave()` | Load refused when a step is missing |
| `global.schemaVersion ≤ GLOBAL_SCHEMA_VERSION`, then multiverse migrations from it | `parseSave()` | Load refused when newer or when a step is missing |
| Structure (`SaveGameSchema`) | `parseSave()` | Load refused, first 5 issues in the message |
| `stateVersion` vs manifest `stateVersion` | `migrateCivState()` in `loadCivilization()` | Load refused when newer or when a step is missing |
| Mechanic and component `version` vs definition `state.version` | `migrateVersioned()` | Warning, initial state used |

Messages and details: [SAVE_FORMAT.md, section 9](SAVE_FORMAT.md#9-error-handling).

### 3.5 Not checked

- A save's `engineVersion` against `ENGINE_VERSION`.
- A save's `packVersion` against the pack's `packVersion`.
- `ENGINE_VERSION` against `package.json` (only acceptance test J compares them).
- The versions of dependency packs.
- The content of scene states (entity and component states included), quest states,
  per-civilization progress (`global.civs`) and mechanic states (the `state` of each
  `VersionedState`): `SaveGameSchema` declares them as `z.unknown()`.
- Saved states of mechanics or abilities that the pack no longer defines: they are dropped
  silently.

## 4. Bumping rules

Each subsection quotes what the code says, then gives the recommended rule.

### 4.1 `ENGINE_VERSION`

Code: "Engine version (semver). Bump on every release."

**Policy:**

- MAJOR: a release that drops support players or pack authors relied on, for example removing a
  save or content migration step, or raising the major of `ENGINE_API_VERSION`.
- MINOR: new features, including a new save or document version that comes with its migration.
- PATCH: fixes only.
- Change `package.json` `version` in the same commit, and add a changelog entry (section 7).

### 4.2 `ENGINE_API_VERSION`

Code: "Bump the major version on breaking API changes and document migrations in
docs/VERSIONING.md."

**Policy:**

| Change | Bump |
|---|---|
| Removing or renaming an export of `@sdk`, `@sdk/ui`, `@sdk/view` or `@sdk/build`; changing a signature or the meaning of a context method; removing or renaming an engine-registered behavior, action, condition or event (`core.*`, `civ.*`, ...), one of its props or event payload fields; changing a prop's type, default or meaning | MAJOR |
| Adding an export, an optional method or field, a new engine definition, or an optional prop whose default keeps the previous behavior | MINOR |
| Fixes that keep signatures and documented meaning | PATCH |

Effect on existing packs, which all declare `"engineApi": "^1.0.0"`: any `1.x.y` engine API is
accepted; `2.0.0` makes every pack fail the check (and `npm run validate` fail) until its
`engineApi` is updated. `npm run civ -- new-pack` writes `engineApi` as `^<major>.0.0` from the
current `ENGINE_API_VERSION` (`tools/cli/newPack.ts`). Do not use pre-release suffixes to signal
incompatibility: `satisfies()` ignores them.

### 4.3 `engineApi` in manifests

**Policy:** use `^<major>.<minor>.0`, where `<minor>` is the lowest API minor that provides every
feature the pack uses, and only the syntax of section 2.3. Raise it when the pack starts using a
newer API feature.

### 4.4 `packVersion`

Code: no bumping rule; `ManifestSchema` only requires the form `MAJOR.MINOR.PATCH`, with an
optional pre-release suffix (section 2.4).

**Policy:** semver of the pack's content and code. MAJOR when the release requires a `stateVersion`
bump or removes playable content, MINOR when it adds content, PATCH for fixes and text changes.

### 4.5 `stateVersion`

Code: "Version of the pack's local save state (bump + migrate when it changes)" and "migrations[n]
converts stateVersion n → n + 1".

**Policy:** it is an integer, not semver. Increase it by 1, with a `migrations[previous]` step,
whenever a release changes how an existing saved local state must be read. That includes renaming
or removing a variable, a quest, stage or objective, a dialogue node or choice used by conditions,
a logic file or a `once` rule, an entity of a scene, an ability or an item, and changing the meaning
of a variable's values. [SAVE_FORMAT.md, section 8.4](SAVE_FORMAT.md#84-content-changes-and-existing-saves)
lists what happens to each saved reference without a migration. Never decrease or reuse a value.

### 4.6 `state.version` of mechanics and behaviors

Code: "Increment when the state shape changes; provide a migration for the previous version." and
"migrate[n] converts a state saved at version n into version n + 1."

**Policy:** keep every step. Without one, players' saved state for that mechanic or component is
reset to its initial value. Changing the state of an engine behavior (`core.door`, `core.npc`, ...)
is an engine change and needs at least a MINOR `ENGINE_VERSION` bump.

### 4.7 Content document `version`

Code: no rule beyond the header of `schemas.ts`.

**Policy:** increase the integer of a format when existing files would stop validating or would
change meaning. Optional fields with defaults (`.optional()`, `.default()`) do not need a bump.
Because every schema uses `z.literal(1)`, a bump currently requires a content migration (section
5.2), the new literal in the schema, and an update of every creation site listed in section 2.6.

### 4.8 `SAVE_FORMAT_VERSION` and `GLOBAL_SCHEMA_VERSION`

Code (`saveFormat.ts`): "Version 1 is the first format; add entries here when the save layout
changes."

**Policy:** increase by 1 in the same commit as the migration step. Never remove a step that a
released version might need. Add a test that parses a JSON fixture saved by the previous version.

### 4.9 `VOXEL_ENCODING`

**Policy:** a new encoding gets a new id string. Keep decoding the old id, or rewrite every scene and
prefab file in the same change.

## 5. Writing migrations

### 5.1 Save migrations

Where to put a step:

| Level | Version to increase | Step |
|---|---|---|
| Save layout | `SAVE_FORMAT_VERSION` (`saveFormat.ts`) | `FORMAT_MIGRATIONS[n]` in `saveFormat.ts` |
| Multiverse | `GLOBAL_SCHEMA_VERSION` (`multiverse.ts`) | `GLOBAL_MIGRATIONS[n]` in `saveFormat.ts` |
| Pack local state | `"stateVersion"` in the pack's `manifest.json` | `definePack({ migrations: { [n]: ... } })` in the pack's `pack.ts` |
| Mechanic or component state | `state.version` of the definition | `state.migrate[n]` of the definition |

Rules that follow from the code:

- `n` converts version `n` into `n + 1`. The engine applies one step per version, in a loop.
- The engine sets the version number after each step. A pack `migrations` function does not need
  to change `stateVersion`: `migrateCivState()` sets it to `n + 1` after `migrations[n]`, whatever
  the function returned for it.
- Layout, multiverse and pack steps receive a copy of the saved data (`structuredClone`).
- A missing layout, multiverse or pack step refuses the load. A missing mechanic or component step
  resets that state to its initial value with a warning.
- Pack steps run after the save has been validated against the current engine layout: they
  transform the content of a `LocalCivState`, not its structure.

A tested mechanic-state step exists in the fixture `tests/acceptance/fixtures/lanterne/mechanics/lantern.ts`
(`lanterne.oil`, version 1 → 2), checked by `tests/acceptance/G-mechanics-extensibility.test.ts`.
`src/engine/core/save/saveFormat.test.ts` unit-tests `migrateCivState()` (chained pack steps, the
version set by the engine, refusal of a missing step or a newer state) and `migrateVersioned()`
(steps, fallback to the initial state with a warning).
Example of a pack step (more examples in
[SAVE_FORMAT.md, section 8.3](SAVE_FORMAT.md#83-adding-a-migration-step)):

```ts
// civilizations/mypack/pack.ts, with "stateVersion": 2 in manifest.json (hypothetical pack)
import { definePack, type LocalCivState } from '@sdk';

export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', '!./**/*.test.ts'], { eager: true }),
  migrations: {
    // 1 → 2: variable "mypack.rank" renamed to "mypack.accessRank".
    1: (s: LocalCivState): LocalCivState => {
      const { ['mypack.rank']: rank, ...vars } = s.vars;
      return { ...s, vars: rank === undefined ? vars : { ...vars, 'mypack.accessRank': rank } };
    },
  },
});
```

**Policy** checklist for a release that changes a save version:

1. Increase the version and add the step in the same commit.
2. Return a new value from the step rather than relying on mutating its input, and do not read
   runtime state: a step only transforms data.
3. Keep a JSON fixture saved by the previous version and add a headless test, for example:

   ```ts
   const { session } = await createHeadlessGame(provider);      // src/engine/core/testing/headless.ts
   const { save } = parseSave(JSON.parse(fixtureJson));          // layout and multiverse steps
   await session.applySaveGame(save);
   await session.loadCivilization('mypack');                     // pack, mechanic and component steps
   expect(session.vars.get('mypack.accessRank')).toBe(2);
   ```

4. Record the change in the changelog (section 7).

### 5.2 Content migrations

No content migration mechanism exists:

- There is no `src/engine/core/content/migrations.ts` or equivalent (the header of `schemas.ts`
  states that a format change must add one), and no code changes a document's `version`.
- Every schema accepts only `version: 1`. The loaders pass the raw JSON straight to `safeParse`
  (`parseWith()` and `validateManifest()` in `pack.ts`, `loadSceneDoc()`).
- Civilization Studio edits the raw JSON: `src/studio/core/project.ts` reads files with
  `JSON.parse` and writes them back with `JSON.stringify(doc.data, null, 2)` followed by a newline.
  A migration applied only by the engine's loaders would not upgrade the Studio's working copies.

What works today, because all content lives in this repository and is bundled with the build, is
an offline rewrite:

1. Write a one-off script (run with `tsx`, like the `seed` and `new-pack` commands of
   `tools/cli/civ.ts`) that reads every file of the format under `civilizations/*/`, transforms it,
   sets the new `version` and writes it with `JSON.stringify(doc, null, 2) + '\n'`, the format
   used by the Studio and the CLI.
2. Change `version: z.literal(1)` in the schema and update the creation sites listed in section
   2.6.
3. Run `npm run check` (typecheck, lint, `validate`, tests).

For voxel data, `volumeFromDoc()` / `volumeToDoc()` (`src/engine/core/world/sceneVoxels.ts`) and
`VoxelVolume.remapId(from, to)` ("Replaces a block id by another everywhere (e.g. renamed asset
during migration)", `src/engine/core/voxel/volume.ts`) are available.

**Proposal (not implemented).** Load-time migrations, which would be needed to read content
written for an older engine without rewriting it, could follow the save pattern:

```ts
// Proposal only: src/engine/core/content/migrations.ts does not exist.
type DocMigration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** CONTENT_MIGRATIONS[format][n] converts version n into n + 1. */
const CONTENT_MIGRATIONS: Record<string, Record<number, DocMigration>> = {};

export function migrateDocument(raw: unknown, currentVersion: number): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  let doc = structuredClone(raw) as Record<string, unknown>;
  const steps = CONTENT_MIGRATIONS[String(doc.format)] ?? {};
  for (let v = Number(doc.version); Number.isInteger(v) && v < currentVersion && steps[v]; v++) {
    doc = steps[v]!(doc);
    doc.version = v + 1;
  }
  return doc;
}
```

It would be called before `safeParse` in `parseWith()`, `validateManifest()` and `loadSceneDoc()`,
and by the Studio when it opens a document, so that saving writes the new version.

## 6. Deprecation policy (recommendations)

**Policy.** This whole section is a recommendation. The code has no deprecation mechanism: no
`@deprecated` tags, no aliases for renamed definition ids in the registries, and no warning for
deprecated usage.

1. SDK exports: mark them `/** @deprecated <reason>; use <replacement> */`, keep them working until
   the next MAJOR of `ENGINE_API_VERSION`, and remove them only in that MAJOR.
2. Engine definitions referenced by content (`core.*` behaviors, actions, conditions, events and
   their props): when one is renamed, keep the old id registered (a second registration, since the
   registries have no alias feature) until the next API MAJOR, and update the bundled packs'
   content in the same change.
3. Save versions: keep every migration step. If support for very old saves is ever dropped, do it
   in an engine MAJOR and name the last release that can convert them in the changelog.
4. Content document versions: same rule as saves, once content migrations exist.
5. Pack local state: never delete released `migrations` steps. Prefer adding new ids to renaming
   existing ones; when a quest, variable or mechanic is retired, convert or drop its saved data in a
   migration rather than leaving it to the loader.
6. Announce each deprecation in the changelog with the version that deprecates it and the version
   that will remove it.

## 7. Changelog

### Current versions

Values found in the source when this document was written.

| Item | Version |
|---|---|
| Engine (`ENGINE_VERSION`, `package.json`) | `0.1.0` |
| Engine API (`ENGINE_API_VERSION`) | `1.0.0` |
| Save layout (`SAVE_FORMAT` / `SAVE_FORMAT_VERSION`) | `civverse.save` / `1` |
| Multiverse state (`GLOBAL_SCHEMA_VERSION`) | `1` |
| Manifest and content documents (`format` / `version`) | `civverse.pack`, `civverse.scene`, `civverse.dialogue`, `civverse.quest`, `civverse.cinematic`, `civverse.logic`, `civverse.prefab`, `civverse.items`, `civverse.characters`, `civverse.rules`: all `1` |
| Voxel encoding (`VOXEL_ENCODING`) | `rle16-b64` |
| Settings storage key | `civverse.settings.v1` |
| Pack `core` (library) | `packVersion` `0.1.0`, `engineApi` `^1.0.0`, `stateVersion` `1` |
| Pack `door` | `packVersion` `0.1.0`, `engineApi` `^1.0.0`, `stateVersion` `1` |
| Pack `memory` | `packVersion` `0.1.0`, `engineApi` `^1.0.0`, `stateVersion` `1` |
| Engine behavior states | `core.door`, `core.npc`, `core.interactable`, `core.pickup`, `core.readable`, `core.trigger`, `core.zone`: all `1` |
| `door` states | mechanics `door.access`, `door.keyImprint`; behaviors `door.lock`, `door.memory`, `door.watcher`: all `1` |
| `memory` states | mechanics `memory.chamber`, `memory.echoes`, `memory.offering`; behaviors `memory.echoPoint`, `memory.recollection`: all `1` |
| Registered save migrations | none in the engine or the shipped packs (`FORMAT_MIGRATIONS`, `GLOBAL_MIGRATIONS` empty; no pack `migrations`; no `state.migrate`). The test fixture mechanic `lanterne.oil` (`tests/acceptance/fixtures/lanterne/`) is at state version `2` with one step. |
| Content migrations | none |

### History

No version number has changed since it was introduced, and the repository has no git tags.

- `2553e32` Initialize CIVILIZATIONVERSE project tooling: `package.json` version `0.1.0`,
  `src/engine/core/util/semver.ts`.
- `1c961ad` Add headless simulation core and story engine: `ENGINE_VERSION` `0.1.0`,
  `ENGINE_API_VERSION` `1.0.0`, save layout `1`, multiverse state `1`, content schemas at version
  `1`, voxel encoding `rle16-b64`.
- `3817e86` Add Babylon view layer, audio, input, core library pack and French game UI: `core`
  manifest (`0.1.0`, `^1.0.0`), settings key `civverse.settings.v1`.
- `97da80a` Add the Door civilization: `door` manifest (`0.1.0`, `^1.0.0`).
- `cfe2663` Add the Memory civilization: `memory` manifest (`0.1.0`, `^1.0.0`).
- `9bcb5d5` Fix bugs found while documenting: no version number changed. `packVersion` must be a
  full `x.y.z` (optional pre-release suffix); a newer `global.schemaVersion` is refused;
  `migrateCivState()` sets `stateVersion` itself after each pack step; acceptance test J checks that
  `ENGINE_VERSION` equals the `package.json` version.
- `57d0393` Fix scenario gaps and smaller bugs: no version number changed. Unit tests for
  `semver.ts` and the save state migrations; the Studio's manifest editor shows `stateVersion`.
- `c26efa1` Objective markers, notification timing: no version number changed.
- `0f92dd7` Validation reports a civilization's load problems; script scaffolding checks real
  paths: no version number changed.

### Template for future entries (Policy)

```
### Engine X.Y.Z — API A.B.C — YYYY-MM-DD
- Save: formatVersion N (migration from N-1), global schemaVersion M, ...
- Content documents: civverse.<format> version N (migration from N-1), ...
- API: added ..., changed ..., deprecated ... (removal planned in API X.0.0), removed ...
- Packs: <id> packVersion x.y.z, stateVersion N (migration from N-1), engineApi ^A.B.0
- Notes for pack authors: ...
```

## 8. Limitations and known gaps

1. No content migration mechanism (the header of `schemas.ts` says that a format change must add
   one), and every document schema accepts only `version: 1`.
2. No save migration is registered in the engine or the shipped packs. The only migration steps in
   the repository are the mechanic-state step of the test fixture `lanterne.oil`, exercised by
   `tests/acceptance/G-mechanics-extensibility.test.ts`, and the steps defined inside
   `src/engine/core/save/saveFormat.test.ts`; the layout and multiverse migration loops
   (`FORMAT_MIGRATIONS`, `GLOBAL_MIGRATIONS`) are not exercised by any test.
3. `engineVersion` and `packVersion` are written into saves but never compared.
4. `satisfies()` supports only part of npm's range syntax. Unsupported ranges reject the pack
   instead of raising a syntax error, `^0.0.x` is looser than in npm, and pre-release suffixes are
   ignored.
5. Manifest `dependencies` cannot carry version constraints, and saves do not record the versions
   of library packs.
6. `ENGINE_VERSION` and `package.json` are kept in sync by hand (acceptance test J fails when they
   differ), and the engine version is not shown anywhere in the game.
7. The document version `1` is written as a literal at several creation sites (section 2.6) rather
   than taken from a shared constant.
8. There is no deprecation mechanism (section 6).
9. A mechanic or component state that cannot be migrated (missing step or newer version) is reset
   to its initial value with only a log warning, while a save layout, multiverse state or
   civilization state that cannot be migrated refuses the load (the header of `saveFormat.ts`
   states both behaviors).
10. The contents of scene, quest and mechanic states inside a save are not schema-validated, and
    saved states of mechanics or abilities that a pack no longer defines are dropped silently
    (section 3.5).
