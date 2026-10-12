/**
 * Executes data-driven logic: action lists and conditions stored in content files (rules,
 * dialogues, quests, cinematics, interactables...). Action and condition types come from the
 * LogicRegistry, so packs extend the language without touching this interpreter.
 *
 * - String props may reference the logic scope: "$self", "$player", "$event.<field>".
 * - Each action list runs sequentially; async actions (waits, walks, dialogues) are awaited.
 * - A failing action stops its list and is reported with its origin (never silently ignored).
 * - Executed actions and rules, and conditions that fail to evaluate, are recorded in a ring
 *   buffer shown by the F3 debug overlay; failures are also logged (the Studio mirrors the log
 *   in its journal during a playtest).
 */
import type { ActionDefinition, ConditionDefinition } from '../packs/definitions';
import type { ActionData, ConditionData, EventMatch } from './types';
import type { LogicRegistry } from './registry';
import type { CivContext, LogicScope } from '../sim/api';
import type { Logger } from '../util/logger';
import { normalizeProps } from '../props/props';
import { deepEqual, getPath } from '../util/json';
import { toError } from '../util/assert';

export interface TraceEntry {
  time: number;
  origin: string;
  kind: 'action' | 'condition' | 'rule';
  type: string;
  ok: boolean;
  detail?: string;
}

const TRACE_CAPACITY = 300;

export function resolveRef(value: unknown, scope: LogicScope | undefined): unknown {
  if (typeof value !== 'string' || !value.startsWith('$')) return value;
  if (value === '$self') return scope?.self ?? '';
  if (value === '$player') return 'player';
  if (value.startsWith('$event.')) return getPath(scope?.event?.payload ?? {}, value.slice(7));
  return value;
}

export function matchEvent(match: EventMatch, name: string, payload: Record<string, unknown>, scope?: LogicScope): boolean {
  if (match.event !== name && match.event !== '*') return false;
  if (!match.where) return true;
  for (const [k, expected] of Object.entries(match.where)) {
    if (!deepEqual(getPath(payload, k), resolveRef(expected, scope))) return false;
  }
  return true;
}

export class LogicInterpreter {
  private trace: TraceEntry[] = [];
  private listeners = new Set<(e: TraceEntry) => void>();

  constructor(
    private readonly registry: LogicRegistry,
    private readonly getCtx: () => CivContext | null,
    private readonly log: Logger,
    private readonly now: () => number,
  ) {}

  traces(): readonly TraceEntry[] {
    return this.trace;
  }

  onTrace(cb: (e: TraceEntry) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private record(e: TraceEntry): void {
    this.trace.push(e);
    if (this.trace.length > TRACE_CAPACITY) this.trace.splice(0, this.trace.length - TRACE_CAPACITY);
    for (const l of this.listeners) l(e);
  }

  private prepare(schemaOwner: 'action' | 'condition', data: ActionData | ConditionData, scope: LogicScope | undefined) {
    const def = schemaOwner === 'action' ? this.registry.action(data.type) : this.registry.condition(data.type);
    if (!def) return null;
    const { type: _type, note: _note, ...raw } = data as ActionData;
    const { value, issues } = normalizeProps(def.props, raw);
    for (const issue of issues) {
      if (issue.severity === 'error') this.log.warn(`${data.type} : ${issue.path} — ${issue.message}`);
    }
    const props = value as Record<string, unknown>;
    for (const key of Object.keys(props)) props[key] = resolveRef(props[key], scope);
    return { def, props };
  }

  async run(actions: readonly ActionData[] | null | undefined, scope: LogicScope = {}): Promise<void> {
    if (!actions || actions.length === 0) return;
    const ctx = this.getCtx();
    if (!ctx) {
      this.log.warn(`Actions ignorées (${scope.origin ?? 'origine inconnue'}) : aucune civilisation active.`);
      return;
    }
    for (const action of actions) {
      const prepared = this.prepare('action', action, scope);
      const origin = scope.origin ?? 'logique';
      if (!prepared) {
        this.record({ time: this.now(), origin, kind: 'action', type: action.type, ok: false, detail: 'type inconnu' });
        this.log.error(`Action inconnue "${action.type}" (${origin}).`);
        return;
      }
      const def = prepared.def as ActionDefinition;
      if (scope.skipping && def.essential === false) continue;
      try {
        await def.run(ctx, prepared.props as never, scope);
        this.record({ time: this.now(), origin, kind: 'action', type: action.type, ok: true });
      } catch (err) {
        const e = toError(err);
        this.record({ time: this.now(), origin, kind: 'action', type: action.type, ok: false, detail: e.message });
        this.log.error(`Échec de l’action "${action.type}" (${origin}) : ${e.message}`, e);
        return;
      }
    }
  }

  test(condition: ConditionData | null | undefined, scope: LogicScope = {}): boolean {
    if (!condition) return true;
    const ctx = this.getCtx();
    if (!ctx) return false;
    const origin = scope.origin ?? 'logique';
    const prepared = this.prepare('condition', condition, scope);
    if (!prepared) {
      this.record({ time: this.now(), origin, kind: 'condition', type: condition.type, ok: false, detail: 'type inconnu' });
      this.log.error(`Condition inconnue "${condition.type}" (${origin}).`);
      return false;
    }
    try {
      const def = prepared.def as ConditionDefinition;
      return !!def.test(ctx, prepared.props as never, scope);
    } catch (err) {
      const e = toError(err);
      this.record({ time: this.now(), origin, kind: 'condition', type: condition.type, ok: false, detail: e.message });
      this.log.error(`Échec de la condition "${condition.type}" (${origin}) : ${e.message}`, e);
      return false;
    }
  }

  recordRule(origin: string, ruleId: string, ok: boolean, detail?: string): void {
    this.record({ time: this.now(), origin, kind: 'rule', type: ruleId, ok, detail });
  }
}
