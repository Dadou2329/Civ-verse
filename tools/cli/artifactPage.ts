/**
 * Turns the artifact build (`dist-artifact/index.html`, see vite.config.ts) into the page of a
 * claude.ai Artifact: the Artifact service wraps the page in its own document, so the page holds
 * only its title, its stylesheet and script (relative paths, published next to it) and the root
 * element of the game.
 *
 *   npm run build:artifact  →  dist-artifact/civilizationverse.html + dist-artifact/assets/*
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../vite/aliases.ts';

const dir = path.join(repoRoot, 'dist-artifact');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const rel = (p: string) => p.replace(/^\.\//, '');
const script = /<script type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
const styles = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'CIVILIZATIONVERSE';
if (!script) throw new Error('Script du jeu introuvable dans dist-artifact/index.html (lancer la construction).');

const page = `<title>${title}</title>
${styles.map((s) => `<link rel="stylesheet" href="${rel(s)}">`).join('\n')}
<style>html, body { height: 100%; background: #07080b; }</style>
<div id="app"></div>
<noscript>CIVILIZATIONVERSE nécessite JavaScript et WebGL 2 pour fonctionner.</noscript>
<script type="module" src="${rel(script)}"></script>
`;
fs.writeFileSync(path.join(dir, 'civilizationverse.html'), page);

const assets = fs.readdirSync(path.join(dir, 'assets'));
const bytes = assets.reduce((n, f) => n + fs.statSync(path.join(dir, 'assets', f)).size, 0);
console.log(`dist-artifact/civilizationverse.html — ${assets.length} fichiers dans assets/ (${(bytes / 1048576).toFixed(1)} Mio)`);
