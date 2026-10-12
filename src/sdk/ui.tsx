/**
 * React side of the SDK: civilization HUD elements and panels.
 *
 *   export const rankPlaque = defineHud({ id: 'door.rankPlaque', slot: 'top-left', component: RankPlaque });
 *   function RankPlaque() { const rank = useVar<number>('door.rank'); ... }
 *
 * Components render inside the game UI with the civilization's theme (CSS variables
 * --civ-accent, --civ-panel, --civ-font...). All visible text must come from useT().
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ComponentType } from 'react';
import type { CivContext, HudSlot } from '../engine/core/sim/api';
import type { HudDefinition, PanelDefinition } from '../engine/core/packs/definitions';
import type { ConditionData } from '../engine/core/logic/types';
import type { JsonValue } from '../engine/core/util/json';
import type { MessageParams } from '../engine/core/i18n/localizer';

/**
 * French label of a physical key code, following the player's keyboard layout when the browser
 * tells it ("KeyC" → « C », "KeyQ" → « A » on AZERTY, "Space" → « Espace »). Use it to show the key
 * a civilization binds (settings can change it) instead of writing the letter in a text.
 */
export { keyLabel } from '../engine/input/inputManager';

/** Provided by the game UI around every civilization component. */
export const CivUiContext = createContext<CivContext | null>(null);

export function useCiv(): CivContext {
  const ctx = useContext(CivUiContext);
  if (!ctx) throw new Error('useCiv() doit être utilisé dans un composant de civilisation.');
  return ctx;
}

/** Translation function bound to the active civilization (re-renders on locale change). */
export function useT(): (key: string, params?: MessageParams) => string {
  const ctx = useCiv();
  return (key, params) => ctx.t(key, params);
}

/** Reactive story variable. */
export function useVar<T extends JsonValue = JsonValue>(name: string): T | undefined {
  const ctx = useCiv();
  return useSyncExternalStore(
    (cb) => {
      const d = name.startsWith('global.') ? ctx.events.on('multiverse.fragmentAcquired', cb) : ctx.vars.watch(name, cb);
      return () => d.dispose();
    },
    () => ctx.vars.get<T>(name),
  );
}

/** Reactive value of the civilization UI store (ctx.ui.store). */
export function useUiStore<T = unknown>(key: string): T | undefined {
  const ctx = useCiv();
  return useSyncExternalStore(
    (cb) => {
      const d = ctx.ui.store.subscribe(key, cb);
      return () => d.dispose();
    },
    () => ctx.ui.store.get<T>(key),
  );
}

/** Re-renders when any of the given events fires (for derived HUD values). */
export function useEventRefresh(events: string[]): number {
  const ctx = useCiv();
  const [n, setN] = useState(0);
  useEffect(() => {
    const subs = events.map((e) => ctx.events.on(e, () => setN((x) => x + 1)));
    return () => subs.forEach((s) => s.dispose());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, events.join('|')]);
  return n;
}

export interface PanelProps {
  /** Props passed to ctx.ui.openPanel(id, props). */
  props: Record<string, unknown>;
  /** Closes the panel, resolving openPanel() with `result`. */
  close: (result?: unknown) => void;
}

export function defineHud(def: { id: string; slot: HudSlot; order?: number; component: ComponentType; visibleWhen?: ConditionData | null }): HudDefinition {
  return { __kind: 'hud', ...def, component: def.component as unknown as HudDefinition['component'] };
}

export function definePanel(def: { id: string; component: ComponentType<PanelProps>; pausesGame?: boolean; title?: string }): PanelDefinition {
  return { __kind: 'panel', ...def, component: def.component as unknown as PanelDefinition['component'] };
}
