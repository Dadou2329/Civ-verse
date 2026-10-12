import { defineBehavior, prop, type InteractionOffer } from '@sdk';

/**
 * A door of Réminence that stays closed: homes of people who no longer remember who they let
 * in, the service door of the Salle de Vente. There are no ranks or permissions in this city —
 * the refusal is personal (« Personne ne répond »), never an access level.
 */
export const closedDoor = defineBehavior({
  id: 'memory.closed',
  label: 'Porte close (Réminence)',
  category: 'Mémoire',
  description: 'Empêche une porte de s’ouvrir et dit pourquoi, sans aucune notion de rang.',
  requires: ['core.door'],
  props: {
    text: prop.text({ label: 'Ce que l’on entend ou constate', default: 'memory.lock.private' }),
    detail: prop.text({ label: 'Détail sous l’invite', default: 'memory.lock.detail' }),
    openWhen: prop.condition({ label: 'S’ouvre quand (vide = jamais)' }),
  },
  create(ctx) {
    const opens = () => !!ctx.props.openWhen && ctx.logic.test(ctx.props.openWhen, { self: ctx.entity.id });
    return {
      decorateOffer(offer: InteractionOffer, source: string): InteractionOffer {
        if (source !== 'core.door' || offer.id !== 'open' || opens()) return offer;
        return { ...offer, detail: ctx.t(ctx.props.detail), tone: 'locked' };
      },
      beforeInteract(attempt) {
        if (attempt.source !== 'core.door' || attempt.offer.id !== 'open' || opens()) return null;
        return { reason: ctx.t(ctx.props.text), sound: 'core:door_locked' };
      },
    };
  },
});
