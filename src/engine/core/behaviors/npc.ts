/**
 * Non-player characters: appearance reference, name, dialogue, autonomous movement modes
 * (static, wander, patrol, follow), looking at the player, ambient lines.
 * Scripts and cinematics can take control at any time with entity.moveTo(); autonomous modes
 * never interrupt a scripted move or a dialogue.
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';

export const npcBehavior = defineBehavior({
  id: 'core.npc',
  label: 'Personnage (PNJ)',
  category: 'Personnages',
  description: 'Habitant du monde : apparence, nom, dialogue, déplacements et réactions au joueur.',
  props: {
    character: prop.character({ label: 'Apparence' }),
    name: prop.text({ label: 'Nom affiché' }),
    dialogue: prop.dialogue({ label: 'Dialogue' }),
    talkPrompt: prop.text({ label: "Invite d'interaction", default: 'core.prompt.talk' }),
    interactable: prop.boolean({ label: 'On peut lui parler', default: true }),
    mode: prop.enum(
      [
        { value: 'static', label: 'Immobile' },
        { value: 'wander', label: 'Flâne autour de sa position' },
        { value: 'patrol', label: 'Patrouille' },
        { value: 'follow', label: 'Suit le joueur' },
      ],
      { label: 'Déplacement', default: 'static' },
    ),
    patrol: prop.list(prop.entity({ label: 'Repère' }), { label: 'Points de patrouille' }),
    patrolWait: prop.number({ label: 'Pause à chaque point (s)', default: 2, min: 0, max: 60 }),
    wanderRadius: prop.number({ label: 'Rayon de flânerie (m)', default: 4, min: 0.5, max: 30 }),
    speed: prop.number({ label: 'Vitesse (m/s)', default: 1.5, min: 0.3, max: 6 }),
    lookAtPlayer: prop.boolean({ label: 'Regarde le joueur proche', default: true }),
    lookDistance: prop.number({ label: 'Distance de regard (m)', default: 4.5, min: 0, max: 20 }),
    barks: prop.list(prop.text({ label: 'Réplique' }), { label: 'Répliques d’ambiance' }),
    barkInterval: prop.number({ label: 'Intervalle des répliques (s)', default: 14, min: 3, max: 120 }),
    idleAnimation: prop.string({ label: 'Animation au repos', default: 'idle', advanced: true }),
    faction: prop.string({ label: 'Faction', advanced: true }),
    height: prop.number({ label: 'Taille (m)', default: 1.8, min: 0.8, max: 2.6, advanced: true }),
    solid: prop.boolean({ label: 'Bloque le passage', default: true, advanced: true }),
  },
  state: {
    version: 1,
    initial: () => ({ patrolIndex: 0 }),
  },
  create(ctx) {
    const home = { ...ctx.entity.position };
    let ownMove = false;
    let waitUntil = 0;
    let lastBark = -1000;
    let barkIndex = 0;
    const applyCollider = () => {
      const h = ctx.props.height;
      ctx.entity.setCollider('body', { minX: -0.3, minY: 0, minZ: -0.3, maxX: 0.3, maxY: h, maxZ: 0.3 }, { solid: ctx.props.solid, pickable: true });
    };
    applyCollider();
    ctx.entity.playAnimation(ctx.props.idleAnimation || 'idle', { loop: true });

    const autonomousMove = (target: { x: number; y: number; z: number }, stopDistance = 0.4) => {
      ownMove = true;
      void ctx.entity.moveTo(target, { speed: ctx.props.speed, stopDistance }).then(() => {
        ownMove = false;
        waitUntil = ctx.time.now + (ctx.props.mode === 'patrol' ? ctx.props.patrolWait : 2 + Math.random() * 4);
      });
    };

    const talkingToMe = () => ctx.dialogue.active && ctx.entity.distanceToPlayer() < 6;

    return {
      interaction: () => {
        if (!ctx.props.interactable || !ctx.props.dialogue) return null;
        return { id: 'talk', label: ctx.t(ctx.props.talkPrompt, { name: ctx.t(ctx.props.name) }), priority: 10 };
      },
      onInteract: () => {
        if (ctx.entity.moving) ctx.entity.stop();
        ctx.entity.lookAt('player');
        void ctx.dialogue.start(ctx.props.dialogue, { entity: ctx.entity.id });
      },
      onPropsChanged: applyCollider,
      update: () => {
        const dist = ctx.entity.distanceToPlayer();
        const busyScripted = ctx.entity.moving && !ownMove;
        if (talkingToMe()) {
          if (ownMove) ctx.entity.stop();
          ctx.entity.lookAt('player');
          return;
        }
        if (ctx.props.lookAtPlayer && dist < ctx.props.lookDistance && !ctx.entity.moving) ctx.entity.lookAt('player');
        else if (!ctx.entity.moving) ctx.entity.lookAt(null);
        if (ctx.props.barks.length > 0 && dist < 5 && ctx.time.now - lastBark > ctx.props.barkInterval) {
          lastBark = ctx.time.now;
          ctx.entity.say(ctx.t(ctx.props.barks[barkIndex++ % ctx.props.barks.length]!));
        }
        if (busyScripted || ctx.entity.moving || ctx.time.now < waitUntil || ctx.cinematics.playing) return;
        switch (ctx.props.mode) {
          case 'wander': {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * ctx.props.wanderRadius;
            const x = home.x + Math.cos(a) * r;
            const z = home.z + Math.sin(a) * r;
            const y = ctx.world.groundAt(x, z, home.y + 1);
            if (y !== null && Math.abs(y - home.y) < 1.1) autonomousMove({ x, y, z });
            else waitUntil = ctx.time.now + 1;
            break;
          }
          case 'patrol': {
            const pts = ctx.props.patrol;
            if (pts.length === 0) break;
            const idx = ctx.state.patrolIndex % pts.length;
            const target = ctx.world.entity(pts[idx]!);
            ctx.state.patrolIndex = (idx + 1) % pts.length;
            if (target) autonomousMove(target.position);
            else waitUntil = ctx.time.now + 2;
            break;
          }
          case 'follow':
            if (dist > 3) autonomousMove(ctx.player.position, 2);
            break;
          default:
            break;
        }
      },
    };
  },
});
