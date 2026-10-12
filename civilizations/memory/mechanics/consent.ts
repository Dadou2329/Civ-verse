import { defineAction, defineCondition, defineEvent, prop } from '@sdk';
import { chamber } from './chamber';

/**
 * ConsentCheck and MemoryTrade.
 *
 * Restoring a memory into someone is only possible after that person accepted it: the consent
 * is a story variable set by the person's own dialogue choice ('accepte' / 'refuse'). A refusal
 * is respected — the action does nothing but say so.
 *
 * A trade gives a memory away (state « cédé ») in exchange for something; what the memory used
 * to show disappears with it (e.g. the amber footprints of the path).
 */
export const consented = defineCondition({
  id: 'memory.consented',
  label: 'La personne a consenti à la restauration',
  category: 'Mémoire',
  props: { consent: prop.variable({ label: 'Variable du consentement' }) },
  test: (ctx, p) => ctx.vars.get(p.consent) === 'accepte',
  summarize: (p) => `${p.consent} = accepte`,
});

export const restore = defineAction({
  id: 'memory.restore',
  label: 'Restaurer un souvenir chez quelqu’un (avec son consentement)',
  category: 'Mémoire',
  props: {
    shard: prop.string({ label: 'Éclat' }),
    to: prop.entity({ label: 'Personne' }),
    consent: prop.variable({ label: 'Variable du consentement' }),
    refused: prop.text({ label: 'Message si pas de consentement', default: 'memory.notify.noConsent' }),
  },
  run(ctx, p) {
    const decision = ctx.vars.get(p.consent);
    if (decision !== 'accepte') {
      ctx.ui.notify(ctx.t(p.refused), { kind: 'denied', duration: 5 });
      ctx.events.emit('memory.restorationRefused', { shardId: p.shard, to: p.to, decision: String(decision ?? 'sans réponse') });
      return;
    }
    chamber(ctx).restore(p.shard, p.to);
    ctx.audio.play('memory:echo', { at: p.to || undefined });
    ctx.fx.flash('#e8d8ff', 0.8);
    ctx.ui.notify(ctx.t('memory.notify.restored'), { kind: 'memory', duration: 5 });
  },
});

export const trade = defineAction({
  id: 'memory.trade',
  label: 'Céder un souvenir en échange de quelque chose',
  category: 'Mémoire',
  props: {
    shard: prop.string({ label: 'Éclat cédé' }),
    to: prop.text({ label: 'À qui (nom affiché)' }),
    then: prop.actions({ label: 'Ce que l’on obtient' }),
  },
  async run(ctx, p, scope) {
    if (chamber(ctx).state(p.shard) !== 'possede') {
      ctx.ui.notify(ctx.t('memory.notify.nothingToTrade'), { kind: 'denied' });
      return;
    }
    ctx.audio.play('memory:machine');
    chamber(ctx).cede(p.shard, p.to ? ctx.t(p.to) : '');
    await ctx.logic.run(p.then, scope);
  },
});

export const consentEvents = [
  defineEvent({
    id: 'memory.restorationRefused',
    label: 'Restauration refusée (pas de consentement)',
    fields: { shardId: prop.string({ label: 'Éclat' }), to: prop.entity({ label: 'Personne' }) },
  }),
];
