import { defineBehavior, defineEvent, prop } from '@sdk';
import { chamber } from './chamber';

/**
 * RecollectionTrigger — the same place, observed with or without a memory.
 *
 * While its shard is active, the entity shows another model (a stele where a name appears),
 * another description when examined, and can run actions the first time it is examined that
 * way. Removing the shard brings everything back: the change is observable and reversible.
 */
export const recollection = defineBehavior({
  id: 'memory.recollection',
  label: 'Réminiscence (perception changée par un éclat)',
  category: 'Mémoire',
  description: 'Modèle et description différents selon qu’un éclat est ancré ou non.',
  props: {
    shard: prop.string({ label: 'Éclat qui change la perception' }),
    prompt: prop.text({ label: 'Invite', default: 'memory.prompt.observe' }),
    without: prop.text({ label: 'Ce qu’on perçoit sans l’éclat', multiline: true }),
    with: prop.text({ label: 'Ce qu’on perçoit avec l’éclat', multiline: true }),
    modelWithout: prop.model({ label: 'Modèle sans l’éclat' }),
    modelWith: prop.model({ label: 'Modèle avec l’éclat' }),
    actionsWith: prop.actions({ label: 'Actions au premier examen avec l’éclat' }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [1, 1.8, 1] }),
  },
  state: { version: 1, initial: () => ({ seenWith: false, seenWithout: false }) },
  create(ctx) {
    const [sx, sy, sz] = ctx.props.size;
    ctx.entity.setCollider('observe', { minX: -sx / 2, minY: 0, minZ: -sz / 2, maxX: sx / 2, maxY: sy, maxZ: sz / 2 }, { solid: false, pickable: true });
    let lastActive: boolean | null = null;
    const active = () => !!ctx.props.shard && chamber(ctx).isAnchored(ctx.props.shard);
    const applyModel = () => {
      const now = active();
      if (now === lastActive) return;
      lastActive = now;
      const model = now ? ctx.props.modelWith : ctx.props.modelWithout;
      if (model && ctx.entity.has('core.model') && ctx.entity.props<{ model?: string }>('core.model').model !== model) ctx.entity.setProp('core.model', 'model', model);
      ctx.events.emit('memory.perceptionChanged', { entityId: ctx.entity.id, active: now });
    };
    applyModel();
    return {
      interaction: () => ({ id: 'observe', label: ctx.t(ctx.props.prompt), priority: 2 }),
      onInteract: (attempt) => {
        if (attempt.source !== 'memory.recollection') return;
        const withShard = active();
        const text = withShard ? ctx.props.with : ctx.props.without;
        if (text) ctx.ui.notify(ctx.t(text), { kind: withShard ? 'memory' : 'info', duration: 6 });
        if (withShard && !ctx.state.seenWith) {
          ctx.state.seenWith = true;
          void ctx.logic.run(ctx.props.actionsWith, { self: ctx.entity.id, origin: `réminiscence ${ctx.entity.id}` });
        }
        if (!withShard) ctx.state.seenWithout = true;
      },
      update: applyModel,
    };
  },
});

/**
 * NPCRecognition — how a character recognizes the protagonist (or the song, or a face) depends
 * on story state and active shards. The current level is exposed as the story variable
 * `memory.recognition.<entity>` (dialogues branch on it) and changes the character's ambient
 * lines, so nobody repeats the same words whatever happened.
 */
export const recognition = defineBehavior({
  id: 'memory.recognition',
  label: 'Reconnaissance (PNJ)',
  category: 'Mémoire',
  description: 'Niveaux de reconnaissance d’un personnage selon des conditions ; change ses répliques.',
  requires: ['core.npc'],
  props: {
    levels: prop.list(
      prop.object({
        when: prop.condition({ label: 'Quand' }),
        level: prop.enum(
          [
            { value: 'inconnu', label: 'Inconnu' },
            { value: 'sensation', label: 'Sensation sans cause' },
            { value: 'reconnu', label: 'Reconnaît' },
            { value: 'lie', label: 'Lien retrouvé' },
          ] as const,
          { label: 'Niveau', default: 'sensation' },
        ),
        barks: prop.list(prop.text({ label: 'Réplique' }), { label: 'Répliques d’ambiance' }),
      }),
      { label: 'Niveaux (le premier vrai s’applique)' },
    ),
  },
  create(ctx) {
    let current = '';
    let timer = 0;
    const evaluate = () => {
      const scope = { self: ctx.entity.id, origin: `reconnaissance ${ctx.entity.id}` };
      const hit = ctx.props.levels.find((l) => ctx.logic.test(l.when, scope));
      const level = hit?.level ?? 'inconnu';
      const key = `${level}|${hit ? ctx.props.levels.indexOf(hit) : -1}`;
      if (key === current) return;
      const previous = current.split('|')[0] ?? '';
      current = key;
      ctx.vars.set(`memory.recognition.${ctx.entity.id}`, level);
      if (hit && ctx.entity.has('core.npc')) ctx.entity.setProp('core.npc', 'barks', hit.barks);
      if (previous && previous !== level) ctx.events.emit('memory.recognitionChanged', { entityId: ctx.entity.id, level });
    };
    evaluate();
    return {
      update(dt) {
        timer -= dt;
        if (timer > 0) return;
        timer = 0.5;
        evaluate();
      },
    };
  },
});

export const recollectionEvents = [
  defineEvent({ id: 'memory.perceptionChanged', label: 'Perception modifiée par un éclat', fields: { entityId: prop.entity({ label: 'Entité' }), active: prop.boolean({ label: 'Éclat actif' }) } }),
  defineEvent({ id: 'memory.recognitionChanged', label: 'Reconnaissance modifiée', fields: { entityId: prop.entity({ label: 'Personnage' }), level: prop.string({ label: 'Niveau' }) } }),
];
