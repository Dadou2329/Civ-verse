import { useEffect } from 'react';
import { definePanel, useCiv, useT, useVar, type PanelProps } from '@sdk/ui';
import { RANKS } from '../mechanics/access';
import { PlaqueIcon } from './glyphs';
import './door.css';

/** The permission map of the threshold plaque (key R). */
function PermissionsPanel({ close }: PanelProps) {
  const t = useT();
  const toggleKey = useCiv().settings.of<{ permissionsKey: string }>('door.access').permissionsKey;
  const rank = useVar<number>('door.rank') ?? -1;
  const temporary = useVar<boolean>('door.rankTemporary') === true;
  const palm = useVar<boolean>('door.palmRevealed') === true;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === toggleKey) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, toggleKey]);
  return (
    <div className="cv-modal door-perms" data-testid="door-permissions">
      <h2>{t('door.perms.title')}</h2>
      <p className="cv-muted">{t('door.perms.intro')}</p>
      <ul className="door-perms__list">
        {RANKS.map((r) => {
          const granted = rank >= r.rank;
          return (
            <li key={r.rank} className={`door-perms__rank ${granted ? 'is-granted' : 'is-locked'} ${rank === r.rank ? 'is-current' : ''}`}>
              <PlaqueIcon rank={r.rank} size={40} />
              <div>
                <strong>
                  {t('door.perms.rankLine', { rank: r.rank, name: t(r.name) })}
                  {rank === r.rank && temporary ? ` — ${t('door.hud.temporary')}` : ''}
                </strong>
                <span>{r.zones.map((z) => t(z)).join(' · ')}</span>
              </div>
              <span className="door-perms__state">{granted ? t('door.perms.granted') : t('door.perms.locked')}</span>
            </li>
          );
        })}
      </ul>
      {palm && <p className="door-perms__palm">{t('door.perms.palm')}</p>}
      <div className="cv-modal__actions">
        <button type="button" className="cv-button cv-button--primary" onClick={() => close()}>
          {t('door.perms.close')}
        </button>
      </div>
    </div>
  );
}

export const permissionsPanel = definePanel({ id: 'door.permissions', component: PermissionsPanel, title: 'door.perms.title' });
