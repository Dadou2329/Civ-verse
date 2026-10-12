import { useEffect, useState } from 'react';
import { defineHud, keyLabel, useCiv, useT, useUiStore, useVar } from '@sdk/ui';
import { PlaqueIcon } from './glyphs';
import './door.css';

/**
 * Rang UI — the threshold plaque, discreet in a corner, with an animation when the rank changes
 * and the refusal stamp when a rank lock says no.
 */
function RankPlaque() {
  const t = useT();
  const permissionsKey = useCiv().settings.of<{ permissionsKey: string }>('door.access').permissionsKey;
  const rank = useVar<number>('door.rank') ?? -1;
  const temporary = useVar<boolean>('door.rankTemporary') === true;
  const flash = useUiStore<number>('door.rankFlash') ?? 0;
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (!flash) return;
    setAnim(true);
    const id = setTimeout(() => setAnim(false), 1600);
    return () => clearTimeout(id);
  }, [flash]);
  if (rank < 0) return null;
  return (
    <div className={`door-plaque door-plaque--r${Math.min(2, rank)} ${anim ? 'is-changing' : ''}`} data-testid="door-plaque" aria-live="polite">
      <PlaqueIcon rank={rank} />
      <div className="door-plaque__text">
        <span className="door-plaque__label">{t('door.hud.rankLabel')}</span>
        <strong>{t(`door.rank.${Math.min(2, rank)}`)}</strong>
        {temporary && <em className="door-plaque__temp">{t('door.hud.temporary')}</em>}
      </div>
      <span className="door-plaque__key">{keyLabel(permissionsKey)}</span>
    </div>
  );
}

function AccessDeniedStamp() {
  const t = useT();
  const denied = useUiStore<{ n: number; required: number; rank: number }>('door.denied');
  const [shown, setShown] = useState<{ n: number; required: number; rank: number } | null>(null);
  useEffect(() => {
    if (!denied) return;
    setShown(denied);
    const id = setTimeout(() => setShown(null), 1800);
    return () => clearTimeout(id);
  }, [denied]);
  if (!shown) return null;
  return (
    <div key={shown.n} className="door-denied" role="status" data-testid="door-denied">
      <div className="door-denied__stamp">
        <strong>{t('door.hud.denied')}</strong>
        <span>{t('door.hud.deniedRank', { rank: shown.required })}</span>
      </div>
    </div>
  );
}

export const rankPlaqueHud = defineHud({ id: 'door.rankPlaque', slot: 'top-left', component: RankPlaque });
export const deniedHud = defineHud({ id: 'door.accessDenied', slot: 'overlay', component: AccessDeniedStamp });
