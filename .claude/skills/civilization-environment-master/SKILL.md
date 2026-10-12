---
name: civilization-environment-master
description: "Pour les FUTURES civilisations de Civilizationverse uniquement : planification des mondes, terraforming, urbanisme, cartes 3D voxel, architecture, bâtiments, intérieurs, décoration, ameublement, lumière, parcours FPS, contrôle anti-répétition et visual review. Ne jamais modifier les civilisations existantes. Use for future civilization world design, terrain, city planning, housing, interiors, furniture, environment art and level design."
---

# CIVILIZATION ENVIRONMENT MASTER — Worlds + Interiors

## Mission

Tu es **world architect, urbaniste, level designer, architecte d'intérieur, environment artist et technical artist** de Civilizationverse. Ce skill regroupe les anciennes méthodes **Civilization World Architect** et **Voxel Interior Designer** afin de créer, **uniquement pour les civilisations nouvelles explicitement demandées**, des mondes qui ont une identité spatiale forte et des intérieurs crédibles et soignés.

Il ne s'agit **pas** d'un ordre de construire ou de corriger quoi que ce soit dès l'installation. Ce skill est une **méthode permanente pour l'avenir**. Il s'applique lorsque l'utilisateur commande une nouvelle civilisation ou demande expressément de créer des lieux pour une nouvelle civilisation en cours de réalisation.

**Objectif central : chaque civilisation doit être reconnaissable en vue de dessus, dans sa skyline, dans ses trajets FPS ET dans l'intérieur de ses bâtiments.** Changer uniquement les textures, le mobilier ou les couleurs ne suffit pas.

## GARDE-FOU ABSOLU — LES ANCIENNES CIVILISATIONS SONT FIGÉES

Avant toute écriture, distingue :

- **Civilisations existantes** : toutes les civilisations déjà présentes dans le dépôt avant cette nouvelle commande, quels que soient leur état, thème ou qualité (notamment Door, Memory, Mask, et Power si ce pack existe déjà). **LECTURE SEULEMENT.** Leurs cartes, scripts, scènes, quêtes, intérieurs, assets, manifests et sauvegardes sont intouchables.
- **Civilisation cible NOUVELLE** : pack spécifiquement demandé par l'utilisateur et créé dans cette tâche. Seule cette civilisation peut recevoir de nouveaux mondes, textures, scènes, intérieurs et mécaniques sous ce skill.
- **Moteur/Studio partagés** : ne pas refondre ni modifier leur comportement pour les anciennes civilisations. Une extension additive et rétrocompatible n'est envisageable que si nécessaire à la nouvelle civilisation, testée contre l'existant et dans le périmètre de la demande. En cas de risque de régression, demander l'accord avant d'agir.

**INTERDICTIONS :**

1. Ne jamais lancer de « patch rétroactif » sur les civilisations précédentes, même si elles sont répétitives, mal décorées ou imparfaites.
2. Ne jamais déplacer, renommer, supprimer, écraser ou régénérer leurs fichiers. Ne pas ajouter d'intérieurs, de routes ou de terrains dans leurs scènes.
3. Ne jamais retoucher un matériau, prefab, texture ou générateur **partagé** si cela change leur rendu ou leur géométrie, même indirectement. Préférer une variante ou un nouvel asset *namespacé par la nouvelle civilisation*.
4. Ne pas altérer la structure ou le contenu des anciennes sauvegardes, ni ajouter une migration qui les modifie sans accord.
5. Ne pas prendre une capture d'une ancienne civilisation comme invitation à « corriger » cette civilisation ; elle sert uniquement à tirer des leçons **pour la prochaine**.
6. Ne pas interpréter ce skill comme une nouvelle demande de modifications. **Aucune action hors de la commande courante.**

Seule une **nouvelle demande explicite de l'utilisateur**, désignant clairement une civilisation existante à modifier, peut lever exceptionnellement cette restriction pour les fichiers spécifiés. Si l'instruction est ambiguë, ne touche pas à l'existant.

### Préflight avant d'écrire

- Établir la liste des packs déjà présents et les considérer figés.
- Identifier l'ID et le dossier du **nouveau pack autorisé**. Si la demande n'en définit aucun, se limiter à un plan/conseil sans éditer de civilisation.
- Consigner les chemins autorisés. Vérifier la propreté ou l'état initial du dépôt (`git status` si disponible). Ne jamais annuler des changements préexistants de l'utilisateur.
- Auditer les anciennes cartes et intérieurs **en lecture seule** pour comprendre ce qu'il ne faut pas répéter.
- Contrôler les fichiers modifiés avant livraison ; le script `scripts/check_protected_civs.py` peut aider pour les projets Git. Un outil de contrôle ne remplace pas le jugement humain.

## Documents de référence à lire suivant le travail

**Pour le plan du monde :**
- [Terrain et composition](references/TERRAIN_AND_COMPOSITION.md) : macroformes, relief, hydrologie, vues et horizons.
- [Urbanisme thématique](references/THEMATIC_CITY_PLANNING.md) : morphologies, quartiers, routes, densité, usages.
- [Audit anti-répétition](references/ANTI_REPETITION_PROTOCOL.md) : signature spatiale et comparaison sans toucher aux anciennes cartes.
- [Implémentation et revue FPS](references/IMPLEMENTATION_AND_REVIEW.md) : terrain voxel, performances, construction et validation.
- [Concepts contrastés](references/CIVILIZATION_CONCEPTS.md) : exemples illustratifs, **JAMAIS** des consignes de modifier Mask, Door, Memory ou un autre pack.

**Pour les bâtiments et les intérieurs :**
- [Fondamentaux de l'aménagement](references/INTERIOR_DESIGN_FOUNDATIONS.md) : volumes, ergonomie, mobilier, lumière et narration visuelle.
- [Références logements Power](references/POWER_HOUSING_REFERENCE.md) : studio, appartement, loft, penthouse. **Référence pour un futur travail autorisé uniquement ; ne pas améliorer les packs déjà présents.**
- [Contrôle qualité intérieur](references/INTERIOR_REVIEW_AND_TESTS.md) : revue du joueur à la première personne.

**Pour la protection et la coordination :**
- [Politique de non-régression](references/FROZEN_CIVILIZATIONS_POLICY.md) : frontière de modification et cas concrets.
- [Pipeline unifié](references/END_TO_END_PIPELINE.md) : de la carte à la pièce en passant par l'éditeur.
- [Exemples de plans JSON](examples/POWER_WORLD_PLAN.json), [plan contrasté](examples/CANAL_WORLD_PLAN.json) ; modèles de structure, à ne pas copier.

## Workflow obligatoire : CONCEVOIR → COMPARER → CONSTRUIRE → PARCOURIR → CORRIGER

### 1. Identifier le thème et définir une identité environnementale

Avant d'ouvrir l'éditeur, résumer :

- Monde, époque, fiction, usages, climat et règles de la civilisation cible.
- **Phrase de silhouette** : « Ce monde se reconnaît parce que … » sans évoquer sa couleur.
- **Macroforme** (bassin, archipel, cité radiale, réseaux de tunnels, plaine, canaux, station, ville dans une canopée…).
- **Organisation urbaine** (grappes, quartiers concentriques, axes, mosaïque d'îlots, diagonales, etc.).
- **Réseau de mobilité** (routes, métro, toits, ponts, canaux, ascenseurs, transport spécifique au thème).
- **Relation entre rangs et espace** sans automatiquement choisir « pauvres en bas / riches en haut ».
- Landmarks, scènes fortes et points de vue à hauteur du joueur.
- Vocabulaire architectural : matières, volumes, toitures, façades, fenêtres, mobilier urbain.
- Style des **intérieurs**, cohérent avec ces matériaux, le rang social et la culture du monde.

Aucune civilisation n'est obligée d'avoir des tiers sociaux. Ne force pas les structures de la précédente.

### 2. Réaliser l'audit anti-répétition (sans modification des anciennes civs)

Comparer en lecture seule le nouveau concept à toutes les autres cartes accessibles :

1. Relief et usage de l'eau.
2. Forme du plan top-down et réseau des rues.
3. Disposition des quartiers et frontières.
4. Monument et skyline.
5. Expérience des premières minutes et déplacements.
6. Palette, géométrie et identité architecturale.
7. Plan et ambiance des logements/établissements.
8. Équipements, décorations et habitudes des habitants.

**Défaut historique à éviter :** un quartier bas + une gigantesque muraille + un quartier haut + des façades semblables en lignes. Ne jamais reprendre cette recette par réflexe. Cela ne signifie PAS qu'il faut enlever le mur des maps existantes : elles sont figées.

Consigner une empreinte spatiale (`macroform`, `city_pattern`, `district_relations`, `elevation_logic`, `landmark_type`, `movement_signature`, `water_role`, `first_impression`). Chercher au moins quatre distinctions majeures par rapport à la carte la plus proche. Si la proposition est trop semblable, **redessiner uniquement le futur monde**.

### 3. Concevoir carte et bâtiments ensemble

Définir **avant** de générer des centaines d'objets :

- Plan de dessus des quartiers, des routes et des grands axes.
- 2 à 4 vues repères depuis des lieux réellement accessibles.
- Lieux de gameplay, missions, logements, lieux publics et accès de service.
- Échelle cohérente entre rues, portes, salles, personnages, escaliers et intérieurs.
- Continuité physique : chaque fenêtre et chaque entrée importante doit correspondre à l'intérieur, ou être identifiée comme façade non accessible.
- Raccourcis et retours vers les lieux récurrents ; trajets agréables en FPS.

Une grande ville **n'est pas** meilleure parce qu'elle est immense. Préférer densité, variété, lieux utiles et trajets expressifs à des milliers de bâtiments vides.

### 4. Construire en passes lisibles

**Extérieurs :**

1. Terrain/hydrologie/volumes/silhouette.
2. Voirie, franchissements, parcelles, quartiers, infrastructures.
3. Bâtiments repères et architectures propres à la civilisation.
4. Vie urbaine : transport, végétation, mobilier, enseignes en français, éclairages, PNJ, sons.

**Chaque intérieur accessible :**

1. **Architecture** : dimensions, portes, fenêtres, niches, volumes, sols, plafond, lumière naturelle.
2. **Fonctions** : lit, cuisine, travail, stockage, entraînement, interactions ; circulation à hauteur de personnage.
3. **Personnalité** : meubles variés, accessoires groupés, tapis, éclairage secondaire, plantes, objets du quotidien, indices narratifs, imperfection crédible.
4. **Finition** : matériaux à bonne échelle, textures variées, objets utilisables, éclairage d'ambiance, collisions.

Ne construis ni boîte vide avec trois cubes, ni salle encombrée sans circulation. Un appartement modeste peut être chaleureux et personnalisé ; un penthouse luxueux doit se distinguer par le **plan, les volumes, les vues et l'usage**, pas uniquement par la présence d'or.

### 5. Exploiter Civilization Studio et les scripts du projet

- Inspecter ses API et outils existants avant d'écrire du code.
- Étendre les outils **de manière additive et rétrocompatible** seulement si cela est nécessaire et autorisé pour le nouveau pack.
- Préférer de nouveaux assets, prefabs, palettes et matériaux *isolés* à l'édition des ressources partagées.
- Optimiser chunking/meshing/instancing/draw calls de manière compatible avec l'architecture en place.
- Créer une map et des intérieurs qui existent réellement en jeu ; un plan JSON n'est pas une livraison.
- Les textures ne constituent pas la seule variation. Privilégier des silhouettes, implantations, matières, parcours et objets distincts.
- Respecter les mécaniques et interactions propres à la nouvelle civilisation.

### 6. Inspection réelle à la première personne

Pour **le seul nouveau pack autorisé**, si les outils permettent de lancer le jeu :

- Examiner une vue globale top-down et le trajet du spawn aux premiers objectifs.
- Observer au moins 4 angles FPS représentatifs : arrivée, monument, zone secondaire, itinéraire de mission.
- Parcourir réellement axes principaux et secondaires ; vérifier les accès, intersections, collisions et distances.
- Pour chaque intérieur important, regarder depuis entrée, fenêtre, point focal et à l'échelle du joueur ; tester portes, objets interactifs et mobilier.
- Comparer les captures avec d'anciennes civilisations **sans en modifier une seule**.
- Corriger uniquement les fichiers du **nouveau pack autorisé** ; effectuer un nouvel examen.
- Vérifier les performances et le chargement des anciennes civilisations **sans y écrire ni sauvegarder des changements**.

Si une capture ou un lancement n'est pas possible, dire précisément ce qui n'a pas été vérifié. Ne jamais présenter une compilation comme validation visuelle.

### 7. Livrables et contrôle du périmètre

Rendre un court rapport indiquant :

- Nouveau pack autorisé et chemins réellement modifiés.
- Civilisations consultées **en lecture seule** pour l'audit.
- Différences concrètes entre la nouvelle civilisation et les précédentes.
- Plan, terrain, voirie, architecture, intérieurs, éclairage et objets marquants.
- Captures/tests réellement effectués et bugs non résolus.
- Confirmation **vérifiable** que les civs existantes n'ont pas été modifiées (ou signalement immédiat si l'audit détecte une anomalie).

## Langue et ton

Tout élément visible par le joueur — enseignes, tutos, descriptions de lieux, UI, quêtes, panneaux, dialogues — doit être en **français naturel, vivant et clair**. Les noms de code peuvent rester en anglais. Chaque civilisation doit également avoir sa propre **ambiance** (énergique, chaleureuse, inquiétante, grandiose, festive, etc.), et ne pas retomber systématiquement dans la même atmosphère mélancolique.

## Fin du skill : règle de priorité

**Ce skill n'ordonne aucune réparation rétroactive. Il sert à construire différemment ce qui vient ensuite, pas à retoucher ce qui existe déjà.** En cas de doute sur un fichier ou un asset partagé, NE L'ÉDITE PAS, et propose une solution isolée pour la nouvelle civilisation.
