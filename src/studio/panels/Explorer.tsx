/**
 * Explorer (files of the civilization by kind) and Hierarchy (entities of the open scene).
 */
import { useMemo, useState } from 'react';
import { devApi } from '@engine/platform/devApi';
import { VoxelVolume } from '@engine/core/voxel/volume';
import { volumeToDoc } from '@engine/core/world/sceneVoxels';
import type { EnvironmentDoc, SceneDoc } from '@engine/core/content/schemas';
import { useStudio, viewportRef } from '../hooks';
import { kindLabel, type Studio } from '../core/studio';
import type { DocKind, StudioDoc } from '../core/project';
import { Modal } from '../ui/Modal';

const GROUPS: { kind: DocKind; label: string; icon: string; creatable?: boolean }[] = [
  { kind: 'scene', label: 'Scènes', icon: '▦', creatable: true },
  { kind: 'dialogue', label: 'Dialogues', icon: '❝', creatable: true },
  { kind: 'quest', label: 'Quêtes', icon: '◆', creatable: true },
  { kind: 'cinematic', label: 'Cinématiques', icon: '▶', creatable: true },
  { kind: 'logic', label: 'Logique', icon: '⚙', creatable: true },
  { kind: 'prefab', label: 'Préfabriqués', icon: '❖' },
  { kind: 'items', label: 'Objets', icon: '✦' },
  { kind: 'characters', label: 'Personnages', icon: '☺' },
  { kind: 'rules', label: 'Règles des mécaniques', icon: '⚖' },
  { kind: 'locale', label: 'Textes', icon: 'Aa' },
  { kind: 'manifest', label: 'Civilisation et interface', icon: '★' },
  { kind: 'script', label: 'Scripts', icon: '{}' },
];

export function Explorer() {
  const studio = useStudio();
  const [closed, setClosed] = useState<Set<DocKind>>(new Set(['script', 'prefab']));
  const [creating, setCreating] = useState<DocKind | null>(null);
  const [newScript, setNewScript] = useState(false);
  const pack = studio.packId;
  if (!pack) return <div className="st-empty">Choisissez une civilisation.</div>;
  const toggle = (k: DocKind) => {
    const n = new Set(closed);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setClosed(n);
  };
  return (
    <ul className="st-tree" data-testid="st-explorer">
      {GROUPS.map((g) => {
        // Seed and test scripts are tools, not pack code: they are not listed.
        const docs = studio.project.docsOf(pack, g.kind).filter((d) => g.kind !== 'script' || !/^(seed|tests)\//.test(d.rel));
        if (g.kind === 'script' && !devApi.available()) return null;
        return (
          <li key={g.kind}>
            <div className="st-tree__group" onClick={() => toggle(g.kind)}>
              <span>{closed.has(g.kind) ? '▸' : '▾'}</span>
              {g.label}
              <span className="st-tree__meta">{docs.length}</span>
              {g.creatable && studio.writable && (
                <button
                  type="button"
                  className="st-btn st-btn--small st-btn--ghost"
                  title={`Nouveau : ${kindLabel(g.kind).toLowerCase()}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreating(g.kind);
                  }}
                >
                  ＋
                </button>
              )}
              {g.kind === 'script' && studio.writable && (
                <button
                  type="button"
                  className="st-btn st-btn--small st-btn--ghost"
                  title="Nouveau script"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewScript(true);
                  }}
                >
                  ＋
                </button>
              )}
            </div>
            {!closed.has(g.kind) && (
              <ul className="st-tree">
                {docs.map((d) => (
                  <li key={d.path}>
                    <DocItem studio={studio} doc={d} icon={g.icon} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      {creating && <NewDocModal studio={studio} kind={creating} onClose={() => setCreating(null)} />}
      {newScript && <NewScriptModal studio={studio} onClose={() => setNewScript(false)} />}
    </ul>
  );
}

function DocItem({ studio, doc, icon }: { studio: Studio; doc: StudioDoc; icon: string }) {
  const dirty = doc.loaded && studio.project.isDirty(doc);
  const label = doc.kind === 'script' ? doc.rel.replace(/^(mechanics|ui|view|assets|scripts)\//, '$1/') : doc.id;
  return (
    <button
      type="button"
      className={`st-tree__item ${studio.activeTab === doc.path ? 'is-selected' : ''} ${dirty ? 'is-dirty' : ''}`}
      title={doc.path}
      onClick={() => void studio.openDoc(doc.path)}
      data-testid={`st-doc-${doc.kind}-${doc.id}`}
    >
      <span className="st-ico">{icon}</span>
      {label}
    </button>
  );
}

// ------------------------------------------------------------------------------------------------
// New documents
// ------------------------------------------------------------------------------------------------

const DIR: Partial<Record<DocKind, [string, string]>> = {
  scene: ['content/scenes/', '.scene.json'],
  dialogue: ['content/dialogues/', '.dialogue.json'],
  quest: ['content/quests/', '.quest.json'],
  cinematic: ['content/cinematics/', '.cinematic.json'],
  logic: ['content/logic/', '.logic.json'],
};

const DEFAULT_ENV: EnvironmentDoc = {
  sky: { top: '#3a6ea8', horizon: '#c9d8e8', bottom: '#5a6a7a', stars: 0, sunDisc: true },
  sun: { direction: [0.4, -0.8, 0.3], color: '#fff2d8', intensity: 1 },
  ambient: { color: '#9aa8c0', intensity: 0.7 },
  hemi: { sky: '#c8d8f0', ground: '#5a5040', intensity: 0.6 },
  fog: { color: '#a8b8c8', density: 0.008 },
  blockLight: 1,
  particles: null,
  music: null,
  ambience: null,
  post: { exposure: 1, contrast: 1.05, saturation: 1, bloom: 0.35, vignette: 0.35 },
};

function NewDocModal({ studio, kind, onClose }: { studio: Studio; kind: DocKind; onClose: () => void }) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  // Typed as text and clamped when the scene is created (a keystroke must not be corrected).
  const [size, setSize] = useState<[string, string, string]>(['64', '32', '64']);
  const [error, setError] = useState<string | null>(null);
  const pack = studio.packId!;
  const create = () => {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return setError('Identifiant : lettres, chiffres, _ et - uniquement.');
    const dims = size.map((v) => Math.round(Number(v)));
    if (dims.some((n) => !Number.isFinite(n) || n < 8 || n > 256)) return setError('Taille : de 8 à 256 blocs dans chaque direction.');
    const [sx, sy, sz] = dims as [number, number, number];
    const [dir, ext] = DIR[kind]!;
    const rel = `${dir}${id}${ext}`;
    if (studio.project.doc(`civilizations/${pack}/${rel}`) && !studio.project.doc(`civilizations/${pack}/${rel}`)!.deleted) return setError('Ce fichier existe déjà.');
    const label = title.trim() || id;
    studio.history.transaction(`Nouveau : ${kindLabel(kind).toLowerCase()} ${id}`, () => {
      let data: unknown;
      switch (kind) {
        case 'scene': {
          const v = new VoxelVolume(sx, sy, sz);
          const ground = Math.min(4, sy - 2);
          for (let y = 0; y < ground; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) v.set(x, y, z, y === ground - 1 ? 'core:grass' : 'core:dirt');
          const env = studio.sceneDoc()?.environment ?? DEFAULT_ENV;
          data = {
            format: 'civverse.scene',
            version: 1,
            id,
            name: studio.newTextKey(`scene.${id}`, label),
            environment: structuredClone(env),
            voxels: volumeToDoc(v),
            entities: [{ id: 'depart', position: [Math.floor(sx / 2) + 0.5, ground, Math.floor(sz / 2) + 0.5], components: { 'core.spawn': { isDefault: true } } }],
          } satisfies SceneDoc;
          const manifestPath = `civilizations/${pack}/manifest.json`;
          if (studio.project.doc(manifestPath)) studio.editDoc<{ scenes: string[] }>(manifestPath, 'Déclarer la scène', (m) => ({ ...m, scenes: [...(m.scenes ?? []), id] }));
          break;
        }
        case 'dialogue':
          data = { format: 'civverse.dialogue', version: 1, id, title: label, start: 'debut', nodes: [{ id: 'debut', speaker: 'narrator', text: studio.newTextKey(`dlg.${id}.debut`, '…'), end: true }] };
          break;
        case 'quest':
          data = {
            format: 'civverse.quest',
            version: 1,
            id,
            title: studio.newTextKey(`quest.${id}.title`, label),
            summary: studio.newTextKey(`quest.${id}.summary`, 'Résumé de la quête.'),
            kind: 'main',
            order: studio.project.docsOf(pack, 'quest').length,
            autoStart: false,
            stages: [{ id: 'etape1', description: studio.newTextKey(`quest.${id}.etape1`, 'Première étape.'), completion: 'all', objectives: [{ id: 'objectif1', text: studio.newTextKey(`quest.${id}.etape1.objectif1`, 'Premier objectif') }] }],
          };
          break;
        case 'cinematic': {
          const pose = viewportRef.current?.cameraPose();
          data = {
            format: 'civverse.cinematic',
            version: 1,
            id,
            title: label,
            duration: 8,
            skippable: true,
            letterbox: true,
            lockPlayer: true,
            hideHud: true,
            returnCamera: 'blend',
            tracks: [
              { type: 'camera', keys: pose ? [{ t: 0, position: pose.position, target: pose.target, fov: 60 }] : [] },
              { type: 'subtitle', items: [] },
            ],
            onComplete: [],
          };
          break;
        }
        case 'logic':
          data = { format: 'civverse.logic', version: 1, id, title: label, rules: [] };
          break;
      }
      studio.createDoc(pack, rel, data);
    });
    void studio.openDoc(`civilizations/${pack}/${DIR[kind]![0]}${id}${DIR[kind]![1]}`);
    onClose();
  };
  return (
    <Modal title={`Nouveau : ${kindLabel(kind).toLowerCase()}`} onClose={onClose} actions={<button type="button" className="st-btn st-btn--primary" onClick={create}>Créer</button>}>
      <div className="st-field">
        <div className="st-field__label">Identifiant</div>
        <input className="st-input st-input--mono" autoFocus value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="mon_dialogue" />
      </div>
      <div className="st-field">
        <div className="st-field__label">{kind === 'scene' ? 'Nom du lieu' : 'Titre'}</div>
        <input className="st-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="En français" />
      </div>
      {kind === 'scene' && (
        <div className="st-field">
          <div className="st-field__label">Taille (blocs)</div>
          <div className="st-vec">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                className="st-input"
                type="number"
                min={8}
                max={256}
                value={size[i]}
                onChange={(e) => {
                  const n = [...size] as [string, string, string];
                  n[i] = e.target.value;
                  setSize(n);
                }}
              />
            ))}
          </div>
        </div>
      )}
      {error && <div className="st-line--error">{error}</div>}
      <p className="st-field__help">Le fichier est créé à l’enregistrement (Ctrl+S).</p>
    </Modal>
  );
}

function NewScriptModal({ studio, onClose }: { studio: Studio; onClose: () => void }) {
  const [kind, setKind] = useState<'behavior' | 'action' | 'condition' | 'mechanic'>('behavior');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    try {
      const res = await devApi.scaffold(studio.packId!, kind, name);
      await studio.project.refreshListing();
      await studio.openDoc(res.path);
      studio.print('success', `Script créé : ${res.path} (identifiant ${res.id})`, res.path);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Modal title="Nouveau script" onClose={onClose} actions={<button type="button" className="st-btn st-btn--primary" onClick={() => void create()}>Créer le script</button>}>
      <div className="st-field">
        <div className="st-field__label">Type</div>
        <select className="st-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="behavior">Comportement (composant d’entité)</option>
          <option value="action">Action de logique</option>
          <option value="condition">Condition de logique</option>
          <option value="mechanic">Mécanique (règle du monde)</option>
        </select>
      </div>
      <div className="st-field">
        <div className="st-field__label">Nom</div>
        <input className="st-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Porte à résonance" />
      </div>
      {error && <div className="st-line--error">{error}</div>}
      <p className="st-field__help">
        Le fichier est créé tout de suite dans <code>mechanics/</code> à partir d’un modèle typé ; le pack le découvre automatiquement et ses définitions apparaissent dans les menus du Studio.
      </p>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------------
// Hierarchy
// ------------------------------------------------------------------------------------------------

export function Hierarchy() {
  const studio = useStudio();
  const [filter, setFilter] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const scene = studio.sceneDoc();
  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scene>['entities']>();
    const f = filter.trim().toLowerCase();
    for (const e of scene?.entities ?? []) {
      if (f && !e.id.toLowerCase().includes(f) && !(e.name ?? '').toLowerCase().includes(f) && !Object.keys(e.components).some((c) => c.toLowerCase().includes(f))) continue;
      const folder = e.folder ?? 'Sans dossier';
      map.set(folder, [...(map.get(folder) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [scene, filter]);
  if (!scene) return <div className="st-empty">Aucune scène ouverte.</div>;
  const selected = new Set(studio.selection);
  return (
    <div>
      <div style={{ padding: '0.3rem 0.5rem' }}>
        <input className="st-input" placeholder="Filtrer (identifiant, nom, composant)…" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="st-hierarchy-filter" />
      </div>
      <ul className="st-tree" data-testid="st-hierarchy">
        {groups.map(([folder, list]) => (
          <li key={folder}>
            <div
              className="st-tree__group"
              onClick={() => {
                const n = new Set(closed);
                if (n.has(folder)) n.delete(folder);
                else n.add(folder);
                setClosed(n);
              }}
            >
              <span>{closed.has(folder) ? '▸' : '▾'}</span>
              {folder}
              <span className="st-tree__meta">{list.length}</span>
            </div>
            {!closed.has(folder) &&
              list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`st-tree__item ${selected.has(e.id) ? 'is-selected' : ''}`}
                  onClick={(ev) => studio.select([e.id], ev.ctrlKey || ev.metaKey ? 'toggle' : ev.shiftKey ? 'add' : 'replace')}
                  onDoubleClick={() => viewportRef.current?.frameSelection()}
                  data-testid={`st-entity-${e.id}`}
                >
                  <span className="st-ico">{entityIcon(Object.keys(e.components))}</span>
                  {e.name || e.id}
                  {e.editor?.locked && <span className="st-tree__meta">🔒</span>}
                </button>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function entityIcon(types: string[]): string {
  if (types.includes('core.npc')) return '☺';
  if (types.includes('core.door')) return '⌂';
  if (types.includes('core.spawn')) return '⚑';
  if (types.includes('core.trigger') || types.includes('core.zone')) return '▢';
  if (types.includes('core.light')) return '✺';
  if (types.includes('core.sign')) return '▭';
  if (types.includes('core.marker')) return '◇';
  if (types.includes('core.particles')) return '∴';
  if (types.includes('core.model')) return '▣';
  return '•';
}
