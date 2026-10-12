/**
 * CIVILIZATIONVERSE command line — `npm run civ -- <commande>`.
 *
 *   validate [pack…]           démarre chaque civilisation sans rendu et vérifie le contenu,
 *                              les références et les textes français (aussi : npm run validate)
 *   seed <pack> [--force]      génère le contenu initial depuis civilizations/<pack>/seed/index.ts
 *                              (n'écrase jamais un fichier existant sans --force)
 *   new-pack <id> [--name "…"] crée le squelette d'une nouvelle civilisation
 *   bench [pack…]              mesure les coûts CPU : chargement, lumière, maillage, simulation
 *                              (aussi : npm run bench)
 *
 * Validation loads packs through Vite's module runner so that `import.meta.glob` in pack.ts and
 * JSON/TSX modules behave exactly as in the game.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from '../vite/aliases.ts';
import type * as ValidateRunner from './validateRunner.ts';
import type * as BenchRunner from './benchRunner.ts';

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function positional(): string[] {
  const out: string[] = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i]!.startsWith('--')) {
      if (args[i] === '--name') i++;
      continue;
    }
    out.push(args[i]!);
  }
  return out;
}

async function main(): Promise<number> {
  switch (command) {
    case 'validate':
      return validate(positional());
    case 'seed':
      return seed(positional()[0], flag('force'));
    case 'new-pack':
      return newPack(positional()[0], option('name'));
    case 'bench':
      return bench(positional());
    default:
      console.log(`Commandes : validate [pack…] | seed <pack> [--force] | new-pack <id> [--name "Nom"] | bench [pack…]`);
      return command ? 1 : 0;
  }
}

// -------------------------------------------------------------------------------------------------
// validate
// -------------------------------------------------------------------------------------------------

/** Runs a module inside Vite's module runner, so that packs load exactly as in the game. */
async function withViteRunner<M, R>(modulePath: string, fn: (mod: M) => Promise<R>): Promise<R> {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(repoRoot, 'vite.config.ts'),
    root: repoRoot,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    return await fn((await server.ssrLoadModule(modulePath)) as M);
  } finally {
    await server.close();
  }
}

async function validate(packs: string[]): Promise<number> {
  return withViteRunner<typeof ValidateRunner, number>('/tools/cli/validateRunner.ts', async (runner) => {
    const result = await runner.runValidation(packs);
    return result.errors > 0 ? 1 : 0;
  });
}

async function bench(packs: string[]): Promise<number> {
  return withViteRunner<typeof BenchRunner, number>('/tools/cli/benchRunner.ts', async (runner) => {
    await runner.runBench(packs);
    return 0;
  });
}

// -------------------------------------------------------------------------------------------------
// seed
// -------------------------------------------------------------------------------------------------

async function seed(pack: string | undefined, force: boolean): Promise<number> {
  if (!pack) {
    console.error('Usage : npm run civ -- seed <pack> [--force]');
    return 1;
  }
  const entry = path.join(repoRoot, 'civilizations', pack, 'seed', 'index.ts');
  if (!fs.existsSync(entry)) {
    console.error(`Aucun script de génération : ${path.relative(repoRoot, entry)}`);
    return 1;
  }
  const { classifyContentPath } = await import('../../src/engine/core/packs/pack.ts');
  const schemas = await import('../../src/engine/core/content/schemas.ts');
  const mod = (await import(pathToFileURL(entry).href)) as { seed: () => Record<string, unknown> };
  const t0 = performance.now();
  const files = mod.seed();
  console.log(`Génération de « ${pack} » : ${Object.keys(files).length} fichiers en ${Math.round(performance.now() - t0)} ms`);
  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (const [rel, doc] of Object.entries(files)) {
    const kind = classifyContentPath(rel)?.kind;
    const schema =
      kind === 'scene'
        ? schemas.SceneSchema
        : kind === 'cinematic'
          ? schemas.CinematicSchema
          : kind === 'dialogue'
            ? schemas.DialogueSchema
            : kind === 'quest'
              ? schemas.QuestSchema
              : kind === 'logic'
                ? schemas.LogicSchema
                : kind === 'prefab'
                  ? schemas.PrefabSchema
                  : null;
    if (schema) {
      const r = schema.safeParse(doc);
      if (!r.success) {
        failed++;
        console.error(`✗ ${rel}\n  ${schemas.formatIssues(r.error).join('\n  ')}`);
        continue;
      }
    }
    const abs = path.join(repoRoot, 'civilizations', pack, rel);
    if (fs.existsSync(abs) && !force) {
      skipped++;
      console.log(`· ${rel} existe déjà (conservé ; --force pour régénérer)`);
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const json = JSON.stringify(doc, null, 2) + '\n';
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === json) {
      skipped++;
      console.log(`· ${rel} inchangé`);
      continue;
    }
    // --force replaces a file that may hold edits made in the Studio: keep the previous version.
    if (fs.existsSync(abs)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = path.join(repoRoot, '.civ-backups', 'civilizations', pack, `${rel}.${stamp}.seed.bak`);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(abs, backup);
      console.log(`  ancienne version conservée : ${path.relative(repoRoot, backup)}`);
    }
    fs.writeFileSync(abs, json, 'utf8');
    written++;
    console.log(`✓ ${rel} (${(json.length / 1024).toFixed(1)} Ko)`);
  }
  console.log(`${written} écrit(s), ${skipped} conservé(s), ${failed} invalide(s).`);
  return failed > 0 ? 1 : 0;
}

// -------------------------------------------------------------------------------------------------
// new-pack
// -------------------------------------------------------------------------------------------------

async function newPack(id: string | undefined, name: string | undefined): Promise<number> {
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    console.error('Usage : npm run civ -- new-pack <id> [--name "Nom affiché"] (id : minuscules, chiffres, tirets)');
    return 1;
  }
  const { scaffoldPack } = await import('./newPack.ts');
  const created = scaffoldPack(id, name ?? id);
  for (const f of created) console.log(`✓ ${f}`);
  console.log(`Civilisation « ${id} » créée. Lancez « npm run dev » : elle apparaît dans la sélection des civilisations.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exit(1);
  },
);
