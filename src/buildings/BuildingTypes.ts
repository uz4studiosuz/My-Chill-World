export type BuildingKind =
  | 'townhall' | 'house' | 'office' | 'school' | 'parking' | 'weddinghall' | 'watertower'
  | 'quarry' | 'woodcutter' | 'powerplant' | 'farm' | 'orchard' | 'ranch' | 'cemetery'
  | 'kindergarten' | 'hotel' | 'windturbine' | 'solarfarm' | 'trainstation' | 'apartment' | 'cemeteryext' | 'ironmine' | 'fishery' | 'police' | 'firestation' | 'busdepot' | 'busstop' | 'grocery' | 'clothes' | 'park' | 'hospital' | 'university' | 'market' | 'carmarket' | 'bank' | 'gasstation' | 'factory' | 'carfactory' | 'construction'
  | 'stadium' | 'cinema' | 'academy' | 'playground' | 'fountain' | 'flowerbed' | 'statue' | 'bench' | 'lamppost' | 'sapling' | 'roadsign';


/** How a building's workers behave while at work. */
export type WorkStyle = 'indoor' | 'woodcutter' | 'farmer' | 'builder';

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
  parking: def({ kind: 'parking', name: 'Parking Lot', size: 2, money: 300, stone: 10, upkeep: 2, slots: PARKING_LOT_SLOTS }),
  quarry: def({ kind: 'quarry', name: 'Stone Quarry', size: 2, money: 800, wood: 10, jobs: 8, salary: 14, upkeep: 6, needsRoad: false }),
  woodcutter: def({ kind: 'woodcutter', name: 'Woodcutter', size: 1, money: 250, stone: 5, jobs: 3, salary: 11, needsRoad: false, work: 'woodcutter' }),
  powerplant: def({ kind: 'powerplant', name: 'Wood Power Plant', size: 2, money: 1000, stone: 30, wood: 10, jobs: 4, salary: 15, publicJob: true, upkeep: 5, power: 90 }),
  farm: def({ kind: 'farm', name: 'Crop Farm', size: 3, money: 400, wood: 5, jobs: 4, salary: 10, food: 90, needsRoad: false, work: 'farmer' }),
  orchard: def({ kind: 'orchard', name: 'Fruit Orchard', size: 2, money: 300, stone: 5, wood: 5, jobs: 2, salary: 10, food: 30, needsRoad: false, work: 'farmer' }),
  ranch: def({ kind: 'ranch', name: 'Cattle Ranch', size: 3, money: 600, stone: 10, wood: 15, jobs: 2, salary: 11, food: 35, needsRoad: false, work: 'farmer' }),
  cemetery: def({ kind: 'cemetery', name: 'Cemetery', size: 2, money: 400, stone: 20, wood: 10, jobs: 1, salary: 10, publicJob: true, upkeep: 2 }),
  grocery: def({ kind: 'grocery', name: 'Grocery Store', size: 1, money: 500, stone: 8, wood: 8, jobs: 3, salary: 11, energy: 2 }),
  clothes: def({ kind: 'clothes', name: 'Clothing Store', size: 1, money: 600, stone: 8, wood: 10, jobs: 3, salary: 12, energy: 2 }),
  firestation: def({ kind: 'firestation', name: 'Fire Station', size: 1, money: 900, iron: 5, stone: 20, wood: 10, jobs: 4, salary: 16, publicJob: true, upkeep: 4, energy: 2 }),
  busdepot: def({ kind: 'busdepot', name: 'Bus Depot', size: 2, money: 1600, iron: 10, stone: 30, wood: 10, jobs: 4, salary: 14, publicJob: true, upkeep: 6, energy: 3 }),
  busstop: def({ kind: 'busstop', name: 'Bus Stop', size: 1, money: 120, stone: 4, wood: 4, upkeep: 1 }),
  kindergarten: def({ kind: 'kindergarten', name: 'Kindergarten', size: 1, money: 600, stone: 10, wood: 10, jobs: 3, salary: 13, publicJob: true, upkeep: 3, energy: 2, students: 24 }),
  hotel: def({ kind: 'hotel', name: 'Hotel', size: 2, money: 2400, stone: 50, wood: 20, iron: 5, jobs: 6, salary: 14, upkeep: 2, energy: 6 }),
  windturbine: def({ kind: 'windturbine', name: 'Wind Turbine', size: 1, money: 900, stone: 10, iron: 15, jobs: 1, salary: 15, publicJob: true, upkeep: 2, power: 30 }),
  solarfarm: def({ kind: 'solarfarm', name: 'Solar Farm', size: 2, money: 1400, stone: 10, iron: 20, jobs: 1, salary: 15, publicJob: true, upkeep: 2, power: 45 }),
  trainstation: def({ kind: 'trainstation', name: 'Train Station', size: 2, money: 1800, stone: 40, wood: 20, iron: 20, jobs: 4, salary: 15, publicJob: true, upkeep: 5, energy: 3 }),
  apartment: def({ kind: 'apartment', name: 'Apartment Block', size: 2, money: 2200, stone: 50, wood: 20, iron: 10, housing: 10, units: 6, upkeep: 2, energy: 8,
    slots: [[-0.75, 0.75, 0], [-0.45, 0.75, 0], [-0.15, 0.75, 0], [0.15, 0.75, 0], [0.45, 0.75, 0], [0.75, 0.75, 0]] }),
  cemeteryext: def({ kind: 'cemeteryext', name: 'Cemetery Extension', size: 2, needsRoad: false, buildable: false }),
  ironmine: def({ kind: 'ironmine', name: 'Iron Mine', size: 2, money: 900, wood: 15, jobs: 6, salary: 15, upkeep: 4, needsRoad: false }),
  fishery: def({ kind: 'fishery', name: 'Fishing Hut', size: 1, money: 350, wood: 10, jobs: 2, salary: 10, food: 25, needsRoad: false, work: 'indoor' }),
  police: def({ kind: 'police', name: 'Police Station', size: 1, money: 1200, stone: 20, wood: 10, jobs: 4, salary: 18, publicJob: true, upkeep: 5, energy: 3 }),
  park: def({ kind: 'park', name: 'Park', size: 2, money: 400, wood: 10, jobs: 1, salary: 10, publicJob: true, upkeep: 2, heal: 4 }),
  hospital: def({ kind: 'hospital', name: 'Hospital', size: 2, money: 1800, iron: 10, stone: 30, wood: 20, jobs: 6, salary: 22, publicJob: true, upkeep: 8, energy: 5, heal: 20 }),
  university: def({ kind: 'university', name: 'University', size: 3, money: 3500, iron: 10, stone: 70, wood: 40, jobs: 8, salary: 22, publicJob: true, upkeep: 12, energy: 8, students: 30 }),
  market: def({ kind: 'market', name: 'Market', size: 2, money: 900, stone: 20, wood: 15, jobs: 5, salary: 12, energy: 3 }),
  carmarket: def({ kind: 'carmarket', name: 'Car Market', size: 2, money: 1400, stone: 20, wood: 10, jobs: 4, salary: 14, energy: 3 }),
  bank: def({ kind: 'bank', name: 'Bank', size: 1, money: 1500, iron: 5, stone: 25, wood: 5, jobs: 4, salary: 20, energy: 3, revenue: 180 }),
  gasstation: def({ kind: 'gasstation', name: 'Gas Station', size: 1, money: 600, stone: 10, wood: 5, jobs: 2, salary: 11, energy: 2 }),
  factory: def({ kind: 'factory', name: 'Factory', size: 3, money: 2500, iron: 20, stone: 60, wood: 30, jobs: 14, salary: 16, energy: 8, revenue: 280 }),
  carfactory: def({ kind: 'carfactory', name: 'Car Factory', size: 3, money: 4500, iron: 40, stone: 90, wood: 40, jobs: 18, salary: 20, energy: 12, revenue: 450 }),
  construction: def({ kind: 'construction', name: 'Construction Company', size: 2, money: 700, stone: 15, wood: 20, jobs: 6, salary: 14, energy: 2, revenue: 90, work: 'builder' }),
  stadium: def({ kind: 'stadium', name: 'Football Stadium', size: 3, money: 3000, stone: 60, wood: 20, iron: 15, jobs: 6, salary: 15, publicJob: true, upkeep: 8, energy: 6 }),
  cinema: def({ kind: 'cinema', name: 'Open-air Cinema', size: 2, money: 1200, stone: 15, wood: 20, iron: 5, jobs: 3, salary: 12, energy: 4 }),
  academy: def({ kind: 'academy', name: 'Academy', size: 2, money: 2600, stone: 50, wood: 25, iron: 10, jobs: 6, salary: 24, publicJob: true, upkeep: 8, energy: 4 }),
  playground: def({ kind: 'playground', name: 'Playground', size: 1, money: 250, wood: 8, stone: 2, upkeep: 1, needsRoad: false }),
  fountain: def({ kind: 'fountain', name: 'Fountain', size: 1, money: 350, stone: 12, upkeep: 1, needsRoad: false }),
  flowerbed: def({ kind: 'flowerbed', name: 'Flower Bed', size: 1, money: 60, stone: 2, needsRoad: false }),
  statue: def({ kind: 'statue', name: 'Monument', size: 1, money: 600, stone: 20, iron: 4, needsRoad: false }),
  bench: def({ kind: 'bench', name: 'Benches', size: 1, money: 50, wood: 4, needsRoad: false }),
  lamppost: def({ kind: 'lamppost', name: 'Lamp Post', size: 1, money: 80, iron: 1, needsRoad: false }),
  sapling: def({ kind: 'sapling', name: 'Tree', size: 1, money: 30, needsRoad: false }),
  roadsign: def({ kind: 'roadsign', name: 'Road Signs', size: 1, money: 40, iron: 1, needsRoad: false }),
};

/** Construction time as a fraction of a day, by building size (before builders speed it up). */
export const BUILD_DAYS: Record<1 | 2 | 3, number> = { 1: 0.06, 2: 0.1, 3: 0.16 };
/** Business tax on turnover. */
export const BUSINESS_TAX = 0.2;
export const CEMETERY_UPGRADE = { money: 500, stone: 25, wood: 10, maxLevel: 3 };
export const CAR_PRICE = 700;
/** Plants that burn no wood (the wind blows, the sun shines — solar only by day). */
export const CLEAN_POWER: Partial<Record<BuildingKind, boolean>> = { windturbine: true, solarfarm: true };
/** Air pollution sources: strength and reach in tiles. */
export const POLLUTERS: Partial<Record<BuildingKind, number>> = { factory: 3, carfactory: 4, powerplant: 3, ironmine: 2, quarry: 1.5 };
export const POLLUTION_RANGE = 8;
/** Decorations: how much they cheer up homes within DECOR_RANGE tiles (happiness points per item, capped). */
export const DECOR: Partial<Record<BuildingKind, number>> = { fountain: 1.5, flowerbed: 0.6, statue: 1.2, bench: 0.5, lamppost: 0.4, sapling: 0.5, roadsign: 0.2, playground: 1.0 };
export const DECOR_RANGE = 6;
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
/** Lower = filled first when people look for work (water, food, energy and materials keep the town alive). */
export const JOB_PRIORITY: Partial<Record<BuildingKind, number>> = {
  watertower: 0, farm: 1, orchard: 1, ranch: 1, fishery: 1, powerplant: 1, woodcutter: 2, quarry: 2, ironmine: 2, hospital: 3, townhall: 3, construction: 3, busdepot: 3, police: 3, firestation: 3, hotel: 4,
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
export const SHOP_PRICE: Record<string, [number, number]> = { grocery: [3, 8], clothes: [6, 16], market: [3, 10] };
/** Shops: what each person spends there per day. */
export const SHOP_SPEND = { market: 0.6, grocery: 0.5, clothes: 0.4 } as const;
export type ShopKind = keyof typeof SHOP_SPEND;
/** Businesses a family can own: they collect a share of the turnover as profit. */
export const BUSINESS_KINDS: BuildingKind[] = ['market', 'grocery', 'clothes', 'carmarket', 'bank', 'gasstation', 'factory', 'carfactory', 'construction', 'office'];
/** Owner's share of the turnover (after the 20% business tax). */
export const OWNER_SHARE = 0.25;
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
