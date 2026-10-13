import * as THREE from 'three';
import { N, Tile, idx, inBounds, tileToWorld, worldToTile } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { RoadNetwork, ROAD_RING } from '../roads/RoadNetwork';
import { BUILDINGS, BUILD_DAYS, BuildingKind, MAX_GRAVES_PER_CEMETERY } from './BuildingTypes';
import {
  cropGeometry, farmGeometry, houseGeometry, officeGeometry, orchardGeometry, parkingGeometry, powerPlantGeometry,
  quarryGeometry, ranchGeometry, schoolGeometry, townHallGeometry, waterTowerGeometry, weddingHallGeometry, woodcutterGeometry,
  cemeteryGeometry, headstoneGeometry, graveOffset, policeGeometry, kindergartenGeometry, hotelGeometry, windTurbineGeometry, rotorGeometry, solarFarmGeometry, trainStationGeometry, apartmentGeometry, cemeteryExtGeometry, GRAVE_OFFSETS, ironMineGeometry, fisheryGeometry, fireStationGeometry, busDepotGeometry, busStopGeometry, groceryGeometry, clothesGeometry, parkGeometry, hospitalGeometry, universityGeometry, marketGeometry,
  carMarketGeometry, bankGeometry, gasStationGeometry, factoryGeometry, carFactoryGeometry, constructionGeometry,
} from '../models/buildings';
import { cowGeometry } from '../models/animals';
import {
  academyGeometry, airportGeometry, benchGeometry, cinemaGeometry, cinemaScreenGeometry, flowerbedGeometry, fountainGeometry, fountainJetGeometry, lampHeadGeometry,
  lamppostGeometry, playgroundGeometry, saplingGeometry, signGeometry, stadiumGeometry, statueGeometry,
} from '../models/extras';
import { glowTexture, nightLevel, windowMaterial } from '../fx/NightGlow';
import { box, hash2, merge } from '../utils/voxel';

export interface Point { x: number; z: number }

export interface GraveRecord {
  name: string;
  family: string;
  age: number;
  day: number;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  /** City (Town Hall) this building belongs to. */
  city: number;
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
  /** Farms: connected to water by a canal (or next to a river/lake). */
  irrigated: boolean;
  /** Gets electricity (road-connected to a working power plant). */
  powered: boolean;
  /** Seconds of fire left (lightning); the building burns down when it runs out. */
  fire: number;
  /** Construction progress 0 → 1 (only finished buildings work). */
  built: number;
  /** Cemetery level: each level holds one more row of graves. */
  level: number;
  /** Family that owns this business (-1 = owned by the city). */
  owner: number;
  scaffold?: THREE.LineSegments;
  /** Floating construction status above a building site. */
  label?: THREE.Sprite;
  /** Part of today's sales already taxed at the till. */
  salesTaxed?: number;
  labelText?: string;
  /** Cemetery extension: the cemetery it belongs to. Cemetery: its extensions. */
  parent?: number;
  ext?: number[];
  /** Money taken at the till today (shops, gas stations). */
  sales?: number;
  /** A fire truck is already on its way. */
  fireCrew?: boolean;
  /** Cemetery: buried records. */
  graves?: GraveRecord[];
  gravesGroup?: THREE.Group;
  /** Ranch: number of living cattle and hunger level (0..100). */
  cattleCount?: number;
  cattleHunger?: number;
  cattleMeshes?: THREE.Mesh[];
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
    case 'weddinghall': return weddingHallGeometry();
    case 'watertower': return waterTowerGeometry();
    case 'cemetery': return cemeteryGeometry();
    case 'park': return parkGeometry();
    case 'police': return policeGeometry();
    case 'apartment': return apartmentGeometry();
    case 'kindergarten': return kindergartenGeometry();
    case 'hotel': return hotelGeometry();
    case 'windturbine': return windTurbineGeometry();
    case 'solarfarm': return solarFarmGeometry();
    case 'trainstation': return trainStationGeometry();
    case 'cemeteryext': return cemeteryExtGeometry();
    case 'ironmine': return ironMineGeometry();
    case 'fishery': return fisheryGeometry();
    case 'firestation': return fireStationGeometry();
    case 'busdepot': return busDepotGeometry();
    case 'busstop': return busStopGeometry();
    case 'grocery': return groceryGeometry();
    case 'clothes': return clothesGeometry();
    case 'hospital': return hospitalGeometry();
    case 'university': return universityGeometry();
    case 'market': return marketGeometry();
    case 'carmarket': return carMarketGeometry();
    case 'bank': return bankGeometry();
    case 'gasstation': return gasStationGeometry();
    case 'factory': return factoryGeometry();
    case 'carfactory': return carFactoryGeometry();
    case 'construction': return constructionGeometry();
    case 'stadium': return stadiumGeometry();
    case 'cinema': return cinemaGeometry();
    case 'academy': return academyGeometry();
    case 'playground': return playgroundGeometry();
    case 'fountain': return fountainGeometry();
    case 'flowerbed': return flowerbedGeometry(variant);
    case 'statue': return statueGeometry();
    case 'bench': return benchGeometry();
    case 'lamppost': return lamppostGeometry();
    case 'sapling': return saplingGeometry(variant);
    case 'roadsign': return signGeometry();
    case 'airport': return airportGeometry();
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
  /** Windows glow warm at night; unpowered or unfinished buildings use the dark copy. */
  private mat = windowMaterial();
  private darkMat = windowMaterial(false);
  private jetGeo = fountainJetGeometry();
  private jetMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  private lampHeadGeo = lampHeadGeometry();
  private lampHeadMat = new THREE.MeshBasicMaterial({ color: '#c9c4b6' });
  private poolGeo = new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
  private poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffcf7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private screenGeo = cinemaScreenGeometry();
  private screenMat = new THREE.MeshBasicMaterial({ color: '#2a2f36' });
  private floodMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#fff6dd', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  /** Set by the game: is a film showing tonight / a match on today? */
  cinemaOn = false;
  matchOn = false;
  private cropGeo = cropGeometry();
  private headstoneGeo = headstoneGeometry();
  private rotorGeo = rotorGeometry();
  private cowGeo = cowGeometry();
  private cowMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private animTime = 0;
  private dying: { mesh: THREE.Object3D; t: number }[] = [];
  /** Status shown above a construction site (progress, builders or why it is waiting). */
  siteLabel?: (b: Building) => { text: string; ok: boolean };
  private labelT = 0;
  /** Called when a building finishes construction. */
  onBuilt: (b: Building) => void = () => {};

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
    if ((kind === 'quarry' || kind === 'ironmine') && this.map.mountainsNear(x, z, 3) < 3) return { ok: false, reason: 'A quarry must be next to mountains' };
    if (kind === 'fishery' && !this.footprint(kind, x, z).some((tl) => this.map.isShore(tl.x, tl.z))) return { ok: false, reason: 'A fishing hut must stand on the shore' };
    if (kind === 'woodcutter' && this.ctx.treesNear(cx, cz, 7) < 6) return { ok: false, reason: 'A woodcutter needs a forest nearby' };
    if (def.needsRoad && this.findAccess(kind, x, z).access < 0) return { ok: false, reason: 'Needs a road next to it' };
    return { ok: true };
  }

  place(kind: BuildingKind, x: number, z: number, opts: { stored?: number; animate?: boolean; id?: number; city?: number; built?: number; level?: number; owner?: number } = {}): Building {
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
      id, kind, city: opts.city ?? 0, x, z, rot, access, workers: 0, present: 0, stored: opts.stored ?? 0, trucks: 0, removed: false,
      mesh, grow: opts.animate === false ? 1 : 0, cropT: Math.random() * 0.5,
      irrigated: false, powered: true, fire: 0,
      built: opts.built ?? (opts.animate === false ? 1 : 0), level: opts.level ?? 1, owner: opts.owner ?? -1,
    };
    if (b.built < 1) {
      const h = 0.7 + s * 0.55;
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(s * 0.96, h, s * 0.96)),
        new THREE.LineBasicMaterial({ color: '#f2b33d' }),
      );
      frame.position.y = h / 2;
      mesh.add(frame);
      b.scaffold = frame;
    }
    if (kind === 'farm') {
      b.crop = new THREE.Mesh(this.cropGeo, new THREE.MeshLambertMaterial({ color: CROP_GREEN.clone() }));
      b.crop.castShadow = true;
      mesh.add(b.crop);
      this.updateCrop(b);
    }
    if (kind === 'cemetery') {
      b.graves = [];
      const gGroup = new THREE.Group();
      b.gravesGroup = gGroup;
      mesh.add(gGroup);
    }
    if (kind === 'fountain') {
      const jet = new THREE.Mesh(this.jetGeo, this.jetMat);
      jet.name = 'jet';
      mesh.add(jet);
    }
    if (kind === 'lamppost') {
      mesh.add(new THREE.Mesh(this.lampHeadGeo, this.lampHeadMat));
      const pool = new THREE.Mesh(this.poolGeo, this.poolMat);
      pool.renderOrder = 4;
      mesh.add(pool);
    }
    if (kind === 'cinema') mesh.add(new THREE.Mesh(this.screenGeo, this.screenMat));
    if (kind === 'stadium') {
      const flood = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6).rotateX(-Math.PI / 2).translate(0, 0.04, -0.15), this.floodMat);
      flood.renderOrder = 4;
      mesh.add(flood);
    }
    if (kind === 'windturbine') {
      const rotor = new THREE.Mesh(this.rotorGeo, this.mat);
      rotor.position.set(0, 1.62, 0.14);
      rotor.name = 'rotor';
      mesh.add(rotor);
    }
    if (kind === 'ranch') {
      b.cattleCount = 4;
      b.cattleHunger = 0;
      b.cattleMeshes = [];
      const cattlePositions = [
        [-0.3, 0.2, 0.1],
        [0.4, -0.2, -0.5],
        [0.1, 0.7, 1.2],
        [-0.4, -0.4, 2.3],
      ];
      for (let i = 0; i < 4; i++) {
        const cow = new THREE.Mesh(this.cowGeo, this.cowMat);
        cow.castShadow = true;
        cow.position.set(cattlePositions[i][0], 0.02, cattlePositions[i][1]);
        cow.rotation.y = cattlePositions[i][2];
        mesh.add(cow);
        b.cattleMeshes.push(cow);
      }
    }
    if (b.grow < 1) mesh.scale.set(0.6, 0.01, 0.6);
    for (const t of this.footprint(kind, x, z)) this.occ[idx(t.x, t.z)] = b.id;
    this.list.push(b);
    this.byId.set(b.id, b);
    this.group.add(mesh);
    if (b.level > 1) this.setLevel(b, b.level);
    return b;
  }

  private updateLabel(b: Building) {
    if (b.built >= 1 || b.removed || !this.siteLabel) {
      if (b.label) {
        b.mesh.remove(b.label);
        (b.label.material as THREE.SpriteMaterial).map?.dispose();
        b.label.material.dispose();
        b.label = undefined;
      }
      return;
    }
    const info = this.siteLabel(b);
    const key = `${Math.floor(b.built * 100)}|${info.text}|${info.ok}`;
    if (!b.label) {
      b.label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
      b.label.renderOrder = 20;
      b.mesh.add(b.label);
    }
    // the label must not shrink with the growing building
    const s = BUILDINGS[b.kind].size;
    const sy = Math.max(0.05, b.mesh.scale.y);
    b.label.scale.set(1.9 / b.mesh.scale.x, 0.6 / sy, 1);
    b.label.position.set(0, (0.9 + s * 0.55) / sy, 0);
    if (b.labelText === key) return;
    b.labelText = key;
    const mat = b.label.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = drawLabel(b.built, info.text, info.ok);
    mat.needsUpdate = true;
  }

  /** Cemetery upgrades add a monument and cypresses. */
  setLevel(b: Building, level: number) {
    b.level = level;
    const old = b.mesh.getObjectByName('levelDeco') as THREE.Mesh | undefined;
    if (old) { b.mesh.remove(old); old.geometry.dispose(); }
    if (b.kind === 'house') {
      const variant = hash2(b.x, b.z) % 16;
      const key = `house:${variant}:${level}`;
      let g = this.geoCache.get(key);
      if (!g) { g = houseGeometry(variant, level); this.geoCache.set(key, g); }
      (b.mesh.children[0] as THREE.Mesh).geometry = g;
      return;
    }
    if (b.kind !== 'cemetery' || level < 2) return;
    const parts = [
      box(0.2, 0.06, 0.2, 0, 0.05, -0.2, '#9a968f'),
      box(0.12, 0.34, 0.12, 0, 0.23, -0.2, '#b9b5ac'),
      box(0.08, 0.14, 0.08, 0, 0.47, -0.2, '#d4af37'),
    ];
    if (level >= 3) {
      for (const sx of [-1, 1]) parts.push(box(0.04, 0.16, 0.04, sx * 0.74, 0.08, 0.74, '#4a3525'), box(0.2, 0.55, 0.2, sx * 0.74, 0.42, 0.74, '#2d4a25'), box(0.12, 0.2, 0.12, sx * 0.74, 0.78, 0.74, '#2d4a25'));
    }
    const m = new THREE.Mesh(merge(parts), this.mat);
    m.name = 'levelDeco';
    m.castShadow = true;
    b.mesh.add(m);
  }

  addGrave(b: Building, g: GraveRecord): boolean {
    if (b.kind !== 'cemetery') return false;
    if (!b.graves) b.graves = [];
    if (b.graves.length >= MAX_GRAVES_PER_CEMETERY * (b.level || 1)) return false;
    const idx = b.graves.length;
    b.graves.push(g);
    // the first 16 graves fill the cemetery, the next ones its extensions
    const plot = Math.floor(idx / MAX_GRAVES_PER_CEMETERY);
    const host = plot > 0 ? this.get(b.ext?.[plot - 1] ?? -1) : b;
    const target = host ?? b;
    const [gx, gz] = host && plot > 0 ? GRAVE_OFFSETS[idx % MAX_GRAVES_PER_CEMETERY] : graveOffset(idx);
    const m = new THREE.Mesh(this.headstoneGeo, this.mat);
    m.position.set(gx, 0.02, gz);
    m.castShadow = true;
    if (!target.gravesGroup) {
      target.gravesGroup = new THREE.Group();
      target.mesh.add(target.gravesGroup);
    }
    target.gravesGroup.add(m);
    return true;
  }


  remove(b: Building) {
    for (const t of this.footprint(b.kind, b.x, b.z)) this.occ[idx(t.x, t.z)] = -1;
    this.list.splice(this.list.indexOf(b), 1);
    this.byId.delete(b.id);
    this.dying.push({ mesh: b.mesh, t: 1 });
    b.removed = true;
  }

  /** Grow / shrink animations and crop growth (only in the growing season, with farmers and water). */
  update(dt: number, simDt: number, dayLength: number, growing: boolean, buildSpeed: (b: Building) => number = () => 1) {
    this.animTime += dt;
    const night = nightLevel.value;
    this.lampHeadMat.color.set('#c9c4b6').lerp(LAMP_ON, night);
    this.poolMat.opacity = night * 0.5;
    this.floodMat.opacity = this.matchOn ? Math.max(0.15, night) * 0.45 : 0;
    if (this.cinemaOn && night > 0.3) {
      // the film: slowly shifting scenes
      const tt = this.animTime * 0.35;
      this.screenMat.color.setHSL((Math.sin(tt) * 0.5 + 0.5) * 0.7, 0.45, 0.45 + Math.sin(tt * 3.1) * 0.1);
    } else this.screenMat.color.set('#2a2f36');
    this.labelT -= dt;
    const relabel = this.labelT <= 0;
    if (relabel) this.labelT = 0.4;
    for (const b of this.list) {
      if (relabel) this.updateLabel(b);
      const body = b.mesh.children[0] as THREE.Mesh | undefined;
      if (body) {
        const want = b.built >= 1 && b.powered && b.fire <= 0 ? this.mat : this.darkMat;
        if (body.material !== want) body.material = want;
      }
      if (b.kind === 'fountain') {
        const jet = b.mesh.getObjectByName('jet');
        if (jet) {
          jet.visible = b.built >= 1;
          jet.scale.set(1, 0.85 + Math.sin(this.animTime * 6) * 0.15, 1);
          jet.rotation.y += dt * 0.8;
        }
      }
      if (b.built < 1 && simDt > 0) {
        b.built = Math.min(1, b.built + (simDt / (dayLength * BUILD_DAYS[BUILDINGS[b.kind].size])) * buildSpeed(b));
        if (b.built >= 1) this.onBuilt(b);
      }
      if (b.grow < 1) b.grow = Math.min(1, b.grow + dt * 2.2);
      const building = b.built < 1;
      if (b.grow < 1 || building || b.scaffold?.visible) {
        const y = b.grow < 1 ? easeOutBack(b.grow) : 1;
        const xz = b.grow < 1 ? 0.6 + 0.4 * Math.min(1, b.grow * 1.6) : 1;
        const bs = building ? 0.12 + 0.88 * b.built : 1;
        const sy = Math.max(0.01, y * bs);
        b.mesh.scale.set(xz, sy, xz);
        if (b.scaffold) {
          b.scaffold.visible = building;
          b.scaffold.scale.set(1 / xz, 1 / sy, 1 / xz);
        }
      }
      if (b.kind === 'windturbine' && b.built >= 1) { const r = b.mesh.getObjectByName('rotor'); if (r) r.rotation.z += dt * (simDt > 0 ? 3 : 0.5); }
      if (b.kind === 'ranch' && b.cattleMeshes) {
        const count = b.cattleCount ?? 4;
        for (let i = 0; i < b.cattleMeshes.length; i++) {
          const cow = b.cattleMeshes[i];
          cow.visible = i < count;
          if (cow.visible) {
            const t = this.animTime * 1.5 + i * 2.1;
            cow.position.y = 0.02 + Math.abs(Math.sin(t)) * 0.005;
            cow.rotation.y += Math.sin(t * 0.4) * 0.002;
          }
        }
      }
      if (b.crop && simDt > 0 && b.built >= 1) {
        if (!growing) b.cropT = Math.max(0, b.cropT - simDt / dayLength);
        else if (b.workers > 0 && b.irrigated) {
          // a crop ripens in ~1.5 months with all farmers working
          b.cropT += (simDt / (dayLength * 1.5)) * Math.min(1, b.workers / BUILDINGS.farm.jobs);
          if (b.cropT >= 1) b.cropT = 0.05;
        }
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
    b.crop!.visible = t > 0.02 && b.built >= 1;
    b.crop!.scale.set(1, 0.15 + t * 1.6, 1);
    (b.crop!.material as THREE.MeshLambertMaterial).color.copy(CROP_GREEN).lerp(CROP_GOLD, Math.max(0, (t - 0.5) * 2));
  }

  at(k: number): Building | undefined {
    const id = this.occ[k];
    return id === -1 ? undefined : this.byId.get(id);
  }

  /** The Town Hall of a city (or the first one). */
  townHall(city?: number) {
    return this.list.find((b) => b.kind === 'townhall' && (city === undefined || b.city === city));
  }

  halls() {
    return this.list.filter((b) => b.kind === 'townhall');
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

  /** Move a building to a new spot (people, owner and records stay with it). */
  move(b: Building, x: number, z: number) {
    for (const t of this.footprint(b.kind, b.x, b.z)) this.occ[idx(t.x, t.z)] = -1;
    const { access, rot } = this.findAccess(b.kind, x, z);
    const s = BUILDINGS[b.kind].size;
    b.x = x;
    b.z = z;
    b.access = access;
    b.rot = rot;
    for (const t of this.footprint(b.kind, x, z)) this.occ[idx(t.x, t.z)] = b.id;
    b.mesh.position.set(tileToWorld(x) + (s - 1) / 2, 0, tileToWorld(z) + (s - 1) / 2);
    b.mesh.rotation.y = rot;
    b.grow = 0;
  }

  /** Free a building's tiles for a moment (to test a new spot that overlaps the old one). */
  withoutOcc<T>(b: Building, fn: () => T): T {
    const tiles = this.footprint(b.kind, b.x, b.z).map((t) => idx(t.x, t.z));
    for (const k of tiles) this.occ[k] = -1;
    try { return fn(); } finally { for (const k of tiles) this.occ[k] = b.id; }
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
    const variant = kind === 'house' ? hash2(x, z) % 16 : kind === 'flowerbed' || kind === 'sapling' ? hash2(x, z) % 3 : 0;
    const key = `${kind}:${variant}`;
    let g = this.geoCache.get(key);
    if (!g) {
      g = buildingGeometry(kind, variant);
      this.geoCache.set(key, g);
    }
    return g;
  }
}

const LAMP_ON = new THREE.Color('#ffe2a0');

/** A little sign drawn on a canvas: progress in big letters, the status below, and a progress bar. */
function drawLabel(progress: number, text: string, ok: boolean) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 200;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(26,29,34,0.94)';
  g.beginPath(); g.roundRect(4, 4, 632, 192, 26); g.fill();
  g.textBaseline = 'middle';
  g.fillStyle = ok ? '#f2a93b' : '#f07167';
  g.font = 'bold 54px Nunito, system-ui, sans-serif';
  g.fillText(`${Math.floor(progress * 100)}%`, 28, 50);
  g.fillStyle = '#eceef1';
  g.font = 'bold 38px Nunito, system-ui, sans-serif';
  // status on up to two lines
  const words = text.split(' ');
  const lines: string[] = [''];
  for (const w of words) {
    const tryLine = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
    if (g.measureText(tryLine).width > 580 && lines[lines.length - 1]) { if (lines.length === 2) { lines[1] += '…'; break; } lines.push(w); }
    else lines[lines.length - 1] = tryLine;
  }
  lines.forEach((l, i) => g.fillText(l, 28, 102 + i * 38));
  g.fillStyle = '#343a43';
  g.beginPath(); g.roundRect(170, 36, 440, 28, 14); g.fill();
  g.fillStyle = ok ? '#f2a93b' : '#f07167';
  g.beginPath(); g.roundRect(170, 36, Math.max(28, 440 * progress), 28, 14); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
