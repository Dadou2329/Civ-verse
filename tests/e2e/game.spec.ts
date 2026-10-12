/**
 * Browser acceptance tests of the game (index.html), in the real renderer and React interface.
 *
 *  A — Player gameplay: launch the game, enter an environment, move, jump, interact and open a
 *      dialogue without errors.
 *  E — Save persistence in the browser: save from the pause menu (IndexedDB), reload the page,
 *      load, and find the progress again.
 *  H — Civilization-specific UI: Door and Memory each show their own interface.
 *
 * The tests share one page (serial): E continues A's game, H continues E's.
 */
import { expect, test, type Page } from '@playwright/test';
import { collectErrors, holdKeyUntil, lookAt, norm, onSession, playerPosition, prepareGame, tap, waitForSession, type Vec } from './support';

test.describe.configure({ mode: 'serial' });

let page: Page;
let errors: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = collectErrors(page);
  await prepareGame(page);
});

test.afterAll(async () => {
  await page.close();
});

const entityPos = (id: string) =>
  onSession(page, (s: { world: { entities: Map<string, { position: Vec }> } | null }, eid: string) => ({ ...s.world!.entities.get(eid)!.position }), id);

test('A — start Door, move, jump, interact and talk, in French and without errors', async () => {
  test.setTimeout(600_000);
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('menu-civs')).toHaveText('Civilisations');

  await page.getByTestId('menu-civs').click();
  await expect(page.getByTestId('civ-select')).toBeVisible();
  await expect(page.getByTestId('civ-door')).toContainText('La Porte qui n’existe pas');
  await page.getByTestId('play-door').click();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 240_000 });

  // The awakening cinematic plays; Espace skips it.
  await waitForSession(page, (s: { cinematics: { current: { id: string } | null } }) => s.cinematics.current?.id === 'C01_eveil', 60_000);
  await page.keyboard.down('Space');
  await waitForSession(page, (s: { cinematics: { current: unknown } }) => s.cinematics.current === null, 60_000, 'cinématique passée');
  await page.keyboard.up('Space');
  await expect(page.getByTestId('objectives')).toContainText('Sortir de la cellule', { timeout: 30_000 });

  // Move: Z/W walks toward the handleless door of the cell.
  const start = await playerPosition(page);
  await holdKeyUntil(page, 'KeyW', (s: { player: { position: Vec } }) => s.player.position.x > 9.6);
  const moved = await playerPosition(page);
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(1);

  // Jump: Espace leaves the ground.
  await onSession(page, (s: { bus: { on(n: string, cb: () => void): unknown } }) => {
    (window as unknown as { __jumped: boolean }).__jumped = false;
    s.bus.on('player.jumped', () => ((window as unknown as { __jumped: boolean }).__jumped = true));
  });
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __jumped: boolean }).__jumped), { timeout: 60_000 }).toBe(true);
  await page.keyboard.up('Space');

  // Interact: aim at the door; the prompt is in French; E opens it with the palm.
  await lookAt(page, { ...(await entityPos('cell_door')), y: 9.2 });
  await waitForSession(page, (s: { interaction: { target: { entityId: string } | null } }) => s.interaction.target?.entityId === 'cell_door', 60_000, 'porte visée');
  await expect(page.getByTestId('prompt')).toBeVisible({ timeout: 30_000 });
  await tap(page, 'KeyE');
  await waitForSession(page, (s: { vars: { get(n: string): unknown } }) => s.vars.get('door.palmRevealed') === true, 60_000, 'paume révélée');

  // Leave the cell (objective), then walk to Noé and talk to him.
  await lookAt(page, { x: 14.5, y: 9.4, z: 27.5 });
  await holdKeyUntil(page, 'KeyW', (s: { quests: { isObjectiveDone(q: string, o: string): boolean } }) => s.quests.isObjectiveDone('DOOR_Q00_REVEIL', 'sortir'), 120_000);
  const noe = await entityPos('noe');
  await lookAt(page, { ...noe, y: noe.y + 1.4 });
  await holdKeyUntil(
    page,
    'KeyW',
    (s: { player: { position: Vec }; world: { entities: Map<string, { position: Vec }> } }) => {
      const p = s.player.position;
      const n = s.world.entities.get('noe')!.position;
      return Math.hypot(p.x - n.x, p.z - n.z) < 2.2;
    },
    120_000,
  );
  await lookAt(page, { ...noe, y: noe.y + 1.4 });
  await waitForSession(page, (s: { interaction: { target: { entityId: string } | null } }) => s.interaction.target?.entityId === 'noe', 60_000, 'Noé visé');
  await tap(page, 'KeyE');
  const dialogue = page.getByTestId('dialogue');
  await expect(dialogue).toBeVisible({ timeout: 60_000 });
  await expect(dialogue).toContainText('Noé');
  await expect.poll(async () => norm(await dialogue.textContent()), { timeout: 30_000 }).toContain('Attends… Il n’y a pas de pièce derrière cette porte.');
  // Answer like a player: click to advance, choose replies.
  await expect(page.getByTestId('choice-from')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('choice-from').click();
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('choice-thanks').isVisible()) break;
    if (await dialogue.isVisible()) await dialogue.click();
    await page.waitForTimeout(500);
  }
  await page.getByTestId('choice-thanks').click();
  for (let i = 0; i < 40 && (await dialogue.isVisible()); i++) {
    await dialogue.click().catch(() => undefined);
    await page.waitForTimeout(500);
  }
  await waitForSession(page, (s: { quests: { status(id: string): string } }) => s.quests.status('DOOR_Q00_REVEIL') === 'completed', 60_000, 'quête terminée');
  expect(await onSession(page, (s: { vars: { get(n: string): unknown } }) => s.vars.get('door.rank'))).toBe(0);
  expect(errors).toEqual([]);
});

test('E — save from the pause menu, reload the page, load: the progress is still there', async () => {
  test.setTimeout(600_000);
  const before = await playerPosition(page);
  await tap(page, 'KeyP');
  await page.getByTestId('pause-save').click();
  await page.getByTestId('slot-slot1').click();
  await expect(page.getByTestId('notifications')).toContainText('Partie sauvegardée', { timeout: 30_000 });

  // Close the game page entirely: only IndexedDB keeps the save.
  await page.reload();
  await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 240_000 });
  // Load the manual save explicitly (pause → Charger → Emplacement 1).
  await tap(page, 'KeyP');
  await page.getByRole('button', { name: 'Charger' }).click();
  await page.getByTestId('slot-slot1').click();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 240_000 });
  await waitForSession(page, (s: { civ: { id: string } | null }) => s.civ?.id === 'door', 120_000);

  const after = await onSession(page, (s: { quests: { status(id: string): string }; vars: { get(n: string): unknown }; civ: { ctx: { inventory: { has(id: string): boolean } } }; cinematics: { current: unknown } }) => ({
    q0: s.quests.status('DOOR_Q00_REVEIL'),
    q1: s.quests.status('DOOR_Q01_EMPREINTE'),
    rank: s.vars.get('door.rank'),
    plaque: s.civ.ctx.inventory.has('door:plaque_r0'),
    cinematic: s.cinematics.current,
  }));
  expect(after).toEqual({ q0: 'completed', q1: 'active', rank: 0, plaque: true, cinematic: null });
  const pos = await playerPosition(page);
  expect(Math.hypot(pos.x - before.x, pos.z - before.z)).toBeLessThan(0.5);
  await expect(page.getByTestId('objectives')).toContainText('Le prix d’une poignée', { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('H — Door and Memory each show their own interface', async () => {
  test.setTimeout(600_000);
  // Door: rank plaque, Door theme.
  await expect(page.getByTestId('door-plaque')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('door-plaque')).toContainText('Sans-Seuil');
  await expect(page.getByTestId('mem-chamber-hud')).toHaveCount(0);
  const doorRoot = page.locator('.cv-root');
  await expect(doorRoot).toHaveAttribute('data-civ', 'door');
  const doorAccent = await doorRoot.evaluate((el) => getComputedStyle(el).getPropertyValue('--civ-accent').trim());

  // Back to the menu, then Memory.
  await tap(page, 'KeyP');
  await page.getByTestId('pause-quit').click();
  await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('menu-civs').click();
  await page.getByTestId('play-memory').click();
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 240_000 });
  await waitForSession(page, (s: { cinematics: { current: { id: string } | null } }) => s.cinematics.current?.id === 'M01_marche', 60_000);
  await page.keyboard.down('Space');
  await waitForSession(page, (s: { cinematics: { current: unknown } }) => s.cinematics.current === null, 60_000);
  await page.keyboard.up('Space');

  // Memory: memory chamber HUD, no rank plaque, another theme.
  await expect(page.getByTestId('mem-chamber-hud')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('mem-chamber-hud')).toContainText('Chambre mnésique');
  await expect(page.getByTestId('door-plaque')).toHaveCount(0);
  const memRoot = page.locator('.cv-root');
  await expect(memRoot).toHaveAttribute('data-civ', 'memory');
  const memAccent = await memRoot.evaluate((el) => getComputedStyle(el).getPropertyValue('--civ-accent').trim());
  expect(memAccent).not.toBe(doorAccent);
  // Its own key opens its own panel (M → chamber), in French.
  await tap(page, 'KeyM');
  await expect(page.getByTestId('mem-chamber')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('door-permissions')).toHaveCount(0);
  expect(errors).toEqual([]);
});

