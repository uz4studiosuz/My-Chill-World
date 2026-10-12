import * as THREE from 'three';
import { DAY_SECONDS, IS_TOUCH, MAP_SIZE } from '../config';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { generateWorld } from '../world/WorldGen';
import { Terrain } from '../world/Terrain';
import { BRIDGE_COST, ROAD_COST, ROAD_TWO_LANE, ROUNDABOUT_COST, RoadNetwork, isRingMid } from '../roads/RoadNetwork';
import { RoadMesh } from '../roads/RoadMesh';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { Buildings, Building } from '../buildings/Buildings';
import { BUILDINGS, BuildingKind, QUARRY } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { History } from '../sim/History';
import { monthOf, seasonBlend, seasonOf, yearOf, growingSeason } from '../sim/Calendar';
import { Population, Citizen } from '../people/Population';
import { Walkers } from '../people/Walkers';
import { Traffic } from '../traffic/Traffic';
import { Animals } from '../animals/Animals';
import { Effects } from '../fx/Effects';
import { Weather } from '../fx/Weather';
import { Life } from './Life';
import { CameraRig } from '../camera/CameraRig';
import { Preview } from '../build/Preview';
import { BuildTool, CheckResult, GodKind, LineKind, PlaceKind, ToolHost, ToolId } from '../build/BuildTool';
import { InputController } from '../input/InputController';
import { Hud } from '../ui/Hud';
import { Inspector, InspectorView } from '../ui/Inspector';
import { StatsPanel, StatsSnapshot } from '../ui/StatsPanel';
import { SAVE_VERSION, SaveStore, WorldMeta, WorldSave } from '../save/SaveStore';
import { t } from '../i18n/i18n';

export interface GameOptions {
  /** Background world for the main menu: no input, no HUD, no saving. */
  demo?: boolean;
  save?: WorldSave;
  create?: { name: string; seed: number };
  thumbs?: Map<string, string>;
}

type Selection = { type: 'building'; id: number } | { type: 'person'; id: number } | null;

const DEMO_SEED = 424242;
const AUTOSAVE_SECONDS = 20;
const CANAL_COST = 8;
const BANKRUPT_DAYS = 8;
const SUN_OFFSET = new THREE.Vector3(-18, 40, 14);
const SKY_DAY = new THREE.Color('#9fc3d1');
const SKY_NIGHT = new THREE.Color('#1f2b3f');
const SKY_RAIN = new THREE.Color('#7d8a96');
const SUN_DAY = new THREE.Color('#fff3df');
const SUN_LOW = new THREE.Color('#ffb070');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
const KIND_BADGE: Record<BuildingKind, [string, string]> = {
  townhall: ['🏛️', '#3567c4'], house: ['🏠', '#c4553d'], office: ['🏢', '#4a7fb5'], school: ['🏫', '#d9714a'],
  parking: ['🅿️', '#2f6fd6'], weddinghall: ['💒', '#d97a9a'], watertower: ['💧', '#4a8fbd'], quarry: ['⛏️', '#8d8a83'],
  woodcutter: ['🪓', '#8a5a35'], powerplant: ['⚡', '#a65e43'], farm: ['🌾', '#b8952f'], orchard: ['🍎', '#4f8a3a'], ranch: ['🐄', '#7a5a3c'],
};

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export class Game implements ToolHost {
  readonly scene = new THREE.Scene();
  readonly cam: CameraRig;
  readonly demo: boolean;
  meta: WorldMeta;

  private map: WorldMap;
  private terrain: Terrain;
  private net = new RoadNetwork();
  private roadMesh: RoadMesh;
  private footpaths = new Footpaths();
  private canals: Canals;
  private buildings: Buildings;
  private eco = new Economy();
  private pop = new Population();
  private walkers = new Walkers();
  private history = new History();
  private traffic: Traffic;
  private animals: Animals;
  private effects = new Effects();
  private weather = new Weather();
  private life: Life;
  private preview = new Preview(MAP_SIZE * 2);
  private grid: THREE.GridHelper;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private marker: THREE.Mesh;

  private tool?: BuildTool;
  private input?: InputController;
  private hud?: Hud;
  private inspector?: Inspector;
  private stats?: StatsPanel;
  private abort = new AbortController();
  private thumbs: Map<string, string>;

  private speed = 1;
  private lastSpeed = 1;
  private menuPaused = false;
  private time = 0;
  private hudT = 0;
  private statsTick = 0;
  private saveT = 0;
  private smokeT = 0;
  private seasonT = 0;
  private lastDay = 0;
  private brokeDays = 0;
  private sandbox = false;
  private selection: Selection = null;
  private following = false;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions, private onMenu: () => void = () => {}) {
    this.demo = !!opts.demo;
    this.thumbs = opts.thumbs ?? new Map();
    const seed = opts.save?.meta.seed ?? opts.create?.seed ?? DEMO_SEED;
    this.meta = opts.save?.meta ?? {
      id: SaveStore.newId(), name: opts.create?.name ?? 'Demo', seed,
      day: 1, population: 100, money: 5000, updated: Date.now(),
    };

    this.scene.background = SKY_DAY.clone();
    this.hemi = new THREE.HemisphereLight('#e4f1ff', '#6f7f4c', 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3df', 2.2);
    this.sun.castShadow = true;
    const sm = IS_TOUCH ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 140;
    this.scene.add(this.sun, this.sun.target);

    this.map = generateWorld(seed);
    this.terrain = new Terrain(this.map);
    this.roadMesh = new RoadMesh(this.net, this.map);
    this.canals = new Canals(this.map);
    this.buildings = new Buildings(this.map, this.net, {
      isBlocked: (k) => this.footpaths.tiles[k] === 1 || this.canals.tiles[k] === 1,
      treesNear: (x, z, r) => this.terrain.treesNear(x, z, r),
    });
    this.traffic = new Traffic(this.net);
    this.life = new Life({
      map: this.map, terrain: this.terrain, net: this.net, footpaths: this.footpaths, canals: this.canals,
      buildings: this.buildings, eco: this.eco, pop: this.pop, walkers: this.walkers, traffic: this.traffic,
      effects: this.effects, weather: this.weather, burnDown: (b) => this.destroyBuilding(b, false),
    });
    this.grid = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, '#2d3a22', '#2d3a22');
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.12;
    this.grid.position.y = 0.005;
    this.grid.visible = false;
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd166' }));
    this.marker.visible = false;
    this.cam = new CameraRig(canvas);

    if (opts.save) this.loadSave(opts.save);
    else this.buildStarterTown();

    this.animals = new Animals(this.map, (k) => this.map.isLand(k) && !this.net.type[k] && !this.net.isIsland(k) && this.buildings.occ[k] === -1);
    this.scene.add(
      this.terrain.group, this.roadMesh.group, this.footpaths.mesh, this.canals.mesh, this.buildings.group, this.traffic.group,
      this.walkers.group, this.animals.group, this.effects.group, this.weather.group, this.preview.mesh, this.grid, this.marker,
    );
    this.pop.assign(this.buildings);
    this.networkChanged(false);
    if (!opts.save) this.pop.planDay();
    this.lastDay = this.eco.day;
    this.terrain.applySeason(seasonBlend(this.eco.day, this.eco.timeOfDay));
    this.weather.newDay(seasonOf(monthOf(this.eco.day)));

    if (this.demo) {
      this.cam.viewHalf = 12;
      this.cam.apply();
      return;
    }

    this.tool = new BuildTool(this, this.preview);
    this.createUi();
    this.input = new InputController(canvas, this.cam, this.tool, {
      setTool: (tl) => this.setTool(tl),
      undo: () => this.undo(),
      tap: (tile, p) => this.tap(tile, p),
      togglePause: () => this.setSpeed(this.speed === 0 ? this.lastSpeed : 0),
    }, this.abort.signal);

    const signal = this.abort.signal;
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); }, { signal });
    window.addEventListener('pagehide', () => this.save(), { signal });
  }

  /** (Re)build the HUD — also used after switching language. */
  createUi() {
    if (this.demo) return;
    this.hud?.dispose();
    this.hud = new Hud(document.getElementById('ui')!, {
      setTool: (tl) => this.setTool(tl),
      undo: () => this.undo(),
      rotate: (dir) => this.cam.rotate((dir * Math.PI) / 2),
      setSpeed: (s) => this.setSpeed(s),
      openMenu: () => this.onMenu(),
      openStats: () => this.stats?.toggle(),
    }, this.thumbs);
    this.inspector = new Inspector(this.hud.root, () => this.select(null), (id) => this.select({ type: 'person', id }));
    this.stats = new StatsPanel(this.hud.root, () => this.snapshot());
    this.setTool(this.tool?.tool ?? 'pan');
    this.setSpeed(this.speed);
    this.hud.setUndoEnabled(this.net.canUndo);
    this.refreshHud();
  }

  // ---------- lifecycle ----------

  resize(w: number, h: number) {
    this.cam.resize(w, h);
  }

  update(dt: number) {
    const sdt = this.menuPaused ? 0 : dt * this.speed;
    if (sdt > 0) {
      this.time += sdt;
      this.life.update(sdt);
      this.animals.update(sdt);
      this.history.update(sdt, () => ({
        t: this.time, day: this.eco.day, pop: this.pop.size, employed: this.pop.counts().workers,
        money: Math.round(this.eco.money), stone: Math.round(this.eco.stone), food: Math.round(this.eco.food),
        wood: Math.round(this.eco.wood), energy: Math.round(this.eco.powered * 100),
        cars: this.traffic.count('car'), trucks: this.traffic.count('truck'), walkers: this.walkers.list.length,
        animals: this.animals.list.length,
      }));
      this.chimneySmoke(sdt);
      if (this.eco.day !== this.lastDay) this.onNewDay();
    }
    this.traffic.setParked(this.life.parkedCars());
    this.traffic.update(sdt);
    this.walkers.update(sdt);
    this.buildings.update(dt, sdt, DAY_SECONDS, growingSeason(monthOf(this.eco.day)));
    this.effects.update(dt);
    this.weather.update(dt, sdt, this.eco.timeOfDay, this.cam.target, this.cam.viewHalf);
    this.seasonT -= dt;
    if (this.seasonT <= 0) {
      this.seasonT = 0.4;
      this.terrain.applySeason(seasonBlend(this.eco.day, this.eco.timeOfDay));
    }
    this.updateLighting();
    this.updateMarker(dt);

    if (this.demo) this.cam.rotate(dt * 0.04, false);
    this.input?.update(dt);
    this.cam.update(dt);
    this.followSun();

    if (this.hud) {
      this.hudT += dt;
      if (this.hudT > 0.25) {
        this.hudT = 0;
        this.refreshHud();
      }
      this.saveT += dt;
      if (this.saveT > AUTOSAVE_SECONDS) this.save();
    }
  }

  setMenuPaused(p: boolean) {
    this.menuPaused = p;
    if (this.input) this.input.enabled = !p;
    if (p) this.tool?.cancel();
  }

  save(manual = false) {
    if (this.demo) return;
    this.saveT = 0;
    try {
      SaveStore.save(this.toSave());
      if (manual) this.hud?.toast(t('Game saved'));
    } catch (e) {
      console.warn('[save]', e);
    }
  }

  dispose() {
    this.abort.abort();
    this.hud?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  // ---------- ToolHost ----------

  checkLine(kind: LineKind, path: Tile[]): CheckResult {
    if (kind === 'path' || kind === 'canal') {
      const canal = kind === 'canal';
      for (const tl of path) {
        const k = idx(tl.x, tl.z);
        if (this.net.type[k]) continue; // passes under/over roads
        if (!this.map.isLand(k)) return canal && this.map.water[k] ? { ok: false, reason: t('Start the canal next to the water, not on it') } : { ok: false, reason: t('Needs dry, flat land') };
        if (this.buildings.occ[k] !== -1 || this.net.isIsland(k)) return { ok: false, reason: t('Something is in the way') };
      }
      if (!canal) return { ok: true, money: 0, stone: 0 };
      const money = path.filter((tl) => !this.canals.tiles[idx(tl.x, tl.z)]).length * CANAL_COST;
      if (this.eco.money < money) return { ok: false, reason: t('Not enough money — needs ${n}', { n: money }) };
      return { ok: true, money };
    }
    let money = 0, stone = 0, bridges = 0;
    for (let i = 0; i < path.length; i++) {
      const tl = path[i];
      const k = idx(tl.x, tl.z);
      if (this.map.height[k] > 0) return { ok: false, reason: t('Too steep — mountains') };
      if (this.buildings.occ[k] !== -1) return { ok: false, reason: t('A building is in the way') };
      if (this.net.isIsland(k)) return { ok: false, reason: t("Can't drive through a roundabout island") };
      if (this.net.isRing(k)) {
        const c = this.net.ringCenter[k];
        const dx = tl.x - (c % N), dz = tl.z - ((c / N) | 0);
        const nb = i === 0 ? path[1] : i === path.length - 1 ? path[i - 1] : null;
        const outward = nb && nb.x === tl.x + dx && nb.z === tl.z + dz;
        if (!isRingMid(dx, dz) || !outward) return { ok: false, reason: t('Connect roads to the middle of a roundabout side') };
        continue;
      }
      if (!this.net.type[k]) {
        const c = this.map.water[k] ? BRIDGE_COST : ROAD_COST[2];
        money += c.money;
        stone += c.stone;
      }
      if (this.map.water[k]) bridges++;
    }
    if (this.eco.money < money) return { ok: false, reason: t('Not enough money — needs ${n}', { n: money }), money, stone };
    if (this.eco.stone < stone) return { ok: false, reason: t('Not enough stone — needs {n}. Build a quarry!', { n: stone }), money, stone };
    return { ok: true, money, stone, bridges };
  }

  buildLine(kind: LineKind, path: Tile[]) {
    const r = this.checkLine(kind, path);
    if (!r.ok) return this.hud?.toast(r.reason!);
    const free = path.filter((tl) => !this.net.type[idx(tl.x, tl.z)]);
    if (kind === 'path' || kind === 'canal') {
      this.eco.spend(r.money ?? 0, 0);
      if (kind === 'path') { this.canals.remove(free); this.footpaths.add(free); }
      else { this.footpaths.remove(free); this.canals.add(path.filter((tl) => this.map.isLand(idx(tl.x, tl.z)))); }
      this.terrain.clearTiles(free.map((tl) => idx(tl.x, tl.z)));
      this.effects.pave(path);
      this.networkChanged();
      return;
    }
    this.net.pushUndo(r.money, r.stone);
    this.eco.spend(r.money!, r.stone!);
    this.footpaths.remove(path);
    this.net.buildPath(path, ROAD_TWO_LANE);
    this.terrain.clearTiles(path.map((tl) => idx(tl.x, tl.z)));
    this.effects.pave(path);
    this.networkChanged();
  }

  checkPlace(kind: PlaceKind, tl: Tile): CheckResult {
    if (kind === 'roundabout') return this.checkRoundabout(tl);
    const def = BUILDINGS[kind];
    const r = this.buildings.check(kind, tl.x, tl.z);
    if (!r.ok) return { ok: false, reason: t(r.reason!) };
    if (!this.eco.canAfford(def.money, def.stone, def.wood)) {
      return { ok: false, reason: t('Needs {cost}', { cost: costText(def.money, def.stone, def.wood) }) };
    }
    return { ok: true, money: def.money, stone: def.stone, wood: def.wood };
  }

  place(kind: PlaceKind, tl: Tile) {
    const r = this.checkPlace(kind, tl);
    if (!r.ok) return this.hud?.toast(r.reason!);
    if (kind === 'roundabout') {
      this.net.pushUndo(ROUNDABOUT_COST.money, ROUNDABOUT_COST.stone);
      this.eco.spend(ROUNDABOUT_COST.money, ROUNDABOUT_COST.stone);
      const area = this.footprint(kind, tl);
      this.footpaths.remove(area);
      this.net.addRoundabout(tl.x, tl.z);
      this.terrain.clearTiles(area.map((f) => idx(f.x, f.z)));
      this.effects.puff(tileToWorld(tl.x), tileToWorld(tl.z), 1.4, 24);
      this.effects.pave(area);
      this.networkChanged();
      this.hud?.toast(t('Roundabout built'));
      return;
    }
    const def = BUILDINGS[kind];
    this.eco.spend(def.money, def.stone, def.wood);
    const b = this.buildings.place(kind, tl.x, tl.z);
    this.terrain.clearTiles(this.footprint(kind, tl).map((f) => idx(f.x, f.z)));
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, def.size * 0.5, 10 + def.size * 8);
    this.net.clearUndo();
    this.pop.assign(this.buildings);
    this.networkChanged();
    this.hud?.toast(t('{name} built', { name: t(def.name) }));
  }

  footprint(kind: PlaceKind, tl: Tile) {
    if (kind === 'roundabout') {
      const out: Tile[] = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) out.push({ x: tl.x + dx, z: tl.z + dz });
      return out;
    }
    return this.buildings.footprint(kind, tl.x, tl.z);
  }

  bulldoze(path: Tile[]) {
    const roads = path.filter((tl) => this.net.hasRoad(tl));
    const targets = new Set<Building>();
    let keptTownHall = false;
    for (const tl of path) {
      const b = this.buildings.at(idx(tl.x, tl.z));
      if (!b) continue;
      if (b.kind === 'townhall') keptTownHall = true;
      else targets.add(b);
    }
    if (keptTownHall) this.hud?.toast(t("The Town Hall can't be removed"));
    const paths = this.footpaths.remove(path) + this.canals.remove(path);
    if (!roads.length && !targets.size && !paths) return;
    if (roads.length) {
      this.net.pushUndo();
      this.net.removePath(roads);
      for (const tl of roads) this.effects.puff(tileToWorld(tl.x), tileToWorld(tl.z), 0.3, 3);
    }
    for (const b of targets) this.destroyBuilding(b, true);
    if (targets.size) this.net.clearUndo();
    this.networkChanged();
  }

  brushArea(kind: GodKind, tl: Tile): Tile[] {
    if (kind === 'lightning') return [tl];
    const r = kind === 'rain' ? 2 : 1;
    const out: Tile[] = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dz) <= r && inBounds(tl.x + dx, tl.z + dz)) out.push({ x: tl.x + dx, z: tl.z + dz });
    }
    return out;
  }

  brush(kind: GodKind, tl: Tile, first: boolean) {
    const x = tileToWorld(tl.x), z = tileToWorld(tl.z);
    if (kind === 'rain') { this.weather.addRain(x, z); return; }
    if (kind === 'lightning') {
      if (!first) return;
      this.weather.strike(x, z);
      this.effects.puff(x, z, 0.4, 16, ['#fff3b0', '#ffd166', '#3a2a20']);
      this.life.lightning(x, z);
      const animals = this.animals.killNear(x, z, 0.8);
      if (animals) this.hud?.toast(t('Lightning killed {n} animals', { n: animals }));
      return;
    }
    // raise / lower the land
    const changed: number[] = [];
    for (const a of this.brushArea(kind, tl)) {
      const k = idx(a.x, a.z);
      if (this.net.type[k] || this.buildings.occ[k] !== -1 || this.net.isIsland(k)) continue;
      if (kind === 'raise') {
        if (this.map.water[k]) this.map.water[k] = 0;
        else if (this.map.height[k] < 10) this.map.height[k]++;
        else continue;
      } else {
        if (this.map.height[k] > 0) this.map.height[k]--;
        else if (!this.map.water[k]) this.map.water[k] = 1;
        else continue;
      }
      changed.push(k);
    }
    if (!changed.length) return;
    for (const k of changed) {
      if (!this.map.isLand(k)) { this.footpaths.tiles[k] = 0; this.canals.tiles[k] = 0; }
    }
    this.terrain.reshape(changed);
    this.effects.puff(x, z, 0.8, 8, kind === 'raise' ? ['#8a6a46', '#9b978e', '#a4c064'] : ['#4fa3d1', '#8a6a46', '#d9c99a']);
    this.footpaths.rebuild((k) => this.net.type[k] !== 0);
    this.canals.rebuild();
  }

  showHint(text: string | null) {
    this.hud?.setHint(text);
  }

  // ---------- internals ----------

  private destroyBuilding(b: Building, refund: boolean) {
    if (b.removed) return;
    if (refund) this.eco.money += Math.floor(BUILDINGS[b.kind].money / 2);
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.5, 18, refund ? undefined : ['#3a2a20', '#6b6b6b', '#ff7a1a']);
    this.buildings.remove(b);
    this.life.buildingRemoved(b);
    if (this.selection?.type === 'building' && this.selection.id === b.id) this.select(null);
    if (!refund) this.networkChanged();
  }

  private checkRoundabout(tl: Tile): CheckResult {
    for (const f of this.footprint('roundabout', tl)) {
      if (!inBounds(f.x, f.z)) return { ok: false, reason: t('Out of the map') };
      const k = idx(f.x, f.z);
      if (!this.map.isLand(k)) return { ok: false, reason: t('Needs flat dry land (3×3)') };
      if (this.buildings.occ[k] !== -1) return { ok: false, reason: t('A building is in the way') };
      if (this.net.ringCenter[k] >= 0) return { ok: false, reason: t('Already a roundabout here') };
    }
    const c = ROUNDABOUT_COST;
    if (!this.eco.canAfford(c.money, c.stone)) return { ok: false, reason: t('Needs {cost}', { cost: costText(c.money, c.stone, 0) }) };
    return { ok: true, money: c.money, stone: c.stone };
  }

  private setTool(tl: ToolId) {
    this.tool?.setTool(tl);
    this.grid.visible = tl !== 'pan' && tl !== 'rain' && tl !== 'lightning';
    this.hud?.setActive(tl);
  }

  private setSpeed(s: number) {
    if (s > 0) this.lastSpeed = s;
    this.speed = s;
    this.hud?.setSpeed(s);
  }

  private undo() {
    const refund = this.net.undo();
    if (!refund) return;
    this.eco.money += refund.money;
    this.eco.stone += refund.stone;
    this.networkChanged();
  }

  private networkChanged(dirty = true) {
    this.roadMesh.rebuild();
    this.footpaths.rebuild((k) => this.net.type[k] !== 0);
    this.canals.rebuild();
    this.buildings.refreshAccess();
    this.traffic.networkChanged();
    this.life.rebuildGrid();
    this.hud?.setUndoEnabled(this.net.canUndo);
    if (dirty) this.saveT = AUTOSAVE_SECONDS - 2;
  }

  private onNewDay() {
    this.lastDay = this.eco.day;
    if (this.sandbox) return;
    this.brokeDays = this.eco.money < 0 ? this.brokeDays + 1 : 0;
    if (this.brokeDays === 3) this.hud?.toast(t('The town treasury is empty! Raise income or cut costs.'));
    if (this.brokeDays >= BANKRUPT_DAYS && this.hud) {
      this.setSpeed(0);
      this.hud.showModal(t('Bankrupt!'), t('The town has been in debt for {n} months. The bank refuses to lend any more money.', { n: this.brokeDays }), [
        { label: t('Keep playing (sandbox)'), primary: true, onClick: () => { this.sandbox = true; this.eco.money = 0; this.setSpeed(1); } },
        { label: t('Main Menu'), onClick: () => this.onMenu() },
      ]);
    }
  }

  private chimneySmoke(dt: number) {
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = 0.6;
    if (this.eco.wood <= 0) return;
    for (const b of this.buildings.ofKind('powerplant')) {
      if (!b.workers) continue;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = 0.45, lz = -0.55;
      this.effects.smoke(b.mesh.position.x + lx * c + lz * s, 1.4, b.mesh.position.z - lx * s + lz * c);
    }
  }

  private updateLighting() {
    const tod = this.eco.timeOfDay;
    const season = seasonBlend(this.eco.day, tod);
    const day = smooth(0.22, 0.3, tod) * (1 - smooth(0.74, 0.84, tod));
    const low = Math.max(0, 1 - Math.abs(tod - 0.26) * 12) + Math.max(0, 1 - Math.abs(tod - 0.79) * 12);
    const rain = this.weather.naturalActive ? 0.35 : 0;
    const winter = season.snow * 0.15;
    this.sun.intensity = (0.35 + 1.9 * day) * (1 - rain - winter) + this.weather.flash * 4;
    this.sun.color.copy(SUN_DAY).lerp(SUN_LOW, Math.min(1, low));
    this.hemi.intensity = (0.6 + 0.95 * day) * (1 - rain * 0.5) + this.weather.flash * 2;
    const bg = this.scene.background as THREE.Color;
    bg.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    if (rain) bg.lerp(SKY_RAIN, 0.5 * day);
    if (this.weather.flash > 0) bg.lerp(new THREE.Color('#ffffff'), this.weather.flash * 0.6);
  }

  private followSun() {
    const tg = this.cam.target;
    this.sun.target.position.copy(tg);
    this.sun.position.copy(tg).add(SUN_OFFSET);
    const s = this.cam.viewHalf * Math.max(this.cam.aspect, 1) * 1.6 + 2;
    const sc = this.sun.shadow.camera;
    if (sc.right !== s) {
      sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s;
      sc.updateProjectionMatrix();
    }
  }

  // ---------- selection & inspector ----------

  private tap(tile: Tile | null, p?: { x: number; z: number }) {
    if (p) {
      let best: Citizen | null = null, bd = 0.35;
      for (const c of this.pop.citizens.values()) {
        const w = c.walker;
        if (!w || w.leaving) continue;
        const d = Math.hypot(w.x - p.x, w.z - p.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return this.select({ type: 'person', id: best.id });
    }
    const b = tile ? this.buildings.at(idx(tile.x, tile.z)) : undefined;
    this.select(b ? { type: 'building', id: b.id } : null);
  }

  private select(s: Selection) {
    if (s?.type !== this.selection?.type || s?.id !== this.selection?.id) this.following = false;
    this.selection = s;
    if (!s) this.inspector?.hide();
    else this.refreshInspector();
  }

  private personPos(c: Citizen) {
    if (c.walker && !c.walker.leaving) return { x: c.walker.x, z: c.walker.z, y: 0.3 * c.walker.scale };
    const b = this.buildings.get(c.at);
    if (!b) return null;
    return { x: b.mesh.position.x, z: b.mesh.position.z, y: 0.5 + BUILDINGS[b.kind].size * 0.3 };
  }

  private updateMarker(dt: number) {
    const s = this.selection;
    if (s?.type !== 'person') { this.marker.visible = false; return; }
    const c = this.pop.citizens.get(s.id);
    const p = c && this.personPos(c);
    if (!p) { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.position.set(p.x, p.y + 0.12 + Math.sin(this.time * 6) * 0.03, p.z);
    this.marker.rotation.y += dt * 3;
    if (this.following) {
      const tg = this.cam.target;
      tg.x += (p.x - tg.x) * Math.min(1, dt * 4);
      tg.z += (p.z - tg.z) * Math.min(1, dt * 4);
      this.cam.apply();
    }
  }

  private personIcon(c: Citizen) {
    if (c.age < 3) return '👶';
    if (c.age < 18) return c.sex === 'm' ? '👦' : '👧';
    if (c.age >= 65) return c.sex === 'm' ? '👴' : '👵';
    return c.sex === 'm' ? '👨' : '👩';
  }

  private roleText(c: Citizen) {
    const b = c.job >= 0 ? this.buildings.get(c.job) : undefined;
    if (c.age < 3) return t('Baby');
    if (b) return t('Works at {place}', { place: t(BUILDINGS[b.kind].name) });
    if (c.school >= 0) return t('Pupil');
    if (c.age < 6) return t('Small child');
    if (c.age < 18) return t('Child (no school place)');
    if (c.age >= 65) return t('Retired');
    if (this.pop.onLeave(c)) return t('Parental leave');
    return t('Looking for work');
  }

  private refreshInspector() {
    const s = this.selection;
    if (!this.inspector || !s) return;
    if (s.type === 'person') {
      const c = this.pop.citizens.get(s.id);
      if (!c) { this.hud?.toast(t('This person is no longer with us')); return this.select(null); }
      return this.inspector.show(this.personView(c));
    }
    const b = this.buildings.get(s.id);
    if (!b) return this.select(null);
    this.inspector.show(b.kind === 'house' ? this.houseView(b) : this.buildingView(b));
  }

  private personView(c: Citizen): InspectorView {
    const f = this.pop.families.get(c.family);
    const home = f && this.buildings.get(f.home);
    const age = Math.floor(c.age);
    const tags: InspectorView['tags'] = [];
    if (c.hunger < 25) tags.push({ text: t('Hungry'), tone: 'bad' });
    if (c.health < 50) tags.push({ text: t('Sick'), tone: 'bad' });
    if (c.edu >= 0.99 && age >= 18) tags.push({ text: t('Educated'), tone: 'good' });
    if (f?.car && age >= 18) tags.push({ text: t('Family car'), tone: 'info' });
    const job = c.job >= 0 ? this.buildings.get(c.job) : c.school >= 0 ? this.buildings.get(c.school) : undefined;
    return {
      key: `p${c.id}`,
      badge: this.personIcon(c),
      badgeColor: c.sex === 'm' ? '#3a6fd1' : '#d9568f',
      title: `${c.name} ${f?.surname ?? ''}`,
      subtitle: `${t('{n} years', { n: age })} · ${this.roleText(c)}`,
      tags,
      bars: [
        { label: t('Food'), value: c.hunger / 100, color: barColor(c.hunger / 100) },
        { label: t('Health'), value: c.health / 100, color: barColor(c.health / 100) },
        ...(age >= 6 ? [{ label: t('Education'), value: c.edu, color: '#6fb6ff' }] : []),
      ],
      rows: [
        [t('Doing'), t(c.activity)],
        [t('Home'), f ? t('{name} family', { name: f.surname }) : '—'],
        [c.school >= 0 ? t('School') : t('Workplace'), job ? t(BUILDINGS[job.kind].name) : '—'],
        [t('Family savings'), f ? `$${Math.floor(f.money).toLocaleString('en-US')}` : '—', f && f.money < 0 ? 'bad' : undefined],
      ],
      actions: [
        { label: this.following ? t('Stop following') : t('Follow'), icon: 'follow', active: this.following, onClick: () => { this.following = !this.following; this.refreshInspector(); } },
        ...(home ? [{ label: t('Show home'), icon: 'house' as const, onClick: () => { this.cam.setState(home.mesh.position.x, home.mesh.position.z, this.cam.yaw, this.cam.viewHalf); this.select({ type: 'building', id: home.id }); } }] : []),
      ],
    };
  }

  private houseView(b: Building): InspectorView {
    const f = this.pop.familyAt(b.id);
    if (!f) {
      return {
        key: `b${b.id}`, badge: '🏠', badgeColor: KIND_BADGE.house[1], title: t('Empty house'), subtitle: t('Waiting for a family to move in'),
        rows: [[t('Road'), b.access >= 0 ? t('Connected') : t('No road access'), b.access >= 0 ? 'good' : 'bad'], [t('Power'), b.powered ? t('Yes') : t('No'), b.powered ? 'good' : 'bad']],
      };
    }
    const people = this.pop.members(f).sort((a, c) => c.age - a.age);
    const avg = (fn: (c: Citizen) => number) => people.reduce((a, c) => a + fn(c), 0) / Math.max(1, people.length);
    const car = f.car ? (f.car.at === 'home' ? t('Parked at home') : f.car.at === 'away' ? t('Parked at work') : t('On the road')) : t('No car — they walk');
    return {
      key: `b${b.id}`,
      badge: '🏠',
      badgeColor: KIND_BADGE.house[1],
      title: t('{name} family', { name: f.surname }),
      subtitle: t('{n} people', { n: people.length }),
      bars: [
        { label: t('Food'), value: avg((c) => c.hunger) / 100, color: barColor(avg((c) => c.hunger) / 100) },
        { label: t('Health'), value: avg((c) => c.health) / 100, color: barColor(avg((c) => c.health) / 100) },
      ],
      rows: [
        [t('Savings'), `$${Math.floor(f.money).toLocaleString('en-US')}`, f.money < 0 ? 'bad' : undefined],
        [t('Earned yesterday'), `${f.income >= 0 ? '+' : '−'}$${Math.abs(f.income)}`, f.income >= 0 ? 'good' : 'bad'],
        [t('Car'), car],
        [t('Power'), b.powered ? t('Yes') : t('No — not connected to a power plant'), b.powered ? 'good' : 'bad'],
        [t('Water'), this.life.waterSupply >= 0.99 ? t('Clean water') : t('Not enough water!'), this.life.waterSupply >= 0.99 ? 'good' : 'bad'],
      ],
      listTitle: t('Family members'),
      people: people.map((c) => ({
        id: c.id, icon: this.personIcon(c), name: c.name, warn: c.hunger < 25 || c.health < 50,
        detail: `${t('{n} years', { n: Math.floor(c.age) })} · ${this.roleText(c)} · ${t(c.activity)}`,
      })),
    };
  }

  private buildingView(b: Building): InspectorView {
    const def = BUILDINGS[b.kind];
    const staff = [...this.pop.citizens.values()].filter((c) => c.job === b.id);
    const tags: InspectorView['tags'] = [];
    const rows: InspectorView['rows'] = [];
    const bars: InspectorView['bars'] = [];
    if (b.fire > 0) tags.push({ text: t('On fire!'), tone: 'bad' });
    if (def.energy) tags.push(b.powered ? { text: t('Powered'), tone: 'good' } : { text: t('No power'), tone: 'bad' });
    if (def.needsRoad && b.access < 0) tags.push({ text: t('No road access'), tone: 'bad' });
    if (def.jobs) {
      bars.push({ label: t('Workers'), value: staff.length / def.jobs, color: '#6fb6ff', text: `${staff.length}/${def.jobs}` });
      rows.push([t('At work now'), `${b.present}`], [t('Wage'), `$${def.salary}/${t('day')}${def.publicJob ? ` (${t('paid by town')})` : ''}`]);
    }
    let subtitle = t(def.name);
    if (b.kind === 'farm') {
      const growing = growingSeason(monthOf(this.eco.day));
      tags.push(b.irrigated ? { text: t('Irrigated'), tone: 'good' } : { text: t('No water — dig a canal'), tone: 'bad' });
      if (!growing) tags.push({ text: t('Winter rest'), tone: 'info' });
      bars.push({ label: t('Crops'), value: b.cropT, color: '#e3bf4f' });
      subtitle = growing ? (b.irrigated ? t('Growing crops') : t('Dry field')) : t('Resting until spring');
    }
    if (def.food) rows.push([t('Food output'), t('up to {n}/day', { n: def.food })]);
    if (b.kind === 'powerplant') {
      rows.push([t('Wood in stock'), `${Math.floor(this.eco.wood)}`, this.eco.wood < 15 ? 'bad' : undefined], [t('Town demand'), `${Math.round(this.eco.energyDemand)}/${t('day')}`]);
      bars.push({ label: t('Energy supplied'), value: this.eco.powered, color: '#ffe066' });
    }
    if (b.kind === 'watertower') bars.push({ label: t('Water supplied'), value: this.life.waterSupply, color: '#4fa3d1' });
    if (b.kind === 'woodcutter') rows.push([t('Trees nearby'), `${this.terrain.treesNear(b.x, b.z, 10)}`]);
    if (b.kind === 'quarry') {
      bars.push({ label: t('Stone ready'), value: b.stored / QUARRY.maxStored, color: '#aab4be', text: `${Math.floor(b.stored)}/${QUARRY.maxStored}` });
      rows.push([t('Trucks'), `${b.trucks}/2`]);
    }
    if (def.slots.length && b.kind !== 'house') rows.push([t('Parking'), `${this.life.spotsUsed(b)}/${def.slots.length}`]);
    let people = staff;
    let listTitle = t('Workers');
    if (b.kind === 'school') {
      people = [...this.pop.citizens.values()].filter((c) => c.school === b.id);
      bars.push({ label: t('Pupils'), value: people.length / def.students, color: '#7be08f', text: `${people.length}/${def.students}` });
      listTitle = t('Pupils');
    }
    return {
      key: `b${b.id}`,
      badge: KIND_BADGE[b.kind][0],
      badgeColor: KIND_BADGE[b.kind][1],
      title: t(def.name),
      subtitle,
      tags, bars, rows, listTitle,
      people: people.map((c) => {
        const f = this.pop.families.get(c.family);
        return { id: c.id, icon: this.personIcon(c), name: `${c.name} ${f?.surname ?? ''}`, detail: `${t('{n} years', { n: Math.floor(c.age) })} · ${t(c.activity)}`, warn: c.hunger < 25 || c.health < 50 };
      }),
    };
  }

  private dateText() {
    const m = monthOf(this.eco.day);
    return `${t(MONTHS[m]).slice(0, 3)} · ${t('Year {n}', { n: yearOf(this.eco.day) })}`;
  }

  private refreshHud() {
    const e = this.eco;
    const counts = this.pop.counts();
    this.hud!.setStats({
      money: e.money, daily: this.life.lastBalance.net, stone: e.stone, wood: e.wood, food: e.food,
      foodDaily: this.foodBalance(), powered: e.powered, water: this.life.waterSupply,
      population: this.pop.size, workers: counts.workers, workforce: counts.workforce,
      dateText: this.dateText(), seasonIcon: SEASON_ICON[seasonOf(monthOf(e.day))], timeOfDay: e.timeOfDay, broke: e.money < 0,
    });
    const ev = this.life.events.shift();
    if (ev) this.hud!.toast(ev);
    if (this.selection) this.refreshInspector();
    if (this.stats?.visible && ++this.statsTick % 4 === 0) this.stats.render();
  }

  /** Expected food balance per day: yesterday's harvest (or capacity on day 1) minus what everyone eats. */
  private foodBalance() {
    const y = this.life.foodYesterday;
    const made = y.made || this.buildings.list.reduce((a, b) => a + (BUILDINGS[b.kind].food ? BUILDINGS[b.kind].food * Math.min(1, b.workers / BUILDINGS[b.kind].jobs) : 0), 0);
    return Math.round(made - this.pop.size);
  }

  private snapshot(): StatsSnapshot {
    const e = this.eco;
    const tt = this.buildings.totals();
    const rc = this.net.counts(this.map.water);
    const families = [...this.pop.families.values()];
    return {
      money: e.money, stone: e.stone, wood: e.wood, food: e.food, foodRate: this.foodBalance() + this.pop.size,
      energyDemand: e.energyDemand, energyCapacity: e.energyCapacity, powered: e.powered, water: this.life.waterSupply,
      population: this.pop.size, families: families.length, carsOwned: families.filter((f) => f.car).length,
      people: this.pop.counts(), jobs: tt.jobs, schoolSeats: tt.students, freeHomes: this.life.freeHomes().length,
      balance: this.life.lastBalance,
      buildings: this.buildings.countBy(),
      roads: { total: rc.total, bridges: rc.bridges, roundabouts: this.net.roundabouts.length, signals: this.traffic.signalCount, footpaths: this.footpaths.count(), canals: this.canals.count() },
      traffic: { cars: this.traffic.count('car'), trucks: this.traffic.count('truck'), walkers: this.walkers.list.length, parked: this.life.parkedCars().length },
      animals: {
        cows: this.animals.list.filter((a) => a.kind === 0).length,
        sheep: this.animals.list.filter((a) => a.kind === 1).length,
        herds: new Set(this.animals.list.map((a) => `${a.kind}:${Math.round(a.herdX)}:${Math.round(a.herdZ)}`)).size,
      },
      trees: this.terrain.trees.size,
      hasHall: this.buildings.ofKind('weddinghall').length > 0,
      deathsYesterday: this.life.lastReport?.deaths.length ?? 0,
      history: this.history.samples,
    };
  }

  // ---------- world setup / saving ----------

  private buildStarterTown() {
    const c = N / 2;
    const main: Tile[] = [];
    for (let x = c - 10; x <= c + 10; x++) main.push({ x, z: c });
    const side: Tile[] = [];
    for (let z = c; z <= c + 7; z++) side.push({ x: c + 1, z });
    this.net.buildPath(main, ROAD_TWO_LANE);
    this.net.buildPath(side, ROAD_TWO_LANE);
    this.terrain.clearTiles([...main, ...side].map((tl) => idx(tl.x, tl.z)));

    const put = (kind: BuildingKind, x: number, z: number) => {
      if (!this.buildings.footprint(kind, x, z).every((f) => inBounds(f.x, f.z) && this.map.isLand(idx(f.x, f.z)) && this.buildings.occ[idx(f.x, f.z)] === -1 && !this.net.type[idx(f.x, f.z)])) return null;
      const b = this.buildings.place(kind, x, z, { animate: false });
      this.terrain.clearTiles(this.buildings.footprint(kind, x, z).map((f) => idx(f.x, f.z)));
      return b;
    };
    put('townhall', c - 1, c - 2);
    const houses: Building[] = [];
    for (const x of [c - 6, c - 5, c - 4, c - 3, c + 2, c + 3, c + 4, c + 5]) houses.push(put('house', x, c - 1)!);
    for (const z of [c + 2, c + 3]) {
      houses.push(put('house', c, z)!);
      houses.push(put('house', c + 2, z)!);
    }
    put('watertower', c - 2, c - 1);
    put('powerplant', c - 9, c - 2);
    const farm = put('farm', c - 7, c + 2);
    put('orchard', c - 4, c + 2);
    put('ranch', c + 4, c + 3);
    put('office', c + 6, c + 1);
    const path: Tile[] = [];
    for (let x = c - 9; x <= c - 1; x++) path.push({ x, z: c + 1 });
    this.footpaths.add(path.filter((tl) => this.buildings.occ[idx(tl.x, tl.z)] === -1));
    if (farm) this.digStarterCanal(farm);

    let best: Tile | null = null, bestD = Infinity;
    for (let z = c - 26; z <= c + 26; z++) for (let x = c - 26; x <= c + 26; x++) {
      if (!inBounds(x, z) || !this.map.isLand(idx(x, z)) || this.terrain.trees.has(idx(x, z))) continue;
      const d = Math.abs(x - c) + Math.abs(z - c);
      if (d < 10 || d >= bestD || this.buildings.occ[idx(x, z)] !== -1 || this.net.type[idx(x, z)] || this.canals.tiles[idx(x, z)]) continue;
      if (this.terrain.treesNear(x, z, 6) >= 10) { best = { x, z }; bestD = d; }
    }
    if (best) put('woodcutter', best.x, best.z);

    const sizes = houses.map(() => 6 + Math.floor(Math.random() * 5));
    let sum = sizes.reduce((a, v) => a + v, 0);
    while (sum > 100) { const i = Math.floor(Math.random() * sizes.length); if (sizes[i] > 4) { sizes[i]--; sum--; } }
    while (sum < 100) { const i = Math.floor(Math.random() * sizes.length); if (sizes[i] < 10) { sizes[i]++; sum++; } }
    houses.forEach((h, i) => this.pop.createFamily(h.id, { size: sizes[i], carChance: 0.45 }));
    this.net.clearUndo();
    this.cam.setState(-1, 0, Math.PI / 4, 10);
  }

  /** Dig an irrigation canal from the starter farm to the nearest river or lake (BFS over open land). */
  private digStarterCanal(farm: Building) {
    const prev = new Int32Array(N * N).fill(-2);
    const queue: number[] = [];
    const s = BUILDINGS.farm.size;
    for (let i = 0; i < s; i++) {
      for (const [x, z] of [[farm.x + i, farm.z + s], [farm.x - 1, farm.z + i], [farm.x + s, farm.z + i]]) {
        if (!inBounds(x, z)) continue;
        const k = idx(x, z);
        if (this.map.isLand(k) && this.buildings.occ[k] === -1 && prev[k] === -2) { prev[k] = -1; queue.push(k); }
      }
    }
    let found = -1;
    for (let h = 0; h < queue.length && found < 0; h++) {
      const k = queue[h];
      const x = k % N, z = (k / N) | 0;
      for (const d of DIRS) {
        const nx = x + d.dx, nz = z + d.dz;
        if (!inBounds(nx, nz)) continue;
        const nk = idx(nx, nz);
        if (this.map.water[nk]) { found = k; break; }
        if (prev[nk] !== -2 || !this.map.isLand(nk) || this.buildings.occ[nk] !== -1) continue;
        prev[nk] = k;
        queue.push(nk);
      }
    }
    if (found < 0) return;
    const tiles: Tile[] = [];
    for (let k = found; k >= 0; k = prev[k]) tiles.push({ x: k % N, z: (k / N) | 0 });
    this.canals.add(tiles);
    this.terrain.clearTiles(tiles.filter((tl) => !this.net.type[idx(tl.x, tl.z)]).map((tl) => idx(tl.x, tl.z)));
  }

  private loadSave(s: WorldSave) {
    if (s.terrain) {
      this.map.height.set(s.terrain.height);
      this.map.water.set(s.terrain.water);
      this.terrain.reshape([]);
    }
    this.net.deserialize(s.roads, s.roundabouts);
    this.footpaths.deserialize(s.footpaths);
    this.canals.deserialize(s.canals);
    this.terrain.clearTiles(s.cleared);
    this.terrain.loadStumps(s.stumps);
    for (const b of s.buildings) {
      const nb = this.buildings.place(b.kind, b.x, b.z, { stored: b.stored, animate: false, id: b.id });
      if (b.cropT !== undefined) nb.cropT = b.cropT;
    }
    this.pop.deserialize(s.population);
    this.eco.load(s.eco);
    this.time = s.time ?? 0;
    this.sandbox = !!s.sandbox;
    this.history.samples = s.history ?? [];
    this.cam.setState(s.cam.x, s.cam.z, s.cam.yaw, s.cam.view);
    this.pop.planDay();
    const tod = this.eco.timeOfDay;
    for (const c of this.pop.citizens.values()) if (c.leaveAt < tod) c.leaveAt = tod + Math.random() * 0.05;
  }

  private toSave(): WorldSave {
    const e = this.eco;
    this.meta = { ...this.meta, day: e.day, population: this.pop.size, money: Math.floor(e.money) };
    return {
      v: SAVE_VERSION,
      meta: this.meta,
      eco: e.state(),
      roads: this.net.serialize(),
      roundabouts: this.net.roundabouts,
      footpaths: this.footpaths.serialize(),
      canals: this.canals.serialize(),
      terrain: { height: Array.from(this.map.height), water: Array.from(this.map.water) },
      cleared: this.terrain.clearedList(),
      stumps: this.terrain.stumpList(),
      buildings: this.buildings.list.map((b) => ({
        id: b.id, kind: b.kind, x: b.x, z: b.z, cropT: b.cropT,
        stored: Math.round(b.stored + (b.kind === 'quarry' ? b.trucks * QUARRY.truckLoad * 0.5 : 0)),
      })),
      population: this.pop.serialize(),
      cam: { x: this.cam.target.x, z: this.cam.target.z, yaw: this.cam.yaw, view: this.cam.viewHalf },
      time: this.time,
      sandbox: this.sandbox,
      history: this.history.samples,
    };
  }
}

function barColor(v: number) {
  return v > 0.6 ? '#7be08f' : v > 0.3 ? '#f2b33d' : '#ff6b5e';
}

function costText(money: number, stone: number, wood: number) {
  const parts = [`$${money}`];
  if (stone) parts.push(t('{n} stone', { n: stone }));
  if (wood) parts.push(t('{n} wood', { n: wood }));
  return parts.join(' + ');
}
