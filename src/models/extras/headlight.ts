import * as THREE from 'three';

/** Soft light cone in front of a car (headlights at night). */
export function headlightGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.26, 0.5).rotateX(-Math.PI / 2).translate(0, 0.036, 0.4);
  return g;
}
