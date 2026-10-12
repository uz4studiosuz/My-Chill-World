import * as THREE from 'three';
import { DAY_SECONDS } from '../config';
import { DIRS, N, tileToWorld, worldToTile, inBounds, idx } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { Terrain } from '../world/Terrain';
import { RoadNetwork } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { Building, Buildings, Point } from '../buildings/Buildings';
import { BUILDINGS, BUSINESS_KINDS, FIRE_RANGE, HOUSE_UPGRADE, OWNER_SHARE, LOAN, GRAVE_COST, MAX_GRAVES_PER_CEMETERY, QUARRY, WOOD_PER_LOG } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { growingSeason, monthOf, seasonOf } from '../sim/Calendar';
import { Citizen, DayReport, Family, Population } from '../people/Population';
import type { City } from '../sim/Economy';
import { Carry, Walkers } from '../people/Walkers';
import { PedGraph, pedPath } from '../people/PedGraph';
import { Traffic } from '../traffic/Traffic';
import { Effects } from '../fx/Effects';
import { Weather } from '../fx/Weather';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';

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
}

const TRUCKS_PER_QUARRY = 2;
const PARK_RADIUS = 6;
const IMMIGRATION_INTERVAL = DAY_SECONDS / 3;
const ROAD_UPKEEP = 0.1;
const BRIDGE_UPKEEP = 0.5;
/** Working hours as fractions of the day (8:00–17:30). */
const WORK_FROM = 0.33, WORK_TO = 0.73;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

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
  /** Builders currently working on each construction site. */
  private crews = new Map<number, Set<number>>();
  private busyBuilders = new Set<number>();
  private presentT = 0;
  private fireT = 0;
  private gridIds = new Set<number>();
  private rained = new Set<number>();
  events: string[] = [];

  constructor(private c: LifeContext) {
    const { map, net, footpaths, canals, buildings } = c;
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
    this.updateEnergy(dt);
    this.presentT -= dt;
    if (this.presentT <= 0) { this.presentT = 0.5; this.countPresent(); this.checkRain(); this.dispatchBuilders(); }
    this.produce(dt);
    this.schedule();
    this.updateFires(dt);
    this.stormT -= dt;
    if (this.stormT <= 0) { this.stormT = DAY_SECONDS * (0.02 + Math.random() * 0.04); this.storm(); }
    this.immigrationT += dt;
    if (this.immigrationT > IMMIGRATION_INTERVAL) { this.immigrationT = 0; this.immigrate(); }
  }

  parkedCars() {
    const { pop, buildings } = this.c;
    const out: { x: number; z: number; rot: number; color: THREE.Color }[] = [];
    for (const f of pop.families.values()) {
      if (!f.car || f.car.at === 'moving') continue;
      const color = colorOf(f.car.color);
      if (f.car.at === 'home') {
        const h = buildings.get(f.home);
        if (h) out.push({ ...buildings.slot(h, 0), color });
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
    const taken = new Set([...pop.families.values()].map((f) => f.home));
    return buildings.ofKind('house').filter((h) => h.built >= 1 && !taken.has(h.id) && (city === undefined || h.city === city));
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
    for (const p of buildings.ofKind('powerplant')) if (p.access >= 0 && p.workers > 0) live.add(comp[p.access]);
    this.gridIds.clear();
    for (const b of buildings.list) if (b.access >= 0 && live.has(comp[b.access])) this.gridIds.add(b.id);
  }

  onGrid(b: Building) { return this.gridIds.has(b.id); }

  private updateEnergy(dt: number) {
    const { buildings, eco } = this.c;
    const plants: { city: (typeof eco.city); power: number }[] = [];
    let total = 0;
    for (const city of eco.cities.values()) {
      let demand = 0, capacity = 0;
      for (const b of buildings.list) {
        if (b.city !== city.id || b.built < 1) continue;
        const d = BUILDINGS[b.kind];
        if (d.energy && this.gridIds.has(b.id)) demand += d.energy;
        if (d.power && b.access >= 0) {
          const p = d.power * Math.min(1, b.workers / d.jobs);
          capacity += p;
          if (p > 0) plants.push({ city, power: p });
        }
      }
      city.energyDemand = demand;
      city.energyCapacity = capacity;
      total += demand;
    }
    eco.updateEnergy(dt, total, plants);
    for (const b of buildings.list) {
      if (!BUILDINGS[b.kind].energy) { b.powered = true; continue; }
      const city = eco.cities.get(b.city);
      b.powered = this.gridIds.has(b.id) && !!city && city.powered > 0.35;
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
      const staffed = (kind: string) => own.some((b) => b.kind === kind && b.workers > 0);
      const heal = own.reduce((a, b) => a + BUILDINGS[b.kind].heal * (BUILDINGS[b.kind].jobs ? Math.min(1, b.workers / BUILDINGS[b.kind].jobs) : 1), 0);
      const r = pop.daily(buildings, belongs, city.food, city.water, () => this.freeHomes(city.id), hasHall, {
        heal: Math.min(40, heal), carMarket: staffed('carmarket'),
        shops: { market: staffed('market'), grocery: staffed('grocery'), clothes: staffed('clothes') },
        taxRate: city.taxRate,
        safety: Math.min(0.75, own.filter((b) => b.kind === 'police').reduce((a, b) => a + 0.45 * Math.min(1, b.workers / BUILDINGS.police.jobs), 0)),
      });
      city.food -= r.foodEaten;
      city.foodYesterday = { made: Math.round(city.foodMade), eaten: r.foodEaten };
      city.foodMade = 0;
      const interest = city.loan * LOAN.interest;
      const upkeep = Math.round(roadShare + interest + buildings.list.reduce((a, b) => (b.city === city.id ? a + BUILDINGS[b.kind].upkeep : a), 0));
      // business tax: turnover of staffed shops, factories, banks… plus market and car dealer sales
      const cars = [...pop.families.values()].filter((f) => f.car && homeCity(f) === city.id).length;
      // each business pays 20% tax on its turnover; a family owner keeps a share as profit
      const working = (kind: string) => own.filter((b) => b.kind === kind && b.workers > 0);
      let business = 0;
      for (const b of own) {
        const d = BUILDINGS[b.kind];
        let turnover = 0;
        if (b.kind === 'market' || b.kind === 'grocery' || b.kind === 'clothes') {
          turnover = b.workers > 0 ? r.spent[b.kind] / Math.max(1, working(b.kind).length) : 0;
        } else if (b.kind === 'carmarket') {
          turnover = b.workers > 0 ? r.carSales / Math.max(1, working('carmarket').length) : 0;
        } else if (d.revenue) {
          turnover = d.revenue * (d.jobs ? Math.min(1, b.workers / d.jobs) : 1) * (b.powered ? 1 : 0.5);
          if (b.kind === 'gasstation') turnover += Math.min(150, cars * 3) * (b.workers > 0 ? 1 : 0);
        }
        if (!turnover) continue;
        business += turnover * city.taxRate * 0.8;
        const owner = b.owner >= 0 ? pop.families.get(b.owner) : undefined;
        if (owner) {
          const profit = turnover * (1 - city.taxRate * 0.8) * OWNER_SHARE;
          owner.money += profit;
          owner.income += Math.round(profit);
        } else if (b.owner >= 0) b.owner = -1;
      }
      const net = Math.round(r.incomeTax + r.foodSales + r.propertyTax + r.utilities + business - r.publicWages - upkeep);
      city.money += net;
      city.balance = {
        incomeTax: Math.round(r.incomeTax), foodSales: r.foodSales, propertyTax: r.propertyTax, businessTax: Math.round(business),
        utilities: Math.round(r.utilities), publicWages: Math.round(r.publicWages), upkeep, net,
      };
      city.deaths = r.deaths.length;

      if (r.births) say(r.births === 1 ? t('A baby was born!') : t('{n} babies were born!', { n: r.births }));
      for (const [a, b] of r.weddings) {
        say(t('{a} and {b} got married!', { a, b }));
        const hall = buildings.list.find((x) => x.kind === 'weddinghall' && x.city === city.id);
        if (hall) this.c.effects.hearts(hall.mesh.position.x, hall.mesh.position.z);
      }
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
      this.entrepreneurs(city.id, say);
      this.updateHappiness(city, own, r, belongs, say);
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

    for (const c of pop.citizens.values()) if (c.state !== 'home') this.teleportHome(c);
    for (const w of [...this.c.walkers.list]) if (!w.leaving) this.c.walkers.dismiss(w);
    this.porters.clear();
    this.crews.clear();
    this.busyBuilders.clear();
    this.cleanupSpots();
    terrain.regrow();
    this.rained.clear();
    const season = seasonOf(monthOf(eco.day));
    if (season === 'summer' && weather.drought <= 0 && Math.random() < 0.1) {
      weather.drought = 3;
      this.events.push(t('Drought! No rain for days and farms give less food'));
    }
    weather.newDay(season);
    if (season === 'winter' && Math.random() < 0.18) {
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

    // 2) build a new grocery / clothing store when there are too few for the people
    if (Math.random() > 0.3) return;
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
        const b = buildings.place(kind, x, z, { city: cityId, owner: builder.id });
        this.c.terrain.clearTiles(buildings.footprint(kind, x, z).map((tl) => tl.z * N + tl.x));
        this.rebuildGrid();
        say(t('The {family} family is building a {name}', { family: builder.surname, name: t(BUILDINGS[b.kind].name) }));
        return;
      }
    }
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
      if (b.fire > 0 && weather.isWet(b.mesh.position.x, b.mesh.position.z)) {
        b.fire = 0;
        this.events.push(t('The rain put out a fire'));
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
      if (!d.food || !d.jobs) continue;
      let f = d.food * Math.min(1, b.workers / d.jobs);
      if (b.kind === 'farm') f *= (growingSeason(month) ? (b.irrigated ? 1 : 0.15) : 0) * (this.c.weather.drought > 0 ? 0.4 : 1);
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

  private truckBack(b: Building) {
    const { buildings, traffic } = this.c;
    const th = buildings.townHall(b.city);
    const done = () => { b.trucks = Math.max(0, b.trucks - 1); };
    if (b.removed || !th || b.access < 0) return done();
    const ok = traffic.spawn({ kind: 'truck', from: th.access, to: b.access, fromPos: buildings.door(th), toPos: buildings.door(b), onArrive: done, onFail: done });
    if (!ok) done();
  }

  // ---------- fire & lightning ----------

  /** A thunderstorm now and then strikes on its own during natural rain. */
  private storm() {
    const { weather, buildings, effects } = this.c;
    if (!weather.naturalActive || weather.kind !== 'rain' || Math.random() < 0.45) return;
    let x = 0, z = 0;
    if (buildings.list.length) {
      const b = pick(buildings.list);
      x = b.mesh.position.x + (Math.random() - 0.5) * 6;
      z = b.mesh.position.z + (Math.random() - 0.5) * 6;
    }
    weather.strike(x, z);
    effects.puff(x, z, 0.4, 16, ['#fff3b0', '#ffd166', '#3a2a20']);
    this.lightning(x, z);
  }

  private updateFires(dt: number) {
    const { buildings, effects, traffic } = this.c;
    this.fireT -= dt;
    const emit = this.fireT <= 0;
    if (emit) this.fireT = 0.15;
    for (const b of [...buildings.list]) {
      if (b.fire <= 0) continue;
      b.fire -= dt;
      if (emit) effects.fire(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.6);
      // flames jump to neighbours
      if (Math.random() < dt * 0.04) {
        const near = buildings.list.filter((o) => o !== b && o.fire <= 0 && o.kind !== 'townhall' && Math.hypot(o.x - b.x, o.z - b.z) < 2.6);
        if (near.length) {
          const o = near[Math.floor(Math.random() * near.length)];
          o.fire = 14;
          sound.play('fire');
          this.events.push(t('The fire spread to the {name}!', { name: t(BUILDINGS[o.kind].name) }));
        }
      }
      // firefighters
      if (!b.fireCrew) {
        const station = buildings.list.find((s) => s.kind === 'firestation' && s.city === b.city && s.built >= 1 && s.workers > 0 && Math.hypot(s.x - b.x, s.z - b.z) <= FIRE_RANGE);
        if (station) {
          b.fireCrew = true;
          const putOut = () => {
            if (b.removed || b.fire <= 0) return;
            b.fire = 0;
            b.fireCrew = false;
            effects.puff(b.mesh.position.x, b.mesh.position.z, 0.6, 14, ['#bfe3ff', '#ffffff', '#9aa3ab']);
            this.events.push(t('Firefighters put out the fire at the {name}', { name: t(BUILDINGS[b.kind].name) }));
          };
          const sent = station.access >= 0 && b.access >= 0 && traffic.spawn({
            kind: 'truck', from: station.access, to: b.access, color: new THREE.Color('#d9443b'),
            toPos: buildings.door(b), onArrive: putOut, onFail: () => { b.fireCrew = false; },
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

  /** Rich families add a floor to their house (pays more property tax). */
  private upgradeHouses(cityId: number, say: (msg: string) => void) {
    const { pop, buildings, effects } = this.c;
    if (Math.random() > 0.4) return;
    for (const f of pop.families.values()) {
      const h = buildings.get(f.home);
      if (!h || h.city !== cityId || h.level >= HOUSE_UPGRADE.maxLevel || f.money < HOUSE_UPGRADE.minSavings) continue;
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
    effects.wreck(x, z);
    sound.play('demolish');
    const hospital = buildings.list.find((b) => b.kind === 'hospital' && b.city === cityId && b.built >= 1 && b.access >= 0);
    if (hospital) {
      traffic.spawn({
        kind: 'car', from: hospital.access, to: k, color: new THREE.Color('#ffffff'), fromPos: buildings.door(hospital),
        onArrive: () => { traffic.spawn({ kind: 'car', from: k, to: hospital.access, color: new THREE.Color('#ffffff'), toPos: buildings.door(hospital) }); },
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
        c.activity = tod < 0.25 || tod > 0.9 ? 'Sleeping' : 'At home';
        if (tod < c.leaveAt || tod >= c.returnAt - 0.03 || c.age < 3) continue;
        const dest = this.destination(c);
        c.leaveAt = 2;
        if (dest) this.goTo(c, dest);
      } else if (c.state === 'away' && (tod >= c.returnAt || tod > 0.92)) {
        this.goHome(c);
      }
    }
  }

  private destination(c: Citizen): Building | undefined {
    const { buildings } = this.c;
    if (c.job >= 0) return buildings.get(c.job);
    if (c.school >= 0) return buildings.get(c.school);
    if (c.errand) {
      const home = buildings.get(this.family(c)?.home ?? -1);
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

    if (f.car?.at === 'home' && c.age >= 18 && home.access >= 0) {
      const spot = this.findSpot(dest);
      if (spot && traffic.canRoute(home.access, spot.lot.access)) {
        const key = `${spot.lot.id}:${spot.slot}`;
        this.spots.set(key, f.id);
        const car = f.car;
        car.at = 'moving';
        const slotPos = buildings.slot(spot.lot, spot.slot);
        const ok = traffic.spawn({
          kind: 'car', from: home.access, to: spot.lot.access, color: colorOf(car.color),
          fromPos: buildings.slot(home, 0), toPos: slotPos,
          onArrive: () => {
            car.at = 'away'; car.lot = spot.lot.id; car.slot = spot.slot;
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
    if (this.rideBus(c, home, dest, arrive)) return;
    c.activity = purpose === 'work' ? 'Walking to work' : purpose === 'school' ? 'Walking to school' : 'Out for a walk';
    this.walk(c, buildings.door(home), buildings.frontTile(home), dest, arrive, this.carryFor(c));
  }

  private arrive(c: Citizen, b: Building) {
    if (!this.alive(c)) return;
    if (b.removed) { this.teleportHome(c); return; }
    c.state = 'away';
    c.at = b.id;
    const work = c.job === b.id ? BUILDINGS[b.kind].work : 'indoor';
    c.activity = c.job === b.id ? 'At work' : c.school === b.id ? 'At school' : 'Visiting';
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
    c.state = 'travel';
    c.activity = 'Going home';
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
          const ok = traffic.spawn({
            kind: 'car', from: lot.access, to: home.access, color: colorOf(car.color),
            fromPos: slotPos, toPos: buildings.slot(home, 0),
            onArrive: () => { car.at = 'home'; done(); },
            onFail: () => { car.at = 'home'; done(); },
          });
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
    if (!outside && at && this.rideBus(c, at, home, done)) return;
    this.walk(c, from, fromTile, home, done, this.carryFor(c));
  }

  /** Public transport: with a staffed bus depot, people without a car take the bus for longer trips. */
  private rideBus(c: Citizen, from: Building, to: Building, done: () => void) {
    const { buildings, traffic } = this.c;
    if (from.access < 0 || to.access < 0 || dist(from, to) < 7 || c.age < 6) return false;
    if (!buildings.list.some((b) => b.kind === 'busdepot' && b.city === from.city && b.built >= 1 && b.workers > 0)) return false;
    const ok = traffic.spawn({
      kind: 'bus', from: from.access, to: to.access, fromPos: buildings.door(from), toPos: buildings.door(to),
      onArrive: () => done(),
      onFail: () => { if (this.alive(c)) this.walk(c, buildings.door(from), buildings.frontTile(from), to, done); },
    });
    if (!ok) return false;
    if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
    c.activity = 'Riding the bus';
    return true;
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
    const crew = this.crews.get(b.id);
    let n = 0;
    if (crew) for (const id of crew) if (this.c.pop.citizens.get(id)?.activity === 'Building') n++;
    return 0.5 + 0.6 * Math.min(4, n);
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
    return null;
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
    if (b.kind === 'house') {
      const f = pop.familyAt(b.id);
      if (f) {
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
