/**
 * Acceptance test J — Existing code preservation.
 *
 * "Run regression checks to ensure foundational changes have not broken previously working
 * features."
 *
 * The whole test suite is the regression net (engine unit tests, the complete Door and Memory
 * playthroughs on every branch, the Studio core, these acceptance tests, the browser tests in
 * tests/e2e). This file adds what protects existing content from silent damage:
 *  - every bundled civilization boots and validates with zero errors and zero warnings, with
 *    the same checks as `npm run validate` (references, variables, French texts of content and
 *    code);
 *  - the content required by the two scenarios is still there (quests, cinematics, scenes,
 *    multiverse fragments), and no pack lost content below the size it had when this test was
 *    written.
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { createHeadlessGame } from '@engine/core/testing/headless';
import { extractCodeKeys, validateCivilization } from '@engine/core/packs/validate';
import { ENGINE_VERSION } from '@engine/core/version';
import pkg from '../../package.json';

const packSources = import.meta.glob(['/civilizations/*/{mechanics,ui,view,assets}/**/*.{ts,tsx}', '!**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function codeKeysOf(packId: string): { key: string; file: string }[] {
  return Object.entries(packSources)
    .filter(([file]) => file.startsWith(`/civilizations/${packId}/`))
    .flatMap(([file, code]) => extractCodeKeys(code).map((key) => ({ key, file: file.slice(1) })));
}

/**
 * Content present when this test was last updated: packs may grow, never silently shrink. When
 * content is removed on purpose, lower the number here in the same commit (and say why).
 * (The key hints of the HUDs became live key labels: one text key less in each pack; Memory's
 * count includes the shard texts of content/rules.json, checked since then.)
 */
const BASELINE: Record<string, { scenes: number; entities: number; dialogues: number; quests: number; cinematics: number; rules: number; keysChecked: number }> = {
  door: { scenes: 2, entities: 211, dialogues: 16, quests: 5, cinematics: 8, rules: 13, keysChecked: 503 },
  memory: { scenes: 2, entities: 173, dialogues: 12, quests: 5, cinematics: 8, rules: 16, keysChecked: 567 },
};

const REQUIRED = {
  door: {
    quests: ['DOOR_Q00_REVEIL', 'DOOR_Q01_EMPREINTE', 'DOOR_Q02_ELIAS', 'DOOR_Q03_ARCHIVES', 'DOOR_Q04_PORTE_ABSENTE'],
    cinematics: ['C01_eveil', 'C02_rang1', 'C03_registre', 'C04b_porte', 'C04c_coupe'],
    fragment: 'threshold',
  },
  memory: {
    quests: ['MEM_Q00_EVEIL', 'MEM_Q01_MELODIE', 'MEM_Q02_REGISTRE', 'MEM_Q03_RECONSTRUCTION', 'MEM_Q04_SUJET_ZERO'],
    cinematics: ['M01_marche', 'M02_premier_echo', 'M03_chambre_blanche', 'M04_sujet_zero'],
    fragment: 'remanence',
  },
} as const;

describe('Test J — existing content and features are preserved', () => {
  it('keeps the engine version and the package version in step', () => {
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it('lists the bundled packs: core library, Door and Memory', async () => {
    const { session } = await createHeadlessGame(new GlobContentProvider());
    expect([...session.manifestIssues.values()].flat()).toEqual([]);
    expect(session.manifests.get('core')?.kind).toBe('library');
    expect(session.civilizations().map((c) => c.id)).toEqual(expect.arrayContaining(['door', 'memory']));
  });

  for (const civId of ['door', 'memory'] as const) {
    it(`${civId}: boots and validates without errors or warnings, with its scenario content intact`, async () => {
      const { session } = await createHeadlessGame(new GlobContentProvider());
      const report = await validateCivilization(session, civId, { codeKeys: codeKeysOf(civId) });
      expect(report.issues).toEqual([]);
      const base = BASELINE[civId];
      for (const k of Object.keys(base) as (keyof typeof base)[]) expect(report.stats[k], k).toBeGreaterThanOrEqual(base[k]);

      await session.loadCivilization(civId, { fresh: true });
      const pack = session.civ!.pack;
      for (const q of REQUIRED[civId].quests) expect(pack.quests.has(q), q).toBe(true);
      for (const c of REQUIRED[civId].cinematics) expect(pack.cinematics.has(c), c).toBe(true);
      expect(pack.manifest.fragments.map((f) => f.id)).toContain(REQUIRED[civId].fragment);
      // Every cinematic of the scenario can be skipped (section 8 of both scenarios).
      for (const c of pack.cinematics.values()) expect(c.skippable, c.id).not.toBe(false);
    });
  }
});
