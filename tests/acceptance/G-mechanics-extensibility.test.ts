/**
 * Acceptance test G — Mechanics extensibility.
 *
 * "Implement a mechanic as an independent module and demonstrate that it works without
 * modifying unrelated engine subsystems."
 *
 * tests/acceptance/fixtures/lanterne is a small civilization pack whose mechanic — a lantern that
 * burns oil, toggled with a key, without which a door stays shut — does not exist anywhere in
 * the engine. Its code only imports '@sdk' (checked below), its content is plain JSON, and the
 * engine loads it through the same path as Door and Memory: definitions are registered, the
 * logic rules use its new action/condition/event, its state is saved, migrated from an older
 * version, and everything disappears when the pack is unloaded.
 */
import { describe, expect, it } from 'vitest';
import { MemoryContentProvider, type MemoryPack } from '@engine/core/packs/memoryProvider';
import { VoxelVolume } from '@engine/core/voxel/volume';
import { fillBox } from '@engine/core/voxel/construct';
import { volumeToDoc } from '@engine/core/world/sceneVoxels';
import { createHeadlessGame } from '@engine/core/testing/headless';
import { validateCivilization } from '@engine/core/packs/validate';
import { parseSave, type SaveGame } from '@engine/core/save/saveFormat';
import type { SceneDoc } from '@engine/core/content/schemas';
import lanternModule from './fixtures/lanterne/pack';
import manifest from './fixtures/lanterne/manifest.json';
import logic from './fixtures/lanterne/content/logic/main.logic.json';
import locale from './fixtures/lanterne/locales/fr-FR.json';
import type { LanternApi } from './fixtures/lanterne/mechanics/lantern';
import { advance, doorIsOpen, flush, norm, walkTo } from './helpers';

const sources = import.meta.glob('./fixtures/lanterne/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function crypt(): SceneDoc {
  const v = new VoxelVolume(24, 8, 24);
  fillBox(v, [0, 0, 0], [23, 0, 23], 'lanterne:dalle');
  fillBox(v, [0, 1, 14], [23, 4, 14], 'lanterne:mur');
  v.set(12, 1, 14, null);
  v.set(12, 2, 14, null);
  return {
    format: 'civverse.scene',
    version: 1,
    id: 'crypte',
    name: 'lanterne.scene.crypte',
    environment: {
      sky: { top: '#101018', horizon: '#202030', bottom: '#101010', stars: 0, sunDisc: false },
      sun: { direction: [-0.4, -1, -0.3], color: '#ffeedd', intensity: 0.2 },
      ambient: { color: '#556677', intensity: 0.3 },
      hemi: { sky: '#445566', ground: '#221a14', intensity: 0.3 },
      fog: { color: '#101018', density: 0.03 },
      blockLight: 1,
      particles: null,
      music: null,
      ambience: null,
      post: { exposure: 1, contrast: 1, saturation: 1, bloom: 0.3, vignette: 0.4 },
    },
    voxels: volumeToDoc(v),
    entities: [
      { id: 'depart', position: [12.5, 1, 6.5], components: { 'core.spawn': { isDefault: true } } },
      { id: 'porte', position: [12.5, 1, 14.5], components: { 'core.door': {}, 'lanterne.needsLight': {} } },
      { id: 'autel', position: [12.5, 1, 19.5], components: { 'core.trigger': { size: [3, 3, 3] } } },
    ],
  } as SceneDoc;
}

function fixture(): MemoryPack {
  return {
    manifest,
    module: lanternModule,
    files: {
      'content/scenes/crypte.scene.json': crypt(),
      'content/logic/main.logic.json': logic,
      'locales/fr-FR.json': locale,
    },
  };
}

describe('Test G — mechanics extensibility', () => {
  it('the lantern mechanic is an independent module: it only imports the SDK', () => {
    const files = Object.keys(sources);
    expect(files).toEqual(expect.arrayContaining(['./fixtures/lanterne/mechanics/lantern.ts', './fixtures/lanterne/pack.ts']));
    for (const [file, code] of Object.entries(sources)) {
      const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      expect(imports.length, file).toBeGreaterThan(0);
      for (const spec of imports) expect(spec, `${file} imports ${spec}`).toBe('@sdk');
    }
  });

  it('a new pack mechanic plugs into interactions, input, logic rules, saves and migrations', async () => {
    const { session, ui } = await createHeadlessGame(new MemoryContentProvider({ lanterne: fixture() }));
    expect(session.behaviorDefs.has('lanterne.needsLight')).toBe(false);

    // The validator accepts the pack like any other civilization (texts, references, rules).
    const report = await validateCivilization(session, 'lanterne');
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);

    await session.loadCivilization('lanterne', { fresh: true });
    await advance(session, 0.2);
    const lamp = () => session.civ!.mechanics.get('lanterne.oil')!.api as LanternApi;
    expect(session.behaviorDefs.has('lanterne.needsLight')).toBe(true);
    expect(session.logicRegistry.action('lanterne.refill')).toBeDefined();
    expect(session.logicRegistry.condition('lanterne.isLit')).toBeDefined();
    expect(lamp().oil).toBe(30);

    // In the dark, the new behavior vetoes the engine's door and says why, in French.
    await walkTo(session, 'porte');
    expect(await session.interaction.interactWith('porte', 'primary', 'open')).toBe(false);
    expect(norm(ui.notifications.at(-1)?.text)).toBe('Il fait trop sombre pour trouver la serrure.');

    // The pack's own key binding lights the lantern; the door now opens.
    expect(session.handleKey('KeyL', true)).toBe(true);
    session.handleKey('KeyL', false);
    expect(lamp().lit).toBe(true);
    expect(session.vars.get('lanterne.lit')).toBe(true);
    expect(await session.interaction.interactWith('porte', 'primary', 'open')).toBe(true);
    await advance(session, 0.3);
    expect(doorIsOpen(session, 'porte')).toBe(true);

    // A data-driven rule uses the new condition.
    await walkTo(session, 'autel', { reach: 0.6 });
    await advance(session, 0.3);
    expect(session.vars.get('lanterne.altarSeen')).toBe(true);

    // Oil burns with simulated time; the new event fires and a rule reacts to it.
    const oilBefore = lamp().oil;
    await advance(session, 3);
    expect(lamp().oil).toBeLessThan(oilBefore);
    await advance(session, 40);
    expect(lamp().lit).toBe(false);
    expect(lamp().oil).toBe(0);
    expect(session.vars.get('lanterne.darkness')).toBe(true);
    expect(lamp().light()).toBe(false);
    expect(norm(ui.notifications.at(-1)?.text)).toBe('La lanterne n’a plus d’huile.');

    // The new action is usable from any logic (rules, dialogues, quests, cinematics).
    await session.civ!.ctx.logic.run([{ type: 'lanterne.refill', amount: 40 }]);
    expect(lamp().oil).toBe(40);

    // Its state is saved and restored by the engine's save format…
    const json = JSON.stringify(session.buildSaveGame('auto', 'Test G'));
    const { session: s2 } = await createHeadlessGame(new MemoryContentProvider({ lanterne: fixture() }));
    await s2.applySaveGame(parseSave(JSON.parse(json)).save);
    await s2.loadCivilization('lanterne');
    await flush();
    expect((s2.civ!.mechanics.get('lanterne.oil')!.api as LanternApi).oil).toBe(40);
    expect(doorIsOpen(s2, 'porte')).toBe(true);

    // …and a state saved by an older version of the mechanic is migrated (v1 → v2).
    const old = JSON.parse(json) as SaveGame;
    old.civs.lanterne!.mechanics['lanterne.oil'] = { version: 1, state: { fuel: 2.5 } };
    const { session: s3 } = await createHeadlessGame(new MemoryContentProvider({ lanterne: fixture() }));
    await s3.applySaveGame(parseSave(old).save);
    await s3.loadCivilization('lanterne');
    expect((s3.civ!.mechanics.get('lanterne.oil')!.api as LanternApi).oil).toBe(25);

    // Unloading the pack removes everything it registered.
    await s3.unloadCivilization();
    expect(s3.behaviorDefs.has('lanterne.needsLight')).toBe(false);
    expect(s3.logicRegistry.action('lanterne.refill')).toBeUndefined();
    expect(s3.leakedListeners).toBe(0);
  });
});
