import type { ReactNode } from 'react';
import { useStudio } from '../hooks';
import type { Studio } from '../core/studio';
import type { StudioDoc } from '../core/project';
import type { FieldEnv } from '../fields/PropField';

export interface DocHandle<T> {
  studio: Studio;
  doc: StudioDoc;
  data: T;
  /** Records a change of the document (one undo step, merged with `merge` keys). */
  edit: (label: string, produce: (data: T) => T, merge?: string) => void;
  env: FieldEnv;
}

export function useDoc<T>(path: string): DocHandle<T> | null {
  const studio = useStudio();
  const doc = studio.doc(path);
  if (!doc || !doc.loaded || doc.data === null) return null;
  return {
    studio,
    doc,
    data: doc.data as T,
    edit: (label, produce, merge) => void studio.editDoc<T>(path, label, produce, merge),
    env: { studio, keyHint: `${doc.kind}.${doc.id}` },
  };
}

export function Row({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <div className="st-field">
      <div className="st-field__label" title={help}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Immutable list helpers. */
export function replaceAt<T>(list: readonly T[], i: number, v: T): T[] {
  const next = [...list];
  next[i] = v;
  return next;
}

export function moveItem<T>(list: readonly T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function removeAt<T>(list: readonly T[], i: number): T[] {
  return list.filter((_, k) => k !== i);
}

/** A free id in a list ("noeud", "noeud_2"...). */
export function freeId(existing: Iterable<string>, base: string): string {
  const set = new Set(existing);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}_${i}`)) return `${base}_${i}`;
}

export function ListTools({ index, count, onMove, onRemove, onDuplicate }: { index: number; count: number; onMove: (d: number) => void; onRemove: () => void; onDuplicate?: () => void }) {
  return (
    <span className="st-row" style={{ gap: 2 }}>
      <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Monter" disabled={index === 0} onClick={() => onMove(-1)}>
        ↑
      </button>
      <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Descendre" disabled={index === count - 1} onClick={() => onMove(1)}>
        ↓
      </button>
      {onDuplicate && (
        <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Dupliquer" onClick={onDuplicate}>
          ⧉
        </button>
      )}
      <button type="button" className="st-btn st-btn--small st-btn--ghost st-btn--danger" title="Supprimer" onClick={onRemove}>
        ✕
      </button>
    </span>
  );
}
