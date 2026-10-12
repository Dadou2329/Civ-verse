/**
 * Volumes reacting to the player: triggers (run actions, emit events) and named zones
 * (location titles, music changes, "entering a location" events).
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';
import type { AABB } from '../physics/aabb';
import { rotatedBounds, overlaps } from '../physics/aabb';

function volumeBox(position: { x: number; y: number; z: number }, yaw: number, size: [number, number, number], offset: [number, number, number]): AABB {
  const [sx, sy, sz] = size;
  const [ox, oy, oz] = offset;
  return rotatedBounds(position.x, position.y, position.z, { minX: ox - sx / 2, minY: oy, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy, maxZ: oz + sz / 2 }, yaw);
}

export const triggerBehavior = defineBehavior({
  id: 'core.trigger',
  label: 'Déclencheur',
  category: 'Narration',
  description: 'Volume invisible : exécute des actions quand le joueur entre ou sort.',
  props: {
    size: prop.vec3({ label: 'Taille (m)', default: [2, 2.5, 2] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0, 0] }),
    once: prop.boolean({ label: 'Une seule fois', default: true }),
    condition: prop.condition({ label: 'Actif si' }),
    onEnter: prop.actions({ label: "À l'entrée" }),
    onExit: prop.actions({ label: 'À la sortie' }),
  },
  state: { version: 1, initial: () => ({ fired: false }) },
  create(ctx) {
    let inside = false;
    return {
      update: () => {
        const box = volumeBox(ctx.entity.position, ctx.entity.yaw, ctx.props.size, ctx.props.offset);
        const now = overlaps(box, ctx.player.box());
        if (now === inside) return;
        inside = now;
        const scope = { self: ctx.entity.id, origin: `déclencheur ${ctx.entity.id}` };
        if (now) {
          if (ctx.props.once && ctx.state.fired) return;
          if (!ctx.logic.test(ctx.props.condition, scope)) {
            inside = false;
            return;
          }
          ctx.state.fired = true;
          ctx.events.emit('trigger.entered', { triggerId: ctx.entity.id });
          void ctx.logic.run(ctx.props.onEnter, scope);
        } else {
          ctx.events.emit('trigger.exited', { triggerId: ctx.entity.id });
          void ctx.logic.run(ctx.props.onExit, scope);
        }
      },
    };
  },
});

export const zoneBehavior = defineBehavior({
  id: 'core.zone',
  label: 'Zone nommée',
  category: 'Narration',
  description: 'Lieu nommé (titre à l’écran, musique, événement « entrée dans un lieu »).',
  props: {
    name: prop.text({ label: 'Nom du lieu' }),
    subtitle: prop.text({ label: 'Sous-titre' }),
    size: prop.vec3({ label: 'Taille (m)', default: [10, 6, 10] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0, 0] }),
    showTitle: prop.boolean({ label: 'Afficher le titre', default: true }),
    music: prop.music({ label: 'Musique (vide = inchangée)' }),
    ambience: prop.sound({ label: 'Ambiance (vide = inchangée)' }),
  },
  state: { version: 1, initial: () => ({ visited: false }) },
  create(ctx) {
    let inside = false;
    return {
      update: () => {
        const box = volumeBox(ctx.entity.position, ctx.entity.yaw, ctx.props.size, ctx.props.offset);
        const p = ctx.player.position;
        const now = p.x >= box.minX && p.x <= box.maxX && p.z >= box.minZ && p.z <= box.maxZ && p.y + 0.1 >= box.minY && p.y <= box.maxY;
        if (now === inside) return;
        inside = now;
        if (now) {
          const name = ctx.props.name ? ctx.t(ctx.props.name) : '';
          if (ctx.props.showTitle && name) ctx.ui.showLocation(name, ctx.props.subtitle ? ctx.t(ctx.props.subtitle) : undefined);
          if (ctx.props.music) ctx.audio.music(ctx.props.music);
          if (ctx.props.ambience) ctx.audio.ambience(ctx.props.ambience);
          ctx.state.visited = true;
          ctx.events.emit('zone.entered', { zoneId: ctx.entity.id, name });
        } else {
          ctx.events.emit('zone.exited', { zoneId: ctx.entity.id });
        }
      },
    };
  },
});
