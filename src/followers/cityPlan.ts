import type { BuildingKind } from '../buildings/BuildingTypes';
import { BUILDINGS } from '../buildings/BuildingTypes';
import { N, type Tile } from '../world/grid';
import { FOL_FLAT } from '../world/WorldGen';
import { mulberry32 } from '../utils/rng';

/** The version of the followers' city plan: a town saved with an older plan is set aside and the city is laid anew. */
export const FOL_CITY = 2;
/** The seed of the followers' world (its land, sea, mountains and woods). */
export const FOL_SEED = 20261108;

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
/** Cells this many rings from the middle are built up (the rest of the flat land waits, crossed by main roads). */
const CORE = 8;
/** The outermost street line (the ring road round the city land). */
const KF = Math.floor(FOL_FLAT / G);
const line = (k: number) => C + G * k;
const ringOf = (i: number) => (i < 0 ? -i - 1 : i);
const mod = (a: number, m: number) => ((a % m) + m) % m;

type Slot = BuildingKind | [BuildingKind, BuildingKind];
const DECOR: BuildingKind[] = ['flowerbed', 'planter', 'sapling', 'bench', 'lamppost', 'sapling'];
const P8: [number, number][] = [[0, 0], [2, 0], [4, 0], [0, 2], [4, 2], [0, 4], [2, 4], [4, 4]];

/**
 * Lay the followers' city: a grid of streets (a block of 6 x 6 between them), the town hall on a grand square in the
 * middle with the government quarter behind it and a park to the south, a business district of offices, banks,
 * hotels and towers round it, then housing districts of blocks of flats with schools, shops, clinics and parks in
 * every quarter, an industrial park and solar fields further out, main roads across the empty land and a ring road
 * round it. Returns how many homes (flats) the city has.
 */
export function layFollowersCity(api: CityApi, seed = FOL_SEED): number {
  const rnd = mulberry32(seed * 17 + 3);
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  let homes = 0;
  const put = (kind: BuildingKind, x: number, z: number) => {
    const ok = api.put(kind, x, z);
    if (ok) homes += BUILDINGS[kind].units;
    return ok;
  };
  const decor = (x: number, z: number, kind = pick(DECOR)) => put(kind, x, z);

  // ---------- the streets ----------
  // the grand square in the middle has no streets inside, only the avenue in front of the town hall
  const civic = (x: number, z: number) => x > C - 14 && x < C + 14 && z > C - 14 && z < C + 14 && z !== C - 7;
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
    street(true, line(k), line(-KF), line(KF), Math.abs(k) === KF || k === 0);
    street(false, line(k), line(-KF), line(KF), Math.abs(k) === KF || k === 0);
  }
  // the industrial park in the east
  district(11, 13, -2, 1, false);

  // ---------- helpers for one block (cell) ----------
  /** Four 3 x 3 lots (a smaller building leaves room for trees). */
  const quad = (x0: number, z0: number, kinds: BuildingKind[]) => {
    kinds.forEach((kind, n) => {
      const qx = x0 + (n % 2) * 3, qz = z0 + (n >> 1) * 3;
      // a smaller building keeps to the block's outer corner (on the streets), trees fill the rest of the lot
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

  // ---------- the middle: the town hall and the grand square ----------
  const at = (dx: number, dz: number) => ({ x: C + dx, z: C + dz });
  const P = (kind: BuildingKind, dx: number, dz: number) => { const t = at(dx, dz); return put(kind, t.x, t.z); };
  /** The same thing on both sides of the axis (the axis runs between columns -1 and 0). */
  const pair = (kind: BuildingKind, dx: number, dz: number) => { P(kind, dx, dz); P(kind, -BUILDINGS[kind].size - dx, dz); };
  // the government quarter: the town hall faces the avenue, ministries on both sides, company towers behind
  P('townhall', -1, -9);
  for (const [dx, kind] of [[-4, 'office'], [-7, 'academy'], [-10, 'embassy'], [-13, 'office']] as [number, BuildingKind][]) pair(kind, dx, -9);
  for (const [dx, kind] of [[-4, 'tower30'], [-7, 'office'], [-10, 'tower30'], [-13, 'hotel']] as [number, BuildingKind][]) pair(kind, dx, -13);
  for (const dx of [-11, -8, -5]) { pair('planter', dx, -8); pair('lamppost', dx, -9); pair('sapling', dx, -12); pair('sapling', dx, -13); }
  pair('flagpole', -2, -8); pair('flagpole', -2, -9); pair('clocktower', -2, -13); pair('flowerbed', -2, -12);
  // a garden walk behind the ministries
  for (let dx = -13; dx <= 13; dx++) for (const dz of [-11]) P(dx === -1 || dx === 0 ? 'flowerbed' : (dx & 1) ? 'sapling' : (dz === -11 ? 'bench' : 'flowerbed'), dx, dz);
  for (const dz of [-13, -12, -9, -8]) P('sapling', 13, dz);
  for (const dz of [-13, -12]) { P('flowerbed', -1, dz); P('flowerbed', 0, dz); }
  // the square: flags along the avenue, the great fountain, monuments, clock towers, ponds and gazebos
  for (let dx = -12; dx <= -2; dx += 2) pair('flagpole', dx, -6);
  P('lamppost', -13, -6); P('lamppost', 13, -6);
  for (let dx = -2; dx <= 1; dx++) for (const dz of [-1, 0]) P('fountain', dx, dz);
  for (let dx = -3; dx <= 2; dx++) { P('flowerbed', dx, -2); P('flowerbed', dx, 1); }
  for (const dz of [-1, 0]) { P('flowerbed', -3, dz); P('flowerbed', 2, dz); }
  pair('statue', -1, -4);
  pair('statue', -1, 4);
  pair('clocktower', -8, -3);
  pair('pond', -11, -3);
  pair('gazebo', -11, 2);
  for (const dz of [-1, 0]) pair('bench', -5, dz);
  for (const dx of [-6, -9, -12]) { pair('planter', dx, 0); pair('lamppost', dx, 4); }
  // the park south of the square and the city gate at its far end
  for (const [dx, dz] of [[-13, 6], [-9, 6], [-13, 10], [-9, 10]]) pair('bigpark', dx, dz);
  pair('playground', -5, 7); pair('playground', -5, 11); pair('kiosk', -4, 9);
  for (let dz = 6; dz <= 12; dz++) { pair('sapling', -6, dz); pair('lamppost', -2, dz); P('sapling', 13, dz); }
  pair('archway', -1, 13);
  for (let dz = -5; dz <= 13; dz++) P('sapling', 13, dz);
  const paved: Tile[] = [];
  // stone walks: the promenade on the axis, along the avenue, across the square and round the fountain
  for (let dz = -6; dz <= 13; dz++) for (let dx = -13; dx <= 13; dx++) {
    const promenade = dx >= -4 && dx <= 3 && dz <= 5, axis = dx >= -2 && dx <= 1;
    if (promenade || axis || dz === -5 || dz === 3) paved.push(at(dx, dz));
  }
  api.paths(paved, 2);
  // brick walks through the garden behind the ministries
  const garden: Tile[] = [];
  for (let dx = -13; dx <= 13; dx++) garden.push(at(dx, -10));
  api.paths(garden, 3);

  // ---------- the blocks round it ----------
  const commercial: BuildingKind[] = ['office', 'office', 'office', 'office', 'office', 'tower30', 'tower30', 'hotel', 'supermarket', 'restaurant', 'casino', 'concerthall', 'teahouse', 'garage', 'tower15', 'market', 'cinema'];
  const smallShops: [BuildingKind, BuildingKind][] = [['bank', 'pharmacy'], ['bank', 'metro'], ['clothes', 'barber'], ['gym', 'bakery'], ['metro', 'grocery'], ['bank', 'clothes'], ['dairyshop', 'pharmacy']];
  const special: Record<string, (x: number, z: number) => void> = {};
  const hospital = (x: number, z: number) => eight(x, z, ['hospital', ['pharmacy', 'police'], 'hospital', 'eldercare', ['firestation', 'busstop'], 'restaurant', ['pharmacy', 'kiosk'], 'parking'], () => centre(x + 2, z + 2, 'park'));
  for (const k of ['-5,-5', '4,-5', '-5,4', '4,4']) special[k] = hospital;
  special['-1,-5'] = (x, z) => quad(x, z, ['university', 'bigpark', 'college', 'academy']);
  special['0,-5'] = (x, z) => quad(x, z, ['bigpark', 'university', 'school', 'college']);
  special['5,-1'] = (x, z) => quad(x, z, ['stadium', 'parking', 'bigpark', 'gym']);
  special['5,0'] = (x, z) => quad(x, z, ['parking', 'stadium', 'playground', 'bigpark']);
  special['-6,-1'] = (x, z) => {
    put('themepark', x, z);
    for (const [dx, dz, kind] of [[4, 0, 'restaurant'], [4, 2, 'cinema'], [4, 4, 'parking'], [0, 4, 'parking'], [2, 4, 'teahouse']] as [number, number, BuildingKind][]) {
      if (!put(kind, x + dx, z + dz)) for (let d = 0; d < 4; d++) decor(x + dx + (d & 1), z + dz + (d >> 1));
    }
  };
  special['-6,0'] = (x, z) => quad(x, z, ['zoo', 'bigpark', 'bigpark', 'pond']);
  special['-1,4'] = (x, z) => quad(x, z, ['bigpark', 'bigpark', 'bigpark', 'bigpark']);
  special['0,4'] = (x, z) => quad(x, z, ['bigpark', 'bigpark', 'bigpark', 'bigpark']);
  special['-1,8'] = (x, z) => eight(x, z, ['trainstation', ['busstop', 'kiosk'], 'busdepot', 'parking', 'hotel', 'garage', ['metro', 'kiosk'], 'restaurant'], () => centre(x + 2, z + 2, 'fountain'));
  special['0,8'] = (x, z) => eight(x, z, ['busdepot', ['busstop', 'gasstation'], 'trainstation', 'hotel', 'parking', 'restaurant', ['metro', 'kiosk'], 'garage'], () => centre(x + 2, z + 2, 'fountain'));
  special['2,-3'] = (x, z) => eight(x, z, ['mosque', ['kiosk', 'bakery'], 'teahouse', 'restaurant', 'market', 'office', ['bank', 'metro'], 'hotel'], () => centre(x + 2, z + 2, 'fountain'));
  let community = 0;
  const communityCell = (x: number, z: number) => {
    const n = community++;
    eight(x, z, [
      'school', ['kindergarten', 'grocery'], 'supermarket', ['pharmacy', n % 2 ? 'police' : 'firestation'],
      n % 2 ? 'restaurant' : 'teahouse', ['gym', 'barber'], ['watertower', n % 3 ? 'busstop' : 'gasstation'],
      (['college', 'eldercare', 'mosque', 'market', 'cinema'] as BuildingKind[])[n % 5],
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
        // the business district: company offices, banks, hotels and towers
        if (rnd() < 0.45) quad(x, z, ['tower50', 'tower50', 'tower50', 'tower50']);
        else eight(x, z, P8.map((_, n) => (n === 1 || n === 6 ? pick(smallShops) : pick(commercial))));
        continue;
      }
      if (mod(i, 4) === 2 && mod(j, 4) === 2) { communityCell(x, z); continue; }
      if (mod(i, 4) === 0 && mod(j, 4) === 0 && mod(i + j, 8) === 0) {
        quad(x, z, rnd() < 0.5 ? ['bigpark', 'bigpark', 'bigpark', 'bigpark'] : ['bigpark', 'pond', 'playground', 'bigpark']);
        continue;
      }
      // housing: blocks of 50 flats, sometimes eight blocks of 30 round a little park
      if (rnd() < 0.86) quad(x, z, ['tower50', 'tower50', 'tower50', 'tower50']);
      else eight(x, z, P8.map(() => 'tower30' as BuildingKind), () => centre(x + 2, z + 2, pick(['park', 'pond', 'garden'])));
    }
  }

  // ---------- further out ----------
  // the industrial park: factories, warehouses and works
  for (let j = -2; j <= 1; j++) for (let i = 11; i <= 13; i++) {
    const x = line(i) + 1, z = line(j) + 1;
    if ((i + j) % 2 === 0) quad(x, z, [pick(['factory', 'carfactory', 'factory']), 'warehouse', 'warehouse', pick(['factory', 'carfactory'])]);
    else eight(x, z, ['warehouse', ['gasstation', 'kiosk'], 'sawmill', 'brickworks', 'construction', 'bikefactory', ['busstop', 'firestation'], i === 13 && j === 1 ? 'sewage' : pick(['mill', 'dairy', 'recycling', 'warehouse'])], () => centre(x + 2, z + 2, 'garden'));
  }
  // solar fields in the south-east corner, wind turbines along the eastern shore road
  for (let z = line(12) + 2; z + 1 < line(KF) - 1; z += 3) for (let x = line(12) + 2; x + 1 < line(KF) - 1; x += 3) put('solarfarm', x, z);
  for (let z = line(-KF) + 2; z < line(KF) - 1; z += 6) put('windturbine', line(KF) + 2, z);
  // the airport by the western ring road
  put('airport', line(-KF) + 1, C + 2);
  put('parking', line(-KF) + 1, C - 3);
  return homes;
}
