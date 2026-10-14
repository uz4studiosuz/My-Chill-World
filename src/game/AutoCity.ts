import { BUILDINGS, BuildingKind, TRADE_PRICE } from '../buildings/BuildingTypes';
import type { Building, Buildings } from '../buildings/Buildings';
import type { City, Economy } from '../sim/Economy';
import { ROAD_COST, ROAD_TWO_LANE, RoadNetwork } from '../roads/RoadNetwork';
import type { WorldMap } from '../world/WorldMap';
import { N, Tile, idx, inBounds } from '../world/grid';
import { t } from '../i18n/i18n';

/** What an autonomous town needs from the game. */
export interface AutoHost {
  eco: Economy;
  buildings: Buildings;
  net: RoadNetwork;
  map: WorldMap;
  people(cityId: number): number;
  freeHomes(cityId: number): number;
  isWatered(x: number, z: number, size: number): boolean;
  treesNear(x: number, z: number, r: number): number;
  isBlocked(k: number): boolean;
  clearTiles(ks: number[]): void;
  networkChanged(): void;
  say(msg: string): void;
}

/** What a town cannot live without: built even when money is short. */
const ESSENTIAL = new Set<string>(['construction', 'watertower', 'powerplant', 'windturbine', 'farm', 'orchard', 'woodcutter', 'quarry']);

/** Colours that tell the towns apart (a soft tint over the buildings, and the dot in the panels). */
export const TOWN_TINTS = ['#ffc6a3', '#b9d0ff', '#cdf2b4', '#f2c2ee'];

/**
 * A town that runs itself: its own mayor looks at what the people lack and builds it with the town's own money —
 * streets in a neat grid, homes, water, power, food, jobs and services. The player watches and trades with it.
 */
export class AutoCity {
  private t = 0;
  /** Day of the last news from each town (not too chatty). */
  private news = new Map<number, number>();

  constructor(private h: AutoHost) {}

  update(dt: number) {
    this.t += dt;
    if (this.t < 30) return;
    this.t = 0;
    for (const city of this.h.eco.cities.values()) if (city.ai) this.step(city);
  }

  /** One decision of the town's mayor: build the most needed thing (or new streets to make room). */
  private step(city: City) {
    const { buildings } = this.h;
    const hall = buildings.townHall(city.id);
    if (!hall || hall.built < 1) return;
    const own = buildings.list.filter((b) => b.city === city.id && !b.removed);
    // one building site at a time: builders are few
    if (own.some((b) => b.built < 1)) return;
    const want = this.need(city, own);
    if (!want) return;
    if (want === 'roads') { this.growStreets(city, hall, own); return; }
    if (!this.afford(city, want, ESSENTIAL.has(want) ? 300 : 1500)) return;
    const spot = this.findSpot(want, hall, own);
    if (!spot) { this.growStreets(city, hall, own); return; }
    this.pay(city, want);
    const b = buildings.place(want, spot.x, spot.z, { city: city.id });
    this.h.clearTiles(buildings.footprint(want, spot.x, spot.z).map((f) => idx(f.x, f.z)));
    this.h.networkChanged();
    const big = BUILDINGS[want].size >= 2 && want !== 'farm' && want !== 'orchard';
    if (big && (this.news.get(city.id) ?? -9) < this.h.eco.day - 1) {
      this.news.set(city.id, this.h.eco.day);
      this.h.say(t('Neighbour town {city} is building a {name}', { city: city.name, name: t(BUILDINGS[b.kind].name) }));
    }
  }

  /** What the town lacks most right now. */
  private need(city: City, own: Building[]): BuildingKind | 'roads' | null {
    const count = (k: BuildingKind) => own.filter((b) => b.kind === k).length;
    const people = this.h.people(city.id);
    const free = this.h.freeHomes(city.id);
    let jobs = 0, staff = 0;
    for (const b of own) { jobs += BUILDINGS[b.kind].jobs; staff += b.workers; }
    const towers = count('watertower');
    const plants = own.filter((b) => BUILDINGS[b.kind].power).reduce((a, b) => a + BUILDINGS[b.kind].power, 0);
    const demand = own.reduce((a, b) => a + BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1), 0);
    if (!count('construction')) return 'construction';
    if (towers * BUILDINGS.watertower.water < people + 20) return 'watertower';
    if (plants < demand * 1.15 + 6) return city.iron >= 20 && city.money > 1500 ? 'windturbine' : 'powerplant';
    if (city.food < people * 4 && count('farm') + count('orchard') < 2 + people / 40) return count('farm') <= count('orchard') ? 'farm' : 'orchard';
    if (city.wood < 60 && count('woodcutter') < 2) return 'woodcutter';
    if (city.stone < 60 && !count('quarry')) return 'quarry';
    if (free < 1) return people > 140 && city.iron >= 15 ? 'apartment' : 'house';
    if (!count('grocery') && people >= 25) return 'grocery';
    if (!count('school') && people >= 35) return 'school';
    if (!count('kindergarten') && people >= 50) return 'kindergarten';
    if (!count('park') && people >= 45) return 'park';
    if (!count('sewage') && people >= 60) return 'sewage';
    if (!count('weddinghall') && people >= 55) return 'weddinghall';
    if (!count('cemetery') && people >= 60) return 'cemetery';
    if (!count('police') && people >= 70) return 'police';
    if (!count('pharmacy') && people >= 75) return 'pharmacy';
    if (!count('mosque') && people >= 85) return 'mosque';
    if (!count('teahouse') && people >= 90) return 'teahouse';
    if (!count('clothes') && people >= 95) return 'clothes';
    if (!count('hospital') && people >= 110) return 'hospital';
    if (!count('market') && people >= 120) return 'market';
    if (!count('firestation') && people >= 120) return 'firestation';
    if (!count('gym') && people >= 130) return 'gym';
    // enough jobs for everyone, a few more homes to grow
    if (jobs - staff < 4 && people >= 40) return people > 100 ? 'office' : 'kiosk';
    if (free < 4 && city.money > 3000) return 'house';
    return null;
  }

  /** Has the town the money and materials (it buys missing stone, wood and iron from traders)? */
  /** Has the town the money and materials, keeping a reserve (it buys missing stone, wood and iron from traders)? */
  private afford(city: City, kind: BuildingKind, reserve: number) {
    const d = BUILDINGS[kind];
    let money = d.money;
    for (const r of ['stone', 'wood', 'iron'] as const) money += Math.max(0, d[r] - city[r]) * TRADE_PRICE[r] * 1.25;
    return city.money >= money + reserve;
  }

  private pay(city: City, kind: BuildingKind) {
    const { eco } = this.h;
    const d = BUILDINGS[kind];
    for (const r of ['stone', 'wood', 'iron'] as const) {
      const short = Math.max(0, d[r] - city[r]);
      if (short > 0) { eco.add(city, 'money', -short * TRADE_PRICE[r] * 1.25, 'Trade: goods bought'); eco.add(city, r, short, 'Bought from traders'); }
      if (d[r]) eco.add(city, r, -d[r], 'Construction');
    }
    eco.add(city, 'money', -d.money, 'Construction');
  }

  /** The closest free place for a building: farms and industry a little out of town, the rest near the centre. */
  private findSpot(kind: BuildingKind, hall: Building, own: Building[]): Tile | null {
    const { buildings, map } = this.h;
    const radius = this.radius(hall, own);
    const far = kind === 'woodcutter' || kind === 'quarry' ? 30 : radius + 4;
    const outside = kind === 'farm' || kind === 'orchard' || kind === 'powerplant' || kind === 'quarry' || kind === 'woodcutter' || kind === 'sewage' || kind === 'cemetery';
    let best: Tile | null = null, bd = Infinity;
    for (let z = hall.z - far; z <= hall.z + far; z++) for (let x = hall.x - far; x <= hall.x + far; x++) {
      if (!inBounds(x, z)) continue;
      const d = Math.abs(x - hall.x) + Math.abs(z - hall.z);
      const score = outside ? Math.abs(d - radius * 0.8) : d;
      if (score >= bd) continue;
      if (!buildings.check(kind, x, z).ok) continue;
      if (kind === 'farm' && !this.h.isWatered(x, z, 3) && map.arid[idx(x, z)] > 0.5) continue;
      best = { x, z };
      bd = score;
    }
    return best;
  }

  /** How far the town reaches from its hall. */
  private radius(hall: Building, own: Building[]) {
    let r = 6;
    for (const b of own) r = Math.max(r, Math.abs(b.x - hall.x), Math.abs(b.z - hall.z));
    return Math.min(22, r + 2);
  }

  /**
   * New streets in a grid around the hall: east–west streets every 4 tiles, north–south ones every 7.
   * Each step builds the shortest missing street that touches the existing roads.
   */
  private growStreets(city: City, hall: Building, own: Building[]) {
    const { net, map, buildings, eco } = this.h;
    const r = this.radius(hall, own) + 3;
    const cx = hall.x, cz = hall.z + 2;
    const lines: Tile[][] = [];
    for (let j = -Math.floor(r / 4); j <= Math.floor(r / 4); j++) {
      const z = cz + j * 4, row: Tile[] = [];
      for (let x = cx - r; x <= cx + r; x++) row.push({ x, z });
      lines.push(row);
    }
    for (let i = -Math.floor(r / 7); i <= Math.floor(r / 7); i++) {
      const x = cx + i * 7, col: Tile[] = [];
      for (let z = cz - r; z <= cz + r; z++) col.push({ x, z });
      lines.push(col);
    }
    const free = (tl: Tile) => {
      if (!inBounds(tl.x, tl.z)) return false;
      const k = idx(tl.x, tl.z);
      return map.isLand(k) && buildings.occ[k] === -1 && !this.h.isBlocked(k);
    };
    // split each planned street into runs of buildable tiles; keep the runs that touch a road and add something
    let pick: Tile[] | null = null;
    for (const line of lines) {
      let run: Tile[] = [];
      const runs: Tile[][] = [];
      for (const tl of line) {
        if (free(tl)) run.push(tl);
        else { if (run.length) runs.push(run); run = []; }
      }
      if (run.length) runs.push(run);
      for (const ru of runs) {
        const missing = ru.filter((tl) => !net.type[idx(tl.x, tl.z)]).length;
        const touches = ru.some((tl) => net.type[idx(tl.x, tl.z)]);
        if (missing >= 3 && touches && (!pick || missing < pick.filter((tl) => !net.type[idx(tl.x, tl.z)]).length)) pick = ru;
      }
    }
    if (!pick) return;
    const cost = pick.filter((tl) => !net.type[idx(tl.x, tl.z)]).length;
    if (city.money < cost * ROAD_COST[2].money + 500 || city.stone < cost * ROAD_COST[2].stone) {
      if (city.stone < cost * ROAD_COST[2].stone && city.money > cost * 12 + 800) {
        const n = cost * ROAD_COST[2].stone;
        eco.add(city, 'money', -n * TRADE_PRICE.stone * 1.25, 'Trade: goods bought');
        eco.add(city, 'stone', n, 'Bought from traders');
      } else return;
    }
    net.buildPath(pick, ROAD_TWO_LANE);
    net.clearUndo();
    eco.add(city, 'money', -cost * ROAD_COST[2].money, 'Roads');
    eco.add(city, 'stone', -cost * ROAD_COST[2].stone, 'Roads');
    this.h.clearTiles(pick.map((tl) => idx(tl.x, tl.z)));
    this.h.networkChanged();
  }
}

/** Find flat dry land for a new town far from the others (a rectangle of free land around the centre). */
export function findTownSite(map: WorldMap, taken: Tile[], minDist: number, rnd: () => number): Tile | null {
  for (let tries = 0; tries < 400; tries++) {
    const a = rnd() * Math.PI * 2, d = minDist + rnd() * 30;
    const x = Math.round(N / 2 + Math.cos(a) * d), z = Math.round(N / 2 + Math.sin(a) * d);
    if (x < 22 || z < 22 || x > N - 22 || z > N - 22) continue;
    if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
    let ok = true;
    for (let dz = -6; dz <= 8 && ok; dz++) for (let dx = -12; dx <= 10 && ok; dx++) if (!map.isLand(idx(x + dx, z + dz))) ok = false;
    if (ok) return { x, z };
  }
  return null;
}
