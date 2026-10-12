# Project status

State of CIVILIZATIONVERSE on **2026-10-12**, branch `ccr-9ca5874e-jnbwmz`. Every result below was
measured on this tree in the development container (Node 22.22.0, Chromium with SwiftShader, no
GPU). Nothing is reported as working on the strength of a build alone.

## Summary

The engine, the two civilizations and Civilization Studio are implemented and playable in a
browser. Door (« La Porte qui n’existe pas ») and Memory (« Le Nom qu’on t’a volé ») can each be
played from the first cinematic to the end screen, on every branch, and this is checked
automatically by headless playthroughs. All ten acceptance tests of the master prompt (A–J) have
an automated test that passes. The player-facing game is entirely in French.

Door and Memory are **finished prototypes** and are no longer modified (instruction of
2026-10-12, [`docs/narrative/FUTURE_CIVILIZATIONS_GUIDELINES.md`](docs/narrative/FUTURE_CIVILIZATIONS_GUIDELINES.md)).
The first large civilization, **Mask Civilization** (« Les Cent Visages », scenario in
[`docs/narrative/MASK_CIVILIZATION_SCENARIO.md`](docs/narrative/MASK_CIVILIZATION_SCENARIO.md)), is
being built chapter by chapter. Its engine foundations are done: items held in hand and really
used, worn items, combat with enemies, bosses and encounters, all part of the SDK and the Studio
([`docs/COMBAT_AND_EQUIPMENT.md`](docs/COMBAT_AND_EQUIPMENT.md)). Its **Prologue** and its
**Chapter I** « Courir plus haut » are written, playable from the first cinematic to the end of
Chapter I (Vaurel reading the list of qualified candidates) and tested by headless playthroughs;
Chapters II to VI, the Epilogue and the side quests are not written yet
([`docs/narrative/MASK_TRACEABILITY.md`](docs/narrative/MASK_TRACEABILITY.md)).

What is not done is listed honestly in [Outstanding bugs and limitations](#outstanding-bugs-and-limitations)
and [In progress and partial](#in-progress-and-partial): mostly Studio comfort features, the
versioning features that have nothing to migrate yet, seven scenario details marked *Partial* in
the traceability matrix, and measurements that need real hardware (frame rate on a GPU).

## Implemented features

### Engine (`src/engine`)

- **Headless simulation** (`src/engine/core`, no DOM): fixed-step clock, event bus, voxel volumes
  in chunks with a block registry (cube, slab and crossed-plane shapes; opaque, cut-out,
  translucent and emissive blocks), baked voxel light with coloured point lights, kinematic
  physics with voxel and entity collisions, A* pathfinding, entities with components (« behaviors ») and persistent state, interaction
  pipeline (prompt, primary/secondary action, vetoes), inventory, variables namespaced per
  civilization, multiverse state with declared `globalWrites`.
- **Logic**: data-driven actions, conditions and events (core set plus any pack's), rules
  reacting to events, `$self` / `$player` / `$event.*` references, a trace of recent executions
  (shown in the F3 overlay in development).
- **Story**: branching dialogues with conditions, choices and actions; quests with stages,
  objectives (event, condition or progress counter), optional and hidden objectives, journal
  history; cinematics with camera keys, character moves and animations, subtitles, fades and
  timed actions, skippable with « Passer la scène »; triggers, barks, end screens.
- **Packs and Mechanics SDK** (`src/sdk`): packs declare mechanics, components, actions,
  conditions, events, HUD elements, panels, visuals and view effects through `@sdk`, `@sdk/ui`
  and `@sdk/view` only (enforced by ESLint). Each civilization runs in its own disposable scope:
  switching civilization disposes its listeners, timers, HUDs, panels, key bindings and state.
  Faulty pack code is contained (a failing mechanic or component is reported, not fatal).
- **Saves**: versioned save format (IndexedDB, with a localStorage fallback when IndexedDB is
  unavailable), local state per civilization plus one multiverse state, autosave, quicksave (F5),
  three slots, validation and French error messages for damaged or newer saves, migration hooks
  for the save format, the multiverse, each pack's state and each mechanic's or component's state.
- **Localization**: ICU-style messages with French plural rules; every visible text is a key of
  a `fr-FR` table; French typography (’, « », no-break spaces) enforced by tests.
- **Rendering and audio** (`src/engine/view`, `src/engine/audio`): Babylon.js renderer with
  chunk meshing on a per-frame budget, procedural sky, fog and particles, procedurally textured
  voxel characters with walk cycles and expressions, collider debug view (F4), four quality
  levels; procedural sound synthesis (no audio files).
- **Input**: physical key positions (ZQSD on AZERTY = WASD on QWERTY), key labels shown for the
  player's layout, rebindable game keys and mouse buttons, pointer-lock mouse look.
- **Equipment and combat** (inactive unless a civilization uses them;
  [`docs/COMBAT_AND_EQUIPMENT.md`](docs/COMBAT_AND_EQUIPMENT.md)): six-slot hotbar and item in hand
  with a first-person view and hand animations, item uses on the mouse buttons (`defineItemUse`;
  strike and charged strike, guard with parry and riposte, tool on a target, shot, actions), worn
  items granting abilities, switch rules (attunement); player health, dodge, knockback, stagger,
  defeat and return to the last checkpoint, an « Indulgente » difficulty; components
  `core.health`, `core.combatant` (telegraphed melee, lunge, slam, shockwave and projectile
  attacks), `core.encounter`, `core.boss`, `core.checkpoint`, `core.toolTarget`; combat music;
  character masks and combat gestures.

### Game interface (`src/game`, French)

Main menu (*Continuer*, *Nouvelle partie*, *Civilisations*, *Registre des éveils*, *Paramètres*,
*Crédits*, and *Studio des civilisations* when the Studio is part of the build), civilization
selection with themed covers, loading screen, HUD (crosshair, interaction prompt, objective tracker, **objective markers with
distance**, notifications, location titles, ability bar, hotbar, health, boss bar, mouse-button
verbs, hit marker and defeat screen when a civilization uses them, civilization HUD slots), dialogue panel
with typewriter text and numbered replies, journal, inventory, documents, pause menu, save/load
slots, settings (controls and rebinding, mouse, field of view, quality, head bob, five volumes,
subtitle and dialogue text size, text speed, objective markers, frame counter), end screens, and
the F3 diagnostics overlay (performance only in player builds; story state, variables and logic
traces in development).

### Civilizations

| | Door — « La Porte qui n’existe pas » | Memory — « Le Nom qu’on t’a volé » |
|---|---|---|
| Scenes | `verrou` (the city on three tiers), `porte_absente` | `reminence` (market, workshop, houses), `chambre_blanche` |
| Content (validated) | 211 entities, 16 dialogues, 5 quests, 8 cinematics, 13 rules, 12 characters, 10 items, 437 French texts | 173 entities, 12 dialogues, 5 quests, 8 cinematics, 16 rules, 10 characters, 6 items, 485 French texts |
| Mechanics | `door.access` (ranks, permissions, refusals, permission map on R), `door.keyImprint` (three-dial puzzle); components `door.lock` (rank, item, condition, sealed, palm, impossible), `door.memory`, `door.watcher`, `door.restricted`, `door.spinner`, `door.ambientLoop` | `memory.chamber` (three-slot memory chamber on C, shards that change perception and dialogue), `memory.echoes` (echoes of the past with a view effect), `memory.offering` (pedestal puzzle); components `memory.recognition`, `memory.echoPoint`, `memory.recollection`, `memory.device`, `memory.pedestal`, `memory.closed` |
| Interface | rank plaque HUD, refusal stamp, imprint and permission panels, brass theme | chamber HUD and panel, echo overlay, shard captions, offering panel, amber theme |
| Multiverse | grants fragment `threshold`, writes flag `door.finalChoice` | grants fragment `remanence`; reads whether Door was completed (different vision) |

`civilizations/core` is a library pack of shared blocks, models, sounds (now also combat sounds)
and character looks. All assets are original and generated in code.

**Mask Civilization — « Les Cent Visages »** (in development, see
[In progress and partial](#in-progress-and-partial)):

| | Mask — Prologue « La place qu’on nous donne » and Chapter I « Courir plus haut » |
|---|---|
| Scenes | `rives`: the Rives Basses (the hero's room above Nora's workshop, quays and canal, market, registration office, candidates' stage, lift mill, the freight lift on its inclined rail with scaffolds and a brake station) under the upper tiers of Viremasque seen from below (Toits du Fil, Bastion de Fer, Terrasses de Verre, Jardins d'Or, Tour de l'Accord). Chapter I adds the inside of the registration office, the washerwomen's terrace and their footbridge over the canal, the fountain corner and the district's party, the qualifying course up the cliff (low walls, ladders, gaps, the training wheel, the flag) and Vaurel's study in the rock |
| Content (validated) | 217 entities, 19 dialogues, 4 quests (Prologue, side errand « Rien ne se jette », Chapter I, the thread « Le masque fendu »), 9 cinematics, 28 rules, 27 characters, 9 items, 498 French texts |
| Mechanics | `mask.ranks` (civic rank, ranks revealed by the story), `mask.masks` (the worn mask gives its power to the tool in hand), item use `mask.braise` (hammer blow; charged Braise strike with the Cendre mask), component `mask.monteCharge` (runaway wagon with a soft countdown: Juno holds it back instead of a failure), component `mask.voltige` (couriers leaping from roof to roof). Chapter I: `mask.calibrage` (a timed adjustment with the key: the sorting automaton, the training wheel), `mask.averse` (the sudden rain), `mask.glissade` (crates sliding down the wet footbridge; they shove the hero and interrupt the key), `mask.parcours` (the timed qualifying course: a fall or the time limit sends the runner back, with Kaël's advice), `mask.validerPreuve` (signatures in the application file); engine component `core.ladder` |
| Interface | rank plaque with the ladder of known ranks, wagon countdown, ember view effect, ochre and teal theme; Chapter I: adjustment gauge, course clock, the application file readable from the inventory, the blue filament of the split mask |
| Multiverse | none yet |

### Civilization Studio (`src/studio`, French interface)

Opened at `/studio.html?pack=<id>` with `npm run dev`:

- 3D viewport sharing the game's renderers: fly camera (right button + ZQSD/WASD, wheel,
  middle-button pan), selection, move/rotate/scale gizmos with snapping, block tools (place,
  erase, paint, fill or empty a box, eyedropper) with a palette, scene settings and environment.
- Hierarchy with folders, inspector (identity, transform, components and their typed property
  fields, French texts created as localization keys), entity templates, prefabs.
- Document editors: dialogue graph, quests, cinematics (timeline and live camera preview), logic
  rules (visual blocks for every registered action, condition and event, with designer notes),
  items (with their worn slot and their in-hand settings: model, placement and one block per
  mouse button), characters (3D preview, masks), mechanic settings, French texts, civilization manifest
  (identity, entry point, state version, theme, HUD, multiverse), prefabs.
- Scripts: TypeScript in Monaco, type-checked by the development server, written through a
  scoped file API, compiled and hot-reloaded by Vite — never `eval`.
- Validation panel, undo/redo with merged keystrokes, working copies saved together (Ctrl+S),
  stale-write detection, backups of every overwritten or deleted file.
- Playtest (« ▶ Jouer ici » from the editor camera, « ▶ Depuis le début » from the civilization's
  start) runs the real game on the unsaved working copies; F8 returns to the editor.
- Production builds contain neither the Studio nor the file API; `npm run build:with-studio`
  adds a read-only Studio.

### Tools

`npm run validate` (headless boot and content checks), `npm run bench` (CPU measurements),
`npm run civ -- new-pack` (pack skeleton), `npm run civ -- seed` (first version of scenes from
seed scripts, with backups), the Vite development plugin (file API, type checking, script
scaffolding, hot reload of packs).

## In progress and partial

- **Mask Civilization**: scenario received (7 chapters, epilogue, 5 side quests). Built one
  finished, tested chapter at a time (scenario §11.4). Done: the engine foundations it needs
  (equipment, item uses, combat, enemies, bosses, encounters, masks on characters, combat music),
  the pack (Rives Basses, the Cendre mask and Braise, ranks, 27 characters), the **Prologue**
  (P00–P02) and **Chapter I** (I01–I04), checked by headless playthrough tests (six for the
  Prologue, four for Chapter I, seven for the engine ladders) and in the browser. Gaps are listed in
  [`docs/narrative/MASK_TRACEABILITY.md`](docs/narrative/MASK_TRACEABILITY.md) §2.4 (Prologue) and
  §3.8 (Chapter I). Not done yet: Chapters II–VI, the Epilogue, the side quests Q1–Q5, the other
  masks and their powers (Fil, Fer, Verre, Or), mask switching and overload, the other six zones.
- **Door and Memory are frozen**: the *Partial* rows below stay as they are, by decision.
- **Scenario details marked *Partial*** in [`docs/narrative/TRACEABILITY.md`](docs/narrative/TRACEABILITY.md) §3
  (seven of the scenario requirements; everything else is *Implemented*):
  D-W3 (the Archive towers are closed decorations), D-W4 and D-M2 (the `item` and `condition`
  lock variants exist but no door uses them; the `impossible` refusal branch is unreachable),
  D-A1 (no animated shop signs), D-M5 (the absent door's reaction is scripted, not triggered by a
  failed check), D-N9 (the sneaking route is not covered by a test and later scenes do not depend
  on the route taken), D-K4 (the C04 sequence is split, its cinematics total 27 s instead of
  35–60 s).
- **Versioning without anything to migrate yet**: every format is at version 1. The migration
  chains of saves (format, multiverse, pack state, mechanic and component state) exist and are
  unit tested, but no migration is registered. Content files have no migration chain at all: their
  schemas accept version 1 only, so a file of another version is rejected by validation.
- **Voice**: dialogues and cinematics have French subtitles only; no recorded French voice
  exists, so none is played (the character field « Hauteur de voix » is stored for future use).

## Current architecture

```
browser ─┬─ src/game    React interface ── GameController ──┐
         └─ src/studio  Civilization Studio ── playtest ────┤
                                                            ▼
              src/engine/view  (Babylon.js, audio, input) ── renders a ──► GameSession
                                                                        (src/engine/core, headless)
                                                                              ▲
     civilizations/<id>  manifest, content JSON, fr-FR texts, code via @sdk ──┘
     tools/vite          dev server: scoped file API, type checking, hot reload (dev only)
```

- The simulation (`GameSession`) is plain TypeScript with no DOM: the same code runs in the
  browser, in the Studio's playtest and in the headless tests and CLI.
- Content is JSON validated by Zod schemas and refers to texts by localization key; seed scripts
  produce the first version of a scene, the JSON is canonical afterwards.
- Packs extend the engine only through the SDK; each civilization's state is local, the
  multiverse is global and writable only through declared paths.
- Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), decisions in
  [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Verified functionality

Measured on 2026-10-12 on this tree:

| Check | Command | Result |
|---|---|---|
| Type checking (strict, app and tools) | `npm run typecheck` | no error |
| Lint | `npm run lint` | no error, no warning |
| Unit, integration, playthrough and acceptance tests | `npm test` | 24 files, 132 tests, all pass (~3 min), including 16 equipment and combat tests (`src/engine/core/combat/combat.test.ts`), 7 ladder tests (`src/engine/core/behaviors/ladder.test.ts`) and the Mask playthroughs of the Prologue (`civilizations/mask/tests/mask.prologue.test.ts`) and of Chapter I (`civilizations/mask/tests/mask.chapitre1.test.ts`) |
| Browser tests (game and Studio) | `npm run test:e2e` | 6 tests (A, B, C, E, H, I), all pass (~2.6 min) |
| Content validation | `npm run validate` | 0 errors, 0 warnings (door 503 texts checked, memory 567, mask 535, core library 0 issues) |
| Production build | `npm run build` | builds; `dist/` holds `index.html` and assets only — no `studio.html`, no Monaco, no file-API code in the JavaScript; Vite warns about one 5 MB chunk (Babylon.js and React, 1.1 MB gzipped) |

Acceptance tests of the master prompt, all automated and passing — what each one does is in
[`docs/TESTING.md`](docs/TESTING.md#acceptance-tests-aj):

| Test | Where |
|---|---|
| A Player gameplay | `tests/e2e/game.spec.ts` (browser) |
| B World editing | `tests/e2e/studio.spec.ts` (browser) |
| C Playtest | `tests/e2e/studio.spec.ts` (browser) |
| D Story progression | `tests/acceptance/D-story-progression.test.ts` and both playthroughs |
| E Save persistence | `tests/acceptance/E-save-persistence.test.ts` and `game.spec.ts` (IndexedDB, page reload) |
| F Civilization isolation | `tests/acceptance/F-civilization-isolation.test.ts` |
| G Mechanics extensibility | `tests/acceptance/G-mechanics-extensibility.test.ts` (independent fixture pack) |
| H Civilization-specific UI | `tests/e2e/game.spec.ts` (browser) |
| I Editor code integration | `tests/e2e/studio.spec.ts` (browser: Monaco, type check, hot reload, playtest) |
| J Existing code preservation | the whole suite, plus `tests/acceptance/J-regression.test.ts` |

Also verified: French localization completeness and typography
(`tests/acceptance/localization.test.ts`), the Studio file API's security rules
(`tools/vite/civDevPlugin.test.ts`: traversal, symlinks, origins, write rules, stale writes,
backups), and CPU performance (`npm run bench`, numbers in
[`docs/TESTING.md`](docs/TESTING.md#performance): loading Door takes 140 ms, a simulation step
0.22 ms at the median, meshing a chunk 1.35 ms at the median).

**Not verified by any automated test**: frame rate on a GPU (the container renders with
SwiftShader at a few frames per second); mouse look (pointer lock is stubbed in browser tests,
the view is aimed through the session); browsers other than Chromium; audio output; writing
quality and pacing of the stories (play time is not measured); the look of scenes beyond the
screenshots taken while developing.

## Outstanding bugs and limitations

None of these breaks a playthrough of Door, Memory or the Mask chapters written so far.

**Engine and game**
- A hidden `core.particles` entity keeps emitting. Left as it is: Memory relies on the current
  behaviour (its footstep motes) and Memory is frozen; Mask's rain uses its own visual, which
  starts and stops.
- Mechanics, HUD elements and panels of *library* packs are never activated; only their assets
  are used.
- `QualityProfile.viewDistance` is not applied; the screen effects `blur` and `letterbox` have no
  handler (cinematic letterboxing uses the cinematic's own flag).
- Civilization-specific keys (Door's R, Memory's C) cannot be rebound in *Paramètres*; they come
  from each pack's `content/rules.json`.
- Engine events `door.opened` and `door.closed` share the `door.` prefix with the Door pack.
- `mechanics.get` returns `undefined` for a mechanic whose setup failed (callers must check).

**Saves and versions**
- `satisfies` understands single ranges only (`^`, `~`, comparisons, exact, `*`); compound ranges
  and x-ranges are rejected.
- The engine and pack versions stored in a save are not compared on load; pack dependencies have
  no version range.
- Nested parts of a save (scene states, mechanic states) are not schema-validated; the state of a
  mechanic or ability that no longer exists is dropped silently, and so are unknown keys of a
  civilization's saved state once that civilization is loaded and saved again.

**Civilization Studio**
- No « delete file » button; CSS files are listed but not editable.
- A script changed on disk while open in the Studio is not refreshed in the editor.
- Renaming an id does not update the references to it; validation does not check stage,
  objective, node or choice ids, nor `globalWrites`.
- The dialogue editor has no field for a dialogue's `title` and `speakers`; `$self` as a speaker
  is not offered.
- An invalid dialogue node id typed in the editor is silently reverted.
- The variable picker lists variables used in content, not those only declared in code.
- Prop `group` is not used to lay out the inspector; `visibleWhen` is re-evaluated only when the
  inspector re-renders.
- Files created by the Studio skip the stale-write check on their first save; `.civ-backups/`
  (backups of overwritten and deleted files) grows without pruning.
- Playtests use the game's settings and start with an empty multiverse.
- `useT` does not re-render on a locale change (only fr-FR exists).

## Next priorities

1. Mask Civilization, chapter by chapter: Chapter II « Un pas sur le Fil » (the Toits du Fil,
   the courier routes with Juno, Lys's anchor bracelet and the restored Fil mask), then Chapters
   III to VI, the Epilogue and the side quests — each one playable, tested by a headless
   playthrough, committed and published.
2. Measure the frame rate on real GPUs (F3 overlay, `npm run bench` for CPU) and apply
   `viewDistance` per quality level.
3. Studio: id renames that update references, a delete button, refreshing open scripts changed
   on disk, validation of stage/objective/node/choice ids and `globalWrites`.
4. Rebinding of civilization keys in *Paramètres*.
5. Saves: compare stored engine/pack versions on load, validate nested save parts, report dropped
   state instead of discarding it silently.
6. Recorded French voice lines, if a voice cast becomes available (until then, subtitles only).
7. Run the browser tests on Firefox and WebKit.

## Resuming development

```bash
git checkout ccr-9ca5874e-jnbwmz
npm install

npm run dev                  # game at http://127.0.0.1:5173/, Studio at /studio.html?pack=door
npm run check                # typecheck + lint + validate + unit/acceptance tests
npm run test:e2e             # browser tests (starts or reuses vite on port 5199)
npm run validate             # content and French texts of every civilization
npm run bench                # CPU measurements on the real packs
npm run build                # production build into dist/ (no Studio, no file API)
npm run build:artifact       # the game as a claude.ai Artifact page (dist-artifact/)
npm run civ -- new-pack <id> --name "Nom"    # new civilization skeleton
npm run civ -- seed <pack> [--force]         # regenerate a pack's first scenes (backs up files)
```

The game is also published as a private claude.ai Artifact, <https://claude.ai/artifact/FWXWnsuuf8mGje3qBsiH7P>
(game only, no Studio; saves live in each player's browser). To update it, run
`npm run build:artifact` and republish `dist-artifact/civilizationverse.html` with every file of
`dist-artifact/assets/` under `assets/` to the same URL. The build was played under the
Artifact's constraints (sandboxed frame, strict content security policy) before publishing.

Notes for this kind of container:
- Playwright uses the preinstalled Chromium (`/opt/pw-browsers`, or `CIV_CHROMIUM=<path>`) with
  SwiftShader flags; never run `playwright install`.
- If pages fail with « 504 Outdated Optimize Dep » after dependencies changed, stop vite, delete
  `node_modules/.vite` and start it again.
- The Studio browser tests write real files of the Door pack and restore them byte for byte;
  run them on a clean working tree to keep `git status` readable.
- Where to start reading: [`README.md`](README.md), then
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`HOW_TO_CREATE_A_CIVILIZATION.md`](HOW_TO_CREATE_A_CIVILIZATION.md)
  and [`HOW_TO_ADD_A_NEW_MECHANIC.md`](HOW_TO_ADD_A_NEW_MECHANIC.md).
