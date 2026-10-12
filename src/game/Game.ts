import * as THREE from 'three';
import { DAY_SECONDS, IS_TOUCH, MAP_SIZE } from '../config';
import { N, Tile, idx, inBounds, tileToWorld } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { generateWorld } from '../world/WorldGen';
import { Terrain } from '../world/Terrain';
import { BRIDGE_COST, ROAD_COST, ROAD_TWO_LANE, ROUNDABOUT_COST, RoadNetwork, isRingMid } from '../roads/RoadNetwork';
import { RoadMesh } from '../roads/RoadMesh';
import { Footpaths } from '../paths/Footpaths';
import { Buildings, Building } from '../buildings/Buildings';
import { BUILDINGS, BuildingKind, QUARRY } from '../buildings/BuildingTypes';
import { Economy } from '../sim/Economy';
import { History } from '../sim/History';
import { Population, Citizen, displaySurname } from '../people/Population';
import { Walkers } from '../people/Walkers';
import { Traffic } from '../traffic/Traffic';
import { Animals } from '../animals/Animals';
import { Effects } from '../fx/Effects';
import { Life } from './Life';
import { CameraRig } from '../camera/CameraRig';
import { Preview } from '../build/Preview';
import { BuildTool, CheckResult, LineKind, PlaceKind, ToolHost, ToolId } from '../build/BuildTool';
import { InputController } from '../input/InputController';
import { Hud, InfoPerson } from '../ui/Hud';
import { StatsPanel, StatsSnapshot } from '../ui/StatsPanel';
import { SAVE_VERSION, SaveStore, WorldMeta, WorldSave } from '../save/SaveStore';

export interface GameOptions {
  /** Background world for the main menu: no input, no HUD, no saving. */
  demo?: boolean;
  save?: WorldSave;
  create?: { name: string; seed: number };
  thumbs?: Map<string, string>;
}

const DEMO_SEED = 424242;
const AUTOSAVE_SECONDS = 20;
const SUN_OFFSET = new THREE.Vector3(-18, 40, 14);
const SKY_DAY = new THREE.Color('#9fc3d1');
const SKY_NIGHT = new THREE.Color('#243247');
const SUN_DAY = new THREE.Color('#fff3df');
const SUN_LOW = new THREE.Color('#ffb070');

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
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
  private buildings: Buildings;
  private eco = new Economy();
  private pop = new Population();
  private walkers: Walkers;
  private history = new History();
  private traffic: Traffic;
  private animals: Animals;
  private effects = new Effects();
  private life: Life;
  private preview = new Preview(MAP_SIZE * 2);
  private grid: THREE.GridHelper;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;

  private tool?: BuildTool;
  private input?: InputController;
  private hud?: Hud;
  private stats?: StatsPanel;
  private abort = new AbortController();

  private speed = 1;
  private lastSpeed = 1;
  private menuPaused = false;
  private time = 0;
  private hudT = 0;
  private statsTick = 0;
  private saveT = 0;
  private smokeT = 0;
  private selected: Building | null = null;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions, private onMenu: () => void = () => {}) {
    this.demo = !!opts.demo;
    const seed = opts.save?.meta.seed ?? opts.create?.seed ?? DEMO_SEED;
    this.meta = opts.save?.meta ?? {
      id: SaveStore.newId(), name: opts.create?.name ?? 'Demo', seed,
      day: 1, population: 100, money: 4000, updated: Date.now(),
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
    this.buildings = new Buildings(this.map, this.net, {
      isBlocked: (k) => this.footpaths.tiles[k] === 1,
      treesNear: (x, z, r) => this.terrain.treesNear(x, z, r),
    });
    this.traffic = new Traffic(this.net);
    this.walkers = new Walkers((k) => this.net.type[k] !== 0);
    this.life = new Life({
      map: this.map, terrain: this.terrain, net: this.net, footpaths: this.footpaths, buildings: this.buildings,
      eco: this.eco, pop: this.pop, walkers: this.walkers, traffic: this.traffic, effects: this.effects,
    });
    this.grid = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, '#2d3a22', '#2d3a22');
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.12;
    this.grid.position.y = 0.005;
    this.grid.visible = false;
    this.cam = new CameraRig(canvas);

    if (opts.save) this.loadSave(opts.save);
    else this.buildStarterTown();

    this.animals = new Animals(this.map, (k) => this.map.isLand(k) && !this.net.type[k] && !this.net.isIsland(k) && this.buildings.occ[k] === -1);
    this.scene.add(
      this.terrain.group, this.roadMesh.group, this.footpaths.mesh, this.buildings.group, this.traffic.group,
      this.walkers.group, this.animals.group, this.effects.group, this.preview.mesh, this.grid,
    );
    this.networkChanged(false);
    this.pop.assign(this.buildings);
    if (!opts.save) this.pop.planDay();

    if (this.demo) {
      this.cam.viewHalf = 12;
      this.cam.apply();
      return;
    }

    this.tool = new BuildTool(this, this.preview);
    this.hud = new Hud(document.getElementById('ui')!, {
      setTool: (t) => this.setTool(t),
      undo: () => this.undo(),
      rotate: (dir) => this.cam.rotate((dir * Math.PI) / 2),
      setSpeed: (s) => this.setSpeed(s),
      openMenu: () => this.onMenu(),
      openStats: () => this.stats?.toggle(),
    }, opts.thumbs ?? new Map());
    this.stats = new StatsPanel(this.hud.root, () => this.snapshot());
    this.input = new InputController(canvas, this.cam, this.tool, {
      setTool: (t) => this.setTool(t),
      undo: () => this.undo(),
      tap: (t) => this.select(t ? this.buildings.at(idx(t.x, t.z)) ?? null : null),
      togglePause: () => this.setSpeed(this.speed === 0 ? this.lastSpeed : 0),
    }, this.abort.signal);
    this.setTool('pan');
    this.setSpeed(1);
    this.hud.setUndoEnabled(false);
    this.refreshHud();

    const signal = this.abort.signal;
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); }, { signal });
    window.addEventListener('pagehide', () => this.save(), { signal });
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
    }
    this.traffic.setParked(this.life.parkedCars());
    this.traffic.update(sdt);
    this.walkers.update(sdt);
    this.buildings.update(dt, sdt, DAY_SECONDS);
    this.effects.update(dt);
    this.updateLighting();

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
      if (manual) this.hud?.toast('Game saved');
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
    if (kind === 'path') {
      for (const t of path) {
        const k = idx(t.x, t.z);
        if (this.net.type[k]) continue; // crossing a road is fine
        if (!this.map.isLand(k)) return { ok: false, reason: 'Paths need dry, flat land' };
        if (this.buildings.occ[k] !== -1 || this.net.isIsland(k)) return { ok: false, reason: 'Something is in the way' };
      }
      return { ok: true, money: 0, stone: 0 };
    }
    let money = 0, stone = 0, bridges = 0;
    for (let i = 0; i < path.length; i++) {
      const t = path[i];
      const k = idx(t.x, t.z);
      if (this.map.height[k] > 0) return { ok: false, reason: 'Too steep — mountains' };
      if (this.buildings.occ[k] !== -1) return { ok: false, reason: 'A building is in the way' };
      if (this.net.isIsland(k)) return { ok: false, reason: "Can't drive through a roundabout island" };
      if (this.net.isRing(k)) {
        const c = this.net.ringCenter[k];
        const dx = t.x - (c % N), dz = t.z - ((c / N) | 0);
        const nb = i === 0 ? path[1] : i === path.length - 1 ? path[i - 1] : null;
        const outward = nb && nb.x === t.x + dx && nb.z === t.z + dz;
        if (!isRingMid(dx, dz) || !outward) return { ok: false, reason: 'Connect roads to the middle of a roundabout side' };
        continue;
      }
      if (!this.net.type[k]) {
        const c = this.map.water[k] ? BRIDGE_COST : ROAD_COST[2];
        money += c.money;
        stone += c.stone;
      }
      if (this.map.water[k]) bridges++;
    }
    if (this.eco.money < money) return { ok: false, reason: `Not enough money — needs $${money}`, money, stone };
    if (this.eco.stone < stone) return { ok: false, reason: `Not enough stone — needs ${stone}. Build a quarry!`, money, stone };
    return { ok: true, money, stone, bridges };
  }

  buildLine(kind: LineKind, path: Tile[]) {
    const r = this.checkLine(kind, path);
    if (!r.ok) return this.hud?.toast(r.reason!);
    if (kind === 'path') {
      this.footpaths.add(path.filter((t) => !this.net.type[idx(t.x, t.z)]));
      this.terrain.clearTiles(path.map((t) => idx(t.x, t.z)));
      this.effects.pave(path);
      this.networkChanged();
      return;
    }
    this.net.pushUndo(r.money, r.stone);
    this.eco.spend(r.money!, r.stone!);
    this.footpaths.remove(path);
    this.net.buildPath(path, ROAD_TWO_LANE);
    this.terrain.clearTiles(path.map((t) => idx(t.x, t.z)));
    this.effects.pave(path);
    this.networkChanged();
  }

  checkPlace(kind: PlaceKind, t: Tile): CheckResult {
    if (kind === 'roundabout') return this.checkRoundabout(t);
    const def = BUILDINGS[kind];
    const r = this.buildings.check(kind, t.x, t.z);
    if (!r.ok) return r;
    if (!this.eco.canAfford(def.money, def.stone)) {
      return { ok: false, reason: `Needs $${def.money}${def.stone ? ` + ${def.stone} stone` : ''}` };
    }
    return { ok: true, money: def.money, stone: def.stone };
  }

  place(kind: PlaceKind, t: Tile) {
    const r = this.checkPlace(kind, t);
    if (!r.ok) return this.hud?.toast(r.reason!);
    if (kind === 'roundabout') {
      this.net.pushUndo(ROUNDABOUT_COST.money, ROUNDABOUT_COST.stone);
      this.eco.spend(ROUNDABOUT_COST.money, ROUNDABOUT_COST.stone);
      const area = this.footprint(kind, t);
      this.footpaths.remove(area);
      this.net.addRoundabout(t.x, t.z);
      this.terrain.clearTiles(area.map((f) => idx(f.x, f.z)));
      this.effects.puff(tileToWorld(t.x), tileToWorld(t.z), 1.4, 24);
      this.effects.pave(area);
      this.networkChanged();
      this.hud?.toast('Roundabout built');
      return;
    }
    const def = BUILDINGS[kind];
    this.eco.spend(def.money, def.stone);
    const b = this.buildings.place(kind, t.x, t.z);
    this.terrain.clearTiles(this.footprint(kind, t).map((f) => idx(f.x, f.z)));
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, def.size * 0.5, 10 + def.size * 8);
    this.net.clearUndo();
    this.pop.assign(this.buildings);
    this.networkChanged();
    this.hud?.toast(`${def.name} built`);
  }

  footprint(kind: PlaceKind, t: Tile) {
    if (kind === 'roundabout') {
      const out: Tile[] = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) out.push({ x: t.x + dx, z: t.z + dz });
      return out;
    }
    return this.buildings.footprint(kind, t.x, t.z);
  }

  bulldoze(path: Tile[]) {
    const roads = path.filter((t) => this.net.hasRoad(t));
    const targets = new Set<Building>();
    let keptTownHall = false;
    for (const t of path) {
      const b = this.buildings.at(idx(t.x, t.z));
      if (!b) continue;
      if (b.kind === 'townhall') keptTownHall = true;
      else targets.add(b);
    }
    if (keptTownHall) this.hud?.toast("The Town Hall can't be removed");
    const paths = this.footpaths.remove(path);
    if (!roads.length && !targets.size && !paths) return;

    if (roads.length) {
      this.net.pushUndo();
      this.net.removePath(roads);
      for (const t of roads) this.effects.puff(tileToWorld(t.x), tileToWorld(t.z), 0.3, 3);
    }
    for (const b of targets) {
      this.eco.money += Math.floor(BUILDINGS[b.kind].money / 2);
      this.effects.puff(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.5, 18);
      this.buildings.remove(b);
      this.life.buildingRemoved(b);
      if (b === this.selected) this.select(null);
    }
    if (targets.size) this.net.clearUndo();
    this.networkChanged();
  }

  showHint(text: string | null) {
    this.hud?.setHint(text);
  }

  // ---------- internals ----------

  private checkRoundabout(t: Tile): CheckResult {
    for (const f of this.footprint('roundabout', t)) {
      if (!inBounds(f.x, f.z)) return { ok: false, reason: 'Out of the map' };
      const k = idx(f.x, f.z);
      if (!this.map.isLand(k)) return { ok: false, reason: 'Needs flat dry land (3×3)' };
      if (this.buildings.occ[k] !== -1) return { ok: false, reason: 'A building is in the way' };
      if (this.net.ringCenter[k] >= 0) return { ok: false, reason: 'Already a roundabout here' };
    }
    const c = ROUNDABOUT_COST;
    if (!this.eco.canAfford(c.money, c.stone)) return { ok: false, reason: `Needs $${c.money} + ${c.stone} stone` };
    return { ok: true, money: c.money, stone: c.stone };
  }

  private setTool(t: ToolId) {
    this.tool?.setTool(t);
    this.grid.visible = t !== 'pan';
    this.hud?.setActive(t);
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
    this.buildings.refreshAccess();
    this.traffic.networkChanged();
    this.hud?.setUndoEnabled(this.net.canUndo);
    if (dirty) this.saveT = AUTOSAVE_SECONDS - 2; // save shortly after an edit
  }

  private chimneySmoke(dt: number) {
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = 0.6;
    if (this.eco.wood <= 0) return;
    for (const b of this.buildings.ofKind('powerplant')) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = 0.45, lz = -0.55;
      this.effects.smoke(b.mesh.position.x + lx * c + lz * s, 1.4, b.mesh.position.z - lx * s + lz * c);
    }
  }

  private updateLighting() {
    const tod = this.eco.timeOfDay;
    const day = smooth(0.2, 0.3, tod) * (1 - smooth(0.74, 0.84, tod));
    const low = Math.max(0, 1 - Math.abs(tod - 0.25) * 12) + Math.max(0, 1 - Math.abs(tod - 0.79) * 12);
    this.sun.intensity = 0.35 + 1.9 * day;
    this.sun.color.copy(SUN_DAY).lerp(SUN_LOW, Math.min(1, low));
    this.hemi.intensity = 0.6 + 0.95 * day;
    (this.scene.background as THREE.Color).copy(SKY_NIGHT).lerp(SKY_DAY, day);
  }

  private followSun() {
    const t = this.cam.target;
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).add(SUN_OFFSET);
    const s = this.cam.viewHalf * Math.max(this.cam.aspect, 1) * 1.6 + 2;
    const sc = this.sun.shadow.camera;
    if (sc.right !== s) {
      sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s;
      sc.updateProjectionMatrix();
    }
  }

  private select(b: Building | null) {
    this.selected = b;
    if (!b) this.hud?.hideInfo();
    else this.refreshInfo();
  }

  private status(c: Citizen) {
    const b = c.job >= 0 ? this.buildings.get(c.job) : c.school >= 0 ? this.buildings.get(c.school) : undefined;
    let what: string;
    if (c.age < 3) what = 'Baby';
    else if (c.job >= 0) what = b ? `Works at ${BUILDINGS[b.kind].name}` : 'Worker';
    else if (c.school >= 0) what = 'Pupil at School';
    else if (c.age < 6) what = 'Small child';
    else if (c.age < 18) what = 'Child (no school place)';
    else if (c.age >= 65) what = 'Retired';
    else if (this.pop.onLeave(c)) what = 'Parental leave';
    else what = 'Looking for work';
    const where = c.state === 'home' ? 'at home' : c.state === 'travel' ? 'on the way' : 'out';
    return `${c.age} y · ${what} · ${where}`;
  }

  private personIcon(c: Citizen) {
    if (c.age < 3) return '👶';
    if (c.age < 18) return c.sex === 'm' ? '👦' : '👧';
    if (c.age >= 65) return c.sex === 'm' ? '👴' : '👵';
    return c.sex === 'm' ? '👨' : '👩';
  }

  private refreshInfo() {
    const b = this.selected;
    if (!this.hud || !b) return;
    if (b.removed) return this.select(null);
    const def = BUILDINGS[b.kind];
    const rows: [string, string][] = [];
    let people: InfoPerson[] = [];
    let title = def.name;
    const close = () => this.select(null);

    if (b.kind === 'house') {
      const f = this.pop.familyAt(b.id);
      if (!f) {
        rows.push(['Status', 'Empty — waiting for a family'], ['Road', b.access >= 0 ? 'Connected' : 'No road']);
      } else {
        title = `${f.surname} family`;
        const car = f.car ? `Yes · ${f.car.at === 'home' ? 'parked at home' : f.car.at === 'away' ? 'parked at work' : 'driving'}` : 'No — they walk';
        rows.push(
          ['Savings', `$${Math.floor(f.money).toLocaleString('en-US')}`],
          ['Earned yesterday', `${f.income >= 0 ? '+' : '−'}$${Math.abs(f.income)}`],
          ['Car', car],
          ['Food', f.hunger ? `Hungry for ${f.hunger} day(s)!` : 'Well fed'],
        );
        people = this.pop.members(f).sort((a, c) => c.age - a.age).map((c) => ({
          icon: this.personIcon(c), name: `${c.name} ${displaySurname(f.surname, c.sex)}`, detail: this.status(c),
        }));
      }
    } else {
      const staff = [...this.pop.citizens.values()].filter((c) => c.job === b.id);
      if (def.jobs) rows.push(['Workers', `${b.present} here · ${staff.length}/${def.jobs} hired`], ['Wage', `$${def.salary}/day${def.publicJob ? ' (paid by town)' : ''}`]);
      if (def.energy) rows.push(['Energy', this.eco.powered > 0.95 ? 'Powered' : `Only ${Math.round(this.eco.powered * 100)}% supplied`]);
      if (def.food) rows.push(['Food output', `up to ${def.food}/day`]);
      if (b.kind === 'farm') rows.push(['Crops', `${Math.round(b.cropT * 100)}% grown`]);
      if (b.kind === 'powerplant') rows.push(['Wood in stock', `${Math.floor(this.eco.wood)}`], ['Town demand', `${Math.round(this.eco.energyDemand)}/day`]);
      if (b.kind === 'woodcutter') rows.push(['Trees nearby', `${this.terrain.treesNear(b.x, b.z, 10)}`]);
      if (b.kind === 'school') {
        const pupils = [...this.pop.citizens.values()].filter((c) => c.school === b.id);
        rows.push(['Pupils', `${pupils.length}/${def.students}`]);
        people = pupils.slice(0, 40).map((c) => ({ icon: this.personIcon(c), name: c.name, detail: `${c.age} y · ${Math.round(c.edu * 100)}% educated` }));
      }
      if (b.kind === 'quarry') rows.push(['Stone ready', `${Math.floor(b.stored)}/${QUARRY.maxStored}`], ['Trucks', `${b.trucks}/2`]);
      if (def.slots.length) rows.push(['Parking', `${this.life.spotsUsed(b)}/${def.slots.length} used`]);
      if (def.needsRoad) rows.push(['Road', b.access >= 0 ? 'Connected' : 'No road access']);
      if (b.kind !== 'school') {
        people = staff.map((c) => {
          const f = this.pop.families.get(c.family);
          return { icon: this.personIcon(c), name: `${c.name} ${f ? displaySurname(f.surname, c.sex) : ''}`, detail: `${c.age} y · ${c.at === b.id && c.state === 'away' ? 'at work' : 'off duty'}` };
        });
      }
    }
    this.hud.showInfo(title, rows, close, people);
  }

  private refreshHud() {
    const e = this.eco;
    const counts = this.pop.counts();
    this.hud!.setStats({
      money: e.money, daily: this.life.lastBalance.net, stone: e.stone, wood: e.wood, food: e.food,
      foodDaily: this.foodBalance(), powered: e.powered,
      population: this.pop.size, workers: counts.workers, workforce: counts.workforce,
      day: e.day, timeOfDay: e.timeOfDay,
    });
    const ev = this.life.events.shift();
    if (ev) this.hud!.toast(ev);
    if (this.selected) this.refreshInfo();
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
    const t = this.buildings.totals();
    const rc = this.net.counts(this.map.water);
    const families = [...this.pop.families.values()];
    return {
      money: e.money, stone: e.stone, wood: e.wood, food: e.food, foodRate: this.foodBalance() + this.pop.size,
      energyDemand: e.energyDemand, energyCapacity: e.energyCapacity, powered: e.powered,
      population: this.pop.size, families: families.length, carsOwned: families.filter((f) => f.car).length,
      people: this.pop.counts(), jobs: t.jobs, schoolSeats: t.students, freeHomes: this.life.freeHomes().length,
      balance: this.life.lastBalance,
      buildings: this.buildings.countBy(),
      roads: { total: rc.total, bridges: rc.bridges, roundabouts: this.net.roundabouts.length, signals: this.traffic.signalCount, footpaths: this.footpaths.count() },
      traffic: { cars: this.traffic.count('car'), trucks: this.traffic.count('truck'), walkers: this.walkers.list.length, parked: this.life.parkedCars().length },
      animals: {
        cows: this.animals.list.filter((a) => a.kind === 0).length,
        sheep: this.animals.list.filter((a) => a.kind === 1).length,
        herds: new Set(this.animals.list.map((a) => `${a.kind}:${Math.round(a.herdX)}:${Math.round(a.herdZ)}`)).size,
      },
      trees: this.terrain.trees.size,
      history: this.history.samples,
    };
  }

  private buildStarterTown() {
    const c = N / 2;
    const main: Tile[] = [];
    for (let x = c - 10; x <= c + 10; x++) main.push({ x, z: c });
    const side: Tile[] = [];
    for (let z = c; z <= c + 7; z++) side.push({ x: c + 1, z });
    this.net.buildPath(main, ROAD_TWO_LANE);
    this.net.buildPath(side, ROAD_TWO_LANE);
    this.terrain.clearTiles([...main, ...side].map((t) => idx(t.x, t.z)));

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
    put('powerplant', c - 9, c - 3);
    put('farm', c - 7, c + 2);
    put('orchard', c - 4, c + 2);
    put('ranch', c + 4, c + 3);
    put('office', c + 6, c + 1);
    const path: Tile[] = [];
    for (let x = c - 9; x <= c - 1; x++) path.push({ x, z: c + 1 });
    this.footpaths.add(path.filter((t) => this.buildings.occ[idx(t.x, t.z)] === -1));

    // woodcutter at the closest forest edge
    let best: Tile | null = null, bestD = Infinity;
    for (let z = c - 26; z <= c + 26; z++) for (let x = c - 26; x <= c + 26; x++) {
      if (!inBounds(x, z) || !this.map.isLand(idx(x, z)) || this.terrain.trees.has(idx(x, z))) continue;
      const d = Math.abs(x - c) + Math.abs(z - c);
      if (d < 10 || d >= bestD || this.buildings.occ[idx(x, z)] !== -1 || this.net.type[idx(x, z)]) continue;
      if (this.terrain.treesNear(x, z, 6) >= 10) { best = { x, z }; bestD = d; }
    }
    if (best) put('woodcutter', best.x, best.z);

    // ~100 residents in 12 families
    const sizes = houses.map(() => 6 + Math.floor(Math.random() * 5));
    let sum = sizes.reduce((a, b) => a + b, 0);
    while (sum > 100) { const i = Math.floor(Math.random() * sizes.length); if (sizes[i] > 4) { sizes[i]--; sum--; } }
    while (sum < 100) { const i = Math.floor(Math.random() * sizes.length); if (sizes[i] < 10) { sizes[i]++; sum++; } }
    houses.forEach((h, i) => this.pop.createFamily(h.id, { size: sizes[i], carChance: 0.45 }));
    this.net.clearUndo();
    this.cam.setState(-1, 0, Math.PI / 4, 10);
  }

  private loadSave(s: WorldSave) {
    this.net.deserialize(s.roads, s.roundabouts);
    this.footpaths.deserialize(s.footpaths);
    this.terrain.clearTiles(s.cleared);
    this.terrain.loadStumps(s.stumps);
    for (const b of s.buildings) {
      const nb = this.buildings.place(b.kind, b.x, b.z, { stored: b.stored, animate: false, id: b.id });
      if (b.cropT !== undefined) nb.cropT = b.cropT;
    }
    this.pop.deserialize(s.population);
    this.eco.load(s.eco);
    this.time = s.time ?? 0;
    this.history.samples = s.history ?? [];
    this.cam.setState(s.cam.x, s.cam.z, s.cam.yaw, s.cam.view);
    this.pop.planDay();
    // don't send everyone out at once when loading mid-day
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
      cleared: this.terrain.clearedList(),
      stumps: this.terrain.stumpList(),
      buildings: this.buildings.list.map((b) => ({
        id: b.id, kind: b.kind, x: b.x, z: b.z, cropT: b.cropT,
        stored: Math.round(b.stored + (b.kind === 'quarry' ? b.trucks * QUARRY.truckLoad * 0.5 : 0)),
      })),
      population: this.pop.serialize(),
      cam: { x: this.cam.target.x, z: this.cam.target.z, yaw: this.cam.yaw, view: this.cam.viewHalf },
      time: this.time,
      history: this.history.samples,
    };
  }
}
