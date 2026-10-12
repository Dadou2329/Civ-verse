import { useCallback, useEffect, useMemo, useState } from 'react';
import { definePanel, useCiv, useT, type PanelProps } from '@sdk/ui';
import type { ImprintApi } from '../mechanics/imprint';
import { Glyph } from './glyphs';
import './door.css';

/**
 * KeyImprint mini-game: three dials to align on the engraving of the gallery gate. A dial clicks
 * (its lamp lights up) when it reaches the right notch; « Empreindre » strikes the plaque.
 * Keyboard: ←/→ turn the selected dial, ↑/↓ or Tab change dial, Entrée imprints, Échap cancels.
 */
function ImprintPanel({ close }: PanelProps) {
  const ctx = useCiv();
  const t = useT();
  const api = ctx.mechanics.get<ImprintApi>('door.keyImprint');
  const symbols = api.symbols;
  const [dials, setDials] = useState<number[]>([3, 5, 1]);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(0);
  const [done, setDone] = useState(false);
  const clicks = useMemo(() => api.check(dials), [api, dials]);
  const hint = api.hint();

  const turn = useCallback(
    (i: number, delta: number) => {
      if (done) return;
      setDials((d) => {
        const next = [...d];
        next[i] = (next[i]! + delta + symbols.length) % symbols.length;
        const ok = api.check(next)[i];
        ctx.audio.play(ok ? 'door:dial_set' : 'door:dial_tick');
        return next;
      });
    },
    [api, ctx, done, symbols.length],
  );

  const strike = useCallback(() => {
    if (done) return;
    if (api.submit(dials)) {
      setDone(true);
      setTimeout(() => close({ success: true }), 900);
    } else {
      ctx.audio.play('door:access_denied');
      setFailed((n) => n + 1);
    }
  }, [api, ctx, dials, close, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        close({ success: false });
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') turn(selected, -1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') turn(selected, 1);
      else if (e.code === 'ArrowUp' || (e.code === 'Tab' && e.shiftKey)) setSelected((s) => (s + 2) % 3);
      else if (e.code === 'ArrowDown' || e.code === 'Tab') setSelected((s) => (s + 1) % 3);
      else if (e.code === 'Enter' || e.code === 'Space') strike();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, selected, strike, turn]);

  return (
    <div className={`cv-modal door-imprint ${done ? 'is-done' : ''}`} data-testid="door-imprint">
      <h2>{t('door.imprint.title')}</h2>
      <p className="door-imprint__intro">{t('door.imprint.intro')}</p>
      <div className="door-imprint__dials">
        {dials.map((value, i) => (
          <div
            key={i}
            className={`door-dial ${selected === i ? 'is-selected' : ''} ${clicks[i] ? 'is-set' : ''}`}
            onClick={() => setSelected(i)}
            onWheel={(e) => turn(i, e.deltaY > 0 ? 1 : -1)}
            data-testid={`door-dial-${i}`}
          >
            <div className="door-dial__lamp" aria-hidden="true" />
            <div className="door-dial__face">
              {symbols.map((s, k) => {
                const angle = ((k - value) / symbols.length) * Math.PI * 2;
                return (
                  <span
                    key={s}
                    className={`door-dial__glyph ${k === value ? 'is-current' : ''}`}
                    style={{ transform: `translate(${Math.sin(angle) * 52}px, ${-Math.cos(angle) * 52}px)` }}
                  >
                    <Glyph name={s} size={k === value ? 30 : 20} />
                  </span>
                );
              })}
            </div>
            <div className="door-dial__name">{t(`door.dial.${symbols[value]}`)}</div>
            <div className="door-dial__buttons">
              <button type="button" className="cv-button cv-button--ghost" onClick={() => turn(i, -1)} aria-label={t('door.imprint.turnLeft')}>
                ◀
              </button>
              <button type="button" className="cv-button cv-button--ghost" onClick={() => turn(i, 1)} aria-label={t('door.imprint.turnRight')}>
                ▶
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="door-imprint__hint">{hint ? t('door.imprint.hintKnown', { a: t(`door.dial.${hint[0]}`), b: t(`door.dial.${hint[1]}`), c: t(`door.dial.${hint[2]}`) }) : t('door.imprint.hintUnknown')}</p>
      {failed > 0 && !done && <p className="door-imprint__fail">{t('door.imprint.fail')}</p>}
      {done && <p className="door-imprint__ok">{t('door.imprint.success')}</p>}
      <p className="cv-muted door-imprint__keys">{t('door.imprint.keys')}</p>
      <div className="cv-modal__actions">
        <button type="button" className="cv-button cv-button--ghost" onClick={() => close({ success: false })}>
          {t('door.imprint.cancel')}
        </button>
        <button type="button" className="cv-button cv-button--primary" onClick={strike} disabled={done} data-testid="door-imprint-strike">
          {t('door.imprint.strike')}
        </button>
      </div>
    </div>
  );
}

export const imprintPanel = definePanel({ id: 'door.imprint', component: ImprintPanel, title: 'door.imprint.title' });
