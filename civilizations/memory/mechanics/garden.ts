import { defineBehavior, defineEvent, defineMechanic, prop, type CivContext } from '@sdk';
import { chamber } from './chamber';

/**
 * The Garden of Names puzzle: three childhood objects placed on three pedestals in the order of
 * the echo (kite, chipped cup, little bell). The echo can be replayed at the stele, so the
 * answer is read, not guessed. A wrong order gives the objects back; the right one frees the
 * second shard.
 */
export interface OfferingApi {
  /** Objects the player can place (held childhood objects). */
  held(): string[];
  place(pedestalId: string, itemId: string): void;
  take(pedestalId: string): void;
  placed(pedestalId: string): string | null;
  readonly solved: boolean;
}

export function offering(ctx: CivContext): OfferingApi {
  return ctx.mechanics.get<OfferingApi>('memory.offering');
}

export const offeringMechanic = defineMechanic({
  id: 'memory.offering',
  label: 'Énigme des trois objets',
  description: 'Trois socles, trois objets d’enfance à déposer dans l’ordre de l’écho.',
  dependsOn: ['memory.chamber'],
  state: { version: 1, initial: () => ({ placed: {} as Record<string, string>, solved: false, attempts: 0 }) },
  settings: {
    pedestals: prop.list(prop.entity({ label: 'Socle', withComponent: 'memory.pedestal' }), { label: 'Socles (dans l’ordre)' }),
    solution: prop.list(prop.item({ label: 'Objet' }), { label: 'Ordre attendu' }),
    reward: prop.string({ label: 'Éclat obtenu' }),
  },
  setup(ctx, state, settings): OfferingApi {
    const check = () => {
      const pedestals = settings.pedestals;
      if (state.solved || pedestals.some((p) => !state.placed[p])) return;
      state.attempts++;
      const ok = pedestals.every((p, i) => state.placed[p] === settings.solution[i]);
      if (ok) {
        state.solved = true;
        ctx.audio.play('memory:puzzle_ok');
        ctx.fx.flash('#e8d8ff', 0.6);
        ctx.vars.set('memory.gardenSolved', true);
        ctx.events.emit('memory.puzzleSolved', { attempts: state.attempts });
        if (settings.reward) chamber(ctx).give(settings.reward);
      } else {
        ctx.audio.play('memory:puzzle_wrong');
        ctx.ui.notify(ctx.t('memory.notify.puzzleWrong'), { kind: 'info', duration: 5 });
        ctx.events.emit('memory.puzzleFailed', { attempts: state.attempts });
        ctx.time.after(1.2, () => {
          for (const p of pedestals) api.take(p);
        });
      }
    };
    const api: OfferingApi = {
      held: () => settings.solution.filter((id) => ctx.inventory.has(id)),
      placed: (p) => state.placed[p] ?? null,
      get solved() {
        return state.solved;
      },
      place(pedestalId, itemId) {
        if (state.solved || state.placed[pedestalId] || !ctx.inventory.has(itemId)) return;
        ctx.inventory.remove(itemId, 1, { silent: true });
        state.placed[pedestalId] = itemId;
        ctx.audio.play('memory:place', { at: pedestalId });
        ctx.events.emit('memory.objectPlaced', { pedestalId, itemId });
        check();
      },
      take(pedestalId) {
        const item = state.placed[pedestalId];
        if (!item || state.solved) return;
        delete state.placed[pedestalId];
        ctx.inventory.add(item, 1, { silent: true });
        ctx.events.emit('memory.objectTaken', { pedestalId, itemId: item });
      },
    };
    return api;
  },
});

/** A pedestal: shows the placed object, offers « Déposer » (panel) and « Reprendre ». */
export const pedestal = defineBehavior({
  id: 'memory.pedestal',
  label: 'Socle de l’énigme',
  category: 'Mémoire',
  props: {
    models: prop.object(
      {
        empty: prop.model({ label: 'Vide', default: 'memory:pedestal' }),
        kite: prop.model({ label: 'Cerf-volant', default: 'memory:pedestal_kite' }),
        cup: prop.model({ label: 'Tasse', default: 'memory:pedestal_cup' }),
        bell: prop.model({ label: 'Clochette', default: 'memory:pedestal_bell' }),
      },
      { label: 'Modèles' },
    ),
  },
  create(ctx) {
    ctx.entity.setCollider('socle', { minX: -0.35, minY: 0, minZ: -0.35, maxX: 0.35, maxY: 1.2, maxZ: 0.35 }, { solid: true, pickable: true });
    const modelFor = (item: string | null) => {
      const m = ctx.props.models;
      if (item === 'memory:cerf_volant') return m.kite;
      if (item === 'memory:tasse') return m.cup;
      if (item === 'memory:clochette') return m.bell;
      return m.empty;
    };
    const sync = () => {
      const want = modelFor(offering(ctx).placed(ctx.entity.id));
      if (ctx.entity.has('core.model') && ctx.entity.props<{ model?: string }>('core.model').model !== want) ctx.entity.setProp('core.model', 'model', want);
    };
    sync();
    ctx.events.on('memory.objectPlaced', sync);
    ctx.events.on('memory.objectTaken', sync);
    return {
      interaction: () => {
        const o = offering(ctx);
        if (o.solved) return null;
        const item = o.placed(ctx.entity.id);
        if (item) return { id: 'take', label: ctx.t('memory.prompt.takeBack', { name: ctx.inventory.nameOf(item) }), key: 'secondary' };
        const held = o.held();
        return held.length
          ? { id: 'place', label: ctx.t('memory.prompt.place'), tone: 'special' }
          : { id: 'place', label: ctx.t('memory.prompt.place'), enabled: false, detail: ctx.t('memory.prompt.placeNothing') };
      },
      onInteract: async (attempt) => {
        const o = offering(ctx);
        if (attempt.offer.id === 'take') return o.take(ctx.entity.id);
        const held = o.held();
        if (held.length === 1) return o.place(ctx.entity.id, held[0]!);
        const choice = await ctx.ui.openPanel<{ item?: string }>('memory.offering', { pedestal: ctx.entity.id, items: held });
        if (choice?.item) o.place(ctx.entity.id, choice.item);
      },
    };
  },
});

export const gardenEvents = [
  defineEvent({ id: 'memory.puzzleSolved', label: 'Énigme des trois objets résolue', fields: { attempts: prop.integer({ label: 'Essais' }) } }),
  defineEvent({ id: 'memory.puzzleFailed', label: 'Mauvais ordre des objets', fields: { attempts: prop.integer({ label: 'Essais' }) } }),
  defineEvent({ id: 'memory.objectPlaced', label: 'Objet déposé', fields: { pedestalId: prop.entity({ label: 'Socle' }), itemId: prop.item({ label: 'Objet' }) } }),
  defineEvent({ id: 'memory.objectTaken', label: 'Objet repris', fields: { pedestalId: prop.entity({ label: 'Socle' }), itemId: prop.item({ label: 'Objet' }) } }),
];
