import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function fountainJetGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.04, 0.3, 0.04, 0, 0.4, 0, '#bfe3ff'),
    box(0.12, 0.05, 0.12, 0, 0.55, 0, '#d8efff'),
    box(0.3, 0.03, 0.03, 0, 0.36, 0, '#bfe3ff'),
    box(0.03, 0.03, 0.3, 0, 0.36, 0, '#bfe3ff'),
  ]);
}
