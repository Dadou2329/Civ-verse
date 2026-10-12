/**
 * Layout of the Rives Basses (scene « rives »): every place the scenes, cinematics and tests refer
 * to. One unit = one block = one meter. North (+Z) is the cliff where the upper tiers of
 * Viremasque rise; the lower district stretches south of it on both banks of the canal.
 */
export const SIZE: [number, number, number] = [144, 72, 144];

/** Walking level of the Rives Basses (the ground blocks' top face). */
export const G = 8;

/** The workshop of Nora and Lys; the hero's room is upstairs. */
export const ATELIER = { x0: 30, x1: 45, z0: 22, z1: 35, roomY: 14 };

export const CANAL = { z0: 42, z1: 47, water: 6 };
export const QUAI_SUD = { z0: 36, z1: 41 };
export const QUAI_NORD = { z0: 48, z1: 51 };
export const PONTS = [46, 100];

export const MARCHE = { x0: 50, x1: 96, z0: 52, z1: 80 };
export const BUREAU = { x0: 97, x1: 107, z0: 58, z1: 72 };
export const ESTRADE = { x0: 60, x1: 72, z0: 82, z1: 88 };
export const MOULIN = { x0: 14, x1: 30, z0: 82, z1: 98 };

/** The freight lift: an inclined rail from the dock at the cliff down to the market. */
export const RAIL = { x: 118, top: { z: 100, y: 20 }, bottom: { z: 63, y: 7 } };
/** Height of the rail's top face at a given z. */
export function railY(z: number): number {
  const t = (RAIL.top.z - z) / (RAIL.top.z - RAIL.bottom.z);
  return Math.round(RAIL.top.y + (RAIL.bottom.y - RAIL.top.y) * t);
}
/** Scaffold platforms leading to the brake station (walking heights 9, 10, 11 then 12). */
export const ECHAFAUDAGES = [
  { x0: 111, x1: 114, z0: 69, z1: 71, top: 8 },
  { x0: 111, x1: 114, z0: 74, z1: 76, top: 9 },
  { x0: 111, x1: 114, z0: 79, z1: 81, top: 10 },
];
export const STATION = { x0: 109, x1: 116, z0: 84, z1: 90, top: 11 };

/** Tiers of the upper city (walking heights), seen from below. */
export const ETAGES = {
  fil: { z0: 100, z1: 115, y: 30 },
  milieu: { z0: 116, z1: 127, y: 38 },
  verre: { z0: 128, z1: 135, y: 46 },
  or: { z0: 136, z1: 143, y: 54 },
};

/** Named points used by scenes, cinematics and tests. */
export const P = {
  spawnChambre: [35.5, ATELIER.roomY, 30.5] as [number, number, number],
  fenetre: [38.5, ATELIER.roomY, 34.2] as [number, number, number],
  support: [36.5, ATELIER.roomY, 33.4] as [number, number, number],
  table: [33.5, ATELIER.roomY, 33.3] as [number, number, number],
  lit: [41.5, ATELIER.roomY, 25.2] as [number, number, number],
  carte: [44.9, ATELIER.roomY + 1.4, 30.5] as [number, number, number],
  affiche: [38.5, ATELIER.roomY + 1.2, 23.06] as [number, number, number],
  trophee: [43.6, ATELIER.roomY + 0.5, 33.4] as [number, number, number],
  /** Foot of the workshop stairs (the first half step is entered from the east). */
  escalierBas: [33.5, G, 34.2] as [number, number, number],
  etabli: [39.5, G, 23.6] as [number, number, number],
  etagere: [44.4, G, 28.5] as [number, number, number],
  roue: [41.5, G, 33.6] as [number, number, number],
  nora: [40.5, G, 25.6] as [number, number, number],
  noraChariot: [41.4, G, 37.6] as [number, number, number],
  chariot: [38.5, G, 38.9] as [number, number, number],
  lys: [36, G, 39.8] as [number, number, number],
  sortieAtelier: [37, G, 36.6] as [number, number, number],
  bastien: [50.5, G, 40.6] as [number, number, number],
  ada: [43.6, G, 38.2] as [number, number, number],
  pol: [44.8, G, 39.2] as [number, number, number],
  junoArrivee: [72.5, G, 39.5] as [number, number, number],
  junoAtelier: [40.8, G, 40.4] as [number, number, number],
  junoRampe: [110.5, G, 63.5] as [number, number, number],
  junoStation: [115.5, STATION.top + 1, 89.2] as [number, number, number],
  levier: [112.5, STATION.top + 1, 86.5] as [number, number, number],
  frein: [115.5, STATION.top + 1, 86.6] as [number, number, number],
  station: [112.5, STATION.top + 1, 87] as [number, number, number],
  railHaut: [119, RAIL.top.y + 1, 99] as [number, number, number],
  railBas: [119, RAIL.bottom.y + 1, 64] as [number, number, number],
  rampe: [112.5, G, 66.5] as [number, number, number],
  marcheBas: [118, G, 56] as [number, number, number],
  /** On the Fil tier, at the cliff edge: a Fer guard stops a cart (seen from the window). */
  charrette: [66, ETAGES.fil.y, 100.9] as [number, number, number],
};

/** Juno's leaps from the foot of the lift, up the rail, over to the brake station. */
export const JUNO_VOLTIGE: [number, number, number][] = [
  [110.5, G, 63.5],
  [118.5, railY(70) + 1, 70.5],
  [118.5, railY(78) + 1, 78.5],
  [115.5, STATION.top + 1, 89.2],
];

// ---------------------------------------------------------------------------------------------
// Chapter I « Courir plus haut »
// ---------------------------------------------------------------------------------------------

/** The washerwomen's terrace on the north quay, and their sloped footbridge over the canal. */
export const LAVOIR = { x0: 16, x1: 26, z0: 48, z1: 52, top: 10 };
/** Footbridge deck x range; it slopes from the terrace (z 47, height 10) down to z 43 (height 8). */
export const PASSERELLE = { x0: 22, x1: 24 };

/**
 * The qualifying course, between the stage and the cliff: two low walls, ledge A (ladder 1),
 * a gap, ledge B (the training wheel, ladder 2), then C and D carved into the cliff, with a
 * wider gap between them, and the flag on D.
 */
export const COURSE = {
  corridor: { x0: 59, x1: 75 },
  murets: [92, 95],
  A: { x0: 59, x1: 67, z0: 97, z1: 99, top: 13 },
  B: { x0: 70, x1: 78, z0: 97, z1: 99, top: 13 },
  C: { x0: 69, x1: 77, z0: 100, z1: 103, top: 18 },
  D: { x0: 59, x1: 65, z0: 100, z1: 103, top: 18 },
};

/** Vaurel's study, hidden in the rock under the Jardins d'Or (only seen in a cinematic). */
export const CABINET = { x0: 100, x1: 108, z0: 137, z1: 143, floor: 46 };

/** Masts around the fountain that carry the garlands of the party. */
export const MATS_FETE: [number, number][] = [
  [68, 59],
  [78, 59],
  [68, 69],
  [78, 69],
];

export const P1 = {
  /** Where the hero starts the morning after the Prologue (on the quay, toward the market). */
  lendemain: [38.5, G, 40.5] as [number, number, number],
  junoBureau: [95.2, G, 66.5] as [number, number, number],
  junoGuichet: [101.2, G, 63.6] as [number, number, number],
  lysPorte: [95.6, G, 65.2] as [number, number, number],
  lysBureau: [99.6, G, 67.4] as [number, number, number],
  commis: [104.5, G, 65.5] as [number, number, number],
  automate: [62.5, G, 64.5] as [number, number, number],
  caisseMasques: [36.8, G, 24.3] as [number, number, number],
  bancEssai: [39.3, G + 0.94, 23.7] as [number, number, number],
  /** The split mask, held in the test bench's clamps (in front of its bulb). */
  masqueFendu: [39.3, G + 1.2, 23.86] as [number, number, number],
  lysAtelier: [38.1, G, 25.2] as [number, number, number],
  herosAtelier: [39.4, G, 25.4] as [number, number, number],
  rosalie: [22.6, LAVOIR.top, 50.9] as [number, number, number],
  /** The fountain corner the two merchants want. */
  emplacement: [79.2, G, 64.5] as [number, number, number],
  etalFontaineFruits: [80.5, G, 61.5] as [number, number, number],
  etalFontaineTissus: [80.5, G, 67.5] as [number, number, number],
  mireilleFontaine: [82.4, G, 61.5] as [number, number, number],
  octaveFontaine: [82.4, G, 67.5] as [number, number, number],
  cagettes: [
    [60.6, G, 57.1],
    [60.9, G, 60.2],
    [60.5, G, 72.3],
  ] as [number, number, number][],
  arche: [66.5, G, 90.2] as [number, number, number],
  departParcours: [66.5, G + 1, 87] as [number, number, number],
  kael: [69.6, G + 1, 85.6] as [number, number, number],
  kaelFin: [67.8, G + 1, 85.2] as [number, number, number],
  apresParcours: [66.2, G + 1, 84.6] as [number, number, number],
  echelle1: [63.5, G, 96.6] as [number, number, number],
  echelle2: [72.5, COURSE.B.top, 99.6] as [number, number, number],
  roue: [76.5, COURSE.B.top, 99.85] as [number, number, number],
  drapeau: [61.5, COURSE.D.top, 101.5] as [number, number, number],
  junoEstrade: [62.4, G + 1, 84.2] as [number, number, number],
  lysEstrade: [63.6, G + 1, 83.4] as [number, number, number],
  vaurel: [104.5, CABINET.floor + 1, 141.6] as [number, number, number],
  bureauVaurel: [104.5, CABINET.floor + 1, 140.1] as [number, number, number],
};
