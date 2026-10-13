import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Box with a baked vertex colour, already translated into place. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, color = '#ffffff') {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function merge(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

export function hash2(x: number, z: number) {
  let h = Math.imul(x, 73856093) ^ Math.imul(z, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Shapes besides boxes (the model editor offers the same set). */
export type ShapeKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'wedge' | 'dome';

/** A shape of size 1×1×1 centred on the origin (wedge: slopes down towards +z; dome: flat side down). */
export function unitShape(kind: ShapeKind, seg = 16): THREE.BufferGeometry {
  switch (kind) {
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, seg);
    case 'sphere': return new THREE.SphereGeometry(0.5, seg, Math.max(6, Math.round(seg * 0.7)));
    case 'cone': return new THREE.ConeGeometry(0.5, 1, seg);
    case 'dome': return new THREE.SphereGeometry(0.5, seg, Math.max(4, Math.round(seg / 3)), 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1).translate(0, -0.5, 0);
    case 'wedge': {
      const g = new THREE.BoxGeometry(1, 1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setY(i, -0.5);
      g.computeVertexNormals();
      return g;
    }
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function paint(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Turn a unit shape so its main axis (cylinder / cone length, dome top) points along x, y or z. */
export function orient(g: THREE.BufferGeometry, axis: 'x' | 'y' | 'z') {
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

/** Any shape with a baked colour, sized w×h×d (after turning to `axis`) and placed at (x, y, z) — like box(). */
export function shape(kind: ShapeKind, w: number, h: number, d: number, x: number, y: number, z: number, color = '#ffffff', axis: 'x' | 'y' | 'z' = 'y', seg = 16) {
  return paint(orient(unitShape(kind, seg), axis).scale(w, h, d).translate(x, y, z), color);
}

/** Round cylinder lying along the x axis (wheels, pipes, logs). */
export function cylX(r: number, len: number, x: number, y: number, z: number, color = '#ffffff', seg = 14) {
  return paint(new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(x, y, z), color);
}
