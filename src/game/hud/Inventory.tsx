import { useEffect, useReducer, useState } from 'react';
import { useController, useT } from '../hooks';
import { Button, Modal } from '../ui/common';
import { iconDataUrl } from '../ui/icons';

export function InventoryPanel() {
  const controller = useController();
  const session = controller.session;
  const t = useT();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => session.inventory.onChange(bump), [session]);
  const entries = session.inventory.entries();
  const [selected, setSelected] = useState<string | null>(entries[0]?.id ?? null);
  const sel = selected ? session.items.get(selected) : undefined;
  return (
    <Modal onClose={() => controller.closeOverlay()} className="cv-inventory" labelledBy="cv-inv-title">
      <h2 id="cv-inv-title">{t('ui.inventory.title')}</h2>
      {entries.length === 0 ? (
        <p className="cv-muted">{t('ui.inventory.empty')}</p>
      ) : (
        <div className="cv-inventory__layout">
          <div className="cv-inventory__grid" role="list">
            {entries.map((e) => {
              const def = session.items.get(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  role="listitem"
                  className={`cv-slot ${e.id === selected ? 'is-selected' : ''}`}
                  onClick={() => setSelected(e.id)}
                  title={def ? t(def.name) : e.id}
                >
                  {def && <img src={iconDataUrl(def.icon)} alt="" />}
                  {e.count > 1 && <span className="cv-slot__count">{e.count}</span>}
                </button>
              );
            })}
          </div>
          {sel && (
            <aside className="cv-inventory__detail">
              <img className="cv-inventory__big" src={iconDataUrl(sel.icon)} alt="" />
              <h3>{t(sel.name)}</h3>
              <p>{t(sel.description)}</p>
              {sel.questItem && <p className="cv-muted">{t('ui.inventory.questItem')}</p>}
              {sel.actions?.map((a) => (
                <Button
                  key={a.id}
                  onClick={() => {
                    controller.closeOverlay();
                    void session.civ?.ctx.inventory.use(sel.id, a.id);
                  }}
                >
                  {t(a.label)}
                </Button>
              ))}
            </aside>
          )}
        </div>
      )}
      <div className="cv-modal__actions">
        <Button onClick={() => controller.closeOverlay()}>{t('ui.common.close')}</Button>
      </div>
    </Modal>
  );
}
