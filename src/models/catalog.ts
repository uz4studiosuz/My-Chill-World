import * as THREE from 'three';
import { N } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { RoadNetwork, ROAD_TWO_LANE } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { Canals } from '../paths/Canals';
import { RoadMesh } from '../roads/RoadMesh';
import { buildingGeometry } from '../buildings/Buildings';
import { PARKING_SLOTS, cropGeometry, trafficLampGeometry, trafficPoleGeometry } from './buildings';
import { logGeometry, personMesh } from './people';
import { carGeometry, cargoGeometry, truckGeometry } from './vehicles';
import { cowGeometry, sheepGeometry } from './animals';
import { canopyGeometry, mountainGeometry, pineGeometry, rockGeometry, trunkGeometry } from './nature';
import { box, merge, shape } from '../utils/voxel';

export type CatalogGroup = 'Buildings' | 'Roads' | 'People' | 'Vehicles' | 'Animals' | 'Nature';

export interface CatalogEntry {
  id: string;
  name: string;
  group: CatalogGroup;
  desc: string;
  make: () => THREE.Object3D;
}

const mesh = (g: THREE.BufferGeometry, color?: THREE.ColorRepresentation) => {
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, color: color ?? '#ffffff' }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

const group = (...objs: THREE.Object3D[]) => {
  const g = new THREE.Group();
  g.add(...objs);
  return g;
};

const at = (o: THREE.Object3D, x: number, y: number, z: number, rot = 0) => {
  o.position.set(x, y, z);
  o.rotation.y = rot;
  return o;
};

const tree = (color: string) => group(mesh(trunkGeometry()), new THREE.Mesh(canopyGeometry(), new THREE.MeshLambertMaterial({ color })));

/** Builds a small road layout around the map centre and renders it with the real road mesher. */
function roadPiece(w: number, d: number, build: (net: RoadNetwork, c: number) => void, water: (c: number) => number[] = () => []) {
  const map = new WorldMap(0);
  const c = N / 2;
  for (const k of water(c)) map.water[k] = 1;
  const net = new RoadNetwork();
  build(net, c);
  const rm = new RoadMesh(net, map);
  rm.rebuild();
  const plate = mesh(box(w, 0.12, d, 0.5, -0.06, 0.5, water(c).length ? '#d9c99a' : '#8cb156'));
  const g = group(rm.group, plate);
  if (water(c).length) {
    plate.scale.x = 0.999;
    g.add(mesh(box(w - 2, 0.3, d + 0.02, 0.5, -0.25, 0.5, '#3f93c4')));
    plate.visible = false;
    g.add(mesh(box(1, 0.12, d, 0.5 - (w - 1) / 2, -0.06, 0.5, '#8cb156')), mesh(box(1, 0.12, d, 0.5 + (w - 1) / 2, -0.06, 0.5, '#8cb156')));
  }
  return g;
}

const line = (net: RoadNetwork, type: 2, x0: number, z0: number, x1: number, z1: number) => {
  const path = [];
  for (let x = x0, z = z0; ; ) {
    path.push({ x, z });
    if (x === x1 && z === z1) break;
    x += Math.sign(x1 - x);
    z += Math.sign(z1 - z);
  }
  net.buildPath(path, type);
};

export const CATALOG: CatalogEntry[] = [
  { id: 'townhall', name: 'Town Hall', group: 'Buildings', desc: 'Heart of the town. Stores stone, employs 10.', make: () => mesh(buildingGeometry('townhall')) },
  { id: 'house', name: 'House', group: 'Buildings', desc: 'Home for 10 people.', make: () => mesh(buildingGeometry('house', 0)) },
  { id: 'house2', name: 'House (blue roof)', group: 'Buildings', desc: 'Every house gets a random colour scheme.', make: () => mesh(buildingGeometry('house', 5)) },
  { id: 'office', name: 'Office', group: 'Buildings', desc: '30 jobs. People commute here by car.', make: () => mesh(buildingGeometry('office')) },
  {
    id: 'parking', name: 'Parking Lot', group: 'Buildings', desc: '8 parking spaces. Cars stop here for a while.',
    make: () => {
      const g = group(mesh(buildingGeometry('parking')));
      const colors = ['#d9443b', '#3a6fd1', '#f1c232', '#f2f2ee'];
      [0, 2, 5, 7].forEach((i, n) => g.add(at(mesh(carGeometry(), colors[n]), PARKING_SLOTS[i][0], 0.03, PARKING_SLOTS[i][1], PARKING_SLOTS[i][2])));
      return g;
    },
  },
  { id: 'school', name: 'School', group: 'Buildings', desc: '40 pupils. Educated adults earn 50% more.', make: () => mesh(buildingGeometry('school')) },
  { id: 'watertower', name: 'Water Tower', group: 'Buildings', desc: 'Clean drinking water for 160 people.', make: () => mesh(buildingGeometry('watertower')) },
  { id: 'weddinghall', name: 'Wedding Hall', group: 'Buildings', desc: 'Young couples marry here and start a family.', make: () => mesh(buildingGeometry('weddinghall')) },
  { id: 'woodcutter', name: 'Woodcutter', group: 'Buildings', desc: 'Workers fell trees and carry the logs to the power plant.', make: () => mesh(buildingGeometry('woodcutter')) },
  { id: 'powerplant', name: 'Wood Power Plant', group: 'Buildings', desc: 'Burns wood to power homes and workplaces.', make: () => mesh(buildingGeometry('powerplant')) },
  {
    id: 'farm', name: 'Crop Farm', group: 'Buildings', desc: 'Crops grow from green to gold while farmers work the field.',
    make: () => group(mesh(buildingGeometry('farm')), (() => { const m = new THREE.Mesh(cropGeometry(), new THREE.MeshLambertMaterial({ color: '#c9b44a' })); m.castShadow = true; return m; })()),
  },
  { id: 'orchard', name: 'Fruit Orchard', group: 'Buildings', desc: 'Apple trees — a small, cheap food source.', make: () => mesh(buildingGeometry('orchard')) },
  { id: 'ranch', name: 'Cattle Ranch', group: 'Buildings', desc: 'Fenced pasture with a barn and a water trough.', make: () => group(mesh(buildingGeometry('ranch')), ...[[-0.3, 0.2, 0.4], [0.5, 0.3, -1.2], [0.1, -0.5, 2.2], [-0.8, 0.6, 3.5]].map(([x, z, r]) => at(mesh(cowGeometry()), x, 0.02, z, r))) },
  { id: 'quarry', name: 'Stone Quarry', group: 'Buildings', desc: 'Mines stone next to mountains. Trucks deliver it.', make: () => mesh(buildingGeometry('quarry')) },
  { id: 'cemetery', name: 'Cemetery', group: 'Buildings', desc: 'Resting place for the dead. Can be expanded twice.', make: () => mesh(buildingGeometry('cemetery')) },
  { id: 'grocery', name: 'Grocery Store', group: 'Buildings', desc: 'Fruit, bread and everyday food.', make: () => mesh(buildingGeometry('grocery')) },
  { id: 'clothes', name: 'Clothing Store', group: 'Buildings', desc: 'Clothes and shoes for the town.', make: () => mesh(buildingGeometry('clothes')) },
  { id: 'firestation', name: 'Fire Station', group: 'Buildings', desc: 'Fire trucks rush to burning buildings.', make: () => mesh(buildingGeometry('firestation')) },
  { id: 'busdepot', name: 'Bus Depot', group: 'Buildings', desc: 'Yellow buses for people without a car.', make: () => mesh(buildingGeometry('busdepot')) },
  { id: 'stadium', name: 'Football Stadium', group: 'Buildings', desc: 'A pitch, stands and floodlights for the city team.', make: () => mesh(buildingGeometry('stadium')) },
  { id: 'cinema', name: 'Open-air Cinema', group: 'Buildings', desc: 'A big screen and benches for films under the stars.', make: () => mesh(buildingGeometry('cinema')) },
  { id: 'academy', name: 'Academy', group: 'Buildings', desc: 'Columns, a dome and a sports ground.', make: () => mesh(buildingGeometry('academy')) },
  { id: 'playground', name: 'Playground', group: 'Buildings', desc: 'Swings, a slide, a sandbox and a see-saw.', make: () => mesh(buildingGeometry('playground')) },
  { id: 'fountain', name: 'Fountain', group: 'Buildings', desc: 'A splashing fountain with shrubs.', make: () => mesh(buildingGeometry('fountain')) },
  { id: 'flowerbed', name: 'Flower Bed', group: 'Buildings', desc: 'Colourful flowers in a stone border.', make: () => mesh(buildingGeometry('flowerbed')) },
  { id: 'gazebo', name: 'Gazebo', group: 'Buildings', desc: 'A wooden pavilion with a pointed roof.', make: () => mesh(buildingGeometry('gazebo')) },
  { id: 'pond', name: 'Duck Pond', group: 'Buildings', desc: 'A pond with lily pads, reeds and ducks.', make: () => mesh(buildingGeometry('pond')) },
  { id: 'clocktower', name: 'Clock Tower', group: 'Buildings', desc: 'A brick tower with four clock faces.', make: () => mesh(buildingGeometry('clocktower')) },
  { id: 'flagpole', name: 'Flag Pole', group: 'Buildings', desc: 'A tall pole with a waving flag.', make: () => mesh(buildingGeometry('flagpole')) },
  { id: 'planter', name: 'Flower Pots', group: 'Buildings', desc: 'Three big pots full of flowers.', make: () => mesh(buildingGeometry('planter')) },
  { id: 'archway', name: 'City Gate', group: 'Buildings', desc: 'A gate with a blue tiled arch.', make: () => mesh(buildingGeometry('archway')) },
  { id: 'statue', name: 'Monument', group: 'Buildings', desc: 'A bronze figure on a pedestal.', make: () => mesh(buildingGeometry('statue')) },
  { id: 'bench', name: 'Benches', group: 'Buildings', desc: 'Two benches and a litter bin.', make: () => mesh(buildingGeometry('bench')) },
  { id: 'lamppost', name: 'Lamp Post', group: 'Buildings', desc: 'A decorative double lamp.', make: () => mesh(buildingGeometry('lamppost')) },
  { id: 'sapling', name: 'Tree', group: 'Buildings', desc: 'A young plane tree.', make: () => mesh(buildingGeometry('sapling')) },
  { id: 'roadsign', name: 'Road Signs', group: 'Buildings', desc: 'Signs and a flower box.', make: () => mesh(buildingGeometry('roadsign')) },
  { id: 'military', name: 'Military Base', group: 'Buildings', desc: 'Barracks, parade ground, a watchtower and a tank.', make: () => mesh(buildingGeometry('military')) },
  { id: 'landfill', name: 'Landfill', group: 'Buildings', desc: 'A fenced pit where garbage trucks dump the rubbish.', make: () => mesh(buildingGeometry('landfill')) },
  { id: 'recycling', name: 'Recycling Plant', group: 'Buildings', desc: 'Sorts rubbish and recovers iron.', make: () => mesh(buildingGeometry('recycling')) },
  { id: 'mill', name: 'Flour Mill', group: 'Buildings', desc: 'A windmill grinds grain into flour.', make: () => mesh(buildingGeometry('mill')) },
  { id: 'bakery', name: 'Bakery', group: 'Buildings', desc: 'Bakes hot bread from flour.', make: () => mesh(buildingGeometry('bakery')) },
  { id: 'sawmill', name: 'Sawmill', group: 'Buildings', desc: 'Saws logs into planks.', make: () => mesh(buildingGeometry('sawmill')) },
  { id: 'battery', name: 'Battery Storage', group: 'Buildings', desc: 'Stores spare electricity for the night.', make: () => mesh(buildingGeometry('battery')) },
  { id: 'casino', name: 'Casino', group: 'Buildings', desc: 'Golden dome, neon sign and a red carpet.', make: () => mesh(buildingGeometry('casino')) },
  { id: 'mosque', name: 'Mosque', group: 'Buildings', desc: 'Blue dome, an arched portal and a minaret.', make: () => mesh(buildingGeometry('mosque')) },
  { id: 'themepark', name: 'Amusement Park', group: 'Buildings', desc: 'Ferris wheel, carousel, roller coaster and stalls (4×4).', make: () => mesh(buildingGeometry('themepark')) },
  { id: 'bigpark', name: 'Central Park', group: 'Buildings', desc: 'Lawns, a pond, a pavilion and many trees (3×3).', make: () => mesh(buildingGeometry('bigpark')) },
  { id: 'gym', name: 'Gym', group: 'Buildings', desc: 'Glass-front hall with a dumbbell sign.', make: () => mesh(buildingGeometry('gym')) },
  { id: 'teahouse', name: 'Teahouse', group: 'Buildings', desc: 'Choyxona: a terrace with tapchans, a samovar and a plov kazan.', make: () => mesh(buildingGeometry('teahouse')) },
  { id: 'tower15', name: 'Block of 15 Flats', group: 'Buildings', desc: 'Eight floors, fifteen flats, balconies.', make: () => mesh(buildingGeometry('tower15')) },
  { id: 'tower30', name: 'Block of 30 Flats', group: 'Buildings', desc: 'Twelve floors, thirty flats.', make: () => mesh(buildingGeometry('tower30')) },
  { id: 'tower50', name: 'Block of 50 Flats', group: 'Buildings', desc: 'Sixteen floors on a big plot, fifty flats.', make: () => mesh(buildingGeometry('tower50')) },
  { id: 'warehouse', name: 'Warehouse', group: 'Buildings', desc: 'A long shed with loading doors, crates, sacks and barrels.', make: () => mesh(buildingGeometry('warehouse')) },
  { id: 'concerthall', name: 'Concert Hall', group: 'Buildings', desc: 'A curved hall with a glass foyer and lights on the square.', make: () => mesh(buildingGeometry('concerthall')) },
  { id: 'barber', name: 'Barber Shop', group: 'Buildings', desc: 'A little shop with a striped pole.', make: () => mesh(buildingGeometry('barber')) },
  { id: 'kiosk', name: 'Coffee Cart', group: 'Buildings', desc: 'Coffee and ice cream under a striped umbrella.', make: () => mesh(buildingGeometry('kiosk')) },
  { id: 'embassy', name: 'Embassy', group: 'Buildings', desc: 'A white building with columns and the flags of the towns.', make: () => mesh(buildingGeometry('embassy')) },
  { id: 'garage', name: 'Parking Garage', group: 'Buildings', desc: 'Open concrete decks full of cars, a ramp and a blue P sign.', make: () => mesh(buildingGeometry('garage')) },
  { id: 'metro', name: 'Metro Station', group: 'Buildings', desc: 'Stairs down to the trains under a glass canopy and a red M.', make: () => mesh(buildingGeometry('metro')) },
  { id: 'cctv', name: 'Security Camera', group: 'Buildings', desc: 'A camera on a pole watching the street.', make: () => mesh(buildingGeometry('cctv')) },
  { id: 'levee', name: 'Flood Wall', group: 'Buildings', desc: 'A stone wall with sandbags against the river.', make: () => mesh(buildingGeometry('levee')) },
  { id: 'dairyshop', name: 'Dairy Shop', group: 'Buildings', desc: 'Milk, yogurt and cheese under a cow-print awning.', make: () => mesh(buildingGeometry('dairyshop')) },
  { id: 'pharmacy', name: 'Pharmacy', group: 'Buildings', desc: 'Medicines behind a green cross.', make: () => mesh(buildingGeometry('pharmacy')) },
  { id: 'dairy', name: 'Dairy', group: 'Buildings', desc: 'Milk tanks and a cheese hall.', make: () => mesh(buildingGeometry('dairy')) },
  { id: 'supermarket', name: 'Supermarket', group: 'Buildings', desc: 'A big shop with a glass front and trolleys.', make: () => mesh(buildingGeometry('supermarket')) },
  { id: 'brickworks', name: 'Brickworks', group: 'Buildings', desc: 'A kiln and stacks of red bricks.', make: () => mesh(buildingGeometry('brickworks')) },
  { id: 'steelmill', name: 'Steel Mill', group: 'Buildings', desc: 'Blast furnace and glowing slag.', make: () => mesh(buildingGeometry('steelmill')) },
  { id: 'sewage', name: 'Sewage Treatment', group: 'Buildings', desc: 'Round settling tanks and a pump house.', make: () => mesh(buildingGeometry('sewage')) },
  { id: 'coalmine', name: 'Coal Mine', group: 'Buildings', desc: 'Headframe, coal heap and a cart.', make: () => mesh(buildingGeometry('coalmine')) },
  { id: 'coalplant', name: 'Coal Power Plant', group: 'Buildings', desc: 'Boiler hall and cooling towers.', make: () => mesh(buildingGeometry('coalplant')) },
  { id: 'hydro', name: 'Hydro Dam', group: 'Buildings', desc: 'A concrete dam with sluices and turbines.', make: () => mesh(buildingGeometry('hydro')) },
  { id: 'airport', name: 'Airport', group: 'Buildings', desc: 'Runway, terminal and control tower.', make: () => mesh(buildingGeometry('airport')) },
  { id: 'busstop', name: 'Bus Stop', group: 'Buildings', desc: 'Shelter where passengers board and exit buses.', make: () => mesh(buildingGeometry('busstop')) },
  { id: 'ironmine', name: 'Iron Mine', group: 'Buildings', desc: 'Ore carts and red iron ore by the mountain.', make: () => mesh(buildingGeometry('ironmine')) },
  { id: 'eldercare', name: 'Elder Care Home', group: 'Buildings', desc: 'A warm house with a veranda, a ramp, benches and a garden.', make: () => mesh(buildingGeometry('eldercare')) },
  { id: 'restaurant', name: 'Restaurant', group: 'Buildings', desc: 'A dining hall with a striped awning and tables on the terrace.', make: () => mesh(buildingGeometry('restaurant')) },
  { id: 'zoo', name: 'Zoo', group: 'Buildings', desc: 'Giraffes, an elephant, a lion and penguins in their enclosures.', make: () => mesh(buildingGeometry('zoo')) },
  { id: 'pier', name: 'Fishing Pier', group: 'Buildings', desc: 'Wooden planks over the water with rods and a lantern.', make: () => mesh(buildingGeometry('pier')) },
  { id: 'forestry', name: 'Forestry', group: 'Buildings', desc: 'A log cabin and a nursery of saplings.', make: () => mesh(buildingGeometry('forestry')) },
  { id: 'greenhouse', name: 'Greenhouse', group: 'Buildings', desc: 'Two glass tunnels of tomatoes and cucumbers, a shed and a water tank.', make: () => mesh(buildingGeometry('greenhouse')) },
  { id: 'apiary', name: 'Apiary', group: 'Buildings', desc: 'Painted beehives in a flower meadow and a little honey hut.', make: () => mesh(buildingGeometry('apiary')) },
  { id: 'poultry', name: 'Poultry Farm', group: 'Buildings', desc: 'A red barn, a feed silo and hens in a fenced yard.', make: () => mesh(buildingGeometry('poultry')) },
  { id: 'fishery', name: 'Fishing Hut', group: 'Buildings', desc: 'A hut with a pier and a little boat.', make: () => mesh(buildingGeometry('fishery')) },
  { id: 'kindergarten', name: 'Kindergarten', group: 'Buildings', desc: 'A colourful nursery with a little playground.', make: () => mesh(buildingGeometry('kindergarten')) },
  { id: 'hotel', name: 'Hotel', group: 'Buildings', desc: 'Rooms for tourists and a pool.', make: () => mesh(buildingGeometry('hotel')) },
  { id: 'windturbine', name: 'Wind Turbine', group: 'Buildings', desc: 'Clean power from the wind.', make: () => mesh(buildingGeometry('windturbine')) },
  { id: 'solarfarm', name: 'Solar Farm', group: 'Buildings', desc: 'Rows of solar panels.', make: () => mesh(buildingGeometry('solarfarm')) },
  { id: 'trainstation', name: 'Train Station', group: 'Buildings', desc: 'Brick station with a platform.', make: () => mesh(buildingGeometry('trainstation')) },
  { id: 'apartment', name: 'Apartment Block', group: 'Buildings', desc: 'Five floors with balconies and parking.', make: () => mesh(buildingGeometry('apartment')) },
  { id: 'police', name: 'Police Station', group: 'Buildings', desc: 'Officers keep fights and crime down.', make: () => mesh(buildingGeometry('police')) },
  { id: 'park', name: 'Park', group: 'Buildings', desc: 'Green space with a pond and benches.', make: () => mesh(buildingGeometry('park')) },
  { id: 'hospital', name: 'Hospital', group: 'Buildings', desc: 'Doctors and nurses heal the sick.', make: () => mesh(buildingGeometry('hospital')) },
  { id: 'university', name: 'University', group: 'Buildings', desc: 'Four years of study for a degree and a better wage.', make: () => mesh(buildingGeometry('university')) },
  { id: 'market', name: 'Market', group: 'Buildings', desc: 'Bazaar stalls for food, clothes and goods.', make: () => mesh(buildingGeometry('market')) },
  { id: 'carmarket', name: 'Car Market', group: 'Buildings', desc: 'New cars for families who have saved up.', make: () => mesh(buildingGeometry('carmarket')) },
  { id: 'bank', name: 'Bank', group: 'Buildings', desc: 'Finance — pays business tax.', make: () => mesh(buildingGeometry('bank')) },
  { id: 'gasstation', name: 'Gas Station', group: 'Buildings', desc: 'Fuel for the cars of the town.', make: () => mesh(buildingGeometry('gasstation')) },
  { id: 'factory', name: 'Factory', group: 'Buildings', desc: 'Heavy industry with chimneys and many jobs.', make: () => mesh(buildingGeometry('factory')) },
  { id: 'migration', name: 'Migration Company', group: 'Buildings', desc: 'An office with a globe on the roof and a queue of newcomers.', make: () => mesh(buildingGeometry('migration')) },
  { id: 'bikefactory', name: 'Bicycle Factory', group: 'Buildings', desc: 'A saw-tooth workshop, a wheel sign and new bikes in a row.', make: () => mesh(buildingGeometry('bikefactory')) },
  { id: 'carfactory', name: 'Car Factory', group: 'Buildings', desc: 'Assembly halls and a showroom.', make: () => mesh(buildingGeometry('carfactory')) },
  { id: 'construction', name: 'Construction Company', group: 'Buildings', desc: 'Builders and a crane: faster construction.', make: () => mesh(buildingGeometry('construction')) },

  { id: 'road', name: 'Road', group: 'Roads', desc: 'Two lanes with sidewalks. Junctions get traffic lights and zebra crossings.', make: () => roadPiece(3, 3, (n, c) => { line(n, ROAD_TWO_LANE, c - 1, c, c + 1, c); line(n, ROAD_TWO_LANE, c, c - 1, c, c + 1); }) },
  {
    id: 'litroad', name: 'Lit Street', group: 'Roads', desc: 'A road with street lamps.',
    make: () => {
      const g = roadPiece(3, 1, (n, c) => line(n, ROAD_TWO_LANE, c - 1, c, c + 1, c));
      for (const x of [-0.6, 1.6]) g.add(mesh(box(0.05, 0.7, 0.05, x, 0.35, 0.95, '#3b3f45')), mesh(box(0.22, 0.04, 0.06, x + 0.09, 0.7, 0.95, '#3b3f45')), mesh(box(0.1, 0.05, 0.1, x + 0.17, 0.66, 0.95, '#ffe08a')));
      return g;
    },
  },
  {
    id: 'rail', name: 'Railway', group: 'Roads', desc: 'Tracks on sleepers for the trains.',
    make: () => {
      const parts = [box(3, 0.12, 1.4, 0.5, -0.06, 0.5, '#8cb156'), box(3, 0.04, 0.6, 0.5, 0.02, 0.5, '#9a8f80')];
      for (let i = 0; i < 9; i++) parts.push(box(0.1, 0.04, 0.56, -0.9 + i * 0.35, 0.05, 0.5, '#6b4a2e'));
      parts.push(box(3, 0.05, 0.05, 0.5, 0.09, 0.32, '#9aa3ab'), box(3, 0.05, 0.05, 0.5, 0.09, 0.68, '#9aa3ab'));
      return mesh(merge(parts));
    },
  },
  {
    id: 'pipe', name: 'Water Pipe', group: 'Roads', desc: 'An underground water pipe (shown above ground here).',
    make: () => mesh(merge([box(3, 0.12, 1.4, 0.5, -0.06, 0.5, '#8cb156'), shape('cylinder', 3, 0.16, 0.16, 0.5, 0.1, 0.5, '#5d8fb5', 'x', 12), shape('cylinder', 0.24, 0.06, 0.24, 0.5, 0.2, 0.5, '#d9443b', 'y', 10)])),
  },
  ...([['zone_res', 'Residential Zone', '#58d36b', 'house'], ['zone_com', 'Commercial Zone', '#4fa3ff', 'shop'], ['zone_ind', 'Industrial Zone', '#f2b33d', 'factory'], ['zone_none', 'Clear Zone', '#aab4be', 'none']] as const).map(([id, name, c, what]) => ({
    id, name, group: 'Roads' as const, desc: 'A painted zone.',
    make: () => mesh(merge([box(3, 0.12, 2, 0.5, -0.06, 0.5, '#8cb156'), box(2.6, 0.02, 1.6, 0.5, 0.01, 0.5, c),
      ...(what === 'house' ? [box(0.5, 0.4, 0.5, 0.5, 0.21, 0.5, '#f4f1ea'), shape('pyramid', 0.6, 0.3, 0.6, 0.5, 0.55, 0.5, '#c4553d')]
        : what === 'shop' ? [box(0.7, 0.45, 0.5, 0.5, 0.235, 0.5, '#e9eef2'), box(0.74, 0.06, 0.2, 0.5, 0.3, 0.8, '#4fa3ff')]
        : what === 'factory' ? [box(0.8, 0.4, 0.6, 0.5, 0.21, 0.5, '#9aa3ab'), box(0.12, 0.6, 0.12, 0.75, 0.5, 0.3, '#7d7a73')]
        : [box(1.2, 0.04, 0.12, 0.5, 0.04, 0.5, '#ff5a4e')])])),
  })),
  {
    id: 'cable', name: 'Power Cable', group: 'Roads', desc: 'An electric cable on wooden poles.',
    make: () => mesh(merge([box(3, 0.12, 1.4, 0.5, -0.06, 0.5, '#8cb156'),
      ...[-0.6, 0.5, 1.6].flatMap((x) => [box(0.08, 1.1, 0.08, x, 0.55, 0.5, '#7a5a3c'), box(0.5, 0.05, 0.06, x, 1.02, 0.5, '#5c3a21')]),
      box(2.4, 0.025, 0.025, 0.5, 0.98, 0.32, '#26292e'), box(2.4, 0.025, 0.025, 0.5, 0.98, 0.68, '#26292e'),
      shape('cylinder', 0.2, 0.08, 0.2, 0.5, 0.06, 0.5, '#f2c230', 'y', 10)])),
  },
  {
    id: 'tunnel', name: 'Tunnel', group: 'Roads', desc: 'A road into a mountain through a stone portal.',
    make: () => {
      const g = roadPiece(3, 1, (n, c) => line(n, ROAD_TWO_LANE, c - 1, c, c + 1, c));
      g.add(mesh(merge([
        box(1.4, 1.0, 1.6, 1.3, 0.5, 0.5, '#8d8a83'), box(1.1, 0.4, 1.3, 1.4, 1.2, 0.5, '#7d7a73'),
        box(0.14, 0.62, 0.16, 0.54, 0.31, -0.02, '#a7a196'), box(0.14, 0.62, 0.16, 0.54, 0.31, 1.02, '#a7a196'), box(0.16, 0.14, 1.2, 0.54, 0.62, 0.5, '#a7a196'),
        box(0.02, 0.54, 0.94, 0.6, 0.27, 0.5, '#15171a'),
      ])));
      return g;
    },
  },
  {
    id: 'path', name: 'Footpath', group: 'Roads', desc: 'Free paths for pedestrians — walking is faster on paths than on grass.',
    make: () => {
      const fp = new Footpaths();
      const c = N / 2;
      fp.add([{ x: c - 1, z: c }, { x: c, z: c }, { x: c + 1, z: c }, { x: c, z: c + 1 }]);
      fp.rebuild();
      return group(fp.mesh, mesh(box(3, 0.12, 2, 0.5, -0.06, 1, '#8cb156')));
    },
  },
  {
    id: 'path_stone', name: 'Stone Path', group: 'Roads', desc: 'Free paths for pedestrians — walking is faster on paths than on grass.',
    make: () => {
      const fp = new Footpaths();
      const c = N / 2;
      fp.add([{ x: c - 1, z: c }, { x: c, z: c }, { x: c + 1, z: c }, { x: c, z: c + 1 }], 2);
      fp.rebuild();
      return group(fp.mesh, mesh(box(3, 0.12, 2, 0.5, -0.06, 1, '#8cb156')));
    },
  },
  {
    id: 'path_brick', name: 'Brick Walkway', group: 'Roads', desc: 'Free paths for pedestrians — walking is faster on paths than on grass.',
    make: () => {
      const fp = new Footpaths();
      const c = N / 2;
      fp.add([{ x: c - 1, z: c }, { x: c, z: c }, { x: c + 1, z: c }, { x: c, z: c + 1 }], 3);
      fp.rebuild();
      return group(fp.mesh, mesh(box(3, 0.12, 2, 0.5, -0.06, 1, '#8cb156')));
    },
  },
  {
    id: 'path_gravel', name: 'Gravel Path', group: 'Roads', desc: 'Free paths for pedestrians — walking is faster on paths than on grass.',
    make: () => {
      const fp = new Footpaths();
      const c = N / 2;
      fp.add([{ x: c - 1, z: c }, { x: c, z: c }, { x: c + 1, z: c }, { x: c, z: c + 1 }], 4);
      fp.rebuild();
      return group(fp.mesh, mesh(box(3, 0.12, 2, 0.5, -0.06, 1, '#8cb156')));
    },
  },
  {
    id: 'path_wood', name: 'Boardwalk', group: 'Roads', desc: 'Free paths for pedestrians — walking is faster on paths than on grass.',
    make: () => {
      const fp = new Footpaths();
      const c = N / 2;
      fp.add([{ x: c - 1, z: c }, { x: c, z: c }, { x: c + 1, z: c }, { x: c, z: c + 1 }], 5);
      fp.rebuild();
      return group(fp.mesh, mesh(box(3, 0.12, 2, 0.5, -0.06, 1, '#8cb156')));
    },
  },
  {
    id: 'roundabout', name: 'Roundabout', group: 'Roads', desc: 'One-way ring. Entering cars give way to circulating traffic.',
    make: () => roadPiece(5, 5, (n, c) => {
      n.addRoundabout(c, c);
      line(n, ROAD_TWO_LANE, c + 2, c, c + 1, c);
      line(n, ROAD_TWO_LANE, c - 2, c, c - 1, c);
      line(n, ROAD_TWO_LANE, c, c + 2, c, c + 1);
      line(n, ROAD_TWO_LANE, c, c - 2, c, c - 1);
    }),
  },
  {
    id: 'bridge', name: 'Bridge', group: 'Roads', desc: 'Draw any road over water — it becomes a bridge.',
    make: () => roadPiece(5, 1, (n, c) => line(n, ROAD_TWO_LANE, c - 2, c, c + 2, c), (c) => [c * N + c - 1, c * N + c, c * N + c + 1]),
  },
  {
    id: 'canal', name: 'Irrigation Canal', group: 'Roads', desc: 'Carries river water to the crop farms.',
    make: () => {
      const map = new WorldMap(0);
      const c = N / 2;
      map.water[c * N + c - 2] = 1;
      const cn = new Canals(map);
      cn.add([{ x: c - 1, z: c }, { x: c, z: c }, { x: c + 1, z: c }, { x: c + 1, z: c + 1 }]);
      cn.rebuild();
      return group(cn.mesh, mesh(box(3, 0.12, 2, 0.5, -0.06, 1, '#8cb156')), mesh(box(1, 0.3, 1, -1.5, -0.2, 0.5, '#3f93c4')));
    },
  },
  {
    id: 'trafficlight', name: 'Traffic Light', group: 'Roads', desc: 'Every road junction gets signals: east–west and north–south take turns.',
    make: () => {
      const lamp = new THREE.Mesh(trafficLampGeometry(), new THREE.MeshBasicMaterial({ color: '#4cff6a' }));
      return group(mesh(trafficPoleGeometry()), lamp);
    },
  },

  { id: 'car', name: 'Car', group: 'Vehicles', desc: 'Residents drive between homes, work and parking.', make: () => mesh(carGeometry(), '#d9443b') },
  { id: 'truck', name: 'Stone Truck', group: 'Vehicles', desc: 'Carries 10 stone from a quarry to the Town Hall.', make: () => group(mesh(truckGeometry()), mesh(cargoGeometry())) },

  { id: 'man', name: 'Man', group: 'People', desc: 'Adults work, drive the family car and pay taxes.', make: () => personMesh(0) },
  { id: 'woman', name: 'Woman', group: 'People', desc: 'Mothers stay home for two years after a baby is born.', make: () => personMesh(5) },
  { id: 'mother', name: 'Mother with Baby', group: 'People', desc: 'Babies are carried along on walks.', make: () => personMesh(6, 1, true) },
  { id: 'boy', name: 'Boy', group: 'People', desc: 'Children aged 6–17 walk to school.', make: () => personMesh(3, 0.62) },
  { id: 'girl', name: 'Girl', group: 'People', desc: 'Children grow up one year per day.', make: () => personMesh(6, 0.62) },
  { id: 'lumberjack', name: 'Woodcutter at Work', group: 'People', desc: 'Carries a log on the shoulder to the power plant.', make: () => group(personMesh(1), new THREE.Mesh(logGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }))) },
  { id: 'cow', name: 'Cow', group: 'Animals', desc: 'Grazes in herds on open meadows.', make: () => mesh(cowGeometry()) },
  { id: 'sheep', name: 'Sheep', group: 'Animals', desc: 'Wanders in flocks, avoids roads and buildings.', make: () => mesh(sheepGeometry()) },

  { id: 'pine', name: 'Pine Tree', group: 'Nature', desc: 'Forests and mountain slopes.', make: () => mesh(pineGeometry()) },
  { id: 'autumn', name: 'Autumn Tree', group: 'Nature', desc: 'Leafy tree in autumn colours.', make: () => tree('#e0822f') },
  { id: 'leafy', name: 'Green Tree', group: 'Nature', desc: 'Leafy tree.', make: () => tree('#6faa45') },
  { id: 'rock', name: 'Rock', group: 'Nature', desc: 'Boulders, more common near mountains.', make: () => mesh(rockGeometry(), '#9a9890') },
  { id: 'mountain', name: 'Mountain', group: 'Nature', desc: 'Irregular ridgelines, rocky slopes and a snowy peak.', make: () => mesh(mountainGeometry()) },
];

export const catalogEntry = (id: string) => CATALOG.find((e) => e.id === id)!;

/** Point a camera at an object from an isometric-ish angle so it fills the view. */
export function fitCamera(cam: THREE.PerspectiveCamera, obj: THREE.Object3D, margin = 1.08) {
  const box3 = new THREE.Box3().setFromObject(obj);
  const sphere = box3.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(1, 0.85, 1.2).normalize();
  const dist = (sphere.radius * margin) / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.copy(sphere.center).addScaledVector(dir, dist);
  cam.near = dist / 100;
  cam.far = dist * 10;
  cam.lookAt(sphere.center);
  cam.updateProjectionMatrix();
  return sphere;
}

/** Centre an object on the origin (x/z) with its base at y = 0. */
export function centerObject(obj: THREE.Object3D) {
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b.min.y;
  return obj;
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** Renders small transparent PNG thumbnails of catalog entries (for the build panel). */
export function renderThumbnails(renderer: THREE.WebGLRenderer, ids: string[], size = 96): Map<string, string> {
  const out = new Map<string, string>();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#7a8a60', 1.8));
  const sun = new THREE.DirectionalLight('#fff3df', 2.2);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const buf = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);

  for (const id of ids) {
    const obj = centerObject(catalogEntry(id).make());
    scene.add(obj);
    fitCamera(cam, obj, 1.0);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    for (let y = 0; y < size; y++) {
      img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    }
    ctx.putImageData(img, 0, 0);
    out.set(id, canvas.toDataURL());
    scene.remove(obj);
    disposeObject(obj);
  }

  renderer.setRenderTarget(null);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  return out;
}
