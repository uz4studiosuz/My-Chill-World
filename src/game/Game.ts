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
import { BUILDINGS, BUSINESS_KINDS, CARS, JOB_PRIORITY, LAMP, RAIL_COST, RENT, MAX_GRAVES_PER_CEMETERY as GRAVES_PER_PLOT, BuildingKind, CEMETERY_UPGRADE, CITY_MIN_DISTANCE, LOAN, MERCHANT, GRAVE_COST, MAX_GRAVES_PER_CEMETERY, QUARRY, TOURISM, FOOTBALL, CINEMA, DECOR, DECOR_RANGE } from '../buildings/BuildingTypes';
import { City, Economy, NEW_CITY_GRANT, START_GRANT } from '../sim/Economy';
import { History } from '../sim/History';
import { monthOf, seasonBlend, seasonOf, yearOf, growingSeason } from '../sim/Calendar';
import { Population, Citizen } from '../people/Population';
import { townName } from '../people/names';
import { sound } from '../audio/Sound';
import { GoalContext, Goals } from '../sim/Goals';
import { GoalsPanel } from '../ui/GoalsPanel';
import { Tutorial, TutorialContext } from '../ui/Tutorial';
import { EventLog, LogEntry } from '../ui/EventLog';
import { Guide } from '../ui/Guide';
import { StreetLights } from '../roads/StreetLights';
import { Railway, Station } from '../rail/Railway';
import { Newspaper } from '../ui/Newspaper';
import { Walkers } from '../people/Walkers';
import { Traffic, Vehicle } from '../traffic/Traffic';
import { Animals } from '../animals/Animals';
import { Effects } from '../fx/Effects';
import { Weather } from '../fx/Weather';
import { Life, PROMISE_TEXT } from './Life';
import { nightLevel } from '../fx/NightGlow';
import { PetitionsPanel } from '../ui/Petitions';
import { CameraRig } from '../camera/CameraRig';
import { Preview } from '../build/Preview';
import { BuildTool, CheckResult, LineKind, PlaceKind, ToolHost, ToolId } from '../build/BuildTool';
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
  create?: { name: string; seed: number; calm?: boolean };
  thumbs?: Map<string, string>;
}

type Selection = { type: 'building'; id: number } | { type: 'person'; id: number } | { type: 'vehicle'; id: number } | null;

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
const MOON = new THREE.Color('#8fa8e8');
const HEMI_DAY = new THREE.Color('#e4f1ff');
const HEMI_NIGHT = new THREE.Color('#6d80b8');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
const KIND_BADGE: Record<BuildingKind, [string, string]> = {
  townhall: ['🏛️', '#3567c4'], house: ['🏠', '#c4553d'], office: ['🏢', '#4a7fb5'], school: ['🏫', '#d9714a'],
  parking: ['🅿️', '#2f6fd6'], weddinghall: ['💒', '#d97a9a'], watertower: ['💧', '#4a8fbd'], quarry: ['⛏️', '#8d8a83'],
  woodcutter: ['🪓', '#8a5a35'], powerplant: ['⚡', '#a65e43'], farm: ['🌾', '#b8952f'], orchard: ['🍎', '#4f8a3a'], ranch: ['🐄', '#7a5a3c'],
  cemetery: ['🪦', '#4a4f57'], police: ['🚓', '#2d4f8a'], kindergarten: ['🧸', '#e8738f'], hotel: ['🏨', '#7d4a3a'], windturbine: ['🌬️', '#6fb6ff'], solarfarm: ['☀️', '#25406e'], trainstation: ['🚉', '#c98a5a'], apartment: ['🏢', '#8a6f5a'], cemeteryext: ['🪦', '#4a4f57'], ironmine: ['⚒️', '#7a5a4a'], fishery: ['🎣', '#3a7fb5'], firestation: ['🚒', '#c4553d'], busdepot: ['🚌', '#d9a92a'], busstop: ['🚏', '#3a6fd1'], grocery: ['🥖', '#4c9a52'], clothes: ['👕', '#b0478f'], park: ['🌳', '#4f8a3a'], hospital: ['🏥', '#d9443b'], university: ['🎓', '#7d4a3a'],
  market: ['🛒', '#c98a3a'], carmarket: ['🚗', '#3a6fd1'], bank: ['🏦', '#b8952f'], gasstation: ['⛽', '#d9443b'],
  factory: ['🏭', '#6f7880'], carfactory: ['🚘', '#4a7fb5'], construction: ['🏗️', '#e8a33a'],
  stadium: ['⚽', '#4f9a3e'], cinema: ['🎬', '#b0478f'], academy: ['🏛️', '#2d4f8a'], playground: ['🛝', '#e85a3a'], fountain: ['⛲', '#4fa3d1'],
  flowerbed: ['🌷', '#e85a7a'], statue: ['🗿', '#9a7b4f'], bench: ['🪑', '#8a5a35'], lamppost: ['💡', '#d9a92a'], sapling: ['🌳', '#4f8a3a'], roadsign: ['🚸', '#3a6fd1'],
};

const PROFESSIONS: Partial<Record<BuildingKind, [string, string?]>> = {
  townhall: ['Civil servant'], office: ['Clerk', 'Manager'], school: ['School staff', 'Teacher'], university: ['University staff', 'Professor'],
  hospital: ['Nurse', 'Doctor'], market: ['Seller'], carmarket: ['Car salesman'], bank: ['Cashier', 'Banker'], gasstation: ['Pump attendant'],
  factory: ['Factory worker', 'Engineer'], carfactory: ['Auto assembler', 'Engineer'], construction: ['Builder', 'Site foreman'],
  farm: ['Farmer'], orchard: ['Fruit grower'], ranch: ['Herdsman'], woodcutter: ['Lumberjack'],
  powerplant: ['Power operator', 'Power engineer'], watertower: ['Water technician'], weddinghall: ['Registrar'], park: ['Gardener'],
  police: ['Police officer', 'Police chief'], kindergarten: ['Nanny', 'Teacher'], hotel: ['Hotel clerk', 'Hotel manager'], windturbine: ['Technician', 'Power engineer'], solarfarm: ['Technician', 'Power engineer'], trainstation: ['Railway worker', 'Station master'], ironmine: ['Miner', 'Mining engineer'], fishery: ['Fisherman'], quarry: ['Quarryman'], firestation: ['Firefighter'], busdepot: ['Bus driver'], stadium: ['Groundskeeper', 'Football coach'], cinema: ['Projectionist'], academy: ['Coach', 'Academician'], grocery: ['Shop assistant'], clothes: ['Shop assistant', 'Tailor'], cemetery: ['Gravedigger'], parking: ['Parking attendant'],
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
  private goals = new Goals();
  private goalsPanel?: GoalsPanel;
  private eventLog?: EventLog;
  private petitions?: PetitionsPanel;
  private petitionTick = 0;
  /** First-person view: whose eyes we look through. */
  private pov: Selection = null;
  readonly povCam = new THREE.PerspectiveCamera(72, 1, 0.01, 90);
  private povBar?: HTMLDivElement;
  private povLook = { yaw: 0, pitch: -0.05 };
  private povSaved?: { view: number };
  private povPos = new THREE.Vector3(NaN, 0, 0);
  private povDir = new THREE.Vector3(0, 0, 1);
  private guide?: Guide;
  private savedLog: LogEntry[] = [];
  private lights: StreetLights;
  private railway = new Railway();
  private news?: Newspaper;
  private calm = false;
  private festT = 0;
  private yesterday = { pop: 0, money: 0 };
  private ambT = 0;
  private nightness = 0;
  private tutorial?: Tutorial;
  private wantTutorial = false;
  private tradeTarget = 0;
  /** Building being moved to a new place. */
  private moving: Building | null = null;
  private confirmDemolish = -1;
  private ring: THREE.Mesh;
  private beam: THREE.Mesh;
  private beamT = 0;

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
      isBlocked: (k) => this.footpaths.tiles[k] === 1 || this.canals.tiles[k] === 1 || this.railway.tiles[k] === 1,
      treesNear: (x, z, r) => this.terrain.treesNear(x, z, r),
    });
    this.traffic = new Traffic(this.net);
    this.lights = new StreetLights(this.net);
    this.life = new Life({
      map: this.map, terrain: this.terrain, net: this.net, footpaths: this.footpaths, canals: this.canals,
      buildings: this.buildings, eco: this.eco, pop: this.pop, walkers: this.walkers, traffic: this.traffic,
      effects: this.effects, weather: this.weather, burnDown: (b) => this.destroyBuilding(b, false),
      isLit: (k) => this.lights.lit[k] === 1,
    });
    this.grid = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, '#2d3a22', '#2d3a22');
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.12;
    this.grid.position.y = 0.005;
    this.grid.visible = false;
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd166' }));
    this.marker.visible = false;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.74, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.ring.position.y = 0.08;
    this.ring.renderOrder = 11;
    this.ring.visible = false;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 3.2, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.beam.visible = false;
    this.footpaths.attach = (k) => this.buildings.occ[k] !== -1 || this.net.type[k] !== 0;
    this.canals.attach = (k) => this.buildings.at(k)?.kind === 'farm';
    this.buildings.onBuilt = (b) => {
      this.effects.puff(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.6, 16, ['#f2e6c4', '#ffffff', '#c9b88a']);
      this.pop.assign(this.buildings);
      this.life.rebuildGrid();
      this.footpaths.rebuild((k) => this.net.type[k] !== 0);
      this.life.events.push(t('{name} is finished', { name: t(BUILDINGS[b.kind].name) }));
      sound.play('complete');
    };
    this.cam = new CameraRig(canvas);

    this.pop.priority = (b) => {
      const o = this.eco.cities.get(b.city)?.jobPriority[b.kind];
      return o === 'high' ? 0 : o === 'low' ? 7 : JOB_PRIORITY[b.kind] ?? 5;
    };
    this.railway.onArrive = (from, to) => this.trainArrived(from, to);
    this.calm = !!(opts.save?.calm ?? opts.create?.calm);
    this.life.calm = this.calm;
    if (opts.save) this.loadSave(opts.save);
    else this.buildStarterTown();
    this.wantTutorial = !!opts.create && Tutorial.wanted();

    this.animals = new Animals(this.map, (k) => this.map.isLand(k) && !this.net.type[k] && !this.net.isIsland(k) && this.buildings.occ[k] === -1);
    this.scene.add(
      this.terrain.group, this.roadMesh.group, this.footpaths.mesh, this.canals.mesh, this.buildings.group, this.traffic.group,
      this.walkers.group, this.lights.group, this.railway.group, this.animals.group, this.effects.group, this.weather.group, this.preview.mesh, this.grid, this.marker, this.ring, this.beam,
      this.life.leisure.group, this.povCam,
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
      look: (dx, dy) => { if (!this.pov) return false; this.povTurn(dx, dy); return true; },
    }, this.abort.signal);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.pov) this.exitPov(); }, { signal: this.abort.signal });

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
      openStats: () => { this.goalsPanel?.hide(); this.eventLog?.hide(); this.stats?.toggle(); },
      openGoals: () => { this.stats?.hide(); this.eventLog?.hide(); this.goalsPanel?.toggle(); },
      openLog: () => { this.stats?.hide(); this.goalsPanel?.hide(); this.eventLog?.toggle(); },
      openGuide: () => this.guide?.toggle(),
      openPetitions: () => { this.stats?.hide(); this.goalsPanel?.hide(); this.eventLog?.hide(); this.petitions?.toggle(); },
      toggleSound: () => { const on = !sound.sfxOn; sound.setSfx(on); sound.setNature(on); return on; },
      cycleCity: () => this.cycleCity(),
      confirmBuild: () => this.tool?.confirm(),
      cancelBuild: () => this.tool?.cancel(),
    }, this.thumbs);
    this.inspector = new Inspector(this.hud.root, () => this.select(null), (id) => this.select({ type: 'person', id }));
    this.stats = new StatsPanel(this.hud.root, () => this.snapshot(), (kind, prio) => {
      const city = this.eco.city;
      if (prio === 'normal') delete city.jobPriority[kind];
      else city.jobPriority[kind] = prio;
      this.pop.assign(this.buildings);
      this.stats?.render();
    });
    this.goalsPanel = new GoalsPanel(this.hud.root, this.goals, () => this.goalContext());
    const keep = this.eventLog?.entries.slice() ?? this.savedLog;
    this.eventLog = new EventLog(this.hud.root, (d) => `${t('Day {n}', { n: d })} · ${t(MONTHS[monthOf(d)]).slice(0, 3)} · ${t('Year {n}', { n: yearOf(d) })}`);
    this.eventLog.load(keep);
    this.guide = new Guide(this.hud.root);
    this.petitions = new PetitionsPanel(this.hud.root, () => ({
      petitions: this.life.leisure.petitions, city: this.eco.active, day: this.eco.day,
      cityName: (id) => this.eco.cities.get(id)?.name ?? '',
    }), (p) => {
      this.petitions?.hide();
      this.cam.setState(tileToWorld(p.x), tileToWorld(p.z), this.cam.yaw, Math.min(this.cam.viewHalf, 9));
      const b = this.buildings.at(idx(p.x, p.z));
      if (b) this.select({ type: 'building', id: b.id });
    });
    this.povBar = undefined;
    this.news?.dispose();
    this.news = new Newspaper(this.hud.root);
    if (this.wantTutorial && !this.tutorial?.finished) {
      this.tutorial = new Tutorial(this.hud.root, this.tutorialContext(), () => sound.play('complete'));
    }
    this.setTool(this.tool?.tool ?? 'pan');
    this.setSpeed(this.speed);
    this.hud.setUndoEnabled(this.net.canUndo);
    this.refreshHud();
  }

  // ---------- lifecycle ----------

  resize(w: number, h: number) {
    this.cam.resize(w, h);
    this.povCam.aspect = w / Math.max(1, h);
    this.povCam.updateProjectionMatrix();
  }

  /** The camera to render with (first-person view or the normal map view). */
  get viewCamera(): THREE.Camera { return this.pov ? this.povCam : this.cam.camera; }

  get inPov() { return !!this.pov; }

  /** Turn the head in first-person view (drag on the screen). */
  povTurn(dx: number, dy: number) {
    this.povLook.yaw -= dx * 0.005;
    this.povLook.pitch = Math.max(-0.9, Math.min(0.6, this.povLook.pitch - dy * 0.004));
  }

  /** Look through the eyes of a citizen or a driver. */
  enterPov(s: Selection) {
    if (!s || s.type === 'building') return;
    this.pov = s;
    this.povLook = { yaw: 0, pitch: -0.05 };
    this.povSaved ??= { view: this.cam.viewHalf };
    this.cam.viewHalf = 7;
    this.following = false;
    this.selection = null;
    this.inspector?.hide();
    this.setTool('pan');
    document.body.classList.add('pov-mode');
    if (!this.povBar && this.hud) {
      const bar = document.createElement('div');
      bar.className = 'pov-bar';
      const label = document.createElement('span');
      const exit = document.createElement('button');
      exit.className = 'btn-mini';
      exit.textContent = t('Exit citizen view');
      exit.addEventListener('click', () => this.exitPov());
      bar.append(label, exit);
      this.hud.root.appendChild(bar);
      this.povBar = bar;
    }
    this.povPos.set(NaN, 0, 0);
  }

  exitPov() {
    if (!this.pov) return;
    const s = this.pov;
    this.pov = null;
    document.body.classList.remove('pov-mode');
    this.povBar?.remove();
    this.povBar = undefined;
    if (this.povSaved) { this.cam.viewHalf = this.povSaved.view; this.povSaved = undefined; }
    this.cam.apply();
    if (s.type === 'vehicle' ? this.traffic.getVehicle(s.id) : s.type === 'person' && this.pop.citizens.get(s.id)) this.select(s);
  }

  /** Place the first-person camera at the eyes of the person / driver we follow. */
  private updatePov(dt: number) {
    const s = this.pov!;
    let x = 0, z = 0, y = 0.16, hx = 0, hz = 1, label = '';
    if (s.type === 'vehicle') {
      const v = this.traffic.getVehicle(s.id);
      if (!v || v.leaving) return this.exitPov();
      x = v.x - v.hx * 0.02; z = v.z - v.hz * 0.02; hx = v.hx; hz = v.hz;
      y = v.trip.kind === 'bus' ? 0.2 : v.trip.kind === 'truck' ? 0.22 : 0.15;
      label = `${t(v.trip.driverName ?? 'Driver')} · ${t(v.trip.purpose ?? 'Driving')}`;
    } else if (s.type === 'person') {
      const c = this.pop.citizens.get(s.id);
      if (!c) return this.exitPov();
      label = `${c.name} · ${t(c.activity)}`;
      const v = this.traffic.vehicleForDriver(c.id) ?? this.traffic.vehicleForPassenger(c.id);
      if (v && !v.leaving) {
        x = v.x; z = v.z; hx = v.hx; hz = v.hz; y = v.trip.kind === 'bus' ? 0.2 : 0.15;
      } else if (c.walker && !c.walker.leaving) {
        const w = c.walker;
        const sc = w.scale;
        x = w.x + w.hx * 0.025 * sc; z = w.z + w.hz * 0.025 * sc; hx = w.hx; hz = w.hz; y = 0.165 * sc + 0.005;
      } else {
        // indoors: stand at the door and look out to the street
        const b = this.buildings.get(c.at);
        if (!b) return this.exitPov();
        const d = this.buildings.door(b);
        const dx = d.x - b.mesh.position.x, dz = d.z - b.mesh.position.z, l = Math.hypot(dx, dz) || 1;
        hx = dx / l; hz = dz / l; x = d.x + hx * 0.05; z = d.z + hz * 0.05;
      }
    } else return this.exitPov();
    if (Number.isNaN(this.povPos.x)) { this.povPos.set(x, y, z); this.povDir.set(hx, 0, hz); }
    this.povPos.lerp(this.povTmp.set(x, y, z), Math.min(1, dt * 8));
    this.povDir.lerp(this.povTmp.set(hx, 0, hz), Math.min(1, dt * 4)).normalize();
    const yaw = Math.atan2(this.povDir.x, this.povDir.z) + this.povLook.yaw;
    const cp = Math.cos(this.povLook.pitch);
    this.povCam.position.copy(this.povPos);
    this.povCam.lookAt(this.povPos.x + Math.sin(yaw) * cp, this.povPos.y + Math.sin(this.povLook.pitch), this.povPos.z + Math.cos(yaw) * cp);
    this.povCam.updateMatrixWorld();
    // keep the sun's shadows, lamps and the ambience around us
    this.cam.target.set(this.povPos.x, 0, this.povPos.z);
    this.cam.apply();
    const span = this.povBar?.firstChild as HTMLSpanElement | null;
    if (span && span.textContent !== label) span.textContent = label;
  }

  private povTmp = new THREE.Vector3();

  update(dt: number) {
    // fast speeds are split into small steps so cars, walkers and the economy stay stable
    const total = this.menuPaused ? 0 : dt * this.speed;
    const steps = total > 0 ? Math.min(60, Math.ceil(total / 0.2)) : 1;
    const sdt = total / steps;
    this.traffic.setParked(this.life.parkedCars());
    for (let i = 0; i < steps; i++) {
      if (sdt > 0) {
        this.time += sdt;
        this.life.update(sdt);
        this.animals.update(sdt);
        this.history.update(sdt, () => ({
          t: this.time, day: this.eco.day, pop: this.pop.size, employed: this.pop.counts().workers,
          money: Math.round(this.eco.totalMoney), stone: Math.round(this.eco.totalStone), food: Math.round(this.eco.totalFood),
          wood: Math.round(this.eco.totalWood), energy: Math.round(this.eco.powered * 100),
          cars: this.traffic.count('car'), trucks: this.traffic.count('truck'), walkers: this.walkers.list.length,
          animals: this.animals.list.length, happy: Math.round(this.eco.city.happiness), iron: Math.round([...this.eco.cities.values()].reduce((a, c) => a + c.iron, 0)),
        }));
        this.chimneySmoke(sdt);
        if (this.eco.day !== this.lastDay) this.onNewDay();
      }
      this.traffic.update(sdt);
      this.walkers.update(sdt);
      this.railway.update(sdt);
      this.buildings.update(i === 0 ? dt : 0, sdt, DAY_SECONDS, growingSeason(monthOf(this.eco.day)), (b) => this.life.buildSpeed(b));
    }
    this.festivities(dt);
    this.effects.update(dt);
    this.weather.update(dt, total, this.eco.timeOfDay, this.cam.target, this.cam.viewHalf);
    this.seasonT -= dt;
    if (this.seasonT <= 0) {
      this.seasonT = 0.4;
      this.terrain.applySeason(seasonBlend(this.eco.day, this.eco.timeOfDay));
    }
    this.updateLighting();
    this.updateMarker(dt);
    this.ambT -= dt;
    if (this.ambT <= 0 && !this.demo) { this.ambT = 0.5; this.updateAmbience(); }

    if (this.demo) this.cam.rotate(dt * 0.04, false);
    this.input?.update(dt);
    this.cam.update(dt);
    if (this.pov) this.updatePov(dt);
    this.lights.update(dt, this.cam.target.x, this.cam.target.z);
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
    if (kind === 'rail') {
      let fresh = 0;
      for (const tl of path) {
        const k = idx(tl.x, tl.z);
        if (this.map.height[k] > 0) return { ok: false, reason: t('Too steep — mountains') };
        if (this.buildings.occ[k] !== -1 || this.net.isIsland(k)) return { ok: false, reason: t('Something is in the way') };
        if (!this.railway.tiles[k]) fresh++;
      }
      const money = fresh * RAIL_COST.money, iron = fresh * RAIL_COST.iron;
      if (!this.eco.canAfford(money, 0, 0, iron)) return { ok: false, reason: t('Needs {cost}', { cost: costText(money, 0, 0, iron) }) };
      return { ok: true, money, iron };
    }
    if (kind === 'path' || kind === 'canal') {
      const canal = kind === 'canal';
      for (const tl of path) {
        const k = idx(tl.x, tl.z);
        if (this.net.type[k]) continue; // passes under/over roads
        if (canal && this.buildings.at(k)?.kind === 'farm') continue; // canals end at the field
        if (!this.map.isLand(k)) return canal && this.map.water[k] ? { ok: false, reason: t('Start the canal next to the water, not on it') } : { ok: false, reason: t('Needs dry, flat land') };
        if (this.buildings.occ[k] !== -1 || this.net.isIsland(k)) return { ok: false, reason: t('Something is in the way') };
      }
      if (!canal) return { ok: true, money: 0, stone: 0 };
      const money = path.filter((tl) => !this.canals.tiles[idx(tl.x, tl.z)] && this.buildings.occ[idx(tl.x, tl.z)] === -1).length * CANAL_COST;
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
      if (kind === 'litroad' && !this.lights.lit[k]) money += LAMP.price;
      if (this.map.water[k]) bridges++;
    }
    if (this.eco.money < money) return { ok: false, reason: t('Not enough money — needs ${n}', { n: money }), money, stone };
    if (this.eco.stone < stone) return { ok: false, reason: t('Not enough stone — needs {n}. Build a quarry!', { n: stone }), money, stone };
    return { ok: true, money, stone, bridges };
  }

  buildLine(kind: LineKind, path: Tile[]) {
    const r = this.checkLine(kind, path);
    if (!r.ok) { sound.play('error'); return this.hud?.toast(r.reason!); }
    sound.play('build');
    const free = path.filter((tl) => !this.net.type[idx(tl.x, tl.z)]);
    if (kind === 'rail') {
      this.eco.spend(r.money ?? 0, 0, 0, r.iron ?? 0);
      this.railway.add(path);
      this.footpaths.remove(free);
      this.canals.remove(free);
      this.terrain.clearTiles(path.map((tl) => idx(tl.x, tl.z)));
      this.effects.pave(path);
      this.networkChanged();
      return;
    }
    if (kind === 'path' || kind === 'canal') {
      this.eco.spend(r.money ?? 0, 0);
      if (kind === 'path') { this.canals.remove(free); this.footpaths.add(free); }
      else { this.footpaths.remove(free); this.canals.add(path.filter((tl) => this.map.isLand(idx(tl.x, tl.z)) && this.buildings.occ[idx(tl.x, tl.z)] === -1)); }
      this.terrain.clearTiles(free.map((tl) => idx(tl.x, tl.z)));
      this.effects.pave(path);
      this.networkChanged();
      return;
    }
    this.net.pushUndo(r.money, r.stone);
    this.eco.spend(r.money!, r.stone!);
    this.footpaths.remove(path);
    this.net.buildPath(path, ROAD_TWO_LANE);
    this.lights.setLit(path.filter((tl) => this.net.type[idx(tl.x, tl.z)]).map((tl) => idx(tl.x, tl.z)), kind === 'litroad');
    this.terrain.clearTiles(path.map((tl) => idx(tl.x, tl.z)));
    this.effects.pave(path);
    this.networkChanged();
  }

  checkPlace(kind: PlaceKind, tl: Tile): CheckResult {
    if (kind === 'roundabout') return this.checkRoundabout(tl);
    const def = BUILDINGS[kind];
    const mv = this.moving && this.moving.kind === kind ? this.moving : null;
    if (mv) {
      const r = this.buildings.withoutOcc(mv, () => this.buildings.check(kind, tl.x, tl.z));
      if (!r.ok) return { ok: false, reason: t(r.reason!) };
      const price = Math.round(def.money * 0.25);
      if (this.cityOf(mv).money < price) return { ok: false, reason: t('Not enough money — needs ${n}', { n: price }) };
      return { ok: true, money: price };
    }
    const r = this.buildings.check(kind, tl.x, tl.z);
    if (!r.ok) return { ok: false, reason: t(r.reason!) };
    if (kind === 'townhall' && this.buildings.halls().some((h) => Math.max(Math.abs(h.x - tl.x), Math.abs(h.z - tl.z)) < CITY_MIN_DISTANCE)) {
      return { ok: false, reason: t('Too close to another Town Hall') };
    }
    if (!this.eco.canAfford(def.money, def.stone, def.wood, def.iron)) {
      return { ok: false, reason: t('Needs {cost}', { cost: costText(def.money, def.stone, def.wood, def.iron) }) };
    }
    return { ok: true, money: def.money, stone: def.stone, wood: def.wood, iron: def.iron };
  }

  place(kind: PlaceKind, tl: Tile) {
    const r = this.checkPlace(kind, tl);
    if (!r.ok) { sound.play('error'); return this.hud?.toast(r.reason!); }
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
    if (this.moving && this.moving.kind === kind) {
      const b = this.moving;
      this.moving = null;
      this.cityOf(b).money -= r.money ?? 0;
      this.buildings.move(b, tl.x, tl.z);
      this.terrain.clearTiles(this.footprint(kind, tl).map((f) => idx(f.x, f.z)));
      this.effects.puff(b.mesh.position.x, b.mesh.position.z, def.size * 0.5, 14);
      sound.play('place');
      this.pop.assign(this.buildings);
      this.networkChanged();
      this.setTool('pan');
      this.select({ type: 'building', id: b.id });
      this.hud?.toast(t('{name} moved', { name: t(def.name) }));
      return;
    }
    this.eco.spend(def.money, def.stone, def.wood, def.iron);
    // a Town Hall founds a new city; everything else belongs to the city being built for
    let owner = this.eco.active;
    let founded: City | null = null;
    if (kind === 'townhall') {
      founded = this.eco.found(townName(), NEW_CITY_GRANT);
      owner = founded.id;
    }
    const b = this.buildings.place(kind, tl.x, tl.z, { city: owner });
    this.terrain.clearTiles(this.footprint(kind, tl).map((f) => idx(f.x, f.z)));
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, def.size * 0.5, 10 + def.size * 8);
    this.net.clearUndo();
    this.pop.assign(this.buildings);
    this.networkChanged();
    sound.play('place');
    if (founded) {
      this.eco.active = founded.id;
      this.select({ type: 'building', id: b.id });
      this.hud?.toast(t('{name} founded!', { name: founded.name }));
    } else {
      this.hud?.toast(t('{name} built', { name: t(def.name) }));
    }
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
      else if (b.kind === 'cemeteryext') continue;
      else targets.add(b);
    }
    if (keptTownHall) this.hud?.toast(t("The Town Hall can't be removed"));
    const paths = this.footpaths.remove(path) + this.canals.remove(path) + this.railway.remove(path);
    if (!roads.length && !targets.size && !paths) return;
    sound.play('demolish');
    if (roads.length) {
      this.net.pushUndo();
      this.net.removePath(roads);
      for (const tl of roads) this.effects.puff(tileToWorld(tl.x), tileToWorld(tl.z), 0.3, 3);
    }
    for (const b of targets) this.destroyBuilding(b, true);
    if (targets.size) this.net.clearUndo();
    this.networkChanged();
  }

  showHint(text: string | null) {
    this.hud?.setHint(text);
  }

  pending(info: { text: string; ok: boolean } | null) {
    this.hud?.setPending(info);
  }



  // ---------- internals ----------

  private destroyBuilding(b: Building, refund: boolean) {
    if (b.removed) return;
    for (const id of b.ext ?? []) { const e = this.buildings.get(id); if (e) { this.buildings.remove(e); } }
    const own = this.eco.cities.get(b.city);
    if (refund && own) own.money += Math.floor(BUILDINGS[b.kind].money / 2);
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
    if (this.moving && tl !== this.moving.kind) this.moving = null;
    this.tool?.setTool(tl);
    this.grid.visible = tl !== 'pan';
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
    this.lights.rebuild();
    // every lamp draws power from the city whose Town Hall is closest
    const halls = this.buildings.halls();
    const perCity = new Map<number, number>();
    for (const k of this.lights.lamps) {
      const x = k % N, z = (k / N) | 0;
      let best: Building | undefined, bd = Infinity;
      for (const h of halls) { const d = Math.abs(h.x - x) + Math.abs(h.z - z); if (d < bd) { bd = d; best = h; } }
      if (best) perCity.set(best.city, (perCity.get(best.city) ?? 0) + LAMP.energy);
    }
    this.life.lampDemand = [...perCity];
    this.railway.rebuild(this.stations());
    for (const c of this.eco.cities.values()) c.railLink = false;
    for (const [a, b] of this.railway.lines) {
      if (a.city === b.city) continue;
      const ca = this.eco.cities.get(a.city), cb = this.eco.cities.get(b.city);
      if (ca) ca.railLink = true;
      if (cb) cb.railLink = true;
    }
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
    this.goals.newDay([...this.eco.cities.values()].some((c) => c.money < 0));
    this.morningPaper();
    if (this.sandbox || this.calm) return;
    for (const city of this.eco.cities.values()) {
      city.brokeDays = city.money < 0 ? city.brokeDays + 1 : 0;
      if (city.brokeDays === 3) this.hud?.toast(`${city.name}: ${t('The town treasury is empty! Raise income or cut costs.')}`);
      if (city.brokeDays >= BANKRUPT_DAYS && this.hud) {
        this.setSpeed(0);
        this.hud.showModal(`${t('Bankrupt!')} — ${city.name}`, t('The town has been in debt for {n} months. The bank refuses to lend any more money.', { n: city.brokeDays }), [
          { label: t('Keep playing (sandbox)'), primary: true, onClick: () => { this.sandbox = true; city.money = 0; this.setSpeed(1); } },
          { label: t('Main Menu'), onClick: () => this.onMenu() },
        ]);
        break;
      }
    }
  }

  private chimneySmoke(dt: number) {
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = 0.6;
    for (const b of this.buildings.list) {
      if ((b.kind === 'factory' || b.kind === 'carfactory') && b.workers > 0 && b.built >= 1) {
        this.effects.smoke(b.mesh.position.x + 0.6, 1.8, b.mesh.position.z - 0.5);
        continue;
      }
      if (b.kind !== 'powerplant') continue;
      if (!b.workers || (this.eco.cities.get(b.city)?.wood ?? 0) <= 0) continue;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = 0.45, lz = -0.55;
      this.effects.smoke(b.mesh.position.x + lx * c + lz * s, 1.4, b.mesh.position.z - lx * s + lz * c);
    }
  }

  private updateLighting() {
    const tod = this.eco.timeOfDay;
    const season = seasonBlend(this.eco.day, tod);
    const day = smooth(0.22, 0.3, tod) * (1 - smooth(0.74, 0.84, tod));
    this.nightness = 1 - day;
    const dark = Math.max(0, (0.85 - day) / 0.85);
    nightLevel.value = dark;
    this.traffic.setNight(dark);
    this.lights.setNight(dark, this.life.lampsLit);
    const low = Math.max(0, 1 - Math.abs(tod - 0.26) * 12) + Math.max(0, 1 - Math.abs(tod - 0.79) * 12);
    const rain = this.weather.rainingAt(this.cam.target.x, this.cam.target.z) ? 0.35 : 0;
    const winter = season.snow * 0.15;
    // nights are dark and bluish (moonlight) so windows, lamps and headlights stand out
    this.sun.intensity = (0.16 + 2.09 * day) * (1 - rain - winter) + this.weather.flash * 4;
    this.sun.color.copy(SUN_DAY).lerp(SUN_LOW, Math.min(1, low)).lerp(MOON, 1 - day);
    this.hemi.intensity = (0.32 + 1.23 * day) * (1 - rain * 0.5) + this.weather.flash * 2;
    this.hemi.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, 1 - day);
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
    if (this.pov) return;
    if (p) {
      const veh = this.traffic.vehicleNear(p.x, p.z, 0.55);
      if (veh) return this.select({ type: 'vehicle', id: veh.id });

      const parked = this.traffic.parkedNear(p.x, p.z, 0.45);
      if (parked) {
        const famId = this.life.familyForParked(parked.x, parked.z);
        if (famId) {
          const fam = this.pop.families.get(famId);
          const members = fam ? this.pop.members(fam) : [];
          const adult = members.find((m) => m.age >= 18);
          if (adult) return this.select({ type: 'person', id: adult.id });
        }
      }

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
    if (b?.kind === 'townhall') {
      this.eco.active = b.city;
      this.refreshHud();
    }
    this.select(b ? { type: 'building', id: b.id } : null);
  }

  private select(s: Selection) {
    if (s?.type !== this.selection?.type || s?.id !== this.selection?.id) this.following = false;
    this.selection = s;
    if (!s) this.inspector?.hide();
    else this.refreshInspector();
  }

  private personPos(c: Citizen) {
    const v = this.traffic.vehicleForDriver(c.id) ?? this.traffic.vehicleForPassenger(c.id);
    if (v && !v.leaving) return { x: v.x, z: v.z, y: 0.3 };
    if (c.walker && !c.walker.leaving) return { x: c.walker.x, z: c.walker.z, y: 0.3 * c.walker.scale };
    const b = this.buildings.get(c.at);
    if (!b) return null;
    return { x: b.mesh.position.x, z: b.mesh.position.z, y: 0.5 + BUILDINGS[b.kind].size * 0.3 };
  }

  private updateMarker(dt: number) {
    const s = this.selection;
    const sb = s?.type === 'building' ? this.buildings.get(s.id) : undefined;
    this.ring.visible = !!sb;
    if (sb) {
      const size = BUILDINGS[sb.kind].size;
      const pulse = 1 + Math.sin(this.time * 5 + performance.now() * 0.004) * 0.05;
      this.ring.position.set(sb.mesh.position.x, 0.08, sb.mesh.position.z);
      this.ring.scale.setScalar(size * 1.38 * pulse);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.3 * Math.sin(performance.now() * 0.006);
    }
    this.beamT = Math.max(0, this.beamT - dt);
    this.beam.visible = !!sb && this.beamT > 0;
    if (this.beam.visible && sb) {
      this.beam.position.set(sb.mesh.position.x, 1.6, sb.mesh.position.z);
      this.beam.scale.set(BUILDINGS[sb.kind].size, 1, BUILDINGS[sb.kind].size);
      (this.beam.material as THREE.MeshBasicMaterial).opacity = Math.min(0.4, this.beamT * 0.25);
    }
    if (s?.type === 'vehicle') {
      this.ring.visible = false;
      const v = this.traffic.getVehicle(s.id);
      if (!v || v.leaving) { this.marker.visible = false; return; }
      this.marker.visible = true;
      this.marker.position.set(v.x, 0.42 + Math.sin(this.time * 6) * 0.03, v.z);
      this.marker.rotation.y += dt * 3;
      if (this.following) {
        const tg = this.cam.target;
        tg.x += (v.x - tg.x) * Math.min(1, dt * 6);
        tg.z += (v.z - tg.z) * Math.min(1, dt * 6);
        this.cam.apply();
      }
      return;
    }
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
    if (c.school >= 0) return this.buildings.get(c.school)?.kind === 'university' ? t('Student') : t('Pupil');
    if (c.age < 6) return t('Small child');
    if (c.age < 18) return t('Child (no school place)');
    if (c.age >= 65) return t('Retired');
    if (this.pop.onLeave(c)) return t('Parental leave');
    return t('Looking for work');
  }

  private refreshInspector(): void {
    const s = this.selection;
    if (!this.inspector || !s) return;
    if (s.type === 'vehicle') {
      const v = this.traffic.getVehicle(s.id);
      if (!v || v.leaving) { this.hud?.toast(t('The vehicle has departed')); return this.select(null); }
      return this.inspector.show(this.vehicleView(v));
    }
    if (s.type === 'person') {
      const c = this.pop.citizens.get(s.id);
      if (!c) { this.hud?.toast(t('This person is no longer with us')); return this.select(null); }
      return this.inspector.show(this.personView(c));
    }
    const b = this.buildings.get(s.id);
    if (!b) return this.select(null);
    if (b.kind === 'cemeteryext' && b.parent !== undefined) { const p = this.buildings.get(b.parent); if (p) { this.selection = { type: 'building', id: p.id }; return this.refreshInspector(); } }
    const view = b.kind === 'apartment' ? this.apartmentView(b) : b.kind === 'house' ? this.houseView(b) : b.kind === 'townhall' ? this.cityView(b) : this.buildingView(b);
    view.actions = [...(view.actions ?? []), ...this.buildingActions(b)];
    this.inspector.show(view);
  }

  private vehicleView(v: Vehicle): InspectorView {
    const driver = v.trip.driverId ? this.pop.citizens.get(v.trip.driverId) : undefined;
    const f = driver ? this.pop.families.get(driver.family) : undefined;
    const home = driver && f ? this.buildings.get(f.home) : v.trip.homeBuildingId ? this.buildings.get(v.trip.homeBuildingId) : undefined;
    const dest = v.trip.destBuildingId ? this.buildings.get(v.trip.destBuildingId) : undefined;
    const isTruck = v.trip.kind === 'truck';
    const isBus = v.trip.kind === 'bus';
    const busPassengers = isBus ? this.life.busPassengersForVehicle(v.id) : [];

    const tags: InspectorView['tags'] = [];
    if (driver) tags.push({ text: t(driver.activity), tone: 'good' });
    else if (v.trip.purpose) tags.push({ text: t(v.trip.purpose), tone: 'info' });
    if (v.trip.destName) tags.push({ text: `→ ${t(v.trip.destName)}`, tone: 'info' });
    if (v.trip.loaded) tags.push({ text: t('Loaded with goods'), tone: 'good' });
    if (isBus) {
      tags.push({ text: t('{n} passengers', { n: busPassengers.length }), tone: busPassengers.length > 0 ? 'good' : 'info' });
      if (v.trip.routeName) tags.push({ text: v.trip.routeName, tone: 'good' });
    }

    const rows: InspectorView['rows'] = [];
    const driverName = driver ? `${driver.name} ${f?.surname ?? ''}`.trim() : v.trip.driverName ?? t('City driver');
    rows.push([t('Driver'), driverName]);
    if (driver) {
      rows.push([t('Age'), `${Math.floor(driver.age)} ${t('years')}`]);
      rows.push([t('Profession'), this.professionOf(driver)]);
      rows.push([t('Trip purpose'), t(v.trip.purpose ?? driver.activity)]);
      rows.push([t('Fuel'), `${Math.round(f?.car?.fuel ?? 100)}%`]);
    } else {
      if (v.trip.purpose) rows.push([t('Mission'), t(v.trip.purpose)]);
    }
    if (isBus) {
      if (v.trip.routeName) rows.push([t('Route'), v.trip.routeName]);
      rows.push([t('Passengers on board'), `${busPassengers.length} ${t('people')}`]);
      for (const p of busPassengers.slice(0, 5)) {
        const passC = this.pop.citizens.get(p.citizenId);
        const ds = this.buildings.get(p.dropStopId);
        const dsName = ds ? BUILDINGS[ds.kind].name : 'Stop';
        if (passC) {
          rows.push([passC.name, `→ ${t(dsName)} ${t('gets off')}`]);
        }
      }
    }
    if (v.trip.fromName) rows.push([t('Origin'), t(v.trip.fromName)]);
    if (v.trip.destName) rows.push([t('Destination'), t(v.trip.destName)]);
    if (home) rows.push([t('Home'), t(BUILDINGS[home.kind].name)]);
    if (dest) rows.push([t('Target building'), t(BUILDINGS[dest.kind].name)]);

    const actions: NonNullable<InspectorView['actions']> = [
      {
        label: this.following ? t('Stop following') : t('Follow vehicle'),
        icon: 'follow',
        active: this.following,
        onClick: () => { this.following = !this.following; this.refreshInspector(); },
      },
      { label: t("Driver's eyes"), icon: 'eye', onClick: () => this.enterPov({ type: 'vehicle', id: v.id }) },
    ];
    if (isBus && busPassengers.length > 0) {
      actions.unshift({
        label: t('Show passenger'),
        icon: 'people',
        onClick: () => this.select({ type: 'person', id: busPassengers[0].citizenId }),
      });
    }
    if (driver) {
      actions.unshift({
        label: t('Show driver details'),
        icon: 'people',
        onClick: () => this.select({ type: 'person', id: driver.id }),
      });
    }
    if (dest) {
      actions.push({
        label: t('Show destination'),
        icon: 'roads',
        onClick: () => {
          this.cam.setState(dest.mesh.position.x, dest.mesh.position.z, this.cam.yaw, this.cam.viewHalf);
          this.select({ type: 'building', id: dest.id });
        },
      });
    }
    if (home) {
      actions.push({
        label: t('Show home'),
        icon: 'house',
        onClick: () => {
          this.cam.setState(home.mesh.position.x, home.mesh.position.z, this.cam.yaw, this.cam.viewHalf);
          this.select({ type: 'building', id: home.id });
        },
      });
    }

    const badge = isTruck ? '🚚' : isBus ? '🚌' : '🚗';
    const badgeColor = isTruck ? '#4a7fb5' : isBus ? '#d9a92a' : '#3a6fd1';
    const title = isBus ? (v.trip.routeName ?? t('Bus')) : driver ? `${driver.name} ${f?.surname ?? ''}`.trim() : (v.trip.purpose ?? t(v.trip.kind === 'car' ? 'Car' : isTruck ? 'Truck' : 'Bus'));
    const speedKmh = Math.max(1, Math.round(v.speed * 20));

    return {
      key: `v${v.id}`,
      badge,
      badgeColor,
      title,
      subtitle: `${t(v.trip.kind === 'car' ? 'Car' : isTruck ? 'Truck' : 'Bus')} · ${speedKmh} km/h`,
      tags,
      rows,
      actions,
    };
  }

  private professionOf(c: Citizen) {
    const b = c.job >= 0 ? this.buildings.get(c.job) : undefined;
    const p = b && PROFESSIONS[b.kind];
    if (p) return t(c.skill === 2 && p[1] ? p[1] : p[0]);
    if (c.school >= 0) return this.buildings.get(c.school)?.kind === 'university' ? t('Student') : t('Pupil');
    if (c.age >= 18 && c.skill === 2) return t('Graduate');
    if (c.age >= 18 && c.skill === 1) return t('Tradesman');
    return '—';
  }

  /** Move / demolish buttons for the inspector. */
  private buildingActions(b: Building): NonNullable<InspectorView['actions']> {
    if (b.kind === 'cemeteryext') return [];
    const out: NonNullable<InspectorView['actions']> = [];
    if (!b.ext?.length) {
      out.push({ label: `${t('Move')} · $${Math.round(BUILDINGS[b.kind].money * 0.25)}`, icon: 'pan', onClick: () => this.startMove(b) });
    }
    if (b.kind !== 'townhall') {
      const sure = this.confirmDemolish === b.id;
      out.push({
        label: sure ? t('Tap again to demolish') : t('Demolish'), icon: 'bulldoze', active: sure,
        onClick: () => {
          if (this.confirmDemolish !== b.id) { this.confirmDemolish = b.id; this.refreshInspector(); return; }
          this.confirmDemolish = -1;
          sound.play('demolish');
          this.destroyBuilding(b, true);
          this.networkChanged();
        },
      });
    }
    return out;
  }

  private startMove(b: Building) {
    this.moving = b;
    this.setTool(b.kind as PlaceKind);
    this.moving = b;
    this.select(null);
    this.hud?.toast(t('Choose a new place for the {name}', { name: t(BUILDINGS[b.kind].name) }));
  }

  private upgradeCemetery(b: Building) {
    const city = this.cityOf(b);
    const u = CEMETERY_UPGRADE;
    if (b.level >= u.maxLevel || b.built < 1) return;
    const m = u.money * b.level, s = u.stone * b.level, w = u.wood * b.level;
    if (city.money < m || city.stone < s || city.wood < w) return this.hud?.toast(t('Needs {cost}', { cost: costText(m, s, w) }));
    city.money -= m; city.stone -= s; city.wood -= w;
    // the cemetery grows: a new walled plot next to it
    const sz = BUILDINGS.cemetery.size;
    const spots = [[b.x + sz, b.z], [b.x - sz, b.z], [b.x, b.z - sz], [b.x, b.z + sz], ...(b.ext ?? []).flatMap((id) => {
      const e = this.buildings.get(id);
      return e ? [[e.x + sz, e.z], [e.x - sz, e.z], [e.x, e.z - sz], [e.x, e.z + sz]] : [];
    })];
    const spot = spots.find(([x, z]) => this.buildings.check('cemeteryext', x, z).ok);
    if (!spot) { city.money += m; city.stone += s; city.wood += w; return this.hud?.toast(t('No room next to the cemetery to expand')); }
    const ext = this.buildings.place('cemeteryext', spot[0], spot[1], { city: b.city, built: 1 });
    ext.parent = b.id;
    (b.ext ??= []).push(ext.id);
    this.terrain.clearTiles(this.buildings.footprint('cemeteryext', spot[0], spot[1]).map((f) => idx(f.x, f.z)));
    this.buildings.setLevel(b, b.level + 1);
    this.networkChanged();
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, 1, 16, ['#bdb7aa', '#8c8a87', '#4f8a3a']);
    this.hud?.toast(t('Cemetery upgraded — it now holds {n} graves', { n: GRAVES_PER_PLOT * b.level }));
    this.refreshInspector();
  }

  private personView(c: Citizen): InspectorView {
    const f = this.pop.families.get(c.family);
    const home = f && this.buildings.get(f.home);
    const age = Math.floor(c.age);
    const tags: InspectorView['tags'] = [];
    if (c.hunger < 25) tags.push({ text: t('Hungry'), tone: 'bad' });
    if (c.health < 50) tags.push({ text: t('Sick'), tone: 'bad' });
    if (c.edu >= 0.99 && age >= 18) tags.push({ text: t('Educated'), tone: 'good' });
    if (c.role === 'parent' && this.buildings.list.some((x) => x.owner === c.family)) tags.push({ text: t('Business owner'), tone: 'good' });
    for (const city of this.eco.cities.values()) if (city.mayor === c.id) tags.unshift({ text: t('Mayor of {city}', { city: city.name }), tone: 'good' });
    if (c.skill === 2) tags.push({ text: t('Degree'), tone: 'good' });
    else if (c.skill === 1 && age >= 18) tags.push({ text: t('Skilled trade'), tone: 'info' });
    if (f?.car && age >= 18) tags.push({ text: t('Family car'), tone: 'info' });
    const veh = this.traffic.vehicleForDriver(c.id);
    if (veh) tags.push({ text: t('Driving a car'), tone: 'good' });
    const busVeh = this.traffic.vehicleForPassenger(c.id);
    if (busVeh) tags.push({ text: t('Riding the bus'), tone: 'good' });
    const waiter = this.life.passengerWaiter(c.id);
    if (waiter) tags.push({ text: t('Waiting for bus'), tone: 'info' });
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
        [t('Profession'), this.professionOf(c)],
        [t('Home'), f ? t('{name} family', { name: f.surname }) : '—'],
        [t('City'), home ? this.cityOf(home).name : '—'],
        [c.school >= 0 ? t('School') : t('Workplace'), job ? t(BUILDINGS[job.kind].name) : '—'],
        [t('Family savings'), f ? `$${Math.floor(f.money).toLocaleString('en-US')}` : '—', f && f.money < 0 ? 'bad' : undefined],
      ],
      actions: [
        { label: this.following ? t('Stop following') : t('Follow'), icon: 'follow', active: this.following, onClick: () => { this.following = !this.following; this.refreshInspector(); } },
        { label: t("Citizen's eyes"), icon: 'eye', onClick: () => this.enterPov({ type: 'person', id: c.id }) },
        ...(veh ? [{ label: t('Show car on road'), icon: 'car' as const, onClick: () => { this.select({ type: 'vehicle', id: veh.id }); this.following = true; } }] : []),
        ...(busVeh ? [{ label: t('Show bus'), icon: 'car' as const, onClick: () => { this.select({ type: 'vehicle', id: busVeh.id }); this.following = true; } }] : []),
        ...(waiter ? [{ label: t('Show bus stop'), icon: 'roads' as const, onClick: () => {
          const stop = this.buildings.get(waiter.pickupStopId);
          if (stop) {
            this.cam.setState(stop.mesh.position.x, stop.mesh.position.z, this.cam.yaw, this.cam.viewHalf);
            this.select({ type: 'building', id: stop.id });
          }
        } }] : []),
        ...(home ? [{ label: t('Show home'), icon: 'house' as const, onClick: () => { this.cam.setState(home.mesh.position.x, home.mesh.position.z, this.cam.yaw, this.cam.viewHalf); this.select({ type: 'building', id: home.id }); this.beamT = 4; } }] : []),
      ],
    };
  }

  private apartmentView(b: Building): InspectorView {
    const families = [...this.pop.families.values()].filter((f) => f.home === b.id);
    const owner = b.owner >= 0 ? this.pop.families.get(b.owner) : undefined;
    const people = families.flatMap((f) => this.pop.members(f));
    return {
      key: `b${b.id}`, badge: '🏢', badgeColor: KIND_BADGE.apartment[1], title: t('Apartment Block'),
      subtitle: t('{a} of {b} flats taken', { a: families.length, b: BUILDINGS.apartment.units }),
      tags: b.built < 1 ? [{ text: t('Under construction'), tone: 'info' }] : [],
      bars: [{ label: t('Flats'), value: families.length / BUILDINGS.apartment.units, color: '#6fb6ff', text: `${families.length}/${BUILDINGS.apartment.units}` }],
      rows: [
        [t('City'), this.cityOf(b).name],
        [t('Owner'), owner ? t('{name} family', { name: owner.surname }) : t('City-owned')],
        [t('Rent'), `$${RENT}/${t('day')} ${t('per flat')}`],
        [t('Power'), b.powered ? t('Yes') : t('No'), b.powered ? 'good' : 'bad'],
      ],
      listTitle: t('Residents'),
      people: people.map((c) => {
        const f = this.pop.families.get(c.family);
        return { id: c.id, icon: this.personIcon(c), name: `${c.name} ${f?.surname ?? ''}`, detail: `${t('{n} years', { n: Math.floor(c.age) })} · ${t(c.activity)}`, warn: c.hunger < 25 || c.health < 50 };
      }),
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
        ...this.buildings.list.filter((x) => x.owner === f.id).map((x) => [t('Owns'), t(BUILDINGS[x.kind].name), 'good'] as [string, string, ('good' | 'bad')?]),
        [t('Power'), b.powered ? t('Yes') : t('No — not connected to a power plant'), b.powered ? 'good' : 'bad'],
        [t('City'), this.cityOf(b).name],
        [t('Air'), (this.life.pollution.get(b.id) ?? 0) > 1.5 ? t('Smog — people get sick') : t('Clean'), (this.life.pollution.get(b.id) ?? 0) > 1.5 ? 'bad' : 'good'],
        [t('Water'), this.cityOf(b).water >= 0.99 ? t('Clean water') : t('Not enough water!'), this.cityOf(b).water >= 0.99 ? 'good' : 'bad'],
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
    const city = this.cityOf(b);
    const staff = [...this.pop.citizens.values()].filter((c) => c.job === b.id);
    const tags: InspectorView['tags'] = [];
    const rows: InspectorView['rows'] = [];
    const bars: InspectorView['bars'] = [];
    rows.push([t('City'), city.name]);
    if (BUSINESS_KINDS.includes(b.kind)) {
      const owner = b.owner >= 0 ? this.pop.families.get(b.owner) : undefined;
      rows.push([t('Owner'), owner ? t('{name} family', { name: owner.surname }) : t('City-owned')]);
    }
    const actions: NonNullable<InspectorView['actions']> = [];
    if (b.built < 1) {
      tags.push({ text: t('Under construction'), tone: 'info' });
      bars.push({ label: t('Construction'), value: b.built, color: '#f2b33d' });
      const crew = this.life.crewSize(b);
      rows.push([t('Builders on site'), crew ? `${crew}` : t('None — build a construction company'), crew ? 'good' : undefined]);
    }
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
      rows.push([t('Wood in stock'), `${Math.floor(city.wood)}`, city.wood < 15 ? 'bad' : undefined], [t('Town demand'), `${Math.round(city.energyDemand)}/${t('day')}`]);
      bars.push({ label: t('Energy supplied'), value: city.powered, color: '#ffe066' });
    }
    if (b.kind === 'watertower') bars.push({ label: t('Water supplied'), value: city.water, color: '#4fa3d1' });
    if (b.kind === 'woodcutter') rows.push([t('Trees nearby'), `${this.terrain.treesNear(b.x, b.z, 10)}`]);
    if (b.kind === 'carmarket') bars.push({ label: t('Cars in stock'), value: b.stored / CARS.marketMax, color: '#6fb6ff', text: `${Math.floor(b.stored)}/${CARS.marketMax}` });
    if (b.kind === 'carfactory') {
      bars.push({ label: t('Cars ready'), value: b.stored / CARS.factoryMax, color: '#6fb6ff', text: `${Math.floor(b.stored)}/${CARS.factoryMax}` });
      rows.push([t('Iron per car'), `${CARS.iron}`], [t('Iron in stock'), `${Math.floor(city.iron)}`, city.iron < CARS.iron ? 'bad' : undefined]);
    }
    if (b.sales !== undefined && (b.kind === 'grocery' || b.kind === 'clothes' || b.kind === 'market' || b.kind === 'gasstation')) rows.push([t('Sales today'), `$${Math.round(b.sales)}`]);
    if (b.kind === 'quarry') {
      bars.push({ label: t('Stone ready'), value: b.stored / QUARRY.maxStored, color: '#aab4be', text: `${Math.floor(b.stored)}/${QUARRY.maxStored}` });
      rows.push([t('Trucks'), `${b.trucks}/2`]);
    }
    if (def.slots.length && b.kind !== 'house') rows.push([t('Parking'), `${this.life.spotsUsed(b)}/${def.slots.length}`]);
    if (b.kind === 'cemetery') {
      const count = b.graves?.length ?? 0;
      const cap = MAX_GRAVES_PER_CEMETERY * b.level;
      bars.push({ label: t('Graves'), value: count / cap, color: '#8c8a87', text: `${count}/${cap}` });
      rows.push([t('Grave plot price'), `$${GRAVE_COST}`], [t('Level'), `${b.level}/${CEMETERY_UPGRADE.maxLevel}`]);
      if (b.level < CEMETERY_UPGRADE.maxLevel && b.built >= 1) {
        const m = CEMETERY_UPGRADE.money * b.level;
        actions.push({ label: `${t('Expand')} · $${m}`, icon: 'up', onClick: () => this.upgradeCemetery(b) });
      }
    }
    if (b.kind === 'ranch') {
      const cattle = b.cattleCount ?? 4;
      const hunger = b.cattleHunger ?? 0;
      bars.push({ label: t('Cattle'), value: cattle / 4, color: cattle > 2 ? '#7be08f' : cattle > 0 ? '#f2b33d' : '#ff6b5e', text: `${cattle}/4 ${t('cows')}` });
      rows.push([t('Livestock health'), hunger > 50 ? t('Starving — needs farm crops/feed!') : t('Fed and healthy'), hunger > 50 ? 'bad' : 'good']);
      rows.push([t('Feed source'), t('Farm crops (grain/corn)'), city.food > 10 ? 'good' : 'bad']);
    }
    if (b.kind === 'busstop') {
      const waiters = this.life.busWaitersAtStop(b.id);
      bars.push({ label: t('Waiting passengers'), value: Math.min(1, waiters.length / 8), color: '#d9a92a', text: `${waiters.length} ${t('people')}` });
      rows.push([t('Public transport'), t('Active bus stop')]);
    }
    if (b.kind === 'hotel') {
      const attract = this.life.attraction.get(b.id) ?? 0;
      bars.push({ label: t('Guests'), value: b.stored / TOURISM.rooms, color: '#6fb6ff', text: `${Math.round(b.stored)}/${TOURISM.rooms}` });
      bars.push({ label: t('Attraction'), value: Math.min(1, attract), color: '#7be08f' });
      if (!b.workers) rows.push([t('Status'), t('Closed — no staff. Raise the hotel priority in Statistics → Jobs'), 'bad']);
      rows.push([t('Room price'), `$${TOURISM.spend}/${t('day')}`]);
    }
    if (b.kind === 'stadium') {
      const lz = this.life.leisure;
      rows.push([t('Next match'), lz.matchDay ? t('Today at 17:00') : t('Tomorrow')], [t('Ticket'), `$${FOOTBALL.ticket}`]);
      for (const m of lz.matches.slice(0, 4)) rows.push([`${t('Day {n}', { n: m.day })}`, `${m.home} ${m.hs}:${m.as} ${m.away}`]);
      if (!lz.matches.length) rows.push([t('Results'), t('No matches yet')]);
    }
    if (b.kind === 'cinema') rows.push([t('Show time'), '19:00 – 23:00'], [t('Ticket'), `$${CINEMA.ticket}`], [t('Seats'), `${CINEMA.seats}`]);
    if (b.kind === 'academy') rows.push([t('Effect'), t('Children learn 30% faster · stronger football team')]);
    if (DECOR[b.kind]) {
      rows.push([t('Beauty'), `+${DECOR[b.kind]}`], [t('Range'), t('{n} tiles', { n: DECOR_RANGE })]);
      rows.push([t('Neighbourhood beauty'), `${(this.life.leisure.beautyOf.get(b.city) ?? 0).toFixed(1)}`]);
    }
    if (b.kind === 'busdepot') {
      const routeStops = this.life.getRouteStops(b);
      const activeBuses = this.traffic.vehicles.filter((v) => !v.leaving && v.trip.homeBuildingId === b.id).length;
      bars.push({ label: t('Active buses'), value: activeBuses / Math.max(1, Math.min(3, b.workers)), color: '#d9a92a', text: `${activeBuses}/${Math.min(3, b.workers)}` });
      rows.push([t('Route stops'), `${routeStops.length} ${t('stops')}`]);
    }
    let people = staff;
    let listTitle = t('Workers');
    if (b.kind === 'busstop') {
      const waiters = this.life.busWaitersAtStop(b.id);
      if (waiters.length > 0) {
        listTitle = t('Waiting passengers');
        people = waiters.map((w) => this.pop.citizens.get(w.citizenId)).filter(Boolean) as Citizen[];
      }
    }
    if (b.kind === 'cemetery' && b.graves && b.graves.length > 0) {
      listTitle = t('Buried citizens');
      people = b.graves.map((g, i) => ({
        id: -1000 - i,
        icon: '🪦',
        name: `${g.name} ${g.family}`.trim(),
        detail: `${t('{n} years', { n: g.age })} · ${t('Day {n}', { n: g.day })}`,
        warn: false,
      })) as any;
    }

    if (b.kind === 'school' || b.kind === 'university') {
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
      tags, bars, rows, listTitle, actions,
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
    if (this.petitions?.visible && ++this.petitionTick % 12 === 0) this.petitions.render();
    const mine = (c: Citizen) => this.cityOfCitizen(c) === e.active;
    const counts = this.pop.counts(mine);
    this.hud!.setStats({
      cityName: e.city.name, cities: e.cities.size, happiness: e.city.happiness,
      money: e.money, iron: e.iron, daily: e.city.balance.net, stone: e.stone, wood: e.wood, food: e.food,
      foodDaily: this.foodBalance(), powered: e.powered, water: e.city.water,
      population: this.life.populationByCity().get(e.active) ?? 0, workers: counts.workers, workforce: counts.workforce,
      dateText: this.dateText(), seasonIcon: SEASON_ICON[seasonOf(monthOf(e.day))], timeOfDay: e.timeOfDay, broke: e.money < 0,
    });
    for (const g of this.goals.check(this.goalContext())) {
      this.eco.city.money += g.reward;
      sound.play('achieve');
      this.life.events.unshift(t('Goal complete: {name} (+${n})', { name: t(g.title), n: g.reward }));
    }
    if (this.goalsPanel?.visible && this.statsTick % 4 === 0) this.goalsPanel.render();
    this.tutorial?.update(this.tutorialContext());
    const ev = this.life.events.shift();
    if (ev) {
      this.hud!.toast(ev);
      this.eventLog?.add(this.eco.day, ev);
    }
    if (this.selection) this.refreshInspector();
    if (this.stats?.visible && ++this.statsTick % 4 === 0) this.stats.render();
  }

  /** Expected food balance per day: yesterday's harvest (or capacity on day 1) minus what everyone eats. */
  private foodBalance() {
    const city = this.eco.city;
    const y = city.foodYesterday;
    const made = y.made || this.buildings.list.reduce((a, b) => {
      const d = BUILDINGS[b.kind];
      return b.city === city.id && d.food ? a + d.food * Math.min(1, b.workers / d.jobs) : a;
    }, 0);
    return Math.round(made - (this.life.populationByCity().get(city.id) ?? 0));
  }

  private snapshot(): StatsSnapshot {
    const city = this.eco.city;
    const mine = (c: Citizen) => this.cityOfCitizen(c) === city.id;
    const own = this.buildings.list.filter((b) => b.city === city.id);
    const rc = this.net.counts(this.map.water);
    const families = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === city.id);
    const kinds = {} as Record<BuildingKind, number>;
    for (const k of Object.keys(BUILDINGS) as BuildingKind[]) kinds[k] = 0;
    let jobs = 0, seats = 0;
    for (const b of own) { kinds[b.kind]++; jobs += BUILDINGS[b.kind].jobs; seats += BUILDINGS[b.kind].students; }
    const population = this.life.populationByCity().get(city.id) ?? 0;
    const svc: [string, BuildingKind[]][] = [
      ['Schools', ['school']], ['Universities', ['university']], ['Hospitals', ['hospital']], ['Police', ['police']],
      ['Fire stations', ['firestation']], ['Parks', ['park']], ['Shops', ['grocery', 'clothes', 'market']], ['Bus depots', ['busdepot']],
    ];
    const mayor = this.pop.citizens.get(city.mayor);
    const pops = this.life.populationByCity();
    return {
      happiness: city.happiness, taxRate: city.taxRate, loan: city.loan, iron: city.iron,
      mayor: mayor ? `${mayor.name} ${this.pop.families.get(mayor.family)?.surname ?? ''}` : '',
      cityList: [...this.eco.cities.values()].map((c) => ({ name: c.name, pop: pops.get(c.id) ?? 0, money: c.money, happiness: c.happiness, net: c.balance.net, active: c.id === city.id })),
      services: svc.map(([label, kinds]) => [label, own.filter((b) => kinds.includes(b.kind)).length] as [string, number]),
      businesses: { total: own.filter((b) => BUSINESS_KINDS.includes(b.kind)).length, owned: own.filter((b) => b.owner >= 0).length },
      labour: [...new Set(own.filter((b) => BUILDINGS[b.kind].jobs && b.built >= 1).map((b) => b.kind))].map((k) => {
        const list = own.filter((b) => b.kind === k && b.built >= 1);
        return {
          kind: k, name: t(BUILDINGS[k].name), workers: list.reduce((a, b) => a + b.workers, 0), jobs: list.reduce((a, b) => a + BUILDINGS[k].jobs, 0),
          prio: city.jobPriority[k] ?? 'normal',
        };
      }).sort((a, b) => b.jobs - b.workers - (a.jobs - a.workers)),
      unemployed: [...this.pop.citizens.values()].filter((c) => mine(c) && this.pop.canWork(c) && c.job < 0).length,
      cityName: city.name, cities: this.eco.cities.size,
      money: city.money, stone: city.stone, wood: city.wood, food: city.food, foodRate: this.foodBalance() + population,
      energyDemand: city.energyDemand, energyCapacity: city.energyCapacity, powered: city.powered, water: city.water,
      population, families: families.length, carsOwned: families.filter((f) => f.car).length,
      people: this.pop.counts(mine), jobs, schoolSeats: seats, freeHomes: this.life.freeHomes(city.id).length,
      balance: city.balance,
      buildings: kinds,
      roads: { total: rc.total, bridges: rc.bridges, roundabouts: this.net.roundabouts.length, signals: this.traffic.signalCount, footpaths: this.footpaths.count(), canals: this.canals.count() },
      traffic: { cars: this.traffic.count('car'), trucks: this.traffic.count('truck'), walkers: this.walkers.list.length, parked: this.life.parkedCars().length },
      animals: {
        cows: this.animals.list.filter((a) => a.kind === 0).length,
        sheep: this.animals.list.filter((a) => a.kind === 1).length,
        herds: new Set(this.animals.list.map((a) => `${a.kind}:${Math.round(a.herdX)}:${Math.round(a.herdZ)}`)).size,
      },
      trees: this.terrain.trees.size,
      hasHall: own.some((b) => b.kind === 'weddinghall'),
      deathsYesterday: city.deaths,
      history: this.history.samples,
    };
  }

  // ---------- cities ----------

  private cityOf(b: Building): City {
    return this.eco.cities.get(b.city) ?? this.eco.city;
  }

  private cityOfCitizen(c: Citizen) {
    return this.buildings.get(this.pop.families.get(c.family)?.home ?? -1)?.city ?? -1;
  }

  /** Switch to the next city: the camera flies to its Town Hall and building costs come from its treasury. */
  private cycleCity() {
    const halls = this.buildings.halls();
    if (!halls.length) return;
    const i = halls.findIndex((h) => h.city === this.eco.active);
    const next = halls[(i + 1) % halls.length];
    this.eco.active = next.city;
    this.cam.setState(next.mesh.position.x, next.mesh.position.z, this.cam.yaw, this.cam.viewHalf);
    this.select({ type: 'building', id: next.id });
    this.refreshHud();
  }

  /** Send stone, wood or food by truck to another city (needs a road between the Town Halls). */
  private tradeActions(city: City): NonNullable<InspectorView['actions']> {
    const others = [...this.eco.cities.values()].filter((c) => c.id !== city.id);
    if (!others.length) return [];
    const target = others.find((c) => c.id === this.tradeTarget) ?? others[0];
    const cycle = () => {
      const i = others.indexOf(target);
      this.tradeTarget = others[(i + 1) % others.length].id;
      this.refreshInspector();
    };
    return [
      { label: `${t('Trade with')}: ${target.name}${others.length > 1 ? ' ▸' : ''}`, icon: 'roads', onClick: cycle },
      { label: t('Send {n} stone', { n: 20 }), icon: 'stone', onClick: () => this.sendGoods(city, target, 'stone', 20) },
      { label: t('Send {n} wood', { n: 20 }), icon: 'wood', onClick: () => this.sendGoods(city, target, 'wood', 20) },
      { label: t('Send {n} food', { n: 50 }), icon: 'food', onClick: () => this.sendGoods(city, target, 'food', 50) },
    ];
  }

  private sendGoods(from: City, to: City, what: 'stone' | 'wood' | 'food', amount: number) {
    if (from[what] < amount) { sound.play('error'); return this.hud?.toast(t('Not enough to send')); }
    const a = this.buildings.townHall(from.id), b = this.buildings.townHall(to.id);
    if (!a || !b || a.access < 0 || b.access < 0 || !this.traffic.canRoute(a.access, b.access)) {
      sound.play('error');
      return this.hud?.toast(t('No road between these cities'));
    }
    from[what] -= amount;
    const ok = this.traffic.spawn({
      kind: 'truck', loaded: true, from: a.access, to: b.access, fromPos: this.buildings.door(a), toPos: this.buildings.door(b),
      onArrive: () => { to[what] += amount; this.life.events.push(t('Goods arrived in {city}', { city: to.name })); },
      onFail: () => { from[what] += amount; },
    });
    if (!ok) { from[what] += amount; return this.hud?.toast(t('No free trucks right now')); }
    sound.play('coin');
    this.hud?.toast(t('A truck is on its way to {city}', { city: to.name }));
    this.refreshInspector();
  }

  private goalContext(): GoalContext {
    const count = (k: BuildingKind) => this.buildings.list.reduce((a, b) => a + (b.kind === k && b.built >= 1 ? 1 : 0), 0);
    return {
      population: this.pop.size, roads: this.net.counts(this.map.water).total, houses: count('house'),
      cities: this.eco.cities.size, year: yearOf(this.eco.day),
      maxHappiness: Math.max(0, ...[...this.eco.cities.values()].map((c) => c.happiness)),
      familyBusiness: this.buildings.list.some((b) => b.owner >= 0), count,
    };
  }

  private tutorialContext(): TutorialContext {
    const n = (k: BuildingKind) => this.buildings.list.reduce((a, b) => a + (b.kind === k ? 1 : 0), 0);
    const sel = this.selection?.type === 'building' ? this.buildings.get(this.selection.id) : undefined;
    return {
      roads: this.net.counts(this.map.water).total, houses: n('house'), footpaths: this.footpaths.count(),
      shops: n('grocery') + n('clothes') + n('market'), hallSelected: sel?.kind === 'townhall', speed: this.speed,
    };
  }

  /** Nature sounds follow the camera: water, forest, town, rain and night. */
  private updateAmbience() {
    const tg = this.cam.target;
    const cx = Math.floor(tg.x + N / 2), cz = Math.floor(tg.z + N / 2);
    const r = Math.max(5, Math.min(16, Math.round(this.cam.viewHalf * 0.6)));
    let total = 0, water = 0, trees = 0, town = 0;
    for (let z = cz - r; z <= cz + r; z += 2) for (let x = cx - r; x <= cx + r; x += 2) {
      if (!inBounds(x, z)) continue;
      const k = idx(x, z);
      total++;
      if (this.map.water[k] || this.canals.flowing[k]) water++;
      else if (this.terrain.trees.has(k)) trees++;
      else if (this.buildings.occ[k] !== -1 || this.net.type[k]) town++;
    }
    const near = Math.max(0.35, Math.min(1, (42 - this.cam.viewHalf) / 30));
    const f = (n: number, gain: number) => Math.min(1, (n / Math.max(1, total)) * gain) * near;
    sound.setAmbience({
      water: f(water, 4), forest: f(trees, 2.2), town: f(town, 2.5),
      rain: this.weather.kind === 'rain' && this.weather.rainingAt(tg.x, tg.z) ? 1 : 0,
      night: this.nightness,
    });
  }

  private stations(): Station[] {
    return this.buildings.list.filter((b) => b.kind === 'trainstation' && b.built >= 1)
      .map((b) => ({ id: b.id, x: b.x, z: b.z, size: BUILDINGS.trainstation.size, city: b.city }));
  }

  /** A train arrives: goods flow from the city that has plenty to the one that lacks, passengers bring cheer. */
  private trainArrived(from: Station, to: Station) {
    if (from.city === to.city) return;
    const a = this.eco.cities.get(from.city), b = this.eco.cities.get(to.city);
    if (!a || !b) return;
    const moved: string[] = [];
    for (const res of ['stone', 'wood', 'food', 'iron'] as const) {
      const diff = a[res] - b[res];
      if (diff <= 40) continue;
      const amount = Math.round(Math.min(30, diff / 4));
      a[res] -= amount;
      b[res] += amount;
      moved.push(`${amount} ${t(res)}`);
    }
    a.happiness = Math.min(100, a.happiness + 0.4);
    b.happiness = Math.min(100, b.happiness + 0.4);
    if (moved.length && Math.random() < 0.1) this.life.events.push(t('A train brought {goods} from {a} to {b}', { goods: moved.join(', '), a: a.name, b: b.name }));
  }

  /** Navruz and New Year: confetti by day, fireworks at night over parks and town halls. */
  private festivities(dt: number) {
    if (!this.life.festival || this.demo) return;
    this.festT -= dt;
    if (this.festT > 0) return;
    this.festT = this.nightness > 0.5 ? 0.35 : 0.8;
    const spots = this.buildings.list.filter((b) => b.kind === 'park' || b.kind === 'townhall');
    if (!spots.length) return;
    const b = spots[Math.floor(Math.random() * spots.length)];
    const x = b.mesh.position.x + (Math.random() - 0.5) * 2, z = b.mesh.position.z + (Math.random() - 0.5) * 2;
    if (this.nightness > 0.5) this.effects.firework(x, z);
    else this.effects.puff(x, z, 0.6, 10, ['#ff5a5a', '#ffd166', '#7be08f', '#6fb6ff', '#e88cff']);
  }

  /** Morning paper: yesterday's news, the richest family and the biggest problem. */
  private morningPaper() {
    const city = this.eco.city;
    const pops = this.life.populationByCity();
    const pop = pops.get(city.id) ?? 0;
    const yesterday = this.eco.day - 1;
    const stories = (this.eventLog?.entries ?? []).filter((e) => e.day === yesterday).map((e) => e.text);
    const fams = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === city.id);
    const richest = fams.reduce<typeof fams[number] | undefined>((a, f) => (!a || f.money > a.money ? f : a), undefined);
    const snap = this.snapshot();
    const problems: string[] = [];
    if (city.money < 0) problems.push(t('In debt'));
    if (city.powered < 0.8) problems.push(t('Power shortage'));
    if (city.water < 0.9) problems.push(t('No water tower'));
    if (pop && city.food < pop * 2) problems.push(t('Food is low'));
    if (city.happiness < 45) problems.push(t('people are leaving'));
    if (city.pollution > 1.5) problems.push(t('Smog'));
    if (!snap.freeHomes) problems.push(t('No free homes'));
    const headline = stories.find((s) => /murder|o'ldir|fire|olov|mayor|mer|Navruz|Year|yil|train|poyezd/i.test(s)) ?? stories[0] ?? t('A quiet day in {city}', { city: city.name });
    this.news?.show({
      date: this.dateText(), city: city.name, headline, stories: stories.filter((s) => s !== headline),
      richest: richest ? `${t('{name} family', { name: richest.surname })} · $${Math.round(richest.money).toLocaleString('en-US')}` : '—',
      problem: problems[0] ?? t('None — the city is doing well'),
      population: pop, popChange: pop - (this.yesterday.pop || pop), money: city.money, moneyChange: city.money - (this.yesterday.money || city.money),
    });
    this.yesterday = { pop, money: city.money };
  }

  /** Score for the records table. */
  private score() {
    const cities = [...this.eco.cities.values()];
    return Math.round(this.pop.size * 10 + cities.reduce((a, c) => a + c.happiness * 5 + Math.max(0, c.money) / 20, 0) + this.buildings.list.length * 5 + this.goals.done.size * 100);
  }

  /** Weaker devices: no shadows. */
  setLowQuality() {
    this.sun.castShadow = false;
  }

  /** Travelling merchants sell stone and wood for money — a way out when materials run out. */
  private buyMaterial(city: City, what: 'stone' | 'wood' | 'iron') {
    const m = MERCHANT[what];
    if (city.money < m.price) return this.hud?.toast(t('Not enough money — needs ${n}', { n: m.price }));
    city.money -= m.price;
    city[what] += m.amount;
    sound.play('coin');
    this.refreshInspector();
    this.refreshHud();
  }

  /** Town Hall inspector: the whole picture of one city. */
  private cityView(b: Building): InspectorView {
    const city = this.cityOf(b);
    const own = this.buildings.list.filter((x) => x.city === city.id);
    const inCity = (c: Citizen) => this.cityOfCitizen(c) === city.id;
    const counts = this.pop.counts(inCity);
    const population = this.life.populationByCity().get(city.id) ?? 0;
    const families = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === city.id);
    const sum = (fn: (k: BuildingKind) => number) => own.reduce((a, x) => a + fn(x.kind), 0);
    const jobs = sum((k) => BUILDINGS[k].jobs);
    const seats = sum((k) => BUILDINGS[k].students);
    const houses = own.filter((x) => x.kind === 'house').length;
    const freeHomes = this.life.freeHomes(city.id).length;
    const daysFood = population ? city.food / population : 99;
    const hasHall = own.some((x) => x.kind === 'weddinghall');
    const hasTower = own.some((x) => x.kind === 'watertower');
    const mayor = this.pop.citizens.get(city.mayor);
    const hasBank = own.some((x) => x.kind === 'bank' && x.built >= 1 && x.workers > 0);
    const bal = city.balance;
    const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.floor(n)).toLocaleString('en-US')}`;
    const signed = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

    const tags: InspectorView['tags'] = [];
    tags.push(city.id === this.eco.active ? { text: `✓ ${t('Active City (all building costs from here)')}`, tone: 'good' } : { text: t('Click to build for this city'), tone: 'info' });
    if (city.money < 0) tags.push({ text: t('In debt'), tone: 'bad' });
    if (city.smart) tags.push({ text: t('Smart City'), tone: 'good' });
    if (city.railLink) tags.push({ text: t('Railway link'), tone: 'good' });
    if (this.life.festival) tags.push({ text: t(this.life.festival), tone: 'good' });
    if (this.calm) tags.push({ text: t('Calm mode'), tone: 'info' });
    if (population && !hasTower) tags.push({ text: t('No water tower'), tone: 'bad' });
    if (city.powered < 0.8) tags.push({ text: t('Power shortage'), tone: 'bad' });
    if (population && daysFood < 3) tags.push({ text: t('Food is low'), tone: 'bad' });
    if (!hasHall && counts.workforce > 4) tags.push({ text: t('No Wedding Hall'), tone: 'info' });

    const kinds: [string, string][] = [];
    const tally = new Map<BuildingKind, number>();
    for (const x of own) tally.set(x.kind, (tally.get(x.kind) ?? 0) + 1);
    for (const [k, n] of tally) if (k !== 'townhall') kinds.push([t(BUILDINGS[k].name), `${n}`]);

    const staff = [...this.pop.citizens.values()].filter((c) => c.job === b.id);
    return {
      key: `c${city.id}`,
      badge: '🏛️',
      badgeColor: KIND_BADGE.townhall[1],
      title: city.name,
      subtitle: `${t('Town Hall')} · ${t('Founded')} ${t('Day {n}', { n: city.founded })}`,
      tags,
      bars: [
        { label: t('Happiness'), value: city.happiness / 100, color: barColor(city.happiness / 100) },
        { label: t('Employment'), value: counts.workforce ? counts.workers / counts.workforce : 1, color: '#6fb6ff', text: `${counts.workers}/${counts.workforce}` },
        { label: t('Food'), value: Math.min(1, daysFood / 10), color: barColor(Math.min(1, daysFood / 10)), text: t('{n} days of food', { n: daysFood >= 99 ? '∞' : daysFood.toFixed(1) }) },
        { label: t('Energy supplied'), value: city.powered, color: '#ffe066' },
        { label: t('Water supplied'), value: city.water, color: '#4fa3d1' },
      ],
      rows: [
        ...(city.promise ? [[t('Promise'), `${t(PROMISE_TEXT[city.promise.kind])} · ${t('Day {n}', { n: city.promise.until })}`] as [string, string]] : []),
        ...(city.campaign ? [[t('Election'), t('Day {n}', { n: city.campaign.day })] as [string, string]] : []),
        [t('Air pollution'), city.pollution < 0.5 ? t('Clean') : city.pollution < 1.5 ? t('Some smog') : t('Smog'), city.pollution < 0.5 ? 'good' : city.pollution < 1.5 ? undefined : 'bad'],
        [t('Tourists'), `${city.tourists}`],
        [t('Mayor'), mayor ? `${mayor.name} ${this.pop.families.get(mayor.family)?.surname ?? ''}` : t('No mayor yet')],
        [t('Treasury'), money(city.money), city.money < 0 ? 'bad' : undefined],
        [t('Net yesterday'), signed(bal.net), bal.net >= 0 ? 'good' : 'bad'],
        [t('Tax rate'), `${Math.round(city.taxRate * 100)}%`, city.taxRate > 0.3 ? 'bad' : undefined],
        ...(city.loan > 0 || hasBank ? [[t('Bank loan'), money(city.loan), city.loan > 0 ? 'bad' : undefined] as [string, string, ('good' | 'bad')?]] : []),
        [t('Stone'), `${Math.floor(city.stone)}`],
        [t('Wood'), `${Math.floor(city.wood)}`, city.wood < 15 ? 'bad' : undefined],
        [t('Iron'), `${Math.floor(city.iron)}`],
        [t('Food'), `${Math.floor(city.food)}`],
      ],
      sections: [
        {
          title: t('Budget (yesterday)'),
          rows: [
            [t('Income tax ({n}%)', { n: Math.round(city.taxRate * 100) }), signed(bal.incomeTax), 'good'],
            [t('Food sales'), signed(bal.foodSales), 'good'],
            [t('Property tax'), signed(bal.propertyTax), 'good'],
            [t('Business tax'), signed(bal.businessTax), 'good'],
            [t('Utility bills'), signed(bal.utilities), 'good'],
            [t('Public wages'), signed(-bal.publicWages), bal.publicWages ? 'bad' : undefined],
            [t('Upkeep'), signed(-bal.upkeep), bal.upkeep ? 'bad' : undefined],
          ],
        },
        {
          title: t('Population'),
          rows: [
            [t('People'), `${population}`],
            [t('Families'), `${families.length}`],
            [t('Homes'), t('{a} houses · {b} free', { a: houses, b: freeHomes })],
            [t('Jobs'), `${counts.workers}/${jobs}`],
            [t('Pupils'), `${counts.students}/${seats}`],
            [t('Hungry / sick'), `${counts.hungry} / ${counts.sick}`, counts.hungry + counts.sick > 0 ? 'bad' : undefined],
            [t('Died yesterday'), `${city.deaths}`, city.deaths ? 'bad' : undefined],
            [t('Cars'), `${families.filter((f) => f.car).length}`],
          ],
        },
        { title: t('Buildings'), rows: kinds.length ? kinds.map(([k, n]) => [k, n] as [string, string]) : [[t('Buildings'), '0']] },
      ],
      listTitle: t('Workers'),
      people: staff.map((c) => {
        const f = this.pop.families.get(c.family);
        return { id: c.id, icon: this.personIcon(c), name: `${c.name} ${f?.surname ?? ''}`, detail: `${t('{n} years', { n: Math.floor(c.age) })} · ${t(c.activity)}`, warn: c.hunger < 25 || c.health < 50 };
      }),
      actions: [
        {
          label: city.id === this.eco.active ? `✓ ${t('Active City (building from this city)')}` : t('Set as active city (build from here)'),
          icon: 'buildings' as const,
          active: city.id === this.eco.active,
          onClick: () => {
            this.eco.active = city.id;
            this.refreshInspector();
            this.refreshHud();
            this.hud?.toast(t('Now building for {name}', { name: city.name }));
          },
        },
        ...(mayor ? [{ label: t('Show the mayor'), icon: 'people' as const, onClick: () => this.select({ type: 'person', id: mayor.id }) }] : []),
        {
          label: `${t('Buy {n} stone', { n: MERCHANT.stone.amount })} · $${MERCHANT.stone.price}`, icon: 'stone' as const,
          onClick: () => this.buyMaterial(city, 'stone'),
        },
        {
          label: `${t('Buy {n} wood', { n: MERCHANT.wood.amount })} · $${MERCHANT.wood.price}`, icon: 'wood' as const,
          onClick: () => this.buyMaterial(city, 'wood'),
        },
        {
          label: `${t('Buy {n} iron', { n: MERCHANT.iron.amount })} · $${MERCHANT.iron.price}`, icon: 'iron' as const,
          onClick: () => this.buyMaterial(city, 'iron'),
        },
        ...(city.taxRate > 0.1 ? [{ label: t('Tax −5%'), onClick: () => { city.taxRate = Math.round((city.taxRate - 0.05) * 100) / 100; this.refreshInspector(); } }] : []),
        ...(city.taxRate < 0.4 ? [{ label: t('Tax +5%'), onClick: () => { city.taxRate = Math.round((city.taxRate + 0.05) * 100) / 100; this.refreshInspector(); } }] : []),
        ...this.tradeActions(city),
        ...(hasBank && city.loan + LOAN.step <= LOAN.max ? [{
          label: `${t('Take loan')} $${LOAN.step}`, icon: 'coin' as const,
          onClick: () => { city.loan += LOAN.step; city.money += LOAN.step; this.refreshInspector(); this.refreshHud(); },
        }] : []),
        ...(city.loan > 0 ? [{
          label: `${t('Repay')} $${Math.min(LOAN.step, city.loan)}`, icon: 'coin' as const,
          onClick: () => {
            const pay = Math.min(LOAN.step, city.loan);
            if (city.money < pay) return this.hud?.toast(t('Not enough money — needs ${n}', { n: pay }));
            city.loan -= pay; city.money -= pay; this.refreshInspector(); this.refreshHud();
          },
        }] : []),
        {
        label: t('Rename'),
        onClick: () => {
          try {
            const name = window.prompt(t('City name'), city.name);
            if (name && name.trim()) { city.name = name.trim().slice(0, 22); this.refreshInspector(); this.refreshHud(); }
          } catch { /* prompt blocked in an iframe */ }
        },
      }],
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
    this.lights.setLit(main.map((tl) => idx(tl.x, tl.z)), true);
    this.net.buildPath(side, ROAD_TWO_LANE);
    this.terrain.clearTiles([...main, ...side].map((tl) => idx(tl.x, tl.z)));

    const capital = this.eco.found(townName(), START_GRANT);
    const put = (kind: BuildingKind, x: number, z: number) => {
      if (!this.buildings.footprint(kind, x, z).every((f) => inBounds(f.x, f.z) && this.map.isLand(idx(f.x, f.z)) && this.buildings.occ[idx(f.x, f.z)] === -1 && !this.net.type[idx(f.x, f.z)])) return null;
      const b = this.buildings.place(kind, x, z, { animate: false, city: capital.id });
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
    let quarry: Tile | null = null, quarryD = Infinity;
    for (let z = c - 34; z <= c + 34; z++) for (let x = c - 34; x <= c + 34; x++) {
      const d = Math.abs(x - c) + Math.abs(z - c);
      if (d >= quarryD || !inBounds(x, z) || !this.buildings.check('quarry', x, z).ok) continue;
      quarry = { x, z };
      quarryD = d;
    }
    if (quarry) put('quarry', quarry.x, quarry.z);

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
    if (s.lit) this.lights.setLit(s.lit, true);
    this.railway.deserialize(s.rails);
    this.footpaths.deserialize(s.footpaths);
    this.canals.deserialize(s.canals);
    this.terrain.clearTiles(s.cleared);
    this.terrain.loadStumps(s.stumps);
    for (const b of s.buildings) {
      const nb = this.buildings.place(b.kind, b.x, b.z, { stored: b.stored, animate: false, id: b.id, city: b.city, built: b.built, level: b.level, owner: b.owner });
      if (b.cropT !== undefined) nb.cropT = b.cropT;
      if (b.parent !== undefined) nb.parent = b.parent;
      if (b.cattleCount !== undefined) nb.cattleCount = b.cattleCount;
    }
    // extensions first, then the graves (they may lie in an extension)
    for (const b of this.buildings.list) {
      const p = b.parent !== undefined ? this.buildings.get(b.parent) : undefined;
      if (p) (p.ext ??= []).push(b.id);
    }
    for (const b of s.buildings) {
      const nb = this.buildings.get(b.id);
      if (nb && b.graves) for (const g of b.graves) this.buildings.addGrave(nb, g);
    }
    this.pop.deserialize(s.population);
    this.eco.load(s.eco);
    this.time = s.time ?? 0;
    this.sandbox = !!s.sandbox;
    this.goals.load(s.goals);
    this.life.leisure.deserialize(s.leisure);
    this.savedLog = s.log ?? [];
    this.history.samples = s.history ?? [];
    this.cam.setState(s.cam.x, s.cam.z, s.cam.yaw, s.cam.view);
    this.pop.planDay();
    const tod = this.eco.timeOfDay;
    for (const c of this.pop.citizens.values()) if (c.leaveAt < tod) c.leaveAt = tod + Math.random() * 0.05;
  }

  private toSave(): WorldSave {
    const e = this.eco;
    this.meta = { ...this.meta, day: e.day, population: this.pop.size, money: Math.floor(e.money), score: this.score(), calm: this.calm };
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
        id: b.id, kind: b.kind, city: b.city, x: b.x, z: b.z, cropT: b.cropT,
        stored: Math.round(b.stored + (b.kind === 'quarry' ? b.trucks * QUARRY.truckLoad * 0.5 : 0)),
        graves: b.graves, cattleCount: b.cattleCount,
        built: b.built < 1 ? Math.round(b.built * 1000) / 1000 : undefined, parent: b.parent, level: b.level > 1 ? b.level : undefined, owner: b.owner >= 0 ? b.owner : undefined,
      })),
      population: this.pop.serialize(),
      cam: { x: this.cam.target.x, z: this.cam.target.z, yaw: this.cam.yaw, view: this.cam.viewHalf },
      time: this.time,
      sandbox: this.sandbox,
      history: this.history.samples,
      goals: this.goals.save(),
      lit: [...this.lights.lit.keys()].filter((k) => this.lights.lit[k]),
      rails: this.railway.serialize(),
      calm: this.calm,
      leisure: this.life.leisure.serialize(),
      log: (this.eventLog?.entries ?? this.savedLog).slice(-80),
    };
  }
}

function barColor(v: number) {
  return v > 0.6 ? '#7be08f' : v > 0.3 ? '#f2b33d' : '#ff6b5e';
}

function costText(money: number, stone: number, wood: number, iron = 0) {
  const parts = [`$${money}`];
  if (stone) parts.push(t('{n} stone', { n: stone }));
  if (wood) parts.push(t('{n} wood', { n: wood }));
  if (iron) parts.push(t('{n} iron', { n: iron }));
  return parts.join(' + ');
}
