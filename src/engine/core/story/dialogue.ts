/**
 * Dialogue runtime.
 *
 * Dialogues are graphs of nodes (speaker + localized line + actions) linked by `next`, conditional
 * `branches` and player `choices`. Nodes without text are routing nodes. The UI renders `view()`
 * and calls `advance()` / `choose()`; headless tests call the same methods.
 */
import type { DialogueDoc, DialogueNodeDoc } from '../content/schemas';
import type { LogicInterpreter } from '../logic/interpreter';
import type { EventBus } from '../events/eventBus';
import type { Logger } from '../util/logger';
import type { Disposable } from '../util/disposable';
import type { PresentationBus } from '../sim/presentation';

export interface DialogueChoiceView {
  id: string;
  text: string;
  enabled: boolean;
}

export interface DialogueView {
  dialogueId: string;
  nodeId: string;
  speakerId: string | null;
  speakerName: string | null;
  text: string;
  choices: DialogueChoiceView[];
  /** True when the line can be advanced (no choices). */
  canAdvance: boolean;
  entityId: string | null;
  isPlayer: boolean;
}

export interface DialogueHost {
  getDoc(id: string): DialogueDoc | undefined;
  interpreter: LogicInterpreter;
  bus: EventBus;
  t(key: string): string;
  /** Display name of a speaker id (entity id, 'player', 'narrator' or doc speaker key). */
  speakerName(speakerId: string, doc: DialogueDoc): string | null;
  /** Entity id a speaker refers to (for camera focus and animations), if any. */
  speakerEntity(speakerId: string, doc: DialogueDoc, fallback: string | null): string | null;
  lockPlayer(reason: string): Disposable;
  presentation: PresentationBus;
  log: Logger;
}

interface Active {
  doc: DialogueDoc;
  nodeId: string;
  entityId: string | null;
  resolve: (r: { lastNode: string | null }) => void;
  lock: Disposable;
  busy: boolean;
  token: number;
}

const MAX_HOPS = 200;

export class DialogueSystem {
  private active: Active | null = null;
  private currentView: DialogueView | null = null;
  private listeners = new Set<() => void>();
  private tokenCounter = 0;
  readonly seenSet = new Set<string>();
  readonly chosenSet = new Set<string>();

  constructor(private readonly host: DialogueHost) {}

  get isActive(): boolean {
    return this.active !== null;
  }

  view(): DialogueView | null {
    return this.currentView;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  seen(dialogueId: string, nodeId?: string): boolean {
    if (nodeId) return this.seenSet.has(`${dialogueId}/${nodeId}`);
    for (const k of this.seenSet) if (k.startsWith(`${dialogueId}/`)) return true;
    return false;
  }

  chose(dialogueId: string, choiceId: string): boolean {
    return this.chosenSet.has(`${dialogueId}/${choiceId}`);
  }

  start(dialogueId: string, opts: { entity?: string | null } = {}): Promise<{ lastNode: string | null }> {
    const doc = this.host.getDoc(dialogueId);
    if (!doc) {
      this.host.log.error(`Dialogue introuvable : ${dialogueId}`);
      return Promise.resolve({ lastNode: null });
    }
    if (this.active) this.finish(this.active.nodeId);
    return new Promise((resolve) => {
      const token = ++this.tokenCounter;
      this.active = {
        doc,
        nodeId: doc.start,
        entityId: opts.entity ?? null,
        resolve,
        lock: this.host.lockPlayer(`dialogue:${dialogueId}`),
        busy: false,
        token,
      };
      this.host.bus.emit('dialogue.started', { dialogueId, entityId: opts.entity ?? null });
      void this.enter(doc.start, token);
    });
  }

  /** Advances a line without choices. */
  advance(): void {
    const a = this.active;
    if (!a || a.busy || !this.currentView || !this.currentView.canAdvance) return;
    const node = this.node(a.doc, a.nodeId);
    if (!node) return this.finish(a.nodeId);
    const next = this.resolveNext(node, a);
    if (next) void this.enter(next, a.token);
    else this.finish(a.nodeId);
  }

  choose(choiceId: string): void {
    const a = this.active;
    if (!a || a.busy) return;
    const node = this.node(a.doc, a.nodeId);
    const choice = node?.choices?.find((c) => c.id === choiceId);
    const viewChoice = this.currentView?.choices.find((c) => c.id === choiceId);
    if (!node || !choice || !viewChoice || !viewChoice.enabled) {
      this.host.log.warn(`Choix indisponible : ${choiceId}`);
      return;
    }
    const token = a.token;
    a.busy = true;
    this.chosenSet.add(`${a.doc.id}/${choiceId}`);
    this.host.bus.emit('dialogue.choice', { dialogueId: a.doc.id, nodeId: node.id, choiceId });
    void (async () => {
      await this.host.interpreter.run(choice.actions, this.scope(a, `${node.id}:${choiceId}`));
      if (!this.active || this.active.token !== token) return;
      a.busy = false;
      // `next: null` ends the dialogue explicitly; an absent `next` falls through to the node's routing.
      const next = choice.next === null ? null : choice.next !== undefined ? choice.next : this.resolveNext(node, a);
      if (next) await this.enter(next, token);
      else this.finish(node.id);
    })();
  }

  /** Ends the current dialogue immediately (e.g. scene change). */
  abort(): void {
    if (this.active) this.finish(this.active.nodeId);
  }

  snapshot(): { seen: string[]; chosen: string[] } {
    return { seen: [...this.seenSet], chosen: [...this.chosenSet] };
  }

  restore(data: { seen: string[]; chosen: string[] }): void {
    this.seenSet.clear();
    this.chosenSet.clear();
    data.seen.forEach((s) => this.seenSet.add(s));
    data.chosen.forEach((s) => this.chosenSet.add(s));
  }

  private node(doc: DialogueDoc, id: string): DialogueNodeDoc | undefined {
    return doc.nodes.find((n) => n.id === id);
  }

  private scope(a: Active, where: string) {
    return { self: a.entityId, origin: `dialogue ${a.doc.id}/${where}` };
  }

  private resolveNext(node: DialogueNodeDoc, a: Active): string | null {
    if (node.end) return null;
    for (const b of node.branches ?? []) {
      if (this.host.interpreter.test(b.condition, this.scope(a, node.id))) return b.next;
    }
    return node.next ?? null;
  }

  private async enter(startId: string, token: number): Promise<void> {
    const a = this.active;
    if (!a || a.token !== token) return;
    let nodeId: string | null = startId;
    for (let hops = 0; nodeId && hops < MAX_HOPS; hops++) {
      const node = this.node(a.doc, nodeId);
      if (!node) {
        this.host.log.error(`Nœud de dialogue introuvable : ${a.doc.id}/${nodeId}`);
        this.finish(a.nodeId);
        return;
      }
      a.nodeId = node.id;
      a.busy = true;
      this.seenSet.add(`${a.doc.id}/${node.id}`);
      this.host.bus.emit('dialogue.node', { dialogueId: a.doc.id, nodeId: node.id });
      await this.host.interpreter.run(node.actions, this.scope(a, node.id));
      if (!this.active || this.active.token !== token) return;
      a.busy = false;
      const routing = !node.text && !(node.choices && node.choices.length > 0);
      if (routing) {
        nodeId = this.resolveNext(node, a);
        continue;
      }
      this.display(a, node);
      return;
    }
    this.finish(a.nodeId);
  }

  private display(a: Active, node: DialogueNodeDoc): void {
    const speakerId = node.speaker ?? null;
    const entity = speakerId ? this.host.speakerEntity(speakerId, a.doc, a.entityId) : null;
    if (entity && node.expression) this.host.presentation.emit({ type: 'expression', entity, expression: node.expression });
    if (entity && node.animation) this.host.presentation.emit({ type: 'animation', entity, name: node.animation, loop: false });
    const choices: DialogueChoiceView[] = [];
    for (const c of node.choices ?? []) {
      if (c.once && this.chosenSet.has(`${a.doc.id}/${c.id}`)) continue;
      const ok = this.host.interpreter.test(c.condition ?? null, this.scope(a, `${node.id}:${c.id}`));
      if (!ok && !c.showDisabled) continue;
      choices.push({ id: c.id, text: this.host.t(c.text), enabled: ok });
    }
    if ((node.choices?.length ?? 0) > 0 && choices.length === 0) {
      this.host.log.warn(`Aucun choix disponible dans ${a.doc.id}/${node.id} : le dialogue continue.`);
    }
    this.currentView = {
      dialogueId: a.doc.id,
      nodeId: node.id,
      speakerId,
      speakerName: speakerId ? this.host.speakerName(speakerId, a.doc) : null,
      text: node.text ? this.host.t(node.text) : '',
      choices,
      canAdvance: choices.length === 0,
      entityId: entity,
      isPlayer: speakerId === 'player',
    };
    this.emitChange();
  }

  private finish(lastNode: string | null): void {
    const a = this.active;
    if (!a) return;
    this.active = null;
    this.currentView = null;
    a.lock.dispose();
    this.host.bus.emit('dialogue.ended', { dialogueId: a.doc.id, lastNode });
    this.emitChange();
    a.resolve({ lastNode });
  }

  private emitChange(): void {
    for (const l of this.listeners) l();
  }
}
