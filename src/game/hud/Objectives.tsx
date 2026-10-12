import { useQuestViews, useT } from '../hooks';

/** Tracked quest and its current objectives. */
export function ObjectiveTracker() {
  const quests = useQuestViews();
  const t = useT();
  const q = quests.find((x) => x.tracked && x.status === 'active') ?? quests.find((x) => x.status === 'active');
  if (!q) return null;
  return (
    <section className="cv-objectives" aria-label={t('ui.objectives.title')} data-testid="objectives">
      <div className="cv-objectives__kind">{q.kind === 'main' ? t('ui.journal.main') : t('ui.journal.side')}</div>
      <h2 className="cv-objectives__title">{q.title}</h2>
      <ul>
        {q.objectives.map((o) => (
          <li key={o.id} className={`${o.done ? 'is-done' : ''} ${o.optional ? 'is-optional' : ''}`}>
            <span className="cv-objectives__box" aria-hidden="true">
              {o.done ? '✓' : ''}
            </span>
            <span>
              {o.text}
              {o.progress && <span className="cv-objectives__progress"> ({o.progress})</span>}
              {o.optional && <span className="cv-objectives__optional"> {t('ui.objectives.optional')}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
