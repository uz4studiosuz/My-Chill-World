import * as THREE from 'three';
import { Tile, tileToWorld } from '../world/grid';

/** Translucent tile highlights shown while hovering / dragging a tool. */
export class Preview {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();

  constructor(max: number) {
    const geo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.setColorAt(0, new THREE.Color('#ffffff'));
    this.mesh.count = 0;
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
  }

  show(tiles: Tile[], color: THREE.Color) {
    const n = Math.min(tiles.length, this.mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      this.m.makeTranslation(tileToWorld(tiles[i].x), 0.06, tileToWorld(tiles[i].z));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  hide() {
    this.mesh.count = 0;
  }
}
