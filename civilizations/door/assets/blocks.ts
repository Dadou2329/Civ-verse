import { defineBlock, type BlockDef } from '@sdk';

/**
 * Verrou's own materials. The lower Faubourg is damp stone and weathered wood, the Galerie des
 * Métiers warm brick and copper, the Archives pale blue-grey stone; the erased corridor opens on
 * a starry void. Everything else comes from the shared `core` library.
 */
const b = (def: BlockDef) => defineBlock(def);
const tex = (gen: string, colors: string[], params?: Record<string, number>, seed = 0) => ({ gen, colors, params, seed });

const DAMP_STONE = tex('stone', ['#636a64', '#3e443f', '#7e867e'], { cracks: 3 });
const DAMP_BRICKS = tex('stoneBricks', ['#68705f', '#3a3f36', '#848c79'], {}, 4);
const WARM_BRICK = tex('bricks', ['#b2643f', '#6a3923', '#d08257']);
const ARCHIVE = tex('stoneBricks', ['#c2c9cf', '#7f8790', '#dfe5ea'], {}, 7);
const ARCHIVE_FLOOR = tex('tiles', ['#a4aeb8', '#5c6670', '#c6cfd8']);
const VOID = tex('stars', ['#040309', '#1b1036', '#eceaff', '#ffd27a'], { density: 0.04 });

export const doorBlocks = [
  // --- Faubourg Bas -------------------------------------------------------------------------
  b({ id: 'door:damp_stone', label: 'Pierre humide', category: 'Verrou — Faubourg', textures: { all: DAMP_STONE } }),
  b({ id: 'door:damp_stone_slab', label: 'Dalle de pierre humide', category: 'Verrou — Faubourg', shape: 'slab', textures: { all: DAMP_STONE } }),
  b({ id: 'door:damp_cobble', label: 'Pavés mouillés', category: 'Verrou — Faubourg', textures: { all: tex('cobble', ['#5e645f', '#2e3330', '#7f8781'], { stones: 9 }, 2) } }),
  b({ id: 'door:damp_bricks', label: 'Briques moisies', category: 'Verrou — Faubourg', textures: { all: DAMP_BRICKS } }),
  b({
    id: 'door:slum_plaster',
    label: 'Enduit défraîchi',
    category: 'Verrou — Faubourg',
    textures: { all: tex('timber', ['#b7aa90', '#8b806b', '#5a4632'], { beam: 1, brace: 0 }, 5) },
  }),
  b({
    id: 'door:slum_plaster_brace',
    label: 'Enduit à colombage',
    category: 'Verrou — Faubourg',
    textures: { all: tex('timber', ['#b7aa90', '#8b806b', '#5a4632'], { beam: 1, brace: 1 }, 6) },
  }),
  b({ id: 'door:weathered_planks', label: 'Planches usées', category: 'Verrou — Faubourg', sound: 'wood', textures: { all: tex('planks', ['#76604a', '#3d3125', '#8f785f'], {}, 3) } }),
  b({
    id: 'door:weathered_planks_slab',
    label: 'Dalle de planches usées',
    category: 'Verrou — Faubourg',
    sound: 'wood',
    shape: 'slab',
    textures: { all: tex('planks', ['#76604a', '#3d3125', '#8f785f'], {}, 3) },
  }),
  b({ id: 'door:soot_roof', label: 'Toit de bardeaux sombres', category: 'Verrou — Faubourg', textures: { all: tex('roofTiles', ['#4f4a4d', '#2a2629', '#6a6467']) } }),
  b({ id: 'door:soot_roof_slab', label: 'Dalle de bardeaux sombres', category: 'Verrou — Faubourg', shape: 'slab', textures: { all: tex('roofTiles', ['#4f4a4d', '#2a2629', '#6a6467']) } }),
  b({ id: 'door:posters', label: 'Mur placardé', category: 'Verrou — Faubourg', textures: { all: tex('posters', ['#b7aa90', '#e6dbc2', '#3b3027', '#9a3a2a'], { sheets: 2 }, 9) } }),
  b({
    id: 'door:dark_water',
    label: 'Eau stagnante',
    category: 'Verrou — Faubourg',
    solid: false,
    transparency: 'blend',
    textures: { all: tex('frosted', ['#1f3d40', '#0e2224'], { alpha: 0.8, frame: 0 }) },
  }),
  // --- Galerie des Métiers -------------------------------------------------------------------
  b({ id: 'door:warm_brick', label: 'Brique chaude', category: 'Verrou — Galerie', textures: { all: WARM_BRICK } }),
  b({ id: 'door:warm_brick_slab', label: 'Dalle de brique chaude', category: 'Verrou — Galerie', shape: 'slab', textures: { all: WARM_BRICK } }),
  b({ id: 'door:gallery_tiles', label: 'Carrelage de la galerie', category: 'Verrou — Galerie', textures: { all: tex('tiles', ['#b98e5f', '#6e4c2e', '#d6aa77']) } }),
  b({
    id: 'door:copper_patina',
    label: 'Cuivre patiné',
    category: 'Verrou — Galerie',
    sound: 'metal',
    textures: { all: tex('metal', ['#a8693a', '#5e361c', '#cf8c58', '#58a38a'], { patina: 0.32 }, 4) },
  }),
  // --- Archives du Haut -----------------------------------------------------------------------
  b({ id: 'door:archive_stone', label: 'Pierre des Archives', category: 'Verrou — Archives', textures: { all: ARCHIVE } }),
  b({ id: 'door:archive_stone_slab', label: 'Dalle de pierre des Archives', category: 'Verrou — Archives', shape: 'slab', textures: { all: ARCHIVE } }),
  b({ id: 'door:archive_floor', label: 'Dallage des Archives', category: 'Verrou — Archives', textures: { all: ARCHIVE_FLOOR } }),
  b({
    id: 'door:archive_trim',
    label: 'Frise des Archives',
    category: 'Verrou — Archives',
    textures: { all: tex('ornament', ['#c2c9cf', '#7f8790', '#dfe5ea', '#6f9fd4']) },
  }),
  b({
    id: 'door:gear_plate',
    label: 'Plaque à engrenage',
    category: 'Verrou — Archives',
    sound: 'metal',
    textures: { all: tex('gear', ['#5a5148', '#24201b', '#c49c46', '#e8c27a']) },
  }),
  // --- Marques de rang -----------------------------------------------------------------------
  b({ id: 'door:mark_gray', label: 'Marque grise (Rang 0)', category: 'Verrou — Marques', sound: 'metal', textures: { all: tex('lockPlate', ['#8e8e8c', '#454543', '#b4b4b0']) } }),
  b({ id: 'door:mark_gold', label: 'Trait doré (Rang 1)', category: 'Verrou — Marques', textures: { all: tex('ornament', ['#7d5d40', '#4a3524', '#9c7652', '#e3b84d']) } }),
  b({ id: 'door:mark_seal', label: 'Double sceau (Rang 2)', category: 'Verrou — Marques', textures: { all: tex('rune', ['#c2c9cf', '#7f8790', '#dfe5ea', '#5d9eea']) } }),
  // --- Le couloir effacé ---------------------------------------------------------------------
  b({ id: 'door:erased_stone', label: 'Pierre effacée', category: 'Verrou — Couloir', textures: { all: tex('darkstone', ['#2d2b33', '#18171c', '#403d48', '#5b4f7a'], { cracks: 1 }, 8) } }),
  b({
    id: 'door:erased_stone_slab',
    label: 'Dalle de pierre effacée',
    category: 'Verrou — Couloir',
    shape: 'slab',
    textures: { all: tex('darkstone', ['#2d2b33', '#18171c', '#403d48', '#5b4f7a'], { cracks: 1 }, 8) },
  }),
  b({ id: 'door:erased_bricks', label: 'Briques effacées', category: 'Verrou — Couloir', textures: { all: tex('stoneBricks', ['#34323b', '#1a191e', '#4a4753'], {}, 12) } }),
  b({
    id: 'door:void',
    label: 'Étendue étoilée',
    category: 'Verrou — Couloir',
    emissive: true,
    textures: { all: VOID },
  }),
  b({
    id: 'door:light_seam',
    label: 'Rai de lumière impossible',
    category: 'Verrou — Couloir',
    emissive: true,
    light: { level: 14, color: '#ffe2a8' },
    textures: { all: tex('crystal', ['#fff4d8', '#ffd98c', '#ffffff']) },
  }),
];
