export type BuildingKind =
  | 'townhall' | 'house' | 'office' | 'school' | 'parking' | 'weddinghall' | 'watertower'
  | 'quarry' | 'woodcutter' | 'powerplant' | 'farm' | 'orchard' | 'ranch';

/** How a building's workers behave while at work. */
export type WorkStyle = 'indoor' | 'woodcutter' | 'farmer';

/** Parking slot in local model space: x, z, rotation. Models face +z (towards the road). */
export type Slot = [number, number, number];

export interface BuildingDef {
  kind: BuildingKind;
  /** English name (translated in the UI). */
  name: string;
  size: 1 | 2 | 3;
  money: number;
  stone: number;
  wood: number;
  /** Max family members (houses only — one family per house). */
  housing: number;
  jobs: number;
  /** Gross daily wage per worker. */
  salary: number;
  /** Paid by the city (public sector) instead of a private employer. */
  publicJob: boolean;
  upkeep: number;
  /** Energy used per day (only delivered over roads connected to a power plant). */
  energy: number;
  /** Energy produced per day at full staff. */
  power: number;
  /** Food produced per day at full staff. */
  food: number;
  /** Drinking water for this many people. */
  water: number;
  students: number;
  slots: Slot[];
  needsRoad: boolean;
  work: WorkStyle;
  buildable: boolean;
}

const def = (d: Partial<BuildingDef> & Pick<BuildingDef, 'kind' | 'name' | 'size'>): BuildingDef => ({
  money: 0, stone: 0, wood: 0, housing: 0, jobs: 0, salary: 0, publicJob: false, upkeep: 0, energy: 0, power: 0, food: 0, water: 0,
  students: 0, slots: [], needsRoad: true, work: 'indoor', buildable: true, ...d,
});

export const PARKING_LOT_SLOTS: Slot[] = [
  ...[-0.72, -0.24, 0.24, 0.72].map((x) => [x, -0.55, 0] as Slot),
  ...[-0.72, -0.24, 0.24, 0.72].map((x) => [x, 0.68, Math.PI] as Slot),
];

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  townhall: def({ kind: 'townhall', name: 'Town Hall', size: 2, jobs: 8, salary: 16, publicJob: true, energy: 4, slots: [[-0.8, 0.68, 0], [-0.52, 0.68, 0], [0.45, 0.68, 0]], buildable: false }),
  house: def({ kind: 'house', name: 'House', size: 1, money: 300, stone: 10, wood: 15, housing: 10, energy: 1, slots: [[0.2, 0.35, 0]] }),
  office: def({ kind: 'office', name: 'Office', size: 2, money: 1500, stone: 40, wood: 10, jobs: 24, salary: 20, upkeep: 4, energy: 6, slots: [[-0.42, 0.72, 0], [-0.06, 0.72, 0], [0.3, 0.72, 0]] }),
  school: def({ kind: 'school', name: 'School', size: 2, money: 1200, stone: 30, wood: 20, jobs: 4, salary: 16, publicJob: true, upkeep: 6, energy: 3, students: 40, slots: [[0.45, 0.72, 0], [0.78, 0.72, 0]] }),
  weddinghall: def({ kind: 'weddinghall', name: 'Wedding Hall', size: 1, money: 600, stone: 15, wood: 10, jobs: 1, salary: 14, publicJob: true, upkeep: 2, energy: 1 }),
  watertower: def({ kind: 'watertower', name: 'Water Tower', size: 1, money: 500, stone: 20, jobs: 1, salary: 12, publicJob: true, upkeep: 3, energy: 2, water: 160 }),
  parking: def({ kind: 'parking', name: 'Parking Lot', size: 2, money: 300, stone: 10, upkeep: 2, slots: PARKING_LOT_SLOTS }),
  quarry: def({ kind: 'quarry', name: 'Stone Quarry', size: 2, money: 800, wood: 10, jobs: 8, salary: 14, upkeep: 6, energy: 2 }),
  woodcutter: def({ kind: 'woodcutter', name: 'Woodcutter', size: 1, money: 250, stone: 5, jobs: 3, salary: 11, needsRoad: false, work: 'woodcutter' }),
  powerplant: def({ kind: 'powerplant', name: 'Wood Power Plant', size: 2, money: 1000, stone: 30, wood: 10, jobs: 4, salary: 15, publicJob: true, upkeep: 5, power: 90 }),
  farm: def({ kind: 'farm', name: 'Crop Farm', size: 3, money: 400, wood: 5, jobs: 4, salary: 10, food: 90, needsRoad: false, work: 'farmer' }),
  orchard: def({ kind: 'orchard', name: 'Fruit Orchard', size: 2, money: 300, stone: 5, wood: 5, jobs: 2, salary: 10, food: 30, needsRoad: false, work: 'farmer' }),
  ranch: def({ kind: 'ranch', name: 'Cattle Ranch', size: 3, money: 600, stone: 10, wood: 15, jobs: 2, salary: 11, food: 35, needsRoad: false, work: 'farmer' }),
};

export const QUARRY = {
  /** Stone per day at full staff. */
  perDay: 40,
  truckLoad: 10,
  maxStored: 30,
};

/** Energy units from one unit of wood. */
export const ENERGY_PER_WOOD = 5;
/** A tree is felled in this many parts; each part is one log. */
export const TREE_PARTS = 3;
export const WOOD_PER_LOG = 3;
