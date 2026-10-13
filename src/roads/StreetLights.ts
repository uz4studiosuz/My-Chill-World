import * as THREE from 'three';
import { N, tileToWorld } from '../world/grid';
import { RoadNetwork, ROAD_RING } from './RoadNetwork';
import { box, merge } from '../utils/voxel';
import { glowTexture } from '../fx/NightGlow';

const MAX = 3000;
/** Real point lights placed on the lamps closest to the camera. */
const REAL = 10;
const LIT = new THREE.Color('#ffd98a');
const OFF = new THREE.Color('#c9c4b6');

/**
 * Street lamps along lit road tiles (every second tile, alternating sides).
 * At night the heads glow, a soft cone of light falls from each lamp and a warm pool lights up the asphalt;
 * the lamps nearest to the camera also get real point lights that light up cars, people and walls.
 */
export class StreetLights {
  readonly group = new THREE.Group();
  /** Road tiles that have street lamps. */
  readonly lit = new Uint8Array(N * N);
  /** Lamps per road tile index (for energy accounting). */
  lamps: number[] = [];
  private poles: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private pools: THREE.InstancedMesh;
  private cones: THREE.InstancedMesh;
  private headMat = new THREE.MeshBasicMaterial({ color: OFF.clone() });
  private poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffcf7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private coneMat = new THREE.MeshBasicMaterial({ color: '#ffdf9a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private night = -1;
  /** World position of every lamp head (x, z pairs). */
  private heads2: number[] = [];
  private real: THREE.PointLight[] = [];
  private realT = 0;

  constructor(private net: RoadNetwork) {
    const pole = merge([box(0.03, 0.5, 0.03, 0, 0.25, 0, '#4a4f57'), box(0.16, 0.025, 0.025, 0.07, 0.5, 0, '#4a4f57')]);
    this.poles = this.make(pole, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
    this.heads = this.make(new THREE.BoxGeometry(0.07, 0.03, 0.05).translate(0.14, 0.48, 0), this.headMat, false);
    // elongated along the road so neighbouring lamps blend into a lit street
    this.pools = this.make(new THREE.PlaneGeometry(1.25, 1.9).rotateX(-Math.PI / 2).translate(0.2, 0.036, 0), this.poolMat, false);
    this.pools.renderOrder = 4;
    this.cones = this.make(new THREE.ConeGeometry(0.3, 0.46, 14, 1, true).translate(0.14, 0.24, 0), this.coneMat, false);
    this.cones.renderOrder = 5;
    for (let i = 0; i < REAL; i++) {
      const l = new THREE.PointLight('#ffc978', 0, 2.4, 1.6);
      l.castShadow = false;
      this.real.push(l);
      this.group.add(l);
    }
  }

  private make(geo: THREE.BufferGeometry, mat: THREE.Material, cast: boolean) {
    const m = new THREE.InstancedMesh(geo, mat, MAX);
    m.count = 0;
    m.castShadow = cast;
    m.frustumCulled = false;
    this.group.add(m);
    return m;
  }

  rebuild() {
    const { net } = this;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    this.lamps = [];
    this.heads2 = [];
    for (let k = 0; k < net.type.length && n < MAX; k++) {
      if (!net.type[k]) { this.lit[k] = 0; continue; }
      if (!this.lit[k] || net.type[k] === ROAD_RING) continue;
      const x = k % N, z = (k / N) | 0;
      const c = net.conn[k];
      const ns = c === 5 || c === 1 || c === 4, ew = c === 10 || c === 2 || c === 8;
      if (!ns && !ew) continue;
      if ((ns ? z : x) % 2 !== 0) continue;
      const side = ((ns ? z : x) / 2) % 2 === 0 ? 1 : -1;
      // lamp stands on the sidewalk edge and leans over the road
      if (ns) { p.set(tileToWorld(x) + side * 0.46, 0, tileToWorld(z)); q.setFromAxisAngle(up, side > 0 ? Math.PI : 0); }
      else { p.set(tileToWorld(x), 0, tileToWorld(z) + side * 0.46); q.setFromAxisAngle(up, side > 0 ? Math.PI / 2 : -Math.PI / 2); }
      mtx.compose(p, q, s);
      this.poles.setMatrixAt(n, mtx);
      this.heads.setMatrixAt(n, mtx);
      this.pools.setMatrixAt(n, mtx);
      this.cones.setMatrixAt(n, mtx);
      const hx = new THREE.Vector3(0.14, 0.46, 0).applyMatrix4(mtx);
      this.heads2.push(hx.x, hx.z);
      this.lamps.push(k);
      n++;
    }
    this.realT = 0;
    for (const m of [this.poles, this.heads, this.pools, this.cones]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  setLit(tiles: number[], on: boolean) {
    for (const k of tiles) this.lit[k] = on ? 1 : 0;
  }

  /** 0 = day, 1 = deep night; lamps stay dark without power. */
  setNight(v: number, powered = true) {
    const night = powered ? Math.round(v * 20) / 20 : 0;
    if (night === this.night) return;
    this.night = night;
    this.headMat.color.copy(OFF).lerp(LIT, night);
    this.poolMat.opacity = night * 0.62;
    this.coneMat.opacity = night * 0.07;
    this.pools.visible = night > 0.05;
    this.cones.visible = night > 0.05;
    for (const l of this.real) l.intensity = l.userData.on ? night * 2.2 : 0;
  }

  /** Move the real lights to the lamps closest to the view centre. */
  update(dt: number, cx: number, cz: number) {
    this.realT -= dt;
    if (this.realT > 0) return;
    this.realT = 0.5;
    const h = this.heads2, n = h.length / 2;
    const best: { d: number; i: number }[] = [];
    for (let i = 0; i < n; i++) {
      const d = (h[i * 2] - cx) ** 2 + (h[i * 2 + 1] - cz) ** 2;
      if (d > 400) continue;
      if (best.length < REAL) { best.push({ d, i }); best.sort((a, b) => a.d - b.d); }
      else if (d < best[REAL - 1].d) { best[REAL - 1] = { d, i }; best.sort((a, b) => a.d - b.d); }
    }
    this.real.forEach((l, j) => {
      const b = best[j];
      // lights stay in the scene (changing the light count would recompile every shader)
      l.userData.on = !!b;
      if (b) l.position.set(h[b.i * 2], 0.42, h[b.i * 2 + 1]);
      l.intensity = b && this.night > 0 ? this.night * 2.2 : 0;
    });
  }
}
