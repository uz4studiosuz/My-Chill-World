import * as THREE from 'three';

export function cinemaScreenGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(1.4, 0.74).translate(0, 0.59, -0.828);
}
