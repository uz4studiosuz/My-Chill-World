import * as THREE from 'three';
import { LEVEL_H, WATER_LEVEL } from '../config';
import { N, idx } from './grid';
import type { WorldMap } from './WorldMap';
import { LAKE_COLOR, WildFields, WildTile, groundColor, riversOut, wildFields, worldSample, wrapX } from './Wild';
import { fbm, mulberry32 } from '../utils/rng';

/** How far the land goes on around the map (tiles), and the size of one of its cells. */
export const REACH = 64;
/** How far the rivers are followed out of the map (tiles). */
export const RIVER_REACH = 220;
const STEP = 2;
const AUTUMN = new THREE.Color('#b7a258'), SPRING = new THREE.Color('#79c04a');

/**
 * The land around the map, so the world has no edge: the same meadows, lakes, hills and rivers carried on to the
 * horizon (nothing can be built there). It follows the seasons like the map: snow in winter, gold in autumn.
 */
export class Skirt {
  readonly mesh: THREE.Mesh;
  /** The rivers flowing out of the map (shared with the faraway land). */
  readonly rivers: ReturnType<typeof riversOut>;
  /** Woods outside the map (simple pines and round trees). */
  readonly trees: THREE.InstancedMesh;
  private treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private base: Float32Array;
  private cold: Float32Array;
  private land: Uint8Array;
  private last = '';
  /** For every drawn corner, the grid point whose colour it takes. */
  private src: Uint32Array;

  constructor(map: WorldMap) {
    const n = (N + REACH * 2) / STEP + 1;
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    this.base = col.slice();
    this.cold = new Float32Array(n * n);
    this.land = new Uint8Array(n * n);
    const inner = new Uint8Array(n * n);
    const rivers = this.rivers = riversOut(map, RIVER_REACH);
    const f = {} as WildFields, w = {} as WildTile, c = new THREE.Color();
    const seed = map.seed;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = j * n + i;
        const tx = -REACH + i * STEP, tz = -REACH + j * STEP;
        let y: number;
        if (tx >= 0 && tz >= 0 && tx <= N && tz <= N) {
          // on (or inside) the map: its own ground, so the edge meets the land outside seamlessly
          const x = Math.min(N - 1, tx), z = Math.min(N - 1, tz);
          const k = idx(x, z);
          inner[v] = tx > 1 && tz > 1 && tx < N - 1 && tz < N - 1 ? 1 : 0;
          if (map.water[k]) { c.copy(LAKE_COLOR); y = WATER_LEVEL - 0.02; }
          else {
            groundColor(map.height[k], map.arid[k], map.cold[k], fbm(x * 0.08, z * 0.08, seed), fbm(x * 0.07 + 100, z * 0.07 + 100, seed + 3), c);
            y = map.height[k] * LEVEL_H - 0.01;
            this.land[v] = 1;
          }
          this.cold[v] = map.cold[k];
          if (inner[v]) y = -1.2;
        } else {
          worldSample(seed, tx, tz, rivers.set.has(rivers.key(tx, tz)), c, w);
          y = w.water ? WATER_LEVEL - (w.water === 2 ? 0.05 : 0.02) : w.h * LEVEL_H * 0.85;
          if (!w.water) this.land[v] = 1;
          this.cold[v] = w.cold;
          // a little shade with distance, as the land fades towards the horizon
          const far = Math.max(Math.max(-tx, tx - N), Math.max(-tz, tz - N), 0);
          c.multiplyScalar(1 - Math.min(0.12, far / 1600));
        }
        pos.set([tx - N / 2, y, tz - N / 2], v * 3);
        c.toArray(col, v * 3);
      }
    }
    this.base.set(col);
    const index: number[] = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
      if (inner[a] && inner[b] && inner[d] && inner[e]) continue;
      index.push(a, d, b, b, d, e);
    }
    const { geo, src } = blocky(pos, col, index);
    this.src = src;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = false;
    this.mesh.name = 'skirt';
    // woods: where the noise makes forest on the map, trees stand outside it too (thinner far away)
    const spots: number[] = [];
    const rnd = mulberry32(seed * 7 + 3);
    for (let z = -REACH; z < N + REACH; z++) for (let x = -REACH; x < N + REACH; x++) {
      if (x >= 0 && z >= 0 && x < N && z < N) continue;
      const fo = fbm(x * 0.07 + 100, z * 0.07 + 100, seed + 3);
      if (fo < 0.52) continue;
      const far = Math.max(-x, x - N + 1, -z, z - N + 1);
      const chance = (fo > 0.6 ? 0.55 : 0.12) * (1 - far / (REACH * 1.6));
      if (rnd() > chance) continue;
      wildFields(seed, x, z, f);
      if (f.sea < 0.02 || f.lake > 0.66 || rivers.set.has(rivers.key(x, z)) || Math.max(0, Math.min(1, f.arid)) > 0.55) continue;
      const m = Math.max(0, (f.mount - 0.58) / 0.3);
      const h = Math.min(10, Math.floor(m * 9 * (0.75 + 0.5 * f.detail)));
      if (h >= 3) continue;
      spots.push(x + 0.2 + rnd() * 0.6, z + 0.2 + rnd() * 0.6, h * LEVEL_H * 0.85, 0.7 + rnd() * 0.6, f.cold);
    }
    const pine = new THREE.ConeGeometry(0.34, 0.95, 6).translate(0, 0.62, 0);
    const trunk = new THREE.CylinderGeometry(0.06, 0.07, 0.2, 5).translate(0, 0.1, 0);
    const paint = (g: THREE.BufferGeometry, hex: string) => { const cc = new THREE.Color(hex); const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) cc.toArray(a, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const geo2 = mergeTwo(paint(pine, '#ffffff'), paint(trunk, '#6b4a2e'));
    const count = spots.length / 5;
    this.trees = new THREE.InstancedMesh(geo2, this.treeMat, count);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
    const green = [new THREE.Color('#3f6f34'), new THREE.Color('#4d7f3a'), new THREE.Color('#35602e')];
    for (let i = 0; i < count; i++) {
      const [x, z, y, s, cold] = spots.slice(i * 5, i * 5 + 5);
      p3.set(x - N / 2, y, z - N / 2); sc.set(s, s, s);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
      this.trees.setMatrixAt(i, mx.compose(p3, q, sc));
      this.trees.setColorAt(i, green[i % 3].clone().lerp(new THREE.Color('#5d7f6a'), Math.min(1, cold) * 0.5));
    }
    this.trees.instanceMatrix.needsUpdate = true;
    this.trees.castShadow = false;
    this.mesh.add(this.trees);
  }

  /** The same seasons as the map's ground. */
  applySeason(b: { snow: number; autumn: number; bare: number; spring: number }) {
    const key = [b.snow, b.autumn, b.bare, b.spring].map((v) => v.toFixed(2)).join();
    if (key === this.last) return;
    this.last = key;
    const attr = this.mesh.geometry.attributes.color as THREE.BufferAttribute;
    const arr = attr.array as Float32Array, base = this.base;
    for (let q = 0; q < this.src.length; q++) {
      const v = this.src[q];
      let r = base[v * 3], g = base[v * 3 + 1], bl = base[v * 3 + 2];
      if (this.land[v]) {
        const cold = this.cold[v];
        const a = b.autumn * 0.35 * (1 - cold * 0.5), sp = b.spring * 0.18 * (1 - cold), sn = Math.min(0.92, b.snow * 0.88 + cold * (b.bare * 0.75 + b.autumn * 0.35 + b.spring * 0.25));
        r += (AUTUMN.r - r) * a; g += (AUTUMN.g - g) * a; bl += (AUTUMN.b - bl) * a;
        r += (SPRING.r - r) * sp; g += (SPRING.g - g) * sp; bl += (SPRING.b - bl) * sp;
        r += (0.93 - r) * sn; g += (0.95 - g) * sn; bl += (0.97 - bl) * sn;
      } else if (b.snow > 0.55) { r += (0.85 - r) * 0.5; g += (0.9 - g) * 0.5; bl += (0.95 - bl) * 0.5; }
      arr[q * 3] = r; arr[q * 3 + 1] = g; arr[q * 3 + 2] = bl;
    }
    attr.needsUpdate = true;
    // snow on the pines in winter
    this.treeMat.emissive.setRGB(0.3 * b.snow, 0.32 * b.snow, 0.34 * b.snow);
  }

  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.trees.geometry.dispose(); this.treeMat.dispose(); }
}

/** Two geometries as one (positions, normals and colours). */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const A = a.toNonIndexed(), B = b.toNonIndexed();
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const x = A.attributes[name].array as Float32Array, y = B.attributes[name].array as Float32Array;
    const arr = new Float32Array(x.length + y.length);
    arr.set(x); arr.set(y, x.length);
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

const CHUNK = 64;
const AUTUMN_C = AUTUMN, SPRING_C = SPRING;

/** One piece of the faraway land, made when the camera comes near and dropped when it leaves. */
interface Chunk { mesh: THREE.Mesh; base: Float32Array; land: Uint8Array; cold: Float32Array; src: Uint32Array }

/**
 * The rest of the world, around the land next to the map: pieces of 64 × 64 tiles made around the camera as it
 * travels, so the world never ends — go far enough one way and you come round the planet back to your town.
 */
export class WildChunks {
  readonly group = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private season = { snow: 0, autumn: 0, bare: 0, spring: 0 };

  constructor(private seed: number, private rivers: ReturnType<typeof riversOut>) {}

  /** Make the pieces near the camera (a couple per frame) and drop the far ones. Camera at world x, z. */
  update(wx: number, wz: number, viewHalf: number, budget = 2) {
    const tx = wx + N / 2, tz = wz + N / 2;
    const r = Math.min(4, Math.ceil((viewHalf * 3.2) / CHUNK) + 1);
    const cx = Math.floor(tx / CHUNK), cz = Math.floor(tz / CHUNK);
    let made = 0;
    const want = new Set<string>();
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x0 = (cx + dx) * CHUNK, z0 = (cz + dz) * CHUNK;
      // the land next to the map is drawn by the skirt
      if (x0 >= -REACH && z0 >= -REACH && x0 + CHUNK <= N + REACH && z0 + CHUNK <= N + REACH) continue;
      const key = `${cx + dx},${cz + dz}`;
      want.add(key);
      if (this.chunks.has(key) || made >= budget) continue;
      this.chunks.set(key, this.make(x0, z0));
      made++;
    }
    for (const [key, c] of this.chunks) {
      if (want.has(key)) continue;
      const [x, z] = key.split(',').map(Number);
      if (Math.abs(x - cx) <= r + 1 && Math.abs(z - cz) <= r + 1) continue;
      this.group.remove(c.mesh);
      c.mesh.geometry.dispose();
      this.chunks.delete(key);
    }
  }

  private make(x0: number, z0: number): Chunk {
    const n = CHUNK / STEP + 1;
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    const land = new Uint8Array(n * n), cold = new Float32Array(n * n), hidden = new Uint8Array(n * n);
    const c = new THREE.Color(), w = {} as WildTile;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = j * n + i, tx = x0 + i * STEP, tz = z0 + j * STEP;
      // inside the skirt's square (and the map) this piece stays out of sight
      const inside = tx > -REACH && tz > -REACH && tx < N + REACH && tz < N + REACH;
      const R = this.rivers, river = tx >= -R.off && tz >= -R.off && tx < N + R.off && tz < N + R.off && R.set.has(R.key(tx, tz));
      worldSample(this.seed, tx, tz, river, c, w);
      const y = inside ? -3 : w.water ? WATER_LEVEL - (w.water === 2 ? 0.05 : 0.02) : w.h * LEVEL_H * 0.85;
      hidden[v] = inside ? 1 : 0;
      land[v] = w.water ? 0 : 1;
      cold[v] = w.cold;
      pos.set([tx - N / 2, y, tz - N / 2], v * 3);
      c.toArray(col, v * 3);
    }
    const index: number[] = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
      if (hidden[a] || hidden[b] || hidden[d] || hidden[e]) continue;
      index.push(a, d, b, b, d, e);
    }
    const { geo, src } = blocky(pos, col, index);
    const mesh = new THREE.Mesh(geo, this.mat);
    const ch = { mesh, base: col.slice(), land, cold, src };
    this.paint(ch);
    this.group.add(mesh);
    return ch;
  }

  /** The camera came round the planet: the pieces move with it (one turn is a whole number of pieces). */
  shift(dxWorld: number) {
    const dc = Math.round(dxWorld / CHUNK);
    const next = new Map<string, Chunk>();
    for (const [key, c] of this.chunks) {
      const [x, z] = key.split(',').map(Number);
      c.mesh.position.x += dxWorld;
      next.set(`${x + dc},${z}`, c);
    }
    this.chunks = next;
  }

  /** The same seasons as the map. */
  applySeason(b: { snow: number; autumn: number; bare: number; spring: number }) {
    const s = this.season;
    if (Math.abs(s.snow - b.snow) + Math.abs(s.autumn - b.autumn) + Math.abs(s.bare - b.bare) + Math.abs(s.spring - b.spring) < 0.02) return;
    this.season = { ...b };
    for (const c of this.chunks.values()) this.paint(c);
  }

  private paint(ch: Chunk) {
    const b = this.season;
    const attr = ch.mesh.geometry.attributes.color as THREE.BufferAttribute;
    const arr = attr.array as Float32Array, base = ch.base;
    for (let q = 0; q < ch.src.length; q++) {
      const v = ch.src[q];
      let r = base[v * 3], g = base[v * 3 + 1], bl = base[v * 3 + 2];
      if (ch.land[v]) {
        const cold = Math.min(1, ch.cold[v]);
        const a = b.autumn * 0.35 * (1 - cold * 0.5), sp = b.spring * 0.18 * (1 - cold), sn = Math.min(0.92, b.snow * 0.88 + cold * (b.bare * 0.75 + b.autumn * 0.35 + b.spring * 0.25));
        r += (AUTUMN_C.r - r) * a; g += (AUTUMN_C.g - g) * a; bl += (AUTUMN_C.b - bl) * a;
        r += (SPRING_C.r - r) * sp; g += (SPRING_C.g - g) * sp; bl += (SPRING_C.b - bl) * sp;
        r += (0.93 - r) * sn; g += (0.95 - g) * sn; bl += (0.97 - bl) * sn;
      }
      arr[q * 3] = r; arr[q * 3 + 1] = g; arr[q * 3 + 2] = bl;
    }
    attr.needsUpdate = true;
  }

  dispose() { for (const c of this.chunks.values()) c.mesh.geometry.dispose(); this.mat.dispose(); }
}
export { wrapX };

/**
 * Cells of one colour each (like the map's tiles) instead of colours smudged between corners: every quad of the
 * grid (6 corners in `index`, the first one its top-left point) is drawn on its own with that point's colour.
 */
function blocky(pos: Float32Array, col: Float32Array, index: number[]) {
  const n = index.length;
  const p = new Float32Array(n * 3), c = new Float32Array(n * 3), src = new Uint32Array(n);
  for (let q = 0; q < n; q++) {
    const v = index[q], first = index[q - (q % 6)];
    p[q * 3] = pos[v * 3]; p[q * 3 + 1] = pos[v * 3 + 1]; p[q * 3 + 2] = pos[v * 3 + 2];
    c[q * 3] = col[first * 3]; c[q * 3 + 1] = col[first * 3 + 1]; c[q * 3 + 2] = col[first * 3 + 2];
    src[q] = first;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.computeVertexNormals();
  return { geo, src };
}
