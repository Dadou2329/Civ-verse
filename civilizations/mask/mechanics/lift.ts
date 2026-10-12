import { defineAction, defineBehavior, defineEvent, prop, type Vec3 } from '@sdk';

/**
 * Le monte-charge fou (Prologue, P02): a freight wagon loaded with the district's provisions rolls
 * down its inclined rail toward the market. The timing is *soft*: when it gets too close to the
 * stalls, Juno anchors it with her Fil line and hauls it back up a little — the player tries again,
 * nobody gets hurt, nothing is lost. It stops for good when its brake is freed (a Braise strike).
 *
 * The countdown is published in the UI store (`mask.lift`) for the HUD.
 */
type Status = 'idle' | 'running' | 'held' | 'stopped';

/** Speed variation of the surges (±75 %) and their period (s). */
const SURGE = 0.75;
const SURGE_PERIOD = 3.2;

export interface LiftApi {
  readonly status: Status;
  readonly progress: number;
  start(): void;
  stop(): void;
}

export const liftBehavior = defineBehavior({
  id: 'mask.monteCharge',
  label: 'Monte-charge fou',
  category: 'Viremasque',
  description: 'Wagon qui descend son rail vers le marché ; retenu par Juno à l’approche, arrêté quand son frein est libéré.',
  props: {
    from: prop.entity({ label: 'Haut du rail (repère)' }),
    to: prop.entity({ label: 'Bas du rail (repère)' }),
    duration: prop.number({ label: 'Durée de la descente (s)', default: 70, min: 5, max: 600 }),
    dangerAt: prop.number({ label: 'Juno le retient à (0–1)', default: 0.9, min: 0.1, max: 1 }),
    holdSeconds: prop.number({ label: 'Durée de la retenue (s)', default: 4, min: 0.5, max: 30 }),
    pullBackTo: prop.number({ label: 'Juno le remonte jusqu’à (0–1)', default: 0.55, min: 0, max: 1 }),
    holdLines: prop.list(prop.text({ label: 'Réplique' }), { label: 'Répliques de Juno quand elle le retient' }),
    onHold: prop.actions({ label: 'Quand Juno le retient' }),
    onStop: prop.actions({ label: 'À l’arrêt' }),
  },
  state: { version: 1, initial: () => ({ status: 'idle' as Status, progress: 0, holds: 0 }) },
  create(ctx) {
    let holdLeft = 0;
    let surge = 0;
    let lastScreech = -10;
    let rolling: { stop(): void } | null = null;
    const point = (id: string): Vec3 | null => ctx.world.entity(id)?.position ?? null;
    const place = () => {
      const a = point(ctx.props.from);
      const b = point(ctx.props.to);
      if (!a || !b) return;
      const t = ctx.state.progress;
      ctx.entity.setPosition({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      ctx.entity.setYaw((Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI);
    };
    const publish = () => {
      const st = ctx.state;
      // The view shows smoke from the overheated brake and sparks under the wheels.
      ctx.entity.setViewFlag('lift', st.status);
      if (st.status === 'running' || st.status === 'held') {
        const left = Math.max(0, (ctx.props.dangerAt - st.progress) * ctx.props.duration);
        ctx.ui.store.set('mask.lift', { status: st.status, seconds: Math.ceil(left) });
      } else ctx.ui.store.set('mask.lift', null);
    };
    const sound = (on: boolean) => {
      if (on && !rolling) rolling = ctx.audio.play('mask:wagon_roule', { at: ctx.entity.id, loop: true });
      if (!on && rolling) {
        rolling.stop();
        rolling = null;
      }
    };
    const api: LiftApi = {
      get status() {
        return ctx.state.status;
      },
      get progress() {
        return ctx.state.progress;
      },
      start() {
        if (ctx.state.status !== 'idle') return;
        ctx.state.status = 'running';
        sound(true);
        ctx.audio.play('mask:alarme', { at: ctx.entity.id });
        ctx.events.emit('mask.lift.started', { entityId: ctx.entity.id });
        publish();
      },
      stop() {
        if (ctx.state.status === 'stopped') return;
        ctx.state.status = 'stopped';
        sound(false);
        ctx.audio.play('mask:grincement', { at: ctx.entity.id });
        ctx.audio.play('mask:vapeur', { at: ctx.entity.id });
        publish();
        ctx.events.emit('mask.lift.stopped', { entityId: ctx.entity.id });
        void ctx.logic.run(ctx.props.onStop, { self: ctx.entity.id, origin: `monte-charge ${ctx.entity.id}` });
      },
    };
    place();
    // A save made during the chase starts it again from where it was.
    if (ctx.state.status === 'running' || ctx.state.status === 'held') {
      ctx.state.status = 'running';
      sound(true);
    }
    publish();
    return {
      api,
      update(dt) {
        const st = ctx.state;
        if (st.status === 'held') {
          holdLeft -= dt;
          // Juno hauls it back up while she holds it.
          const k = Math.min(1, dt / Math.max(0.1, ctx.props.holdSeconds));
          st.progress += (ctx.props.pullBackTo - st.progress) * k * 2.5;
          place();
          if (holdLeft <= 0) {
            st.status = 'running';
            sound(true);
          }
          publish();
          return;
        }
        if (st.status !== 'running') return;
        // It rolls in surges (catching on the rail, then lurching on); same average speed.
        surge += dt;
        const pace = 1 + SURGE * Math.sin((surge / SURGE_PERIOD) * Math.PI * 2);
        st.progress = Math.min(1, st.progress + (dt * pace) / ctx.props.duration);
        if (Math.sin((surge / SURGE_PERIOD) * Math.PI * 2) < -0.95 && surge - lastScreech > SURGE_PERIOD * 0.8) {
          lastScreech = surge;
          ctx.audio.play('mask:grincement', { at: ctx.entity.id, volume: 0.6 });
        }
        place();
        if (st.progress >= ctx.props.dangerAt) {
          st.status = 'held';
          st.holds++;
          holdLeft = ctx.props.holdSeconds;
          sound(false);
          ctx.audio.play('mask:elan');
          ctx.audio.play('mask:grincement', { at: ctx.entity.id });
          const lines = ctx.props.holdLines;
          if (lines.length > 0) ctx.ui.notify(ctx.t(lines[(st.holds - 1) % lines.length]!), { kind: 'warning', duration: 4 });
          ctx.events.emit('mask.lift.held', { entityId: ctx.entity.id, holds: st.holds });
          void ctx.logic.run(ctx.props.onHold, { self: ctx.entity.id, origin: `monte-charge ${ctx.entity.id}` });
        }
        publish();
      },
      dispose() {
        sound(false);
        ctx.ui.store.set('mask.lift', null);
      },
    };
  },
});

export const startLift = defineAction({
  id: 'mask.startLift',
  label: 'Lancer le monte-charge fou',
  category: 'Viremasque',
  props: { lift: prop.entity({ label: 'Monte-charge', withComponent: 'mask.monteCharge' }) },
  run: (ctx, p) => ctx.world.require(p.lift).behavior<LiftApi>('mask.monteCharge')?.start(),
});

export const stopLift = defineAction({
  id: 'mask.stopLift',
  label: 'Arrêter le monte-charge',
  category: 'Viremasque',
  props: { lift: prop.entity({ label: 'Monte-charge', withComponent: 'mask.monteCharge' }) },
  run: (ctx, p) => ctx.world.require(p.lift).behavior<LiftApi>('mask.monteCharge')?.stop(),
});

export const liftEvents = [
  defineEvent({ id: 'mask.lift.started', label: 'Le monte-charge s’emballe', fields: { entityId: prop.entity({ label: 'Monte-charge' }) } }),
  defineEvent({ id: 'mask.lift.held', label: 'Juno retient le monte-charge', fields: { entityId: prop.entity({ label: 'Monte-charge' }), holds: prop.integer({ label: 'Nombre de retenues' }) } }),
  defineEvent({ id: 'mask.lift.stopped', label: 'Le monte-charge est arrêté', fields: { entityId: prop.entity({ label: 'Monte-charge' }) } }),
];
