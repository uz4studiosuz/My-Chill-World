import * as THREE from 'three';
import { N } from '../world/grid';

const DISTANCE = 80;

/** Orthographic "isometric" camera that orbits around a ground target. */
export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  readonly target = new THREE.Vector3();
  readonly pitch = THREE.MathUtils.degToRad(50);
  readonly minView = 3.5;
  readonly maxView = 48;
  yaw = Math.PI / 4;
  viewHalf = 11;
  aspect = 1;

  private yawGoal = this.yaw;
  /** A smooth flight to a place (cancelled when the player moves the camera). */
  private fly: { x0: number; z0: number; v0: number; x1: number; z1: number; v1: number; t: number; d: number } | null = null;
  private rect: DOMRect;
  /** Zooming out further at the widest view: past a little more, the world turns into a globe. */
  onPastMax?: () => void;
  private over = 0;
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
    this.fly = null;
    if (this.groundAt(fromX, fromY, this.a) && this.groundAt(toX, toY, this.b)) {
      this.target.add(this.a.sub(this.b));
      this.clamp();
      this.apply();
    }
  }

  /** Zoom keeping the ground point under the cursor fixed. */
  zoomAt(factor: number, clientX: number, clientY: number) {
    this.fly = null;
    if (factor > 1 && this.viewHalf >= this.maxView - 0.01) {
      this.over += Math.log(factor);
      if (this.over > 0.45) { this.over = 0; this.onPastMax?.(); }
      return;
    }
    this.over = 0;
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
    this.fly = null;
    const s = this.viewHalf * 1.4;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.target.x += (cy * dx - sy * dz) * s;
    this.target.z += (-sy * dx - cy * dz) * s;
    this.clamp();
    this.apply();
  }

  /** Fly smoothly to a place on the map, ending at zoom `view`. */
  flyTo(x: number, z: number, view = this.viewHalf, seconds = 1.2) {
    this.fly = { x0: this.target.x, z0: this.target.z, v0: this.viewHalf, x1: x, z1: z, v1: THREE.MathUtils.clamp(view, this.minView, this.maxView), t: 0, d: seconds };
  }

  update(dt: number) {
    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(f.d, f.t + dt);
      const k = f.t / f.d, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      // zoom out a little half way for a pleasant swoop
      const lift = Math.sin(Math.PI * k) * Math.min(8, Math.hypot(f.x1 - f.x0, f.z1 - f.z0) * 0.12);
      this.target.set(f.x0 + (f.x1 - f.x0) * e, 0, f.z0 + (f.z1 - f.z0) * e);
      this.viewHalf = THREE.MathUtils.clamp(f.v0 + (f.v1 - f.v0) * e + lift, this.minView, this.maxView);
      this.clamp();
      this.apply();
      if (f.t >= f.d) this.fly = null;
    }
    const diff = this.yawGoal - this.yaw;
    if (Math.abs(diff) > 1e-4) {
      this.yaw += diff * Math.min(1, dt * 10);
      this.apply();
    }
  }

  setState(x: number, z: number, yaw: number, view: number) {
    this.fly = null;
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
