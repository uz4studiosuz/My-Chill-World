import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** One bicycle, small enough to stand in a row at the factory or under a rider (along z, wheels across x). */
function bikeParts(x: number, y: number, z: number, frame: string, rotY = 0): THREE.BufferGeometry[] {
  const parts = [
    shape('cylinder', 0.075, 0.012, 0.075, 0, 0.0375, 0.055, '#2a2d31', 'x', 12),
    shape('cylinder', 0.075, 0.012, 0.075, 0, 0.0375, -0.055, '#2a2d31', 'x', 12),
    box(0.012, 0.012, 0.1, 0, 0.065, 0, frame),
    box(0.012, 0.05, 0.012, 0, 0.055, -0.02, frame),
    box(0.012, 0.045, 0.012, 0, 0.06, 0.05, frame),
    box(0.03, 0.008, 0.035, 0, 0.083, -0.022, '#3b2a1e'),
    box(0.06, 0.008, 0.008, 0, 0.085, 0.05, '#9aa3ab'),
  ];
  const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
  parts.forEach((p) => p.applyMatrix4(m));
  return parts;
}

/** A bicycle for a rider (drawn under the walker). */
export function bikeGeometry(): THREE.BufferGeometry {
  return merge(bikeParts(0, 0, 0, '#d9443b'));
}

/** Bicycle factory: a saw-tooth workshop with a big wheel sign, and new bikes standing in a row outside. */
export function bikeFactoryGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b3ada2'),
    box(1.6, 0.36, 1.0, 0, 0.18, -0.4, '#d8cdb8'),
    box(0.3, 0.2, 0.02, -0.45, 0.13, 0.105, '#46505a'),
    box(0.3, 0.2, 0.02, 0.35, 0.13, 0.105, '#46505a'),
  ];
  // saw-tooth roof with skylights
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4;
    parts.push(shape('wedge', 0.4, 0.16, 1.0, x, 0.44, -0.4, '#5d8fb5', 'y', 4));
  }
  // the sign: a big wheel on a post
  parts.push(box(0.04, 0.4, 0.04, 0.82, 0.2, 0.25, '#5d6670'));
  parts.push(shape('torus', 0.32, 0.32, 0.05, 0.82, 0.5, 0.25, '#f2b33d', 'z', 16));
  // new bikes in a row
  const colors = ['#d9443b', '#3f6fb5', '#4f9a3e', '#f2b33d', '#8a3a8a'];
  for (let i = 0; i < 6; i++) parts.push(...bikeParts(-0.75 + i * 0.22, 0.02, 0.55, colors[i % colors.length], Math.PI / 2));
  return merge(parts);
}
