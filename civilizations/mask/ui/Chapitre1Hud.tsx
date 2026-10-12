import { defineHud, useT, useUiStore } from '@sdk/ui';
import './mask.css';

/**
 * Chapitre I : la jauge de réglage (automate de tri, roue d'entraînement) au-dessus du viseur, et
 * le chrono de la qualification en haut de l'écran.
 */
interface CalibrageView {
  title: string;
  help: string;
  wheel: boolean;
  needle: number;
  zone: [number, number];
  successes: number;
  needed: number;
  flash: 'hit' | 'miss' | null;
  waiting: boolean;
}

function CalibrageGauge() {
  const g = useUiStore<CalibrageView | null>('mask.calibrage');
  if (!g) return null;
  const pct = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(2)}%`;
  return (
    <div className={`mask-gauge ${g.flash ? `is-${g.flash}` : ''} ${g.waiting ? 'is-waiting' : ''}`} data-testid="mask-calibrage" role="meter" aria-valuenow={Math.round(g.needle * 100)}>
      <div className="mask-gauge__head">
        <span className="mask-gauge__title">{g.title}</span>
        <span className="mask-gauge__pips" aria-label={`${g.successes}/${g.needed}`}>
          {Array.from({ length: g.needed }, (_, i) => (
            <span key={i} className={`mask-gauge__pip ${i < g.successes ? 'is-done' : ''}`} />
          ))}
        </span>
      </div>
      <div className={`mask-gauge__dial ${g.wheel ? 'is-wheel' : ''}`}>
        <span className="mask-gauge__zone" style={{ left: pct(g.zone[0]), width: pct(g.zone[1] - g.zone[0]) }} />
        <span className="mask-gauge__needle" style={{ left: pct(g.needle) }} />
      </div>
      {g.help && <div className="mask-gauge__help">{g.help}</div>}
    </div>
  );
}

function ParcoursTimer() {
  const t = useT();
  const run = useUiStore<{ left: number; total: number } | null>('mask.parcours');
  if (!run) return null;
  const minutes = Math.floor(run.left / 60);
  const seconds = String(run.left % 60).padStart(2, '0');
  return (
    <div className={`mask-countdown mask-countdown--course ${run.left <= 10 ? 'is-urgent' : ''}`} data-testid="mask-parcours-timer" role="timer">
      <span className="mask-countdown__label">{t('mask.hud.parcours')}</span>
      <strong className="mask-countdown__time">{`${minutes}:${seconds}`}</strong>
    </div>
  );
}

export const calibrageHud = defineHud({ id: 'mask.calibrageHud', slot: 'center', component: CalibrageGauge });
export const parcoursHud = defineHud({ id: 'mask.parcoursHud', slot: 'top-center', component: ParcoursTimer });
