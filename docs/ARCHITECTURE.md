# CIVILIZATIONVERSE — Architecture

Developer reference for the engine, the civilization packs and Civilization Studio. It is meant for
anyone (human or AI session) who has to extend the project without breaking it.

- Every statement points at the code that implements it. When something is partial, missing or
  inconsistent, it is listed in [§14 Limitations](#14-limitations-and-known-inconsistencies).
- Verified against the repository on 2026-10-12 (commit `0f92dd7`).
- Architecture decisions and their rationale: [DECISIONS.md](DECISIONS.md).
- Companion documents: [MECHANICS_SDK.md](MECHANICS_SDK.md),
  [HOW_TO_ADD_A_NEW_MECHANIC.md](../HOW_TO_ADD_A_NEW_MECHANIC.md),
  [HOW_TO_CREATE_A_CIVILIZATION.md](../HOW_TO_CREATE_A_CIVILIZATION.md), [PACK_FORMAT.md](PACK_FORMAT.md),
  [SAVE_FORMAT.md](SAVE_FORMAT.md), [VERSIONING.md](VERSIONING.md), [EDITOR_GUIDE.md](EDITOR_GUIDE.md),
  [STORY_AUTHORING.md](STORY_AUTHORING.md).
- Narrative specifications of the two civilizations (French): `docs/narrative/`.
- The player-facing game is French (`fr-FR`); code, identifiers and developer docs are English.
  Studio labels are French.

## Contents

1. [Repository map](#1-repository-map)
2. [Layers and dependency rules](#2-layers-and-dependency-rules)
3. [Runtime data flow](#3-runtime-data-flow)
4. [Simulation core](#4-simulation-core-srcenginecore)
5. [Civilization packs: loading, isolation, state](#5-civilization-packs-loading-isolation-state)
6. [Content model](#6-content-model)
7. [Saves](#7-saves)
8. [View layer: rendering, audio, input](#8-view-layer-rendering-audio-input)
9. [Civilization Studio](#9-civilization-studio)
10. [Builds, scripts and CLI](#10-builds-scripts-and-cli)
11. [Tests](#11-tests)
12. [Performance design](#12-performance-design)
13. [Where to change what](#13-where-to-change-what)
14. [Limitations and known inconsistencies](#14-limitations-and-known-inconsistencies)

---

## 1. Repository map

| Path | Role |
|---|---|
| `index.html` → `src/game/main.tsx` | The game. Always built. |
| `studio.html` → `src/studio/main.tsx` | Civilization Studio (editor). Served by the dev server; built only with `CIV_BUILD_STUDIO=1`. |
| `src/engine/core/` | Headless simulation: pure TypeScript + Zod. |
| `src/engine/view/` | Babylon.js rendering of a session (`GameView` and the renderers it composes). |
| `src/engine/audio/audioEngine.ts` | WebAudio synthesis of procedural sound and music recipes. |
| `src/engine/input/inputManager.ts` | Keyboard/mouse input, pointer lock, bindings. |
| `src/engine/platform/` | Browser and Vite adapters: content providers, IndexedDB saves, settings, dev API client and the write rules it shares with the dev server (`devApiRules.ts`). |
| `src/engine/locales/fr-FR.json` | Engine and game UI strings. |
| `src/sdk/` | Public API for packs: `@sdk` (`index.ts`), `@sdk/ui` (`ui.tsx`), `@sdk/view` (`view.ts`); `@sdk/build` (`build.ts`, `buildKit.ts`) for seed scripts. |
| `src/game/` | React game UI, `GameController`, zustand UI store. |
| `src/studio/` | Civilization Studio: controller, working copies, undo, editors, 3D viewport, playtest. |
| `civilizations/core/` | Library pack (`"kind": "library"`): shared blocks, models, sounds, music, character appearances. |
| `civilizations/door/`, `civilizations/memory/` | The two playable civilization packs. |
| `tools/vite/` | Alias table, Studio dev-server plugin (file API, type checking, script scaffolding, HMR events). |
| `tools/cli/` | `npm run civ` command line: `validate`, `seed`, `new-pack`, `bench`. |
| `tests/` | Vitest suites that do not live next to the code (see [§11](#11-tests)). |

## 2. Layers and dependency rules

| Layer | Path | May import | Notes |
|---|---|---|---|
| Simulation core | `src/engine/core` | other core modules, `zod`, the JSON table `src/engine/locales/fr-FR.json` | No Babylon, no React, no DOM. Runs in Node (Vitest uses `environment: 'node'`) and in the browser. |
| View | `src/engine/view` | core, `@babylonjs/core`, `src/engine/audio`, `src/engine/input`, the settings type | Core never imports it. |
| Audio / input | `src/engine/audio`, `src/engine/input` | core types (audio); the `GameAction` type of `platform/settings.ts` (input) | WebAudio / DOM events. |
| Platform | `src/engine/platform` | core, `idb-keyval`, Vite `import.meta.glob`, `fetch`; `settings.ts` uses types from view and audio | Adapters only. |
| SDK | `src/sdk` | re-exports from core; `@sdk/view` also re-exports Babylon classes and types from `src/engine/view/entityViews.ts`; `@sdk/ui` uses React and re-exports `keyLabel` from `src/engine/input/inputManager.ts` | The only surface packs code against. |
| Game | `src/game` | engine layers, `@sdk/ui` (`CivUiContext`) | Never imports `src/studio`. |
| Studio | `src/studio` | engine layers, `src/game` (the playtest mounts the real game controller and HUD), `@babylonjs/core` (viewport, character preview in `editors/DataEditors.tsx`), `monaco-editor` (dev only) | |
| Packs | `civilizations/<id>/` | `@sdk`, `@sdk/ui`, `@sdk/view`, `react`, their own modules and CSS | ESLint forbids engine, game and Studio imports (below). |
| Seeds | `civilizations/<id>/seed/` | `@sdk/build` | Node scripts run by `tsx`; excluded from `tsconfig.json`, type-checked through `tsconfig.node.json`. |
| Tools | `tools/` | Node, Vite, the TypeScript compiler API, engine core and `GlobContentProvider` (CLI), `src/engine/platform/devApiRules.ts` (dev plugin) | |

Core purity was checked by searching `src/engine/core`: apart from relative imports, the only
runtime import is `zod` (tests import `vitest`); there is no reference to `@babylonjs`, React,
`window`, `document`, `localStorage` or `requestAnimationFrame`. The only import leaving the folder
is `session.ts` → `../../locales/fr-FR.json` (data).

Only the pack rule is enforced by tooling (`eslint.config.js`):

```js
    // Civilization packs may only use the public SDK, never engine internals.
    files: ['civilizations/**/*.{ts,tsx}'],
    ignores: ['civilizations/*/seed/**', 'civilizations/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@engine/*', '../../src/*', '../../../src/*'], message: 'Les packs utilisent uniquement @sdk (API publique).' },
            { group: ['@studio/*', '@game/*'], message: 'Les packs ne dépendent pas du Studio ni du jeu.' },
```

Seeds and pack tests are exempt: pack tests (`civilizations/*/tests/*.test.ts`) import `@engine/*`,
seeds import `@sdk/build`.

### Path aliases

Defined twice and kept in sync by hand: `paths` in `tsconfig.json` and `civAliases` in
`tools/vite/aliases.ts` (used by Vite, Vitest and the CLI).

| Alias | Target |
|---|---|
| `@sdk` | `src/sdk/index.ts` |
| `@sdk/*` | `src/sdk/*` |
| `@engine/*` | `src/engine/*` |
| `@game/*` | `src/game/*` |
| `@studio/*` | `src/studio/*` |
| `@civs/*` | `civilizations/*` (declared, unused in code) |

## 3. Runtime data flow

```
                    GameController (src/game/controller.ts)
            owns ┌──────────────┼──────────────────────────┐
                 ▼              ▼                          ▼
          GameSession      GameView (Babylon)         SaveStorage
          (headless)       src/engine/view/gameView.ts  BrowserSaveStorage | MemorySaveStorage
             │   ▲               │  reads session state every frame (pull)
             │   └───────────────┘  update(dt), handleKey(), interaction.interact()
             │
             ├─ PresentationBus ──► GameView.onPresentation  (audio, shake, fov, vignette,
             │   (push)            │                          environment, voxelsChanged, custom)
             │                     └► handlePresentationForUi (fade, flash, tint, barks → zustand)
             │
             └─ UiBridge = ReactUiBridge ──► useUi (zustand, src/game/state/uiStore.ts) ──► React HUD
```

| Direction | Mechanism | Carries |
|---|---|---|
| Core → view (push) | `session.presentation.emit(req)`; `PresentationRequest` in `src/engine/core/sim/presentation.ts` | `sound`, `stopSound`, `music`, `ambience`, `fx`, `animation`, `expression`, `bark`, `environment`, `custom`, `voxelsChanged` |
| View ← core (pull) | `GameView.frame()` compares `session.world` with the world it rendered and rebuilds on change; `EntityViewManager.sync()` follows entity `revision`/`propsRevision`; `CameraRig.update()` reads `session.cinematics.cameraPose()` and the player | geometry, transforms, camera |
| Core → UI (push) | `UiBridge` (`src/engine/core/sim/uiBridge.ts`), implemented by `ReactUiBridge` (`src/game/state/uiStore.ts`) | notifications, location title, documents, panels, HUD registration, end screen, confirm, `resetCiv` |
| UI ← core (subscribe) | hooks in `src/game/hooks.ts`: `session.onChange`, `dialogue.onChange`, `quests.onChange`, `interaction.onChange`, `i18n.onChange` | dialogue panel, objectives, interaction prompt, screen refresh |
| UI / view → core | `GameController` methods, `session.handleKey`, `session.interaction.interact`, `session.dialogue.advance/choose`, `session.closePanel` | player input and choices |

The zustand store `useUi` only holds UI-shell state (screen, overlay, notifications, panels, HUD
registrations, fades, barks, debug flag). Pack HUD and panel components receive the civilization's
`CivContext` through `CivUiContext` (`src/sdk/ui.tsx`) and read it with `useCiv`, `useT`, `useVar`,
`useUiStore`, `useEventRefresh`.

### Frame order

`GameView.frame()` (`src/engine/view/gameView.ts`), abridged:

```ts
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    if (session.world !== this.world) {
      if (session.world) this.buildWorld(session.world);
      else this.clearWorld();
    }
    if (this.world && !session.isLoading) {
      this.handleInput();
      session.update(dt);
      this.voxels?.update();
      this.entities?.sync(dt);
      this.env?.update(dt);
      this.rig.update(session, dt);
      // …ambient particles follow the camera…
      this.audio.update(this.rig.camera.position, session.player.forward);
      this.updateColliderDebug();
    }
    this.input.endFrame();
    this.scene.render();
```

`GameSession.update()` (`src/engine/core/sim/session.ts`) runs, in this order:

```ts
    if (!this.civ || !this.world || this.loading) return;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    if (this._paused) return;
    this.civ.playTime += dt;
    this.multiverse.addPlayTime(this.civ.id, dt);
    this.clock.advance(dt);
    // … player physics, 'player.jumped' / 'player.landed' events, player collider …
    this.behaviors.update(dt);
    this.behaviors.updateMotors(dt);
    this.cinematics.update(dt);
    this.interaction.refresh();
    const region = world.flushLight();
    if (region) this.presentation.emit({ type: 'voxelsChanged', min: region.min, max: region.max });
```

### Headless runs

| Piece | Where | Role |
|---|---|---|
| `HeadlessUi` | `src/engine/core/sim/uiBridge.ts` | `UiBridge` that records notifications, locations, documents, panels, HUDs and end screens, resolves promises immediately, answers `confirm()` with `confirmAnswer`. |
| Presentation recording | `PresentationBus(record)`; on by default when `mode === 'headless'` | `history()` lets tests assert that a sound or fade was requested. |
| Test helpers | `src/engine/core/testing/headless.ts` | `createHeadlessGame`, `advance(session, seconds, step = 1/30)` (fixed steps), `flush`, `skipCinematics`, `advanceDialogue`, `choose`, `talk`, `walkTo` (A* reachability check, throws on dead ends), `face`. |

Headless sessions (`mode: 'headless'` with `HeadlessUi`) are also what `npm run validate`
(`tools/cli/validateRunner.ts`) and the Studio's validation (`src/studio/core/validation.ts`) boot.

`RunMode` (`'play' | 'playtest' | 'headless'`, `src/engine/core/sim/api.ts`) only changes two things
in the engine: whether `LogHub` echoes to the console (not headless) and whether presentation
requests are recorded (headless). Packs can read it as `ctx.mode`.

## 4. Simulation core (`src/engine/core`)

| Area | Files | Main exports |
|---|---|---|
| Session | `sim/session.ts` | `GameSession`, `ActiveCiv`, `SessionOptions` |
| Time | `sim/clock.ts` | `SimClock` |
| Events | `events/eventBus.ts`, `events/eventMap.ts` | `EventBus`, `ScopedEvents`, `CivEventMap` |
| Presentation / UI bridge | `sim/presentation.ts`, `sim/uiBridge.ts` | `PresentationBus`, `UiBridge`, `HeadlessUi` |
| Runtime API for packs | `sim/api.ts`, `sim/contexts.ts` | `CivContext`, `BehaviorContext`, `EntityApi`; `createCivContext`, `createBehaviorContext`, `createEntityApi` |
| Components | `sim/behaviorSystem.ts`, `sim/builtins.ts`, `behaviors/*.ts` | `BehaviorSystem`, `ENGINE_BEHAVIORS` (17 `core.*` components), `registerEngineBuiltins` |
| World | `world/sceneWorld.ts`, `world/entity.ts`, `world/sceneVoxels.ts` | `SceneWorld`, `RuntimeEntity`, `ComponentRecord`, `volumeFromDoc`, `volumeToDoc` |
| Interaction | `sim/interaction.ts` | `InteractionSystem` (ray of `INTERACT_DISTANCE = 3.2`) |
| Player, physics | `sim/player.ts`, `physics/*.ts` | `PlayerController`, `KinematicBody`, `CollisionWorld`, `ColliderSet`, `MovementModifier` |
| Navigation | `nav/pathfinder.ts`, `sim/npcMotor.ts` | `findPath` (A*), `NpcMotor` |
| Logic | `logic/*.ts` | `LogicRegistry`, `LogicInterpreter`, `RuleEngine`; `coreActions` (54), `coreConditions` (20), `coreEvents` (36) |
| Story | `story/dialogue.ts`, `story/quests.ts`, `story/cinematics.ts` | `DialogueSystem`, `QuestSystem`, `CinematicSystem` |
| State | `state/variables.ts`, `state/multiverse.ts` | `VariableStore`, `MultiverseState`, `GlobalState` |
| Inventory | `inventory/items.ts` | `ItemRegistry`, `Inventory`, `IconSpec` |
| Voxels | `voxel/*.ts`, `voxel/textures/*.ts` | `VoxelVolume`, `BlockRegistry`, `meshChunk`, `LightField`, `encodeRle`/`decodeRle`, `buildAtlas`, `generateTile`, `ModelRegistry`, `buildModel`, `raycastVoxels`, construction kit |
| Props | `props/props.ts` | `prop.*`, `normalizeProps`, `InferProps` |
| Packs | `packs/pack.ts`, `packs/definitions.ts`, `packs/validate.ts`, `packs/memoryProvider.ts` | `definePack`, `ContentProvider`, `loadPack`, `collectDefinitions`, `define*`, `validateCivilization`, `MemoryContentProvider` |
| Content schemas | `content/schemas.ts` | Zod schemas and inferred doc types |
| Saves | `save/saveFormat.ts`, `save/storage.ts` | `SaveGame`, `LocalCivState`, `parseSave`, `migrateCivState`, `migrateVersioned`, `MemorySaveStorage` |
| Localization | `i18n/localizer.ts` | `Localizer` |
| Audio data | `audio/recipes.ts` | `SoundRecipe`, `MusicRecipe` (data only) |
| Utilities | `util/*.ts` | `DisposableScope`, `LogHub`, `Rng`, `satisfies`, id regexes, JSON helpers |
| Versions | `version.ts` | `ENGINE_VERSION = '0.1.0'`, `ENGINE_API_VERSION = '1.0.0'` |

### 4.1 Clock and time step

- There is **no fixed-step accumulator** in the game loop. Each rendered frame calls
  `session.update(dt)` with the frame delta, clamped to 0.1 s by both `GameView.frame()` and
  `GameSession.update()`.
- The character body sub-steps internally: `KinematicBody.step()` (`src/engine/core/physics/body.ts`)
  splits `dt` into steps of at most `MAX_SUBSTEP = 1 / 120` s.
- `SimClock` (`src/engine/core/sim/clock.ts`) is the only time source for gameplay. Time advances only
  through `advance(dt)`: it runs `onUpdate` callbacks, then fires due timers in time order (callbacks
  may schedule new timers; a guard stops after 10 000 firings per advance). `after`, `every` and `wait`
  are in simulation time, so they stop while the session is paused.
- Headless tests get reproducible timing from `advance()` in `testing/headless.ts`, which steps the
  session in fixed increments (default 1/30 s) and flushes microtasks between steps.
- The session is paused only through `setPaused(reason, paused)` (reasons stack). The callers are
  `GameController.openOverlay` / `closeOverlay` (reason `menu`: pause menu, journal, inventory,
  settings, save/load) and `GameSession.openPanel` / `closePanel` (reason `panneau:<id>`, for every
  pack panel whose `pausesGame` is not `false`).

### 4.2 Events

`EventBus` (`src/engine/core/events/eventBus.ts`) is synchronous. Payloads are typed for the names in
`CivEventMap` (`eventMap.ts`); other names are allowed with a `Record<string, unknown>` payload (this
is what data-defined rules emit). A throwing handler is reported and does not stop delivery.
Re-entrant emission is refused beyond depth 64 (protection against rule loops). `onAny` is used by
the `RuleEngine` and by the session itself, which re-evaluates quests on every event whose name does
not start with `ui.`. Pack code receives `ScopedEvents`, which registers each subscription in the
civilization's `DisposableScope`.

### 4.3 World and entities

`SceneWorld` (`src/engine/core/world/sceneWorld.ts`) is the loaded scene: the `VoxelVolume` decoded
from the scene document, the `LightField`, the `ColliderSet` and `CollisionWorld`, the
`RuntimeEntity` map, `voxelEdits` (cell index → block id, the runtime diff against the document) and
`removedEntities`. `RuntimeEntity` (`world/entity.ts`) wraps an `EntityDoc`: transform, visibility,
enabled flag, component records, collider parts, a `view` object read by the renderer (animation,
expression, look-at, speed, free-form `flags` that visuals can read but no API writes) and
`revision`/`propsRevision` counters.

### 4.4 Components (behaviors)

A component type is a `BehaviorDefinition` created with `defineBehavior({ id, props, state?, create })`
(`src/engine/core/packs/definitions.ts`). `BehaviorSystem.instantiate()`:

1. normalizes the scene props against the prop schema and applies saved runtime overrides;
2. restores or initializes the versioned per-entity state (`migrateVersioned`);
3. creates the instance with a `BehaviorContext` whose scope is a child of the entity scope.

`BehaviorInstance` hooks: `update`, `interaction` (offers), `beforeInteract` (veto, used by locks),
`onInteract`, `decorateOffer`, `onPropsChanged`, `onVisibilityChanged`, `dispose`, plus an optional
public `api` returned by `entity.behavior(type)`. An unknown component type is kept as data with a
warning. A component that throws while being created, updated, asked for offers, decorating an
offer, or reacting to a props or visibility change is marked `faulted`; faulted components are no
longer updated nor asked for offers, decorations or vetoes.

Engine components (`ENGINE_BEHAVIORS` in `src/engine/core/sim/builtins.ts`): `core.spawn`,
`core.marker`, `core.model`, `core.collider`, `core.light`, `core.sound`, `core.particles`,
`core.sign`, `core.door`, `core.portal`, `core.npc`, `core.interactable`, `core.pickup`,
`core.readable`, `core.trigger`, `core.zone`, `core.conditional`, `core.ladder`. They are registered with owner
`engine`. Do not confuse them with asset ids such as `core:stone`, which come from the
`civilizations/core` library pack.

### 4.5 Logic

Logic stored in content is plain data: `{ "type": "core.setVar", ...fields }`
(`src/engine/core/logic/types.ts`); an action may also carry a designer `note`, edited in the Studio
(« Note ») and ignored when it runs. `LogicInterpreter` (`logic/interpreter.ts`):

- looks the type up in `LogicRegistry`, normalizes the fields with the type's prop schema;
- resolves `"$self"`, `"$player"` and `"$event.<path>"` from the `LogicScope`;
- runs action lists sequentially, awaiting async actions; an unknown or failing action stops its list
  and is logged with its origin;
- skips actions with `essential: false` while a skipped cinematic is fast-forwarded;
- records executed actions and rules, and conditions that fail to evaluate, in a 300-entry ring
  buffer shown in the F3 debug overlay (« Logique récente », development only); failures are also
  logged.

`RuleEngine` (`logic/rules.ts`) implements `when` (event + `where` filter) / `if` / `then` / `else`,
with `once` (fired ids are saved) and an optional `scene` restriction.

### 4.6 Story systems

| System | File | Behavior |
|---|---|---|
| Dialogue | `story/dialogue.ts` | Graph of nodes (speaker, text key, actions, `next`, conditional `branches`, `choices`). The UI renders `view()` and calls `advance()` / `choose()`; tests call the same methods. Seen nodes and chosen choices are saved. |
| Quests | `story/quests.ts` | Stages of objectives completed by actions, by conditions re-evaluated on events, or by event matchers; stage completion `all` or `any`. State, history and tracked quest are saved. |
| Cinematics | `story/cinematics.ts` | Tracks: camera, subtitle, actor, audio, fx, actions, played in time order whatever their order in the file (`sortedTracks`); a camera key without `fov` keeps the previous key's (`cameraKeyFov`, also used by the Studio's cinematic editor). Skipping runs the remaining essential actions, moves actors to their final positions, applies the last music cue and runs `onComplete`. While a cinematic plays, movement and look input are ignored (only the skip key is read), unless it has `lockPlayer: false`. |

### 4.7 Variables and multiverse

`VariableStore` (`state/variables.ts`) holds named JSON values (`door.rank`). Types can be declared;
watchers exist per name and per prefix. Names starting with `global.` are read-only views of
`MultiverseState` (`state/multiverse.ts`), see [§5.6](#56-global-vs-local-state).

## 5. Civilization packs: loading, isolation, state

### 5.1 Pack layout

| Entry | Purpose |
|---|---|
| `manifest.json` | Identity, `kind` (`civilization` or `library`), `engineApi` range, `dependencies`, `entry` scene/spawn, `scenes`, `stateVersion`, `globalWrites`, `fragments`, `theme`, `cover`, `hud.hide`, `order`, `credits`, `tags` (`ManifestSchema`). |
| `pack.ts` | `export default definePack({ modules, migrations? })`. |
| code folders | Auto-discovered by the pack's own `import.meta.glob`. |
| `content/` | Scenes, dialogues, quests, cinematics, logic, prefabs, `items.json`, `characters.json`, `rules.json`. |
| `locales/fr-FR.json` | String table; required for civilizations. |
| `seed/` | Node scripts that generate the first version of scenes and cinematics ([§6.4](#64-seeds)). |
| `tests/` | Headless playthrough tests. |

Which code folders are loaded is decided by each `pack.ts`, not by the engine:

| Pack | Globbed folders |
|---|---|
| `civilizations/core/pack.ts` | `mechanics/`, `models/` (core keeps its blocks and sounds in `mechanics/blocks.ts` and `mechanics/sounds.ts`) |
| `civilizations/door/pack.ts`, `civilizations/memory/pack.ts` | `mechanics/`, `assets/`, `ui/`, `view/` |
| Template written by `npm run civ -- new-pack` (`tools/cli/newPack.ts`) | `mechanics/`, `assets/`, `ui/`, `view/` |

```ts
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
```

`collectDefinitions()` walks every export of those modules (arrays included) and sorts the values
by their `__kind` brand, so adding a file is enough to register what it exports.

### 5.2 What a pack can contribute

| Helper | Import | Registered | From library packs? |
|---|---|---|---|
| `defineBlock`, `defineModel`, `defineSound`, `defineMusic`, `defineItem` | `@sdk` | Session registries, owner = pack id | Yes |
| `defineAction`, `defineCondition`, `defineEvent` | `@sdk` | `LogicRegistry` | Yes |
| `defineBehavior` | `@sdk` | `session.behaviorDefs` | Yes |
| `defineVisual`, `defineViewEffect` | `@sdk/view` | `session.visuals`, `session.viewEffects` | Yes |
| locale tables | `locales/*.json` | `Localizer` namespace = pack id | Yes |
| `defineMechanic` | `@sdk` | `setup()` called when the civilization starts | **No** — only the active civilization's |
| `defineHud`, `definePanel` | `@sdk/ui` | `UiBridge.registerHud`, panel map | **No** — only the active civilization's |
| `defineAbility` | `@sdk` | ability map | **No** — only the active civilization's |

Registering an id already owned by another pack is refused (`LogicRegistry.assertFree`, the
`behaviorDefs` check in `GameSession.registerPack`); each registration is wrapped so one failure
does not stop the others. When a pack loads, `checkDefinitionIds()` (`packs/pack.ts`) reports as
content errors (file `pack.ts`) every type id that is not `<pack>.<name>` and every asset id that is
not `<pack>:<name>` with the pack's own id (`TYPE_ID_RE`, `ASSET_ID_RE`, `packOfType`, `packOfAsset`
in `util/ids.ts`); such definitions are still registered.

### 5.3 Content providers

All content access goes through `ContentProvider` (`src/engine/core/packs/pack.ts`):
`listManifests`, `loadPackModule`, `listFiles`, `readJson`.

| Provider | File | Used by |
|---|---|---|
| `GlobContentProvider` | `src/engine/platform/globContent.ts` | Game, tests, CLI. Manifests are eager `import.meta.glob` imports; `pack.ts` and content JSON are lazy chunks. |
| `DevContentProvider` | `src/studio/core/devContent.ts` | Studio under `npm run dev`: JSON read from disk through the dev file API; `pack.ts` re-imported as `/civilizations/<id>/pack.ts?studio=<n>` after a code change. |
| `OverlayContentProvider` | `src/engine/platform/overlayContent.ts` | Studio playtest and Studio validation: unsaved documents layered over another provider. |
| `MemoryContentProvider` | `src/engine/core/packs/memoryProvider.ts` | Engine tests (`session.test.ts`). |

### 5.4 Lifecycle

From the header of `src/engine/core/sim/session.ts`:

```
 *   register (manifests) → validate → load (code + content) → initialize (mechanics)
 *   → start (enter scene) → pause/resume → save → unload → dispose
```

1. **`GameSession.create(opts)`** registers the engine built-ins, then `refreshManifests()`: each
   manifest is validated with Zod (the pack ids `engine`, `global` and `ui` are reserved), its
   `engineApi` range is checked against `ENGINE_API_VERSION` with `satisfies()`, and the pack's
   name, description, tagline and fragment strings are loaded under the namespace `<id>#manifeste`
   (so the selection screen can show them before the pack loads).
2. **`loadCivilization(civId, opts)`** (`opts`: `fresh`, `scene`, `spawn`, `place`, `quietStart`)
   unloads the current civilization, then `ensurePack()` loads dependencies first (cycles are
   reported) and calls `loadPack()`: pack module → `collectDefinitions` → `checkDefinitionIds`;
   every content file except scenes is read and validated (problems become `ContentIssue`s); a
   civilization without `locales/fr-FR.json` or with a declared scene that has no file gets an
   error. `registerPack()` adds definitions with the pack id as owner. Packs stay cached in
   `loadedPacks`.
3. The saved local state, if any, is migrated with `migrateCivState()` and the pack's `migrations`.
4. A `DisposableScope('civ:<id>')`, the `ActiveCiv` record and its `CivContext` are created.
5. Variables, inventory, quests, dialogue memory, fired rules and player title are restored.
6. Mechanic settings are read from `content/rules.json` and normalized against each mechanic's
   `settings` schema.
7. Mechanics are set up in `dependsOn` order; a failing `setup` is logged and recorded in `failed`
   (`ctx.mechanics.get(id)` then returns `undefined`; validation reports it as an error).
8. HUDs are registered (into the scope), `manifest.hud.hide` is applied, abilities are granted
   (`autoGrant` and saved ones), logic rules are loaded.
9. The multiverse records the start (and an "awakening" the first time).
10. `enterScene()` loads the scene document on demand, applies the saved scene diff, creates the
    scene scope and the entities with their components, computes light, places the player, runs the
    `sceneEnter` lifecycle callbacks, emits `scene.entered` and requests the scene music and ambience.
11. `start` lifecycle callbacks run, `civ.started` is emitted (not with `quietStart`), quests are
    evaluated.

If anything throws, the civilization is unloaded (keeping its state) and the error is rethrown;
`GameController` shows the error screen.

### 5.5 Isolation and what a switch cleans up

Everything a civilization registers through its context goes into a `DisposableScope`
(`src/engine/core/util/disposable.ts`). Scopes form a tree and are disposed in reverse order:

```
civ:<civId>                      created in loadCivilization, disposed in unloadCivilization
└─ civ:<civId>/scene:<sceneId>   created in enterScene, disposed in exitScene
   └─ …/entité:<entityId>        BehaviorSystem.instantiate
      └─ …/<componentType>       one per component instance (its BehaviorContext)
```

Registering into an already disposed scope disposes the item immediately and reports an error.

`unloadCivilization()` (also called before loading another civilization):

| Step | Released |
|---|---|
| Snapshot | Local state saved into `session.civStates` (unless `keepState: false`). |
| Callbacks | `unload` lifecycle callbacks, `civ.unloading` event. |
| Story | Running dialogue and cinematic aborted. |
| Scene | `exitScene()`: `sceneExit` callbacks, `scene.exiting`, scene state captured, every component instance disposed, NPC motors dropped, scene scope disposed, interaction target reset. |
| Panels | Pending `openPanel` promises resolved with `null`, panels closed, panel movement locks released. |
| Scope | `civ.scope.dispose()`: listeners, timers, `onUpdate` callbacks, movement modifiers and locks, input bindings and handlers, lifecycle callbacks, HUD registrations, UI-store subscriptions, looping sounds. |
| Systems | Rules unsubscribed, quests emptied, variables and declarations of the `<civId>.` namespace cleared, inventory cleared, dialogue memory reset, player civilization state reset (base movement, modifiers, locks, abilities, cooldowns, title). |
| UI | `ui.resetCiv(civId)` removes the civilization's panels, HUDs, hidden-HUD list, document, barks, fade and tint. |
| Registries | `unregisterPack(civId)`: blocks, models, items, actions, conditions, events, components, sounds, music, visuals, view effects and locale table owned by the civilization. |
| Session | Pause reasons and pressed input actions cleared, `session.civ = null`. |

What survives a switch: library packs (e.g. `core`) stay registered; the multiverse state;
`session.civStates` (in memory until the game is saved); the `<id>#manifeste` strings.

Isolation is tested in `src/engine/core/sim/session.test.ts` (`leakedListeners`,
`clock.timerCount`, `player.modifierCount`, registry lookups after a switch) and on the real packs
in `tests/acceptance/F-civilization-isolation.test.ts`.

Guards on writes:

| Rule | Where |
|---|---|
| A civilization writes only `<civId>.*` variables | `vars.set` / `vars.declare` in `src/engine/core/sim/contexts.ts` |
| `global.*` variables are read-only | `VariableStore.set` throws |
| Global fragments and flags only as declared in `globalWrites` (`"fragments.threshold"`, `"flags.door.*"`) | `isWriteAllowed`, `grantFragment`, `setFlag` in `src/engine/core/state/multiverse.ts` |

### 5.6 Global vs local state

| | Global (multiverse) | Local (per civilization) |
|---|---|---|
| Type | `GlobalState` (`src/engine/core/state/multiverse.ts`) | `LocalCivState` (`src/engine/core/save/saveFormat.ts`) |
| Content | protagonist (awakenings, title, createdAt), fragments, flags, per-civilization progress (started, completed, lastPlayed, playTime) | scene, player (position, look, abilities, title), variables, inventory, quests, dialogue memory, fired rules, mechanic states, scene diffs, play time |
| In memory | `session.multiverse` | `session.civ` while running, `session.civStates` otherwise |
| Read by packs | `ctx.multiverse.*`, `global.*` variables | `ctx.vars`, `ctx.inventory`, … |
| Written by packs | `grantFragment`, `setFlag` (permission-checked), `markCompleted` | freely, inside the civilization's namespace |
| Versioning | `schemaVersion` (`GLOBAL_SCHEMA_VERSION = 1`) | manifest `stateVersion` + pack `migrations`; per mechanic/component `state.version` + `migrate` |

Items, abilities and variables never cross civilizations; only the global state does.

## 6. Content model

### 6.1 Files and schemas

All content is JSON validated with Zod 4 schemas in `src/engine/core/content/schemas.ts` (French
error messages through `z.config(z.locales.fr())`). The path decides the kind (`KIND_PATTERNS` and
`classifyContentPath` in `src/engine/core/packs/pack.ts`).

| Path in a pack | Schema | Loaded |
|---|---|---|
| `manifest.json` | `ManifestSchema` | at session creation |
| `content/scenes/<id>.scene.json` | `SceneSchema` | when the scene is entered |
| `content/dialogues/<id>.dialogue.json` | `DialogueSchema` | with the pack |
| `content/quests/<id>.quest.json` | `QuestSchema` | with the pack |
| `content/cinematics/<id>.cinematic.json` | `CinematicSchema` | with the pack |
| `content/logic/<id>.logic.json` | `LogicSchema` | with the pack |
| `content/prefabs/<id>.prefab.json` | `PrefabSchema` | with the pack (no pack has prefabs yet) |
| `content/items.json` | `ItemsSchema` | with the pack |
| `content/characters.json` | `CharactersSchema` | with the pack |
| `content/rules.json` | `RulesSchema` (mechanic settings) | with the pack |
| `locales/<ll-CC>.json` | `LocaleSchema` | with the pack |

Every document carries `format` (`civverse.scene`, …) and `version` (currently always the literal
`1`). For dialogues, quests, cinematics, logic and prefabs, an `id` that differs from the file name is
reported as a warning. The Studio and the seed CLI both write `JSON.stringify(doc, null, 2) + '\n'`.

Scene voxels are stored as `{ size, palette, encoding: "rle16-b64", data }`: run-length encoded
palette indices with LEB128 varints, base64 (`src/engine/core/voxel/codec.ts`). Scenes at commit
`c26efa1`:

| Scene | Size (x×y×z) | Entities | File |
|---|---|---|---|
| `door/verrou` | 96×64×120 | 188 | 143 KB |
| `door/porte_absente` | 40×34×64 | 23 | 19 KB |
| `memory/reminence` | 96×40×96 | 161 | 110 KB |
| `memory/chambre_blanche` | 32×24×32 | 12 | 15 KB |

Identifier conventions (`src/engine/core/util/ids.ts`): asset ids `<pack>:<name>` (`core:stone`),
registered types `<pack>.<name>` (`door.lock`), variables `<namespace>.<name>`, entity ids local to a
scene. The ids of a pack's code definitions are checked against the first two forms when the pack
loads ([§5.2](#52-what-a-pack-can-contribute)).

### 6.2 Texts are localization keys

- Player-visible text in content and code is a key, never literal French: dialogue lines, choices,
  quest titles and objectives, subtitles, item names, scene names, `prop.text` fields
  (`TextPropDef` is documented as "Localization key of player-visible text").
- `Localizer` (`src/engine/core/i18n/localizer.ts`) merges one table per namespace (`engine`, each
  pack id), supports `{name}`, French `plural` and `select`, falls back to French key by key, and
  renders a missing key as `⟦key⟧` while recording it (the F3 overlay lists them in development,
  `ui.debug.missingTexts`).
- French is required: `loadPack` reports an error for a civilization without `locales/fr-FR.json`,
  and the validator reports missing keys and raw text where a key is expected. `fr-FR` is the only
  locale present in the repository.
- Engine and game UI strings live in `src/engine/locales/fr-FR.json`; pack strings in
  `civilizations/<id>/locales/fr-FR.json`.
- The Studio creates keys as `<pack>.<suffix>` when an author types new text
  (`Studio.newTextKey`, `Studio.setText`), converting straight apostrophes between letters to ’
  (`frenchApostrophes`, `src/engine/core/i18n/typography.ts`).

### 6.3 Validation

`validateCivilization()` (`src/engine/core/packs/validate.ts`) boots the civilization headless
(`fresh`), collects the issues found when its pack loaded (also when it fails to start), then
checks the manifest keys and entry, mechanics whose `setup` failed (errors), the mechanic settings
of `content/rules.json` against each mechanic's `settings` schema (`checkProps`), every scene
(blocks in the palette, music, ambience, component types, component props by kind: text keys,
references to entities, items, dialogues, quests, cinematics, scenes, spawns, sounds, music, models,
characters, blocks, variables, panels, abilities, events), dialogues (nodes, speakers, conditions,
actions), quests, cinematics, logic rules, items, characters, and the keys found in pack code by
`extractCodeKeys()` (literal `t('key')` calls). It is run by `npm run validate` (on
`kind: "civilization"` packs; library packs, loaded as dependencies or on their own, only get their
load-time issues printed, e.g. « ✓ core — bibliothèque, 0 problème(s) »), by the Studio's
« Valider » button on the working copies, by acceptance tests J and G, and by a regression test of
`src/engine/core/sim/session.test.ts` (load issues of the validated civilization are reported,
once: every load of a pack replaces the issues of its previous load, so validating again in the
same session does not repeat them).

### 6.4 Seeds

`civilizations/<pack>/seed/index.ts` exports `seed(): Record<string, unknown>` (file path → document).
Both packs generate their **scenes and cinematics** this way; dialogues, quests, logic, items,
characters, rules and locales are authored JSON. `npm run civ -- seed <pack>` (`tools/cli/civ.ts`):

- validates each generated scene, cinematic, dialogue, quest, logic or prefab document with its
  schema (invalid ones are not written);
- never overwrites an existing file unless `--force` is passed; with `--force` it skips files whose
  content would not change and first copies each file it replaces to
  `.civ-backups/civilizations/<pack>/<path>.<timestamp>.seed.bak`.

Once written, the JSON file is the source of truth and is edited in the Studio; the seed is not
re-run automatically and can drift from it (see [DECISIONS.md, ADR-005](DECISIONS.md)).

## 7. Saves

| Aspect | Implementation |
|---|---|
| Layout | `SaveGame { format: 'civverse.save', formatVersion, engineVersion, savedAt, slot, label, global: GlobalState, currentCiv, civs: Record<civId, LocalCivState> }` (`src/engine/core/save/saveFormat.ts`) |
| Build / apply | `GameSession.buildSaveGame()` snapshots the running civilization first; `applySaveGame()` replaces global and local states without starting a civilization. |
| Loading | `parseSave()`: format check, refuses a newer `formatVersion` or `global.schemaVersion`, runs `FORMAT_MIGRATIONS` then `GLOBAL_MIGRATIONS` (both empty: version 1), then Zod validation (`z.looseObject` at the top level, in the multiverse state and in each civilization state, so unknown keys there are kept). French `SaveLoadError` messages. |
| Local state | `migrateCivState()` refuses a newer `stateVersion`, throws when a migration step is missing, and sets `stateVersion` to `n + 1` itself after each step. Mechanic and component states use `migrateVersioned()`, which falls back to the initial state with a warning. |
| Storage | `BrowserSaveStorage` (`src/engine/platform/idbSaveStorage.ts`): IndexedDB via `idb-keyval` (`createStore('civilizationverse', 'saves')`); localStorage (prefix `civverse.save.`) only when IndexedDB itself is unavailable or fails. A damaged entry is left out of the slot list and refused with a `SaveLoadError` when loaded. `MemorySaveStorage` (`src/engine/core/save/storage.ts`) for tests and the Studio playtest. |
| Slots | `auto`, `slot1`, `slot2`, `slot3` (`SAVE_SLOTS` in `src/game/controller.ts`). |
| Autosave | Every 120 s while playing, and on `quest.completed`, `quest.stageChanged`, `scene.entered`; also when a civilization starts, when quitting, and after a civilization ends (written again once it is unloaded: `save('auto')` works without a running civilization, the other slots need one). |
| Start | The game (mode `play`, default storage) applies the `auto` save when it starts (`preloadAutosave()` in `src/game/controller.ts`), so the civilization selection shows the saved progress and starting a civilization resumes its saved state; an unreadable autosave is logged and ignored. The Studio playtest skips this. |

Player settings are separate: `localStorage` key `civverse.settings.v1` (`src/engine/platform/settings.ts`).

## 8. View layer: rendering, audio, input

| Module | File | Role |
|---|---|---|
| `GameView` | `src/engine/view/gameView.ts` | Owns the Babylon `Engine` and `Scene`, the camera rig, input and audio; builds the renderers when the session's world changes; dispatches presentation requests; collects `FrameStats` (fps, frame ms, draw calls, vertices, chunks, pending chunks, entities) for the debug overlay. |
| `VoxelRenderer` | `voxelRenderer.ts` | Chunk meshes per render layer, dirty-chunk rebuild budget, block texture atlas. |
| `voxelMaterial.ts` | | `StandardMaterial` + `VoxelLightPlugin` (material plugin adding the baked `voxLight` vertex attribute times the ambient sky colour). |
| `ModelRenderer` | `modelRenderer.ts` | Micro-voxel models drawn with hardware instancing. |
| `EntityViewManager` | `entityViews.ts` | Maps components to visuals (models, hinged doors, characters, signs, particles, pack `defineVisual`s); `'game'` or `'studio'` mode (the Studio adds helpers and markers). |
| Characters | `characters/skin.ts`, `rig.ts`, `animator.ts` | Procedural pixel-art skin from a `CharacterDoc` (pure module), Babylon rig with one mesh per bone, procedural animation. |
| `EnvironmentRenderer` | `environment.ts` | Sky shader dome, sun + shadows, hemispheric fill light, fog, glow layer, post-processing, timed environment transitions. |
| `CameraRig` | `cameraRig.ts` | First-person camera, head bob, shake, FOV effects, dialogue framing, cinematic poses and blend back. |
| Particles | `particles.ts` | Presets with a procedurally generated soft-dot texture. |
| Quality | `quality.ts` | `QUALITY` presets `low`/`medium`/`high`/`ultra`. |
| `AudioEngine` | `src/engine/audio/audioEngine.ts` | Sound recipes rendered once with `OfflineAudioContext` and cached; HRTF panning for world sounds; music sequenced live; buses master, music, sfx, ambience, ui; unlocked on first user gesture. |
| `InputManager` | `src/engine/input/inputManager.ts` | Physical key codes (`KeyboardEvent.code`), pointer lock, edge detection; ignores keys typed in form fields. |

Pack rendering hooks: `defineVisual({ id, component, create(view, entity) })` renders a component
type; `defineViewEffect({ id, channel, handle })` answers `ctx.fx.custom(channel, payload)` requests.
Both get a `ViewContext` (`src/engine/view/entityViews.ts`). Visuals run wherever a session is
rendered (game, Studio playtest, Studio editor viewport), never headless.

`ctx.view` (`ViewBridge` in `api.ts`, the escape hatch to the renderer) is
`{ kind: 'babylon', native: { engine, scene } }` while a `GameView` renders the session (game and
Studio playtest): the `GameView` constructor sets `session.view` and `dispose()` clears it. It is
`null` headless and in the Studio's editor viewport.

## 9. Civilization Studio

### 9.1 Boot and modes

`src/studio/main.tsx` picks the mode from `devApi.available()`, i.e. the compile-time constant
`__CIV_STUDIO_AVAILABLE__` (`define` in `vite.config.ts`, `true` only for `vite serve`):

| | Dev server (`npm run dev`) | Build with `CIV_BUILD_STUDIO=1` |
|---|---|---|
| Content provider | `DevContentProvider` (files on disk via the dev API) | `GlobContentProvider` (bundled content) |
| `ProjectIO` | `devProjectIO` (`writable: true`) | `bundledProjectIO()` (`writable: false`, write/remove reject) |
| Script editor | Monaco, lazily imported | absent; Explorer hides the « Scripts » group |
| Hot reload | `civ:code-changed` / `civ:content-changed` handlers | none |

### 9.2 Core (no DOM, no Babylon; unit-tested in `src/studio/core/studio.test.ts`)

| Class / module | File | Responsibility |
|---|---|---|
| `Studio` | `src/studio/core/studio.ts` | Controller: owns an editing `GameSession` (`mode: 'playtest'`, `HeadlessUi`) used for pack definitions and the edited scene (no behavior runs), the `StudioProject`, the `History`, tabs, selection, tools, snapping, the log; notifies React via `subscribe`/`getVersion` (`useSyncExternalStore` in `src/studio/hooks.ts`). Opening another pack forgets the previous pack's definitions (`GameSession.unloadPackDefinitions`). Creating a scene, dialogue, quest, cinematic, logic file or prefab is an undoable command (`createDoc`), written at the next save; « Nouveau script » writes its file at once through the scaffold route. |
| `StudioProject`, `StudioDoc`, `ProjectIO` | `src/studio/core/project.ts` | Working copies of every pack file. Each change gets a new global revision number; a document is dirty while `revision !== savedRevision`, so undoing back to the saved state makes it clean. Flags `isNew`, `deleted` (a document created then deleted before any save is not dirty); `mtimeMs` for conflict detection; `overlay(packIds)` for playtest/validation; `beforeSerialize` hooks. |
| `History`, `Command` | `src/studio/core/history.ts` | Undo/redo. Commands with the same `mergeKey` within `MERGE_MS = 1200` ms merge (typing, dragging) unless an undo or redo came in between (`seal()` exists but nothing calls it); `transaction(label, fn)` groups several commands into one step; at most `MAX_STEPS = 300`; one stack for the open pack, cleared by `openPack`. |
| Edits | `src/studio/core/edits.ts` | `changeDoc()` records a document change as a command; immutable scene helpers (`updateEntities`, `addEntities`, `removeEntities`, …) keep untouched entities' identity; `voxelCommand()` applies block changes to the live editor world or, after a scene switch, to the document's voxel data. |
| Templates | `src/studio/core/templates.ts` | « Ajouter » menu entries; their texts become new localization keys. |
| Validation | `src/studio/core/validation.ts` | `validateInStudio()`: new headless session over `OverlayContentProvider(studio.provider, project.overlay([pack, ...deps]))`, same checks as `npm run validate`, plus code keys from the pack's scripts. |

Edit → save flow: an editor calls `studio.editScene` / `studio.editDoc` (or a voxel stroke) → a
command applies new immutable data with `project.setData` → `project.onChange` → the Studio syncs the
editor world (`refreshEditorEntity`) and React re-renders → « Enregistrer » (`saveAll`) serializes
dirty documents (live voxels are flushed into the scene document first) and calls `ProjectIO.write`
with the `mtimeMs` read from disk (`null` for a document created in the Studio, so its first save
skips the conflict check), or `remove` for deleted documents (a document is deleted only by undoing
its creation: the Studio has no delete-file command).

### 9.3 Viewport

`EditorViewport` (`src/studio/viewport/editorViewport.ts`) has its own Babylon `Engine` but renders
the scene with the game's renderers: `VoxelRenderer` (budget 10 ms), `ModelRenderer`,
`EntityViewManager` in `'studio'` mode and `EnvironmentRenderer`. It adds a free camera, picking,
gizmos (move/rotate/scale), selection boxes and block tools. The world it shows comes from
`GameSession.openEditorWorld()`: components get normalized props and initial state
(`BehaviorSystem.prepareForEditing`) but no instance runs and there is no player. Its render loop
stops while a playtest runs (`ViewportPanel active`).

### 9.4 Playtest

`src/studio/play/Playtest.tsx` mounts the real game: `GameController.create({ provider:
new OverlayContentProvider(...), mode: 'playtest', storage: new MemorySaveStorage() })`, a new
`GameView` on its own canvas, and the game's `Hud`, `Loading` and `ErrorScreen` inside `ThemedRoot`.
« Depuis le début » starts the civilization from its beginning; « Jouer ici » starts the open scene
at the editor camera position with `quietStart` (no `civ.started`, so no opening cinematic). F8 or « Arrêter »
stops (F8 also while the game holds the pointer lock); reaching the game menu also returns to the
Studio. Errors and warnings of the playtest session are mirrored into the Studio console. Content is
tested as edited, code as last saved: starting a playtest prints a warning listing unsaved scripts.
See [DECISIONS.md, ADR-010](DECISIONS.md).

### 9.5 Scripts, type checking, scaffolding (dev only)

| Piece | File | Notes |
|---|---|---|
| Script editor | `src/studio/editors/ScriptEditor.tsx` | Monaco; loaded through `lazy(() => import('./editors/ScriptEditor'))` only when `__CIV_STUDIO_AVAILABLE__` (`src/studio/StudioApp.tsx`). Monaco's own semantic validation is off; syntax checking stays on. « Enregistrer et recharger » writes the file through the dev API. A file the dev API may not write (`isWritablePackFile`, e.g. `pack.ts`) opens read-only (Monaco `readOnly`, badge « Lecture seule »). |
| Type checking | `tools/vite/typecheckService.ts` | TypeScript `LanguageService` over the repository `tsconfig.json`, kept warm in the dev server; returns `StudioDiagnostic`s for the requested files as saved on disk. |
| Scaffolding | `tools/vite/scaffold.ts` | « Nouveau script »: `behavior`, `action`, `condition` or `mechanic` template written to `civilizations/<pack>/mechanics/<camelName>.ts` (exclusive create), discovered by the pack's glob. The behavior template sets a non-solid, pickable `aim` collider sized by its `size` prop (updated in `onPropsChanged`), so the entity can be used without a model. |
| File API | `tools/vite/civDevPlugin.ts` | Routes under `/__civ/api/`: `packs`, `file` (GET/PUT/DELETE), `typecheck`, `scaffold`. Safety rules: [DECISIONS.md, ADR-006](DECISIONS.md). Client: `src/engine/platform/devApi.ts`; write rules shared with the Studio: `src/engine/platform/devApiRules.ts`. |

### 9.6 Hot reload of pack code and content

The plugin's `hotUpdate` hook (`order: 'post'`) replaces Vite's default propagation for two kinds of
files, invalidates the affected modules with an HMR timestamp, sends a custom event and returns `[]`
(no full reload):

| File | Event | Payload |
|---|---|---|
| `civilizations/<pack>/(content\|locales)/**.json`, `civilizations/<pack>/manifest.json` | `civ:content-changed` | `{ path, fromStudio, change }` |
| `civilizations/<pack>/**.ts(x)` except `seed/`, `tests/`, `*.test.ts` | `civ:code-changed` | `{ path, pack, fromStudio, change }` |

`change` is `created`, `changed` or `deleted`; `fromStudio` is true when the Studio wrote or deleted
the file less than 5 s earlier. Handlers:

| Page | `civ:code-changed` | `civ:content-changed` |
|---|---|---|
| Studio (`src/studio/main.tsx`) | `bumpPackCode(pack)` (next import uses `?studio=<n>`), refresh the listing if a file was created/deleted, `studio.reloadPackCode(pack)` → `GameSession.reloadPack()` (loads the new code and content first, so a pack that fails to load stays as it was; then unregisters the pack and the loaded packs that depend on it, registers the new one and reloads the dependents) and reopens the scene. Refused while a civilization runs in that session. | Invalidate the file listing; for a file created or deleted outside the Studio, refresh the Explorer; for a file changed outside the Studio, reload its working copy if it is clean (and rebuild the open scene if it is that file, `reloadOpenScene`), otherwise warn in the console. |
| Game (`src/game/main.tsx`) | Reload the page if no civilization is running, otherwise show a notification (`ui.dev.codeChanged`). | Reload the page if no civilization is running. |

Other files (for example CSS, seeds and tests) are left to Vite's default HMR handling.

## 10. Builds, scripts and CLI

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `127.0.0.1:5173` (`strictPort: false`): game, Studio, file API. |
| `npm run build` | `npm run typecheck && vite build` — game only. |
| `npm run build:with-studio` | Same with `CIV_BUILD_STUDIO=1`: adds `studio.html` (read-only Studio, no file API). |
| `npm run preview` | Serves the build on `127.0.0.1:4173`. |
| `npm run typecheck` | `tsc --noEmit` with `tsconfig.json` and `tsconfig.node.json`. |
| `npm run lint` | ESLint (pack import rule, `no-explicit-any`, `consistent-type-imports`, …). |
| `npm run test` | Vitest. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:e2e` | Playwright browser tests (`tests/e2e/`) against a dev server it starts on port 5199. |
| `npm run validate` | `civ validate`: every civilization booted headless and validated; the load-time issues of every library pack are listed too. |
| `npm run bench` | `civ bench`: CPU costs on the real packs (loading a civilization, light, texture atlas, meshing, one simulation step, writing a save); GPU rendering is not measured. |
| `npm run check` | typecheck + lint + validate + test. |
| `npm run civ -- seed <pack> [--force]` | Writes seed output ([§6.4](#64-seeds)). |
| `npm run civ -- new-pack <id> [--name "…"]` | Creates manifest, `pack.ts`, French table and a starting scene; refuses an existing folder. |

Build inputs (`vite.config.ts`):

```ts
  const buildStudio = process.env.CIV_BUILD_STUDIO === '1';
  const input: Record<string, string> = { main: path.resolve(repoRoot, 'index.html') };
  if (command === 'serve' || buildStudio) input.studio = path.resolve(repoRoot, 'studio.html');
```

```ts
    define: {
      __CIV_STUDIO_AVAILABLE__: JSON.stringify(command === 'serve'),
```

The file API plugin is declared with `apply: 'serve'` and only implements `configureServer`, so it is
absent from builds and from `vite preview`. `npm run validate` and `npm run bench` load packs through
Vite's SSR module runner (`server.ssrLoadModule` in middleware mode) so that `import.meta.glob` works
as in the game; `seed` and `new-pack` run directly under `tsx`.

## 11. Tests

Vitest (`vitest.config.ts`, `environment: 'node'`, `__CIV_STUDIO_AVAILABLE__` defined as `false`)
collects `*.test.ts` files from the folders listed in its `include` option.

| Suite | Covers |
|---|---|
| `src/engine/core/sim/session.test.ts` | Headless integration on an in-memory pack: loading, movement, story loop, save/restore, isolation, namespace and `globalWrites` guards, and validation reporting the load issues of the civilization it checks. |
| `src/engine/core/voxel/voxel.test.ts` | Codec, volume, light, mesher, raycast, construction kit, texture generators. |
| `src/engine/core/physics/physics.test.ts`, `nav/pathfinder.test.ts`, `props/props.test.ts`, `i18n/localizer.test.ts`, `story/cinematics.test.ts` | Body physics, A*, prop schemas, localization, cinematic camera keys (inherited field of view, keys stored out of time order). |
| `src/engine/core/save/saveFormat.test.ts`, `util/semver.test.ts` | Save state migrations (`migrateCivState`, `migrateVersioned`); the supported `engineApi` range syntax (compound ranges and x-ranges are rejected). |
| `src/studio/core/studio.test.ts` | History, Studio editing and saving against an in-memory `ProjectIO` over the real pack files. |
| `tests/unit/corePack.test.ts` | The `core` library loads without content issues, its block textures use known generators, its atlas builds, every model builds within size limits. |
| `civilizations/door/tests/door.playthrough.test.ts`, `civilizations/memory/tests/memory.playthrough.test.ts` | Full story paths played headless (A* reachability, dialogues, saves). |
| `tests/acceptance/D-…`, `E-…`, `F-…`, `G-…`, `J-…` (`helpers.ts`) | Headless acceptance tests on the real packs: story progression (D), save and reload through the game's save path (E), civilization isolation when switching Door → Memory (F), an independent fixture pack `tests/acceptance/fixtures/lanterne` that only imports `@sdk` (G), every civilization validating with zero issues plus content baselines, and `ENGINE_VERSION` equal to the `package.json` version (J). |
| `tests/acceptance/localization.test.ts` | Keys used literally in `src/game`, `src/engine`, `src/sdk` exist in French; no hard-coded visible text in game and pack UI components; French tables are clean (namespaces, typography, no placeholders or English leftovers). |
| `tools/vite/civDevPlugin.test.ts` | Dev file API security on a temporary directory (path rules, origin checks, symlink escapes, atomic writes with backups, conflicts, deletes, invalid JSON bodies), the Studio's write rules (`isWritablePackFile`) agreeing with the server's, and the absence of the API and Studio from production build configuration. |

Browser tests (`playwright.config.ts`, Chromium with SwiftShader WebGL, dev server on port 5199):
`tests/e2e/game.spec.ts` (A: play Door, move, jump, interact, talk; E: save to IndexedDB, reload the
page, load; H: Door and Memory interfaces) and `tests/e2e/studio.spec.ts` (B: create and move an
object, save, reload; C: playtest an edited scene; I: write, save and use a script). The Studio
tests write real files of the Door pack and restore them afterwards. Pointer lock is stubbed
(`tests/e2e/support.ts`) and the camera is turned with `player.setLook`, so mouse look is not
covered; rendering runs on SwiftShader, so no frame rate has been measured on a GPU.

## 12. Performance design

Only what the code does; no measured numbers are claimed here.

| Area | What the code does | Where |
|---|---|---|
| Voxel storage | `Uint16Array` of palette indices, Y-major layout, ≤ 1024 cells per axis; RLE + varint + base64 on disk. | `voxel/volume.ts`, `voxel/codec.ts` |
| Chunking | 16³ chunks (`CHUNK_SIZE`); one Babylon mesh per chunk and render layer (`opaque`, `cutout`, `translucent`, `emissive`). | `voxel/mesher.ts`, `view/voxelRenderer.ts` |
| Face culling | A face is emitted only when the neighbour is not opaque; shared faces between identical non-opaque cubes are skipped. No greedy merging. Slabs and cross-shaped plants have their own paths. | `meshChunk()` |
| Baked AO and light | Per vertex: 3-neighbour ambient occlusion (vertex colours) and smooth light (`voxLight`: block light RGB + sky light × face shade). | `voxel/mesher.ts`, `view/voxelMaterial.ts` |
| Light propagation | Flood fill of sky light and coloured block light (0–15) at scene load; after an edit only the region extending 16 cells around it in x and z, over the full height, is recomputed (`LightField.update`). Light sources cost nothing per frame; changing them costs a recompute and re-meshing. | `voxel/light.ts`, `SceneWorld.flushLight()` |
| Re-meshing budget | Edits mark chunks dirty (1-cell margin); `VoxelRenderer.update()` rebuilds dirty chunks one at a time and stops once 6 ms have been spent in the call (10 ms in the Studio). `buildAll()` meshes synchronously when a scene's view is built. Meshing runs on the main thread. | `view/voxelRenderer.ts` |
| Static meshes | Chunk meshes: `freezeWorldMatrix()`, `doNotSyncBoundingInfo`, not pickable; only opaque and cutout layers cast shadows; the hemispheric light excludes voxel meshes. | `view/voxelRenderer.ts`, `view/gameView.ts` |
| Texture atlas | Block face textures are generated into one atlas when a scene's `VoxelRenderer` is created (16×16 tiles in 32×32 padded cells, 16 columns, so mipmaps do not bleed between tiles), and again only if the block registry revision changes. | `voxel/textures/atlas.ts`, `view/voxelRenderer.ts` |
| Models | Hardware instancing: one hidden source mesh per model part and layer, one `InstancedMesh` per entity; per-instance brightness through an instanced colour buffer sampled from baked light. Sources are built on first use and cached by the scene's `ModelRenderer` until the model registry changes. | `view/modelRenderer.ts` |
| Entity sync | Views are created/destroyed only when `world.entitiesRevision` changes, rebuilt only when an entity's `propsRevision` changes, re-positioned only when its `revision` changes; baked light is re-sampled every 0.25 s per entity. Visual `update(dt)` hooks still run every frame. | `view/entityViews.ts` |
| Characters | One mesh per bone, one 256×256 generated texture per character rig, nearest filtering. | `view/characters/rig.ts`, `skin.ts` |
| Picking | `scene.skipPointerMovePicking = true`; interactions use the engine's own voxel DDA ray and collider ray, not Babylon picking. | `view/gameView.ts`, `core/sim/interaction.ts` |
| Quality presets | Shadow map size (0/2048/4096), PCF, post-processing pipeline, MSAA, FXAA, glow layer, particle multiplier, hardware scaling. | `view/quality.ts`, `view/environment.ts` |
| Audio | Sound recipes rendered once to `AudioBuffer`s and cached; every registered sound is preloaded when a scene's view is built. | `audio/audioEngine.ts`, `GameView.buildWorld()` |
| Simulation | Brute-force collider queries (sets of a few hundred boxes, per the code comment); A* capped at `maxNodes` (default 30 000); dt clamp and physics sub-steps. | `physics/colliders.ts`, `nav/pathfinder.ts`, `physics/body.ts` |

## 13. Where to change what

| Goal | Change | Also |
|---|---|---|
| New civilization | `npm run civ -- new-pack <id>` | The template already depends on `core` and contains a starting scene; write the French texts in `locales/fr-FR.json`. |
| New mechanic (world rule with state) | `civilizations/<pack>/mechanics/<name>.ts` exporting `defineMechanic({ id, label, state?, settings?, dependsOn?, setup(ctx, state, settings) })` (or Studio « Nouveau script ») | Settings appear in `content/rules.json`; state is saved and versioned. Minimal complete example (mechanic, component, action, condition, event, blocks, state migration): `tests/acceptance/fixtures/lanterne/mechanics/lantern.ts`. |
| New entity component | `defineBehavior` in the pack's `mechanics/` | Engine-wide component: `src/engine/core/behaviors/` + `ENGINE_BEHAVIORS` in `src/engine/core/sim/builtins.ts`. |
| New logic action or condition | Pack: `defineAction` / `defineCondition` in `mechanics/`. Engine-wide: `coreActions` in `src/engine/core/logic/coreActions.ts` / `coreConditions.ts` | Set `essential: false` for purely presentational actions; add a `summarize` for the Studio. |
| New event | `defineEvent` (pack) or `coreEvents.ts` (engine) so the Studio offers it | Typed payloads for engine events: `CivEventMap` in `src/engine/core/events/eventMap.ts`. |
| New capability for pack code | `src/engine/core/sim/api.ts` (interface) + `src/engine/core/sim/contexts.ts` (implementation, register disposables in `scope`) | Export new public types from `src/sdk/index.ts`; consider `ENGINE_API_VERSION`. |
| New pack HUD element or panel | `defineHud` / `definePanel` from `@sdk/ui` in `civilizations/<pack>/ui/*.tsx` | Text via `useT()`, key names via `keyLabel()`; theme through `--civ-*` CSS variables. A panel pauses the simulation while open unless `pausesGame: false`. |
| New engine HUD element | `src/game/hud/*.tsx`, mounted from `src/game/hud/Hud.tsx` | Strings in `src/engine/locales/fr-FR.json`; hideable elements: `HudElement` in `api.ts`. |
| New block | `defineBlock` in `civilizations/<pack>/assets/blocks.ts` (core: `civilizations/core/mechanics/blocks.ts`) | New texture generator: `src/engine/core/voxel/textures/generators.ts`. |
| New model | `defineModel` in `assets/models.ts` (core: `civilizations/core/models/*.ts`) | |
| New sound or music | `defineSound` / `defineMusic` in `assets/sounds.ts` (core: `civilizations/core/mechanics/sounds.ts`) | Synthesis features: `src/engine/audio/audioEngine.ts`, recipe types in `src/engine/core/audio/recipes.ts`. |
| Custom rendering for a component | `defineVisual` / `defineViewEffect` from `@sdk/view` in `civilizations/<pack>/view/` | Must not affect gameplay. |
| Scene, dialogue, quest, cinematic, rules | JSON in `civilizations/<pack>/content/` (Studio or by hand) | Files are discovered by path. The manifest's `scenes` list is only checked for existence; the Studio adds new scenes to it. Run `npm run validate`. |
| Player-visible text | `civilizations/<pack>/locales/fr-FR.json` | Engine/UI: `src/engine/locales/fr-FR.json`. |
| New content field or file kind | `src/engine/core/content/schemas.ts`; for a new kind also `KIND_PATTERNS` and `loadPack` in `packs/pack.ts`, `validate.ts`, `DocKind` in `src/studio/core/project.ts`, an editor routed by `src/studio/editors/DocumentView.tsx`, the seed CLI schema switch | |
| Save layout | `SAVE_FORMAT_VERSION` + `FORMAT_MIGRATIONS` in `src/engine/core/save/saveFormat.ts` | Global state: `GLOBAL_SCHEMA_VERSION` + `GLOBAL_MIGRATIONS`; pack local state: bump `stateVersion` and add `definePack({ migrations })`. |
| Cross-civilization data | `GlobalState` in `src/engine/core/state/multiverse.ts` | Packs declare `globalWrites`. |
| Studio editor | `src/studio/editors/*`, routed by `DocumentView.tsx`; inspector fields are generated from prop schemas (`src/studio/fields/PropField.tsx`; a prop's `group` is not used for layout) | Record edits through `studio.editDoc` / `editScene` to get undo. |
| Dev file API rules | `src/engine/platform/devApiRules.ts` (writable folders and extensions, shared with the Studio's script editor), `tools/vite/civDevPlugin.ts` (enforcement) | Update ADR-006. |
| CLI command | `tools/cli/civ.ts` | |

## 14. Limitations and known inconsistencies

Runtime:

- **No fixed simulation step.** The game advances by the render-frame delta (clamped to 0.1 s);
  only physics sub-steps (≤ 1/120 s) and the headless `advance()` helper use fixed steps.
- **One civilization at a time per session**; other civilizations are not simulated. Switching is a
  full unload/load.
- **Whole-scene loading**: a scene is one finite volume (≤ 1024 cells per axis) loaded and meshed
  at once; there is no streaming, no LOD and no greedy meshing. `QualityProfile.viewDistance` is
  defined but not used. Meshing and light run on the main thread (the mesher's comment mentions a
  possible Web Worker; none exists).
- **Library packs** contribute registry definitions only: mechanics, HUDs, panels and abilities of a
  library pack are never activated.
- `FxKind` lists `'blur'` and `'letterbox'`, which no presentation handler implements (cinematic
  letterboxing comes from the cinematic document's `letterbox` flag).
- Colliders are axis-aligned: a yawed entity's collider becomes the axis-aligned bounds of the
  rotated box (`rotatedBounds`).
- In the game page, pack code changes made during a running civilization are not applied (a
  notification asks for a reload).
- The engine events `door.opened` / `door.closed` (`coreEvents.ts`, owner `engine`) share the
  `door.` prefix with the Door pack's own types, against the `<pack>.<name>` convention.
- Pack UI: `useT()` (`src/sdk/ui.tsx`) is commented as re-rendering on locale change but subscribes
  to nothing, and a HUD element's `visibleWhen` condition is only re-evaluated when its HUD slot
  re-renders (`CivHudSlot` in `src/game/hud/CivUi.tsx`).

Content, saves, localization:

- All content schemas are `version: 1` and there is no content migration code (the header of
  `schemas.ts` says a format change must add one). Save migration tables are empty (format 1).
- `parseSave()` keeps unknown keys (`z.looseObject` at the top level, in the multiverse state and
  in each civilization state), but the next save is rebuilt from the session: unknown top-level keys,
  and those of a civilization state once that civilization has been loaded, are not written again.
  The contents of scene, quest and mechanic states inside a save are not schema-validated, and the
  saved state of a mechanic or ability that a pack no longer defines is dropped silently.
- Only `fr-FR` exists. `npm run validate` fully validates civilization packs only; for library
  packs it lists the issues found when they load (schemas, definition ids), not references or text
  keys. The keys used by `src/game`, `src/engine` and `src/sdk` are checked by
  `tests/acceptance/localization.test.ts`, not by `npm run validate`. Studio UI texts are French
  literals and are not checked.
- Validation does not check references to quest stage, objective, dialogue node or choice ids
  (plain strings in action and condition props), nor fragment and flag writes against the
  manifest's `globalWrites` (enforced only at runtime).
- `extractCodeKeys()` only sees literal `t('key')` calls; keys built at runtime are only checked by
  prefix in `localization.test.ts`.
- Seeds can drift from the canonical JSON once the Studio has edited it; re-running with `--force`
  overwrites Studio edits (the replaced files are kept in `.civ-backups/`).

Studio and tooling:

- **Read-only files**: the Studio and the file API share their write rules
  (`src/engine/platform/devApiRules.ts`): `manifest.json` and `.json`, `.ts` or `.tsx` files under
  `content/`, `locales/`, `mechanics/`, `ui/`, `view/`, `assets/` and `models/`. Other scripts the
  Explorer lists, such as `pack.ts`, open read-only in the script editor; CSS files (`style`
  documents) cannot be edited in the Studio (no Explorer group, not writable). The Explorer does not
  list `seed/` and `tests/`.
- A script changed on disk while it is open in the script editor is not refreshed (only clean
  content documents are reloaded).
- Renaming an entity id in the Studio does not update the references to it (components, logic,
  other documents); renaming a dialogue node only updates the links inside its dialogue.
- The playtest uses the code saved on disk (unsaved script edits are not included; the Studio
  warns about them when the playtest starts), shares the player's settings (`localStorage`), and
  starts from an empty multiverse state (see ADR-010).
- Type diagnostics in the script editor are computed on the saved file, not on the unsaved buffer.
- `.civ-backups/` is never pruned.
- Purity of `src/engine/core` and the absence of `src/game` → `src/studio` imports are conventions;
  only the pack import rule is lint-enforced.
