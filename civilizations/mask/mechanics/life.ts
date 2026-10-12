import { defineBehavior, prop, type Vec3 } from '@sdk';

/**
 * Fil couriers leaping from roof to roof along a circuit of points, in arcs (no pathfinding: they
 * jump over the gaps). In a loop for the life of the upper city; once through the points for a
 * scripted run (Juno crossing the rails of the freight lift). Changing the points (core.setProp)
 * starts the new route from its first point; an empty list stops the character where it is.
 */
export const voltigeBehavior = defineBehavior({
  id: 'mask.voltige',
  label: 'Coursier en voltige',
  category: 'Viremasque',
  description: 'Le personnage bondit de point en point en arcs (toits du Fil), en boucle ou une seule fois.',
  props: {
    points: prop.list(prop.vec3({ label: 'Point' }), { label: 'Points du parcours', itemLabel: 'Point' }),
    loop: prop.boolean({ label: 'En boucle', default: true }),
    speed: prop.number({ label: 'Vitesse (m/s)', default: 6, min: 0.5, max: 30 }),
    hop: prop.number({ label: 'Hauteur des bonds (m)', default: 2, min: 0, max: 12 }),
    pause: prop.number({ label: 'Pause à chaque point (s)', default: 0.6, min: 0, max: 20 }),
  },
  state: { version: 1, initial: () => ({ route: '', index: 0 }) },
  create(ctx) {
    let t = 0;
    let wait = ctx.props.loop ? Math.random() * 2 : 0;
    let leg: { from: Vec3; to: Vec3; duration: number } | null = null;
    const pts = () => ctx.props.points.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    return {
      update(dt) {
        const list = pts();
        const route = JSON.stringify(ctx.props.points);
        if (route !== ctx.state.route) {
          // A new route: start over from its first point.
          ctx.state.route = route;
          ctx.state.index = 0;
          leg = null;
          wait = 0;
          if (list.length === 1) ctx.entity.setPosition(list[0]!);
        }
        if (list.length < 2) return;
        if (!leg) {
          const last = !ctx.props.loop && ctx.state.index >= list.length - 1;
          if (last) return;
          if (wait > 0) {
            wait -= dt;
            return;
          }
          const from = list[ctx.state.index % list.length]!;
          const to = list[(ctx.state.index + 1) % list.length]!;
          const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
          leg = { from, to, duration: Math.max(0.2, d / ctx.props.speed) };
          t = 0;
          ctx.entity.setYaw((Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI);
          ctx.entity.playAnimation('run', { loop: true });
        }
        t = Math.min(1, t + dt / leg.duration);
        const { from, to } = leg;
        const arc = 4 * ctx.props.hop * t * (1 - t);
        ctx.entity.setPosition({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t + arc, z: from.z + (to.z - from.z) * t });
        if (t >= 1) {
          leg = null;
          ctx.state.index = ctx.props.loop ? (ctx.state.index + 1) % list.length : ctx.state.index + 1;
          wait = ctx.props.pause;
          ctx.entity.playAnimation('idle', { loop: true });
        }
      },
    };
  },
});
