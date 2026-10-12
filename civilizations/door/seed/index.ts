/**
 * Seed entry point of the Door civilization: `npm run civ -- seed door [--force]`.
 * Returns the generated content files (relative to the pack root). Existing files are never
 * overwritten unless --force is given: once generated, the JSON is edited in the Studio.
 */
import { buildVerrou } from './verrou.ts';
import { buildAbsente } from './absente.ts';
import { buildCinematics } from './cinematics.ts';

export function seed(): Record<string, unknown> {
  const files: Record<string, unknown> = {
    'content/scenes/verrou.scene.json': buildVerrou(),
    'content/scenes/porte_absente.scene.json': buildAbsente(),
  };
  for (const c of buildCinematics()) files[`content/cinematics/${c.id}.cinematic.json`] = c;
  return files;
}
