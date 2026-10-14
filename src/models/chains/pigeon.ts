import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** A small grey pigeon (instanced near benches and squares). */
export function pigeonGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.03, 0.025, 0.045, 0, 0.02, 0, '#8c8f94'),
    box(0.02, 0.02, 0.02, 0, 0.04, 0.025, '#5d6670'),
    box(0.008, 0.006, 0.01, 0, 0.038, 0.04, '#e8a13a'),
  ]);
}
