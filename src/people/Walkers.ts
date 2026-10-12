import * as THREE from 'three';
import { N, tileToWorld } from '../world/grid';
import { PERSON_VARIANTS, babyGeometry, logGeometry, personGeometry } from '../models/people';
import type { Point } from '../buildings/Buildings';

export type Carry = 'none' | 'log' | 'baby';

export interface Walker {
  id: number;
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
  anim: 'none' | 'chop' | 'farm';
  phase: number;
  onArrive?: (w: Walker) => void;
  onHoldEnd?: (w: Walker) => void;
}

export interface WalkRoute {
  from: Point;
  to: Point;
  /** Tile path between the two points (from A*). */
  tiles: number[];
}

const MAX_PER_VARIANT = 400;
const SIDEWALK = 0.43;

/** Pedestrians: walking along footpaths / sidewalks / fields, carrying logs or babies, working. */
export class Walkers {
  readonly group = new THREE.Group();
  readonly list: Walker[] = [];
  private nextId = 1;
  private meshes: THREE.InstancedMesh[] = [];
  private baby: THREE.InstancedMesh;
  private log: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private time = 0;

  constructor(private isRoad: (k: number) => boolean) {
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
  }

  walk(variant: number, scale: number, route: WalkRoute, carry: Carry = 'none', onArrive?: (w: Walker) => void): Walker {
    const w: Walker = {
      id: this.nextId++, variant, scale, carry, pts: [], cum: [], len: 0, s: 0, seg: 0,
      speed: 0.9 * (scale < 0.9 ? 0.8 : 1), x: route.from.x, z: route.from.z, hx: 0, hz: 1,
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
      w.s += w.speed * dt;
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
    push(r.from.x, r.from.z);
    const t = r.tiles;
    for (let i = 0; i < t.length; i++) {
      const k = t[i];
      let cx = tileToWorld(k % N), cz = tileToWorld((k / N) | 0);
      if (this.isRoad(k) && t.length > 1) {
        // keep to the right-hand sidewalk
        const a = t[Math.max(0, i - 1)], b = t[Math.min(t.length - 1, i + 1)];
        let dx = (b % N) - (a % N), dz = ((b / N) | 0) - ((a / N) | 0);
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        cx += -dz * SIDEWALK;
        cz += dx * SIDEWALK;
      }
      push(cx, cz);
    }
    push(r.to.x, r.to.z);
    if (pts.length < 4) push(r.to.x + 0.001, r.to.z);
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
    let nb = 0, nl = 0;
    for (const w of this.list) {
      const tt = this.time * 9 + w.phase;
      const walking = w.hold <= 0 && !w.leaving;
      const bob = walking ? Math.abs(Math.sin(tt)) * 0.008 : 0;
      let tilt = 0;
      if (w.anim === 'chop') tilt = Math.max(0, Math.sin(tt * 0.7)) * 0.5;
      if (w.anim === 'farm') tilt = 0.35 + Math.sin(tt * 0.3) * 0.1;
      this.e.set(tilt, Math.atan2(w.hx, w.hz), walking ? Math.sin(tt) * 0.06 : 0, 'YXZ');
      this.q.setFromEuler(this.e);
      const s = w.scale * w.fade;
      this.p.set(w.x, 0.02 + bob, w.z);
      this.sc.set(s, s, s);
      this.m.compose(this.p, this.q, this.sc);
      const mesh = this.meshes[w.variant];
      if (counts[w.variant] < MAX_PER_VARIANT) mesh.setMatrixAt(counts[w.variant]++, this.m);
      if (w.carry === 'baby' && nb < MAX_PER_VARIANT) this.baby.setMatrixAt(nb++, this.m);
      if (w.carry === 'log' && nl < MAX_PER_VARIANT) this.log.setMatrixAt(nl++, this.m);
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
    this.baby.count = nb;
    this.log.count = nl;
    this.baby.instanceMatrix.needsUpdate = true;
    this.log.instanceMatrix.needsUpdate = true;
  }
}
