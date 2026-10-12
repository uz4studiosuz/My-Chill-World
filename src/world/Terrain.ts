import * as THREE from 'three';
import { DIRS, N, idx, inBounds, tileToWorld } from './grid';
import { WorldMap } from './WorldMap';
import { LEVEL_H, WATER_BED, WATER_LEVEL } from '../config';
import { fbm, mulberry32 } from '../utils/rng';
import { TREE_PARTS } from '../buildings/BuildingTypes';
import { bushGeometry, cactusGeometry, canopyGeometry, pineGeometry, rockGeometry, trunkGeometry, tuftGeometry } from '../models/nature';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const MAP_BOTTOM = -2.5;

interface DecorItem { m: THREE.Matrix4; tile: number; color?: THREE.Color }
interface DecorRef { mesh: THREE.InstancedMesh; index: number; tree: boolean; m: THREE.Matrix4 }

const REGROW_DAYS = 6;

const LEAF_GREEN = ['#5f9a3e', '#6faa45', '#4f8a3a', '#7bb24c'];
const LEAF_AUTUMN = ['#e0822f', '#e9b23a', '#c95a2b', '#d99a2e', '#b8862f'];
const AUTUMN_TINT = new THREE.Color('#b7a258');
const SPRING_TINT = new THREE.Color('#79c04a');
const BARE = new THREE.Color('#7d6b55');
const SNOWY = new THREE.Color('#eef3f6');
const TUFT_GRASS = ['#7da84a', '#6c9a40', '#93b858', '#86ad4e'];
const TUFT_FLOWER = ['#f2efe2', '#f0d54a', '#b9a3e0', '#e8738f', '#f29b4b'];
const TUFT_DRY = ['#c2b46a', '#b3a35a', '#d0c27c', '#a89a58'];
const BUSH_GREEN = ['#5f8f3a', '#6c9a40', '#4f7d34'];
const BUSH_DRY = ['#9a8a4e', '#8a7a46', '#a8975a'];
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const C = {
  grassA: new THREE.Color('#8cb156'),
  grassB: new THREE.Color('#a4c064'),
  dry: new THREE.Color('#bdb873'),
  dark: new THREE.Color('#759e48'),
  sand: new THREE.Color('#d9c99a'),
  steppeA: new THREE.Color('#b8b06a'),
  steppeB: new THREE.Color('#a8a25c'),
  desertA: new THREE.Color('#e2cc92'),
  desertB: new THREE.Color('#d5ba7c'),
  bed: new THREE.Color('#b0a479'),
  dirt: new THREE.Color('#8a6a46'),
  rockLow: new THREE.Color('#8f9a6a'),
  rock: new THREE.Color('#9b978e'),
  rockDark: new THREE.Color('#827f78'),
  snow: new THREE.Color('#f2f4f6'),
  water: new THREE.Color('#3f93c4'),
};

/** Ground (with mountains and water) + procedural decoration. */
export class Terrain {
  private tmpCol = new THREE.Color();
  readonly group = new THREE.Group();
  readonly cleared = new Uint8Array(N * N);
  private decorByTile = new Map<number, DecorRef[]>();
  /** Tiles with a standing tree. */
  readonly trees = new Set<number>();
  /** Felled trees: tile -> days until it grows back. */
  readonly stumps = new Map<number, number>();
  /** Trees partly chopped: tile -> parts left. */
  private treeHp = new Map<number, number>();

  // seasonal look
  private ground?: THREE.Mesh;
  private waterMesh?: THREE.Mesh;
  private baseColors = new Float32Array(0);
  private topMask = new Float32Array(0);
  private pineMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.82 });
  private canopy?: THREE.InstancedMesh;
  private tuftMesh?: THREE.InstancedMesh;
  private leafGreen: THREE.Color[] = [];
  private leafAutumn: THREE.Color[] = [];
  private lastSeason = '';

  constructor(private map: WorldMap) {
    this.buildGround();
    this.buildWater();
    this.buildDecor();
  }

  /** Remove decoration from tiles (e.g. when a road or building is placed). */
  clearTiles(tiles: number[]) {
    const touched = new Set<THREE.InstancedMesh>();
    for (const k of tiles) {
      if (this.cleared[k]) continue;
      this.cleared[k] = 1;
      this.trees.delete(k);
      this.stumps.delete(k);
      for (const r of this.decorByTile.get(k) ?? []) {
        r.mesh.setMatrixAt(r.index, HIDDEN);
        touched.add(r.mesh);
      }
    }
    touched.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }

  treesNear(x: number, z: number, r: number) {
    let n = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const tx = x + dx, tz = z + dz;
      if (tx >= 0 && tz >= 0 && tx < N && tz < N && this.trees.has(idx(tx, tz))) n++;
    }
    return n;
  }

  /** Closest standing tree within r tiles that isn't in `skip`. */
  nearestTree(x: number, z: number, r: number, skip: Set<number>) {
    let best = -1, bd = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const tx = x + dx, tz = z + dz;
      if (tx < 0 || tz < 0 || tx >= N || tz >= N) continue;
      const k = idx(tx, tz);
      if (!this.trees.has(k) || skip.has(k)) continue;
      const d = Math.abs(dx) + Math.abs(dz) + Math.random() * 0.5;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /** Fell the tree on tile k — it grows back after a few days. */
  chop(k: number) {
    if (!this.trees.delete(k)) return;
    this.stumps.set(k, REGROW_DAYS);
    this.setTreeVisible(k, false);
  }

  /** Called once per day. */
  regrow() {
    for (const [k, d] of this.stumps) {
      if (d > 1) { this.stumps.set(k, d - 1); continue; }
      this.stumps.delete(k);
      if (this.cleared[k]) continue;
      this.treeHp.delete(k);
      this.trees.add(k);
      this.setTreeVisible(k, true);
    }
  }

  private setTreeVisible(k: number, on: boolean) {
    const touched = new Set<THREE.InstancedMesh>();
    for (const r of this.decorByTile.get(k) ?? []) {
      if (!r.tree) continue;
      r.mesh.setMatrixAt(r.index, on ? r.m : HIDDEN);
      touched.add(r.mesh);
    }
    touched.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }

  stumpList(): [number, number][] {
    return [...this.stumps];
  }

  loadStumps(list: [number, number][] = []) {
    for (const [k, d] of list) {
      if (!this.trees.has(k)) continue;
      this.chop(k);
      this.stumps.set(k, d);
    }
  }

  clearedList(): number[] {
    const out: number[] = [];
    for (let k = 0; k < this.cleared.length; k++) if (this.cleared[k]) out.push(k);
    return out;
  }

  private buildGround() {
    const map = this.map;
    const b = new QuadBuilder();
    const rnd = mulberry32(map.seed);
    const c = new THREE.Color();
    const seed = map.seed;

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const k = idx(x, z);
        const h = map.height[k];
        const y = map.topY(k);
        const n = fbm(x * 0.08, z * 0.08, seed);

        if (map.water[k]) {
          c.copy(C.bed).multiplyScalar(0.92 + n * 0.12);
        } else if (h > 0) {
          if (h >= 7) c.copy(C.snow);
          else if (h >= 3) c.copy(C.rock).lerp(C.rockDark, n);
          else c.copy(C.rockLow).lerp(C.rock, (h - 1) * 0.5 + n * 0.3);
        } else if (map.isShore(x, z)) {
          c.copy(C.sand).multiplyScalar(0.96 + rnd() * 0.06);
        } else {
          const m = fbm(x * 0.03 + 50, z * 0.03, seed + 7);
          c.copy(C.grassA).lerp(C.grassB, n);
          if (m > 0.58) c.lerp(C.dry, Math.min(1, (m - 0.58) * 2.5));
          c.lerp(C.dark, rnd() * 0.12);
          const ar = map.arid[k];
          const st = smoothstep(0.52, 0.58, ar), de = smoothstep(0.6, 0.66, ar);
          if (st > 0) c.lerp(this.tmpCol.copy(C.steppeA).lerp(C.steppeB, n), st);
          if (de > 0) c.lerp(this.tmpCol.copy(C.desertA).lerp(C.desertB, n), de);
        }
        if ((x + z) & 1) c.multiplyScalar(0.985);

        const x0 = x - N / 2, z0 = z - N / 2, x1 = x0 + 1, z1 = z0 + 1;
        b.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], c);

        // Side walls wherever the neighbour is lower (mountain steps, river banks, map edge)
        for (const d of DIRS) {
          const nx = x + d.dx, nz = z + d.dz;
          const ny = inBounds(nx, nz) ? map.topY(idx(nx, nz)) : MAP_BOTTOM;
          if (ny >= y - 1e-4) continue;
          if (h > 0) {
            // one band per mountain level, alternating shade for the voxel look
            for (let yy = y; yy > ny + 1e-4; yy -= LEVEL_H) {
              const lo = Math.max(ny, yy - LEVEL_H);
              const lvl = Math.round(yy / LEVEL_H);
              const col = (lvl >= 7 ? C.snow : C.rockDark).clone().multiplyScalar(lvl % 2 ? 0.93 : 1);
              side(b, d.bit, x0, z0, x1, z1, yy, lo, col);
            }
          } else {
            side(b, d.bit, x0, z0, x1, z1, y, ny, C.dirt);
          }
        }
      }
    }
    if (this.ground) {
      this.group.remove(this.ground);
      this.ground.geometry.dispose();
    }
    const geo = b.geometry();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.receiveShadow = true;
    this.group.add(ground);
    this.ground = ground;
    const pos = geo.attributes.position.array as Float32Array;
    const nor = geo.attributes.normal.array as Float32Array;
    this.baseColors = (geo.attributes.color.array as Float32Array).slice();
    this.topMask = new Float32Array(pos.length / 3);
    for (let i = 0; i < this.topMask.length; i++) this.topMask[i] = nor[i * 3 + 1] > 0.9 && pos[i * 3 + 1] > -0.05 ? 1 : 0;
    this.lastSeason = '';
  }

  private buildWater() {
    const b = new QuadBuilder();
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (!this.map.water[idx(x, z)]) continue;
        const x0 = x - N / 2, z0 = z - N / 2, x1 = x0 + 1, z1 = z0 + 1, y = WATER_LEVEL;
        b.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], C.water);
        for (const d of DIRS) {
          if (!inBounds(x + d.dx, z + d.dz)) side(b, d.bit, x0, z0, x1, z1, y, WATER_BED, C.water);
        }
      }
    }
    if (this.waterMesh) {
      this.group.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
    }
    const water = new THREE.Mesh(b.geometry(), this.waterMat);
    water.receiveShadow = true;
    water.renderOrder = 1;
    this.group.add(water);
    this.waterMesh = water;
  }

  /** Rebuild ground and water after the map was reshaped (god tools). */
  reshape(changed: number[]) {
    this.clearTiles(changed);
    this.buildGround();
    this.buildWater();
  }

  /** Blend ground, trees and water towards the current season. */
  applySeason(b: { snow: number; autumn: number; bare: number; spring: number }) {
    const key = [b.snow, b.autumn, b.bare, b.spring].map((v) => v.toFixed(2)).join();
    if (key === this.lastSeason || !this.ground) return;
    this.lastSeason = key;

    const col = this.ground.geometry.attributes.color as THREE.BufferAttribute;
    const arr = col.array as Float32Array;
    const base = this.baseColors, mask = this.topMask;
    const tint = AUTUMN_TINT, spring = SPRING_TINT;
    for (let i = 0; i < mask.length; i++) {
      let r = base[i * 3], g = base[i * 3 + 1], bl = base[i * 3 + 2];
      const m = mask[i];
      if (m) {
        const a = b.autumn * 0.35, sp = b.spring * 0.18, sn = b.snow * 0.88;
        r += (tint.r - r) * a; g += (tint.g - g) * a; bl += (tint.b - bl) * a;
        r += (spring.r - r) * sp; g += (spring.g - g) * sp; bl += (spring.b - bl) * sp;
        r += (0.93 - r) * sn; g += (0.95 - g) * sn; bl += (0.97 - bl) * sn;
      }
      arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = bl;
    }
    col.needsUpdate = true;

    if (this.canopy) {
      const c = new THREE.Color();
      for (let i = 0; i < this.leafGreen.length; i++) {
        c.copy(this.leafGreen[i]).lerp(this.leafAutumn[i], b.autumn).lerp(BARE, b.bare * 0.85).lerp(SNOWY, b.snow * 0.6);
        this.canopy.setColorAt(i, c);
      }
      if (this.canopy.instanceColor) this.canopy.instanceColor.needsUpdate = true;
    }
    this.pineMat.emissive.setRGB(0.3 * b.snow, 0.32 * b.snow, 0.34 * b.snow);
    this.waterMat.emissive.setRGB(0.35 * b.snow, 0.42 * b.snow, 0.48 * b.snow);
    if (this.tuftMesh) this.tuftMesh.visible = b.snow < 0.4;
  }

  /** Chop part of a tree. Returns true when the whole tree is down. */
  chopPart(k: number) {
    if (!this.trees.has(k)) return true;
    const left = (this.treeHp.get(k) ?? TREE_PARTS) - 1;
    if (left <= 0) {
      this.treeHp.delete(k);
      this.chop(k);
      return true;
    }
    this.treeHp.set(k, left);
    const f = left / TREE_PARTS;
    const touched = new Set<THREE.InstancedMesh>();
    for (const r of this.decorByTile.get(k) ?? []) {
      if (!r.tree) continue;
      r.mesh.setMatrixAt(r.index, r.m.clone().multiply(new THREE.Matrix4().makeScale(1, 0.25 + 0.75 * f, 1)));
      touched.add(r.mesh);
    }
    touched.forEach((m) => (m.instanceMatrix.needsUpdate = true));
    return false;
  }

  hasTree(k: number) { return this.trees.has(k); }

  private buildDecor() {
    const map = this.map, seed = map.seed;
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    const pines: DecorItem[] = [], leafy: DecorItem[] = [], rocks: DecorItem[] = [], tufts: DecorItem[] = [], cacti: DecorItem[] = [], bushes: DecorItem[] = [];
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const mat = (x: number, y: number, z: number, s: number) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rnd() * Math.PI * 2), new THREE.Vector3(s, s, s));
    const pick = (pal: string[]) => new THREE.Color(pal[Math.floor(rnd() * pal.length)]);
    this.leafGreen = [];
    this.leafAutumn = [];
    const rockColor = () => { const g = 0.55 + rnd() * 0.15; return new THREE.Color(g, g, g * 1.03); };

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const k = idx(x, z);
        if (map.water[k]) continue;
        const h = map.height[k];
        const y = map.topY(k);
        const wx = tileToWorld(x), wz = tileToWorld(z);
        const jx = () => wx + (rnd() - 0.5) * 0.4, jz = () => wz + (rnd() - 0.5) * 0.4;

        if (h > 0) {
          if (h <= 3 && rnd() < 0.35) pines.push({ m: mat(jx(), y, jz(), 0.7 + rnd() * 0.5), tile: k });
          else if (h < 7 && rnd() < 0.07) rocks.push({ m: mat(jx(), y, jz(), 0.7 + rnd() * 0.8), tile: k, color: rockColor() });
          continue;
        }

        if (map.isShore(x, z)) {
          if (rnd() < 0.4) tufts.push({ m: mat(jx(), 0, jz(), 1 + rnd()), tile: k, color: pick(TUFT_GRASS) });
          continue;
        }

        const forest = fbm(x * 0.07 + 100, z * 0.07 + 100, seed + 3);
        const centre = Math.hypot(x - N / 2, z - N / 2) < 14 ? 0.15 : 1;
        const ar = map.arid[k];
        const steppe = smoothstep(0.52, 0.58, ar), desert = smoothstep(0.6, 0.66, ar);
        const treeChance = (forest > 0.6 ? 0.75 : forest > 0.52 ? 0.18 : 0.02) * centre * (1 - steppe * 0.85) * (1 - desert);
        if (desert > 0.5) {
          if (rnd() < 0.035 * centre) cacti.push({ m: mat(jx(), 0, jz(), 0.8 + rnd() * 0.6), tile: k });
          else if (rnd() < 0.04) rocks.push({ m: mat(jx(), 0, jz(), 0.5 + rnd() * 0.7), tile: k, color: new THREE.Color(0.75 + rnd() * 0.1, 0.66 + rnd() * 0.08, 0.5) });
          else if (rnd() < 0.08) tufts.push({ m: mat(jx(), 0, jz(), 0.6 + rnd() * 0.5), tile: k, color: pick(TUFT_DRY) });
          continue;
        }
        if (rnd() < (steppe > 0.5 ? 0.06 : 0.025) * centre) {
          bushes.push({ m: mat(jx(), 0, jz(), 0.7 + rnd() * 0.7), tile: k, color: pick(steppe > 0.5 ? BUSH_DRY : BUSH_GREEN) });
        }

        if (rnd() < treeChance) {
          if (rnd() < (forest > 0.6 ? 0.55 : 0.35)) {
            pines.push({ m: mat(jx(), 0, jz(), 0.8 + rnd() * 0.5), tile: k });
          } else {
            const green = pick(LEAF_GREEN);
            leafy.push({ m: mat(jx(), 0, jz(), 0.8 + rnd() * 0.4), tile: k, color: green });
            this.leafGreen.push(green.clone());
            this.leafAutumn.push(pick(LEAF_AUTUMN));
          }
          continue;
        }
        const nearMountain = map.mountainsNear(x, z, 2) > 0;
        if (rnd() < (nearMountain ? 0.12 : 0.02)) {
          rocks.push({ m: mat(jx(), 0, jz(), 0.6 + rnd() * 0.8), tile: k, color: rockColor() });
        }
        const nt = rnd() < 0.4 ? 1 + Math.floor(rnd() * 3) : 0;
        for (let i = 0; i < nt; i++) {
          tufts.push({
            m: mat(wx + (rnd() - 0.5) * 0.9, 0, wz + (rnd() - 0.5) * 0.9, 0.7 + rnd() * 0.7),
            tile: k,
            color: steppe > 0.5 ? pick(TUFT_DRY) : pick(rnd() < (forest < 0.4 ? 0.3 : 0.12) ? TUFT_FLOWER : TUFT_GRASS),
          });
        }
      }
    }

    const vertexColored = new THREE.MeshLambertMaterial({ vertexColors: true });
    const tinted = new THREE.MeshLambertMaterial();

    const pineGeo = pineGeometry();
    const trunkGeo = trunkGeometry();
    const canopyGeo = canopyGeometry();
    const rockGeo = rockGeometry();
    const tuftGeo = tuftGeometry();

    this.instances(pineGeo, this.pineMat, pines, true, false, true);
    this.instances(trunkGeo, vertexColored, leafy, true, false, true);
    this.canopy = this.instances(canopyGeo, tinted, leafy, true, true, true);
    this.instances(rockGeo, tinted, rocks, true, true);
    this.tuftMesh = this.instances(tuftGeo, new THREE.MeshLambertMaterial(), tufts, false, true);
    this.instances(cactusGeometry(), vertexColored, cacti, true, false);
    this.instances(bushGeometry(), new THREE.MeshLambertMaterial(), bushes, true, true);
    for (const it of [...pines, ...leafy]) if (this.map.height[it.tile] <= 3) this.trees.add(it.tile);
  }

  private instances(geo: THREE.BufferGeometry, mat: THREE.Material, items: DecorItem[], cast: boolean, useColor: boolean, tree = false) {
    if (!items.length) return undefined;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      if (useColor) mesh.setColorAt(i, it.color ?? new THREE.Color('#ffffff'));
      let refs = this.decorByTile.get(it.tile);
      if (!refs) this.decorByTile.set(it.tile, (refs = []));
      refs.push({ mesh, index: i, tree, m: it.m });
    });
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }
}

/** Accumulates flat-shaded quads; normal is derived from the winding (a,b,c). */
class QuadBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private va = new THREE.Vector3();
  private vb = new THREE.Vector3();

  quad(a: number[], b: number[], c: number[], d: number[], color: THREE.Color) {
    this.va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    this.vb.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = this.va.cross(this.vb).normalize();
    for (const p of [a, b, c, a, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(color.r, color.g, color.b);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

/** Vertical wall on one edge of a tile, facing outwards in direction `bit`. */
function side(b: QuadBuilder, bit: number, x0: number, z0: number, x1: number, z1: number, top: number, bot: number, c: THREE.Color) {
  switch (bit) {
    case 1: b.quad([x0, top, z0], [x1, top, z0], [x1, bot, z0], [x0, bot, z0], c); break;
    case 4: b.quad([x1, top, z1], [x0, top, z1], [x0, bot, z1], [x1, bot, z1], c); break;
    case 2: b.quad([x1, top, z0], [x1, top, z1], [x1, bot, z1], [x1, bot, z0], c); break;
    case 8: b.quad([x0, top, z1], [x0, top, z0], [x0, bot, z0], [x0, bot, z1], c); break;
  }
}
