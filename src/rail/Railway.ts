import * as THREE from 'three';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';
import { FlatBuilder } from '../paths/Footpaths';
import { locoGeometry, wagonGeometry } from '../models/vehicles';

const BALLAST = new THREE.Color('#8c8478');
const SLEEPER = new THREE.Color('#6b4a2e');
const STEEL = new THREE.Color('#3d4148');
const Y = 0.035;
const SPEED = 2.2;
const WAGONS = 2;
const GAP = 0.62;

export interface Station { id: number; x: number; z: number; size: number; city: number }

interface Train {
  a: Station;
  b: Station;
  /** Polyline (world x, z pairs) from station a to station b. */
  pts: number[];
  cum: number[];
  len: number;
  s: number;
  dir: 1 | -1;
  wait: number;
  group: THREE.Group;
}

/**
 * Railway tracks laid by the player and the trains that run between stations joined by a track.
 * When a train reaches a station it calls `onArrive` (goods and passengers are exchanged there).
 */
export class Railway {
  readonly tiles = new Uint8Array(N * N);
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private trains: Train[] = [];
  private locoGeo = locoGeometry();
  private wagonGeo = wagonGeometry();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  onArrive: (from: Station, to: Station) => void = () => {};

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  add(path: Tile[]) { for (const t of path) this.tiles[idx(t.x, t.z)] = 1; }

  remove(path: Tile[]) {
    let n = 0;
    for (const t of path) { const k = idx(t.x, t.z); if (this.tiles[k]) { this.tiles[k] = 0; n++; } }
    return n;
  }

  count() { let n = 0; for (let k = 0; k < this.tiles.length; k++) n += this.tiles[k]; return n; }
  get trainCount() { return this.trains.length; }
  /** Station pairs joined by a train line. */
  get lines(): [Station, Station][] { return this.trains.map((t) => [t.a, t.b]); }

  serialize() { const out: number[] = []; for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k]) out.push(k); return out; }
  deserialize(list: number[] = []) { this.tiles.fill(0); for (const k of list) if (k >= 0 && k < this.tiles.length) this.tiles[k] = 1; }

  /** Rebuild the track mesh and the train lines between all connected stations. */
  rebuild(stations: Station[]) {
    const b = new FlatBuilder();
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (!this.tiles[idx(x, z)]) continue;
      const cx = tileToWorld(x), cz = tileToWorld(z);
      const links = DIRS.filter((d) => inBounds(x + d.dx, z + d.dz) && this.tiles[idx(x + d.dx, z + d.dz)]);
      const ends = links.length ? links : [DIRS[0], DIRS[2]];
      b.rect(cx - 0.2, cz - 0.2, cx + 0.2, cz + 0.2, Y, BALLAST);
      for (const d of ends) {
        // ballast, sleepers and two steel rails towards each neighbour
        if (d.dx) {
          b.rect(cx, cz - 0.2, cx + d.dx * 0.5, cz + 0.2, Y, BALLAST);
          for (const o of [0.1, 0.3]) b.rect(cx + d.dx * o - 0.035, cz - 0.17, cx + d.dx * o + 0.035, cz + 0.17, Y + 0.002, SLEEPER);
          for (const o of [-0.09, 0.09]) b.rect(cx, cz + o - 0.015, cx + d.dx * 0.5, cz + o + 0.015, Y + 0.004, STEEL);
        } else {
          b.rect(cx - 0.2, cz, cx + 0.2, cz + d.dz * 0.5, Y, BALLAST);
          for (const o of [0.1, 0.3]) b.rect(cx - 0.17, cz + d.dz * o - 0.035, cx + 0.17, cz + d.dz * o + 0.035, Y + 0.002, SLEEPER);
          for (const o of [-0.09, 0.09]) b.rect(cx + o - 0.015, cz, cx + o + 0.015, cz + d.dz * 0.5, Y + 0.004, STEEL);
        }
      }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = b.geometry();
    this.planTrains(stations);
  }

  /** Track tiles touching a station's footprint. */
  private platform(s: Station) {
    const out: number[] = [];
    for (let i = -1; i <= s.size; i++) {
      for (const [x, z] of [[s.x + i, s.z - 1], [s.x + i, s.z + s.size], [s.x - 1, s.z + i], [s.x + s.size, s.z + i]]) {
        if (inBounds(x, z) && this.tiles[idx(x, z)]) out.push(idx(x, z));
      }
    }
    return out;
  }

  private planTrains(stations: Station[]) {
    for (const tr of this.trains) this.group.remove(tr.group);
    const old = this.trains;
    this.trains = [];
    const done = new Set<string>();
    for (const a of stations) {
      const startTiles = this.platform(a);
      if (!startTiles.length) continue;
      // breadth-first search along the tracks to every other station
      const prev = new Map<number, number>();
      const queue = [...startTiles];
      for (const k of startTiles) prev.set(k, -1);
      for (let h = 0; h < queue.length; h++) {
        const k = queue[h], x = k % N, z = (k / N) | 0;
        for (const d of DIRS) {
          const nx = x + d.dx, nz = z + d.dz;
          if (!inBounds(nx, nz)) continue;
          const nk = idx(nx, nz);
          if (!this.tiles[nk] || prev.has(nk)) continue;
          prev.set(nk, k);
          queue.push(nk);
        }
      }
      for (const b of stations) {
        if (b === a) continue;
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (done.has(key)) continue;
        const end = this.platform(b).find((k) => prev.has(k));
        if (end === undefined) continue;
        done.add(key);
        const path: number[] = [];
        for (let k = end; k >= 0; k = prev.get(k)!) path.push(k);
        path.reverse();
        const pts: number[] = [], cum: number[] = [];
        let len = 0;
        for (const k of path) {
          const x = tileToWorld(k % N), z = tileToWorld((k / N) | 0);
          if (pts.length) len += Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1]);
          pts.push(x, z);
          cum.push(len);
        }
        if (len < 1) continue;
        const keep = old.find((t) => (t.a.id === a.id && t.b.id === b.id) || (t.a.id === b.id && t.b.id === a.id));
        const group = new THREE.Group();
        const loco = new THREE.Mesh(this.locoGeo, this.mat);
        loco.castShadow = true;
        group.add(loco);
        for (let i = 0; i < WAGONS; i++) {
          const w = new THREE.Mesh(this.wagonGeo, this.mat);
          w.castShadow = true;
          group.add(w);
        }
        this.group.add(group);
        this.trains.push({ a, b, pts, cum, len, s: keep ? Math.min(keep.s, len) : 0, dir: keep?.dir ?? 1, wait: 2, group });
      }
    }
  }

  private at(t: Train, s: number) {
    s = Math.max(0, Math.min(t.len, s));
    let i = 0;
    while (i < t.cum.length - 2 && t.cum[i + 1] < s) i++;
    const L = t.cum[i + 1] - t.cum[i];
    const f = L > 0 ? (s - t.cum[i]) / L : 0;
    const x0 = t.pts[i * 2], z0 = t.pts[i * 2 + 1], x1 = t.pts[i * 2 + 2], z1 = t.pts[i * 2 + 3];
    return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, rot: Math.atan2(x1 - x0, z1 - z0) };
  }

  update(dt: number) {
    for (const t of this.trains) {
      if (t.wait > 0) t.wait -= dt;
      else {
        t.s += t.dir * SPEED * dt;
        if (t.s >= t.len || t.s <= 0) {
          t.s = Math.max(0, Math.min(t.len, t.s));
          const from = t.dir > 0 ? t.a : t.b, to = t.dir > 0 ? t.b : t.a;
          this.onArrive(from, to);
          t.dir = t.dir > 0 ? -1 : 1;
          t.wait = 5;
        }
      }
      t.group.children.forEach((m, i) => {
        const p = this.at(t, t.s - t.dir * i * GAP);
        m.position.set(p.x, 0.03, p.z);
        m.rotation.y = p.rot + (t.dir < 0 ? Math.PI : 0);
      });
    }
  }
}
