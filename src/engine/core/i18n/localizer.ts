/**
 * Localization.
 *
 * All player-visible text comes from string tables (`locales/<locale>.json`): the engine has its
 * own table (src/engine/locales) and every pack has one. French (fr-FR) is the default and the
 * required language; other locales fall back to French key by key.
 *
 * Message syntax (subset of ICU MessageFormat):
 *   "Bonjour {name}"                                  → interpolation
 *   "{count, plural, one {# éclat} other {# éclats}}" → French plural rule (0 and 1 are singular)
 *   "{g, select, f {prête} m {prêt} other {prêt·e}}"  → select
 *
 * A missing key renders as ⟦key⟧ (never as invented English text) and is recorded (`missing()`):
 * the debug overlay (F3) lists them; validation and the tests check keys before they are shown.
 */
export type StringTable = Record<string, string>;
export type MessageParams = Record<string, string | number | boolean | null | undefined>;

export const DEFAULT_LOCALE = 'fr-FR';

export class Localizer {
  private tables = new Map<string, Map<string, StringTable>>(); // namespace → locale → table
  private merged = new Map<string, StringTable>(); // locale → merged table
  private missingKeys = new Set<string>();
  private listeners = new Set<() => void>();
  private _locale: string;

  constructor(locale = DEFAULT_LOCALE) {
    this._locale = locale;
  }

  get locale(): string {
    return this._locale;
  }

  setLocale(locale: string): void {
    this._locale = locale;
    this.notify();
  }

  /** Registers (or replaces) the table of a namespace (usually a pack id or "engine"). */
  addTable(namespace: string, locale: string, table: StringTable): void {
    let byLocale = this.tables.get(namespace);
    if (!byLocale) {
      byLocale = new Map();
      this.tables.set(namespace, byLocale);
    }
    byLocale.set(locale, { ...table });
    this.rebuild();
  }

  removeNamespace(namespace: string): void {
    if (this.tables.delete(namespace)) this.rebuild();
  }

  namespaces(): string[] {
    return [...this.tables.keys()];
  }

  tableOf(namespace: string, locale = DEFAULT_LOCALE): StringTable | undefined {
    return this.tables.get(namespace)?.get(locale);
  }

  has(key: string, locale = this._locale): boolean {
    return key in (this.merged.get(locale) ?? {}) || key in (this.merged.get(DEFAULT_LOCALE) ?? {});
  }

  /** Raw (unformatted) message or undefined. */
  raw(key: string): string | undefined {
    return this.merged.get(this._locale)?.[key] ?? this.merged.get(DEFAULT_LOCALE)?.[key];
  }

  t(key: string, params?: MessageParams): string {
    const msg = this.raw(key);
    if (msg === undefined) {
      if (!this.missingKeys.has(key)) {
        this.missingKeys.add(key);
        console.warn(`[i18n] clé manquante : ${key}`);
      }
      return `⟦${key}⟧`;
    }
    return formatMessage(msg, params, this._locale);
  }

  /** Translates `key` when it is a known key, otherwise returns it unchanged (for mixed fields). */
  maybe(keyOrText: string, params?: MessageParams): string {
    return this.has(keyOrText) ? this.t(keyOrText, params) : keyOrText;
  }

  missing(): string[] {
    return [...this.missingKeys];
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private rebuild(): void {
    this.merged.clear();
    for (const byLocale of this.tables.values()) {
      for (const [locale, table] of byLocale) {
        let m = this.merged.get(locale);
        if (!m) {
          m = {};
          this.merged.set(locale, m);
        }
        Object.assign(m, table);
      }
    }
    this.notify();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

/** French plural category: "one" for |n| < 2, else "other" (CLDR also has "many" for 1e6 multiples). */
export function pluralCategory(n: number, locale = DEFAULT_LOCALE): 'zero' | 'one' | 'other' {
  if (locale.startsWith('fr')) return Math.abs(n) < 2 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}

/** Formats an ICU-subset message. Exported for tests and the Studio preview. */
export function formatMessage(message: string, params: MessageParams | undefined, locale = DEFAULT_LOCALE): string {
  let out = '';
  let i = 0;
  while (i < message.length) {
    const ch = message[i]!;
    if (ch === '{') {
      const end = findClosing(message, i);
      if (end < 0) {
        out += message.slice(i);
        break;
      }
      out += formatArgument(message.slice(i + 1, end), params, locale);
      i = end + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function findClosing(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function formatValue(v: unknown, locale: string): string {
  if (typeof v === 'number') return new Intl.NumberFormat(locale).format(v);
  if (v === null || v === undefined) return '';
  return String(v);
}

function formatArgument(body: string, params: MessageParams | undefined, locale: string): string {
  const firstComma = body.indexOf(',');
  if (firstComma < 0) {
    const name = body.trim();
    if (!params || !(name in params)) return `{${name}}`;
    return formatValue(params[name], locale);
  }
  const name = body.slice(0, firstComma).trim();
  const rest = body.slice(firstComma + 1);
  const secondComma = rest.indexOf(',');
  const kind = (secondComma < 0 ? rest : rest.slice(0, secondComma)).trim();
  const optionsSrc = secondComma < 0 ? '' : rest.slice(secondComma + 1);
  const options = parseOptions(optionsSrc);
  const value = params?.[name];
  if (kind === 'plural') {
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    const exact = options.get(`=${n}`);
    const chosen = exact ?? options.get(pluralCategory(n, locale)) ?? options.get('other') ?? '';
    return formatMessage(chosen.replace(/#/g, formatValue(n, locale)), params, locale);
  }
  if (kind === 'select') {
    const chosen = options.get(String(value)) ?? options.get('other') ?? '';
    return formatMessage(chosen, params, locale);
  }
  return formatValue(value, locale);
}

function parseOptions(src: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i]!)) i++;
    let key = '';
    while (i < src.length && src[i] !== '{' && !/\s/.test(src[i]!)) key += src[i++];
    while (i < src.length && /\s/.test(src[i]!)) i++;
    if (src[i] !== '{') break;
    const end = findClosing(src, i);
    if (end < 0) break;
    out.set(key, src.slice(i + 1, end));
    i = end + 1;
  }
  return out;
}
