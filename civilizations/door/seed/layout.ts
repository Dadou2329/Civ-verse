/**
 * Verrou layout — shared by the world seed and the generated cinematics so that camera paths
 * always match the geometry. Coordinates are voxel cells (1 m); +X east, +Z north, +Y up.
 *
 * The city climbs northward in three tiers:
 *   G0 — Faubourg Bas (Cour des Sans-Seuil, Atelier de Mira)        z 0..49
 *   G1 — Galerie des Métiers (Poste du Registre, pont suspendu)       z 50..86
 *   G2 — Archives du Haut (salle des registres, salle aux engrenages) z 87..119
 */
export const SIZE: [number, number, number] = [96, 64, 120];

/** Walking heights (top surface of the ground) of the three tiers. */
export const G0 = 8;
export const G1 = 20;
export const G2 = 32;

export type P3 = [number, number, number];

/** Center of a cell column at a walking height. */
export const at = (x: number, y: number, z: number): P3 => [x + 0.5, y, z + 0.5];

export const L = {
  // --- Faubourg Bas ---------------------------------------------------------------------------
  cell: { x0: 7, x1: 10, z0: 26, z1: 28 },
  cellDoor: at(11, G0, 27),
  spawnCell: at(8, G0, 27),
  noeStart: at(14, G0, 31),
  fountain: at(48, G0, 28),
  well: at(73, G0, 9),
  galleryGate: [48, G0, 50.5] as P3,
  gateGuard: at(45, G0, 47),
  mother: at(61, G0, 40),
  motherInside: at(58, G0, 45),
  guardSoins: at(63, G0, 40),
  varenPost: at(36, G0, 46),
  varenMotherScene: at(60, G0, 38),
  mira: at(77, G0, 22),
  miraBench: at(76, G0, 27),
  workshopDoor: at(70, G0, 24),
  locksmithDoor: at(38, G0, 15),
  spawnEpilogue: at(47, G0, 21),
  miraEpilogue: at(46, G0, 31),
  varenEpilogue: at(50, G0, 31),
  noeEpilogue: at(43, G0, 29),

  // --- Galerie des Métiers -------------------------------------------------------------------
  stairTop: at(75, G1, 52),
  galleryArrival: at(76, G1, 55),
  registryDoor: at(57, G1, 62),
  clerk: at(55, G1, 70),
  varenOffice: at(66, G1, 66),
  patrolA: at(60, G1, 73),
  patrolB: at(65, G1, 77),
  docsCabinet: at(52, G1, 78),
  escortOut: at(57, G1, 65),
  bridgeEast: at(29, G1, 55),
  bridgeWest: at(19, G1, 55),
  pawnDoor: at(9, G1, 62),
  odran: at(7, G1, 68),
  sealedChest: [6.5, G1, 72.2] as P3,
  eda: at(14, G1, 85),
  archivesDoor: [11, G1, 87.5] as P3,

  // --- Archives du Haut ----------------------------------------------------------------------
  archivesArrival: at(38, G2, 90),
  register: at(40, G2, 108),
  gearWheel: [64, G2 + 4.5, 114.6] as P3,
  hatch: { x0: 57, x1: 61, z0: 103, z1: 105 },
  portalDown: at(42, 24, 104),
};

/** The erased corridor (scene "porte_absente"). */
export const A = {
  size: [40, 34, 64] as P3,
  floor: 8,
  spawn: at(19, 8, 5),
  corridor: { x0: 16, x1: 23, z0: 7, z1: 32, h: 6 },
  doors: [
    { id: 'couloir_porte_1', x: 15, z: 11, yaw: 90, model: 'door:door_rank0' },
    { id: 'couloir_porte_2', x: 24, z: 14, yaw: 270, model: 'door:door_rank0' },
    { id: 'couloir_porte_3', x: 15, z: 18, yaw: 90, model: 'door:door_rank1' },
    { id: 'couloir_porte_4', x: 24, z: 21, yaw: 270, model: 'door:door_rank1' },
    { id: 'couloir_porte_5', x: 15, z: 25, yaw: 90, model: 'door:door_rank2' },
    { id: 'couloir_porte_6', x: 24, z: 28, yaw: 270, model: 'door:door_rank2' },
  ],
  /** The wall that leaks light; the absent door appears in it (cells x 19..20, y 8..10). */
  seamZ: 33,
  absentDoor: [20, 8, 33.5] as P3,
  plaque: [20, 10.35, 34.5] as P3,
  fragment: [20, 9.3, 34.6] as P3,
  miraEnter: at(18, 8, 8),
  varenEnter: at(21, 8, 8),
  miraArrive: at(18, 8, 27),
  varenArrive: at(21, 8, 26),
  playerStand: at(19, 8, 30),
};
