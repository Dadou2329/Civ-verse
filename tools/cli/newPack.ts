/**
 * Scaffolds a new civilization pack (npm run civ -- new-pack <id>): manifest, code entry,
 * French string table and a small starting scene. Refuses to touch an existing directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../vite/aliases.ts';
import { VoxelVolume } from '../../src/engine/core/voxel/volume.ts';
import { fillBox } from '../../src/engine/core/voxel/construct.ts';
import { volumeToDoc } from '../../src/engine/core/world/sceneVoxels.ts';
import { ENGINE_API_VERSION } from '../../src/engine/core/version.ts';

export function scaffoldPack(id: string, displayName: string): string[] {
  const dir = path.join(repoRoot, 'civilizations', id);
  if (fs.existsSync(dir)) throw new Error(`Le dossier civilizations/${id} existe déjà : rien n'a été modifié.`);
  const major = ENGINE_API_VERSION.split('.')[0];
  const files: Record<string, string> = {};
  files['manifest.json'] = json({
    format: 'civverse.pack',
    version: 1,
    id,
    kind: 'civilization',
    name: `${id}.name`,
    description: `${id}.description`,
    tagline: `${id}.tagline`,
    packVersion: '0.1.0',
    engineApi: `^${major}.0.0`,
    dependencies: ['core'],
    entry: { scene: 'depart', spawn: 'depart_joueur' },
    scenes: ['depart'],
    stateVersion: 1,
    globalWrites: [],
    fragments: [],
    theme: { accent: '#7fb7d9' },
    cover: { colors: ['#1c2633', '#3f5d78'], motif: 'default' },
    order: 100,
    credits: [],
    tags: [],
  });
  files['pack.ts'] = `import { definePack } from '@sdk';

/**
 * Code de la civilisation « ${displayName} ». Chaque module de mechanics/, assets/ et ui/ est
 * découvert automatiquement : ajouter un fichier suffit pour enregistrer ses définitions.
 */
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', '!./**/*.test.ts'], { eager: true }),
});
`;
  files['locales/fr-FR.json'] = json({
    [`${id}.name`]: displayName,
    [`${id}.description`]: 'Décrivez ici la promesse de cette civilisation.',
    [`${id}.tagline`]: 'Une nouvelle civilisation.',
    [`${id}.scene.depart`]: 'Point de départ',
  });
  const v = new VoxelVolume(32, 24, 32);
  fillBox(v, [0, 0, 0], [31, 6, 31], 'core:stone');
  fillBox(v, [0, 7, 0], [31, 7, 31], 'core:grass');
  files['content/scenes/depart.scene.json'] = json({
    format: 'civverse.scene',
    version: 1,
    id: 'depart',
    name: `${id}.scene.depart`,
    environment: {
      sky: { top: '#3d6ea8', horizon: '#bcd6ee', bottom: '#5b6a78', stars: 0, sunDisc: true },
      sun: { direction: [-0.4, -0.8, 0.45], color: '#fff1dc', intensity: 1.1 },
      ambient: { color: '#9fb2c8', intensity: 0.6 },
      hemi: { sky: '#b8cce0', ground: '#6b5a48', intensity: 0.55 },
      fog: { color: '#bcd6ee', density: 0.006 },
      blockLight: 1,
      particles: null,
      music: null,
      ambience: null,
      post: { exposure: 1, contrast: 1.05, saturation: 1, bloom: 0.3, vignette: 0.3 },
    },
    voxels: volumeToDoc(v),
    entities: [{ id: 'depart_joueur', position: [16.5, 8, 16.5], components: { 'core.spawn': { isDefault: true } } }],
  });
  files['mechanics/.gitkeep'] = '';
  const created: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    created.push(path.relative(repoRoot, abs));
  }
  return created;
}

function json(v: unknown): string {
  return JSON.stringify(v, null, 2) + '\n';
}
