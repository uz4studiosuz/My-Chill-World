import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { PAVING, shrub } from './_shared';

/** Statue on a pedestal: a figure with a raised arm. */
export function statueGeometry(): THREE.BufferGeometry {
  const bronze = '#9a7b4f', stone = '#cfc8b6';
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVING),
    box(0.46, 0.08, 0.46, 0, 0.04, 0, stone),
    box(0.3, 0.3, 0.3, 0, 0.23, 0, '#e2dccd'),
    box(0.34, 0.04, 0.34, 0, 0.4, 0, stone),
    box(0.06, 0.16, 0.06, -0.04, 0.5, 0, bronze), box(0.06, 0.16, 0.06, 0.04, 0.5, 0, bronze),
    box(0.16, 0.2, 0.1, 0, 0.68, 0, bronze),
    box(0.1, 0.1, 0.1, 0, 0.83, 0, bronze),
    box(0.04, 0.2, 0.04, 0.1, 0.86, 0, bronze),
    box(0.04, 0.12, 0.04, -0.1, 0.62, 0.02, bronze),
    box(0.16, 0.06, 0.02, 0, 0.24, 0.155, '#d4af37'),
    ...shrub(-0.36, 0.36, 0.5), ...shrub(0.36, 0.36, 0.5),
  ]);
}
