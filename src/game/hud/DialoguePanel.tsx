import { useEffect, useRef, useState } from 'react';
import { useController, useDialogueView, useT } from '../hooks';
import { KeyCap } from '../ui/common';

/** Dialogue box: speaker plate, typewriter text, choices (click or 1–9). */
export function DialoguePanel() {
  const view = useDialogueView();
  const controller = useController();
  const t = useT();
  const [shown, setShown] = useState(0);
  const textRef = useRef('');
  const key = view ? `${view.dialogueId}/${view.nodeId}` : '';
  const text = view?.text ?? '';
  const speed = controller.settings.textSpeed;

  useEffect(() => {
    textRef.current = text;
    if (!speed) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let raf = 0;
    const start = performance.now();
    const step = () => {
      const n = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * speed));
      setShown(n);
      if (n < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, text, speed]);

  const complete = shown >= text.length;

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) {
        e.preventDefault();
        if (!complete) setShown(textRef.current.length);
        else if (view.canAdvance) controller.session.dialogue.advance();
      }
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (digit && complete) {
        const choice = view.choices[Number(digit[1]) - 1];
        if (choice?.enabled) controller.session.dialogue.choose(choice.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, complete, controller]);

  if (!view) return null;
  const onClick = () => {
    if (!complete) setShown(text.length);
    else if (view.canAdvance) controller.session.dialogue.advance();
  };
  return (
    <div
      className={`cv-dialogue cv-dialogue--text-${controller.settings.subtitles} ${view.isPlayer ? 'cv-dialogue--player' : ''}`}
      onClick={onClick}
      data-testid="dialogue"
    >
      {view.speakerName && <div className="cv-dialogue__speaker">{view.speakerName}</div>}
      <p className="cv-dialogue__text" aria-live="polite">
        {text.slice(0, shown)}
        <span className="cv-dialogue__ghost">{text.slice(shown)}</span>
      </p>
      {complete && view.choices.length > 0 && (
        <ol className="cv-dialogue__choices">
          {view.choices.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                className="cv-choice"
                disabled={!c.enabled}
                data-testid={`choice-${c.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  controller.session.dialogue.choose(c.id);
                }}
              >
                <span className="cv-choice__num">{i + 1}</span>
                {c.text}
              </button>
            </li>
          ))}
        </ol>
      )}
      {complete && view.canAdvance && (
        <div className="cv-dialogue__hint">
          <KeyCap code="Space" /> {t('ui.dialogue.continue')}
        </div>
      )}
    </div>
  );
}
