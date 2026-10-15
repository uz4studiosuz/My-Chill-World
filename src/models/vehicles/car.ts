import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { wheel } from './_shared';

const GLASS = '#2f3d4a';
const TRIM = '#26292e';

/** A wedge turned to slope the other way (towards −z), placed at (x, y, z). */
function wedgeBack(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  const g = shape('wedge', w, h, d, 0, 0, 0, color);
  g.rotateY(Math.PI);
  g.translate(x, y, z);
  return g;
}

/**
 * Car (faces +z): a body with a sloping bonnet and boot, wheel arches, a side skirt and door seams, a glasshouse with
 * a raked windscreen and rear window, mirrors, number plates, a grille, head- and tail-lights and an exhaust.
 * The body is white so every car can be tinted per instance.
 */
export const carGeometry = (): THREE.BufferGeometry => merge([
  // lower body and the sills
  box(0.16, 0.05, 0.3, 0, 0.056, 0),
  box(0.162, 0.012, 0.18, 0, 0.036, 0, '#3a3f46'),
  // bonnet sloping to the front, a flat boot
  shape('wedge', 0.152, 0.024, 0.1, 0, 0.093, 0.1),
  box(0.152, 0.018, 0.06, 0, 0.09, -0.118),
  // the glasshouse: raked windscreen, side windows, rear window, roof and pillars
  shape('wedge', 0.14, 0.058, 0.055, 0, 0.128, 0.05, GLASS),
  box(0.142, 0.052, 0.1, 0, 0.125, -0.03, GLASS),
  wedgeBack(0.14, 0.05, 0.04, 0, 0.124, -0.098, GLASS),
  box(0.138, 0.012, 0.11, 0, 0.157, -0.028),
  ...[0.022, -0.028].flatMap((z) => [box(0.144, 0.05, 0.008, 0, 0.125, z)]),
  // wheel arches over the tyres
  ...[0.09, -0.09].map((z) => box(0.164, 0.014, 0.078, 0, 0.056, z, TRIM)),
  // door seams and handles
  ...[0.012, -0.055].map((z) => box(0.163, 0.042, 0.004, 0, 0.062, z, '#c9cdd2')),
  box(0.164, 0.006, 0.018, 0, 0.07, -0.02, '#9aa3ab'), box(0.164, 0.006, 0.018, 0, 0.07, -0.085, '#9aa3ab'),
  // mirrors
  box(0.018, 0.012, 0.014, 0.084, 0.108, 0.05), box(0.018, 0.012, 0.014, -0.084, 0.108, 0.05),
  // front: bumper, grille, lights and plate
  box(0.168, 0.022, 0.016, 0, 0.042, 0.151, '#9aa3ab'),
  box(0.07, 0.022, 0.004, 0, 0.068, 0.151, TRIM),
  box(0.036, 0.016, 0.006, -0.056, 0.072, 0.151, '#fff6c8'), box(0.036, 0.016, 0.006, 0.056, 0.072, 0.151, '#fff6c8'),
  box(0.04, 0.012, 0.004, 0, 0.042, 0.16, '#f4f4f2'),
  // back: bumper, tail-lights, plate and the exhaust
  box(0.168, 0.022, 0.016, 0, 0.042, -0.151, '#9aa3ab'),
  box(0.036, 0.016, 0.006, -0.056, 0.074, -0.151, '#ff3b30'), box(0.036, 0.016, 0.006, 0.056, 0.074, -0.151, '#ff3b30'),
  box(0.04, 0.014, 0.004, 0, 0.066, -0.152, '#f2c230'),
  shape('cylinder', 0.01, 0.02, 0.01, 0.05, 0.034, -0.158, '#5d6670', 'z', 8),
  ...wheel(0.076, 0.09, 0.026), ...wheel(-0.076, 0.09, 0.026), ...wheel(0.076, -0.09, 0.026), ...wheel(-0.076, -0.09, 0.026),
]);
