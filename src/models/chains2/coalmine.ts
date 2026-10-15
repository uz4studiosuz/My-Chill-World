import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { door, lamp, windows } from '../details';

/** Coal mine: a braced headframe with its winding wheel, the winding house, a coal heap fed by a conveyor, carts on rails. */
export function coalmineGeometry(): THREE.BufferGeometry {
  const steel = '#3d4148', coal = '#26292e';
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#5a5246'),
    // the headframe: legs, cross braces at two levels, the platform and the wheel
    ...[[-0.5, -0.6], [-0.1, -0.6], [-0.5, -0.2], [-0.1, -0.2]].map(([x, z]) => box(0.05, 0.9, 0.05, x, 0.45, z, steel)),
    ...[0.3, 0.6].flatMap((y) => [box(0.42, 0.025, 0.025, -0.3, y, -0.6, steel), box(0.42, 0.025, 0.025, -0.3, y, -0.2, steel), box(0.025, 0.025, 0.42, -0.5, y, -0.4, steel), box(0.025, 0.025, 0.42, -0.1, y, -0.4, steel)]),
    box(0.5, 0.05, 0.5, -0.3, 0.9, -0.4, steel),
    shape('torus', 0.3, 0.3, 0.05, -0.3, 1.06, -0.4, '#5d6670', 'x', 18), cylX(0.14, 0.04, -0.3, 1.06, -0.4, '#8c8f94', 14),
    box(0.012, 0.16, 0.012, -0.3, 0.84, -0.22, '#1d1a17'),
    // the shaft head at the foot of the frame
    box(0.36, 0.14, 0.36, -0.3, 0.07, -0.4, '#6d6a62'), box(0.2, 0.12, 0.012, -0.3, 0.08, -0.215, '#1d1a17'),
    // the winding house with windows and a door, cables to the wheel
    box(0.5, 0.3, 0.4, 0.5, 0.15, -0.5, '#6d6a62'), box(0.54, 0.04, 0.44, 0.5, 0.32, -0.5, '#4a4f57'),
    ...windows('front', 0.5, -0.5, 0.25, 0.2, 0.18, 2, { w: 0.09, h: 0.09, frame: '#9aa3ab' }),
    ...door(0.36, -0.29, 0.08, 0.18, '#3a3f46'),
    box(0.012, 0.012, 0.8, 0.1, 0.62, -0.45, '#1d1a17'),
    // the coal heap, the conveyor feeding it and a loading hopper
    shape('cone', 0.8, 0.3, 0.7, 0.3, 0.15, 0.45, coal, 'y', 12), shape('cone', 0.45, 0.18, 0.4, 0.15, 0.1, 0.7, '#33363b', 'y', 10),
    box(0.06, 0.03, 0.7, 0.3, 0.32, 0.0, '#5d6670'), box(0.02, 0.3, 0.02, 0.3, 0.15, -0.25, '#5d6670'),
    box(0.2, 0.14, 0.2, 0.78, 0.2, 0.25, '#4a4f57'), ...[[0.7, 0.17], [0.86, 0.17], [0.7, 0.33], [0.86, 0.33]].map(([x, z]) => box(0.025, 0.14, 0.025, x, 0.07, z, steel)),
  ];
  // rails and coal carts
  for (let i = 0; i < 8; i++) parts.push(box(0.24, 0.012, 0.035, -0.5, 0.022, 0.0 + i * 0.12, '#6b4a2e'));
  parts.push(box(0.018, 0.018, 1.0, -0.57, 0.035, 0.42, '#5a5550'), box(0.018, 0.018, 1.0, -0.43, 0.035, 0.42, '#5a5550'));
  for (const z of [0.3, 0.7]) parts.push(box(0.2, 0.1, 0.24, -0.5, 0.09, z, '#8a5a35'), shape('dome', 0.18, 0.05, 0.22, -0.5, 0.14, z, coal, 'y', 8));
  parts.push(...lamp(0.85, -0.05, 0.42), ...lamp(-0.85, 0.85, 0.42));
  return merge(parts);
}
