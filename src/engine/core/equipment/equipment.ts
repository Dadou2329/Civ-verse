/**
 * Equipment: the hotbar, the item in hand and worn items.
 *
 * - Hotbar: six slots. Holdable items (`held` in their definition) go to the first free slot when
 *   they are acquired; 1–6 and the mouse wheel select a slot, and the item of the selected slot is
 *   in hand: shown in first person and used with the mouse buttons.
 * - Uses: each mouse button of the item in hand runs a registered item use (`defineItemUse`) with
 *   its props, in `press`, `hold` or `charge` mode, with cooldowns and hand animations.
 * - Worn items: an item with a `slot` is worn there (one per slot) and grants its abilities while
 *   it is worn.
 * - A civilization can refuse or slow down a change of item in hand (a mask that needs to be
 *   attuned, an overload) with `ctx.equipment.guardSwitch`.
 *
 * Nothing here runs for civilizations without holdable or wearable items.
 */
import type { GameSession } from '../sim/session';
import type { HandAnimation, HandApi, ItemDefinition, ItemUseContext, ItemUseData, ItemUseDefinition } from '../packs/definitions';
import { normalizeProps, type PropSchema } from '../props/props';
import { type Disposable, toDisposable } from '../util/disposable';

export const HOTBAR_SIZE = 6;
export const DEFAULT_DRAW_TIME = 0.3;

export type UseButton = 'primary' | 'secondary';

/** What the first-person view shows (read every frame by the renderer). */
export interface HandState {
  /** Item in hand (null = empty hand). */
  item: string | null;
  /** One-shot animation in progress ('draw' while taking the item in hand). */
  animation: HandAnimation | 'draw' | null;
  /** Seconds since the animation started. */
  time: number;
  duration: number;
  /** Pose kept until released (guard raised, charge, aim). */
  pose: HandAnimation | null;
  /** Incremented when an animation starts, so the view restarts the motion. */
  serial: number;
  /** Seconds before the item in hand can be used (draw, attunement). */
  drawRemaining: number;
  drawDuration: number;
}

export interface SwitchRequest {
  from: string | null;
  to: string | null;
}

export interface SwitchDecision {
  /** False refuses the change; `reason` is shown to the player. */
  allow?: boolean;
  reason?: string;
  /** Seconds before the new item can be used (the longest delay asked wins). */
  drawTime?: number;
}

export interface EquipmentSnapshot {
  hotbar: (string | null)[];
  selected: number;
  worn: Record<string, string>;
}

/** Contextual verbs of the mouse buttons for the HUD (« Frapper », « Réparer la pompe »). */
export interface UseHints {
  primary: string | null;
  secondary: string | null;
}

interface ActiveUse {
  def: ItemUseDefinition<PropSchema>;
  type: string;
  props: Record<string, unknown>;
  itemId: string | null;
  button: UseButton;
  since: number;
  cancelled: boolean;
  releases: (() => void)[];
  ctx: ItemUseContext<Record<string, unknown>>;
}

export class EquipmentSystem {
  readonly hotbar: (string | null)[] = Array<string | null>(HOTBAR_SIZE).fill(null);
  selected = 0;
  /** Worn items by slot. */
  readonly worn = new Map<string, string>();
  readonly hand: HandState = { item: null, animation: null, time: 0, duration: 0, pose: null, serial: 0, drawRemaining: 0, drawDuration: 0 };
  /** Progress ring under the crosshair (long uses). */
  progress: { label: string; value: number } | null = null;
  hints: UseHints = { primary: null, secondary: null };
  /** Incremented when the hotbar, the selection or worn items change (UI refresh). */
  revision = 0;
  private live = false;
  /** Holdable items already seen: only new ones are placed in the hotbar automatically. */
  private known = new Set<string>();
  private guards = new Set<(change: SwitchRequest) => SwitchDecision | void>();
  private active = new Map<UseButton, ActiveUse>();
  private cooldowns = new Map<string, number>();
  /** Abilities added by worn items (not owned otherwise) → the worn items granting them. */
  private granted = new Map<string, Set<string>>();
  private unarmed: { primary?: ItemUseData | null; secondary?: ItemUseData | null } = {};
  private poses: { token: number; animation: HandAnimation }[] = [];
  private poseToken = 0;
  private propsCache = new WeakMap<object, Record<string, unknown>>();
  private warned = new Set<string>();
  private listeners = new Set<() => void>();

  constructor(private readonly session: GameSession) {
    session.inventory.onChange(() => this.reconcile());
  }

  /** Item in hand. */
  get held(): string | null {
    return this.hotbar[this.selected] ?? null;
  }

  onChange(cb: () => void): Disposable {
    this.listeners.add(cb);
    return toDisposable(() => this.listeners.delete(cb));
  }

  private changed(): void {
    this.revision++;
    for (const l of [...this.listeners]) l();
  }

  // -------------------------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------------------------

  /** Restores the equipment of a civilization being loaded (after its inventory and abilities). */
  restore(snap: EquipmentSnapshot | undefined): void {
    // Rules registered by the civilization's mechanics (switch guards, empty hand) are kept.
    this.clearState(false);
    const s = this.session;
    if (snap) {
      snap.hotbar.slice(0, HOTBAR_SIZE).forEach((id, i) => {
        if (id && s.inventory.count(id) > 0 && s.items.get(id)?.held && !this.hotbar.includes(id)) this.hotbar[i] = id;
      });
      this.selected = Math.min(HOTBAR_SIZE - 1, Math.max(0, Math.floor(Number(snap.selected) || 0)));
      for (const [slot, id] of Object.entries(snap.worn ?? {})) {
        const def = s.items.get(id);
        if (def?.slot === slot && s.inventory.count(id) > 0) {
          this.worn.set(slot, id);
          this.grantFrom(id, def);
        }
      }
      // Items the player already had stay where the save put them (even out of the hotbar).
      for (const { id } of s.inventory.entries()) if (s.items.get(id)?.held) this.known.add(id);
    }
    this.hand.item = this.held;
    this.live = true;
    this.reconcile();
    this.changed();
  }

  /** Forgets everything (civilization unloaded). Uses in progress are interrupted. */
  reset(): void {
    this.cancelUses();
    this.clearState(true);
    this.changed();
  }

  private clearState(rules: boolean): void {
    this.live = false;
    this.hotbar.fill(null);
    this.selected = 0;
    for (const [ability, items] of this.granted) {
      if (items.size > 0) this.session.player.abilities.delete(ability);
    }
    this.granted.clear();
    this.worn.clear();
    this.known.clear();
    if (rules) {
      this.guards.clear();
      this.unarmed = {};
    }
    this.active.clear();
    this.cooldowns.clear();
    this.poses = [];
    this.progress = null;
    this.hints = { primary: null, secondary: null };
    Object.assign(this.hand, { item: null, animation: null, time: 0, duration: 0, pose: null, drawRemaining: 0, drawDuration: 0 });
  }

  snapshot(): EquipmentSnapshot {
    return { hotbar: [...this.hotbar], selected: this.selected, worn: Object.fromEntries(this.worn) };
  }

  /** Abilities that only exist because an item is worn (left out of saves). */
  isGrantedOnly(ability: string): boolean {
    return (this.granted.get(ability)?.size ?? 0) > 0;
  }

  /** The story granted an ability that a worn item also grants: it no longer depends on the item. */
  makePermanent(ability: string): void {
    this.granted.delete(ability);
  }

  // -------------------------------------------------------------------------------------------
  // Hotbar and hand
  // -------------------------------------------------------------------------------------------

  /** Can the player change the item in hand now (not in a dialogue, cinematic or menu). */
  private canSwitch(): boolean {
    const s = this.session;
    if (!this.live || !s.civ || !s.world || s.paused || s.dialogue.isActive) return false;
    const cin = s.cinematics.current;
    if (cin && cin.lockPlayer !== false) return false;
    return !s.combat.player.defeated;
  }

  /** Selects a hotbar slot (0–5). Returns false when the change is refused. */
  select(index: number): boolean {
    if (index < 0 || index >= HOTBAR_SIZE || !this.canSwitch()) return false;
    if (index === this.selected && this.hand.item === this.held) return true;
    return this.switchTo(index);
  }

  /** Next / previous slot holding an item (empty slots are skipped). */
  cycle(direction: 1 | -1): boolean {
    for (let k = 1; k <= HOTBAR_SIZE; k++) {
      const i = (((this.selected + direction * k) % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
      if (this.hotbar[i] !== null) return this.select(i);
    }
    return false;
  }

  /** Takes an item in hand (placing it in the hotbar if needed); null empties the hand. */
  hold(itemId: string | null): boolean {
    if (itemId === null) {
      if (this.held === null) return true;
      const empty = this.hotbar.indexOf(null);
      return empty >= 0 && this.select(empty);
    }
    const def = this.session.items.get(itemId);
    if (!def?.held || this.session.inventory.count(itemId) === 0 || !this.canSwitch()) return false;
    let index = this.hotbar.indexOf(itemId);
    if (index < 0) {
      const before = [...this.hotbar];
      index = this.hotbar[this.selected] === null ? this.selected : this.hotbar.indexOf(null);
      if (index < 0) index = this.selected;
      this.hotbar[index] = itemId;
      if (!this.switchTo(index)) {
        this.hotbar.splice(0, HOTBAR_SIZE, ...before);
        return false;
      }
      this.changed();
      return true;
    }
    return this.select(index);
  }

  /** Places an item in a hotbar slot (null clears the slot). The item stays in the inventory. */
  assign(index: number, itemId: string | null): boolean {
    if (index < 0 || index >= HOTBAR_SIZE || !this.live) return false;
    if (itemId !== null && (!this.session.items.get(itemId)?.held || this.session.inventory.count(itemId) === 0)) return false;
    const before = [...this.hotbar];
    if (itemId !== null) {
      const previous = this.hotbar.indexOf(itemId);
      if (previous >= 0) this.hotbar[previous] = null;
    }
    this.hotbar[index] = itemId;
    if (this.hand.item !== this.held && !this.switchTo(this.selected)) {
      this.hotbar.splice(0, HOTBAR_SIZE, ...before);
      return false;
    }
    this.changed();
    return true;
  }

  private drawTimeOf(itemId: string | null): number {
    if (!itemId) return 0;
    return Math.max(0, this.session.items.get(itemId)?.held?.drawTime ?? DEFAULT_DRAW_TIME);
  }

  private switchTo(index: number): boolean {
    const from = this.hand.item;
    const to = this.hotbar[index] ?? null;
    let drawTime = this.drawTimeOf(to);
    if (from !== to) {
      for (const guard of [...this.guards]) {
        let decision: SwitchDecision | void;
        try {
          decision = guard({ from, to });
        } catch (err) {
          this.session.log.error('Règle de changement d’objet en main', err);
          continue;
        }
        if (!decision) continue;
        if (decision.allow === false) {
          if (decision.reason) this.session.notify(decision.reason, 'denied');
          this.session.bus.emit('item.switchRefused', { itemId: to ?? '', reason: decision.reason ?? '' });
          return false;
        }
        if (decision.drawTime !== undefined) drawTime = Math.max(drawTime, decision.drawTime);
      }
    }
    this.cancelUses();
    this.selected = index;
    if (from !== to) {
      this.setHandItem(to, drawTime);
      this.session.bus.emit('item.held', { itemId: to ?? '', previous: from ?? '' });
    }
    this.changed();
    return true;
  }

  private setHandItem(itemId: string | null, drawTime: number): void {
    const h = this.hand;
    h.item = itemId;
    h.drawRemaining = drawTime;
    h.drawDuration = drawTime;
    h.animation = itemId ? 'draw' : null;
    h.time = 0;
    h.duration = Math.max(0.05, drawTime);
    h.serial++;
    this.poses = [];
    h.pose = null;
  }

  /** Rules on changing the item in hand (attunement, overload…). */
  guardSwitch(fn: (change: SwitchRequest) => SwitchDecision | void): Disposable {
    this.guards.add(fn);
    return toDisposable(() => this.guards.delete(fn));
  }

  /** Uses of the empty hand (a punch, a shove). */
  setUnarmed(spec: { primary?: ItemUseData | null; secondary?: ItemUseData | null }): void {
    this.unarmed = { ...spec };
  }

  /** Delays the use of the item in hand (attunement after a change, recoil). */
  delayUse(seconds: number): void {
    this.hand.drawRemaining = Math.max(this.hand.drawRemaining, seconds);
    this.hand.drawDuration = Math.max(this.hand.drawDuration, this.hand.drawRemaining);
  }

  // -------------------------------------------------------------------------------------------
  // Worn items
  // -------------------------------------------------------------------------------------------

  /** Wears an item in its slot, replacing the item worn there. */
  equip(itemId: string): boolean {
    const def = this.session.items.get(itemId);
    if (!this.live || !def?.slot || this.session.inventory.count(itemId) === 0) return false;
    const slot = def.slot;
    const previous = this.worn.get(slot);
    if (previous === itemId) return true;
    if (previous) this.unequip(slot);
    this.worn.set(slot, itemId);
    this.grantFrom(itemId, def);
    this.session.bus.emit('item.equipped', { itemId, slot });
    this.changed();
    return true;
  }

  unequip(slot: string): void {
    const itemId = this.worn.get(slot);
    if (!itemId) return;
    this.worn.delete(slot);
    for (const [ability, items] of [...this.granted]) {
      if (items.delete(itemId) && items.size === 0) {
        this.granted.delete(ability);
        this.session.player.abilities.delete(ability);
      }
    }
    this.session.bus.emit('item.unequipped', { itemId, slot });
    this.session.changed();
    this.changed();
  }

  wornIn(slot: string): string | null {
    return this.worn.get(slot) ?? null;
  }

  private grantFrom(itemId: string, def: ItemDefinition): void {
    const civ = this.session.civ;
    if (!civ) return;
    for (const ability of def.grants ?? []) {
      if (!civ.abilities.has(ability)) {
        this.session.log.error(`L’objet ${itemId} accorde une capacité inconnue : ${ability}`);
        continue;
      }
      const owners = this.granted.get(ability);
      if (owners) owners.add(itemId);
      else if (!this.session.player.abilities.has(ability)) {
        this.granted.set(ability, new Set([itemId]));
        this.session.player.abilities.add(ability);
      }
    }
    this.session.changed();
  }

  // -------------------------------------------------------------------------------------------
  // Inventory changes
  // -------------------------------------------------------------------------------------------

  private reconcile(): void {
    if (!this.live) return;
    const s = this.session;
    let changed = false;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const id = this.hotbar[i];
      if (id && s.inventory.count(id) === 0) {
        this.hotbar[i] = null;
        changed = true;
      }
    }
    for (const [slot, id] of [...this.worn]) if (s.inventory.count(id) === 0) this.unequip(slot);
    for (const id of [...this.known]) if (s.inventory.count(id) === 0) this.known.delete(id);
    for (const { id } of s.inventory.entries()) {
      if (this.known.has(id) || !s.items.get(id)?.held) continue;
      this.known.add(id);
      if (this.hotbar.includes(id)) continue;
      const empty = this.hotbar.indexOf(null);
      if (empty >= 0) {
        this.hotbar[empty] = id;
        changed = true;
      }
    }
    if (this.hand.item !== this.held) {
      // The item in hand left the inventory, or a new item landed in the selected slot.
      const from = this.hand.item;
      const to = this.held;
      this.cancelUses();
      this.setHandItem(to, this.drawTimeOf(to));
      s.bus.emit('item.held', { itemId: to ?? '', previous: from ?? '' });
      changed = true;
    }
    if (changed) this.changed();
  }

  // -------------------------------------------------------------------------------------------
  // Uses
  // -------------------------------------------------------------------------------------------

  /** Whether the player may use the item in hand now. `ongoing`: a use already started. */
  private canUse(ongoing = false): boolean {
    const s = this.session;
    if (!this.live || !s.civ || !s.world || s.paused) return false;
    if (s.player.movementLocked || s.dialogue.isActive) return false;
    const cin = s.cinematics.current;
    if (cin && cin.lockPlayer !== false) return false;
    if (!s.combat.canAct) return false;
    return ongoing || this.hand.drawRemaining <= 0;
  }

  private useData(button: UseButton): ItemUseData | null {
    const itemId = this.hand.item;
    if (!itemId) return this.unarmed[button] ?? null;
    return this.session.items.get(itemId)?.held?.[button] ?? null;
  }

  private resolve(data: ItemUseData): { def: ItemUseDefinition<PropSchema>; props: Record<string, unknown> } | null {
    const reg = this.session.itemUses.get(data.type);
    if (!reg) {
      if (!this.warned.has(data.type)) {
        this.warned.add(data.type);
        this.session.log.warn(`Utilisation d’objet inconnue : ${data.type}`);
      }
      return null;
    }
    let props = this.propsCache.get(data);
    if (!props) {
      const { type: _type, ...raw } = data;
      props = normalizeProps(reg.def.props, raw).value as Record<string, unknown>;
      this.propsCache.set(data, props);
    }
    return { def: reg.def, props };
  }

  private makeUse(def: ItemUseDefinition<PropSchema>, type: string, props: Record<string, unknown>, button: UseButton): ActiveUse {
    const session = this.session;
    const since = session.clock.now;
    const use = { def, type, props, itemId: this.hand.item, button, since, cancelled: false, releases: [] } as unknown as ActiveUse;
    const hand: HandApi = {
      play: (animation, seconds) => this.playHand(animation, seconds),
      hold: (animation) => {
        const release = this.holdHand(animation);
        use.releases.push(release);
        return release;
      },
    };
    use.ctx = {
      get ctx() {
        return session.civ!.ctx;
      },
      props,
      itemId: use.itemId,
      button,
      get heldFor() {
        return session.clock.now - since;
      },
      get cancelled() {
        return use.cancelled;
      },
      hand,
    };
    return use;
  }

  /** Mouse button pressed (attack = primary, block = secondary). Returns true if something happened. */
  press(button: UseButton): boolean {
    if (this.active.has(button) || !this.canUse()) return false;
    const data = this.useData(button);
    if (!data) return false;
    const resolved = this.resolve(data);
    if (!resolved) return false;
    const key = `${this.hand.item ?? ''}|${button}`;
    if ((this.cooldowns.get(key) ?? 0) > 0) return false;
    const use = this.makeUse(resolved.def, data.type, resolved.props, button);
    let started: boolean | void;
    try {
      started = resolved.def.start?.(use.ctx);
    } catch (err) {
      this.session.log.error(`Erreur de l’utilisation ${data.type}`, err);
      return false;
    }
    if (started === false) {
      for (const r of use.releases) r();
      return false;
    }
    this.session.bus.emit('item.used', { itemId: this.hand.item ?? '', action: button, use: data.type });
    if (resolved.def.mode === 'press') this.startCooldown(use);
    else this.active.set(button, use);
    return true;
  }

  /** Mouse button released. */
  release(button: UseButton): void {
    const use = this.active.get(button);
    if (!use) return;
    this.active.delete(button);
    this.finish(use, false);
  }

  /** Interrupts uses in progress (`stop` sees `cancelled`). */
  cancelUses(): void {
    for (const use of [...this.active.values()]) {
      this.active.delete(use.button);
      this.finish(use, true);
    }
  }

  isUsing(button: UseButton): boolean {
    return this.active.has(button);
  }

  private finish(use: ActiveUse, cancelled: boolean): void {
    use.cancelled = cancelled;
    try {
      use.def.stop?.(use.ctx);
    } catch (err) {
      this.session.log.error(`Erreur de l’utilisation ${use.type}`, err);
    }
    for (const r of use.releases) r();
    if (this.progress) this.progress = null;
    this.startCooldown(use);
  }

  private startCooldown(use: ActiveUse): void {
    const seconds = use.def.cooldown ? use.def.cooldown(use.props as never) : Number(use.props.cooldown ?? 0);
    if (seconds > 0) this.cooldowns.set(`${use.itemId ?? ''}|${use.button}`, seconds);
  }

  /** Seconds before a button of the item in hand can be used again. */
  cooldown(button: UseButton): number {
    return this.cooldowns.get(`${this.hand.item ?? ''}|${button}`) ?? 0;
  }

  ready(button: UseButton = 'primary'): boolean {
    return this.canUse() && this.cooldown(button) <= 0;
  }

  // -------------------------------------------------------------------------------------------
  // Hand animation
  // -------------------------------------------------------------------------------------------

  playHand(animation: HandAnimation, seconds: number): void {
    const h = this.hand;
    h.animation = animation;
    h.time = 0;
    h.duration = Math.max(0.05, seconds);
    h.serial++;
  }

  holdHand(animation: HandAnimation): () => void {
    const token = ++this.poseToken;
    this.poses.push({ token, animation });
    this.hand.pose = animation;
    return () => {
      const i = this.poses.findIndex((p) => p.token === token);
      if (i < 0) return;
      this.poses.splice(i, 1);
      this.hand.pose = this.poses[this.poses.length - 1]?.animation ?? null;
    };
  }

  /** A HandApi for civilization code (abilities, mechanics). */
  readonly handApi: HandApi = {
    play: (animation, seconds) => this.playHand(animation, seconds),
    hold: (animation) => this.holdHand(animation),
  };

  // -------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------

  update(dt: number): void {
    if (!this.live) return;
    const h = this.hand;
    if (h.animation) {
      h.time += dt;
      if (h.time >= h.duration) h.animation = null;
    }
    if (h.drawRemaining > 0) h.drawRemaining = Math.max(0, h.drawRemaining - dt);
    for (const [key, t] of this.cooldowns) {
      const left = t - dt;
      if (left <= 0) this.cooldowns.delete(key);
      else this.cooldowns.set(key, left);
    }
    if (this.active.size > 0) {
      if (!this.canUse(true)) this.cancelUses();
      else {
        for (const use of [...this.active.values()]) {
          try {
            use.def.update?.(use.ctx, dt);
          } catch (err) {
            this.session.log.error(`Erreur de l’utilisation ${use.type}`, err);
            this.active.delete(use.button);
            this.finish(use, true);
          }
        }
      }
    }
    this.hints = { primary: this.hintFor('primary'), secondary: this.hintFor('secondary') };
  }

  private hintFor(button: UseButton): string | null {
    const data = this.useData(button);
    if (!data) return null;
    const resolved = this.resolve(data);
    if (!resolved) return null;
    const { def, props } = resolved;
    if (def.aim && this.canUse(true)) {
      try {
        const verb = def.aim(this.makeUse(def, data.type, props, button).ctx);
        if (verb) return verb;
      } catch (err) {
        if (!this.warned.has(`aim:${data.type}`)) {
          this.warned.add(`aim:${data.type}`);
          this.session.log.error(`Erreur de l’utilisation ${data.type} (visée)`, err);
        }
      }
    }
    const label = typeof props.hint === 'string' && props.hint ? props.hint : def.hint;
    return label ? this.session.t(label) : null;
  }
}
