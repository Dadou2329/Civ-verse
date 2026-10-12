import { useEffect, useState } from 'react';
import { defineHud, keyLabel, useCiv, useT, useUiStore } from '@sdk/ui';
import type { ChamberApi } from '../mechanics/chamber';
import { Gem } from './gem';
import './memory.css';

interface ChamberView {
  slots: (string | null)[];
  states: Record<string, string>;
  order: string[];
}

/** « Chambre mnésique 2/3 » with the three active shards as gems. */
function ChamberHud() {
  const ctx = useCiv();
  const t = useT();
  const view = useUiStore<ChamberView>('memory.chamber');
  if (!view) return null;
  const api = ctx.mechanics.get<ChamberApi>('memory.chamber');
  const filled = view.slots.filter(Boolean).length;
  const ownedAny = view.order.length > 0;
  if (!ownedAny) return null;
  return (
    <div className="mem-hud" data-testid="mem-chamber-hud">
      <div className="mem-hud__title">{t('memory.hud.chamber', { n: filled })}</div>
      <div className="mem-hud__slots">
        {view.slots.map((id, i) => (
          <span key={i} className={`mem-hud__slot ${id ? 'is-filled' : ''}`} title={id ? t(api.shard(id)?.name ?? '') : t('memory.hud.emptySlot')}>
            <Gem color={id ? api.shard(id)?.color : undefined} size={26} empty={!id} />
          </span>
        ))}
      </div>
      <span className="mem-hud__key">{keyLabel(ctx.settings.of<{ chamberKey: string }>('memory.chamber').chamberKey)}</span>
    </div>
  );
}

interface EchoView {
  id: string;
  n: number;
  title: string;
  lines: string[];
  duration: number;
  tint: string;
}

/** Translucent superimposition while an echo plays: title and the lines of the scene. */
function EchoOverlay() {
  const echo = useUiStore<EchoView | null>('memory.echo');
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    if (!echo) return;
    const per = (echo.duration * 1000) / Math.max(1, echo.lines.length);
    const id = setInterval(() => setStep((s) => s + 1), per);
    return () => clearInterval(id);
  }, [echo]);
  if (!echo) return null;
  const line = echo.lines[Math.min(step, echo.lines.length - 1)];
  return (
    <div className="mem-echo" style={{ ['--mem-tint' as string]: echo.tint }} data-testid="mem-echo" aria-live="polite">
      <div className="mem-echo__veil" />
      <div className="mem-echo__caption">
        {echo.title && <div className="mem-echo__title">{echo.title}</div>}
        {line && (
          <p key={step} className="mem-echo__line">
            {line}
          </p>
        )}
      </div>
    </div>
  );
}

/** What a shard says when touched (« Ne me laisse pas me vendre une deuxième fois »). */
function TouchCaption() {
  const touch = useUiStore<{ id: string; text: string; n: number }>('memory.touch');
  const [shown, setShown] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    if (!touch) return;
    setShown(touch);
    const id = setTimeout(() => setShown(null), 5200);
    return () => clearTimeout(id);
  }, [touch]);
  if (!shown) return null;
  return (
    <div key={shown.n} className="mem-touch" data-testid="mem-touch">
      {shown.text}
    </div>
  );
}

export const chamberHud = defineHud({ id: 'memory.chamberHud', slot: 'top-left', component: ChamberHud });
export const echoHud = defineHud({ id: 'memory.echoOverlay', slot: 'overlay', component: EchoOverlay });
export const touchHud = defineHud({ id: 'memory.touch', slot: 'bottom-center', order: -1, component: TouchCaption });
