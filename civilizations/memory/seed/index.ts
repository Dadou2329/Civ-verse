/**
 * Seed entry point of the Memory civilization: `npm run civ -- seed memory [--force]`.
 * Returns the generated content files (relative to the pack root). Existing files are never
 * overwritten unless --force is given: once generated, the JSON is edited in the Studio.
 */
import { buildReminence } from './reminence.ts';
import { buildBlanche } from './blanche.ts';
import { buildCinematics } from './cinematics.ts';

export function seed(): Record<string, unknown> {
  const files: Record<string, unknown> = {
    'content/scenes/reminence.scene.json': buildReminence(),
    'content/scenes/chambre_blanche.scene.json': buildBlanche(),
  };
  for (const c of buildCinematics()) files[`content/cinematics/${c.id}.cinematic.json`] = c;
  return files;
}
