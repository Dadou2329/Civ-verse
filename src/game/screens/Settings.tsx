import { useState } from 'react';
import { useController, useT } from '../hooks';
import { Button, KeyCap } from '../ui/common';
import type { GameAction, GameSettings } from '@engine/platform/settings';
import { DEFAULT_SETTINGS } from '@engine/platform/settings';
import type { QualityLevel } from '@engine/view/quality';

const ACTIONS: GameAction[] = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'interact', 'secondary', 'journal', 'inventory', 'pause', 'skip', 'quicksave', 'debug'];

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
                        const onKey = (e: KeyboardEvent) => {
                          e.preventDefault();
                          window.removeEventListener('keydown', onKey, true);
                          setRebinding(null);
                          if (e.code === 'Escape') return;
                          update({ bindings: { ...s.bindings, [a]: [e.code] } });
                        };
                        window.addEventListener('keydown', onKey, true);
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
