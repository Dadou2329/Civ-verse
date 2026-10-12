import { describe, expect, it } from 'vitest';
import { migrateCivState, migrateVersioned, SaveLoadError, type LocalCivState } from './saveFormat';

function civState(stateVersion: number, vars: LocalCivState['vars'] = {}): LocalCivState {
  return {
    civId: 'testciv',
    packVersion: '1.0.0',
    stateVersion,
    savedAt: '2026-10-12T00:00:00.000Z',
    scene: 'village',
    player: { position: [0, 0, 0], yaw: 0, pitch: 0, abilities: [], title: null },
    vars,
    inventory: [],
    quests: { states: {}, tracked: null },
    dialogue: { seen: [], chosen: [] },
    rulesFired: [],
    mechanics: {},
    scenes: {},
    playTime: 0,
  };
}

describe('migrateCivState (pack migrations of a civilization’s saved state)', () => {
  const migrations = {
    // v1 → v2: a variable renamed.
    1: (s: LocalCivState) => {
      const { 'testciv.oldName': old, ...vars } = s.vars;
      return { ...s, vars: { ...vars, 'testciv.newName': old ?? null } };
    },
    // v2 → v3: forgets to bump the version itself (the engine sets it).
    2: (s: LocalCivState) => ({ ...s, vars: { ...s.vars, 'testciv.added': true } }),
  };

  it('chains the migrations up to the pack’s version and records each step', () => {
    const saved = civState(1, { 'testciv.oldName': 'Mira' });
    const { state, warnings } = migrateCivState(saved, 3, migrations);
    expect(state.stateVersion).toBe(3);
    expect(state.vars).toEqual({ 'testciv.newName': 'Mira', 'testciv.added': true });
    expect(warnings).toHaveLength(2);
    // The saved object itself is untouched.
    expect(saved.stateVersion).toBe(1);
    expect(saved.vars).toEqual({ 'testciv.oldName': 'Mira' });
  });

  it('leaves a state already at the pack’s version unchanged', () => {
    const { state, warnings } = migrateCivState(civState(3, { a: 1 }), 3, migrations);
    expect(state.vars).toEqual({ a: 1 });
    expect(warnings).toEqual([]);
  });

  it('refuses a missing migration step and a state from a newer pack, in French', () => {
    expect(() => migrateCivState(civState(1), 2, undefined)).toThrow(SaveLoadError);
    expect(() => migrateCivState(civState(1), 2, undefined)).toThrow(/Aucune migration d’état pour « testciv » depuis la version 1/);
    expect(() => migrateCivState(civState(4), 3, migrations)).toThrow(/version plus récente de la civilisation/);
  });
});

describe('migrateVersioned (mechanic and behavior states)', () => {
  const spec = { version: 3, migrate: { 1: (s: unknown) => ({ ...(s as object), b: 2 }), 2: (s: unknown) => ({ ...(s as object), c: 3 }) } };
  const fallback = () => ({ fresh: true });

  it('applies each step from the saved version', () => {
    const warnings: string[] = [];
    expect(migrateVersioned({ version: 1, state: { a: 1 } }, spec, fallback, 'test', (w) => warnings.push(w))).toEqual({ a: 1, b: 2, c: 3 });
    expect(migrateVersioned({ version: 3, state: { a: 1 } }, spec, fallback, 'test', (w) => warnings.push(w))).toEqual({ a: 1 });
    expect(warnings).toEqual([]);
  });

  it('falls back to the initial state, with a warning, when the state cannot be migrated', () => {
    const warnings: string[] = [];
    const warn = (w: string) => warnings.push(w);
    expect(migrateVersioned({ version: 5, state: {} }, spec, fallback, 'test', warn)).toEqual({ fresh: true });
    expect(migrateVersioned({ version: 0, state: {} }, spec, fallback, 'test', warn)).toEqual({ fresh: true });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/plus récent/);
    expect(warnings[1]).toMatch(/pas de migration depuis v0/);
    // Nothing saved: initial state, silently.
    expect(migrateVersioned(undefined, spec, fallback, 'test', warn)).toEqual({ fresh: true });
    expect(warnings).toHaveLength(2);
  });
});
