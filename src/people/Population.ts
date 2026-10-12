import { DAYS_PER_YEAR } from '../config';
import { BUILDINGS } from '../buildings/BuildingTypes';
import type { Building, Buildings } from '../buildings/Buildings';
import type { Walker } from './Walkers';
import { clanName, firstName } from './names';

export type Sex = 'm' | 'f';
export type Role = 'parent' | 'child' | 'elder';
export type DeathCause = 'old age' | 'starvation' | 'thirst' | 'lightning';

export interface Citizen {
  id: number;
  name: string;
  sex: Sex;
  /** Age in years (fractional — one day is one month). */
  age: number;
  family: number;
  role: Role;
  /** Workplace / school building id, or -1. */
  job: number;
  school: number;
  /** School progress 0..1 — educated adults earn more. */
  edu: number;
  /** 100 = full, 0 = starving. */
  hunger: number;
  /** 100 = healthy, 0 = dead. */
  health: number;
  state: 'home' | 'away' | 'travel';
  /** Building the person is in (when not travelling). */
  at: number;
  leaveAt: number;
  returnAt: number;
  errand: boolean;
  drove: boolean;
  variant: number;
  /** What they're doing right now (English key, translated in the UI). */
  activity: string;
  walker?: Walker;
}

export interface FamilyCar {
  color: string;
  at: 'home' | 'away' | 'moving';
  lot?: number;
  slot?: number;
}

export interface Family {
  id: number;
  surname: string;
  home: number;
  money: number;
  income: number;
  car: FamilyCar | null;
  members: number[];
  debtDays: number;
}

export interface DayReport {
  incomeTax: number;
  publicWages: number;
  foodEaten: number;
  foodSales: number;
  propertyTax: number;
  births: number;
  deaths: { name: string; cause: DeathCause }[];
  weddings: [string, string][];
  leftTown: number;
  carsBought: number;
}

export const CAR_COLORS = ['#d9443b', '#3a6fd1', '#f2f2ee', '#f1c232', '#4c9a52', '#8a8f98', '#2d3138', '#e07b2e', '#6fc3d8'];

const CAR_PRICE = 700;
const CAR_UPKEEP = 2;
const INCOME_TAX = 0.25;
const PROPERTY_TAX = 4;
const FOOD_PRICE = 1;
const RETIRE_AGE = 65;
const ADULT_AGE = 18;
const PER_YEAR = 1 / DAYS_PER_YEAR;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

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

  createFamily(home: number, opts: { size?: number; carChance?: number; money?: number } = {}): Family {
    const size = opts.size ?? 2 + Math.floor(Math.random() * 4);
    const f: Family = {
      id: this.nextFamily++, surname: clanName(), home, money: opts.money ?? Math.round(rand(200, 1200)),
      income: 0, car: Math.random() < (opts.carChance ?? 0.4) ? { color: pick(CAR_COLORS), at: 'home' } : null,
      members: [], debtDays: 0,
    };
    this.families.set(f.id, f);
    const dadAge = Math.round(size >= 6 ? rand(38, 56) : rand(24, 45));
    this.addCitizen(f, 'm', dadAge, 'parent');
    if (size >= 2) this.addCitizen(f, 'f', Math.max(20, dadAge - Math.round(rand(0, 5))), 'parent');
    let left = size - 2;
    const elders = left > 1 && Math.random() < 0.45 ? (Math.random() < 0.4 ? 2 : 1) : 0;
    for (let i = 0; i < elders && left > 0; i++, left--) this.addCitizen(f, i === 0 ? 'f' : 'm', Math.round(rand(63, 78)), 'elder');
    for (let i = 0; i < left; i++) {
      const maxAge = Math.min(30, dadAge - 19);
      this.addCitizen(f, Math.random() < 0.5 ? 'm' : 'f', Math.max(0, Math.round(rand(0, maxAge))), 'child');
    }
    return f;
  }

  addCitizen(f: Family, sex: Sex, age: number, role: Role): Citizen {
    const c: Citizen = {
      id: this.nextCitizen++, name: firstName(sex), sex, age: age + Math.random() * 0.9, family: f.id, role,
      job: -1, school: -1, edu: age >= ADULT_AGE ? (Math.random() < 0.5 ? 1 : 0) : 0,
      hunger: 85 + Math.random() * 15, health: 90 + Math.random() * 10,
      state: 'home', at: f.home, leaveAt: 2, returnAt: 2, errand: false, drove: false,
      variant: (sex === 'm' ? 0 : 4) + Math.floor(Math.random() * 4), activity: 'At home',
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

  /** Plan everyone's day as fractions of the day (one second = one hour at 1x). */
  planDay() {
    for (const c of this.citizens.values()) {
      c.errand = false;
      if (c.job >= 0) {
        c.leaveAt = rand(0.24, 0.33);
        c.returnAt = rand(0.7, 0.78);
      } else if (c.school >= 0) {
        c.leaveAt = rand(0.28, 0.32);
        c.returnAt = rand(0.6, 0.65);
      } else if (c.age >= 3 && c.role !== 'child' && Math.random() < 0.45) {
        c.errand = true;
        c.leaveAt = rand(0.36, 0.55);
        c.returnAt = c.leaveAt + rand(0.08, 0.15);
      } else {
        c.leaveAt = 2;
        c.returnAt = 2;
      }
    }
  }

  wage(c: Citizen, b: Building | undefined) {
    if (!b) return 0;
    const d = BUILDINGS[b.kind];
    const power = d.energy > 0 && !b.powered ? 0.5 : 1;
    return d.salary * (1 + 0.5 * c.edu) * power;
  }

  /** Hunger drops through the day; it's restored at the evening meal. */
  tickNeeds(dayFraction: number) {
    for (const c of this.citizens.values()) c.hunger = Math.max(0, c.hunger - dayFraction * 55);
  }

  /** End-of-day settlement: wages, meals, health, ageing, births, deaths, weddings, moving out. */
  daily(buildings: Buildings, food: number, water: number, freeHomes: () => Building[], hasHall: boolean): DayReport {
    const r: DayReport = { incomeTax: 0, publicWages: 0, foodEaten: 0, foodSales: 0, propertyTax: 0, births: 0, deaths: [], weddings: [], leftTown: 0, carsBought: 0 };
    let foodLeft = food;
    const die = (c: Citizen, cause: DeathCause) => {
      const f = this.families.get(c.family);
      r.deaths.push({ name: `${c.name} ${f?.surname ?? ''}`.trim(), cause });
      this.removeCitizen(c);
    };

    for (const f of [...this.families.values()]) {
      const people = this.members(f);
      let earned = 0;
      for (const c of people) {
        if (c.job < 0) continue;
        const b = buildings.get(c.job);
        const gross = this.wage(c, b);
        if (b && BUILDINGS[b.kind].publicJob) r.publicWages += gross;
        r.incomeTax += gross * INCOME_TAX;
        earned += gross * (1 - INCOME_TAX);
      }
      // evening meal: everyone who gets food is full again, the family pays for it
      for (const c of people) {
        if (foodLeft >= 1) {
          foodLeft--;
          r.foodEaten++;
          r.foodSales += FOOD_PRICE;
          earned -= FOOD_PRICE;
          c.hunger = 100;
        }
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

    // health, ageing, school progress, deaths
    for (const c of [...this.citizens.values()]) {
      let cause: DeathCause = 'old age';
      if (c.hunger < 25) { c.health -= 30; cause = 'starvation'; }
      if (Math.random() > water) { c.health -= 22; cause = c.hunger < 25 ? cause : 'thirst'; }
      if (c.age > 60) c.health -= (c.age - 60) * 0.35;
      else if (c.hunger >= 25) c.health = Math.min(100, c.health + 12);
      c.age += PER_YEAR;
      if (c.school >= 0) c.edu = Math.min(1, c.edu + 0.1 * PER_YEAR);
      if (c.age >= ADULT_AGE && c.role === 'child' && c.school >= 0) c.school = -1;
      if (c.role === 'parent' && c.age >= 70) c.role = 'elder';
      if (c.health <= 0) die(c, cause);
    }

    // births (couples aged 20–42, about one child every three years)
    for (const f of this.families.values()) {
      const people = this.members(f);
      const dad = people.find((c) => c.role === 'parent' && c.sex === 'm' && c.age < 55);
      const mom = people.find((c) => c.role === 'parent' && c.sex === 'f' && c.age >= 20 && c.age <= 42);
      if (dad && mom && people.length < BUILDINGS.house.housing && mom.hunger > 40 && Math.random() < 0.35 * PER_YEAR) {
        this.addCitizen(f, Math.random() < 0.5 ? 'm' : 'f', 0, 'child');
        r.births++;
      }
    }

    // grown-up children start their own household; with a Wedding Hall they can marry
    for (const f of [...this.families.values()]) {
      const grown = this.members(f).filter((c) => c.role === 'child' && c.age >= 20);
      for (const c of grown) {
        const home = freeHomes()[0];
        if (!home || Math.random() > 0.25) continue;
        const nf: Family = { id: this.nextFamily++, surname: f.surname, home: home.id, money: 150, income: 0, car: null, members: [], debtDays: 0 };
        this.families.set(nf.id, nf);
        f.members = f.members.filter((id) => id !== c.id);
        c.family = nf.id;
        c.role = 'parent';
        nf.members.push(c.id);
        f.money -= 100;
        nf.money += 100;
        if (!hasHall) continue;
        const partner = [...this.citizens.values()].find((p) => p.role === 'child' && p.age >= 20 && p.sex !== c.sex && p.family !== f.id);
        if (partner && Math.random() < 0.7) {
          const pf = this.families.get(partner.family)!;
          pf.members = pf.members.filter((id) => id !== partner.id);
          partner.family = nf.id;
          partner.role = 'parent';
          nf.members.push(partner.id);
          r.weddings.push([c.name, partner.name]);
        }
      }
    }

    // broke families leave; empty families disappear
    for (const f of [...this.families.values()]) {
      if (!f.members.length) { this.families.delete(f.id); continue; }
      if (f.debtDays >= 6) {
        r.leftTown += f.members.length;
        this.removeFamily(f);
      }
    }
    return r;
  }

  counts() {
    const out = { men: 0, women: 0, boys: 0, girls: 0, babies: 0, elders: 0, students: 0, workers: 0, workforce: 0, hungry: 0, sick: 0 };
    for (const c of this.citizens.values()) {
      if (c.age < 3) out.babies++;
      else if (c.age < ADULT_AGE) c.sex === 'm' ? out.boys++ : out.girls++;
      else if (c.age >= RETIRE_AGE) out.elders++;
      else c.sex === 'm' ? out.men++ : out.women++;
      if (c.school >= 0) out.students++;
      if (c.job >= 0) out.workers++;
      if (this.canWork(c)) out.workforce++;
      if (c.hunger < 25) out.hungry++;
      if (c.health < 50) out.sick++;
    }
    return out;
  }

  serialize() {
    return [...this.families.values()].map((f) => ({
      id: f.id, surname: f.surname, home: f.home, money: Math.round(f.money), income: f.income,
      car: f.car ? { color: f.car.color } : null, debtDays: f.debtDays,
      members: this.members(f).map((c) => ({
        id: c.id, name: c.name, sex: c.sex, age: Math.round(c.age * 100) / 100, role: c.role, job: c.job, school: c.school,
        edu: c.edu, variant: c.variant, hunger: Math.round(c.hunger), health: Math.round(c.health),
      })),
    }));
  }

  deserialize(data: ReturnType<Population['serialize']>) {
    this.citizens.clear();
    this.families.clear();
    for (const fd of data) {
      const f: Family = { id: fd.id, surname: fd.surname, home: fd.home, money: fd.money, income: fd.income, car: fd.car ? { color: fd.car.color, at: 'home' } : null, members: [], debtDays: fd.debtDays };
      this.families.set(f.id, f);
      this.nextFamily = Math.max(this.nextFamily, f.id + 1);
      for (const m of fd.members) {
        const c: Citizen = { ...m, family: f.id, state: 'home', at: f.home, leaveAt: 2, returnAt: 2, errand: false, drove: false, activity: 'At home' };
        this.citizens.set(c.id, c);
        f.members.push(c.id);
        this.nextCitizen = Math.max(this.nextCitizen, c.id + 1);
      }
    }
  }
}

export type PopulationSave = ReturnType<Population['serialize']>;
