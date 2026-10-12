/**
 * Logic editor: « quand [événement] (filtres), si [condition], alors [actions], sinon [actions] ».
 */
import { useState } from 'react';
import type { LogicDoc } from '@engine/core/content/schemas';
import { ActionsEditor, ConditionEditor, EventEditor } from '../fields/LogicEditors';
import { RefInput } from '../fields/PropField';
import { freeId, ListTools, moveItem, removeAt, replaceAt, Row, useDoc } from './common';

type Rule = LogicDoc['rules'][number];

export function LogicDocEditor({ path }: { path: string }) {
  const h = useDoc<LogicDoc>(path);
  const [filter, setFilter] = useState('');
  if (!h) return null;
  const { data, edit, env } = h;
  const setRule = (i: number, r: Rule, label: string, merge?: string) => edit(label, (d) => ({ ...d, rules: replaceAt(d.rules, i, r) }), merge ? `rule${i}|${merge}` : undefined);
  const f = filter.trim().toLowerCase();
  return (
    <div className="st-editor" data-testid="st-logic-editor">
      <h2>Logique — {data.title ?? data.id}</h2>
      <Row label="Titre">
        <input className="st-input" value={data.title ?? ''} onChange={(e) => edit('Titre', (d) => ({ ...d, title: e.target.value }), 'title')} />
      </Row>
      <div className="st-row" style={{ margin: '0.6rem 0' }}>
        <input className="st-input" placeholder="Filtrer les règles…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button
          type="button"
          className="st-btn st-btn--primary"
          onClick={() =>
            edit('Nouvelle règle', (d) => ({
              ...d,
              rules: [...d.rules, { id: freeId(d.rules.map((r) => r.id), 'regle'), name: 'Nouvelle règle', enabled: true, once: false, when: { event: 'civ.started' }, then: [] }],
            }))
          }
        >
          ＋ Règle
        </button>
      </div>
      {data.rules.length === 0 && <div className="st-empty">Aucune règle. Une règle réagit à un événement du jeu.</div>}
      {data.rules.map((rule, i) => {
        if (f && !rule.id.toLowerCase().includes(f) && !(rule.name ?? '').toLowerCase().includes(f) && !rule.when.event.includes(f)) return null;
        return (
          <section key={i} className="st-section" style={{ border: '1px solid var(--st-border)', borderRadius: 8, marginBottom: '0.6rem' }}>
            <div className="st-section__head" style={{ cursor: 'default' }}>
              <label className="st-check" title="Activée">
                <input type="checkbox" checked={rule.enabled !== false} onChange={(e) => setRule(i, { ...rule, enabled: e.target.checked }, 'Activer/désactiver une règle')} />
              </label>
              <input className="st-input" style={{ flex: 1 }} value={rule.name ?? ''} placeholder="Nom de la règle" onChange={(e) => setRule(i, { ...rule, name: e.target.value }, 'Nom de règle', 'name')} />
              <small>{rule.id}</small>
              <ListTools
                index={i}
                count={data.rules.length}
                onMove={(dir) => edit('Réordonner les règles', (d) => ({ ...d, rules: moveItem(d.rules, i, dir) }))}
                onDuplicate={() => edit('Dupliquer une règle', (d) => ({ ...d, rules: [...d.rules.slice(0, i + 1), { ...structuredClone(rule), id: freeId(d.rules.map((r) => r.id), rule.id) }, ...d.rules.slice(i + 1)] }))}
                onRemove={() => edit('Supprimer une règle', (d) => ({ ...d, rules: removeAt(d.rules, i) }))}
              />
            </div>
            <div className="st-section__body">
              <Row label="Quand">
                <EventEditor value={rule.when} env={env} onChange={(w, m) => w && setRule(i, { ...rule, when: w }, 'Événement', m)} />
              </Row>
              <Row label="Si">
                <ConditionEditor value={rule.if ?? null} env={env} onChange={(c, m) => setRule(i, { ...rule, if: c }, 'Condition', m)} />
              </Row>
              <Row label="Alors">
                <ActionsEditor value={rule.then} env={{ ...env, keyHint: `${env.keyHint}.${rule.id}` }} onChange={(a, m) => setRule(i, { ...rule, then: a }, 'Actions', m)} />
              </Row>
              {(rule.if || (rule.else && rule.else.length > 0)) && (
                <Row label="Sinon">
                  <ActionsEditor value={rule.else ?? []} env={{ ...env, keyHint: `${env.keyHint}.${rule.id}.sinon` }} onChange={(a, m) => setRule(i, { ...rule, else: a }, 'Actions (sinon)', m)} />
                </Row>
              )}
              <Row label="Options">
                <div className="st-row">
                  <label className="st-check">
                    <input type="checkbox" checked={!!rule.once} onChange={(e) => setRule(i, { ...rule, once: e.target.checked }, 'Une seule fois')} />
                    Une seule fois par partie
                  </label>
                </div>
              </Row>
              <Row label="Scène" help="Limiter la règle à une scène (vide : toutes)">
                <RefInput kind="scene" value={rule.scene ?? ''} env={env} onChange={(v, m) => setRule(i, { ...rule, scene: v || undefined }, 'Scène de la règle', m)} />
              </Row>
            </div>
          </section>
        );
      })}
    </div>
  );
}
