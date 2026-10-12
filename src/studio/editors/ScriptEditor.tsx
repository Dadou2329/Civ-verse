/**
 * Script editor (development only): Monaco on the pack's TypeScript files.
 *
 * Nothing typed here is ever evaluated by the page. « Enregistrer » writes the file through the
 * dev server's scoped API; Vite then compiles it like any other source module and the Studio
 * re-imports the pack (hot reload). Type errors come from the project's own TypeScript service
 * on the server (same tsconfig and SDK types as `npm run typecheck`) and are shown in the margin.
 * This module is excluded from production builds (see StudioApp: __CIV_STUDIO_AVAILABLE__).
 */
import { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { devApi, type DevDiagnostic } from '@engine/platform/devApi';
import { isWritablePackFile } from '@engine/platform/devApiRules';
import { useStudio } from '../hooks';
import { nextRevision } from '../core/project';

let configured = false;
function configureMonaco(): void {
  if (configured) return;
  configured = true;
  (self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker: (_id: string, label: string) => (label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker()),
  };
  const ts = monaco.typescript.typescriptDefaults;
  // The browser worker does not know the project's paths and SDK: semantic errors come from the
  // server's type checker instead; the worker keeps syntax checking and editing features.
  ts.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  ts.setCompilerOptions({
    target: monaco.typescript.ScriptTarget.ES2020,
    module: monaco.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.typescript.JsxEmit.ReactJSX,
    strict: true,
    allowNonTsExtensions: true,
  });
}

export default function ScriptEditor({ path }: { path: string }) {
  const studio = useStudio();
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [diags, setDiags] = useState<DevDiagnostic[] | null>(null);
  const [checking, setChecking] = useState(false);
  const doc = studio.doc(path);
  const dirty = !!doc && studio.project.isDirty(doc);
  // pack.ts and files outside the editable folders are shown, but saved only from a code editor.
  const writable = studio.writable && !!doc && isWritablePackFile(doc.rel);

  const check = async () => {
    setChecking(true);
    try {
      const r = await devApi.typecheck([path]);
      const mine = r.diagnostics.filter((d) => d.file === path);
      setDiags(mine);
      const model = editorRef.current?.getModel();
      if (model) {
        monaco.editor.setModelMarkers(
          model,
          'civ-typecheck',
          mine.map((d) => ({
            startLineNumber: d.line,
            startColumn: d.column,
            endLineNumber: d.endLine,
            endColumn: Math.max(d.endColumn, d.column + 1),
            message: d.message,
            severity: d.category === 'error' ? monaco.MarkerSeverity.Error : d.category === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
          })),
        );
      }
      const errors = mine.filter((d) => d.category === 'error').length;
      studio.print(errors ? 'error' : 'success', `Vérification des types de ${path} : ${errors} erreur(s) (${r.ms} ms).`, path);
    } catch (err) {
      studio.print('error', `Vérification impossible : ${(err as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    const d = studio.doc(path);
    if (!d || !studio.writable || !isWritablePackFile(d.rel)) return;
    try {
      await studio.project.save(d);
      studio.print('success', `Script enregistré : ${path} — le pack est rechargé.`, path);
      await check();
    } catch (err) {
      studio.print('error', `Enregistrement impossible : ${(err as Error).message}`, path);
    }
  };

  useEffect(() => {
    let disposed = false;
    configureMonaco();
    void (async () => {
      const d = studio.doc(path);
      if (!d) return;
      if (!d.loaded) await studio.project.load(path);
      if (disposed || !hostRef.current) return;
      const uri = monaco.Uri.parse(`file:///${path}`);
      const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(String(studio.doc(path)!.data ?? ''), path.endsWith('.css') ? 'css' : 'typescript', uri);
      const editor = monaco.editor.create(hostRef.current, {
        model,
        readOnly: !(studio.writable && isWritablePackFile(d.rel)),
        theme: 'vs-dark',
        automaticLayout: true,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        minimap: { enabled: false },
        tabSize: 2,
        scrollBeyondLastLine: false,
      });
      editorRef.current = editor;
      editor.onDidChangeModelContent(() => {
        if (studio.writable && isWritablePackFile(d.rel)) studio.project.setData(path, editor.getValue(), nextRevision());
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void save());
      void check();
    })();
    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div className="st-code" data-testid="st-script-editor">
      <div className="st-code__bar">
        <strong className="st-field__key" style={{ fontSize: '0.8rem' }}>
          {path}
          {dirty ? ' ●' : ''}
        </strong>
        <span style={{ flex: 1 }} />
        <button type="button" className="st-btn st-btn--small" onClick={() => void check()} disabled={checking}>
          {checking ? 'Vérification…' : 'Vérifier les types'}
        </button>
        {writable ? (
          <button type="button" className="st-btn st-btn--small st-btn--primary" onClick={() => void save()} disabled={!dirty} data-testid="st-script-save">
            Enregistrer et recharger (Ctrl+S)
          </button>
        ) : (
          <span className="st-badge" title="Ce fichier n’est pas dans un dossier modifiable par le Studio (mechanics, ui, view, assets, models) : modifiez-le dans votre éditeur de code.">
            Lecture seule
          </span>
        )}
      </div>
      <div className="st-code__host" ref={hostRef} />
      <div className="st-code__diags">
        {diags === null && <div className="st-empty">Vérification des types en cours…</div>}
        {diags?.length === 0 && <div className="st-line st-line--success" style={{ padding: '0.3rem 0.6rem' }}>Aucune erreur de type dans la version enregistrée.</div>}
        {diags?.map((d, i) => (
          <div
            key={i}
            className={`st-issue st-line--${d.category === 'error' ? 'error' : 'warning'}`}
            onClick={() => {
              editorRef.current?.revealLineInCenter(d.line);
              editorRef.current?.setPosition({ lineNumber: d.line, column: d.column });
              editorRef.current?.focus();
            }}
          >
            <span className="st-issue__where">
              {d.line}:{d.column}
            </span>
            {d.message}
          </div>
        ))}
      </div>
    </div>
  );
}
