import { DAY_SECONDS } from '../config';
import { Buildings } from '../buildings/Buildings';
import { BUILDINGS, ENERGY_PER_WOOD } from '../buildings/BuildingTypes';

export interface EconomyState { money: number; stone: number; wood: number; food: number; day: number; dayT: number }

/** City resources and the energy grid. Wages, taxes and food are settled daily by Population. */
export class Economy {
  money = 4000;
  stone = 120;
  wood = 60;
  food = 400;
  day = 1;
  /** Seconds into the current day. New worlds start in the morning. */
  dayT = DAY_SECONDS * 0.2;

  /** Energy per day: demand of all buildings and what the plants could make. */
  energyDemand = 0;
  energyCapacity = 0;
  /** Share of demand actually supplied right now (0..1). */
  powered = 1;
  woodRate = 0;

  get timeOfDay() { return this.dayT / DAY_SECONDS; }

  canAfford(money: number, stone: number) {
    return this.money >= money && this.stone >= stone;
  }

  spend(money: number, stone: number) {
    this.money -= money;
    this.stone -= stone;
  }

  /** Advance the clock; returns true when a new day starts. */
  tick(dt: number) {
    this.dayT += dt;
    if (this.dayT < DAY_SECONDS) return false;
    this.dayT -= DAY_SECONDS;
    this.day++;
    return true;
  }

  /** Burn wood in the power plants to cover the energy demand. */
  updateEnergy(dt: number, buildings: Buildings) {
    let demand = 0, capacity = 0;
    for (const b of buildings.list) {
      const d = BUILDINGS[b.kind];
      demand += d.energy;
      if (d.power) capacity += d.power * (d.jobs ? Math.min(1, b.workers / d.jobs) : 1);
    }
    this.energyDemand = demand;
    this.energyCapacity = capacity;
    if (demand <= 0) { this.powered = 1; return; }
    const need = (Math.min(demand, capacity) * dt) / DAY_SECONDS;
    const woodNeed = need / ENERGY_PER_WOOD;
    const burnt = Math.min(this.wood, woodNeed);
    this.wood -= burnt;
    const made = burnt * ENERGY_PER_WOOD;
    const ratio = need > 0 ? (made / need) * (Math.min(demand, capacity) / demand) : capacity >= demand ? 1 : 0;
    // smooth so the HUD doesn't flicker
    this.powered += (ratio - this.powered) * Math.min(1, dt * 2);
  }

  state(): EconomyState {
    return { money: this.money, stone: this.stone, wood: this.wood, food: this.food, day: this.day, dayT: this.dayT };
  }

  load(s: Partial<EconomyState>) {
    Object.assign(this, s);
  }
}
