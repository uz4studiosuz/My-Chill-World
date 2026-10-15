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
  /** More figures for the later missions: chains running, railway link, joint projects, credit rating… */
  flags: Record<string, number>;
}

export interface GoalDef {
  id: string;
  /** English text, translated in the UI. */
  title: string;
  reward: number;
  /** The chapter of the campaign (1 village … 4 metropolis). */
  chapter: number;
  /** 0..1 */
  progress: (c: GoalContext, debtFreeDays: number) => number;
}

const ratio = (v: number, target: number) => Math.min(1, v / target);

export const GOALS: GoalDef[] = [
  // chapter 1: a village
  { id: 'roads', chapter: 1, title: 'Build 30 road tiles', reward: 300, progress: (c) => ratio(c.roads, 30) },
  { id: 'houses', chapter: 1, title: 'Have 20 houses', reward: 600, progress: (c) => ratio(c.houses, 20) },
  { id: 'shop', chapter: 1, title: 'Open a grocery store', reward: 400, progress: (c) => ratio(c.count('grocery'), 1) },
  { id: 'school', chapter: 1, title: 'Build a school', reward: 500, progress: (c) => ratio(c.count('school'), 1) },
  { id: 'business', chapter: 1, title: 'A family owns a business', reward: 600, progress: (c) => (c.familyBusiness ? 1 : 0) },
  // chapter 2: a town
  { id: 'pop150', chapter: 2, title: 'Reach 150 citizens', reward: 1000, progress: (c) => ratio(c.population, 150) },
  { id: 'hospital', chapter: 2, title: 'Build a hospital', reward: 1000, progress: (c) => ratio(c.count('hospital'), 1) },
  { id: 'happy', chapter: 2, title: 'Make a city 75% happy', reward: 1200, progress: (c) => ratio(c.maxHappiness, 75) },
  { id: 'factory', chapter: 2, title: 'Open the first factory', reward: 1000, progress: (c) => ratio(c.count('factory') + c.count('brickworks') + c.count('sawmill'), 1) },
  { id: 'chains3', chapter: 2, title: 'Run 3 production chains', reward: 1200, progress: (c) => ratio(c.flags.chains ?? 0, 3) },
  { id: 'water', chapter: 2, title: 'Every home has a water pipe', reward: 800, progress: (c) => ratio(c.flags.piped ?? 0, 1) },
  // chapter 3: a city
  { id: 'university', chapter: 3, title: 'Build a university', reward: 1500, progress: (c) => ratio(c.count('university'), 1) },
  { id: 'pop300', chapter: 3, title: 'Reach 300 citizens', reward: 2500, progress: (c) => ratio(c.population, 300) },
  { id: 'debtfree', chapter: 3, title: 'Stay out of debt for a whole year', reward: 1500, progress: (_c, d) => ratio(d, 12) },
  { id: 'rail', chapter: 3, title: 'Join two towns by railway', reward: 2000, progress: (c) => ratio(c.flags.railLink ?? 0, 1) },
  { id: 'embassy', chapter: 3, title: 'Open an embassy', reward: 1200, progress: (c) => ratio(c.count('embassy'), 1) },
  { id: 'joint', chapter: 3, title: 'Start a joint project with a neighbour', reward: 2000, progress: (c) => ratio(c.flags.joint ?? 0, 1) },
  // chapter 4: a metropolis
  { id: 'city2', chapter: 4, title: 'Found a second city', reward: 2000, progress: (c) => ratio(c.cities, 2) },
  { id: 'pop800', chapter: 4, title: 'Reach 800 citizens', reward: 5000, progress: (c) => ratio(c.population, 800) },
  { id: 'metro', chapter: 4, title: 'Open a metro line (2 stations)', reward: 3000, progress: (c) => ratio(c.count('metro'), 2) },
  { id: 'chains8', chapter: 4, title: 'Run 8 production chains', reward: 4000, progress: (c) => ratio(c.flags.chains ?? 0, 8) },
  { id: 'credit', chapter: 4, title: 'Reach a credit rating of 85', reward: 2500, progress: (c) => ratio(c.flags.credit ?? 0, 85) },
  { id: 'tower', chapter: 4, title: 'Build a 30-storey tower', reward: 3000, progress: (c) => ratio(c.count('tower30') + c.count('tower50'), 1) },
  { id: 'year3', chapter: 4, title: 'Reach year 3', reward: 2000, progress: (c) => ratio(c.year, 3) },
];

/** Names of the chapters of the campaign. */
export const CHAPTERS = ['', 'Chapter 1 · A village', 'Chapter 2 · A town', 'Chapter 3 · A city', 'Chapter 4 · A metropolis'];

/** The chapter the player is in: the first one with missions left (all done = 5). */
export const chapterOf = (done: Set<string>) => {
  for (let ch = 1; ch <= 4; ch++) if (GOALS.some((g) => g.chapter === ch && !done.has(g.id))) return ch;
  return 5;
};


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
    const ch = chapterOf(this.done);
    // missions of the current chapter count (and those of earlier ones); the later chapters open in turn
    for (const g of GOALS) {
      if (g.chapter > ch || this.done.has(g.id) || g.progress(c, this.debtFree) < 1) continue;
      this.done.add(g.id);
      out.push(g);
    }
    return out;
  }
}
