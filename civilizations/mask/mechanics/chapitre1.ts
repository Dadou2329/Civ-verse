import { defineAction, defineBehavior, defineEvent, defineMechanic, prop } from '@sdk';

/**
 * Chapitre I « Courir plus haut » : les preuves du dossier de candidature, l'averse de la
 * passerelle des lavandières et les événements structurants du scénario (§12).
 */
export const PROOFS = ['precision', 'courage', 'entraide'] as const;
export type Proof = (typeof PROOFS)[number];

/** The counters of the chapter, declared so that they start at 0 (and are documented in the Studio). */
export const chapitre1Mechanic = defineMechanic({
  id: 'mask.chapitre1',
  label: 'Chapitre I — compteurs',
  description: 'Déclare les compteurs du chapitre I : preuves signées, ancrages fixés, cagettes posées, essais manqués.',
  setup(ctx) {
    ctx.vars.declare('mask.preuves', { type: 'number', default: 0, description: 'Preuves du dossier signées (0 à 3).' });
    ctx.vars.declare('mask.ancrages', { type: 'number', default: 0, description: 'Ancrages de la passerelle des lavandières fixés (0 à 3).' });
    ctx.vars.declare('mask.cagettesPosees', { type: 'number', default: 0, description: 'Cagettes posées au coin de la fontaine (0 à 3).' });
    ctx.vars.declare('mask.parcoursEchecs', { type: 'number', default: 0, description: 'Essais manqués du parcours de qualification.' });
  },
});

export const chapitre1Events = [
  defineEvent({
    id: 'mask.ch1.preuve',
    label: 'Chapitre I — preuve validée',
    fields: { preuve: prop.string({ label: 'Preuve (precision, courage, entraide)' }), count: prop.integer({ label: 'Preuves validées' }) },
  }),
  defineEvent({ id: 'mask.ch1.proofs_complete', label: 'Chapitre I — trois preuves validées', description: 'Ouvre la qualification.', fields: {} }),
  defineEvent({
    id: 'mask.ch1.second_mask_reacted',
    label: 'Chapitre I — le masque de Fil fendu a réagi',
    description: 'Indice narratif secret : un second masque a répondu à la trame du héros, sans lui donner de pouvoir.',
    fields: {},
  }),
  defineEvent({ id: 'mask.ch1.qualifying_passed', label: 'Chapitre I — qualification réussie', description: 'Inscription aux Épreuves ; accès aux Toits du Fil.', fields: {} }),
];

/**
 * Validates a proof of the application file: its flag, the count of validated proofs, the
 * stamped notification. Validating the same proof twice changes nothing.
 */
export const validerPreuve = defineAction({
  id: 'mask.validerPreuve',
  label: 'Valider une preuve du dossier',
  category: 'Viremasque',
  description: 'Coche une preuve (précision, courage, entraide), met à jour le compte mask.preuves et l’annonce.',
  props: {
    preuve: prop.enum(
      [
        { value: 'precision', label: 'Précision' },
        { value: 'courage', label: 'Courage' },
        { value: 'entraide', label: 'Entraide' },
      ],
      { label: 'Preuve', default: 'precision' },
    ),
  },
  run(ctx, p) {
    const flag = `mask.preuve.${p.preuve}`;
    if (ctx.vars.get(flag) === true) return;
    ctx.vars.set(flag, true);
    const count = PROOFS.filter((id) => ctx.vars.get(`mask.preuve.${id}`) === true).length;
    ctx.vars.set('mask.preuves', count);
    ctx.audio.play('mask:tampon');
    ctx.ui.notify(ctx.t('mask.notify.preuve', { name: ctx.t(`mask.preuve.${p.preuve}`), value: count }), { kind: 'quest', icon: 'mask:dossier', duration: 4.5 });
    ctx.events.emit('mask.ch1.preuve', { preuve: p.preuve, count });
  },
});

/** Opens the application file: the validations already signed, and by whom. */
export const lireDossier = defineAction({
  id: 'mask.lireDossier',
  label: 'Lire le dossier de candidature',
  category: 'Viremasque',
  description: 'Affiche le dossier avec les validations déjà signées (et par qui).',
  props: {},
  async run(ctx) {
    const signed = (id: Proof) => ctx.vars.get(`mask.preuve.${id}`) === true;
    const proof = (id: Proof) => {
      if (!signed(id)) return ctx.t(`mask.doc.dossier.${id}.vide`);
      if (id !== 'entraide') return ctx.t(`mask.doc.dossier.${id}.ok`);
      // The witness of the shared corner is whoever agreed to the hero's solution.
      return ctx.t(ctx.vars.get('mask.entraideChoix') === 'repartition' ? 'mask.doc.dossier.entraide.ok.mireille' : 'mask.doc.dossier.entraide.ok.octave');
    };
    const qualified = ctx.vars.get('mask.kaelSigne') === true;
    await ctx.ui.showDocument({
      title: ctx.t('mask.doc.dossier.title'),
      body: [ctx.t('mask.doc.dossier.1'), ctx.t('mask.doc.dossier.2'), ...PROOFS.map(proof), ctx.t(qualified ? 'mask.doc.dossier.qualif.ok' : 'mask.doc.dossier.qualif.vide')],
      style: 'register',
    });
  },
});

/**
 * Averse : tant que sa condition tient, il pleut sur la zone de l'entité (particules de la vue),
 * le ciel s'assombrit (`env`), la pluie crépite et un coup de tonnerre l'annonce. Quand elle
 * cesse, le ciel revient à `envAfter`. Rechargée en pleine averse, elle reprend telle quelle.
 */
export const averseBehavior = defineBehavior({
  id: 'mask.averse',
  label: 'Averse',
  category: 'Viremasque',
  description: 'Pluie sur une zone tant que la condition tient : ciel assombri, crépitement, coup de tonnerre au début.',
  props: {
    condition: prop.condition({ label: 'Pleut si' }),
    size: prop.vec3({ label: 'Zone de pluie (m)', default: [12, 8, 12] }),
    env: prop.json({ label: 'Environnement pendant l’averse' }),
    envAfter: prop.json({ label: 'Environnement après l’averse' }),
    fade: prop.number({ label: 'Transition (s)', default: 2.5, min: 0, max: 20 }),
  },
  state: { version: 1, initial: () => ({ raining: false }) },
  create(ctx) {
    let sound: { stop(): void } | null = null;
    const apply = (raining: boolean, seconds: number, announce: boolean) => {
      ctx.entity.setViewFlag('averse', raining || null);
      sound?.stop();
      sound = null;
      if (raining) {
        sound = ctx.audio.play('mask:pluie', { at: ctx.entity.id, loop: true, volume: 0.9 });
        if (announce) {
          ctx.audio.play('mask:tonnerre');
          ctx.fx.flash('#dfe8ff', 0.25);
        }
      }
      const env = raining ? ctx.props.env : ctx.props.envAfter;
      if (env && typeof env === 'object' && !Array.isArray(env)) ctx.fx.environment(env as Record<string, unknown>, seconds);
    };
    if (ctx.state.raining) apply(true, 0, false);
    return {
      update() {
        const now = ctx.logic.test(ctx.props.condition, { self: ctx.entity.id, origin: `averse ${ctx.entity.id}` });
        if (now === ctx.state.raining) return;
        ctx.state.raining = now;
        ctx.events.emit(now ? 'mask.averse.started' : 'mask.averse.stopped', { entityId: ctx.entity.id });
        apply(now, ctx.props.fade, now);
      },
      dispose() {
        sound?.stop();
        sound = null;
      },
    };
  },
});

export const averseEvents = [
  defineEvent({ id: 'mask.averse.started', label: 'Une averse commence', fields: { entityId: prop.entity({ label: 'Averse', withComponent: 'mask.averse' }) } }),
  defineEvent({ id: 'mask.averse.stopped', label: 'Une averse cesse', fields: { entityId: prop.entity({ label: 'Averse', withComponent: 'mask.averse' }) } }),
];
