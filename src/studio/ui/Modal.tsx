import { useEffect, type ReactNode } from 'react';

export function Modal({ title, children, actions, onClose }: { title: string; children: ReactNode; actions?: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="st-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="st-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="st-modal__actions">
          <button type="button" className="st-btn" onClick={onClose}>
            Annuler
          </button>
          {actions}
        </div>
      </div>
    </div>
  );
}
