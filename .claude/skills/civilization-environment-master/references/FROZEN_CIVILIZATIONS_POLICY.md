# Protection des civilisations déjà existantes

## Principe

Les civilisations déjà présentes au début d'une commande sont des **références figées**. Elles ne sont pas des chantiers implicites de rénovation. Des défauts relevés aujourd'hui sont des **leçons à appliquer demain**.

## Exemples

- Une ancienne ville reprend le schéma « pauvres en bas, riches au-dessus » : noter ce défaut, proposer une nouvelle topologie pour le **prochain** monde. Ne pas supprimer sa muraille.
- Une ancienne habitation est mal décorée : documenter comment améliorer les proportions et l'ameublement **des prochaines** maisons. Ne pas ajouter de meubles dans l'ancienne scène.
- Un matériau global est partagé par plusieurs civilisations : ne pas modifier sa texture ou son shader si cela modifie leurs rendus. Créer une copie/version namespacée pour la nouvelle civilisation.
- Un outil global de génération de terrain produit toujours le même plan : implémenter une extension isolée ou un nouveau générateur compatible. Ne pas régénérer les maps existantes.
- La nouvelle civilisation a besoin d'un composant absent du moteur : préférer un plugin dans le pack. Si modification du moteur indispensable, vérifier qu'elle est additive ; si un risque de changement de comportement subsiste, demander explicitement l'accord.

## Vérifications pré-édition

1. Inventorier les dossiers de packs existants.
2. Déterminer le dossier cible nouveau et les chemins en écriture.
3. Ne lire les anciens packs que pour établir les empreintes et comparer.
4. Isoler les nouveaux assets et scripts.
5. Consigner un état de versionnement ou des hash de référence si possible.
6. Faire un audit de diff à la fin ; arrêter et signaler toute modification inattendue.

## Restrictions d'écriture

**Autorisé :** nouveaux fichiers et corrections dans la civilisation *nouvellement commandée*, rapports/plans pour ce nouveau pack, outils compatibles/additifs nécessaires à ce nouveau travail après contrôle.

**Non autorisé :** toutes modifications des packs préexistants, même des ajustements mineurs, retouches de quêtes, modernisation de l'architecture, renommage d'assets ou migration de sauvegarde.

## Quand il y a ambiguïté

Les exemples fournis par l'utilisateur sont des **constats pour l'avenir** jusqu'à nouvel ordre. Si aucun nouveau pack n'est désigné, produire des recommandations ou une proposition de conception, ne toucher à aucune scène existante.

Si un utilisateur demande explicitement un jour de modifier une ancienne civilisation, cette demande future constitue une nouvelle tâche avec un périmètre précis. Elle ne donne pas carte blanche pour toucher aux autres.

## Ce qu'un skill ne garantit pas

Le skill influence les décisions de Claude, mais n'est pas une protection système contre l'écriture. Pour des garanties plus fortes, employer des permissions de dépôt, un worktree distinct, des sauvegardes Git et un audit des modifications avant livraison. La commande `scripts/check_protected_civs.py` signale les chemins inattendus ; elle ne les bloque pas physiquement.
