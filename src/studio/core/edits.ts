/**
 * Editing primitives shared by every Studio editor: document changes recorded as undoable
 * commands, immutable helpers for scene documents, and voxel edit commands.
 */
import type { EntityDoc, EnvironmentDoc, SceneDoc } from '@engine/core/content/schemas';
import type { SceneWorld } from '@engine/core/world/sceneWorld';
import { volumeFromDoc, volumeToDoc } from '@engine/core/world/sceneVoxels';
import type { Command, History } from './history';
import { nextRevision, type StudioProject } from './project';

/**
 * Records a change of a document: `produce` receives the current data and returns the new data
 * (return the same object to cancel). With a `mergeKey`, quick successive changes (typing,
 * dragging) form a single undo step.
 */
export function changeDoc<T>(project: StudioProject, history: History, path: string, label: string, produce: (data: T) => T, mergeKey?: string): boolean {
  const doc = project.require(path);
  const before = doc.data as T;
  const beforeRev = doc.revision;
  const after = produce(before);
  if (after === before) return false;
  const state = { after, afterRev: nextRevision() };
  const cmd: Command = {
    label,
    mergeKey: mergeKey ? `${path}|${mergeKey}` : undefined,
    apply: () => project.setData(path, state.after, state.afterRev),
    revert: () => project.setData(path, before, beforeRev),
    absorb: (next) => {
      const n = (next as unknown as { state: typeof state }).state;
      state.after = n.after;
      state.afterRev = n.afterRev;
    },
  };
  (cmd as unknown as { state: typeof state }).state = state;
  history.push(cmd);
  return true;
}

/** Deep copy of plain JSON data. */
export function clone<T>(v: T): T {
  return structuredClone(v);
}

// ------------------------------------------------------------------------------------------------
// Scene documents (immutable updates: untouched entities keep their identity)
// ------------------------------------------------------------------------------------------------

export function updateEntity(scene: SceneDoc, id: string, fn: (e: EntityDoc) => EntityDoc | void): SceneDoc {
  let changed = false;
  const entities = scene.entities.map((e) => {
    if (e.id !== id) return e;
    const copy = clone(e);
    const out = fn(copy) ?? copy;
    changed = true;
    return out;
  });
  return changed ? { ...scene, entities } : scene;
}

export function updateEntities(scene: SceneDoc, ids: readonly string[], fn: (e: EntityDoc) => EntityDoc | void): SceneDoc {
  const set = new Set(ids);
  let changed = false;
  const entities = scene.entities.map((e) => {
    if (!set.has(e.id)) return e;
    changed = true;
    const copy = clone(e);
    return fn(copy) ?? copy;
  });
  return changed ? { ...scene, entities } : scene;
}

export function addEntities(scene: SceneDoc, docs: EntityDoc[]): SceneDoc {
  return docs.length ? { ...scene, entities: [...scene.entities, ...docs] } : scene;
}

export function removeEntities(scene: SceneDoc, ids: readonly string[]): SceneDoc {
  const set = new Set(ids);
  const entities = scene.entities.filter((e) => !set.has(e.id));
  return entities.length === scene.entities.length ? scene : { ...scene, entities };
}

export function setEnvironment(scene: SceneDoc, env: EnvironmentDoc): SceneDoc {
  return { ...scene, environment: env };
}

/** A free entity id based on `base` ("lanterne", "lanterne_2", ...). */
export function uniqueEntityId(scene: SceneDoc, base: string, taken: Set<string> = new Set()): string {
  const clean = base.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'entite';
  const ids = new Set([...scene.entities.map((e) => e.id), ...taken]);
  if (!ids.has(clean)) return clean;
  const stem = clean.replace(/_\d+$/, '');
  for (let i = 2; ; i++) {
    const id = `${stem}_${i}`;
    if (!ids.has(id)) return id;
  }
}

// ------------------------------------------------------------------------------------------------
// Voxels
// ------------------------------------------------------------------------------------------------

/** [x, y, z, before, after] — block ids, null = air. */
export type VoxelChange = [number, number, number, string | null, string | null];

/**
 * Block edits. They apply to the open editor world when there is one (live meshing), otherwise
 * to the scene document's voxel data (undo after switching scenes).
 */
export function voxelCommand(project: StudioProject, path: string, label: string, changes: VoxelChange[], worldOf: (path: string) => SceneWorld | null): Command {
  const doc = project.require(path);
  const beforeRev = doc.revision;
  const afterRev = nextRevision();
  const write = (useAfter: boolean) => {
    const world = worldOf(path);
    if (world) {
      for (const [x, y, z, b, a] of changes) world.setBlock(x, y, z, useAfter ? a : b);
    } else {
      const scene = project.require(path).data as SceneDoc;
      const volume = volumeFromDoc(scene.voxels);
      for (const [x, y, z, b, a] of changes) volume.set(x, y, z, useAfter ? a : b);
      project.setData(path, { ...scene, voxels: volumeToDoc(volume) }, useAfter ? afterRev : beforeRev);
      return;
    }
    project.touch(path, useAfter ? afterRev : beforeRev);
  };
  return { label, apply: () => write(true), revert: () => write(false) };
}
