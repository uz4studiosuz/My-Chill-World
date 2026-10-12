import type { BuildingKind } from '../buildings/BuildingTypes';

export interface GoalContext {
  population: number;
  roads: number;
  houses: number;
  cities: number;
  year: number;
  maxHappiness: number;
  familyBusiness: boolean;
  count: (kind: BuildingKind) => number;
}

export interface GoalDef {
  id: string;
  /** English text, translated in the UI. */
  title: string;
  reward: number;
  /** 0..1 */
  progress: (c: GoalContext, debtFreeDays: number) => number;
}

const ratio = (v: number, target: number) => Math.min(1, v / target);

export const GOALS: GoalDef[] = [
  { id: 'roads', title: 'Build 30 road tiles', reward: 300, progress: (c) => ratio(c.roads, 30) },
  { id: 'houses', title: 'Have 20 houses', reward: 600, progress: (c) => ratio(c.houses, 20) },
  { id: 'shop', title: 'Open a grocery store', reward: 400, progress: (c) => ratio(c.count('grocery'), 1) },
  { id: 'school', title: 'Build a school', reward: 500, progress: (c) => ratio(c.count('school'), 1) },
  { id: 'pop150', title: 'Reach 150 citizens', reward: 1000, progress: (c) => ratio(c.population, 150) },
  { id: 'hospital', title: 'Build a hospital', reward: 1000, progress: (c) => ratio(c.count('hospital'), 1) },
  { id: 'happy', title: 'Make a city 75% happy', reward: 1200, progress: (c) => ratio(c.maxHappiness, 75) },
  { id: 'business', title: 'A family owns a business', reward: 600, progress: (c) => (c.familyBusiness ? 1 : 0) },
  { id: 'debtfree', title: 'Stay out of debt for a whole year', reward: 1500, progress: (_c, d) => ratio(d, 12) },
  { id: 'university', title: 'Build a university', reward: 1500, progress: (c) => ratio(c.count('university'), 1) },
  { id: 'city2', title: 'Found a second city', reward: 2000, progress: (c) => ratio(c.cities, 2) },
  { id: 'pop300', title: 'Reach 300 citizens', reward: 2500, progress: (c) => ratio(c.population, 300) },
  { id: 'year3', title: 'Reach year 3', reward: 2000, progress: (c) => ratio(c.year, 3) },
];

export interface GoalsSave { done: string[]; debtFree: number }

/** Goals with money rewards — a gentle path through the game. */
export class Goals {
  readonly done = new Set<string>();
  debtFree = 0;

  load(s?: GoalsSave) {
    this.done.clear();
    for (const id of s?.done ?? []) this.done.add(id);
    this.debtFree = s?.debtFree ?? 0;
  }

  save(): GoalsSave {
    return { done: [...this.done], debtFree: this.debtFree };
  }

  /** Count debt-free days (call once a day). */
  newDay(inDebt: boolean) {
    this.debtFree = inDebt ? 0 : this.debtFree + 1;
  }

  /** Goals completed just now. */
  check(c: GoalContext): GoalDef[] {
    const out: GoalDef[] = [];
    for (const g of GOALS) {
      if (this.done.has(g.id) || g.progress(c, this.debtFree) < 1) continue;
      this.done.add(g.id);
      out.push(g);
    }
    return out;
  }
}
