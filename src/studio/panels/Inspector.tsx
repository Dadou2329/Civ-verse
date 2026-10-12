/**
 * Inspector: the selected entity (identity, transform, components) or, without selection, the
 * scene itself (name, environment, saved camera).
 */
import { useState } from 'react';
import { prop, type PropSchema } from '@engine/core/props/props';
import type { EntityDoc, EnvironmentDoc, SceneDoc } from '@engine/core/content/schemas';
import { useStudio, viewportRef } from '../hooks';
import { PropFields, TextField, Vec3Input } from '../fields/PropField';
import { updateEntities, updateEntity, setEnvironment } from '../core/edits';
import type { Studio } from '../core/studio';

export function Inspector() {
  const studio = useStudio();
  const scene = studio.sceneDoc();
  if (!scene) return <div className="st-empty">Ouvrez une scène pour inspecter ses entités.</div>;
  const sel = studio.selection.map((id) => scene.entities.find((e) => e.id === id)).filter((e): e is EntityDoc => !!e);
  if (sel.length === 1) return <EntityInspector studio={studio} entity={sel[0]!} />;
  if (sel.length > 1) return <MultiInspector studio={studio} entities={sel} />;
  return <SceneInspector studio={studio} scene={scene} />;
}

function Section({ title, sub, children, actions, defaultOpen = true }: { title: string; sub?: string; children: React.ReactNode; actions?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="st-section">
      <div className="st-section__head" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span>
        <span>{title}</span>
        {sub && <small>{sub}</small>}
        <span style={{ flex: 1 }} />
        <span onClick={(e) => e.stopPropagation()}>{actions}</span>
      </div>
      {open && <div className="st-section__body">{children}</div>}
    </section>
  );
}

function EntityInspector({ studio, entity }: { studio: Studio; entity: EntityDoc }) {
  const [idDraft, setIdDraft] = useState<string | null>(null);
  // What is typed in « Étiquettes » (with its commas and spaces) while the field has the focus.
  const [tagsDraft, setTagsDraft] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const id = entity.id;
  const edit = (label: string, fn: (e: EntityDoc) => EntityDoc | void, merge?: string) => studio.editScene(label, (s) => updateEntity(s, id, fn), merge ? `${id}|${merge}` : undefined);
  const env = { studio, keyHint: `${studio.sceneDoc()?.id ?? 'scene'}.${id}` };
  const types = Object.keys(entity.components);
  return (
    <div>
      <Section title="Entité" sub={id}>
        <div className="st-field">
          <div className="st-field__label">Identifiant</div>
          <div>
            <input
              className={`st-input st-input--mono ${idError ? 'is-invalid' : ''}`}
              value={idDraft ?? id}
              onChange={(e) => setIdDraft(e.target.value)}
              onBlur={() => {
                if (idDraft !== null && idDraft !== id) setIdError(studio.renameEntity(id, idDraft));
                setIdDraft(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            {idError && <div className="st-line--error">{idError}</div>}
          </div>
        </div>
        <div className="st-field">
          <div className="st-field__label">Nom (éditeur)</div>
          <input className="st-input" value={entity.name ?? ''} placeholder="Libellé dans la hiérarchie" onChange={(e) => edit('Renommer (éditeur)', (d) => void (d.name = e.target.value || undefined), 'name')} />
        </div>
        <div className="st-field">
          <div className="st-field__label">Dossier</div>
          <input className="st-input" value={entity.folder ?? ''} placeholder="Quartier/Maisons" onChange={(e) => edit('Changer de dossier', (d) => void (d.folder = e.target.value || undefined), 'folder')} />
        </div>
        <div className="st-field">
          <div className="st-field__label">Étiquettes</div>
          <input
            className="st-input"
            value={tagsDraft ?? (entity.tags ?? []).join(', ')}
            placeholder="garde, ronde"
            onChange={(e) => {
              setTagsDraft(e.target.value);
              edit(
                'Étiquettes',
                (d) =>
                  void (d.tags = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)),
                'tags',
              );
            }}
            onBlur={() => setTagsDraft(null)}
          />
        </div>
        <div className="st-field">
          <div className="st-field__label">Éditeur</div>
          <div className="st-row">
            <label className="st-check">
              <input type="checkbox" checked={!!entity.editor?.locked} onChange={(e) => edit('Verrouiller', (d) => void (d.editor = { ...d.editor, locked: e.target.checked || undefined }))} />
              Verrouillée
            </label>
          </div>
        </div>
      </Section>
      <Section title="Transformation">
        <div className="st-field">
          <div className="st-field__label">Position</div>
          <Vec3Input testId="st-position" value={entity.position} step={0.5} onChange={(v, m) => edit(`Déplacer « ${id} »`, (d) => void (d.position = v), m ? `pos|${m}` : 'pos')} />
        </div>
        <div className="st-field">
          <div className="st-field__label">Rotation (°)</div>
          <Vec3Input testId="st-rotation" value={entity.rotation ?? [0, 0, 0]} step={15} onChange={(v, m) => edit(`Tourner « ${id} »`, (d) => void (d.rotation = v), m ? `rot|${m}` : 'rot')} />
        </div>
        <div className="st-field">
          <div className="st-field__label">Échelle</div>
          <Vec3Input value={entity.scale ?? [1, 1, 1]} step={0.1} onChange={(v, m) => edit(`Redimensionner « ${id} »`, (d) => void (d.scale = v), m ? `scale|${m}` : 'scale')} />
        </div>
        <div className="st-row" style={{ marginTop: 6 }}>
          {[0, 90, 180, 270].map((yaw) => (
            <button key={yaw} type="button" className="st-btn st-btn--small" onClick={() => edit(`Orienter « ${id} »`, (d) => void (d.rotation = [d.rotation?.[0] ?? 0, yaw, d.rotation?.[2] ?? 0]))}>
              {yaw}°
            </button>
          ))}
          <button type="button" className="st-btn st-btn--small" title="Centrer la vue sur l’entité (F)" onClick={() => viewportRef.current?.frameSelection()}>
            Cadrer
          </button>
        </div>
      </Section>
      {types.map((type) => {
        const reg = studio.session.behaviorDefs.get(type);
        const def = reg?.def;
        const raw = entity.components[type] ?? {};
        return (
          <Section
            key={type}
            title={def?.label ?? type}
            sub={type}
            actions={
              <button type="button" className="st-btn st-btn--small st-btn--ghost st-btn--danger" title="Retirer ce composant" onClick={() => edit(`Retirer ${def?.label ?? type}`, (d) => void delete d.components[type])}>
                ✕
              </button>
            }
          >
            {def?.description && <div className="st-field__help" style={{ marginBottom: 4 }}>{def.description}</div>}
            {def ? (
              <PropFields
                schema={def.props}
                value={studio.componentProps(type, raw)}
                env={{ ...env, keyHint: `${env.keyHint}` }}
                onChange={(next, merge) =>
                  edit(`${def.label} : modifier`, (d) => void (d.components[type] = compact(def.props, next)), merge ? `${type}|${merge}` : undefined)
                }
              />
            ) : (
              <div className="st-line--warning">Composant inconnu (aucun pack chargé ne le définit) : ses données sont conservées.</div>
            )}
          </Section>
        );
      })}
      <AddComponent studio={studio} entity={entity} />
    </div>
  );
}

/** Keeps only values that differ from the defaults (tidy JSON). */
function compact(schema: PropSchema, value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const def = schema[k];
    if (!def) {
      out[k] = v;
      continue;
    }
    if (JSON.stringify(v) !== JSON.stringify(def.default)) out[k] = v;
  }
  return out;
}

function AddComponent({ studio, entity }: { studio: Studio; entity: EntityDoc }) {
  const groups = new Map<string, { id: string; label: string }[]>();
  for (const [id, { def }] of studio.session.behaviorDefs) {
    if (entity.components[id] || def.internal) continue;
    const cat = def.category ?? 'Divers';
    groups.set(cat, [...(groups.get(cat) ?? []), { id, label: def.label }]);
  }
  return (
    <div style={{ padding: '0.6rem' }}>
      <select
        className="st-select"
        value=""
        data-testid="st-add-component"
        onChange={(e) => {
          const type = e.target.value;
          if (!type) return;
          const def = studio.session.behaviorDefs.get(type)?.def;
          const missing = (def?.requires ?? []).filter((r: string) => !entity.components[r]);
          studio.editScene(`Ajouter ${def?.label ?? type}`, (s) =>
            updateEntity(s, entity.id, (d) => {
              for (const r of missing) d.components[r] = {};
              d.components[type] = {};
            }),
          );
        }}
      >
        <option value="">＋ Ajouter un composant…</option>
        {[...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
          .map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list
                .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </optgroup>
          ))}
      </select>
    </div>
  );
}

function MultiInspector({ studio, entities }: { studio: Studio; entities: EntityDoc[] }) {
  const ids = entities.map((e) => e.id);
  const [delta, setDelta] = useState<[number, number, number]>([0, 0, 0]);
  return (
    <div>
      <Section title={`${entities.length} entités sélectionnées`}>
        <ul className="st-tree">
          {entities.map((e) => (
            <li key={e.id} className="st-field__key">
              {e.id}
            </li>
          ))}
        </ul>
        <div className="st-field">
          <div className="st-field__label">Décaler de</div>
          <Vec3Input value={delta} step={0.5} onChange={(v) => setDelta(v)} />
        </div>
        <div className="st-row">
          <button
            type="button"
            className="st-btn st-btn--small"
            onClick={() =>
              studio.editScene(`Déplacer ${ids.length} entités`, (s) =>
                updateEntities(s, ids, (d) => void (d.position = [d.position[0] + delta[0], d.position[1] + delta[1], d.position[2] + delta[2]])),
              )
            }
          >
            Appliquer le décalage
          </button>
          <button type="button" className="st-btn st-btn--small" onClick={() => studio.duplicateSelection()}>
            Dupliquer
          </button>
          <button type="button" className="st-btn st-btn--small st-btn--danger" onClick={() => studio.deleteSelection()}>
            Supprimer
          </button>
        </div>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Scene: environment
// ------------------------------------------------------------------------------------------------

const color = (label: string) => prop.color({ label });
const slider = (label: string, min: number, max: number, step: number) => prop.number({ label, min, max, step, slider: true });

const ENV_SCHEMA: PropSchema = {
  sky: prop.object(
    { top: color('Zénith'), horizon: color('Horizon'), bottom: color('Sous l’horizon'), stars: slider('Étoiles', 0, 1, 0.05), sunDisc: prop.boolean({ label: 'Disque visible' }), discColor: color('Couleur du disque') },
    { label: 'Ciel' },
  ),
  sun: prop.object({ direction: prop.vec3({ label: 'Direction', step: 0.05 }), color: color('Couleur'), intensity: slider('Intensité', 0, 3, 0.05) }, { label: 'Soleil' }),
  ambient: prop.object({ color: color('Couleur'), intensity: slider('Intensité', 0, 2, 0.02) }, { label: 'Lumière ambiante (blocs)' }),
  hemi: prop.object({ sky: color('Ciel'), ground: color('Sol'), intensity: slider('Intensité', 0, 2, 0.02) }, { label: 'Lumière des personnages' }),
  fog: prop.object({ color: color('Couleur'), density: slider('Densité', 0, 0.1, 0.001) }, { label: 'Brouillard' }),
  blockLight: slider('Lumière des lanternes', 0, 3, 0.05),
  music: prop.music({ label: 'Musique' }),
  ambience: prop.sound({ label: 'Ambiance sonore' }),
  post: prop.object(
    { exposure: slider('Exposition', 0.3, 2, 0.02), contrast: slider('Contraste', 0.5, 1.6, 0.02), saturation: slider('Saturation', 0, 1.6, 0.02), bloom: slider('Halo', 0, 2, 0.05), vignette: slider('Vignettage', 0, 1.5, 0.02) },
    { label: 'Rendu' },
  ),
};

const PRESETS = ['dust', 'embers', 'motes', 'smoke', 'sparks', 'memory', 'stars'] as const;
const PRESET_LABEL: Record<(typeof PRESETS)[number], string> = {
  dust: 'Poussière',
  embers: 'Braises',
  motes: 'Lucioles',
  smoke: 'Fumée',
  sparks: 'Étincelles',
  memory: 'Éclats de mémoire',
  stars: 'Étoiles',
};

function SceneInspector({ studio, scene }: { studio: Studio; scene: SceneDoc }) {
  const env = scene.environment;
  const setEnv = (next: EnvironmentDoc, merge?: string) => studio.editScene('Environnement', (s) => setEnvironment(s, next), merge ? `env|${merge}` : undefined);
  const fieldEnv = { studio, keyHint: `scene.${scene.id}` };
  return (
    <div>
      <Section title="Scène" sub={scene.id}>
        <div className="st-field">
          <div className="st-field__label">Nom du lieu</div>
          <TextField value={scene.name} env={fieldEnv} onChange={(k, m) => studio.editScene('Nom de la scène', (s) => ({ ...s, name: k }), m ? `name|${m}` : undefined)} />
        </div>
        <div className="st-field">
          <div className="st-field__label">Taille</div>
          <div className="st-field__key">
            {scene.voxels.size.join(' × ')} blocs · {scene.entities.length} entités
          </div>
        </div>
        <div className="st-field">
          <div className="st-field__label">Notes</div>
          <textarea className="st-textarea" value={scene.editor?.notes ?? ''} onChange={(e) => studio.editScene('Notes', (s) => ({ ...s, editor: { ...s.editor, notes: e.target.value } }), 'notes')} />
        </div>
        <button
          type="button"
          className="st-btn st-btn--small"
          title="La scène s’ouvrira avec ce point de vue"
          onClick={() => {
            const pose = viewportRef.current?.cameraPose();
            if (pose) studio.editScene('Mémoriser la vue', (s) => ({ ...s, editor: { ...s.editor, camera: { position: round3(pose.position), target: round3(pose.target) } } }));
          }}
        >
          Mémoriser la vue actuelle
        </button>
      </Section>
      <Section title="Environnement">
        <PropFields schema={ENV_SCHEMA} value={env as unknown as Record<string, unknown>} env={fieldEnv} onChange={(next, merge) => setEnv({ ...env, ...(next as unknown as EnvironmentDoc) }, merge)} />
        <div className="st-field">
          <div className="st-field__label">Particules</div>
          <div className="st-row">
            <select
              className="st-select"
              value={env.particles?.preset ?? ''}
              onChange={(e) => setEnv({ ...env, particles: e.target.value ? { preset: e.target.value, density: env.particles?.density ?? 0.5 } : null })}
            >
              <option value="">Aucune</option>
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PRESET_LABEL[p]}
                </option>
              ))}
            </select>
            {env.particles && (
              <input
                className="st-input"
                type="number"
                min={0}
                max={3}
                step={0.1}
                value={env.particles.density}
                style={{ width: 70, flex: 'none' }}
                onChange={(e) => setEnv({ ...env, particles: { preset: env.particles!.preset, density: Number(e.target.value) } }, 'particles')}
              />
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function round3(v: [number, number, number]): [number, number, number] {
  return [Math.round(v[0] * 100) / 100, Math.round(v[1] * 100) / 100, Math.round(v[2] * 100) / 100];
}
