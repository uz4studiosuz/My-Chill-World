import * as THREE from 'three';
import { N, idx, inBounds, worldToTile } from '../world/grid';
import type { WorldMap } from '../world/WorldMap';
import type { RoadNetwork } from '../roads/RoadNetwork';
import type { Buildings } from '../buildings/Buildings';
import type { Traffic } from '../traffic/Traffic';
import { carGeometry } from '../models/vehicles';
import { headlightGeometry } from '../models/extras';
import { glowTexture, nightLevel } from '../fx/NightGlow';
import { t } from '../i18n/i18n';

const ROAD_MAX = 2.4;
const GRASS_MAX = 0.9;
const ACCEL = 1.6;
const BRAKE = 3.2;

interface DriveCtx { map: WorldMap; net: RoadNetwork; buildings: Buildings; traffic: Traffic }

/**
 * The player takes the wheel: WASD / arrows (or the on-screen pedals) drive a car through the town.
 * Roads are fast, grass is slow; buildings, water, mountains and other cars block the way.
 */
export class DriveMode {
  readonly group = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 90);
  private car: THREE.Mesh;
  private beam: THREE.Mesh;
  private x = 0; z = 0;
  private heading = 0;
  private speed = 0;
  private steer = 0;
  private keys = new Set<string>();
  private touch = { up: false, down: false, left: false, right: false };
  private view: 'cockpit' | 'chase' = 'cockpit';
  private ui?: HTMLDivElement;
  private speedo?: HTMLSpanElement;
  private abort?: AbortController;
  active = false;
  onExit: () => void = () => {};

  constructor(private c: DriveCtx) {
    this.car = new THREE.Mesh(carGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, color: '#d9443b' }));
    this.car.castShadow = true;
    this.beam = new THREE.Mesh(headlightGeometry(), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#fff2c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.beam.renderOrder = 4;
    this.group.add(this.car, this.beam);
    this.group.visible = false;
  }

  get pos() { return { x: this.x, z: this.z }; }

  start(x: number, z: number, heading: number, parent: HTMLElement, color?: THREE.Color) {
    this.x = x; this.z = z; this.heading = heading; this.speed = 0; this.steer = 0;
    if (color) (this.car.material as THREE.MeshLambertMaterial).color.copy(color);
    this.active = true;
    this.group.visible = true;
    this.view = 'cockpit';
    this.abort = new AbortController();
    const sig = { signal: this.abort.signal };
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'KeyC' && !e.repeat) this.toggleView();
      if (e.code === 'Escape') this.stop();
    }, sig);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), sig);
    window.addEventListener('blur', () => this.keys.clear(), sig);
    this.buildUi(parent);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.group.visible = false;
    this.abort?.abort();
    this.keys.clear();
    this.ui?.remove();
    this.ui = undefined;
    this.onExit();
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private toggleView() { this.view = this.view === 'cockpit' ? 'chase' : 'cockpit'; }

  private buildUi(parent: HTMLElement) {
    const ui = document.createElement('div');
    ui.className = 'drive-ui';
    const bar = document.createElement('div');
    bar.className = 'pov-bar drive-bar';
    this.speedo = document.createElement('span');
    const cam = document.createElement('button');
    cam.className = 'btn-mini ghost';
    cam.textContent = t('Camera (C)');
    cam.addEventListener('click', () => this.toggleView());
    const exit = document.createElement('button');
    exit.className = 'btn-mini';
    exit.textContent = t('Get out (Esc)');
    exit.addEventListener('click', () => this.stop());
    bar.append(this.speedo, cam, exit);
    // on-screen pedals and steering for touch screens
    const pad = (cls: string, label: string, key: keyof DriveMode['touch']) => {
      const b = document.createElement('button');
      b.className = `drive-pad ${cls}`;
      b.textContent = label;
      const on = (v: boolean) => (e: Event) => { e.preventDefault(); this.touch[key] = v; };
      b.addEventListener('pointerdown', on(true));
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, on(false));
      return b;
    };
    const left = document.createElement('div');
    left.className = 'drive-pads left';
    left.append(pad('l', '◀', 'left'), pad('r', '▶', 'right'));
    const right = document.createElement('div');
    right.className = 'drive-pads right';
    right.append(pad('b', '▼', 'down'), pad('g', '▲', 'up'));
    ui.append(bar, left, right);
    parent.appendChild(ui);
    this.ui = ui;
  }

  /** Can the car stand at this point? */
  private free(x: number, z: number) {
    const tx = worldToTile(x), tz = worldToTile(z);
    if (!inBounds(tx, tz)) return false;
    const k = idx(tx, tz);
    const { map, net, buildings, traffic } = this.c;
    if (net.type[k]) return !traffic.vehicleNear(x, z, 0.16);
    if (!map.isLand(k)) return false;
    return buildings.occ[k] === -1;
  }

  update(dt: number) {
    if (!this.active) return;
    const k = this.keys, tc = this.touch;
    const up = k.has('KeyW') || k.has('ArrowUp') || tc.up;
    const down = k.has('KeyS') || k.has('ArrowDown') || tc.down;
    const left = k.has('KeyA') || k.has('ArrowLeft') || tc.left;
    const right = k.has('KeyD') || k.has('ArrowRight') || tc.right;
    const tile = idx(Math.max(0, Math.min(N - 1, worldToTile(this.x))), Math.max(0, Math.min(N - 1, worldToTile(this.z))));
    const onRoad = this.c.net.type[tile] !== 0;
    const max = onRoad ? ROAD_MAX : GRASS_MAX;
    if (up) this.speed = Math.min(max, this.speed + ACCEL * dt);
    else if (down) this.speed = Math.max(-0.8, this.speed - (this.speed > 0 ? BRAKE : ACCEL * 0.6) * dt);
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 0.9 * dt);
    if (this.speed > max) this.speed = Math.max(max, this.speed - BRAKE * dt);
    const want = (left ? 1 : 0) - (right ? 1 : 0);
    this.steer += (want - this.steer) * Math.min(1, dt * 6);
    this.heading += this.steer * dt * 2.2 * Math.max(-1, Math.min(1, this.speed / 0.8));
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const ahead = 0.16 * Math.sign(this.speed || 1);
    if (this.free(nx + Math.sin(this.heading) * ahead, nz + Math.cos(this.heading) * ahead)) { this.x = nx; this.z = nz; }
    else this.speed *= -0.25; // bump
    this.car.position.set(this.x, 0.03, this.z);
    this.car.rotation.y = this.heading;
    this.beam.position.copy(this.car.position);
    this.beam.rotation.y = this.heading;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = nightLevel.value * 0.55;
    // camera
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    if (this.view === 'cockpit') {
      this.car.visible = false;
      this.camera.position.set(this.x - fx * 0.02, 0.14, this.z - fz * 0.02);
      this.camera.lookAt(this.x + fx, 0.12, this.z + fz);
    } else {
      this.car.visible = true;
      this.camera.position.set(this.x - fx * 0.9, 0.45, this.z - fz * 0.9);
      this.camera.lookAt(this.x + fx * 0.4, 0.1, this.z + fz * 0.4);
    }
    this.camera.updateMatrixWorld();
    if (this.speedo) this.speedo.textContent = `${Math.round(Math.abs(this.speed) * 25)} ${t('km/h')} · ${onRoad ? t('Road') : t('Off-road')}`;
  }
}
