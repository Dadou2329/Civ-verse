# Mechanics SDK reference

This document describes the public API that civilization packs (`civilizations/<id>/`) use to add
world rules, entity components, logic building blocks, interface elements and custom rendering.
Every statement points to the source file that implements it. For a step-by-step walkthrough, see
[`HOW_TO_ADD_A_NEW_MECHANIC.md`](../HOW_TO_ADD_A_NEW_MECHANIC.md).

Engine API version described here: `ENGINE_API_VERSION = '1.0.0'` (`src/engine/core/version.ts`).

Contents

1. [Modules and import rules](#1-modules-and-import-rules)
2. [Discovery and registration of pack code](#2-discovery-and-registration-of-pack-code)
3. [Identifiers](#3-identifiers)
4. [Definition reference](#4-definition-reference)
5. [Behaviors: instance hooks and the interaction pipeline](#5-behaviors-instance-hooks-and-the-interaction-pipeline)
6. [Property schemas (`prop`)](#6-property-schemas-prop)
7. [The runtime context](#7-the-runtime-context)
8. [Mechanic settings (`content/rules.json`)](#8-mechanic-settings-contentrulesjson)
9. [Actions, conditions and events in content](#9-actions-conditions-and-events-in-content)
10. [Interface: `@sdk/ui`](#10-interface-sdkui)
11. [Custom rendering: `@sdk/view`](#11-custom-rendering-sdkview)
12. [Persistence](#12-persistence)
13. [Unloading, cleanup and isolation](#13-unloading-cleanup-and-isolation)
14. [Engine API version](#14-engine-api-version)
15. [Limitations](#15-limitations)

---

## 1. Modules and import rules

| Import | Source | Contents |
|---|---|---|
| `@sdk` | `src/sdk/index.ts` | `definePack`; `defineMechanic`, `defineBehavior`, `defineAction`, `defineCondition`, `defineEvent`, `defineItem`, `defineAbility`, `defineBlock`, `defineModel`, `defineSound`, `defineMusic` and their definition types; `StateSpec`; `prop`, `defaultsOf`, `PropSchema`, `InferProps`, `PropDef`; every type of `src/engine/core/sim/api.ts` (`CivContext`, `BehaviorContext`, `EntityApi`, `InteractionOffer`...); `ActionData`, `ConditionData`, `EventMatch`; `CivEventMap`, `EventPayload`; `MovementParams`, `DEFAULT_MOVEMENT`; `AABB`; block, model, sound and icon types; `Disposable`; `JsonValue`; `LocalCivState`; `vec` (namespace of `src/engine/core/util/math.ts`) and `Vec3`; `ease`; `hexToRgb`, `rgbToHex`, `mixRgb`, `shade`; `Rng`, `hashString`; `ENGINE_API_VERSION`, `ENGINE_VERSION`; `DoorApi` |
| `@sdk/ui` | `src/sdk/ui.tsx` | `defineHud`, `definePanel`, `PanelProps`, `CivUiContext`, hooks `useCiv`, `useT`, `useVar`, `useUiStore`, `useEventRefresh` |
| `@sdk/view` | `src/sdk/view.ts` | `defineVisual`, `defineViewEffect`, `VisualInstance`, types `ViewContext` and `VisualEntity`, Babylon.js re-exports `Vector3`, `Color3`, `Color4`, `Mesh`, `MeshBuilder`, `StandardMaterial`, `TransformNode` and types `AbstractMesh`, `Scene` |
| `@sdk/build` | `src/sdk/build.ts`, `src/sdk/buildKit.ts` | World-building helpers (`SceneBuilder`, voxel construction, `house`, `doorSpot`, `light`, `sign`, `zone`, `npc`...) for the seed scripts in `civilizations/<id>/seed/` (`npm run civ -- seed <id>`). Mechanics do not use it. |

The aliases are declared in `tools/vite/aliases.ts` (Vite, Vitest, tsx) and mirrored in the
`paths` of `tsconfig.json`.

`eslint.config.js` applies `no-restricted-imports` to `civilizations/**/*.{ts,tsx}` (except
`civilizations/*/seed/**` and `civilizations/**/*.test.ts`): imports of `@engine/*`,
`../../src/*`, `../../../src/*`, `@studio/*` and `@game/*` are errors ("Les packs utilisent
uniquement @sdk (API publique)."). Pack modules may import each other with relative paths
(`civilizations/door/mechanics/locks.ts` imports `./access`) and UI modules import `react` and CSS
files (`civilizations/door/ui/RankPlaque.tsx`).

---

## 2. Discovery and registration of pack code

### `definePack`

`civilizations/<id>/pack.ts` must default-export `definePack({ modules, migrations? })`
(`src/engine/core/packs/pack.ts`).

From `civilizations/door/pack.ts`:

```ts
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
```

| Field | Type | Meaning |
|---|---|---|
| `modules` | `Record<string, unknown>` | Code modules, usually the result of `import.meta.glob(..., { eager: true })`. |
| `migrations` | `Record<number, (state: LocalCivState) => LocalCivState>` | `migrations[n]` upgrades a saved local state from manifest `stateVersion` n to n + 1 (see [§12](#12-persistence)). |

`collectDefinitions` (`src/engine/core/packs/definitions.ts`) visits every exported value of every
module. A value is a definition when it has a string `__kind` and a string `id` (all `define*`
helpers set `__kind`). Arrays are visited recursively, so `export const accessEvents = [defineEvent(...), defineEvent(...)]`
works. Other exports are ignored, and an object exported twice is collected once. Adding a file
under a globbed folder is therefore enough to register its definitions; there is no central list.

Only the folders matched by the glob are discovered. Door and Memory glob `mechanics/`, `assets/`,
`ui/` (`.tsx`) and `view/`; the `core` library (`civilizations/core/pack.ts`) globs `mechanics/` and
`models/`. The `pack.ts` written by `npm run civ -- new-pack <id>` (`tools/cli/newPack.ts`) globs
`mechanics/`, `assets/` and `ui/`, not `view/`.

### Registration

`GameSession.ensurePack` (`src/engine/core/sim/session.ts`) loads the pack's manifest dependencies
first, then calls `registerPack`, which registers the definitions with the pack id as owner:

| Kind | Registry | Same id already registered by another pack |
|---|---|---|
| action, condition, event | `session.logicRegistry` (`src/engine/core/logic/registry.ts`) | error logged ("enregistrement impossible"), definition skipped |
| behavior | `session.behaviorDefs` | error logged, first definition kept |
| block, model | `BlockRegistry`, `ModelRegistry` (the id must match `pack:name`) | error logged, definition skipped |
| item (`defineItem` and `content/items.json`) | `ItemRegistry` | error logged, definition skipped |
| sound, music | `session.sounds`, `session.music` (keyed by id) | replaced without warning |
| visual | `session.visuals` (keyed by `component`) | replaced without warning |
| view effect | `session.viewEffects` (keyed by `channel`) | replaced without warning |
| locale tables | `session.i18n`, namespace = pack id | — |

The following are **only activated for the civilization being played**, taken from the
civilization pack itself (never from its dependencies) in `GameSession.loadCivilization`:
mechanics (`pack.defs.mechanics`), HUD elements, panels and abilities.

---

## 3. Identifiers

`src/engine/core/util/ids.ts` documents the conventions:

| What | Form | Examples |
|---|---|---|
| Registered types: mechanics, behaviors, actions, conditions, events, HUD elements, panels, visuals | `<pack>.<name>` | `door.access`, `door.lock`, `door.setRank`, `memory.chamber`, `memory.playEcho` |
| Assets: blocks, models, sounds, music, items | `<pack>:<name>` | `door:access_denied`, `memory:shard_amber`, `door:plaque_r1` |
| Story variables | `<namespace>.<name>` | `door.rank`, `memory.shardsOwned`, `global.fragments.threshold` |
| Entities | local to a scene | `cell_door`, `stele_lea` |

Only block and model ids are checked at registration (`ASSET_ID_RE`). The `<pack>.<name>` form of
type ids (`TYPE_ID_RE`) is a convention that nothing enforces. Writing variables outside
`<civId>.*` is refused at runtime (see [§7.1](#71-variables-ctxvars)).

Mechanics, actions, conditions, events, behaviors, panels and HUD elements live in separate
registries, so the same string can name several of them: `memory.chamber` is both a mechanic and a
panel, `memory.anchored` is both a condition and an event.

---

## 4. Definition reference

The `define*` helpers do no work at definition time: they return the definition with a `__kind`
marker (`src/engine/core/packs/definitions.ts`, `src/sdk/ui.tsx`, `src/sdk/view.ts`). `label`,
`description`, `category` and prop labels are French designer-facing strings shown in Civilization
Studio; they are not localization keys and are never shown to players.

### 4.1 `defineMechanic`

A mechanic is a rule of the world that exists once per running civilization. It has no entity.

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | `<pack>.<name>`. |
| `label` | `string` | French label (Studio, « Règles des mécaniques »). |
| `description?` | `string` | Shown in the Studio rules editor. |
| `state?` | `StateSpec<S>` = `{ version: number; initial: () => S; migrate?: Record<number, (old: unknown) => unknown> }` | Persistent state, saved with the game. `migrate[n]` converts a state saved at version n into n + 1. |
| `settings?` | `PropSchema` | Designer settings stored in `content/rules.json` (see [§8](#8-mechanic-settings-contentrulesjson)). |
| `dependsOn?` | `string[]` | Ids of mechanics of the same pack that must be set up first. |
| `setup(ctx, state, settings)` | `(ctx: CivContext, state: S, settings: InferProps<Settings>) => Api \| void` | Called once when the civilization loads. The returned value is the mechanic's API. |

Lifecycle, from `GameSession.loadCivilization`:

1. The settings of every mechanic that declares `settings` are normalized from
   `content/rules.json`.
2. Mechanics are ordered by `dependsOn`. A missing dependency or a cycle throws, and the
   civilization does not load.
3. For each mechanic: the state is restored from the save and migrated (`migrateVersioned` in
   `src/engine/core/save/saveFormat.ts`), or created with `state.initial()`; then `setup` runs. If
   `setup` throws, the error is logged, the other mechanics still run, and
   `ctx.mechanics.get(id)` returns `undefined` for that mechanic.
4. The entry scene is entered (behaviors are instantiated), then the `start` lifecycle phase runs.

There is no `dispose` and no per-frame hook on a mechanic. Per-frame work goes through
`ctx.time.onUpdate` or `ctx.time.every`; cleanup goes through registrations made with `ctx` (all
released at unload, see [§13](#13-unloading-cleanup-and-isolation)), `ctx.scope.addFn(fn)` or
`ctx.lifecycle.on('unload', cb)`.

The `state` object passed to `setup` is the object the session saves (`structuredClone(m.state)` in
`snapshotCivState`): mutate it in place, never replace it, and keep it JSON-compatible.

Other code reaches the API with `ctx.mechanics.get<Api>(id)`. Door and Memory wrap that call in a
small accessor exported next to the mechanic.

From `civilizations/door/mechanics/imprint.ts`:

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
    };
  },
});
```

From `civilizations/memory/mechanics/chamber.ts`:

```ts
export function chamber(ctx: CivContext): ChamberApi {
  return ctx.mechanics.get<ChamberApi>('memory.chamber');
}
```

Mechanics of the two packs:

| Id | File | Notes |
|---|---|---|
| `door.access` | `civilizations/door/mechanics/access.ts` | Rank kept in declared variables `door.rank`, `door.rankTemporary`; binds the permissions key from its settings. |
| `door.keyImprint` | `civilizations/door/mechanics/imprint.ts` | Dial puzzle; solution in settings; API used by the `door.imprint` panel. |
| `memory.chamber` | `civilizations/memory/mechanics/chamber.ts` | Shards defined in settings; state mirrored into variables and `ctx.ui.store`. |
| `memory.echoes` | `civilizations/memory/mechanics/echo.ts` | `dependsOn: ['memory.chamber']`; echoes defined in settings; ends on `sceneExit`. |
| `memory.offering` | `civilizations/memory/mechanics/garden.ts` | `dependsOn: ['memory.chamber']`; pedestals and solution in settings. |

### 4.2 `defineBehavior`

A behavior is an entity component: it is attached to entities in scene files and instantiated for
each entity that has it.

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Component type, `<pack>.<name>`; the key used in the entity's `components`. |
| `label` | `string` | Section title in the Studio inspector and entry of « Ajouter un composant ». |
| `description?` | `string` | Help text under the section title in the inspector. |
| `category?` | `string` | Group of the « Ajouter un composant » menu (`'Divers'` when absent). |
| `props` | `PropSchema` | Component properties; edited in the inspector (see [§6](#6-property-schemas-prop)). |
| `state?` | `{ version: number; initial: (props) => S; migrate?: Record<number, (old: unknown) => unknown> }` | Persistent per-entity state, saved with the scene state. `initial` receives the normalized props. |
| `requires?` | `string[]` | Components the Studio adds (with empty props) when this one is added from the inspector. Not enforced at runtime or by validation. |
| `internal?` | `boolean` | Declared as "hidden from the « Ajouter un composant » menu", but no code reads it (see [§15](#15-limitations)). |
| `create(ctx)` | `(ctx: BehaviorContext<InferProps<Props>, S>) => BehaviorInstance \| void` | Called when the entity is instantiated. Returns the hooks described in [§5](#5-behaviors-instance-hooks-and-the-interaction-pipeline). |

Engine behaviors (`src/engine/core/behaviors/*.ts`, registered by
`src/engine/core/sim/builtins.ts`) use the same API: `core.spawn`, `core.marker`, `core.model`,
`core.collider`, `core.light`, `core.sound`, `core.particles`, `core.sign`, `core.door`,
`core.portal`, `core.npc`, `core.interactable`, `core.pickup`, `core.readable`, `core.trigger`,
`core.zone`, `core.conditional`.

Pack behaviors: `door.lock`, `door.memory`, `door.restricted`, `door.watcher`, `door.ambientLoop`,
`door.spinner`; `memory.device`, `memory.echoPoint`, `memory.closed`, `memory.pedestal`,
`memory.recollection`, `memory.recognition`.

From `civilizations/door/mechanics/locks.ts`:

```ts
export const lockBehavior = defineBehavior({
  id: 'door.lock',
  label: 'Serrure de Verrou',
  category: 'Verrou',
  description: 'Variantes de serrures (rang, objet, condition, close, paume, impossible) sur une porte.',
  requires: ['core.door'],
  props: lockProps,
  state: { version: 1, initial: (): LockState => ({ unlocked: false, refusals: 0 }) },
  create(ctx) {
```

### 4.3 `defineAction`

An action is a step of a data-driven action list (rules, dialogues, quests, cinematics, items,
component props of kind `actions`).

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Value of `type` in content (`{ "type": "door.setRank", "rank": 2 }`). |
| `label` | `string` | Name in the Studio's action menu. |
| `description?` | `string` | |
| `category?` | `string` | Group of the Studio's action menu (`'Divers'` when absent). |
| `props` | `PropSchema` | Fields of the action, stored next to `type`. |
| `run(ctx, props, scope)` | `(ctx: CivContext, props: InferProps<Props>, scope: LogicScope) => void \| Promise<void>` | Executes the action. A returned promise is awaited before the next action of the list. |
| `essential?` | `boolean` | Default `true`. When `false`, the action is skipped while a skipped cinematic is fast-forwarded (`scope.skipping`). |
| `summarize?(props)` | `string` | One-line French summary shown on the Studio block. |

Execution (`LogicInterpreter.run`, `src/engine/core/logic/interpreter.ts`):

- The props are normalized against the schema at every execution, then **top-level** string props
  are resolved: `"$self"` → `scope.self` (or `''`), `"$player"` → `'player'`, `"$event.<path>"` →
  the field of the triggering event's payload. Nested values (inside lists or objects) are not
  resolved.
- Actions of a list run in order. An unknown `type` or an exception stops the list; the failure is
  logged with its origin and recorded in the trace buffer (`session.interpreter.traces()`).
- `ctx` is always the civilization context, also when the list is run by a behavior. Timers and
  listeners an action registers belong to the civilization scope.

From `civilizations/door/mechanics/access.ts`:

```ts
export const setRank = defineAction({
  id: 'door.setRank',
  label: 'Définir le rang du joueur',
  category: 'Verrou',
  props: {
    rank: prop.integer({ label: 'Rang (−1 à 2)', default: 0, min: -1, max: 2 }),
    temporary: prop.boolean({ label: 'Accès temporaire' }),
    silent: prop.boolean({ label: 'Sans notification' }),
  },
  run: (ctx, p) => access(ctx).setRank(p.rank, { temporary: p.temporary, silent: p.silent }),
  summarize: (p) => `Rang ${p.rank}${p.temporary ? ' (temporaire)' : ''}`,
});
```

A presentational action declares `essential: false` and checks `scope.skipping` itself. From
`civilizations/memory/mechanics/echo.ts`:

```ts
export const playEcho = defineAction({
  id: 'memory.playEcho',
  label: 'Jouer un écho',
  category: 'Mémoire',
  props: { echo: prop.string({ label: 'Écho' }), wait: prop.boolean({ label: 'Attendre la fin', default: false }) },
  async run(ctx, p, scope) {
    if (scope.skipping) return;
    const done = echoes(ctx).play(p.echo);
    if (p.wait) await done;
  },
  essential: false,
});
```

### 4.4 `defineCondition`

| Field | Type | Meaning |
|---|---|---|
| `id`, `label`, `description?`, `category?`, `props`, `summarize?` | | As for actions. |
| `test(ctx, props, scope)` | `(ctx: CivContext, props: InferProps<Props>, scope: LogicScope) => boolean` | Synchronous. |

`LogicInterpreter.test` returns `true` for a `null` condition (an empty `prop.condition()` means
"always"), `false` for an unknown type or when `test` throws (the error is logged).

From `civilizations/door/mechanics/access.ts`:

```ts
export const rankAtLeast = defineCondition({
  id: 'door.rankAtLeast',
  label: 'Le joueur a au moins le rang',
  category: 'Verrou',
  props: { rank: prop.integer({ label: 'Rang minimal', default: 1, min: -1, max: 2 }) },
  test: (ctx, p) => access(ctx).rank >= p.rank,
  summarize: (p) => `rang ≥ ${p.rank}`,
});
```

### 4.5 `defineEvent`

Events are emitted with `ctx.events.emit(name, payload)` or `ctx.entity.emit(name, payload)`
(which adds `entityId`). `defineEvent` only **documents** an event for the Studio and validation:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Event name. |
| `label` | `string` | Name in the Studio's event menus. |
| `description?` | `string` | |
| `fields` | `PropSchema` | Payload fields; the Studio builds the "where" filters of rules and objectives from them. |

The Studio's event picker (`EventEditor` in `src/studio/fields/LogicEditors.tsx`) only lists
documented events, and `npm run validate` warns about undocumented events used in content
("Événement non documenté"). An undocumented event can still be emitted and matched.

From `civilizations/door/mechanics/imprint.ts` (emitted by the `door.openImprint` action with
`ctx.events.emit('door.imprinted', {})`):

```ts
export const imprintedEvent = defineEvent({ id: 'door.imprinted', label: 'Plaque de Porteur empreinte', fields: {} });
```

TypeScript payload types: `EventPayload<K>` (`src/engine/core/events/eventMap.ts`) is typed for the
names declared in `CivEventMap` and is `Record<string, unknown>` for any other name. The header of
`eventMap.ts` shows how a pack could add typed events by declaration merging; neither Door nor
Memory does so.

### 4.6 Other definition kinds of `@sdk`

| Helper | Fields | Notes |
|---|---|---|
| `defineItem` | `id`, `name`, `description` (localization keys), `icon` (`IconSpec`), `category` (`'key' \| 'quest' \| 'document' \| 'tool' \| 'consumable' \| 'equipment' \| 'collectible' \| 'misc'`), `stackable?`, `maxStack?`, `questItem?`, `tags?`, `actions?` (`{ id, label, condition?, actions }[]`), `slot?` | Door and Memory declare their items in `content/items.json` instead (same shape, loaded by `loadPack`). |
| `defineAbility` | `id`, `name`, `description` (keys), `key` (`KeyboardEvent.code`), `icon`, `cooldown?`, `autoGrant?`, `canActivate?(ctx)`, `activate(ctx)` (returns `false` when nothing happened: no cooldown) | Activated by `GameSession.handleKey` for granted abilities; emits `ability.used`. Not used by Door or Memory. |
| `defineBlock` | `BlockDef` (`src/engine/core/voxel/blocks.ts`) | e.g. `civilizations/door/assets/blocks.ts`. |
| `defineModel` | `id`, `label`, `category?`, `build`, model options | e.g. `civilizations/memory/assets/models.ts`. |
| `defineSound` | `id`, `label`, `category` (`'sfx' \| 'ui' \| 'ambience' \| 'voice'`), `recipe` | Procedural recipes, e.g. `civilizations/door/assets/sounds.ts`. |
| `defineMusic` | `id`, `label`, `recipe` | Same file. |

`defineHud` and `definePanel` are in `@sdk/ui` ([§10](#10-interface-sdkui)); `defineVisual` and
`defineViewEffect` are in `@sdk/view` ([§11](#11-custom-rendering-sdkview)).

---

## 5. Behaviors: instance hooks and the interaction pipeline

### 5.1 `BehaviorInstance`

`create(ctx)` returns an object with any of these members (`src/engine/core/sim/api.ts`):

| Member | Called |
|---|---|
| `api?` | Public object returned by `entity.behavior<T>(componentType)` (e.g. `core.door` returns a `DoorApi`). |
| `update?(dt)` | Every simulation step while the entity is enabled and the session is not paused (`BehaviorSystem.update`). `dt` is clamped to 0.1 s. |
| `interaction?()` | When the player aims at the entity. Returns `InteractionOffer`, an array of offers, or `null`. |
| `decorateOffer?(offer, source)` | For each offer made by **another** component of the same entity; returns the offer to show. |
| `beforeInteract?(attempt)` | On **every** component of the entity before an interaction runs. Returns `InteractionBlock` to veto, `null`/`undefined` to allow. |
| `onInteract?(attempt)` | On the component that made the chosen offer. May return a promise (awaited). |
| `onPropsChanged?()` | After `entity.setProp(component, …)` changed this component's props. |
| `onVisibilityChanged?(visible)` | When the entity's `visible` or `enabled` changes; receives `visible && enabled`. |
| `dispose?()` | When the entity is destroyed (scene exit, despawn), before its scopes are released. |

`InteractionOffer`: `id?` (stable id such as `'open'`), `label` (localized), `detail?`, `enabled?`
(disabled offers are shown greyed out with `detail` as reason), `tone?`
(`'default' | 'locked' | 'danger' | 'special'`), `priority?`, `key?` (`'primary'` = E, default;
`'secondary'` = F).

`InteractionAttempt`: `{ entityId, offer, source }` where `source` is the component type that made
the offer. `InteractionBlock`: `{ reason, sound?, data? }`.

### 5.2 Lifecycle of a behavior (`src/engine/core/sim/behaviorSystem.ts`)

- On scene entry (or `ctx.world.spawn`), the records of all components of the entity are created
  first (props normalized, saved overrides applied, state restored or initialized), then the
  instances are created in the order of the entity's `components`. A behavior can therefore read
  sibling components in `create`. Mechanics are already set up at that point.
- An exception in `create`, `update`, `interaction`, `decorateOffer`, `onPropsChanged` or
  `onVisibilityChanged` disables that component only (`record.faulted`, logged under
  `composants`). An exception in `beforeInteract` is logged and the veto is ignored; in
  `onInteract` it is logged and the interaction returns `false`.
- On scene exit or despawn, `dispose()` is called on every instance, then the entity's scope is
  disposed (it contains each component's scope).
- An entity can only be aimed at through a pickable collider part. `ctx.entity.setCollider(part, box, { solid, pickable })`
  adds one (both options default to `true`); `core.model` with its default `collider: 'auto'`
  adds the model's bounds, pickable unless the model definition sets `pickable: false`.
  `memory.device` creates its own:

From `civilizations/memory/mechanics/chamber.ts`:

```ts
    ctx.entity.setCollider('device', { minX: -0.9, minY: 0, minZ: -0.6, maxX: 0.9, maxY: 1.6, maxZ: 0.6 }, { solid: false, pickable: true });
```

### 5.3 Interaction pipeline (`src/engine/core/sim/interaction.ts`)

1. The target is the first pickable collider hit within 3.2 m (`INTERACT_DISTANCE`). No target is
   computed while the player's movement is locked, a dialogue or a cinematic is active, or the game
   is paused.
2. Offers: `interaction()` of every component (only if the entity is visible and enabled), each
   decorated by the `decorateOffer` of the other components, sorted by `priority` (highest
   first). The first `primary` offer is bound to E, the first `secondary` offer to F.
3. If the chosen offer has `enabled: false`: notification with its `detail` (or
   `core.interaction.unavailable`), event `interaction.blocked`, stop.
4. `beforeInteract(attempt)` of every component in order. The first block shows `reason` as a
   `denied` notification, plays `sound` at the entity, emits `interaction.blocked`
   `{ entityId, interaction, reason, by: <component>, ...data }`, stop.
5. `onInteract(attempt)` of the source component (awaited; a second interaction is refused while one
   runs).
6. Event `entity.interacted` `{ entityId, interaction }`, where `interaction` is `offer.id`, or the
   component type when the offer has no id.

`session.interaction.interactWith(entityId, key?, offerId?)` runs the same pipeline without aiming
(tests and tools).

A lock is a separate component that annotates and vetoes another component's offer. From
`civilizations/memory/mechanics/closed.ts`:

```ts
  create(ctx) {
    const opens = () => !!ctx.props.openWhen && ctx.logic.test(ctx.props.openWhen, { self: ctx.entity.id });
    return {
      decorateOffer(offer: InteractionOffer, source: string): InteractionOffer {
        if (source !== 'core.door' || offer.id !== 'open' || opens()) return offer;
        return { ...offer, detail: ctx.t(ctx.props.detail), tone: 'locked' };
      },
      beforeInteract(attempt) {
        if (attempt.source !== 'core.door' || attempt.offer.id !== 'open' || opens()) return null;
        return { reason: ctx.t(ctx.props.text), sound: 'core:door_locked' };
      },
    };
  },
```

`door.memory` (`civilizations/door/mechanics/doorMemory.ts`) shows the other side: it counts
touches by listening to the events emitted by the pipeline, whatever the order of the components.

From `civilizations/door/mechanics/doorMemory.ts`:

```ts
    ctx.events.on('entity.interacted', (e) => {
      if (e.entityId === ctx.entity.id && e.interaction !== 'examine') touch(e.interaction);
    });
    ctx.events.on('interaction.blocked', (e) => {
      if (e.entityId === ctx.entity.id) touch('refused');
    });
```

---

## 6. Property schemas (`prop`)

`src/engine/core/props/props.ts`. One schema provides the TypeScript type of the values
(`InferProps<typeof schema>`), defaults and normalization, and the Studio form. Schemas are used by
behavior `props`, action and condition `props`, event `fields` and mechanic `settings`.

### 6.1 Builders

| Builder | `kind` | Default | Value type | Specific options |
|---|---|---|---|---|
| `prop.number(o?)` | `number` | `0` | `number` | `min`, `max`, `step`, `unit`, `slider` |
| `prop.integer(o?)` | `integer` | `0` (step 1) | `number` (rounded) | same |
| `prop.string(o?)` | `string` | `''` | `string` | `multiline`, `placeholder`, `pattern` |
| `prop.text(o?)` | `text` | `''` | localization key | `multiline` |
| `prop.boolean(o?)` | `boolean` | `false` | `boolean` | |
| `prop.enum(options, o?)` | `enum` | first option | union of values | options are strings or `{ value, label }`; an empty list throws |
| `prop.color(o?)` | `color` | `'#ffffff'` | `#rrggbb` string | |
| `prop.vec3(o?)` | `vec3` | `[0, 0, 0]` | `[number, number, number]` | `step` |
| `prop.entity(o?)` | `ref` (`entity`) | `''` | entity id | `withComponent` restricts the Studio picker |
| `prop.item`, `dialogue`, `quest`, `cinematic`, `scene`, `sound`, `model`, `character`, `block`, `variable`, `event`, `prefab`, `spawn`, `music`, `panel`, `ability` | `ref` | `''` | id string | |
| `prop.condition(o?)` | `condition` | `null` | `ConditionData \| null` | |
| `prop.actions(o?)` | `actions` | `[]` | `ActionData[]` | |
| `prop.list(item, o?)` | `list` | `[]` | array of the item type | `itemLabel` |
| `prop.object(fields, o?)` | `object` | `defaultsOf(fields)` | object | |
| `prop.json(o?)` | `json` | `null` | `JsonValue` | |

Options common to every builder: `label` (French, Studio), `description` (help text), `default`,
`advanced` (shown in the collapsed « Avancé » section), `hidden` (not shown, still normalized and
saved), `group` (declared, but not read by the Studio). `defaultsOf(schema)` returns deep copies of
the defaults.

A complex schema from `civilizations/memory/mechanics/echo.ts` (settings of `memory.echoes`):

```ts
    echoes: prop.list(
      prop.object({
        id: prop.string({ label: 'Identifiant' }),
        title: prop.text({ label: 'Titre' }),
        lines: prop.list(prop.text({ label: 'Réplique / description' }), { label: 'Répliques' }),
        tint: prop.color({ label: 'Teinte', default: '#c08aff' }),
        duration: prop.number({ label: 'Durée (s)', default: 8, min: 2, max: 30 }),
```

### 6.2 Normalization (`normalizeProps`)

Never throws; problems are returned as issues. Missing values take the default (deep copy). A value
of the wrong type is replaced by the default (error). Numbers outside `min`/`max` are clamped
(warning); `integer` values are rounded. `enum` values must be one of the options, `color` must
match `#rrggbb`, `vec3` must be three finite numbers, `condition` must be `null` or an object with a
string `type`, `actions` an array of such objects. Lists and objects are normalized recursively.
Keys not in the schema are dropped (warning "Propriété inconnue (ignorée)").

Where it runs: behavior props at instantiation (error-level issues are logged) and after each
`setProp`; action and condition props at each execution (error-level issues are logged as
warnings); mechanic settings when the civilization loads (all issues are logged as warnings by the
`règles` logger).

### 6.3 Props in Civilization Studio

The Studio generates forms from schemas (`PropFields`, `src/studio/fields/PropField.tsx`), so a new
prop appears without any UI code:

- Behavior props: in the inspector section of the component (`src/studio/panels/Inspector.tsx`).
  The Studio stores only the values that differ from the defaults in the scene file.
- Action and condition props: in the visual logic blocks (rules, dialogues, quests, cinematics,
  component props of kind `condition`/`actions`).
- Event fields: as optional "where" filters of rules and objectives.
- Mechanic settings: in « Règles des mécaniques » (see [§8](#8-mechanic-settings-contentrulesjson)).
- `prop.text` fields show and edit the French text of the key (a key is created in the pack's
  `locales/fr-FR.json` when the field is empty).
- `ref` fields get a list of known values (`refOptions` in `src/studio/ui/catalog.ts`); unknown
  values are marked invalid.

### 6.4 Validation of prop values

`npm run validate` checks every prop value present in content (`checkValue` in
`src/engine/core/packs/validate.ts`): `text` values must be existing French keys; `condition` and
`actions` values are checked recursively; references of kind `entity` (scene-aware), `item`,
`dialogue`, `quest`, `cinematic`, `scene`, `spawn`, `sound`, `music`, `model`, `character`,
`block`, `panel`, `ability` must exist; `variable` values must be `<civId>.*` or `global.*` (and a
`global.*` variable cannot be written by an action prop named `var` or `variable`); `event` values
not documented by `defineEvent` give a warning.

---

## 7. The runtime context

Mechanics (`setup`), actions (`run`), conditions (`test`), abilities and UI components receive the
civilization context `CivContext`. Behaviors receive a `BehaviorContext`, which is a `CivContext`
bound to the component's own scope plus `entity`, `props`, `state` and `component`. Interfaces:
`src/engine/core/sim/api.ts`; implementation: `src/engine/core/sim/contexts.ts`.

| Member | Type | Summary |
|---|---|---|
| `civId` | `string` | Id of the running civilization. |
| `mode` | `'play' \| 'playtest' \| 'headless'` | `play` in the game (`src/game/controller.ts`), `playtest` in Civilization Studio, `headless` in tests and `npm run validate`. |
| `t(key, params?)` | `string` | Localized text (see [§10.4](#104-localization-in-code)). |
| `log` | `Logger` | `debug`, `info`, `warn`, `error(message, err?)`; source = civ id. |
| `events` | `ScopedEvents` | `on`, `once`, `onAny`, `emit` ([§7.13](#713-events-ctxevents)). |
| `vars` | `VariablesApi` | Story variables ([§7.1](#71-variables-ctxvars)). |
| `multiverse` | `MultiverseApi` | Global state shared by civilizations ([§7.12](#712-multiverse-ctxmultiverse)). |
| `player` | `PlayerApi` | [§7.3](#73-player-ctxplayer) |
| `world` | `WorldApi` | Entities, voxels, raycasts ([§7.2](#72-world-and-entities-ctxworld-entityapi)). |
| `inventory` | `InventoryApi` | [§7.4](#74-inventory-ctxinventory) |
| `quests`, `dialogue`, `cinematics` | `QuestApi`, `DialogueApi`, `CinematicApi` | [§7.5](#75-story-ctxquests-ctxdialogue-ctxcinematics) |
| `ui` | `UiApi` | Notifications, documents, panels, HUD visibility, UI store ([§7.6](#76-interface-ctxui)). |
| `audio`, `fx` | `AudioApi`, `FxApi` | Presentation requests ([§7.7](#77-audio-and-presentation-ctxaudio-ctxfx)). |
| `input` | `InputApi` | Civilization keys ([§7.8](#78-input-ctxinput)). |
| `time` | `TimeApi` | Simulation clock and timers ([§7.9](#79-time-and-timers-ctxtime)). |
| `scenes` | `SceneApi` | `current`, `list()`, `goTo(sceneId, spawnId?)`. |
| `logic` | `LogicApi` | Run actions, test conditions ([§7.10](#710-logic-ctxlogic)). |
| `mechanics` | `MechanicsApi` | `get<T>(id)`, `has(id)`. |
| `lifecycle` | `LifecycleApi` | `on(phase, cb)` ([§7.11](#711-lifecycle-ctxlifecycle)). |
| `settings` | `SettingsApi` | `of<T>(mechanicId)`: normalized settings of a mechanic of the running civilization. |
| `scope` | `DisposableScope` | Owner of the context's registrations: `add`, `addFn`, `remove`, `child`, `size`, `isDisposed`. |
| `view` | `ViewBridge \| null` | Declared escape hatch to the renderer; currently always `null` ([§15](#15-limitations)). |

Scopes:

- Civilization context (mechanics, actions, conditions, abilities, HUD and panel components): scope
  `civ:<civId>`, released when the civilization unloads.
- Behavior context: scope `civ:<civId>/scene:<sceneId>/entité:<entityId>/<component>`, released when
  the entity is destroyed (scene exit, despawn) and in any case at unload.

Calls that register into the scope (released automatically): `events.on/once/onAny`,
`vars.watch/watchPrefix`, `player.lockMovement/lockLook/addMovementModifier`,
`ui.setHudVisible` (restores visibility), `ui.store.subscribe`, `audio.play` with `loop: true`
(stopped), `input.bind/onPressed`, `time.onUpdate/after/every/wait`, `lifecycle.on`.

### 7.1 Variables (`ctx.vars`)

| Method | Notes |
|---|---|
| `get<T>(name)` | Any variable. `global.*` names read the multiverse state (`global.fragments.<id>`, `global.flags.<name>`, `global.civs.<civ>.<field>`, `global.protagonist.awakenings`/`title`). |
| `set(name, value)` | Throws unless `name` starts with `<civId>.` ("La civilisation "door" ne peut écrire que ses variables (door.*)…"). A declared variable also checks the type. Setting an equal value does nothing. Emits `var.changed` `{ name, value, previous }`. |
| `add(name, delta)` / `toggle(name)` | Numeric add (missing = 0) / boolean flip; both go through `set`. |
| `has(name)` | |
| `declare(name, { type, default, description? })` | `type`: `'number' \| 'boolean' \| 'string' \| 'json'`. Sets the default only if the variable has no value (saved values are restored before mechanics are set up). Namespace-checked. |
| `watch(name, cb)` / `watchPrefix(prefix, cb)` | `cb(value, previous)` / `cb(value, previous, name)`. Scoped. |

Variables of the civilization are saved with the game and cleared at unload. Door keeps its rank in
declared variables so that dialogues and quests can read it with `core.var`:

From `civilizations/door/mechanics/access.ts`:

```ts
    ctx.vars.declare('door.rank', { type: 'number', default: -1, description: 'Rang : -1 sans plaque, 0 Sans-Seuil, 1 Porteur, 2 Gardien.' });
```

### 7.2 World and entities (`ctx.world`, `EntityApi`)

`WorldApi`: `sceneId`; `entity(id)` (or `null`); `require(id)` (throws when missing);
`query({ tag?, component?, near? })`; `spawn(doc, { persistent? })` (id defaults to
`<civId>_<random>`; only persistent spawned entities are saved); `despawn(id)` (a scene entity
removed this way stays removed in the save); `getBlock(x, y, z)`; `setBlock(x, y, z, blockId | null)`
and `fillBlocks(from, to, blockId | null)` (saved as voxel edits); `raycast(origin, dir, maxDistance)`
(entity colliders and voxels); `findPath(from, to)`; `groundAt(x, z, nearY)`; `modelInfo(modelId)`.

`EntityApi`: `id`, `name` (localized `core.npc` name, else the editor name, else the id), `tags`, `position`, `yaw`
(degrees), `setPosition`, `setYaw`, `visible` and `enabled` (settable; colliders follow),
`has(component)`, `props<T>(component)` (effective props), `setProp(component, key, value)`
(runtime override, saved; triggers `onPropsChanged` and refreshes visuals), `behavior<T>(component)`
(the component instance's `api`), `distanceToPlayer()`, `lookAt(target | 'player' | null)`,
`moveTo(target, opts?)` (resolves `true` on arrival and emits `npc.arrived`), `stop()`, `moving`,
`playAnimation(name, opts?)`, `setExpression(expression)`, `say(textOrKey, seconds?)`,
`setCollider(part, box | null, opts?)`, `setLights(lights)`, `emit(event, payload?)` (adds
`entityId`).

`setProp` is how a behavior changes what another component shows. From
`civilizations/memory/mechanics/recollection.ts`:

```ts
      if (model && ctx.entity.has('core.model') && ctx.entity.props<{ model?: string }>('core.model').model !== model) ctx.entity.setProp('core.model', 'model', model);
```

### 7.3 Player (`ctx.player`)

Read-only `position`, `eye`, `forward`, `yaw`, `pitch`, `grounded`, `movementLocked`, `movement`
(effective `MovementParams`); `setPosition(p)`; `teleport(entityIdOrPosition, yawDeg?)` (an id
resolves to an entity of the current scene, throws when missing); `setLook(yaw, pitch)`;
`lookAt(point)`; `lockMovement(reason)` / `lockLook(reason)` (stacking locks, `Disposable`);
`addMovementModifier(mod)` (`MovementModifier`: `id`, `priority?`, `modifyParams?`,
`modifyVelocity?`, `canJump?`, `onJump?`, `onLand?`); `setBaseMovement(patch)`; `abilities`
(`grant` throws for an ability the civilization does not define, `revoke`, `has`, `list`,
`cooldown`); `identity` (`title`, `setTitle(locKey | null)`); `box()`. Base movement, modifiers,
locks, abilities and title are reset at unload (`PlayerController.resetCivilizationState`).

### 7.4 Inventory (`ctx.inventory`)

`add(itemId, count = 1, { silent? })` (throws for an unknown item; notifies unless `silent`; emits
`item.acquired`; returns the new total), `remove(itemId, count = 1, { silent? })` (returns `false`
if not enough; emits `item.removed`), `count`, `has(itemId, count = 1)`, `list()`, `nameOf(itemId)`
(localized), `use(itemId, actionId?)` (runs the item's action if its condition holds; emits
`item.used`).

### 7.5 Story (`ctx.quests`, `ctx.dialogue`, `ctx.cinematics`)

- `QuestApi`: `start`, `status` (`'inactive' | 'active' | 'completed' | 'failed'`), `stage`,
  `setStage`, `completeObjective`, `isObjectiveDone`, `complete`, `fail`, `active()`, `track`.
- `DialogueApi`: `start(dialogueId, { entity? })` resolves `{ lastNode }` when the dialogue ends;
  `active`; `seen(dialogueId, nodeId?)`; `chose(dialogueId, choiceId)`. Inside a dialogue,
  `$self` is the entity the dialogue was started with.
- `CinematicApi`: `play(id)` resolves `{ skipped }`; `skip()`; `playing` (id or `null`).

Quests evaluate their conditions and event matchers on every event except `ui.*`
(`src/engine/core/sim/session.ts`), so a pack event can complete an objective directly
([§9](#9-actions-conditions-and-events-in-content)).

### 7.6 Interface (`ctx.ui`)

`notify(text, { kind?, icon?, duration? })` (`text` is already localized; kinds `info`, `success`,
`warning`, `denied`, `quest`, `item`, `memory`, `discovery`; 3.5 s by default);
`showLocation(title, subtitle?)`; `showDocument({ title, body, style?, footer? })` (locks movement
until closed); `openPanel<R>(id, props?)` (resolves with the panel's result or `null`, see
[§10.2](#102-definepanel)); `closePanel(id, result?)`; `isPanelOpen(id)`;
`setHudVisible(element, visible)` (elements `crosshair`, `prompt`, `objectives`, `notifications`,
`inventory`, `abilities`, `location`; restored at unload); `showEndScreen({ title, subtitle?, lines? })`;
`confirm({ title, message, confirm, cancel })`; `store`.

`ctx.ui.store` is a key/value store shared with the civilization's React components (`get`, `set`,
`subscribe`; read in React with `useUiStore`). It belongs to the running civilization, is empty when
the civilization loads and is **not** saved. Mechanics recompute it in `setup`: `memory.chamber`
calls its `sync()` at the end of `setup`.

### 7.7 Audio and presentation (`ctx.audio`, `ctx.fx`)

The simulation never calls the renderer. These methods emit requests on the presentation channel
(`src/engine/core/sim/presentation.ts`); headless sessions record them
(`session.presentation.history()`).

- `AudioApi`: `play(soundId, { at?, volume?, pitch?, loop? })` returns `{ stop() }` (`at` is a
  position or an entity id; looping sounds are stopped when the scope is released);
  `music(musicId | null, { fade? })`; `ambience(soundId | null, { fade? })`.
- `FxApi`: `fade(opacity, seconds, color?)` (returns a promise resolved after `seconds` of
  simulation time), `flash(color, seconds)`, `shake(intensity, seconds)`,
  `vignette(intensity, seconds, color?)`, `fov(delta, seconds)`, `tint(color | null, strength, seconds)`,
  `environment(patch, seconds)`, `custom(channel, payload)`.

`fx.custom(channel, payload)` is handled by the `defineViewEffect` whose `channel` matches
([§11](#11-custom-rendering-sdkview)). From `civilizations/memory/mechanics/echo.ts`:

```ts
        ctx.fx.custom('memory.echo', { ghosts: def.ghosts, objects: def.objects, duration: def.duration, tint: def.tint });
```

### 7.8 Input (`ctx.input`)

`bind(actionId, { key, label })` declares a key (`KeyboardEvent.code`) for the civilization;
`onPressed(actionId, cb)` is called on key down during gameplay (not while paused or while movement
is locked); `isDown(actionId)`. Both registrations are scoped. From
`civilizations/door/mechanics/access.ts`:

```ts
    ctx.input.bind('door.permissions', { key: settings.permissionsKey, label: 'door.input.permissions' });
    ctx.input.onPressed('door.permissions', () => {
      if (api.rank >= 0 && !ctx.ui.isPanelOpen('door.permissions')) void ctx.ui.openPanel('door.permissions');
    });
```

### 7.9 Time and timers (`ctx.time`)

`now` (simulation seconds; the clock only advances in `session.update`, not while paused),
`onUpdate(cb(dt))`, `after(seconds, cb)`, `every(seconds, cb)`, `wait(seconds)`. All are scoped. A
`wait` still pending when its scope is released never resolves: the code after the `await` does not
run. Simulated time makes waits deterministic in headless tests (`src/engine/core/sim/clock.ts`).

### 7.10 Logic (`ctx.logic`)

`run(actions, scope?)` returns a promise; `test(condition, scope?)` returns a boolean.
`LogicScope`: `self?` (entity id for `$self`), `event?` (`{ name, payload }` for `$event.*`),
`origin?` (label used in traces and error messages), `skipping?`. Engine and pack behaviors pass
`{ self: ctx.entity.id, origin: … }`; without `self`, `$self` resolves to `''`.

### 7.11 Lifecycle (`ctx.lifecycle`)

`on(phase, cb({ sceneId }))`, scoped. Phases (`LifecyclePhase`) and when `GameSession` runs them:

| Phase | When |
|---|---|
| `start` | Each time the civilization is loaded (new game or save), after the entry scene is entered, before the `civ.started` event. |
| `sceneEnter` | End of `enterScene`: entities instantiated, player placed; before `scene.entered`. |
| `sceneExit` | Start of `exitScene`: before `scene.exiting`, before the scene state is captured and behaviors destroyed. Also runs during unload. |
| `pause` / `resume` | When the paused state changes (`setPaused`; the game pauses for its menu overlays). |
| `beforeSave` | Start of `snapshotCivState` (save, and unload when the state is kept). |
| `unload` | Start of `unloadCivilization`, after the snapshot, before `civ.unloading`. |

From `civilizations/memory/mechanics/echo.ts`:

```ts
    ctx.lifecycle.on('sceneExit', () => {
      if (!playing) return;
      token++;
      playing = null;
      ctx.fx.tint(null, 0, 0.3);
      ctx.ui.store.set('memory.echo', null);
    });
```

### 7.12 Multiverse (`ctx.multiverse`)

`protagonist` (`awakenings`, `title`), `hasFragment`, `fragments()`, `grantFragment(id)` (requires
`fragments.<id>` in the manifest's `globalWrites`; emits `multiverse.fragmentAcquired`),
`getFlag`, `setFlag(name, value)` (requires a matching `flags.<pattern>` entry, e.g.
`"flags.door.*"` in `civilizations/door/manifest.json`), `isCivCompleted(civId)`, `markCompleted()`.
Unauthorized writes throw.

### 7.13 Events (`ctx.events`)

`on(name, handler(payload, name))`, `once`, `onAny(handler(name, payload))` and `emit(name, payload)`
(`src/engine/core/events/eventBus.ts`). Delivery is synchronous. A handler error is logged and
does not stop delivery; re-entrant emission deeper than 64 levels is refused and logged.

Engine events (`CivEventMap`): `civ.started`, `civ.unloading`, `civ.finished`, `scene.entered`,
`scene.exiting`, `zone.entered`, `zone.exited`, `trigger.entered`, `trigger.exited`,
`entity.interacted`, `interaction.blocked`, `door.opened`, `door.closed`, `item.acquired`,
`item.removed`, `item.used`, `var.changed`, `dialogue.started`, `dialogue.node`, `dialogue.choice`,
`dialogue.ended`, `quest.started`, `quest.stageChanged`, `quest.objectiveCompleted`,
`quest.completed`, `quest.failed`, `cinematic.started`, `cinematic.ended`, `npc.arrived`,
`player.jumped`, `player.landed`, `ability.used`, `multiverse.fragmentAcquired`, `save.completed`,
`ui.panelOpened`, `ui.panelClosed`. Those documented for the Studio are listed in
`src/engine/core/logic/coreEvents.ts`.

### 7.14 `BehaviorContext` additions

`entity` (the entity's `EntityApi`), `props` (effective props: normalized scene values plus runtime
overrides; an accessor, re-read it after `setProp`), `state` (the component's persistent state; an
accessor), `component` (the component type).

---

## 8. Mechanic settings (`content/rules.json`)

A mechanic declares `settings` with a prop schema; values live in the pack's `content/rules.json`
(`RulesSchema` in `src/engine/core/content/schemas.ts`), keyed by mechanic id.

From `civilizations/door/content/rules.json`:

```json
{
  "format": "civverse.rules",
  "version": 1,
  "settings": {
    "door.keyImprint": {
      "dial1": 2,
      "dial2": 0,
      "dial3": 4
    },
    "door.access": {
      "permissionsKey": "KeyR"
    }
  }
}
```

- When the civilization loads, each mechanic with a `settings` schema gets
  `normalizeProps(settings, rules.settings[id] ?? {})`. The result is the third argument of
  `setup` and is also returned by `ctx.settings.of(id)`. A missing file or entry means defaults.
- Settings are read at civilization load only; a change takes effect the next time the
  civilization is loaded.
- Settings can be data sets: `memory.chamber` defines its shards, `memory.echoes` its echoes and
  `memory.offering` its pedestals and solution (`civilizations/memory/content/rules.json`).
- In Civilization Studio, « Règles des mécaniques » (`RulesEditor` in
  `src/studio/editors/DataEditors.tsx`) shows a form for every mechanic of the open pack whose
  `settings` schema is not empty.

---

## 9. Actions, conditions and events in content

Registered actions, conditions and documented events are available everywhere content holds logic,
in the Studio's block menus (grouped by `category`, sorted by French `label`) and at runtime through
the interpreter:

| Content | Logic fields |
|---|---|
| Rules, `content/logic/*.logic.json` (`RuleSchema`) | `when` (event + `where`), `if` (condition), `then` / `else` (actions), `once`, `scene` |
| Dialogues, `content/dialogues/*.dialogue.json` | node `actions`, `branches[].condition`, `choices[].condition`, `choices[].actions` |
| Quests, `content/quests/*.quest.json` | `startWhen`, `startOn`, `onStart`, `onComplete`, `failWhen`, `onFail`, stage `onComplete`, objective `completeWhen` and `completeOn` |
| Cinematics, `content/cinematics/*.cinematic.json` | `actions` tracks (`items[].actions`, `items[].essential`), `onComplete` |
| Items, `content/items.json` | `actions[].condition`, `actions[].actions` |
| Component props | any `prop.condition` / `prop.actions` (`core.interactable.condition`, `core.trigger.onEnter`, `door.lock.onUnlock`, `memory.echoPoint.onFirst`...) |
| HUD elements (pack code) | `visibleWhen` of `defineHud` |

`where` values of event matchers may use `$self`, `$player` and `$event.<path>` like action props.

Examples from the packs:

A rule reacting to a pack event and testing a pack condition, from
`civilizations/door/content/logic/main.logic.json`:

```json
      "when": {
        "event": "door.rankChanged"
      },
      "then": [
        {
          "type": "core.teleportEntity",
          "entity": "varen",
          "target": "marque_bureau_varen",
          "yaw": 180
        }
      ],
      "name": "Varen rejoint son bureau du Registre (acte II)",
      "if": {
        "type": "core.all",
        "of": [
          {
            "type": "door.rankAtLeast",
            "rank": 1
          },
```

A pack action in dialogue node actions, from `civilizations/door/content/dialogues/eda.dialogue.json`:

```json
        {
          "type": "door.setRank",
          "rank": 2,
          "temporary": true
        },
```

A quest objective completed by a pack event with a filter, from
`civilizations/memory/content/quests/MEM_Q00_EVEIL.quest.json`:

```json
          "completeOn": {
            "event": "memory.examined",
            "where": {
              "shardId": "ambre"
            }
          }
```

A pack action in a cinematic `actions` track, from
`civilizations/memory/content/cinematics/M03_chambre_blanche.cinematic.json`:

```json
      "type": "actions",
      "items": [
        {
          "t": 1,
          "actions": [
            {
              "type": "memory.playEcho",
              "echo": "chambre_vente"
            }
          ]
        }
      ]
```

A pack condition used by an engine component, from
`civilizations/memory/content/scenes/reminence.scene.json` (entity `pas_1`, footprints shown only
while the `chemin` shard is anchored):

```json
        "core.conditional": {
          "states": [
            {
              "when": {
                "type": "memory.anchored",
                "shard": "chemin"
              },
              "visible": "show"
            }
          ],
          "otherwise": "hide"
        }
```

Skipped cinematics: action items run with `scope.skipping = true`; the interpreter skips actions
whose definition has `essential: false`, and the cinematic skips items marked
`"essential": false` (`src/engine/core/story/cinematics.ts`).

---

## 10. Interface: `@sdk/ui`

### 10.1 `defineHud`

`defineHud({ id, slot, order?, component, visibleWhen? })`.

| Field | Meaning |
|---|---|
| `id` | `<pack>.<name>`. |
| `slot` | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right' \| 'center' \| 'overlay'` |
| `order?` | Ascending order inside the slot. |
| `component` | React component without props. |
| `visibleWhen?` | Condition tested with the interpreter when the slot renders. |

HUD elements of the running civilization are registered when it loads and removed at unload. Each
is rendered inside an error boundary (`src/game/hud/CivUi.tsx`): a failing component is hidden and
logged, the rest of the HUD keeps working.

From `civilizations/door/ui/RankPlaque.tsx`:

```tsx
function RankPlaque() {
  const t = useT();
  const rank = useVar<number>('door.rank') ?? -1;
  const temporary = useVar<boolean>('door.rankTemporary') === true;
  const flash = useUiStore<number>('door.rankFlash') ?? 0;
```

```tsx
export const rankPlaqueHud = defineHud({ id: 'door.rankPlaque', slot: 'top-left', component: RankPlaque });
```

### 10.2 `definePanel`

`definePanel({ id, component, pausesGame?, title? })`. The component receives `PanelProps`:
`props` (the object passed to `ctx.ui.openPanel(id, props)`) and `close(result?)`.

- `ctx.ui.openPanel(id, props)` returns a promise resolved with the value given to `close`, or `null`
  (panel closed without result, replaced by a new opening of the same id, or civilization unloaded).
  It emits `ui.panelOpened`; closing emits `ui.panelClosed`.
- `pausesGame` (default `true`) locks the player's movement while the panel is open
  (`GameSession.openPanel`). It does not pause the simulation clock.
- While a panel is open the game view stops reading gameplay input (`GameController.setModal`).
- A panel that throws is closed with a `null` result and the error is logged.
- `title` is declared as the localization key of the panel title; the game UI does not read it.

An action that opens a panel and waits for its result, from
`civilizations/door/mechanics/imprint.ts`:

```ts
    const result = await ctx.ui.openPanel<{ success?: boolean }>('door.imprint');
    if (!result?.success) return;
```

The panel closes with the result, from `civilizations/door/ui/ImprintPanel.tsx`:

```tsx
    if (api.submit(dials)) {
      setDone(true);
      setTimeout(() => close({ success: true }), 900);
```

```tsx
export const imprintPanel = definePanel({ id: 'door.imprint', component: ImprintPanel, title: 'door.imprint.title' });
```

### 10.3 Hooks

| Hook | Returns |
|---|---|
| `useCiv()` | The civilization's `CivContext` (throws outside a civilization component). Components call mechanic APIs through it: `ctx.mechanics.get<ImprintApi>('door.keyImprint')` in `ImprintPanel.tsx`. |
| `useT()` | `(key, params?) => ctx.t(key, params)`. |
| `useVar<T>(name)` | Current value of a variable; re-renders on change (`ctx.vars.watch`). For `global.*` names it re-renders on `multiverse.fragmentAcquired` only. |
| `useUiStore<T>(key)` | Current value of `ctx.ui.store` for the key; re-renders on `set`. |
| `useEventRefresh(events)` | A counter that changes when one of the events fires. |

`CivUiContext` is the React context the game provides around civilization components. Components
are rendered with the civilization's theme as CSS variables set by `src/game/GameApp.tsx` from the
manifest `theme`: `--civ-accent`, `--civ-accent-soft`, `--civ-panel`, `--civ-panel-border`,
`--civ-text`, `--civ-text-dim`, `--civ-font`, `--civ-title-font`.

The usual data flow: the mechanic writes `ctx.ui.store` or a variable, the HUD reads it with
`useUiStore` or `useVar`. `door.access` writes `door.denied` on each refusal and the
`AccessDeniedStamp` HUD shows it; `memory.echoes` writes `memory.echo` and the `EchoOverlay` HUD
(`civilizations/memory/ui/ChamberHud.tsx`) shows its lines.

Headless sessions use `HeadlessUi` (`src/engine/core/sim/uiBridge.ts`): HUD definitions are
recorded in `ui.huds`, open panels in `ui.openPanels` (id → props) and they stay open until
`session.closePanel(id, result)` is called; notifications, documents, locations and end screens are
recorded; `confirm` answers `ui.confirmAnswer` (default `true`).

### 10.4 Localization in code

All player-visible text goes through keys of `locales/fr-FR.json` (flat JSON object, key → French
text; `LocaleSchema`). `ctx.t` and `useT` use the merged tables of the engine
(`src/engine/locales/fr-FR.json`) and every loaded pack. Messages support `{name}` interpolation,
`{n, plural, one {…} other {…}}` (French rule: 0 and 1 are singular) and
`{g, select, … other {…}}` (`src/engine/core/i18n/localizer.ts`). A missing key renders as `⟦key⟧`
and is reported once on the console.

---

## 11. Custom rendering: `@sdk/view`

Visual code is presentation only; the simulation does not depend on it. View modules are
registered with the pack (glob `./view/**/*.ts` in Door and Memory).

### 11.1 `defineVisual`

`defineVisual({ id, component, create(view, entity) })` renders a component type. `create` returns a
`VisualInstance` `{ update?(dt), dispose() }`.

- The entity view manager (`src/engine/view/entityViews.ts`) calls `create` for each entity that has
  the component, in the game, in the Studio playtest and in the Studio's editor viewport
  (`view.mode` is `'game'` or `'studio'`); never in headless sessions. A pack visual registered for
  a component type is used instead of the engine's built-in visual for that type.
- `VisualEntity`: `id`, `position`, `yaw`, `visible`, `tags`, `root` (a `TransformNode` at the entity
  transform; attach meshes to it), `props<T>(component)`, `state<T>(component)`, `flags`.
- An exception in `update` removes and disposes that visual (logged).

From `civilizations/door/view/spinner.ts` (the behavior only carries settings):

```ts
export const spinnerVisual = defineVisual({
  id: 'door.spinnerVisual',
  component: 'door.spinner',
  create(_view, entity) {
    return {
      update(dt) {
        const p = entity.props<{ speed?: number; axis?: 'x' | 'y' | 'z' }>('door.spinner');
        const delta = ((p.speed ?? 10) * Math.PI * dt) / 180;
        const axis = p.axis ?? 'z';
        for (const child of entity.root.getChildren()) {
          if (child instanceof TransformNode) child.rotation[axis] += delta;
        }
      },
      dispose() {},
    };
  },
});
```

### 11.2 `defineViewEffect`

`defineViewEffect({ id, channel, handle(view, payload) })` handles `ctx.fx.custom(channel, payload)`.
The game view (`src/engine/view/gameView.ts`) calls `handle` for each request in the game and the
Studio playtest; headless sessions only record the request. Exceptions are logged. The handler owns
whatever it creates: `memory.echoEffect` (`civilizations/memory/view/echoes.ts`) adds an
`onBeforeRenderObservable` observer and disposes its meshes and the observer when the echo's duration
has elapsed.

`ViewContext`: `scene` (Babylon `Scene`), `mode`, `quality`, `time`, `t(key, params?)`,
`createModel(modelId, name)`, `createParticles(preset, at, opts)`, `addGlow(mesh)`,
`addShadowCaster(mesh)`, `lightAt(point)`.

---

## 12. Persistence

| What | Where it is saved (`LocalCivState`, `src/engine/core/save/saveFormat.ts`) | Versioning |
|---|---|---|
| Mechanic `state` | `mechanics[id] = { version, state }` | `state.version` + `state.migrate`. A newer saved version, or a missing migration step, logs a warning and falls back to `initial()`. |
| Behavior `state` | `scenes[sceneId].entities[entityId].states[component]` | Same rules, `initial(props)` as fallback. |
| `setProp` overrides | `scenes[sceneId].entities[entityId].overrides` | — |
| Entity transform, visibility, enabled | `scenes[sceneId].entities[entityId]` | — |
| Persistent spawned entities, removed scene entities, voxel edits | `scenes[sceneId].spawned`, `removed`, `voxelEdits` | — |
| Variables of the civilization | `vars` | — |
| Inventory, quests, dialogue history, fired `once` rules, player state | `inventory`, `quests`, `dialogue`, `rulesFired`, `player` | — |
| Whole local state | `stateVersion` (manifest) | `definePack({ migrations })`; a missing step aborts the load with an error. |

Not saved: `ctx.ui.store`, closures and local variables of `setup`/`create`, non-persistent spawned
entities.

The session `structuredClone`s states into the save, and the playthrough tests round-trip saves
through `JSON.stringify` and `parseSave`: keep states JSON-compatible and mutate the object received
in `setup` or `ctx.state` in place.

---

## 13. Unloading, cleanup and isolation

`GameSession.unloadCivilization` (`src/engine/core/sim/session.ts`) runs, in order:

1. Snapshot of the local state (unless `keepState: false`), which runs `beforeSave`.
2. `unload` lifecycle callbacks, then the `civ.unloading` event.
3. Dialogue and cinematic aborted.
4. Scene exit: `sceneExit` callbacks, `scene.exiting`, scene state captured, `dispose()` of every
   behavior instance, entity and scene scopes released.
5. Open panels resolved with `null` and closed; panel movement locks released.
6. `civ.scope.dispose()`: every registration made through the civilization context and its child
   scopes (listeners, watchers, timers, `onUpdate` callbacks, input bindings and handlers, lifecycle
   callbacks, UI store subscriptions, HUD registrations, movement modifiers, locks, HUD visibility
   overrides, looping sounds), in reverse registration order.
7. Rules unloaded; quests, the civilization's variables and declarations, inventory and dialogue
   history cleared; player civilization state reset; civilization UI reset (`ui.resetCiv`);
   definitions and locale table of the civilization pack unregistered; pause reasons and pressed keys
   cleared.

`src/engine/core/sim/session.test.ts` ("isolates civilizations: switching unloads listeners, timers
and registrations") checks this: after switching civilization, the first pack's condition, behavior,
block, variables and texts are gone, its mechanic state no longer changes, and after unload
`session.leakedListeners` is 0, `session.clock.timerCount` is back to its baseline and
`session.player.modifierCount` is 0.

Not covered by the scope:

- Anything registered outside `ctx`: `window` listeners, `setTimeout`, Babylon observers. React
  effects must clean up after themselves (the Door and Memory panels add a `window` `keydown`
  listener in `useEffect` and remove it in the cleanup function).
- Module-level variables of pack modules: modules are evaluated once and are not reloaded when a
  civilization unloads. Keep state in `state`, in variables or in closures created by
  `setup`/`create`.
- Dependency (library) packs stay registered after the civilization unloads; only the civilization
  pack is unregistered.

`ctx.scope.addFn(fn)` runs `fn` when the scope is released. A registration attempted on an
already released scope is refused and disposed immediately (`DisposableScope.add`).

---

## 14. Engine API version

- `src/engine/core/version.ts`: `ENGINE_VERSION = '0.1.0'` (written into saves as `engineVersion`)
  and `ENGINE_API_VERSION = '1.0.0'` (the version of the SDK and runtime API). Both are exported by
  `@sdk`.
- Every manifest declares `engineApi`, a semver range; Door, Memory and core declare `"^1.0.0"`.
- `GameSession.refreshManifests` rejects a pack when `satisfies(ENGINE_API_VERSION, manifest.engineApi)`
  is false (`src/engine/core/util/semver.ts` supports `^`, `~`, `>=`, `<=`, `>`, `<`, `=` and exact
  versions): the pack is logged as an error ("Le pack "x" requiert l'API … (moteur : …).") and is not
  offered, and `npm run validate` reports it.
- `npm run civ -- new-pack <id>` writes `engineApi: "^<major>.0.0"` from the current
  `ENGINE_API_VERSION`.
- The comment in `version.ts` asks to bump the major version on breaking API changes and to document
  migrations in [`docs/VERSIONING.md`](VERSIONING.md), which lists the version numbers, the
  load-time checks and the bump rules.

---

## 15. Limitations

Verified against the current code:

- **No mechanic hooks besides `setup`.** No `dispose`, no `update`; use `ctx.time`, `ctx.lifecycle`
  and `ctx.scope`.
- **Only the civilization pack's mechanics, HUD elements, panels and abilities are activated.**
  Library packs listed in `dependencies` contribute behaviors, logic types, assets, visuals, view
  effects and texts only.
- **`dependsOn` resolves within the pack.** A missing or circular dependency prevents the
  civilization from loading.
- **A mechanic whose `setup` throws** is only logged; `ctx.mechanics.get(id)` then returns
  `undefined`. `npm run validate` does not report it (see below).
- **Settings are read when the civilization loads**, not while it runs.
- **`npm run validate` does not check `content/rules.json`** (unknown fields, references and text
  keys inside settings), does not report errors logged while the civilization boots (mechanic
  `setup` failures, behavior faults; headless sessions do not echo logs to the console), only
  instantiates the entry scene's behaviors, and only checks localization keys written literally as
  `t('key')` in code (keys built at run time, such as `` t(`door.rank.${Math.min(2, rank)}`) `` in
  `civilizations/door/ui/RankPlaque.tsx`, are not checked).
  The playthrough tests assert `session.logHub.errors()` is empty to catch runtime errors.
- **`BehaviorDefinition.internal` is not implemented**: the « Ajouter un composant » menu lists every
  behavior.
- **The prop option `group` is not used** by the Studio's forms (Door's `door.lock` sets it).
- **`requires` is a Studio convenience**: it is not enforced at runtime or by validation.
- **`definePanel({ pausesGame })` does not pause the simulation**: it only locks player movement;
  timers, behaviors and NPCs keep running while a panel is open. `PanelDefinition.title` is not
  read by the game UI.
- **`defineHud({ visibleWhen })`** is tested when the HUD slot renders; the slot does not subscribe
  to variable changes. Door and Memory do not use it; their components return `null` from
  `useVar`/`useUiStore` values instead.
- **`useT()`** does not subscribe to locale changes (its comment says it re-renders on locale
  change). French is the only locale shipped.
- **`ctx.view` is always `null`**: `GameSession.view` is never assigned.
- **`VisualEntity.flags`** has no writer in the SDK: no context API sets an entity's view flags.
- **Input labels** given to `ctx.input.bind` are stored but not displayed, and civilization keys
  cannot be rebound in the game settings.
- **Event payload types**: typed only for `CivEventMap` names; packs emit untyped payloads.
- **Type id format** (`<pack>.<name>`) is not enforced; sounds, music, visuals and view effects are
  silently replaced on id collision.
- **The Studio's variable picker** (`knownVariables` in `src/studio/ui/catalog.ts`) lists names
  found in the pack's content under the keys `var`, `variable`, `consent`, `examineVar` and `flag`;
  variables declared in code with `ctx.vars.declare` appear only if content references them.
