# Equipment and combat

Engine foundations for civilizations where the player holds, wears and really uses items, and
fights: hotbar and item in hand, item uses on the mouse buttons, worn items, player health, guard,
parry and dodge, enemies with telegraphed attacks, encounters, bosses, checkpoints, tool targets.
They were added for Mask Civilization (see
[`narrative/FUTURE_CIVILIZATIONS_GUIDELINES.md`](narrative/FUTURE_CIVILIZATIONS_GUIDELINES.md)) and
are generic: any civilization can use them, and each civilization gives them its own look and rules.

Everything here is **inactive by default**. A civilization without holdable items and that does not
call `ctx.combat.enablePlayer()` (Door, Memory) sees no hotbar, no health, no damage and no dodge.

| Code | Role |
|---|---|
| `src/engine/core/equipment/equipment.ts` | `EquipmentSystem`: hotbar, item in hand, worn items, use dispatch, hand animation state. |
| `src/engine/core/equipment/coreUses.ts` | Engine item uses `core.melee`, `core.guard`, `core.useOnTarget`, `core.shoot`, `core.runActions`. |
| `src/engine/core/combat/combat.ts` | `CombatSystem`: player health, guard/parry/riposte, dodge, damage, projectiles, shockwaves, defeat and checkpoint, combat music; `HealthApi`, `CombatantApi`. |
| `src/engine/core/behaviors/combat.ts` | Components `core.health`, `core.combatant`, `core.encounter`, `core.boss`, `core.checkpoint`, `core.toolTarget`. |
| `src/engine/view/heldItemView.ts` | First-person view of the item in hand. |
| `src/engine/view/combatEffects.ts` | Projectiles, shockwaves, ground telegraphs, impact sparks, hit punch, falls, exposed weak points. |
| `src/game/hud/Combat.tsx` | Hotbar, worn items, mouse-button verbs, progress ring, hit marker, health, boss bar, enemy bars, hurt direction, defeat screen. |
| `src/engine/core/combat/combat.test.ts` | Headless tests of all of the above (16 tests). |

---

## 1. Items in hand

### 1.1 Declaring a holdable item

An item becomes holdable with a `held` field (in `content/items.json` or `defineItem`):

```json
{
  "id": "mask:marteau_cendre",
  "name": "mask.item.marteau",
  "description": "mask.item.marteau.desc",
  "icon": { "shape": "key", "color": "#d9893a" },
  "category": "equipment",
  "held": {
    "model": "mask:marteau",
    "offset": [0.26, -0.24, 0.5],
    "rotation": [20, -14, -7],
    "scale": 1,
    "drawTime": 0.3,
    "primary": { "type": "core.melee", "damage": 12, "tags": ["braise"], "charge": { "seconds": 0.9, "guardBreak": true } },
    "secondary": { "type": "core.guard", "parryWindow": 0.2 }
  }
}
```

| Field | Default | Meaning |
|---|---|---|
| `model` | — | Model shown in the hand. Without it, a small tool shape in the colors of the icon. |
| `offset` | `[0.26, -0.24, 0.5]` | First-person position relative to the camera, in meters (right, up, forward). |
| `rotation` | a slight forward tilt | Degrees (x, y, z). |
| `scale` | 1 | |
| `drawTime` | 0.3 | Seconds after taking the item in hand before it can be used. |
| `primary` / `secondary` | — | Left / right click: an item use (`type` + its props). |

The Studio edits all of it in **Objets → En main** (a block per mouse button, like action blocks).
`npm run validate` checks the model, the use types and their props.

### 1.2 Hotbar and hand

- Six slots. A holdable item goes to the first free slot when it is acquired (only the first
  time: an item the player removed from the bar is not put back). If the selected slot receives
  it, it is taken in hand at once.
- Keys 1–6 select a slot; the mouse wheel goes to the next/previous slot holding an item. The item
  of the selected slot is in hand.
- Losing the item in hand (consumed, taken by the story) empties the hand.
- The inventory panel offers **Prendre en main**.
- Changing the item in hand interrupts the uses in progress and plays the draw animation.

`ctx.equipment` (`EquipmentApi`, `src/engine/core/sim/api.ts`): `held`, `hotbar()`, `selected`,
`select(i)`, `hold(itemId | null)`, `assign(i, itemId | null)`, `ready(button?)`,
`drawRemaining`, `delayUse(s)`, `cancelUses()` (a shove interrupts a long use), `press(button)` /
`release(button)` (tutorials, tests),
`setProgress({ label, value } | null)`, `setUnarmed({ primary?, secondary? })` (uses of the empty
hand), `hand` (`play(animation, s)`, `hold(animation)`), and:

```ts
// Mask: a mask needs attuning, and switching too fast overloads it.
ctx.equipment.guardSwitch(({ from, to }) => {
  if (overloaded()) return { allow: false, reason: ctx.t('mask.overload.refused') };
  if (isMask(to)) return { drawTime: 0.6 };
});
```

A switch guard may refuse (`allow: false`, the reason is shown) or delay the use of the new item
(`drawTime`; the longest asked wins). It is released with the civilization's scope.

Events: `item.held` (`itemId`, `previous`; `''` = empty hand), `item.switchRefused`, `item.used`
(with `action` = `'primary'`/`'secondary'` and `use` = the use type).

### 1.3 Item uses

What a mouse button does is an **item use**, registered like an action and referenced by type:

```ts
import { defineItemUse, prop } from '@sdk';

export const grapple = defineItemUse({
  id: 'mask.grapple',
  label: 'Grappin du Fil',
  category: 'Masques',
  mode: 'press', // 'press' | 'hold' | 'charge'
  hint: 'mask.use.grapple', // verb next to the mouse button in the HUD
  props: { reach: prop.number({ label: 'Portée (m)', default: 14 }), cooldown: prop.number({ default: 0.8 }) },
  aim: (use) => (findAnchor(use) ? use.ctx.t('mask.use.grappleTo') : null), // contextual verb
  start(use) {
    const anchor = findAnchor(use);
    if (!anchor) return false; // nothing happened: no cooldown
    use.ctx.player.forceMove(towards(anchor, 16), 0.5, { gravity: false });
    use.hand.play('cast', 0.3);
  },
});
```

| Mode | Calls |
|---|---|
| `press` | `start` once per click. |
| `hold` | `start` on press, `update(use, dt)` every frame while held, `stop` on release. |
| `charge` | Same as hold; `stop` reads `use.heldFor` to tell a tap from a charged release. |

`ItemUseContext`: `ctx`, `props`, `itemId` (null for the empty hand), `button`, `heldFor`,
`cancelled` (true in `stop` when a dialogue, a hit, a scene change or an item change interrupted
the use), `hand`.

- `start` returning `false` means nothing happened: no cooldown, no `item.used`.
- Cooldown: `cooldown(props)` if defined, else `props.cooldown`, per item and button.
- Uses never run during dialogues, locking cinematics, panels, pauses, a draw/attunement delay,
  a defeat or a stagger.
- `aim(use)` is called every frame for the item in hand: a string replaces the HUD verb, `null`
  falls back to `hint` (or `props.hint`).

Engine uses (`src/engine/core/equipment/coreUses.ts`):

| Type | Mode | Does |
|---|---|---|
| `core.melee` | charge | Strike in front (`damage`, `reach`, `arc`, `knockback`, `stagger`, `guardBreak`, `tags`, `cooldown`, `animation`, `sound`); held past `charge.seconds`, the release gives a charged strike (`charge.damage`, `knockback`, `stagger`, `guardBreak`, `tags`). A progress ring shows the charge. |
| `core.guard` | hold | Raises the guard ([§2.2](#22-guard-parry-riposte-dodge)): `arc`, `reduction`, `parryWindow`, `parryStagger`, `riposte`, `reflect`, `moveFactor`. |
| `core.useOnTarget` | hold | Hold while aiming at a `core.toolTarget` whose `tool` matches; a progress ring fills; the target's `onUse` actions run. Its verb only shows while aiming at a valid target. |
| `core.shoot` | press | Projectile toward the crosshair (`damage`, `speed`, `radius`, `gravity`, `color`, `tags`, optional `ammo` item consumed). |
| `core.runActions` | press | Runs logic actions if `condition` holds. |

### 1.4 Worn items

An item with a `slot` (`"masque"`, `"gants"`…) can be worn there, one item per slot:
`ctx.equipment.equip(itemId)`, `unequip(slot)`, `worn(slot)`, `wornItems()`; inventory buttons
**Porter** / **Retirer**; actions `core.equipItem`, `core.unequipSlot`; condition `core.wearing`;
events `item.equipped`, `item.unequipped`. An item leaving the inventory is unequipped.

`grants: ["mask.elan"]` gives abilities (defined by the civilization) while the item is worn. An
ability only granted by a worn item is left out of saves and removed with the item; an ability the
story also grants (`ctx.player.abilities.grant`) stays.

---

## 2. Player combat

### 2.1 Turning it on

```ts
defineMechanic({
  id: 'mask.combat',
  setup(ctx) {
    ctx.combat.enablePlayer({
      maxHealth: 100,     // default 100
      regenDelay: 5,      // s without being hit and out of combat before health comes back
      regenRate: 12,      // health per second
      respawnDelay: 2.6,  // s between a defeat and getting back up
      dodge: { speed: 10.5, duration: 0.2, cooldown: 0.55, iframes: 0.3 }, // or false
      music: 'mask:music.combat', // while enemies fight the player
    });
  },
});
```

`ctx.combat.player` gives `health`, `maxHealth`, `defeated`, `guarding`, `staggered`, `riposte`
(seconds left). Also `inCombat`, `tuning`, `damagePlayer(info)`, `healPlayer(n)`,
`setPlayerMaxHealth(n, refill?)`, `setInvulnerable(s)`, `dodge(direction?)`,
`raiseGuard(spec)` (returns the release function), `strike(spec)`.

### 2.2 Guard, parry, riposte, dodge

- **Guard** (held): blows from the front arc lose `reduction` of their damage (and most of their
  knockback); the player moves at `moveFactor` speed. A `guardBreak` blow breaks it: half damage,
  0.7 s stagger.
- **Parry**: a blow landing within `parryWindow` seconds after the guard was raised does nothing;
  the attacker staggers `parryStagger` seconds and a **riposte** opens for `riposte` seconds: the
  next strike breaks guards and deals double damage. With `reflect`, a parried projectile flies back
  to its shooter.
- **Dodge** (`dodge` action, Q by default, « A » on AZERTY): a quick sidestep in the movement
  direction (backward without input), with invulnerability frames. Only on the ground.
- **Stagger**: no item use, no dodge, no ability while it lasts.
- Blows never land during dialogues or locking cinematics.

### 2.3 Damage

`DamageInfo`: `amount`, `source` (entity id, `'player'`, or null), `from` (direction), `kind`,
`knockback` (m/s), `stagger` (s), `guardBreak`, `unblockable`, `tags`. `HitResult`:
`{ outcome, damage }` with `outcome` among `hit`, `blocked`, `parried`, `guardBroken`, `immune`,
`ignored`, `defeated`.

The **Indulgente** difficulty (game settings) halves the damage taken, lengthens enemy telegraphs
by 35 % and widens the parry window by 0.08 s.

### 2.4 Defeat and checkpoints

At 0 health the player falls (« À terre… »), movement and look are locked, the screen fades, and
after `respawnDelay` the player gets back up with full health at the **checkpoint**: the place
where they entered the scene, or the last `core.checkpoint` volume crossed, or
`ctx.combat.setCheckpoint(entityIdOrPosition?, yawDeg?)` / action `core.setCheckpoint`. Events
`combat.playerDefeated`, `combat.playerRespawned`. Encounters in progress start over.

### 2.5 Combat music

While a combatant fights the player (`reportEngaged`), `inCombat` is true and the `music` given to
`enablePlayer` plays; three seconds after the last enemy stops, the music that played before comes
back. `ctx.combat.pushMusic(id, priority?)` plays a music until the returned function is called:
the highest priority wins (0 generic combat music, 1 encounters, 2 bosses), then the latest.
Event `combat.engaged` (`engaged`).

---

## 3. Components

All are in the Studio's **Combat** category (and `core.toolTarget` in **Interactions**).

### 3.1 `core.health` — anything that can be hit

Enemies, allies, training dummies, breakable objects. Props: `max`, `faction` (`enemy`, `ally`,
`neutral`), `armor`, `weakTo` (tags × `weakMultiplier`), `resists` (tags × 0.5), `onlyHurtBy`
(only these tags hurt, unless the target is **exposed**), `invulnerable`, `knockback` (×),
`onDefeat` (`remove`, `down`, `yield`, `stay`), `defeatActions`, sounds, `showBar`, `regen`.
State `{ health, defeated }` (saved). API (`HealthApi`): `health`, `max`, `defeated`, `faction`,
`exposed`, `damage(info)`, `heal(n)`, `revive(health?)`, `expose(s)`, `shield(s)`.
Events `combat.hit` (`outcome`, `amount`, `tags`…), `combat.defeated`.

Factions: the player is `ally`. Enemies hurt allies; allies hurt enemies and neutral things; neutral
hazards hurt everyone (`isHostile` in `@sdk`).

### 3.2 `core.combatant` — enemies and allies that fight

Requires `core.health`. A state machine: idle → chase → **windup** (telegraphed: an animation, a
sound, a ground arc or circle that fills up, a spark above the attacker) → active → recover; it
staggers when parried or when its balance (`poise`) breaks, gives up beyond `leashRadius` and walks
back to its post.

Props: `engageOn` (`sight` or `manual`: encounters, scripts, or being hit), `aggroRadius`,
`leashRadius`, `speed`, `keepDistance`, `guard` (`none` or `front`: a shield that blocks blows from
the front unless they break guards), `guardArc`, `poise`, `staggerTime`, `maxAttackers` (how many
may attack the player at once), `height`, `width`, `solid`, and `attacks`:

| Attack field | Meaning |
|---|---|
| `kind` | `melee` (arc in front), `lunge` (dash forward), `slam` (circle around), `wave` (expanding ring to jump over), `projectile` |
| `range`, `minRange` | When it may be chosen |
| `windup`, `active`, `recover`, `cooldown` | Timing (the windup is the telegraph) |
| `damage`, `knockback`, `stagger`, `guardBreak`, `unblockable`, `tags` | The blow |
| `arc`, `speed`, `count`, `spread` | Shape, projectile/wave/lunge speed, volley |
| `weight`, `phase` | Choice frequency; minimum boss phase |
| `color`, `sound`, `windupSound` | Telegraph color and sounds |

The turn toward the target stops shortly before the blow: a committed attack can be sidestepped.
API (`CombatantApi`): `state`, `engaged`, `engage()`, `disengage()`, `reset()`, `stagger(s)`,
`blocks(info)`, `setPhase(n)`. A character with `core.npc` keeps its look and gets combat gestures;
its idle routine pauses while it fights.

### 3.3 `core.encounter` — arenas and waves

A volume (`size`, `offset`) that starts the fight when the player enters (`startOn: enter`) or by
action (`core.startEncounter`). Props: `condition`, `title` (shown on screen), `waves`
(`{ enemies, delay }`: later waves are hidden until their turn), `barriers` (entities shown during
the fight), `music`, `resetOnDefeat`, `onStart`, `onComplete`. State `{ status, wave }`: a finished
encounter stays finished; one interrupted by a save or a defeat starts over (enemies revived and
back at their posts). Events `combat.encounterStarted`, `combat.encounterWave`,
`combat.encounterCompleted`, `combat.encounterReset`; condition `core.encounterDone`.

### 3.4 `core.boss`

Requires `core.health` and `core.combatant`. Shows the boss bar (`name`, `title`) while it fights or
is hurt; `phases` (`at`: health fraction, `shield`: invulnerable seconds, `actions`) unlock attacks
with a higher `phase` and emit `combat.bossPhase`; `music` (priority 2). The bar empties at defeat
and disappears 1.5 s later.

### 3.5 `core.checkpoint`

A volume: crossing it makes it the place where the player gets back up. Announced once
(« Point de reprise ») when `notify` is set and combat is enabled.

### 3.6 `core.toolTarget` — what a tool works on

`tool` (the tag a `core.useOnTarget` must carry), `label` (verb shown while aiming: « Réparer la
pompe »), `holdSeconds`, `once`, `toolSound` (default `true`; `false` skips the tool's « done »
sound when the target plays its own, e.g. a timed adjustment that can miss), `condition`, `onUse`
(actions), aim volume (`size`, `offset`). Event `tool.used`.

### 3.7 Logic in content

Actions: `core.holdItem`, `core.equipItem`, `core.unequipSlot`, `core.damagePlayer`,
`core.healPlayer`, `core.damageEntity`, `core.reviveEntity`, `core.exposeEntity`, `core.engage`,
`core.startEncounter`, `core.completeEncounter`, `core.setCheckpoint`. Conditions: `core.holding`,
`core.wearing`, `core.entityDefeated`, `core.encounterDone`, `core.playerHealth`, `core.inCombat`.
Events: see above (all listed in the Studio's rule and objective editors).

---

## 4. Presentation

- **Hand** (`heldItemView.ts`): the model of the item in hand in its own rendering group (never
  inside walls), lit by the voxel light where the player stands, swaying with steps and mouse look,
  hidden during dialogues, cinematics and defeats. Animations come from the equipment's hand state:
  `draw`, `swing`, `swingHeavy`, `thrust`, `recoil`, `use`, `cast`, `inspect`, and held poses
  `raise` (guard, aim), `charge`, `use`, `cast`, `inspect`.
- **World** (`combatEffects.ts`): telegraphs on the ground (an arc for melee, a circle for slams and
  shockwaves, a narrow cone for lunges and shots) that fill up until the blow, with a pulsing spark
  above the attacker; glowing projectiles; shockwave walls; impact sparks colored by outcome; a
  short squash of the hit entity; props without a character body tip over when defeated; a ring
  around exposed weak points.
- **Characters**: combat gestures `combat_idle` (also kept between attacks), `windup`, `attack`,
  `slam`, `cast`, `block`, `stagger`, `defeat`, `yield`, `cheer`; masks as accessories
  ([PACK_FORMAT](PACK_FORMAT.md)).
- **HUD** (`src/game/hud/Combat.tsx`), in the civilization's theme colors: hotbar (with worn items
  and the name of the item taken in hand), mouse-button verbs, progress ring, hit marker, health
  (bottom left), boss bar (top), small bars above enemies just hit, the direction of a blow taken,
  defeat screen. A civilization can hide them (HUD elements `hotbar`, `health`, `bossBar`,
  `handHints`, in the manifest's `hud.hide` or with `ctx.ui.setHudVisible`) and draw its own with
  `defineHud`.
- Entity view flags written by the combat components (readable by pack visuals through
  `VisualEntity.flags`): `telegraph` (`kind`, `progress`, `range`, `arc`, `color`), `combatState`,
  `hit` (serial), `hitOutcome`, `health` (fraction), `healthBar`, `defeated`, `exposed`,
  `holdAnimation`. Behaviors write their own with `entity.setViewFlag(key, value)`.

---

## 5. Input

New bindable game actions (settings → Commandes), with French labels:

| Action | Default |
|---|---|
| `attack` (« Frapper / utiliser l’objet en main ») | Clic gauche |
| `block` (« Parer / viser ») | Clic droit |
| `dodge` (« Esquiver ») | Q (« A » on AZERTY) |
| `hotbar1` … `hotbar6` | 1 … 6 |
| `nextItem` / `prevItem` | Molette ↓ / ↑ |

Mouse buttons and the wheel count only while the pointer is locked, so the click that captures the
mouse never strikes. The context menu is disabled over the game.

---

## 6. Saves

`LocalCivState.player` gains two optional fields (older saves load unchanged):

- `equipment`: `{ hotbar, selected, worn }`;
- `combat`: `{ health }` (civilizations with combat).

Abilities only granted by worn items are not written in `player.abilities`.

---

## 7. Limitations

- No hold-to-aim camera zoom and no ammunition counter in the HUD (`core.shoot` can consume an item).
- Combatants steer straight toward their target and use pathfinding only when they lose sight of
  it; they do not jump or climb.
- Enemies only target the player and characters with `core.combatant`; neutral entities are never
  attacked.
- The boss bar shows one boss at a time.
- Projectiles stop at the first solid voxel; they ignore non-solid colliders.
- A music change made by a zone during a fight is replaced by the music saved when the fight
  started, once it ends.
