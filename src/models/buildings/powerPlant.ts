import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { door, parapet, windows } from '../details';

/** Wood power plant: a brick boiler house with arched windows, a tall banded chimney, a transformer yard and a log pile. */
export function powerPlantGeometry(): THREE.BufferGeometry {
  const brick = '#a65e43', dark = '#5a5f66', trim = '#d2b59a';
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#9d9d9a'),
    // boiler house with a stone plinth, pilasters, a cornice and a parapet
    box(1.1, 0.55, 0.9, -0.3, 0.275, -0.35, brick), box(1.12, 0.05, 0.92, -0.3, 0.025, -0.35, '#8d8a83'),
    ...[-0.82, -0.56, -0.3, -0.04, 0.22].map((x) => box(0.05, 0.53, 0.02, x, 0.27, 0.108, '#94523a')),
    box(1.16, 0.06, 0.96, -0.3, 0.58, -0.35, dark), box(1.1, 0.012, 0.9, -0.3, 0.615, -0.35, '#7d828a'),
    ...parapet(-0.3, -0.35, 1.16, 0.96, 0.61, dark),
    ...windows('front', -0.3, -0.35, 0.55, 0.45, 0.4, 4, { w: 0.13, h: 0.14, frame: trim }),
    ...windows('left', -0.3, -0.35, 0.55, 0.45, 0.4, 3, { w: 0.13, h: 0.14, frame: trim }),
    box(0.3, 0.28, 0.02, -0.3, 0.14, 0.105, '#3d4148'), ...[0.07, 0.14, 0.21].map((y) => box(0.28, 0.008, 0.025, -0.3, y, 0.11, '#2a2e33')),
    ...door(-0.68, 0.105, 0.11, 0.22, '#5c3a21'),
    // the chimney: brick with darker bands and a cap
    box(0.2, 1.3, 0.2, 0.45, 0.65, -0.55, brick),
    ...[0.5, 0.9].map((y) => box(0.22, 0.05, 0.22, 0.45, y, -0.55, '#7d4433')),
    box(0.24, 0.06, 0.24, 0.45, 1.33, -0.55, dark),
    // the transformer yard: a fenced transformer and a pylon
    box(0.3, 0.3, 0.3, 0.55, 0.15, 0.1, '#8c8f94'), box(0.36, 0.04, 0.36, 0.55, 0.32, 0.1, '#6f7378'),
    ...[0.0, 0.1, 0.2].map((z) => box(0.02, 0.24, 0.012, 0.71, 0.14, z, '#6d737b')),
    ...[0.48, 0.62].map((x) => shape('cylinder', 0.03, 0.1, 0.03, x, 0.39, 0.1, '#c9a26b', 'y', 8)),
    box(0.03, 0.5, 0.03, 0.75, 0.25, 0.55, '#6f7378'), box(0.25, 0.03, 0.03, 0.75, 0.48, 0.55, '#6f7378'), box(0.16, 0.025, 0.025, 0.75, 0.4, 0.55, '#6f7378'),
    ...[0.32, 0.56, 0.8].map((x) => box(0.012, 0.012, 0.36, x, 0.42, 0.35, '#3a3f46')),
  ];
  // the log pile under a little roof
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) parts.push(shape('cylinder', 0.06, 0.4, 0.06, -0.85 + i * 0.07 + j * 0.035, 0.03 + j * 0.055, 0.55, j % 2 ? '#8a5a35' : '#9c6a40', 'z', 8));
  parts.push(box(0.4, 0.02, 0.5, -0.75, 0.24, 0.55, '#6b4a2e'), box(0.02, 0.24, 0.02, -0.93, 0.12, 0.33, '#6b4a2e'), box(0.02, 0.24, 0.02, -0.57, 0.12, 0.33, '#6b4a2e'));
  return merge(parts);
}
