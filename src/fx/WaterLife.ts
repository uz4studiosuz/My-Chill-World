import * as THREE from 'three';
import { DIRS, N, idx, inBounds, tileToWorld, worldToTile } from '../world/grid';
import type { WorldMap } from '../world/WorldMap';
import { box, merge, shape } from '../utils/voxel';
import { WATER_LEVEL } from '../config';
import { PERSON_VARIANTS, personGeometry } from '../models/people';

type BoatKind = 'sail' | 'fishing' | 'ferry';

interface Boat { kind: BoatKind; x: number; z: number; tx: number; tz: number; heading: number; speed: number; body: number; wait: number; /** Fishing boat: its hut, and where it is moored. */ fishery?: number; hx?: number; hz?: number }
interface Duck { x: number; z: number; ph: number; body: number; cx: number; cz: number }

const sailboat = () => merge([
  box(0.12, 0.05, 0.34, 0, 0.02, 0, '#f4f1ea'), box(0.1, 0.03, 0.28, 0, 0.055, 0, '#8a5a35'),
  box(0.012, 0.4, 0.012, 0, 0.26, 0.02, '#6b4a2e'),
  box(0.014, 0.34, 0.2, 0.006, 0.26, -0.08, '#ffffff'), box(0.014, 0.24, 0.1, 0.006, 0.2, 0.09, '#e85a3a'),
]);
const fishingBoat = () => merge([
  box(0.14, 0.06, 0.32, 0, 0.02, 0, '#3a6fd1'), box(0.12, 0.02, 0.3, 0, 0.055, 0, '#c98a5a'),
  box(0.11, 0.05, 0.08, 0, 0.09, -0.1, '#5d6670'), box(0.12, 0.012, 0.09, 0, 0.12, -0.1, '#8a5a35'),
  box(0.008, 0.16, 0.008, 0.05, 0.14, 0.11, '#6b4a2e'), box(0.004, 0.004, 0.12, 0.05, 0.22, 0.17, '#3b3f45'),
]);
const ferry = () => merge([
  box(0.3, 0.07, 0.6, 0, 0.025, 0, '#e9edf0'), box(0.28, 0.02, 0.56, 0, 0.065, 0, '#5d6670'),
  box(0.2, 0.12, 0.16, 0, 0.13, -0.18, '#f4f1ea'), box(0.21, 0.04, 0.17, 0, 0.21, -0.18, '#d9443b'),
  box(0.1, 0.06, 0.16, -0.06, 0.1, 0.1, '#3a6fd1'), box(0.1, 0.06, 0.16, 0.06, 0.1, 0.12, '#f2c230'),
]);
const duck = () => merge([
  box(0.045, 0.03, 0.07, 0, 0.015, 0, '#8a6f4a'), box(0.03, 0.03, 0.03, 0, 0.045, 0.03, '#3a7a42'), box(0.012, 0.008, 0.02, 0, 0.042, 0.052, '#f2b33d'),
]);
const towel = () => merge([box(0.12, 0.006, 0.24, 0, 0.004, 0, '#ffffff')]);
const umbrella = () => merge([box(0.012, 0.22, 0.012, 0, 0.11, 0, '#cccccc'), shape('cone', 0.26, 0.06, 0.26, 0, 0.23, 0, '#ffffff', 'y', 8)]);

/**
 * Life on the water: sailboats, fishing boats and a ferry glide over lakes and rivers, ducks paddle near the shore.
 * In summer towels and umbrellas dot the beaches; in winter the water freezes and people skate on the ice.
 */
export class WaterLife {
  readonly group = new THREE.Group();
  private bodyOf = new Int32Array(N * N).fill(-1);
  private bodies: number[][] = [];
  private boats: Boat[] = [];
  private ducks: Duck[] = [];
  private meshes: Record<BoatKind | 'duck', THREE.InstancedMesh>;
  private towels: THREE.InstancedMesh;
  private umbrellas: THREE.InstancedMesh;
  private time = 0;
  private wasFrozen = false;
  /** The fisherman on duty at a fishing hut: his look (variant), or -1 when nobody is at work. Set by the game. */
  crewOf: (fisheryId: number) => number = () => -1;
  private crew: THREE.InstancedMesh[] = [];

  constructor(private map: WorldMap, private towns: () => { x: number; z: number }[], private fisheries: () => { x: number; z: number; id: number }[]) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const make = (g: THREE.BufferGeometry, n: number, colorful = false) => {
      const m = new THREE.InstancedMesh(g, colorful ? new THREE.MeshLambertMaterial({ vertexColors: true }) : mat, n);
      m.count = 0;
      m.castShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    this.meshes = { sail: make(sailboat(), 16), fishing: make(fishingBoat(), 16), ferry: make(ferry(), 4), duck: make(duck(), 60) };
    for (let v = 0; v < PERSON_VARIANTS; v++) this.crew.push(make(personGeometry(v), 16));
    this.towels = make(towel(), 40, true);
    this.umbrellas = make(umbrella(), 40, true);
    this.rebuild();
  }

  /** Find the lakes and rivers (connected water) and put boats and ducks on them. */
  rebuild() {
    const { map } = this;
    this.bodyOf.fill(-1);
    this.bodies = [];
    for (let k = 0; k < N * N; k++) {
      if (!map.water[k] || this.bodyOf[k] >= 0) continue;
      const id = this.bodies.length, tiles: number[] = [];
      const stack = [k];
      this.bodyOf[k] = id;
      while (stack.length) {
        const cur = stack.pop()!;
        tiles.push(cur);
        const x = cur % N, z = (cur / N) | 0;
        for (const d of DIRS) {
          const nx = x + d.dx, nz = z + d.dz;
          if (!inBounds(nx, nz)) continue;
          const nk = idx(nx, nz);
          if (map.water[nk] && this.bodyOf[nk] < 0) { this.bodyOf[nk] = id; stack.push(nk); }
        }
      }
      this.bodies.push(tiles);
    }
    this.boats = [];
    this.ducks = [];
    const big = this.bodies.map((t, i) => ({ t, i })).filter((b) => b.t.length >= 40).sort((a, b) => b.t.length - a.t.length);
    let sails = 0, ducks = 0;
    for (const { t, i } of big) {
      const n = Math.min(4, Math.floor(t.length / 120) + 1);
      for (let j = 0; j < n && sails < 14; j++, sails++) this.addBoat(j === 0 && t.length > 200 && i === big[0].i ? 'ferry' : 'sail', i);
      for (let j = 0; j < Math.min(4, Math.floor(t.length / 60) + 1) && ducks < 18; j++, ducks++) {
        const k = t[Math.floor(Math.random() * t.length)];
        const cx = tileToWorld(k % N), cz = tileToWorld((k / N) | 0);
        for (let d = 0; d < 3; d++) this.ducks.push({ x: cx, z: cz, ph: Math.random() * 10, body: i, cx, cz });
      }
    }
    // a fishing boat by every fishing hut
    for (const f of this.fisheries()) {
      let best = -1, bd = 9;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        if (!inBounds(f.x + dx, f.z + dz)) continue;
        const k = idx(f.x + dx, f.z + dz);
        if (this.bodyOf[k] >= 0 && Math.abs(dx) + Math.abs(dz) < bd) { bd = Math.abs(dx) + Math.abs(dz); best = k; }
      }
      if (best >= 0 && this.boats.length < 30) {
        this.addBoat('fishing', this.bodyOf[best], best);
        const b = this.boats[this.boats.length - 1];
        b.fishery = f.id; b.hx = b.x; b.hz = b.z;
      }
    }
    this.beaches();
  }

  private addBoat(kind: BoatKind, body: number, at?: number) {
    const t = this.bodies[body];
    const k = at ?? t[Math.floor(Math.random() * t.length)];
    const x = tileToWorld(k % N), z = tileToWorld((k / N) | 0);
    this.boats.push({ kind, x, z, tx: x, tz: z, heading: Math.random() * 6.28, speed: kind === 'ferry' ? 0.35 : kind === 'fishing' ? 0.25 : 0.3 + Math.random() * 0.15, body, wait: Math.random() * 4 });
  }

  /** Is the straight line from a to b all on water of the same body? */
  private clear(x0: number, z0: number, x1: number, z1: number, body: number) {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 3);
    for (let i = 0; i <= n; i++) {
      const x = worldToTile(x0 + ((x1 - x0) * i) / n), z = worldToTile(z0 + ((z1 - z0) * i) / n);
      if (!inBounds(x, z) || this.bodyOf[idx(x, z)] !== body) return false;
    }
    return true;
  }

  /** Towels and umbrellas on shore tiles near the towns. */
  private beaches() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const cols = ['#e85a7a', '#3a6fd1', '#f2c230', '#4c9a52', '#e8a13a'];
    let n = 0;
    for (const town of this.towns()) {
      let placed = 0;
      for (let r = 2; r < 16 && placed < 6; r++) for (let dz = -r; dz <= r && placed < 6; dz++) for (let dx = -r; dx <= r && placed < 6; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = town.x + dx, z = town.z + dz;
        if (!inBounds(x, z) || !this.map.isShore(x, z) || this.map.water[idx(x, z)] || (x + z) % 3) continue;
        if (n >= 40) break;
        q.setFromAxisAngle(up, ((x * 7 + z) % 6) * 0.5);
        m.compose(new THREE.Vector3(tileToWorld(x) + 0.1, 0.02, tileToWorld(z)), q, new THREE.Vector3(1, 1, 1));
        this.towels.setMatrixAt(n, m);
        this.towels.setColorAt(n, new THREE.Color(cols[n % cols.length]));
        m.compose(new THREE.Vector3(tileToWorld(x) - 0.12, 0, tileToWorld(z) - 0.1), q, new THREE.Vector3(1, 1, 1));
        this.umbrellas.setMatrixAt(n, m);
        this.umbrellas.setColorAt(n, new THREE.Color(cols[(n + 2) % cols.length]));
        n++;
        placed++;
      }
    }
    this.towels.count = this.umbrellas.count = n;
    for (const mm of [this.towels, this.umbrellas]) {
      mm.instanceMatrix.needsUpdate = true;
      if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
    }
  }

  /** Centres of frozen lakes near the towns, where citizens go skating (filled while frozen). */
  iceSpots: { x: number; z: number }[] = [];

  private findIce(on: boolean) {
    this.iceSpots = [];
    if (!on) return;
    for (const town of this.towns()) {
      let best = -1, bd = 26;
      for (let dz = -25; dz <= 25; dz += 2) for (let dx = -25; dx <= 25; dx += 2) {
        const x = town.x + dx, z = town.z + dz;
        if (!inBounds(x, z)) continue;
        const k = idx(x, z);
        const b = this.bodyOf[k];
        if (b < 0 || this.bodies[b].length < 20) continue;
        // middle of the ice: water on all sides
        if (!DIRS.every((d) => inBounds(x + d.dx * 2, z + d.dz * 2) && this.map.water[idx(x + d.dx * 2, z + d.dz * 2)])) continue;
        const d = Math.abs(dx) + Math.abs(dz);
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) this.iceSpots.push({ x: tileToWorld(best % N), z: tileToWorld((best / N) | 0) });
    }
  }

  update(dt: number, frozen: boolean, summer: boolean, night: number) {
    this.time += dt;
    if (frozen !== this.wasFrozen) { this.wasFrozen = frozen; this.findIce(frozen); }
    this.towels.visible = this.umbrellas.visible = summer && !frozen && night < 0.5;
    const counts: Record<BoatKind | 'duck', number> = { sail: 0, fishing: 0, ferry: 0, duck: 0 };
    const crewN = this.crew.map(() => 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const y = WATER_LEVEL - 0.02;
    if (!frozen) {
      for (const b of this.boats) {
        // a fishing boat goes out only with its fisherman on board; without him it waits at the hut
        const fisher = b.fishery !== undefined ? this.crewOf(b.fishery) : 0;
        if (b.fishery !== undefined && fisher < 0) { b.tx = b.hx!; b.tz = b.hz!; }
        if (dt > 0) {
          if (b.fishery !== undefined && fisher < 0 && Math.hypot(b.tx - b.x, b.tz - b.z) < 0.1) b.wait = 1;
          else if (b.wait > 0) b.wait -= dt;
          else {
            const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
            if (d < 0.1) {
              // choose the next spot on the same lake
              const t = this.bodies[b.body];
              for (let i = 0; i < 6; i++) {
                const k = t[Math.floor(Math.random() * t.length)];
                const nx = tileToWorld(k % N), nz = tileToWorld((k / N) | 0);
                if (Math.hypot(nx - b.x, nz - b.z) < (b.kind === 'ferry' ? 18 : 10) && this.clear(b.x, b.z, nx, nz, b.body)) { b.tx = nx; b.tz = nz; break; }
              }
              b.wait = b.kind === 'ferry' ? 6 : 1 + Math.random() * 5;
            } else {
              const want = Math.atan2(dx, dz);
              let diff = want - b.heading;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              b.heading += diff * Math.min(1, dt * 1.5);
              const step = Math.min(d, b.speed * dt);
              b.x += Math.sin(b.heading) * step;
              b.z += Math.cos(b.heading) * step;
            }
          }
        }
        const rock = Math.sin(this.time * 1.7 + b.x) * 0.04;
        q.setFromEuler(new THREE.Euler(rock * 0.5, b.heading, rock, 'YXZ'));
        p.set(b.x, y + Math.sin(this.time * 2 + b.z) * 0.006, b.z);
        m.compose(p, q, s);
        this.meshes[b.kind].setMatrixAt(counts[b.kind]++, m);
        if (b.fishery !== undefined && fisher >= 0 && crewN[fisher] < 16) {
          const off = new THREE.Vector3(0, 0.065, 0.04).applyQuaternion(q);
          p.set(b.x + off.x, y + off.y, b.z + off.z);
          m.compose(p, q, s);
          this.crew[fisher].setMatrixAt(crewN[fisher]++, m);
        }
      }
      for (const d of this.ducks) {
        const t = this.time * 0.25 + d.ph;
        const nx = d.cx + Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.15, nz = d.cz + Math.cos(t * 0.8) * 0.5;
        const tx = worldToTile(nx), tz = worldToTile(nz);
        if (inBounds(tx, tz) && this.bodyOf[idx(tx, tz)] === d.body) { d.x = nx; d.z = nz; }
        q.setFromAxisAngle(up, Math.atan2(Math.cos(t), -Math.sin(t) * 0.8));
        p.set(d.x + d.ph * 0.01, y + 0.005, d.z);
        m.compose(p, q, s);
        this.meshes.duck.setMatrixAt(counts.duck++, m);
      }
    }
    this.crew.forEach((mesh, i) => { mesh.count = frozen ? 0 : crewN[i]; mesh.instanceMatrix.needsUpdate = true; });
    for (const k of Object.keys(this.meshes) as (BoatKind | 'duck')[]) {
      this.meshes[k].count = counts[k];
      this.meshes[k].instanceMatrix.needsUpdate = true;
    }
  }
}
