import { defineBehavior, defineEvent, prop, type Vec3 } from '@sdk';

/**
 * Cagette qui glisse (Chapitre I, preuve de courage) : sur la passerelle mouillée, une cagette
 * glisse d'un repère à l'autre, encore et encore, tant que sa condition tient (la pluie). Si elle
 * attrape le joueur, elle le bouscule vers le bas de la pente et interrompt l'outil en main — rien
 * de pire. Entre deux glissades, elle attend cachée dans la pile de cagettes du haut.
 */
export const glissadeBehavior = defineBehavior({
  id: 'mask.glissade',
  label: 'Objet qui glisse',
  category: 'Viremasque',
  description: 'Glisse en boucle d’un repère à l’autre tant que sa condition tient ; bouscule le joueur qu’il touche et interrompt l’outil en main.',
  props: {
    from: prop.entity({ label: 'Départ (repère)' }),
    to: prop.entity({ label: 'Arrivée (repère)' }),
    condition: prop.condition({ label: 'Glisse si' }),
    speed: prop.number({ label: 'Vitesse (m/s)', default: 3.2, min: 0.2, max: 20 }),
    pause: prop.number({ label: 'Pause avant chaque glissade (s)', default: 2.5, min: 0, max: 30 }),
    delay: prop.number({ label: 'Décalage du premier départ (s)', default: 0, min: 0, max: 30 }),
    push: prop.number({ label: 'Bousculade (m/s)', default: 6, min: 0, max: 30 }),
    radius: prop.number({ label: 'Rayon de contact (m)', default: 0.75, min: 0.2, max: 3 }),
  },
  create(ctx) {
    let t = -ctx.props.delay;
    let lastHit = -10;
    let running = false;
    const point = (id: string): Vec3 | null => ctx.world.entity(id)?.position ?? null;
    const rest = (a: Vec3) => {
      if (ctx.entity.visible) ctx.entity.visible = false;
      ctx.entity.setPosition(a);
      running = false;
    };
    return {
      update(dt) {
        const a = point(ctx.props.from);
        const b = point(ctx.props.to);
        if (!a || !b) return;
        if (!ctx.logic.test(ctx.props.condition, { self: ctx.entity.id, origin: `glissade ${ctx.entity.id}` })) {
          t = -ctx.props.delay;
          if (ctx.entity.visible || running) rest(a);
          return;
        }
        const length = Math.max(0.1, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
        const run = length / ctx.props.speed;
        t += dt;
        const local = t < 0 ? -1 : t % (run + ctx.props.pause);
        if (local < 0 || local > run) {
          if (ctx.entity.visible || running) rest(a);
          return;
        }
        if (!running) {
          running = true;
          ctx.entity.visible = true;
          ctx.entity.setYaw((Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI);
          ctx.audio.play('mask:glissade', { at: ctx.entity.id });
        }
        const k = local / run;
        const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
        ctx.entity.setPosition(p);
        const pl = ctx.player.position;
        if (Math.hypot(pl.x - p.x, pl.z - p.z) < ctx.props.radius && Math.abs(pl.y - p.y) < 1.4 && ctx.time.now - lastHit > 0.8) {
          lastHit = ctx.time.now;
          ctx.player.impulse({ x: ((b.x - a.x) / length) * ctx.props.push, y: 2.5, z: ((b.z - a.z) / length) * ctx.props.push });
          ctx.equipment.cancelUses();
          ctx.audio.play('core:thud', { at: ctx.entity.id });
          ctx.fx.shake(0.15, 0.25);
          ctx.events.emit('mask.glissadeHit', { entityId: ctx.entity.id });
        }
      },
    };
  },
});

export const glissadeEvents = [
  defineEvent({ id: 'mask.glissadeHit', label: 'Le joueur est bousculé par un objet qui glisse', fields: { entityId: prop.entity({ label: 'Objet', withComponent: 'mask.glissade' }) } }),
];
