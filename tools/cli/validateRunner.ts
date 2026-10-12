/**
 * Validation entry executed inside Vite's module runner (see civ.ts). Boots every civilization
 * headless, validates its content and the French string keys used in its code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GlobContentProvider } from '../../src/engine/platform/globContent.ts';
import { GameSession } from '../../src/engine/core/sim/session.ts';
import { HeadlessUi } from '../../src/engine/core/sim/uiBridge.ts';
import { validateCivilization, extractCodeKeys, type ValidationIssue } from '../../src/engine/core/packs/validate.ts';
import { repoRoot } from '../vite/aliases.ts';

export interface ValidationSummary {
  errors: number;
  warnings: number;
}

function codeKeysOf(packId: string): { key: string; file: string }[] {
  const dir = path.join(repoRoot, 'civilizations', packId);
  const out: { key: string; file: string }[] = [];
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'seed' || ent.name === 'tests' || ent.name === 'content') continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
        const rel = path.relative(repoRoot, p);
        for (const key of extractCodeKeys(fs.readFileSync(p, 'utf8'))) out.push({ key, file: rel });
      }
    }
  };
  walk(dir);
  return out;
}

export async function runValidation(only: string[] = []): Promise<ValidationSummary> {
  const session = await GameSession.create({ mode: 'headless', provider: new GlobContentProvider(), ui: new HeadlessUi() });
  let errors = 0;
  let warnings = 0;
  for (const [id, issues] of session.manifestIssues) {
    for (const m of issues) {
      console.log(`✗ ${id}/manifest.json : ${m}`);
      errors++;
    }
  }
  const civs = [...session.manifests.values()].filter((m) => m.kind === 'civilization' && (only.length === 0 || only.includes(m.id)));
  for (const m of civs) {
    const t0 = performance.now();
    const report = await validateCivilization(session, m.id, { codeKeys: codeKeysOf(m.id) });
    const e = report.issues.filter((i) => i.severity === 'error');
    const w = report.issues.filter((i) => i.severity === 'warning');
    errors += e.length;
    warnings += w.length;
    const s = report.stats;
    console.log(
      `\n${e.length ? '✗' : '✓'} ${m.id} — ${s.scenes} scène(s), ${s.entities} entités, ${s.dialogues} dialogues, ${s.quests} quêtes, ${s.cinematics} cinématiques, ${s.rules} règles, ${s.keysChecked} textes vérifiés (${Math.round(performance.now() - t0)} ms)`,
    );
    for (const i of [...e, ...w]) console.log(format(i));
  }
  // The game interface's own keys (src/game, src/engine) are checked by
  // tests/acceptance/localization.test.ts.
  console.log(`\n${errors} erreur(s), ${warnings} avertissement(s).`);
  return { errors, warnings };
}

function format(i: ValidationIssue): string {
  return `  ${i.severity === 'error' ? 'erreur' : 'attention'} ${i.file}${i.path ? ` › ${i.path}` : ''} : ${i.message}`;
}
