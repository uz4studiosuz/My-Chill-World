import { DAY_SECONDS } from '../config';
import { ENERGY_PER_WOOD } from '../buildings/BuildingTypes';

export interface Balance { incomeTax: number; foodSales: number; propertyTax: number; businessTax: number; utilities: number; publicWages: number; upkeep: number; net: number }

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
}

export interface CitySave {
  id: number; name: string; founded: number; money: number; stone: number; wood: number; food: number; brokeDays: number;
}

export interface EconomyState { day: number; dayT: number; active: number; cities: CitySave[] }

export interface Grant { money: number; stone: number; wood: number; food: number }
export const START_GRANT: Grant = { money: 5000, stone: 120, wood: 120, food: 400 };
/** What a freshly founded city starts with (the founding cost is paid by the active city). */
export const NEW_CITY_GRANT: Grant = { money: 1800, stone: 50, wood: 50, food: 200 };

const blankBalance = (): Balance => ({ incomeTax: 0, foodSales: 0, propertyTax: 0, businessTax: 0, utilities: 0, publicWages: 0, upkeep: 0, net: 0 });

function blankCity(id: number, name: string, founded: number, g: Grant = { money: 0, stone: 0, wood: 0, food: 0 }): City {
  return {
    id, name, founded, ...g, energyDemand: 0, energyCapacity: 0, powered: 1, water: 1,
    foodMade: 0, foodYesterday: { made: 0, eaten: 0 }, balance: blankBalance(), deaths: 0, brokeDays: 0,
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
  dayT = DAY_SECONDS * 0.2;

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
  get powered() { return this.city.powered; }
  get energyDemand() { return this.city.energyDemand; }
  get energyCapacity() { return this.city.energyCapacity; }

  get totalMoney() { let s = 0; for (const c of this.cities.values()) s += c.money; return s; }
  get totalStone() { let s = 0; for (const c of this.cities.values()) s += c.stone; return s; }
  get totalWood() { let s = 0; for (const c of this.cities.values()) s += c.wood; return s; }
  get totalFood() { let s = 0; for (const c of this.cities.values()) s += c.food; return s; }

  get timeOfDay() { return this.dayT / DAY_SECONDS; }

  canAfford(money: number, stone: number, wood = 0) {
    return this.money >= money && this.stone >= stone && this.wood >= wood;
  }

  spend(money: number, stone: number, wood = 0) {
    this.money -= money;
    this.stone -= stone;
    this.wood -= wood;
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
  updateEnergy(dt: number, demand: number, plants: { city: City; power: number }[]) {
    const capacity = plants.reduce((a, p) => a + p.power, 0);
    let ratio = 1;
    if (demand > 0) {
      const served = Math.min(demand, capacity);
      const need = (served * dt) / DAY_SECONDS;
      let supplied = 0;
      for (const p of plants) {
        const burnt = Math.min(p.city.wood, (need * (p.power / capacity)) / ENERGY_PER_WOOD);
        p.city.wood -= burnt;
        supplied += burnt * ENERGY_PER_WOOD;
      }
      ratio = need > 0 ? (supplied / need) * (served / demand) : 0;
    }
    for (const c of this.cities.values()) c.powered += (ratio - c.powered) * Math.min(1, dt * 2);
  }

  state(): EconomyState {
    return {
      day: this.day, dayT: this.dayT, active: this.active,
      cities: [...this.cities.values()].map((c) => ({
        id: c.id, name: c.name, founded: c.founded, money: c.money, stone: c.stone, wood: c.wood, food: c.food, brokeDays: c.brokeDays,
      })),
    };
  }

  load(s: EconomyState) {
    this.day = s.day;
    this.dayT = s.dayT;
    this.cities.clear();
    for (const c of s.cities) {
      const city = blankCity(c.id, c.name, c.founded, { money: c.money, stone: c.stone, wood: c.wood, food: c.food });
      city.brokeDays = c.brokeDays;
      this.cities.set(c.id, city);
      this.nextCity = Math.max(this.nextCity, c.id + 1);
    }
    this.active = this.cities.has(s.active) ? s.active : (this.cities.keys().next().value ?? 0);
  }
}
