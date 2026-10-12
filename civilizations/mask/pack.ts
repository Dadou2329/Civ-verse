import { definePack } from '@sdk';

/**
 * Mask Civilization — « Les Cent Visages ».
 *
 * Viremasque, cité verticale où chaque habitant porte le masque de son rang et les pouvoirs qui
 * vont avec. Le héros, un Cendre des Rives Basses, veut monter.
 *
 * assets/     blocs, modèles, sons et musiques de Viremasque
 * mechanics/  rangs civiques, masques et leurs pouvoirs, monte-charge, vie du quartier
 * ui/         plaque de rang, compte à rebours, carnet
 * seed/       génération de la première version des scènes et cinématiques
 * content/    scènes, dialogues, quêtes, cinématiques et règles (éditables dans le Studio)
 */
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
