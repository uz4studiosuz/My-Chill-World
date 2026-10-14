import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { GOLD } from './_shared';

/** The carousel top (turns around y). */
export function carouselGeometry(): THREE.BufferGeometry {
  const parts = [
    shape('cylinder', 0.1, 0.55, 0.1, 0, 0.36, 0, '#f2b33d', 'y', 10),
    shape('cone', 1.0, 0.3, 1.0, 0, 0.78, 0, '#d9443b', 'y', 16),
    shape('cylinder', 1.0, 0.06, 1.0, 0, 0.62, 0, '#f4f1ea', 'y', 16),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62;
    parts.push(shape('cylinder', 0.02, 0.5, 0.02, x, 0.36, z, GOLD, 'y', 6));
    parts.push(box(0.1, 0.1, 0.22, x, 0.24, z, i % 2 ? '#f4f4f2' : '#8a5a35').rotateY(0));
  }
  return merge(parts);
}
