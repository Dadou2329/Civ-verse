# CIVILIZATIONVERSE — MASK CIVILIZATION
## LES CENT VISAGES
### Bible narrative et scénario jouable intégral — version 1.0

**Document de référence pour Claude Code / Opus 5.5**  
**Langue obligatoire de toute l'expérience : français (fr-FR).**  
**Genre :** aventure 3D à la première personne, action, humour, mystère, ascension sociale et grand final héroïque.  
**Durée visée :** 4 à 6 heures de gameplay *réel* si tout le contenu est produit ; durée non garantie et à mesurer en test.  
**Statut :** première civilisation longue de Civilizationverse. Les prototypes Door et Memory ne doivent pas être réécrits, détruits ou réutilisés comme cartes de cette aventure.

> **IMPORTANT — À LIRE AVANT DE CODER.** Ceci est le scénario et le cahier d'implémentation narratif de la **première longue aventure**. Le protagoniste n'arrive pas dans un monde inconnu, ne se réveille pas sans souvenirs, et aucun enfant ne vient lui expliquer les règles. Il **vit ici depuis des années**. Il connaît les quartiers, les rangs, les coutumes et les injustices ordinaires. Dès la première minute, il veut monter les échelons. La trame multiverselle est une discrète possibilité pour la suite, jamais le moteur de l'intrigue locale. La plupart des dialogues sont parlés, naturels, parfois drôles. L'histoire comporte de la joie, de la rivalité, de l'action, des pauses chaleureuses et des séquences épiques. **Ne pas la transformer en récit uniformément triste, énigmatique ou solennel.**

---

# 1. LA PROMESSE DU JEU

Dans la cité verticale de **Viremasque**, chaque habitant porte le masque qui lui a été attribué et garde toute sa vie le rôle correspondant. Un masque ne sert pas seulement à montrer son rang : il donne de réelles capacités. Les Courriers filent sur les toits grâce au Fil ; les Gardiens encaissent les coups grâce au Fer ; les Lecteurs du Verre révèlent ce qui se cache sous les apparences. Officiellement, tenter d'utiliser un second masque peut rendre fou. En pratique, une partie de cette histoire est vraie, et une partie arrange énormément le pouvoir.

Notre héros est un **Cendre**, l'échelon le plus bas. Il habite une petite chambre au-dessus de l'atelier communautaire de son quartier, **Les Rives Basses**. Il ne rêve pas de sauver le monde. Il veut remporter les **Épreuves de l'Ascension**, obtenir son premier vrai permis de promotion et enfin avoir le droit de travailler là-haut, là où les machines sont belles, les rues propres et les occasions nombreuses. Quand l'histoire commence, **il sait déjà exactement ce qu'il veut**.

Le problème : en réparant un vieux masque, il découvre qu'il peut en porter plusieurs sans perdre sa personnalité. Cette faculté interdite l'entraîne, malgré lui, au cœur d'une conspiration autour de la cérémonie du **Grand Accord**, qui doit bientôt lier tous les masques de la cité à une seule voix.

**Question dramatique principale :** « Comment grimper dans une société qui prétend que ta place est fixée pour toujours — sans devenir toi-même celui qui décide de la place des autres ? »

**Piliers du plaisir de jeu :**
1. **Progresser visiblement** : partir d'un atelier pauvre et accéder à des quartiers toujours plus impressionnants.
2. **Maîtriser les masques** : tenir, équiper, changer et utiliser de véritables équipements en exploration ET en combat.
3. **S'attacher à une équipe** : amis, rival, garde, noblesse dissidente, chacun avec des convictions et une personnalité.
4. **Vivre des moments spectaculaires** : course sur les toits, duel public, fuite dans des galeries de verre, bataille de quartier et boss final.
5. **Comprendre l'histoire** : enjeux simples à court terme, complot expliqué clairement et indices honnêtes avant les révélations.

---

# 2. RÈGLES CANONIQUES DE LA CIVILISATION

## 2.1 Les masques

Un masque est un objet tangible : on peut le tenir, l'inspecter, le ranger, l'équiper et le voir sur son personnage lors des cinématiques. Il possède une **trame** réactive qui répond au porteur et lui transmet une capacité. Tous les habitants n'ont pas les mêmes aptitudes. Ils sont formés très jeunes à leur **masque d'appartenance** ; sa trame reçoit un **sceau d'attache** lors de l'Attribution.

En temps normal, un autre masque refuse le lien et provoque douleur, vertiges ou confusion. Ce danger existe réellement si deux trames sont forcées à se synchroniser sans préparation. Les autorités en ont tiré une règle absolue : « Un visage, un masque, une vie. »

**Vérité profonde révélée progressivement :** les premiers masques étaient conçus pour être échangés sous supervision, avec une technique d'**accordage** et un ancrage personnel. Après un ancien accident collectif, les Fixateurs ont remplacé ce système par des attaches permanentes. Le risque était réel ; l'interdiction totale, elle, était un choix politique. Le héros trouve par hasard une voie vers l'accordage grâce à un ancien masque de Cendre réparé sans son sceau d'attache. Sa réussite exige entraînement, repos et un objet-ancre fabriqué par Lys. **Il n'est pas le seul être au monde capable de changer de masque** ; il est simplement le premier personnage jouable à redécouvrir comment le faire de manière sûre.

## 2.2 Deux notions distinctes à montrer au joueur

- **Rang civique** : les autorisations officielles (entrer dans un quartier, concourir, exercer un métier). Il s'obtient par des épreuves et des actes reconnus, ou par dérogation. Porter clandestinement un masque ne donne PAS automatiquement les droits civiques correspondants.
- **Masques équipables** : la collection du héros, ses pouvoirs, ses compromis et ses limites. Il peut débloquer une capacité sans obtenir aussitôt le rang associé.

Cette distinction permet un gameplay varié et évite des incohérences : un Gardien peut toujours refuser l'entrée au héros, même s'il cache dans son sac un Masque de Fer.

## 2.3 Les rangs révélés par l'histoire

| Rang | Nom public | Fonction sociale | Pouvoir principal | Moment de révélation dans l'interface |
|---|---|---|---|---|
| 0 | **Cendre** | Atelier, maintenance, petites réparations | **Braise** : frappe rapprochée qui déstabilise / outils de réparation | Dès le prologue |
| I | **Fil** | Courriers, voltigeurs, relais | **Élan** : accélération et accroche brève vers un point marqué | Dès le prologue, encore verrouillé |
| II | **Fer** | Gardiens, arènes, sécurité | **Rempart** : parade active et riposte | Dès le prologue, encore verrouillé |
| III | **Verre** | Enquêteurs, archivistes, cartographes | **Révélation** : lire traces, illusions et faiblesses | Découvert au chapitre IV |
| IV | **Or** | Conseil, grandes guildes, commandement | **Ralliement** : bouclier de groupe et impulsion d'équipe | Présence sociale connue, capacité révélée au chapitre V |
| Hors rang | **Miroir** | Programme secret des Fixateurs | **Reflet** : reproduit une seule action adverse avec retard | Découvert au chapitre III |
| Hors rang | **Masque Libre** | Ancienne technique, pas une caste | **Accord** : passer d'une trame à l'autre avec préparation | Compris au chapitre IV, accompli à la fin |

**NE PAS afficher cette table complète dans le jeu au début.** Le joueur ne voit que ce que son personnage sait et ce que l'histoire vient de lui permettre de découvrir. Le Masque Libre n'est jamais présenté comme un « rang VI ».

## 2.4 Limites du changement de masque

Pour éviter le héros invincible et conserver des défis : seul un masque équipé peut fournir son pouvoir actif. Le changement demande une animation et consomme une courte fenêtre d'accordage ; une surcharge temporaire apparaît après des changements répétés. Le système doit être visible, compréhensible, non punitif. Le début ne donne accès qu'à Cendre. Le Fil se débloque en cours de chapitre II ; le Fer, après le chapitre III ; le Verre, au chapitre IV ; l'Or, très tard. Dans les séquences où le héros doit masquer son secret, utiliser une capacité clandestine devant des témoins importants provoque une réaction scénarisée ou une mise en garde, pas un échec arbitraire impossible à comprendre.

**Règle absolue :** les masques ne sont pas de simples bonus statistiques. Ils modifient véritablement la façon de traverser, résoudre, combattre et mettre en scène le monde.

## 2.5 Les Épreuves de l'Ascension

Chaque année, la ville organise des compétitions de métiers et d'agilité. Les candidats les mieux classés obtiennent exceptionnellement le droit de passer un rang, **à condition qu'un parrain agréé accepte leur dossier**. En théorie, n'importe quel citoyen peut concourir ; en pratique, les Cendres trouvent rarement un parrain. C'est par là que l'ambition personnelle du héros commence. Il ne connaît pas encore les secrets du Grand Accord.

---

# 3. PERSONNAGES ET VOIX

## LE HÉROS — « TU » / NOM CONFIGURABLE

Âge adulte, habitant des Rives Basses depuis toujours. Habile de ses mains, un peu fanfaron, compétitif, chaleureux avec les gens de son quartier. Il sait comment fonctionne Viremasque et la présente lui-même. On peut lui donner un nom choisi par le joueur ; les dialogues parlés doivent éviter une dépendance technique à ce nom. **Il ne prétend jamais découvrir les usages locaux**. Ses plaisanteries servent parfois à cacher sa peur ; il fait des erreurs et doit apprendre à écouter. **Motivation initiale :** devenir Fil, obtenir un vrai avenir et prouver qu'un Cendre ne naît pas pour rester Cendre. **Évolution :** chercher une victoire pour soi → devenir champion populaire → refuser que la liberté ne profite qu'à une personne.

## LYS — amie d'enfance, mécanicienne Cendre

21–25 ans, énergique, franche, inventive et drôle. Elle possède l'atelier du quartier avec sa tante. Elle sait que le héros adore les défis et le taquine. C'est elle qui crée l'**ancre d'accordage** à partir de matériaux recyclés. Elle ne doit pas être une simple distributrice de quêtes : elle prend des décisions, négocie avec les guildes, se trompe une fois, répare ses erreurs et joue un rôle décisif dans le final.

**Voix :** « Tu veux monter là-haut ? Super. Commence déjà par descendre de mon établi. »

## NORA — maîtresse de l'atelier et tante de Lys

40–55 ans, chaleureuse, très directe, sait parfaitement comment fonctionne la cité. Elle refuse que les ambitieux oublient leur quartier. Elle apporte de l'humour, de la stabilité, une vraie raison d'aimer les Rives Basses. Elle n'est pas une figure vouée à mourir pour motiver le héros.

**Voix :** « Les grands discours, ça ne répare pas une roue. Passe-moi la clé. »

## JUNO — coursière de rang Fil

Rapide, maligne, une compétitrice qui parle vite. Elle aime son métier et trouve les règles ridicules quand elles empêchent quelqu'un de travailler. Elle devient la première personne d'un rang supérieur à vraiment aider le héros. Sa loyauté doit se gagner au fil d'une course et d'une action généreuse, pas par une révélation surnaturelle.

**Voix :** « Si tu tombes, je rigole. Si tu te relèves, je t'applaudis. »

## KAËL — rival et futur allié, rang Fer

Jeune champion des arènes. Sérieux, obstiné, talentueux, fier d'avoir mérité sa place. Il déteste la triche. Sa sœur a subi des troubles après un accident d'accordage mal encadré : il a donc **une vraie raison** de craindre les masques multiples. Au départ il juge le héros irresponsable, puis apprend à distinguer danger et mensonge politique. Il ne devient pas subitement gentil ; il conserve son tempérament et sa rivalité.

**Voix :** « Je ne vais pas te laisser gagner parce que ton histoire est touchante. Monte ta garde. »

## SOREN — garde Fer, vieux briscard sympathique

Garde pragmatique, humour sec, pas dupe des règlements absurdes. Il fait son travail mais refuse les abus. Il représente les citoyens ordinaires des institutions, et permettra aux Gardiens de ne pas être tous des ennemis identiques.

**Voix :** « Les règlements, j'en ai trois armoires. Les bonnes raisons d'arrêter quelqu'un, beaucoup moins. »

## ÉLIANE — archiviste de rang Verre

Brillante, incisive et passionnée par les documents anciens ; elle aime expliquer avec des mots simples. Elle dispose de preuves partielles sur l'origine des masques, mais ne sait pas tout. Elle fait des hypothèses, les teste et corrige ses erreurs au lieu de lancer des prophéties énigmatiques.

**Voix :** « Attends. Là, j'ai une preuve. Ça, c'est juste ma théorie. C'est important de ne pas mélanger les deux. »

## MAËL — conseiller de rang Or

Noble jeune mais pas naïf. Il veut réformer les épreuves et les guildes, et comprend que les privilèges lui profitent. Il accepte de risquer sa carrière, sans prétendre qu'un discours règle toute l'injustice. Il fournit un accès précieux au palais et rallie une partie des guildes.

**Voix :** « Tu peux me détester pour mon masque. Mais laisse-moi au moins faire quelque chose d'utile avec. »

## VAUREL — Grand Fixateur, antagoniste principal

Chef respecté des ateliers de trame, charismatique et méthodique. Lors d'un accident collectif ancien, il a vu ce que provoquait un accordage massif non maîtrisé : souvenirs mêlés, paniques, blessures, morts. Il croit sincèrement que la liberté de changer de masque mènera la ville au chaos. Il manipule l'histoire officielle, criminalise les tentatives d'accordage, cache des catastrophes provoquées par ses propres expériences et prépare la **Fixation Totale** : un réseau central qui neutraliserait définitivement toute possibilité de changement, en affaiblissant la volonté de ceux qui résistent. Il n'est pas un sadique inexplicable. Il devient monstrueux parce qu'il considère acceptable d'enfermer toute une ville pour la « protéger ».

**Voix :** polie, simple, précise. « Tu appelles ça choisir. Moi, j'appelle ça prendre le risque pour tout le monde sans leur demander. »

## L'ARBITRE MIROIR — antagoniste secondaire

Combattant du programme secret des Fixateurs, silhouette brillante sans visage fixe. Contraint de porter une trame instable, il imite avec un temps de retard l'action du héros. Dans son dernier combat, on comprend qu'il souffre des manipulations de Vaurel. Le joueur peut le neutraliser sans l'achever ; cette décision rend possible une aide mineure pendant le final. Ce personnage ne doit pas devenir un vague oracle.

---

# 4. MONDE ET IDENTITÉ DES ZONES

Le monde doit être **vraiment nouveau**, pas une recoloration des prototypes. Ce n'est ni la cité des portes ni le village des souvenirs. Sa géographie est construite autour du contraste entre **métiers, hauteurs et déplacements**.

1. **LES RIVES BASSES** — maison du héros, atelier de Lys, grand moulin de levage, ruelles pleines de vie, linge tendu, échoppes, roues, canaux. Couleurs chaudes, bois peint, pierre usée, végétation spontanée. Musique rythmée, optimiste. On doit aimer y revenir.
2. **LES TOITS DU FIL** — réseau vertigineux de passerelles, toiles, téléphériques, auvents, carillons, quais de courrier et parcours de course. Façades colorées, bannières, grande vue sur toute Viremasque.
3. **LE BASTION DE FER** — enceinte rouge sombre, ateliers métalliques, casernes et **Arène des Échelons**, vaste lieu de compétition avec gradins et public réactif. Musique de tournoi.
4. **LES TERRASSES DE VERRE** — bibliothèque suspendue, serres à prismes, allées transparentes, observatoire, jeux de lumière révélant les vérités cachées. Ni ambiance de tombeau, ni triste ruine : beauté étrange et précise.
5. **LES JARDINS D'OR** — quartier supérieur lumineux, jardins géométriques, fontaines, salons politiques et terrasse du palais. Les gens y vivent aussi : le lieu ne doit pas être une forteresse vide de méchants.
6. **LES FONDERIES DE TRAME** — infrastructure industrielle souterraine, bobines, engrenages, rails, tubes lumineux, gigantesque salle de commande. Lieu d'action et de sabotage, pas seulement de lecture de journaux.
7. **LA TOUR DE L'ACCORD** — point le plus haut, monument cérémoniel et arène finale à plusieurs niveaux, jouant sur l'ensemble des capacités débloquées.

Les changements de quartier doivent être remarquables par **leur tracé, leur mobilité, leurs NPC, leurs interactions, leurs textures, leurs objets et leur ambiance sonore**. La montée physique de la ville accompagne la montée sociale du héros. Garder des raccourcis déverrouillables pour revisiter les zones sans longs trajets répétitifs.

---

# 5. STRUCTURE GLOBALE — 7 CHAPITRES + ÉPILOGUE

| Partie | Titre | Durée cible | Transformation principale |
|---|---|---:|---|
| Prologue | **La place qu'on nous donne** | 20–30 min | Connaître sa ville ; vouloir devenir Fil ; s'attacher aux Rives |
| I | **Courir plus haut** | 35–45 min | Gagner son droit à concourir ; première anomalie de masque |
| II | **Un pas sur le Fil** | 40–50 min | Maîtriser Élan ; remporter la course ; gagner un allié |
| III | **Le fer et les honneurs** | 45–55 min | Duel public, parade, accusation, fracture avec Kaël |
| IV | **Ce que montre le Verre** | 45–55 min | Enquête active, révélation des origines et du complot |
| V | **La ville qui refuse d'obéir** | 50–65 min | Réunir les quartiers, assaut, réconciliation et libération |
| VI | **Le dernier visage** | 45–60 min | Grand Accord, boss à phases, choix final, nouvelle cité |
| Épilogue | **Sans demander la permission** | 10–15 min | Retrouvailles, conséquences, discret écho multiversel |

Les durées sont des **cibles de conception** : elles doivent correspondre à des activités réelles, non à des couloirs artificiellement longs ou à des dialogues étirés. Le temps de jeu exact doit être mesuré. Toutes les étapes principales doivent avoir des conditions claires et des issues de secours contre les blocages.

---

# 6. SCÉNARIO INTÉGRAL, SCÈNE PAR SCÈNE

## PROLOGUE — LA PLACE QU'ON NOUS DONNE

### P00 — Ouverture : matin aux Rives Basses

**Lieu :** chambre du héros, au-dessus de l'atelier. **Mode :** courte cinématique à la première personne, puis contrôle immédiat. **Ambiance :** soleil, cloches de la ville, va-et-vient joyeux, outils qui claquent.

Au lieu d'un réveil mystérieux, le héros prépare lui-même sa journée. Sa chambre présente la vie qu'il connaît : vieux trophée de bricolage, carte griffonnée de Viremasque, affiche des Épreuves de l'Ascension, masque de Cendre sur un support et chaussures usées. Il enfile son masque avec assurance. Par la fenêtre, on voit les étages supérieurs de la ville.

**Monologue court du héros, ton de présentation vive :**

**HÉROS :** « Ici, c'est Viremasque. Chaque quartier a son rang, chaque rang a son masque. Moi ? Cendre. Le tout premier échelon. On répare ce que les autres cassent, et on nous dit merci quand ils y pensent. »

Il ouvre la fenêtre. Au-dessus, des Courriers sautent entre les toits ; un Gardien intercepte un chariot ; au loin, des nobles traversent un pont suspendu.

**HÉROS :** « Là-haut, les Fils courent au-dessus de la ville. Les Fers gardent les arènes. Et moi, cette année, je passe les Épreuves. Je vais enfin monter. Au moins d'un rang. »

**LYS, depuis la rue :** « Si tu veux monter, tu peux déjà descendre ! On a une roue qui a lâché ! »

**HÉROS :** « Voilà. Mon ascension commence par un escalier. »

**Contrôle joueur :** se déplacer dans la chambre, prendre sa clé d'atelier (objet visible en main), inspecter l'affiche et la carte, descendre. Le rang 0 apparaît dans le HUD ; Fil et Fer sont connus mais verrouillés. Aucun autre rang révélé.

**Objectif affiché :** « Rejoins Lys à l'atelier. »

### P01 — L'atelier vivant

**Gameplay :** réparer la roue d'un chariot avec deux interactions concrètes : récupérer une pièce, aligner l'essieu et fixer la roue. Un voisin donne des conseils, des clients discutent, une petite activité facultative permet d'obtenir de la ferraille. Le joueur doit sentir qu'il habite cet endroit.

**LYS :** « T'as encore passé la nuit à regarder l'affiche du concours ? »

**HÉROS :** « J'ai aussi dormi. Un peu. »

**LYS :** « Tu sais qu'il te faut un parrain pour t'inscrire ? »

**HÉROS :** « Je vais en trouver un. »

**LYS :** « Et tu sais que les parrains ne se battent pas pour signer des dossiers de Cendre ? »

**HÉROS :** « Tu peux me laisser être optimiste pendant trente secondes ? »

**NORA, passant une clé :** « Trente secondes, c'est fini. La roue, maintenant. »

Après réparation, un Courier Fil, **Juno**, arrive en trombe : un petit monte-charge municipal est bloqué avec des caisses de provisions destinées au quartier. Le responsable de secteur refuse une réparation par des Cendres ; seuls les professionnels agréés peuvent toucher la machine.

**JUNO :** « J'ai besoin d'un mécanicien. Pas d'un formulaire. La machine chauffe ! »

**NORA :** « Alors tu es au bon endroit. »

**HÉROS :** « Tu crois qu'une réparation urgente mérite un parrainage ? »

**LYS :** « Tu ne peux pas t'empêcher de négocier pendant une catastrophe ? »

### P02 — Le monte-charge fou

**Set piece tutoriel :** course courte sur des plates-formes, saut, prise d'un levier, réparation en temps limité *souple* ; le chariot menace des habitants. Les actions sont clairement annoncées. Si le joueur échoue au compte à rebours, Juno retient temporairement le chariot et le joueur réessaie ; pas de mort arbitraire ni de sauvegarde bloquée.

Au moment critique, le héros actionne une frappe **Braise** à l'aide de son masque Cendre pour libérer un mécanisme coincé. Juno aide en sautant au-dessus des rails.

**JUNO :** « À trois, tu tapes ! UN ! DEUX ! »

**HÉROS :** « T'AS OUBLIÉ TROIS ! »

**JUNO :** « JE L'AI PENSÉ TRÈS FORT ! »

Le monte-charge s'arrête. Le quartier applaudit ; le héros a sauvé les caisses sans se croire élu par une prophétie.

**JUNO :** « Bon. Tu sais courir et réparer sous pression. Les Épreuves commencent demain. Je te dois un service. »

**HÉROS :** « Je connais exactement le service qu'il me faut. »

**JUNO :** « Évidemment. »

**Conséquence :** Juno accepte de présenter le héros à un relais de candidats, pas encore de le parrainer. Fin du prologue sur une musique de victoire courte, chaleureuse.

---

## CHAPITRE I — COURIR PLUS HAUT

### I01 — Le bureau des inscriptions

**Lieu :** marché des Rives, bâtiment officiel à guichets. **Objectif :** obtenir un dossier de candidature. **Conflit :** un commis indique poliment que le héros doit fournir trois preuves d'aptitude, même avec le soutien d'un Fil.

**COMMIS :** « Vous êtes Cendre ? Alors il faut trois validations. »

**HÉROS :** « Les autres n'en ont qu'une. »

**COMMIS :** « Les autres ne sont pas Cendre. »

**HÉROS :** « Ah. C'est donc écrit comme ça. »

La scène montre l'injustice simplement, sans longue tirade cryptique. Juno confirme qu'elle ne peut pas contourner la règle, mais peut aider à préparer les épreuves. Lys propose de transformer la corvée en entraînement.

### I02 — Trois preuves, trois petites aventures

**Gameplay non linéaire (ordre libre) :**

- **Précision :** réparer un automate de tri sans casser ses pièces. Mini-défi d'interaction et de timing.
- **Courage :** sécuriser une passerelle abîmée pendant qu'une pluie soudaine fait glisser des caisses. Déplacement et courte course.
- **Entraide :** aider deux marchands rivaux à déplacer un étal ; choisir une solution honnête (collaboration) ou pragmatique (répartition). Les deux valident l'épreuve ; les dialogues changent légèrement.

Chaque réussite fait progresser le dossier. Les personnages du quartier félicitent le héros, se moquent gentiment de ses ambitions ou donnent des astuces. Une **mini-fête du quartier** à l'arrivée permet d'éviter une intrigue noire dès le début.

### I03 — La boîte des vieux masques

En cherchant un élément pour réparer l'automate, Lys montre une caisse de vieux masques promis au recyclage. Parmi eux, un **masque de Fil fendu**, considéré comme inutilisable. Son design n'est pas juste le masque normal recoloré : filament textile, points métalliques, fins rubans mécaniques.

**LYS :** « Tiens, ton futur visage. Il manque une moitié et il grince, mais avec un peu de peinture… »

**HÉROS :** « Très drôle. »

Elle lui demande de tenir la pièce pendant qu'elle teste la trame. Un filament bleu se connecte brièvement au héros — impossible, puisque son Cendre est déjà attaché. Il retire le masque aussitôt ; il a le vertige, mais conserve ses souvenirs. Le mécanisme manque de tomber ; Lys coupe l'alimentation.

**LYS, soudain sérieuse :** « Tu as senti ça ? »

**HÉROS :** « J'ai eu l'impression… de voir le toit depuis le toit d'en face. »

**LYS :** « Ne le répète à personne. Les Fixateurs adorent confisquer ce qu'ils ne comprennent pas. »

**HÉROS :** « C'était un accident. »

**LYS :** « Alors évitons d'en avoir un deuxième sur la place du marché. »

**Information transmise :** un second masque peut réagir au héros, mais cela ne prouve pas qu'il est sans danger. L'objet ne devient pas encore équipable ; il faut le réparer et l'ancrer. Le héros accepte de ne pas prendre de risque avant que Lys le comprenne.

### I04 — Le premier rival

**Lieu :** estrade des candidatures. Le dossier validé permet une épreuve ouverte de classement. Kaël, champion Fer invité à présider, remarque l'équipement rafistolé du héros. Il n'est pas un méchant cliché : son ton est sec, mais il observe les performances honnêtement.

**KAËL :** « Tu es celui qui a arrêté le monte-charge ? »

**HÉROS :** « Celui qui a sauvé les caisses et la réputation du service technique, oui. »

**KAËL :** « Ici, personne ne va t'applaudir pour avoir un bon mot. »

**HÉROS :** « Dommage. J'en avais préparé quatre. »

**KAËL :** « Garde ton souffle pour la course. »

**Gameplay :** parcours de qualification sans masque Fil : obstacles, échelle, sauts, entretien d'une roue mobile. Le joueur peut manquer une première tentative, recevoir des conseils utiles, et recommencer. À la réussite, Kaël signe la validation d'aptitude mais refuse de promettre une victoire facile.

**KAËL :** « Tu as gagné ta place sur la ligne de départ. Ne la gâche pas. »

**HÉROS :** « C'est presque un compliment. »

**KAËL :** « N'exagérons rien. »

**Fin de chapitre :** le héros est qualifié. Dans un plan très bref, Vaurel consulte la liste de candidats. Il s'arrête sur le numéro d'atelier du héros et ferme le dossier, intrigué mais pas encore omniscient. Le joueur comprend qu'il est observé sans qu'un narrateur dise « ton destin est scellé ».

---

## CHAPITRE II — UN PAS SUR LE FIL

### II01 — Premier jour sur les toits

**Lieu :** les Toits du Fil. **Ambiance :** couleurs vives, musiciens, foule, compétition festive. C'est la première grande expansion visuelle de la carte. Juno fait découvrir les méthodes des Courriers ; le héros connaît leur réputation mais n'avait jamais eu accès à leurs parcours officiels.

**JUNO :** « Règle numéro un : regarde où tu vas. »

**HÉROS :** « C'est tout ? »

**JUNO :** « Règle numéro deux : si tu ne regardes pas, évite au moins de me tomber dessus. »

Le héros participe d'abord à des épreuves accessibles aux Cendres, avec un itinéraire difficile mais honnête. Un rival mineur essaie de le pousser hors de la piste ; Juno intervient verbalement, sans faire le travail à sa place.

### II02 — Fabriquer l'ancre

Lys retrouve le héros dans un atelier-relais. Elle apporte le masque Fil restauré et un **bracelet-ancre** fabriqué à partir du mécanisme de sa roue réparée. Elle a étudié sa réaction : le masque Cendre du héros est très ancien et a été réparé autrefois sans le verrou central. C'est une anomalie mécanique, pas la preuve qu'il descend d'un roi oublié.

**LYS :** « J'ai une bonne et une mauvaise nouvelle. »

**HÉROS :** « La bonne d'abord. »

**LYS :** « Tu peux peut-être porter le Fil. »

**HÉROS :** « Et la mauvaise ? »

**LYS :** « Si je me trompe, tu vomis dans mes chaussures. Et je t'en voudrai énormément. »

**HÉROS :** « Ah. Donc un risque raisonnable. »

**Gameplay :** apprentissage guidé dans une zone privée : équiper le Fil, effectuer un premier Élan vers un point ancré, revenir au Cendre, apprendre la surcharge d'accordage. Premier véritable changement de masque en main et sur le personnage. En cas d'échec, retour immédiat au point de départ, aucun dommage permanent. Les deux décident de garder le secret jusqu'à comprendre les conséquences.

**Important :** les masques équipés et les outils tenus en main doivent avoir un modèle 3D et des animations fonctionnelles. On ne débloque pas seulement une icône.

### II03 — La grande course des Relais

**Objectif :** gagner assez de points pour décrocher une promotion civique Fil. La course comporte trois secteurs : un marché aux auvents, une passerelle mobile et un réseau de cordages suspendus. Le joueur peut utiliser le Fil dans des passages isolés ; devant les juges, il doit respecter les règles. Le niveau prévoit un chemin légal gagnable sans triche — **la narration ne doit pas forcer le joueur à tricher pour réussir**.

À mi-course, une passerelle cède. Juno se retrouve isolée avec deux concurrents. Le héros peut continuer pour conserver la première place ou perdre du temps pour les aider. Dans les deux cas, un événement montre que certains mécanismes de sécurité ont été volontairement désactivés. Si le héros aide, Juno devient admirative. S'il préfère finir, elle le reconnaît comme compétiteur mais le questionne sur ses priorités ; le sauvetage est assuré par les organisateurs quelques instants plus tard. Aucun personnage ne meurt à cause d'un choix de course.

**JUNO, après l'arrivée si elle a été aidée :** « T'aurais pu gagner du temps. »

**HÉROS :** « Et te laisser là ? J'aurais dû t'entendre t'en plaindre pendant dix ans. »

**JUNO :** « Douze minimum. »

**Issue :** le héros remporte sa promotion Fil grâce aux points d'épreuves (un classement suffisamment bon suffit, il n'est pas nécessaire d'être premier chronométriquement). Le rang civique passe officiellement à **I — Fil**. Une séquence montre Lys, Nora et des habitants des Rives dans les gradins.

### II04 — Première ascension

Sur une terrasse, la cité basse apparaît loin sous le personnage. Le héros essaie son nouveau badge officiel. La musique est triomphale.

**HÉROS :** « Un rang. J'en ai monté un. »

**LYS :** « Fais attention, ton ego commence à dépasser les rambardes. »

**HÉROS :** « Laisse-moi profiter dix secondes. »

**LYS :** « Douze. Je suis généreuse. »

Juno remet discrètement au héros un élément de sécurité retrouvé sous la passerelle, portant l'emblème des **Fixateurs**. Elle propose de demander à Soren ce que ce matériel faisait là. **Nouvel enjeu clair :** quelqu'un manipule des équipements pendant les Épreuves, et le héros ne veut pas qu'une course se termine par un accident réel.

**Fin de chapitre :** Vaurel prononce un discours rassurant sur la sécurité de l'Ascension. Un très bref plan révèle qu'un assistant transporte des pièces identiques à celle récupérée par Juno.

---

## CHAPITRE III — LE FER ET LES HONNEURS

### III01 — Le Bastion et le tournoi

**Lieu :** Bastion de Fer. **Ambiance :** tambours, forges, foule de supporters, annonces tonitruantes, affrontements spectaculaires. Le joueur dispose d'un quartier à explorer : salles d'entraînement, gradins, réfectoire, forge et cour extérieure. Le tournoi permet aux Fils promus de tenter un **brevet temporaire d'accès** au rang Fer ; une promotion permanente n'est pas garantie.

Soren accueille le héros. Il est chargé de la sécurité du tournoi, mais n'apprécie pas les nouvelles consignes de surveillance.

**SOREN :** « Avant que tu demandes : non, je ne peux pas te faire gagner. »

**HÉROS :** « Je voulais demander où étaient les toilettes. »

**SOREN :** « Dans ce cas, je peux t'aider. C'est déjà une meilleure journée. »

### III02 — Leçon de combat

Un maître d'armes explique les bases. Le héros peut tenir réellement une **arme d'entraînement** et apprendre attaque, parade, esquive, verrouillage léger d'ennemi si pertinent, récupération et utilisation d'un objet. Le Fil sert à prendre de la distance ; le Cendre permet de casser la garde grâce à Braise. Les ennemis télégraphient leurs attaques.

Kaël entraîne les Fers et insiste sur un fait utile : « Ce qui gagne un duel, ce n'est pas un masque rare ; c'est de comprendre ce que l'autre va faire. »

**Gameplay obligatoire :** au moins un entraînement contre mannequin réactif, un duel contre combattant IA et une séquence d'esquive/parade. Ne pas remplacer les combats par une fenêtre de dialogue « Vous avez gagné ».

### III03 — Les trois manches de l'arène

Trois rencontres courtes, différentes :

1. **Duel mobile** contre un combattant Fil : prendre l'avantage en coupant sa trajectoire.
2. **Duel défensif** contre une Gardienne Fer : apprendre à identifier l'ouverture après une parade.
3. **Épreuve d'équipe** : protéger deux PNJ d'automates d'entraînement déréglés. La foule réagit aux réussites et aux erreurs ; l'action est vivante.

Pendant la troisième manche, un automate frappe avec une puissance anormale. Le héros utilise en urgence un Élan clandestin pour éviter une blessure à son coéquipier, devant quelques témoins. **L'Arbitre Miroir** observe depuis une loge masquée.

Soren coupe le système ; Kaël remarque la manœuvre et demande des explications.

**KAËL :** « Ce mouvement… Tu n'étais pas là où tu devais être. »

**HÉROS :** « J'ai bougé. C'est l'idée d'une esquive. »

**KAËL :** « Ne me prends pas pour un idiot. »

**SOREN, intervenant :** « Les deux champions auront tout le temps de se disputer après l'enquête. Là, j'ai une machine qui essaie de tuer des gens. »

### III04 — Duel avec Kaël

Kaël réclame un duel officiel pour décider du brevet de passage. Le combat doit être une **vraie confrontation de boss intermédiaire** : phase 1, frappes de Fer lisibles ; phase 2, ripostes et poussées ; phase 3, adaptation aux attaques répétées. Le joueur doit utiliser correctement mouvement, attaque et parade. La victoire du joueur mène à une cinématique où Kaël est mis à genoux mais se relève dignement. S'il perd, il peut retenter après conseils ; ne pas verrouiller la progression.

**KAËL :** « J'ai vu ce que tu as fait pendant l'épreuve. Tu portes autre chose que ton rang. »

**HÉROS :** « J'ai empêché quelqu'un de se faire écraser. »

**KAËL :** « Peut-être. Mais si tu joues avec deux trames, un jour tu risques d'emporter les autres avec toi. »

**HÉROS :** « Tu sais quoi ? J'en ai marre qu'on m'explique qu'un danger justifie toutes les interdictions. »

**KAËL :** « Et moi, j'en ai marre des gens qui croient que leur courage annule les risques. »

Aucun des deux n'a entièrement tort. Le héros reçoit un **brevet d'accès Fer provisoire**, le droit de fréquenter certains locaux, mais Kaël ne lui offre pas son amitié.

### III05 — L'incident du masque Miroir

Pendant la remise des prix, toutes les lumières s'éteignent. Un combattant inconnu apparaît ; son masque poli reflète le visage du héros. Il provoque volontairement un affrontement court et **imite** sa dernière capacité avec un délai d'une seconde. Le joueur peut bloquer et survivre ; ce n'est pas encore le boss complet.

La foule panique. Les Fixateurs arrivent trop vite, comme s'ils étaient prévenus. Vaurel accuse publiquement un « porteur de trames illégales » d'avoir déstabilisé l'arène. Il n'identifie pas encore formellement le héros, mais exige la remise des équipements suspects.

**VAUREL :** « Personne ne sera puni pour avoir demandé de l'aide. En revanche, je ne laisserai pas une expérience dangereuse recommencer au milieu d'une foule. »

**SOREN, bas, au héros :** « C'est le moment de sortir sans faire de bruit. Je n'ai rien vu. Pour l'instant. »

Lys et Juno organisent la fuite du héros par les couloirs de maintenance. **Gameplay :** poursuite active avec trois points de repli, obstacles, adversaires légers, Fil pour la mobilité et Braise sur des mécanismes. Ce n'est pas une simple cinématique de fuite.

### III06 — Un choix de confiance

Dans une planque des coursières, Lys veut couper momentanément l'accès au masque Fil ; elle craint pour la santé du héros. Juno propose une enquête. Le héros peut répondre sur un ton audacieux ou prudent ; cela modifie quelques répliques, pas la trame centrale.

**LYS :** « Tu as failli te faire arrêter. Et je ne sais toujours pas ce que ton bracelet fait à ton cerveau. »

**HÉROS :** « Je sais. J'aurais dû t'écouter. »

**JUNO :** « Profitez de ce moment, c'est peut-être la première fois qu'il le dit. »

**HÉROS :** « J'ai pas dit que j'allais le répéter. »

Juno montre la pièce trouvée sur la passerelle ; Soren en reconnaît la marque de contrôle. Tous trois concluent que l'incident de la course et celui de l'arène pourraient venir du même service. Leur piste mène à une archiviste des Terrasses de Verre : Éliane.

**Fin de chapitre :** le brevet Fer et un élément récupéré sur l'automate permettent à Lys de fabriquer un **masque Fer expérimental**, utilisable uniquement avec son ancre ; son mode Rempart se débloque au terme d'un entraînement dans la planque. Le héros n'est PAS officiellement promu Gardien.

---

## CHAPITRE IV — CE QUE MONTRE LE VERRE

### IV01 — Monter sans être vu

**Lieu :** accès des Terrasses de Verre. Le héros, Lys et Juno ne possèdent pas les autorisations permanentes. Le brevet provisoire Fer donne un accès restreint à une zone de livraison, mais pas aux archives. Ils choisissent l'entrée par les serres de livraison, dans une séquence combinant passages suspendus et petites énigmes de mécanique. Les Gardiens ne sont pas tous hostiles : certains posent des questions, d'autres signalent des rondes. Le joueur peut éviter des affrontements grâce aux outils et à la discrétion. **Ne pas rendre obligatoire un massacre de gardes innocents.**

**JUNO :** « Bonne nouvelle, j'ai trouvé une entrée. »

**HÉROS :** « Et la mauvaise ? »

**JUNO :** « C'est une sortie de déchets. »

**LYS :** « Tu m'avais promis qu'on ne repasserait plus par les ordures. »

**JUNO :** « J'ai dit que j'essaierais. C'est différent. »

### IV02 — Éliane, l'archiviste qui veut des preuves

**Lieu :** Observatoire des Prismes. Éliane reçoit le trio dans un atelier entouré de maquettes mouvantes et de vitres de lecture. Elle accepte d'aider lorsque Juno lui montre la pièce de sécurité et que Lys explique le phénomène des masques. Elle ne croit pas instantanément une histoire incroyable : elle demande un test contrôlé.

**ÉLIANE :** « Donc vous avez un Cendre qui porte le Fil, une pièce de Fixateur dans une course sabotée et un combattant qui copie les gestes. »

**HÉROS :** « Résumé comme ça, ça paraît un peu gros. »

**ÉLIANE :** « Ça l'est. Alors on va vérifier chaque morceau, un par un. »

Le test utilise une dalle ancienne : le héros alterne Cendre et Fil pendant qu'Éliane mesure la trame. Son ancre réduit fortement les interférences ; l'appareil retrouve un ancien protocole intitulé **ACCORD LIBRE**.

**ÉLIANE :** « Attendez… ce n'était pas interdit à l'origine. C'était enseigné. »

**LYS :** « Quoi ? »

**ÉLIANE :** « Le changement de masque. Il existait une méthode. Pas facile, pas sans risque… mais une méthode. »

**HÉROS :** « Donc on nous ment depuis toujours ? »

**ÉLIANE :** « Une partie de l'histoire a été cachée. La partie dangereuse, elle, est réelle. On va devoir comprendre les deux. »

### IV03 — La Galerie des Traces

Éliane remet au joueur une première version du **Masque de Verre**, non comme un grade officiel mais comme un instrument expérimental d'observation. Pour l'utiliser, Lys doit ajouter une troisième articulation à l'ancre. **Gameplay :** exploration d'une galerie de prismes ; le mode Révélation montre des traces de pas anciennes, des fissures de trame et des motifs invisibles à l'œil nu. Le joueur reconstitue l'itinéraire d'un convoyeur, aligne des projecteurs, évite des sentinelles lumineuses et découvre une cache.

Le puzzle contient trois conclusions explicitement compréhensibles :
1. La pièce retrouvée lors de la course a été activée **à distance** par les Fixateurs.
2. L'arène a subi le même type de sabotage.
3. Les deux incidents ont servi de **tests** pour une impulsion capable de forcer des masques à répondre simultanément.

Éliane fournit une explication orale claire, puis ces conclusions sont enregistrées dans le journal sous forme de phrases courtes, sans métaphores mystérieuses.

**HÉROS :** « Donc les accidents, c'étaient des essais ? »

**ÉLIANE :** « Oui. Quelqu'un a testé son signal sur la course, puis sur l'arène. »

**LYS :** « Et la prochaine fois, il le testera sur toute la ville. »

Un plan révèle l'échéance : la cérémonie du **Grand Accord**, dans deux jours, durant laquelle les masques sont traditionnellement synchronisés quelques secondes pour célébrer l'unité de Viremasque.

### IV04 — Ce qui s'est vraiment passé autrefois

Dans une salle d'archives audio-visuelles, le groupe retrouve un témoignage d'époque. Il ne faut PAS noyer le joueur sous vingt minutes de documents. Faire jouer une courte reconstitution interactive : le joueur circule dans une maquette lumineuse, active trois projections, puis déclenche une scène audio de 90 secondes.

Il y a vingt-huit ans, les premiers ateliers permettaient le changement de masque grâce à un accordage en duo : porteur et témoin-ancre. Lors d'une démonstration géante mal préparée, une surcharge a mélangé les trames de plusieurs centaines de porteurs. Certains ont perdu leurs repères, d'autres ont été blessés dans la panique. Vaurel, jeune ingénieur alors, a participé aux secours. Son traumatisme est réel. En prenant ensuite la tête des Fixateurs, il a imposé le **sceau permanent**, présenté comme la seule solution possible, et a fait supprimer l'enseignement de l'accordage. Les documents montrent aussi une seconde chose : **la catastrophe provenait d'une synchronisation forcée à grande échelle**, pas de chaque changement de masque individuel.

**ÉLIANE :** « Il y a eu un drame. Vaurel n'a pas inventé ça. »

**JUNO :** « Mais il a enterré la méthode qui aurait pu rendre les changements sûrs. »

**HÉROS :** « Parce que ça lui donnait le contrôle ? »

**ÉLIANE :** « Peut-être qu'il a commencé par avoir peur. Maintenant, il a surtout peur de perdre la main. »

### IV05 — Une conversation avec Maël

Le conseiller Maël surprend les intrus. Au lieu d'appeler immédiatement les gardes, il les emmène dans une serre fermée : il connaît les plans du Grand Accord, dont les paramètres lui semblaient anormalement puissants. D'abord méfiant, il reconnaît le numéro de série sur la pièce sabotée.

**MAËL :** « Si vous publiez ça sans preuve solide, Vaurel dira que vous voulez répéter la catastrophe. Et beaucoup de gens le croiront. »

**HÉROS :** « Alors on fait quoi ? On attend qu'il ait fini ? »

**MAËL :** « Non. On prend le plan de sa tour et on prouve ce qu'il veut vraiment activer. »

**JUNO :** « Voilà. C'est beaucoup mieux comme réponse. »

Maël livre les plans de la Fonderie de Trame. Il accepte de témoigner si un registre de commande signé est récupéré. Il ne remet pas un Masque d'Or au joueur à ce stade.

### IV06 — Première confrontation avec Vaurel

Le groupe traverse un laboratoire de calibration pour récupérer le registre. Au milieu, Vaurel les attend avec plusieurs gardes. Il n'a pas mis tous les gardes dans la confidence : il veut arrêter le héros et récupérer l'ancre. Il propose une discussion avant le combat.

**VAUREL :** « On m'a dit que tu portais plusieurs masques. Je voulais croire à une erreur. »

**HÉROS :** « On m'a dit que vos machines avaient failli tuer des gens. J'espérais aussi que c'était une erreur. »

**VAUREL :** « Tu connais la catastrophe d'il y a vingt-huit ans ? »

**HÉROS :** « Oui. Et je sais que vous avez caché comment l'éviter. »

**VAUREL :** « J'ai vu des familles ne plus reconnaître leurs proches. Je ne laisserai pas ça revenir. »

**HÉROS :** « Alors ne forcez pas toute la ville à faire la même chose en même temps ! »

**VAUREL, après une pause :** « Tu ne comprends pas. La ville n'a plus le temps. »

Révélation complémentaire : les vieux sceaux permanents s'usent ; des fissures de trame apparaissent. Vaurel prévoit une **Fixation Totale** au Grand Accord : un signal central qui stabiliserait tous les masques au prix d'une obéissance permanente aux attaches. Le porteur garderait ses souvenirs, mais les ordres de rang et les restrictions deviendraient littéralement impossibles à désobéir. Vaurel a volontairement provoqué des pannes limitées pour mesurer la force nécessaire. Sa solution éviterait peut-être un effondrement brutal, mais au prix d'une cité où personne ne peut choisir.

**VAUREL :** « Tu imagines que je fais ça par plaisir ? Les sceaux se dégradent. Si nous ne les stabilisons pas, une surcharge frappera la cité. »

**HÉROS :** « Alors dites-le aux gens. Donnez-leur le choix. »

**VAUREL :** « Ils paniqueraient. Et pendant qu'ils débattraient, tout s'écroulerait. »

Le joueur refuse de remettre l'ancre. Court affrontement contre un **Sentinelle de Trame**, pas encore Vaurel lui-même. Il faut utiliser Révélation pour détecter le point faible, Fil pour l'atteindre et Fer pour survivre à un choc, avec des indices clairs. Le groupe récupère une partie du registre, puis doit fuir. Vaurel ne les poursuit pas à pied : il déclenche l'alerte générale et avance la cérémonie de plusieurs heures.

### IV07 — Fin d'acte : une décision difficile

Retour aux Rives Basses. Lys, Éliane, Juno et Maël (à distance) discutent. Les preuves montrent que Vaurel mettra en danger la liberté des habitants mais qu'une panne des sceaux est également possible. **Il ne suffit pas de détruire la tour** : il faut proposer une solution de stabilisation.

**LYS :** « L'ancre marche sur toi. Pas sur mille personnes. »

**ÉLIANE :** « Les archives disent qu'on peut former des équipes d'accordage. Des porteurs reliés à des ancres locales, pas à un centre unique. »

**HÉROS :** « Combien d'équipes ? »

**ÉLIANE :** « Assez pour couvrir les quartiers. Fil, Fer, Verre, Or… et les Cendres. Surtout les Cendres. »

**NORA :** « Les Cendres savent réparer la moitié de cette ville. Tu n'auras pas besoin de nous supplier. »

Plan d'action clair : **(1) retrouver les ateliers-relais, (2) convaincre les rangs, (3) installer des ancres, (4) empêcher Vaurel d'activer la Fixation, (5) lancer un Grand Accord libre.** Le chapitre se termine par le héros posant un plan de ville sur l'établi et traçant cinq trajets. La musique repart, déterminée.

---

## CHAPITRE V — LA VILLE QUI REFUSE D'OBÉIR

### V01 — La réunion impossible

**Lieu :** grande halle des Rives Basses. Le joueur réunit ses alliés. La carte affiche **trois missions principales disponibles dans l'ordre souhaité**. Cette ouverture crée une vraie respiration et donne le sentiment de préparer une grande opération.

- **Mission Fil :** sécuriser les toits et leurs relais.
- **Mission Fer :** convaincre Soren et Kaël d'aider à défendre les civils.
- **Mission Verre / Or :** faire parvenir le registre authentifié à Maël et mobiliser les archivistes.

Le jeu ne doit pas exiger des quêtes répétitives du type « ramasse vingt objets quelconques ». Chaque mission est une scène d'action ou de décision différente.

**HÉROS :** « Bon, on a un plan. »

**LYS :** « On a quatre plans et un croquis fait sur une serviette. »

**JUNO :** « Le croquis est très convaincant. »

**NORA :** « Le croquis, c'est pour la liste des courses. »

Tout le monde rit brièvement, puis se met au travail.

### V02 — Mission Fil : la course des relais libres

**Gameplay :** grande séquence de traversée rapide des toits, escorter Juno et rallumer trois tours de signalisation en passant par des routes alternatives. Des drones mécaniques des Fixateurs barrent les passages. Le héros utilise Fil pour la mobilité, Fer pour protéger Juno et Cendre pour remettre les mécanismes en état.

Le joueur rencontre trois courriers qui refusent d'abord de se compromettre ; un bref défi de livraison urgent les convainc que les communications seraient coupées sous Fixation Totale. La scène s'achève par une **course-poursuite nocturne** au-dessus de la ville, bannières au vent, avec un saut final vers le dernier relais.

**JUNO :** « Tu te souviens de ma première règle ? »

**HÉROS :** « Regarder où je vais ! »

**JUNO :** « Là, exceptionnellement, ne regarde pas en bas ! »

Le réseau Fil accepte de transmettre le signal d'accordage libre. Les relais créent aussi des points de voyage rapide, utiles pour la suite.

### V03 — Mission Fer : le retour de Kaël

**Lieu :** caserne divisée. Les Gardiens ont reçu l'ordre de saisir les « masques irréguliers ». Soren bloque les arrestations arbitraires autant qu'il le peut, mais il a besoin d'une preuve publique et de l'appui d'un champion respecté.

Kaël refuse d'abord d'aider le héros : il a vu les effets d'un mauvais accordage sur sa sœur, **Nina**, toujours vivante mais sujette à des crises de confusion. Le héros ne minimise pas cette histoire. **Scène obligatoire de conversation calme**, sans changer instantanément Kaël d'avis.

**KAËL :** « Ma sœur a essayé un masque qui n'était pas le sien. Un atelier lui avait promis que ce serait sans danger. Elle a passé des mois à ne plus reconnaître les gens. Alors excuse-moi de ne pas applaudir quand tu dis que tout le monde doit pouvoir changer. »

**HÉROS :** « Je ne te demande pas d'applaudir. Je te demande de regarder ce que Vaurel prépare. Il veut imposer son signal à toute la ville. »

**KAËL :** « Et toi, tu proposes quoi ? »

**HÉROS :** « Qu'on ne force personne. Qu'on répare les sceaux qui lâchent et qu'on laisse le choix à ceux qui veulent apprendre. Avec des gens formés, avec des précautions. »

**KAËL :** « …Ça, au moins, c'est une réponse. »

Pour convaincre les Gardiens, le héros doit aider Kaël à sauver des apprentis bloqués dans un dépôt de trame instable. **Gameplay :** combat défensif contre automates, vagues limitées, protection de civils, Kaël combattant allié actif. À la fin, Nina elle-même remercie les deux héros ; elle déclare qu'elle veut pouvoir choisir un jour sans qu'on la pousse.

**NINA :** « Je ne sais pas si je remettrai un autre masque. Mais j'aimerais que ce soit ma décision. »

Kaël offre son aide et reconnaît son tort d'avoir laissé Vaurel confondre danger et interdiction permanente.

**KAËL :** « Je ne retire pas ce que j'ai dit sur l'imprudence. »

**HÉROS :** « Je n'espérais pas tant. »

**KAËL :** « Mais si quelqu'un doit arrêter Vaurel, j'aimerais être là pour vérifier que tu ne fais pas n'importe quoi. »

**HÉROS :** « Ça ressemble presque à une amitié. »

**KAËL :** « N'exagérons rien. »

Les Gardiens de Soren promettent de protéger les quartiers et de ne pas réprimer les habitants qui participent volontairement aux ancres.

### V04 — Mission Verre / Or : montrer les preuves

**Lieu :** Terrasses de Verre puis jardins d'Or. Éliane authentifie le registre en révélant des signatures de trame. Le joueur utilise Verre pour identifier trois contre-scellés cachés dans l'architecture d'une salle d'archives : mini-enquête active et concise.

Maël convoque une petite assemblée de guildes. **Scène de confrontation publique**, claire et vive : Vaurel n'est pas présent, mais son porte-parole essaie de discréditer les preuves. Le héros n'a pas à choisir un long discours politique ; il présente les trois faits vérifiés, dans l'ordre : sabotage des Épreuves, tests sur la foule, projet de Fixation Totale. L'assemblée se divise ; quelques guildes refusent, d'autres soutiennent une solution libre.

**PORTE-PAROLE :** « Vous proposez d'abandonner le seul système qui nous protège ! »

**ÉLIANE :** « Non. Nous proposons de le réparer sans installer un dispositif qui force les citoyens à obéir. Voici les schémas. »

**MAËL :** « Moi aussi, j'ai signé des règlements absurdes. Cette fois, je refuse de signer le silence. »

Le joueur reçoit de Maël l'accès à une **trame d'Or défensive**, destinée à protéger des groupes d'habitants. Le héros ne gagne pas une noblesse automatique : le **masque d'Or provisoire** fonctionne dans son ancre comme équipement, mais son rang civique n'est pas promu à IV.

**Gameplay :** initiation au **Ralliement** : poser un bouclier collectif autour de trois personnages pendant une démonstration d'impulsion de trame.

### V05 — Le prix de la confiance

Quand les trois alliances principales sont acquises, Vaurel réagit. Ses agents coupent l'alimentation de l'atelier des Rives et viennent saisir les ancres fabriquées par Lys. Elle se présente volontairement aux Fixateurs avec un prototype incomplet pour les détourner des véritables ancres déjà distribuées. **Elle n'est pas capturée parce qu'elle serait stupide** : elle a élaboré son plan avec Nora, mais ne l'a pas partagé avec le héros, craignant qu'il cherche à l'empêcher de prendre le risque.

**LYS, en laissant un message :** « Si tu regardes ça, c'est que mon plan a marché à moitié. Les vraies ancres sont parties. Celle qu'ils prennent est vide. Et non, tu n'as pas le droit de râler avant de venir me chercher. »

Le héros se reproche de ne pas l'avoir protégée. Nora refuse qu'il se perde en culpabilité :

**NORA :** « Lys a fait un choix. Respecte-le. Maintenant, fais en sorte qu'elle puisse rentrer pour qu'on se dispute tous ensemble. »

**Objectif :** infiltrer la Fonderie de Trame pour libérer Lys et désactiver les relais de Fixation.

### V06 — La Fonderie : infiltration puis bataille

**Lieu :** usine monumentale sous les quartiers supérieurs. Le trajet est une véritable séquence multi-mécanique :

1. **Fil :** traverser des chaînes suspendues et éviter les convoyeurs.
2. **Verre :** voir les circuits de sécurité et découvrir les passages sûrs.
3. **Cendre :** réparer un inverseur et rediriger une énergie industrielle.
4. **Fer :** tenir une passerelle pendant le passage de Juno et Soren.
5. **Or :** protéger des ouvriers contraints de maintenir le réseau.

Les ennemis sont composés de sentinelles mécaniques, de quelques Fixateurs volontaires et du programme Miroir. Beaucoup d'ouvriers sont des innocents : ils fuient ou aident le groupe une fois libérés des ordres.

**Boss : L'ARBITRE MIROIR, version complète.** Arène circulaire au milieu d'engrenages. Il peut reproduire avec un délai visible **une** technique employée par le joueur. Le bon plan n'est pas de taper plus fort mais de changer intelligemment de masque : feindre une frappe Braise, provoquer son Reflet, contourner grâce au Fil puis briser son bouclier avec une riposte Fer. Avec Verre, voir la trame fragile. Trois phases, points de contrôle justes, gestes télégraphiés.

À sa défaite, le masque Miroir se fissure, dévoilant le visage fatigué d'un jeune adulte forcé de combattre par les impulsions de Vaurel. Le joueur peut choisir **« Coupe le signal »** (choix recommandé par les compagnons) ou **« Désarme-le et attache-le »**. Dans les deux cas il survit ; la première option améliore légèrement les renforts finaux, la seconde entraîne une brève reconnaissance ultérieure. Pas de punition disproportionnée pour un choix non anticipé.

**ARBITRE :** « J'entendais… chaque ordre comme si c'était ma propre pensée. »

**HÉROS :** « C'est fini. T'as plus à te battre pour lui. »

### V07 — Sauver Lys, sans annuler ses actions

Le groupe retrouve Lys dans une salle de calibration. Elle a réussi à saboter l'appareil qui lisait son faux prototype, mais Vaurel a déjà transféré le véritable noyau vers la Tour. Le héros l'aide à désactiver le champ qui la retient ; petite énigme de synchronisation à deux, avec les actions de Lys en parallèle.

**HÉROS :** « La prochaine fois, tu me dis quand tu décides de te faire arrêter ! »

**LYS :** « La prochaine fois, tu me dis quand tu décides d'affronter une ville entière ! »

**HÉROS :** « C'est un peu différent ! »

**LYS :** « Oui. Moi, j'avais un plan. »

Lys révèle un dernier élément crucial : la Fixation Totale va provoquer une **surcharge** si tous les quartiers ne sont pas stabilisés par des relais locaux. L'équipe a désormais assez d'ancres, mais il faut les activer pendant la cérémonie. Vaurel lance l'alerte générale et fait sonner toutes les cloches de la ville.

### V08 — La ville se soulève… pour se protéger

**Grande séquence finale du chapitre :** les alliés défendent les cinq relais locaux tandis qu'une impulsion neutralise temporairement certaines capacités. Pas de guerre générique avec cent PNJ factices : faire une bataille lisible en trois secteurs représentatifs, chaque secteur ayant un enjeu clair : protéger des civils, réalimenter une ancre et repousser une sentinelle. Les alliés sont visibles en action : Juno traverse les toits ; Kaël et Soren défendent le Bastion ; Éliane pilote les signaux ; Maël affronte publiquement ses pairs ; Nora et les ouvriers tiennent la base des Rives.

**Montage croisé, répliques au contact :**

**SOREN :** « Personne ne touche aux habitants ! Les ordres viennent de moi maintenant ! »

**JUNO :** « Relais trois allumé ! Et j'ai battu mon record ! »

**KAËL :** « Tu comptes les secondes ou tu combats ? »

**JUNO :** « Je peux faire les deux ! »

**NORA :** « Rives Basses, prêts ! »

**LYS, au héros :** « Les ancres tiennent. Il manque encore la source. »

Le ciel au-dessus de Viremasque se couvre d'un réseau lumineux qui converge vers la Tour de l'Accord. **Fin de chapitre sur le départ de l'équipe**, pas sur une victoire finale prématurée.

---

## CHAPITRE VI — LE DERNIER VISAGE

### VI01 — Avant la montée

**Lieu :** toit du dernier relais, juste avant l'aube. Courte scène calme et optimiste, nécessaire après l'action. Les compagnons vérifient leur équipement. Le héros doit confirmer qu'il est prêt ; possibilité de revenir aux quartiers pour activités secondaires et amélioration d'équipement. **Pas de point de non-retour caché.**

**KAËL :** « Tu sais, je pensais que tu étais un petit malin qui voulait brûler les étapes. »

**HÉROS :** « Je suis un petit malin qui veut brûler les étapes. »

**KAËL :** « Oui. Mais tu n'es plus seulement ça. »

**JUNO :** « C'est presque touchant. Vous voulez que je vous laisse cinq minutes ? »

**LYS :** « Non. Si on attend encore, ils vont se mettre à se serrer la main. »

Le joueur choisit : « On y va. »

### VI02 — L'ascension de la Tour

**Gameplay :** grande traversée verticale de la Tour de l'Accord. C'est l'aboutissement des mécaniques de masque, non un couloir jusqu'au boss. Quatre segments distincts, chacun avec courte montée dramatique :

- **Salle des braises :** mécanismes à réparer sous pression. Cendre.
- **Ponts du vent :** plateformes mouvantes et accroches suspendues. Fil.
- **Anneau des gardiens :** ennemis aux attaques télégraphiées et mur d'énergie à contenir. Fer.
- **Dôme des reflets :** illusions de trajets ; la bonne voie n'apparaît qu'avec Verre, puis Or protège des alliés traversant une impulsion.

Les masques ne doivent pas être de simples clés de couleur ; chaque étape exige l'action spécifique déjà apprise. Les alliés interviennent parfois depuis une autre route. Sauvegardes/points de reprise après chaque segment.

### VI03 — Face à Vaurel

**Lieu :** sommet de la Tour, au centre du réseau. Le ciel au-dessus de la ville est traversé d'arcs de trame ; les cinq quartiers apparaissent en contrebas. Vaurel se tient au centre d'une gigantesque roue de masques. Il a vu le signal libre des relais et sait que le héros a trouvé une alternative, mais craint qu'elle ne tienne pas.

**VAUREL :** « Tu as réussi à réunir les quartiers. Je n'aurais pas cru cela possible. »

**HÉROS :** « Ils n'avaient pas besoin de moi pour vouloir vivre libres. Ils avaient besoin qu'on leur donne une chance. »

**VAUREL :** « Tu as eu deux jours pour convaincre une foule. Moi, j'ai passé vingt-huit ans à empêcher une nouvelle catastrophe. »

**HÉROS :** « Vous avez sauvé des gens. Puis vous avez décidé que ça vous donnait le droit de choisir pour tous les autres. »

**VAUREL :** « S'ils refusent la sécurité, c'est moi qui porterai les conséquences. »

**HÉROS :** « Non. Vous les leur imposez. C'est ça, le problème. »

Vaurel montre les indicateurs : la trame centrale est instable. **Vérité dramatique** : si l'on détruit brutalement la roue, la ville subira la surcharge qu'il redoute. Il offre au héros une dernière fois de l'aider à activer la Fixation. Le héros refuse le choix entre catastrophe et soumission, et propose de transférer la charge vers les relais consentants.

**LYS, dans le communicateur :** « Les ancres locales sont prêtes. Il nous faut seulement un moyen de les synchroniser depuis là-haut. »

**VAUREL :** « Tes amis ne comprennent pas ce qu'ils risquent. »

**HÉROS :** « Ils le savent. C'est leur choix. »

Vaurel active la défense de la Tour pour empêcher l'opération. **Début du boss final.**

### VI04 — Boss final, phase 1 : LA MAIN QUI FIXE

Vaurel utilise un grand masque de Fixateur, blanc et cuivre, relié à l'anneau central. Il ne se bat pas comme un grand sac de points de vie ; ses attaques incarnent le contrôle :

- **Ordre de Fer :** onde frontale imposant une garde rigide ; le joueur doit parer puis riposter.
- **Lien de Fil :** chaînes lumineuses qui emprisonnent une zone ; esquive au moment lisible et déplacement.
- **Braise inversée :** le sol chauffe autour de bornes ; réparer/inverser les bornes Cendre révèle une ouverture.

La première phase consiste à détruire trois **ancrages de contrôle**, non à réduire une barre absurde. Dialogue court en combat, pas de phrases longues impossibles à suivre.

**VAUREL :** « Tu ne vois que les chaînes. Moi, je vois les gens qu'elles ont sauvés. »

**HÉROS :** « Une chaîne qui ne s'ouvre jamais reste une chaîne ! »

### VI05 — Boss final, phase 2 : LE CHŒUR FORCÉ

Vaurel branche plusieurs masques anciens au réseau. Des silhouettes de trame imitent les pouvoirs de différents rangs ; l'arène change de configuration. **Verre** révèle lequel des doubles conduit réellement le signal ; **Fil** permet d'atteindre une plateforme ; **Fer** de renvoyer une impulsion ; **Or** de protéger les compagnons qui montent poser les relais. Lys rejoint une console latérale, Kaël et Juno défendent la montée.

**LYS :** « J'ai ouvert le canal ! Donne-moi quinze secondes ! »

**KAËL :** « On peut tenir quinze secondes ! »

**JUNO :** « Seize même, si tu demandes poliment ! »

Le joueur tient une séquence d'assaut à durée limitée souple, avec progression visible. Si une défense tombe, l'allié recule et demande de l'aide ; on ne tue pas un personnage majeur sans possibilité de prévenir ni de rejouer.

### VI06 — Boss final, phase 3 : L'ACCORD LIBRE

La roue se brise partiellement et menace de décharger toute son énergie. Vaurel tombe à genoux, perd le contrôle de son propre masque. Il n'est plus un « monstre ultime » : il est un homme dépassé par le système qu'il a construit.

Le héros ne peut stabiliser la ville en enfilant simplement un masque légendaire. Il doit **coordonner volontairement les cinq relais de quartier** et utiliser chacun de ses pouvoirs pour leur donner le temps d'absorber la charge. Le HUD montre clairement la progression de chaque quartier ; des voix connues répondent par le communicateur :

**NORA :** « Rives Basses prêtes ! »

**JUNO :** « Toits du Fil prêts ! »

**SOREN :** « Bastion prêt ! »

**ÉLIANE :** « Terrasses prêtes ! »

**MAËL :** « Jardins d'Or prêts ! »

**LYS :** « Maintenant ! Accorde-les, pas tous d'un coup : un par un ! »

**Gameplay final :** mini-parcours circulaire à cinq postes. À chaque poste, le joueur active un relais à l'aide du pouvoir correspondant, résiste à une dernière impulsion et entend un quartier confirmer son choix. Le dernier geste ne requiert aucun masque particulier : le héros retire le sien, pose sa main nue sur la console et confirme **« Lancer l'Accord libre »**. Ce geste est symbolique, mais le système gagne parce que les relais sont installés et les gens ont participé, pas grâce à une magie inexpliquée du protagoniste.

Une grande onde lumineuse traverse la ville. Les sceaux ne disparaissent pas instantanément ; ils sont **stabilisés sans verrouillage central**, avec une possibilité future d'apprendre l'accordage. L'orage de trame se dissipe. La lumière du matin apparaît entre les masques flottants. Musique triomphale. Les gens s'acclament depuis leurs quartiers.

### VI07 — Le choix concernant Vaurel

Vaurel est désarmé. Soren arrive avec des Gardiens prêts à l'arrêter. Le joueur a un **choix de posture**, qui modifie le dialogue et l'épilogue sans casser la conclusion :

**A. « Qu'il réponde de ses actes. »** Le héros exige un procès public. Vaurel accepte finalement qu'un conseil réunissant tous les quartiers examine ses crimes et les risques techniques qu'il a identifiés.

**B. « Qu'il aide d'abord à réparer. »** Le héros insiste pour que Vaurel transmette immédiatement ses connaissances sous surveillance, avant son procès. Soren impose qu'il ne puisse plus toucher seul à une commande.

Dans les deux cas, Vaurel n'est pas simplement pardonné, ni exécuté par le héros. Il doit rendre des comptes pour les sabotages, les mensonges et les blessures causées. Sa compétence peut encore servir à réparer la ville, sous contrôle partagé.

**VAUREL :** « Tu crois que ça suffira ? Que les gens sauront vivre sans une main qui décide ? »

**HÉROS :** « Pas toujours. Mais ils auront le droit d'essayer. »

### VI08 — Un nouveau visage, une même ville

**Cinématique :** célébration sur la grande place. Les Cendres montent pour la première fois à la cérémonie non comme personnels de service mais comme représentants des ateliers. Juno fait la course avec des jeunes apprentis ; Kaël organise un entraînement ouvert ; Éliane annonce la création d'une école d'accordage supervisée ; Maël présente l'ouverture progressive des concours à tous les rangs. Les changements sociaux ne sont pas magiques : des conservateurs protestent, certains habitants restent inquiets, des travaux sont nécessaires. Mais la direction change réellement.

Le héros reçoit un **permis d'Ascension honorifique** et la possibilité d'intégrer une guilde supérieure. Il répond qu'il réfléchira à sa carrière après avoir fêté sa victoire chez lui. Il ne devient pas roi ou propriétaire de toutes les capacités de la ville.

**JUNO :** « Alors, champion, tu montes chez les grands ? »

**HÉROS :** « Je vais surtout manger chez Nora. Les grands attendront. »

**KAËL :** « Je t'offre une revanche à l'arène. Sans triche cette fois. »

**HÉROS :** « Tu as peur de perdre une deuxième fois ? »

**KAËL :** « Je te laisse cinq minutes d'avance, si ça peut te rassurer. »

**LYS :** « Vous êtes épuisants tous les deux. »

**NORA, arrivant :** « Très bien. Tout le monde à table avant que le héros se mette à faire un discours. »

**FIN de l'histoire principale.** Le joueur peut ensuite se déplacer librement dans une ville légèrement transformée, refaire des épreuves optionnelles, améliorer l'équipement, visiter les lieux débloqués et accomplir quelques missions de reconstruction.

---

## ÉPILOGUE — SANS DEMANDER LA PERMISSION

### E01 — De retour à la maison

**Lieu :** chambre du héros, plusieurs jours plus tard. Ce n'est PAS un réveil dans un nouveau monde. Il accroche les masques qu'il a appris à utiliser. À travers la fenêtre, une petite délégation de différents rangs travaille ensemble au nouveau monte-charge. Les Rives sont toujours animées. Lys entre sans frapper, comme toujours.

**LYS :** « Alors ? C'est quoi, le prochain grand projet du champion ? »

**HÉROS :** « Dormir. Une semaine. »

**LYS :** « Mauvaise nouvelle : le monte-charge fait encore un bruit bizarre. »

**HÉROS :** « C'est une plaisanterie ? »

**LYS :** « Peut-être. »

Elle pose une enveloppe sur la table. Les Épreuves de l'année suivante seront ouvertes à tous les rangs, sans exigence de parrainage pour les Cendres. Il sourit.

**HÉROS :** « Tu sais, je voulais juste monter d'un rang. »

**LYS :** « Et t'as réussi à compliquer la vie de tout le conseil. Je suis fière de toi. Un peu. »

Les deux descendent aider à l'atelier. **Dernier plan principal :** le héros court à travers la ville avec un nouveau masque d'atelier, rejoint ses amis et disparaît dans une foule joyeuse. Générique.

### E02 — Scène optionnelle après le générique : un fil plus vaste

Courte scène, 20 à 35 secondes, **sans remettre en cause l'identité locale du héros**. Pendant que l'atelier est vide, le bracelet-ancre s'allume faiblement. Une minuscule forme géométrique apparaît entre deux reflets : le même motif peut exister dans d'autres civilisations, mais il est présenté ici pour la première fois comme une curiosité visuelle. Aucun personnage ne dit « tu viens d'un autre univers » ; aucune perte de mémoire ; aucun portail n'aspire le héros.

Une ligne, écrite sur l'ancienne face interne du masque Cendre, n'était pas visible auparavant : **« Quand tu sauras choisir ton visage, regarde au-delà du cadre. »**

Cette phrase doit rester **facultative, discrète et ouverte**. Elle peut être modifiée plus tard si le canon du multivers l'exige. **Ne pas promettre automatiquement une suite ni forcer une explication globale.**

---

# 7. QUÊTES SECONDAIRES CONÇUES POUR RENFORCER L'AVENTURE

Les quêtes secondaires ne sont pas nécessaires pour comprendre le scénario central. Elles doivent néanmoins avoir un petit arc narratif et des récompenses utiles. Elles alimentent la chaleur et la diversité du monde. Proposer des conséquences mineures visibles dans la ville et quelques répliques de fin.

## Q1 — « Le meilleur chariot du quartier » (Rives Basses, 10–15 min)

Nora veut participer au concours annuel de transport, mais son vieux chariot perd une roue à chaque virage. Le héros cherche trois composants auprès de voisins, choisit entre stabilité et vitesse, puis teste un parcours court. **Récompense :** amélioration de la frappe Braise contre mécanismes fragiles, décoration permanente de l'atelier, scène comique pendant l'épilogue. **Ton :** jovial.

**NORA :** « Si ton chariot arrive entier, je le considère comme une victoire. »

## Q2 — « La lettre au mauvais toit » (Toits du Fil, 10–15 min)

Une jeune coursière a livré une lettre de félicitations au mauvais destinataire et n'ose pas l'avouer. Le héros fait une mini-enquête de parcours, retrouve la lettre, puis choisit d'aider la coursière à reconnaître son erreur ou de réparer la situation sans humiliation. **Récompense :** point d'accroche supplémentaire dans les Toits et réduction légère de surcharge Fil. **Ton :** léger, tendre, pas mélodramatique.

## Q3 — « À armes égales » (Bastion de Fer, 15–20 min)

Une recrue de Fer n'arrive pas à parer parce que son masque est mal ajusté. Kaël pense qu'elle manque d'entraînement ; le héros et Lys repèrent le vrai défaut. Deux combats d'entraînement et réparation. **Récompense :** parade améliorée et phrase de soutien de Kaël pendant la bataille.

## Q4 — « La vitre qui ment » (Terrasses de Verre, 15–20 min)

Éliane demande de restaurer trois vitres de lecture dont les reflets ont été falsifiés pour favoriser une famille marchande. Le joueur remonte la piste à l'aide de Révélation, négocie avec le coupable et décide de rendre les documents publics ou de proposer restitution et réparation. **Récompense :** meilleure durée de Révélation et une affiche publique mentionnant l'enquête.

## Q5 — « Un masque pour demain » (Jardins d'Or / Rives, 15–20 min)

Un artisan d'Or souhaite former des apprentis Cendre mais sa guilde exige un concours officiel. Le joueur aide à organiser une démonstration de talents mêlant plusieurs rangs. **Récompense :** renfort visuel supplémentaire pendant VI05 et réduction mineure du temps d'activation d'Or. La quête montre que la réforme a des soutiens avant même la victoire finale.

**Important :** une quête secondaire jamais accomplie ne doit pas empêcher l'histoire principale. Les récompenses offrent de la variété, sans être indispensables pour battre Vaurel.

---

# 8. ÉQUIPEMENT, COMBATS ET PROGRESSION

## 8.1 Objets visibles et utilisables

Minimum requis pour cette aventure :

- **Clé d'atelier** : tenue en main, sert réellement à activer/réparer des dispositifs.
- **Marteau de Cendre** : arme courte à attaque légère et charge Braise ; silhouette d'outil crédible.
- **Gants de Fil** : poignée/ruban visible à l'écran ; marque un point d'accroche, exécute Élan.
- **Bouclier de Fer** : équipement défensif avec animation de parade et riposte.
- **Lentille de Verre** : objet présenté devant le champ de vision lors de Révélation, mettant en évidence les traces.
- **Sceau d'Or** : objet tenue en main lors du lancement de Ralliement ; effet de protection visible autour des alliés.
- **Masques eux-mêmes** : modèles 3D distincts ; déblocage, examen dans l'inventaire, équipement, changement avec animation et effet sonore dédié.
- **Bracelet-ancre** : objet-clé visuel, améliorable, qui gère surcharge et changement.

Les armes et pouvoirs doivent avoir un retour clair : impact, son, animation, réaction de l'ennemi, cooldown et ressources si nécessaire. Pas d'armes seulement cosmétiques ni d'« inventaire musée ».

## 8.2 Types d'ennemis et comportements

1. **Automate de surveillance** : avance puis frappe en ligne, facile à esquiver.
2. **Intercepteur Fil** : très mobile, vulnérable après sa charge.
3. **Sentinelle Fer** : bloque frontalement, vulnérable à contournement / rupture de garde.
4. **Prisme de Verre** : crée une fausse cible, révélée par la lentille.
5. **Drone de Fixation** : projette des ondes qui ralentissent temporairement l'utilisation du masque.
6. **Arbitre Miroir** : boss copieur, combat spécifique.
7. **Vaurel, masque de Fixateur** : boss final multi-systèmes.

Des PNJ civils ne doivent pas devenir des cibles. Si le moteur gère les dégâts aux humains, prévoir des réactions et des limites claires ; l'aventure ne doit pas punir arbitrairement une erreur de ciblage par une défaite narrative irréversible.

## 8.3 La boucle de combat

**Lire l'attaque → esquiver ou bloquer → créer une ouverture → utiliser une propriété propre à un masque → changer si utile → riposter.** Les premiers ennemis enseignent cette boucle ; les boss testent des combinaisons. La difficulté initiale doit être accessible ; proposer au moins un mode plus indulgent et les indices nécessaires aux combats d'énigme. Pas de dégâts invisibles, pas de stunlock permanent.

## 8.4 Progression maîtrisée

Le joueur ne doit pas tout obtenir en une heure. Les paliers majeurs sont :

- P00 : Cendre / Braise et outil de réparation.
- II02 : Fil / Élan et ancre de changement.
- III06 : Fer / Rempart.
- IV03 : Verre / Révélation.
- V04 : Or / Ralliement.
- VI06 : Accord libre collectif (résolution narrative, pas superpouvoir utilisable à l'infini).

Les changements du HUD doivent suivre exactement ces déblocages, sans spoilers sur les rangs secrets. Les promotions civiques restent indépendantes.

---

# 9. MUSIQUE, HUMOUR ET RYTHME CINÉMATOGRAPHIQUE

**Direction émotionnelle :** aventure entraînante d'abord ; tension et gravité lorsque nécessaires ; triomphe et espoir au final. Ne pas écrire l'ensemble comme une tragédie. Les personnages ont des liens sincères, se chambrent, mangent, travaillent, rivalisent et se retrouvent.

Thèmes musicaux suggérés (composer des morceaux originaux ou utiliser des sources légalement autorisées) :

- **Rives Basses :** rythme d'atelier lumineux, percussions douces et mélodie mémorable.
- **Toits du Fil :** tempo rapide, cordes pincées / percussions, sentiment de liberté.
- **Bastion de Fer :** fanfares, tambours, énergie de stade et acclamations.
- **Terrasses de Verre :** sonorités claires et mobiles, curiosité plutôt que tristesse.
- **Fonderies :** pulsations mécaniques et montée de tension.
- **Tour / final :** variations héroïques du thème des Rives, puis grand thème collectif d'accordage.

**Ambiances sonores :** marché vivant, marteaux, eau, cloches, public du tournoi, bruit du vent au-dessus des toits, moteurs industriels, foule dans la dernière bataille. La musique doit changer selon exploration, poursuite, menace, victoire et cinématique.

**Règle d'écriture des dialogues :** utiliser le français oral et intelligible. Les phrases très solennelles sont réservées aux discours publics de Vaurel ou à certaines cérémonies, pas à chaque garde et marchand. Éviter le vocabulaire pseudo-mystique non expliqué. Préférer : « Il veut bloquer tous les masques. » à « Il scellera le destin des visages au sein de la trame immuable. » Les héros peuvent plaisanter dans les pauses, mais ne doivent pas faire des blagues pendant une blessure grave ou au détriment d'une personne vulnérable.

**Règle de compréhension :** après chaque révélation, le journal doit offrir au joueur trois lignes simples : **ce qu'on a appris**, **ce que ça change**, **ce qu'on va faire**. Les mystères doivent porter sur les événements à venir, pas sur la lisibilité des phrases.

---

# 10. CHOIX, CONSÉQUENCES ET FINS

L'histoire possède **une fin principale canonique** : Vaurel échoue, la ville évite la surcharge, un accordage libre encadré devient possible et les rangs commencent à se réformer. Les choix personnels changent des scènes, des relations et quelques moments de l'épilogue, **pas la cohérence de cette conclusion**.

Choix réactifs recommandés :

| Décision | Conséquence immédiate | Écho ultérieur |
|---|---|---|
| Course II03 : secourir Juno ou terminer le parcours | Réaction de Juno / chrono | Réplique de Juno au final |
| III06 : répondre avec bravade ou prudence à Lys | Ton de la conversation | Petite allusion dans le chapitre V |
| V06 : libérer l'Arbitre ou le désarmer en le gardant sous contrôle | Sa première réaction | Variante de renfort ou de dialogue |
| VI07 : demander procès immédiat ou réparation préalable sous surveillance | Dialogue avec Soren et Vaurel | Brève scène d'épilogue |
| Quêtes secondaires | Améliorations et rencontres | Personnages visibles lors des célébrations |

Ne pas cacher des conditions majeures sans avertissement. Pas de « mauvaise fin » punitive parce que le joueur a raté un mini-jeu de livraison au début. Les principales émotions viennent de l'arc des personnages et des événements, non d'une prolifération de fins sans contenu.

---

# 11. CONTRAINTES D'IMPLÉMENTATION POUR CLAUDE CODE

Cette section complète le scénario ; elle ne remplace pas la conception du moteur.

**11.1 Préserver le projet**
- Ajouter Mask Civilization sous la forme d'un **nouveau Civilization Pack indépendant**.
- **Ne pas modifier l'intrigue, les dialogues ou les cartes des prototypes Door et Memory.**
- Ne pas supprimer les sauvegardes, les scènes, les assets ou les composants existants.
- Étendre le SDK, l'inventaire, le combat, les cinématiques et Civilization Studio proprement lorsque les nouvelles mécaniques l'exigent ; éviter les contournements propres uniquement à ce pack.
- Versionner les données, ajouter des tests et vérifier l'absence de régressions.

**11.2 Langue**
- **100 % du contenu montré au joueur en français**, y compris UI, rangs, objets, options, dialogues, journal, quêtes, instructions, boss, succès et sous-titres.
- Code et identifiants internes possibles en anglais ; chaîne affichée toujours française.
- Pas de traduction automatique maladroite : écrire et relire des phrases naturelles.

**11.3 Différence visuelle et mécanique**
- Construire une ville verticale et vivante, avec des **zones réellement différentes**.
- Créer des textures, silhouettes, modules de bâtiments, accessoires et ambiances propres au monde des masques. Réutiliser l'infrastructure technique, **pas l'apparence des anciennes civilisations**.
- La première personne et les interactions doivent être satisfaisantes : inventaire qui équipe, objets tenus en main, vrais combats, vraies réactions ennemies, musique dynamique, progression lisible.
- Ne pas créer uniquement une succession de boîtes de dialogue dans des couloirs.

**11.4 Contenu jouable**
- Chaque scène décrite ci-dessus doit avoir des conditions de début et de fin, une localisation, les PNJ requis, des interactions et un résultat testable.
- Conserver les dialogues clés fournis ici ; les lignes secondaires peuvent être enrichies sans changer les motivations ni les explications.
- Construire des parcours et affrontements réels pour les poursuites, épreuves, combats et boss. Prévoir des tutoriels contextualisés et de vrais contrôles.
- Installer des points de sauvegarde, de reprise et de retour avant les séquences longues. Vérifier que les objets et NPC requis réapparaissent correctement après chargement.
- Si le temps ou les ressources ne permettent pas de terminer la grande campagne en un seul passage, livrer un **chapitre jouable terminé à la fois**, avec suivi des tâches, plutôt qu'une fausse aventure entière vide de contenu.

**11.5 Validation d'écriture**
- À la fin de chaque chapitre, un testeur doit pouvoir répondre sans hésiter à ces trois questions : « Qu'est-ce que je voulais faire ? », « Qu'ai-je appris ? », « Quel est mon prochain objectif ? »
- Contrôler que les quêtes respectent les motivations ; ne pas donner au héros une amnésie soudaine, un passé secret inventé ou une prophétie qui remplace son histoire locale.
- Chaque personnage doit avoir une façon de parler reconnaissable, et les révélations doivent correspondre aux indices plantés précédemment.

---

# 12. TABLE DES ÉVÉNEMENTS ET DES ÉTATS — POUR LE SCRIPTING

Pour permettre à Opus de produire des quêtes fiables, utiliser des IDs stables ou leur équivalent dans le projet. Ce tableau décrit les **points structurants** ; les sous-objectifs locaux peuvent être ajoutés librement.

| ID | Déclencheur | Conséquence obligatoire |
|---|---|---|
| `mask.prologue.workshop_repaired` | roue réparée | active l'incident du monte-charge |
| `mask.prologue.lift_saved` | incident résolu | Juno propose le relais de candidature |
| `mask.ch1.proofs_complete` | 3 preuves validées | qualification ouverte |
| `mask.ch1.qualifying_passed` | parcours réussi | accès Toits du Fil / inscription |
| `mask.ch1.second_mask_reacted` | essai interrompu | flag narratif secret, sans pouvoir actif |
| `mask.ch2.anchor_created` | tutoriel d'accordage réussi | équiper Cendre/Fil, capacité Élan |
| `mask.ch2.courier_promoted` | course et score minimum | rang civique I, accès Fil |
| `mask.ch2.sabotage_piece_found` | Juno donne la pièce | piste Fixateurs |
| `mask.ch3.training_complete` | entraînement combat | arène avancée |
| `mask.ch3.kael_defeated` | duel vaincu | brevet Fer provisoire |
| `mask.ch3.mirror_incident` | événement au podium | alerte et poursuite |
| `mask.ch3.iron_mask_unlocked` | ancre renforcée | Rempart équipable |
| `mask.ch4.archivist_met` | test avec Éliane | entrée dans les Galeries |
| `mask.ch4.glass_unlocked` | lentille calibrée | Révélation équipable |
| `mask.ch4.sabotage_confirmed` | trois preuves | grand complot identifié |
| `mask.ch4.history_discovered` | projections activées | origine de l'accordage connue |
| `mask.ch4.fixation_revealed` | confrontation Vaurel | plan Grand Accord / compte à rebours narratif |
| `mask.ch5.fil_allied` | mission Fil réussie | relais Fil opérationnel |
| `mask.ch5.fer_allied` | mission Fer réussie | Soren/Kaël alliés |
| `mask.ch5.verre_or_allied` | assemblée et preuve | guildes alliées, Or équipable |
| `mask.ch5.lys_captured` | trois alliances réunies | Fonderie ouverte |
| `mask.ch5.mirror_defeated` | boss Miroir battu | voie jusqu'à Lys |
| `mask.ch5.lys_freed` | salle de calibration désactivée | bataille des quartiers |
| `mask.ch5.relays_online` | défense de quartiers finie | Tour de l'Accord ouverte |
| `mask.ch6.tower_ready` | joueur confirme départ | ascension finale |
| `mask.ch6.vaurel_phase1` | ancrages brisés | phase 2 |
| `mask.ch6.vaurel_phase2` | canal ouvert | phase 3 |
| `mask.ch6.free_accord_complete` | cinq postes validés | cinématique libération |
| `mask.ch6.vaurel_resolution` | posture choisie | épilogue personnalisé |
| `mask.epilogue.completed` | scène maison terminée | exploration après fin disponible |

**Invariants de sauvegarde :** ne jamais activer une quête si ses prérequis n'existent pas ; ne pas dupliquer les masques après rechargement ; si un boss est vaincu, il ne doit pas réapparaître bloquant le trajet ; chaque mission d'alliance doit pouvoir être complétée indépendamment des autres ; les scènes avec alliés ne doivent pas échouer si une animation prend du retard ; une sauvegarde avant boss doit restaurer l'état complet de l'arène.

---

# 13. CHECKLIST DE VALIDATION DE CETTE CIVILISATION

### Narration
- [ ] Le héros commence chez lui, **connaît la civilisation** et veut monter les rangs dès l'ouverture.
- [ ] Il présente Viremasque naturellement, sans jouer l'étranger amnésique.
- [ ] Les scènes et leurs dialogues racontent une histoire **compréhensible et complète**.
- [ ] Tous les personnages ont des intentions, contradictions, voix et scènes utiles.
- [ ] La ville et les compagnons sont vivants : humour, rivalité, amitié, réussite, action.
- [ ] La peur de Kaël et la motivation de Vaurel sont expliquées et traitées avec nuance.
- [ ] Vaurel est vaincu par une solution collective cohérente ; pas par un pouvoir tombé du ciel.
- [ ] La scène multiverselle reste optionnelle et discrète ; **aucune amnésie inventée**.

### Gameplay
- [ ] La première personne fonctionne avec collisions et déplacements agréables.
- [ ] Objets, armes et masques peuvent être **équipés, tenus en main et utilisés**.
- [ ] Cendre, Fil, Fer, Verre et Or procurent des **mécaniques jouables différentes**.
- [ ] Les rangs civiques et les masques sont clairement distincts.
- [ ] Les rangs secrets n'apparaissent pas prématurément dans l'interface.
- [ ] Les épreuves, courses, poursuites, puzzles, combats et deux boss fonctionnent réellement.
- [ ] Des adversaires variés attaquent, défendent et réagissent réellement.
- [ ] Les objectifs et interactions restent fonctionnels après sauvegarde/chargement.

### Monde et présentation
- [ ] Sept grands ensembles spatiaux ont une identité visible et des usages différents.
- [ ] Aucun des deux prototypes n'est simplement recyclé ou repeint.
- [ ] Il existe des habitants, ambiances sonores, musiques et réactions du public.
- [ ] Les cinématiques, dialogues, sous-titres, quêtes et interfaces sont en **français naturel**.
- [ ] Le jeu alterne moments tranquilles, drôles, héroïques, inquiétants et spectaculaires.
- [ ] La durée annoncée correspond à une campagne réellement testée, pas à une estimation gonflée.

### Production
- [ ] Pack indépendant et documentation d'intégration.
- [ ] Corrections du moteur apportées sans casser Door et Memory.
- [ ] Nouvelles capacités accessibles par le Mechanics SDK et configurables dans Civilization Studio selon les besoins.
- [ ] Tests de régression et plan de poursuite si l'implémentation doit se faire en plusieurs sessions.

---

# 14. INSTRUCTIONS FINALES À L'IA QUI CODE

**Le présent document fait foi pour l'histoire de MASK CIVILIZATION — LES CENT VISAGES.** Ne le résume pas à quelques quêtes génériques. Ne supprime pas le côté aventure héroïque au profit d'une atmosphère sombre et triste. N'ajoute pas un second réveil amnésique. Ne réécris pas les deux civilisations de prototype. Respecte le développement des relations et le fait que le protagoniste **a une vie et un passé ordinaires dans cette civilisation avant la première scène**.

Tu peux enrichir les trajets, les figurants, les puzzles et les dialogues accessoires lorsque cela sert le rythme et la jouabilité, mais les événements majeurs, les motivations, les révélations, la progression des pouvoirs et la résolution collective du final doivent rester cohérents avec cette bible.

Travaille par séquences **réellement terminées et vérifiées**. Une longue aventure qui tient ses promesses doit être construite, pas simulée par des menus, des textes ou des écrans de victoire.

**FIN DU SCÉNARIO — MASK CIVILIZATION : LES CENT VISAGES.**
