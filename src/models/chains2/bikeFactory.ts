import * as THREE from 'three';
import { box, merge, shape, rod, paint } from '../quality';

/** A slanted bar between two points (frame tubes), thickness `t`. */
function tube(a: [number, number, number], b: [number, number, number], t: number, color: string) {
  return rod(a,b,t/2,color,t/2,6);
}

/** One wheel standing upright (rolling along z): a dark tyre, a silver rim, spokes and a hub. */
function wheel(z: number, r: number): THREE.BufferGeometry[] {
  const parts = [
    paint(new THREE.TorusGeometry(r*.91,r*.09,5,20).rotateY(Math.PI/2).translate(0,r,z),'#222428'),
    paint(new THREE.TorusGeometry(r*.79,.0012,4,20).rotateY(Math.PI/2).translate(0,r,z),'#b8c0c8'),
    shape('cylinder', 0.02, 0.018, 0.018, 0, r, z, '#9aa3ab', 'x', 8),
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    parts.push(tube([0, r + Math.cos(a) * r * 0.78, z + Math.sin(a) * r * 0.78], [0, r - Math.cos(a) * r * 0.78, z - Math.sin(a) * r * 0.78], 0.003, '#c8ced4'));
  }
  return parts;
}

/** One bicycle (along z, front wheel at +z), placed at (x, y, z) and turned by `rotY`. */
function bikeParts(x: number, y: number, z: number, frame: string, rotY = 0): THREE.BufferGeometry[] {
  const r = 0.042, wb = 0.068;
  const rear: [number, number, number] = [0, r, -wb], front: [number, number, number] = [0, r, wb];
  const seat: [number, number, number] = [0, 0.1, -0.022], head: [number, number, number] = [0, 0.098, 0.045], crank: [number, number, number] = [0, 0.04, -0.006];
  const parts = [
    ...wheel(-wb, r), ...wheel(wb, r),
    tube(seat, crank, 0.008, frame), tube(crank, head, 0.008, frame), tube(seat, head, 0.008, frame),
    tube(crank, rear, 0.006, frame), tube(seat, rear, 0.006, frame), tube(head, front, 0.007, frame),
    box(0.022, 0.008, 0.034, 0, 0.108, -0.026, '#2a2016'),
    box(0.06, 0.006, 0.006, 0, 0.112, 0.042, '#3b3f45'), box(0.005, 0.016, 0.005, 0, 0.105, 0.044, '#3b3f45'),
    shape('cylinder', 0.006, 0.022, 0.022, 0, 0.04, -0.006, '#3b3f45', 'x', 10),
    box(0.03, 0.004, 0.012, 0, 0.032, -0.006, '#222428'),
  ];
  const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
  parts.forEach((p) => p.applyMatrix4(m));
  return parts;
}

/** A bicycle for a rider, or one standing at the factory (drawn as instances). */
export function bikeGeometry(): THREE.BufferGeometry {
  return merge(bikeParts(0, 0, 0, '#d9443b'));
}

/** Bicycle factory: a saw-tooth workshop with a big wheel sign; the bikes ready for sale stand in front (drawn apart). */
export function bikeFactoryGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b3ada2'),
    box(1.6, 0.36, 1.0, 0, 0.18, -0.4, '#d8cdb8'),
    box(0.3, 0.2, 0.02, -0.45, 0.13, 0.105, '#46505a'),
    box(0.3, 0.2, 0.02, 0.35, 0.13, 0.105, '#46505a'),
    // a bike rack in front
    box(1.4, 0.012, 0.012, -0.2, 0.05, 0.72, '#8e969e'),
    ...[-0.85, -0.2, 0.45].map((x) => box(0.012, 0.05, 0.012, x, 0.025, 0.72, '#8e969e')),
  ];
  for (let i = 0; i < 4; i++) parts.push(shape('wedge', 0.4, 0.16, 1.0, -0.6 + i * 0.4, 0.44, -0.4, '#5d8fb5', 'y', 4));
  parts.push(box(0.04, 0.4, 0.04, 0.82, 0.2, 0.25, '#5d6670'));
  parts.push(shape('torus', 0.32, 0.32, 0.05, 0.82, 0.5, 0.25, '#2a2d31', 'z', 20));
  parts.push(shape('torus', 0.24, 0.24, 0.04, 0.82, 0.5, 0.25, '#f2b33d', 'z', 20));
  return merge(parts);
}
