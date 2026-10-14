import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** Warehouse: a long shed with a curved roof, loading doors, a ramp, crates, sacks and barrels outside. */
export function warehouseGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#a9a49a'),
    box(1.7, 0.42, 1.1, 0, 0.21, -0.35, '#b9845a'),
    shape('arch', 1.76, 0.3, 1.16, 0, 0.57, -0.35, '#7d8a94'),
    box(1.76, 0.03, 1.16, 0, 0.435, -0.35, '#5d6670'),
    // two loading doors and a dock
    ...[-0.45, 0.45].flatMap((x) => [box(0.42, 0.3, 0.02, x, 0.17, 0.205, '#5d6670'), ...[0.06, 0.12, 0.18, 0.24].map((y) => box(0.4, 0.008, 0.025, x, y, 0.21, '#46505a'))]),
    box(1.6, 0.06, 0.22, 0, 0.03, 0.32, '#8e8a83'),
    box(0.12, 0.18, 0.02, 0, 0.22, 0.205, '#f2b33d'),
  ];
  // crates, sacks and barrels on the yard
  for (let i = 0; i < 5; i++) parts.push(box(0.14, 0.12, 0.14, -0.8 + i * 0.16, 0.08, 0.62, i % 2 ? '#c49a63' : '#a8794d'));
  for (let i = 0; i < 3; i++) parts.push(box(0.14, 0.12, 0.14, -0.72 + i * 0.16, 0.2, 0.62, '#b88a55'));
  for (let i = 0; i < 4; i++) parts.push(shape('sphere', 0.13, 0.08, 0.1, 0.3 + (i % 2) * 0.14, 0.06 + Math.floor(i / 2) * 0.07, 0.6, '#e8dcc0', 'y', 8));
  for (let i = 0; i < 3; i++) parts.push(shape('cylinder', 0.1, 0.14, 0.1, 0.62 + i * 0.12, 0.08, 0.66, '#4f7d4a', 'y', 10));
  return merge(parts);
}
