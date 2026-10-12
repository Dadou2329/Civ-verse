import { defineHud, useT, useUiStore, useVar } from '@sdk/ui';
import './mask.css';

/**
 * La plaque de rang : le rang civique du héros (ce que la ville lui permet), et les rangs qu'il
 * connaît, verrouillés tant qu'il ne les a pas obtenus. Les rangs que l'histoire n'a pas encore
 * révélés n'apparaissent pas.
 */
const ORDER = ['cendre', 'fil', 'fer', 'verre', 'or', 'miroir', 'libre'] as const;
const CIVIC = ['cendre', 'fil', 'fer', 'verre', 'or'];

function MaskGlyph({ id, owned }: { id: string; owned: boolean }) {
  return (
    <span className={`mask-glyph mask-glyph--${id} ${owned ? 'is-owned' : 'is-locked'}`} aria-hidden="true">
      <span className="mask-glyph__eye" />
      <span className="mask-glyph__eye mask-glyph__eye--r" />
    </span>
  );
}

function RankHud() {
  const t = useT();
  const visible = useVar<boolean>('mask.plaqueVisible') === true;
  const rank = useVar<number>('mask.rank') ?? 0;
  const known = useVar<string[]>('mask.rangsConnus') ?? ['cendre', 'fil', 'fer'];
  if (!visible) return null;
  const current = CIVIC[Math.max(0, Math.min(CIVIC.length - 1, rank))]!;
  return (
    <div className="mask-plaque" data-testid="mask-rank" aria-live="polite">
      <div className="mask-plaque__tag">
        <span className="mask-plaque__label">{t('mask.hud.rangCivique')}</span>
        <strong className="mask-plaque__rank">{t(`mask.rang.${current}`)}</strong>
      </div>
      <div className="mask-plaque__ladder" aria-label={t('mask.hud.rangsConnus')}>
        {ORDER.filter((id) => known.includes(id)).map((id) => {
          const index = CIVIC.indexOf(id);
          const owned = index >= 0 && index <= rank;
          return (
            <span key={id} className="mask-plaque__step" title={t(owned ? 'mask.hud.obtenu' : 'mask.hud.verrouille', { rank: t(`mask.rang.${id}`) })}>
              <MaskGlyph id={id} owned={owned} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function LiftTimer() {
  const t = useT();
  const lift = useUiStore<{ status: string; seconds: number } | null>('mask.lift');
  if (!lift) return null;
  const minutes = Math.floor(lift.seconds / 60);
  const seconds = String(lift.seconds % 60).padStart(2, '0');
  return (
    <div className={`mask-countdown ${lift.status === 'held' ? 'is-held' : ''} ${lift.seconds <= 10 ? 'is-urgent' : ''}`} data-testid="mask-lift-timer" role="timer">
      <span className="mask-countdown__label">{t(lift.status === 'held' ? 'mask.hud.junoRetient' : 'mask.hud.monteCharge')}</span>
      <strong className="mask-countdown__time">{`${minutes}:${seconds}`}</strong>
    </div>
  );
}

export const rankHud = defineHud({ id: 'mask.rankHud', slot: 'top-left', component: RankHud });
export const liftHud = defineHud({ id: 'mask.liftHud', slot: 'top-center', component: LiftTimer });
