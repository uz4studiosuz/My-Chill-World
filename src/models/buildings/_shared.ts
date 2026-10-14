// Shared colours and helpers of the buildings models.
import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

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
export function shopGeometry(wall: string, awning: string, goods: string[]): THREE.BufferGeometry {
  const parts = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#bdb7aa'),
    box(0.8, 0.5, 0.6, 0, 0.26, -0.12, wall),
    box(0.86, 0.06, 0.66, 0, 0.54, -0.12, '#6d6a62'),
    box(0.84, 0.03, 0.26, 0, 0.42, 0.3, awning),
    box(0.84, 0.06, 0.02, 0, 0.39, 0.43, awning),
    box(0.62, 0.24, 0.02, 0, 0.2, 0.19, '#a8d0e6'),
    box(0.16, 0.3, 0.02, 0.3, 0.15, 0.19, '#5c3a21'),
    box(0.6, 0.1, 0.02, 0, 0.47, 0.19, '#f4f1ea'),
  ];
  goods.forEach((c, i) => parts.push(box(0.12, 0.08, 0.12, -0.3 + i * 0.15, 0.05, 0.36, c)));
  return merge(parts);
}
export const GRAVES_L2: [number, number][] = [];
for (const z of [-0.35, -0.05, 0.25, 0.55]) for (const x of [-0.78, -0.49, 0.49, 0.78]) GRAVES_L2.push([x, z]);
export const GRAVES_L3: [number, number][] = [];
for (const z of [-0.35, -0.05, 0.25, 0.55, 0.85]) for (const x of [-0.2, 0.2]) GRAVES_L3.push([x, z]);
for (const x of [-0.78, -0.62, -0.49, -0.35, 0.35, 0.49, 0.62, 0.78]) GRAVES_L3.push([x, 0.85]);
