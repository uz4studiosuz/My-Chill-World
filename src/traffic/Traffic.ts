import * as THREE from 'three';
import { DIRS, N, oppositeBit, tileToWorld, worldToTile } from '../world/grid';
import { RoadNetwork, ROAD_RING } from '../roads/RoadNetwork';
import { RING_RADIUS } from '../roads/RoadMesh';
import { findPath } from './Pathfinder';
import { busGeometry, carGeometry, cargoGeometry, truckGeometry } from '../models/vehicles';
import { trafficLampGeometry, trafficPoleGeometry } from '../models/buildings';
import { beaconGeometry, headlightGeometry, weddingDecorGeometry } from '../models/extras';
import { glowTexture } from '../fx/NightGlow';

export type VehicleKind = 'car' | 'truck' | 'bus';
export interface Point { x: number; z: number }

export interface Trip {
  kind: VehicleKind;
  from: number;
  to: number;
  /** Where the vehicle starts / ends off the road (driveway, parking space, depot). */
  fromPos?: Point;
  toPos?: Point;
  loaded?: boolean;
  color?: THREE.Color;
  driverId?: number;
  driverName?: string;
  purpose?: string;
  fromName?: string;
  destName?: string;
  destBuildingId?: number;
  homeBuildingId?: number;
  routeId?: number;
  routeName?: string;
  routeStops?: string[];
  stopIndex?: number;
  passengers?: number[];
  /** Emergency vehicle: flashing beacon, siren, may pass red lights carefully. */
  siren?: boolean;
  /** Wedding car decorated with flowers and ribbons. */
  wedding?: boolean;
  onArrive?: (color: THREE.Color) => void;
  /** The vehicle gave up (route destroyed or hopelessly stuck). */
  onFail?: () => void;
}

export interface ParkedCar { x: number; z: number; rot: number; color: THREE.Color }

export interface Vehicle {
  id: number;
  trip: Trip;
  color: THREE.Color;
  pts: number[];
  cum: number[];
  len: number;
  seg: number;
  tiles: number[];
  tileStart: number[];
  moves: number[];
  ti: number;
  held: number[];
  s: number;
  speed: number;
  maxSpeed: number;
  halfLen: number;
  x: number; z: number; hx: number; hz: number;
  stuck: number;
  scale: number;
  leaving: boolean;
  driveIn: number;
  driveOut: number;
}

export type Light = 'green' | 'yellow' | 'red';

const LANE = 0.19;
const SPEED_FACTOR: Record<number, number> = { 1: 1, 2: 1, 3: 0.6 };
const ROAD_Y = 0.03;
const MAX_CARS = 220;
const MAX_TRUCKS = 60;
const MAX_BUSES = 12;
const MAX_PARKED = 400;
const APPEAR_SPEED = 3;
const RING_TRIM = 0.35;
/** Give up after being blocked this long (game seconds) instead of driving through others. */
const GIVE_UP = 40;

// Traffic-light cycle (seconds): E-W green, yellow, all-red, N-S green, yellow, all-red
const GREEN = 7, YELLOW = 1.5, ALL_RED = 1;
const CYCLE = 2 * (GREEN + YELLOW + ALL_RED);

const RED = new THREE.Color('#ff3b30');
const AMBER = new THREE.Color('#ffbf3a');
const LIME = new THREE.Color('#4cff6a');

export class Traffic {
  readonly group = new THREE.Group();
  readonly vehicles: Vehicle[] = [];
  private parked: ParkedCar[] = [];
  private nextId = 1;
  private holders = new Map<number, { id: number; move: number }[]>();
  private grid = new Map<number, Vehicle[]>();
  private clock = 0;
  private lights = new Map<number, number>(); // intersection tile → phase offset
  private carMesh: THREE.InstancedMesh;
  private truckMesh: THREE.InstancedMesh;
  private cargoMesh: THREE.InstancedMesh;
  private busMesh: THREE.InstancedMesh;
  private poleMesh: THREE.InstancedMesh;
  private lampMesh: THREE.InstancedMesh;
  private beaconMesh: THREE.InstancedMesh;
  private decorMesh: THREE.InstancedMesh;
  private beamMesh: THREE.InstancedMesh;
  private beamMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#fff2c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private night = 0;
  private lamps: { tile: number; travelBit: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private e = new THREE.Euler();
  private q2 = new THREE.Quaternion();
  private m2 = new THREE.Matrix4();

  constructor(private net: RoadNetwork) {
    const vc = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.carMesh = this.makeMesh(carGeometry(), vc, MAX_CARS + MAX_PARKED);
    this.carMesh.setColorAt(0, new THREE.Color('#ffffff'));
    this.truckMesh = this.makeMesh(truckGeometry(), vc, MAX_TRUCKS);
    this.cargoMesh = this.makeMesh(cargoGeometry(), vc, MAX_TRUCKS);
    this.busMesh = this.makeMesh(busGeometry(), vc, MAX_BUSES);
    this.poleMesh = this.makeMesh(trafficPoleGeometry(), vc, 1024);
    this.lampMesh = this.makeMesh(trafficLampGeometry(), new THREE.MeshBasicMaterial(), 1024);
    this.lampMesh.setColorAt(0, RED);
    this.lampMesh.castShadow = false;
    this.beaconMesh = this.makeMesh(beaconGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), 64);
    this.beaconMesh.castShadow = false;
    this.decorMesh = this.makeMesh(weddingDecorGeometry(), vc, 16);
    this.beamMesh = this.makeMesh(headlightGeometry(), this.beamMat, MAX_CARS + MAX_TRUCKS + MAX_BUSES);
    this.beamMesh.castShadow = false;
    this.beamMesh.renderOrder = 4;
  }

  /** 0 = day, 1 = night: headlights fade in. */
  setNight(v: number) {
    this.night = v;
    this.beamMat.opacity = v * 0.4;
    this.beamMesh.visible = v > 0.05;
  }

  private makeMesh(geo: THREE.BufferGeometry, mat: THREE.Material, max: number) {
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  count(kind: VehicleKind) {
    let n = 0;
    for (const v of this.vehicles) if (v.trip.kind === kind && !v.leaving) n++;
    return n;
  }

  get signalCount() { return this.lights.size; }

  /** Is this junction controlled by traffic lights? */
  hasLight(k: number) { return this.lights.has(k); }

  setParked(list: ParkedCar[]) {
    this.parked = list.slice(0, MAX_PARKED);
  }

  getVehicle(id: number): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }

  vehicleNear(x: number, z: number, radius = 0.55): Vehicle | undefined {
    let best: Vehicle | undefined;
    let bd = radius;
    for (const v of this.vehicles) {
      if (v.leaving) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  parkedNear(x: number, z: number, radius = 0.45): ParkedCar | undefined {
    let best: ParkedCar | undefined;
    let bd = radius;
    for (const p of this.parked) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  vehicleForDriver(citizenId: number): Vehicle | undefined {
    return this.vehicles.find((v) => !v.leaving && v.trip.driverId === citizenId);
  }

  vehicleForPassenger(citizenId: number): Vehicle | undefined {
    return this.vehicles.find((v) => !v.leaving && v.trip.passengers?.includes(citizenId));
  }

  addPassenger(vehicleId: number, citizenId: number): boolean {
    const v = this.getVehicle(vehicleId);
    if (!v || v.leaving) return false;
    if (!v.trip.passengers) v.trip.passengers = [];
    if (!v.trip.passengers.includes(citizenId)) v.trip.passengers.push(citizenId);
    return true;
  }

  removePassenger(vehicleId: number, citizenId: number): boolean {
    const v = this.getVehicle(vehicleId);
    if (!v || !v.trip.passengers) return false;
    const idx = v.trip.passengers.indexOf(citizenId);
    if (idx >= 0) {
      v.trip.passengers.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Can this trip be driven at all? */
  canRoute(from: number, to: number) {
    const p = findPath(this.net, from, to);
    return !!p && p.length >= 2;
  }

  spawnVehicle(trip: Trip): Vehicle | null {
    if (this.count(trip.kind) >= (trip.kind === 'car' ? MAX_CARS : trip.kind === 'bus' ? MAX_BUSES : MAX_TRUCKS)) return null;
    const tiles = findPath(this.net, trip.from, trip.to);
    if (!tiles || tiles.length < 2) return null;
    const r = this.buildRoute(tiles, trip.fromPos, trip.toPos);
    const truck = trip.kind === 'truck';
    const v: Vehicle = {
      id: this.nextId++, trip, color: trip.color ?? new THREE.Color('#ffffff'),
      ...r, seg: 0, tiles, ti: 0, held: [], s: 0, speed: 0,
      maxSpeed: (truck ? 2.3 : trip.kind === 'bus' ? 2.6 : 3.2) * (0.9 + Math.random() * 0.2),
      halfLen: truck ? 0.23 : trip.kind === 'bus' ? 0.27 : 0.16,
      x: r.pts[0], z: r.pts[1], hx: 0, hz: 1, stuck: 0, scale: 0, leaving: false,
    };
    this.place(v);
    this.vehicles.push(v);
    return v;
  }

  spawn(trip: Trip): boolean {
    return this.spawnVehicle(trip) !== null;
  }

  /** Road network changed: rebuild signals, reroute vehicles whose route broke. */
  networkChanged() {
    this.lights.clear();
    this.lamps = [];
    for (let k = 0; k < this.net.type.length; k++) {
      if (!this.net.type[k] || !this.net.isIntersection(k)) continue;
      this.lights.set(k, ((k * 7919) % 97) / 97 * CYCLE);
      for (const d of DIRS) {
        if (this.net.conn[k] & d.bit) this.lamps.push({ tile: k, travelBit: oppositeBit(d.bit) });
      }
    }
    this.placePoles();
    for (const v of this.vehicles) {
      if (v.leaving || this.routeIntact(v)) continue;
      this.releaseAll(v);
      const cur = v.tiles[v.ti];
      const tiles = this.net.type[cur] ? findPath(this.net, cur, v.trip.to) : null;
      if (tiles && tiles.length >= 2) {
        Object.assign(v, this.buildRoute(tiles, undefined, v.trip.toPos), { tiles, ti: 0, seg: 0, s: 0 });
      } else {
        v.leaving = true;
        v.trip.onFail?.();
      }
    }
  }

  /** Signal for a vehicle entering intersection k travelling in direction `travelBit`. */
  light(k: number, travelBit: number): Light {
    const off = this.lights.get(k);
    if (off === undefined) return 'green';
    const t = (this.clock + off) % CYCLE;
    const eastWest = travelBit === 2 || travelBit === 8;
    const phase = eastWest ? t : (t + CYCLE / 2) % CYCLE;
    if (phase < GREEN) return 'green';
    if (phase < GREEN + YELLOW) return 'yellow';
    return 'red';
  }

  private routeIntact(v: Vehicle) {
    for (let j = v.ti; j < v.tiles.length; j++) {
      if (!this.net.type[v.tiles[j]]) return false;
      if (j + 1 < v.tiles.length && !(this.net.allowed(v.tiles[j]) & dirBetween(v.tiles[j], v.tiles[j + 1]).bit)) return false;
    }
    return true;
  }

  update(dt: number) {
    this.clock += dt;
    this.grid.clear();
    for (const v of this.vehicles) {
      if (v.leaving) continue;
      const k = worldToTile(v.z) * N + worldToTile(v.x);
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push(v);
    }

    if (dt > 0) {
      for (let i = this.vehicles.length - 1; i >= 0; i--) {
        const v = this.vehicles[i];
        if (v.leaving) {
          v.scale -= dt * APPEAR_SPEED;
          if (v.scale <= 0) this.vehicles.splice(i, 1);
          continue;
        }
        v.scale = Math.min(1, v.scale + dt * APPEAR_SPEED);
        const r = this.step(v, dt);
        if (r === 'arrived') {
          this.releaseAll(v);
          this.vehicles.splice(i, 1);
          v.trip.onArrive?.(v.color);
        } else if (r === 'gaveup') {
          this.releaseAll(v);
          v.leaving = true;
          v.trip.onFail?.();
        }
      }
    }
    this.render();
  }

  private step(v: Vehicle, dt: number): 'moving' | 'arrived' | 'gaveup' {
    while (v.ti + 1 < v.tiles.length && v.s >= v.tileStart[v.ti + 1]) v.ti++;
    for (let j = v.held.length - 1; j >= 0; j--) {
      if (v.held[j] < v.ti) {
        this.release(v.tiles[v.held[j]], v.id);
        v.held.splice(j, 1);
      }
    }

    let target = v.maxSpeed * (SPEED_FACTOR[this.net.type[v.tiles[v.ti]]] ?? 1);
    target = Math.min(target, Math.max(0.25, (v.len - v.s) * 2.5));
    const stopAt = (d: number) => Math.max(0, (d - v.halfLen - 0.02) * 4);

    // leaving a driveway / parking space: wait for a gap
    if (v.s < v.driveIn && this.mergeBlocked(v)) target = Math.min(target, stopAt(v.driveIn - v.s - 0.15));

    const ni = v.ti + 1;
    if (ni < v.tiles.length) {
      const next = v.tiles[ni];
      const dist = v.tileStart[ni] - v.s;
      if (this.net.isIntersection(next) && !v.held.includes(ni) && dist < 0.6) {
        const travel = v.moves[ni] >> 4;
        const sig = this.light(next, travel);
        const mayGo = sig === 'green' || (sig === 'yellow' && dist < 0.2) || !!v.trip.siren;
        // don't enter unless the light allows it, nothing conflicting is inside and the exit has room
        if (mayGo && this.exitClear(v, ni) && this.tryReserve(next, v.id, v.moves[ni])) v.held.push(ni);
        else target = Math.min(target, stopAt(dist));
      } else if (this.net.isRing(next) && !this.net.isRing(v.tiles[v.ti]) && dist < 0.5 && (this.ringBusy(v, next) || !this.exitClear(v, ni))) {
        target = Math.min(target, stopAt(dist));
      }
    }
    const gap = this.gapAhead(v);
    if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - 0.06) * 5));

    if (v.speed < target) v.speed = Math.min(target, v.speed + 4 * dt);
    else v.speed = Math.max(target, v.speed - 12 * dt);

    v.stuck = target < 0.02 ? v.stuck + dt : 0;
    if (v.stuck > GIVE_UP) return 'gaveup';

    v.s += v.speed * dt;
    if (v.s >= v.len) return 'arrived';
    this.place(v);
    return 'moving';
  }

  private pointAt(v: Vehicle, s: number): Point {
    let a = 0;
    while (a < v.cum.length - 2 && v.cum[a + 1] < s) a++;
    const L = v.cum[a + 1] - v.cum[a];
    const t = L > 0 ? Math.min(1, Math.max(0, (s - v.cum[a]) / L)) : 0;
    return { x: v.pts[a * 2] + (v.pts[a * 2 + 2] - v.pts[a * 2]) * t, z: v.pts[a * 2 + 1] + (v.pts[a * 2 + 3] - v.pts[a * 2 + 1]) * t };
  }

  /** Is there room just after the intersection/ring tile `ni` so we won't block it? */
  private exitClear(v: Vehicle, ni: number) {
    let after = ni + 1;
    while (after < v.tiles.length && this.net.isRing(v.tiles[after])) after++;
    if (after >= v.tiles.length) return true;
    const p = this.pointAt(v, v.tileStart[after] + v.halfLen + 0.1);
    const k = v.tiles[after];
    for (const o of this.grid.get(k) ?? []) {
      if (o === v || this.onDriveway(o)) continue;
      if (Math.hypot(o.x - p.x, o.z - p.z) < v.halfLen + o.halfLen + 0.04 && o.speed < 0.3) return false;
    }
    return true;
  }

  private place(v: Vehicle) {
    while (v.seg < v.cum.length - 2 && v.cum[v.seg + 1] < v.s) v.seg++;
    const a = v.seg;
    const L = v.cum[a + 1] - v.cum[a];
    const t = L > 0 ? Math.min(1, Math.max(0, (v.s - v.cum[a]) / L)) : 0;
    const dx = v.pts[a * 2 + 2] - v.pts[a * 2], dz = v.pts[a * 2 + 3] - v.pts[a * 2 + 1];
    v.x = v.pts[a * 2] + dx * t;
    v.z = v.pts[a * 2 + 1] + dz * t;
    if (L > 1e-5) { v.hx = dx / L; v.hz = dz / L; }
  }

  private onDriveway(o: Vehicle) {
    return o.s < o.driveIn || o.s > o.driveOut;
  }

  /** Any vehicle on the road near the point where this one merges in? */
  private mergeBlocked(v: Vehicle) {
    const mx = v.pts[2], mz = v.pts[3];
    const k = v.tiles[0];
    const cx = k % N, cz = (k / N) | 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const o of this.grid.get((cz + dz) * N + cx + dx) ?? []) {
          if (o === v || this.onDriveway(o)) continue;
          const d = Math.hypot(o.x - mx, o.z - mz);
          // after waiting a while, squeeze into a stopped queue (zipper merge)
          if (v.stuck > 3 && o.speed < 0.05 && d > 0.36) continue;
          if (d < 0.7) return true;
        }
      }
    }
    return false;
  }

  /** Is a circulating vehicle close to the ring tile we want to enter? */
  private ringBusy(v: Vehicle, entry: number) {
    const center = this.net.ringCenter[entry];
    const ex = tileToWorld(entry % N), ez = tileToWorld((entry / N) | 0);
    const cx = center % N, cz = (center / N) | 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const o of this.grid.get((cz + dz) * N + cx + dx) ?? []) {
          if (o === v || !this.net.isRing(o.tiles[o.ti])) continue;
          if (Math.hypot(o.x - ex, o.z - ez) < 1.0) return true;
        }
      }
    }
    return false;
  }

  private gapAhead(v: Vehicle) {
    let best = Infinity;
    for (let j = v.ti; j < Math.min(v.tiles.length, v.ti + 3); j++) {
      const list = this.grid.get(v.tiles[j]);
      if (!list) continue;
      for (const o of list) {
        if (o === v || this.onDriveway(o)) continue;
        const dx = o.x - v.x, dz = o.z - v.z;
        const along = dx * v.hx + dz * v.hz;
        if (along <= 0.01 || along > 1) continue;
        if (Math.abs(dx * v.hz - dz * v.hx) > 0.12) continue;
        if (o.hx * v.hx + o.hz * v.hz < -0.3) continue; // oncoming
        best = Math.min(best, along - v.halfLen - o.halfLen);
      }
    }
    return best;
  }

  private tryReserve(k: number, id: number, move: number) {
    const list = this.holders.get(k) ?? [];
    if (!list.every((h) => h.id === id || !conflicts(h.move, move))) return false;
    if (!list.some((h) => h.id === id)) list.push({ id, move });
    this.holders.set(k, list);
    return true;
  }

  private release(k: number, id: number) {
    const list = this.holders.get(k);
    if (!list) return;
    const rest = list.filter((h) => h.id !== id);
    if (rest.length) this.holders.set(k, rest);
    else this.holders.delete(k);
  }

  private releaseAll(v: Vehicle) {
    for (const j of v.held) this.release(v.tiles[j], v.id);
    v.held = [];
  }

  clear() {
    this.vehicles.length = 0;
    this.holders.clear();
    this.render();
  }

  private placePoles() {
    let n = 0;
    for (const l of this.lamps) {
      if (n >= 1024) break;
      // pole on the right-hand corner where traffic travelling `travelBit` enters the junction
      const d = DIRS.find((x) => x.bit === l.travelBit)!;
      const cx = tileToWorld(l.tile % N), cz = tileToWorld((l.tile / N) | 0);
      const rx = -d.dz, rz = d.dx;
      const x = cx - d.dx * 0.47 + rx * 0.47, z = cz - d.dz * 0.47 + rz * 0.47;
      this.q.setFromAxisAngle(this.up, Math.atan2(-d.dx, -d.dz));
      this.p.set(x, 0, z);
      this.sc.set(1, 1, 1);
      this.m.compose(this.p, this.q, this.sc);
      this.poleMesh.setMatrixAt(n, this.m);
      this.lampMesh.setMatrixAt(n, this.m);
      n++;
    }
    this.poleMesh.count = n;
    this.lampMesh.count = n;
    this.poleMesh.instanceMatrix.needsUpdate = true;
    this.lampMesh.instanceMatrix.needsUpdate = true;
  }

  private render() {
    let nc = 0, nt = 0, ng = 0, nb = 0, nbe = 0, nd = 0, nl = 0;
    const flash = Math.sin(this.clock * 14) > 0;
    for (const v of this.vehicles) {
      const s = easeOut(Math.max(0, v.scale));
      this.q.setFromAxisAngle(this.up, Math.atan2(v.hx, v.hz));
      this.p.set(v.x, ROAD_Y, v.z);
      this.sc.set(s, s, s);
      this.m.compose(this.p, this.q, this.sc);
      if (v.trip.siren && nbe < 64) {
        // the two halves swap places so the red and blue lights alternate
        if (flash) this.beaconMesh.setMatrixAt(nbe++, this.m);
        else {
          this.e.set(0, Math.atan2(v.hx, v.hz) + Math.PI, 0);
          this.q2.setFromEuler(this.e);
          this.m2.compose(this.p, this.q2, this.sc);
          this.beaconMesh.setMatrixAt(nbe++, this.m2);
        }
      }
      if (v.trip.wedding && nd < 16) this.decorMesh.setMatrixAt(nd++, this.m);
      if (this.night > 0.05) this.beamMesh.setMatrixAt(nl++, this.m);
      if (v.trip.kind === 'bus') {
        this.busMesh.setMatrixAt(nb++, this.m);
      } else if (v.trip.kind === 'car') {
        this.carMesh.setMatrixAt(nc, this.m);
        this.carMesh.setColorAt(nc, v.color);
        nc++;
      } else {
        this.truckMesh.setMatrixAt(nt++, this.m);
        this.m.compose(this.p, this.q, v.trip.loaded ? this.sc : this.sc.set(0, 0, 0));
        this.cargoMesh.setMatrixAt(ng++, this.m);
      }
    }
    this.sc.set(1, 1, 1);
    for (const p of this.parked) {
      this.q.setFromAxisAngle(this.up, p.rot);
      this.p.set(p.x, ROAD_Y, p.z);
      this.m.compose(this.p, this.q, this.sc);
      this.carMesh.setMatrixAt(nc, this.m);
      this.carMesh.setColorAt(nc, p.color);
      nc++;
    }
    this.beaconMesh.count = nbe;
    this.decorMesh.count = nd;
    this.beamMesh.count = nl;
    for (const m of [this.beaconMesh, this.decorMesh, this.beamMesh]) m.instanceMatrix.needsUpdate = true;
    this.carMesh.count = nc;
    this.truckMesh.count = nt;
    this.cargoMesh.count = ng;
    this.busMesh.count = nb;
    this.busMesh.instanceMatrix.needsUpdate = true;
    this.carMesh.instanceMatrix.needsUpdate = true;
    if (this.carMesh.instanceColor) this.carMesh.instanceColor.needsUpdate = true;
    this.truckMesh.instanceMatrix.needsUpdate = true;
    this.cargoMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.lamps.length && i < 1024; i++) {
      const l = this.lamps[i];
      const s = this.light(l.tile, l.travelBit);
      this.lampMesh.setColorAt(i, s === 'green' ? LIME : s === 'yellow' ? AMBER : RED);
    }
    if (this.lampMesh.instanceColor) this.lampMesh.instanceColor.needsUpdate = true;
  }

  /** Polyline through the lane centres of each tile: curves at turns, arcs on roundabouts. */
  private buildRoute(tiles: number[], fromPos?: Point, toPos?: Point) {
    const type = this.net.type;
    const pts: number[] = [], cum: number[] = [], tileStart: number[] = [], moves: number[] = [];
    let len = 0;
    const push = (x: number, z: number) => {
      if (pts.length) {
        const d = Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1]);
        if (d < 1e-5) return;
        len += d;
      }
      pts.push(x, z);
      cum.push(len);
    };

    if (fromPos) push(fromPos.x, fromPos.z);
    const n = tiles.length;
    for (let i = 0; i < n; i++) {
      const k = tiles[i];
      const cx = tileToWorld(k % N), cz = tileToWorld((k / N) | 0);

      if (type[k] === ROAD_RING) {
        // whole run of ring tiles = one arc around the centre
        let e = i;
        while (e + 1 < n && type[tiles[e + 1]] === ROAD_RING) e++;
        const c = this.net.ringCenter[k];
        const ox = tileToWorld(c % N), oz = tileToWorld((c / N) | 0);
        const angle = (t: number) => Math.atan2(tileToWorld((t / N) | 0) - oz, tileToWorld(t % N) - ox);
        const a0 = angle(tiles[i]);
        let span = a0 - angle(tiles[e]);
        while (span <= 0) span += Math.PI * 2;
        const trimIn = i > 0 ? RING_TRIM : 0, trimOut = e < n - 1 ? RING_TRIM : 0;
        const before = len;
        const arc = Math.max(0.01, span - trimIn - trimOut);
        const steps = Math.max(2, Math.ceil(arc / 0.15));
        for (let s = 0; s <= steps; s++) {
          const a = a0 - trimIn - (arc * s) / steps;
          push(ox + Math.cos(a) * RING_RADIUS, oz + Math.sin(a) * RING_RADIUS);
        }
        for (let m = i; m <= e; m++) {
          tileStart.push(before + ((len - before) * (m - i)) / (e - i + 1));
          moves.push(0);
        }
        i = e;
        continue;
      }

      const dIn = i > 0 ? dirBetween(tiles[i - 1], k) : null;
      const dOut = i < n - 1 ? dirBetween(k, tiles[i + 1]) : null;
      tileStart.push(len);
      moves.push(((dIn?.bit ?? 0) << 4) | (dOut?.bit ?? 0));

      if (!dIn) {
        const r = right(dOut!);
        if (!fromPos) push(cx + r.x * LANE, cz + r.z * LANE);
        else push(cx + r.x * LANE - dOut!.dx * 0.15, cz + r.z * LANE - dOut!.dz * 0.15);
        push(cx + dOut!.dx * 0.5 + r.x * LANE, cz + dOut!.dz * 0.5 + r.z * LANE);
        continue;
      }
      const ri = right(dIn);
      const sx = cx - dIn.dx * 0.5 + ri.x * LANE, sz = cz - dIn.dz * 0.5 + ri.z * LANE;
      push(sx, sz);
      if (!dOut) {
        push(cx + ri.x * LANE + dIn.dx * 0.1, cz + ri.z * LANE + dIn.dz * 0.1);
        continue;
      }
      const ro = right(dOut);
      const ex = cx + dOut.dx * 0.5 + ro.x * LANE, ez = cz + dOut.dz * 0.5 + ro.z * LANE;
      if (dIn.bit === dOut.bit) {
        push(ex, ez);
      } else if (dIn.bit === oppositeBit(dOut.bit)) {
        push(cx + ri.x * LANE, cz + ri.z * LANE);
        push(cx + ro.x * LANE, cz + ro.z * LANE);
        push(ex, ez);
      } else {
        const kx = cx + ri.x * LANE + ro.x * LANE, kz = cz + ri.z * LANE + ro.z * LANE;
        for (let s = 1; s <= 6; s++) {
          const t = s / 6, u = 1 - t;
          push(u * u * sx + 2 * u * t * kx + t * t * ex, u * u * sz + 2 * u * t * kz + t * t * ez);
        }
      }
    }
    const driveOut = toPos ? len : Infinity;
    if (toPos) push(toPos.x, toPos.z);
    return { pts, cum, len, tileStart, moves, driveIn: fromPos ? cum[1] : 0, driveOut };
  }
}

function dirBetween(a: number, b: number) {
  const d = b - a;
  if (d === 1) return { dx: 1, dz: 0, bit: 2 };
  if (d === -1) return { dx: -1, dz: 0, bit: 8 };
  if (d === N) return { dx: 0, dz: 1, bit: 4 };
  return { dx: 0, dz: -1, bit: 1 };
}

const right = (d: { dx: number; dz: number }) => ({ x: -d.dz, z: d.dx });
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Two movements through the same intersection conflict when their lane paths come within a car's
 * width of each other. Precomputed from the same geometry the vehicles drive.
 */
const conflictCache = new Map<number, boolean>();

function movePath(move: number) {
  const inB = move >> 4, outB = move & 15;
  const dir = (bit: number) => (bit === 1 ? { dx: 0, dz: -1 } : bit === 2 ? { dx: 1, dz: 0 } : bit === 4 ? { dx: 0, dz: 1 } : { dx: -1, dz: 0 });
  const di = dir(inB), dout = dir(outB), ri = right(di), ro = right(dout);
  const sx = -di.dx * 0.5 + ri.x * LANE, sz = -di.dz * 0.5 + ri.z * LANE;
  const ex = dout.dx * 0.5 + ro.x * LANE, ez = dout.dz * 0.5 + ro.z * LANE;
  const kx = inB === outB ? (sx + ex) / 2 : ri.x * LANE + ro.x * LANE;
  const kz = inB === outB ? (sz + ez) / 2 : ri.z * LANE + ro.z * LANE;
  const pts: Point[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, u = 1 - t;
    pts.push({ x: u * u * sx + 2 * u * t * kx + t * t * ex, z: u * u * sz + 2 * u * t * kz + t * t * ez });
  }
  return pts;
}

function conflicts(a: number, b: number) {
  const ai = a >> 4, bi = b >> 4;
  if (ai === bi && ai !== 0) return false; // same approach lane: car-following handles spacing
  if (!ai || !(a & 15) || !bi || !(b & 15) || ai === oppositeBit(a & 15) || bi === oppositeBit(b & 15)) return true;
  const key = a * 256 + b;
  let c = conflictCache.get(key);
  if (c === undefined) {
    const pa = movePath(a), pb = movePath(b);
    c = pa.some((p) => pb.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 0.2));
    conflictCache.set(key, c);
  }
  return c;
}
