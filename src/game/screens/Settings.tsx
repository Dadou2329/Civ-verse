import { useState } from 'react';
import { useController, useT } from '../hooks';
import { Button, KeyCap } from '../ui/common';
import type { GameAction, GameSettings } from '@engine/platform/settings';
import { DEFAULT_SETTINGS } from '@engine/platform/settings';
import type { QualityLevel } from '@engine/view/quality';

const ACTIONS: GameAction[] = [
  'forward',
  'back',
  'left',
  'right',
  'jump',
  'sprint',
  'interact',
  'secondary',
  'attack',
  'block',
  'dodge',
  'hotbar1',
  'hotbar2',
  'hotbar3',
  'hotbar4',
  'hotbar5',
  'hotbar6',
  'nextItem',
  'prevItem',
  'journal',
  'inventory',
  'pause',
  'skip',
  'quicksave',
  'debug',
];

/** Waits for the next key, mouse button or wheel turn; Échap cancels. */
function captureInput(done: (code: string | null) => void): void {
  const finish = (code: string | null) => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousedown', onMouse, true);
    window.removeEventListener('wheel', onWheel, true);
    done(code);
  };
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault();
    finish(e.code === 'Escape' ? null : e.code);
  };
  const onMouse = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    finish(`Mouse${e.button}`);
  };
  const onWheel = (e: WheelEvent) => {
    if (e.deltaY !== 0) finish(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
  };
  window.addEventListener('keydown', onKey, true);
  // Registered after the click that started the capture has finished.
  setTimeout(() => {
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('wheel', onWheel, true);
  }, 0);
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const controller = useController();
  const t = useT();
  const [s, setS] = useState<GameSettings>(structuredClone(controller.settings));
  const [tab, setTab] = useState<'controls' | 'graphics' | 'audio' | 'access'>('controls');
  const [rebinding, setRebinding] = useState<GameAction | null>(null);
  const update = (patch: Partial<GameSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    controller.applySettings(next);
  };
  const slider = (label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, fmt = (v: number) => v.toFixed(2)) => (
    <label className="cv-field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{fmt(value)}</output>
    </label>
  );
  return (
    <div className="cv-settings" data-testid="settings">
      <h2>{t('ui.settings.title')}</h2>
      <div className="cv-tabs" role="tablist">
        {(['controls', 'graphics', 'audio', 'access'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`cv-tab ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)} type="button">
            {t(`ui.settings.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'controls' && (
        <div className="cv-settings__section">
          {slider(t('ui.settings.sensitivity'), s.mouseSensitivity, 0.2, 3, 0.05, (v) => update({ mouseSensitivity: v }))}
          <label className="cv-field cv-field--check">
            <input type="checkbox" checked={s.invertY} onChange={(e) => update({ invertY: e.target.checked })} />
            <span>{t('ui.settings.invertY')}</span>
          </label>
          <table className="cv-bindings">
            <tbody>
              {ACTIONS.map((a) => (
                <tr key={a}>
                  <td>{t(`ui.action.${a}`)}</td>
                  <td>
                    {s.bindings[a].map((c) => (
                      <KeyCap key={c} code={c} />
                    ))}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRebinding(a);
                        captureInput((code) => {
                          setRebinding(null);
                          if (code) update({ bindings: { ...s.bindings, [a]: [code] } });
                        });
                      }}
                    >
                      {rebinding === a ? t('ui.settings.pressKey') : t('ui.settings.rebind')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="ghost" onClick={() => update({ bindings: structuredClone(DEFAULT_SETTINGS.bindings) })}>
            {t('ui.settings.resetBindings')}
          </Button>
        </div>
      )}
      {tab === 'graphics' && (
        <div className="cv-settings__section">
          <label className="cv-field">
            <span>{t('ui.settings.quality')}</span>
            <select value={s.quality} onChange={(e) => update({ quality: e.target.value as QualityLevel })} data-testid="quality">
              {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                <option key={q} value={q}>
                  {t(`ui.settings.quality.${q}`)}
                </option>
              ))}
            </select>
          </label>
          {slider(t('ui.settings.fov'), s.fov, 55, 100, 1, (v) => update({ fov: v }), (v) => `${v}°`)}
          <label className="cv-field cv-field--check">
            <input type="checkbox" checked={s.headBob} onChange={(e) => update({ headBob: e.target.checked })} />
            <span>{t('ui.settings.headBob')}</span>
          </label>
          <label className="cv-field cv-field--check">
            <input type="checkbox" checked={s.showFps} onChange={(e) => update({ showFps: e.target.checked })} />
            <span>{t('ui.settings.showFps')}</span>
          </label>
        </div>
      )}
      {tab === 'audio' && (
        <div className="cv-settings__section">
          {(['master', 'music', 'sfx', 'ambience', 'ui'] as const).map((k) =>
            slider(t(`ui.settings.volume.${k}`), s.volumes[k], 0, 1, 0.05, (v) => update({ volumes: { ...s.volumes, [k]: v } }), (v) => `${Math.round(v * 100)} %`),
          )}
        </div>
      )}
      {tab === 'access' && (
        <div className="cv-settings__section">
          <label className="cv-field">
            <span>{t('ui.settings.subtitles')}</span>
            <select value={s.subtitles} onChange={(e) => update({ subtitles: e.target.value as GameSettings['subtitles'] })}>
              {(['small', 'medium', 'large'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`ui.settings.subtitles.${k}`)}
                </option>
              ))}
            </select>
          </label>
          {slider(t('ui.settings.textSpeed'), s.textSpeed, 0, 120, 5, (v) => update({ textSpeed: v }), (v) => (v === 0 ? t('ui.settings.instant') : t('ui.settings.textSpeedValue', { value: v })))}
          <label className="cv-field cv-field--check">
            <input type="checkbox" checked={s.showMarkers} onChange={(e) => update({ showMarkers: e.target.checked })} />
            <span>{t('ui.settings.markers')}</span>
          </label>
          <label className="cv-field">
            <span>{t('ui.settings.difficulty')}</span>
            <select value={s.difficulty} onChange={(e) => update({ difficulty: e.target.value as GameSettings['difficulty'] })} data-testid="difficulty">
              {(['normal', 'indulgent'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`ui.settings.difficulty.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="cv-field">
            <span>{t('ui.settings.language')}</span>
            <select value={s.locale} onChange={(e) => update({ locale: e.target.value })}>
              <option value="fr-FR">{t('ui.settings.language.fr')}</option>
            </select>
          </label>
        </div>
      )}
      <div className="cv-modal__actions">
        <Button variant="primary" onClick={onClose}>
          {t('ui.common.back')}
        </Button>
      </div>
    </div>
  );
}
