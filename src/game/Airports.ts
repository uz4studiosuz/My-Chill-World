import * as THREE from 'three';
import type { Building, Buildings } from '../buildings/Buildings';
import { planeGeometry } from '../models/extras';
import { sound } from '../audio/Sound';

type Phase = 'approach' | 'landing' | 'gate' | 'takeoff' | 'climb' | 'cruise';

interface Flight {
  id: number;
  /** The airport whose runway the plane is using now (or flying to, while cruising). */
  airport: Building;
  /** Where it took off last (the town the passengers come from). */
  from?: Building;
  mesh: THREE.Mesh;
  phase: Phase;
  t: number;
  x: number;
  /** Cruise: a straight line through the air from one airport to the next. */
  cruise?: { x0: number; z0: number; y0: number; x1: number; z1: number; y1: number; len: number };
}

/** Runway in the airport's local frame: along x, at z = -0.75. */
const RUNWAY_Z = -0.75;
const FAR = 16;
const CRUISE = 3.2;
/** Cruise speed (world units per second). */
const SPEED = 3.2;

const ease = (k: number) => k * k * (3 - 2 * k);

/**
 * Planes fly between the airports of the towns: a plane takes off, climbs, flies over the land to another town's
 * airport, glides down, lands and stops at the terminal (visitors and cargo arrive), then flies on to the next one.
 * With only one airport on the map the planes come from beyond the horizon and leave there again.
 */
export class Airports {
  readonly group = new THREE.Group();
  private flights: Flight[] = [];
  private wait = new Map<number, number>();
  private nextId = 1;
  private geo = planeGeometry();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  /** A plane stopped at the terminal; `from` is the airport it came from (none: from far away). */
  onLanded: (airport: Building, from?: Building) => void = () => {};

  constructor(private buildings: Buildings) {}

  get active() { return this.flights.length; }

  private ready() { return this.buildings.list.filter((b) => b.kind === 'airport' && b.built >= 1 && b.workers > 0 && !b.removed); }

  /** A point of the runway frame of an airport in the world. */
  private world(b: Building, x: number) {
    const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
    return { x: b.mesh.position.x + x * cr + RUNWAY_Z * sr, z: b.mesh.position.z - x * sr + RUNWAY_Z * cr };
  }

  /** Another town's airport to fly to (none: the plane leaves the map). */
  private destination(from: Building) {
    const others = this.ready().filter((b) => b.city !== from.city);
    return others[Math.floor(Math.random() * others.length)];
  }

  update(dt: number) {
    if (dt <= 0) return;
    const airports = this.ready();
    // every airport gets a plane now and then: from another airport if there is one, otherwise from far away
    for (const b of airports) {
      if (this.flights.some((f) => f.airport === b)) continue;
      const w = (this.wait.get(b.id) ?? 6) - dt;
      this.wait.set(b.id, w);
      if (w > 0) continue;
      this.wait.set(b.id, 25 + Math.random() * 20);
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.castShadow = true;
      this.group.add(mesh);
      const src = this.destination(b);
      if (src) {
        // it takes off at the other town's airport and flies here
        this.flights.push({ id: this.nextId++, airport: src, mesh, phase: 'gate', t: 3, x: 0.5, from: undefined });
        const f = this.flights[this.flights.length - 1];
        (f as Flight & { goal?: Building }).goal = b;
      } else {
        this.flights.push({ id: this.nextId++, airport: b, mesh, phase: 'approach', t: 0, x: -FAR });
      }
    }
    for (const f of [...this.flights]) {
      if (f.airport.removed) { this.end(f); continue; }
      f.t += dt;
      let y = 0.02, x = f.x, tilt = 0;
      switch (f.phase) {
        case 'approach': {
          // glide down towards the runway threshold
          const k = Math.min(1, f.t / 9);
          x = -FAR + (FAR - 1.35) * k;
          y = 0.02 + CRUISE * (1 - ease(k));
          tilt = -0.08;
          if (k >= 1) { f.phase = 'landing'; f.t = 0; sound.play('plane', f.mesh.position); }
          break;
        }
        case 'landing': {
          const k = Math.min(1, f.t / 3);
          x = -1.35 + 1.85 * (1 - (1 - k) * (1 - k));
          if (k >= 1) { f.phase = 'gate'; f.t = 0; this.onLanded(f.airport, f.from); }
          break;
        }
        case 'gate':
          x = 0.5;
          if (f.t > 5) { f.phase = 'takeoff'; f.t = 0; sound.play('plane', f.mesh.position); }
          break;
        case 'takeoff': {
          const k = Math.min(1, f.t / 2.5);
          x = 0.5 + 0.9 * k * k;
          y = 0.02 + Math.max(0, k - 0.6) * 0.5;
          tilt = k > 0.6 ? 0.12 : 0;
          if (k >= 1) { f.phase = 'climb'; f.t = 0; }
          break;
        }
        case 'climb': {
          const k = Math.min(1, f.t / 8);
          x = 1.4 + (FAR - 1.4) * k;
          y = 0.22 + CRUISE * ease(k);
          tilt = 0.12;
          if (k >= 1) {
            // on to another town's airport, or away beyond the horizon
            const g = f as Flight & { goal?: Building };
            const to = g.goal && !g.goal.removed ? g.goal : this.destination(f.airport);
            g.goal = undefined;
            if (!to) { this.end(f); continue; }
            const a = this.world(f.airport, FAR), b = this.world(to, -FAR);
            f.cruise = { x0: a.x, z0: a.z, y0: y, x1: b.x, z1: b.z, y1: 0.02 + CRUISE, len: Math.max(0.1, Math.hypot(b.x - a.x, b.z - a.z)) };
            f.from = f.airport;
            f.airport = to;
            f.phase = 'cruise';
            f.t = 0;
          }
          break;
        }
        case 'cruise': {
          const c = f.cruise!;
          const k = Math.min(1, (f.t * SPEED) / c.len);
          const px = c.x0 + (c.x1 - c.x0) * k, pz = c.z0 + (c.z1 - c.z0) * k;
          f.mesh.position.set(px, c.y0 + (c.y1 - c.y0) * k, pz);
          // turn smoothly: towards the line first, then into the runway direction at the end
          const want = Math.atan2(c.x1 - c.x0, c.z1 - c.z0);
          const b = f.airport, runway = Math.atan2(Math.cos(b.rot), -Math.sin(b.rot));
          let d = runway - want;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          f.mesh.rotation.set(0, want + d * Math.max(0, (k - 0.85) / 0.15), 0, 'YXZ');
          if (k >= 1) { f.phase = 'approach'; f.t = 0; f.cruise = undefined; f.x = -FAR; }
          continue;
        }
      }
      f.x = x;
      const p = this.world(f.airport, x), b = f.airport, cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      f.mesh.position.set(p.x, y, p.z);
      f.mesh.rotation.set(0, Math.atan2(cr, -sr), 0, 'YXZ');
      f.mesh.rotateX(-tilt);
    }
  }

  private end(f: Flight) {
    this.group.remove(f.mesh);
    this.flights = this.flights.filter((x) => x !== f);
  }
}
