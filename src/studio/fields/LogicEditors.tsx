/**
 * Visual logic: conditions and action lists as blocks. Every action or condition registered by
 * the engine or a pack (with its prop schema) is available, grouped by category; nested logic
 * (« si / sinon », « toutes / au moins une ») is edited recursively.
 */
import { useState } from 'react';
import type { ActionData, ConditionData } from '@engine/core/logic/types';
import { normalizeProps, type PropSchema } from '@engine/core/props/props';
import { PropFields, type FieldEnv, type OnChange } from './PropField';

interface LogicDef {
  id: string;
  label: string;
  category?: string;
  props: PropSchema;
  summarize?(props: never): string;
}

function grouped(defs: LogicDef[]): [string, LogicDef[]][] {
  const map = new Map<string, LogicDef[]>();
  for (const d of [...defs].sort((a, b) => a.label.localeCompare(b.label, 'fr'))) {
    const cat = d.category ?? 'Divers';
    map.set(cat, [...(map.get(cat) ?? []), d]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
}

function TypeSelect({ defs, value, placeholder, onPick }: { defs: LogicDef[]; value: string; placeholder: string; onPick: (id: string) => void }) {
  return (
    <select className="st-select" value={value} onChange={(e) => e.target.value && onPick(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }}>
      <option value="">{placeholder}</option>
      {grouped(defs).map(([cat, list]) => (
        <optgroup key={cat} label={cat}>
          {list.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function withDefaults(def: LogicDef | undefined, type: string): Record<string, unknown> {
  if (!def) return { type };
  return { type, ...(normalizeProps(def.props, {}).value as Record<string, unknown>) };
}

function summary(def: LogicDef | undefined, data: Record<string, unknown>): string {
  if (!def?.summarize) return '';
  try {
    return def.summarize(normalizeProps(def.props, data).value as never);
  } catch {
    return '';
  }
}

export function ConditionEditor({ value, onChange, env }: { value: ConditionData | null; onChange: OnChange<ConditionData | null>; env: FieldEnv }) {
  const registry = env.studio.session.logicRegistry;
  const defs = registry.listConditions() as unknown as LogicDef[];
  if (!value) {
    return <TypeSelect defs={defs} value="" placeholder="＋ Ajouter une condition… (toujours vraie sinon)" onPick={(id) => onChange(withDefaults(registry.condition(id) as unknown as LogicDef, id) as ConditionData)} />;
  }
  const def = registry.condition(value.type) as unknown as LogicDef | undefined;
  const { type, ...props } = value;
  return (
    <div className="st-block st-block--condition">
      <div className="st-block__head">
        <TypeSelect defs={defs} value={type} placeholder="Condition…" onPick={(id) => onChange(withDefaults(registry.condition(id) as unknown as LogicDef, id) as ConditionData)} />
        <span className="st-block__summary">{summary(def, props)}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="st-btn st-btn--small st-btn--ghost st-btn--danger" title="Retirer la condition" onClick={() => onChange(null)}>
          ✕
        </button>
      </div>
      {def ? (
        Object.keys(def.props).length > 0 && (
          <div className="st-block__body">
            <PropFields schema={def.props} value={props} env={env} onChange={(next, merge) => onChange({ type, ...next } as ConditionData, merge)} />
          </div>
        )
      ) : (
        <div className="st-line--error">Condition inconnue : {type}</div>
      )}
    </div>
  );
}

export function ActionsEditor({ value, onChange, env }: { value: ActionData[]; onChange: OnChange<ActionData[]>; env: FieldEnv }) {
  const registry = env.studio.session.logicRegistry;
  const defs = registry.listActions() as unknown as LogicDef[];
  const set = (i: number, a: ActionData, merge?: string) => {
    const next = [...value];
    next[i] = a;
    onChange(next, merge ? `${i}|${merge}` : undefined);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="st-logic">
      {value.map((a, i) => (
        <ActionBlock
          key={i}
          action={a}
          index={i}
          count={value.length}
          env={{ ...env, keyHint: `${env.keyHint}.${i}` }}
          onChange={(na, merge) => set(i, na, merge)}
          onMove={(d) => move(i, d)}
          onRemove={() => onChange(value.filter((_, k) => k !== i))}
        />
      ))}
      <div>
        <TypeSelect defs={defs} value="" placeholder="＋ Ajouter une action…" onPick={(id) => onChange([...value, withDefaults(registry.action(id) as unknown as LogicDef, id) as ActionData])} />
      </div>
    </div>
  );
}

function ActionBlock({
  action,
  index,
  count,
  env,
  onChange,
  onMove,
  onRemove,
}: {
  action: ActionData;
  index: number;
  count: number;
  env: FieldEnv;
  onChange: OnChange<ActionData>;
  onMove: (d: number) => void;
  onRemove: () => void;
}) {
  const registry = env.studio.session.logicRegistry;
  const def = registry.action(action.type) as unknown as LogicDef | undefined;
  const { type, note, ...props } = action;
  const [open, setOpen] = useState(Object.keys(props).length <= 3);
  return (
    <div className="st-block">
      <div className="st-block__head">
        <button type="button" className="st-btn st-btn--small st-btn--ghost" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Replier' : 'Déplier'}>
          {open ? '▾' : '▸'}
        </button>
        <span className="st-block__title">{def?.label ?? type}</span>
        {!open && <span className="st-block__summary">{summary(def, props)}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Monter" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Descendre" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className="st-btn st-btn--small st-btn--ghost st-btn--danger" title="Retirer l’action" onClick={onRemove}>
          ✕
        </button>
      </div>
      {open && (
        <div className="st-block__body">
          {def ? (
            <PropFields schema={def.props} value={props} env={env} onChange={(next, merge) => onChange({ type, ...(note ? { note } : {}), ...next } as ActionData, merge)} />
          ) : (
            <div className="st-line--error">Action inconnue : {type}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** An event to react to (rules, objectives): event id + optional « where » filters. */
export function EventEditor({ value, onChange, env }: { value: { event: string; where?: Record<string, unknown> } | null; onChange: OnChange<{ event: string; where?: Record<string, unknown> } | null>; env: FieldEnv }) {
  const registry = env.studio.session.logicRegistry;
  const events = registry.listEvents();
  const current = value ? registry.event(value.event) : undefined;
  return (
    <div className="st-block st-block--event">
      <div className="st-block__head">
        <select className="st-select" value={value?.event ?? ''} onChange={(e) => onChange(e.target.value ? { event: e.target.value } : null)} style={{ width: 'auto', maxWidth: '100%' }}>
          <option value="">Aucun événement</option>
          {events
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.label} ({e.id})
              </option>
            ))}
        </select>
      </div>
      {value && current && Object.keys(current.fields).length > 0 && (
        <div className="st-block__body">
          <div className="st-field__key">Filtres (laisser vide pour tout accepter)</div>
          <PropFields
            schema={Object.fromEntries(Object.entries(current.fields).map(([k, d]) => [k, { ...d, default: '' as never }]))}
            value={value.where ?? {}}
            env={env}
            onChange={(where, merge) => {
              const clean = Object.fromEntries(Object.entries(where).filter(([, v]) => v !== '' && v !== null && v !== undefined));
              onChange({ event: value.event, ...(Object.keys(clean).length ? { where: clean } : {}) }, merge);
            }}
          />
        </div>
      )}
    </div>
  );
}
