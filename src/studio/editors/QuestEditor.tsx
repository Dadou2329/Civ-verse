/**
 * Quest editor: title and summary, start and failure rules, stages and their objectives (how
 * each objective is completed, which entity the tracker points at).
 */
import type { QuestDoc } from '@engine/core/content/schemas';
import { ActionsEditor, ConditionEditor, EventEditor } from '../fields/LogicEditors';
import { NumberInput, RefInput, TextField } from '../fields/PropField';
import { freeId, ListTools, moveItem, removeAt, replaceAt, Row, useDoc } from './common';

type Stage = QuestDoc['stages'][number];
type Objective = Stage['objectives'][number];

export function QuestEditor({ path }: { path: string }) {
  const h = useDoc<QuestDoc>(path);
  if (!h) return null;
  const { data, edit, env, studio } = h;
  const set = <K extends keyof QuestDoc>(key: K, v: QuestDoc[K], label: string, merge?: string) => edit(label, (d) => ({ ...d, [key]: v }), merge ? `${String(key)}|${merge}` : undefined);
  const setStage = (i: number, s: Stage, label: string, merge?: string) => edit(label, (d) => ({ ...d, stages: replaceAt(d.stages, i, s) }), merge ? `stage${i}|${merge}` : undefined);
  return (
    <div className="st-editor" data-testid="st-quest-editor">
      <h2>Quête — {studio.t(data.title)}</h2>
      <Row label="Titre">
        <TextField value={data.title} env={{ ...env, keyHint: `quest.${data.id}.title` }} onChange={(k, m) => set('title', k, 'Titre de quête', m)} />
      </Row>
      <Row label="Résumé">
        <TextField value={data.summary} multiline env={{ ...env, keyHint: `quest.${data.id}.summary` }} onChange={(k, m) => set('summary', k, 'Résumé de quête', m)} />
      </Row>
      <Row label="Type">
        <select className="st-select" value={data.kind} onChange={(e) => set('kind', e.target.value as QuestDoc['kind'], 'Type de quête')}>
          <option value="main">Principale</option>
          <option value="side">Secondaire</option>
        </select>
      </Row>
      <Row label="Ordre dans le journal">
        <NumberInput value={data.order} step={1} integer onChange={(n, m) => set('order', n, 'Ordre', m)} />
      </Row>
      <h3>Démarrage</h3>
      <Row label="Automatique">
        <label className="st-check">
          <input type="checkbox" checked={data.autoStart} onChange={(e) => set('autoStart', e.target.checked, 'Démarrage automatique')} />
          Démarre dès le chargement de la civilisation
        </label>
      </Row>
      <Row label="Démarre quand">
        <ConditionEditor value={data.startWhen ?? null} env={env} onChange={(c, m) => set('startWhen', c, 'Condition de démarrage', m)} />
      </Row>
      <Row label="Ou à l’événement">
        <EventEditor value={data.startOn ?? null} env={env} onChange={(ev, m) => set('startOn', ev, 'Événement de démarrage', m)} />
      </Row>
      <Row label="Au démarrage">
        <ActionsEditor value={data.onStart ?? []} env={{ ...env, keyHint: `quest.${data.id}.start` }} onChange={(a, m) => set('onStart', a, 'Actions au démarrage', m)} />
      </Row>
      <h3>Étapes</h3>
      {data.stages.map((stage, i) => (
        <section key={i} className="st-list__item" style={{ marginBottom: '0.6rem' }}>
          <div className="st-list__head">
            <strong style={{ color: 'var(--st-text)' }}>Étape {i + 1}</strong>
            <input className="st-input st-input--mono" style={{ width: 160 }} value={stage.id} onChange={(e) => setStage(i, { ...stage, id: e.target.value }, 'Identifiant d’étape', 'id')} />
            <span className="st-spacer" />
            <ListTools index={i} count={data.stages.length} onMove={(dir) => edit('Réordonner les étapes', (d) => ({ ...d, stages: moveItem(d.stages, i, dir) }))} canRemove={data.stages.length > 1} onRemove={() => edit('Supprimer une étape', (d) => ({ ...d, stages: removeAt(d.stages, i) }))} />
          </div>
          <Row label="Description">
            <TextField value={stage.description} multiline env={{ ...env, keyHint: `quest.${data.id}.${stage.id}` }} onChange={(k, m) => setStage(i, { ...stage, description: k }, 'Description d’étape', m ? `desc|${m}` : undefined)} />
          </Row>
          <Row label="Terminée quand">
            <select className="st-select" value={stage.completion} onChange={(e) => setStage(i, { ...stage, completion: e.target.value as Stage['completion'] }, 'Achèvement de l’étape')}>
              <option value="all">Tous les objectifs obligatoires sont remplis</option>
              <option value="any">Un seul objectif suffit (solutions alternatives)</option>
            </select>
          </Row>
          <div style={{ marginLeft: '0.4rem' }}>
            {stage.objectives.map((o, k) => (
              <ObjectiveEditor
                key={k}
                objective={o}
                index={k}
                count={stage.objectives.length}
                keyHint={`quest.${data.id}.${stage.id}.${o.id}`}
                env={env}
                onChange={(no, label, m) => setStage(i, { ...stage, objectives: replaceAt(stage.objectives, k, no) }, label, m ? `obj${k}|${m}` : undefined)}
                onMove={(dir) => setStage(i, { ...stage, objectives: moveItem(stage.objectives, k, dir) }, 'Réordonner les objectifs')}
                onRemove={() => setStage(i, { ...stage, objectives: removeAt(stage.objectives, k) }, 'Supprimer un objectif')}
              />
            ))}
            <button
              type="button"
              className="st-btn st-btn--small"
              onClick={() =>
                studio.history.transaction('Nouvel objectif', () => {
                  const id = freeId(
                    stage.objectives.map((o) => o.id),
                    'objectif',
                  );
                  const text = studio.newTextKey(`quest.${data.id}.${stage.id}.${id}`, 'Nouvel objectif');
                  setStage(i, { ...stage, objectives: [...stage.objectives, { id, text }] }, 'Nouvel objectif');
                })
              }
            >
              ＋ Objectif
            </button>
          </div>
          <Row label="À la fin de l’étape">
            <ActionsEditor value={stage.onComplete ?? []} env={{ ...env, keyHint: `quest.${data.id}.${stage.id}.fin` }} onChange={(a, m) => setStage(i, { ...stage, onComplete: a }, 'Actions de fin d’étape', m ? `end|${m}` : undefined)} />
          </Row>
        </section>
      ))}
      <button
        type="button"
        className="st-btn"
        onClick={() =>
          studio.history.transaction('Nouvelle étape', () => {
            const id = freeId(
              data.stages.map((s) => s.id),
              'etape',
            );
            const description = studio.newTextKey(`quest.${data.id}.${id}`, 'Nouvelle étape.');
            edit('Nouvelle étape', (d) => ({ ...d, stages: [...d.stages, { id, description, completion: 'all', objectives: [] }] }));
          })
        }
      >
        ＋ Étape
      </button>
      <h3>Fin et échec</h3>
      <Row label="À la fin de la quête">
        <ActionsEditor value={data.onComplete ?? []} env={{ ...env, keyHint: `quest.${data.id}.fin` }} onChange={(a, m) => set('onComplete', a, 'Actions de fin de quête', m)} />
      </Row>
      <Row label="Échoue quand">
        <ConditionEditor value={data.failWhen ?? null} env={env} onChange={(c, m) => set('failWhen', c, 'Condition d’échec', m)} />
      </Row>
      {data.failWhen && (
        <Row label="En cas d’échec">
          <ActionsEditor value={data.onFail ?? []} env={{ ...env, keyHint: `quest.${data.id}.echec` }} onChange={(a, m) => set('onFail', a, 'Actions d’échec', m)} />
        </Row>
      )}
    </div>
  );
}

function ObjectiveEditor({
  objective: o,
  index,
  count,
  keyHint,
  env,
  onChange,
  onMove,
  onRemove,
}: {
  objective: Objective;
  index: number;
  count: number;
  keyHint: string;
  env: Parameters<typeof TextField>[0]['env'];
  onChange: (o: Objective, label: string, merge?: string) => void;
  onMove: (d: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="st-block" style={{ marginBottom: '0.4rem' }}>
      <div className="st-block__head">
        <span className="st-block__title">Objectif</span>
        <input className="st-input st-input--mono" style={{ width: 150 }} value={o.id} onChange={(e) => onChange({ ...o, id: e.target.value }, 'Identifiant d’objectif', 'id')} />
        <span style={{ flex: 1 }} />
        <ListTools index={index} count={count} onMove={onMove} onRemove={onRemove} />
      </div>
      <div className="st-block__body">
        <Row label="Texte">
          <TextField value={o.text} env={{ ...env, keyHint }} onChange={(k, m) => onChange({ ...o, text: k }, 'Texte d’objectif', m ? `text|${m}` : undefined)} />
        </Row>
        <Row label="Options">
          <div className="st-row">
            <label className="st-check">
              <input type="checkbox" checked={!!o.optional} onChange={(e) => onChange({ ...o, optional: e.target.checked || undefined }, 'Objectif facultatif')} />
              Facultatif
            </label>
            <label className="st-check">
              <input type="checkbox" checked={!!o.hidden} onChange={(e) => onChange({ ...o, hidden: e.target.checked || undefined }, 'Objectif caché')} />
              Caché
            </label>
          </div>
        </Row>
        <Row label="Rempli quand">
          <ConditionEditor value={o.completeWhen ?? null} env={env} onChange={(c, m) => onChange({ ...o, completeWhen: c }, 'Condition d’objectif', m ? `when|${m}` : undefined)} />
        </Row>
        <Row label="Ou à l’événement">
          <EventEditor value={o.completeOn ?? null} env={env} onChange={(ev, m) => onChange({ ...o, completeOn: ev }, 'Événement d’objectif', m ? `on|${m}` : undefined)} />
        </Row>
        <Row label="Progression" help="Affiche « valeur / total » à partir d’une variable">
          <div className="st-row">
            <RefInput kind="variable" value={o.progress?.var ?? ''} env={env} onChange={(v, m) => onChange({ ...o, progress: v ? { var: v, count: o.progress?.count ?? 1 } : undefined }, 'Progression', m ? `pv|${m}` : undefined)} />
            {o.progress && <NumberInput value={o.progress.count} min={1} step={1} integer onChange={(n, m) => onChange({ ...o, progress: { var: o.progress!.var, count: n } }, 'Progression', m ? `pc|${m}` : undefined)} />}
          </div>
        </Row>
        <Row label="Cible (repère)">
          <div className="st-row">
            <RefInput kind="entity" value={o.target ?? ''} env={env} onChange={(v, m) => onChange({ ...o, target: v || undefined }, 'Cible d’objectif', m ? `target|${m}` : undefined)} />
            <RefInput kind="scene" value={o.targetScene ?? ''} env={env} onChange={(v, m) => onChange({ ...o, targetScene: v || undefined }, 'Scène de la cible', m ? `ts|${m}` : undefined)} />
          </div>
        </Row>
      </div>
    </div>
  );
}
