# Civilization Pack format

Reference of the on-disk format of a CIVILIZATIONVERSE civilization pack, as implemented in this
repository (engine API `1.0.0`). Every rule below points at the code that implements it; when the
code and a comment disagree, the code is described. For a step-by-step procedure, read
[HOW_TO_CREATE_A_CIVILIZATION.md](../HOW_TO_CREATE_A_CIVILIZATION.md). Related documents:
[MECHANICS_SDK.md](MECHANICS_SDK.md) (code API), [STORY_AUTHORING.md](STORY_AUTHORING.md)
(dialogues, quests, rules, cinematics in depth), [EDITOR_GUIDE.md](EDITOR_GUIDE.md) (Civilization
Studio), [SAVE_FORMAT.md](SAVE_FORMAT.md), [VERSIONING.md](VERSIONING.md),
[ARCHITECTURE.md](ARCHITECTURE.md).

| Topic | Source of truth |
| --- | --- |
| Zod schemas of every JSON document | `src/engine/core/content/schemas.ts` |
| File classification, pack loading, `definePack` | `src/engine/core/packs/pack.ts` |
| `define*` helpers and definition collection | `src/engine/core/packs/definitions.ts`, `src/sdk/ui.tsx`, `src/sdk/view.ts` |
| Identifier patterns | `src/engine/core/util/ids.ts` |
| Registration, dependencies, civilization lifecycle | `src/engine/core/sim/session.ts` |
| Validation | `src/engine/core/packs/validate.ts`, `tools/cli/validateRunner.ts` |
| Engine and API versions | `src/engine/core/version.ts` |
| Voxel encoding | `src/engine/core/world/sceneVoxels.ts`, `src/engine/core/voxel/codec.ts`, `src/engine/core/voxel/volume.ts` |
| Global (multiverse) state | `src/engine/core/state/multiverse.ts` |

## Contents

1. [Overview](#1-overview)
2. [Directory layout](#2-directory-layout)
3. [manifest.json](#3-manifestjson)
4. [pack.ts and code modules](#4-packts-and-code-modules)
5. [Assets defined in code](#5-assets-defined-in-code)
6. [Content documents](#6-content-documents)
7. [Identifiers and naming conventions](#7-identifiers-and-naming-conventions)
8. [Localization](#8-localization)
9. [Dependencies](#9-dependencies)
10. [Multiverse: fragments, flags and write permissions](#10-multiverse-fragments-flags-and-write-permissions)
11. [Versioning](#11-versioning)
12. [Validation](#12-validation)
13. [Limitations](#13-limitations)

---

## 1. Overview

A pack is a directory `civilizations/<id>/` with a `manifest.json` and a `pack.ts`.

- **Discovery.** There is no central list of packs. `src/engine/platform/globContent.ts` collects
  `import.meta.glob('/civilizations/*/manifest.json', { eager: true })`; pack code
  (`/civilizations/*/pack.ts`) and content (`/civilizations/*/content/**/*.json`,
  `/civilizations/*/locales/*.json`) are lazy chunks. Adding a directory is enough for the pack to
  be found.
- **Directory name = manifest `id`.** Code and content are looked up by path built from the id
  (`/civilizations/${packId}/pack.ts`). If the directory is named differently, loading fails (in
  the game and the CLI: `pack.ts introuvable pour "<id>".`).
- **Kinds.** `kind: "civilization"` packs are playable and listed in the selection screen;
  `kind: "library"` packs only provide shared definitions to packs that depend on them.

The repository contains three packs:

| Pack | `kind` | Name key / French title | `order` | `dependencies` |
| --- | --- | --- | --- | --- |
| `civilizations/core` | `library` | `core.pack.name` | 0 | none |
| `civilizations/door` | `civilization` | `door.name` — « La Porte qui n’existe pas » | 10 | `["core"]` |
| `civilizations/memory` | `civilization` | `memory.name` — « Le Nom qu’on t’a volé » | 20 | `["core"]` |

Packs are read through a `ContentProvider` (interface in `src/engine/core/packs/pack.ts`):

| Provider | File | Used by |
| --- | --- | --- |
| `GlobContentProvider` | `src/engine/platform/globContent.ts` | the game, `npm run validate` (inside Vite's module runner), Vitest tests |
| `DevContentProvider` | `src/studio/core/devContent.ts` | Civilization Studio under `npm run dev` (reads the files on disk through the dev server API) |
| `OverlayContentProvider` | `src/engine/platform/overlayContent.ts` | Studio playtest and Studio validation (unsaved documents layered over the base provider) |
| `MemoryContentProvider` | `src/engine/core/packs/memoryProvider.ts` | unit tests with in-memory packs (see `src/engine/core/sim/session.test.ts`) |

---

## 2. Directory layout

| Path (relative to the pack) | Contents | Loaded by | Studio can save it |
| --- | --- | --- | --- |
| `manifest.json` | identity, versions, entry point, permissions, theme | eager manifest glob | yes |
| `pack.ts` | `export default definePack({ modules: import.meta.glob([...], { eager: true }) })` | lazy `pack.ts` glob | no |
| `mechanics/**/*.ts` | mechanics, behaviors, actions, conditions, events (`core` also keeps its blocks and sounds here) | the glob in `pack.ts` | yes |
| `assets/**/*.ts` | blocks, models, sounds, music (Door, Memory) | the glob in `pack.ts` | yes |
| `models/**/*.ts` | models (`core` only) | the glob in `core/pack.ts` | yes |
| `ui/**/*.tsx` | HUD elements and panels (React), plus the CSS files they import | the glob in `pack.ts` (`.tsx` only) | yes (not the CSS files) |
| `view/**/*.ts` | Babylon.js visuals and view effects | the glob in `pack.ts` (Door, Memory and the scaffold) | yes |
| `content/scenes/<id>.scene.json` | scenes (voxels + entities) | content glob, parsed on demand | yes |
| `content/dialogues/<id>.dialogue.json` | dialogue graphs | content glob | yes |
| `content/quests/<id>.quest.json` | quests | content glob | yes |
| `content/cinematics/<id>.cinematic.json` | cinematics | content glob | yes |
| `content/logic/<id>.logic.json` | event rules | content glob | yes |
| `content/prefabs/<id>.prefab.json` | prefabs (used by the Studio only; no pack ships one) | content glob | yes |
| `content/items.json` | items | content glob | yes |
| `content/characters.json` | character appearances | content glob | yes |
| `content/rules.json` | settings of the pack's mechanics | content glob | yes |
| `locales/fr-FR.json` | the French string table, the only locale file the tests accept (section 8) | content glob (pattern `locales/<ll-RR>.json`) | yes |
| `seed/*.ts` | world generation scripts, run by `npm run civ -- seed <id>` | the CLI only | no |
| `tests/*.test.ts` | Vitest tests (headless playthroughs) | `vitest.config.ts` (`civilizations/**/*.test.ts`) | no |

Notes:

- Content files are classified by the regular expressions of `KIND_PATTERNS` in
  `src/engine/core/packs/pack.ts`: a file must sit directly in its folder and use the exact suffix
  (`content/scenes/x.scene.json`, not `content/scenes/sub/x.scene.json`). Other JSON files under
  `content/` are ignored without a message.
- "Studio can save it": the dev server API (`tools/vite/civDevPlugin.ts`) only writes
  `manifest.json` and files under `content/`, `locales/`, `mechanics/`, `ui/`, `view/`, `assets/`
  and `models/` (`WRITABLE_PACK_DIRS` in `src/engine/platform/devApiRules.ts`, shared with the
  Studio), with the extensions `.json`, `.ts`, `.tsx`. Everything else (`pack.ts`, `seed/`,
  `tests/`, CSS files) is edited outside the Studio: its Explorer does not list `seed/` and
  `tests/`, and its script editor opens the other code files it lists, such as `pack.ts`,
  read-only (« Lecture seule »).
- `seed/` is excluded from `tsconfig.json` and type-checked through `tsconfig.node.json`;
  `seed/`, `tests/` and `content/` are skipped when `npm run validate` extracts localization keys
  from code.

What the existing packs contain:

| | `core` | `door` | `memory` |
| --- | --- | --- | --- |
| Code folders | `mechanics/` (`blocks.ts`, `sounds.ts`), `models/` | `mechanics/`, `assets/`, `ui/`, `view/` | `mechanics/`, `assets/`, `ui/`, `view/` |
| Scenes | none | `verrou`, `porte_absente` | `reminence`, `chambre_blanche` |
| Dialogues / quests / cinematics / logic files | none | 16 / 5 / 8 / 2 | 12 / 5 / 8 / 2 |
| `items.json`, `characters.json`, `rules.json` | `characters.json` only | all three | all three |
| `seed/`, `tests/` | no | yes | yes |

---

## 3. manifest.json

The Door manifest, verbatim (`civilizations/door/manifest.json`):

```json
{
  "format": "civverse.pack",
  "version": 1,
  "id": "door",
  "kind": "civilization",
  "name": "door.name",
  "description": "door.description",
  "tagline": "door.tagline",
  "packVersion": "0.1.0",
  "engineApi": "^1.0.0",
  "dependencies": ["core"],
  "entry": { "scene": "verrou", "spawn": "spawn_cell" },
  "scenes": ["verrou", "porte_absente"],
  "stateVersion": 1,
  "globalWrites": ["fragments.threshold", "flags.door.*"],
  "fragments": [{ "id": "threshold", "name": "door.fragment.threshold", "hint": "door.fragment.threshold.hint", "icon": "fragment" }],
  "theme": {
    "accent": "#e3b84d",
    "accentSoft": "#8fb3d9",
    "panel": "rgba(20, 17, 14, 0.88)",
    "panelBorder": "rgba(227, 184, 77, 0.38)",
    "text": "#efe6d6",
    "textDim": "#a89d8a",
    "font": "\"Alegreya Sans\", system-ui, sans-serif",
    "titleFont": "\"Cinzel\", Georgia, serif"
  },
  "cover": { "colors": ["#1d1712", "#5a3a22", "#e3b84d"], "motif": "door" },
  "hud": { "hide": [] },
  "order": 10,
  "credits": ["Scénario : dossier narratif 001 — « La Porte qui n’existe pas ».", "Monde, mécaniques, musiques et sons originaux, générés de manière procédurale."],
  "tags": ["énigme", "société", "mystère"]
}
```

Fields (`ManifestSchema`):

| Field | Type and default | Behavior |
| --- | --- | --- |
| `format` | literal `"civverse.pack"` | required |
| `version` | literal `1` | required |
| `id` | `^[a-z][a-z0-9-]*$`, except `engine`, `global` and `ui` | must equal the directory name; namespace of the pack's variables (section 7). The reserved ids are refused (`Identifiant de pack réservé par le moteur (engine, global, ui).`) |
| `kind` | `"civilization"` or `"library"`, default `"civilization"` | only civilizations are listed, playable and validated by `validateCivilization` |
| `name`, `description` | localization keys (required) | shown on the selection card; read from `locales/fr-FR.json` before the pack is loaded (`GameSession.refreshManifests`) |
| `tagline` | localization key, optional | shown on the selection card |
| `packVersion` | string matching `^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$` (`x.y.z`, optional pre-release suffix such as `1.2.0-beta.1`) | stored in each local save (`LocalCivState.packVersion`); not used to migrate anything |
| `engineApi` | semver range | must be satisfied by `ENGINE_API_VERSION` (`1.0.0`), otherwise the pack is rejected (section 11) |
| `dependencies` | pack ids, default `[]` | loaded before the pack (section 9) |
| `entry` | `{ "scene": <local id>, "spawn": <local id> }`, optional in the schema | first scene and spawn entity; a civilization without an entry scene (and without a saved scene) fails to start with `Aucune scène d’entrée pour "<id>".` |
| `scenes` | local ids, default `[]` | each listed id must have a scene file (error otherwise). Scenes are discovered from files: a scene file that is not listed still loads |
| `stateVersion` | integer ≥ 1, default `1` | version of the pack's local save state; see `migrations` in section 4. Editable in the Studio's manifest editor (« Version de l’état ») |
| `globalWrites` | strings, default `[]` | global paths this pack may write: `fragments.<id>` or `flags.<name>`; a trailing `*` matches a prefix (section 10) |
| `fragments` | `[{ id, name, hint, icon? }]`, default `[]` | entries of the « Registre des éveils » screen; `id` is a local id, `name`/`hint` are keys, `icon` is one of the item icon shapes (section 6.6) |
| `theme` | object, optional | colors and fonts of the civilization's UI (below) |
| `cover` | `{ colors: hex[] (2 or more), motif: string }`, optional | selection card background and motif (below) |
| `hud` | `{ hide: string[] }`, default `{ hide: [] }` | built-in HUD elements hidden when the civilization starts (below) |
| `order` | number, default `100` | position in the selection screen (ascending) |
| `credits`, `tags` | strings, default `[]` | editable in the Studio's manifest editor; the game does not display them (`src/game/screens/Menus.tsx`) |

**Theme** (`ThemeSchema`). `accent` (hex, required when `theme` is present), `accentSoft`, `text`,
`textDim` (hex), `panel`, `panelBorder` (any CSS color string), `font`, `titleFont` (CSS
`font-family`). `ThemedRoot` in `src/game/GameApp.tsx` maps them to the CSS variables
`--civ-accent`, `--civ-accent-soft`, `--civ-panel`, `--civ-panel-border`, `--civ-text`,
`--civ-text-dim`, `--civ-font`, `--civ-title-font` while the civilization runs; pack CSS uses these
variables (`civilizations/door/ui/door.css`). The fonts bundled by `src/game/main.tsx` are Alegreya
Sans, Cinzel, Cormorant Garamond, IM Fell English and JetBrains Mono. Door uses Cinzel for titles,
Memory uses Cormorant Garamond.

**Cover.** The selection card (`CivSelect` in `src/game/screens/Menus.tsx`) uses `colors[0]` and
`colors[1]` for its gradient (further colors are not used), `theme.accent` for `--civ-accent`,
`theme.titleFont` for the title, and adds the CSS class `cv-motif--<motif>`. Only `cv-motif--door`,
`cv-motif--memory` and `cv-motif--default` (the scaffold's value: a quiet horizon of blocks lit
with the accent color) have rules (`src/game/styles/game.css`); any other value draws no motif.

**HUD.** `hud.hide` entries are passed to `ui.setHudVisible(element, false)` when the civilization
loads. The built-in elements are `crosshair`, `prompt`, `objectives` (the objective tracker and the
on-screen objective markers, section 6.3), `notifications`, `inventory`, `abilities`, `location`
(`HudElement` in `src/engine/core/sim/api.ts`). Values are not validated.
Civilization-specific HUD elements are code (`defineHud`, section 4). Door and Memory hide nothing.

---

## 4. pack.ts and code modules

`civilizations/door/pack.ts`, verbatim:

```ts
import { definePack } from '@sdk';

/**
 * Door Civilization — « La Porte qui n’existe pas ».
 *
 * mechanics/  règles du monde (registre des accès, serrures, empreinte, mémoire des portes, soupçon)
 * assets/     blocs, modèles, sons et musiques de Verrou
 * ui/         plaque de seuil (HUD), mini-jeu des trois cadrans, carte des permissions
 * view/       effets de rendu propres à Verrou (engrenages animés)
 * content/    scènes, dialogues, quêtes, cinématiques et règles (éditables dans le Studio)
 */
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
```

Rules:

- `pack.ts` must `export default definePack({ modules, migrations? })`; otherwise loading fails
  with `civilizations/<id>/pack.ts doit exporter definePack(...) par défaut.`
- `collectDefinitions` (`src/engine/core/packs/definitions.ts`) walks every export of every module
  in `modules`. An export is collected when it is an object with a string `__kind` and a string
  `id` (what every `define*` helper returns), or an array of such objects
  (`export const doorBlocks = [b({...}), ...]`). Other exports are ignored. Adding a file in a
  globbed folder is therefore enough to register its definitions.
- Only files matched by the glob are discovered. The globs in use:

  | Pack | Glob |
  | --- | --- |
  | `core` | `['./mechanics/**/*.ts', './models/**/*.ts', '!./**/*.test.ts']` |
  | `door`, `memory` | `['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts']` |
  | scaffold (`tools/cli/newPack.ts`) | `['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts']` |

- `migrations` (optional): `migrations[n]` converts a saved local state at `stateVersion` `n` into
  `n + 1` (`migrateCivState` in `src/engine/core/save/saveFormat.ts`, which sets `stateVersion` to
  `n + 1` itself after each step). Neither Door nor Memory defines migrations (both are at
  `stateVersion` 1).
- When the pack loads, `checkDefinitionIds` (`src/engine/core/packs/pack.ts`) checks the ids of the
  collected definitions (section 7) and adds an error to the pack's load issues for each id that
  does not have the expected form.
- Pack code imports only the public SDK: `@sdk`, `@sdk/ui` (React HUD and panels), `@sdk/view`
  (Babylon.js). ESLint (`eslint.config.js`) forbids `@engine/*`, `@studio/*`, `@game/*` and
  relative imports into `src/` (`../../src/*`, `../../../src/*`) for `civilizations/**`, except
  seeds and `*.test.ts` files.

### Definition kinds

"Session-wide" definitions are registered by `GameSession.registerPack` for the civilization and
for each of its dependencies. "Active civilization only" definitions are read from the
civilization's own pack when it starts (`GameSession.loadCivilization`): the mechanics, HUDs,
panels and abilities of a dependency never run.

| Kind | Helper | Import | Scope | Example ids |
| --- | --- | --- | --- | --- |
| mechanic | `defineMechanic` | `@sdk` | active civilization only | `door.access`, `door.keyImprint`, `memory.chamber`, `memory.echoes`, `memory.offering` |
| behavior (entity component) | `defineBehavior` | `@sdk` | session-wide | `door.lock`, `door.memory`, `memory.recognition`, `memory.echoPoint` |
| action | `defineAction` | `@sdk` | session-wide | `door.setRank`, `memory.restore` |
| condition | `defineCondition` | `@sdk` | session-wide | `door.rankAtLeast`, `memory.consented` |
| event (documentation) | `defineEvent` | `@sdk` | session-wide | `door.rankChanged`, `memory.examined` |
| item | `defineItem` | `@sdk` | session-wide | none in code: both packs use `content/items.json` |
| ability | `defineAbility` | `@sdk` | active civilization only | none in Door or Memory |
| block | `defineBlock` | `@sdk` | session-wide | `door:damp_stone`, `memory:black_stone` |
| model | `defineModel` | `@sdk` | session-wide | `door:door_handleless`, `memory:shard_amber` |
| sound | `defineSound` | `@sdk` | session-wide | `door:rank_up`, `memory:echo` |
| music | `defineMusic` | `@sdk` | session-wide | `door:music.faubourg`, `memory:music.reminence` |
| HUD element | `defineHud` | `@sdk/ui` | active civilization only | `door.rankPlaque` (slot `top-left`), `memory.chamberHud` |
| panel | `definePanel` | `@sdk/ui` | active civilization only | `door.imprint`, `memory.chamber` |
| visual | `defineVisual` | `@sdk/view` | session-wide, keyed by component type | `door.spinnerVisual` (component `door.spinner`) |
| view effect | `defineViewEffect` | `@sdk/view` | session-wide, keyed by channel | `memory.echoEffect` (channel `memory.echo`) |

HUD slots: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`,
`center`, `overlay` (`HudSlot` in `src/engine/core/sim/api.ts`).

Duplicate ids: for blocks, models, items, actions, conditions and events a second registration
under another owner throws (`... est déjà défini par "<pack>"`, or `... est déjà enregistré(e) par
"<pack>"` for actions, conditions and events); `registerPack` logs the error and skips the
definition. A duplicate behavior id is logged as an error and ignored. Sounds, music, visuals and
view effects are stored in maps: the last registration replaces the previous one without a
message.

How to write mechanics, behaviors, actions, conditions, HUDs and panels is covered by
[HOW_TO_ADD_A_NEW_MECHANIC.md](../HOW_TO_ADD_A_NEW_MECHANIC.md).

---

## 5. Assets defined in code

The pack format has no image or audio files. Block textures are procedural generator recipes,
models are built from micro-voxels in code, and sounds and music are synthesis recipes
(`src/engine/core/audio/recipes.ts`: "The project ships no recorded audio").

### 5.1 Blocks — `defineBlock(def: BlockDef)`

`BlockDef` (`src/engine/core/voxel/blocks.ts`):

| Field | Meaning |
| --- | --- |
| `id` | `<pack>:<name>`, checked against `ASSET_ID_RE` at registration (refused otherwise); a prefix other than the pack's own id is reported when the pack loads (section 7) |
| `label`, `category` | French texts shown in the Studio block palette (`category` defaults to `Divers`) |
| `shape` | `cube` (default), `slab` or `cross` |
| `solid` | collides with characters (default: true except for `cross`) |
| `opaque` | hides neighbor faces and blocks light (default: cube without transparency) |
| `transparency` | `cutout` or `blend` |
| `emissive` | full-bright faces |
| `light` | `{ level: 0..15, color }` block light emission |
| `textures` | `{ all }` or `{ top, side }` (plus optional `bottom`); a block with neither `all` nor `top` + `side` is refused at registration |
| `sound` | material: `stone` (default), `wood`, `metal`, `glass`, `cloth`, `earth`, `plant`, `crystal` |

A texture is `{ gen, colors, seed?, params? }`; `gen` names a generator of
`src/engine/core/voxel/textures/generators.ts` (`stone`, `bricks`, `stoneBricks`, `planks`,
`tiles`, `roofTiles`, `plaster`, `timber`, `metal`, `frosted`, `stars`, ...). An unknown generator
renders a magenta checker. Excerpt of `civilizations/door/assets/blocks.ts`:

```ts
const b = (def: BlockDef) => defineBlock(def);
const tex = (gen: string, colors: string[], params?: Record<string, number>, seed = 0) => ({ gen, colors, params, seed });

const DAMP_STONE = tex('stone', ['#636a64', '#3e443f', '#7e867e'], { cracks: 3 });
// …
export const doorBlocks = [
  b({ id: 'door:damp_stone', label: 'Pierre humide', category: 'Verrou — Faubourg', textures: { all: DAMP_STONE } }),
  b({ id: 'door:damp_stone_slab', label: 'Dalle de pierre humide', category: 'Verrou — Faubourg', shape: 'slab', textures: { all: DAMP_STONE } }),
  // …
  b({
    id: 'door:dark_water',
    label: 'Eau stagnante',
    category: 'Verrou — Faubourg',
    solid: false,
    transparency: 'blend',
    textures: { all: tex('frosted', ['#1f3d40', '#0e2224'], { alpha: 0.8, frame: 0 }) },
  }),
  // …
];
```

`core:air` and `core:missing` are registered by the engine itself (owner `engine`).

### 5.2 Models — `defineModel({ id, label, category?, build, ...ModelOptions })`

`build(b)` draws with a `ModelBuilder` (`box`, `set`, `shell`, `clear`, `cylinder`, `line`, `part`,
... in `src/engine/core/voxel/microModel.ts`). `ModelOptions`: `voxelSize` (meters, default 1/16),
`collider` (`'auto'`, `'none'` or `{ min, max }` in meters), `light` (`{ level, color, offset? }`,
baked into the voxel light field), `anchor` (`bottom-center` by default, `center`, `min`),
`pickable` (default true), `tags`. Model ids are checked like block ids. From
`civilizations/door/assets/models.ts`:

```ts
export const doorHandlelessLit = defineModel({
  id: 'door:door_handleless_lit',
  label: 'Porte sans poignée (marque éveillée)',
  category: 'Verrou — Portes',
  collider: 'none',
  light: { level: 7, color: '#ffd889', offset: [0, 1, 0.2] },
  build: (b) => handlelessDoor(b, true),
});
```

### 5.3 Sounds and music — `defineSound`, `defineMusic`

`defineSound({ id, label, category, recipe })`: `category` is `sfx`, `ui`, `ambience` or `voice`;
`recipe` is a `SoundRecipe` (`layers` of oscillators or noise with envelopes, filters, vibrato,
repeats; optional `gain`, `variation`, `spatial`, `refDistance`, `loopSeconds` for looped
ambiences). `defineMusic({ id, label, recipe })`: `recipe` is a `MusicRecipe` (`bpm`, `tracks` of
`{ instrument, notes }`, `loop`, `reverb`). Notes use the compact notation `"Note:beats"`, chords
with `+`, rests with `-`. From `civilizations/door/assets/sounds.ts` (`osc` and `noise` are local
helpers of that file):

```ts
defineSound({
  id: 'door:palm_awaken',
  label: 'La marque de la paume s’éveille',
  category: 'sfx',
  recipe: {
    layers: [
      osc('sine', 110, { freqEnd: 220, attack: 0.4, duration: 2.2, release: 1, gain: 0.18 }),
      osc('triangle', 880, { attack: 0.02, delay: 0.5, duration: 1.6, release: 1.2, gain: 0.07, vibrato: { rate: 5, depth: 6 } }),
      osc('triangle', 1318.5, { attack: 0.02, delay: 0.75, duration: 1.4, release: 1.2, gain: 0.05 }),
      noise('pink', { filter: { type: 'bandpass', freq: 2400, freqEnd: 600, q: 3 }, attack: 0.3, duration: 1.8, gain: 0.08 }),
    ],
  },
}),
// …
defineMusic({
  id: 'door:music.faubourg',
  label: 'Verrou — Le Faubourg Bas',
  recipe: {
    bpm: 66,
    reverb: 0.5,
    loop: true,
    tracks: [
      { instrument: PAD, notes: 'E3+B3+G4:8 C3+G3+E4:8 A2+E3+C4:8 B2+F#3+D#4:8' },
      { instrument: BELL, notes: '-:4 B4:1 G4:1 E4:2 -:4 C5:1 B4:1 G4:2 -:4 A4:1 G4:1 E4:2 -:2 F#4:2 D#4:4' },
      { instrument: BASS, notes: 'E2:4 E2:4 C2:4 C2:4 A1:4 A1:4 B1:4 B1:4' },
    ],
  },
}),
```

Shared assets come from `core`: blocks in `civilizations/core/mechanics/blocks.ts`, sounds and the
menu music (`core:music.menu`) in `civilizations/core/mechanics/sounds.ts`, models in
`civilizations/core/models/*.ts`, character appearances (`core:citizen_a` ... `core:guard`) in
`civilizations/core/content/characters.json`.

---

## 6. Content documents

### 6.0 Rules common to all documents

- Every document carries `format` (`civverse.scene`, `civverse.dialogue`, `civverse.quest`,
  `civverse.cinematic`, `civverse.logic`, `civverse.prefab`, `civverse.items`,
  `civverse.characters`, `civverse.rules`) and `version`, which must be `1` (Zod literal).
- Scene, dialogue, quest, cinematic, logic and prefab documents have an `id` that must equal the
  file name without its suffix. A mismatch is a warning for parsed documents
  (`L’identifiant "<id>" ne correspond pas au nom du fichier.`); scene files are not checked.
- Local ids (documents, entities, nodes, choices, stages, objectives, rules, fragments) match
  `^[A-Za-z0-9_-]+$`.
- Player-visible strings are localization keys, never French text (section 8).
- The Studio and the seed CLI write documents as `JSON.stringify(doc, null, 2)` plus a final newline.
- **Logic data**, embedded in every document type:
  - condition: `{ "type": "<condition id>", ...props }` (`core.var`, `core.all`, `door.rankAtLeast`...);
  - action: `{ "type": "<action id>", "note"?: "<designer note>", ...props }` (the Studio shows and
    edits `note` in its action blocks as « Note »; the interpreter ignores it);
  - event matcher: `{ "event": "<event name>", "where"?: { "<payload path>": <value> } }`; every
    `where` entry must be deep-equal to the payload value; `"*"` matches any event;
  - string props may reference the scope: `"$self"`, `"$player"`, `"$event.<field>"`
    (`resolveRef` in `src/engine/core/logic/interpreter.ts`);
  - action lists run sequentially; a failing action logs an error and stops the rest of its list.

The built-in `core.*` actions, conditions and events are in `src/engine/core/logic/coreActions.ts`,
`coreConditions.ts` and `coreEvents.ts`; their props are shown and edited by the Studio.

### 6.1 Scenes — `content/scenes/<id>.scene.json`

| Field | Meaning |
| --- | --- |
| `id`, `name` | local id; `name` is the localization key of the place name (`door.scene.verrou`) |
| `environment` | sky, lights, fog, particles, music, post-processing (below) |
| `voxels` | the block grid (below) |
| `entities` | array of entity documents (below) |
| `editor` | optional `{ camera?: { position, target }, notes?: string }`, Studio-only |

**Environment** (`EnvironmentSchema`, defaults in parentheses): `sky { top, horizon, bottom,
stars (0) 0..1, sunDisc (true), discColor? }`, `sun { direction, color, intensity }`,
`ambient { color, intensity }`, `hemi { sky, ground, intensity }`, `fog { color, density }`,
`blockLight` (1), `particles` (`null` or `{ preset, density }`), `music` (music id or `null`),
`ambience` (sound id or `null`), `post { exposure (1), contrast (1.05), saturation (1),
bloom (0.35), vignette (0.35) }`. Particle presets handled by `src/engine/view/particles.ts`:
`dust`, `embers`, `motes`, `smoke`, `sparks`, `memory`, `stars`, `rain` (streaks falling from the
top of the box). The `porte_absente` environment
(Door) is a starry void:

```json
"environment": {
  "sky": { "top": "#05040a", "horizon": "#120c22", "bottom": "#020205", "stars": 1, "sunDisc": false },
  "sun": { "direction": [0.2, -1, 0.3], "color": "#6e64a8", "intensity": 0.25 },
  "ambient": { "color": "#5a5480", "intensity": 0.3 },
  "hemi": { "sky": "#6d68a0", "ground": "#1d1a26", "intensity": 0.35 },
  "fog": { "color": "#0d0a18", "density": 0.03 },
  "blockLight": 1.35,
  "particles": { "preset": "dust", "density": 0.25 },
  "music": "door:music.absente",
  "ambience": "core:low_drone",
  "post": { "exposure": 1, "contrast": 1.12, "saturation": 0.9, "bloom": 0.65, "vignette": 0.55 }
}
```

**Voxels** (`VoxelDataSchema`, `src/engine/core/world/sceneVoxels.ts`,
`src/engine/core/voxel/codec.ts`):

| Field | Meaning |
| --- | --- |
| `size` | `[sizeX, sizeY, sizeZ]`, integers 1..1024; one cell is one meter |
| `palette` | block ids; index 0 is `core:air` (`volumeFromDoc` prepends it when missing) |
| `encoding` | `"rle16-b64"` (the only accepted value) |
| `data` | base64 of a sequence of `(run length, palette index)` pairs, each an unsigned LEB128 varint |

Cells are ordered Y-major: `index = x + sizeX * (z + sizeZ * y)` (`VoxelVolume.index`), so the data
runs layer by layer from the ground up. The runs must cover exactly `sizeX * sizeY * sizeZ` cells
and every index must exist in the palette, otherwise loading throws. `volumeToDoc` compacts the
palette (drops unused ids) before encoding. Cell `(x, y, z)` occupies `[x, x+1] × [y, y+1] ×
[z, z+1]` in scene coordinates (+X east, +Z north, +Y up in the Door and Memory layouts). The
header of Memory's `chambre_blanche` scene:

```json
"voxels": {
  "size": [32, 24, 32],
  "palette": ["core:air", "memory:white", "memory:white_glow"],
  "encoding": "rle16-b64",
  "data": "zQoBBQIZAQICBQECAhYBAgIHAQICFQEBAgkBAQIUAQECCwEB…"
}
```

Decoded, the data starts with the runs `(1357 × index 1)`, `(5 × index 2)`, `(25 × index 1)`...:
the first 1357 cells (all of layer `y = 0`, 32 × 32 = 1024 cells, and the start of `y = 1`) are
`memory:white`. Scene sizes in the repository: `verrou` 96 × 64 × 120, `porte_absente`
40 × 34 × 64, `reminence` 96 × 40 × 96, `chambre_blanche` 32 × 24 × 32. Runtime block changes
(`core.setBlocks`, `ctx.world.setBlock`) are stored in saves as diffs; the scene file is not
modified.

**Entities** (`EntityDocSchema`):

| Field | Meaning |
| --- | --- |
| `id` | local id, unique in the scene; referenced by logic, dialogues, quests, cinematics |
| `name` | optional editor label (not shown to players) |
| `position` | `[x, y, z]` in meters; `y` is the height of the feet (the walking surface) |
| `rotation` | optional, degrees; Door and Memory only use `[0, yaw, 0]` |
| `scale`, `tags` | optional |
| `folder` | optional Studio hierarchy folder (`"Faubourg Bas"`) |
| `components` | `{ "<component type>": { ...props } }` |
| `editor` | optional `{ locked?, hidden? }`, Studio-only |

Component types are behaviors. The engine registers `core.spawn`, `core.marker`, `core.model`,
`core.collider`, `core.light`, `core.sound`, `core.particles`, `core.sign`, `core.door`,
`core.portal`, `core.npc`, `core.interactable`, `core.pickup`, `core.readable`, `core.trigger`,
`core.zone`, `core.conditional`, `core.ladder` (`ENGINE_BEHAVIORS` in `src/engine/core/sim/builtins.ts`; props in
`src/engine/core/behaviors/*.ts`). Packs add their own. Props absent from the JSON take their
declared defaults. Two Door entities (whitespace condensed):

```json
{ "id": "cell_door", "position": [11.5, 8, 27.5],
  "components": {
    "core.door": { "model": "door:door_handleless", "name": "door.door.cell", "openSound": "core:door_open" },
    "door.lock": { "variant": "palm" },
    "door.memory": { "descriptions": ["door.memory.cell.1", "door.memory.cell.2", "door.memory.cell.3"] } },
  "rotation": [0, 90, 0], "folder": "Faubourg Bas" }

{ "id": "trig_cell_exit", "position": [13.5, 8, 27.5],
  "components": { "core.trigger": { "size": [3, 3, 3], "once": true, "onEnter": [
    { "type": "core.completeObjective", "quest": "DOOR_Q00_REVEIL", "objective": "sortir" },
    { "type": "core.say", "entity": "noe", "text": "door.bark.noe.hey", "seconds": 3 },
    { "type": "core.lookAt", "entity": "noe", "target": "player" } ] } },
  "folder": "Faubourg Bas" }
```

A Memory NPC whose reactions come from a Memory component (`memory.recognition`):

```json
{ "id": "lea", "position": [61.5, 6, 6.5],
  "components": {
    "core.npc": { "character": "memory:lea", "name": "memory.npc.lea", "dialogue": "lea", "lookDistance": 5 },
    "memory.recognition": { "levels": [
      { "when": { "type": "core.var", "var": "memory.restorationOutcome", "op": "exists" }, "level": "lie", "barks": [] },
      { "when": { "type": "core.var", "var": "memory.metLea", "op": "==", "value": true }, "level": "reconnu", "barks": ["memory.bark.lea.1"] },
      { "when": { "type": "core.always" }, "level": "inconnu", "barks": [] } ] } },
  "folder": "Salle de Vente" }
```

### 6.2 Dialogues — `content/dialogues/<id>.dialogue.json`

| Field | Meaning |
| --- | --- |
| `id`, `title?` | `title` is an editor label (raw text allowed) |
| `speakers?` | `{ "<key>": { name: <loc key>, entity?: <entity id> } }` for speakers that are not scene entities |
| `start` | id of the first node |
| `nodes` | at least one node |

Node: `id`, `speaker?` (an entity id of the pack's scenes, `player`, `narrator`, or a key of
`speakers`), `text` (localization key; empty = routing node), `expression?`, `animation?`,
`actions?` (run when the node is entered), `choices?`, `next?`, `branches?` (`[{ condition, next }]`,
first true wins), `end?`, `editor?` (`{ x, y }` graph position). Choice: `id`, `text` (key),
`next?` (`null` ends the dialogue; absent = the node's routing), `condition?`, `actions?`, `once?`
(hidden after being chosen), `showDisabled?` (show greyed out instead of hiding). Routing:
`end` stops; otherwise `branches` in order, then `next` (`DialogueSystem.resolveNext` in
`src/engine/core/story/dialogue.ts`). A dialogue starts from a `core.npc` (`dialogue` prop) or a
`core.startDialogue` action. A node of `civilizations/door/content/dialogues/noe.dialogue.json`:

```json
{
  "id": "intro4",
  "speaker": "noe",
  "text": "door.dlg.noe.intro4",
  "animation": "interact",
  "actions": [
    { "type": "core.giveItem", "item": "door:plaque_r0", "count": 1 },
    { "type": "door.setRank", "rank": 0 },
    { "type": "core.setVar", "var": "door.metNoe", "value": true },
    { "type": "core.setVar", "var": "door.hasPlaque", "value": true },
    { "type": "core.setPlayerTitle", "title": "door.title.stranger" }
  ],
  "choices": [
    { "id": "why", "text": "door.dlg.noe.intro4.why", "next": "intro5a" },
    { "id": "mark", "text": "door.dlg.noe.intro4.mark", "next": "intro5b",
      "condition": { "type": "core.var", "var": "door.palmRevealed", "op": "==", "value": true } },
    { "id": "thanks", "text": "door.dlg.noe.intro4.thanks", "next": "intro6" }
  ]
}
```

Memory's `civilizations/memory/content/dialogues/file.dialogue.json` uses the `speakers` map for an
unnamed seller: `"speakers": { "vendeur": { "name": "memory.speaker.vendeur" } }`.

### 6.3 Quests — `content/quests/<id>.quest.json`

| Field | Meaning |
| --- | --- |
| `id`, `title`, `summary` | `title` and `summary` are keys |
| `kind` | `main` (default) or `side` |
| `order` | sort order in the journal (default 0) |
| `autoStart`, `startWhen?`, `startOn?` | the quest starts by itself, when a condition holds, or on an event; otherwise `core.startQuest` |
| `stages` | at least one stage |
| `onStart?`, `onComplete?`, `failWhen?`, `onFail?` | actions and fail condition |

Stage: `id`, `description` (key, added to the journal history), `objectives`, `completion` (`all`
by default, or `any`), `onComplete?`, `next?` (absent = next stage in the array; `null` = the quest
completes after this stage). Objective: `id`, `text` (key), `optional?`, `hidden?`, `completeWhen?`
(condition re-evaluated on every event), `completeOn?` (event matcher), `progress?`
(`{ var, count }`, shows `value/count`), `target?` (entity id: while the quest is the one the
objective tracker shows, the tracked active quest or else the first active one, the game draws a
marker with the distance above that entity until the objective is done; setting « Afficher les
repères d’objectif », `src/game/hud/Markers.tsx`), `targetScene?` (scene of the target: the marker
is drawn only in that scene; absent = whatever scene is current). An objective with neither
`completeWhen` nor `completeOn` must be
completed by a `core.completeObjective` action. A stage with no required objective completes when
any of its objectives is done (`QuestSystem.stageComplete`). Door's first stage
(`DOOR_Q00_REVEIL.quest.json`):

```json
{
  "id": "cellule",
  "description": "door.quest.DOOR_Q00_REVEIL.cellule",
  "objectives": [
    { "id": "sortir", "text": "door.quest.DOOR_Q00_REVEIL.cellule.sortir", "target": "cell_door" },
    { "id": "plaque", "text": "door.quest.DOOR_Q00_REVEIL.cellule.plaque", "optional": true,
      "completeWhen": { "type": "core.var", "var": "door.readCellPlaque", "op": "==", "value": true },
      "target": "cell_plaque" }
  ],
  "completion": "all"
}
```

(`sortir` is completed by the `trig_cell_exit` trigger shown in 6.1.) Two objectives of Memory's
`MEM_Q01_MELODIE.quest.json`:

```json
{ "id": "objets", "text": "memory.quest.MEM_Q01_MELODIE.jardin.objets",
  "completeWhen": { "type": "core.var", "var": "memory.objectsFound", "op": ">=", "value": 3 },
  "progress": { "var": "memory.objectsFound", "count": 3 } }

{ "id": "examiner", "text": "memory.quest.MEM_Q01_MELODIE.eclat.examiner",
  "completeOn": { "event": "memory.examined", "where": { "shardId": "jardin" } } }
```

### 6.4 Cinematics — `content/cinematics/<id>.cinematic.json`

Top level: `id`, `title?` (editor label), `duration` (seconds, ≥ 0.1), `skippable` (true),
`letterbox` (true), `lockPlayer` (true; `false` lets the player move and look around while it
plays), `hideHud` (true), `returnCamera` (`blend` or `cut`, default `blend`), `tracks`,
`onComplete?`. Keys and items do not have to be in time order: the tracks are sorted by `t` when the
cinematic plays (`sortedTracks`). A camera key without `fov` keeps the field of view of the keys
before it (70° when none sets one). Track types (`CinematicTrackSchema`):

| `type` | Items |
| --- | --- |
| `camera` | `keys: [{ t, position, target?, lookAt? (entity id or "player"), fov? 10..120, roll?, ease?, cut? }]`; easing names: `linear`, `inSine`, `outSine`, `inOutSine` (default), `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `outBack`, `step` |
| `subtitle` | `items: [{ t, duration ≥ 0.1, speaker?, text }]`; `speaker` is an entity id, `player`, `narrator` or a localization key |
| `actor` | `entity` (or `"player"`) and `keys: [{ t, moveTo?, speed?, teleport?, yaw?, lookAt?, animation?, expression?, visible?, say? }]` |
| `audio` | `items: [{ t, sound?, music? (null = silence), at? (position or entity id), volume? }]` |
| `fx` | `items: [{ t, fx, ...params }]`; the game handles `fade` (`from`, `to`, `seconds`, `color`), `flash`, `tint` (`src/game/state/uiStore.ts`) and `shake`, `fov`, `vignette` (`src/engine/view/gameView.ts`) |
| `actions` | `items: [{ t, actions, essential? }]` |

Skipping (`src/engine/core/story/cinematics.ts`): the remaining `actions` items run in order
(except items marked `essential: false`, and except actions whose definition has
`essential: false`, such as `core.wait`, `core.playSound` or `core.say`), actors jump to their final
keys, the last music cue is applied, then `onComplete` runs. Story state therefore belongs in
`onComplete` or in essential action items. Door's epilogue cinematic ends the civilization:

```json
"onComplete": [
  { "type": "core.showEndScreen", "title": "door.end.title", "subtitle": "door.end.subtitle", "lines": ["door.end.line1", "door.end.line2"] },
  { "type": "core.setVar", "var": "door.finished", "value": true },
  { "type": "core.finishCivilization" }
]
```

### 6.5 Logic rules — `content/logic/<id>.logic.json`

`{ format, version, id, title?, rules }`. Rule (`RuleSchema`): `id`, `name?`, `enabled` (true),
`once` (false), `scene?` (rule active only in that scene), `when` (event matcher), `if?`,
`then`, `else?`. Semantics (`src/engine/core/logic/rules.ts`): every enabled rule whose `when`
matches is evaluated, in the order of the logic files (sorted by id) then of the rules; a `once`
rule is recorded as fired (`<logic id>/<rule id>`, saved with the game) only when its `if` passed.
Door's opening rule (`civilizations/door/content/logic/main.logic.json`):

```json
{
  "id": "intro",
  "enabled": true,
  "once": true,
  "when": { "event": "civ.started" },
  "then": [{ "type": "core.playCinematic", "cinematic": "C01_eveil", "wait": false }],
  "name": "Éveil : cinématique d’ouverture"
}
```

Both civilizations keep one `main` file plus one file for their second scene
(`absente.logic.json` and `blanche.logic.json`, whose rules set `"scene"`).

### 6.6 Items — `content/items.json`

`{ "format": "civverse.items", "version": 1, "items": [...] }`. Item: `id`, `name`, `description`
(keys), `icon { shape, color, accent?, glow? }`, `category` (`key`, `quest`, `document`, `tool`,
`consumable`, `equipment`, `collectible`, `misc`), `stackable?`, `maxStack?`, `questItem?`,
`tags?`, `slot?` (worn there), `grants?` (abilities while worn), `held?` (holdable: model,
placement, draw time and the uses of the two mouse buttons, see
[COMBAT_AND_EQUIPMENT.md](COMBAT_AND_EQUIPMENT.md)), `actions? [{ id, label (key), condition?,
actions }]`. Icon shapes
(`ICON_SHAPES` in `src/engine/core/inventory/items.ts`): `key`, `document`, `scroll`, `letter`,
`plaque`, `shard`, `gem`, `coin`, `gear`, `flask`, `book`, `fragment`, `box`, `ring`, `eye`,
`hand`, `note`, `bell`, `cup`, `kite`, `dial`, `ingot`, `spring`, `feather`, `star`, `circle`.
Items of `items.json` are added to those created with `defineItem`. From Door:

```json
{
  "id": "door:ordre_transfert",
  "name": "door.item.ordre_transfert",
  "description": "door.item.ordre_transfert.desc",
  "icon": { "shape": "document", "color": "#e8dfc8", "accent": "#9a2f25" },
  "category": "document",
  "questItem": true,
  "actions": [
    { "id": "lire", "label": "door.item.read",
      "actions": [{ "type": "core.showDocument", "title": "door.doc.order.title", "pages": ["door.doc.order.1", "door.doc.order.2", "door.doc.order.3"], "style": "register" }] }
  ]
}
```

### 6.7 Characters — `content/characters.json`

`{ "format": "civverse.characters", "version": 1, "characters": [...] }`, referenced by
`core.npc.character`. Character (`CharacterSchema`): `id`, `name` (key), `build { body: adult
(default), slim, broad, child, elder; height 0.6..1.3 }`, `skin`, `eyes` (hex), `hair { style:
short, long, bun, ponytail, curly, bald, braids, mohawk, swept, bob; color }`, `face { brows?,
beard?, mustache?, freckles?, blush?, scar?, wrinkles? }`, `outfit { style: tunic, coat, robe,
dress, vest, uniform, rags, shirt; top, bottom, shoes, accent, trim? }`, `accessories [{ type,
color, accent?, pattern? }]` (types: `hat`, `cap`, `hood`, `goggles`, `glasses`, `scarf`, `satchel`, `cape`,
`plaque`, `apron`, `badge`, `gloves`, `pendant`, `helmet`, `epaulettes`, `belt`, `bandana`,
`flower`, `veil`, `keyring`, `mask` (whole face), `halfmask` (eyes and nose); `pattern` paints a
mask: `plain`, `ember`, `threads`, `rivets`, `lens`, `ornate`, `mirror` (no eye holes), `split`),
`idle` (`calm` default, `nervous`, `proud`, `tired`, `playful`),
`voicePitch` (0.5..2, default 1; stored but not used: dialogues have no voice, only subtitles).
Appearances are looked up in the civilization first, then in every loaded pack
(`GameSession.characterDoc`), so `core:citizen_a` is usable everywhere. The renderer draws a
`plaque` below a `pendant` and in front of an `apron`; each of Door's 12 characters wears one,
colored by rank. From Door:

```json
{
  "id": "door:mira",
  "name": "door.npc.mira",
  "build": { "body": "slim", "height": 0.98 },
  "skin": "#e0b08f",
  "eyes": "#4a6a3a",
  "hair": { "style": "ponytail", "color": "#7a3b22" },
  "face": { "freckles": true, "brows": "#5a2a18" },
  "outfit": { "style": "vest", "top": "#4f6b6a", "bottom": "#3b3128", "shoes": "#2a211a", "accent": "#c49c46", "trim": "#b8733f" },
  "accessories": [
    { "type": "goggles", "color": "#8a6a3a", "accent": "#9fd0e8" },
    { "type": "apron", "color": "#6b4a2e" },
    { "type": "keyring", "color": "#c49c46" },
    { "type": "gloves", "color": "#5a3d27" },
    { "type": "plaque", "color": "#c9a54e", "accent": "#f1d78a" }
  ],
  "idle": "playful",
  "voicePitch": 1.1
}
```

### 6.8 Mechanic settings — `content/rules.json`

`{ "format": "civverse.rules", "version": 1, "settings": { "<mechanic id>": { ... } } }`. When the
civilization starts, each mechanic that declares `settings` receives
`normalizeProps(mechanic.settings, rules.settings[mechanic.id])`: missing values take their
defaults, problems are logged as warnings under the `règles` logger. Keys for mechanics that do
not exist are ignored. `validateCivilization` checks the declared fields like component props
(text keys, references, nested conditions and actions; section 12.2). The file is optional
(default: empty `settings`). The Studio edits it in « Règles des mécaniques ». Door's file is small:

```json
{
  "format": "civverse.rules",
  "version": 1,
  "settings": {
    "door.keyImprint": { "dial1": 2, "dial2": 0, "dial3": 4 },
    "door.access": { "permissionsKey": "KeyR" }
  }
}
```

Memory's file holds most of its gameplay data: the shards of `memory.chamber` (owner, sensory
texts, model, echo, flags), the echoes of `memory.echoes` (lines, tint, ghost paths, remembered
objects) and the puzzle of `memory.offering`
(`"pedestals": ["socle_1", "socle_2", "socle_3"]`,
`"solution": ["memory:cerf_volant", "memory:tasse", "memory:clochette"]`, `"reward": "jardin"`).

### 6.9 Prefabs — `content/prefabs/<id>.prefab.json`

`{ format: "civverse.prefab", version: 1, id, label, category ("Divers"), voxels?, entities ([]) }`
with entity positions relative to the prefab's minimum corner. Prefabs are only used by the Studio
(viewport « Préfabriqués »: created from a region of up to 64 blocks per axis, pasted in front of
the camera); the game parses them with the pack (`LoadedPack.prefabs`) but does not use them.

### 6.10 String table — `locales/fr-FR.json`

A flat JSON object of `"key": "French text"` (`LocaleSchema`). See section 8.

---

## 7. Identifiers and naming conventions

| What | Pattern | Enforced by | Examples |
| --- | --- | --- | --- |
| Pack id | `^[a-z][a-z0-9-]*$` (`PACK_ID_RE`), not `engine`, `global` or `ui` | manifest schema (which also refuses the three reserved ids), `new-pack` CLI, dev API | `door`, `memory` |
| Blocks, models | `<pack>:<name>`, `^[a-z][a-z0-9-]*:[a-z0-9_./-]+$` (`ASSET_ID_RE`) | `BlockRegistry.register`, `ModelRegistry.register` (shape: a malformed id is refused); `checkDefinitionIds` when the pack loads (shape and prefix equal to the pack's id) | `door:damp_stone`, `memory:shard_amber` |
| Sounds, music, items, characters | `<pack>:<name>` | `checkDefinitionIds` for sounds, music and items defined with `defineItem`; convention only for `content/items.json` and characters | `door:rank_up`, `door:music.faubourg`, `door:plaque_r0`, `memory:lea` |
| Mechanics, components, actions, conditions, events, abilities, HUDs, panels, visuals, view effects | `<pack>.<name>` (`TYPE_ID_RE`) | `checkDefinitionIds` when the pack loads (shape and prefix equal to the pack's id) | `door.lock`, `door.setRank`, `memory.chamber`, `memory.echoEffect` |
| Story variables | `<civ id>.<name>` | runtime (`ctx.vars.set` / `declare` throw outside the namespace) and validation | `door.rank`, `memory.leaConsent` |
| Global (multiverse) values | `global.<path>`, read-only | `VariableStore.set` throws; validation reports writes | `global.fragments.threshold` |
| Local ids | `^[A-Za-z0-9_-]+$` (`LOCAL_ID_RE`) | schemas | `spawn_cell`, `DOOR_Q00_REVEIL`, `C01_eveil` |
| Fragment ids | local id, shared by all packs | not checked for uniqueness | `threshold`, `remanence` |
| Global flags | `<pack>.<name>` | convention, plus the `globalWrites` pattern | `door.finalChoice` |
| UI store keys, input action ids | `<pack>.<name>` | convention | `door.rankFlash`, `door.permissions`, `memory.chamber` |
| Localization keys | `<pack>.<area>.<...>` | convention (section 8) | `door.dlg.noe.intro1` |

`checkDefinitionIds` (`src/engine/core/packs/pack.ts`) covers the definitions exported by the
pack's code. Each id of the wrong form, or whose prefix is not the pack's own id, adds an error to
the pack's load issues (file `pack.ts`, `Identifiant « <id> » : « <pack>.<nom> » attendu.` or
`Identifiant « <id> » : « <pack>:<nom> » attendu.`), logged when the pack loads; the definition is
still registered unless its registry refuses it (malformed block and model ids). Section 12 says
where these issues are reported.

Naming used by Door and Memory (convention): quests `DOOR_Q00_REVEIL` ... `DOOR_Q04_PORTE_ABSENTE`
and `MEM_Q00_EVEIL` ... `MEM_Q04_SUJET_ZERO` (the ids of the scenario specs in `docs/narrative/`);
cinematics `C01_eveil`, `M02_premier_echo`; dialogues named after the NPC entity that owns them
(`noe`, `lea`) or the scene they belong to (`confrontation`); logic files `main` plus one per extra
scene.

Engine names that packs share a namespace with:

- Engine components, actions and conditions use `core.*` (owner `engine`), e.g. `core.door`,
  `core.setVar`. The `core` library pack only provides `core:*` assets and characters.
- Engine events have no pack prefix: `civ.started`, `civ.unloading`, `civ.finished`,
  `scene.entered`, `scene.exiting`, `zone.entered`, `zone.exited`, `trigger.entered`,
  `trigger.exited`, `entity.interacted`, `interaction.blocked`, `door.opened`, `door.closed`,
  `item.acquired`, `item.removed`, `item.used`, `var.changed`, `dialogue.*`, `quest.*`,
  `cinematic.*`, `npc.arrived`, `ability.used`, `multiverse.fragmentAcquired`, `player.jumped`,
  `player.landed`, `save.completed`, `ui.panelOpened`, `ui.panelClosed` (`coreEvents.ts`).
  `door.opened` and `door.closed` belong to the engine's `core.door` component, not to the Door
  pack.
- Pack ids: `core` is taken; `engine`, `global` and `ui` are refused by the manifest schema
  (`engine` is the owner name of the engine's registrations and of its string table, `global.*`
  variables are the read-only multiverse values, `ui.*` keys are the game interface texts). Also
  avoid the event prefixes above (a duplicate event id is refused at registration).

---

## 8. Localization

- Each civilization has `locales/fr-FR.json`; its absence is an error at load time
  (`Table de traduction française obligatoire manquante.`); the engine lets library packs omit it,
  but `tests/acceptance/localization.test.ts` requires a `fr-FR.json` for every manifest. The
  engine would load other locale files (`locales/xx-YY.json`) as additional tables falling back to
  French key by key, but the same test fails on any table that is not `fr-FR.json`, and the
  settings screen (`src/game/screens/Settings.tsx`) only offers `fr-FR`.
- The engine table is `src/engine/locales/fr-FR.json` (`core.prompt.*`, `core.door.name`,
  `core.verb.use`, `ui.*` ...). Pack content may use its `core.*` keys (e.g. the default prompts of
  the built-in components).
- All loaded tables are merged into one table per locale (`Localizer.rebuild`); a later table
  overrides an identical key. Keys must therefore be globally unique: every key of `door` starts
  with `door.`, every key of `memory` with `memory.`.
- Before a pack is loaded, only its `name`, `description`, `tagline` and fragment keys are read
  (namespace `<id>#manifeste`), for the selection and registry screens.
- Message syntax (`src/engine/core/i18n/localizer.ts`): `{name}` interpolation,
  `{count, plural, one {# éclat} other {# éclats}}` (French rule: 0 and 1 are singular; `=n`
  exact matches), `{g, select, f {...} m {...} other {...}}`. A missing key renders as `⟦key⟧`,
  logs `[i18n] clé manquante` and is listed by the F3 overlay in development
  (`ui.debug.missingTexts`).
- Key layout used by Door and Memory:

  | Text | Key pattern | Example |
  | --- | --- | --- |
  | pack identity | `<id>.name`, `<id>.description`, `<id>.tagline` | `door.tagline` |
  | scene name | `<id>.scene.<scene>` | `door.scene.verrou` |
  | NPC name | `<id>.npc.<name>` | `door.npc.mira` |
  | dialogue line / choice | `<id>.dlg.<dialogue>.<node>[.<choice>]` | `door.dlg.noe.intro1.where` |
  | quest | `<id>.quest.<QUEST>.title`, `.summary`, `.<stage>`, `.<stage>.<objective>` | `memory.quest.MEM_Q01_MELODIE.chanson.silas` |
  | cinematic subtitle | `<id>.cin.<short>.<n>` | `door.cin.c01.1` |
  | item | `<id>.item.<item>`, `<id>.item.<item>.desc` | `door.item.plaque_r0.desc` |
  | fragment | `<id>.fragment.<fragment>`, `.hint` | `memory.fragment.remanence.hint` |
  | other | `<id>.notify.*`, `<id>.bark.*`, `<id>.doc.*`, `<id>.zone.*`, `<id>.sign.*`, `<id>.prompt.*`, `<id>.hud.*`, `<id>.tuto.*`, `<id>.end.*` | `door.tuto.move` |

- Keys created by the Studio are `<pack>.<suffix>` (characters outside `[A-Za-z0-9_.-]` replaced by
  `_`, made unique with `_2`, `_3`...; `Studio.newTextKey` in `src/studio/core/studio.ts`): new scene
  `<pack>.scene.<id>`, new dialogue `<pack>.dlg.<id>.debut`, new quest `<pack>.quest.<id>.title`,
  `.summary`, `.etape1`, `.etape1.objectif1`, texts of entity templates
  `<pack>.<scene>.<entity>.<prop>[.<index>]` (`Studio.addFromTemplate`).
- Code: `npm run validate` extracts literal calls `t('key')` / `ctx.t("key")` (regular expression
  in `extractCodeKeys`) from the pack's `.ts`/`.tsx` files and checks them. Keys built at runtime
  (template literals such as `` t(`door.rank.${...}`) `` in `civilizations/door/ui/RankPlaque.tsx`)
  are not checked by validation; for `ui/**/*.tsx` files the localization test only requires at
  least one key under the literal prefix.
- `tests/acceptance/localization.test.ts` checks every table of `civilizations/*/locales/` (it
  does not depend on a list of packs): every key starts with `<directory name>.`; no empty value,
  no leading, trailing or double spaces, no placeholder (`⟦`, `TODO`, `FIXME`, `TBD`,
  `lorem ipsum`); typographic apostrophes (`’`, `hasStraightElision` in
  `src/engine/core/i18n/typography.ts`); no-break spaces before `? ! ; :` and `»` and after `«`;
  none of the English words it lists. It also rejects literal visible text in
  `civilizations/*/ui/**/*.tsx` (JSX text, `title`, `placeholder`, `aria-label`, `alt`, `label`
  attributes). The Studio converts straight apostrophes between letters as authors type and in the
  texts of the keys it creates (`frenchApostrophes`, used by `Studio.setText` and
  `Studio.newTextKey`).

---

## 9. Dependencies

- `dependencies` lists pack ids. `GameSession.ensurePack` loads them recursively before the pack
  and rejects cycles (`Dépendance circulaire entre packs : ...`). An unknown id makes the
  civilization fail to start (`Pack introuvable ou invalide`).
- A dependency contributes session-wide definitions (blocks, models, sounds, music, items,
  components, actions, conditions, events, visuals, view effects), its string table and its
  character appearances.
- A dependency does not contribute mechanics, HUDs, panels or abilities (section 4), nor scenes,
  dialogues, quests, cinematics or logic: those are always read from the civilization's own pack.
  Validation accordingly resolves dialogue, quest, cinematic and scene references in the
  civilization only, and block, model, sound, music, item and character references in the session
  registries (dependencies included).
- Dependencies stay registered when the civilization unloads; only the civilization's own
  registrations are removed.
- Door and Memory both declare `["core"]` and use its blocks (`core:stone`, `core:grass`...),
  models, sounds (`core:door_open`, `core:low_drone`...) and characters.
- The Studio's playtest and validation overlay the pack and its dependencies
  (`studio.project.overlay([pack, ...deps])`).

---

## 10. Multiverse: fragments, flags and write permissions

The global state (`GlobalState` in `src/engine/core/state/multiverse.ts`) survives across
civilizations: `protagonist { awakenings, title, createdAt }`, `fragments { <id>: { civ,
acquiredAt } }`, `flags { <name>: JSON }`, `civs { <id>: { started, completed, lastPlayed,
playTime } }`. Everything else (variables, inventory, quests, dialogue history, mechanic and
entity states) is local to a civilization: it is kept in that civilization's local save state
(`LocalCivState`) and cleared from the session when the civilization unloads.

Reading (allowed to every pack):

- variables `global.fragments.<id>` (true when owned), `global.fragments` (list),
  `global.flags.<name>`, `global.civs.<civ>.<field>`, `global.protagonist.awakenings`,
  `global.protagonist.title`;
- conditions `core.hasFragment`, `core.globalFlag`, `core.civCompleted`; in code
  `ctx.multiverse.hasFragment`, `getFlag`, `isCivCompleted`.

Writing:

| Write | Action / API | Permission needed in `globalWrites` |
| --- | --- | --- |
| grant a fragment | `core.grantFragment` / `ctx.multiverse.grantFragment(id)` | `fragments.<id>` (or a matching `fragments.*` pattern) |
| set a flag | `core.setGlobalFlag` / `ctx.multiverse.setFlag(name, value)` | `flags.<name>` or a prefix pattern such as `flags.door.*` |
| mark completed | `core.markCivCompleted`, `core.finishCivilization` (also emits `civ.finished`; the game then saves and returns to the selection screen) / `ctx.multiverse.markCompleted()` | none |

`isWriteAllowed` treats a pattern ending in `*` as a prefix and anything else as an exact path. A
write without permission throws; inside an action list this logs an error and stops the remaining
actions of the list. The manifest's `fragments` list only describes fragments for the
« Registre des éveils » screen (`Registry` in `src/game/screens/Menus.tsx`, which shows the name
and hint once owned); granting is governed by `globalWrites`, not by that list.

Door grants its fragment when the player picks up the local item `door:fragment_seuil`
(`civilizations/door/content/logic/absente.logic.json`, rule `fragment`):

```json
"then": [
  { "type": "core.grantFragment", "fragment": "threshold" },
  { "type": "core.if",
    "condition": { "type": "core.var", "var": "door.finalChoice", "op": "==", "value": "ecouter" },
    "then": [{ "type": "core.setGlobalFlag", "flag": "door.finalChoice", "value": "ecouter" }],
    "else": [{ "type": "core.setGlobalFlag", "flag": "door.finalChoice", "value": "ouvrir" }] },
  { "type": "core.wait", "seconds": 1.2 },
  { "type": "core.playCinematic", "cinematic": "C04c_coupe", "wait": true }
]
```

Memory grants `remanence` the same way but writes no global flag (its scenario keeps social
states, such as the restoration outcome, local), and reads Door's completion without requiring it (`civilizations/memory/content/logic/blanche.logic.json`, rule
`vision`):

```json
{ "type": "core.if",
  "condition": { "type": "core.civCompleted", "civ": "door" },
  "then": [{ "type": "core.playCinematic", "cinematic": "M04b_vision_seuil", "wait": false }],
  "else": [{ "type": "core.playCinematic", "cinematic": "M04b_vision", "wait": false }] }
```

---

## 11. Versioning

| Field | Where | Meaning | Checked by |
| --- | --- | --- | --- |
| `format` + `version` | every JSON document | document type and schema version; all are `1` | Zod literals |
| `packVersion` | manifest | the pack's own version | regex `^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$`; copied into saves |
| `engineApi` | manifest | semver range of the engine API the pack targets | `satisfies(ENGINE_API_VERSION, engineApi)` when manifests are read; supports a single range: `^`, `~`, `>=`, `<=`, `>`, `<`, `=`, exact versions and `*` (compound ranges such as `>=1.0.0 <2.0.0` and x-ranges such as `1.x` are never satisfied) |
| `stateVersion` | manifest | version of the pack's local save state | `migrateCivState`: a save from a newer `stateVersion`, or a missing `migrations[n]`, makes loading fail |
| `state.version` + `migrate` | `defineMechanic`, `defineBehavior` | version of one mechanic's or component's saved state | `migrateVersioned`: a newer or unmigratable state is replaced by `initial()` with a warning |

`src/engine/core/version.ts` defines `ENGINE_VERSION = '0.1.0'` (stored in saves) and
`ENGINE_API_VERSION = '1.0.0'`. Its comment asks to bump the API major version on breaking changes.
Both packs declare `"engineApi": "^1.0.0"`; the scaffold writes `^<major>.0.0` from
`ENGINE_API_VERSION`. A pack whose range is not satisfied is not registered: the selection screen
shows the number of rejected packs (`ui.civs.invalidPacks`) and `npm run validate` reports
`✗ <id>/manifest.json : Le pack "<id>" requiert l’API ...` as an error.

---

## 12. Validation

### 12.1 When checks run

| Stage | Code | Checks | Failure |
| --- | --- | --- | --- |
| Manifests are read | `GameSession.refreshManifests` | `ManifestSchema`, `engineApi` | pack excluded; reported by the CLI as errors |
| Pack loads | `loadPack` (`src/engine/core/packs/pack.ts`) | ids of the code definitions (`checkDefinitionIds`, section 7); schema of every content file except scenes; id = file name (warning); `fr-FR` table for civilizations; every `manifest.scenes` entry has a file | issues attached to the pack (`session.contentIssues`) and logged by the `contenu` logger; a document that fails its schema is left out of the pack |
| Scene loads | `loadSceneDoc` | `SceneSchema`, voxel decoding | exception |
| Validation | `validateCivilization` (`src/engine/core/packs/validate.ts`) | starts the civilization headless with a fresh state, adds the pack's load issues, then checks references and texts (below) | list of errors and warnings |
| Seeding | `npm run civ -- seed` (`tools/cli/civ.ts`) | schema of generated scene, cinematic, dialogue, quest, logic and prefab files | the invalid file is not written; exit code 1 |

### 12.2 What `validateCivilization` checks

Validation first starts the civilization, which loads its pack if the session has not loaded it
yet (the case in the new sessions that `npm run validate`, the Studio's « ✔ Valider » and
`tests/acceptance/J-regression.test.ts` create). The report then starts with the load issues
(section 12.1) that the session holds for the pack: definition ids, content schemas, id = file
name, missing `fr-FR` table... If the civilization does not start (missing dependency, missing
entry scene...), validation stops there, after these issues, with the error
`La civilisation ne démarre pas : <message>`. Otherwise:

- **Manifest**: `name`, `description`, `tagline`, fragment `name`/`hint` keys exist in French;
  `entry.scene` exists; `entry.spawn` is an entity of that scene.
- **Mechanics**: a mechanic whose `setup` threw is an error
  (`La mécanique <id> a échoué à l’initialisation : <message>`); the values of
  `content/rules.json` are checked against each mechanic's `settings` schema like component props
  (text keys, nested conditions and actions, references).
- **Scenes**: `name` key; every palette block is registered (except `core:air`); environment
  `music` and `ambience` exist; every component type is registered; component prop values: text
  keys, nested conditions and actions, references.
- **Dialogues**: `start` node exists; `speakers` names and entities; node texts; node speakers
  (entity of any scene of the pack, `player`, `narrator`, `$self`, `$event`, or a `speakers` key);
  `next` and branch targets; conditions and actions; choice texts and targets. Warning: a node
  without text, `next`, branches or choices that does not set `end: true`.
- **Quests**: title, summary, stage descriptions, objective texts; `startWhen`, `failWhen` and
  objective conditions; `startOn` / `completeOn` events (warning when not documented by
  `defineEvent`); `onStart`, `onComplete`, `onFail`, stage `onComplete`; stage `next`; objective
  `target`, `targetScene`, `progress.var`. Warning: an objective with no `completeWhen`, no
  `completeOn` and no `core.completeObjective` action anywhere in the pack.
- **Cinematics**: `onComplete`; subtitle texts and speakers; actor entities, `moveTo` targets,
  `say` keys; audio sounds, music and `at` entities; action items; camera `lookAt` entities.
- **Logic**: `when.event` documented (warning), `scene` exists, `if`, `then`, `else`.
- **Items**: name, description, action labels, conditions, actions. **Characters**: name keys.
- **Code**: literal `t('...')` keys of the pack's `.ts`/`.tsx` files (outside `seed/`, `tests/`,
  `content/` and `*.test.ts`).

Reference checks by prop kind (`checkValue`): `entity` (in the same scene; an entity of another
scene of the pack is a warning), `item`, `dialogue`, `quest`, `cinematic`, `scene`, `spawn` (any
entity id of the pack), `sound` (a sound or a music), `music`, `model`, `character`, `block`,
`variable` (must start with `<civ id>.` or `global.`; writing `global.*` through `var`/`variable`
props of actions is an error), `panel`, `ability`, `event` (warning). Text props: a missing key is
`Clé de traduction manquante en français : <key>`; a value with spaces or other characters
outside `[a-zA-Z0-9_.-]` is `Texte brut au lieu d’une clé de traduction`. Dialogue and cinematic
`title` fields are editor-only and may hold raw text.

### 12.3 Running validation

- `npm run validate` validates every civilization; `npm run civ -- validate door memory` limits it
  to the given ids. The CLI loads packs through Vite's module runner so that `import.meta.glob`
  behaves as in the game.
- Output: one line per civilization (`✓ door — N scène(s), N entités, N dialogues, N quêtes,
  N cinématiques, N règles, N textes vérifiés (N ms)`), then one line per issue
  (`  erreur <file> › <path> : <message>` or `  attention ...`); then, for each library pack (all of
  them when no id is given), its load issues (the pack is loaded as a dependency, or on its own
  when no validated civilization needs it), followed by `✓ core — bibliothèque, N problème(s)`
  (`✗` when one is an error); then the totals (`N erreur(s), N avertissement(s).`). The exit code
  is 1 when there is at least one error; warnings do not fail.
- In the Studio, « ✔ Valider » runs the same `validateCivilization` on the working copies,
  unsaved edits included (`src/studio/core/validation.ts`), and lists the results in the
  « Problèmes » tab.
- `npm run check` runs `typecheck`, `lint`, `validate` and `test`.

Tests that apply to packs beyond their own `tests/` folder:

| Test | What it requires |
| --- | --- |
| `tests/acceptance/localization.test.ts` | every pack has `locales/fr-FR.json` and no other table; every table is clean French in its own namespace; no literal visible text in pack UI components (section 8) |
| `tests/acceptance/J-regression.test.ts` | no manifest issue for any pack; `core` is a library; every bundled civilization validates with zero errors and zero warnings and has only skippable cinematics; Door and Memory keep their scenario quests, cinematics and fragments and do not shrink below a recorded baseline |
| `tests/unit/corePack.test.ts` | `core` loads without content issues; its blocks use known texture generators; its models build and stay under 4 m |

### 12.4 Not checked by validation

- Props of kinds `number`, `integer`, `boolean`, `enum`, `color`, `vec3`, `json`, `string`, and
  property names not declared by the component, action or condition. At runtime a value of the
  wrong type is replaced by its default and logged as a warning; unknown properties are ignored.
- In `content/rules.json`: settings of mechanics that do not exist, fields that a `settings` schema
  does not declare, and plain values (as for props above). Prefabs are only checked against their
  schema, not their references or text keys.
- Plain-string props that name things: spawn ids of `core.portal` and `core.changeScene`, stage
  ids of `core.setQuestStage`, objective ids of `core.completeObjective`, fragment ids of
  `core.grantFragment` and `core.hasFragment`, flag names, `core.civCompleted.civ`.
- Global write permissions (`globalWrites`): a forbidden write only fails at runtime.
- Manifest `hud.hide` values, `cover.motif`, theme fonts, environment particle presets, cinematic
  `fx` names, block texture generator names.
- Localization keys used only as prop defaults in code, keys built at runtime, panel `title` keys.
- Library packs are not started: the CLI reports their manifest issues and their load issues
  (section 12.3), not their references or texts (`tests/unit/corePack.test.ts` covers `core`).
- Uniqueness of fragment ids across packs; scene file name versus scene `id`.

---

## 13. Limitations

- No image, audio or font files in packs: textures, models, sounds and music are procedural
  recipes, and only the fonts bundled by `src/game/main.tsx` are available to themes.
- A new cover motif or any change to the game's screens requires editing engine files
  (`src/game/styles/game.css`, `src/game/screens/Menus.tsx`); packs cannot style the selection
  card beyond `cover.colors`, `theme.accent` and `theme.titleFont`.
- Only the first two `cover.colors` are used; `credits` and `tags` are not displayed in the game.
- French is the only language: the settings only offer `fr-FR`, and the localization test rejects
  any other locale file, although the engine's `Localizer` supports several locales.
- Content files only accept `version: 1`, and there is no migration path for content documents
  yet: the header of `schemas.ts` says that a format change must add one (see
  [VERSIONING.md](VERSIONING.md)).
- The Studio cannot save `pack.ts`, CSS, `seed/` or `tests/` files, cannot create a pack, and its
  Explorer cannot create `items.json`, `characters.json` or `rules.json` (only scenes, dialogues,
  quests, cinematics, logic files and scripts).
- The id forms of section 7 are reported, not enforced: a definition with a wrong id is still
  registered (only malformed block and model ids are refused by their registries).
- The validation gaps listed in 12.4.
