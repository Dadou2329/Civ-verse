/**
 * Undo/redo for Civilization Studio.
 *
 * Every edit (entity moved, block placed, dialogue line typed, rule added...) is a command with
 * `apply` and `revert`. Continuous edits (dragging a gizmo, typing in a field) carry a `mergeKey`:
 * consecutive commands with the same key within a short delay become one undo step.
 */
export interface Command {
  /** French label shown in « Annuler : … ». */
  label: string;
  apply(): void;
  revert(): void;
  /** Consecutive commands with the same key (within `MERGE_MS`) merge into one step. */
  mergeKey?: string;
  /** Absorbs a following command with the same merge key (keeps this command's revert state). */
  absorb?(next: Command): void;
}

const MERGE_MS = 1200;
const MAX_STEPS = 300;

export class History {
  private undoStack: { cmd: Command; at: number }[] = [];
  private redoStack: Command[] = [];
  private listeners = new Set<() => void>();
  private sealed = false;

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  private group: { label: string; cmds: Command[] } | null = null;

  /**
   * Groups every command pushed inside `fn` into one undo step (an NPC added to the scene and
   * its name added to the locale table are undone together).
   */
  transaction<T>(label: string, fn: () => T): T {
    if (this.group) return fn();
    this.group = { label, cmds: [] };
    let result: T;
    try {
      result = fn();
    } finally {
      const g = this.group;
      this.group = null;
      if (g.cmds.length === 1) this.push(g.cmds[0]!, { applied: true });
      else if (g.cmds.length > 1) {
        const cmds = g.cmds;
        this.push(
          {
            label: g.label,
            apply: () => cmds.forEach((c) => c.apply()),
            revert: () => [...cmds].reverse().forEach((c) => c.revert()),
          },
          { applied: true },
        );
      }
    }
    return result;
  }

  /** Runs a command and records it. With `applied`, the change was already made (gizmo drag). */
  push(cmd: Command, opts: { applied?: boolean } = {}): void {
    if (!opts.applied) cmd.apply();
    if (this.group) {
      this.group.cmds.push(cmd);
      return;
    }
    const now = Date.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (!this.sealed && top && cmd.mergeKey && top.cmd.mergeKey === cmd.mergeKey && now - top.at < MERGE_MS && top.cmd.absorb) {
      top.cmd.absorb(cmd);
      top.at = now;
    } else {
      this.undoStack.push({ cmd, at: now });
      if (this.undoStack.length > MAX_STEPS) this.undoStack.shift();
    }
    this.sealed = false;
    this.redoStack = [];
    this.changed();
  }

  /** Ends the current merge group (field blur, mouse up). */
  seal(): void {
    this.sealed = true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.cmd.label ?? null;
  }

  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  undo(): boolean {
    const top = this.undoStack.pop();
    if (!top) return false;
    top.cmd.revert();
    this.redoStack.push(top.cmd);
    this.sealed = true;
    this.changed();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.apply();
    this.undoStack.push({ cmd, at: 0 });
    this.sealed = true;
    this.changed();
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.changed();
  }
}
