import { ToolId } from '../build/BuildTool';
import { IS_TOUCH } from '../config';
import { BUILDINGS, BuildingKind, PIPE_COST, PATH_COST } from '../buildings/BuildingTypes';
import { ROAD_COST, ROUNDABOUT_COST } from '../roads/RoadNetwork';
import { el, icon, IconName } from './dom';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';
import { VERSION } from '../version';

type Category = 'roads' | 'buildings' | 'services' | 'business' | 'production' | 'decor';

export interface ToolItem {
  tool: ToolId;
  cat: Category;
  name: string;
  desc: string;
  money: number;
  stone: number;
  wood: number;
  iron?: number;
  perTile?: boolean;
  tag: string;
  icon: IconName;
}

const b = (tool: BuildingKind & ToolId, cat: Category, tag: string, desc: string, ic: IconName): ToolItem => {
  const d = BUILDINGS[tool];
  return { tool, cat, name: d.name, desc, money: d.money, stone: d.stone, wood: d.wood, iron: d.iron, tag, icon: ic };
};

export const ITEMS: ToolItem[] = [
  { tool: 'road', cat: 'roads', name: 'Road', desc: 'Two-lane road with sidewalks, no street lamps. Over water it becomes a bridge.', ...ROAD_COST[2], wood: 0, perTile: true, tag: 'Cars, power, water', icon: 'road' },
  { tool: 'litroad', cat: 'roads', name: 'Lit Street', desc: 'Road with street lamps that shine at night. Lamps use a little electricity. Drag over an existing road to add lamps.', money: ROAD_COST[2].money + 10, stone: ROAD_COST[2].stone, wood: 0, perTile: true, tag: 'Lamps at night', icon: 'energy' },
  { tool: 'roundabout', cat: 'roads', name: 'Roundabout', desc: 'Place it on a junction — roads connect to the middle of each side.', ...ROUNDABOUT_COST, wood: 0, tag: '3×3 · no lights', icon: 'roundabout' },
  { tool: 'rail', cat: 'roads', name: 'Railway', desc: 'Lay tracks between two Train Stations: a train then carries goods and passengers between the cities.', money: 14, stone: 0, wood: 0, iron: 1, perTile: true, tag: 'Trains', icon: 'rail' },
  { tool: 'path', cat: 'roads', name: 'Footpath', desc: 'Paved walking path. People walk and cycle faster on paths than on grass; a path to a neighbour town lets people come to work on foot or by bike.', money: PATH_COST, stone: 0, wood: 0, perTile: true, tag: 'Pedestrians and bikes', icon: 'path' },
  { tool: 'pipe', cat: 'roads', name: 'Water Pipe', desc: 'Underground pipe. Water runs under roads anyway; pipes bring it to homes and towers that are not on a road.', money: PIPE_COST.money, stone: 0, wood: 0, iron: PIPE_COST.iron, perTile: true, tag: 'Water to homes', icon: 'water' },
  { tool: 'canal', cat: 'roads', name: 'Irrigation Canal', desc: 'Dig from a river or lake to a crop farm — farms need water to grow.', money: 8, stone: 0, wood: 0, perTile: true, tag: 'Water for farms', icon: 'canal' },
  b('apartment', 'buildings', '6 families', 'Five floors, six flats. Families pay rent to the owner — the city or a businessman who built it.', 'office'),
  b('tower15', 'buildings', '15 families', 'Eight floors, fifteen flats. Families pay rent to the owner.', 'office'),
  b('tower30', 'buildings', '30 families', 'Twelve floors, thirty flats — many homes on a small plot. Uses a lot of electricity.', 'office'),
  b('tower50', 'buildings', '50 families (3×3)', 'Sixteen floors and fifty flats: a whole neighbourhood in one tower. Needs iron and lots of power.', 'office'),
  b('house', 'buildings', 'One family', 'Home for one family (up to 10 people). Needs a road.', 'house'),
  b('watertower', 'buildings', 'Water for 160', 'Clean drinking water. Without it people get sick.', 'watertower'),
  b('park', 'buildings', 'Green space', 'A park with a pond and benches. People recover faster in a green town.', 'orchard'),
  b('parking', 'buildings', '8 spaces', 'Commuters park here when their workplace is nearby.', 'parking'),
  b('cemetery', 'buildings', '16 graves', 'Resting place for deceased citizens. Families buy graves. Can be upgraded.', 'cemetery'),
  b('kindergarten', 'services', '24 children', 'Children aged 3–5 play and learn here — a head start for school.', 'heart'),
  b('school', 'services', '40 pupils', 'Children aged 6–17 study here. Educated adults earn 50% more.', 'school'),
  b('university', 'services', '30 students', 'Young adults with a school diploma study for 4 years and become specialists with a degree.', 'school'),
  b('firestation', 'services', 'Firefighters', 'Fire trucks drive to burning buildings nearby and put the fire out.', 'energy'),
  b('busdepot', 'services', 'Public transport', 'People without a car ride the bus on longer trips. Makes the city happier.', 'car'),
  b('busstop', 'services', 'Bus Stop', 'Shelter where passengers board and exit buses.', 'car'),
  b('police', 'services', 'Safety', 'Officers cut down fights, accidents and murders in the city.', 'jobs'),
  b('hospital', 'services', 'Heals people', 'Doctors and nurses treat the sick. Reduces deaths from illness, fights and accidents.', 'heart'),
  b('military', 'services', 'Safety', 'Soldiers keep the whole city safe: much less crime. They drill on the parade ground and march at Navruz.', 'jobs'),
  b('landfill', 'services', 'Garbage', 'Garbage trucks empty the bins of homes nearby. Cheap, but it smells: homes around it suffer from the pollution.', 'bulldoze'),
  b('recycling', 'services', 'Recycling', 'Garbage trucks bring rubbish here; it is sorted and iron is recovered. Clean, but costs more.', 'bulldoze'),
  b('pharmacy', 'services', 'Medicines', 'Sells medicines: the flu spreads less and the sick recover faster.', 'heart'),
  b('sewage', 'services', 'Sanitation', 'Treats the sewage of the town. Without it a bigger town gets dirty water: people fall ill and are unhappy.', 'water'),
  b('weddinghall', 'services', 'Weddings', 'Young couples can only marry and start families if the town has one. Newly-weds drive through town in a decorated car.', 'heart'),
  b('academy', 'services', 'Science & sport', 'Researchers and coaches: children learn 30% faster and the city football team gets stronger.', 'school'),
  b('stadium', 'services', 'Football', 'Every other day the city team plays a match. Fans fill the stands — a win makes the whole city happier.', 'ball'),
  b('bakery', 'business', 'Bread', 'Bakes flour from the mill into bread: much more food than raw grain. Vans deliver the bread to the shops.', 'food'),
  b('supermarket', 'business', 'Big shop', 'A big shop that sells bread, cheese and everything else. Counts as a food shop for homes.', 'food'),
  b('kiosk', 'business', 'Coffee', 'A coffee and ice-cream cart. People stop by on their walks.', 'food'),
  b('cinema', 'business', 'Films at night', 'An open-air cinema: in the evening people sit on benches and watch a film on the big screen.', 'film'),
  b('grocery', 'business', 'Food shop', 'Families buy their everyday food here. A family may buy the shop or build one with its savings.', 'food'),
  b('clothes', 'business', 'Clothes', 'Clothes and shoes: families spend a little every day — 80% more when the factory supplies clothes. Can be owned by a family.', 'people'),
  b('hotel', 'business', 'Tourism', 'Tourists come for nature, lakes, parks and happy towns. They pay for rooms and shop in town.', 'buildings'),
  b('market', 'business', 'Shopping', 'Bazaar: families spend money on food, clothes and goods. The town takes 20% business tax.', 'food'),
  b('carmarket', 'business', 'Sells cars', 'Families buy their cars here once they have saved enough.', 'car'),
  b('bank', 'business', 'Finance', 'Pays business tax to the town and employs skilled people.', 'coin'),
  b('gasstation', 'business', 'Fuel', 'Sells fuel to the town\'s drivers and pays business tax.', 'energy'),
  b('office', 'business', '24 jobs', 'Workplace with parking spaces in front.', 'office'),
  b('construction', 'business', 'Builders', 'Builders work here: they walk to every construction site and build it. Without a construction company nothing can be built (it can build itself and a Town Hall slowly).', 'quarry'),
  b('warehouse', 'production', '+2000 storage', 'Keeps the town\'s goods: every warehouse stores 2,000 more of each good (2,500 food). Without room, new harvests and goods spoil.', 'production'),
  b('dairy', 'production', 'Milk → cheese', 'Ranches send milk in a tanker; the dairy makes cheese and ice cream for the shops (1.5 food per milk).', 'cow'),
  b('brickworks', 'production', 'Stone → bricks', 'Fires stone into bricks. Trucks bring bricks to construction sites, which go up faster.', 'quarry'),
  b('steelmill', 'production', 'Iron → steel', 'Melts iron into steel beams for big construction sites.', 'iron'),
  b('coalmine', 'production', 'Coal', 'Must touch mountains. Miners dig coal for the coal power plant.', 'quarry'),
  b('coalplant', 'production', '+160 energy/day', 'Burns coal: a lot of steady power, but heavy smoke.', 'powerplant'),
  b('hydro', 'production', '+90 clean energy', 'Built on a river or lake bank: steady clean power day and night.', 'water'),
  b('mill', 'production', 'Grain → flour', 'Farms grow grain; tractors bring it here and the windmill grinds it into flour for the bakery.', 'farm'),
  b('sawmill', 'production', 'Wood → planks', 'Saws wood into planks. Trucks bring planks to construction sites (40% faster); the factory makes furniture from them.', 'woodcutter'),
  b('battery', 'production', 'Stores power', 'Stores spare electricity (e.g. from solar panels by day) and gives it back at night.', 'energy'),
  b('windturbine', 'production', '+30 clean energy', 'Clean power from the wind — no wood, no smoke.', 'energy'),
  b('solarfarm', 'production', '+45 clean energy', 'Solar panels — clean power during the day.', 'energy'),
  b('airport', 'production', 'Flights', 'Planes fly in from the other towns on the map: visitors arrive, and the plane carries goods between the towns at their own prices.', 'globe'),
  b('trainstation', 'production', 'Railway', 'Connect two stations with a railway: trains share goods between cities and bring visitors.', 'rail'),
  b('factory', 'production', 'Clothes and furniture', 'Sews clothes from cotton for the clothing stores and makes furniture from planks for the markets. Many jobs, a big business tax payer. Needs lots of power.', 'production'),
  b('bikefactory', 'production', 'Bicycles', 'Makes bicycles from iron and sells them to families who cannot afford a car ($60). Cyclists ride twice as fast as walkers. When a family buys a car, the factory takes the old bike back for $20.', 'car'),
  b('carfactory', 'production', 'Cars', 'Assembles cars: the best-paying workplace and the largest business tax payer.', 'car'),
  b('ironmine', 'production', 'Iron', 'Must touch mountains. Miners dig iron ore — factories, hospitals and big buildings need iron.', 'iron'),
  b('fishery', 'production', '+25 food/day', 'On the shore of a river or lake. Fishermen catch fish all year (less in winter).', 'food'),
  b('woodcutter', 'production', '3 jobs · wood', 'Near a forest. Workers fell trees bit by bit and carry logs to the power plant.', 'woodcutter'),

  b('powerplant', 'production', '+90 energy/day', 'Burns wood. Power reaches only buildings connected to it by road.', 'powerplant'),
  b('farm', 'production', '+90 food/day', 'Crop field (3×3). Needs water from a canal or rain. Grows March–October.', 'farm'),
  b('orchard', 'production', '+30 food/day', 'Fruit trees — best harvest in summer and autumn.', 'orchard'),
  b('ranch', 'production', '+35 food/day', 'Fenced pasture with cattle (3×3). Produces all year.', 'ranch'),
  b('bigpark', 'buildings', 'Big green space', 'A 3×3 park with a pond, a pavilion and many trees: heals people, makes homes far around happier.', 'orchard'),
  b('mosque', 'services', 'Faith', 'Believers come to pray five times a day and on Fridays. The imam and the muezzin work here. Lifts the mood of the whole town.', 'heart'),
  b('gym', 'business', 'Health', 'Fitness club: people who train fall ill less often and stay healthy longer.', 'heart'),
  b('teahouse', 'business', 'Choyxona', 'A national teahouse: cooks and waiters serve tea and plov. In the evening people gather here. Earns much more than a coffee cart.', 'food'),
  b('barber', 'business', 'Haircut', 'A cheap haircut that cheers people up right away.', 'people'),
  b('concerthall', 'services', '120 seats', 'Music in the evening (a small ticket). Touring stars only come to a town with a concert hall: then tourists and residents fill the seats and the tickets pay.', 'heart'),
  b('casino', 'business', 'Big tax', 'Adults try their luck in the evening. The town takes 40% tax on the stakes. Rich families may build one too.', 'coin'),
  b('themepark', 'business', 'Rides (4×4)', 'Ferris wheel, carousel and a roller coaster. Families and children come at weekends and after school.', 'ball'),
  b('playground', 'decor', 'Children play', 'Swings, a slide and a sandbox. After school children come here to play.', 'heart'),
  b('fountain', 'decor', 'Beauty +', 'A splashing fountain. Decorations make nearby homes happier.', 'water'),
  b('flowerbed', 'decor', 'Beauty +', 'A colourful flower bed.', 'flower'),
  b('sapling', 'decor', 'Plant a tree', 'Plant a plane tree or a fir wherever you like.', 'orchard'),
  b('bench', 'decor', 'Rest', 'Benches and a litter bin for a quiet rest.', 'flower'),
  b('lamppost', 'decor', 'Light', 'A decorative lamp that glows at night.', 'energy'),
  b('statue', 'decor', 'Monument', 'A bronze monument on a stone pedestal.', 'trophy'),
  b('roadsign', 'decor', 'Signs', 'Road signs with a little flower box.', 'roads'),
  b('quarry', 'production', '8 jobs · stone', 'Must touch mountains. Trucks bring stone to the Town Hall; with no road, miners carry it on foot.', 'quarry'),
];

export const CATS: { id: Category; label: string; icon: IconName }[] = [
  { id: 'roads', label: 'Roads', icon: 'roads' },
  { id: 'buildings', label: 'Town', icon: 'buildings' },
  { id: 'services', label: 'Services', icon: 'heart' },
  { id: 'business', label: 'Business', icon: 'coin' },
  { id: 'production', label: 'Production', icon: 'production' },
  { id: 'decor', label: 'Decor', icon: 'flower' },
];

const CAT_DESC: Record<Category, string> = {
  roads: 'Roads, paths and canals connect everything.',
  buildings: 'Housing and the basics of a town.',
  services: 'Schools, hospitals and the institutions people need.',
  business: 'Shops and companies earn money and pay business tax.',
  production: 'Food, wood, energy, stone and industry.',
  decor: 'Fountains, flowers, trees, benches and monuments make homes nearby happier.',
};

const BASE_HINTS: Partial<Record<ToolId, string>> = {
  pan: IS_TOUCH ? 'Drag to move · Pinch to zoom · Tap a person or building' : 'Drag to move · Scroll to zoom · Q/E rotate · Click a person or building',
  bulldoze: 'Drag over roads, paths, canals and buildings to remove them (50% refund)',
};

export interface HudStats {
  money: number; iron: number; daily: number; stone: number; wood: number; food: number; foodDaily: number;
  powered: number; water: number; population: number; workers: number; workforce: number;
  /** Families living in town, and how many families all its homes can take. */
  households: number; homeUnits: number;
  dateText: string; seasonIcon: string; timeOfDay: number; broke: boolean;
  cityName: string; cities: number; happiness: number;
}

export interface HudHandlers {
  setTool: (t: ToolId) => void;
  undo: () => void;
  rotate: (dir: number) => void;
  setSpeed: (s: number) => void;
  openMenu: () => void;
  openStats: () => void;
  openGoals: () => void;
  openLog: () => void;
  openGuide: () => void;
  openPetitions: () => void;
  openNews: () => void;
  openDrive: () => void;
  openPhoto: () => void;
  openTrade: () => void;
  openWorld: () => void;
  /** Fly to your own town. */
  goHome: () => void;
  setLayer: (l: 'power' | 'water' | 'happy') => void;
  /** Details of one readout: where it comes from and where it goes. */
  openResource: (key: string) => void;
  toggleSound: () => boolean;
  cycleCity: () => void;
  confirmBuild: () => void;
  cancelBuild: () => void;
  rotateBuild?: () => void;
}

export const SPEEDS = [0, 1, 3, 10, 50];
/** Readouts hidden behind the fold on narrow screens. */
const SECONDARY = new Set(['stone', 'wood', 'iron', 'food', 'energy', 'water', 'jobs']);

export class Hud {

  readonly root: HTMLDivElement;
  private tool: ToolId = 'pan';
  private speedBtns: HTMLButtonElement[] = [];
  private undoBtn: HTMLButtonElement;
  private moveBtn: HTMLButtonElement;
  private removeBtn: HTMLButtonElement;
  private catBtns = new Map<Category, HTMLButtonElement>();
  private cards = new Map<ToolId, HTMLButtonElement>();
  private drawer: HTMLDivElement;
  private drawerCat: Category | null = null;
  /** How many of a building the current city has (shown on the cards). */
  countOf: (tool: ToolId) => number = () => 0;
  private searchText = '';
  private hint: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private stat: Record<string, HTMLSpanElement> = {};
  private chip: Record<string, HTMLButtonElement> = {};
  private dayBar = el('div', 'daybar');
  private toastTimer = 0;
  private lastMoney = 0;
  private lastStone = 0;
  private lastWood = 0;
  private lastIron = 0;
  private modal?: HTMLDivElement;
  private pendingEl: HTMLDivElement;
  private pendingText: HTMLSpanElement;
  private rotBtn: HTMLButtonElement;
  private descEl?: HTMLDivElement;

  private layerBtns = new Map<string, HTMLButtonElement>();

  /** Highlight the active map layer button. */
  setLayer(l: string) { this.layerBtns.forEach((b, k) => b.classList.toggle('active', k === l)); }

  constructor(parent: HTMLElement, private h: HudHandlers, private thumbs: Map<string, string>) {
    this.root = el('div', 'hud');
    // map layers: one tap shows electricity, water or happiness over the whole town
    const layers = el('div', 'layerbar');
    for (const [k, ic, label] of [['power', 'energy', 'Electricity map'], ['water', 'water', 'Water map'], ['happy', 'heart', 'Happiness map']] as const) {
      const b = el('button', 'layer-btn');
      b.innerHTML = icon(ic);
      b.title = t(label);
      b.setAttribute('aria-label', t(label));
      b.addEventListener('click', () => h.setLayer(k));
      this.layerBtns.set(k, b);
      layers.appendChild(b);
    }
    this.root.appendChild(layers);

    const top = el('div', 'topbar');
    const soundBtn = this.iconButton(sound.sfxOn ? 'sound' : 'mute', t('Sound'), () => { soundBtn.innerHTML = icon(h.toggleSound() ? 'sound' : 'mute'); });
    // one compact navigation block; on small screens the less used panels move into a "more" menu
    const nav = el('div', 'navgroup');
    const more = el('div', 'navmenu');
    const panels: [IconName, string, () => void, boolean][] = [
      // always visible: statistics and letters; everything else lives in the "more" menu
      // statistics live in the town hall window now; the newspaper waits behind its own button with a counter
      ['news', 'Newspaper', h.openNews, false], ['mail', 'Letters', h.openPetitions, false], ['stats', 'Statistics', h.openStats, true],
      ['globe', 'Trade', h.openTrade, true], ['buildings', 'World: all towns', h.openWorld, true], ['trophy', 'Goals', h.openGoals, true],
      ['list', 'Chronicle', h.openLog, true], ['car', 'Drive a car', h.openDrive, true], ['camera', 'Photo mode', h.openPhoto, true], ['book', 'Guide', h.openGuide, true],
    ];
    nav.appendChild(this.iconButton('menu', t('Menu'), h.openMenu));
    for (const [ic, label, fn, secondary] of panels) {
      const b = this.iconButton(ic, t(label), fn);
      this.navBtn.set(ic, b);
      if (secondary) b.classList.add('nav-sec');
      nav.appendChild(b);
      if (secondary) {
        const item = el('button', 'navmenu-item');
        item.innerHTML = `${icon(ic)}<span>${t(label)}</span>`;
        item.addEventListener('click', () => { more.classList.remove('show'); fn(); });
        more.appendChild(item);
      }
    }
    soundBtn.classList.add('nav-snd');
    const moreBtn = this.iconButton('dots', t('More'), () => more.classList.toggle('show'));
    moreBtn.classList.add('nav-more');
    nav.append(soundBtn, moreBtn);
    const sndItem = el('button', 'navmenu-item');
    sndItem.innerHTML = `${icon('sound')}<span>${t('Sound')}</span>`;
    sndItem.addEventListener('click', () => { soundBtn.click(); });
    more.appendChild(sndItem);
    nav.appendChild(more);
    document.addEventListener('pointerdown', (e) => { if (!nav.contains(e.target as Node)) more.classList.remove('show'); }, true);
    top.append(nav);
    const chips = el('div', 'chips');
    // grouped, colour-coded resource readouts: city · materials · utilities · people · time
    const GROUPS: [string, IconName, string][][] = [
      [['city', 'buildings', 'City you are building for (click to switch)']],
      [['money', 'r_money', 'Town money (balance per day)'], ['stone', 'r_stone', 'Stone'], ['wood', 'r_wood', 'Wood (building material and fuel)'],
        ['iron', 'r_iron', 'Iron (for industry and big buildings)'], ['food', 'r_food', 'Food (everyone eats 1 per day)'], ['allres', 'list', 'All resources and the stores']],
      [['energy', 'r_energy', 'Energy supplied'], ['water', 'r_water', 'Drinking water supplied']],
      [['pop', 'r_people', 'Population'], ['homes', 'house', 'Households / families the homes can take'], ['happy', 'r_happy', 'Happiness'], ['jobs', 'r_jobs', 'Employed / workforce']],
      [['day', 'calendar', 'Date and time']],
    ];
    for (const group of GROUPS) {
    const box = el('div', 'chip-group');
    chips.appendChild(box);
    for (const [key, ic, title] of group) {
      const chip = el('button', 'chip');
      chip.dataset.k = key;
      chip.title = t(title);
      chip.innerHTML = icon(ic);
      chip.addEventListener('click', key === 'city' ? h.cycleCity : key === 'day' ? h.openStats : () => h.openResource(key === 'homes' ? 'pop' : key));
      if (key === 'city') chip.classList.add('city');
      if (SECONDARY.has(key)) chip.classList.add('sec');
      const v = el('span', 'v');
      chip.appendChild(v);
      this.stat[key] = v;
      this.chip[key] = chip;
      if (key === 'day') chip.appendChild(this.dayBar);
      box.appendChild(chip);
    }
    }
    // on narrow screens the secondary readouts fold away behind this toggle
    const fold = el('button', 'chip chip-fold');
    fold.innerHTML = icon('dots');
    fold.title = t('More');
    fold.addEventListener('click', () => chips.classList.toggle('open'));
    chips.appendChild(fold);
    top.appendChild(chips);

    const corner = el('div', 'corner');
    const speeds = el('div', 'speeds');
    SPEEDS.forEach((s) => {
      const btn = el('button', 'sbtn');
      btn.innerHTML = s === 0 ? icon('pause') : `${s}×`;
      btn.setAttribute('aria-label', s === 0 ? t('Pause') : t('Speed {n}', { n: s }));
      btn.addEventListener('click', () => h.setSpeed(s));
      this.speedBtns.push(btn);
      speeds.appendChild(btn);
    });
    const rot = el('div', 'speeds');
    for (const dir of [1, -1]) {
      const btn = el('button', 'sbtn');
      btn.innerHTML = icon(dir > 0 ? 'rotL' : 'rotR');
      btn.setAttribute('aria-label', dir > 0 ? t('Rotate left') : t('Rotate right'));
      btn.addEventListener('click', () => h.rotate(dir));
      rot.appendChild(btn);
    }
    const ver = el('div', 'ver');
    ver.textContent = `v${VERSION}`;
    // phones: one pause button and one button that steps through the speeds, plus undo
    const mob = el('div', 'mobile-speed');
    this.playBtn = el('button', 'sbtn');
    this.playBtn.addEventListener('click', () => h.setSpeed(this.speed === 0 ? (this.lastSpeed || 1) : 0));
    this.stepBtn = el('button', 'sbtn step');
    this.stepBtn.addEventListener('click', () => {
      const run = SPEEDS.filter((s) => s > 0);
      h.setSpeed(run[(run.indexOf(this.speed) + 1) % run.length] ?? 1);
    });
    const mUndo = el('button', 'sbtn');
    mUndo.innerHTML = icon('undo');
    mUndo.setAttribute('aria-label', t('Undo'));
    mUndo.addEventListener('click', h.undo);
    // find my town: the camera flies back to your town hall
    const home = (cls: string) => {
      const b = el('button', cls);
      b.innerHTML = icon('home');
      b.title = t('My town (H)');
      b.setAttribute('aria-label', t('My town'));
      b.addEventListener('click', h.goHome);
      return b;
    };
    rot.appendChild(home('sbtn home-btn'));
    mob.append(this.playBtn, this.stepBtn, home('sbtn home-btn'), mUndo);
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !(e.target instanceof HTMLInputElement) && !e.ctrlKey && !e.metaKey) h.goHome(); });
    corner.append(speeds, mob, rot, ver);

    this.drawer = el('div', 'drawer');

    const bar = el('div', 'toolbar');
    this.moveBtn = this.toolButton('pan', t('Move'));
    this.moveBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('pan'); });
    bar.append(this.moveBtn, el('div', 'sep'));
    for (const c of CATS) {
      const btn = this.toolButton(c.icon, t(c.label));
      btn.classList.add('cat');
      btn.addEventListener('click', () => this.toggleDrawer(c.id));
      this.catBtns.set(c.id, btn);
      bar.appendChild(btn);
    }
    bar.appendChild(el('div', 'sep'));
    this.removeBtn = this.toolButton('bulldoze', t('Remove'));
    this.removeBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('bulldoze'); });
    this.undoBtn = this.toolButton('undo', t('Undo'));
    this.undoBtn.classList.add('undo');
    this.undoBtn.addEventListener('click', h.undo);
    bar.append(this.removeBtn, this.undoBtn);

    this.hint = el('div', 'hint');
    this.toastEl = el('div', 'toast');

    this.pendingEl = el('div', 'pending');
    this.pendingText = el('span', 'ptext');
    this.rotBtn = el('button', 'pbtn rot');
    this.rotBtn.innerHTML = icon('rotR') + `<span>${t('Rotate')} (R)</span>`;
    this.rotBtn.setAttribute('title', t('Rotate building (R)'));
    this.rotBtn.addEventListener('click', () => h.rotateBuild?.());
    const okBtn = el('button', 'pbtn ok');
    okBtn.innerHTML = icon('check') + `<span>${t('Build')}</span>`;
    okBtn.addEventListener('click', h.confirmBuild);
    const noBtn = el('button', 'pbtn no');
    noBtn.innerHTML = icon('close') + `<span>${t('Cancel')}</span>`;
    noBtn.addEventListener('click', h.cancelBuild);
    this.pendingEl.append(this.pendingText, this.rotBtn, okBtn, noBtn);

    this.root.append(top, corner, this.hint, this.toastEl, this.pendingEl, this.drawer, bar);
    parent.appendChild(this.root);
  }

  private navBtn = new Map<IconName, HTMLButtonElement>();

  /** A small counter on a top-bar button (e.g. unanswered letters). */
  setBadge(name: IconName, n: number) {
    const b = this.navBtn.get(name);
    if (!b) return;
    let badge = b.querySelector('.nav-badge') as HTMLSpanElement | null;
    if (n <= 0) { badge?.remove(); return; }
    if (!badge) { badge = el('span', 'nav-badge'); b.appendChild(badge); }
    const text = n > 9 ? '9+' : `${n}`;
    if (badge.textContent !== text) badge.textContent = text;
  }

  private moneyIn = 0;
  private moneyOut = 0;
  private moneyT = 0;

  /** Money arrived or left the treasury just now: shown as a small rising "+$12" next to the money readout. */
  flashMoney(amount: number) {
    if (amount > 0) this.moneyIn += amount; else this.moneyOut -= amount;
    if (this.moneyT) return;
    this.moneyT = window.setTimeout(() => {
      this.moneyT = 0;
      const chip = this.chip.money;
      if (!chip?.isConnected) { this.moneyIn = this.moneyOut = 0; return; }
      const r = chip.getBoundingClientRect(), host = this.root.getBoundingClientRect();
      const show = (v: number, cls: string, dy: number) => {
        if (Math.round(v) < 1) return;
        const p = el('div', `money-pop ${cls}`);
        p.textContent = `${cls === 'pos' ? '+' : '−'}$${Math.round(v).toLocaleString('en-US')}`;
        p.style.left = `${r.left - host.left + r.width / 2}px`;
        p.style.top = `${r.bottom - host.top + 4 + dy}px`;
        this.root.appendChild(p);
        setTimeout(() => p.remove(), 1300);
      };
      show(this.moneyIn, 'pos', 0);
      show(this.moneyOut, 'neg', 16);
      this.moneyIn = this.moneyOut = 0;
    }, 700);
  }

  private iconButton(name: IconName, label: string, onClick: () => void) {
    const btn = el('button', 'rbtn');
    btn.innerHTML = icon(name);
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private toolButton(name: IconName, label: string) {
    const btn = el('button', 'tbtn');
    btn.innerHTML = icon(name) + `<span>${label}</span>`;
    return btn;
  }

  private toggleDrawer(cat: Category) {
    if (this.drawerCat === cat) return this.closeDrawer();
    this.drawerCat = cat;
    this.drawer.replaceChildren();
    const info = CATS.find((c) => c.id === cat)!;
    const title = el('div', 'drawer-title');
    title.innerHTML = icon(info.icon) + `<span>${t(info.label)}</span>`;
    // search over every building, in any category
    const search = el('input', 'drawer-search') as HTMLInputElement;
    search.type = 'search';
    search.placeholder = t('Search buildings…');
    search.value = this.searchText;
    title.appendChild(search);
    const row = el('div', 'cards');
    this.descEl = el('div', 'drawer-desc');
    this.descEl.textContent = t(CAT_DESC[cat]);
    const fill = () => {
      const q = this.searchText.trim().toLowerCase();
      row.replaceChildren();
      this.cards.clear();
      const list = q ? ITEMS.filter((i) => `${t(i.name)} ${t(i.tag)} ${i.name} ${t(i.desc)}`.toLowerCase().includes(q)) : ITEMS.filter((i) => i.cat === cat);
      for (const it of list) row.appendChild(this.card(it));
      if (!list.length) { const e = el('div', 'drawer-empty'); e.textContent = t('Nothing found'); row.appendChild(e); }
      this.refreshCards();
    };
    search.addEventListener('input', () => { this.searchText = search.value; fill(); });
    search.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.closeDrawer(); });
    fill();
    this.drawer.append(title, row, this.descEl);
    if (!IS_TOUCH) setTimeout(() => search.focus({ preventScroll: true }), 30);
    this.drawer.classList.add('show');
    this.catBtns.forEach((btn, c) => btn.classList.toggle('open', c === cat));
    this.refreshCards();
  }

  private closeDrawer() {
    this.drawerCat = null;
    this.drawer.classList.remove('show');
    this.catBtns.forEach((btn) => btn.classList.remove('open'));
  }

  private card(it: ToolItem) {
    const btn = el('button', 'card');
    const img = el('div', 'card-img');
    const thumb = this.thumbs.get(it.tool);
    if (thumb) img.style.backgroundImage = `url(${thumb})`;
    else img.innerHTML = icon(it.icon);
    const name = el('b', '');
    name.textContent = t(it.name);
    const tag = el('small', 'tag');
    tag.textContent = t(it.tag);
    const cost = el('div', 'cost');
    const parts = [];
    if (it.money) parts.push(`<span>${icon('coin')}${it.money}</span>`);
    if (it.stone) parts.push(`<span>${icon('stone')}${it.stone}</span>`);
    if (it.wood) parts.push(`<span>${icon('wood')}${it.wood}</span>`);
    if (it.iron) parts.push(`<span>${icon('iron')}${it.iron}</span>`);
    cost.innerHTML = parts.length ? parts.join('') + (it.perTile ? `<i>/${t('tile')}</i>` : '') : `<span>${t('Free')}</span>`;
    btn.title = t(it.desc);
    const showDesc = () => { if (this.descEl) this.descEl.textContent = t(it.desc); };
    btn.addEventListener('mouseenter', showDesc);
    btn.addEventListener('focus', showDesc);
    const count = el('span', 'card-count');
    btn.append(img, name, tag, cost, count);
    btn.addEventListener('click', () => {
      this.h.setTool(it.tool);
      this.closeDrawer();
    });
    this.cards.set(it.tool, btn);
    return btn;
  }

  private refreshCards() {
    for (const it of ITEMS) {
      const c = this.cards.get(it.tool);
      if (!c) continue;
      c.classList.toggle('poor', this.lastMoney < it.money || this.lastStone < it.stone || this.lastWood < it.wood || this.lastIron < (it.iron ?? 0));
      c.classList.toggle('active', this.tool === it.tool);
      const n = this.countOf(it.tool);
      const badge = c.querySelector('.card-count') as HTMLElement | null;
      if (badge) {
        const text = n > 0 ? `×${n}` : '';
        if (badge.textContent !== text) badge.textContent = text;
        badge.title = t('{n} built in this city', { n });
      }
    }
  }

  setActive(tool: ToolId) {
    this.tool = tool;
    this.closeDrawer();
    this.moveBtn.classList.toggle('active', tool === 'pan');
    this.removeBtn.classList.toggle('active', tool === 'bulldoze');
    const item = ITEMS.find((i) => i.tool === tool);
    this.catBtns.forEach((btn, cat) => {
      const on = item?.cat === cat;
      const c = CATS.find((x) => x.id === cat)!;
      btn.classList.toggle('active', on);
      btn.innerHTML = icon(on ? item!.icon : c.icon) + `<span>${on ? t(item!.name) : t(c.label)}</span>`;
    });
    this.refreshCards();
    this.setHint(null);
  }

  private speed = 1;
  private lastSpeed = 1;
  private playBtn!: HTMLButtonElement;
  private stepBtn!: HTMLButtonElement;

  setSpeed(s: number) {
    this.speedBtns.forEach((btn, i) => btn.classList.toggle('active', SPEEDS[i] === s));
    this.speed = s;
    if (s > 0) this.lastSpeed = s;
    this.playBtn.innerHTML = icon(s === 0 ? 'play' : 'pause');
    this.playBtn.classList.toggle('active', s === 0);
    this.playBtn.setAttribute('aria-label', s === 0 ? t('Play') : t('Pause'));
    this.stepBtn.textContent = `${s === 0 ? this.lastSpeed : s}×`;
    this.stepBtn.setAttribute('aria-label', t('Speed {n}', { n: s }));
  }

  /** Show the confirm / cancel bar for a build that is waiting. */
  setPending(info: { text: string; ok: boolean; canRotate?: boolean } | null) {
    this.pendingEl.classList.toggle('show', !!info);
    this.hint.style.visibility = info ? 'hidden' : '';
    if (info) {
      this.pendingText.textContent = info.text;
      this.rotBtn.style.display = info.canRotate ? '' : 'none';
    }
  }

  setUndoEnabled(on: boolean) {
    this.undoBtn.disabled = !on;
  }

  setHint(text: string | null) {
    const item = ITEMS.find((i) => i.tool === this.tool);
    const base = BASE_HINTS[this.tool] ?? item?.desc ?? '';
    this.hint.textContent = text ?? t(base);
  }

  setStats(s: HudStats) {
    const sign = s.daily >= 0 ? '+' : '';
    this.stat.money.innerHTML = `$${fmt(s.money)} <small class="${s.daily >= 0 ? 'pos' : 'neg'}">${sign}${fmt(s.daily)}</small>`;
    this.stat.city.textContent = `${s.cityName} ▾`;
    this.stat.stone.textContent = fmt(s.stone);
    this.stat.wood.textContent = fmt(s.wood);
    this.stat.iron.textContent = fmt(s.iron);
    this.stat.food.innerHTML = `${fmt(s.food)} <small class="${s.foodDaily >= 0 ? 'pos' : 'neg'}">${s.foodDaily >= 0 ? '+' : ''}${fmt(s.foodDaily)}</small>`;
    this.stat.energy.textContent = `${Math.round(s.powered * 100)}%`;
    this.stat.water.textContent = `${Math.round(s.water * 100)}%`;
    this.chip.money.classList.toggle('warn', s.broke);
    this.chip.energy.classList.toggle('warn', s.powered < 0.8);
    this.chip.water.classList.toggle('warn', s.water < 0.9);
    this.chip.food.classList.toggle('warn', s.food < s.population * 2);
    this.chip.wood.classList.toggle('warn', s.wood < 15);
    this.stat.pop.textContent = fmt(s.population);
    this.stat.homes.textContent = `${fmt(s.households)}/${fmt(s.homeUnits)}`;
    this.chip.homes.classList.toggle('warn', s.households >= s.homeUnits);
    this.stat.happy.textContent = `${Math.round(s.happiness)}%`;
    this.chip.happy.classList.toggle('warn', s.happiness < 45);
    this.stat.jobs.textContent = `${s.workers}/${s.workforce}`;
    const mins = Math.floor(s.timeOfDay * 24 * 60);
    this.stat.day.textContent = `${s.seasonIcon} ${s.dateText} · ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.dayBar.style.width = `${Math.round(s.timeOfDay * 100)}%`;
    this.lastMoney = s.money;
    this.lastStone = s.stone;
    this.lastWood = s.wood;
    this.lastIron = s.iron;
    if (this.drawerCat) this.refreshCards();
  }

  /** A card with everything about a building: what it does, what it costs and needs, its numbers. */
  info(title: string, subtitle: string, text: string, sections: { title: string; rows: [string, string][] }[]) {
    this.root.querySelector('.confirm-back')?.remove();
    const back = el('div', 'confirm-back');
    const box = el('div', 'confirm info-card');
    const head = el('div', 'info-head');
    const h = el('b', '');
    h.textContent = title;
    const sub = el('small', '');
    sub.textContent = subtitle;
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    const titles = el('div', '');
    titles.append(h, sub);
    head.append(titles, x);
    const p = el('p', '');
    p.textContent = text;
    const body = el('div', 'info-body');
    body.appendChild(p);
    for (const sec of sections) {
      if (!sec.rows.length) continue;
      const st = el('div', 'rp-sec');
      st.textContent = sec.title;
      const grid = el('div', 'rp-grid');
      for (const [k, v] of sec.rows) {
        const a = el('span', 'k');
        a.textContent = k;
        const b = el('span', 'v');
        b.textContent = v;
        grid.append(a, b);
      }
      body.append(st, grid);
    }
    const close = () => { back.remove(); window.removeEventListener('keydown', key, true); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    x.addEventListener('click', close);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    window.addEventListener('keydown', key, true);
    box.append(head, body);
    back.appendChild(box);
    this.root.appendChild(back);
  }

  /** Ask before doing something that cannot be undone (demolishing). */
  confirm(title: string, text: string, yesLabel: string, onYes: () => void) {
    this.root.querySelector('.confirm-back')?.remove();
    const back = el('div', 'confirm-back');
    const box = el('div', 'confirm');
    const h = el('b', '');
    h.textContent = title;
    const p = el('p', '');
    p.textContent = text;
    const row = el('div', 'confirm-btns');
    const no = el('button', 'btn-mini ghost');
    no.textContent = t('Cancel');
    const yes = el('button', 'btn-mini danger');
    yes.textContent = yesLabel;
    const close = () => { back.remove(); window.removeEventListener('keydown', key, true); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (e.key === 'Enter') { e.stopPropagation(); close(); onYes(); } };
    no.addEventListener('click', close);
    yes.addEventListener('click', () => { close(); onYes(); });
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    window.addEventListener('keydown', key, true);
    row.append(no, yes);
    box.append(h, p, row);
    back.appendChild(box);
    this.root.appendChild(back);
    yes.focus();
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  /** Full-screen notice (bankruptcy). */
  showModal(title: string, text: string, buttons: { label: string; primary?: boolean; onClick: () => void }[]) {
    this.modal?.remove();
    const m = el('div', 'modal');
    const p = el('div', 'panel');
    const h = el('h1', '');
    h.textContent = title;
    const tx = el('p', '');
    tx.textContent = text;
    p.append(h, tx);
    for (const b of buttons) {
      const btn = el('button', `mbtn${b.primary ? ' primary' : ''}`);
      btn.textContent = b.label;
      btn.addEventListener('click', () => { m.remove(); this.modal = undefined; b.onClick(); });
      p.appendChild(btn);
    }
    m.appendChild(p);
    this.root.appendChild(m);
    this.modal = m;
  }

  dispose() {
    clearTimeout(this.toastTimer);
    this.root.remove();
  }
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
