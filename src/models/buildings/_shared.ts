// Shared colours and helpers of the buildings models.
import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { bench, door, parapet, planter, shopFront, sign, windows } from '../details';

// All models face +z (front door towards the road). Footprint: size 1 → ±0.5, size 2 → ±1.
export const WALLS = ['#efe6d2', '#dbe5ec', '#f1dcc6', '#e8e0f0'];
export const ROOFS = ['#c4553d', '#3f6fb5', '#6d4c3d', '#4f7d4a'];
export const GLASS = '#a8d0e6';
export const GRAVE_OFFSETS: [number, number][] = [
  [-0.62, -0.2], [-0.35, -0.2], [0.35, -0.2], [0.62, -0.2],
  [-0.62, 0.1],  [-0.35, 0.1],  [0.35, 0.1],  [0.62, 0.1],
  [-0.62, 0.4],  [-0.35, 0.4],  [0.35, 0.4],  [0.62, 0.4],
  [-0.62, 0.7],  [-0.35, 0.7],  [0.35, 0.7],  [0.62, 0.7],
];
export const tree = (x: number, z: number, s = 1): THREE.BufferGeometry[] => [
  box(0.06 * s, 0.22 * s, 0.06 * s, x, 0.11 * s, z, '#6b4a2e'),
  box(0.3 * s, 0.26 * s, 0.3 * s, x, 0.33 * s, z, '#4f8a3a'),
  box(0.2 * s, 0.2 * s, 0.2 * s, x, 0.55 * s, z, '#6faa45'),
];
/**
 * A corner shop: two storeys, a striped awning over the shop window with goods on a stand outside,
 * a sign, a flat with a balcony upstairs, a parapet and a vent on the roof.
 */
export function shopGeometry(wall: string, awning: string, goods: string[]): THREE.BufferGeometry {
  const stripes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const x = -0.38 + i * 0.095, c = i % 2 ? '#f4f1ea' : awning;
    stripes.push(box(0.095, 0.025, 0.24, x, 0.37, 0.3, c), box(0.095, 0.05, 0.012, x, 0.335, 0.42, c));
  }
  const parts = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#bdb7aa'),
    box(0.8, 0.66, 0.6, 0, 0.33, -0.12, wall),
    box(0.82, 0.04, 0.62, 0, 0.02, -0.12, '#8d8a83'),
    box(0.82, 0.025, 0.62, 0, 0.42, -0.12, '#cfc8b6'),
    box(0.84, 0.04, 0.64, 0, 0.68, -0.12, '#6d6a62'),
    box(0.78, 0.012, 0.58, 0, 0.705, -0.12, '#8a8f98'),
    ...parapet(0, -0.12, 0.84, 0.64, 0.7, '#6d6a62'),
    shape('cylinder', 0.04, 0.08, 0.04, 0.25, 0.74, -0.25, '#8a8f98', 'y', 8),
    ...shopFront(-0.08, 0.05, 0.185, 0.52, 0.24),
    ...door(0.28, 0.185, 0.12, 0.25, '#5c3a21', { glass: true }),
    ...stripes,
    ...sign(-0.05, 0.4, 0.19, 0.5, 0.035, '#26292e', '#f4f1ea'),
    // the flat upstairs: windows, a small balcony with a railing and flowers
    ...windows('front', 0, -0.12, 0.4, 0.3, 0.55, 3, { w: 0.12, h: 0.13 }),
    box(0.26, 0.02, 0.08, -0.26, 0.47, 0.22, '#cfc8b6'), box(0.26, 0.05, 0.01, -0.26, 0.5, 0.26, '#3a3f46'),
    box(0.2, 0.03, 0.03, -0.26, 0.495, 0.24, '#e85a7a'),
    ...windows('left', 0, -0.12, 0.4, 0.3, 0.55, 2, { w: 0.1, h: 0.12 }), ...windows('right', 0, -0.12, 0.4, 0.3, 0.55, 2, { w: 0.1, h: 0.12 }),
    // a stand with goods under the awning, a bench and a planter
    box(0.36, 0.05, 0.12, -0.18, 0.06, 0.36, '#8a5a35'), box(0.36, 0.012, 0.12, -0.18, 0.09, 0.36, '#6b4a2e'),
    ...bench(0.3, 0.42), ...planter(-0.42, 0.42),
  ];
  goods.forEach((c, i) => parts.push(box(0.09, 0.05, 0.09, -0.3 + i * 0.11, 0.115, 0.36, c)));
  return merge(parts);
}
export const GRAVES_L2: [number, number][] = [];
for (const z of [-0.35, -0.05, 0.25, 0.55]) for (const x of [-0.78, -0.49, 0.49, 0.78]) GRAVES_L2.push([x, z]);
export const GRAVES_L3: [number, number][] = [];
for (const z of [-0.35, -0.05, 0.25, 0.55, 0.85]) for (const x of [-0.2, 0.2]) GRAVES_L3.push([x, z]);
for (const x of [-0.78, -0.62, -0.49, -0.35, 0.35, 0.49, 0.62, 0.78]) GRAVES_L3.push([x, 0.85]);
