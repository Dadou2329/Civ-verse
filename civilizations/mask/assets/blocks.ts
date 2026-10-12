import { defineBlock, type BlockDef } from '@sdk';

/**
 * Viremasque's materials. The Rives Basses are warm and worn: ochre and pink plasters, painted
 * wood chipped by years of carts, terracotta roofs, warm cobbles, green canals and plants growing
 * where they like. The upper tiers seen above (and visited later) each have their own palette:
 * bright facades and awnings for the Toits du Fil, dark red iron for the Bastion, clear glass for
 * the Terrasses, white marble and gold for the Jardins d'Or.
 */
const b = (def: BlockDef) => defineBlock(def);
const tex = (gen: string, colors: string[], params?: Record<string, number>, seed = 0) => ({ gen, colors, params, seed });

const WARM_COBBLE = tex('cobble', ['#9c8068', '#5a4434', '#bca084'], { stones: 9 }, 2);
const WORN_STONE = tex('stone', ['#8f857a', '#5d554c', '#aca296'], { cracks: 2 }, 5);
const QUAY = tex('tiles', ['#a8977f', '#695a49', '#bfae95'], { tile: 8 }, 3);
const TERRACOTTA = tex('roofTiles', ['#b9572f', '#7a3119', '#da7a4c']);
const OCHRE = tex('plaster', ['#d8a35a', '#b07a38'], {}, 4);
const PINK = tex('plaster', ['#d88c78', '#ab6250'], {}, 9);
const CREAM = tex('plaster', ['#e7d7b3', '#c1ad88'], {}, 11);
const WATER = tex('frosted', ['#3d8a7c', '#1b4c44'], { alpha: 0.8 });

const painted = (id: string, label: string, paint: string, seed: number) =>
  b({ id, label, category: 'Rives Basses — Bois peints', sound: 'wood', textures: { all: tex('paintedPlanks', ['#8a6440', '#4a321e', '#a87e54', paint], {}, seed) } });

export const maskBlocks = [
  // --- Rives Basses: sols et pierre -----------------------------------------------------------
  b({ id: 'mask:pave_chaud', label: 'Pavés chauds des Rives', category: 'Rives Basses — Sols', textures: { all: WARM_COBBLE } }),
  b({ id: 'mask:pave_chaud_dalle', label: 'Dalle de pavés chauds', category: 'Rives Basses — Sols', shape: 'slab', textures: { all: WARM_COBBLE } }),
  b({ id: 'mask:pierre_usee', label: 'Pierre usée', category: 'Rives Basses — Sols', textures: { all: WORN_STONE } }),
  b({ id: 'mask:pierre_usee_dalle', label: 'Dalle de pierre usée', category: 'Rives Basses — Sols', shape: 'slab', textures: { all: WORN_STONE } }),
  b({ id: 'mask:quai', label: 'Dalles de quai', category: 'Rives Basses — Sols', textures: { all: QUAY } }),
  b({ id: 'mask:moellons', label: 'Moellons de canal', category: 'Rives Basses — Sols', textures: { all: tex('stoneBricks', ['#7d7468', '#4a433a', '#988e80'], {}, 8) } }),
  b({ id: 'mask:terre', label: 'Terre battue', category: 'Rives Basses — Sols', sound: 'earth', textures: { all: tex('dirt', ['#7a5a3c', '#4e3824', '#93714f']) } }),
  b({
    id: 'mask:herbe',
    label: 'Herbe des berges',
    category: 'Rives Basses — Sols',
    sound: 'earth',
    textures: {
      top: tex('grassTop', ['#6f9a3c', '#4a7226', '#8fb84f']),
      side: tex('grassSide', ['#6f9a3c', '#4a7226', '#8fb84f', '#7a5a3c', '#4e3824', '#93714f']),
      bottom: tex('dirt', ['#7a5a3c', '#4e3824', '#93714f']),
    },
  }),
  b({ id: 'mask:eau_canal', label: 'Eau du canal', category: 'Rives Basses — Sols', solid: false, transparency: 'blend', textures: { all: WATER } }),
  // --- Rives Basses: murs -----------------------------------------------------------------------
  b({ id: 'mask:enduit_ocre', label: 'Enduit ocre', category: 'Rives Basses — Murs', textures: { all: OCHRE } }),
  b({ id: 'mask:enduit_rose', label: 'Enduit rose', category: 'Rives Basses — Murs', textures: { all: PINK } }),
  b({ id: 'mask:enduit_creme', label: 'Enduit crème', category: 'Rives Basses — Murs', textures: { all: CREAM } }),
  b({ id: 'mask:colombage_ocre', label: 'Colombage ocre', category: 'Rives Basses — Murs', textures: { all: tex('timber', ['#d8a35a', '#b07a38', '#5a3a22'], { beam: 2, brace: 1 }, 6) } }),
  b({ id: 'mask:colombage_rose', label: 'Colombage rose', category: 'Rives Basses — Murs', textures: { all: tex('timber', ['#d88c78', '#ab6250', '#4a2e1e'], { beam: 2, brace: -1 }, 7) } }),
  b({ id: 'mask:brique_rives', label: 'Briques des Rives', category: 'Rives Basses — Murs', textures: { all: tex('bricks', ['#b5603a', '#6e3420', '#cf7e54'], {}, 3) } }),
  b({ id: 'mask:affiches', label: 'Mur d’affiches', category: 'Rives Basses — Murs', textures: { all: tex('posters', ['#d8a35a', '#f2e2c0', '#3a2a1e', '#e8743a'], { sheets: 3 }) } }),
  b({ id: 'mask:vitre_atelier', label: 'Vitre d’atelier', category: 'Rives Basses — Murs', sound: 'glass', transparency: 'blend', opaque: false, textures: { all: tex('glass', ['#d6eee6', '#4e5e58'], { alpha: 0.42 }) } }),
  // --- Rives Basses: bois peints ---------------------------------------------------------------
  painted('mask:bois_bleu', 'Bois peint bleu', '#3f78a8', 1),
  painted('mask:bois_rouge', 'Bois peint rouge', '#b5402e', 2),
  painted('mask:bois_vert', 'Bois peint vert', '#4f8a4a', 3),
  painted('mask:bois_jaune', 'Bois peint jaune', '#e2b23c', 4),
  painted('mask:bois_sarcelle', 'Bois peint sarcelle', '#2f8a86', 5),
  b({ id: 'mask:planches', label: 'Planches de chêne', category: 'Rives Basses — Bois peints', sound: 'wood', textures: { all: tex('planks', ['#a67a4a', '#5a3e22', '#c4965e'], {}, 2) } }),
  b({ id: 'mask:planches_dalle', label: 'Dalle de planches de chêne', category: 'Rives Basses — Bois peints', sound: 'wood', shape: 'slab', textures: { all: tex('planks', ['#a67a4a', '#5a3e22', '#c4965e'], {}, 2) } }),
  b({
    id: 'mask:poutre',
    label: 'Poutre',
    category: 'Rives Basses — Bois peints',
    sound: 'wood',
    textures: { side: tex('logSide', ['#6a4628', '#3a2414', '#8a6038']), top: tex('logTop', ['#a07448', '#4a3018']), bottom: tex('logTop', ['#a07448', '#4a3018']) },
  }),
  // --- Toits -------------------------------------------------------------------------------------
  b({ id: 'mask:tuile', label: 'Tuiles de terre cuite', category: 'Rives Basses — Toits', textures: { all: TERRACOTTA } }),
  b({ id: 'mask:tuile_dalle', label: 'Dalle de tuiles', category: 'Rives Basses — Toits', shape: 'slab', textures: { all: TERRACOTTA } }),
  b({ id: 'mask:tuile_vernie', label: 'Tuiles vernissées vertes', category: 'Rives Basses — Toits', textures: { all: tex('roofTiles', ['#4f8a5a', '#24502e', '#7ab884']) } }),
  b({ id: 'mask:tuile_vernie_dalle', label: 'Dalle de tuiles vertes', category: 'Rives Basses — Toits', shape: 'slab', textures: { all: tex('roofTiles', ['#4f8a5a', '#24502e', '#7ab884']) } }),
  // --- Toiles et métal ---------------------------------------------------------------------------
  b({ id: 'mask:toile_rayee', label: 'Toile rayée d’auvent', category: 'Rives Basses — Toiles', sound: 'cloth', textures: { all: tex('cloth', ['#efe2c2', '#a8946e', '#c0402e'], { stripes: 4 }, 1) } }),
  b({ id: 'mask:toile_sarcelle', label: 'Toile sarcelle', category: 'Rives Basses — Toiles', sound: 'cloth', textures: { all: tex('cloth', ['#2f8a86', '#1e5e5a', '#5ab4ae'], { stripes: 0 }, 2) } }),
  b({ id: 'mask:metal_rivete', label: 'Tôle rivetée', category: 'Rives Basses — Métal', sound: 'metal', textures: { all: tex('metal', ['#6a6e70', '#3a3e40', '#9aa0a2'], { rivets: 1 }, 1) } }),
  b({ id: 'mask:metal_rouille', label: 'Tôle rouillée', category: 'Rives Basses — Métal', sound: 'metal', textures: { all: tex('metal', ['#8a5a3a', '#4a2e1c', '#b07a4a'], { rivets: 1 }, 2) } }),
  b({ id: 'mask:rail', label: 'Rail du monte-charge', category: 'Rives Basses — Métal', sound: 'metal', shape: 'slab', textures: { all: tex('grate', ['#4a4a4c', '#1e1e20', '#7a7a7e']) } }),
  b({ id: 'mask:grille', label: 'Grille', category: 'Rives Basses — Métal', sound: 'metal', transparency: 'cutout', opaque: false, textures: { all: tex('grate', ['#4a4a4e']) } }),
  // --- Végétation -----------------------------------------------------------------------------
  b({
    id: 'mask:herbe_folle',
    label: 'Herbes folles',
    category: 'Rives Basses — Végétation',
    sound: 'plant',
    shape: 'cross',
    transparency: 'cutout',
    opaque: false,
    solid: false,
    textures: { all: tex('plant', ['#6a9a3a', '#3e6a22', '#e8d24a', '#f2e27a'], { stems: 6 }) },
  }),
  b({
    id: 'mask:fleurs_rouges',
    label: 'Coquelicots',
    category: 'Rives Basses — Végétation',
    sound: 'plant',
    shape: 'cross',
    transparency: 'cutout',
    opaque: false,
    solid: false,
    textures: { all: tex('plant', ['#5a8a3a', '#2e5a1e', '#d83a2a', '#f26a4a'], { stems: 4 }, 2) },
  }),
  b({ id: 'mask:lierre', label: 'Lierre', category: 'Rives Basses — Végétation', sound: 'plant', transparency: 'cutout', opaque: false, textures: { all: tex('leaves', ['#4a7a2e', '#2a4a1a', '#6a9a3e']) } }),
  b({ id: 'mask:feuillage', label: 'Feuillage', category: 'Rives Basses — Végétation', sound: 'plant', transparency: 'cutout', opaque: false, textures: { all: tex('leaves', ['#5a8a3a', '#2e5a1e', '#7ab04e'], {}, 3) } }),
  // --- Lumières ----------------------------------------------------------------------------------
  b({ id: 'mask:lanterne', label: 'Lanterne des Rives', category: 'Rives Basses — Lumières', emissive: true, light: { level: 13, color: '#ffc070' }, textures: { all: tex('lamp', ['#ffd590', '#4a2e1a']) } }),
  b({ id: 'mask:braise', label: 'Braise de forge', category: 'Rives Basses — Lumières', emissive: true, light: { level: 11, color: '#ff7a3a' }, textures: { all: tex('crystal', ['#ff8a3a', '#7a2a10', '#ffd08a']) } }),
  // --- Étages supérieurs (vus d'en bas) -------------------------------------------------------------
  b({ id: 'mask:fil_facade_bleue', label: 'Façade du Fil (bleue)', category: 'Viremasque — Étages', textures: { all: tex('plaster', ['#4a9ad0', '#2a6a9a'], { cracks: 0 }, 2) } }),
  b({ id: 'mask:fil_facade_jaune', label: 'Façade du Fil (jaune)', category: 'Viremasque — Étages', textures: { all: tex('plaster', ['#f2c84a', '#c89a2a'], { cracks: 0 }, 3) } }),
  b({ id: 'mask:fil_facade_corail', label: 'Façade du Fil (corail)', category: 'Viremasque — Étages', textures: { all: tex('plaster', ['#f2805a', '#c8583a'], { cracks: 0 }, 4) } }),
  b({ id: 'mask:fil_banniere', label: 'Bannière du Fil', category: 'Viremasque — Étages', sound: 'cloth', textures: { all: tex('cloth', ['#1e8aa8', '#145a70', '#f2e6c8'], { stripes: 3 }, 5) } }),
  b({ id: 'mask:fer_pierre', label: 'Pierre rouge du Bastion', category: 'Viremasque — Étages', textures: { all: tex('stoneBricks', ['#7a2c26', '#43130f', '#9a4034'], {}, 9) } }),
  b({ id: 'mask:fer_metal', label: 'Fer noir du Bastion', category: 'Viremasque — Étages', sound: 'metal', textures: { all: tex('metal', ['#3a3436', '#1a1618', '#6a5e60'], { rivets: 1 }, 3) } }),
  b({ id: 'mask:verre_terrasse', label: 'Verre des Terrasses', category: 'Viremasque — Étages', sound: 'glass', transparency: 'blend', opaque: false, textures: { all: tex('glass', ['#cfeaff', '#7aaacc'], { alpha: 0.5 }) } }),
  b({ id: 'mask:verre_pierre', label: 'Pierre claire des Terrasses', category: 'Viremasque — Étages', textures: { all: tex('stoneBricks', ['#dfe6ea', '#a4b2ba', '#f2f6f8'], {}, 12) } }),
  b({ id: 'mask:or_marbre', label: 'Marbre des Jardins d’Or', category: 'Viremasque — Étages', textures: { all: tex('marble', ['#f2ece0', '#c8b890', '#ffffff']) } }),
  b({ id: 'mask:or_dore', label: 'Dorure', category: 'Viremasque — Étages', sound: 'metal', textures: { all: tex('polished', ['#e0b44a', '#9a7420', '#fff0a8']) } }),
  b({ id: 'mask:jardin_haie', label: 'Haie taillée', category: 'Viremasque — Étages', sound: 'plant', textures: { all: tex('leaves', ['#4a8a4a', '#2a5a2a', '#6ab06a'], {}, 7) } }),
  b({ id: 'mask:tour_pierre', label: 'Pierre de la Tour de l’Accord', category: 'Viremasque — Étages', textures: { all: tex('stoneBricks', ['#e8e2d6', '#aea69a', '#fffaf0'], {}, 14) } }),
  b({ id: 'mask:tour_lumiere', label: 'Feu de la Tour', category: 'Viremasque — Étages', emissive: true, light: { level: 14, color: '#fff2c8' }, textures: { all: tex('lamp', ['#fff6d8', '#c8a050']) } }),
  b({ id: 'mask:falaise', label: 'Roche de la falaise', category: 'Viremasque — Étages', textures: { all: tex('stone', ['#8a7a68', '#5a4c3e', '#a8987e'], { cracks: 3 }, 21) } }),
];
