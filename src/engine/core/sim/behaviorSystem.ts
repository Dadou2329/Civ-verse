/**
 * Instantiates entity components (behaviors), updates them, isolates their errors, applies
 * runtime prop overrides and captures their persistent state for saves.
 */
import type { GameSession } from './session';
import type { RuntimeEntity, ComponentRecord } from '../world/entity';
import type { EntityState } from '../save/saveFormat';
import type { InteractionOffer } from './api';
import type { DisposableScope } from '../util/disposable';
import { normalizeProps } from '../props/props';
import { migrateVersioned } from '../save/saveFormat';
import { createBehaviorContext, dropMotor, motorOf } from './contexts';
import { toError } from '../util/assert';
import type { JsonValue } from '../util/json';

export interface SourcedOffer {
  offer: InteractionOffer;
  source: string;
}

export class BehaviorSystem {
  private scopes = new WeakMap<RuntimeEntity, DisposableScope>();
  private warnedUnknown = new Set<string>();

  constructor(private readonly session: GameSession) {}

  instantiate(e: RuntimeEntity, saved: EntityState | undefined): void {
    const s = this.session;
    const civ = s.civ;
    if (!civ || !civ.sceneScope) throw new Error('Instanciation hors scène.');
    const log = s.logHub.logger('composants');
    const entityScope = civ.sceneScope.child(`entité:${e.id}`);
    this.scopes.set(e, entityScope);
    for (const [type, raw] of Object.entries(e.doc.components)) {
      const reg = s.behaviorDefs.get(type);
      const def = reg?.def ?? null;
      const overrides = { ...(saved?.overrides?.[type] ?? {}) } as Record<string, JsonValue>;
      const record: ComponentRecord = {
        type,
        def,
        baseProps: raw,
        overrides,
        props: { ...raw },
        state: undefined,
        instance: null,
        ctx: null,
        faulted: null,
      };
      if (!def) {
        if (!this.warnedUnknown.has(type)) {
          this.warnedUnknown.add(type);
          log.warn(`Composant inconnu "${type}" (entité ${e.id}) : données conservées, aucun comportement.`);
        }
        e.components.set(type, record);
        continue;
      }
      const { value, issues } = normalizeProps(def.props, raw);
      for (const i of issues) if (i.severity === 'error') log.warn(`${e.id}/${type}.${i.path} : ${i.message}`);
      record.props = { ...(value as Record<string, unknown>), ...overrides };
      record.state = migrateVersioned(
        saved?.states?.[type],
        def.state,
        () => (def.state ? def.state.initial(record.props as never) : undefined),
        `${e.id}/${type}`,
        (m) => log.warn(m),
      );
      e.components.set(type, record);
    }
    // Create instances once every record exists (behaviors may read sibling components).
    for (const record of e.components.values()) {
      if (!record.def) continue;
      const scope = entityScope.child(record.type);
      record.ctx = createBehaviorContext(s, civ, e, record, scope);
      try {
        record.instance = record.def.create(record.ctx as never) ?? null;
      } catch (err) {
        this.fault(e, record, err, 'création');
      }
    }
  }

  private fault(e: RuntimeEntity, record: ComponentRecord, err: unknown, phase: string): void {
    const error = toError(err);
    record.faulted = `${phase} : ${error.message}`;
    this.session.logHub.logger('composants').error(`${e.id}/${record.type} désactivé (erreur en ${phase})`, error);
  }

  update(dt: number): void {
    const world = this.session.world;
    if (!world) return;
    for (const e of [...world.entities.values()]) {
      if (!e.enabled) continue;
      for (const record of e.components.values()) {
        const inst = record.instance;
        if (!inst?.update || record.faulted) continue;
        try {
          inst.update(dt);
        } catch (err) {
          this.fault(e, record, err, 'mise à jour');
        }
      }
    }
  }

  /** Advances NPC locomotion (after behaviors issued their moves). */
  updateMotors(dt: number): void {
    const world = this.session.world;
    if (!world) return;
    for (const e of world.entities.values()) {
      if (!e.enabled) continue;
      const m = motorOf(this.session, e, false);
      if (!m) continue;
      try {
        m.update(dt);
      } catch (err) {
        this.session.log.error(`Déplacement de ${e.id}`, err);
        m.cancel(false);
      }
    }
  }

  destroy(e: RuntimeEntity): void {
    for (const record of e.components.values()) {
      try {
        record.instance?.dispose?.();
      } catch (err) {
        this.session.log.error(`Libération de ${e.id}/${record.type}`, err);
      }
      record.instance = null;
      record.ctx = null;
    }
    dropMotor(e);
    this.scopes.get(e)?.dispose();
    this.scopes.delete(e);
  }

  destroyAll(): void {
    const world = this.session.world;
    if (!world) return;
    for (const e of world.entities.values()) this.destroy(e);
  }

  setProp(e: RuntimeEntity, type: string, key: string, value: JsonValue): void {
    const record = e.components.get(type);
    if (!record) throw new Error(`L'entité ${e.id} n'a pas de composant ${type}.`);
    record.overrides[key] = value;
    if (record.def) {
      const { value: normalized } = normalizeProps(record.def.props, { ...record.baseProps, ...record.overrides });
      record.props = normalized as Record<string, unknown>;
    } else {
      record.props = { ...record.baseProps, ...record.overrides };
    }
    e.revision++;
    e.propsRevision++;
    try {
      record.instance?.onPropsChanged?.();
    } catch (err) {
      this.fault(e, record, err, 'changement de propriété');
    }
  }

  visibilityChanged(e: RuntimeEntity): void {
    for (const record of e.components.values()) {
      try {
        record.instance?.onVisibilityChanged?.(e.visible && e.enabled);
      } catch (err) {
        this.fault(e, record, err, 'visibilité');
      }
    }
    this.session.world?.markLightSourcesDirty();
  }

  /** Offers of an entity, decorated by its other behaviors (e.g. a lock annotating a door). */
  offers(e: RuntimeEntity): SourcedOffer[] {
    const out: SourcedOffer[] = [];
    if (!e.visible || !e.enabled) return out;
    for (const record of e.components.values()) {
      const inst = record.instance;
      if (!inst?.interaction || record.faulted) continue;
      try {
        const r = inst.interaction();
        const list = Array.isArray(r) ? r : r ? [r] : [];
        for (const offer of list) out.push({ offer, source: record.type });
      } catch (err) {
        this.fault(e, record, err, 'interaction');
      }
    }
    for (const so of out) {
      for (const record of e.components.values()) {
        if (record.type === so.source || !record.instance?.decorateOffer || record.faulted) continue;
        try {
          so.offer = record.instance.decorateOffer(so.offer, so.source);
        } catch (err) {
          this.fault(e, record, err, 'décoration');
        }
      }
    }
    out.sort((a, b) => (b.offer.priority ?? 0) - (a.offer.priority ?? 0));
    return out;
  }

  captureEntityState(e: RuntimeEntity): EntityState | null {
    const st: EntityState = {};
    if (e.spawned || e.transformChanged()) {
      st.position = [e.position.x, e.position.y, e.position.z];
      st.yaw = e.rotation[1];
    }
    if (!e.visible) st.visible = false;
    if (!e.enabled) st.enabled = false;
    for (const record of e.components.values()) {
      if (Object.keys(record.overrides).length > 0) (st.overrides ??= {})[record.type] = structuredClone(record.overrides);
      if (record.def?.state && record.state !== undefined) {
        (st.states ??= {})[record.type] = { version: record.def.state.version, state: structuredClone(record.state) };
      }
    }
    return Object.keys(st).length > 0 ? st : null;
  }
}
