import * as THREE from 'three';
import { box, cylX, merge } from '../quality';

/** The ferris wheel (turns around its axle, local z). */
export function ferrisWheelGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [cylX(0.04, 0.3, 0, 0, 0, '#5d6670', 8)];
  const R = 0.75, colors = ['#d9443b', '#6fb6ff', '#f2b33d', '#7be08f', '#f28cb8', '#b9a3e0'];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    parts.push(box(0.2, 0.025, 0.025, 0, 0, 0, '#f4f4f2').rotateZ(a + Math.PI / 2).translate(Math.cos(a) * R, Math.sin(a) * R, 0.06));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    parts.push(box(R, 0.015, 0.015, R / 2, 0, 0.06, '#cfd6dc').rotateZ(a));
    parts.push(box(0.12, 0.1, 0.1, Math.cos(a) * R, Math.sin(a) * R - 0.07, 0.06, colors[i % colors.length]));
  }
  return merge(parts);
}
