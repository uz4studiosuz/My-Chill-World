import * as THREE from 'three';
import { N, idx, inBounds, tileToWorld, worldToTile } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { mulberry32 } from '../utils/rng';
import { cowGeometry, sheepGeometry } from '../models/animals';

export interface Animal {
  kind: 0 | 1;
  x: number; z: number;
  tx: number; tz: number;
  herdX: number; herdZ: number;
  rot: number;
  idle: number;
  speed: number;
  phase: number;
}

const HERD_RADIUS = 2.5;

/** Cows and sheep that graze and wander around their herd. */
export class Animals {
  readonly group = new THREE.Group();
  readonly list: Animal[] = [];
  private meshes: THREE.InstancedMesh[];
  private rnd: () => number;
  private time = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private one = new THREE.Vector3(1, 1, 1);

  constructor(map: WorldMap, private isFree: (k: number) => boolean) {
    this.rnd = mulberry32(map.seed + 99);
    this.spawnHerds();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const cow = cowGeometry();
    const sheep = sheepGeometry();
    this.meshes = [cow, sheep].map((g, kind) => {
      const mesh = new THREE.InstancedMesh(g, mat, Math.max(1, this.list.filter((a) => a.kind === kind).length));
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });
    this.render();
  }

  private spawnHerds() {
    const rnd = this.rnd;
    for (let herd = 0; herd < 10; herd++) {
      const kind = (herd % 2) as 0 | 1;
      for (let attempt = 0; attempt < 40; attempt++) {
        const x = 4 + Math.floor(rnd() * (N - 8)), z = 4 + Math.floor(rnd() * (N - 8));
        if (Math.hypot(x - N / 2, z - N / 2) < 12 || !this.isFree(idx(x, z))) continue;
        const size = kind === 0 ? 3 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 4);
        const hx = tileToWorld(x), hz = tileToWorld(z);
        for (let i = 0; i < size; i++) {
          const a: Animal = {
            kind, x: hx + (rnd() - 0.5) * 2, z: hz + (rnd() - 0.5) * 2, tx: 0, tz: 0,
            herdX: hx, herdZ: hz, rot: rnd() * Math.PI * 2, idle: rnd() * 4,
            speed: kind === 0 ? 0.25 : 0.32, phase: rnd() * 10,
          };
          a.tx = a.x; a.tz = a.z;
          this.list.push(a);
        }
        break;
      }
    }
  }

  /** Remove animals within r of (x, z); returns how many died. */
  killNear(x: number, z: number, r: number) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (Math.hypot(a.x - x, a.z - z) < r) { this.list.splice(i, 1); n++; }
    }
    if (n) this.render();
    return n;
  }

  update(dt: number) {
    this.time += dt;
    for (const a of this.list) {
      if (a.idle > 0) {
        a.idle -= dt;
        continue;
      }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      if (d < 0.03) {
        a.idle = 2 + this.rnd() * 6;
        this.pickTarget(a);
      } else {
        const s = Math.min(d, a.speed * dt);
        a.x += (dx / d) * s;
        a.z += (dz / d) * s;
        a.rot = Math.atan2(dx, dz);
      }
    }
    this.render();
  }

  private pickTarget(a: Animal) {
    // if the pasture got built over, the herd moves to where this animal stands
    if (!this.freeAt(a.herdX, a.herdZ) && this.freeAt(a.x, a.z)) { a.herdX = a.x; a.herdZ = a.z; }
    for (let i = 0; i < 8; i++) {
      const tx = a.herdX + (this.rnd() - 0.5) * 2 * HERD_RADIUS;
      const tz = a.herdZ + (this.rnd() - 0.5) * 2 * HERD_RADIUS;
      if (this.freeAt(tx, tz)) { a.tx = tx; a.tz = tz; return; }
    }
  }

  private freeAt(x: number, z: number) {
    const tx = worldToTile(x), tz = worldToTile(z);
    return inBounds(tx, tz) && this.isFree(idx(tx, tz));
  }

  private render() {
    const counts = [0, 0];
    for (const a of this.list) {
      const moving = a.idle <= 0;
      const bob = moving ? Math.abs(Math.sin((this.time + a.phase) * 9)) * 0.015 : 0;
      this.p.set(a.x, bob, a.z);
      this.q.setFromAxisAngle(this.up, a.rot);
      this.m.compose(this.p, this.q, this.one);
      this.meshes[a.kind].setMatrixAt(counts[a.kind]++, this.m);
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
  }
}

