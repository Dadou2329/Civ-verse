# CIVILIZATIONVERSE — Spécification de mise à jour de Civilization Studio
## Bibliothèque de construction fine : microblocs, dalles, piliers et détails

**Statut : À transmettre à Claude Code lors de la prochaine session de développement. Ne pas exécuter avant la demande explicite de l'utilisateur.**

### 0. Règle non négociable : préserver les civilisations existantes

Améliorer **l'éditeur et les outils de construction**, PAS les cartes, bâtiments, scènes, textures, dialogues, quêtes ou sauvegardes de civilisations déjà réalisées. Consulter leurs environnements uniquement en lecture seule pour comprendre ce qui manque. Ne pas les « embellir » automatiquement. Une modification du moteur commun n'est permise que si elle est nécessaire à la nouvelle fonctionnalité et reste rétrocompatible ; vérifier par des tests que les civilisations existantes s'affichent et se jouent comme avant. Établir un point de restauration avant les changements et inspecter les fichiers modifiés avant de terminer.

### 1. Constat et objectif

Les objets de construction actuels semblent trop grossiers pour créer des bâtiments crédibles : cadres de portes et de fenêtres, corniches, balcons, cloisons, toits, façades, escaliers, meubles, finitions et détails architecturaux. Ajouter une **bibliothèque de primitives paramétriques** et un placement précis pour que Claude puisse produire dans les **futures** civilisations des édifices réellement élaborés, à l'intérieur comme à l'extérieur, sans écrire à la main les coordonnées de centaines de cubes.

L'évolution doit servir à la fois :
- à l'utilisateur, via un éditeur visuel fonctionnel ;
- à Claude Code, via un format de scène, des API et des outils automatisables/documentés.

### 2. Primitives de construction à implémenter

**Fondations** : bloc entier, demi-bloc, quart de bloc, microblocs, blocs rectangulaires paramétrables, panneaux minces.

**Dalles et surfaces** : slabs horizontaux en demi-hauteur et quart de hauteur ; slabs verticaux ; planches, couvertines, plinthes, panneaux de revêtement, carrelage et éléments de toiture.

**Supports et structure** : piliers de différentes sections, colonnes, poutres verticales et horizontales, poteaux, traverses, cadres, éléments d'angle et renforts.

**Circulation** : marches, escaliers, rampes, pentes, garde-corps, petits murets, bordures, plateformes et balcons.

**Architecture** : arches et ouvertures, encadrements de portes et fenêtres, appuis de fenêtre, corniches, moulures, rebords, cheminées, éléments de toiture inclinée, wedges/prismes et coins, au moins sous forme de pièces modulaires.

**Décoration utile** : étagères, plans de travail, pieds de meubles, poignées, rebords, petites enseignes et garnitures par assemblage de pièces existantes ou de nouveaux prefabs.

Prioriser un ensemble **petit mais complet et réellement fonctionnel**, puis enrichir progressivement le catalogue. Ne pas fabriquer un onglet rempli de boutons décoratifs inactifs.

### 3. Précision et ergonomie de l'éditeur

- Grille à pas réglable : **1, 1/2, 1/4, 1/8** d'unité de bloc. Précision supplémentaire (ex. 1/16) si utile et suffisamment performante.
- Placement par face/surface, prévisualisation fantôme et indication des collisions avant validation.
- Rotation configurable, par exemple incréments de 90°, 45° et valeurs libres pour les pièces appropriées.
- Redimensionnement indépendant des axes, avec pivot/origine cohérents et limites minimales pour les formes paramétriques.
- Alignement des dalles haut/bas, des slabs verticaux et des piliers par rapport aux faces voisines.
- Sélection multiple, duplication, miroir, copie/collage, groupement, prefabs imbriqués si l'architecture le permet.
- Déplacement précis, alignement sur surface et outils d'alignement/distribution.
- Annuler/refaire fiables ; propriétés modifiables après placement ; sérialisation et rechargement sans perte de précision.
- Bibliothèque organisée par forme et fonction, recherche par nom, favoris et aperçu visuel de chaque pièce.
- Orientation claire des matériaux/textures ; possibilité d'assigner plusieurs matériaux ou faces quand pertinent.

### 4. Réalisme stylisé et sens architectural

Les outils doivent permettre des silhouettes variées, pas seulement des façades assemblées de cubes identiques. Documenter une méthode d'emploi pour l'architecture des futures civs : gros volumes → structure secondaire → ouvertures et circulation → matériaux → détails → meubles et éclairage → validation en FPS. Les détails doivent être **cohérents avec les matériaux et usages du bâtiment**, sans bruit visuel arbitraire.

Le skill `civilization-environment-master` doit guider le choix des formes, la planification, la décoration, les matériaux, le terraforming et la diversité des quartiers ; cette mise à jour, elle, doit fournir les **vraies fonctions de l'éditeur** indispensables pour construire ces formes.

### 5. Technique, données et compatibilité

- Conserver les anciennes primitives et leurs identifiants/formats.
- Définir des primitives paramétriques avec type, dimensions, rotation, matériau, collision, ancrage, pivot et version de format.
- Ajouter des registres extensibles pour de nouvelles formes et catégories de prefabs.
- Les scènes anciennes doivent se charger **sans conversion destructive** ni déplacement des blocs historiques.
- Utiliser des meshes paramétriques, instances, regroupements/chunks ou batchs lorsque c'est approprié ; **ne pas** transformer systématiquement chaque microbloc en une multitude de petits voxels indépendants.
- Collisions simplifiées mais exactes sur les éléments structuraux ; petits décors non bloquants lorsque pertinent ; ne pas créer de trous ou d'obstacles invisibles.
- Vérifier normales, UV, texture tiling, éclairage, profondeur (z-fighting), faces manquantes, instancing et élimination des ressources lors de la suppression.
- Prévoir des API / exports pour que Claude Code puisse générer des bâtiments ou prefabs à partir de définitions structurées, puis les ouvrir et modifier dans l'éditeur visuel.
- Éviter toute modification globale d'asset partagé qui changerait l'apparence des civs existantes : préférer de nouvelles ressources et des overrides spécifiques aux futures civs.

### 6. Démonstration exigée

Créer une **scène de démonstration distincte des civilisations existantes**, dans un nouveau dossier de test/atelier, contenant au minimum :
1. une façade détaillée (porte avec encadrement, fenêtres et appuis, corniche, toiture, colonnes ou piliers) ;
2. une petite pièce meublée (dalles, plinthes, cloisons, mobilier avec micro-détails) ;
3. un escalier avec garde-corps, un balcon et une rampe ou un toit incliné ;
4. des variations de matériaux pour montrer que l'outil ne sert pas qu'à recolorer les mêmes blocs.

### 7. Critères de validation non négociables

1. On peut sélectionner, placer, déplacer, tourner, supprimer, dupliquer chaque primitive depuis l'éditeur.
2. Les pas 1/2, 1/4, 1/8 fonctionnent réellement et les pièces s'alignent correctement.
3. Sauvegarde → redémarrage → rechargement : dimensions, rotations, matériaux et groupes sont conservés.
4. Annuler/refaire fonctionne pour placements, suppressions et transformations.
5. Passage en playtest FPS : les escaliers, portes, sols et garde-corps ont des collisions correctes, et les petits décors ne provoquent pas de blocage absurde.
6. La nouvelle scène de démo affiche une façade et une pièce réellement plus détaillées, vérifiées visuellement depuis plusieurs points de vue.
7. Une scène ancienne de Door/Memory/Mask (si présentes) se charge sans changement visible et reste jouable ; ne pas sauvegarder de modifications dans leurs dossiers.
8. Tests de performance sur un bâtiment contenant de nombreux petits éléments ; pas de nombre disproportionné de draw calls/objets physiques ni de chute majeure de fluidité non analysée.
9. Le catalogue est utilisable par un futur script/code générant une nouvelle civilisation, avec une documentation simple et un exemple reproductible.

### 8. Priorité de mise en œuvre

Phase A : inspecter l'éditeur existant et sauvegarder. Phase B : bibliothèque minimum (bloc paramétrable, demi/quart/microbloc, slab horizontal/vertical, poutre, pilier, marche). Phase C : placement/snap/rotation/prefabs/sauvegarde. Phase D : cadres, toits, rampes, corniches et détails. Phase E : scène de démonstration et tests de régression. Phase F : documentation et signalement précis de ce qui reste à faire.

**Résultat attendu : un véritable éditeur de construction fine au service des FUTURES civilisations, et aucune rénovation des civilisations passées.**
