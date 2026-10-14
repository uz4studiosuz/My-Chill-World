import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function parkingGeometry(): THREE.BufferGeometry {
  const line = '#f2f2ee', curb = '#cdc9bd';
  const parts = [
    box(1.92, 0.03, 1.92, 0, 0.015, 0, '#565a62'),
    box(1.96, 0.05, 0.04, 0, 0.025, -0.97, curb),
    box(0.04, 0.05, 1.96, -0.97, 0.025, 0, curb),
    box(0.04, 0.05, 1.96, 0.97, 0.025, 0, curb),
    box(0.03, 0.6, 0.03, -0.92, 0.3, 0.08, '#8c8f94'),
    box(0.12, 0.03, 0.07, -0.87, 0.6, 0.08, '#ffe9a8'),
    box(0.03, 0.6, 0.03, 0.92, 0.3, 0.08, '#8c8f94'),
    box(0.12, 0.03, 0.07, 0.87, 0.6, 0.08, '#ffe9a8'),
    box(0.03, 0.45, 0.03, 0.9, 0.22, 0.92, '#8c8f94'),
    box(0.2, 0.2, 0.02, 0.9, 0.5, 0.92, '#2f6fd6'),
    box(0.06, 0.1, 0.021, 0.88, 0.5, 0.925, '#ffffff'),
  ];
  for (const x of [-0.96, -0.48, 0, 0.48, 0.96]) {
    parts.push(box(0.025, 0.005, 0.42, x, 0.033, -0.55, line));
    parts.push(box(0.025, 0.005, 0.42, x, 0.033, 0.7, line));
  }
  return merge(parts);
}
