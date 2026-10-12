import { definePack } from '@sdk';

/**
 * Shared library pack: blocks, models, sounds and music available to every civilization
 * (declare "core" in a pack's manifest dependencies).
 */
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './models/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
