import { definePack } from '@sdk';

/**
 * Memory Civilization — « Le Nom qu'on t'a volé ».
 *
 * mechanics/  règles du monde (chambre mnésique, échos, réminiscences, reconnaissance,
 *             consentement, échange, énigme des trois objets, portes closes)
 * assets/     blocs, modèles, sons et musiques de Réminence
 * ui/         chambre mnésique (HUD et panneau), surimpression des échos, choix d'objet
 * view/       rendu des échos (silhouettes translucides, objets remémorés)
 * content/    scènes, dialogues, quêtes, cinématiques et règles (éditables dans le Studio)
 */
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
