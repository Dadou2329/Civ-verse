/**
 * Ladders (`core.ladder`), headless: climbing to the ledge, hanging, going down, letting go, going
 * down from the top, and walking normally at the foot of the ladder.
 */
import { describe, expect, it } from 'vitest';
import { MemoryContentProvider, type MemoryPack } from '../packs/memoryProvider';
import { definePack } from '../packs/pack';
import { VoxelVolume } from '../voxel/volume';
import { fillBox } from '../voxel/construct';
import { volumeToDoc } from '../world/sceneVoxels';
import { advance, createHeadlessGame } from '../testing/headless';
import { validateCivilization } from '../packs/validate';
import type { GameSession } from '../sim/session';

const ENV = {
  sky: { top: '#3366aa', horizon: '#aaccee', bottom: '#556677', stars: 0, sunDisc: true },
  sun: { direction: [-0.4, -1, -0.3], color: '#ffeedd', intensity: 1 },
  ambient: { color: '#8899aa', intensity: 0.6 },
  hemi: { sky: '#aabbcc', ground: '#554433', intensity: 0.5 },
  fog: { color: '#aaccee', density: 0.01 },
  blockLight: 1,
  particles: null,
  music: null,
  ambience: null,
  post: { exposure: 1, contrast: 1, saturation: 1, bloom: 0.3, vignette: 0.3 },
};

/** Ground at y = 1; a 5 m cliff from z = 20 whose top (the ledge) is at y = 6. */
function cliffScene() {
  const v = new VoxelVolume(32, 16, 32);
  fillBox(v, [0, 0, 0], [31, 0, 31], 'ech:sol');
  fillBox(v, [0, 1, 20], [31, 5, 31], 'ech:sol');
  return {
    format: 'civverse.scene',
    version: 1,
    id: 'falaise',
    name: 'ech.scene',
    environment: ENV,
    voxels: volumeToDoc(v),
    entities: [
      { id: 'depart', position: [10.5, 1, 18.5], rotation: [0, 0, 0], components: { 'core.spawn': { isDefault: true } } },
      // The climber faces +Z (yaw 0); the volume goes from the ground to the ledge.
      { id: 'echelle', position: [10.5, 1, 19.6], components: { 'core.ladder': { size: [1, 5, 0.8], speed: 2.8 } } },
    ],
  };
}

function pack(): MemoryPack {
  return {
    manifest: {
      format: 'civverse.pack',
      version: 1,
      id: 'ech',
      kind: 'civilization',
      name: 'ech.name',
      description: 'ech.description',
      packVersion: '1.0.0',
      engineApi: '^1.0.0',
      entry: { scene: 'falaise', spawn: 'depart' },
      scenes: ['falaise'],
      stateVersion: 1,
    },
    module: definePack({
      modules: { './mechanics/blocks.ts': { blocks: [{ __kind: 'block', id: 'ech:sol', label: 'Sol', textures: { all: { gen: 'stone', colors: ['#777777'] } } }] } },
    }),
    files: {
      'content/scenes/falaise.scene.json': cliffScene(),
      'locales/fr-FR.json': { 'ech.name': 'Échelles', 'ech.description': 'Civilisation de test des échelles.', 'ech.scene': 'La falaise' },
    },
  };
}

async function start(): Promise<GameSession> {
  const provider = new MemoryContentProvider({ ech: pack() });
  const { session } = await createHeadlessGame(provider);
  await session.loadCivilization('ech');
  await advance(session, 0.5);
  return session;
}

function input(session: GameSession, forward: number, right = 0) {
  session.player.intent.forward = forward;
  session.player.intent.right = right;
}

/** Climbs to mid-height and stops pushing. */
async function climbToMiddle(session: GameSession) {
  input(session, 1);
  for (let i = 0; i < 120 && session.player.position.y < 3.5; i++) await advance(session, 1 / 30);
  input(session, 0);
  await advance(session, 0.2);
}

describe('core.ladder', () => {
  it('passes validation', async () => {
    const { session } = await createHeadlessGame(new MemoryContentProvider({ ech: pack() }));
    const report = await validateCivilization(session, 'ech');
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('climbs to the ledge and hoists the player onto it', async () => {
    const session = await start();
    const grabbed: string[] = [];
    session.bus.on('ladder.grabbed', (p) => grabbed.push(p.entityId));
    input(session, 1);
    await advance(session, 4);
    input(session, 0);
    await advance(session, 0.5);
    const p = session.player.position;
    expect(p.y).toBeCloseTo(6, 1);
    expect(p.z).toBeGreaterThan(20.3);
    expect(session.player.body.grounded).toBe(true);
    expect(grabbed).toEqual(['echelle']);
    // No modifier is left behind once off the ladder.
    expect(session.player.modifierCount).toBe(0);
  });

  it('hangs without input, goes down, and walks away at the foot', async () => {
    const session = await start();
    await climbToMiddle(session);
    const y = session.player.position.y;
    expect(y).toBeGreaterThan(3);
    await advance(session, 1);
    expect(session.player.position.y).toBeCloseTo(y, 2);
    input(session, -1);
    await advance(session, 2);
    expect(session.player.position.y).toBeCloseTo(1, 2);
    // At the foot, walking backward leaves the ladder normally.
    await advance(session, 0.8);
    input(session, 0);
    await advance(session, 0.3);
    expect(session.player.position.z).toBeLessThan(18.9);
    expect(session.player.body.grounded).toBe(true);
    expect(session.player.modifierCount).toBe(0);
  });

  it('lets go with a hop back when jumping on the rungs', async () => {
    const session = await start();
    await climbToMiddle(session);
    session.player.intent.jump = true;
    await advance(session, 1.5);
    const p = session.player.position;
    expect(p.y).toBeCloseTo(1, 2);
    expect(p.z).toBeLessThan(19.2);
    expect(session.player.body.grounded).toBe(true);
  });

  it('goes down from the ledge without falling', async () => {
    const session = await start();
    session.player.teleport({ x: 10.5, y: 6, z: 21.5 }, 180);
    await advance(session, 0.3);
    let fastest = 0;
    session.player.intent.forward = 1;
    for (let i = 0; i < 90; i++) {
      await advance(session, 1 / 30);
      fastest = Math.max(fastest, -session.player.body.velocity.y);
    }
    input(session, 0);
    await advance(session, 0.5);
    expect(session.player.position.y).toBeCloseTo(1, 2);
    // Never a free fall: the ladder carried the player down.
    expect(fastest).toBeLessThan(4);
  });

  it('cannot be climbed while hidden', async () => {
    const session = await start();
    session.entityApi('echelle')!.visible = false;
    input(session, 1);
    await advance(session, 2);
    input(session, 0);
    await advance(session, 0.3);
    expect(session.player.position.y).toBeCloseTo(1, 2);
    expect(session.player.modifierCount).toBe(0);
    session.entityApi('echelle')!.visible = true;
    input(session, 1);
    await advance(session, 4);
    expect(session.player.position.y).toBeCloseTo(6, 1);
  });

  it('lets the player walk past the foot of the ladder sideways', async () => {
    const session = await start();
    session.player.teleport({ x: 10.5, y: 1, z: 19.4 }, 0);
    await advance(session, 0.3);
    input(session, 0, 1);
    await advance(session, 1);
    input(session, 0);
    await advance(session, 0.3);
    expect(session.player.position.x).toBeGreaterThan(12.5);
    expect(session.player.position.y).toBeCloseTo(1, 2);
  });
});
