/**
 * Quest runtime.
 *
 * Quests have stages; stages have objectives completed explicitly (actions), by conditions
 * re-evaluated whenever the game state changes, or by matching events. A stage completes when all
 * (or any, for alternative solutions) required objectives are done. State, history and the
 * tracked quest are saved with the civilization.
 */
import type { QuestDoc, StageDoc } from '../content/schemas';
import type { LogicInterpreter } from '../logic/interpreter';
import { matchEvent } from '../logic/interpreter';
import type { EventBus } from '../events/eventBus';
import type { Logger } from '../util/logger';
import type { QuestStatus } from '../sim/api';
import type { JsonValue } from '../util/json';

export interface QuestState {
  status: QuestStatus;
  stage: string | null;
  /** Completed objectives as "stage/objective". */
  done: string[];
  startedAt: number | null;
  finishedAt: number | null;
  /** Journal entries: localization keys of stage descriptions reached, in order. */
  history: string[];
}

export interface QuestObjectiveView {
  id: string;
  text: string;
  done: boolean;
  optional: boolean;
  progress: string | null;
  /** Entity marked on screen while the quest is tracked. */
  target: string | null;
  /** Scene of the target (null: the current scene). */
  targetScene: string | null;
}

export interface QuestView {
  id: string;
  title: string;
  summary: string;
  kind: 'main' | 'side';
  status: QuestStatus;
  stageText: string | null;
  objectives: QuestObjectiveView[];
  history: string[];
  tracked: boolean;
}

export interface QuestHost {
  interpreter: LogicInterpreter;
  bus: EventBus;
  t(key: string, params?: Record<string, string | number>): string;
  notify(text: string, kind: 'quest' | 'success' | 'warning'): void;
  readVar(name: string): JsonValue | undefined;
  now(): number;
  log: Logger;
}

export class QuestSystem {
  private docs = new Map<string, QuestDoc>();
  private states = new Map<string, QuestState>();
  private trackedId: string | null = null;
  private evaluating = false;
  private dirty = false;
  private listeners = new Set<() => void>();

  constructor(private readonly host: QuestHost) {}

  load(docs: readonly QuestDoc[]): void {
    this.docs = new Map(docs.map((d) => [d.id, d]));
    this.states.clear();
    this.trackedId = null;
  }

  ids(): string[] {
    return [...this.docs.values()].sort((a, b) => a.order - b.order).map((d) => d.id);
  }

  doc(id: string): QuestDoc | undefined {
    return this.docs.get(id);
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  state(id: string): QuestState {
    return this.states.get(id) ?? { status: 'inactive', stage: null, done: [], startedAt: null, finishedAt: null, history: [] };
  }

  status(id: string): QuestStatus {
    return this.state(id).status;
  }

  get tracked(): string | null {
    return this.trackedId;
  }

  track(id: string | null): void {
    this.trackedId = id;
    this.changed();
  }

  start(id: string): void {
    const doc = this.docs.get(id);
    if (!doc) {
      this.host.log.error(`Quête inconnue : ${id}`);
      return;
    }
    if (this.status(id) !== 'inactive') return;
    const first = doc.stages[0]!;
    // Objectives completed before the quest started (e.g. a place visited early) are kept.
    const early = this.states.get(id)?.done ?? [];
    this.states.set(id, {
      status: 'active',
      stage: first.id,
      done: [...early],
      startedAt: this.host.now(),
      finishedAt: null,
      history: [first.description],
    });
    if (!this.trackedId || this.status(this.trackedId) !== 'active' || (doc.kind === 'main' && this.docs.get(this.trackedId)?.kind !== 'main')) {
      this.trackedId = id;
    }
    this.host.notify(this.host.t('core.quest.started', { title: this.host.t(doc.title) }), 'quest');
    this.host.bus.emit('quest.started', { questId: id });
    this.host.bus.emit('quest.stageChanged', { questId: id, stageId: first.id, previous: null });
    void this.host.interpreter.run(doc.onStart, { origin: `quête ${id}/début` });
    this.changed();
    if (early.length) this.checkStage(id);
    this.requestEvaluation();
  }

  stage(id: string): string | null {
    return this.state(id).stage;
  }

  setStage(id: string, stageId: string): void {
    const doc = this.docs.get(id);
    const st = this.states.get(id);
    if (!doc) {
      this.host.log.error(`Quête inconnue : ${id}`);
      return;
    }
    if (!st || st.status === 'inactive') {
      this.start(id);
      if (this.states.get(id)?.status !== 'active') return;
      return this.setStage(id, stageId);
    }
    const stage = doc.stages.find((s) => s.id === stageId);
    if (!stage) {
      this.host.log.error(`Étape inconnue : ${id}/${stageId}`);
      return;
    }
    if (st.status !== 'active' || st.stage === stageId) return;
    const previous = st.stage;
    st.stage = stageId;
    st.history.push(stage.description);
    this.host.bus.emit('quest.stageChanged', { questId: id, stageId, previous });
    this.host.notify(this.host.t('core.quest.updated', { title: this.host.t(doc.title) }), 'quest');
    this.changed();
    this.requestEvaluation();
  }

  isObjectiveDone(id: string, objectiveId: string): boolean {
    return this.state(id).done.some((k) => k === objectiveId || k.endsWith(`/${objectiveId}`));
  }

  completeObjective(id: string, objectiveId: string): void {
    const doc = this.docs.get(id);
    const st = this.states.get(id);
    if (!doc) {
      this.host.log.error(`Quête inconnue : ${id}`);
      return;
    }
    // The objective may belong to the current stage or to a later one (completed ahead of time).
    const stage = doc.stages.find((s) => s.objectives.some((o) => o.id === objectiveId));
    if (!stage) {
      this.host.log.error(`Objectif inconnu : ${id}/${objectiveId}`);
      return;
    }
    const key = `${stage.id}/${objectiveId}`;
    if (!st) {
      // Not started yet: remember it, the quest will start with this objective done.
      this.states.set(id, { status: 'inactive', stage: null, done: [key], startedAt: null, finishedAt: null, history: [] });
      this.host.bus.emit('quest.objectiveCompleted', { questId: id, objectiveId });
      this.changed();
      return;
    }
    if (st.status === 'inactive') {
      if (!st.done.includes(key)) st.done.push(key);
      return;
    }
    if (st.status !== 'active') return;
    if (st.done.includes(key)) return;
    st.done.push(key);
    const obj = stage.objectives.find((o) => o.id === objectiveId)!;
    if (stage.id === st.stage && !obj.hidden) {
      this.host.notify(this.host.t('core.quest.objectiveDone', { text: this.host.t(obj.text) }), 'success');
    }
    this.host.bus.emit('quest.objectiveCompleted', { questId: id, objectiveId });
    this.changed();
    this.checkStage(id);
  }

  complete(id: string): void {
    const doc = this.docs.get(id);
    const st = this.states.get(id);
    if (!doc) return this.host.log.error(`Quête inconnue : ${id}`);
    if (st && st.status !== 'active' && st.status !== 'inactive') return;
    const state: QuestState = st ?? { status: 'active', stage: null, done: [], startedAt: this.host.now(), finishedAt: null, history: [] };
    state.startedAt ??= this.host.now();
    state.status = 'completed';
    state.finishedAt = this.host.now();
    this.states.set(id, state);
    if (this.trackedId === id) this.trackedId = this.nextTrackable();
    this.host.notify(this.host.t('core.quest.completed', { title: this.host.t(doc.title) }), 'success');
    this.host.bus.emit('quest.completed', { questId: id });
    void this.host.interpreter.run(doc.onComplete, { origin: `quête ${id}/fin` });
    this.changed();
    this.requestEvaluation();
  }

  fail(id: string): void {
    const doc = this.docs.get(id);
    const st = this.states.get(id);
    if (!doc || !st || st.status !== 'active') return;
    st.status = 'failed';
    st.finishedAt = this.host.now();
    if (this.trackedId === id) this.trackedId = this.nextTrackable();
    this.host.notify(this.host.t('core.quest.failed', { title: this.host.t(doc.title) }), 'warning');
    this.host.bus.emit('quest.failed', { questId: id });
    void this.host.interpreter.run(doc.onFail, { origin: `quête ${id}/échec` });
    this.changed();
  }

  active(): string[] {
    return this.ids().filter((id) => this.status(id) === 'active');
  }

  /** Re-evaluates conditions and event matchers (called on every gameplay event). */
  evaluate(eventName?: string, payload?: Record<string, unknown>): void {
    if (this.evaluating) {
      this.dirty = true;
      return;
    }
    this.evaluating = true;
    try {
      let rounds = 0;
      do {
        this.dirty = false;
        this.evaluateOnce(eventName, payload);
        eventName = undefined;
        payload = undefined;
      } while (this.dirty && ++rounds < 20);
    } finally {
      this.evaluating = false;
    }
  }

  private requestEvaluation(): void {
    if (this.evaluating) this.dirty = true;
    else this.evaluate();
  }

  private evaluateOnce(eventName?: string, payload?: Record<string, unknown>): void {
    for (const doc of this.docs.values()) {
      const st = this.states.get(doc.id);
      const status = st?.status ?? 'inactive';
      if (status === 'inactive') {
        const byEvent = eventName && doc.startOn ? matchEvent(doc.startOn, eventName, payload ?? {}) : false;
        const byCond = doc.startWhen ? this.host.interpreter.test(doc.startWhen, { origin: `quête ${doc.id}/démarrage` }) : false;
        if (doc.autoStart || byEvent || byCond) this.start(doc.id);
        continue;
      }
      if (status !== 'active' || !st) continue;
      if (doc.failWhen && this.host.interpreter.test(doc.failWhen, { origin: `quête ${doc.id}/échec` })) {
        this.fail(doc.id);
        continue;
      }
      const stage = doc.stages.find((s) => s.id === st.stage);
      if (!stage) continue;
      for (const obj of stage.objectives) {
        const key = `${stage.id}/${obj.id}`;
        if (st.done.includes(key)) continue;
        const scope = { origin: `quête ${doc.id}/${obj.id}`, event: eventName ? { name: eventName, payload: payload ?? {} } : null };
        const byEvent = eventName && obj.completeOn ? matchEvent(obj.completeOn, eventName, payload ?? {}, scope) : false;
        const byCond = obj.completeWhen ? this.host.interpreter.test(obj.completeWhen, scope) : false;
        if (byEvent || byCond) this.completeObjective(doc.id, obj.id);
      }
    }
  }

  private checkStage(id: string): void {
    const doc = this.docs.get(id)!;
    const st = this.states.get(id)!;
    if (st.status !== 'active') return;
    const stage = doc.stages.find((s) => s.id === st.stage);
    if (!stage) return;
    if (!this.stageComplete(stage, st)) return;
    void this.finishStage(doc, stage);
  }

  private stageComplete(stage: StageDoc, st: QuestState): boolean {
    const required = stage.objectives.filter((o) => !o.optional);
    if (required.length === 0) return stage.objectives.some((o) => st.done.includes(`${stage.id}/${o.id}`));
    const isDone = (o: { id: string }) => st.done.includes(`${stage.id}/${o.id}`);
    return stage.completion === 'any' ? required.some(isDone) : required.every(isDone);
  }

  private async finishStage(doc: QuestDoc, stage: StageDoc): Promise<void> {
    const st = this.states.get(doc.id)!;
    const index = doc.stages.findIndex((s) => s.id === stage.id);
    const nextId = stage.next === undefined ? (doc.stages[index + 1]?.id ?? null) : stage.next;
    // Move on synchronously so that re-entrant evaluations see the new stage.
    if (nextId) {
      const previous = st.stage;
      const nextStage = doc.stages.find((s) => s.id === nextId);
      if (!nextStage) {
        this.host.log.error(`Étape suivante introuvable : ${doc.id}/${nextId}`);
        return;
      }
      st.stage = nextId;
      st.history.push(nextStage.description);
      this.host.bus.emit('quest.stageChanged', { questId: doc.id, stageId: nextId, previous });
      this.changed();
      await this.host.interpreter.run(stage.onComplete, { origin: `quête ${doc.id}/${stage.id}` });
      this.requestEvaluation();
      // Objectives of the new stage may already be satisfied.
      this.checkStage(doc.id);
    } else {
      await this.host.interpreter.run(stage.onComplete, { origin: `quête ${doc.id}/${stage.id}` });
      this.complete(doc.id);
    }
  }

  private nextTrackable(): string | null {
    return this.active()[0] ?? null;
  }

  view(): QuestView[] {
    const out: QuestView[] = [];
    for (const id of this.ids()) {
      const doc = this.docs.get(id)!;
      const st = this.states.get(id);
      if (!st || st.status === 'inactive') continue;
      const stage = doc.stages.find((s) => s.id === st.stage) ?? null;
      const objectives: QuestObjectiveView[] = [];
      if (stage && st.status === 'active') {
        for (const o of stage.objectives) {
          if (o.hidden) continue;
          let progress: string | null = null;
          if (o.progress) {
            const v = this.host.readVar(o.progress.var);
            progress = `${typeof v === 'number' ? Math.min(v, o.progress.count) : 0}/${o.progress.count}`;
          }
          objectives.push({
            id: o.id,
            text: this.host.t(o.text),
            done: st.done.includes(`${stage.id}/${o.id}`),
            optional: !!o.optional,
            progress,
            target: o.target ?? null,
            targetScene: o.targetScene ?? null,
          });
        }
      }
      out.push({
        id,
        title: this.host.t(doc.title),
        summary: this.host.t(doc.summary),
        kind: doc.kind,
        status: st.status,
        stageText: stage ? this.host.t(stage.description) : null,
        objectives,
        history: st.history.map((k) => this.host.t(k)),
        tracked: this.trackedId === id,
      });
    }
    return out;
  }

  snapshot(): { states: Record<string, QuestState>; tracked: string | null } {
    const states: Record<string, QuestState> = {};
    for (const [id, s] of this.states) states[id] = structuredClone(s);
    return { states, tracked: this.trackedId };
  }

  restore(data: { states: Record<string, QuestState>; tracked: string | null }): void {
    this.states.clear();
    for (const [id, s] of Object.entries(data.states)) {
      if (!this.docs.has(id)) {
        this.host.log.warn(`Sauvegarde : quête "${id}" inconnue, ignorée.`);
        continue;
      }
      const doc = this.docs.get(id)!;
      const state = structuredClone(s);
      // A stage removed by a content update falls back to the first stage (never silently lost).
      if (state.stage && !doc.stages.some((st) => st.id === state.stage)) {
        this.host.log.warn(`Sauvegarde : étape "${state.stage}" de ${id} inconnue, retour à la première étape.`);
        state.stage = doc.stages[0]!.id;
      }
      this.states.set(id, state);
    }
    this.trackedId = data.tracked && this.docs.has(data.tracked) ? data.tracked : null;
    this.changed();
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}
