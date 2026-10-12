# Localization

The player-facing game is French (fr-FR) only. This is a hard requirement
(`docs/narrative/MISE_A_JOUR_PROMPT_FRANCAIS.txt`): every visible text comes from a centralized
string table, French is the default and required language, other languages may come later, and
completeness must be validated. Code, identifiers and developer documentation stay in English. The
editor (Civilization Studio) is a development tool: its own interface is French but hard-coded,
see [section 10](#10-the-studio-editor).

This page describes the repository on 2026-10-12, after commit `7b2aa0a`. Counts were measured on
the JSON files.

## 1. Principles

- Content files never contain visible text. Player-visible fields hold localization keys
  (`"text": "door.dlg.noe.intro1"`). Code calls `t('key')`.
- Each namespace (the engine, each pack) has its own table `fr-FR.json`. At run time all tables are
  merged into one lookup per locale.
- A missing key renders as `⟦key⟧`, never as invented or English text.
- Validation checks that every key used by content and code exists in French. The acceptance tests
  also check the tables themselves (typography, namespaces, empty values, English leftovers).

## 2. String tables

| File | Registered as | Keys | Content |
| --- | --- | --- | --- |
| `src/engine/locales/fr-FR.json` | namespace `engine` | 159 | Game shell and engine texts: 138 `ui.*` keys (menus, settings, pause, journal, inventory, saves, debug overlay, tips) and 21 `core.*` keys (quest and item notifications, interaction prompts, player speaker « Vous ») |
| `civilizations/core/locales/fr-FR.json` | namespace `core` | 5 | Library pack name and description, names of the shared characters (`core.char.citizen`, `core.char.child`, `core.char.guard`) |
| `civilizations/door/locales/fr-FR.json` | namespace `door` | 438 | Everything shown by the Door civilization |
| `civilizations/memory/locales/fr-FR.json` | namespace `memory` | 486 | Everything shown by the Memory civilization |

1,088 keys in total. No key is defined in two files, every pack key starts with its pack id, and
every engine key starts with `ui.` or `core.`.

How tables are loaded:

- **Engine table.** `GameSession`'s constructor (`src/engine/core/sim/session.ts`) imports
  `src/engine/locales/fr-FR.json` and registers it with `i18n.addTable('engine', 'fr-FR', …)`.
  There is no engine table for any other locale.
- **Pack tables.** The pack loader (`src/engine/core/packs/pack.ts`) classifies every file matching
  `locales/<ll>-<CC>.json` as a locale table and parses it with `LocaleSchema`, a flat
  string-to-string record (`src/engine/core/content/schemas.ts`). A civilization without
  `locales/fr-FR.json` gets the error « Table de traduction française obligatoire manquante. ». The
  build bundles the tables with an `import.meta.glob` that includes `/civilizations/*/locales/*.json`
  (`src/engine/platform/globContent.ts`).
- **Registration.** When a pack loads, each of its locale tables is registered under the pack id;
  when it unloads, `removeNamespace` drops it (asserted by « isolates civilizations: switching
  unloads listeners, timers and registrations » in `src/engine/core/sim/session.test.ts`).
- **Before a pack is loaded**, `refreshManifests` registers a subset of its table (manifest `name`,
  `description`, `tagline`, fragment `name` and `hint`) under the namespace `<id>#manifeste`, so the
  civilization screen and the multiverse registry can show them.
- **Merge order.** Tables are merged per locale in registration order with `Object.assign`: on a
  duplicate key the table registered last wins, silently. The loader does not enforce key
  prefixes; `tests/acceptance/localization.test.ts` does.

## 3. The Localizer

`src/engine/core/i18n/localizer.ts`, instantiated once per session as `session.i18n`.

| Member | Behaviour |
| --- | --- |
| `DEFAULT_LOCALE` | `'fr-FR'` |
| `addTable(namespace, locale, table)` / `removeNamespace(namespace)` | Register or drop a table, rebuild the merged lookup, notify listeners |
| `t(key, params?)` | Look the key up in the current locale, then in fr-FR; format it (section 4). Unknown key: returns `⟦key⟧`, logs `console.warn('[i18n] clé manquante : <key>')` once per key, and records the key |
| `maybe(keyOrText, params?)` | Translates when the string is a known key, returns it unchanged otherwise. Used by the entity `say()` API (`src/engine/core/sim/contexts.ts`), so a bark can be passed as a key or as already translated text |
| `has(key, locale?)` / `raw(key)` | Existence check (current locale or fr-FR) / unformatted message |
| `tableOf(namespace, locale?)`, `namespaces()` | Raw access, used by the Studio |
| `setLocale(locale)`, `locale`, `onChange(listener)` | Locale switch and change notification |
| `missing()` | Keys requested but not found |
| `formatMessage(message, params, locale?)`, `pluralCategory(n, locale?)` | Exported formatting helpers |

Notes:

- The header comment says missing keys are recorded « so that tests, the debug overlay and the
  Studio can report it ». Only `localizer.test.ts` reads `missing()`; neither the F3 overlay
  (`src/game/hud/Debug.tsx`) nor the Studio displays it.
- An empty string is a valid value: `has()` returns true and `t()` returns `''`, not `⟦key⟧`. The
  validator therefore accepts empty texts; the acceptance test rejects them in the tables.
- Tests: `src/engine/core/i18n/localizer.test.ts` — « interpolates and applies French plural
  rules », « falls back to French and marks missing keys without inventing text », « removes a
  namespace cleanly ».

## 4. Message syntax

A subset of ICU MessageFormat, implemented in `formatMessage`.

| Syntax | Example from the tables | Notes |
| --- | --- | --- |
| `{name}` | `core.prompt.talk`: « Parler à {name} » | A parameter not passed stays as the literal `{name}` |
| `{n, plural, one {…} other {…}}` | `core.item.acquired`: « {count, plural, one {Obtenu : {name}} other {Obtenu : {name} ×{count}}} » | French rule: `one` when \|n\| < 2 (0 and 1 are singular), else `other`. Any other locale: `one` only for exactly 1 |
| `=N` exact case | `ui.registry.intro`: « {awakenings, plural, =0 {Vous ne vous êtes encore éveillé nulle part.} one {…} other {…}} » | Tested before the category |
| `#` | `{n, plural, one {# éclat} other {# éclats}}` (test) | Replaced by the formatted number everywhere in the chosen branch |
| `{g, select, f {…} other {…}}` | (test only; no table uses `select`) | Falls back to `other`, then to `''` |

- Numbers, in plain arguments and for `#`, go through `Intl.NumberFormat(locale)`: in fr-FR the
  thousands separator is U+202F and the decimal separator a comma.
- Branches may contain arguments and nested messages; they are formatted recursively.
- Not supported: ICU quoting (an apostrophe is a literal character, convenient for French), number
  or date skeletons (`{n, number, …}` is printed as a plain value), `selectordinal`, the CLDR
  categories `zero`, `two`, `few` and `many`. An unbalanced `{` prints the rest of the message as
  is.

## 5. How code uses keys

### Game shell (`src/game`)

- React components call `useT()` from `src/game/hooks.ts`. It subscribes to `i18n.onChange` with
  the current locale as snapshot, so a `setLocale` re-renders them. Non-React code calls
  `session.t()` (e.g. the save label built in `src/game/controller.ts`).
- Key caps (`KeyCap` in `src/game/ui/common.tsx`) are labelled by `keyLabel()`
  (`src/engine/input/inputManager.ts`): a French name from the hard-coded table `FR_KEY_NAMES`
  (« Espace », « Maj », « Échap », « Entrée », « Retour », arrows), otherwise the letter given by
  the keyboard layout map (`navigator.keyboard.getLayoutMap()`, Chromium), otherwise the code.
- Keys built at run time: `ui.settings.tab.${k}`, `ui.action.${a}`, `ui.settings.quality.${q}`,
  `ui.settings.volume.${k}`, `ui.settings.subtitles.${k}` (`src/game/screens/Settings.tsx`).

### Packs (`civilizations/<pack>/mechanics`, `ui`, `view`, `assets`)

- Mechanics and behaviours call `ctx.t(key, params)` (`CivContext.t` in
  `src/engine/core/sim/api.ts`, which delegates to `session.t`).
- Pack UI components call `useT()` from `@sdk/ui` (`src/sdk/ui.tsx`), which returns `ctx.t`. Its
  comment says it re-renders on locale change, but the hook does not subscribe to `i18n.onChange`
  itself; with a single locale this has no effect.
- Keys built at run time: `door.rank.${n}` (`mechanics/access.ts`, `ui/RankPlaque.tsx`),
  `door.dial.${symbol}` (`ui/ImprintPanel.tsx`), `memory.state.${state}` (`ui/ChamberPanel.tsx`).

### Engine systems translate content keys when they display them

| System | Translated fields |
| --- | --- |
| Behaviours (`src/engine/core/behaviors/`) | `core.npc` `name` and `talkPrompt` (default `core.prompt.talk` with `{name}`), barks; `core.door` `name` in `core.prompt.open` / `core.prompt.close`; `core.interactable` `prompt`, `detail`, `unavailableReason`; `core.pickup` prompt with the item name; `core.readable` prompt, title and pages; `core.portal` prompt and `unavailable` |
| Core actions (`src/engine/core/logic/coreActions.ts`) | `core.notify` `text`, `core.showLocation` `title` / `subtitle`, `core.showDocument` `title` / `pages`, `core.showEndScreen` `title` / `subtitle` / `lines`, `core.say` `text` |
| Dialogues (`src/engine/core/story/dialogue.ts`) | Node `text` and choice `text` when the view is built; speaker names through `session.speakerName()`: NPC name key, `core.speaker.player` for the player, or a speaker id that is itself a key (« Une voix ») |
| Quests (`src/engine/core/story/quests.ts`) | Titles, stage descriptions, objective texts; notifications `core.quest.started`, `core.quest.updated`… with `{title}` |
| Cinematics (`src/engine/core/story/cinematics.ts`) | Subtitle `text`, subtitle `speaker` (entity or key), actor `say` |
| Inventory | Item names and descriptions (`inventory.nameOf`), item action labels |

## 6. How content references keys

The fields below must hold keys. They are the fields checked by `validateCivilization`
(`src/engine/core/packs/validate.ts`).

| File | Fields |
| --- | --- |
| `manifest.json` | `name`, `description`, `tagline`, `fragments[].name`, `fragments[].hint` |
| `content/scenes/*.scene.json` | `name`; every component property declared with `prop.text` (e.g. `core.npc.name` and `barks`, `core.door.name`, `core.sign.text`, `core.zone.name` and `subtitle`, `core.readable.title` and `pages`, `door.lock.deniedText`, `door.memory.descriptions`, `memory.recollection.without` and `with`), including inside lists, objects and action lists |
| `content/dialogues/*.dialogue.json` | `nodes[].text`, `nodes[].choices[].text`, `speakers.<id>.name`, text properties of actions and conditions |
| `content/quests/*.quest.json` | `title`, `summary`, `stages[].description`, `stages[].objectives[].text`, text properties of actions |
| `content/cinematics/*.cinematic.json` | subtitle `text`, subtitle `speaker` when it is not an entity id, actor `say`, text properties of actions |
| `content/logic/*.logic.json` | text properties of the actions of each rule (e.g. `core.notify.text`) |
| `content/items.json` | `name`, `description`, `actions[].label` |
| `content/characters.json` | `name` |
| code | literal `t('key')` / `t("key")` calls |

- Dialogue and cinematic `title` fields are editor labels: they are counted but not required to be
  keys (`editorOnly`). The Studio stores them as plain labels (the title typed in its creation
  form, or the id).
- `manifest.json` `credits` and `tags` are plain French strings; the game does not display them
  (only the Studio's manifest editor does).
- `content/rules.json` (mechanic settings) is not covered by the validator. It holds texts too: the
  Memory shard texts (`memory.shard.*`) and echo texts (`memory.echo.*`), 33 key values, all
  present in the Memory table at the time of writing, but no automated test checks them.
- Keys referenced in code without a `t()` call (panel `title`, input binding `label`, e.g.
  `door.input.permissions`) are not checked either; the game does not display them today.

## 7. Validation and tests

### The validator

`validateCivilization` boots a civilization headless and calls `checkKey` on every field of
section 6 and on the code keys passed by the caller. For each non-empty value it increments
`stats.keysChecked`, then:

- if `i18n.has(key, 'fr-FR')`, the text is fine;
- else, for an editor-only field, nothing is reported;
- else, if the value contains whitespace or characters outside `[A-Za-z0-9_.-]`: error « Texte brut
  au lieu d'une clé de traduction : « … » »;
- else: error « Clé de traduction manquante en français : <key> ».

`keysChecked` counts references, not distinct keys: a key used twice is counted twice, and
editor-only titles are counted.

Code keys come from `extractCodeKeys`, a regular expression matching literal `t('…')` calls.
Keys built with template literals are not extracted.

Where it runs:

- `npm run validate` (`tools/cli/civ.ts` → `tools/cli/validateRunner.ts`) validates every
  civilization; code keys come from `civilizations/<pack>/**/*.ts(x)` except `seed/`, `tests/`,
  `content/` and test files. It prints one line per civilization ending with « N textes vérifiés ».
  The runner has a comment for engine and game-shell keys but no code: those are covered by the
  acceptance test below. `npm run check` runs it together with typecheck, lint and the test suite.
- The Studio's « Valider » (`validateInStudio` in `src/studio/core/validation.ts`, shown in the
  « Problèmes » tab of `src/studio/panels/Console.tsx`): same checks on the working copies, unsaved
  changes included; success reads « Aucun problème : … N textes vérifiés. ».
- `tests/acceptance/J-regression.test.ts` runs it inside `vitest` for `door` and `memory` and
  requires zero errors and zero warnings, and `keysChecked` at least 504 (door) and 535 (memory).

### `tests/acceptance/localization.test.ts`

« Localization — French is complete »:

- « French (fr-FR) is the table of the engine and of every pack » — every manifest has
  `locales/fr-FR.json`, and every table file is named `fr-FR.json`.
- « every key used by the game interface and the engine exists in French » — literal `t()` keys of
  `src/game`, `src/engine` and `src/sdk` (comments removed) exist in the engine or core table.
- « keys built at runtime (``t(`prefix.${x}`)``) have French entries under their prefix » — at least
  one key exists under each prefix; individual values are not checked.
- « no visible text is hard-coded in the interface components of the game and the packs » — no
  letters between JSX tags and no literal `title`, `placeholder`, `aria-label`, `alt` or `label`
  attribute in `src/game/**/*.tsx` and `civilizations/*/ui/**/*.tsx`; `CIVILIZATIONVERSE` is
  allowed.
- « <table> is clean French », one case per table — keys in the table's namespace, no empty value,
  no leading or trailing spaces, no double space, no placeholder (`⟦`, `TODO`, `FIXME`, `TBD`,
  `lorem ipsum`), no straight apostrophe between letters, no three-period ellipsis, no ordinary
  space before `? ! ; : »` or after `«`, no English word from a short list (`the`, `and`, `press`,
  `loading`, `settings`, `save`…).

`src/studio` is excluded on purpose (« The editor (src/studio) is a development tool and is not
part of the player-facing game »).

### What nothing checks

- Texts in `content/rules.json` (section 6).
- Each value of a key built at run time (only the prefix is checked).
- Which no-break space is used (U+00A0 or U+202F) and whether a required space is missing
  altogether (`Bonjour!` passes).
- Visible strings in code outside JSX text and those attributes: template literals, text next to an
  expression (section 9).
- `missing()` at run time.

## 8. Key naming conventions

Observed in the tables (all keys are prefixed by their namespace):

| Pattern | Examples | Observed |
| --- | --- | --- |
| `<pack>.dlg.<dialogue>.<node>` and `<pack>.dlg.<dialogue>.<node>.<choice>` | `door.dlg.noe.intro1`, `door.dlg.noe.intro1.from` | 132 Door / 202 Memory dialogue keys, all following the pattern; keys follow the dialogue, not the speaker (`memory.dlg.lea.key_silas` is said by Silas) |
| `<pack>.quest.<QUEST_ID>.title`, `.summary`, `.<stage>`, `.<stage>.<objective>` | `door.quest.DOOR_Q00_REVEIL.cellule.sortir` | 46 / 59 keys, all following the pattern |
| `<pack>.item.<short id>`, `<pack>.item.<short id>.desc` | `door.item.plaque_r0`, `memory.item.tasse.desc` | all 16 items; plus the action label `door.item.read` |
| `<pack>.npc.<name>`, `<pack>.speaker.<name>`, `<pack>.bark.<npc>.<n>` | `door.npc.mira`, `door.speaker.voice`, `memory.bark.silas.1` | |
| `<pack>.cin.<short cinematic id>.<n or name>` | `door.cin.c01.1`, `door.cin.mere.4`, `memory.cin.epi.final` | Short ids, not the cinematic ids (`C01_eveil` → `c01`) |
| `<pack>.doc.<document>.title`, `<pack>.doc.<document>.<n>` | `door.doc.poster.title`, `door.doc.poster.1` | Readable documents |
| `<pack>.zone.<zone>`, `.subtitle`; `<pack>.sign.<sign>`; `<pack>.scene.<scene>` | `door.zone.court.subtitle`, `memory.sign.salle`, `door.scene.absente` | Scene `porte_absente` uses `door.scene.absente` |
| `<pack>.prompt.*`, `<pack>.notify.*`, `<pack>.lock.*`, `<pack>.hud.*`, `<pack>.tuto.*`, `<pack>.end.*` | `door.notify.newLead`, `memory.hud.chamber` | Prompts, notifications, refusals, HUD, tutorial, end screen |
| `<pack>.name`, `.description`, `.tagline`, `<pack>.fragment.<id>`, `.hint` | `memory.fragment.remanence.hint` | Manifest |
| Pack-specific families | `door.rank.<n>`, `door.dial.<symbol>`, `door.memory.<door>.<n>`, `door.perms.*`, `door.imprint.*`; `memory.shard.<id>.name` / `origin` / `sense` / `fact` / `touch` / `revealed`, `memory.echo.<id>.title` / `<n>`, `memory.state.*`, `memory.panel.*`, `memory.stele.*`, `memory.vision.*` | |
| Engine table | `ui.<screen>.<item>`, `core.<system>.<item>` | `ui.settings.volume.music`, `core.quest.started` |

Keys created by the Studio (`Studio.newTextKey(suffix, text)` in `src/studio/core/studio.ts`) are
`<pack>.<suffix>`, with characters outside `[A-Za-z0-9_.-]` replaced by `_` and `_2`, `_3`… appended
when the key is taken. The suffix comes from where the field is edited:

| Edited field | Generated key |
| --- | --- |
| Dialogue node / choice | `<pack>.dlg.<dialogue>.<node>`, `….<node>.<choice>` |
| Quest title, summary, stage, objective | `<pack>.quest.<id>.title`, `.summary`, `.<stage>`, `.<stage>.<objective>` |
| Cinematic subtitle / actor line | `<pack>.cin.<cinematic id>.<time × 10>`, `<pack>.cin.<cinematic id>.<entity>` |
| Item, character | `<pack>.item.<short id>` and `.desc`, `<pack>.npc.<short id>` |
| New scene | `<pack>.scene.<id>` |
| Entity property (Inspector, templates) | `<pack>.<scene>.<entity>.<property>[.<index>]`, e.g. `door.verrou.personnage.name` (asserted by « adds an NPC with a French name key, and undoes both changes at once », `src/studio/core/studio.test.ts`) |
| Text property inside actions | the location of the action plus the action index and property name, e.g. `<pack>.logic.<doc>.<rule>.<index>.<property>` |
| Manifest | `<pack>.name`, `<pack>.tagline`, `<pack>.description` |

The hand-written Door and Memory keys follow the same scheme for dialogues, quests, items and
characters, but not for cinematics, zones and signs (semantic names instead of
`<scene>.<entity>.<property>`).

## 9. French typography

The texts follow four spacing rules and use typographic punctuation. Measured in the bytes of the
tables:

| Rule | Engine | Door | Memory |
| --- | --- | --- | --- |
| Narrow no-break space U+202F before `?` | 2 | 43 | 54 |
| U+202F before `!` | 0 | 20 | 11 |
| U+202F before `;` | 0 | 0 | 1 |
| No-break space U+00A0 before `:` | 20 | 58 | 50 |
| U+00A0 after `«` and before `»` (pairs) | 0 | 17 | 31 |
| Typographic apostrophe U+2019 | 13 | 239 | 369 |
| Ellipsis character U+2026 | 2 | 28 | 26 |

No exception: there is no ordinary space and no other character before any `? ! ; :`, no
three-period ellipsis and no straight apostrophe in the four tables. The core table has no
punctuation of this kind. Example: `memory.hud.chamber` is `"Chambre mnésique\u00a0: {n}/3"` (U+00A0 written as an escape here).

Enforcement and tooling:

- `tests/acceptance/localization.test.ts` rejects an ordinary space before `? ! ; : »` or after
  `«`, straight elision apostrophes (`hasStraightElision`) and `...` (section 7). It does not check
  which no-break space is used.
- `src/engine/core/i18n/typography.ts` exports `frenchApostrophes()`, which replaces an apostrophe
  between two letters with U+2019. The Studio applies it to every text it writes (`newTextKey`,
  `setText`, the locale editor). Nothing inserts no-break spaces: authors type U+00A0 and U+202F
  themselves. The locale editor states they are kept (« Les espaces insécables de la typographie
  française sont conservées »).
- The tests compare texts after replacing U+00A0 and U+202F with spaces (`norm` in
  `civilizations/memory/tests/memory.playthrough.test.ts` and `tests/acceptance/helpers.ts`).

Conventions not applied or not checked: the space after « n° » (`door.doc.order.title`) and the
spaces around « — » are ordinary spaces.

Typography produced by code, outside the tables:

- `src/game/hud/Cinematic.tsx` prints the subtitle speaker as `{speaker} : ` with an ordinary space
  before the colon.
- `civilizations/memory/ui/ChamberHud.tsx` (`TouchCaption`) wraps the touch text in
  `« {text} »` with ordinary spaces. All four `memory.shard.*.touch` values already contain
  guillemets, so the screen shows two pairs: « « Ne me laisse pas me vendre une deuxième fois. » ».
  The playthrough asserts the stored text, not the rendered caption.
- `src/game/screens/Settings.tsx` formats the volume sliders as `${Math.round(v * 100)} %` (ordinary
  space) and the field of view as `${v}°`.

## 10. The Studio (editor)

The Studio's interface is French and hard-coded in its components (`src/studio/**/*.tsx`): « ＋
Écrire un texte », « Copier ici », « Clé introuvable dans les textes », « Textes français — {pack} »,
« Chercher une clé ou un texte… », « Lancez « Valider » pour vérifier la civilisation… ». It has no
string table and no localization mechanism. `studio.html` declares `lang="fr"`. The labels of
components, actions, conditions, mechanics and properties shown in the Studio are French strings
written in their definitions (e.g. `label: 'Afficher une notification'` in `coreActions.ts`),
content schema errors are French (`z.config(z.locales.fr())` in `schemas.ts`), and so are the
validator's messages. Some technical English remains in placeholders (« talk, wave, nod, point… »,
« happy, sad, worried… », animation and expression ids) and in the product name « Civilization
Studio ». This matches the requirement, which allows technical English in the editor and prefers a
French interface.

Editing game texts in the Studio:

- **Text fields** (`TextField` in `src/studio/fields/PropField.tsx`) are used for every `prop.text`
  property. They show the French text of the key, not the key:
  - empty field: « ＋ Écrire un texte » creates a key with `newTextKey` (section 8) and an empty
    text;
  - key owned by the open pack: inline input, or a text area when the property is multiline or
    the text is longer than 48 characters, writing through `setText`;
  - key from another table (engine, core, another pack): read-only text, or « Clé introuvable dans
    les textes » in red, with « Copier ici » to create an editable copy in the open pack;
  - the key itself can be changed in a collapsible field, with suggestions from the pack's table
    (first 800 keys).
- **Locale editor** (`LocaleEditor` in `src/studio/editors/DataEditors.tsx`, the « Textes
  français » view of `locales/fr-FR.json`): filter on key or text; shows at most 400 rows (the Door
  and Memory tables are larger, so some keys are reachable only through the filter); text area
  above 60 characters; empty values highlighted. « ＋ Clé » adds any key matching
  `^[A-Za-z0-9_.-]+$` that does not exist yet, with an empty value; the pack prefix is suggested by
  the placeholder but not enforced. « ✕ » deletes a key without checking whether it is used; its
  tooltip asks to run « Valider » first.
- **`Studio.newTextKey` and `Studio.setText`** (`src/studio/core/studio.ts`) write into
  `civilizations/<pack>/locales/fr-FR.json` (created if missing) as undoable edits — successive
  keystrokes on one key merge into one undo step (« edits texts in place and merges keystrokes into
  one undo step », `studio.test.ts`) — apply `frenchApostrophes`, and push the table into the
  running session (`syncLocales`) so names update immediately.
- Saving goes through the dev file API (`tools/vite/civDevPlugin.ts`, `locales` is one of the
  writable pack directories).
- A new pack created with `npm run civ -- new-pack <id> --name "…"` (`tools/cli/newPack.ts`) gets a
  `locales/fr-FR.json` with `<id>.name`, `<id>.description`, `<id>.tagline` and
  `<id>.scene.depart`.

## 11. Player-visible text outside the tables

Strings a player can see that do not come from a table:

| Where | Text | Note |
| --- | --- | --- |
| `src/engine/input/inputManager.ts` `FR_KEY_NAMES` | « Espace », « Maj », « Ctrl droite », « Échap », « Entrée », « Retour »… | Key names for key caps |
| `src/game/ui/common.tsx` | `formatDuration` (« h », « min »); `formatDate` hard-codes `Intl.DateTimeFormat('fr-FR', …)` | Play time and save dates |
| `src/game/hud/Hud.tsx` | « {fps} i/s » | FPS counter (setting « Afficher les images par seconde ») |
| `src/game/main.tsx` | « CIVILIZATIONVERSE n'a pas pu démarrer. » | Boot failure, shown when the controller cannot be created; straight apostrophe |
| Engine errors (`src/engine/core/sim/session.ts`, `src/engine/core/save/saveFormat.ts`) | e.g. « Un chargement est déjà en cours. », « Version de sauvegarde invalide. » | French messages written in code; only `core.error.civNotFound` uses a key. They reach the player through the error screen (`ui.error.title` followed by the raw message) |
| `src/game/screens/Menus.tsx` | `CIVILIZATIONVERSE` | Brand name, allowed by the test |
| `src/game/screens/Menus.tsx` `Registry` | the fragment id | Fallback when a fragment name key is missing; unreachable with validated packs |
| `src/game/hud/Debug.tsx` (F3) | variable names and values, quest, entity and mechanic ids, log messages | Labels are translated (`ui.debug.*`); the content is raw. Available in player builds |
| Save files | `label` = translated civilization and scene names | Built at save time (`controller.ts`), so it stays in the language active when saving |
| `index.html`, `studio.html` | `lang="fr"` | |

Key letters inside French texts. Bindings are physical `KeyboardEvent.code` values
(`DEFAULT_BINDINGS` in `src/engine/platform/settings.ts`; `KeyR` and `KeyM` in the packs'
`content/rules.json`), but several texts name keys as fixed letters: `door.tuto.move` and
`memory.tuto.move` (« ZQSD », « E », « F »), `door.tuto.interact` (« E », « F », « J »),
`door.hud.permissionsHint` (« R »), `memory.tuto.chamber`, `memory.tuto.anchor`,
`memory.quest.MEM_Q00_EVEIL.eveil.examiner` and `memory.hud.key` (« M »). They do not follow
rebinding or the keyboard layout. « ZQSD » is right for the AZERTY positions of `KeyW`, `KeyA`,
`KeyS`, `KeyD` and wrong on QWERTY. `KeyM` is the key labelled « , » on an AZERTY keyboard (the « M »
key there is `Semicolon`), so « Appuyez sur M » is wrong on French keyboards. Pack bindings are not
listed in the settings screen, which only shows the engine actions, so they cannot be rebound in
game.

The game has no voice audio: dialogue and cinematic lines are text only. The character field
`voicePitch` (« Hauteur de voix (bips) » in the Studio) is not used at run time.

## 12. Adding another language

What already exists:

- The `Localizer` holds several locales and falls back to fr-FR key by key; `setLocale` notifies
  listeners; `pluralCategory` has a non-French branch.
- The pack loader accepts and registers any `locales/<ll>-<CC>.json`.
- Settings have a persisted `locale` field (default `'fr-FR'`), the settings screen has a language
  selector with a single option (`ui.settings.language.fr` « Français »), and `applySettings` calls
  `i18n.setLocale`.

What would have to be built:

1. **Engine table.** `session.ts` imports only `src/engine/locales/fr-FR.json`; a second table must
   be imported and registered.
2. **Startup locale.** `GameController.create` creates the session with `locale: 'fr-FR'`; the
   saved `settings.locale` is applied only when settings change (`applySettings`), not at startup.
3. **Selector.** Add the option and its `ui.settings.language.<xx>` key in
   `src/game/screens/Settings.tsx`.
4. **Plural rules.** `pluralCategory` only distinguishes French and « exactly 1 »; languages with
   `zero`, `two`, `few` or `many` need CLDR rules (e.g. `Intl.PluralRules`).
5. **Validation and tests.** `checkKey` only asks `has(key, 'fr-FR')`. Completeness per locale
   (same keys as French, same parameters) does not exist. `tests/acceptance/localization.test.ts`
   requires every table file to be `fr-FR.json` and applies French spacing rules to every table, so
   adding `en-US.json` would currently fail it.
6. **Studio.** `localePath`, `newTextKey`, `setText`, `syncLocales` and the locale editor are
   fixed to `locales/fr-FR.json`; `frenchApostrophes` is French-specific; `validateInStudio`
   creates its session with `locale: 'fr-FR'`.
7. **Text outside the tables** (section 11): key names, units, date format, the error messages,
   the boot message, `lang="fr"`, and the key letters written in the tutorial texts.
8. **Re-rendering.** The SDK's `useT()` should subscribe to `i18n.onChange` like the game shell's
   hook. Save labels keep the language they were saved in.
9. **Missing keys.** Surface `missing()` somewhere (the F3 overlay, the Studio) so untranslated
   keys are visible during testing; today a missing key only shows as `⟦key⟧` and a console
   warning.
