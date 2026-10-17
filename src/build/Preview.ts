import * as THREE from 'three';
import { Tile, tileToWorld } from '../world/grid';

/** Translucent tile highlights and 3D ghost preview shown while hovering / dragging a tool. */
export class Preview {
  readonly mesh: THREE.InstancedMesh;
  readonly ghostGroup = new THREE.Group();
  private ghostMesh: THREE.Mesh;
  private ghostValidMat: THREE.Material;
  private ghostInvalidMat: THREE.Material;
  private emptyGeo = new THREE.BufferGeometry();
  private m = new THREE.Matrix4();

  constructor(max: number) {
    const geo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.setColorAt(0, new THREE.Color('#ffffff'));
    this.mesh.count = 0;
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;

    this.ghostValidMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color('#94ffd2'),
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });

    this.ghostInvalidMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color('#ff4d4f'),
      vertexColors: false,
      transparent: true,
      opacity: 0.60,
      depthWrite: false,
    });

    this.ghostMesh = new THREE.Mesh(this.emptyGeo, this.ghostValidMat);
    this.ghostMesh.renderOrder = 14;
    this.ghostMesh.frustumCulled = false;
    this.ghostGroup.add(this.ghostMesh);
    this.ghostGroup.visible = false;
  }

  /** Height of the ground at a tile (set by the game): a line drawn over a mountain shows on top of it. */
  heightAt?: (x: number, z: number) => number;

  show(tiles: Tile[], color: THREE.Color) {
    const n = Math.min(tiles.length, this.mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      this.m.makeTranslation(tileToWorld(tiles[i].x), this.heightAt?.(tiles[i].x, tiles[i].z) ?? 0.06, tileToWorld(tiles[i].z));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  showGhost(geo: THREE.BufferGeometry, x: number, z: number, size: number, rot: number, valid: boolean) {
    this.ghostMesh.geometry = geo;
    this.ghostMesh.material = valid ? this.ghostValidMat : this.ghostInvalidMat;
    this.ghostMesh.position.set(tileToWorld(x) + (size - 1) / 2, 0.04, tileToWorld(z) + (size - 1) / 2);
    this.ghostMesh.rotation.y = rot;
    this.ghostGroup.visible = true;
  }

  hideGhost() {
    this.ghostGroup.visible = false;
  }

  hide() {
    this.mesh.count = 0;
    this.hideGhost();
  }
}

