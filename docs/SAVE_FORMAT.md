# Save game format and storage

This document describes how CIVILIZATIONVERSE captures, stores, validates, migrates and restores a
player's progress. It is derived from the code; every path is relative to the repository root.
Player-facing messages are in French, as in the game.

Main sources:

| File | Role |
|---|---|
| `src/engine/core/save/saveFormat.ts` | Types, Zod schema, `parseSave()`, migration helpers |
| `src/engine/core/save/storage.ts` | `SaveStorage` interface, `MemorySaveStorage`, `slotInfo()` |
| `src/engine/platform/idbSaveStorage.ts` | `BrowserSaveStorage` (IndexedDB, localStorage fallback) |
| `src/engine/core/sim/session.ts` | Capture (`snapshotCivState`, `buildSaveGame`, `captureSceneState`) and restore (`applySaveGame`, `loadCivilization`, `enterScene`) |
| `src/engine/core/sim/behaviorSystem.ts` | Per-entity component state capture and restore |
| `src/engine/core/state/multiverse.ts`, `src/engine/core/state/variables.ts` | Global state, story variables |
| `src/engine/core/story/quests.ts`, `src/engine/core/story/dialogue.ts` | Quest and dialogue snapshots |
| `src/game/controller.ts`, `src/game/hud/Pause.tsx`, `src/game/hud/Hud.tsx`, `src/game/screens/Menus.tsx` | Slots, autosave, save/load UI |

Versioning rules for the whole project (engine, API, packs, documents) are in
[VERSIONING.md](VERSIONING.md).

## Contents

1. [Overview](#1-overview)
2. [Storage backends](#2-storage-backends)
3. [Slots and autosave](#3-slots-and-autosave)
4. [JSON structure](#4-json-structure)
5. [Global state vs local state](#5-global-state-vs-local-state)
6. [Capturing a save](#6-capturing-a-save)
7. [Loading a save](#7-loading-a-save)
8. [Versions and migrations](#8-versions-and-migrations)
9. [Error handling](#9-error-handling)
10. [Example save (illustrative)](#10-example-save-illustrative)
11. [Limitations](#11-limitations)

## 1. Overview

A save is a single JSON document of type `SaveGame`. The header of `saveFormat.ts` summarizes it:

```
SaveGame
├─ global: GlobalState              (multiverse, shared by every civilization)
├─ currentCiv
└─ civs: { [civId]: LocalCivState } (isolated per civilization)
```

Data flow in the game (`src/game/controller.ts`):

```
save:  GameController.save(slot)
         → GameSession.buildSaveGame(slot, label)    snapshot of the multiverse and of every known civilization
         → SaveStorage.save(slot, data)               JSON.stringify, then IndexedDB / localStorage / memory

load:  GameController.loadSlot(slot)
         → SaveStorage.load(slot)                     JSON.parse (no validation)
         → parseSave(raw)                             format checks, engine migrations, Zod validation
         → GameSession.applySaveGame(save)            replaces the multiverse and the civilization states in memory
         → GameSession.loadCivilization(currentCiv)   pack migration, restore, scene entry
```

## 2. Storage backends

### 2.1 The `SaveStorage` interface

```ts
// src/engine/core/save/storage.ts
export interface SaveSlotInfo {
  slot: string;
  label: string;
  savedAt: string;
  currentCiv: string | null;
  playTime: number;
}

export interface SaveStorage {
  list(): Promise<SaveSlotInfo[]>;
  load(slot: string): Promise<unknown | null>;
  save(slot: string, data: SaveGame): Promise<void>;
  delete(slot: string): Promise<void>;
}
```

`load()` returns the parsed JSON as `unknown`: storages never validate content. Validation is done
by `parseSave()` (section 7.1). Both implementations store the save as a JSON string produced by
`JSON.stringify` and read it back with `JSON.parse`.

`slotInfo(save)` builds the summary shown in menus. Its `playTime` is the sum of
`civs[*].playTime` (local play time of every civilization in the save, in seconds).

### 2.2 Browser: `BrowserSaveStorage`

`src/engine/platform/idbSaveStorage.ts`. `GameController.create()` uses it when no other storage is
passed.

| Aspect | Value |
|---|---|
| Library | `idb-keyval` 6.3.0 (`createStore`, `get`, `set`, `del`, `entries`) |
| IndexedDB database | `civilizationverse` |
| Object store | `saves` (created by `createStore('civilizationverse', 'saves')`) |
| Key | slot id (`auto`, `slot1`, `slot2`, `slot3`) |
| Value | the `SaveGame` as a JSON string |
| Fallback | `localStorage`, key `civverse.save.<slot>` (`LS_PREFIX = 'civverse.save.'`) |

Fallback rules:

- If `indexedDB` is undefined when the storage is constructed (or `createStore` throws), the
  instance uses localStorage from the start.
- Every operation goes through `useFallback(fn, fb)`. If the IndexedDB variant throws, the storage
  logs `[sauvegarde] IndexedDB indisponible, repli sur localStorage` with `console.warn`, sets
  `fallback = true` for the lifetime of the instance, and runs the localStorage variant.
- `idb-keyval` opens the database lazily, on the first operation, so an IndexedDB that exists but
  cannot be opened is detected by the first `list`, `load`, `save` or `delete`.
- The two stores are never merged or copied into each other.
- `list()` parses every stored entry and returns the summaries sorted by `savedAt`, newest first.

### 2.3 In memory: `MemorySaveStorage`

`src/engine/core/save/storage.ts`. A `Map<string, string>` of JSON strings, so the data goes
through the same `JSON.stringify` / `JSON.parse` round trip as in the browser.

Civilization Studio's playtest uses it (`src/studio/play/Playtest.tsx`):

```ts
c = await GameController.create({ provider, mode: 'playtest', storage: new MemorySaveStorage() });
```

Playtest saves disappear when the playtest controller is released; the player's browser saves are
never touched. Tests use it as well: `tests/acceptance/E-save-persistence.test.ts` writes and reads
saves through a `MemorySaveStorage` (section 7.5).

### 2.4 Not part of the save

Player settings (controls, audio, graphics, language) are stored separately in localStorage under
the key `civverse.settings.v1` (`src/engine/platform/settings.ts`). They are not included in a
`SaveGame`.

## 3. Slots and autosave

### 3.1 Slots

```ts
// src/game/controller.ts
export const SAVE_SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

const AUTOSAVE_SECONDS = 120;
```

| Slot | Written by | Shown in |
|---|---|---|
| `auto` | Autosave (section 3.2) | Load menu, main-menu « Continuer » button |
| `slot1` | Save menu, and the `quicksave` key (default `F5`) | Save and load menus |
| `slot2`, `slot3` | Save menu | Save and load menus |

- The save menu (`SaveSlots` in `src/game/hud/Pause.tsx`) lists `slot1`–`slot3` only
  (`SAVE_SLOTS.filter((s) => mode === 'load' || s !== 'auto')`). The player cannot write into
  `auto` by hand. In load mode, empty slots are disabled.
- Quicksave (`src/game/hud/Hud.tsx`) calls `controller.save('slot1')` when no overlay or modal is
  open and no dialogue or cinematic is running. There is no quick-load.
- The main menu shows « Continuer » only when `listSaves()` returns an `auto` entry; it calls
  `continueGame('auto')`, which is `loadSlot('auto')`.
- « Nouvelle partie » (`newGame()`) resets the session (`resetAll()`) and deletes the `auto` slot.
  Manual slots are never deleted by the game, and there is no delete action in the UI.
- Menus display each filled slot as `label · date · play time` (`formatDate(info.savedAt)`,
  `formatDuration(info.playTime)`).

### 3.2 Autosave

`GameController.autosave()` calls `save('auto')`. It returns immediately when no civilization is
active or when `session.isLoading` is true (the `scene.entered` event emitted while a civilization
loads therefore does not save).

| Trigger | Code |
|---|---|
| Every 120 seconds while playing | `setInterval(..., AUTOSAVE_SECONDS * 1000)`, started by `enterPlaying()` |
| A quest completes | `session.bus.on('quest.completed', ...)` |
| A quest changes stage | `session.bus.on('quest.stageChanged', ...)` |
| A scene is entered (portals, `core.changeScene`) | `session.bus.on('scene.entered', ...)` |
| A civilization was started from the selection screen | `startCiv()`, after `loadCivilization()` |
| Quitting to the main menu | `quitToMenu()`, before unloading |
| A civilization ends (`civ.finished`) | `finishCiv()`, before unloading |

After each successful write `GameController.save()` emits the bus event `save.completed`
(`{ slot }`, typed in `src/engine/core/events/eventMap.ts`). A manual save also shows the
notification `ui.save.done`. Any failure, manual or automatic, is logged (`Sauvegarde impossible`)
and shows `ui.save.failed`.

### 3.3 Label

`GameController.save()` builds the label from the localized civilization and scene names at save
time:

```ts
const label = `${this.session.t(this.session.civ.manifest.name)} — ${this.session.world ? this.session.t(this.session.world.doc.name) : ''}`;
```

## 4. JSON structure

The excerpts below are copied from the source.

### 4.1 `SaveGame`

```ts
// src/engine/core/save/saveFormat.ts
export const SAVE_FORMAT = 'civverse.save';
export const SAVE_FORMAT_VERSION = 1;

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
```

| Field | Written from (`GameSession.buildSaveGame`) | Meaning |
|---|---|---|
| `format` | `SAVE_FORMAT` | Identifies a CIVILIZATIONVERSE save. Any other value is rejected. |
| `formatVersion` | `SAVE_FORMAT_VERSION` (1) | Layout version of the document. Drives the engine format migrations. |
| `engineVersion` | `ENGINE_VERSION` (`src/engine/core/version.ts`) | Engine that wrote the save. Informational: never read on load. |
| `savedAt` | `new Date().toISOString()` | Time the save was built. |
| `slot` | argument | Storage key the save was written to. `list()` reports this field. |
| `label` | argument | Human-readable summary, localized at save time (section 3.3). |
| `global` | `this.multiverse.snapshot()` | Multiverse state (section 4.2). |
| `currentCiv` | `this.civ?.id ?? null` | Civilization running at save time; started again on load. |
| `civs` | `Object.fromEntries(this.civStates)` | Local state of every civilization known to the session (section 4.3). |

`GameSession.civStates` holds the local state of every civilization unloaded during the session or
restored from a loaded save; `buildSaveGame()` first refreshes the entry of the running
civilization. A civilization that was never entered has no entry.

### 4.2 `GlobalState` (multiverse)

```ts
// src/engine/core/state/multiverse.ts
export const GLOBAL_SCHEMA_VERSION = 1;

export interface CivProgress {
  started: boolean;
  completed: boolean;
  lastPlayed: string | null;
  playTime: number;
}

export interface GlobalState {
  schemaVersion: number;
  protagonist: { awakenings: number; title: string | null; createdAt: string };
  fragments: Record<string, { civ: string; acquiredAt: string }>;
  flags: Record<string, JsonValue>;
  civs: Record<string, CivProgress>;
}
```

| Field | Written by | Meaning |
|---|---|---|
| `schemaVersion` | `createGlobalState()` | Version of this structure. Drives the global migrations. |
| `protagonist.awakenings` | `recordAwakening()`, called by `loadCivilization()` | Incremented when a civilization is entered for the first time, or entered without saved local state (for example after a restart). |
| `protagonist.title` | nothing | Present in the format and readable as `global.protagonist.title`, but no code writes it: it is always `null`. The title used in play is the local `player.title`. |
| `protagonist.createdAt` | `createGlobalState()` | ISO time the multiverse state was created (session start or new game). |
| `fragments` | `MultiverseState.grantFragment()` (action `core.grantFragment`, `ctx.multiverse.grantFragment`) | Acquired multiverse fragments: owning civilization and ISO acquisition time. |
| `flags` | `MultiverseState.setFlag()` (action `core.setGlobalFlag`, `ctx.multiverse.setFlag`) | Global flags. Keys are stored without the `flags.` prefix, e.g. `"testciv.done"`. |
| `civs` | `markStarted()` on every civilization load, `markCompleted()` (actions `core.finishCivilization`, `core.markCivCompleted`), `addPlayTime()` every simulated frame | Per-civilization progress. `playTime` is in seconds and is never reset by a restart. |

### 4.3 `LocalCivState` (one per civilization)

```ts
// src/engine/core/save/saveFormat.ts
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
```

```ts
// src/engine/core/sim/api.ts
export type QuestStatus = 'inactive' | 'active' | 'completed' | 'failed';

// src/engine/core/story/quests.ts
export interface QuestState {
  status: QuestStatus;
  stage: string | null;
  /** Completed objectives as "stage/objective". */
  done: string[];
  startedAt: number | null;
  finishedAt: number | null;
  /** Journal entries: localization keys of stage descriptions reached, in order. */
  history: string[];
}
```

The values come from `GameSession.snapshotCivState()`.

| Field | Content |
|---|---|
| `civId` | Pack id of the civilization. |
| `packVersion` | `manifest.packVersion` at snapshot time. Recorded only; never compared on load. |
| `stateVersion` | `manifest.stateVersion` at snapshot time. Drives the pack's own migrations (section 8). |
| `savedAt` | Time of this civilization's last snapshot. For an inactive civilization it is the time it was last unloaded, or the value read from the loaded save. |
| `scene` | Id of the scene the player was in (`world.id`, else `manifest.entry.scene`, else `''`). |
| `player.position` | Player body position (feet) in world coordinates; the voxel grid has unit spacing. |
| `player.yaw`, `player.pitch` | Look angles in radians (`PlayerController`). Entity yaws in scene states are in degrees. |
| `player.abilities` | Granted ability ids. |
| `player.title` | Localization key set with `ctx.player.identity.setTitle()` (action `core.setPlayerTitle`), or `null`. |
| `vars` | `VariableStore.snapshot(civId)`: only the variables named `<civId>.*`. |
| `inventory` | Item stacks in insertion order. |
| `quests.states` | One `QuestState` per quest that has state. `done` holds `"<stageId>/<objectiveId>"`; objectives completed before a quest starts are kept in an `inactive` state. `history` holds localization keys, translated when displayed. |
| `quests.states.*.startedAt`, `finishedAt` | Values of the session's simulation clock (`SimClock.now`, seconds of unpaused time since the `GameSession` was created). The clock itself is not saved. No code reads these two fields. |
| `quests.tracked` | Id of the quest shown in the objective tracker, or `null`. |
| `dialogue.seen` | `"<dialogueId>/<nodeId>"` of every node reached, routing nodes included. |
| `dialogue.chosen` | `"<dialogueId>/<choiceId>"` of every choice taken (used by `once` choices and conditions). |
| `rulesFired` | `"<logicFileId>/<ruleId>"` of rules declared `once: true` whose condition passed (`RuleEngine.firedOnce`). |
| `mechanics` | One `VersionedState` per mechanic that declares a `state` spec, keyed by mechanic id. |
| `scenes` | One `SceneState` per scene visited (captured on exit), plus the live scene at snapshot time. |
| `playTime` | Seconds of unpaused simulated time spent in this civilization (each frame's `dt` is clamped to 0.1 s). A restart from the selection screen resets it to 0; `global.civs[civId].playTime` keeps counting. |

### 4.4 `SceneState` and `EntityState`

```ts
// src/engine/core/save/saveFormat.ts
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
```

A scene state is a diff against the scene document (`content/scenes/<id>.scene.json`), built by
`GameSession.captureSceneState()`:

| Field | Content |
|---|---|
| `entities` | One entry per entity that has something to record (rules below). |
| `spawned` | Entities created at runtime with `ctx.world.spawn(doc, { persistent: true })`, stored as a full `EntityDoc` with the current `position` and `rotation`. `persistent` defaults to `false`; non-persistent spawned entities are not written here. |
| `removed` | Ids of scene-document entities removed at runtime (`ctx.world.despawn()`). |
| `voxelEdits` | Integer voxel coordinates and the new block id; `null` means air (`core:air`). Recorded by `SceneWorld.setBlock()` and `fillBlocks()` (`ctx.world.setBlock`, `ctx.world.fillBlocks`). |

`EntityState` fields, written by `BehaviorSystem.captureEntityState()`:

| Field | Written when |
|---|---|
| `position`, `yaw` | The entity was spawned at runtime, or its position or Y rotation differs from the scene document. `yaw` is in degrees; X/Z rotation and scale are not saved. |
| `visible` | Only when `false`. |
| `enabled` | Only when `false`. |
| `overrides` | A component has runtime prop overrides (`entity.setProp(component, key, value)`), keyed by component type then prop name. |
| `states` | For every component whose definition declares `state` and whose state is not `undefined`, changed or not. Keyed by component type (behavior id). |

An entity with nothing to record has no entry. Because spawned entities always record their
transform, a non-persistent spawned entity still gets an `entities` entry; it is ignored on load.

### 4.5 `VersionedState`

```ts
// src/engine/core/save/saveFormat.ts
export interface VersionedState {
  version: number;
  state: unknown;
}
```

Used for mechanic states (`LocalCivState.mechanics`) and component states (`EntityState.states`).
`version` is the `state.version` of the definition that wrote it; `state` is a `structuredClone` of
the live state object.

## 5. Global state vs local state

### 5.1 Why two levels

The header of `src/engine/core/state/multiverse.ts` states the intent:

> Global multiverse state: what persists across civilizations.
>
> Kept deliberately small and explicit: protagonist identity, multiverse fragments, global flags
> and per-civilization progress. Packs can read all of it but may only write what their manifest
> declares in `globalWrites` ("fragments.threshold", "flags.door.*"). Items, abilities and local
> story state never leak between worlds unless a pack explicitly writes a global flag.

Each civilization's local state is versioned and migrated by its own pack (`stateVersion` and
`migrations`), while the engine versions and migrates the global part (`schemaVersion`). A pack's
migration receives and returns only its own `LocalCivState`.

### 5.2 Rules enforced by the code

- Variables: a civilization can only write variables in its own namespace (`<civId>.*`).
  `createCivContext()` throws `La civilisation "<civId>" ne peut écrire que ses variables (<civId>.*), pas "<name>".`
  Names starting with `global.` are read-only views of the multiverse; `VariableStore.set()` throws
  for them.
- Multiverse writes: `grantFragment()` and `setFlag()` check the manifest's `globalWrites` with
  `isWriteAllowed()` (an entry ending in `*` matches by prefix, other entries match exactly) and
  throw otherwise.
- Unloading a civilization (`GameSession.unloadCivilization()`) clears its variables and their
  declarations, the inventory, quests, dialogue memory and rules, resets the player's abilities,
  cooldowns, title and movement modifiers (`PlayerController.resetCivilizationState()`), disposes
  everything registered through the civilization's scope and unregisters the pack's definitions.
  The test `isolates civilizations: switching unloads listeners, timers and registrations` in
  `src/engine/core/sim/session.test.ts` checks this.

### 5.3 Where each kind of progress lives

| Data | Location in the save | Written by |
|---|---|---|
| Multiverse fragments | `global.fragments` | `core.grantFragment` / `ctx.multiverse.grantFragment` |
| Global flags | `global.flags` | `core.setGlobalFlag` / `ctx.multiverse.setFlag` |
| Started, completed, last played, total play time | `global.civs.<civId>` | Engine, `core.finishCivilization`, `core.markCivCompleted` |
| Awakenings | `global.protagonist.awakenings` | Engine |
| Story variables | `civs.<civId>.vars` | `core.setVar`, `ctx.vars.set`, ... |
| Inventory | `civs.<civId>.inventory` | `core.pickup` components, `core.giveItem`, `core.takeItem`, `ctx.inventory` |
| Abilities and local title | `civs.<civId>.player` | `ctx.player.abilities.grant`, `core.setPlayerTitle` |
| Quests, dialogue memory, `once` rules | `civs.<civId>.quests`, `.dialogue`, `.rulesFired` | Engine story systems |
| Mechanic states | `civs.<civId>.mechanics` | Pack mechanics |
| World changes | `civs.<civId>.scenes` | Engine scene capture |

Packs read the global state through `ctx.multiverse` or through `global.*` variables, resolved by
`MultiverseState.read()`:

| Variable | Value |
|---|---|
| `global.fragments` | Array of acquired fragment ids |
| `global.fragments.<id>` | `true` when acquired, otherwise `undefined` |
| `global.flags.<name>` | Value of the flag |
| `global.civs.<civId>` | The `CivProgress` object |
| `global.civs.<civId>.<field>` | One field of it (`started`, `completed`, `lastPlayed`, `playTime`) |
| `global.protagonist.awakenings`, `global.protagonist.title` | Protagonist fields |

### 5.4 Consequences

- Restarting a civilization (« Recommencer » on the selection screen, `startCiv(id, { fresh: true })`)
  deletes only `civs.<id>`. Fragments, flags and `global.civs.<id>` are kept, and the next autosave
  writes the result.
- « Nouvelle partie » (`newGame()` → `GameSession.resetAll()`) replaces the multiverse with a new one,
  clears every local state and deletes the `auto` slot.

## 6. Capturing a save

`GameSession.buildSaveGame(slot, label)` refreshes the running civilization with
`snapshotCivState()`, then assembles the `SaveGame` (section 4.1). `snapshotCivState()`:

1. Runs the civilization's `beforeSave` lifecycle callbacks (`ctx.lifecycle.on('beforeSave', cb)`).
   Errors are logged and do not stop the save.
2. Copies the stored scene states and captures the live scene (`captureSceneState()`), unless
   `includeScene: false` is passed.
3. Copies each mechanic state: `{ version: def.state.version, state: structuredClone(state) }`.
4. Copies the player, variables, inventory, quests, dialogue memory, fired rules and play time.

`unloadCivilization()` also calls `snapshotCivState()` (unless `keepState: false`) and stores the
result in `civStates`. Switching civilization or quitting to the menu therefore keeps the state in
memory, and `beforeSave` callbacks also run at those moments.

### 6.1 Requirements for pack code

These follow from the capture path:

- Mutate state in place. A mechanic receives its state object in `setup(ctx, state, settings)`; a
  behavior reads it through `ctx.state`. The engine keeps a reference to that object and has no
  setter, so replacing the object in a local variable is not saved.
- Keep state JSON-compatible. States are copied with `structuredClone` and written with
  `JSON.stringify`, so `Map`, `Set`, `Date`, class instances, functions and `undefined` values do
  not survive a save and reload. `src/engine/core/util/json.ts` documents the rule for `JsonValue`:
  "Content files and save data only contain these."
- One-shot logic must not rely on events. `loadCivilization()` emits `civ.started` and
  `enterScene()` emits `scene.entered` on every load, including from a save. Use `once: true` rules
  (recorded in `rulesFired`) or variables.

### 6.2 What is not saved

The following are rebuilt or lost on reload: dialogues and cinematics in progress (they are aborted
on unload, and the actions they had not run yet do not run after reload), timers registered with
`ctx.time`, ability cooldowns, movement modifiers, the civilization UI store (`ctx.ui.store`), NPC
movement targets, entity presentation state (animation, expression, look target), collider and
light registrations made by behaviors (recreated when behaviors are created again), and the
simulation clock.

## 7. Loading a save

### 7.1 `parseSave()`

```ts
// src/engine/core/save/saveFormat.ts
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
```

Notes:

- The input is cloned first; `parseSave()` never modifies its argument.
- Validation (`SaveGameSchema`) runs after the engine migrations, against the current layout.
- What the schema checks: the top level is a strict `z.object` (unknown top-level keys are
  removed); `global`, each `civs.<id>` and `player` are `z.looseObject` (unknown keys are kept);
  `quests.states`, `scenes` and `global.civs` values are `z.unknown()` (not checked);
  `mechanics` values must be `{ version: integer, state: unknown }`.
- `engineVersion` and `packVersion` must be strings; their values are not compared with anything.
- The controller logs the returned warnings at info level.

### 7.2 `applySaveGame()`

```ts
// src/engine/core/sim/session.ts
async applySaveGame(save: SaveGame): Promise<void> {
  if (this.civ) await this.unloadCivilization({ keepState: false });
  this.multiverse.replace(save.global as GlobalState);
  this.civStates.clear();
  for (const [id, st] of Object.entries(save.civs)) this.civStates.set(id, st);
  this.changed();
}
```

It does not validate: callers pass the result of `parseSave()`. The running civilization is
unloaded without keeping its unsaved state. Then `GameController.loadSlot()` starts
`save.currentCiv` with `loadCivilization()`, or shows the civilization selection screen when it is
`null`.

### 7.3 `loadCivilization()` restore order

For the civilization being started (`src/engine/core/sim/session.ts`):

1. Unload the running civilization, if any (its state is kept in `civStates`).
2. Find the manifest. An unknown id fails with `core.error.civNotFound`; a library pack fails with
   `"<id>" est une bibliothèque, pas une civilisation jouable.`
3. With `fresh: true`, delete the civilization's saved local state.
4. Load and register the pack and its dependencies (`ensurePack()`).
5. Migrate the saved local state: `migrateCivState(saved, manifest.stateVersion, pack.module.migrations)`
   (section 8). Its warnings are logged at info level. Local states of the other civilizations in
   the save are migrated only when those civilizations are entered.
6. Restore variables (`VariableStore.restore(values, civId)`: no type check, no notifications;
   declared variables missing from the save get their default when declared), inventory (entries
   with `count <= 0` are dropped; item ids are not checked), quests (`QuestSystem.restore()`),
   dialogue memory, fired rules and the local title.
7. Apply mechanic settings from `content/rules.json`, then set up mechanics in dependency order.
   Each mechanic's state comes from
   `migrateVersioned(saved?.mechanics[def.id], def.state, () => (def.state ? def.state.initial() : undefined), def.id, (m) => this.log.warn(m))`.
8. Grant `autoGrant` abilities, then the saved abilities that the pack still defines.
9. Load the logic rules, mark the civilization started in the multiverse, and call
   `recordAwakening()` if it was never started or has no saved local state.
10. Enter `saved.scene` (or the manifest entry scene) and place the player at the saved position,
    yaw and pitch, unless a scene or spawn was requested explicitly.
11. Run the `start` lifecycle callbacks, emit `civ.started` (unless `quietStart`), evaluate quests.

If any step throws, the error is logged (`Chargement de la civilisation impossible`); if the
civilization had already been set up (from step 6 on), it is unloaded with `keepState: true`; the
error is re-thrown and `GameController.fail()` shows the error screen with the message.

### 7.4 Scene restore (`enterScene()`)

1. Load and validate the scene document (`loadSceneDoc()`), then capture and leave the previous
   scene.
2. Replay `voxelEdits` in order with `world.setBlock()` (out-of-bounds coordinates are ignored).
3. Create the document's entities, skipping those in `removed`; apply `position`, `yaw`, `visible`
   and `enabled` from `entities[id]`.
4. Create the `spawned` entities (marked spawned and persistent) the same way.
5. Instantiate components (`BehaviorSystem.instantiate()`): saved `overrides` are merged over the
   normalized props, and each component state is restored with `migrateVersioned()`, falling back
   to `def.state.initial(props)`.
6. Compute lighting, place the player, run `sceneEnter` callbacks and emit `scene.entered`.

### 7.5 Tests

Headless round trips (build a save, serialize it, `parseSave()`, apply it to a new session, check
the restored state):

- `src/engine/core/sim/session.test.ts`: `saves and restores local and global state through the versioned save format`
- `civilizations/door/tests/door.playthrough.test.ts`: `the evidence persists through a save and a reload`
- `civilizations/memory/tests/memory.playthrough.test.ts`: `shards, slots, the puzzle and the choices persist through a save and a reload`
- `tests/acceptance/E-save-persistence.test.ts`: a Door save written and read through
  `MemorySaveStorage`; two civilizations kept in one save; rejection (`SaveLoadError`) of `null`,
  of a wrong `format`, of a newer `formatVersion` and of a save whose `player` is missing.
- `tests/acceptance/G-mechanics-extensibility.test.ts`: the state of the fixture mechanic
  `lanterne.oil` survives a round trip, and a state saved at version 1 is migrated to version 2
  (section 8.3).

In a browser, `tests/e2e/game.spec.ts` (Playwright, `npm run test:e2e`) saves from the pause menu,
reloads the page and loads the slot.

Not exercised by any test: the layout, multiverse and civilization-level migration loops, the
newer-version and missing-step fallbacks of `migrateVersioned()`, the `global.schemaVersion`
handling, and the localStorage fallback of `BrowserSaveStorage`.

## 8. Versions and migrations

### 8.1 Version levels

The header of `saveFormat.ts`:

> Every level is versioned: `formatVersion` (this file), `global.schemaVersion`, each civ's
> `stateVersion` (pack-defined, migrated by the pack), and each mechanic/behavior state version.
> Loading never silently drops data: unknown entries are kept or reported, failed migrations
> abort the load with an explicit error.

What the code does at each level:

| Level | Field in the save | Target version | Migrations | Applied by | Saved version newer than target | Missing step |
|---|---|---|---|---|---|---|
| Save layout | `formatVersion` | `SAVE_FORMAT_VERSION` = 1 | `FORMAT_MIGRATIONS` (private to `saveFormat.ts`) | `parseSave()` | Load refused | Load refused |
| Multiverse | `global.schemaVersion` | `GLOBAL_SCHEMA_VERSION` = 1 | `GLOBAL_MIGRATIONS` (private to `saveFormat.ts`) | `parseSave()`, after the layout migrations | Accepted, no warning | Load refused |
| Civilization | `civs.<id>.stateVersion` | `stateVersion` of the pack manifest | `definePack({ migrations })` → `PackModule.migrations` | `loadCivilization()`, for that civilization only | Load refused | Load refused |
| Mechanic state | `civs.<id>.mechanics.<mechanicId>.version` | `state.version` of the mechanic | `state.migrate` of the mechanic | `loadCivilization()` | Warning, `initial()` used | Warning, `initial()` used |
| Component state | `...scenes.<sceneId>.entities.<entityId>.states.<type>.version` | `state.version` of the behavior | `state.migrate` of the behavior | `BehaviorSystem.instantiate()`, when the scene is entered | Warning, `initial(props)` used | Warning, `initial(props)` used |
| Recorded only | `engineVersion`, `civs.<id>.packVersion` | – | – | never compared | – | – |

"Load refused" means a `SaveLoadError` (section 9). For mechanic and component states the load
continues: the saved state is replaced by the initial one and a warning is logged, so the old
state is gone after the next save.

Order of application:

```
storage.load(slot)
  └─ parseSave(raw)
       1. format === 'civverse.save'
       2. formatVersion is an integer, 1 ≤ formatVersion ≤ SAVE_FORMAT_VERSION
       3. FORMAT_MIGRATIONS[n] for n = formatVersion … SAVE_FORMAT_VERSION - 1
       4. GLOBAL_MIGRATIONS[n] for n = global.schemaVersion … GLOBAL_SCHEMA_VERSION - 1
       5. SaveGameSchema (current layout)
  └─ applySaveGame(save)
  └─ loadCivilization(currentCiv)
       6. migrateCivState(state, manifest.stateVersion, pack migrations)
       7. migrateVersioned(...) for each mechanic
       8. enterScene → migrateVersioned(...) for each component state of that scene
```

Because step 5 runs before step 6, a pack migration receives a `LocalCivState` that already matches
the engine's current layout. Packs change the content of their local state (variables, quests,
mechanic and scene states); the layout of `LocalCivState` itself is engine-owned and changes only
through `FORMAT_MIGRATIONS`.

### 8.2 Registered migrations

None in the engine or in the shipped packs:

- `FORMAT_MIGRATIONS` and `GLOBAL_MIGRATIONS` are empty objects (`= {}`).
- No pack passes `migrations` to `definePack()` (`civilizations/core/pack.ts`,
  `civilizations/door/pack.ts`, `civilizations/memory/pack.ts`), and every manifest has
  `"stateVersion": 1`.
- Every mechanic and behavior `state` spec is at `version: 1` with no `migrate` (engine behaviors in
  `src/engine/core/behaviors/`, pack mechanics and behaviors in `civilizations/*/mechanics/`).

The only migration step in the repository belongs to a test fixture: the mechanic `lanterne.oil` in
`tests/acceptance/fixtures/lanterne/mechanics/lantern.ts` (section 8.3).

### 8.3 Adding a migration step

The convention is the same at every level: `migrations[n]` converts version `n` into `n + 1`, and
the engine applies the steps in a loop, one version at a time.

#### Save layout (`formatVersion`)

1. In `src/engine/core/save/saveFormat.ts`, increase `SAVE_FORMAT_VERSION` and add the step to
   `FORMAT_MIGRATIONS`. The function receives the whole raw document (already a clone) and returns
   it; `parseSave()` sets `formatVersion` after each step.

   ```ts
   export const SAVE_FORMAT_VERSION = 2;

   const FORMAT_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
     // 1 → 2 (hypothetical example): every civilization state gains `notes: string[]`.
     1: (raw) => {
       for (const civ of Object.values((raw.civs ?? {}) as Record<string, Record<string, unknown>>)) civ.notes ??= [];
       return raw;
     },
   };
   ```

2. Update the interfaces (`SaveGame`, `LocalCivState`, ...), `SaveGameSchema` /
   `LocalCivStateSchema`, the capture code (`snapshotCivState()`, `buildSaveGame()`) and the restore
   code.
3. Add a test that parses a saved version-1 JSON fixture with `parseSave()`.

#### Multiverse (`global.schemaVersion`)

1. Increase `GLOBAL_SCHEMA_VERSION` in `src/engine/core/state/multiverse.ts` and add the step to
   `GLOBAL_MIGRATIONS` in `saveFormat.ts`. The function receives `global` and returns it;
   `parseSave()` sets `schemaVersion` after each step.

   ```ts
   const GLOBAL_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
     // 1 → 2 (hypothetical example): the protagonist gains a `name`.
     1: (g) => ({ ...g, protagonist: { ...(g.protagonist as Record<string, unknown>), name: null } }),
   };
   ```

2. Update `GlobalState`, `createGlobalState()`, `MultiverseState` and the `global` part of
   `SaveGameSchema`.

#### Civilization local state (`stateVersion`, pack-owned)

1. Increase `"stateVersion"` in the pack's `manifest.json`.
2. Add the step to `migrations` in the pack's `pack.ts`. `definePack` and the `LocalCivState` type
   are exported by `@sdk`.

   ```ts
   import { definePack, type LocalCivState } from '@sdk';

   export default definePack({
     modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', '!./**/*.test.ts'], { eager: true }),
     migrations: {
       // 1 → 2 (hypothetical example): variable "mypack.rank" renamed to "mypack.accessRank",
       // quest "OLD_Q" renamed to "NEW_Q".
       1: (s: LocalCivState): LocalCivState => {
         const { ['mypack.rank']: rank, ...vars } = s.vars;
         const { OLD_Q: oldQuest, ...states } = s.quests.states;
         return {
           ...s,
           vars: rank === undefined ? vars : { ...vars, 'mypack.accessRank': rank },
           quests: {
             states: oldQuest ? { ...states, NEW_Q: oldQuest } : states,
             tracked: s.quests.tracked === 'OLD_Q' ? 'NEW_Q' : s.quests.tracked,
           },
         };
       },
     },
   });
   ```

Do not change `stateVersion` inside a migration function. `migrateCivState()` increments
`s.stateVersion` itself after each step; a function that also increments it makes the loop skip the
next step.

#### Mechanic or component state (`state.version`)

Increase `state.version` and add the step to `state.migrate`. The function receives the saved state
(`unknown`) and returns the next version. The test fixture `lanterne.oil` is a working example:

```ts
// tests/acceptance/fixtures/lanterne/mechanics/lantern.ts
export const lanternMechanic = defineMechanic({
  id: 'lanterne.oil',
  label: 'Lanterne à huile',
  description: 'Une lanterne qui brûle de l’huile ; certaines portes ne s’ouvrent qu’à sa lumière.',
  state: {
    version: 2,
    initial: (): LanternState => ({ oil: 30, lit: false }),
    // Version 1 stored the fuel in litres under another name: 1 litre = 10 units of oil.
    migrate: { 1: (old) => ({ oil: Number((old as { fuel?: number }).fuel ?? 0) * 10, lit: false }) },
  },
  // settings, setup ...
});
```

`tests/acceptance/G-mechanics-extensibility.test.ts` replaces the saved entry with
`{ version: 1, state: { fuel: 2.5 } }`, loads it, and expects 25 units of oil.

Behaviors use the same shape (`defineBehavior({ state: { version, initial: (props) => ..., migrate } })`).
The engine's own behaviors (`core.door`, `core.npc`, `core.pickup`, ...) follow the same rule, and
their states are present in every save that contains those components. Without a step, the state is
reset to its initial value with a warning (section 8.1).

### 8.4 Content changes and existing saves

Saves refer to content by id. When a pack changes its content without a migration, this is what
happens on load:

| Saved reference | If the id no longer exists |
|---|---|
| `currentCiv` | Load error `core.error.civNotFound`. Other entries of `civs` are kept and written again unchanged. |
| `civs.<id>.scene` | Load error from `loadSceneDoc()`: `Scène inconnue dans "<pack>" : <id>`. |
| Keys of `scenes` | Kept and written again, unused. |
| Entity ids in `entities` and `removed` | Ignored; dropped the next time that scene is captured. |
| Component types in `states` | Ignored when the component is no longer on the entity or its behavior is no longer defined; dropped at the next capture. `overrides` stay while the component is still listed on the entity. |
| `voxelEdits` | Applied by coordinates; out-of-bounds edits are ignored. A changed scene layout is not detected. |
| `vars` | Restored and written again unchanged. |
| `inventory` item ids | Restored unchanged (not checked against the item registry). |
| Quest ids in `quests.states` | Dropped, with the warning `Sauvegarde : quête "<id>" inconnue, ignorée.` |
| `quests.states.*.stage` | Reset to the first stage, with the warning `Sauvegarde : étape "<stage>" de <id> inconnue, retour à la première étape.` |
| `quests.states.*.done` | Kept unchanged. |
| `quests.tracked` | Set to `null`. |
| `dialogue.seen`, `dialogue.chosen`, `rulesFired` | Kept unchanged. |
| Keys of `mechanics` | Ignored; dropped at the next save, without warning. |
| `player.abilities` | Dropped without warning. |
| `global.fragments`, `global.flags` | Kept unchanged. |

## 9. Error handling

Every `SaveLoadError` and every error thrown by `loadCivilization()` reaches
`GameController.fail()`, which logs it and shows the error screen (title `ui.error.title`, the
message, and a button back to the main menu).

| Situation | Detected in | Result | Message |
|---|---|---|---|
| Listing slots fails | `GameController.listSaves()` | Empty list, error logged | Log: `Lecture des sauvegardes impossible` |
| An IndexedDB operation throws | `BrowserSaveStorage.useFallback()` | localStorage used until the page is reloaded | Console: `[sauvegarde] IndexedDB indisponible, repli sur localStorage` |
| Empty slot | `GameController.loadSlot()` | Error screen | `ui.save.empty` |
| Data is not an object | `parseSave()` | Error screen | `Sauvegarde illisible (données absentes).` |
| `format` is not `civverse.save` | `parseSave()` | Error screen | `Ce fichier n’est pas une sauvegarde CIVILIZATIONVERSE.` |
| `formatVersion` is not an integer ≥ 1 | `parseSave()` | Error screen | `Version de sauvegarde invalide.` |
| `formatVersion` newer than the engine | `parseSave()` | Error screen | `Sauvegarde créée par une version plus récente du jeu (format N). Mettez le jeu à jour.` |
| No layout migration from version N | `parseSave()` | Error screen | `Aucune migration de sauvegarde depuis le format N.` |
| No multiverse migration from version N | `parseSave()` | Error screen | `Aucune migration de l'état multivers depuis la version N.` |
| Structure does not match the schema | `parseSave()` | Error screen, first 5 issues | `Sauvegarde corrompue ou incompatible : <path> : <message> ; ...` |
| `currentCiv` is unknown | `loadCivilization()` | Error screen | `core.error.civNotFound` |
| `currentCiv` is a library pack | `loadCivilization()` | Error screen | `"<id>" est une bibliothèque, pas une civilisation jouable.` |
| Local state newer than the pack | `migrateCivState()` | Error screen | `La sauvegarde de « <id> » provient d'une version plus récente de la civilisation (état N > M).` |
| No pack migration from version N | `migrateCivState()` | Error screen | `Aucune migration d'état pour « <id> » depuis la version N.` |
| Saved scene unknown | `loadSceneDoc()` | Error screen | `Scène inconnue dans "<pack>" : <id>` |
| Mechanic/component state newer than its definition | `migrateVersioned()` | Warning, initial state | `<label> : état sauvegardé plus récent (vN > vM), valeurs par défaut utilisées.` |
| No mechanic/component migration from vN | `migrateVersioned()` | Warning, initial state | `<label> : pas de migration depuis vN, valeurs par défaut utilisées.` |
| Unknown quest or stage | `QuestSystem.restore()` | Warning (section 8.4) | See section 8.4 |
| Writing a save fails | `GameController.save()` | Error logged, notification | Log: `Sauvegarde impossible`; notification `ui.save.failed` |

When `migrateCivState()` or a later step fails, `applySaveGame()` has already replaced the
multiverse and civilization states in memory with those of the save. Messages written as keys
(`ui.save.empty`, `core.error.civNotFound`, ...) are localized through `src/engine/locales/fr-FR.json`.

## 10. Example save (illustrative)

The values below come from a headless run of the test pack `testciv` defined in
`src/engine/core/sim/session.test.ts`: the scenario of the test
`saves and restores local and global state through the versioned save format`, extended with the
completion of quest `Q1`, `ctx.multiverse.setFlag('testciv.done', true)`, a prop override, one
persistent and one non-persistent `ctx.world.spawn()`, one `ctx.world.despawn()` and two
`ctx.world.setBlock()` calls. Floating-point numbers are rounded and short arrays are written on one
line. Saves of the `door` and `memory` civilizations are much larger.

```json
{
  "format": "civverse.save",
  "formatVersion": 1,
  "engineVersion": "0.1.0",
  "savedAt": "2026-10-12T05:48:34.880Z",
  "slot": "slot1",
  "label": "Civilisation de test — Le Village",
  "global": {
    "schemaVersion": 1,
    "protagonist": { "awakenings": 1, "title": null, "createdAt": "2026-10-12T05:48:34.687Z" },
    "fragments": {
      "test": { "civ": "testciv", "acquiredAt": "2026-10-12T05:48:34.786Z" }
    },
    "flags": { "testciv.done": true },
    "civs": {
      "testciv": { "started": true, "completed": false, "lastPlayed": "2026-10-12T05:48:34.717Z", "playTime": 2.1 }
    }
  },
  "currentCiv": "testciv",
  "civs": {
    "testciv": {
      "civId": "testciv",
      "packVersion": "1.0.0",
      "stateVersion": 1,
      "savedAt": "2026-10-12T05:48:34.879Z",
      "scene": "village",
      "player": { "position": [9.5, 1, 13.5], "yaw": -2.3562, "pitch": 0.4132, "abilities": [], "title": null },
      "vars": {
        "testciv.introSeen": true,
        "testciv.introDone": true,
        "testciv.metMira": true,
        "testciv.canOpen": true,
        "testciv.gateOpened": true
      },
      "inventory": [{ "id": "testciv:key", "count": 1 }],
      "quests": {
        "states": {
          "Q1": {
            "status": "completed",
            "stage": "s2",
            "done": ["s1/talk", "s2/through"],
            "startedAt": 0,
            "finishedAt": 0.4333,
            "history": ["testciv.q1.s1", "testciv.q1.s2"]
          }
        },
        "tracked": null
      },
      "dialogue": {
        "seen": ["mira_talk/route", "mira_talk/hello", "mira_talk/key"],
        "chosen": ["mira_talk/ask_key"]
      },
      "rulesFired": ["main/intro"],
      "mechanics": {
        "testciv.counter": { "version": 1, "state": { "ticks": 2, "doors": 1 } }
      },
      "scenes": {
        "village": {
          "entities": {
            "mira": {
              "position": [12.5, 1, 12.5],
              "yaw": -71.565,
              "states": { "core.npc": { "version": 1, "state": { "patrolIndex": 0 } } }
            },
            "gate_door": {
              "overrides": { "core.door": { "interactable": false } },
              "states": { "core.door": { "version": 1, "state": { "open": true } } }
            },
            "key_pickup": {
              "visible": false,
              "states": { "core.pickup": { "version": 1, "state": { "taken": true } } }
            },
            "dropped_key": {
              "position": [6.5, 1, 4.5],
              "yaw": 0,
              "states": { "core.pickup": { "version": 1, "state": { "taken": false } } }
            },
            "testciv_3k7sdbr": { "position": [7.5, 1, 4.5], "yaw": 0 }
          },
          "spawned": [
            {
              "id": "dropped_key",
              "position": [6.5, 1, 4.5],
              "rotation": [0, 0, 0],
              "components": { "core.pickup": { "item": "testciv:key" } }
            }
          ],
          "removed": ["gate_trigger"],
          "voxelEdits": [[3, 1, 4, "testciv:wall"], [15, 3, 20, null]]
        }
      },
      "playTime": 2.1
    }
  }
}
```

Reading notes:

- `global.fragments.test` was granted by `core.grantFragment` in the `onComplete` of stage `s2`,
  allowed by the manifest's `"globalWrites": ["fragments.test", "flags.testciv.*"]`.
- `player.yaw` and `player.pitch` are radians; `mira.yaw` is degrees. Mira's yaw differs from the
  scene document, so her transform is recorded.
- `gate_door` has no `position`: its transform did not change. Its `core.door` state is recorded
  anyway, as is every stateful component.
- `dropped_key` was spawned with `{ persistent: true }`: it is in `spawned` and in `entities`.
  `testciv_3k7sdbr` was spawned without an id or `persistent` (the generated id is
  `<civId>_<random>`): it only has an `entities` entry, which is ignored on load.
- `gate_trigger` was despawned, so it is in `removed`. Of the two voxel edits, one places a wall
  block and one clears a block (`null`).
- `rulesFired` holds rule `intro` of `content/logic/main.logic.json` (`once: true`).
- `startedAt` and `finishedAt` are simulation-clock seconds of the session that wrote the save.

## 11. Limitations

Observed in the current code:

1. Partial validation. `parseSave()` does not check the content of `quests.states`, `scenes` and
   `global.civs` (`z.unknown()`). A malformed entry passes and fails later during restore, with a
   generic error.
2. Unknown keys are handled differently by level. They are removed at the top level and inside
   `quests`, `dialogue`, inventory entries, fragment entries and mechanic entries (`z.object`),
   and kept inside `global`, `civs.<id>` and `player` (`z.looseObject`). This does not fully
   match the header comment "unknown entries are kept or reported".
3. A `global.schemaVersion` newer than `GLOBAL_SCHEMA_VERSION` is accepted without warning, unlike
   `formatVersion` and `stateVersion`.
4. `engineVersion` and `packVersion` are recorded but never compared with the running engine or
   pack.
5. Pack local-state migrations run only when the civilization is entered, not when the file is
   read. When one fails, the save's global and local states are already applied in memory.
6. Mechanic and component states that are newer than their definition, or have no migration step,
   are reset to their initial value with only a log warning. The header comment says failed
   migrations abort the load; that is true only for the layout, multiverse and civilization
   levels.
7. Some data is dropped without warning at the next save: states of mechanics that no longer exist,
   abilities that are no longer defined, and scene entries for entities or components that no
   longer exist. Unknown quests are dropped with a warning.
8. `BrowserSaveStorage` treats any exception in an IndexedDB operation as "IndexedDB unavailable",
   including a `JSON.parse` error on a corrupted entry or a `slotInfo()` error on an entry without
   `civs`. One corrupted entry switches the instance to localStorage for the rest of the page
   session: IndexedDB saves are hidden and new saves go to localStorage. Loading the corrupted slot
   reads the localStorage entry of the same slot instead; when there is none, the player sees
   `ui.save.empty` rather than a corruption error. The two stores are never reconciled.
9. `GameController.finishCiv()` calls `save('auto')` after `unloadCivilization()`, but `save()`
   returns `false` when no civilization is active. That second save never happens: the autosave
   written just before the unload still has `currentCiv` set to the finished civilization, so
   « Continuer » reloads it.
10. Nothing loads the `auto` save at startup. Choosing a civilization through the main menu's
    « Civilisations » entry, without « Continuer », starts from the in-memory state (a new
    multiverse after a page load), and `startCiv()` then autosaves over `auto`. Manual slots are
    not affected.
11. Dialogues and cinematics in progress, timers, cooldowns and the other items of section 6.2 are
    not saved. Autosave can run in the middle of a dialogue or cinematic (on `quest.stageChanged`),
    and the pause menu can be opened during a cinematic when the pointer lock is released, so a
    save can be taken at such a moment.
12. No integrity check (checksum), no backup or rotation of earlier saves, no compression, no
    export/import of save files, and no way to delete a manual slot. Every save rewrites the whole
    document, including the states of all visited scenes of all known civilizations.
13. `global.protagonist.title` is never written.
14. Quest `startedAt` and `finishedAt` use the simulation clock of the session that wrote them; the
    clock is not saved, so values written in different sessions are not comparable.
15. Test coverage of the versioning code is partial (section 7.5): only one mechanic-state
    migration and four `parseSave()` rejections are tested. The layout, multiverse and
    civilization-level migration loops and the storage fallback are not.
