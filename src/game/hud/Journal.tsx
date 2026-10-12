import { useState } from 'react';
import { useController, useQuestViews, useT } from '../hooks';
import { Button, Modal } from '../ui/common';

export function Journal() {
  const controller = useController();
  const quests = useQuestViews();
  const t = useT();
  const [selected, setSelected] = useState<string | null>(quests.find((q) => q.tracked)?.id ?? quests[0]?.id ?? null);
  const groups: { title: string; status: string }[] = [
    { title: t('ui.journal.active'), status: 'active' },
    { title: t('ui.journal.completed'), status: 'completed' },
    { title: t('ui.journal.failed'), status: 'failed' },
  ];
  const q = quests.find((x) => x.id === selected) ?? null;
  return (
    <Modal onClose={() => controller.closeOverlay()} className="cv-journal" labelledBy="cv-journal-title">
      <h2 id="cv-journal-title">{t('ui.journal.title')}</h2>
      {quests.length === 0 ? (
        <p className="cv-muted">{t('ui.journal.empty')}</p>
      ) : (
        <div className="cv-journal__layout">
          <nav className="cv-journal__list">
            {groups.map((g) => {
              const list = quests.filter((x) => x.status === g.status);
              if (list.length === 0) return null;
              return (
                <div key={g.status}>
                  <h3>{g.title}</h3>
                  {list.map((x) => (
                    <button key={x.id} type="button" className={`cv-journal__item ${x.id === selected ? 'is-selected' : ''}`} onClick={() => setSelected(x.id)}>
                      {x.tracked && <span className="cv-journal__tracked">◆ </span>}
                      {x.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          {q && (
            <article className="cv-journal__detail">
              <div className="cv-objectives__kind">{q.kind === 'main' ? t('ui.journal.main') : t('ui.journal.side')}</div>
              <h3>{q.title}</h3>
              <p className="cv-journal__summary">{q.summary}</p>
              {q.status === 'active' && q.stageText && <p className="cv-journal__stage">{q.stageText}</p>}
              {q.objectives.length > 0 && (
                <ul className="cv-journal__objectives">
                  {q.objectives.map((o) => (
                    <li key={o.id} className={o.done ? 'is-done' : ''}>
                      {o.done ? '✓ ' : '○ '}
                      {o.text}
                      {o.progress && ` (${o.progress})`}
                      {o.optional && ` ${t('ui.objectives.optional')}`}
                    </li>
                  ))}
                </ul>
              )}
              {q.history.length > 1 && (
                <>
                  <h4>{t('ui.journal.history')}</h4>
                  <ol className="cv-journal__history">
                    {q.history.slice(0, -1).map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ol>
                </>
              )}
              {q.status === 'active' && !q.tracked && (
                <Button onClick={() => controller.session.quests.track(q.id)}>{t('ui.journal.track')}</Button>
              )}
            </article>
          )}
        </div>
      )}
      <div className="cv-modal__actions">
        <Button onClick={() => controller.closeOverlay()}>{t('ui.common.close')}</Button>
      </div>
    </Modal>
  );
}
