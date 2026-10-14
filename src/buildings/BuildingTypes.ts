export type BuildingKind =
  | 'townhall' | 'house' | 'office' | 'school' | 'parking' | 'weddinghall' | 'watertower'
  | 'quarry' | 'woodcutter' | 'powerplant' | 'farm' | 'orchard' | 'ranch' | 'cemetery'
  | 'kindergarten' | 'hotel' | 'windturbine' | 'solarfarm' | 'trainstation' | 'apartment' | 'cemeteryext' | 'ironmine' | 'fishery' | 'police' | 'firestation' | 'busdepot' | 'busstop' | 'grocery' | 'clothes' | 'park' | 'hospital' | 'university' | 'market' | 'carmarket' | 'bank' | 'gasstation' | 'factory' | 'carfactory' | 'construction'
  | 'stadium' | 'cinema' | 'academy' | 'playground' | 'fountain' | 'flowerbed' | 'statue' | 'bench' | 'lamppost' | 'sapling' | 'roadsign' | 'airport'
  | 'military' | 'landfill' | 'recycling' | 'mill' | 'bakery' | 'sawmill' | 'battery' | 'kiosk'
  | 'pharmacy' | 'dairy' | 'supermarket' | 'brickworks' | 'steelmill' | 'sewage' | 'coalmine' | 'coalplant' | 'hydro'
  | 'tower15' | 'tower30' | 'tower50' | 'warehouse' | 'concerthall' | 'casino' | 'mosque' | 'themepark' | 'bigpark' | 'gym' | 'teahouse' | 'barber' | 'bikefactory' | 'migration' | 'gazebo' | 'pond' | 'clocktower' | 'flagpole' | 'planter' | 'archway';


/** How a building's workers behave while at work. */
export type WorkStyle = 'indoor' | 'woodcutter' | 'farmer' | 'builder' | 'miner';

/** Parking slot in local model space: x, z, rotation. Models face +z (towards the road). */
export type Slot = [number, number, number];

export interface BuildingDef {
  kind: BuildingKind;
  /** English name (translated in the UI). */
  name: string;
  size: 1 | 2 | 3 | 4;
  money: number;
  stone: number;
  wood: number;
  iron: number;
  /** Max family members (houses only — one family per house). */
  housing: number;
  /** Homes for this many families (house 1, apartment block 6). */
  units: number;
  jobs: number;
  /** Gross daily wage per worker. */
  salary: number;
  /** Paid by the city (public sector) instead of a private employer. */
  publicJob: boolean;
  upkeep: number;
  /** Electricity in kW (only delivered over roads connected to a power plant; buildings away from roads run their own generator). */
  energy: number;
  /** Energy produced per day at full staff. */
  power: number;
  /** Food produced per day at full staff. */
  food: number;
  /** Drinking water for this many people. */
  water: number;
  students: number;
  slots: Slot[];
  /** Daily business turnover at full staff (taxed). Markets and car dealers earn from sales instead. */
  revenue: number;
  /** Extra daily health recovery for everyone in the city. */
  heal: number;
  needsRoad: boolean;
  work: WorkStyle;
  buildable: boolean;
}

const def = (d: Partial<BuildingDef> & Pick<BuildingDef, 'kind' | 'name' | 'size'>): BuildingDef => ({
  money: 0, stone: 0, wood: 0, iron: 0, housing: 0, units: 0, jobs: 0, salary: 0, publicJob: false, upkeep: 0, energy: 0, power: 0, food: 0, water: 0,
  students: 0, slots: [], revenue: 0, heal: 0, needsRoad: true, work: 'indoor', buildable: true, ...d,
});

export const PARKING_LOT_SLOTS: Slot[] = [
  ...[-0.72, -0.24, 0.24, 0.72].map((x) => [x, -0.55, 0] as Slot),
  ...[-0.72, -0.24, 0.24, 0.72].map((x) => [x, 0.68, Math.PI] as Slot),
];

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  townhall: def({ kind: 'townhall', name: 'Town Hall', size: 2, money: 2500, stone: 60, wood: 40, jobs: 8, salary: 16, publicJob: true, energy: 4, slots: [[-0.8, 0.68, 0], [-0.52, 0.68, 0], [0.45, 0.68, 0]] }),
  house: def({ kind: 'house', name: 'House', size: 1, money: 300, stone: 10, wood: 15, housing: 10, units: 1, energy: 2, slots: [[0.2, 0.35, 0]] }),
  office: def({ kind: 'office', name: 'Office', size: 2, money: 1500, stone: 40, wood: 10, jobs: 24, salary: 20, upkeep: 4, energy: 6, revenue: 120, slots: [[-0.42, 0.72, 0], [-0.06, 0.72, 0], [0.3, 0.72, 0]] }),
  school: def({ kind: 'school', name: 'School', size: 2, money: 1200, stone: 30, wood: 20, jobs: 4, salary: 16, publicJob: true, upkeep: 6, energy: 3, students: 40, slots: [[0.45, 0.72, 0], [0.78, 0.72, 0]] }),
  weddinghall: def({ kind: 'weddinghall', name: 'Wedding Hall', size: 1, money: 600, stone: 15, wood: 10, jobs: 1, salary: 14, publicJob: true, upkeep: 2, energy: 1 }),
  watertower: def({ kind: 'watertower', name: 'Water Tower', size: 1, money: 500, stone: 20, jobs: 1, salary: 12, publicJob: true, upkeep: 3, energy: 2, water: 160 }),
  parking: def({ kind: 'parking', name: 'Parking Lot', size: 2, money: 300, stone: 10, upkeep: 2, slots: PARKING_LOT_SLOTS, energy: 1 }),
  quarry: def({ kind: 'quarry', name: 'Stone Quarry', size: 2, money: 800, wood: 10, jobs: 8, salary: 14, upkeep: 6, needsRoad: false, energy: 3 , work: 'miner' }),
  woodcutter: def({ kind: 'woodcutter', name: 'Woodcutter', size: 1, money: 250, stone: 5, jobs: 3, salary: 11, needsRoad: false, work: 'woodcutter', energy: 1 }),
  powerplant: def({ kind: 'powerplant', name: 'Wood Power Plant', size: 2, money: 1000, stone: 30, wood: 10, jobs: 4, salary: 15, publicJob: true, upkeep: 5, power: 90 }),
  farm: def({ kind: 'farm', name: 'Crop Farm', size: 3, money: 400, wood: 5, jobs: 4, salary: 10, food: 90, needsRoad: false, work: 'farmer', energy: 1 }),
  orchard: def({ kind: 'orchard', name: 'Fruit Orchard', size: 2, money: 300, stone: 5, wood: 5, jobs: 2, salary: 10, food: 30, needsRoad: false, work: 'farmer', energy: 0.5 }),
  ranch: def({ kind: 'ranch', name: 'Cattle Ranch', size: 3, money: 600, stone: 10, wood: 15, jobs: 2, salary: 11, food: 35, needsRoad: false, work: 'farmer', energy: 1 }),
  cemetery: def({ kind: 'cemetery', name: 'Cemetery', size: 2, money: 400, stone: 20, wood: 10, jobs: 1, salary: 10, publicJob: true, upkeep: 2, needsRoad: false, energy: 0.5 }),
  grocery: def({ kind: 'grocery', name: 'Grocery Store', size: 1, money: 500, stone: 8, wood: 8, jobs: 3, salary: 11, energy: 2 }),
  clothes: def({ kind: 'clothes', name: 'Clothing Store', size: 1, money: 600, stone: 8, wood: 10, jobs: 3, salary: 12, energy: 2 }),
  firestation: def({ kind: 'firestation', name: 'Fire Station', size: 1, money: 900, iron: 5, stone: 20, wood: 10, jobs: 4, salary: 16, publicJob: true, upkeep: 4, energy: 2 }),
  busdepot: def({ kind: 'busdepot', name: 'Bus Depot', size: 2, money: 1600, iron: 10, stone: 30, wood: 10, jobs: 4, salary: 14, publicJob: true, upkeep: 6, energy: 3 }),
  busstop: def({ kind: 'busstop', name: 'Bus Stop', size: 1, money: 120, stone: 4, wood: 4, upkeep: 1, energy: 0.5 }),
  kindergarten: def({ kind: 'kindergarten', name: 'Kindergarten', size: 1, money: 600, stone: 10, wood: 10, jobs: 3, salary: 13, publicJob: true, upkeep: 3, energy: 2, students: 24 }),
  hotel: def({ kind: 'hotel', name: 'Hotel', size: 2, money: 2400, stone: 50, wood: 20, iron: 5, jobs: 6, salary: 14, upkeep: 2, energy: 6 }),
  windturbine: def({ kind: 'windturbine', name: 'Wind Turbine', size: 1, money: 900, stone: 10, iron: 15, jobs: 0, salary: 0, upkeep: 2, power: 30, needsRoad: false }),
  solarfarm: def({ kind: 'solarfarm', name: 'Solar Farm', size: 2, money: 1400, stone: 10, iron: 20, jobs: 0, salary: 0, upkeep: 2, power: 45, needsRoad: false }),
  trainstation: def({ kind: 'trainstation', name: 'Train Station', size: 2, money: 1800, stone: 40, wood: 20, iron: 20, jobs: 4, salary: 15, publicJob: true, upkeep: 5, energy: 3 }),
  apartment: def({ kind: 'apartment', name: 'Apartment Block', size: 2, money: 2200, stone: 50, wood: 20, iron: 10, housing: 10, units: 6, upkeep: 2, energy: 8,
    slots: [[-0.75, 0.75, 0], [-0.45, 0.75, 0], [-0.15, 0.75, 0], [0.15, 0.75, 0], [0.45, 0.75, 0], [0.75, 0.75, 0]] }),
  cemeteryext: def({ kind: 'cemeteryext', name: 'Cemetery Extension', size: 2, needsRoad: false, buildable: false }),
  ironmine: def({ kind: 'ironmine', name: 'Iron Mine', size: 2, money: 900, wood: 15, jobs: 6, salary: 15, upkeep: 4, needsRoad: false, energy: 4 , work: 'miner' }),
  fishery: def({ kind: 'fishery', name: 'Fishing Hut', size: 1, money: 350, wood: 10, jobs: 2, salary: 10, food: 25, needsRoad: false, work: 'indoor', energy: 0.5 }),
  police: def({ kind: 'police', name: 'Police Station', size: 1, money: 1200, stone: 20, wood: 10, jobs: 4, salary: 18, publicJob: true, upkeep: 5, energy: 3 }),
  park: def({ kind: 'park', name: 'Park', size: 2, money: 400, wood: 10, jobs: 1, salary: 10, publicJob: true, upkeep: 2, heal: 4, needsRoad: false, energy: 1 }),
  hospital: def({ kind: 'hospital', name: 'Hospital', size: 2, money: 1800, iron: 10, stone: 30, wood: 20, jobs: 6, salary: 22, publicJob: true, upkeep: 8, energy: 5, heal: 20 }),
  university: def({ kind: 'university', name: 'University', size: 3, money: 3500, iron: 10, stone: 70, wood: 40, jobs: 8, salary: 22, publicJob: true, upkeep: 12, energy: 8, students: 30 }),
  market: def({ kind: 'market', name: 'Market', size: 2, money: 900, stone: 20, wood: 15, jobs: 5, salary: 12, energy: 3 }),
  carmarket: def({ kind: 'carmarket', name: 'Car Market', size: 2, money: 1400, stone: 20, wood: 10, jobs: 4, salary: 14, energy: 3 }),
  bank: def({ kind: 'bank', name: 'Bank', size: 1, money: 1500, iron: 5, stone: 25, wood: 5, jobs: 4, salary: 20, energy: 3, revenue: 180 }),
  gasstation: def({ kind: 'gasstation', name: 'Gas Station', size: 1, money: 600, stone: 10, wood: 5, jobs: 2, salary: 11, energy: 2 }),
  factory: def({ kind: 'factory', name: 'Factory', size: 3, money: 2500, iron: 20, stone: 60, wood: 30, jobs: 14, salary: 16, energy: 8, revenue: 280 }),
  carfactory: def({ kind: 'carfactory', name: 'Car Factory', size: 3, money: 4500, iron: 40, stone: 90, wood: 40, jobs: 18, salary: 20, energy: 12, revenue: 450 }),
  construction: def({ kind: 'construction', name: 'Construction Company', size: 2, money: 700, stone: 15, wood: 20, jobs: 6, salary: 14, energy: 2, revenue: 90, work: 'builder' }),
  pharmacy: def({ kind: 'pharmacy', name: 'Pharmacy', size: 1, money: 700, stone: 10, wood: 8, jobs: 2, salary: 14, energy: 2 }),
  dairy: def({ kind: 'dairy', name: 'Dairy', size: 2, money: 1100, stone: 20, wood: 15, iron: 5, jobs: 4, salary: 13, energy: 3 }),
  supermarket: def({ kind: 'supermarket', name: 'Supermarket', size: 2, money: 2000, stone: 40, wood: 15, iron: 8, jobs: 8, salary: 13, energy: 5, slots: [[-0.6, 0.72, 0], [-0.3, 0.72, 0], [0.3, 0.72, 0], [0.6, 0.72, 0]] }),
  brickworks: def({ kind: 'brickworks', name: 'Brickworks', size: 2, money: 1200, stone: 20, wood: 10, iron: 5, jobs: 5, salary: 14, energy: 4 }),
  steelmill: def({ kind: 'steelmill', name: 'Steel Mill', size: 2, money: 2600, stone: 40, iron: 20, jobs: 6, salary: 18, energy: 8 }),
  sewage: def({ kind: 'sewage', name: 'Sewage Treatment', size: 2, money: 1500, stone: 30, iron: 10, jobs: 3, salary: 14, publicJob: true, upkeep: 6, energy: 4 }),
  coalmine: def({ kind: 'coalmine', name: 'Coal Mine', size: 2, money: 1000, wood: 15, jobs: 6, salary: 15, upkeep: 4, needsRoad: false, energy: 4 , work: 'miner' }),
  coalplant: def({ kind: 'coalplant', name: 'Coal Power Plant', size: 2, money: 2200, stone: 40, iron: 20, jobs: 5, salary: 17, publicJob: true, upkeep: 7, power: 160 }),
  hydro: def({ kind: 'hydro', name: 'Hydro Dam', size: 2, money: 4000, stone: 80, iron: 30, jobs: 3, salary: 17, publicJob: true, upkeep: 6, power: 90 }),
  military: def({ kind: 'military', name: 'Military Base', size: 3, money: 5000, stone: 80, wood: 20, iron: 40, jobs: 12, salary: 20, publicJob: true, upkeep: 15, energy: 6 }),
  landfill: def({ kind: 'landfill', name: 'Landfill', size: 2, money: 600, wood: 5, jobs: 3, salary: 12, publicJob: true, upkeep: 3, energy: 1 }),
  recycling: def({ kind: 'recycling', name: 'Recycling Plant', size: 2, money: 2200, stone: 30, iron: 10, jobs: 5, salary: 16, publicJob: true, upkeep: 6, energy: 5 }),
  mill: def({ kind: 'mill', name: 'Flour Mill', size: 2, money: 900, stone: 20, wood: 20, jobs: 3, salary: 12, energy: 2 }),
  bakery: def({ kind: 'bakery', name: 'Bakery', size: 1, money: 700, stone: 10, wood: 10, jobs: 3, salary: 12, energy: 2 }),
  sawmill: def({ kind: 'sawmill', name: 'Sawmill', size: 2, money: 1000, stone: 15, iron: 5, jobs: 4, salary: 13, energy: 3 }),
  battery: def({ kind: 'battery', name: 'Battery Storage', size: 1, money: 1600, stone: 10, iron: 20, jobs: 0, salary: 0, upkeep: 2 }),
  kiosk: def({ kind: 'kiosk', name: 'Coffee Cart', size: 1, money: 150, wood: 4, jobs: 1, salary: 8, needsRoad: false, energy: 0.5 }),
  airport: def({ kind: 'airport', name: 'Airport', size: 3, money: 6000, stone: 100, wood: 20, iron: 50, jobs: 10, salary: 22, publicJob: true, upkeep: 14, energy: 8 }),
  stadium: def({ kind: 'stadium', name: 'Football Stadium', size: 3, money: 3000, stone: 60, wood: 20, iron: 15, jobs: 6, salary: 15, publicJob: true, upkeep: 8, energy: 6 }),
  cinema: def({ kind: 'cinema', name: 'Open-air Cinema', size: 2, money: 1200, stone: 15, wood: 20, iron: 5, jobs: 3, salary: 12, energy: 4 }),
  academy: def({ kind: 'academy', name: 'Academy', size: 2, money: 2600, stone: 50, wood: 25, iron: 10, jobs: 6, salary: 24, publicJob: true, upkeep: 8, energy: 4 }),
  playground: def({ kind: 'playground', name: 'Playground', size: 1, money: 250, wood: 8, stone: 2, upkeep: 1, needsRoad: false }),
  fountain: def({ kind: 'fountain', name: 'Fountain', size: 1, money: 350, stone: 12, upkeep: 1, needsRoad: false, energy: 1 }),
  flowerbed: def({ kind: 'flowerbed', name: 'Flower Bed', size: 1, money: 60, stone: 2, needsRoad: false }),
  statue: def({ kind: 'statue', name: 'Monument', size: 1, money: 600, stone: 20, iron: 4, needsRoad: false, energy: 0.2 }),
  gazebo: def({ kind: 'gazebo', name: 'Gazebo', size: 1, money: 300, wood: 15, stone: 4, needsRoad: false }),
  pond: def({ kind: 'pond', name: 'Duck Pond', size: 2, money: 500, stone: 12, needsRoad: false }),
  clocktower: def({ kind: 'clocktower', name: 'Clock Tower', size: 1, money: 900, stone: 30, iron: 4, needsRoad: false, energy: 0.3 }),
  flagpole: def({ kind: 'flagpole', name: 'Flag Pole', size: 1, money: 120, iron: 2, needsRoad: false }),
  planter: def({ kind: 'planter', name: 'Flower Pots', size: 1, money: 80, stone: 3, needsRoad: false }),
  archway: def({ kind: 'archway', name: 'City Gate', size: 1, money: 600, stone: 20, needsRoad: false }),
  bench: def({ kind: 'bench', name: 'Benches', size: 1, money: 50, wood: 4, needsRoad: false }),
  lamppost: def({ kind: 'lamppost', name: 'Lamp Post', size: 1, money: 80, iron: 1, needsRoad: false, energy: 0.2 }),
  sapling: def({ kind: 'sapling', name: 'Tree', size: 1, money: 30, needsRoad: false }),
  tower15: def({ kind: 'tower15', name: 'Block of 15 Flats', size: 2, money: 4500, stone: 80, wood: 25, iron: 25, housing: 10, units: 15, upkeep: 4, energy: 18,
    slots: [[-0.75, 0.75, 0], [-0.45, 0.75, 0], [-0.15, 0.75, 0], [0.15, 0.75, 0], [0.45, 0.75, 0], [0.75, 0.75, 0]] }),
  tower30: def({ kind: 'tower30', name: 'Block of 30 Flats', size: 2, money: 8000, stone: 140, wood: 30, iron: 50, housing: 10, units: 30, upkeep: 7, energy: 34,
    slots: [[-0.75, 0.75, 0], [-0.45, 0.75, 0], [-0.15, 0.75, 0], [0.15, 0.75, 0], [0.45, 0.75, 0], [0.75, 0.75, 0]] }),
  tower50: def({ kind: 'tower50', name: 'Block of 50 Flats', size: 3, money: 14000, stone: 220, wood: 40, iron: 90, housing: 10, units: 50, upkeep: 12, energy: 56,
    slots: [[-1.2, 1.2, 0], [-0.9, 1.2, 0], [-0.6, 1.2, 0], [-0.3, 1.2, 0], [0.3, 1.2, 0], [0.6, 1.2, 0], [0.9, 1.2, 0], [1.2, 1.2, 0]] }),
  migration: def({ kind: 'migration', name: 'Migration Company', size: 2, money: 1400, stone: 30, wood: 15, iron: 5, jobs: 4, salary: 15, publicJob: true, upkeep: 3, energy: 2 }),
  bikefactory: def({ kind: 'bikefactory', name: 'Bicycle Factory', size: 2, money: 1800, stone: 30, wood: 15, iron: 15, jobs: 6, salary: 13, publicJob: true, upkeep: 3, energy: 4 }),
  warehouse: def({ kind: 'warehouse', name: 'Warehouse', size: 2, money: 900, stone: 20, wood: 30, jobs: 2, salary: 11, publicJob: true, upkeep: 2, energy: 1 }),
  concerthall: def({ kind: 'concerthall', name: 'Concert Hall', size: 2, money: 2800, stone: 50, wood: 25, iron: 10, jobs: 5, salary: 15, publicJob: true, upkeep: 6, energy: 5 }),
  casino: def({ kind: 'casino', name: 'Casino', size: 2, money: 4000, stone: 50, wood: 10, iron: 15, jobs: 6, salary: 18, energy: 6 }),
  mosque: def({ kind: 'mosque', name: 'Mosque', size: 2, money: 1800, stone: 40, wood: 15, jobs: 2, salary: 12, publicJob: true, upkeep: 2, energy: 2 }),
  themepark: def({ kind: 'themepark', name: 'Amusement Park', size: 4, money: 3500, stone: 30, wood: 40, iron: 25, jobs: 6, salary: 13, upkeep: 4, energy: 6 }),
  bigpark: def({ kind: 'bigpark', name: 'Central Park', size: 3, money: 900, wood: 20, jobs: 2, salary: 10, publicJob: true, upkeep: 4, heal: 8, needsRoad: false, energy: 2 }),
  gym: def({ kind: 'gym', name: 'Gym', size: 1, money: 900, stone: 10, iron: 6, jobs: 2, salary: 13, energy: 2 }),
  teahouse: def({ kind: 'teahouse', name: 'Teahouse', size: 2, money: 1100, stone: 15, wood: 25, jobs: 4, salary: 12, energy: 2 }),
  barber: def({ kind: 'barber', name: 'Barber Shop', size: 1, money: 400, stone: 6, wood: 6, jobs: 2, salary: 11, energy: 1 }),
  roadsign: def({ kind: 'roadsign', name: 'Road Signs', size: 1, money: 40, iron: 1, needsRoad: false }),
};

/** Construction time as a fraction of a day, by building size (before builders speed it up). */
export const BUILD_DAYS: Record<1 | 2 | 3 | 4, number> = { 1: 0.06, 2: 0.1, 3: 0.16, 4: 0.2 };
/** Business tax on turnover. */
export const BUSINESS_TAX = 0.2;
export const CEMETERY_UPGRADE = { money: 500, stone: 25, wood: 10, maxLevel: 3 };
export const CAR_PRICE = 700;
/** Bicycles: the price a family pays, what the factory pays back for an old one, bikes per day at full staff, iron per bike, bikes a factory keeps. */
export const BIKE = { price: 60, buyBack: 20, perDay: 12, iron: 0.5, max: 6 };
/** A footpath tile costs this much (paved walkway). */
export const PATH_COST = 3;
/** Plants that burn no wood (the wind blows, the sun shines — solar only by day). */
export const CLEAN_POWER: Partial<Record<BuildingKind, boolean>> = { windturbine: true, solarfarm: true, hydro: true };
/** Air pollution sources: strength and reach in tiles. */
export const POLLUTERS: Partial<Record<BuildingKind, number>> = { factory: 3, carfactory: 4, powerplant: 3, ironmine: 2, quarry: 1.5, landfill: 3, sawmill: 1, coalplant: 6, coalmine: 2.5, steelmill: 4, brickworks: 2 };
export const POLLUTION_RANGE = 8;
/** Decorations: how much they cheer up homes within DECOR_RANGE tiles (happiness points per item, capped). */
export const DECOR: Partial<Record<BuildingKind, number>> = { bigpark: 3, fountain: 1.5, flowerbed: 0.6, statue: 1.2, bench: 0.5, lamppost: 0.4, sapling: 0.5, roadsign: 0.2, playground: 1.0, park: 1.5, gazebo: 1.5, pond: 2.5, clocktower: 2, flagpole: 0.8, planter: 0.7, archway: 1.5 };
/** A road tile inside a mountain (a tunnel). */
export const TUNNEL_COST = { money: 45, stone: 6 };
/** Household bills: electricity per unit of power a home uses a day, water per person a day. */
export const UTILITY = { electricity: 0.9, water: 0.6 };
/** A mine or quarry eats into the mountain: one level of rock goes per this much stone, coal or iron dug. */
export const DIG_PER_LEVEL = { quarry: 120, coalmine: 90, ironmine: 70 } as Record<string, number>;
export const DECOR_RANGE = 6;
/** Airport: goods a plane trades (sold above `keep`, bought below `low`), price per unit. */
export const AIR_TRADE: Record<'food' | 'wood' | 'stone' | 'iron', { keep: number; low: number; price: number }> = {
  food: { keep: 500, low: 30, price: 3 }, wood: { keep: 300, low: 20, price: 4 }, stone: { keep: 300, low: 20, price: 5 }, iron: { keep: 150, low: 10, price: 9 },
};
/** Public transport: fare per ride, the driver's share of it, seats per bus, buses per depot. */
export const BUS = { fare: 2, driverShare: 0.25, seats: 16, perDepot: 2 };
/** City services paid on the spot: a hospital treatment, a parking ticket. */
export const SERVICE_FEE = { hospital: 20, parking: 1 };
/** Production chains: daily output at full staff. */
export const CHAIN = {
  /** Flour mill: grain → flour. */
  mill: 70,
  /** Bakery: flour → bread (food), and how much food one flour makes. */
  bakery: 55, breadPerFlour: 1.4,
  /** Without a mill, raw grain still feeds people (porridge), but worse. */
  rawGrainFood: 0.7, rawGrainPerDay: 90,
  /** Sawmill: wood → planks; planks speed up construction. */
  sawmill: 30, planksPerSite: 2, plankBoost: 1.4,
  /** Units a truck carries between chain buildings (only for show — goods are pooled). */
  load: 15,
};
/** More chains: dairy (milk → cheese, ice cream), brickworks (stone → bricks), steel mill (iron → steel), coal. */
export const CHAIN2 = {
  dairy: 40, foodPerMilk: 1.5, milkShareOfRanch: 0.6,
  bricks: 30, stonePerBrick: 1, steel: 12, ironPerSteel: 1.5,
  /** Factory: clothes from cotton and furniture from planks per day at full staff. */
  garments: 30, furniture: 20,
  coalPerDay: 18, energyPerCoal: 12,
  /** Construction boost from each delivered material, and how much a delivery uses. */
  brickBoost: 1.3, steelBoost: 1.3, perSite: 3,
};
/** Storage: what the town hall can keep of each good, and what each warehouse adds (food keeps longer in its cold rooms). */
export const STORAGE = { hall: 800, hallFood: 1500, warehouse: 2000, warehouseFood: 2500 };
/** Concert hall: seats, and the ticket for a big concert by a touring star. */
export const CONCERT = { seats: 120, ticket: 12 };
/** Paid leisure and services: what a visit costs. Casino stakes are taxed at a higher rate. */
export const VISIT_PRICE: Partial<Record<BuildingKind, [number, number]>> = { concerthall: [6, 10], casino: [15, 70], themepark: [5, 9], gym: [3, 5], teahouse: [6, 14], barber: [3, 7] };
export const CASINO_TAX = 0.4;
/** A share of the adults are believers who go to the mosque to pray. */
export const FAITH_SHARE = 0.45;
/** Crops a field can grow: what it gives and how it looks when ripe. */
export type CropKind = 'wheat' | 'corn' | 'vegetables' | 'cotton' | 'melons';
export const CROPS: Record<CropKind, { name: string; gives: string; ripe: string; height: number; yield: number }> = {
  wheat: { name: 'Wheat', gives: 'Grain for the mill and bakery', ripe: '#e3bf4f', height: 1, yield: 1 },
  corn: { name: 'Corn', gives: 'Feed for the cattle (more milk and meat)', ripe: '#d9b13a', height: 1.8, yield: 1 },
  vegetables: { name: 'Vegetables', gives: 'Potatoes, tomatoes and carrots straight to the shops', ripe: '#c4553d', height: 0.7, yield: 0.8 },
  cotton: { name: 'Cotton', gives: 'Cotton for the clothing stores (they sell much more)', ripe: '#f4f4f2', height: 0.9, yield: 0.6 },
  melons: { name: 'Melons', gives: 'Melons and watermelons: lots of food in summer', ripe: '#9cc95a', height: 0.5, yield: 1.2 },
};
/** Bank: interest the bank pays on savings and charges on family loans (per day); share of savings kept in the bank. */
export const BANKING = { deposit: 0.002, loanRate: 0.006, saveShare: 0.6, maxFamilyLoan: 3000 };
/** Trade: what a unit is worth (the city buys at this price, sells for 80% of it). */
export const TRADE_PRICE: Record<string, number> = { food: 2, wood: 4, stone: 5, iron: 9, coal: 5, planks: 7, bricks: 7, steel: 16, grain: 2, flour: 3, milk: 2, cotton: 4, garments: 9, furniture: 12 };

/** Pensions paid by the town hall per retired citizen per day. */
export const PENSION = 4;
/** Flu: daily chance of an outbreak in winter, days ill, spread. */
export const FLU = { outbreak: 0.2, days: 3, spread: 0.12 };
/** Water reaches homes through mains under the roads and through pipes; per pipe tile cost. */
export const PIPE_COST = { money: 6, iron: 1 };
/** Garbage: per person per day, a full bin, what a truck collects per stop, recycling yield. */
export const TRASH = { perPerson: 0.35, full: 6, ironPerTrash: 0.12, moneyPerTrash: 0.5, range: 22 };
/** Military base: how far its patrols reach, how much safer the city gets. */
export const MILITARY = { range: 26, safety: 0.25 };
/** Battery storage: energy one battery can hold. */
export const BATTERY = { capacity: 40 };
/** Football: ticket price per fan; match day is Sunday. */
export const FOOTBALL = { ticket: 3, fans: 30 };
/** Open-air cinema ticket price and seats per evening. */
export const CINEMA = { ticket: 4, seats: 24 };
/** Tourists: money each one leaves per day, hotel rooms. */
export const TOURISM = { spend: 12, rooms: 24 };
/** Railways: price per tile. */
export const RAIL_COST = { money: 14, iron: 1 };
/** Daily rent a family pays for a flat in an apartment block (to the owner or the city). */
export const RENT = 8;
/** Extra price per tile for a street with lamps; energy per lamp per day. */
export const LAMP = { price: 10, energy: 0.15 };
/** House upgrades: a richer family adds a floor (up to 3). */
export const HOUSE_UPGRADE = { money: 1200, minSavings: 2600, maxLevel: 3 };
/** Fire stations cover buildings within this many tiles. */
export const FIRE_RANGE = 16;
/** A police station watches homes within this many tiles. */
export const POLICE_RANGE = 14;
/** Who keeps the lights on when power is short (lower first). */
export const POWER_PRIORITY: Partial<Record<BuildingKind, number>> = {
  watertower: 0, hospital: 0, firestation: 1, police: 1, school: 2, townhall: 2, university: 2, busdepot: 3, house: 5,
};
/** Workplaces that need a school diploma or a degree (doctors, teachers, engineers, bankers…). */
export const DEGREE_JOBS: Partial<Record<BuildingKind, boolean>> = {
  hospital: true, school: true, university: true, academy: true, bank: true, office: true, pharmacy: true, kindergarten: true,
  townhall: true, airport: true, steelmill: true, carfactory: true, coalplant: true, hydro: true, police: true,
};

/** Lower = filled first when people look for work (water, food, energy and materials keep the town alive). */
export const JOB_PRIORITY: Partial<Record<BuildingKind, number>> = {
  watertower: 0, farm: 1, orchard: 1, ranch: 1, fishery: 1, powerplant: 1, construction: 1, woodcutter: 2, grocery: 2, quarry: 2, ironmine: 2, hospital: 3, townhall: 3, busdepot: 3, police: 3, firestation: 3, hotel: 4,
};
/** Emergency purchase of building materials from travelling merchants. */
export const MERCHANT = { stone: { amount: 10, price: 80 }, wood: { amount: 10, price: 50 }, iron: { amount: 10, price: 140 } };
/** Iron per day from a fully staffed mine. */
export const IRON_PER_DAY = 12;
/** Car factory: cars per day at full staff, iron per car, delivery size; car market stock limit. */
export const CARS = { perDay: 3, iron: 6, truckLoad: 2, factoryMax: 8, marketMax: 12 };
/** Fuel: a trip uses ~8%, below this the car must be refuelled; price per percent of tank. */
export const FUEL = { low: 40, empty: 12, price: 0.15 };
/** What a visit to a shop costs (min, max). */
export const SHOP_PRICE: Record<string, [number, number]> = { grocery: [3, 8], clothes: [6, 16], market: [3, 10], kiosk: [2, 5], bakery: [2, 6], supermarket: [5, 14], pharmacy: [4, 12] };
/** Shops: what each person spends there per day. */
export const SHOP_SPEND = { market: 0.6, grocery: 0.5, clothes: 0.4 } as const;
export type ShopKind = keyof typeof SHOP_SPEND;
/** Businesses a family can own: they collect a share of the turnover as profit. */
export const BUSINESS_KINDS: BuildingKind[] = ['market', 'grocery', 'clothes', 'carmarket', 'bank', 'gasstation', 'factory', 'carfactory', 'construction', 'office', 'casino', 'teahouse', 'barber', 'gym', 'themepark'];
/** Owner's share of the turnover (after the 20% business tax). */
/** Share of a business's profit (after tax and the staff's wages) that the owning family keeps. */
export const OWNER_SHARE = 0.5;
/** Bank loans: size of one loan, the most a city may owe, and the daily interest. */
export const LOAN = { step: 2000, max: 10000, interest: 0.01 };

/** A new Town Hall must be at least this many tiles from every other one. */
export const CITY_MIN_DISTANCE = 18;
export const GRAVE_COST = 100;
export const MAX_GRAVES_PER_CEMETERY = 16;


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
