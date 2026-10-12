import { useEffect, useMemo, useState } from 'react';
import { definePanel, useCiv, useT, useUiStore, type PanelProps } from '@sdk/ui';
import type { ChamberApi } from '../mechanics/chamber';
import type { EchoApi } from '../mechanics/echo';
import { Gem } from './gem';
import './memory.css';

interface ChamberView {
  slots: (string | null)[];
  states: Record<string, string>;
  order: string[];
}

/**
 * « Souvenirs » — the memory chamber. Shards are shown as abstract portraits with their state;
 * « Ancrer » / « Retirer » need a memory device nearby (or Oriane's diapason).
 */
function ChamberPanel({ close }: PanelProps) {
  const ctx = useCiv();
  const t = useT();
  const view = useUiStore<ChamberView>('memory.chamber');
  const api = ctx.mechanics.get<ChamberApi>('memory.chamber');
  const echoes = ctx.mechanics.get<EchoApi>('memory.echoes');
  const [selected, setSelected] = useState<string | null>(null);
  const toggleKey = ctx.settings.of<{ chamberKey: string }>('memory.chamber').chamberKey;
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
  if (!view) return null;
  const known = view.order.filter((id) => api.shard(id));
  const current = selected && known.includes(selected) ? selected : (known[0] ?? null);
  const def = current ? api.shard(current) : undefined;
  const state = current ? view.states[current] : undefined;
  const canManipulate = api.canManipulate();
  const anchored = current ? view.slots.includes(current) : false;
  const full = !view.slots.includes(null);
  return (
    <div className="cv-modal mem-panel" data-testid="mem-chamber">
      <h2>{t('memory.panel.title')}</h2>
      <div className="mem-panel__slots">
        <span className="mem-panel__label">{t('memory.hud.chamber', { n: view.slots.filter(Boolean).length })}</span>
        {view.slots.map((id, i) => (
          <button key={i} type="button" className={`mem-slot ${id ? 'is-filled' : ''}`} onClick={() => id && setSelected(id)} data-testid={`mem-slot-${i}`}>
            <Gem color={id ? api.shard(id)?.color : undefined} size={40} empty={!id} />
            <span>{id ? t(api.shard(id)!.name) : t('memory.hud.emptySlot')}</span>
          </button>
        ))}
      </div>
      <div className="mem-panel__body">
        <ul className="mem-panel__list">
          {known.length === 0 && <li className="cv-muted">{t('memory.panel.none')}</li>}
          {known.map((id) => {
            const d = api.shard(id)!;
            const st = view.states[id];
            return (
              <li key={id}>
                <button type="button" className={`mem-card ${id === current ? 'is-selected' : ''} is-${st}`} onClick={() => setSelected(id)} data-testid={`mem-shard-${id}`}>
                  <Gem color={d.color} size={34} dim={st !== 'possede'} />
                  <span className="mem-card__name">{t(d.name)}</span>
                  <span className="mem-card__state">
                    {t(`memory.state.${st}`)}
                    {st === 'possede' && ` · ${t(view.slots.includes(id) ? 'memory.state.active' : 'memory.state.dormant')}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {def && (
          <section className="mem-panel__detail" aria-live="polite">
            <h3>{t(def.name)}</h3>
            <p className="mem-panel__origin">{t(api.originOf(def.id))}</p>
            <p className="mem-panel__sense">{t(def.sense)}</p>
            {state === 'possede' && <p className="mem-panel__fact">{t(def.fact)}</p>}
            {state === 'cede' && <p className="mem-panel__trace">{t('memory.panel.trace')}</p>}
            {state === 'restaure' && <p className="mem-panel__trace">{t('memory.panel.restored')}</p>}
            <div className="mem-panel__actions">
              {state === 'possede' && (
                <button type="button" className="cv-button cv-button--ghost" onClick={() => api.examine(def.id)} data-testid="mem-examine">
                  {t('memory.panel.examine')}
                </button>
              )}
              {state === 'possede' && !anchored && (
                <button
                  type="button"
                  className="cv-button cv-button--primary"
                  disabled={!canManipulate || full}
                  onClick={() => api.anchor(def.id)}
                  data-testid="mem-anchor"
                >
                  {t('memory.panel.anchor')}
                </button>
              )}
              {anchored && (
                <button type="button" className="cv-button" disabled={!canManipulate} onClick={() => api.remove(def.id)} data-testid="mem-remove">
                  {t('memory.panel.remove')}
                </button>
              )}
              {def.echo && echoes.played(def.echo) && state === 'possede' && (
                <button
                  type="button"
                  className="cv-button cv-button--ghost"
                  onClick={() => {
                    close();
                    void echoes.play(def.echo);
                  }}
                >
                  {t('memory.prompt.replay')}
                </button>
              )}
            </div>
            {!canManipulate && state === 'possede' && <p className="mem-panel__hint">{t('memory.panel.needDevice')}</p>}
            {canManipulate && full && !anchored && state === 'possede' && <p className="mem-panel__hint">{t('memory.notify.chamberFull')}</p>}
          </section>
        )}
      </div>
      <div className="cv-modal__actions">
        <button type="button" className="cv-button cv-button--primary" onClick={() => close()}>
          {t('memory.panel.close')}
        </button>
      </div>
    </div>
  );
}

/** Choosing which childhood object to place on a pedestal. */
function OfferingPanel({ props, close }: PanelProps) {
  const ctx = useCiv();
  const t = useT();
  const items = useMemo(() => (props.items as string[] | undefined) ?? [], [props.items]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      }
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (digit) {
        const item = items[Number(digit[1]) - 1];
        if (item) close({ item });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, items]);
  return (
    <div className="cv-modal mem-offering" data-testid="mem-offering">
      <h2>{t('memory.offering.title')}</h2>
      <p className="cv-muted">{t('memory.offering.intro')}</p>
      <div className="mem-offering__items">
        {items.map((id, i) => (
          <button key={id} type="button" className="cv-button" onClick={() => close({ item: id })} data-testid={`mem-offer-${id}`}>
            <span className="cv-choice__num">{i + 1}</span> {ctx.inventory.nameOf(id)}
          </button>
        ))}
      </div>
      <div className="cv-modal__actions">
        <button type="button" className="cv-button cv-button--ghost" onClick={() => close(null)}>
          {t('memory.offering.cancel')}
        </button>
      </div>
    </div>
  );
}

export const chamberPanel = definePanel({ id: 'memory.chamber', component: ChamberPanel, title: 'memory.panel.title' });
export const offeringPanel = definePanel({ id: 'memory.offering', component: OfferingPanel, title: 'memory.offering.title' });
