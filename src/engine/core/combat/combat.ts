/**
 * Combat: the player's health, guard, parry, riposte and dodge; damage to entities (through their
 * `core.health` component); projectiles and shockwaves; defeat, checkpoints and the return to the
 * last safe place; the "in combat" state that drives combat music and regeneration.
 *
 * Everything stays off until a civilization calls `ctx.combat.enablePlayer()`: civilizations
 * without combat (Door, Memory) never see a health bar, never take damage and cannot dodge.
 */
import type { GameSession } from '../sim/session';
import type { RuntimeEntity } from '../world/entity';
import type { AABB } from '../physics/aabb';
import { raycastVoxels } from '../voxel/raycast';
import type { Disposable } from '../util/disposable';
import { DEG2RAD, type Vec3 } from '../util/math';

export type Faction = 'enemy' | 'ally' | 'neutral';

/** Who an attack of `attacker` can hurt. The player belongs to 'ally'. */
export function isHostile(attacker: Faction, target: Faction): boolean {
  if (attacker === 'enemy') return target === 'ally';
  if (attacker === 'ally') return target !== 'ally';
  // Neutral hazards (steam, falling debris) hurt everyone.
  return true;
}

export interface DamageInfo {
  amount: number;
  /** Attacker: an entity id, 'player', or null (environment). */
  source?: string | null;
  /** Where the blow comes from (guard direction, knockback). Defaults to the attacker's position. */
  from?: Vec3;
  /** 'melee', 'projectile', 'wave', 'environment' or a pack-defined kind. */
  kind?: string;
  /** Knockback speed (m/s). */
  knockback?: number;
  /** Seconds of stagger inflicted (enemies: when their balance breaks). */
  stagger?: number;
  /** Breaks a raised guard or a shield. */
  guardBreak?: boolean;
  /** Cannot be blocked or parried. */
  unblockable?: boolean;
  /** Damage tags (« braise », « fer »…): weaknesses, resistances, protections. */
  tags?: string[];
}

export type HitOutcome = 'hit' | 'blocked' | 'parried' | 'guardBroken' | 'immune' | 'ignored' | 'defeated';

export interface HitResult {
  outcome: HitOutcome;
  /** Health actually removed. */
  damage: number;
}

export interface PlayerCombatOptions {
  /** Default 100. */
  maxHealth?: number;
  /** Seconds without being hit (and out of combat) before health comes back (default 5). */
  regenDelay?: number;
  /** Health per second when regenerating (default 12). */
  regenRate?: number;
  /** Seconds between a defeat and the return to the last safe place (default 2.6). */
  respawnDelay?: number;
  /** Dodge (C by default); false disables it. */
  dodge?: { speed?: number; duration?: number; cooldown?: number; iframes?: number } | false;
  /** Music played while enemies fight the player (encounters and bosses can override it). */
  music?: string | null;
}

export interface GuardSpec {
  /** Protected angle in front of the player (degrees, default 140). */
  arc?: number;
  /** Fraction of the damage stopped by the guard (0–1, default 0.8). */
  reduction?: number;
  /** Seconds after raising the guard during which a blow is parried (default 0.22). */
  parryWindow?: number;
  /** Seconds of stagger inflicted on a parried attacker (default 1.2). */
  parryStagger?: number;
  /** Seconds after a parry during which the next strike breaks guards and hits twice as hard (default 1.5). */
  riposte?: number;
  /** Parried projectiles fly back to their shooter. */
  reflect?: boolean;
  /** Movement speed factor while guarding (default 0.55). */
  moveFactor?: number;
}

export interface StrikeSpec {
  damage: number;
  /** Meters (default 2.6). */
  reach?: number;
  /** Degrees in front of the player (default 100). */
  arc?: number;
  knockback?: number;
  stagger?: number;
  guardBreak?: boolean;
  tags?: string[];
  /** Default 3. */
  maxTargets?: number;
  kind?: string;
}

export interface StrikeHit {
  entityId: string;
  outcome: HitOutcome;
  damage: number;
}

export interface ProjectileSpec {
  from: Vec3;
  direction: Vec3;
  /** m/s. */
  speed: number;
  damage: number;
  radius?: number;
  /** Seconds before it vanishes (default 4). */
  ttl?: number;
  source?: string | null;
  faction?: Faction;
  color?: string;
  tags?: string[];
  knockback?: number;
  /** Downward acceleration (m/s², default 0: straight line). */
  gravity?: number;
  /** A parry with a reflecting guard sends it back (default true). */
  reflectable?: boolean;
  guardBreak?: boolean;
  unblockable?: boolean;
}

export interface WaveSpec {
  center: Vec3;
  /** Expansion speed (m/s). */
  speed: number;
  maxRadius: number;
  damage: number;
  /** Height of the wave above its center: jumping over it avoids it (default 0.7). */
  height?: number;
  /** Thickness of the ring (default 0.8). */
  thickness?: number;
  source?: string | null;
  faction?: Faction;
  color?: string;
  knockback?: number;
  tags?: string[];
  unblockable?: boolean;
}

/** Public API of the `core.health` component (`entity.behavior('core.health')`). */
export interface HealthApi {
  readonly health: number;
  readonly max: number;
  readonly defeated: boolean;
  readonly faction: Faction;
  /** True while a protection is lifted (`expose`). */
  readonly exposed: boolean;
  damage(info: DamageInfo): HitResult;
  heal(amount: number): void;
  /** Back on its feet with full (or given) health. */
  revive(health?: number): void;
  /** Lifts the protection of a target that only some tags can hurt (a revealed weak point). */
  expose(seconds: number): void;
  /** Ignores every blow for a while (boss phase change). */
  shield(seconds: number): void;
}

/** Public API of the `core.combatant` component. */
export interface CombatantApi {
  readonly state: string;
  readonly engaged: boolean;
  engage(): void;
  disengage(): void;
  /** Back to its starting place, calm (encounter reset). */
  reset(): void;
  stagger(seconds: number): void;
  /** Whether its guard stops this blow (shield in front). */
  blocks(info: DamageInfo): boolean;
  /** Boss phase: attacks with a higher `phase` become available. */
  setPhase(phase: number): void;
}

export interface ProjectileState {
  id: number;
  position: Vec3;
  velocity: Vec3;
  radius: number;
  color: string;
  age: number;
  ttl: number;
  damage: number;
  source: string | null;
  faction: Faction;
  tags: string[];
  knockback: number;
  gravity: number;
  reflectable: boolean;
  reflected: boolean;
  guardBreak: boolean;
  unblockable: boolean;
}

export interface WaveState {
  id: number;
  center: Vec3;
  radius: number;
  speed: number;
  maxRadius: number;
  height: number;
  thickness: number;
  color: string;
  damage: number;
  source: string | null;
  faction: Faction;
  knockback: number;
  tags: string[];
  unblockable: boolean;
  hit: Set<string>;
}

export interface BossBarState {
  entityId: string;
  name: string;
  title: string;
  health: number;
  max: number;
  phase: number;
}

interface ActiveGuard {
  arc: number;
  reduction: number;
  parryWindow: number;
  parryStagger: number;
  riposte: number;
  reflect: boolean;
  since: number;
  token: number;
  modifier: Disposable;
}

interface DodgeSpec {
  speed: number;
  duration: number;
  cooldown: number;
  iframes: number;
}

const DEFAULT_DODGE: DodgeSpec = { speed: 10.5, duration: 0.2, cooldown: 0.55, iframes: 0.3 };

export class CombatSystem {
  /** True once the civilization called `enablePlayer`. */
  enabled = false;
  difficulty: 'normal' | 'indulgent' = 'normal';
  readonly player = {
    health: 100,
    maxHealth: 100,
    defeated: false,
    /** Seconds of invulnerability left (after a hit, a dodge, a respawn). */
    iframes: 0,
    /** Seconds of stagger left (no action possible). */
    stagger: 0,
    lastHitAt: -1e9,
    riposteUntil: -1,
    dodgeCooldown: 0,
    guard: null as ActiveGuard | null,
  };
  /** Where the player gets back up after a defeat (current scene). */
  checkpoint: { sceneId: string; position: Vec3; yaw: number } | null = null;
  readonly projectiles: ProjectileState[] = [];
  readonly waves: WaveState[] = [];
  bossBar: BossBarState | null = null;
  /** The player hit something (HUD hit marker). */
  hitMarker = { serial: 0, outcome: 'hit' as HitOutcome };
  /** The player was hurt (HUD damage indicator). */
  hurt = { serial: 0, amount: 0, from: null as Vec3 | null };
  inCombat = false;
  private regenDelay = 5;
  private regenRate = 12;
  private respawnDelay = 2.6;
  private dodgeSpec: DodgeSpec | null = DEFAULT_DODGE;
  private combatMusic: string | null = null;
  private respawnTimer = 0;
  private defeatLocks: Disposable[] = [];
  private guardToken = 0;
  private nextId = 1;
  private engagedUntil = new Map<string, number>();
  private calmTimer = 0;
  private musicStack: { token: number; id: string }[] = [];
  private musicToken = 0;
  private musicBefore: string | null | undefined = undefined;
  private combatMusicToken: number | null = null;

  constructor(private readonly session: GameSession) {}

  /** Damage taken and telegraph durations for the current difficulty. */
  get tuning(): { damageTaken: number; telegraph: number; parryBonus: number } {
    return this.difficulty === 'indulgent' ? { damageTaken: 0.5, telegraph: 1.35, parryBonus: 0.08 } : { damageTaken: 1, telegraph: 1, parryBonus: 0 };
  }

  /** Whether the player can act (use items, dodge): not defeated, not staggered. */
  get canAct(): boolean {
    if (!this.enabled) return true;
    return !this.player.defeated && this.player.stagger <= 0;
  }

  get guarding(): boolean {
    return this.player.guard !== null;
  }

  // -------------------------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------------------------

  enablePlayer(opts: PlayerCombatOptions = {}): void {
    this.enabled = true;
    const p = this.player;
    p.maxHealth = Math.max(1, opts.maxHealth ?? 100);
    p.health = p.maxHealth;
    p.defeated = false;
    this.regenDelay = opts.regenDelay ?? 5;
    this.regenRate = opts.regenRate ?? 12;
    this.respawnDelay = opts.respawnDelay ?? 2.6;
    this.dodgeSpec = opts.dodge === false ? null : { ...DEFAULT_DODGE, ...(opts.dodge ?? {}) };
    this.combatMusic = opts.music ?? null;
    this.session.changed();
  }

  /** Saved combat state of the player (health). */
  snapshot(): { health: number } | undefined {
    return this.enabled ? { health: Math.round(this.player.health * 100) / 100 } : undefined;
  }

  restore(saved: { health?: number } | undefined): void {
    if (!this.enabled || !saved || typeof saved.health !== 'number') return;
    this.player.health = Math.min(this.player.maxHealth, Math.max(1, saved.health));
  }

  /** Civilization unloaded: everything back to off. */
  reset(): void {
    this.dropGuard();
    for (const l of this.defeatLocks) l.dispose();
    this.defeatLocks = [];
    Object.assign(this.player, { health: 100, maxHealth: 100, defeated: false, iframes: 0, stagger: 0, lastHitAt: -1e9, riposteUntil: -1, dodgeCooldown: 0 });
    this.enabled = false;
    this.checkpoint = null;
    this.projectiles.length = 0;
    this.waves.length = 0;
    this.bossBar = null;
    this.inCombat = false;
    this.engagedUntil.clear();
    this.musicStack = [];
    this.musicBefore = undefined;
    this.combatMusicToken = null;
    this.combatMusic = null;
    this.respawnTimer = 0;
  }

  /** A new scene: the arrival point becomes the checkpoint; effects of the old scene vanish. */
  onSceneEntered(): void {
    this.projectiles.length = 0;
    this.waves.length = 0;
    this.bossBar = null;
    this.engagedUntil.clear();
    this.dropGuard();
    if (this.inCombat) this.setInCombat(false);
    this.musicStack = [];
    this.musicBefore = undefined;
    this.combatMusicToken = null;
    this.setCheckpointHere();
  }

  setCheckpointHere(): void {
    const s = this.session;
    if (!s.world) return;
    this.checkpoint = { sceneId: s.world.id, position: { ...s.player.position }, yaw: s.player.yaw };
  }

  setCheckpoint(position: Vec3, yaw: number): void {
    const s = this.session;
    if (!s.world) return;
    this.checkpoint = { sceneId: s.world.id, position: { ...position }, yaw };
  }

  // -------------------------------------------------------------------------------------------
  // Player: guard, dodge, damage, defeat
  // -------------------------------------------------------------------------------------------

  raiseGuard(spec: GuardSpec = {}): () => void {
    if (!this.enabled || this.player.defeated) return () => undefined;
    this.dropGuard();
    const token = ++this.guardToken;
    const factor = spec.moveFactor ?? 0.55;
    const modifier = this.session.player.addModifier({
      id: 'combat.guard',
      priority: 50,
      modifyParams: (p) => {
        p.walkSpeed *= factor;
        p.sprintSpeed = p.walkSpeed;
      },
    });
    this.player.guard = {
      arc: spec.arc ?? 140,
      reduction: Math.min(1, Math.max(0, spec.reduction ?? 0.8)),
      parryWindow: (spec.parryWindow ?? 0.22) + this.tuning.parryBonus,
      parryStagger: spec.parryStagger ?? 1.2,
      riposte: spec.riposte ?? 1.5,
      reflect: spec.reflect ?? false,
      since: this.session.clock.now,
      token,
      modifier,
    };
    return () => {
      if (this.player.guard?.token === token) this.dropGuard();
    };
  }

  private dropGuard(): void {
    this.player.guard?.modifier.dispose();
    this.player.guard = null;
  }

  /** Quick sidestep with a moment of invulnerability. Direction: movement input, else backward. */
  dodge(direction?: { x: number; z: number }): boolean {
    const s = this.session;
    const spec = this.dodgeSpec;
    const p = this.player;
    if (!this.enabled || !spec || !this.canAct || p.dodgeCooldown > 0 || !s.world) return false;
    if (s.player.movementLocked || s.dialogue.isActive || !s.player.body.grounded) return false;
    let x = direction?.x ?? 0;
    let z = direction?.z ?? 0;
    if (!direction) {
      const i = s.player.intent;
      const yaw = s.player.yaw;
      x = i.forward * Math.sin(yaw) + i.right * Math.cos(yaw);
      z = i.forward * Math.cos(yaw) - i.right * Math.sin(yaw);
    }
    let len = Math.hypot(x, z);
    if (len < 1e-3) {
      x = -Math.sin(s.player.yaw);
      z = -Math.cos(s.player.yaw);
      len = 1;
    }
    s.player.forceMove({ x: (x / len) * spec.speed, y: 0, z: (z / len) * spec.speed }, spec.duration);
    p.iframes = Math.max(p.iframes, spec.iframes);
    p.dodgeCooldown = spec.cooldown;
    s.presentation.emit({ type: 'sound', id: 'core:dodge', handle: s.presentation.newHandle() });
    s.presentation.emit({ type: 'fx', fx: 'fov', params: { delta: 5, seconds: 0.3 } });
    s.bus.emit('combat.playerAction', { action: 'dodge' });
    return true;
  }

  private inGuardArc(from: Vec3, arcDeg: number): boolean {
    const s = this.session;
    const dx = from.x - s.player.position.x;
    const dz = from.z - s.player.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return true;
    const fx = Math.sin(s.player.yaw);
    const fz = Math.cos(s.player.yaw);
    return (dx * fx + dz * fz) / d >= Math.cos((arcDeg * DEG2RAD) / 2);
  }

  positionOf(source: string | null | undefined): Vec3 | null {
    if (!source) return null;
    if (source === 'player') return { ...this.session.player.position };
    const e = this.session.world?.entities.get(source);
    return e ? { ...e.position } : null;
  }

  damagePlayer(info: DamageInfo): HitResult {
    const s = this.session;
    const p = this.player;
    if (!this.enabled || p.defeated || !s.world || s.paused) return { outcome: 'ignored', damage: 0 };
    // No blows during story scenes.
    if (s.dialogue.isActive) return { outcome: 'ignored', damage: 0 };
    const cin = s.cinematics.current;
    if (cin && cin.lockPlayer !== false) return { outcome: 'ignored', damage: 0 };
    if (p.iframes > 0) return { outcome: 'ignored', damage: 0 };
    const from = info.from ?? this.positionOf(info.source);
    let amount = Math.max(0, info.amount) * this.tuning.damageTaken;
    let knockback = info.knockback ?? 0;
    let outcome: HitOutcome = 'hit';
    const g = p.guard;
    if (g && !info.unblockable && from && this.inGuardArc(from, g.arc)) {
      const now = s.clock.now;
      if (now - g.since <= g.parryWindow) {
        p.riposteUntil = now + g.riposte;
        if (info.source && info.source !== 'player') this.staggerEntity(info.source, g.parryStagger);
        s.presentation.emit({ type: 'sound', id: 'core:parry', handle: s.presentation.newHandle() });
        s.presentation.emit({ type: 'fx', fx: 'flash', params: { color: '#fff4d6', seconds: 0.18 } });
        s.equipment.playHand('recoil', 0.25);
        s.bus.emit('combat.parried', { source: info.source ?? '', kind: info.kind ?? 'melee' });
        return { outcome: 'parried', damage: 0 };
      }
      if (info.guardBreak) {
        outcome = 'guardBroken';
        this.dropGuard();
        s.equipment.cancelUses();
        p.stagger = Math.max(p.stagger, 0.7);
        amount *= 0.5;
        s.presentation.emit({ type: 'sound', id: 'core:guard_break', handle: s.presentation.newHandle() });
        s.bus.emit('combat.guardBroken', { source: info.source ?? '' });
      } else {
        outcome = 'blocked';
        amount *= 1 - g.reduction;
        knockback *= 0.4;
        s.presentation.emit({ type: 'sound', id: 'core:block', handle: s.presentation.newHandle() });
        s.equipment.playHand('recoil', 0.18);
        s.bus.emit('combat.blocked', { source: info.source ?? '', amount });
      }
    }
    if (outcome !== 'blocked' && info.stagger) p.stagger = Math.max(p.stagger, info.stagger);
    if (from && knockback > 0) {
      const dx = s.player.position.x - from.x;
      const dz = s.player.position.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      s.player.impulse({ x: (dx / d) * knockback, y: outcome === 'blocked' ? 0 : Math.min(3, knockback * 0.35), z: (dz / d) * knockback });
    }
    if (amount <= 0.001) return { outcome, damage: 0 };
    p.health = Math.max(0, p.health - amount);
    p.lastHitAt = s.clock.now;
    p.iframes = Math.max(p.iframes, 0.45);
    this.hurt = { serial: this.hurt.serial + 1, amount, from: from ? { ...from } : null };
    if (outcome !== 'blocked') {
      s.presentation.emit({ type: 'sound', id: 'core:hurt', handle: s.presentation.newHandle() });
      s.presentation.emit({ type: 'fx', fx: 'shake', params: { intensity: Math.min(0.5, 0.12 + amount / 60), seconds: 0.25 } });
      s.presentation.emit({ type: 'fx', fx: 'flash', params: { color: '#b3170f', seconds: 0.3 } });
    }
    s.bus.emit('combat.playerHit', { amount, source: info.source ?? '', health: p.health, outcome });
    if (p.health <= 0) {
      this.defeatPlayer(info.source ?? null);
      return { outcome: 'defeated', damage: amount };
    }
    return { outcome, damage: amount };
  }

  setInvulnerable(seconds: number): void {
    this.player.iframes = Math.max(this.player.iframes, seconds);
  }

  healPlayer(amount: number): void {
    if (!this.enabled || this.player.defeated || amount <= 0) return;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
  }

  setPlayerMaxHealth(max: number, refill = false): void {
    this.player.maxHealth = Math.max(1, max);
    this.player.health = refill ? this.player.maxHealth : Math.min(this.player.health, this.player.maxHealth);
  }

  private defeatPlayer(by: string | null): void {
    const s = this.session;
    const p = this.player;
    p.defeated = true;
    p.health = 0;
    p.stagger = 0;
    this.dropGuard();
    s.equipment.cancelUses();
    s.player.cancelForcedMove();
    this.defeatLocks = [s.player.lockMovement('défaite'), s.player.lockLook('défaite')];
    this.respawnTimer = this.respawnDelay;
    s.presentation.emit({ type: 'sound', id: 'core:defeat', handle: s.presentation.newHandle() });
    s.presentation.emit({ type: 'fx', fx: 'fade', params: { to: 1, seconds: this.respawnDelay * 0.7, color: '#120606' } });
    s.bus.emit('combat.playerDefeated', { by: by ?? '' });
  }

  private respawn(): void {
    const s = this.session;
    const p = this.player;
    p.defeated = false;
    p.health = p.maxHealth;
    p.iframes = 1.5;
    p.stagger = 0;
    p.riposteUntil = -1;
    p.lastHitAt = -1e9;
    this.projectiles.length = 0;
    this.waves.length = 0;
    const cp = this.checkpoint;
    if (cp && s.world && cp.sceneId === s.world.id) {
      s.player.teleport(cp.position);
      s.player.setLook(cp.yaw, 0);
    }
    s.player.body.velocity.x = s.player.body.velocity.y = s.player.body.velocity.z = 0;
    for (const l of this.defeatLocks) l.dispose();
    this.defeatLocks = [];
    s.presentation.emit({ type: 'fx', fx: 'fade', params: { to: 0, seconds: 0.9 } });
    s.bus.emit('combat.playerRespawned', {});
  }

  // -------------------------------------------------------------------------------------------
  // Entities
  // -------------------------------------------------------------------------------------------

  healthOf(entityId: string): HealthApi | null {
    const e = this.session.world?.entities.get(entityId);
    const rec = e?.components.get('core.health');
    return rec && !rec.faulted ? ((rec.instance?.api as HealthApi | undefined) ?? null) : null;
  }

  combatantOf(entityId: string): CombatantApi | null {
    const e = this.session.world?.entities.get(entityId);
    const rec = e?.components.get('core.combatant');
    return rec && !rec.faulted ? ((rec.instance?.api as CombatantApi | undefined) ?? null) : null;
  }

  damage(entityId: string, info: DamageInfo): HitResult {
    return this.healthOf(entityId)?.damage(info) ?? { outcome: 'ignored', damage: 0 };
  }

  staggerEntity(entityId: string, seconds: number): void {
    this.combatantOf(entityId)?.stagger(seconds);
  }

  /** Box of an entity for targeting: its colliders, else a person-sized box at its feet. */
  entityBox(e: RuntimeEntity): AABB {
    const w = this.session.world;
    let box: AABB | null = null;
    for (const part of e.colliderParts.keys()) {
      const c = w?.colliders.get(`${e.id}#${part}`);
      if (!c || !c.enabled) continue;
      const b = c.box;
      box = box
        ? { minX: Math.min(box.minX, b.minX), minY: Math.min(box.minY, b.minY), minZ: Math.min(box.minZ, b.minZ), maxX: Math.max(box.maxX, b.maxX), maxY: Math.max(box.maxY, b.maxY), maxZ: Math.max(box.maxZ, b.maxZ) }
        : { ...b };
    }
    if (box) return box;
    const p = e.position;
    const h = Number(e.components.get('core.combatant')?.props.height ?? e.components.get('core.npc')?.props.height ?? 1.8);
    const r = Number(e.components.get('core.combatant')?.props.width ?? 0.6) / 2;
    return { minX: p.x - r, minY: p.y, minZ: p.z - r, maxX: p.x + r, maxY: p.y + h, maxZ: p.z + r };
  }

  /** No voxel between two points. */
  lineOfSight(from: Vec3, to: Vec3): boolean {
    const w = this.session.world;
    if (!w) return false;
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const d = Math.hypot(dir.x, dir.y, dir.z);
    if (d < 1e-3) return true;
    return raycastVoxels(w.volume, w.paletteInfo(), from, dir, d) === null;
  }

  /** Living entities with health whose faction is hostile to `toward`. */
  hostilesNear(point: Vec3, radius: number, toward: Faction = 'ally'): { entity: RuntimeEntity; health: HealthApi }[] {
    const w = this.session.world;
    if (!w) return [];
    const out: { entity: RuntimeEntity; health: HealthApi }[] = [];
    for (const e of w.entities.values()) {
      if (!e.visible || !e.enabled) continue;
      const h = this.healthOf(e.id);
      if (!h || h.defeated || !isHostile(h.faction, toward) || h.faction === 'neutral') continue;
      const dx = e.position.x - point.x;
      const dy = e.position.y - point.y;
      const dz = e.position.z - point.z;
      if (dx * dx + dy * dy + dz * dz <= radius * radius) out.push({ entity: e, health: h });
    }
    return out;
  }

  /** Player melee: hits what is in front of the player, nearest first. */
  playerStrike(spec: StrikeSpec): StrikeHit[] {
    const s = this.session;
    const w = s.world;
    if (!w) return [];
    const eye = s.player.eye;
    const fwd = s.player.forward;
    const reach = spec.reach ?? 2.6;
    const cosHalf = Math.cos(((spec.arc ?? 100) * DEG2RAD) / 2);
    const riposte = s.clock.now <= this.player.riposteUntil;
    const candidates: { id: string; health: HealthApi; distance: number }[] = [];
    for (const e of w.entities.values()) {
      if (!e.visible || !e.enabled) continue;
      const health = this.healthOf(e.id);
      if (!health || health.defeated || !isHostile('ally', health.faction)) continue;
      const box = this.entityBox(e);
      const near = {
        x: Math.min(box.maxX, Math.max(box.minX, eye.x)),
        y: Math.min(box.maxY, Math.max(box.minY, eye.y)),
        z: Math.min(box.maxZ, Math.max(box.minZ, eye.z)),
      };
      const distance = Math.hypot(near.x - eye.x, near.y - eye.y, near.z - eye.z);
      if (distance > reach) continue;
      const center = { x: (box.minX + box.maxX) / 2, y: Math.min(box.maxY, Math.max(box.minY, eye.y - 0.3)), z: (box.minZ + box.maxZ) / 2 };
      const to = { x: center.x - eye.x, y: center.y - eye.y, z: center.z - eye.z };
      const len = Math.hypot(to.x, to.y, to.z);
      if (len > 0.9 && (to.x * fwd.x + to.y * fwd.y + to.z * fwd.z) / len < cosHalf) continue;
      if (!this.lineOfSight(eye, near)) continue;
      candidates.push({ id: e.id, health, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const hits: StrikeHit[] = [];
    for (const c of candidates.slice(0, spec.maxTargets ?? 3)) {
      const r = c.health.damage({
        amount: spec.damage * (riposte ? 2 : 1),
        source: 'player',
        from: { ...s.player.position },
        kind: spec.kind ?? 'melee',
        knockback: spec.knockback ?? 4,
        stagger: spec.stagger ?? 0,
        guardBreak: !!spec.guardBreak || riposte,
        tags: spec.tags ?? [],
      });
      hits.push({ entityId: c.id, ...r });
    }
    if (hits.length > 0) {
      if (riposte) this.player.riposteUntil = -1;
      const rank: HitOutcome[] = ['defeated', 'guardBroken', 'hit', 'blocked', 'immune', 'parried', 'ignored'];
      const best = hits.map((h) => h.outcome).sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0]!;
      this.hitMarker = { serial: this.hitMarker.serial + 1, outcome: best };
      if (best === 'hit' || best === 'defeated' || best === 'guardBroken') s.presentation.emit({ type: 'fx', fx: 'shake', params: { intensity: 0.06, seconds: 0.1 } });
    }
    return hits;
  }

  // -------------------------------------------------------------------------------------------
  // Projectiles and shockwaves
  // -------------------------------------------------------------------------------------------

  spawnProjectile(spec: ProjectileSpec): void {
    const d = Math.hypot(spec.direction.x, spec.direction.y, spec.direction.z) || 1;
    this.projectiles.push({
      id: this.nextId++,
      position: { ...spec.from },
      velocity: { x: (spec.direction.x / d) * spec.speed, y: (spec.direction.y / d) * spec.speed, z: (spec.direction.z / d) * spec.speed },
      radius: spec.radius ?? 0.25,
      color: spec.color ?? '#ff8a3c',
      age: 0,
      ttl: spec.ttl ?? 4,
      damage: spec.damage,
      source: spec.source ?? null,
      faction: spec.faction ?? 'enemy',
      tags: spec.tags ?? [],
      knockback: spec.knockback ?? 3,
      gravity: spec.gravity ?? 0,
      reflectable: spec.reflectable ?? true,
      reflected: false,
      guardBreak: spec.guardBreak ?? false,
      unblockable: spec.unblockable ?? false,
    });
  }

  spawnWave(spec: WaveSpec): void {
    this.waves.push({
      id: this.nextId++,
      center: { ...spec.center },
      radius: 0.2,
      speed: spec.speed,
      maxRadius: spec.maxRadius,
      height: spec.height ?? 0.7,
      thickness: spec.thickness ?? 0.8,
      color: spec.color ?? '#ffb347',
      damage: spec.damage,
      source: spec.source ?? null,
      faction: spec.faction ?? 'enemy',
      knockback: spec.knockback ?? 6,
      tags: spec.tags ?? [],
      unblockable: spec.unblockable ?? false,
      hit: new Set(),
    });
  }

  private solidAt(p: Vec3): boolean {
    const w = this.session.world!;
    const info = w.paletteInfo();
    const idx = w.volume.getIndex(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    return idx !== 0 && info.solid[idx] === 1;
  }

  private distanceToPlayer(p: Vec3): number {
    const s = this.session;
    const feet = s.player.position;
    const top = feet.y + s.player.params.height - 0.1;
    const y = Math.min(top, Math.max(feet.y + 0.2, p.y));
    return Math.hypot(p.x - feet.x, p.y - y, p.z - feet.z);
  }

  private updateProjectiles(dt: number): void {
    const s = this.session;
    const w = s.world;
    if (!w) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]!;
      pr.age += dt;
      if (pr.age > pr.ttl) {
        this.projectiles.splice(i, 1);
        continue;
      }
      const speed = Math.hypot(pr.velocity.x, pr.velocity.y, pr.velocity.z);
      const steps = Math.max(1, Math.ceil((speed * dt) / Math.max(0.1, pr.radius)));
      const h = dt / steps;
      let gone = false;
      for (let k = 0; k < steps && !gone; k++) {
        pr.velocity.y -= pr.gravity * h;
        pr.position.x += pr.velocity.x * h;
        pr.position.y += pr.velocity.y * h;
        pr.position.z += pr.velocity.z * h;
        if (this.solidAt(pr.position)) {
          gone = true;
          break;
        }
        if (isHostile(pr.faction, 'ally') && !pr.reflected && this.enabled && !this.player.defeated) {
          if (this.distanceToPlayer(pr.position) <= pr.radius + 0.35) {
            const back = speed > 1e-3 ? { x: pr.position.x - pr.velocity.x / speed, y: pr.position.y, z: pr.position.z - pr.velocity.z / speed } : pr.position;
            const r = this.damagePlayer({
              amount: pr.damage,
              source: pr.source,
              from: back,
              kind: 'projectile',
              knockback: pr.knockback,
              tags: pr.tags,
              guardBreak: pr.guardBreak,
              unblockable: pr.unblockable,
            });
            if (r.outcome === 'ignored' && this.player.iframes > 0) continue;
            if (r.outcome === 'parried' && pr.reflectable && this.player.guard?.reflect === true) {
              this.reflect(pr);
              break;
            }
            gone = true;
            break;
          }
        }
        if (pr.faction !== 'enemy' || pr.reflected) {
          const target = this.entityAt(pr.position, pr.radius, pr.reflected ? 'ally' : pr.faction, pr.reflected ? null : pr.source);
          if (target) {
            this.damage(target, { amount: pr.damage, source: pr.reflected ? 'player' : pr.source, from: { ...pr.position }, kind: 'projectile', knockback: pr.knockback, tags: pr.tags, stagger: pr.reflected ? 1 : 0 });
            gone = true;
          }
        }
      }
      if (gone) this.projectiles.splice(i, 1);
    }
  }

  private reflect(pr: ProjectileState): void {
    const src = this.positionOf(pr.source);
    const speed = Math.hypot(pr.velocity.x, pr.velocity.y, pr.velocity.z) * 1.25;
    let dir = { x: -pr.velocity.x, y: -pr.velocity.y, z: -pr.velocity.z };
    if (src) dir = { x: src.x - pr.position.x, y: src.y + 1.1 - pr.position.y, z: src.z - pr.position.z };
    const d = Math.hypot(dir.x, dir.y, dir.z) || 1;
    pr.velocity = { x: (dir.x / d) * speed, y: (dir.y / d) * speed, z: (dir.z / d) * speed };
    pr.reflected = true;
    pr.age = 0;
    pr.color = '#e8f6ff';
    this.session.bus.emit('combat.reflected', { source: pr.source ?? '' });
  }

  private entityAt(p: Vec3, radius: number, attacker: Faction, exclude: string | null): string | null {
    const w = this.session.world;
    if (!w) return null;
    for (const e of w.entities.values()) {
      if (e.id === exclude || !e.visible || !e.enabled) continue;
      const h = this.healthOf(e.id);
      if (!h || h.defeated || !isHostile(attacker, h.faction)) continue;
      const b = this.entityBox(e);
      if (p.x >= b.minX - radius && p.x <= b.maxX + radius && p.y >= b.minY - radius && p.y <= b.maxY + radius && p.z >= b.minZ - radius && p.z <= b.maxZ + radius) return e.id;
    }
    return null;
  }

  private updateWaves(dt: number): void {
    const s = this.session;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i]!;
      wv.radius += wv.speed * dt;
      if (wv.radius > wv.maxRadius) {
        this.waves.splice(i, 1);
        continue;
      }
      if (isHostile(wv.faction, 'ally') && this.enabled && !wv.hit.has('player')) {
        const p = s.player.position;
        const d = Math.hypot(p.x - wv.center.x, p.z - wv.center.z);
        if (Math.abs(d - wv.radius) <= wv.thickness / 2 + 0.3 && p.y <= wv.center.y + wv.height && p.y >= wv.center.y - 1.5) {
          wv.hit.add('player');
          this.damagePlayer({ amount: wv.damage, source: wv.source, from: { ...wv.center }, kind: 'wave', knockback: wv.knockback, tags: wv.tags, unblockable: wv.unblockable });
        }
      }
      if (wv.faction !== 'enemy') {
        for (const { entity } of this.hostilesNear(wv.center, wv.radius + wv.thickness, wv.faction === 'ally' ? 'enemy' : 'ally')) {
          if (wv.hit.has(entity.id) || entity.id === wv.source) continue;
          const d = Math.hypot(entity.position.x - wv.center.x, entity.position.z - wv.center.z);
          if (Math.abs(d - wv.radius) > wv.thickness / 2 + 0.4) continue;
          wv.hit.add(entity.id);
          this.damage(entity.id, { amount: wv.damage, source: wv.source, from: { ...wv.center }, kind: 'wave', knockback: wv.knockback, tags: wv.tags });
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Combat state and music
  // -------------------------------------------------------------------------------------------

  /** A combatant fights the player (called every frame while engaged). */
  reportEngaged(entityId: string): void {
    this.engagedUntil.set(entityId, this.session.clock.now + 1);
  }

  private setInCombat(v: boolean): void {
    this.inCombat = v;
    this.session.bus.emit('combat.engaged', { engaged: v });
    if (v && this.combatMusic && this.combatMusicToken === null) this.combatMusicToken = this.pushMusic(this.combatMusic);
    if (!v && this.combatMusicToken !== null) {
      this.popMusic(this.combatMusicToken);
      this.combatMusicToken = null;
    }
  }

  /** Plays a music over the current one until `popMusic` (the latest pushed wins). */
  pushMusic(id: string): number {
    if (this.musicBefore === undefined) this.musicBefore = this.session.presentation.currentMusic;
    const token = ++this.musicToken;
    this.musicStack.push({ token, id });
    this.session.presentation.emit({ type: 'music', id, fade: 1.2 });
    return token;
  }

  popMusic(token: number): void {
    const i = this.musicStack.findIndex((m) => m.token === token);
    if (i < 0) return;
    const wasTop = i === this.musicStack.length - 1;
    this.musicStack.splice(i, 1);
    if (!wasTop) return;
    const next = this.musicStack[this.musicStack.length - 1];
    if (next) this.session.presentation.emit({ type: 'music', id: next.id, fade: 1.5 });
    else {
      this.session.presentation.emit({ type: 'music', id: this.musicBefore ?? null, fade: 2.5 });
      this.musicBefore = undefined;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------

  update(dt: number): void {
    const s = this.session;
    if (!s.world) return;
    const p = this.player;
    if (this.enabled) {
      if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - dt);
      if (p.stagger > 0) p.stagger = Math.max(0, p.stagger - dt);
      if (p.dodgeCooldown > 0) p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
      if (p.defeated) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.respawn();
      } else if (p.health < p.maxHealth && !this.inCombat && s.clock.now - p.lastHitAt >= this.regenDelay) {
        p.health = Math.min(p.maxHealth, p.health + this.regenRate * dt);
      }
    }
    const now = s.clock.now;
    let engaged = false;
    for (const [id, until] of this.engagedUntil) {
      if (until < now) this.engagedUntil.delete(id);
      else engaged = true;
    }
    if (engaged) {
      this.calmTimer = 0;
      if (!this.inCombat) this.setInCombat(true);
    } else if (this.inCombat) {
      this.calmTimer += dt;
      if (this.calmTimer > 3) this.setInCombat(false);
    }
    if (this.projectiles.length) this.updateProjectiles(dt);
    if (this.waves.length) this.updateWaves(dt);
  }
}
