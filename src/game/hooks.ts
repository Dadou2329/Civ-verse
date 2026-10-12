import { createContext, useContext, useEffect, useReducer, useSyncExternalStore } from 'react';
import type { GameController } from './controller';
import type { GameSession } from '@engine/core/sim/session';
import type { DialogueView } from '@engine/core/story/dialogue';
import type { QuestView } from '@engine/core/story/quests';
import type { InteractionTarget } from '@engine/core/sim/interaction';
import type { MessageParams } from '@engine/core/i18n/localizer';

export const ControllerContext = createContext<GameController | null>(null);

export function useController(): GameController {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('GameController absent du contexte React.');
  return c;
}

export function useSession(): GameSession {
  return useController().session;
}

/** Re-renders when the session signals a change (civ, scene, pause, loading...). */
export function useSessionTick(): number {
  const session = useSession();
  const [n, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const d = session.onChange(bump);
    return () => d.dispose();
  }, [session]);
  return n;
}

export function useT(): (key: string, params?: MessageParams) => string {
  const session = useSession();
  useSyncExternalStore(
    (cb) => session.i18n.onChange(cb),
    () => session.i18n.locale,
  );
  return (key, params) => session.t(key, params);
}

export function useDialogueView(): DialogueView | null {
  const session = useSession();
  return useSyncExternalStore(
    (cb) => session.dialogue.onChange(cb),
    () => session.dialogue.view(),
  );
}

export function useQuestViews(): QuestView[] {
  const session = useSession();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => session.quests.onChange(bump), [session]);
  useEffect(() => {
    const d = session.bus.on('var.changed', () => bump());
    return () => d.dispose();
  }, [session]);
  return session.quests.view();
}

export function useInteractionTarget(): InteractionTarget | null {
  const session = useSession();
  return useSyncExternalStore(
    (cb) => session.interaction.onChange(cb),
    () => session.interaction.target,
  );
}

/** Re-renders at a fixed interval (debug overlay, cooldowns). */
export function useInterval(ms: number): number {
  const [n, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(bump, ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}
