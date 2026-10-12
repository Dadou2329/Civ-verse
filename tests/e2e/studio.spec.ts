/**
 * Browser acceptance tests of Civilization Studio (studio.html on the dev server).
 *
 *  B — World editing: create an object, change its position, save, reload the Studio, and the
 *      change is still there (in the editor and in the file on disk).
 *  C — Playtest: edit a scene, play it from the editor, interact with the new object, return
 *      to the editor with the edits intact.
 *  I — Editor code integration: create a gameplay script, modify it in the code editor, save
 *      (compiled by Vite, type-checked by the server), attach it to an entity and use it in a
 *      playtest.
 *
 * These tests write real files of the Door pack (that is what saving means). Every file they
 * touch is copied before the tests and restored byte for byte afterwards, and the created
 * script is removed; the restoration is itself checked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { collectErrors, lookAt, norm, onSession, prepareGame, type Vec } from './support';

test.describe.configure({ mode: 'serial' });

const repo = path.resolve(import.meta.dirname, '../..');
const SCENE = 'civilizations/door/content/scenes/verrou.scene.json';
const LOCALE = 'civilizations/door/locales/fr-FR.json';
const SCRIPT = 'civilizations/door/mechanics/sonnetteEssai.ts';
const snapshot = new Map<string, Buffer>();

let page: Page;
let errors: string[] = [];

interface StudioHandle {
  scenePath: string | null;
  busy: string | null;
  selection: string[];
  log: { level: string; text: string }[];
  project: { dirty(): unknown[] };
  sceneDoc(): { entities: { id: string; position: [number, number, number]; components: Record<string, unknown> }[] } | null;
}

function onStudio<T, A = undefined>(fn: (studio: StudioHandle, arg: A) => T, arg?: A): Promise<T> {
  return page.evaluate(
    ([src, a]) => {
      const studio = (window as unknown as { __studio?: unknown }).__studio;
      if (!studio) throw new Error('window.__studio absent');
      return new Function('studio', 'arg', `return (${src})(studio, arg);`)(studio, a) as T;
    },
    [fn.toString(), arg] as const,
  );
}

async function openStudio(): Promise<void> {
  await page.goto('/studio.html?pack=door');
  await expect(page.getByTestId('studio')).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => onStudio((s) => !!s.scenePath && !s.busy), { timeout: 180_000 }).toBe(true);
  expect(await onStudio((s) => s.scenePath)).toBe(SCENE);
}

/** Camera of the editor at the cell of the prologue, looking at a point in front of the spawn. */
async function aimEditorCamera(): Promise<void> {
  // The viewport restores the scene's saved view once its world is built: aim until it holds.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          type Viewport = { showPose(p: unknown): void; cameraPose(): { position: [number, number, number] } };
          const ref = (window as unknown as { __studioViewport: { current: Viewport | null } }).__studioViewport;
          if (!ref.current) return false;
          ref.current.showPose({ position: { x: 8.5, y: 9.6, z: 27.5 }, target: { x: 10.2, y: 8.6, z: 27.5 }, fov: 70 });
          await new Promise((r) => setTimeout(r, 1500));
          const [x, y, z] = ref.current.cameraPose().position;
          return Math.hypot(x - 8.5, y - 9.6, z - 27.5) < 0.05;
        }),
      { timeout: 60_000, message: 'caméra de l’éditeur placée' },
    )
    .toBe(true);
}

/** Adds an entity from the « Ajouter » menu and places it with the inspector's fields. */
async function addEntity(template: string, position: [number, number, number]): Promise<string> {
  const before = await onStudio((s) => s.sceneDoc()!.entities.length);
  await page.getByTestId('st-add-entity').click();
  await page.getByTestId(`st-add-${template}`).click();
  await expect.poll(() => onStudio((s) => s.sceneDoc()!.entities.length)).toBe(before + 1);
  const id = await onStudio((s) => s.selection[0]!);
  const inputs = page.getByTestId('st-position').locator('input');
  for (let i = 0; i < 3; i++) {
    await inputs.nth(i).fill(String(position[i]));
    await inputs.nth(i).blur();
  }
  await expect.poll(() => onStudio((s, eid) => s.sceneDoc()!.entities.find((e) => e.id === eid)?.position, id)).toEqual(position);
  return id;
}

async function playHere(): Promise<void> {
  await page.getByTestId('st-play-here').click();
  await expect(page.getByTestId('st-playtest')).toBeVisible();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 240_000 });
  await expect.poll(() => onSession(page, (s: { civ: { id: string } | null }) => s.civ?.id ?? null), { timeout: 120_000 }).toBe('door');
}

async function useEntity(id: string, at: Vec): Promise<void> {
  // « Jouer ici » puts the player where the editor camera was (in the prologue cell).
  const p = await onSession(page, (s: { player: { position: Vec } }) => ({ ...s.player.position }));
  expect(Math.hypot(p.x - 8.5, p.z - 27.5), `joueur en (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`).toBeLessThan(0.6);
  await lookAt(page, at);
  await expect
    .poll(() => onSession(page, (s: { interaction: { target: { entityId: string } | null } }) => s.interaction.target?.entityId ?? null), { timeout: 60_000 })
    .toBe(id);
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyE');
}

async function stopPlaytest(): Promise<void> {
  await page.keyboard.press('F8');
  await expect(page.getByTestId('st-playtest')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId('st-viewport')).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  for (const rel of [SCENE, LOCALE]) snapshot.set(rel, fs.readFileSync(path.join(repo, rel)));
  expect(fs.existsSync(path.join(repo, SCRIPT))).toBe(false);
  page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  errors = collectErrors(page);
  // Leaving a Studio with unsaved edits asks for confirmation: the tests discard them.
  page.on('dialog', (d) => void (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
  await prepareGame(page);
});

test.afterAll(async () => {
  await page?.close();
  for (const [rel, bytes] of snapshot) fs.writeFileSync(path.join(repo, rel), bytes);
  fs.rmSync(path.join(repo, SCRIPT), { force: true });
  for (const [rel, bytes] of snapshot) expect(fs.readFileSync(path.join(repo, rel)).equals(bytes), `${rel} restauré`).toBe(true);
  expect(fs.existsSync(path.join(repo, SCRIPT))).toBe(false);
});

test('B — create an object, move it, save, reload: the change remains', async () => {
  test.setTimeout(600_000);
  await openStudio();
  const id = await addEntity('sign', [20.5, 8, 40.5]);
  expect(await onStudio((s) => s.project.dirty().length)).toBeGreaterThan(0);

  await page.getByTestId('st-save').click();
  await expect.poll(() => onStudio((s) => s.project.dirty().length), { timeout: 60_000 }).toBe(0);
  // Written to the scene file (and its French text to the locale table).
  const onDisk = JSON.parse(fs.readFileSync(path.join(repo, SCENE), 'utf8')) as { entities: { id: string; position: number[] }[] };
  expect(onDisk.entities.find((e) => e.id === id)?.position).toEqual([20.5, 8, 40.5]);
  expect(Object.values(JSON.parse(fs.readFileSync(path.join(repo, LOCALE), 'utf8')) as Record<string, string>)).toContain('NOUVEAU PANNEAU');

  // Reload the Studio: the object is there, where it was put.
  await openStudio();
  expect(await onStudio((s, eid) => s.sceneDoc()!.entities.find((e) => e.id === eid)?.position, id)).toEqual([20.5, 8, 40.5]);
  await page.getByTestId('st-hierarchy-filter').fill(id);
  await page.getByTestId(`st-entity-${id}`).click();
  const inputs = page.getByTestId('st-position').locator('input');
  await expect(inputs.nth(0)).toHaveValue('20.5');
  await expect(inputs.nth(1)).toHaveValue('8');
  await expect(inputs.nth(2)).toHaveValue('40.5');
  expect(errors).toEqual([]);
});

test('C — edit the scene, play it, use the new object, come back to the editor', async () => {
  test.setTimeout(600_000);
  await openStudio();
  await aimEditorCamera();
  const id = await addEntity('interactable', [10.2, 8, 27.5]);
  // Give it an action in the inspector: a French notification.
  const addAction = page.locator('select', { has: page.locator('option', { hasText: 'Ajouter une action' }) }).first();
  await addAction.selectOption('core.notify');
  const notifyBlock = page.locator('.st-block').filter({ hasText: 'Afficher une notification' }).first();
  await notifyBlock.getByRole('button', { name: '＋ Écrire un texte' }).click();
  await notifyBlock.locator('input.st-input').first().fill('La sonnette du test répond.');
  await expect.poll(() => onStudio((s, eid) => JSON.stringify(s.sceneDoc()!.entities.find((e) => e.id === eid)?.components), id)).toContain('core.notify');

  await playHere();
  await useEntity(id, { x: 10.2, y: 8.5, z: 27.5 });
  await expect.poll(async () => norm(await page.getByTestId('notifications').textContent()), { timeout: 60_000 }).toContain('La sonnette du test répond.');

  await stopPlaytest();
  // Back in the editor: the unsaved edits are still there.
  expect(await onStudio((s, eid) => !!s.sceneDoc()!.entities.find((e) => e.id === eid), id)).toBe(true);
  expect(await onStudio((s) => s.project.dirty().length)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('I — write a gameplay script, compile it, attach it, test it', async () => {
  test.setTimeout(900_000);
  await openStudio();
  // New script from the Explorer (development server only).
  await page.getByTitle('Nouveau script').click();
  await page.locator('.st-modal input.st-input').fill('Sonnette essai');
  await page.getByRole('button', { name: 'Créer le script' }).click();
  const editor = page.getByTestId('st-script-editor');
  await expect(editor.locator('.monaco-editor')).toBeVisible({ timeout: 120_000 });
  await expect(editor).toContainText('Aucune erreur de type', { timeout: 120_000 });
  expect(fs.existsSync(path.join(repo, SCRIPT))).toBe(true);

  // Modify it in the code editor: interacting now also records a story variable.
  const lines = fs.readFileSync(path.join(repo, SCRIPT), 'utf8').split('\n');
  const line = lines.findIndex((l) => l.includes('ctx.ui.notify(ctx.t(ctx.props.message))')) + 1;
  expect(line).toBeGreaterThan(0);
  await editor.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('Control+G');
  await page.keyboard.type(String(line));
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type("ctx.vars.set('door.sonnetteEssai', true);");
  await page.getByTestId('st-script-save').click();
  // Saved, compiled by Vite and re-imported by the Studio, type-checked by the server.
  await expect.poll(() => fs.readFileSync(path.join(repo, SCRIPT), 'utf8'), { timeout: 60_000 }).toContain("ctx.vars.set('door.sonnetteEssai', true);");
  await expect
    .poll(() => onStudio((s) => s.log.filter((l) => l.text.includes('Vérification des types')).length), { timeout: 120_000 })
    .toBeGreaterThanOrEqual(2);
  expect(await onStudio((s) => s.log.filter((l) => l.text.includes('Vérification des types')).at(-1)!.text)).toContain('0 erreur(s)');
  await expect.poll(() => page.evaluate(() => {
    const st = (window as unknown as { __studio: { session: { behaviorDefs: Map<string, unknown> } } }).__studio;
    return st.session.behaviorDefs.has('door.sonnetteEssai');
  }), { timeout: 120_000 }).toBe(true);

  // Attach it to a new marker in the scene, from the inspector.
  await page.locator(`.st-tab[title="${SCENE}"]`).click();
  await aimEditorCamera();
  const id = await addEntity('marker', [10.2, 8, 26.5]);
  await page.getByTestId('st-add-component').selectOption('door.sonnetteEssai');
  await expect.poll(() => onStudio((s, eid) => Object.keys(s.sceneDoc()!.entities.find((e) => e.id === eid)!.components), id)).toContain('door.sonnetteEssai');

  // Play: the new behavior answers the interaction.
  await playHere();
  await useEntity(id, { x: 10.2, y: 8.6, z: 26.5 });
  await expect
    .poll(() => onSession(page, (s: { vars: { get(n: string): unknown } }) => s.vars.get('door.sonnetteEssai')), { timeout: 60_000 })
    .toBe(true);
  await stopPlaytest();
  expect(errors).toEqual([]);
});
