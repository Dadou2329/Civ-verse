/**
 * Localization completeness (hard requirement: the whole player-facing game is in French).
 *
 * Content texts are already checked key by key by the validator (test J / `npm run validate`).
 * This file checks what the validator does not see:
 *  - every key used literally by the game interface and the engine exists in French;
 *  - no visible text is hard-coded in the game's or the packs' interface components;
 *  - the French tables are clean: no empty or placeholder values, French typography (no-break
 *    spaces before « ? ! ; : » and inside « », typographic apostrophes), no English leftovers;
 *  - each table only defines keys of its own namespace.
 * The editor (src/studio) is a development tool and is not part of the player-facing game.
 */
import { describe, expect, it } from 'vitest';
import { extractCodeKeys } from '@engine/core/packs/validate';
import { hasStraightElision } from '@engine/core/i18n/typography';

type Table = Record<string, string>;

const tables = import.meta.glob(['/src/engine/locales/*.json', '/civilizations/*/locales/*.json'], { eager: true, import: 'default' }) as Record<string, Table>;
const manifests = import.meta.glob('/civilizations/*/manifest.json', { eager: true, import: 'default' }) as Record<string, { id: string }>;
const engineSources = import.meta.glob(['/src/game/**/*.{ts,tsx}', '/src/engine/**/*.{ts,tsx}', '/src/sdk/**/*.{ts,tsx}', '!**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const uiComponents = import.meta.glob(['/src/game/**/*.tsx', '/civilizations/*/ui/**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const ENGINE_TABLE = '/src/engine/locales/fr-FR.json';
const engineKeys = new Set([...Object.keys(tables[ENGINE_TABLE] ?? {}), ...Object.keys(tables['/civilizations/core/locales/fr-FR.json'] ?? {})]);
/** Code without its comments (documentation examples such as `t('door.x')` are not uses). */
const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** The game's name is a brand, written the same in every language. */
const ALLOWED_LITERALS = new Set(['CIVILIZATIONVERSE']);

describe('Localization — French is complete', () => {
  it('French (fr-FR) is the table of the engine and of every pack', () => {
    expect(Object.keys(tables)).toContain(ENGINE_TABLE);
    for (const m of Object.values(manifests)) expect(Object.keys(tables), m.id).toContain(`/civilizations/${m.id}/locales/fr-FR.json`);
    for (const file of Object.keys(tables)) expect(file.endsWith('/fr-FR.json'), file).toBe(true);
  });

  it('every key used by the game interface and the engine exists in French', () => {
    const missing: string[] = [];
    for (const [file, code] of Object.entries(engineSources)) {
      for (const key of extractCodeKeys(withoutComments(code))) if (!engineKeys.has(key)) missing.push(`${file} → ${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('keys built at runtime (t(`prefix.${x}`)) have French entries under their prefix', () => {
    const allKeys = Object.values(tables).flatMap((t) => Object.keys(t));
    const missing: string[] = [];
    const sources = { ...engineSources, ...uiComponents };
    for (const [file, code] of Object.entries(sources)) {
      for (const m of code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.-]+)\.\$\{/g)) {
        const prefix = `${m[1]}.`;
        if (!allKeys.some((k) => k.startsWith(prefix))) missing.push(`${file} → ${prefix}*`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('no visible text is hard-coded in the interface components of the game and the packs', () => {
    const found: string[] = [];
    for (const [file, code] of Object.entries(uiComponents)) {
      // Text between JSX tags: `>Texte<` (outside of `{expressions}`).
      for (const m of code.matchAll(/>([^<>{}=;()&|]*\p{L}{2,}[^<>{}=;()&|]*)</gu)) {
        const text = m[1]!.trim();
        if (text && !ALLOWED_LITERALS.has(text)) found.push(`${file} : « ${text} »`);
      }
      // Visible attributes with a literal value.
      for (const m of code.matchAll(/\b(?:title|placeholder|aria-label|alt|label)="([^"]*\p{L}{2,}[^"]*)"/gu)) found.push(`${file} : ${m[0]}`);
    }
    expect(found).toEqual([]);
  });

  for (const [file, table] of Object.entries(tables)) {
    it(`${file.slice(1)} is clean French`, () => {
      const problems: string[] = [];
      const namespace = file === ENGINE_TABLE ? /^(ui|core)\./ : new RegExp(`^${file.split('/')[2]}\\.`);
      for (const [key, value] of Object.entries(table)) {
        const where = `${key} = « ${value} »`;
        if (!namespace.test(key)) problems.push(`clé hors de l’espace de noms : ${key}`);
        if (typeof value !== 'string' || value.trim() === '') problems.push(`texte vide : ${key}`);
        if (value !== value.trim()) problems.push(`espaces en trop : ${where}`);
        if (/\s{2,}/.test(value.replace(/\n/g, ''))) problems.push(`double espace : ${where}`);
        if (/⟦|\bTODO\b|\bFIXME\b|\bTBD\b|lorem ipsum/i.test(value)) problems.push(`texte provisoire : ${where}`);
        if (hasStraightElision(value)) problems.push(`apostrophe droite (’ attendue) : ${where}`);
        // French spacing: no-break space before « ? ! ; : » and inside « », not a plain space.
        if (/ [?!;:»]/.test(value) || /« /.test(value)) problems.push(`espace normale au lieu d’insécable : ${where}`);
        // English leftovers (placeholders such as {item} are ignored).
        const words = value.replace(/\{[^}]*\}/g, ' ');
        if (/(?<!\p{L})(the|and|with|your|you|press|click|loading|error|settings|quit|please|save|load|new game|health|level|player)(?!\p{L})/iu.test(words)) {
          problems.push(`mot anglais : ${where}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
