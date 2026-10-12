# CIVILIZATIONVERSE — notes for Claude Code

State of the project: [`PROJECT_STATUS.md`](PROJECT_STATUS.md). Architecture and formats: [`docs/`](docs/).
Everything the player sees or hears is in natural French; code identifiers stay in English.

- **Door** and **Memory** are finished prototypes: never modify them.
- **Mask** is continued chapter by chapter at the user's explicit request (2026-10-12): each new
  chapter is added next to the finished ones; the chapters already built (Prologue, Chapter I) and
  their zones are not retouched.
- The detailed construction pieces of Civilization Studio (`core.piece`, see
  [`docs/CONSTRUCTION.md`](docs/CONSTRUCTION.md)) are for future creations only: they are never
  used to rework an existing civilization or zone.

## Civilizations — règle permanente pour les futures créations

Quand je demande une **nouvelle civilisation** pour Civilizationverse, applique le skill `.claude/skills/civilization-environment-master/SKILL.md` pour l'urbanisme, le terraforming, la carte, l'architecture, la décoration, l'ameublement et l'inspection FPS.

**N'améliore, ne corrige et ne modifie JAMAIS rétroactivement une civilisation déjà présente (Door, Memory, Mask, Power si existante, et tous autres packs existants), sauf demande explicite ultérieure ciblant précisément cette civilisation.** Observe les anciennes cartes et intérieurs uniquement en lecture seule pour éviter de répéter leurs défauts dans les futures civilisations. N'altère pas non plus leurs assets, scènes, quêtes, sauvegardes ni ressources partagées qui influencent leur rendu.

Évite de reproduire le schéma « quartier pauvre en bas + mur géant + quartier riche au-dessus », les mêmes bâtiments clonés, les mêmes textures et les mêmes intérieurs vides. Chaque nouveau monde doit se distinguer par sa topographie, la logique de ses rues, sa skyline, ses transports, son architecture, ses matériaux et ses intérieurs. Le joueur doit pouvoir explorer des lieux soignés et fonctionnels en première personne.

**L'installation de ce skill ne constitue PAS un ordre de créer, refaire ou modifier des civilisations.** Applique ces principes uniquement lors des futures demandes de création. Avant toute écriture, désigne le pack nouveau autorisé et vérifie que les autres restent intacts. Tout contenu visible par le joueur reste en français naturel.
