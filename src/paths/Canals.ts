import * as THREE from 'three';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { FlatBuilder } from './Footpaths';

const BANK = new THREE.Color('#7a5a3c');
const WET = new THREE.Color('#5d4430');
const WATER = new THREE.Color('#4fa3d1');
const DRY = new THREE.Color('#9a8466');

/**
 * Irrigation canals (ariq). Water flows from rivers/lakes through connected canal tiles;
 * a crop farm next to flowing water is irrigated.
 */
export class Canals {
  readonly tiles = new Uint8Array(N * N);
  /** Canal tiles that currently carry water (connected to natural water). */
  readonly flowing = new Uint8Array(N * N);
  readonly mesh: THREE.Mesh;

  constructor(private map: WorldMap) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  add(path: Tile[]) {
    for (const t of path) this.tiles[idx(t.x, t.z)] = 1;
  }

  remove(path: Tile[]) {
    let n = 0;
    for (const t of path) {
      const k = idx(t.x, t.z);
      if (this.tiles[k]) { this.tiles[k] = 0; n++; }
    }
    return n;
  }

  count() {
    let n = 0;
    for (let k = 0; k < this.tiles.length; k++) n += this.tiles[k];
    return n;
  }

  /** Recompute which canals carry water (BFS from natural water). */
  updateFlow() {
    this.flowing.fill(0);
    const queue: number[] = [];
    for (let k = 0; k < this.tiles.length; k++) {
      if (!this.tiles[k]) continue;
      const x = k % N, z = (k / N) | 0;
      if (DIRS.some((d) => inBounds(x + d.dx, z + d.dz) && this.map.water[idx(x + d.dx, z + d.dz)])) {
        this.flowing[k] = 1;
        queue.push(k);
      }
    }
    while (queue.length) {
      const k = queue.pop()!;
      const x = k % N, z = (k / N) | 0;
      for (const d of DIRS) {
        const nx = x + d.dx, nz = z + d.dz;
        if (!inBounds(nx, nz)) continue;
        const nk = idx(nx, nz);
        if (this.tiles[nk] && !this.flowing[nk]) {
          this.flowing[nk] = 1;
          queue.push(nk);
        }
      }
    }
  }

  /** Is there flowing water (canal or natural) right next to this rectangle of tiles? */
  watered(x: number, z: number, size: number) {
    for (let i = -1; i <= size; i++) {
      for (const [tx, tz] of [[x + i, z - 1], [x + i, z + size], [x - 1, z + i], [x + size, z + i]]) {
        if (!inBounds(tx, tz)) continue;
        const k = idx(tx, tz);
        if (this.flowing[k] || this.map.water[k]) return true;
      }
    }
    return false;
  }

  rebuild() {
    this.updateFlow();
    const b = new FlatBuilder();
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const k = idx(x, z);
        if (!this.tiles[k]) continue;
        const cx = tileToWorld(x), cz = tileToWorld(z);
        const flow = this.flowing[k] === 1;
        const join = (d: { dx: number; dz: number }) => {
          const nx = x + d.dx, nz = z + d.dz;
          return inBounds(nx, nz) && (this.tiles[idx(nx, nz)] || this.map.water[idx(nx, nz)]);
        };
        const layers: [number, number, THREE.Color][] = [[0.2, 0.008, BANK], [0.14, 0.01, flow ? WET : DRY]];
        if (flow) layers.push([0.09, 0.013, WATER]);
        for (const [h, y, c] of layers) {
          b.rect(cx - h, cz - h, cx + h, cz + h, y, c);
          for (const d of DIRS) {
            if (!join(d)) continue;
            if (d.dx) b.rect(cx + d.dx * h, cz - h, cx + d.dx * 0.5, cz + h, y, c);
            else b.rect(cx - h, cz + d.dz * h, cx + h, cz + d.dz * 0.5, y, c);
          }
        }
      }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = b.geometry();
  }

  serialize() {
    const out: number[] = [];
    for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k]) out.push(k);
    return out;
  }

  deserialize(list: number[] = []) {
    this.tiles.fill(0);
    for (const k of list) if (k >= 0 && k < this.tiles.length) this.tiles[k] = 1;
  }
}
