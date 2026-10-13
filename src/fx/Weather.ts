import * as THREE from 'three';
import { box, merge } from '../utils/voxel';
import type { Season } from '../sim/Calendar';
import { sound } from '../audio/Sound';
import { MAP_SIZE } from '../config';

interface RainArea { x: number; z: number; r: number; t: number }
/** A natural rain / snow cloud drifting over the map. */
interface Cell { x: number; z: number; r: number; vx: number; vz: number }
interface Drop { x: number; y: number; z: number; v: number; area: number }
interface Bolt { mesh: THREE.Mesh; t: number }

const DROPS = 1400;
const CLOUD_H = 4.5;
const HALF = MAP_SIZE / 2;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Weather: on rainy days a few rain (or snow) clouds drift across the map — it rains under them, not everywhere.
 * Also local showers (`addRain`), lightning bolts and a sky flash. `isWet(x, z)` tells the simulation where it rains.
 */
export class Weather {
  readonly group = new THREE.Group();
  /** Natural weather for today. */
  kind: 'clear' | 'rain' | 'snow' = 'clear';
  /** Natural weather runs between these day fractions. */
  private from = 0;
  private to = 0;
  private cells: Cell[] = [];
  private areas: RainArea[] = [];
  private drops: Drop[] = [];
  private dropMesh: THREE.InstancedMesh;
  private flakeMesh: THREE.InstancedMesh;
  private cloudMesh: THREE.InstancedMesh;
  private bolts: Bolt[] = [];
  private boltMat = new THREE.MeshBasicMaterial({ color: '#fffbe0' });
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  /** 0..1 sky flash after a lightning strike. */
  flash = 0;
  private naturalOn = false;
  /** Days of drought left (no rain, poor harvest). */
  drought = 0;

  constructor() {
    this.dropMesh = this.make(new THREE.BoxGeometry(0.012, 0.22, 0.012), new THREE.MeshBasicMaterial({ color: '#b8d6f0', transparent: true, opacity: 0.6, depthWrite: false }), DROPS);
    this.flakeMesh = this.make(new THREE.BoxGeometry(0.04, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: '#ffffff' }), DROPS);
    const cloudGeo = merge([box(1.6, 0.35, 1.2, 0, 0, 0), box(1.0, 0.3, 0.9, 0.5, 0.25, 0.1), box(0.9, 0.28, 0.8, -0.5, 0.2, -0.2)]);
    this.cloudMesh = this.make(cloudGeo, new THREE.MeshLambertMaterial({ color: '#8d96a3', transparent: true, opacity: 0.9 }), 400);
    this.cloudMesh.castShadow = true;
  }

  private make(geo: THREE.BufferGeometry, mat: THREE.Material, n: number) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.count = 0;
    m.frustumCulled = false;
    this.group.add(m);
    return m;
  }

  /** Roll the natural weather for a new day: a few clouds in random places. */
  /** Make today's weather `kind` all day long (a blizzard). */
  allDay(kind: 'rain' | 'snow') {
    this.kind = kind;
    this.from = 0;
    this.to = 1;
  }

  newDay(season: Season) {
    if (this.drought > 0) this.drought--;
    const chance = this.drought > 0 ? 0 : season === 'summer' ? 0.25 : season === 'winter' ? 0.5 : 0.45;
    this.kind = Math.random() < chance ? (season === 'winter' ? 'snow' : 'rain') : 'clear';
    this.from = 0.05 + Math.random() * 0.4;
    this.to = this.from + 0.25 + Math.random() * 0.35;
    this.cells = [];
    if (this.kind === 'clear') return;
    const n = 2 + Math.floor(Math.random() * 4);
    const ang = Math.random() * Math.PI * 2, wind = 0.02 + Math.random() * 0.04;
    for (let i = 0; i < n; i++) {
      this.cells.push({
        x: (Math.random() - 0.5) * MAP_SIZE * 0.9, z: (Math.random() - 0.5) * MAP_SIZE * 0.9,
        r: 9 + Math.random() * 16, vx: Math.cos(ang) * wind, vz: Math.sin(ang) * wind,
      });
    }
  }

  get naturalActive() { return this.naturalOn; }

  /** Is it raining or snowing at this point right now (natural clouds)? */
  rainingAt(x: number, z: number) {
    return this.naturalOn && this.cells.some((c) => Math.hypot(c.x - x, c.z - z) < c.r);
  }

  /** A random point under a natural rain cloud (for thunderstorms), or null. */
  wetPoint(): { x: number; z: number } | null {
    if (!this.naturalOn || this.kind !== 'rain' || !this.cells.length) return null;
    const c = this.cells[Math.floor(Math.random() * this.cells.length)];
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * c.r;
    return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
  }

  /** Local shower over (x, z). */
  addRain(x: number, z: number, r = 2.5, seconds = 18) {
    const near = this.areas.find((a) => Math.hypot(a.x - x, a.z - z) < 1.5);
    if (near) { near.t = Math.max(near.t, seconds); return; }
    this.areas.push({ x, z, r, t: seconds });
  }

  /** Is it raining at this spot right now? (Snow does not water fields.) */
  isWet(x: number, z: number) {
    if (this.kind === 'rain' && this.rainingAt(x, z)) return true;
    return this.areas.some((a) => Math.hypot(a.x - x, a.z - z) < a.r);
  }

  /** Lightning strike visual at (x, z). */
  strike(x: number, z: number) {
    const parts: THREE.BufferGeometry[] = [];
    let px = x, pz = z;
    for (let y = CLOUD_H; y > 0; y -= 0.5) {
      const nx = px + (Math.random() - 0.5) * 0.5, nz = pz + (Math.random() - 0.5) * 0.5;
      const ny = Math.max(0, y - 0.5);
      const len = Math.hypot(nx - px, 0.5, nz - pz);
      const g = new THREE.BoxGeometry(0.06, len, 0.06);
      const dir = new THREE.Vector3(nx - px, ny - y, nz - pz).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
      g.translate((px + nx) / 2, (y + ny) / 2, (pz + nz) / 2);
      parts.push(g);
      px = nx; pz = nz;
    }
    const mesh = new THREE.Mesh(merge(parts.map((g) => { g.deleteAttribute('uv'); return g; })), this.boltMat);
    this.group.add(mesh);
    this.bolts.push({ mesh, t: 0.35 });
    this.flash = 1;
    sound.play('thunder');
  }

  /** `simDt` drives weather timers and drifting clouds, `dt` the visuals. */
  update(dt: number, simDt: number, timeOfDay: number, center: THREE.Vector3, viewHalf: number) {
    this.naturalOn = this.kind !== 'clear' && timeOfDay >= this.from && timeOfDay < this.to;
    for (const c of this.cells) {
      c.x += c.vx * simDt;
      c.z += c.vz * simDt;
      // clouds that drift off the map come back from the other side
      if (c.x > HALF + c.r) c.x = -HALF - c.r;
      if (c.x < -HALF - c.r) c.x = HALF + c.r;
      if (c.z > HALF + c.r) c.z = -HALF - c.r;
      if (c.z < -HALF - c.r) c.z = HALF + c.r;
    }
    for (let i = this.areas.length - 1; i >= 0; i--) {
      this.areas[i].t -= simDt;
      if (this.areas[i].t <= 0) this.areas.splice(i, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t -= dt;
      b.mesh.visible = Math.sin(b.t * 60) > -0.3;
      if (b.t <= 0) {
        this.group.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.bolts.splice(i, 1);
      }
    }

    // drops only fall under clouds near the camera
    const span = Math.min(viewHalf * 1.6, 30);
    const near = this.naturalOn ? this.cells.filter((c) => Math.abs(c.x - center.x) < span + c.r && Math.abs(c.z - center.z) < span + c.r) : [];
    const snow = this.kind === 'snow';
    const natural = near.length ? 900 : 0;
    const perArea = this.areas.length ? Math.floor(Math.min(DROPS - natural, this.areas.length * 220) / this.areas.length) : 0;
    const want = natural + perArea * this.areas.length;
    while (this.drops.length > want) this.drops.pop();
    const spawn = (d: Drop) => {
      if (d.area >= 0 && this.areas[d.area]) {
        const a = this.areas[d.area];
        const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * a.r;
        d.x = a.x + Math.cos(ang) * rr; d.z = a.z + Math.sin(ang) * rr;
        d.y = CLOUD_H - 0.2;
      } else {
        d.x = 1e5;
        for (let i = 0; i < 6 && near.length; i++) {
          const x = center.x + (Math.random() - 0.5) * span * 2;
          const z = center.z + (Math.random() - 0.5) * span * 2;
          if (near.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) { d.x = x; d.z = z; break; }
        }
        d.y = Math.random() * 6;
      }
      d.v = snow && d.area < 0 ? 0.6 + Math.random() * 0.4 : 7 + Math.random() * 3;
    };
    for (let i = this.drops.length; i < want; i++) {
      const d: Drop = { x: 0, y: 0, z: 0, v: 0, area: i < natural ? -1 : Math.floor((i - natural) / Math.max(1, perArea)) };
      spawn(d);
      d.y = Math.random() * CLOUD_H;
      this.drops.push(d);
    }

    let nd = 0, nf = 0;
    this.q.identity();
    this.s.set(1, 1, 1);
    for (const d of this.drops) {
      d.y -= d.v * dt;
      if (snow && d.area < 0) d.x += Math.sin(d.y * 2 + d.z) * dt * 0.3;
      if (d.y <= 0) spawn(d);
      if (d.x > 1e4) continue;
      this.p.set(d.x, d.y, d.z);
      this.m.compose(this.p, this.q, this.s);
      if (snow && d.area < 0) this.flakeMesh.setMatrixAt(nf++, this.m);
      else this.dropMesh.setMatrixAt(nd++, this.m);
    }
    this.dropMesh.count = nd;
    this.flakeMesh.count = nf;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    this.flakeMesh.instanceMatrix.needsUpdate = true;

    // clouds: natural cells (when active) and local showers
    let nc = 0;
    const put = (x: number, z: number, i: number, fade: number) => {
      if (nc >= 400) return;
      this.p.set(x, CLOUD_H + Math.sin(i * 2.3) * 0.25, z);
      this.s.set(fade * (1.2 + (i % 3) * 0.3), fade, fade * (1.2 + (i % 2) * 0.4));
      this.q.setFromAxisAngle(UP, i * 1.7);
      this.m.compose(this.p, this.q, this.s);
      this.cloudMesh.setMatrixAt(nc++, this.m);
    };
    if (this.naturalOn) {
      for (const c of this.cells) {
        const n = Math.round(c.r * 0.9);
        for (let i = 0; i < n; i++) {
          const ang = i * 2.399, rr = Math.sqrt((i + 0.5) / n) * c.r * 0.85;
          put(c.x + Math.cos(ang) * rr, c.z + Math.sin(ang) * rr, i, 1.4);
        }
      }
    }
    for (const a of this.areas) {
      const n = Math.max(2, Math.round(a.r * 1.4));
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + a.x;
        const rr = i === 0 ? 0 : a.r * 0.55;
        put(a.x + Math.cos(ang) * rr, a.z + Math.sin(ang) * rr, i, Math.min(1, a.t / 2));
      }
    }
    this.cloudMesh.count = nc;
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }
}
