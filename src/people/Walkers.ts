import * as THREE from 'three';
import { PERSON_VARIANTS, babyGeometry, logGeometry, personGeometry } from '../models/people';
import type { Point } from '../buildings/Buildings';
import { stretcherGeometry } from '../models/extras';
import { bikeGeometry } from '../models/chains2';
import { UNIFORMS, UNIFORM_KINDS, type Uniform } from '../models/people/uniforms';

export type Carry = 'none' | 'log' | 'baby' | 'stretcher';

export interface Walker {
  id: number;
  /** Citizen this walker belongs to (for selection). */
  citizen?: number;
  variant: number;
  scale: number;
  carry: Carry;
  pts: number[];
  cum: number[];
  len: number;
  s: number;
  seg: number;
  speed: number;
  x: number; z: number; hx: number; hz: number;
  /** 0 → 1 fade-in, back to 0 when leaving. */
  fade: number;
  leaving: boolean;
  /** Seconds left standing still (working); `anim` says how it looks. */
  hold: number;
  /** play: children jumping about; cheer: fans jumping; sit: watching a film. */
  anim: 'none' | 'chop' | 'farm' | 'play' | 'cheer' | 'sit';
  /** Standing raised above the ground (stadium stands, benches). */
  lift?: number;
  /** Not drawn (the first-person camera is inside this person's head). */
  hidden?: boolean;
  /** Riding a bicycle (drawn on a bike, faster). */
  bike?: boolean;
  phase: number;
  onArrive?: (w: Walker) => void;
  onHoldEnd?: (w: Walker) => void;
}

/** Waypoints in world space (start and end included). */
export interface WalkRoute { points: Point[] }

const MAX_PER_VARIANT = 400;

/** Pedestrians: walking along footpaths / sidewalks / fields, carrying logs or babies, working. */
export class Walkers {
  /** Bicycles standing in front of the factories (set by the game every frame). */
  standingBikes: { x: number; z: number; rot: number }[] = [];
  /** Work clothes of a walker right now (set by the game: people at or on their way to work wear them). */
  uniformOf?: (w: Walker) => Uniform | undefined;
  /** May a walker enter the segment (x0,z0)→(x1,z1)? Used for red lights at crossings. */
  gate?: (x0: number, z0: number, x1: number, z1: number) => boolean;
  readonly group = new THREE.Group();
  readonly list: Walker[] = [];
  private nextId = 1;
  private meshes: THREE.InstancedMesh[] = [];
  private baby: THREE.InstancedMesh;
  private log: THREE.InstancedMesh;
  private stretcher: THREE.InstancedMesh;
  private bikes: THREE.InstancedMesh;
  private uniforms = new Map<Uniform, THREE.InstancedMesh>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private time = 0;

  constructor() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const make = (geo: THREE.BufferGeometry) => {
      const m = new THREE.InstancedMesh(geo, mat, MAX_PER_VARIANT);
      m.count = 0;
      m.castShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    for (let v = 0; v < PERSON_VARIANTS; v++) this.meshes.push(make(personGeometry(v)));
    this.baby = make(babyGeometry());
    this.log = make(logGeometry());
    this.stretcher = make(stretcherGeometry());
    this.bikes = make(bikeGeometry());
    for (const u of UNIFORM_KINDS) this.uniforms.set(u, make(UNIFORMS[u]()));
  }

  walk(variant: number, scale: number, route: WalkRoute, carry: Carry = 'none', onArrive?: (w: Walker) => void): Walker {
    const w: Walker = {
      id: this.nextId++, variant, scale, carry, pts: [], cum: [], len: 0, s: 0, seg: 0,
      speed: 0.8 * (scale < 0.9 ? 0.85 : 1), x: route.points[0].x, z: route.points[0].z, hx: 0, hz: 1,
      fade: 0, leaving: false, hold: 0, anim: 'none', phase: Math.random() * 10, onArrive,
    };
    this.setRoute(w, route);
    this.list.push(w);
    return w;
  }

  /** Give an existing walker a new route (no fade). */
  retarget(w: Walker, route: WalkRoute, onArrive?: (w: Walker) => void, carry?: Carry) {
    this.setRoute(w, route);
    w.onArrive = onArrive;
    w.leaving = false;
    w.hold = 0;
    w.anim = 'none';
    w.onHoldEnd = undefined;
    if (carry) w.carry = carry;
  }

  /** Stand still for `seconds` (e.g. chopping a tree), then call `then`. */
  holdFor(w: Walker, seconds: number, anim: Walker['anim'], then: (w: Walker) => void, faceTo?: Point) {
    w.hold = seconds;
    w.anim = anim;
    w.leaving = false;
    w.onHoldEnd = then;
    if (faceTo) {
      const dx = faceTo.x - w.x, dz = faceTo.z - w.z, l = Math.hypot(dx, dz);
      if (l > 1e-4) { w.hx = dx / l; w.hz = dz / l; }
    }
  }

  dismiss(w: Walker) {
    w.leaving = true;
    w.hold = 0;
    w.onArrive = undefined;
    w.onHoldEnd = undefined;
  }

  update(dt: number) {
    this.time += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      if (w.leaving) {
        w.fade -= dt * 4;
        if (w.fade <= 0) this.list.splice(i, 1);
        continue;
      }
      w.fade = Math.min(1, w.fade + dt * 4);
      if (dt <= 0) continue;
      if (w.hold > 0) {
        w.hold -= dt;
        if (w.hold <= 0) {
          w.anim = 'none';
          const cb = w.onHoldEnd;
          w.onHoldEnd = undefined;
          if (cb) cb(w);
          else w.leaving = true;
        }
        continue;
      }
      const next = w.s + w.speed * dt;
      if (this.gate && this.blocked(w, next)) {
        w.anim = 'none';
        this.place(w);
        continue;
      }
      w.s = next;
      if (w.s >= w.len) {
        w.s = w.len;
        this.place(w);
        const cb = w.onArrive;
        w.onArrive = undefined;
        w.leaving = true; // unless the callback gives it a new job
        cb?.(w);
        continue;
      }
      this.place(w);
    }
    this.render();
  }

  /** Before stepping into a new segment, ask the gate (traffic lights at zebra crossings). */
  private blocked(w: Walker, next: number) {
    let j = w.seg;
    while (j < w.cum.length - 2 && w.cum[j + 1] < next) {
      j++;
      const p = w.pts;
      if (!this.gate!(p[j * 2], p[j * 2 + 1], p[j * 2 + 2], p[j * 2 + 3])) {
        w.s = w.cum[j];
        w.seg = j;
        return true;
      }
    }
    return false;
  }

  private setRoute(w: Walker, r: WalkRoute) {
    const pts: number[] = [], cum: number[] = [];
    let len = 0;
    const push = (x: number, z: number) => {
      if (pts.length) {
        const d = Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1]);
        if (d < 1e-4) return;
        len += d;
      }
      pts.push(x, z);
      cum.push(len);
    };
    for (const p of r.points) push(p.x, p.z);
    if (pts.length < 4) push(pts[0] + 0.001, pts[1]);
    w.pts = pts;
    w.cum = cum;
    w.len = len;
    w.s = 0;
    w.seg = 0;
  }

  private place(w: Walker) {
    while (w.seg < w.cum.length - 2 && w.cum[w.seg + 1] < w.s) w.seg++;
    const a = w.seg;
    const L = w.cum[a + 1] - w.cum[a];
    const t = L > 0 ? Math.min(1, Math.max(0, (w.s - w.cum[a]) / L)) : 0;
    const dx = w.pts[a * 2 + 2] - w.pts[a * 2], dz = w.pts[a * 2 + 3] - w.pts[a * 2 + 1];
    w.x = w.pts[a * 2] + dx * t;
    w.z = w.pts[a * 2 + 1] + dz * t;
    if (L > 1e-5) { w.hx = dx / L; w.hz = dz / L; }
  }

  private render() {
    const counts = new Array(PERSON_VARIANTS).fill(0);
    let nb = 0, nl = 0, ns = 0, nk = 0;
    const nu = new Map<Uniform, number>();
    for (const w of this.list) {
      if (w.hidden) continue;
      const tt = this.time * 9 + w.phase;
      const walking = w.hold <= 0 && !w.leaving;
      let bob = walking ? (w.bike ? 0.05 : Math.abs(Math.sin(tt)) * 0.008) : 0;
      if (w.anim === 'play') bob = Math.abs(Math.sin(tt * 0.8)) * 0.05;
      if (w.anim === 'cheer') bob = Math.max(0, Math.sin(tt * 0.7 + w.phase)) * 0.04;
      if (w.anim === 'sit') bob = -0.02;
      let tilt = 0;
      if (w.anim === 'chop') tilt = Math.max(0, Math.sin(tt * 0.7)) * 0.5;
      if (w.anim === 'farm') tilt = 0.35 + Math.sin(tt * 0.3) * 0.1;
      this.e.set(tilt, Math.atan2(w.hx, w.hz), walking && !w.bike ? Math.sin(tt) * 0.06 : 0, 'YXZ');
      this.q.setFromEuler(this.e);
      const s = w.scale * w.fade;
      this.p.set(w.x, 0.02 + bob + (w.hold > 0 ? w.lift ?? 0 : 0), w.z);
      this.sc.set(s, s, s);
      this.m.compose(this.p, this.q, this.sc);
      const mesh = this.meshes[w.variant];
      if (counts[w.variant] < MAX_PER_VARIANT) mesh.setMatrixAt(counts[w.variant]++, this.m);
      // work clothes over the everyday ones
      const u = w.scale >= 0.95 ? this.uniformOf?.(w) : undefined;
      if (u) { const k = nu.get(u) ?? 0; if (k < MAX_PER_VARIANT) { this.uniforms.get(u)!.setMatrixAt(k, this.m); nu.set(u, k + 1); } }
      if (w.carry === 'baby' && nb < MAX_PER_VARIANT) this.baby.setMatrixAt(nb++, this.m);
      if (w.carry === 'log' && nl < MAX_PER_VARIANT) this.log.setMatrixAt(nl++, this.m);
      if (w.carry === 'stretcher' && ns < MAX_PER_VARIANT) this.stretcher.setMatrixAt(ns++, this.m);
      if (w.bike && walking && nk < MAX_PER_VARIANT) {
        this.p.set(w.x, 0.02, w.z);
        this.sc.set(w.fade, w.fade, w.fade);
        this.m.compose(this.p, this.q, this.sc);
        this.bikes.setMatrixAt(nk++, this.m);
      }
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
    this.baby.count = nb;
    for (const [u, m] of this.uniforms) { m.count = nu.get(u) ?? 0; m.instanceMatrix.needsUpdate = true; }
    this.log.count = nl;
    for (const b of this.standingBikes) {
      if (nk >= MAX_PER_VARIANT) break;
      this.q.setFromEuler(this.e.set(0, b.rot, 0, 'YXZ'));
      this.p.set(b.x, 0.02, b.z);
      this.sc.set(1, 1, 1);
      this.m.compose(this.p, this.q, this.sc);
      this.bikes.setMatrixAt(nk++, this.m);
    }
    this.stretcher.count = ns;
    this.bikes.count = nk;
    this.bikes.instanceMatrix.needsUpdate = true;
    this.stretcher.instanceMatrix.needsUpdate = true;
    this.baby.instanceMatrix.needsUpdate = true;
    this.log.instanceMatrix.needsUpdate = true;
  }
}
