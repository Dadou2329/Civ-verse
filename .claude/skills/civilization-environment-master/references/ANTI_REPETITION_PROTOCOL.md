# Audit inter-civilisations : détecter et prévenir les reskins spatiaux

## Le défaut historique à éliminer

> Un quartier pauvre sur une place basse, une longue muraille à l'arrière-plan et un rang plus riche construit au-dessus. Des maisons d'une même largeur alignées en rangées.

Cette recette est interdite **comme choix automatique**. Elle peut exister si un scénario l'exige explicitement, mais ne doit pas devenir le modèle du jeu. Le problème ne se résout pas en ajoutant d'autres textures.

## Empreinte spatiale : 8 attributs

Pour chaque civilisation, consigne ces champs dans un document d'audit (les descriptions sont libres ; les clés servent à comparer) :

- `macroform` : forme globale du monde (delta, cuvette urbaine, archipel, gorge, plaine, grille de stations...).
- `city_pattern` : arrangement du tissu urbain (grille brisée, anneaux, voies de canaux, réseau radial, grappes...).
- `district_relations` : comment les zones interagissent (périphérie/centre, îles reliées, étoiles de hubs, bande linéaire...).
- `elevation_logic` : règle du relief (plat intentionnel, dunes ondulées, puits et passerelles, pentes naturelles...).
- `landmark_type` : point focal principal (centrale, arbre-village, stade, ponts, phare...).
- `movement_signature` : déplacement caractéristique (train aérien, barques, marche/toits, tunnels, plateformes...).
- `water_role` : eau absente, obstacle, commerce, navigation, crues, canal énergétique, etc.
- `first_impression` : vue d'ouverture et expérience de la première minute (quai de canal, boulevard circulaire, place marchande, tunnel...).

**Interprétation** : si une nouvelle carte partage au moins trois attributs structurels forts avec une carte existante, il faut revoir sa conception. Deux mots différents peuvent masquer la même structure : le script ne peut pas régler ce jugement.

## Audit en 4 étapes

1. **Comparer le plan top-down**, sans textures. Les cartes ressemblent-elles à la même figure géométrique ?
2. **Comparer les silhouettes FPS** depuis le spawn, le marché et le principal monument.
3. **Comparer l'expérience de circulation** : mêmes premières minutes, même barrière artificielle, mêmes escaliers, même montée vers une tour ?
4. **Comparer l'activité** : mêmes maisons, mêmes marchés alignés et mêmes PNJ au même endroit ?

La diversité doit porter sur l'urbanisme, pas seulement la direction artistique.

## Seuils de qualité recommandés

- Au moins **4 différences majeures** dans l'empreinte spatiale par rapport à la civilisation la plus proche. C'est un heuristique de revue, pas une vérité mathématique.
- Chaque civilisation a **au moins 2 landmarks propres**, observables en jeu et non simples variations d'une même tour.
- **2 vues iconiques** depuis des lieux réellement accessibles, avec compositions visuelles distinctes.
- **1 mode de circulation mis en valeur** qui a un impact sur le gameplay local, s'il correspond au thème.
- **Des matériaux et formes distinctes** dans les zones emblématiques ; autoriser le réemploi discret d'éléments neutres quand il est rationnel.
- **Aucune validation sur seule compilation ou génération de plan** : tester et regarder le résultat dans la vraie scène.

## Anti-patterns et corrections

| Anti-pattern | Correction structurelle |
|---|---|
| Tout est séparé par un mur de soutènement | Réorganiser les quartiers autour d'axes de transports, bras de rivière, places et limites de fonction |
| Rangs = étages de richesse | Rangs = accès à des services, guildes, pouvoirs, zones à badges, quartiers spécialisés |
| Toutes les routes sont des rues droites à angle droit | Choisir une morphologie de circulation explicable par l'histoire et le paysage |
| 30 maisons avec le même gabarit | Varier parcelles, orientations, maisons mitoyennes, cours, bâtiments collectifs, grandes halles |
| Une skyline composée du même château | Concevoir un landmark spécifique au thème et une hiérarchie d'éléments secondaires |
| Surfaces plates immenses et vides | Ajouter structures d'usage (places, parcs, postes de travail, ateliers, réseaux de transport) plutôt que bruit décoratif |
| Copier une map puis changer la palette | Refaire d'abord la topologie des lieux, les axes de vue et le parcours, puis le look |

## Empêcher les régressions

Lors d'une nouvelle Civilization : enregistrer le plan et l'empreinte dans le dossier de la nouvelle civilisation. Charger les empreintes existantes pour la comparaison. Ne réécrire aucune vieille map à moins que l'utilisateur ne le demande expressément. Le script `scripts/validate_world_plan.py` peut aider à repérer des signatures quasi identiques, mais l'audit visuel/structurel reste obligatoire.
