import { defineBlock, type BlockDef } from '@sdk';

/**
 * Shared block palette. Textures are procedural recipes (see engine texture generators):
 * colors are [base, dark/mortar, light, accents...].
 */
const b = (def: BlockDef) => defineBlock(def);
const tex = (gen: string, colors: string[], params?: Record<string, number>, seed = 0) => ({ gen, colors, params, seed });

const STONE = tex('stone', ['#8a8a86', '#666662', '#a5a5a0']);
const COBBLE = tex('cobble', ['#7f7b74', '#47443f', '#a09a90']);
const STONE_BRICKS = tex('stoneBricks', ['#8f8a82', '#55524d', '#ada79c']);
const PALE_BRICKS = tex('stoneBricks', ['#cfc9bb', '#8f897d', '#e6e1d4']);
const MARBLE = tex('marble', ['#e8e4dc', '#b5ad9f']);
const OAK = tex('planks', ['#a7794c', '#5c3f25', '#c79a69']);
const DARK_OAK = tex('planks', ['#5d4230', '#2c1f15', '#7a5841']);
const PLASTER = tex('plaster', ['#e6dcc6', '#b8ab92']);

export const coreBlocks = [
  // --- Stone ------------------------------------------------------------------------------
  b({ id: 'core:stone', label: 'Pierre', category: 'Pierre', textures: { all: STONE } }),
  b({ id: 'core:stone_slab', label: 'Dalle de pierre', category: 'Pierre', shape: 'slab', textures: { all: STONE } }),
  b({ id: 'core:cobble', label: 'Pavés', category: 'Pierre', textures: { all: COBBLE } }),
  b({ id: 'core:cobble_slab', label: 'Dalle de pavés', category: 'Pierre', shape: 'slab', textures: { all: COBBLE } }),
  b({ id: 'core:stone_bricks', label: 'Briques de pierre', category: 'Pierre', textures: { all: STONE_BRICKS } }),
  b({ id: 'core:stone_bricks_slab', label: 'Dalle de briques de pierre', category: 'Pierre', shape: 'slab', textures: { all: STONE_BRICKS } }),
  b({ id: 'core:mossy_bricks', label: 'Briques moussues', category: 'Pierre', textures: { all: tex('stoneBricks', ['#7b8470', '#4d5245', '#97a184'], {}, 3) } }),
  b({ id: 'core:pale_stone', label: 'Pierre pâle', category: 'Pierre', textures: { all: tex('stone', ['#cbc6ba', '#a19b8f', '#dfdad0']) } }),
  b({ id: 'core:pale_bricks', label: 'Briques pâles', category: 'Pierre', textures: { all: PALE_BRICKS } }),
  b({ id: 'core:pale_bricks_slab', label: 'Dalle de briques pâles', category: 'Pierre', shape: 'slab', textures: { all: PALE_BRICKS } }),
  b({ id: 'core:dark_stone', label: 'Pierre noire', category: 'Pierre', textures: { all: tex('darkstone', ['#3a3940', '#222127', '#525059', '#7b6ba3']) } }),
  b({ id: 'core:dark_bricks', label: 'Briques noires', category: 'Pierre', textures: { all: tex('stoneBricks', ['#3d3c44', '#1e1d22', '#55535e']) } }),
  b({ id: 'core:marble', label: 'Marbre', category: 'Pierre', textures: { all: MARBLE } }),
  b({ id: 'core:marble_slab', label: 'Dalle de marbre', category: 'Pierre', shape: 'slab', textures: { all: MARBLE } }),
  b({ id: 'core:sandstone', label: 'Grès', category: 'Pierre', textures: { all: tex('stone', ['#d2b78a', '#b0966b', '#e4cfa6'], { cracks: 0 }) } }),
  b({ id: 'core:ornate_trim', label: 'Frise dorée', category: 'Pierre', textures: { all: tex('ornament', ['#8f8a82', '#55524d', '#ada79c', '#c9a24a']) } }),
  b({ id: 'core:rune_stone', label: 'Pierre gravée', category: 'Pierre', textures: { all: tex('rune', ['#8f8a82', '#55524d', '#ada79c', '#d9b65a']) } }),
  // --- Earth --------------------------------------------------------------------------------
  b({ id: 'core:dirt', label: 'Terre', category: 'Terre', sound: 'earth', textures: { all: tex('dirt', ['#7a5a3c', '#55402a', '#94714e']) } }),
  b({
    id: 'core:grass',
    label: 'Herbe',
    category: 'Terre',
    sound: 'earth',
    textures: {
      top: tex('grassTop', ['#6c9744', '#4b7330', '#8db95a']),
      side: tex('grassSide', ['#6c9744', '#4b7330', '#8db95a', '#7a5a3c', '#55402a', '#94714e']),
      bottom: tex('dirt', ['#7a5a3c', '#55402a', '#94714e']),
    },
  }),
  b({ id: 'core:gravel', label: 'Gravier', category: 'Terre', sound: 'earth', textures: { all: tex('cobble', ['#8a847a', '#5d5850', '#a39d92'], { stones: 14 }) } }),
  b({ id: 'core:sand', label: 'Sable', category: 'Terre', sound: 'earth', textures: { all: tex('sand', ['#dcc79a']) } }),
  b({ id: 'core:packed_earth', label: 'Terre battue', category: 'Terre', sound: 'earth', textures: { all: tex('noise', ['#8a6f52'], { amount: 0.1 }) } }),
  // --- Wood ---------------------------------------------------------------------------------
  b({ id: 'core:planks_oak', label: 'Planches de chêne', category: 'Bois', sound: 'wood', textures: { all: OAK } }),
  b({ id: 'core:planks_oak_slab', label: 'Dalle de chêne', category: 'Bois', sound: 'wood', shape: 'slab', textures: { all: OAK } }),
  b({ id: 'core:planks_dark', label: 'Planches sombres', category: 'Bois', sound: 'wood', textures: { all: DARK_OAK } }),
  b({ id: 'core:planks_dark_slab', label: 'Dalle sombre', category: 'Bois', sound: 'wood', shape: 'slab', textures: { all: DARK_OAK } }),
  b({
    id: 'core:log_oak',
    label: 'Rondin',
    category: 'Bois',
    sound: 'wood',
    textures: { side: tex('logSide', ['#6a4a2d', '#3d2917']), top: tex('logTop', ['#b38b5b', '#6a4a2d']) },
  }),
  b({
    id: 'core:beam_dark',
    label: 'Poutre sombre',
    category: 'Bois',
    sound: 'wood',
    textures: { side: tex('logSide', ['#4a3423', '#271a10']), top: tex('logTop', ['#7a5a3e', '#4a3423']) },
  }),
  b({ id: 'core:painted_teal', label: 'Bois peint (sarcelle)', category: 'Bois', sound: 'wood', textures: { all: tex('paintedPlanks', ['#a7794c', '#5c3f25', '#c79a69', '#3c7775']) } }),
  b({ id: 'core:painted_red', label: 'Bois peint (rouge)', category: 'Bois', sound: 'wood', textures: { all: tex('paintedPlanks', ['#a7794c', '#5c3f25', '#c79a69', '#9a3b2f']) } }),
  b({ id: 'core:painted_mauve', label: 'Bois peint (mauve)', category: 'Bois', sound: 'wood', textures: { all: tex('paintedPlanks', ['#a7794c', '#5c3f25', '#c79a69', '#7d5a8c']) } }),
  b({ id: 'core:wood_panel', label: 'Lambris', category: 'Bois', sound: 'wood', textures: { all: tex('panel', ['#8a6440', '#4a3320']) } }),
  // --- Walls ----------------------------------------------------------------------------------
  b({ id: 'core:plaster', label: 'Enduit', category: 'Murs', textures: { all: PLASTER } }),
  b({ id: 'core:plaster_ochre', label: 'Enduit ocre', category: 'Murs', textures: { all: tex('plaster', ['#d6ae6a', '#a8833f']) } }),
  b({ id: 'core:plaster_rose', label: 'Enduit rosé', category: 'Murs', textures: { all: tex('plaster', ['#d9b2a2', '#a8826f']) } }),
  b({ id: 'core:timber', label: 'Colombage', category: 'Murs', textures: { all: tex('timber', ['#e6dcc6', '#b8ab92', '#5a3e27'], { brace: 0 }) } }),
  b({ id: 'core:timber_brace', label: 'Colombage croisé', category: 'Murs', textures: { all: tex('timber', ['#e6dcc6', '#b8ab92', '#5a3e27'], { brace: 1 }) } }),
  b({ id: 'core:timber_brace_b', label: 'Colombage croisé (inverse)', category: 'Murs', textures: { all: tex('timber', ['#e6dcc6', '#b8ab92', '#5a3e27'], { brace: -1 }) } }),
  b({ id: 'core:bricks_red', label: 'Briques rouges', category: 'Murs', textures: { all: tex('bricks', ['#9a4a36', '#c9bfae', '#b8644c']) } }),
  b({ id: 'core:bricks_warm', label: 'Briques chaudes', category: 'Murs', textures: { all: tex('bricks', ['#b56f48', '#d8c9b0', '#cf8a5f']) } }),
  b({ id: 'core:bricks_brown', label: 'Briques brunes', category: 'Murs', textures: { all: tex('bricks', ['#6e4a35', '#a8998a', '#8a5f45']) } }),
  // --- Roofs ----------------------------------------------------------------------------------
  b({ id: 'core:roof_red', label: 'Tuiles rouges', category: 'Toits', textures: { all: tex('roofTiles', ['#8e3b2b', '#58201a', '#b25640']) } }),
  b({ id: 'core:roof_red_slab', label: 'Demi-tuiles rouges', category: 'Toits', shape: 'slab', textures: { all: tex('roofTiles', ['#8e3b2b', '#58201a', '#b25640']) } }),
  b({ id: 'core:roof_slate', label: 'Ardoises', category: 'Toits', textures: { all: tex('roofTiles', ['#4b5563', '#2a3039', '#6b7686']) } }),
  b({ id: 'core:roof_slate_slab', label: 'Demi-ardoises', category: 'Toits', shape: 'slab', textures: { all: tex('roofTiles', ['#4b5563', '#2a3039', '#6b7686']) } }),
  b({ id: 'core:roof_blue', label: 'Tuiles bleues', category: 'Toits', textures: { all: tex('roofTiles', ['#34507a', '#1d3050', '#4c70a4']) } }),
  b({ id: 'core:roof_green', label: 'Tuiles vert-de-gris', category: 'Toits', textures: { all: tex('roofTiles', ['#4f7a6a', '#2c4a3f', '#6f9a88']) } }),
  b({ id: 'core:thatch', label: 'Chaume', category: 'Toits', textures: { all: tex('thatch', ['#c4a057', '#86692f', '#dfc27c']) } }),
  // --- Metal & glass ------------------------------------------------------------------------
  b({ id: 'core:iron', label: 'Fer', category: 'Métal', sound: 'metal', textures: { all: tex('metal', ['#6d7178', '#3d4046', '#9aa0a8']) } }),
  b({ id: 'core:copper', label: 'Cuivre', category: 'Métal', sound: 'metal', textures: { all: tex('metal', ['#b8733f', '#6c3f21', '#da9461', '#4f9a84'], { patina: 0.18 }) } }),
  b({ id: 'core:brass', label: 'Laiton', category: 'Métal', sound: 'metal', textures: { all: tex('polished', ['#c49c46', '#77591f', '#efd488']) } }),
  b({ id: 'core:gold', label: 'Or', category: 'Métal', sound: 'metal', textures: { all: tex('polished', ['#ddb43a', '#876712', '#fff0a6']) } }),
  b({ id: 'core:lock_plate', label: 'Plaque de serrure', category: 'Métal', sound: 'metal', textures: { all: tex('lockPlate', ['#8a8f96', '#3a3d42', '#b9bec6']) } }),
  b({ id: 'core:iron_bars', label: 'Barreaux', category: 'Métal', sound: 'metal', transparency: 'cutout', opaque: false, textures: { all: tex('grate', ['#4a4d52']) } }),
  b({ id: 'core:glass', label: 'Verre', category: 'Verre', sound: 'glass', transparency: 'blend', textures: { all: tex('glass', ['#cfe6f2', '#5a5f66']) } }),
  b({ id: 'core:glass_amber', label: 'Verre ambré', category: 'Verre', sound: 'glass', transparency: 'blend', textures: { all: tex('glass', ['#f2c879', '#6a4a22'], { alpha: 0.4 }) } }),
  b({ id: 'core:frosted_glass', label: 'Verre dépoli', category: 'Verre', sound: 'glass', transparency: 'blend', textures: { all: tex('frosted', ['#d8dfe8', '#7a8088']) } }),
  // --- Floors & fabrics ---------------------------------------------------------------------
  b({ id: 'core:tiles_checker', label: 'Carrelage damier', category: 'Sols', textures: { all: tex('tiles', ['#d9d0bf', '#5e5348', '#3b342e'], { tile: 8, checker: 1 }) } }),
  b({ id: 'core:tiles_terracotta', label: 'Tomettes', category: 'Sols', textures: { all: tex('tiles', ['#b2643d', '#74391f', '#c27b55'], { tile: 4 }) } }),
  b({ id: 'core:tiles_stone', label: 'Dallage', category: 'Sols', textures: { all: tex('tiles', ['#9e978b', '#5f5a52', '#b7b0a3'], { tile: 8 }) } }),
  b({ id: 'core:carpet_red', label: 'Tapis rouge', category: 'Sols', sound: 'cloth', textures: { all: tex('carpet', ['#8c2a2a', '#4a1414', '#c9a24a', '#d8b85a']) } }),
  b({ id: 'core:carpet_blue', label: 'Tapis bleu', category: 'Sols', sound: 'cloth', textures: { all: tex('carpet', ['#2c4a78', '#15253f', '#c9a24a', '#d8b85a']) } }),
  b({ id: 'core:cloth_white', label: 'Toile blanche', category: 'Tissus', sound: 'cloth', textures: { all: tex('cloth', ['#e8e2d4']) } }),
  b({ id: 'core:cloth_red', label: 'Toile rouge', category: 'Tissus', sound: 'cloth', textures: { all: tex('cloth', ['#a8342c', '#000000', '#e8d8b8'], { stripes: 4 }) } }),
  b({ id: 'core:cloth_blue', label: 'Toile bleue', category: 'Tissus', sound: 'cloth', textures: { all: tex('cloth', ['#2f5f8f', '#000000', '#e8e2d4'], { stripes: 4 }) } }),
  b({ id: 'core:hay', label: 'Paille', category: 'Tissus', sound: 'cloth', textures: { all: tex('thatch', ['#d8b864', '#9a7a32', '#efd68a']) } }),
  // --- Decoration ---------------------------------------------------------------------------
  b({
    id: 'core:bookshelf',
    label: 'Bibliothèque',
    category: 'Décor',
    sound: 'wood',
    textures: { side: tex('books', ['#6a4a2d', '#3d2917', '#c9a24a', '#8e2b2b', '#2f5a8a', '#3a7a4a']), top: OAK },
  }),
  b({ id: 'core:paper_wall', label: 'Mur d’affiches', category: 'Décor', textures: { all: tex('paper', ['#e9dfc6', '#8a7e66']) } }),
  b({ id: 'core:lamp_warm', label: 'Lampe chaude', category: 'Lumières', emissive: true, light: { level: 14, color: '#ffb25a' }, textures: { all: tex('lamp', ['#ffcf7a', '#4a3a28']) } }),
  b({ id: 'core:lamp_blue', label: 'Lampe bleue', category: 'Lumières', emissive: true, light: { level: 13, color: '#69aaff' }, textures: { all: tex('lamp', ['#a6d4ff', '#26303f']) } }),
  b({ id: 'core:crystal_amber', label: 'Cristal ambré', category: 'Lumières', emissive: true, light: { level: 11, color: '#ffa040' }, textures: { all: tex('crystal', ['#ffb347', '#a8641c', '#ffe1a3']) } }),
  b({ id: 'core:crystal_violet', label: 'Cristal violet', category: 'Lumières', emissive: true, light: { level: 11, color: '#b06aff' }, textures: { all: tex('crystal', ['#b87cff', '#5a2e8a', '#e2c8ff']) } }),
  b({ id: 'core:crystal_blue', label: 'Cristal bleu', category: 'Lumières', emissive: true, light: { level: 11, color: '#58b8ff' }, textures: { all: tex('crystal', ['#6cc4ff', '#1f5c8a', '#c8ecff']) } }),
  // --- Vegetation ---------------------------------------------------------------------------
  b({ id: 'core:leaves', label: 'Feuillage', category: 'Végétation', sound: 'plant', transparency: 'cutout', opaque: false, textures: { all: tex('leaves', ['#4d7830', '#2d561b', '#78a647']) } }),
  b({ id: 'core:hedge', label: 'Haie', category: 'Végétation', sound: 'plant', textures: { all: tex('leaves', ['#3f6a2a', '#244516', '#5f8a3e'], { holes: 0 }) } }),
  b({ id: 'core:tall_grass', label: 'Herbes hautes', category: 'Végétation', sound: 'plant', shape: 'cross', textures: { all: tex('grassTuft', ['#6c9744', '#4b7330', '#9dc46a']) } }),
  b({ id: 'core:flowers_red', label: 'Fleurs rouges', category: 'Végétation', sound: 'plant', shape: 'cross', textures: { all: tex('plant', ['#4f8a34', '#2f5a1e', '#d0443a', '#f2d06a']) } }),
  b({ id: 'core:flowers_blue', label: 'Fleurs bleues', category: 'Végétation', sound: 'plant', shape: 'cross', textures: { all: tex('plant', ['#4f8a34', '#2f5a1e', '#5a8ad8', '#f2e6a0'], {}, 2) } }),
  b({ id: 'core:flowers_white', label: 'Fleurs blanches', category: 'Végétation', sound: 'plant', shape: 'cross', textures: { all: tex('plant', ['#4f8a34', '#2f5a1e', '#efece2', '#e8b84a'], {}, 4) } }),
];
