import { BUILDINGS } from '../buildings/BuildingTypes';
import type { Building, Buildings } from '../buildings/Buildings';
import type { Walker } from './Walkers';

export type Sex = 'm' | 'f';
export type Role = 'parent' | 'child' | 'elder';

export interface Citizen {
  id: number;
  name: string;
  sex: Sex;
  age: number;
  family: number;
  role: Role;
  /** Workplace / school building id, or -1. */
  job: number;
  school: number;
  /** School progress 0..1 — educated adults earn more. */
  edu: number;
  /** Where the person is: at home, at work/school/errand, or travelling. */
  state: 'home' | 'away' | 'travel';
  /** Building the person is currently in (when not travelling). */
  at: number;
  /** Today's schedule as fractions of the day. */
  leaveAt: number;
  returnAt: number;
  errand: boolean;
  /** Took the family car this morning. */
  drove: boolean;
  variant: number;
  walker?: Walker;
}

export interface FamilyCar {
  color: string;
  at: 'home' | 'away' | 'moving';
  /** Parking spot while away: building id + slot index. */
  lot?: number;
  slot?: number;
}

export interface Family {
  id: number;
  surname: string;
  home: number;
  money: number;
  /** Net earnings of the last day. */
  income: number;
  car: FamilyCar | null;
  members: number[];
  hunger: number;
  debtDays: number;
}

export interface DayReport {
  incomeTax: number;
  publicWages: number;
  foodEaten: number;
  foodSales: number;
  propertyTax: number;
  births: number;
  deaths: number;
  leftTown: number;
  carsBought: number;
}

const MALE = ['Aziz', 'Bekzod', 'Javohir', 'Sardor', 'Timur', 'Rustam', 'Jasur', 'Otabek', 'Dilshod', 'Sherzod', 'Akmal', 'Bobur', 'Daniel', 'Leo', 'Adam', 'Omar', 'Ali', 'Sam', 'Ivan', 'Kenji'];
const FEMALE = ['Malika', 'Dilnoza', 'Madina', 'Zarina', 'Nilufar', 'Shahnoza', 'Gulnora', 'Feruza', 'Sevara', 'Kamola', 'Laylo', 'Nodira', 'Emma', 'Mia', 'Sara', 'Lina', 'Aisha', 'Yuki', 'Anna', 'Nora'];
const SURNAMES = ['Karimov', 'Rahimov', 'Aliyev', 'Tursunov', 'Yusupov', 'Nazarov', 'Saidov', 'Ergashev', 'Qodirov', 'Mirzayev', 'Smith', 'Novak', 'Haddad', 'Tanaka', 'Silva', 'Becker'];
export const CAR_COLORS = ['#d9443b', '#3a6fd1', '#f2f2ee', '#f1c232', '#4c9a52', '#8a8f98', '#2d3138', '#e07b2e', '#6fc3d8'];

const CAR_PRICE = 700;
const CAR_UPKEEP = 2;
const INCOME_TAX = 0.25;
const PROPERTY_TAX = 4;
const FOOD_PRICE = 1;
const RETIRE_AGE = 65;
const ADULT_AGE = 18;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Surnames get the feminine form for women (Karimov → Karimova). */
export function displaySurname(surname: string, sex: Sex) {
  return sex === 'f' && /(ov|ev|yev)$/.test(surname) ? surname + 'a' : surname;
}

export class Population {
  readonly citizens = new Map<number, Citizen>();
  readonly families = new Map<number, Family>();
  private nextCitizen = 1;
  private nextFamily = 1;

  get size() { return this.citizens.size; }

  familyAt(home: number) {
    for (const f of this.families.values()) if (f.home === home) return f;
    return undefined;
  }

  members(f: Family) {
    return f.members.map((id) => this.citizens.get(id)!).filter(Boolean);
  }

  /** Mothers stay home for the first two years of a baby's life. */
  onLeave(c: Citizen) {
    if (c.sex !== 'f' || c.role !== 'parent') return false;
    const f = this.families.get(c.family)!;
    return this.members(f).some((m) => m.age < 2);
  }

  canWork(c: Citizen) {
    return c.age >= ADULT_AGE && c.age < RETIRE_AGE && !this.onLeave(c);
  }

  /** A newly arriving family of 2–6 people. */
  createFamily(home: number, opts: { size?: number; carChance?: number; money?: number } = {}): Family {
    const size = opts.size ?? 2 + Math.floor(Math.random() * 4);
    const f: Family = {
      id: this.nextFamily++, surname: pick(SURNAMES), home, money: opts.money ?? Math.round(rand(200, 1200)),
      income: 0, car: Math.random() < (opts.carChance ?? 0.4) ? { color: pick(CAR_COLORS), at: 'home' } : null,
      members: [], hunger: 0, debtDays: 0,
    };
    this.families.set(f.id, f);
    // bigger families have older parents (and grown-up children who can work)
    const dadAge = Math.round(size >= 6 ? rand(38, 56) : rand(24, 45));
    this.addCitizen(f, 'm', dadAge, 'parent');
    if (size >= 2) this.addCitizen(f, 'f', Math.max(20, dadAge - Math.round(rand(0, 5))), 'parent');
    let left = size - 2;
    const elders = left > 1 && Math.random() < 0.45 ? (Math.random() < 0.4 ? 2 : 1) : 0;
    for (let i = 0; i < elders && left > 0; i++, left--) {
      this.addCitizen(f, i === 0 ? 'f' : 'm', Math.round(rand(63, 80)), 'elder');
    }
    for (let i = 0; i < left; i++) {
      const maxAge = Math.min(30, dadAge - 19);
      this.addCitizen(f, Math.random() < 0.5 ? 'm' : 'f', Math.max(0, Math.round(rand(0, maxAge))), 'child');
    }
    return f;
  }

  addCitizen(f: Family, sex: Sex, age: number, role: Role): Citizen {
    const c: Citizen = {
      id: this.nextCitizen++, name: pick(sex === 'm' ? MALE : FEMALE), sex, age, family: f.id, role,
      job: -1, school: -1, edu: age >= ADULT_AGE ? (Math.random() < 0.5 ? 1 : 0) : 0,
      state: 'home', at: f.home, leaveAt: 0, returnAt: 0, errand: false, drove: false,
      variant: (sex === 'm' ? 0 : 4) + Math.floor(Math.random() * 4),
    };
    this.citizens.set(c.id, c);
    f.members.push(c.id);
    return c;
  }

  removeCitizen(c: Citizen) {
    const f = this.families.get(c.family);
    if (f) f.members = f.members.filter((id) => id !== c.id);
    this.citizens.delete(c.id);
  }

  removeFamily(f: Family) {
    for (const c of this.members(f)) this.citizens.delete(c.id);
    this.families.delete(f.id);
  }

  /** (Re)assign jobs and school places. Nearest free workplace wins. */
  assign(buildings: Buildings) {
    const free = new Map<number, number>();
    const seats = new Map<number, number>();
    for (const b of buildings.list) {
      const d = BUILDINGS[b.kind];
      if (d.jobs) free.set(b.id, d.jobs);
      if (d.students) seats.set(b.id, d.students);
    }
    const homeOf = (c: Citizen) => buildings.get(this.families.get(c.family)?.home ?? -1);
    // keep valid assignments
    for (const c of this.citizens.values()) {
      if (c.job >= 0 && (!free.has(c.job) || !this.canWork(c) || free.get(c.job)! <= 0)) c.job = -1;
      if (c.job >= 0) free.set(c.job, free.get(c.job)! - 1);
      const pupil = c.age >= 6 && c.age < ADULT_AGE;
      if (c.school >= 0 && (!seats.has(c.school) || !pupil || seats.get(c.school)! <= 0)) c.school = -1;
      if (c.school >= 0) seats.set(c.school, seats.get(c.school)! - 1);
    }
    const nearest = (pool: Map<number, number>, from: Building | undefined) => {
      let best = -1, bd = Infinity;
      for (const [id, n] of pool) {
        if (n <= 0) continue;
        const b = buildings.get(id)!;
        const d = from ? Math.abs(b.x - from.x) + Math.abs(b.z - from.z) : 0;
        if (d < bd) { bd = d; best = id; }
      }
      return best;
    };
    for (const c of this.citizens.values()) {
      if (c.job < 0 && this.canWork(c)) {
        const id = nearest(free, homeOf(c));
        if (id >= 0) { c.job = id; free.set(id, free.get(id)! - 1); }
      }
      if (c.school < 0 && c.age >= 6 && c.age < ADULT_AGE) {
        const id = nearest(seats, homeOf(c));
        if (id >= 0) { c.school = id; seats.set(id, seats.get(id)! - 1); }
      }
    }
    for (const b of buildings.list) b.workers = 0;
    for (const c of this.citizens.values()) {
      const b = c.job >= 0 ? buildings.get(c.job) : undefined;
      if (b) b.workers++;
    }
  }

  /** Plan everyone's day: when they leave and come back (fractions of the day). */
  planDay() {
    for (const c of this.citizens.values()) {
      c.errand = false;
      if (c.job >= 0) {
        c.leaveAt = rand(0.22, 0.32);
        c.returnAt = rand(0.66, 0.76);
      } else if (c.school >= 0) {
        c.leaveAt = rand(0.24, 0.3);
        c.returnAt = rand(0.58, 0.64);
      } else if (c.age >= 3 && c.role !== 'child' && Math.random() < 0.45) {
        // errands / walks — mothers on leave take the baby along
        c.errand = true;
        c.leaveAt = rand(0.34, 0.55);
        c.returnAt = c.leaveAt + rand(0.06, 0.14);
      } else {
        c.leaveAt = 2;
        c.returnAt = 2;
      }
    }
  }

  wage(c: Citizen, b: Building | undefined, powered: number) {
    if (!b) return 0;
    const d = BUILDINGS[b.kind];
    const needsPower = d.energy > 0 ? 0.5 + 0.5 * powered : 1;
    return d.salary * (1 + 0.5 * c.edu) * needsPower;
  }

  /** End-of-day simulation: wages, food, ageing, births, deaths, cars, moving out. */
  daily(buildings: Buildings, food: number, powered: number, freeHomes: () => Building[]): DayReport {
    const r: DayReport = { incomeTax: 0, publicWages: 0, foodEaten: 0, foodSales: 0, propertyTax: 0, births: 0, deaths: 0, leftTown: 0, carsBought: 0 };
    let foodLeft = food;

    for (const f of [...this.families.values()]) {
      const people = this.members(f);
      let earned = 0;
      for (const c of people) {
        if (c.job < 0) continue;
        const b = buildings.get(c.job);
        const gross = this.wage(c, b, powered);
        if (b && BUILDINGS[b.kind].publicJob) r.publicWages += gross;
        r.incomeTax += gross * INCOME_TAX;
        earned += gross * (1 - INCOME_TAX);
      }
      // food: each person eats one unit a day and pays for it
      const need = people.length;
      if (foodLeft >= need) {
        foodLeft -= need;
        r.foodEaten += need;
        r.foodSales += need * FOOD_PRICE;
        earned -= need * FOOD_PRICE;
        f.hunger = 0;
      } else {
        r.foodEaten += foodLeft;
        foodLeft = 0;
        f.hunger++;
      }
      earned -= PROPERTY_TAX;
      r.propertyTax += PROPERTY_TAX;
      if (f.car) earned -= CAR_UPKEEP;
      f.money += earned;
      f.income = Math.round(earned);
      f.debtDays = f.money < 0 ? f.debtDays + 1 : 0;
      if (!f.car && f.money > CAR_PRICE + 500) {
        f.money -= CAR_PRICE;
        f.car = { color: pick(CAR_COLORS), at: 'home' };
        r.carsBought++;
      }
    }

    // ageing, school progress, deaths
    for (const c of [...this.citizens.values()]) {
      c.age++;
      if (c.school >= 0) c.edu = Math.min(1, c.edu + 1 / 10);
      if (c.age >= ADULT_AGE && c.role === 'child' && c.school >= 0) c.school = -1;
      if (c.role === 'parent' && c.age >= 70) c.role = 'elder';
      if (c.age >= 68 && Math.random() < (c.age - 66) * 0.035) {
        this.removeCitizen(c);
        r.deaths++;
      }
    }

    // births
    for (const f of this.families.values()) {
      const people = this.members(f);
      const dad = people.find((c) => c.role === 'parent' && c.sex === 'm' && c.age < 50);
      const mom = people.find((c) => c.role === 'parent' && c.sex === 'f' && c.age >= 20 && c.age <= 42);
      if (dad && mom && people.length < BUILDINGS.house.housing && f.hunger === 0 && Math.random() < 0.18) {
        this.addCitizen(f, Math.random() < 0.5 ? 'm' : 'f', 0, 'child');
        r.births++;
      }
    }

    // grown-up children move into their own home (sometimes with a partner)
    for (const f of [...this.families.values()]) {
      const grown = this.members(f).filter((c) => c.role === 'child' && c.age >= 20);
      for (const c of grown) {
        const home = freeHomes()[0];
        if (!home || Math.random() > 0.35) continue;
        const nf: Family = { id: this.nextFamily++, surname: f.surname, home: home.id, money: 150, income: 0, car: null, members: [], hunger: 0, debtDays: 0 };
        this.families.set(nf.id, nf);
        f.members = f.members.filter((id) => id !== c.id);
        c.family = nf.id;
        c.role = 'parent';
        nf.members.push(c.id);
        f.money -= 100;
        nf.money += 100;
        const partner = [...this.citizens.values()].find((p) => p.role === 'child' && p.age >= 20 && p.sex !== c.sex && p.family !== f.id);
        if (partner && Math.random() < 0.6) {
          const pf = this.families.get(partner.family)!;
          pf.members = pf.members.filter((id) => id !== partner.id);
          partner.family = nf.id;
          partner.role = 'parent';
          nf.members.push(partner.id);
        }
      }
    }

    // hungry or broke families leave; empty families disappear
    for (const f of [...this.families.values()]) {
      if (!f.members.length) { this.families.delete(f.id); continue; }
      if (f.hunger >= 3 || f.debtDays >= 6) {
        r.leftTown += f.members.length;
        this.removeFamily(f);
      }
    }
    return r;
  }

  counts() {
    const out = { men: 0, women: 0, boys: 0, girls: 0, babies: 0, elders: 0, students: 0, workers: 0, workforce: 0 };
    for (const c of this.citizens.values()) {
      if (c.age < 3) out.babies++;
      else if (c.age < ADULT_AGE) c.sex === 'm' ? out.boys++ : out.girls++;
      else if (c.age >= RETIRE_AGE) out.elders++;
      else c.sex === 'm' ? out.men++ : out.women++;
      if (c.school >= 0) out.students++;
      if (c.job >= 0) out.workers++;
      if (this.canWork(c)) out.workforce++;
    }
    return out;
  }

  serialize() {
    return [...this.families.values()].map((f) => ({
      id: f.id, surname: f.surname, home: f.home, money: Math.round(f.money), income: f.income,
      car: f.car ? { color: f.car.color } : null, hunger: f.hunger, debtDays: f.debtDays,
      members: this.members(f).map((c) => ({ id: c.id, name: c.name, sex: c.sex, age: c.age, role: c.role, job: c.job, school: c.school, edu: c.edu, variant: c.variant })),
    }));
  }

  deserialize(data: ReturnType<Population['serialize']>) {
    this.citizens.clear();
    this.families.clear();
    for (const fd of data) {
      const f: Family = { id: fd.id, surname: fd.surname, home: fd.home, money: fd.money, income: fd.income, car: fd.car ? { color: fd.car.color, at: 'home' } : null, members: [], hunger: fd.hunger, debtDays: fd.debtDays };
      this.families.set(f.id, f);
      this.nextFamily = Math.max(this.nextFamily, f.id + 1);
      for (const m of fd.members) {
        const c: Citizen = { ...m, family: f.id, state: 'home', at: f.home, leaveAt: 2, returnAt: 2, errand: false, drove: false };
        this.citizens.set(c.id, c);
        f.members.push(c.id);
        this.nextCitizen = Math.max(this.nextCitizen, c.id + 1);
      }
    }
  }
}

export type PopulationSave = ReturnType<Population['serialize']>;
