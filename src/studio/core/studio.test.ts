/**
 * Civilization Studio core, without the DOM or Babylon: documents, history, scene editing,
 * texts and saving (to an in-memory disk).
 */
import { describe, expect, it } from 'vitest';
import { GlobContentProvider } from '@engine/platform/globContent';
import { volumeFromDoc } from '@engine/core/world/sceneVoxels';
import type { SceneDoc } from '@engine/core/content/schemas';
import { History } from './history';
import { Studio } from './studio';
import { ENTITY_TEMPLATES } from './templates';
import type { ProjectIO } from './project';

/** The repository's pack files (raw text), as the dev server would list them. */
const FILES = import.meta.glob(['/civilizations/*/**/*.{json,ts,tsx,css}', '!/civilizations/*/seed/**', '!/civilizations/*/tests/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Reads the real repository files; writes go to memory. */
function memoryIO(): ProjectIO & { written: Map<string, string>; expected: Map<string, number | null> } {
  const written = new Map<string, string>();
  const expected = new Map<string, number | null>();
  const all = Object.keys(FILES).map((p) => p.slice(1));
  return {
    writable: true,
    written,
    expected,
    listPacks: async () => {
      const ids = [...new Set(all.filter((p) => p.endsWith('/manifest.json')).map((p) => p.split('/')[1]!))];
      return ids.map((id) => ({ id, files: all.filter((p) => p.startsWith(`civilizations/${id}/`)) }));
    },
    read: async (p) => ({ content: written.get(p) ?? FILES[`/${p}`]!, mtimeMs: 1000 }),
    write: async (p, content, exp) => {
      written.set(p, content);
      expected.set(p, exp);
      return { mtimeMs: 2000, backup: null };
    },
    remove: async () => ({ backup: null }),
  };
}

async function openDoor() {
  const io = memoryIO();
  const studio = await Studio.create({ io, provider: new GlobContentProvider() });
  await studio.openPack('door');
  return { studio, io };
}

describe('History', () => {
  it('undoes, redoes, merges quick edits and groups transactions', () => {
    const h = new History();
    let v = 0;
    const set = (to: number, key?: string) => {
      const from = v;
      const state = { to };
      h.push({
        label: `v=${to}`,
        mergeKey: key,
        apply: () => (v = state.to),
        revert: () => (v = from),
        absorb: (next) => (state.to = (next as unknown as { s: { to: number } }).s.to),
        ...({ s: state } as object),
      });
    };
    set(1);
    set(2, 'typing');
    set(3, 'typing');
    expect(v).toBe(3);
    expect(h.undo()).toBe(true);
    expect(v).toBe(1); // the two typing steps were merged
    expect(h.redo()).toBe(true);
    expect(v).toBe(3);
    h.transaction('deux', () => {
      set(10);
      set(20);
    });
    expect(v).toBe(20);
    expect(h.undoLabel).toBe('deux');
    h.undo();
    expect(v).toBe(3);
  });
});

describe('Studio', () => {
  it('opens a pack and edits its entry scene', async () => {
    const { studio } = await openDoor();
    expect(studio.scenePath).toBe('civilizations/door/content/scenes/verrou.scene.json');
    const scene = studio.sceneDoc()!;
    expect(studio.world!.entities.size).toBe(scene.entities.length);
    // Components are shown with their props (normalized) but no behavior runs.
    const door = studio.world!.entities.get('cell_door')!;
    expect(door.components.get('core.door')?.instance).toBeNull();
    expect(door.components.get('core.door')?.props.model).toBe('door:door_handleless');
    expect(studio.project.dirty()).toEqual([]);
  });

  it('adds an NPC with a French name key, and undoes both changes at once', async () => {
    const { studio } = await openDoor();
    const npc = ENTITY_TEMPLATES.find((t) => t.id === 'npc')!;
    const id = studio.addFromTemplate(npc, [10.2, 8, 20.7])!;
    expect(id).toBe('personnage');
    const doc = studio.entity(id)!;
    expect(doc.position).toEqual([10, 8, 20.5]);
    const key = doc.components['core.npc']!.name as string;
    expect(key).toBe('door.verrou.personnage.name');
    expect(studio.t(key)).toBe('Nouveau personnage');
    expect(studio.world!.entities.has(id)).toBe(true);
    expect(studio.selection).toEqual([id]);
    expect(studio.project.dirty().map((d) => d.rel).sort()).toEqual(['content/scenes/verrou.scene.json', 'locales/fr-FR.json']);
    expect(studio.history.undoLabel).toBe('Ajouter : Personnage');
    studio.undo();
    expect(studio.entity(id)).toBeUndefined();
    expect(studio.world!.entities.has(id)).toBe(false);
    expect(studio.project.dirty()).toEqual([]);
    studio.redo();
    expect(studio.entity(id)).toBeDefined();
  });

  it('edits texts in place and merges keystrokes into one undo step', async () => {
    const { studio } = await openDoor();
    studio.setText('door.npc.mira', 'Mi');
    studio.setText('door.npc.mira', 'Mira la');
    studio.setText('door.npc.mira', 'Mira la réparatrice');
    expect(studio.t('door.npc.mira')).toBe('Mira la réparatrice');
    studio.undo();
    expect(studio.t('door.npc.mira')).toBe('Mira');
  });

  it('moves, duplicates, renames and deletes entities', async () => {
    const { studio } = await openDoor();
    studio.select(['noe']);
    studio.updateSelected('Déplacer', (e) => {
      e.position = [1, 2, 3];
    });
    expect(studio.world!.entities.get('noe')!.position).toEqual({ x: 1, y: 2, z: 3 });
    studio.duplicateSelection();
    expect(studio.selection).toEqual(['noe_2']);
    expect(studio.entity('noe_2')!.position).toEqual([2, 2, 3]);
    expect(studio.renameEntity('noe_2', 'noe copie')).toMatch(/invalide/);
    expect(studio.renameEntity('noe_2', 'noe')).toMatch(/existe déjà/);
    expect(studio.renameEntity('noe_2', 'noe_bis')).toBeNull();
    expect(studio.world!.entities.has('noe_bis')).toBe(true);
    studio.deleteSelection();
    expect(studio.entity('noe_bis')).toBeUndefined();
    studio.undo();
    expect(studio.entity('noe_bis')).toBeDefined();
  });

  it('edits blocks live, saves them into the scene file, and undoes after switching scenes', async () => {
    const { studio, io } = await openDoor();
    const world = studio.world!;
    const before = world.volume.get(5, 20, 5);
    studio.editVoxels('Poser des blocs', [
      [5, 20, 5, before, 'core:gold'],
      [6, 20, 5, world.volume.get(6, 20, 5), 'core:gold'],
    ]);
    expect(world.volume.get(5, 20, 5)).toBe('core:gold');
    expect(studio.project.dirty().map((d) => d.rel)).toEqual(['content/scenes/verrou.scene.json']);
    expect(await studio.saveAll()).toBe(true);
    const saved = JSON.parse(io.written.get('civilizations/door/content/scenes/verrou.scene.json')!) as SceneDoc;
    expect(volumeFromDoc(saved.voxels).get(6, 20, 5)).toBe('core:gold');
    expect(io.expected.get('civilizations/door/content/scenes/verrou.scene.json')).toBe(1000);
    expect(studio.project.dirty()).toEqual([]);

    // Switch scenes, then undo: the change is reverted in the document itself.
    await studio.openDoc('civilizations/door/content/scenes/porte_absente.scene.json');
    studio.undo();
    const verrou = studio.project.doc('civilizations/door/content/scenes/verrou.scene.json')!;
    expect(volumeFromDoc((verrou.data as SceneDoc).voxels).get(5, 20, 5)).toBe(before);
    expect(studio.project.isDirty(verrou)).toBe(true);
  });

  it('creates documents as undoable steps, and nothing is written for an undone creation', async () => {
    const { studio, io } = await openDoor();
    const path = 'civilizations/door/content/logic/essai.logic.json';
    studio.createDoc('door', 'content/logic/essai.logic.json', { format: 'civverse.logic', version: 1, id: 'essai', rules: [] });
    await studio.openDoc(path);
    expect(studio.project.docsOf('door', 'logic').map((d) => d.id)).toContain('essai');
    expect(studio.tabs.map((t) => t.path)).toContain(path);

    studio.undo();
    expect(studio.project.docsOf('door', 'logic').map((d) => d.id)).not.toContain('essai');
    expect(studio.tabs.map((t) => t.path)).not.toContain(path);
    expect(studio.project.dirty()).toEqual([]);
    await studio.saveAll();
    expect(io.written.has(path)).toBe(false);

    studio.redo();
    expect(studio.project.docsOf('door', 'logic').map((d) => d.id)).toContain('essai');
    await studio.saveAll();
    expect(JSON.parse(io.written.get(path)!)).toMatchObject({ id: 'essai', rules: [] });
  });
});
