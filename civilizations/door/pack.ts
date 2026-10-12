import { definePack } from '@sdk';

/**
 * Door Civilization — « La Porte qui n'existe pas ».
 *
 * mechanics/  règles du monde (registre des accès, serrures, empreinte, mémoire des portes, soupçon)
 * assets/     blocs, modèles, sons et musiques de Verrou
 * ui/         plaque de seuil (HUD), mini-jeu des trois cadrans, carte des permissions
 * view/       effets de rendu propres à Verrou (engrenages animés)
 * content/    scènes, dialogues, quêtes, cinématiques et règles (éditables dans le Studio)
 */
export default definePack({
  modules: import.meta.glob(['./mechanics/**/*.ts', './assets/**/*.ts', './ui/**/*.tsx', './view/**/*.ts', '!./**/*.test.ts'], { eager: true }),
});
