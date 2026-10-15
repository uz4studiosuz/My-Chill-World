import { DAY_SECONDS } from '../config';
import { CHAIN2, ENERGY_PER_WOOD } from '../buildings/BuildingTypes';

export interface Balance { incomeTax: number; foodSales: number; propertyTax: number; businessTax: number; utilities: number; publicWages: number; upkeep: number; net: number; fares?: number; services?: number }

/** One city: owned by a Town Hall. Buildings, families and resources all belong to a city. */
export interface City {
  id: number;
  name: string;
  /** Day the Town Hall was built. */
  founded: number;
  money: number;
  stone: number;
  wood: number;
  food: number;
  iron: number;
  /** Intermediate goods of the production chains. */
  grain: number;
  flour: number;
  planks: number;
  milk: number;
  bricks: number;
  steel: number;
  coal: number;
  /** Cotton for the clothing stores, corn feed for the cattle. */
  cotton: number;
  feed: number;
  /** Made by the factory: clothes (from cotton) for the clothing stores, furniture (from planks) for the markets. */
  garments: number;
  furniture: number;
  /** Price of food compared to normal (scarce food is dearer). */
  priceFactor: number;
  /** The town hall's say on food prices: −0.3 (it pays part of the price) … +0.3 (dearer); 0 = the market alone. */
  foodAdj?: number;
  /** Average pay in the town compared to the usual pay (1 = usual): prices follow it. */
  wageIndex?: number;
  /** Share of homes supplied with water through mains and pipes. */
  piped: number;
  /** Energy stored in batteries. */
  stored: number;
  /** Energy per day: demand of grid-connected buildings and what the plants could make. */
  energyDemand: number;
  energyCapacity: number;
  /** Share of demand actually supplied right now (0..1). */
  powered: number;
  /** Share of people with drinking water (0..1). */
  water: number;
  foodMade: number;
  foodYesterday: { made: number; eaten: number };
  balance: Balance;
  deaths: number;
  brokeDays: number;
  /** Money owed to the bank. */
  loan: number;
  /** 0..100 — how content the citizens are. */
  happiness: number;
  /** Income tax rate 0.10..0.40 (business tax is 80% of it). */
  taxRate: number;
  /** Citizen id of the mayor (-1 = none). */
  mayor: number;
  /** Day of the last election. */
  elected: number;
  /** Player's job priorities per building kind. */
  jobPriority: Record<string, 'high' | 'low'>;
  /** What a job asks of a worker, set by the player (0 anyone, 1 a learnt trade, 2 a university degree); missing = the usual. */
  jobReq: Record<string, 0 | 1 | 2>;
  /** Wages: the town hall sets them by itself (auto) or the player does. Factor per building kind (1 = standard). */
  wageAuto: boolean;
  wages: Record<string, number>;
  /** A town that runs itself (not the player's): its tint and how friendly it is with the player (0..100). */
  ai?: boolean;
  tint?: string;
  relation?: number;
  /** Character of an autonomous town's mayor (what it likes to build, how it spends). */
  style?: string;
  /** Money a neighbour town owes the player for an investment, and the day it pays it back. */
  owes?: { day: number; money: number };
  /** Newcomers registered at the migration company: day, family id, surname and where they came from. */
  arrivals?: { day: number; family: number; surname: string; from: string }[];
  /** Election campaign under way: candidates and their promises. */
  campaign?: { day: number; candidates: { id: number; promise: PromiseKind }[] };
  /** What the mayor promised, and by which day. */
  promise?: { kind: PromiseKind; until: number; base: number };
  /** Live figures (not saved). */
  pollution: number;
  tourists: number;
  smart: boolean;
  railLink: boolean;
  /** Books: today so far, and the last days (newest first). Not saved. */
  ledger: Ledger;
  ledgerDays: Ledger[];
  /** Why new families do (not) move in: open jobs, free homes, blocking reasons. Not saved. */
  migration?: { vacancies: number; freeHomes: number; unemployed: number; reasons: string[] };
  /** Happiness target broken down into reasons (label, points). */
  mood: [string, number][];
}

export type PromiseKind = 'tax' | 'park' | 'hospital' | 'school' | 'jobs';

/** Resources that are counted in the city's books. */
export type Res = 'money' | 'stone' | 'wood' | 'iron' | 'food' | 'grain' | 'flour' | 'planks' | 'milk' | 'bricks' | 'steel' | 'coal' | 'cotton' | 'feed' | 'garments' | 'furniture';
/** Where each resource came from / went to: reason (English key) → signed amount. */
export type Ledger = Record<Res, Record<string, number>>;
export const blankLedger = (): Ledger => ({ money: {}, stone: {}, wood: {}, iron: {}, food: {}, grain: {}, flour: {}, planks: {}, milk: {}, bricks: {}, steel: {}, coal: {}, cotton: {}, feed: {}, garments: {}, furniture: {} });
export const LEDGER_DAYS = 7;

export interface CitySave {
  id: number; name: string; founded: number; money: number; stone: number; wood: number; food: number; iron?: number; grain?: number; flour?: number; planks?: number; milk?: number; bricks?: number; steel?: number; coal?: number; cotton?: number; feed?: number; garments?: number; furniture?: number; brokeDays: number; loan?: number; happiness?: number; taxRate?: number; mayor?: number; elected?: number;
  jobPriority?: Record<string, 'high' | 'low'>; jobReq?: Record<string, 0 | 1 | 2>; foodAdj?: number; wageAuto?: boolean; wages?: Record<string, number>; ai?: boolean; tint?: string; relation?: number; style?: string; owes?: City['owes']; arrivals?: City['arrivals']; balance?: Balance; foodYesterday?: { made: number; eaten: number }; campaign?: City['campaign']; promise?: City['promise'];
}

export interface EconomyState { day: number; dayT: number; active: number; cities: CitySave[] }

export interface Grant { money: number; stone: number; wood: number; food: number; iron: number; bricks?: number; steel?: number }
export const START_GRANT: Grant = { money: 5000, stone: 120, wood: 120, food: 600, iron: 30, bricks: 160, steel: 40 };
/** What a freshly founded city starts with (the founding cost is paid by the active city). */
export const NEW_CITY_GRANT: Grant = { money: 1800, stone: 50, wood: 50, food: 200, iron: 10, bricks: 60, steel: 10 };

const blankBalance = (): Balance => ({ incomeTax: 0, foodSales: 0, propertyTax: 0, businessTax: 0, utilities: 0, publicWages: 0, upkeep: 0, net: 0 });

function blankCity(id: number, name: string, founded: number, g: Grant = { money: 0, stone: 0, wood: 0, food: 0, iron: 0 }): City {
  return {
    id, name, founded, ...g, energyDemand: 0, energyCapacity: 0, powered: 1, water: 1,
    foodMade: 0, foodYesterday: { made: 0, eaten: 0 }, balance: blankBalance(), deaths: 0, brokeDays: 0, loan: 0, happiness: 65, taxRate: 0.25, mayor: -1, elected: 0,
    jobPriority: {}, jobReq: {}, wageAuto: true, wages: {}, pollution: 0, tourists: 0, smart: false, railLink: false,
    ledger: blankLedger(), ledgerDays: [], mood: [], grain: 0, flour: 0, planks: 0, stored: 0, milk: 0, bricks: g.bricks ?? 0, steel: g.steel ?? 0, coal: 0, cotton: 0, feed: 0, garments: 0, furniture: 0, priceFactor: 1, piped: 1,
  };
}

/**
 * The clock plus every city's treasury. `money`, `stone`, `wood`, `food` and the energy figures
 * act on the ACTIVE city (the one whose Town Hall the player selected) — building costs come from it.
 */
export class Economy {
  readonly cities = new Map<number, City>();
  /** City the player is acting for. */
  active = 0;
  private nextCity = 1;
  private readonly none: City = blankCity(0, '—', 1);

  day = 1;
  /** Seconds into the current day. New worlds start in the morning. */
  // a new world starts on a bright morning (about 8:40)
  dayT = DAY_SECONDS * 0.36;

  /** Create a city; the first one becomes active. */
  found(name: string, grant: Grant): City {
    const c = blankCity(this.nextCity++, name, this.day, { ...grant });
    this.cities.set(c.id, c);
    if (!this.cities.has(this.active)) this.active = c.id;
    return c;
  }

  get city(): City { return this.cities.get(this.active) ?? this.cities.values().next().value ?? this.none; }
  get money() { return this.city.money; }
  set money(v: number) { this.city.money = v; }
  get stone() { return this.city.stone; }
  set stone(v: number) { this.city.stone = v; }
  get wood() { return this.city.wood; }
  set wood(v: number) { this.city.wood = v; }
  get food() { return this.city.food; }
  set food(v: number) { this.city.food = v; }
  get iron() { return this.city.iron; }
  set iron(v: number) { this.city.iron = v; }
  get powered() { return this.city.powered; }
  get energyDemand() { return this.city.energyDemand; }
  get energyCapacity() { return this.city.energyCapacity; }

  get totalMoney() { let s = 0; for (const c of this.cities.values()) if (!c.ai) s += c.money; return s; }
  get totalStone() { let s = 0; for (const c of this.cities.values()) if (!c.ai) s += c.stone; return s; }
  get totalWood() { let s = 0; for (const c of this.cities.values()) if (!c.ai) s += c.wood; return s; }
  get totalFood() { let s = 0; for (const c of this.cities.values()) if (!c.ai) s += c.food; return s; }

  get timeOfDay() { return this.dayT / DAY_SECONDS; }

  canAfford(money: number, stone: number, wood = 0, iron = 0) {
    return this.money >= money && this.stone >= stone && this.wood >= wood && this.iron >= iron;
  }

  spend(money: number, stone: number, wood = 0, iron = 0, reason = 'Construction') {
    const c = this.city;
    this.add(c, 'money', -money, reason);
    this.add(c, 'stone', -stone, reason);
    this.add(c, 'wood', -wood, reason);
    this.add(c, 'iron', -iron, reason);
  }

  /** Write a change into the city's books (the amount is already applied). */
  note(city: City, res: Res, amount: number, reason: string) {
    if (!amount || !Number.isFinite(amount)) return;
    const l = city.ledger[res];
    l[reason] = (l[reason] ?? 0) + amount;
  }

  /** Change a resource and write it into the books. */
  /** How much of a good a town can keep (town hall + warehouses); set by the game. */
  capacity: (city: City, res: Res) => number = () => Infinity;

  add(city: City, res: Res, amount: number, reason: string) {
    if (!amount) return;
    if (amount > 0 && res !== 'money') {
      // no room in the stores: what does not fit spoils
      const room = Math.max(0, this.capacity(city, res) - city[res]);
      if (amount > room) {
        this.note(city, res, amount, reason);
        this.note(city, res, -(amount - room), 'Spoiled — no room in the stores');
        city[res] += room;
        return;
      }
    }
    city[res] += amount;
    this.note(city, res, amount, reason);
  }

  /** A day is over: today's page of the books becomes yesterday's. */
  closeBooks() {
    for (const c of this.cities.values()) {
      c.ledgerDays.unshift(c.ledger);
      c.ledgerDays.length = Math.min(c.ledgerDays.length, LEDGER_DAYS);
      c.ledger = blankLedger();
    }
  }

  /** Advance the clock; returns true when a new day starts. */
  tick(dt: number) {
    this.dayT += dt;
    if (this.dayT < DAY_SECONDS) return false;
    this.dayT -= DAY_SECONDS;
    this.day++;
    return true;
  }

  /**
   * One shared grid: every plant feeds every connected building, whichever city it belongs to.
   * Each plant's city pays for the wood it burns, in proportion to the plant's output.
   */
  /**
   * Burn wood for the energy the grid needs right now. Returns how much energy per day is really available
   * (plant capacity, limited by wood); the caller decides which buildings get it.
   */
  updateEnergy(dt: number, demand: number, plants: { city: City; power: number; coal?: boolean }[]) {
    const capacity = plants.reduce((a, p) => a + p.power, 0);
    if (capacity <= 0) return 0;
    const served = Math.min(demand, capacity);
    const need = (served * dt) / DAY_SECONDS;
    if (need <= 0) return capacity;
    let supplied = 0;
    for (const p of plants) {
      if (p.coal) {
        const burnt = Math.min(Math.max(0, p.city.coal), (need * (p.power / capacity)) / CHAIN2.energyPerCoal);
        p.city.coal -= burnt;
        this.note(p.city, 'coal', -burnt, 'Burnt in coal power plants');
        supplied += burnt * CHAIN2.energyPerCoal;
        continue;
      }
      const burnt = Math.min(Math.max(0, p.city.wood), (need * (p.power / capacity)) / ENERGY_PER_WOOD);
      p.city.wood -= burnt;
      this.note(p.city, 'wood', -burnt, 'Burnt in power plants');
      supplied += burnt * ENERGY_PER_WOOD;
    }
    return capacity * (supplied / need);
  }

  state(): EconomyState {
    return {
      day: this.day, dayT: this.dayT, active: this.active,
      cities: [...this.cities.values()].map((c) => ({
        id: c.id, name: c.name, founded: c.founded, money: c.money, stone: c.stone, wood: c.wood, food: c.food, iron: Math.round(c.iron), grain: Math.round(c.grain), flour: Math.round(c.flour), planks: Math.round(c.planks), milk: Math.round(c.milk), bricks: Math.round(c.bricks), steel: Math.round(c.steel), coal: Math.round(c.coal), cotton: Math.round(c.cotton), feed: Math.round(c.feed), garments: Math.round(c.garments), furniture: Math.round(c.furniture), brokeDays: c.brokeDays, loan: c.loan, happiness: Math.round(c.happiness), taxRate: c.taxRate, mayor: c.mayor, elected: c.elected,
        jobPriority: c.jobPriority, jobReq: c.jobReq, foodAdj: c.foodAdj, wageAuto: c.wageAuto, wages: c.wages, ai: c.ai, tint: c.tint, style: c.style, owes: c.owes, arrivals: c.arrivals, balance: c.balance, foodYesterday: c.foodYesterday, relation: c.relation === undefined ? undefined : Math.round(c.relation), campaign: c.campaign, promise: c.promise,
      })),
    };
  }

  load(s: EconomyState) {
    this.day = s.day;
    this.dayT = s.dayT;
    this.cities.clear();
    for (const c of s.cities) {
      const city = blankCity(c.id, c.name, c.founded, { money: c.money, stone: c.stone, wood: c.wood, food: c.food, iron: c.iron ?? 0 });
      city.brokeDays = c.brokeDays;
      city.grain = c.grain ?? 0;
      city.flour = c.flour ?? 0;
      city.planks = c.planks ?? 0;
      city.milk = c.milk ?? 0;
      city.bricks = c.bricks ?? 0;
      city.steel = c.steel ?? 0;
      city.coal = c.coal ?? 0;
      city.cotton = c.cotton ?? 0;
      city.feed = c.feed ?? 0;
      city.garments = c.garments ?? 0;
      city.furniture = c.furniture ?? 0;
      city.loan = c.loan ?? 0;
      city.happiness = c.happiness ?? 65;
      city.taxRate = c.taxRate ?? 0.25;
      city.mayor = c.mayor ?? -1;
      city.elected = c.elected ?? 0;
      city.jobPriority = c.jobPriority ?? {};
      city.jobReq = c.jobReq ?? {};
      city.foodAdj = c.foodAdj ?? 0;
      city.wageAuto = c.wageAuto ?? true;
      city.wages = c.wages ?? {};
      city.ai = c.ai;
      city.tint = c.tint;
      city.relation = c.relation;
      city.style = c.style;
      city.owes = c.owes;
      city.arrivals = c.arrivals;
      if (c.balance) city.balance = c.balance;
      if (c.foodYesterday) city.foodYesterday = c.foodYesterday;
      city.campaign = c.campaign;
      city.promise = c.promise;
      this.cities.set(c.id, city);
      this.nextCity = Math.max(this.nextCity, c.id + 1);
    }
    this.active = this.cities.has(s.active) ? s.active : (this.cities.keys().next().value ?? 0);
  }
}
