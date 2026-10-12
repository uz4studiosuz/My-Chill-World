import * as THREE from 'three';
import { N, tileToWorld } from '../world/grid';
import { RoadNetwork, ROAD_RING } from './RoadNetwork';
import { box, merge } from '../utils/voxel';

const MAX = 3000;
const LIT = new THREE.Color('#ffd98a');
const OFF = new THREE.Color('#c9c4b6');

/**
 * Street lamps along straight road tiles (every third tile, alternating sides).
 * At night the lamp heads glow warm and a soft pool of light appears on the asphalt.
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
  private headMat = new THREE.MeshBasicMaterial({ color: OFF.clone() });
  private poolMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private night = -1;

  constructor(private net: RoadNetwork) {
    const pole = merge([box(0.03, 0.5, 0.03, 0, 0.25, 0, '#4a4f57'), box(0.16, 0.025, 0.025, 0.07, 0.5, 0, '#4a4f57')]);
    this.poles = this.make(pole, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
    this.heads = this.make(new THREE.BoxGeometry(0.07, 0.03, 0.05).translate(0.14, 0.48, 0), this.headMat, false);
    this.pools = this.make(new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2).translate(0.14, 0.035, 0), this.poolMat, false);
    this.pools.renderOrder = 4;
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
      this.lamps.push(k);
      n++;
    }
    for (const m of [this.poles, this.heads, this.pools]) {
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
    this.poolMat.opacity = night * 0.22;
    this.pools.visible = night > 0.05;
  }
}
