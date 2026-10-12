import { DAY_SECONDS } from '../config';
import { ENERGY_PER_WOOD } from '../buildings/BuildingTypes';

export interface EconomyState { money: number; stone: number; wood: number; food: number; day: number; dayT: number }

/** City resources and the energy grid. Wages, taxes and food are settled daily by Population. */
export class Economy {
  money = 5000;
  stone = 120;
  wood = 120;
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

  /** Burn wood in the power plants to cover the demand of grid-connected buildings. */
  updateEnergy(dt: number, demand: number, capacity: number) {
    this.energyDemand = demand;
    this.energyCapacity = capacity;
    let ratio = 1;
    if (demand > 0) {
      const need = (Math.min(demand, capacity) * dt) / DAY_SECONDS;
      const burnt = Math.min(this.wood, need / ENERGY_PER_WOOD);
      this.wood -= burnt;
      ratio = need > 0 ? ((burnt * ENERGY_PER_WOOD) / need) * (Math.min(demand, capacity) / demand) : 0;
    }
    this.powered += (ratio - this.powered) * Math.min(1, dt * 2);
  }

  state(): EconomyState {
    return { money: this.money, stone: this.stone, wood: this.wood, food: this.food, day: this.day, dayT: this.dayT };
  }

  load(s: Partial<EconomyState>) {
    Object.assign(this, s);
  }
}
