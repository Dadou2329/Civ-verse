/**
 * Rule engine: "QUAND <événement> [filtre] SI <condition> ALORS <actions> SINON <actions>".
 * Rules come from `content/logic/*.logic.json` (edited in the Studio's visual logic editor).
 */
import type { EventBus } from '../events/eventBus';
import type { LogicDoc, RuleDoc } from '../content/schemas';
import type { LogicInterpreter } from './interpreter';
import { matchEvent } from './interpreter';
import type { Disposable } from '../util/disposable';

export class RuleEngine {
  private rules: { rule: RuleDoc; file: string }[] = [];
  private sub: Disposable | null = null;
  readonly firedOnce = new Set<string>();

  constructor(
    private readonly bus: EventBus,
    private readonly interpreter: LogicInterpreter,
    private readonly currentScene: () => string | null,
  ) {}

  load(docs: readonly LogicDoc[]): void {
    this.unload();
    this.rules = docs.flatMap((d) => d.rules.map((rule) => ({ rule, file: d.id })));
    this.sub = this.bus.onAny((name, payload) => this.dispatch(name, payload));
  }

  unload(): void {
    this.sub?.dispose();
    this.sub = null;
    this.rules = [];
  }

  get count(): number {
    return this.rules.length;
  }

  private dispatch(name: string, payload: Record<string, unknown>): void {
    for (const { rule, file } of this.rules) {
      if (!rule.enabled) continue;
      const key = `${file}/${rule.id}`;
      if (rule.once && this.firedOnce.has(key)) continue;
      if (rule.scene && rule.scene !== this.currentScene()) continue;
      const scope = { event: { name, payload }, origin: `règle ${key}` };
      if (!matchEvent(rule.when, name, payload, scope)) continue;
      const pass = this.interpreter.test(rule.if ?? null, scope);
      this.interpreter.recordRule(scope.origin, rule.id, true, pass ? 'alors' : 'sinon');
      if (rule.once && pass) this.firedOnce.add(key);
      const actions = pass ? rule.then : (rule.else ?? []);
      if (actions.length) void this.interpreter.run(actions, scope);
    }
  }
}
