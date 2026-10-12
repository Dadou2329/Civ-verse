import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Studio } from './core/studio';
import type { EditorViewport } from './viewport/editorViewport';

export const StudioContext = createContext<Studio | null>(null);

/** The Studio controller; components re-render when it signals a change. */
export function useStudio(): Studio {
  const s = useContext(StudioContext);
  if (!s) throw new Error('Studio absent du contexte React.');
  useSyncExternalStore(s.subscribe, s.getVersion);
  return s;
}

/** The 3D viewport, once created (block palette, « Ajouter » placement, cinematic preview). */
export const viewportRef: { current: EditorViewport | null } = { current: null };
