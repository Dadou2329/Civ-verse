import { defineAction, defineCondition, defineEvent, defineMechanic, prop, type CivContext } from '@sdk';

/**
 * Civic ranks of Viremasque — what the city *allows* (enter a district, compete, work a trade).
 * They are distinct from the masks the hero can wear (mechanics/masks.ts): a hidden Iron mask in a
 * bag never opens the Bastion's gate.
 *
 * The rank lives in the story variable `mask.rank` (0 Cendre … 4 Or). The ranks the hero *knows*
 * about grow with the story (`mask.rangsConnus`): at the start, Cendre, Fil and Fer; Verre, Or,
 * Miroir and the Masque Libre appear when the story reveals them, never before.
 */
export const CIVIC_RANKS = ['cendre', 'fil', 'fer', 'verre', 'or'] as const;
export type CivicRank = (typeof CIVIC_RANKS)[number];

/** Everything the rank plaque can show: civic ranks plus the two that are not a caste. */
export const KNOWABLE = [...CIVIC_RANKS, 'miroir', 'libre'] as const;
export type Knowable = (typeof KNOWABLE)[number];

const LABELS: Record<Knowable, string> = {
  cendre: 'Cendre (0)',
  fil: 'Fil (I)',
  fer: 'Fer (II)',
  verre: 'Verre (III)',
  or: 'Or (IV)',
  miroir: 'Miroir (hors rang)',
  libre: 'Masque Libre (hors rang)',
};

export interface RanksApi {
  readonly rank: number;
  readonly known: readonly Knowable[];
  rankId(rank?: number): CivicRank;
  /** Localized name of a rank (« Cendre »…). */
  name(id: Knowable): string;
  setRank(rank: number, opts?: { silent?: boolean }): void;
  /** The story reveals a rank: it appears on the plaque. */
  reveal(id: Knowable): void;
}

export function ranks(ctx: CivContext): RanksApi {
  return ctx.mechanics.get<RanksApi>('mask.ranks');
}

export const ranksMechanic = defineMechanic({
  id: 'mask.ranks',
  label: 'Rangs civiques',
  description: 'Rang civique du héros (autorisations de la ville), distinct des masques équipés ; rangs révélés au fil de l’histoire.',
  setup(ctx): RanksApi {
    ctx.vars.declare('mask.rank', { type: 'number', default: 0, description: 'Rang civique : 0 Cendre, 1 Fil, 2 Fer, 3 Verre, 4 Or.' });
    ctx.vars.declare('mask.rangsConnus', { type: 'json', default: ['cendre', 'fil', 'fer'], description: 'Rangs que le héros connaît (affichés sur la plaque).' });
    ctx.vars.declare('mask.plaqueVisible', { type: 'boolean', default: false, description: 'La plaque de rang s’affiche une fois le masque enfilé.' });
    const api: RanksApi = {
      get rank() {
        return Number(ctx.vars.get('mask.rank') ?? 0);
      },
      get known() {
        const v = ctx.vars.get('mask.rangsConnus');
        return (Array.isArray(v) ? v : ['cendre', 'fil', 'fer']) as Knowable[];
      },
      rankId(r = api.rank) {
        return CIVIC_RANKS[Math.max(0, Math.min(CIVIC_RANKS.length - 1, r))]!;
      },
      name: (id) => ctx.t(`mask.rang.${id}`),
      setRank(rank, opts = {}) {
        const previous = api.rank;
        if (rank === previous) return;
        ctx.vars.set('mask.rank', rank);
        const id = api.rankId(rank);
        if (!api.known.includes(id)) api.reveal(id);
        ctx.events.emit('mask.rankChanged', { rank, previous });
        if (!opts.silent && rank > previous) ctx.ui.notify(ctx.t('mask.notify.rankUp', { rank: api.name(id) }), { kind: 'success', duration: 5 });
      },
      reveal(id) {
        if (api.known.includes(id)) return;
        ctx.vars.set('mask.rangsConnus', [...api.known, id]);
        ctx.events.emit('mask.rankRevealed', { rank: id });
      },
    };
    return api;
  },
});

export const setRankAction = defineAction({
  id: 'mask.setRank',
  label: 'Définir le rang civique',
  category: 'Viremasque',
  props: {
    rank: prop.enum(
      CIVIC_RANKS.map((r, i) => ({ value: String(i), label: LABELS[r] })),
      { label: 'Rang', default: '0' },
    ),
    silent: prop.boolean({ label: 'Sans notification' }),
  },
  run: (ctx, p) => ranks(ctx).setRank(Number(p.rank), { silent: p.silent }),
  summarize: (p) => `Rang civique ${p.rank}`,
});

export const revealRankAction = defineAction({
  id: 'mask.revealRank',
  label: 'Révéler un rang sur la plaque',
  category: 'Viremasque',
  props: { rank: prop.enum(KNOWABLE.map((r) => ({ value: r, label: LABELS[r] })), { label: 'Rang', default: 'verre' }) },
  run: (ctx, p) => ranks(ctx).reveal(p.rank),
  summarize: (p) => `Révéler ${p.rank}`,
});

export const rankAtLeast = defineCondition({
  id: 'mask.rankAtLeast',
  label: 'Le héros a au moins le rang civique',
  category: 'Viremasque',
  props: { rank: prop.enum(CIVIC_RANKS.map((r, i) => ({ value: String(i), label: LABELS[r] })), { label: 'Rang minimal', default: '1' }) },
  test: (ctx, p) => ranks(ctx).rank >= Number(p.rank),
  summarize: (p) => `rang ≥ ${p.rank}`,
});

export const rankEvents = [
  defineEvent({ id: 'mask.rankChanged', label: 'Rang civique modifié', fields: { rank: prop.integer({ label: 'Nouveau rang' }), previous: prop.integer({ label: 'Rang précédent' }) } }),
  defineEvent({ id: 'mask.rankRevealed', label: 'Rang révélé sur la plaque', fields: { rank: prop.string({ label: 'Rang' }) } }),
];
