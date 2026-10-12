import { definePack } from '@sdk';

export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts'], { eager: true }),
});
