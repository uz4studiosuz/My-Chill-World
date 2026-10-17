import { LAWS, BUDGET_AREAS } from '../sim/Laws';
import * as THREE from 'three';
import { levelMult, waterOf } from '../buildings/Upgrades';
import { UNIFORM_OF, type Uniform } from '../models/people/uniforms';
import { DAY_SECONDS, DAYS_PER_YEAR } from '../config';
import { DIRS, N, tileToWorld, worldToTile, inBounds, idx } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { Terrain } from '../world/Terrain';
import { RoadNetwork } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { Building, Buildings, Point } from '../buildings/Buildings';
import { BANKING, CROPS, TRADE_PRICE, VISIT_PRICE, CASINO_TAX, BATTERY, CHAIN, CHAIN2, FLU, PENSION, MILITARY, TRASH, BUS, SERVICE_FEE, BUILDINGS, BUSINESS_KINDS, CARS, CLEAN_POWER, POLLUTERS, POLLUTION_RANGE, TOURISM, FIRE_RANGE, FUEL, IRON_PER_DAY, POLICE_RANGE, SHOP_PRICE, POWER_PRIORITY, HOUSE_UPGRADE, OWNER_SHARE, LOAN, GRAVE_COST, MAX_GRAVES_PER_CEMETERY, QUARRY, WOOD_PER_LOG, DEGREE_JOBS, BIKE, DIG_PER_LEVEL, UTILITY } from '../buildings/BuildingTypes';
import type { BuildingKind, CropKind } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { growingSeason, monthOf, seasonOf } from '../sim/Calendar';
import { Citizen, DayReport, Family, Population } from '../people/Population';
import type { City, PromiseKind } from '../sim/Economy';
import type { CargoKind } from '../models/chains';
import { Carry, Walkers } from '../people/Walkers';
import { PedGraph, pedPath } from '../people/PedGraph';
import { Traffic } from '../traffic/Traffic';
import { Effects } from '../fx/Effects';
import { Weather } from '../fx/Weather';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';
import { Leisure } from './Leisure';

export interface LifeContext {
  map: WorldMap;
  terrain: Terrain;
  net: RoadNetwork;
  footpaths: Footpaths;
  canals: Canals;
  buildings: Buildings;
  eco: Economy;
  pop: Population;
  walkers: Walkers;
  traffic: Traffic;
  effects: Effects;
  weather: Weather;
  /** A building burnt down. */
  burnDown: (b: Building) => void;
  /** Does this road tile have street lamps? */
  isLit?: (k: number) => boolean;
  /** Water pipe tiles. */
  pipes?: Uint8Array;
  /** Electric cables (the power grid). */
  cables?: Uint8Array;
}

export interface BusPassenger {
  citizenId: number;
  pickupStopId: number;
  dropStopId: number;
  finalDestId: number;
}

export interface BusWaiter {
  citizenId: number;
  pickupStopId: number;
  dropStopId: number;
  finalDestId: number;
  waitTimer: number;
}

export interface ActiveBusState {
  vehicleId: number;
  depotId: number;
  routeNum: number;
  stops: number[];
  currentIdx: number;
  passengers: BusPassenger[];
  /** The depot worker driving this bus on their shift. */
  driverId: number;
}

const TRUCKS_PER_QUARRY = 2;
/** Cars a multi-storey car park holds on each level. */
export const GARAGE_CARS = 24;
/** Fare for one metro ride. */
export const METRO_FARE = 2;
const PARK_RADIUS = 20;
/** How far woodcutters walk for trees, and quarrymen and miners for rock, before their workplace stops (tiles). */
const WOOD_REACH = 26;
const ROCK_REACH = 14;
const IMMIGRATION_INTERVAL = DAY_SECONDS / 3;
const ROAD_UPKEEP = 0.1;
const BRIDGE_UPKEEP = 0.5;
/** Working hours as fractions of the day (8:00–17:30). */
const WORK_FROM = 0.33, WORK_TO = 0.73;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/** Built without a construction company (slowly). */
const CASH_REASON = { incomeTax: 'Income tax', publicWages: 'Public wages', fares: 'Bus fares', services: 'City services', businessTax: 'Business tax' } as const;
/** Portions of food a day: adults, children (3–13), babies. */
const FOOD_RATE = { adult: 1.4, child: 0.9, baby: 0.4 };
/** Winter heating: wood each home burns per day and the price the town hall sells it for. */
const HEATING = { woodPerHome: 1.2, price: 3 };
/** Activities of workers who are out driving a service vehicle (they stay on duty until back). */
const DRIVING = new Set(['Driving the bus', 'On patrol', 'Driving a truck', 'Driving the fire truck', 'Driving the ambulance', 'Drilling on the parade ground', 'Collecting garbage']);
export type WeatherMood = 'clear' | 'fog' | 'blizzard' | 'heat';
const CARGO_PURPOSE: Record<CargoKind, string> = {
  bricks: 'Delivering bricks', steel: 'Delivering iron beams', milk: 'Bringing milk to the dairy', dairy: 'Delivering cheese and ice cream',
  stone: 'Delivering stone', logs: 'Bringing logs to the sawmill', planks: 'Delivering planks', grain: 'Bringing grain to the mill',
  flour: 'Bringing flour to the bakery', bread: 'Delivering bread to the shops', trash: 'Collecting garbage', veg: 'Delivering fruit and fish',
  cotton: 'Bringing cotton to the clothing stores', corn: 'Bringing corn feed to the ranch',
};
const SELF_BUILT: Partial<Record<string, boolean>> = { townhall: true, construction: true };

export const PROMISE_TEXT: Record<PromiseKind, string> = {
  tax: 'promises lower taxes', park: 'promises a new park', hospital: 'promises a hospital', school: 'promises a new school', jobs: 'promises jobs for everyone',
};

/**
 * Everyday life: schedules, commuting by car or on foot (sidewalks, zebra crossings), work behaviour,
 * production, the power grid, water, needs, fires and the end-of-day settlement.
 */
/** People one sewage treatment plant serves. */
export const SEWAGE_PER_PLANT = 300;

export class Life {
  readonly graph: PedGraph;
  private spots = new Map<string, number>();
  private reservedTrees = new Set<number>();
  private immigrationT = 0;
  private stormT = 40;
  private porters = new Set<number>();
  /** Calm mode: no disasters, crime or bankruptcy. */
  calm = false;
  /** Festival running today (Navruz, New Year). */
  festival: string | null = null;
  /** Air pollution at each home (building id). */
  pollution = new Map<number, number>();
  /** Hotel id → how attractive the town is to tourists (0..1+). */
  attraction = new Map<number, number>();
  private serviceT = 5;
  /** Water supply of every home (0..1), from towers through road mains and pipes. */
  homeWater = new Map<number, number>();
  /** Share of people whose sewage is treated, per city. */
  sanitation = new Map<number, number>();
  /** People a town's waste water system can take, and how many it has. */
  sewageCap = new Map<number, { people: number; treated: number }>();
  /** Today's special weather. */
  weatherMood: WeatherMood = 'clear';
  /** Extra happiness from the town hall's decisions (value, until day), per city. */
  moodBoost = new Map<number, { v: number; until: number }>();
  private waterT = 0;
  /** Share of homes with overflowing bins, per city. */
  private dirty = new Map<number, number>();
  /** Homes a garbage truck is already on its way to. */
  private binTaken = new Set<number>();
  /** Energy kept in batteries (all grids together), and how much they can hold. */
  batteryCharge = 0;
  batteryCap = 0;
  /** Food portions eaten per day, per city (by age). */
  private mouths = new Map<number, number>();
  /** Drivers who found no parking space today, per town (they complain). */
  private parkFails = new Map<number, number>();
  private energyAcc = 0;
  /** News of a neighbour town goes into that town's own chronicle (set by the game). */
  onForeign?: (cityId: number, msg: string) => void;
  /** May a private builder put a building here (neighbour towns keep room for their future streets)? */
  streetRoom?: (cityId: number, kind: BuildingKind, x: number, z: number) => boolean;

  /** Something happened in a town: the player's news go to the chronicle, a neighbour's to its own news. */
  cityEvent(cityId: number | undefined, msg: string) {
    const city = cityId === undefined ? undefined : this.c.eco.cities.get(cityId);
    if (city?.ai) this.onForeign?.(city.id, msg);
    else this.events.push(msg);
  }
  /** Each family: how much it eats per day and its city. */
  private famNeed = new Map<number, { need: number; city: number }>();
  /** Cities where families can buy food (a staffed food shop). */
  private foodShops = new Set<number>();
  /** Share of homes heated this winter, per city. */
  private heated = new Map<number, number>();
  private routeCache = new Map<number, { t: number; stops: number[] }>();
  /** Which half of its district each police station's last car patrols. */
  private policeSector = new Map<number, number>();
  /** Buses / patrol cars on the road per depot or station. */
  private fleet = new Map<number, number>();
  /** Active buses running transit routes (vehicleId -> state). */
  private busFleet = new Map<number, ActiveBusState>();
  /** Passengers waiting at bus stops (stopBuildingId -> waiters). */
  private busWaiters = new Map<number, BusWaiter[]>();
  /** Street lamp energy per city (set by the game when roads change). */
  lampDemand: [number, number][] = [];
  lampsLit = true;
  private privateBuild = new Map<number, number>();
  /** Bank figures of yesterday per city. */
  bankStats = new Map<number, { deposits: number; loans: number; paid: number; earned: number; borrowers: number; savers: number }>();
  /** Food eaten / missing today per city (people eat through the day, not once at midnight). */
  private meals = new Map<number, { eaten: number; short: number }>();
  private people = new Map<number, number>();
  /** Builders currently working on each construction site. */
  private crews = new Map<number, Set<number>>();
  private busyBuilders = new Set<number>();
  private presentT = 0;
  private fireT = 0;
  private gridIds = new Set<number>();
  /** Road network component of every tile (for the power grid). */
  private comp?: Int32Array;
  private rained = new Set<number>();
  events: string[] = [];
  /** Money that changed hands just now (city id, amount) — the HUD shows it at once. */
  onMoney: (city: number, amount: number) => void = () => {};
  /** Today's on-the-spot income and spending per city (added to the daily balance). */
  private live = new Map<number, { incomeTax: number; publicWages: number; fares: number; services: number; businessTax: number }>();
  /** Playgrounds, cinema, football, festivals, weddings, ambulances and residents' letters. */
  readonly leisure: Leisure;
  /** Fire trucks spraying water: building, nozzle position, seconds left. */
  private sprays: { b: Building; x: number; z: number; t: number; done: () => void }[] = [];

  constructor(private c: LifeContext) {
    this.leisure = new Leisure(c, this);
    c.walkers.uniformOf = (w) => (w.citizen !== undefined ? this.uniformFor(w.citizen) : undefined);
    const { map, net, footpaths, canals, buildings, traffic } = c;
    // pedestrians cross at signalled junctions only on green for their direction
    c.walkers.gate = (x0, z0, x1, z1) => {
      if (Math.abs(x1 - x0) + Math.abs(z1 - z0) < 0.25) return true;
      const k = worldToTile((z0 + z1) / 2) * N + worldToTile((x0 + x1) / 2);
      if (k < 0 || k >= N * N || !net.type[k] || !traffic.hasLight(k)) return true;
      return traffic.light(k, Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 2 : 1) === 'green';
    };
    this.graph = new PedGraph({
      roadType: (k) => net.type[k],
      roadConn: (k) => net.conn[k],
      groundCost: (k) => {
        if (map.water[k] || map.height[k] > 0 || buildings.occ[k] !== -1 || net.isIsland(k)) return Infinity;
        if (footpaths.tiles[k]) return 0.7;
        return canals.tiles[k] ? 2.6 : 2.2;
      },
    });
  }

  // ---------- per frame ----------

  update(dt: number) {
    const { eco, pop } = this.c;
    if (eco.tick(dt)) this.newDay();
    pop.tickNeeds(dt / DAY_SECONDS);
    this.eat(dt);
    // power is shared out about once a game second (the same amounts, much less work at high speed)
    this.energyAcc += dt;
    if (this.energyAcc >= 1) { this.updateEnergy(this.energyAcc); this.energyAcc = 0; }
    this.presentT -= dt;
    this.serviceT -= dt;
    if (this.serviceT <= 0) { this.serviceT = 3; this.dispatchServices(); this.deliverPlanks(); }
    this.waterT -= dt;
    if (this.waterT <= 0) { this.waterT = 2; this.updateWater(); }
    this.updateBusWaiters(dt);
    if (this.presentT <= 0) { this.presentT = 0.5; this.people = this.populationByCity(); this.mouths = this.appetiteByCity(); this.countPresent(); this.checkRain(); this.dispatchBuilders(); }
    this.produce(dt);
    this.schedule();
    this.updateFires(dt);
    this.stormT -= dt;
    if (this.stormT <= 0) { this.stormT = DAY_SECONDS * (0.02 + Math.random() * 0.04); this.storm(); }
    this.immigrationT += dt;
    if (this.immigrationT > IMMIGRATION_INTERVAL) { this.immigrationT = 0; this.immigrate(); }
    this.leisure.update(dt);
  }

  isLit(k: number) { return this.c.isLit?.(k) ?? false; }

  private liveOf(city: number) {
    let l = this.live.get(city);
    if (!l) this.live.set(city, (l = { incomeTax: 0, publicWages: 0, fares: 0, services: 0, businessTax: 0 }));
    return l;
  }

  /** Change a city's treasury right now and tell the HUD. */
  private cash(cityId: number, amount: number, kind: 'incomeTax' | 'publicWages' | 'fares' | 'services' | 'businessTax') {
    const city = this.c.eco.cities.get(cityId);
    if (!city || !amount) return;
    this.c.eco.add(city, 'money', amount, CASH_REASON[kind]);
    this.liveOf(cityId)[kind] += Math.abs(amount);
    this.onMoney(cityId, amount);
  }

  /** Count something a business sold (or made) today, for its accounts. */
  tally(b: Building, item: string, n = 1) {
    if (n <= 0) return;
    const s = (b.sold ??= {});
    s[item] = (s[item] ?? 0) + n;
  }

  /** A family pays the city for a service (hospital treatment, parking ticket) on the spot. */
  /** A visitor pays a business for a service (teahouse, gym, casino…): the tax reaches the town hall right away. */
  sell(c: Citizen, b: Building, amount: number) {
    if (b.kind !== 'casino') this.tally(b, 'Visitors');
    const f = this.family(c);
    const city = this.c.eco.cities.get(b.city);
    if (!f || !city) return;
    f.money -= amount;
    b.sales = (b.sales ?? 0) + amount;
    b.salesTaxed = (b.salesTaxed ?? 0) + amount;
    this.cash(b.city, amount * (b.kind === 'casino' ? CASINO_TAX : city.taxRate * 0.8), 'businessTax');
  }

  charge(c: Citizen, cityId: number, amount: number) {
    const f = this.family(c);
    if (!f) return;
    f.money -= amount;
    this.cash(cityId, amount, 'services');
  }

  /** A worker finishes the shift: the wage is paid now, income tax goes to the city, public wages come out of it. */
  /** A family earns money; the source is kept for its panel ("where the money comes from"). */
  earn(f: Family, amount: number, why: string) {
    if (!amount) return;
    f.money += amount;
    f.income += Math.round(amount);
    const e = (f.earn ??= {});
    e[why] = (e[why] ?? 0) + amount;
  }

  private payShift(c: Citizen, b: Building) {
    const f = this.family(c);
    const city = this.c.eco.cities.get(b.city);
    if (!f || !city || c.paid) return;
    const gross = this.c.pop.wage(c, b);
    if (gross <= 0) return;
    c.paid = true;
    const tax = gross * city.taxRate;
    this.earn(f, gross - tax, 'Wages');
    // the business pays its staff out of its takings (shown in its accounts)
    b.wagesToday = (b.wagesToday ?? 0) + gross;
    if (BUILDINGS[b.kind].publicJob) this.cash(b.city, -gross, 'publicWages');
    this.cash(b.city, tax, 'incomeTax');
  }

  /** Send someone who is at home to a leisure place until `until` (time of day). */
  planOuting(c: Citizen, dest: Building, until: number) {
    const tod = this.c.eco.timeOfDay;
    if (c.state !== 'home' || until <= tod + 0.04) return false;
    c.outing = dest.id;
    c.leaveAt = tod;
    c.returnAt = until;
    return true;
  }

  /** Bicycles ready at the factories, standing in a row in front (one factory shows up to six). */
  factoryBikes() {
    const out: { x: number; z: number; rot: number }[] = [];
    for (const m of this.c.buildings.list) {
      if (m.kind !== 'bikefactory' || m.built < 1) continue;
      const n = Math.min(BIKE.max, Math.floor(m.stored));
      const cr = Math.cos(m.rot), sr = Math.sin(m.rot);
      for (let i = 0; i < n; i++) {
        const lx = -0.75 + i * 0.22, lz = 0.6;
        out.push({ x: m.mesh.position.x + lx * cr + lz * sr, z: m.mesh.position.z - lx * sr + lz * cr, rot: m.rot + Math.PI / 2 });
      }
    }
    return out;
  }

  /** Cars parked inside each multi-storey car park (garage id → cars). */
  garageUse = new Map<number, number>();
  /** Cars standing in each open parking lot now. */
  lotUse = new Map<number, number>();
  /** Cars parked along the kerb in each town. */
  kerbUse = new Map<number, number>();
  /** Passengers waiting at a stop now. */
  waitingAt(stopId: number) { return this.busWaiters.get(stopId)?.length ?? 0; }
  /** Count something a business sold (for its books). */
  countSale(b: Building, item: string, n = 1) { this.tally(b, item, n); }
  private parkCache?: { t: number; out: { x: number; z: number; rot: number; color: THREE.Color }[] };

  /**
   * Every parked car: in its home's own spaces, in a parking lot, and when the home's spaces are full, along the
   * kerb of its street (never on top of another car); when even the kerb is full it waits in the garage (hidden).
   */
  parkedCars() {
    const now = performance.now();
    if (this.parkCache && now - this.parkCache.t < 400) return this.parkCache.out;
    const { pop, buildings, net } = this.c;
    const out: { x: number; z: number; rot: number; color: THREE.Color }[] = [];
    const at = new Map<number, number>();
    // cells already taken by a parked car (a quarter of a tile), so no two cars ever stand on one spot
    const taken = new Set<number>();
    const cell = (x: number, z: number) => Math.round(x * 4) * 4096 + Math.round(z * 4);
    const free = (x: number, z: number) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (taken.has(cell(x + dx * 0.12, z + dz * 0.12))) return false; return true; };
    const put = (p: { x: number; z: number; rot: number }, color: THREE.Color) => { out.push({ ...p, color }); taken.add(cell(p.x, p.z)); };
    const overflow: { h: Building; color: THREE.Color }[] = [];
    const lotUse = new Map<number, number>();
    const kerb = new Map<number, number>();
    for (const f of pop.families.values()) {
      if (!f.car || f.car.at === 'moving') continue;
      const color = colorOf(f.car.color);
      if (f.car.at === 'home') {
        const h = buildings.get(f.home);
        if (!h) continue;
        const i = at.get(h.id) ?? 0;
        at.set(h.id, i + 1);
        const slots = BUILDINGS[h.kind].slots.length;
        const p = i < slots ? buildings.slot(h, i) : null;
        if (p && free(p.x, p.z)) put(p, color);
        else overflow.push({ h, color });
      } else if (f.car.lot !== undefined) {
        // a car out at a parking lot: in its own space (never on another car; one more than the lot holds waits on the kerb)
        const lot = buildings.get(f.car.lot);
        if (!lot || lot.kind === 'garage') continue;
        const p = buildings.slot(lot, f.car.slot!);
        if (free(p.x, p.z) && (lotUse.get(lot.id) ?? 0) < BUILDINGS[lot.kind].slots.length) { put(p, color); lotUse.set(lot.id, (lotUse.get(lot.id) ?? 0) + 1); }
        else { const h = buildings.get(f.home); if (h) overflow.push({ h, color }); }
      }
    }
    // the home's spaces are full: a parking lot or garage nearby, else a straight row along the kerb of its street
    // (the home's side first, then across), as far down the street as it takes
    const garages = buildings.list.filter((b) => (b.kind === 'parking' || b.kind === 'garage') && b.built >= 1 && !b.removed);
    const inGarage = new Map<number, number>();
    for (const g of garages) if (g.kind === 'garage') inGarage.set(g.id, this.spotsUsed(g));
    for (const { h, color } of overflow) {
      const lot = garages.filter((g) => Math.abs(g.x - h.x) + Math.abs(g.z - h.z) <= 8).sort((a, b) => Math.abs(a.x - h.x) + Math.abs(a.z - h.z) - (Math.abs(b.x - h.x) + Math.abs(b.z - h.z)));
      let done = false;
      for (const g of lot) {
        if (g.kind === 'garage') {
          // a multi-storey car park: the car goes inside (up to its floors' room)
          const n = inGarage.get(g.id) ?? 0;
          const cap = GARAGE_CARS * (g.level || 1);
          if (n < cap - Math.max(4, Math.floor(cap / 4)) || (n < cap && this.spotsUsed(g) > 0)) { inGarage.set(g.id, n + 1); done = true; break; }
          continue;
        }
        const slots = BUILDINGS[g.kind].slots.length;
        if ((lotUse.get(g.id) ?? 0) >= slots) continue;
        for (let i = 0; i < slots && !done; i++) { const p = buildings.slot(g, i); if (!this.spots.has(`${g.id}:${i}`) && free(p.x, p.z)) { put(p, color); done = true; lotUse.set(g.id, (lotUse.get(g.id) ?? 0) + 1); } }
        if (done) break;
      }
      if (done || h.access < 0) continue;
      const ax = h.access % N, az = (h.access / N) | 0;
      const s = BUILDINGS[h.kind].size;
      const bx = h.x + (s - 1) / 2, bz = h.z + (s - 1) / 2;
      const home = Math.abs(bx - ax) >= Math.abs(bz - az) ? { x: Math.sign(bx - ax), z: 0 } : { x: 0, z: Math.sign(bz - az) };
      const along = { x: -home.z, z: home.x };
      const rot = Math.atan2(along.x, along.z);
      for (const side of [home, { x: -home.x, z: -home.z }]) {
        for (let i = 0; i <= 20 && !done; i++) {
          const step = i % 2 ? (i + 1) / 2 : -i / 2;
          const tx = ax + along.x * step, tz = az + along.z * step;
          if (!inBounds(tx, tz)) continue;
          const k = tz * N + tx;
          if (!net.type[k] || net.isIntersection(k) || net.isRing(k) || this.c.map.water[k]) continue;
          // only along a straight piece of the same street
          for (const o of [-0.22, 0.22]) {
            const x = tileToWorld(tx) + side.x * 0.36 + along.x * o, z = tileToWorld(tz) + side.z * 0.36 + along.z * o;
            if (!free(x, z)) continue;
            put({ x, z, rot }, color);
            kerb.set(h.city, (kerb.get(h.city) ?? 0) + 1);
            done = true;
            break;
          }
        }
        if (done) break;
      }
    }
    this.garageUse = inGarage;
    this.kerbUse = kerb;
    this.lotUse = lotUse;
    // new cars for sale stand in a row in front of each car market
    const SHOW = ['red', 'blue', 'white', 'black', 'silver', 'green', 'yellow', 'orange'];
    for (const m of buildings.list) {
      if (m.kind !== 'carmarket' || m.built < 1) continue;
      const n = Math.min(8, Math.floor(m.stored));
      const cr = Math.cos(m.rot), sr = Math.sin(m.rot);
      for (let i = 0; i < n; i++) {
        const lx = -0.78 + (i % 4) * 0.52, lz = i < 4 ? 0.7 : 0.38;
        out.push({ x: m.mesh.position.x + lx * cr + lz * sr, z: m.mesh.position.z - lx * sr + lz * cr, rot: m.rot + Math.PI / 2, color: colorOf(SHOW[(m.id + i) % SHOW.length]) });
      }
    }
    this.parkCache = { t: now, out };
    return out;
  }

  /** Cars waiting for buyers in a town's car markets. */
  carsInMarkets(cityId: number) {
    return this.c.buildings.list.reduce((a, b) => a + (b.kind === 'carmarket' && b.city === cityId && b.built >= 1 ? Math.floor(b.stored) : 0), 0);
  }

  /** Take cars out of (n < 0) or put cars into (n > 0) a town's car markets; returns how many moved. */
  moveCars(cityId: number, n: number) {
    let left = Math.abs(n), moved = 0;
    for (const m of this.c.buildings.list) {
      if (m.kind !== 'carmarket' || m.city !== cityId || m.built < 1 || left <= 0) continue;
      const k = n < 0 ? Math.min(left, Math.floor(m.stored)) : Math.min(left, Math.max(0, CARS.marketMax - Math.floor(m.stored)));
      m.stored += n < 0 ? -k : k;
      left -= k;
      moved += k;
    }
    return moved;
  }

  roadUpkeep() {
    const c = this.c.net.counts(this.c.map.water);
    return (c.total - c.bridges) * ROAD_UPKEEP + c.bridges * BRIDGE_UPKEEP;
  }

  /** Empty houses (of one city, or all). */
  freeHomes(city?: number) {
    const { buildings, pop } = this.c;
    const used = new Map<number, number>();
    for (const f of pop.families.values()) used.set(f.home, (used.get(f.home) ?? 0) + 1);
    const out: Building[] = [];
    for (const b of buildings.list) {
      const units = BUILDINGS[b.kind].units;
      if (!units || b.built < 1 || (city !== undefined && b.city !== city)) continue;
      for (let i = used.get(b.id) ?? 0; i < units; i++) out.push(b);
    }
    return out;
  }

  /** Food portions a city eats per day: adults eat more than children, babies little. */
  appetiteByCity() {
    const { buildings, pop } = this.c;
    const out = new Map<number, number>();
    for (const f of pop.families.values()) {
      const h = buildings.get(f.home);
      if (!h) continue;
      let n = 0;
      for (const c of pop.members(f)) n += c.age < 3 ? FOOD_RATE.baby : c.age < 14 ? FOOD_RATE.child : FOOD_RATE.adult;
      out.set(h.city, (out.get(h.city) ?? 0) + n);
      this.famNeed.set(f.id, { need: n, city: h.city });
    }
    for (const id of this.famNeed.keys()) if (!pop.families.has(id)) this.famNeed.delete(id);
    this.foodShops.clear();
    for (const b of buildings.list) if ((b.kind === 'grocery' || b.kind === 'market' || b.kind === 'supermarket' || b.kind === 'bakery') && b.built >= 1 && b.workers > 0) this.foodShops.add(b.city);
    return out;
  }

  /** Winter: every home burns wood bought from the town hall; without it the family is cold. */
  private heating(city: City, belongs: (f: Family) => boolean, say: (msg: string) => void) {
    const { pop, eco } = this.c;
    const season = seasonOf(monthOf(eco.day));
    const cold = season === 'winter' ? 1 : monthOf(eco.day) === 10 || monthOf(eco.day) === 2 ? 0.5 : 0;
    this.heated.set(city.id, 1);
    if (!cold) return;
    let homes = 0, warm = 0;
    for (const f of pop.families.values()) {
      if (!belongs(f)) continue;
      homes++;
      const need = HEATING.woodPerHome * cold;
      const price = need * HEATING.price;
      if (city.wood >= need && f.money >= price) {
        eco.add(city, 'wood', -need, 'Firewood for homes');
        eco.add(city, 'money', price, 'Firewood sales');
        f.money -= price;
        warm++;
      } else {
        // a cold home: people catch colds, the old and the little ones suffer most
        for (const c of pop.members(f)) {
          c.health = Math.max(0, c.health - (c.age < 5 || c.age > 65 ? 16 : 8) * cold);
          if (c.health <= 0) c.health = 1;
        }
      }
    }
    const share = homes ? warm / homes : 1;
    this.heated.set(city.id, share);
    if (share < 0.95) say(t('{n} homes are cold — the town hall has no firewood to sell (or families cannot pay)', { n: homes - warm }));
  }

  /** People living in each city. */
  populationByCity() {
    const { buildings, pop } = this.c;
    const out = new Map<number, number>();
    for (const f of pop.families.values()) {
      const h = buildings.get(f.home);
      if (h) out.set(h.city, (out.get(h.city) ?? 0) + f.members.length);
    }
    return out;
  }

  // ---------- power grid & water ----------

  /**
   * The power grid: electric cables joined tile to tile. A building is on it when a cable runs under it or along
   * the road tile in front of its door; a grid is live when a working power plant is on it. Call after any change.
   */
  rebuildGrid() {
    const { buildings } = this.c;
    const cab = this.c.cables;
    const comp = new Int32Array(N * N).fill(-1);
    let id = 0;
    if (cab) for (let k = 0; k < comp.length; k++) {
      if (!cab[k] || comp[k] >= 0) continue;
      const stack = [k];
      comp[k] = id;
      while (stack.length) {
        const cur = stack.pop()!;
        const x = cur % N, z = (cur / N) | 0;
        for (const d of DIRS) {
          const nx = x + d.dx, nz = z + d.dz;
          if (!inBounds(nx, nz)) continue;
          const nk = nz * N + nx;
          if (comp[nk] < 0 && cab[nk]) { comp[nk] = id; stack.push(nk); }
        }
      }
      id++;
    }
    this.comp = comp;
    // the road networks (for the neighbour towns)
    const { net } = this.c;
    const roadComp = new Int32Array(N * N).fill(-1);
    let rid = 0;
    for (let k = 0; k < roadComp.length; k++) {
      if (!net.type[k] || roadComp[k] >= 0) continue;
      const stack = [k];
      roadComp[k] = rid;
      while (stack.length) {
        const cur = stack.pop()!;
        const x = cur % N, z = (cur / N) | 0;
        for (const d of DIRS) {
          if (!(net.conn[cur] & d.bit)) continue;
          const nk = (z + d.dz) * N + x + d.dx;
          if (roadComp[nk] < 0 && net.type[nk]) { roadComp[nk] = rid; stack.push(nk); }
        }
      }
      rid++;
    }
    this.bComp.clear();
    for (const b of buildings.list) {
      if (b.removed) continue;
      const s = BUILDINGS[b.kind].size;
      let c = -1;
      for (let z = b.z; z < b.z + s && c < 0; z++) for (let x = b.x; x < b.x + s; x++) if (inBounds(x, z) && comp[z * N + x] >= 0) { c = comp[z * N + x]; break; }
      if (c < 0 && b.access >= 0) c = comp[b.access];
      // neighbour towns run their own cables along their streets: their grid follows the roads
      if (c < 0 && b.access >= 0 && this.c.eco.cities.get(b.city)?.ai) c = 1_000_000 + roadComp[b.access];
      if (c >= 0) this.bComp.set(b.id, c);
    }
    const live = new Set<number>();
    for (const p of buildings.list) if (BUILDINGS[p.kind].power && p.built >= 1 && (p.workers > 0 || CLEAN_POWER[p.kind]) && this.bComp.has(p.id)) live.add(this.bComp.get(p.id)!);
    this.liveComps = live;
    this.gridIds.clear();
    for (const b of buildings.list) if (live.has(this.bComp.get(b.id) ?? -1)) this.gridIds.add(b.id);
  }

  /** Grid of every building (the cable network it is joined to). */
  private bComp = new Map<number, number>();
  private liveComps = new Set<number>();
  /** Is this tile's cable joined to a working power plant (street lamps)? */
  cableLive(k: number) { return !!this.comp && this.comp[k] >= 0 && this.liveComps.has(this.comp[k]); }
  /** Is the building joined to a cable at all (even a dead one)? */
  onCable(b: Building) { return this.bComp.has(b.id); }

  onGrid(b: Building) { return this.gridIds.has(b.id); }

  /** Buildings that use electricity on the same road-connected grid as this one (what a plant feeds). */
  gridMates(b: Building) {
    const c = this.bComp.get(b.id);
    if (c === undefined) return [];
    return this.c.buildings.list.filter((o) => this.bComp.get(o.id) === c && BUILDINGS[o.kind].energy > 0 && o.built >= 1);
  }

  private updateEnergy(dt: number) {
    const { buildings, eco } = this.c;
    const plants: { city: (typeof eco.city); power: number; coal?: boolean }[] = [];
    let total = 0, clean = 0;
    for (const city of eco.cities.values()) {
      let demand = 0, capacity = 0;
      for (const b of buildings.list) {
        if (b.city !== city.id || b.built < 1) continue;
        const d = BUILDINGS[b.kind];
        if (d.energy && this.gridIds.has(b.id)) demand += d.energy * (b.kind === 'house' ? b.level : 1);
        if (d.power && (b.access >= 0 || !d.needsRoad)) {
          if (CLEAN_POWER[b.kind]) {
            const sun = b.kind === 'hydro' ? 1 : b.kind === 'solarfarm' ? (eco.timeOfDay > 0.25 && eco.timeOfDay < 0.78 ? 1 : 0.1) : 0.7 + 0.3 * Math.sin(eco.day * 1.7 + eco.timeOfDay * 9);
            // wind and sun need nobody; a dam runs better with its staff
            const p = d.power * (d.jobs ? Math.max(0.6, Math.min(1, b.workers / d.jobs)) : 1) * sun;
            b.output = p;
            capacity += p;
            clean += p;
          } else {
            const p = d.power * Math.min(1, b.workers / d.jobs) * (b.kind === 'coalplant' ? (city.coal > 0.5 ? 1 : 0) : city.wood > 0.5 ? 1 : 0);
            b.output = p;
            capacity += p;
            if (p > 0) plants.push({ city, power: p, coal: b.kind === 'coalplant' });
          }
        }
      }
      city.energyDemand = demand + (this.lampDemand.find(([id]) => id === city.id)?.[1] ?? 0);
      city.energyCapacity = capacity;
      total += demand;
    }
    total += this.lampDemand.reduce((a, [, n]) => a + n, 0);
    let available = clean + eco.updateEnergy(dt, Math.max(0, total - clean), plants);
    // batteries: cover a shortfall from what they stored, and soak up what is left over
    this.batteryCap = buildings.list.filter((b) => b.kind === 'battery' && b.built >= 1).length * BATTERY.capacity;
    const step = dt / DAY_SECONDS;
    if (available < total && this.batteryCharge > 0 && step > 0) {
      const extra = Math.min(total - available, this.batteryCharge / step);
      available += extra;
      this.batteryCharge -= extra * step;
    }
    // essential buildings first; when the plants can't cover everything, the rest goes dark
    const consumers = buildings.list.filter((b) => BUILDINGS[b.kind].energy > 0 && b.built >= 1);
    consumers.sort((a, b) => (POWER_PRIORITY[a.kind] ?? 4) - (POWER_PRIORITY[b.kind] ?? 4));
    let left = available;
    const got = new Map<number, number>();
    for (const b of buildings.list) if (!BUILDINGS[b.kind].energy) b.powered = true;
    for (const b of consumers) {
      const e = BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1);
      // fields, mines and parks away from the roads run a small generator of their own
      // small rural workplaces off the road manage without the grid; the ranch, the greenhouse and the poultry farm need a cable
      b.powered = this.gridIds.has(b.id) && left >= e;
      if (b.powered) { left -= e; got.set(b.city, (got.get(b.city) ?? 0) + e); }
    }
    // street lamps (on a cable) take their share too, so they count as supplied
    this.lampsLit = left > 0;
    for (const [id, n] of this.lampDemand) if (left >= n) { left -= n; got.set(id, (got.get(id) ?? 0) + n); }
    if (left > 0 && this.batteryCap > 0) this.batteryCharge = Math.min(this.batteryCap, this.batteryCharge + left * step);
    this.batteryCharge = Math.min(this.batteryCharge, this.batteryCap);
    for (const city of eco.cities.values()) {
      const share = city.energyDemand > 0 ? Math.min(1, (got.get(city.id) ?? 0) / city.energyDemand) : 1;
      city.powered += (share - city.powered) * Math.min(1, dt * 2);
    }
  }

  /** A family building a home joins it to a water pipe running beside it (the pipe is laid on under the house). */
  private connectWater(kind: BuildingKind, x: number, z: number) {
    const pipes = this.c.pipes;
    if (!pipes) return;
    const s = BUILDINGS[kind].size;
    let near = false;
    for (let i = -1; i <= s && !near; i++) for (const [px, pz] of [[x + i, z - 1], [x + i, z + s], [x - 1, z + i], [x + s, z + i]]) {
      if (inBounds(px, pz) && pipes[pz * N + px]) { near = true; break; }
    }
    if (!near) return;
    for (let zz = z; zz < z + s; zz++) for (let xx = x; xx < x + s; xx++) pipes[zz * N + xx] = 1;
  }

  /**
   * Water flows from the towers through the pipes only (lay them from a tower to the homes; they may run under roads).
   * A home gets water when it touches a pipe network with a tower; every town shares only its own towers' water
   * among its own people, even where the pipes of two towns meet.
   */
  private updateWater() {
    const { buildings, eco, net, pop } = this.c;
    const pipes = this.c.pipes;
    const isMain = (k: number) => (pipes ? pipes[k] === 1 : net.type[k] !== 0);
    const comp = new Int32Array(N * N).fill(-1);
    let id = 0;
    for (let k = 0; k < comp.length; k++) {
      if (comp[k] >= 0 || !isMain(k)) continue;
      const stack = [k];
      comp[k] = id;
      while (stack.length) {
        const cur = stack.pop()!;
        const x = cur % N, z = (cur / N) | 0;
        for (const d of DIRS) {
          const nx = x + d.dx, nz = z + d.dz;
          if (!inBounds(nx, nz)) continue;
          const nk = nz * N + nx;
          if (comp[nk] < 0 && isMain(nk)) { comp[nk] = id; stack.push(nk); }
        }
      }
      id++;
    }
    // a building is on the network only where a pipe runs under it (under one of its own tiles)
    const compOf = (b: Building) => {
      const s = BUILDINGS[b.kind].size;
      for (let z = b.z; z < b.z + s; z++) for (let x = b.x; x < b.x + s; x++) {
        if (inBounds(x, z) && comp[z * N + x] >= 0) return comp[z * N + x];
      }
      return -1;
    };
    // keyed by network and town: a neighbour's tower does not water your homes
    const key = (c: number, city: number) => c * 64 + city;
    const cap = new Map<number, number>(), need = new Map<number, number>();
    for (const w of buildings.list) {
      if (w.kind !== 'watertower' || w.built < 1) continue;
      const c = compOf(w);
      if (c < 0) continue;
      const k = key(c, w.city);
      cap.set(k, (cap.get(k) ?? 0) + waterOf(w) * (w.workers > 0 ? 1 : 0.5) * (w.powered ? 1 : 0.3));
    }
    const living = new Map<number, number>();
    for (const f of pop.families.values()) living.set(f.home, (living.get(f.home) ?? 0) + f.members.length);
    const homeComp = new Map<number, number>();
    for (const h of buildings.list) {
      if (!BUILDINGS[h.kind].units) continue;
      const c = compOf(h);
      homeComp.set(h.id, c);
      if (c >= 0) need.set(key(c, h.city), (need.get(key(c, h.city)) ?? 0) + (living.get(h.id) ?? 0));
    }
    this.homeWater.clear();
    const totals = new Map<number, { people: number; served: number; homes: number; connected: number }>();
    for (const h of buildings.list) {
      if (!BUILDINGS[h.kind].units) continue;
      const c = homeComp.get(h.id) ?? -1;
      const share = c < 0 ? 0 : Math.min(1, (cap.get(key(c, h.city)) ?? 0) / Math.max(1, need.get(key(c, h.city)) ?? 0));
      this.homeWater.set(h.id, share);
      const n = living.get(h.id) ?? 0;
      const tt = totals.get(h.city) ?? { people: 0, served: 0, homes: 0, connected: 0 };
      tt.people += n; tt.served += n * share; tt.homes++; if (c >= 0) tt.connected++;
      totals.set(h.city, tt);
    }
    for (const city of eco.cities.values()) {
      const tt = totals.get(city.id);
      city.water = tt && tt.people ? tt.served / tt.people : 1;
      city.piped = tt && tt.homes ? tt.connected / tt.homes : 1;
    }
  }

  // ---------- day settlement ----------

  private newDay() {
    const { pop, eco, buildings, terrain, weather } = this.c;
    pop.day = eco.day;
    this.checkDepleted();
    this.metroDay();
    this.dayTrips((m) => this.events.push(m));
    this.mortgages();
    this.buySaws();
    for (const f of pop.families.values()) { f.earnY = f.earn ?? {}; f.earn = {}; }
    const cities = [...eco.cities.values()];
    const roadShare = this.roadUpkeep() / Math.max(1, cities.length);
    const homeCity = (f: Family) => buildings.get(f.home)?.city;

    cities.forEach((city, i) => {
      const say = (msg: string) => this.cityEvent(city.id, msg);
      // the first city also adopts families whose house is gone
      const belongs = (f: Family) => {
        const c = homeCity(f);
        return c === city.id || (i === 0 && (c === undefined || !eco.cities.has(c)));
      };
      const own = buildings.list.filter((b) => b.city === city.id && b.built >= 1);
      const hasHall = own.some((b) => b.kind === 'weddinghall');
      const heal = own.reduce((a, b) => a + BUILDINGS[b.kind].heal * levelMult(b) * (BUILDINGS[b.kind].jobs ? Math.min(1, b.workers / BUILDINGS[b.kind].jobs) : 1), 0) * ((city.budget?.health ?? 100) / 100);
      const meal = this.meals.get(city.id) ?? { eaten: 1, short: 0 };
      const fed = meal.eaten + meal.short > 0 ? meal.eaten / (meal.eaten + meal.short) : 1;
      const portions = Math.round((this.people.get(city.id) ?? 0) * fed + (fed >= 0.999 ? 1000 : 0));
      const r = pop.daily(buildings, belongs, portions, city.water, () => this.freeHomes(city.id), hasHall, {
        heal: Math.min(40, heal), carStock: this.carStock(city.id), bikeStock: this.bikeStock(city.id),
        shops: { market: false, grocery: false, clothes: false },
        taxRate: city.taxRate, calm: this.calm,
        safety: Math.min(0.95, this.policeCover(city.id) * 0.75 + (own.some((b) => b.kind === 'military' && b.workers > 0) ? MILITARY.safety : 0)),
        eduBoost: (own.some((b) => b.kind === 'academy' && b.workers > 0) ? 0.3 : 0) + (city.laws?.includes('meals') ? 0.2 : 0) + ((city.budget?.edu ?? 100) - 100) / 100,
        waterAt: (home) => this.homeWater.get(home) ?? city.water,
        foodPrice: city.priceFactor,
      });
      city.foodYesterday = { made: Math.round(city.foodMade), eaten: r.foodEaten };
      city.foodMade = 0;
      let rentToCity = 0;
      for (const [bid, amount] of r.rent) {
        const flat = buildings.get(bid);
        const owner = flat && flat.owner >= 0 ? pop.families.get(flat.owner) : undefined;
        if (owner) this.earn(owner, amount, 'Rent from flats'); else rentToCity += amount;
      }
      // a good credit rating makes the loan cheaper (×0.6 at 100, ×1.6 at 0)
      const interest = city.loan * LOAN.interest * (1.6 - (city.credit ?? 60) / 100);
      const upkeep = Math.round(roadShare + interest + buildings.list.reduce((a, b) => (b.city === city.id ? a + BUILDINGS[b.kind].upkeep : a), 0));
      // business tax: turnover of staffed shops, factories, banks… plus market and car dealer sales
      // each business pays 20% tax on its turnover; a family owner keeps a share as profit
      const working = (kind: string) => own.filter((b) => b.kind === kind && b.workers > 0);
      let business = 0;
      for (const b of own) {
        const d = BUILDINGS[b.kind];
        let turnover = 0;
        const wages = b.wagesToday ?? 0;
        b.wagesToday = 0;
        let tillProfit = 0, tillTax = 0, tillSales = 0;
        if (b.kind === 'market' || b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'gasstation' || b.kind === 'hotel' || b.kind === 'kiosk' || b.kind === 'bakery' || b.kind === 'supermarket' || b.kind === 'pharmacy' || b.kind === 'dairyshop' || VISIT_PRICE[b.kind]) {
          turnover = b.sales ?? 0;
          b.sales = 0;
          // sales already taxed at the till are not taxed twice
          const taxed = Math.min(turnover, b.salesTaxed ?? 0);
          b.salesTaxed = 0;
          const owner = b.owner >= 0 ? pop.families.get(b.owner) : undefined;
          tillSales = taxed;
          tillTax = taxed * city.taxRate * 0.8;
          if (owner && taxed) { tillProfit = taxed * (1 - city.taxRate * 0.8) * OWNER_SHARE; this.earn(owner, tillProfit, 'Business profit'); }
          turnover -= taxed;
        } else if (b.kind === 'carmarket') {
          turnover = b.workers > 0 ? r.carSales / Math.max(1, working('carmarket').length) : 0;
        } else if (d.revenue) {
          turnover = d.revenue * (d.jobs ? Math.min(1, b.workers / d.jobs) : 1) * (b.powered ? 1 : 0.5) * this.econFactor;
        }
        const items = b.sold;
        b.sold = undefined;
        const keep = (revenue: number) => {
          const tt = (b.total ??= { revenue: 0, items: {}, days: 0 });
          tt.revenue += revenue; tt.days++;
          for (const [k, n] of Object.entries(items ?? {})) tt.items[k] = (tt.items[k] ?? 0) + n;
        };
        // a public place without takings: the town pays the wages
        if (!turnover && !tillSales) { if (wages || b.owner >= 0) { b.books = { revenue: 0, wages: Math.round(wages), tax: 0, profit: 0, items }; keep(0); } continue; }
        turnover *= (1 + 0.25 * this.skilledShare(b)) * (city.smart ? 1.1 : 1);
        business += turnover * city.taxRate * 0.8;
        const owner = b.owner >= 0 ? pop.families.get(b.owner) : undefined;
        let profit = tillProfit;
        // the owner pays the business's electricity bill
        const power = owner && b.powered ? d.energy * UTILITY.electricity : 0;
        if (owner && power) { owner.money -= power; eco.add(city, 'money', power, 'Electricity bills (businesses)'); profit -= power; }
        // the owner sets the staff's pay: more when places stay empty, a little less when the business barely pays
        if (owner && d.jobs) {
          const f0 = b.wageF ?? (city.wages[b.kind] ?? 1);
          let nf = f0;
          if (b.workers < d.jobs) nf = Math.min(3, f0 + 0.05);
          else if (b.books && b.books.profit > b.books.wages * 0.5) nf = Math.min(3, f0 + 0.02); // a business doing well shares it
          else if (b.books && b.books.profit < b.books.wages * 0.05) nf = Math.max(0.7, f0 - 0.02); // one that barely pays trims it
          b.wageF = Math.round(nf * 100) / 100;
        }
        if (owner) {
          const p = turnover * (1 - city.taxRate * 0.8) * OWNER_SHARE;
          this.earn(owner, p, 'Business profit');
          profit += p;
        } else if (b.owner >= 0) b.owner = -1;
        // yesterday's accounts: the takings paid the staff, the tax and the owner's profit
        b.books = { revenue: Math.round(turnover + tillSales + wages), wages: Math.round(wages), tax: Math.round(turnover * city.taxRate * 0.8 + tillTax), profit: Math.round(profit), items };
        keep(b.books.revenue);
      }
      const net = Math.round(r.incomeTax + r.foodSales + r.propertyTax + rentToCity + r.utilities + business - r.publicWages - upkeep);
      city.money += net;
      // the evening settlement, item by item, in the books
      const book = (amount: number, reason: string) => eco.note(city, 'money', amount, reason);
      book(r.incomeTax, 'Income tax'); book(r.foodSales, 'Food sales'); book(r.propertyTax, 'Property tax'); book(rentToCity, 'Rent from city flats');
      book(r.utilities, 'Utility bills'); book(business, 'Business tax'); book(-r.publicWages, 'Public wages');
      book(-roadShare, 'Road upkeep'); book(-interest, 'Loan interest'); book(-(upkeep - roadShare - interest), 'Building upkeep');
      // what came in and went out on the spot during the day belongs in the day's balance too
      const lv = this.liveOf(city.id);
      this.live.delete(city.id);
      const liveNet = lv.incomeTax + lv.businessTax + lv.fares + lv.services - lv.publicWages;
      city.balance = {
        incomeTax: Math.round(r.incomeTax + lv.incomeTax), foodSales: r.foodSales, propertyTax: r.propertyTax + rentToCity,
        businessTax: Math.round(business + lv.businessTax), utilities: Math.round(r.utilities), publicWages: Math.round(r.publicWages + lv.publicWages),
        upkeep, net: Math.round(net + liveNet), fares: Math.round(lv.fares), services: Math.round(lv.services),
      };
      city.deaths = r.deaths.length;

      if (r.births) say(r.births === 1 ? t('A baby was born!') : t('{n} babies were born!', { n: r.births }));
      r.weddings.forEach(([a, b], i) => {
        say(t('{a} and {b} got married!', { a, b }));
        // the procession leaves the Wedding Hall in the morning
        this.leisure.later(4 + i * 8, () => this.leisure.wedding(city.id, a, b));
      });
      // burials in the city's cemetery
      for (const d of r.deaths) {
        const f = pop.families.get(d.familyId);
        const cemetery = buildings.list.find((b) => b.kind === 'cemetery' && b.city === city.id && b.built >= 1 && (b.graves?.length ?? 0) < MAX_GRAVES_PER_CEMETERY * b.level);
        if (cemetery && f && f.money >= GRAVE_COST) {
          f.money -= GRAVE_COST;
          eco.add(city, 'money', GRAVE_COST, 'Grave plots');
          buildings.addGrave(cemetery, { name: d.name, family: d.surname, age: d.age, day: eco.day });
          say(t('{name} was laid to rest at the cemetery (${cost})', { name: `${d.name} ${d.surname}`.trim(), cost: GRAVE_COST }));
        }
      }
      // ranch calf breeding
      for (const b of buildings.ofKind('ranch')) {
        if (b.city === city.id && b.workers > 0 && city.food > 50 && (b.cattleCount ?? 4) < 4 * (b.level || 1)) {
          b.cattleCount = (b.cattleCount ?? 0) + 1;
          b.cattleHunger = 0;
          say(t('A new calf was born in the ranch!'));
        }
      }
      this.sellCars(city.id, r.carsBought);
      // without a working gas station in town, empty cars are filled up out of town overnight (twice the price)
      if (!buildings.list.some((b) => b.kind === 'gasstation' && b.city === city.id && b.built >= 1 && b.workers > 0)) {
        for (const f of pop.families.values()) {
          if (!f.car || f.car.fuel >= 20 || homeCity(f) !== city.id) continue;
          f.money -= (100 - f.car.fuel) * FUEL.price * 2;
          f.car.fuel = 100;
        }
      }
      this.banking(city, say);
      this.adjustWages(city);
      this.chooseCrops(city.id);
      this.entrepreneurs(city.id, say);
      this.airQuality(city, say);
      this.tourism(city, own, say);
      this.heating(city, belongs, say);
      this.fillBins(city, own);
      this.prices(city, say);
      this.pensions(city, belongs);
      this.sewage(city, own, belongs);
      this.flu(city, own, belongs, say);
      this.switchJobs(city, own, say);
      this.leisure.daily(city, own, say);
      this.updateHappiness(city, own, r, belongs, say);
      this.smartCity(city, belongs, say);
      this.elect(city, belongs, say);
      this.upgradeHouses(city.id, say);
      for (const inc of r.incidents) if (inc.kind === 'accident') this.crash(city.id);
      // the injured of a crash are fetched by an ambulance
      for (const inc of r.incidents) {
        const v = inc.kind === 'accident' && inc.id !== undefined ? pop.citizens.get(inc.id) : undefined;
        const home = v && buildings.get(pop.families.get(v.family)?.home ?? -1);
        if (v && home) this.leisure.later(5 + Math.random() * 40, () => { if (this.alive(v)) this.leisure.ambulance(v, home); });
      }
      for (const inc of r.incidents) {
        if (inc.kind === 'fight') say(t('{a} and {b} got into a fight', { a: inc.a, b: inc.b ?? '' }));
        else if (inc.kind === 'accident') say(t('{a} was hurt in a car accident', { a: inc.a }) + (inc.wrecked ? ` — ${t('the car was wrecked')}` : ''));
        else say(t('{a} was murdered by {b}! The killer was arrested', { a: inc.a, b: inc.b ?? '' }));
      }
      for (const d of r.deaths.slice(0, 3)) say(t('{name} died ({cause})', { name: `${d.name} ${d.surname}`.trim(), cause: t(d.cause) }));
      if (r.deaths.length > 3) say(t('{n} people died today', { n: r.deaths.length }));
      if (r.leftTown) say(t('{n} people left town (debt)', { n: r.leftTown }));
      if (r.carsBought) say(t('{n} families bought a car', { n: r.carsBought }));
      if (r.bikesBought || r.bikesSold) this.bikeSales(city, r.bikesBought, r.bikesSold, say);
    });

    // midnight: everyone is home — except the night shift, still at work
    for (const c of pop.citizens.values()) if (c.state !== 'home' && !(c.night && c.state === 'away' && c.at === c.job)) this.teleportHome(c);
    for (const w of [...this.c.walkers.list]) if (!w.leaving) this.c.walkers.dismiss(w);
    for (const c of pop.citizens.values()) if (c.walker?.leaving) c.walker = undefined;
    this.busWaiters.clear();
    this.porters.clear();
    this.meals.clear();
    this.crews.clear();
    this.busyBuilders.clear();
    this.cleanupSpots();
    const forests = buildings.list.filter((b) => b.kind === 'forestry' && b.built >= 1 && b.workers > 0);
    terrain.regrow((k) => forests.some((f) => Math.abs(f.x - (k % N)) + Math.abs(f.z - ((k / N) | 0)) <= 14));
    this.rained.clear();
    const month = monthOf(eco.day);
    this.festival = month === 2 ? 'Navruz' : month === 0 ? 'New Year' : month === 8 ? 'Independence Day' : null;
    if (this.festival) this.events.push(t(this.festival === 'Navruz' ? 'Happy Navruz! Festivities in the parks and squares' : this.festival === 'Independence Day' ? 'Happy Independence Day! Concerts on the squares and fireworks tonight' : 'Happy New Year! Fireworks over the city tonight'));
    // a holiday brings visitors: every town with a park or a square gets tourists for the festival
    if (this.festival) for (const city of eco.cities.values()) if (buildings.list.some((b) => b.city === city.id && (b.kind === 'park' || b.kind === 'bigpark' || b.kind === 'townhall'))) city.tourists += 3;
    this.weatherEvents(seasonOf(month));
    const season = seasonOf(month);
    if (!this.calm && season === 'summer' && weather.drought <= 0 && Math.random() < 0.1) {
      weather.drought = 3;
      this.events.push(t('Drought! No rain for days and farms give less food'));
    }
    weather.newDay(season);
    this.pickWeather((m) => this.events.push(m));
    if (!this.calm && season === 'winter' && Math.random() < 0.18) {
      for (const c of pop.citizens.values()) c.health = Math.max(1, c.health - 8);
      this.events.push(t('A cold snap! People get sick more easily'));
    }
    pop.assign(buildings);
    this.rebuildGrid();
    pop.planDay();
    eco.closeBooks();
  }

  /**
   * Rich families do business: they buy a city-owned business, or build a new shop when the town lacks one.
   * The city gets the sale price; the family later earns a share of the turnover.
   */
  private entrepreneurs(cityId: number, say: (msg: string) => void) {
    const { pop, buildings, eco } = this.c;
    const city = eco.cities.get(cityId);
    if (!city) return;
    const families = [...pop.families.values()].filter((f) => buildings.get(f.home)?.city === cityId && this.purse(f, cityId) > 900)
      .sort((a, b) => b.money - a.money);
    if (!families.length) return;
    // a family with businesses invests again when it has saved enough for the next one
    const owned = new Map<number, number>();
    for (const b of buildings.list) if (b.owner >= 0) owned.set(b.owner, (owned.get(b.owner) ?? 0) + 1);
    const rich = families.filter((f) => !owned.has(f.id) || f.money > 3000 * ((owned.get(f.id) ?? 0) + 1));
    if (!rich.length) return;
    // nobody can build without a working construction company
    const canBuild = buildings.list.some((b) => b.kind === 'construction' && b.city === cityId && b.built >= 1 && b.workers > 0);

    // 0) a building the town hall put up for sale: the richest family that can pay buys it
    for (const b of buildings.list) {
      if (b.city !== cityId || !b.forSale || b.owner >= 0 || b.removed) continue;
      const buyer = families.find((f) => f.money > b.forSale! + 300);
      if (!buyer) continue;
      const price = b.forSale;
      buyer.money -= price;
      eco.add(city, 'money', price, 'Buildings sold to families');
      b.owner = buyer.id;
      b.forSale = undefined;
      say(t('The {family} family bought the {name} from the town hall for ${price}', { family: buyer.surname, name: t(BUILDINGS[b.kind].name), price }));
      return;
    }
    // 1) buy a finished business the city still owns
    if (Math.random() < 0.35) {
      const forSale = buildings.list.filter((b) => b.city === cityId && b.built >= 1 && b.owner < 0 && BUSINESS_KINDS.includes(b.kind));
      for (const b of forSale) {
        const price = Math.round(BUILDINGS[b.kind].money * 1.2);
        const buyer = rich.find((f) => f.money > price + 400);
        if (!buyer) continue;
        buyer.money -= price;
        eco.add(city, 'money', price, 'Businesses sold to families');
        b.owner = buyer.id;
        say(t('The {family} family bought the {name} for ${price}', { family: buyer.surname, name: t(BUILDINGS[b.kind].name), price }));
        return;
      }
    }

    // private construction is slow and only answers a real need: at most one project every few days
    if (!canBuild) return;
    if (eco.day - (this.privateBuild.get(cityId) ?? -99) < 2 || Math.random() > 0.5) return;
    // 2a) a businessman builds an apartment block to rent out when homes run short in a bigger town
    if (this.freeHomes(cityId).length < 2 && (this.people.get(cityId) ?? 0) >= 60) {
      const cost = BUILDINGS.apartment.money * 1.4;
      const investor = rich.find((f) => this.purse(f, cityId) > cost + 800);
      const home = investor && buildings.get(investor.home);
      if (investor && home && this.privateSite('apartment', home, (x, z) => {
        if (!this.buyMaterials(investor, cityId, 'apartment', say)) return false;
        investor.money -= cost;
        buildings.place('apartment', x, z, { city: cityId, owner: investor.id });
        this.connectWater('apartment', x, z);
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building an apartment block to rent out', { family: investor.surname }));
        return true;
      })) return;
    }
    // 2a') a young family renting a flat takes a mortgage at the bank and builds a house of its own
    const bank = buildings.list.some((b) => b.kind === 'bank' && b.city === cityId && b.built >= 1 && b.workers > 0);
    if (bank && Math.random() < 0.3) {
      const cost = Math.round((BUILDINGS.house.money + BUILDINGS.house.stone * TRADE_PRICE.stone + BUILDINGS.house.wood * TRADE_PRICE.wood) * 1.1);
      const renter = [...pop.families.values()].find((f) => {
        const h = buildings.get(f.home);
        return h && h.city === cityId && BUILDINGS[h.kind].units > 1 && !f.mortgage && !f.loan && f.money > cost * 0.1 && (f.income ?? 0) > 8;
      });
      const home = renter && buildings.get(renter.home);
      if (renter && home && this.privateSite('house', home, (x, z) => {
        const owe = Math.round(cost * 1.25);
        renter.money -= Math.round(cost * 0.1);
        const b = buildings.place('house', x, z, { city: cityId, owner: renter.id });
        this.connectWater('house', x, z);
        renter.mortgage = { left: owe, perDay: Math.max(5, Math.round(owe / 60)), house: b.id };
        renter.home = b.id;
        for (const c of pop.members(renter)) { c.at = c.state === 'home' ? b.id : c.at; if (c.age >= 18) pop.note(c, 'The family took a mortgage of ${n} and is building its own house', { n: owe }); }
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family took a mortgage of ${n} at the bank and is building its own house', { family: renter.surname, n: owe }));
        return true;
      })) return;
    }
    // 2b) parents build a house for a grown-up child when the city has no free homes
    if (!this.freeHomes(cityId).length) {
      const parents = rich.find((f) => f.money > 700 && pop.members(f).some((m) => m.role === 'child' && m.age >= 20));
      const home = parents && buildings.get(parents.home);
      if (parents && home && this.privateSite('house', home, (x, z) => {
        if (!this.buyMaterials(parents, cityId, 'house', say)) return false;
        parents.money -= BUILDINGS.house.money;
        buildings.place('house', x, z, { city: cityId });
        this.connectWater('house', x, z);
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building a house for their grown-up child', { family: parents.surname }));
        return true;
      })) return;
    }
    // 2b) a filling station once the town has enough cars
    const cityCars = [...pop.families.values()].filter((f) => f.car && buildings.get(f.home)?.city === cityId).length;
    if (cityCars >= 20 && !buildings.list.some((b) => b.kind === 'gasstation' && b.city === cityId)) {
      const investor = rich.find((f) => f.money > BUILDINGS.gasstation.money * 1.5 + 400);
      const home = investor && buildings.get(investor.home);
      if (investor && home && this.privateSite('gasstation', home, (x, z) => {
        if (!this.buyMaterials(investor, cityId, 'gasstation', say)) return false;
        investor.money -= BUILDINGS.gasstation.money * 1.5;
        buildings.place('gasstation', x, z, { city: cityId, owner: investor.id });
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building a {name}', { family: investor.surname, name: t(BUILDINGS.gasstation.name) }));
        return true;
      })) return;
    }
    // 2c) a rich family opens a casino in a bigger town (a big tax payer)
    if ((this.people.get(cityId) ?? 0) >= 80 && !buildings.list.some((b) => b.kind === 'casino' && b.city === cityId)) {
      const investor = rich.find((f) => this.purse(f, cityId) > BUILDINGS.casino.money * 1.2 + 800);
      const home = investor && buildings.get(investor.home);
      if (investor && home && this.privateSite('casino', home, (x, z) => {
        if (!this.buyMaterials(investor, cityId, 'casino', say)) return false;
        investor.money -= BUILDINGS.casino.money * 1.2;
        buildings.place('casino', x, z, { city: cityId, owner: investor.id });
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building a {name}', { family: investor.surname, name: t(BUILDINGS.casino.name) }));
        return true;
      })) return;
    }
    // 2c) a new grocery / clothing store when there are too few for the people
    const people = this.populationByCity().get(cityId) ?? 0;
    const count = (kind: string) => buildings.list.filter((b) => b.city === cityId && b.kind === kind).length;
    // what the town lacks and would pay for: the family builds it, pays the staff out of the takings and keeps the profit
    const has = (k: string) => count(k) > 0;
    const town = eco.cities.get(cityId)!;
    const wants: [BuildingKind, boolean][] = [
      ['grocery', count('grocery') < Math.floor(people / 50) + 1],
      ['clothes', count('clothes') < Math.floor(people / 80) + 1],
      ['kiosk', count('kiosk') < Math.floor(people / 60)],
      ['dairyshop', (has('ranch') || town.milk > 30) && count('dairyshop') < Math.floor(people / 140) + 1],
      ['bakery', (has('mill') || town.flour > 20) && count('bakery') < Math.floor(people / 120) + 1],
      ['teahouse', people >= 60 && count('teahouse') < Math.floor(people / 120) + 1],
      ['barber', people >= 50 && count('barber') < Math.floor(people / 100) + 1],
      ['pharmacy', people >= 80 && !has('pharmacy')],
      ['gym', people >= 100 && !has('gym')],
      ['supermarket', people >= 150 && !has('supermarket')],
      ['hotel', (town.tourists > 0 || people >= 150) && !has('hotel')],
      ['factory', people >= 120 && (town.cotton > 20 || town.planks > 30) && !has('factory')],
      ['office', people >= 160 && count('office') < Math.floor(people / 160)],
    ];
    const kind = wants.find(([, ok]) => ok)?.[0];
    if (!kind) return;
    const cost = BUILDINGS[kind].money * 1.5;
    const builder = rich.find((f) => this.purse(f, cityId) > cost + 400);
    const home = builder && buildings.get(builder.home);
    if (!builder || !home) return;
    const zs = this.zonedSpot(kind, home);
    for (let r = zs ? 0 : 1; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = zs && r === 0 ? zs.x : home.x + dx, z = zs && r === 0 ? zs.z : home.z + dz;
        if (!buildings.check(kind, x, z).ok || !this.zoneOk(kind, x, z, false)) continue;
        if (!this.buyMaterials(builder, cityId, kind, say)) return;
        builder.money -= cost;
        this.privateBuild.set(cityId, eco.day);
        const b = buildings.place(kind, x, z, { city: cityId, owner: builder.id });
        this.c.terrain.clearTiles(buildings.footprint(kind, x, z).map((tl) => tl.z * N + tl.x));
        this.rebuildGrid();
        say(t('The {family} family is building a {name}', { family: builder.surname, name: t(BUILDINGS[b.kind].name) }));
        return;
      }
    }
  }

  /**
   * A family that wants to build buys the stone, wood and iron from the town hall (at the trade price).
   * When the town has none to sell, nothing is built and the family says why.
   */
  private buyMaterials(f: Family, cityId: number, kind: BuildingKind, say: (msg: string) => void) {
    const { eco } = this.c;
    const city = eco.cities.get(cityId);
    if (!city) return false;
    const d = BUILDINGS[kind];
    const need = { stone: d.stone, wood: d.wood, iron: d.iron };
    const short = (['stone', 'wood', 'iron'] as const).filter((r) => need[r] > 0 && city[r] < need[r] + 5);
    if (short.length) {
      if (Math.random() < 0.4) say(t('The {family} family wants to build a {name}, but the town hall has no {res} to sell', { family: f.surname, name: t(d.name), res: short.map((r) => t(r === 'stone' ? 'Stone' : r === 'wood' ? 'Wood' : 'Iron').toLowerCase()).join(', ') }));
      return false;
    }
    const price = Math.round(need.stone * TRADE_PRICE.stone + need.wood * TRADE_PRICE.wood + need.iron * TRADE_PRICE.iron);
    // short of money: the bank lends the rest (if the town has a bank and the family has no loan yet)
    const total = price + d.money * (kind === 'house' ? 1 : 1.5);
    if (f.money < total + 100) {
      if (this.purse(f, cityId) < total + 100) return false;
      const lent = Math.ceil(total + 200 - f.money);
      // the bank lends the town's money (it comes back with interest)
      if (city.money < lent + 500) return false;
      eco.add(city, 'money', -lent, 'Bank loans to families');
      f.loan = lent;
      f.money += lent;
      for (const m of this.c.pop.members(f)) if (m.age >= 18) this.c.pop.note(m, 'Took a bank loan of ${n} to build', { n: lent });
      say(t('The {family} family took a bank loan of ${n} to build a {name}', { family: f.surname, n: lent, name: t(d.name) }));
    }
    for (const r of ['stone', 'wood', 'iron'] as const) if (need[r]) eco.add(city, r, -need[r], 'Sold to families for building');
    eco.add(city, 'money', price, 'Building materials sold to families');
    f.money -= price;
    return true;
  }

  /**
   * Farmers pick the crop the town needs most (unless the player chose one): vegetables when there is no mill,
   * corn when the cattle have no feed, cotton for the clothing stores, melons in summer, wheat otherwise.
   * A field only switches while it is still young.
   */
  chooseCrops(cityId?: number) {
    const { buildings, eco } = this.c;
    const month = monthOf(eco.day);
    for (const city of eco.cities.values()) {
      if (cityId !== undefined && city.id !== cityId) continue;
      const own = buildings.list.filter((b) => b.city === city.id && b.built >= 1);
      if (!city.ai) continue; // your fields grow what you sow
      const farms = own.filter((b) => b.kind === 'farm' && !b.cropManual);
      if (!farms.length) continue;
      const has = (k: string) => own.some((b) => b.kind === k && b.workers > 0);
      // a mix of crops, as much as the town's own chains need and less of what is already in plenty
      const want: Record<CropKind, number> = {
        wheat: (has('mill') ? 4.5 : 3) * (city.grain > 80 ? 0.4 : 1),
        vegetables: 2.5 * (city.food / Math.max(1, this.mouths.get(city.id) ?? 1) > 12 ? 0.5 : 1),
        corn: (has('ranch') || has('dairy') ? 2.5 : 1.2) * (city.feed > 60 ? 0.4 : 1),
        cotton: (has('clothes') || has('factory') ? 2.5 : 1.2) * (city.cotton > 50 ? 0.4 : 1),
        melons: month >= 4 && month <= 7 ? 1.5 : 0,
      };
      const sum = Object.values(want).reduce((x, y) => x + y, 0);
      const total = own.filter((b) => b.kind === 'farm').length;
      const count = new Map<CropKind, number>();
      for (const f of own) if (f.kind === 'farm') count.set(f.cropKind ?? 'wheat', (count.get(f.cropKind ?? 'wheat') ?? 0) + 1);
      // the crop furthest below its share of the fields
      const lacking = () => (Object.keys(want) as CropKind[]).reduce((best, k) => (want[k] / sum) * total - (count.get(k) ?? 0) > (want[best] / sum) * total - (count.get(best) ?? 0) ? k : best, 'wheat' as CropKind);
      // only young fields switch, the ones with too much of their crop first
      for (const f of [...farms].sort((x, y) => x.id - y.id)) {
        if (f.cropT >= 0.35) continue;
        const cur = f.cropKind ?? 'wheat';
        let next: CropKind;
        if (total <= 3) {
          // a town with few fields changes crops month by month, more often to what it needs most
          let h = Math.imul(f.id ^ Math.imul(Math.floor(eco.day / 30) + 1, 0x9e3779b1), 0x85ebca6b);
          h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
          let r = (((h ^ (h >>> 16)) >>> 0) / 4294967296) * sum;
          next = (Object.keys(want) as CropKind[]).find((k) => (r -= want[k]) < 0) ?? 'wheat';
        } else {
          const over = (count.get(cur) ?? 0) - (want[cur] / sum) * total;
          next = lacking();
          if (over < 0.75) continue;
        }
        if (next === cur) continue;
        count.set(cur, (count.get(cur) ?? 1) - 1);
        count.set(next, (count.get(next) ?? 0) + 1);
        f.cropKind = next;
        this.c.buildings.updateCrop(f);
      }
    }
  }

  /**
   * Automatic wages: where workers are missing the town hall pays a little more (up to +60%), where everyone is
   * employed and people are looking for work it pays a little less (down to −20%).
   */
  private adjustWages(city: City) {
    const { buildings, pop } = this.c;
    for (const c of pop.citizens.values()) if (c.job >= 0 && buildings.get(c.job)?.kind === 'mosque') c.faith = true;
    if (!city.wageAuto) return;
    const byKind = new Map<string, { jobs: number; workers: number }>();
    for (const b of buildings.list) {
      if (b.city !== city.id || b.built < 1 || !BUILDINGS[b.kind].jobs) continue;
      const e = byKind.get(b.kind) ?? { jobs: 0, workers: 0 };
      e.jobs += BUILDINGS[b.kind].jobs;
      e.workers += b.workers;
      byKind.set(b.kind, e);
    }
    let workforce = 0, jobless = 0;
    for (const c of pop.citizens.values()) {
      if (!pop.canWork(c) || buildings.get(pop.families.get(c.family)?.home ?? -1)?.city !== city.id) continue;
      workforce++;
      if (c.job < 0) jobless++;
    }
    const joblessShare = workforce ? jobless / workforce : 0;
    // the pay the market asks for: up where hands are short, food is dear, people are unhappy or the town is rich;
    // down where many look for work or the town hall is out of money. Pay moves towards it a little every day.
    for (const [kind, e] of byKind) {
      const w = city.wages[kind] ?? 1;
      const vacancy = e.jobs ? (e.jobs - e.workers) / e.jobs : 0;
      let target = 1 + vacancy * 0.9;
      if (joblessShare > 0.04) target -= Math.min(0.35, joblessShare * 2);
      target *= 0.75 + 0.25 * Math.max(0.8, Math.min(2.2, city.priceFactor));
      if (city.happiness < 45) target += 0.1;
      if (city.money > 15000) target += 0.12;
      else if (city.money < 600 && BUILDINGS[kind as BuildingKind]?.publicJob) target -= 0.2;
      target = Math.max(0.7, Math.min(3, target));
      const next = Math.round((w + (target - w) * 0.15) * 100) / 100;
      if (Math.abs(next - 1) < 0.01) delete city.wages[kind];
      else city.wages[kind] = next;
    }
  }

  /** Money a family can spend on building: savings plus what the bank would lend. */
  private purse(f: Family, cityId: number) {
    const bank = !f.loan && this.c.buildings.list.some((b) => b.kind === 'bank' && b.city === cityId && b.built >= 1 && b.workers > 0);
    return f.money + (bank ? Math.min(BANKING.maxFamilyLoan, Math.max(0, f.money)) : 0);
  }

  /**
   * The bank: families keep their savings there and earn a little interest; borrowers pay back their loans with
   * interest every day. The bank's profit is taxed like any business.
   */
  private banking(city: City, say: (msg: string) => void) {
    const { pop, buildings } = this.c;
    const banks = buildings.list.filter((b) => b.kind === 'bank' && b.city === city.id && b.built >= 1 && b.workers > 0);
    const st: { deposits: number; loans: number; paid: number; earned: number; borrowers: number; savers: number; lent?: number } = { deposits: 0, loans: 0, paid: 0, earned: 0, borrowers: 0, savers: 0 };
    for (const f of pop.families.values()) {
      if (buildings.get(f.home)?.city !== city.id) continue;
      if (f.loan && f.loan > 0) {
        const interest = f.loan * BANKING.loanRate;
        const pay = Math.min(f.loan, Math.max(10, f.loan * 0.06));
        f.money -= interest + pay;
        f.loan -= pay;
        // the money was the town's: it comes back with the interest
        this.c.eco.add(city, 'money', interest + pay, 'Loan repayments from families');
        st.earned += interest;
        st.borrowers++;
        if (f.loan <= 0.5) {
          f.loan = undefined;
          for (const m of pop.members(f)) if (m.age >= 18) pop.note(m, 'Paid off the bank loan');
        } else st.loans += f.loan;
      }
      // a working family short of money may take a small credit (a car, furniture, a better start) — from the town's money
      if (banks.length && !f.loan && f.money < 400 && city.money > 3000 && Math.random() < 0.03 && pop.members(f).some((m) => m.job >= 0 && m.age >= 18)) {
        const lent = 500 + Math.round(Math.random() * 10) * 100;
        f.loan = lent;
        f.money += lent;
        this.c.eco.add(city, 'money', -lent, 'Bank loans to families');
        st.lent = (st.lent ?? 0) + lent;
        for (const m of pop.members(f)) if (m.age >= 18) pop.note(m, 'Took a bank credit of ${n}', { n: lent });
      }
      if (banks.length && f.money > 300) {
        const dep = (f.money - 300) * BANKING.saveShare;
        const i = dep * BANKING.deposit;
        this.earn(f, i, 'Bank interest');
        st.paid += i;
        st.deposits += dep;
        st.savers++;
      }
    }
    this.bankStats.set(city.id, st);
    if (!banks.length) return;
    // the bank also invests the deposits; what is left after the interest it pays is profit, taxed now
    // the interest on loans already went to the town; the bank earns on the deposits it invests
    const profit = st.deposits * 0.002 - st.paid;
    if (profit > 0) {
      this.cash(city.id, profit * city.taxRate * 0.8, 'businessTax');
      for (const b of banks) {
        const owner = b.owner >= 0 ? pop.families.get(b.owner) : undefined;
        if (owner) owner.money += (profit / banks.length) * (1 - city.taxRate * 0.8) * OWNER_SHARE;
      }
    }
    if (st.borrowers && Math.random() < 0.15) say(t('{n} families are paying back bank loans', { n: st.borrowers }));
  }

  /** Find a buildable spot near a family's home and build there. */
  /** Zoning painted by the player (set by the game): 0 none, 1 homes, 2 shops and offices, 3 factories. */
  zoneAt?: (x: number, z: number) => number;

  /** Which zone a private building belongs in (0 = anywhere). */
  private zoneFor(kind: BuildingKind) {
    if (BUILDINGS[kind].units) return 1;
    if (kind === 'factory' || kind === 'bikefactory' || kind === 'carfactory') return 3;
    if (SHOP_PRICE[kind] || VISIT_PRICE[kind] || BUSINESS_KINDS.includes(kind) || kind === 'hotel' || kind === 'gasstation') return 2;
    return 0;
  }

  /** Does a private building fit the zoning here (its own zone or unzoned land; never another zone)? */
  private zoneOk(kind: BuildingKind, x: number, z: number, strict: boolean) {
    if (!this.zoneAt) return !strict;
    const want = this.zoneFor(kind);
    for (const tl of this.c.buildings.footprint(kind, x, z)) {
      const zz = this.zoneAt(tl.x, tl.z);
      if (strict ? zz !== want : zz !== 0 && zz !== want) return false;
    }
    return true;
  }

  /** The nearest free spot in the building's own zone around a place (zoned land is used first). */
  private zonedSpot(kind: BuildingKind, near: Building) {
    const { buildings } = this.c;
    if (!this.zoneAt || !this.zoneFor(kind)) return null;
    for (let r = 1; r <= 16; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = near.x + dx, z = near.z + dz;
        if (!this.zoneOk(kind, x, z, true) || !buildings.check(kind, x, z).ok) continue;
        if (this.streetRoom && !this.streetRoom(near.city, kind, x, z)) continue;
        return { x, z };
      }
    }
    return null;
  }

  private privateSite(kind: 'house' | 'gasstation' | 'apartment' | 'casino', home: Building, build: (x: number, z: number) => boolean) {
    const { buildings, terrain } = this.c;
    // zoned land first
    const zs = this.zonedSpot(kind, home);
    if (zs) {
      if (!build(zs.x, zs.z)) return false;
      terrain.clearTiles(buildings.footprint(kind, zs.x, zs.z).map((tl) => tl.z * N + tl.x));
      this.rebuildGrid();
      return true;
    }
    for (let r = 1; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = home.x + dx, z = home.z + dz;
        if (!buildings.check(kind, x, z).ok || !this.zoneOk(kind, x, z, false)) continue;
        if (this.streetRoom && !this.streetRoom(home.city, kind, x, z)) continue;
        if (!build(x, z)) return false;
        terrain.clearTiles(buildings.footprint(kind, x, z).map((tl) => tl.z * N + tl.x));
        this.rebuildGrid();
        return true;
      }
    }
    return false;
  }

  private cleanupSpots() {
    const { pop } = this.c;
    for (const [key, fid] of this.spots) {
      const f = pop.families.get(fid);
      if (!f || !f.car || f.car.at !== 'away') this.spots.delete(key);
    }
    for (const f of pop.families.values()) {
      if (f.car && f.car.at === 'away' && !this.spots.has(`${f.car.lot}:${f.car.slot}`)) { f.car.at = 'home'; f.car.lot = undefined; }
    }
  }

  /**
   * New families move in when the town has free homes and is a good place to live. The more jobs stand empty,
   * the faster they come. Every city remembers what keeps newcomers away (shown in the Jobs and Population panels).
   */
  /** Free homes of a town (for the jobs page). */
  freeHomesCount(cityId: number) { return this.freeHomes(cityId).length; }

  private immigrate() {
    const { pop, eco, buildings } = this.c;
    const people = this.populationByCity();
    for (const city of eco.cities.values()) {
      const homes = this.freeHomes(city.id);
      let jobs = 0, staffed = 0;
      for (const b of buildings.list) if (b.city === city.id && b.built >= 1) { jobs += BUILDINGS[b.kind].jobs; staffed += b.workers; }
      const n = people.get(city.id) ?? 0;
      const vacancies = jobs - staffed;
      const unemployed = [...pop.citizens.values()].filter((c) => c.job < 0 && pop.canWork(c) && buildings.get(pop.families.get(c.family)?.home ?? -1)?.city === city.id).length;
      const reasons: string[] = [];
      if (!homes.length) reasons.push('No free homes — build houses or an apartment block');
      if (!buildings.list.some((b) => b.kind === 'watertower' && b.city === city.id)) reasons.push('No water tower');
      else if (city.water < 0.8) reasons.push('Not enough water — build another water tower (one serves 160 people)');
      const office = buildings.list.some((b) => b.kind === 'migration' && b.city === city.id && b.built >= 1 && b.workers > 0);
      if (city.happiness < (office ? 40 : 45)) reasons.push(office ? 'People are unhappy (below 40%)' : 'People are unhappy (below 45%)');
      if (city.food < n * 2) reasons.push('Too little food in stock (needs 2 days of food)');
      if (n > 0 && !this.foodShops.has(city.id)) reasons.push('No open food shop — families cannot buy food');
      if (city.powered < 0.6) reasons.push('Power shortage');
      if (vacancies < 2) reasons.push('No open jobs');
      city.migration = { vacancies, freeHomes: homes.length, unemployed, reasons };
      if (reasons.length) {
        // tell the player now and then why buildings stand empty
        if (vacancies >= 6 && unemployed === 0 && Math.random() < 0.08) this.cityEvent(city.id, t('Not enough workers: {n} jobs are empty. {why}', { n: vacancies, why: t(reasons[0]) }));
        continue;
      }
      const pay = Object.values(city.wages).reduce((a, v) => a + v, 0) / Math.max(1, Object.keys(city.wages).length);
      // the more jobs wait for people, the more come — job seekers first: young singles and couples
      const lacking = Math.max(0, vacancies - unemployed);
      const arrivals = Math.min(homes.length, office ? 7 : 5, 1 + Math.floor(lacking / 6) + (pay > 1.1 ? 1 : 0) + (office ? 1 : 0));
      // jobless families of the neighbour towns move here for the work
      if (lacking >= 4 && eco.cities.size > 1 && Math.random() < 0.5) {
        const owners = new Set(buildings.list.map((b) => b.owner));
        const fam = [...pop.families.values()].find((x) => { const h = buildings.get(x.home); return !!h && h.city !== city.id && !!eco.cities.get(h.city)?.ai && !eco.cities.get(h.city)?.remote && !owners.has(x.id) && pop.members(x).some((m) => pop.canWork(m) && m.job < 0); });
        if (fam && this.relocate(fam, buildings.get(fam.home)!.city, false)) { this.cityEvent(city.id, t('The {family} family came from a neighbour town for the open jobs', { family: fam.surname })); continue; }
      }
      if (eco.cities.size > 1 && Math.random() < 0.4) {
        const worse = [...eco.cities.values()].filter((c) => c.id !== city.id && c.happiness + 5 < city.happiness);
        const src = worse[Math.floor(Math.random() * worse.length)];
        const owners = new Set(buildings.list.map((b) => b.owner));
        const fam = src && [...pop.families.values()].find((x) => buildings.get(x.home)?.city === src.id && !owners.has(x.id));
        if (fam && this.relocate(fam, src.id, false)) continue;
      }
      for (let i = 0; i < arrivals; i++) {
        const free = this.freeHomes(city.id);
        if (!free.length) break;
        // with many empty jobs most newcomers are job seekers (one or two young adults), else whole families
        const seekers = lacking >= 4 && Math.random() < 0.7;
        const f = pop.createFamily(pick(free).id, { carChance: 0, size: seekers ? (Math.random() < 0.5 ? 1 : 2) : undefined, young: seekers });
        pop.assign(buildings);
        // only the newcomers plan their day (re-planning everyone would send people back to work in the evening)
        pop.planDay(pop.members(f));
        this.register(city.id, f, t('far away'));
        this.cityEvent(city.id, seekers ? t('Job seekers moved in: {n} new workers', { n: pop.members(f).filter((m) => pop.canWork(m)).length }) : t('A new family moved in'));
      }
    }
  }

  /** Everyone eats a little all the time; shortages are remembered for the evening settlement. */
  /**
   * Families eat from the food they keep at home. When it runs low, they buy more in the town's food shops
   * (the food leaves the town's stores); with no open food shop there is nothing to buy and people go hungry.
   */
  private eat(dt: number) {
    const { pop, eco } = this.c;
    const bought = new Map<number, number>();
    for (const [id, fn] of this.famNeed) {
      const f = pop.families.get(id);
      const city = eco.cities.get(fn.city);
      if (!f || !city || fn.need <= 0) continue;
      if (f.pantry === undefined) f.pantry = fn.need * 2;
      // shopping: keep about three days of food at home
      if (f.pantry < fn.need * 1.5 && this.foodShops.has(city.id) && city.food > 0) {
        const n = Math.min(city.food, fn.need * 3 - f.pantry);
        city.food -= n;
        f.pantry += n;
        bought.set(city.id, (bought.get(city.id) ?? 0) + n);
      }
      const need = (fn.need * dt) / DAY_SECONDS;
      const eaten = Math.min(Math.max(0, f.pantry), need);
      f.pantry -= eaten;
      const m = this.meals.get(city.id) ?? { eaten: 0, short: 0 };
      m.eaten += eaten;
      m.short += need - eaten;
      this.meals.set(city.id, m);
    }
    for (const [cid, n] of bought) { const city = eco.cities.get(cid); if (city) eco.note(city, 'food', -n, 'Bought by families in the shops'); }
  }

  /**
   * A family moves to another town on the map where life is better (happier, with a free home) — or, after losing
   * its home, to any town with a free home. Both towns hear about it. Returns false when there is nowhere to go.
   */
  /** A family moves into this home (another town too): jobs and schools are found again there. */
  moveInto(f: Family, home: Building, note = 'The family moved to {city}') {
    const { eco, buildings, pop } = this.c;
    const to = eco.cities.get(home.city);
    for (const m of pop.members(f)) {
      if (m.walker) { this.c.walkers.dismiss(m.walker); m.walker = undefined; }
      m.job = -1;
      m.school = -1;
      m.state = 'home';
      m.at = home.id;
      m.activity = 'At home';
      m.outing = undefined;
      pop.note(m, note, { city: to?.name ?? '' });
    }
    if (f.car) f.car.at = 'home';
    f.home = home.id;
    pop.assign(buildings);
    pop.planDay(pop.members(f));
  }

  relocate(f: Family, fromCity: number, homeless: boolean): boolean {
    const { eco, buildings, pop } = this.c;
    const from = eco.cities.get(fromCity);
    if (!from || eco.cities.size < 2) return false;
    const options = [...eco.cities.values()].filter((c) => c.id !== fromCity && (homeless || c.happiness > from.happiness + 5)).sort((a, b) => b.happiness - a.happiness);
    for (const to of options) {
      const home = this.freeHomes(to.id)[0];
      if (!home) continue;
      for (const m of pop.members(f)) {
        if (m.walker) { this.c.walkers.dismiss(m.walker); m.walker = undefined; }
        m.job = -1;
        m.school = -1;
        m.state = 'home';
        m.at = home.id;
        m.activity = 'At home';
        m.outing = undefined;
        pop.note(m, 'The family moved to {city}', { city: to.name });
      }
      if (f.car) f.car.at = 'home';
      f.home = home.id;
      pop.assign(buildings);
      pop.planDay(pop.members(f));
      const why = homeless ? t('after losing their home') : t('for a better life');
      this.cityEvent(fromCity, t('The {family} family moved to {city} {why}', { family: f.surname, city: to.name, why }));
      this.cityEvent(to.id, t('The {family} family moved here from {city} {why}', { family: f.surname, city: from.name, why }));
      this.register(to.id, f, from.name);
      return true;
    }
    return false;
  }

  /** A family that moved in is registered at the town's migration company (if it has a working one). */
  private register(cityId: number, f: Family, from: string) {
    const { buildings, eco, pop } = this.c;
    const city = eco.cities.get(cityId);
    if (!city || !buildings.list.some((b) => b.kind === 'migration' && b.city === cityId && b.built >= 1 && b.workers > 0)) return;
    const list = (city.arrivals ??= []);
    list.unshift({ day: eco.day, family: f.id, surname: f.surname, from });
    if (list.length > 40) list.length = 40;
    for (const m of pop.members(f)) if (m.age >= 18) pop.note(m, 'Registered at the migration company in {city}', { city: city.name });
  }

  /** Digging eats slowly into the nearest mountain: one level of rock goes per DIG_PER_LEVEL of stone, coal or iron. */
  private dig(b: Building, amount: number) {
    if (amount <= 0) return;
    b.dug = (b.dug ?? 0) + amount;
    const per = DIG_PER_LEVEL[b.kind] ?? 150;
    if (b.dug < per) return;
    b.dug -= per;
    const { map } = this.c;
    const s = BUILDINGS[b.kind].size;
    const face = this.mineFaces.get(b.id);
    let best = face && map.height[face.rock] > 0 ? face.rock : -1, bd = best >= 0 ? -1 : Infinity;
    for (let z = b.z - 3; z < b.z + s + 3; z++) for (let x = b.x - 3; x < b.x + s + 3; x++) {
      if (x < 0 || z < 0 || x >= N || z >= N) continue;
      const k = z * N + x;
      if (map.height[k] <= 0 || this.c.net.type[k]) continue;
      // the closest rock first, the lower edge before the peak
      const d = Math.max(Math.abs(x - (b.x + s / 2)), Math.abs(z - (b.z + s / 2))) + map.height[k] * 0.2;
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) return;
    map.height[best] -= 1;
    this.c.terrain.queueReshape(best);
    this.c.effects.puff(tileToWorld(best % N), tileToWorld((best / N) | 0), 0.35, 12, ['#bdb7aa', '#d8d2c4', '#8d8a83']);
    if (map.mountainsNear(b.x, b.z, 3) === 0 && !this.reachNoted.has(b.id)) { this.reachNoted.add(b.id); this.cityEvent(b.city, t('The rock next to the {name} is gone: its workers now dig further away and carry the stone back to the yard', { name: t(BUILDINGS[b.kind].name) })); }
  }

  /** Is there a staffed food shop in the town (families can buy food)? */
  hasFoodShop(cityId: number) { return this.foodShops.has(cityId); }

  // ---------- production ----------

  private countPresent() {
    const { buildings, pop } = this.c;
    for (const b of buildings.list) b.present = 0;
    for (const c of pop.citizens.values()) {
      if (c.state !== 'away' || c.job < 0 || c.at !== c.job) continue;
      const b = buildings.get(c.job);
      if (b) b.present++;
    }
  }

  private checkRain() {
    const { buildings, weather, canals } = this.c;
    for (const b of buildings.list) {
      if (b.kind === 'farm') {
        if (weather.isWet(b.mesh.position.x, b.mesh.position.z)) this.rained.add(b.id);
        b.irrigated = this.rained.has(b.id) || canals.watered(b.x, b.z, BUILDINGS.farm.size);
      }
    }
  }

  /** Output runs during working hours, scaled by staffing, season, water and power. */
  private produce(dt: number) {
    const { buildings, eco, traffic } = this.c;
    const tod = eco.timeOfDay;
    if (tod < WORK_FROM || tod > WORK_TO) return;
    const share = dt / (DAY_SECONDS * (WORK_TO - WORK_FROM));
    const month = monthOf(eco.day);
    for (const b of buildings.list) {
      const d = BUILDINGS[b.kind];
      const city = eco.cities.get(b.city);
      if (!city || b.built < 1) continue;
      if (b.kind === 'ranch') {
        const cattle = b.cattleCount ?? 4;
        if (cattle > 0) {
          const feedNeeded = cattle * share * 0.5;
          if (city.feed >= feedNeeded) {
            this.c.eco.add(city, 'feed', -feedNeeded, 'Cattle feed (corn)');
            b.cattleHunger = Math.max(0, (b.cattleHunger ?? 0) - dt * 2);
            b.cornFed = true;
          } else if (city.food >= feedNeeded && city.food > 5) {
            b.cornFed = false;
            city.food -= feedNeeded;
            this.c.eco.note(city, 'food', -feedNeeded, 'Cattle feed');
            b.cattleHunger = Math.max(0, (b.cattleHunger ?? 0) - dt * 2);
          } else {
            b.cattleHunger = (b.cattleHunger ?? 0) + (dt / 15) * 10;
            if (b.cattleHunger >= 100) {
              b.cattleHunger = 0;
              b.cattleCount = Math.max(0, cattle - 1);
              this.c.effects.puff(b.mesh.position.x, b.mesh.position.z, 0.5, 12, ['#8a5a35', '#2b2622', '#f4f1ea']);
              this.cityEvent(b.city, t('A cow died in the ranch due to lack of feed (grass/crops)!'));
            }
          }
        }
      }
      if ((b.kind === 'coalmine' || b.kind === 'ironmine') && !this.mineFace(b)) continue; // no rock left within reach
      const reach = b.kind === 'coalmine' || b.kind === 'ironmine' ? this.reachFactor(b) : 1;
      if (b.kind === 'coalmine') { const n = CHAIN2.coalPerDay * Math.min(1, b.workers / d.jobs) * share * reach; this.c.eco.add(city, 'coal', n, 'Coal mines'); this.tally(b, 'Coal dug', n); this.dig(b, n); }
      if (b.kind === 'ironmine') { const n = IRON_PER_DAY * Math.min(1, b.workers / d.jobs) * share * reach; this.c.eco.add(city, 'iron', n, 'Iron mines'); this.tally(b, 'Iron ore dug', n); this.dig(b, n); }
      if (b.kind === 'carfactory' && b.stored < CARS.factoryMax) {
        const made = CARS.perDay * Math.min(1, b.workers / d.jobs) * (b.powered ? 1 : 0.4) * share;
        const iron = made * CARS.iron;
        if (city.iron >= iron) { this.c.eco.add(city, 'iron', -iron, 'Car factories'); b.stored += made; this.tally(b, 'Cars made', made); }
      }
      if (b.kind === 'carfactory' && b.stored >= CARS.truckLoad && b.trucks === 0 && b.access >= 0) this.deliverCars(b);
      if (!d.food || !d.jobs) continue;
      let f = d.food * Math.min(1, b.workers / d.jobs);
      if (b.kind === 'farm') f *= (growingSeason(month) ? (b.irrigated ? 1 : 0.15) : 0) * (this.c.weather.drought > 0 ? 0.4 : 1);
      if (b.kind === 'farm' || b.kind === 'orchard' || b.kind === 'ranch') f *= this.c.map.growth(b.z * N + b.x);
      // an upgraded field or orchard gives more (an upgraded ranch keeps more cows instead)
      if (b.kind === 'farm' || b.kind === 'orchard') f *= levelMult(b);
      if (b.kind === 'fishery') f *= seasonOf(month) === 'winter' ? 0.3 : 1;
      if (b.kind === 'orchard') f *= month >= 5 && month <= 9 ? 1.5 : month === 3 || month === 4 || month === 10 ? 0.4 : 0;
      if (b.kind === 'ranch') f *= (seasonOf(month) === 'winter' ? 0.7 : 1) * ((b.cattleCount ?? 4) / 4) * (b.cornFed ? 1.3 : 1);
      // a greenhouse grows vegetables all year, but only with electricity for its lamps and heating
      if (b.kind === 'greenhouse') f *= b.powered ? 1 : 0;
      // the ranch's milking machines and cold store run on electricity
      if ((b.kind === 'ranch' || b.kind === 'poultry') && !b.powered) f = 0;
      // bees make honey from spring to the end of summer, more with orchards, fields and flowers around
      if (b.kind === 'apiary') f *= (month >= 3 && month <= 8 ? 1 : 0) * (1 + Math.min(0.8, buildings.list.filter((o) => o.city === b.city && (o.kind === 'orchard' || o.kind === 'farm' || o.kind === 'flowerbed' || o.kind === 'park') && dist(o, b) <= 6).length * 0.2));
      // hens lay eggs all year, a little less in winter; corn feed makes them lay more
      if (b.kind === 'poultry') { const feed = Math.min(city.feed ?? 0, 2 * share); if (feed > 0) this.c.eco.add(city, 'feed', -feed, 'Poultry feed'); f *= (seasonOf(month) === 'winter' ? 0.8 : 1) * (feed >= 2 * share * 0.99 ? 1.3 : 1); }
      if (b.kind === 'farm') {
        // what the field gives depends on the crop: tractors and trucks take it on along its chain
        const crop = b.cropKind ?? 'wheat';
        const n = f * share * CROPS[crop].yield;
        if (crop === 'wheat') { this.c.eco.add(city, 'grain', n, 'Wheat fields'); this.chainTruck(b, n, ['mill'], 'grain'); }
        else if (crop === 'corn') { this.c.eco.add(city, 'feed', n, 'Corn fields'); this.chainTruck(b, n, ['ranch'], 'corn'); }
        else if (crop === 'cotton') { this.c.eco.add(city, 'cotton', n, 'Cotton fields'); this.chainTruck(b, n, ['clothes'], 'cotton'); }
        else {
          // vegetables and melons go straight to the shops (melons ripen in summer)
          const m = crop === 'melons' ? (month >= 5 && month <= 8 ? 1.5 : 0.4) : 1;
          this.c.eco.add(city, 'food', n * m, crop === 'melons' ? 'Melon fields' : 'Vegetable fields');
          city.foodMade += n * m;
          this.chainTruck(b, n * m, ['grocery', 'market', 'supermarket'], 'veg');
        }
        continue;
      }
      if (b.kind === 'ranch') {
        // part of the ranch's output is milk: a tanker takes it to the dairy
        const milk = f * share * CHAIN2.milkShareOfRanch;
        this.c.eco.add(city, 'milk', milk, BUILDINGS[b.kind].name);
        this.chainTruck(b, milk, ['dairy'], 'milk');
        f *= 1 - CHAIN2.milkShareOfRanch;
      }
      this.c.eco.add(city, 'food', f * share, BUILDINGS[b.kind].name);
      city.foodMade += f * share;
      if (b.kind === 'orchard' || b.kind === 'fishery' || b.kind === 'greenhouse' || b.kind === 'poultry' || b.kind === 'apiary') this.chainTruck(b, f * share, ['grocery', 'market', 'supermarket'], 'veg');
    }
    this.chains(share);

    this.haulWood();
    for (const b of buildings.ofKind('quarry')) {
      const th = this.depot(b);
      if (b.built < 1) continue;
      if (!this.mineFace(b)) continue; // no rock left within reach
      const dug = QUARRY.perDay * Math.min(1, b.workers / BUILDINGS.quarry.jobs) * (b.powered ? 1 : 0.5) * share * this.reachFactor(b);
      if (b.stored < QUARRY.maxStored) { this.dig(b, dug); this.tally(b, 'Stone dug', dug); }
      b.stored = Math.min(QUARRY.maxStored, b.stored + dug);
      if (!th || b.stored < QUARRY.truckLoad) continue;
      // no road link: a miner carries the stone to the Town Hall on foot
      if (b.access < 0 || th.access < 0 || !traffic.canRoute(b.access, th.access)) {
        this.sendPorter(b, th);
        continue;
      }
      if (b.trucks >= TRUCKS_PER_QUARRY) continue;
      const sent = traffic.spawn({
        kind: 'truck', from: b.access, to: th.access, loaded: true,
        fromPos: buildings.door(b), toPos: buildings.door(th), color: new THREE.Color('#ffffff'),
        purpose: 'Delivering stone', driverName: 'Truck driver', fromName: 'Stone Quarry', destName: BUILDINGS[th.kind].name,
        onArrive: () => { const own = eco.cities.get(b.city); if (own) eco.add(own, 'stone', QUARRY.truckLoad, 'Quarries (trucks)'); this.truckBack(b); },
        onFail: () => { b.stored += QUARRY.truckLoad; b.trucks = Math.max(0, b.trucks - 1); },
      });
      if (sent) { b.stored -= QUARRY.truckLoad; b.trucks++; }
    }
  }

  /** Where a workplace brings what it makes: the nearest working warehouse of its town (it hands the goods on), else the town hall. */
  private depot(b: Building) {
    const { buildings } = this.c;
    const stores = buildings.list.filter((w) => w.kind === 'warehouse' && w.city === b.city && w.built >= 1 && !w.removed);
    if (stores.length) return stores.reduce((a, w) => (dist(w, b) < dist(a, b) ? w : a));
    return buildings.townHall(b.city);
  }

  /**
   * The woodpiles by the woodcutters' huts: with a road a truck loads the logs at the roadside and takes them to
   * the warehouse; without one the woodcutters carry them there on foot. The wood counts when it arrives.
   */
  private haulWood() {
    const { buildings, traffic, eco } = this.c;
    const LOAD = 6;
    for (const b of buildings.ofKind('woodcutter')) {
      if (b.built < 1 || b.removed || (b.stored ?? 0) < LOAD) continue;
      const to = this.depot(b);
      if (!to) continue;
      if (b.access < 0 || to.access < 0 || !traffic.canRoute(b.access, to.access)) { this.sendPorter(b, to, 'wood', LOAD); continue; }
      if (b.trucks >= 1) continue;
      const sent = traffic.spawn({
        kind: 'truck', from: b.access, to: to.access, loaded: true, cargo: 'logs',
        fromPos: buildings.door(b), toPos: buildings.door(to),
        purpose: 'Taking logs to the warehouse', driverName: 'Truck driver', fromName: BUILDINGS.woodcutter.name, destName: BUILDINGS[to.kind].name,
        onArrive: () => { const own = eco.cities.get(b.city); if (own) eco.add(own, 'wood', LOAD, 'Woodcutters'); this.truckBack(b); },
        onFail: () => { b.stored += LOAD; b.trucks = Math.max(0, b.trucks - 1); },
      });
      if (sent) { b.stored -= LOAD; b.trucks++; this.tally(b, 'Logs sent', LOAD); }
    }
  }

  /**
   * Once a day: with two or more staffed metro stations a town has an underground line. Working people living near a
   * station ride it to work; every ride pays the fare to the town and they are a little happier (less traffic).
   */
  private metroDay() {
    // the rides of the day were counted one by one (each paid its fare at the gate)
    for (const city of this.c.eco.cities.values()) city.metroRiders = this.metroCount.get(city.id) ?? 0;
    this.metroCount.clear();
  }

  /** Metro rides today, by town. */
  private metroCount = new Map<number, number>();
  /** People underground right now, by station they will come up at. */
  underground = new Map<number, number>();

  /**
   * A trip by metro when both ends are near a staffed station of the same line (two or more stations in town) and
   * the trip is long enough: walk to the station, ride underground (a few seconds), come up at the other one and walk on.
   */
  private metroRide(c: Citizen, from: Building, dest: Building, arrive: () => void) {
    const { buildings, eco } = this.c;
    if (from.city !== dest.city || dist(from, dest) < 9) return false;
    const st = buildings.list.filter((b) => b.kind === 'metro' && b.city === from.city && b.built >= 1 && b.workers > 0 && !b.removed);
    if (st.length < 2) return false;
    const near = (p: Building) => st.reduce<Building | undefined>((a, s) => (Math.abs(s.x - p.x) + Math.abs(s.z - p.z) <= 7 && (!a || dist(s, p) < dist(a, p)) ? s : a), undefined);
    const a = near(from), b = near(dest);
    if (!a || !b || a === b) return false;
    const f = this.family(c);
    // with a car at hand only about half take the metro
    if (f?.car?.at === 'home' && c.age >= 18 && Math.random() < 0.5) return false;
    c.activity = 'Walking to the metro';
    this.walk(c, buildings.door(from), buildings.frontTile(from), a, () => {
      if (!this.alive(c)) return;
      if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
      c.activity = 'Riding the metro';
      const town = eco.cities.get(a.city);
      if (f && town) { f.money -= METRO_FARE; eco.add(town, 'money', METRO_FARE, 'Metro fares'); }
      this.metroCount.set(a.city, (this.metroCount.get(a.city) ?? 0) + 1);
      this.tally(a, 'Passengers');
      this.underground.set(b.id, (this.underground.get(b.id) ?? 0) + 1);
      this.leisure.later(2 + dist(a, b) * 0.12, () => {
        this.underground.set(b.id, Math.max(0, (this.underground.get(b.id) ?? 1) - 1));
        if (!this.alive(c)) return;
        c.activity = 'Coming up from the metro';
        this.walk(c, buildings.door(b), buildings.frontTile(b), dest, arrive);
      });
    });
    return true;
  }

  /**
   * Day trips: now and then families drive to a neighbour town (or fly, between two airports) for a change of air,
   * spend some money there, come back happier, and bring cheaper food home when it costs less there.
   */
  private dayTrips(say: (msg: string) => void) {
    const { pop, buildings, traffic, eco } = this.c;
    for (const city of eco.cities.values()) {
      if (city.ai) continue;
      const towns = [...eco.cities.values()].filter((c) => c.ai && buildings.townHall(c.id));
      if (!towns.length) continue;
      const myPort = buildings.list.some((b) => b.kind === 'airport' && b.city === city.id && b.built >= 1 && b.workers > 0);
      const fams = [...pop.families.values()].filter((f) => buildings.get(f.home)?.city === city.id && f.money > 250).sort(() => Math.random() - 0.5).slice(0, 3);
      let went = 0;
      for (const f of fams) {
        if (Math.random() > 0.45) continue;
        const town = towns[Math.floor(Math.random() * towns.length)];
        const hall = buildings.townHall(town.id)!;
        const home = buildings.get(f.home)!;
        const cheaper = this.priceLevel(town.id) < this.priceLevel(city.id) * 0.95;
        const visit = (how: string) => {
          const spend = Math.round(15 + Math.random() * 30);
          f.money -= spend;
          eco.add(town, 'money', spend, 'Visitors from other towns');
          town.tourists += pop.members(f).length;
          for (const m of pop.members(f)) m.joy = eco.day;
          if (cheaper) f.pantry = (f.pantry ?? 0) + 8;
          const head = pop.members(f).find((m) => m.role === 'parent');
          if (head) pop.note(head, cheaper ? 'Went to {city} by {how} and bought cheaper food there' : 'A day trip to {city} by {how}', { city: town.name, how });
        };
        const car = f.car;
        if (car?.at === 'home' && home.access >= 0 && hall.access >= 0 && traffic.canRoute(home.access, hall.access)) {
          car.at = 'moving';
          const ok = traffic.spawn({
            kind: 'car', from: home.access, to: hall.access, color: colorOf(car.color), fromPos: buildings.slot(home, 0), toPos: buildings.door(hall),
            driverName: `${f.surname}`, purpose: 'Day trip to a neighbour town', fromName: BUILDINGS[home.kind].name, destName: BUILDINGS[hall.kind].name, homeBuildingId: home.id,
            onArrive: () => {
              visit('car');
              traffic.spawn({ kind: 'car', from: hall.access, to: home.access, color: colorOf(car.color), fromPos: buildings.door(hall), toPos: buildings.slot(home, 0),
                driverName: `${f.surname}`, purpose: 'Driving home', fromName: BUILDINGS[hall.kind].name, destName: BUILDINGS[home.kind].name, homeBuildingId: home.id,
                onArrive: () => { car.at = 'home'; }, onFail: () => { car.at = 'home'; } }) || (car.at = 'home');
            },
            onFail: () => { car.at = 'home'; },
          });
          if (!ok) { car.at = 'home'; continue; }
          went++;
        } else if (myPort && buildings.list.some((b) => b.kind === 'airport' && b.city === town.id && b.built >= 1) && f.money > 400) {
          f.money -= 40;
          visit('plane');
          went++;
        }
      }
      if (went) say(t('{n} families went on a day trip to the neighbour towns', { n: went }));
    }
  }

  /** Lonely old people in each town and how many the care homes look after. */
  careBy = new Map<number, { lonely: number; cared: number }>();

  /** The economy: 1 normal, below 1 in a crisis, above 1 in a boom (set by the game). Sales, prices and mood follow it. */
  econFactor = 1;

  /** Snow on the roads (set for a day by a snowstorm): traffic drives slower. */
  snowstorm = 0;

  /**
   * Weather events: in spring the rivers can rise and flood the homes along the water (a flood wall within 6 tiles
   * keeps them dry); in winter a snowstorm makes the traffic crawl for a day.
   */
  /** Two orange snow ploughs drive from the yard to the far ends of the town and back. */
  private ploughs(yard: Building) {
    const { buildings, traffic } = this.c;
    const ends = buildings.list.filter((b) => b.city === yard.city && b.access >= 0 && b.built >= 1 && b !== yard && traffic.canRoute(yard.access, b.access))
      .sort((a, b) => dist(b, yard) - dist(a, yard)).slice(0, 6);
    for (const to of ends.sort(() => Math.random() - 0.5).slice(0, 2)) {
      const back = () => traffic.spawn({ kind: 'truck', from: to.access, to: yard.access, color: new THREE.Color('#f28c28'), fromPos: buildings.door(to), toPos: buildings.door(yard),
        purpose: 'Clearing snow', driverName: 'Snow plough driver', fromName: BUILDINGS[to.kind].name, destName: BUILDINGS[yard.kind].name });
      traffic.spawn({ kind: 'truck', from: yard.access, to: to.access, color: new THREE.Color('#f28c28'), fromPos: buildings.door(yard), toPos: buildings.door(to),
        purpose: 'Clearing snow', driverName: 'Snow plough driver', fromName: BUILDINGS[yard.kind].name, destName: BUILDINGS[to.kind].name, onArrive: () => { back(); } });
    }
  }

  private weatherEvents(season: string) {
    const { buildings, map, eco, effects, traffic } = this.c;
    this.snowstorm = 0;
    traffic.speedScale = 1;
    if (this.calm) return;
    if (season === 'winter' && Math.random() < 0.08) {
      this.snowstorm = 1;
      // the construction company sends its snow ploughs out: the traffic only slows a little
      const yards = buildings.list.filter((b) => b.kind === 'construction' && b.built >= 1 && b.workers > 0 && b.access >= 0 && !eco.cities.get(b.city)?.ai);
      traffic.speedScale = yards.length ? 0.85 : 0.5;
      if (yards.length) { this.events.push(t('Snowstorm! The snow ploughs of the construction company are clearing the roads')); for (const y of yards) this.ploughs(y); }
      else this.events.push(t('Snowstorm! The roads are covered in snow and the traffic crawls today (a Construction Company would send snow ploughs)'));
    }
    if (season !== 'spring' || Math.random() > 0.07) return;
    const walls = buildings.list.filter((b) => b.kind === 'levee' && b.built >= 1);
    const hit = new Map<number, number>();
    for (const b of buildings.list) {
      if (b.built < 1 || b.removed || !BUILDINGS[b.kind].units) continue;
      let wet = false;
      for (let dz = -1; dz <= 1 && !wet; dz++) for (let dx = -1; dx <= 1; dx++) if (inBounds(b.x + dx, b.z + dz) && map.water[(b.z + dz) * N + b.x + dx]) { wet = true; break; }
      if (!wet || walls.some((w) => Math.abs(w.x - b.x) + Math.abs(w.z - b.z) <= 6)) continue;
      hit.set(b.city, (hit.get(b.city) ?? 0) + 1);
      effects.puff(b.mesh.position.x, b.mesh.position.z, 0.6, 10, ['#4fa3d1', '#9fd3ff', '#d8e8f2']);
    }
    for (const [cityId, n] of hit) {
      const city = eco.cities.get(cityId);
      if (!city) continue;
      eco.add(city, 'money', -n * 60, 'Flood repairs');
      const old = this.moodBoost.get(cityId);
      this.moodBoost.set(cityId, { v: (old && old.until >= eco.day ? old.v : 0) - 6, until: eco.day + 3 });
      this.cityEvent(cityId, t('Flood! The river rose and {n} homes by the water were flooded (repairs ${m}). Flood walls keep homes dry', { n, m: n * 60 }));
    }
  }

  /**
   * Once a day: families pay their mortgage to the bank (the town's). A family that cannot pay for days loses the
   * house to the bank: it stays there as tenants, paying rent.
   */
  private mortgages() {
    const { pop, buildings, eco } = this.c;
    for (const f of pop.families.values()) {
      const m = f.mortgage;
      if (!m) continue;
      const house = buildings.get(m.house);
      const city = house && eco.cities.get(house.city);
      if (!house || house.removed || !city) { f.mortgage = undefined; continue; }
      const pay = Math.min(m.perDay, m.left);
      if (f.money >= pay) {
        f.money -= pay;
        m.left -= pay;
        eco.add(city, 'money', pay, 'Mortgage payments');
        if (m.left <= 0) {
          f.mortgage = undefined;
          for (const c of pop.members(f)) if (c.age >= 18) pop.note(c, 'Paid off the mortgage: the house is all theirs');
          this.cityEvent(city.id, t('The {family} family paid off their mortgage — the house is theirs', { family: f.surname }));
        }
      } else if (f.debtDays >= 3) {
        // the bank takes the house; the family stays as tenants
        f.mortgage = undefined;
        house.owner = -1;
        f.debtDays = 0;
        for (const c of pop.members(f)) if (c.age >= 18) pop.note(c, 'Could not pay the mortgage: the bank took the house');
        this.cityEvent(city.id, t('The {family} family could not pay the mortgage: the bank took the house, they stay as tenants', { family: f.surname }));
      }
    }
  }

  /** Once a day: a woodcutter with savings may buy a chainsaw in a shop of the town (trees come down much faster). */
  private buySaws() {
    const { pop, buildings } = this.c;
    for (const c of pop.citizens.values()) {
      if (c.saw || c.job < 0 || Math.random() > 0.2) continue;
      const job = buildings.get(c.job);
      if (job?.kind !== 'woodcutter') continue;
      const f = pop.families.get(c.family);
      const PRICE = 150;
      if (!f || f.money < PRICE + 250) continue;
      const shop = buildings.list.find((s) => s.city === job.city && s.built >= 1 && s.workers > 0 && (s.kind === 'market' || s.kind === 'supermarket' || s.kind === 'grocery'));
      if (!shop) continue;
      f.money -= PRICE;
      shop.sales = (shop.sales ?? 0) + PRICE;
      this.tally(shop, 'Chainsaws');
      c.saw = true;
      this.c.pop.note(c, 'Bought a chainsaw at the {place}: trees come down much faster now', { place: BUILDINGS[shop.kind].name });
    }
  }

  /** Miners carry stone over footpaths (or open ground) when no road connects the quarry. */
  private sendPorter(b: Building, th: Building, res: 'stone' | 'wood' = 'stone', load = QUARRY.truckLoad) {
    const { pop, buildings, eco } = this.c;
    let active = 0;
    for (const id of this.porters) if (pop.citizens.get(id)?.job === b.id) active++;
    if (active >= 2) return;
    // anyone on shift: idle inside, or hacking at the rock face (who then goes back to it)
    const onShift = (c: Citizen) => c.job === b.id && c.state === 'away' && c.at === b.id && !this.porters.has(c.id) && this.c.eco.timeOfDay < c.returnAt;
    const worker = [...pop.citizens.values()].find((c) => onShift(c) && !c.walker) ?? [...pop.citizens.values()].find((c) => onShift(c) && !!c.walker && !c.walker.leaving);
    if (!worker) return;
    const outside = !!worker.walker && !worker.walker.leaving;
    const from = outside ? { x: worker.walker!.x, z: worker.walker!.z } : buildings.door(b);
    const fromTile = outside ? tileAt(from) : buildings.frontTile(b);
    this.porters.add(worker.id);
    b.stored -= load;
    worker.activity = res === 'wood' ? 'Carrying logs to the warehouse' : 'Carrying stone';
    const crate: 'log' | 'stone' = res === 'wood' ? 'log' : 'stone';
    const finish = () => {
      this.porters.delete(worker.id);
      if (!this.alive(worker)) return;
      // back at the quarry: on to the rock face again while the shift lasts
      if (worker.state === 'away' && worker.at === b.id && this.c.eco.timeOfDay < worker.returnAt && BUILDINGS[b.kind].work === 'miner') { this.mineLoop(worker, b); return; }
      if (worker.state === 'away' && worker.at === b.id && this.c.eco.timeOfDay < worker.returnAt && b.kind === 'woodcutter') { this.woodcutterLoop(worker, b); return; }
      if (worker.walker) { this.c.walkers.dismiss(worker.walker); worker.walker = undefined; }
      if (worker.state === 'away') worker.activity = 'At work';
    };
    this.walk(worker, from, fromTile, th, () => {
      if (!this.alive(worker)) { this.porters.delete(worker.id); return; }
      const own = eco.cities.get(b.city);
      if (own) this.c.eco.add(own, res, load, res === 'wood' ? 'Woodcutters' : 'Quarries (on foot)');
      if (worker.walker) worker.walker.carry = 'none';
      worker.activity = res === 'wood' ? 'Walking back to the forest' : 'Walking back to the quarry';
      if (b.removed) return finish();
      this.walk(worker, buildings.door(th), buildings.frontTile(th), b, finish);
    }, crate);
  }

  /** Trucks bring new cars from the factory to the car market with room in its lot. */
  private deliverCars(factory: Building) {
    const { buildings, traffic } = this.c;
    const market = buildings.list
      .filter((m) => m.kind === 'carmarket' && m.city === factory.city && m.built >= 1 && m.access >= 0 && m.stored + CARS.truckLoad <= CARS.marketMax)
      .sort((a, b) => a.stored - b.stored)[0];
    if (!market) return;
    // next door: the cars are simply driven over
    this.tally(factory, 'Cars delivered to the market', CARS.truckLoad);
    if (market.access === factory.access || dist(market, factory) <= 3) {
      factory.stored -= CARS.truckLoad;
      market.stored += CARS.truckLoad;
      return;
    }
    const ok = traffic.spawn({
      kind: 'truck', loaded: true, from: factory.access, to: market.access, color: new THREE.Color('#3a6fd1'),
      fromPos: buildings.door(factory), toPos: buildings.door(market),
      purpose: 'Delivering cars', driverName: 'Auto carrier', fromName: 'Car Factory', destName: 'Car Market',
      onArrive: () => {
        market.stored += CARS.truckLoad;
        factory.trucks = 0;
        traffic.spawn({
          kind: 'truck', from: market.access, to: factory.access, fromPos: buildings.door(market), toPos: buildings.door(factory),
          purpose: 'Returning to factory', driverName: 'Auto carrier', fromName: 'Car Market', destName: 'Car Factory',
        });
      },
      onFail: () => { factory.stored += CARS.truckLoad; factory.trucks = 0; },
    });
    if (ok) { factory.stored -= CARS.truckLoad; factory.trucks = 1; }
  }

  /** Mill, bakery and sawmill turn raw goods into better ones; trucks show the goods moving. */
  private chains(share: number) {
    const { buildings, eco } = this.c;
    const staff = (b: Building) => Math.min(1, b.workers / BUILDINGS[b.kind].jobs) * (b.powered ? 1 : 0.5);
    for (const city of eco.cities.values()) {
      const own = buildings.list.filter((b) => b.city === city.id && b.built >= 1 && b.workers > 0);
      const mills = own.filter((b) => b.kind === 'mill');
      for (const m of mills) {
        const n = Math.min(city.grain, CHAIN.mill * staff(m) * share);
        if (n <= 0) continue;
        eco.add(city, 'grain', -n, 'Flour Mill');
        eco.add(city, 'flour', n, 'Flour Mill');
        this.chainTruck(m, n, ['bakery'], 'flour');
      }
      if (!mills.length && city.grain > 0) {
        // no mill: the grain is simply cooked — it feeds people, but less
        const n = Math.min(city.grain, CHAIN.rawGrainPerDay * share);
        eco.add(city, 'grain', -n, 'Cooked as raw grain (no mill)');
        eco.add(city, 'food', n * CHAIN.rawGrainFood, 'Raw grain (no mill)');
        city.foodMade += n * CHAIN.rawGrainFood;
      }
      for (const bk of own.filter((b) => b.kind === 'bakery')) {
        const n = Math.min(city.flour, CHAIN.bakery * staff(bk) * share);
        if (n <= 0) continue;
        eco.add(city, 'flour', -n, 'Bakery');
        eco.add(city, 'food', n * CHAIN.breadPerFlour, 'Bakery');
        city.foodMade += n * CHAIN.breadPerFlour;
        this.chainTruck(bk, n * CHAIN.breadPerFlour, ['supermarket', 'grocery', 'market'], 'bread');
      }
      const dairies = own.filter((b) => b.kind === 'dairy');
      for (const dy of dairies) {
        const n = Math.min(city.milk, CHAIN2.dairy * staff(dy) * share);
        if (n <= 0) continue;
        eco.add(city, 'milk', -n, 'Dairy');
        eco.add(city, 'food', n * CHAIN2.foodPerMilk, 'Dairy');
        city.foodMade += n * CHAIN2.foodPerMilk;
        this.chainTruck(dy, n * CHAIN2.foodPerMilk, ['supermarket', 'grocery', 'market'], 'dairy');
      }
      if (city.milk > 0 && (!dairies.length || city.milk > 250)) {
        // no dairy: the milk is drunk fresh
        const n = Math.min(city.milk, 60 * share);
        eco.add(city, 'milk', -n, 'Drunk fresh (no dairy)');
        eco.add(city, 'food', n, 'Fresh milk (no dairy)');
        city.foodMade += n;
      }
      for (const bw of own.filter((b) => b.kind === 'brickworks')) {
        const n = Math.min(Math.max(0, city.stone - 30) / CHAIN2.stonePerBrick, CHAIN2.bricks * staff(bw) * share);
        if (n <= 0) continue;
        eco.add(city, 'stone', -n * CHAIN2.stonePerBrick, 'Brickworks');
        eco.add(city, 'bricks', n, 'Brickworks');
      }
      for (const sm of own.filter((b) => b.kind === 'sawmill')) {
        const n = Math.min(Math.max(0, city.wood - 20), CHAIN.sawmill * staff(sm) * share);
        if (n <= 0) continue;
        eco.add(city, 'wood', -n, 'Sawmill');
        eco.add(city, 'planks', n, 'Sawmill');
        // logs come in from the woodcutters by truck
        const cutter = buildings.list.find((w) => w.kind === 'woodcutter' && w.city === city.id && w.access >= 0);
        if (cutter) this.chainTruck(cutter, n, ['sawmill'], 'logs');
      }
      for (const bf of own.filter((b) => b.kind === 'bikefactory')) {
        const n = Math.min(BIKE.perDay * staff(bf) * share, BIKE.max - bf.stored, Math.max(0, city.iron - 5) / BIKE.iron);
        if (n <= 0) continue;
        eco.add(city, 'iron', -n * BIKE.iron, 'Bicycle factory');
        bf.stored += n;
      }
      // the factory sews clothes from cotton and makes furniture from planks (half the staff on each when both come in)
      for (const fc of own.filter((b) => b.kind === 'factory')) {
        const both = city.cotton >= 1 && city.planks > 12;
        const c1 = Math.min(Math.max(0, city.cotton), CHAIN2.garments * staff(fc) * share * (both ? 0.5 : 1));
        if (c1 > 0) {
          eco.add(city, 'cotton', -c1, 'Factory');
          eco.add(city, 'garments', c1, 'Factory');
          this.chainTruck(fc, c1, ['clothes'], 'cotton');
        }
        const p1 = Math.min(Math.max(0, city.planks - 10), CHAIN2.furniture * staff(fc) * share * (both ? 0.5 : 1));
        if (p1 > 0) {
          eco.add(city, 'planks', -p1, 'Factory');
          eco.add(city, 'furniture', p1, 'Factory');
          this.chainTruck(fc, p1, ['market', 'supermarket'], 'planks');
        }
      }
    }
  }

  /** Count goods made at `from`; once a truckload is ready, a truck drives it to the nearest target (for show). */
  private chainTruck(from: Building, amount: number, targets: string[], cargo: CargoKind) {
    const { buildings, traffic } = this.c;
    from.cargoAcc = (from.cargoAcc ?? 0) + amount;
    if (from.cargoAcc < CHAIN.load || from.access < 0 || from.trucks >= 1) return;
    const dest = buildings.list
      .filter((b) => targets.includes(b.kind) && b.city === from.city && b.built >= 1 && b.access >= 0 && b.id !== from.id)
      .sort((a, b) => dist(a, from) - dist(b, from))[0];
    if (!dest) { from.cargoAcc = 0; return; }
    from.cargoAcc = 0;
    // a worker of the building drives; with nobody on shift the goods wait (they are counted anyway)
    const driver = this.takeDriver(from);
    if (!driver) return;
    const back = () => {
      const done = () => { from.trucks = Math.max(0, from.trucks - 1); this.releaseDriver(driver); };
      if (from.removed || dest.removed) return done();
      const ok = traffic.spawn({ kind: 'truck', from: dest.access, to: from.access, fromPos: buildings.door(dest), toPos: buildings.door(from), purpose: 'Returning empty', driverId: driver.id, driverName: this.fullName(driver), fromName: BUILDINGS[dest.kind].name, destName: BUILDINGS[from.kind].name, onArrive: done, onFail: done });
      if (!ok) done();
    };
    const ok = traffic.spawn({
      kind: 'truck', from: from.access, to: dest.access, loaded: true, cargo,
      fromPos: buildings.door(from), toPos: buildings.door(dest),
      purpose: CARGO_PURPOSE[cargo], driverId: driver.id, driverName: this.fullName(driver), fromName: BUILDINGS[from.kind].name, destName: BUILDINGS[dest.kind].name,
      onArrive: back, onFail: () => { from.trucks = Math.max(0, from.trucks - 1); this.releaseDriver(driver); },
    });
    if (ok) from.trucks++;
    else this.releaseDriver(driver);
  }

  /** Construction sites get planks from the sawmill: a truck brings them and the site goes up faster. */
  private deliverPlanks() {
    this.deliverMaterial('bricks', 'brickworks', 'bricks', 'Delivering bricks');
    this.deliverMaterial('iron', 'ironmine', 'steel', 'Delivering iron beams');
    const { buildings, eco, traffic } = this.c;
    const now = this.clock();
    for (const site of buildings.list) {
      if (site.built >= 1 || site.removed || (site.planked ?? 0) > now || this.crewSize(site) === 0) continue;
      const city = eco.cities.get(site.city);
      if (!city || city.planks < CHAIN.planksPerSite) continue;
      eco.add(city, 'planks', -CHAIN.planksPerSite, 'Used on construction sites');
      site.planked = now + 90;
      const mill = buildings.list.find((b) => b.kind === 'sawmill' && b.city === site.city && b.access >= 0);
      const driver = mill ? this.takeDriver(mill) : undefined;
      if (mill && driver && site.access >= 0) {
        const ok = traffic.spawn({ kind: 'truck', from: mill.access, to: site.access, loaded: true, cargo: 'planks', fromPos: buildings.door(mill), purpose: 'Delivering planks', driverId: driver.id, driverName: this.fullName(driver), fromName: 'Sawmill', destName: BUILDINGS[site.kind].name, onArrive: () => this.releaseDriver(driver), onFail: () => this.releaseDriver(driver) });
        if (!ok) this.releaseDriver(driver);
      } else this.releaseDriver(driver);
    }
  }

  /** Bricks (and iron beams for big sites) go to construction sites by truck; each makes the site go up faster for a while. */
  private deliverMaterial(res: 'bricks' | 'iron', producer: string, cargo: CargoKind, purpose: string) {
    const { buildings, eco, traffic } = this.c;
    const now = this.clock();
    for (const site of buildings.list) {
      if (site.built >= 1 || site.removed || this.crewSize(site) === 0) continue;
      if (res === 'iron' && BUILDINGS[site.kind].size < 2) continue;
      const boost = (site.boost ??= {});
      const key = res === 'iron' ? 'steel' : res;
      if ((boost[key] ?? 0) > now) continue;
      const city = eco.cities.get(site.city);
      if (!city || city[res] < CHAIN2.perSite + (res === 'iron' ? 20 : 0)) continue;
      const from = buildings.list.find((b) => b.kind === producer && b.city === site.city && b.access >= 0);
      const driver = from ? this.takeDriver(from) : undefined;
      if (!from || !driver || site.access < 0) { this.releaseDriver(driver); continue; }
      eco.add(city, res, -CHAIN2.perSite, 'Used on construction sites');
      boost[key] = now + 90;
      const ok = traffic.spawn({ kind: 'truck', from: from.access, to: site.access, loaded: true, cargo, fromPos: buildings.door(from), purpose, driverId: driver.id, driverName: this.fullName(driver), fromName: BUILDINGS[from.kind].name, destName: BUILDINGS[site.kind].name, onArrive: () => this.releaseDriver(driver), onFail: () => this.releaseDriver(driver) });
      if (!ok) this.releaseDriver(driver);
    }
  }

  /** Game seconds since the start (for short timers). */
  private clock() { return this.c.eco.day * DAY_SECONDS + this.c.eco.timeOfDay * DAY_SECONDS; }

  // ---------- garbage ----------

  /** Homes fill their bins every day. */
  private fillBins(city: City, own: Building[]) {
    const { pop } = this.c;
    const people = new Map<number, number>();
    for (const f of pop.families.values()) people.set(f.home, (people.get(f.home) ?? 0) + f.members.length);
    let full = 0, homes = 0;
    // in a small village families compost and burn their own rubbish: bins only overflow once the town grows
    let total = 0;
    for (const h of own) total += people.get(h.id) ?? 0;
    const village = total < 60;
    for (const h of own) {
      if (!BUILDINGS[h.kind].units) continue;
      homes++;
      h.trash = Math.min(village ? TRASH.full - 1 : 30, (h.trash ?? 0) + (people.get(h.id) ?? 0) * TRASH.perPerson * (this.c.eco.cities.get(h.city)?.laws?.includes('recycle') ? 0.7 : 1));
      if (h.trash >= TRASH.full) {
        full++;
        // rubbish piling up makes people ill
        for (const f of pop.families.values()) if (f.home === h.id) for (const c of pop.members(f)) c.health = Math.max(1, c.health - 3);
      }
    }
    this.dirty.set(city.id, homes ? full / homes : 0);
  }

  /** A garbage truck from a landfill or recycling plant empties the fullest bins nearby. */
  private garbageRound(depot: Building) {
    const { buildings } = this.c;
    if ((this.fleet.get(depot.id) ?? 0) >= (depot.workers >= 4 ? 2 : 1)) return;
    const stops = buildings.list
      .filter((h) => BUILDINGS[h.kind].units && h.city === depot.city && (h.trash ?? 0) >= 2 && h.access >= 0 && dist(h, depot) <= TRASH.range && !this.binTaken.has(h.id))
      .sort((a, b) => (b.trash ?? 0) - (a.trash ?? 0)).slice(0, 5);
    if (!stops.length) return;
    const driver = this.takeDriver(depot, 'Collecting garbage');
    if (!driver) return;
    for (const h of stops) this.binTaken.add(h.id);
    this.fleet.set(depot.id, (this.fleet.get(depot.id) ?? 0) + 1);
    this.garbageLeg(depot, depot.access, stops, 0, 0, driver);
  }

  private garbageLeg(depot: Building, at: number, stops: Building[], i: number, load: number, driver: Citizen): void {
    const { traffic, buildings, eco } = this.c;
    const finish = (collected: number) => {
      this.releaseDriver(driver);
      this.fleet.set(depot.id, Math.max(0, (this.fleet.get(depot.id) ?? 1) - 1));
      for (const h of stops) this.binTaken.delete(h.id);
      const city = eco.cities.get(depot.city);
      if (city && collected > 0 && depot.kind === 'recycling') {
        eco.add(city, 'iron', collected * TRASH.ironPerTrash, 'Recycling');
        eco.add(city, 'money', collected * TRASH.moneyPerTrash, 'Recycled materials sold');
      }
    };
    if (depot.removed) return finish(0);
    const home = i >= stops.length;
    const to = home ? depot : stops[i];
    if (to.removed || to.access < 0) return this.garbageLeg(depot, at, stops, i + 1, load, driver);
    const ok = traffic.spawn({
      kind: 'truck', from: at, to: to.access, loaded: load > 0, cargo: 'trash',
      fromPos: at === depot.access ? buildings.door(depot) : undefined, toPos: home ? buildings.door(depot) : undefined,
      purpose: home ? 'Taking garbage to the dump' : 'Collecting garbage', driverId: driver.id, driverName: this.fullName(driver),
      fromName: BUILDINGS[depot.kind].name, destName: BUILDINGS[to.kind].name, homeBuildingId: depot.id,
      onArrive: () => {
        if (home) return finish(load);
        const got = to.trash ?? 0;
        to.trash = 0;
        this.binTaken.delete(to.id);
        this.garbageLeg(depot, to.access, stops, i + 1, load + got, driver);
      },
      onFail: () => finish(load),
    });
    if (!ok) finish(load);
  }

  /**
   * The average pay in a town compared to the usual pay of the same jobs (1 = usual). Where people earn more,
   * everything costs more: shops, food, tickets and the goods the town trades.
   */
  updateWageIndex(city: City) {
    const { buildings, pop } = this.c;
    let paid = 0, usual = 0;
    for (const b of buildings.list) {
      if (b.city !== city.id || b.built < 1 || b.workers <= 0) continue;
      const base = BUILDINGS[b.kind].salary * b.workers;
      usual += base;
      paid += base * pop.wageFactor(b);
    }
    city.wageIndex = usual > 0 ? Math.round((paid / usual) * 100) / 100 : 1;
  }

  /** How dear prices are in a town because of its wages (×1 at the usual pay). */
  priceLevel(cityId: number) {
    const w = Math.max(0.3, this.c.eco.cities.get(cityId)?.wageIndex ?? 1);
    return 0.4 + 0.6 * w;
  }

  /** Food is dearer when it is scarce and cheaper when the stores are full, and dearer where the pay is higher. */
  private prices(city: City, say: (msg: string) => void) {
    this.updateWageIndex(city);
    const days = city.food / Math.max(1, this.mouths.get(city.id) ?? 1);
    const adj = city.foodAdj ?? 0;
    const season = seasonOf(monthOf(this.c.eco.day));
    const want = (days < 1 ? 1.8 : days < 2 ? 1.4 : days < 4 ? 1.1 : days > 10 ? 0.85 : 1) * this.priceLevel(city.id) * (1 + adj) * (season === 'summer' ? 0.9 : season === 'winter' ? 1.15 : 1) * this.econFactor;
    // cheaper food set by the town hall: the treasury pays the difference to the shops every day
    if (adj < 0) this.c.eco.add(city, 'money', -Math.round((this.mouths.get(city.id) ?? 0) * -adj * 2), 'Food subsidy');
    const before = city.priceFactor;
    city.priceFactor += (want - before) * 0.5;
    if (before < 1.3 && city.priceFactor >= 1.3) say(t('Food got more expensive: the stores are almost empty'));
    if (before > 0.92 && city.priceFactor <= 0.92) say(t('Food is cheap: the stores are full'));
  }

  /** The town hall pays a pension to every retired citizen. */
  private pensions(city: City, belongs: (f: Family) => boolean) {
    const { pop, eco } = this.c;
    let total = 0;
    // the carers of the care home look after the old people who live alone
    let care = this.careBy.get(city.id)?.cared ?? 0;
    for (const c of pop.citizens.values()) {
      if (care <= 0) break;
      const f = pop.families.get(c.family);
      if (!f || !belongs(f) || c.age < 65 || !pop.members(f).every((m) => m.age >= 65)) continue;
      c.health = Math.min(100, c.health + 6); c.hunger = Math.max(c.hunger, 60); care--;
    }
    for (const f of pop.families.values()) {
      if (!belongs(f)) continue;
      const pension = Math.round(PENSION * (city.budget?.pension ?? 100)) / 100;
      for (const c of pop.members(f)) if (c.age >= 65) { f.money += pension; total += pension; }
    }
    if (total) eco.add(city, 'money', -total, 'Pensions');
  }

  /**
   * Waste water: cesspits are enough for the first 60 people; above that every staffed (and powered) treatment plant
   * cleans the water of SEWAGE_PER_PLANT more. What is left untreated makes people ill and unhappy.
   */
  private sewage(city: City, own: Building[], belongs: (f: Family) => boolean) {
    const { pop } = this.c;
    const n = [...pop.families.values()].filter(belongs).reduce((a, f) => a + f.members.length, 0);
    const plants = own.filter((b) => b.kind === 'sewage' && b.built >= 1 && b.workers > 0).reduce((a, b) => a + Math.min(1, b.workers / BUILDINGS.sewage.jobs) * (b.powered ? 1 : 0.5) * levelMult(b), 0);
    const san = n <= 60 ? 1 : Math.min(1, (60 + plants * SEWAGE_PER_PLANT) / n);
    this.sewageCap.set(city.id, { people: n, treated: Math.round(60 + plants * SEWAGE_PER_PLANT) });
    this.sanitation.set(city.id, san);
    if (san >= 0.99) return;
    for (const f of pop.families.values()) {
      if (!belongs(f) || Math.random() > (1 - san) * 0.3) continue;
      for (const c of pop.members(f)) c.health = Math.max(1, c.health - 12);
    }
  }

  /** Winter flu: it spreads in families and around town; pharmacies and hospitals slow it down. */
  private flu(city: City, own: Building[], belongs: (f: Family) => boolean, say: (msg: string) => void) {
    const { pop, eco } = this.c;
    const people = [...pop.citizens.values()].filter((c) => { const f = pop.families.get(c.family); return !!f && belongs(f); });
    const ill = people.filter((c) => (c.flu ?? 0) > 0);
    const pharmacy = own.some((b) => b.kind === 'pharmacy' && b.workers > 0);
    const hospital = own.some((b) => b.kind === 'hospital' && b.workers > 0);
    for (const c of ill) {
      c.health = Math.max(1, c.health - (c.age > 65 || c.age < 4 ? 14 : 8));
      c.flu = Math.max(0, (c.flu ?? 0) - (pharmacy ? 2 : 1));
      if (!c.flu) this.c.pop.note(c, 'Got over the flu');
    }
    if (this.calm || people.length < 10) return;
    const winter = seasonOf(monthOf(eco.day)) === 'winter';
    if (!ill.length && winter && Math.random() < FLU.outbreak) {
      for (let i = 0; i < 3; i++) { const c = pick(people); c.flu = FLU.days; this.c.pop.note(c, 'Caught the flu'); }
      say(t('Flu season! People are falling ill — pharmacies and hospitals help'));
      return;
    }
    // spreading: family members, then a few others in town
    const rate = FLU.spread * (pharmacy ? 0.5 : 1) * (hospital ? 0.7 : 1) * (winter ? 1 : 0.4) * (city.laws?.includes('nosmoke') ? 0.75 : 1);
    for (const c of ill) {
      const f = pop.families.get(c.family);
      const fit = (m: Citizen) => (m.fit ?? 0) > eco.day ? 0.4 : 1;
      if (f) for (const m of pop.members(f)) if (!m.flu && Math.random() < 0.35 * (pharmacy ? 0.6 : 1) * fit(m)) m.flu = FLU.days;
      if (Math.random() < rate * 3) { const o = pick(people); if (!o.flu && Math.random() < fit(o)) o.flu = FLU.days; }
    }
  }

  /** Skilled workers move to better-paid jobs when one is free (a job interview, in short). */
  private switchJobs(city: City, own: Building[], say: (msg: string) => void) {
    const { pop, buildings } = this.c;
    let moved = 0, came = 0;
    const open = own.filter((b) => BUILDINGS[b.kind].jobs > b.workers).sort((a, b) => BUILDINGS[b.kind].salary * pop.wageFactor(b) - BUILDINGS[a.kind].salary * pop.wageFactor(a));
    if (!open.length) return;
    for (const c of pop.citizens.values()) {
      if (moved + came >= 4 || c.job < 0 || Math.random() > 0.15) continue;
      const cur = buildings.get(c.job);
      if (!cur) continue;
      // workers of a neighbour town (joined by road) come over when this town pays clearly more
      const home = buildings.get(pop.families.get(c.family)?.home ?? -1);
      const here = cur.city === city.id;
      if (here ? c.skill < 1 : !home || home.city === city.id || !pop.commute(home.city, city.id)) continue;
      const pay = (b: Building) => BUILDINGS[b.kind].salary * this.c.pop.wageFactor(b);
      const best = open.find((b) => BUILDINGS[b.kind].jobs > b.workers && pay(b) >= pay(cur) * 1.25 && b.id !== cur.id && pop.fits(c, b)
        && (here || ((!DEGREE_JOBS[b.kind] || c.skill >= 1) && Math.abs(b.x - home!.x) + Math.abs(b.z - home!.z) <= 90)));
      // nobody leaves an essential job (water, food, power, builders…) for a less essential one
      if (!best || this.c.pop.priority(best) > this.c.pop.priority(cur) || (this.c.pop.priority(cur) <= 2 && cur.workers <= 1)) continue;
      cur.workers--;
      best.workers++;
      c.job = best.id;
      if (here) { this.c.pop.note(c, 'Changed jobs: now at the {place} for better pay', { place: BUILDINGS[best.kind].name }); moved++; }
      else {
        this.c.pop.note(c, 'Now works in {city} at the {place} — the pay is better there', { city: city.name, place: BUILDINGS[best.kind].name });
        this.cityEvent(cur.city, t('A worker left for better pay in {city}', { city: city.name }));
        came++;
      }
    }
    if (moved || came) pop.assign(buildings);
    if (moved) say(t('{n} skilled workers moved to better-paid jobs', { n: moved }));
    if (came) say(t('{n} workers from neighbour towns came here for better pay', { n: came }));
  }

  /** Special weather for the day: morning fog, a winter blizzard or a summer heatwave. */
  pickWeather(say: (msg: string) => void) {
    const season = seasonOf(monthOf(this.c.eco.day));
    const r = Math.random();
    this.weatherMood = 'clear';
    if ((season === 'autumn' || season === 'spring') && r < 0.3) { this.weatherMood = 'fog'; say(t('Thick fog this morning')); }
    else if (season === 'winter' && r < 0.18 && !this.calm) { this.weatherMood = 'blizzard'; this.c.weather.allDay('snow'); say(t('Blizzard! People stay at home and traffic is slow')); }
    else if (season === 'summer' && r < 0.22) { this.weatherMood = 'heat'; say(t('Heatwave! People look for shade, fountains and ice cream')); }
  }

  private truckBack(b: Building) {
    const { buildings, traffic } = this.c;
    const th = buildings.townHall(b.city);
    const done = () => { b.trucks = Math.max(0, b.trucks - 1); };
    if (b.removed || !th || b.access < 0) return done();
    const ok = traffic.spawn({
      kind: 'truck', from: th.access, to: b.access, fromPos: buildings.door(th), toPos: buildings.door(b),
      purpose: 'Returning to quarry', driverName: 'Truck driver', fromName: 'Town Hall', destName: 'Stone Quarry',
      onArrive: done, onFail: done,
    });
    if (!ok) done();
  }

  // ---------- fire & lightning ----------

  /** A thunderstorm now and then strikes on its own during natural rain. */
  private storm() {
    const { weather, buildings, effects } = this.c;
    if (this.calm || Math.random() < 0.45) return;
    // lightning strikes under a rain cloud — often a tall building attracts it
    const p = weather.wetPoint();
    if (!p) return;
    let { x, z } = p;
    const tall = buildings.list.filter((b) => Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z) < 4);
    if (tall.length && Math.random() < 0.5) { const b = pick(tall); x = b.mesh.position.x; z = b.mesh.position.z; }
    weather.strike(x, z);
    effects.puff(x, z, 0.4, 16, ['#fff3b0', '#ffd166', '#3a2a20']);
    this.lightning(x, z);
  }

  private updateFires(dt: number) {
    const { buildings, effects, traffic } = this.c;
    for (let i = this.sprays.length - 1; i >= 0; i--) {
      const sp = this.sprays[i];
      sp.t -= dt;
      if (dt > 0) effects.spray(sp.x, sp.z, sp.b.mesh.position.x, sp.b.mesh.position.z);
      if (Math.random() < dt * 2) sound.play('water', sp.b.mesh.position);
      if (sp.t <= 0 || sp.b.removed) { this.sprays.splice(i, 1); sp.done(); }
    }
    this.fireT -= dt;
    const emit = this.fireT <= 0;
    if (emit) this.fireT = 0.15;
    for (const b of [...buildings.list]) {
      if (b.fire <= 0) continue;
      b.fire -= dt * (this.c.weather.isWet(b.mesh.position.x, b.mesh.position.z) ? 0.5 : 1);
      if (emit) effects.fire(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.6);
      // flames jump to neighbours
      if (!this.calm && Math.random() < dt * 0.04) {
        const near = buildings.list.filter((o) => o !== b && o.fire <= 0 && o.kind !== 'townhall' && Math.hypot(o.x - b.x, o.z - b.z) < 2.6);
        if (near.length) {
          const o = near[Math.floor(Math.random() * near.length)];
          o.fire = 14;
          sound.play('fire', o.mesh.position);
          this.cityEvent(o.city, t('The fire spread to the {name}!', { name: t(BUILDINGS[o.kind].name) }));
        }
      }
      // firefighters
      if (!b.fireCrew) {
        const station = buildings.list.find((s) => s.kind === 'firestation' && s.city === b.city && s.built >= 1 && s.workers > 0 && Math.hypot(s.x - b.x, s.z - b.z) <= FIRE_RANGE);
        if (station) {
          b.fireCrew = true;
          const putOut = () => {
            b.fireCrew = false;
            if (b.removed || b.fire <= 0) return;
            b.fire = 0;
            b.fireCrew = false;
            effects.puff(b.mesh.position.x, b.mesh.position.z, 0.6, 14, ['#bfe3ff', '#ffffff', '#9aa3ab']);
            this.cityEvent(b.city, t('Firefighters put out the fire at the {name}', { name: t(BUILDINGS[b.kind].name) }));
          };
          const nozzle = buildings.door(b);
          // firefighters spray water for a few seconds before the flames die
          const spray = () => { this.sprays.push({ b, x: nozzle.x, z: nozzle.z, t: 3.5, done: putOut }); };
          sound.play('siren', b.mesh.position);
          // the firefighter on duty drives; the crew is back at the station when the fire is out
          const crew = this.takeDriver(station, 'Driving the fire truck');
          const back = () => this.releaseDriver(crew);
          const sent = station.access >= 0 && b.access >= 0 && traffic.spawn({
            kind: 'truck', from: station.access, to: b.access, color: new THREE.Color('#d9443b'), siren: true,
            purpose: 'Fire call', driverId: crew?.id, driverName: crew ? this.fullName(crew) : 'Firefighter', destName: BUILDINGS[b.kind].name,
            toPos: nozzle, onArrive: () => { spray(); setTimeout(back, 4000); }, onFail: () => { b.fireCrew = false; back(); },
          });
          if (!sent) back();
          if (!sent) setTimeout(putOut, 1500);
        }
      }
      if (b.fire <= 0) {
        this.cityEvent(b.city, t('{name} burnt down!', { name: t(BUILDINGS[b.kind].name) }));
        this.c.burnDown(b);
      }
    }
  }

  // ---------- happiness, homes, crashes ----------

  /** Content citizens stay and attract newcomers; unhappy ones leave. */
  private updateHappiness(city: City, own: Building[], r: DayReport, belongs: (f: Family) => boolean, say: (msg: string) => void) {
    const { pop } = this.c;
    const people = [...pop.citizens.values()].filter((c) => { const f = pop.families.get(c.family); return !!f && belongs(f); });
    const n = people.length;
    if (!n) { city.happiness += (65 - city.happiness) * 0.3; return; }
    const has = (kind: string) => own.some((b) => b.kind === kind && b.workers > 0);
    const parks = own.filter((b) => b.kind === 'park').length;
    const workforce = people.filter((c) => pop.canWork(c)).length;
    const employed = people.filter((c) => c.job >= 0).length;
    const unwell = people.filter((c) => c.hunger < 25 || c.health < 50).length / n;
    // every reason is written down so the player can see why people feel the way they do
    const mood: [string, number][] = [['Base mood', 50]];
    const add = (label: string, v: number) => { if (Math.abs(v) >= 0.05) mood.push([label, v]); };
    if (this.festival) add('Festival', 12);
    if (this.econFactor < 1) add('Economic crisis', -4); else if (this.econFactor > 1) add('Economic boom', 3);
    { let lm = 0; for (const id of city.laws ?? []) lm += LAWS.find((l) => l.id === id)?.mood ?? 0; if (lm) add('Laws', lm); }
    { let bm = 0; for (const a of BUDGET_AREAS) { const v = city.budget?.[a.id] ?? 100; bm += v < 100 ? -(100 - v) / 20 : (v - 100) / 40; } if (Math.abs(bm) >= 0.1) add('Town budget', bm); }
    { const famous = people.filter((c) => c.fame).length; if (famous) add('Famous citizens', Math.min(4, famous)); }
    {
      const lonely = people.filter((c) => c.age >= 65 && pop.members(pop.families.get(c.family)!).every((m) => m.age >= 65)).length;
      const seats = own.filter((b) => b.kind === 'eldercare' && b.workers > 0).length * 16;
      const cared = Math.min(lonely, seats);
      this.careBy.set(city.id, { lonely, cared });
      if (lonely > cared) add('Lonely old people', -Math.min(6, ((lonely - cared) / n) * 60));
      if (cared) add('Elder care home', Math.min(3, cared * 0.3));
      const fams = [...pop.families.values()].filter(belongs);
      const friends = fams.reduce((a, f) => a + (f.friends?.length ?? 0), 0) / 2, feuds = fams.filter((f) => f.feud && f.feud.until > this.c.eco.day).length / 2;
      if (friends) add('Friendly neighbours', Math.min(3, (friends / Math.max(1, fams.length)) * 12));
      if (feuds) add('Quarrels between neighbours', -Math.min(4, feuds * 1.2));
    }
    if ((city.parkingFee ?? 0) > 0) add('Parking fees', -(city.parkingFee ?? 0) * 1.2);
    if ((city.metroRiders ?? 0) > 0) add('Metro', Math.min(5, (city.metroRiders ?? 0) / 20));
    if ((city.thefts ?? 0) > 0) add('Thefts', -Math.min(8, (city.thefts ?? 0) * 1.5));
    if (city.railLink) add('Railway link', 4);
    add('Leisure, letters and sport', this.leisure.bonus(city.id, own));
    // parks, fountains and decorations near the homes
    add('Decorations and greenery', Math.min(8, (this.leisure.beautyOf.get(city.id) ?? 0) * 1.5));
    // people who went to a park or a square lately (from homes far away too) are happier for a few days
    add('Walks in parks and squares', Math.min(5, (people.filter((c) => (c.joy ?? -99) >= this.c.eco.day - 3).length / n) * 25));
    add('Air pollution', -Math.min(15, city.pollution * 4));
    // the faithful who prayed lately are calm and kind, and it rubs off on others; gamblers bring worry and quarrels
    const today = this.c.eco.day;
    const prayed = people.filter((c) => (c.prayed ?? -99) >= today - 3).length / n;
    const gamblers = people.filter((c) => (c.gambled ?? -99) >= today - 3).length / n;
    add('Faith and prayer', Math.min(8, prayed * 30));
    add('Gambling', -Math.min(10, gamblers * 45));
    add('Parks', Math.min(1, (parks * 80) / n) * 10);
    if (has('grocery') || has('market') || has('supermarket')) add('Food shops', 7);
    if (has('clothes')) add('Clothing store', 4);
    if (has('hospital')) add('Hospital', 7);
    if (has('school')) add('School', 5);
    if (has('police')) add('Police', 4);
    if (has('busdepot')) add('Buses', 3);
    add('Jobs', (workforce ? employed / workforce : 1) * 10 - 5);
    add('Hungry or sick people', -unwell * 30);
    add('Cold homes in winter', -(1 - (this.heated.get(city.id) ?? 1)) * 15);
    add('Garbage in the streets', -(this.dirty.get(city.id) ?? 0) * 14);
    add('Sewage', -(1 - (this.sanitation.get(city.id) ?? 1)) * 12);
    add('Food prices', city.priceFactor > 1.05 ? -(city.priceFactor - 1) * 12 : city.priceFactor < 0.95 ? 2 : 0);
    const flu = people.filter((c) => (c.flu ?? 0) > 0).length / n;
    add('Flu', -Math.min(10, flu * 30));
    if (this.weatherMood === 'heat') add('Heatwave', own.some((b) => b.kind === 'park' || b.kind === 'fountain') ? -1 : -5);
    if (this.weatherMood === 'blizzard') add('Blizzard', -3);
    const boost = this.moodBoost.get(city.id);
    if (boost && boost.until >= this.c.eco.day) add('Town hall decisions', boost.v);
    if (own.some((b) => b.kind === 'military' && b.workers > 0)) add('Army base', 3);
    add('Water', -(1 - city.water) * 20);
    add('Electricity', -(1 - city.powered) * 10);
    add('Taxes', -(city.taxRate - 0.25) * 80);
    // drivers grumble when they find nowhere to park, and when there is no gas station
    const cars = [...pop.families.values()].filter((f) => f.car && belongs(f)).length;
    add('No parking spaces', -Math.min(6, (this.parkFails.get(city.id) ?? 0) * 0.25));
    this.parkFails.set(city.id, 0);
    if (cars >= 3 && !own.some((b) => b.kind === 'gasstation')) add('No gas station', -Math.min(5, cars * 0.15));
    add('Crime', -(r.incidents.filter((i) => i.kind === 'murder').length * 6 + r.incidents.filter((i) => i.kind === 'fight').length * 2));
    city.mood = mood;
    let target = mood.reduce((a, [, v]) => a + v, 0);
    target = Math.max(0, Math.min(100, target));
    city.happiness += (target - city.happiness) * 0.4;
    if (city.happiness < 30 && Math.random() < 0.35) {
      const owners = new Set(this.c.buildings.list.map((b) => b.owner));
      const leaving = [...pop.families.values()].find((f) => belongs(f) && !owners.has(f.id));
      if (leaving && !this.relocate(leaving, city.id, false)) {
        for (const m of pop.members(leaving)) if (m.walker) this.c.walkers.dismiss(m.walker);
        pop.removeFamily(leaving);
        say(t('The unhappy {family} family left the city', { family: leaving.surname }));
      }
    }
  }

  /** Share of the city's homes within reach of a staffed police station. */
  policeCover(cityId: number) {
    const { buildings } = this.c;
    const stations = buildings.list.filter((b) => b.kind === 'police' && b.city === cityId && b.built >= 1 && b.workers > 0);
    const homes = buildings.list.filter((b) => b.kind === 'house' && b.city === cityId);
    if (!stations.length || !homes.length) return 0;
    const covered = homes.filter((h) => stations.some((s) => Math.hypot(s.x - h.x, s.z - h.z) <= POLICE_RANGE)).length;
    return covered / homes.length;
  }

  /** Every 4 years (or when the mayor is gone) the city elects a mayor — respected, educated adults stand a better chance. */
  /**
   * Elections every 4 years: a short campaign where candidates make promises, then the vote.
   * The winner's promise is checked a year later — kept promises please people, broken ones anger them.
   */
  private elect(city: City, belongs: (f: Family) => boolean, say: (msg: string) => void) {
    const { pop, eco, buildings } = this.c;
    const current = pop.citizens.get(city.mayor);
    const stillHere = current && belongs(pop.families.get(current.family)!);
    this.checkPromise(city, say);
    if (stillHere && eco.day - city.elected < DAYS_PER_YEAR * 4 && !city.campaign) return;
    const nameOf = (id: number) => { const c = pop.citizens.get(id); return c ? `${c.name} ${pop.families.get(c.family)?.surname ?? ''}`.trim() : '?'; };
    const own = buildings.list.filter((b) => b.city === city.id && b.built >= 1);
    const count = (k: string) => own.filter((b) => b.kind === k).length;
    const people = [...pop.citizens.values()].filter((c) => { const f = pop.families.get(c.family); return !!f && belongs(f); });
    const workforce = people.filter((c) => pop.canWork(c)).length;
    const jobless = workforce ? people.filter((c) => pop.canWork(c) && c.job < 0).length / workforce : 0;
    if (!city.campaign) {
      const candidates = people.filter((c) => c.age >= 28 && c.age < 72 && c.health > 40)
        .sort((a, b) => b.skill * 3 + b.edu * 2 - (a.skill * 3 + a.edu * 2) + (Math.random() - 0.5) * 4).slice(0, 3);
      if (!candidates.length) { city.mayor = -1; return; }
      const pool: PromiseKind[] = ['tax', 'park', 'hospital', 'school', 'jobs'].sort(() => Math.random() - 0.5) as PromiseKind[];
      city.campaign = { day: eco.day + 2, candidates: candidates.map((c, i) => ({ id: c.id, promise: pool[i] })) };
      say(t('Election campaign! {list}', { list: city.campaign.candidates.map((c) => `${nameOf(c.id)} — ${t(PROMISE_TEXT[c.promise])}`).join('; ') }));
      return;
    }
    if (eco.day < city.campaign.day) return;
    const appeal: Record<PromiseKind, number> = {
      tax: city.taxRate > 0.25 ? 2 : 0.6, park: count('park') ? 0.5 : 2, hospital: count('hospital') ? 0.4 : 2,
      school: count('school') ? 0.4 : 2, jobs: jobless > 0.1 ? 2 : 0.5,
    };
    const alive = city.campaign.candidates.filter((c) => pop.citizens.has(c.id));
    city.campaign = undefined;
    if (!alive.length) return;
    const score = (c: { id: number; promise: PromiseKind }) => {
      const p = pop.citizens.get(c.id)!;
      return p.skill + p.edu + appeal[c.promise] * 1.5 + Math.random() * 2;
    };
    const winner = alive.reduce((a, b) => (score(b) > score(a) ? b : a));
    const reelected = winner.id === city.mayor;
    city.mayor = winner.id;
    city.elected = eco.day;
    const base = winner.promise === 'tax' ? city.taxRate : winner.promise === 'jobs' ? jobless : count(winner.promise);
    city.promise = { kind: winner.promise, until: eco.day + DAYS_PER_YEAR, base };
    const name = nameOf(winner.id);
    say(`${reelected ? t('{name} was re-elected mayor', { name }) : t('{name} is the new mayor', { name })} · ${t(PROMISE_TEXT[winner.promise])}`);
  }

  private checkPromise(city: City, say: (msg: string) => void) {
    const p = city.promise;
    const { eco, buildings, pop } = this.c;
    if (!p || eco.day < p.until) return;
    city.promise = undefined;
    const count = (k: string) => buildings.list.filter((b) => b.kind === k && b.city === city.id && b.built >= 1).length;
    let kept: boolean;
    if (p.kind === 'tax') kept = city.taxRate <= p.base - 0.04;
    else if (p.kind === 'jobs') {
      const people = [...pop.citizens.values()].filter((c) => buildings.get(pop.families.get(c.family)?.home ?? -1)?.city === city.id && pop.canWork(c));
      kept = !people.length || people.filter((c) => c.job < 0).length / people.length < 0.08;
    } else kept = count(p.kind) > p.base;
    city.happiness = Math.max(0, Math.min(100, city.happiness + (kept ? 10 : -15)));
    say(kept ? t('The mayor kept the promise: {p}. People are pleased', { p: t(PROMISE_TEXT[p.kind]) }) : t('The mayor broke the promise: {p}. People are angry', { p: t(PROMISE_TEXT[p.kind]) }));
  }

  /** Smoke from factories, mines and power plants makes nearby homes sick. */
  private airQuality(city: City, say: (msg: string) => void) {
    const { buildings, pop } = this.c;
    const sources = buildings.list.filter((b) => POLLUTERS[b.kind] && b.city === city.id && b.built >= 1 && b.workers > 0);
    const homes = buildings.list.filter((b) => BUILDINGS[b.kind].units && b.city === city.id);
    let sum = 0, sick = 0;
    for (const h of homes) {
      let p = 0;
      for (const s of sources) {
        const d = Math.hypot(s.x - h.x, s.z - h.z);
        if (d < POLLUTION_RANGE) p += POLLUTERS[s.kind]! * (1 - d / POLLUTION_RANGE);
      }
      this.pollution.set(h.id, p);
      sum += p;
      if (p > 1.5) {
        for (const f of pop.families.values()) if (f.home === h.id) for (const c of pop.members(f)) { c.health = Math.max(1, c.health - Math.min(12, p * 2.5)); sick++; }
      }
    }
    city.pollution = homes.length ? sum / homes.length : 0;
    if (sick > 8 && Math.random() < 0.4) say(t('Smog makes people near the factories sick — plant trees, build clean energy or move homes away'));
  }

  /** Tourists come for nature, water, parks and happy towns; they pay for rooms and shop. */
  private tourism(city: City, own: Building[], say: (msg: string) => void) {
    const { terrain, map } = this.c;
    let total = 0;
    for (const h of own.filter((b) => b.kind === 'hotel')) {
      let water = 0;
      for (let z = h.z - 8; z <= h.z + 8; z += 2) for (let x = h.x - 8; x <= h.x + 8; x += 2) if (inBounds(x, z) && map.water[idx(x, z)]) water++;
      const nature = Math.min(1, terrain.treesNear(h.x, h.z, 10) / 40) + Math.min(1, water / 12);
      const parks = Math.min(1, own.filter((b) => b.kind === 'park').length * 0.25);
      // every town has something to see; nature, parks, mood, festivals and the railway add more
      const sights = Math.min(0.6, own.filter((b) => b.kind === 'stadium' || b.kind === 'cinema' || b.kind === 'fountain' || b.kind === 'statue').length * 0.15);
      const airport = own.some((b) => b.kind === 'airport' && b.workers > 0) ? 0.6 : 0;
      const attract = 0.6 + airport + nature + parks + sights + city.happiness / 100 + (this.festival ? 0.5 : 0) + (city.railLink ? 0.3 : 0);
      const staff = h.workers > 0 ? 0.35 + 0.65 * Math.min(1, h.workers / BUILDINGS.hotel.jobs) : 0;
      const guests = Math.max(staff > 0 ? 1 : 0, Math.round(TOURISM.rooms * Math.min(1, attract / 2.5) * staff));
      this.attraction.set(h.id, attract / 2.5);
      h.stored = guests;
      h.sales = (h.sales ?? 0) + guests * TOURISM.spend;
      this.tally(h, 'Guests', guests);
      // tourists also shop in town
      const shops = own.filter((b) => b.workers > 0 && (b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'market'));
      for (const s of shops) { s.sales = (s.sales ?? 0) + (guests * 3) / shops.length; this.tally(s, 'Sold to tourists', guests / shops.length); }
      total += guests;
    }
    if (total > 0 && city.tourists === 0) say(t('The first tourists arrived in the city!'));
    city.tourists = total;
  }

  /** Share of a building's workers with a degree. */
  private skilledShare(b: Building) {
    let n = 0, s = 0;
    for (const c of this.c.pop.citizens.values()) if (c.job === b.id) { n++; if (c.skill === 2) s++; }
    return n ? s / n : 0;
  }

  /** A city where a third of the adults hold a degree becomes a "smart city". */
  private smartCity(city: City, belongs: (f: Family) => boolean, say: (msg: string) => void) {
    const { pop } = this.c;
    const adults = [...pop.citizens.values()].filter((c) => { const f = pop.families.get(c.family); return !!f && belongs(f) && c.age >= 22; });
    const share = adults.length ? adults.filter((c) => c.skill === 2).length / adults.length : 0;
    const smart = adults.length >= 20 && share >= 0.3;
    if (smart && !city.smart) say(t('{city} became a Smart City! Businesses earn 10% more', { city: city.name }));
    city.smart = smart;
  }

  /** Rich families add a floor to their house (pays more property tax). */
  /**
   * The needs pyramid of a home. Level 1: water and food. Level 2: + electricity, bread from a bakery, a food shop, a school.
   * Level 3: + a park nearby, a hospital, a clothing store and a coffee cart. Returns the level the home deserves and what is missing for the next one.
   */
  homeNeeds(h: Building): { level: number; missing: string[] } {
    const { pop, buildings, eco } = this.c;
    const city = eco.cities.get(h.city);
    const fam = [...pop.families.values()].find((f) => f.home === h.id);
    if (!city || !fam) return { level: 1, missing: [] };
    const has = (k: string) => buildings.list.some((b) => b.kind === k && b.city === h.city && b.built >= 1 && (!BUILDINGS[b.kind].jobs || b.workers > 0));
    const tiers: [string, boolean][][] = [
      [['Clean water', (this.homeWater.get(h.id) ?? city.water) >= 0.95], ['Enough food', !pop.members(fam).some((c) => c.hunger < 30)]],
      [['Electricity', h.powered], ['Bread from a bakery', has('bakery')], ['A food shop', has('grocery') || has('market') || has('supermarket')], ['A school', has('school')]],
      [['A park in town', has('park') || has('bigpark') || has('playground')], ['A hospital', has('hospital')], ['A clothing store', has('clothes')], ['A coffee cart', has('kiosk')]],
    ];
    let level = 0;
    for (const tier of tiers) { if (tier.every(([, ok]) => ok)) level++; else break; }
    const next = tiers[Math.min(level, tiers.length - 1)];
    return { level: Math.max(1, level), missing: level >= tiers.length ? [] : next.filter(([, ok]) => !ok).map(([k]) => k) };
  }

  /** Homes whose needs are met grow a floor (and pay more property tax); rich families may add one themselves. */
  private upgradeHouses(cityId: number, say: (msg: string) => void) {
    const { pop, buildings, effects } = this.c;
    let grown = 0;
    for (const h of buildings.list) {
      if (h.kind !== 'house' || h.city !== cityId || h.built < 1 || h.level >= HOUSE_UPGRADE.maxLevel) continue;
      if (this.homeNeeds(h).level > h.level && Math.random() < 0.35) {
        buildings.setLevel(h, h.level + 1);
        effects.puff(h.mesh.position.x, h.mesh.position.z, 0.5, 12);
        grown++;
      }
    }
    if (grown) say(t('{n} homes grew a floor: their families have everything they need', { n: grown }));
    if (Math.random() > 0.4) return;
    for (const f of pop.families.values()) {
      const h = buildings.get(f.home);
      if (!h || h.kind !== 'house' || h.city !== cityId || h.level >= HOUSE_UPGRADE.maxLevel || f.money < HOUSE_UPGRADE.minSavings) continue;
      const cost = HOUSE_UPGRADE.money * h.level;
      if (f.money < cost + 800) continue;
      f.money -= cost;
      buildings.setLevel(h, h.level + 1);
      effects.puff(h.mesh.position.x, h.mesh.position.z, 0.5, 12);
      say(t('The {family} family added a floor to their house', { family: f.surname }));
      return;
    }
  }

  /** A crash at a junction: wrecked cars, smoke, and an ambulance from the hospital. */
  private crash(cityId: number) {
    const { net, buildings, traffic, effects } = this.c;
    const hall = buildings.townHall(cityId);
    if (!hall) return;
    const junctions: number[] = [];
    for (let z = hall.z - 24; z <= hall.z + 24; z++) for (let x = hall.x - 24; x <= hall.x + 24; x++) {
      if (!inBounds(x, z)) continue;
      const k = idx(x, z);
      if (net.type[k] && net.isIntersection(k)) junctions.push(k);
    }
    if (!junctions.length) return;
    const k = pick(junctions);
    const x = tileToWorld(k % N), z = tileToWorld((k / N) | 0);
    const wreck = effects.wreck(x, z);
    sound.play('demolish', { x, z });
    sound.play('siren', { x, z });
    const police = buildings.list.find((b) => b.kind === 'police' && b.city === cityId && b.built >= 1 && b.workers > 0 && b.access >= 0);
    if (police) {
      traffic.spawn({
        kind: 'car', from: police.access, to: k, color: new THREE.Color('#1f3f86'), fromPos: buildings.door(police), siren: true,
        purpose: 'Police patrol', driverName: 'Police officer', destName: 'Accident site', homeBuildingId: police.id,
        onArrive: () => {
          effects.clearWreck(wreck);
          this.cityEvent(police.city, t('The traffic police cleared the crash'));
          traffic.spawn({
            kind: 'car', from: k, to: police.access, color: new THREE.Color('#1f3f86'), toPos: buildings.door(police),
            purpose: 'Returning to station', driverName: 'Police officer', destName: 'Police station', homeBuildingId: police.id,
          });
        },
      });
    }
    const hospital = buildings.list.find((b) => b.kind === 'hospital' && b.city === cityId && b.built >= 1 && b.access >= 0);
    if (hospital) {
      traffic.spawn({
        kind: 'car', from: hospital.access, to: k, color: new THREE.Color('#ffffff'), fromPos: buildings.door(hospital), siren: true,
        purpose: 'Emergency response', driverName: 'Paramedic', destName: 'Accident site', homeBuildingId: hospital.id,
        onArrive: () => {
          // the injured driver is carried to the ambulance on a stretcher
          this.c.walkers.walk(3, 1, { points: [{ x: x + 0.25, z: z + 0.25 }, { x, z }] }, 'stretcher');
          traffic.spawn({
            kind: 'car', from: k, to: hospital.access, color: new THREE.Color('#ffffff'), toPos: buildings.door(hospital), siren: true,
            purpose: 'Returning to hospital', driverName: 'Paramedic', destName: 'Hospital', homeBuildingId: hospital.id,
          });
        },
      });
    }
  }

  /** Lightning: kills people and animals right there, sets buildings on fire, burns trees. */
  lightning(x: number, z: number) {
    const { pop, walkers, buildings, terrain, effects } = this.c;
    const tx = worldToTile(x), tz = worldToTile(z);
    let killed = 0;
    for (const c of [...pop.citizens.values()]) {
      const w = c.walker;
      if (!w || w.leaving || Math.hypot(w.x - x, w.z - z) > 0.7) continue;
      walkers.dismiss(w);
      const f = pop.families.get(c.family);
      this.cityEvent(f ? buildings.get(f.home)?.city : undefined, t('{name} died ({cause})', { name: `${c.name} ${f?.surname ?? ''}`, cause: t('lightning') }));
      const cid = (f && buildings.get(f.home)?.city) ?? -1;
      const cemetery = buildings.list.find((b) => b.kind === 'cemetery' && b.city === cid && b.built >= 1 && (b.graves?.length ?? 0) < MAX_GRAVES_PER_CEMETERY * b.level);
      if (cemetery && f && f.money >= GRAVE_COST) {
        f.money -= GRAVE_COST;
        const own = this.c.eco.cities.get(cid);
        if (own) this.c.eco.add(own, 'money', GRAVE_COST, 'Grave plots');
        buildings.addGrave(cemetery, { name: c.name, family: f?.surname ?? '', age: Math.floor(c.age), day: this.c.eco.day });
        this.cityEvent(cid, t('{name} was laid to rest at the cemetery (${cost})', { name: `${c.name} ${f?.surname ?? ''}`.trim(), cost: GRAVE_COST }));
      }
      pop.removeCitizen(c);
      killed++;
    }
    if (inBounds(tx, tz)) {
      const k = idx(tx, tz);
      const b = buildings.at(k);
      if (b && b.kind !== 'townhall') { b.fire = Math.max(b.fire, 14); this.cityEvent(b.city, t('Lightning set the {name} on fire!', { name: t(BUILDINGS[b.kind].name) })); }
      if (terrain.hasTree(k)) { terrain.chop(k); effects.puff(tileToWorld(tx), tileToWorld(tz), 0.3, 12, ['#ff7a1a', '#3a2a20', '#ffd166']); }
    }
    if (killed) pop.assign(buildings);
    return killed;
  }

  // ---------- daily routine ----------

  private schedule() {
    const { pop, eco } = this.c;
    const tod = eco.timeOfDay;
    for (const c of pop.citizens.values()) {
      if (c.state === 'home') {
        if (c.night) {
          c.activity = tod > 0.32 && tod < 0.62 ? 'Sleeping after the night shift' : 'At home';
          if (tod < c.leaveAt || tod > 0.97) continue;
        } else {
          c.activity = tod < 0.22 || tod > 0.9 ? 'Sleeping' : tod < 0.3 ? 'Having breakfast' : tod > 0.74 && tod < 0.82 ? 'Having dinner with the family' : 'At home';
          if ((c.flu ?? 0) > 0) { c.activity = 'Sick with flu — staying in bed'; continue; }
          if (this.weatherMood === 'blizzard' && c.errand) continue;
          if (tod < c.leaveAt || tod >= c.returnAt - 0.03 || c.age < 3) continue;
        }
        const dest = this.destination(c);
        c.leaveAt = 2;
        if (dest) this.goTo(c, dest);
      } else if (c.state === 'away' && c.job >= 0 && c.at === c.job && !DRIVING.has(c.activity) && (c.activity === 'At work' || c.activity === 'Lunch break') && !c.night) {
        // lunch break around noon
        c.activity = tod > 0.48 && tod < 0.53 ? 'Lunch break' : 'At work';
        if (tod >= c.returnAt || tod > 0.92) this.goHome(c);
      } else if (c.state === 'away' && !DRIVING.has(c.activity) && (c.night ? tod >= c.returnAt && tod < 0.5 : tod >= c.returnAt || tod > 0.92)) {
        this.goHome(c);
      }
    }
  }

  private destination(c: Citizen): Building | undefined {
    const { buildings } = this.c;
    if (c.outing !== undefined) {
      const b = buildings.get(c.outing);
      if (b && !b.removed) return b;
      c.outing = undefined;
    }
    if (c.job >= 0) return buildings.get(c.job);
    if (c.school >= 0) return buildings.get(c.school);
    if (c.errand || (c.health < 55 && c.job < 0 && c.age >= 3)) {
      const home = buildings.get(this.family(c)?.home ?? -1);
      // feeling unwell: off to the doctor first
      if (c.health < 55) {
        const clinic = buildings.list.find((b) => b.kind === 'hospital' && b.built >= 1 && b.workers > 0 && (!home || b.city === home.city));
        if (clinic) return clinic;
      }
      const shops = buildings.list.filter((b) => (!home || b.city === home.city) && b.built >= 1 && b.workers > 0 && SHOP_PRICE[b.kind]);
      if (this.festival) {
        const parks = buildings.list.filter((b) => (!home || b.city === home.city) && b.built >= 1 && (b.kind === 'park' || b.kind === 'townhall'));
        if (parks.length && Math.random() < 0.6) return pick(parks);
      }
      if (shops.length && Math.random() < 0.6) return pick(shops);
      const spots = buildings.list.filter((b) => (!home || b.city === home.city) && b.built >= 1 && (b.kind === 'townhall' || b.kind === 'park' || b.kind === 'market' || b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'bank' || b.kind === 'orchard' || b.kind === 'parking' || b.kind === 'weddinghall' || b.kind === 'school' || b.kind === 'kiosk' || b.kind === 'fountain' || b.kind === 'statue'));
      return spots.length ? pick(spots) : undefined;
    }
    return undefined;
  }

  private family(c: Citizen) { return this.c.pop.families.get(c.family); }
  private alive(c: Citizen) { return this.c.pop.citizens.get(c.id) === c; }

  private goTo(c: Citizen, dest: Building) {
    const { buildings, traffic } = this.c;
    const f = this.family(c);
    const home = f && buildings.get(f.home);
    if (!f || !home) return;
    c.state = 'travel';
    c.drove = false;
    const purpose = c.job === dest.id ? 'work' : c.school === dest.id ? 'school' : 'errand';
    const arrive = () => this.arrive(c, dest);

    if (f.car?.at === 'home' && c.age >= 18 && home.access >= 0 && f.car.fuel > FUEL.empty) {
      const spot = this.findSpot(dest);
      if (!spot) { c.noParking = this.c.eco.day; this.parkFails.set(home.city, (this.parkFails.get(home.city) ?? 0) + 1); }
      if (spot && traffic.canRoute(home.access, spot.lot.access)) {
        const key = `${spot.lot.id}:${spot.slot}`;
        this.spots.set(key, f.id);
        const car = f.car;
        car.at = 'moving';
        car.fuel = Math.max(0, car.fuel - (6 + Math.random() * 4));
        const slotPos = this.lotPos(spot.lot, spot.slot);
        const ok = traffic.spawn({
          kind: 'car', from: home.access, to: spot.lot.access, color: colorOf(car.color),
          fromPos: buildings.slot(home, 0), toPos: slotPos,
          driverId: c.id,
          driverName: `${c.name} ${f.surname}`,
          purpose: purpose === 'work' ? 'Driving to work' : purpose === 'school' ? 'Driving to school' : 'Driving',
          fromName: BUILDINGS[home.kind].name,
          destName: BUILDINGS[dest.kind].name,
          destBuildingId: dest.id,
          homeBuildingId: home.id,
          onArrive: () => {
            car.at = 'away'; car.lot = spot.lot.id; car.slot = spot.slot;
            // a public car park charges a small fee
            if (spot.lot.kind === 'parking') this.charge(c, spot.lot.city, SERVICE_FEE.parking);
            // the multi-storey car park: the ticket goes to its till (the attendant is paid from it), or to the town hall when nobody works there
            if (spot.lot.kind === 'garage') {
              const fee = Math.max(1, this.c.eco.cities.get(spot.lot.city)?.parkingFee ?? 0);
              if (f.money >= fee) {
                f.money -= fee;
                if (spot.lot.workers > 0) { spot.lot.sales = (spot.lot.sales ?? 0) + fee; this.countSale(spot.lot, 'Cars parked'); }
                else this.c.eco.add(this.c.eco.cities.get(spot.lot.city)!, 'money', fee, 'Car park fees');
              }
            }
            if (!this.alive(c)) return;
            c.drove = true;
            c.activity = purpose === 'work' ? 'Walking to work' : 'Out for a walk';
            this.walk(c, slotPos, tileAt(slotPos), dest, arrive);
          },
          onFail: () => {
            this.spots.delete(key);
            car.at = 'home';
            if (this.alive(c)) this.walk(c, buildings.door(home), buildings.frontTile(home), dest, arrive);
          },
        });
        if (ok) {
          c.activity = purpose === 'work' ? 'Driving to work' : 'Driving';
          return;
        }
        this.spots.delete(key);
        car.at = 'home';
      }
    }
    if (this.metroRide(c, home, dest, arrive)) return;
    const transit = this.findTransitTrip(home, dest);
    if (transit) {
      c.activity = 'Walking to bus stop';
      this.walk(c, buildings.door(home), buildings.frontTile(home), transit.pickup, () => {
        if (!this.alive(c)) return;
        c.state = 'travel'; // waiting is part of the trip (the daily schedule must not pull them away)
        c.at = transit.pickup.id;
        c.activity = 'Waiting for bus';
        this.standAt(c, transit.pickup);
        this.addWaiter({ citizenId: c.id, pickupStopId: transit.pickup.id, dropStopId: transit.dropoff.id, finalDestId: dest.id, waitTimer: 0 });
      });
      return;
    }
    c.activity = purpose === 'work' ? 'Walking to work' : purpose === 'school' ? 'Walking to school' : 'Out for a walk';
    this.walk(c, buildings.door(home), buildings.frontTile(home), dest, arrive, this.carryFor(c));
  }

  private arrive(c: Citizen, b: Building) {
    if (!this.alive(c)) return;
    if (b.removed) { this.teleportHome(c); return; }
    c.state = 'away';
    c.at = b.id;
    if (c.outing === b.id) {
      c.outing = undefined;
      this.leisure.stay(c, b, c.returnAt);
      return;
    }
    const work = c.job === b.id ? BUILDINGS[b.kind].work : 'indoor';
    c.activity = c.job === b.id ? (b.kind === 'fishery' ? 'Fishing on the boat' : 'At work') : c.school === b.id ? 'At school' : 'Visiting';
    if (c.job !== b.id && c.school !== b.id) this.shop(c, b);
    if (b.kind === 'hospital' && c.job !== b.id) {
      // a visit to the doctor: paid to the city on the spot
      this.charge(c, b.city, SERVICE_FEE.hospital);
      c.health = Math.min(100, c.health + 30);
      c.activity = 'At the doctor';
      this.c.pop.note(c, 'Saw a doctor at the hospital');
    }
    if (work === 'woodcutter') this.woodcutterLoop(c, b);
    else if (work === 'farmer') this.farmLoop(c, b);
    else if (work === 'builder') this.builderLoop(c, b);
    else if (work === 'miner') this.mineLoop(c, b);
    else if (work === 'forester') this.foresterLoop(c, b);
    else if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
  }

  private goHome(c: Citizen) {
    const { buildings, traffic } = this.c;
    const f = this.family(c);
    const home = f && buildings.get(f.home);
    if (!f || !home) return;
    const at = buildings.get(c.at);
    if (c.job >= 0 && c.at === c.job && at) this.payShift(c, at);
    c.state = 'travel';
    c.activity = 'Going home';
    c.outing = undefined;
    const done = () => {
      if (!this.alive(c)) return;
      c.state = 'home';
      c.at = home.id;
      c.activity = 'At home';
      if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
    };
    const outside = c.walker && !c.walker.leaving;
    const from = outside ? { x: c.walker!.x, z: c.walker!.z } : at ? buildings.door(at) : null;
    if (!from) return this.teleportHome(c);
    const fromTile = outside ? tileAt(from) : buildings.frontTile(at!);
    if (c.walker) c.walker.carry = 'none';

    const car = f.car;
    if (c.drove && car?.at === 'away' && car.lot !== undefined) {
      const lot = buildings.get(car.lot);
      if (lot && lot.access >= 0 && home.access >= 0) {
        const slotPos = this.lotPos(lot, car.slot!);
        const key = `${lot.id}:${car.slot}`;
        this.walk(c, from, fromTile, null, () => {
          car.fuel = Math.max(0, car.fuel - (6 + Math.random() * 4));
          const station = car.fuel < FUEL.low ? this.gasStation(lot) : undefined;
          const driveHome = (fromAccess: number, fromPos: Point) => traffic.spawn({
            kind: 'car', from: fromAccess, to: home.access, color: colorOf(car.color),
            fromPos, toPos: buildings.slot(home, 0),
            driverId: c.id,
            driverName: `${c.name} ${f.surname}`,
            purpose: 'Driving home',
            fromName: lot ? BUILDINGS[lot.kind].name : 'Parking',
            destName: BUILDINGS[home.kind].name,
            destBuildingId: home.id,
            homeBuildingId: home.id,
            onArrive: () => { car.at = 'home'; done(); },
            onFail: () => { car.at = 'home'; done(); },
          });
          const ok = station
            ? traffic.spawn({
              kind: 'car', from: lot.access, to: station.access, color: colorOf(car.color), fromPos: slotPos, toPos: buildings.door(station),
              driverId: c.id,
              driverName: `${c.name} ${f.surname}`,
              purpose: 'Refuelling',
              fromName: lot ? BUILDINGS[lot.kind].name : 'Parking',
              destName: BUILDINGS[station.kind].name,
              destBuildingId: station.id,
              homeBuildingId: home.id,
              onArrive: () => {
                const cost = (100 - car.fuel) * FUEL.price;
                f.money -= cost;
                station.sales = (station.sales ?? 0) + cost;
                this.tally(station, 'Fuel (litres)', Math.round(100 - car.fuel));
                this.tally(station, 'Cars filled up');
                car.fuel = 100;
                c.activity = 'Refuelling';
                if (!driveHome(station.access, buildings.door(station))) { car.at = 'home'; done(); }
              },
              onFail: () => { car.at = 'home'; done(); },
            })
            : driveHome(lot.access, slotPos);
          this.spots.delete(key);
          car.lot = undefined;
          if (ok) {
            car.at = 'moving';
            c.activity = 'Driving home';
            if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
          } else {
            car.at = 'home';
            this.walk(c, slotPos, tileAt(slotPos), home, done);
          }
        }, 'none', slotPos);
        c.drove = false;
        return;
      }
      car.at = 'home';
      car.lot = undefined;
    }
    c.drove = false;
    if (c.job >= 0 && Math.random() < 0.2) {
      const shop = this.c.buildings.list.find((b) => SHOP_PRICE[b.kind] && b.city === home.city && b.built >= 1 && b.workers > 0 && dist(b, home) < 14);
      if (shop) {
        c.activity = 'Going shopping';
        this.walk(c, from, fromTile, shop, () => {
          if (!this.alive(c)) return;
          this.shop(c, shop);
          this.walk(c, buildings.door(shop), buildings.frontTile(shop), home, done);
        });
        return;
      }
    }
    const atBuilding = !outside && at ? at : null;
    if (atBuilding && this.metroRide(c, atBuilding, home, done)) return;
    if (atBuilding) {
      const transit = this.findTransitTrip(atBuilding, home);
      if (transit) {
        c.activity = 'Walking to bus stop';
        this.walk(c, buildings.door(atBuilding), buildings.frontTile(atBuilding), transit.pickup, () => {
          if (!this.alive(c)) return;
          c.state = 'travel'; // waiting is part of the trip (the daily schedule must not pull them away)
          c.at = transit.pickup.id;
          c.activity = 'Waiting for bus';
          this.standAt(c, transit.pickup);
          this.addWaiter({ citizenId: c.id, pickupStopId: transit.pickup.id, dropStopId: transit.dropoff.id, finalDestId: home.id, waitTimer: 0 });
        });
        return;
      }
    }
    this.walk(c, from, fromTile, home, done, this.carryFor(c));
  }

  /** Nearest staffed gas station reachable from this building. */
  private gasStation(from: Building) {
    const { buildings, traffic } = this.c;
    return buildings.list
      .filter((b) => b.kind === 'gasstation' && b.city === from.city && b.built >= 1 && b.workers > 0 && b.access >= 0)
      .sort((a, b) => dist(a, from) - dist(b, from))
      .find((b) => traffic.canRoute(from.access, b.access));
  }

  /** A visit to a shop: the family pays, the shop records the sale. */
  private shop(c: Citizen, b: Building) {
    const range = SHOP_PRICE[b.kind];
    const f = this.family(c);
    if (!range || !f || b.workers <= 0 || f.money < 20) return;
    const food = b.kind === 'grocery' || b.kind === 'market' || b.kind === 'bakery' || b.kind === 'supermarket';
    const price = food ? this.c.eco.cities.get(b.city)?.priceFactor ?? 1 : this.priceLevel(b.city);
    let spend = Math.round((range[0] + Math.random() * (range[1] - range[0])) * (this.festival ? 1.5 : 1) * price * this.econFactor);
    const town = this.c.eco.cities.get(b.city);
    // clothes from the factory sell best; raw cotton a little; furniture sells in the markets
    if ((b.kind === 'casino' || b.kind === 'teahouse') && town?.laws?.includes('quiet')) spend = Math.round(spend * 0.8);
    let item = food ? 'Food baskets' : b.kind === 'pharmacy' ? 'Medicine' : b.kind === 'clothes' ? 'Clothes' : 'Purchases';
    if (b.kind === 'dairyshop') {
      // milk, yogurt and cheese: the milk of the ranches becomes the family's food
      if (!town || town.milk < 1) return;
      const n = Math.min(town.milk, 3);
      this.c.eco.add(town, 'milk', -n, 'Dairy shops');
      this.c.eco.add(town, 'food', n * CHAIN2.foodPerMilk, 'Milk products (dairy shops)');
      town.foodMade += n * CHAIN2.foodPerMilk;
      spend = Math.round(spend * (town.priceFactor ?? 1));
      item = pick(['Milk', 'Yogurt', 'Cheese', 'Butter']);
      c.hunger = Math.min(100, c.hunger + 10);
    }
    if (b.kind === 'clothes' && town && town.garments >= 1) { this.c.eco.add(town, 'garments', -1, 'Clothing stores'); spend = Math.round(spend * 1.8); item = 'Factory clothes'; }
    else if (b.kind === 'clothes' && town && town.cotton >= 1) { this.c.eco.add(town, 'cotton', -1, 'Clothing stores'); spend = Math.round(spend * 1.3); item = 'Cotton cloth'; }
    if ((b.kind === 'market' || b.kind === 'supermarket') && town && town.furniture >= 1 && f.money > 80 && Math.random() < 0.25) { this.c.eco.add(town, 'furniture', -1, 'Sold in the markets'); spend += 30; this.tally(b, 'Furniture'); }
    this.tally(b, item);
    // a pharmacy sells medicine: the sick feel better
    if (b.kind === 'pharmacy') { c.health = Math.min(100, c.health + 15); if (c.flu) c.flu = Math.max(0, c.flu - 1); }
    f.money -= spend;
    b.sales = (b.sales ?? 0) + spend;
    // the business tax on the sale reaches the town hall right away
    const city = this.c.eco.cities.get(b.city);
    if (city) {
      const tax = spend * city.taxRate * 0.8;
      b.salesTaxed = (b.salesTaxed ?? 0) + spend;
      this.cash(b.city, tax, 'businessTax');
    }
    c.activity = 'Shopping';
  }

  /** Bicycles ready at the town's working bicycle factories. */
  private bikeStock(cityId: number) {
    return this.c.buildings.list.reduce((a, b) => a + (b.kind === 'bikefactory' && b.city === cityId && b.built >= 1 && b.workers > 0 ? Math.floor(b.stored) : 0), 0);
  }

  /** Bikes sold to families leave the factories (the town is paid); old bikes bought back go into their stock. */
  private bikeSales(city: City, bought: number, sold: number, say: (msg: string) => void) {
    const { buildings, eco } = this.c;
    const shops = buildings.list.filter((b) => b.kind === 'bikefactory' && b.city === city.id && b.built >= 1);
    let left = bought;
    for (const s of shops) { const take = Math.min(left, Math.floor(s.stored)); s.stored -= take; s.sales = (s.sales ?? 0) + take * BIKE.price; this.tally(s, 'Bicycles', take); left -= take; }
    if (shops[0]) shops[0].stored = Math.min(BIKE.max, shops[0].stored + sold);
    if (bought) eco.add(city, 'money', bought * BIKE.price, 'Bicycle sales');
    if (sold) eco.add(city, 'money', -sold * BIKE.buyBack, 'Old bicycles bought back');
    if (bought) say(t('{n} families bought bicycles', { n: bought }));
  }

  /** Cars waiting for buyers at the city's car markets. */
  private carStock(cityId: number) {
    return this.c.buildings.list.reduce((a, b) => a + (b.kind === 'carmarket' && b.city === cityId && b.built >= 1 && b.workers > 0 ? Math.floor(b.stored) : 0), 0);
  }

  /** Remove sold cars from the markets; markets without a local factory import a car now and then. */
  private sellCars(cityId: number, sold: number) {
    const { buildings } = this.c;
    const markets = buildings.list.filter((b) => b.kind === 'carmarket' && b.city === cityId && b.built >= 1);
    for (const m of markets) {
      const take = Math.min(sold, Math.floor(m.stored));
      m.stored -= take;
      this.tally(m, 'Cars', take);
      sold -= take;
    }
    const factory = buildings.list.some((b) => b.kind === 'carfactory' && b.city === cityId && b.built >= 1);
    if (!factory) for (const m of markets) if (m.stored < 3 && Math.random() < 0.5) m.stored += 1;
  }

  /** Buses run their transit routes; police cars patrol their district. */
  private dispatchServices() {
    const { buildings, net } = this.c;
    for (const h of buildings.list) if (h.kind === 'hotel' && h.stored > 0 && Math.random() < Math.min(0.8, h.stored / 20)) this.touristStroll(h);
    for (const b of buildings.list) {
      if (b.built < 1 || b.workers <= 0 || b.access < 0) continue;
      if (b.kind === 'landfill' || b.kind === 'recycling') {
        this.garbageRound(b);
      } else if (b.kind === 'busdepot') {
        this.dispatchBusFleet(b);
      } else if (b.kind === 'police') {
        // a patrol car needs an officer on shift; two cars cover different halves of the district
        const active = this.fleet.get(b.id) ?? 0;
        if (active >= 2) continue;
        const officer = this.onDuty(b)[0];
        if (!officer) continue;
        const sector = this.policeSector.get(b.id) === 0 ? 1 : 0;
        const all: number[] = [], mine: number[] = [];
        for (let z = b.z - POLICE_RANGE; z <= b.z + POLICE_RANGE; z++) for (let x = b.x - POLICE_RANGE; x <= b.x + POLICE_RANGE; x++) {
          if (!inBounds(x, z) || !net.type[idx(x, z)] || net.isIntersection(idx(x, z)) || net.isRing(idx(x, z)) || Math.hypot(x - b.x, z - b.z) > POLICE_RANGE) continue;
          all.push(idx(x, z));
          if ((Math.atan2(z - b.z, x - b.x) >= 0 ? 0 : 1) === sector) mine.push(idx(x, z));
        }
        if (!all.length) continue;
        this.policeSector.set(b.id, sector);
        this.fleet.set(b.id, active + 1);
        officer.activity = 'On patrol';
        this.policePatrol(b, b.access, mine.length >= 3 ? mine : all, 4 + Math.floor(Math.random() * 3), officer, -1);
      }
    }
  }

  /** A tourist walks from the hotel to a park, a shop or the town hall and back. */
  private touristStroll(hotel: Building) {
    const { buildings, walkers } = this.c;
    const sights = buildings.list.filter((b) => b.city === hotel.city && b.built >= 1 && dist(b, hotel) < 16 && (b.kind === 'park' || b.kind === 'townhall' || SHOP_PRICE[b.kind]));
    if (!sights.length) return;
    const to = pick(sights);
    const from = buildings.door(hotel), target = buildings.door(to);
    const path = pedPath(this.graph, this.graph.node(buildings.frontTile(hotel), from), this.graph.node(buildings.frontTile(to), target));
    if (!path) return;
    walkers.walk(Math.floor(Math.random() * 8), 1, { points: this.graph.points(path, from, target) }, 'none');
  }

  /** One leg of a patrol. `prev` is the tile the car came from, so the next leg keeps going forward instead of turning back. */
  private policePatrol(home: Building, at: number, stops: number[], hops: number, officer: Citizen, prev: number): void {
    const { traffic, buildings, pop } = this.c;
    const finish = () => {
      this.fleet.set(home.id, Math.max(0, (this.fleet.get(home.id) ?? 1) - 1));
      if (officer.activity === 'On patrol') officer.activity = 'At work';
    };
    if (home.removed || !this.alive(officer)) return finish();
    // the shift is over: drive straight back to the station
    if (hops > 0 && (officer.state !== 'away' || this.shiftOver(officer))) hops = 0;
    let to = hops <= 0 ? home.access : stops[Math.floor(Math.random() * stops.length)];
    let path = traffic.route(at, to);
    if (hops > 0) {
      // pick a street ahead: the first step must not lead back where the car came from
      for (let tries = 0; tries < 8 && (!path || path.length < 4 || path[1] === prev); tries++) {
        to = stops[Math.floor(Math.random() * stops.length)];
        path = traffic.route(at, to);
      }
    }
    if (to === at && hops > 0) return this.policePatrol(home, at, stops, hops - 1, officer, prev);
    const last = path && path.length >= 2 ? path[path.length - 2] : -1;
    const ok = traffic.spawn({
      kind: 'car', from: at, to, color: new THREE.Color('#1f3f86'),
      fromPos: at === home.access ? buildings.door(home) : undefined,
      toPos: hops <= 0 ? buildings.door(home) : undefined,
      purpose: 'Police patrol route',
      driverId: officer.id,
      driverName: `${officer.name} ${pop.families.get(officer.family)?.surname ?? ''}`.trim(),
      fromName: BUILDINGS[home.kind].name,
      destName: hops <= 0 ? BUILDINGS[home.kind].name : 'City street',
      homeBuildingId: home.id,
      onArrive: () => { if (hops <= 0) finish(); else this.policePatrol(home, to, stops, hops - 1, officer, last); },
      onFail: finish,
    });
    if (!ok) finish();
  }

  /** Public query methods for vehicle inspection & passenger status. */
  busStateForVehicle(vehicleId: number): ActiveBusState | undefined {
    return this.busFleet.get(vehicleId);
  }

  busPassengersForVehicle(vehicleId: number): BusPassenger[] {
    return this.busFleet.get(vehicleId)?.passengers ?? [];
  }

  busWaitersAtStop(stopId: number): BusWaiter[] {
    return this.busWaiters.get(stopId) ?? [];
  }

  passengerBus(citizenId: number): ActiveBusState | undefined {
    for (const b of this.busFleet.values()) {
      if (b.passengers.some((p) => p.citizenId === citizenId)) return b;
    }
    return undefined;
  }

  passengerWaiter(citizenId: number): BusWaiter | undefined {
    for (const list of this.busWaiters.values()) {
      const w = list.find((x) => x.citizenId === citizenId);
      if (w) return w;
    }
    return undefined;
  }

  /** Calculate an ordered cycle of bus stops for a bus depot. */
  getRouteStops(depot: Building): number[] {
    const { buildings, traffic } = this.c;
    const candidates = buildings.list.filter((b) => {
      if (b.city !== depot.city || b.built < 1 || b.access < 0 || b.id === depot.id) return false;
      // buses stop only at real bus stops (and train stations)
      return b.kind === 'busstop' || b.kind === 'trainstation';
    });

    // a route drawn by the player: its stops in that order (those still standing and reachable)
    if (depot.route && depot.route.length >= 2) {
      const own = depot.route.filter((id) => { const s = buildings.get(id); return !!s && !s.removed && s.access >= 0 && traffic.canRoute(depot.access, s.access); });
      if (own.length >= 2) return [depot.id, ...own];
    }
    const cached = this.routeCache.get(depot.id);
    if (cached && cached.t > performance.now() - 8000) return cached.stops;
    const stops: number[] = [depot.id];
    let cur = depot;
    const pool = new Set(candidates);

    while (pool.size > 0 && stops.length < 12) {
      let best: Building | null = null;
      let bestD = Infinity;
      for (const cand of pool) {
        const d = dist(cur, cand);
        const weight = (cand.kind === 'busstop' || cand.kind === 'trainstation') ? 0.7 : 1.0;
        const weightedD = d * weight;
        if (weightedD < bestD && traffic.canRoute(cur.access, cand.access)) {
          bestD = weightedD;
          best = cand;
        }
      }
      if (!best) break;
      stops.push(best.id);
      pool.delete(best);
      cur = best;
    }
    const route = stops.length >= 3 ? stops : [];
    this.routeCache.set(depot.id, { t: performance.now(), stops: route });
    return route;
  }

  /** Staff of a building who are at work right now (on their shift, not out driving). */
  private onDuty(b: Building) {
    const out: Citizen[] = [];
    for (const c of this.c.pop.citizens.values()) if (c.job === b.id && c.state === 'away' && c.at === b.id && !DRIVING.has(c.activity)) out.push(c);
    return out;
  }

  isShiftOver(c: Citizen) { return this.shiftOver(c); }

  /** Staff on duty at a building (public, for leisure and service code). */
  staffOnDuty(b: Building) { return this.onDuty(b); }

  /** Take a worker off their post to drive a vehicle for the building; undefined if nobody is on shift. */
  takeDriver(b: Building, activity = 'Driving a truck'): Citizen | undefined {
    const c = this.onDuty(b)[0];
    if (c) c.activity = activity;
    return c;
  }

  /** The driver is back at work. */
  releaseDriver(c?: Citizen) {
    if (c && DRIVING.has(c.activity)) c.activity = c.state === 'away' ? 'At work' : c.activity;
  }

  /** Name of a citizen with the family name. */
  fullName(c: Citizen) { return `${c.name} ${this.c.pop.families.get(c.family)?.surname ?? ''}`.trim(); }

  /**
   * Send someone who is at home out to a spot (no building) until `until`, e.g. skating on the frozen lake.
   * They walk back home when the time is up.
   */
  sendToPoint(c: Citizen, p: Point, until: number, activity: string, arrived: (c: Citizen) => void) {
    const { buildings } = this.c;
    const home = buildings.get(this.family(c)?.home ?? -1);
    if (!home || c.state !== 'home') return false;
    c.state = 'away';
    c.at = home.id;
    c.leaveAt = 2;
    c.returnAt = until;
    c.activity = activity;
    this.walk(c, buildings.door(home), buildings.frontTile(home), null, () => { if (this.alive(c) && c.state === 'away') arrived(c); }, 'none', p);
    return true;
  }

  /** Has this worker's shift ended? */
  private shiftOver(c: Citizen) {
    const tod = this.c.eco.timeOfDay;
    return c.night ? tod >= c.returnAt && tod < 0.5 : tod >= c.returnAt;
  }

  /** Launch buses from depot to run the transit route continuously. */
  private dispatchBusFleet(depot: Building) {
    // every bus has its own driver: a depot worker who is on shift right now (at most BUS.perDepot buses)
    const active = [...this.busFleet.values()].filter((b) => b.depotId === depot.id);
    if (active.length >= BUS.perDepot) return;
    const drivers = this.onDuty(depot);
    if (!drivers.length) return;
    let stops = this.getRouteStops(depot);
    if (stops.length < 2) return;
    // the second bus runs the loop the other way round
    if (active.some((b) => b.stops[1] === stops[1])) stops = [stops[0], ...stops.slice(1).reverse()];
    this.runBusLeg(depot, stops, 0, [], drivers[0].id);
  }

  /** Drive one segment of the route from stops[fromIdx] to stops[nextIdx]. */
  private runBusLeg(depot: Building, stops: number[], fromIdx: number, passengers: BusPassenger[], driverId: number): void {
    const { traffic, buildings, pop } = this.c;
    if (depot.removed || stops.length < 2) {
      const fromB = buildings.get(stops[fromIdx]) ?? depot;
      for (const p of passengers) {
        const c = pop.citizens.get(p.citizenId);
        const finalDest = buildings.get(p.finalDestId);
        if (c && this.alive(c) && finalDest) {
          this.walk(c, buildings.door(fromB), buildings.frontTile(fromB), finalDest, () => this.arrive(c, finalDest));
        }
      }
      return;
    }

    // after the last stop the bus goes on to the first stop again (not back to the depot)
    const nextIdx = fromIdx + 1 < stops.length ? fromIdx + 1 : stops.length > 2 ? 1 : 0;
    const fromB = buildings.get(stops[fromIdx]);
    const toB = buildings.get(stops[nextIdx]);
    if (!fromB || !toB || fromB.access < 0 || toB.access < 0) return;

    const fromName = BUILDINGS[fromB.kind].name;
    const destName = BUILDINGS[toB.kind].name;
    const routeNum = depot.city + 1;
    const routeName = t('Route #{n}', { n: routeNum });

    const v = traffic.spawnVehicle({
      kind: 'bus',
      from: fromB.access,
      to: toB.access,
      fromPos: buildings.door(fromB),
      toPos: buildings.door(toB),
      driverId,
      driverName: (() => { const d = pop.citizens.get(driverId); return d ? `${d.name} ${pop.families.get(d.family)?.surname ?? ''}`.trim() : 'Bus driver'; })(),
      purpose: 'Bus route',
      routeName,
      routeStops: stops.map((id) => BUILDINGS[buildings.get(id)!.kind].name),
      stopIndex: nextIdx,
      fromName,
      destName,
      destBuildingId: toB.id,
      homeBuildingId: depot.id,
      passengers: passengers.map((p) => p.citizenId),
      onArrive: () => {
        this.onBusArrived(v ? v.id : -1, depot, stops, nextIdx);
      },
      onFail: () => {
        this.onBusFailed(v ? v.id : -1, depot, stops, nextIdx);
      },
    });

    if (!v) {
      for (const p of passengers) {
        const c = pop.citizens.get(p.citizenId);
        const finalDest = buildings.get(p.finalDestId);
        if (c && this.alive(c) && finalDest) {
          this.walk(c, buildings.door(fromB), buildings.frontTile(fromB), finalDest, () => this.arrive(c, finalDest));
        }
      }
      return;
    }

    this.busFleet.set(v.id, {
      vehicleId: v.id,
      depotId: depot.id,
      routeNum,
      stops,
      currentIdx: nextIdx,
      passengers,
      driverId,
    });
    const driver = pop.citizens.get(driverId);
    if (driver) driver.activity = 'Driving the bus';

    for (const p of passengers) {
      const c = pop.citizens.get(p.citizenId);
      if (c) {
        c.state = 'travel';
        c.activity = 'Riding the bus';
      }
    }
  }

  /** When a bus arrives at a stop: disembark passengers, board waiting passengers, and proceed to next stop. */
  private onBusArrived(vehicleId: number, depot: Building, stops: number[], arrivedIdx: number) {
    const { buildings, pop, traffic, walkers } = this.c;
    const bus = this.busFleet.get(vehicleId);
    this.busFleet.delete(vehicleId);
    if (!bus) return;

    const currentStop = buildings.get(stops[arrivedIdx]);
    if (!currentStop || depot.removed) {
      const fallback = currentStop ?? depot;
      for (const p of bus.passengers) {
        const c = pop.citizens.get(p.citizenId);
        const finalDest = buildings.get(p.finalDestId);
        if (c && this.alive(c) && finalDest) {
          this.walk(c, buildings.door(fallback), buildings.frontTile(fallback), finalDest, () => this.arrive(c, finalDest));
        }
      }
      return;
    }

    // Step A: Disembark passengers who reached their stop ("tushib qoladi")
    const remaining: BusPassenger[] = [];
    for (const p of bus.passengers) {
      const c = pop.citizens.get(p.citizenId);
      const finalDest = buildings.get(p.finalDestId);
      const getsOff = p.dropStopId === currentStop.id ||
                      p.finalDestId === currentStop.id ||
                      (finalDest && dist(currentStop, finalDest) <= 8);
      if (getsOff) {
        traffic.removePassenger(vehicleId, p.citizenId);
        if (c && this.alive(c)) {
          c.state = 'travel';
          if (!finalDest || currentStop.id === finalDest.id) {
            this.arrive(c, currentStop);
          } else {
            c.activity = c.job === finalDest.id ? 'Walking to work' : c.school === finalDest.id ? 'Walking to school' : 'Out for a walk';
            this.walk(c, buildings.door(currentStop), buildings.frontTile(currentStop), finalDest, () => this.arrive(c, finalDest));
          }
        }
      } else {
        remaining.push(p);
      }
    }

    // Step B: Board waiting passengers whose direction matches ("agar o'sha tarafga bormoqchi bo'lsa chiqadi")
    const waiters = this.busWaiters.get(currentStop.id) ?? [];
    const n = stops.length;
    const MAX_PASSENGERS = BUS.seats;
    const unboarded: BusWaiter[] = [];

    for (const w of waiters) {
      if (remaining.length >= MAX_PASSENGERS) {
        unboarded.push(w);
        continue;
      }
      let reachableAhead = false;
      for (let step = 1; step < n; step++) {
        const checkIdx = (arrivedIdx + step) % n;
        if (stops[checkIdx] === w.dropStopId) {
          reachableAhead = true;
          break;
        }
      }
      if (reachableAhead) {
        const c = pop.citizens.get(w.citizenId);
        if (c && this.alive(c) && c.activity === 'Waiting for bus') {
          if (c.walker) { walkers.dismiss(c.walker); c.walker = undefined; }
          c.state = 'travel';
          c.activity = 'Riding the bus';
          this.payFare(c, depot);
          remaining.push({
            citizenId: w.citizenId,
            pickupStopId: currentStop.id,
            dropStopId: w.dropStopId,
            finalDestId: w.finalDestId,
          });
        }
      } else {
        unboarded.push(w);
      }
    }

    if (unboarded.length > 0) this.busWaiters.set(currentStop.id, unboarded);
    else this.busWaiters.delete(currentStop.id);

    // Step C: proceed — unless the driver's shift is over: then everyone gets off here and the bus goes back
    const driver = pop.citizens.get(bus.driverId);
    if (!driver || driver.state !== 'away' || driver.job !== depot.id || this.shiftOver(driver)) {
      if (driver && driver.activity === 'Driving the bus') driver.activity = 'At work';
      for (const p of remaining) {
        const c = pop.citizens.get(p.citizenId);
        const finalDest = buildings.get(p.finalDestId);
        if (c && this.alive(c) && finalDest) {
          c.activity = 'Out for a walk';
          this.walk(c, buildings.door(currentStop), buildings.frontTile(currentStop), finalDest, () => this.arrive(c, finalDest));
        }
      }
      return;
    }
    this.runBusLeg(depot, stops, arrivedIdx, remaining, bus.driverId);
  }

  private onBusFailed(vehicleId: number, depot: Building, stops: number[], failedIdx: number) {
    const { buildings, pop } = this.c;
    const bus = this.busFleet.get(vehicleId);
    this.busFleet.delete(vehicleId);
    if (!bus) return;
    const drv = pop.citizens.get(bus.driverId);
    if (drv?.activity === 'Driving the bus') drv.activity = 'At work';
    const stop = buildings.get(stops[failedIdx]) ?? depot;
    for (const p of bus.passengers) {
      const c = pop.citizens.get(p.citizenId);
      const finalDest = buildings.get(p.finalDestId);
      if (c && this.alive(c) && finalDest) {
        this.walk(c, buildings.door(stop), buildings.frontTile(stop), finalDest, () => this.arrive(c, finalDest));
      }
    }
  }

  /** A passenger buys a ticket: the driver gets a share (and pays income tax on it), the rest goes to the city's bus company. */
  private payFare(c: Citizen, depot: Building) {
    const f = this.family(c);
    const city = this.c.eco.cities.get(depot.city);
    if (!f || !city) return;
    f.money -= BUS.fare;
    const driver = [...this.c.pop.citizens.values()].find((d) => d.job === depot.id && d.state === 'away');
    const df = driver && this.family(driver);
    const share = df ? BUS.fare * BUS.driverShare : 0;
    if (df) {
      const tax = share * city.taxRate;
      df.money += share - tax;
      this.cash(depot.city, tax, 'incomeTax');
    }
    if (!this.c.eco.cities.get(depot.city)?.laws?.includes('freebus')) this.cash(depot.city, BUS.fare - share, 'fares');
    depot.sales = (depot.sales ?? 0) + BUS.fare;
    this.tally(depot, 'Bus tickets');
  }

  /** Check if a citizen can use public transit to travel from origin to dest. */
  private findTransitTrip(origin: Building, dest: Building): { pickup: Building; dropoff: Building } | null {
    const { buildings } = this.c;
    if (dist(origin, dest) < 10) return null;
    const depots = buildings.list.filter((b) => b.kind === 'busdepot' && b.city === origin.city && b.built >= 1 && b.workers > 0 && b.access >= 0);
    if (!depots.length) return null;

    for (const depot of depots) {
      const stops = this.getRouteStops(depot);
      if (stops.length < 2) continue;

      let bestPickup: Building | null = null;
      let bestPickupDist = 7;
      let pickupIdx = -1;

      let bestDropoff: Building | null = null;
      let bestDropoffDist = 7;

      for (let i = 0; i < stops.length; i++) {
        const s = buildings.get(stops[i]);
        // people wait only at bus stops and stations, never at the depot
        if (!s || s.kind === 'busdepot') continue;
        const dOrigin = dist(origin, s);
        if (dOrigin < bestPickupDist) {
          bestPickupDist = dOrigin;
          bestPickup = s;
          pickupIdx = i;
        }
        const dDest = dist(dest, s);
        if (dDest < bestDropoffDist) {
          bestDropoffDist = dDest;
          bestDropoff = s;
        }
      }

      if (!bestPickup || !bestDropoff || bestPickup.id === bestDropoff.id) continue;

      const n = stops.length;
      let reachable = false;
      for (let step = 1; step < n; step++) {
        if (stops[(pickupIdx + step) % n] === bestDropoff.id) {
          reachable = true;
          break;
        }
      }

      if (reachable && (bestPickupDist + bestDropoffDist) < dist(origin, dest) * 0.85) {
        return { pickup: bestPickup, dropoff: bestDropoff };
      }
    }
    return null;
  }

  /** Stand and wait next to a bus stop (visible, not walking off). */
  private standAt(c: Citizen, stop: Building) {
    const w = c.walker;
    if (!w) return;
    const d = this.c.buildings.door(stop);
    const p = { x: d.x + (Math.random() - 0.5) * 0.4, z: d.z + (Math.random() - 0.5) * 0.4 };
    this.c.walkers.retarget(w, { points: [{ x: w.x, z: w.z }, p] }, () => this.c.walkers.holdFor(w, 9999, 'none', () => {}));
  }

  private addWaiter(waiter: BusWaiter) {
    let list = this.busWaiters.get(waiter.pickupStopId);
    if (!list) {
      list = [];
      this.busWaiters.set(waiter.pickupStopId, list);
    }
    list.push(waiter);
  }

  private updateBusWaiters(dt: number) {
    for (const [stopId, waiters] of this.busWaiters.entries()) {
      const remaining: BusWaiter[] = [];
      const stop = this.c.buildings.get(stopId);
      for (const w of waiters) {
        w.waitTimer += dt;
        if (w.waitTimer > 45) {
          const c = this.c.pop.citizens.get(w.citizenId);
          const finalDest = this.c.buildings.get(w.finalDestId);
          if (c && this.alive(c) && stop && finalDest && c.activity === 'Waiting for bus') {
            c.activity = 'Out for a walk';
            this.walk(c, this.c.buildings.door(stop), this.c.buildings.frontTile(stop), finalDest, () => this.arrive(c, finalDest));
          }
        } else {
          remaining.push(w);
        }
      }
      if (remaining.length > 0) this.busWaiters.set(stopId, remaining);
      else this.busWaiters.delete(stopId);
    }
  }

  private teleportHome(c: Citizen) {
    const f = this.family(c);
    if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
    c.state = 'home';
    c.at = f?.home ?? -1;
    c.activity = 'At home';
  }

  private carryFor(c: Citizen): Carry {
    if (!c.errand || c.sex !== 'f') return 'none';
    const f = this.family(c);
    return f && this.c.pop.members(f).some((m) => m.age < 2) ? 'baby' : 'none';
  }

  /** Walk over the pedestrian graph to a building's door (or `toPoint` when dest is null). */
  private walk(c: Citizen, from: Point, fromTile: number, dest: Building | null, done: () => void, carry: Carry = 'none', toPoint?: Point) {
    const { buildings, walkers } = this.c;
    const target = dest ? buildings.door(dest) : toPoint!;
    const toTile = dest ? buildings.frontTile(dest) : tileAt(target);
    const path = pedPath(this.graph, this.graph.node(fromTile, from), this.graph.node(toTile, target));
    if (!path && Math.hypot(from.x - target.x, from.z - target.z) > 4) {
      done(); // unreachable on foot — skip the trip
      return;
    }
    const route = { points: path ? this.graph.points(path, from, target) : [from, target] };
    if (c.walker && !c.walker.leaving) {
      walkers.retarget(c.walker, route, () => done(), carry);
    } else {
      const scale = c.age < 13 ? 0.62 : c.age < 17 ? 0.85 : 1;
      c.walker = walkers.walk(c.variant, scale, route, carry, () => done());
      // tired people walk slower
      c.walker.speed *= 0.7 + 0.3 * Math.min(1, (c.energy ?? 80) / 60);
      c.walker.citizen = c.id;
    }
    // a family with bicycles rides on the longer trips
    const w = c.walker;
    if (w) {
      let len = 0;
      for (let i = 1; i < route.points.length; i++) len += Math.hypot(route.points[i].x - route.points[i - 1].x, route.points[i].z - route.points[i - 1].z);
      const ride = !!this.family(c)?.bike && c.age >= 10 && (carry === 'none' || this.porters.has(c.id)) && len > (this.porters.has(c.id) ? 4 : 8);
      if (ride && !w.bike) { w.bike = true; w.speed *= 2.2; }
      else if (!ride && w.bike) { w.bike = false; w.speed /= 2.2; }
      if (ride && this.porters.has(c.id)) c.activity = c.activity === 'Carrying logs to the warehouse' ? 'Cycling logs to the warehouse' : c.activity === 'Carrying stone' ? 'Cycling stone to the warehouse' : c.activity;
      else if (ride) c.activity = c.activity === 'Walking to work' ? 'Cycling to work' : c.activity === 'Going home' ? 'Cycling home' : c.activity === 'Walking to school' ? 'Cycling to school' : c.activity;
    }
  }

  // ---------- work behaviour ----------

  /** Foresters walk to a stump within 14 tiles, plant a sapling there (the tree is back tomorrow) and go on to the next. */
  private foresterLoop(c: Citizen, lodge: Building) {
    const { terrain, buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === lodge.id && !lodge.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    const k = terrain.nearestStump(lodge.x, lodge.z, 14, this.reservedTrees);
    if (k < 0) { if (c.walker) { walkers.dismiss(c.walker); c.walker = undefined; } c.activity = 'Tending the saplings'; return; }
    this.reservedTrees.add(k);
    const at = { x: tileToWorld(k % N), z: tileToWorld((k / N) | 0) };
    const outside = c.walker && !c.walker.leaving;
    const start = outside ? { x: c.walker!.x, z: c.walker!.z } : buildings.door(lodge);
    const startTile = outside ? tileAt(start) : buildings.frontTile(lodge);
    c.activity = 'Carrying a sapling';
    this.walk(c, start, startTile, null, () => {
      const w = c.walker;
      if (!w || !atWork()) { this.reservedTrees.delete(k); return; }
      c.activity = 'Planting a sapling';
      walkers.holdFor(w, 1.6, 'chop', () => {
        terrain.plant(k);
        this.reservedTrees.delete(k);
        this.tally(lodge, 'Saplings planted');
        effects.puff(at.x, at.z, 0.2, 5, ['#5f9a3e', '#8a5a35']);
        this.foresterLoop(c, lodge);
      }, at);
    }, 'log', { x: at.x + 0.2, z: at.z + 0.2 });
  }

  private woodcutterLoop(c: Citizen, hut: Building) {
    const { terrain, buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === hut.id && !hut.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    let tree = terrain.nearestTree(hut.x, hut.z, 10, this.reservedTrees);
    if (tree < 0) tree = terrain.nearestTree(hut.x, hut.z, WOOD_REACH, this.reservedTrees);
    if (tree < 0) { if (c.walker) { walkers.dismiss(c.walker); c.walker = undefined; } c.activity = 'No trees nearby'; return; }
    this.reservedTrees.add(tree);
    const treeCenter = { x: tileToWorld(tree % N), z: tileToWorld((tree / N) | 0) };
    const stand = { x: treeCenter.x + 0.22, z: treeCenter.z + 0.22 };
    const outside = c.walker && !c.walker.leaving;
    const start = outside ? { x: c.walker!.x, z: c.walker!.z } : buildings.door(hut);
    const startTile = outside ? tileAt(start) : buildings.frontTile(hut);
    c.activity = 'Walking to the forest';
    this.walk(c, start, startTile, null, () => {
      const w = c.walker;
      if (!w || !atWork()) { this.reservedTrees.delete(tree); return; }
      c.activity = 'Chopping a tree';
      c.activity = c.saw ? 'Cutting a tree with a chainsaw' : 'Chopping a tree';
      walkers.holdFor(w, c.saw ? 0.6 : 1.5, 'chop', () => {
        const down = terrain.chopPart(tree);
        this.reservedTrees.delete(tree);
        effects.puff(treeCenter.x, treeCenter.z, 0.25, down ? 10 : 5, ['#8a5a35', '#6faa45', '#c9a36b']);
        // the log goes onto the woodpile by the hut (beside its road): a truck takes the pile to the warehouse
        const drop = hut;
        c.activity = 'Carrying a log';
        this.walk(c, { x: w.x, z: w.z }, tileAt(w), drop, () => {
          hut.stored = (hut.stored ?? 0) + WOOD_PER_LOG * (c.saw ? 1.5 : 1);
          if (c.walker) c.walker.carry = 'none';
          if (!atWork()) return;
          if (c.walker) c.walker.leaving = false;
          if (drop === hut) this.woodcutterLoop(c, hut);
          else this.walk(c, buildings.door(drop), buildings.frontTile(drop), hut, () => { if (c.walker) c.walker.leaving = false; this.woodcutterLoop(c, hut); });
        }, 'log');
      }, treeCenter);
    }, 'none', stand);
  }

  /**
   * Quarrymen and miners work outside at the rock face next to their quarry or mine: they walk to the nearest
   * mountain tile, hack at it (dust and chips fly — grey stone, black coal, rusty iron), and move on now and then.
   */
  /** Quarries and mines already told that their rock moved away. */
  private reachNoted = new Set<number>();

  /** How far (tiles) the rock face of a quarry or mine is from the building. */
  faceDistance(site: Building) {
    const f = this.mineFace(site);
    if (!f) return -1;
    const s = BUILDINGS[site.kind].size;
    return Math.max(0, Math.hypot((f.rock % N) + 0.5 - (site.x + s / 2), ((f.rock / N) | 0) + 0.5 - (site.z + s / 2)) - s / 2);
  }

  /** The walk to a far rock face eats into the day: full output up to 4 tiles, then less (never below 40%). */
  reachFactor(site: Building) {
    const d = this.faceDistance(site);
    return d < 0 ? 0 : d <= 4 ? 1 : Math.max(0.4, 1 - (d - 4) * 0.06);
  }

  /** The rock face each quarry or mine works on: one rock tile, worked from one side until it is gone. */
  private mineFaces = new Map<number, { rock: number; stand: { x: number; z: number }; tile: number; dx: number; dz: number; crew: number[] }>();
  private mineFace(site: Building) {
    const { map, buildings } = this.c;
    const open = (k: number) => map.height[k] <= 0 && !map.water[k] && buildings.occ[k] === -1;
    const cur = this.mineFaces.get(site.id);
    if (cur && map.height[cur.rock] > 0 && open(cur.tile)) return cur;
    this.mineFaces.delete(site.id);
    const s = BUILDINGS[site.kind].size;
    const cx = site.x + s / 2, cz = site.z + s / 2;
    const from = buildings.frontTile(site);
    const cands: { k: number; d: number }[] = [];
    for (let z = site.z - ROCK_REACH; z < site.z + s + ROCK_REACH; z++) for (let x = site.x - ROCK_REACH; x < site.x + s + ROCK_REACH; x++) {
      if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue;
      const k = z * N + x;
      // the closest rock first, the lower edge before the peak (the same order the digging takes it away)
      if (map.height[k] > 0 && !this.c.net.type[k]) cands.push({ k, d: Math.max(Math.abs(x + 0.5 - cx), Math.abs(z + 0.5 - cz)) + map.height[k] * 0.2 });
    }
    cands.sort((p, q) => p.d - q.d);
    for (const { k } of cands.slice(0, 24)) {
      const x = k % N, z = (k / N) | 0;
      // the side of the rock facing the site, which people can actually walk to (never across the rocks)
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dz]) => ({ dx, dz, t: (z + dz) * N + x + dx }))
        .filter((o) => open(o.t))
        .sort((p, q) => Math.hypot(p.t % N + 0.5 - cx, ((p.t / N) | 0) + 0.5 - cz) - Math.hypot(q.t % N + 0.5 - cx, ((q.t / N) | 0) + 0.5 - cz));
      for (const o of sides) {
        if (!pedPath(this.graph, this.graph.node(from), this.graph.node(o.t), 9000)) continue;
        const face = { rock: k, tile: o.t, dx: o.dx, dz: o.dz, crew: [] as number[], stand: { x: tileToWorld(x + o.dx) - o.dx * 0.18, z: tileToWorld(z + o.dz) - o.dz * 0.18 } };
        this.mineFaces.set(site.id, face);
        return face;
      }
    }
    return null;
  }

  /**
   * Once a day: woodcutters with no trees left in reach and quarries and mines with no rock left to dig stop hiring —
   * their workers take other jobs for now and come back when the trees have grown again.
   */
  private checkDepleted() {
    const { buildings, terrain, pop } = this.c;
    let changed = false;
    for (const b of buildings.list) {
      if (b.built < 1 || b.removed) continue;
      if (b.kind !== 'woodcutter' && b.kind !== 'quarry' && b.kind !== 'coalmine' && b.kind !== 'ironmine') continue;
      const empty = b.kind === 'woodcutter' ? terrain.nearestTree(b.x, b.z, WOOD_REACH, new Set()) < 0 : !this.mineFace(b);
      const was = (b.depleted ?? 0) > 0;
      b.depleted = empty ? (b.depleted ?? 0) + 1 : 0;
      if (empty !== was) changed = true;
      if (empty && !was) {
        const city = this.c.eco.cities.get(b.city);
        if (city && !city.ai) this.cityEvent(city.id, t(b.kind === 'woodcutter' ? 'The woodcutter has no trees left nearby: its workers took other jobs for now' : 'The {name} has no rock left to dig: its workers took other jobs for now', { name: t(BUILDINGS[b.kind].name) }));
      }
    }
    if (changed) pop.assign(buildings);
  }

  private mineLoop(c: Citizen, site: Building) {
    const { buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === site.id && !site.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    const f = this.mineFace(site);
    if (!f) { if (c.walker) { walkers.dismiss(c.walker); c.walker = undefined; } c.activity = 'No rock left to dig'; return; }
    const rockAt = { x: tileToWorld(f.rock % N), z: tileToWorld((f.rock / N) | 0) };
    const dust = site.kind === 'coalmine' ? ['#2a2d31', '#4a4f57', '#8d8a83'] : site.kind === 'ironmine' ? ['#8a4b2e', '#a7a196', '#6b4a3a'] : ['#bdb7aa', '#d8d2c4', '#8d8a83'];
    const outside = c.walker && !c.walker.leaving;
    const start = outside ? { x: c.walker!.x, z: c.walker!.z } : buildings.door(site);
    const startTile = outside ? tileAt(start) : buildings.frontTile(site);
    // each worker has a place of their own along the face
    f.crew = f.crew.filter((id) => id === c.id || this.c.pop.citizens.get(id)?.job === site.id);
    if (!f.crew.includes(c.id)) f.crew.push(c.id);
    const slot = ([0, -0.26, 0.26, -0.13, 0.13, -0.36, 0.36][f.crew.indexOf(c.id) % 7]);
    const stand = { x: f.stand.x + (f.dz ? slot : 0), z: f.stand.z + (f.dx ? slot : 0) };
    const near = c.walker && Math.hypot(c.walker.x - stand.x, c.walker.z - stand.z) < 0.05;
    c.activity = site.kind === 'quarry' ? 'Walking to the rock face' : 'Walking into the mine';
    const work = () => {
      let hits = 3 + Math.floor(Math.random() * 4);
      const hack = () => {
        const w = c.walker;
        if (!w || !atWork()) return;
        c.activity = site.kind === 'quarry' ? 'Breaking stone' : site.kind === 'coalmine' ? 'Digging coal' : 'Digging iron ore';
        if (Math.random() < 0.6) effects.puff(stand.x + (rockAt.x - stand.x) * 0.5, stand.z + (rockAt.z - stand.z) * 0.5, 0.18, 4, dust);
        // the rock face is gone (dug away by the day's output): on to the next one
        if (this.c.map.height[f.rock] <= 0) { this.mineLoop(c, site); return; }
        if (--hits <= 0) {
          if (this.faceDistance(site) > 3) {
            c.activity = site.kind === 'quarry' ? 'Carrying stone to the yard' : site.kind === 'coalmine' ? 'Carrying coal to the yard' : 'Carrying iron ore to the yard';
            this.walk(c, { x: w.x, z: w.z }, tileAt(w), site, () => { if (c.walker) { c.walker.carry = 'none'; c.walker.leaving = false; } this.mineLoop(c, site); }, 'stone');
            return;
          }
          this.mineLoop(c, site);
          return;
        }
        walkers.holdFor(w, 1.4, 'chop', hack, { x: rockAt.x + (stand.x - f.stand.x), z: rockAt.z + (stand.z - f.stand.z) });
      };
      hack();
    };
    // still at the same face: keep hacking without walking around the rock
    if (near) work();
    else this.walk(c, start, startTile, null, work, 'none', stand);
  }

  /**
   * Construction speed of one site: slow on its own, much faster while builders from a construction company work on it.
   */
  buildSpeed(b: Building) {
    const n = Math.min(5, this.crewSize(b));
    // a Town Hall and the construction company itself go up slowly with hired hands; everything else needs builders
    const now = this.clock();
    const planks = ((b.planked ?? 0) > now ? CHAIN.plankBoost : 1) * ((b.boost?.bricks ?? 0) > now ? CHAIN2.brickBoost : 1) * ((b.boost?.steel ?? 0) > now ? CHAIN2.steelBoost : 1);
    if (SELF_BUILT[b.kind]) return (0.5 + 0.6 * n) * planks;
    return 0.85 * n * planks;
  }

  /** Why a construction site is not progressing (null when builders are on it). */
  siteProblem(b: Building): string | null {
    if (this.crewSize(b) > 0 || SELF_BUILT[b.kind]) return null;
    const yards = this.c.buildings.list.filter((y) => y.kind === 'construction' && y.city === b.city);
    if (!yards.length) return 'No builders — build a Construction Company';
    if (!yards.some((y) => y.built >= 1)) return 'Waiting for the Construction Company to be finished';
    if (!yards.some((y) => y.workers > 0)) return 'The Construction Company has no workers';
    const tod = this.c.eco.timeOfDay;
    if (tod < 0.3 || tod > 0.75) return 'Builders work from 8:00 to 18:00';
    return 'Builders are on their way';
  }

  crewSize(b: Building) {
    let n = 0;
    for (const id of this.crews.get(b.id) ?? []) if (this.c.pop.citizens.get(id)?.activity === 'Building') n++;
    return n;
  }

  /** Builders waiting at the yard pick up the next site. */
  /** Work clothes: worn at work and on the way there and back; senior staff wear the chief's (officer, doctor, pilot…). */
  private uniformFor(id: number): Uniform | undefined {
    const c = this.c.pop.citizens.get(id);
    if (!c || c.job < 0 || c.age < 18) return undefined;
    const work = c.at === c.job || c.activity === 'Walking to work' || c.activity === 'Cycling to work' || (c.state === 'away' && c.activity !== 'At home' && this.busyBuilders.has(c.id));
    if (!work && !(c.state === 'away' && c.at === c.job)) return undefined;
    const b = this.c.buildings.get(c.job);
    const u = b && UNIFORM_OF[b.kind];
    if (!u) return undefined;
    return c.skill === 2 && u[1] ? u[1] : u[0];
  }

  /** The tile where a road is being laid in a town (set by the game), and the builders at work on it. */
  roadSite?: (cityId: number) => { key: number; x: number; z: number } | null;
  private roadCrews = new Map<number, Set<number>>();
  /** Builders working on the road tile `key` right now (the road goes faster with each of them). */
  roadCrew(key: number) { return this.roadCrews.get(key)?.size ?? 0; }

  private dispatchBuilders() {
    const { pop, buildings } = this.c;
    for (const c of pop.citizens.values()) {
      if (c.job < 0 || c.state !== 'away' || c.at !== c.job) continue;
      // a builder waiting for an order (even walking back to the yard) is free for a new site
      const waiting = c.activity === 'Waiting for a new order' || c.activity === 'At work';
      if (this.busyBuilders.has(c.id) && !waiting) continue;
      if (c.walker && !waiting) continue;
      const yard = buildings.get(c.job);
      if (yard?.kind !== 'construction') continue;
      if (waiting) this.busyBuilders.delete(c.id);
      if (yard?.kind === 'construction' && (buildings.list.some((b) => b.built < 1 && b.city === yard.city) || this.roadSite?.(yard.city))) this.builderLoop(c, yard);
    }
  }

  /** A builder walks to the road being laid and works there until the tile is done, then on to the next one. */
  private roadLoop(c: Citizen, yard: Building, road: { key: number; x: number; z: number }) {
    const { buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === yard.id && !yard.removed && eco.timeOfDay < c.returnAt;
    const leave = () => { this.roadCrews.get(road.key)?.delete(c.id); };
    this.busyBuilders.add(c.id);
    const ang = Math.random() * Math.PI * 2;
    const stand = { x: road.x + Math.cos(ang) * 0.3, z: road.z + Math.sin(ang) * 0.3 };
    const outside = c.walker && !c.walker.leaving;
    const from = outside ? { x: c.walker!.x, z: c.walker!.z } : buildings.door(yard);
    const fromTile = outside ? tileAt(from) : buildings.frontTile(yard);
    c.activity = 'Walking to a road site';
    this.walk(c, from, fromTile, null, () => {
      if (!atWork()) { leave(); this.busyBuilders.delete(c.id); return; }
      // no footpath to the road site: the builder comes over the fields anyway
      if (!c.walker || c.walker.leaving) { c.walker = walkers.walk(c.variant, 1, { points: [stand, { x: stand.x + 0.01, z: stand.z }] }, 'none', () => {}); c.walker.citizen = c.id; }
      // the builder has arrived: from now on the road goes faster
      if (!this.roadCrews.has(road.key)) this.roadCrews.set(road.key, new Set());
      this.roadCrews.get(road.key)!.add(c.id);
      const work = () => {
        const ww = c.walker;
        if (!ww || !atWork()) { leave(); this.busyBuilders.delete(c.id); return; }
        const cur = this.roadSite?.(yard.city);
        if (!cur || cur.key !== road.key) { leave(); this.builderLoop(c, yard); return; }
        c.activity = 'Laying a road';
        if (Math.random() < 0.35) effects.puff(stand.x, stand.z, 0.12, 3, ['#d8c9a6', '#7d7a73']);
        walkers.holdFor(ww, 1.6, 'chop', work, { x: road.x, z: road.z });
      };
      work();
    }, 'none', stand);
  }

  /** A builder walks from the yard to the least-crewed unfinished building of the city and works there. */
  private builderLoop(c: Citizen, yard: Building) {
    const { buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === yard.id && !yard.removed && eco.timeOfDay < c.returnAt;
    const leave = (site?: Building) => { if (site) this.crews.get(site.id)?.delete(c.id); };
    if (!atWork()) { this.busyBuilders.delete(c.id); return; }
    const sites = buildings.list.filter((b) => b.built < 1 && b.city === yard.city && !b.removed);
    // a road being laid takes builders too: whichever needs hands more
    const road = this.roadSite?.(yard.city) ?? null;
    if (road && (!sites.length || this.roadCrew(road.key) <= Math.min(...sites.map((s) => this.crewSize(s))))) return this.roadLoop(c, yard, road);
    if (!sites.length) {
      this.busyBuilders.delete(c.id);
      c.activity = 'Waiting for a new order';
      if (c.walker && !c.walker.leaving) {
        this.walk(c, { x: c.walker.x, z: c.walker.z }, tileAt(c.walker), yard, () => { if (c.walker) { walkers.dismiss(c.walker); c.walker = undefined; } c.activity = 'At work'; });
      }
      return;
    }
    const from = c.walker && !c.walker.leaving ? { x: c.walker.x, z: c.walker.z } : buildings.door(yard);
    const site = sites.sort((a, b) => (this.crewSize(a) - this.crewSize(b)) * 20 + dist(a, yard) - dist(b, yard))[0];
    this.busyBuilders.add(c.id);
    if (!this.crews.has(site.id)) this.crews.set(site.id, new Set());
    this.crews.get(site.id)!.add(c.id);
    const half = BUILDINGS[site.kind].size / 2 + 0.18;
    const ang = Math.random() * Math.PI * 2;
    const center = { x: site.mesh.position.x, z: site.mesh.position.z };
    const stand = { x: center.x + Math.cos(ang) * half, z: center.z + Math.sin(ang) * half };
    // the builder at the site: a walker standing there (made when he arrives by van or found no footpath)
    const arrive = () => {
      if (!atWork() || site.removed) { leave(site); this.busyBuilders.delete(c.id); return false; }
      if (!c.walker || c.walker.leaving) {
        c.walker = walkers.walk(c.variant, 1, { points: [stand, { x: stand.x + 0.01, z: stand.z }] }, 'none', () => {});
        c.walker.citizen = c.id;
      }
      return true;
    };
    const work = () => {
      const ww = c.walker;
      if (!ww || !atWork() || site.removed) { leave(site); this.busyBuilders.delete(c.id); return; }
      if (site.built >= 1) { leave(site); this.builderLoop(c, yard); return; }
      c.activity = 'Building';
      if (Math.random() < 0.35) effects.puff(stand.x, stand.z, 0.15, 3, ['#d8c9a6', '#bdb7aa']);
      walkers.holdFor(ww, 1.6, 'chop', work, center);
    };
    // a far site: the builders ride there in the company's yellow van
    const { traffic } = this.c;
    if (!c.walker && dist(site, yard) > 8 && yard.access >= 0 && site.access >= 0 && traffic.canRoute(yard.access, site.access)) {
      c.activity = 'Driving to a construction site';
      const ok = traffic.spawn({
        kind: 'car', from: yard.access, to: site.access, fromPos: buildings.door(yard), toPos: buildings.door(site), color: new THREE.Color('#f2b33d'),
        purpose: 'Builders on the way', driverId: c.id, driverName: this.fullName(c), fromName: BUILDINGS.construction.name, destName: BUILDINGS[site.kind].name,
        onArrive: () => { if (arrive()) work(); },
        onFail: () => { if (arrive()) work(); },
      });
      if (ok) return;
    }
    c.activity = 'Walking to a construction site';
    const fromTile = c.walker && !c.walker.leaving ? tileAt(from) : buildings.frontTile(yard);
    this.walk(c, from, fromTile, null, () => {
      // no footpath there: the builder comes over the fields anyway
      if (!arrive()) return;
      const w = c.walker;
      if (!w) { leave(site); this.busyBuilders.delete(c.id); return; }
      work();
    }, 'none', stand);
  }

  private farmLoop(c: Citizen, field: Building) {
    const { walkers, eco } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === field.id && !field.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    c.activity = field.kind === 'ranch' ? 'Tending the cattle' : field.kind === 'orchard' ? 'Picking fruit' : 'Working in the field';
    const s = BUILDINGS[field.kind].size;
    const p = { x: tileToWorld(field.x) + Math.random() * (s - 1), z: tileToWorld(field.z) + Math.random() * (s - 1) };
    const outside = c.walker && !c.walker.leaving;
    const from = outside ? { x: c.walker!.x, z: c.walker!.z } : this.c.buildings.door(field);
    const route = { points: [from, p] };
    const next = () => {
      const w = c.walker;
      if (!w) return;
      walkers.holdFor(w, 2 + Math.random() * 3, 'farm', () => this.farmLoop(c, field));
    };
    if (outside) walkers.retarget(c.walker!, route, next);
    else {
      c.walker = walkers.walk(c.variant, c.age < 17 ? 0.85 : 1, route, 'none', next);
      c.walker.citizen = c.id;
    }
  }

  // ---------- parking ----------

  private findSpot(dest: Building): { lot: Building; slot: number } | null {
    const { buildings } = this.c;
    const lots = buildings.list
      .filter((b) => b.kind !== 'house' && b.access >= 0 && BUILDINGS[b.kind].slots.length && (b === dest || (b.kind === 'parking' && dist(b, dest) <= PARK_RADIUS)))
      .sort((a, b) => dist(a, dest) - dist(b, dest));
    for (const lot of lots) {
      for (let i = 0; i < BUILDINGS[lot.kind].slots.length; i++) {
        if (!this.spots.has(`${lot.id}:${i}`)) return { lot, slot: i };
      }
    }
    // a multi-storey car park within the walking distance: the car drives in through its gate
    const garages = buildings.list.filter((b) => b.kind === 'garage' && b.built >= 1 && !b.removed && b.access >= 0 && dist(b, dest) <= PARK_RADIUS)
      .sort((a, b) => dist(a, dest) - dist(b, dest));
    for (const g of garages) {
      const cap = GARAGE_CARS * (g.level || 1);
      if ((this.garageUse.get(g.id) ?? 0) >= cap) continue;
      for (let i = 0; i < cap; i++) if (!this.spots.has(`${g.id}:${i}`)) return { lot: g, slot: i };
    }
    const fallback = buildings.list
      .filter((b) => b.kind !== 'house' && b.access >= 0 && BUILDINGS[b.kind].slots.length && dist(b, dest) <= PARK_RADIUS)
      .sort((a, b) => dist(a, dest) - dist(b, dest));
    for (const lot of fallback) {
      for (let i = 0; i < BUILDINGS[lot.kind].slots.length; i++) {
        if (!this.spots.has(`${lot.id}:${i}`)) return { lot, slot: i };
      }
    }
    return null;
  }

  familyForParked(x: number, z: number): number | undefined {
    const { buildings } = this.c;
    for (const [key, famId] of this.spots) {
      const [lotId, slot] = key.split(':').map(Number);
      const lot = buildings.get(lotId);
      if (!lot) continue;
      if (lot.kind === 'garage') continue;
      const slotPos = buildings.slot(lot, slot);
      if (Math.hypot(slotPos.x - x, slotPos.z - z) < 0.4) return famId;
    }
    return undefined;
  }

  /** Where a car stops in a parking space; in a multi-storey car park, at its gate (it then drives inside). */
  private lotPos(lot: Building, slot: number): { x: number; z: number; rot: number } {
    if (lot.kind === 'garage') { const d = this.c.buildings.door(lot); return { x: d.x, z: d.z, rot: lot.rot }; }
    return this.c.buildings.slot(lot, slot);
  }

  spotsUsed(b: Building) {
    let n = 0;
    for (const key of this.spots.keys()) if (key.startsWith(`${b.id}:`)) n++;
    return n;
  }

  /** A building was removed: send people home, free spots, rehouse the family. */
  buildingRemoved(b: Building) {
    const { pop, buildings } = this.c;
    for (const key of [...this.spots.keys()]) {
      if (!key.startsWith(`${b.id}:`)) continue;
      const f = pop.families.get(this.spots.get(key)!);
      if (f?.car && f.car.lot === b.id) { f.car.at = 'home'; f.car.lot = undefined; }
      this.spots.delete(key);
    }
    for (const c of pop.citizens.values()) if (c.at === b.id && c.state === 'away') this.teleportHome(c);
    const waiters = this.busWaiters.get(b.id);
    if (waiters) {
      this.busWaiters.delete(b.id);
      for (const w of waiters) {
        const c = pop.citizens.get(w.citizenId);
        const finalDest = buildings.get(w.finalDestId);
        if (c && this.alive(c) && finalDest) {
          this.walk(c, buildings.door(b), buildings.frontTile(b), finalDest, () => this.arrive(c, finalDest));
        }
      }
    }
    if (BUILDINGS[b.kind].units) {
      for (const f of [...pop.families.values()].filter((x) => x.home === b.id)) {
        const other = this.freeHomes(b.city).find((h) => h.id !== b.id);
        if (other) f.home = other.id;
        else if (!this.relocate(f, b.city, true)) {
          for (const m of pop.members(f)) if (m.walker) this.c.walkers.dismiss(m.walker);
          pop.removeFamily(f);
          this.cityEvent(b.city, t('A family left town — their house was destroyed'));
        }
      }
    }
    pop.assign(buildings);
    this.rebuildGrid();
  }
}

const colorCache = new Map<string, THREE.Color>();
function colorOf(hex: string) {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new THREE.Color(hex)));
  return c;
}

const tileAt = (p: Point) => worldToTile(p.z) * N + worldToTile(p.x);
const dist = (a: Building, b: Building) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
