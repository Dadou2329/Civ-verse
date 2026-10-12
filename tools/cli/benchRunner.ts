/**
 * Performance measurements (`npm run bench`), executed inside Vite's module runner like the
 * validation (packs use `import.meta.glob`).
 *
 * Measures, on the real packs, the CPU work the game does: loading a civilization (content,
 * voxel decoding, entities, light), baking the light field, building the texture atlas, meshing
 * every chunk, one simulation step, and writing a save. GPU rendering is not measured here: it
 * depends on the machine and browser — use the in-game counter (Paramètres → « Afficher les i/s »).
 */
import os from 'node:os';
import { GlobContentProvider } from '../../src/engine/platform/globContent.ts';
import { GameSession } from '../../src/engine/core/sim/session.ts';
import { HeadlessUi } from '../../src/engine/core/sim/uiBridge.ts';
import { BlockRegistry } from '../../src/engine/core/voxel/blocks.ts';
import { buildAtlas } from '../../src/engine/core/voxel/textures/atlas.ts';
import { chunkCounts, meshChunk } from '../../src/engine/core/voxel/mesher.ts';

interface Stats {
  median: number;
  p95: number;
  max: number;
}

function stats(samples: number[]): Stats {
  const s = [...samples].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  return { median: at(0.5), p95: at(0.95), max: s[s.length - 1]! };
}

const ms = (n: number) => `${n < 10 ? n.toFixed(2) : n.toFixed(0)} ms`;

async function time<T>(fn: () => T | Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const r = await fn();
  return [r, performance.now() - t0];
}

export async function runBench(only: string[] = []): Promise<void> {
  const session = await GameSession.create({ mode: 'headless', provider: new GlobContentProvider(), ui: new HeadlessUi() });
  const civs = [...session.manifests.values()].filter((m) => m.kind === 'civilization' && (only.length === 0 || only.includes(m.id)));
  const cpu = os.cpus()[0]?.model ?? 'processeur inconnu';
  console.log(`Mesures CPU — Node ${process.version}, ${cpu} (${os.cpus().length} cœurs)\n`);

  for (const m of civs) {
    // Loading: content parsing, voxel decoding, entities, behaviors, light (median of 3).
    const loads: number[] = [];
    for (let i = 0; i < 3; i++) loads.push((await time(() => session.loadCivilization(m.id, { fresh: true })))[1]);
    const world = session.world!;
    const v = world.volume;

    const lights: number[] = [];
    for (let i = 0; i < 3; i++) lights.push((await time(() => world.computeLight()))[1]);

    const [atlas, atlasMs] = await time(() => buildAtlas(session.blocks.all().flatMap((d) => [0, 1, 2, 3, 4, 5].map((f) => BlockRegistry.faceTexture(d, f)))));

    // Meshing: every chunk of the scene, as the renderer does when a scene is entered.
    const ctx = { volume: v, info: world.paletteInfo(), atlas, light: world.light };
    const [cx, cy, cz] = chunkCounts(v);
    const chunkTimes: number[] = [];
    let vertices = 0;
    let meshes = 0;
    for (let y = 0; y < cy; y++) {
      for (let z = 0; z < cz; z++) {
        for (let x = 0; x < cx; x++) {
          const t0 = performance.now();
          const r = meshChunk(ctx, x, y, z);
          chunkTimes.push(performance.now() - t0);
          for (const layer of Object.values(r.layers)) {
            if (!layer) continue;
            vertices += layer.positions.length / 3;
            meshes++;
          }
        }
      }
    }
    const meshTotal = chunkTimes.reduce((a, b) => a + b, 0);

    // Simulation: 10 s of play at 60 steps per second (NPCs, behaviors, triggers, physics).
    session.cinematics.skip();
    await Promise.resolve();
    const steps: number[] = [];
    for (let i = 0; i < 600; i++) {
      const t0 = performance.now();
      session.update(1 / 60);
      steps.push(performance.now() - t0);
      if (i % 30 === 0) await Promise.resolve();
    }

    const [json, saveMs] = await time(() => JSON.stringify(session.buildSaveGame('bench', 'mesure')));

    const step = stats(steps);
    const chunk = stats(chunkTimes);
    console.log(`■ ${m.id} — scène « ${world.id} » ${v.sizeX}×${v.sizeY}×${v.sizeZ} blocs, ${world.entities.size} entités`);
    console.log(`  chargement de la civilisation  ${ms(stats(loads).median)} (médiane de 3)`);
    console.log(`  lumière (calcul complet)        ${ms(stats(lights).median)}`);
    console.log(`  atlas de textures               ${ms(atlasMs)} (${session.blocks.all().length} blocs)`);
    console.log(`  maillage de ${chunkTimes.length} tronçons        ${ms(meshTotal)} au total — médiane ${ms(chunk.median)}, p95 ${ms(chunk.p95)}, max ${ms(chunk.max)} par tronçon`);
    console.log(`  géométrie                       ${meshes} maillages, ${Math.round(vertices).toLocaleString('fr-FR')} sommets`);
    console.log(`  pas de simulation (1/60 s)      médiane ${ms(step.median)}, p95 ${ms(step.p95)}, max ${ms(step.max)}`);
    console.log(`  sauvegarde                      ${ms(saveMs)}, ${(json.length / 1024).toFixed(0)} Kio\n`);
  }
  await session.unloadCivilization();
}
