/**
 * Engine item uses: what the mouse buttons do with an item in hand. Items reference them in
 * `held.primary` / `held.secondary` (content/items.json or defineItem), with their props.
 *
 *   core.melee        strike in front (click), charged strike (hold then release)
 *   core.guard        raise a guard while held: block, parry at the right moment, riposte
 *   core.useOnTarget  hold on a `core.toolTarget` accepting the tool (repair, unlock, reveal)
 *   core.shoot        throw / shoot a projectile toward the crosshair
 *   core.runActions   run logic actions (a whistle, a lamp, a signal)
 */
import { defineItemUse, type ItemUseContext } from '../packs/definitions';
import { prop } from '../props/props';
import type { ToolTargetApi } from '../behaviors/combat';

const HAND_SWINGS = [
  { value: 'swing', label: 'Coup de côté' },
  { value: 'swingHeavy', label: 'Coup lourd' },
  { value: 'thrust', label: 'Coup d’estoc' },
] as const;

// Per-use runtime state (a use context lives from press to release).
const meleeState = new WeakMap<object, { releasePose: (() => void) | null; ready: boolean }>();
const guardState = new WeakMap<object, () => void>();
const toolState = new WeakMap<object, { target: string; progress: number; finished: boolean; sound: { stop(): void } | null; releasePose: () => void }>();

export const meleeUse = defineItemUse({
  id: 'core.melee',
  label: 'Frapper',
  category: 'Combat',
  description: 'Coup devant soi au clic ; maintenir puis relâcher donne un coup chargé (si une durée de charge est définie).',
  mode: 'charge',
  hint: 'core.use.strike',
  props: {
    damage: prop.number({ label: 'Dégâts', default: 10, min: 0 }),
    reach: prop.number({ label: 'Portée (m)', default: 2.6, min: 0.5, max: 8 }),
    arc: prop.number({ label: 'Angle (°)', default: 100, min: 10, max: 360 }),
    knockback: prop.number({ label: 'Recul (m/s)', default: 4, min: 0 }),
    stagger: prop.number({ label: 'Déséquilibre (s)', default: 0, min: 0, max: 5 }),
    guardBreak: prop.boolean({ label: 'Brise les gardes' }),
    tags: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Étiquettes de dégâts', itemLabel: 'Étiquette' }),
    cooldown: prop.number({ label: 'Délai entre deux coups (s)', default: 0.42, min: 0, max: 10 }),
    animation: prop.enum(HAND_SWINGS, { label: 'Geste', default: 'swing' }),
    sound: prop.sound({ label: 'Son du geste', default: 'core:swing' }),
    hint: prop.text({ label: 'Verbe affiché', default: 'core.use.strike' }),
    charge: prop.object(
      {
        seconds: prop.number({ label: 'Durée de charge (s, 0 = aucune)', default: 0, min: 0, max: 5 }),
        damage: prop.number({ label: 'Dégâts chargés', default: 24, min: 0 }),
        knockback: prop.number({ label: 'Recul chargé (m/s)', default: 9, min: 0 }),
        stagger: prop.number({ label: 'Déséquilibre chargé (s)', default: 1.2, min: 0, max: 5 }),
        guardBreak: prop.boolean({ label: 'Brise les gardes', default: true }),
        tags: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Étiquettes chargées', itemLabel: 'Étiquette' }),
        label: prop.text({ label: 'Nom du coup chargé', default: 'core.use.chargedStrike' }),
        sound: prop.sound({ label: 'Son du coup chargé', default: 'core:swing_heavy' }),
      },
      { label: 'Coup chargé' },
    ),
  },
  start(use) {
    const p = use.props;
    strike(use, { damage: p.damage, knockback: p.knockback, stagger: p.stagger, guardBreak: p.guardBreak, tags: p.tags }, p.animation, p.sound);
    meleeState.set(use, { releasePose: null, ready: false });
    return true;
  },
  update(use) {
    const c = use.props.charge;
    const st = meleeState.get(use);
    if (!st || c.seconds <= 0 || use.heldFor < 0.28) return;
    if (!st.releasePose) st.releasePose = use.hand.hold('charge');
    const value = Math.min(1, (use.heldFor - 0.28) / Math.max(0.05, c.seconds - 0.28));
    use.ctx.equipment.setProgress({ label: use.ctx.t(c.label), value });
    if (value >= 1 && !st.ready) {
      st.ready = true;
      use.ctx.audio.play('core:charge_ready');
    }
  },
  stop(use) {
    const c = use.props.charge;
    const st = meleeState.get(use);
    st?.releasePose?.();
    use.ctx.equipment.setProgress(null);
    if (!st?.ready || use.cancelled) return;
    strike(use, { damage: c.damage, knockback: c.knockback, stagger: c.stagger, guardBreak: c.guardBreak, tags: c.tags.length ? c.tags : use.props.tags }, 'swingHeavy', c.sound);
    use.ctx.fx.shake(0.18, 0.2);
  },
});

function strike(
  use: ItemUseContext<{ reach: number; arc: number }>,
  blow: { damage: number; knockback: number; stagger: number; guardBreak: boolean; tags: string[] },
  animation: 'swing' | 'swingHeavy' | 'thrust',
  sound: string,
): void {
  const ctx = use.ctx;
  use.hand.play(animation, animation === 'swingHeavy' ? 0.42 : 0.3);
  if (sound) ctx.audio.play(sound);
  const hits = ctx.combat.strike({ damage: blow.damage, reach: use.props.reach, arc: use.props.arc, knockback: blow.knockback, stagger: blow.stagger, guardBreak: blow.guardBreak, tags: blow.tags });
  if (hits.length > 0) return;
  // A blow into a wall still makes a sound.
  const hit = ctx.world.raycast(ctx.player.eye, ctx.player.forward, use.props.reach);
  if (hit?.block) ctx.audio.play('core:thud', { at: hit.point });
}

export const guardUse = defineItemUse({
  id: 'core.guard',
  label: 'Parer',
  category: 'Combat',
  description: 'Garde levée tant que le bouton est tenu : bloque les coups de face. Levée juste avant l’impact, elle pare et ouvre une riposte.',
  mode: 'hold',
  hint: 'core.use.guard',
  props: {
    arc: prop.number({ label: 'Angle protégé (°)', default: 140, min: 10, max: 360 }),
    reduction: prop.number({ label: 'Dégâts arrêtés (0–1)', default: 0.8, min: 0, max: 1, step: 0.05 }),
    parryWindow: prop.number({ label: 'Fenêtre de parade (s)', default: 0.22, min: 0, max: 1, step: 0.01 }),
    parryStagger: prop.number({ label: 'Déséquilibre de l’attaquant paré (s)', default: 1.2, min: 0, max: 5 }),
    riposte: prop.number({ label: 'Durée de la riposte (s)', default: 1.5, min: 0, max: 5 }),
    reflect: prop.boolean({ label: 'Renvoie les projectiles parés' }),
    moveFactor: prop.number({ label: 'Vitesse en garde (×)', default: 0.55, min: 0.1, max: 1, step: 0.05 }),
    sound: prop.sound({ label: 'Son de garde', default: 'core:guard_up' }),
    hint: prop.text({ label: 'Verbe affiché', default: 'core.use.guard' }),
    cooldown: prop.number({ label: 'Délai après la garde (s)', default: 0.15, min: 0, max: 5 }),
  },
  start(use) {
    const p = use.props;
    const release = use.ctx.combat.raiseGuard({
      arc: p.arc,
      reduction: p.reduction,
      parryWindow: p.parryWindow,
      parryStagger: p.parryStagger,
      riposte: p.riposte,
      reflect: p.reflect,
      moveFactor: p.moveFactor,
    });
    guardState.set(use, release);
    use.hand.hold('raise');
    if (p.sound) use.ctx.audio.play(p.sound);
    return true;
  },
  stop(use) {
    guardState.get(use)?.();
  },
});

/** The `core.toolTarget` under the crosshair that accepts this tool. */
function aimedToolTarget(use: ItemUseContext<{ tool: string; reach: number }>): { id: string; api: ToolTargetApi } | null {
  const ctx = use.ctx;
  const hit = ctx.world.raycast(ctx.player.eye, ctx.player.forward, use.props.reach);
  const e = hit?.entity;
  if (!e || !e.has('core.toolTarget')) return null;
  const api = e.behavior<ToolTargetApi>('core.toolTarget');
  if (!api || !api.accepts(use.props.tool)) return null;
  return { id: e.id, api };
}

export const useOnTargetUse = defineItemUse({
  id: 'core.useOnTarget',
  label: 'Utiliser l’outil sur une cible',
  category: 'Outils',
  description: 'Maintenir le bouton en visant une « cible d’outil » qui attend cet outil (réparer, ouvrir, révéler).',
  mode: 'hold',
  props: {
    tool: prop.string({ label: 'Outil (étiquette attendue par les cibles)', default: 'outil' }),
    reach: prop.number({ label: 'Portée (m)', default: 3, min: 0.5, max: 12 }),
    speed: prop.number({ label: 'Vitesse de travail (×)', default: 1, min: 0.1, max: 10 }),
    sound: prop.sound({ label: 'Son pendant le travail', default: 'core:mechanism' }),
    doneSound: prop.sound({ label: 'Son une fois terminé', default: 'core:unlock' }),
    hint: prop.text({ label: 'Verbe par défaut (vide = seulement en visant une cible)' }),
    cooldown: prop.number({ label: 'Délai après usage (s)', default: 0.2, min: 0, max: 10 }),
  },
  aim(use) {
    const t = aimedToolTarget(use);
    return t ? t.api.label : null;
  },
  start(use) {
    const t = aimedToolTarget(use);
    if (!t) return false;
    const sound = use.props.sound ? use.ctx.audio.play(use.props.sound, { loop: t.api.holdSeconds > 0.6 }) : null;
    toolState.set(use, { target: t.id, progress: 0, finished: false, sound, releasePose: use.hand.hold('use') });
    if (t.api.holdSeconds <= 0) finishTool(use);
    return true;
  },
  update(use, dt) {
    const st = toolState.get(use);
    if (!st || st.finished) return;
    const t = aimedToolTarget(use);
    if (!t || t.id !== st.target) {
      // Looked away: the work stops (and starts over next time).
      st.progress = 0;
      use.ctx.equipment.setProgress(null);
      return;
    }
    st.progress += dt * use.props.speed;
    const value = Math.min(1, st.progress / Math.max(0.01, t.api.holdSeconds));
    use.ctx.equipment.setProgress({ label: t.api.label, value });
    if (value >= 1) finishTool(use);
  },
  stop(use) {
    const st = toolState.get(use);
    if (!st) return;
    st.sound?.stop();
    st.releasePose();
    use.ctx.equipment.setProgress(null);
  },
});

function finishTool(use: ItemUseContext<{ tool: string; reach: number; doneSound: string }>): void {
  const st = toolState.get(use);
  if (!st || st.finished) return;
  st.finished = true;
  st.sound?.stop();
  st.sound = null;
  use.ctx.equipment.setProgress(null);
  use.hand.play('use', 0.35);
  if (use.props.doneSound) use.ctx.audio.play(use.props.doneSound);
  const e = use.ctx.world.entity(st.target);
  e?.behavior<ToolTargetApi>('core.toolTarget')?.complete(use.itemId, use.props.tool);
}

export const shootUse = defineItemUse({
  id: 'core.shoot',
  label: 'Tirer / lancer',
  category: 'Combat',
  description: 'Lance un projectile vers le viseur. Peut consommer un objet comme munition.',
  mode: 'press',
  hint: 'core.use.shoot',
  props: {
    damage: prop.number({ label: 'Dégâts', default: 8, min: 0 }),
    speed: prop.number({ label: 'Vitesse (m/s)', default: 24, min: 1, max: 120 }),
    radius: prop.number({ label: 'Rayon (m)', default: 0.18, min: 0.05, max: 2 }),
    gravity: prop.number({ label: 'Gravité (m/s²)', default: 0, min: 0, max: 40 }),
    knockback: prop.number({ label: 'Recul (m/s)', default: 3, min: 0 }),
    color: prop.color({ label: 'Couleur', default: '#ffd27a' }),
    tags: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Étiquettes de dégâts', itemLabel: 'Étiquette' }),
    ammo: prop.item({ label: 'Munition consommée (optionnel)' }),
    cooldown: prop.number({ label: 'Délai entre deux tirs (s)', default: 0.6, min: 0, max: 10 }),
    sound: prop.sound({ label: 'Son du tir', default: 'core:whoosh' }),
    hint: prop.text({ label: 'Verbe affiché', default: 'core.use.shoot' }),
  },
  start(use) {
    const ctx = use.ctx;
    const p = use.props;
    if (p.ammo) {
      if (!ctx.inventory.has(p.ammo)) {
        ctx.ui.notify(ctx.t('core.use.noAmmo', { name: ctx.inventory.nameOf(p.ammo) }), { kind: 'denied' });
        return false;
      }
      ctx.inventory.remove(p.ammo, 1, { silent: true });
    }
    const eye = ctx.player.eye;
    const f = ctx.player.forward;
    ctx.combat.spawnProjectile({
      from: { x: eye.x + f.x * 0.5, y: eye.y + f.y * 0.5 - 0.1, z: eye.z + f.z * 0.5 },
      direction: f,
      speed: p.speed,
      damage: p.damage,
      radius: p.radius,
      gravity: p.gravity,
      knockback: p.knockback,
      color: p.color,
      tags: p.tags,
      source: 'player',
      faction: 'ally',
    });
    use.hand.play('thrust', 0.25);
    if (p.sound) ctx.audio.play(p.sound);
    return true;
  },
});

export const runActionsUse = defineItemUse({
  id: 'core.runActions',
  label: 'Exécuter des actions',
  category: 'Outils',
  description: 'Exécute des actions de logique (siffler, allumer, envoyer un signal).',
  mode: 'press',
  hint: 'core.use.use',
  props: {
    condition: prop.condition({ label: 'Possible si' }),
    actions: prop.actions({ label: 'Actions' }),
    animation: prop.enum(
      [
        { value: 'use', label: 'Utiliser' },
        { value: 'raise', label: 'Lever' },
        { value: 'cast', label: 'Projeter' },
        { value: 'inspect', label: 'Examiner' },
      ],
      { label: 'Geste', default: 'use' },
    ),
    sound: prop.sound({ label: 'Son' }),
    cooldown: prop.number({ label: 'Délai (s)', default: 0.5, min: 0, max: 60 }),
    hint: prop.text({ label: 'Verbe affiché', default: 'core.use.use' }),
  },
  start(use) {
    const scope = { origin: `objet en main ${use.itemId ?? 'main nue'}` };
    if (!use.ctx.logic.test(use.props.condition, scope)) return false;
    use.hand.play(use.props.animation, 0.4);
    if (use.props.sound) use.ctx.audio.play(use.props.sound);
    void use.ctx.logic.run(use.props.actions, scope);
    return true;
  },
});

export const CORE_ITEM_USES = [meleeUse, guardUse, useOnTargetUse, shootUse, runActionsUse];
