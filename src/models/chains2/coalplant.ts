import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** Coal power plant: boiler hall, two cooling towers. */
export function coalplantGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#8c8f94'),
    box(0.9, 0.5, 0.7, -0.45, 0.25, 0.3, '#9aa3ab'),
    box(0.96, 0.05, 0.76, -0.45, 0.525, 0.3, '#5d6670'),
    shape('cylinder', 0.12, 1.1, 0.12, -0.75, 0.55, 0.0, '#c4553d', 'y', 8),
    shape('cone', 0.75, 1.0, 0.75, 0.45, 0.5, -0.45, '#cfd6dc', 'y', 16),
    shape('cylinder', 0.48, 0.25, 0.48, 0.45, 0.9, -0.45, '#cfd6dc', 'y', 16),
    shape('cone', 0.6, 0.8, 0.6, 0.55, 0.4, 0.45, '#cfd6dc', 'y', 16),
    shape('cylinder', 0.38, 0.2, 0.38, 0.55, 0.72, 0.45, '#cfd6dc', 'y', 16),
    shape('cone', 0.4, 0.15, 0.4, -0.2, 0.08, -0.6, '#26292e', 'y', 8),
  ]);
}
