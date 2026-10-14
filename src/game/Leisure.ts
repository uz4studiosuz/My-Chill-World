import * as THREE from 'three';
import { DAY_SECONDS } from '../config';
import { N, idx, inBounds } from '../world/grid';
import type { Building, Point } from '../buildings/Buildings';
import { BUILDINGS, CINEMA, SERVICE_FEE, DECOR, DECOR_RANGE, FOOTBALL, VISIT_PRICE, FAITH_SHARE } from '../buildings/BuildingTypes';
import type { City } from '../sim/Economy';
import type { Citizen } from '../people/Population';
import type { LifeContext } from './Life';
import type { Walker } from '../people/Walkers';
import { festiveTreeGeometry, navruzGeometry } from '../models/extras';
import { pigeonGeometry } from '../models/chains';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';

/** What Leisure needs from Life. */
export interface LeisureHost {
  events: string[];
  festival: string | null;
  calm: boolean;
  planOuting(c: Citizen, dest: Building, until: number): boolean;
  isLit(k: number): boolean;
  charge(c: Citizen, cityId: number, amount: number): void;
  staffOnDuty(b: Building): Citizen[];
  isShiftOver(c: Citizen): boolean;
  takeDriver(b: Building, activity?: string): Citizen | undefined;
  releaseDriver(c?: Citizen): void;
  fullName(c: Citizen): string;
  sendToPoint(c: Citizen, p: Point, until: number, activity: string, arrived: (c: Citizen) => void): boolean;
  weatherMood: string;
  /** A visitor pays for a service at a business (taxed on the spot). */
  sell(c: Citizen, b: Building, amount: number): void;
}

/** About half of the adults are believers (fixed per person). */
export const believer = (c: Citizen) => ((c.id * 2654435761) >>> 0) / 4294967296 < FAITH_SHARE;
/** Visitors of these places go inside (the walker disappears until they come out). */
const INDOOR = new Set(['casino', 'gym', 'barber']);

export type PetitionKind = 'shop' | 'school' | 'light' | 'park' | 'hospital' | 'busstop' | 'playground';

export interface Petition {
  id: number;
  city: number;
  kind: PetitionKind;
  /** Family that wrote the letter. */
  from: string;
  x: number;
  z: number;
  day: number;
  reward: number;
  state: 'open' | 'done' | 'failed';
}

export interface MatchResult { day: number; home: string; away: string; hs: number; as: number }

export interface LeisureSave { petitions: Petition[]; matches: MatchResult[]; trust: [number, number][] }

/** The letter text for each request (English keys, translated in the UI). */
export const PETITION_TEXT: Record<PetitionKind, string> = {
  shop: 'There is no shop in our neighbourhood — we walk far for bread. Please build a grocery store!',
  school: 'Our children have grown up, but there are not enough school places. Please build a school!',
  light: 'Our street has no lamps and it is dark at night. Please light the street!',
  park: 'There is nowhere green to walk near our homes. Please build a park!',
  hospital: 'When someone falls ill there is nowhere to go. Please build a hospital!',
  busstop: 'We have no car and the bus does not stop near us. Please build a bus stop!',
  playground: 'Our children have nowhere to play. Please build a playground!',
};

/** What people do on a bench. */
const DRILL = 'Drilling on the parade ground';
const BUSK = 'Playing music on the square';
const SKATE = 'Ice skating';
const PLAY_FOOTBALL = 'Playing football';
const BENCH_LIFE = ['Resting on a bench', 'Reading a book on a bench', 'Feeding the pigeons', 'Drinking coffee on a bench'];

const PETITION_REWARD: Record<PetitionKind, number> = { shop: 300, school: 500, light: 150, park: 250, hospital: 600, busstop: 150, playground: 150 };
/** Days a petition stays open before people give up on it. */
const PETITION_DAYS = 8;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const near = (b: Building, x: number, z: number, r: number) => Math.hypot(b.x - x, b.z - z) <= r;
const poisson = (l: number) => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= Math.random(); } while (p > L && k < 9); return k - 1; };

/**
 * Leisure and city life: children on playgrounds, the open-air cinema, football derbies, festival squares,
 * wedding processions, ambulances with stretchers and the residents' letters to the town hall.
 */
export class Leisure {
  readonly group = new THREE.Group();
  petitions: Petition[] = [];
  matches: MatchResult[] = [];
  private nextId = 1;
  private timers: { t: number; fn: () => void }[] = [];
  private tickT = 0;
  private lastMatch = -1;
  private festMeshes = new Map<number, THREE.Mesh>();
  /** Soldiers drilling on each military base's parade ground. */
  private soldiers = new Map<number, { c: Citizen; w: Walker }[]>();
  /** Why a citizen went out (overrides the activity on arrival). */
  private purpose = new Map<number, string>();
  private lunchDay = -1;
  /** Street musician (citizen id) per town hall. */
  private buskers = new Map<number, number>();
  /** Where people can skate (centres of frozen lakes near towns), set by the game. */
  iceSpots: () => Point[] = () => [];
  private pigeons: THREE.InstancedMesh;
  private pigeonSpots: { x: number; z: number; ph: number }[] = [];
  private pigeonT = 0;
  private time = 0;
  private festKind: string | null = null;
  private festMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private treeGeo = festiveTreeGeometry();
  private navruzGeo = navruzGeometry();
  /** Ambulance already on its way for these citizens. */
  private calls = new Set<number>();
  /** Visitors sent today (building id → count). */
  private visits = new Map<number, number>();
  private visitDay = -1;
  /** Happiness from petitions answered or ignored, per city (decays). */
  private trust = new Map<number, number>();
  /** Happiness after a won / lost match (decays). */
  private sport = new Map<number, number>();
  private beauty = new Map<number, number>();
  /** Footballers running on each stadium's pitch during a match. */
  /** The two teams on the pitch: real citizens who came to the stadium first. */
  private players = new Map<number, Citizen[]>();

  constructor(private c: LifeContext, private host: LeisureHost) {
    this.pigeons = new THREE.InstancedMesh(pigeonGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), 160);
    this.pigeons.count = 0;
    this.pigeons.frustumCulled = false;
    this.group.add(this.pigeons);
  }

  /** Run `fn` after `seconds` of game time. */
  later(seconds: number, fn: () => void) { this.timers.push({ t: seconds, fn }); }

  get matchDay() { return this.c.eco.day % 2 === 0; }

  update(dt: number) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    const tod = this.c.eco.timeOfDay;
    const weekend = this.c.eco.day % 7 >= 5;
    this.c.buildings.cinemaOn = tod > 0.79 && tod < 0.97;
    this.c.buildings.matchOn = this.matchDay && tod > 0.55 && tod < 0.76;
    if (this.host.festival !== this.festKind) this.festival(this.host.festival);
    this.footballers();
    this.drill();
    if (this.tickT <= 0.05) { this.busking(tod); this.skating(tod); }
    this.time += dt;
    this.updatePigeons(dt);
    if (dt <= 0) return;
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 1.5;
    if (this.visitDay !== this.c.eco.day) { this.visitDay = this.c.eco.day; this.visits.clear(); }
    this.routines(tod);
    if (tod > 0.63 && tod < 0.76) this.outings(['playground', 'park', 'bigpark'], (c) => c.age >= 3 && c.age < 14, 0.1, 6, Math.min(0.8, tod + 0.09), 10);
    // prayers: noon (crowded on Fridays) and the evening prayer
    const friday = this.c.eco.day % 7 === 4;
    if (tod > 0.5 && tod < 0.54) this.outings(['mosque'], (c) => c.age >= 12 && believer(c), friday ? 0.5 : 0.08, friday ? 60 : 20, tod + 0.05, 20, 'Praying at the mosque');
    if (tod > 0.72 && tod < 0.75) this.outings(['mosque'], (c) => c.age >= 12 && believer(c), 0.07, 20, tod + 0.04, 16, 'Praying at the mosque');
    // evening: the teahouse, the gym, the casino; a haircut in the daytime; rides after school
    if (tod > 0.74 && tod < 0.84) this.outings(['teahouse'], (c) => c.age >= 16, 0.04, 16, Math.min(0.92, tod + 0.08), 18, 'Drinking tea at the choyxona');
    if (tod > 0.74 && tod < 0.82) this.outings(['gym'], (c) => c.age >= 16 && c.age < 62, 0.03, 10, tod + 0.06, 16, 'Working out at the gym');
    if (tod > 0.8 && tod < 0.9) this.outings(['casino'], (c) => c.age >= 21, 0.025, 20, 0.97, 24, 'Playing at the casino');
    if (tod > 0.4 && tod < 0.7) this.outings(['barber'], (c) => c.age >= 5, 0.008, 4, tod + 0.04, 12, 'Getting a haircut');
    if (!weekend && tod > 0.63 && tod < 0.7) this.outings(['themepark'], (c) => c.age >= 5 && c.age < 16, 0.04, 20, Math.min(0.8, tod + 0.1), 24, 'Riding the attractions');
    // tired people sit down on a bench, in a park or by a fountain for a while
    if (tod > 0.4 && tod < 0.74) this.outings(['bench', 'park', 'fountain'], (c) => c.age >= 14 && c.job < 0 && ((c.energy ?? 80) < 45 || Math.random() < 0.2), 0.15, 6, Math.min(0.78, tod + 0.06), 8);
    if (tod > 0.8 && tod < 0.86) this.outings(['cinema'], (c) => c.age >= 14, 0.08, CINEMA.seats, 0.95, 18);
    if (this.matchDay && tod > 0.54 && tod < 0.62) this.outings(['stadium'], (c) => c.age >= 8, 0.1, FOOTBALL.fans, 0.73, 24);
    // a few people stop to listen to the street musician
    if (!this.host.festival && tod > 0.62 && tod < 0.8) this.outings(['townhall'], (c) => c.age >= 8, 0.03, 5, Math.min(0.86, tod + 0.06), 14);
    if (this.host.festival && tod > 0.4 && tod < 0.66) this.outings(['townhall'], (c) => c.age >= 5, 0.05, 30, Math.min(0.78, tod + 0.12), 18);
    if (this.matchDay && tod >= 0.72 && this.lastMatch !== this.c.eco.day) { this.lastMatch = this.c.eco.day; this.playMatches(); }
  }

  /** Send people who are at home to a leisure place nearby. */
  /** Everyday rhythm: elders, evening visits, weekends, heatwaves and lunch at the coffee cart. */
  private routines(tod: number) {
    const { pop, buildings, eco } = this.c;
    const weekend = eco.day % 7 >= 5;
    const hasToddler = (c: Citizen) => { const f = pop.families.get(c.family); return !!f && pop.members(f).some((m) => m.age >= 3 && m.age < 6 && m.school >= 0); };
    if (tod > 0.4 && tod < 0.6) this.outings(['park', 'bigpark', 'teahouse'], (c) => c.age >= 65, 0.06, 6, Math.min(0.7, tod + 0.1), 12, 'Playing chess in the park');
    if (tod > 0.58 && tod < 0.62) this.outings(['kindergarten'], (c) => c.age >= 58 && hasToddler(c), 0.3, 6, tod + 0.05, 15, 'Picking up the grandchildren');
    if (weekend && tod > 0.42 && tod < 0.6) this.outings(['park', 'bigpark', 'themepark', 'market', 'supermarket', 'fountain', 'kiosk'], (c) => c.age >= 3, 0.04, 12, Math.min(0.72, tod + 0.12), 14, 'Weekend family walk');
    if (this.host.weatherMood === 'heat' && tod > 0.45 && tod < 0.7) this.outings(['fountain', 'park', 'bigpark', 'kiosk'], (c) => c.age >= 3, 0.06, 10, Math.min(0.75, tod + 0.08), 12, 'Cooling off by the fountain');
    // evening: friends and neighbours visit each other
    if (tod > 0.76 && tod < 0.84) {
      for (const c of pop.citizens.values()) {
        if (c.state !== 'home' || c.outing !== undefined || c.age < 16 || Math.random() > 0.015) continue;
        const f = pop.families.get(c.family);
        const home = f && buildings.get(f.home);
        if (!home) continue;
        const friends = buildings.list.filter((h) => BUILDINGS[h.kind].units && h.id !== home.id && h.city === home.city && Math.hypot(h.x - home.x, h.z - home.z) < 12 && pop.familyAt(h.id));
        if (!friends.length) continue;
        const to = pick(friends);
        if (this.host.planOuting(c, to, Math.min(0.88, tod + 0.06))) this.purpose.set(c.id, 'Visiting friends');
      }
    }
    // lunch: workers nearby buy a coffee or a bun (ice cream in a heatwave sells twice as well)
    if (tod > 0.48 && tod < 0.53 && this.lunchDay !== eco.day) {
      this.lunchDay = eco.day;
      for (const k of buildings.list.filter((b) => (b.kind === 'kiosk' || b.kind === 'bakery') && b.workers > 0)) {
        let n = 0;
        for (const c of pop.citizens.values()) {
          if (n >= 12 || c.state !== 'away' || c.job < 0) continue;
          const w = buildings.get(c.job);
          const f = pop.families.get(c.family);
          if (!w || !f || Math.hypot(w.x - k.x, w.z - k.z) > 8) continue;
          const price = 3 * (this.host.weatherMood === 'heat' && k.kind === 'kiosk' ? 2 : 1);
          f.money -= price;
          k.sales = (k.sales ?? 0) + price;
          n++;
        }
      }
    }
  }

  private outings(kinds: string[], who: (c: Citizen) => boolean, chance: number, cap: number, until: number, range: number, purpose?: string) {
    const { pop, buildings } = this.c;
    const places = buildings.list.filter((b) => kinds.includes(b.kind) && b.built >= 1 && (!BUILDINGS[b.kind].jobs || b.workers > 0 || b.kind === 'park' || b.kind === 'bigpark' || b.kind === 'townhall'));
    if (!places.length) return;
    for (const c of pop.citizens.values()) {
      if (c.state !== 'home' || c.outing !== undefined || !who(c) || Math.random() > chance) continue;
      const home = buildings.get(pop.families.get(c.family)?.home ?? -1);
      if (!home) continue;
      let best: Building | undefined, bd = range;
      for (const p of places) {
        if (p.city !== home.city || (this.visits.get(p.id) ?? 0) >= cap) continue;
        const d = Math.hypot(p.x - home.x, p.z - home.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) continue;
      if (this.host.planOuting(c, best, until)) {
        this.visits.set(best.id, (this.visits.get(best.id) ?? 0) + 1);
        if (purpose) this.purpose.set(c.id, purpose);
      }
    }
  }

  /** Where a visitor stands and what they look at, in world space. */
  spot(b: Building): { at: Point; face: Point; anim: 'play' | 'cheer' | 'sit' | 'none'; lift?: number } {
    const s = BUILDINGS[b.kind].size;
    const local = (x: number, z: number): Point => {
      const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      return { x: b.mesh.position.x + x * cr + z * sr, z: b.mesh.position.z - x * sr + z * cr };
    };
    if (b.kind === 'bench') {
      const x = pick([-0.2, 0.25]) + rnd(-0.1, 0.1);
      return { at: local(x, -0.05), face: local(x, 0.5), anim: 'sit', lift: 0.06 };
    }
    if (b.kind === 'cinema') {
      const z = pick([-0.25, 0.05, 0.35]), x = pick([-1, 1]) * rnd(0.2, 0.7);
      return { at: local(x, z), face: local(x * 0.6, -0.8), anim: 'sit', lift: 0.06 };
    }
    if (b.kind === 'stadium') {
      // fans stand on one of the three stepped rows of the back or side stands
      const side = Math.floor(Math.random() * 3), row = Math.floor(Math.random() * 3);
      const at = side === 0 ? local(rnd(-1.2, 1.2), -1.1 - row * 0.12) : local((side === 1 ? -1 : 1) * (1.25 + row * 0.08), rnd(-1.0, 0.6));
      return { at, face: local(0, -0.15), anim: 'cheer', lift: 0.1 + row * 0.1 };
    }
    if (b.kind === 'mosque') {
      // rows on the courtyard, facing the prayer hall
      const x = -0.6 + Math.floor(Math.random() * 6) * 0.14, z = 0.35 + Math.floor(Math.random() * 3) * 0.16;
      return { at: local(x, z), face: local(x, -0.4), anim: 'sit' };
    }
    if (b.kind === 'teahouse') {
      const x = pick([-0.45, 0.45]) + rnd(-0.17, 0.17), z = 0.15 + pick([-0.14, 0.14]);
      return { at: local(x, z), face: local(pick([-0.45, 0.45]), 0.15), anim: 'sit', lift: 0.13 };
    }
    if (b.kind === 'themepark') return { at: local(rnd(-1.5, 1.5), rnd(-0.2, 1.6)), face: local(rnd(-1.5, 1.5), rnd(-1.5, 0)), anim: Math.random() < 0.5 ? 'play' : 'cheer' };
    if (b.kind === 'townhall') {
      const a = Math.random() * Math.PI * 2, r = rnd(0.25, 0.45);
      return { at: local(0.6 + Math.cos(a) * r, 0.62 + Math.sin(a) * r * 0.5), face: local(0.6, 0.62), anim: 'cheer' };
    }
    const h = s * 0.36;
    return { at: local(rnd(-h, h), rnd(-h, h)), face: local(rnd(-h, h), rnd(-h, h)), anim: 'play' };
  }

  /** Visitor pays for a ticket and stays until `until`. */
  stay(c: Citizen, b: Building, until: number) {
    const { walkers, pop, eco } = this.c;
    const f = pop.families.get(c.family);
    const price = b.kind === 'cinema' ? CINEMA.ticket : b.kind === 'stadium' ? FOOTBALL.ticket : 0;
    if (price && f) { f.money -= price; b.sales = (b.sales ?? 0) + price; }
    const visit = VISIT_PRICE[b.kind];
    if (visit && f && f.money > visit[0]) {
      const stake = Math.round(visit[0] + Math.random() * (visit[1] - visit[0]));
      this.host.sell(c, b, stake);
      // at the casino some win back more than their stake; most lose it
      if (b.kind === 'casino' && Math.random() < 0.3) { const win = Math.round(stake * (1.5 + Math.random())); f.money += win; b.sales = Math.max(0, (b.sales ?? 0) - win * 0.5); pop.note(c, 'Won ${n} at the casino', { n: win }); }
      if (b.kind === 'gym') { c.health = Math.min(100, c.health + 6); c.fit = eco.day + 6; }
      if (b.kind === 'barber') c.energy = Math.min(100, (c.energy ?? 80) + 10);
      if (b.kind === 'teahouse') { c.hunger = Math.min(100, c.hunger + 25); c.energy = Math.min(100, (c.energy ?? 80) + 15); }
    }
    if (b.kind === 'mosque') c.energy = Math.min(100, (c.energy ?? 80) + 8);
    c.activity = b.kind === 'bench' || ((b.kind === 'park' || b.kind === 'fountain') && c.age >= 14) ? pick(BENCH_LIFE) : b.kind === 'townhall' && !this.host.festival ? 'Listening to a street musician' : b.kind === 'cinema' ? 'Watching a film' : b.kind === 'stadium' ? 'Watching football' : b.kind === 'townhall' ? 'Celebrating' : 'Playing';
    const sp = this.spot(b);
    if (BENCH_LIFE.includes(c.activity)) sp.anim = 'sit';
    const why = this.purpose.get(c.id);
    if (why) {
      this.purpose.delete(c.id);
      c.activity = why;
      sp.anim = why === 'Playing chess in the park' ? 'sit' : why === 'Weekend family walk' && c.age < 12 ? 'play' : 'none';
      if (BUILDINGS[b.kind].units) {
        // visitors stand in the front yard with their hosts
        const cr = Math.cos(b.rot), sr = Math.sin(b.rot), x = rnd(-0.25, 0.25), z = 0.32;
        sp.at = { x: b.mesh.position.x + x * cr + z * sr, z: b.mesh.position.z - x * sr + z * cr };
        sp.face = b.mesh.position;
        sp.lift = 0;
      }
    }
    // the first ten young people at a match play in it
    if (b.kind === 'stadium' && this.c.buildings.matchOn && c.age >= 15 && c.age < 40 && (this.players.get(b.id)?.length ?? 0) < 10) {
      const team = this.players.get(b.id) ?? [];
      team.push(c);
      this.players.set(b.id, team);
      c.activity = PLAY_FOOTBALL;
      const w0 = c.walker;
      if (!w0) return;
      const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      const pitch = (): Point => { const x = rnd(-0.95, 0.95), z = rnd(-0.85, 0.55); return { x: b.mesh.position.x + x * cr + z * sr, z: b.mesh.position.z - x * sr + z * cr }; };
      const run = (w: Walker) => { if (c.activity === PLAY_FOOTBALL) walkers.retarget(w, { points: [{ x: w.x, z: w.z }, pitch()] }, run); };
      w0.speed = 1 + Math.random() * 0.3;
      walkers.retarget(w0, { points: [{ x: w0.x, z: w0.z }, pitch()] }, run);
      return;
    }
    if (b.kind === 'townhall' && this.buskers.get(b.id) === c.id) {
      c.activity = BUSK;
      const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      sp.at = { x: b.mesh.position.x + 0.6 * cr + 0.62 * sr, z: b.mesh.position.z - 0.6 * sr + 0.62 * cr };
      sp.face = { x: sp.at.x + sr, z: sp.at.z + cr };
      sp.anim = 'cheer';
    }
    const secs = Math.max(2, (until - eco.timeOfDay) * DAY_SECONDS);
    const w = c.walker;
    if (!w) return;
    if (INDOOR.has(b.kind)) { walkers.dismiss(w); c.walker = undefined; return; }
    walkers.retarget(w, { points: [{ x: w.x, z: w.z }, sp.at] }, () => {
      w.lift = sp.lift;
      walkers.holdFor(w, secs, sp.anim, () => { w.lift = 0; }, sp.face);
    });
  }

  // ---------- festivals ----------

  private festival(kind: string | null) {
    this.festKind = kind;
    for (const m of this.festMeshes.values()) this.group.remove(m);
    this.festMeshes.clear();
    if (!kind) return;
    for (const hall of this.c.buildings.list.filter((b) => b.kind === 'townhall' && b.built >= 1)) {
      const m = new THREE.Mesh(kind === 'New Year' ? this.treeGeo : this.navruzGeo, this.festMat);
      m.castShadow = true;
      m.scale.setScalar(0.5);
      const cr = Math.cos(hall.rot), sr = Math.sin(hall.rot);
      m.position.set(hall.mesh.position.x + 0.6 * cr + 0.62 * sr, 0, hall.mesh.position.z - 0.6 * sr + 0.62 * cr);
      this.group.add(m);
      this.festMeshes.set(hall.id, m);
    }
  }

  // ---------- football ----------

  /** Two teams of five chase the ball while a match is on. */
  /** Soldiers on duty — real citizens of the base — march up and down the parade ground during the day. */
  private drill() {
    const { buildings, walkers, eco } = this.c;
    const tod = eco.timeOfDay;
    const on = tod > 0.3 && tod < 0.7;
    for (const [id, list] of this.soldiers) {
      const base = buildings.get(id);
      const keep = list.filter(({ c, w }) => on && !!base && !base.removed && c.walker === w && !w.leaving && c.activity === DRILL && !this.host.isShiftOver(c));
      for (const e of list) {
        if (keep.includes(e) || e.c.activity !== DRILL) continue;
        // back inside the barracks; the daily schedule sends them home when the shift is over
        if (e.c.walker === e.w) { walkers.dismiss(e.w); e.c.walker = undefined; }
        e.c.activity = 'At work';
      }
      if (keep.length) this.soldiers.set(id, keep); else this.soldiers.delete(id);
    }
    if (!on) return;
    for (const b of buildings.list) {
      if (b.kind !== 'military' || b.built < 1) continue;
      const list = this.soldiers.get(b.id) ?? [];
      if (list.length >= 8) continue;
      const free = this.host.staffOnDuty(b).filter((c) => !c.walker);
      if (!free.length) continue;
      const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      const at = (x: number, z: number): Point => ({ x: b.mesh.position.x + x * cr + z * sr, z: b.mesh.position.z - x * sr + z * cr });
      for (const c of free.slice(0, 8 - list.length)) {
        // two ranks of four, marching in step from one end of the ground to the other
        const i = list.length;
        const z = 0.35 + Math.floor(i / 4) * 0.18, x0 = -0.1 + (i % 4) * 0.12;
        const a = at(x0, z), e = at(x0 + 0.8, z);
        let fwd = true;
        const march = (w: Walker) => { fwd = !fwd; walkers.retarget(w, { points: [{ x: w.x, z: w.z }, fwd ? e : a] }, march); };
        const w = walkers.walk(c.variant, 1, { points: [buildings.door(b), a] }, 'none', march);
        w.citizen = c.id;
        w.speed = 0.55;
        c.walker = w;
        c.activity = DRILL;
        list.push({ c, w });
      }
      this.soldiers.set(b.id, list);
    }
  }

  /** In the evening a citizen plays music on the town hall square; a few people stop to listen. */
  private busking(tod: number) {
    const { buildings, pop } = this.c;
    const on = !this.host.festival && tod > 0.62 && tod < 0.84;
    if (!on) { this.buskers.clear(); return; }
    for (const b of buildings.list) {
      if (b.kind !== 'townhall' || b.built < 1) continue;
      const id = this.buskers.get(b.id);
      const cur = id !== undefined ? pop.citizens.get(id) : undefined;
      if (cur && (cur.outing === b.id || cur.activity === BUSK)) continue;
      const cand = [...pop.citizens.values()].filter((c) => c.state === 'home' && c.age >= 18 && c.age < 60 && !c.night && pop.families.get(c.family) && buildings.get(pop.families.get(c.family)!.home)?.city === b.city);
      if (!cand.length) continue;
      const c = pick(cand);
      if (this.host.planOuting(c, b, 0.86)) this.buskers.set(b.id, c.id);
    }
  }

  /** Children and grown-ups go skating on the frozen lake near their town. */
  private skating(tod: number) {
    const { pop, buildings, walkers } = this.c;
    if (tod < 0.4 || tod > 0.74) return;
    for (const spot of this.iceSpots()) {
      const n = [...pop.citizens.values()].filter((c) => c.activity === SKATE && c.walker && Math.hypot(c.walker.x - spot.x, c.walker.z - spot.z) < 3).length;
      if (n >= 6) continue;
      const cand = [...pop.citizens.values()].filter((c) => {
        if (c.state !== 'home' || c.age < 6 || c.age > 55 || c.activity.startsWith('Sleeping')) return false;
        const h = buildings.get(pop.families.get(c.family)?.home ?? -1);
        return !!h && Math.hypot(h.mesh.position.x - spot.x, h.mesh.position.z - spot.z) < 30;
      });
      if (!cand.length) continue;
      const c = pick(cand);
      const r = rnd(0.4, 1.0), a0 = Math.random() * Math.PI * 2;
      const loop = Array.from({ length: 13 }, (_, j) => ({ x: spot.x + Math.cos(a0 + (j / 12) * Math.PI * 2) * r, z: spot.z + Math.sin(a0 + (j / 12) * Math.PI * 2) * r * 0.8 }));
      this.host.sendToPoint(c, loop[0], Math.min(0.8, tod + 0.12), SKATE, (cc) => {
        const w = cc.walker;
        if (!w) return;
        const go = (ww: Walker) => { if (cc.activity === SKATE) walkers.retarget(ww, { points: loop }, go); };
        w.speed = 0.95;
        go(w);
      });
    }
  }

  /** Pigeons peck around benches, fountains and town hall squares (they hide at night and in the rain). */
  private updatePigeons(dt: number) {
    const { buildings, eco } = this.c;
    this.pigeonT -= dt;
    if (this.pigeonT <= 0) {
      this.pigeonT = 3;
      this.pigeonSpots = [];
      for (const b of buildings.list) {
        if (b.built < 1 || !(b.kind === 'bench' || b.kind === 'fountain' || b.kind === 'townhall' || b.kind === 'park' || b.kind === 'kiosk')) continue;
        for (let i = 0; i < 4 && this.pigeonSpots.length < 160; i++) this.pigeonSpots.push({ x: b.mesh.position.x + rnd(-0.4, 0.4), z: b.mesh.position.z + rnd(-0.4, 0.4) + (b.kind === 'townhall' ? 0.6 : 0), ph: Math.random() * 10 });
      }
    }
    const day = eco.timeOfDay > 0.27 && eco.timeOfDay < 0.8;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let n = 0;
    if (day) for (const sp of this.pigeonSpots) {
      const t = this.time * 1.3 + sp.ph;
      const hop = Math.max(0, Math.sin(t * 6)) * 0.015;
      p.set(sp.x + Math.sin(t * 0.7) * 0.06, 0.02 + hop, sp.z + Math.cos(t * 0.5) * 0.06);
      q.setFromAxisAngle(up, t * 0.9);
      m.compose(p, q, s);
      this.pigeons.setMatrixAt(n++, m);
    }
    this.pigeons.count = n;
    this.pigeons.instanceMatrix.needsUpdate = true;
  }

  /** After the match the players stop running. The team itself is made of real citizens (see stay). */
  private footballers() {
    if (this.c.buildings.matchOn) return;
    for (const [id, list] of this.players) {
      for (const c of list) if (c.activity === PLAY_FOOTBALL) c.activity = 'Watching football';
      this.players.delete(id);
    }
  }

  private playMatches() {
    const { buildings, eco } = this.c;
    const clubs = [...eco.cities.values()].filter((city) => buildings.list.some((b) => b.kind === 'stadium' && b.city === city.id && b.built >= 1 && b.workers > 0));
    if (!clubs.length) return;
    const strength = (city: City) => {
      const pop = [...this.c.pop.families.values()].filter((f) => buildings.get(f.home)?.city === city.id).length;
      const academy = buildings.list.some((b) => b.kind === 'academy' && b.city === city.id && b.workers > 0) ? 0.5 : 0;
      return 0.8 + Math.min(1, pop / 60) * 0.6 + city.happiness / 150 + academy + Math.random() * 0.6;
    };
    // pair up the clubs; a lone club plays a visiting team
    const order = clubs.sort(() => Math.random() - 0.5);
    for (let i = 0; i < order.length; i += 2) {
      const a = order[i], b = order[i + 1];
      const sa = strength(a), sb = b ? strength(b) : 0.9 + Math.random() * 0.9;
      const hs = poisson(sa * 0.9), as = poisson(sb * 0.9);
      const res: MatchResult = { day: eco.day, home: a.name, away: b ? b.name : t('Visiting team'), hs, as };
      this.matches.unshift(res);
      const swing = (city: City | undefined, won: number) => { if (city) this.sport.set(city.id, won > 0 ? 6 : won < 0 ? -2 : 1); };
      swing(a, Math.sign(hs - as));
      swing(b, Math.sign(as - hs));
      const winner = hs > as ? res.home : as > hs ? res.away : null;
      this.host.events.push(t('Football: {a} {x}:{y} {b}', { a: res.home, x: hs, y: as, b: res.away }) + (winner ? ` — ${t('{city} wins! The fans are celebrating', { city: winner })}` : ` — ${t('a draw')}`));
      for (const st of buildings.list.filter((s) => s.kind === 'stadium' && (s.city === a.id || s.city === b?.id))) {
        this.c.effects.firework(st.mesh.position.x, st.mesh.position.z);
        sound.play(hs + as > 0 ? 'goal' : 'cheer', st.mesh.position);
      }
    }
    this.matches.length = Math.min(this.matches.length, 12);
  }

  // ---------- weddings ----------

  /** A decorated white car leads the procession from the Wedding Hall, relatives follow. */
  wedding(cityId: number, a: string, b: string) {
    const { buildings, traffic, effects } = this.c;
    const hall = buildings.list.find((x) => x.kind === 'weddinghall' && x.city === cityId && x.built >= 1 && x.access >= 0);
    if (!hall) return;
    const homes = buildings.list.filter((h) => BUILDINGS[h.kind].units && h.city === cityId && h.access >= 0 && h.access !== hall.access);
    if (!homes.length) return;
    const home = pick(homes);
    if (!traffic.canRoute(hall.access, home.access)) return;
    effects.hearts(hall.mesh.position.x, hall.mesh.position.z);
    sound.play('wedding', hall.mesh.position);
    const colors = ['#f2f2ee', '#3a3f48', '#c4553d', '#3a6fd1'];
    for (let i = 0; i < 4; i++) {
      this.later(i * 1.1, () => {
        traffic.spawn({
          kind: 'car', from: hall.access, to: home.access, color: new THREE.Color(colors[i]), fromPos: buildings.door(hall), toPos: buildings.door(home),
          wedding: i === 0, purpose: i === 0 ? 'Wedding car' : 'Wedding procession', driverName: i === 0 ? `${a} & ${b}` : 'Relatives',
          fromName: 'Wedding Hall', destName: 'New home',
          onArrive: () => { if (i === 0) effects.hearts(home.mesh.position.x, home.mesh.position.z); },
        });
      });
    }
  }

  // ---------- ambulance ----------

  /** Paramedics drive to the patient with the siren on, carry them out on a stretcher and take them to hospital. */
  ambulance(patient: Citizen, home: Building): boolean {
    const { buildings, traffic, walkers } = this.c;
    if (this.calls.has(patient.id) || home.access < 0) return false;
    const hospital = buildings.list
      .filter((b) => b.kind === 'hospital' && b.city === home.city && b.built >= 1 && b.workers > 0 && b.access >= 0)
      .sort((p, q) => Math.hypot(p.x - home.x, p.z - home.z) - Math.hypot(q.x - home.x, q.z - home.z))[0];
    if (!hospital || !traffic.canRoute(hospital.access, home.access)) return false;
    // a paramedic on shift drives the ambulance
    const medic0 = this.host.takeDriver(hospital, 'Driving the ambulance');
    if (!medic0) return false;
    const done = () => { this.calls.delete(patient.id); this.host.releaseDriver(medic0); };
    this.calls.add(patient.id);
    const name = `${patient.name} ${this.c.pop.families.get(patient.family)?.surname ?? ''}`.trim();
    const white = new THREE.Color('#f4f4f2');
    sound.play('siren', home.mesh.position);
    const ok = traffic.spawn({
      kind: 'car', from: hospital.access, to: home.access, color: white, fromPos: buildings.door(hospital), siren: true,
      purpose: 'Emergency call', driverId: medic0.id, driverName: this.host.fullName(medic0), fromName: 'Hospital', destName: BUILDINGS[home.kind].name, homeBuildingId: hospital.id,
      onArrive: () => {
        const door = buildings.door(home);
        const road = buildings.slot(home, 0);
        const medic = walkers.walk(3, 1, { points: [door, { x: (door.x + road.x) / 2, z: (door.z + road.z) / 2 }] }, 'stretcher', () => {
          traffic.spawn({
            kind: 'car', from: home.access, to: hospital.access, color: white, toPos: buildings.door(hospital), siren: true,
            purpose: 'Taking a patient to hospital', driverId: medic0.id, driverName: this.host.fullName(medic0), fromName: BUILDINGS[home.kind].name, destName: 'Hospital', homeBuildingId: hospital.id,
            onArrive: () => {
              done();
              if (this.c.pop.citizens.get(patient.id) !== patient) return;
              patient.health = Math.max(patient.health, 85);
              this.host.charge(patient, hospital.city, SERVICE_FEE.hospital);
              this.c.pop.note(patient, 'Taken to hospital by ambulance — the doctors helped');
              this.host.events.push(t('The ambulance took {name} to hospital — doctors saved them', { name }));
            },
            onFail: done,
          });
        });
        medic.speed = 0.5;
      },
      onFail: done,
    });
    if (!ok) done();
    else this.host.events.push(t('{name} fell ill — an ambulance is on its way', { name }));
    return ok;
  }

  // ---------- daily ----------

  /** Called once a day per city: ambulances, decorations, petitions. */
  daily(city: City, own: Building[], say: (msg: string) => void) {
    const { pop, buildings } = this.c;
    // the sick are fetched by ambulance (a couple per day, spread over the morning)
    let sent = 0;
    for (const c of pop.citizens.values()) {
      if (sent >= 3 || c.health >= 35 || c.state !== 'home') continue;
      const home = buildings.get(pop.families.get(c.family)?.home ?? -1);
      if (!home || home.city !== city.id) continue;
      sent++;
      this.later(rnd(2, 30), () => { if (pop.citizens.get(c.id) === c) this.ambulance(c, home); });
    }
    // decorations cheer up the homes around them
    const homes = own.filter((b) => BUILDINGS[b.kind].units);
    const decor = own.filter((b) => DECOR[b.kind]);
    let sum = 0;
    for (const h of homes) {
      let v = 0;
      for (const d of decor) if (near(d, h.x, h.z, DECOR_RANGE)) v += DECOR[d.kind]!;
      sum += Math.min(6, v);
    }
    this.beauty.set(city.id, homes.length ? sum / homes.length : 0);
    for (const [m, v] of [[this.trust, 0.85], [this.sport, 0.7]] as const) m.set(city.id, (m.get(city.id) ?? 0) * v);
    this.checkPetitions(city, own, say);
    // letters come only from the player's own towns
    if (!city.ai && (!this.host.calm || Math.random() < 0.5)) this.newPetition(city, own, say);
  }

  /** Extra happiness target for a city. */
  bonus(cityId: number, own: Building[]) {
    const has = (k: string) => own.some((b) => b.kind === k && (!BUILDINGS[b.kind].jobs || b.workers > 0));
    return Math.min(6, this.beauty.get(cityId) ?? 0) + (has('stadium') ? 3 : 0) + (has('cinema') ? 3 : 0) + (has('academy') ? 2 : 0)
      + (has('mosque') ? 3 : 0) + (has('themepark') ? 3 : 0) + (has('teahouse') ? 2 : 0) + (has('barber') ? 1.5 : 0) + (has('gym') ? 1 : 0) + (has('casino') ? 1 : 0)
      + (this.trust.get(cityId) ?? 0) + (this.sport.get(cityId) ?? 0);
  }

  get beautyOf() { return this.beauty; }

  // ---------- petitions ----------

  private fulfilled(p: Petition, own: Building[]) {
    const { pop, buildings } = this.c;
    const built = (kinds: string[], r: number) => own.some((b) => kinds.includes(b.kind) && near(b, p.x, p.z, r));
    switch (p.kind) {
      case 'shop': return built(['grocery', 'market'], 12);
      case 'park': return built(['park'], 10);
      case 'playground': return built(['playground', 'park'], 8);
      case 'hospital': return own.some((b) => b.kind === 'hospital');
      case 'busstop': return built(['busstop'], 8);
      case 'light': {
        for (let z = p.z - 4; z <= p.z + 4; z++) for (let x = p.x - 4; x <= p.x + 4; x++) if (inBounds(x, z) && this.host.isLit(idx(x, z))) return true;
        return false;
      }
      case 'school': {
        const seats = own.filter((b) => b.kind === 'school').length * BUILDINGS.school.students;
        const pupils = [...pop.citizens.values()].filter((c) => c.age >= 6 && c.age < 18 && buildings.get(pop.families.get(c.family)?.home ?? -1)?.city === p.city).length;
        return seats >= pupils;
      }
    }
  }

  private checkPetitions(city: City, own: Building[], say: (msg: string) => void) {
    const day = this.c.eco.day;
    for (const p of this.petitions) {
      if (p.city !== city.id || p.state !== 'open') continue;
      if (this.fulfilled(p, own)) {
        p.state = 'done';
        this.c.eco.add(city, 'money', p.reward, 'Letters answered');
        this.trust.set(city.id, Math.min(10, (this.trust.get(city.id) ?? 0) + 4));
        say(t('The {family} family thanks the town hall for answering their letter: +${n} and more trust', { family: p.from, n: p.reward }));
        sound.play('coin');
      } else if (day - p.day >= PETITION_DAYS) {
        p.state = 'failed';
        this.trust.set(city.id, Math.max(-10, (this.trust.get(city.id) ?? 0) - 3));
        say(t('The {family} family is disappointed: nobody answered their letter', { family: p.from }));
      }
    }
    // keep the list short: drop old answered letters
    this.petitions = this.petitions.filter((p) => p.state === 'open' || day - p.day < PETITION_DAYS + 4).slice(-40);
  }

  private newPetition(city: City, own: Building[], say: (msg: string) => void) {
    const { pop, buildings, net } = this.c;
    if (this.petitions.filter((p) => p.city === city.id && p.state === 'open').length >= 3 || Math.random() > 0.45) return;
    const homes = own.filter((b) => BUILDINGS[b.kind].units);
    if (homes.length < 3) return;
    const home = pick(homes);
    const fam = [...pop.families.values()].find((f) => f.home === home.id);
    if (!fam) return;
    const kids = pop.members(fam).some((c) => c.age >= 3 && c.age < 14);
    const people = [...pop.families.values()].filter((f) => buildings.get(f.home)?.city === city.id).length * 3;
    const roadNear = () => { for (let z = home.z - 2; z <= home.z + 2; z++) for (let x = home.x - 2; x <= home.x + 2; x++) if (inBounds(x, z) && net.type[x + z * N]) return true; return false; };
    const options: PetitionKind[] = (['shop', 'light', 'park', 'school', 'hospital', 'busstop', 'playground'] as PetitionKind[]).filter((k) => {
      if (this.petitions.some((p) => p.city === city.id && p.kind === k && p.state === 'open')) return false;
      if (k === 'light' && !roadNear()) return false;
      if (k === 'hospital' && people < 40) return false;
      if (k === 'busstop' && !own.some((b) => b.kind === 'busdepot')) return false;
      if (k === 'playground' && !kids) return false;
      if (k === 'school' && people < 20) return false;
      return !this.fulfilled({ id: 0, city: city.id, kind: k, from: '', x: home.x, z: home.z, day: 0, reward: 0, state: 'open' }, own);
    });
    if (!options.length) return;
    const kind = pick(options);
    const p: Petition = { id: this.nextId++, city: city.id, kind, from: fam.surname, x: home.x, z: home.z, day: this.c.eco.day, reward: PETITION_REWARD[kind], state: 'open' };
    this.petitions.push(p);
    say(t('A letter from the {family} family: {text}', { family: p.from, text: t(PETITION_TEXT[kind]) }));
  }

  // ---------- save ----------

  serialize(): LeisureSave {
    return { petitions: this.petitions, matches: this.matches, trust: [...this.trust] };
  }

  deserialize(s?: LeisureSave) {
    if (!s) return;
    this.petitions = s.petitions ?? [];
    this.matches = s.matches ?? [];
    this.trust = new Map(s.trust ?? []);
    this.nextId = this.petitions.reduce((m, p) => Math.max(m, p.id + 1), 1);
  }
}
