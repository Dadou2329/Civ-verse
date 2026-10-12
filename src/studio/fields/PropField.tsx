/**
 * Property editors generated from prop schemas (`prop.number`, `prop.text`, `prop.entity`...).
 * Every behavior, action, condition and mechanic setting gets a form without writing any UI.
 *
 * Text props hold localization keys: the field shows and edits the French text itself; the key
 * is created in the pack's table when needed.
 */
import { useId, useState, type ReactNode } from 'react';
import type { PropDef, PropSchema } from '@engine/core/props/props';
import type { Studio } from '../core/studio';
import { refOptions, type Option } from '../ui/catalog';
import { ActionsEditor, ConditionEditor } from './LogicEditors';

export interface FieldEnv {
  studio: Studio;
  /** Suffix used to name new text keys ("verrou.noe"). */
  keyHint: string;
}

/** `merge`: a key telling the history that quick successive changes are one undo step. */
export type OnChange<T = unknown> = (next: T, merge?: string) => void;

export function PropFields({ schema, value, onChange, env }: { schema: PropSchema; value: Record<string, unknown>; onChange: OnChange<Record<string, unknown>>; env: FieldEnv }) {
  const entries = Object.entries(schema).filter(([, d]) => !d.hidden);
  const basic = entries.filter(([, d]) => !d.advanced);
  const advanced = entries.filter(([, d]) => d.advanced);
  const field = ([name, def]: [string, PropDef]) => (
    <PropField
      key={name}
      name={name}
      def={def}
      value={value[name]}
      env={{ ...env, keyHint: `${env.keyHint}.${name}` }}
      onChange={(v, merge) => onChange({ ...value, [name]: v }, merge ? `${name}|${merge}` : undefined)}
    />
  );
  return (
    <>
      {basic.map(field)}
      {advanced.length > 0 && (
        <details className="st-advanced">
          <summary className="st-field__label">Avancé</summary>
          {advanced.map(field)}
        </details>
      )}
    </>
  );
}

function Labeled({ label, help, wide, children }: { label: string; help?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`st-field ${wide ? 'st-field--wide' : ''}`}>
      <div className="st-field__label" title={help}>
        {label}
      </div>
      <div>{children}</div>
      {help && !wide && <div className="st-field__help">{help}</div>}
    </div>
  );
}

export function PropField({ name, def, value, onChange, env }: { name: string; def: PropDef; value: unknown; onChange: OnChange; env: FieldEnv }) {
  const label = def.label ?? name;
  const v = value === undefined ? def.default : value;
  switch (def.kind) {
    case 'number':
    case 'integer':
      return (
        <Labeled label={label} help={def.description}>
          <NumberInput value={Number(v ?? 0)} min={def.min} max={def.max} step={def.step ?? (def.kind === 'integer' ? 1 : 0.1)} integer={def.kind === 'integer'} slider={def.slider} unit={def.unit} onChange={onChange} />
        </Labeled>
      );
    case 'string':
      return (
        <Labeled label={label} help={def.description}>
          {def.multiline ? (
            <textarea className="st-textarea" value={String(v ?? '')} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value, 'type')} />
          ) : (
            <input className="st-input" value={String(v ?? '')} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value, 'type')} />
          )}
        </Labeled>
      );
    case 'text':
      return (
        <Labeled label={label} help={def.description}>
          <TextField value={String(v ?? '')} multiline={def.multiline} onChange={onChange} env={env} />
        </Labeled>
      );
    case 'boolean':
      return (
        <Labeled label={label} help={def.description}>
          <label className="st-check">
            <input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} />
            {v ? 'Oui' : 'Non'}
          </label>
        </Labeled>
      );
    case 'enum':
      return (
        <Labeled label={label} help={def.description}>
          <select className="st-select" value={String(v ?? '')} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Labeled>
      );
    case 'color':
      return (
        <Labeled label={label} help={def.description}>
          <ColorInput value={String(v ?? '#ffffff')} onChange={onChange} />
        </Labeled>
      );
    case 'vec3':
      return (
        <Labeled label={label} help={def.description}>
          <Vec3Input value={(Array.isArray(v) ? v : [0, 0, 0]) as [number, number, number]} step={def.step ?? 0.1} onChange={onChange} />
        </Labeled>
      );
    case 'ref':
      return (
        <Labeled label={label} help={def.description}>
          <RefInput kind={def.ref} withComponent={def.withComponent} value={String(v ?? '')} onChange={onChange} env={env} />
        </Labeled>
      );
    case 'condition':
      return (
        <Labeled label={label} help={def.description} wide>
          <ConditionEditor value={(v as never) ?? null} onChange={onChange} env={env} />
        </Labeled>
      );
    case 'actions':
      return (
        <Labeled label={label} help={def.description} wide>
          <ActionsEditor value={(Array.isArray(v) ? v : []) as never} onChange={onChange} env={env} />
        </Labeled>
      );
    case 'list':
      return (
        <Labeled label={label} help={def.description} wide>
          <ListInput def={def} value={Array.isArray(v) ? v : []} onChange={onChange} env={env} />
        </Labeled>
      );
    case 'object':
      return (
        <Labeled label={label} help={def.description} wide>
          <div className="st-list__item">
            <PropFields schema={def.fields} value={(v ?? {}) as Record<string, unknown>} onChange={onChange} env={env} />
          </div>
        </Labeled>
      );
    case 'json':
      return (
        <Labeled label={label} help={def.description}>
          <JsonInput value={v} onChange={onChange} />
        </Labeled>
      );
  }
}

// ------------------------------------------------------------------------------------------------

export function NumberInput({
  value,
  min,
  max,
  step,
  integer,
  slider,
  unit,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  slider?: boolean;
  unit?: string;
  onChange: OnChange<number>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    let x = integer ? Math.round(n) : n;
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    onChange(x, 'type');
  };
  return (
    <div className="st-row">
      {slider && min !== undefined && max !== undefined && (
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value), 'slide')} style={{ flex: 1 }} />
      )}
      <input
        className="st-input"
        type="number"
        value={draft ?? String(value)}
        step={step}
        min={min}
        max={max}
        style={slider ? { width: 76, flex: 'none' } : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
      {unit && <span className="st-field__key">{unit}</span>}
    </div>
  );
}

export function Vec3Input({ value, step, onChange, testId }: { value: [number, number, number]; step: number; onChange: OnChange<[number, number, number]>; testId?: string }) {
  return (
    <div className="st-vec" data-testid={testId}>
      {(['x', 'y', 'z'] as const).map((axis, i) => (
        <label key={axis}>
          {axis}
          <NumberInput
            value={Number(value[i] ?? 0)}
            step={step}
            onChange={(n, merge) => {
              const next = [...value] as [number, number, number];
              next[i] = n;
              onChange(next, merge ? `${axis}|${merge}` : undefined);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: OnChange<string> }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="st-row">
      <input type="color" value={valid ? value : '#ffffff'} onChange={(e) => onChange(e.target.value, 'pick')} style={{ width: 34, height: 26, padding: 0, border: 'none', background: 'none' }} />
      <input className={`st-input st-input--mono ${valid ? '' : 'is-invalid'}`} value={value} onChange={(e) => onChange(e.target.value, 'type')} />
    </div>
  );
}

function JsonInput({ value, onChange }: { value: unknown; onChange: OnChange }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <textarea
        className={`st-textarea st-input--mono ${error ? 'is-invalid' : ''}`}
        value={draft ?? JSON.stringify(value, null, 2)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === null) return;
          try {
            onChange(JSON.parse(draft) as unknown);
            setDraft(null);
            setError(null);
          } catch (err) {
            setError(`JSON invalide : ${(err as Error).message}`);
          }
        }}
      />
      {error && <div className="st-line--error">{error}</div>}
    </div>
  );
}

/** A localization key edited through its French text. */
export function TextField({ value: key, multiline, onChange, env }: { value: string; multiline?: boolean; onChange: OnChange<string>; env: FieldEnv }) {
  const studio = env.studio;
  const listId = useId();
  // Single line or multi-line is decided once per text (not on every keystroke, which would
  // replace the field while typing and lose the focus).
  const current = key ? (studio.session.i18n.raw(key) ?? '') : '';
  const [shape, setShape] = useState(() => ({ key, long: !!multiline || current.length > 48 }));
  if (shape.key !== key) setShape({ key, long: !!multiline || current.length > 48 });
  const long = shape.key === key ? shape.long : !!multiline || current.length > 48;
  if (!key) {
    return (
      <button
        type="button"
        className="st-btn st-btn--small"
        onClick={() =>
          studio.history.transaction('Nouveau texte', () => {
            const k = studio.newTextKey(env.keyHint, '');
            onChange(k);
          })
        }
      >
        ＋ Écrire un texte
      </button>
    );
  }
  const owned = studio.ownsKey(key);
  const known = studio.session.i18n.has(key);
  const text = studio.session.i18n.raw(key) ?? '';
  return (
    <div>
      {owned ? (
        long ? (
          <textarea className="st-textarea" value={text} onChange={(e) => studio.setText(key, e.target.value)} />
        ) : (
          <input
            className="st-input"
            value={text}
            onChange={(e) => studio.setText(key, e.target.value)}
            onBlur={() => text.length > 48 && setShape({ key, long: true })}
          />
        )
      ) : (
        <div className="st-row">
          <span style={{ flex: 1, color: known ? 'var(--st-text)' : 'var(--st-error)' }}>{known ? text : 'Clé introuvable dans les textes'}</span>
          {studio.packId && (
            <button
              type="button"
              className="st-btn st-btn--small"
              title="Créer une copie modifiable de ce texte dans ce pack"
              onClick={() =>
                studio.history.transaction('Copier un texte', () => {
                  const k = studio.newTextKey(env.keyHint, known ? text : '');
                  onChange(k);
                })
              }
            >
              Copier ici
            </button>
          )}
        </div>
      )}
      <details>
        <summary className="st-field__key">{key}</summary>
        <input className="st-input st-input--mono" list={listId} value={key} onChange={(e) => onChange(e.target.value, 'type')} />
        <datalist id={listId}>
          {Object.keys(studio.session.i18n.tableOf(studio.packId ?? '') ?? {})
            .slice(0, 800)
            .map((k) => (
              <option key={k} value={k} />
            ))}
        </datalist>
      </details>
    </div>
  );
}

export function RefInput({ kind, withComponent, value, onChange, env }: { kind: Parameters<typeof refOptions>[1]; withComponent?: string; value: string; onChange: OnChange<string>; env: FieldEnv }) {
  const listId = useId();
  const options = refOptions(env.studio, kind, withComponent);
  const known = !value || options.some((o) => o.value === value);
  return (
    <div className="st-row">
      <input className={`st-input st-input--mono ${known ? '' : 'is-invalid'}`} list={listId} value={value} placeholder={REF_HINT[kind] ?? ''} onChange={(e) => onChange(e.target.value, 'type')} />
      <datalist id={listId}>
        {options.map((o: Option) => (
          <option key={`${o.group ?? ''}|${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
      {kind === 'entity' && value && value !== 'player' && env.studio.entity(value) && (
        <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Sélectionner dans la scène" onClick={() => env.studio.select([value])}>
          ◎
        </button>
      )}
    </div>
  );
}

const REF_HINT: Partial<Record<string, string>> = {
  entity: 'entité',
  item: 'pack:objet',
  dialogue: 'dialogue',
  quest: 'quête',
  cinematic: 'cinématique',
  scene: 'scène',
  sound: 'pack:son',
  music: 'pack:musique',
  model: 'pack:modèle',
  block: 'pack:bloc',
  variable: 'civ.variable',
  character: 'pack:personnage',
};

function ListInput({ def, value, onChange, env }: { def: Extract<PropDef, { kind: 'list' }>; value: unknown[]; onChange: OnChange<unknown[]>; env: FieldEnv }) {
  const item = def.item;
  const set = (i: number, v: unknown, merge?: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next, merge ? `${i}|${merge}` : undefined);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="st-list">
      {value.map((v, i) => (
        <div className="st-list__item" key={i}>
          <div className="st-list__head">
            <span>
              {def.itemLabel ?? item.label ?? 'Élément'} {i + 1}
            </span>
            <span className="st-spacer" />
            <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="st-btn st-btn--small st-btn--ghost" title="Descendre" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="st-btn st-btn--small st-btn--ghost st-btn--danger" title="Retirer" onClick={() => onChange(value.filter((_, k) => k !== i))}>
              ✕
            </button>
          </div>
          <PropField name={String(i)} def={{ ...item, label: item.kind === 'object' ? ' ' : (item.label ?? 'Valeur') }} value={v} env={{ ...env, keyHint: `${env.keyHint}.${i}` }} onChange={(nv, merge) => set(i, nv, merge)} />
        </div>
      ))}
      <div>
        <button type="button" className="st-btn st-btn--small" onClick={() => onChange([...value, structuredClone(item.default ?? null)])}>
          ＋ Ajouter
        </button>
      </div>
    </div>
  );
}
