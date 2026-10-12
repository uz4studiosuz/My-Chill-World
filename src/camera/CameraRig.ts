import * as THREE from 'three';
import { N } from '../world/grid';

const DISTANCE = 80;

/** Orthographic "isometric" camera that orbits around a ground target. */
export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  readonly target = new THREE.Vector3();
  readonly pitch = THREE.MathUtils.degToRad(50);
  readonly minView = 3.5;
  readonly maxView = 36;
  yaw = Math.PI / 4;
  viewHalf = 11;
  aspect = 1;

  private yawGoal = this.yaw;
  private rect: DOMRect;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ndc = new THREE.Vector2();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement) {
    this.rect = canvas.getBoundingClientRect();
  }

  resize(w: number, h: number) {
    this.aspect = w / Math.max(1, h);
    this.rect = this.canvas.getBoundingClientRect();
    this.apply();
  }

  apply() {
    const cp = Math.cos(this.pitch);
    const t = this.target;
    this.camera.position.set(
      t.x + Math.sin(this.yaw) * cp * DISTANCE,
      t.y + Math.sin(this.pitch) * DISTANCE,
      t.z + Math.cos(this.yaw) * cp * DISTANCE,
    );
    this.camera.left = -this.viewHalf * this.aspect;
    this.camera.right = this.viewHalf * this.aspect;
    this.camera.top = this.viewHalf;
    this.camera.bottom = -this.viewHalf;
    this.camera.lookAt(t);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Ground (y=0) point under a screen position. */
  groundAt(clientX: number, clientY: number, out: THREE.Vector3): boolean {
    const r = this.rect;
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out) !== null;
  }

  /** Drag the ground so the point under `from` ends up under `to`. */
  pan(fromX: number, fromY: number, toX: number, toY: number) {
    if (this.groundAt(fromX, fromY, this.a) && this.groundAt(toX, toY, this.b)) {
      this.target.add(this.a.sub(this.b));
      this.clamp();
      this.apply();
    }
  }

  /** Zoom keeping the ground point under the cursor fixed. */
  zoomAt(factor: number, clientX: number, clientY: number) {
    const ok = this.groundAt(clientX, clientY, this.a);
    this.viewHalf = THREE.MathUtils.clamp(this.viewHalf * factor, this.minView, this.maxView);
    this.apply();
    if (ok && this.groundAt(clientX, clientY, this.b)) {
      this.target.add(this.a.sub(this.b));
      this.clamp();
      this.apply();
    }
  }

  rotate(delta: number, animated = true) {
    this.yawGoal += delta;
    if (!animated) {
      this.yaw = this.yawGoal;
      this.apply();
    }
  }

  /** Screen-relative movement (keyboard). dx = right, dz = up/forward. */
  move(dx: number, dz: number) {
    const s = this.viewHalf * 1.4;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.target.x += (cy * dx - sy * dz) * s;
    this.target.z += (-sy * dx - cy * dz) * s;
    this.clamp();
    this.apply();
  }

  update(dt: number) {
    const diff = this.yawGoal - this.yaw;
    if (Math.abs(diff) > 1e-4) {
      this.yaw += diff * Math.min(1, dt * 10);
      this.apply();
    }
  }

  setState(x: number, z: number, yaw: number, view: number) {
    this.target.set(x, 0, z);
    this.yaw = this.yawGoal = yaw;
    this.viewHalf = THREE.MathUtils.clamp(view, this.minView, this.maxView);
    this.clamp();
    this.apply();
  }

  private clamp() {
    const lim = N / 2;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);
  }
}
