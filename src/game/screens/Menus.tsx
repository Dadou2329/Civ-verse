import { useEffect, useState } from 'react';
import { useController, useSessionTick, useT } from '../hooks';
import { Button, formatDate, formatDuration } from '../ui/common';
import { useUi } from '../state/uiStore';
import type { SaveSlotInfo } from '@engine/core/save/storage';
import { iconDataUrl } from '../ui/icons';
import type { IconShape } from '@engine/core/inventory/items';

export function MainMenu() {
  const controller = useController();
  const t = useT();
  const set = useUi((s) => s.set);
  const [auto, setAuto] = useState<SaveSlotInfo | null | undefined>(undefined);
  useEffect(() => {
    void controller.listSaves().then((l) => setAuto(l.find((s) => s.slot === 'auto') ?? null));
  }, [controller]);
  return (
    <div className="cv-menu" data-testid="main-menu">
      <div className="cv-menu__brand">
        <h1 className="cv-logo">CIVILIZATIONVERSE</h1>
        <p className="cv-tagline">{t('ui.menu.tagline')}</p>
      </div>
      <nav className="cv-menu-list cv-menu-list--main">
        {auto && (
          <Button variant="primary" autoFocus onClick={() => void controller.continueGame('auto')} testId="menu-continue">
            {t('ui.menu.continue')}
            <span className="cv-button__sub">
              {auto.label} · {formatDate(auto.savedAt)}
            </span>
          </Button>
        )}
        <Button
          variant={auto ? 'default' : 'primary'}
          autoFocus={!auto}
          testId="menu-new"
          onClick={async () => {
            if (auto) {
              const ok = await controller.session.ui.confirm({
                title: t('ui.menu.newGame.confirmTitle'),
                message: t('ui.menu.newGame.confirmText'),
                confirm: t('ui.menu.newGame.confirm'),
                cancel: t('ui.common.cancel'),
              });
              if (!ok) return;
            }
            await controller.newGame();
          }}
        >
          {t('ui.menu.newGame')}
        </Button>
        <Button onClick={() => set({ screen: 'civs' })} testId="menu-civs">
          {t('ui.menu.civilizations')}
        </Button>
        <Button onClick={() => set({ screen: 'registry' })}>{t('ui.menu.registry')}</Button>
        <Button onClick={() => set({ screen: 'settings', settingsReturn: 'menu' })}>{t('ui.menu.settings')}</Button>
        <Button onClick={() => set({ screen: 'credits' })}>{t('ui.menu.credits')}</Button>
        {__CIV_STUDIO_AVAILABLE__ && (
          <a className="cv-button cv-button--ghost" href="/studio.html">
            {t('ui.menu.studio')}
          </a>
        )}
      </nav>
      <footer className="cv-menu__footer">{t('ui.menu.footer')}</footer>
    </div>
  );
}

export function CivSelect() {
  const controller = useController();
  const session = controller.session;
  const t = useT();
  useSessionTick();
  const set = useUi((s) => s.set);
  const civs = session.civilizations();
  const [locales, setLocales] = useState(0);
  // Pack string tables are needed to show names before a pack is loaded.
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const m of civs) {
        if (session.i18n.has(m.name)) continue;
        try {
          const table = (await session.provider.readJson(m.id, 'locales/fr-FR.json')) as Record<string, string>;
          session.i18n.addTable(`${m.id}#menu`, 'fr-FR', table);
        } catch (err) {
          session.log.warn(`Textes de ${m.id} indisponibles`, err);
        }
      }
      if (alive) setLocales((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
  }, [civs, session]);
  void locales;
  return (
    <div className="cv-civs" data-testid="civ-select">
      <h1>{t('ui.civs.title')}</h1>
      <p className="cv-civs__intro">{t('ui.civs.intro')}</p>
      <div className="cv-civs__grid">
        {civs.map((m) => {
          const progress = session.multiverse.progress(m.id);
          const saved = session.civStates.has(m.id);
          const colors = m.cover?.colors ?? ['#2a2f3a', '#5a6a8a'];
          return (
            <article
              key={m.id}
              className="cv-civ-card"
              data-testid={`civ-${m.id}`}
              style={{ background: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`, ['--civ-accent' as string]: m.theme?.accent ?? '#e8c27a' }}
            >
              <div className={`cv-civ-card__motif cv-motif--${m.cover?.motif ?? 'default'}`} aria-hidden="true" />
              <h2 style={{ fontFamily: m.theme?.titleFont }}>{t(m.name)}</h2>
              {m.tagline && <p className="cv-civ-card__tagline">{t(m.tagline)}</p>}
              <p className="cv-civ-card__desc">{t(m.description)}</p>
              <p className="cv-civ-card__status">
                {progress.completed ? t('ui.civs.completed') : progress.started ? t('ui.civs.started') : t('ui.civs.new')}
                {progress.playTime > 0 && ` · ${formatDuration(progress.playTime)}`}
              </p>
              <div className="cv-civ-card__actions">
                <Button variant="primary" onClick={() => void controller.startCiv(m.id)} testId={`play-${m.id}`}>
                  {saved ? t('ui.civs.continue') : t('ui.civs.start')}
                </Button>
                {saved && (
                  <Button
                    variant="ghost"
                    testId={`restart-${m.id}`}
                    onClick={async () => {
                      const ok = await session.ui.confirm({
                        title: t('ui.civs.restartTitle'),
                        message: t('ui.civs.restartText'),
                        confirm: t('ui.civs.restart'),
                        cancel: t('ui.common.cancel'),
                      });
                      if (ok) await controller.startCiv(m.id, { fresh: true });
                    }}
                  >
                    {t('ui.civs.restart')}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {session.manifestIssues.size > 0 && <p className="cv-warning">{t('ui.civs.invalidPacks', { count: session.manifestIssues.size })}</p>}
      <Button onClick={() => set({ screen: 'menu' })}>{t('ui.common.back')}</Button>
    </div>
  );
}

export function Registry() {
  const controller = useController();
  const session = controller.session;
  const t = useT();
  const set = useUi((s) => s.set);
  const fragments = session.civilizations().flatMap((m) => m.fragments.map((f) => ({ ...f, civ: m })));
  const g = session.multiverse.data;
  return (
    <div className="cv-registry" data-testid="registry">
      <h1>{t('ui.registry.title')}</h1>
      <p className="cv-registry__intro">{t('ui.registry.intro', { awakenings: g.protagonist.awakenings })}</p>
      <div className="cv-registry__grid">
        {fragments.map((f) => {
          const owned = session.multiverse.hasFragment(f.id);
          return (
            <div key={f.id} className={`cv-fragment ${owned ? 'is-owned' : ''}`}>
              <img src={iconDataUrl({ shape: (f.icon ?? 'fragment') as IconShape, color: owned ? '#e8c27a' : '#3a3f4a', glow: owned })} alt="" />
              <h3>{owned ? (session.i18n.has(f.name) ? t(f.name) : f.id) : t('ui.registry.unknown')}</h3>
              <p>{owned && session.i18n.has(f.hint) ? t(f.hint) : t('ui.registry.hidden')}</p>
            </div>
          );
        })}
      </div>
      <Button onClick={() => set({ screen: 'menu' })}>{t('ui.common.back')}</Button>
    </div>
  );
}

export function Credits() {
  const t = useT();
  const set = useUi((s) => s.set);
  return (
    <div className="cv-credits">
      <h1>{t('ui.credits.title')}</h1>
      <p>{t('ui.credits.line1')}</p>
      <p>{t('ui.credits.line2')}</p>
      <p>{t('ui.credits.line3')}</p>
      <p className="cv-muted">{t('ui.credits.line4')}</p>
      <Button onClick={() => set({ screen: 'menu' })}>{t('ui.common.back')}</Button>
    </div>
  );
}

export function Loading() {
  const label = useUi((s) => s.loadingLabel);
  const t = useT();
  const tips = ['ui.tip.1', 'ui.tip.2', 'ui.tip.3', 'ui.tip.4', 'ui.tip.5'];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]!);
  return (
    <div className="cv-loading" data-testid="loading">
      <div className="cv-loading__spinner" aria-hidden="true" />
      <h2>{t('ui.loading.title', { name: label })}</h2>
      <p className="cv-muted">{t(tip)}</p>
    </div>
  );
}

export function ErrorScreen() {
  const error = useUi((s) => s.error);
  const t = useT();
  const set = useUi((s) => s.set);
  return (
    <div className="cv-error" role="alert">
      <h1>{t('ui.error.title')}</h1>
      <pre>{error}</pre>
      <Button onClick={() => set({ screen: 'menu', error: null })}>{t('ui.common.back')}</Button>
    </div>
  );
}
