import type { BuildingKind } from '../buildings/BuildingTypes';
import { BUILDINGS } from '../buildings/BuildingTypes';
import { N, type Tile } from '../world/grid';
import { FOL_FLAT } from '../world/WorldGen';
import { mulberry32 } from '../utils/rng';

/** The version of the followers' city plan: a town saved with an older plan is set aside and the city is laid anew. */
export const FOL_CITY = 3;
/** The seed of the followers' world (its land, sea, mountains and woods). */
export const FOL_SEED = 20261108;
/** Premium homes: luxury buildings in the centre, each owned by one premium (paying) follower. */
export const PREMIUM_KINDS: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['skyscraper', 'landmark']);
/** Ordinary followers live at least this far (in tiles, on either axis) from the town hall: in the housing districts. */
export const ORDINARY_FROM = 42;

export interface CityApi {
  /** Lay a straight street (consecutive tiles). */
  road(tiles: Tile[], lit: boolean): void;
  /** Put up a finished building; false when it does not fit. */
  put(kind: BuildingKind, x: number, z: number): boolean;
  /** Pave walkways (on the tiles still free): 1 pavers · 2 stone · 3 brick · 4 gravel. */
  paths(tiles: Tile[], style: number): void;
}

const C = N / 2;
/** Streets every 7 tiles: one road tile and a block of 6 x 6. */
const G = 7;
/** Cells this many rings from the middle have every street (beyond them only main roads cross the empty land). */
const CORE = 11;
/** The outermost street line (the ring road round the city land). */
const KF = Math.floor(FOL_FLAT / G);
const line = (k: number) => C + G * k;
const ringOf = (i: number) => (i < 0 ? -i - 1 : i);
const mod = (a: number, m: number) => ((a % m) + m) % m;

type Slot = BuildingKind | [BuildingKind, BuildingKind];
const DECOR: BuildingKind[] = ['flowerbed', 'planter', 'sapling', 'bench', 'lamppost', 'sapling'];
const P8: [number, number][] = [[0, 0], [2, 0], [4, 0], [0, 2], [4, 2], [0, 4], [2, 4], [4, 4]];

/**
 * Lay the followers' city like a real one: the town hall in the very middle on the central avenue, a grand square
 * in front of it and luxury skyscrapers round it; a luxury business district of skyscrapers, city towers, malls,
 * game centres, cinemas, casinos and hotels; a ring of company offices, hospitals, the university, the stadium, the
 * amusement park and the zoo; then the housing districts — streets with empty blocks where the followers' houses go up
 * one by one, with a school, shops, a clinic and a park in every quarter; an industrial park, solar fields, wind
 * turbines and the airport further out, main roads across the empty land and a ring road round it.
 * Returns how many premium homes (luxury buildings) the city has.
 */
export function layFollowersCity(api: CityApi, seed = FOL_SEED): number {
  const rnd = mulberry32(seed * 17 + 3);
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  let premium = 0;
  const put = (kind: BuildingKind, x: number, z: number) => {
    const ok = api.put(kind, x, z);
    if (ok && PREMIUM_KINDS.has(kind)) premium++;
    return ok;
  };
  const decor = (x: number, z: number, kind = pick(DECOR)) => put(kind, x, z);

  // ---------- the streets ----------
  // the middle square has only the central avenue (in front of the town hall) and two streets north of it
  const civic = (x: number, z: number) => x > C - 14 && x < C + 14 && z > C - 14 && z < C + 14
    && z !== C && !((x === C - 7 || x === C + 7) && z < C);
  const street = (vertical: boolean, at: number, from: number, to: number, lit: boolean) => {
    let run: Tile[] = [];
    const flush = () => { if (run.length) api.road(run, lit); run = []; };
    for (let s = from; s <= to; s++) {
      const t = vertical ? { x: at, z: s } : { x: s, z: at };
      if (civic(t.x, t.z)) flush(); else run.push(t);
    }
    flush();
  };
  /** Every street of a district of cells i0..i1 x j0..j1. */
  const district = (i0: number, i1: number, j0: number, j1: number, lit: boolean) => {
    for (let k = i0; k <= i1 + 1; k++) street(true, line(k), line(j0), line(j1 + 1), lit);
    for (let k = j0; k <= j1 + 1; k++) street(false, line(k), line(i0), line(i1 + 1), lit);
  };
  district(-CORE - 1, CORE, -CORE - 1, CORE, true);
  // main roads across the land still empty, every fourth street, and the ring road
  for (let k = -KF; k <= KF; k++) {
    if (k % 4 !== 0 && Math.abs(k) !== KF) continue;
    street(true, line(k), line(-KF), line(KF), true);
    street(false, line(k), line(-KF), line(KF), true);
  }
  // the industrial park in the east
  district(12, 14, -2, 1, false);

  // ---------- helpers for one block (cell) ----------
  /** Four 3 x 3 lots (a smaller building keeps to the block's outer corner, on the streets; trees fill the rest). */
  const quad = (x0: number, z0: number, kinds: BuildingKind[]) => {
    kinds.forEach((kind, n) => {
      const qx = x0 + (n % 2) * 3, qz = z0 + (n >> 1) * 3;
      const s = Math.min(3, BUILDINGS[kind].size), ox = n % 2 ? 3 - s : 0, oz = n >> 1 ? 3 - s : 0;
      if (!put(kind, qx + ox, qz + oz)) return;
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) {
        if (dx < ox || dx >= ox + s || dz < oz || dz >= oz + s) decor(qx + dx, qz + dz, 'sapling');
      }
    });
  };
  /** A square of 2 x 2 in the middle of a block. */
  const centre = (x: number, z: number, style: 'fountain' | 'park' | 'pond' | 'garden' = pick(['fountain', 'park', 'garden'])) => {
    if (style === 'park' || style === 'pond') { put(style, x, z); return; }
    if (style === 'fountain') { put('fountain', x, z); put('flowerbed', x + 1, z); put('flowerbed', x, z + 1); put('bench', x + 1, z + 1); return; }
    put('gazebo', x, z); put('sapling', x + 1, z); put('sapling', x, z + 1); put('flowerbed', x + 1, z + 1);
  };
  /** Eight 2 x 2 lots round the block's edge (each on a street), a square in the middle. */
  const eight = (x0: number, z0: number, slots: Slot[], mid: () => void = () => centre(x0 + 2, z0 + 2)) => {
    slots.forEach((slot, n) => {
      const [sx, sz] = P8[n];
      const x = x0 + sx, z = z0 + sz;
      if (typeof slot === 'string') {
        if (!put(slot, x, z)) for (let d = 0; d < 4; d++) decor(x + (d & 1), z + (d >> 1));
        return;
      }
      // two small buildings on the street side, flowers or trees behind them
      const front: Tile[] = sz === 0 ? [{ x, z }, { x: x + 1, z }] : sz === 4 ? [{ x, z: z + 1 }, { x: x + 1, z: z + 1 }]
        : sx === 0 ? [{ x, z }, { x, z: z + 1 }] : [{ x: x + 1, z }, { x: x + 1, z: z + 1 }];
      const back: Tile[] = sz === 0 ? [{ x, z: z + 1 }, { x: x + 1, z: z + 1 }] : sz === 4 ? [{ x, z }, { x: x + 1, z }]
        : sx === 0 ? [{ x: x + 1, z }, { x: x + 1, z: z + 1 }] : [{ x, z }, { x, z: z + 1 }];
      front.forEach((t, i) => { if (!put(slot[i], t.x, t.z)) decor(t.x, t.z); });
      back.forEach((t) => decor(t.x, t.z));
    });
    mid();
  };

  // ---------- the middle: the town hall on the central avenue ----------
  const at = (dx: number, dz: number) => ({ x: C + dx, z: C + dz });
  const P = (kind: BuildingKind, dx: number, dz: number) => { const t = at(dx, dz); return put(kind, t.x, t.z); };
  /** The same thing on both sides of the axis (the axis runs between columns -1 and 0). */
  const pair = (kind: BuildingKind, dx: number, dz: number) => { P(kind, dx, dz); P(kind, -BUILDINGS[kind].size - dx, dz); };
  P('townhall', -1, -2);
  pair('flagpole', -2, -1); pair('flagpole', -2, -2); pair('planter', -3, -1); pair('lamppost', -3, -2);
  pair('flowerbed', -4, -1); pair('flowerbed', -4, -2);
  // luxury skyscrapers on the avenue beside the town hall, the city tower behind it
  P('skyscraper', -6, -2); P('skyscraper', 4, -2);
  P('landmark', -2, -13);
  // the government garden behind the town hall: a pond, fountains, a clock tower and flower beds
  pair('flowerbed', -1, -3); pair('flowerbed', -2, -3);
  P('pond', -1, -5);
  pair('fountain', -3, -5); pair('fountain', -3, -4);
  pair('clocktower', -1, -7); pair('statue', -3, -7);
  for (let dx = -4; dx <= 3; dx++) for (const dz of [-9, -10]) P(dx === -1 || dx === 0 ? 'flowerbed' : (dx + dz) & 1 ? 'sapling' : 'bench', dx, dz);
  pair('gazebo', -4, -12); pair('sapling', -3, -11); pair('sapling', -4, -11);
  // luxury skyscrapers down both sides of the garden
  for (const dz of [-13, -10, -7, -4]) { P('skyscraper', -6, dz); P('skyscraper', 5, dz); }
  for (const dz of [-11, -8, -5]) for (const dx of [-6, -5, 5, 6]) P('sapling', dx, dz);
  for (let dz = -13; dz <= -1; dz++) P('sapling', 6, dz);
  // the blocks west and east of it: two rows of luxury skyscrapers each, trees between
  for (const dz of [-13, -11, -9, -7, -5, -3]) { P('skyscraper', -13, dz); P('skyscraper', -9, dz); P('skyscraper', 8, dz); P('skyscraper', 12, dz); }
  for (let dz = -13; dz <= -1; dz++) { P(dz & 1 ? 'sapling' : 'flowerbed', -11, dz); P(dz & 1 ? 'flowerbed' : 'sapling', -10, dz); P(dz & 1 ? 'sapling' : 'flowerbed', 10, dz); P(dz & 1 ? 'flowerbed' : 'sapling', 11, dz); }
  for (const dx of [-13, -12, -9, -8, 8, 9, 12, 13]) P('planter', dx, -1);
  const garden: Tile[] = [];
  // brick walks: two across the garden, two along it
  for (let dx = -4; dx <= 3; dx++) garden.push(at(dx, -6), at(dx, -8), at(dx, -11));
  for (let dz = -13; dz <= -3; dz++) garden.push(at(-2, dz), at(1, dz));
  api.paths(garden, 3);

  // the grand square in front of the town hall: flags, the great fountain, monuments, clock towers, ponds and a park
  for (let dx = -12; dx <= -2; dx += 2) pair('flagpole', dx, 1);
  P('lamppost', -13, 1); P('lamppost', 13, 1);
  for (let dx = -2; dx <= 1; dx++) for (const dz of [4, 5]) P('fountain', dx, dz);
  for (let dx = -3; dx <= 2; dx++) { P('flowerbed', dx, 3); P('flowerbed', dx, 6); }
  for (const dz of [4, 5]) { P('flowerbed', -3, dz); P('flowerbed', 2, dz); }
  pair('statue', -1, 8);
  pair('clocktower', -8, 3);
  pair('pond', -11, 4);
  for (const dz of [4, 5]) pair('bench', -5, dz);
  for (const dx of [-6, -9, -12]) { pair('planter', dx, 6); pair('lamppost', dx, 7); }
  for (const [dx, dz] of [[-13, 9], [-9, 9]]) pair('bigpark', dx, dz);
  pair('gazebo', -6, 10); pair('kiosk', -5, 8); pair('playground', -6, 12);
  for (let dz = 9; dz <= 12; dz++) pair('lamppost', -2, dz);
  pair('archway', -1, 13);
  for (let dz = 2; dz <= 13; dz++) P('sapling', 13, dz);
  for (let dx = -13; dx <= 12; dx++) if (dx < -9 || dx > 8) P('sapling', dx, 13);
  const square: Tile[] = [];
  for (let dz = 1; dz <= 13; dz++) for (let dx = -13; dx <= 13; dx++) {
    if ((dx >= -4 && dx <= 3) || dz === 2 || dz === 7) square.push(at(dx, dz));
  }
  api.paths(square, 2);

  // ---------- the blocks round it ----------
  const fun: BuildingKind[] = ['arcade', 'cinema', 'casino', 'restaurant', 'concerthall', 'arcade', 'teahouse', 'hotel'];
  const business: BuildingKind[] = ['office', 'office', 'office', 'hotel', 'supermarket', 'restaurant', 'office', 'garage'];
  const smallShops: [BuildingKind, BuildingKind][] = [['bank', 'pharmacy'], ['bank', 'metro'], ['clothes', 'barber'], ['gym', 'bakery'], ['metro', 'kiosk'], ['bank', 'clothes'], ['dairyshop', 'pharmacy']];
  const special: Record<string, (x: number, z: number) => void> = {};
  const hospital = (x: number, z: number) => eight(x, z, ['hospital', ['pharmacy', 'police'], 'hospital', 'eldercare', ['firestation', 'busstop'], 'restaurant', ['pharmacy', 'kiosk'], 'parking'], () => centre(x + 2, z + 2, 'park'));
  for (const k of ['-5,-5', '4,-5', '-5,4', '4,4']) special[k] = hospital;
  special['-1,-5'] = (x, z) => quad(x, z, ['university', 'bigpark', 'college', 'academy']);
  special['0,-5'] = (x, z) => quad(x, z, ['bigpark', 'university', 'school', 'college']);
  special['5,-1'] = (x, z) => quad(x, z, ['stadium', 'parking', 'bigpark', 'gym']);
  special['5,0'] = (x, z) => quad(x, z, ['parking', 'stadium', 'playground', 'bigpark']);
  special['-6,-1'] = (x, z) => {
    put('themepark', x, z);
    for (const [dx, dz, kind] of [[4, 0, 'arcade'], [4, 2, 'cinema'], [4, 4, 'parking'], [0, 4, 'parking'], [2, 4, 'restaurant']] as [number, number, BuildingKind][]) {
      if (!put(kind, x + dx, z + dz)) for (let d = 0; d < 4; d++) decor(x + dx + (d & 1), z + dz + (d >> 1));
    }
  };
  special['-6,0'] = (x, z) => quad(x, z, ['zoo', 'bigpark', 'bigpark', 'pond']);
  special['-1,4'] = (x, z) => quad(x, z, ['bigpark', 'bigpark', 'bigpark', 'bigpark']);
  special['0,4'] = (x, z) => quad(x, z, ['bigpark', 'bigpark', 'bigpark', 'bigpark']);
  special['-1,5'] = (x, z) => eight(x, z, ['trainstation', ['busstop', 'kiosk'], 'busdepot', 'parking', 'hotel', 'garage', ['metro', 'kiosk'], 'restaurant'], () => centre(x + 2, z + 2, 'fountain'));
  special['0,5'] = (x, z) => eight(x, z, ['busdepot', ['busstop', 'gasstation'], 'trainstation', 'hotel', 'parking', 'restaurant', ['metro', 'kiosk'], 'garage'], () => centre(x + 2, z + 2, 'fountain'));
  special['2,-3'] = (x, z) => eight(x, z, ['mosque', ['kiosk', 'bakery'], 'teahouse', 'restaurant', 'skyscraper', 'skyscraper', ['bank', 'metro'], 'hotel'], () => centre(x + 2, z + 2, 'fountain'));
  let community = 0;
  const communityCell = (x: number, z: number) => {
    const n = community++;
    eight(x, z, [
      'school', ['kindergarten', 'grocery'], 'supermarket', ['pharmacy', n % 2 ? 'police' : 'firestation'],
      n % 2 ? 'restaurant' : 'teahouse', ['gym', 'barber'], ['watertower', n % 3 ? 'busstop' : 'gasstation'],
      (['college', 'eldercare', 'mosque', 'market', 'arcade'] as BuildingKind[])[n % 5],
    ], () => centre(x + 2, z + 2, 'park'));
  };

  for (let j = -CORE - 1; j <= CORE; j++) {
    for (let i = -CORE - 1; i <= CORE; i++) {
      const r = Math.max(ringOf(i), ringOf(j));
      if (r <= 1) continue;
      const x = line(i) + 1, z = line(j) + 1;
      const sp = special[`${i},${j}`];
      if (sp) { sp(x, z); continue; }
      if (r <= 3) {
        // the luxury district: skyscrapers and city towers (premium homes), malls and places to have fun
        const roll = rnd();
        if (roll < 0.25) quad(x, z, rnd() < 0.5 ? ['landmark', 'skyscraper', 'skyscraper', 'landmark'] : ['skyscraper', 'landmark', 'landmark', 'skyscraper']);
        else if (roll < 0.7) eight(x, z, P8.map((_, n) => (n === 1 || n === 6 ? pick(fun) : 'skyscraper')), () => centre(x + 2, z + 2, 'fountain'));
        else if (roll < 0.85) quad(x, z, ['mall', 'arcade', pick(['casino', 'cinema', 'concerthall']), pick(['restaurant', 'hotel', 'teahouse'])]);
        else eight(x, z, P8.map((_, n) => (n === 1 || n === 6 ? pick(smallShops) : pick(fun))), () => centre(x + 2, z + 2, 'fountain'));
        continue;
      }
      if (r <= 5) {
        // company offices, shops and fun round the centre
        const roll = rnd();
        if (roll < 0.5) eight(x, z, P8.map((_, n) => (n === 1 || n === 6 ? pick(smallShops) : pick(business))));
        else if (roll < 0.75) eight(x, z, P8.map((_, n) => (n === 1 || n === 6 ? pick(smallShops) : pick(fun))));
        else if (roll < 0.88) quad(x, z, ['mall', pick(['arcade', 'cinema']), pick(['restaurant', 'gym', 'teahouse']), 'parking']);
        else quad(x, z, ['bigpark', 'pond', 'playground', 'bigpark']);
        continue;
      }
      // the housing districts: empty blocks for the followers' houses, a school and shops in every quarter, parks
      if (mod(i, 4) === 2 && mod(j, 4) === 2) { communityCell(x, z); continue; }
      if (mod(i, 4) === 0 && mod(j, 4) === 0 && mod(i + j, 8) === 0) quad(x, z, rnd() < 0.5 ? ['bigpark', 'bigpark', 'bigpark', 'bigpark'] : ['bigpark', 'pond', 'playground', 'bigpark']);
    }
  }

  // ---------- further out ----------
  // the industrial park: factories, warehouses and works
  for (let j = -2; j <= 1; j++) for (let i = 12; i <= 14; i++) {
    const x = line(i) + 1, z = line(j) + 1;
    if ((i + j) % 2 === 0) quad(x, z, [pick(['factory', 'carfactory', 'factory']), 'warehouse', 'warehouse', pick(['factory', 'carfactory'])]);
    else eight(x, z, ['warehouse', ['gasstation', 'kiosk'], 'sawmill', 'brickworks', 'construction', 'bikefactory', ['busstop', 'firestation'], i === 14 && j === 1 ? 'sewage' : pick(['mill', 'dairy', 'recycling', 'warehouse'])], () => centre(x + 2, z + 2, 'garden'));
  }
  // solar fields in the south-east corner, wind turbines along the eastern shore road
  for (let z = line(12) + 2; z + 1 < line(KF) - 1; z += 3) for (let x = line(12) + 2; x + 1 < line(KF) - 1; x += 3) put('solarfarm', x, z);
  for (let z = line(-KF) + 2; z < line(KF) - 1; z += 6) put('windturbine', line(KF) + 2, z);
  // the airport by the western ring road
  put('airport', line(-KF) + 1, C + 2);
  put('parking', line(-KF) + 1, C - 3);
  return premium;
}
