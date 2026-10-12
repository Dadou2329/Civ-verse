import { useEffect, useRef, useState } from 'react';
import type { ValidationReport } from '@engine/core/packs/validate';
import { useStudio } from '../hooks';
import { packPath } from '../core/project';

/** Bottom panel: the Studio's journal and the problems found by validation. */
export function ConsolePanel({ report, onValidate }: { report: ValidationReport | null; onValidate: () => void }) {
  const studio = useStudio();
  const [tab, setTab] = useState<'log' | 'problems'>('log');
  const [collapsed, setCollapsed] = useState(false);
  const linesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (report) {
      setTab('problems');
      setCollapsed(false);
    }
  }, [report]);
  useEffect(() => {
    const el = linesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [studio.log.length]);
  const errors = report?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const warnings = report?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  return (
    <div className={`st-console ${collapsed ? 'is-collapsed' : ''}`} data-testid="st-console">
      <div className="st-panel__head">
        <button type="button" className={`st-btn st-btn--small ${tab === 'log' ? 'is-active' : ''}`} onClick={() => (setTab('log'), setCollapsed(false))}>
          Journal
        </button>
        <button type="button" className={`st-btn st-btn--small ${tab === 'problems' ? 'is-active' : ''}`} onClick={() => (setTab('problems'), setCollapsed(false))} data-testid="st-problems-tab">
          Problèmes {report ? `(${errors} erreur${errors > 1 ? 's' : ''}, ${warnings} avertissement${warnings > 1 ? 's' : ''})` : ''}
        </button>
        <span style={{ flex: 1 }} />
        {tab === 'problems' && (
          <button type="button" className="st-btn st-btn--small" onClick={onValidate}>
            Relancer la validation
          </button>
        )}
        {tab === 'log' && (
          <button
            type="button"
            className="st-btn st-btn--small st-btn--ghost"
            onClick={() => {
              studio.log = [];
              studio.changed();
            }}
          >
            Effacer
          </button>
        )}
        <button type="button" className="st-btn st-btn--small st-btn--ghost" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Déplier' : 'Replier'}>
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      {!collapsed && tab === 'log' && (
        <div className="st-console__lines" ref={linesRef}>
          {studio.log.map((l) => (
            <div key={l.id} className={`st-line st-line--${l.level} ${l.path ? 'is-link' : ''}`} onClick={() => l.path && studio.doc(l.path) && void studio.openDoc(l.path)}>
              <span className="st-line__time">{new Date(l.at).toLocaleTimeString('fr-FR')}</span>
              {l.text}
            </div>
          ))}
        </div>
      )}
      {!collapsed && tab === 'problems' && (
        <div className="st-console__lines" data-testid="st-problems">
          {!report && <div className="st-empty">Lancez « Valider » pour vérifier la civilisation (références, textes, schémas).</div>}
          {report && report.issues.length === 0 && (
            <div className="st-line st-line--success">
              Aucun problème : {report.stats.scenes} scènes, {report.stats.entities} entités, {report.stats.dialogues} dialogues, {report.stats.quests} quêtes, {report.stats.cinematics} cinématiques, {report.stats.keysChecked} textes vérifiés.
            </div>
          )}
          {report?.issues.map((i, k) => {
            const path = packPath(i.pack, i.file);
            return (
              <div key={k} className={`st-line st-line--${i.severity} is-link`} onClick={() => studio.doc(path) && void studio.openDoc(path)}>
                {i.severity === 'error' ? '✖' : '⚠'} {i.message} <span className="st-issue__where">— {i.file}{i.path ? ` · ${i.path}` : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
