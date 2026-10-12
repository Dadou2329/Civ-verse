import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ValidationReport } from '@engine/core/packs/validate';
import { StudioContext, useStudio, viewportRef } from './hooks';
import type { Studio, StudioTab, ToolId } from './core/studio';
import { Explorer, Hierarchy } from './panels/Explorer';
import { Inspector } from './panels/Inspector';
import { ConsolePanel } from './panels/Console';
import { ViewportPanel } from './viewport/ViewportPanel';
import { Playtest, type PlaytestRequest } from './play/Playtest';
import { validateInStudio } from './core/validation';
import { DocumentView } from './editors/DocumentView';

/**
 * The code editor only exists under the dev server: in a build, `__CIV_STUDIO_AVAILABLE__` is
 * replaced by `false` and the import (and Monaco) is removed from the bundle.
 */
const ScriptEditor = __CIV_STUDIO_AVAILABLE__ ? lazy(() => import('./editors/ScriptEditor')) : null;

export function StudioApp({ studio }: { studio: Studio }) {
  return (
    <StudioContext.Provider value={studio}>
      <Shell />
    </StudioContext.Provider>
  );
}

const TOOL_KEYS: Record<string, ToolId> = { Digit1: 'select', Digit2: 'place', Digit3: 'erase', Digit4: 'paint', Digit5: 'box', Digit6: 'pick' };

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || !!t.closest('.monaco-editor'));
}

function Shell() {
  const studio = useStudio();
  const [play, setPlay] = useState<PlaytestRequest | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const activeTab = studio.tabs.find((t) => t.path === studio.activeTab) ?? null;
  const viewportVisible = !activeTab || activeTab.kind === 'scene' || activeTab.kind === 'cinematic';

  const validate = useCallback(async () => {
    studio.busy = 'Validation de la civilisation…';
    studio.changed();
    try {
      const r = await validateInStudio(studio);
      setReport(r);
      if (r) {
        const e = r.issues.filter((i) => i.severity === 'error').length;
        studio.print(e ? 'error' : 'success', `Validation : ${e} erreur(s), ${r.issues.length - e} avertissement(s).`);
      }
    } catch (err) {
      studio.print('error', `Validation impossible : ${(err as Error).message}`);
    } finally {
      studio.busy = null;
      studio.changed();
    }
  }, [studio]);

  const startPlay = useCallback(
    (here: boolean) => {
      if (!studio.packId) return;
      const scene = studio.sceneDoc();
      const pose = viewportRef.current?.cameraPose();
      if (here && (!scene || !pose)) return;
      // Content is tested as edited; code runs as last saved (it is compiled by the dev server).
      const unsavedScripts = studio.project.dirty().filter((d) => d.kind === 'script');
      if (unsavedScripts.length) {
        studio.print('warning', `Scripts non enregistrés (${unsavedScripts.map((d) => d.rel).join(', ')}) : le test utilise leur dernière version enregistrée.`);
      }
      setPlay(
        here
          ? { here: true, scene: scene!.id, position: { x: pose!.position[0], y: pose!.position[1] - 1.6, z: pose!.position[2] }, yaw: pose!.yaw, pitch: -pose!.pitch }
          : { here: false },
      );
    },
    [studio],
  );
  const stopPlay = useCallback(() => {
    setPlay(null);
    studio.print('info', 'Test arrêté : retour à l’édition.');
  }, [studio]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Letter shortcuts follow the printed key (e.key), so they are the same on AZERTY and
      // QWERTY: Ctrl+Z is the key printed Z (by position it would be Ctrl+W, which closes the tab
      // on AZERTY). Camera flight and the tool digits use positions (e.code).
      const letter = e.key.length === 1 ? e.key.toLowerCase() : '';
      if (ctrl && letter === 's') {
        e.preventDefault();
        if (studio.writable) void studio.saveAll();
        else studio.print('warning', 'Studio en lecture seule : lancez « npm run dev » pour enregistrer.');
        return;
      }
      if (play) return;
      if (ctrl && letter === 'z' && !isTyping(e)) {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
        return;
      }
      if (ctrl && letter === 'y' && !isTyping(e)) {
        e.preventDefault();
        studio.redo();
        return;
      }
      // While flying (right button held), letters move the camera.
      if (isTyping(e) || !viewportVisible || viewportRef.current?.flying) return;
      if (ctrl && letter === 'd') {
        e.preventDefault();
        studio.duplicateSelection();
        return;
      }
      if (ctrl) return;
      if (e.code === 'Delete' || e.code === 'Backspace') {
        studio.deleteSelection();
        return;
      }
      if (TOOL_KEYS[e.code]) {
        studio.tool = TOOL_KEYS[e.code]!;
        studio.changed();
        return;
      }
      if (studio.tool === 'select' && (letter === 'w' || letter === 'e' || letter === 'r')) {
        studio.gizmo = letter === 'w' ? 'move' : letter === 'e' ? 'rotate' : 'scale';
        studio.changed();
        return;
      }
      if (e.code === 'Escape') {
        if (!viewportRef.current?.handleShortcut(e)) studio.select([]);
        return;
      }
      viewportRef.current?.handleShortcut(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio, play, viewportVisible]);

  // Unsaved work is never lost by closing the tab without warning.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (studio.project.dirty().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [studio]);

  return (
    <div className="st-app" data-testid="studio">
      <TopBar onPlay={startPlay} onValidate={() => void validate()} playing={!!play} />
      <aside className="st-left">
        <div className="st-panel" style={{ flex: 1.15 }}>
          <div className="st-panel__head">Explorateur</div>
          <div className="st-panel__body">
            <Explorer />
          </div>
        </div>
        <div className="st-panel">
          <div className="st-panel__head">Hiérarchie de la scène</div>
          <div className="st-panel__body">
            <Hierarchy />
          </div>
        </div>
      </aside>
      <main className="st-center">
        <Tabs />
        <div className="st-view">
          <div style={{ position: 'absolute', inset: 0, bottom: activeTab?.kind === 'cinematic' ? '46%' : 0 }}>
            <ViewportPanel active={viewportVisible && !play} />
          </div>
          {activeTab && activeTab.kind !== 'scene' && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: activeTab.kind === 'cinematic' ? '54%' : 0, background: 'var(--st-bg)', borderTop: activeTab.kind === 'cinematic' ? '1px solid var(--st-border)' : undefined }}>
              {activeTab.kind === 'script' || activeTab.kind === 'style' ? (
                ScriptEditor ? (
                  <Suspense fallback={<div className="st-empty">Chargement de l’éditeur de code…</div>}>
                    <ScriptEditor key={activeTab.path} path={activeTab.path} />
                  </Suspense>
                ) : (
                  <div className="st-empty">L’éditeur de scripts n’existe que sous le serveur de développement (npm run dev).</div>
                )
              ) : (
                <DocumentView key={activeTab.path} tab={activeTab} />
              )}
            </div>
          )}
        </div>
        <ConsolePanel report={report} onValidate={() => void validate()} />
      </main>
      <aside className="st-right">
        <div className="st-panel">
          <div className="st-panel__head">Inspecteur</div>
          <div className="st-panel__body">
            <Inspector />
          </div>
        </div>
      </aside>
      <StatusBar />
      {play && <Playtest studio={studio} request={play} onStop={stopPlay} />}
      {studio.busy && <div className="st-busy">{studio.busy}</div>}
    </div>
  );
}

function TopBar({ onPlay, onValidate, playing }: { onPlay: (here: boolean) => void; onValidate: () => void; playing: boolean }) {
  const studio = useStudio();
  const dirty = studio.project.dirty().length;
  const h = studio.history;
  return (
    <header className="st-top">
      <span className="st-brand">Civilization Studio</span>
      <label className="st-row" title="Civilisation éditée">
        <span style={{ color: 'var(--st-dim)' }}>Pack</span>
        <select
          className="st-select"
          style={{ width: 'auto' }}
          value={studio.packId ?? ''}
          data-testid="st-pack"
          onChange={(e) => {
            if (studio.project.dirty().length > 0 && !confirm('Des modifications ne sont pas encore enregistrées : elles restent en mémoire et seront écrites au prochain « Enregistrer ». Changer de pack ?')) return;
            void studio.openPack(e.target.value);
          }}
        >
          {!studio.packId && <option value="">—</option>}
          {studio.packList().map((p) => (
            <option key={p} value={p}>
              {studio.session.manifests.get(p) ? `${studio.t(studio.session.manifests.get(p)!.name)} (${p})` : p}
            </option>
          ))}
        </select>
      </label>
      <span className="st-top__sep" />
      <button type="button" className="st-btn st-btn--ghost" disabled={!h.canUndo} title={h.undoLabel ? `Annuler : ${h.undoLabel} (Ctrl+Z)` : 'Annuler (Ctrl+Z)'} onClick={() => studio.undo()} data-testid="st-undo">
        ↶
      </button>
      <button type="button" className="st-btn st-btn--ghost" disabled={!h.canRedo} title={h.redoLabel ? `Rétablir : ${h.redoLabel} (Ctrl+Y)` : 'Rétablir (Ctrl+Y)'} onClick={() => studio.redo()} data-testid="st-redo">
        ↷
      </button>
      <button type="button" className="st-btn" disabled={!studio.writable || dirty === 0} onClick={() => void studio.saveAll()} title="Enregistrer tous les fichiers modifiés (Ctrl+S)" data-testid="st-save">
        💾 Enregistrer{dirty ? ` (${dirty})` : ''}
      </button>
      <button type="button" className="st-btn" onClick={onValidate} disabled={!studio.packId} title="Vérifier références, textes et schémas" data-testid="st-validate">
        ✔ Valider
      </button>
      <span className="st-top__spacer" />
      {!studio.writable && <span className="st-badge st-badge--warn" title="Le serveur de développement (npm run dev) est nécessaire pour enregistrer et éditer les scripts.">Lecture seule</span>}
      <button type="button" className="st-btn st-btn--play" disabled={playing || !studio.scenePath} onClick={() => onPlay(true)} title="Jouer la scène ouverte depuis la caméra de l’éditeur" data-testid="st-play-here">
        ▶ Jouer ici
      </button>
      <button type="button" className="st-btn st-btn--play" disabled={playing || !studio.packId} onClick={() => onPlay(false)} title="Jouer la civilisation depuis son début" data-testid="st-play-start">
        ▶ Depuis le début
      </button>
      <a className="st-btn st-btn--ghost" href="/index.html" title="Ouvrir le jeu">
        Jeu
      </a>
    </header>
  );
}

function Tabs() {
  const studio = useStudio();
  return (
    <nav className="st-tabs" aria-label="Documents ouverts">
      {studio.tabs.map((t: StudioTab) => {
        const doc = studio.doc(t.path);
        const dirty = doc && studio.project.isDirty(doc);
        return (
          <button
            key={t.path}
            type="button"
            className={`st-tab ${studio.activeTab === t.path ? 'is-active' : ''}`}
            onClick={() => void studio.openDoc(t.path)}
            onAuxClick={(e) => e.button === 1 && studio.closeTab(t.path)}
            title={t.path}
          >
            <span>{TAB_ICON[t.kind] ?? '•'}</span>
            {t.title}
            {dirty ? ' ●' : ''}
            <span
              className="st-tab__close"
              role="button"
              aria-label="Fermer"
              onClick={(e) => {
                e.stopPropagation();
                studio.closeTab(t.path);
              }}
            >
              ×
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const TAB_ICON: Partial<Record<StudioTab['kind'], string>> = {
  scene: '▦',
  dialogue: '❝',
  quest: '◆',
  cinematic: '▶',
  logic: '⚙',
  items: '✦',
  characters: '☺',
  rules: '⚖',
  locale: 'Aa',
  manifest: '★',
  prefab: '❖',
  script: '{}',
  style: '#',
};

function StatusBar() {
  const studio = useStudio();
  const vp = viewportRef.current;
  const dirty = studio.project.dirty().length;
  return (
    <footer className="st-status">
      <span>{studio.writable ? 'Serveur de développement : enregistrement activé' : 'Lecture seule'}</span>
      <span>{dirty ? `${dirty} fichier(s) modifié(s)` : 'Tout est enregistré'}</span>
      {studio.scenePath && <span>{studio.selection.length ? `${studio.selection.length} sélectionnée(s)` : 'Aucune sélection'}</span>}
      {vp && (
        <span>
          {Math.round(vp.stats.fps)} i/s · {vp.stats.chunks} tronçons{vp.stats.pending ? ` (${vp.stats.pending} en attente)` : ''}
        </span>
      )}
      <span style={{ marginLeft: 'auto' }}>{studio.history.undoLabel ? `Dernière action : ${studio.history.undoLabel}` : ''}</span>
    </footer>
  );
}
