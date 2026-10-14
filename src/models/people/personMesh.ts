import * as THREE from 'three';
import { personGeometry } from './person';
import { babyGeometry } from './baby';

export function personMesh(variant: number, scale = 1, baby = false) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  g.add(new THREE.Mesh(personGeometry(variant), mat));
  if (baby) g.add(new THREE.Mesh(babyGeometry(), mat));
  g.scale.setScalar(scale);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
