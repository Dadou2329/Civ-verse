import { defineAction, defineCondition, defineEvent, defineMechanic, prop, type CivContext } from '@sdk';

/**
 * AccessRegistry — the social rule of Verrou.
 *
 * Every inhabitant carries a threshold plaque; every rank lock checks it. The rank is not a
 * statistic of strength but an authorization: -1 « sans plaque », 0 Sans-Seuil, 1 Porteur,
 * 2 Gardien (granted only temporarily to the protagonist, for the Archives).
 *
 * The rank lives in the story variable `door.rank` so that dialogues, quests and conditions can
 * read it like any other variable; this mechanic owns the rules around it (names, refusals,
 * notifications, the permission map key).
 */
export interface AccessApi {
  readonly rank: number;
  readonly temporary: boolean;
  /** Localized rank name ("Sans-Seuil"...). */
  rankName(rank?: number): string;
  canPass(required: number): boolean;
  setRank(rank: number, opts?: { temporary?: boolean; silent?: boolean }): void;
  /** Records a refusal by a rank lock (refusal stamp, sound, event for guards). */
  deny(entityId: string, required: number): void;
}

export const RANKS = [
  { rank: 0, name: 'door.rank.0', zones: ['door.permission.court', 'door.permission.workshops', 'door.permission.well'] },
  { rank: 1, name: 'door.rank.1', zones: ['door.permission.gallery', 'door.permission.registry', 'door.permission.care'] },
  { rank: 2, name: 'door.rank.2', zones: ['door.permission.archives', 'door.permission.towers'] },
] as const;

export function access(ctx: CivContext): AccessApi {
  return ctx.mechanics.get<AccessApi>('door.access');
}

export const accessMechanic = defineMechanic({
  id: 'door.access',
  label: 'Registre des accès',
  description: 'Rang du joueur vérifié par chaque serrure de rang, refus contextualisés et carte des permissions.',
  state: { version: 1, initial: () => ({ denials: 0 }) },
  settings: {
    permissionsKey: prop.string({ label: 'Touche de la carte des permissions', default: 'KeyR' }),
  },
  setup(ctx, state, settings): AccessApi {
    ctx.vars.declare('door.rank', { type: 'number', default: -1, description: 'Rang : -1 sans plaque, 0 Sans-Seuil, 1 Porteur, 2 Gardien.' });
    ctx.vars.declare('door.rankTemporary', { type: 'boolean', default: false, description: 'Vrai quand le rang actuel est un accès temporaire.' });
    const api: AccessApi = {
      get rank() {
        return Number(ctx.vars.get('door.rank') ?? -1);
      },
      get temporary() {
        return ctx.vars.get('door.rankTemporary') === true;
      },
      rankName(r = api.rank) {
        return ctx.t(r < 0 ? 'door.rank.none' : `door.rank.${Math.min(2, r)}`);
      },
      canPass(required) {
        return api.rank >= required;
      },
      setRank(rank, opts = {}) {
        const previous = api.rank;
        const temporary = !!opts.temporary;
        if (rank === previous && temporary === api.temporary) return;
        ctx.vars.set('door.rank', rank);
        ctx.vars.set('door.rankTemporary', temporary);
        ctx.events.emit('door.rankChanged', { rank, previous, temporary });
        ctx.ui.store.set('door.rankFlash', (ctx.ui.store.get<number>('door.rankFlash') ?? 0) + 1);
        if (!opts.silent && rank > previous) {
          ctx.audio.play('door:rank_up');
          ctx.ui.notify(ctx.t(temporary ? 'door.notify.rankTemporary' : 'door.notify.rankUp', { rank: api.rankName(rank) }), { kind: 'success', duration: 5 });
        }
      },
      deny(entityId, required) {
        state.denials++;
        ctx.ui.store.set('door.denied', { n: state.denials, required, rank: api.rank });
        ctx.events.emit('door.accessDenied', { entityId, required, rank: api.rank });
      },
    };
    ctx.input.bind('door.permissions', { key: settings.permissionsKey, label: 'door.input.permissions' });
    ctx.input.onPressed('door.permissions', () => {
      if (api.rank >= 0 && !ctx.ui.isPanelOpen('door.permissions')) void ctx.ui.openPanel('door.permissions');
    });
    return api;
  },
});

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

export const rankAtLeast = defineCondition({
  id: 'door.rankAtLeast',
  label: 'Le joueur a au moins le rang',
  category: 'Verrou',
  props: { rank: prop.integer({ label: 'Rang minimal', default: 1, min: -1, max: 2 }) },
  test: (ctx, p) => access(ctx).rank >= p.rank,
  summarize: (p) => `rang ≥ ${p.rank}`,
});

export const accessEvents = [
  defineEvent({
    id: 'door.rankChanged',
    label: 'Rang modifié',
    fields: { rank: prop.integer({ label: 'Nouveau rang' }), previous: prop.integer({ label: 'Rang précédent' }), temporary: prop.boolean({ label: 'Temporaire' }) },
  }),
  defineEvent({
    id: 'door.accessDenied',
    label: 'Accès refusé par une serrure de rang',
    fields: { entityId: prop.entity({ label: 'Porte' }), required: prop.integer({ label: 'Rang requis' }) },
  }),
];
