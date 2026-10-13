import * as THREE from 'three';
import { box, cylX, merge, shape } from '../utils/voxel';

// Buildings of the second batch of chains and services. Models face +z.

const PAVE = '#bdb7aa';
const METAL = '#5d6670';

/** Pharmacy: white shop with a green cross. */
export function pharmacyGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.4, 0.55, 0, 0.2, -0.12, '#f4f4f2'),
    box(0.76, 0.05, 0.6, 0, 0.425, -0.12, '#2e8b57'),
    box(0.5, 0.18, 0.02, 0, 0.16, 0.16, '#a8d0e6'),
    box(0.16, 0.05, 0.03, 0, 0.36, 0.16, '#2e8b57'), box(0.05, 0.16, 0.03, 0, 0.36, 0.16, '#2e8b57'),
    box(0.74, 0.03, 0.14, 0, 0.3, 0.23, '#2e8b57'),
  ]);
}

/** Dairy: white hall, milk tanks and a cow sign. */
export function dairyGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    box(1.1, 0.45, 0.8, -0.3, 0.225, -0.4, '#f4f1ea'),
    box(1.16, 0.06, 0.86, -0.3, 0.48, -0.4, '#3a6fd1'),
    ...[-0.6, -0.3, 0, 0.3].map((x) => box(0.14, 0.12, 0.02, x - 0.3 + 0.3, 0.26, -0.005, '#a8d0e6')),
    box(0.2, 0.26, 0.02, -0.3, 0.13, -0.005, '#6b4a2e'),
    shape('cylinder', 0.3, 0.7, 0.3, 0.65, 0.35, -0.55, '#e9edf0', 'y', 14),
    shape('dome', 0.3, 0.1, 0.3, 0.65, 0.75, -0.55, '#cfd6dc', 'y', 14),
    shape('cylinder', 0.3, 0.7, 0.3, 0.65, 0.35, -0.1, '#e9edf0', 'y', 14),
    shape('dome', 0.3, 0.1, 0.3, 0.65, 0.75, -0.1, '#cfd6dc', 'y', 14),
    box(0.3, 0.16, 0.02, -0.3, 0.6, -0.005, '#f4f1ea'), box(0.08, 0.08, 0.025, -0.36, 0.6, -0.005, '#26292e'), box(0.06, 0.06, 0.025, -0.22, 0.62, -0.005, '#26292e'),
  ]);
}

/** Supermarket: wide glass front, sign and trolleys. */
export function supermarketGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#9d9d9a'),
    box(1.8, 0.5, 1.0, 0, 0.25, -0.45, '#e9edf0'),
    box(1.86, 0.06, 1.06, 0, 0.53, -0.45, '#d9443b'),
    box(1.5, 0.28, 0.02, 0, 0.18, 0.055, '#6f9fc8'),
    box(0.9, 0.12, 0.03, 0, 0.42, 0.06, '#d9443b'), box(0.7, 0.05, 0.035, 0, 0.42, 0.065, '#f4f4f2'),
    ...[-0.75, -0.45, 0.45, 0.75].map((x) => box(0.02, 0.012, 0.32, x, 0.016, 0.72, '#f4f4f2')),
    box(0.16, 0.08, 0.1, 0.0, 0.06, 0.3, METAL), box(0.16, 0.08, 0.1, 0.0, 0.06, 0.42, METAL),
  ]);
}

/** Brickworks: kiln with a tall chimney and stacks of red bricks. */
export function brickworksGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b8a07a'),
    box(1.0, 0.4, 0.7, -0.35, 0.2, -0.5, '#a65e43'),
    box(1.06, 0.06, 0.76, -0.35, 0.43, -0.5, '#6d4c3d'),
    shape('cylinder', 0.18, 1.1, 0.18, 0.5, 0.55, -0.6, '#8a4a35', 'y', 10),
    box(0.3, 0.24, 0.02, -0.35, 0.12, -0.145, '#26292e'),
  ];
  for (let i = 0; i < 8; i++) parts.push(box(0.28, 0.07, 0.18, -0.6 + (i % 4) * 0.32, 0.04 + Math.floor(i / 4) * 0.075, 0.5, i % 2 ? '#c4553d' : '#b24a35'));
  return merge(parts);
}

/** Steel mill: blast furnace, hall and glowing slag. */
export function steelmillGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#8c8f94'),
    box(1.1, 0.5, 0.8, -0.35, 0.25, -0.45, '#5d6670'),
    box(1.16, 0.06, 0.86, -0.35, 0.53, -0.45, '#3d4148'),
    shape('cylinder', 0.4, 1.0, 0.4, 0.55, 0.5, -0.45, '#6f7880', 'y', 12),
    shape('cone', 0.4, 0.2, 0.4, 0.55, 1.1, -0.45, '#3d4148', 'y', 12),
    shape('cylinder', 0.12, 0.6, 0.12, 0.85, 1.3, -0.7, '#4a5058', 'y', 8),
    box(0.4, 0.04, 0.3, 0.4, 0.03, 0.5, '#ff7a1a'),
    ...[0, 1, 2].map((i) => box(0.6, 0.04, 0.06, -0.4, 0.03 + i * 0.045, 0.55, '#9aa3ab')),
  ]);
}

/** Sewage treatment: round settling tanks with water and a pump house. */
export function sewageGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    shape('cylinder', 0.8, 0.14, 0.8, -0.45, 0.07, -0.45, '#cfc8b6', 'y', 20),
    shape('cylinder', 0.68, 0.145, 0.68, -0.45, 0.075, -0.45, '#6b8a5a', 'y', 20),
    shape('cylinder', 0.8, 0.14, 0.8, 0.45, 0.07, -0.45, '#cfc8b6', 'y', 20),
    shape('cylinder', 0.68, 0.145, 0.68, 0.45, 0.075, -0.45, '#5f8fa0', 'y', 20),
    box(0.5, 0.3, 0.4, 0.4, 0.15, 0.5, '#e9edf0'), box(0.54, 0.04, 0.44, 0.4, 0.32, 0.5, '#3a6fd1'),
    cylX(0.04, 1.2, -0.1, 0.06, 0.1, METAL, 8),
  ]);
}

/** Coal mine: headframe tower, coal heap and a cart. */
export function coalmineGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#5a5246'),
    ...[[-0.5, -0.6], [-0.1, -0.6], [-0.5, -0.2], [-0.1, -0.2]].map(([x, z]) => box(0.05, 0.9, 0.05, x, 0.45, z, '#3d4148')),
    box(0.5, 0.05, 0.5, -0.3, 0.9, -0.4, '#3d4148'),
    cylX(0.14, 0.04, -0.3, 1.0, -0.4, '#8c8f94', 14),
    box(0.5, 0.25, 0.4, 0.5, 0.125, -0.5, '#6d6a62'),
    shape('cone', 0.8, 0.3, 0.7, 0.3, 0.15, 0.45, '#26292e', 'y', 10),
    box(0.2, 0.1, 0.14, -0.5, 0.08, 0.5, '#8a5a35'),
  ]);
}

/** Coal power plant: boiler hall, two cooling towers. */
export function coalplantGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#8c8f94'),
    box(0.9, 0.5, 0.7, -0.45, 0.25, 0.3, '#9aa3ab'),
    box(0.96, 0.05, 0.76, -0.45, 0.525, 0.3, '#5d6670'),
    shape('cylinder', 0.12, 1.1, 0.12, -0.75, 0.55, 0.0, '#c4553d', 'y', 8),
    shape('cone', 0.75, 1.0, 0.75, 0.45, 0.5, -0.45, '#cfd6dc', 'y', 16),
    shape('cylinder', 0.48, 0.25, 0.48, 0.45, 0.9, -0.45, '#cfd6dc', 'y', 16),
    shape('cone', 0.6, 0.8, 0.6, 0.55, 0.4, 0.45, '#cfd6dc', 'y', 16),
    shape('cylinder', 0.38, 0.2, 0.38, 0.55, 0.72, 0.45, '#cfd6dc', 'y', 16),
    shape('cone', 0.4, 0.15, 0.4, -0.2, 0.08, -0.6, '#26292e', 'y', 8),
  ]);
}

/** Hydro dam: a concrete wall with sluices and a turbine house. */
export function hydroGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#9d9d9a'),
    box(1.9, 0.5, 0.4, 0, 0.1, -0.5, '#cfc8b6'),
    ...[-0.6, -0.2, 0.2, 0.6].map((x) => box(0.2, 0.16, 0.42, x, 0.16, -0.5, '#4fa3d1')),
    box(1.9, 0.05, 0.44, 0, 0.375, -0.5, '#a9a294'),
    box(0.8, 0.3, 0.5, 0.3, 0.15, 0.4, '#e9edf0'), box(0.84, 0.04, 0.54, 0.3, 0.32, 0.4, '#3a6fd1'),
    ...[0, 1, 2].map((i) => box(0.03, 0.4, 0.03, -0.6 + i * 0.15, 0.2, 0.5, METAL)),
  ]);
}

/** More cargo: bricks, steel beams, a milk tank, dairy crates. */
export function moreCargo(kind: 'bricks' | 'steel' | 'milk' | 'dairy'): THREE.BufferGeometry {
  switch (kind) {
    case 'bricks': return merge([0, 1, 2, 3, 4, 5].map((i) => box(0.075, 0.04, 0.11, -0.04 + (i % 2) * 0.08, 0.17 + Math.floor(i / 4) * 0.045, -0.15 + (Math.floor(i / 2) % 2) * 0.12, i % 2 ? '#c4553d' : '#b24a35')));
    case 'steel': return merge([0, 1, 2].map((i) => box(0.03, 0.03, 0.27, -0.05 + i * 0.05, 0.17, -0.08, '#8c8f94')));
    case 'milk': return merge([shape('cylinder', 0.15, 0.13, 0.26, 0, 0.2, -0.08, '#e9edf0', 'z', 12)]);
    default: return merge([0, 1, 2, 3].flatMap((i) => [box(0.08, 0.05, 0.11, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#f4f1ea'), box(0.06, 0.02, 0.09, -0.04 + (i % 2) * 0.08, 0.21, -0.15 + Math.floor(i / 2) * 0.12, '#f2c230')]));
  }
}
