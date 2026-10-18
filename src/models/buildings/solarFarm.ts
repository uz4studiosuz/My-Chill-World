import * as THREE from 'three';
import { box, merge } from '../quality';

export function solarFarmGeometry(): THREE.BufferGeometry {
  const parts = [box(1.9, 0.02, 1.9, 0, 0.01, 0, '#a9b07a')];
  for (const z of [-0.6, 0, 0.6]) for (const x of [-0.5, 0.5]) {
    parts.push(box(0.04, 0.14, 0.04, x, 0.07, z, '#6f7880'));
    parts.push(box(0.8, 0.03, 0.42, x, 0.17, z, '#25406e').rotateX(-0.35).translate(0, 0.02, 0));
  }
  return merge(parts);
}
