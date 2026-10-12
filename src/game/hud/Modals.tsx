import { useEffect } from 'react';
import { useUi } from '../state/uiStore';
import { useController, useT } from '../hooks';
import { Button, Modal } from '../ui/common';

export function DocumentViewer() {
  const doc = useUi((s) => s.document);
  const controller = useController();
  const t = useT();
  useEffect(() => {
    controller.setModal(!!doc);
  }, [doc, controller]);
  if (!doc) return null;
  const { spec } = doc;
  return (
    <Modal onClose={doc.resolve} className={`cv-document cv-document--${spec.style ?? 'paper'}`} labelledBy="cv-doc-title">
      <h2 id="cv-doc-title" className="cv-document__title">
        {spec.title}
      </h2>
      <div className="cv-document__body">
        {spec.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {spec.footer && <div className="cv-document__footer">{spec.footer}</div>}
      <div className="cv-modal__actions">
        <Button onClick={doc.resolve} autoFocus testId="document-close">
          {t('ui.document.close')}
        </Button>
      </div>
    </Modal>
  );
}

export function EndScreen() {
  const end = useUi((s) => s.endScreen);
  const controller = useController();
  const t = useT();
  useEffect(() => {
    controller.setModal(!!end);
  }, [end, controller]);
  if (!end) return null;
  return (
    <div className="cv-endscreen" data-testid="endscreen">
      <div className="cv-endscreen__inner">
        <h1 className="cv-endscreen__title">{end.spec.title}</h1>
        {end.spec.subtitle && <p className="cv-endscreen__subtitle">{end.spec.subtitle}</p>}
        {end.spec.lines?.map((l, i) => (
          <p key={i} className="cv-endscreen__line" style={{ animationDelay: `${1.5 + i * 0.8}s` }}>
            {l}
          </p>
        ))}
        <div className="cv-endscreen__actions">
          <Button
            variant="primary"
            autoFocus
            testId="endscreen-continue"
            onClick={() => {
              end.resolve();
            }}
          >
            {t('ui.end.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm);
  const controller = useController();
  useEffect(() => {
    controller.setModal(!!confirm);
  }, [confirm, controller]);
  if (!confirm) return null;
  return (
    <Modal onClose={() => confirm.resolve(false)} labelledBy="cv-confirm-title">
      <h2 id="cv-confirm-title">{confirm.spec.title}</h2>
      <p>{confirm.spec.message}</p>
      <div className="cv-modal__actions">
        <Button onClick={() => confirm.resolve(false)}>{confirm.spec.cancel}</Button>
        <Button variant="primary" autoFocus onClick={() => confirm.resolve(true)}>
          {confirm.spec.confirm}
        </Button>
      </div>
    </Modal>
  );
}
