# Design intérieur 3D — principes et critères

## Objectif visuel

Une pièce réussie montre au premier coup d'œil : (1) sa fonction, (2) le milieu social de l'occupant, (3) son caractère, (4) un point focal, (5) un chemin praticable. Le monde doit être un lieu de vie, pas un assemblage répétitif de props.

## Les huit leviers du design

1. **Proportions** : l'échelle des portes, lits, escaliers, chaises, fenêtres et plafonds doit correspondre au joueur. Si 1 unité = 1 mètre : lit ≈ 2 m de long, assise ≈ 0,45 m, table ≈ 0,75 m, porte ≈ 0,8–1 m de passage, plafond d'habitation ≈ 2,5–3,2 m. Ces repères sont indicatifs et doivent être adaptés aux personnages blocky et au moteur.
2. **Zoning** : séparer naturellement dormir, cuisiner, s'asseoir, travailler, ranger et circuler. Utiliser changements de matière, éclairage, tapis, meubles et cloisons plutôt que multiplier des murs inutiles.
3. **Composition** : un élément principal par vue importante (fenêtre remarquable, canapé, lit, foyer, atelier) ; éléments secondaires qui le soutiennent. Alterner grands volumes et détails. Éviter les répétitions parfaitement symétriques partout.
4. **Couleur/matière** : palette cohérente et intentionnelle. Répéter quelques matériaux dominants, introduire des accents distincts et moduler rugosité/relief. Garder des bordures/plinthes encadrant les surfaces.
5. **Éclairage** : lumière naturelle selon les fenêtres, éclairage d'usage près du bureau/cuisine/lit, ambiance secondaire. Vérifier jour et nuit lorsque pertinent. Éviter un plafonnier uniforme comme unique source.
6. **Densité** : de vrais petits objets mais placés en groupes fonctionnels : livres près d'un bureau, chaussures à l'entrée, vêtements rangés, vaisselle côté cuisine, affiches associées au personnage. Éviter les objets aléatoires et la saturation visuelle.
7. **Narration environnementale** : un appartement modeste présente des compromis et des réparations ; un loft de champion présente des trophées et équipements ; un penthouse témoigne d'une carrière et de choix personnels. Le décor évolue avec l'intrigue.
8. **Gameplay** : circulation, visibilité des éléments interactifs, ouverture des portes, niveau de collision correct, aucun meuble bloquant une quête ou un passage. Les objets décoratifs ne doivent pas voler la lisibilité des objectifs.

## L'esprit voxel sans mobilier grossier

- Modularité et géométrie stylisée, mais silhouettes de meubles identifiables : accoudoirs, pieds, coussins, montants, tiroirs, étagères, interrupteurs, rideaux, tapis, luminaires.
- Éviter les rectangles nus qui jouent le rôle de dix objets différents.
- Privilégier des motifs de texture/atlases dédiés et la variation contrôlée, sans dérives de couleurs arbitraires.
- Soigner surfaces de contact et épaisseur des meubles. Les étagères doivent contenir quelque chose ; les fenêtres doivent avoir un cadre ; les plans de travail doivent paraître fonctionnels.
- Tester les perspectives à hauteur d'œil : proximité des meubles, obstruction des fenêtres, hauteur du plafond.

## Une civilisation = une direction artistique distincte

Documente au minimum : univers visuel, vocabulaire architectural, palette, matériaux clés, techniques de lumière, style de mobilier, signes de richesse, motifs, rapport entre lieux publics et privés, layout-type, éléments interdits car trop similaires à une autre civilisation.

**Power Civilization :** métropole contemporaine-futuriste énergique ; architecture verticale ; surfaces construites, verre, métal, céramique, panneaux lumineux ; mobilier urbain et appartements réalistes dans une société de superpouvoirs. Progression socio-économique lisible.

**Mask Civilization :** arts et artisanat, ateliers, tissus, sculptures, quartiers hiérarchisés autour de signes de masque ; vocabulaire culturel particulier. Ne pas recopier les appartements urbains de Power Civilization.

Pour toute future civilisation, inventer un langage propre plutôt que réutiliser une carte et repeindre les matériaux.

## Contrôles anti-généricité

Comparer avec les derniers intérieurs conçus :

- même plan et mêmes dimensions ? Repenser le plan.
- mêmes meubles aux mêmes endroits ? Composer autrement.
- mêmes surfaces et éclairages ? Introduire une logique matérielle propre.
- mêmes objets décoratifs copiés partout ? Ajouter des props spécifiques à la profession/au contexte.
- impossible de deviner le type et le rang du lieu sans UI ? Reprendre sa narration visuelle.

## Priorités si le temps est limité

1. Dimensions correctes + circulation.
2. Bon zoning + silhouettes de mobilier crédibles.
3. Matériaux + lumière.
4. Point focal + personnalité du lieu.
5. Détails fins + variété.

Un résultat plus petit, bien fini et navigable est préférable à un grand intérieur vide.
