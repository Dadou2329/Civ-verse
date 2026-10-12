import { defineAction, defineBehavior, defineCondition, defineEvent, defineMechanic, prop, type CivContext } from '@sdk';

/**
 * MemoryShard + MemorySlots — the « chambre mnésique ».
 *
 * A shard is structured data (id, original owner, sensory scene, concrete fact, flags, echo);
 * the definitions live in content/rules.json (Civilization Rules editor). Each shard has a state:
 *   possede   possessed by the protagonist (« ancré » in the mind)
 *   cede      given away: lost, only an emotional trace remains
 *   restaure  rewritten into its owner
 * Three slots make possessed shards *active*: an active shard changes perception (recollection
 * triggers, echoes, recognition). Slots can only be changed at a memory device (the Métier des
 * souvenirs, Oriane's table) or with the portable diapason.
 */
export type ShardState = 'aucun' | 'possede' | 'cede' | 'restaure';

export interface ShardDef {
  id: string;
  name: string;
  origin: string;
  color: string;
  model: string;
  sense: string;
  fact: string;
  touch: string;
  echo: string;
  flags: string[];
  /** Story variable that, once true, reveals the true origin of the shard. */
  revealVar: string;
  revealedOrigin: string;
}

export interface ChamberApi {
  readonly slots: readonly (string | null)[];
  shard(id: string): ShardDef | undefined;
  shards(): ShardDef[];
  /** Localization key of the shard's origin as currently known (it can be revealed later). */
  originOf(id: string): string;
  state(id: string): ShardState;
  /** Shards currently possessed, in acquisition order. */
  owned(): string[];
  isAnchored(id: string): boolean;
  canManipulate(): boolean;
  give(id: string, opts?: { silent?: boolean }): void;
  /** Anchors a possessed shard; without `force`, needs a memory device nearby or the instrument. */
  anchor(id: string, slot?: number, opts?: { force?: boolean }): boolean;
  remove(id: string, opts?: { force?: boolean }): boolean;
  cede(id: string, to: string): void;
  restore(id: string, to: string): void;
  examine(id: string): void;
}

interface ChamberState {
  states: Record<string, ShardState>;
  order: string[];
  slots: (string | null)[];
  examined: string[];
}

const SHARD_FIELDS = {
  id: prop.string({ label: 'Identifiant' }),
  name: prop.text({ label: 'Nom' }),
  origin: prop.text({ label: 'Propriétaire d’origine' }),
  color: prop.color({ label: 'Couleur', default: '#f0a040' }),
  model: prop.model({ label: 'Modèle', default: 'memory:shard_amber' }),
  sense: prop.text({ label: 'Scène sensorielle', multiline: true }),
  fact: prop.text({ label: 'Information concrète', multiline: true }),
  touch: prop.text({ label: 'Ce que l’on entend en le touchant' }),
  echo: prop.string({ label: 'Écho associé' }),
  flags: prop.list(prop.string({ label: 'Drapeau' }), { label: 'Drapeaux' }),
  revealVar: prop.variable({ label: 'Variable qui révèle la vraie origine' }),
  revealedOrigin: prop.text({ label: 'Origine révélée' }),
};

export function chamber(ctx: CivContext): ChamberApi {
  return ctx.mechanics.get<ChamberApi>('memory.chamber');
}

export const chamberMechanic = defineMechanic({
  id: 'memory.chamber',
  label: 'Chambre mnésique (éclats et emplacements)',
  description: 'Éclats de souvenirs possédés, cédés ou restaurés, et trois emplacements actifs.',
  state: { version: 1, initial: (): ChamberState => ({ states: {}, order: [], slots: [null, null, null], examined: [] }) },
  settings: {
    shards: prop.list(prop.object(SHARD_FIELDS), { label: 'Éclats' }),
    instrument: prop.item({ label: 'Instrument portable (permet d’ancrer partout)' }),
    // C (« chambre ») is at the same place and has the same label on AZERTY and QWERTY.
    chamberKey: prop.string({ label: 'Touche « Souvenirs »', default: 'KeyC' }),
  },
  setup(ctx, state, settings): ChamberApi {
    const defs = new Map<string, ShardDef>(settings.shards.map((s) => [s.id, s as ShardDef]));
    const sync = () => {
      const owned = state.order.filter((id) => state.states[id] === 'possede');
      ctx.vars.set('memory.shardsOwned', owned.length);
      ctx.vars.set('memory.shardsEquipped', state.slots.filter(Boolean).length);
      for (const id of defs.keys()) {
        ctx.vars.set(`memory.slot.${id}`, state.slots.includes(id));
        ctx.vars.set(`memory.shard.${id}`, state.states[id] ?? 'aucun');
      }
      ctx.ui.store.set('memory.chamber', { slots: [...state.slots], states: { ...state.states }, order: [...state.order] });
    };
    const nearDevice = (): boolean =>
      ctx.world.query({ component: 'memory.device' }).some((e) => e.visible && e.distanceToPlayer() <= Number(e.props<{ radius?: number }>('memory.device').radius ?? 3));
    const canManipulate = () => (!!settings.instrument && ctx.inventory.has(settings.instrument)) || nearDevice();
    const needsNoDevice = () => {
      if (canManipulate()) return true;
      ctx.ui.notify(ctx.t('memory.panel.needDevice'), { kind: 'warning' });
      return false;
    };
    const api: ChamberApi = {
      get slots() {
        return state.slots;
      },
      shard: (id) => defs.get(id),
      shards: () => [...defs.values()],
      originOf(id) {
        const def = defs.get(id);
        if (!def) return '';
        return def.revealVar && def.revealedOrigin && ctx.vars.get(def.revealVar) ? def.revealedOrigin : def.origin;
      },
      state: (id) => state.states[id] ?? 'aucun',
      owned: () => state.order.filter((id) => state.states[id] === 'possede'),
      isAnchored: (id) => state.slots.includes(id),
      canManipulate,
      give(id, opts = {}) {
        if (!defs.has(id)) return void ctx.log.error(`Éclat inconnu : ${id}`);
        if (state.states[id] === 'possede') return;
        state.states[id] = 'possede';
        if (!state.order.includes(id)) state.order.push(id);
        sync();
        if (!opts.silent) {
          ctx.audio.play('memory:shard_touch');
          ctx.ui.notify(ctx.t('memory.notify.shardFound', { name: ctx.t(defs.get(id)!.name) }), { kind: 'memory', duration: 4.5 });
        }
        ctx.events.emit('memory.shardAcquired', { shardId: id });
      },
      anchor(id, slot, opts = {}) {
        if (state.states[id] !== 'possede' || state.slots.includes(id)) return false;
        if (!opts.force && !needsNoDevice()) return false;
        const index = slot !== undefined && state.slots[slot] === null ? slot : state.slots.indexOf(null);
        if (index < 0) {
          ctx.ui.notify(ctx.t('memory.notify.chamberFull'), { kind: 'warning' });
          return false;
        }
        state.slots[index] = id;
        sync();
        ctx.audio.play('memory:anchor');
        ctx.fx.tint(defs.get(id)?.color ?? '#c08aff', 0.12, 0.6);
        ctx.events.emit('memory.anchored', { shardId: id, slot: index });
        return true;
      },
      remove(id, opts = {}) {
        const index = state.slots.indexOf(id);
        if (index < 0) return false;
        if (!opts.force && !needsNoDevice()) return false;
        state.slots[index] = null;
        sync();
        ctx.audio.play('memory:remove');
        ctx.events.emit('memory.removed', { shardId: id, slot: index });
        return true;
      },
      cede(id, to) {
        if (state.states[id] !== 'possede') return;
        api.remove(id, { force: true });
        state.states[id] = 'cede';
        sync();
        ctx.ui.notify(ctx.t('memory.notify.ceded', { name: ctx.t(defs.get(id)!.name) }), { kind: 'memory', duration: 5 });
        ctx.events.emit('memory.shardCeded', { shardId: id, to });
      },
      restore(id, to) {
        if (state.states[id] !== 'possede') return;
        api.remove(id, { force: true });
        state.states[id] = 'restaure';
        sync();
        ctx.events.emit('memory.shardRestored', { shardId: id, to });
      },
      examine(id) {
        const def = defs.get(id);
        if (!def) return;
        if (!state.examined.includes(id)) state.examined.push(id);
        ctx.audio.play('memory:shard_touch');
        if (def.touch) ctx.ui.store.set('memory.touch', { id, text: ctx.t(def.touch), n: (ctx.ui.store.get<{ n: number }>('memory.touch')?.n ?? 0) + 1 });
        ctx.events.emit('memory.examined', { shardId: id });
      },
    };
    for (const id of state.order) if (!defs.has(id)) ctx.log.warn(`Éclat sauvegardé inconnu ignoré : ${id}`);
    sync();
    ctx.input.bind('memory.chamber', { key: settings.chamberKey, label: 'memory.input.chamber' });
    ctx.input.onPressed('memory.chamber', () => {
      if (!ctx.ui.isPanelOpen('memory.chamber')) void ctx.ui.openPanel('memory.chamber');
    });
    return api;
  },
});

/** A place where shards can be anchored or removed (Métier des souvenirs, Oriane's table). */
export const deviceBehavior = defineBehavior({
  id: 'memory.device',
  label: 'Dispositif mnésique',
  category: 'Mémoire',
  description: 'Permet d’ancrer et de retirer des éclats à proximité ; ouvre la chambre mnésique.',
  props: {
    radius: prop.number({ label: 'Rayon d’utilisation (m)', default: 3, min: 1, max: 10 }),
    prompt: prop.text({ label: 'Invite', default: 'memory.prompt.device' }),
  },
  create(ctx) {
    ctx.entity.setCollider('device', { minX: -0.9, minY: 0, minZ: -0.6, maxX: 0.9, maxY: 1.6, maxZ: 0.6 }, { solid: false, pickable: true });
    return {
      interaction: () => ({ id: 'device', label: ctx.t(ctx.props.prompt), tone: 'special', priority: 4 }),
      onInteract: () => {
        void ctx.ui.openPanel('memory.chamber');
      },
    };
  },
});

// ------------------------------------------------------------------------------------------------
// Logic building blocks
// ------------------------------------------------------------------------------------------------

const shardProp = prop.string({ label: 'Éclat (identifiant)' });

export const chamberActions = [
  defineAction({
    id: 'memory.giveShard',
    label: 'Donner un éclat au protagoniste',
    category: 'Mémoire',
    props: { shard: shardProp, silent: prop.boolean({ label: 'Sans notification' }) },
    run: (ctx, p) => chamber(ctx).give(p.shard, { silent: p.silent }),
    summarize: (p) => `Éclat « ${p.shard} »`,
  }),
  defineAction({
    id: 'memory.anchorShard',
    label: 'Ancrer un éclat (emplacement libre)',
    category: 'Mémoire',
    props: { shard: shardProp },
    run: (ctx, p) => void chamber(ctx).anchor(p.shard, undefined, { force: true }),
  }),
  defineAction({
    id: 'memory.removeShard',
    label: 'Retirer un éclat de son emplacement',
    category: 'Mémoire',
    props: { shard: shardProp },
    run: (ctx, p) => void chamber(ctx).remove(p.shard, { force: true }),
  }),
  defineAction({
    id: 'memory.examineShard',
    label: 'Examiner un éclat (entendre ce qu’il contient)',
    category: 'Mémoire',
    props: { shard: shardProp },
    run: (ctx, p) => chamber(ctx).examine(p.shard),
  }),
  defineAction({
    id: 'memory.openChamber',
    label: 'Ouvrir la chambre mnésique',
    category: 'Mémoire',
    props: {},
    run: async (ctx) => {
      await ctx.ui.openPanel('memory.chamber');
    },
  }),
];

export const chamberConditions = [
  defineCondition({
    id: 'memory.anchored',
    label: 'Un éclat est ancré dans un emplacement',
    category: 'Mémoire',
    props: { shard: shardProp },
    test: (ctx, p) => chamber(ctx).isAnchored(p.shard),
    summarize: (p) => `« ${p.shard} » ancré`,
  }),
  defineCondition({
    id: 'memory.shardState',
    label: 'État d’un éclat',
    category: 'Mémoire',
    props: {
      shard: shardProp,
      state: prop.enum(
        [
          { value: 'aucun', label: 'Jamais obtenu' },
          { value: 'possede', label: 'Possédé' },
          { value: 'cede', label: 'Cédé' },
          { value: 'restaure', label: 'Restauré' },
        ] as const,
        { label: 'État', default: 'possede' },
      ),
    },
    test: (ctx, p) => chamber(ctx).state(p.shard) === p.state,
    summarize: (p) => `« ${p.shard} » ${p.state}`,
  }),
];

export const chamberEvents = [
  defineEvent({ id: 'memory.shardAcquired', label: 'Éclat obtenu', fields: { shardId: prop.string({ label: 'Éclat' }) } }),
  defineEvent({ id: 'memory.anchored', label: 'Éclat ancré', fields: { shardId: prop.string({ label: 'Éclat' }), slot: prop.integer({ label: 'Emplacement' }) } }),
  defineEvent({ id: 'memory.removed', label: 'Éclat retiré', fields: { shardId: prop.string({ label: 'Éclat' }), slot: prop.integer({ label: 'Emplacement' }) } }),
  defineEvent({ id: 'memory.examined', label: 'Éclat examiné', fields: { shardId: prop.string({ label: 'Éclat' }) } }),
  defineEvent({ id: 'memory.shardCeded', label: 'Éclat cédé', fields: { shardId: prop.string({ label: 'Éclat' }), to: prop.string({ label: 'À qui' }) } }),
  defineEvent({ id: 'memory.shardRestored', label: 'Éclat restauré', fields: { shardId: prop.string({ label: 'Éclat' }), to: prop.string({ label: 'À qui' }) } }),
];
