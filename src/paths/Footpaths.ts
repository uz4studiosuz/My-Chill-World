import * as THREE from 'three';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';

/** Each style: surface, edging and (for boards and pavers) the colour of the joints. */
const STYLES: Record<number, { top: THREE.Color; edge: THREE.Color; joint?: THREE.Color; half?: number }> = {
  1: { top: new THREE.Color('#e3c565'), edge: new THREE.Color('#b99a46') },
  2: { top: new THREE.Color('#a9adb3'), edge: new THREE.Color('#7b8087'), joint: new THREE.Color('#8f949b') },
  3: { top: new THREE.Color('#b8614a'), edge: new THREE.Color('#e3d6c4'), joint: new THREE.Color('#99503d') },
  4: { top: new THREE.Color('#d9ccae'), edge: new THREE.Color('#a59a80'), half: 0.1 },
  5: { top: new THREE.Color('#a8794d'), edge: new THREE.Color('#6b4a2e'), joint: new THREE.Color('#8a5f3a'), half: 0.12 },
};
const Y = 0.012;
const HALF = 0.11;

const DIAGS = [
  { dx: 1, dz: 1 },
  { dx: -1, dz: 1 },
  { dx: 1, dz: -1 },
  { dx: -1, dz: -1 },
] as const;

/** Free walking paths for pedestrians: a narrow, continuous yellow track joining neighbouring paths. */
export class Footpaths {
  readonly tiles = new Uint8Array(N * N);
  readonly mesh: THREE.Mesh;
  version = 0;
  /** Neighbouring tiles that a path should visibly lead into (roads, building entrances). */
  attach: (k: number) => boolean = () => false;

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** Lay a path of a style (1 pavers · 2 stone · 3 brick · 4 gravel · 5 boardwalk). */
  add(path: Tile[], style = 1) {
    for (const t of path) this.tiles[idx(t.x, t.z)] = style;
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
    for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k]) n++;
    return n;
  }

  /** Rebuild footpath mesh with cardinal and diagonal connections. */
  rebuild(_linked: (k: number) => boolean = () => false) {
    const b = new FlatBuilder();
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const style = this.tiles[idx(x, z)];
        if (!style) continue;
        const st = STYLES[style] ?? STYLES[1];
        const half = st.half ?? HALF;
        const cx = tileToWorld(x), cz = tileToWorld(z);
        // joints across the surface: planks of a boardwalk, setts of a stone path, a brick pattern
        if (st.joint) {
          for (let i = -2; i <= 2; i++) {
            const o = i * half * 0.45;
            b.rect(cx - half, cz + o - 0.004, cx + half, cz + o + 0.004, Y + 0.004, st.joint);
            if (style !== 5) b.rect(cx + o - 0.004, cz - half, cx + o + 0.004, cz + half, Y + 0.004, st.joint);
          }
        }
        for (const [h, y, c] of [[half + 0.025, Y, st.edge], [half, Y + 0.002, st.top]] as const) {
          b.rect(cx - h, cz - h, cx + h, cz + h, y, c);
          for (const d of DIRS) {
            const nx = x + d.dx, nz = z + d.dz;
            if (!inBounds(nx, nz)) continue;
            const nk = idx(nx, nz);
            if (!this.tiles[nk] && !this.attach(nk)) continue;
            if (d.dx) b.rect(cx + d.dx * h, cz - h, cx + d.dx * 0.5, cz + h, y, c);
            else b.rect(cx - h, cz + d.dz * h, cx + h, cz + d.dz * 0.5, y, c);
          }
          for (const d of DIAGS) {
            const nx = x + d.dx, nz = z + d.dz;
            if (!inBounds(nx, nz)) continue;
            if (!this.tiles[idx(nx, nz)]) continue;
            const px = -d.dz * 0.7071 * h, pz = d.dx * 0.7071 * h;
            const mx = cx + d.dx * 0.5, mz = cz + d.dz * 0.5;
            b.quad(
              cx - px, cz - pz,
              cx + px, cz + pz,
              mx + px, mz + pz,
              mx - px, mz - pz,
              y, c,
            );
          }
        }
      }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = b.geometry();
  }

  serialize() {
    // the plain paths are saved as their tile number; other styles add style × tiles (old saves read the same)
    const out: number[] = [];
    const NN = this.tiles.length;
    for (let k = 0; k < NN; k++) if (this.tiles[k]) out.push(this.tiles[k] === 1 ? k : k + (this.tiles[k] - 1) * NN);
    return out;
  }

  deserialize(list: number[] = []) {
    this.tiles.fill(0);
    const NN = this.tiles.length;
    for (const v of list) {
      if (v < 0) continue;
      const k = v % NN, style = 1 + Math.floor(v / NN);
      if (style <= 5) this.tiles[k] = style;
    }
    this.version++;
  }
}

/** Upward-facing rectangles and quads with vertex colours. */
export class FlatBuilder {
  private pos: number[] = [];
  private col: number[] = [];

  rect(x0: number, z0: number, x1: number, z1: number, y: number, c: THREE.Color) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    this.pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    for (let i = 0; i < 6; i++) this.col.push(c.r, c.g, c.b);
  }

  quad(x0: number, z0: number, x1: number, z1: number, x2: number, z2: number, x3: number, z3: number, y: number, c: THREE.Color) {
    this.pos.push(x0, y, z0, x1, y, z1, x2, y, z2, x0, y, z0, x2, y, z2, x3, y, z3);
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
