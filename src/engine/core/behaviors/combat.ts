/**
 * Combat components: health (anything that can be hit), combatants (enemies and allies with
 * telegraphed attacks), encounters (arenas and waves), bosses (health bar and phases),
 * checkpoints and tool targets (what a tool in hand repairs, unlocks or reveals).
 *
 * They only do something in civilizations that place them in their scenes; the player's own
 * health is turned on by `ctx.combat.enablePlayer()`.
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';
import type { EntityApi } from '../sim/api';
import type { CombatantApi, DamageInfo, Faction, HealthApi, HitOutcome, HitResult } from '../combat/combat';
import { isHostile } from '../combat/combat';
import { Rng, hashString } from '../util/rng';
import { DEG2RAD, type Vec3 } from '../util/math';

const FACTIONS = [
  { value: 'enemy', label: 'Ennemi' },
  { value: 'ally', label: 'Allié' },
  { value: 'neutral', label: 'Neutre (mannequin, objet)' },
] as const;

/** Whether a point is inside a volume placed on an entity (turning with it). */
function volumeContains(entity: EntityApi, size: [number, number, number], offset: [number, number, number], p: Vec3): boolean {
  const [sx, sy, sz] = size;
  const [ox, oy, oz] = offset;
  const e = entity.position;
  const yaw = entity.yaw * DEG2RAD;
  // Point in the volume's local frame (the volume turns with the entity).
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw) - ox;
  const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw) - oz;
  const ly = p.y - e.y - oy;
  return Math.abs(lx) <= sx / 2 && Math.abs(lz) <= sz / 2 && ly >= -0.1 && ly <= sy;
}

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// ---------------------------------------------------------------------------------------------
// core.health
// ---------------------------------------------------------------------------------------------

export const healthBehavior = defineBehavior({
  id: 'core.health',
  label: 'Points de vie',
  category: 'Combat',
  description: 'Peut être frappé : vie, camp, faiblesses, protections et défaite (ennemi, mannequin, objet cassable).',
  props: {
    max: prop.number({ label: 'Vie', default: 30, min: 1, max: 5000 }),
    faction: prop.enum(FACTIONS, { label: 'Camp', default: 'enemy' }),
    armor: prop.number({ label: 'Armure (retirée de chaque coup)', default: 0, min: 0 }),
    weakTo: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Faiblesses (étiquettes de dégâts)', itemLabel: 'Étiquette' }),
    weakMultiplier: prop.number({ label: 'Multiplicateur de faiblesse', default: 2, min: 1, max: 10 }),
    resists: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Résistances (moitié des dégâts)', itemLabel: 'Étiquette' }),
    onlyHurtBy: prop.list(prop.string({ label: 'Étiquette' }), {
      label: 'Protégé, sauf contre',
      itemLabel: 'Étiquette',
      description: 'Vide : tout coup blesse. Sinon, seuls ces coups blessent (ou tous, pendant une exposition).',
    }),
    invulnerable: prop.boolean({ label: 'Invulnérable' }),
    knockback: prop.number({ label: 'Recul subi (×)', default: 1, min: 0, max: 3 }),
    onDefeat: prop.enum(
      [
        { value: 'remove', label: 'Disparaît' },
        { value: 'down', label: 'Reste à terre' },
        { value: 'yield', label: 'Se rend (reste debout)' },
        { value: 'stay', label: 'Rien (actions seulement)' },
      ],
      { label: 'À la défaite', default: 'remove' },
    ),
    defeatActions: prop.actions({ label: 'Actions à la défaite' }),
    hitSound: prop.sound({ label: 'Son d’impact', default: 'core:hit' }),
    immuneSound: prop.sound({ label: 'Son sans effet', default: 'core:clang' }),
    defeatSound: prop.sound({ label: 'Son de défaite', default: 'core:defeat_enemy' }),
    showBar: prop.boolean({ label: 'Barre de vie quand il est touché', default: true }),
    regen: prop.number({ label: 'Régénération (vie/s, hors combat)', default: 0, min: 0, advanced: true }),
  },
  state: { version: 1, initial: (p: { max: number }) => ({ health: p.max, defeated: false }) },
  create(ctx) {
    let exposedUntil = -1;
    let shieldUntil = -1;
    let lastHit = -1e9;
    let hitSerial = 0;

    const showState = () => {
      ctx.entity.setViewFlag('health', ctx.state.health / ctx.props.max);
      if (ctx.props.showBar && !ctx.state.defeated && ctx.time.now - lastHit < 5) ctx.entity.setViewFlag('healthBar', true);
      else ctx.entity.setViewFlag('healthBar', null);
    };

    const showDefeat = (instant: boolean) => {
      ctx.entity.setViewFlag('defeated', true);
      ctx.entity.setViewFlag('telegraph', null);
      ctx.entity.setViewFlag('holdAnimation', true);
      if (ctx.entity.has('core.combatant')) ctx.entity.steer(null);
      const mode = ctx.props.onDefeat;
      if (mode === 'yield') ctx.entity.playAnimation('yield', { loop: true });
      else if (mode !== 'stay') ctx.entity.playAnimation('defeat', { loop: false });
      if (mode === 'remove') {
        if (instant) {
          ctx.entity.visible = false;
          ctx.entity.enabled = false;
        } else {
          ctx.time.after(0.9, () => {
            if (!ctx.state.defeated) return;
            ctx.entity.visible = false;
            ctx.entity.enabled = false;
          });
        }
      }
    };

    const defeat = (by: string) => {
      ctx.state.defeated = true;
      ctx.state.health = 0;
      if (ctx.props.defeatSound) ctx.audio.play(ctx.props.defeatSound, { at: ctx.entity.id });
      showDefeat(false);
      showState();
      ctx.events.emit('combat.defeated', { entityId: ctx.entity.id, by });
      void ctx.logic.run(ctx.props.defeatActions, { self: ctx.entity.id, origin: `défaite de ${ctx.entity.id}` });
    };

    const feedback = (outcome: HitOutcome, info: DamageInfo, amount: number) => {
      hitSerial++;
      ctx.entity.setViewFlag('hit', hitSerial);
      ctx.entity.setViewFlag('hitOutcome', outcome);
      const sound = outcome === 'immune' ? ctx.props.immuneSound : outcome === 'blocked' ? 'core:block' : ctx.props.hitSound;
      if (sound) ctx.audio.play(sound, { at: ctx.entity.id });
      ctx.events.emit('combat.hit', {
        entityId: ctx.entity.id,
        source: info.source ?? '',
        amount,
        health: ctx.state.health,
        outcome,
        tags: info.tags ?? [],
      });
    };

    const api: HealthApi = {
      get health() {
        return ctx.state.health;
      },
      get max() {
        return ctx.props.max;
      },
      get defeated() {
        return ctx.state.defeated;
      },
      get faction() {
        return ctx.props.faction as Faction;
      },
      get exposed() {
        return ctx.time.now < exposedUntil;
      },
      damage(info: DamageInfo): HitResult {
        if (ctx.state.defeated || !ctx.entity.enabled) return { outcome: 'ignored', damage: 0 };
        const tags = info.tags ?? [];
        const now = ctx.time.now;
        lastHit = now;
        const protectedTarget = ctx.props.onlyHurtBy.length > 0 && !tags.some((t) => ctx.props.onlyHurtBy.includes(t)) && now >= exposedUntil;
        if (ctx.props.invulnerable || now < shieldUntil || protectedTarget) {
          feedback('immune', info, 0);
          showState();
          return { outcome: 'immune', damage: 0 };
        }
        const fighter = ctx.entity.behavior<CombatantApi>('core.combatant');
        let outcome: HitOutcome = 'hit';
        if (fighter && !info.unblockable && fighter.blocks(info)) {
          if (!info.guardBreak) {
            feedback('blocked', info, 0);
            showState();
            return { outcome: 'blocked', damage: 0 };
          }
          outcome = 'guardBroken';
          fighter.stagger(1.4);
        }
        let amount = Math.max(0, info.amount);
        if (tags.some((t) => ctx.props.weakTo.includes(t))) amount *= ctx.props.weakMultiplier;
        if (tags.some((t) => ctx.props.resists.includes(t))) amount *= 0.5;
        amount = Math.max(0, amount - ctx.props.armor);
        ctx.state.health = Math.max(0, ctx.state.health - amount);
        const kb = (info.knockback ?? 0) * ctx.props.knockback;
        if (kb > 0 && (ctx.entity.has('core.combatant') || ctx.entity.has('core.npc'))) {
          const from = info.from ?? ctx.player.position;
          const dx = ctx.entity.position.x - from.x;
          const dz = ctx.entity.position.z - from.z;
          const d = Math.hypot(dx, dz) || 1;
          ctx.entity.push({ x: (dx / d) * kb, y: Math.min(2.5, kb * 0.25), z: (dz / d) * kb });
        }
        if (ctx.state.health <= 0) {
          feedback('defeated', info, amount);
          defeat(info.source ?? '');
          return { outcome: 'defeated', damage: amount };
        }
        feedback(outcome, info, amount);
        showState();
        return { outcome, damage: amount };
      },
      heal(amount) {
        if (ctx.state.defeated || amount <= 0) return;
        ctx.state.health = Math.min(ctx.props.max, ctx.state.health + amount);
        showState();
      },
      revive(health) {
        ctx.state.defeated = false;
        ctx.state.health = Math.min(ctx.props.max, Math.max(1, health ?? ctx.props.max));
        ctx.entity.setViewFlag('defeated', null);
        ctx.entity.setViewFlag('holdAnimation', null);
        ctx.entity.enabled = true;
        ctx.entity.visible = true;
        ctx.entity.playAnimation('idle', { loop: true });
        lastHit = -1e9;
        showState();
      },
      expose(seconds) {
        exposedUntil = Math.max(exposedUntil, ctx.time.now + seconds);
        ctx.entity.setViewFlag('exposed', true);
        ctx.time.after(seconds, () => {
          if (ctx.time.now >= exposedUntil) ctx.entity.setViewFlag('exposed', null);
        });
      },
      shield(seconds) {
        shieldUntil = Math.max(shieldUntil, ctx.time.now + seconds);
      },
    };

    if (ctx.state.defeated) showDefeat(true);
    showState();

    return {
      api,
      update(dt) {
        if (ctx.state.defeated) return;
        if (ctx.props.regen > 0 && ctx.state.health < ctx.props.max && ctx.time.now - lastHit > 4) {
          ctx.state.health = Math.min(ctx.props.max, ctx.state.health + ctx.props.regen * dt);
        }
        showState();
      },
      onPropsChanged() {
        if (ctx.state.health > ctx.props.max) ctx.state.health = ctx.props.max;
      },
    };
  },
});

// ---------------------------------------------------------------------------------------------
// core.combatant
// ---------------------------------------------------------------------------------------------

const ATTACK_KINDS = [
  { value: 'melee', label: 'Coup au corps à corps' },
  { value: 'lunge', label: 'Charge (bond en avant)' },
  { value: 'slam', label: 'Frappe au sol (zone autour)' },
  { value: 'wave', label: 'Onde de choc (à sauter)' },
  { value: 'projectile', label: 'Projectile' },
] as const;

const attackSchema = prop.object(
  {
    id: prop.string({ label: 'Identifiant', default: 'frappe' }),
    kind: prop.enum(ATTACK_KINDS, { label: 'Type', default: 'melee' }),
    range: prop.number({ label: 'Portée (m)', default: 2, min: 0.5, max: 40 }),
    minRange: prop.number({ label: 'Portée minimale (m)', default: 0, min: 0, max: 30 }),
    windup: prop.number({ label: 'Préparation visible (s)', default: 0.7, min: 0.1, max: 5 }),
    active: prop.number({ label: 'Durée du coup (s)', default: 0.2, min: 0.05, max: 3 }),
    recover: prop.number({ label: 'Récupération (s)', default: 0.8, min: 0, max: 5 }),
    cooldown: prop.number({ label: 'Délai avant de la refaire (s)', default: 1.5, min: 0, max: 30 }),
    damage: prop.number({ label: 'Dégâts', default: 12, min: 0 }),
    knockback: prop.number({ label: 'Recul (m/s)', default: 5, min: 0 }),
    stagger: prop.number({ label: 'Déséquilibre infligé (s)', default: 0, min: 0, max: 3 }),
    guardBreak: prop.boolean({ label: 'Brise la garde' }),
    unblockable: prop.boolean({ label: 'Imparable' }),
    arc: prop.number({ label: 'Angle (°)', default: 100, min: 10, max: 360 }),
    speed: prop.number({ label: 'Vitesse (projectile, onde, charge)', default: 12, min: 1, max: 60 }),
    count: prop.integer({ label: 'Nombre de projectiles', default: 1, min: 1, max: 12 }),
    spread: prop.number({ label: 'Dispersion (°)', default: 0, min: 0, max: 90 }),
    weight: prop.number({ label: 'Fréquence relative', default: 1, min: 0.01, max: 100 }),
    phase: prop.integer({ label: 'À partir de la phase (boss)', default: 0, min: 0, max: 9 }),
    color: prop.color({ label: 'Couleur du signal', default: '#ff7a3c' }),
    sound: prop.sound({ label: 'Son du coup', default: 'core:swing' }),
    windupSound: prop.sound({ label: 'Son de préparation', default: 'core:windup' }),
    tags: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Étiquettes de dégâts', itemLabel: 'Étiquette' }),
  },
  { label: 'Attaque' },
);

type AttackSpec = (typeof attackSchema)['default'];

type Mode = 'idle' | 'chase' | 'windup' | 'active' | 'recover' | 'stagger' | 'return' | 'down';

interface Target {
  id: string;
  position: Vec3;
  aim: Vec3;
}

export const combatantBehavior = defineBehavior({
  id: 'core.combatant',
  label: 'Combattant',
  category: 'Combat',
  description: 'Adversaire ou allié : poursuit, prépare ses attaques de façon visible, frappe, recule et vacille.',
  requires: ['core.health'],
  props: {
    engageOn: prop.enum(
      [
        { value: 'sight', label: 'Quand il voit sa cible' },
        { value: 'manual', label: 'Sur ordre (rencontre, script) ou quand on le frappe' },
      ],
      { label: 'Entre en combat', default: 'sight' },
    ),
    aggroRadius: prop.number({ label: 'Distance de détection (m)', default: 9, min: 1, max: 60 }),
    leashRadius: prop.number({ label: 'Abandonne au-delà de (m, depuis son poste)', default: 26, min: 2, max: 200 }),
    speed: prop.number({ label: 'Vitesse (m/s)', default: 3, min: 0, max: 12 }),
    keepDistance: prop.number({ label: 'Distance de combat préférée (m)', default: 1.7, min: 0.5, max: 30 }),
    guard: prop.enum(
      [
        { value: 'none', label: 'Aucune' },
        { value: 'front', label: 'Bouclier devant lui' },
      ],
      { label: 'Garde', default: 'none' },
    ),
    guardArc: prop.number({ label: 'Angle protégé (°)', default: 120, min: 10, max: 360 }),
    poise: prop.number({ label: 'Équilibre (dégâts avant de vaciller)', default: 18, min: 1 }),
    staggerTime: prop.number({ label: 'Durée d’un vacillement (s)', default: 0.9, min: 0.1, max: 5 }),
    maxAttackers: prop.integer({ label: 'Attaquants simultanés sur le joueur', default: 2, min: 1, max: 12, advanced: true }),
    attacks: prop.list(attackSchema, { label: 'Attaques', itemLabel: 'Attaque' }),
    height: prop.number({ label: 'Taille (m)', default: 1.8, min: 0.4, max: 8, advanced: true }),
    width: prop.number({ label: 'Largeur (m)', default: 0.7, min: 0.2, max: 6, advanced: true }),
    solid: prop.boolean({ label: 'Bloque le passage', default: true, advanced: true }),
  },
  create(ctx) {
    const id = ctx.entity.id;
    const rng = new Rng(hashString(id));
    const home = { ...ctx.entity.position };
    const homeYaw = ctx.entity.yaw;
    let mode: Mode = 'idle';
    let timer = 0;
    let timerTotal = 1;
    let current: AttackSpec | null = null;
    let target: Target | null = null;
    let phase = 0;
    let poiseDamage = 0;
    let lastPoiseHit = -1e9;
    let strafeSign = rng.chance(0.5) ? 1 : -1;
    let strafeTimer = 0;
    let pathTimer = 0;
    let struck = false;
    const readyAt = new Map<string, number>();

    // A body for aiming and blocking (NPC appearances bring their own).
    if (!ctx.entity.has('core.npc')) {
      const w = ctx.props.width / 2;
      ctx.entity.setCollider('combat', { minX: -w, minY: 0, minZ: -w, maxX: w, maxY: ctx.props.height, maxZ: w }, { solid: ctx.props.solid, pickable: true });
    }

    const health = () => ctx.entity.behavior<HealthApi>('core.health');
    const faction = (): Faction => health()?.faction ?? 'enemy';
    const pos = () => ctx.entity.position;
    const eye = (): Vec3 => ({ x: pos().x, y: pos().y + ctx.props.height * 0.8, z: pos().z });

    const setMode = (m: Mode, seconds = 0) => {
      mode = m;
      timer = seconds;
      timerTotal = Math.max(1e-3, seconds);
      if (m !== 'windup') ctx.entity.setViewFlag('telegraph', null);
      ctx.entity.setViewFlag('combatState', m);
      ctx.entity.setViewFlag('holdAnimation', m === 'windup' || m === 'active' || m === 'stagger' || m === 'down' ? true : null);
    };

    const storyHold = () => ctx.dialogue.active || ctx.cinematics.playing !== null;

    const findTargets = (): Target[] => {
      const out: Target[] = [];
      const f = faction();
      if (f === 'enemy' || f === 'neutral') {
        if (ctx.combat.enabled && !ctx.combat.player.defeated) {
          const p = ctx.player.position;
          out.push({ id: 'player', position: p, aim: { x: p.x, y: ctx.player.eye.y - 0.35, z: p.z } });
        }
      }
      for (const other of ctx.world.query({ component: 'core.health' })) {
        if (other.id === id || !other.visible || !other.enabled) continue;
        const h = other.behavior<HealthApi>('core.health');
        if (!h || h.defeated || !other.has('core.combatant')) continue;
        if (!isHostile(f, h.faction) || h.faction === 'neutral') continue;
        const p = other.position;
        const height = Number(other.props<{ height?: number }>('core.combatant').height ?? 1.8);
        out.push({ id: other.id, position: p, aim: { x: p.x, y: p.y + height * 0.6, z: p.z } });
      }
      return out;
    };

    const visible = (t: Target) => ctx.combat.lineOfSight(eye(), t.aim);

    const chooseTarget = (radius: number, needSight: boolean): Target | null => {
      let best: Target | null = null;
      let bestD = Infinity;
      for (const t of findTargets()) {
        const d = horizontalDistance(pos(), t.position);
        if (d > radius || Math.abs(t.position.y - pos().y) > 6) continue;
        if (needSight && !visible(t)) continue;
        // The player is preferred at equal distance (enemies are there for them).
        const score = d - (t.id === 'player' ? 1.5 : 0);
        if (score < bestD) {
          bestD = score;
          best = t;
        }
      }
      return best;
    };

    const refreshTarget = () => {
      if (!target) return;
      const t = findTargets().find((c) => c.id === target!.id);
      target = t ?? null;
    };

    const engage = () => {
      if (mode === 'down' || health()?.defeated) return;
      if (mode === 'idle' || mode === 'return') {
        target = chooseTarget(Math.max(ctx.props.aggroRadius, ctx.props.leashRadius), false);
        setMode('chase');
        ctx.entity.playAnimation('combat_idle', { loop: true });
      }
    };

    const disengage = () => {
      target = null;
      ctx.entity.steer(null);
      ctx.entity.setViewFlag('telegraph', null);
      setMode('return');
      void ctx.entity.moveTo(home, { speed: Math.max(1.4, ctx.props.speed * 0.7), stopDistance: 0.4 }).then((arrived) => {
        if (mode !== 'return') return;
        setMode('idle');
        if (arrived) ctx.entity.setYaw(homeYaw);
        ctx.entity.playAnimation('idle', { loop: true });
      });
    };

    const attackers = (): number => {
      let n = 0;
      for (const other of ctx.world.query({ component: 'core.combatant' })) {
        if (other.id === id) continue;
        const a = other.behavior<CombatantApi & { target: string | null }>('core.combatant');
        if (a && a.target === 'player' && (a.state === 'windup' || a.state === 'active')) n++;
      }
      return n;
    };

    const pickAttack = (dist: number, t: Target): AttackSpec | null => {
      const now = ctx.time.now;
      const options = ctx.props.attacks.filter(
        (a) => a.phase <= phase && (readyAt.get(a.id) ?? 0) <= now && dist <= a.range && dist >= a.minRange,
      );
      if (options.length === 0) return null;
      if (t.id === 'player' && attackers() >= ctx.props.maxAttackers) return null;
      if (!visible(t)) return null;
      const total = options.reduce((s, a) => s + a.weight, 0);
      let r = rng.next() * total;
      for (const a of options) {
        r -= a.weight;
        if (r <= 0) return a;
      }
      return options[options.length - 1]!;
    };

    const facingDir = (): { x: number; z: number } => {
      const yaw = ctx.entity.yaw * DEG2RAD;
      return { x: Math.sin(yaw), z: Math.cos(yaw) };
    };

    const hitTarget = (t: Target, a: AttackSpec): void => {
      const info: DamageInfo = {
        amount: a.damage,
        source: id,
        from: { ...pos() },
        kind: a.kind === 'projectile' ? 'projectile' : 'melee',
        knockback: a.knockback,
        stagger: a.stagger,
        guardBreak: a.guardBreak,
        unblockable: a.unblockable,
        tags: a.tags,
      };
      if (t.id === 'player') ctx.combat.damagePlayer(info);
      else ctx.combat.damage(t.id, info);
    };

    const inArc = (t: Target, arcDeg: number): boolean => {
      const f = facingDir();
      const dx = t.position.x - pos().x;
      const dz = t.position.z - pos().z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) return true;
      return (dx * f.x + dz * f.z) / d >= Math.cos((arcDeg * DEG2RAD) / 2);
    };

    const execute = (a: AttackSpec) => {
      struck = false;
      // Active first: a parry during the blow staggers this combatant, and that must stay.
      setMode('active', a.active);
      ctx.entity.setViewFlag('telegraph', null);
      ctx.entity.playAnimation(a.kind === 'slam' || a.kind === 'wave' ? 'slam' : a.kind === 'projectile' ? 'cast' : 'attack', { loop: false });
      if (a.sound) ctx.audio.play(a.sound, { at: id });
      readyAt.set(a.id, ctx.time.now + a.cooldown);
      const t = target;
      const f = faction();
      switch (a.kind) {
        case 'melee':
          if (t && horizontalDistance(pos(), t.position) <= a.range + 0.6 && inArc(t, a.arc) && visible(t)) hitTarget(t, a);
          struck = true;
          break;
        case 'slam':
          for (const c of findTargets()) {
            if (horizontalDistance(pos(), c.position) <= a.range && Math.abs(c.position.y - pos().y) < 1.2) hitTarget(c, a);
          }
          ctx.fx.shake(0.25, 0.3);
          struck = true;
          break;
        case 'wave':
          ctx.combat.spawnWave({
            center: { ...pos() },
            speed: a.speed,
            maxRadius: a.range * 1.6,
            damage: a.damage,
            source: id,
            faction: f,
            color: a.color,
            knockback: a.knockback,
            tags: a.tags,
            unblockable: a.unblockable,
          });
          ctx.fx.shake(0.2, 0.25);
          struck = true;
          break;
        case 'projectile': {
          if (!t) break;
          const from = { x: pos().x + facingDir().x * 0.5, y: pos().y + ctx.props.height * 0.7, z: pos().z + facingDir().z * 0.5 };
          const base = Math.atan2(t.aim.x - from.x, t.aim.z - from.z);
          const flat = Math.hypot(t.aim.x - from.x, t.aim.z - from.z);
          const pitch = Math.atan2(t.aim.y - from.y, flat);
          for (let i = 0; i < a.count; i++) {
            const off = a.count > 1 ? ((i / (a.count - 1)) * 2 - 1) * (a.spread / 2) : (rng.next() * 2 - 1) * (a.spread / 2);
            const yaw = base + off * DEG2RAD;
            ctx.combat.spawnProjectile({
              from,
              direction: { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) },
              speed: a.speed,
              damage: a.damage,
              source: id,
              faction: f,
              color: a.color,
              knockback: a.knockback,
              tags: a.tags,
              guardBreak: a.guardBreak,
              unblockable: a.unblockable,
            });
          }
          struck = true;
          break;
        }
        case 'lunge':
          // Contact is checked while the charge lasts.
          break;
      }
    };

    const startWindup = (a: AttackSpec) => {
      current = a;
      ctx.entity.steer(null);
      const seconds = a.windup * ctx.combat.tuning.telegraph;
      setMode('windup', seconds);
      ctx.entity.setViewFlag('telegraph', { kind: a.kind, progress: 0, range: a.range, arc: a.arc, color: a.color });
      ctx.entity.playAnimation('windup', { loop: false });
      if (a.windupSound) ctx.audio.play(a.windupSound, { at: id });
    };

    const api: CombatantApi & { readonly target: string | null } = {
      get state() {
        return mode;
      },
      get engaged() {
        return mode !== 'idle' && mode !== 'return' && mode !== 'down';
      },
      get target() {
        return target?.id ?? null;
      },
      engage,
      disengage,
      reset() {
        target = null;
        current = null;
        poiseDamage = 0;
        readyAt.clear();
        ctx.entity.stop();
        ctx.entity.steer(null);
        ctx.entity.setPosition(home);
        ctx.entity.setYaw(homeYaw);
        setMode('idle');
        ctx.entity.playAnimation('idle', { loop: true });
      },
      stagger(seconds) {
        if (mode === 'down' || health()?.defeated) return;
        current = null;
        poiseDamage = 0;
        ctx.entity.steer(null);
        setMode('stagger', seconds);
        ctx.entity.playAnimation('stagger', { loop: false });
        if (!target) engage();
      },
      blocks(info) {
        if (ctx.props.guard !== 'front' || mode === 'stagger' || mode === 'down') return false;
        const from = info.from ?? ctx.player.position;
        const f = facingDir();
        const dx = from.x - pos().x;
        const dz = from.z - pos().z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-3) return true;
        return (dx * f.x + dz * f.z) / d >= Math.cos((ctx.props.guardArc * DEG2RAD) / 2);
      },
      setPhase(p) {
        phase = p;
      },
    };

    // Being hit: aggro and loss of balance.
    ctx.events.on('combat.hit', (e) => {
      if (e.entityId !== id) return;
      if (mode === 'idle' || mode === 'return') {
        engage();
        if (e.source === 'player') target = findTargets().find((t) => t.id === 'player') ?? target;
      }
      if (e.outcome === 'hit' || e.outcome === 'guardBroken') {
        const now = ctx.time.now;
        if (now - lastPoiseHit > 3) poiseDamage = 0;
        lastPoiseHit = now;
        poiseDamage += e.amount;
        if (poiseDamage >= ctx.props.poise && mode !== 'stagger') api.stagger(ctx.props.staggerTime);
      }
    });
    ctx.events.on('combat.playerDefeated', () => {
      if (target?.id === 'player') disengage();
    });

    return {
      api,
      update(dt) {
        const h = health();
        if (!h || h.defeated) {
          if (mode !== 'down') {
            target = null;
            ctx.entity.steer(null);
            setMode('down');
          }
          return;
        }
        if (mode === 'down') setMode('idle');
        if (storyHold()) {
          ctx.entity.steer(null);
          return;
        }
        if (target?.id === 'player' && mode !== 'idle' && mode !== 'return') ctx.combat.reportEngaged(id);
        timer -= dt;
        switch (mode) {
          case 'idle': {
            if (ctx.props.engageOn !== 'sight') return;
            const t = chooseTarget(ctx.props.aggroRadius, true);
            if (t) {
              target = t;
              setMode('chase');
              ctx.entity.playAnimation('combat_idle', { loop: true });
            }
            return;
          }
          case 'return':
            if (chooseTarget(ctx.props.aggroRadius * 0.6, true) && ctx.props.engageOn === 'sight') {
              ctx.entity.stop();
              engage();
            }
            return;
          case 'chase': {
            refreshTarget();
            if (!target) target = chooseTarget(ctx.props.leashRadius, false);
            if (!target || horizontalDistance(pos(), home) > ctx.props.leashRadius) {
              disengage();
              return;
            }
            const t = target;
            const dist = horizontalDistance(pos(), t.position);
            ctx.entity.lookAt(t.aim);
            const a = pickAttack(dist, t);
            if (a) {
              startWindup(a);
              return;
            }
            // Movement: close in, keep the distance, circle around.
            pathTimer -= dt;
            const sight = visible(t);
            const dx = t.position.x - pos().x;
            const dz = t.position.z - pos().z;
            const d = Math.hypot(dx, dz) || 1;
            if (!sight && dist > 1.5) {
              if (pathTimer <= 0) {
                pathTimer = 1;
                void ctx.entity.moveTo(t.position, { speed: ctx.props.speed, stopDistance: ctx.props.keepDistance });
              }
              return;
            }
            if (ctx.props.speed <= 0) return;
            if (dist > ctx.props.keepDistance + 0.3) ctx.entity.steer({ x: dx / d, z: dz / d }, ctx.props.speed);
            else if (dist < ctx.props.keepDistance - 0.7) ctx.entity.steer({ x: -dx / d, z: -dz / d }, ctx.props.speed * 0.5);
            else {
              strafeTimer -= dt;
              if (strafeTimer <= 0) {
                strafeTimer = rng.range(1.5, 3);
                strafeSign = rng.chance(0.5) ? 1 : -1;
              }
              ctx.entity.steer({ x: (-dz / d) * strafeSign, z: (dx / d) * strafeSign }, ctx.props.speed * 0.35);
            }
            return;
          }
          case 'windup': {
            refreshTarget();
            const a = current;
            if (!a) {
              setMode('chase');
              return;
            }
            // Turning stops shortly before the blow: the player can sidestep a committed attack.
            if (target && timer > timerTotal * 0.25) ctx.entity.lookAt(target.aim);
            ctx.entity.setViewFlag('telegraph', { kind: a.kind, progress: Math.min(1, 1 - timer / timerTotal), range: a.range, arc: a.arc, color: a.color });
            if (timer <= 0) execute(a);
            return;
          }
          case 'active': {
            const a = current;
            if (a?.kind === 'lunge') {
              const f = facingDir();
              ctx.entity.steer(f, a.speed);
              if (!struck && target && horizontalDistance(pos(), target.position) <= 1.3 && Math.abs(target.position.y - pos().y) < 1.5) {
                struck = true;
                hitTarget(target, a);
              }
            }
            if (timer <= 0) {
              ctx.entity.steer(null);
              setMode('recover', a?.recover ?? 0.6);
              ctx.entity.playAnimation('combat_idle', { loop: true });
            }
            return;
          }
          case 'recover':
            if (target) ctx.entity.lookAt(target.aim);
            if (timer <= 0) {
              current = null;
              setMode('chase');
            }
            return;
          case 'stagger':
            if (timer <= 0) {
              setMode('chase');
              ctx.entity.playAnimation('combat_idle', { loop: true });
            }
            return;
          default:
            return;
        }
      },
      onPropsChanged() {
        if (!ctx.entity.has('core.npc')) {
          const w = ctx.props.width / 2;
          ctx.entity.setCollider('combat', { minX: -w, minY: 0, minZ: -w, maxX: w, maxY: ctx.props.height, maxZ: w }, { solid: ctx.props.solid, pickable: true });
        }
      },
      dispose() {
        ctx.entity.setViewFlag('telegraph', null);
      },
    };

  },
});

// ---------------------------------------------------------------------------------------------
// core.encounter
// ---------------------------------------------------------------------------------------------

export interface EncounterApi {
  readonly status: 'idle' | 'active' | 'done';
  readonly wave: number;
  start(): void;
  reset(): void;
  complete(): void;
}

export const encounterBehavior = defineBehavior({
  id: 'core.encounter',
  label: 'Rencontre (combat)',
  category: 'Combat',
  description: 'Combat organisé : se déclenche dans un volume, enchaîne des vagues, ferme des barrières, joue une musique et recommence si le joueur tombe.',
  props: {
    size: prop.vec3({ label: 'Zone de déclenchement (m)', default: [8, 4, 8] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0, 0] }),
    startOn: prop.enum(
      [
        { value: 'enter', label: 'Quand le joueur entre dans la zone' },
        { value: 'manual', label: 'Par une action ou un script' },
      ],
      { label: 'Démarrage', default: 'enter' },
    ),
    condition: prop.condition({ label: 'Possible si' }),
    title: prop.text({ label: 'Titre à l’écran (optionnel)' }),
    waves: prop.list(
      prop.object(
        {
          enemies: prop.list(prop.entity({ label: 'Combattant', withComponent: 'core.combatant' }), { label: 'Combattants', itemLabel: 'Combattant' }),
          delay: prop.number({ label: 'Délai avant la vague (s)', default: 1, min: 0, max: 30 }),
        },
        { label: 'Vague' },
      ),
      { label: 'Vagues', itemLabel: 'Vague' },
    ),
    barriers: prop.list(prop.entity({ label: 'Barrière' }), { label: 'Barrières (visibles pendant le combat)', itemLabel: 'Barrière' }),
    music: prop.music({ label: 'Musique du combat' }),
    resetOnDefeat: prop.boolean({ label: 'Recommence si le joueur tombe', default: true }),
    onStart: prop.actions({ label: 'Au début' }),
    onComplete: prop.actions({ label: 'À la victoire' }),
  },
  state: { version: 1, initial: () => ({ status: 'idle' as 'idle' | 'active' | 'done', wave: 0 }) },
  create(ctx) {
    let waveDelay = -1;
    let releaseMusic: (() => void) | null = null;
    const scope = () => ({ self: ctx.entity.id, origin: `rencontre ${ctx.entity.id}` });
    const entity = (eid: string): EntityApi | null => ctx.world.entity(eid);
    const allEnemies = () => ctx.props.waves.flatMap((w) => w.enemies).filter(Boolean);

    const setBarriers = (on: boolean) => {
      for (const b of ctx.props.barriers) {
        const e = entity(b);
        if (!e) continue;
        e.visible = on;
        e.enabled = on;
      }
    };

    const showWave = (index: number) => {
      for (const eid of ctx.props.waves[index]?.enemies ?? []) {
        const e = entity(eid);
        if (!e) continue;
        e.visible = true;
        e.enabled = true;
        e.behavior<CombatantApi>('core.combatant')?.engage();
      }
      ctx.events.emit('combat.encounterWave', { encounterId: ctx.entity.id, wave: index });
    };

    const hideLaterWaves = () => {
      ctx.props.waves.forEach((w, i) => {
        if (i === 0) return;
        for (const eid of w.enemies) {
          const e = entity(eid);
          if (e) {
            e.visible = false;
            e.enabled = false;
          }
        }
      });
    };

    const waveCleared = (index: number) =>
      (ctx.props.waves[index]?.enemies ?? []).every((eid) => {
        const e = entity(eid);
        return !e || e.behavior<HealthApi>('core.health')?.defeated !== false;
      });

    const stopMusic = () => {
      releaseMusic?.();
      releaseMusic = null;
    };

    const api: EncounterApi = {
      get status() {
        return ctx.state.status;
      },
      get wave() {
        return ctx.state.wave;
      },
      start() {
        if (ctx.state.status !== 'idle') return;
        ctx.state.status = 'active';
        ctx.state.wave = 0;
        setBarriers(true);
        if (ctx.props.music) releaseMusic = ctx.combat.pushMusic(ctx.props.music);
        if (ctx.props.title) ctx.ui.showLocation(ctx.t(ctx.props.title));
        ctx.events.emit('combat.encounterStarted', { encounterId: ctx.entity.id });
        void ctx.logic.run(ctx.props.onStart, scope());
        showWave(0);
      },
      complete() {
        if (ctx.state.status === 'done') return;
        ctx.state.status = 'done';
        setBarriers(false);
        stopMusic();
        ctx.events.emit('combat.encounterCompleted', { encounterId: ctx.entity.id });
        void ctx.logic.run(ctx.props.onComplete, scope());
      },
      reset() {
        if (ctx.state.status === 'done') return;
        ctx.state.status = 'idle';
        ctx.state.wave = 0;
        waveDelay = -1;
        for (const eid of allEnemies()) {
          const e = entity(eid);
          if (!e) continue;
          e.behavior<HealthApi>('core.health')?.revive();
          e.behavior<CombatantApi>('core.combatant')?.reset();
        }
        hideLaterWaves();
        setBarriers(false);
        stopMusic();
        ctx.events.emit('combat.encounterReset', { encounterId: ctx.entity.id });
      },
    };

    // Initial layout: a finished encounter stays finished; an interrupted one starts over.
    if (ctx.state.status === 'active') {
      ctx.state.status = 'idle';
      ctx.state.wave = 0;
      for (const eid of allEnemies()) entity(eid)?.behavior<HealthApi>('core.health')?.revive();
    }
    if (ctx.state.status === 'idle') hideLaterWaves();
    setBarriers(false);

    ctx.events.on('combat.playerRespawned', () => {
      if (ctx.state.status === 'active' && ctx.props.resetOnDefeat) api.reset();
    });

    return {
      api,
      update(dt) {
        const st = ctx.state;
        if (st.status === 'idle') {
          if (ctx.props.startOn !== 'enter' || !volumeContains(ctx.entity, ctx.props.size, ctx.props.offset, ctx.player.position)) return;
          if (!ctx.logic.test(ctx.props.condition, scope())) return;
          api.start();
          return;
        }
        if (st.status !== 'active') return;
        if (waveDelay >= 0) {
          waveDelay -= dt;
          if (waveDelay < 0) showWave(st.wave);
          return;
        }
        if (!waveCleared(st.wave)) return;
        if (st.wave + 1 < ctx.props.waves.length) {
          st.wave++;
          waveDelay = ctx.props.waves[st.wave]!.delay;
          if (waveDelay <= 0) {
            waveDelay = -1;
            showWave(st.wave);
          }
        } else api.complete();
      },
      dispose: stopMusic,
    };
  },
});

// ---------------------------------------------------------------------------------------------
// core.boss
// ---------------------------------------------------------------------------------------------

export const bossBehavior = defineBehavior({
  id: 'core.boss',
  label: 'Boss',
  category: 'Combat',
  description: 'Adversaire majeur : barre de vie en haut de l’écran, phases déclenchées par sa vie, musique.',
  requires: ['core.health', 'core.combatant'],
  props: {
    name: prop.text({ label: 'Nom affiché' }),
    title: prop.text({ label: 'Titre sous le nom' }),
    phases: prop.list(
      prop.object(
        {
          at: prop.number({ label: 'Quand sa vie passe sous (0–1)', default: 0.5, min: 0, max: 1, step: 0.05 }),
          shield: prop.number({ label: 'Invulnérable pendant (s)', default: 1.5, min: 0, max: 20 }),
          actions: prop.actions({ label: 'Actions' }),
        },
        { label: 'Phase' },
      ),
      { label: 'Phases', itemLabel: 'Phase' },
    ),
    music: prop.music({ label: 'Musique du boss' }),
  },
  state: { version: 1, initial: () => ({ phase: 0 }) },
  create(ctx) {
    let releaseMusic: (() => void) | null = null;
    let shown = false;
    let hiding = false;
    const id = ctx.entity.id;
    const health = () => ctx.entity.behavior<HealthApi>('core.health');
    const fighter = () => ctx.entity.behavior<CombatantApi>('core.combatant');
    fighter()?.setPhase(ctx.state.phase);
    const hide = () => {
      if (shown) ctx.combat.setBossBar(null);
      shown = false;
      hiding = false;
      releaseMusic?.();
      releaseMusic = null;
    };
    const barName = () => (ctx.props.name ? ctx.t(ctx.props.name) : ctx.entity.name);
    ctx.events.on('combat.encounterReset', () => {
      // Revived by its encounter: the fight starts over from the first phase.
      const h = health();
      if (!h || h.defeated || h.health < h.max) return;
      ctx.state.phase = 0;
      fighter()?.setPhase(0);
      hide();
    });
    return {
      update() {
        const h = health();
        const f = fighter();
        if (!h || !f) return;
        if (h.defeated) {
          if (shown && !hiding) {
            hiding = true;
            ctx.combat.setBossBar({ entityId: id, name: barName(), title: ctx.props.title ? ctx.t(ctx.props.title) : '', health: 0, max: h.max, phase: ctx.state.phase });
            releaseMusic?.();
            releaseMusic = null;
            ctx.time.after(1.5, () => {
              if (hiding) hide();
            });
          }
          return;
        }
        const active = f.engaged || h.health < h.max;
        if (!active) {
          if (shown) hide();
          return;
        }
        if (!shown && ctx.props.music) releaseMusic = ctx.combat.pushMusic(ctx.props.music, 2);
        shown = true;
        const ratio = h.health / h.max;
        const phases = ctx.props.phases;
        while (ctx.state.phase < phases.length && ratio <= phases[ctx.state.phase]!.at) {
          const p = phases[ctx.state.phase]!;
          ctx.state.phase++;
          f.setPhase(ctx.state.phase);
          if (p.shield > 0) h.shield(p.shield);
          ctx.events.emit('combat.bossPhase', { entityId: id, phase: ctx.state.phase });
          void ctx.logic.run(p.actions, { self: id, origin: `phase ${ctx.state.phase} de ${id}` });
        }
        ctx.combat.setBossBar({
          entityId: id,
          name: barName(),
          title: ctx.props.title ? ctx.t(ctx.props.title) : '',
          health: h.health,
          max: h.max,
          phase: ctx.state.phase,
        });
      },
      dispose: hide,
    };
  },
});

// ---------------------------------------------------------------------------------------------
// core.checkpoint
// ---------------------------------------------------------------------------------------------

export const checkpointBehavior = defineBehavior({
  id: 'core.checkpoint',
  label: 'Point de reprise',
  category: 'Combat',
  description: 'Le joueur se relève ici après une défaite, une fois la zone traversée.',
  props: {
    size: prop.vec3({ label: 'Taille de la zone (m)', default: [3, 3, 3] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0, 0] }),
    notify: prop.boolean({ label: 'Annoncer le point de reprise', default: true }),
  },
  state: { version: 1, initial: () => ({ reached: false }) },
  create(ctx) {
    let inside = false;
    return {
      update() {
        const now = volumeContains(ctx.entity, ctx.props.size, ctx.props.offset, ctx.player.position);
        if (now === inside) return;
        inside = now;
        if (!now) return;
        ctx.combat.setCheckpoint(ctx.entity.id);
        if (!ctx.state.reached && ctx.props.notify && ctx.combat.enabled) ctx.ui.notify(ctx.t('core.combat.checkpoint'), { kind: 'info', duration: 2.5 });
        ctx.state.reached = true;
      },
    };
  },
});

// ---------------------------------------------------------------------------------------------
// core.toolTarget
// ---------------------------------------------------------------------------------------------

export interface ToolTargetApi {
  readonly done: boolean;
  /** Localized verb shown while aiming at it with a matching tool. */
  readonly label: string;
  readonly holdSeconds: number;
  /** False when the target plays its own sound (the tool's « done » sound is skipped). */
  readonly toolSound: boolean;
  accepts(tool: string): boolean;
  /** Called by the tool use when the work is finished. */
  complete(itemId: string | null, tool: string): void;
}

export const toolTargetBehavior = defineBehavior({
  id: 'core.toolTarget',
  label: 'Cible d’outil',
  category: 'Interactions',
  description: 'Se répare, s’ouvre ou se révèle quand le joueur y applique l’outil attendu en tenant le clic.',
  props: {
    tool: prop.string({ label: 'Outil attendu (étiquette)', default: 'outil' }),
    label: prop.text({ label: 'Verbe affiché (« Réparer la pompe »)', default: 'core.use.use' }),
    holdSeconds: prop.number({ label: 'Durée d’utilisation (s)', default: 1.2, min: 0, max: 20 }),
    once: prop.boolean({ label: 'Une seule fois', default: true }),
    toolSound: prop.boolean({ label: 'Son de l’outil une fois terminé (sinon, la cible joue le sien)', default: true }),
    condition: prop.condition({ label: 'Possible si' }),
    onUse: prop.actions({ label: 'Actions une fois terminé' }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [1, 1, 1] }),
    offset: prop.vec3({ label: 'Décalage de la zone', default: [0, 0.5, 0] }),
  },
  state: { version: 1, initial: () => ({ done: false }) },
  create(ctx) {
    const applyBox = () => {
      const [sx, sy, sz] = ctx.props.size;
      const [ox, oy, oz] = ctx.props.offset;
      ctx.entity.setCollider('outil', { minX: ox - sx / 2, minY: oy - sy / 2, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy / 2, maxZ: oz + sz / 2 }, { solid: false, pickable: true });
    };
    applyBox();
    const scope = () => ({ self: ctx.entity.id, origin: `outil sur ${ctx.entity.id}` });
    const api: ToolTargetApi = {
      get done() {
        return ctx.state.done;
      },
      get label() {
        return ctx.t(ctx.props.label);
      },
      get holdSeconds() {
        return ctx.props.holdSeconds;
      },
      get toolSound() {
        return ctx.props.toolSound;
      },
      accepts(tool) {
        if (tool !== ctx.props.tool) return false;
        if (ctx.props.once && ctx.state.done) return false;
        return ctx.logic.test(ctx.props.condition, scope());
      },
      complete(itemId, tool) {
        if (ctx.props.once && ctx.state.done) return;
        ctx.state.done = true;
        ctx.events.emit('tool.used', { itemId: itemId ?? '', entityId: ctx.entity.id, tool });
        void ctx.logic.run(ctx.props.onUse, scope());
      },
    };
    return { api, onPropsChanged: applyBox };
  },
});

export const COMBAT_BEHAVIORS = [healthBehavior, combatantBehavior, encounterBehavior, bossBehavior, checkpointBehavior, toolTargetBehavior];
