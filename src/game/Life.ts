import * as THREE from 'three';
import { DAY_SECONDS } from '../config';
import { DIRS, N, tileToWorld, worldToTile, inBounds, idx } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { Terrain } from '../world/Terrain';
import { RoadNetwork } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { Building, Buildings, Point } from '../buildings/Buildings';
import { BUILDINGS, GRAVE_COST, MAX_GRAVES_PER_CEMETERY, QUARRY, WOOD_PER_LOG } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { growingSeason, monthOf, seasonOf } from '../sim/Calendar';
import { Citizen, DayReport, Population } from '../people/Population';
import { Carry, Walkers } from '../people/Walkers';
import { PedGraph, pedPath } from '../people/PedGraph';
import { Traffic } from '../traffic/Traffic';
import { Effects } from '../fx/Effects';
import { Weather } from '../fx/Weather';
import { t } from '../i18n/i18n';

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
  private presentT = 0;
  private fireT = 0;
  private gridIds = new Set<number>();
  private rained = new Set<number>();
  private foodMade = 0;
  foodYesterday = { made: 0, eaten: 0 };
  waterSupply = 1;
  lastReport: DayReport | null = null;
  lastBalance = { incomeTax: 0, foodSales: 0, propertyTax: 0, publicWages: 0, upkeep: 0, net: 0 };
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
    if (this.presentT <= 0) { this.presentT = 0.5; this.countPresent(); this.checkRain(); }
    this.produce(dt);
    this.schedule();
    this.updateFires(dt);
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

  freeHomes() {
    const { buildings, pop } = this.c;
    const taken = new Set([...pop.families.values()].map((f) => f.home));
    return buildings.ofKind('house').filter((h) => !taken.has(h.id));
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
    let demand = 0, capacity = 0;
    for (const b of buildings.list) {
      const d = BUILDINGS[b.kind];
      if (d.energy && this.gridIds.has(b.id)) demand += d.energy;
      if (d.power && b.access >= 0) capacity += d.power * Math.min(1, b.workers / d.jobs);
    }
    eco.updateEnergy(dt, demand, capacity);
    for (const b of buildings.list) {
      if (!BUILDINGS[b.kind].energy) { b.powered = true; continue; }
      b.powered = this.gridIds.has(b.id) && eco.powered > 0.35;
    }
    let water = 0;
    for (const w of buildings.ofKind('watertower')) {
      water += BUILDINGS.watertower.water * (w.workers > 0 ? 1 : 0.5) * (w.powered ? 1 : 0.3);
    }
    this.waterSupply = this.c.pop.size ? Math.min(1, water / this.c.pop.size) : 1;
  }

  // ---------- day settlement ----------

  private newDay() {
    const { pop, eco, buildings, terrain, weather } = this.c;
    const r = pop.daily(buildings, eco.food, this.waterSupply, () => this.freeHomes(), buildings.ofKind('weddinghall').length > 0);
    eco.food -= r.foodEaten;
    this.foodYesterday = { made: Math.round(this.foodMade), eaten: r.foodEaten };
    this.foodMade = 0;
    const upkeep = Math.round(this.roadUpkeep() + buildings.list.reduce((a, b) => a + BUILDINGS[b.kind].upkeep, 0));
    const net = Math.round(r.incomeTax + r.foodSales + r.propertyTax - r.publicWages - upkeep);
    eco.money += net;
    this.lastBalance = { incomeTax: Math.round(r.incomeTax), foodSales: r.foodSales, propertyTax: r.propertyTax, publicWages: Math.round(r.publicWages), upkeep, net };
    this.lastReport = r;
    for (const c of pop.citizens.values()) if (c.state !== 'home') this.teleportHome(c);
    for (const w of [...this.c.walkers.list]) if (!w.leaving) this.c.walkers.dismiss(w);
    this.cleanupSpots();
    terrain.regrow();
    this.rained.clear();
    weather.newDay(seasonOf(monthOf(eco.day)));
    pop.assign(buildings);
    this.rebuildGrid();
    pop.planDay();

    if (r.births) this.events.push(r.births === 1 ? t('A baby was born!') : t('{n} babies were born!', { n: r.births }));
    for (const [a, b] of r.weddings) {
      this.events.push(t('{a} and {b} got married!', { a, b }));
      const hall = buildings.ofKind('weddinghall')[0];
      if (hall) this.c.effects.hearts(hall.mesh.position.x, hall.mesh.position.z);
    }
    // Burials in cemetery
    for (const d of r.deaths) {
      const f = pop.families.get(d.familyId);
      const cemetery = buildings.list.find((b) => b.kind === 'cemetery' && (b.graves?.length ?? 0) < MAX_GRAVES_PER_CEMETERY);
      if (cemetery && f && f.money >= GRAVE_COST) {
        f.money -= GRAVE_COST;
        eco.money += GRAVE_COST;
        buildings.addGrave(cemetery, { name: d.name, family: d.surname, age: d.age, day: eco.day });
        this.events.push(t('{name} was laid to rest at the cemetery (${cost})', { name: `${d.name} ${d.surname}`.trim(), cost: GRAVE_COST }));
      }
    }

    // Ranch calf breeding
    for (const b of buildings.ofKind('ranch')) {
      if (b.workers > 0 && eco.food > 50 && (b.cattleCount ?? 4) < 4) {
        b.cattleCount = (b.cattleCount ?? 0) + 1;
        b.cattleHunger = 0;
        this.events.push(t('A new calf was born in the ranch!'));
      }
    }

    for (const d of r.deaths.slice(0, 3)) this.events.push(t('{name} died ({cause})', { name: `${d.name} ${d.surname}`.trim(), cause: t(d.cause) }));
    if (r.deaths.length > 3) this.events.push(t('{n} people died today', { n: r.deaths.length }));
    if (r.leftTown) this.events.push(t('{n} people left town (debt)', { n: r.leftTown }));
    if (r.carsBought) this.events.push(t('{n} families bought a car', { n: r.carsBought }));
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
    const homes = this.freeHomes();
    if (!homes.length) return;
    const open = buildings.list.reduce((a, b) => a + BUILDINGS[b.kind].jobs, 0) - [...pop.citizens.values()].filter((c) => c.job >= 0).length;
    if (open < 2 || eco.food < pop.size * 2 || eco.powered < 0.6 || this.waterSupply < 0.8) return;
    pop.createFamily(pick(homes).id, { carChance: 0.3 });
    pop.assign(buildings);
    pop.planDay();
    this.events.push(t('A new family moved in'));
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
    let food = 0;
    for (const b of buildings.list) {
      const d = BUILDINGS[b.kind];
      if (b.kind === 'ranch') {
        const cattle = b.cattleCount ?? 4;
        if (cattle > 0) {
          const feedNeeded = cattle * share * 0.5;
          if (eco.food >= feedNeeded && eco.food > 5) {
            eco.food -= feedNeeded;
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
      if (b.kind === 'farm') f *= growingSeason(month) ? (b.irrigated ? 1 : 0.15) : 0;
      if (b.kind === 'orchard') f *= month >= 5 && month <= 9 ? 1.5 : 0.2;
      if (b.kind === 'ranch') f *= (seasonOf(month) === 'winter' ? 0.7 : 1) * ((b.cattleCount ?? 4) / 4);
      food += f * share;
    }
    eco.food += food;
    this.foodMade += food;

    const th = buildings.townHall();
    for (const b of buildings.ofKind('quarry')) {
      b.stored = Math.min(QUARRY.maxStored, b.stored + QUARRY.perDay * Math.min(1, b.workers / BUILDINGS.quarry.jobs) * (b.powered ? 1 : 0.5) * share);
      if (!th || b.stored < QUARRY.truckLoad || b.trucks >= TRUCKS_PER_QUARRY || b.access < 0 || th.access < 0) continue;
      const sent = traffic.spawn({
        kind: 'truck', from: b.access, to: th.access, loaded: true,
        fromPos: buildings.door(b), toPos: buildings.door(th), color: new THREE.Color('#ffffff'),
        onArrive: () => { eco.stone += QUARRY.truckLoad; this.truckBack(b); },
        onFail: () => { b.stored += QUARRY.truckLoad; b.trucks = Math.max(0, b.trucks - 1); },
      });
      if (sent) { b.stored -= QUARRY.truckLoad; b.trucks++; }
    }
  }

  private truckBack(b: Building) {
    const { buildings, traffic } = this.c;
    const th = buildings.townHall();
    const done = () => { b.trucks = Math.max(0, b.trucks - 1); };
    if (b.removed || !th || b.access < 0) return done();
    const ok = traffic.spawn({ kind: 'truck', from: th.access, to: b.access, fromPos: buildings.door(th), toPos: buildings.door(b), onArrive: done, onFail: done });
    if (!ok) done();
  }

  // ---------- fire & lightning ----------

  private updateFires(dt: number) {
    const { buildings, effects } = this.c;
    this.fireT -= dt;
    const emit = this.fireT <= 0;
    if (emit) this.fireT = 0.15;
    for (const b of [...buildings.list]) {
      if (b.fire <= 0) continue;
      b.fire -= dt;
      if (emit) effects.fire(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.6);
      if (b.fire <= 0) {
        this.events.push(t('{name} burnt down!', { name: t(BUILDINGS[b.kind].name) }));
        this.c.burnDown(b);
      }
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
      const cemetery = buildings.list.find((b) => b.kind === 'cemetery' && (b.graves?.length ?? 0) < MAX_GRAVES_PER_CEMETERY);
      if (cemetery && f && f.money >= GRAVE_COST) {
        f.money -= GRAVE_COST;
        this.c.eco.money += GRAVE_COST;
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
      const spots = buildings.list.filter((b) => b.kind === 'townhall' || b.kind === 'orchard' || b.kind === 'parking' || b.kind === 'weddinghall' || b.kind === 'school');
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
    this.walk(c, from, fromTile, home, done, this.carryFor(c));
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
        const plants = buildings.ofKind('powerplant');
        const drop = plants.length ? plants.reduce((a, b) => (dist(a, hut) < dist(b, hut) ? a : b)) : hut;
        c.activity = 'Carrying a log';
        this.walk(c, { x: w.x, z: w.z }, tileAt(w), drop, () => {
          eco.wood += WOOD_PER_LOG;
          if (c.walker) c.walker.carry = 'none';
          if (!atWork()) return;
          if (c.walker) c.walker.leaving = false;
          if (drop === hut) this.woodcutterLoop(c, hut);
          else this.walk(c, buildings.door(drop), buildings.frontTile(drop), hut, () => { if (c.walker) c.walker.leaving = false; this.woodcutterLoop(c, hut); });
        }, 'log');
      }, treeCenter);
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
        const other = this.freeHomes()[0];
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
