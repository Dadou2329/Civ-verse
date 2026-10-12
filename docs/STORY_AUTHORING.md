# Story authoring

This guide describes how the narrative layer of a civilization pack is written: dialogues, quests, logic rules (events → conditions → actions), cinematics, story variables and the French texts they display. It covers the JSON formats and the matching editors of Civilization Studio (`src/studio`). Each behavior described here refers to the code that implements it; paths are relative to the repository root.

Examples are copied from the two playable packs, `civilizations/door` and `civilizations/memory`. Player-visible text is French (fr-FR); identifiers, file names and this document are English.

Related documents: [EDITOR_GUIDE.md](EDITOR_GUIDE.md) (Civilization Studio), [PACK_FORMAT.md](PACK_FORMAT.md) (every file of a pack), [MECHANICS_SDK.md](MECHANICS_SDK.md) (writing new actions, conditions and events in TypeScript), [SAVE_FORMAT.md](SAVE_FORMAT.md) (saved state), [ARCHITECTURE.md](ARCHITECTURE.md), and [narrative/TRACEABILITY.md](narrative/TRACEABILITY.md) (scenario requirements mapped to content).

## Contents

1. [Overview](#1-overview)
2. [The logic language: conditions, actions, events](#2-the-logic-language-conditions-actions-events)
3. [Dialogues](#3-dialogues)
4. [Quests](#4-quests)
5. [Logic rules](#5-logic-rules)
6. [Cinematics](#6-cinematics)
7. [Variables and story state](#7-variables-and-story-state)
8. [Texts and French typography](#8-texts-and-french-typography)
9. [Working in Civilization Studio](#9-working-in-civilization-studio)
10. [Worked example: DOOR_Q01_EMPREINTE](#10-worked-example-door_q01_empreinte)
11. [Checking and testing story content](#11-checking-and-testing-story-content)
12. [Limitations](#12-limitations)
- [Appendix A — Core actions](#appendix-a--core-actions)
- [Appendix B — Core conditions](#appendix-b--core-conditions)
- [Appendix C — Events](#appendix-c--events)
- [Appendix D — Door and Memory building blocks](#appendix-d--door-and-memory-building-blocks)

---

## 1. Overview

### 1.1 Files, schemas, runtimes and editors

| Content | File (inside `civilizations/<pack>/`) | Schema in `src/engine/core/content/schemas.ts` | Runtime | Studio editor |
|---|---|---|---|---|
| Dialogue | `content/dialogues/<id>.dialogue.json` | `DialogueSchema` (`"format": "civverse.dialogue"`) | `DialogueSystem` — `src/engine/core/story/dialogue.ts` | `src/studio/editors/DialogueEditor.tsx` |
| Quest | `content/quests/<id>.quest.json` | `QuestSchema` (`"civverse.quest"`) | `QuestSystem` — `src/engine/core/story/quests.ts` | `src/studio/editors/QuestEditor.tsx` |
| Logic rules | `content/logic/<id>.logic.json` | `LogicSchema` (`"civverse.logic"`) | `RuleEngine` — `src/engine/core/logic/rules.ts` | `src/studio/editors/LogicDocEditor.tsx` |
| Cinematic | `content/cinematics/<id>.cinematic.json` | `CinematicSchema` (`"civverse.cinematic"`) | `CinematicSystem` — `src/engine/core/story/cinematics.ts` | `src/studio/editors/CinematicEditor.tsx` |
| French texts | `locales/fr-FR.json` | `LocaleSchema` (flat map key → string) | `Localizer` — `src/engine/core/i18n/localizer.ts` | `LocaleEditor` in `src/studio/editors/DataEditors.tsx` |

Conditions and action lists inside these files are edited with the shared block editors of `src/studio/fields/LogicEditors.tsx` and executed by the `LogicInterpreter` (`src/engine/core/logic/interpreter.ts`).

Loading rules (`loadPack` and `KIND_PATTERNS` in `src/engine/core/packs/pack.ts`):

- A file is recognised only by its path and suffix as listed above; other names are ignored.
- Each file is parsed with its Zod schema. A file that does not match is reported as an error (messages in French) and is not loaded.
- `format` and `version` are required. Every story format is currently `"version": 1`.
- `id` must match `[A-Za-z0-9_-]+` and should equal the file name; otherwise a warning is reported (`L'identifiant "…" ne correspond pas au nom du fichier.`).
- The whole content of a pack (except scenes, loaded on demand) is read when the civilization loads. Logic documents are then sorted by `id`; that order is the order in which their rules are checked.

`GameSession` (`src/engine/core/sim/session.ts`) owns one instance of each runtime, plus the `VariableStore` (`src/engine/core/state/variables.ts`) and the `MultiverseState` (`src/engine/core/state/multiverse.ts`), and runs one civilization at a time.

### 1.2 Logic embedded in scenes and items

Conditions and action lists also live in component properties of scene entities (`content/scenes/*.scene.json`, edited in the Studio inspector) and in `content/items.json`:

| Where | Properties | When the actions run | `$self` |
|---|---|---|---|
| `core.trigger` (`src/engine/core/behaviors/volumes.ts`) | `condition`, `onEnter`, `onExit`, `once` (default `true`) | player enters / leaves the volume; `once` and `condition` gate entering only | trigger entity |
| `core.interactable` (`src/engine/core/behaviors/interactive.ts`) | `condition`, `actions`, `once`, `hideIfUnavailable`, `unavailableReason` | interaction (offer id `use`) | entity |
| `core.pickup` (same file) | `condition`, `actions` | after the item is taken (offer `take`) | entity |
| `core.readable` (same file) | `condition`, `actions` | after the document is closed, first reading only (offer `read`) | entity |
| `core.portal` (`src/engine/core/behaviors/doors.ts`) | `condition`, `actions` | before the scene change (awaited) | entity |
| `core.conditional` (`src/engine/core/behaviors/conditional.ts`) | `states[].when` | re-evaluated on every event except `player.jumped` / `player.landed` | entity |
| `door.lock` (`civilizations/door/mechanics/locks.ts`) | `condition`, `onUnlock` | first successful opening | door entity |
| `content/items.json` | `actions[].condition`, `actions[].actions` | item action chosen in the inventory (`item.used`) | not set |

A trigger whose `condition` is false keeps re-testing it every frame while the player stands inside, and fires as soon as it becomes true (`trig_scene_mere` in `civilizations/door/content/scenes/verrou.scene.json` waits for `door.metMira`).

### 1.3 Content of the shipped packs

| Pack | Dialogues | Quests | Logic rules | Cinematics |
|---|---|---|---|---|
| `door` | 16 | 5 (`DOOR_Q00_REVEIL` … `DOOR_Q04_PORTE_ABSENTE`) | 13, in `absente.logic.json` and `main.logic.json` | 8 |
| `memory` | 12 | 5 (`MEM_Q00_EVEIL` … `MEM_Q04_SUJET_ZERO`) | 16, in `blanche.logic.json` and `main.logic.json` | 8 |

The scenes and cinematics of both packs were first generated by `civilizations/<pack>/seed/*.ts` (`npm run civ -- seed <pack>`). The seed command never overwrites an existing file unless `--force` is given (`tools/cli/civ.ts`); edits belong in the JSON files or in the Studio.

---

## 2. The logic language: conditions, actions, events

### 2.1 Conditions and actions are data

A condition or an action is a JSON object with a registered `type` and the properties that type declares:

```json
{ "type": "core.var", "var": "door.metMira", "op": "==", "value": true }
```

```json
{ "type": "core.completeObjective", "quest": "DOOR_Q01_EMPREINTE", "objective": "mira" }
```

- Types live in a `LogicRegistry` (`src/engine/core/logic/registry.ts`). The engine registers the `core.*` set (`coreActions.ts`, `coreConditions.ts`, `coreEvents.ts`, owner `engine`, in `registerEngineBuiltins`, `src/engine/core/sim/builtins.ts`). A pack adds its own by exporting `defineAction` / `defineCondition` / `defineEvent` values from `civilizations/<pack>/mechanics/*.ts`; they are unregistered when the civilization unloads. An id already registered by another owner is refused.
- Properties are declared with prop schemas (`src/engine/core/props/props.ts`). At run time `normalizeProps` fills missing properties with their defaults and replaces a value of the wrong type by the default (logged as a warning). Unknown property names are ignored without any message, so a misspelt property silently takes its default.
- An action may carry `"note"`, a designer comment that is never shown to players.
- Appendices A–D list every type with its properties and defaults.

### 2.2 References to the running context

String properties may contain references, resolved by `resolveRef` (`src/engine/core/logic/interpreter.ts`):

| Value | Resolves to |
|---|---|
| `"$self"` | the entity hosting the logic: the entity passed to a dialogue (usually the NPC), or the entity owning a component (§1.2). Empty string in rules, quests and cinematics. |
| `"$player"` | `"player"` |
| `"$event.<path>"` | a field of the payload of the event being handled (rules, quest objectives); dot paths are allowed |

Only top-level property values are resolved, not values nested in lists or objects. The shipped Door and Memory content does not use references.

### 2.3 How action lists and conditions execute

`LogicInterpreter.run` and `LogicInterpreter.test`:

- Actions run in order and each one is awaited. `core.wait`, `core.moveEntity` and `core.playCinematic` (their `wait` defaults to `true`), `core.openPanel` and `core.fade` (with `wait: true`, the default), `core.startDialogue` (only with `wait: true`; the default is `false`), `core.showDocument` and `core.showEndScreen` (both wait until the player closes the window) block the rest of their list.
- An unknown action type, or an action that throws, stops the rest of its list. The error is logged with its origin (for example `règle main/intro`, `dialogue mira/intro4`, `quête DOOR_Q01_EMPREINTE/fin`, `cinématique C02_rang1/fin`).
- A missing condition (`null` or absent) is true. A condition with an unknown type, or one that throws, is false and the error is logged.
- With no civilization loaded, actions are ignored and conditions are false.
- Composition: `core.if` (condition, `then`, `else`), `core.parallel` (several action lists started together; it ends when all have ended), `core.all`, `core.any`, `core.not`.
- Action types defined with `essential: false` are skipped when a list runs while a cinematic is being skipped (§6.5).
- Each execution is recorded in a 300-entry trace (`traces()`, `onTrace`); no screen displays it today (§12).

Who waits for a list to finish:

| Caller | Waits? |
|---|---|
| Dialogue node `actions`, choice `actions` | yes: the line is displayed, or the next node entered, after the list ends |
| Quest stage `onComplete` | yes: the quest system re-checks the next stage afterwards |
| Quest `onStart`, `onComplete`, `onFail` | no |
| Rule `then` / `else` | no |
| Cinematic `actions` items | no; the cinematic `onComplete` is awaited before `cinematic.ended` is emitted |
| Component lists (§1.2) | no, except `core.portal` (awaited before the scene change) |

### 2.4 Events and event matchers

- Gameplay events go through one synchronous `EventBus` (`src/engine/core/events/eventBus.ts`). An emission made while handling another is allowed up to a depth of 64; deeper emissions are refused and reported (`Boucle d'événements détectée…`).
- An event matcher (`EventMatch`, `src/engine/core/logic/types.ts`) is used by rules (`when`), quests (`startOn`) and objectives (`completeOn`):

  ```json
  { "event": "trigger.entered", "where": { "triggerId": "trig_fond_couloir" } }
  ```

  `matchEvent` accepts the event when its name is equal (or the matcher's `event` is `"*"`) and every `where` entry is deep-equal to the payload value at that key. Keys may be dot paths; values may be `$` references (§2.2).
- Events documented with `defineEvent` are offered by the Studio and accepted silently by validation. Other names still work in JSON, but validation warns `Événement non documenté` (§11). Appendix C lists the documented events, plus the engine events that are emitted but not documented.
- Payloads may carry more fields than the documented ones (for example `var.changed` also has `value` and `previous`); JSON `where` filters can use them.
- Content can emit its own events with `core.emit` (any name, JSON `payload`).
- For a given event, quests are evaluated before logic rules see it: the quest listener is installed in the `GameSession` constructor, the rule listener when the civilization loads. Quests ignore events whose name starts with `ui.`; rules do not.

---

## 3. Dialogues

### 3.1 Format

`DialogueSchema`:

| Field | Type | Meaning |
|---|---|---|
| `id` | local id | should equal the file name (warning otherwise) |
| `title` | string, optional | editor-only label (validation does not require a key) |
| `speakers` | `{ "<key>": { "name": "<text key>", "entity"?: "<entity id>" } }`, optional | named speakers that are not scene entities (§3.3) |
| `start` | node id | first node entered |
| `nodes` | array (at least one) | the graph |

Node (`DialogueNodeSchema`):

| Field | Type | Meaning |
|---|---|---|
| `id` | local id | unique in the dialogue |
| `speaker` | string, optional | entity id, `"player"`, `"narrator"` or a key of `speakers` (§3.3) |
| `text` | text key, default `""` | the line; an empty text with no choices makes a routing node, never displayed |
| `expression` | string, optional | facial expression applied to the speaker's character when the line is displayed |
| `animation` | string, optional | gesture played once by the speaker's character when the line is displayed |
| `actions` | action list, optional | run when the node is entered, before the line is displayed |
| `choices` | array, optional | player answers |
| `next` | node id or `null`, optional | default continuation |
| `branches` | `[{ "condition": …, "next": "<node id>" }]`, optional | conditional continuations, tested in order |
| `end` | boolean, optional | ends the dialogue after this node; `branches` and `next` are then ignored |
| `editor` | `{ "x", "y" }`, optional | node position in the Studio graph |

Choice (`DialogueChoiceSchema`):

| Field | Type | Meaning |
|---|---|---|
| `id` | local id | the chosen state is recorded per dialogue as `<dialogue>/<choice>` |
| `text` | text key | the answer shown to the player |
| `next` | node id, `null` or absent | `null` ends the dialogue; absent falls back to the node's `branches` / `next` |
| `condition` | condition, optional | the choice is hidden when false… |
| `showDisabled` | boolean, optional | …or shown greyed out instead when `true` |
| `actions` | action list, optional | run after the choice, before moving on |
| `once` | boolean, optional | hidden once it has been chosen |

### 3.2 How a dialogue runs

`DialogueSystem` (`src/engine/core/story/dialogue.ts`):

1. **Start.** `start(dialogueId, { entity })` is called by an NPC interaction or by `core.startDialogue` (§3.5). An unknown id logs an error and nothing starts. If another dialogue is active it is finished first (it emits its own `dialogue.ended`). The player's movement and look are locked (`dialogue:<id>`), `dialogue.started { dialogueId, entityId }` is emitted, and the `start` node is entered.
2. **Entering a node.** The node is marked as seen (`<dialogue>/<node>`), `dialogue.node { dialogueId, nodeId }` is emitted (routing nodes included) and the node's `actions` run and are awaited.
3. **Routing node** (no `text`, no `choices`): the continuation is resolved immediately (step 5) and the next node is entered. A chain of 200 nodes entered without displaying a line ends the dialogue (`MAX_HOPS`); a reference to a missing node logs an error and ends it.
4. **Displayed node.** The speaker name and the translated line are shown; `expression` and `animation` are sent to the speaker's entity, if one resolves (§3.3). Choices are filtered: a `once` choice already chosen is removed; a choice whose `condition` is false is removed, unless `showDisabled` is set (then it is shown disabled). If the node has choices but none is visible, a warning is logged and the node behaves like a plain line.
5. **Continuation of a line** (no visible choice, player presses continue): `end: true` ends the dialogue; otherwise the `branches` are tested in order and the first true condition gives the next node; otherwise `next`; otherwise the dialogue ends. Branch conditions are tested at that moment, after the node's own actions ran.
6. **Choice.** The choice must be visible and enabled. It is recorded as chosen, `dialogue.choice { dialogueId, nodeId, choiceId }` is emitted and its `actions` run and are awaited. Then `next: null` ends the dialogue, a node id is entered, and an absent `next` uses step 5 on the current node.
7. **End.** The lock is released and `dialogue.ended { dialogueId, lastNode }` is emitted. Leaving the scene or unloading the civilization ends the active dialogue as well (`abort()`).

The seen and chosen sets are saved with the civilization and read by `core.dialogueSeen` (an empty `node` means "any node of this dialogue") and `core.choiceMade`. Because chosen state is keyed by dialogue and choice id, two nodes that both offer a choice `rank` (as `intro1` and `intro2` of `mira.dialogue.json` do) share it.

### 3.3 Speakers

Name shown on the plate (`GameSession.speakerName`) and entity used for the camera, expressions and animations (`speakerEntity` in the `DialogueSystem` host, `src/engine/core/sim/session.ts`):

| `speaker` | Name plate | Entity |
|---|---|---|
| absent | none | none |
| a key of the dialogue's `speakers` map | that entry's `name` key, translated (this wins over every other rule) | the entry's `entity` if set, else as for an entity id |
| `"player"` | `core.speaker.player` = « Vous »; the box gets the `cv-dialogue--player` style | none |
| `"narrator"` | none | none |
| an entity id of the current scene with `core.npc` | that component's `name` key, translated | that entity |
| any other string | translated if it is a known text key, else shown as is | the entity with that id in the current scene, else the dialogue's entity |

The entity lookup uses the current scene only. If a speaker entity is not loaded and has no `speakers` entry, the plate shows the raw id. Validation (`validateCivilization`, §11) requires each node speaker to be `player`, `narrator`, `$self`, `$event`, a key of `speakers`, or an entity id from any scene of the pack.

The only `speakers` map in the shipped content is in `civilizations/memory/content/dialogues/file.dialogue.json`:

```json
"speakers": {
  "vendeur": {
    "name": "memory.speaker.vendeur"
  }
}
```

The shipped dialogues use entity ids as speakers (`"mira"`, `"varen"`, `"noe"`…); none uses `"player"` or `"narrator"`.

### 3.4 Expressions, animations and the dialogue box

- `expression` and `animation` are free strings in the schema. The character view (`src/engine/view/characters/animator.ts`) knows the expressions `neutral`, `happy`, `sad`, `angry`, `surprised`, `worried`, `determined`, `closed` and the gestures `wave`, `point`, `nod`, `shake`, `kneel`, `interact`, `cross`, `surprised`, `sad`, `bow`, `talk` (plus `idle`). The Studio offers the same lists. They apply only to displayed nodes whose speaker resolves to an entity.
- The dialogue box (`src/game/hud/DialoguePanel.tsx`) types the line at the `textSpeed` setting (default 55 characters per second, 0 = instant). Space, Enter or E completes the line, then continues; keys 1–9 pick a choice; clicking works too. Choices appear once the line is complete; disabled choices are greyed out. The hint reads « Continuer ».
- During a dialogue the first-person camera turns towards the head of the speaker's entity (`src/engine/view/cameraRig.ts`), and interactions are blocked (`InteractionSystem.blocked`).

### 3.5 Starting a dialogue

- **From an NPC.** `core.npc` (`src/engine/core/behaviors/npc.ts`) offers the interaction `talk` when `interactable` is true and `dialogue` is set. Its prompt is `talkPrompt` (default `core.prompt.talk` = « Parler à {name} », with the NPC's `name`). On interaction the NPC stops moving, looks at the player and starts the dialogue with itself as the dialogue entity (`$self`, fallback speaker entity). `entity.interacted { entityId, interaction: "talk" }` is emitted right after.
- **From logic.** `core.startDialogue` with `dialogue`, `entity` (sets `$self` and the fallback speaker entity) and `wait`. The final confrontation of Door is started this way by the rule `allies_arrivent` (`civilizations/door/content/logic/absente.logic.json`):

  ```json
  {
    "type": "core.startDialogue",
    "dialogue": "confrontation",
    "entity": "varen",
    "wait": true
  }
  ```

  The rule `ouverture` of the same file then reacts to `dialogue.ended` with `"where": { "dialogueId": "confrontation" }`.

### 3.6 Patterns from the shipped dialogues

**A routing hub.** 22 of the 28 shipped dialogues start on a routing node named `route` whose branches test the story state from the most specific to the most general, with `next` as the fallback line (the others, such as `confrontation`, start directly on a line). Node `route` of `civilizations/door/content/dialogues/mira.dialogue.json`, showing only the last two of its seven branches:

```json
{
  "id": "route",
  "text": "",
  "branches": [
    {
      "condition": {
        "type": "core.all",
        "of": [
          { "type": "core.questStatus", "quest": "DOOR_Q01_EMPREINTE", "status": "active" },
          { "type": "door.imprintReady" }
        ]
      },
      "next": "ready"
    },
    {
      "condition": { "type": "core.questStatus", "quest": "DOOR_Q01_EMPREINTE", "status": "active" },
      "next": "parts"
    }
  ],
  "next": "idle"
}
```

**Story changes on a line.** Node `intro4` of the same file sets a variable and completes a quest objective before its line is displayed:

```json
{
  "id": "intro4",
  "speaker": "mira",
  "text": "door.dlg.mira.intro4",
  "animation": "point",
  "actions": [
    { "type": "core.setVar", "var": "door.metMira", "value": true },
    { "type": "core.completeObjective", "quest": "DOOR_Q01_EMPREINTE", "objective": "mira" }
  ],
  "next": "intro5"
}
```

**Choices that record a decision.** Node `c8` of `civilizations/door/content/dialogues/confrontation.dialogue.json` stores the final choice and adjusts a relationship counter:

```json
{
  "id": "open",
  "text": "door.dlg.confrontation.c8.open",
  "next": "o1",
  "actions": [
    { "type": "core.setVar", "var": "door.finalChoice", "value": "ouvrir" },
    { "type": "core.addVar", "var": "door.varenTrust", "amount": -1 }
  ]
}
```

**Ending from a choice.** In `mira.dialogue.json`, node `intro5` offers `{ "id": "ok", "text": "door.dlg.mira.intro5.ok", "next": null }`, which closes the dialogue.

### 3.7 Dialogues in the Studio

The Dialogue editor shows the graph on the left and an inspector on the right.

- Toolbar: « ＋ Nœud », « Réorganiser » (forgets the manual positions stored in `editor`). Cards show the speaker (« Aiguillage » for routing nodes, « Sans locuteur », « Narration », « Joueur »), the badges « début » / « fin », the line and the choices (`▸ texte → nœud` or « (fin) »). Arrows: choices in blue, branches dashed purple, `next` grey.
- Inspector buttons: « ＋ Nœud suivant » (creates a node, linked as the `next` of the selected one when that node has no choices), « Début » (makes it the `start`), « Supprimer » (not for the start node; references to it are removed).
- Fields: « Identifiant » (renaming updates references inside this dialogue only), « Locuteur » (« — aucun — », « Narration », « Joueur », the `speakers` entries, the NPC entities of the scene currently open), « Réplique » (help: « Sans texte ni choix, le nœud est un aiguillage invisible »), « Expression », « Animation », « Actions ».
- « Choix du joueur »: per choice « Texte », « Mène à » (« — fin du dialogue — » or a node), « Visible si », « Actions », « Options » with « Une seule fois » (`once`) and « Grisé si indisponible » (`showDisabled`); « ＋ Choix » adds one.
- « Suite » (only for nodes without choices): « Branches » (help: « La première condition vraie choisit la suite »), each « Si… » + condition + « alors », « ＋ Branche »; and « Sinon / ensuite », where « — fin du dialogue — » sets `end: true`.
- New lines get a text key `<pack>.dlg.<dialogue>.<node>`; choices `<pack>.dlg.<dialogue>.<node>.<choice>` (§8.1). Emptying the French text keeps the key; to turn a line into a routing node, empty the key itself in the collapsed key line under « Réplique » (the field then shows « ＋ Écrire un texte » and the card « Aiguillage »).

Nodes created with « ＋ Nœud » or « ＋ Nœud suivant » start with `end: true`, and adding branches does not remove it, while the runtime ignores `branches` on an `end` node. Choose a node in « Sinon / ensuite » (which clears `end`) when a node has branches. The dialogue `title` and the `speakers` map have no field in the editor (§12).

---

## 4. Quests

### 4.1 Format

`QuestSchema`:

| Field | Type, default | Meaning |
|---|---|---|
| `id` | local id | stable id referenced by actions and conditions |
| `title`, `summary` | text keys | journal and notifications |
| `kind` | `"main"` \| `"side"`, default `"main"` | journal label; a new `main` quest takes the tracking from a `side` one |
| `order` | number, default `0` | order of quests in the journal and in the tracker fallback |
| `autoStart` | boolean, default `false` | starts at the first evaluation (when the civilization loads) |
| `startWhen` | condition, optional | starts as soon as it is true |
| `startOn` | event matcher, optional | starts on a matching event |
| `stages` | array (at least one) | the stages, in order |
| `onStart`, `onComplete`, `onFail` | action lists, optional | run when the quest starts, completes, fails |
| `failWhen` | condition, optional | fails the active quest when true |

Stage (`StageSchema`):

| Field | Type, default | Meaning |
|---|---|---|
| `id` | local id | |
| `description` | text key | current-stage text in the journal; appended to the journal history when reached |
| `objectives` | array | |
| `completion` | `"all"` \| `"any"`, default `"all"` | all required objectives, or one of them (alternative solutions) |
| `onComplete` | action list, optional | run when the stage completes (awaited) |
| `next` | stage id or `null`, optional | absent: the following stage in the array; `null`: the quest completes after this stage; an id: jump to it |

Objective (`ObjectiveSchema`):

| Field | Type | Meaning |
|---|---|---|
| `id` | local id | keep it unique in the quest: `core.completeObjective` targets the first stage that contains this id |
| `text` | text key | tracker and journal line |
| `optional` | boolean | not required; displayed with « (facultatif) » |
| `hidden` | boolean | not displayed and no notification; still counts for completion |
| `completeWhen` | condition | completes the objective when true (§4.3) |
| `completeOn` | event matcher | completes the objective on a matching event (§4.3) |
| `progress` | `{ "var": "<variable>", "count": n }` | displays « (value/count) » from a variable; display only |
| `target`, `targetScene` | entity id, scene id | validated, exposed in the quest view, not rendered (§12) |

### 4.2 Lifecycle

`QuestSystem` (`src/engine/core/story/quests.ts`). States: `inactive` → `active` → `completed` or `failed`.

A quest starts through `autoStart`, `startWhen`, `startOn`, `core.startQuest`, or `core.setQuestStage` on an inactive quest (it starts it, then moves to the stage). `start` does nothing on a quest that is not `inactive`, so `core.startQuest` on an active or finished quest is harmless. On start:

- the first stage becomes current and its `description` starts the history;
- objectives completed before the start are kept (§4.4);
- the quest becomes the tracked one if nothing is tracked, the tracked quest is no longer active, or the new quest is `main` and the tracked one is not;
- the notification `core.quest.started` (« Nouvelle quête : {title} ») is shown;
- `quest.started { questId }` and `quest.stageChanged { questId, stageId, previous: null }` are emitted;
- `onStart` runs (not awaited) and the quest is evaluated.

`core.completeQuest` also works on an inactive quest: it is marked completed directly, without `onStart`. `core.failQuest` only affects an active quest. On completion or failure, if the quest was tracked, the tracking moves to the first active quest by `order`; notifications `core.quest.completed` / `core.quest.failed`, events `quest.completed` / `quest.failed`, then `onComplete` / `onFail` (not awaited).

### 4.3 How objectives complete

1. **Explicitly**, with `core.completeObjective { quest, objective }` from any action list: a dialogue line, a choice, a trigger, a rule, a cinematic `onComplete`… This is the only way for an objective with neither `completeWhen` nor `completeOn`; validation warns when such an objective is never referenced by a `core.completeObjective` (§11).
2. **By condition** (`completeWhen`). Quests are evaluated on every event except `ui.*` events, at civilization load, and after each start, stage change and completion (`evaluate`, `requestEvaluation`). Conditions are not polled every frame: a condition that changes without any event (for example `core.playerNear`) is re-tested at the next event.
3. **By event** (`completeOn`), with the matcher of §2.4.

Only the objectives of the current stage of an active quest are tested by `completeWhen` and `completeOn`. When an objective of the current stage completes and is not hidden, the notification `core.quest.objectiveDone` (« Objectif accompli : {text} ») is shown. `quest.objectiveCompleted { questId, objectiveId }` is emitted for every objective completed in an active quest, hidden or not.

### 4.4 Objectives completed ahead of time

Verified in `QuestSystem.completeObjective`, `start` and `finishStage`:

- **Later stage of an active quest.** `core.completeObjective` on an objective of a stage not yet reached records it (`<stage>/<objective>`) without notification. When `finishStage` moves to that stage it re-checks it, so a stage whose objectives are all done completes at once.
- **Quest not started yet.** `core.completeObjective` on an inactive quest stores the objective in an `inactive` state (the first one also emits `quest.objectiveCompleted`; no notification). When the quest starts, these objectives are copied into its active state and the first stage is checked immediately. Door relies on this: the trigger `trig_porte_galerie` completes `DOOR_Q01_EMPREINTE/porte` with no condition, so walking past the gallery gate before the quest starts still counts (§10).
- **Conditions** (`completeWhen`) are not tested while the quest is inactive or the stage is not current, but they are tested as soon as the stage becomes current, so state reached earlier (an item already owned, a variable already set) counts if it still holds.
- **Event matchers** (`completeOn`) only see events emitted while their stage is current; earlier events are not remembered.
- `core.setQuestStage` does not re-check objectives completed ahead of time for the stage it jumps to (§12).

### 4.5 Stage completion and transitions

- `completion: "all"`: every non-optional objective is done. `"any"`: at least one non-optional objective is done. If every objective of the stage is optional, any one of them completes it. A stage with no objectives never completes by itself (use `core.setQuestStage` or `core.completeQuest`).
- When a stage completes and another stage follows (`next` absent → the next stage in the array, or an explicit id), the quest switches first (current stage, history, `quest.stageChanged`), then runs the finished stage's `onComplete` and awaits it, then re-evaluates and re-checks the new stage.
- When it is the last stage (or `next: null`), the stage's `onComplete` runs and is awaited, then the quest completes.
- Automatic stage changes show no notification of their own (besides the objective notifications). `core.setQuestStage` shows `core.quest.updated` (« Journal mis à jour : {title} ») and does nothing if the quest is already at that stage.
- `failWhen` is tested before the objectives at each evaluation of an active quest.

Because a stage's `onComplete` is awaited, a long action there (for example `core.playCinematic` with `wait: true`) postpones the re-check of the next stage until it ends. `DOOR_Q01_EMPREINTE` plays its cinematic with `"wait": false` (§10).

### 4.6 What the player sees

- **Tracker** (`src/game/hud/Objectives.tsx`): the tracked active quest, or the first active one by `order`; its kind label (« Quêtes principales » / « Quêtes secondaires »), title, and the non-hidden objectives of the current stage with ✓, « (value/count) » for `progress` and « (facultatif) » for optional ones.
- **Journal** (`src/game/hud/Journal.tsx`, key J): quests grouped « En cours », « Terminée », « Échouée », in `order`; for the selected quest its summary, the current stage `description` (active quests), the objectives, and « Ce qui s’est passé »: the history of stage descriptions without its last entry; « Suivre » tracks an active quest.
- **Progress**: `progress.var` is read with `vars.get`; the value shown is `min(value, count)`, or 0 when the variable is not a number. The objective still needs its own `completeWhen`, as in `civilizations/memory/content/quests/MEM_Q01_MELODIE.quest.json`:

  ```json
  {
    "id": "objets",
    "text": "memory.quest.MEM_Q01_MELODIE.jardin.objets",
    "completeWhen": { "type": "core.var", "var": "memory.objectsFound", "op": ">=", "value": 3 },
    "progress": { "var": "memory.objectsFound", "count": 3 }
  }
  ```

  The counter is raised by three rules of `civilizations/memory/content/logic/main.logic.json` (`objet_cerf_volant`, `objet_tasse`, `objet_clochette`), each `core.addVar` on `item.acquired`.

### 4.7 More excerpts

An optional objective completed by a condition (`civilizations/door/content/quests/DOOR_Q00_REVEIL.quest.json`):

```json
{
  "id": "plaque",
  "text": "door.quest.DOOR_Q00_REVEIL.cellule.plaque",
  "optional": true,
  "completeWhen": { "type": "core.var", "var": "door.readCellPlaque", "op": "==", "value": true },
  "target": "cell_plaque"
}
```

Objectives completed by events with filters (`DOOR_Q04_PORTE_ABSENTE.quest.json`, stages `descendre` and `seuil`):

```json
"completeOn": { "event": "scene.entered", "where": { "sceneId": "porte_absente" } }
```

```json
"completeOn": { "event": "item.acquired", "where": { "itemId": "door:fragment_seuil" } }
```

None of the ten shipped quests uses `autoStart`, `startWhen`, `startOn`, `failWhen`, `completion: "any"`, `hidden` or stage `next`; each one is started by an action (`core.startQuest` in a cinematic `onComplete`, a quest `onComplete`, a dialogue node, or the pack action `door.foundPoster`).

### 4.8 Saved state

The quest state is saved per civilization (`quests` in `LocalCivState`, `src/engine/core/save/saveFormat.ts`): status, current stage, completed objectives as `<stage>/<objective>`, start and end times, history, and the tracked quest. When a save is loaded, unknown quests are ignored with a warning, and a current stage that no longer exists falls back to the first stage.

### 4.9 Quests in the Studio

The Quest editor (`QuestEditor.tsx`) is a single form:

- « Titre », « Résumé », « Type » (« Principale » / « Secondaire »), « Ordre dans le journal ».
- « Démarrage »: « Automatique » (« Démarre dès le chargement de la civilisation »), « Démarre quand » (condition), « Ou à l’événement » (event + filters), « Au démarrage » (actions).
- « Étapes »: each « Étape N » with its id, « Description », « Terminée quand » (« Tous les objectifs obligatoires sont remplis » / « Un seul objectif suffit (solutions alternatives) »), the objectives, « À la fin de l’étape » (actions). « ＋ Étape » adds one; the last stage cannot be removed.
- Objective blocks: « Texte », « Options » (« Facultatif », « Caché »), « Rempli quand », « Ou à l’événement », « Progression » (help: « Affiche « valeur / total » à partir d’une variable »), « Cible (repère) » (entity and scene). « ＋ Objectif » adds one.
- « Fin et échec »: « À la fin de la quête », « Échoue quand », and « En cas d’échec » once a failure condition exists.
- Stage `next` has no field (JSON only).

---

## 5. Logic rules

### 5.1 Format

A logic document (`LogicSchema`) holds `id`, an optional `title` (editor label) and `rules`. A rule (`RuleSchema`):

| Field | Type, default | Meaning |
|---|---|---|
| `id` | local id | the `once` key is `<logic document id>/<rule id>` |
| `name` | string, optional | editor label |
| `enabled` | boolean, default `true` | disabled rules are skipped |
| `once` | boolean, default `false` | after the first run of `then`, never again in this playthrough |
| `scene` | scene id, optional | the rule only reacts while this scene is loaded |
| `when` | event matcher | the triggering event (§2.4) |
| `if` | condition, optional | absent = true |
| `then` | action list | run when `if` is true |
| `else` | action list, optional | run when `if` is false |

### 5.2 Dispatch

`RuleEngine.dispatch` (`src/engine/core/logic/rules.ts`) runs for every event on the bus, `ui.*` events included:

1. Rules are visited in order: logic documents sorted by `id`, then rules in array order (for Door: `absente` before `main`).
2. A rule is skipped if `enabled` is false, if it is `once` and already fired, or if `scene` is set and differs from the current scene id.
3. `when` must match the event; then `if` is tested with the event in scope (`$event.*`).
4. `then` (or `else`) is started without waiting; the next rule is checked right away.
5. A `once` rule is marked as fired only when `if` was true. While `if` stays false, its `else` runs on every matching event.

The fired `once` keys are saved with the civilization (`rulesFired`). Rules are installed when the civilization loads and removed when it unloads.

Two engine events need care:

- `civ.started` is emitted each time the civilization is loaded, new game or saved game (and not by the Studio's « Jouer ici », §9.5). Opening sequences use `once: true`.
- `scene.entered` is emitted on every scene entry, including after loading a save. Door reacts to it with non-`once` rules guarded by conditions, so that a situation set up by a script is rebuilt after a reload (`varen_au_registre_reprise`, `reprise_couloir`) and the epilogue starts on the return to `verrou` (`epilogue`).

### 5.3 Excerpts

The opening of Door (`civilizations/door/content/logic/main.logic.json`):

```json
{
  "id": "intro",
  "enabled": true,
  "once": true,
  "when": { "event": "civ.started" },
  "then": [
    { "type": "core.playCinematic", "cinematic": "C01_eveil", "wait": false }
  ],
  "name": "Éveil : cinématique d'ouverture"
}
```

The rule that follows it reacts to the end of that cinematic, whether it was watched or skipped:

```json
"when": { "event": "cinematic.ended", "where": { "cinematicId": "C01_eveil" } }
```

A scene-scoped rule with a condition (`absente.logic.json`, rule `ouverture`):

```json
{
  "id": "ouverture",
  "enabled": true,
  "once": true,
  "when": { "event": "dialogue.ended", "where": { "dialogueId": "confrontation" } },
  "then": [
    { "type": "core.playCinematic", "cinematic": "C04b_porte", "wait": true }
  ],
  "name": "La paroi cède (C04)",
  "scene": "porte_absente",
  "if": { "type": "core.var", "var": "door.finalChoice", "op": "exists", "value": true }
}
```

A rule that reads another civilization's progress (`civilizations/memory/content/logic/blanche.logic.json`, rule `vision`: the `core.if` of its `then` list, after a `core.wait` of 0.3 s):

```json
{
  "type": "core.if",
  "condition": { "type": "core.civCompleted", "civ": "door" },
  "then": [ { "type": "core.playCinematic", "cinematic": "M04b_vision_seuil", "wait": false } ],
  "else": [ { "type": "core.playCinematic", "cinematic": "M04b_vision", "wait": false } ]
}
```

No shipped rule uses a rule-level `else`; both packs branch with `core.if` inside `then`.

### 5.4 Rules in the Studio

The Logic editor (`LogicDocEditor.tsx`) titled « Logique — {title} »:

- « Titre », a search box « Filtrer les règles… » (id, name or event), « ＋ Règle » (adds a rule with id `regle` — or `regle_2`… — `"name": "Nouvelle règle"`, `"when": { "event": "civ.started" }` and an empty `then`). Without rules: « Aucune règle. Une règle réagit à un événement du jeu. »
- Rule header: the « Activée » checkbox (`enabled`), the name (« Nom de la règle »), the id, and ↑ ↓ ⧉ (duplicate) ✕.
- « Quand »: the event picker, then « Filtres (laisser vide pour tout accepter) » built from the event's documented fields; empty filters are removed from `where`.
- « Si » (condition), « Alors » (actions), « Sinon » (shown once the rule has a condition or `else` actions), « Options » → « Une seule fois par partie » (`once`), « Scène » (help: « Limiter la règle à une scène (vide : toutes) »).

---

## 6. Cinematics

### 6.1 Format and flags

`CinematicSchema`:

| Field | Default | Effect (verified) |
|---|---|---|
| `id`, `title` | — | `title` is an editor label |
| `duration` | required, ≥ 0.1 s | the cinematic ends when its time reaches `duration` |
| `skippable` | `true` | when `false`, `skip()` is ignored and no skip hint is displayed |
| `letterbox` | `true` | black bars (`cv-letterbox is-on`, `src/game/hud/Cinematic.tsx`) |
| `lockPlayer` | `true` | takes a movement and look lock (`cinématique:<id>`) for the duration |
| `hideHud` | `true` | hides crosshair, prompt, objective tracker, civilization HUD slots, ability bar, barks, notifications and location titles (`src/game/hud/Hud.tsx`); subtitles, the dialogue box, documents, panels and end screens still show |
| `returnCamera` | `"blend"` | `"blend"`: 0.8 s smooth return from the last cinematic pose to the player camera (`src/engine/view/cameraRig.ts`); `"cut"`, or any skipped cinematic: immediate |
| `tracks` | — | §6.3 |
| `onComplete` | optional | action list run at the end, also when skipped (§6.5) |

All 16 shipped cinematics are skippable, letterboxed, lock the player and hide the HUD; `C04c_coupe` and `M04_sujet_zero` use `"returnCamera": "cut"`.

### 6.2 Timeline semantics

`CinematicSystem` (`src/engine/core/story/cinematics.ts`) advances with the simulation clock, so pausing the game pauses it. Each frame:

- Items of each track fire when the time reaches their `t`, in array order: a cursor stops at the first item whose `t` is still ahead, so items must be sorted by `t`.
- Time is clamped to `duration`; items with `t` greater than `duration` never fire during normal playback (they only run on skip).
- `play()` while another cinematic plays ends the running one first as if it were skipped (§6.5), even when that one is not `skippable`.
- `cinematic.started { cinematicId }` is emitted at the start.

### 6.3 Tracks

The six track types of `CinematicTrackSchema`:

| `type` | Item fields | Normal playback | When skipped (items not yet fired) |
|---|---|---|---|
| `camera` | `keys: [{ t, position, target?, lookAt?, fov?, roll?, ease?, cut? }]` | pose evaluated every frame (below) | ignored |
| `subtitle` | `items: [{ t, duration ≥ 0.1, speaker?, text }]` | displayed from `t` to `t + duration`; when several overlap, the last one fired is shown | not shown |
| `actor` | `entity`, `keys: [{ t, teleport?, moveTo?, speed?, yaw?, lookAt?, animation?, expression?, visible?, say? }]` | applied at `t`; `moveTo` walks there | `teleport`, `yaw`, `lookAt`, `visible`, `expression` applied; `moveTo` becomes a teleport; `animation` and `say` dropped |
| `audio` | `items: [{ t, sound?, music?, at?, volume? }]` | `sound` played (at an entity or a position if `at` is set); `music` changes the music with a 1.5 s fade, `null` stops it | `music` cues applied; sounds dropped |
| `fx` | `items: [{ t, fx, …params }]` | presentation effect (below) | dropped |
| `actions` | `items: [{ t, actions, essential? }]` | the list starts (not awaited) | run, except items with `"essential": false`; inside, action types with `essential: false` are skipped |

**Camera keys.** Only the first `camera` track is used (`evaluateCameraTrack`, also used by the Studio preview). Before the first key the first pose holds; after the last key the last pose holds. Between two keys the pose is interpolated with the `ease` of the later key (default `inOutSine`; names: `linear`, `inSine`, `outSine`, `inOutSine`, `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `outBack`, `step`). A key with `cut: true` is not interpolated towards: the previous pose holds until its `t`, then the camera jumps. The look target is `lookAt` (an entity id, at the entity position plus 1.5 m, or `"player"` for the player's eye), else `target`, else straight ahead along +Z. `fov` ranges from 10 to 120 and `roll` defaults to 0. A key without `fov` is treated inconsistently: while the camera moves towards it, it keeps the previous key's `fov`; while the camera rests on it (it is the last key, or the next key is a `cut`), it uses 70. In `C02_rang1` the key at 4 s has no `fov`, so the view widens from 58° to 70° at 4 s until the cut at 4.6 s; giving every key a `fov` avoids such jumps. A cinematic without camera keys keeps the first-person view.

**Subtitle speakers** are resolved like dialogue speakers without the `speakers` map: entity id (its `core.npc` name), `"player"` (« Vous »), or a text key. The HUD prints `Name : text`. The shipped cinematics use text keys such as `door.npc.mother` or `door.speaker.voice`.

**Actors.** `lookAt` takes a position, an entity id, `"player"` or `null` (stop looking). An `actor` track may target `"player"`: `teleport` and `yaw` move the player, `moveTo` does nothing during playback (it becomes a teleport when skipped), and the other fields have no effect on the player.

**Effects** handled by the client (`handlePresentationForUi` in `src/game/state/uiStore.ts`, `onPresentation` in `src/engine/view/gameView.ts`):

| `fx` | Parameters (defaults) |
|---|---|
| `fade` | `to` (1), `seconds` (1), `from` (optional starting opacity), `color` (keeps the current fade color while the screen is not clear, otherwise black) |
| `flash` | `color` (`#ffffff`), `seconds` (0.6) |
| `tint` | `color` (`null` clears), `strength` (0.3), `seconds` (1) |
| `shake` | `intensity` (0.3), `seconds` (0.6) |
| `fov` | `delta` (6), `seconds` (1) |
| `vignette` | `intensity` (0.5) |

Any other `fx` name is ignored.

### 6.4 Excerpts

`civilizations/door/content/cinematics/C02_rang1.cinematic.json` (12 s), its non-camera tracks and `onComplete`:

```json
{ "type": "subtitle", "items": [
  { "t": 0.4, "duration": 3.8, "text": "door.cin.c02.1" },
  { "t": 5.2, "duration": 5.6, "text": "door.cin.c02.2" } ] },
{ "type": "audio", "items": [
  { "t": 1.2, "sound": "core:unlock", "at": "porte_galerie" },
  { "t": 4.6, "music": "door:music.galerie" } ] },
{ "type": "fx", "items": [
  { "t": 1.2, "fx": "flash", "color": "#f1d78a", "seconds": 0.5 } ] }
```

```json
"onComplete": [
  { "type": "core.music", "music": "door:music.faubourg", "fade": 3 }
]
```

Story changes that must survive a skip, in `C04b_porte.cinematic.json`:

```json
{ "t": 6, "essential": true, "actions": [
  { "type": "core.setBlocks", "from": [19, 8, 33], "to": [20, 12, 33], "block": "" },
  { "type": "core.setVar", "var": "door.absentDoorShown", "value": true },
  { "type": "core.setVar", "var": "door.palmRevealed", "value": true } ] }
```

with `"onComplete": [{ "type": "core.completeObjective", "quest": "DOOR_Q04_PORTE_ABSENTE", "objective": "ouvrir" }]`.

An actor track, in `C_mere.cinematic.json`:

```json
{ "type": "actor", "entity": "mere", "keys": [
  { "t": 0, "teleport": [61.5, 8, 40.5], "yaw": 0, "animation": "interact", "expression": "worried" },
  { "t": 7.8, "animation": "surprised", "lookAt": "garde_soins" },
  { "t": 17.2, "moveTo": "marque_mere_dedans", "speed": 2.4 } ] }
```

### 6.5 Ending, skipping, aborting

- **Natural end** (time ≥ `duration`): the lock is released, the camera blends back if `returnCamera` is `"blend"`, `onComplete` runs and is awaited, then `cinematic.ended { cinematicId, skipped: false }` is emitted.
- **Skip** (the `skip` key, Space or Enter by default, `src/engine/view/gameView.ts`; or `ctx.cinematics.skip()`): ignored if `skippable` is false. Otherwise every item not yet fired is processed in "skipping" mode as in the table of §6.3: `fx` items, sounds, subtitles, actor animations and barks are dropped; music cues, positions and expressions are applied; `actions` items run unless marked `"essential": false`. The camera cuts back, `onComplete` runs with the skipping flag, then `cinematic.ended { skipped: true }` is emitted.
- **Skipping flag.** In lists run while skipping (late `actions` items and `onComplete`), the action types defined with `essential: false` are skipped: `core.wait`, `core.log`, `core.showLocation`, `core.lookAt`, `core.playAnimation`, `core.say`, `core.lockPlayer`, `core.playSound`, `core.flash`, `core.shake`, `core.fx`, and `memory.playEcho`. Some other actions shorten themselves: `core.moveEntity` teleports, `core.fade` applies its opacity at once.
- **Abort.** Leaving the scene or unloading the civilization (`GameSession.exitScene`, `unloadCivilization`) aborts the cinematic: remaining items and `onComplete` do not run and `cinematic.ended` is not emitted. A `core.changeScene` therefore belongs in `onComplete` (as in `C04c_coupe` and `M04_sujet_zero`), not in an `actions` item.

The scenario requirement « Tous les segments doivent être skippables sans briser les états de quête » (`docs/narrative/DOOR_CIVILIZATION_SCENARIO.txt`, section 8) is met by putting quest and variable changes in `onComplete` or in `actions` items that are not marked `"essential": false`.

### 6.6 Starting a cinematic

`core.playCinematic { cinematic, wait }` (`wait` defaults to `true`: the list continues when the cinematic ends, skipped or not, or is aborted). Door starts cinematics from a rule (`C01_eveil`, `C04b_porte`, `C04c_coupe`, `C05_*`), a quest stage `onComplete` (`C02_rang1`), a trigger (`C_mere`, entity `trig_scene_mere`) and an interactable (`C03_registre`, entity `registre_secret`).

### 6.7 Cinematics in the Studio

The Cinematic editor (`CinematicEditor.tsx`) shows a timeline (48 pixels per second) above which the scene viewport previews the camera at the playhead.

- Toolbar: the time « x.xx s / d s », « ▶ Aperçu » / « ❚❚ Pause », « ⏮ », « ＋ Clé caméra (vue actuelle) » (a key at the playhead from the editor camera), and « ＋ Ajouter… » with « Sous-titre », « Piste d’acteur (entité sélectionnée) », « Son ou musique », « Effet d’écran », « Actions ».
- Track labels: « Caméra », « Sous-titres », « Acteur : <entité> », « Sons et musique », « Effets d’écran », « Actions »; ✕ removes a track. Keys are dragged in time; a click on a key opens its inspector.
- Settings panel « Cinématique » (nothing selected): « Titre (éditeur) », « Durée (s) », « Le joueur peut la passer », « Bandes noires », « Joueur immobilisé », « Interface masquée », « Retour caméra » (« Fondu vers le joueur » / « Coupe franche »).
- Item inspectors: camera key (« Temps (s) », « Position », « Regarde », « Ou suit l’entité », « Champ (°) », « Courbe », « Coupe franche (pas d’interpolation) », « Prendre la vue actuelle »); subtitle (« Durée (s) », « Locuteur » with help « Clé du nom (ex. memory.npc.oriane) ou entité ; vide : narration », « Texte »); actor key (« Entité », « Animation », « Expression », « Regarde », « Va vers », « Dit (bulle) », « ＋ Clé d’acteur »); audio (« Son », « Musique », « Source (entité) »); effect (« Effet »: « Fondu », « Éclair », « Secousse », « Teinte »; « Couleur », « Opacité de / vers », « Durée (s) », « Intensité »); actions (« Essentielle (s’exécute même si la cinématique est passée) » and the action list).
- « À la fin (même si le joueur passe la cinématique) » edits `onComplete`.
- New subtitles get a text key `<pack>.cin.<cinematic>.<t × 10>`.

Several runtime capabilities have no field in this editor (actor `teleport`, `yaw`, `visible`, `speed`, position targets; `music: null`; `fov` and `vignette` effects; `tint` strength), and the editor does not keep item tracks sorted (§12).

---

## 7. Variables and story state

### 7.1 Local variables

- Names are `<civId>.<name>`, for example `door.metMira`; values are any JSON value. A civilization can only write its own namespace: `ctx.vars.set` throws for any other name (`La civilisation "door" ne peut écrire que ses variables (door.*), pas "…".`), which stops the action list.
- A variable exists from its first write. Reading an unset variable gives `undefined`.
- Content cannot declare types. Pack code can, with `ctx.vars.declare(name, { type, default, description })`; a write of the wrong type then throws. Door declares `door.rank` (number, default −1: no plaque) and `door.rankTemporary` (boolean) in `civilizations/door/mechanics/access.ts`.
- Writes from content: `core.setVar` (any JSON value, default `true`), `core.addVar` (a non-number counts as 0), `core.toggleVar` (`!value`), and pack actions (`door.setRank`, `door.addEvidence`…).
- Every effective change emits `var.changed { name, value, previous }`; writing a deep-equal value emits nothing.
- `core.var` operators (`compareValues`): `==` and `!=` use deep equality; `>`, `>=`, `<`, `<=` are false unless both sides are numbers; `exists` is true unless the value is `undefined`, `null` or `false`; `missing` is the opposite; `contains` tests array membership (deep equality) or a substring.
- Local variables of other civilizations are not loaded while this one runs; validation also reports any variable name outside `<civId>.` or `global.` (§11). Cross-civilization state goes through the multiverse (§7.2).

Variables named in `docs/narrative/DOOR_CIVILIZATION_SCENARIO.txt` section 7 and where they are written:

| Variable | Written by |
|---|---|
| `door.rank` | `door.setRank`; `door.openImprint` (rank 1); the `noe` dialogue, node `intro4` (rank 0). The scenario lists « 0/1/2 temporaire »; the code also uses −1 before the first plaque, and `door.rankTemporary` marks the temporary rank 2 |
| `door.metMira` | `mira` dialogue, node `intro4` |
| `door.foundEliasPoster` | pack action `door.foundPoster` |
| `door.evidenceCount` | pack action `door.addEvidence` (with `door.evidence.ordre` / `door.evidence.plaque`) |
| `door.varenTrust` | `core.addVar` in the `confrontation` and `varen` dialogues |
| `door.finalChoice` | `confrontation` dialogue, choices of node `c8` (`"ouvrir"` / `"ecouter"`) |
| `door.finished` | `onComplete` of `C05_epilogue_ecoute` / `C05_epilogue_ouvre` |
| `global.fragments.threshold` | `core.grantFragment` `"threshold"` in rule `fragment` of `absente.logic.json` (read-only path, §7.2) |

### 7.2 Multiverse (global) state

`MultiverseState` keeps what persists across civilizations: protagonist, fragments, flags and per-civilization progress. Content reads it through read-only `global.*` variable paths (`MultiverseState.read`):

| Path | Value |
|---|---|
| `global.fragments` | array of the fragment ids owned |
| `global.fragments.<id>` | `true` when owned, otherwise `undefined` |
| `global.flags.<name>` | the flag value; names may contain dots (`global.flags.door.finalChoice`) |
| `global.civs.<civId>` | `{ started, completed, lastPlayed, playTime }`, or `undefined` |
| `global.civs.<civId>.<field>` | one of those fields |
| `global.protagonist.awakenings` | number, incremented by `loadCivilization` when a civilization starts for the first time or without saved local state |
| `global.protagonist.title` | string or `null` |

Conditions on the multiverse: `core.hasFragment`, `core.globalFlag` (operator default `exists`), `core.civCompleted`, or `core.var` on a `global.*` path. Writing a `global.*` name with `core.setVar` throws; validation reports it as an error.

Writes go through dedicated actions, checked against the manifest's `globalWrites` (`isWriteAllowed`: a pattern ending in `*` is a prefix, anything else must be equal):

| Action | Permission needed in `globalWrites` | Effect |
|---|---|---|
| `core.grantFragment { fragment }` | `fragments.<fragment>` | records the fragment; the first grant emits `multiverse.fragmentAcquired { fragmentId, civId }` |
| `core.setGlobalFlag { flag, value }` | a pattern matching `flags.<flag>` | sets the flag |
| `core.markCivCompleted` | none | marks the running civilization completed |
| `core.finishCivilization` | none | marks it completed and emits `civ.finished` (the game returns to the civilization selection) |

A refused write throws (`La civilisation "…" n'est pas autorisée à écrire …`), which stops the list. The manifests declare:

```json
"globalWrites": ["fragments.threshold", "flags.door.*"]
```

(`civilizations/door/manifest.json`) and `["fragments.remanence", "flags.memory.*"]` (`civilizations/memory/manifest.json`). Memory's rule `remanence` (`main.logic.json`) grants its fragment and records the outcome:

```json
{ "type": "core.grantFragment", "fragment": "remanence" },
{
  "type": "core.if",
  "condition": { "type": "core.var", "var": "memory.restorationOutcome", "op": "==", "value": "acceptee" },
  "then": [ { "type": "core.setGlobalFlag", "flag": "memory.restoration", "value": "acceptee" } ],
  "else": [ { "type": "core.setGlobalFlag", "flag": "memory.restoration", "value": "refusee" } ]
}
```

In the Studio, `globalWrites` and the fragment registry are edited in « Civilisation et interface », section « Multivers » (« Écritures globales autorisées », « Fragments du registre multiversel »).

### 7.3 What is saved

Per civilization (`LocalCivState`, `src/engine/core/save/saveFormat.ts`, built by `GameSession.snapshotCivState`): current scene and player (position, look, abilities, `title` set by `core.setPlayerTitle`), every `<civId>.*` variable, inventory, quest states, dialogue seen/chosen sets, fired `once` rules, mechanic states, and per-scene entity states (component states such as a trigger's `fired` flag, property overrides from `core.setProp`, changed positions, visibility, `enabled`, block edits, spawned and removed entities). The multiverse is saved once per save game (`SaveGame.global`). A fresh start of a civilization (`loadCivilization(…, { fresh: true })`) drops its local state and keeps the multiverse.

The F3 debug overlay (`src/game/hud/Debug.tsx`) lists the active quests with their current stage, every variable of the running civilization and the last errors.

---

## 8. Texts and French typography

### 8.1 Text keys

- Every player-visible string in story content is a key of the pack's `locales/fr-FR.json` (a flat JSON object). Keys of a pack start with the pack id (`door.…`, `memory.…`); `tests/acceptance/localization.test.ts` rejects keys outside that namespace.
- Fields holding keys: dialogue node `text`, choice `text`, `speakers.*.name`; quest `title`, `summary`, stage `description`, objective `text`; subtitle `text` and non-entity `speaker`; actor `say`; and every action or component property of kind `text` (`core.notify.text`, `core.showDocument.title` / `pages`, `core.say.text`, `core.showEndScreen.*`, `core.setPlayerTitle.title`, NPC `name`, prompts…). Dialogue and cinematic `title` are editor labels.
- A missing key renders as `⟦key⟧` and logs `[i18n] clé manquante : key` (`Localizer.t`). Validation reports a missing key as an error, and a value that looks like prose instead of a key as `Texte brut au lieu d'une clé de traduction`.
- Message syntax (subset of ICU, `formatMessage`): `{name}`, `{count, plural, one {…} other {…}}` (French rule: 0 and 1 are singular), `{g, select, …}`. Story texts (dialogue lines, choices, subtitles, quest texts, `core.notify`) are translated without parameters, so a `{placeholder}` in them stays literal; parameters are supplied by code, for example `core.prompt.talk` « Parler à {name} ».
- Existing keys follow `door.dlg.<dialogue>.<node>[.<choice>]`, `door.quest.<QUEST>.<stage>[.<objective>]` and `door.cin.<short name>.<n>` (for example `door.cin.c02.1`). Keys created by the Studio follow `<pack>.<field path>` (§9.3).

### 8.2 Typography

The pack tables follow French typography, and `tests/acceptance/localization.test.ts` enforces it on every `fr-FR.json` table (« is clean French »):

| Rule | Character | Count in `door` / `memory` tables |
|---|---|---|
| narrow no-break space before `?`, `!`, `;` | U+202F | `?` 43 / 54, `!` 20 / 11, `;` 0 / 1 |
| no-break space before `:` | U+00A0 | 58 / 50 |
| no-break space after `«` and before `»` | U+00A0 | 17 / 31 pairs |
| typographic apostrophe for elisions | ’ (U+2019) | no straight apostrophe left |

Other conventions: the ellipsis is the single character `…` (U+2026, 28 / 26 occurrences, no `...` left), and dashes are `—` (U+2014).

A real entry using all of them (`civilizations/door/locales/fr-FR.json`), shown with JSON escapes to make the spaces visible; the file itself stores the characters:

```json
"door.lock.privateVoice": "Une voix, derrière\u00a0: «\u00a0On n’ouvre pas aux inconnus\u202f!\u00a0»"
```

and with a semicolon (`civilizations/memory/locales/fr-FR.json`):

```json
"memory.dlg.margaux.m2": "J’ai vendu une nuit. La pire de ma vie. Je sais qu’elle a eu lieu\u202f; je ne sais plus ce qu’il y avait dedans. Et c’est très bien comme ça."
```

The localization test also rejects a plain space before `? ! ; : »` or after `«`, a straight apostrophe between two letters (`hasStraightElision`, `src/engine/core/i18n/typography.ts`), three periods instead of `…`, empty values, leading, trailing or double spaces, placeholder markers (`⟦`, `TODO`, `FIXME`, `TBD`, `lorem ipsum`) and a list of English words.

In the Studio, `frenchApostrophes` turns a straight apostrophe typed between two letters into ’ (`Studio.setText`, `Studio.newTextKey` and the « Textes » table). No-break spaces are not inserted automatically: type U+202F / U+00A0 yourself, or write `\u202f` / `\u00a0` escapes in the JSON.

---

## 9. Working in Civilization Studio

### 9.1 Opening

Run `npm run dev` and open `/studio.html` on the dev server (Vite, `127.0.0.1:5173` unless the port is taken), or use « Studio des civilisations » in the game's main menu, which appears only when served by the dev server. Saving and script editing need the dev server; otherwise the toolbar shows « Lecture seule ».

Toolbar (`src/studio/StudioApp.tsx`): « Pack » (civilization being edited), ↶ « Annuler » (Ctrl+Z), ↷ « Rétablir » (Ctrl+Y), « 💾 Enregistrer » (Ctrl+S, all modified files), « ✔ Valider », « ▶ Jouer ici », « ▶ Depuis le début », « Jeu ». Panels: « Explorateur », « Hiérarchie de la scène », « Inspecteur », and the bottom console with « Journal » and « Problèmes ».

### 9.2 Creating documents

In « Explorateur », the groups « Dialogues », « Quêtes », « Cinématiques » and « Logique » have a « ＋ » button (shown when the Studio can write) that opens « Nouveau : dialogue » (or quête, cinématique, logique) with « Identifiant » and « Titre »; « Créer » opens the new document, and the file is written at the next save (« Le fichier est créé à l’enregistrement (Ctrl+S). »). Templates (`NewDocModal`, `src/studio/panels/Explorer.tsx`):

- dialogue: `start: "debut"`, one node `debut` with `speaker: "narrator"`, a new text « … » and `end: true`; `title` is the raw title typed;
- quest: new title and summary keys, `kind: "main"`, `order` = number of existing quests, stage `etape1` with objective `objectif1`;
- cinematic: 8 s, the default flags, a camera key at t = 0 taken from the editor camera (when available), an empty subtitle track;
- logic: no rules.

### 9.3 Writing texts

Text properties are edited through their French text (`TextField`, `src/studio/fields/PropField.tsx`): an empty property shows « ＋ Écrire un texte », which creates a key; the key is shown in a collapsed line under the text, which opens on an input with key suggestions. A key owned by another pack (for example the engine's default prompts) is shown read-only with « Copier ici », which creates an editable copy in the current pack. New keys are `<pack>.<field path>` (`Studio.newTextKey`; a numeric suffix `_2`, `_3`… avoids collisions): `door.dlg.<dialogue>.<node>`, `door.quest.<quest>.<stage>.<objective>`, `door.cin.<cinematic>.<n>`, `door.logic.<document>.<rule>.<index>.<property>` for action texts in rules.

The « Textes » group opens the table editor « Textes français — <pack> »: search « Chercher une clé ou un texte… », « ＋ Clé », and ✕ to delete a key (the tooltip asks to run « Valider » first).

### 9.4 Story hooks in scenes

Entities that start dialogues or carry logic are added from the viewport's « ＋ Ajouter » menu (`src/studio/core/templates.ts`): « Personnage » (`core.npc`), « Point d’interaction » (`core.interactable`), « Objet à ramasser », « Document à lire », « Déclencheur » (`core.trigger`, `once: true`), « Zone nommée », « Repère » (targets of `core.moveEntity` / `core.teleportEntity`), « Point d’apparition », « Passage vers une scène ». Components are added to an existing entity with « ＋ Ajouter un composant… » in the inspector; condition and action properties use the same block editors as the documents:

- conditions: « ＋ Ajouter une condition… (toujours vraie sinon) », a type picker grouped by category, ✕ « Retirer la condition »;
- actions: « ＋ Ajouter une action… », blocks with ▾/▸, ↑ « Monter », ↓ « Descendre », ✕ « Retirer l’action »;
- events: « Aucun événement » or « label (id) », then the filters.

Variable fields suggest every variable name already used in the pack's content (`knownVariables`, `src/studio/ui/catalog.ts`); a name that is not in the suggestions is still accepted and shown with the invalid style.

### 9.5 Playtesting

- « ▶ Depuis le début » runs the civilization from its entry point.
- « ▶ Jouer ici » runs the open scene from the editor camera with `quietStart`: `civ.started` is not emitted, so opening rules (Door's `intro`) do not run and the quests they start stay inactive.
- Both use the real game (renderer, HUD, F3 overlay) on the working copies, unsaved changes included, always from a fresh local state (`GameController.startPlaytest` passes `fresh: true`); saves go to memory only. F8 stops, « ↺ Recommencer » restarts, « ■ Arrêter » closes.
- Errors and warnings of the playtest are copied into « Journal » with the prefix `[test]`.

### 9.6 Suggested order of work

1. Create the quest (stages, objectives, how each objective completes).
2. Write the dialogues: a routing start node, lines and choices, and the actions that change variables and complete objectives.
3. Place the scene hooks: NPCs with their `dialogue`, triggers, interactables, markers.
4. Add logic rules for reactions to events (`civ.started`, `dialogue.ended`, `item.acquired`…).
5. Add cinematics; keep story changes in `onComplete` or essential `actions` items.
6. « ✔ Valider », fix « Problèmes », then playtest.

---

## 10. Worked example: DOOR_Q01_EMPREINTE

### 10.1 From the scenario to the content

`docs/narrative/DOOR_CIVILIZATION_SCENARIO.txt`, section 7 « OBJECTIFS ET ÉTATS TECHNIQUES », fixes the quest ids; section 8 « CINÉMATIQUES MINIMALES » the cinematics:

| Scenario | Content |
|---|---|
| `DOOR_Q00_REVEIL` : sortir de la cellule, parler à Noé | `quests/DOOR_Q00_REVEIL.quest.json`: stages `cellule` (`sortir`; `plaque`, optional) and `noe` (`noe`) |
| `DOOR_Q01_EMPREINTE` : trouver les trois pièces, résoudre trois cadrans, obtenir rang 1 | `quests/DOOR_Q01_EMPREINTE.quest.json`: stages `galerie`, `pieces`, `empreinte`, `franchir` |
| `DOOR_Q02_ELIAS` : inspecter affiche, récupérer ordre de transfert et plaque d'Elias | stages `piste` (`affiche`, `registre`) and `preuves` (`ordre`, `plaque`, `acces` optional) |
| `DOOR_Q03_ARCHIVES` : obtenir accès temporisé Rang 2, consulter le registre | stages `eda`, `registre` |
| `DOOR_Q04_PORTE_ABSENTE` : atteindre corridor, choisir réponse à Varen, déclencher ouverture, acquérir Fragment du Seuil | stages `descendre`, `couloir`, `varen`, `seuil` (`ouvrir`, `fragment`) |
| C01 Éveil (≤ 20 s) | `cinematics/C01_eveil.cinematic.json` (15 s) |
| C02 Rang 1 (≤ 12 s) | `C02_rang1` (12 s) |
| C03 Révélation du registre (≤ 15 s) | `C03_registre` (14 s) |
| C04 Porte Absente (verrous, confrontation, lumière, coupe, 35–60 s) | split: rule `portes_claquent` (doors closing, `absente.logic.json`), dialogue `confrontation`, `C04b_porte` (22 s), `C04c_coupe` (5 s) |
| not in section 8 | `C_mere` (26 s, the mother refused at the house of care, act I), `C05_epilogue_ecoute` / `C05_epilogue_ouvre` (30 s each) |

The quest title is `door.quest.DOOR_Q01_EMPREINTE.title` = « Le prix d’une poignée ». The chain below is played end to end by `prologueAndActOne` in `civilizations/door/tests/door.playthrough.test.ts`.

### 10.2 How the quest starts

Rule `intro` plays `C01_eveil` on `civ.started` (§5.3); the cinematic's `onComplete` starts `DOOR_Q00_REVEIL`. That quest's first stage completes when the player leaves the cell (trigger `trig_cell_exit` completes `sortir`), and its last objective, `noe`, is completed by node `intro6` of Noé's dialogue:

```json
{
  "id": "intro6",
  "speaker": "noe",
  "text": "door.dlg.noe.intro6",
  "actions": [
    { "type": "core.completeObjective", "quest": "DOOR_Q00_REVEIL", "objective": "noe" },
    { "type": "core.moveEntity", "entity": "noe", "target": "marque_noe_cour", "wait": false }
  ],
  "end": true
}
```

and its `onComplete` starts the next quest:

```json
"onComplete": [
  { "type": "core.startQuest", "quest": "DOOR_Q01_EMPREINTE" }
]
```

The player sees « Nouvelle quête : Le prix d’une poignée ».

### 10.3 Stage `galerie`: a trigger and a dialogue line

```json
{
  "id": "galerie",
  "description": "door.quest.DOOR_Q01_EMPREINTE.galerie",
  "objectives": [
    { "id": "porte", "text": "door.quest.DOOR_Q01_EMPREINTE.galerie.porte", "target": "porte_galerie" },
    { "id": "mira", "text": "door.quest.DOOR_Q01_EMPREINTE.galerie.mira", "target": "mira" }
  ],
  "completion": "all"
}
```

Neither objective has a condition; both are completed by actions elsewhere:

- `porte`: the trigger `trig_porte_galerie` in `civilizations/door/content/scenes/verrou.scene.json`:

  ```json
  "core.trigger": {
    "size": [8, 3, 5],
    "once": true,
    "onEnter": [
      { "type": "core.completeObjective", "quest": "DOOR_Q01_EMPREINTE", "objective": "porte" }
    ]
  }
  ```

  It has no condition. If the player walks past the gate before `DOOR_Q01_EMPREINTE` starts, the objective is stored and kept when the quest starts (§4.4). Interacting with the gate itself is refused: it carries `door.lock` with `"variant": "rank", "rank": 1`, which vetoes the opening while `door.rank` is below 1.
- `mira`: node `intro4` of `mira.dialogue.json` (§3.6), reached the first time the player talks to Mira (`route` sends to `intro1` while `door.metMira` is not true). The line sets `door.metMira` and completes the objective before it is displayed.

When both are done, the stage completes and `pieces` becomes current.

### 10.4 Stage `pieces`: conditions on the inventory

```json
{
  "id": "ressort",
  "text": "door.quest.DOOR_Q01_EMPREINTE.pieces.ressort",
  "completeWhen": { "type": "core.hasItem", "item": "door:ressort", "count": 1 },
  "target": "ressort_cuivre"
}
```

`goupille` and `disque` have the same shape with `door:goupille` (target `puits`) and `door:disque` (target `caisse_noe`). Items obtained earlier count as soon as the stage is current (§4.4). The items come from scene entities:

- `ressort_cuivre`: `"core.pickup": { "item": "door:ressort", … }`.
- `puits`: a `core.interactable` with `"once": true` and the actions `core.playSound`, `core.wait` (1.2 s), `core.giveItem` `door:goupille`, `core.notify` `door.notify.well`.
- `caisse_noe`: a `core.pickup` of `door:disque` whose `condition` is `door.noeCrateTold == true` (`hideOnTake: false`), plus a `core.interactable` with the opposite condition that only says the crate is nailed shut. The variable is set by Noé's dialogue: its `route` node sends to `crate1` when

  ```json
  {
    "type": "core.all",
    "of": [
      { "type": "core.var", "var": "door.metMira", "op": "==", "value": true },
      { "type": "core.not", "condition": { "type": "core.var", "var": "door.noeCrateTold", "op": "==", "value": true } },
      { "type": "core.not", "condition": { "type": "door.rankAtLeast", "rank": 1 } }
    ]
  }
  ```

  and the answer `yes` leads to `crate2`:

  ```json
  {
    "id": "crate2",
    "speaker": "noe",
    "text": "door.dlg.noe.crate2",
    "actions": [
      { "type": "core.setVar", "var": "door.noeCrateTold", "value": true },
      { "type": "core.notify", "text": "door.notify.crateTold", "kind": "discovery" }
    ],
    "end": true
  }
  ```

Each pickup emits `item.acquired`; the quest evaluation that follows completes the matching objective (« Objectif accompli : … »).

### 10.5 Stage `empreinte`: a pack mechanic emits the event

```json
{
  "id": "empreinte",
  "description": "door.quest.DOOR_Q01_EMPREINTE.empreinte",
  "objectives": [
    {
      "id": "empreinte",
      "text": "door.quest.DOOR_Q01_EMPREINTE.empreinte.empreinte",
      "completeOn": { "event": "door.imprinted" },
      "target": "etabli_empreinte"
    }
  ],
  "completion": "all",
  "onComplete": [
    { "type": "core.playCinematic", "cinematic": "C02_rang1", "wait": false }
  ]
}
```

1. The bench `etabli_empreinte` is a `core.interactable` with `"condition": { "type": "door.imprintReady" }` (the three parts are in the inventory and the rank is below 1), `"hideIfUnavailable": false`, `"unavailableReason": "door.prompt.bench.missing"` and `"actions": [{ "type": "door.openImprint" }]`.
2. `door.openImprint` (`civilizations/door/mechanics/imprint.ts`) opens the three-dial panel `door.imprint` and waits. The solution comes from the mechanic settings in `civilizations/door/content/rules.json` (`"door.keyImprint": { "dial1": 2, "dial2": 0, "dial3": 4 }`), shown as a hint once the gate engraving was examined (`door.memory` on `porte_galerie`, `"examineVar": "door.gateEngravingSeen"`, key F). On success the action removes the parts and the rank 0 plaque, waits 1.1 s, gives `door:plaque_r1`, then:

   ```ts
   access(ctx).setRank(1);
   ctx.events.emit('door.imprinted', {});
   ```

3. `setRank(1)` writes `door.rank` and emits `door.rankChanged`. Rule `varen_au_registre` (`main.logic.json`, `once: true`, `if` rank ≥ 1 and scene `verrou`) moves Varen to his desk. Mira's `route` will now send to `rank1`, whose node `rank1b` starts `DOOR_Q02_ELIAS` if it is still inactive.
4. `door.imprinted` matches the objective's `completeOn`. The stage completes; the quest switches to `franchir` first, then runs the stage's `onComplete`, which starts `C02_rang1` without waiting.

### 10.6 The cinematic `C02_rang1`

12 s, with the tracks shown in §6.4: four camera keys, the first two facing the gallery gate (`porte_galerie`) and closing in until 4 s, then a cut at 4.6 s to a high viewpoint that travels until 11.5 s; two subtitles without speaker (`door.cin.c02.1` « La gravure dorée s’éclaire au contact de votre plaque. », `door.cin.c02.2`); the sound `core:unlock` at `porte_galerie` and a golden `flash` at 1.2 s; the music `door:music.galerie` at 4.6 s. `onComplete` switches to `door:music.faubourg`.

If the player skips it: subtitles, the sound and the flash are dropped; the `door:music.galerie` cue is still applied if not yet reached, then `onComplete` sets `door:music.faubourg`. The end state is the same as watching it, and the quest, already at `franchir`, is not affected. The cinematic hides the HUD for 12 s. The notifications raised just before it (item obtained, new rank, objective done) last 3.5 to 5 s, so a player who watches the whole cinematic does not see them (§12).

### 10.7 Stage `franchir` and the end of the quest

```json
{
  "id": "franchir",
  "description": "door.quest.DOOR_Q01_EMPREINTE.franchir",
  "objectives": [
    { "id": "franchir", "text": "door.quest.DOOR_Q01_EMPREINTE.franchir.franchir", "target": "porte_galerie" }
  ],
  "completion": "all"
}
```

With rank 1 the `door.lock` of `porte_galerie` lets the door open. In the gallery, the trigger `trig_arrivee_galerie` (`"once": true`) runs `core.completeObjective` `DOOR_Q01_EMPREINTE` / `franchir`. It is the last stage, so the quest completes (« Quête terminée : Le prix d’une poignée ») and its `onComplete` runs:

```json
"onComplete": [
  {
    "type": "core.if",
    "condition": { "type": "core.questStatus", "quest": "DOOR_Q02_ELIAS", "status": "inactive" },
    "then": [ { "type": "core.startQuest", "quest": "DOOR_Q02_ELIAS" } ],
    "else": []
  }
]
```

`DOOR_Q02_ELIAS` may already be active (Mira's `rank1b`, or the poster through `door.foundPoster`). The guard is defensive: `core.startQuest` on a quest that is not inactive does nothing.

### 10.8 The whole chain

```
civ.started ──rule intro──▶ C01_eveil ──onComplete──▶ start DOOR_Q00_REVEIL
  trigger trig_cell_exit ─▶ Q00/sortir      dialogue noe/intro6 ─▶ Q00/noe
  Q00 complete ──onComplete──▶ start DOOR_Q01_EMPREINTE
galerie   trigger trig_porte_galerie ─▶ porte  (kept if entered before the start)
          dialogue mira/intro4      ─▶ mira   (+ door.metMira = true)
pieces    completeWhen core.hasItem × 3 ◀─ pickup ressort_cuivre, interactable puits,
                                            pickup caisse_noe (needs door.noeCrateTold from noe/crate2)
empreinte interactable etabli_empreinte ─▶ door.openImprint ─▶ door.rankChanged (rule varen_au_registre)
                                                           └─▶ door.imprinted ─▶ completeOn
          stage switches to franchir, then onComplete ─▶ C02_rang1 (wait: false)
franchir  door.lock (rank 1) opens porte_galerie; trigger trig_arrivee_galerie ─▶ franchir
          Q01 complete ──onComplete──▶ start DOOR_Q02_ELIAS (if inactive)
```

---

## 11. Checking and testing story content

**Validation** — `npm run validate` (`tools/cli/civ.ts validate`) or « ✔ Valider » in the Studio (`src/studio/core/validation.ts`, on the working copies) run `validateCivilization` (`src/engine/core/packs/validate.ts`): the civilization is booted headless, then every file is checked against the live registries. For story content it reports:

- schema errors (from loading);
- dialogues: unknown `start`, `next`, branch or choice target; unknown speaker; missing text keys; unknown condition or action types and invalid references in their properties; a node with no text, no continuation and no `end` (warning);
- quests: missing text keys; unknown stage `next`; unknown `target` entity or `targetScene`; undocumented `startOn` / `completeOn` events (warning); an objective with neither `completeWhen` nor `completeOn` that no `core.completeObjective` references (warning);
- cinematics: subtitle texts and speakers, actor entities and `moveTo` targets, `say` keys, sounds, music, `at` entities, camera `lookAt` entities, action lists;
- rules: undocumented `when.event` (warning), unknown `scene`, conditions and actions;
- variables: names outside `<civId>.` (error, reads included) and writes to `global.*` (error);
- references of every property: entities (an entity of another scene is a warning in scene components), items, dialogues, quests, cinematics, scenes, spawns, sounds, music, models, characters, blocks, panels, abilities.

It does not check that the `objective`, `stage`, `node` or `choice` strings of `core.completeObjective`, `core.setQuestStage`, `core.questStage`, `core.objectiveDone`, `core.dialogueSeen` and `core.choiceMade` exist in the referenced document, nor `globalWrites`, `fx` names, property names, or the order of timeline items (§12).

**Tests** — `npm test` runs Vitest on `src`, `civilizations`, `tests/unit`, `tests/acceptance` and `tools`. Story playthroughs use the headless helpers of `src/engine/core/testing/headless.ts` (`createHeadlessGame`, `advance`, `walkTo` with real path-finding, `talk`, `choose`, `advanceDialogue`, `skipCinematics`): see `civilizations/door/tests/door.playthrough.test.ts`, `civilizations/memory/tests/memory.playthrough.test.ts` and `tests/acceptance/D-story-progression.test.ts`. `tests/acceptance/J-regression.test.ts` requires both packs to validate without errors or warnings; `tests/acceptance/localization.test.ts` checks the French tables (§8.2).

**In game** — F3 shows active quests and stages, variables and recent errors (§7.3).

---

## 12. Limitations

Verified gaps between the formats, the runtime and the Studio:

1. **Objective markers.** `target` and `targetScene` are validated and exposed in `QuestObjectiveView`, but nothing renders them; the setting `showMarkers` (« Afficher les repères d’objectif ») is stored and not used.
2. **Timeline order.** Items of `subtitle`, `audio`, `fx` and `actions` tracks must be sorted by `t` (§6.2). The Studio sorts camera and actor keys when they are dragged, but not the items of the other tracks, and « ＋ Ajouter… » appends the new item at the end of its track. Validation does not check the order.
3. **« Essentielle » checkbox.** At run time, only an `actions` item with `"essential": false` is dropped on skip; an item without the field runs. The Studio checkbox writes `true` or removes the field, so it cannot produce `false`, and the settings help (« Les actions marquées « essentielles » et les actions de fin s’exécutent même si le joueur passe la cinématique. ») suggests that unmarked items are dropped.
4. **Skip hint.** The cinematic overlay shows « Maintenir pour passer » (`ui.cinematic.skip`), but a single press of the `skip` key skips: `GameView.handleInput` (`src/engine/view/gameView.ts`) calls `skip()` on `consume('skip')`, which reports one key press.
5. **`lockPlayer: false`.** `GameView.handleInput` ignores movement and mouse look during any cinematic, so the player cannot move even when the flag is false.
6. **`hideHud` hides barks and notifications.** Actor `say` keys and `core.say` bubbles are not displayed during a `hideHud` cinematic, and notifications expire on their own timer (3.5 s by default) while hidden.
7. **Aborted cinematics.** A scene change or unload during a cinematic drops its remaining items, its `onComplete` and `cinematic.ended`.
8. **Camera `fov`.** A camera key without `fov` inherits the previous key's value while the camera moves towards it, but uses 70 while the camera rests on it (`evaluateCameraTrack`), which produces jumps such as the one at 4 s in `C02_rang1` (§6.3).
9. **Cinematic editor coverage.** No fields for actor `teleport`, `yaw`, `visible`, `speed` or position targets, audio `music: null` (stop) or `volume`, the `fov` and `vignette` effects, or `tint` strength. Unknown `fx` names are ignored without a message.
10. **Dialogue editor.** No fields for the dialogue `title` and `speakers` map; the « Locuteur » list only offers NPCs of the scene currently open; « Mène à » always writes an explicit `next`, so the fallback of a choice without `next` is JSON-only; nodes created by the editor keep `end: true` when branches are added (§3.7).
11. **Renaming.** Renaming a node, choice, stage or objective id in the Studio updates references inside the same document only. References from other files (`core.completeObjective`, `core.setQuestStage`, `core.dialogueSeen`, `core.choiceMade`…) are not updated and not validated; at run time `core.completeObjective` and `core.setQuestStage` log `Objectif inconnu` / `Étape inconnue`, and the conditions are simply false.
12. **Quests.** `core.setQuestStage` does not complete a stage whose objectives were all completed ahead of time; a stage without objectives never completes by itself; `completeOn` cannot record events that happen before its stage is current. The Quest editor has no field for stage `next`. In the journal, a completed quest no longer shows its last stage description (the history omits its last entry and the current-stage text is shown for active quests only).
13. **Speakers.** Speaker names come from entities of the current scene; an absent entity shows its raw id. Validation accepts `$self` as a node speaker, but speakers are not resolved as references, so the plate would show `$self`.
14. **References.** `$self`, `$player` and `$event.*` are resolved in top-level properties only; `$self` is empty in rules, quests and cinematics.
15. **Events in the Studio.** The event picker only lists documented events (`defineEvent`). Engine events that are emitted but not documented (`civ.unloading`, `scene.exiting`, `player.jumped`, `save.completed`, `ui.panelOpened`, `ui.panelClosed`), custom events sent with `core.emit`, the `"*"` wildcard and filters on undocumented payload fields are JSON-only, and validation warns about undocumented events.
16. **Global writes.** `globalWrites` permissions are only checked at run time, when `core.grantFragment` or `core.setGlobalFlag` throws; nothing checks that a granted fragment is declared in the manifest's `fragments`.
17. **Typos in properties.** Unknown property names in conditions and actions are ignored by both the interpreter and the validator.
18. **Traces and notes.** The interpreter's execution trace is not displayed anywhere, despite the module comment; the action `note` field is kept by the Studio but not shown, although `src/engine/core/logic/types.ts` says it is.
19. **Playtest state.** Playtests always start from a fresh local state, and « Jouer ici » skips `civ.started`; there is no Studio control to preset variables or quest stages before a test.
20. **Typography.** No-break spaces are not inserted automatically, neither by the Studio nor at run time. The subtitle overlay and the Studio preview join speaker and text with plain spaces (`Name : text`, in `src/game/hud/Cinematic.tsx` and `CinematicEditor.tsx`).
21. **Variable types.** Content cannot declare variable types or defaults; only pack code can (`ctx.vars.declare`).
22. **Content migrations.** The header of `src/engine/core/content/schemas.ts` mentions `content/migrations.ts`, which does not exist; story files have no migration path yet beyond `"version": 1`.

---

## Appendix A — Core actions

Generated from `src/engine/core/logic/coreActions.ts`. Labels are the French names shown in the Studio pickers. Property kinds: `text` = localization key, `ref:<kind>` = reference to a document, entity, asset or variable, `json` = any JSON value, `list of …`, enumerations as `a | b`. Defaults are shown when not empty. `essential: false` actions are skipped while a cinematic is being skipped (§6.5).

| Id | Studio label | Category | Properties (kind, default) | Notes |
|---|---|---|---|---|
| `core.setVar` | Définir une variable | Variables | `var` (ref:variable)<br>`value` (json, default `true`) |  |
| `core.addVar` | Ajouter à une variable | Variables | `var` (ref:variable)<br>`amount` (number, default `1`) |  |
| `core.toggleVar` | Inverser une variable | Variables | `var` (ref:variable) |  |
| `core.wait` | Attendre | Déroulement | `seconds` (number, default `1`) | `essential: false` |
| `core.if` | Si… alors… sinon | Déroulement | `condition` (condition)<br>`then` (actions)<br>`else` (actions) |  |
| `core.parallel` | En parallèle | Déroulement | `branches` (list of actions) |  |
| `core.emit` | Émettre un événement | Déroulement | `event` (ref:event)<br>`payload` (json, default `{}`) |  |
| `core.log` | Journal de débogage | Déroulement | `message` (string) | `essential: false` |
| `core.notify` | Afficher une notification | Interface | `text` (text)<br>`kind` (info \| success \| warning \| denied \| quest \| item \| memory \| discovery, default `"info"`) |  |
| `core.showLocation` | Afficher un titre de lieu | Interface | `title` (text)<br>`subtitle` (text) | `essential: false` |
| `core.showDocument` | Afficher un document | Interface | `title` (text)<br>`pages` (list of text)<br>`style` (paper \| register \| poster \| letter \| plaque \| book, default `"paper"`) | waits until closed |
| `core.openPanel` | Ouvrir un panneau | Interface | `panel` (ref:panel)<br>`wait` (boolean, default `true`) |  |
| `core.showEndScreen` | Écran de fin | Interface | `title` (text)<br>`subtitle` (text)<br>`lines` (list of text) | waits until closed |
| `core.setHudVisible` | Afficher/masquer un élément d'interface | Interface | `element` (crosshair \| prompt \| objectives \| notifications \| inventory \| abilities \| location, default `"objectives"`)<br>`visible` (boolean, default `true`) | restored when the civilization unloads |
| `core.giveItem` | Donner un objet | Inventaire | `item` (ref:item)<br>`count` (integer, default `1`)<br>`silent` (boolean, default `false`) |  |
| `core.takeItem` | Retirer un objet | Inventaire | `item` (ref:item)<br>`count` (integer, default `1`)<br>`silent` (boolean, default `false`) |  |
| `core.startDialogue` | Lancer un dialogue | Narration | `dialogue` (ref:dialogue)<br>`entity` (ref:entity)<br>`wait` (boolean, default `false`) |  |
| `core.startQuest` | Démarrer une quête | Narration | `quest` (ref:quest) | no effect unless inactive |
| `core.setQuestStage` | Changer d'étape de quête | Narration | `quest` (ref:quest)<br>`stage` (string) | starts an inactive quest first |
| `core.completeObjective` | Accomplir un objectif | Narration | `quest` (ref:quest)<br>`objective` (string) | §4.4 |
| `core.completeQuest` | Terminer une quête | Narration | `quest` (ref:quest) |  |
| `core.failQuest` | Faire échouer une quête | Narration | `quest` (ref:quest) | active quests only |
| `core.trackQuest` | Suivre une quête | Narration | `quest` (ref:quest) | empty = nothing tracked |
| `core.playCinematic` | Jouer une cinématique | Narration | `cinematic` (ref:cinematic)<br>`wait` (boolean, default `true`) |  |
| `core.setPlayerTitle` | Changer le nom du protagoniste (local) | Narration | `title` (text) |  |
| `core.setVisible` | Afficher/masquer une entité | Entités | `entity` (ref:entity)<br>`visible` (boolean, default `true`) |  |
| `core.setEnabled` | Activer/désactiver une entité | Entités | `entity` (ref:entity)<br>`enabled` (boolean, default `true`) |  |
| `core.setProp` | Modifier une propriété d'entité | Entités | `entity` (ref:entity)<br>`component` (string)<br>`prop` (string)<br>`value` (json) | saved as an override |
| `core.moveEntity` | Déplacer un personnage | Entités | `entity` (ref:entity)<br>`target` (ref:entity)<br>`position` (vec3, default `[0,0,0]`)<br>`run` (boolean, default `false`)<br>`wait` (boolean, default `true`) | teleports when skipping |
| `core.teleportEntity` | Téléporter une entité | Entités | `entity` (ref:entity)<br>`target` (ref:entity)<br>`position` (vec3, default `[0,0,0]`)<br>`yaw` (number, default `0`) | a marker target also gives the yaw |
| `core.lookAt` | Faire regarder | Entités | `entity` (ref:entity)<br>`target` (ref:entity) | `essential: false`; empty target = nobody |
| `core.playAnimation` | Jouer une animation | Entités | `entity` (ref:entity)<br>`animation` (idle \| wave \| talk \| point \| nod \| shake \| kneel \| interact \| cross \| surprised \| sad \| bow, default `"wave"`)<br>`loop` (boolean, default `false`) | `essential: false` |
| `core.setExpression` | Changer une expression | Entités | `entity` (ref:entity)<br>`expression` (neutral \| happy \| sad \| angry \| surprised \| worried \| determined, default `"neutral"`) |  |
| `core.say` | Réplique au-dessus du personnage | Entités | `entity` (ref:entity)<br>`text` (text)<br>`seconds` (number, default `3.5`) | `essential: false` |
| `core.openDoor` | Ouvrir une porte | Entités | `entity` (ref:entity)<br>`silent` (boolean, default `false`) | entity with `core.door` |
| `core.closeDoor` | Fermer une porte | Entités | `entity` (ref:entity)<br>`silent` (boolean, default `false`) | entity with `core.door` |
| `core.teleportPlayer` | Téléporter le joueur | Joueur | `spawn` (ref:spawn) |  |
| `core.changeScene` | Changer de scène | Joueur | `scene` (ref:scene)<br>`spawn` (string) | aborts a running cinematic (§6.5) |
| `core.lockPlayer` | Bloquer le joueur un instant | Joueur | `seconds` (number, default `1`) | `essential: false` |
| `core.setBlocks` | Modifier des blocs (passage, effondrement…) | Monde | `from` (vec3, default `[0,0,0]`)<br>`to` (vec3, default `[0,0,0]`)<br>`block` (ref:block) | empty block = air; 4096 blocks maximum |
| `core.grantAbility` | Accorder une capacité | Joueur | `ability` (ref:ability) |  |
| `core.revokeAbility` | Retirer une capacité | Joueur | `ability` (ref:ability) |  |
| `core.grantFragment` | Accorder un fragment multivers | Multivers | `fragment` (string) | needs `globalWrites` |
| `core.setGlobalFlag` | Définir un indicateur global | Multivers | `flag` (string)<br>`value` (json, default `true`) | needs `globalWrites` |
| `core.finishCivilization` | Terminer la civilisation (retour à la sélection) | Multivers | — | emits `civ.finished` |
| `core.markCivCompleted` | Marquer la civilisation terminée | Multivers | — |  |
| `core.playSound` | Jouer un son | Audio et effets | `sound` (ref:sound)<br>`at` (ref:entity)<br>`volume` (number, default `1`) | `essential: false` |
| `core.music` | Changer la musique | Audio et effets | `music` (ref:music)<br>`fade` (number, default `2`) | empty = silence |
| `core.ambience` | Changer l'ambiance sonore | Audio et effets | `ambience` (ref:sound)<br>`fade` (number, default `2`) | empty = silence |
| `core.fade` | Fondu à l'écran | Audio et effets | `opacity` (number, default `1`)<br>`seconds` (number, default `1`)<br>`color` (color, default `"#000000"`)<br>`wait` (boolean, default `true`) | instant when skipping |
| `core.flash` | Éclair à l’écran | Audio et effets | `color` (color, default `"#ffffff"`)<br>`seconds` (number, default `0.6`) | `essential: false` |
| `core.shake` | Secousse de caméra | Audio et effets | `intensity` (number, default `0.3`)<br>`seconds` (number, default `0.8`) | `essential: false` |
| `core.environment` | Changer l'environnement (ciel, brouillard...) | Audio et effets | `patch` (json, default `{}`)<br>`seconds` (number, default `2`) |  |
| `core.fx` | Effet de présentation (pack) | Audio et effets | `channel` (string)<br>`payload` (json, default `{}`) | `essential: false`; handled by a pack `viewEffect` |

## Appendix B — Core conditions

Generated from `src/engine/core/logic/coreConditions.ts`.

| Id | Studio label | Category | Properties (kind, default) |
|---|---|---|---|
| `core.always` | Toujours vrai | Logique | — |
| `core.all` | Toutes les conditions (ET) | Logique | `of` (list of condition) |
| `core.any` | Au moins une condition (OU) | Logique | `of` (list of condition) |
| `core.not` | Négation (NON) | Logique | `condition` (condition) |
| `core.random` | Hasard | Logique | `chance` (number, default `0.5`) |
| `core.var` | Comparer une variable | Variables | `var` (ref:variable)<br>`op` (== \| != \| > \| >= \| < \| <= \| exists \| missing \| contains, default `"=="`)<br>`value` (json, default `true`) |
| `core.hasItem` | Possède un objet | Inventaire | `item` (ref:item)<br>`count` (integer, default `1`) |
| `core.questStatus` | État d'une quête | Narration | `quest` (ref:quest)<br>`status` (inactive \| active \| completed \| failed, default `"active"`) |
| `core.questStage` | Étape de quête | Narration | `quest` (ref:quest)<br>`stage` (string) — true only while the quest is active |
| `core.objectiveDone` | Objectif accompli | Narration | `quest` (ref:quest)<br>`objective` (string) — any stage |
| `core.dialogueSeen` | Réplique déjà vue | Narration | `dialogue` (ref:dialogue)<br>`node` (string) — empty = any node |
| `core.choiceMade` | Choix de dialogue fait | Narration | `dialogue` (ref:dialogue)<br>`choice` (string) |
| `core.inScene` | Dans la scène | Monde | `scene` (ref:scene) |
| `core.entityVisible` | Entité visible | Monde | `entity` (ref:entity) |
| `core.doorOpen` | Porte ouverte | Monde | `entity` (ref:entity) |
| `core.playerNear` | Joueur à proximité | Monde | `entity` (ref:entity)<br>`distance` (number, default `3`) |
| `core.hasAbility` | Possède une capacité | Joueur | `ability` (ref:ability) |
| `core.hasFragment` | Fragment multivers possédé | Multivers | `fragment` (string) |
| `core.globalFlag` | Indicateur global | Multivers | `flag` (string)<br>`op` (same operators, default `"exists"`)<br>`value` (json, default `true`) |
| `core.civCompleted` | Civilisation terminée | Multivers | `civ` (string) |

## Appendix C — Events

Documented engine events, generated from `src/engine/core/logic/coreEvents.ts` (payload types in `src/engine/core/events/eventMap.ts`). "Fields" are the documented ones, offered as Studio filters; extra payload fields are listed under "Emitted by".

| Id | Studio label | Fields | Emitted by |
|---|---|---|---|
| `civ.started` | Civilisation démarrée | `civId` | `GameSession.loadCivilization`, at every load (not with `quietStart`) |
| `civ.finished` | Civilisation terminée | `civId` | `core.finishCivilization` |
| `scene.entered` | Entrée dans une scène | `sceneId` | `GameSession.enterScene`, every entry |
| `zone.entered` | Entrée dans une zone | `zoneId` | `core.zone` (also `name`) |
| `zone.exited` | Sortie d'une zone | `zoneId` | `core.zone` |
| `trigger.entered` | Déclencheur atteint | `triggerId` | `core.trigger`, when its condition passes |
| `trigger.exited` | Déclencheur quitté | `triggerId` | `core.trigger` |
| `entity.interacted` | Interaction avec une entité | `entityId`, `interaction` | `InteractionSystem` after a successful interaction; `interaction` is the offer id (`talk`, `use`, `take`, `read`, `open`, `close`, `enter`, pack ids such as `examine`) |
| `interaction.blocked` | Interaction refusée | `entityId`, `interaction`, `by` | `InteractionSystem` when an offer is disabled or vetoed (also `reason`) |
| `door.opened` | Porte ouverte | `entityId` | `core.door` |
| `door.closed` | Porte fermée | `entityId` | `core.door` |
| `item.acquired` | Objet obtenu | `itemId` | inventory (also `count`, `total`) |
| `item.removed` | Objet retiré | `itemId` | inventory (also `count`, `total`) |
| `item.used` | Objet utilisé | `itemId`, `action` | an item action used from the inventory (actions of `content/items.json` or of a `defineItem`) |
| `var.changed` | Variable modifiée | `name` | `VariableStore` (also `value`, `previous`) |
| `dialogue.started` | Dialogue commencé | `dialogueId` | `DialogueSystem` (also `entityId`) |
| `dialogue.node` | Réplique affichée | `dialogueId`, `nodeId` | `DialogueSystem`, every node entered, routing nodes included |
| `dialogue.choice` | Choix de dialogue | `dialogueId`, `choiceId` | `DialogueSystem` (also `nodeId`) |
| `dialogue.ended` | Dialogue terminé | `dialogueId`, `lastNode` | `DialogueSystem` |
| `quest.started` | Quête commencée | `questId` | `QuestSystem` |
| `quest.stageChanged` | Étape de quête atteinte | `questId`, `stageId` | `QuestSystem` (also `previous`) |
| `quest.objectiveCompleted` | Objectif accompli | `questId`, `objectiveId` | `QuestSystem` |
| `quest.completed` | Quête terminée | `questId` | `QuestSystem` |
| `quest.failed` | Quête échouée | `questId` | `QuestSystem` |
| `cinematic.started` | Cinématique commencée | `cinematicId` | `CinematicSystem` |
| `cinematic.ended` | Cinématique terminée | `cinematicId`, `skipped` | `CinematicSystem`, after `onComplete`; not on abort |
| `npc.arrived` | Personnage arrivé | `entityId` | any completed `moveTo` of an entity, scripted or autonomous |
| `ability.used` | Capacité utilisée | `abilityId` | `GameSession.activateAbility` |
| `multiverse.fragmentAcquired` | Fragment multivers obtenu | `fragmentId` | first grant of a fragment (also `civId`) |
| `player.landed` | Atterrissage du joueur | `fallSpeed` | `GameSession.update` |

Emitted but not documented (usable in JSON only, validation warns): `civ.unloading` and `scene.exiting` (`GameSession`), `player.jumped` (`GameSession.update`), `save.completed` (`src/game/controller.ts`), `ui.panelOpened` and `ui.panelClosed` (`GameSession.openPanel` / `closePanel`; quests ignore `ui.*` events).

## Appendix D — Door and Memory building blocks

Generated from `civilizations/door/mechanics/*.ts` and `civilizations/memory/mechanics/*.ts`. They are registered only while their civilization is loaded.

### Door actions

| Id | Studio label | Category | Properties (kind, default) | Defined in |
|---|---|---|---|---|
| `door.setRank` | Définir le rang du joueur | Verrou | `rank` (integer, default `0`)<br>`temporary` (boolean, default `false`)<br>`silent` (boolean, default `false`) | `access.ts` |
| `door.openImprint` | Ouvrir l'établi d'empreinte (trois cadrans) | Verrou | — | `imprint.ts` |
| `door.addEvidence` | Recueillir une preuve (piste d’Elias) | Verrou | `evidence` (ordre \| plaque, default `"ordre"`) | `story.ts` |
| `door.foundPoster` | Découvrir l'affiche d'Elias | Verrou | — (also starts `DOOR_Q02_ELIAS` if inactive) | `story.ts` |

### Door conditions

| Id | Studio label | Category | Properties | Defined in |
|---|---|---|---|---|
| `door.rankAtLeast` | Le joueur a au moins le rang | Verrou | `rank` (integer, default `1`) | `access.ts` |
| `door.imprintReady` | Les trois pièces de l'empreinte sont réunies | Verrou | — (the three parts are owned and the rank is below 1) | `imprint.ts` |

### Door events

| Id | Studio label | Fields | Emitted in |
|---|---|---|---|
| `door.rankChanged` | Rang modifié | `rank`, `previous`, `temporary` | `access.ts` |
| `door.accessDenied` | Accès refusé par une serrure de rang | `entityId`, `required` | `access.ts` (called by `door.lock`) |
| `door.touched` | Porte touchée (mémoire) | `entityId`, `count` | `doorMemory.ts` |
| `door.imprinted` | Plaque de Porteur empreinte | — | `imprint.ts` |
| `door.evidenceFound` | Preuve recueillie | `evidence`, `count` | `story.ts` |
| `door.palmAwakened` | La marque de la paume s’éveille | `entityId` | `locks.ts` |
| `door.caught` | Joueur surpris par un garde | `guardId`, `count` | `suspicion.ts` |

### Memory actions

| Id | Studio label | Category | Properties (kind, default) | Defined in |
|---|---|---|---|---|
| `memory.giveShard` | Donner un éclat au protagoniste | Mémoire | `shard` (string)<br>`silent` (boolean, default `false`) | `chamber.ts` |
| `memory.anchorShard` | Ancrer un éclat (emplacement libre) | Mémoire | `shard` (string) | `chamber.ts` |
| `memory.removeShard` | Retirer un éclat de son emplacement | Mémoire | `shard` (string) | `chamber.ts` |
| `memory.examineShard` | Examiner un éclat (entendre ce qu’il contient) | Mémoire | `shard` (string) | `chamber.ts` |
| `memory.openChamber` | Ouvrir la chambre mnésique | Mémoire | — | `chamber.ts` |
| `memory.restore` | Restaurer un souvenir chez quelqu’un (avec son consentement) | Mémoire | `shard` (string)<br>`to` (ref:entity)<br>`consent` (ref:variable)<br>`refused` (text, default `"memory.notify.noConsent"`) | `consent.ts` (does nothing but notify unless the consent variable is `"accepte"`) |
| `memory.trade` | Céder un souvenir en échange de quelque chose | Mémoire | `shard` (string)<br>`to` (text)<br>`then` (actions) | `consent.ts` |
| `memory.playEcho` | Jouer un écho | Mémoire | `echo` (string)<br>`wait` (boolean, default `false`) | `echo.ts`; `essential: false` |

### Memory conditions

| Id | Studio label | Category | Properties | Defined in |
|---|---|---|---|---|
| `memory.anchored` | Un éclat est ancré dans un emplacement | Mémoire | `shard` (string) | `chamber.ts` |
| `memory.shardState` | État d'un éclat | Mémoire | `shard` (string)<br>`state` (aucun \| possede \| cede \| restaure, default `"possede"`) | `chamber.ts` |
| `memory.consented` | La personne a consenti à la restauration | Mémoire | `consent` (ref:variable) — true when the variable is `"accepte"` | `consent.ts` |

### Memory events

| Id | Studio label | Fields | Emitted in |
|---|---|---|---|
| `memory.shardAcquired` | Éclat obtenu | `shardId` | `chamber.ts` |
| `memory.anchored` | Éclat ancré | `shardId`, `slot` | `chamber.ts` (an event; `memory.anchored` is also a condition id) |
| `memory.removed` | Éclat retiré | `shardId`, `slot` | `chamber.ts` |
| `memory.examined` | Éclat examiné | `shardId` | `chamber.ts` |
| `memory.shardCeded` | Éclat cédé | `shardId`, `to` | `chamber.ts` |
| `memory.shardRestored` | Éclat restauré | `shardId`, `to` | `chamber.ts` |
| `memory.restorationRefused` | Restauration refusée (pas de consentement) | `shardId`, `to` | `consent.ts` |
| `memory.echoStarted` | Écho commencé | `echoId` | `echo.ts` |
| `memory.echoPlayed` | Écho terminé | `echoId` | `echo.ts` |
| `memory.puzzleSolved` | Énigme des trois objets résolue | `attempts` | `garden.ts` |
| `memory.puzzleFailed` | Mauvais ordre des objets | `attempts` | `garden.ts` |
| `memory.objectPlaced` | Objet déposé | `pedestalId`, `itemId` | `garden.ts` |
| `memory.objectTaken` | Objet repris | `pedestalId`, `itemId` | `garden.ts` |
| `memory.perceptionChanged` | Perception modifiée par un éclat | `entityId`, `active` | `recollection.ts` |
| `memory.recognitionChanged` | Reconnaissance modifiée | `entityId`, `level` | `recollection.ts` |
