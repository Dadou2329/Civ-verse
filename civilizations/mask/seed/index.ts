/**
 * Seed entry point of the Mask civilization: `npm run civ -- seed mask [--force]`.
 * Returns the generated content files (relative to the pack root). Existing files are never
 * overwritten unless --force is given: once generated, the JSON is edited in the Studio.
 */
import { buildRives } from './rives.ts';
import { buildCinematics } from './cinematics.ts';
import { buildCinematicsCh1 } from './cinematicsCh1.ts';

export function seed(): Record<string, unknown> {
  const files: Record<string, unknown> = {
    'content/scenes/rives.scene.json': buildRives(),
  };
  for (const c of [...buildCinematics(), ...buildCinematicsCh1()]) files[`content/cinematics/${c.id}.cinematic.json`] = c;
  return files;
}
