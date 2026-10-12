import { useUi } from '../state/uiStore';
import { useSession } from '../hooks';
import { iconDataUrl } from '../ui/icons';

const KIND_GLYPH: Record<string, string> = {
  info: '•',
  success: '✓',
  warning: '!',
  denied: '✕',
  quest: '◆',
  item: '+',
  memory: '✦',
  discovery: '★',
};

export function Notifications() {
  const notes = useUi((s) => s.notifications);
  const session = useSession();
  return (
    <div className="cv-notifications" aria-live="polite" data-testid="notifications">
      {notes.map((n) => {
        const item = n.icon ? session.items.get(n.icon) : undefined;
        return (
          <div key={n.id} className={`cv-note cv-note--${n.kind}`} style={{ animationDuration: `${n.duration}s` }}>
            {item ? <img className="cv-note__icon" src={iconDataUrl(item.icon)} alt="" /> : <span className="cv-note__glyph">{KIND_GLYPH[n.kind] ?? '•'}</span>}
            <span>{n.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LocationTitle() {
  const loc = useUi((s) => s.location);
  if (!loc) return null;
  return (
    <div className="cv-location" key={loc.key} data-testid="location">
      <div className="cv-location__title">{loc.title}</div>
      {loc.subtitle && <div className="cv-location__subtitle">{loc.subtitle}</div>}
    </div>
  );
}
