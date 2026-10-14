import * as THREE from 'three';
import { shopGeometry } from './_shared';

export function clothesGeometry(): THREE.BufferGeometry {
  return shopGeometry('#efe2ef', '#b0478f', ['#3a6fd1', '#d9568f']);
}
