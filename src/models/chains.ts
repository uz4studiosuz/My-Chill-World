import * as THREE from 'three';
import { box, cylX, merge, shape } from '../utils/voxel';
import { moreCargo } from './chains2';

// Production-chain, service and street-life buildings, plus the cargo trucks carry. Models face +z.

const METAL = '#5d6670';
const PAVE = '#bdb7aa';

/** Military base (3×3): barracks, parade ground, flag, watchtower, a tank and a fence. */
export function militaryGeometry(): THREE.BufferGeometry {
  const khaki = '#6b7a4a', dark = '#3d4a2e';
  return merge([
    box(2.94, 0.02, 2.94, 0, 0.01, 0, '#a89f86'),
    box(1.6, 0.022, 1.2, 0.5, 0.012, 0.6, '#c9b88a'),
    // barracks
    box(1.1, 0.36, 0.6, -0.8, 0.18, -0.95, khaki),
    box(1.16, 0.06, 0.66, -0.8, 0.39, -0.95, dark),
    ...[-1.15, -0.95, -0.75, -0.55].map((x) => box(0.1, 0.08, 0.02, x, 0.22, -0.645, '#a8d0e6')),
    box(0.14, 0.2, 0.02, -0.3, 0.1, -0.645, '#3d3226'),
    box(0.8, 0.3, 0.5, 0.9, 0.15, -1.0, khaki),
    box(0.86, 0.05, 0.56, 0.9, 0.325, -1.0, dark),
    // flagpole and flag (blue-white-green)
    box(0.03, 0.9, 0.03, 0.5, 0.45, 0.1, '#cccccc'),
    box(0.3, 0.06, 0.01, 0.66, 0.84, 0.1, '#3a8fd1'), box(0.3, 0.06, 0.01, 0.66, 0.78, 0.1, '#f4f4f2'), box(0.3, 0.06, 0.01, 0.66, 0.72, 0.1, '#3a9a52'),
    // watchtower
    ...[[-1.3, 1.3], [-1.1, 1.3], [-1.3, 1.1], [-1.1, 1.1]].map(([x, z]) => box(0.03, 0.7, 0.03, x, 0.35, z, '#6b4a2e')),
    box(0.32, 0.04, 0.32, -1.2, 0.72, 1.2, '#6b4a2e'),
    box(0.34, 0.12, 0.34, -1.2, 0.82, 1.2, khaki),
    // tank
    box(0.5, 0.12, 0.3, 1.0, 0.1, 0.9, dark),
    box(0.54, 0.06, 0.34, 1.0, 0.04, 0.9, '#26292e'),
    box(0.26, 0.1, 0.22, 0.98, 0.21, 0.9, khaki),
    box(0.36, 0.035, 0.035, 0.76, 0.22, 0.9, dark),
    // jeep
    box(0.16, 0.08, 0.28, 0.2, 0.07, -0.25, khaki),
    // fence
    box(2.9, 0.12, 0.025, 0, 0.06, -1.46, '#8c8f94'), box(0.025, 0.12, 2.9, -1.46, 0.06, 0, '#8c8f94'), box(0.025, 0.12, 2.9, 1.46, 0.06, 0, '#8c8f94'),
    box(1.1, 0.12, 0.025, -0.9, 0.06, 1.46, '#8c8f94'), box(1.1, 0.12, 0.025, 0.9, 0.06, 1.46, '#8c8f94'),
    box(0.04, 0.3, 0.04, -0.33, 0.15, 1.46, '#d9443b'), box(0.04, 0.3, 0.04, 0.33, 0.15, 1.46, '#d9443b'),
  ]);
}

/** Landfill (2×2): a fenced pit with heaps of rubbish and a bulldozer. */
export function landfillGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#7a6f5a'),
    box(1.5, 0.02, 1.4, 0, 0.02, -0.15, '#5a5246'),
  ];
  const cols = ['#6d6a62', '#8a7d70', '#4f8a3a', '#b0478f', '#d9cfae', '#3a6fd1', '#5d544b'];
  for (let i = 0; i < 26; i++) {
    const x = -0.6 + ((i * 37) % 13) / 13 * 1.2, z = -0.7 + ((i * 53) % 11) / 11 * 1.1, h = 0.06 + ((i * 7) % 5) * 0.03;
    parts.push(box(0.16, h, 0.14, x, h / 2 + 0.02, z, cols[i % cols.length]));
  }
  parts.push(
    box(0.3, 0.1, 0.2, 0.55, 0.07, 0.6, '#e8a13a'), box(0.12, 0.1, 0.14, 0.52, 0.17, 0.6, '#e8a13a'), box(0.04, 0.08, 0.26, 0.74, 0.05, 0.6, '#5d6670'),
    box(1.94, 0.14, 0.025, 0, 0.07, -0.96, '#8c8f94'), box(0.025, 0.14, 1.94, -0.96, 0.07, 0, '#8c8f94'), box(0.025, 0.14, 1.94, 0.96, 0.07, 0, '#8c8f94'),
  );
  return merge(parts);
}

/** Recycling plant (2×2): sorting hall, conveyor and coloured bins. */
export function recyclingGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    box(1.2, 0.5, 0.8, -0.2, 0.25, -0.45, '#4c9a52'),
    box(1.26, 0.06, 0.86, -0.2, 0.53, -0.45, '#2d6a33'),
    shape('cylinder', 0.3, 0.6, 0.3, 0.7, 0.3, -0.5, '#cfd6dc'),
    box(0.4, 0.2, 0.02, -0.2, 0.3, -0.045, '#f2f4f6'),
    box(0.16, 0.16, 0.02, -0.2, 0.3, -0.04, '#4c9a52'),
    box(0.9, 0.04, 0.12, 0.2, 0.2, 0.15, METAL),
    box(0.02, 0.2, 0.02, -0.2, 0.1, 0.15, METAL), box(0.02, 0.2, 0.02, 0.6, 0.1, 0.15, METAL),
    ...[['#3a6fd1', -0.6], ['#f2c230', -0.35], ['#4c9a52', -0.1], ['#d9443b', 0.15]].map(([c, x]) => box(0.18, 0.18, 0.18, x as number, 0.09, 0.7, c as string)),
  ]);
}

/** Flour mill (2×2): a stone windmill (sails turn separately) and grain silos. */
export function millGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#c9b88a'),
    shape('cylinder', 0.6, 0.9, 0.6, -0.35, 0.45, -0.3, '#efe6d2', 'y', 12),
    shape('cone', 0.66, 0.35, 0.66, -0.35, 1.07, -0.3, '#8a5a35', 'y', 12),
    box(0.16, 0.24, 0.02, -0.35, 0.12, 0.005, '#6b4a2e'),
    box(0.1, 0.1, 0.02, -0.35, 0.5, 0.005, '#a8d0e6'),
    shape('cylinder', 0.32, 0.8, 0.32, 0.6, 0.4, -0.5, '#cfd6dc', 'y', 12),
    shape('dome', 0.32, 0.12, 0.32, 0.6, 0.86, -0.5, '#9aa3ab', 'y', 12),
    shape('cylinder', 0.32, 0.8, 0.32, 0.6, 0.4, 0.0, '#cfd6dc', 'y', 12),
    shape('dome', 0.32, 0.12, 0.32, 0.6, 0.86, 0.0, '#9aa3ab', 'y', 12),
    ...[0, 1, 2].map((i) => box(0.12, 0.1, 0.1, 0.2 + i * 0.14, 0.05, 0.65, '#f4f1ea')),
  ]);
}

/** Four windmill sails around the hub (rotated as one piece). */
export function millSailsGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.06, 0.06, 0.06, 0, 0, 0, '#6b4a2e'),
    box(0.06, 0.62, 0.015, 0, 0.34, 0, '#efe6d2'), box(0.06, 0.62, 0.015, 0, -0.34, 0, '#efe6d2'),
    box(0.62, 0.06, 0.015, 0.34, 0, 0, '#efe6d2'), box(0.62, 0.06, 0.015, -0.34, 0, 0, '#efe6d2'),
  ]);
}

/** Bakery (1×1): brick oven chimney, awning and a bread sign. */
export function bakeryGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.42, 0.56, 0, 0.21, -0.12, '#f1dcc6'),
    box(0.76, 0.06, 0.62, 0, 0.45, -0.12, '#a65e43'),
    box(0.12, 0.3, 0.12, 0.22, 0.58, -0.2, '#a65e43'),
    box(0.5, 0.18, 0.02, 0, 0.17, 0.165, '#a8d0e6'),
    box(0.74, 0.03, 0.16, 0, 0.32, 0.24, '#e8a13a'),
    box(0.74, 0.03, 0.16, 0, 0.3, 0.24, '#f4f1ea'),
    box(0.2, 0.08, 0.02, 0, 0.38, 0.165, '#6b4a2e'),
    shape('sphere', 0.12, 0.05, 0.07, 0, 0.385, 0.18, '#d9a04a'),
    ...[-0.25, 0.25].map((x) => box(0.12, 0.08, 0.12, x, 0.04, 0.38, '#8a5a35')),
  ]);
}

/** Sawmill (2×2): open saw shed, log pile and stacks of planks. */
export function sawmillGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b8a07a'),
    ...[[-0.8, -0.8], [0.2, -0.8], [-0.8, 0.0], [0.2, 0.0]].map(([x, z]) => box(0.05, 0.42, 0.05, x, 0.21, z, '#6b4a2e')),
    box(1.16, 0.05, 0.96, -0.3, 0.44, -0.4, '#8a5a35'),
    box(0.6, 0.12, 0.3, -0.3, 0.08, -0.4, METAL),
    cylX(0.08, 0.02, -0.3, 0.2, -0.4, '#cfd6dc', 12),
    box(0.4, 0.06, 0.08, -0.3, 0.17, -0.4, '#c98a5a'),
  ];
  for (let i = 0; i < 6; i++) parts.push(shape('cylinder', 0.6, 0.09, 0.09, 0.6, 0.06 + Math.floor(i / 3) * 0.09, -0.55 + (i % 3) * 0.1, '#8a5a35', 'x', 8));
  for (let i = 0; i < 5; i++) parts.push(box(0.5, 0.03, 0.18, 0.45, 0.03 + i * 0.035, 0.5, i % 2 ? '#e2c48e' : '#d4b27a'));
  for (let i = 0; i < 4; i++) parts.push(box(0.5, 0.03, 0.18, -0.35, 0.03 + i * 0.035, 0.55, i % 2 ? '#e2c48e' : '#d4b27a'));
  return merge(parts);
}

/** Battery storage (1×1): two container batteries with cooling fans. */
export function batteryGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.8, 0.3, 0.3, 0, 0.15, -0.2, '#e9edf0'), box(0.8, 0.3, 0.3, 0, 0.15, 0.2, '#e9edf0'),
    box(0.82, 0.03, 0.32, 0, 0.315, -0.2, '#3a6fd1'), box(0.82, 0.03, 0.32, 0, 0.315, 0.2, '#3a6fd1'),
    ...[-0.25, 0, 0.25].flatMap((x) => [shape('cylinder', 0.1, 0.02, 0.1, x, 0.335, -0.2, '#5d6670', 'y', 10), shape('cylinder', 0.1, 0.02, 0.1, x, 0.335, 0.2, '#5d6670', 'y', 10)]),
    box(0.1, 0.06, 0.02, -0.3, 0.2, 0.355, '#7be08f'), box(0.1, 0.06, 0.02, -0.3, 0.2, -0.045, '#7be08f'),
    box(0.04, 0.12, 0.04, 0.42, 0.06, 0.42, '#f2c230'),
  ]);
}

/** Coffee & ice-cream cart under a red-and-white umbrella. */
export function kioskGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, '#76b04f'),
    box(0.5, 0.022, 0.5, 0, 0.012, 0.05, PAVE),
    box(0.3, 0.16, 0.18, 0, 0.13, 0, '#d9443b'),
    box(0.32, 0.02, 0.2, 0, 0.22, 0, '#f4f1ea'),
    cylX(0.04, 0.02, -0.16, 0.04, 0.06, '#26292e', 10), cylX(0.04, 0.02, 0.16, 0.04, 0.06, '#26292e', 10),
    box(0.02, 0.36, 0.02, 0.1, 0.36, -0.05, '#cccccc'),
    shape('cone', 0.5, 0.12, 0.5, 0.1, 0.58, -0.05, '#f4f1ea', 'y', 8),
    shape('cone', 0.42, 0.1, 0.42, 0.1, 0.6, -0.05, '#d9443b', 'y', 8),
    box(0.05, 0.06, 0.05, -0.08, 0.26, 0.04, '#6b4a2e'), box(0.04, 0.05, 0.04, 0.02, 0.255, 0.04, '#f2c230'),
    box(0.08, 0.1, 0.06, -0.3, 0.05, 0.3, '#6b4a2e'), box(0.08, 0.1, 0.06, 0.3, 0.05, 0.3, '#6b4a2e'),
  ]);
}

/** Cargo on a truck bed, by kind (the truck bed sits around y = 0.15, z = -0.08). */
export type CargoKind = 'stone' | 'logs' | 'planks' | 'grain' | 'flour' | 'bread' | 'trash' | 'veg' | 'bricks' | 'steel' | 'milk' | 'dairy' | 'cotton' | 'corn';
export const CARGO_KINDS: CargoKind[] = ['stone', 'logs', 'planks', 'grain', 'flour', 'bread', 'trash', 'veg', 'bricks', 'steel', 'milk', 'dairy', 'cotton', 'corn'];

export function cargoOf(kind: CargoKind): THREE.BufferGeometry {
  switch (kind) {
    case 'bricks': case 'steel': case 'milk': case 'dairy': return moreCargo(kind);
    case 'logs': return merge([0, 1, 2, 3, 4].map((i) => shape('cylinder', 0.05, 0.05, 0.25, -0.05 + (i % 3) * 0.05, 0.17 + Math.floor(i / 3) * 0.045, -0.08, '#8a5a35', 'z', 8)));
    case 'planks': return merge([0, 1, 2, 3].map((i) => box(0.17, 0.022, 0.25, 0, 0.165 + i * 0.024, -0.08, i % 2 ? '#e2c48e' : '#d4b27a')));
    case 'grain': return merge([0, 1, 2, 3].map((i) => shape('sphere', 0.08, 0.06, 0.1, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#d9b45a', 'y', 8)));
    case 'flour': return merge([0, 1, 2, 3, 4, 5].map((i) => box(0.075, 0.05, 0.1, -0.04 + (i % 2) * 0.08, 0.18 + Math.floor(i / 4) * 0.05, -0.15 + (Math.floor(i / 2) % 2) * 0.12, '#f4f1ea')));
    case 'bread': return merge([0, 1, 2, 3].flatMap((i) => [box(0.08, 0.05, 0.11, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#8a5a35'), box(0.06, 0.02, 0.09, -0.04 + (i % 2) * 0.08, 0.21, -0.15 + Math.floor(i / 2) * 0.12, '#d9a04a')]));
    case 'cotton': return merge([0, 1, 2, 3].map((i) => box(0.08, 0.07, 0.11, -0.04 + (i % 2) * 0.08, 0.19, -0.15 + Math.floor(i / 2) * 0.12, i % 2 ? '#f4f4f2' : '#e6e3dc')));
    case 'corn': return merge([0, 1, 2, 3, 4, 5].map((i) => shape('cylinder', 0.035, 0.12, 0.035, -0.05 + (i % 3) * 0.05, 0.19, -0.14 + Math.floor(i / 3) * 0.1, '#e8c440', 'z', 8)));
    case 'trash': return merge([box(0.18, 0.11, 0.26, 0, 0.2, -0.08, '#3a7a42'), box(0.19, 0.02, 0.27, 0, 0.26, -0.08, '#2d5a32')]);
    case 'veg': return merge([0, 1, 2, 3].flatMap((i) => [box(0.08, 0.05, 0.11, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#c98a5a'), box(0.06, 0.02, 0.09, -0.04 + (i % 2) * 0.08, 0.21, -0.15 + Math.floor(i / 2) * 0.12, i % 2 ? '#d9443b' : '#5f9a3e')]));
    default: return merge([box(0.16, 0.07, 0.22, 0, 0.17, -0.08, '#aaa59b'), box(0.09, 0.05, 0.1, 0.02, 0.22, -0.1, '#bdb8ae')]);
  }
}

/** A small grey pigeon (instanced near benches and squares). */
export function pigeonGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.03, 0.025, 0.045, 0, 0.02, 0, '#8c8f94'),
    box(0.02, 0.02, 0.02, 0, 0.04, 0.025, '#5d6670'),
    box(0.008, 0.006, 0.01, 0, 0.038, 0.04, '#e8a13a'),
  ]);
}
