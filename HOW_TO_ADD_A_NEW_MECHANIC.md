# How to add a new mechanic

This guide walks through adding a game mechanic that CIVILIZATIONVERSE does not support yet, using
only the public SDK, and through extending the engine when the SDK is really not enough. It uses
the code of the two playable packs as worked examples: `civilizations/door` (« La Porte qui
n'existe pas ») and `civilizations/memory` (« Le Nom qu'on t'a volé »).

The API reference is [`docs/MECHANICS_SDK.md`](docs/MECHANICS_SDK.md); this guide links to its
sections instead of repeating them.

Requirements: Node.js 22.12 or later (`package.json` `engines`), dependencies installed with
`npm install`.

Steps

1. [Decide: behavior, mechanic, action, condition](#step-1--decide-what-kind-of-definition-you-need)
2. [Create the file](#step-2--create-the-file)
3. [Write it with the SDK (Door and Memory examples)](#step-3--write-it-with-the-sdk)
4. [Add the French texts](#step-4--add-the-french-texts)
5. [Attach it to entities and content](#step-5--attach-it-to-entities-and-content)
6. [Put its settings in `rules.json`](#step-6--put-its-settings-in-contentrulesjson)
7. [Add a HUD element, a panel or a visual if needed](#step-7--add-a-hud-element-a-panel-or-a-visual-if-needed)
8. [Test it headlessly](#step-8--test-it-headlessly-with-vitest)
9. [Validate and type-check](#step-9--validate-and-type-check)
10. [When the engine lacks a capability](#step-10--when-the-engine-lacks-a-capability)

[Checklist](#checklist)

---

## Step 1 — Decide what kind of definition you need

| You need | Use | Examples |
|---|---|---|
| A rule of the world that exists once while the civilization runs: its own state, an API used by other code, key bindings, reactions to events | `defineMechanic` | `door.access`, `door.keyImprint`, `memory.chamber`, `memory.echoes` |
| Something attached to entities placed in scenes: an interaction the player can aim at, a veto on another component, per-entity state or per-frame logic | `defineBehavior` (an entity component) | `door.lock`, `door.watcher`, `memory.echoPoint`, `memory.pedestal` |
| A step that content runs (rules, dialogues, quests, cinematics, items, component props of kind `actions`) | `defineAction` | `door.setRank`, `door.openImprint`, `memory.giveShard`, `memory.playEcho` |
| A test that content uses (rule `if`, dialogue branches and choices, quest conditions, `core.conditional`, locks) | `defineCondition` | `door.rankAtLeast`, `door.imprintReady`, `memory.anchored`, `memory.consented` |
| Something content reacts to (rule `when`, objective `completeOn`) | `ctx.events.emit(...)` plus `defineEvent` to document it | `door.imprinted`, `door.rankChanged`, `memory.examined` |
| Interface on top of the game, or a modal screen | `defineHud`, `definePanel` (`@sdk/ui`) | `door.rankPlaque`, `door.imprint`, `memory.chamber` |
| 3D presentation the simulation does not need | `defineVisual`, `defineViewEffect` (`@sdk/view`) | `door.spinnerVisual`, `memory.echoEffect` |

Questions that settle the choice:

- **Once, or per entity?** A mechanic has no entity and is never attached to anything: it runs for
  the whole civilization (only the civilization pack's own mechanics run, see
  [MECHANICS_SDK §2](docs/MECHANICS_SDK.md#2-discovery-and-registration-of-pack-code)). Per-entity
  behavior is a component.
- **Must designers trigger or test it from content?** Then expose actions and conditions that call
  the mechanic's API, and emit documented events.
- **Must content read a value?** Store it in a declared story variable (`ctx.vars.declare`), as
  `door.access` does for `door.rank`, or provide a condition.
- **Does it need designer-edited data?** Per entity: behavior `props` (scene files). Global:
  mechanic `settings` (`content/rules.json`).

Most features combine several kinds. Door's rank system is the `door.access` mechanic, the
`door.setRank` action, the `door.rankAtLeast` condition, the `door.rankChanged` and
`door.accessDenied` events, the `door.lock` behavior, the `door.rankPlaque` and `door.accessDenied`
HUD elements and the `door.permissions` panel.

---

## Step 2 — Create the file

### By hand

Create a TypeScript module in `civilizations/<pack>/mechanics/`, for example
`civilizations/<pack>/mechanics/<name>.ts`. Every module of that folder is discovered by the glob of
the pack's `pack.ts`; nothing else needs editing.

From `civilizations/memory/pack.ts`:

```ts
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
```

- Export each definition as a named export of the module (arrays of definitions are accepted). The
  loader collects every exported value that has `__kind` and `id`.
- One module per feature works well: `civilizations/door/mechanics/imprint.ts` holds a mechanic, a
  condition, an action and an event; `civilizations/memory/mechanics/echo.ts` a mechanic, an action,
  a behavior and two events.
- React components go in `ui/*.tsx`, rendering code in `view/*.ts`. Check that your pack's glob
  includes these folders: the `pack.ts` generated by `npm run civ -- new-pack <id>`
  (`tools/cli/newPack.ts`) has no `./view/**/*.ts` entry.

### With Civilization Studio « Nouveau script » (development only)

`npm run dev` serves the game and `studio.html` (`vite.config.ts`). In the Studio's explorer, the
« Scripts » group has a ＋ button titled « Nouveau script ». The dialog asks for a type
(« Comportement (composant d’entité) », « Action de logique », « Condition de logique »,
« Mécanique (règle du monde) ») and a name. The dev server route `scaffold`
(`tools/vite/civDevPlugin.ts`) calls `scaffoldScript` in `tools/vite/scaffold.ts`:

- The file is `civilizations/<pack>/mechanics/<camelName>.ts`, the id `<pack>.<camelName>` and the
  export `<camelName>`. `toCamelIdentifier` removes accents and joins the words in camelCase
  (« Porte à résonance » gives `porteAResonance`).
- Creation is refused when the pack has no `pack.ts` or when the file already exists.
- The file is written immediately and opened in the script editor, which shows type errors from the
  project's TypeScript configuration. When a pack script is created or changed, the Studio reloads
  the pack's code (`reloadPackCode` in `src/studio/core/studio.ts`), so the new definition appears in
  its menus.
- Templates: the behavior declares `prompt`, `message`, `actions` and `size` props, creates a
  pickable collider and runs its actions on interaction; the action shows a `message` text; the
  condition compares a variable with a minimum; the mechanic counts `entity.interacted` events in
  its state.

The mechanic template, from `tools/vite/scaffold.ts`:

```ts
  setup(ctx, state) {
    ctx.events.on('entity.interacted', () => {
      state.activations += 1;
    });
    return {
      get activations() {
        return state.activations;
      },
    };
  },
```

---

## Step 3 — Write it with the SDK

Pack code imports `@sdk`, `@sdk/ui` and `@sdk/view` (plus relative modules of the same pack and
`react` in UI files). ESLint rejects imports of engine internals from pack code
([MECHANICS_SDK §1](docs/MECHANICS_SDK.md#1-modules-and-import-rules)).

### 3.1 Door: the key imprint (`civilizations/door/mechanics/imprint.ts`)

Mira's workbench: the player gathers three parts, aligns three dials in a panel and obtains the
rank 1 plaque. Four definitions and one panel make it.

**The mechanic** keeps the attempt counter in its saved `state`, reads the solution from its
`settings` (values in `content/rules.json`) and returns an API:

```ts
export const keyImprint = defineMechanic({
  id: 'door.keyImprint',
  label: "Empreinte de clé (trois cadrans)",
  description: 'Mini-jeu de l’établi de Mira : aligner trois cadrans sur la gravure de la porte de la Galerie.',
  state: { version: 1, initial: () => ({ attempts: 0, done: false }) },
  settings: {
    dial1: prop.integer({ label: 'Cadran 1 (index du symbole)', default: 0, min: 0, max: 5 }),
    dial2: prop.integer({ label: 'Cadran 2 (index du symbole)', default: 1, min: 0, max: 5 }),
    dial3: prop.integer({ label: 'Cadran 3 (index du symbole)', default: 2, min: 0, max: 5 }),
  },
  setup(ctx, state, settings): ImprintApi {
    const target = [settings.dial1, settings.dial2, settings.dial3];
    const check = (dials: readonly number[]) => target.map((t, i) => dials[i] === t);
    return {
      symbols: DIAL_SYMBOLS,
      check,
      submit(dials) {
        state.attempts++;
        const ok = check(dials).every(Boolean);
        if (ok) state.done = true;
        return ok;
      },
      // …
      hint() {
        return ctx.vars.get('door.gateEngravingSeen') === true ? target.map((i) => DIAL_SYMBOLS[i] ?? DIAL_SYMBOLS[0]) : null;
      },
    };
  },
});
```

`state` is mutated in place: the session saves that same object. `hint()` reads
`door.gateEngravingSeen`, a variable set by another component (`door.memory`, through its
`examineVar` prop on the gallery gate).

**The condition** lets content ask whether the workbench can be used; it calls the `door.access`
mechanic through the accessor `access(ctx)` (`ctx.mechanics.get<AccessApi>('door.access')`):

```ts
export const imprintReady = defineCondition({
  id: 'door.imprintReady',
  label: "Les trois pièces de l'empreinte sont réunies",
  category: 'Verrou',
  props: {},
  test: (ctx) => IMPRINT_PARTS.every((id) => ctx.inventory.has(id)) && access(ctx).rank < 1,
});
```

**The action** opens the panel, waits for its result, then changes the game state and emits an
event. Actions may be `async`; the interpreter awaits them before the next action of the list:

```ts
export const openImprint = defineAction({
  id: 'door.openImprint',
  label: "Ouvrir l'établi d'empreinte (trois cadrans)",
  category: 'Verrou',
  props: {},
  async run(ctx) {
    if (!IMPRINT_PARTS.every((id) => ctx.inventory.has(id))) {
      ctx.ui.notify(ctx.t('door.prompt.bench.missing'), { kind: 'denied' });
      return;
    }
    const result = await ctx.ui.openPanel<{ success?: boolean }>('door.imprint');
    if (!result?.success) return;
    for (const id of IMPRINT_PARTS) ctx.inventory.remove(id, 1, { silent: true });
    if (ctx.inventory.has('door:plaque_r0')) ctx.inventory.remove('door:plaque_r0', 1, { silent: true });
    ctx.audio.play('door:imprint');
    await ctx.time.wait(1.1);
    ctx.inventory.add('door:plaque_r1', 1);
    access(ctx).setRank(1);
    ctx.events.emit('door.imprinted', {});
  },
});
```

**The event** is documented so that the Studio offers it and validation accepts it:

```ts
export const imprintedEvent = defineEvent({ id: 'door.imprinted', label: 'Plaque de Porteur empreinte', fields: {} });
```

**The panel** (`civilizations/door/ui/ImprintPanel.tsx`) gets the mechanic's API with
`useCiv().mechanics.get<ImprintApi>('door.keyImprint')`, calls `check` and `submit`, and returns the
result through `close({ success: true })` (see [Step 7](#step-7--add-a-hud-element-a-panel-or-a-visual-if-needed)).

The component side of Door is the lock. `door.lock` (`civilizations/door/mechanics/locks.ts`) is a
behavior placed next to a `core.door`; it annotates the door's « open » offer and vetoes the opening
when its rule fails:

```ts
      beforeInteract(attempt) {
        if (attempt.source !== 'core.door' || attempt.offer.id !== 'open') return null;
        if (passes()) {
          if (!ctx.state.unlocked) {
            ctx.state.unlocked = true;
            if (variant() === 'item' && ctx.props.consumeItem && ctx.props.item) ctx.inventory.remove(ctx.props.item, 1);
            if (variant() === 'palm') awakenPalm(ctx);
            void ctx.logic.run(ctx.props.onUnlock, { self: ctx.entity.id, origin: `serrure ${ctx.entity.id}` });
          }
          return null;
        }
        ctx.state.refusals++;
        if (variant() === 'rank') access(ctx).deny(ctx.entity.id, ctx.props.rank);
        // …
        return {
          reason: refusal(),
          sound: variant() === 'rank' ? 'door:access_denied' : variant() === 'impossible' ? undefined : 'core:door_locked',
          data: { variant: variant(), required: ctx.props.rank, refusals: ctx.state.refusals },
        };
      },
```

The engine's `core.door` knows nothing about ranks; access rules live entirely in the pack
(`src/engine/core/behaviors/doors.ts` header). The interaction pipeline is described in
[MECHANICS_SDK §5.3](docs/MECHANICS_SDK.md#53-interaction-pipeline-srcenginecoresiminteractionts).

### 3.2 Memory: echoes (`civilizations/memory/mechanics/echo.ts`)

An echo is a brief superimposition (tint, sound, translucent silhouettes, lines of text) that plays
at an echo point when the memory shard it requires is anchored in the memory chamber (or when it
requires none).

**The mechanic** is data-driven: the echoes are a list of objects in its settings, edited in
`content/rules.json`. It declares `dependsOn: ['memory.chamber']`, keeps the ids already played in
its state, and ends a running echo when the player leaves the scene:

```ts
export const echoMechanic = defineMechanic({
  id: 'memory.echoes',
  label: 'Échos mnésiques',
  description: 'Surimpressions brèves (teinte, son, silhouettes, objets, répliques) rejouables.',
  dependsOn: ['memory.chamber'],
  state: { version: 1, initial: () => ({ played: [] as string[] }) },
```

```ts
  setup(ctx, state, settings): EchoApi {
    const defs = new Map<string, EchoDef>(settings.echoes.map((e) => [e.id, e as EchoDef]));
    let playing: string | null = null;
    let token = 0;
    // An echo belongs to a place: leaving the scene ends it (overlay and tint included).
    ctx.lifecycle.on('sceneExit', () => {
      if (!playing) return;
      token++;
      playing = null;
      ctx.fx.tint(null, 0, 0.3);
      ctx.ui.store.set('memory.echo', null);
    });
```

Playing an echo sends three kinds of requests and never touches the renderer: a sound and a tint
(`ctx.audio`, `ctx.fx`), a custom presentation request for the view module, and a value in the UI
store for the HUD. `token` makes a superseded or interrupted echo stop silently:

```ts
      async play(id) {
        const def = defs.get(id);
        if (!def) return void ctx.log.error(`Écho inconnu : ${id}`);
        const my = ++token;
        playing = id;
        if (!state.played.includes(id)) state.played.push(id);
        ctx.audio.play('memory:echo');
        ctx.fx.tint(def.tint, 0.28, 0.8);
        ctx.fx.custom('memory.echo', { ghosts: def.ghosts, objects: def.objects, duration: def.duration, tint: def.tint });
```

```ts
        ctx.events.emit('memory.echoStarted', { echoId: id });
        await ctx.time.wait(def.duration);
        if (my !== token) return;
        playing = null;
        ctx.fx.tint(null, 0, 1);
        ctx.ui.store.set('memory.echo', null);
        ctx.events.emit('memory.echoPlayed', { echoId: id });
```

**The behavior** `memory.echoPoint` places an echo in the world. It creates its own pickable
collider, offers a secondary (F) interaction only when the required shard is anchored, plays the
echo automatically the first time the player comes close, and runs designer actions with a proper
logic scope:

```ts
    const ready = () => !ctx.props.shard || chamber(ctx).isAnchored(ctx.props.shard);
    const trigger = async () => {
      const first = !ctx.state.seen;
      ctx.state.seen = true;
      const done = echoes(ctx).play(ctx.props.echo);
      if (first) void ctx.logic.run(ctx.props.onFirst, { self: ctx.entity.id, origin: `écho ${ctx.entity.id}` });
      await done;
    };
```

**The action** `memory.playEcho` is presentational: `essential: false` and an early return when a
cinematic is being skipped ([MECHANICS_SDK §4.3](docs/MECHANICS_SDK.md#43-defineaction)).

**The presentation** is outside the simulation: `civilizations/memory/view/echoes.ts` handles the
`memory.echo` channel with `defineViewEffect`, and the `EchoOverlay` HUD element
(`civilizations/memory/ui/ChamberHud.tsx`) shows the lines stored under `memory.echo`.

### 3.3 How the two examples differ

| | Door (`door.access`, `door.keyImprint`, `door.lock`) | Memory (`memory.chamber`, `memory.echoes`, `memory.echoPoint`) |
|---|---|---|
| Observable state | The rank is a declared variable (`door.rank`, `door.rankTemporary`) that content reads with `core.var`; counters stay in mechanic or component `state`. | The chamber keeps structured state (`states`, `order`, `slots`) and mirrors it into variables (`memory.shardsOwned`, `memory.shardsEquipped`, `memory.slot.<id>`, `memory.shard.<id>`) and into `ctx.ui.store` with its `sync()` function. |
| Settings | Scalars: dial indices, a key code. | Data sets: lists of shard and echo objects. |
| Mechanic order | No `dependsOn`: `door.keyImprint` reaches `door.access` only at run time, when every mechanic is set up. | `dependsOn: ['memory.chamber']` on `memory.echoes` and `memory.offering`. It matters when `setup` itself calls `ctx.mechanics.get`, which throws for a mechanic not set up yet. |
| Effect on the world | Vetoes and annotates interactions of another component (`decorateOffer`, `beforeInteract`). | Changes perception: tint, view effect, model swaps with `setProp`, `core.conditional` states driven by the `memory.anchored` condition. |
| Scene coupling | None for the imprint. | Echoes end on the `sceneExit` lifecycle phase. |
| Interface | A panel that returns a result to the action that opened it; HUD elements reading variables and the UI store. | A HUD and a panel reading the UI store snapshot and calling the chamber's API. |

### 3.4 Rules for all pack code

- Register listeners, timers, keys, watchers and locks through `ctx`; they are released
  automatically (behaviors: when the entity is destroyed; everything else: when the civilization
  unloads). Do not use `setTimeout` or `window` listeners in simulation code, and do not keep mutable
  state at module level ([MECHANICS_SDK §13](docs/MECHANICS_SDK.md#13-unloading-cleanup-and-isolation)).
- Keep `state` JSON-compatible and mutate it in place. When its shape changes, increment
  `state.version` and add `migrate[previousVersion]`.
- Write only `<pack>.*` variables (`ctx.vars.set` throws otherwise); declare with
  `ctx.vars.declare` the variables content reads.
- From a behavior, pass `{ self: ctx.entity.id, origin: '…' }` to `ctx.logic.run` and
  `ctx.logic.test`, so that `$self` resolves and errors name their origin.
- Mark presentation-only actions `essential: false` and return early on `scope.skipping`.
- Never call the renderer from a mechanic or behavior: use `ctx.audio`, `ctx.fx` and
  `ctx.fx.custom` with a `defineViewEffect`, or a `defineVisual` that reads the component's props.
- Errors are isolated and only logged: an exception disables the failing component, a failing
  mechanic `setup` leaves the other mechanics running, exceptions in event handlers and timers are
  caught by the event bus and the clock. Assert in tests that `session.logHub.errors()` is empty.

---

## Step 4 — Add the French texts

The game is entirely in French and every visible string is a key of the pack's
`civilizations/<pack>/locales/fr-FR.json`, a flat JSON object (key → text). Keys are namespaced by
the pack (`door.lock.rankDenied`, `memory.notify.shardFound`).

Entries from `civilizations/door/locales/fr-FR.json`:

```json
  "door.lock.rankDenied": "Autorisation insuffisante — Rang {rank} requis ({name}).",
```

```json
  "door.lock.rankRequired": "Rang {rank} requis",
```

and the code that uses the first one, in `civilizations/door/mechanics/locks.ts`:

```ts
          return a.rank < 0 ? ctx.t('door.lock.noPlaque') : ctx.t('door.lock.rankDenied', { rank: ctx.props.rank, name: a.rankName(ctx.props.rank) });
```

- Messages support `{name}` parameters, `plural` and `select`
  ([MECHANICS_SDK §10.4](docs/MECHANICS_SDK.md#104-localization-in-code)). A missing key shows as
  `⟦key⟧`.
- `ctx.ui.notify`, `InteractionOffer.label`/`detail` and `ctx.ui.showDocument` take text that is
  already translated: call `ctx.t` first. In React, use `useT()`.
- `prop.text` values in content are keys. In the Studio, an empty text field offers
  « ＋ Écrire un texte », which creates a key in the pack's table, and the field then edits the
  French text; the « Textes » editor edits the table directly.
- The existing tables follow French typography: typographic apostrophe (’), and no-break spaces
  (U+00A0 or U+202F) before « : ; ! ? » and inside guillemets. The Memory playthrough test
  normalizes those spaces before comparing texts (its `norm` helper).
- `label`, `description`, `category`, prop labels and `summarize` are French strings for the Studio,
  not keys.
- `npm run validate` checks the keys used by text props in content and the keys written literally as
  `t('…')` in the pack's code. Keys built at run time are not checked: Door builds
  `` `door.dial.${symbols[value]}` `` in `ImprintPanel.tsx`, so every `door.dial.<symbol>` key of
  `DIAL_SYMBOLS` must exist in the table.

---

## Step 5 — Attach it to entities and content

### Behaviors: on entities

In the Studio, select an entity; under its components, the select « ＋ Ajouter un composant… »
(`AddComponent` in `src/studio/panels/Inspector.tsx`) lists every registered behavior the entity
does not have yet, grouped by `category` and sorted by `label`. Adding one also adds the components
of its `requires` that the
entity lacks (adding « Serrure de Verrou » to an entity without `core.door` adds `core.door`). The
new section shows the behavior's `label`, its id and a form generated from its `props`; only values
that differ from the defaults are written to the scene file. Save with Ctrl+S.

The same data in a scene file, entity `porte_galerie` of
`civilizations/door/content/scenes/verrou.scene.json`:

```json
      "components": {
        "core.door": {
          "model": "door:door_rank1",
          "name": "door.door.gallery",
          "width": 2,
          "height": 3
        },
        "door.lock": {
          "variant": "rank",
          "rank": 1
        },
        "door.memory": {
          "descriptions": [
            "door.memory.gate.1",
            "door.memory.gate.2"
          ],
          "examineVar": "door.gateEngravingSeen"
        }
      },
```

`npm run validate` reports components whose type is not registered ("Composant inconnu") and
checks their prop values.

### Mechanics: nothing to attach

A mechanic of the civilization pack runs as soon as the civilization loads. Content reaches it
through the actions, conditions and events you defined.

### Actions, conditions and events: in content

They appear in every Studio logic editor (rules, dialogues, quests, cinematics, component props of
kind `condition`/`actions`) under their `category`. In JSON, they are objects whose `type` is the
id. The Door workbench, entity `etabli_empreinte` of `verrou.scene.json`, uses the engine's
`core.interactable` with the pack's condition and action:

```json
        "core.interactable": {
          "prompt": "door.prompt.bench",
```

```json
          "condition": {
            "type": "door.imprintReady"
          },
          "hideIfUnavailable": false,
          "unavailableReason": "door.prompt.bench.missing",
          "actions": [
            {
              "type": "door.openImprint"
            }
          ],
```

and the quest `DOOR_Q01_EMPREINTE` completes its objective on the pack event, in
`civilizations/door/content/quests/DOOR_Q01_EMPREINTE.quest.json`:

```json
          "completeOn": {
            "event": "door.imprinted"
          },
```

On the Memory side, the stele `stele_lea` of `civilizations/memory/content/scenes/reminence.scene.json`
combines `memory.recollection` (actions run the first time it is examined with the shard) and a
`memory.echoPoint`, and the path's footprints use `core.conditional` with the `memory.anchored`
condition. More examples (rules, dialogue actions, cinematic tracks):
[MECHANICS_SDK §9](docs/MECHANICS_SDK.md#9-actions-conditions-and-events-in-content).

---

## Step 6 — Put its settings in `content/rules.json`

1. Declare `settings` on the mechanic with `prop` builders; `setup` receives the normalized values
   as its third argument (`ctx.settings.of(id)` returns them elsewhere).
2. Add the values under `settings.<mechanicId>` in `civilizations/<pack>/content/rules.json`, or
   edit them in the Studio under « Règles des mécaniques » (the explorer entry and editor
   `RulesEditor` in `src/studio/editors/DataEditors.tsx` list every mechanic of the pack with a
   non-empty `settings` schema).

From `civilizations/door/content/rules.json`:

```json
    "door.keyImprint": {
      "dial1": 2,
      "dial2": 0,
      "dial3": 4
    },
```

The Memory puzzle `memory.offering` (`civilizations/memory/mechanics/garden.ts`) takes entity and
item references from its settings:

```ts
  settings: {
    pedestals: prop.list(prop.entity({ label: 'Socle', withComponent: 'memory.pedestal' }), { label: 'Socles (dans l’ordre)' }),
    solution: prop.list(prop.item({ label: 'Objet' }), { label: 'Ordre attendu' }),
    reward: prop.string({ label: 'Éclat obtenu' }),
  },
```

with the values `"pedestals": ["socle_1", "socle_2", "socle_3"]`,
`"solution": ["memory:cerf_volant", "memory:tasse", "memory:clochette"]` and `"reward": "jardin"` in
`civilizations/memory/content/rules.json`.

Things to know:

- Settings are read when the civilization loads. A missing entry gives the defaults; unknown fields
  and wrong types are logged as warnings by the `règles` logger, not reported by `npm run validate`.
  Cover settings with a test.
- Keep every use of a setting connected to it. `door.access` reads `permissionsKey`, but
  `civilizations/door/ui/PermissionsPanel.tsx` closes on the hard-coded `KeyR` and the HUD hint
  `door.hud.permissionsHint` is the text « R »; likewise `memory.chamber` reads `chamberKey` while
  `ChamberPanel.tsx` closes on `KeyM` and `memory.hud.key` is « M ». Changing those settings alone
  leaves these out of date.

---

## Step 7 — Add a HUD element, a panel or a visual if needed

All three are optional; a mechanic works without them.

**HUD element** (`civilizations/<pack>/ui/<Name>.tsx`): a React component exported with
`defineHud({ id, slot, order?, component, visibleWhen? })`. Read data with `useVar` (variables) or
`useUiStore` (values the mechanic writes with `ctx.ui.store.set`), call mechanic APIs through
`useCiv().mechanics.get<Api>(id)`, and translate with `useT()`. From
`civilizations/door/ui/RankPlaque.tsx`:

```tsx
function AccessDeniedStamp() {
  const t = useT();
  const denied = useUiStore<{ n: number; required: number; rank: number }>('door.denied');
```

```tsx
export const deniedHud = defineHud({ id: 'door.accessDenied', slot: 'overlay', component: AccessDeniedStamp });
```

The value comes from the `deny()` method of the `door.access` mechanic, in
`civilizations/door/mechanics/access.ts`:

```ts
        ctx.ui.store.set('door.denied', { n: state.denials, required, rank: api.rank });
```

**Panel**: `definePanel({ id, component, pausesGame?, title? })`. Open it with
`ctx.ui.openPanel(id, props)` from an action, a behavior's `onInteract` or an input handler; the
component receives `props` and `close(result)`, and the promise returned by `openPanel` resolves
with `result`. `memory.pedestal` passes the items the player can place and reads the choice, in
`civilizations/memory/mechanics/garden.ts`:

```ts
        const choice = await ctx.ui.openPanel<{ item?: string }>('memory.offering', { pedestal: ctx.entity.id, items: held });
        if (choice?.item) o.place(ctx.entity.id, choice.item);
```

A panel locks the player's movement while open (unless `pausesGame: false`) but the simulation
keeps running ([MECHANICS_SDK §10.2](docs/MECHANICS_SDK.md#102-definepanel)).

**Visual or view effect** (`civilizations/<pack>/view/<name>.ts`): `defineVisual` renders a
component type on each entity that has it (`door.spinnerVisual` turns the models of entities with
`door.spinner`); `defineViewEffect` handles `ctx.fx.custom(channel, payload)` requests
(`memory.echoEffect`). Both receive Babylon.js objects through `@sdk/view` and never run headless
([MECHANICS_SDK §11](docs/MECHANICS_SDK.md#11-custom-rendering-sdkview)).

Components are rendered with the civilization's theme (CSS variables such as `--civ-accent`,
`--civ-panel`, `--civ-font`) and inside error boundaries. Door and Memory import their own CSS
files from their UI modules (`door.css`, `memory.css`).

---

## Step 8 — Test it headlessly with Vitest

Tests of a pack go in `civilizations/<pack>/tests/*.test.ts`: `vitest.config.ts` includes
`civilizations/**/*.test.ts` and runs them in the `node` environment, and `eslint.config.js` lets
test files import `@engine/*` (the pack globs exclude `*.test.ts`). Run them with `npm test` (all
tests) or `npx vitest run civilizations/<pack>`.

The helpers are in `src/engine/core/testing/headless.ts`: `createHeadlessGame(provider)` (session +
`HeadlessUi`, presentation requests recorded), `advance(session, seconds)`, `flush()`,
`walkTo(session, entityId)` (fails when the entity cannot be reached on foot), `talk`, `choose`,
`advanceDialogue`, `skipCinematics`.

### Playthrough style (Door)

From `civilizations/door/tests/door.playthrough.test.ts`:

```ts
async function start(): Promise<HeadlessGame> {
  const game = await createHeadlessGame(new GlobContentProvider());
  await game.session.loadCivilization('door', { fresh: true });
  await advance(game.session, 0.3);
  return game;
}

async function interact(session: GameSession, entityId: string, offerId?: string): Promise<boolean> {
  await walkTo(session, entityId);
  const ok = await session.interaction.interactWith(entityId, 'primary', offerId);
  await flush();
  return ok;
}
```

`interactWith` runs the real interaction pipeline, so locks veto it exactly as in the game:

```ts
  await walkTo(session, 'porte_galerie');
  expect(await session.interaction.interactWith('porte_galerie', 'primary', 'open')).toBe(false);
```

A mechanic's API is reachable from the session, and a panel opened headlessly stays open until the
test answers it with `session.closePanel`:

```ts
  expect(await interact(session, 'etabli_empreinte')).toBe(true);
```

```ts
  const imprint = session.civ!.mechanics.get('door.keyImprint')!.api as { check(d: number[]): boolean[]; submit(d: number[]): boolean; hint(): string[] | null };
  expect(imprint.hint()).toEqual(['tour', 'lune', 'main']);
  expect(imprint.check([2, 1, 4])).toEqual([true, false, true]);
  expect(imprint.submit([0, 0, 0])).toBe(false);
  expect(imprint.submit([2, 0, 4])).toBe(true);
  session.closePanel('door.imprint', { success: true });
  await advance(session, 1.6);
  expect(rank(session)).toBe(1);
```

State must survive a save and a reload:

```ts
    const raw = JSON.parse(JSON.stringify(s.buildSaveGame('slot1', 'test')));
    const { save } = parseSave(raw);

    const game2 = await createHeadlessGame(new GlobContentProvider());
    await game2.session.applySaveGame(save);
    await game2.session.loadCivilization('door');
```

and the test ends by checking that nothing was logged as an error:

```ts
    expect(game.session.logHub.errors()).toEqual([]);
```

### Memory style

From `civilizations/memory/tests/memory.playthrough.test.ts`: typed accessors to the mechanics, the
UI store and the recorded notifications.

```ts
const chamber = (s: GameSession) => s.civ!.mechanics.get('memory.chamber')!.api as ChamberApi;
```

```ts
const notified = (game: HeadlessGame, text: string) => game.ui.notifications.some((n) => norm(n.text) === norm(text));
```

```ts
  chamber(s).examine('ambre');
  await advance(s, 0.2);
  const touch = s.civ!.ctx.ui.store.get<{ text: string }>('memory.touch');
```

### Isolated test without a full pack

A pack can be defined in memory with `MemoryContentProvider`
(`src/engine/core/packs/memoryProvider.ts`): `modules` is a plain record, so definitions can be
passed directly, as in `src/engine/core/sim/session.test.ts`:

```ts
    module: definePack({
      modules: { ...blocksModule('testciv'), './mechanics/main.ts': { lockBehavior, counterMechanic, hasMetMira } },
    }),
```

Its isolation test checks what remains after an unload; these assertions are worth copying for a
mechanic that registers listeners or timers (`src/engine/core/sim/session.test.ts`):

```ts
    await session.unloadCivilization();
    expect(session.leakedListeners).toBe(0);
    expect(session.clock.timerCount).toBe(baselineTimers);
    expect(session.player.modifierCount).toBe(0);
```

Other things a headless test can read: `game.ui.openPanels`, `game.ui.huds`, `game.ui.documents`,
`game.ui.endScreens` (`HeadlessUi`), `session.presentation.history()` (sounds, effects and
`fx.custom` requests), `session.vars.get(name)`, `session.quests.status(id)` and
`session.interpreter.traces()`.

---

## Step 9 — Validate and type-check

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` on `tsconfig.json` (engine, SDK, game, Studio, packs except `seed/`, tests) and `tsconfig.node.json` (tools, seeds, configs). TypeScript is strict, with `noUnusedLocals` and `noUnusedParameters`. |
| `npm run lint` | ESLint, including the rule that keeps pack code on `@sdk`. |
| `npm run validate` | `tsx tools/cli/civ.ts validate`: loads every civilization headless through Vite's module runner and checks manifests, content schemas, references, component types and props, action/condition types and props, event names, variable namespaces and French keys (content and literal `t('…')` keys in code). Exits with 1 on errors. `npm run civ -- validate <pack>` checks one pack. |
| `npm test` | Vitest: engine tests, pack playthroughs, acceptance tests. |
| `npm run check` | `typecheck`, `lint`, `validate` and `test` in sequence. |

`npm run validate` does not check `content/rules.json` and does not report errors logged while the
civilization boots, such as a mechanic whose `setup` throws
([MECHANICS_SDK §15](docs/MECHANICS_SDK.md#15-limitations)); the headless test of Step 8 covers
both.

---

## Step 10 — When the engine lacks a capability

### First, check whether the SDK already covers it

| Need | Existing extension point |
|---|---|
| New rendering or screen effect | `ctx.fx.custom(channel, payload)` + `defineViewEffect`, or `defineVisual` for a component type |
| New interface | `defineHud`, `definePanel`, `ctx.ui.store` |
| Control over an engine component | A behavior on the same entity using `decorateOffer`, `beforeInteract`, events or `setProp` (Door's locks on `core.door`) |
| Per-frame or timed logic | `ctx.time.onUpdate`, `after`, `every`, `wait`; behavior `update(dt)` |
| Player movement changes | `ctx.player.addMovementModifier`, `setBaseMovement`, abilities (`defineAbility`) |
| New keys | `ctx.input.bind`, `ctx.input.onPressed` |
| New logic for content | `defineAction`, `defineCondition`, `defineEvent` |
| Scene or world changes | `ctx.world.spawn`, `setBlock`, `fillBlocks`, `entity.setProp`, `entity.setCollider` |

### Where to change the engine

| Capability | Files |
|---|---|
| New member of a context API (`ctx.*`, `EntityApi`) | Interface in `src/engine/core/sim/api.ts` (re-exported to packs by `export type * from '../engine/core/sim/api'` in `src/sdk/index.ts`); implementation in `createCivContext`, `createBehaviorContext` or `createEntityApi` (`src/engine/core/sim/contexts.ts`). |
| New per-civilization runtime state | `ActiveCiv` and `GameSession` in `src/engine/core/sim/session.ts`: create it in `loadCivilization`, reset it in `unloadCivilization`. If it is saved: `snapshotCivState`, `LocalCivState` and `LocalCivStateSchema` in `src/engine/core/save/saveFormat.ts`, and when the save layout changes `SAVE_FORMAT_VERSION` with an entry in `FORMAT_MIGRATIONS`. |
| New request to the renderer | A `PresentationRequest` variant in `src/engine/core/sim/presentation.ts`, emitted by the context, handled in `src/engine/view/gameView.ts` (and recorded headless). |
| New definition kind | `DefinitionKind`, its interface and `define*` helper, `AnyDefinition`, `CollectedDefinitions`, `emptyDefinitions`, `collectDefinitions` in `src/engine/core/packs/definitions.ts`; registration in `GameSession.registerPack` and removal in `unregisterPack`; export from `src/sdk/index.ts` (or `src/sdk/ui.tsx` / `src/sdk/view.ts`). |
| New prop kind or reference kind | `src/engine/core/props/props.ts` (`PropDef`, the `prop` builder, `normalizeValue`, `RefKind`/`REF_KINDS`, `collectRefs`, `collectTextKeys`), the Studio editor `src/studio/fields/PropField.tsx`, reference options in `src/studio/ui/catalog.ts`, validation in `checkValue` of `src/engine/core/packs/validate.ts`. |
| New engine action, condition, event or component | `src/engine/core/logic/coreActions.ts`, `coreConditions.ts`, `coreEvents.ts` (payload type in `CivEventMap`, `src/engine/core/events/eventMap.ts`); components in `src/engine/core/behaviors/` and `ENGINE_BEHAVIORS` in `src/engine/core/sim/builtins.ts`. |
| Exposing an existing engine utility | An export in `src/sdk/index.ts`. |

Rules for engine changes:

- `src/engine/core` contains no Babylon.js, React or DOM code: it runs headless in Vitest's `node`
  environment and in `npm run validate`. Rendering code goes in `src/engine/view`, React code in
  `src/game` and `src/sdk/ui.tsx`. No lint rule enforces this; keep it that way by review.
- Everything a context method registers goes through the context's scope, so that unloading
  releases it. The existing pattern, from `src/engine/core/sim/contexts.ts`:

```ts
  const time: TimeApi = {
    get now() {
      return session.clock.now;
    },
    onUpdate: (cb) => scope.add(session.clock.onUpdate(cb)),
    after: (s, cb) => scope.add(session.clock.after(s, cb)),
    every: (s, cb) => scope.add(session.clock.every(s, cb)),
```

- Enforce ownership as the existing methods do: `vars.set` refuses names outside `<civId>.*`,
  `multiverse.grantFragment` and `setFlag` check the manifest's `globalWrites`.
- Add an engine test next to `src/engine/core/sim/session.test.ts` (in-memory pack, isolation
  assertions), and keep `npm test` and `npm run validate` green for Door and Memory.

### Versioning

- `ENGINE_API_VERSION` (`src/engine/core/version.ts`, currently `'1.0.0'`) is the version of the API
  packs target; each manifest declares a compatible range in `engineApi` (`"^1.0.0"` for core, Door
  and Memory). `GameSession.refreshManifests` rejects packs whose range the engine does not
  satisfy.
- Breaking change (removing or renaming an SDK export or a context member, changing a definition
  field or the meaning of an existing call): the comment in `version.ts` asks for a major bump and for
  the migration to be documented in [`docs/VERSIONING.md`](docs/VERSIONING.md), which holds the bump
  rules and the changelog. After a major bump, packs declaring `^1.0.0` are rejected until their
  `engineApi` is updated (`civilizations/*/manifest.json`); `npm run civ -- new-pack` derives
  `^<major>.0.0` from `ENGINE_API_VERSION` automatically.
- Additive change: `version.ts` gives no rule; `docs/VERSIONING.md` recommends a minor bump as a
  policy. With the semver ranges implemented in `src/engine/core/util/semver.ts`, `1.1.0` still
  satisfies `^1.0.0`, so existing packs keep loading, and a pack that needs the addition can declare
  `^1.1.0`.
- `ENGINE_VERSION` ("Bump on every release") is written into saves; save-layout changes are
  versioned separately by `SAVE_FORMAT_VERSION`.

---

## Checklist

- [ ] The kind is chosen: mechanic (once per civilization), behavior (per entity), action,
      condition, event, HUD element, panel, visual or view effect.
- [ ] The file is in `civilizations/<pack>/mechanics/` (or `ui/`, `view/`) and the folder is in the
      glob of `pack.ts`.
- [ ] Ids follow `<pack>.<name>` (types) and `<pack>:<name>` (assets), and are unique.
- [ ] Imports are limited to `@sdk`, `@sdk/ui`, `@sdk/view`, modules of the same pack and `react`.
- [ ] Listeners, timers, keys and locks are registered through `ctx`; no `setTimeout`, `window`
      listener or module-level state in simulation code.
- [ ] `state` is JSON-compatible and mutated in place; `version` and `migrate` are updated when its
      shape changes.
- [ ] Only `<pack>.*` variables are written; variables read by content are declared with
      `ctx.vars.declare`.
- [ ] Every player-visible string is a key of `locales/fr-FR.json`; keys built at run time all exist.
- [ ] Actions and conditions have a `category`, a French `label` and a `summarize` when useful;
      presentational actions have `essential: false` and check `scope.skipping`.
- [ ] Emitted events are documented with `defineEvent`, with `fields` for filters.
- [ ] Behaviors that the player uses have a pickable collider (their own or a `core.model`), declare
      `requires`, and pass `{ self, origin }` to `ctx.logic`.
- [ ] Settings are declared with `prop`, their values are in `content/rules.json`, and no other code
      hard-codes the same value.
- [ ] Behaviors are attached in scenes (Inspector or JSON); actions, conditions and events are used
      in content.
- [ ] HUD and panel text goes through `useT`; panels return their result through `close`.
- [ ] A headless test covers the mechanic through the real pipeline (`interactWith`, content), a
      save and reload, and `session.logHub.errors()` being empty.
- [ ] `npm run typecheck`, `npm run lint`, `npm run validate` and `npm test` pass (`npm run check`).
- [ ] Engine changes, if any: no Babylon/DOM/React in `src/engine/core`, scoped registrations,
      reset at unload, an engine test, `ENGINE_API_VERSION` and manifests updated, and an entry in
      `docs/VERSIONING.md`.
