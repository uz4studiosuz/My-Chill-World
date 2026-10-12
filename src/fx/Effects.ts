import * as THREE from 'three';
import { Tile, tileToWorld } from '../world/grid';
import { carGeometry } from '../models/vehicles';

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  delay: number;
  color: THREE.Color;
  flat: boolean;
  /** Smoke: floats up and grows instead of falling. */
  rise?: boolean;
}

const MAX = 600;
const DUST = ['#d8d2c4', '#c9c1ae', '#e8e3d6', '#b9b09c'];

/** Small juice effects: dust puffs for building/removing, a "paving" shine for new roads. */
export class Effects {
  readonly group = new THREE.Group();
  private parts: Particle[] = [];
  private cubes: THREE.InstancedMesh;
  private shines: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private wrecks: { group: THREE.Group; t: number; x: number; z: number }[] = [];
  private carGeo = carGeometry();

  constructor() {
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAX);
    const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shines = new THREE.InstancedMesh(flatGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), MAX);
    for (const m of [this.cubes, this.shines]) {
      m.setColorAt(0, new THREE.Color('#ffffff'));
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.shines.renderOrder = 5;
  }

  /** Dust cloud, e.g. when a building appears or is removed. */
  puff(x: number, z: number, radius: number, count = 14, palette = DUST) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.add({
        x: x + Math.cos(a) * r, y: 0.05, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * (0.4 + Math.random() * 0.6), vy: 0.6 + Math.random() * 0.8, vz: Math.sin(a) * (0.4 + Math.random() * 0.6),
        life: 0, max: 0.6 + Math.random() * 0.4, size: 0.06 + Math.random() * 0.08, delay: 0,
        color: new THREE.Color(palette[Math.floor(Math.random() * palette.length)]), flat: false,
      });
    }
  }

  /** A wave of light squares running along a freshly paved road. */
  pave(tiles: Tile[]) {
    tiles.forEach((t, i) => {
      const x = tileToWorld(t.x), z = tileToWorld(t.z);
      this.add({ x, y: 0.05, z, vx: 0, vy: 0, vz: 0, life: 0, max: 0.45, size: 1, delay: i * 0.025, color: new THREE.Color('#ffffff'), flat: true });
      if (i % 2 === 0) this.puff(x, z, 0.4, 2);
    });
  }

  /** A puff of chimney smoke. */
  smoke(x: number, y: number, z: number) {
    const g = 0.55 + Math.random() * 0.2;
    this.add({
      x: x + (Math.random() - 0.5) * 0.06, y, z: z + (Math.random() - 0.5) * 0.06,
      vx: 0.12 + Math.random() * 0.08, vy: 0.35 + Math.random() * 0.15, vz: -0.05,
      life: 0, max: 3 + Math.random(), size: 0.08, delay: 0, color: new THREE.Color(g, g, g), flat: false, rise: true,
    });
  }

  /** Flames and sparks rising from a burning spot. */
  fire(x: number, z: number, spread: number) {
    const cols = ['#ff7a1a', '#ffb02e', '#ff4d1a', '#ffd166'];
    for (let i = 0; i < 3; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * spread, y: 0.05 + Math.random() * 0.3, z: z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 0.1, vy: 0.5 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.1,
        life: 0, max: 0.6 + Math.random() * 0.5, size: 0.07 + Math.random() * 0.06, delay: 0,
        color: new THREE.Color(cols[Math.floor(Math.random() * cols.length)]), flat: false, rise: true,
      });
    }
    if (Math.random() < 0.3) this.smoke(x, 0.6, z);
  }

  /** Little pink hearts (weddings). */
  hearts(x: number, z: number) {
    for (let i = 0; i < 14; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 0.5, y: 0.4 + Math.random() * 0.3, z: z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 0.2, vy: 0.4 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.2,
        life: 0, max: 1.4 + Math.random(), size: 0.05, delay: i * 0.05, color: new THREE.Color(i % 2 ? '#ff6fa5' : '#ffd1e3'), flat: false, rise: true,
      });
    }
  }

  private add(p: Particle) {
    if (this.parts.length < MAX * 2) this.parts.push(p);
  }

  /** Two crashed cars with smoke, cleared after a while. */
  wreck(x: number, z: number) {
    const g = new THREE.Group();
    const colors = ['#d9443b', '#3a6fd1', '#f2f2ee', '#4c9a52'];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(this.carGeo, new THREE.MeshLambertMaterial({ vertexColors: true, color: colors[Math.floor(Math.random() * colors.length)] }));
      m.position.set(x + (i ? 0.14 : -0.1), 0.03, z + (i ? -0.06 : 0.08));
      m.rotation.y = Math.random() * Math.PI * 2;
      m.rotation.z = i ? 0.12 : -0.08;
      m.castShadow = true;
      g.add(m);
    }
    this.group.add(g);
    this.wrecks.push({ group: g, t: 30, x, z });
    this.puff(x, z, 0.25, 10, ['#6b6b6b', '#3a3a3a', '#d8d2c4']);
  }

  update(dt: number) {
    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const w = this.wrecks[i];
      w.t -= dt;
      if (Math.random() < dt * 3) this.smoke(w.x, 0.15, w.z);
      if (w.t <= 0) {
        this.group.remove(w.group);
        w.group.traverse((o) => { const m = o as THREE.Mesh; if (m.material) (m.material as THREE.Material).dispose(); });
        this.wrecks.splice(i, 1);
      }
    }
    let nc = 0, ns = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      const t = p.life / p.max;
      if (p.flat) {
        if (ns >= MAX) continue;
        const sc = 0.4 + 0.6 * Math.sin(t * Math.PI);
        this.s.set(sc, 1, sc);
        this.p.set(p.x, p.y, p.z);
        this.q.identity();
        this.m.compose(this.p, this.q, this.s);
        this.shines.setMatrixAt(ns, this.m);
        this.shines.setColorAt(ns++, p.color);
      } else {
        if (nc >= MAX) continue;
        if (!p.rise) {
          p.vy -= dt * 2.2;
          p.vx *= 0.96; p.vz *= 0.96;
        }
        p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt;
        const sc = p.rise ? p.size * (1 + t * 2.5) * (1 - t * t * t) : p.size * (1 - t * t);
        this.s.set(sc, sc, sc);
        this.p.set(p.x, p.y, p.z);
        this.q.setFromAxisAngle(this.p.clone().set(0, 1, 0), p.life * 4);
        this.m.compose(this.p, this.q, this.s);
        this.cubes.setMatrixAt(nc, this.m);
        this.cubes.setColorAt(nc++, p.color);
      }
    }
    this.cubes.count = nc;
    this.shines.count = ns;
    for (const m of [this.cubes, this.shines]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
