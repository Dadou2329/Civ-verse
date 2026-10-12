import { defineBehavior, defineEvent, prop, vec, type Vec3 } from '@sdk';

/**
 * Localized suspicion — no global police system: a restricted area, the guards who watch it, and
 * what happens when one of them sees the player inside: a verbal intervention, then the guard
 * walks the player back out. Every catch is remembered (`door.suspicion`); after three, the guard
 * sends the player to Captain Varen — the other way through, so the patrol can never block the
 * story.
 */
export interface RestrictedApi {
  contains(p: Vec3): boolean;
  allowed(): boolean;
  readonly escortTo: string;
}

export const restrictedArea = defineBehavior({
  id: 'door.restricted',
  label: 'Zone réglementée',
  category: 'Verrou',
  description: 'Volume où les gardes surveillants interviennent si le joueur y est vu sans autorisation.',
  props: {
    size: prop.vec3({ label: 'Taille (m)', default: [8, 4, 8] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0, 0] }),
    name: prop.text({ label: 'Nom de la zone' }),
    escortTo: prop.entity({ label: 'Raccompagner vers le repère' }),
    allowedWhen: prop.condition({ label: 'Autorisé si' }),
  },
  create(ctx) {
    const api: RestrictedApi = {
      contains(p) {
        const [sx, sy, sz] = ctx.props.size;
        const [ox, oy, oz] = ctx.props.offset;
        const c = ctx.entity.position;
        return Math.abs(p.x - (c.x + ox)) <= sx / 2 && Math.abs(p.z - (c.z + oz)) <= sz / 2 && p.y >= c.y + oy - 0.2 && p.y <= c.y + oy + sy;
      },
      allowed() {
        return ctx.logic.test(ctx.props.allowedWhen, { self: ctx.entity.id });
      },
      get escortTo() {
        return ctx.props.escortTo;
      },
    };
    return { api };
  },
});

export const watcher = defineBehavior({
  id: 'door.watcher',
  label: 'Garde surveillant',
  category: 'Verrou',
  description: 'Un personnage qui intervient quand il voit le joueur dans une zone réglementée.',
  requires: ['core.npc'],
  props: {
    zone: prop.entity({ label: 'Zone surveillée', withComponent: 'door.restricted' }),
    range: prop.number({ label: 'Portée du regard (m)', default: 7, min: 1, max: 25 }),
    fov: prop.number({ label: 'Champ de vision (°)', default: 110, min: 20, max: 360 }),
    lines: prop.list(prop.text({ label: 'Réplique' }), {
      label: 'Répliques (1re, 2e, 3e interpellation)',
      default: ['door.bark.patrol.caught1', 'door.bark.patrol.caught2', 'door.bark.patrol.caught3'],
    }),
  },
  state: { version: 1, initial: () => ({ catches: 0 }) },
  create(ctx) {
    let cooldown = 0;
    let busy = false;
    const sees = (): boolean => {
      const zone = ctx.world.entity(ctx.props.zone)?.behavior<RestrictedApi>('door.restricted');
      if (!zone || zone.allowed()) return false;
      const p = ctx.player.position;
      if (!zone.contains(p)) return false;
      const me = ctx.entity.position;
      const dist = Math.hypot(p.x - me.x, p.z - me.z);
      if (dist > ctx.props.range) return false;
      // Facing: yaw 0 looks toward +Z.
      const yaw = (ctx.entity.yaw * Math.PI) / 180;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const dot = dist < 0.01 ? 1 : ((p.x - me.x) * fx + (p.z - me.z) * fz) / dist;
      if (dot < Math.cos(((ctx.props.fov / 2) * Math.PI) / 180) && dist > 1.6) return false;
      // Line of sight from the guard's eyes to the player's head.
      const eye = { x: me.x, y: me.y + 1.6, z: me.z };
      const head = ctx.player.eye;
      const delta = vec.subVec(head, eye);
      const len = vec.lengthVec(delta);
      const dir = vec.scaleVec(delta, 1 / len);
      // Start outside the guard's own body.
      const from = vec.addVec(eye, vec.scaleVec(dir, 0.45));
      const hit = ctx.world.raycast(from, dir, len - 0.45);
      return !hit || hit.distance >= len - 1.05;
    };
    const intervene = async () => {
      busy = true;
      const lock = ctx.player.lockMovement('door.watcher');
      try {
        ctx.state.catches++;
        ctx.vars.set('door.suspicion', ctx.state.catches);
        ctx.entity.stop();
        ctx.entity.lookAt('player');
        ctx.player.lookAt({ x: ctx.entity.position.x, y: ctx.entity.position.y + 1.6, z: ctx.entity.position.z });
        const lines = ctx.props.lines;
        const line = lines.length ? lines[Math.min(ctx.state.catches, lines.length) - 1]! : '';
        ctx.audio.play('core:denied');
        if (line) {
          ctx.entity.say(ctx.t(line), 3.4);
          ctx.ui.notify(ctx.t(line), { kind: 'warning', duration: 3.4 });
        }
        ctx.events.emit('door.caught', { guardId: ctx.entity.id, count: ctx.state.catches });
        await ctx.time.wait(2.4);
        await ctx.fx.fade(1, 0.5);
        const zone = ctx.world.entity(ctx.props.zone)?.behavior<RestrictedApi>('door.restricted');
        if (zone?.escortTo) ctx.player.teleport(zone.escortTo);
        await ctx.time.wait(0.4);
        void ctx.fx.fade(0, 0.7);
        ctx.ui.notify(ctx.t('door.notify.escorted'), { kind: 'info' });
        if (ctx.state.catches >= 3) ctx.vars.set('door.varenSummons', true);
      } finally {
        lock.dispose();
        busy = false;
        cooldown = 3;
      }
    };
    return {
      update(dt) {
        if (busy) return;
        if (cooldown > 0) {
          cooldown -= dt;
          return;
        }
        if (ctx.cinematics.playing || ctx.dialogue.active) return;
        if (sees()) void intervene();
      },
    };
  },
});

export const caughtEvent = defineEvent({
  id: 'door.caught',
  label: 'Joueur surpris par un garde',
  fields: { guardId: prop.entity({ label: 'Garde' }), count: prop.integer({ label: 'Nombre de fois' }) },
});
