# Testing

How CIVILIZATIONVERSE is tested, what each suite proves, and the latest measured results.
Everything listed here was run; nothing is assumed from a successful build.

## Commands

| Command | Runs | Typical duration (this container) |
|---|---|---|
| `npm test` | Vitest (20 files, 97 tests): engine unit tests, Studio core, the complete Door and Memory playthroughs, acceptance tests D–G and J, localization and dev-API security tests | ~24 s |
| `npm run test:e2e` | Playwright browser tests A, B, C, E, H, I (6 tests) against the dev server | ~2.6 min |
| `npm run validate` | Boots every civilization headless and checks content, references and French texts; also reports the load issues of library packs (« ✓ core — bibliothèque, 0 problème(s) ») | ~9 s |
| `npm run typecheck` / `npm run lint` | TypeScript strict (app and tools) / ESLint | ~13 s / ~7 s |
| `npm run check` | typecheck + lint + validate + `npm test` | ~1 min |
| `npm run bench` | CPU costs on the real packs (see [Performance](#performance)) | ~11 s |

`npm run test:e2e` starts `vite --port 5199` (or, outside CI, reuses a server already running on
that port). Its browser is Chromium; in containers without a GPU, WebGL runs on SwiftShader
(software).

## Test suites

| Suite | Location | What it covers |
|---|---|---|
| Engine units | `src/engine/core/**/*.test.ts` | Voxel volume, codec, light and meshing; physics and collisions; pathfinding; props normalization; localizer (French plurals, missing keys); save state migrations (`save/saveFormat.test.ts`: `migrateCivState` chains a pack's migrations and sets the version itself, refuses a missing step or a newer state in French; `migrateVersioned` falls back to the initial state with a warning); semver ranges (`util/semver.test.ts`: `^`, `~`, comparisons, exact versions and `*`; compound ranges such as `>=1.0.0 <2.0.0` and x-ranges such as `1.x` are not supported and return false); the cinematic camera (`story/cinematics.test.ts`: a key without a field of view keeps the last one set before it, or 70°, and the field of view is interpolated between keys; keys stored out of time order play in time order). |
| Engine integration | `src/engine/core/sim/session.test.ts` | A fixture civilization in a headless `GameSession`: loading, cinematic skipping, movement and collisions, the full story loop (lock veto, dialogue choice, quest stages, trigger, global fragment), versioned saves, isolation between civilizations, namespace and `globalWrites` enforcement, and validation in a fresh session reporting the problems found while loading the civilization it checks (a dialogue that fails its schema). |
| Playthroughs | `civilizations/door/tests`, `civilizations/memory/tests` | Each story played to its end like a player (A* walking with the player's size, the real interaction pipeline, dialogue choices, cinematics skipped), on every branch, plus save/reload in the middle. They prove there is no dead end. |
| Studio core | `src/studio/core/studio.test.ts` | Undo/redo with merged keystrokes and transactions, entity templates with French text keys, moving/duplicating/renaming/deleting, live block edits saved into the scene file, undoable document creation. |
| Core library | `tests/unit/corePack.test.ts` | Every block, model and character of `civilizations/core` builds. |
| Acceptance (headless) | `tests/acceptance/*.test.ts` | Tests D, E, F, G and J below, and localization completeness. |
| Dev API security | `tools/vite/civDevPlugin.test.ts` | The Studio file API on a temporary directory (see below). |
| Browser (E2E) | `tests/e2e/*.spec.ts` | Tests A, B, C, E (browser), H and I below. |

## Acceptance tests A–J

Requirements from the master prompt (§20), each mapped to the tests that verify it.

| Test | Requirement | Verified by | Result |
|---|---|---|---|
| **A** Player gameplay | Launch the game, enter an environment, move, jump, interact, open a dialogue without errors. | `tests/e2e/game.spec.ts` › A: main menu → *Civilisations* → Door; the awakening cinematic is skipped with Espace; the objective « Sortir de la cellule » is shown and an objective marker with its distance (« N m », `ui.marker.distance`) is on screen; Z/W walks (> 1 m measured); Espace jumps (`player.jumped`); the French prompt appears and E opens the handleless cell door (palm); the player leaves the cell (objective), walks to Noé and presses E; the dialogue panel shows « Noé » and his French line; replies are clicked until DOOR_Q00 completes. No console error or exception. | ✅ |
| **B** World editing | Open the Studio, create an object, modify its position, save, reload, confirm. | `tests/e2e/studio.spec.ts` › B: *＋ Ajouter* → *Panneau*; X/Y/Z typed in the inspector; *Enregistrer*; the scene file on disk holds the new position and the locale its French text; after reloading the Studio, the entity and its position are back in the editor and the inspector. | ✅ |
| **C** Playtest | Edit a scene, launch playtest, interact with its objects, return to the editor. | `studio.spec.ts` › C: a *Point d’interaction* is added in the prologue cell and given a « Afficher une notification » action with a French text typed in the inspector; *▶ Jouer ici* runs the real game; E on the object shows the notification; F8 returns to the editor with the unsaved edits intact. | ✅ |
| **D** Story progression | Start a quest, trigger its objectives, finish it, verify state changes. | `tests/acceptance/D-story-progression.test.ts`: DOOR_Q00_REVEIL from start to completion through play (events, rank 0, plaque, next quest, French journal; the first objective targets the cell door and its marker point lies just above the door); MEM_Q00_EVEIL objectives and stage change. Every quest of both stories is also completed by the playthroughs. | ✅ |
| **E** Save persistence | Save, reload, confirm meaningful progress remains. | `tests/acceptance/E-save-persistence.test.ts` (save path of the game, new session, quests, variables, inventory, door states, position, multiverse; two civilizations in one save; damaged/newer saves rejected with French messages) and `game.spec.ts` › E (pause menu → *Sauvegarder* → slot 1, page reload, *Continuer*, *Charger* slot 1: quests, rank, plaque, position and objectives are back — IndexedDB). | ✅ |
| **F** Civilization isolation | Load Door, activate its mechanic, switch to Memory, verify Door systems stop. | `tests/acceptance/F-civilization-isolation.test.ts`: in one session, Door's rank refusal, permission panel key, HUD and a temporary rank are active; after loading Memory no Door definition, HUD, panel, key binding, variable or text remains, Door's saved state does not change during 10 s of Memory and no Door event fires; Door comes back intact; unloading leaves no listener or timer. Also `session.test.ts` on a fixture. | ✅ |
| **G** Mechanics extensibility | A mechanic as an independent module, working without modifying engine subsystems. | `tests/acceptance/G-mechanics-extensibility.test.ts` with the fixture pack `tests/acceptance/fixtures/lanterne` (only imports `@sdk`, checked): a lantern burning oil, a key binding, a door veto, a new action, condition and event used by JSON rules, validation, save, a v1 → v2 state migration, clean unload. Also `studio.spec.ts` › I in the browser. | ✅ |
| **H** Civilization-specific UI | Two packs with distinguishable interfaces, each showing its own. | `game.spec.ts` › H: Door shows its rank plaque (« Sans-Seuil ») and theme, no memory chamber; Memory shows « Chambre mnésique », no plaque, another accent color, and its own key opens its own panel. | ✅ |
| **I** Editor code integration | Create or modify a gameplay script, compile it, associate it with content, test its behavior. | `studio.spec.ts` › I: *Nouveau script* (behavior template); edited in the Monaco editor (a variable is set on interaction); *Enregistrer et recharger*: written by the dev API, compiled by Vite, type-checked by the server (0 error), pack reloaded; the new component is added to a marker from « Ajouter un composant »; *Jouer ici* + E sets the variable in the running game. The script is removed afterwards. | ✅ |
| **J** Existing code preservation | Regression checks. | The whole suite. `tests/acceptance/J-regression.test.ts` adds: every bundled civilization (found from the manifests, so a new pack is included automatically) validates with 0 errors and 0 warnings (same checks as `npm run validate`, including French texts used in code and in `rules.json`), the scenario quests/cinematics/fragments of Door and Memory exist, every cinematic is skippable, content never shrinks below a recorded baseline, and the engine version matches `package.json`. | ✅ |

### How the browser tests drive the game

- Keyboard input is real (`keydown`/`keyup`); dialogue replies and Studio controls are clicked.
- **Mouse look is not exercised.** Pointer lock is disabled in the tests (it would capture the
  keyboard focus in headless Chromium), and the view direction is set through the session
  (`player.setLook`) when the test needs to aim. Movement, jumping and interactions still go
  through the keyboard and the game's interaction pipeline.
- The graphics quality is set to *Basse* through the saved settings (software rendering).
- The simulation runs at the browser's frame rate (frames capped at 0.1 s of game time), so all
  waits are conditions with long timeouts, never fixed sleeps.
- Results are read through the development hooks `window.__civ` and `window.__studio`.
- The Studio tests write real files of the Door pack (saving is the point). Every touched file is
  copied first and restored byte for byte afterwards, the created script is deleted, and the
  restoration itself is asserted.

## Localization completeness

`tests/acceptance/localization.test.ts` (French is a hard requirement):

- every pack has a `locales/fr-FR.json`, and it is the only table;
- every key used literally by the game interface, the engine and the SDK exists in French; keys
  built at runtime (`` t(`prefix.${x}`) ``) have entries under their prefix;
- no visible text is written directly in the interface components of the game or the packs
  (JSX text and `title`/`placeholder`/`aria-label`/`alt`/`label` attributes), except the brand
  name;
- every table is clean French: no empty or placeholder value, keys in the table's namespace,
  typographic apostrophes (’) and ellipses (…), no-break spaces before « ? ! ; : » and inside
  « », no English leftovers (heuristic word list).

The validator (`npm run validate`, test J) checks every key referenced by content — scenes,
dialogues, quests, cinematics, items, characters, manifests, mechanic settings — and by pack code.

## Dev API security

`tools/vite/civDevPlugin.test.ts` exercises the Studio's file API middleware on a temporary copy of
the repository layout: path traversal, absolute/malformed/hidden paths, folders outside a pack,
write rules (only `content/`, `locales/`, the code folders loaded by `pack.ts`, and the manifest;
never `pack.ts`, `seed/`, `tests/` or a `scripts/` folder), symlinks leading outside
`civilizations/` (read, write, type-check and script scaffolding), requests without the Studio
header, from another host, origin, port or site, invalid JSON (files not written; invalid request
bodies of the type-check and scaffold routes answered with 400), stale writes (409), atomic writes
with backups, deletes kept in `.civ-backups/`, script scaffolding that never overwrites, unknown
routes, and the fact that production builds contain neither the API nor the Studio. The Studio and
the server share one rule module (`src/engine/platform/devApiRules.ts`); a test checks they agree.

## Performance

Measured with `npm run bench` on this container (Node v22.22.0, Intel Xeon @ 2.10 GHz, 4 cores,
no GPU), 2026-10-12. CPU-side costs only:

| | Door — « Verrou » (96×64×120 blocks, 188 entities) | Memory — « Réminence » (96×40×96, 161 entities) |
|---|---|---|
| Loading the civilization (content, voxels, entities, light) | 140 ms | 106 ms |
| Light field, full computation | 32 ms | 14 ms |
| Texture atlas | 73 ms (110 blocks) | 26 ms (108 blocks) |
| Meshing every chunk | 192 chunks in 392 ms (median 1.35 ms, p95 6.7 ms per chunk) | 108 chunks in 191 ms (median 0.69 ms, p95 6.1 ms) |
| Geometry | 209 meshes, 418 828 vertices | 95 meshes, 244 096 vertices |
| Simulation step (1/60 s) | median 0.22 ms, p95 0.73 ms | median 0.09 ms, p95 0.34 ms |
| Save | 1.3 ms, 8 KiB | 1.1 ms, 14 KiB |

The renderer meshes chunks within a per-frame time budget, so a scene appears progressively
rather than freezing for the full meshing time.

**Frame rate was not measured.** This container renders WebGL with SwiftShader (CPU), which
gives a few frames per second and says nothing about a real GPU. To measure on a real machine:
*Paramètres → « Afficher les images par seconde »* in the game, or F3 for frame time, draw calls and vertices.

## Adding tests

- A new civilization: a headless playthrough next to its content
  (`civilizations/<id>/tests/<id>.playthrough.test.ts`, see Door and Memory) — it is what proves
  the story has no dead end. `npm run validate` and test J pick the pack up automatically.
- A new mechanic: test it headless like `tests/acceptance/G-mechanics-extensibility.test.ts`
  (`createHeadlessGame`, `advance`, `walkTo`, `talk` from `@engine/core/testing/headless`).
- Browser tests only for what needs the real page (rendering, input, IndexedDB, the Studio UI).
