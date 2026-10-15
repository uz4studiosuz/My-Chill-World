import * as THREE from 'three';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';
import { FlatBuilder } from './Footpaths';


/**
 * Underground water pipes. Water mains run under every road anyway; pipes carry water to towers and homes
 * that are not on a road. The pipes are drawn only while the player looks at the water network.
 */
export class Pipes {
  readonly tiles = new Uint8Array(N * N);
  readonly mesh: THREE.Mesh;
  private color: THREE.Color;

  /** `shift` moves the drawn line off the tile centre (cables beside the pipes). */
  constructor(color = '#3a8fd1', private shift = 0) {
    this.color = new THREE.Color(color);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    this.mesh.renderOrder = 7;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  add(path: Tile[]) { for (const t of path) this.tiles[idx(t.x, t.z)] = 1; }

  remove(path: Tile[]) {
    let n = 0;
    for (const t of path) { const k = idx(t.x, t.z); if (this.tiles[k]) { this.tiles[k] = 0; n++; } }
    return n;
  }

  serialize() { const out: number[] = []; for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k]) out.push(k); return out; }
  deserialize(list: number[] = []) { this.tiles.fill(0); for (const k of list) if (k >= 0 && k < this.tiles.length) this.tiles[k] = 1; }

  rebuild() {
    const b = new FlatBuilder();
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (!this.tiles[idx(x, z)]) continue;
      const cx = tileToWorld(x) + this.shift, cz = tileToWorld(z) + this.shift, w = 0.06, y = 0.05;
      const PIPE = this.color;
      b.rect(cx - w, cz - w, cx + w, cz + w, y, PIPE);
      for (const d of DIRS) {
        if (!inBounds(x + d.dx, z + d.dz) || !this.tiles[idx(x + d.dx, z + d.dz)]) continue;
        if (d.dx) b.rect(cx, cz - w, cx + d.dx * 0.5, cz + w, y, PIPE);
        else b.rect(cx - w, cz, cx + w, cz + d.dz * 0.5, y, PIPE);
      }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = b.geometry();
  }
}
