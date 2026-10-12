import * as THREE from 'three';
import { N, Tile, idx, inBounds, tileToWorld, worldToTile } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { RoadNetwork, ROAD_RING } from '../roads/RoadNetwork';
import { BUILDINGS, BuildingKind } from './BuildingTypes';
import {
  cropGeometry, farmGeometry, houseGeometry, officeGeometry, orchardGeometry, parkingGeometry, powerPlantGeometry,
  quarryGeometry, ranchGeometry, schoolGeometry, townHallGeometry, woodcutterGeometry,
} from '../models/buildings';
import { hash2 } from '../utils/voxel';

export interface Point { x: number; z: number }

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  z: number;
  rot: number;
  /** Road tile index used as the entrance, or -1. */
  access: number;
  /** Workers assigned / currently at work. */
  workers: number;
  present: number;
  stored: number;
  /** Trucks currently on the road for this building. */
  trucks: number;
  removed: boolean;
  mesh: THREE.Group;
  /** Build-up animation progress 0 → 1. */
  grow: number;
  /** Farm crop growth 0 → 1. */
  cropT: number;
  crop?: THREE.Mesh;
}

export interface PlaceCheck { ok: boolean; reason?: string }

export interface BuildingContext {
  /** Tile used by something the buildings layer doesn't own (footpaths). */
  isBlocked(k: number): boolean;
  treesNear(x: number, z: number, r: number): number;
}

// Entrance search order: front (S), right (E), back (N), left (W) → model rotation
const SIDES = [
  { rot: 0, tile: (x: number, z: number, s: number, i: number) => ({ x: x + i, z: z + s }) },
  { rot: Math.PI / 2, tile: (x: number, z: number, s: number, i: number) => ({ x: x + s, z: z + i }) },
  { rot: Math.PI, tile: (x: number, z: number, _s: number, i: number) => ({ x: x + i, z: z - 1 }) },
  { rot: -Math.PI / 2, tile: (x: number, z: number, _s: number, i: number) => ({ x: x - 1, z: z + i }) },
];

const CROP_GREEN = new THREE.Color('#6faa45');
const CROP_GOLD = new THREE.Color('#e3bf4f');

export function buildingGeometry(kind: BuildingKind, variant = 0) {
  switch (kind) {
    case 'house': return houseGeometry(variant);
    case 'office': return officeGeometry();
    case 'school': return schoolGeometry();
    case 'parking': return parkingGeometry();
    case 'quarry': return quarryGeometry();
    case 'woodcutter': return woodcutterGeometry();
    case 'powerplant': return powerPlantGeometry();
    case 'farm': return farmGeometry();
    case 'orchard': return orchardGeometry();
    case 'ranch': return ranchGeometry();
    default: return townHallGeometry();
  }
}

export class Buildings {
  readonly group = new THREE.Group();
  readonly list: Building[] = [];
  readonly occ = new Int32Array(N * N).fill(-1);
  private byId = new Map<number, Building>();
  private nextId = 1;
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private cropGeo = cropGeometry();
  private dying: { mesh: THREE.Object3D; t: number }[] = [];

  constructor(private map: WorldMap, private roads: RoadNetwork, private ctx: BuildingContext) {}

  get(id: number) { return this.byId.get(id); }

  footprint(kind: BuildingKind, x: number, z: number): Tile[] {
    const s = BUILDINGS[kind].size;
    const out: Tile[] = [];
    for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) out.push({ x: x + dx, z: z + dz });
    return out;
  }

  check(kind: BuildingKind, x: number, z: number): PlaceCheck {
    const def = BUILDINGS[kind];
    for (const t of this.footprint(kind, x, z)) {
      if (!inBounds(t.x, t.z)) return { ok: false, reason: 'Out of the map' };
      const k = idx(t.x, t.z);
      if (!this.map.isLand(k)) return { ok: false, reason: 'Needs flat dry land' };
      if (this.roads.type[k] || this.occ[k] !== -1 || this.roads.isIsland(k) || this.ctx.isBlocked(k)) return { ok: false, reason: 'Space is occupied' };
    }
    const cx = x + (def.size >> 1), cz = z + (def.size >> 1);
    if (kind === 'quarry' && this.map.mountainsNear(x, z, 3) < 3) return { ok: false, reason: 'A quarry must be next to mountains' };
    if (kind === 'woodcutter' && this.ctx.treesNear(cx, cz, 7) < 6) return { ok: false, reason: 'A woodcutter needs a forest nearby' };
    if (def.needsRoad && this.findAccess(kind, x, z).access < 0) return { ok: false, reason: 'Needs a road next to it' };
    return { ok: true };
  }

  place(kind: BuildingKind, x: number, z: number, opts: { stored?: number; animate?: boolean; id?: number } = {}): Building {
    const { access, rot } = this.findAccess(kind, x, z);
    const s = BUILDINGS[kind].size;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(this.geometry(kind, x, z), this.mat);
    body.castShadow = true;
    body.receiveShadow = true;
    mesh.add(body);
    mesh.position.set(tileToWorld(x) + (s - 1) / 2, 0, tileToWorld(z) + (s - 1) / 2);
    mesh.rotation.y = rot;
    const id = opts.id ?? this.nextId;
    this.nextId = Math.max(this.nextId, id + 1);
    const b: Building = {
      id, kind, x, z, rot, access, workers: 0, present: 0, stored: opts.stored ?? 0, trucks: 0, removed: false,
      mesh, grow: opts.animate === false ? 1 : 0, cropT: Math.random() * 0.5,
    };
    if (kind === 'farm') {
      b.crop = new THREE.Mesh(this.cropGeo, new THREE.MeshLambertMaterial({ color: CROP_GREEN.clone() }));
      b.crop.castShadow = true;
      mesh.add(b.crop);
      this.updateCrop(b);
    }
    if (b.grow < 1) mesh.scale.set(0.6, 0.01, 0.6);
    for (const t of this.footprint(kind, x, z)) this.occ[idx(t.x, t.z)] = b.id;
    this.list.push(b);
    this.byId.set(b.id, b);
    this.group.add(mesh);
    return b;
  }

  remove(b: Building) {
    for (const t of this.footprint(b.kind, b.x, b.z)) this.occ[idx(t.x, t.z)] = -1;
    this.list.splice(this.list.indexOf(b), 1);
    this.byId.delete(b.id);
    this.dying.push({ mesh: b.mesh, t: 1 });
    b.removed = true;
  }

  /** Grow / shrink animations and crop growth. */
  update(dt: number, simDt: number, dayLength: number) {
    for (const b of this.list) {
      if (b.grow < 1) {
        b.grow = Math.min(1, b.grow + dt * 2.2);
        const y = easeOutBack(b.grow);
        const xz = 0.6 + 0.4 * Math.min(1, b.grow * 1.6);
        b.mesh.scale.set(xz, Math.max(0.01, y), xz);
      }
      if (b.crop && simDt > 0 && b.present > 0) {
        // a full season takes ~2 days with all farmers working
        b.cropT += (simDt / (dayLength * 2)) * (b.present / BUILDINGS.farm.jobs);
        if (b.cropT >= 1) b.cropT = 0;
        this.updateCrop(b);
      }
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t -= dt * 3;
      if (d.t <= 0) {
        this.group.remove(d.mesh);
        this.dying.splice(i, 1);
      } else {
        d.mesh.scale.set(0.6 + 0.4 * d.t, d.t, 0.6 + 0.4 * d.t);
      }
    }
  }

  private updateCrop(b: Building) {
    const t = b.cropT;
    b.crop!.scale.set(1, 0.15 + t * 1.6, 1);
    (b.crop!.material as THREE.MeshLambertMaterial).color.copy(CROP_GREEN).lerp(CROP_GOLD, Math.max(0, (t - 0.5) * 2));
  }

  at(k: number): Building | undefined {
    const id = this.occ[k];
    return id === -1 ? undefined : this.byId.get(id);
  }

  townHall() {
    return this.list.find((b) => b.kind === 'townhall');
  }

  ofKind(kind: BuildingKind) {
    return this.list.filter((b) => b.kind === kind);
  }

  center(b: Building): Point {
    return { x: b.mesh.position.x, z: b.mesh.position.z };
  }

  /** Point on the building's front edge, where people enter and leave. */
  door(b: Building): Point {
    const r = BUILDINGS[b.kind].size / 2 - 0.05;
    return { x: b.mesh.position.x + Math.sin(b.rot) * r, z: b.mesh.position.z + Math.cos(b.rot) * r };
  }

  /** Walkable tile right in front of the door. */
  frontTile(b: Building): number {
    const r = BUILDINGS[b.kind].size / 2 + 0.3;
    const x = worldToTile(b.mesh.position.x + Math.sin(b.rot) * r), z = worldToTile(b.mesh.position.z + Math.cos(b.rot) * r);
    return inBounds(x, z) ? idx(x, z) : idx(b.x, b.z);
  }

  /** World position + heading of parking slot i. */
  slot(b: Building, i: number) {
    const [lx, lz, lr] = BUILDINGS[b.kind].slots[i];
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    return { x: b.mesh.position.x + lx * c + lz * s, z: b.mesh.position.z - lx * s + lz * c, rot: b.rot + lr };
  }

  /** Re-resolve entrances after road edits (orientation stays as built). */
  refreshAccess() {
    for (const b of this.list) b.access = this.findAccess(b.kind, b.x, b.z).access;
  }

  totals() {
    let jobs = 0, upkeep = 0, energy = 0, students = 0, parking = 0;
    for (const b of this.list) {
      const d = BUILDINGS[b.kind];
      jobs += d.jobs;
      upkeep += d.upkeep;
      energy += d.energy;
      students += d.students;
      if (b.kind !== 'house') parking += d.slots.length;
    }
    return { jobs, upkeep, energy, students, parking };
  }

  countBy(): Record<BuildingKind, number> {
    const out = {} as Record<BuildingKind, number>;
    for (const k of Object.keys(BUILDINGS) as BuildingKind[]) out[k] = 0;
    for (const b of this.list) out[b.kind]++;
    return out;
  }

  private findAccess(kind: BuildingKind, x: number, z: number) {
    const s = BUILDINGS[kind].size;
    for (const side of SIDES) {
      for (let i = 0; i < s; i++) {
        const t = side.tile(x, z, s, i);
        if (!inBounds(t.x, t.z)) continue;
        const ty = this.roads.type[idx(t.x, t.z)];
        if (ty && ty !== ROAD_RING) return { access: idx(t.x, t.z), rot: side.rot };
      }
    }
    return { access: -1, rot: 0 };
  }

  private geometry(kind: BuildingKind, x: number, z: number) {
    const variant = kind === 'house' ? hash2(x, z) % 16 : 0;
    const key = `${kind}:${variant}`;
    let g = this.geoCache.get(key);
    if (!g) {
      g = buildingGeometry(kind, variant);
      this.geoCache.set(key, g);
    }
    return g;
  }
}

function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
