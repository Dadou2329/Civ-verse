/**
 * Generic interactive components: run actions, pick up items, read documents.
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';
import type { BehaviorContext } from '../sim/api';

const pickBox = (ctx: BehaviorContext<{ size: [number, number, number]; offset: [number, number, number]; solid?: boolean }, unknown>, part = 'interact') => {
  const [sx, sy, sz] = ctx.props.size;
  const [ox, oy, oz] = ctx.props.offset;
  ctx.entity.setCollider(part, { minX: ox - sx / 2, minY: oy - sy / 2, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy / 2, maxZ: oz + sz / 2 }, { solid: !!ctx.props.solid, pickable: true });
};

export const interactableBehavior = defineBehavior({
  id: 'core.interactable',
  label: 'Objet interactif',
  category: 'Interactions',
  description: 'Exécute des actions de logique quand le joueur interagit (examiner, actionner, fouiller...).',
  props: {
    prompt: prop.text({ label: 'Invite', default: 'core.prompt.examine' }),
    detail: prop.text({ label: 'Détail sous l’invite' }),
    actions: prop.actions({ label: "Actions à l'interaction" }),
    condition: prop.condition({ label: 'Disponible si' }),
    hideIfUnavailable: prop.boolean({ label: 'Masquer si indisponible', default: true }),
    unavailableReason: prop.text({ label: 'Raison si indisponible' }),
    once: prop.boolean({ label: 'Une seule fois', default: false }),
    key: prop.enum(
      [
        { value: 'primary', label: 'Principale (E)' },
        { value: 'secondary', label: 'Secondaire (F)' },
      ],
      { label: 'Touche', default: 'primary' },
    ),
    tone: prop.enum(
      [
        { value: 'default', label: 'Normal' },
        { value: 'special', label: 'Spécial' },
        { value: 'danger', label: 'Danger' },
        { value: 'locked', label: 'Verrouillé' },
      ],
      { label: 'Ton', default: 'default' },
    ),
    priority: prop.integer({ label: 'Priorité', default: 0, advanced: true }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [0.8, 0.8, 0.8] }),
    offset: prop.vec3({ label: 'Décalage de la zone', default: [0, 0.5, 0] }),
    solid: prop.boolean({ label: 'Zone solide', default: false, advanced: true }),
  },
  state: { version: 1, initial: () => ({ uses: 0 }) },
  create(ctx) {
    pickBox(ctx);
    return {
      onPropsChanged: () => pickBox(ctx),
      interaction: () => {
        if (ctx.props.once && ctx.state.uses > 0) return null;
        const ok = ctx.logic.test(ctx.props.condition, { self: ctx.entity.id, origin: `${ctx.entity.id}/condition` });
        if (!ok && ctx.props.hideIfUnavailable) return null;
        return {
          id: 'use',
          label: ctx.t(ctx.props.prompt),
          detail: !ok && ctx.props.unavailableReason ? ctx.t(ctx.props.unavailableReason) : ctx.props.detail ? ctx.t(ctx.props.detail) : undefined,
          enabled: ok,
          tone: ctx.props.tone,
          priority: ctx.props.priority,
          key: ctx.props.key,
        };
      },
      onInteract: () => {
        ctx.state.uses++;
        void ctx.logic.run(ctx.props.actions, { self: ctx.entity.id, origin: `interaction ${ctx.entity.id}` });
      },
    };
  },
});

export const pickupBehavior = defineBehavior({
  id: 'core.pickup',
  label: 'Objet à ramasser',
  category: 'Interactions',
  description: "Ajoute un objet à l'inventaire puis disparaît du monde.",
  props: {
    item: prop.item({ label: 'Objet' }),
    count: prop.integer({ label: 'Quantité', default: 1, min: 1, max: 999 }),
    prompt: prop.text({ label: 'Invite', default: 'core.prompt.take' }),
    actions: prop.actions({ label: 'Actions après ramassage' }),
    condition: prop.condition({ label: 'Disponible si' }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [0.6, 0.6, 0.6] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0.3, 0] }),
    hideOnTake: prop.boolean({ label: "Disparaît une fois pris (décocher pour un coffre, une armoire…)", default: true }),
  },
  state: { version: 1, initial: () => ({ taken: false }) },
  create(ctx) {
    pickBox(ctx);
    if (ctx.state.taken && ctx.props.hideOnTake) ctx.entity.visible = false;
    return {
      onPropsChanged: () => pickBox(ctx),
      interaction: () => {
        if (ctx.state.taken || !ctx.props.item) return null;
        if (!ctx.logic.test(ctx.props.condition, { self: ctx.entity.id })) return null;
        return { id: 'take', label: ctx.t(ctx.props.prompt, { name: ctx.inventory.nameOf(ctx.props.item) }), priority: 5 };
      },
      onInteract: () => {
        if (ctx.state.taken) return;
        ctx.state.taken = true;
        ctx.inventory.add(ctx.props.item, ctx.props.count);
        ctx.audio.play('core:pickup', { at: ctx.entity.id });
        if (ctx.props.hideOnTake) ctx.entity.visible = false;
        void ctx.logic.run(ctx.props.actions, { self: ctx.entity.id, origin: `ramassage ${ctx.entity.id}` });
      },
    };
  },
});

export const readableBehavior = defineBehavior({
  id: 'core.readable',
  label: 'Document lisible',
  category: 'Interactions',
  description: 'Affiche un document (affiche, registre, lettre, plaque) puis exécute des actions.',
  props: {
    prompt: prop.text({ label: 'Invite', default: 'core.prompt.read' }),
    title: prop.text({ label: 'Titre' }),
    pages: prop.list(prop.text({ label: 'Paragraphe', multiline: true }), { label: 'Contenu' }),
    style: prop.enum(
      [
        { value: 'paper', label: 'Papier' },
        { value: 'register', label: 'Registre' },
        { value: 'poster', label: 'Affiche' },
        { value: 'letter', label: 'Lettre' },
        { value: 'plaque', label: 'Plaque' },
        { value: 'book', label: 'Livre' },
      ],
      { label: 'Style', default: 'paper' },
    ),
    actions: prop.actions({ label: 'Actions après lecture' }),
    condition: prop.condition({ label: 'Lisible si' }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [0.8, 0.8, 0.3] }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0.5, 0] }),
    solid: prop.boolean({ label: 'Zone solide', default: false, advanced: true }),
  },
  state: { version: 1, initial: () => ({ read: false }) },
  create(ctx) {
    pickBox(ctx);
    return {
      onPropsChanged: () => pickBox(ctx),
      interaction: () => {
        if (!ctx.logic.test(ctx.props.condition, { self: ctx.entity.id })) return null;
        return { id: 'read', label: ctx.t(ctx.props.prompt), detail: ctx.state.read ? ctx.t('core.prompt.alreadyRead') : undefined };
      },
      onInteract: () => {
        const first = !ctx.state.read;
        ctx.state.read = true;
        void (async () => {
          await ctx.ui.showDocument({ title: ctx.t(ctx.props.title), body: ctx.props.pages.map((k) => ctx.t(k)), style: ctx.props.style });
          if (first) await ctx.logic.run(ctx.props.actions, { self: ctx.entity.id, origin: `lecture ${ctx.entity.id}` });
        })();
      },
    };
  },
});
