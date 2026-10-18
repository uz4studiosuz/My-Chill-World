import * as THREE from 'three';
import { box, merge } from '../quality';

export function waterTowerGeometry(): THREE.BufferGeometry {
  const steel = '#8c9aa6', tank = '#5fa8d3';
  const parts = [
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#b9b5aa'),
    box(0.5, 0.36, 0.5, 0, 0.98, -0.05, tank),
    box(0.4, 0.08, 0.4, 0, 1.2, -0.05, '#4a8fbd'),
    box(0.2, 0.06, 0.2, 0, 1.27, -0.05, '#4a8fbd'),
    box(0.52, 0.04, 0.52, 0, 0.8, -0.05, steel),
    box(0.06, 0.6, 0.06, 0, 0.5, -0.05, steel),
    box(0.3, 0.2, 0.25, 0.22, 0.1, 0.22, '#d8d2c4'),
    box(0.08, 0.14, 0.02, 0.22, 0.07, 0.346, '#5a6470'),
    box(0.22, 0.1, 0.02, 0, 0.98, 0.205, '#ffffff'),
  ];
  for (const [x, z] of [[-0.2, -0.25], [0.2, -0.25], [-0.2, 0.15], [0.2, 0.15]]) parts.push(box(0.04, 0.8, 0.04, x, 0.4, z, steel));
  parts.push(box(0.44, 0.03, 0.03, 0, 0.45, -0.25, steel), box(0.44, 0.03, 0.03, 0, 0.45, 0.15, steel));
  return merge(parts);
}
