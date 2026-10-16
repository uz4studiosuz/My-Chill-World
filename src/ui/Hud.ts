import { ToolId } from '../build/BuildTool';
import { IS_TOUCH } from '../config';
import { BUILDINGS, BuildingKind, PIPE_COST, CABLE_COST, PATH_COST, TUNNEL_COST, extraCost } from '../buildings/BuildingTypes';
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
  bricks?: number;
  steel?: number;
  perTile?: boolean;
  tag: string;
  icon: IconName;
}

const b = (tool: BuildingKind & ToolId, cat: Category, tag: string, desc: string, ic: IconName): ToolItem => {
  const d = BUILDINGS[tool];
  const ex = extraCost(tool);
  return { tool, cat, name: d.name, desc, money: d.money, stone: d.stone, wood: d.wood, iron: d.iron, bricks: ex.bricks, steel: ex.steel, tag, icon: ic };
};

export const ITEMS: ToolItem[] = [
  { tool: 'tunnel', cat: 'roads', name: 'Tunnel', desc: 'Bores a passage through a mountain (no road yet): draw it across the rock, the builders dig it tile by tile. Then lay a road, a lit street or a railway through it.', money: TUNNEL_COST.money, stone: TUNNEL_COST.stone, wood: 0, perTile: true, tag: 'Through mountains', icon: 'roads' },
  { tool: 'road', cat: 'roads', name: 'Road', desc: 'Two-lane road with sidewalks, no street lamps. Over water it becomes a bridge; through a mountain it needs a tunnel first. Builders lay it tile by tile.', ...ROAD_COST[2], wood: 0, perTile: true, tag: 'Cars, power, water', icon: 'road' },
  { tool: 'litroad', cat: 'roads', name: 'Lit Street', desc: 'Road with street lamps that shine at night. Lamps use a little electricity. Drag over an existing road to add lamps.', money: ROAD_COST[2].money + 10, stone: ROAD_COST[2].stone, wood: 0, perTile: true, tag: 'Lamps at night', icon: 'energy' },
  { tool: 'roundabout', cat: 'roads', name: 'Roundabout', desc: 'Place it on a junction — roads connect to the middle of each side.', ...ROUNDABOUT_COST, wood: 0, tag: '3×3 · no lights', icon: 'roundabout' },
  { tool: 'rail', cat: 'roads', name: 'Railway', desc: 'Lay tracks between two Train Stations: a train then carries goods and passengers between the cities.', money: 14, stone: 0, wood: 0, iron: 1, perTile: true, tag: 'Trains', icon: 'rail' },
  { tool: 'path', cat: 'roads', name: 'Footpath', desc: 'Paved walking path. People walk and cycle faster on paths than on grass; a path to a neighbour town lets people come to work on foot or by bike.', money: PATH_COST, stone: 0, wood: 0, perTile: true, tag: 'Pedestrians and bikes', icon: 'path' },
  { tool: 'path_stone', cat: 'roads', name: 'Stone Path', desc: 'A grey cobbled path: smart for squares, parks and the old town. People walk and cycle on it like on any path.', money: PATH_COST, stone: 1, wood: 0, perTile: true, tag: 'Squares and old town', icon: 'path' },
  { tool: 'path_brick', cat: 'roads', name: 'Brick Walkway', desc: 'A red brick walkway with light edging: warm and tidy between shops and homes.', money: PATH_COST, stone: 1, wood: 0, perTile: true, tag: 'Between shops and homes', icon: 'path' },
  { tool: 'path_gravel', cat: 'roads', name: 'Gravel Path', desc: 'A narrow gravel path for gardens, parks and the countryside. The cheapest path.', money: Math.max(1, Math.round(PATH_COST / 2)), stone: 0, wood: 0, perTile: true, tag: 'Gardens and countryside', icon: 'path' },
  { tool: 'path_wood', cat: 'roads', name: 'Boardwalk', desc: 'A wooden boardwalk of planks: lovely by lakes, rivers and in parks.', money: PATH_COST, stone: 0, wood: 1, perTile: true, tag: 'By lakes and in parks', icon: 'path' },
  { tool: 'pipe', cat: 'roads', name: 'Water Pipe', desc: 'Underground water pipe — the only way water reaches homes. Run it under the water tower and on under every home: a building joins the water only where a pipe passes under it. It may run under roads, bridges and paths.', money: PIPE_COST.money, stone: 0, wood: 0, iron: PIPE_COST.iron, perTile: true, tag: 'Water to homes', icon: 'water' },
  { tool: 'zone_res', cat: 'roads', name: 'Residential Zone', desc: 'Paint land for homes: families build their houses and businessmen their blocks of flats here first. Drag a rectangle. Free.', money: 0, stone: 0, wood: 0, tag: 'Homes here', icon: 'house' },
  { tool: 'zone_com', cat: 'roads', name: 'Commercial Zone', desc: 'Paint land for shops, cafés, offices and hotels: families open their businesses here first. Drag a rectangle. Free.', money: 0, stone: 0, wood: 0, tag: 'Shops here', icon: 'coin' },
  { tool: 'zone_ind', cat: 'roads', name: 'Industrial Zone', desc: 'Paint land for factories and workshops, away from the homes: private factories are built here. Drag a rectangle. Free.', money: 0, stone: 0, wood: 0, tag: 'Factories here', icon: 'production' },
  { tool: 'zone_none', cat: 'roads', name: 'Clear Zone', desc: 'Remove the zoning from an area. Drag a rectangle.', money: 0, stone: 0, wood: 0, tag: 'Unzone', icon: 'bulldoze' },
  { tool: 'cable', cat: 'roads', name: 'Power Cable', desc: 'Electric cable from a power plant to the buildings: a building gets power when a cable runs under it or along the road in front of its door; street lamps need a cable under them. Cheap — lay it along the streets.', money: CABLE_COST.money, stone: 0, wood: 0, iron: CABLE_COST.iron, perTile: true, tag: 'Power to buildings', icon: 'energy' },
  { tool: 'canal', cat: 'roads', name: 'Irrigation Canal', desc: 'Dig from a river or lake to a crop farm — farms need water to grow.', money: 8, stone: 0, wood: 0, perTile: true, tag: 'Water for farms', icon: 'canal' },
  b('apartment', 'buildings', '6 families', 'Five floors, six flats. Families pay rent to the owner — the city or a businessman who built it.', 'office'),
  b('tower15', 'buildings', '15 families', 'Eight floors, fifteen flats. Families pay rent to the owner.', 'office'),
  b('tower30', 'buildings', '30 families', 'Twelve floors, thirty flats — many homes on a small plot. Uses a lot of electricity.', 'office'),
  b('tower50', 'buildings', '50 families (3×3)', 'Sixteen floors and fifty flats: a whole neighbourhood in one tower. Needs iron and lots of power.', 'office'),
  b('house', 'buildings', 'One family', 'Home for one family (up to 10 people). Needs a road.', 'house'),
  b('watertower', 'buildings', 'Water for 160', 'Clean drinking water. Without it people get sick.', 'watertower'),
  b('park', 'buildings', 'Green space', 'A park with a pond and benches. People recover faster in a green town.', 'orchard'),
  b('parking', 'buildings', '8 spaces', 'Commuters park here when their workplace is nearby; cars from full homes nearby park here too.', 'parking'),
  b('garage', 'buildings', '24 cars a level', 'A multi-storey car park: cars of the homes around it (8 tiles) park inside instead of along the street. Takes parking fees. Upgrade for more floors.', 'parking'),
  b('cemetery', 'buildings', '16 graves', 'Resting place for deceased citizens. Families buy graves. Can be upgraded.', 'cemetery'),
  b('kindergarten', 'services', '24 children', 'Children aged 3–5 play and learn here — a head start for school.', 'heart'),
  b('school', 'services', '40 pupils', 'Children aged 6–17 study here. Educated adults earn 50% more.', 'school'),
  b('university', 'services', '30 students', 'Young adults with a school diploma study for 4 years and become specialists with a degree.', 'school'),
  b('firestation', 'services', 'Firefighters', 'Fire trucks drive to burning buildings nearby and put the fire out.', 'energy'),
  b('busdepot', 'services', 'Public transport', 'People without a car ride the bus on longer trips. Makes the city happier.', 'car'),
  b('embassy', 'buildings', 'One per town', 'Diplomatic relations: from here you start joint projects with the neighbour towns (you pay half, they build and staff it, the profit is shared equally) and invest on their land. Only one per town.', 'globe'),
  b('metro', 'services', 'Underground', 'A metro station. Two or more stations of a town are joined underground: people near them leave the car at home, the town takes the fares.', 'rail'),
  b('cctv', 'services', 'Less crime', 'A security camera: crime drops around it (6 tiles), like a little police station.', 'eye'),
  b('levee', 'services', 'Against floods', 'A flood wall by a river or lake: homes within 6 tiles do not flood in heavy rain.', 'water'),
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
  b('dairyshop', 'business', 'Milk and cheese', 'Sells the milk of the ranches as milk, yogurt and cheese: people eat it as food, and the milk in the stores goes down.', 'food'),
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
  b('migration', 'services', 'Newcomers', 'Registers the families who move to town, finds them jobs and homes faster: one more family a day can move in, and they come even when people are a little less happy. Shows who came, from where and what they do.', 'people'),
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
  b('gazebo', 'decor', 'Beauty +1.5', 'A wooden pavilion with a bench: neighbours meet here in the evening. Homes nearby are happier.', 'flower'),
  b('pond', 'decor', 'Beauty +2.5', 'A duck pond with lily pads and reeds. A lovely place that makes the homes around it happier.', 'water'),
  b('clocktower', 'decor', 'Beauty +2', 'A brick clock tower: the pride of the square. Homes nearby are happier.', 'trophy'),
  b('flagpole', 'decor', 'Beauty +0.8', 'A tall flag pole with the town flag.', 'trophy'),
  b('planter', 'decor', 'Beauty +0.7', 'Big flower pots for streets and squares.', 'flower'),
  b('archway', 'decor', 'Beauty +1.5', 'A decorated city gate with a blue tiled arch.', 'trophy'),
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



/** The most needed things first in every tab (a new player finds them at once); the rest keep their order. */
const PRIORITY: Record<string, string[]> = {
  roads: ['road', 'pipe', 'cable', 'litroad', 'path', 'roundabout', 'rail', 'tunnel', 'canal', 'path_stone', 'path_brick', 'path_gravel', 'path_wood', 'zone_res', 'zone_com', 'zone_ind', 'zone_none'],
  buildings: ['house', 'watertower', 'apartment', 'park', 'parking', 'cemetery', 'garage', 'embassy', 'bigpark', 'tower15', 'tower30', 'tower50'],
  services: ['school', 'kindergarten', 'hospital', 'police', 'firestation', 'sewage', 'landfill', 'weddinghall', 'busstop', 'busdepot', 'pharmacy', 'mosque', 'university', 'recycling', 'metro', 'cctv', 'levee', 'academy', 'stadium', 'concerthall', 'migration', 'military'],
  business: ['construction', 'grocery', 'market', 'bakery', 'supermarket', 'clothes', 'dairyshop', 'kiosk', 'gasstation', 'bank', 'office', 'hotel', 'carmarket', 'teahouse', 'barber', 'gym', 'cinema', 'casino', 'themepark'],
  production: ['farm', 'woodcutter', 'quarry', 'powerplant', 'orchard', 'ranch', 'windturbine', 'solarfarm', 'battery', 'fishery', 'warehouse', 'mill', 'sawmill', 'brickworks', 'dairy', 'ironmine', 'factory', 'coalmine', 'coalplant', 'steelmill', 'bikefactory', 'carfactory', 'hydro', 'trainstation', 'airport'],
};
{
  const rank = (it: ToolItem) => { const l = PRIORITY[it.cat]; const i = l ? l.indexOf(it.tool) : -1; return i < 0 ? 999 : i; };
  const pos = new Map(ITEMS.map((it, i) => [it, i]));
  ITEMS.sort((a, b) => (a.cat === b.cat ? rank(a) - rank(b) || pos.get(a)! - pos.get(b)! : pos.get(a)! - pos.get(b)!));
}

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
  /** Jobs nobody fills yet in the town's workplaces. */
  vacancies: number;
  /** Bricks in the stores (homes are built of them). */
  bricks?: number;
  /** Families living in town, and how many families all its homes can take. */
  households: number; homeUnits: number;
  dateText: string; seasonIcon: string; timeOfDay: number; broke: boolean;
  cityName: string; cities: number; happiness: number;
  /** What the town needs next (the side panel lists it). */
  needs?: string[];
  /** People marked as favourites: tap one to follow them. */
  favs?: { id: number; name: string; doing: string }[];
  /** Every other good in the stores (bricks, planks, coal…), for the resources sheet on phones. */
  goods?: [string, string, number][];
  /** The town's level (Village, Town, City, Metropolis) and the people needed for the next one. */
  level?: string;
  nextLevel?: string;
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
  /** The list of every building in your town. */
  openBuildings: () => void;
  /** Fly to your own town. */
  goHome: () => void;
  setLayer: (l: 'power' | 'water' | 'happy' | 'traffic' | 'land' | 'crime') => void;
  /** Details of one readout: where it comes from and where it goes. */
  openResource: (key: string) => void;
  toggleSound: () => boolean;
  cycleCity: () => void;
  confirmBuild: () => void;
  cancelBuild: () => void;
  rotateBuild?: () => void;
  /** Fly to a person and follow them. */
  openPerson?: (id: number) => void;
  /** The production chains as a map. */
  openChains?: () => void;
  /** The embassy window. */
  openEmbassy?: () => void;
  /** Start the tutorial again. */
  openTutorial?: () => void;
  /** The town hall's full report of the active town. */
  openHall?: () => void;
}

export const SPEEDS = [0, 1, 3, 10, 50];

/** What the colours of every map layer mean (shown in a key while the layer is on). */
const LEGENDS: Record<string, { title: string; icon: IconName; items: [string, string][]; tip: string }> = {
  power: { title: 'Electricity map', icon: 'energy', items: [['#58d36b', 'Powered'], ['#f2b33d', 'On the grid, not enough power'], ['#ff5a4e', 'No cable to a power plant'], ['#ffe066', 'Power plants']],
    tip: 'Yellow lines are the power cables. Lay a cable along the street to the red buildings; build another plant for the amber ones.' },
  water: { title: 'Water map', icon: 'water', items: [['#58d36b', 'Clean water'], ['#f2b33d', 'Not enough water'], ['#ff5a4e', 'No water pipe'], ['#4fa3ff', 'Water towers and sewage']],
    tip: 'Blue lines are the pipes. A home gets water only where a pipe runs under it.' },
  happy: { title: 'Happiness map', icon: 'heart', items: [['#58d36b', 'Happy (65%+)'], ['#f2b33d', 'So-so (45–65%)'], ['#ff5a4e', 'Unhappy (below 45%)']],
    tip: 'Tap a home to see why its people feel that way.' },
  traffic: { title: 'Traffic map', icon: 'car', items: [['#58d36b', 'Free flow'], ['#f2b33d', 'Busy'], ['#ff5a4e', 'Jammed']],
    tip: 'Red streets need another road beside them, a roundabout, a bus line, a metro or a car park.' },
  land: { title: 'Land value map', icon: 'coin', items: [['#2f5fcf', 'Very dear (×1.7+)'], ['#4f8fe8', 'Dear (×1.4+)'], ['#8fc0f5', 'Above average'], ['#c9cdd2', 'Ordinary'], ['#c99a6b', 'Cheap'], ['#8a5a35', 'Very cheap (smoke)']],
    tip: 'Every tile around your town: the closer to the town hall the dearer (up to 24 tiles); parks and decorations add within 5 tiles, a river or lake within 3, a metro station within 5; factories and mines lower it within 6. Build homes and shops on blue land, factories on brown. Property tax follows it.' },
  crime: { title: 'Crime map', icon: 'eye', items: [['#58d36b', 'Safe'], ['#f2b33d', 'Some thefts'], ['#ff5a4e', 'Dangerous']],
    tip: 'Police stations (with staff) and security cameras make streets safe; jobs and a good income do too.' },
};
/** Readouts hidden behind the fold on narrow screens. */
const SECONDARY = new Set(['stone', 'wood', 'iron', 'food', 'energy', 'water', 'jobs']);

export class Hud {

  readonly root: HTMLDivElement;
  private tool: ToolId = 'pan';
  private speedBtns: HTMLButtonElement[] = [];
  private spPause!: HTMLButtonElement;
  private spCur!: HTMLButtonElement;
  private spOpts: HTMLButtonElement[] = [];
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
  setLayer(l: string) {
    this.layerBtns.forEach((b, k) => b.classList.toggle('active', k === l));
    this.renderLegend(l);
  }

  private legendEl = el('div', 'map-legend');

  /** The key of the map layer that is on: what each colour means and what to do; it stays until the layer is off. */
  private renderLegend(l: string) {
    const L = LEGENDS[l];
    this.legendEl.classList.toggle('show', !!L);
    if (!L) return;
    this.legendEl.replaceChildren();
    const head = el('div', 'ml-head');
    head.innerHTML = `<span class="ml-ic">${icon(L.icon)}</span><b></b>`;
    (head.querySelector('b') as HTMLElement).textContent = t(L.title);
    const x = el('button', 'ml-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.h.setLayer(l as 'power'));
    head.appendChild(x);
    const list = el('div', 'ml-list');
    for (const [color, label] of L.items) {
      const r = el('div', 'ml-row');
      r.innerHTML = '<i></i><span></span>';
      (r.querySelector('i') as HTMLElement).style.background = color;
      (r.querySelector('span') as HTMLElement).textContent = t(label);
      list.appendChild(r);
    }
    const tip = el('div', 'ml-tip');
    tip.textContent = t(L.tip);
    this.legendEl.append(head, list, tip);
  }

  /** The town side panel (right column on wide screens, a sheet on phones). */
  private side!: HTMLDivElement;
  private sideStats!: HTMLDivElement;
  private sideNeeds!: HTMLDivElement;
  private sideTitle!: HTMLElement;
  private dock!: HTMLDivElement;
  private tabSearch!: HTMLInputElement;
  private needsKey = '';
  private sideFavs!: HTMLDivElement;
  private favKey = '';

  constructor(parent: HTMLElement, private h: HudHandlers, private thumbs: Map<string, string>) {
    this.root = el('div', 'hud');
    document.body.classList.add('ui2');
    // map layers: one tap shows electricity, water or happiness over the whole town
    const layers = el('div', 'layerbar');
    for (const [k, ic, label] of [['power', 'energy', 'Electricity map'], ['water', 'water', 'Water map'], ['happy', 'heart', 'Happiness map'], ['traffic', 'car', 'Traffic map'], ['land', 'coin', 'Land value map'], ['crime', 'eye', 'Crime map']] as const) {
      const b = el('button', 'layer-btn');
      b.innerHTML = icon(ic);
      b.title = t(label);
      b.setAttribute('aria-label', t(label));
      b.dataset.layer = k;
      b.addEventListener('click', () => h.setLayer(k));
      this.layerBtns.set(k, b);
      layers.appendChild(b);
    }
    this.root.appendChild(layers);
    this.root.appendChild(this.legendEl);

    const top = el('div', 'topbar');
    const soundBtn = this.iconButton(sound.sfxOn ? 'sound' : 'mute', t('Sound'), () => { soundBtn.innerHTML = icon(h.toggleSound() ? 'sound' : 'mute'); });
    // one compact navigation block; on small screens the less used panels move into a "more" menu
    const nav = el('div', 'navgroup');
    const more = el('div', 'navmenu');
    // the panels (newspaper, letters, all buildings, statistics…) live in the town panel on the right
    nav.appendChild(this.iconButton('menu', t('Menu'), h.openMenu));
    soundBtn.classList.add('nav-snd-keep');
    nav.append(soundBtn, more);
    document.addEventListener('pointerdown', (e) => { if (!nav.contains(e.target as Node)) more.classList.remove('show'); }, true);
    const chips = el('div', 'chips');
    // grouped, colour-coded resource readouts: city · materials · utilities · people · time
    const GROUPS: [string, IconName, string][][] = [
      [['city', 'buildings', 'City you are building for (click to switch)']],
      [['money', 'r_money', 'Town money (balance per day)'], ['stone', 'r_stone', 'Stone'], ['wood', 'r_wood', 'Wood (building material and fuel)'],
        ['iron', 'r_iron', 'Iron (for industry and big buildings)'], ['food', 'r_food', 'Food (everyone eats 1 per day)'], ['allres', 'list', 'All resources and the stores']],
      [['energy', 'r_energy', 'Energy supplied'], ['water', 'r_water', 'Drinking water supplied']],
      [['pop', 'r_people', 'Population'], ['happy', 'r_happy', 'Happiness']],
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
    // phones: money, food and stone stay; "More" opens every resource with its picture
    const resMore = el('button', 'chip res-more');
    resMore.innerHTML = `${icon('dots')}<span class="v"></span>`;
    (resMore.querySelector('.v') as HTMLElement).textContent = t('More');
    resMore.addEventListener('click', (e) => { e.stopPropagation(); this.toggleResPop(); });
    chips.appendChild(resMore);
    document.addEventListener('pointerdown', (e) => { if (!this.resPop.contains(e.target as Node) && !resMore.contains(e.target as Node)) this.resPop.classList.remove('show'); }, true);
    top.appendChild(chips);
    const spacer = el('div', 'top-spacer');
    top.appendChild(spacer);

    const corner = el('div', 'corner');
    const speeds = el('div', 'speeds speed-pick');
    this.spPause = el('button', 'sbtn sp-pause');
    this.spPause.addEventListener('click', () => h.setSpeed(this.speed === 0 ? (this.lastSpeed || 1) : 0));
    this.spCur = el('button', 'sbtn sp-cur');
    this.spCur.title = t('Game speed');
    const spMenu = el('div', 'sp-menu');
    this.spCur.addEventListener('click', (e) => { e.stopPropagation(); spMenu.classList.toggle('show'); });
    for (const [sp, label] of [[1, 'Normal'], [3, 'Fast'], [10, 'Very fast'], [50, 'Fastest']] as [number, string][]) {
      const o = el('button', 'sp-opt');
      o.innerHTML = `<b>${sp}×</b><span></span>`;
      (o.querySelector('span') as HTMLElement).textContent = t(label);
      o.dataset.speed = String(sp);
      o.addEventListener('click', () => { spMenu.classList.remove('show'); h.setSpeed(sp); });
      spMenu.appendChild(o);
      this.spOpts.push(o);
    }
    document.addEventListener('pointerdown', (e) => { if (!speeds.contains(e.target as Node)) spMenu.classList.remove('show'); }, true);
    speeds.append(this.spPause, this.spCur, spMenu);
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
    // the town panel: on phones a button opens it as a sheet
    const townBtn = this.iconButton('buildings', t('Town'), () => this.side.classList.toggle('open'));
    townBtn.classList.add('town-btn');
    this.townBtn = townBtn;
    // the bar reads left to right: resources · time and speed · panels · menu
    top.append(corner, townBtn);
    nav.classList.add('nav-right');
    top.appendChild(nav);

    this.drawer = el('div', 'drawer');

    const bar = el('div', 'toolbar');
    this.moveBtn = this.toolButton('pan', t('Move'));
    this.moveBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('pan'); });
    bar.append(this.moveBtn, el('div', 'sep'));
    for (const c of CATS) {
      const btn = this.toolButton(c.icon, t(c.label));
      btn.classList.add('cat');
      btn.dataset.cat = c.id;
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

    // search sits on the tab row
    this.tabSearch = el('input', 'tab-search') as HTMLInputElement;
    this.tabSearch.type = 'search';
    this.tabSearch.placeholder = t('Search buildings…');
    this.tabSearch.addEventListener('input', () => { this.searchText = this.tabSearch.value; this.toggleDrawer(this.drawerCat ?? 'buildings', true); });
    this.tabSearch.addEventListener('keydown', (e) => e.stopPropagation());
    const dockFold = el('button', 'dock-fold');
    dockFold.innerHTML = icon('down');
    dockFold.title = t('Hide the build panel');
    dockFold.addEventListener('click', () => { this.dock.classList.toggle('min'); document.body.classList.toggle('dock-min', this.dock.classList.contains('min')); dockFold.innerHTML = icon(this.dock.classList.contains('min') ? 'up' : 'down'); });
    bar.append(this.tabSearch, dockFold);
    this.dock = el('div', 'dock');
    const tools = el('div', 'dock-tools');
    tools.append(this.moveBtn, this.removeBtn, this.undoBtn);
    const main = el('div', 'dock-main');
    main.append(bar, this.drawer);
    this.dock.append(tools, main);
    // the town side panel
    this.side = el('div', 'sidebar');
    const sh = el('div', 'side-head');
    this.sideTitle = el('b', '');
    const sx = el('button', 'info-x side-x');
    sx.innerHTML = icon('close');
    sx.addEventListener('click', () => this.side.classList.remove('open'));
    sh.append(this.sideTitle, sx);
    this.sideStats = el('div', 'side-stats');
    this.sideFavs = el('div', 'side-favs');
    const nt = el('div', 'side-title');
    nt.textContent = t('What the town needs');
    this.sideNeeds = el('div', 'side-needs');
    const top3 = el('div', 'side-actions');
    for (const [ic, label, fn, key] of [['buildings', 'Town hall', () => h.openHall?.(), 'hall'], ['news', 'Newspaper', h.openNews, 'news'], ['mail', 'Letters', h.openPetitions, 'mail'], ['office', 'All buildings', h.openBuildings, 'office']] as [IconName, string, () => void, string][]) {
      const b = el('button', 'side-act');
      b.innerHTML = `${icon(ic)}<span>${t(label)}</span>`;
      b.title = t(label);
      b.dataset.panel = key;
      b.addEventListener('click', () => { if (window.innerWidth <= 760) this.side.classList.remove('open'); fn(); });
      if (key !== 'hall') this.navBtn.set(ic, b);
      top3.appendChild(b);
    }
    const qt = el('div', 'side-title');
    qt.textContent = t('More');
    const quick = el('div', 'side-quick');
    for (const [ic, label, fn] of [['stats', 'Statistics', h.openStats], ['production', 'Production chains', () => h.openChains?.()], ['globe', 'Embassy', () => h.openEmbassy?.()], ['globe', 'Trade', h.openTrade], ['buildings', 'World: all towns', h.openWorld], ['trophy', 'Goals', h.openGoals],
      ['list', 'Chronicle', h.openLog], ['car', 'Drive a car', h.openDrive], ['camera', 'Photo mode', h.openPhoto], ['book', 'Guide', h.openGuide], ['play', 'Tutorial', () => h.openTutorial?.()]] as [IconName, string, () => void][]) {
      const b = el('button', 'side-btn');
      b.dataset.panel = ic;
      b.innerHTML = `${icon(ic)}<span>${t(label)}</span>`;
      b.addEventListener('click', () => { if (window.innerWidth <= 760) this.side.classList.remove('open'); fn(); });
      quick.appendChild(b);
    }
    this.side.append(sh, top3, this.sideStats, this.sideFavs, nt, this.sideNeeds, qt, quick);
    // a handle on the panel's edge folds it away (remembered between visits)
    const sideToggle = el('button', 'side-toggle');
    const setSide = (min: boolean) => {
      document.body.classList.toggle('side-min', min);
      sideToggle.innerHTML = icon(min ? 'chevL' : 'chevR');
      sideToggle.title = min ? t('Show the town panel') : t('Hide the town panel');
      try { localStorage.setItem('mcw_side_min', min ? '1' : '0'); } catch { /* ignore */ }
    };
    let sideMin = false;
    try { sideMin = localStorage.getItem('mcw_side_min') === '1'; } catch { /* ignore */ }
    setSide(sideMin);
    sideToggle.addEventListener('click', () => setSide(!document.body.classList.contains('side-min')));
    this.root.append(top, this.side, this.hint, this.toastEl, this.pendingEl, this.dock, sideToggle, this.costEl, this.reportEl, this.modeEl, this.resPop);
    parent.appendChild(this.root);
    this.toggleDrawer('buildings');
  }

  private navBtn = new Map<IconName, HTMLButtonElement>();
  private townBtn?: HTMLButtonElement;
  private badges = new Map<string, number>();
  /** Fly to a person and follow them (set from the handlers). */
  openPersonById?: (id: number) => void;

  /** Phones: close the town sheet (wide screens keep the panel). */
  closeSide() { if (window.innerWidth <= 760) this.side.classList.remove('open'); }

  /** Show the town panel (unfolded on wide screens, the sheet on phones). */
  showSide() {
    if (window.innerWidth <= 760) this.side.classList.add('open');
    else if (document.body.classList.contains('side-min')) (this.root.querySelector('.side-toggle') as HTMLButtonElement | null)?.click();
  }

  /** A small counter on a top-bar button (e.g. unanswered letters). */
  setBadge(name: IconName, n: number) {
    this.badges.set(name, n);
    // phones: the town button (it opens the panel) shows them all together
    const all = [...this.badges.values()].reduce((a, v) => a + Math.max(0, v), 0);
    if (this.townBtn) {
      let tb = this.townBtn.querySelector('.nav-badge') as HTMLSpanElement | null;
      if (all <= 0) tb?.remove();
      else { if (!tb) { tb = el('span', 'nav-badge'); this.townBtn.appendChild(tb); } tb.textContent = all > 9 ? '9+' : `${all}`; }
    }
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

  private toggleDrawer(cat: Category, keep = false) {
    if (this.drawerCat === cat && !keep && !this.dock?.classList.contains('min')) return;
    if (this.dock?.classList.contains('min')) { this.dock.classList.remove('min'); document.body.classList.remove('dock-min'); }
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
    // a mouse wheel scrolls the row of tiles sideways
    row.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    this.drawer.append(row, this.descEl);
    this.drawer.classList.add('show');
    this.catBtns.forEach((btn, c) => btn.classList.toggle('open', c === cat));
    this.refreshCards();
  }

  /** The tiles stay open in the dock; only the search is cleared. */
  private closeDrawer() {
    if (this.searchText && this.tabSearch) { this.searchText = ''; this.tabSearch.value = ''; if (this.drawerCat) this.toggleDrawer(this.drawerCat, true); }
  }

  private card(it: ToolItem) {
    const btn = el('button', 'card');
    btn.dataset.tool = it.tool;
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
    if (it.bricks) parts.push(`<span class="c-brick" title="${t('Bricks')}">▦${it.bricks}</span>`);
    if (it.steel) parts.push(`<span class="c-steel" title="${t('Steel')}">⌶${it.steel}</span>`);
    cost.innerHTML = parts.length ? parts.join('') + (it.perTile ? `<i>/${t('tile')}</i>` : '') : `<span>${t('Free')}</span>`;
    btn.title = t(it.desc);
    const showDesc = () => { if (this.descEl) this.descEl.textContent = t(it.desc); };
    btn.addEventListener('mouseenter', showDesc);
    btn.addEventListener('focus', showDesc);
    const count = el('span', 'card-count');
    void cost;
    btn.append(img, name, tag, count);
    btn.addEventListener('click', () => {
      this.h.setTool(it.tool);
      showDesc();
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
      const lock = this.lockOf?.(it.tool) ?? null;
      c.classList.toggle('locked', !!lock);
      if (lock) c.dataset.lock = lock; else delete c.dataset.lock;
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
    this.renderCost();
    this.renderMode();
  }

  private costEl = el('div', 'build-cost');
  private resPop = el('div', 'res-pop');
  private lastStats?: HudStats;

  private toggleResPop() {
    this.resPop.classList.toggle('show');
    this.renderResPop();
  }

  /** The resources sheet (phones): every readout and every good, with its picture and amount. */
  private renderResPop() {
    const s = this.lastStats;
    if (!s || !this.resPop.classList.contains('show')) return;
    const f = (v: number) => Math.floor(v).toLocaleString('en-US');
    const main: [string, IconName, string, string, string?, boolean?][] = [
      ['money', 'r_money', 'Money', `$${f(s.money)}`, `${s.daily >= 0 ? '+' : '−'}$${f(Math.abs(s.daily))}/${t('day')}`, s.daily < 0],
      ['food', 'r_food', 'Food', f(s.food), `${s.foodDaily >= 0 ? '+' : ''}${f(s.foodDaily)}/${t('day')}`, s.food < s.population * 2],
      ['stone', 'r_stone', 'Stone', f(s.stone)],
      ['wood', 'r_wood', 'Wood', f(s.wood), undefined, s.wood < 15],
      ['iron', 'r_iron', 'Iron', f(s.iron)],
      ['energy', 'r_energy', 'Electricity', `${Math.round(s.powered * 100)}%`, undefined, s.powered < 0.8],
      ['water', 'r_water', 'Water', `${Math.round(s.water * 100)}%`, undefined, s.water < 0.9],
      ['pop', 'r_people', 'Population', f(s.population), `${f(s.households)}/${f(s.homeUnits)} ${t('homes')}`],
      ['happy', 'r_happy', 'Happiness', `${Math.round(s.happiness)}%`, undefined, s.happiness < 45],
      ['jobs', 'r_jobs', 'Working / jobs', `${f(s.workers)}/${f(s.workers + s.vacancies)}`],
    ];
    const EMOJI: Record<string, string> = { bricks: '🧱', planks: '🪵', coal: '⚫', grain: '🌾', flour: '🥡', milk: '🥛', cotton: '☁️', garments: '👕', furniture: '🛋️', steel: '🔩', feed: '🌽' };
    const key = JSON.stringify([main.map((m) => m[3] + (m[4] ?? '')), s.goods]);
    if (this.resPop.dataset.key === key) return;
    this.resPop.dataset.key = key;
    this.resPop.replaceChildren();
    const head = el('div', 'rpp-head');
    head.innerHTML = `<b></b><button class="ml-x">${icon('close')}</button>`;
    (head.querySelector('b') as HTMLElement).textContent = t('All resources');
    head.querySelector('button')!.addEventListener('click', () => this.resPop.classList.remove('show'));
    const grid = el('div', 'rpp-grid');
    const card = (pic: string, label: string, value: string, sub?: string, bad?: boolean, open?: () => void) => {
      const c = el('button', `rpp-card${bad ? ' bad' : ''}`);
      c.innerHTML = `<span class="rpp-pic">${pic}</span><div><small></small><b></b><i></i></div>`;
      (c.querySelector('small') as HTMLElement).textContent = label;
      (c.querySelector('b') as HTMLElement).textContent = value;
      (c.querySelector('i') as HTMLElement).textContent = sub ?? '';
      if (open) c.addEventListener('click', () => { this.resPop.classList.remove('show'); open(); });
      grid.appendChild(c);
    };
    for (const [k, ic, label, value, sub, bad] of main) card(icon(ic), t(label), value, sub, bad, () => this.h.openResource(k === 'jobs' ? 'pop' : k));
    const goods = (s.goods ?? []).filter(([, , v]) => v >= 1);
    if (goods.length) {
      const h2 = el('div', 'rpp-sec');
      h2.textContent = t('Goods in the stores');
      grid.appendChild(h2);
      for (const [k, label, v] of goods) card(EMOJI[k] ?? '📦', t(label), f(v));
    }
    this.resPop.append(head, grid);
  }
  private modeEl = el('div', 'build-mode');

  /** While a build tool is on: what it is, and buttons back to Move or to cancel. */
  private renderMode() {
    const it = ITEMS.find((i) => i.tool === this.tool);
    const on = this.tool !== 'pan' && (!!it || this.tool === 'bulldoze');
    this.modeEl.classList.toggle('show', on);
    if (!on) return;
    const name = it ? t(it.name) : t('Remove');
    if (this.modeEl.dataset.tool === this.tool) return;
    this.modeEl.dataset.tool = this.tool;
    this.modeEl.innerHTML = `<span class="bm-ic">${icon(it?.icon ?? 'bulldoze')}</span><b></b><button class="bm-move">${icon('pan')}<span></span></button><button class="bm-x">${icon('close')}<span></span></button>`;
    (this.modeEl.querySelector('b') as HTMLElement).textContent = name;
    (this.modeEl.querySelector('.bm-move span') as HTMLElement).textContent = `${t('Move')} (V)`;
    (this.modeEl.querySelector('.bm-x span') as HTMLElement).textContent = t('Cancel');
    this.modeEl.querySelector('.bm-move')!.addEventListener('click', () => { this.h.cancelBuild(); this.h.setTool('pan'); });
    this.modeEl.querySelector('.bm-x')!.addEventListener('click', () => { this.h.cancelBuild(); this.h.setTool('pan'); });
  }
  /** Why a building is still locked (the town level it needs), or null. Set by the game. */
  lockOf?: (tool: string) => string | null;
  private reportEl = el('div', 'day-report');

  /** The morning card: what happened in the town yesterday (closes by itself after a while). */
  dayReport(title: string, lines: [string, string, ('good' | 'bad')?][], tip: string) {
    let on = true;
    try { on = localStorage.getItem('mcw_dayreport') !== '0'; } catch { /* ignore */ }
    if (!on) return;
    const r = this.reportEl;
    r.replaceChildren();
    const head = el('div', 'dr-head');
    head.innerHTML = '<span>☀️</span><b></b>';
    (head.querySelector('b') as HTMLElement).textContent = title;
    const x = el('button', 'ml-x');
    x.innerHTML = icon('close');
    x.addEventListener('click', () => r.classList.remove('show'));
    head.appendChild(x);
    const grid = el('div', 'dr-grid');
    for (const [k, v, tone] of lines) {
      const c = el('div', `dr-cell${tone ? ` ${tone}` : ''}`);
      c.innerHTML = '<small></small><b></b>';
      (c.querySelector('small') as HTMLElement).textContent = k;
      (c.querySelector('b') as HTMLElement).textContent = v;
      grid.appendChild(c);
    }
    const foot = el('div', 'dr-foot');
    const tp = el('span', '');
    tp.textContent = tip;
    const off = el('button', 'btn-mini ghost');
    off.textContent = t('Do not show');
    off.addEventListener('click', () => { try { localStorage.setItem('mcw_dayreport', '0'); } catch { /* ignore */ } r.classList.remove('show'); this.toast(t('The morning card is off — turn it on again in Settings → Morning card')); });
    foot.append(tp, off);
    r.append(head, grid, foot);
    r.classList.add('show');
    clearTimeout(this.reportT);
    this.reportT = window.setTimeout(() => r.classList.remove('show'), 16000);
  }
  private reportT = 0;
  private lastBricks = 0;

  /** What the chosen building needs and what the town has of it (shown above the dock while building). */
  private renderCost() {
    const it = ITEMS.find((i) => i.tool === this.tool);
    const need: [IconName | '', string, number, number, string?][] = [];
    if (it) {
      if (it.money) need.push(['coin', t('Money'), it.money, this.lastMoney]);
      if (it.stone) need.push(['stone', t('Stone'), it.stone, this.lastStone]);
      if (it.wood) need.push(['wood', t('Wood'), it.wood, this.lastWood]);
      if (it.iron) need.push(['iron', t('Iron'), it.iron, this.lastIron]);
      if (it.bricks) need.push(['', t('Bricks'), it.bricks, this.lastBricks, '▦']);
    }
    if (!it || !need.length) { this.costEl.classList.remove('show'); return; }
    const thumb = this.thumbs.get(it.tool);
    const key = `${it.tool}|${need.map((n) => `${n[2]}:${Math.floor(n[3])}`).join(',')}`;
    if (this.costEl.dataset.key === key) { this.costEl.classList.add('show'); return; }
    this.costEl.dataset.key = key;
    const ok = need.every((n) => n[3] >= n[2]);
    this.costEl.innerHTML = `<div class="bc-head">${thumb ? `<i style="background-image:url(${thumb})"></i>` : `<i>${icon(it.icon)}</i>`}<div><b></b><small></small></div></div>
      <div class="bc-list">${need.map(([ic, , n, have, sym]) => `<div class="bc-row ${have >= n ? 'ok' : 'no'}"><span class="bc-ic">${ic ? icon(ic) : sym}</span><span class="bc-l"></span><b>${n.toLocaleString('en-US')}${it.perTile ? `<small>/${t('tile')}</small>` : ''}</b><small class="bc-have">${t('have {n}', { n: Math.floor(have).toLocaleString('en-US') })}</small></div>`).join('')}</div>`;
    (this.costEl.querySelector('.bc-head b') as HTMLElement).textContent = t(it.name);
    (this.costEl.querySelector('.bc-head small') as HTMLElement).textContent = ok ? t('You have everything to build it') : t('Not enough — the red ones are missing');
    this.costEl.querySelectorAll('.bc-l').forEach((e, i) => { e.textContent = need[i][1]; });
    this.costEl.classList.toggle('poor', !ok);
    this.costEl.classList.add('show');
  }

  private speed = 1;
  private lastSpeed = 1;
  private playBtn!: HTMLButtonElement;
  private stepBtn!: HTMLButtonElement;

  setSpeed(s: number) {
    this.speedBtns.forEach((btn, i) => btn.classList.toggle('active', SPEEDS[i] === s));
    if (this.spPause) {
      this.spPause.innerHTML = icon(s === 0 ? 'play' : 'pause');
      this.spPause.classList.toggle('paused', s === 0);
      this.spPause.title = s === 0 ? t('Play') : t('Pause');
      this.spCur.innerHTML = `<b>${s === 0 ? (this.lastSpeed || 1) : s}×</b>${icon('down')}`;
      this.spOpts.forEach((o) => o.classList.toggle('active', Number(o.dataset.speed) === s));
    }
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
    this.stat.happy.textContent = `${Math.round(s.happiness)}%`;
    this.chip.happy.classList.toggle('warn', s.happiness < 45);
    const mins = Math.floor(s.timeOfDay * 24 * 60);
    this.stat.day.textContent = `${s.seasonIcon} ${s.dateText} · ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.dayBar.style.width = `${Math.round(s.timeOfDay * 100)}%`;
    this.lastMoney = s.money;
    this.lastStone = s.stone;
    this.lastWood = s.wood;
    this.lastIron = s.iron;
    this.lastStats = s;
    this.renderResPop();
    this.lastBricks = s.bricks ?? 0;
    this.renderCost();
    if (this.drawerCat) this.refreshCards();
    this.renderSide(s);
  }

  /** The town panel: the numbers that matter and what the town needs next. */
  private renderSide(s: HudStats) {
    const title = s.level ? `${s.cityName} · ${t(s.level)}` : s.cityName;
    if (this.sideTitle.textContent !== title) this.sideTitle.textContent = title;
    this.sideTitle.title = s.nextLevel ?? '';
    const row = (label: string, value: string, bad = false, bar?: number) =>
      `<div class="side-row${bad ? ' bad' : ''}"><span>${label}</span><b>${value}</b>${bar !== undefined ? `<i class="side-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, bar)) * 100)}%"></i></i>` : ''}</div>`;
    const html = [
      row(t('Population'), fmt(s.population)),
      row(t('Households / home places'), `${fmt(s.households)} / ${fmt(s.homeUnits)}`, s.households >= s.homeUnits, s.homeUnits ? s.households / s.homeUnits : 1),
      row(t('Happiness'), `${Math.round(s.happiness)}%`, s.happiness < 45, s.happiness / 100),
      row(t('Working / jobs'), `${fmt(s.workers)} / ${fmt(s.workers + s.vacancies)}`, s.vacancies > 0 && s.vacancies > s.workers * 0.25, s.workers + s.vacancies ? s.workers / (s.workers + s.vacancies) : 1),
      row(t('Open jobs'), fmt(s.vacancies), s.vacancies > s.workers * 0.25 && s.vacancies > 4),
      row(t('Workforce (able to work)'), fmt(s.workforce)),
      row(t('Electricity'), `${Math.round(s.powered * 100)}%`, s.powered < 0.8, s.powered),
      row(t('Water'), `${Math.round(s.water * 100)}%`, s.water < 0.9, s.water),
      row(t('Money per day'), `${s.daily >= 0 ? '+' : '−'}$${fmt(Math.abs(s.daily))}`, s.daily < 0),
    ].join('');
    if (this.sideStats.innerHTML !== html) this.sideStats.innerHTML = html;
    // favourite people: who they are and what they do now; a tap follows them
    const favs = s.favs ?? [];
    const fk = favs.map((f) => `${f.id}:${f.doing}`).join('|');
    if (fk !== this.favKey) {
      this.favKey = fk;
      this.sideFavs.replaceChildren();
      if (favs.length) {
        const ft = el('div', 'side-title');
        ft.textContent = `★ ${t('Favourites')}`;
        this.sideFavs.appendChild(ft);
        for (const f of favs) {
          const b = el('button', 'side-fav');
          b.innerHTML = '<b></b><small></small>';
          (b.querySelector('b') as HTMLElement).textContent = f.name;
          (b.querySelector('small') as HTMLElement).textContent = f.doing;
          b.addEventListener('click', () => { if (window.innerWidth <= 760) this.side.classList.remove('open'); this.h.openPerson?.(f.id); });
          this.sideFavs.appendChild(b);
        }
      }
    }
    const needs = s.needs ?? [];
    const key = needs.join('|');
    if (key === this.needsKey) return;
    this.needsKey = key;
    this.sideNeeds.replaceChildren();
    if (!needs.length) {
      const ok = el('div', 'side-need ok');
      ok.textContent = t('Nothing urgent — the town is doing well');
      this.sideNeeds.appendChild(ok);
    }
    for (const n of needs.slice(0, 6)) {
      const d = el('div', 'side-need');
      d.textContent = n;
      this.sideNeeds.appendChild(d);
    }
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
