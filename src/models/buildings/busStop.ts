import * as THREE from 'three';
import { box, merge } from '../quality';

export function busStopGeometry(): THREE.BufferGeometry {
  const parts = [
    // Paved concrete pad
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#8d8f93'),
    // Shelter back glass & frame
    box(0.65, 0.38, 0.02, 0, 0.2, -0.24, '#a8d0e6'),
    box(0.67, 0.03, 0.04, 0, 0.39, -0.24, '#3a6fd1'),
    // Side glass & frame
    box(0.02, 0.38, 0.32, -0.32, 0.2, -0.09, '#a8d0e6'),
    box(0.04, 0.03, 0.34, -0.32, 0.39, -0.09, '#3a6fd1'),
    // Canopy roof
    box(0.74, 0.03, 0.46, 0, 0.4, -0.05, '#3a6fd1'),
    // Support posts
    box(0.03, 0.4, 0.03, 0.32, 0.2, -0.24, '#4a5058'),
    box(0.03, 0.4, 0.03, -0.32, 0.2, -0.24, '#4a5058'),
    box(0.03, 0.4, 0.03, -0.32, 0.2, 0.14, '#4a5058'),
    // Wood bench
    box(0.44, 0.03, 0.14, 0.02, 0.11, -0.14, '#8a5a35'),
    box(0.03, 0.1, 0.14, -0.16, 0.05, -0.14, '#4a5058'),
    box(0.03, 0.1, 0.14, 0.2, 0.05, -0.14, '#4a5058'),
    // Bus stop yellow sign post & plate
    box(0.03, 0.48, 0.03, 0.34, 0.24, 0.28, '#4a5058'),
    box(0.12, 0.14, 0.02, 0.34, 0.47, 0.28, '#f1c232'),
    box(0.08, 0.07, 0.024, 0.34, 0.48, 0.28, '#3a6fd1'),
  ];
  return merge(parts);
}
