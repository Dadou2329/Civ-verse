/**
 * Dialogue editor: the dialogue as a graph (lines, player choices, conditional branches) with an
 * inspector for the selected node. Nodes can be dragged; their position is saved in the file.
 */
import { useMemo, useRef, useState } from 'react';
import type { DialogueDoc, DialogueNodeDoc } from '@engine/core/content/schemas';
import { ActionsEditor, ConditionEditor } from '../fields/LogicEditors';
import { TextField } from '../fields/PropField';
import { freeId, ListTools, moveItem, removeAt, replaceAt, Row, useDoc, type DocHandle } from './common';

const NODE_W = 240;
const COL_W = 300;
const ROW_H = 150;
const EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried', 'determined', 'closed'];
const EXPRESSION_LABEL: Record<string, string> = {
  neutral: 'Neutre',
  happy: 'Joyeuse',
  sad: 'Triste',
  angry: 'En colère',
  surprised: 'Surprise',
  worried: 'Inquiète',
  determined: 'Déterminée',
  closed: 'Yeux fermés',
};
const ANIMATIONS: [string, string][] = [
  ['idle', 'Repos'],
  ['talk', 'Parle'],
  ['wave', 'Salue'],
  ['point', 'Montre du doigt'],
  ['interact', 'Manipule'],
  ['nod', 'Acquiesce'],
  ['shake', 'Refuse de la tête'],
  ['cross', 'Bras croisés'],
  ['surprised', 'Sursaute'],
  ['sad', 'Abattu'],
  ['bow', 'S’incline'],
  ['kneel', 'S’agenouille'],
];

type Node = DialogueNodeDoc;

function targetsOf(n: Node): { to: string; kind: 'next' | 'branch' | 'choice'; index?: number }[] {
  const out: { to: string; kind: 'next' | 'branch' | 'choice'; index?: number }[] = [];
  n.choices?.forEach((c, i) => c.next && out.push({ to: c.next, kind: 'choice', index: i }));
  n.branches?.forEach((b, i) => out.push({ to: b.next, kind: 'branch', index: i }));
  if (n.next && !n.end) out.push({ to: n.next, kind: 'next' });
  return out;
}

/** Automatic layout: columns by distance from the start node. */
function autoLayout(doc: DialogueDoc): Map<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const queue = [doc.start];
  depth.set(doc.start, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const n = doc.nodes.find((x) => x.id === id);
    if (!n) continue;
    for (const t of targetsOf(n)) {
      if (!depth.has(t.to)) {
        depth.set(t.to, depth.get(id)! + 1);
        queue.push(t.to);
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const rows = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of doc.nodes) {
    const d = depth.get(n.id) ?? maxDepth + 1;
    const r = rows.get(d) ?? 0;
    rows.set(d, r + 1);
    pos.set(n.id, { x: 30 + d * COL_W, y: 30 + r * ROW_H });
  }
  return pos;
}

export function DialogueEditor({ path }: { path: string }) {
  const h = useDoc<DialogueDoc>(path);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const data = h?.data;
  const layout = useMemo(() => (data ? autoLayout(data) : new Map()), [data]);
  if (!h || !data) return null;
  const { edit, studio } = h;
  const posOf = (n: Node) => (drag?.id === n.id ? { x: drag.x, y: drag.y } : (n.editor ?? layout.get(n.id) ?? { x: 0, y: 0 }));
  const width = Math.max(800, ...data.nodes.map((n) => posOf(n).x + NODE_W + 60));
  const height = Math.max(500, ...data.nodes.map((n) => posOf(n).y + 220));
  const sel = data.nodes.find((n) => n.id === (selected ?? data.start)) ?? null;

  const addNode = (from?: Node) =>
    studio.history.transaction('Nouveau nœud', () => {
      const id = freeId(
        data.nodes.map((n) => n.id),
        'noeud',
      );
      const text = studio.newTextKey(`dlg.${data.id}.${id}`, '…');
      const base = from ? posOf(from) : { x: 30, y: height - 180 };
      const node: Node = { id, speaker: from?.speaker, text, end: true, editor: { x: base.x + (from ? COL_W : 0), y: base.y + (from ? 0 : 0) } };
      edit('Nouveau nœud', (d) => ({
        ...d,
        nodes: [...d.nodes.map((n) => (from && n.id === from.id && !n.choices?.length ? { ...n, next: id, end: undefined } : n)), node],
      }));
      setSelected(id);
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', height: '100%' }} data-testid="st-dialogue-editor">
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
        <div className="st-code__bar">
          <strong>Dialogue « {data.id} »</strong>
          <span className="st-field__key">{data.nodes.length} nœuds</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="st-btn st-btn--small" onClick={() => addNode()}>
            ＋ Nœud
          </button>
          <button type="button" className="st-btn st-btn--small" title="Oublier les positions manuelles" onClick={() => edit('Réorganiser le graphe', (d) => ({ ...d, nodes: d.nodes.map(({ editor: _e, ...n }) => n as Node) }))}>
            Réorganiser
          </button>
        </div>
        <div
          className="st-graph"
          ref={graphRef}
          onPointerMove={(e) => {
            if (!drag) return;
            const r = graphRef.current!.getBoundingClientRect();
            setDrag({ ...drag, x: Math.max(0, e.clientX - r.left + graphRef.current!.scrollLeft - drag.ox), y: Math.max(0, e.clientY - r.top + graphRef.current!.scrollTop - drag.oy) });
          }}
          onPointerUp={() => {
            if (!drag) return;
            const { id, x, y } = drag;
            setDrag(null);
            edit('Déplacer un nœud', (d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, editor: { x: Math.round(x), y: Math.round(y) } } : n)) }));
          }}
        >
          <div style={{ position: 'relative', width, height }}>
            <svg width={width} height={height}>
              <defs>
                <marker id="st-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a96a8" />
                </marker>
              </defs>
              {data.nodes.flatMap((n) => {
                const a = posOf(n);
                return targetsOf(n).map((t, k) => {
                  const target = data.nodes.find((x) => x.id === t.to);
                  if (!target) return null;
                  const b = posOf(target);
                  const y0 = a.y + (t.kind === 'choice' ? 70 + (t.index ?? 0) * 17 : t.kind === 'branch' ? 30 : 50);
                  const x0 = a.x + NODE_W;
                  const x1 = b.x;
                  const y1 = b.y + 18;
                  const dx = Math.max(40, Math.abs(x1 - x0) / 2);
                  const color = t.kind === 'choice' ? '#7fb7d9' : t.kind === 'branch' ? '#b98ad8' : '#8a96a8';
                  return (
                    <path
                      key={`${n.id}-${k}`}
                      d={`M ${x0} ${y0} C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.6}
                      strokeDasharray={t.kind === 'branch' ? '5 4' : undefined}
                      markerEnd="url(#st-arrow)"
                    />
                  );
                });
              })}
            </svg>
            {data.nodes.map((n) => {
              const p = posOf(n);
              const routing = !n.text && !n.choices?.length;
              return (
                <div
                  key={n.id}
                  className={`st-node ${sel?.id === n.id ? 'is-selected' : ''} ${data.start === n.id ? 'is-start' : ''} ${routing ? 'is-routing' : ''}`}
                  style={{ left: p.x, top: p.y }}
                  onPointerDown={(e) => {
                    setSelected(n.id);
                    if (e.button !== 0) return;
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setDrag({ id: n.id, x: p.x, y: p.y, ox: e.clientX - r.left, oy: e.clientY - r.top });
                  }}
                  data-testid={`st-node-${n.id}`}
                >
                  <div className="st-node__head">
                    <strong>{routing ? 'Aiguillage' : speakerLabel(h, n.speaker)}</strong>
                    {data.start === n.id && <span className="st-badge">début</span>}
                    {n.end && <span className="st-badge">fin</span>}
                    <span className="st-node__id">{n.id}</span>
                  </div>
                  {n.text && <div className="st-node__text">{studio.t(n.text)}</div>}
                  {routing && <div className="st-node__text st-field__key">{(n.branches?.length ?? 0)} branche(s) conditionnelle(s)</div>}
                  {!!n.choices?.length && (
                    <ul className="st-node__choices">
                      {n.choices.map((c) => (
                        <li key={c.id}>
                          ▸ {studio.t(c.text)} {c.next ? `→ ${c.next}` : '(fin)'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ borderLeft: '1px solid var(--st-border)', overflow: 'auto', background: 'var(--st-panel)' }}>
        {sel ? <NodeInspector h={h} node={sel} onSelect={setSelected} onAddLinked={() => addNode(sel)} /> : <div className="st-empty">Sélectionnez un nœud.</div>}
      </div>
    </div>
  );
}

function speakerLabel(h: DocHandle<DialogueDoc>, speaker: string | undefined): string {
  if (!speaker) return 'Sans locuteur';
  if (speaker === 'narrator') return 'Narration';
  if (speaker === 'player') return 'Joueur';
  const named = h.data.speakers?.[speaker]?.name;
  if (named) return h.studio.t(named);
  const e = h.studio.entity(speaker);
  const nameKey = e?.components['core.npc']?.name;
  return typeof nameKey === 'string' ? h.studio.t(nameKey) : speaker;
}

function NodeInspector({ h, node, onSelect, onAddLinked }: { h: DocHandle<DialogueDoc>; node: Node; onSelect: (id: string) => void; onAddLinked: () => void }) {
  const { data, edit, studio, env } = h;
  const [idDraft, setIdDraft] = useState<string | null>(null);
  const setNode = (n: Node, label: string, merge?: string) => edit(label, (d) => ({ ...d, nodes: d.nodes.map((x) => (x.id === node.id ? n : x)) }), merge ? `${node.id}|${merge}` : undefined);
  const ids = data.nodes.map((n) => n.id);
  const nodeSelect = (value: string | null | undefined, onChange: (v: string | null) => void, allowEnd = true) => (
    <select className="st-select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEnd && <option value="">— fin du dialogue —</option>}
      {ids.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );
  const npcSpeakers = (studio.sceneDoc()?.entities ?? []).filter((e) => e.components['core.npc']).map((e) => e.id);
  const rename = (to: string) => {
    if (!/^[A-Za-z0-9_-]+$/.test(to) || ids.includes(to)) return;
    const from = node.id;
    const fix = (v: string | null | undefined) => (v === from ? to : v);
    edit('Renommer un nœud', (d) => ({
      ...d,
      start: d.start === from ? to : d.start,
      nodes: d.nodes.map((n) => ({
        ...n,
        id: n.id === from ? to : n.id,
        next: fix(n.next),
        branches: n.branches?.map((b) => ({ ...b, next: fix(b.next)! })),
        choices: n.choices?.map((c) => ({ ...c, next: fix(c.next) })),
      })),
    }));
    onSelect(to);
  };
  const keyBase = `dlg.${data.id}.${node.id}`;
  return (
    <div className="st-panel__body--pad" data-testid="st-node-inspector">
      <div className="st-row" style={{ marginBottom: 6 }}>
        <button type="button" className="st-btn st-btn--small" onClick={onAddLinked}>
          ＋ Nœud suivant
        </button>
        <button type="button" className="st-btn st-btn--small" disabled={data.start === node.id} onClick={() => edit('Début du dialogue', (d) => ({ ...d, start: node.id }))}>
          Début
        </button>
        <button
          type="button"
          className="st-btn st-btn--small st-btn--danger"
          disabled={data.nodes.length <= 1 || data.start === node.id}
          onClick={() =>
            edit('Supprimer un nœud', (d) => ({
              ...d,
              nodes: d.nodes
                .filter((n) => n.id !== node.id)
                .map((n) => ({ ...n, next: n.next === node.id ? undefined : n.next, choices: n.choices?.map((c) => (c.next === node.id ? { ...c, next: null } : c)), branches: n.branches?.filter((b) => b.next !== node.id) })),
            }))
          }
        >
          Supprimer
        </button>
      </div>
      <Row label="Identifiant">
        <input className="st-input st-input--mono" value={idDraft ?? node.id} onChange={(e) => setIdDraft(e.target.value)} onBlur={() => (idDraft && idDraft !== node.id && rename(idDraft), setIdDraft(null))} />
      </Row>
      <Row label="Locuteur">
        <select className="st-select" value={node.speaker ?? ''} onChange={(e) => setNode({ ...node, speaker: e.target.value || undefined }, 'Locuteur')}>
          <option value="">— aucun —</option>
          <option value="narrator">Narration</option>
          <option value="player">Joueur</option>
          {Object.keys(data.speakers ?? {}).map((k) => (
            <option key={k} value={k}>
              {studio.t(data.speakers![k]!.name)} ({k})
            </option>
          ))}
          {npcSpeakers.map((id) => (
            <option key={id} value={id}>
              {speakerLabel(h, id)} ({id})
            </option>
          ))}
          {node.speaker && !['narrator', 'player', ...npcSpeakers, ...Object.keys(data.speakers ?? {})].includes(node.speaker) && <option value={node.speaker}>{node.speaker}</option>}
        </select>
      </Row>
      <Row label="Réplique" help="Sans texte ni choix, le nœud est un aiguillage invisible">
        <TextField value={node.text} multiline env={{ ...env, keyHint: keyBase }} onChange={(k, m) => setNode({ ...node, text: k }, 'Réplique', m ? `text|${m}` : undefined)} />
      </Row>
      <Row label="Expression">
        <select className="st-select" value={node.expression ?? ''} onChange={(e) => setNode({ ...node, expression: e.target.value || undefined }, 'Expression')}>
          <option value="">— inchangée —</option>
          {EXPRESSIONS.map((x) => (
            <option key={x} value={x}>
              {EXPRESSION_LABEL[x]}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Animation">
        <select className="st-select" value={node.animation ?? ''} onChange={(e) => setNode({ ...node, animation: e.target.value || undefined }, 'Animation')}>
          <option value="">— aucune —</option>
          {ANIMATIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Actions">
        <ActionsEditor value={node.actions ?? []} env={{ ...env, keyHint: keyBase }} onChange={(a, m) => setNode({ ...node, actions: a.length ? a : undefined }, 'Actions du nœud', m ? `actions|${m}` : undefined)} />
      </Row>
      <h3>Choix du joueur</h3>
      {(node.choices ?? []).map((c, i) => (
        <div key={i} className="st-block" style={{ marginBottom: 6 }}>
          <div className="st-block__head">
            <input className="st-input st-input--mono" style={{ width: 110 }} value={c.id} onChange={(e) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, id: e.target.value }) }, 'Identifiant du choix', `c${i}id`)} />
            <span style={{ flex: 1 }} />
            <ListTools
              index={i}
              count={node.choices!.length}
              onMove={(d) => setNode({ ...node, choices: moveItem(node.choices!, i, d) }, 'Réordonner les choix')}
              onRemove={() => setNode({ ...node, choices: removeAt(node.choices!, i) }, 'Supprimer un choix')}
            />
          </div>
          <div className="st-block__body">
            <Row label="Texte">
              <TextField value={c.text} env={{ ...env, keyHint: `${keyBase}.${c.id}` }} onChange={(k, m) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, text: k }) }, 'Texte du choix', m ? `c${i}t|${m}` : undefined)} />
            </Row>
            <Row label="Mène à">{nodeSelect(c.next, (v) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, next: v }) }, 'Suite du choix'))}</Row>
            <Row label="Visible si">
              <ConditionEditor value={c.condition ?? null} env={env} onChange={(cond, m) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, condition: cond }) }, 'Condition du choix', m ? `c${i}c|${m}` : undefined)} />
            </Row>
            <Row label="Actions">
              <ActionsEditor value={c.actions ?? []} env={{ ...env, keyHint: `${keyBase}.${c.id}` }} onChange={(a, m) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, actions: a.length ? a : undefined }) }, 'Actions du choix', m ? `c${i}a|${m}` : undefined)} />
            </Row>
            <Row label="Options">
              <div className="st-row">
                <label className="st-check">
                  <input type="checkbox" checked={!!c.once} onChange={(e) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, once: e.target.checked || undefined }) }, 'Choix unique')} />
                  Une seule fois
                </label>
                <label className="st-check">
                  <input type="checkbox" checked={!!c.showDisabled} onChange={(e) => setNode({ ...node, choices: replaceAt(node.choices!, i, { ...c, showDisabled: e.target.checked || undefined }) }, 'Choix grisé')} />
                  Grisé si indisponible
                </label>
              </div>
            </Row>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="st-btn st-btn--small"
        onClick={() =>
          studio.history.transaction('Nouveau choix', () => {
            const id = freeId(
              (node.choices ?? []).map((c) => c.id),
              'choix',
            );
            const text = studio.newTextKey(`${keyBase}.${id}`, 'Nouvelle réponse');
            setNode({ ...node, end: undefined, choices: [...(node.choices ?? []), { id, text, next: null }] }, 'Nouveau choix');
          })
        }
      >
        ＋ Choix
      </button>
      {!node.choices?.length && (
        <>
          <h3>Suite</h3>
          <Row label="Branches" help="La première condition vraie choisit la suite">
            <div className="st-list">
              {(node.branches ?? []).map((b, i) => (
                <div key={i} className="st-list__item">
                  <div className="st-list__head">
                    <span>Si…</span>
                    <span className="st-spacer" />
                    <ListTools index={i} count={node.branches!.length} onMove={(d) => setNode({ ...node, branches: moveItem(node.branches!, i, d) }, 'Réordonner les branches')} onRemove={() => setNode({ ...node, branches: removeAt(node.branches!, i) }, 'Supprimer une branche')} />
                  </div>
                  <ConditionEditor value={b.condition} env={env} onChange={(cond, m) => cond && setNode({ ...node, branches: replaceAt(node.branches!, i, { ...b, condition: cond }) }, 'Condition de branche', m ? `b${i}|${m}` : undefined)} />
                  <Row label="alors">{nodeSelect(b.next, (v) => v && setNode({ ...node, branches: replaceAt(node.branches!, i, { ...b, next: v }) }, 'Suite de branche'), false)}</Row>
                </div>
              ))}
              <div>
                <button type="button" className="st-btn st-btn--small" onClick={() => setNode({ ...node, branches: [...(node.branches ?? []), { condition: { type: 'core.always' }, next: node.id === data.start ? (ids.find((x) => x !== node.id) ?? node.id) : data.start }] }, 'Nouvelle branche')}>
                  ＋ Branche
                </button>
              </div>
            </div>
          </Row>
          <Row label="Sinon / ensuite">{nodeSelect(node.end ? null : node.next, (v) => setNode({ ...node, next: v ?? undefined, end: v ? undefined : true }, 'Suite du nœud'))}</Row>
        </>
      )}
    </div>
  );
}
