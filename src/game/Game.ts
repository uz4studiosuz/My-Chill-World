import * as THREE from 'three';
import { UPGRADABLE, canUpgrade, levelMult, seatsOf, upgradeCost, waterOf } from '../buildings/Upgrades';
import { believer } from './Leisure';
import { SKIN, SHIRTS, DRESSES } from '../models/people/_shared';
import { DAY_SECONDS, DAYS_PER_YEAR, IS_TOUCH, MAP_SIZE } from '../config';
import { DIRS, N, Tile, idx, inBounds, tileToWorld } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { generateWorld } from '../world/WorldGen';
import { Terrain } from '../world/Terrain';
import { walkPath } from '../people/WalkPath';
import { Platform } from '../platform/Platform';
import { BRIDGE_COST, ROAD_COST, ROAD_TWO_LANE, ROUNDABOUT_COST, RoadNetwork, isRingMid } from '../roads/RoadNetwork';
import { RoadMesh } from '../roads/RoadMesh';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { Buildings, Building, rotToDir, SIDES } from '../buildings/Buildings';
import { box, merge, shape } from '../utils/voxel';
import { STORAGE, PENSION, BUS, CONCERT, CAR_PRICE, DEGREE_JOBS, SERVICE_FEE, TRADE_PRICE, BUILD_DAYS, VISIT_PRICE, SHOP_PRICE, POLLUTERS, CROPS, CropKind, BUILDINGS, BUSINESS_KINDS, CARS, JOB_PRIORITY, LAMP, RAIL_COST, RENT, MAX_GRAVES_PER_CEMETERY as GRAVES_PER_PLOT, BuildingKind, CEMETERY_UPGRADE, CITY_MIN_DISTANCE, LOAN, GRAVE_COST, MAX_GRAVES_PER_CEMETERY, QUARRY, AIR_TRADE, PIPE_COST, POLICE_RANGE, FIRE_RANGE, MILITARY, TRASH, TOURISM, FOOTBALL, CINEMA, DECOR, DECOR_RANGE, PATH_COST, BIKE, TUNNEL_COST } from '../buildings/BuildingTypes';
import { City, Economy, NEW_CITY_GRANT, START_GRANT } from '../sim/Economy';
import { History } from '../sim/History';
import { monthOf, seasonBlend, seasonOf, yearOf, growingSeason, dateLabel, calendarYear } from '../sim/Calendar';
import { Population, Citizen, Family } from '../people/Population';
import { clanName, firstName, townName } from '../people/names';
import { sound } from '../audio/Sound';
import { GoalContext, Goals } from '../sim/Goals';
import { GoalsPanel } from '../ui/GoalsPanel';
import { Tutorial, TutorialContext } from '../ui/Tutorial';
import { EventLog, LogEntry } from '../ui/EventLog';
import { BuildingList } from '../ui/BuildingList';
import { Guide } from '../ui/Guide';
import { StreetLights } from '../roads/StreetLights';
import { Railway, Station } from '../rail/Railway';
import { Newspaper } from '../ui/Newspaper';
import { Walker, Walkers } from '../people/Walkers';
import { Traffic, Vehicle } from '../traffic/Traffic';
import { Animals } from '../animals/Animals';
import { Effects } from '../fx/Effects';
import { Weather } from '../fx/Weather';
import { Life, PROMISE_TEXT } from './Life';
import { nightLevel } from '../fx/NightGlow';
import { PetitionsPanel } from '../ui/Petitions';
import { LifeBook } from '../ui/LifeBook';
import { uiBusy } from '../ui/dom';
import { ResourcePanel, ResourceSection, ResourceView } from '../ui/ResourcePanel';
import type { Res } from '../sim/Economy';
import { Airports } from './Airports';
import { Overlays, Problem } from '../fx/Overlays';
import { WaterLife } from '../fx/WaterLife';
import { Trade, Good, GOOD_NAME, GOODS } from './Trade';
import { AutoCity, findTownSite, TOWN_TINTS, TOWN_STYLES, STYLE_NAME } from './AutoCity';

/** A millionaire may found a town: the money needed, what the town hall and first streets cost, what the family keeps. */
const FOUND = { money: 25000, cost: 12000, keep: 2000 };
import { WorldPanel, WorldTown } from '../ui/WorldPanel';
import { CityReport, CityReportView, ReportSection } from '../ui/CityReport';
import { mulberry32 } from '../utils/rng';
import { TradePanel } from '../ui/TradePanel';
import { DECISIONS, Decision, DecisionCtx } from './Decisions';
import { DecisionPanel } from '../ui/DecisionPanel';
import { Pipes } from '../paths/Pipes';
import { DriveMode } from './DriveMode';
import { CameraRig } from '../camera/CameraRig';
import { Preview } from '../build/Preview';
import { BuildTool, CheckResult, GhostInfo, LineKind, PlaceKind, ToolHost, ToolId } from '../build/BuildTool';
import { InputController } from '../input/InputController';
import { Hud , ITEMS } from '../ui/Hud';
import { Inspector, InspectorView } from '../ui/Inspector';
import { StatsPanel, StatsSnapshot } from '../ui/StatsPanel';
import { SAVE_VERSION, SaveStore, WorldMeta, WorldSave } from '../save/SaveStore';
import { t } from '../i18n/i18n';

export interface GameOptions {
  /** Background world for the main menu: no input, no HUD, no saving. */
  demo?: boolean;
  save?: WorldSave;
  create?: { name: string; seed: number; calm?: boolean; towns?: number };
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
const FOG_GREY = new THREE.Color('#c9d1d8');
const SNOW_FOG = new THREE.Color('#eef2f6');
const HEAT_HAZE = new THREE.Color('#f2dcb0');
const HEMI_DAY = new THREE.Color('#e4f1ff');
const HEMI_NIGHT = new THREE.Color('#6d80b8');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
const LAYER_NOTE = {
  power: 'Electricity: green = powered, amber = on the grid but short of power, red = no road link to a power plant, yellow = plants',
  water: 'Water: green = clean water, amber = not enough, red = none (lay pipes or build a water tower)',
  happy: 'Happiness by home: green = happy, amber = so-so, red = unhappy (tap a home to see why)',
} as const;

/** Electricity in kilowatts (1 energy unit = 1 kW), megawatts from 1000. */
const kw = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} ${t('MW')}` : `${Math.round(v * 10) / 10} ${t('kW')}`);

const KIND_BADGE: Record<BuildingKind, [string, string]> = {
  townhall: ['🏛️', '#3567c4'], house: ['🏠', '#c4553d'], office: ['🏢', '#4a7fb5'], school: ['🏫', '#d9714a'],
  parking: ['🅿️', '#2f6fd6'], weddinghall: ['💒', '#d97a9a'], watertower: ['💧', '#4a8fbd'], quarry: ['⛏️', '#8d8a83'],
  woodcutter: ['🪓', '#8a5a35'], powerplant: ['⚡', '#a65e43'], farm: ['🌾', '#b8952f'], orchard: ['🍎', '#4f8a3a'], ranch: ['🐄', '#7a5a3c'],
  cemetery: ['🪦', '#4a4f57'], police: ['🚓', '#2d4f8a'], kindergarten: ['🧸', '#e8738f'], hotel: ['🏨', '#7d4a3a'], windturbine: ['🌬️', '#6fb6ff'], solarfarm: ['☀️', '#25406e'], trainstation: ['🚉', '#c98a5a'], apartment: ['🏢', '#8a6f5a'], cemeteryext: ['🪦', '#4a4f57'], ironmine: ['⚒️', '#7a5a4a'], fishery: ['🎣', '#3a7fb5'], firestation: ['🚒', '#c4553d'], busdepot: ['🚌', '#d9a92a'], busstop: ['🚏', '#3a6fd1'], grocery: ['🥖', '#4c9a52'], clothes: ['👕', '#b0478f'], park: ['🌳', '#4f8a3a'], hospital: ['🏥', '#d9443b'], university: ['🎓', '#7d4a3a'],
  market: ['🛒', '#c98a3a'], carmarket: ['🚗', '#3a6fd1'], bank: ['🏦', '#b8952f'], gasstation: ['⛽', '#d9443b'],
  factory: ['🏭', '#6f7880'], carfactory: ['🚘', '#4a7fb5'], construction: ['🏗️', '#e8a33a'],
  pharmacy: ['💊', '#2e8b57'], dairy: ['🧀', '#3a6fd1'], supermarket: ['🛒', '#d9443b'], brickworks: ['🧱', '#a65e43'], steelmill: ['🏭', '#5d6670'], sewage: ['🚰', '#5f8fa0'], coalmine: ['⛏️', '#26292e'], coalplant: ['🏭', '#9aa3ab'], hydro: ['🌊', '#4fa3d1'],
  tower15: ['🏢', '#c4553d'], tower30: ['🏢', '#3f6fb5'], tower50: ['🏙️', '#4f7d4a'], warehouse: ['📦', '#b9845a'], bikefactory: ['🚲', '#d9443b'], migration: ['🛂', '#3f6fb5'], concerthall: ['🎻', '#8a3a4a'], casino: ['🎰', '#3b2a55'], mosque: ['🕌', '#2f7fc1'], themepark: ['🎡', '#d9443b'], bigpark: ['🌳', '#4f8a3a'], gym: ['🏋️', '#f07167'], teahouse: ['🫖', '#2f7fc1'], barber: ['💈', '#d9443b'],
  military: ['🪖', '#6b7a4a'], landfill: ['🗑️', '#7a6f5a'], recycling: ['♻️', '#4c9a52'], mill: ['🌾', '#c9b88a'], bakery: ['🍞', '#a65e43'], sawmill: ['🪚', '#8a5a35'], battery: ['🔋', '#3a6fd1'], kiosk: ['☕', '#d9443b'],
  airport: ['✈️', '#3a6fd1'], stadium: ['⚽', '#4f9a3e'], cinema: ['🎬', '#b0478f'], academy: ['🏛️', '#2d4f8a'], playground: ['🛝', '#e85a3a'], fountain: ['⛲', '#4fa3d1'],
  flowerbed: ['🌷', '#e85a7a'], statue: ['🗿', '#9a7b4f'], gazebo: ['⛱️', '#8a5a35'], pond: ['🦆', '#4a95cf'], clocktower: ['🕰️', '#b9654a'], flagpole: ['🚩', '#4f9a3e'], planter: ['🪴', '#e85a7a'], archway: ['⛩️', '#3f86c4'], bench: ['🪑', '#8a5a35'], lamppost: ['💡', '#d9a92a'], sapling: ['🌳', '#4f8a3a'], roadsign: ['🚸', '#3a6fd1'],
};

const PROFESSIONS: Partial<Record<BuildingKind, [string, string?]>> = {
  townhall: ['Civil servant'], office: ['Clerk', 'Manager'], school: ['School staff', 'Teacher'], university: ['University staff', 'Professor'],
  warehouse: ['Storekeeper'], bikefactory: ['Bicycle maker', 'Engineer'], migration: ['Migration officer', 'Office manager'], concerthall: ['Stage hand', 'Conductor'], casino: ['Croupier', 'Casino manager'], mosque: ['Muezzin', 'Imam'], themepark: ['Ride operator', 'Park manager'], bigpark: ['Gardener'], gym: ['Fitness coach'], teahouse: ['Waiter', 'Cook'], barber: ['Barber', 'Stylist'],
  hospital: ['Nurse', 'Doctor'], market: ['Seller'], carmarket: ['Car salesman'], bank: ['Cashier', 'Banker'], gasstation: ['Pump attendant'],
  factory: ['Factory worker', 'Engineer'], carfactory: ['Auto assembler', 'Engineer'], construction: ['Builder', 'Site foreman'],
  farm: ['Farmer'], orchard: ['Fruit grower'], ranch: ['Herdsman'], woodcutter: ['Lumberjack'],
  powerplant: ['Power operator', 'Power engineer'], watertower: ['Water technician'], weddinghall: ['Registrar'], park: ['Gardener'],
  police: ['Police officer', 'Police chief'], kindergarten: ['Nanny', 'Teacher'], hotel: ['Hotel clerk', 'Hotel manager'], windturbine: ['Technician', 'Power engineer'], solarfarm: ['Technician', 'Power engineer'], trainstation: ['Railway worker', 'Station master'], ironmine: ['Miner', 'Mining engineer'], fishery: ['Fisherman'], quarry: ['Quarryman'], firestation: ['Firefighter'], busdepot: ['Bus driver'], airport: ['Airport staff', 'Pilot'], military: ['Soldier', 'Officer'], pharmacy: ['Pharmacist'], dairy: ['Dairy worker', 'Cheese maker'], supermarket: ['Cashier', 'Store manager'], brickworks: ['Brick maker'], steelmill: ['Steelworker', 'Engineer'], sewage: ['Plant operator'], coalmine: ['Coal miner'], coalplant: ['Power operator', 'Power engineer'], hydro: ['Dam operator', 'Power engineer'], landfill: ['Garbage collector'], recycling: ['Recycling worker', 'Engineer'], mill: ['Miller'], bakery: ['Baker'], sawmill: ['Sawyer'], battery: ['Technician'], kiosk: ['Barista'], stadium: ['Groundskeeper', 'Football coach'], cinema: ['Projectionist'], academy: ['Coach', 'Academician'], grocery: ['Shop assistant'], clothes: ['Shop assistant', 'Tailor'], cemetery: ['Gravedigger'], parking: ['Parking attendant'],
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
  private buildingList?: BuildingList;
  private petitions?: PetitionsPanel;
  private lifeBook?: LifeBook;
  private decision?: DecisionPanel;
  private decisionDay = 0;
  /** Photo mode: the interface is hidden; `shotPending` asks the renderer to save the next frame. */
  photoMode = false;
  shotPending = false;
  private photoBar?: HTMLDivElement;
  private resPanel?: ResourcePanel;
  /** Map layer shown over the town: electricity, water or happiness. */
  mapLayer: 'none' | 'power' | 'water' | 'happy' = 'none';
  readonly trade = new Trade();
  private autoCity!: AutoCity;
  private worldPanel?: WorldPanel;
  private cityReport?: CityReport;
  /** Each town day by day (people, treasury, happiness) for the World window and the city report. */
  private worldHistory = new Map<number, { day: number; pop: number; money: number; happy: number }[]>();
  /** Price of every good in every town, one value per day (the last 30 days). */
  private priceHistory = new Map<number, Record<string, number[]>>();
  /** Which pairs of towns are joined by road (for people working in another town); cleared when roads change. */
  private commuteCache = new Map<string, boolean>();
  /** Road network changed by a neighbour town: rebuilt soon (not on every single tile). */
  private netPending = false;
  private netAt = 0;
  /** What happened between each neighbour town and the player: deals, gifts, letters (newest first). */
  private dealings = new Map<number, { day: number; text: string; money: number }[]>();
  private tradePanel?: TradePanel;
  private airports!: Airports;
  private overlays = new Overlays();
  private waterLife!: WaterLife;
  private pipes = new Pipes();
  private overlayT = 0;
  private prevTod = 0;
  private fogLevel = 0;
  private drive!: DriveMode;
  /** Flights and trade per airport today (for the inspector). */
  private airLog = new Map<number, { flights: number; last: string }>();
  private petitionTick = 0;
  /** Family opened inside an apartment block's panel. */
  private aptFamily: number | null = null;
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
  private adPaused = false;
  /** Game day of the last investors' grant (one a day). */
  private grantDay = -1;
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
      pipes: this.pipes.tiles,
    });
    this.grid = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, '#2d3a22', '#2d3a22');
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.12;
    this.grid.position.y = 0.005;
    this.grid.visible = false;
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd166', depthTest: false }));
    this.marker.renderOrder = 30;
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
    this.buildings.siteLabel = (b) => {
      const crew = this.life.crewSize(b);
      if (crew) return { text: t('{n} builders at work', { n: crew }), ok: true };
      const why = this.life.siteProblem(b);
      return { text: why ? t(why) : t('Building…'), ok: !why || why === 'Builders are on their way' };
    };
    this.buildings.onBuilt = (b) => {
      this.effects.puff(b.mesh.position.x, b.mesh.position.z, BUILDINGS[b.kind].size * 0.6, 16, ['#f2e6c4', '#ffffff', '#c9b88a']);
      this.pop.assign(this.buildings);
      this.life.rebuildGrid();
      this.footpaths.rebuild((k) => this.net.type[k] !== 0);
      this.life.events.push(t('{name} is finished', { name: t(BUILDINGS[b.kind].name) }));
      if (b.kind === 'fishery' || b.kind === 'townhall') this.waterLife.rebuild();
      sound.play('complete', b.mesh.position);
    };
    this.cam = new CameraRig(canvas);

    this.pop.priority = (b) => {
      const o = this.eco.cities.get(b.city)?.jobPriority[b.kind];
      return o === 'high' ? 0 : o === 'low' ? 7 : JOB_PRIORITY[b.kind] ?? 5;
    };
    this.pop.wageFactor = (b) => (b.owner >= 0 && b.wageF !== undefined ? b.wageF : this.eco.cities.get(b.city)?.wages[b.kind] ?? 1);
    // people may work in another town when a road joins the two town halls
    this.pop.commute = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      let ok = this.commuteCache.get(key);
      if (ok === undefined) {
        ok = this.roadLinked(a, b) || this.footLinked(a, b);
        this.commuteCache.set(key, ok);
      }
      return ok;
    };
    this.life.streetRoom = (id, k, x, z) => !this.eco.cities.get(id)?.ai || !this.autoCity || this.autoCity.leavesRoom(id, k, x, z);
    // the builders find the road being laid in their town
    this.life.roadSite = (cityId) => { const job = this.roadJobs.find((j) => j.city === cityId); return job ? this.roadSiteOf(job) : null; };
    this.life.onForeign = (id, msg) => { const c = this.eco.cities.get(id); if (c) this.autoCity?.note(c, msg); };
    this.buildings.tintOf = (id) => this.eco.cities.get(id)?.tint;
    // the town hall keeps some goods; every warehouse keeps much more
    this.eco.capacity = (city, res) => {
      const n = this.buildings.list.reduce((a, b) => a + (b.kind === 'warehouse' && b.city === city.id && b.built >= 1 ? 1 : 0), 0);
      return res === 'food' ? STORAGE.hallFood + n * STORAGE.warehouseFood : STORAGE.hall + n * STORAGE.warehouse;
    };
    this.autoCity = new AutoCity({
      eco: this.eco, buildings: this.buildings, net: this.net, map: this.map,
      people: (id) => this.life.populationByCity().get(id) ?? 0,
      freeHomes: (id) => this.life.freeHomes(id).length,
      isWatered: (x, z, size) => this.canals.watered(x, z, size),
      digCanal: (farm) => { this.digStarterCanal(farm); this.life.rebuildGrid(); },
      demolish: (b) => { this.destroyBuilding(b, true); this.netPending = true; },
      irrigated: (b) => this.canals.watered(b.x, b.z, BUILDINGS[b.kind].size) || b.irrigated,
      treesNear: (x, z, r) => this.terrain.treesNear(x, z, r),
      isBlocked: (k) => !!this.footpaths.tiles[k] || !!this.canals.tiles[k] || !!this.railway.tiles[k],
      clearTiles: (ks) => this.terrain.clearTiles(ks),
      networkChanged: () => { this.netPending = true; },
      say: () => { /* big neighbour news stay in the neighbours' chronicle */ },
      happiness: (id) => this.eco.cities.get(id)?.happiness ?? 50,
      linkRoad: (c) => this.linkTown(c),
      sanitation: (id) => this.life.sanitation.get(id) ?? 1,
      expandCemetery: (b) => !!this.upgradeCemetery(b),
      upgrade: (b) => this.upgradeBuilding(b, true),
      pupils: (id) => { let n = 0; for (const c of this.pop.citizens.values()) if (c.school === id) n++; return n; },
      lightRoads: (c, n) => {
        // the town's unlit streets nearest its hall get lamps first
        const hall = this.buildings.townHall(c.id);
        if (!hall) return 0;
        const tiles: { k: number; d: number }[] = [];
        for (let z = hall.z - 30; z <= hall.z + 30; z++) for (let x = hall.x - 30; x <= hall.x + 30; x++) {
          if (!inBounds(x, z)) continue;
          const k = idx(x, z);
          if (!this.net.type[k] || this.lights.lit[k]) continue;
          if (this.buildings.halls().reduce((best, h) => (Math.abs(h.x - x) + Math.abs(h.z - z) < Math.abs(best.x - x) + Math.abs(best.z - z) ? h : best), hall).city !== c.id) continue;
          tiles.push({ k, d: Math.abs(x - hall.x) + Math.abs(z - hall.z) });
        }
        tiles.sort((a, b) => a.d - b.d);
        const pick = tiles.slice(0, n).map((x) => x.k);
        const cost = pick.length * 15;
        if (!pick.length || c.money < cost + 2000) return 0;
        this.eco.add(c, 'money', -cost, 'Street lamps');
        this.lights.setLit(pick, true);
        this.networkChanged();
        return pick.length;
      },
      buyGoods: (c, g, n) => this.buyFromTowns(c, g, n).n,
      sellGoods: (c, g, n) => this.sellToTowns(c, g, n),
      richest: (id) => [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === id)
        .sort((a, b) => b.money - a.money).slice(0, 3).map((f) => ({ name: f.surname, money: f.money })),
    });
    this.railway.onArrive = (from, to) => this.trainArrived(from, to);
    this.railway.canRun = (s) => { for (const c of this.pop.citizens.values()) if (c.job === s.id && c.state === 'away' && c.at === s.id) return true; return false; };
    this.airports = new Airports(this.buildings);
    this.airports.onLanded = (b, from) => this.planeLanded(b, from);
    this.drive = new DriveMode({ map: this.map, net: this.net, buildings: this.buildings, traffic: this.traffic });
    this.drive.onExit = () => {
      if (this.input) this.input.enabled = true;
      document.body.classList.remove('pov-mode');
      this.cam.apply();
    };
    this.pop.jobKind = (id) => this.buildings.get(id)?.kind;
    this.life.onMoney = (cityId, amount) => { if (cityId === this.eco.active) this.hud?.flashMoney(amount); };
    this.calm = !!(opts.save?.calm ?? opts.create?.calm);
    this.life.calm = this.calm;
    if (opts.save) this.loadSave(opts.save);
    else this.buildStarterTown(opts.create?.towns ?? 2);
    this.wantTutorial = !!opts.create && Tutorial.wanted();

    this.waterLife = new WaterLife(this.map,
      () => this.buildings.list.filter((b) => b.kind === 'townhall').map((b) => ({ x: b.x, z: b.z })),
      () => this.buildings.list.filter((b) => b.kind === 'fishery').map((b) => ({ x: b.x, z: b.z, id: b.id })));
    // the fisherman on the boat is the real worker on duty at the hut
    this.waterLife.crewOf = (id) => {
      const hut = this.buildings.get(id);
      const c = hut && hut.workers > 0 ? this.life.staffOnDuty(hut)[0] : undefined;
      return c ? c.variant : -1;
    };
    this.life.leisure.iceSpots = () => this.waterLife.iceSpots;
    this.animals = new Animals(this.map, (k) => this.map.isLand(k) && !this.net.type[k] && !this.net.isIsland(k) && this.buildings.occ[k] === -1);
    this.scene.add(
      this.terrain.group, this.roadMesh.group, this.footpaths.mesh, this.canals.mesh, this.pipes.mesh, this.buildings.group, this.traffic.group,
      this.walkers.group, this.lights.group, this.railway.group, this.animals.group, this.effects.group, this.weather.group, this.preview.mesh, this.preview.ghostGroup, this.grid, this.marker, this.ring, this.beam,
      this.life.leisure.group, this.povCam, this.airports.group, this.drive.group, this.overlays.group, this.waterLife.group,
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
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.pov) this.exitPov();
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'KeyP') this.togglePhoto();
      if (this.photoMode && e.code === 'Enter') this.shotPending = true;
      if (this.photoMode && e.key === 'Escape') this.togglePhoto();
    }, { signal: this.abort.signal });

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
      openResource: (key) => { this.news?.hide(); this.stats?.hide(); this.goalsPanel?.hide(); this.eventLog?.hide(); this.petitions?.hide(); this.resPanel?.toggle(key); },
      openPhoto: () => this.togglePhoto(),
      setLayer: (l) => { this.mapLayer = this.mapLayer === l ? 'none' : l; this.overlayT = 0; this.hud?.setLayer(this.mapLayer); if (this.mapLayer !== 'none') this.hud?.toast(t(LAYER_NOTE[this.mapLayer])); },
      goHome: () => this.goHome(),
      openBuildings: () => { this.stats?.hide(); this.goalsPanel?.hide(); this.eventLog?.hide(); this.buildingList?.toggle(); },
      openWorld: () => { this.resPanel?.hide(); this.stats?.hide(); this.tradePanel?.hide(); this.worldPanel?.toggle(); },
      openTrade: () => { this.resPanel?.hide(); this.stats?.hide(); this.trade.newDay(this.eco.day); this.tradePanel?.toggle(); },
      openDrive: () => (this.drive.active ? this.drive.stop() : this.startDrive()),
      openNews: () => { this.stats?.hide(); this.eventLog?.hide(); this.petitions?.hide(); this.news?.toggle(); },
      openPetitions: () => { this.stats?.hide(); this.goalsPanel?.hide(); this.eventLog?.hide(); this.petitions?.toggle(); },
      toggleSound: () => { const on = !sound.sfxOn; sound.setSfx(on); sound.setNature(on); return on; },
      cycleCity: () => { this.resPanel?.hide(); this.stats?.hide(); this.tradePanel?.hide(); this.worldPanel?.toggle(); },
      confirmBuild: () => this.tool?.confirm(),
      cancelBuild: () => this.tool?.cancel(),
      rotateBuild: () => this.tool?.rotate(),
    }, this.thumbs);
    this.inspector = new Inspector(this.hud.root, () => this.select(null), (id) => this.select({ type: 'person', id }));
    this.stats = new StatsPanel(this.hud.root, () => this.snapshot(), (kind, prio) => {
      const city = this.eco.city;
      if (prio === 'normal') delete city.jobPriority[kind];
      else city.jobPriority[kind] = prio;
      this.pop.assign(this.buildings);
      this.stats?.render();
    }, (kind, step) => {
      // wages: a step changes one job's wage by 10% (and switches to manual); 0 toggles automatic wages
      const city = this.eco.city;
      if (kind === '*') city.wageAuto = !city.wageAuto;
      else {
        city.wageAuto = false;
        // a step is dollars a day: as much as you like, but at least $1
        const base = BUILDINGS[kind as BuildingKind]?.salary ?? 10;
        const pay = Math.max(1, base * (city.wages[kind] ?? 1) + step);
        const w = Math.round((pay / base) * 1000) / 1000;
        if (Math.abs(w - 1) < 0.005) delete city.wages[kind]; else city.wages[kind] = w;
      }
      this.life.updateWageIndex(city);
      this.stats?.render();
    });
    this.goalsPanel = new GoalsPanel(this.hud.root, this.goals, () => this.goalContext());
    const keep = this.eventLog?.entries.slice() ?? this.savedLog;
    this.eventLog = new EventLog(this.hud.root, (d) => dateLabel(d),
      () => [...this.eco.cities.values()].filter((c) => c.ai).flatMap((c) => (this.autoCity.log.get(c.id) ?? []).map((e) => ({ ...e, town: c.name, tint: c.tint ?? '#aab4be' }))));
    this.eventLog.load(keep);
    // every building of the town in one list: a tap flies the camera there and opens it
    this.buildingList = new BuildingList(this.hud.root, () => this.buildingListItems(), (id) => {
      const b = this.buildings.get(id);
      if (!b) return;
      this.cam.flyTo(b.mesh.position.x, b.mesh.position.z, 6);
      this.select({ type: 'building', id: b.id });
    });
    this.guide = new Guide(this.hud.root);
    this.hud.countOf = (tool) => this.buildings.list.filter((b) => b.kind === tool && b.city === this.eco.city.id && !b.removed).length;
    this.tradePanel = new TradePanel(this.hud.root, this.trade, {
      city: () => this.eco.city,
      linked: () => this.buildings.list.some((b) => (b.kind === 'trainstation' || b.kind === 'airport') && b.city === this.eco.city.id && b.built >= 1 && b.workers > 0),
      sell: (g, n) => this.tradeGoods(g, n, true),
      buy: (g, n) => this.tradeGoods(g, n, false),
      neighbours: () => this.neighbours(),
      cars: () => {
        const id = this.eco.city.id;
        const markets = this.buildings.list.filter((b) => b.kind === 'carmarket' && b.city === id && b.built >= 1);
        const have = this.life.carsInMarkets(id);
        return { have, room: markets.length * CARS.marketMax - have, sell: Math.round(CAR_PRICE * 0.75), buy: Math.round(CAR_PRICE * 1.1), market: markets.length > 0 };
      },
      carDeal: (selling) => {
        const city = this.eco.city;
        if (selling) {
          if (this.life.moveCars(city.id, -1) < 1) return;
          this.eco.add(city, 'money', Math.round(CAR_PRICE * 0.75), 'Trade: cars exported');
          this.hud?.toast(t('A car was sold to another region for ${n}', { n: Math.round(CAR_PRICE * 0.75) }));
        } else {
          const price = Math.round(CAR_PRICE * 1.1);
          if (city.money < price || this.life.moveCars(city.id, 1) < 1) return;
          this.eco.add(city, 'money', -price, 'Trade: cars imported');
          this.hud?.toast(t('A car was imported for ${n} — it waits at the car market', { n: price }));
        }
        sound.play('coin');
        this.refreshHud();
      },
      towns: () => [...this.eco.cities.values()].filter((c) => c.ai || c.id === this.eco.city.id).map((c) => ({ id: c.id, name: c.name, tint: c.tint ?? '#f2b33d', mine: !c.ai })),
      history: (id, g) => {
        const c = this.eco.cities.get(id);
        const now = c ? Math.round(this.midPrice(c, g, this.life.populationByCity().get(id) ?? 0) * 10) / 10 : 0;
        return [...(this.priceHistory.get(id)?.[g] ?? []), now];
      },
      carsTo: (id) => {
        const me = this.eco.city, town = this.eco.cities.get(id);
        const nb = this.neighbours().find((x) => x.id === id);
        if (!town || !nb?.carPrice || town.money < nb.carPrice) return;
        if (this.life.moveCars(me.id, -1) < 1) return;
        if (this.life.moveCars(id, 1) < 1) { this.life.moveCars(me.id, 1); return; }
        this.eco.add(town, 'money', -nb.carPrice, 'Trade with neighbour towns');
        this.eco.add(me, 'money', nb.carPrice, 'Trade with neighbour towns');
        town.relation = Math.min(100, (town.relation ?? 40) + 2);
        this.deal(id, t('Sold a car'), nb.carPrice);
        sound.play('coin');
        this.hud?.toast(t('A car was sold to {city} for ${n}', { city: town.name, n: nb.carPrice }));
        this.refreshHud();
      },
      deal: (id, g, n, selling) => this.dealWithTown(id, g, n, selling),
      gift: (id) => {
        const me = this.eco.city, town = this.eco.cities.get(id);
        if (!town || me.food < 50) return;
        this.eco.add(me, 'food', -50, 'Gift to a neighbour town');
        this.eco.add(town, 'food', 50, 'Gift from a neighbour town');
        town.relation = Math.min(100, (town.relation ?? 40) + 8);
        this.deal(town.id, t('Gift: 50 food (relations +8)'), 0);
        sound.play('coin');
        this.hud?.toast(t('{city} thanks you for the gift', { city: town.name }));
      },
    });
    this.worldPanel = new WorldPanel(this.hud.root, () => this.worldView(), (id) => {
      const h = this.buildings.townHall(id);
      if (!h) return;
      this.worldPanel?.hide();
      this.cam.setState(h.mesh.position.x, h.mesh.position.z, this.cam.yaw, Math.max(8, this.cam.viewHalf));
      this.select({ type: 'building', id: h.id });
    }, () => { this.worldPanel?.hide(); this.trade.newDay(this.eco.day); if (!this.tradePanel?.visible) this.tradePanel?.toggle(); }, (id) => {
      this.eco.active = id;
      this.refreshHud();
      this.worldPanel?.render();
      this.hud?.toast(t('Now building for {name}', { name: this.eco.city.name }));
    }, () => this.eco.active, (id) => { this.worldPanel?.hide(); this.cityReport?.open(id); });
    this.cityReport = new CityReport(this.hud.root, (id) => this.cityReportView(id), {
      stats: { el: () => this.stats!.element, open: (page) => (page ? this.stats!.openTab(page) : this.stats!.show()), close: () => this.stats!.hide() },
      trade: { el: () => this.tradePanel!.element, open: () => { this.trade.newDay(this.eco.day); this.tradePanel!.open(); }, close: () => this.tradePanel!.hide() },
    });
    this.cityReport.onClose = () => { const s = this.selection; if (s?.type === 'building' && this.buildings.get(s.id)?.kind === 'townhall') this.select(null); };
    this.resPanel = new ResourcePanel(this.hud.root, (key) => this.resourceView(key));
    this.decision = new DecisionPanel(this.hud.root);
    this.lifeBook = new LifeBook(this.hud.root, (d) => dateLabel(d));
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
    this.news.onUnread = (n) => this.hud?.setBadge('news', n);
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
    this.drive?.resize(w / Math.max(1, h));
    this.povCam.updateProjectionMatrix();
  }

  /** The camera to render with (first-person view or the normal map view). */
  get viewCamera(): THREE.Camera { return this.drive?.active ? this.drive.camera : this.pov ? this.povCam : this.cam.camera; }

  /** Take the wheel: from a vehicle on the road, or on a street next to the active Town Hall. */
  startDrive(from?: { x: number; z: number; heading: number; color?: THREE.Color }) {
    if (!this.hud) return;
    if (!from) {
      const hall = this.buildings.townHall(this.eco.active) ?? this.buildings.list.find((b) => b.kind === 'townhall');
      let best = -1, bd = Infinity;
      for (let k = 0; k < this.net.type.length; k++) {
        if (!this.net.type[k] || this.net.isIntersection(k)) continue;
        const x = k % N, z = (k / N) | 0;
        const d = hall ? Math.abs(x - hall.x) + Math.abs(z - hall.z) : Math.abs(x - N / 2) + Math.abs(z - N / 2);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) { this.hud.toast(t('Build a road first')); return; }
      const x = best % N, z = (best / N) | 0;
      const ns = (this.net.conn[best] & 5) !== 0;
      from = { x: tileToWorld(x) + (ns ? 0.19 : 0), z: tileToWorld(z) + (ns ? 0 : -0.19), heading: ns ? 0 : Math.PI / 2 };
    }
    this.exitPov();
    this.select(null);
    this.setTool('pan');
    if (this.input) this.input.enabled = false;
    document.body.classList.add('pov-mode');
    this.drive.start(from.x, from.z, from.heading, this.hud.root, from.color);
  }

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

  /** Hide the person we look through (only one at a time). */
  private hideInPov(w?: Walker) {
    if (this.povHidden && this.povHidden !== w) this.povHidden.hidden = false;
    this.povHidden = w;
    if (w) w.hidden = true;
  }

  exitPov() {
    if (!this.pov) return;
    this.hideInPov(undefined);
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
        this.hideInPov(w);
        x = w.x; z = w.z; hx = w.hx; hz = w.hz; y = 0.16 * w.scale;
      } else {
        // indoors: stand at the door and look out to the street until they come out again
        const b = this.buildings.get(c.at) ?? this.buildings.get(this.pop.families.get(c.family)?.home ?? -1);
        if (!b) return this.exitPov();
        label = `${c.name} · ${t('inside: {name}', { name: t(BUILDINGS[b.kind].name) })} · ${t(c.activity)}`;
        // stand in the street in front of the building and look at it, like waiting for them to come out
        const d = this.buildings.door(b);
        const dx = d.x - b.mesh.position.x, dz = d.z - b.mesh.position.z, l = Math.hypot(dx, dz) || 1;
        const back = 0.55 + BUILDINGS[b.kind].size * 0.35;
        hx = -dx / l; hz = -dz / l; x = d.x - hx * back; z = d.z - hz * back; y = 0.17;
      }
    } else return this.exitPov();
    if (Number.isNaN(this.povPos.x)) this.povDir.set(hx, 0, hz);
    // the eyes stay exactly on the person (a lagging camera would end up behind their head)
    const jump = Number.isNaN(this.povPos.x) || this.povPos.distanceTo(this.povTmp.set(x, y, z)) > 1.5;
    if (jump) this.povPos.set(x, y, z);
    else this.povPos.lerp(this.povTmp.set(x, y, z), Math.min(1, dt * 30));
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
  private povHidden?: Walker;

  update(dt: number) {
    // fast speeds are split into small steps so cars, walkers and the economy stay stable
    const total = this.menuPaused || this.adPaused ? 0 : dt * this.speed;
    const stepLen = this.speed >= 100 ? 0.4 : this.speed >= 20 ? 0.3 : 0.2;
    const steps = total > 0 ? Math.min(40, Math.ceil(total / stepLen)) : 1;
    const sdt = total / steps;
    const frameStart = performance.now();
    // mountains dug away by the mines: the ground is redrawn now and then
    this.terrain.flushReshape(frameStart);
    // the neighbour towns' new streets and buildings: the road network is rebuilt at most a few times a second
    if (this.netPending && frameStart - this.netAt > 300) { this.netPending = false; this.netAt = frameStart; this.networkChanged(false); }
    this.traffic.setParked(this.life.parkedCars());
    this.walkers.standingBikes = this.life.factoryBikes();
    for (let i = 0; i < steps; i++) {
      if (sdt > 0) {
        this.time += sdt;
        this.life.update(sdt);
        this.advanceRoads(sdt);
        this.autoCity.update(sdt);
        this.animals.update(sdt);
        this.history.update(sdt, () => ({
          t: this.time, day: this.eco.day, pop: this.pop.size, employed: this.pop.counts().workers,
          money: Math.round(this.eco.totalMoney), stone: Math.round(this.eco.totalStone), food: Math.round(this.eco.totalFood),
          wood: Math.round(this.eco.totalWood), energy: Math.round(this.eco.powered * 100),
          cars: this.traffic.count('car'), trucks: this.traffic.count('truck'), walkers: this.walkers.list.length,
          animals: this.animals.list.length, happy: Math.round(this.eco.city.happiness), iron: Math.round([...this.eco.cities.values()].reduce((a, c) => a + c.iron, 0)),
        }));
        this.chimneySmoke(sdt);
        this.dayRhythm();
        if (this.eco.day !== this.lastDay) this.onNewDay();
      }
      this.traffic.update(sdt);
      this.walkers.update(sdt);
      this.railway.update(sdt);
      this.airports.update(sdt);
      this.buildings.update(i === 0 ? dt : 0, sdt, DAY_SECONDS, growingSeason(monthOf(this.eco.day)), (b) => this.life.buildSpeed(b));
      // out of time for this frame: skip the rest of it rather than freeze the screen
      if (i < steps - 1 && performance.now() - frameStart > 24) break;
    }
    this.festivities(dt);
    this.waterLife.update(total > 0 ? Math.min(dt * this.speed, 0.5) : 0, this.terrain.frozen, seasonOf(monthOf(this.eco.day)) === 'summer', this.nightness);
    this.effects.update(dt);
    this.weather.update(dt, total, this.eco.timeOfDay, this.cam.target, this.cam.viewHalf);
    this.seasonT -= dt;
    if (this.seasonT <= 0) {
      this.seasonT = 0.4;
      this.terrain.applySeason(seasonBlend(this.eco.day, this.eco.timeOfDay));
    }
    this.updateLighting();
    this.updateMarker(dt);
    this.updateOverlays(dt);
    this.ambT -= dt;
    if (this.ambT <= 0 && !this.demo) { this.ambT = 0.5; this.updateAmbience(); }

    if (this.demo) this.cam.rotate(dt * 0.04, false);
    this.input?.update(dt);
    this.cam.update(dt);
    if (this.pov) this.updatePov(dt);
    if (this.drive.active) {
      this.drive.update(dt);
      this.cam.target.set(this.drive.pos.x, 0, this.drive.pos.z);
      this.cam.apply();
    }
    this.lights.update(dt, this.cam.target.x, this.cam.target.z);
    sound.listen(this.cam.target.x, this.cam.target.z, this.drive?.active || this.pov ? 4 : this.cam.viewHalf);
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

  /** An ad is playing: everything stands still. */
  setAdPaused(p: boolean) {
    this.adPaused = p;
    if (this.input) this.input.enabled = !p && !this.menuPaused;
  }

  /** A grant from investors for watching an ad (once a game day). */
  private async rewardGrant(city: City) {
    if (this.grantDay === this.eco.day) return this.hud?.toast(t('The investors come again tomorrow'));
    const ok = await Platform.rewardedAd();
    if (!ok) return this.hud?.toast(t('The ad was not watched to the end — no grant'));
    this.grantDay = this.eco.day;
    const sum = Math.max(1000, Math.round(this.life.populationByCity().get(city.id)! * 8 / 100) * 100);
    this.eco.add(city, 'money', sum, 'Grant from investors');
    sound.play('coin');
    this.hud?.toast(t('Investors gave the town ${n}', { n: sum }));
    this.refreshInspector();
    this.refreshHud();
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
    if (kind === 'tunnel') kind = 'road'; // a tunnel is a road drawn through a mountain
    // a road, a footpath or a railway may cross a neighbour's land to join the towns; canals and pipes may not
    const joins = kind === 'road' || kind === 'litroad' || kind === 'path' || kind === 'rail';
    for (const tl of path) {
      const town = joins ? undefined : this.foreignTown(tl.x, tl.z);
      if (town) return { ok: false, reason: t('This land belongs to the neighbour town {city}', { city: town.name }) };
    }
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
    if (kind === 'pipe') {
      // pipes run underground: anywhere on land, under roads, paths and buildings
      let fresh = 0;
      for (const tl of path) {
        const k = idx(tl.x, tl.z);
        if (this.map.water[k] || this.map.height[k] > 0) return { ok: false, reason: t('Pipes need dry, flat land') };
        if (!this.pipes.tiles[k]) fresh++;
      }
      const money = fresh * PIPE_COST.money, iron = fresh * PIPE_COST.iron;
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
      if (!canal) {
        const money = path.filter((tl) => !this.footpaths.tiles[idx(tl.x, tl.z)] && !this.net.type[idx(tl.x, tl.z)] && this.buildings.occ[idx(tl.x, tl.z)] === -1).length * PATH_COST;
        if (this.eco.money < money) return { ok: false, reason: t('Not enough money — needs ${n}', { n: money }) };
        return { ok: true, money, stone: 0 };
      }
      const money = path.filter((tl) => !this.canals.tiles[idx(tl.x, tl.z)] && this.buildings.occ[idx(tl.x, tl.z)] === -1).length * CANAL_COST;
      if (this.eco.money < money) return { ok: false, reason: t('Not enough money — needs ${n}', { n: money }) };
      return { ok: true, money };
    }
    let money = 0, stone = 0, bridges = 0, tunnels = 0;
    for (let i = 0; i < path.length; i++) {
      const tl = path[i];
      const k = idx(tl.x, tl.z);
      // through a mountain the road runs in a tunnel (dearer than a road, cheaper than going round)
      if (this.map.height[k] > 0 && !this.net.type[k]) { money += TUNNEL_COST.money; stone += TUNNEL_COST.stone; tunnels++; if (this.buildings.occ[k] !== -1) return { ok: false, reason: t('A building is in the way') }; if (kind === 'litroad' && !this.lights.lit[k]) money += LAMP.price; continue; }
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
    if (kind === 'tunnel') kind = 'road';
    const r = this.checkLine(kind, path);
    if (!r.ok) { sound.play('error'); return this.hud?.toast(r.reason!); }
    sound.play('build');
    const free = path.filter((tl) => !this.net.type[idx(tl.x, tl.z)]);
    if (kind === 'rail') {
      this.eco.spend(r.money ?? 0, 0, 0, r.iron ?? 0, 'Railway');
      this.railway.add(path);
      this.footpaths.remove(free);
      this.canals.remove(free);
      this.terrain.clearTiles(path.map((tl) => idx(tl.x, tl.z)));
      this.effects.pave(path);
      this.networkChanged();
      return;
    }
    if (kind === 'pipe') {
      this.eco.spend(r.money ?? 0, 0, 0, r.iron ?? 0, 'Water pipes');
      this.pipes.add(path);
      this.pipes.rebuild();
      this.effects.pave(path);
      return;
    }
    if (kind === 'path' || kind === 'canal') {
      this.eco.spend(r.money ?? 0, 0, 0, 0, 'Paths and canals');
      if (kind === 'path') { this.canals.remove(free); this.footpaths.add(free); }
      else { this.footpaths.remove(free); this.canals.add(path.filter((tl) => this.map.isLand(idx(tl.x, tl.z)) && this.buildings.occ[idx(tl.x, tl.z)] === -1)); }
      this.terrain.clearTiles(free.map((tl) => idx(tl.x, tl.z)));
      this.effects.pave(path);
      this.networkChanged();
      return;
    }
    this.eco.spend(r.money!, r.stone!, 0, 0, 'Roads');
    this.footpaths.remove(path);
    // existing roads on the way get (or lose) their lamps at once; the new tiles are laid by the builders
    this.lights.setLit(path.filter((tl) => this.net.type[idx(tl.x, tl.z)]).map((tl) => idx(tl.x, tl.z)), kind === 'litroad');
    this.terrain.clearTiles(path.map((tl) => idx(tl.x, tl.z)));
    this.roadJobs.push({ tiles: path.map((tl) => ({ x: tl.x, z: tl.z })), done: 0, lit: kind === 'litroad', city: this.eco.active, prog: 0, money: r.money ?? 0, stone: r.stone ?? 0 });
    if (path.some((tl) => !this.net.type[idx(tl.x, tl.z)]) && !this.buildings.list.some((b) => b.kind === 'construction' && b.city === this.eco.active && b.built >= 1))
      this.hud?.toast(t('Roads are laid by builders: build a Construction Company'));
    this.drawRoadSites();
    this.networkChanged(false);
  }

  /** Roads being laid: the tiles in order, how many are done, and what they cost (for undo). */
  private roadJobs: { tiles: Tile[]; done: number; lit: boolean; city: number; prog: number; money: number; stone: number }[] = [];
  private roadSites = new THREE.Group();

  /**
   * The builders lay the ordered roads tile by tile: slowly without a construction company, faster with every
   * builder at work. A finished tile joins the road network at once.
   */
  private advanceRoads(dt: number) {
    if (!this.roadJobs.length || dt <= 0) return;
    const crews = new Map<number, number>();
    let changed = false;
    for (const job of this.roadJobs.slice(0, 3)) {
      // only the first road of a town is worked on, and only by the builders who came to it
      if (crews.has(job.city)) continue;
      const site = this.roadSiteOf(job);
      const crew = site ? this.life.roadCrew(site.key) : 0;
      crews.set(job.city, crew);
      job.prog += dt * 0.3 * Math.min(crew, 8);
      while (job.done < job.tiles.length) {
        const tl = job.tiles[job.done];
        const k = idx(tl.x, tl.z);
        const was = !!this.net.type[k];
        if (!was && job.prog < 1) break;
        if (!was) job.prog -= 1;
        this.net.buildPath(job.done > 0 ? [job.tiles[job.done - 1], tl] : [tl], ROAD_TWO_LANE);
        if (job.lit) this.lights.setLit([k], true);
        if (!was) this.effects.pave([tl]);
        job.done++;
        changed = true;
      }
    }
    if (!changed) return;
    this.roadJobs = this.roadJobs.filter((j) => j.done < j.tiles.length);
    this.netPending = true;
    this.drawRoadSites();
  }

  /** Where the builders of a road work now: the next tile to lay (or the last laid one, when it goes out over water). */
  private roadSiteOf(job: { tiles: Tile[]; done: number }) {
    for (let i = job.done; i < job.tiles.length; i++) {
      const tl = job.tiles[i];
      const k = idx(tl.x, tl.z);
      if (this.net.type[k]) continue;
      const stand = this.map.water[k] && i > 0 ? job.tiles[i - 1] : tl;
      return { key: k, x: tileToWorld(stand.x), z: tileToWorld(stand.z) };
    }
    return null;
  }

  /** Gravel where a road is still to be laid, cones and a roller where the builders are at work. */
  private drawRoadSites() {
    if (!this.roadSites.parent) this.scene.add(this.roadSites);
    for (const ch of [...this.roadSites.children]) this.roadSites.remove(ch);
    const todo: Tile[] = [], active: Tile[] = [];
    for (const job of this.roadJobs) {
      let first = true;
      for (let i = job.done; i < job.tiles.length; i++) {
        const tl = job.tiles[i];
        const k = idx(tl.x, tl.z);
        if (this.net.type[k]) continue;
        todo.push(tl);
        if (first) { active.push(tl); first = false; }
      }
    }
    if (!todo.length) return;
    const gravel = new THREE.InstancedMesh(this.siteGeo.gravel, this.siteGeo.mat, todo.length);
    const m = new THREE.Matrix4();
    todo.forEach((tl, i) => {
      const k = idx(tl.x, tl.z);
      m.makeTranslation(tileToWorld(tl.x), this.map.height[k] > 0 ? this.map.topY(k) + 0.01 : this.map.water[k] ? 0.1 : 0.012, tileToWorld(tl.z));
      gravel.setMatrixAt(i, m);
    });
    gravel.receiveShadow = true;
    this.roadSites.add(gravel);
    for (const tl of active) {
      const crew = new THREE.Mesh(this.siteGeo.crew, this.siteGeo.mat);
      crew.position.set(tileToWorld(tl.x), 0.012, tileToWorld(tl.z));
      crew.castShadow = true;
      this.roadSites.add(crew);
    }
  }
  private siteGeo = (() => {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const gravel = box(0.92, 0.03, 0.92, 0, 0.015, 0, '#b49a6c');
    const parts: THREE.BufferGeometry[] = [
      ...[[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].map(([x, z]) => shape('cone', 0.07, 0.13, 0.07, x, 0.065, z, '#f07a1e', 'y', 8)),
      // a small road roller
      box(0.22, 0.1, 0.12, 0.05, 0.11, 0.25, '#f2c230'), shape('cylinder', 0.14, 0.12, 0.14, -0.1, 0.07, 0.25, '#4a4f57', 'z', 12),
    ];
    return { mat, gravel, crew: merge(parts) };
  })();

  getGhost(kind: PlaceKind, t: Tile, rotDir: number): GhostInfo | null {
    if (kind === 'roundabout') return null;
    const def = BUILDINGS[kind];
    if (!def) return null;
    const { rot } = this.buildings.resolveOrientation(kind, t.x, t.z, rotDir);
    const mv = this.moving && this.moving.kind === kind ? this.moving : null;
    const geo = mv
      ? ((mv.mesh.children[0] as THREE.Mesh)?.geometry ?? this.buildings.geometry(kind, t.x, t.z))
      : this.buildings.geometry(kind, t.x, t.z);
    return { geo, size: def.size, rot };
  }

  /** The neighbour town whose land this tile is (its buildings and streets, and a margin around them). */
  foreignTown(x: number, z: number): City | undefined {
    const now = this.time;
    if (!this.territory || now - this.territory.t > 2 || this.territory.n !== this.buildings.list.length) {
      const boxes: { city: City; x0: number; z0: number; x1: number; z1: number }[] = [];
      for (const c of this.eco.cities.values()) {
        if (!c.ai) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const b of this.buildings.list) {
          if (b.city !== c.id || BUILDINGS[b.kind].needsRoad === false && b.kind !== 'townhall' && (b.kind === 'quarry' || b.kind === 'woodcutter')) continue;
          const s = BUILDINGS[b.kind].size;
          x0 = Math.min(x0, b.x); z0 = Math.min(z0, b.z); x1 = Math.max(x1, b.x + s - 1); z1 = Math.max(z1, b.z + s - 1);
        }
        if (x0 <= x1) boxes.push({ city: c, x0: x0 - 3, z0: z0 - 3, x1: x1 + 3, z1: z1 + 3 });
      }
      this.territory = { t: now, n: this.buildings.list.length, boxes };
    }
    return this.territory.boxes.find((bx) => x >= bx.x0 && x <= bx.x1 && z >= bx.z0 && z <= bx.z1)?.city;
  }
  private territory?: { t: number; n: number; boxes: { city: City; x0: number; z0: number; x1: number; z1: number }[] };

  checkPlace(kind: PlaceKind, tl: Tile, _rotDir = 0): CheckResult {
    if (kind === 'roundabout') { const town = this.foreignTown(tl.x, tl.z); return town ? { ok: false, reason: t('This land belongs to the neighbour town {city}', { city: town.name }) } : this.checkRoundabout(tl); }
    {
      const s = BUILDINGS[kind].size;
      for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) {
        const town = this.foreignTown(tl.x + dx, tl.z + dz);
        if (town) return { ok: false, reason: t('This land belongs to the neighbour town {city}', { city: town.name }) };
      }
    }
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
    // your buildings can't hang on a neighbour town's streets
    const acc = BUILDINGS[kind].needsRoad ? this.buildings.findAccess(kind, tl.x, tl.z).access : -1;
    if (acc >= 0) { const town = this.foreignTown(acc % N, (acc / N) | 0); if (town) return { ok: false, reason: t("These streets belong to {city} — build along your own roads", { city: town.name }) }; }
    if (kind === 'townhall' && this.buildings.halls().some((h) => !this.eco.cities.get(h.city)?.ai)) {
      return { ok: false, reason: t('You already have a Town Hall — one town for now') };
    }
    if (kind === 'townhall' && this.buildings.halls().some((h) => Math.max(Math.abs(h.x - tl.x), Math.abs(h.z - tl.z)) < CITY_MIN_DISTANCE)) {
      return { ok: false, reason: t('Too close to another Town Hall') };
    }
    if (!this.eco.canAfford(def.money, def.stone, def.wood, def.iron)) {
      return { ok: false, reason: t('Needs {cost}', { cost: costText(def.money, def.stone, def.wood, def.iron) }) };
    }
    // builders come from a construction company — without one nothing can be built (except the company and a Town Hall)
    if (kind !== 'townhall' && kind !== 'construction' && !this.buildings.list.some((b) => b.kind === 'construction' && b.city === this.eco.active)) {
      return { ok: false, reason: t('Build a Construction Company first — its builders build everything else') };
    }
    return { ok: true, money: def.money, stone: def.stone, wood: def.wood, iron: def.iron };
  }

  place(kind: PlaceKind, tl: Tile, rotDir = 0) {
    const r = this.checkPlace(kind, tl, rotDir);
    if (!r.ok) { sound.play('error'); return this.hud?.toast(r.reason!); }
    if (kind === 'roundabout') {
      this.net.pushUndo(ROUNDABOUT_COST.money, ROUNDABOUT_COST.stone);
      this.eco.spend(ROUNDABOUT_COST.money, ROUNDABOUT_COST.stone, 0, 0, 'Roads');
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
    const { rot, access } = this.buildings.resolveOrientation(kind, tl.x, tl.z, rotDir);
    if (this.moving && this.moving.kind === kind) {
      const b = this.moving;
      this.moving = null;
      this.eco.add(this.cityOf(b), 'money', -(r.money ?? 0), 'Moving buildings');
      this.buildings.move(b, tl.x, tl.z, rot, access);
      this.terrain.clearTiles(this.footprint(kind, tl).map((f) => idx(f.x, f.z)));
      this.effects.puff(b.mesh.position.x, b.mesh.position.z, def.size * 0.5, 14);
      sound.play('place');
      this.pop.assign(this.buildings);
      if (b.kind === 'fishery' || b.kind === 'townhall') this.waterLife.rebuild();
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
    const b = this.buildings.place(kind, tl.x, tl.z, { city: owner, rot, access });
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

  /** Ask first: list what will be demolished, then do it. */
  bulldoze(path: Tile[]) {
    if (path.some((tl) => this.foreignTown(tl.x, tl.z))) {
      const town = path.map((tl) => this.foreignTown(tl.x, tl.z)).find(Boolean)!;
      this.hud?.toast(t('{city} is a neighbour town — you cannot change it', { city: town.name }));
      path = path.filter((tl) => !this.foreignTown(tl.x, tl.z));
    }
    const roads = path.filter((tl) => this.net.hasRoad(tl)).length;
    const names = new Map<string, number>();
    const seen = new Set<number>();
    for (const tl of path) {
      const b = this.buildings.at(idx(tl.x, tl.z));
      if (!b || seen.has(b.id) || b.kind === 'townhall' || b.kind === 'cemeteryext' || this.eco.cities.get(b.city)?.ai) continue;
      seen.add(b.id);
      names.set(t(BUILDINGS[b.kind].name), (names.get(t(BUILDINGS[b.kind].name)) ?? 0) + 1);
    }
    if (!roads && !names.size) return this.doBulldoze(path);
    const what = [...[...names.entries()].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)), ...(roads ? [t('{n} road tiles', { n: roads })] : [])].join(', ');
    this.hud?.confirm(t('Demolish?'), `${what}. ${t('You get half of the cost back. This cannot be undone.')}`, t('Demolish'), () => this.doBulldoze(path));
  }

  private doBulldoze(path: Tile[]) {
    // a neighbour town's streets and buildings are not yours to remove
    path = path.filter((tl) => !this.foreignTown(tl.x, tl.z));
    const roads = path.filter((tl) => this.net.hasRoad(tl));
    const targets = new Set<Building>();
    let keptTownHall = false;
    for (const tl of path) {
      const b = this.buildings.at(idx(tl.x, tl.z));
      if (!b) continue;
      if (b.kind === 'townhall') keptTownHall = true;
      else if (b.kind === 'cemeteryext' || this.eco.cities.get(b.city)?.ai) continue;
      else targets.add(b);
    }
    if (keptTownHall) this.hud?.toast(t("The Town Hall can't be removed"));
    const pipesGone = this.tool?.tool === 'bulldoze' && this.pipes.mesh.visible ? this.pipes.remove(path) : 0;
    if (pipesGone) this.pipes.rebuild();
    const paths = this.footpaths.remove(path) + this.canals.remove(path) + this.railway.remove(path) + pipesGone;
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
    if (refund && own) this.eco.add(own, 'money', Math.floor(BUILDINGS[b.kind].money / 2), 'Demolition refunds');
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
    s = Math.min(s, 50); // the fastest speed is 50×
    if (s > 0) this.lastSpeed = s;
    this.speed = s;
    this.hud?.setSpeed(s);
  }

  private undo() {
    // the last road ordered and not yet finished: cancelled, what is still unbuilt is paid back
    const job = this.roadJobs[this.roadJobs.length - 1];
    if (job) {
      const left = job.tiles.slice(job.done).filter((tl) => !this.net.type[idx(tl.x, tl.z)]).length;
      const share = job.tiles.length ? left / job.tiles.length : 0;
      this.roadJobs.pop();
      this.eco.add(this.eco.city, 'money', Math.round(job.money * share), 'Undo refunds');
      this.eco.add(this.eco.city, 'stone', Math.round(job.stone * share), 'Undo refunds');
      this.drawRoadSites();
      return;
    }
    const refund = this.net.undo();
    if (!refund) return;
    this.eco.add(this.eco.city, 'money', refund.money, 'Undo refunds');
    this.eco.add(this.eco.city, 'stone', refund.stone, 'Undo refunds');
    this.networkChanged();
  }

  private networkChanged(dirty = true) {
    this.commuteCache.clear();
    this.rebuildTunnels();
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
    this.recordTowns();
    this.maybeDecide();
    this.trade.newDay(this.eco.day);
    this.maybeFoundTown();
    // stores are not endless: what lies beyond the room of the town hall and the warehouses slowly spoils
    for (const c of this.eco.cities.values()) for (const r of GOODS) {
      const extra = c[r] - this.eco.capacity(c, r);
      if (extra > 0) this.eco.add(c, r, -Math.ceil(Math.max(extra * 0.25, Math.min(extra, 20))), 'Spoiled — no room in the stores');
    }
    // neighbour towns pay back the player's investments (what they can; the rest a few days later)
    for (const c of this.eco.cities.values()) {
      if (!c.ai || !c.owes || c.owes.day > this.eco.day) continue;
      const pay = Math.min(c.owes.money, Math.max(0, Math.floor(c.money - 300)));
      if (pay > 0) {
        this.eco.add(c, 'money', -pay, 'Paid back an investment');
        this.eco.add(this.eco.city, 'money', pay, 'Investments paid back');
        this.deal(c.id, t('Paid back ${m} of your investment', { m: pay }), pay);
        this.life.events.push(t('{city} paid back ${m} of your investment', { city: c.name, m: pay }));
      }
      c.owes.money -= pay;
      if (c.owes.money <= 0) c.owes = undefined; else c.owes.day = this.eco.day + 3;
    }
    for (const v of this.airLog.values()) v.flights = 0;
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

  /** Small sounds of the day: the school bell at 8:00 and 15:00, a rooster at dawn. */
  private dayRhythm() {
    const tod = this.eco.timeOfDay, prev = this.prevTod;
    this.prevTod = tod;
    const crossed = (x: number) => prev < x && tod >= x;
    if (crossed(0.33) || crossed(0.62)) for (const s of this.buildings.list) if (s.kind === 'school' && s.built >= 1) sound.play('bell', s.mesh.position);
    if (crossed(0.24)) for (const f of this.buildings.list) if ((f.kind === 'ranch' || f.kind === 'farm') && f.built >= 1) sound.play('rooster', f.mesh.position);
  }

  private chimneySmoke(dt: number) {
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = 0.6;
    for (const b of this.buildings.list) {
      // the bakery oven is lit before dawn
      if (b.kind === 'bakery' && b.workers > 0 && b.built >= 1 && this.eco.timeOfDay > 0.16 && this.eco.timeOfDay < 0.45) {
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        this.effects.smoke(b.mesh.position.x + 0.22 * c - 0.2 * s, 0.78, b.mesh.position.z - 0.22 * s - 0.2 * c);
        continue;
      }
      if ((b.kind === 'factory' || b.kind === 'carfactory' || b.kind === 'coalplant' || b.kind === 'steelmill' || b.kind === 'brickworks') && b.workers > 0 && b.built >= 1) {
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
    // fog: thick on foggy mornings, white in a blizzard, a warm haze in a heatwave
    const mood = this.life.weatherMood;
    const fogK = mood === 'fog' ? Math.max(0, 1 - Math.max(0, tod - 0.3) / 0.15) * 0.85 : mood === 'blizzard' ? 0.75 : mood === 'heat' ? 0.25 * day : 0;
    this.fogLevel += (fogK - this.fogLevel) * 0.05;
    if (this.fogLevel > 0.02 && !this.pov && !this.drive?.active) {
      const col = mood === 'heat' ? HEAT_HAZE : mood === 'blizzard' ? SNOW_FOG : FOG_GREY;
      const fog = (this.scene.fog as THREE.Fog | null) ?? (this.scene.fog = new THREE.Fog(col.clone(), 80, 200));
      fog.color.copy(col).lerp(SKY_NIGHT, 1 - day);
      fog.near = 78 - this.fogLevel * 30;
      fog.far = 140 - this.fogLevel * 50;
    } else this.scene.fog = null;
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
    if (b?.kind === 'townhall' && !this.eco.cities.get(b.city)?.ai) {
      this.eco.active = b.city;
      this.refreshHud();
    }
    this.select(b ? { type: 'building', id: b.id } : null);
  }

  private select(s: Selection) {
    if (s?.type !== this.selection?.type || s?.id !== this.selection?.id) { this.following = false; this.aptFamily = null; }
    this.selection = s;
    if (!s) this.inspector?.hide();
    else this.refreshInspector();
  }

  private roofOf = new Map<number, number>();
  private personPos(c: Citizen) {
    const v = this.traffic.vehicleForDriver(c.id) ?? this.traffic.vehicleForPassenger(c.id);
    if (v && !v.leaving) return { x: v.x, z: v.z, y: 0.3 };
    if (c.walker && !c.walker.leaving) return { x: c.walker.x, z: c.walker.z, y: 0.3 * c.walker.scale };
    const b = this.buildings.get(c.at);
    if (!b) return null;
    // the height of the building (measured once): the marker floats above its roof
    let top = this.roofOf.get(b.id);
    if (top === undefined) { top = new THREE.Box3().setFromObject(b.mesh).max.y; this.roofOf.set(b.id, top); }
    return { x: b.mesh.position.x, z: b.mesh.position.z, y: top + 0.2 };
  }

  /** Problem badges over buildings, the reach of the selected service and what a selected power plant feeds. */
  private updateOverlays(dt: number) {
    this.overlays.visible = !this.demo && !this.pov && !this.drive?.active && !this.photoMode;
    this.overlays.update(dt);
    this.overlayT -= dt;
    if (this.overlayT > 0 || this.demo) return;
    this.overlayT = 1;
    if (Math.random() < 0.6) this.thoughtBubbles();
    const sel = this.selection?.type === 'building' ? this.buildings.get(this.selection.id) : undefined;
    const range = sel ? (sel.kind === 'police' ? [POLICE_RANGE, '#6fb6ff'] : sel.kind === 'firestation' ? [FIRE_RANGE, '#f07167'] : sel.kind === 'military' ? [MILITARY.range, '#7be08f'] : DECOR[sel.kind] ? [DECOR_RANGE, '#7be08f'] : null) : null;
    this.overlays.showRange(range ? sel : undefined, range ? (range[0] as number) : 0, range ? (range[1] as string) : undefined);
    // a power plant lights up what it feeds; a water tower shows the pipes and the homes with water
    const water = !!sel && sel.kind === 'watertower';
    this.pipes.mesh.visible = water || this.tool?.tool === 'pipe' || (this.tool?.tool === 'bulldoze' && this.pipes.mesh.visible && !sel);
    if (this.mapLayer !== 'none') this.showLayer();
    else this.overlays.showGrid(sel && BUILDINGS[sel.kind].power ? this.life.gridMates(sel) : water ? this.buildings.list.filter((h) => (this.life.homeWater.get(h.id) ?? 0) > 0) : [], water ? '#6fb6ff' : '#ffe066');
    // what each home is missing
    const homeTrouble = new Map<number, Problem>();
    for (const f of this.pop.families.values()) {
      for (const c of this.pop.members(f)) {
        if (c.hunger < 25) { homeTrouble.set(f.home, 'food'); break; }
        if (c.health < 30 && !homeTrouble.has(f.home)) homeTrouble.set(f.home, 'sick');
      }
    }
    this.overlays.setProblems(this.buildings.list, (b) => {
      if (b.built < 1 || b.removed) return undefined;
      const d = BUILDINGS[b.kind];
      if (d.needsRoad && b.access < 0) return 'road';
      if (d.energy && !b.powered) return 'power';
      if (d.units) {
        if (b.trash !== undefined && b.trash >= TRASH.full) return 'trash';
        if ((this.life.homeWater.get(b.id) ?? 1) < 0.95 && this.pop.familyAt(b.id)) return 'water';
        return homeTrouble.get(b.id);
      }
      if (d.jobs && b.workers === 0 && !DECOR[b.kind]) return 'workers';
      if ((b.kind === 'grocery' || b.kind === 'market' || b.kind === 'bakery') && this.cityOf(b).food < 15) return 'food';
      return undefined;
    });
  }

  /** Colour every building by the chosen map layer. */
  private showLayer() {
    const list = this.buildings.list.filter((b) => b.built >= 1 && !b.removed);
    const RED = '#ff5a4e', GREEN = '#58d36b', AMBER = '#f2b33d', BLUE = '#4fa3ff';
    if (this.mapLayer === 'power') {
      this.overlays.showGrid(list.filter((b) => BUILDINGS[b.kind].energy || BUILDINGS[b.kind].power || b.kind === 'battery'), '', (b) =>
        BUILDINGS[b.kind].power || b.kind === 'battery' ? '#ffe066' : !this.life.onGrid(b) ? RED : b.powered ? GREEN : AMBER);
    } else if (this.mapLayer === 'water') {
      this.overlays.showGrid(list.filter((b) => BUILDINGS[b.kind].units || b.kind === 'watertower' || b.kind === 'sewage'), '', (b) => {
        if (b.kind === 'watertower' || b.kind === 'sewage') return BLUE;
        const w = this.life.homeWater.get(b.id) ?? 0;
        return w >= 0.95 ? GREEN : w > 0.3 ? AMBER : RED;
      });
    } else {
      this.overlays.showGrid(list.filter((b) => BUILDINGS[b.kind].units && this.pop.familyAt(b.id)), '', (b) => {
        const m = this.homeMood(b);
        return m >= 65 ? GREEN : m >= 45 ? AMBER : RED;
      });
    }
  }

  /** How happy the people of one home are: the town's mood plus what they have (or miss) where they live. */
  homeMood(b: Building) {
    const city = this.cityOf(b);
    let m = city.happiness;
    if (!b.powered) m -= 15;
    if ((this.life.homeWater.get(b.id) ?? 1) < 0.95) m -= 20;
    if (b.trash !== undefined && b.trash >= TRASH.full) m -= 8;
    for (const f of this.pop.families.values()) {
      if (f.home !== b.id) continue;
      if (f.money < 0) m -= 10;
      for (const c of this.pop.members(f)) { if (c.hunger < 25) m -= 8; if (c.health < 30) m -= 5; }
    }
    let beauty = 0, smoke = 0;
    for (const o of this.buildings.list) {
      if (o.city !== b.city || o.built < 1) continue;
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (DECOR[o.kind] && d < DECOR_RANGE) beauty += DECOR[o.kind]!;
      if (POLLUTERS[o.kind] && o.workers > 0 && d < 8) smoke += POLLUTERS[o.kind]! * (1 - d / 8);
    }
    return Math.max(0, Math.min(100, m + Math.min(10, beauty * 1.5) - smoke * 4));
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

  /** A plane stopped at the terminal: tourists get off, surplus goods fly out, missing goods fly in. */
  /** Are two towns joined by a road (cars can drive from one town hall to the other)? */
  private roadLinked(a: number, b: number) {
    const ha = this.buildings.townHall(a), hb = this.buildings.townHall(b);
    return !!ha && !!hb && ha.access >= 0 && hb.access >= 0 && this.traffic.canRoute(ha.access, hb.access);
  }

  /** Are two towns joined by footpaths, sidewalks of roads or a railway (people walk, cycle or take the train)? */
  private footLinked(a: number, b: number) {
    const ha = this.buildings.townHall(a), hb = this.buildings.townHall(b);
    if (!ha || !hb || ha.access < 0 || hb.access < 0) return false;
    const ok = (k: number) => !!this.net.type[k] || !!this.footpaths.tiles[k] || !!this.railway.tiles[k];
    const seen = new Uint8Array(N * N);
    const stack = [ha.access];
    seen[ha.access] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      if (k === hb.access) return true;
      const x = k % N, z = (k / N) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const nk = nz * N + nx;
        if (!seen[nk] && ok(nk)) { seen[nk] = 1; stack.push(nk); }
      }
    }
    return false;
  }

  /**
   * A town that runs itself builds a road to the nearest town it is not joined with yet: around the mountains,
   * along existing roads where it can, over water with a bridge. It pays from its own treasury.
   */
  private linkTown(c: City): string | null {
    const hall = this.buildings.townHall(c.id);
    if (!hall || hall.access < 0) return null;
    const others = [...this.eco.cities.values()]
      .map((o) => ({ o, h: this.buildings.townHall(o.id) }))
      .filter((x) => x.o.id !== c.id && x.h && x.h.access >= 0 && !this.roadLinked(c.id, x.o.id))
      .sort((a, b) => Math.abs(a.h!.x - hall.x) + Math.abs(a.h!.z - hall.z) - (Math.abs(b.h!.x - hall.x) + Math.abs(b.h!.z - hall.z)));
    const target = others[0];
    if (!target) return null;
    const cost = (k: number) => {
      if (this.net.type[k]) return this.net.isRing(k) || this.net.isIsland(k) ? Infinity : 0.25;
      if (this.buildings.occ[k] !== -1 || this.railway.tiles[k] || this.net.isIsland(k)) return Infinity;
      return this.map.height[k] > 0 ? 7 : this.map.water[k] ? 8 : 1;
    };
    const path = walkPath(cost, hall.access, target.h!.access, 150000);
    if (!path) return null;
    const fresh = path.filter((k) => !this.net.type[k]);
    let money = 0, stone = 0;
    for (const k of fresh) { const r = this.map.height[k] > 0 ? TUNNEL_COST : this.map.water[k] ? BRIDGE_COST : ROAD_COST[2]; money += r.money; stone += r.stone; }
    // not rich enough for a road (or a thrifty mayor): first a cheap footpath, so people can come on foot and by bike
    const thrifty = c.style === 'thrifty' || c.style === 'green';
    if (c.money < money + stone * TRADE_PRICE.stone * 1.25 + 1500 || (thrifty && !this.footLinked(c.id, target.o.id) && Math.random() < 0.6)) {
      if (this.footLinked(c.id, target.o.id)) return null;
      const walk = walkPath((k) => (this.net.type[k] || this.footpaths.tiles[k] ? 0.25 : this.map.height[k] > 0 || this.map.water[k] || this.buildings.occ[k] !== -1 || this.railway.tiles[k] ? Infinity : 1), hall.access, target.h!.access, 150000);
      if (!walk) return null;
      const lay = walk.filter((k) => !this.net.type[k] && !this.footpaths.tiles[k] && !this.canals.tiles[k]);
      const price = lay.length * PATH_COST;
      if (c.money < price + 800) return null;
      this.eco.add(c, 'money', -price, 'Paths and canals');
      this.footpaths.add(lay.map((k) => ({ x: k % N, z: (k / N) | 0 })));
      this.terrain.clearTiles(lay);
      this.networkChanged();
      this.pop.assign(this.buildings);
      if (!target.o.ai) this.life.events.push(t('{city} laid a footpath to your town — people can now come on foot and by bike', { city: c.name }));
      else this.autoCity.note(target.o, t('{city} laid a footpath to us', { city: c.name }));
      return t('{city} (footpath)', { city: target.o.name });
    }
    // buy the stone it lacks, then pay for the road
    const short = Math.max(0, stone - c.stone);
    if (short) this.buyFromTowns(c, 'stone', short);
    if (c.stone < stone) return null;
    this.eco.add(c, 'money', -money, 'Roads');
    this.eco.add(c, 'stone', -stone, 'Roads');
    // keep the kind of the roads it runs along; only the new tiles become a two-lane road
    const old = path.map((k) => this.net.type[k]);
    const tiles = path.map((k) => ({ x: k % N, z: (k / N) | 0 }));
    this.footpaths.remove(tiles.filter((tl) => !this.net.type[idx(tl.x, tl.z)]));
    this.net.buildPath(tiles, ROAD_TWO_LANE);
    path.forEach((k, i) => { if (old[i]) this.net.type[k] = old[i]; });
    this.net.clearUndo();
    this.terrain.clearTiles(fresh);
    this.networkChanged();
    this.pop.assign(this.buildings);
    if (!target.o.ai) this.life.events.push(t('{city} built a road to your town — people can now come to work and trade', { city: c.name }));
    else this.autoCity.note(target.o, t('{city} built a road to us', { city: c.name }));
    return target.o.name;
  }

  /**
   * Buy a good from the other towns that have plenty of it (the cheapest first), at their own price.
   * The player's town sells only when the player trades (never by itself).
   */
  private buyFromTowns(city: City, g: Good, want: number, withPlayer = false) {
    const pops = this.life.populationByCity();
    const sellers = [...this.eco.cities.values()]
      .filter((c) => c.id !== city.id && (c.ai || withPlayer))
      .map((c) => ({ c, extra: Math.floor(c[g] - this.stockTarget(g, pops.get(c.id) ?? 0) * 1.2), price: this.midPrice(c, g, pops.get(c.id) ?? 0) * 1.1 }))
      .filter((x) => x.extra > 0)
      .sort((a, b) => a.price - b.price);
    let got = 0, paid = 0;
    for (const s of sellers) {
      const room = Math.floor(this.eco.capacity(city, g) - city[g]);
      const n = Math.min(want - got, s.extra, room, Math.floor(Math.max(0, city.money) / s.price));
      if (n <= 0) continue;
      const m = Math.round(n * s.price);
      this.eco.add(s.c, g, -n, 'Sold to a neighbour town'); this.eco.add(city, g, n, 'Bought from a neighbour town');
      this.eco.add(city, 'money', -m, 'Trade with neighbour towns'); this.eco.add(s.c, 'money', m, 'Trade with neighbour towns');
      if (!city.ai) { this.trade.today.bought += m; this.deal(s.c.id, t('Bought {n} {good}', { n, good: t(GOOD_NAME[g]).toLowerCase() }), -m); }
      if (!s.c.ai) { this.trade.today.sold += m; this.deal(city.id, t('Sold {n} {good}', { n, good: t(GOOD_NAME[g]).toLowerCase() }), m); }
      got += n; paid += m;
      if (got >= want) break;
    }
    return { n: got, money: paid };
  }

  /** Sell a good to the other towns that lack it (the best price first). The player's town buys only by itself. */
  private sellToTowns(city: City, g: Good, have: number) {
    const pops = this.life.populationByCity();
    const buyers = [...this.eco.cities.values()]
      .filter((c) => c.id !== city.id && c.ai)
      .map((c) => ({ c, need: Math.floor(this.stockTarget(g, pops.get(c.id) ?? 0) - c[g]), price: this.midPrice(c, g, pops.get(c.id) ?? 0) }))
      .filter((x) => x.need > 0)
      .sort((a, b) => b.price - a.price);
    let sold = 0;
    for (const b of buyers) {
      const room = Math.floor(this.eco.capacity(b.c, g) - b.c[g]);
      const n = Math.min(have - sold, b.need, room, Math.floor(Math.max(0, b.c.money - 300) / b.price));
      if (n <= 0) continue;
      const m = Math.round(n * b.price);
      this.eco.add(city, g, -n, 'Sold to a neighbour town'); this.eco.add(b.c, g, n, 'Bought from a neighbour town');
      this.eco.add(b.c, 'money', -m, 'Trade with neighbour towns'); this.eco.add(city, 'money', m, 'Trade with neighbour towns');
      sold += n;
      if (sold >= have) break;
    }
    return sold;
  }

  /** Now and then a millionaire leaves to found a town of their own: their money builds it and runs it at first. */
  private maybeFoundTown() {
    if (this.eco.cities.size >= 10 || Math.random() > 0.05) return;
    const rich = [...this.pop.families.values()]
      .filter((f) => f.money >= FOUND.money && this.pop.members(f).some((m) => m.age >= 25 && m.age < 65))
      .sort((a, b) => b.money - a.money)[0];
    const home = rich && this.buildings.get(rich.home);
    if (!rich || !home) return;
    const from = this.cityOf(home);
    const site = findTownSite(this.map, this.buildings.halls().map((h) => ({ x: h.x, z: h.z })), 40, Math.random);
    if (!site) return;
    // the town hall and the first streets are dear: the founder pays, the rest becomes the new town's treasury
    const treasury = Math.round(rich.money - FOUND.cost - FOUND.keep);
    rich.money = FOUND.keep;
    const town = this.eco.found(townName(), { ...START_GRANT, money: treasury });
    town.ai = true;
    town.tint = TOWN_TINTS[(this.eco.cities.size - 1) % TOWN_TINTS.length];
    town.relation = 40;
    town.style = TOWN_STYLES[Math.floor(Math.random() * TOWN_STYLES.length)];
    town.taxRate = 0.25;
    this.layVillage(site.x, site.z, town.id, 14);
    const free = this.life.freeHomes(town.id)[0];
    if (free) this.life.moveInto(rich, free, 'Moved to found the town of {city}');
    const founder = this.pop.members(rich).filter((m) => m.age >= 25).sort((a, b) => b.skill - a.skill || b.age - a.age)[0];
    if (founder) { town.mayor = founder.id; this.pop.note(founder, 'Founded the town of {city} and became its first mayor', { city: town.name }); }
    this.networkChanged();
    this.pop.assign(this.buildings);
    this.waterLife.rebuild();
    this.autoCity.note(town, t('The {family} family founded the town with ${n}', { family: rich.surname, n: treasury }), false);
    this.life.events.push(t('The millionaire {family} family of {from} founded a new town: {city}', { family: rich.surname, from: from.name, city: town.name }));
  }

  /** Town chosen in the Gifts tab. */
  private giftTarget = -1;

  /** A gift of money or goods to another town: friendship grows with the value of the gift. */
  private sendGift(from: City, to: City, what: 'money' | 'food' | 'wood' | 'stone' | 'iron', n: number) {
    if (from[what] < n) { sound.play('error'); return this.hud?.toast(t('Not enough to send')); }
    const value = what === 'money' ? n : n * TRADE_PRICE[what];
    to.relation = Math.min(100, (to.relation ?? 40) + Math.min(20, value / 150));
    if (what === 'money') {
      this.eco.add(from, 'money', -n, 'Gifts to other towns');
      this.eco.add(to, 'money', n, 'Gift from another town');
      this.hud?.toast(t('{city} received your gift of ${n}', { city: to.name, n }));
    } else {
      const a = this.buildings.townHall(from.id), b = this.buildings.townHall(to.id);
      if (a && b && a.access >= 0 && b.access >= 0 && this.traffic.canRoute(a.access, b.access)) {
        this.sendGoods(from, to, what, n);
      } else {
        this.eco.add(from, what, -n, 'Gifts to other towns');
        this.eco.add(to, what, n, 'Gift from another town');
        this.hud?.toast(t('{city} received your gift', { city: to.name }));
      }
    }
    this.deal(to.id, t('Gift: {n} {what}', { n: what === 'money' ? `$${n}` : n, what: what === 'money' ? '' : t(GOOD_NAME[what as Good]).toLowerCase() }), what === 'money' ? -n : 0);
    sound.play('coin');
    this.refreshHud();
  }

  /** Stone portals where a road enters a mountain (the road runs on inside, hidden in the rock). */
  private tunnelGroup = new THREE.Group();
  private rebuildTunnels() {
    if (!this.tunnelGroup.parent) this.scene.add(this.tunnelGroup);
    for (const ch of [...this.tunnelGroup.children]) { this.tunnelGroup.remove(ch); (ch as THREE.Mesh).geometry?.dispose(); }
    const frame = new THREE.MeshLambertMaterial({ color: '#8e8a83' }), dark = new THREE.MeshBasicMaterial({ color: '#15171a' });
    for (let k = 0; k < this.net.type.length; k++) {
      if (!this.net.type[k] || this.map.height[k] <= 0) continue;
      const x = k % N, z = (k / N) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (!inBounds(nx, nz)) continue;
        const nk = idx(nx, nz);
        if (!this.net.type[nk] || this.map.height[nk] > 0) continue;
        // the portal stands on the edge between the mountain tile and the open road
        const g = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.14, 0.16), frame); top.position.set(0, 0.6, 0);
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.16), frame); l.position.set(-0.53, 0.3, 0);
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.16), frame); r.position.set(0.53, 0.3, 0);
        const hole = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.54, 0.02), dark); hole.position.set(0, 0.27, 0.07);
        g.add(top, l, r, hole);
        g.position.set(tileToWorld(x) + dx * 0.5, 0, tileToWorld(z) + dz * 0.5);
        g.rotation.y = Math.atan2(dx, dz);
        this.tunnelGroup.add(g);
      }
    }
  }

  /** Fly to a family's home and open it (from the town hall window). */
  private showFamily(f: Family) {
    const home = this.buildings.get(f.home);
    if (!home) return;
    this.cityReport?.hide();
    this.cam.setState(home.mesh.position.x, home.mesh.position.z, this.cam.yaw, Math.min(this.cam.viewHalf, 6));
    if (BUILDINGS[home.kind].units > 1) this.aptFamily = f.id;
    this.select({ type: 'building', id: home.id });
    this.beamT = 4;
  }

  /** Fly to a person (out and about, or at home) and open their card. */
  private showPerson(c: Citizen) {
    this.cityReport?.hide();
    const w = c.walker;
    const at = w ? { x: w.x, z: w.z } : this.buildings.get(c.at)?.mesh.position ?? this.buildings.get(this.pop.families.get(c.family)?.home ?? -1)?.mesh.position;
    if (at) this.cam.setState(at.x, at.z, this.cam.yaw, Math.min(this.cam.viewHalf, 5));
    this.select({ type: 'person', id: c.id });
  }

  /** People who live in one town and work in another: coming in (`into`) or going out. */
  private commuters(cityId: number, into: boolean) {
    let n = 0;
    for (const c of this.pop.citizens.values()) {
      if (c.job < 0) continue;
      const job = this.buildings.get(c.job), home = this.buildings.get(this.pop.families.get(c.family)?.home ?? -1);
      if (!job || !home || job.city === home.city) continue;
      if (into ? job.city === cityId : home.city === cityId) n++;
    }
    return n;
  }

  /**
   * A plane lands: it comes from one of the other towns on the map (visitors from there, and its goods: the town
   * sells what it has a lot of and buys what it lacks, at its own prices). With no other town the plane comes from abroad.
   */
  private planeLanded(b: Building, fromAirport?: Building) {
    const city = this.cityOf(b);
    const origin = fromAirport && !fromAirport.removed ? this.eco.cities.get(fromAirport.city) : undefined;
    if (origin && origin.id !== city.id) {
      // the plane flew here from that town's airport
      const from = origin;
      const pops = this.life.populationByCity();
      const visitors = Math.max(2, Math.min(20, Math.round((pops.get(from.id) ?? 0) * 0.08 + Math.random() * 4)));
      city.tourists += visitors;
      const deals: string[] = [];
      // the plane takes what this town has far too much of to the other town, if it needs it and can pay
      if (city.ai && from.ai) {
        const seller = city, buyer = from;
        for (const g of GOODS) {
          if (deals.length >= 3) break;
          const pc = pops.get(city.id) ?? 0, pf = pops.get(from.id) ?? 0;
          const extra = Math.floor(seller[g] - this.stockTarget(g, pc) * 1.5);
          const need = this.stockTarget(g, pf) - buyer[g];
          const room = this.eco.capacity(buyer, g) - buyer[g];
          if (extra >= 10 && need > 0 && room >= 10) {
            const n = Math.min(15, extra, Math.floor(need), Math.floor(room));
            const m = Math.round(n * this.midPrice(from, g, pf));
            if (buyer.money < m + 300) continue;
            this.eco.add(seller, g, -n, 'Sold by plane'); this.eco.add(buyer, g, n, 'Bought by plane');
            this.eco.add(buyer, 'money', -m, 'Purchases by plane'); this.eco.add(seller, 'money', m, 'Sales by plane');
            deals.push(t('sold {n} {what} (+${m})', { n, what: t(GOOD_NAME[g]).toLowerCase(), m }));
            if (!city.ai) this.deal(from.id, t('Plane: sold {n} {good}', { n, good: t(GOOD_NAME[g]).toLowerCase() }), m);
          }
        }
      }
      const log = this.airLog.get(b.id) ?? { flights: 0, last: '' };
      log.flights++;
      log.last = `${t('From {city}', { city: from.name })} · ${t('{n} visitors', { n: visitors })}${deals.length ? ' · ' + deals.join(', ') : ''}`;
      this.airLog.set(b.id, log);
      if (log.flights === 1) this.life.cityEvent(city.id, t('A plane from {from} landed in {city}: {n} visitors arrived', { from: from.name, city: city.name, n: visitors }) + (deals.length ? ` — ${deals.join(', ')}` : ''));
      return;
    }
    const tourists = 8 + Math.floor(Math.random() * 12);
    city.tourists += tourists;
    const deals: string[] = [];
    for (const [res, rule] of Object.entries(AIR_TRADE) as [keyof typeof AIR_TRADE, (typeof AIR_TRADE)['food']][]) {
      if (city[res] > rule.keep) {
        const n = Math.min(10, Math.floor(city[res] - rule.keep));
        this.eco.add(city, res, -n, 'Sold by plane');
        this.eco.add(city, 'money', n * rule.price, 'Sales by plane');
        deals.push(t('sold {n} {what} (+${m})', { n, what: t(res), m: n * rule.price }));
      } else if (city[res] < rule.low && city.money > 1500) {
        const n = 15, cost = n * rule.price * 2;
        this.eco.add(city, res, n, 'Bought by plane');
        this.eco.add(city, 'money', -cost, 'Purchases by plane');
        deals.push(t('bought {n} {what} (−${m})', { n, what: t(res), m: cost }));
      }
    }
    const log = this.airLog.get(b.id) ?? { flights: 0, last: '' };
    log.flights++;
    log.last = `${t('{n} tourists', { n: tourists })}${deals.length ? ' · ' + deals.join(', ') : ''}`;
    this.airLog.set(b.id, log);
    if (log.flights === 1) this.life.events.push(t('A plane landed in {city}: {n} tourists arrived', { city: city.name, n: tourists }) + (deals.length ? ` — ${deals.join(', ')}` : ''));
  }

  /** What a citizen is thinking about right now: their most pressing need, or how they feel. */
  thoughtOf(c: Citizen): [string, string] {
    const f = this.pop.families.get(c.family);
    const home = f ? this.buildings.get(f.home) : undefined;
    const city = home ? this.cityOf(home) : this.eco.city;
    const winter = seasonOf(monthOf(this.eco.day)) === 'winter';
    if (c.hunger < 30) return ['🍞', city.food < 10 ? 'I am hungry — there is no food in town' : 'I am hungry'];
    if (c.health < 40) return ['🤒', 'I feel ill — I need a doctor'];
    if ((c.energy ?? 80) < 30) return ['😴', 'So tired… I need a rest'];
    if (home && BUILDINGS[home.kind].energy && !home.powered) return ['⚡', 'We have no electricity at home'];
    if (city.water < 0.95) return ['💧', 'There is not enough clean water'];
    if (winter && city.wood < 10) return ['🥶', 'Our home is cold — the town has no firewood'];
    if (home && (home.trash ?? 0) >= TRASH.full) return ['🗑️', 'Our bin is overflowing — where is the garbage truck?'];
    if (this.pop.canWork(c) && c.job < 0) return ['💼', 'I need a job'];
    if (f?.car && c.age >= 18 && (c.noParking ?? -9) >= this.eco.day - 1) return ['🅿️', 'I could not find a parking space'];
    if (f?.car && c.age >= 18 && f.car.fuel < 30 && !this.buildings.list.some((b) => b.kind === 'gasstation' && b.city === city.id && b.built >= 1)) return ['⛽', 'There is no gas station in town — the tank is almost empty'];
    if (f && f.money < 0) return ['💸', 'We are in debt'];
    if (city.taxRate > 0.32) return ['😠', 'Taxes are too high'];
    if ((c.gambled ?? -99) >= this.eco.day - 2 && c.lost) return ['😣', 'I lost money at the casino again…'];
    if ((c.prayed ?? -99) >= this.eco.day - 2) return ['🤲', 'I feel at peace after prayer'];
    if (c.activity === 'Riding the bus') return ['🚌', 'Nice to ride the bus'];
    if (c.activity.includes('football')) return ['⚽', 'Come on, our team!'];
    if (c.activity === 'Playing') return ['🎈', 'Playing is fun!'];
    if (c.activity.endsWith('on a bench') || c.activity === 'Feeding the pigeons') return ['☕', 'What a lovely day'];
    if (c.paid) return ['💰', 'Got my wage today'];
    if (city.happiness > 70) return ['😊', 'Life in this town is good'];
    if (city.happiness < 40) return ['😟', 'Things are not going well in town'];
    return ['🙂', 'An ordinary day'];
  }

  /** Now and then someone walking near the middle of the view says what they think. */
  private thoughtBubbles() {
    if (this.demo || this.pov || this.drive?.active || this.cam.viewHalf > 14) return;
    const tg = this.cam.target, r = this.cam.viewHalf * 0.8;
    const near = [...this.pop.citizens.values()].filter((c) => c.walker && !c.walker.leaving && Math.abs(c.walker.x - tg.x) < r && Math.abs(c.walker.z - tg.z) < r);
    if (!near.length) return;
    const c = near[Math.floor(Math.random() * near.length)];
    this.overlays.bubble(c.walker!, this.thoughtOf(c)[0]);
  }

  /** Photo mode: hide the interface, keep a small bar to take a picture or leave. */
  togglePhoto() {
    if (!this.hud) return;
    this.photoMode = !this.photoMode;
    document.body.classList.toggle('photo-mode', this.photoMode);
    this.photoBar?.remove();
    this.photoBar = undefined;
    if (!this.photoMode) return;
    this.select(null);
    this.setTool('pan');
    const bar = document.createElement('div');
    bar.className = 'photo-bar';
    const btn = (label: string, fn: () => void, cls = 'btn-mini') => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.addEventListener('click', fn); return b; };
    bar.append(
      btn(t('Take photo (Enter)'), () => { this.shotPending = true; }),
      btn(t('Hide buttons'), () => bar.classList.toggle('hidden-ui'), 'btn-mini ghost'),
      btn(t('Exit (P)'), () => this.togglePhoto(), 'btn-mini ghost'),
    );
    this.hud.root.appendChild(bar);
    this.photoBar = bar;
  }

  /** Called by the renderer after a frame was drawn for a photo. */
  photoSaved() {
    this.shotPending = false;
    sound.play('complete');
    this.hud?.toast(t('Photo saved'));
  }

  /** Now and then the town hall has to decide something (random events). */
  private maybeDecide() {
    if (!this.decision || this.decision.visible || this.demo || this.eco.day - this.decisionDay < 3 || Math.random() > 0.35) return;
    const city = this.eco.city;
    const ctx: DecisionCtx = {
      city,
      freeHomes: this.life.freeHomes(city.id).length,
      hasFactory: this.buildings.list.some((b) => b.city === city.id && (b.kind === 'factory' || b.kind === 'carfactory') && b.workers > 0),
      has: (...kinds) => this.buildings.list.some((b) => b.city === city.id && kinds.includes(b.kind) && b.built >= 1 && (!BUILDINGS[b.kind].jobs || b.workers > 0)),
      people: this.life.populationByCity().get(city.id) ?? 0,
      add: (res, amount, reason) => this.eco.add(city, res, amount, reason),
      mood: (points, days) => {
        const old = this.life.moodBoost.get(city.id);
        const keep = old && old.until >= this.eco.day ? old.v : 0;
        this.life.moodBoost.set(city.id, { v: keep + points, until: Math.max(old && keep ? old.until : 0, this.eco.day + days) });
        // people feel it at once, and the reason shows up in the happiness breakdown
        city.happiness = Math.max(0, Math.min(100, city.happiness + points * 0.6));
        const row = city.mood.find((m) => m[0] === 'Town hall decisions');
        if (row) row[1] = keep + points; else city.mood.push(['Town hall decisions', keep + points]);
        this.refreshHud();
      },
      families: (n) => {
        let moved = 0;
        for (let i = 0; i < n; i++) {
          const free = this.life.freeHomes(city.id);
          if (!free.length) break;
          const f = this.pop.createFamily(free[0].id, { carChance: 0, money: 100 });
          this.pop.planDay(this.pop.members(f));
          moved++;
        }
        this.pop.assign(this.buildings);
        return moved;
      },
      heal: (points) => { for (const c of this.pop.citizens.values()) if (this.cityOfCitizen(c) === city.id) c.health = Math.min(100, c.health + points); },
      tourists: (n) => { city.tourists += n; },
      say: (text) => this.life.events.push(text),
    };
    // the made-up 'neighbouring town' letter only when there are no real neighbour towns on the map
    const realNeighbours = [...this.eco.cities.values()].some((c) => c.ai);
    const options = DECISIONS.filter((d) => (!d.when || d.when(ctx)) && !(d.id === 'neighbour' && realNeighbours) && d.id !== 'iron');
    // now and then a neighbour town writes to the town hall
    const towns = [...this.eco.cities.values()].filter((c) => c.ai);
    const town = towns[Math.floor(Math.random() * towns.length)];
    const wish = town && Math.random() < 0.3 ? this.autoCity.wish(town) : null;
    if (town && wish && Math.random() < 0.5) {
      // a neighbour town asks for help (or an investment) to build something it needs
      const bname = t(BUILDINGS[wish.kind].name).toLowerCase();
      const back = Math.round(wish.cost * 1.3);
      const fund = (text: string, rel: number) => {
        if (city.money < wish.cost) { this.hud?.toast(t('Not enough money')); return false; }
        this.eco.add(city, 'money', -wish.cost, 'Help to neighbour towns');
        this.eco.add(town, 'money', wish.cost, 'Help from a neighbour town');
        town.relation = Math.min(100, (town.relation ?? 40) + rel);
        this.autoCity.buildFunded(town, wish.kind, city.name);
        this.deal(town.id, text, -wish.cost);
        return true;
      };
      options.length = 0;
      options.push({
        id: 'neighbour', title: t('A letter from {city}', { city: town.name }),
        text: t('The mayor of {city} wants to build a {name} but the treasury is short. They ask you for ${m} — as help, or as an investment they will pay back.', { city: town.name, name: bname, m: wish.cost }),
        options: [
          { label: t('Help them'), note: t('−${m}, the {name} is built, they become much friendlier', { m: wish.cost, name: bname }), act: () => { fund(t('Helped to build a {name} (relations +15)', { name: bname }), 15); } },
          { label: t('Invest'), note: t('−${m} now, +${b} back in 15 days', { m: wish.cost, b: back }), act: () => {
            if (fund(t('Invested in a {name} — they pay back ${m}', { name: bname, m: back }), 5)) town.owes = { day: this.eco.day + 15, money: (town.owes?.money ?? 0) + back };
          } },
          { label: t('Refuse'), note: t('They will remember it'), act: () => { town.relation = Math.max(0, (town.relation ?? 40) - 5); this.deal(town.id, t('Refused to help build a {name} (relations −5)', { name: bname }), 0); } },
        ],
      });
    } else if (town && Math.random() < 0.3) {
      const need = town.food < 150 ? 'food' : town.wood < 60 ? 'wood' : 'stone';
      const amount = need === 'food' ? 80 : 30;
      const name = t(GOOD_NAME[need]).toLowerCase();
      options.length = 0;
      options.push({
        id: 'neighbour', title: t('A letter from {city}', { city: town.name }),
        text: t('The mayor of the neighbour town {city} asks for {n} {good}: their people are short of it. Friends trade more kindly.', { city: town.name, n: amount, good: name }),
        options: [
          { label: t('Send it as a gift'), note: t('−{n} {good}, they become much friendlier', { n: amount, good: name }), act: () => {
            if (city[need] < amount) return this.hud?.toast(t('Not enough to send'));
            this.eco.add(city, need, -amount, 'Gift to a neighbour town'); this.eco.add(town, need, amount, 'Gift from a neighbour town');
            town.relation = Math.min(100, (town.relation ?? 40) + 15);
            this.deal(town.id, t('Helped: gave {n} {good} (relations +15)', { n: amount, good: name }), 0);
          } },
          { label: t('Sell it to them'), note: t('+${m}, a little friendlier', { m: Math.round(amount * TRADE_PRICE[need] * 1.3) }), act: () => {
            const m = Math.round(amount * TRADE_PRICE[need] * 1.3);
            if (city[need] < amount || town.money < m) return this.hud?.toast(t('They cannot pay right now'));
            this.eco.add(city, need, -amount, 'Sold to a neighbour town'); this.eco.add(town, need, amount, 'Bought from a neighbour town');
            this.eco.add(town, 'money', -m, 'Trade with neighbour towns'); this.eco.add(city, 'money', m, 'Trade with neighbour towns');
            town.relation = Math.min(100, (town.relation ?? 40) + 4);
            this.deal(town.id, t('Sold {n} {good} on request (relations +4)', { n: amount, good: name }), m);
          } },
          { label: t('Refuse'), note: t('They will remember it'), act: () => { town.relation = Math.max(0, (town.relation ?? 40) - 10); this.deal(town.id, t('Refused their request for {good} (relations −10)', { good: name }), 0); } },
        ],
      });
    }
    let d = options[Math.floor(Math.random() * options.length)];
    if (d?.id === 'investor') d = this.investorDecision(city) ?? d;
    if (d?.id === 'concert') d = this.concertDecision(city) ?? d;
    if (d?.id === 'concert') return; // no concert hall: no concert
    if (!d) return;
    this.decisionDay = this.eco.day;
    sound.play('toast');
    this.decision.show(d, city.name, (i) => {
      const o = d.options[i];
      o.act(ctx);
      this.life.events.push(`${t(d.title)}: ${t(o.label)}`);
      this.refreshHud();
    });
  }

  private openLifeBook(c: Citizen) {
    const f = this.pop.families.get(c.family);
    this.lifeBook?.open({
      name: `${c.name} ${f?.surname ?? ''}`.trim(),
      subtitle: `${t('{n} years', { n: Math.floor(c.age) })} · ${this.professionOf(c)}`,
      icon: this.personIcon(c),
      // citizens from older saves have no diary yet: start it with their birth and current job
      story: c.story?.length ? c.story : [
        { d: this.eco.day - Math.floor(c.age * DAYS_PER_YEAR), a: 0, k: 'Born' },
        ...(c.job >= 0 && this.buildings.get(c.job) ? [{ d: this.eco.day, a: Math.floor(c.age), k: 'Started working at the {place}', p: { place: BUILDINGS[this.buildings.get(c.job)!.kind].name } }] : []),
      ],
      now: `${t(c.activity)} · ${this.roleText(c)}`,
    });
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
    const flats = BUILDINGS[b.kind].units > 1;
    const aptFam = flats && this.aptFamily !== null ? this.pop.families.get(this.aptFamily) : undefined;
    if (flats && (!aptFam || aptFam.home !== b.id)) this.aptFamily = null;
    if (b.kind === 'townhall') {
      this.inspector.hide();
      // opened fresh on the town hall tab; while open it keeps the tab the player chose
      if (!this.cityReport?.visible || this.cityReport.id !== b.city) this.cityReport?.open(b.city, 'hall');
      else this.cityReport.render();
      return;
    }
    const view = aptFam && aptFam.home === b.id ? this.familyView(aptFam, b) : flats ? this.apartmentView(b) : b.kind === 'house' ? this.houseView(b) : this.buildingView(b);
    const foreign = !!this.cityOf(b).ai;
    view.actions = foreign
      ? (view.actions ?? []).filter((a) => a.icon === 'info' || a.icon === 'people' || a.icon === 'house' || a.icon === 'roads')
      : [...(view.actions ?? []), ...this.buildingActions(b)];
    if (foreign && !view.actions.some((a) => a.icon === 'info')) view.actions.push({ label: t('Info'), icon: 'info', onClick: () => this.showInfo(b) });
    view.rows = [[t('Owner'), this.ownerText(b)], ...(view.rows ?? [])];
    if (b.kind === 'migration') {
      const arr = this.cityOf(b).arrivals ?? [];
      const month = arr.filter((a) => a.day > this.eco.day - 30).length;
      view.sections = [...(view.sections ?? []), { title: t('Newcomers'), rows: [[t('Registered in the last 30 days'), `${month} ${t('families')}`], [t('Effect'), t('+1 family a day, they come even at 40% happiness')]] }];
      const cid = b.city;
      const homeCity = (c: Citizen) => this.buildings.get(this.pop.families.get(c.family)?.home ?? -1)?.city;
      const inc = [...this.pop.citizens.values()].filter((c) => c.job >= 0 && this.buildings.get(c.job)?.city === cid && homeCity(c) !== cid);
      const out = [...this.pop.citizens.values()].filter((c) => c.job >= 0 && homeCity(c) === cid && this.buildings.get(c.job)?.city !== cid);
      view.sections.push({ title: t('Workers from other towns ({n})', { n: inc.length }), rows: inc.slice(0, 10).map((c) => [`${c.name} ${this.pop.families.get(c.family)?.surname ?? ''} · ${t('from {city}', { city: this.eco.cities.get(homeCity(c) ?? -1)?.name ?? '—' })}`, t(BUILDINGS[this.buildings.get(c.job)!.kind].name)] as [string, string]) },
        { title: t('Our people working in other towns ({n})', { n: out.length }), rows: out.slice(0, 10).map((c) => [`${c.name} ${this.pop.families.get(c.family)?.surname ?? ''} · ${t('in {city}', { city: this.cityOf(this.buildings.get(c.job)!).name })}`, t(BUILDINGS[this.buildings.get(c.job)!.kind].name)] as [string, string]) });
      if (inc.length > 10 || out.length > 10) view.sections.push({ title: '', rows: [[t('All of them'), t('Town hall → Migration')]] });
      view.listTitle = t('Registered families');
      view.people = arr.map((a) => {
        const fam = this.pop.families.get(a.family);
        const jobs = fam ? this.pop.members(fam).filter((m) => m.job >= 0).map((m) => t(BUILDINGS[this.buildings.get(m.job)?.kind ?? 'house'].name)) : [];
        return { id: -1, icon: '🧳', name: t('{name} family', { name: a.surname }), detail: `${dateLabel(a.day)} · ${t('from {city}', { city: a.from })} · ${jobs.length ? jobs.join(', ') : t('looking for work')}`, onClick: () => { if (fam) this.showFamily(fam); } };
      });
    }
    if (foreign) view.tags = [{ text: t('Neighbour town: {city}', { city: this.cityOf(b).name }), tone: 'info' }, ...(view.tags ?? [])];
    this.inspector.show(view);
  }

  /** Who owns a building: a family, the town hall of a town, or a neighbour town. */
  private ownerText(b: Building) {
    const city = this.cityOf(b);
    const fam = b.owner >= 0 ? this.pop.families.get(b.owner) : undefined;
    const town = city.ai ? t('Neighbour town {city}', { city: city.name }) : t('Town hall of {city}', { city: city.name });
    if (fam) return `${t('{family} family', { family: fam.surname })}${city.ai ? ` · ${city.name}` : ''}`;
    if (BUSINESS_KINDS.includes(b.kind)) return `${town} · ${t('for sale')}`;
    if (b.kind === 'house') {
      const res = this.pop.familyAt(b.id);
      return res ? `${town} · ${t('lived in by the {family} family', { family: res.surname })}` : town;
    }
    return town;
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
      { label: t('Take the wheel'), icon: 'car', onClick: () => this.startDrive({ x: v.x, z: v.z, heading: Math.atan2(v.hx, v.hz), color: v.color }) },
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
      subtitle: `${t(v.trip.kind === 'car' ? 'Car' : isTruck ? 'Truck' : 'Bus')} · ${speedKmh} ${t('km/h')}`,
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
    this.tool?.setRotation(rotToDir(b.rot));
    this.moving = b;
    this.select(null);
    this.hud?.toast(t('Choose a new place for the {name}', { name: t(BUILDINGS[b.kind].name) }));
  }

  /** Raise a school, hospital, water tower… one level: it serves more people (paid by the town). */
  upgradeBuilding(b: Building, quiet = false): boolean {
    if (!canUpgrade(b)) return false;
    const city = this.cityOf(b);
    const c = upgradeCost(b);
    if (city.money < c.money || city.stone < c.stone || city.wood < c.wood || city.iron < c.iron) {
      if (!quiet) this.hud?.toast(t('Needs {cost}', { cost: costText(c.money, c.stone, c.wood, c.iron) }));
      return false;
    }
    this.eco.add(city, 'money', -c.money, 'Upgrades'); this.eco.add(city, 'stone', -c.stone, 'Upgrades');
    this.eco.add(city, 'wood', -c.wood, 'Upgrades'); this.eco.add(city, 'iron', -c.iron, 'Upgrades');
    this.buildings.setLevel(b, (b.level || 1) + 1);
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, 1, 18, ['#f2b33d', '#fff6d6', '#bdb7aa']);
    this.pop.assign(this.buildings);
    if (!quiet) {
      sound.play('coin');
      this.hud?.toast(t('{name} is now level {n}: {gives}', { name: t(BUILDINGS[b.kind].name), n: b.level, gives: t(UPGRADABLE[b.kind]!.gives).toLowerCase() }));
      this.refreshInspector();
    }
    return true;
  }

  private upgradeCemetery(b: Building): boolean | void {
    const city = this.cityOf(b);
    const u = CEMETERY_UPGRADE;
    if (b.level >= u.maxLevel || b.built < 1) return false;
    const m = u.money * b.level, s = u.stone * b.level, w = u.wood * b.level;
    if (city.money < m || city.stone < s || city.wood < w) return this.hud?.toast(t('Needs {cost}', { cost: costText(m, s, w) }));
    this.eco.add(city, 'money', -m, 'Cemetery expansion'); this.eco.add(city, 'stone', -s, 'Cemetery expansion'); this.eco.add(city, 'wood', -w, 'Cemetery expansion');
    // the cemetery grows: a new walled plot next to it
    const sz = BUILDINGS.cemetery.size;
    const spots = [[b.x + sz, b.z], [b.x - sz, b.z], [b.x, b.z - sz], [b.x, b.z + sz], ...(b.ext ?? []).flatMap((id) => {
      const e = this.buildings.get(id);
      return e ? [[e.x + sz, e.z], [e.x - sz, e.z], [e.x, e.z - sz], [e.x, e.z + sz]] : [];
    })];
    const spot = spots.find(([x, z]) => this.buildings.check('cemeteryext', x, z).ok);
    if (!spot) { this.eco.add(city, 'money', m, 'Cemetery expansion'); this.eco.add(city, 'stone', s, 'Cemetery expansion'); this.eco.add(city, 'wood', w, 'Cemetery expansion'); return this.hud?.toast(t('No room next to the cemetery to expand')); }
    const ext = this.buildings.place('cemeteryext', spot[0], spot[1], { city: b.city, built: 1 });
    ext.parent = b.id;
    (b.ext ??= []).push(ext.id);
    this.terrain.clearTiles(this.buildings.footprint('cemeteryext', spot[0], spot[1]).map((f) => idx(f.x, f.z)));
    this.buildings.setLevel(b, b.level + 1);
    this.networkChanged();
    this.effects.puff(b.mesh.position.x, b.mesh.position.z, 1, 16, ['#bdb7aa', '#8c8a87', '#4f8a3a']);
    if (!city.ai) this.hud?.toast(t('Cemetery upgraded — it now holds {n} graves', { n: GRAVES_PER_PLOT * b.level }));
    this.refreshInspector();
    return true;
  }

  /** The game day a person was born (their age is counted in months, one game day each). */
  private bornDay(c: Citizen) { return Math.floor(this.eco.day - c.age * 12); }

  /** Age as people count it: this year minus the year of birth. */
  private ageOf(c: Citizen) { return calendarYear(this.eco.day) - calendarYear(this.bornDay(c)); }

  private personView(c: Citizen): InspectorView {
    const f = this.pop.families.get(c.family);
    const home = f && this.buildings.get(f.home);
    const age = this.ageOf(c);
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
    // ---- the ID card ----
    const town = home ? this.cityOf(home) : this.eco.city;
    const hash = (n: number) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
    // born that many months ago (one game day is one month): shown as month and year, e.g. "May 2004"
    const born = this.bornDay(c);
    const firstPlace = c.story?.find((s) => s.p && typeof s.p.city === 'string')?.p?.city as string | undefined;
    const letters = (town.name.replace(/[^A-Za-z]/g, '').toUpperCase() + 'XX').slice(0, 2);
    const number = `${letters}${String(hash(c.id) % 10000000).padStart(7, '0')}`;
    const latin = (s: string) => s.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
    const mrz1 = `P<${latin(town.name).slice(0, 3).padEnd(3, '<')}${latin(f?.surname ?? '')}<<${latin(c.name)}`.padEnd(44, '<').slice(0, 44);
    const mrz2 = `${number}<${latin(town.name).slice(0, 3).padEnd(3, '<')}${String(calendarYear(born)).slice(2)}${String(monthOf(born) + 1).padStart(2, '0')}${c.sex === 'm' ? 'M' : 'F'}`.padEnd(44, '<').slice(0, 44);
    const female = c.sex !== 'm';
    const passport = {
      town: town.name, tint: town.tint ?? '#2f6b4f',
      photo: { skin: female ? SKIN[(c.variant - 3) % 4] ?? SKIN[0] : SKIN[c.variant % 4], cloth: female ? DRESSES[c.variant - 4] ?? DRESSES[0] : SHIRTS[c.variant] ?? SHIRTS[0], hair: female ? '#4a2c1a' : '#3a2a20', female },
      surname: f?.surname ?? '—', name: c.name, sex: c.sex === 'm' ? t('Male') : t('Female'),
      birth: dateLabel(born), birthplace: firstPlace ?? town.name, number, mrz: [mrz1, mrz2] as [string, string],
    };
    // ---- personal details ----
    const members = f ? this.pop.members(f) : [];
    const spouse = c.role === 'parent' ? members.find((m) => m.id !== c.id && m.role === 'parent') : undefined;
    const kids = c.role !== 'child' ? members.filter((m) => m.role === 'child') : [];
    const parents = c.role === 'child' ? members.filter((m) => m.role === 'parent') : [];
    const workplace = c.job >= 0 ? this.buildings.get(c.job) : undefined;
    const pay = workplace ? this.pop.wage(c, workplace) : 0;
    const eduText = c.skill === 2 ? t('University degree') : c.skill === 1 ? t('Learnt a trade') : c.edu >= 0.99 ? t('School finished') : age < 6 ? t('Too young for school') : c.school >= 0 ? t('Studying ({n}%)', { n: Math.round(c.edu * 100) }) : t('No education');
    const personal: [string, string, ('good' | 'bad')?][] = [
      [t('Age'), t('{n} years', { n: age })],
      [t('Marital status'), age < 18 ? t('Child') : spouse ? (c.sex === 'm' ? t('Married to {name}', { name: spouse.name }) : t('Married to {name}', { name: spouse.name })) : t('Single')],
      ...(kids.length ? [[t('Children'), kids.map((k) => `${k.name} (${this.ageOf(k)})`).join(', ')] as [string, string]] : []),
      ...(parents.length ? [[t('Parents'), parents.map((k) => k.name).join(', ')] as [string, string]] : []),
      [t('Education'), eduText, c.skill === 2 ? 'good' : undefined],
      [t('Faith'), believer(c) ? t('Believer') : t('Not religious')],
      [t('Health'), c.health >= 80 ? t('Healthy') : c.health >= 50 ? t('Feels unwell') : t('Ill'), c.health < 50 ? 'bad' : c.health >= 80 ? 'good' : undefined],
      [t('Address'), home ? `${t(BUILDINGS[home.kind].name)} · ${this.cityOf(home).name}` : t('No home'), home ? undefined : 'bad'],
    ];
    const work: [string, string, ('good' | 'bad')?][] = age >= 18 || c.job >= 0 ? [
      [t('Profession'), this.professionOf(c)],
      [t('Workplace'), workplace ? `${t(BUILDINGS[workplace.kind].name)} · ${this.cityOf(workplace).name}` : c.role === 'elder' ? t('Retired') : t('Unemployed'), workplace || c.role === 'elder' ? undefined : 'bad'],
      ...(workplace ? [[t('Wage'), `$${pay.toFixed(1)}/${t('day')}${c.night ? ` · ${t('night shift')}` : ''}`] as [string, string]] : []),
      ...(f ? [[t('Family income'), `$${Math.round(f.income).toLocaleString('en-US')}/${t('day')}`, f.income < 0 ? 'bad' : undefined] as [string, string, ('good' | 'bad')?]] : []),
      ...(f?.loan ? [[t('Bank loan'), `$${Math.round(f.loan).toLocaleString('en-US')}`, 'bad'] as [string, string, ('good' | 'bad')?]] : []),
      [t('Transport'), f?.car ? t('Family car') : f?.bike ? t('Bicycle') : t('On foot')],
    ] : [];
    return {
      key: `p${c.id}`,
      passport,
      sections: [{ title: t('Personal details'), rows: personal }, ...(work.length ? [{ title: t('Work and money'), rows: work }] : [])],
      badge: this.personIcon(c),
      badgeColor: c.sex === 'm' ? '#3a6fd1' : '#d9568f',
      title: `${c.name} ${f?.surname ?? ''}`,
      subtitle: `${t('{n} years', { n: age })} · ${this.roleText(c)}`,
      tags,
      bars: [
        { label: t('Food'), value: c.hunger / 100, color: barColor(c.hunger / 100) },
        { label: t('Health'), value: c.health / 100, color: barColor(c.health / 100) },
        { label: t('Energy'), value: (c.energy ?? 80) / 100, color: (c.energy ?? 80) > 40 ? '#ffd166' : '#ff6b5e' },
        ...(age >= 6 ? [{ label: t('Education'), value: c.edu, color: '#6fb6ff' }] : []),
      ],
      rows: [
        [t('Doing'), t(c.activity)],
        [t('Thinks'), `${this.thoughtOf(c)[0]} ${t(this.thoughtOf(c)[1])}`],
        [t('Profession'), this.professionOf(c)],
        ...(c.night ? [[t('Shift'), t('Night shift (+50% pay)')] as [string, string]] : []),
        [t('Home'), f ? t('{name} family', { name: f.surname }) : '—'],
        ...(f ? this.buildings.list.filter((x) => x.owner === f.id && !x.removed).map((x) => [t('Family business'), `${t(BUILDINGS[x.kind].name)} · ${this.cityOf(x).name}${x.sales ? ` · $${Math.round(x.sales)}` : ''}`, 'good'] as [string, string, ('good' | 'bad')?]) : []),
        [t('City'), home ? this.cityOf(home).name : '—'],
        [c.school >= 0 ? t('School') : t('Workplace'), job ? t(BUILDINGS[job.kind].name) : '—'],
        [t('Family savings'), f ? `$${Math.floor(f.money).toLocaleString('en-US')}` : '—', f && f.money < 0 ? 'bad' : undefined],
      ],
      actions: [
        { label: this.following ? t('Stop following') : t('Follow'), icon: 'follow', active: this.following, onClick: () => { this.following = !this.following; this.refreshInspector(); } },
        { label: t("Citizen's eyes"), icon: 'eye', onClick: () => this.enterPov({ type: 'person', id: c.id }) },
        { label: t('Life story'), icon: 'book', onClick: () => this.openLifeBook(c) },
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
    const units = BUILDINGS[b.kind].units;
    return {
      key: `b${b.id}`, badge: '🏢', badgeColor: KIND_BADGE[b.kind][1], title: t(BUILDINGS[b.kind].name),
      subtitle: t('{a} of {b} flats taken', { a: families.length, b: units }),
      tags: b.built < 1 ? [{ text: t('Under construction'), tone: 'info' }] : [],
      bars: [{ label: t('Flats'), value: families.length / units, color: '#6fb6ff', text: `${families.length}/${units}` }],
      rows: [
        [t('City'), this.cityOf(b).name],
        [t('Owner'), owner ? t('{name} family', { name: owner.surname }) : t('City-owned')],
        [t('Rent'), `$${RENT}/${t('day')} ${t('per flat')}`],
        [t('Power'), b.powered ? t('Yes') : t('No'), b.powered ? 'good' : 'bad'],
      ],
      listTitle: t('Families'),
      people: families.map((f, i) => {
        const m = this.pop.members(f);
        return {
          id: -1, icon: '👪', name: t('{name} family', { name: f.surname }),
          detail: `${t('Flat {n}', { n: i + 1 })} · ${t('{n} people', { n: m.length })} · $${Math.floor(f.money).toLocaleString('en-US')}`,
          warn: m.some((c) => c.hunger < 25 || c.health < 50),
          onClick: () => { this.aptFamily = f.id; this.refreshInspector(); },
        };
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
    return this.familyView(f, b);
  }

  /** A family's panel: in their house, or a flat of an apartment block. */
  private familyView(f: Family, b: Building): InspectorView {
    const inFlat = BUILDINGS[b.kind].units > 1;
    const people = this.pop.members(f).sort((a, c) => c.age - a.age);
    const avg = (fn: (c: Citizen) => number) => people.reduce((a, c) => a + fn(c), 0) / Math.max(1, people.length);
    const car = f.car ? (f.car.at === 'home' ? t('Parked at home') : f.car.at === 'away' ? t('Parked at work') : t('On the road')) : t('No car — they walk');
    return {
      key: `b${b.id}f${f.id}`,
      badge: inFlat ? '🏢' : '🏠',
      badgeColor: KIND_BADGE[b.kind][1],
      title: t('{name} family', { name: f.surname }),
      subtitle: inFlat ? `${t('Apartment Block')} · ${t('{n} people', { n: people.length })}` : t('{n} people', { n: people.length }),
      actions: inFlat ? [{ label: t('Back to the building'), icon: 'office', onClick: () => { this.aptFamily = null; this.refreshInspector(); } }] : undefined,
      bars: [
        { label: t('Food'), value: avg((c) => c.hunger) / 100, color: barColor(avg((c) => c.hunger) / 100) },
        { label: t('Health'), value: avg((c) => c.health) / 100, color: barColor(avg((c) => c.health) / 100) },
      ],
      rows: [
        [t('Savings'), `$${Math.floor(f.money).toLocaleString('en-US')}`, f.money < 0 ? 'bad' : undefined],
        [t('Food at home'), `${Math.floor(f.pantry ?? 0)} · ${t('bought in the shops')}`, (f.pantry ?? 0) < f.members.length * 0.5 ? 'bad' : 'good'],
        [t('Earned yesterday'), `${f.income >= 0 ? '+' : '−'}$${Math.abs(f.income)}`, f.income >= 0 ? 'good' : 'bad'],
        [t('Car'), car],
        ...this.buildings.list.filter((x) => x.owner === f.id).map((x) => [t('Owns'), t(BUILDINGS[x.kind].name), 'good'] as [string, string, ('good' | 'bad')?]),
        [t('Power'), b.powered ? t('Yes') : t('No — not connected to a power plant'), b.powered ? 'good' : 'bad'],
        [t('City'), this.cityOf(b).name],
        ...(() => {
          const nd = this.life.homeNeeds(b);
          const rows: [string, string, ('good' | 'bad')?][] = [[t('Home level'), `${b.level} / 3`]];
          if (b.kind === 'house' && b.level < 3) rows.push([t('Needed for the next floor'), nd.missing.length ? nd.missing.map((m) => t(m)).join(', ') : t('Everything — it will grow soon'), nd.missing.length ? 'bad' : 'good']);
          return rows;
        })(),
        [t('Air'), (this.life.pollution.get(b.id) ?? 0) > 1.5 ? t('Smog — people get sick') : t('Clean'), (this.life.pollution.get(b.id) ?? 0) > 1.5 ? 'bad' : 'good'],
        [t('Water'), this.cityOf(b).water >= 0.99 ? t('Clean water') : t('Not enough water!'), this.cityOf(b).water >= 0.99 ? 'good' : 'bad'],
      ],
      sections: (() => {
        const out: NonNullable<InspectorView['sections']> = [];
        const y = Object.entries(f.earnY ?? {}).filter(([, v]) => Math.abs(v) >= 0.5).sort((a2, b2) => b2[1] - a2[1]);
        const today = Object.entries(f.earn ?? {}).filter(([, v]) => Math.abs(v) >= 0.5).sort((a2, b2) => b2[1] - a2[1]);
        out.push({ title: t('Income yesterday'), rows: y.length ? [...y.map(([k, v]) => [t(k), `+$${Math.round(v).toLocaleString('en-US')}`, 'good'] as [string, string, 'good']), [t('Total'), `$${Math.round(y.reduce((a2, [, v]) => a2 + v, 0)).toLocaleString('en-US')}`]] : [[t('Total'), '$0']] });
        if (today.length) out.push({ title: t('Income so far today'), rows: [...today.map(([k, v]) => [t(k), `+$${Math.round(v).toLocaleString('en-US')}`, 'good'] as [string, string, 'good']), [t('Total'), `$${Math.round(today.reduce((a2, [, v]) => a2 + v, 0)).toLocaleString('en-US')}`]] });
        if (f.bills) out.push({ title: t('Bills yesterday'), rows: [[t('Electricity'), `−$${f.bills.electricity}`], [t('Water'), `−$${f.bills.water}`]] });
        const biz = this.buildings.list.filter((x) => x.owner === f.id && !x.removed);
        if (biz.length) out.push({ title: t('Family businesses ({n})', { n: biz.length }), rows: biz.map((x) => [`${t(BUILDINGS[x.kind].name)} · ${this.cityOf(x).name}`, x.books ? `${x.workers}/${BUILDINGS[x.kind].jobs} · +$${x.books.profit}` : `${x.workers}/${BUILDINGS[x.kind].jobs}`, x.books && x.books.profit > 0 ? 'good' : undefined] as [string, string, ('good' | 'bad')?]) });
        return out;
      })(),
      listTitle: t('Family members'),
      people: people.map((c) => ({
        id: c.id, icon: this.personIcon(c), name: c.name, warn: c.hunger < 25 || c.health < 50,
        detail: `${t('{n} years', { n: Math.floor(c.age) })} · ${this.roleText(c)} · ${t(c.activity)}`,
      })),
    };
  }

  /** Everything about a building in one card. */
  private showInfo(b: Building) {
    const d = BUILDINGS[b.kind];
    const city = this.cityOf(b);
    const item = ITEMS.find((i) => i.tool === b.kind);
    const owner = b.owner >= 0 ? this.pop.families.get(b.owner) : undefined;
    const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
    const cost: [string, string][] = [[t('Money'), money(d.money)]];
    if (d.stone) cost.push([t('Stone'), `${d.stone}`]);
    if (d.wood) cost.push([t('Wood'), `${d.wood}`]);
    if (d.iron) cost.push([t('Iron'), `${d.iron}`]);
    cost.push([t('Size'), `${d.size}×${d.size}`], [t('Needs a road'), d.needsRoad ? t('Yes') : t('No')], [t('Build time'), t('{n} hours', { n: Math.round(BUILD_DAYS[d.size] * 24 * 10) / 10 })]);
    const work: [string, string][] = [];
    if (d.jobs) {
      const pay = d.salary * (city.wages[b.kind] ?? 1);
      work.push([t('Jobs'), `${b.workers}/${d.jobs}`], [t('Wage'), `${money(pay)}/${t('day')}${city.wages[b.kind] ? ` (${city.wageAuto ? t('auto') : t('manual')})` : ''}`],
        [t('Paid by'), d.publicJob ? t('Town hall') : owner ? t('{family} family', { family: owner.surname }) : t('The business')]);
      const jobs = PROFESSIONS[b.kind];
      if (jobs) work.push([t('Professions'), jobs.filter(Boolean).map((j) => t(j!)).join(', ')]);
    }
    const nums: [string, string][] = [];
    if (d.energy) nums.push([t('Electricity use'), kw(d.energy * (b.kind === 'house' ? b.level : 1))]);
    if (d.power) nums.push([t('Electricity made'), `${kw(b.output ?? 0)} / ${kw(d.power)}`]);
    if (d.food) nums.push([t('Food output'), t('up to {n}/day', { n: d.food })]);
    if (d.water) nums.push([t('Water for'), t('{n} people', { n: d.water })]);
    if (d.students) nums.push([t('Places'), `${d.students}`]);
    if (d.units) nums.push([t('Homes'), `${d.units}`], [t('People per home'), `${d.housing}`]);
    if (d.revenue) nums.push([t('Turnover'), `${money(d.revenue)}/${t('day')}`]);
    if (d.upkeep) nums.push([t('Upkeep'), `${money(d.upkeep)}/${t('day')}`]);
    if (d.heal) nums.push([t('Health'), `+${d.heal}`]);
    if (DECOR[b.kind]) nums.push([t('Beauty'), `+${DECOR[b.kind]}`]);
    if (POLLUTERS[b.kind]) nums.push([t('Air pollution'), `${POLLUTERS[b.kind]}`]);
    const visit = VISIT_PRICE[b.kind] ?? SHOP_PRICE[b.kind];
    if (visit) nums.push([t('A visit costs'), `$${visit[0]}–${visit[1]}`]);
    const state: [string, string][] = [[t('City'), city.name], [t('Built'), b.built >= 1 ? t('Yes') : `${Math.round(b.built * 100)}%`]];
    if (owner) state.push([t('Owner'), t('{family} family', { family: owner.surname })]);
    if (d.energy) state.push([t('Electricity'), b.powered ? t('Powered') : t('No power')]);
    if (d.needsRoad) state.push([t('Road'), b.access >= 0 ? t('Connected') : t('No road access')]);
    this.hud?.info(t(d.name), `${KIND_BADGE[b.kind][0]} #${b.id}`, item ? t(item.desc) : '', [
      { title: t('Building cost'), rows: cost }, { title: t('Work'), rows: work }, { title: t('Numbers'), rows: nums }, { title: t('Right now'), rows: state },
    ]);
  }

  private buildingView(b: Building): InspectorView {
    const def = BUILDINGS[b.kind];
    const city = this.cityOf(b);
    const staff = [...this.pop.citizens.values()].filter((c) => c.job === b.id);
    const tags: InspectorView['tags'] = [];
    const rows: InspectorView['rows'] = [];
    const bars: InspectorView['bars'] = [];
    rows.push([t('City'), city.name]);
    // every business shows yesterday's accounts (shops, the casino, the hotel, factories…)
    // a business that has not closed a day yet: nothing yesterday, and what it has taken so far today
    if (!b.books && (b.owner >= 0 || BUSINESS_KINDS.includes(b.kind) || SHOP_PRICE[b.kind] || VISIT_PRICE[b.kind] || BUILDINGS[b.kind].revenue)) rows.push([t('Takings yesterday'), '$0'], [t('Takings so far today'), `$${Math.round(b.sales ?? 0).toLocaleString('en-US')}`]);
    if (b.books) {
      const bk = b.books;
      const cash = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
      const list = (it?: Record<string, number>) => Object.entries(it ?? {}).filter(([, n]) => n >= 0.5).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${t(k)}: ${Math.round(n).toLocaleString('en-US')}`).join(' · ');
      if (bk.revenue || b.owner >= 0) rows.push([t('Takings yesterday'), cash(bk.revenue)]);
      else rows.push([t('Takings yesterday'), t('None (the town pays the wages)')]);
      rows.push([t('Wages paid'), `−${cash(bk.wages)}`]);
      if (bk.tax) rows.push([t('Tax paid'), `−${cash(bk.tax)}`]);
      if (b.owner >= 0) rows.push([t("Owner's profit"), `${bk.profit >= 0 ? '+' : '−'}${cash(Math.abs(bk.profit))}`, bk.profit > 0 ? 'good' : 'bad']);
      if (list(bk.items)) rows.push([t('Sold or made yesterday'), list(bk.items)]);
      if (b.total && b.total.days > 1) {
        if (b.total.revenue) rows.push([t('Takings since opening ({n} days)', { n: b.total.days }), cash(b.total.revenue)]);
        if (list(b.total.items)) rows.push([t('Sold or made since opening'), list(b.total.items)]);
      }
      if (b.owner >= 0 && BUILDINGS[b.kind].jobs) rows.push([t('Pay set by the owner'), `$${(BUILDINGS[b.kind].salary * (b.wageF ?? 1)).toFixed(1)}/${t('day')}`]);
    }
    const actions: NonNullable<InspectorView['actions']> = [];
    if (b.built < 1) {
      tags.push({ text: t('Under construction'), tone: 'info' });
      bars.push({ label: t('Construction'), value: b.built, color: '#f2b33d' });
      const crew = this.life.crewSize(b);
      const why = this.life.siteProblem(b);
      rows.push([t('Builders on site'), `${crew}`, crew ? 'good' : 'bad']);
      if (why) rows.push([t('Status'), t(why), why === 'Builders are on their way' ? undefined : 'bad']);
    }
    if (b.fire > 0) tags.push({ text: t('On fire!'), tone: 'bad' });
    if (def.energy) {
      tags.push(b.powered ? { text: t('Powered'), tone: 'good' } : { text: t('No power'), tone: 'bad' });
      rows.push([t('Electricity use'), kw(def.energy * (b.kind === 'house' ? b.level : 1)), b.powered ? 'good' : 'bad']);
    }
    actions.push({ label: t('Info'), icon: 'info', onClick: () => this.showInfo(b) });
    if (def.needsRoad && b.access < 0) tags.push({ text: t('No road access'), tone: 'bad' });
    const up = UPGRADABLE[b.kind];
    if (up && b.built >= 1) {
      rows.push([t('Level'), `${b.level || 1}/${up.max} · ×${levelMult(b).toFixed(2)}`]);
      if (def.students) rows.push([t('Places'), `${seatsOf(b)}`]);
      if (b.kind === 'watertower') rows.push([t('Serves'), t('up to {n} people', { n: waterOf(b) })]);
      if (canUpgrade(b)) {
        const c = upgradeCost(b);
        actions.push({ label: `${t('Upgrade to level {n}', { n: (b.level || 1) + 1 })} · ${costText(c.money, c.stone, c.wood, c.iron)}`, icon: 'up', onClick: () => this.upgradeBuilding(b) });
      }
    }
    if (def.jobs) {
      bars.push({ label: t('Workers'), value: staff.length / def.jobs, color: '#6fb6ff', text: `${staff.length}/${def.jobs}` });
      const wf = city.wages[b.kind] ?? 1;
      rows.push([t('At work now'), `${b.present}`], [t('Wage'), `$${Math.round(def.salary * wf * 10) / 10}/${t('day')}${wf !== 1 ? ` (${wf > 1 ? '+' : ''}${Math.round((wf - 1) * 100)}%)` : ''}${def.publicJob ? ` · ${t('paid by town')}` : ''}`]);
      const skilled = DEGREE_JOBS[b.kind];
      rows.push([t('Who can work here'), skilled ? t('Needs a diploma (school or university)') : t('Anyone of working age')]);
    }
    let subtitle = t(def.name);
    if (b.kind === 'farm') {
      const growing = growingSeason(monthOf(this.eco.day));
      tags.push(b.irrigated ? { text: t('Irrigated'), tone: 'good' } : { text: t('No water — dig a canal'), tone: 'bad' });
      if (!growing) tags.push({ text: t('Winter rest'), tone: 'info' });
      const crop = b.cropKind ?? 'wheat';
      bars.push({ label: t(CROPS[crop].name), value: b.cropT, color: CROPS[crop].ripe });
      rows.push([t('Growing'), t(CROPS[crop].name)], [t('Gives'), t(CROPS[crop].gives)], [t('Who chooses'), b.cropManual || !this.cityOf(b).ai ? t('You') : t('The farmers (what the town needs)')]);
      subtitle = growing ? (b.irrigated ? t('Growing {crop}', { crop: t(CROPS[crop].name).toLowerCase() }) : t('Dry field')) : t('Resting until spring');
      // the farmer can sow something else (the field starts over)
      for (const k of Object.keys(CROPS) as CropKind[]) {
        if (k === crop) continue;
        actions.push({ label: `${t('Sow')} ${t(CROPS[k].name).toLowerCase()}`, icon: 'farm', onClick: () => { b.cropKind = k; b.cropManual = true; b.cropT = 0; this.buildings.updateCrop(b); this.hud?.toast(t('The field will now grow {crop}', { crop: t(CROPS[k].name).toLowerCase() })); this.select({ type: 'building', id: b.id }); } });
      }
    }
    if (def.food) rows.push([t('Food output'), t('up to {n}/day', { n: def.food })]);
    rows.push(...this.stockRows(b, city));
    if (def.power) {
      bars.push({ label: t('Output now'), value: (b.output ?? 0) / def.power, color: '#ffe066', text: `${kw(b.output ?? 0)} / ${kw(def.power)}` });
      rows.push([t('All plants make'), kw(city.energyCapacity)], [t('The town uses'), kw(city.energyDemand), city.energyDemand > city.energyCapacity ? 'bad' : 'good'],
        [t('Buildings fed'), `${this.life.gridMates(b).length}`]);
      if (b.kind === 'powerplant') rows.push([t('Wood in stock'), `${Math.floor(city.wood)}`, city.wood < 15 ? 'bad' : undefined]);
      if (b.kind === 'coalplant') rows.push([t('Coal in stock'), `${Math.floor(city.coal)}`, city.coal < 5 ? 'bad' : undefined]);
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
    if (b.sold && Object.keys(b.sold).length) rows.push([t('So far today'), Object.entries(b.sold).filter(([, n]) => n >= 0.5).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${t(k)}: ${Math.round(n)}`).join(' · ') || '—']);
    if (b.kind === 'quarry') {
      bars.push({ label: t('Stone ready'), value: b.stored / QUARRY.maxStored, color: '#aab4be', text: `${Math.floor(b.stored)}/${QUARRY.maxStored}` });
      rows.push([t('Trucks'), `${b.trucks}/2`]);
    }
    if (def.slots.length && b.kind !== 'house') rows.push([t('Parking'), `${this.life.spotsUsed(b)}/${def.slots.length}`]);
    if (b.kind === 'parking') rows.push([t('Parking ticket'), t('${n} per car, paid to the town hall', { n: SERVICE_FEE.parking })]);
    if (b.kind === 'farm' || b.kind === 'orchard' || b.kind === 'ranch') {
      const k = idx(b.x, b.z), grow = this.map.growth(k);
      rows.push([t('Climate'), `${t(this.map.climate(k))} · ${t('crops {n}%', { n: Math.round(grow * 100) })}`, grow < 0.9 ? 'bad' : 'good']);
    }
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
      rows.push([t('Feed source'), b.cornFed ? t('Corn from the fields (+30%)') : t('Food from the stores — sow corn for better feed'), b.cornFed ? 'good' : undefined], [t('Corn feed in stock'), `${Math.floor(city.feed)}`]);
    }
    if (b.kind === 'busstop') {
      const waiters = this.life.busWaitersAtStop(b.id);
      bars.push({ label: t('Waiting passengers'), value: Math.min(1, waiters.length / 8), color: '#d9a92a', text: `${waiters.length} ${t('people')}` });
      rows.push([t('Public transport'), t('Active bus stop')]);
    }
    if (def.jobs && b.workers === 0 && b.built >= 1) {
      // explain the empty building
      const m = city.migration;
      rows.push([t('Why nobody works here'), m && m.unemployed === 0 ? t('Every worker in town already has a job') : t('Other jobs have a higher priority'), 'bad']);
      if (m?.reasons.length) rows.push([t('Blocks newcomers'), t(m.reasons[0]), 'bad']);
      rows.push([t('What to do'), t("Build homes so families move in, or raise this job's priority in Statistics → Jobs")]);
    }
    if (b.kind === 'watertower') {
      const people = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === b.city).reduce((a, f) => a + f.members.length, 0);
      const towers = this.buildings.list.filter((x) => x.kind === 'watertower' && x.city === b.city).length;
      rows.push([t('Serves'), t('up to {n} people', { n: BUILDINGS.watertower.water })], [t('People in town'), `${people}`, people > towers * BUILDINGS.watertower.water ? 'bad' : 'good'], [t('Towers needed'), `${Math.ceil(people / BUILDINGS.watertower.water)} (${t('you have {n}', { n: towers })})`, people > towers * BUILDINGS.watertower.water ? 'bad' : 'good']);
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
      for (const m of lz.matches.slice(0, 4)) rows.push([`${dateLabel(m.day)}`, `${m.home} ${m.hs}:${m.as} ${m.away}`]);
      if (!lz.matches.length) rows.push([t('Results'), t('No matches yet')]);
    }
    if (b.kind === 'airport') {
      const log = this.airLog.get(b.id);
      rows.push([t('Flights today'), `${log?.flights ?? 0}`], [t('Last plane'), log?.last ?? t('No flights yet')]);
      rows.push([t('Effect'), t('Tourists fly in, surplus goods are sold abroad, missing goods are bought')]);
      if (!b.workers) rows.push([t('Status'), t('Closed — no staff'), 'bad']);
    }
    if (b.kind === 'cinema') rows.push([t('Show time'), '19:00 – 23:00'], [t('Ticket'), `$${CINEMA.ticket}`], [t('Seats'), `${CINEMA.seats}`]);
    if (b.kind === 'bank') {
      const st = this.life.bankStats.get(b.city);
      rows.push([t('Savings in the bank'), st ? `$${Math.round(st.deposits)}` : '—'], [t('Savers'), `${st?.savers ?? 0}`],
        [t('Family loans'), st ? `$${Math.round(st.loans)}` : '—'], [t('Borrowers'), `${st?.borrowers ?? 0}`],
        [t('Interest paid to savers'), st ? `$${Math.round(st.paid)}` : '—'], [t('Interest earned on loans'), st ? `$${Math.round(st.earned)}` : '—', 'good'],
        [t('Town hall loan'), city.loan ? `$${city.loan}` : t('None'), city.loan ? 'bad' : undefined]);
      rows.push([t('How it works'), t('Families save here and earn interest; families borrow to build houses and businesses. The town hall can borrow too.')]);
      if (b.built >= 1 && city.loan + LOAN.step <= LOAN.max) actions.push({ label: `${t('Take loan')} $${LOAN.step}`, icon: 'coin', onClick: () => { city.loan += LOAN.step; this.eco.add(city, 'money', LOAN.step, 'Bank loan'); this.refreshInspector(); this.refreshHud(); } });
      if (city.loan > 0) actions.push({ label: `${t('Repay')} $${Math.min(LOAN.step, city.loan)}`, icon: 'coin', onClick: () => { const pay = Math.min(LOAN.step, city.loan); if (city.money < pay) return this.hud?.toast(t('Not enough money — needs ${n}', { n: pay })); city.loan -= pay; this.eco.add(city, 'money', -pay, 'Loan repayment'); this.refreshInspector(); this.refreshHud(); } });
    }
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
        detail: `${t('{n} years', { n: g.age })} · ${dateLabel(g.day)}`,
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
    return `${t(MONTHS[m]).slice(0, 3)} ${calendarYear(this.eco.day)}`;
  }

  private refreshHud() {
    const e = this.eco;
    // the top bar always shows one of the player's own towns, never a neighbour town
    if (e.city.ai) { const mine = [...e.cities.values()].find((c) => !c.ai); if (mine) e.active = mine.id; }
    // never rebuild a panel while the player is pressing one of its buttons
    const busy = uiBusy();
    this.petitionTick++;
    this.hud?.setBadge('mail', this.life.leisure.petitions.filter((p) => p.state === 'open' && p.city === this.eco.active).length);
    if (this.petitions?.visible && this.petitionTick % 12 === 0 && !busy) this.petitions.render();
    if (this.resPanel?.visible && this.petitionTick % 4 === 0 && !busy) this.resPanel.render();
    if (this.tradePanel?.visible && this.petitionTick % 4 === 0 && !busy) this.tradePanel.render();
    if (this.worldPanel?.visible && this.petitionTick % 12 === 0 && !busy) this.worldPanel.render();
    if (this.cityReport?.visible && this.petitionTick % 4 === 0 && !busy) this.cityReport.render();
    const mine = (c: Citizen) => this.cityOfCitizen(c) === e.active;
    const counts = this.pop.counts(mine);
    this.hud!.setStats({
      cityName: e.city.name, cities: e.cities.size, happiness: e.city.happiness,
      money: e.money, iron: e.iron, daily: e.city.balance.net, stone: e.stone, wood: e.wood, food: e.food,
      foodDaily: this.foodBalance(), powered: e.powered, water: e.city.water,
      population: this.life.populationByCity().get(e.active) ?? 0, workers: counts.workers, workforce: counts.workforce,
      households: [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === e.active).length,
      homeUnits: this.buildings.list.reduce((a, b) => a + (b.city === e.active && b.built >= 1 && !b.removed ? BUILDINGS[b.kind].units : 0), 0),
      dateText: this.dateText(), seasonIcon: SEASON_ICON[seasonOf(monthOf(e.day))], timeOfDay: e.timeOfDay, broke: e.money < 0,
    });
    for (const g of this.goals.check(this.goalContext())) {
      this.eco.add(this.eco.city, 'money', g.reward, 'Goal rewards');
      sound.play('achieve');
      this.life.events.unshift(t('Goal complete: {name} (+${n})', { name: t(g.title), n: g.reward }));
    }
    if (this.goalsPanel?.visible && this.statsTick % 4 === 0 && !busy) this.goalsPanel.render();
    this.tutorial?.update(this.tutorialContext());
    const ev = this.life.events.shift();
    if (ev) {
      this.hud!.toast(ev);
      this.eventLog?.add(this.eco.day, ev);
    }
    if (this.selection && !busy) this.refreshInspector();
    if (this.stats?.visible && ++this.statsTick % 4 === 0 && !busy) this.stats.render();
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
    for (const b of own) { kinds[b.kind]++; jobs += BUILDINGS[b.kind].jobs; seats += seatsOf(b); }
    const population = this.life.populationByCity().get(city.id) ?? 0;
    const svc: [string, BuildingKind[]][] = [
      ['Schools', ['school']], ['Universities', ['university']], ['Hospitals', ['hospital']], ['Police', ['police']],
      ['Fire stations', ['firestation']], ['Parks', ['park']], ['Shops', ['grocery', 'clothes', 'market']], ['Bus depots', ['busdepot']],
    ];
    const mayor = this.pop.citizens.get(city.mayor);
    const pops = this.life.populationByCity();
    return {
      wageAuto: city.wageAuto,
      pages: this.statPages(city, own),
      happiness: city.happiness, taxRate: city.taxRate, loan: city.loan, iron: city.iron,
      mayor: mayor ? `${mayor.name} ${this.pop.families.get(mayor.family)?.surname ?? ''}` : '',
      cityList: [...this.eco.cities.values()].map((c) => ({ name: c.name, pop: pops.get(c.id) ?? 0, money: c.money, happiness: c.happiness, net: c.balance.net, active: c.id === city.id })),
      services: svc.map(([label, kinds]) => [label, own.filter((b) => kinds.includes(b.kind)).length] as [string, number]),
      businesses: { total: own.filter((b) => BUSINESS_KINDS.includes(b.kind)).length, owned: own.filter((b) => b.owner >= 0).length },
      priceLevel: this.life.priceLevel(city.id),
      labour: [...new Set(own.filter((b) => BUILDINGS[b.kind].jobs && b.built >= 1).map((b) => b.kind))].map((k) => {
        const list = own.filter((b) => b.kind === k && b.built >= 1);
        return {
          kind: k, name: t(BUILDINGS[k].name), workers: list.reduce((a, b) => a + b.workers, 0), jobs: list.reduce((a, b) => a + BUILDINGS[k].jobs, 0),
          prio: city.jobPriority[k] ?? 'normal', wage: Math.round(BUILDINGS[k].salary * (city.wages[k] ?? 1) * 10) / 10, factor: city.wages[k] ?? 1, publicJob: BUILDINGS[k].publicJob,
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

  /** Production chains, energy and water, bank and trade for the statistics window. */
  private statPages(city: City, all: Building[]): StatsSnapshot['pages'] {
    const own = all.filter((b) => b.built >= 1 && !b.removed);
    const n = (v: number) => Math.round(v).toLocaleString('en-US');
    const working = (k: BuildingKind) => own.filter((b) => b.kind === k && b.workers > 0).length;
    const count = (k: BuildingKind) => own.filter((b) => b.kind === k).length;
    const day = city.ledgerDays[0] ?? city.ledger;
    const flow = (res: Res) => {
      let made = 0, used = 0;
      for (const v of Object.values(day[res] ?? {})) { if (v > 0) made += v; else used -= v; }
      return `+${n(made)} / −${n(used)}`;
    };
    const goods: [Res, string][] = [['food', 'Food'], ['grain', 'Grain'], ['flour', 'Flour'], ['milk', 'Milk'], ['feed', 'Corn feed'], ['cotton', 'Cotton'], ['garments', 'Clothes'], ['furniture', 'Furniture'],
      ['wood', 'Wood'], ['planks', 'Planks'], ['stone', 'Stone'], ['bricks', 'Bricks'], ['iron', 'Iron'], ['steel', 'Steel'], ['coal', 'Coal']];
    const farms = own.filter((b) => b.kind === 'farm');
    const crops = Object.keys(CROPS) as CropKind[];
    const has = (k: BuildingKind) => working(k) > 0;
    const step = (ok: boolean, text: string, missing: string) => (ok ? `✓ ${t(text)}` : `✗ ${t(missing)}`);
    const chainRows: [string, string, boolean?][] = [
      [t('Bread: wheat → mill → bakery → shops'), [step(farms.some((f) => (f.cropKind ?? 'wheat') === 'wheat'), 'wheat', 'no wheat field'), step(has('mill'), 'mill', 'no mill'), step(has('bakery'), 'bakery', 'no bakery')].join(' · '), farms.some((f) => (f.cropKind ?? 'wheat') === 'wheat') && has('mill') && has('bakery')],
      [t('Dairy: ranch → dairy → shops'), [step(has('ranch'), 'ranch', 'no ranch'), step(has('dairy'), 'dairy', 'no dairy')].join(' · '), has('ranch') && has('dairy')],
      [t('Feed: corn → ranch (+30% milk and meat)'), [step(farms.some((f) => f.cropKind === 'corn'), 'corn field', 'no corn field'), step(has('ranch'), 'ranch', 'no ranch')].join(' · '), farms.some((f) => f.cropKind === 'corn') && has('ranch')],
      [t('Clothes: cotton → factory → clothing store'), [step(farms.some((f) => f.cropKind === 'cotton'), 'cotton field', 'no cotton field'), step(has('factory'), 'factory', 'no factory'), step(has('clothes'), 'clothing store', 'no clothing store')].join(' · '), farms.some((f) => f.cropKind === 'cotton') && has('factory') && has('clothes')],
      [t('Furniture: sawmill → factory → market'), [step(has('sawmill'), 'sawmill', 'no sawmill'), step(has('factory'), 'factory', 'no factory'), step(has('market') || has('supermarket'), 'market', 'no market')].join(' · '), has('sawmill') && has('factory') && (has('market') || has('supermarket'))],
      [t('Planks: woodcutter → sawmill → building sites'), [step(has('woodcutter'), 'woodcutter', 'no woodcutter'), step(has('sawmill'), 'sawmill', 'no sawmill')].join(' · '), has('woodcutter') && has('sawmill')],
      [t('Bricks: quarry → brickworks → building sites'), [step(has('quarry'), 'quarry', 'no quarry'), step(has('brickworks'), 'brickworks', 'no brickworks')].join(' · '), has('quarry') && has('brickworks')],
      [t('Steel: iron mine → steel mill → big buildings'), [step(has('ironmine'), 'iron mine', 'no iron mine'), step(has('steelmill'), 'steel mill', 'no steel mill')].join(' · '), has('ironmine') && has('steelmill')],
      [t('Power: coal mine → coal plant'), [step(has('coalmine'), 'coal mine', 'no coal mine'), step(count('coalplant') > 0, 'coal plant', 'no coal plant')].join(' · '), !count('coalplant') || has('coalmine')],
      [t('Cars: iron → car factory → car market → families'), [step(has('carfactory'), 'factory', 'no factory (cars are imported)'), step(has('carmarket'), 'car market', 'no car market')].join(' · '), has('carmarket')],
      [t('Garbage: homes → trucks → landfill / recycling'), step(has('landfill') || has('recycling'), 'collected', 'nobody collects garbage'), has('landfill') || has('recycling')],
    ];
    const plants = own.filter((b) => BUILDINGS[b.kind].power);
    const users = new Map<string, number>();
    for (const b of own) if (BUILDINGS[b.kind].energy) users.set(BUILDINGS[b.kind].name, (users.get(BUILDINGS[b.kind].name) ?? 0) + BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1));
    const towers = own.filter((b) => b.kind === 'watertower');
    const people = this.life.populationByCity().get(city.id) ?? 0;
    const bank = this.life.bankStats.get(city.id);
    const famLoans = [...this.pop.families.values()].filter((f) => f.loan && this.buildings.get(f.home)?.city === city.id);
    const biz = own.filter((b) => BUSINESS_KINDS.includes(b.kind));
    const linked = own.some((b) => (b.kind === 'trainstation' || b.kind === 'airport') && b.workers > 0);
    return {
      production: [
        { title: t('Goods'), kpis: goods.slice(0, 6).map(([r, label]) => [t(label), n(city[r]), `${t('yesterday')} ${flow(r)}`] as [string, string, string]) },
        { title: '', kpis: goods.slice(6).map(([r, label]) => [t(label), n(city[r]), `${t('yesterday')} ${flow(r)}`] as [string, string, string]) },
        { title: t('Production chains'), rows: chainRows, note: t('✗ shows the missing link of a chain. Tap a resource in the top bar for every source and use.') },
        { title: t('Fields by crop'), bars: crops.map((k, i) => [t(CROPS[k].name), farms.filter((f) => (f.cropKind ?? 'wheat') === k).length, ['#e3bf4f', '#d9b13a', '#c4553d', '#e8e4da', '#9cc95a'][i]] as [string, number, string]),
          rows: farms.length ? [] : [[t('No fields yet'), '—', false]] },
        { title: t('Workplaces of the chains'), rows: (['farm', 'ranch', 'orchard', 'fishery', 'mill', 'bakery', 'dairy', 'sawmill', 'brickworks', 'steelmill', 'quarry', 'ironmine', 'coalmine', 'woodcutter'] as BuildingKind[])
          .filter((k) => count(k)).map((k) => [t(BUILDINGS[k].name), `${working(k)}/${count(k)} ${t('working')}`, working(k) === count(k)] as [string, string, boolean]) },
      ],
      energy: [
        { title: t('Electricity'), kpis: [
          [t('Made now'), kw(city.energyCapacity), t('all power plants together'), city.energyCapacity >= city.energyDemand],
          [t('Used'), kw(city.energyDemand), t('homes, workplaces and street lamps')],
          [t('Spare'), kw(Math.max(0, city.energyCapacity - city.energyDemand)), city.energyCapacity >= city.energyDemand ? t('room to grow') : t('build another power plant'), city.energyCapacity >= city.energyDemand],
          [t('Covered'), `${Math.round(city.powered * 100)}%`, city.powered > 0.95 ? t('enough power') : t('power shortage'), city.powered > 0.95],
          [t('Batteries'), this.life.batteryCap ? `${kw(this.life.batteryCharge)} / ${kw(this.life.batteryCap)}` : '—', t('stored for the night')],
        ] },
        { title: t('Power plants'), rows: plants.length ? plants.map((b) => [t(BUILDINGS[b.kind].name), `${kw(b.output ?? 0)} / ${kw(BUILDINGS[b.kind].power)} · ${b.workers}/${BUILDINGS[b.kind].jobs}`, (b.output ?? 0) > 0] as [string, string, boolean]) : [[t('None — build one'), '—', false]] },
        { title: t('Who uses power (by kind)'), rows: [...users.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [t(k), kw(v)] as [string, string]) },
        { title: t('Every building'), rows: own.filter((b) => BUILDINGS[b.kind].energy).map((b) => [b, BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1)] as const)
          .sort((a, b) => b[1] - a[1]).slice(0, 30).map(([b, v]) => [`${t(BUILDINGS[b.kind].name)} #${b.id}`, `${kw(v)} · ${b.powered ? '✓' : `✗ ${t('No power')}`}`, b.powered] as [string, string, boolean]) },
        { title: t('Water'), kpis: [
          [t('Clean water'), `${Math.round(city.water * 100)}%`, t('of the people'), city.water > 0.99],
          [t('Capacity'), n(towers.reduce((a, w) => a + waterOf(w), 0)), t('{n} towers · {p} people', { n: towers.length, p: people }), towers.reduce((a, w) => a + waterOf(w), 0) >= people],
          [t('Connected homes'), `${Math.round(city.piped * 100)}%`, t('mains under roads and pipes'), city.piped > 0.95],
          [t('Sewage treated'), `${Math.round((this.life.sanitation.get(city.id) ?? 1) * 100)}%`, t('needed above 60 people'), (this.life.sanitation.get(city.id) ?? 1) > 0.95],
        ] },
      ],
      finance: [
        { title: t('Bank'), kpis: !count('bank') ? [
          [t('Savings'), '—', t('No bank in the town'), false],
          [t('Family loans'), '—', t('Build a bank: families save and borrow there'), false],
          [t('Town hall loan'), `$${n(city.loan)}`, t('1% interest per day'), city.loan === 0],
        ] : [
          [t('Savings'), bank ? `$${n(bank.deposits)}` : '—', bank?.savers ? t('{n} families save', { n: bank.savers }) : t('Families save above $300'), (bank?.savers ?? 0) > 0],
          [t('Family loans'), `$${n(famLoans.reduce((a, f) => a + (f.loan ?? 0), 0))}`, t('{n} borrowers', { n: famLoans.length })],
          [t('Interest earned'), bank ? `$${n(bank.earned)}` : '—', t('yesterday')],
          [t('Town hall loan'), `$${n(city.loan)}`, t('1% interest per day'), city.loan === 0],
        ], note: count('bank') ? undefined : t('No bank yet: families cannot save or borrow to build.') },
        { title: t('Trade'), kpis: [
          [t('Sold today'), `$${n(this.trade.today.sold)}`, this.trade.today.sold ? t('to other towns') : t('Nothing yet — sell in the Trade window')],
          [t('Bought today'), `$${n(this.trade.today.bought)}`, this.trade.today.bought ? t('from other towns') : t('Nothing yet — buy in the Trade window')],
          [t('Transport'), linked ? t('Railway / airport') : t('Caravans'), linked ? t('better prices') : t('10% worse prices'), linked],
        ] },
        { title: t('Relations with neighbour towns'), bars: [...this.eco.cities.values()].filter((c) => c.ai).map((c) => [c.name, Math.max(1, Math.round(c.relation ?? 40)), c.tint ?? '#aab4be'] as [string, number, string]) },
        { title: t('Businesses'), rows: biz.length ? biz.slice(0, 16).map((b) => {
          const owner = b.owner >= 0 ? this.pop.families.get(b.owner) : undefined;
          return [t(BUILDINGS[b.kind].name), `${owner ? t('{family} family', { family: owner.surname }) : t('Town')} · ${b.workers}/${BUILDINGS[b.kind].jobs}`, b.workers > 0] as [string, string, boolean];
        }) : [[t('No businesses yet'), '—']] },
      ],
    };
  }

  // ---------- cities ----------

  // ---------- resource details (tap a readout in the top bar) ----------

  /** Rows of one page of the books: income first (largest first), then spending, then the total. */
  private ledgerRows(rec: Record<string, number>, money: boolean): [string, string, ('good' | 'bad')?][] {
    const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${money ? '$' : ''}${Math.abs(v) < 10 && !money ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v)).toLocaleString('en-US')}`;
    const items = Object.entries(rec).filter(([, v]) => Math.abs(v) >= 0.05);
    if (!items.length) return [[t('Nothing yet'), '—']];
    const inc = items.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const out = items.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
    const total = items.reduce((a, [, v]) => a + v, 0);
    return [
      ...inc.map(([k, v]) => [t(k), fmt(v), 'good'] as [string, string, 'good']),
      ...out.map(([k, v]) => [t(k), fmt(v), 'bad'] as [string, string, 'bad']),
      [t('Total'), fmt(total), total >= 0 ? 'good' : 'bad'],
    ];
  }

  private ledgerSections(city: City, res: Res): ResourceSection[] {
    const money = res === 'money';
    const days = city.ledgerDays;
    const net = (l: Record<string, number>) => Object.values(l).reduce((a, v) => a + v, 0);
    const chart = [...days].reverse().map((l, i) => ({ label: dateLabel(this.eco.day - days.length + i), value: net(l[res]) }));
    chart.push({ label: t('Today'), value: net(city.ledger[res]) });
    // in short: how much there is, how much came in and went out yesterday, and how long it lasts
    const y = days[0]?.[res] ?? {};
    const made = Object.values(y).reduce((a, v) => a + Math.max(0, v), 0), used = -Object.values(y).reduce((a, v) => a + Math.min(0, v), 0);
    const stock = city[res];
    const f = (v: number) => `${money ? '$' : ''}${Math.round(v).toLocaleString('en-US')}`;
    const lasts = used > made && used > 0 ? Math.max(0, stock) / (used - made) : Infinity;
    return [
      { title: t('In short'), rows: [
        [t('In stock'), money ? f(stock) : `${f(stock)} / ${f(this.eco.capacity(city, res))}`, stock < 0 || (!money && stock >= this.eco.capacity(city, res) * 0.95) ? 'bad' : undefined],
        [t('Came in yesterday'), `+${f(made)}`, 'good'],
        [t('Went out yesterday'), `−${f(used)}`, used ? 'bad' : undefined],
        [t('Net per day'), `${made - used >= 0 ? '+' : '−'}${f(Math.abs(made - used))}`, made >= used ? 'good' : 'bad'],
        [t('Lasts'), lasts === Infinity ? t('growing') : t('{n} days', { n: lasts.toFixed(1) }), lasts < 5 ? 'bad' : undefined],
      ] },
      { title: t('Today so far'), rows: this.ledgerRows(city.ledger[res], money) },
      { title: t('Yesterday'), rows: days[0] ? this.ledgerRows(days[0][res], money) : [[t('No data yet'), '—']] },
      { title: t('Last days (net change)'), chart },
    ];
  }

  /** Why buildings stand empty and what would bring new families. */
  private migrationSection(city: City): ResourceSection {
    const m = city.migration;
    if (!m) return { title: t('New families'), note: t('Known after a few hours') };
    const rows: [string, string, ('good' | 'bad')?][] = [
      [t('Empty jobs'), `${Math.max(0, m.vacancies)}`, m.vacancies > 0 ? 'bad' : 'good'],
      [t('Unemployed'), `${m.unemployed}`],
      [t('Free homes'), `${m.freeHomes}`, m.freeHomes ? 'good' : 'bad'],
    ];
    return {
      title: t('Why buildings are empty'),
      rows: [...rows, ...(m.reasons.length ? m.reasons.map((r) => [t('Blocks newcomers'), t(r), 'bad'] as [string, string, 'bad']) : [[t('New families'), t('Moving in — the town is attractive'), 'good'] as [string, string, 'good']])],
      note: t('Workers come only with new families. A family moves in when there is a free home, enough water, food and power, open jobs and happiness of at least 45%. More empty jobs bring families faster. You can also raise the priority of important jobs in Statistics → Jobs.'),
    };
  }

  private resourceView(key: string): ResourceView | null {
    const city = this.eco.city;
    const own = this.buildings.list.filter((b) => b.city === city.id && b.built >= 1);
    const staffed = (b: Building) => `${b.workers}/${BUILDINGS[b.kind].jobs}`;
    const producers = (kinds: BuildingKind[], what: (b: Building) => string): ResourceSection => {
      const list = own.filter((b) => kinds.includes(b.kind));
      return {
        title: t('Producers'),
        rows: list.length ? list.map((b) => [t(BUILDINGS[b.kind].name), what(b), b.workers > 0 ? 'good' : 'bad'] as [string, string, ('good' | 'bad')?]) : [[t('None — build one'), '—', 'bad']],
      };
    };
    const n = (v: number) => Math.round(v).toLocaleString('en-US');
    switch (key) {
      case 'money': {
        const b = city.balance;
        return {
          key, icon: 'coin', title: t('Money'), value: `$${n(city.money)}`, sub: `${city.name} · ${t('Tax {n}%', { n: Math.round(city.taxRate * 100) })}`,
          sections: [
            ...this.ledgerSections(city, 'money'),
            { title: t('Treasury'), rows: [
              [t('Yesterday\'s balance'), `${b.net >= 0 ? '+' : '−'}$${n(Math.abs(b.net))}`, b.net >= 0 ? 'good' : 'bad'],
              [t('Bank loan'), city.loan ? `$${n(city.loan)}` : t('None'), city.loan ? 'bad' : undefined],
              [t('Days in debt'), `${city.brokeDays}`, city.brokeDays ? 'bad' : undefined],
            ] },
          ],
        };
      }
      case 'stone': return { key, icon: 'stone', title: t('Stone'), value: n(city.stone), sections: [...this.ledgerSections(city, 'stone'), { title: t('Bricks'), rows: [[t('Bricks in stock'), n(city.bricks)]], note: t('Brickworks fire stone into bricks; construction sites that get bricks are built faster.') }, producers(['quarry'], (b) => `${staffed(b)} · ${t('{n} ready', { n: Math.floor(b.stored) })}`), { title: t('Used for'), note: t('Roads, bridges and most buildings.') }] };
      case 'wood': return { key, icon: 'wood', title: t('Wood'), value: n(city.wood), sections: [...this.ledgerSections(city, 'wood'), producers(['woodcutter'], staffed),
        { title: t('Planks'), rows: [[t('Planks in stock'), n(city.planks)], [t('Sawmill'), own.some((b) => b.kind === 'sawmill' && b.workers > 0) ? t('Working') : t('None — build one'), own.some((b) => b.kind === 'sawmill' && b.workers > 0) ? 'good' : 'bad']], note: t('Construction sites that get planks are built 40% faster.') }, { title: t('Used for'), note: t('Building material and fuel for the wood power plant.') }] };
      case 'iron': return { key, icon: 'iron', title: t('Iron'), value: n(city.iron), sections: [...this.ledgerSections(city, 'iron'), { title: t('Steel'), rows: [[t('Steel in stock'), n(city.steel)]], note: t('A steel mill melts iron into steel beams for big construction sites.') }, producers(['ironmine'], staffed), { title: t('Used for'), note: t('Factories, hospitals, big buildings, railways and the car factory.') }] };
      case 'food': {
        const fy = city.foodYesterday;
        return {
          key, icon: 'food', title: t('Food'), value: n(city.food), sub: t('Yesterday: made {a}, eaten {b}', { a: fy.made, b: fy.eaten }),
          sections: [
            ...this.ledgerSections(city, 'food'),
            { title: t('Prices'), rows: [[t('Food price'), `×${city.priceFactor.toFixed(2)}`, city.priceFactor > 1.1 ? 'bad' : city.priceFactor < 0.95 ? 'good' : undefined], [t('Price level (from the average wage)'), `×${this.life.priceLevel(city.id).toFixed(2)}`]], note: t('Food is dearer when the stores run low and cheaper when they are full. Where the pay is higher, everything costs more.') },
            { title: t('Dairy chain'), rows: [[t('Milk in stock'), n(city.milk)], [t('Dairy'), own.some((b) => b.kind === 'dairy' && b.workers > 0) ? t('Working') : t('None — milk is drunk fresh'), own.some((b) => b.kind === 'dairy' && b.workers > 0) ? 'good' : 'bad']] },
            { title: t('Bread chain'), rows: [[t('Grain in stock'), n(city.grain)], [t('Flour in stock'), n(city.flour)],
              [t('Flour Mill'), own.some((b) => b.kind === 'mill' && b.workers > 0) ? t('Working') : t('None — grain is only cooked (70%)'), own.some((b) => b.kind === 'mill' && b.workers > 0) ? 'good' : 'bad'],
              [t('Bakery'), own.some((b) => b.kind === 'bakery' && b.workers > 0) ? t('Working') : t('None — build one'), own.some((b) => b.kind === 'bakery' && b.workers > 0) ? 'good' : 'bad']],
              note: t('Farm → tractor → flour mill → bakery → shops. One flour makes 1.4 bread; raw grain only 0.7 food.') },
            producers(['farm', 'orchard', 'ranch', 'fishery', 'bakery'], staffed),
          ],
        };
      }
      case 'energy': {
        const plants = own.filter((b) => BUILDINGS[b.kind].power);
        const users = new Map<string, number>();
        for (const b of own) if (BUILDINGS[b.kind].energy) users.set(BUILDINGS[b.kind].name, (users.get(BUILDINGS[b.kind].name) ?? 0) + BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1));
        return {
          key, icon: 'energy', title: t('Energy'), value: `${Math.round(city.powered * 100)}%`, sub: t('Uses {a} · plants make {b}', { a: kw(city.energyDemand), b: kw(city.energyCapacity) }),
          sections: [
            { title: t('Supply'), bars: [[t('Demand covered'), city.powered, `${Math.round(city.powered * 100)}%`], ...(this.life.batteryCap ? [[t('Batteries charged'), this.life.batteryCharge / this.life.batteryCap, `${Math.round(this.life.batteryCharge)}/${this.life.batteryCap}`] as [string, number, string]] : [])] },
            { title: t('Fuel'), rows: [[t('Wood in stock'), n(city.wood)], [t('Coal in stock'), n(city.coal)]] },
            { title: t('Power plants'), rows: plants.length ? plants.map((b) => [t(BUILDINGS[b.kind].name), `${kw(b.output ?? 0)} / ${kw(BUILDINGS[b.kind].power)} · ${staffed(b)}`, b.workers > 0 || BUILDINGS[b.kind].power ? 'good' : 'bad'] as [string, string, ('good' | 'bad')?]) : [[t('None — build one'), '—', 'bad']] },
            { title: t('Biggest users'), rows: [...users.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [t(k), kw(v)]) },
          ],
        };
      }
      case 'water': {
        const towers = own.filter((b) => b.kind === 'watertower');
        const people = this.pop.counts((c) => this.cityOfCitizen(c) === city.id);
        const total = people.men + people.women + people.boys + people.girls + people.babies + people.elders;
        return {
          key, icon: 'water', title: t('Water'), value: `${Math.round(city.water * 100)}%`,
          sections: [
            { title: t('Supply'), bars: [[t('People with clean water'), city.water, `${Math.round(city.water * 100)}%`], [t('Homes connected to the mains'), city.piped, `${Math.round(city.piped * 100)}%`], [t('Sewage treated'), this.life.sanitation.get(city.id) ?? 1, `${Math.round((this.life.sanitation.get(city.id) ?? 1) * 100)}%`]],
              rows: [[t('People'), n(total)], [t('Capacity'), n(towers.reduce((a, w) => a + waterOf(w), 0))]],
              note: t('Water runs from the towers through mains under the roads; homes off the road need a water pipe. Towns over 60 people need a sewage plant.') },
            { title: t('Water towers'), rows: towers.length ? towers.map((b) => [t('Water Tower'), `${staffed(b)} · ${b.powered ? t('Powered') : t('No power')}`, b.workers > 0 && b.powered ? 'good' : 'bad'] as [string, string, ('good' | 'bad')?]) : [[t('None — build one'), '—', 'bad']] },
          ],
        };
      }
      case 'pop': {
        const c = this.pop.counts((x) => this.cityOfCitizen(x) === city.id);
        const fams = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === city.id).length;
        return {
          key, icon: 'people', title: t('Population'), value: n(c.men + c.women + c.boys + c.girls + c.babies + c.elders),
          sections: [
            { title: t('People'), rows: [[t('Men'), `${c.men}`], [t('Women'), `${c.women}`], [t('Boys'), `${c.boys}`], [t('Girls'), `${c.girls}`], [t('Babies'), `${c.babies}`], [t('Elders'), `${c.elders}`]] },
            this.migrationSection(city),
            { title: t('Homes'), rows: [[t('Families'), `${fams}`], [t('Free homes'), `${this.life.freeHomes(city.id).length}`], [t('Deaths yesterday'), `${city.deaths}`, city.deaths ? 'bad' : undefined], [t('Hungry'), `${c.hungry}`, c.hungry ? 'bad' : undefined], [t('Sick'), `${c.sick}`, c.sick ? 'bad' : undefined]] },
          ],
        };
      }
      case 'happy': return {
        key, icon: 'heart', title: t('Happiness'), value: `${Math.round(city.happiness)}%`, sub: t('Moves towards the sum of the reasons below every day'),
        sections: [{ title: t('Why people feel this way'), rows: city.mood.length ? city.mood.map(([k, v]) => [t(k), `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`, k === 'Base mood' ? undefined : v >= 0 ? 'good' : 'bad'] as [string, string, ('good' | 'bad')?]) : [[t('Known after the first day'), '—']] }],
      };
      case 'allres': {
        const goods = GOODS;
        const wh = own.filter((b) => b.kind === 'warehouse').length;
        const y = city.ledgerDays[0];
        const net = (r: Good) => Object.values(y?.[r] ?? {}).reduce((a, v) => a + v, 0);
        return {
          key, icon: 'list', title: t('All resources'), value: `$${n(city.money)}`,
          sub: wh ? t('Stored in the town hall and {n} warehouses', { n: wh }) : t('Only the town hall stores goods — build a warehouse for more room'),
          sections: [
            { title: t('In the stores'), bars: goods.map((r) => { const cap = this.eco.capacity(city, r); return [t(GOOD_NAME[r]), Math.min(1, Math.max(0, city[r]) / cap), `${n(city[r])} / ${n(cap)}`] as [string, number, string]; }),
              note: t('The town hall keeps {a} of each good ({b} food); every warehouse keeps {c} more ({d} food). What does not fit spoils.', { a: STORAGE.hall, b: STORAGE.hallFood, c: STORAGE.warehouse, d: STORAGE.warehouseFood }) },
            { title: t('Yesterday (net change)'), rows: goods.map((r) => { const v = net(r); return [t(GOOD_NAME[r]), `${v >= 0 ? '+' : '−'}${n(Math.abs(v))}`, v > 0 ? 'good' : v < 0 ? 'bad' : undefined] as [string, string, ('good' | 'bad')?]; }) },
            { title: t('Other'), rows: [
              [t('Money'), `$${n(city.money)}`], [t('Bank loan'), city.loan ? `$${n(city.loan)}` : t('None'), city.loan ? 'bad' : undefined],
              [t('Cars in the car markets'), n(this.life.carsInMarkets(city.id))], [t('Warehouses'), `${wh}`],
            ] },
          ],
        };
      }
      case 'jobs': {
        const c = this.pop.counts((x) => this.cityOfCitizen(x) === city.id);
        const open = new Map<string, number>();
        for (const b of own) { const d = BUILDINGS[b.kind]; if (d.jobs > b.workers) open.set(d.name, (open.get(d.name) ?? 0) + d.jobs - b.workers); }
        return {
          key, icon: 'jobs', title: t('Jobs'), value: `${c.workers}/${c.workforce}`,
          sections: [
            { title: t('Workers'), bars: [[t('Employed'), c.workforce ? c.workers / c.workforce : 1, `${c.workers}/${c.workforce}`]], rows: [[t('Unemployed'), `${Math.max(0, c.workforce - c.workers)}`, c.workforce - c.workers > 0 ? 'bad' : 'good'], [t('Students'), `${c.students}`],
              [t('Come from other towns to work here'), `${this.commuters(city.id, true)}`], [t('Work in other towns'), `${this.commuters(city.id, false)}`]],
              note: t('When a town has no work for someone, they take a job in a neighbour town joined by road. The town where they work pays the wage.') },
            { title: t('Open jobs'), rows: open.size ? [...open.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [t(k), `${v}`]) : [[t('Every job is filled'), '—', 'good']] },
            this.migrationSection(city),
          ],
        };
      }
    }
    return null;
  }

  private cityOf(b: Building): City {
    return this.eco.cities.get(b.city) ?? this.eco.city;
  }

  private cityOfCitizen(c: Citizen) {
    return this.buildings.get(this.pop.families.get(c.family)?.home ?? -1)?.city ?? -1;
  }

  /** Switch to the next city: the camera flies to its Town Hall and building costs come from its treasury. */

  /**
   * Everything about one town in tabs: overview with history, electricity / water / food / garbage, money,
   * people, buildings and trade — key figures, bars, ring diagrams and charts.
   */
  private cityReportView(id: number): CityReportView | null {
    const city = this.eco.cities.get(id);
    if (!city) return null;
    const n = (v: number) => Math.round(v).toLocaleString('en-US');
    const money = (v: number) => `${v < 0 ? '−' : ''}$${n(Math.abs(v))}`;
    const own = this.buildings.list.filter((b) => b.city === id && !b.removed);
    const built = own.filter((b) => b.built >= 1);
    const fams = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === id);
    const people = fams.flatMap((f) => this.pop.members(f));
    const counts = this.pop.counts((c) => this.cityOfCitizen(c) === id);
    const pop = people.length;
    // the history plus today: the same numbers the daily record keeps (people with a job, not just those at work now)
    const workNow = this.buildings.list.reduce((a, b) => a + (b.city === id ? b.workers : 0), 0);
    const hist = [...(this.worldHistory.get(id) ?? []), { day: this.eco.day, pop, money: Math.round(city.money), happy: Math.round(city.happiness), work: workNow }];
    const day = (h: { day: number }) => h.day;
    void day;
    const homes = built.filter((b) => BUILDINGS[b.kind].units);
    const units = homes.reduce((a, b) => a + BUILDINGS[b.kind].units, 0);
    let jobs = 0, staff = 0;
    for (const b of built) { jobs += BUILDINGS[b.kind].jobs; staff += b.workers; }
    const C = ['#6fb6ff', '#7be08f', '#f2b33d', '#f28cb8', '#b9a3e0', '#ff7a6e', '#c98a5a', '#aab4be', '#4fd1c5', '#e8e46a'];
    const catOf = (b: Building) => BUILDINGS[b.kind].units ? 'Homes' : ({ buildings: 'Town', services: 'Services', business: 'Business', production: 'Industry', decor: 'Decor' } as Record<string, string>)[ITEMS.find((i) => i.tool === b.kind)?.cat ?? ''] ?? 'Town';
    // ---- electricity, water, food, garbage ----
    const use = new Map<string, number>();
    let byBuildings = 0;
    for (const b of built) {
      const e = BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1);
      if (!e) continue;
      byBuildings += e;
      use.set(catOf(b), (use.get(catOf(b)) ?? 0) + e);
    }
    const lamps = Math.max(0, city.energyDemand - byBuildings);
    if (lamps > 0.5) use.set('Street lamps', lamps);
    const towers = built.filter((b) => b.kind === 'watertower').length;
    const fy = city.foodYesterday;
    const bins = homes.filter((b) => (b.trash ?? 0) >= TRASH.full).length;
    const ledger = city.ledgerDays;
    const net = (res: Res) => [...ledger].reverse().map((l) => Object.values(l[res] ?? {}).reduce((a, v) => a + v, 0));
    const made = (res: Res) => [...ledger].reverse().map((l) => Object.values(l[res] ?? {}).reduce((a, v) => a + Math.max(0, v), 0));
    const spent = (res: Res) => [...ledger].reverse().map((l) => -Object.values(l[res] ?? {}).reduce((a, v) => a + Math.min(0, v), 0));
    // ---- money ----
    const bal = city.balance;
    const income: [string, number][] = [['Income tax', bal.incomeTax], ['Business tax', bal.businessTax], ['Property tax', bal.propertyTax], ['Utility bills', bal.utilities], ['Food sales', bal.foodSales], ['Bus fares', bal.fares ?? 0], ['Services (hospital, parking)', bal.services ?? 0]];
    const costs: [string, number][] = [['Public wages', bal.publicWages], ['Upkeep', bal.upkeep]];
    const yLedger = ledger[0]?.money ?? city.ledger.money;
    const items = Object.entries(yLedger).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => b[1] - a[1]);
    // ---- people ----
    const age = (lo: number, hi: number) => people.filter((c) => c.age >= lo && c.age < hi).length;
    const skill = [0, 1, 2].map((s) => people.filter((c) => c.age >= 18 && c.skill === s).length);
    const wealth: [string, number][] = [['Below $500', fams.filter((f) => f.money < 500).length], ['$500 – 2,000', fams.filter((f) => f.money >= 500 && f.money < 2000).length],
      ['$2,000 – 10,000', fams.filter((f) => f.money >= 2000 && f.money < 10000).length], ['Millionaires ($10,000+)', fams.filter((f) => f.money >= 10000).length]];
    const worthOf = (f: (typeof fams)[number]) => f.money + this.buildings.list.reduce((a, b) => a + (b.owner === f.id && !b.removed ? BUILDINGS[b.kind].money : 0), 0);
    const richest = [...fams].sort((a, b) => worthOf(b) - worthOf(a)).slice(0, 8);
    const avgPay = staff ? built.reduce((a, b) => a + BUILDINGS[b.kind].salary * (city.wages[b.kind] ?? 1) * b.workers, 0) / staff : 0;
    // ---- buildings ----
    const byCat = new Map<string, number>();
    for (const b of own) byCat.set(catOf(b), (byCat.get(catOf(b)) ?? 0) + 1);
    const byKind = new Map<string, number>();
    for (const b of own) byKind.set(t(BUILDINGS[b.kind].name), (byKind.get(t(BUILDINGS[b.kind].name)) ?? 0) + 1);
    const empty = built.filter((b) => BUILDINGS[b.kind].jobs && b.workers === 0).length;
    const dark = built.filter((b) => BUILDINGS[b.kind].energy && !b.powered).length;
    const series = (label: string, color: string, values: number[]) => ({ label, color, values });
    const tabs: CityReportView['tabs'] = [];
    const overview: ReportSection[] = [
      { title: t('Key figures'), kpis: [
        [t('Mayor'), this.pop.citizens.get(city.mayor) ? `${this.pop.citizens.get(city.mayor)!.name} ${this.pop.families.get(this.pop.citizens.get(city.mayor)!.family)?.surname ?? ''}` : '—', ''],
        [t('People'), n(pop), t('{n} families', { n: fams.length })],
        [t('Households'), `${fams.length}/${units}`, t('{n} free homes', { n: Math.max(0, units - fams.length) }), units > fams.length],
        [t('Homes'), n(homes.length), t('{a} houses · {b} apartment blocks', { a: homes.filter((b) => b.kind === 'house').length, b: homes.filter((b) => BUILDINGS[b.kind].units > 1).length })],
        [t('Jobs'), `${staff}/${jobs}`, t('{n} open jobs', { n: Math.max(0, jobs - staff) }), staff >= jobs],
        [t('Unemployed'), n(Math.max(0, counts.workforce - counts.workers)), t('of {n} able to work', { n: counts.workforce }), counts.workforce <= counts.workers],
        [t('Workers from other towns'), n(this.commuters(id, true)), t('{n} of ours work in other towns', { n: this.commuters(id, false) })],
        [t('Average wage'), `$${avgPay.toFixed(1)}/${t('day')}`, t('{n} people at work', { n: staff })],
        [t('Pupils'), n(counts.students), ''],
        [t('Treasury'), money(city.money), `${t('yesterday')} ${bal.net >= 0 ? '+' : ''}${money(bal.net)}`, bal.net >= 0],
        [t('Happiness'), `${Math.round(city.happiness)}%`, city.happiness >= 60 ? t('people are content') : t('could be better'), city.happiness >= 55],
        [t('Tax'), `${Math.round(city.taxRate * 100)}%`, city.loan ? `${t('Loan')} ${money(city.loan)}` : ''],
        [t('Food'), n(city.food), t('{n} days of food', { n: pop ? (city.food / pop).toFixed(1) : '∞' }), !pop || city.food > pop * 3],
      ] },
      { title: t('People'), chart: { series: [series(t('People'), '#6fb6ff', hist.map((h) => h.pop))] } },
      { title: t('Treasury'), chart: { series: [series(t('Treasury'), '#f2b33d', hist.map((h) => h.money))], format: 'money' } },
      { title: t('Happiness'), chart: { series: [series(t('Happiness'), '#f28cb8', hist.map((h) => h.happy))], format: 'pct' } },
      { title: t('Why people feel this way'), bars: city.mood.filter(([k]) => k !== 'Base mood').map(([k, v]) => [t(k), v, v >= 0 ? '#7be08f' : '#ff7a6e', `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`] as [string, number, string, string]) },
      { title: t('City status'), rows: ([
        ...(city.money < 0 ? [[t('The treasury is in debt — 8 months of debt means bankruptcy!'), '—', 'bad' as const]] : []),
        ...(city.powered < 0.8 ? [[t('Power shortage — power plants need workers, wood and a road link'), '—', 'bad' as const]] : []),
        ...(city.wood < 15 ? [[t('Wood is running out — build woodcutters near forests'), '—', 'bad' as const]] : []),
        ...(city.food < pop * 2 ? [[t('Food is low — people will starve. Build and irrigate farms'), '—', 'bad' as const]] : []),
        ...(city.water < 0.99 ? [[t('Not enough drinking water — build a water tower'), '—', 'bad' as const]] : []),
        ...(units <= fams.length ? [[t('No free homes — build houses so families can grow'), '—', 'bad' as const]] : []),
        ...(!built.some((b) => b.kind === 'weddinghall') ? [[t('No Wedding Hall — young people cannot marry'), '—', 'bad' as const]] : []),
        ...(counts.boys + counts.girls > 0 && !built.some((b) => b.kind === 'school') ? [[t('Children have no school'), '—', 'bad' as const]] : []),
        ...((city.money >= 0 && city.powered >= 0.8 && city.wood >= 15 && city.food >= pop * 2 && city.water >= 0.99 && units > fams.length) ? [[t('Everything runs smoothly — new families keep arriving'), '✓', 'good' as const]] : []),
      ] as [string, string, ('good' | 'bad')?][]) },
    ];
    tabs.push({ id: 'overview', label: t('Overview'), sections: overview });
    tabs.push({ id: 'utilities', label: t('Electricity, water, food'), sections: [
      { title: t('Electricity'), kpis: [
        [t('Made now'), kw(city.energyCapacity), t('all power plants together'), city.energyCapacity >= city.energyDemand],
        [t('Used'), kw(city.energyDemand), t('homes, workplaces and street lamps')],
        [t('Covered'), `${Math.round(city.powered * 100)}%`, '', city.powered > 0.95],
        [t('Per household'), kw(fams.length ? (use.get('Homes') ?? 0) / fams.length : 0), t('homes use {n}', { n: kw(use.get('Homes') ?? 0) })],
        [t('Without power'), `${dark}`, t('buildings'), dark === 0],
      ] },
      { title: t('Who uses electricity'), donut: [...use.entries()].map(([k, v], i) => [t(k), v, C[i % C.length]] as [string, number, string]) },
      { title: t('Biggest users'), bars: [...built].filter((b) => BUILDINGS[b.kind].energy).map((b) => [b, BUILDINGS[b.kind].energy * (b.kind === 'house' ? b.level : 1)] as const)
        .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b, v]) => [t(BUILDINGS[b.kind].name), v, b.powered ? '#ffe066' : '#ff7a6e', kw(v)] as [string, number, string, string]) },
      { title: t('Water'), kpis: [
        [t('Clean water'), `${Math.round(city.water * 100)}%`, t('of the people'), city.water > 0.98],
        [t('Capacity'), n(towers * BUILDINGS.watertower.water), t('{n} towers · {p} people', { n: towers, p: pop }), towers * BUILDINGS.watertower.water >= pop],
        [t('Per household'), `${fams.length ? (pop / fams.length).toFixed(1) : 0} ${t('people')}`, t('each person needs clean water every day')],
        [t('Connected homes'), `${Math.round(city.piped * 100)}%`, '', city.piped > 0.95],
        [t('Sewage treated'), `${Math.round((this.life.sanitation.get(id) ?? 1) * 100)}%`, '', (this.life.sanitation.get(id) ?? 1) > 0.95],
      ] },
      { title: t('Food'), kpis: [
        [t('Made yesterday'), n(fy.made), ''], [t('Eaten yesterday'), n(fy.eaten), t('{n} per person', { n: pop ? (fy.eaten / pop).toFixed(2) : 0 })],
        [t('In stock'), n(city.food), t('{n} days of food', { n: pop ? (city.food / pop).toFixed(1) : '∞' }), !pop || city.food > pop * 3],
        [t('Price'), `×${city.priceFactor.toFixed(2)}`, '', city.priceFactor <= 1.05],
      ] },
      { title: t('Food: made and eaten per day'), chart: { series: [series(t('Made'), '#7be08f', made('food')), series(t('Eaten / used'), '#ff7a6e', spent('food'))] } },
      { title: t('Garbage and heating'), rows: [
        [t('Full bins'), `${bins}/${homes.length}`, bins ? 'bad' : 'good'],
        [t('Garbage trucks'), `${built.filter((b) => b.kind === 'landfill' || b.kind === 'recycling').length}`],
        [t('Wood in stock (firewood, fuel)'), n(city.wood), city.wood < 30 ? 'bad' : undefined],
        [t('Coal in stock'), n(city.coal)],
      ] },
    ] });
    tabs.push({ id: 'money', label: t('Money'), sections: [
      { title: t("Yesterday's budget"), kpis: [
        [t('Income'), money(income.reduce((a, [, v]) => a + v, 0)), '', true], [t('Costs'), money(costs.reduce((a, [, v]) => a + v, 0)), '', false],
        [t('Net'), money(bal.net), '', bal.net >= 0], [t('Treasury'), money(city.money), ''], [t('Bank loan'), city.loan ? money(city.loan) : '—', '', !city.loan],
      ] },
      { title: t('Where the money comes from'), donut: income.filter(([, v]) => v > 0).map(([k, v], i) => [t(k), v, C[i % C.length]] as [string, number, string]) },
      { title: t('Income and costs'), bars: [...income.map(([k, v]) => [t(k), v, '#7be08f', `+${money(v)}`] as [string, number, string, string]), ...costs.map(([k, v]) => [t(k), v, '#ff7a6e', `−${money(v)}`] as [string, number, string, string])] },
      { title: t('Net per day'), chart: { series: [series(t('Net'), '#f2b33d', net('money'))], format: 'money' } },
      { title: t('Every entry yesterday'), rows: items.slice(0, 24).map(([k, v]) => [t(k), `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`, v >= 0 ? 'good' : 'bad'] as [string, string, ('good' | 'bad')?]) },
    ] });
    tabs.push({ id: 'people', label: t('People'), sections: [
      { title: t('Who lives here'), donut: [[t('Men'), counts.men, '#6fb6ff'], [t('Women'), counts.women, '#f28cb8'], [t('Boys'), counts.boys, '#8fc8ff'], [t('Girls'), counts.girls, '#f7b9d4'], [t('Babies'), counts.babies, '#f2ede2'], [t('Elders'), counts.elders, '#b9a3e0']] },
      { title: t('Ages'), bars: ([['0–5', 0, 6], ['6–17', 6, 18], ['18–29', 18, 30], ['30–44', 30, 45], ['45–64', 45, 65], ['65+', 65, 200]] as const).map(([k, a, b], i) => [k, age(a, b), C[i], `${age(a, b)}`] as [string, number, string, string]) },
      { title: t('Education of adults'), bars: [[t('No trade'), skill[0], '#aab4be', `${skill[0]}`], [t('Learnt a trade'), skill[1], '#6fb6ff', `${skill[1]}`], [t('University degree'), skill[2], '#7be08f', `${skill[2]}`]] },
      { title: t('Family savings'), bars: wealth.map(([k, v], i) => [t(k), v, ['#ff7a6e', '#f2b33d', '#6fb6ff', '#7be08f'][i], `${v}`] as [string, number, string, string]) },
      { title: t('Richest families'), rows: richest.map((f) => {
        const biz = this.buildings.list.filter((b) => b.owner === f.id && !b.removed);
        const worth = f.money + biz.reduce((a, b) => a + BUILDINGS[b.kind].money, 0);
        return [`${t('{family} family', { family: f.surname })}${biz.length ? ` · ${biz.map((b) => t(BUILDINGS[b.kind].name)).join(', ')}` : ''}`,
          `${money(f.money)}${biz.length ? ` · ${t('worth {n}', { n: money(worth) })}` : ''}`, worth >= 10000 ? 'good' : undefined, () => this.showFamily(f)] as [string, string, ('good' | 'bad' | undefined), () => void];
      }), note: t('Cash in hand; "worth" adds the value of the businesses and blocks of flats the family owns.') },
      { title: t('Health'), rows: [[t('Hungry'), `${counts.hungry}`, counts.hungry ? 'bad' : 'good'], [t('Sick'), `${counts.sick}`, counts.sick ? 'bad' : 'good'], [t('Died yesterday'), `${city.deaths}`, city.deaths ? 'bad' : undefined]] },
    ] });
    tabs.push({ id: 'buildings', label: t('Buildings'), sections: [
      { title: t('Buildings by kind'), donut: [...byCat.entries()].map(([k, v], i) => [t(k), v, C[i % C.length]] as [string, number, string]) },
      { title: t('Most common'), bars: [...byKind.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v], i) => [k, v, C[i % C.length], `${v}`] as [string, number, string, string]) },
      { title: t('State'), rows: [[t('Buildings'), `${own.length}`], [t('Under construction'), `${own.length - built.length}`], [t('Nobody works there'), `${empty}`, empty ? 'bad' : 'good'], [t('Without power'), `${dark}`, dark ? 'bad' : 'good']] },
      // every business with yesterday's takings, the tax it paid and the owner's profit (best first)
      ...(() => {
        const biz = built.filter((b) => b.books && (b.books.revenue > 0 || b.owner >= 0)).sort((a, b) => b.books!.revenue - a.books!.revenue);
        const total = biz.reduce((a, b) => a + b.books!.revenue, 0), tax = biz.reduce((a, b) => a + b.books!.tax, 0);
        return [{ title: t('Businesses yesterday ({n})', { n: biz.length }), wide: true,
          rows: biz.length ? biz.map((b) => {
            const owner = b.owner >= 0 ? this.pop.families.get(b.owner) : undefined;
            const bk = b.books!;
            return [`${t(BUILDINGS[b.kind].name)} · ${owner ? t('{name} family', { name: owner.surname }) : t('City-owned')}`,
              `${t('takings')} $${bk.revenue} · ${t('tax')} $${bk.tax}${owner ? ` · ${t('profit')} ${bk.profit >= 0 ? '+' : '−'}$${Math.abs(bk.profit)}` : ''}${(() => { const top = Object.entries(bk.items ?? {}).filter(([, n]) => n >= 0.5).sort((a, c) => c[1] - a[1])[0]; return top ? ` · ${t(top[0])}: ${Math.round(top[1])}` : ''; })()}`,
              bk.profit < 0 ? 'bad' : undefined, () => { this.cityReport?.hide(); this.cam.flyTo(b.mesh.position.x, b.mesh.position.z, 6); this.select({ type: 'building', id: b.id }); }] as [string, string, ('good' | 'bad' | undefined), () => void];
          }) : [[t('No business has taken any money yet'), '—']],
          note: t('Takings of all businesses yesterday: ${a}; business tax for the town: ${b}.', { a: Math.round(total), b: Math.round(tax) }) } as ReportSection];
      })(),
    ] });
    if (!city.ai) {
      const towns = [...this.eco.cities.values()].filter((c) => c.ai);
      tabs.push({ id: 'trade', label: t('Trade'), sections: [
        { title: t('Today'), kpis: [[t('Sold today'), money(this.trade.today.sold), t('to other towns')], [t('Bought today'), money(this.trade.today.bought), t('from other towns')]] },
        { title: t('Relations with neighbour towns'), bars: towns.map((c) => [c.name, c.relation ?? 40, c.tint ?? '#aab4be', `${Math.round(c.relation ?? 40)}/100`] as [string, number, string, string]) },
        { title: t('Goods per day (made − used)'), chart: { series: [series(t('Food'), '#7be08f', net('food')), series(t('Wood'), '#c98a5a', net('wood')), series(t('Stone'), '#aab4be', net('stone')), series(t('Iron'), '#6fb6ff', net('iron'))] } },
      ] });
    } else {
      const d = this.dealings.get(id) ?? [];
      tabs.push({ id: 'trade', label: t('Dealings with you'), sections: [
        { title: t('Dealings with you'), rows: d.length ? d.map((x) => [`${dateLabel(x.day)} · ${x.text}`, x.money ? `${x.money > 0 ? '+' : '−'}${money(Math.abs(x.money))}` : '—', x.money > 0 ? 'good' : x.money < 0 ? 'bad' : undefined] as [string, string, ('good' | 'bad')?]) : [[t('No deals yet — open Trade to sell them what they need'), '—']] },
      ] });
    }
    // ---- the town hall itself: figures and its buttons ----
    const hallB = this.buildings.townHall(id);
    if (hallB) {
      const hv = this.cityView(hallB);
      if (!city.ai) {
        hv.rows = [...(hv.rows ?? []), [t('Average wage'), `$${avgPay.toFixed(1)}/${t('day')}`], [t('Come from other towns to work here'), `${this.commuters(id, true)}`], [t('Work in other towns'), `${this.commuters(id, false)}`]];
        const moveAction = {
          label: `${t('Move')} · $${Math.round(BUILDINGS.townhall.money * 0.25)}`,
          icon: 'pan' as const,
          onClick: () => {
            this.cityReport?.hide();
            this.startMove(hallB);
          },
        };
        hv.actions = [moveAction, ...(hv.actions ?? []).filter((a) => a.icon !== 'info' && a.icon !== 'buildings' && a.icon !== 'pan')];
      } else {
        hv.actions = (hv.actions ?? []).filter((a) => a.icon === 'people');
      }
      tabs.unshift({ id: 'hall', label: t('Town hall'), hall: hv });
    }
    // ---- relations with the neighbour towns ----
    const towns = [...this.eco.cities.values()].filter((c) => c.ai && c.id !== id);
    if (!city.ai) {
      const incoming = [...this.pop.citizens.values()].filter((c) => {
        const job = c.job >= 0 ? this.buildings.get(c.job) : undefined, home = this.buildings.get(this.pop.families.get(c.family)?.home ?? -1);
        return job && home && job.city === id && home.city !== id;
      });
      const outgoing = [...this.pop.citizens.values()].filter((c) => {
        const job = c.job >= 0 ? this.buildings.get(c.job) : undefined, home = this.buildings.get(this.pop.families.get(c.family)?.home ?? -1);
        return job && home && home.city === id && job.city !== id;
      });
      const who = (c: Citizen, other: 'home' | 'job') => {
        const f = this.pop.families.get(c.family), job = this.buildings.get(c.job)!, home = this.buildings.get(f?.home ?? -1);
        const town = this.eco.cities.get(other === 'home' ? home?.city ?? -1 : job.city)?.name ?? '—';
        const pay = BUILDINGS[job.kind].salary * (this.eco.cities.get(job.city)?.wages[job.kind] ?? 1);
        return [`${c.name} ${f?.surname ?? ''} · ${other === 'home' ? t('from {city}', { city: town }) : t('in {city}', { city: town })}`, `${t(BUILDINGS[job.kind].name)} · $${pay.toFixed(1)}`, undefined, () => this.showPerson(c)] as [string, string, ('good' | 'bad' | undefined), () => void];
      };
      // ---- migration: who comes to work, who goes out, which families moved in ----
      const office = own.some((b) => b.kind === 'migration' && b.built >= 1 && b.workers > 0);
      const arrivals = city.arrivals ?? [];
      tabs.push({ id: 'migration', label: t('Migration'), sections: [
        { title: t('Migration'), kpis: [
          [t('Come to work here'), n(incoming.length), t('from other towns')],
          [t('Work in other towns'), n(outgoing.length), t('our people')],
          [t('New families'), n(arrivals.filter((a) => a.day > this.eco.day - 30).length), t('in the last 30 days')],
          [t('Migration Company'), office ? t('Working') : t('None'), office ? t('registers everyone who comes') : t('build one to register newcomers'), office],
        ] },
        { title: t('Come from other towns to work here ({n})', { n: incoming.length }), wide: true, rows: incoming.length ? incoming.map((c) => who(c, 'home')) : [[t('Nobody yet — they come when your town has open jobs or pays at least 25% more'), '—']],
          note: t('They live in their own town and come by road, footpath or train; your town pays their wage.') },
        { title: t('Our people working in other towns ({n})', { n: outgoing.length }), wide: true, rows: outgoing.length ? outgoing.map((c) => who(c, 'job')) : [[t('Nobody'), '—']] },
        { title: t('Families who moved in ({n})', { n: arrivals.length }), wide: true, rows: arrivals.length ? arrivals.map((a) => {
          const fam = this.pop.families.get(a.family);
          const jobs = fam ? this.pop.members(fam).filter((m) => m.job >= 0).map((m) => t(BUILDINGS[this.buildings.get(m.job)?.kind ?? 'house'].name)) : [];
          return [`${t('{name} family', { name: a.surname })} · ${t('from {city}', { city: a.from })}`, `${dateLabel(a.day)} · ${jobs.length ? jobs.join(', ') : t('looking for work')}`, undefined, () => { if (fam) this.showFamily(fam); }] as [string, string, ('good' | 'bad' | undefined), () => void];
        }) : [[office ? t('Nobody has moved in yet') : t('Build a Migration Company to register the families who move in'), '—']] },
      ] });
      tabs.push({ id: 'relations', label: t('Relations'), sections: [
        { title: t('Friendship with neighbour towns'), bars: towns.map((c) => [c.name, Math.max(1, c.relation ?? 40), c.tint ?? '#aab4be', `${Math.round(c.relation ?? 40)}/100 · ${t(this.friendship(c.relation ?? 40))}`] as [string, number, string, string]),
          note: t('0–24 cold · 25–49 neutral · 50–74 friends · 75–100 close allies. Trade, gifts and help raise it; refusing a request lowers it.') },
        ...towns.map((c) => {
          const d = this.dealings.get(c.id) ?? [];
          const total = d.reduce((a, x) => a + x.money, 0);
          return { title: `${c.name} · ${t('Dealings with you')} · ${total >= 0 ? '+' : '−'}$${n(Math.abs(total))}`, rows: d.length ? d.slice(0, 8).map((x) => [`${dateLabel(x.day)} · ${x.text}`, x.money ? `${x.money > 0 ? '+' : '−'}$${n(Math.abs(x.money))}` : '—', x.money > 0 ? 'good' : x.money < 0 ? 'bad' : undefined] as [string, string, ('good' | 'bad')?]) : [[t('No deals yet — open Trade to sell them what they need'), '—']] } as ReportSection;
        }),
      ] });
    }
    // ---- every price in the town ----
    const goods = GOODS;
    const avgWage = staff ? built.reduce((a, b) => a + BUILDINGS[b.kind].salary * (city.wages[b.kind] ?? 1) * b.workers, 0) / staff : 0;
    tabs.push({ id: 'prices', label: t('Prices'), sections: [
      { title: t('Goods (today, in the other towns)'), rows: goods.map((g) => {
        const pops = this.life.populationByCity();
        const ps = [...this.eco.cities.values()].filter((c) => c.id !== id).map((c) => this.midPrice(c, g, pops.get(c.id) ?? 0));
        return [t(GOOD_NAME[g]), ps.length ? `${t('Sell')} $${Math.max(...ps).toFixed(1)} · ${t('Buy')} $${(Math.min(...ps) * 1.1).toFixed(1)}` : '—'] as [string, string];
      }) },
      { title: t('Cars and homes'), rows: [
        [t('A new car at the car market'), `$${CAR_PRICE}`], [t('A bicycle from the factory'), `$${BIKE.price}`], [t('An old bicycle bought back'), `$${BIKE.buyBack}`], [t('A car sold to another region'), `$${Math.round(CAR_PRICE * 0.75)}`], [t('A car imported'), `$${Math.round(CAR_PRICE * 1.1)}`],
        [t('A house (to build)'), `$${BUILDINGS.house.money}`], [t('Rent of a flat'), `$${RENT}/${t('day')}`], [t('Grave plot'), `$${GRAVE_COST}`],
      ] },
      { title: t('Bills and services'), rows: [
        [t('Electricity and water (utility bill)'), t('${n} per person per day', { n: 1.5 })], [t('Food price'), `×${city.priceFactor.toFixed(2)}`, city.priceFactor > 1.1 ? 'bad' : undefined],
        [t('Bus ticket'), `$${BUS.fare}`], [t('Hospital visit'), `$${SERVICE_FEE.hospital}`], [t('Parking'), `$${SERVICE_FEE.parking}`],
        [t('Concert ticket (touring star)'), `$${CONCERT.ticket}`], [t('Cinema ticket'), `$${CINEMA.ticket}`], [t('Football ticket'), `$${FOOTBALL.ticket}`], [t('Hotel room for tourists'), `$${TOURISM.spend}/${t('day')}`],
      ] },
      { title: t('Shops and visits'), rows: ([...Object.entries(SHOP_PRICE), ...Object.entries(VISIT_PRICE)] as [string, [number, number]][]).map(([k, r]) => [t(BUILDINGS[k as BuildingKind]?.name ?? k), `$${r[0]}–${r[1]}`] as [string, string]) },
      { title: t('Wages'), rows: [[t('Average wage'), `$${avgWage.toFixed(1)}/${t('day')}`], [t('Tax on wages'), `${Math.round(city.taxRate * 100)}%`], [t('Pension'), `$${PENSION}/${t('day')}`], [t('Night shift'), '+50%']] },
    ] });
    // ---- who does what: people by profession ----
    const prof = new Map<string, Citizen[]>();
    for (const c of people) {
      const p = c.job >= 0 ? this.professionOf(c) : c.school >= 0 ? this.professionOf(c) : c.age >= 65 ? t('Retired') : c.age < 6 ? t('Child at home') : c.age >= 18 ? t('Looking for work') : t('Child at home');
      prof.set(p, [...(prof.get(p) ?? []), c]);
    }
    const profList = [...prof.entries()].sort((a, b) => b[1].length - a[1].length);
    tabs.push({ id: 'professions', label: t('Professions'), sections: [
      { title: t('People by profession'), bars: profList.slice(0, 18).map(([k, l], i) => [k, l.length, C[i % C.length], `${l.length}`] as [string, number, string, string]) },
      ...profList.slice(0, 12).map(([k, l]) => ({ title: `${k} · ${l.length}`, rows: l.slice(0, 12).map((c) => [`${c.name} ${this.pop.families.get(c.family)?.surname ?? ''}`, `${t('{n} years', { n: Math.floor(c.age) })}${c.job >= 0 ? ` · $${Math.round(this.pop.wage(c, this.buildings.get(c.job)))}/${t('day')}` : ''}`] as [string, string]) }) as ReportSection),
    ] });
    // ---- jobs: sectors, diplomas, wages ----
    const sector = new Map<string, [number, number]>();
    let degJobs = 0, degStaff = 0, plainJobs = 0, plainStaff = 0;
    for (const b of built) {
      const d = BUILDINGS[b.kind];
      if (!d.jobs) continue;
      const k = catOf(b);
      const e = sector.get(k) ?? [0, 0];
      e[0] += b.workers; e[1] += d.jobs;
      sector.set(k, e);
      if (DEGREE_JOBS[b.kind]) { degJobs += d.jobs; degStaff += b.workers; } else { plainJobs += d.jobs; plainStaff += b.workers; }
    }
    const skilled = people.filter((c) => c.age >= 18 && c.skill >= 1).length;
    tabs.push({ id: 'jobs', label: t('Jobs'), sections: [
      { title: t('Jobs'), kpis: [
        [t('Workers'), `${staff}/${jobs}`, t('{n} open jobs', { n: Math.max(0, jobs - staff) }), staff >= jobs],
        [t('Jobs that need a diploma'), `${degStaff}/${degJobs}`, t('{n} people have a diploma', { n: skilled }), degStaff >= degJobs],
        [t('Jobs for everyone'), `${plainStaff}/${plainJobs}`, '', plainStaff >= plainJobs],
        [t('Unemployed'), n(Math.max(0, counts.workforce - counts.workers)), '', counts.workforce <= counts.workers],
        [t('Average wage'), `$${avgWage.toFixed(1)}`, city.wageAuto ? t('set automatically') : t('set by hand')],
      ] },
      { title: t('Workers by sector'), donut: [...sector.entries()].map(([k, v], i) => [t(k), v[0], C[i % C.length]] as [string, number, string]) },
      { title: t('Filled jobs by sector'), bars: [...sector.entries()].map(([k, v], i) => [t(k), v[1] ? v[0] / v[1] : 0, C[i % C.length], `${v[0]}/${v[1]}`] as [string, number, string, string]) },
      { title: t('People and workers over time'), chart: { series: [series(t('People'), '#6fb6ff', hist.map((h) => h.pop)), series(t('Working'), '#7be08f', hist.map((h) => (h as { work?: number }).work ?? 0))] } },
      { title: t('Best paid jobs'), bars: [...new Set(built.filter((b) => BUILDINGS[b.kind].jobs).map((b) => b.kind))].map((k) => [t(BUILDINGS[k].name), BUILDINGS[k].salary * (city.wages[k] ?? 1), DEGREE_JOBS[k] ? '#b9a3e0' : '#6fb6ff', `$${(BUILDINGS[k].salary * (city.wages[k] ?? 1)).toFixed(1)}${DEGREE_JOBS[k] ? ' 🎓' : ''}`] as [string, number, string, string]).sort((a, b) => b[1] - a[1]).slice(0, 14) },
    ] });
    // ---- every good: in stock, in and out yesterday ----
    const resList: [Res, string][] = [['money', 'Money'], ['food', 'Food'], ['wood', 'Wood'], ['stone', 'Stone'], ['iron', 'Iron'], ['grain', 'Grain'], ['flour', 'Flour'], ['milk', 'Milk'], ['feed', 'Corn feed'], ['cotton', 'Cotton'], ['planks', 'Planks'], ['bricks', 'Bricks'], ['steel', 'Steel'], ['coal', 'Coal'], ['garments', 'Clothes'], ['furniture', 'Furniture']];
    tabs.push({ id: 'goods', label: t('Goods'), sections: resList.map(([r, label]) => {
      const sec = this.ledgerSections(city, r);
      const y = ledger[0]?.[r] ?? city.ledger[r];
      const top = Object.entries(y).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
      return { title: t(label), rows: [...(sec[0].rows ?? []), ...top.map(([k, v]) => [`· ${t(k)}`, `${v >= 0 ? '+' : '−'}${n(Math.abs(v))}`, v >= 0 ? 'good' : 'bad'] as [string, string, ('good' | 'bad')?])] } as ReportSection;
    }) });
    if (!city.ai) {
      const sp = this.statPages(city, own);
      // the production page is shown live below (statistics), so no copy of it here
      if (sp.production?.length) tabs.push({ id: 'production', label: t('Production'), embed: 'stats:production' });
      const rc = this.net.counts(this.map.water);
      tabs.push({ id: 'traffic', label: t('Traffic'), sections: [
        { title: t('Traffic'), kpis: [
          [t('Cars driving'), n(this.traffic.count('car')), t('{n} parked', { n: this.life.parkedCars().length })],
          [t('Pedestrians'), n(this.walkers.list.length), t('walking now')],
          [t('Trucks'), n(this.traffic.count('truck')), ''],
          [t('Traffic lights'), n(this.traffic.signalCount), t('junctions')],
        ] },
        { title: t('Network'), rows: [
          [t('Road tiles'), n(rc.total)],
          [t('Bridges'), n(rc.bridges)],
          [t('Roundabouts'), n(this.net.roundabouts.length)],
          [t('Footpaths'), n(this.footpaths.count())],
          [t('Canals'), n(this.canals.count())],
        ] },
      ] });
      const cows = this.animals.list.filter((a) => a.kind === 0).length;
      const sheep = this.animals.list.filter((a) => a.kind === 1).length;
      const herds = new Set(this.animals.list.map((a) => `${a.kind}:${Math.round(a.herdX)}:${Math.round(a.herdZ)}`)).size;
      tabs.push({ id: 'nature', label: t('Nature'), sections: [
        { title: t('Nature'), kpis: [
          [t('Cows'), n(cows), t('{n} herds', { n: herds })],
          [t('Sheep'), n(sheep), ''],
          [t('Trees'), n(this.terrain.trees.size), t('felled trees regrow')],
          [t('Ranches'), n(own.filter((b) => b.kind === 'ranch').length), t('cattle for food')],
        ] },
        { title: t('Wild animals'), bars: [[t('Cows'), cows, '#f2b33d', `${cows}`], [t('Sheep'), sheep, '#e8e4da', `${sheep}`]] },
      ] });
      if (this.eco.cities.size > 1) {
        const pops = this.life.populationByCity();
        tabs.push({ id: 'cities', label: t('Cities'), sections: [
          { title: t('All cities'), rows: [...this.eco.cities.values()].map((c) => [
            c.name, `${pops.get(c.id) ?? 0} ${t('people')} · $${n(Math.round(c.money))} · ${Math.round(c.happiness)}%`, c.id === id ? 'good' : undefined
          ] as [string, string, ('good' | 'bad')?]) },
        ] });
      }
      tabs.push({ id: 'market', label: t('Trade window'), embed: 'trade' });
      // ---- taxes: the rate, what each tax brings, how people feel about it ----
      const taxDays = [...ledger].reverse();
      const taxOf = (k: string) => taxDays.map((l) => Math.round(l.money?.[k] ?? 0));
      const taxMood = city.mood.find(([k]) => k === 'Taxes')?.[1] ?? 0;
      const totalTax = bal.incomeTax + bal.businessTax + bal.propertyTax;
      const setTax = (d: number) => { city.taxRate = Math.round(Math.min(0.4, Math.max(0.1, city.taxRate + d)) * 100) / 100; this.refreshInspector(); };
      tabs.push({ id: 'taxes', label: t('Taxes'), sections: [
        { title: t('Tax rate'), kpis: [
          [t('Income tax'), `${Math.round(city.taxRate * 100)}%`, t('of every wage')],
          [t('Business tax'), `${Math.round(city.taxRate * 80)}%`, t('of every sale (80% of the income tax)')],
          [t('Taxes yesterday'), money(totalTax), totalTax && bal.net ? t('{n}% of the income', { n: Math.round((totalTax / Math.max(1, totalTax + bal.utilities + bal.foodSales + (bal.fares ?? 0) + (bal.services ?? 0))) * 100) }) : ''],
          [t('Mood from taxes'), `${taxMood >= 0 ? '+' : '−'}${Math.abs(taxMood).toFixed(1)}`, city.taxRate > 0.32 ? t('people complain — taxes are high') : city.taxRate < 0.2 ? t('people like low taxes') : t('people accept it'), taxMood >= 0],
        ], actions: [
          { label: t('Tax −5%'), onClick: () => setTax(-0.05), off: city.taxRate <= 0.1 },
          { label: t('Tax +5%'), onClick: () => setTax(0.05), off: city.taxRate >= 0.4 },
        ], note: t('From 10% to 40%. Every 5% above 25% costs about 4 points of happiness; below 25% people are happier. Businesses pay 80% of the income tax rate on their sales.') },
        { title: t('Taxes yesterday'), bars: [
          [t('Income tax'), bal.incomeTax, '#6fb6ff', money(bal.incomeTax)],
          [t('Business tax'), bal.businessTax, '#f2b33d', money(bal.businessTax)],
          [t('Property tax'), bal.propertyTax, '#7be08f', money(bal.propertyTax)],
        ] },
        { title: t('Taxes per day'), wide: true, chart: { series: [series(t('Income tax'), '#6fb6ff', taxOf('Income tax')), series(t('Business tax'), '#f2b33d', taxOf('Business tax')), series(t('Property tax'), '#7be08f', taxOf('Property tax'))], format: 'money' } },
        { title: t('Who pays'), rows: [
          [t('Working people'), n(counts.workers)], [t('Businesses'), n(own.filter((b) => BUSINESS_KINDS.includes(b.kind) && b.built >= 1).length)],
          [t('Homes (property tax)'), n(homes.length)], [t('Unemployed (pay nothing)'), n(Math.max(0, counts.workforce - counts.workers)), counts.workforce > counts.workers ? 'bad' : 'good'],
        ] },
      ] });
      // ---- the statistics pages live inside their tabs; the tabs in a sensible order ----
      const live: Record<string, string> = { overview: 'overview', people: 'people', jobs: 'jobs', money: 'economy', utilities: 'energy', trade: 'finance', relations: 'cities', traffic: 'traffic', nature: 'nature' };
      for (const tb of tabs) if (live[tb.id] && !tb.embed) tb.embed = `stats:${live[tb.id]}`;
      if (!tabs.some((x) => x.id === 'relations')) tabs.push({ id: 'relations', label: t('Cities'), embed: 'stats:cities' });
      // ---- education: every school, kindergarten and university, how full it is, who has no place ----
      const schools = own.filter((b) => BUILDINGS[b.kind].students > 0 && b.built >= 1);
      const kids = people.filter((c) => c.age >= 6 && c.age < 18), small = people.filter((c) => c.age >= 3 && c.age < 6);
      const uniAge = people.filter((c) => c.age >= 18 && c.age < 23 && c.edu >= 0.9 && c.skill < 2);
      const at = (b: Building) => people.filter((c) => c.school === b.id).length;
      const seatsOfKind = (k: string) => schools.filter((b) => b.kind === k).reduce((a, b) => a + seatsOf(b), 0);
      const noSchool = kids.filter((c) => c.school < 0).length, noKg = small.filter((c) => c.school < 0).length;
      tabs.push({ id: 'education', label: t('Education'), sections: [
        { title: t('Education'), kpis: [
          [t('Pupils'), `${kids.length - noSchool}/${kids.length}`, noSchool ? t('{n} without a school place', { n: noSchool }) : t('every child has a place'), !noSchool],
          [t('Kindergarten'), `${small.length - noKg}/${small.length}`, noKg ? t('{n} without a place', { n: noKg }) : t('every child has a place'), !noKg],
          [t('Students'), n(people.filter((c) => c.school >= 0 && this.buildings.get(c.school)?.kind === 'university').length), t('{n} could study', { n: uniAge.length })],
          [t('School places'), n(seatsOfKind('school')), t('{n} kindergarten places', { n: seatsOfKind('kindergarten') })],
        ] },
        { title: t('Schools and their pupils'), wide: true, rows: schools.length ? schools.map((b) => {
          const s = at(b), cap = BUILDINGS[b.kind].students;
          return [`${t(BUILDINGS[b.kind].name)} #${b.id}`, `${s}/${cap} ${t('pupils')} · ${t('staff')} ${b.workers}/${BUILDINGS[b.kind].jobs}${s >= cap ? ` · ${t('full')}` : ''}`, s >= cap ? 'bad' : b.workers ? 'good' : 'bad', () => { this.cityReport?.hide(); this.cam.flyTo(b.mesh.position.x, b.mesh.position.z, 6); this.select({ type: 'building', id: b.id }); }] as [string, string, ('good' | 'bad' | undefined), () => void];
        }) : [[t('No schools yet — build a school and a kindergarten'), '—', 'bad']] },
        { title: t('Education of adults'), bars: [[t('No trade'), skill[0], '#aab4be', `${skill[0]}`], [t('Learnt a trade'), skill[1], '#6fb6ff', `${skill[1]}`], [t('University degree'), skill[2], '#7be08f', `${skill[2]}`]],
          note: t('Children go to the nearest school with a free place; school leavers with good marks study 4 years at a university and earn more. Academies make learning 30% faster.') },
        { title: t('What is missing'), rows: [
          ...(noSchool ? [[t('School places'), t('{n} more needed', { n: noSchool }), 'bad'] as [string, string, 'bad']] : []),
          ...(noKg ? [[t('Kindergarten places'), t('{n} more needed', { n: noKg }), 'bad'] as [string, string, 'bad']] : []),
          ...(!schools.some((b) => b.kind === 'university') && uniAge.length ? [[t('University'), t('{n} young people could study', { n: uniAge.length }), 'bad'] as [string, string, 'bad']] : []),
          ...(!noSchool && !noKg ? [[t('Every child has a place'), '✓', 'good'] as [string, string, 'good']] : []),
        ] },
      ] });
      // ---- gifts: send money or goods to another town (friendship grows) ----
      const others = [...this.eco.cities.values()].filter((c) => c.id !== id);
      if (others.length) {
        const to = others.find((c) => c.id === this.giftTarget) ?? others[0];
        const give = (what: 'money' | 'food' | 'wood' | 'stone' | 'iron', n: number) => () => this.sendGift(city, to, what, n);
        tabs.push({ id: 'gifts', label: t('Gifts'), sections: [
          { title: t('To which town?'), wide: true, actions: others.map((c) => ({ label: `${c.id === to.id ? '✓ ' : ''}${c.name} · ${Math.round(c.relation ?? 40)}/100`, onClick: () => { this.giftTarget = c.id; } })),
            note: t('A gift raises the friendship with that town: friends pay more for your goods, sell theirs cheaper and help when you write to them.') },
          { title: t('Send money to {city}', { city: to.name }), actions: [500, 1000, 2500, 5000].map((m) => ({ label: `$${m.toLocaleString('en-US')}`, onClick: give('money', m), off: city.money < m })),
            rows: [[t('Your treasury'), money(city.money)], [t('Their treasury'), money(to.money)]] },
          { title: t('Send goods to {city}', { city: to.name }), actions: [
            { label: `${t('Food')} 100`, onClick: give('food', 100), off: city.food < 100 }, { label: `${t('Wood')} 50`, onClick: give('wood', 50), off: city.wood < 50 },
            { label: `${t('Stone')} 50`, onClick: give('stone', 50), off: city.stone < 50 }, { label: `${t('Iron')} 20`, onClick: give('iron', 20), off: city.iron < 20 },
          ], rows: [[t('Food'), `${n(city.food)} → ${n(to.food)}`], [t('Wood'), `${n(city.wood)} → ${n(to.wood)}`], [t('Stone'), `${n(city.stone)} → ${n(to.stone)}`], [t('Iron'), `${n(city.iron)} → ${n(to.iron)}`]],
            note: t('With a road between the towns a truck carries the goods; without one they arrive at once.') },
        ] });
      }
      const order = ['hall', 'overview', 'taxes', 'money', 'people', 'education', 'jobs', 'migration', 'professions', 'buildings', 'utilities', 'production', 'goods', 'trade', 'market', 'prices', 'relations', 'gifts', 'cities', 'traffic', 'nature'];
      tabs.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
      const money0 = tabs.find((x) => x.id === 'money');
      if (money0) money0.label = t('Budget');
    }
    return { title: `${city.name}${city.ai ? ` · ${t('Neighbour town')}` : ''}`, subtitle: `${dateLabel(this.eco.day)} · ${t('{n} people', { n: pop })} · ${t('{n} families', { n: fams.length })}`, tabs };
  }

  /** Fly to the player's own town hall and open it. */
  private goHome() {
    const hall = this.buildings.townHall(this.eco.city.id) ?? this.buildings.halls().find((h) => !this.eco.cities.get(h.city)?.ai);
    if (!hall) return;
    this.cam.flyTo(hall.mesh.position.x, hall.mesh.position.z, Math.min(Math.max(this.cam.viewHalf, 6), 12));
  }

  /**
   * What a building needs and keeps: its raw material in stock (flour for a bakery, grain for a mill…),
   * what it makes, and the season for orchards. Shown in the building panel.
   */
  private stockRows(b: Building, city: City): [string, string, ('good' | 'bad')?][] {
    const n = (v: number) => Math.floor(v).toLocaleString('en-US');
    const out: [string, string, ('good' | 'bad')?][] = [];
    const needs: [Res, string, number, string][] = [];
    const io: Partial<Record<BuildingKind, [Res | null, string, string]>> = {
      bakery: ['flour', 'Flour', 'Bread for the shops'], mill: ['grain', 'Grain', 'Flour for the bakery'], dairy: ['milk', 'Milk', 'Cheese and ice cream'],
      sawmill: ['wood', 'Wood', 'Planks for building sites'], brickworks: ['stone', 'Stone', 'Bricks for building sites'], steelmill: ['iron', 'Iron', 'Steel for big buildings'],
      powerplant: ['wood', 'Wood', 'Electricity'], coalplant: ['coal', 'Coal', 'Electricity'], ranch: ['feed', 'Corn feed', 'Milk and meat'],
      grocery: ['food', 'Food', 'Groceries for families'], market: ['food', 'Food', 'Food and goods for families'], supermarket: ['food', 'Food', 'Food for families'],
      teahouse: ['food', 'Food', 'Tea and plov'], kiosk: ['food', 'Food', 'Coffee and ice cream'], clothes: ['garments', 'Clothes', 'Clothes for families (80% more with factory clothes, 30% with raw cotton)'],
      carfactory: ['iron', 'Iron', 'Cars for the car market'], factory: ['cotton', 'Cotton', 'Clothes from cotton, furniture from planks'],
    };
    const e = io[b.kind];
    if (e) {
      if (e[0]) needs.push([e[0], e[1], b.kind === 'carfactory' ? CARS.iron : b.kind === 'sawmill' ? 21 : b.kind === 'brickworks' ? 31 : b.kind === 'steelmill' ? 12 : 1, e[1]]);
      out.push([t('Makes'), t(e[2])]);
    }
    for (const [res, label, min] of needs) {
      const have = city[res];
      out.push([t('Needs'), t(label)], [t('{what} in stock', { what: t(label) }), n(have), have >= min ? 'good' : 'bad']);
      if (have < min) out.push([t('Problem'), t('Not enough {what} — it waits', { what: t(label).toLowerCase() }), 'bad']);
    }
    if (['grocery', 'market', 'supermarket', 'bakery', 'teahouse', 'kiosk'].includes(b.kind)) {
      const people = this.life.populationByCity().get(city.id) ?? 0;
      out.push([t('Food for the town'), t('{n} days', { n: people ? (city.food / people).toFixed(1) : '∞' }), people && city.food < people * 2 ? 'bad' : 'good']);
    }
    if (b.kind === 'bikefactory') {
      out.push([t('Makes'), t('Bicycles for families')], [t('Bicycles ready'), `${Math.floor(b.stored)}/${BIKE.max}`, b.stored >= 1 ? 'good' : 'bad'],
        [t('Price'), `$${BIKE.price}`], [t('Old bike bought back'), `$${BIKE.buyBack}`], [t('Iron per bicycle'), `${BIKE.iron}`], [t('Iron in stock'), `${Math.floor(city.iron)}`, city.iron >= 5 ? 'good' : 'bad'],
        [t('Families with bicycles'), `${[...this.pop.families.values()].filter((f) => f.bike && this.buildings.get(f.home)?.city === city.id).length}`]);
      if (city.iron < 5) out.push([t('Problem'), t('Not enough {what} — it waits', { what: t('Iron').toLowerCase() }), 'bad']);
    }
    if (b.kind === 'warehouse') {
      out.push([t('Keeps'), t('+{n} of each good, +{f} food', { n: STORAGE.warehouse, f: STORAGE.warehouseFood })]);
      for (const [r, label] of [['food', 'Food'], ['wood', 'Wood'], ['stone', 'Stone'], ['iron', 'Iron'], ['grain', 'Grain'], ['flour', 'Flour'], ['planks', 'Planks'], ['coal', 'Coal']] as [Res, string][]) {
        const cap = this.eco.capacity(city, r);
        out.push([t(label), `${n(city[r])} / ${n(cap)}`, city[r] >= cap * 0.95 ? 'bad' : undefined]);
      }
    }
    if (b.kind === 'orchard') {
      const m = monthOf(this.eco.day);
      const [txt, tone] = m >= 5 && m <= 9 ? ['Harvest time: lots of fruit', 'good'] : m === 3 || m === 4 || m === 10 ? ['Blossom or last fruit: a little', undefined] : ['Resting for the winter: no fruit', 'bad'];
      out.push([t('Season'), t(txt), tone as ('good' | 'bad' | undefined)]);
    }
    if (BUILDINGS[b.kind].jobs) out.push([t('Needs workers'), `${b.workers}/${BUILDINGS[b.kind].jobs}`, b.workers >= BUILDINGS[b.kind].jobs ? 'good' : 'bad']);
    if (BUILDINGS[b.kind].energy) out.push([t('Needs electricity'), b.powered ? t('Yes — powered') : t('No power'), b.powered ? 'good' : 'bad']);
    return out;
  }

  /**
   * An investor: a real rich family of the town (or a businessman from outside) wants land at the edge of town
   * for a workshop. If the town hall sells, the family pays and the workshop really goes up (and it owns it).
   */
  private investorDecision(city: City): Decision | null {
    const fam = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === city.id && f.money > 3200).sort((a, b) => b.money - a.money)[0];
    const head = fam ? this.pop.members(fam).filter((m) => m.age >= 18).sort((a, b) => b.age - a.age)[0] : undefined;
    const who = head && fam ? `${head.name} ${fam.surname}` : `${firstName('m')} ${clanName()}`;
    const kind: BuildingKind = city.money > 0 && this.life.populationByCity().get(city.id)! > 80 ? 'factory' : 'construction';
    const hall = this.buildings.townHall(city.id);
    if (!hall) return null;
    // a free plot at the edge of town with a road
    let spot: Tile | null = null, best = Infinity;
    for (let z = hall.z - 20; z <= hall.z + 20; z++) for (let x = hall.x - 20; x <= hall.x + 20; x++) {
      if (!inBounds(x, z)) continue;
      const d = Math.abs(Math.hypot(x - hall.x, z - hall.z) - 12);
      if (d >= best || this.foreignTown(x, z) || !this.buildings.check(kind, x, z).ok) continue;
      spot = { x, z }; best = d;
    }
    if (!spot) return null;
    const price = 2500;
    const site = spot;
    return {
      id: 'investor-real', title: t('{name} wants to buy land', { name: who }),
      text: t('{name}{from} wants to buy a plot at the edge of town and build a {kind} there. He pays ${price}, gives jobs and business tax — but people worry about smoke.', { name: who, from: fam ? '' : ` (${t('from another region')})`, kind: t(BUILDINGS[kind].name).toLowerCase(), price }),
      options: [
        { label: t('Sell the land'), note: t('+${price}, a {kind} is built (owned by {name}), people a little unhappy for 5 days', { price, kind: t(BUILDINGS[kind].name).toLowerCase(), name: who }), act: (c) => {
          if (fam) fam.money -= price;
          c.add('money', price, 'Land sold to an investor');
          const b = this.buildings.place(kind, site.x, site.z, { city: city.id, owner: fam?.id });
          this.terrain.clearTiles(this.buildings.footprint(kind, site.x, site.z).map((f) => idx(f.x, f.z)));
          this.networkChanged();
          c.mood(-3, 5);
          this.life.events.push(t('{name} started building a {kind} at the edge of town', { name: who, kind: t(BUILDINGS[kind].name).toLowerCase() }));
          this.cam.setState(b.mesh.position.x, b.mesh.position.z, this.cam.yaw, this.cam.viewHalf);
        } },
        { label: t('Refuse'), note: t('People are glad (+2 for 3 days)'), act: (c) => c.mood(2, 3) },
      ],
    };
  }

  /**
   * A touring star — only for a town with a concert hall. If booked, tonight the hall fills up to its seats with
   * residents and visitors from other towns; every ticket is paid, the fee goes to the star.
   */
  private concertDecision(city: City): Decision | null {
    const hall = this.buildings.list.find((b) => b.kind === 'concerthall' && b.city === city.id && b.built >= 1 && b.workers > 0);
    if (!hall) return null;
    const people = this.life.populationByCity().get(city.id) ?? 0;
    const fans = Math.min(CONCERT.seats, Math.round(people * 0.35 + 20 + city.tourists * 0.5));
    const fee = 900;
    const income = fans * CONCERT.ticket;
    return {
      id: 'concert-real', title: t('A famous singer is on tour'),
      text: t('A star offers a concert in the {hall} tonight. The fee is ${fee}. About {fans} of {seats} seats would be sold at ${ticket} — residents and visitors from other towns.', { hall: t('Concert Hall'), fee, fans, seats: CONCERT.seats, ticket: CONCERT.ticket }),
      options: [
        { label: t('Book the concert'), note: t('−${fee} now, about +${income} from tickets tonight, +8 happiness, tourists come', { fee, income }), act: (c) => {
          c.add('money', -fee, 'Concert: fee for the singer');
          this.life.leisure.concertTonight = true;
          c.mood(8, 3);
          c.tourists(Math.round(fans * 0.3));
          // the tickets are sold as people come in
          const visitors = Math.round(fans * 0.3);
          c.add('money', visitors * CONCERT.ticket, 'Concert tickets (visitors)');
          const residents = fans - visitors;
          let sold = 0;
          for (const f of this.pop.families.values()) {
            if (sold >= residents) break;
            if (this.buildings.get(f.home)?.city !== city.id || f.money < 60) continue;
            const n = Math.min(residents - sold, Math.max(1, Math.round(f.members.length / 2)));
            f.money -= n * CONCERT.ticket;
            sold += n;
          }
          c.add('money', sold * CONCERT.ticket, 'Concert tickets (residents)');
          this.life.events.push(t('Concert tonight: {n} tickets sold for ${m}', { n: visitors + sold, m: (visitors + sold) * CONCERT.ticket }));
          this.life.leisure.later(DAY_SECONDS * 0.4, () => { this.life.leisure.concertTonight = false; });
        } },
        { label: t('Too expensive'), note: t('Nothing happens'), act: () => {} },
      ],
    };
  }

  /** Level of friendship with a neighbour town. */
  private friendship(r: number) { return r >= 75 ? 'Close allies' : r >= 50 ? 'Friends' : r >= 25 ? 'Neutral' : 'Cold'; }

  /** Write down something that happened with a neighbour town (money: + you got, − you paid). */
  private deal(cityId: number, text: string, money: number) {
    const list = this.dealings.get(cityId) ?? [];
    list.unshift({ day: this.eco.day, text, money });
    if (list.length > 60) list.length = 60;
    this.dealings.set(cityId, list);
  }

  /** Once a day: how many people, how much money and how happy every town is. */
  private recordTowns() {
    const pops = this.life.populationByCity();
    for (const c of this.eco.cities.values()) {
      const h = this.worldHistory.get(c.id) ?? [];
      if (h.length && h[h.length - 1].day === this.eco.day) continue;
      h.push({ day: this.eco.day, pop: pops.get(c.id) ?? 0, money: Math.round(c.money), happy: Math.round(c.happiness), work: this.buildings.list.reduce((a, b) => a + (b.city === c.id ? b.workers : 0), 0) } as { day: number; pop: number; money: number; happy: number });
      if (h.length > 90) h.shift();
      this.worldHistory.set(c.id, h);
      // today's price of every good in this town
      const ph = this.priceHistory.get(c.id) ?? {};
      for (const g of GOODS) { const a = ph[g] ?? []; a.push(Math.round(this.midPrice(c, g, pops.get(c.id) ?? 0) * 10) / 10); if (a.length > 30) a.shift(); ph[g] = a; }
      this.priceHistory.set(c.id, ph);
    }
  }

  /** How much of a good a town wants to keep (for its prices: below it the good is dear, above it cheap). */
  private stockTarget(g: Good, people: number) {
    const t: Record<Good, number> = { food: people * 4 + 40, wood: 80, stone: 80, iron: 30, coal: 30, planks: 20, bricks: 20, steel: 15, grain: 40, flour: 30, milk: 30, cotton: 30, garments: 20, furniture: 15 };
    return t[g];
  }

  /** The going price of a good in a town: scarce is dear (up to ×1.7), plenty is cheap (down to ×0.55). */
  /** The buildings of the active town for the building list, grouped like the build menu, newest first within a group. */
  private buildingListItems() {
    const city = this.eco.city;
    const groupOf = (b: Building) => BUILDINGS[b.kind].units ? 'Homes' : ({ buildings: 'Town', services: 'Services', business: 'Business', production: 'Industry', decor: 'Decor' } as Record<string, string>)[ITEMS.find((i) => i.tool === b.kind)?.cat ?? ''] ?? 'Town';
    const order = ['Town', 'Services', 'Business', 'Industry', 'Homes', 'Decor'];
    const fams = new Map<number, string>();
    for (const f of this.pop.families.values()) fams.set(f.home, f.surname);
    return this.buildings.list
      .filter((b) => b.city === city.id && !b.removed && b.parent === undefined)
      .map((b) => {
        const d = BUILDINGS[b.kind];
        const [badge, tint] = KIND_BADGE[b.kind] ?? ['🏠', '#8d8a83'];
        let info = '', bad = false;
        if (b.built < 1) { info = `${t('Under construction')} ${Math.round(b.built * 100)}%`; }
        else if (b.fire > 0) { info = t('On fire!'); bad = true; }
        else if (d.units) { const s = fams.get(b.id); info = s ? t('{name} family', { name: s }) : t('Empty'); bad = !s; }
        else if (d.jobs) { info = `${b.workers}/${d.jobs}`; bad = b.workers === 0; }
        if (b.built >= 1 && d.energy && !b.powered) { info = info ? `${info} · ${t('No power')}` : t('No power'); bad = true; }
        return { id: b.id, name: `${t(d.name)}${b.owner >= 0 && this.pop.families.get(b.owner) ? ` · ${this.pop.families.get(b.owner)!.surname}` : ''}`, badge, tint, group: groupOf(b), info, bad };
      })
      .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name) || b.id - a.id);
  }

  private midPrice(c: City, g: Good, people: number) {
    const ratio = c[g] / this.stockTarget(g, people);
    // scarce is dear, plenty is cheap — and everything is dearer where the pay is higher
    return TRADE_PRICE[g] * Math.max(0.55, Math.min(1.7, 1.7 - 0.7 * ratio)) * this.life.priceLevel(c.id);
  }

  /** Every town on the map for the World window: what it is like, how it is doing and its news. */
  private worldView(): WorldTown[] {
    const pops = this.life.populationByCity();
    const out: WorldTown[] = [];
    for (const c of this.eco.cities.values()) {
      const own = this.buildings.list.filter((b) => b.city === c.id && !b.removed);
      let jobs = 0, staff = 0;
      for (const b of own) { jobs += BUILDINGS[b.kind].jobs; staff += b.workers; }
      const fams = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === c.id).sort((a, b) => b.money - a.money);
      const hist = this.autoCity.popHistory.get(c.id) ?? [];
      const people = pops.get(c.id) ?? 0;
      out.push({
        id: c.id, name: c.name, tint: c.tint ?? '#f2a93b', mine: !c.ai,
        style: c.ai ? STYLE_NAME[this.autoCity.styleOf(c)] : undefined,
        mood: c.ai ? this.autoCity.mood.get(c.id) ?? 'stable' : c.happiness < 40 || c.money < 0 ? 'crisis' : c.balance.net > 0 ? 'growing' : 'stable',
        people, growth: hist.length ? people - hist[0] : 0, money: c.money, happiness: c.happiness, tax: c.taxRate, loan: c.loan,
        buildings: own.length, jobs: `${staff}/${jobs}`,
        millionaires: fams.filter((f) => f.money >= 10000).length,
        richest: fams.slice(0, 2).map((f) => ({ name: t('{family} family', { family: f.surname }), money: f.money })),
        relation: c.ai ? c.relation ?? 40 : undefined,
        news: c.ai ? this.autoCity.log.get(c.id) ?? [] : [],
        homes: own.filter((b) => BUILDINGS[b.kind].units).reduce((a, b) => a + BUILDINGS[b.kind].units, 0),
        res: ([['Food', 'food'], ['Wood', 'wood'], ['Stone', 'stone'], ['Iron', 'iron'], ['Grain', 'grain'], ['Flour', 'flour'], ['Milk', 'milk'], ['Planks', 'planks'], ['Bricks', 'bricks'], ['Steel', 'steel'], ['Coal', 'coal'], ['Cotton', 'cotton'], ['Clothes', 'garments'], ['Furniture', 'furniture']] as const)
          .map(([label, k]) => [t(label), Math.round(c[k])] as [string, number]).filter(([, v], i) => i < 4 || v > 0),
        history: [...(this.worldHistory.get(c.id) ?? []), { day: this.eco.day, pop: people, money: Math.round(c.money), happy: Math.round(c.happiness) }],
        dealings: this.dealings.get(c.id) ?? [],
      });
    }
    return out.sort((a, b) => Number(b.mine) - Number(a.mine) || b.people - a.people);
  }

  /** Neighbour towns that run themselves: what they lack (they pay well) and what they have plenty of. */
  private neighbours() {
    const pops = this.life.populationByCity();
    const out = [];
    for (const c of this.eco.cities.values()) {
      if (!c.ai) continue;
      const people = pops.get(c.id) ?? 0;
      const rel = c.relation ?? 40;
      // every good has its own price in every town: scarce is dear, plenty is cheap (friends get a better deal)
      const target = (g: Good) => this.stockTarget(g, people);
      const buys: { g: Good; price: number; room: number; ratio: number }[] = [];
      const sells: { g: Good; price: number; have: number }[] = [];
      for (const g of GOODS) {
        const ratio = c[g] / target(g);
        const mid = this.midPrice(c, g, people);
        const room = Math.floor(this.eco.capacity(c, g) - c[g]);
        if (ratio < 2 && room >= 10) buys.push({ g, price: mid * (1 + rel / 400), room, ratio });
        const have = Math.floor(c[g] - target(g) * 1.2);
        if (have >= 10) sells.push({ g, price: mid * 1.1 * (1 - rel / 500), have });
      }
      const wants = buys.filter((w) => w.ratio < 1).sort((a, b) => a.ratio - b.ratio).slice(0, 3);
      const offers = sells.slice().sort((a, b) => b.have - a.have).slice(0, 3);
      // a neighbour with a car market but no car factory buys cars when it runs short
      const hasMarket = this.buildings.list.some((b) => b.kind === 'carmarket' && b.city === c.id && b.built >= 1);
      const hasFactory = this.buildings.list.some((b) => b.kind === 'carfactory' && b.city === c.id && b.built >= 1 && b.workers > 0);
      const carPrice = hasMarket && !hasFactory && this.life.carsInMarkets(c.id) < 3 ? Math.round(CAR_PRICE * (0.95 + rel / 400)) : undefined;
      out.push({ id: c.id, name: c.name, tint: c.tint ?? '#cccccc', people, money: c.money, relation: rel, wants, offers, buys, sells, carPrice });
    }
    return out;
  }

  /** A deal with a neighbour town: goods go one way, money the other, and the towns get friendlier. */
  private dealWithTown(id: number, g: Good, n: number, selling: boolean) {
    const me = this.eco.city, town = this.eco.cities.get(id);
    if (!town) return;
    const nb = this.neighbours().find((x) => x.id === id);
    const item = selling ? nb?.buys.find((w) => w.g === g && w.room >= n) : nb?.sells.find((o) => o.g === g && o.have >= n);
    if (!item) { sound.play('error'); return this.hud?.toast(t('They do not trade that right now')); }
    const money = Math.round(item.price * n);
    const from = selling ? me : town, to = selling ? town : me;
    if (from[g] < n || to.money < money) { sound.play('error'); return this.hud?.toast(selling ? t('They cannot pay right now') : t('Not enough money')); }
    this.eco.add(from, g, -n, selling ? 'Sold to a neighbour town' : 'Sold to a neighbour town');
    this.eco.add(to, g, n, 'Bought from a neighbour town');
    this.eco.add(to, 'money', -money, 'Trade with neighbour towns');
    this.eco.add(from, 'money', money, 'Trade with neighbour towns');
    town.relation = Math.min(100, (town.relation ?? 40) + n / 12);
    this.deal(town.id, selling ? t('Sold {n} {good}', { n, good: t(GOOD_NAME[g]).toLowerCase() }) : t('Bought {n} {good}', { n, good: t(GOOD_NAME[g]).toLowerCase() }), selling ? money : -money);
    sound.play('coin');
    this.hud?.toast(selling ? t('Sold {n} {good} to {city} for ${m}', { n, good: t(GOOD_NAME[g]).toLowerCase(), city: town.name, m: money }) : t('Bought {n} {good} from {city} for ${m}', { n, good: t(GOOD_NAME[g]).toLowerCase(), city: town.name, m: money }));
    this.refreshHud();
  }

  /** Sell goods to (or buy them from) the other regions; a truck leaves town with the goods when there is a road out. */
  private tradeGoods(g: Good, n: number, selling: boolean) {
    const city = this.eco.city;
    const linked = this.tradePanel ? this.buildings.list.some((b) => (b.kind === 'trainstation' || b.kind === 'airport') && b.city === city.id && b.built >= 1 && b.workers > 0) : false;
    const add = (res: Res, amount: number, why: string) => this.eco.add(city, res, amount, why);
    const r = selling ? this.trade.sell(city, g, n, linked, add) : this.trade.buy(city, g, n, linked, add);
    if (!r) { sound.play('error'); return this.hud?.toast(selling ? t('Not enough to sell') : t('Not enough money')); }
    sound.play('coin');
    this.hud?.toast(selling ? t('Sold {n} {good} for ${m}', { n: r.n, good: t(GOOD_NAME[g]).toLowerCase(), m: r.money }) : t('Bought {n} {good} for ${m}', { n: r.n, good: t(GOOD_NAME[g]).toLowerCase(), m: r.money }));
    // a lorry drives from the town hall to the edge of the road network (for show)
    const hall = this.buildings.townHall(city.id);
    if (hall && hall.access >= 0) {
      let far = -1, fd = 0;
      const hx = hall.access % N, hz = (hall.access / N) | 0;
      const cands: [number, number][] = [];
      for (let k = 0; k < this.net.type.length; k++) {
        if (!this.net.type[k] || this.net.isIntersection(k)) continue;
        const d = Math.abs((k % N) - hx) + Math.abs(((k / N) | 0) - hz);
        if (d > 6 && d < 60) cands.push([d, k]);
      }
      cands.sort((a, b) => b[0] - a[0]);
      for (const [d, k] of cands.slice(0, 4)) if (this.traffic.canRoute(hall.access, k)) { far = k; fd = d; break; }
      if (far >= 0 && fd > 6) this.traffic.spawn({ kind: 'truck', loaded: true, from: selling ? hall.access : far, to: selling ? far : hall.access, fromPos: selling ? this.buildings.door(hall) : undefined, toPos: selling ? undefined : this.buildings.door(hall), purpose: selling ? 'Taking goods to the traders' : 'Bringing goods from the traders', fromName: selling ? 'Town Hall' : 'Traders', destName: selling ? 'Traders' : 'Town Hall' });
    }
    this.refreshHud();
  }

  private sendGoods(from: City, to: City, what: 'stone' | 'wood' | 'food' | 'iron', amount: number) {
    if (from[what] < amount) { sound.play('error'); return this.hud?.toast(t('Not enough to send')); }
    const a = this.buildings.townHall(from.id), b = this.buildings.townHall(to.id);
    if (!a || !b || a.access < 0 || b.access < 0 || !this.traffic.canRoute(a.access, b.access)) {
      sound.play('error');
      return this.hud?.toast(t('No road between these cities'));
    }
    this.eco.add(from, what, -amount, 'Sent to another city');
    const ok = this.traffic.spawn({
      kind: 'truck', loaded: true, from: a.access, to: b.access, fromPos: this.buildings.door(a), toPos: this.buildings.door(b),
      onArrive: () => { this.eco.add(to, what, amount, 'Received from another city'); this.life.events.push(t('Goods arrived in {city}', { city: to.name })); },
      onFail: () => { this.eco.add(from, what, amount, 'Sent to another city'); },
    });
    if (!ok) { this.eco.add(from, what, amount, 'Sent to another city'); return this.hud?.toast(t('No free trucks right now')); }
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
    // only what is close to the middle of the view is heard; nearer tiles count more
    const r = Math.max(3, Math.min(9, Math.round(this.cam.viewHalf * 0.4)));
    let total = 0, water = 0, trees = 0, town = 0;
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, z)) continue;
      const d = Math.hypot(x - cx, z - cz);
      if (d > r) continue;
      const w = 1 - d / (r + 1);
      const k = idx(x, z);
      total += w;
      if (this.map.water[k] || this.canals.flowing[k]) water += w;
      else if (this.terrain.trees.has(k)) trees += w;
      else if (this.buildings.occ[k] !== -1 || this.net.type[k]) town += w;
    }
    // zoomed far out the world is quiet; close up it is fully heard
    const near = Math.max(0.12, Math.min(1, (30 - this.cam.viewHalf) / 22));
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
      this.eco.add(a, res, -amount, 'Sent by train');
      this.eco.add(b, res, amount, 'Arrived by train');
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
    const foreign = [...this.eco.cities.values()].filter((c) => c.ai).map((c) => c.name);
    const stories = (this.eventLog?.entries ?? []).filter((e) => e.day === yesterday).map((e) => e.text).filter((s) => !foreign.some((n) => s.includes(n)));
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
    const needs = this.townNeeds(city);
    const headline = stories.find((s) => /murder|o'ldir|fire|olov|mayor|mer|Navruz|Year|yil|train|poyezd/i.test(s)) ?? stories[0] ?? t('A quiet day in {city}', { city: city.name });
    this.news?.show({
      date: this.dateText(), city: city.name, headline, stories: stories.filter((s) => s !== headline),
      richest: richest ? `${t('{name} family', { name: richest.surname })} · $${Math.round(richest.money).toLocaleString('en-US')}` : '—',
      problem: problems[0] ?? needs[0] ?? t('None — the city is doing well'),
      needs,
      population: pop, popChange: pop - (this.yesterday.pop || pop), money: city.money, moneyChange: city.money - (this.yesterday.money || city.money),
    });
    this.yesterday = { pop, money: city.money };
  }

  /**
   * What a town needs next, most urgent first: power, water, food, waste water, homes or workers, and the missing
   * links of its production chains ("the bakery needs flour: build a flour mill").
   */
  townNeeds(city: City): string[] {
    const own = this.buildings.list.filter((b) => b.city === city.id && !b.removed);
    const built = own.filter((b) => b.built >= 1);
    const has = (k: BuildingKind) => built.some((b) => b.kind === k);
    const count = (k: BuildingKind) => own.filter((b) => b.kind === k).length;
    const pop = this.life.populationByCity().get(city.id) ?? 0;
    const out: string[] = [];
    const say = (s: string, p: Record<string, string | number> = {}) => out.push(t(s, p));
    // power
    if (city.energyDemand > city.energyCapacity + 0.5) say('Power is short by {n}: build a power plant, wind turbines or a solar farm', { n: kw(city.energyDemand - city.energyCapacity) });
    else if (city.energyDemand > city.energyCapacity * 0.85 && pop > 20) say('Power is nearly used up ({a} of {b}): build more before the town grows', { a: kw(city.energyDemand), b: kw(city.energyCapacity) });
    if (count('solarfarm') >= 2 && !count('battery')) say('Solar farms are dark at night: a battery storage keeps the lights on');
    if (has('coalplant') && city.coal < 10 && !has('coalmine')) say('The coal power plant has no coal: build a coal mine');
    if (has('powerplant') && city.wood < 10) say('The wood power plant is out of wood: build a woodcutter');
    // water and waste water
    if (city.water < 0.99) say('Not enough water: build a water tower');
    const sew = this.life.sewageCap.get(city.id);
    if (sew && sew.people > sew.treated) say('Waste water of {n} people is not treated: build a sewage treatment plant', { n: sew.people - sew.treated });
    // food
    if (pop && city.food < pop * 3) say('Food is running low: build farms, an orchard or a fishery');
    if (pop >= 25 && !has('grocery') && !has('market') && !has('supermarket')) say('People cannot buy food: build a grocery store');
    // homes and workers
    const free = this.life.freeHomes(city.id).length;
    const jobs = built.reduce((a, b) => a + BUILDINGS[b.kind].jobs, 0), staff = built.reduce((a, b) => a + b.workers, 0);
    const jobless = [...this.pop.citizens.values()].filter((c) => this.buildings.get(this.pop.families.get(c.family)?.home ?? -1)?.city === city.id && this.pop.canWork(c) && c.job < 0).length;
    if (jobs - staff >= 4) say('{n} jobs are empty: more people are needed — build homes so families move in', { n: jobs - staff });
    if (!free) say('No free homes: build houses or apartment blocks');
    if (jobless >= 3) say('{n} people are looking for work: build workplaces', { n: jobless });
    // production chains: what each one is missing
    if (has('bakery') && !has('mill')) say('The bakery needs flour: build a flour mill');
    if (has('mill') && !own.some((b) => b.kind === 'farm' && (b.cropKind ?? 'wheat') === 'wheat')) say('The flour mill needs grain: sow wheat on a field');
    if (has('mill') && !has('bakery')) say('There is flour: build a bakery for fresh bread');
    if (has('dairy') && !has('ranch')) say('The dairy needs milk: build a ranch');
    if (has('ranch') && !own.some((b) => b.kind === 'farm' && b.cropKind === 'corn')) say('Cattle give more milk with feed: sow corn on a field');
    if (has('clothes') && city.cotton < 5 && !has('factory')) say('The clothing store sells more with cotton: sow cotton and build a factory');
    if (has('sawmill') && !has('woodcutter')) say('The sawmill needs logs: build a woodcutter');
    if (has('brickworks') && !has('quarry')) say('The brickworks needs stone: build a stone quarry');
    if ((has('steelmill') || has('carfactory') || has('bikefactory')) && city.iron < 10 && !has('ironmine')) say('The factories need iron: build an iron mine');
    if (city.wood < 30 && !has('woodcutter')) say('Wood is running out: build a woodcutter');
    if (city.stone < 30 && !has('quarry')) say('Stone is running out: build a stone quarry');
    // services
    if (pop >= 60 && !count('landfill') && !count('recycling')) say('Garbage piles up: build a landfill');
    const full = built.filter((b) => b.kind === 'cemetery').every((b) => (b.graves?.length ?? 0) >= MAX_GRAVES_PER_CEMETERY * b.level * 0.85);
    if (has('cemetery') && full) say('The cemetery is almost full: expand it or build a new one');
    if (pop >= 60 && !has('cemetery')) say('There is no cemetery: build one');
    if (pop >= 35 && !has('school')) say('Children need a school');
    if (pop >= 90 && !has('hospital')) say('The sick have nowhere to go: build a hospital');
    if (pop >= 70 && !has('police')) say('Build a police station to keep the town safe');
    if (pop >= 100 && !has('firestation')) say('Build a fire station before a fire spreads');
    if (city.happiness < 50) say('People are unhappy: parks, decorations and shops make them happier');
    return out;
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


  /** Town Hall inspector: the whole picture of one city. */
  private cityView(b: Building): InspectorView {
    const v = this.cityViewFull(b);
    const city = this.cityOf(b);
    if (!city.ai) return v;
    // a neighbour town: it is not the player's to run — look, and trade from the Trade window
    v.actions = (v.actions ?? []).filter((a) => a.icon === 'people');
    v.tags = [{ text: t('Autonomous town'), tone: 'info' }, ...(v.tags ?? [])];
    v.subtitle = t('Runs itself — its own mayor decides what to build');
    v.rows = [[t('Relations with you'), `${Math.round(city.relation ?? 40)}/100`, (city.relation ?? 40) >= 50 ? 'good' : undefined], ...(v.rows ?? [])];
    return v;
  }

  private cityViewFull(b: Building): InspectorView {
    const city = this.cityOf(b);
    const own = this.buildings.list.filter((x) => x.city === city.id);
    const inCity = (c: Citizen) => this.cityOfCitizen(c) === city.id;
    const counts = this.pop.counts(inCity);
    const population = this.life.populationByCity().get(city.id) ?? 0;
    const families = [...this.pop.families.values()].filter((f) => this.buildings.get(f.home)?.city === city.id);
    const sum = (fn: (k: BuildingKind) => number) => own.reduce((a, x) => a + fn(x.kind), 0);
    const jobs = sum((k) => BUILDINGS[k].jobs);
    const seats = own.reduce((a, x) => a + seatsOf(x), 0);
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
      subtitle: `${t('Town Hall')} · ${t('Founded')}: ${dateLabel(city.founded)}`,
      tags,
      bars: [
        { label: t('Happiness'), value: city.happiness / 100, color: barColor(city.happiness / 100) },
        { label: t('Employment'), value: counts.workforce ? counts.workers / counts.workforce : 1, color: '#6fb6ff', text: `${counts.workers}/${counts.workforce}` },
        { label: t('Food'), value: Math.min(1, daysFood / 10), color: barColor(Math.min(1, daysFood / 10)), text: t('{n} days of food', { n: daysFood >= 99 ? '∞' : daysFood.toFixed(1) }) },
        { label: t('Energy supplied'), value: city.powered, color: '#ffe066' },
        { label: t('Water supplied'), value: city.water, color: '#4fa3d1' },
      ],
      rows: [
        ...(city.promise ? [[t('Promise'), `${t(PROMISE_TEXT[city.promise.kind])} · ${dateLabel(city.promise.until)}`] as [string, string]] : []),
        ...(city.campaign ? [[t('Election'), dateLabel(city.campaign.day)] as [string, string]] : []),
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
            [t('Bus fares'), signed(bal.fares ?? 0), 'good'],
            [t('Services (hospital, parking)'), signed(bal.services ?? 0), 'good'],
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
        ...(!city.ai ? [{
          label: `${t('Move')} · $${Math.round(BUILDINGS.townhall.money * 0.25)}`,
          icon: 'pan' as const,
          onClick: () => {
            this.cityReport?.hide();
            this.startMove(b);
          },
        }] : []),
        ...(mayor ? [{ label: t('Show the mayor'), icon: 'people' as const, onClick: () => this.select({ type: 'person', id: mayor.id }) }] : []),
        { label: t('Full report: charts and statistics'), icon: 'info' as const, onClick: () => this.cityReport?.open(city.id) },
        ...(city.taxRate > 0.1 ? [{ label: t('Tax −5%'), onClick: () => { city.taxRate = Math.round((city.taxRate - 0.05) * 100) / 100; this.refreshInspector(); } }] : []),
        ...(city.taxRate < 0.4 ? [{ label: t('Tax +5%'), onClick: () => { city.taxRate = Math.round((city.taxRate + 0.05) * 100) / 100; this.refreshInspector(); } }] : []),
        ...(Platform.adsAvailable ? [{ label: this.grantDay === this.eco.day ? t('Investors: come again tomorrow') : `▶ ${t('Grant from investors (watch an ad)')}`, icon: 'coin' as const, onClick: () => { void this.rewardGrant(city); } }] : []),
        ...(hasBank && city.loan + LOAN.step <= LOAN.max ? [{
          label: `${t('Take loan')} $${LOAN.step}`, icon: 'coin' as const,
          onClick: () => { city.loan += LOAN.step; this.eco.add(city, 'money', LOAN.step, 'Bank loan'); this.refreshInspector(); this.refreshHud(); },
        }] : []),
        ...(city.loan > 0 ? [{
          label: `${t('Repay')} $${Math.min(LOAN.step, city.loan)}`, icon: 'coin' as const,
          onClick: () => {
            const pay = Math.min(LOAN.step, city.loan);
            if (city.money < pay) return this.hud?.toast(t('Not enough money — needs ${n}', { n: pay }));
            city.loan -= pay; this.eco.add(city, 'money', -pay, 'Loan repayment'); this.refreshInspector(); this.refreshHud();
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

  private buildStarterTown(towns: number) {
    const capital = this.eco.found(townName(), START_GRANT);
    this.layVillage(N / 2, N / 2, capital.id, 48, mulberry32(this.map.seed * 3 + 1));
    // one or two neighbour towns that run themselves
    const rnd = mulberry32(this.map.seed * 13 + 5);
    const taken: Tile[] = [{ x: N / 2, z: N / 2 }];
    for (let i = 0; i < towns; i++) {
      const site = findTownSite(this.map, taken, towns > 2 ? 40 : 46, rnd);
      if (!site) break;
      taken.push(site);
      const town = this.eco.found(townName(), START_GRANT);
      town.ai = true;
      town.tint = TOWN_TINTS[i % TOWN_TINTS.length];
      town.relation = 40;
      town.style = TOWN_STYLES[Math.floor(rnd() * TOWN_STYLES.length)];
      town.taxRate = town.style === 'thrifty' ? 0.15 : town.style === 'industrial' ? 0.3 : 0.25;
      this.layVillage(site.x, site.z, town.id, 36 + Math.floor(rnd() * 16), rnd);
    }
    this.eco.active = capital.id;
    this.net.clearUndo();
    this.cam.setState(-1, 0, Math.PI / 4, 10);
  }

  /**
   * A small village around (cx, cz), different every time: the main street runs east–west or north–south with one
   * or two side streets at random places, and every building picks its own spot (homes and the shop near the
   * centre, the power plant and fields further out). About `people` people move in; two homes wait for newcomers.
   */
  private layVillage(cx: number, cz: number, cityId: number, people: number, rnd: () => number = Math.random) {
    const along = rnd() < 0.5;
    const P = (a: number, b: number): Tile => (along ? { x: cx + a, z: cz + b } : { x: cx + b, z: cz + a });
    const L1 = 7 + Math.floor(rnd() * 4), L2 = 5 + Math.floor(rnd() * 4);
    const land = (tl: Tile) => inBounds(tl.x, tl.z) && this.map.isLand(idx(tl.x, tl.z));
    const run = (tiles: Tile[]) => { const out: Tile[] = []; for (const tl of tiles) { if (!land(tl)) break; out.push(tl); } return out; };
    const mainW: Tile[] = [], mainE: Tile[] = [];
    for (let a = 0; a >= -L1; a--) mainW.push(P(a, 0));
    for (let a = 0; a <= L2; a++) mainE.push(P(a, 0));
    const main = [...run(mainW).reverse(), ...run(mainE).slice(1)];
    this.net.buildPath(main, ROAD_TWO_LANE);
    this.lights.setLit(main.map((tl) => idx(tl.x, tl.z)), true);
    const roads = [...main];
    // side streets
    const sides = 1 + (rnd() < 0.6 ? 1 : 0);
    const used: number[] = [];
    for (let i = 0; i < sides; i++) {
      let a0 = 0;
      for (let tries = 0; tries < 10; tries++) { a0 = -L1 + 3 + Math.floor(rnd() * (L1 + L2 - 4)); if (used.every((u) => Math.abs(u - a0) >= 4)) break; }
      used.push(a0);
      const dir = rnd() < 0.5 ? 1 : -1, len = 3 + Math.floor(rnd() * 4);
      const side = run(Array.from({ length: len + 1 }, (_, k) => P(a0, k * dir)));
      if (side.length > 1) { this.net.buildPath(side, ROAD_TWO_LANE); roads.push(...side); }
    }
    this.terrain.clearTiles(roads.map((tl) => idx(tl.x, tl.z)));

    const put = (kind: BuildingKind, x: number, z: number) => {
      if (!this.buildings.check(kind, x, z).ok) return null;
      const b = this.buildings.place(kind, x, z, { animate: false, city: cityId });
      this.terrain.clearTiles(this.buildings.footprint(kind, x, z).map((f) => idx(f.x, f.z)));
      return b;
    };
    /** Best free spot: 'centre' = as close as possible, 'edge' / 'far' = a ring further out; a little random. */
    const spot = (kind: BuildingKind, where: 'centre' | 'edge' | 'far', r = 15) => {
      let best: Tile | null = null, bs = Infinity;
      for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
        if (!inBounds(x, z)) continue;
        const d = Math.hypot(x - cx, z - cz);
        const sc = (where === 'centre' ? d : where === 'edge' ? Math.abs(d - 7) : Math.abs(d - 10)) + rnd() * 3;
        if (sc >= bs || !this.buildings.check(kind, x, z).ok) continue;
        best = { x, z };
        bs = sc;
      }
      return best ? put(kind, best.x, best.z) : null;
    };
    spot('townhall', 'centre');
    spot('watertower', 'centre');
    spot('grocery', 'centre');
    const houses: Building[] = [];
    const n = Math.max(5, Math.round(people / 6));
    for (let i = 0; i < n; i++) { const h = spot('house', 'centre'); if (h) houses.push(h); }
    spot('powerplant', 'edge');
    const farm = spot('farm', 'far');
    spot('orchard', rnd() < 0.5 ? 'edge' : 'far');
    spot('construction', 'edge');
    if (farm) this.digStarterCanal(farm);

    let best: Tile | null = null, bestD = Infinity;
    for (let z = cz - 26; z <= cz + 26; z++) for (let x = cx - 26; x <= cx + 26; x++) {
      if (!inBounds(x, z) || !this.map.isLand(idx(x, z)) || this.terrain.trees.has(idx(x, z))) continue;
      const d = Math.abs(x - cx) + Math.abs(z - cz) + rnd() * 4;
      if (d < 10 || d >= bestD || this.buildings.occ[idx(x, z)] !== -1 || this.net.type[idx(x, z)] || this.canals.tiles[idx(x, z)]) continue;
      if (this.terrain.treesNear(x, z, 6) >= 10) { best = { x, z }; bestD = d; }
    }
    if (best) put('woodcutter', best.x, best.z);
    let quarry: Tile | null = null, quarryD = Infinity;
    for (let z = cz - 34; z <= cz + 34; z++) for (let x = cx - 34; x <= cx + 34; x++) {
      const d = Math.abs(x - cx) + Math.abs(z - cz);
      if (d >= quarryD || !inBounds(x, z) || !this.buildings.check('quarry', x, z).ok) continue;
      quarry = { x, z };
      quarryD = d;
    }
    if (quarry) put('quarry', quarry.x, quarry.z);
    // a footpath from the centre towards the fields
    if (farm) {
      const path: Tile[] = [];
      const fx = farm.x + 1, fz = farm.z + 1;
      for (let k = 1; k <= 12; k++) {
        const x = Math.round(cx + ((fx - cx) * k) / 12), z = Math.round(cz + ((fz - cz) * k) / 12);
        if (inBounds(x, z) && this.map.isLand(idx(x, z)) && this.buildings.occ[idx(x, z)] === -1 && !this.net.type[idx(x, z)]) path.push({ x, z });
      }
      this.footpaths.add(path);
    }

    // families: about `people` people; nobody starts with a car (they buy one at a car market)
    const sizes = houses.map(() => 4 + Math.floor(rnd() * 4));
    let sum = sizes.reduce((a, v) => a + v, 0);
    while (sum > people) { const i = Math.floor(rnd() * sizes.length); if (sizes[i] > 3) { sizes[i]--; sum--; } else if (sizes.every((v) => v <= 3)) break; }
    while (sum < people) { const i = Math.floor(rnd() * sizes.length); if (sizes[i] < 9) { sizes[i]++; sum++; } else if (sizes.every((v) => v >= 9)) break; }
    const occupied = houses.length > 2 ? houses.slice(0, houses.length - 2) : houses;
    const extra = sizes.slice(occupied.length).reduce((a, v) => a + v, 0);
    occupied.forEach((h, i) => this.pop.createFamily(h.id, { size: Math.min(10, sizes[i] + (i < extra ? 1 : 0)), carChance: 0, money: 700 + Math.floor(rnd() * 600) }));
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

  /**
   * Worlds saved on a smaller map: put the old map in the middle of the bigger one. World positions stay the same
   * (they are centred), only tile numbers move; the new outer ring comes from the world generator.
   */
  private migrateMapSize(s: WorldSave) {
    const M = s.terrain ? Math.round(Math.sqrt(s.terrain.height.length)) : N;
    if (!s.terrain || M === N || M > N) return;
    const off = (N - M) >> 1;
    const r = (k: number) => (((k / M) | 0) + off) * N + (k % M) + off;
    const height = Array.from(this.map.height), water = Array.from(this.map.water);
    // keep the new outer land, but no water or mountains right at the seam
    for (let z = 0; z < M; z++) for (let x = 0; x < M; x++) { const k = r(z * M + x); height[k] = s.terrain.height[z * M + x]; water[k] = s.terrain.water[z * M + x]; }
    s.terrain = { height, water };
    const list = (a?: number[]) => (a ? a.map(r) : a);
    for (let i = 0; i + 2 < s.roads.length; i += 3) s.roads[i] = r(s.roads[i]);
    s.roundabouts = list(s.roundabouts);
    s.footpaths = list(s.footpaths);
    s.canals = list(s.canals);
    s.rails = list(s.rails);
    s.pipes = list(s.pipes);
    s.lit = list(s.lit);
    s.cleared = list(s.cleared) ?? [];
    s.stumps = s.stumps?.map(([k, d]) => [r(k), d] as [number, number]);
    for (const b of s.buildings) { b.x += off; b.z += off; }
    for (const p of s.leisure?.petitions ?? []) { p.x += off; p.z += off; }
  }

  private loadSave(s: WorldSave) {
    this.migrateMapSize(s);
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
    this.pipes.deserialize(s.pipes);
    this.trade.load(s.trade);
    for (const [id, h] of s.worldHistory ?? []) this.worldHistory.set(id, h);
    for (const [id, d] of s.dealings ?? []) this.dealings.set(id, d);
    for (const [id, h] of s.priceHistory ?? []) this.priceHistory.set(id, h);
    this.roadJobs = (s.roadJobs ?? []).map((j) => ({ tiles: j.tiles.map(([x, z]) => ({ x, z })), done: j.done, lit: j.lit, city: j.city, prog: 0, money: j.money, stone: j.stone }));
    if (this.roadJobs.length) queueMicrotask(() => this.drawRoadSites());
    this.pipes.rebuild();
    this.terrain.clearTiles(s.cleared);
    this.terrain.loadStumps(s.stumps);
    for (const b of s.buildings) {
      // the side it faced when it was placed (turned with R), if a road is still there
      const dir = b.rot === undefined ? 0 : Math.max(0, SIDES.findIndex((sd) => Math.abs(Math.atan2(Math.sin(sd.rot - b.rot!), Math.cos(sd.rot - b.rot!))) < 0.01));
      const nb = this.buildings.place(b.kind, b.x, b.z, { stored: b.stored, animate: false, id: b.id, city: b.city, built: b.built, level: b.level, owner: b.owner, preferredDir: dir });
      if (b.wageF !== undefined) nb.wageF = b.wageF;
      if (b.total) nb.total = b.total;
      if (b.books) nb.books = b.books;
      if (b.sold) nb.sold = b.sold;
      if (b.sales) nb.sales = b.sales;
      if (b.cropT !== undefined) nb.cropT = b.cropT;
      if (b.parent !== undefined) nb.parent = b.parent;
      if (b.cattleCount !== undefined) nb.cattleCount = b.cattleCount;
      if (b.crop && b.crop in CROPS) { nb.cropKind = b.crop as CropKind; nb.cropManual = b.cropManual; if (nb.crop) this.buildings.updateCrop(nb); }
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
    this.pop.day = this.eco.day;
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
      pipes: this.pipes.serialize(),
      trade: this.trade.save(),
      worldHistory: [...this.worldHistory.entries()],
      dealings: [...this.dealings.entries()],
      priceHistory: [...this.priceHistory.entries()],
      roadJobs: this.roadJobs.map((j) => ({ tiles: j.tiles.map((tl) => [tl.x, tl.z] as [number, number]), done: j.done, lit: j.lit, city: j.city, money: j.money, stone: j.stone })),
      terrain: { height: Array.from(this.map.height), water: Array.from(this.map.water) },
      cleared: this.terrain.clearedList(),
      stumps: this.terrain.stumpList(),
      buildings: this.buildings.list.map((b) => ({
        id: b.id, kind: b.kind, city: b.city, x: b.x, z: b.z, cropT: b.cropT,
        stored: Math.round(b.stored + (b.kind === 'quarry' ? b.trucks * QUARRY.truckLoad * 0.5 : 0)),
        graves: b.graves, cattleCount: b.cattleCount, crop: b.cropKind, cropManual: b.cropManual || undefined,
        built: b.built < 1 ? Math.round(b.built * 1000) / 1000 : undefined, parent: b.parent, level: b.level > 1 ? b.level : undefined, owner: b.owner >= 0 ? b.owner : undefined,
        rot: Math.round(b.rot * 1000) / 1000, wageF: b.wageF, total: b.total, books: b.books, sold: b.sold, sales: b.sales ? Math.round(b.sales) : undefined,
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
