import * as THREE from 'three';
import { IS_TOUCH, LEVEL_H, WATER_BED, WATER_LEVEL } from '../config';
import { DIRS, N, idx } from './grid';
import type { WorldMap } from './WorldMap';
import { mulberry32 } from '../utils/rng';
import { bushGeometry, cactusGeometry, canopyGeometry, pineGeometry, rockGeometry, trunkGeometry, tuftGeometry } from '../models/nature';
import {
  AUTUMN_TINT, BARE, BLOSSOM, BUSH_DRY, BUSH_GREEN, C, FRESH, LEAF_AUTUMN, LEAF_GREEN, QuadBuilder, SNOWY, SPRING_TINT, TUFT_DRY, TUFT_FLOWER, TUFT_GRASS,
  TUNDRA, side, smoothstep,
} from './Terrain';
import { ROUND, WildTile, polarIce, riversOut, worldSample, wrapX } from './Wild';

const CHUNK = 64;
const SEA_BED = WATER_BED - 0.35;
const SEA = new THREE.Color('#2f7fb3'), DEEP = new THREE.Color('#1d5f8f');
type Season = { snow: number; autumn: number; bare: number; spring: number };

/** One 64 × 64 piece of the land beyond the map, built like the map itself. */
interface Piece {
  group: THREE.Group;
  ground: THREE.Mesh;
  base: Float32Array;
  top: Float32Array;
  cold: Float32Array;
  canopy?: THREE.InstancedMesh;
  green: THREE.Color[];
  autumn: THREE.Color[];
  tufts?: THREE.InstancedMesh;
}

/** The shared look (the same models and materials as the map's trees, rocks and grass). */
const GEO = { pine: pineGeometry(), trunk: trunkGeometry(), canopy: canopyGeometry(), rock: rockGeometry(), tuft: tuftGeometry(), cactus: cactusGeometry(), bush: bushGeometry() };

/**
 * The world beyond the map, made exactly like the map: tiles with their own colour, mountains in steps, lakes and the
 * sea with water over them, sandy shores, and the same trees, bushes, rocks, grass and cacti. Pieces are made around
 * the camera as it travels; the world goes round the planet, so going far enough one way brings you back home.
 */
export class Faraway {
  readonly group = new THREE.Group();
  private pieces = new Map<string, Piece>();
  private groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private plain = new THREE.MeshLambertMaterial({ vertexColors: true });
  private tinted = new THREE.MeshLambertMaterial();
  private tuftMat = new THREE.MeshLambertMaterial();
  private bushMat = new THREE.MeshLambertMaterial();
  private season: Season = { snow: 0, autumn: 0, bare: 0, spring: 0 };
  private rivers: ReturnType<typeof riversOut>;

  constructor(private map: WorldMap, private pineMat: THREE.Material, private waterMat: THREE.Material, reach: number) {
    this.rivers = riversOut(map, reach);
  }

  /** Make the pieces near the camera (`budget` per call) and drop the far ones. Camera at world x, z. */
  update(wx: number, wz: number, viewHalf: number, budget = 1) {
    const tx = wx + N / 2, tz = wz + N / 2;
    const r = Math.max(1, Math.ceil((viewHalf * 2.4) / CHUNK));
    const cx = Math.floor(tx / CHUNK), cz = Math.floor(tz / CHUNK);
    let made = 0;
    // nearest first
    const want: [number, number, number][] = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x0 = (cx + dx) * CHUNK, z0 = (cz + dz) * CHUNK;
      if (x0 >= 0 && z0 >= 0 && x0 + CHUNK <= N && z0 + CHUNK <= N) continue; // the map itself
      want.push([cx + dx, cz + dz, dx * dx + dz * dz]);
    }
    want.sort((a, b) => a[2] - b[2]);
    const keep = new Set<string>();
    for (const [x, z] of want) {
      const key = `${x},${z}`;
      keep.add(key);
      if (this.pieces.has(key) || made >= budget) continue;
      const p = this.make(x * CHUNK, z * CHUNK);
      this.pieces.set(key, p);
      made++;
    }
    for (const [key, p] of this.pieces) {
      if (keep.has(key)) continue;
      const [x, z] = key.split(',').map(Number);
      if (Math.abs(x - cx) <= r + 1 && Math.abs(z - cz) <= r + 1) continue;
      this.drop(p);
      this.pieces.delete(key);
    }
  }

  /** The camera came round the planet: the pieces move with it (one turn is a whole number of pieces). */
  shift(dxWorld: number) {
    const dc = Math.round(dxWorld / CHUNK);
    const next = new Map<string, Piece>();
    for (const [key, p] of this.pieces) {
      const [x, z] = key.split(',').map(Number);
      p.group.position.x += dxWorld;
      next.set(`${x + dc},${z}`, p);
    }
    this.pieces = next;
  }

  private drop(p: Piece) {
    this.group.remove(p.group);
    p.ground.geometry.dispose();
    p.group.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
  }

  private make(x0: number, z0: number): Piece {
    const S = CHUNK + 2;
    // one row of tiles all round, for the walls and the shores
    const water = new Uint8Array(S * S), h = new Uint8Array(S * S), top = new Float32Array(S * S), inMap = new Uint8Array(S * S);
    const ws: WildTile[] = new Array(S * S);
    const cols: THREE.Color[] = new Array(S * S);
    const R = this.rivers, map = this.map, seed = map.seed;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const v = j * S + i, tx = x0 + i - 1, tz = z0 + j - 1;
      if (tx >= 0 && tz >= 0 && tx < N && tz < N) {
        const k = idx(tx, tz);
        inMap[v] = 1; water[v] = map.water[k] ? 1 : 0; h[v] = map.height[k];
        top[v] = map.topY(k);
        continue;
      }
      const wx = Math.floor(wrapX(tx));
      const river = wx >= -R.off && tz >= -R.off && wx < N + R.off && tz < N + R.off && R.set.has(R.key(wx, tz));
      const w = {} as WildTile, c = new THREE.Color();
      worldSample(seed, tx + 0.5, tz + 0.5, river, c, w);
      ws[v] = w; cols[v] = c;
      water[v] = w.water; h[v] = w.water ? 0 : w.h;
      top[v] = w.water === 2 ? SEA_BED : w.water ? WATER_BED : w.h * LEVEL_H;
    }
    const b = new QuadBuilder(), wb = new QuadBuilder();
    const c = new THREE.Color(), tmp = new THREE.Color();
    const rnd = mulberry32((seed * 73856093) ^ (((x0 / CHUNK) % (ROUND / CHUNK) + ROUND) * 19349663) ^ (z0 * 83492791));
    const pines: THREE.Matrix4[] = [], leafy: THREE.Matrix4[] = [], rocks: [THREE.Matrix4, THREE.Color][] = [], tufts: [THREE.Matrix4, THREE.Color][] = [];
    const cacti: THREE.Matrix4[] = [], bushes: [THREE.Matrix4, THREE.Color][] = [];
    const green: THREE.Color[] = [], autumn: THREE.Color[] = [];
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const mat = (x: number, y: number, z: number, s: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rnd() * Math.PI * 2), new THREE.Vector3(s, s, s));
    const pick = (pal: string[]) => new THREE.Color(pal[Math.floor(rnd() * pal.length)]);
    const many = IS_TOUCH ? 0.6 : 1;
    for (let j = 1; j <= CHUNK; j++) for (let i = 1; i <= CHUNK; i++) {
      const v = j * S + i;
      if (inMap[v]) continue;
      const tx = x0 + i - 1, tz = z0 + j - 1, w = ws[v];
      const y = top[v];
      const x0w = tx - N / 2, z0w = tz - N / 2, x1w = x0w + 1, z1w = z0w + 1;
      const shore = !water[v] && (water[v - 1] || water[v + 1] || water[v - S] || water[v + S]);
      const ice = polarIce(tz);
      // the ground's colour, as the map paints it
      if (water[v] === 2) c.copy(SEA).lerp(DEEP, Math.min(1, -w.sea * 6)).multiplyScalar(0.8);
      else if (water[v]) c.copy(C.bed).multiplyScalar(0.92 + w.n * 0.12);
      else if (h[v] > 0) {
        if (h[v] >= 7) c.copy(C.snow);
        else if (h[v] >= 3) c.copy(C.rock).lerp(C.rockDark, w.n);
        else c.copy(C.rockLow).lerp(C.rock, (h[v] - 1) * 0.5 + w.n * 0.3);
      } else if (shore) c.copy(C.sand).multiplyScalar(0.96 + rnd() * 0.06);
      else {
        c.copy(C.grassA).lerp(C.grassB, w.n);
        c.lerp(C.dark, rnd() * 0.12);
        const st = smoothstep(0.52, 0.58, w.arid), de = smoothstep(0.6, 0.66, w.arid);
        if (st > 0) c.lerp(tmp.copy(C.steppeA).lerp(C.steppeB, w.n), st);
        if (de > 0) c.lerp(tmp.copy(C.desertA).lerp(C.desertB, w.n), de);
        const cd = smoothstep(0.3, 0.7, w.cold);
        if (cd > 0) c.lerp(TUNDRA, cd * 0.7);
      }
      if (ice > 0 && !water[v]) c.lerp(C.snow, ice);
      if ((tx + tz) & 1) c.multiplyScalar(0.985);
      b.quad([x0w, y, z0w], [x0w, y, z1w], [x1w, y, z1w], [x1w, y, z0w], c);
      // walls wherever the neighbour is lower (mountain steps, banks, the sea floor)
      for (const d of DIRS) {
        const nv = (j + d.dz) * S + (i + d.dx);
        const ny = top[nv];
        if (ny >= y - 1e-4) continue;
        if (h[v] > 0) {
          for (let yy = y; yy > ny + 1e-4; yy -= LEVEL_H) {
            const lo = Math.max(ny, yy - LEVEL_H), lvl = Math.round(yy / LEVEL_H);
            side(b, d.bit, x0w, z0w, x1w, z1w, yy, lo, tmp.copy(lvl >= 7 ? C.snow : C.rockDark).multiplyScalar(lvl % 2 ? 0.93 : 1));
          }
        } else side(b, d.bit, x0w, z0w, x1w, z1w, y, ny, C.dirt);
      }
      // water over lakes, rivers and the sea (it freezes with the map's in winter)
      if (water[v]) {
        wb.quad([x0w, WATER_LEVEL, z0w], [x0w, WATER_LEVEL, z1w], [x1w, WATER_LEVEL, z1w], [x1w, WATER_LEVEL, z0w], water[v] === 2 ? tmp.copy(C.water).lerp(DEEP, 0.35) : C.water);
        continue;
      }
      // trees, bushes, rocks and grass, as on the map
      const wx = x0w + 0.5, wz = z0w + 0.5;
      const jx = () => wx + (rnd() - 0.5) * 0.4, jz = () => wz + (rnd() - 0.5) * 0.4;
      if (ice > 0.5) continue;
      if (h[v] > 0) {
        if (h[v] <= 3 && rnd() < 0.35 * many) pines.push(mat(jx(), y, jz(), 0.7 + rnd() * 0.5));
        else if (h[v] < 7 && rnd() < 0.07) rocks.push([mat(jx(), y, jz(), 0.7 + rnd() * 0.8), rockColor(rnd)]);
        continue;
      }
      if (shore) { if (rnd() < 0.3 * many) tufts.push([mat(jx(), 0, jz(), 1 + rnd()), pick(TUFT_GRASS)]); continue; }
      const st = smoothstep(0.52, 0.58, w.arid), de = smoothstep(0.6, 0.66, w.arid);
      const chance = (w.forest > 0.6 ? 0.75 : w.forest > 0.52 ? 0.18 : 0.02) * (1 - st * 0.85) * (1 - de) * many;
      if (de > 0.5) {
        if (rnd() < 0.035) cacti.push(mat(jx(), 0, jz(), 0.8 + rnd() * 0.6));
        else if (rnd() < 0.04) rocks.push([mat(jx(), 0, jz(), 0.5 + rnd() * 0.7), new THREE.Color(0.75 + rnd() * 0.1, 0.66 + rnd() * 0.08, 0.5)]);
        else if (rnd() < 0.08 * many) tufts.push([mat(jx(), 0, jz(), 0.6 + rnd() * 0.5), pick(TUFT_DRY)]);
        continue;
      }
      if (rnd() < (st > 0.5 ? 0.06 : 0.025)) bushes.push([mat(jx(), 0, jz(), 0.7 + rnd() * 0.7), pick(st > 0.5 ? BUSH_DRY : BUSH_GREEN)]);
      if (rnd() < chance) {
        if (rnd() < (w.forest > 0.6 ? 0.55 : 0.35) + w.cold * 0.55) pines.push(mat(jx(), 0, jz(), 0.8 + rnd() * 0.5));
        else { const g = pick(LEAF_GREEN); leafy.push(mat(jx(), 0, jz(), 0.8 + rnd() * 0.4)); green.push(g); autumn.push(pick(LEAF_AUTUMN)); }
        continue;
      }
      if (rnd() < 0.03) rocks.push([mat(jx(), 0, jz(), 0.6 + rnd() * 0.8), rockColor(rnd)]);
      const nt = rnd() < 0.3 * many ? 1 + Math.floor(rnd() * 2) : 0;
      for (let k = 0; k < nt; k++) tufts.push([mat(wx + (rnd() - 0.5) * 0.9, 0, wz + (rnd() - 0.5) * 0.9, 0.7 + rnd() * 0.7), st > 0.5 ? pick(TUFT_DRY) : pick(rnd() < 0.15 ? TUFT_FLOWER : TUFT_GRASS)]);
    }
    const group = new THREE.Group();
    const geo = b.geometry();
    const ground = new THREE.Mesh(geo, this.groundMat);
    ground.receiveShadow = true;
    group.add(ground);
    const wgeo = wb.geometry();
    if (wgeo.attributes.position.count) { const wm = new THREE.Mesh(wgeo, this.waterMat); wm.renderOrder = 1; wm.receiveShadow = true; group.add(wm); }
    const add = (g: THREE.BufferGeometry, m: THREE.Material, list: (THREE.Matrix4 | [THREE.Matrix4, THREE.Color])[], cast: boolean) => {
      if (!list.length) return undefined;
      const im = new THREE.InstancedMesh(g, m, list.length);
      list.forEach((it, n) => { if (Array.isArray(it)) { im.setMatrixAt(n, it[0]); im.setColorAt(n, it[1]); } else im.setMatrixAt(n, it); });
      im.castShadow = cast && !IS_TOUCH;
      im.receiveShadow = true;
      group.add(im);
      return im;
    };
    add(GEO.pine, this.pineMat, pines, true);
    add(GEO.trunk, this.plain, leafy, true);
    const canopy = add(GEO.canopy, this.tinted, leafy.map((m, n) => [m, green[n].clone()] as [THREE.Matrix4, THREE.Color]), true);
    add(GEO.rock, this.tinted, rocks, true);
    const tuftMesh = add(GEO.tuft, this.tuftMat, tufts, false);
    add(GEO.cactus, this.plain, cacti, true);
    add(GEO.bush, this.bushMat, bushes, true);
    // the season's colours on the ground's tops
    const pos = geo.attributes.position.array as Float32Array, nor = geo.attributes.normal.array as Float32Array;
    const n = pos.length / 3, topMask = new Float32Array(n), coldMask = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      topMask[k] = nor[k * 3 + 1] > 0.9 && pos[k * 3 + 1] > -0.05 ? 1 : 0;
      const ti = Math.min(CHUNK, Math.max(1, Math.floor(pos[k * 3] + N / 2 - 0.001) - x0 + 1)), tj = Math.min(CHUNK, Math.max(1, Math.floor(pos[k * 3 + 2] + N / 2 - 0.001) - z0 + 1));
      coldMask[k] = ws[tj * S + ti]?.cold ?? 0;
    }
    const p: Piece = { group, ground, base: (geo.attributes.color.array as Float32Array).slice(), top: topMask, cold: coldMask, canopy, green, autumn, tufts: tuftMesh };
    this.paint(p);
    this.group.add(group);
    return p;
  }

  /** The same seasons as the map. */
  applySeason(b: Season) {
    const s = this.season;
    if (Math.abs(s.snow - b.snow) + Math.abs(s.autumn - b.autumn) + Math.abs(s.bare - b.bare) + Math.abs(s.spring - b.spring) < 0.02) return;
    this.season = { ...b };
    for (const p of this.pieces.values()) this.paint(p);
  }

  private paint(p: Piece) {
    const b = this.season;
    const attr = p.ground.geometry.attributes.color as THREE.BufferAttribute;
    const arr = attr.array as Float32Array, base = p.base;
    for (let i = 0; i < p.top.length; i++) {
      let r = base[i * 3], g = base[i * 3 + 1], bl = base[i * 3 + 2];
      if (p.top[i]) {
        const cold = Math.min(1, p.cold[i]);
        const a = b.autumn * 0.35 * (1 - cold * 0.5), sp = b.spring * 0.18 * (1 - cold), sn = Math.min(0.92, b.snow * 0.88 + cold * (b.bare * 0.75 + b.autumn * 0.35 + b.spring * 0.25));
        r += (AUTUMN_TINT.r - r) * a; g += (AUTUMN_TINT.g - g) * a; bl += (AUTUMN_TINT.b - bl) * a;
        r += (SPRING_TINT.r - r) * sp; g += (SPRING_TINT.g - g) * sp; bl += (SPRING_TINT.b - bl) * sp;
        r += (0.93 - r) * sn; g += (0.95 - g) * sn; bl += (0.97 - bl) * sn;
      }
      arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = bl;
    }
    attr.needsUpdate = true;
    if (p.canopy) {
      const c = new THREE.Color();
      for (let i = 0; i < p.green.length; i++) {
        c.copy(p.green[i]).lerp(p.autumn[i], b.autumn).lerp(BARE, b.bare * 0.85).lerp(SNOWY, b.snow * 0.6);
        if (b.spring > 0) c.lerp(i % 4 === 0 ? BLOSSOM : FRESH, b.spring * (i % 4 === 0 ? 0.75 : 0.25));
        p.canopy.setColorAt(i, c);
      }
      if (p.canopy.instanceColor) p.canopy.instanceColor.needsUpdate = true;
    }
    if (p.tufts) p.tufts.visible = b.snow < 0.4;
  }

  dispose() {
    for (const p of this.pieces.values()) this.drop(p);
    this.pieces.clear();
    for (const m of [this.groundMat, this.plain, this.tinted, this.tuftMat, this.bushMat]) m.dispose();
  }
}

function rockColor(rnd: () => number) { const g = 0.55 + rnd() * 0.15; return new THREE.Color(g, g, g * 1.03); }
