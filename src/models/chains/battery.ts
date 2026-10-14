import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';

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
