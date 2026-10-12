# Vérifications obligatoires — intérieurs 3D Civilizationverse

## Avant de construire

- [ ] Identifier les contraintes réelles : format des scènes, prefabs, moteur de collision, conventions d'échelle, éclairage.
- [ ] Décrire l'occupant, le rang, la civilisation, les pièces et interactions attendues.
- [ ] Établir un plan au sol et une palette principale.
- [ ] Définir un point focal et les trajets du joueur.

## Contrôles d'agencement

- [ ] La porte d'entrée s'ouvre et la circulation est possible.
- [ ] Les sorties, interactions et ouvertures importantes ne sont pas masquées.
- [ ] Les meubles sont à l'échelle du personnage, pas du seul viewport.
- [ ] Le passage principal reste suffisamment dégagé, approximativement 0,8 à 1 m si l'échelle du projet correspond aux mètres, avec adaptations à la capsule du joueur.
- [ ] La chambre/coin nuit, la cuisine et les autres fonctions sont reconnaissables.
- [ ] Les détails se groupent autour d'usages concrets (et non uniformément au hasard).
- [ ] Les fenêtres, sources lumineuses et ombres créent une ambiance intentionnelle.
- [ ] Les matériaux n'ont pas de texture étirée, z-fighting ou répétitions disgracieuses.
- [ ] Les collisions sont cohérentes, aucun mobilier flottant ou traversant un mur.
- [ ] La pièce ne paraît ni vide, ni surchargée.

## Captures minimales

Si le projet peut faire des captures, rendre accessibles ces angles :

1. `01_entree` — ce que le joueur voit en entrant.
2. `02_point_focal` — pièce et composition principales.
3. `03_depuis_la_fenetre` — vers l'intérieur, contrechamp.
4. `04_zone_secondaire` — coin fonctionnel, cuisine, chambre, atelier, etc.
5. `05_vue_plan` — scène depuis le haut dans l'éditeur.

Si une scène n'a pas de fenêtre, choisir un contrechamp pertinent. Inspecter effectivement les images produites avant de déclarer la pièce validée.

## Test en jeu

1. Charger réellement la carte via le parcours normal.
2. Se déplacer à hauteur des yeux, traverser les couloirs, prendre les virages.
3. Entrer dans chaque pièce et en ressortir.
4. Essayer les interactions prévues.
5. Inspecter l'ambiance à l'éclairage normal et dans des conditions différentes si le cycle existe.
6. Vérifier que les modifications persistent après fermeture/rechargement éditeur et runtime.
7. Vérifier que les performances ne se dégradent pas de façon disproportionnée.
8. Noter honnêtement les étapes non réalisées et raisons concrètes.

## Test anti-reskin

Pour chaque nouveau logement ou civilisation, comparer le précédent sur : plan et volumes, types de meubles, matériaux, lumière, densité, architecture, palette, histoire personnelle, fonctionnalités. Si au moins la plupart de ces caractéristiques restent identiques, la conception n'est pas suffisamment originale.

## Feuille de suivi de livraison (à adapter)

```text
Civilisation / lieu :
Objectif narratif :
Niveau social :
Fonctions / interactions :
Plan approuvé / dimensions réelles :
Nouveaux assets :
Réutilisations justifiées :
Validation compilation : oui/non
Validation en première personne : oui/non
Captures réellement examinées : [chemins réels] ou « indisponibles »
Problèmes visuels trouvés / corrections :
Problèmes connus :
Impacts sur les scènes existantes :
```
