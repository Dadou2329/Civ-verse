/**
 * Property schemas.
 *
 * Every configurable thing a pack registers (behaviors, actions, conditions, events, rule sets,
 * mechanic settings) declares its fields with these builders. The same declaration provides:
 *   - TypeScript types for the code (`InferProps<typeof schema>`),
 *   - default values and validation for content files,
 *   - automatically generated property editors in Civilization Studio.
 *
 *   props: {
 *     frequency: prop.number({ label: 'Fréquence (Hz)', min: 100, max: 2000, default: 440 }),
 *     target: prop.entity({ label: 'Porte cible' }),
 *   }
 */
import type { ActionData, ConditionData } from '../logic/types';
import type { JsonValue } from '../util/json';

export type RefKind =
  | 'entity'
  | 'item'
  | 'dialogue'
  | 'quest'
  | 'cinematic'
  | 'scene'
  | 'sound'
  | 'model'
  | 'character'
  | 'block'
  | 'variable'
  | 'event'
  | 'prefab'
  | 'spawn'
  | 'music'
  | 'panel'
  | 'ability';

export const REF_KINDS: readonly RefKind[] = [
  'entity',
  'item',
  'dialogue',
  'quest',
  'cinematic',
  'scene',
  'sound',
  'model',
  'character',
  'block',
  'variable',
  'event',
  'prefab',
  'spawn',
  'music',
  'panel',
  'ability',
];

interface PropBase<T> {
  /** French label shown in Civilization Studio. */
  label?: string;
  description?: string;
  default: T;
  /** Shown in a collapsed "Avancé" section. */
  advanced?: boolean;
  /** Not editable in the Studio (still validated and saved). */
  hidden?: boolean;
  group?: string;
}

export interface NumberPropDef extends PropBase<number> {
  kind: 'number' | 'integer';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  slider?: boolean;
}
export interface StringPropDef extends PropBase<string> {
  kind: 'string';
  multiline?: boolean;
  placeholder?: string;
  pattern?: string;
}
/** Localization key of player-visible text. The Studio edits the French text in the pack table. */
export interface TextPropDef extends PropBase<string> {
  kind: 'text';
  multiline?: boolean;
}
export interface BooleanPropDef extends PropBase<boolean> {
  kind: 'boolean';
}
export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}
export interface EnumPropDef<T extends string = string> extends PropBase<T> {
  kind: 'enum';
  options: readonly EnumOption<T>[];
}
export interface ColorPropDef extends PropBase<string> {
  kind: 'color';
}
export interface Vec3PropDef extends PropBase<[number, number, number]> {
  kind: 'vec3';
  step?: number;
}
export interface RefPropDef extends PropBase<string> {
  kind: 'ref';
  ref: RefKind;
  /** For entity refs: restrict the picker to entities having this component. */
  withComponent?: string;
}
export interface ConditionPropDef extends PropBase<ConditionData | null> {
  kind: 'condition';
}
export interface ActionsPropDef extends PropBase<ActionData[]> {
  kind: 'actions';
}
export interface ListPropDef<T = unknown> extends PropBase<T[]> {
  kind: 'list';
  item: PropDef<T>;
  itemLabel?: string;
}
export interface ObjectPropDef<T = Record<string, unknown>> extends PropBase<T> {
  kind: 'object';
  fields: PropSchema;
}
export interface JsonPropDef extends PropBase<JsonValue> {
  kind: 'json';
}

export type PropDef<T = unknown> =
  | (NumberPropDef & { __t?: T })
  | (StringPropDef & { __t?: T })
  | (TextPropDef & { __t?: T })
  | (BooleanPropDef & { __t?: T })
  | (EnumPropDef & { __t?: T })
  | (ColorPropDef & { __t?: T })
  | (Vec3PropDef & { __t?: T })
  | (RefPropDef & { __t?: T })
  | (ConditionPropDef & { __t?: T })
  | (ActionsPropDef & { __t?: T })
  | (ListPropDef & { __t?: T })
  | (ObjectPropDef & { __t?: T })
  | (JsonPropDef & { __t?: T });

/** Phantom-typed prop definition (the `__t` marker carries the value type for inference). */
export type TypedProp<D, T> = D & { readonly __t?: T };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema maps hold heterogeneous prop types
export type PropSchema = Record<string, TypedProp<PropDef<any>, any>>;

export type PropValue<P> = P extends { readonly __t?: infer T } ? Exclude<T, undefined> : never;
export type InferProps<S extends PropSchema> = { [K in keyof S]: PropValue<S[K]> };

type Opts<D, T> = Partial<Omit<D, 'kind' | 'default'>> & { default?: T };

function make<D, T>(base: D, opts: Opts<D, T> | undefined): TypedProp<D, T> {
  const out = { ...base, ...(opts ?? {}) } as D & { default: T };
  return out as TypedProp<D, T>;
}

function ref(kind: RefKind) {
  return (opts?: Opts<RefPropDef, string>) =>
    make<RefPropDef, string>({ kind: 'ref', ref: kind, default: '' } as RefPropDef, opts);
}

/** Prop builders (see module documentation). */
export const prop = {
  number: (opts?: Opts<NumberPropDef, number>) =>
    make<NumberPropDef, number>({ kind: 'number', default: 0 } as NumberPropDef, opts),
  integer: (opts?: Opts<NumberPropDef, number>) =>
    make<NumberPropDef, number>({ kind: 'integer', default: 0, step: 1 } as NumberPropDef, opts),
  string: (opts?: Opts<StringPropDef, string>) =>
    make<StringPropDef, string>({ kind: 'string', default: '' } as StringPropDef, opts),
  text: (opts?: Opts<TextPropDef, string>) =>
    make<TextPropDef, string>({ kind: 'text', default: '' } as TextPropDef, opts),
  boolean: (opts?: Opts<BooleanPropDef, boolean>) =>
    make<BooleanPropDef, boolean>({ kind: 'boolean', default: false } as BooleanPropDef, opts),
  enum: <const T extends string>(options: readonly (T | EnumOption<T>)[], opts?: Opts<EnumPropDef<T>, T>) => {
    const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    if (normalized.length === 0) throw new Error('prop.enum nécessite au moins une option');
    return make<EnumPropDef<T>, T>(
      { kind: 'enum', options: normalized, default: normalized[0]!.value } as EnumPropDef<T>,
      opts,
    );
  },
  color: (opts?: Opts<ColorPropDef, string>) =>
    make<ColorPropDef, string>({ kind: 'color', default: '#ffffff' } as ColorPropDef, opts),
  vec3: (opts?: Opts<Vec3PropDef, [number, number, number]>) =>
    make<Vec3PropDef, [number, number, number]>({ kind: 'vec3', default: [0, 0, 0] } as Vec3PropDef, opts),
  entity: (opts?: Opts<RefPropDef, string>) => ref('entity')(opts),
  item: ref('item'),
  dialogue: ref('dialogue'),
  quest: ref('quest'),
  cinematic: ref('cinematic'),
  scene: ref('scene'),
  sound: ref('sound'),
  model: ref('model'),
  character: ref('character'),
  block: ref('block'),
  variable: ref('variable'),
  event: ref('event'),
  prefab: ref('prefab'),
  spawn: ref('spawn'),
  music: ref('music'),
  panel: ref('panel'),
  ability: ref('ability'),
  condition: (opts?: Opts<ConditionPropDef, ConditionData | null>) =>
    make<ConditionPropDef, ConditionData | null>({ kind: 'condition', default: null } as ConditionPropDef, opts),
  actions: (opts?: Opts<ActionsPropDef, ActionData[]>) =>
    make<ActionsPropDef, ActionData[]>({ kind: 'actions', default: [] } as ActionsPropDef, opts),
  list: <T>(item: TypedProp<PropDef<T>, T>, opts?: Opts<ListPropDef<T>, T[]>) =>
    make<ListPropDef<T>, T[]>({ kind: 'list', item, default: [] } as unknown as ListPropDef<T>, opts),
  object: <S extends PropSchema>(fields: S, opts?: Opts<ObjectPropDef<InferProps<S>>, InferProps<S>>) =>
    make<ObjectPropDef<InferProps<S>>, InferProps<S>>(
      { kind: 'object', fields, default: defaultsOf(fields) } as ObjectPropDef<InferProps<S>>,
      opts,
    ),
  json: (opts?: Opts<JsonPropDef, JsonValue>) =>
    make<JsonPropDef, JsonValue>({ kind: 'json', default: null } as JsonPropDef, opts),
};

/** Fresh default values for a schema (deep copies, safe to mutate). */
export function defaultsOf<S extends PropSchema>(schema: S): InferProps<S> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) out[key] = structuredClone(def.default);
  return out as InferProps<S>;
}

export interface PropIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Fills defaults and coerces values to the schema. Never throws: problems are returned as issues
 * so that old or hand-edited content still loads (with visible diagnostics).
 */
export function normalizeProps<S extends PropSchema>(
  schema: S,
  raw: unknown,
  path = '',
): { value: InferProps<S>; issues: PropIssue[] } {
  const issues: PropIssue[] = [];
  const src = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (raw !== undefined && raw !== null && src !== raw) {
    issues.push({ path, message: 'Un objet de propriétés était attendu.', severity: 'error' });
  }
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    out[key] = normalizeValue(def as PropDef, src[key], path ? `${path}.${key}` : key, issues);
  }
  for (const key of Object.keys(src)) {
    if (!(key in schema)) {
      issues.push({ path: path ? `${path}.${key}` : key, message: 'Propriété inconnue (ignorée).', severity: 'warning' });
    }
  }
  return { value: out as InferProps<S>, issues };
}

function normalizeValue(def: PropDef, value: unknown, path: string, issues: PropIssue[]): unknown {
  if (value === undefined) return structuredClone(def.default);
  const bad = (expected: string) => {
    issues.push({ path, message: `${expected} attendu(e), valeur par défaut utilisée.`, severity: 'error' });
    return structuredClone(def.default);
  };
  switch (def.kind) {
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return bad('Nombre');
      let v = def.kind === 'integer' ? Math.round(value) : value;
      if (def.min !== undefined && v < def.min) {
        issues.push({ path, message: `Valeur inférieure au minimum (${def.min}).`, severity: 'warning' });
        v = def.min;
      }
      if (def.max !== undefined && v > def.max) {
        issues.push({ path, message: `Valeur supérieure au maximum (${def.max}).`, severity: 'warning' });
        v = def.max;
      }
      return v;
    }
    case 'string':
    case 'text':
      return typeof value === 'string' ? value : bad('Texte');
    case 'boolean':
      return typeof value === 'boolean' ? value : bad('Booléen');
    case 'enum':
      if (typeof value === 'string' && def.options.some((o) => o.value === value)) return value;
      return bad(`Une des valeurs (${def.options.map((o) => o.value).join(', ')})`);
    case 'color':
      return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : bad('Couleur #rrggbb');
    case 'vec3':
      if (Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        return [value[0], value[1], value[2]];
      }
      return bad('Vecteur [x, y, z]');
    case 'ref':
      return typeof value === 'string' ? value : bad('Référence');
    case 'condition':
      if (value === null) return null;
      if (typeof value === 'object' && !Array.isArray(value) && typeof (value as { type?: unknown }).type === 'string') {
        return value;
      }
      return bad('Condition');
    case 'actions':
      if (Array.isArray(value) && value.every((a) => typeof a === 'object' && a !== null && typeof (a as { type?: unknown }).type === 'string')) {
        return value;
      }
      return bad("Liste d'actions");
    case 'list':
      if (!Array.isArray(value)) return bad('Liste');
      return value.map((item, i) => normalizeValue(def.item as PropDef, item, `${path}[${i}]`, issues));
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return bad('Objet');
      return normalizeProps(def.fields, value, path).value;
    }
    case 'json':
      return value;
  }
}

/** Collects every reference value in props (used for content validation and "find usages"). */
export function collectRefs(schema: PropSchema, values: Record<string, unknown>, out: { kind: RefKind; value: string; path: string }[] = [], path = ''): typeof out {
  for (const [key, def] of Object.entries(schema)) {
    const v = values[key];
    const p = path ? `${path}.${key}` : key;
    collectRefValue(def as PropDef, v, p, out);
  }
  return out;
}

function collectRefValue(def: PropDef, v: unknown, path: string, out: { kind: RefKind; value: string; path: string }[]): void {
  if (def.kind === 'ref' && typeof v === 'string' && v !== '') out.push({ kind: def.ref, value: v, path });
  else if (def.kind === 'list' && Array.isArray(v)) v.forEach((item, i) => collectRefValue(def.item as PropDef, item, `${path}[${i}]`, out));
  else if (def.kind === 'object' && typeof v === 'object' && v !== null) collectRefs(def.fields, v as Record<string, unknown>, out, path);
}

/** Text (localization key) values in props — used by the localization completeness checks. */
export function collectTextKeys(schema: PropSchema, values: Record<string, unknown>, out: string[] = []): string[] {
  for (const [key, def] of Object.entries(schema)) {
    const v = values[key];
    const d = def as PropDef;
    if (d.kind === 'text' && typeof v === 'string' && v !== '') out.push(v);
    else if (d.kind === 'list' && Array.isArray(v)) {
      for (const item of v) {
        const itemDef = d.item as PropDef;
        if (itemDef.kind === 'text' && typeof item === 'string' && item) out.push(item);
        else if (itemDef.kind === 'object' && typeof item === 'object' && item) collectTextKeys(itemDef.fields, item as Record<string, unknown>, out);
      }
    } else if (d.kind === 'object' && typeof v === 'object' && v) collectTextKeys(d.fields, v as Record<string, unknown>, out);
  }
  return out;
}
