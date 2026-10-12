import { useEffect } from 'react';
import type { UiNotification } from '@engine/core/sim/uiBridge';
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

/** One notification: it leaves after being displayed for its duration (not counting hidden time). */
function NoteView({ note }: { note: UiNotification }) {
  const session = useSession();
  useEffect(() => {
    const timer = setTimeout(() => useUi.setState((s) => ({ notifications: s.notifications.filter((x) => x.id !== note.id) })), note.duration * 1000);
    return () => clearTimeout(timer);
  }, [note.id, note.duration]);
  const item = note.icon ? session.items.get(note.icon) : undefined;
  return (
    <div className={`cv-note cv-note--${note.kind}`} style={{ animationDuration: `${note.duration}s` }}>
      {item ? <img className="cv-note__icon" src={iconDataUrl(item.icon)} alt="" /> : <span className="cv-note__glyph">{KIND_GLYPH[note.kind] ?? '•'}</span>}
      <span>{note.text}</span>
    </div>
  );
}

export function Notifications() {
  const notes = useUi((s) => s.notifications);
  return (
    <div className="cv-notifications" aria-live="polite" data-testid="notifications">
      {notes.map((n) => (
        <NoteView key={n.id} note={n} />
      ))}
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
