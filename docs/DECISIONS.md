# Architecture Decision Records

The decisions that shape CIVILIZATIONVERSE, written down from the code as verified on 2026-10-12
(commit `0f92dd7`). Each record states the context, the decision as implemented (with the files
that implement it) and its consequences, including the costs. All records are **accepted and
implemented**; when the implementation is partial, the record says so.

System overview and module map: [ARCHITECTURE.md](ARCHITECTURE.md).

| ADR | Decision |
|---|---|
| [ADR-001](#adr-001--babylonjs--typescript--vite--react-stack) | Babylon.js + TypeScript + Vite + React stack |
| [ADR-002](#adr-002--headless-simulation-separated-from-rendering) | Headless simulation separated from rendering (`GameSession` / `PresentationBus` / `UiBridge`) |
| [ADR-003](#adr-003--data-driven-content-as-validated-json-with-localization-keys-fr-fr-required) | Data-driven content as validated JSON with localization keys (fr-FR required) |
| [ADR-004](#adr-004--civilization-packs-and-the-mechanics-sdk-as-the-only-extension-surface) | Civilization packs and the Mechanics SDK as the only extension surface, isolated per civilization |
| [ADR-005](#adr-005--seeds-generate-the-first-version-of-scenes-json-is-canonical-afterwards) | Seeds generate the first version of scenes; JSON is canonical afterwards |
| [ADR-006](#adr-006--civilization-studio-file-access-through-a-scoped-dev-server-api) | Civilization Studio file access through a scoped dev-server API |
| [ADR-007](#adr-007--no-eval-of-editor-supplied-code) | No eval of editor-supplied code |
| [ADR-008](#adr-008--global-multiverse-state-vs-local-civilization-state-in-saves) | Global multiverse state vs local civilization state in saves |
| [ADR-009](#adr-009--procedurally-generated-original-assets) | Procedurally generated original assets, no third-party game assets |
| [ADR-010](#adr-010--playtest-runs-the-real-game-controller-on-unsaved-working-copies) | Playtest runs the real game controller on unsaved working copies with in-memory saves |
| [ADR-011](#adr-011--custom-kinematic-physics-and-voxel-collision-no-physics-engine) | Custom kinematic physics and voxel collision, no physics engine |
| [ADR-012](#adr-012--baked-voxel-lighting-and-budgeted-chunk-meshing) | Baked voxel lighting and budgeted chunk meshing |
| [ADR-013](#adr-013--contain-faults-of-pack-code-instead-of-crashing) | Contain faults of pack code instead of crashing |

---

## ADR-001 — Babylon.js + TypeScript + Vite + React stack

**Status:** accepted, implemented. **Code:** `package.json`, `tsconfig.json`, `vite.config.ts`,
`eslint.config.js`.

### Context

The product is a browser-first first-person voxel adventure plus an in-browser editor. Engine,
civilization packs, editor and tools have to share types and code, and the simulation has to run
both in the browser and in Node (tests, validation CLI).

### Decision

- **TypeScript 6** everywhere, `strict` plus `noImplicitOverride`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`,
  `verbatimModuleSyntax`. ESLint makes `@typescript-eslint/no-explicit-any` and
  `consistent-type-imports` errors.
- **Babylon.js 9** (`@babylonjs/core`, WebGL `Engine`) for 3D, used only in `src/engine/view`, in
  the Studio's viewport (`src/studio/viewport`) and character preview
  (`src/studio/editors/DataEditors.tsx`), and re-exported to packs by `@sdk/view`.
- **React 19** for the game UI (`src/game`) and the Studio UI (`src/studio`). **zustand 5** holds the
  game's UI-shell state (`useUi`, `src/game/state/uiStore.ts`); the Studio uses its own controller
  (`Studio`) read through `useSyncExternalStore`.
- **Zod 4** for every content, manifest and save schema.
- **Vite 8** (Rolldown, `build.rolldownOptions`) for the dev server, bundling, `import.meta.glob` pack
  discovery, HMR and the Studio dev plugin. **Vitest 5** (Node environment) for tests,
  **Playwright** configured for browser tests, **tsx** for the CLI.
- Supporting libraries: `idb-keyval` (saves), `monaco-editor` (dev-only script editor),
  `@fontsource/*` (fonts).
- Dependency versions are pinned exactly in `package.json`; Node `>= 22.12.0`.

### Consequences

- One language and one module system for engine, packs, editor and tools; packs are ordinary ES
  modules discovered by Vite globs. Loading content therefore depends on Vite semantics:
  `npm run validate` runs through Vite's SSR module runner (`tools/cli/civ.ts`) and Vitest reuses
  the same aliases (`tools/vite/aliases.ts`).
- Path aliases exist twice (`tsconfig.json` `paths` and `civAliases`) and must be kept in sync by
  hand.
- Babylon is imported from the package root `@babylonjs/core`; `vite.config.ts` raises
  `chunkSizeWarningLimit` to 4000. Bundle sizes are not measured anywhere in the repository.
- The game requires WebGL (the `<noscript>` text of `index.html` asks for WebGL 2).

---

## ADR-002 — Headless simulation separated from rendering

**Status:** accepted, implemented. **Code:** `src/engine/core/sim/session.ts`,
`src/engine/core/sim/presentation.ts`, `src/engine/core/sim/uiBridge.ts`,
`src/engine/core/testing/headless.ts`, `src/engine/view/gameView.ts`, `src/game/state/uiStore.ts`.

### Context

Whole story paths must be testable automatically, the content validator must boot civilizations
without a GPU, the Studio must load pack definitions and scenes without running gameplay, and the
renderer should be replaceable without touching quests or mechanics.

### Decision

- `src/engine/core` contains no Babylon, React or DOM code. `GameSession` owns all gameplay state:
  registries, variables, multiverse, story systems, player, physics, the loaded `SceneWorld`.
- The simulation talks outwards through two interfaces only:
  - `PresentationBus` — fire-and-forget `PresentationRequest`s (sounds, music, ambience, screen
    effects, animations, expressions, barks, environment transitions, pack `custom` effects, voxel
    regions to re-mesh). Subscribers: `GameView` (3D, audio) and `handlePresentationForUi`
    (fades, flashes, tints, barks in the React layer).
  - `UiBridge` — notifications, location titles, documents, panels, HUD registration, end screen,
    confirmation, `resetCiv`. Implemented by `ReactUiBridge` (zustand) and `HeadlessUi`.
- The renderer and the React hooks read session state directly (pull) and call session methods
  for input (`update`, `handleKey`, `interaction.interact`, `dialogue.advance` / `choose`).
- Gameplay time exists only in `SimClock.advance(dt)`.
- Headless runs use `HeadlessUi`, a recording `PresentationBus`, and the helpers of
  `testing/headless.ts`, whose `advance()` steps time in fixed increments.

### Consequences

- Pack playthroughs (`civilizations/*/tests`), acceptance tests (`tests/acceptance`),
  `npm run validate` and the Studio's validation all run the real simulation in Node.
- Gameplay cannot depend on visuals. Pack rendering (`defineVisual`, `defineViewEffect`) only
  displays state. The declared escape hatch `CivContext.view` / `GameSession.view` is set by
  `GameView` to `{ kind: 'babylon', native: { engine, scene } }` while it renders the session (game,
  Studio playtest) and cleared on dispose; it is `null` headless and in the Studio's editor viewport.
- The simulation cannot ask the renderer anything; for example `ctx.fx.fade()` resolves on the
  simulation clock, not when the screen has actually faded.
- `GameView` notices a scene change by comparing `session.world` every frame and rebuilds all
  renderers.
- In the browser the step is the render-frame delta (clamped to 0.1 s; physics sub-steps at most
  1/120 s): there is no fixed-step loop, so exact reproducibility is only guaranteed by the headless
  fixed-step helpers.
- The purity of `src/engine/core` is a convention: no lint rule enforces it.

---

## ADR-003 — Data-driven content as validated JSON with localization keys (fr-FR required)

**Status:** accepted, implemented. **Code:** `src/engine/core/content/schemas.ts`,
`src/engine/core/packs/pack.ts`, `src/engine/core/packs/validate.ts`,
`src/engine/core/props/props.ts`, `src/engine/core/logic/*`, `src/engine/core/i18n/localizer.ts`,
`tests/acceptance/localization.test.ts`.

### Context

Stories, levels and rules must be editable in Civilization Studio by people who do not write code,
checked with understandable messages, and loaded identically by the game. The whole player-facing
game must be in French, with centralized localization keys and French as the default and required
language (`docs/narrative/MISE_A_JOUR_PROMPT_FRANCAIS.txt`).

### Decision

- Manifests, scenes, dialogues, quests, cinematics, logic rules, items, characters, prefabs and
  mechanic settings (`rules.json`) are JSON files validated by Zod schemas, with French error messages
  (`z.config(z.locales.fr())`). Each document carries `format` and `version`; its kind is derived
  from its path (`KIND_PATTERNS`).
- Logic inside content is data — `{ "type": "<registered id>", ...fields }` — interpreted by
  `LogicInterpreter` against `LogicRegistry`. Field schemas are declared once with `prop.*`, which
  provides TypeScript types, defaults, validation and the Studio's generated property editors.
- Player-visible text in content and code is a localization key, never literal text.
  `Localizer` resolves keys per namespace (engine and each pack), falls back to French key by key
  and renders a missing key as `⟦key⟧`.
- French is mandatory: `loadPack` reports an error for a civilization without `locales/fr-FR.json`;
  `validateCivilization` reports missing keys and raw text where a key is expected (content and
  literal `t('key')` calls in pack code); `tests/acceptance/localization.test.ts` checks the keys
  used by `src/game`, `src/engine` and `src/sdk`, hard-coded visible text in UI components, and the
  cleanliness of every French table.

### Consequences

- The Studio edits exactly the shapes the game loads; content changes need no build step.
- Reference integrity (entities, items, dialogues, sounds, variables…) is checked by the validator
  at validation time, not by the type system; `npm run validate` and acceptance test J must stay
  green.
- Adding a content field touches the schema, possibly the loader and validator, and the Studio
  editor of that document kind.
- All schemas are at `version: 1` and no content migration code exists yet (the header of
  `schemas.ts` says that a format change must add one).
- `fr-FR` is the only locale shipped; any other locale would currently fall back to French.

---

## ADR-004 — Civilization packs and the Mechanics SDK as the only extension surface

Isolation per civilization through `DisposableScope`.

**Status:** accepted, implemented. **Code:** `src/sdk/*`, `src/engine/core/packs/definitions.ts`,
`src/engine/core/packs/pack.ts`, `src/engine/core/sim/api.ts`, `src/engine/core/sim/contexts.ts`,
`src/engine/core/util/disposable.ts`, `src/engine/core/state/multiverse.ts`, `eslint.config.js`,
`tests/acceptance/G-mechanics-extensibility.test.ts`.

### Context

Each civilization has its own rules (rank locks, memory echoes…), UI and look. Adding one must not
require editing the engine, and switching civilization must not leave anything of the previous one
running (listeners, timers, movement modifiers, HUD, variables, registrations).

### Decision

- A civilization is a folder `civilizations/<id>/`: `manifest.json`, `pack.ts`, code folders,
  `content/`, `locales/`. Packs are discovered by `import.meta.glob` (`GlobContentProvider`); a new
  folder is enough for a pack to appear.
- `pack.ts` exports `definePack({ modules: import.meta.glob([...], { eager: true }), migrations? })`.
  `collectDefinitions()` registers every exported `define*` value, so adding a module is enough to add
  a mechanic, component, action, condition, event, item, ability, block, model, sound, music, HUD
  element, panel, visual or view effect.
- Pack code may only import the SDK — `@sdk`, `@sdk/ui`, `@sdk/view` — plus React and its own
  modules. ESLint (`no-restricted-imports` on `civilizations/**/*.{ts,tsx}`) rejects `@engine/*`,
  `@game/*`, `@studio/*` and relative paths into `src/`; seeds and tests are exempt.
- Everything a civilization registers at runtime goes through its `CivContext` and is owned by a
  `DisposableScope` tree: `civ:<id>` → `scene:<id>` → `entité:<id>` → component.
  `unloadCivilization()` disposes the scope, clears the civilization's variables, inventory, quests,
  dialogue memory, player state and UI, and unregisters every definition owned by the pack.
- Registrations carry an owner (the pack id); an id already owned by another pack is refused. Type
  ids must be `<pack>.<name>` and asset ids `<pack>:<name>` with the pack's own id: other ids are
  reported as errors when the pack loads (`checkDefinitionIds`). The pack ids `engine`, `global`
  and `ui` are reserved.
- A civilization writes only `<civId>.*` variables; global writes must match the manifest's
  `globalWrites` patterns.
- Each manifest declares an `engineApi` semver range, checked against `ENGINE_API_VERSION` (`1.0.0`).
- Library packs (`"kind": "library"`, e.g. `core`) share assets through `dependencies`.

### Consequences

- New mechanics are additive. The fixture pack `tests/acceptance/fixtures/lanterne` (only `@sdk`
  imports) demonstrates a mechanic, a component, an action, a condition, an event, blocks and a state
  migration loaded through the normal path and removed on unload.
- The SDK is the compatibility boundary: an engine capability a pack needs must be added to
  `CivContext` (`api.ts` + `contexts.ts`) and exported by `src/sdk`. `version.ts` asks for a major bump
  of `ENGINE_API_VERSION` on breaking changes (see [VERSIONING.md](VERSIONING.md)); nothing enforces
  it.
- Isolation covers what goes through the context. Module-level state in pack code, global DOM
  listeners or raw `setTimeout` calls are not tracked; pack modules stay cached by the module system
  after an unload.
- This is lifetime and namespace isolation, not a security sandbox: pack code runs with the full
  privileges of the page.
- Mechanics, HUD elements, panels and abilities are only activated for the running civilization;
  those declared by a library pack are ignored. Library packs stay registered after a switch.
- The lint rule is static and exempts `seed/` and `*.test.ts`: pack tests import `@engine/*` by
  design, and seeds reach engine voxel code through `@sdk/build`.

---

## ADR-005 — Seeds generate the first version of scenes; JSON is canonical afterwards

**Status:** accepted, implemented. **Code:** `civilizations/<pack>/seed/*.ts`, `tools/cli/civ.ts`
(`seed`), `src/sdk/build.ts`, `src/sdk/buildKit.ts`, `src/engine/core/voxel/construct.ts`.

### Context

Scenes are large voxel volumes (Verrou is 96×64×120 cells with close to 190 entities). Laying out a town
block by block in an editor is slow; code with a construction kit (walls, houses, roofs, stairs) is
fast for a first layout. Afterwards, designers must be able to refine the result in the Studio
without a generator overwriting their work.

### Decision

- Each pack can provide `seed/index.ts` exporting `seed(): Record<string, unknown>` (pack-relative
  path → document). The Door and Memory seeds generate their scenes and cinematics from shared
  layout constants, with `SceneBuilder` and the construction kit exported by `@sdk/build`.
- `npm run civ -- seed <pack> [--force]` validates each generated document of a known kind with its
  schema, refuses invalid ones, and never overwrites an existing file without `--force`.
- After the first generation, the JSON file is the source of truth and is edited in the Studio.
  Dialogues, quests, logic, items, characters, rules and locales are authored as JSON, not seeded.
- Seeds are outside the runtime: excluded from `tsconfig.json` (type-checked by
  `tsconfig.node.json`), ignored by the Studio explorer and by the hot-reload hook, exempt from the
  pack lint rule.

### Consequences

- Seeds and JSON can diverge as soon as the Studio edits a scene; the seed is then a historical
  starting point, not a build input.
- `--force` overwrites Studio edits; the CLI first copies each file it replaces to `.civ-backups/`
  (`….seed.bak`) and skips files whose content would not change.
- Changing a layout constant does not update existing scenes; scene and cinematic changes are made
  in the JSON (Studio) instead.

---

## ADR-006 — Civilization Studio file access through a scoped dev-server API

**Status:** accepted, implemented. **Code:** `tools/vite/civDevPlugin.ts` (its header refers to this
record), write rules shared with the Studio `src/engine/platform/devApiRules.ts`, client
`src/engine/platform/devApi.ts`, users `src/studio/core/devContent.ts`,
`src/studio/editors/ScriptEditor.tsx`. **Tests:** `tools/vite/civDevPlugin.test.ts`.

### Context

Civilization Studio runs in a browser page but must read and write pack files in the repository
(content JSON, locales, manifests, scripts). A page cannot touch the file system; an HTTP endpoint
that writes files is dangerous: other web pages could call it, DNS rebinding could reach it, a path
could escape the repository (`..`, absolute paths, symlinks), and a save could destroy work or
silently overwrite a file changed by another tool.

### Decision

A Vite plugin, `civDevPlugin()`, adds a middleware under `/__civ/api/` to the **dev server only**.

| Method | Route | Purpose | Path checks |
|---|---|---|---|
| GET | `packs` | List pack folders (names matching `^[a-z][a-z0-9-]*$`) and their files with a readable extension; entries starting with `.` and `node_modules` are skipped. | — |
| GET | `file?path=` | Read a file: `{ path, content, mtimeMs }`. | read rules + realpath |
| PUT | `file?path=` | Write `{ content, expectedMtimeMs? }`: `{ path, mtimeMs, backup }`. | write rules + realpath |
| DELETE | `file?path=` | Delete: `{ path, backup }`. | write rules + realpath |
| POST | `typecheck` | `{ paths }` → TypeScript diagnostics (ADR-007). | read rules + realpath, for each path |
| POST | `scaffold` | `{ pack, kind, name }` → new script in `mechanics/` (ADR-007). | write rules |

Safety rules, as implemented:

1. **Dev server only.** The plugin is declared with `apply: 'serve'` and only implements
   `configureServer`, so neither production builds nor `vite preview` contain the API. The dev server
   listens on `127.0.0.1` (`server.host` in `vite.config.ts`).
2. **Studio header.** Every request must carry `x-civ-studio: 1`, otherwise 403 (the code comment:
   "blocks simple cross-site requests"; `devApi.ts` always sends it).
3. **Loopback Host.** The `Host` header, without port and IPv6 brackets, must be `localhost`,
   `127.0.0.1` or `::1`, otherwise 403 (DNS-rebinding protection).
4. **Same origin.** When an `Origin` header is present, its host must equal the `Host` header
   (another local port, a remote site or `null` → 403). A `Sec-Fetch-Site` of `cross-site` or
   `same-site` → 403. Rules 2–4 are `checkRequestOrigin()`.
5. **Path validation** (`resolvePackPath(relPath, mode)`):
   - non-empty string of at most 512 characters, no NUL, no backslash, not absolute (400);
   - must equal its `path.posix.normalize` form and contain no `..` segment (400);
   - must start with `civilizations/<pack>/` (at least 3 segments, otherwise 403) with a pack id
     matching `^[a-z][a-z0-9-]*$` (400);
   - **write mode** (PUT, DELETE, scaffold): only `civilizations/<pack>/manifest.json` or a file below
     `content/`, `locales/`, `mechanics/`, `ui/`, `view/`, `assets/` or `models/` (403), with
     extension `.json`, `.ts` or `.tsx` (403) — `WRITABLE_PACK_DIRS` and `WRITABLE_EXTENSIONS` in
     `src/engine/platform/devApiRules.ts`, whose `isWritablePackFile()` the Studio uses to open every
     other file read-only;
   - **read mode**: extension `.json`, `.ts`, `.tsx`, `.md` or `.css` (403, `READABLE_EXTENSIONS`);
   - no path segment may start with `.` (400);
   - the resolved absolute path must be inside `<repo>/civilizations/` (403).
6. **Realpath containment** (`assertRealPathInside`, file GET/PUT/DELETE and each `typecheck` path):
   the first existing ancestor of the target is resolved with `realpath` and must be
   `civilizations/` or inside it, so a symlink cannot lead out (403).
7. **Body limit**: 32 MiB (413).
8. **Valid JSON only**: a PUT on a `.json` path whose `content` does not parse is refused with 422 and
   nothing is written. A body that is not JSON or lacks a string `content` → 400. The `typecheck`
   and `scaffold` bodies are parsed by `readJsonBody()` (not JSON → 400); `typecheck` also requires a
   `paths` array (400).
9. **Conflict check**: when `expectedMtimeMs` is a number and the file exists, a difference of more
   than 1 ms with the current mtime returns **409** and nothing is written. The Studio sends the
   `mtimeMs` it read (`StudioProject.save`).
10. **Backup before overwrite**: if the file exists, it is first copied to
    `.civ-backups/<repo-relative path>.<ISO timestamp with ':' and '.' replaced by '-'>.write.bak`;
    the response returns the backup path.
11. **Atomic write**: content goes to `<file>.<pid>.<timestamp>.tmp`, then `rename` replaces the target
    (parent folders are created as needed).
12. **Delete = move to backups**: 404 if the file does not exist; otherwise it is copied to
    `.civ-backups/…delete.bak` and then unlinked.
13. **Scaffold never overwrites**: `scaffoldScript()` validates the pack id and kind, requires an
    existing `pack.ts`, refuses an existing target and creates the file with the exclusive flag `wx`;
    its refusals are answered with 400.
14. Errors are JSON `{ error }` with French messages; status ≥ 500 is logged by Vite's logger; unknown
    routes return 404; URLs outside `/__civ/api/` go to Vite.

### Consequences

- The Studio can only write content, locales, manifests and the code modules of `mechanics/`,
  `ui/`, `view/`, `assets/` and `models/`; production builds have no write path at all. A build made
  with `CIV_BUILD_STUDIO=1` opens the Studio read-only (`bundledProjectIO`).
- There is no authentication: any local process able to reach the loopback port can call the API
  while `npm run dev` runs. The header, Host, Origin and `Sec-Fetch-Site` checks target browsers
  (other web pages), not local programs.
- `pack.ts` and other files outside these folders cannot be saved from the Studio: the script
  editor applies the same rules and opens them read-only (« Lecture seule »). The explorer does not
  list `seed/` and `tests/`.
- The conflict check only protects documents the Studio read from disk: for a document it created
  (`isNew`) it sends `expectedMtimeMs: null`, so a file that appeared on disk in the meantime is
  overwritten (its previous version still goes to `.civ-backups/`).
- Every route that touches a file checks its real path, `scaffold` and `typecheck` included: a
  symlinked folder leading outside `civilizations/` is refused with a 403.
- `.civ-backups/` is git-ignored and ESLint-ignored, and grows without pruning.
- The rules are exercised by `tools/vite/civDevPlugin.test.ts` on a temporary directory (the plugin
  accepts a `root` option for that purpose), which also checks that the Studio's
  `isWritablePackFile()` agrees with the server.

---

## ADR-007 — No eval of editor-supplied code

Scripts are TypeScript source files compiled by Vite, type-checked server-side; Monaco only in dev.

**Status:** accepted, implemented. **Code:** `src/studio/editors/ScriptEditor.tsx`,
`src/studio/StudioApp.tsx`, `src/studio/core/devContent.ts`, `src/studio/main.tsx`,
`tools/vite/typecheckService.ts`, `tools/vite/scaffold.ts`, `tools/vite/civDevPlugin.ts`,
`vite.config.ts`.

### Context

Designers want to write mechanics from the Studio. Evaluating text typed in a page (`eval`,
`new Function`, blob modules) would bypass the type checker, the lint rules, the module graph and
source maps, and would turn the editor into an arbitrary-code entry point.

### Decision

- Nothing typed in the editor is executed by the page. A search of `src/`, `tools/` and
  `civilizations/` finds no `eval` and no `new Function`.
- A script is a TypeScript file of the pack. « Enregistrer et recharger » (Ctrl+S) writes it through
  the scoped file API (ADR-006); a file the API may not write (`pack.ts`, for example) opens
  read-only. Vite compiles it like any source module; the `hotUpdate` hook sends
  `civ:code-changed`; the Studio calls `bumpPackCode(pack)` and `reloadPackCode(pack)`, which
  re-imports `/civilizations/<pack>/pack.ts?studio=<n>` — the only dynamic import with a computed URL,
  a same-origin module served by Vite — and `GameSession.reloadPack()` re-registers the definitions.
  The new modules are loaded before anything is unregistered, so a script that fails to load leaves
  the pack as it was.
- Type checking runs on the server: `createTypecheckService()` keeps a TypeScript `LanguageService`
  over the repository's `tsconfig.json` (same paths, strictness and SDK types as
  `npm run typecheck`). Monaco's own worker keeps syntax checking but has semantic validation
  disabled (`noSemanticValidation: true`).
- New scripts come from fixed templates (`behavior`, `action`, `condition`, `mechanic`) written by
  `scaffoldScript()` into `mechanics/`, which every pack's glob already loads.
- Monaco exists only in development: `ScriptEditor` is loaded with
  `lazy(() => import('./editors/ScriptEditor'))` only when `__CIV_STUDIO_AVAILABLE__` is true, a
  constant defined as `command === 'serve'` in `vite.config.ts`. `optimizeDeps.include` pre-bundles
  `monaco-editor` for the dev server.

### Consequences

- Scripts get the same compiler, lint rules and module semantics as hand-written pack code.
- Scripting needs `npm run dev`; a build has no script editor (`StudioApp.tsx` shows a message and the
  explorer hides the « Scripts » group). That the Monaco import is dropped from builds rests on the
  compile-time constant; no bundle inspection in the repository verifies it.
- A script must be saved before it runs or is type-checked: diagnostics describe the file on disk,
  and the playtest uses the saved code (ADR-010; starting a playtest warns about unsaved scripts).
- Pack code is trusted code running with page privileges; the protection is that it goes through the
  normal toolchain, not a sandbox.
- In the game page, a code change during a running civilization only shows a notification
  (`ui.dev.codeChanged`); `GameSession.reloadPack()` refuses to reload a pack used by the
  civilization running in that session.

---

## ADR-008 — Global multiverse state vs local civilization state in saves

**Status:** accepted, implemented. **Code:** `src/engine/core/state/multiverse.ts`,
`src/engine/core/save/saveFormat.ts`, `src/engine/core/state/variables.ts`,
`src/engine/core/sim/session.ts`, `src/engine/core/sim/contexts.ts`.

### Context

One protagonist crosses many civilizations. Some things must persist across worlds (who the
protagonist is, multiverse fragments, a few story flags, progress per civilization); everything else
(items, abilities, quests, variables, scene changes) must stay inside its civilization so that worlds
do not corrupt each other. Saves must survive engine and pack updates.

### Decision

- **Global state** — `GlobalState { schemaVersion, protagonist { awakenings, title, createdAt },
  fragments, flags, civs: { started, completed, lastPlayed, playTime } }` held by `MultiverseState`.
  Packs read it (`ctx.multiverse`, `global.*` variables, which are read-only views) and write only
  what their manifest's `globalWrites` allows (`"fragments.threshold"`, `"flags.door.*"`:
  `isWriteAllowed`).
- **Local state** — `LocalCivState` per civilization: scene, player (position, look, abilities,
  title), variables of the `<civId>.` namespace, inventory, quests, dialogue memory, fired rules,
  versioned mechanic states, per-scene diffs (entity states, spawned and removed entities, voxel
  edits), play time. While a civilization runs it lives in the session; when it unloads, a snapshot
  goes to `session.civStates`.
- **Save file** — `SaveGame { format: 'civverse.save', formatVersion, engineVersion, savedAt, slot,
  label, global, currentCiv, civs }`.
- **Versioning at every level**: `formatVersion` + `FORMAT_MIGRATIONS`, `global.schemaVersion` +
  `GLOBAL_MIGRATIONS`, the manifest's `stateVersion` + `definePack({ migrations })`
  (`migrateCivState`), and `state.version` + `migrate` for each mechanic and component
  (`migrateVersioned`).

### Consequences

- Items, abilities and variables never leak between civilizations; cross-civilization effects must
  be explicit global writes declared in the manifest.
- Saves are explicit: switching civilization keeps the previous local state in memory
  (`civStates`); it reaches storage at the next save or autosave.
- A newer `formatVersion`, `global.schemaVersion` or `stateVersion` than the code knows is refused
  with a French `SaveLoadError`; a missing layout, multiverse or pack migration step aborts the load
  (`migrateCivState()` sets `stateVersion` itself after each pack step). A mechanic or component
  state with no migration path falls back to its initial value with a logged warning.
- The migration tables are empty today (everything is version 1). `parseSave()` keeps unknown keys
  (`z.looseObject` at the top level, in the multiverse state and in each civilization state), but
  later saves are rebuilt from the session and do not carry unknown top-level keys over.
- New cross-civilization data requires changing `GlobalState`, `GLOBAL_SCHEMA_VERSION` and a global
  migration.

---

## ADR-009 — Procedurally generated original assets

No third-party game assets.

**Status:** accepted, implemented. **Code:** `src/engine/core/voxel/textures/generators.ts`,
`src/engine/core/voxel/textures/atlas.ts`, `src/engine/core/voxel/microModel.ts`,
`src/engine/view/characters/skin.ts`, `src/engine/core/audio/recipes.ts`,
`src/engine/audio/audioEngine.ts`, `src/engine/view/particles.ts`, `src/game/ui/icons.ts`,
`civilizations/*/assets/*.ts`, `civilizations/core/{mechanics,models}/*.ts`,
`civilizations/*/content/characters.json`.

### Context

The project needs a consistent original look and sound for many civilizations, without licensing
third-party art or audio, and without an asset pipeline. Packs must be able to define their own looks.

### Decision

- **Block textures**: recipes `{ gen, colors, seed, params }` turned into 16×16 tiles by
  `generateTile()` and packed into one atlas (`buildAtlas`); an unknown generator yields a "missing"
  checker tile.
- **Models**: micro-voxel models built in code (`defineModel({ build(b) { … } })`, 1/16 m voxels by
  default) and meshed by the engine.
- **Characters**: `CharacterDoc` data in `content/characters.json`, painted into a 256×256 pixel-art
  texture and box layout by `paintCharacter` (`skin.ts`), animated procedurally (`animator.ts`).
- **Sounds and music**: `SoundRecipe` / `MusicRecipe` data synthesized by `AudioEngine` (sounds
  rendered with `OfflineAudioContext`, music sequenced live).
- **Other visuals**: particle texture, item icons (canvas pixel art) and sky (shader) are generated
  at runtime.
- Assets are referenced by stable ids (`core:stone`, `door:…`) so that their recipe can change
  without touching worlds.
- A search of the repository (outside `node_modules`) finds no image, audio, 3D model or font file;
  the only graphic file is `public/favicon.svg`, a small SVG made of a few shapes.

### Consequences

- No art licensing or binary assets in git; the look is consistent and easy to vary per pack.
- Third-party material is limited to libraries and to fonts: the `@fontsource/*` packages
  (Alegreya Sans, Cinzel, Cormorant Garamond, IM Fell English, JetBrains Mono) declare `OFL-1.1` in
  their `package.json`.
- New kinds of looks require code: texture generators live in the engine; `registerTextureGenerator`
  exists in `generators.ts` but is not exported by the SDK.
- Generation costs CPU at load time (atlas, character textures, sound buffers) instead of download
  time.
- Code comments describe swapping ids for recorded files or images later; no loader for such files
  exists today.

---

## ADR-010 — Playtest runs the real game controller on unsaved working copies

With in-memory saves.

**Status:** accepted, implemented. **Code:** `src/studio/play/Playtest.tsx`,
`src/engine/platform/overlayContent.ts`, `src/studio/core/project.ts` (`overlay`),
`src/game/controller.ts` (`startPlaytest`), `src/engine/core/save/storage.ts`
(`MemorySaveStorage`), `src/studio/StudioApp.tsx`.

### Context

Designers must test what they are editing — including changes not yet saved — and see exactly what
players will see, without risking the player's saves.

### Decision

- « Depuis le début » and « Jouer ici » create
  `GameController.create({ provider: new OverlayContentProvider(studio.provider,
  studio.project.overlay([pack, ...deps])), mode: 'playtest', storage: new MemorySaveStorage() })`:
  the same controller, `GameView` (renderer, camera, audio, input) and HUD as `index.html`.
- `StudioProject.overlay()` provides every loaded JSON document of the pack and its dependencies
  (live voxel edits are flushed into the scene document first) plus the set of documents deleted in
  the Studio. `OverlayContentProvider` serves these over the base provider, overrides manifests and
  lists packs that exist only in the Studio.
- `startPlaytest()` loads the civilization with `fresh: true`. « Jouer ici » starts in the open scene
  at the editor camera with `quietStart` (no `civ.started` event, hence no opening cinematic).
- F8 or « Arrêter » stops; reaching the game's menu returns to the Studio; errors and warnings of the
  playtest session are mirrored into the Studio console. On stop the controller is disposed and the
  `useUi` store reset. The editor viewport stops rendering while the playtest runs.

### Consequences

- Unsaved scenes, dialogues, quests, cinematics, rules, locales and manifests are tested as they are.
- Saves made during a playtest are lost when it stops; the player's IndexedDB saves are never touched.
- Pack code is not overlaid: the playtest runs the scripts saved on disk (as re-imported after
  `civ:code-changed`), not unsaved editor buffers; starting a playtest prints a warning listing the
  unsaved scripts.
- Each playtest is a new `GameSession` with an empty multiverse state (the player's autosave is not
  loaded, unlike in the game): content that depends on another civilization's fragments or global
  flags behaves as if that civilization was never played.
- Settings are not isolated: `GameController` reads and writes the player's settings in
  `localStorage` (`civverse.settings.v1`).
- The playtest creates its own Babylon `Engine` on its own canvas; `GameViewOptions.engine` (engine
  reuse) exists but the playtest does not pass it.

---

## ADR-011 — Custom kinematic physics and voxel collision (no physics engine)

**Status:** accepted, implemented. **Code:** `src/engine/core/physics/body.ts`,
`src/engine/core/physics/collision.ts`, `src/engine/core/physics/colliders.ts`,
`src/engine/core/physics/aabb.ts`, `src/engine/core/sim/player.ts`, `src/engine/core/sim/npcMotor.ts`,
`src/engine/core/nav/pathfinder.ts`.

### Context

Exploration needs predictable first-person movement on blocks, slabs and stairs; NPC navigation and
headless reachability tests must use exactly the same rules as the player; the simulation must run
without the renderer (ADR-002).

### Decision

- One `KinematicBody` (acceleration, gravity, coyote time, jump buffer, automatic step-up, ground
  snapping) moves both the player (`PlayerController`) and NPCs (`NpcMotor`), sub-stepped at most
  1/120 s.
- `CollisionWorld` resolves movement axis by axis (Y, X, Z) against the voxel grid and a
  `ColliderSet` of entity boxes. Colliders are logical boxes independent of meshes.
- The A* pathfinder tests clearance with the same `CollisionWorld`; `walkTo()` in the headless helpers
  uses it to prove that every story target is reachable.
- Civilizations change movement through `MovementModifier`s and `setBaseMovement`, not by subclassing.
- No physics library is a dependency.

### Consequences

- Player, NPCs and tests agree on what is reachable.
- No rigid-body dynamics: no stacking, throwing or ragdolls.
- Colliders are axis-aligned; a yawed entity's box becomes the axis-aligned bounds of the rotated box
  (`rotatedBounds`).
- Collider queries are brute force, sized for a few hundred boxes per scene (code comment in
  `colliders.ts`).

---

## ADR-012 — Baked voxel lighting and budgeted chunk meshing

**Status:** accepted, implemented. **Code:** `src/engine/core/voxel/light.ts`,
`src/engine/core/voxel/mesher.ts`, `src/engine/view/voxelRenderer.ts`,
`src/engine/view/voxelMaterial.ts`, `src/engine/core/world/sceneWorld.ts`,
`src/engine/view/entityViews.ts`.

### Context

Towns contain many light sources (lanterns, crystals, emissive blocks) and are edited at runtime
(gameplay voxel edits, Studio painting). Lighting must stay cheap in the browser and be computable in
Node.

### Decision

- `LightField` computes sky light and coloured block light (levels 0–15) by flood fill in the core;
  after an edit only a bounded region is recomputed.
- The mesher (pure function, 16³ chunks, four render layers) bakes per-vertex ambient occlusion and
  smooth light into vertex data; `VoxelLightPlugin` multiplies the baked light by the scene's ambient
  sky colour. The sun is the only dynamic light on voxels (with shadows); the hemispheric light
  excludes voxel meshes.
- Entities sample the baked light (instance brightness for models, rig lighting for characters)
  every 0.25 s.
- Edits mark chunks dirty; `VoxelRenderer.update()` rebuilds dirty chunks within a per-frame budget
  (6 ms in the game, 10 ms in the Studio).

### Consequences

- The number of light sources has no per-frame shading cost; changing light (an edit, a lantern
  switched on) costs a light recompute and re-meshing of the affected chunks, on the main thread.
- Lighting is per vertex, light range is at most 15 cells, and props and characters get a coarse
  sampled brightness.
- Scenes are meshed synchronously when loaded (`buildAll()`); there is no worker, no greedy meshing
  and no LOD.

---

## ADR-013 — Contain faults of pack code instead of crashing

**Status:** accepted, implemented. **Code:** `src/engine/core/events/eventBus.ts`,
`src/engine/core/sim/behaviorSystem.ts`, `src/engine/core/sim/session.ts`,
`src/engine/core/logic/interpreter.ts`, `src/engine/core/sim/clock.ts`,
`src/engine/core/sim/presentation.ts`, `src/engine/core/util/disposable.ts`,
`src/engine/core/util/logger.ts`, `src/game/hud/CivUi.tsx`.

### Context

Pack code and content come from different authors and are edited live in the Studio. One exception
in a behavior, a rule or a HUD component should not take the whole game down.

### Decision

- Event handlers, clock timers and `onUpdate` callbacks, presentation listeners and scope disposals
  catch and report their errors; the event bus refuses re-entrant emission beyond depth 64.
- A component that throws while being created, updated, asked for offers, decorating an offer, or
  reacting to a props or visibility change is marked `faulted` and is then no longer updated nor
  asked for offers, decorations or vetoes. A `beforeInteract` veto that throws is logged and ignored;
  an `onInteract` that throws is logged and the interaction reports failure. A mechanic whose `setup`
  throws is recorded as failed while the others start; validation reports it as an error.
- An unknown or failing logic action stops its own action list and is logged with its origin; an
  unknown or failing condition evaluates to `false` and is logged. Both are also recorded in the
  interpreter's 300-entry trace.
- Each pack registration is guarded individually; duplicate ids owned by another pack are refused.
- Pack HUD elements and panels render inside a React error boundary (`CivErrorBoundary`); a failing
  panel is closed.
- Errors go to `LogHub` (ring buffer of 500 entries), shown by the F3 debug overlay in development
  only (`import.meta.env.DEV`; player builds show the performance line only) and mirrored into the
  Studio console during a playtest.
- A civilization that fails to load is unloaded (keeping its state) and the game shows an error
  screen.

### Consequences

- Broken content degrades locally (a component, an action list, a HUD element) instead of crashing.
- Failures can go unnoticed by a player; `npm run validate`, the playthrough tests and the acceptance
  tests are the safety net.
- This is error containment, not security isolation (see ADR-004).
