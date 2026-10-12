/**
 * Registry of logic building blocks: actions, conditions and documented events.
 *
 * The engine registers its "core.*" set; packs add theirs through definitions in their modules.
 * The Studio reads this registry to build its visual logic, dialogue, quest and cinematic editors.
 */
import type { PropSchema } from '../props/props';
import type { ActionDefinition, ConditionDefinition, EventDefinition } from '../packs/definitions';

interface Owned<T> {
  def: T;
  owner: string;
}

export class LogicRegistry {
  private actions = new Map<string, Owned<ActionDefinition>>();
  private conditions = new Map<string, Owned<ConditionDefinition>>();
  private events = new Map<string, Owned<EventDefinition>>();
  private _revision = 0;

  get revision(): number {
    return this._revision;
  }

  addAction(def: ActionDefinition, owner: string): void {
    this.assertFree(this.actions, def.id, owner, 'action');
    this.actions.set(def.id, { def, owner });
    this._revision++;
  }

  addCondition(def: ConditionDefinition, owner: string): void {
    this.assertFree(this.conditions, def.id, owner, 'condition');
    this.conditions.set(def.id, { def, owner });
    this._revision++;
  }

  addEvent(def: EventDefinition, owner: string): void {
    this.assertFree(this.events, def.id, owner, 'événement');
    this.events.set(def.id, { def, owner });
    this._revision++;
  }

  action(id: string): ActionDefinition | undefined {
    return this.actions.get(id)?.def;
  }

  condition(id: string): ConditionDefinition | undefined {
    return this.conditions.get(id)?.def;
  }

  event(id: string): EventDefinition | undefined {
    return this.events.get(id)?.def;
  }

  listActions(): ActionDefinition[] {
    return [...this.actions.values()].map((o) => o.def);
  }

  listConditions(): ConditionDefinition[] {
    return [...this.conditions.values()].map((o) => o.def);
  }

  listEvents(): EventDefinition[] {
    return [...this.events.values()].map((o) => o.def);
  }

  ownerOf(kind: 'action' | 'condition' | 'event', id: string): string | undefined {
    const map = kind === 'action' ? this.actions : kind === 'condition' ? this.conditions : this.events;
    return map.get(id)?.owner;
  }

  /** Removes everything a pack registered (called when a civilization unloads). */
  unregisterOwner(owner: string): void {
    for (const map of [this.actions, this.conditions, this.events] as Map<string, Owned<unknown>>[]) {
      for (const [id, o] of [...map]) if (o.owner === owner) map.delete(id);
    }
    this._revision++;
  }

  /** Schema of an action or condition type (for validation and editors). */
  schemaOf(kind: 'action' | 'condition', type: string): PropSchema | undefined {
    return kind === 'action' ? this.action(type)?.props : this.condition(type)?.props;
  }

  private assertFree<T>(map: Map<string, Owned<T>>, id: string, owner: string, what: string): void {
    const existing = map.get(id);
    if (existing && existing.owner !== owner) {
      throw new Error(`L'${what} "${id}" est déjà enregistré(e) par "${existing.owner}".`);
    }
  }
}
