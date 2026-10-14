import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** More cargo: bricks, steel beams, a milk tank, dairy crates. */
export function moreCargo(kind: 'bricks' | 'steel' | 'milk' | 'dairy'): THREE.BufferGeometry {
  switch (kind) {
    case 'bricks': return merge([0, 1, 2, 3, 4, 5].map((i) => box(0.075, 0.04, 0.11, -0.04 + (i % 2) * 0.08, 0.17 + Math.floor(i / 4) * 0.045, -0.15 + (Math.floor(i / 2) % 2) * 0.12, i % 2 ? '#c4553d' : '#b24a35')));
    case 'steel': return merge([0, 1, 2].map((i) => box(0.03, 0.03, 0.27, -0.05 + i * 0.05, 0.17, -0.08, '#8c8f94')));
    case 'milk': return merge([shape('cylinder', 0.15, 0.13, 0.26, 0, 0.2, -0.08, '#e9edf0', 'z', 12)]);
    default: return merge([0, 1, 2, 3].flatMap((i) => [box(0.08, 0.05, 0.11, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#f4f1ea'), box(0.06, 0.02, 0.09, -0.04 + (i % 2) * 0.08, 0.21, -0.15 + Math.floor(i / 2) * 0.12, '#f2c230')]));
  }
}
