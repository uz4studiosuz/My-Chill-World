import * as THREE from 'three';
import { box, merge } from '../utils/voxel';

// People face +z. One tile ≈ 6 m, so an adult is ~0.17 tiles tall.

const SKIN = ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3b'];
const SHIRTS = ['#3a6fd1', '#4c9a52', '#d9443b', '#e8a13a'];
const DRESSES = ['#d9443b', '#8f5bd6', '#e07ba8', '#2f8f8f'];

function maleShape(shirt: string, skin: string) {
  return merge([
    box(0.022, 0.064, 0.026, -0.014, 0.038, 0, '#3b4a63'),
    box(0.022, 0.064, 0.026, 0.014, 0.038, 0, '#3b4a63'),
    box(0.024, 0.01, 0.034, -0.014, 0.005, 0.004, '#2a2420'),
    box(0.024, 0.01, 0.034, 0.014, 0.005, 0.004, '#2a2420'),
    box(0.06, 0.065, 0.034, 0, 0.1, 0, shirt),
    box(0.062, 0.008, 0.036, 0, 0.07, 0, '#3a2a20'),
    box(0.03, 0.008, 0.036, 0, 0.13, 0.001, '#f2efe2'),
    box(0.016, 0.052, 0.02, -0.039, 0.102, 0, shirt),
    box(0.016, 0.052, 0.02, 0.039, 0.102, 0, shirt),
    box(0.014, 0.012, 0.016, -0.039, 0.07, 0, skin),
    box(0.014, 0.012, 0.016, 0.039, 0.07, 0, skin),
    box(0.04, 0.04, 0.04, 0, 0.153, 0, skin),
    box(0.006, 0.006, 0.004, -0.009, 0.157, 0.021, '#26292e'),
    box(0.006, 0.006, 0.004, 0.009, 0.157, 0.021, '#26292e'),
    box(0.042, 0.012, 0.042, 0, 0.176, -0.002, '#3a2a20'),
    box(0.042, 0.02, 0.008, 0, 0.165, -0.019, '#3a2a20'),
  ]);
}

function femaleShape(dress: string, skin: string) {
  return merge([
    box(0.018, 0.04, 0.022, -0.012, 0.02, 0, skin),
    box(0.018, 0.04, 0.022, 0.012, 0.02, 0, skin),
    box(0.066, 0.05, 0.04, 0, 0.065, 0, dress),
    box(0.054, 0.05, 0.032, 0, 0.11, 0, dress),
    box(0.014, 0.05, 0.018, -0.034, 0.105, 0, skin),
    box(0.014, 0.05, 0.018, 0.034, 0.105, 0, skin),
    box(0.038, 0.038, 0.038, 0, 0.155, 0, skin),
    box(0.006, 0.006, 0.004, -0.008, 0.158, 0.02, '#26292e'),
    box(0.006, 0.006, 0.004, 0.008, 0.158, 0.02, '#26292e'),
    box(0.042, 0.014, 0.042, 0, 0.177, -0.002, '#4a2c1a'),
    box(0.042, 0.05, 0.012, 0, 0.145, -0.022, '#4a2c1a'),
    box(0.02, 0.008, 0.026, -0.012, 0.004, 0.004, '#6b2a3a'),
    box(0.02, 0.008, 0.026, 0.012, 0.004, 0.004, '#6b2a3a'),
    box(0.056, 0.006, 0.034, 0, 0.088, 0, '#f2efe2'),
  ]);
}

/** Visual variants: 0-3 men, 4-7 women. Children use the same shapes, scaled down per instance. */
export const PERSON_VARIANTS = 8;
export const personGeometry = (variant: number) =>
  variant < 4 ? maleShape(SHIRTS[variant], SKIN[variant % 4]) : femaleShape(DRESSES[variant - 4], SKIN[(variant - 3) % 4]);

/** Bundle carried in the mother's arms. */
export const babyGeometry = () => merge([
  box(0.034, 0.03, 0.052, 0, 0.11, 0.036, '#f6efe6'),
  box(0.026, 0.026, 0.026, 0, 0.126, 0.062, '#f1c9a5'),
]);

/** Log carried on the shoulder. */
export const logGeometry = () => merge([
  box(0.13, 0.03, 0.03, 0.02, 0.15, -0.01, '#8a5a35'),
  box(0.005, 0.032, 0.032, 0.086, 0.15, -0.01, '#d8b27a'),
]);

export function personMesh(variant: number, scale = 1, baby = false) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  g.add(new THREE.Mesh(personGeometry(variant), mat));
  if (baby) g.add(new THREE.Mesh(babyGeometry(), mat));
  g.scale.setScalar(scale);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
