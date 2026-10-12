/**
 * Doors and portals.
 *
 * `core.door` is a generic door: it opens/closes, blocks passage when closed and emits events.
 * Access rules are NOT part of it: locks are separate behaviors (e.g. Door Civilization's
 * `door.lock`) that veto the interaction through `beforeInteract` — so every civilization can
 * invent its own way of controlling passages.
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';

export interface DoorApi {
  readonly isOpen: boolean;
  open(opts?: { silent?: boolean }): boolean;
  close(opts?: { silent?: boolean }): boolean;
  toggle(): boolean;
}

export const doorBehavior = defineBehavior({
  id: 'core.door',
  label: 'Porte',
  category: 'Portes et passages',
  description: 'Porte ouvrable. Les règles d’accès sont ajoutées par d’autres composants (serrures).',
  props: {
    model: prop.model({ label: 'Modèle', default: 'core:door_wood' }),
    name: prop.text({ label: 'Nom (texte)', default: 'core.door.name' }),
    open: prop.boolean({ label: 'Ouverte au départ', default: false }),
    width: prop.number({ label: 'Largeur (m)', default: 1, min: 0.5, max: 4, step: 0.5 }),
    height: prop.number({ label: 'Hauteur (m)', default: 2, min: 1, max: 6, step: 0.5 }),
    hinge: prop.enum(
      [
        { value: 'left', label: 'Gauche' },
        { value: 'right', label: 'Droite' },
      ],
      { label: 'Charnière', default: 'left' },
    ),
    openSound: prop.sound({ label: 'Son d’ouverture', default: 'core:door_open' }),
    closeSound: prop.sound({ label: 'Son de fermeture', default: 'core:door_close' }),
    autoClose: prop.number({ label: 'Fermeture auto (s, 0 = jamais)', default: 0, min: 0, max: 120 }),
    interactable: prop.boolean({ label: 'Le joueur peut l’ouvrir', default: true }),
  },
  state: {
    version: 1,
    initial: (p: { open: boolean }) => ({ open: p.open }),
  },
  create(ctx) {
    let closeTimer: { dispose(): void } | null = null;
    const applyCollider = () => {
      const w = ctx.props.width;
      const h = ctx.props.height;
      if (ctx.state.open) ctx.entity.setCollider('panel', null);
      else ctx.entity.setCollider('panel', { minX: -w / 2, minY: 0, minZ: -0.1, maxX: w / 2, maxY: h, maxZ: 0.1 }, { solid: true, pickable: true });
      // Open doors stay targetable (to close them) through a thin non-solid box.
      if (ctx.state.open) ctx.entity.setCollider('frame', { minX: -w / 2, minY: 0, minZ: -0.12, maxX: w / 2, maxY: h, maxZ: 0.12 }, { solid: false, pickable: true });
      else ctx.entity.setCollider('frame', null);
    };
    const playerInDoorway = () => {
      const b = ctx.player.box();
      const p = ctx.entity.position;
      const r = Math.max(ctx.props.width, 0.8);
      return b.maxX > p.x - r && b.minX < p.x + r && b.maxZ > p.z - r && b.minZ < p.z + r && b.minY < p.y + ctx.props.height && b.maxY > p.y;
    };
    const api: DoorApi = {
      get isOpen() {
        return ctx.state.open;
      },
      open(opts) {
        if (ctx.state.open) return false;
        ctx.state.open = true;
        applyCollider();
        if (!opts?.silent && ctx.props.openSound) ctx.audio.play(ctx.props.openSound, { at: ctx.entity.id });
        ctx.events.emit('door.opened', { entityId: ctx.entity.id });
        closeTimer?.dispose();
        if (ctx.props.autoClose > 0) {
          const tryClose = () => {
            if (playerInDoorway()) closeTimer = ctx.time.after(1, tryClose);
            else api.close();
          };
          closeTimer = ctx.time.after(ctx.props.autoClose, tryClose);
        }
        return true;
      },
      close(opts) {
        if (!ctx.state.open) return false;
        if (playerInDoorway()) {
          ctx.time.after(0.8, () => api.close(opts));
          return false;
        }
        ctx.state.open = false;
        applyCollider();
        if (!opts?.silent && ctx.props.closeSound) ctx.audio.play(ctx.props.closeSound, { at: ctx.entity.id });
        ctx.events.emit('door.closed', { entityId: ctx.entity.id });
        return true;
      },
      toggle() {
        return ctx.state.open ? api.close() : api.open();
      },
    };
    applyCollider();
    return {
      api,
      interaction: () => {
        if (!ctx.props.interactable) return null;
        const name = ctx.t(ctx.props.name);
        return ctx.state.open
          ? { id: 'close', label: ctx.t('core.prompt.close', { name }) }
          : { id: 'open', label: ctx.t('core.prompt.open', { name }) };
      },
      onInteract: () => {
        api.toggle();
      },
      onPropsChanged: applyCollider,
      dispose: () => closeTimer?.dispose(),
    };
  },
});

export const portalBehavior = defineBehavior({
  id: 'core.portal',
  label: 'Passage vers une scène',
  category: 'Portes et passages',
  description: 'Fait passer le joueur dans une autre scène de la civilisation (interaction ou zone).',
  props: {
    scene: prop.scene({ label: 'Scène de destination' }),
    spawn: prop.string({ label: 'Point d’apparition (identifiant)' }),
    prompt: prop.text({ label: 'Invite', default: 'core.prompt.enter' }),
    mode: prop.enum(
      [
        { value: 'interact', label: 'Sur interaction' },
        { value: 'walk', label: 'En entrant dans la zone' },
      ],
      { label: 'Déclenchement', default: 'interact' },
    ),
    condition: prop.condition({ label: 'Disponible si' }),
    unavailable: prop.text({ label: 'Message si indisponible', default: 'core.portal.closed' }),
    actions: prop.actions({ label: 'Actions avant le passage' }),
    size: prop.vec3({ label: 'Zone (m)', default: [1.2, 2.2, 1.2] }),
  },
  create(ctx) {
    let inside = false;
    let travelling = false;
    const [sx, sy, sz] = ctx.props.size;
    ctx.entity.setCollider('portal', { minX: -sx / 2, minY: 0, minZ: -sz / 2, maxX: sx / 2, maxY: sy, maxZ: sz / 2 }, { solid: false, pickable: ctx.props.mode === 'interact' });
    const travel = async () => {
      if (travelling || !ctx.props.scene) return;
      travelling = true;
      try {
        await ctx.logic.run(ctx.props.actions, { self: ctx.entity.id, origin: `portail ${ctx.entity.id}` });
        await ctx.scenes.goTo(ctx.props.scene, ctx.props.spawn || undefined);
      } finally {
        travelling = false;
      }
    };
    return {
      interaction: () => {
        if (ctx.props.mode !== 'interact') return null;
        const ok = ctx.logic.test(ctx.props.condition, { self: ctx.entity.id });
        return { id: 'enter', label: ctx.t(ctx.props.prompt), enabled: ok, detail: ok ? undefined : ctx.t(ctx.props.unavailable), tone: 'special' };
      },
      onInteract: () => {
        void travel();
      },
      update: () => {
        if (ctx.props.mode !== 'walk') return;
        const b = ctx.player.box();
        const p = ctx.entity.position;
        const now = b.maxX > p.x - sx / 2 && b.minX < p.x + sx / 2 && b.maxZ > p.z - sz / 2 && b.minZ < p.z + sz / 2 && b.minY < p.y + sy && b.maxY > p.y;
        if (now && !inside && ctx.logic.test(ctx.props.condition, { self: ctx.entity.id })) void travel();
        inside = now;
      },
    };
  },
});
