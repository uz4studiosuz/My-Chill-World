import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function marketGeometry(): THREE.BufferGeometry {
  const colors = ['#d9443b', '#3a6fd1', '#f1c232', '#4c9a52'];
  const parts: THREE.BufferGeometry[] = [box(1.9, 0.02, 1.9, 0, 0.01, 0, '#c9bf9d')];
  [-0.6, 0.0, 0.6].forEach((x, i) => {
    parts.push(box(0.5, 0.2, 0.34, x, 0.1, -0.4, '#8a5a35'));
    parts.push(box(0.58, 0.05, 0.5, x, 0.5, -0.36, colors[i]));
    parts.push(box(0.04, 0.5, 0.04, x - 0.26, 0.25, -0.18, '#cfc8b6'));
    parts.push(box(0.04, 0.5, 0.04, x + 0.26, 0.25, -0.18, '#cfc8b6'));
    parts.push(box(0.1, 0.07, 0.1, x - 0.12, 0.24, -0.4, '#e85a3a'));
    parts.push(box(0.1, 0.07, 0.1, x + 0.1, 0.24, -0.4, '#7cc24a'));
  });
  [-0.45, 0.45].forEach((x, i) => {
    parts.push(box(0.5, 0.2, 0.34, x, 0.1, 0.45, '#8a5a35'));
    parts.push(box(0.58, 0.05, 0.5, x, 0.5, 0.49, colors[(i + 2) % 4]));
    parts.push(box(0.04, 0.5, 0.04, x - 0.26, 0.25, 0.67, '#cfc8b6'));
    parts.push(box(0.04, 0.5, 0.04, x + 0.26, 0.25, 0.67, '#cfc8b6'));
  });
  parts.push(box(0.5, 0.16, 0.5, 0.0, 0.08, 0.1, '#e0d3a8'));
  return merge(parts);
}
