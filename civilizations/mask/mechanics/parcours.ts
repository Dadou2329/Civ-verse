import { defineAction, defineBehavior, defineEvent, prop } from '@sdk';

/**
 * Parcours chronométré (Chapitre I, qualification) : franchir l'arche de départ (en avançant dans
 * le sens de l'entité) lance le chrono si la condition tient ; atteindre l'arrivée gagne. Le temps
 * écoulé ou une chute (redescendre de plus de `maxDrop` sous la hauteur atteinte) renvoie au point
 * de départ, en fondu, puis exécute `onFail` (le conseil d'un entraîneur) — jamais de fin de partie.
 * Plusieurs essais sont prévus.
 *
 * Le chrono est publié dans le magasin d'interface (`mask.parcours`) et sauvegardé avec la partie.
 */
type Status = 'idle' | 'running' | 'done';

export interface ParcoursApi {
  readonly status: Status;
  readonly elapsed: number;
  readonly fails: number;
  start(): void;
  fail(reason: 'time' | 'fall'): void;
}

export const parcoursBehavior = defineBehavior({
  id: 'mask.parcours',
  label: 'Parcours chronométré',
  category: 'Viremasque',
  description: 'Départ sous l’entité, arrivée, temps limite ; un échec ramène au départ (avec un conseil), sans jamais bloquer.',
  props: {
    finish: prop.entity({ label: 'Arrivée (entité)' }),
    finishRadius: prop.number({ label: 'Rayon de l’arrivée (m)', default: 1.6, min: 0.3, max: 10 }),
    startSize: prop.vec3({ label: 'Zone de départ (m)', default: [3, 3, 2] }),
    restart: prop.spawn({ label: 'Point de retour après un échec' }),
    timeLimit: prop.number({ label: 'Temps limite (s)', default: 100, min: 5, max: 1200 }),
    maxDrop: prop.number({ label: 'Chute de plus de (m) sous la hauteur atteinte = échec (0 = jamais)', default: 4.5, min: 0, max: 100 }),
    condition: prop.condition({ label: 'Ouvert si' }),
    onStart: prop.actions({ label: 'Au départ' }),
    onFail: prop.actions({ label: 'En cas d’échec' }),
    onFinish: prop.actions({ label: 'À l’arrivée' }),
  },
  state: { version: 1, initial: () => ({ status: 'idle' as Status, fails: 0, elapsed: 0, best: -1000 }) },
  create(ctx) {
    let wasInside = false;
    let busy = false;
    let shown = false;
    const scope = (what: string) => ({ self: ctx.entity.id, origin: `parcours ${ctx.entity.id}/${what}` });
    const publish = () => {
      if (ctx.state.status !== 'running') {
        if (shown) ctx.ui.store.set('mask.parcours', null);
        shown = false;
        return;
      }
      shown = true;
      ctx.ui.store.set('mask.parcours', { left: Math.max(0, Math.ceil(ctx.props.timeLimit - ctx.state.elapsed)), total: ctx.props.timeLimit });
    };
    /** Position of the player in the start area's frame: [across, along the course]. */
    const local = () => {
      const p = ctx.player.position;
      const e = ctx.entity.position;
      const r = (ctx.entity.yaw * Math.PI) / 180;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      return { across: dx * Math.cos(r) - dz * Math.sin(r), along: dx * Math.sin(r) + dz * Math.cos(r), up: p.y - e.y };
    };
    const inStart = () => {
      const l = local();
      const [sx, sy, sz] = ctx.props.startSize;
      return Math.abs(l.across) <= sx / 2 && Math.abs(l.along) <= sz / 2 && l.up >= -0.5 && l.up <= sy;
    };
    const api: ParcoursApi = {
      get status() {
        return ctx.state.status;
      },
      get elapsed() {
        return ctx.state.elapsed;
      },
      get fails() {
        return ctx.state.fails;
      },
      start() {
        if (ctx.state.status !== 'idle' || busy) return;
        ctx.state.status = 'running';
        ctx.state.elapsed = 0;
        ctx.state.best = ctx.player.position.y;
        ctx.audio.play('mask:sifflet');
        ctx.events.emit('mask.parcours.started', { entityId: ctx.entity.id });
        void ctx.logic.run(ctx.props.onStart, scope('départ'));
        publish();
      },
      fail(reason) {
        if (ctx.state.status !== 'running' || busy) return;
        busy = true;
        ctx.state.status = 'idle';
        ctx.state.fails++;
        publish();
        ctx.audio.play('core:denied');
        ctx.events.emit('mask.parcours.failed', { entityId: ctx.entity.id, reason, fails: ctx.state.fails });
        void (async () => {
          await ctx.fx.fade(1, 0.4);
          ctx.equipment.cancelUses();
          if (ctx.props.restart) ctx.player.teleport(ctx.props.restart);
          await ctx.time.wait(0.3);
          void ctx.fx.fade(0, 0.6);
          wasInside = inStart();
          busy = false;
          await ctx.logic.run(ctx.props.onFail, scope('échec'));
        })();
      },
    };
    publish();
    return {
      api,
      update(dt) {
        const st = ctx.state;
        if (st.status === 'idle') {
          if (busy) return;
          const inside = inStart();
          // The clock starts when the runner leaves the start area forward, toward the course.
          if (wasInside && !inside && local().along > 0 && ctx.logic.test(ctx.props.condition, scope('condition'))) api.start();
          wasInside = inside;
          return;
        }
        if (st.status !== 'running') return;
        st.elapsed += dt;
        const p = ctx.player.position;
        st.best = Math.max(st.best, p.y);
        const f = ctx.world.entity(ctx.props.finish);
        if (f && Math.hypot(p.x - f.position.x, p.z - f.position.z) <= ctx.props.finishRadius && Math.abs(p.y - f.position.y) < 2) {
          st.status = 'done';
          publish();
          ctx.audio.play('mask:acclamations');
          ctx.events.emit('mask.parcours.finished', { entityId: ctx.entity.id, seconds: Math.round(st.elapsed * 10) / 10 });
          void ctx.logic.run(ctx.props.onFinish, scope('arrivée'));
          return;
        }
        if (st.elapsed >= ctx.props.timeLimit) api.fail('time');
        else if (ctx.props.maxDrop > 0 && ctx.player.grounded && st.best - p.y > ctx.props.maxDrop) api.fail('fall');
        else publish();
      },
      dispose() {
        if (shown) ctx.ui.store.set('mask.parcours', null);
      },
    };
  },
});

export const parcoursEvents = [
  defineEvent({ id: 'mask.parcours.started', label: 'Parcours commencé', fields: { entityId: prop.entity({ label: 'Parcours', withComponent: 'mask.parcours' }) } }),
  defineEvent({
    id: 'mask.parcours.failed',
    label: 'Parcours manqué',
    fields: {
      entityId: prop.entity({ label: 'Parcours', withComponent: 'mask.parcours' }),
      reason: prop.string({ label: 'Raison (time, fall)' }),
      fails: prop.integer({ label: 'Nombre d’échecs' }),
    },
  }),
  defineEvent({
    id: 'mask.parcours.finished',
    label: 'Parcours réussi',
    fields: { entityId: prop.entity({ label: 'Parcours', withComponent: 'mask.parcours' }), seconds: prop.number({ label: 'Temps (s)' }) },
  }),
];

export const failParcours = defineAction({
  id: 'mask.failParcours',
  label: 'Faire échouer le parcours',
  category: 'Viremasque',
  description: 'Renvoie le coureur au départ (par exemple depuis un déclencheur placé dans le vide).',
  props: { parcours: prop.entity({ label: 'Parcours', withComponent: 'mask.parcours' }) },
  run: (ctx, p) => ctx.world.require(p.parcours).behavior<ParcoursApi>('mask.parcours')?.fail('fall'),
});
