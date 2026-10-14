import { DAYS_PER_YEAR } from '../config';
import { BUILDINGS, JOB_PRIORITY, RENT, DEGREE_JOBS } from '../buildings/BuildingTypes';
import type { Building, Buildings } from '../buildings/Buildings';
import type { Walker } from './Walkers';
import { clanName, firstName } from './names';

export type Sex = 'm' | 'f';
export type Role = 'parent' | 'child' | 'elder';
export type DeathCause = 'old age' | 'starvation' | 'thirst' | 'lightning' | 'accident' | 'murder' | 'illness' | 'cold';

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
  /** 0 = unskilled, 1 = learnt a trade, 2 = university degree. */
  skill: 0 | 1 | 2;
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
  /** Leisure trip planned for today (playground, cinema, stadium, festival square). */
  outing?: number;
  /** Wage for today already paid at the end of the shift. */
  paid?: boolean;
  /** 100 = rested, 0 = exhausted. Work and walking tire, home, benches and meals restore it. */
  energy?: number;
  /** Days left of the flu. */
  flu?: number;
  /** Trains at the gym: falls ill less often until this day. */
  fit?: number;
  /** Works the night shift (better pay). */
  night?: boolean;
  /** Life story: day, age, English text key and its parameters. */
  story?: StoryEntry[];
}

export interface StoryEntry { d: number; a: number; k: string; p?: Record<string, string | number> }

/** Workplaces that keep running at night: a third of the staff works the night shift. */
export const NIGHT_SHIFT: Partial<Record<string, boolean>> = { factory: true, carfactory: true, hospital: true, police: true, firestation: true, powerplant: true, coalplant: true, hydro: true, hotel: true, busdepot: true, trainstation: true, military: true, airport: true, watertower: true, sewage: true, gasstation: true };
/** Night shift pays this much more. */
export const NIGHT_BONUS = 1.5;
const MAX_STORY = 40;

export interface FamilyCar {
  color: string;
  at: 'home' | 'away' | 'moving';
  /** Fuel in the tank, 0..100. */
  fuel: number;
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
  /** Owed to the bank (taken to build a house or a business). */
  loan?: number;
  /** Food kept at home (bought in the shops, eaten at meals). */
  pantry?: number;
}

export interface DeathReport {
  name: string;
  surname: string;
  cause: DeathCause;
  familyId: number;
  age: number;
}

export interface Incident { kind: 'fight' | 'accident' | 'murder'; a: string; b?: string }

export interface DailyOptions {
  /** Extra daily health recovery from hospitals and parks. */
  heal: number;
  /** Working shops in the city (staffed). */
  shops: Record<'market' | 'grocery' | 'clothes', boolean>;
  /** Cars in stock at the city's car markets. */
  carStock: number;
  /** 0..1 — how much policing reduces fights and murders. */
  safety: number;
  /** Income tax rate. */
  taxRate: number;
  /** Calm mode: no crime and no accidents. */
  calm?: boolean;
  /** Water supply of one home (0..1), if known per home. */
  waterAt?: (homeId: number) => number;
  /** Food price compared to normal. */
  foodPrice?: number;
  /** Academies speed up learning (0 = normal, 0.3 = 30% faster). */
  eduBoost?: number;
}

export interface DayReport {
  /** Rent collected per apartment block id. */
  rent: Map<number, number>;
  utilities: number;
  shopping: number;
  /** Money spent in each kind of shop. */
  spent: Record<'market' | 'grocery' | 'clothes', number>;
  carSales: number;
  incidents: Incident[];
  incomeTax: number;
  publicWages: number;
  foodEaten: number;
  foodSales: number;
  propertyTax: number;
  births: number;
  deaths: DeathReport[];
  weddings: [string, string][];
  leftTown: number;
  carsBought: number;
}


export const CAR_COLORS = ['#d9443b', '#3a6fd1', '#f2f2ee', '#f1c232', '#4c9a52', '#8a8f98', '#2d3138', '#e07b2e', '#6fc3d8'];

const CAR_PRICE = 700;
const CAR_UPKEEP = 2;
const PROPERTY_TAX = 4;
const FOOD_PRICE = 1;
const RETIRE_AGE = 65;
const ADULT_AGE = 18;
const UNI_END = 22;
const UTILITY_PER_PERSON = 1.5;
const SHOP_PER_PERSON = { market: 0.6, grocery: 0.5, clothes: 0.4 } as const;
const PER_YEAR = 1 / DAYS_PER_YEAR;

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Population {
  readonly citizens = new Map<number, Citizen>();
  readonly families = new Map<number, Family>();
  private nextCitizen = 1;
  /** Job priority of a workplace: lower is filled first (the game can override it per city). */
  priority: (b: Building) => number = (b) => JOB_PRIORITY[b.kind] ?? 5;
  /** Wage factor the town hall pays for a kind of job (set by the game). */
  wageFactor: (b: Building) => number = () => 1;
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
    return c.age >= ADULT_AGE && c.age < RETIRE_AGE && !this.onLeave(c) && !(c.school >= 0 && c.age < UNI_END);
  }

  createFamily(home: number, opts: { size?: number; carChance?: number; money?: number } = {}): Family {
    const size = opts.size ?? 2 + Math.floor(Math.random() * 4);
    const f: Family = {
      id: this.nextFamily++, surname: clanName(), home, money: opts.money ?? Math.round(rand(200, 1200)),
      income: 0, car: Math.random() < (opts.carChance ?? 0.4) ? { color: pick(CAR_COLORS), at: 'home', fuel: 50 + Math.random() * 50 } : null,
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
    for (const c of this.members(f)) {
      this.note(c, 'Born', undefined, this.day - Math.floor(c.age * DAYS_PER_YEAR));
      this.note(c, 'Moved to the city with the {family} family', { family: f.surname });
    }
    return f;
  }

  addCitizen(f: Family, sex: Sex, age: number, role: Role): Citizen {
    const c: Citizen = {
      id: this.nextCitizen++, name: firstName(sex), sex, age: age + Math.random() * 0.9, family: f.id, role,
      job: -1, school: -1, edu: age >= ADULT_AGE ? (Math.random() < 0.5 ? 1 : 0) : 0,
      skill: age >= 20 ? (Math.random() < 0.25 ? 2 : 1) : 0,
      hunger: 85 + Math.random() * 15, health: 90 + Math.random() * 10,
      state: 'home', at: f.home, leaveAt: 2, returnAt: 2, errand: false, drove: false,
      variant: (sex === 'm' ? 0 : 4) + Math.floor(Math.random() * 4), activity: 'At home',
    };
    this.citizens.set(c.id, c);
    f.members.push(c.id);
    return c;
  }

  /** Today's day number (set by the game) — used to date life stories. */
  day = 1;

  /** Add a line to someone's life story. */
  note(c: Citizen, k: string, p?: StoryEntry['p'], d = this.day) {
    const st = (c.story ??= []);
    st.push({ d, a: Math.floor(c.age), k, p });
    if (st.length > MAX_STORY) st.splice(1, 1); // keep the birth, drop the oldest after it
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

  /** (Re)assign jobs and school / university places. Nearest free one in the same city wins. */
  assign(buildings: Buildings) {
    const free = new Map<number, number>();
    const seats = new Map<number, number>();
    for (const b of buildings.list) {
      if (b.built < 1) continue;
      const d = BUILDINGS[b.kind];
      if (d.jobs) free.set(b.id, d.jobs);
      if (d.students) seats.set(b.id, d.students);
    }
    const homeOf = (c: Citizen) => buildings.get(this.families.get(c.family)?.home ?? -1);
    const before = new Map<number, [number, number]>();
    for (const c of this.citizens.values()) before.set(c.id, [c.job, c.school]);
    const pupil = (c: Citizen) => c.age >= 6 && c.age < ADULT_AGE;
    const toddler = (c: Citizen) => c.age >= 3 && c.age < 6;
    const student = (c: Citizen) => c.age >= ADULT_AGE && c.age < UNI_END && c.edu >= 0.9 && c.skill < 2;
    for (const c of this.citizens.values()) {
      const hb = homeOf(c);
      if (c.job >= 0 && hb && buildings.get(c.job)?.city !== hb.city) c.job = -1;
      if (c.school >= 0 && hb && buildings.get(c.school)?.city !== hb.city) c.school = -1;
      if (c.school >= 0) {
        const kind = buildings.get(c.school)?.kind;
        const ok = seats.has(c.school) && seats.get(c.school)! > 0 && ((kind === 'school' && pupil(c)) || (kind === 'kindergarten' && toddler(c)) || (kind === 'university' && student(c)));
        if (!ok) c.school = -1;
        else seats.set(c.school, seats.get(c.school)! - 1);
      }
      if (c.job >= 0 && (!free.has(c.job) || !this.canWork(c) || free.get(c.job)! <= 0)) c.job = -1;
      if (c.job >= 0) free.set(c.job, free.get(c.job)! - 1);
    }
    const nearest = (pool: Map<number, number>, from: Building | undefined, kind?: string, who?: Citizen) => {
      let best = -1, bd = Infinity;
      for (const [id, n] of pool) {
        if (n <= 0) continue;
        const b = buildings.get(id)!;
        if (kind && b.kind !== kind) continue;
        if (from && b.city !== from.city) continue;
        // jobs: the most needed first; among equal ones the emptier workplace wins, so newcomers spread out evenly
        const fill = kind ? 0 : (1 - n / Math.max(1, BUILDINGS[b.kind].jobs)) * 80;
        const pay = kind ? 0 : -BUILDINGS[b.kind].salary * this.wageFactor(b) * 1.5;
        const diploma = kind || !who ? 0 : DEGREE_JOBS[b.kind] ? (who.skill >= 1 ? -25 : 120) : who.skill >= 1 ? 10 : 0;
        const d = (from ? Math.abs(b.x - from.x) + Math.abs(b.z - from.z) : 0) + (kind ? 0 : this.priority(b) * 200 + fill + pay + diploma);
        if (d < bd) { bd = d; best = id; }
      }
      return best;
    };
    for (const c of this.citizens.values()) {
      if (c.school < 0 && (pupil(c) || toddler(c) || student(c))) {
        const id = nearest(seats, homeOf(c), toddler(c) ? 'kindergarten' : pupil(c) ? 'school' : 'university');
        if (id >= 0) { c.school = id; seats.set(id, seats.get(id)! - 1); }
      }
      if (c.job < 0 && this.canWork(c)) {
        const id = nearest(free, homeOf(c), undefined, c);
        if (id >= 0) { c.job = id; free.set(id, free.get(id)! - 1); }
      }
    }
    // essential jobs (water, food, energy, materials) never stay empty while people sit in ordinary jobs
    const prio = (id: number) => { const b = buildings.get(id); return b ? this.priority(b) : 9; };
    for (const [id, n] of free) {
      if (n <= 0 || prio(id) > 2) continue;
      const target = buildings.get(id)!;
      let left = n;
      const movers = [...this.citizens.values()]
        .filter((c) => c.job >= 0 && prio(c.job) >= 4 && homeOf(c)?.city === target.city)
        .sort((a, b) => {
          const ha = homeOf(a), hb = homeOf(b);
          return (ha ? Math.abs(ha.x - target.x) + Math.abs(ha.z - target.z) : 0) - (hb ? Math.abs(hb.x - target.x) + Math.abs(hb.z - target.z) : 0);
        });
      for (const c of movers) {
        if (left <= 0) break;
        free.set(c.job, (free.get(c.job) ?? 0) + 1);
        c.job = id;
        left--;
      }
      free.set(id, left);
    }
    for (const b of buildings.list) b.workers = 0;
    for (const c of this.citizens.values()) {
      const b = c.job >= 0 ? buildings.get(c.job) : undefined;
      if (b) b.workers++;
      // life story: new job, lost job, new school
      const [job, school] = before.get(c.id) ?? [-1, -1];
      if (c.job !== job) {
        if (b) this.note(c, 'Started working at the {place}', { place: BUILDINGS[b.kind].name });
        else if (job >= 0) this.note(c, 'Lost their job');
      }
      if (c.school !== school && c.school >= 0) {
        const k = buildings.get(c.school)?.kind;
        this.note(c, k === 'kindergarten' ? 'Started kindergarten' : k === 'university' ? 'Entered university' : 'Started school');
      }
    }
  }

  /** Plan everyone's day as fractions of the day (one second = one hour at 1x). */
  /** Kind of a workplace (set by the game). */
  jobKind?: (id: number) => string | undefined;

  /** Plan the day of everyone, or only of `only` (e.g. a family that just moved in). */
  planDay(only?: Citizen[]) {
    // every third worker of a round-the-clock workplace takes the night shift
    const nightIds = new Set<number>();
    const staff = new Map<number, Citizen[]>();
    for (const c of this.citizens.values()) {
      if (c.job < 0 || !NIGHT_SHIFT[this.jobKind?.(c.job) ?? '']) continue;
      const l = staff.get(c.job) ?? [];
      l.push(c);
      staff.set(c.job, l);
    }
    for (const l of staff.values()) l.sort((a, b) => a.id - b.id).forEach((c, i) => { if (i % 3 === 2) nightIds.add(c.id); });
    for (const c of only ?? this.citizens.values()) {
      c.errand = false;
      const was = !!c.night;
      c.night = nightIds.has(c.id);
      if (c.night && !was) this.note(c, 'Moved to the night shift (+50% pay)');
      if (c.night) {
        // the night shift starts in the evening and ends the next morning
        // the night shift comes before the day shift leaves and goes home after the next day shift arrives
        c.leaveAt = rand(0.68, 0.71);
        c.returnAt = rand(0.33, 0.36);
      } else if (c.job >= 0) {
        c.leaveAt = rand(0.24, 0.3);
        c.returnAt = rand(0.73, 0.78);
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
    const skill = c.skill === 2 ? 0.4 : c.skill === 1 ? 0.15 : 0;
    return d.salary * this.wageFactor(b) * (1 + 0.5 * c.edu + skill) * power * (c.night ? NIGHT_BONUS : 1);
  }

  /** Hunger drops through the day; it's restored at the evening meal. */
  tickNeeds(dayFraction: number) {
    for (const c of this.citizens.values()) {
      c.hunger = Math.max(0, c.hunger - dayFraction * 55);
      // energy: work and walking tire, sleep at home and a rest on a bench restore it
      const e = c.energy ?? 80;
      let d = 0;
      if (c.state === 'home') d = c.activity.startsWith('Sleeping') ? 150 : 70;
      else if (c.activity.endsWith('on a bench') || c.activity === 'Feeding the pigeons' || c.activity === 'Watching a film') d = 110;
      else if (c.state === 'away' && c.job >= 0 && c.at === c.job) d = -95;
      else if (c.state === 'travel') d = -45;
      else d = -25;
      if (c.age < 13 && d < 0) d *= 0.7;
      c.energy = Math.max(0, Math.min(100, e + d * dayFraction));
    }
  }

  /** End-of-day settlement: wages, meals, health, ageing, births, deaths, weddings, moving out. */
  daily(buildings: Buildings, belongs: (f: Family) => boolean, food: number, water: number, freeHomes: () => Building[], hasHall: boolean, opts: DailyOptions = { heal: 0, shops: { market: false, grocery: false, clothes: false }, carStock: 0, safety: 0, taxRate: 0.25 }): DayReport {
    const r: DayReport = { rent: new Map(), spent: { market: 0, grocery: 0, clothes: 0 }, utilities: 0, shopping: 0, carSales: 0, incidents: [], incomeTax: 0, publicWages: 0, foodEaten: 0, foodSales: 0, propertyTax: 0, births: 0, deaths: [], weddings: [], leftTown: 0, carsBought: 0 };
    let foodLeft = food;
    const die = (c: Citizen, cause: DeathCause) => {
      const f = this.families.get(c.family);
      r.deaths.push({ name: c.name, surname: f?.surname ?? '', cause, familyId: c.family, age: Math.floor(c.age) });
      this.removeCitizen(c);
    };

    for (const f of [...this.families.values()]) {
      if (!belongs(f)) continue;
      const people = this.members(f);
      let earned = 0;
      for (const c of people) {
        // whoever finished a shift today was paid on the spot; the rest get paid now
        if (c.paid) { c.paid = false; continue; }
        if (c.job < 0) continue;
        const b = buildings.get(c.job);
        const gross = this.wage(c, b);
        if (b && BUILDINGS[b.kind].publicJob) r.publicWages += gross;
        r.incomeTax += gross * opts.taxRate;
        earned += gross * (1 - opts.taxRate);
      }
      // evening meal: everyone who gets food is full again, the family pays for it
      for (const c of people) {
        if (foodLeft >= 1) {
          foodLeft--;
          r.foodEaten++;
          r.foodSales += FOOD_PRICE * (opts.foodPrice ?? 1);
          earned -= FOOD_PRICE * (opts.foodPrice ?? 1);
          c.hunger = 100;
          c.energy = Math.min(100, (c.energy ?? 80) + 10);
        }
      }
      const propTax = PROPERTY_TAX * (buildings.get(f.home)?.level ?? 1);
      earned -= propTax;
      r.propertyTax += propTax;
      // utilities (power, water) and, where there is a market, everyday shopping
      const bills = people.length * UTILITY_PER_PERSON;
      earned -= bills;
      r.utilities += bills;
      for (const kind of ['grocery', 'clothes', 'market'] as const) {
        if (!opts.shops[kind]) continue;
        const spend = Math.min(Math.max(0, f.money + earned), people.length * SHOP_PER_PERSON[kind]);
        earned -= spend;
        r.shopping += spend;
        r.spent[kind] += spend;
      }
      const flat = buildings.get(f.home);
      if (flat && BUILDINGS[flat.kind].units > 1) {
        earned -= RENT;
        r.rent.set(flat.id, (r.rent.get(flat.id) ?? 0) + RENT);
      }
      if (f.car) earned -= CAR_UPKEEP;
      f.money += earned;
      f.income = Math.round(earned);
      f.debtDays = f.money < 0 ? f.debtDays + 1 : 0;
      if (!f.car && opts.carStock > 0 && f.money > CAR_PRICE + 500) {
        opts.carStock--;
        f.money -= CAR_PRICE;
        f.car = { color: pick(CAR_COLORS), at: 'home', fuel: 100 };
        r.carsBought++;
        for (const m of people) if (m.age >= 18) this.note(m, 'The family bought a car');
        r.carSales += CAR_PRICE;
      }
    }

    // health, ageing, school progress, deaths
    for (const c of [...this.citizens.values()]) {
      const cf = this.families.get(c.family);
      if (!cf || !belongs(cf)) continue;
      let cause: DeathCause = 'old age';
      if (c.hunger < 25) { c.health -= 30; cause = 'starvation'; }
      if (Math.random() > (opts.waterAt ? opts.waterAt(cf.home) : water)) { c.health -= 22; cause = c.hunger < 25 ? cause : 'thirst'; }
      if (c.age > 60) c.health -= Math.max(0, (c.age - 60) * 0.35 - opts.heal * 0.04);
      else if (c.hunger >= 25) c.health = Math.min(100, c.health + 12 + opts.heal);
      c.age += PER_YEAR;
      if (c.school >= 0) c.edu = Math.min(1, c.edu + 0.1 * PER_YEAR * (1 + (opts.eduBoost ?? 0)));
      const sb = c.school >= 0 ? buildings.get(c.school) : undefined;
      if (c.age >= ADULT_AGE && sb?.kind === 'school') { c.school = -1; this.note(c, 'Finished school'); }
      if (sb?.kind === 'university' && c.age >= UNI_END) { c.skill = 2; c.school = -1; this.note(c, 'Graduated from university with a degree'); }
      if (c.age >= RETIRE_AGE && c.age - PER_YEAR < RETIRE_AGE) this.note(c, 'Retired');
      if (c.age >= 20 && c.skill === 0 && c.school < 0) c.skill = 1;
      if (c.role === 'parent' && c.age >= 70) c.role = 'elder';
      // life is fragile: elderly people pass away, anyone can fall seriously ill (less so with doctors around)
      if (c.health > 0 && !opts.calm) {
        const care = 1 - Math.min(0.6, opts.heal / 50);
        const old = c.age < 55 ? 0 : c.age < 65 ? 0.004 : c.age < 75 ? 0.012 : c.age < 85 ? 0.03 : 0.07;
        if (Math.random() < old * care) { c.health = 0; cause = 'old age'; }
        else if (Math.random() < 0.006 * care) {
          // a sudden illness: often survived (an ambulance comes), sometimes not
          c.health = Math.max(0, c.health - rand(40, 95));
          if (c.health <= 0) cause = 'illness';
          else this.note(c, 'Fell seriously ill');
        }
      }
      if (c.health <= 0) die(c, cause);
    }

    // everyday trouble: fights, car accidents and, rarely, a murder
    const adults = [...this.citizens.values()].filter((c) => {
      const cf = this.families.get(c.family);
      return !!cf && belongs(cf) && c.age >= 16;
    });
    if (adults.length >= 8 && !opts.calm) {
      const n = adults.length;
      const cars = [...this.families.values()].filter((f) => belongs(f) && f.car).length;
      const two = (): [Citizen, Citizen] | null => {
        const a = pick(adults);
        let b = pick(adults);
        for (let i = 0; i < 8 && (b === a || b.family === a.family); i++) b = pick(adults);
        return b === a ? null : [a, b];
      };
      const calm = 1 - opts.safety;
      if (Math.random() < Math.min(0.3, n * 0.0012) * calm) {
        const pair = two();
        if (pair && this.citizens.has(pair[0].id) && this.citizens.has(pair[1].id)) {
          for (const c of pair) c.health = Math.max(5, c.health - rand(10, 25));
          r.incidents.push({ kind: 'fight', a: pair[0].name, b: pair[1].name });
        }
      }
      if (Math.random() < Math.min(0.25, 0.02 + cars * 0.0015)) {
        const v = pick(adults);
        if (this.citizens.has(v.id)) {
          v.health -= rand(25, 55);
          r.incidents.push({ kind: 'accident', a: v.name });
          // some crashes are fatal
          if (v.health <= 0 || Math.random() < 0.12) die(v, 'accident');
        }
      }
      if (Math.random() < Math.min(0.05, n * 0.0002) * calm) {
        const pair = two();
        if (pair && this.citizens.has(pair[0].id) && this.citizens.has(pair[1].id)) {
          r.incidents.push({ kind: 'murder', a: pair[0].name, b: pair[1].name });
          die(pair[0], 'murder');
          this.removeCitizen(pair[1]);
        }
      }
    }

    // births (couples aged 20–42, about one child every three years)
    for (const f of this.families.values()) {
      if (!belongs(f)) continue;
      const people = this.members(f);
      const dad = people.find((c) => c.role === 'parent' && c.sex === 'm' && c.age < 55);
      const mom = people.find((c) => c.role === 'parent' && c.sex === 'f' && c.age >= 20 && c.age <= 42);
      if (dad && mom && people.length < BUILDINGS.house.housing && mom.hunger > 40 && Math.random() < 0.35 * PER_YEAR) {
        const baby = this.addCitizen(f, Math.random() < 0.5 ? 'm' : 'f', 0, 'child');
        r.births++;
        this.note(baby, 'Born into the {family} family', { family: f.surname });
        for (const p of [dad, mom]) this.note(p, p.sex === 'm' ? 'Became a father: {name} was born' : 'Became a mother: {name} was born', { name: baby.name });
      }
    }

    // grown-up children start their own household; with a Wedding Hall they can marry
    for (const f of [...this.families.values()]) {
      if (!belongs(f)) continue;
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
        this.note(c, 'Moved into a home of their own');
        if (!hasHall) continue;
        const partner = [...this.citizens.values()].find((p) => p.role === 'child' && p.age >= 20 && p.sex !== c.sex && p.family !== f.id && belongs(this.families.get(p.family) ?? f));
        if (partner && Math.random() < 0.7) {
          const pf = this.families.get(partner.family)!;
          pf.members = pf.members.filter((id) => id !== partner.id);
          partner.family = nf.id;
          partner.role = 'parent';
          nf.members.push(partner.id);
          r.weddings.push([c.name, partner.name]);
          this.note(c, 'Married {name} at the Wedding Hall', { name: `${partner.name} ${this.families.get(pf.id)?.surname ?? ''}`.trim() });
          this.note(partner, 'Married {name} at the Wedding Hall', { name: `${c.name} ${f.surname}` });
        }
      }
    }

    // broke families leave; empty families disappear
    for (const f of [...this.families.values()]) {
      if (!f.members.length) { this.families.delete(f.id); continue; }
      if (!belongs(f)) continue;
      if (f.debtDays >= 6) {
        r.leftTown += f.members.length;
        this.removeFamily(f);
      }
    }
    return r;
  }

  counts(filter?: (c: Citizen) => boolean) {
    const out = { men: 0, women: 0, boys: 0, girls: 0, babies: 0, elders: 0, students: 0, workers: 0, workforce: 0, hungry: 0, sick: 0 };
    for (const c of this.citizens.values()) {
      if (filter && !filter(c)) continue;
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
      car: f.car ? { color: f.car.color, fuel: Math.round(f.car.fuel) } : null, debtDays: f.debtDays, loan: f.loan ? Math.round(f.loan) : undefined, pantry: f.pantry === undefined ? undefined : Math.round(f.pantry * 10) / 10,
      members: this.members(f).map((c) => ({
        id: c.id, name: c.name, sex: c.sex, age: Math.round(c.age * 100) / 100, role: c.role, job: c.job, school: c.school,
        edu: c.edu, skill: c.skill, variant: c.variant, hunger: Math.round(c.hunger), health: Math.round(c.health),
        story: c.story, night: c.night, energy: c.energy === undefined ? undefined : Math.round(c.energy),
      })),
    }));
  }

  deserialize(data: ReturnType<Population['serialize']>) {
    this.citizens.clear();
    this.families.clear();
    for (const fd of data) {
      const f: Family = { id: fd.id, surname: fd.surname, home: fd.home, money: fd.money, income: fd.income, car: fd.car ? { color: fd.car.color, at: 'home', fuel: fd.car.fuel ?? 80 } : null, members: [], debtDays: fd.debtDays, loan: fd.loan, pantry: fd.pantry };
      this.families.set(f.id, f);
      this.nextFamily = Math.max(this.nextFamily, f.id + 1);
      for (const m of fd.members) {
        const c: Citizen = { ...m, skill: m.skill ?? (m.age >= 20 ? 1 : 0), family: f.id, state: 'home', at: f.home, leaveAt: 2, returnAt: 2, errand: false, drove: false, activity: 'At home' };
        this.citizens.set(c.id, c);
        f.members.push(c.id);
        this.nextCitizen = Math.max(this.nextCitizen, c.id + 1);
      }
    }
  }
}

export type PopulationSave = ReturnType<Population['serialize']>;
