/**
 * Ladders: a climbable volume set against a wall. The entity's yaw is the direction the climber
 * faces (toward the wall). Inside the volume, walking toward the ladder climbs, walking away goes
 * down, sideways slides along it, and Space lets go with a small hop back. The top of the volume
 * is the exit height: pushing on at the top hoists the climber onto the ledge.
 *
 * At the foot of the ladder, standing on the ground, the player walks normally: gravity is only
 * suspended while climbing.
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';
import type { Disposable } from '../util/disposable';
import { overlaps, rotatedBounds, type AABB } from '../physics/aabb';

export const ladderBehavior = defineBehavior({
  id: 'core.ladder',
  label: 'Échelle',
  category: 'Monde',
  description: 'Volume grimpable contre une paroi : avancer vers l’échelle fait monter, reculer fait descendre, Espace la lâche. Le haut du volume est la hauteur de sortie.',
  props: {
    size: prop.vec3({ label: 'Taille du volume (m)', default: [1, 4, 0.8] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0, 0] }),
    speed: prop.number({ label: 'Vitesse de montée (m/s)', default: 2.8, min: 0.5, max: 10 }),
  },
  create(ctx) {
    let mod: Disposable | null = null;
    /** Suspends gravity from the next frame (decided by the previous movement step). */
    let climbing = false;
    /** Space pressed on the rungs: hop back, then let go. */
    let letGo = false;
    let hopped = false;
    /** Pushed on at the top: the climber is hoisted onto the ledge. */
    let hoisted = false;
    /** Seconds during which the ladder cannot be grabbed again (after letting go, at the top). */
    let cooldown = 0;
    const facing = () => {
      const r = (ctx.entity.yaw * Math.PI) / 180;
      return { x: Math.sin(r), z: Math.cos(r) };
    };
    const bounds = (): AABB => {
      const [sx, sy, sz] = ctx.props.size;
      const [ox, oy, oz] = ctx.props.offset;
      const p = ctx.entity.position;
      return rotatedBounds(p.x, p.y, p.z, { minX: ox - sx / 2, minY: oy, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy, maxZ: oz + sz / 2 }, ctx.entity.yaw);
    };
    const detach = () => {
      mod?.dispose();
      mod = null;
      climbing = false;
      letGo = false;
      hopped = false;
      hoisted = false;
    };
    const attach = () => {
      mod = ctx.player.addMovementModifier({
        id: `ladder:${ctx.entity.id}`,
        priority: 50,
        modifyParams(params) {
          if (!climbing) return;
          params.gravity = 0;
          // The ladder sets the horizontal speed itself (no drift away from the rungs).
          params.airAccel = 0;
        },
        canJump(state) {
          // From the ground, a normal jump; on the rungs, Space lets go.
          if (state.grounded) return undefined;
          letGo = true;
          return false;
        },
        modifyVelocity(state) {
          const f = facing();
          const v = state.velocity;
          if (letGo) {
            if (!hopped) {
              hopped = true;
              v.x = -f.x * 3;
              v.y = 3.5;
              v.z = -f.z * 3;
            }
            return;
          }
          if (hoisted) return;
          const into = state.wish.x * f.x + state.wish.z * f.z;
          // Right of the climber: (f.z, -f.x) in the engine's left-handed frame.
          const side = state.wish.x * f.z - state.wish.z * f.x;
          const speed = ctx.props.speed;
          const was = climbing;
          if (into > 0.3) {
            if (state.position.y >= bounds().maxY - 0.05) {
              // At the top: hoist onto the ledge.
              hoisted = true;
              climbing = false;
              ctx.player.forceMove({ x: f.x * 2.8, y: 1.6, z: f.z * 2.8 }, 0.4, { gravity: false });
              return;
            }
            climbing = true;
            v.y = speed;
          } else if (state.grounded) {
            climbing = false;
            return;
          } else {
            climbing = true;
            v.y = into < -0.3 ? -speed : 0;
          }
          // Closer to the wall while climbing (it stops the climber), never away from it; slow sideways moves.
          const toward = Math.max(0, into) * speed * 0.6;
          const lateral = side * speed * 0.6;
          v.x = f.x * toward + f.z * lateral;
          v.z = f.z * toward - f.x * lateral;
          if (climbing && !was) ctx.events.emit('ladder.grabbed', { entityId: ctx.entity.id });
        },
      });
    };
    return {
      update(dt) {
        if (cooldown > 0) cooldown -= dt;
        if (mod && (hopped || hoisted)) {
          detach();
          cooldown = 0.5;
          return;
        }
        const box = bounds();
        // A hidden ladder (not lowered yet, taken away by the story) cannot be climbed.
        const inside = ctx.entity.visible && overlaps(box, ctx.player.box()) && ctx.player.position.y < box.maxY - 0.02;
        if (inside && !mod && cooldown <= 0 && !ctx.player.movementLocked) attach();
        else if (!inside && mod) detach();
      },
      onVisibilityChanged(visible) {
        if (!visible) detach();
      },
      dispose: detach,
    };
  },
});
