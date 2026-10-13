import * as THREE from 'three';
import type { Building, Buildings } from '../buildings/Buildings';
import { planeGeometry } from '../models/extras';
import { sound } from '../audio/Sound';

type Phase = 'approach' | 'landing' | 'gate' | 'takeoff' | 'climb';

interface Flight {
  airport: Building;
  mesh: THREE.Mesh;
  phase: Phase;
  t: number;
  x: number;
}

/** Runway in the airport's local frame: along x, at z = -0.75. */
const RUNWAY_Z = -0.75;
const FAR = 16;
const CRUISE = 3.2;

const ease = (k: number) => k * k * (3 - 2 * k);

/**
 * Planes for every staffed airport: one approaches, lands, stops at the terminal (tourists and cargo),
 * then takes off and flies away; after a pause the next one comes.
 */
export class Airports {
  readonly group = new THREE.Group();
  private flights = new Map<number, Flight>();
  private wait = new Map<number, number>();
  private geo = planeGeometry();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  /** A plane stopped at the terminal. */
  onLanded: (airport: Building) => void = () => {};

  constructor(private buildings: Buildings) {}

  get active() { return this.flights.size; }

  update(dt: number) {
    if (dt <= 0) return;
    for (const b of this.buildings.list) {
      if (b.kind !== 'airport' || b.built < 1 || b.workers <= 0 || this.flights.has(b.id)) continue;
      const w = (this.wait.get(b.id) ?? 6) - dt;
      this.wait.set(b.id, w);
      if (w > 0) continue;
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.flights.set(b.id, { airport: b, mesh, phase: 'approach', t: 0, x: -FAR });
    }
    for (const [id, f] of this.flights) {
      if (f.airport.removed) { this.end(id, f); continue; }
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
          if (k >= 1) { f.phase = 'gate'; f.t = 0; this.onLanded(f.airport); }
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
          if (k >= 1) { this.end(id, f); continue; }
          break;
        }
      }
      f.x = x;
      const b = f.airport, cr = Math.cos(b.rot), sr = Math.sin(b.rot);
      f.mesh.position.set(b.mesh.position.x + x * cr + RUNWAY_Z * sr, y, b.mesh.position.z - x * sr + RUNWAY_Z * cr);
      f.mesh.rotation.set(0, Math.atan2(cr, -sr), 0, 'YXZ');
      f.mesh.rotateX(-tilt);
    }
  }

  private end(id: number, f: Flight) {
    this.group.remove(f.mesh);
    this.flights.delete(id);
    this.wait.set(id, 18 + Math.random() * 20);
  }
}
