import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { door, lamp, windows } from '../details';

/**
 * Iron mine (2×2): a timbered tunnel mouth in a rock face, a steel headframe with its winding wheel,
 * a rail track on sleepers with ore carts, rusty ore heaps, a conveyor and the miners' office.
 */
export function ironMineGeometry(): THREE.BufferGeometry {
  const rock = '#6f6a63', timber = '#8a5a35', ore = '#a0522d', steel = '#5d6670';
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#8d7a68'),
    // the rock face with the tunnel and its timber frame
    box(0.9, 0.62, 0.6, -0.3, 0.31, -0.55, rock), box(0.7, 0.2, 0.5, -0.35, 0.72, -0.6, '#7d776e'),
    box(0.36, 0.36, 0.04, -0.3, 0.18, -0.24, '#1d1a17'),
    box(0.46, 0.06, 0.09, -0.3, 0.39, -0.23, timber), box(0.06, 0.38, 0.06, -0.51, 0.19, -0.23, timber), box(0.06, 0.38, 0.06, -0.09, 0.19, -0.23, timber),
    box(0.012, 0.03, 0.012, -0.3, 0.33, -0.2, '#ffe9a8'),
  ];
  // rails on sleepers from the tunnel to the yard
  for (let i = 0; i < 9; i++) parts.push(box(0.26, 0.015, 0.04, -0.3, 0.025, -0.15 + i * 0.13, '#6b4a2e'));
  parts.push(box(0.02, 0.02, 1.2, -0.38, 0.04, 0.38, '#5a5550'), box(0.02, 0.02, 1.2, -0.22, 0.04, 0.38, '#5a5550'));
  // two ore carts, one full at the tunnel, one in the yard
  for (const z of [0.0, 0.62]) parts.push(box(0.22, 0.1, 0.26, -0.3, 0.1, z, '#4a4f57'), box(0.2, 0.04, 0.24, -0.3, 0.17, z, ore), ...[-0.08, 0.08].flatMap((dz) => [-0.12, 0.12].map((dx) => shape('cylinder', 0.05, 0.02, 0.05, -0.3 + dx, 0.05, z + dz, '#26292e', 'x', 10))));
  parts.push(
    // the headframe: four legs, braces and the winding wheel on top
    ...[[0.25, -0.35], [0.55, -0.35], [0.25, -0.65], [0.55, -0.65]].map(([x, z]) => box(0.035, 0.9, 0.035, x, 0.45, z, steel)),
    ...[0.3, 0.6].map((y) => box(0.34, 0.025, 0.34, 0.4, y, -0.5, steel)),
    box(0.4, 0.04, 0.4, 0.4, 0.9, -0.5, steel),
    shape('torus', 0.3, 0.3, 0.05, 0.4, 1.06, -0.5, '#3a3f46', 'x', 18), shape('cylinder', 0.05, 0.06, 0.05, 0.4, 1.06, -0.5, '#8a8f98', 'x', 8),
    box(0.012, 0.18, 0.012, 0.4, 0.82, -0.32, '#26292e'),
    // ore heaps and the conveyor up to the top of one
    shape('cone', 0.5, 0.32, 0.5, 0.55, 0.17, 0.42, ore, 'y', 10), shape('cone', 0.32, 0.2, 0.32, 0.3, 0.11, 0.62, '#b5653a', 'y', 9),
    box(0.06, 0.03, 0.62, 0.55, 0.22, 0.05, steel), box(0.02, 0.2, 0.02, 0.55, 0.1, -0.15, steel),
    // the office: windows, a door and a red roof
    box(0.46, 0.4, 0.4, 0.62, 0.2, 0.0 - 0.0, '#c9b88a'), box(0.5, 0.05, 0.44, 0.62, 0.42, 0.0, '#6d4c3d'),
    ...windows('left', 0.62, 0.0, 0.23, 0.2, 0.24, 2, { w: 0.09, h: 0.09 }),
    ...door(0.62, 0.205, 0.1, 0.2, '#5c3a21'),
    ...lamp(-0.85, 0.85, 0.4), ...lamp(0.1, -0.15, 0.4),
  );
  return merge(parts);
}
