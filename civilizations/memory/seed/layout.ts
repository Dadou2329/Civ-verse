/**
 * Réminence layout — shared by the world seed and the generated cinematics.
 * A low city around a triangular market, cut by a canal; the Garden of Names lies across the
 * water, the Salle de Vente closes the south side. +X east, +Z north, ground at y = 6.
 */
export const SIZE: [number, number, number] = [96, 40, 96];
export const G = 6;

export type P3 = [number, number, number];
export const at = (x: number, y: number, z: number): P3 => [x + 0.5, y, z + 0.5];

export const R = {
  // --- Marché des Éclats (A) ---------------------------------------------------------------
  market: { sw: [26, 22] as [number, number], se: [70, 22] as [number, number], n: [48, 56] as [number, number] },
  loom: at(48, G, 26),
  bench: [57.5, G, 32.6] as P3,
  spawn: at(57, G, 34),
  silas: at(40, G, 42),
  sellerIris: at(46, G, 29),
  sellerJules: at(50, G, 30),
  queue: [at(47, G, 32), at(49, G, 33.5), at(51, G, 32)],
  marketSign: at(44, G, 30),
  oriane: at(24, G, 38),
  // --- Atelier d'Oriane (C) ----------------------------------------------------------------
  workshop: { x0: 8, z0: 30, x1: 22, z1: 44 },
  workshopDoor: at(22, G, 37),
  orianeInside: at(16, G, 35),
  slotTable: at(14, G, 38),
  resonanceLamp: at(11, G, 41),
  workshopDocs: at(19, G, 42),
  leaInside: at(13, G, 35),
  silasInside: at(17, G, 40),
  // --- Maison des Absences (B) -------------------------------------------------------------
  absences: { x0: 74, z0: 30, x1: 90, z1: 46 },
  absencesDoor: at(74, G, 38),
  margaux: at(80, G, 34),
  aurele: at(85, G, 41),
  jules: at(78, G, 42),
  // --- Jardin des Noms (D) -----------------------------------------------------------------
  garden: { x0: 20, z0: 66, x1: 76, z1: 92 },
  stele: at(48, G, 81),
  pedestals: [at(45, G, 77), at(48, G, 76), at(51, G, 77)],
  kite: [28.5, G, 86.5] as P3,
  cup: [67.5, G + 0.55, 71.5] as P3,
  bell: [37.5, G + 1.5, 89.2] as P3,
  // --- Salle de Vente (E) ------------------------------------------------------------------
  salle: { x0: 30, z0: 2, x1: 66, z1: 18 },
  salleEntrance: at(48, G, 19),
  counter: at(48, G, 13),
  bastien: at(48, G, 11),
  vel: at(42, G, 8),
  machine: at(42, G, 5),
  lea: at(61, G, 6),
  archivesShelf: at(62, G, 9),
  copiesCabinet: at(64, G, 4),
  backDoor: at(30, G, 8),
  orianeSalle: at(46, G, 10),
};

/** Footprints of the « chemin du banc »: from the back door of the Salle de Vente to the bench. */
export const TRAIL: P3[] = [
  at(28, G, 8),
  at(26, G, 11),
  at(26, G, 15),
  at(27, G, 19),
  at(30, G, 22),
  at(34, G, 24),
  at(39, G, 26),
  at(44, G, 28),
  at(49, G, 30),
  at(53, G, 31),
  at(56, G, 33),
];

/** The White Room (scene « chambre_blanche »). */
export const W = {
  size: [32, 24, 32] as P3,
  floor: 2,
  spawn: at(15, 2, 8),
  center: at(15, 2, 16),
  silas: at(12, 2, 18),
  lea: at(19, 2, 18),
  friendBed: at(15, 2, 23),
  returnPortal: at(15, 2, 4),
  doors: [
    [6, 2, 10, 60],
    [6, 2, 22, 120],
    [15.5, 2, 27, 180],
    [25, 2, 22, 240],
    [25, 2, 10, 300],
  ] as [number, number, number, number][],
  thresholdDoor: [15.5, 2, 28.5, 180] as [number, number, number, number],
  remanence: [15.5, 3.4, 20.5] as P3,
};
