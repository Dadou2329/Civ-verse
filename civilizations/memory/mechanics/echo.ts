import { defineAction, defineBehavior, defineEvent, defineMechanic, prop, type CivContext } from '@sdk';
import { chamber } from './chamber';

/**
 * MemoryEcho — observing a place while carrying the right shard shows a brief translucent
 * superimposition: tinted light, a sound, ghost silhouettes or objects, and a few lines of the
 * remembered scene. Echoes are data (content/rules.json) and can always be replayed
 * (« Rejouer l'écho »), so a puzzle never relies on a single reading.
 */
export interface EchoDef {
  id: string;
  title: string;
  lines: string[];
  tint: string;
  duration: number;
  ghosts: { from: [number, number, number]; to: [number, number, number]; color: string; reverse: boolean; height: number }[];
  objects: { model: string; at: [number, number, number]; t: number }[];
}

export interface EchoApi {
  play(id: string): Promise<void>;
  readonly playing: string | null;
  played(id: string): boolean;
  def(id: string): EchoDef | undefined;
}

export function echoes(ctx: CivContext): EchoApi {
  return ctx.mechanics.get<EchoApi>('memory.echoes');
}

const vec = (label: string) => prop.vec3({ label });

export const echoMechanic = defineMechanic({
  id: 'memory.echoes',
  label: 'Échos mnésiques',
  description: 'Surimpressions brèves (teinte, son, silhouettes, objets, répliques) rejouables.',
  dependsOn: ['memory.chamber'],
  state: { version: 1, initial: () => ({ played: [] as string[] }) },
  settings: {
    echoes: prop.list(
      prop.object({
        id: prop.string({ label: 'Identifiant' }),
        title: prop.text({ label: 'Titre' }),
        lines: prop.list(prop.text({ label: 'Réplique / description' }), { label: 'Répliques' }),
        tint: prop.color({ label: 'Teinte', default: '#c08aff' }),
        duration: prop.number({ label: 'Durée (s)', default: 8, min: 2, max: 30 }),
        ghosts: prop.list(
          prop.object({
            from: vec('Départ'),
            to: vec('Arrivée'),
            color: prop.color({ label: 'Couleur', default: '#d6b4ff' }),
            reverse: prop.boolean({ label: 'Marche à reculons (scène rembobinée)' }),
            height: prop.number({ label: 'Taille (m)', default: 1.75, min: 0.8, max: 2.2 }),
          }),
          { label: 'Silhouettes' },
        ),
        objects: prop.list(prop.object({ model: prop.model({ label: 'Modèle' }), at: vec('Position'), t: prop.number({ label: 'Apparition (s)', default: 1 }) }), {
          label: 'Objets',
        }),
      }),
      { label: 'Échos' },
    ),
  },
  setup(ctx, state, settings): EchoApi {
    const defs = new Map<string, EchoDef>(settings.echoes.map((e) => [e.id, e as EchoDef]));
    let playing: string | null = null;
    let token = 0;
    // An echo belongs to a place: leaving the scene ends it (overlay and tint included).
    ctx.lifecycle.on('sceneExit', () => {
      if (!playing) return;
      token++;
      playing = null;
      ctx.fx.tint(null, 0, 0.3);
      ctx.ui.store.set('memory.echo', null);
    });
    return {
      get playing() {
        return playing;
      },
      played: (id) => state.played.includes(id),
      def: (id) => defs.get(id),
      async play(id) {
        const def = defs.get(id);
        if (!def) return void ctx.log.error(`Écho inconnu : ${id}`);
        const my = ++token;
        playing = id;
        if (!state.played.includes(id)) state.played.push(id);
        ctx.audio.play('memory:echo');
        ctx.fx.tint(def.tint, 0.28, 0.8);
        ctx.fx.custom('memory.echo', { ghosts: def.ghosts, objects: def.objects, duration: def.duration, tint: def.tint });
        ctx.ui.store.set('memory.echo', {
          id,
          n: my,
          title: def.title ? ctx.t(def.title) : '',
          lines: def.lines.map((l) => ctx.t(l)),
          duration: def.duration,
          tint: def.tint,
        });
        ctx.events.emit('memory.echoStarted', { echoId: id });
        await ctx.time.wait(def.duration);
        if (my !== token) return;
        playing = null;
        ctx.fx.tint(null, 0, 1);
        ctx.ui.store.set('memory.echo', null);
        ctx.events.emit('memory.echoPlayed', { echoId: id });
      },
    };
  },
});

export const playEcho = defineAction({
  id: 'memory.playEcho',
  label: 'Jouer un écho',
  category: 'Mémoire',
  props: { echo: prop.string({ label: 'Écho' }), wait: prop.boolean({ label: 'Attendre la fin', default: false }) },
  async run(ctx, p, scope) {
    if (scope.skipping) return;
    const done = echoes(ctx).play(p.echo);
    if (p.wait) await done;
  },
  essential: false,
});

/**
 * A place that answers an active shard: the echo plays by itself the first time the player comes
 * close with the shard anchored, then can be replayed on demand.
 */
export const echoPoint = defineBehavior({
  id: 'memory.echoPoint',
  label: "Point d'écho",
  category: 'Mémoire',
  description: 'Rejoue un écho quand le bon éclat est ancré (automatiquement la première fois).',
  props: {
    echo: prop.string({ label: 'Écho' }),
    shard: prop.string({ label: 'Éclat requis (vide = aucun)' }),
    radius: prop.number({ label: 'Déclenchement automatique (m, 0 = jamais)', default: 4, min: 0, max: 20 }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [1, 1.6, 1] }),
    onFirst: prop.actions({ label: 'Actions au premier écho' }),
  },
  state: { version: 1, initial: () => ({ seen: false }) },
  create(ctx) {
    const [sx, sy, sz] = ctx.props.size;
    ctx.entity.setCollider('echo', { minX: -sx / 2, minY: 0, minZ: -sz / 2, maxX: sx / 2, maxY: sy, maxZ: sz / 2 }, { solid: false, pickable: true });
    const ready = () => !ctx.props.shard || chamber(ctx).isAnchored(ctx.props.shard);
    const trigger = async () => {
      const first = !ctx.state.seen;
      ctx.state.seen = true;
      const done = echoes(ctx).play(ctx.props.echo);
      if (first) void ctx.logic.run(ctx.props.onFirst, { self: ctx.entity.id, origin: `écho ${ctx.entity.id}` });
      await done;
    };
    return {
      interaction: () => {
        if (!ready()) return null;
        const heard = ctx.state.seen || echoes(ctx).played(ctx.props.echo);
        return { id: 'echo', label: ctx.t(heard ? 'memory.prompt.replay' : 'memory.prompt.listen'), key: 'secondary', tone: 'special', priority: 3 };
      },
      onInteract: (attempt) => {
        if (attempt.source === 'memory.echoPoint' && !echoes(ctx).playing) void trigger();
      },
      update: () => {
        if (ctx.state.seen || ctx.props.radius <= 0 || echoes(ctx).playing || ctx.cinematics.playing || ctx.dialogue.active) return;
        if (ready() && ctx.entity.distanceToPlayer() <= ctx.props.radius) void trigger();
      },
    };
  },
});

export const echoEvents = [
  defineEvent({ id: 'memory.echoStarted', label: 'Écho commencé', fields: { echoId: prop.string({ label: 'Écho' }) } }),
  defineEvent({ id: 'memory.echoPlayed', label: 'Écho terminé', fields: { echoId: prop.string({ label: 'Écho' }) } }),
];
