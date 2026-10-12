import { defineAction, defineBehavior, defineEvent, prop } from '@sdk';

/**
 * Réglage au bon moment (Chapitre I) : une aiguille oscille sur un cadran (ou une roue tourne) ;
 * agir quand elle passe dans la zone valide un cran. Un raté ne coûte qu'un bruit de ferraille et
 * une seconde de patience (une vis saute), jamais un échec qui bloque l'histoire.
 *
 * - L'automate de tri du marché : clé en main, via la cible d'outil de l'entité, dont l'action
 *   `mask.calibrer` tente le cran (le clic passe par le pipeline normal des outils).
 * - La roue d'entraînement du parcours : touche d'interaction (`interact`), en pleine course.
 *
 * La jauge est publiée dans le magasin d'interface (`mask.calibrage`) quand le joueur est proche ;
 * la vue lit le drapeau `calibrage` (position de l'aiguille) pour tourner l'aiguille ou la roue.
 */
export interface CalibrageApi {
  readonly done: boolean;
  readonly successes: number;
  /** Needle position 0..1 (for a wheel: its turn, 0.5 = the mark at the top). */
  readonly needle: number;
  /** Current valid zone [from, to] on the 0..1 dial. */
  readonly zone: readonly [number, number];
  /** Tries the current needle position: true on success. */
  attempt(): boolean;
  reset(): void;
}

/** Centers of the zone after each success (the rhythm changes). */
const CENTERS = [0.62, 0.3, 0.78, 0.45, 0.7];

export const calibrageBehavior = defineBehavior({
  id: 'mask.calibrage',
  label: 'Réglage au bon moment',
  category: 'Viremasque',
  description: 'Une aiguille oscille (ou une roue tourne) ; agir quand elle est dans la zone valide un cran. Les ratés ne bloquent jamais.',
  props: {
    mode: prop.enum(
      [
        { value: 'aiguille', label: 'Aiguille (va-et-vient)' },
        { value: 'roue', label: 'Roue (tour complet)' },
      ],
      { label: 'Mouvement', default: 'aiguille' },
    ),
    successes: prop.integer({ label: 'Réussites nécessaires', default: 3, min: 1, max: 10 }),
    period: prop.number({ label: 'Durée d’un aller-retour ou d’un tour (s)', default: 1.8, min: 0.4, max: 10 }),
    zone: prop.number({ label: 'Largeur de la zone (0–1)', default: 0.2, min: 0.05, max: 0.9 }),
    shrink: prop.number({ label: 'Rétrécissement de la zone à chaque réussite', default: 0.03, min: 0, max: 0.2 }),
    missDelay: prop.number({ label: 'Attente après un raté (s)', default: 0.8, min: 0, max: 5 }),
    label: prop.text({ label: 'Titre de la jauge', default: 'mask.hud.reglage' }),
    help: prop.text({ label: 'Aide sous la jauge', default: 'mask.hud.reglageAide' }),
    showDistance: prop.number({ label: 'Jauge visible à moins de (m)', default: 4, min: 1, max: 20 }),
    interact: prop.boolean({ label: 'Se règle aussi avec la touche d’interaction' }),
    prompt: prop.text({ label: 'Texte de l’interaction', default: 'mask.use.roue' }),
    size: prop.vec3({ label: 'Zone de visée de l’interaction (m)', default: [1.4, 1.4, 0.6] }),
    offset: prop.vec3({ label: 'Décalage de la zone', default: [0, 1, 0] }),
    condition: prop.condition({ label: 'Réglable si' }),
    onSuccess: prop.actions({ label: 'À chaque réussite' }),
    onMiss: prop.actions({ label: 'À chaque raté' }),
    onComplete: prop.actions({ label: 'Une fois réglé' }),
  },
  state: { version: 1, initial: () => ({ successes: 0, done: false }) },
  create(ctx) {
    let t = 0;
    let flash: 'hit' | 'miss' | null = null;
    let flashLeft = 0;
    let wait = 0;
    let shown = false;
    const scope = (what: string) => ({ self: ctx.entity.id, origin: `réglage ${ctx.entity.id}/${what}` });
    const wheel = () => ctx.props.mode === 'roue';
    // The interaction key needs something to aim at: a see-through aim box.
    const applyBox = () => {
      if (!ctx.props.interact) return ctx.entity.setCollider('calibrage', null);
      const [sx, sy, sz] = ctx.props.size;
      const [ox, oy, oz] = ctx.props.offset;
      ctx.entity.setCollider('calibrage', { minX: ox - sx / 2, minY: oy - sy / 2, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy / 2, maxZ: oz + sz / 2 }, { solid: false, pickable: true });
    };
    applyBox();
    const needle = () => {
      const phase = (t / ctx.props.period) % 1;
      // A wheel turns; a needle eases in and out at both ends of the dial.
      return wheel() ? phase : 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    };
    const zone = (): [number, number] => {
      const w = Math.max(0.05, ctx.props.zone - ctx.props.shrink * ctx.state.successes);
      const c = wheel() ? 0.5 : CENTERS[ctx.state.successes % CENTERS.length]!;
      return [Math.max(0, c - w / 2), Math.min(1, c + w / 2)];
    };
    const open = () => !ctx.state.done && ctx.logic.test(ctx.props.condition, scope('condition'));
    const publish = () => {
      // Hidden while the player reads a dialogue or watches a cinematic.
      const busy = ctx.dialogue.active || ctx.cinematics.playing !== null;
      const active = !busy && open() && ctx.entity.distanceToPlayer() <= ctx.props.showDistance;
      if (!active) {
        // Several mechanisms share the gauge: only the one that showed it hides it.
        if (shown) ctx.ui.store.set('mask.calibrage', null);
        shown = false;
        return;
      }
      shown = true;
      ctx.ui.store.set('mask.calibrage', {
        title: ctx.t(ctx.props.label),
        help: ctx.props.help ? ctx.t(ctx.props.help) : '',
        wheel: wheel(),
        needle: needle(),
        zone: zone(),
        successes: ctx.state.successes,
        needed: ctx.props.successes,
        flash,
        waiting: wait > 0,
      });
    };
    const api: CalibrageApi = {
      get done() {
        return ctx.state.done;
      },
      get successes() {
        return ctx.state.successes;
      },
      get needle() {
        return needle();
      },
      get zone() {
        return zone();
      },
      attempt() {
        if (!open() || wait > 0) return false;
        const n = needle();
        const [a, b] = zone();
        const ok = n >= a && n <= b;
        flash = ok ? 'hit' : 'miss';
        flashLeft = 0.6;
        if (ok) {
          ctx.state.successes++;
          ctx.audio.play('mask:cran', { at: ctx.entity.id });
          ctx.events.emit('mask.calibrage', { entityId: ctx.entity.id, success: true, successes: ctx.state.successes });
          void ctx.logic.run(ctx.props.onSuccess, scope('réussite'));
          if (ctx.state.successes >= ctx.props.successes) {
            ctx.state.done = true;
            ctx.events.emit('mask.calibrageDone', { entityId: ctx.entity.id });
            void ctx.logic.run(ctx.props.onComplete, scope('fin'));
          }
        } else {
          wait = ctx.props.missDelay;
          ctx.audio.play('core:clang', { at: ctx.entity.id });
          ctx.fx.shake(0.08, 0.2);
          ctx.events.emit('mask.calibrage', { entityId: ctx.entity.id, success: false, successes: ctx.state.successes });
          void ctx.logic.run(ctx.props.onMiss, scope('raté'));
        }
        publish();
        return ok;
      },
      reset() {
        ctx.state.successes = 0;
        ctx.state.done = false;
        publish();
      },
    };
    return {
      api,
      update(dt) {
        t += dt;
        if (wait > 0) wait = Math.max(0, wait - dt);
        if (flashLeft > 0) {
          flashLeft -= dt;
          if (flashLeft <= 0) flash = null;
        }
        ctx.entity.setViewFlag('calibrage', ctx.state.done ? (wheel() ? null : 0.5) : needle());
        publish();
      },
      interaction() {
        if (!ctx.props.interact || !open()) return null;
        return { id: 'calibrer', label: ctx.t(ctx.props.prompt), detail: wait > 0 ? ctx.t('mask.hud.reglageAttente') : undefined };
      },
      onInteract(attempt) {
        if (attempt.offer.id === 'calibrer') api.attempt();
      },
      onPropsChanged: applyBox,
      dispose() {
        if (shown) ctx.ui.store.set('mask.calibrage', null);
      },
    };
  },
});

export const calibrerAction = defineAction({
  id: 'mask.calibrer',
  label: 'Tenter un cran de réglage',
  category: 'Viremasque',
  description: 'À appeler depuis la cible d’outil du mécanisme : réussit si l’aiguille est dans la zone.',
  props: { entity: prop.entity({ label: 'Mécanisme', withComponent: 'mask.calibrage' }) },
  run: (ctx, p) => void ctx.world.require(p.entity).behavior<CalibrageApi>('mask.calibrage')?.attempt(),
});

export const reinitialiserReglage = defineAction({
  id: 'mask.reinitialiserReglage',
  label: 'Remettre un réglage à zéro',
  category: 'Viremasque',
  description: 'Le mécanisme redevient à régler (la roue d’entraînement, à chaque nouvel essai du parcours).',
  props: { entity: prop.entity({ label: 'Mécanisme', withComponent: 'mask.calibrage' }) },
  run: (ctx, p) => ctx.world.require(p.entity).behavior<CalibrageApi>('mask.calibrage')?.reset(),
});

export const calibrageEvents = [
  defineEvent({
    id: 'mask.calibrage',
    label: 'Cran de réglage tenté',
    fields: { entityId: prop.entity({ label: 'Mécanisme', withComponent: 'mask.calibrage' }), success: prop.boolean({ label: 'Réussi' }), successes: prop.integer({ label: 'Réussites' }) },
  }),
  defineEvent({ id: 'mask.calibrageDone', label: 'Mécanisme réglé', fields: { entityId: prop.entity({ label: 'Mécanisme', withComponent: 'mask.calibrage' }) } }),
];
