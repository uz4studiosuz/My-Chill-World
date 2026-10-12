import * as THREE from 'three';
import { DAY_SECONDS } from '../config';
import { N, tileToWorld, worldToTile } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { Terrain } from '../world/Terrain';
import { RoadNetwork } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { Building, Buildings, Point } from '../buildings/Buildings';
import { BUILDINGS, QUARRY, WOOD_PER_TREE } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { Citizen, DayReport, Population } from '../people/Population';
import { Carry, Walker, Walkers } from '../people/Walkers';
import { walkPath } from '../people/WalkPath';
import { Traffic } from '../traffic/Traffic';
import { Effects } from '../fx/Effects';

export interface LifeContext {
  map: WorldMap;
  terrain: Terrain;
  net: RoadNetwork;
  footpaths: Footpaths;
  buildings: Buildings;
  eco: Economy;
  pop: Population;
  walkers: Walkers;
  traffic: Traffic;
  effects: Effects;
}

const TRUCKS_PER_QUARRY = 2;
const PARK_RADIUS = 6;
const IMMIGRATION_INTERVAL = 25;
const ROAD_UPKEEP = 0.1;
const BRIDGE_UPKEEP = 0.5;
/** Share of the day people actually spend at work — production per day is spread over it. */
const WORK_SHARE = 0.42;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Everyday life: schedules, commuting by car or on foot, work behaviour (woodcutters, farmers),
 * parking, production and the end-of-day settlement.
 */
export class Life {
  /** Parking spaces in use: "buildingId:slot" → family id. */
  private spots = new Map<string, number>();
  private reservedTrees = new Set<number>();
  private immigrationT = 0;
  private presentT = 0;
  private walkCost: (k: number) => number;
  lastReport: DayReport | null = null;
  /** Food produced today so far, and yesterday's totals. */
  private foodMade = 0;
  foodYesterday = { made: 0, eaten: 0 };
  lastBalance = { incomeTax: 0, foodSales: 0, propertyTax: 0, publicWages: 0, upkeep: 0, net: 0 };
  events: string[] = [];

  constructor(private c: LifeContext) {
    const { map, net, footpaths, buildings } = c;
    this.walkCost = (k) => {
      if (net.type[k]) return 1;
      if (map.water[k] || map.height[k] > 0 || buildings.occ[k] !== -1 || net.isIsland(k)) return Infinity;
      return footpaths.tiles[k] ? 0.7 : 2.2;
    };
  }

  // ---------- per-frame ----------

  update(dt: number) {
    const { eco } = this.c;
    if (eco.tick(dt)) this.newDay();
    eco.updateEnergy(dt, this.c.buildings);
    this.presentT -= dt;
    if (this.presentT <= 0) { this.presentT = 0.5; this.countPresent(); }
    this.produce(dt);
    this.schedule();
    this.immigrationT += dt;
    if (this.immigrationT > IMMIGRATION_INTERVAL) { this.immigrationT = 0; this.immigrate(); }
  }

  /** Cars parked at homes and in parking spaces. */
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

  // ---------- day settlement ----------

  private newDay() {
    const { pop, eco, buildings, terrain } = this.c;
    const before = new Set(pop.citizens.keys());
    const r = pop.daily(buildings, eco.food, eco.powered, () => this.freeHomes());
    eco.food -= r.foodEaten;
    this.foodYesterday = { made: Math.round(this.foodMade), eaten: r.foodEaten };
    this.foodMade = 0;
    const upkeep = Math.round(this.roadUpkeep() + buildings.totals().upkeep);
    const net = Math.round(r.incomeTax + r.foodSales + r.propertyTax - r.publicWages - upkeep);
    eco.money += net;
    this.lastBalance = { incomeTax: Math.round(r.incomeTax), foodSales: r.foodSales, propertyTax: r.propertyTax, publicWages: Math.round(r.publicWages), upkeep, net };
    this.lastReport = r;
    // midnight: anyone still out is sent straight home (keeps the simulation consistent)
    for (const id of before) {
      const c = pop.citizens.get(id);
      if (c && c.state !== 'home') this.teleportHome(c);
    }
    this.cleanupSpots();
    terrain.regrow();
    pop.assign(buildings);
    pop.planDay();
    if (r.births) this.events.push(r.births === 1 ? 'A baby was born!' : `${r.births} babies were born!`);
    if (r.leftTown) this.events.push(`${r.leftTown} people left town (hunger or debt)`);
    if (r.carsBought) this.events.push(r.carsBought === 1 ? 'A family bought a car' : `${r.carsBought} families bought cars`);
  }

  private cleanupSpots() {
    const { pop } = this.c;
    for (const [key, fid] of this.spots) {
      const f = pop.families.get(fid);
      if (!f || !f.car || f.car.at === 'home') this.spots.delete(key);
    }
  }

  private immigrate() {
    const { pop, eco, buildings } = this.c;
    const homes = this.freeHomes();
    if (!homes.length) return;
    const open = buildings.totals().jobs - [...pop.citizens.values()].filter((c) => c.job >= 0).length;
    if (open < 2 || eco.food < pop.size * 2 || eco.powered < 0.6) return;
    const home = pick(homes);
    pop.createFamily(home.id, { carChance: 0.3 });
    pop.assign(buildings);
    this.events.push('A new family moved in');
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

  private produce(dt: number) {
    const { buildings, eco, traffic } = this.c;
    let food = 0;
    for (const b of buildings.list) {
      const d = BUILDINGS[b.kind];
      if (d.food && d.jobs) food += (d.food / (DAY_SECONDS * WORK_SHARE)) * (b.present / d.jobs) * dt;
    }
    eco.food += food;
    this.foodMade += food;

    const th = buildings.townHall();
    for (const b of buildings.ofKind('quarry')) {
      const rate = (QUARRY.rate * b.present) / BUILDINGS.quarry.jobs / WORK_SHARE * (0.5 + 0.5 * eco.powered);
      b.stored = Math.min(QUARRY.maxStored, b.stored + rate * dt);
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

  // ---------- daily routine ----------

  private schedule() {
    const { pop, eco } = this.c;
    const tod = eco.timeOfDay;
    for (const c of pop.citizens.values()) {
      if (c.state === 'home') {
        if (tod < c.leaveAt || tod >= c.returnAt - 0.03 || c.age < 3) continue;
        const dest = this.destination(c);
        c.leaveAt = 2; // only one attempt per day
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
      const spots = buildings.list.filter((b) => b.kind === 'townhall' || b.kind === 'orchard' || b.kind === 'parking' || b.kind === 'school');
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
    const arrive = () => this.arrive(c, dest);

    // drive if the family car is at home and there's a parking space near the destination
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
            this.walk(c, slotPos, worldToTile(slotPos.x) + worldToTile(slotPos.z) * N, dest, arrive);
          },
          onFail: () => {
            this.spots.delete(key);
            car.at = 'home';
            if (this.alive(c)) this.walk(c, buildings.door(home), buildings.frontTile(home), dest, arrive);
          },
        });
        if (ok) return;
        this.spots.delete(key);
        car.at = 'home';
      }
    }
    this.walk(c, buildings.door(home), buildings.frontTile(home), dest, arrive, this.carryFor(c));
  }

  private arrive(c: Citizen, b: Building) {
    if (!this.alive(c)) return;
    if (b.removed) { this.teleportHome(c); return; }
    c.state = 'away';
    c.at = b.id;
    const work = c.job === b.id ? BUILDINGS[b.kind].work : 'indoor';
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
    const done = () => {
      if (!this.alive(c)) return;
      c.state = 'home';
      c.at = home.id;
      if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
    };
    // already outside (woodcutter in the forest, farmer in the field)
    const from = c.walker && !c.walker.leaving ? { x: c.walker.x, z: c.walker.z } : at ? buildings.door(at) : null;
    if (!from) return this.teleportHome(c);
    const fromTile = c.walker && !c.walker.leaving ? worldToTile(from.x) + worldToTile(from.z) * N : buildings.frontTile(at!);

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
            if (c.walker) { this.c.walkers.dismiss(c.walker); c.walker = undefined; }
          } else {
            car.at = 'home';
            this.walk(c, slotPos, worldToTile(slotPos.x) + worldToTile(slotPos.z) * N, home, done);
          }
        }, 'none', slotPos);
        c.drove = false;
        return;
      }
      // the parking lot vanished: the car is simply towed home
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
  }

  private carryFor(c: Citizen): Carry {
    if (!c.errand || c.sex !== 'f') return 'none';
    const f = this.family(c);
    return f && this.c.pop.members(f).some((m) => m.age < 2) ? 'baby' : 'none';
  }

  /**
   * Walk from a point to a building's door (or to `toPoint` when dest is null).
   * Reuses the citizen's walker if they're already outside.
   */
  private walk(c: Citizen, from: Point, fromTile: number, dest: Building | null, done: () => void, carry: Carry = 'none', toPoint?: Point) {
    const { buildings, walkers } = this.c;
    const target = dest ? buildings.door(dest) : toPoint!;
    const toTile = dest ? buildings.frontTile(dest) : worldToTile(target.x) + worldToTile(target.z) * N;
    const tiles = walkPath(this.walkCost, fromTile, toTile) ?? [];
    if (!tiles.length && Math.hypot(from.x - target.x, from.z - target.z) > 6) {
      // unreachable on foot — skip the trip
      done();
      return;
    }
    const route = { from, to: target, tiles };
    if (c.walker && !c.walker.leaving) {
      walkers.retarget(c.walker, route, () => done(), carry);
    } else {
      const scale = c.age < 13 ? 0.62 : c.age < 17 ? 0.85 : 1;
      c.walker = walkers.walk(c.variant, scale, route, carry, () => done());
    }
  }

  // ---------- work behaviour ----------

  private woodcutterLoop(c: Citizen, hut: Building) {
    const { terrain, buildings, walkers, eco, effects } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === hut.id && !hut.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    const tree = terrain.nearestTree(hut.x, hut.z, 10, this.reservedTrees);
    if (tree < 0) { if (c.walker) { walkers.dismiss(c.walker); c.walker = undefined; } return; }
    this.reservedTrees.add(tree);
    const tp = { x: tileToWorld(tree % N) + 0.22, z: tileToWorld((tree / N) | 0) + 0.22 };
    const treeCenter = { x: tileToWorld(tree % N), z: tileToWorld((tree / N) | 0) };
    const door = buildings.door(hut);
    const startTile = c.walker && !c.walker.leaving ? worldToTile(c.walker.x) + worldToTile(c.walker.z) * N : buildings.frontTile(hut);
    const start = c.walker && !c.walker.leaving ? { x: c.walker.x, z: c.walker.z } : door;
    this.walk(c, start, startTile, null, () => {
      const w = c.walker;
      if (!w || !atWork()) { this.reservedTrees.delete(tree); return; }
      w.leaving = false;
      walkers.holdFor(w, 5, 'chop', () => {
        terrain.chop(tree);
        this.reservedTrees.delete(tree);
        effects.puff(treeCenter.x, treeCenter.z, 0.3, 10, ['#8a5a35', '#6faa45', '#c9a36b']);
        // carry the log to the nearest power plant (or back to the hut)
        const plants = buildings.ofKind('powerplant');
        const drop = plants.length ? plants.reduce((a, b) => (dist(a, hut) < dist(b, hut) ? a : b)) : hut;
        this.walk(c, { x: w.x, z: w.z }, worldToTile(w.x) + worldToTile(w.z) * N, drop, () => {
          eco.wood += WOOD_PER_TREE;
          eco.woodRate = eco.woodRate * 0.8 + WOOD_PER_TREE * 4;
          if (c.walker) c.walker.carry = 'none';
          if (!atWork()) return;
          const ww = c.walker;
          if (ww) ww.leaving = false;
          if (drop === hut) this.woodcutterLoop(c, hut);
          else this.walk(c, buildings.door(drop), buildings.frontTile(drop), hut, () => { if (c.walker) c.walker.leaving = false; this.woodcutterLoop(c, hut); });
        }, 'log');
      }, treeCenter);
    }, 'none', tp);
  }

  private farmLoop(c: Citizen, field: Building) {
    const { walkers, eco } = this.c;
    const atWork = () => this.alive(c) && c.state === 'away' && c.at === field.id && !field.removed && eco.timeOfDay < c.returnAt;
    if (!atWork()) return;
    const s = BUILDINGS[field.kind].size;
    const p = { x: tileToWorld(field.x) + Math.random() * (s - 1), z: tileToWorld(field.z) + Math.random() * (s - 1) };
    const from = c.walker && !c.walker.leaving ? { x: c.walker.x, z: c.walker.z } : this.c.buildings.door(field);
    let w = c.walker && !c.walker.leaving ? c.walker : undefined;
    const route = { from, to: p, tiles: [] };
    const next = (ww: Walker) => {
      ww.leaving = false;
      walkers.holdFor(ww, 2 + Math.random() * 4, 'farm', () => this.farmLoop(c, field));
    };
    if (w) walkers.retarget(w, route, next);
    else {
      w = walkers.walk(c.variant, c.age < 17 ? 0.85 : 1, route, 'none', next);
      c.walker = w;
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
          this.events.push('A family left town — their house was demolished');
        }
      }
    }
    pop.assign(buildings);
  }

}

const colorCache = new Map<string, THREE.Color>();
function colorOf(hex: string) {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new THREE.Color(hex)));
  return c;
}

const dist = (a: Building, b: Building) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
