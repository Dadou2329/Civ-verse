import { defineAction, defineBehavior, defineBlock, defineCondition, defineEvent, defineMechanic, prop, type CivContext } from '@sdk';

/**
 * « La lanterne » — a mechanic the engine has never had: a light source that burns oil over
 * time, that the player switches on and off with a key, and without which some doors stay shut.
 *
 * Written exactly like a pack mechanic (it only imports '@sdk'); the acceptance test G loads it
 * in a fixture pack to show that a new mechanic needs no change in the engine.
 */
export interface LanternApi {
  readonly lit: boolean;
  readonly oil: number;
  light(): boolean;
  extinguish(): void;
  refill(amount: number): void;
}

export function lantern(ctx: CivContext): LanternApi {
  return ctx.mechanics.get<LanternApi>('lanterne.oil');
}

interface LanternState {
  oil: number;
  lit: boolean;
}

export const lanternMechanic = defineMechanic({
  id: 'lanterne.oil',
  label: 'Lanterne à huile',
  description: 'Une lanterne qui brûle de l’huile ; certaines portes ne s’ouvrent qu’à sa lumière.',
  state: {
    version: 2,
    initial: (): LanternState => ({ oil: 30, lit: false }),
    // Version 1 stored the fuel in litres under another name: 1 litre = 10 units of oil.
    migrate: { 1: (old) => ({ oil: Number((old as { fuel?: number }).fuel ?? 0) * 10, lit: false }) },
  },
  settings: {
    burnPerSecond: prop.number({ label: 'Huile brûlée par seconde', default: 1, min: 0 }),
    key: prop.string({ label: 'Touche', default: 'KeyL' }),
  },
  setup(ctx, state: LanternState, settings): LanternApi {
    ctx.vars.declare('lanterne.lit', { type: 'boolean', default: false, description: 'Vrai quand la lanterne est allumée.' });
    const api: LanternApi = {
      get lit() {
        return state.lit;
      },
      get oil() {
        return state.oil;
      },
      light() {
        if (state.oil <= 0) {
          ctx.ui.notify(ctx.t('lanterne.empty'), { kind: 'warning' });
          return false;
        }
        state.lit = true;
        ctx.vars.set('lanterne.lit', true);
        return true;
      },
      extinguish() {
        if (!state.lit) return;
        state.lit = false;
        ctx.vars.set('lanterne.lit', false);
        ctx.events.emit('lanterne.extinguished', { oil: state.oil });
      },
      refill(amount) {
        state.oil = Math.min(100, state.oil + amount);
      },
    };
    ctx.time.every(1, () => {
      if (!state.lit) return;
      state.oil = Math.max(0, state.oil - settings.burnPerSecond);
      if (state.oil === 0) api.extinguish();
    });
    ctx.input.bind('lanterne.toggle', { key: settings.key, label: 'lanterne.input.toggle' });
    ctx.input.onPressed('lanterne.toggle', () => (state.lit ? api.extinguish() : void api.light()));
    return api;
  },
});

export const needsLight = defineBehavior({
  id: 'lanterne.needsLight',
  label: 'Ne s’ouvre qu’à la lumière',
  category: 'Lanterne',
  requires: ['core.door'],
  props: {},
  create(ctx) {
    return {
      beforeInteract: (attempt) => (attempt.offer.id === 'open' && !lantern(ctx).lit ? { reason: ctx.t('lanterne.tooDark') } : null),
    };
  },
});

export const refill = defineAction({
  id: 'lanterne.refill',
  label: 'Remplir la lanterne',
  category: 'Lanterne',
  props: { amount: prop.number({ label: 'Quantité d’huile', default: 50, min: 0 }) },
  run: (ctx, p) => lantern(ctx).refill(p.amount),
  summarize: (p) => `Remplir la lanterne (+${p.amount})`,
});

export const isLit = defineCondition({
  id: 'lanterne.isLit',
  label: 'La lanterne est allumée',
  category: 'Lanterne',
  props: {},
  test: (ctx) => lantern(ctx).lit,
});

export const extinguished = defineEvent({
  id: 'lanterne.extinguished',
  label: 'Lanterne éteinte',
  fields: { oil: prop.number({ label: 'Huile restante' }) },
});

export const blocks = [
  defineBlock({ id: 'lanterne:dalle', label: 'Dalle de crypte', textures: { all: { gen: 'stone', colors: ['#6e6a66'] } } }),
  defineBlock({ id: 'lanterne:mur', label: 'Mur de crypte', textures: { all: { gen: 'bricks', colors: ['#4a4440'] } } }),
];
