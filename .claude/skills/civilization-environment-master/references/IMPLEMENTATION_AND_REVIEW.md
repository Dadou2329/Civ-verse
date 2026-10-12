# Implémentation technique & contrôle dans Civilizationverse

## Respect du dépôt existant

1. Identifier le moteur graphique, conventions d'unités, world editor, schema de sauvegarde, topologie de scènes, systèmes de collision/navigation, outils de génération et scripts d'export.
2. Écrire un plan minimal de modifications. Ajouter des composants et utilitaires compatibles ; pas de réécriture générale pour obtenir une nouvelle forme de relief.
3. Préserver les identifiants stables, quêtes existantes, chargement et sauvegardes. Utiliser des assets avec identifiants propres à chaque civilisation.
4. Pour un scénario en cours, coordonner le placement avec les étapes de quêtes, ennemis, capacités, classes sociales et scènes cinématiques.

## Pipeline de construction recommandé

**Brief → esquisse → blockout → jeu → art pass → jeu → optimisation.**

- Esquisse: carte top-down avec 5–12 repères et liens fonctionnels, profil terrain si utile, 2 images mentales de perspectives.
- Blockout : uniquement relief, sols, volumes urbains simplifiés, voies, spawn, entrées, silhouettes des monuments ; tracer et jouer la route en FPS.
- Art pass : géométries typiques, modèles propres, textures, props, variation contrôlée, PBR stylisé selon le rendu du jeu.
- Life pass : PNJ, transports, sons d'ambiance, interactions, éclairage, signalétique en français.
- Optimisation : instancing, culling, chunking/meshing, gestion du cycle de vie, distances de rendu, nombre de lumières, collisions utiles et ressources évacuées.

Le rendu voxel/minecraft-like ne requiert pas que chaque cube soit un mesh indépendant. Les formes de terrain et constructions peuvent utiliser des meshs optimisés. Utiliser les primitives/terrain tools du projet plutôt que réinventer un nouveau moteur.

## Grille de parcours FPS

Tester **au minimum** :

- Premier regard au spawn : la première vue raconte-t-elle une histoire ? Un bâtiment imposant est-il clairement identifié ?
- Première minute : la route vers le premier objectif est-elle lisible sans une flèche gigantesque permanente ?
- 5 minutes : paysage ou silhouette changé, activité reconnaissable, alternatives de déplacement.
- Déplacement retour : raccourci déverrouillé ou intérêt renouvelé.
- Combat ou poursuite : espace assez large et clair pour la vitesse/le pouvoir ; surfaces de couverture et zones de sécurité si nécessaire.
- Vue de dessus : districts connectés logiquement ; pas de bâtiments impossibles à atteindre.
- Circulation NPC : pas de gouffre, porte hors échelle, ou obstacle non géré.
- Monde en pause/nuit : silhouettes, lumières, landmarks et interfaces demeurent lisibles.

## Capture et inspection

Créer un petit rapport par map :

| Vue | Objectif de la capture |
|---|---|
| Top-down / minimap | Vérifier la morphologie globale |
| Depuis le logement | Vérifier la vie quotidienne et l'ancrage du héros |
| Axe de circulation | Vérifier la lisibilité et l'animation urbaine |
| Point de vue secondaire | Vérifier un autre quartier, non-cloné |
| Vue panoramique | Vérifier skyline et signature du monde |
| Scène importante | Vérifier mise en scène, circulation et boss si pertinent |

Pour l'audit comparatif, placer côte à côte les 2–3 premières vues des autres civilisations. Si impossible, ne pas affirmer que le monde est visuellement unique sur la seule base du code.

## Validation pratique

- Compilation/typecheck et lancement réel du jeu.
- Vérification des collisions au sol, marches, rampes, ponts, structures de franchissement, accès aux bâtiments.
- Test des chemins de quêtes et des interactions dans les nouvelles zones.
- Contrôle du streaming/culling et FPS sur un trajet représentatif ; consigner des mesures réelles uniquement.
- Audit des textures répétées et effet carrelage/stretching (variation régionale motivée par le monde).
- Cohérence entre façades et intérieurs ; appliquer les guides intérieurs de ce skill fusionné (`INTERIOR_DESIGN_FOUNDATIONS.md` et `INTERIOR_REVIEW_AND_TESTS.md`).
- Mise à jour d'un document de suivi des éléments implémentés, du non vérifié et des problèmes visibles.

## Contrat de livraison

Ne pas rendre un bel écran de menu ou une carte statique comme preuve de réussite. Fournir **une scène jouable au terrain réalisé**, au minimum le trajet principal, des points de vue contrôlés et une preuve d'intégration. Pour un changement massif, construire un quartier pilote de la nouvelle morphologie avant de généraliser.
