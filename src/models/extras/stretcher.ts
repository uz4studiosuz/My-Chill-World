import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { METAL } from './_shared';

/** Stretcher with a patient (carried by a paramedic). */
export function stretcherGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.08, 0.015, 0.26, 0, 0.1, 0.12, '#f2f4f6'),
    box(0.07, 0.03, 0.2, 0, 0.12, 0.13, '#6f9fc8'),
    box(0.05, 0.04, 0.05, 0, 0.125, 0.23, '#f1d2b0'),
    box(0.01, 0.01, 0.3, -0.045, 0.095, 0.12, METAL), box(0.01, 0.01, 0.3, 0.045, 0.095, 0.12, METAL),
  ]);
}
