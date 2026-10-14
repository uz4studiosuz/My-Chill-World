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
  happiness(cityId: number): number;
  /** Richest families of a town: name and savings. */
  richest(cityId: number): { name: string; money: number }[];
}

/** The character of a town's mayor: what the town likes to build and how it spends its money. */
export type TownStyle = 'builder' | 'trader' | 'industrial' | 'green' | 'thrifty';
export const TOWN_STYLES: TownStyle[] = ['builder', 'trader', 'industrial', 'green', 'thrifty'];
export const STYLE_NAME: Record<TownStyle, string> = {
  builder: 'Builder mayor: many homes, fast growth', trader: 'Trader mayor: markets, hotels, a bank, sells its surplus',
  industrial: 'Industrial mayor: factories and mines, rich but smoky', green: 'Green mayor: parks, wind and sun, happy people',
  thrifty: 'Thrifty mayor: saves money, low taxes, grows slowly',
};
/** Extra things each kind of mayor wants once the basics are done. */
const STYLE_WISH: Record<TownStyle, BuildingKind[]> = {
  builder: ['apartment', 'house', 'construction', 'sawmill', 'brickworks'],
  trader: ['market', 'supermarket', 'hotel', 'bank', 'kiosk', 'teahouse', 'trainstation'],
  industrial: ['factory', 'ironmine', 'sawmill', 'brickworks', 'steelmill', 'carfactory', 'coalmine'],
  green: ['park', 'bigpark', 'fountain', 'windturbine', 'solarfarm', 'playground', 'recycling'],
  thrifty: ['bank', 'orchard', 'fishery', 'grocery'],
};

/** What is happening in a town, for the World window. */
export interface TownNews { day: number; text: string }
export type TownMood = 'growing' | 'boom' | 'crisis' | 'stable' | 'shrinking';

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
  /** The town's own chronicle (newest first) and its population at the start of each of the last days. */
  readonly log = new Map<number, TownNews[]>();
  readonly popHistory = new Map<number, number[]>();
  readonly mood = new Map<number, TownMood>();
  private lastDay = -1;

  /** Write into a town's chronicle (and, for big news, into the player's chronicle too). */
  note(city: City, text: string, loud = false) {
    const list = this.log.get(city.id) ?? [];
    list.unshift({ day: this.h.eco.day, text });
    if (list.length > 30) list.length = 30;
    this.log.set(city.id, list);
    if (loud) this.h.say(`${city.name}: ${text}`);
  }

  styleOf(city: City): TownStyle { return (TOWN_STYLES as string[]).includes(city.style ?? '') ? city.style as TownStyle : 'builder'; }

  /**
   * Once a day the mayor looks at the town: taxes up when the treasury runs dry, down when people are unhappy or
   * the town is rich; a loan in an emergency; surplus goods sold; booms, crises and millionaires go into the news.
   */
  private daily(city: City) {
    const { eco } = this.h;
    const style = this.styleOf(city);
    const people = this.h.people(city.id);
    const happy = this.h.happiness(city.id);
    const hist = this.popHistory.get(city.id) ?? [];
    hist.push(people);
    if (hist.length > 8) hist.shift();
    this.popHistory.set(city.id, hist);
    const growth = hist.length > 3 ? people - hist[0] : 0;
    // taxes
    const old = city.taxRate;
    if (city.money < 600 && happy > 40) city.taxRate = Math.min(0.4, city.taxRate + 0.05);
    else if (happy < 45 || (city.money > (style === 'thrifty' ? 6000 : 9000) && city.taxRate > 0.15)) city.taxRate = Math.max(style === 'thrifty' ? 0.1 : 0.15, city.taxRate - 0.05);
    city.taxRate = Math.round(city.taxRate * 100) / 100;
    if (city.taxRate !== old) this.note(city, t(city.taxRate > old ? 'The mayor raised taxes to {n}%' : 'The mayor lowered taxes to {n}%', { n: Math.round(city.taxRate * 100) }));
    // an emergency loan
    if (city.money < 100 && city.loan < 6000 && style !== 'thrifty') {
      city.loan += 2000;
      eco.add(city, 'money', 2000, 'Bank loan');
      this.note(city, t('The town took a bank loan of ${n}', { n: 2000 }), true);
    } else if (city.loan > 0 && city.money > 6000) {
      const pay = Math.min(city.loan, 2000);
      city.loan -= pay;
      eco.add(city, 'money', -pay, 'Loan repayment');
      this.note(city, t('The town paid back ${n} of its loan', { n: pay }));
    }
    // surplus goes to the traders (traders sell more, and better)
    const keep = style === 'trader' ? 1.5 : 2.5;
    for (const [g, need] of [['food', people * 4], ['wood', 80], ['stone', 80], ['iron', 30]] as const) {
      const extra = city[g] - need * keep - 40;
      if (extra <= 20) continue;
      const n = Math.floor(extra * (style === 'trader' ? 0.5 : 0.25));
      eco.add(city, g, -n, 'Sold to other regions');
      eco.add(city, 'money', n * TRADE_PRICE[g] * (style === 'trader' ? 0.9 : 0.75), 'Trade: goods sold');
    }
    // how the town is doing
    const before = this.mood.get(city.id);
    let mood: TownMood = 'stable';
    if (city.brokeDays > 0 || happy < 35 || (city.money < 0 && city.loan >= 6000)) mood = 'crisis';
    else if (growth >= 15 && city.money > 3000) mood = 'boom';
    else if (growth > 2) mood = 'growing';
    else if (growth < -3) mood = 'shrinking';
    this.mood.set(city.id, mood);
    if (mood !== before && before !== undefined) {
      const text = mood === 'crisis' ? 'A crisis! The treasury is empty or people are very unhappy' : mood === 'boom' ? 'A boom! New families arrive every day and the treasury is full'
        : mood === 'shrinking' ? 'People are leaving the town' : mood === 'growing' ? 'The town is growing again' : 'Life has calmed down';
      this.note(city, t(text), mood === 'crisis' || mood === 'boom');
    }
    // milestones and millionaires
    for (const m of [100, 200, 300, 500, 800, 1000]) if (people >= m && (hist[hist.length - 2] ?? 0) < m) this.note(city, t('The town has {n} people', { n: m }), true);
    const rich = this.h.richest(city.id)[0];
    if (rich && rich.money >= 10000 && Math.random() < 0.15) this.note(city, t('The {family} family is the richest in town with ${n}', { family: rich.name, n: Math.round(rich.money) }));
  }

  constructor(private h: AutoHost) {}

  update(dt: number) {
    this.t += dt;
    if (this.t < 30) return;
    this.t = 0;
    const day = this.h.eco.day;
    const newDay = day !== this.lastDay;
    this.lastDay = day;
    for (const city of this.h.eco.cities.values()) {
      if (!city.ai) continue;
      if (newDay) this.daily(city);
      this.step(city);
    }
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
    if (this.mood.get(city.id) === 'crisis' && want !== 'roads' && !ESSENTIAL.has(want)) return;
    if (want === 'roads') { this.growStreets(city, hall, own); return; }
    if (!this.afford(city, want, ESSENTIAL.has(want) ? 300 : 1500)) return;
    const spot = this.findSpot(want, hall, own);
    if (!spot) { this.growStreets(city, hall, own); return; }
    this.pay(city, want);
    const b = buildings.place(want, spot.x, spot.z, { city: city.id });
    this.h.clearTiles(buildings.footprint(want, spot.x, spot.z).map((f) => idx(f.x, f.z)));
    this.h.networkChanged();
    this.note(city, t('Started building a {name}', { name: t(BUILDINGS[want].name) }));
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
    // the mayor's taste: one of the things this kind of town likes, now and then
    const style = this.styleOf(city);
    if (people >= 50 && Math.random() < 0.35) {
      const wish = STYLE_WISH[style].filter((k) => count(k) < (k === 'house' || k === 'apartment' ? 99 : k === 'park' || k === 'fountain' || k === 'playground' ? 3 : 1));
      if (wish.length) {
        const k = wish[Math.floor(Math.random() * wish.length)];
        if (k !== 'ironmine' && k !== 'coalmine' && k !== 'trainstation' || people >= 90) return k;
      }
    }
    // enough jobs for everyone, a few more homes to grow
    if (jobs - staff < 4 && people >= 40) return people > 100 ? (style === 'industrial' ? 'factory' : 'office') : 'kiosk';
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
