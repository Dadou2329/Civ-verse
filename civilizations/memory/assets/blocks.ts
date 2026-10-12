import { defineBlock, type BlockDef } from '@sdk';

/**
 * Réminence's materials: petrol blue, mauve and amber; frosted glass, painted wood and black
 * stone; the white of the mental room.
 */
const b = (def: BlockDef) => defineBlock(def);
const tex = (gen: string, colors: string[], params?: Record<string, number>, seed = 0) => ({ gen, colors, params, seed });

const BLACK_STONE = tex('darkstone', ['#2b2a32', '#17161b', '#3d3b46', '#7a5a9a'], { cracks: 1 }, 3);
const SLATE = tex('roofTiles', ['#2c4d56', '#152a30', '#41707b']);
const PETROL = tex('plaster', ['#2f5c63', '#21444a'], {}, 4);
const WHITE = tex('noise', ['#eeeef2'], { amount: 0.025, grain: 0.02 }, 2);

export const memoryBlocks = [
  // --- Pierre et enduits ----------------------------------------------------------------------
  b({ id: 'memory:black_stone', label: 'Pierre noire', category: 'Réminence', textures: { all: BLACK_STONE } }),
  b({ id: 'memory:black_stone_slab', label: 'Dalle de pierre noire', category: 'Réminence', shape: 'slab', textures: { all: BLACK_STONE } }),
  b({ id: 'memory:black_bricks', label: 'Briques noires polies', category: 'Réminence', textures: { all: tex('stoneBricks', ['#33313b', '#18171d', '#4a4756'], {}, 6) } }),
  b({ id: 'memory:petrol_plaster', label: 'Enduit bleu pétrole', category: 'Réminence', textures: { all: PETROL } }),
  b({ id: 'memory:petrol_timber', label: 'Colombage bleu pétrole', category: 'Réminence', textures: { all: tex('timber', ['#2f5c63', '#21444a', '#2a2026'], { beam: 1, brace: 1 }, 5) } }),
  b({ id: 'memory:mauve_plaster', label: 'Enduit mauve', category: 'Réminence', textures: { all: tex('plaster', ['#6e5a7e', '#54445f'], {}, 7) } }),
  // --- Bois peint ---------------------------------------------------------------------------------
  b({ id: 'memory:mauve_wood', label: 'Bois peint mauve', category: 'Réminence', sound: 'wood', textures: { all: tex('paintedPlanks', ['#7a5a40', '#3d2a1e', '#9a7a58', '#7d5a8c']) } }),
  b({ id: 'memory:teal_wood', label: 'Bois peint sarcelle', category: 'Réminence', sound: 'wood', textures: { all: tex('paintedPlanks', ['#7a5a40', '#3d2a1e', '#9a7a58', '#2e6e72'], {}, 2) } }),
  b({ id: 'memory:amber_wood', label: 'Bois ambré', category: 'Réminence', sound: 'wood', textures: { all: tex('planks', ['#b07a3a', '#5a3a18', '#d09a52']) } }),
  b({ id: 'memory:amber_wood_slab', label: 'Dalle de bois ambré', category: 'Réminence', sound: 'wood', shape: 'slab', textures: { all: tex('planks', ['#b07a3a', '#5a3a18', '#d09a52']) } }),
  // --- Toits ---------------------------------------------------------------------------------------
  b({ id: 'memory:slate', label: 'Ardoise bleu pétrole', category: 'Réminence', textures: { all: SLATE } }),
  b({ id: 'memory:slate_slab', label: "Dalle d'ardoise bleu pétrole", category: 'Réminence', shape: 'slab', textures: { all: SLATE } }),
  b({ id: 'memory:mauve_roof', label: 'Tuiles mauves', category: 'Réminence', textures: { all: tex('roofTiles', ['#6a4a7a', '#3a2848', '#8a6a9a']) } }),
  // --- Verres ---------------------------------------------------------------------------------------
  b({ id: 'memory:frosted_mauve', label: 'Verre dépoli mauve', category: 'Réminence', sound: 'glass', transparency: 'blend', textures: { all: tex('frosted', ['#c6aed6', '#5e4a6c'], { alpha: 0.72 }) } }),
  b({ id: 'memory:frosted_amber', label: 'Verre dépoli ambré', category: 'Réminence', sound: 'glass', transparency: 'blend', textures: { all: tex('frosted', ['#f2cc8e', '#7a5a2a'], { alpha: 0.7 }) } }),
  b({ id: 'memory:frosted_teal', label: 'Verre dépoli sarcelle', category: 'Réminence', sound: 'glass', transparency: 'blend', textures: { all: tex('frosted', ['#9ed0d0', '#3a6a6c'], { alpha: 0.7 }) } }),
  // --- Sols, eau, jardin ----------------------------------------------------------------------------
  b({ id: 'memory:mosaic', label: 'Mosaïque du marché', category: 'Réminence', textures: { all: tex('mosaic', ['#4a4a58', '#25252c', '#6a5a7a', '#3a6068', '#8a6a3a']) } }),
  b({ id: 'memory:paving', label: 'Pavés gris-bleu', category: 'Réminence', textures: { all: tex('cobble', ['#5a5e6a', '#2c2e36', '#787c8a'], { stones: 8 }, 3) } }),
  b({ id: 'memory:canal_water', label: 'Eau du canal', category: 'Réminence', solid: false, transparency: 'blend', textures: { all: tex('frosted', ['#24505c', '#10262c'], { alpha: 0.82, frame: 0 }) } }),
  b({
    id: 'memory:garden_grass',
    label: 'Herbe du Jardin des Noms',
    category: 'Réminence',
    sound: 'earth',
    textures: {
      top: tex('grassTop', ['#4d7a5c', '#335a42', '#6a9a76']),
      side: tex('grassSide', ['#4d7a5c', '#335a42', '#6a9a76', '#5a4a3c', '#3a2e24', '#6e5c4a']),
      bottom: tex('dirt', ['#5a4a3c', '#3a2e24', '#6e5c4a']),
    },
  }),
  b({ id: 'memory:name_stone', label: 'Pierre aux noms', category: 'Réminence', textures: { all: tex('rune', ['#6a6872', '#3c3a44', '#8a8892', '#c8a8e8']) } }),
  b({ id: 'memory:lavender', label: 'Lavande', category: 'Réminence', sound: 'plant', shape: 'cross', transparency: 'cutout', opaque: false, solid: false, textures: { all: tex('plant', ['#4a6a4a', '#2e4a2e', '#9a7ad8', '#c8a8f0'], { stems: 5 }) } }),
  // --- Lumières -------------------------------------------------------------------------------------
  b({ id: 'memory:amber_lamp', label: 'Lampe à éclats ambrée', category: 'Réminence', emissive: true, light: { level: 13, color: '#ffb35c' }, textures: { all: tex('lamp', ['#ffd08a', '#3a2a1a']) } }),
  b({ id: 'memory:mauve_lamp', label: 'Lampe mauve', category: 'Réminence', emissive: true, light: { level: 12, color: '#c08aff' }, textures: { all: tex('lamp', ['#d6b4ff', '#2e2238']) } }),
  b({ id: 'memory:shard_vein', label: "Veine d'éclats", category: 'Réminence', emissive: true, light: { level: 9, color: '#a8e0ff' }, textures: { all: tex('crystal', ['#9ad8ff', '#3a6a9a', '#e0f4ff']) } }),
  // --- Chambre Blanche --------------------------------------------------------------------------------
  b({ id: 'memory:white', label: 'Blanc de la Chambre', category: 'Chambre Blanche', textures: { all: WHITE } }),
  b({ id: 'memory:white_glow', label: 'Blanc lumineux', category: 'Chambre Blanche', emissive: true, light: { level: 14, color: '#f4f0ff' }, textures: { all: tex('noise', ['#ffffff'], { amount: 0.01 }) } }),
];
