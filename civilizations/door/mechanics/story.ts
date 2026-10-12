import { defineAction, defineBehavior, defineEvent, prop } from '@sdk';

/**
 * Story helpers of Act II (Elias's trail) and small world behaviors.
 *
 * Evidence is tracked per piece (`door.evidence.<id>`) and counted in `door.evidenceCount`, the
 * variable Eda checks before granting the temporary rank 2. Both pieces persist in saves like
 * every variable.
 */
export const EVIDENCE = ['ordre', 'plaque'] as const;

export const addEvidence = defineAction({
  id: 'door.addEvidence',
  label: 'Recueillir une preuve (piste d’Elias)',
  category: 'Verrou',
  props: { evidence: prop.enum(['ordre', 'plaque'] as const, { label: 'Preuve', default: 'ordre' }) },
  run(ctx, p) {
    const key = `door.evidence.${p.evidence}`;
    if (ctx.vars.get(key) === true) return;
    ctx.vars.set(key, true);
    const count = EVIDENCE.filter((e) => ctx.vars.get(`door.evidence.${e}`) === true).length;
    ctx.vars.set('door.evidenceCount', count);
    ctx.ui.notify(ctx.t('door.notify.evidence', { count, total: EVIDENCE.length }), { kind: 'discovery', duration: 4.5 });
    ctx.events.emit('door.evidenceFound', { evidence: p.evidence, count });
  },
  summarize: (p) => `Preuve : ${p.evidence}`,
});

export const foundPoster = defineAction({
  id: 'door.foundPoster',
  label: 'Découvrir l’affiche d’Elias',
  category: 'Verrou',
  props: {},
  run(ctx) {
    if (ctx.vars.get('door.foundEliasPoster') === true) return;
    ctx.vars.set('door.foundEliasPoster', true);
    ctx.ui.notify(ctx.t('door.notify.newLead'), { kind: 'discovery' });
    if (ctx.quests.status('DOOR_Q02_ELIAS') === 'inactive') ctx.quests.start('DOOR_Q02_ELIAS');
  },
});

export const storyEvents = [
  defineEvent({ id: 'door.evidenceFound', label: 'Preuve recueillie', fields: { evidence: prop.string({ label: 'Preuve' }), count: prop.integer({ label: 'Total' }) } }),
  defineEvent({ id: 'door.palmAwakened', label: 'La marque de la paume s’éveille', fields: { entityId: prop.entity({ label: 'Porte' }) } }),
];

/** A sound repeated at intervals while a condition holds (coughing behind a door, a bell...). */
export const ambientLoop = defineBehavior({
  id: 'door.ambientLoop',
  label: 'Son répété',
  category: 'Audio',
  description: 'Rejoue un son à intervalle régulier quand le joueur est proche et que la condition est vraie.',
  props: {
    sound: prop.sound({ label: 'Son' }),
    every: prop.number({ label: 'Intervalle (s)', default: 10, min: 1, max: 120 }),
    radius: prop.number({ label: 'Distance d’écoute (m)', default: 16, min: 1, max: 60 }),
    condition: prop.condition({ label: 'Actif si' }),
  },
  create(ctx) {
    let t = ctx.props.every * 0.5;
    return {
      update(dt) {
        t -= dt;
        if (t > 0) return;
        t = ctx.props.every * (0.8 + Math.random() * 0.4);
        if (!ctx.props.sound || ctx.entity.distanceToPlayer() > ctx.props.radius) return;
        if (!ctx.logic.test(ctx.props.condition, { self: ctx.entity.id })) return;
        ctx.audio.play(ctx.props.sound, { at: ctx.entity.id });
      },
    };
  },
});
