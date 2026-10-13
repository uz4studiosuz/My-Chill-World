import * as THREE from 'three';
import { DAY_SECONDS, DAYS_PER_YEAR } from '../config';
import { DIRS, N, tileToWorld, worldToTile, inBounds, idx } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { Terrain } from '../world/Terrain';
import { RoadNetwork } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { Building, Buildings, Point } from '../buildings/Buildings';
import { BUS, SERVICE_FEE, BUILDINGS, BUSINESS_KINDS, CARS, CLEAN_POWER, POLLUTERS, POLLUTION_RANGE, TOURISM, FIRE_RANGE, FUEL, IRON_PER_DAY, POLICE_RANGE, SHOP_PRICE, POWER_PRIORITY, HOUSE_UPGRADE, OWNER_SHARE, LOAN, GRAVE_COST, MAX_GRAVES_PER_CEMETERY, QUARRY, WOOD_PER_LOG } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { growingSeason, monthOf, seasonOf } from '../sim/Calendar';
import { Citizen, DayReport, Family, Population } from '../people/Population';
import type { City, PromiseKind } from '../sim/Economy';
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
}

const TRUCKS_PER_QUARRY = 2;
const PARK_RADIUS = 20;
const IMMIGRATION_INTERVAL = DAY_SECONDS / 3;
const ROAD_UPKEEP = 0.1;
const BRIDGE_UPKEEP = 0.5;
/** Working hours as fractions of the day (8:00–17:30). */
const WORK_FROM = 0.33, WORK_TO = 0.73;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/** Built without a construction company (slowly). */
const SELF_BUILT: Partial<Record<string, boolean>> = { townhall: true, construction: true };

export const PROMISE_TEXT: Record<PromiseKind, string> = {
  tax: 'promises lower taxes', park: 'promises a new park', hospital: 'promises a hospital', school: 'promises a new school', jobs: 'promises jobs for everyone',
};

/**
 * Everyday life: schedules, commuting by car or on foot (sidewalks, zebra crossings), work behaviour,
 * production, the power grid, water, needs, fires and the end-of-day settlement.
 */
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
  private routeCache = new Map<number, { t: number; stops: number[] }>();
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
  /** Food eaten / missing today per city (people eat through the day, not once at midnight). */
  private meals = new Map<number, { eaten: number; short: number }>();
  private people = new Map<number, number>();
  /** Builders currently working on each construction site. */
  private crews = new Map<number, Set<number>>();
  private busyBuilders = new Set<number>();
  private presentT = 0;
  private fireT = 0;
  private gridIds = new Set<number>();
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
    this.updateEnergy(dt);
    this.presentT -= dt;
    this.serviceT -= dt;
    if (this.serviceT <= 0) { this.serviceT = 3; this.dispatchServices(); }
    this.updateBusWaiters(dt);
    if (this.presentT <= 0) { this.presentT = 0.5; this.people = this.populationByCity(); this.countPresent(); this.checkRain(); this.dispatchBuilders(); }
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
    city.money += amount;
    this.liveOf(cityId)[kind] += Math.abs(amount);
    this.onMoney(cityId, amount);
  }

  /** A family pays the city for a service (hospital treatment, parking ticket) on the spot. */
  charge(c: Citizen, cityId: number, amount: number) {
    const f = this.family(c);
    if (!f) return;
    f.money -= amount;
    this.cash(cityId, amount, 'services');
  }

  /** A worker finishes the shift: the wage is paid now, income tax goes to the city, public wages come out of it. */
  private payShift(c: Citizen, b: Building) {
    const f = this.family(c);
    const city = this.c.eco.cities.get(b.city);
    if (!f || !city || c.paid) return;
    const gross = this.c.pop.wage(c, b);
    if (gross <= 0) return;
    c.paid = true;
    const tax = gross * city.taxRate;
    f.money += gross - tax;
    f.income += Math.round(gross - tax);
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

  parkedCars() {
    const { pop, buildings } = this.c;
    const out: { x: number; z: number; rot: number; color: THREE.Color }[] = [];
    const at = new Map<number, number>();
    for (const f of pop.families.values()) {
      if (!f.car || f.car.at === 'moving') continue;
      const color = colorOf(f.car.color);
      if (f.car.at === 'home') {
        const h = buildings.get(f.home);
        if (!h) continue;
        const i = at.get(h.id) ?? 0;
        at.set(h.id, i + 1);
        const slots = BUILDINGS[h.kind].slots.length;
        if (slots) out.push({ ...buildings.slot(h, i % slots), color });
      } else if (f.car.lot !== undefined) {
        const lot = buildings.get(f.car.lot);
        if (lot) out.push({ ...buildings.slot(lot, f.car.slot!), color });
      }
    }
    return out;
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

  /** Which buildings are connected by road to a staffed power plant. Call after any network/building change. */
  rebuildGrid() {
    const { net, buildings } = this.c;
    const comp = new Int32Array(N * N).fill(-1);
    let id = 0;
    for (let k = 0; k < comp.length; k++) {
      if (!net.type[k] || comp[k] >= 0) continue;
      const stack = [k];
      comp[k] = id;
      while (stack.length) {
        const cur = stack.pop()!;
        const x = cur % N, z = (cur / N) | 0;
        for (const d of DIRS) {
          if (!(net.conn[cur] & d.bit)) continue;
          const nk = (z + d.dz) * N + x + d.dx;
          if (comp[nk] < 0 && net.type[nk]) { comp[nk] = id; stack.push(nk); }
        }
      }
      id++;
    }
    const live = new Set<number>();
    for (const p of buildings.list) if (BUILDINGS[p.kind].power && p.built >= 1 && p.access >= 0 && (p.workers > 0 || CLEAN_POWER[p.kind])) live.add(comp[p.access]);
    this.gridIds.clear();
    for (const b of buildings.list) if (b.access >= 0 && live.has(comp[b.access])) this.gridIds.add(b.id);
  }

  onGrid(b: Building) { return this.gridIds.has(b.id); }

  private updateEnergy(dt: number) {
    const { buildings, eco } = this.c;
    const plants: { city: (typeof eco.city); power: number }[] = [];
    let total = 0, clean = 0;
    for (const city of eco.cities.values()) {
      let demand = 0, capacity = 0;
      for (const b of buildings.list) {
        if (b.city !== city.id || b.built < 1) continue;
        const d = BUILDINGS[b.kind];
        if (d.energy && this.gridIds.has(b.id)) demand += d.energy * (b.kind === 'house' ? b.level : 1);
        if (d.power && b.access >= 0) {
          if (CLEAN_POWER[b.kind]) {
            const sun = b.kind === 'solarfarm' ? (eco.timeOfDay > 0.25 && eco.timeOfDay < 0.78 ? 1 : 0.1) : 0.7 + 0.3 * Math.sin(eco.day * 1.7 + eco.timeOfDay * 9);
            const p = d.power * Math.max(0.6, Math.min(1, b.workers / d.jobs)) * sun;
            capacity += p;
            clean += p;
          } else {
            const p = d.power * Math.min(1, b.workers / d.jobs);
            capacity += p;
            if (p > 0) plants.push({ city, power: p });
          }
        }
      }
      city.energyDemand = demand + (this.lampDemand.find(([id]) => id === city.id)?.[1] ?? 0);
      city.energyCapacity = capacity;
      total += demand;
    }
    total += this.lampDemand.reduce((a, [, n]) => a + n, 0);
    const available = clean + eco.updateEnergy(dt, Math.max(0, total - clean), plants);
    // essential buildings first; when the plants can't cover everything, the rest goes dark
    const consumers = buildings.list.filter((b) => BUILDINGS[b.kind].energy > 0 && b.built >= 1);
    consumers.sort((a, b) => (POWER_PRIORITY[a.kind] ?? 4) - (POWER_PRIORITY[b.kind] ?? 4));
    let left = available;
    const got = new Map<number, number>();
    for (const b of buildings.list) if (!BUILDINGS[b.kind].energy) b.powered = true;
    for (const b of consumers) {
      const e = BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1);
      b.powered = this.gridIds.has(b.id) && left >= e;
      if (b.powered) { left -= e; got.set(b.city, (got.get(b.city) ?? 0) + e); }
    }
    this.lampsLit = left > 0;
    for (const city of eco.cities.values()) {
      const share = city.energyDemand > 0 ? Math.min(1, (got.get(city.id) ?? 0) / city.energyDemand) : 1;
      city.powered += (share - city.powered) * Math.min(1, dt * 2);
    }
    const people = this.populationByCity();
    for (const city of eco.cities.values()) {
      let water = 0;
      for (const w of buildings.ofKind('watertower')) {
        if (w.city !== city.id) continue;
        water += BUILDINGS.watertower.water * (w.workers > 0 ? 1 : 0.5) * (w.powered ? 1 : 0.3);
      }
      const n = people.get(city.id) ?? 0;
      city.water = n ? Math.min(1, water / n) : 1;
    }
  }

  // ---------- day settlement ----------

  private newDay() {
    const { pop, eco, buildings, terrain, weather } = this.c;
    pop.day = eco.day;
    const cities = [...eco.cities.values()];
    const roadShare = this.roadUpkeep() / Math.max(1, cities.length);
    const homeCity = (f: Family) => buildings.get(f.home)?.city;

    cities.forEach((city, i) => {
      const say = (msg: string) => this.events.push(cities.length > 1 ? `${city.name}: ${msg}` : msg);
      // the first city also adopts families whose house is gone
      const belongs = (f: Family) => {
        const c = homeCity(f);
        return c === city.id || (i === 0 && (c === undefined || !eco.cities.has(c)));
      };
      const own = buildings.list.filter((b) => b.city === city.id && b.built >= 1);
      const hasHall = own.some((b) => b.kind === 'weddinghall');
      const heal = own.reduce((a, b) => a + BUILDINGS[b.kind].heal * (BUILDINGS[b.kind].jobs ? Math.min(1, b.workers / BUILDINGS[b.kind].jobs) : 1), 0);
      const meal = this.meals.get(city.id) ?? { eaten: 1, short: 0 };
      const fed = meal.eaten + meal.short > 0 ? meal.eaten / (meal.eaten + meal.short) : 1;
      const portions = Math.round((this.people.get(city.id) ?? 0) * fed + (fed >= 0.999 ? 1000 : 0));
      const r = pop.daily(buildings, belongs, portions, city.water, () => this.freeHomes(city.id), hasHall, {
        heal: Math.min(40, heal), carStock: this.carStock(city.id),
        shops: { market: false, grocery: false, clothes: false },
        taxRate: city.taxRate, calm: this.calm,
        safety: this.policeCover(city.id) * 0.75,
        eduBoost: own.some((b) => b.kind === 'academy' && b.workers > 0) ? 0.3 : 0,
      });
      city.foodYesterday = { made: Math.round(city.foodMade), eaten: r.foodEaten };
      city.foodMade = 0;
      let rentToCity = 0;
      for (const [bid, amount] of r.rent) {
        const flat = buildings.get(bid);
        const owner = flat && flat.owner >= 0 ? pop.families.get(flat.owner) : undefined;
        if (owner) { owner.money += amount; owner.income += amount; } else rentToCity += amount;
      }
      const interest = city.loan * LOAN.interest;
      const upkeep = Math.round(roadShare + interest + buildings.list.reduce((a, b) => (b.city === city.id ? a + BUILDINGS[b.kind].upkeep : a), 0));
      // business tax: turnover of staffed shops, factories, banks… plus market and car dealer sales
      // each business pays 20% tax on its turnover; a family owner keeps a share as profit
      const working = (kind: string) => own.filter((b) => b.kind === kind && b.workers > 0);
      let business = 0;
      for (const b of own) {
        const d = BUILDINGS[b.kind];
        let turnover = 0;
        if (b.kind === 'market' || b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'gasstation' || b.kind === 'hotel') {
          turnover = b.sales ?? 0;
          b.sales = 0;
          // sales already taxed at the till are not taxed twice
          const taxed = Math.min(turnover, b.salesTaxed ?? 0);
          b.salesTaxed = 0;
          const owner = b.owner >= 0 ? pop.families.get(b.owner) : undefined;
          if (owner && taxed) owner.money += taxed * (1 - city.taxRate * 0.8) * OWNER_SHARE;
          turnover -= taxed;
        } else if (b.kind === 'carmarket') {
          turnover = b.workers > 0 ? r.carSales / Math.max(1, working('carmarket').length) : 0;
        } else if (d.revenue) {
          turnover = d.revenue * (d.jobs ? Math.min(1, b.workers / d.jobs) : 1) * (b.powered ? 1 : 0.5);
        }
        if (!turnover) continue;
        turnover *= (1 + 0.25 * this.skilledShare(b)) * (city.smart ? 1.1 : 1);
        business += turnover * city.taxRate * 0.8;
        const owner = b.owner >= 0 ? pop.families.get(b.owner) : undefined;
        if (owner) {
          const profit = turnover * (1 - city.taxRate * 0.8) * OWNER_SHARE;
          owner.money += profit;
          owner.income += Math.round(profit);
        } else if (b.owner >= 0) b.owner = -1;
      }
      const net = Math.round(r.incomeTax + r.foodSales + r.propertyTax + rentToCity + r.utilities + business - r.publicWages - upkeep);
      city.money += net;
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
          city.money += GRAVE_COST;
          buildings.addGrave(cemetery, { name: d.name, family: d.surname, age: d.age, day: eco.day });
          say(t('{name} was laid to rest at the cemetery (${cost})', { name: `${d.name} ${d.surname}`.trim(), cost: GRAVE_COST }));
        }
      }
      // ranch calf breeding
      for (const b of buildings.ofKind('ranch')) {
        if (b.city === city.id && b.workers > 0 && city.food > 50 && (b.cattleCount ?? 4) < 4) {
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
      this.entrepreneurs(city.id, say);
      this.airQuality(city, say);
      this.tourism(city, own, say);
      this.leisure.daily(city, own, say);
      this.updateHappiness(city, own, r, belongs, say);
      this.smartCity(city, belongs, say);
      this.elect(city, belongs, say);
      this.upgradeHouses(city.id, say);
      for (const inc of r.incidents) if (inc.kind === 'accident') this.crash(city.id);
      for (const inc of r.incidents) {
        if (inc.kind === 'fight') say(t('{a} and {b} got into a fight', { a: inc.a, b: inc.b ?? '' }));
        else if (inc.kind === 'accident') say(t('{a} was hurt in a car accident', { a: inc.a }));
        else say(t('{a} was murdered by {b}! The killer was arrested', { a: inc.a, b: inc.b ?? '' }));
      }
      for (const d of r.deaths.slice(0, 3)) say(t('{name} died ({cause})', { name: `${d.name} ${d.surname}`.trim(), cause: t(d.cause) }));
      if (r.deaths.length > 3) say(t('{n} people died today', { n: r.deaths.length }));
      if (r.leftTown) say(t('{n} people left town (debt)', { n: r.leftTown }));
      if (r.carsBought) say(t('{n} families bought a car', { n: r.carsBought }));
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
    terrain.regrow();
    this.rained.clear();
    const month = monthOf(eco.day);
    this.festival = month === 2 ? 'Navruz' : month === 0 ? 'New Year' : null;
    if (this.festival) this.events.push(t(this.festival === 'Navruz' ? 'Happy Navruz! Festivities in the parks and squares' : 'Happy New Year! Fireworks over the city tonight'));
    const season = seasonOf(month);
    if (!this.calm && season === 'summer' && weather.drought <= 0 && Math.random() < 0.1) {
      weather.drought = 3;
      this.events.push(t('Drought! No rain for days and farms give less food'));
    }
    weather.newDay(season);
    if (!this.calm && season === 'winter' && Math.random() < 0.18) {
      for (const c of pop.citizens.values()) c.health = Math.max(1, c.health - 8);
      this.events.push(t('A cold snap! People get sick more easily'));
    }
    pop.assign(buildings);
    this.rebuildGrid();
    pop.planDay();
  }

  /**
   * Rich families do business: they buy a city-owned business, or build a new shop when the town lacks one.
   * The city gets the sale price; the family later earns a share of the turnover.
   */
  private entrepreneurs(cityId: number, say: (msg: string) => void) {
    const { pop, buildings, eco } = this.c;
    const city = eco.cities.get(cityId);
    if (!city) return;
    const families = [...pop.families.values()].filter((f) => buildings.get(f.home)?.city === cityId && f.money > 900)
      .sort((a, b) => b.money - a.money);
    if (!families.length) return;
    const owners = new Set(buildings.list.map((b) => b.owner));
    const rich = families.filter((f) => !owners.has(f.id));
    if (!rich.length) return;
    // nobody can build without a working construction company
    const canBuild = buildings.list.some((b) => b.kind === 'construction' && b.city === cityId && b.built >= 1 && b.workers > 0);

    // 1) buy a finished business the city still owns
    if (Math.random() < 0.35) {
      const forSale = buildings.list.filter((b) => b.city === cityId && b.built >= 1 && b.owner < 0 && BUSINESS_KINDS.includes(b.kind));
      for (const b of forSale) {
        const price = Math.round(BUILDINGS[b.kind].money * 1.2);
        const buyer = rich.find((f) => f.money > price + 400);
        if (!buyer) continue;
        buyer.money -= price;
        city.money += price;
        b.owner = buyer.id;
        say(t('The {family} family bought the {name} for ${price}', { family: buyer.surname, name: t(BUILDINGS[b.kind].name), price }));
        return;
      }
    }

    // private construction is slow and only answers a real need: at most one project every few days
    if (!canBuild) return;
    if (eco.day - (this.privateBuild.get(cityId) ?? -99) < 3 || Math.random() > 0.35) return;
    // 2a) a businessman builds an apartment block to rent out when homes run short in a bigger town
    if (this.freeHomes(cityId).length < 2 && (this.people.get(cityId) ?? 0) >= 60) {
      const cost = BUILDINGS.apartment.money * 1.4;
      const investor = rich.find((f) => f.money > cost + 800);
      const home = investor && buildings.get(investor.home);
      if (investor && home && this.privateSite('apartment', home, (x, z) => {
        investor.money -= cost;
        buildings.place('apartment', x, z, { city: cityId, owner: investor.id });
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building an apartment block to rent out', { family: investor.surname }));
      })) return;
    }
    // 2b) parents build a house for a grown-up child when the city has no free homes
    if (!this.freeHomes(cityId).length) {
      const parents = rich.find((f) => f.money > 700 && pop.members(f).some((m) => m.role === 'child' && m.age >= 20));
      const home = parents && buildings.get(parents.home);
      if (parents && home && this.privateSite('house', home, (x, z) => {
        parents.money -= BUILDINGS.house.money * 1.5;
        buildings.place('house', x, z, { city: cityId });
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building a house for their grown-up child', { family: parents.surname }));
      })) return;
    }
    // 2b) a filling station once the town has enough cars
    const cityCars = [...pop.families.values()].filter((f) => f.car && buildings.get(f.home)?.city === cityId).length;
    if (cityCars >= 20 && !buildings.list.some((b) => b.kind === 'gasstation' && b.city === cityId)) {
      const investor = rich.find((f) => f.money > BUILDINGS.gasstation.money * 1.5 + 400);
      const home = investor && buildings.get(investor.home);
      if (investor && home && this.privateSite('gasstation', home, (x, z) => {
        investor.money -= BUILDINGS.gasstation.money * 1.5;
        buildings.place('gasstation', x, z, { city: cityId, owner: investor.id });
        this.privateBuild.set(cityId, eco.day);
        say(t('The {family} family is building a {name}', { family: investor.surname, name: t(BUILDINGS.gasstation.name) }));
      })) return;
    }
    // 2c) a new grocery / clothing store when there are too few for the people
    const people = this.populationByCity().get(cityId) ?? 0;
    const count = (kind: string) => buildings.list.filter((b) => b.city === cityId && b.kind === kind).length;
    const kind = count('grocery') < Math.floor(people / 50) + 1 ? 'grocery' : count('clothes') < Math.floor(people / 80) + 1 ? 'clothes' : null;
    if (!kind) return;
    const cost = BUILDINGS[kind].money * 1.5;
    const builder = rich.find((f) => f.money > cost + 400);
    const home = builder && buildings.get(builder.home);
    if (!builder || !home) return;
    for (let r = 1; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = home.x + dx, z = home.z + dz;
        if (!buildings.check(kind, x, z).ok) continue;
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

  /** Find a buildable spot near a family's home and build there. */
  private privateSite(kind: 'house' | 'gasstation' | 'apartment', home: Building, build: (x: number, z: number) => void) {
    const { buildings, terrain } = this.c;
    for (let r = 1; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = home.x + dx, z = home.z + dz;
        if (!buildings.check(kind, x, z).ok) continue;
        build(x, z);
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

  private immigrate() {
    const { pop, eco, buildings } = this.c;
    const people = this.populationByCity();
    for (const city of eco.cities.values()) {
      const homes = this.freeHomes(city.id);
      if (!homes.length) continue;
      let jobs = 0, staffed = 0;
      for (const b of buildings.list) if (b.city === city.id) { jobs += BUILDINGS[b.kind].jobs; staffed += b.workers; }
      const n = people.get(city.id) ?? 0;
      if (!buildings.list.some((b) => b.kind === 'watertower' && b.city === city.id)) continue;
      if (city.happiness < 45 || jobs - staffed < 2 || city.food < n * 2 || city.powered < 0.6 || city.water < 0.8) continue;
      pop.createFamily(pick(homes).id, { carChance: 0.3 });
      pop.assign(buildings);
      pop.planDay();
      this.events.push(eco.cities.size > 1 ? `${city.name}: ${t('A new family moved in')}` : t('A new family moved in'));
    }
  }

  /** Everyone eats a little all the time; shortages are remembered for the evening settlement. */
  private eat(dt: number) {
    for (const city of this.c.eco.cities.values()) {
      const need = ((this.people.get(city.id) ?? 0) * dt) / DAY_SECONDS;
      if (need <= 0) continue;
      const eaten = Math.min(Math.max(0, city.food), need);
      city.food -= eaten;
      const m = this.meals.get(city.id) ?? { eaten: 0, short: 0 };
      m.eaten += eaten;
      m.short += need - eaten;
      this.meals.set(city.id, m);
    }
  }

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
          if (city.food >= feedNeeded && city.food > 5) {
            city.food -= feedNeeded;
            b.cattleHunger = Math.max(0, (b.cattleHunger ?? 0) - dt * 2);
          } else {
            b.cattleHunger = (b.cattleHunger ?? 0) + (dt / 15) * 10;
            if (b.cattleHunger >= 100) {
              b.cattleHunger = 0;
              b.cattleCount = Math.max(0, cattle - 1);
              this.c.effects.puff(b.mesh.position.x, b.mesh.position.z, 0.5, 12, ['#8a5a35', '#2b2622', '#f4f1ea']);
              this.events.push(t('A cow died in the ranch due to lack of feed (grass/crops)!'));
            }
          }
        }
      }
      if (b.kind === 'ironmine') city.iron += IRON_PER_DAY * Math.min(1, b.workers / d.jobs) * share;
      if (b.kind === 'carfactory' && b.stored < CARS.factoryMax) {
        const made = CARS.perDay * Math.min(1, b.workers / d.jobs) * (b.powered ? 1 : 0.4) * share;
        const iron = made * CARS.iron;
        if (city.iron >= iron) { city.iron -= iron; b.stored += made; }
      }
      if (b.kind === 'carfactory' && b.stored >= CARS.truckLoad && b.trucks === 0 && b.access >= 0) this.deliverCars(b);
      if (!d.food || !d.jobs) continue;
      let f = d.food * Math.min(1, b.workers / d.jobs);
      if (b.kind === 'farm') f *= (growingSeason(month) ? (b.irrigated ? 1 : 0.15) : 0) * (this.c.weather.drought > 0 ? 0.4 : 1);
      if (b.kind === 'fishery') f *= seasonOf(month) === 'winter' ? 0.3 : 1;
      if (b.kind === 'orchard') f *= month >= 5 && month <= 9 ? 1.5 : month === 3 || month === 4 || month === 10 ? 0.4 : 0;
      if (b.kind === 'ranch') f *= (seasonOf(month) === 'winter' ? 0.7 : 1) * ((b.cattleCount ?? 4) / 4);
      city.food += f * share;
      city.foodMade += f * share;
    }

    for (const b of buildings.ofKind('quarry')) {
      const th = buildings.townHall(b.city);
      if (b.built < 1) continue;
      b.stored = Math.min(QUARRY.maxStored, b.stored + QUARRY.perDay * Math.min(1, b.workers / BUILDINGS.quarry.jobs) * (b.powered ? 1 : 0.5) * share);
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
        purpose: 'Delivering stone', driverName: 'Truck driver', fromName: 'Stone Quarry', destName: 'Town Hall',
        onArrive: () => { const own = eco.cities.get(b.city); if (own) own.stone += QUARRY.truckLoad; this.truckBack(b); },
        onFail: () => { b.stored += QUARRY.truckLoad; b.trucks = Math.max(0, b.trucks - 1); },
      });
      if (sent) { b.stored -= QUARRY.truckLoad; b.trucks++; }
    }
  }

  /** Miners carry stone over footpaths (or open ground) when no road connects the quarry. */
  private sendPorter(b: Building, th: Building) {
    const { pop, buildings, eco } = this.c;
    let active = 0;
    for (const id of this.porters) if (pop.citizens.get(id)?.job === b.id) active++;
    if (active >= 2) return;
    const worker = [...pop.citizens.values()].find((c) => c.job === b.id && c.state === 'away' && c.at === b.id && !this.porters.has(c.id) && !c.walker);
    if (!worker) return;
    this.porters.add(worker.id);
    b.stored -= QUARRY.truckLoad;
    worker.activity = 'Carrying stone';
    const finish = () => {
      this.porters.delete(worker.id);
      if (!this.alive(worker)) return;
      if (worker.walker) { this.c.walkers.dismiss(worker.walker); worker.walker = undefined; }
      if (worker.state === 'away') worker.activity = 'At work';
    };
    this.walk(worker, buildings.door(b), buildings.frontTile(b), th, () => {
      if (!this.alive(worker)) { this.porters.delete(worker.id); return; }
      const own = eco.cities.get(b.city);
      if (own) own.stone += QUARRY.truckLoad;
      if (worker.walker) worker.walker.carry = 'none';
      worker.activity = 'Walking back to the quarry';
      if (b.removed) return finish();
      this.walk(worker, buildings.door(th), buildings.frontTile(th), b, finish);
    }, 'log');
  }

  /** Trucks bring new cars from the factory to the car market with room in its lot. */
  private deliverCars(factory: Building) {
    const { buildings, traffic } = this.c;
    const market = buildings.list
      .filter((m) => m.kind === 'carmarket' && m.city === factory.city && m.built >= 1 && m.access >= 0 && m.stored + CARS.truckLoad <= CARS.marketMax)
      .sort((a, b) => a.stored - b.stored)[0];
    if (!market) return;
    // next door: the cars are simply driven over
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
          this.events.push(t('The fire spread to the {name}!', { name: t(BUILDINGS[o.kind].name) }));
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
            this.events.push(t('Firefighters put out the fire at the {name}', { name: t(BUILDINGS[b.kind].name) }));
          };
          const nozzle = buildings.door(b);
          // firefighters spray water for a few seconds before the flames die
          const spray = () => { this.sprays.push({ b, x: nozzle.x, z: nozzle.z, t: 3.5, done: putOut }); };
          sound.play('siren', b.mesh.position);
          const sent = station.access >= 0 && b.access >= 0 && traffic.spawn({
            kind: 'truck', from: station.access, to: b.access, color: new THREE.Color('#d9443b'), siren: true,
            purpose: 'Fire call', driverName: 'Firefighter', destName: BUILDINGS[b.kind].name,
            toPos: nozzle, onArrive: spray, onFail: () => { b.fireCrew = false; },
          });
          if (!sent) setTimeout(putOut, 1500);
        }
      }
      if (b.fire <= 0) {
        this.events.push(t('{name} burnt down!', { name: t(BUILDINGS[b.kind].name) }));
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
    let target = 50;
    if (this.festival) target += 12;
    if (city.railLink) target += 4;
    target += this.leisure.bonus(city.id, own);
    target -= Math.min(15, city.pollution * 4);
    target += Math.min(1, (parks * 80) / n) * 10;
    if (has('grocery') || has('market')) target += 7;
    if (has('clothes')) target += 4;
    if (has('hospital')) target += 7;
    if (has('school')) target += 5;
    if (has('police')) target += 4;
    if (has('busdepot')) target += 3;
    target += (workforce ? employed / workforce : 1) * 10 - 5;
    target -= unwell * 30;
    target -= (1 - city.water) * 20 + (1 - city.powered) * 10;
    target -= (city.taxRate - 0.25) * 80;
    target -= r.incidents.filter((i) => i.kind === 'murder').length * 6 + r.incidents.filter((i) => i.kind === 'fight').length * 2;
    target = Math.max(0, Math.min(100, target));
    city.happiness += (target - city.happiness) * 0.4;
    if (city.happiness < 30 && Math.random() < 0.35) {
      const owners = new Set(this.c.buildings.list.map((b) => b.owner));
      const leaving = [...pop.families.values()].find((f) => belongs(f) && !owners.has(f.id));
      if (leaving) {
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
      // tourists also shop in town
      const shops = own.filter((b) => b.workers > 0 && (b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'market'));
      for (const s of shops) s.sales = (s.sales ?? 0) + (guests * 3) / shops.length;
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
  private upgradeHouses(cityId: number, say: (msg: string) => void) {
    const { pop, buildings, effects } = this.c;
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
          this.events.push(t('The traffic police cleared the crash'));
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
      this.events.push(t('{name} died ({cause})', { name: `${c.name} ${f?.surname ?? ''}`, cause: t('lightning') }));
      const cid = (f && buildings.get(f.home)?.city) ?? -1;
      const cemetery = buildings.list.find((b) => b.kind === 'cemetery' && b.city === cid && b.built >= 1 && (b.graves?.length ?? 0) < MAX_GRAVES_PER_CEMETERY * b.level);
      if (cemetery && f && f.money >= GRAVE_COST) {
        f.money -= GRAVE_COST;
        const own = this.c.eco.cities.get(cid);
        if (own) own.money += GRAVE_COST;
        buildings.addGrave(cemetery, { name: c.name, family: f?.surname ?? '', age: Math.floor(c.age), day: this.c.eco.day });
        this.events.push(t('{name} was laid to rest at the cemetery (${cost})', { name: `${c.name} ${f?.surname ?? ''}`.trim(), cost: GRAVE_COST }));
      }
      pop.removeCitizen(c);
      killed++;
    }
    if (inBounds(tx, tz)) {
      const k = idx(tx, tz);
      const b = buildings.at(k);
      if (b && b.kind !== 'townhall') { b.fire = Math.max(b.fire, 14); this.events.push(t('Lightning set the {name} on fire!', { name: t(BUILDINGS[b.kind].name) })); }
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
          c.activity = tod < 0.25 || tod > 0.9 ? 'Sleeping' : 'At home';
          if (tod < c.leaveAt || tod >= c.returnAt - 0.03 || c.age < 3) continue;
        }
        const dest = this.destination(c);
        c.leaveAt = 2;
        if (dest) this.goTo(c, dest);
      } else if (c.state === 'away' && (c.night ? tod >= c.returnAt && tod < 0.5 : tod >= c.returnAt || tod > 0.92)) {
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
      const spots = buildings.list.filter((b) => (!home || b.city === home.city) && b.built >= 1 && (b.kind === 'townhall' || b.kind === 'park' || b.kind === 'market' || b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'bank' || b.kind === 'orchard' || b.kind === 'parking' || b.kind === 'weddinghall' || b.kind === 'school'));
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
      if (spot && traffic.canRoute(home.access, spot.lot.access)) {
        const key = `${spot.lot.id}:${spot.slot}`;
        this.spots.set(key, f.id);
        const car = f.car;
        car.at = 'moving';
        car.fuel = Math.max(0, car.fuel - (6 + Math.random() * 4));
        const slotPos = buildings.slot(spot.lot, spot.slot);
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
    c.activity = c.job === b.id ? 'At work' : c.school === b.id ? 'At school' : 'Visiting';
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
        const slotPos = buildings.slot(lot, car.slot!);
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
    const spend = Math.round((range[0] + Math.random() * (range[1] - range[0])) * (this.festival ? 1.5 : 1));
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
      if (b.kind === 'busdepot') {
        this.dispatchBusFleet(b);
      } else if (b.kind === 'police') {
        const want = Math.min(2, Math.ceil(b.workers / 2));
        if ((this.fleet.get(b.id) ?? 0) >= want) continue;
        const stops: number[] = [];
        for (let z = b.z - POLICE_RANGE; z <= b.z + POLICE_RANGE; z += 2) for (let x = b.x - POLICE_RANGE; x <= b.x + POLICE_RANGE; x += 2) {
          if (inBounds(x, z) && net.type[idx(x, z)]) stops.push(idx(x, z));
        }
        if (!stops.length) continue;
        this.fleet.set(b.id, (this.fleet.get(b.id) ?? 0) + 1);
        this.policePatrol(b, b.access, stops, 4 + Math.floor(Math.random() * 3));
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

  private policePatrol(home: Building, at: number, stops: number[], hops: number): void {
    const { traffic, buildings } = this.c;
    const finish = () => { this.fleet.set(home.id, Math.max(0, (this.fleet.get(home.id) ?? 1) - 1)); };
    if (home.removed) return finish();
    const to = hops <= 0 ? home.access : stops[Math.floor(Math.random() * stops.length)];
    if (to === at && hops > 0) return this.policePatrol(home, at, stops, hops - 1);
    const ok = traffic.spawn({
      kind: 'car', from: at, to, color: new THREE.Color('#1f3f86'),
      fromPos: at === home.access ? buildings.door(home) : undefined,
      toPos: hops <= 0 ? buildings.door(home) : undefined,
      purpose: 'Police patrol route',
      driverName: 'Police officer',
      fromName: BUILDINGS[home.kind].name,
      destName: hops <= 0 ? BUILDINGS[home.kind].name : 'City street',
      homeBuildingId: home.id,
      onArrive: () => { if (hops <= 0) finish(); else this.policePatrol(home, to, stops, hops - 1); },
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

  /** Launch buses from depot to run the transit route continuously. */
  private dispatchBusFleet(depot: Building) {
    // one bus per two drivers, at most BUS.perDepot per depot
    const want = Math.min(BUS.perDepot, Math.max(1, Math.floor(depot.workers / 2)));
    const active = [...this.busFleet.values()].filter((b) => b.depotId === depot.id);
    if (active.length >= want) return;
    const stops = this.getRouteStops(depot);
    if (stops.length < 2) return;
    const startIdx = (active.length * Math.floor(stops.length / want)) % stops.length;
    this.runBusLeg(depot, stops, startIdx, []);
  }

  /** Drive one segment of the route from stops[fromIdx] to stops[nextIdx]. */
  private runBusLeg(depot: Building, stops: number[], fromIdx: number, passengers: BusPassenger[]): void {
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

    const nextIdx = (fromIdx + 1) % stops.length;
    const fromB = buildings.get(stops[fromIdx]);
    const toB = buildings.get(stops[nextIdx]);
    if (!fromB || !toB || fromB.access < 0 || toB.access < 0) return;

    const fromName = BUILDINGS[fromB.kind].name;
    const destName = BUILDINGS[toB.kind].name;
    const routeNum = depot.city + 1;
    const routeName = `Marshrut #${routeNum}`;

    const v = traffic.spawnVehicle({
      kind: 'bus',
      from: fromB.access,
      to: toB.access,
      fromPos: buildings.door(fromB),
      toPos: buildings.door(toB),
      driverName: 'Avtobus haydovchisi',
      purpose: `${routeName}: ${destName} tomon`,
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
    });

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

    // Step C: Proceed along the route
    this.runBusLeg(depot, stops, arrivedIdx, remaining);
  }

  private onBusFailed(vehicleId: number, depot: Building, stops: number[], failedIdx: number) {
    const { buildings, pop } = this.c;
    const bus = this.busFleet.get(vehicleId);
    this.busFleet.delete(vehicleId);
    if (!bus) return;
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
    this.cash(depot.city, BUS.fare - share, 'fares');
    depot.sales = (depot.sales ?? 0) + BUS.fare;
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
        if (!s) continue;
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
  }

  // ---------- work behaviour ----------

  private woodcutterLoop(c: Citizen, hut: Building) {
    const { terrain, buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === hut.id && !hut.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    const tree = terrain.nearestTree(hut.x, hut.z, 10, this.reservedTrees);
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
      walkers.holdFor(w, 1.5, 'chop', () => {
        const down = terrain.chopPart(tree);
        this.reservedTrees.delete(tree);
        effects.puff(treeCenter.x, treeCenter.z, 0.25, down ? 10 : 5, ['#8a5a35', '#6faa45', '#c9a36b']);
        const plants = buildings.ofKind('powerplant').filter((p) => p.city === hut.city);
        const drop = plants.length ? plants.reduce((a, b) => (dist(a, hut) < dist(b, hut) ? a : b)) : hut;
        c.activity = 'Carrying a log';
        this.walk(c, { x: w.x, z: w.z }, tileAt(w), drop, () => {
          const own = eco.cities.get(hut.city);
          if (own) own.wood += WOOD_PER_LOG;
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
   * Construction speed of one site: slow on its own, much faster while builders from a construction company work on it.
   */
  buildSpeed(b: Building) {
    const n = Math.min(4, this.crewSize(b));
    // a Town Hall and the construction company itself go up slowly with hired hands; everything else needs builders
    if (SELF_BUILT[b.kind]) return 0.5 + 0.6 * n;
    return 0.65 * n;
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
  private dispatchBuilders() {
    const { pop, buildings } = this.c;
    for (const c of pop.citizens.values()) {
      if (c.job < 0 || c.state !== 'away' || c.at !== c.job || this.busyBuilders.has(c.id) || c.walker) continue;
      const yard = buildings.get(c.job);
      if (yard?.kind === 'construction' && buildings.list.some((b) => b.built < 1 && b.city === yard.city)) this.builderLoop(c, yard);
    }
  }

  /** A builder walks from the yard to the least-crewed unfinished building of the city and works there. */
  private builderLoop(c: Citizen, yard: Building) {
    const { buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === yard.id && !yard.removed && eco.timeOfDay < c.returnAt;
    const leave = (site?: Building) => { if (site) this.crews.get(site.id)?.delete(c.id); };
    if (!atWork()) { this.busyBuilders.delete(c.id); return; }
    const sites = buildings.list.filter((b) => b.built < 1 && b.city === yard.city && !b.removed);
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
    c.activity = 'Walking to a construction site';
    const fromTile = c.walker && !c.walker.leaving ? tileAt(from) : buildings.frontTile(yard);
    this.walk(c, from, fromTile, null, () => {
      const w = c.walker;
      if (!w || !atWork() || site.removed) { leave(site); this.busyBuilders.delete(c.id); return; }
      const work = () => {
        const ww = c.walker;
        if (!ww || !atWork() || site.removed) { leave(site); this.busyBuilders.delete(c.id); return; }
        if (site.built >= 1) { leave(site); this.builderLoop(c, yard); return; }
        c.activity = 'Building';
        if (Math.random() < 0.35) effects.puff(stand.x, stand.z, 0.15, 3, ['#d8c9a6', '#bdb7aa']);
        walkers.holdFor(ww, 1.6, 'chop', work, center);
      };
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
      const slotPos = buildings.slot(lot, slot);
      if (Math.hypot(slotPos.x - x, slotPos.z - z) < 0.4) return famId;
    }
    return undefined;
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
        const other = this.freeHomes(b.city)[0];
        if (other) f.home = other.id;
        else {
          for (const m of pop.members(f)) if (m.walker) this.c.walkers.dismiss(m.walker);
          pop.removeFamily(f);
          this.events.push(t('A family left town — their house was destroyed'));
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
