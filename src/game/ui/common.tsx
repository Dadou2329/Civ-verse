import { useEffect, type ReactNode } from 'react';
import { keyLabel } from '@engine/input/inputManager';

export function KeyCap({ code, label }: { code?: string; label?: string }) {
  return <kbd className="cv-key">{label ?? (code ? keyLabel(code) : '')}</kbd>;
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  autoFocus?: boolean;
  title?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={`cv-button cv-button--${props.variant ?? 'default'}`}
      onClick={props.onClick}
      disabled={props.disabled}
      autoFocus={props.autoFocus}
      title={props.title}
      data-testid={props.testId}
    >
      {props.children}
    </button>
  );
}

export function Modal(props: { children: ReactNode; onClose?: () => void; className?: string; labelledBy?: string }) {
  useEffect(() => {
    if (!props.onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        props.onClose?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [props, props.onClose]);
  return (
    <div className="cv-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={props.labelledBy}>
      <div className={`cv-modal ${props.className ?? ''}`}>{props.children}</div>
    </div>
  );
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}
