import * as THREE from 'three';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';

const PAVER = new THREE.Color('#d8cfb9');
const EDGE = new THREE.Color('#b9ae95');
const Y = 0.012;

/** Free walking paths for pedestrians. Connected automatically to neighbouring paths. */
export class Footpaths {
  readonly tiles = new Uint8Array(N * N);
  readonly mesh: THREE.Mesh;
  version = 0;

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  add(path: Tile[]) {
    for (const t of path) this.tiles[idx(t.x, t.z)] = 1;
    this.version++;
  }

  remove(path: Tile[]) {
    let n = 0;
    for (const t of path) {
      const k = idx(t.x, t.z);
      if (this.tiles[k]) { this.tiles[k] = 0; n++; }
    }
    if (n) this.version++;
    return n;
  }

  count() {
    let n = 0;
    for (let k = 0; k < this.tiles.length; k++) n += this.tiles[k];
    return n;
  }

  /** `linked(k)` — neighbour tile a path should visually join (another path or a road). */
  rebuild(linked: (k: number) => boolean = () => false) {
    const pos: number[] = [], col: number[] = [];
    const quad = (x0: number, z0: number, x1: number, z1: number, y: number, c: THREE.Color) => {
      pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
    };
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (!this.tiles[idx(x, z)]) continue;
        const cx = tileToWorld(x), cz = tileToWorld(z);
        const h = 0.2;
        for (const [hh, y, c] of [[h + 0.03, Y, EDGE], [h, Y + 0.002, PAVER]] as const) {
          quad(cx - hh, cz - hh, cx + hh, cz + hh, y, c);
          for (const d of DIRS) {
            const nx = x + d.dx, nz = z + d.dz;
            if (!inBounds(nx, nz)) continue;
            const nk = idx(nx, nz);
            if (!this.tiles[nk] && !linked(nk)) continue;
            if (d.dx) quad(cx + d.dx * hh, cz - hh, cx + d.dx * 0.5, cz + hh, y, c);
            else quad(cx - hh, cz + d.dz * hh, cx + hh, cz + d.dz * 0.5, y, c);
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const normals = new Float32Array(pos.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
  }

  serialize() {
    const out: number[] = [];
    for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k]) out.push(k);
    return out;
  }

  deserialize(list: number[] = []) {
    this.tiles.fill(0);
    for (const k of list) if (k >= 0 && k < this.tiles.length) this.tiles[k] = 1;
    this.version++;
  }
}
