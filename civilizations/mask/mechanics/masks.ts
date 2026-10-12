import { defineCondition, defineEvent, defineItemUse, defineMechanic, prop, type CivContext, type ItemUseContext } from '@sdk';

/**
 * Masks of Viremasque: real objects worn in the `masque` slot. Only the worn mask gives its power,
 * and powers are used through the tools held in hand: the Cendre mask turns a charged hammer
 * blow into a **Braise** strike that breaks jammed mechanisms and guards.
 *
 * Switching masks (attunement window, overload) arrives with the second mask, in Chapter II.
 */
export const MASKS = {
  cendre: { item: 'mask:masque_cendre', name: 'mask.masque.cendre', power: 'mask.pouvoir.braise' },
} as const;
export type MaskId = keyof typeof MASKS;

export const MASK_SLOT = 'masque';

/** The mask the hero wears (null: none). */
export function wornMask(ctx: CivContext): MaskId | null {
  const item = ctx.equipment.worn(MASK_SLOT);
  for (const [id, m] of Object.entries(MASKS)) if (m.item === item) return id as MaskId;
  return null;
}

export const masksMechanic = defineMechanic({
  id: 'mask.masks',
  label: 'Masques et pouvoirs',
  description: 'Le masque porté donne son pouvoir aux outils tenus en main (Braise pour le Cendre).',
  setup(ctx) {
    // The rank plaque appears once the hero has put on a mask, and stays.
    const update = () => {
      if (wornMask(ctx) && !ctx.vars.get('mask.plaqueVisible')) ctx.vars.set('mask.plaqueVisible', true);
    };
    ctx.events.on('item.equipped', (e) => {
      if (e.slot !== MASK_SLOT) return;
      ctx.audio.play('mask:masque_enfile');
      update();
    });
    ctx.lifecycle.on('start', update);
    return { worn: () => wornMask(ctx) };
  },
});

export const wearingMask = defineCondition({
  id: 'mask.wearing',
  label: 'Le héros porte un masque',
  category: 'Viremasque',
  props: { mask: prop.enum([{ value: 'cendre', label: 'Masque de Cendre' }], { label: 'Masque', default: 'cendre' }) },
  test: (ctx, p) => wornMask(ctx) === p.mask,
  summarize: (p) => `porte le masque ${p.mask}`,
});

// ---------------------------------------------------------------------------------------------
// Braise — the hammer strike of the Cendre mask
// ---------------------------------------------------------------------------------------------

const braiseState = new WeakMap<object, { charging: boolean; ready: boolean; releaseTint: boolean }>();

function quickStrike(use: ItemUseContext<{ damage: number; reach: number }>): void {
  const ctx = use.ctx;
  use.hand.play('swing', 0.3);
  ctx.audio.play('core:swing');
  const hits = ctx.combat.strike({ damage: use.props.damage, reach: use.props.reach, arc: 100, knockback: 3, tags: ['marteau'] });
  if (hits.length > 0) return;
  const hit = ctx.world.raycast(ctx.player.eye, ctx.player.forward, use.props.reach);
  if (hit?.block) ctx.audio.play('core:thud', { at: hit.point });
}

export const braiseUse = defineItemUse({
  id: 'mask.braise',
  label: 'Marteau de Cendre (Braise)',
  category: 'Viremasque',
  description: 'Coup de marteau au clic. Avec le masque de Cendre, maintenir puis relâcher libère une frappe Braise : elle brise les gardes et débloque les mécanismes coincés.',
  mode: 'charge',
  hint: 'mask.use.marteau',
  props: {
    damage: prop.number({ label: 'Dégâts du coup simple', default: 8, min: 0 }),
    reach: prop.number({ label: 'Portée (m)', default: 2.5, min: 0.5, max: 6 }),
    chargeSeconds: prop.number({ label: 'Temps de charge de la Braise (s)', default: 0.8, min: 0.2, max: 4 }),
    braiseDamage: prop.number({ label: 'Dégâts de la Braise', default: 24, min: 0 }),
    braiseKnockback: prop.number({ label: 'Recul de la Braise (m/s)', default: 8, min: 0 }),
    cooldown: prop.number({ label: 'Délai entre deux coups (s)', default: 0.45, min: 0, max: 5 }),
  },
  aim: (use) => (wornMask(use.ctx) === 'cendre' ? use.ctx.t('mask.use.marteauBraise') : null),
  start(use) {
    quickStrike(use);
    braiseState.set(use, { charging: false, ready: false, releaseTint: false });
    return true;
  },
  update(use) {
    const st = braiseState.get(use);
    if (!st || wornMask(use.ctx) !== 'cendre' || use.heldFor < 0.25) return;
    const ctx = use.ctx;
    if (!st.charging) {
      st.charging = true;
      use.hand.hold('charge');
      ctx.fx.tint('#ff6a1e', 0.12, 0.4);
      st.releaseTint = true;
    }
    const value = Math.min(1, (use.heldFor - 0.25) / Math.max(0.05, use.props.chargeSeconds - 0.25));
    ctx.equipment.setProgress({ label: ctx.t('mask.use.braise'), value });
    if (value >= 1 && !st.ready) {
      st.ready = true;
      ctx.audio.play('core:charge_ready');
      ctx.fx.custom('mask.embers', { strength: 0.5 });
    }
  },
  stop(use) {
    const st = braiseState.get(use);
    const ctx = use.ctx;
    ctx.equipment.setProgress(null);
    if (st?.releaseTint) ctx.fx.tint(null, 0, 0.3);
    if (!st?.ready || use.cancelled) return;
    use.hand.play('swingHeavy', 0.42);
    ctx.audio.play('mask:braise');
    ctx.fx.shake(0.22, 0.25);
    ctx.fx.flash('#ff8a3a', 0.25);
    ctx.fx.custom('mask.embers', { strength: 1 });
    const hits = ctx.combat.strike({
      damage: use.props.braiseDamage,
      reach: use.props.reach + 0.3,
      arc: 110,
      knockback: use.props.braiseKnockback,
      stagger: 1.2,
      guardBreak: true,
      tags: ['braise'],
    });
    ctx.events.emit('mask.braiseUsed', { hits: hits.length });
  },
});

export const maskEvents = [defineEvent({ id: 'mask.braiseUsed', label: 'Frappe Braise', fields: { hits: prop.integer({ label: 'Cibles touchées' }) } })];
