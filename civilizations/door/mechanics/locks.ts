import { defineBehavior, prop, type BehaviorContext, type InteractionOffer } from '@sdk';
import { access } from './access';

/**
 * LockVariants — one component, several kinds of locks, the same interaction for the player.
 *
 * Attach `door.lock` next to a `core.door`: it decorates the door prompt (what the lock checks)
 * and vetoes the opening when its rule fails, with a refusal that says why.
 *
 *  rank        the threshold plaque must show at least `rank`               (« Rang 1 requis »)
 *  item        a physical key or object must be carried (optionally consumed)
 *  condition   a story condition must hold (secret known, permission granted…)
 *  sealed      never opens (private houses, closed shops) — says why
 *  palm        recognizes the protagonist's palm mark (the cell that was never built)
 *  impossible  refuses every classic check, yet reacts to the protagonist (the absent door)
 */
type Variant = 'rank' | 'item' | 'condition' | 'sealed' | 'palm' | 'impossible';

const lockProps = {
  variant: prop.enum(
    [
      { value: 'rank', label: 'Serrure de rang' },
      { value: 'item', label: 'Serrure à objet' },
      { value: 'condition', label: 'Serrure à condition narrative' },
      { value: 'sealed', label: 'Porte close (privée)' },
      { value: 'palm', label: 'Serrure à empreinte de paume' },
      { value: 'impossible', label: 'Serrure impossible' },
    ] as const,
    { label: 'Type de serrure', default: 'rank' },
  ),
  rank: prop.integer({ label: 'Rang requis', default: 1, min: 0, max: 2, group: 'Rang' }),
  item: prop.item({ label: 'Objet requis', group: 'Objet' }),
  consumeItem: prop.boolean({ label: 'L’objet est consommé', group: 'Objet' }),
  condition: prop.condition({ label: 'Condition', group: 'Condition' }),
  deniedText: prop.text({ label: 'Texte du refus' }),
  onUnlock: prop.actions({ label: 'Actions à la première ouverture' }),
};

interface LockState {
  unlocked: boolean;
  refusals: number;
}

export const lockBehavior = defineBehavior({
  id: 'door.lock',
  label: 'Serrure de Verrou',
  category: 'Verrou',
  description: 'Variantes de serrures (rang, objet, condition, close, paume, impossible) sur une porte.',
  requires: ['core.door'],
  props: lockProps,
  state: { version: 1, initial: (): LockState => ({ unlocked: false, refusals: 0 }) },
  create(ctx) {
    const variant = () => ctx.props.variant as Variant;
    const itemName = () => (ctx.props.item ? ctx.inventory.nameOf(ctx.props.item) : '');
    const passes = (): boolean => {
      switch (variant()) {
        case 'rank':
          return access(ctx).canPass(ctx.props.rank);
        case 'item':
          return ctx.state.unlocked || (!!ctx.props.item && ctx.inventory.has(ctx.props.item));
        case 'condition':
          return ctx.state.unlocked || ctx.logic.test(ctx.props.condition, { self: ctx.entity.id });
        case 'palm':
          return true;
        default:
          return false;
      }
    };
    const refusal = (): string => {
      const custom = ctx.props.deniedText ? ctx.t(ctx.props.deniedText) : '';
      switch (variant()) {
        case 'rank': {
          const a = access(ctx);
          return a.rank < 0 ? ctx.t('door.lock.noPlaque') : ctx.t('door.lock.rankDenied', { rank: ctx.props.rank, name: a.rankName(ctx.props.rank) });
        }
        case 'item':
          return custom || ctx.t('door.lock.needItem', { item: itemName() });
        case 'condition':
          return custom || ctx.t('door.lock.condition');
        case 'sealed':
          return custom || ctx.t('door.lock.private');
        case 'impossible':
          return custom || ctx.t('door.lock.impossible');
        default:
          return custom;
      }
    };
    return {
      decorateOffer(offer: InteractionOffer, source: string): InteractionOffer {
        if (source !== 'core.door' || offer.id !== 'open') return offer;
        switch (variant()) {
          case 'rank': {
            const ok = passes();
            return {
              ...offer,
              detail: ok ? ctx.t('door.lock.rankOk', { rank: ctx.props.rank }) : ctx.t('door.lock.rankRequired', { rank: ctx.props.rank }),
              tone: ok ? offer.tone : 'locked',
            };
          }
          case 'item':
            return passes() ? { ...offer, detail: ctx.state.unlocked ? undefined : ctx.t('door.lock.usesItem', { item: itemName() }) } : { ...offer, detail: ctx.t('door.lock.needItem', { item: itemName() }), tone: 'locked' };
          case 'condition':
            return passes() ? offer : { ...offer, detail: refusal(), tone: 'locked' };
          case 'sealed':
            return { ...offer, detail: ctx.t('door.lock.closed'), tone: 'locked' };
          case 'palm':
            return { ...offer, label: ctx.t('door.prompt.touchPanel'), detail: ctx.state.unlocked ? undefined : ctx.t('door.lock.noHandle'), tone: 'special' };
          case 'impossible':
            return { ...offer, detail: ctx.t('door.lock.impossibleDetail'), tone: 'special' };
        }
        return offer;
      },
      beforeInteract(attempt) {
        if (attempt.source !== 'core.door' || attempt.offer.id !== 'open') return null;
        if (passes()) {
          if (!ctx.state.unlocked) {
            ctx.state.unlocked = true;
            if (variant() === 'item' && ctx.props.consumeItem && ctx.props.item) ctx.inventory.remove(ctx.props.item, 1);
            if (variant() === 'palm') awakenPalm(ctx);
            void ctx.logic.run(ctx.props.onUnlock, { self: ctx.entity.id, origin: `serrure ${ctx.entity.id}` });
          }
          return null;
        }
        ctx.state.refusals++;
        if (variant() === 'rank') access(ctx).deny(ctx.entity.id, ctx.props.rank);
        if (variant() === 'impossible') {
          // The absent door refuses every check, and still answers the protagonist.
          ctx.audio.play('door:voice', { at: ctx.entity.id, volume: 0.6 });
          ctx.fx.flash('#ffe2a8', 0.4);
        }
        return {
          reason: refusal(),
          sound: variant() === 'rank' ? 'door:access_denied' : variant() === 'impossible' ? undefined : 'core:door_locked',
          data: { variant: variant(), required: ctx.props.rank, refusals: ctx.state.refusals },
        };
      },
    };
  },
});

/** The mark on the palm answers the door: light, sound, and the door remembers. */
function awakenPalm(ctx: BehaviorContext<{ variant: string }, LockState>): void {
  ctx.audio.play('door:palm_awaken', { at: ctx.entity.id });
  ctx.fx.flash('#ffd889', 0.7);
  ctx.ui.notify(ctx.t('door.notify.palm'), { kind: 'memory', duration: 5 });
  if (ctx.entity.has('core.door')) {
    const model = ctx.entity.props<{ model?: string }>('core.door').model;
    if (model === 'door:door_handleless') ctx.entity.setProp('core.door', 'model', 'door:door_handleless_lit');
  }
  if (!ctx.vars.get('door.palmRevealed')) ctx.vars.set('door.palmRevealed', true);
  ctx.events.emit('door.palmAwakened', { entityId: ctx.entity.id });
}
