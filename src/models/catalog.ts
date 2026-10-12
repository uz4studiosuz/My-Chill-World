import * as THREE from 'three';
import { N } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { RoadNetwork, ROAD_TWO_LANE } from '../roads/RoadNetwork';
import { Footpaths } from '../paths/Footpaths';
import { RoadMesh } from '../roads/RoadMesh';
import { buildingGeometry } from '../buildings/Buildings';
import { PARKING_SLOTS, cropGeometry, trafficLampGeometry, trafficPoleGeometry } from './buildings';
import { logGeometry, personMesh } from './people';
import { carGeometry, cargoGeometry, truckGeometry } from './vehicles';
import { cowGeometry, sheepGeometry } from './animals';
import { canopyGeometry, mountainGeometry, pineGeometry, rockGeometry, trunkGeometry } from './nature';
import { box } from '../utils/voxel';

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
  { id: 'woodcutter', name: 'Woodcutter', group: 'Buildings', desc: 'Workers fell trees and carry the logs to the power plant.', make: () => mesh(buildingGeometry('woodcutter')) },
  { id: 'powerplant', name: 'Wood Power Plant', group: 'Buildings', desc: 'Burns wood to power homes and workplaces.', make: () => mesh(buildingGeometry('powerplant')) },
  {
    id: 'farm', name: 'Crop Farm', group: 'Buildings', desc: 'Crops grow from green to gold while farmers work the field.',
    make: () => group(mesh(buildingGeometry('farm')), (() => { const m = new THREE.Mesh(cropGeometry(), new THREE.MeshLambertMaterial({ color: '#c9b44a' })); m.castShadow = true; return m; })()),
  },
  { id: 'orchard', name: 'Fruit Orchard', group: 'Buildings', desc: 'Apple trees — a small, cheap food source.', make: () => mesh(buildingGeometry('orchard')) },
  { id: 'ranch', name: 'Cattle Ranch', group: 'Buildings', desc: 'Fenced pasture with a barn and a water trough.', make: () => group(mesh(buildingGeometry('ranch')), ...[[-0.3, 0.2, 0.4], [0.5, 0.3, -1.2], [0.1, -0.5, 2.2], [-0.8, 0.6, 3.5]].map(([x, z, r]) => at(mesh(cowGeometry()), x, 0.02, z, r))) },
  { id: 'quarry', name: 'Stone Quarry', group: 'Buildings', desc: 'Mines stone next to mountains. Trucks deliver it.', make: () => mesh(buildingGeometry('quarry')) },

  { id: 'road', name: 'Road', group: 'Roads', desc: 'Two lanes with sidewalks. Junctions get traffic lights and zebra crossings.', make: () => roadPiece(3, 3, (n, c) => { line(n, ROAD_TWO_LANE, c - 1, c, c + 1, c); line(n, ROAD_TWO_LANE, c, c - 1, c, c + 1); }) },
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
  { id: 'mountain', name: 'Mountain', group: 'Nature', desc: 'Stepped voxel mountain with a snowy peak.', make: () => mesh(mountainGeometry()) },
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
