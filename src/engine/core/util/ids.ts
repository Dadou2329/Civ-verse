/**
 * Identifier conventions (validated everywhere content references something):
 * - asset ids:        "<pack>:<name>"      e.g. "door:lantern_blue", "core:stone"
 * - registered types: "<pack>.<name>"      e.g. "core.door", "memory.anchorShard"
 * - variables:        "<namespace>.<name>" e.g. "door.rank", "global.fragments.threshold"
 * - entity ids:       local to a scene     e.g. "mira", "gallery_gate"
 */
export const ASSET_ID_RE = /^[a-z][a-z0-9-]*:[a-z0-9_./-]+$/;
export const TYPE_ID_RE = /^[a-z][a-z0-9-]*\.[A-Za-z0-9_.]+$/;
export const LOCAL_ID_RE = /^[A-Za-z0-9_-]+$/;
export const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;

export function packOfAsset(id: string): string {
  const i = id.indexOf(':');
  return i > 0 ? id.slice(0, i) : '';
}

export function packOfType(id: string): string {
  const i = id.indexOf('.');
  return i > 0 ? id.slice(0, i) : '';
}

let counter = 0;
/** Generates a readable unique id with a prefix (editor-created entities). */
export function makeId(prefix: string, existing?: ReadonlySet<string>): string {
  const base = prefix.replace(/[^A-Za-z0-9_-]/g, '_') || 'entite';
  for (;;) {
    counter = (counter + 1) % 1_000_000;
    const id = `${base}_${Date.now().toString(36).slice(-4)}${counter.toString(36)}`;
    if (!existing?.has(id)) return id;
  }
}

/** Next free "<base>_<n>" id. */
export function nextNumberedId(base: string, existing: ReadonlySet<string>): string {
  if (!existing.has(base)) return base;
  for (let i = 2; ; i++) {
    const id = `${base}_${i}`;
    if (!existing.has(id)) return id;
  }
}
