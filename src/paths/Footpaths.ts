import * as THREE from 'three';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';

const PAVER = new THREE.Color('#e3c565');
const EDGE = new THREE.Color('#b99a46');
const Y = 0.012;
const HALF = 0.11;

/** Free walking paths for pedestrians: a narrow, continuous yellow track joining neighbouring paths and roads. */
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

  /** `linked(k)` — neighbour tile a path should visually join (a road, a building door…). */
  rebuild(linked: (k: number) => boolean = () => false) {
    const b = new FlatBuilder();
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (!this.tiles[idx(x, z)]) continue;
        const cx = tileToWorld(x), cz = tileToWorld(z);
        for (const [h, y, c] of [[HALF + 0.025, Y, EDGE], [HALF, Y + 0.002, PAVER]] as const) {
          b.rect(cx - h, cz - h, cx + h, cz + h, y, c);
          for (const d of DIRS) {
            const nx = x + d.dx, nz = z + d.dz;
            if (!inBounds(nx, nz)) continue;
            const nk = idx(nx, nz);
            if (!this.tiles[nk] && !linked(nk)) continue;
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
    this.version++;
  }
}

/** Upward-facing rectangles with vertex colours; corners may be given in any order. */
export class FlatBuilder {
  private pos: number[] = [];
  private col: number[] = [];

  rect(x0: number, z0: number, x1: number, z1: number, y: number, c: THREE.Color) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    this.pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    for (let i = 0; i < 6; i++) this.col.push(c.r, c.g, c.b);
  }

  geometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const normals = new Float32Array(this.pos.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return geo;
  }
}
