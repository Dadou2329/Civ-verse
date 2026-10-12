# CIVILIZATIONVERSE

*Un héros. Des civilisations infinies.*

CIVILIZATIONVERSE is a browser-playable, first-person, story-driven 3D voxel adventure platform.
The player wakes up in civilizations with their own rules, characters and mysteries; each
civilization is a **pack** with its own mechanics, world, story and interface, built on a shared
engine and a programmable **Mechanics SDK**. **Civilization Studio**, an in-browser editor, builds
the worlds, characters, dialogues, quests, cinematics and scripts, and playtests them with the real
game.

The player-facing game is entirely in **French** (fr-FR). Code, identifiers and developer
documentation are in English; Civilization Studio's interface is French.

Two finished prototype civilizations and a long adventure in progress ship with the engine:

| Pack | Adventure | Core mechanics |
|---|---|---|
| `civilizations/door` | **La Porte qui n’existe pas** — Verrou, a city where every door checks your social rank. | Rank locks and permissions, palm imprints, guards and localized suspicion, a door that remembers. |
| `civilizations/memory` | **Le Nom qu’on t’a volé** — Réminence, where memories are traded as shards. | A memory chamber (shards that change perception and dialogue), echoes of the past, consent to restoration. |
| `civilizations/mask` | **Les Cent Visages** — Viremasque, a vertical city where everyone wears the mask of their rank. In progress: the Prologue and Chapter I « Courir plus haut » are playable. | Civic ranks distinct from worn masks, tools held in hand and really used, the Cendre mask's Braise strike, a runaway freight lift; three proofs in any order, a timed adjustment with the key, crates sliding in the rain, a qualifying course with ladders and a training wheel. |

`civilizations/core` is a library pack (blocks, models, sounds, character looks) shared by all.
All textures, models, sounds and characters are original and generated procedurally in code.

## Quick start

Requirements: Node.js ≥ 22.12 and a browser with WebGL 2.

```bash
npm install
npm run dev
```

- Game: <http://127.0.0.1:5173/>
- Civilization Studio: <http://127.0.0.1:5173/studio.html> (add `?pack=door`, `?pack=memory` or `?pack=mask`)

Civilization Studio can save files only under `npm run dev`: the dev server adds a small,
scoped file API (see [ADR-006](docs/DECISIONS.md)). Production builds contain neither that API
nor the Studio.

### Controls (game)

Keys are physical positions, so the same keys work on AZERTY and QWERTY keyboards.

| Action | AZERTY | QWERTY |
|---|---|---|
| Move | Z Q S D or arrows | W A S D or arrows |
| Look | Mouse (click the view to capture it) | Mouse |
| Jump / skip a cinematic | Espace | Space |
| Run | Maj | Shift |
| Use the item in hand / guard | Left / right click | Left / right click |
| Item in hand (hotbar) | 1–6 or the wheel | 1–6 or the wheel |
| Dodge | A | Q |
| Interact / secondary action | E / F | E / F |
| Journal / inventory | J / I | J / I |
| Pause | Échap or P | Esc or P |

Civilizations add their own keys (Door: R for the permission map; Memory: C for the memory
chamber), shown in their interface. The keys above can be changed in *Paramètres*; civilization
keys cannot (they are set in each pack's `content/rules.json`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (game, Studio, file API, hot reload). |
| `npm run build` | Type-check, then build the game into `dist/` (no Studio). |
| `npm run build:with-studio` | Same, plus a Studio page (read-only: no file API outside the dev server). |
| `npm run build:artifact` | The game alone (no Studio) as a claude.ai Artifact page: `dist-artifact/civilizationverse.html` plus `dist-artifact/assets/` (one script, fonts, stylesheet). |
| `npm run preview` | Serve the production build. |
| `npm run typecheck` | TypeScript, strict, for the app and the tools. |
| `npm run lint` | ESLint. |
| `npm test` | Vitest: engine unit tests, Studio core, playthroughs, acceptance tests. |
| `npm run test:e2e` | Playwright browser tests of the game and the Studio. |
| `npm run validate` | Boots every civilization headless and checks content, references and French texts. |
| `npm run civ -- new-pack <id> --name "Nom"` | Creates the skeleton of a new civilization pack. |
| `npm run civ -- seed <pack> [--force]` | Generates a pack's first scenes/cinematics from its seed script. |
| `npm run bench` | Measures meshing, lighting, scene loading and simulation costs. |
| `npm run check` | Typecheck, lint, validate and unit tests in one go. |

## Repository

```
src/engine/core     headless simulation: world, physics, behaviors, logic, story, saves (no DOM)
src/engine/view     Babylon.js rendering of a session
src/sdk             the Mechanics SDK — the only API packs import (@sdk, @sdk/ui, @sdk/view)
src/game            React game interface and GameController
src/studio          Civilization Studio
civilizations/*     civilization packs (manifest, content JSON, French texts, mechanics, UI)
tools/              Vite dev plugin (Studio file API), CLI
tests/              unit and acceptance tests (headless) and browser tests (e2e)
docs/               architecture, formats, guides; docs/narrative holds the two scenarios
```

## Documentation

- [PROJECT_STATUS.md](PROJECT_STATUS.md) — what works, what was verified, known issues, next steps.
- [HOW_TO_CREATE_A_CIVILIZATION.md](HOW_TO_CREATE_A_CIVILIZATION.md) — adding a new civilization pack, step by step.
- [HOW_TO_ADD_A_NEW_MECHANIC.md](HOW_TO_ADD_A_NEW_MECHANIC.md) — adding a mechanic the engine never had.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md) — design and decision records.
- [docs/MECHANICS_SDK.md](docs/MECHANICS_SDK.md) — SDK reference.
- [docs/PACK_FORMAT.md](docs/PACK_FORMAT.md) — pack layout and content formats.
- [docs/STORY_AUTHORING.md](docs/STORY_AUTHORING.md) — dialogues, quests, logic rules, cinematics.
- [docs/EDITOR_GUIDE.md](docs/EDITOR_GUIDE.md) — Civilization Studio user guide.
- [docs/SAVE_FORMAT.md](docs/SAVE_FORMAT.md) and [docs/VERSIONING.md](docs/VERSIONING.md) — saves, versions, migrations.
- [docs/LOCALIZATION.md](docs/LOCALIZATION.md) — French texts and typography.
- [docs/TESTING.md](docs/TESTING.md) — test suites, acceptance tests A–J, measured performance.
- [docs/narrative/TRACEABILITY.md](docs/narrative/TRACEABILITY.md) — scenario requirements vs implementation.
