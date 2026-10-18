import * as THREE from 'three';
import { box, merge } from '../quality';

export function cemeteryGeometry(): THREE.BufferGeometry {
  const wall = '#7d7a75', pillar = '#5f5d59', path = '#bdb7aa';
  const parts = [
    // base lawn
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#658a42'),
    // boundary walls
    box(1.9, 0.2, 0.06, 0, 0.1, -0.92, wall),
    box(0.06, 0.2, 1.9, -0.92, 0.1, 0, wall),
    box(0.06, 0.2, 1.9, 0.92, 0.1, 0, wall),
    box(0.68, 0.2, 0.06, -0.58, 0.1, 0.92, wall),
    box(0.68, 0.2, 0.06, 0.58, 0.1, 0.92, wall),
    // entrance gate pillars & arch
    box(0.12, 0.32, 0.12, -0.24, 0.16, 0.92, pillar),
    box(0.12, 0.32, 0.12, 0.24, 0.16, 0.92, pillar),
    box(0.5, 0.03, 0.03, 0, 0.3, 0.92, '#2f3136'),
    // central cobblestone walkway
    box(0.24, 0.012, 1.4, 0, 0.016, 0.22, path),
    // chapel / caretaker shed in the back
    box(0.5, 0.4, 0.45, 0, 0.21, -0.65, '#8c8880'),
    box(0.56, 0.14, 0.5, 0, 0.48, -0.65, '#4a433d'),
    box(0.04, 0.16, 0.04, 0, 0.62, -0.65, '#d4af37'),
    box(0.12, 0.04, 0.04, 0, 0.66, -0.65, '#d4af37'),
    box(0.14, 0.22, 0.02, 0, 0.11, -0.42, '#5c3a21'),
    // decorative corner cypress trees
    box(0.04, 0.16, 0.04, -0.74, 0.08, -0.74, '#4a3525'),
    box(0.2, 0.6, 0.2, -0.74, 0.42, -0.74, '#2d4a25'),
    box(0.12, 0.2, 0.12, -0.74, 0.78, -0.74, '#2d4a25'),
    box(0.04, 0.16, 0.04, 0.74, 0.08, -0.74, '#4a3525'),
    box(0.2, 0.6, 0.2, 0.74, 0.42, -0.74, '#2d4a25'),
    box(0.12, 0.2, 0.12, 0.74, 0.78, -0.74, '#2d4a25'),
  ];
  return merge(parts);
}
