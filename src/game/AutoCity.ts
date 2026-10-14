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
  /** Dig an irrigation canal from a field to the nearest water. */
  digCanal(farm: Building): void;
  /** Pull a building down (half the cost back). */
  demolish(b: Building): void;
  /** Is this farm field watered (canal, river, rain)? */
  irrigated(b: Building): boolean;
  /** Richest families of a town: name and savings. */
  richest(cityId: number): { name: string; money: number }[];
  /** Build a road to the nearest town it is not joined with yet (when it can pay); returns the town's name. */
  linkRoad(city: City): string | null;
  /** Buy a good from the other towns that have plenty (returns how much came). */
  buyGoods(city: City, g: 'food' | 'wood' | 'stone' | 'iron', n: number): number;
  /** Sell a good to the other towns that lack it (returns how much went). */
  sellGoods(city: City, g: 'food' | 'wood' | 'stone' | 'iron', n: number): number;
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
  trader: ['market', 'supermarket', 'hotel', 'bank', 'kiosk', 'teahouse', 'trainstation', 'airport'],
  industrial: ['factory', 'ironmine', 'sawmill', 'brickworks', 'steelmill', 'carfactory', 'coalmine', 'bikefactory'],
  green: ['park', 'bigpark', 'fountain', 'windturbine', 'solarfarm', 'playground', 'recycling', 'bikefactory'],
  thrifty: ['bank', 'orchard', 'fishery', 'grocery'],
};

/** What is happening in a town, for the World window. */
export interface TownNews { day: number; text: string }
export type TownMood = 'growing' | 'boom' | 'crisis' | 'stable' | 'shrinking';

/** What a town cannot live without: built even when money is short. */
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ESSENTIAL = new Set<string>(['construction', 'watertower', 'powerplant', 'windturbine', 'farm', 'orchard', 'woodcutter', 'quarry']);

/** Colours that tell the towns apart (a soft tint over the buildings, and the dot in the panels). */
export const TOWN_TINTS = ['#ffc6a3', '#b9d0ff', '#cdf2b4', '#f2c2ee', '#f6e39a', '#a8e6e0', '#d7c4f2', '#f2b8a8'];

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
    const { eco, buildings } = this.h;
    // food security: with little food left the mayor buys from the other towns (the treasury pays)
    {
      const ppl = this.h.people(city.id);
      const want = ppl * 5 - city.food;
      if (ppl > 0 && city.food < ppl * 3 && want > 0) {
        const n = Math.floor(this.h.buyGoods(city, 'food', Math.floor(want)));
        if (n > 0) this.note(city, t('Food was running out: the mayor bought {n} food from other towns', { n }), n > ppl * 2);
      }
    }
    // a building in the wrong place is pulled down (and built again where it works)
    for (const b of buildings.list) {
      if (b.city !== city.id || b.removed || b.built < 1 || b.kind === 'townhall') continue;
      const noRoad = BUILDINGS[b.kind].needsRoad && b.access < 0;
      const dry = b.kind === 'farm' && !this.h.irrigated(b) && Math.random() < 0.5;
      if (dry) { this.h.digCanal(b); if (!this.h.irrigated(b) && Math.random() < 0.2) { this.h.demolish(b); this.note(city, t('A dry field was given up — a new one will be dug near water')); } continue; }
      if (noRoad) { this.h.demolish(b); this.note(city, t('The {name} had no road — it was pulled down to be built again', { name: t(BUILDINGS[b.kind].name) })); break; }
    }
    const style = this.styleOf(city);
    const people = this.h.people(city.id);
    const happy = this.h.happiness(city.id);
    // a road to the neighbours: people can then work, shop and trade there
    if (people >= 25 && city.money > 2500 && Math.random() < 0.35) {
      const to = this.h.linkRoad(city);
      if (to) this.note(city, t('Built a road to {city}', { city: to }), true);
    }
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
      this.h.sellGoods(city, g, Math.floor(extra * (style === 'trader' ? 0.5 : 0.25)));
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

  /** The building the town wants most and cannot pay for itself (a letter to the player asks for help), with its cost. */
  wish(city: City): { kind: BuildingKind; cost: number } | null {
    const hall = this.h.buildings.townHall(city.id);
    if (!hall || hall.built < 1) return null;
    const own = this.h.buildings.list.filter((b) => b.city === city.id && !b.removed);
    if (own.some((b) => b.built < 1)) return null;
    const kind = this.need(city, own);
    if (!kind || kind === 'roads' || this.afford(city, kind, 300) || !this.findSpot(kind, hall, own)) return null;
    return { kind, cost: Math.round(this.cost(city, kind) / 10) * 10 };
  }

  /** Build it now with money that came from outside (already added to the town's treasury). */
  buildFunded(city: City, kind: BuildingKind, from: string): boolean {
    const { buildings } = this.h;
    const hall = buildings.townHall(city.id);
    if (!hall) return false;
    const own = buildings.list.filter((b) => b.city === city.id && !b.removed);
    const spot = this.findSpot(kind, hall, own);
    if (!spot || !this.afford(city, kind, 0) || !this.pay(city, kind)) return false;
    const b = buildings.place(kind, spot.x, spot.z, { city: city.id });
    if (kind === 'farm') this.h.digCanal(b);
    this.h.clearTiles(buildings.footprint(kind, spot.x, spot.z).map((f) => idx(f.x, f.z)));
    this.h.networkChanged();
    this.note(city, t('Started building a {name} with help from {city}', { name: t(BUILDINGS[kind].name), city: from }));
    return true;
  }

  update(dt: number) {
    this.t += dt;
    if (this.t < 12) return;
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
    // one building site at a time (two when the town is rich): builders are few
    const sites = own.filter((b) => b.built < 1).length;
    if (sites >= (city.money > 8000 ? 2 : 1)) return;
    const want = this.need(city, own);
    // nothing to build: a rich town lays new streets for the future
    if (!want) { if (city.money > 2500 && Math.random() < 0.3) this.growStreets(city, hall, own); return; }
    if (this.mood.get(city.id) === 'crisis' && want !== 'roads' && !ESSENTIAL.has(want)) return;
    if (want === 'roads') { this.growStreets(city, hall, own); return; }
    if (!this.afford(city, want, ESSENTIAL.has(want) ? 300 : 1500)) return;
    const spot = this.findSpot(want, hall, own);
    if (!spot) { this.growStreets(city, hall, own); return; }
    if (!this.pay(city, want)) return;
    const b = buildings.place(want, spot.x, spot.z, { city: city.id });
    if (want === 'farm') this.h.digCanal(b);
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
    // food: enough fields for what the people eat (winter stores come from the harvest)
    const fy = city.foodYesterday;
    const short = fy.eaten > fy.made * 1.1 || city.food < people * 4;
    const fields = count('farm') + count('orchard') + count('ranch') + count('fishery');
    if (short && fields < 2 + people / 25) return count('farm') <= count('orchard') + 1 ? 'farm' : count('ranch') < count('orchard') ? 'ranch' : 'orchard';
    if (people >= 30 && !count('grocery') && !count('market') && !count('supermarket')) return 'grocery';
    if (city.wood < 60 && count('woodcutter') < 2) return 'woodcutter';
    if (city.stone < 60 && !count('quarry')) return 'quarry';
    if (free < 1) return people > 400 && city.money > 16000 ? 'tower30' : people > 220 && city.money > 9000 ? 'tower15' : people > 140 && city.iron >= 15 ? 'apartment' : 'house';
    if (!count('grocery') && people >= 25) return 'grocery';
    // stores almost full: a warehouse
    if ((['food', 'wood', 'stone', 'iron', 'grain'] as const).some((r) => city[r] >= this.h.eco.capacity(city, r) * 0.85) && count('warehouse') < 4) return 'warehouse';
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
    // buses: a depot and stops spread over the town
    if (!count('busdepot') && people >= 150) return 'busdepot';
    if (count('busdepot') && count('busstop') < Math.min(6, 2 + Math.floor(people / 80))) return 'busstop';
    // the mayor's taste: one of the things this kind of town likes, now and then
    const style = this.styleOf(city);
    if (people >= 50 && Math.random() < 0.35) {
      const wish = STYLE_WISH[style].filter((k) => count(k) < (k === 'house' || k === 'apartment' ? 99 : k === 'park' || k === 'fountain' || k === 'playground' ? 3 : 1));
      if (wish.length) {
        const k = wish[Math.floor(Math.random() * wish.length)];
        if (k === 'airport' ? people >= 160 : k !== 'ironmine' && k !== 'coalmine' && k !== 'trainstation' || people >= 90) return k;
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
    return city.money >= this.cost(city, kind) + reserve;
  }

  /** Money a building costs the town: its price plus the materials it has to buy. */
  private cost(city: City, kind: BuildingKind) {
    const d = BUILDINGS[kind];
    let money = d.money;
    for (const r of ['stone', 'wood', 'iron'] as const) money += Math.max(0, d[r] - city[r]) * TRADE_PRICE[r] * 1.25;
    return money;
  }

  /** Pay for a building: missing stone, wood and iron are bought from the other towns first (false: nobody sells). */
  private pay(city: City, kind: BuildingKind) {
    const { eco } = this.h;
    const d = BUILDINGS[kind];
    for (const r of ['stone', 'wood', 'iron'] as const) {
      const short = Math.ceil(Math.max(0, d[r] - city[r]));
      if (short > 0) this.h.buyGoods(city, r, short);
      if (city[r] < d[r]) return false;
    }
    for (const r of ['stone', 'wood', 'iron'] as const) if (d[r]) eco.add(city, r, -d[r], 'Construction');
    eco.add(city, 'money', -d.money, 'Construction');
    return true;
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
      if (!this.leavesRoom(hall.city, kind, x, z)) continue;
      if (kind === 'busstop' && own.some((b) => b.kind === 'busstop' && Math.abs(b.x - x) + Math.abs(b.z - z) < 7)) continue;
      if (kind === 'farm' && !this.h.isWatered(x, z, 3) && map.arid[idx(x, z)] > 0.5) continue;
      if (kind === 'farm' && !this.h.isWatered(x, z, 3) && !this.nearWater(x, z, 14)) continue;
      best = { x, z };
      bd = score;
    }
    return best;
  }

  /**
   * Does a building here leave room for the town's future streets? Nothing is built just past the end of a street
   * (it goes on there later), nor beside a street every 6 tiles (a side street turns off there).
   */
  leavesRoom(cityId: number, kind: BuildingKind, x: number, z: number): boolean {
    const { buildings, net } = this.h;
    const hall = buildings.townHall(cityId);
    if (!hall) return true;
    const road = (a: number, b: number) => inBounds(a, b) && !!net.type[idx(a, b)];
    for (const f of buildings.footprint(kind, x, z)) {
      for (const [dx, dz] of DIRS4) {
        for (let k = 1; k <= 3; k++) {
          const rx = f.x - dx * k, rz = f.z - dz * k;
          if (!road(rx, rz)) continue;
          const along = road(rx - dx, rz - dz);
          if (along && k <= 3) return false; // a dead end points here
          const across = road(rx + dz, rz + dx) || road(rx - dz, rz - dx);
          const pos = dx !== 0 ? rz - hall.z : rx - hall.x;
          if (across && ((pos % 6) + 6) % 6 === 0) return false;
          break;
        }
      }
    }
    return true;
  }

  /**
   * Hemmed in: no street can grow. Pull down one small building that stands in the way of a street (a road end
   * first) when there is free land behind it; its family moves to a free home.
   */
  private clearWay(city: City, hall: Building, r: number) {
    const { net, buildings, map } = this.h;
    if (city.money < 1500) return;
    const road = (a: number, b: number) => inBounds(a, b) && !!net.type[idx(a, b)];
    let best: Building | null = null, bd = Infinity;
    for (let z = hall.z - r; z <= hall.z + r; z++) for (let x = hall.x - r; x <= hall.x + r; x++) {
      if (!road(x, z)) continue;
      for (const [dx, dz] of DIRS4) {
        const ax = x + dx, az = z + dz;
        if (!inBounds(ax, az)) continue;
        const id = buildings.occ[idx(ax, az)];
        if (id === -1) continue;
        const b = buildings.get(id);
        if (!b || b.city !== city.id || b.built < 1 || BUILDINGS[b.kind].size !== 1 || b.kind === 'townhall' || b.kind === 'watertower' || b.kind === 'busstop') continue;
        let ok = true;
        for (let k = 2; k <= 4 && ok; k++) {
          const tx = x + dx * k, tz = z + dz * k;
          ok = inBounds(tx, tz) && map.isLand(idx(tx, tz)) && buildings.occ[idx(tx, tz)] === -1 && !net.type[idx(tx, tz)] && !this.h.isBlocked(idx(tx, tz));
        }
        if (!ok) continue;
        const score = Math.abs(x - hall.x) + Math.abs(z - hall.z) - (road(x - dx, z - dz) ? 10 : 0) + (b.kind === 'house' ? 3 : 0);
        if (score < bd) { bd = score; best = b; }
      }
    }
    if (!best) return;
    this.note(city, t('A {name} was pulled down to make way for a new street', { name: t(BUILDINGS[best.kind].name) }));
    this.h.demolish(best);
  }

  /** Is there a river or lake within `r` tiles (a canal can reach it)? */
  private nearWater(x: number, z: number, r: number) {
    const { map } = this.h;
    for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) if (inBounds(x + dx, z + dz) && map.water[idx(x + dx, z + dz)]) return true;
    return false;
  }

  /** How far the town reaches from its hall. */
  private radius(hall: Building, own: Building[]) {
    let r = 6;
    for (const b of own) r = Math.max(r, Math.abs(b.x - hall.x), Math.abs(b.z - hall.z));
    return Math.min(34, r + 2);
  }

  /**
   * New streets that grow out of the town's own roads: from a road tile a straight street of 3–8 tiles goes out
   * sideways (or a dead end goes on), over free land, keeping two tiles from any parallel street so there is room for
   * buildings on both sides; a street that runs into another road joins it. The cheapest street close to the hall wins.
   */
  private growStreets(city: City, hall: Building, own: Building[]) {
    const { net, map, buildings, eco } = this.h;
    const r = this.radius(hall, own) + 4;
    const road = (x: number, z: number) => inBounds(x, z) && !!net.type[idx(x, z)];
    const free = (x: number, z: number) => {
      if (!inBounds(x, z)) return false;
      const k = idx(x, z);
      return map.isLand(k) && buildings.occ[k] === -1 && !this.h.isBlocked(k) && !net.type[k];
    };
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let pick: Tile[] | null = null, best = Infinity;
    for (let z = hall.z - r; z <= hall.z + r; z++) for (let x = hall.x - r; x <= hall.x + r; x++) {
      if (!road(x, z)) continue;
      for (const [dx, dz] of DIRS) {
        const run: Tile[] = [{ x, z }];
        let joined = false;
        for (let k = 1; k <= 8; k++) {
          const tx = x + dx * k, tz = z + dz * k;
          if (Math.abs(tx - hall.x) > r || Math.abs(tz - hall.z) > r) break;
          if (road(tx, tz)) { if (k > 3) { run.push({ x: tx, z: tz }); joined = true; } break; }
          if (!free(tx, tz)) break;
          // keep away from streets running alongside (the first tile may touch the street it starts from)
          let close = false;
          for (const s2 of k === 1 ? [1] : [1, 2]) if (road(tx + dz * s2, tz + dx * s2) || road(tx - dz * s2, tz - dx * s2)) close = true;
          if (close) break;
          run.push({ x: tx, z: tz });
        }
        const n = run.length - 1 - (joined ? 1 : 0);
        if (n < 3) continue;
        const end = run[run.length - 1];
        const score = Math.abs(end.x - hall.x) + Math.abs(end.z - hall.z) + Math.random() * 4 - (joined ? 6 : 0) - n * 0.5;
        if (score < best) { best = score; pick = run; }
      }
    }
    if (!pick) { this.clearWay(city, hall, r); return; }
    const cost = pick.filter((tl) => !net.type[idx(tl.x, tl.z)]).length;
    if (city.money < cost * ROAD_COST[2].money + 500 || city.stone < cost * ROAD_COST[2].stone) {
      if (city.stone < cost * ROAD_COST[2].stone && city.money > cost * 12 + 800) {
        this.h.buyGoods(city, 'stone', Math.ceil(cost * ROAD_COST[2].stone - city.stone));
        if (city.stone < cost * ROAD_COST[2].stone) return;
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
  // anywhere on the map away from the other towns (the bigger the map, the further out a town may lie)
  for (let tries = 0; tries < 900; tries++) {
    const a = rnd() * Math.PI * 2, d = minDist + rnd() * Math.max(30, N / 2 - minDist - 26);
    const x = Math.round(N / 2 + Math.cos(a) * d), z = Math.round(N / 2 + Math.sin(a) * d);
    if (x < 22 || z < 22 || x > N - 22 || z > N - 22) continue;
    if (taken.some((p) => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
    let ok = true;
    for (let dz = -6; dz <= 8 && ok; dz++) for (let dx = -12; dx <= 10 && ok; dx++) if (!map.isLand(idx(x + dx, z + dz))) ok = false;
    if (ok) return { x, z };
  }
  return null;
}
