import * as THREE from 'three';
import { shopGeometry } from './_shared';

export function groceryGeometry(): THREE.BufferGeometry {
  return shopGeometry('#f1e4c4', '#4c9a52', ['#e85a3a', '#f1c232', '#7cc24a']);
}
