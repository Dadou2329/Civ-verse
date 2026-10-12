# Civilization Studio — User Guide

Civilization Studio is the in-browser editor of CIVILIZATIONVERSE. It edits the files of a
civilization pack (`civilizations/<pack>/`): scenes (blocks and entities), dialogues, quests,
cinematics, logic rules, items, characters, mechanic settings, French texts and the pack manifest,
and — only under the development server — the pack's TypeScript scripts. It can also start the real
game on the files being edited (playtest).

The Studio's interface is in French. This guide is in English and quotes the interface labels
exactly, between « », so that they can be found on screen (group headers of the Explorer are
displayed in capitals). "Ctrl" also means ⌘ on macOS: the Studio accepts either. Letter keys are
physical key positions, named after a QWERTY layout; read
[§12](#12-keyboard-and-mouse-reference) if you use an AZERTY keyboard.

The code described here: `studio.html` → `src/studio/main.tsx` → `src/studio/StudioApp.tsx` and the
rest of `src/studio/`, plus the development-server plugin `tools/vite/civDevPlugin.ts`. For the
internals, see [ARCHITECTURE.md](ARCHITECTURE.md) (section 9) and [DECISIONS.md](DECISIONS.md).

## Contents

1. [Opening the Studio](#1-opening-the-studio)
2. [Interface tour](#2-interface-tour)
3. [Navigating the 3D view](#3-navigating-the-3d-view)
4. [Editing the world: blocks and tools](#4-editing-the-world-blocks-and-tools)
5. [Entities](#5-entities)
6. [Prefabs](#6-prefabs)
7. [Document editors](#7-document-editors)
8. [Scripts and hot reload (development server only)](#8-scripts-and-hot-reload-development-server-only)
9. [Validation](#9-validation)
10. [Playtest](#10-playtest)
11. [Saving, undo/redo, conflicts and backups](#11-saving-undoredo-conflicts-and-backups)
12. [Keyboard and mouse reference](#12-keyboard-and-mouse-reference)
13. [Limitations](#13-limitations)

---

## 1. Opening the Studio

### 1.1 With the development server (full editor)

```sh
npm install
npm run dev
```

`npm run dev` starts Vite with the settings of `vite.config.ts`: host `127.0.0.1`, port `5173`.
The port is not strict: when 5173 is busy, Vite takes the next free port and prints the URL to use.
Then open:

```
http://127.0.0.1:5173/studio.html
```

The game itself is `index.html` on the same server (the « Jeu » link of the Studio opens it). The
page needs JavaScript and WebGL 2. The project requires Node.js 22.12 or later (`engines` in
`package.json`).

**Choosing the pack.** Add `?pack=<id>` to the URL: `studio.html?pack=door`, `?pack=memory`, or
`?pack=core` (the shared library pack). Without the parameter, the Studio opens the first pack, in
alphabetical order, that is not `core` (today: `door`). Afterwards, the « Pack » selector of the top
bar switches pack. An unknown id stops the start-up: the page only shows « Civilization Studio n'a
pas pu démarrer. » followed by the error, here « Pack introuvable ou invalide : "\<id>". ».

**What opening a pack does.**

- It reads every JSON document of the pack and of the packs it depends on (scripts are read only
  when you open them).
- It opens the manifest's entry scene (or, without one, the first scene of the pack) in a tab.
- It empties the undo history.
- It writes « Pack « \<id> » ouvert. » in the journal.

**How the Studio reaches the files.** Under `npm run dev`, the Vite plugin
`tools/vite/civDevPlugin.ts` adds a small HTTP API (`/__civ/api/…`) through which the Studio lists,
reads and writes pack files, type-checks scripts and creates new scripts. The plugin is only applied
to the development server (`apply: 'serve'`): no build contains it. It only answers requests coming
from a page of that server on a loopback address (`localhost`, `127.0.0.1`, `::1`), and only touches
files inside `civilizations/<pack>/` ([§11.4](#114-where-files-are-written)).

### 1.2 Read-only mode

`npm run build` does not include the Studio. `npm run build:with-studio` (which sets
`CIV_BUILD_STUDIO=1`) adds `studio.html` to the build, but a build never contains the file API, and
the code editor is removed from it. Such a Studio — for example served by `npm run preview` at
`http://127.0.0.1:4173/studio.html` — opens in read-only mode. The mode is decided when the page is
built (`devApi.available()` returns the build-time constant), not detected at run time.

In read-only mode:

- the top bar shows the badge « Lecture seule » (tooltip: « Le serveur de développement (npm run
  dev) est nécessaire pour enregistrer et éditer les scripts. ») and the status bar shows « Lecture
  seule »;
- « 💾 Enregistrer » is disabled, the Explorer has no « ＋ » buttons and no « Scripts » group, and
  « ＋ Créer à partir d’une zone de la scène… » is disabled;
- only the content bundled in the build is listed: manifests, `content/**/*.json` and
  `locales/*.json`;
- you can still edit in memory, validate and playtest, but nothing can be written. Ctrl+S is not
  blocked: it attempts the save and logs, for each modified file, « Échec de l’enregistrement de
  \<path> : Studio en lecture seule : le serveur de développement est nécessaire pour enregistrer. ».

---

## 2. Interface tour

```
+--------------------------------------------------------------------------+
| top bar: Pack · ↶ ↷ · Enregistrer · Valider · Jouer ici · Depuis le début |
+--------------------+---------------------------------+-------------------+
| Explorateur        | tabs of the open documents      | Inspecteur        |
|                    +---------------------------------+                   |
|                    | 3D view                         |                   |
+--------------------+ (or the editor of the active    |                   |
| Hiérarchie de la   |  document)                      |                   |
| scène              +---------------------------------+                   |
|                    | Journal | Problèmes             |                   |
+--------------------+---------------------------------+-------------------+
| status bar                                                               |
+--------------------------------------------------------------------------+
```

The left column is 270 px wide, the right column 340 px; the centre takes the rest.

### 2.1 Top bar

| Element | What it does |
|---|---|
| « Civilization Studio » | Title only. |
| « Pack » (tooltip « Civilisation éditée ») | Lists every pack of `civilizations/` as « \<French name> (\<id>) ». Choosing one opens it. When files are modified, the Studio first asks « Des modifications ne sont pas enregistrées. Changer de pack quand même ? »; confirming does **not** discard them ([§11.2](#112-saving)). |
| « ↶ » / « ↷ » | Undo / redo. The tooltips name the step: « Annuler : \<action> (Ctrl+Z) », « Rétablir : \<action> (Ctrl+Y) ». Disabled when there is nothing to undo or redo. |
| « 💾 Enregistrer » | Writes every modified file; the number of modified files is shown in brackets, e.g. « 💾 Enregistrer (3) ». Tooltip « Enregistrer tous les fichiers modifiés (Ctrl+S) ». Disabled when nothing is modified and in read-only mode. |
| « ✔ Valider » | Checks the pack ([§9](#9-validation)). Tooltip « Vérifier références, textes et schémas ». |
| « Lecture seule » | Badge shown only in read-only mode. |
| « ▶ Jouer ici » | Playtest of the open scene from the editor camera ([§10](#10-playtest)). Disabled when no scene is open. |
| « ▶ Depuis le début » | Playtest from the start of the civilization ([§10](#10-playtest)). |
| « Jeu » | Opens the game (`/index.html`) in the same browser tab. |

### 2.2 Explorer (« Explorateur »)

The Explorer lists the documents of the active pack by type. Click a group header to fold or unfold
it; the number on the right is the number of files. « Préfabriqués » and « Scripts » start folded.
Click a document to open it in a tab (or to bring its tab forward). A modified document shows a dot
(●) at the right end of its line; the tooltip of a line is the file's repository path. Without an
open pack the panel shows « Choisissez une civilisation. ».

| Group | Files | « ＋ » button |
|---|---|---|
| « Scènes » | `content/scenes/<id>.scene.json` | yes, « Nouveau : scène » |
| « Dialogues » | `content/dialogues/<id>.dialogue.json` | yes, « Nouveau : dialogue » |
| « Quêtes » | `content/quests/<id>.quest.json` | yes, « Nouveau : quête » |
| « Cinématiques » | `content/cinematics/<id>.cinematic.json` | yes, « Nouveau : cinématique » |
| « Logique » | `content/logic/<id>.logic.json` | yes, « Nouveau : logique » |
| « Préfabriqués » | `content/prefabs/<id>.prefab.json` | no — created from the 3D view ([§6](#6-prefabs)) |
| « Objets » | `content/items.json` | no |
| « Personnages » | `content/characters.json` | no |
| « Règles des mécaniques » | `content/rules.json` | no |
| « Textes » | `locales/<ll-CC>.json` | no — `locales/fr-FR.json` is created automatically when the first text needs it |
| « Civilisation et interface » | `manifest.json` | no |
| « Scripts » | every `.ts` / `.tsx` file of the pack, shown with its path inside the pack | « Nouveau script » ([§8](#8-scripts-and-hot-reload-development-server-only)); the whole group exists only under `npm run dev` |

The « ＋ » buttons are shown only when the Studio can save (development server).

**Creating a document.** « ＋ » on a group opens a dialog titled like its tooltip (« Nouveau :
scène », « Nouveau : dialogue »…):

- « Identifiant »: letters, digits, `_` and `-` only (otherwise « Identifiant : lettres, chiffres,
  _ et - uniquement. »). It becomes the file name; an existing file is refused (« Ce fichier existe
  déjà. »).
- « Titre » (« Nom du lieu » for a scene), placeholder « En français ». Left empty, the identifier
  is used.
- For a scene only, « Taille (blocs) »: three numbers X, Y (height) and Z, each between 8 and 256,
  default 64 × 32 × 64.

« Créer » (or Enter in « Identifiant ») creates the document in memory and opens it; « Annuler » or
Échap closes the dialog. As the dialog says: « Le fichier est créé à l’enregistrement (Ctrl+S). »

| New document | Initial content |
|---|---|
| Scene | A volume of the requested size whose lowest `min(4, Y − 2)` layers are filled: `core:dirt`, with `core:grass` on top. The environment is copied from the scene currently open (or a default sky). One entity, `depart`, holds the default spawn point (`core.spawn`), centred on the ground. The name becomes a new text key `<pack>.scene.<id>`. The scene id is appended to the `scenes` list of `manifest.json`. |
| Dialogue | The title (plain text), one node `debut` (speaker « Narration », text « … », end of dialogue). |
| Quest | Title and summary as text keys (summary « Résumé de la quête. »), type main, order = number of existing quests, not started automatically, one stage `etape1` (« Première étape. ») with one objective `objectif1` (« Premier objectif »). |
| Cinematic | Title, duration 8 s, skippable, letterbox, player immobilized, HUD hidden, camera blended back to the player; a camera track with one key at 0 s taken from the current editor camera (field of view 60°) and an empty subtitle track. |
| Logic | Title, no rule. |

### 2.3 Hierarchy (« Hiérarchie de la scène »)

The Hierarchy lists the entities of the scene being edited (« Aucune scène ouverte. » when there is
none).

- « Filtrer (identifiant, nom, composant)… » keeps the entities whose id, editor name or component
  type contains the typed text. Case is ignored, except that a component type with capitals (such
  as `door.ambientLoop`) only matches through its lower-case parts.
- Entities are grouped by their « Dossier » value (« Sans dossier » when empty); groups are sorted
  alphabetically and fold with a click on their header. The value is used as is: `Quartier/Maisons`
  is one group, not two nested folders.
- Each line shows an icon of the main component, the editor name (« Nom (éditeur) ») or else the
  id, and 🔒 for a locked entity.
- Click selects, Ctrl+click adds or removes, Shift+click adds; double-click frames the 3D view on
  the selection.

### 2.4 Tabs and the centre area

Every opened document gets a tab: an icon of its type (▦ scene, ❝ dialogue, ◆ quest, ▶ cinematic,
⚙ logic, ✦ items, ☺ characters, ⚖ rules, Aa texts, ★ manifest, ❖ prefab, {} script), a title (the
document id; « Objets », « Personnages », « Règles », « Civilisation » for the single-file
documents; « Textes (fr-FR) » for the French table) and ● while it is modified. « × » or a
middle-click closes the tab. Closing a tab does not discard its changes: they stay in memory and are
written by the next « 💾 Enregistrer ».

Only one scene is edited at a time: the scene opened last. Opening a scene document makes it the
edited scene; the previous one leaves the 3D view but keeps its unsaved changes. Closing the tab of
the edited scene switches to another open scene tab, or leaves the view empty with « Ouvrez une
scène dans l’explorateur. ».

What the centre shows depends on the active tab:

- scene: the 3D view;
- cinematic: the 3D view in the upper part (about 54 %) and the timeline editor below
  ([§7.3](#73-cinematic-editor));
- any other document: its editor covers the 3D view, which stops rendering.

The Hierarchy and the Inspector keep showing the edited scene while another document is displayed.

### 2.5 Inspector (« Inspecteur »)

- No scene open: « Ouvrez une scène pour inspecter ses entités. »
- Scene open, nothing selected: the scene's settings and environment ([§4.5](#45-scene-settings-and-environment)).
- One entity selected: its identity, transform and components ([§5](#5-entities)).
- Several entities selected: the multiple-selection tools ([§5.3](#53-duplicating-deleting-multiple-selection)).

### 2.6 Console: « Journal » and « Problèmes »

Below the centre area (180 px high; « ▾ » / « ▴ » folds and unfolds it):

- « Journal »: the Studio's messages with their time (the last 300 are kept). A line attached to a
  file — for example « Enregistré : … » or « Rechargé depuis le disque : … » — opens that file when
  clicked. « Effacer » empties the journal.
- « Problèmes »: the result of the last validation, with its counts, e.g. « Problèmes (2 erreurs,
  1 avertissement) », and the button « Relancer la validation » ([§9](#9-validation)). Before any
  validation it shows « Lancez « Valider » pour vérifier la civilisation (références, textes,
  schémas). ».

### 2.7 Status bar and busy overlay

From left to right: the mode (« Serveur de développement : enregistrement activé » or « Lecture
seule »), the save state (« \<n> fichier(s) modifié(s) » or « Tout est enregistré »), the selection
when a scene is open (« \<n> sélectionnée(s) » or « Aucune sélection »), the 3D view's frame rate and
chunk count (« 60 i/s · 24 tronçons », plus « (\<n> en attente) » while chunks are being built), and
« Dernière action : \<action> » — the step that « ↶ » would undo.

Long operations cover the window with a message until they finish: « Ouverture de « \<pack> »… »,
« Enregistrement… », « Validation de la civilisation… ».

---

## 3. Navigating the 3D view

The 3D view renders the edited scene with the game's own renderers (blocks, models, characters,
environment), plus editor helpers. Nothing runs in it: components are shown with their settings,
but their behavior is not executed.

| Input | Effect |
|---|---|
| Hold the right button and move the mouse | Look around. |
| Right button held + W / A / S / D or the arrow keys | Move forward / left / back / right. |
| Right button held + Q / E | Move down / up. |
| Shift (with the keys above) | Move faster (about 9 → 28 m/s). |
| Mouse wheel | Move forward or back along the view (2 m per wheel step, 6 m with Shift). |
| Hold the middle button and drag | Pan sideways and vertically. |
| F | Frame the selected entity (the first one of the selection). |

The letters are physical positions: on an AZERTY keyboard the keys are Z / Q / S / D to move and
A / E to go down / up, which is what the hint at the bottom of the view says with « ⬚ Sélection »
(« Clic droit maintenu + ZQSD/WASD : se déplacer (A/E : descendre/monter, Maj : vite) »). While the
right button is held, the letter keys move the camera and the other shortcuts of the view are
suspended. Keys are ignored while the keyboard focus is in a form field; pressing a mouse button in
the view takes the focus away from fields.

**Where the camera starts.** Each time a scene opens in the view — including after a script hot
reload ([§8.4](#84-hot-reload)) — the camera goes to the view saved with « Mémoriser la vue actuelle »
([§4.5](#45-scene-settings-and-environment)) or, without one, to an overview above the scene.

**Picking.** A click hits whichever is nearer under the cursor, an entity or a block (blocks are
found up to 600 m away).

**Helpers.** Components that are invisible in the game are drawn in the editor: wire boxes for
triggers (orange), zones (blue), colliders (red), portals (purple) and the aim volumes of
interactable, pickup and readable objects (green); small cones for spawn points, markers, lights
and sound sources; a magenta cube for a model or character appearance that cannot be found.
Entities hidden in the game are shown. To select an invisible entity, click its outline. Selected
entities get a yellow box outline.

**Hint line.** The bottom of the view shows the controls of the current tool and, with a block tool,
the coordinates and name of the hovered block (« · 12, 8, 30 (Pierre) »).

---

## 4. Editing the world: blocks and tools

### 4.1 Tools

The toolbar at the top left of the 3D view holds the tools; the digit keys 1 to 6 of the main
keyboard select them as well.

| Tool | Key | Tooltip | Left button |
|---|---|---|---|
| « ⬚ Sélection » | 1 | « Sélectionner et transformer les entités (1) » | Selects entities ([§5.2](#52-selecting)). |
| « ▣ Poser » | 2 | « Poser des blocs, glisser pour peindre (2) » | Places the current block in the cell in front of the face under the cursor. Keep the button down and drag to keep placing. |
| « ⌫ Effacer » | 3 | « Effacer des blocs (3) » | Removes the block under the cursor; drag to continue. |
| « 🖌 Peindre » | 4 | « Remplacer la matière des blocs (4) » | Replaces the block under the cursor by the current block; drag to continue. Empty cells are never painted. |
| « ▤ Boîte » | 5 | « Deux clics : remplir une boîte · Maj : la vider (5) » | Fills or empties a box ([§4.2](#42-box-tool)). |
| « ⌖ Pipette » | 6 | « Prendre le bloc visé (6) » | Makes the clicked block the current block (the tool stays active). |

With a block tool, a yellow wire cube shows the targeted cell: the cell in front of the hovered face
for « ▣ Poser » and « ▤ Boîte » (for « ▤ Boîte », the hovered block itself while the left Shift key
is held), the hovered block itself for the others.

Each press–drag–release of « ▣ Poser », « ⌫ Effacer » or « 🖌 Peindre » is one undo step (« Poser
des blocs », « Effacer des blocs », « Peindre des blocs »). A cell is changed at most once per
stroke, and cells outside the scene volume are ignored. Blocks change live in the view (meshes and
lighting are rebuilt as you go); they are written into the scene document when you save, start a
playtest, validate or switch to another scene.

### 4.2 Box tool

1. The first click sets the first corner: the cell in front of the clicked face, or, with Shift
   held, the clicked block itself. The hint becomes « Premier coin : x, y, z — cliquez le coin opposé
   (Maj : vider) · Échap : annuler ».
2. The second click sets the opposite corner with the same rule and fills the box with the current
   block. With Shift held during the second click, the box is emptied instead.

The box is clipped to the scene volume. A box of more than 200 000 blocks is refused with « Boîte
trop grande (\<n> blocs, maximum 200 000). ». The result is one undo step, « Remplir une boîte (\<n>
blocs) » or « Vider une boîte (\<n> blocs) ». Échap, or switching to « ⬚ Sélection », cancels a
first corner.

### 4.3 Current block and palette

While a block tool is active, the toolbar shows the current block (swatch and name, tooltip
« Choisir le bloc »; `core:stone` when the Studio starts). Clicking it opens the palette:

- « Chercher un bloc… » filters by name or id;
- blocks are grouped by category; click one to make it current;
- the palette closes when a block is chosen or when the mouse leaves it.

The palette offers the blocks of every pack loaded in the Studio (see
[§13](#13-limitations) about packs opened earlier).

### 4.4 Snapping and other toolbar groups

The rest of the toolbar holds the transform modes (with « ⬚ Sélection », [§5.4](#54-moving-rotating-scaling)),
the snapping group ([§5.4](#54-moving-rotating-scaling)), « ＋ Ajouter » ([§5.1](#51-adding-entities))
and « ❖ Préfabriqués » ([§6](#6-prefabs)). « ＋ Ajouter » and « ❖ Préfabriqués » are disabled when no
scene is open.

### 4.5 Scene settings and environment

With a scene open and nothing selected, the Inspector shows the scene. To get there, click with
« ⬚ Sélection » on a block or on the sky (without Ctrl or Shift).

Section « Scène » (followed by the scene id):

- « Nom du lieu »: the place name shown to the player (a text, [§5.8](#58-texts-and-localization-keys)).
- « Taille »: read-only, « \<X> × \<Y> × \<Z> blocs · \<n> entités ». The size of an existing scene
  cannot be changed.
- « Notes »: free notes kept in the scene file for the editors.
- « Mémoriser la vue actuelle » (tooltip « La scène s’ouvrira avec ce point de vue »): saves the
  current camera position and target in the scene file; the Studio opens the scene with that view.

Section « Environnement » (changes appear in the view at once; each is undoable as
« Environnement »):

| Group | Fields |
|---|---|
| « Ciel » | « Zénith », « Horizon », « Sous l’horizon », « Étoiles », « Disque visible », « Couleur du disque » |
| « Soleil » | « Direction », « Couleur », « Intensité » |
| « Lumière ambiante (blocs) » | « Couleur », « Intensité » |
| « Lumière des personnages » | « Ciel », « Sol », « Intensité » |
| « Brouillard » | « Couleur », « Densité » |
| « Lumière des lanternes » | one value |
| « Musique », « Ambiance sonore » | a music and an ambient sound (suggestions from the loaded packs) |
| « Rendu » | « Exposition », « Contraste », « Saturation », « Halo », « Vignettage » |
| « Particules » | « Aucune », « Poussière », « Braises », « Lucioles », « Fumée », « Étincelles », « Éclats de mémoire », « Étoiles », plus a density between 0 and 3 (0.5 by default) |

---

## 5. Entities

### 5.1 Adding entities

« ＋ Ajouter » opens a menu of templates by category (it closes when the mouse leaves it).

| Category | Entry | Base id | Components | Texts created |
|---|---|---|---|---|
| Personnages | « Personnage » | `personnage` | `core.npc` (appearance `core:citizen_a`) | name « Nouveau personnage » |
| Monde | « Porte » | `porte` | `core.door` (model `core:door_wood`) | name « la porte » |
| Monde | « Décor (modèle) » | `decor` | `core.model` (model `core:barrel`) | — |
| Monde | « Lumière » | `lumiere` | `core.light` (colour `#ffd8a0`, level 12) | — |
| Monde | « Panneau » | `panneau` | `core.sign` (plate 2 × 0.5 × 0.05) | text « NOUVEAU PANNEAU » |
| Monde | « Particules » | `particules` | `core.particles` (preset `dust`) | — |
| Monde | « Source sonore » | `son` | `core.sound` (sound `core:amb_wind`, volume 0.6) | — |
| Interactions | « Objet à ramasser » | `objet` | `core.model` (`core:crate`) and `core.pickup` (item left empty) | — |
| Interactions | « Document à lire » | `document` | `core.model` (`core:books_stack`) and `core.readable` (paper, one page) | title « Document », page « Le texte du document. » |
| Interactions | « Point d’interaction » | `interaction` | `core.interactable` (no action yet) | prompt « Examiner » |
| Logique | « Déclencheur » | `declencheur` | `core.trigger` (2 × 2.5 × 2, once) | — |
| Logique | « Zone nommée » | `zone` | `core.zone` (10 × 6 × 10) | name « Nouveau lieu » |
| Logique | « Repère » | `repere` | `core.marker` | — |
| Logique | « Point d’apparition » | `apparition` | `core.spawn` | — |
| Logique | « Passage vers une scène » | `passage` | `core.portal` (mode `walk`, 2 × 3 × 1) | — |

- **Position.** The new entity goes where the centre of the view meets a block — on top of a top
  face, against a side face, below a bottom face — or 6 m in front of the camera when the centre of
  the view hits no block. The position is rounded to 0.5 m. Aim the centre of the view before
  choosing a template.
- **Id.** A free id is derived from the base id: `personnage`, then `personnage_2`, `personnage_3`…
- **Texts.** Each text of the template becomes a new key in the pack's French table
  ([§5.8](#58-texts-and-localization-keys)).
- The entity is selected, and the whole operation (entity and texts) is one undo step, « Ajouter :
  \<entry> ».
- « Objet à ramasser » is created with an empty item: choose it in the « Objet » field of its
  component.

### 5.2 Selecting

- With « ⬚ Sélection »: click an entity to select it; Ctrl+click adds or removes it; Shift+click adds
  it. A click without modifier on anything that is not an entity (a block, the sky) clears the
  selection.
- In the Hierarchy: the same clicks; double-click frames the view.
- The « ◎ » button next to an entity reference ([§5.7](#57-property-fields)) selects that entity.

### 5.3 Duplicating, deleting, multiple selection

- Ctrl+D duplicates the selected entities: the copies get free ids (`noe` → `noe_2`), are placed
  1 m further along X and become the selection (undo step « Dupliquer « \<id> » » or « Dupliquer \<n>
  entités »).
- Delete or Backspace deletes the selected entities (« Supprimer « \<id> » » / « Supprimer \<n> entités »).
- These two shortcuts work while the 3D view is displayed (scene or cinematic tab) and the focus is
  not in a form field ([§12](#12-keyboard-and-mouse-reference)).

With several entities selected, the Inspector shows « \<n> entités sélectionnées », the list of their
ids, and:

- « Décaler de » (x, y, z) and « Appliquer le décalage »: moves them all by that offset (one undo
  step);
- « Dupliquer » and « Supprimer »: as Ctrl+D and Delete.

There is no gizmo for a multiple selection.

### 5.4 Moving, rotating, scaling

**Gizmo.** With « ⬚ Sélection » and exactly one entity selected, a transform gizmo appears on it
(unless the entity is « Verrouillée », [§5.5](#55-identity)). The transform group of the toolbar chooses
its mode:

| Button | Key | Tooltip |
|---|---|---|
| « ✥ Déplacer » | W | « Déplacer (W) » |
| « ⟳ Tourner » | E | « Tourner (E) » |
| « ⤢ Échelle » | R | « Échelle (R) » |

The keys are physical positions (on AZERTY: Z, E, R) and only work while « ⬚ Sélection » is active.
A drag becomes one undo step when the mouse is released (« Déplacer « \<id> » », « Tourner « \<id> » »,
« Redimensionner « \<id> » »). Values are rounded to 0.001; rotations are stored in degrees between 0
and 360.

**Snapping** (« Aimantation » group of the toolbar):

- the button « 🧲 0.5 m · 15° » (it shows the current steps; tooltip « Aimanter les déplacements et
  rotations ») turns snapping on and off — it is on when the Studio starts;
- « Pas de déplacement »: 0.125, 0.25, 0.5 (default), 1 or 2 m;
- « Pas de rotation »: 5, 15 (default), 45 or 90°;
- scaling snaps by 0.25 while snapping is on (this step cannot be changed).

Snapping only applies to gizmo drags; gizmo drags move, turn and scale in steps of these sizes.

**Inspector, section « Transformation ».**

- « Position », « Rotation (°) », « Échelle »: x, y, z fields (the field arrows step by 0.5, 15 and
  0.1).
- « 0° », « 90° », « 180° », « 270° »: set the rotation around the vertical axis (« Orienter « \<id> » »).
- « Cadrer » (tooltip « Centrer la vue sur l’entité (F) »): frames the view on the entity.

### 5.5 Identity

Section « Entité » (followed by the id):

- « Identifiant »: applied when you press Enter or leave the field. Letters, digits, `_` and `-`
  only, and unique in the scene; otherwise the field shows « Identifiant invalide : lettres,
  chiffres, _ et - uniquement. » or « L’identifiant « \<id> » existe déjà. ». References to the old
  id elsewhere (dialogues, logic, quests…) are not updated: run « ✔ Valider » after a rename.
- « Nom (éditeur) » (placeholder « Libellé dans la hiérarchie »): the label shown in the Hierarchy.
- « Dossier » (placeholder « Quartier/Maisons »): the Hierarchy group.
- « Étiquettes » (placeholder « garde, ronde »): tags, separated by commas.
- « Éditeur » › « Verrouillée »: hides the gizmo for this entity and shows 🔒 in the Hierarchy. A
  locked entity can still be selected, edited in the Inspector, duplicated and deleted.

### 5.6 Components

Each component of the entity has its own section: the component's label, its type id (e.g.
`core.door`), its description, its fields, and « ✕ » (tooltip « Retirer ce composant ») to remove it.
A component that no loaded pack defines shows « Composant inconnu (aucun pack chargé ne le définit) :
ses données sont conservées. ».

« ＋ Ajouter un composant… » (at the bottom of the Inspector) lists the components that the entity
does not have yet, grouped by category (« Divers » when a component has none) and sorted
alphabetically. Components that the chosen one requires are added at the same time.

Only the values that differ from a component's defaults are written to the scene file.

### 5.7 Property fields

The fields of components, logic blocks, mechanic settings and several document editors are generated
from the property declarations of the code. Fields marked as advanced are grouped under « Avancé ».

| Property kind | Field |
|---|---|
| number, integer | Number field (plus a slider for properties declared as sliders); minimum and maximum are enforced; a unit may follow. |
| string | Text field, or multi-line area. |
| text | The French text of a localization key ([§5.8](#58-texts-and-localization-keys)). |
| boolean | Checkbox with « Oui » / « Non ». |
| enum | Drop-down list. |
| color | Colour picker and a hexadecimal field (`#rrggbb`; other values are flagged as invalid). |
| vec3 | Three fields x, y, z. |
| reference | Text field with suggestions ([below](#references)). |
| condition | Condition block ([below](#conditions-actions-and-events)). |
| actions | List of action blocks. |
| list | One block per element with « ↑ » (« Monter »), « ↓ » (« Descendre »), « ✕ » (« Retirer »), and « ＋ Ajouter » at the end. |
| object | Nested fields. |
| json | Raw JSON, applied when you leave the field; « JSON invalide : … » otherwise. |

#### References

A reference field suggests the known values while you type; a value that is not known is kept but
shown as invalid. Placeholders give the expected form (« pack:objet », « pack:son », « civ.variable »…).

| Reference to | Suggestions |
|---|---|
| entity | « Le joueur » (`player`) and the entities of the edited scene. A « ◎ » button (« Sélectionner dans la scène ») selects the entity. |
| spawn point | The `core.spawn` entities of every scene of the pack. |
| dialogue, quest, cinematic, scene, prefab | The documents of the pack and of its dependencies. |
| item, sound, music, model, block, character appearance | Everything registered by the loaded packs. |
| variable | The variable names already used in the pack's content. |
| event, panel, ability | Everything registered by the loaded packs. |

#### Conditions, actions and events

- **Condition.** Empty, the field is a drop-down « ＋ Ajouter une condition… (toujours vraie sinon) ».
  Once chosen: the condition type (all conditions of the engine and the loaded packs, by category),
  a one-line summary, its parameters, and « ✕ » (« Retirer la condition »). An unknown type shows
  « Condition inconnue : \<type> ». Conditions that contain other conditions are edited the same way,
  recursively.
- **Actions.** A list of blocks, run in order. Each block shows the action's label, « ▾ » / « ▸ »
  to unfold or fold it (actions with more than three parameters start folded and show a summary),
  « ↑ », « ↓ » and « ✕ » (« Retirer l’action »). « ＋ Ajouter une action… » adds an action chosen by
  category. An unknown type shows « Action inconnue : \<type> ».
- **Event** (quests and logic rules). A drop-down « Aucun événement » or « \<label> (\<id>) »; when the
  event has fields, « Filtres (laisser vide pour tout accepter) » follows.

Actions and conditions added by scripts appear in these lists after their pack's code is reloaded
([§8.4](#84-hot-reload)).

### 5.8 Texts and localization keys

Every text the player sees is a localization key; its French text lives in the pack's
`locales/fr-FR.json`. A text field shows and edits the French text directly:

- **Key of the active pack**: a text field (a multi-line area for multi-line texts or texts longer
  than 48 characters). Typing changes the French text; successive keystrokes form one undo step.
- **No key yet**: the button « ＋ Écrire un texte » creates a key and lets you type its text.
- **Key of another pack** (for example `core`): the text is shown read-only, with « Copier ici »
  (tooltip « Créer une copie modifiable de ce texte dans ce pack »), which creates a key of the active
  pack holding a copy of the text. A key that exists nowhere shows « Clé introuvable dans les
  textes » (in red); « Copier ici » then creates an empty key.
- **The key itself**: under the text, the key name can be unfolded; its field lets you type another
  key (suggestions from the pack's table).

New keys are named `<pack>.<context>`, for example `door.verrou.personnage.name` for the name of an
entity `personnage` of the scene `verrou`, or `<pack>.dlg.<dialogue>.<node>` for a dialogue line.
Characters other than letters, digits, `.`, `_` and `-` become `_`, and `_2`, `_3`… is appended when
the key exists. If the pack has no `locales/fr-FR.json` yet, the first new text creates it.

A straight apostrophe typed between two letters is converted to the typographic apostrophe (’) as
you type (in text fields and in the « Textes » editor).

Copies of entities (Ctrl+D, « Dupliquer », prefabs) keep the same keys as the originals: editing the
text of a copy also changes the original. To give a copy its own text, empty the key field under the
text, then use « ＋ Écrire un texte ».

All texts of the pack can also be edited in the « Textes » editor ([§7.8](#78-french-texts)).

---

## 6. Prefabs

A prefab is a piece of scene — blocks and entities — saved for reuse in
`content/prefabs/<id>.prefab.json`.

**Creating a prefab from a zone of the scene.** « ❖ Préfabriqués » › « ＋ Créer à partir d’une zone
de la scène… » opens « Nouveau préfabriqué »:

- « Identifiant » (letters, digits, `_`, `-`) and « Nom » (placeholder « Échoppe de marché »; empty =
  the identifier);
- « Coin minimal » and « Coin maximal »: the two corners of the zone in block coordinates (both
  included). The zone is initially 5 × 4 × 5 blocks: two blocks on each side of the first selected
  entity (or of the point at the centre of the view), from its level up.

« Créer » copies the blocks of the zone (empty cells included) and the entities whose position lies
inside it (positions made relative to the minimal corner); each dimension must be between 1 and 64
blocks (« Chaque dimension doit être comprise entre 1 et 64 blocs. »), and an existing prefab file
is refused (« Le fichier existe déjà : \<path> »). The prefab gets the category « Créés dans le
Studio ». The journal says « Préfabriqué « \<name> » créé (\<X> × \<Y> × \<Z> blocs, \<n>
entités). Enregistrez pour l’écrire sur le disque. »: the file is written on the next save. This
creation is not an undo step.

**Placing a prefab.** « ❖ Préfabriqués » lists, under « Placer devant la caméra », the prefabs of the
active pack (« Aucun préfabriqué dans ce pack. » when there are none). Choosing one pastes it with
its minimal corner where the centre of the view meets a block (the same point as for « ＋ Ajouter »,
rounded down to whole blocks), or 6 m in front of the camera:

- blocks are copied where the prefab has a block — its empty cells do not erase anything — and cells
  outside the scene are dropped;
- entities are copied with free ids and become the selection;
- the whole placement is one undo step, « Placer « \<name> » ».

The prefab editor ([§7.10](#710-prefab-editor)) also has « Placer dans la scène ouverte ».

---

## 7. Document editors

Opening a document of the Explorer shows its editor in the centre area. Every change is an undo step
of the Studio's history ([§11.3](#113-undo-and-redo)); most editors use the fields of
[§5.7](#57-property-fields) and the text fields of [§5.8](#58-texts-and-localization-keys). Lists use
the same small buttons everywhere: « ↑ » (« Monter »), « ↓ » (« Descendre »), « ⧉ » (« Dupliquer »,
logic rules only) and « ✕ » (« Supprimer »).

### 7.1 Dialogue editor

The dialogue is shown as a graph, with the inspector of the selected node on the right.

**Toolbar.** « Dialogue « \<id> » », the number of nodes (« \<n> nœuds »), « ＋ Nœud » (adds a node
that is not linked yet) and « Réorganiser » (tooltip « Oublier les positions manuelles »: returns
every node to the automatic layout).

**Graph.**

- Nodes are laid out in columns by their distance from the start node, unless you dragged them:
  drag a node to move it; its position is saved in the dialogue file.
- Arrows: grey for « then » links, blue for player choices, dashed purple for conditional branches.
- A node shows its speaker (« Narration », « Joueur », a speaker declared by the dialogue, the name
  of an NPC entity, or « Sans locuteur »), the badges « début » and « fin », its id, its line and its
  choices (« ▸ \<text> → \<node> », or « (fin) »).
- A node without line and without choices is a routing node: it is titled « Aiguillage », has a
  dashed border and shows « \<n> branche(s) conditionnelle(s) ».
- Click a node to inspect it. When none has been clicked, the start node is inspected.

**Node inspector.**

- « ＋ Nœud suivant »: creates a node one column to the right with the same speaker and the line
  « … »; when the current node has no choices, it is linked to the new node.
- « Début »: makes the node the start of the dialogue.
- « Supprimer »: deletes the node and the links that pointed to it (disabled for the start node and
  for the only node).
- « Identifiant »: applied when you leave the field; links inside the dialogue follow the new id. An
  invalid or already used id is ignored (the field returns to the old id).
- « Locuteur »: « — aucun — », « Narration », « Joueur », the speakers declared in the dialogue, and
  the NPC entities (`core.npc`) of the scene being edited.
- « Réplique »: the line (tooltip of the label: « Sans texte ni choix, le nœud est un aiguillage
  invisible »).
- « Expression »: « — inchangée — », « Neutre », « Joyeuse », « Triste », « En colère », « Surprise »,
  « Inquiète », « Déterminée », « Yeux fermés ».
- « Animation »: « — aucune — », « Repos », « Parle », « Salue », « Montre du doigt », « Manipule »,
  « Acquiesce », « Refuse de la tête », « Bras croisés », « Sursaute », « Abattu », « S’incline »,
  « S’agenouille ».
- « Actions »: actions run when the node is reached.

**« Choix du joueur ».** Each choice has an id field, the list buttons and:

- « Texte »;
- « Mène à »: a node, or « — fin du dialogue — »;
- « Visible si »: a condition;
- « Actions »;
- « Options »: « Une seule fois », « Grisé si indisponible ».

« ＋ Choix » adds a choice whose text is « Nouvelle réponse » (and removes the node's « fin »).

**« Suite »** (only for nodes without choices):

- « Branches » (tooltip « La première condition vraie choisit la suite »): each branch is « Si… » a
  condition, « alors » a node. « ＋ Branche » adds one with an always-true condition.
- « Sinon / ensuite »: the next node, or « — fin du dialogue — », which marks the node as an end.

### 7.2 Quest editor

Heading « Quête — \<title> ».

- « Titre », « Résumé » (texts), « Type » (« Principale » / « Secondaire »), « Ordre dans le
  journal ».
- **« Démarrage »**: « Automatique » (« Démarre dès le chargement de la civilisation »), « Démarre
  quand » (a condition), « Ou à l’événement » (an event), « Au démarrage » (actions).
- **« Étapes »**: each « Étape \<n> » has an id field, the list buttons, « Description », « Terminée
  quand » (« Tous les objectifs obligatoires sont remplis » / « Un seul objectif suffit (solutions
  alternatives) »), its objectives, « ＋ Objectif » (text « Nouvel objectif ») and « À la fin de
  l’étape » (actions). « ＋ Étape » adds a stage (« Nouvelle étape. »). The last remaining stage
  cannot be deleted.
- **Objective** (block « Objectif » with an id field and the list buttons): « Texte »; « Options »
  (« Facultatif », « Caché »); « Rempli quand » (a condition); « Ou à l’événement » (an event);
  « Progression » (tooltip « Affiche « valeur / total » à partir d’une variable »: a variable, then
  the total); « Cible (repère) » (the entity the objective points at, and its scene).
- **« Fin et échec »**: « À la fin de la quête » (actions), « Échoue quand » (a condition) and,
  once a failure condition is set, « En cas d’échec » (actions).

### 7.3 Cinematic editor

The 3D view stays visible above the editor and previews the camera at the playhead, computed with
the same function as the game (an entity followed by the camera is taken from the edited scene).
While the cinematic is the active tab, the view is moved back to that pose whenever the editor
redraws.

**Toolbar.**

- The title and « \<t> s / \<duration> s ».
- « ▶ Aperçu » / « ❚❚ Pause » plays the camera in the view; « ⏮ » returns to 0 s.
- « ＋ Clé caméra (vue actuelle) » (tooltip « Ajoute une clé de caméra au temps courant, depuis la vue
  de l’éditeur »): adds a camera key at the playhead from the current editor camera (it replaces a
  key at the same time; it creates the camera track if needed). To compose a shot: move the camera
  in the view, then click this button.
- « ＋ Ajouter… »: at the playhead, adds « Sous-titre » (3 s, text « Nouveau sous-titre. »), « Piste
  d’acteur (entité sélectionnée) » (a new actor track for the first selected entity), « Son ou
  musique », « Effet d’écran » (a white flash) or « Actions ».

The subtitle under the playhead is shown above the timeline.

**Timeline.** One lane per track: « Caméra », « Sous-titres », « Acteur : \<entity> », « Sons et
musique », « Effets d’écran », « Actions »; « ✕ » on a track label (« Supprimer la piste ») deletes
the track. Click the time ruler (the row labelled « Temps (s) ») or an empty part of a lane to move the
playhead. Click a key to inspect it (the playhead jumps to it), or a subtitle bar to inspect it; drag
either to change its time (rounded to 0.1 s; undo step « Déplacer une clé »).

**Right panel, no key selected: « Cinématique ».** « Titre (éditeur) », « Durée (s) » (0.5 to
300), « Le joueur peut la passer », « Bandes noires », « Joueur immobilisé », « Interface masquée »,
« Retour caméra » (« Fondu vers le joueur » / « Coupe franche »). The help text reminds that actions
marked « essentielles » and the end actions run even if the player skips the cinematic.

**Right panel, key selected** (header: track name and « Supprimer »):

| Track | Fields |
|---|---|
| Caméra | « Temps (s) », « Position », « Regarde », « Ou suit l’entité », « Champ (°) » (10–120), « Courbe » (easing), « Coupe franche (pas d’interpolation) », « Prendre la vue actuelle » |
| Sous-titres | « Temps (s) », « Durée (s) », « Locuteur » (tooltip « Clé du nom (ex. memory.npc.oriane) ou entité ; vide : narration »), « Texte » |
| Acteur | « Entité », « Temps (s) », « Animation », « Expression », « Regarde », « Va vers », « Dit (bulle) », « ＋ Clé d’acteur » (a key 1 s after the last one) |
| Sons et musique | « Temps (s) », « Son », « Musique », « Source (entité) » |
| Effets d’écran | « Temps (s) », « Effet » (« Fondu », « Éclair », « Secousse », « Teinte »), « Couleur », « Opacité de / vers » (fade), « Durée (s) », « Intensité » (shake) |
| Actions | « Temps (s) », « Essentielle (s’exécute même si la cinématique est passée) », the actions |

Below the timeline, « À la fin (même si le joueur passe la cinématique) » holds the end actions.

### 7.4 Logic editor

A logic file holds rules of the form « when [event] (filters), if [condition], then [actions], else
[actions] ». Heading « Logique — \<title> ».

- « Titre » (plain text, not a localization key).
- « Filtrer les règles… » filters by rule id, name or event id; « ＋ Règle » adds a rule named
  « Nouvelle règle » that reacts to `civ.started`. Without rules: « Aucune règle. Une règle réagit à
  un événement du jeu. ».
- Each rule: a checkbox (tooltip « Activée ») to enable or disable it, its name (« Nom de la
  règle »), its id (not editable), and the list buttons including « ⧉ » (« Dupliquer »).
- « Quand » (event and filters), « Si » (condition), « Alors » (actions), « Sinon » (actions; shown
  once the rule has a condition or « Sinon » actions), « Options » › « Une seule fois par partie »,
  « Scène » (tooltip « Limiter la règle à une scène (vide : toutes) »).

### 7.5 Items editor

Heading « Objets »: the list of the pack's items (colour swatch and name) on the left, the selected
item on the right.

- « ＋ Objet »: a new item `<pack>:objet` (then `objet_2`…) named « Nouvel objet ».
- « Identifiant » (free text; references elsewhere are not updated), « Nom », « Description »,
  « Catégorie » (« Clé », « Objet de quête », « Document », « Outil », « Consommable »,
  « Équipement », « À collectionner », « Divers »), « Icône » (« Forme », « Couleur », « Accent »,
  « Lumineux »), « Objet de quête (ne se jette pas) », « Empilable », « Pile maximale », « Étiquettes ».
- « Supprimer l’objet ». Without items: « Aucun objet. ».

### 7.6 Characters editor

Heading « Personnages »: the list of character appearances, their fields, and a live 3D preview
(« Glisser pour tourner autour, molette pour zoomer. »).

- « ＋ Personnage »: a copy of the selected appearance (or a default one) with the id
  `<pack>:personnage` (then `personnage_2`…) and the name « Nouveau personnage ».
- « Identifiant », « Nom affiché », « Corps » (« Silhouette »: « Adulte », « Mince », « Carré »,
  « Enfant », « Âgé »; « Taille »), « Peau », « Yeux », « Cheveux » (« Coiffure », « Couleur »),
  « Visage » (« Sourcils », « Taches de rousseur », « Joues rosées », « Cicatrice », « Rides »),
  « Vêtements » (« Tenue », « Haut », « Bas », « Chaussures », « Accent »), « Accessoires »,
  « Attitude » (« Calme », « Nerveux », « Fier », « Fatigué », « Enjoué »), « Hauteur de voix (bips) ».
- « Supprimer le personnage ». Without characters: « Aucun personnage. ».

### 7.7 Mechanic rules editor

Heading « Règles des mécaniques » (file `content/rules.json`). Each mechanic of the pack that
declares settings in its code gets a section (label, id, description) with those settings as fields;
the values are stored in the file and read by the mechanic when the civilization starts. Without
such mechanics: « Aucune mécanique réglable dans ce pack. ».

### 7.8 French texts

Heading « Textes français — \<pack> », with the number of texts.

- « Chercher une clé ou un texte… » filters by key or text; at most 400 lines are shown (« \<n>
  autres textes : affinez la recherche. »).
- A key field (placeholder `<pack>.nouvelle.cle`) and « ＋ Clé » add an empty key (letters, digits,
  `.`, `_`, `-`; the button stays disabled for an invalid or existing key).
- The table « Clé » / « Texte »: edit the text in place (empty texts are flagged; texts longer than
  60 characters get a multi-line area). « ✕ » (tooltip « Supprimer la clé (vérifiez d’abord qu’elle
  n’est plus utilisée : « Valider ») ») deletes a key.

### 7.9 Civilization and interface (manifest)

Heading « Civilisation « \<id> » ». Left column:

- **« Identité »**: « Nom », « Accroche », « Description » (texts), « Version du pack », « API du
  moteur » (tooltip « Plage semver de l’API du moteur pour laquelle le pack est écrit »), « Ordre dans
  la sélection ».
- **« Point d’entrée »**: « Scène » and « Apparition » (a spawn point) where a new game starts.
- **« Multivers »**: « Écritures globales autorisées » (paths such as `fragments.mon_fragment`) and
  « Fragments du registre multiversel » (each: « Identifiant », « Nom », « Indice », « Icône »).
- **« Divers »**: « Dépendances », « Crédits », « Mots-clés ».

Right column:

- **« Interface (HUD) »**: a preview of the game's HUD in the pack's theme, and « Éléments affichés »:
  « Réticule », « Invite d’interaction », « Objectifs suivis », « Notifications », « Inventaire
  (touche I) », « Barre de capacités », « Titre des lieux ». The preview updates with each change
  (it has no inventory element).
- **« Thème »**: « Accent », « Accent secondaire », « Texte », « Texte atténué », « Fond des panneaux
  (CSS) », « Bordure des panneaux (CSS) », « Police du texte », « Police des titres ».
- **« Vignette de sélection »**: « Dégradé » (colours) and « Motif » (« Sobre », « Porte »,
  « Éclats »).

### 7.10 Prefab editor

Heading « Préfabriqué — \<name> »: « Nom », « Catégorie », « Contenu » (size in blocks or « sans
blocs », and the entity ids), and « Placer dans la scène ouverte » (disabled without an open scene),
which pastes the prefab in front of the editor camera as described in [§6](#6-prefabs) and then shows
a scene tab.

---

## 8. Scripts and hot reload (development server only)

The « Scripts » group of the Explorer, script creation and the code editor exist only under
`npm run dev`.

### 8.1 What the page does with code

The code you type is never evaluated by the Studio page. « Enregistrer et recharger » writes the file
through the dev server's file API; Vite then compiles it like any other source module, and the
Studio re-imports the pack's compiled modules. Type errors come from the project's TypeScript
service running in the dev server, with the project's `tsconfig.json` and SDK types (the same
settings as `npm run typecheck`).

### 8.2 Creating a script

« ＋ » on the « Scripts » group (tooltip « Nouveau script ») opens « Nouveau script »:

- « Type »: « Comportement (composant d’entité) », « Action de logique », « Condition de logique » or
  « Mécanique (règle du monde) »;
- « Nom » (placeholder « Porte à résonance »).

« Créer le script » asks the dev server to write `civilizations/<pack>/mechanics/<name>.ts` at once,
from a typed template. The file name and the definition id derive from the name: accents removed,
other characters used as word separators, camelCase (« Porte à résonance » → `porteAResonance.ts`,
id `<pack>.porteAResonance`). An existing file is refused (« Le fichier existe déjà : \<path> »), as
is an empty name (« Nom de script vide. »). The script opens in the code editor, and the journal
shows « Script créé : \<path> (identifiant \<id>) ».
Each pack's `pack.ts` loads every module of `mechanics/` automatically, so the Studio reloads the
pack's code and the new definition appears in its menu (« ＋ Ajouter un composant… », the action and
condition lists, « Règles des mécaniques »).

| Template | What it defines |
|---|---|
| « Comportement (composant d’entité) » | A component the player can interact with: an interaction prompt, a message and a list of actions run on interaction. |
| « Action de logique » | An action with a « Message » property that shows a notification. |
| « Condition de logique » | A condition « Variable » ≥ « Valeur minimale ». |
| « Mécanique (règle du monde) » | A mechanic with a saved, versioned state counting the interactions. |

### 8.3 Code editor

Scripts open in a Monaco editor (dark theme). Its bar shows:

- the file path, followed by ● while the file is modified;
- « Vérifier les types » (« Vérification… » while it runs);
- « Enregistrer et recharger (Ctrl+S) », enabled while the file is modified.

Under the code, the type-check results: « Vérification des types en cours… », « Aucune erreur de type
dans la version enregistrée. », or one line per problem (« \<line>:\<column> \<message> »); click a line
to jump to it. Problems are also underlined in the code.

- **Type checking** runs when the editor opens, after « Enregistrer et recharger », and on « Vérifier
  les types ». It checks the **saved** file on disk: unsaved changes are only checked for syntax, by
  the editor itself. The first check after the dev server starts can take a few seconds. The journal
  logs « Vérification des types de \<path> : \<n> erreur(s) (\<ms> ms). ».
- **Ctrl+S inside the code editor** saves only that script (the Studio's global Ctrl+S does not run).
  Saving with « 💾 Enregistrer » writes modified scripts too, but does not refresh the type-check
  panel.
- **Undo** inside the code editor is the editor's own (Ctrl+Z with the focus in the code). Script
  edits are not part of the Studio's history, and a script stays modified until saved, even if you
  undo back to its saved text.
- **Which scripts can be saved**: files under `mechanics/` and `ui/` (the dev API also accepts
  `scripts/`). Other script files of the pack (`pack.ts`, `assets/`, `view/`, `core`'s `models/`,
  `seed/`, `tests/`) are listed and can be edited, but saving them fails with « Écriture interdite
  hors de : content, mechanics, ui, locales, scripts. ».

### 8.4 Hot reload

Whenever a `.ts` / `.tsx` file of a pack changes on disk — saved by the Studio or by another editor —
except files under `seed/`, under `tests/` and `*.test.ts` files:

1. the journal shows « Script modifié : \<path> » (« Script ajouté : … » / « Script supprimé : … » for
   new and deleted files, and the Explorer's list is refreshed);
2. if that pack is loaded in the Studio, its code is reloaded without reloading the page, and so is
   the active pack's when it depends on it (for a change in `core`): « Code du pack « \<id> »
   rechargé. »;
3. the edited scene is closed and reopened with the new definitions: unsaved block and entity edits
   are kept, the selection is cleared, and the camera returns to the scene's memorized view
   ([§3](#3-navigating-the-3d-view)).

If the new code cannot be loaded (for example a syntax error), the journal shows « Rechargement du
code impossible : \<error> ». The pack's definitions and texts are then unloaded in the Studio —
components show as unknown and texts as keys — until a later save loads correctly. Type errors alone
do not prevent loading.

JSON files of `content/` and `locales/` changed by another program are handled too:

- a document already read by the Studio (all JSON documents of the opened pack and its
  dependencies are) and without unsaved changes is reloaded (« Rechargé depuis le disque : \<path> »);
- a document with unsaved changes is kept, with the warning « Modifié sur le disque pendant que vous
  l’éditiez : \<path> » (the next save of that file will be refused, [§11.5](#115-conflicts-and-changes-made-outside-the-studio));
- created or deleted files appear in or disappear from the Explorer (a deleted file that holds
  unsaved changes stays).

---

## 9. Validation

« ✔ Valider » (top bar) and « Relancer la validation » (« Problèmes » tab) check the active pack:

- The pack and its dependencies are loaded in a separate, headless game session from the Studio's
  working copies — unsaved changes included. The pack's code is the version last saved and compiled.
- The checks are those of `npm run validate`: content schemas; references (dialogues, quests,
  cinematics, scenes, spawn points, entities, items, character appearances, models, blocks, sounds,
  music, panels, abilities, component, action and condition types, events); variables written
  outside the civilization's namespace; every player-visible text key exists in French, including
  keys written literally in the pack's scripts (`t('…')`).
- The window shows « Validation de la civilisation… »; then the journal logs « Validation : \<n>
  erreur(s), \<m> avertissement(s). » and the console switches to « Problèmes ».

« Problèmes » lists errors (✖) and warnings (⚠) with their file and location inside the file
(« — content/scenes/verrou.scene.json · entities.cell_door… »). Clicking a line opens its file. A
clean pack shows « Aucun problème : \<n> scènes, \<n> entités, \<n> dialogues, \<n> quêtes, \<n>
cinématiques, \<n> textes vérifiés. ».

Validating the library pack `core` reports that it is a library, not a playable civilization.

---

## 10. Playtest

The playtest runs the real game — the same controller, renderer, camera, audio, input and HUD as
`index.html` — over the whole window.

| Button | Starts |
|---|---|
| « ▶ Jouer ici » | A new run in the edited scene, with the player placed at the editor camera (1.6 m lower, same direction). The start-of-civilization event `civ.started` is not sent, so the rules and cinematics that react to it do not run. Disabled when no scene is open. |
| « ▶ Depuis le début » | A new run from the manifest's entry scene and spawn point, as a new game. |

**What is tested.** The Studio's working copies of the pack and its dependencies — unsaved changes
included. Scripts: the version last saved and compiled; unsaved script edits are not tested.

**During the test.**

- The bar of the test shows « Test en cours — ici » or « Test en cours — depuis le début », the hint
  « Échap : libérer la souris · F8 : arrêter », « ↺ Recommencer » (tooltip « Relancer le test ») and
  « ■ Arrêter ».
- Échap releases the mouse; the game then opens its pause menu.
- F8 stops the test at any time, even while the game holds the mouse.
- « ↺ Recommencer » starts a new run with a new game session.
- Leaving the game for its menus — for example « Quitter vers le menu » in its pause menu — also
  ends the test.
- Errors and warnings of the game session appear in the Studio's journal, prefixed with « [test] ».
- The Studio's shortcuts are disabled and its 3D view is paused.

**Saves and settings.** Saves made during a test (pause menu « Sauvegarder », quick save) are kept in
memory and discarded when the test stops or restarts; the game's own saves are not touched. Settings
changed in the pause menu « Paramètres » are stored in the browser like the game's settings.

The journal shows « Test de « \<scene> » depuis la caméra de l’éditeur. » or « Test de « \<pack> »
depuis le début. » when a test starts, « Test arrêté : retour à l’édition. » when it stops, and
« Impossible de lancer le test : \<error> » when it cannot start. A test from the start of the library
pack `core` fails because `core` is not a playable civilization.

---

## 11. Saving, undo/redo, conflicts and backups

### 11.1 Working copies and the modified state

The Studio edits working copies of the files in memory. A document becomes modified as soon as it
is changed; undoing back to the state last read or saved makes it unmodified again (changing a value
back by hand does not). Modified documents are shown by ● on their tab and in the Explorer, by the
count of « 💾 Enregistrer » and by the status bar. Closing the page or reloading it with modified documents
makes the browser ask for confirmation.

### 11.2 Saving

« 💾 Enregistrer » or Ctrl+S writes every modified document, one file after another:

- the journal shows « Enregistré : \<path> » for each file (click to open it) or « Échec de
  l’enregistrement de \<path> : \<reason> »; a failure does not stop the other files, and the failed
  file stays modified;
- with nothing modified, the journal says « Rien à enregistrer. »;
- the live blocks of the edited scene are written into its document first;
- JSON files are written with two-space indentation and a final newline;
- new documents (« Nouveau : … », prefabs, the French table created for a first text) are written on
  their first save.

Every modified document held in memory is saved, including those whose tab is closed and those of a
pack you switched away from: changing pack does not discard working copies, it only empties the undo
history.

### 11.3 Undo and redo

- « ↶ » / Ctrl+Z undoes, « ↷ » / Ctrl+Y or Ctrl+Shift+Z redoes. The keyboard shortcuts are ignored
  while the focus is in a form field or in the code editor ([§12](#12-keyboard-and-mouse-reference)).
- There is one history for all documents: undo reverts the most recent change wherever it was made,
  even in a document that is not displayed. The tooltip of « ↶ » and « Dernière action : … » in the
  status bar name the step.
- Continuous edits form one step: typing in a field, moving a slider or a colour picker (changes of
  the same field less than 1.2 s apart are merged), a gizmo drag, a block stroke. Compound operations
  (adding an entity with its texts, a new dialogue choice with its text, placing a prefab…) are one
  step as well.
- The history keeps 300 steps and is emptied when a pack is opened.
- Not in the history: script edits ([§8.3](#83-code-editor)), the creation of documents and prefabs
  (only the texts and manifest entry created with a document are undoable), « Nouveau script ».

### 11.4 Where files are written

| Content | File |
|---|---|
| Blocks, entities, environment, memorized view and notes of a scene | `content/scenes/<id>.scene.json` |
| Dialogues, quests, cinematics, logic, prefabs | `content/<kind>/<id>.<kind>.json` (`dialogues/…dialogue.json`, `quests/…quest.json`, `cinematics/…cinematic.json`, `logic/…logic.json`, `prefabs/…prefab.json`) |
| Items, characters, mechanic settings | `content/items.json`, `content/characters.json`, `content/rules.json` |
| French texts (always those of the active pack) | `locales/fr-FR.json` |
| Pack settings, HUD, theme | `manifest.json` |
| Scripts | `mechanics/`, `ui/` |

All paths are relative to `civilizations/<pack>/`. The dev file API writes only the pack's
`manifest.json` and files under `content/`, `mechanics/`, `ui/`, `locales/` and `scripts/`, with the
extensions `.json`, `.ts` and `.tsx`. It refuses to write invalid JSON (« JSON invalide, fichier non
écrit : … »). Each write goes to a temporary file that is then renamed over the target, so a file is
never left half-written.

### 11.5 Conflicts and changes made outside the Studio

Each document remembers the modification time of its file when it was read or last written. When you
save, the dev server compares it with the file on disk; if the file has changed in between, the save
is refused and the journal shows « Échec de l’enregistrement de \<path> : Le fichier a été modifié sur
le disque depuis son ouverture. ». The document stays modified in the Studio. New documents are
written without this check.

The Studio has no command to overwrite or merge in that case. To continue from the disk version:
save the other files, then reload the page (the Studio's unsaved changes to that file are lost). See
[§8.4](#84-hot-reload) for files reloaded automatically when they change on disk.

### 11.6 Backups

Before overwriting a file, the dev server copies the previous version to `.civ-backups/` at the root
of the repository, under the same path with a timestamp:

```
.civ-backups/civilizations/door/content/scenes/verrou.scene.json.2026-10-12T05-32-02-397Z.write.bak
```

A file deleted through the API is moved there as `….delete.bak` (the Studio has no command that
deletes files). `.civ-backups/` is ignored by git and never cleaned automatically. To restore a
version, copy the backup over the file. « Nouveau script » creates no backup: it refuses to replace an
existing file.

---

## 12. Keyboard and mouse reference

Shortcuts are matched by **physical key position** (`KeyboardEvent.code`), named after a QWERTY
layout. On an AZERTY keyboard:

| Shortcut (QWERTY name) | Key to press on AZERTY |
|---|---|
| W (gizmo « Déplacer »; camera forward) | Z |
| A (camera left) | Q |
| Q (camera down) | A |
| Ctrl+Z (undo) | Ctrl + the key printed W — which browsers use to close the tab: on AZERTY, use « ↶ » to undo |
| Ctrl+Shift+Z (redo) | use Ctrl+Y instead |

E, R, S, D, F, Y and the digit row are in the same place on both layouts. Tool keys are the 1–6 keys
of the main keyboard's top row, with or without Shift; the numeric keypad does not select tools.

When a shortcut applies:

- **Ignored** while the focus is in a form control — text or number field, text area, drop-down list,
  checkbox, slider — or in the code editor (except Ctrl+S). Click the 3D view to give it the focus back.
- **"View" shortcuts** need, in addition, the 3D view to be displayed (a scene or cinematic tab is
  active, or no tab), and the right mouse button not to be held.
- **All Studio shortcuts are disabled during a playtest.**

| Keys | Condition | Action |
|---|---|---|
| Ctrl+S | anywhere (also in fields) | Save all modified files. In the code editor: save that script only. |
| Ctrl+Z | not in a field | Undo |
| Ctrl+Y, Ctrl+Shift+Z | not in a field | Redo |
| Ctrl+D | view | Duplicate the selected entities |
| Delete, Backspace | view | Delete the selected entities (also when a cinematic is displayed: they act on the scene's entities, not on timeline keys) |
| 1 … 6 | view | « ⬚ Sélection », « ▣ Poser », « ⌫ Effacer », « 🖌 Peindre », « ▤ Boîte », « ⌖ Pipette » |
| W, E, R | view, « ⬚ Sélection » active | Gizmo « ✥ Déplacer », « ⟳ Tourner », « ⤢ Échelle » |
| F | view | Frame the selected entity |
| Échap | view | Cancel the first corner of a box |
| Right button held + mouse | 3D view | Look around |
| Right button held + W A S D / arrows, Q / E, Shift | 3D view | Fly; down / up; faster |
| Wheel (Shift: bigger steps) | 3D view | Forward / back |
| Middle button drag | 3D view | Pan |
| Left click / drag | 3D view | Current tool ([§4.1](#41-tools)) |
| Shift + click | « ▤ Boîte » | Corner on the clicked block; second click empties the box |
| Ctrl+click, Shift+click | « ⬚ Sélection », Hierarchy | Add or remove / add to the selection |
| Double-click | Hierarchy | Frame the entity |
| Middle click | tab | Close the tab |
| Enter | « Identifiant » of an entity; « Identifiant » of the new-document dialog | Apply the new id; create the document |
| Échap | dialog | Close it (as « Annuler ») |
| Drag, wheel | character preview | Turn around, zoom |
| Échap | playtest | Release the mouse (the game opens its pause menu) |
| F8 | playtest | Stop the test |

---

## 13. Limitations

**Scenes and the 3D view**

- One scene is edited at a time. The size of a scene is chosen at creation and cannot be changed.
- The 3D view renders with a fixed quality preset; it has no settings.
- Échap does not clear the selection: it only cancels a pending box corner. To deselect, click a block
  or the sky with « ⬚ Sélection ».
- The gizmo works on one entity at a time; a multiple selection is moved with « Décaler de ».
- Snapping applies to gizmo drags only; new entities are rounded to 0.5 m and prefabs to whole blocks
  regardless of it. The scale step (0.25) cannot be changed.
- When the edited scene's file is changed on disk by another program and reloaded, its entities and
  environment are refreshed in the view, but its blocks are not. A later block edit, once saved,
  writes the Studio's blocks back over the outside change (the overwritten version is in
  `.civ-backups/`). Reload the page after editing an open scene file outside the Studio.
- After previewing a cinematic whose camera keys use another field of view than 70° (keys created
  with a new cinematic use 60°), the 3D view keeps that field of view until the page is reloaded.
- « ▤ Boîte » is limited to 200 000 blocks per box; prefabs to 64 blocks per axis.
- The block palette and the « ＋ Ajouter » and « ❖ Préfabriqués » menus close as soon as the mouse
  leaves them.

**Documents**

- There is no command to delete, rename or move a document, nor to discard the unsaved changes of one
  file. A document created by mistake is written by the next save unless the page is reloaded without
  saving (which loses every other unsaved change too).
- Creating a document is not undoable. For a scene, a dialogue or a quest, undo removes only the texts
  (and, for a scene, the manifest entry) created with it; a new cinematic or logic file records no
  undo step at all, so Ctrl+Z right after creating one undoes the previous, unrelated change.
- `items.json`, `characters.json` and `rules.json` cannot be created from the Studio.
- Renaming an entity, an item, a character, a quest stage or objective, or a dialogue choice does not
  update the references to it. Renaming a dialogue node updates the links of that dialogue only. Run
  « ✔ Valider » after renaming.
- Deleting an entity, a node or an item leaves its text keys in the French table; the « Textes »
  editor deletes keys one by one.
- Copies of entities share the text keys of their originals ([§5.8](#58-texts-and-localization-keys)).
- Clicking a dialogue node, or a key of the cinematic timeline, records a move (an undo step, and the
  document becomes modified) even when it is not dragged. In a dialogue, it also fixes the node's
  position, which « Réorganiser » releases.
- Inside a dialogue branch, the « ✕ » of the branch's condition does nothing (a branch always has a
  condition); delete the branch with its own « ✕ ». In a logic rule, choosing « Aucun événement » in
  « Quand » is ignored. The « ✕ » of the last stage of a quest does nothing.
- Clicking a problem of the « Problèmes » list opens its file, not the entity or field named in its
  location.
- « Placer dans la scène ouverte » (prefab editor) places the prefab in the edited scene, then shows
  the first scene tab, which can be another scene when several are open.

**Text fields**

- In a single-line text field, the field becomes a multi-line area when the text passes 48 characters
  (60 in the « Textes » table) and the cursor leaves it: click the field again to continue typing.
- « Étiquettes » removes a comma or a space as soon as it is typed at the end of the field, so tags
  cannot be typed one after the other: paste the whole list (`garde, ronde`), or type the comma
  between two letters already typed.
- In « Taille (blocs) » (new scene), each keystroke is immediately limited to 8–256, so a value such
  as 128 cannot be typed digit by digit from an empty field: use the field's arrows or edit the
  existing digits.

**Keyboard**

- Shortcuts follow QWERTY key positions ([§12](#12-keyboard-and-mouse-reference)): on AZERTY, Ctrl+Z
  does not undo (use « ↶ »), and the tooltips « (W) » and « Ctrl+Z » name QWERTY keys.
- Shortcuts are ignored while the focus is in any form control, including checkboxes, sliders and
  drop-down lists: Ctrl+Z right after ticking a checkbox does nothing. Click the 3D view (or outside
  the form controls) first, or use « ↶ ».
- While a cinematic is displayed, Delete, Backspace and Ctrl+D act on the selected scene entities.

**Packs**

- Switching pack keeps the previous pack's working copies in memory (they are saved by the next
  « 💾 Enregistrer ») and does not unload the previous pack's definitions: its blocks, components,
  actions and conditions stay offered in the palette and menus until the page is reloaded. Validation
  reports the ones the active pack cannot use.
- The Studio cannot create a pack: use `npm run civ -- new-pack <id> [--name "<nom>"]`, then reload
  the Studio.
- « ✔ Valider » and « ▶ Depuis le début » only apply to civilization packs; `core` is a library.
- `npm run civ -- seed <pack> --force` regenerates a pack's content from its `seed/` scripts and
  overwrites the files edited in the Studio, without backup.
- Changes to `manifest.json` made outside the Studio are not among the changes the Studio reloads
  automatically ([§8.4](#84-hot-reload) covers `content/`, `locales/` and scripts).

**Scripts**

- The code editor and type checking exist only under `npm run dev`. Type checking reads the saved file
  on disk.
- The « Scripts » group also lists the files of `seed/` and `tests/`, although they are not part of
  the pack's code. They cannot be saved, and type checking a `seed/` file fails (« Vérification
  impossible : … »; the panel then stays on « Vérification des types en cours… »).
- Only scripts under `mechanics/` and `ui/` (and `scripts/`) can be saved; `pack.ts`, `assets/`,
  `view/` and `models/` files can be edited but not saved. A file whose save failed stays modified
  until the page is reloaded.
- CSS and Markdown files of a pack are not listed and cannot be edited.
- A script changed by another program is not refreshed in the code editor (its pack's code is
  reloaded, but the editor keeps the old text, and saving from it is then refused as a conflict).
- After a failed code reload, the pack's definitions and texts stay unloaded in the Studio until a
  correct version is saved ([§8.4](#84-hot-reload)).

**Read-only mode and playtest**

- In read-only mode nothing can be saved, and scripts are not available.
- Playtest saves are discarded; settings changed during a test are kept by the browser.
