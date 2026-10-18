/**
 * Model-only geometry tools. Terrain, road markings, selection overlays and the
 * editor's voxel primitives keep their original construction rules.
 * Colours are never graded here: NightGlow identifies windows by exact colour.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as voxel from '../utils/voxel';
export { hash2, orient, turn, unitShape, roundBoxUnit } from '../utils/voxel';
export type { ShapeKind } from '../utils/voxel';

export function paint(g: THREE.BufferGeometry, colour = '#ffffff') {
  const c = new THREE.Color(colour), count = g.getAttribute('position').count;
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) values.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return g;
}

/** 44 triangles, with large flat faces and narrow bevels rather than tessellated cubes. */
function bevelBox(w: number, h: number, d: number, radius: number) {
  const half = [w / 2, h / 2, d / 2], r = Math.min(radius, ...half) * 0.999;
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  const face = (points: number[][], outward: number[]) => {
    const offset = vertices.length / 3;
    const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), c = new THREE.Vector3(...points[2]);
    const flip = b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3(...outward)) < 0;
    points.forEach((p, i) => { vertices.push(...p); uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); });
    for (let i = 1; i < points.length - 1; i++) indices.push(offset, offset + (flip ? i + 1 : i), offset + (flip ? i : i + 1));
  };
  for (let axis = 0; axis < 3; axis++) {
    const a = (axis + 1) % 3, b = (axis + 2) % 3;
    for (const sign of [-1, 1]) {
      const points = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sa,sb]) => {
        const p = [0,0,0]; p[axis] = sign * half[axis]; p[a] = sa * (half[a] - r); p[b] = sb * (half[b] - r); return p;
      });
      const n = [0,0,0]; n[axis] = sign; face(points, n);
    }
  }
  // Bevel strips along all twelve edges.
  for (let along = 0; along < 3; along++) {
    const a = (along + 1) % 3, b = (along + 2) % 3;
    for (const sa of [-1,1]) for (const sb of [-1,1]) {
      const points: number[][] = [];
      for (const [s, side] of [[-1,0],[1,0],[1,1],[-1,1]]) {
        const p = [0,0,0]; p[along] = s * (half[along] - r);
        p[a] = sa * (half[a] - (side ? r : 0)); p[b] = sb * (half[b] - (side ? 0 : r)); points.push(p);
      }
      const n = [0,0,0]; n[a] = sa; n[b] = sb; face(points, n);
    }
  }
  for (const sx of [-1,1]) for (const sy of [-1,1]) for (const sz of [-1,1]) {
    const signs = [sx,sy,sz];
    face([0,1,2].map(axis => half.map((v,i) => signs[i] * (v - (i === axis ? 0 : r)))), signs);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

/** Broad solid masses catch edge highlights. Glazing, trim and thin plates stay crisp. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, colour = '#ffffff') {
  const sizes = [w,h,d].sort((a,b) => a-b);
  if (sizes[0] < 0.025 || sizes[0] / sizes[1] < 0.16) return voxel.box(w,h,d,x,y,z,colour);
  const radius = Math.min(sizes[0] * 0.10, sizes[1] * 0.023, 0.014);
  return paint(bevelBox(w,h,d,radius).translate(x,y,z),colour);
}

/** Explicit rounding for organic bodies and vehicle panels. */
export function roundBox(w: number, h: number, d: number, x: number, y: number, z: number, colour = '#ffffff', radius = 0.02, segments = 1) {
  const r = Math.min(radius, w * 0.48, h * 0.48, d * 0.48);
  return paint(new RoundedBoxGeometry(w,h,d,segments,r).translate(x,y,z),colour);
}

export function shape(kind: voxel.ShapeKind, w: number, h: number, d: number, x: number, y: number, z: number, colour = '#ffffff', axis: 'x' | 'y' | 'z' = 'y', segments = 16) {
  if (kind === 'box') return box(w,h,d,x,y,z,colour);
  const diameter = axis === 'x' ? Math.min(h,d) : axis === 'z' ? Math.min(w,h) : Math.min(w,d);
  const round = kind === 'sphere' || kind === 'dome' || kind === 'cylinder' || kind === 'tube';
  const sides = round && diameter >= 0.15 ? Math.max(12,segments) : segments;
  return voxel.shape(kind,w,h,d,x,y,z,colour,axis,sides);
}

export function cylX(radius: number, length: number, x: number, y: number, z: number, colour = '#ffffff', segments = 16) {
  return voxel.cylX(radius,length,x,y,z,colour,segments);
}

/** All parts become indexed before joining, including explicit rounded solids. */
export function merge(parts: THREE.BufferGeometry[]) {
  if (!parts.length) throw new Error('A model must contain at least one geometry part.');
  for (const part of parts) {
    const count = part.getAttribute('position').count;
    if (!part.getIndex()) part.setIndex(Array.from({length:count},(_,i)=>i));
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    if (!part.getAttribute('uv')) part.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2));
    if (!part.getAttribute('color')) paint(part);
  }
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Model parts have incompatible attributes.');
  parts.forEach(part => part.dispose());
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

/** Low-poly, irregular ellipsoid, deterministic so rebuilt models never change shape. */
export function organic(w: number, h: number, d: number, x: number, y: number, z: number, colour = '#ffffff', seed = 1, detail = 0) {
  const g = new THREE.IcosahedronGeometry(0.5,detail), positions = g.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
    const noise = 1 + 0.08 * Math.sin(px*23.7 + py*17.3 + pz*31.1 + seed*2.3);
    positions.setXYZ(i,px*noise,py*noise,pz*noise);
  }
  g.scale(w,h,d).translate(x,y,z);g.computeVertexNormals();
  return paint(g,colour);
}

/** Tapered branch/strut between exact endpoints. */
export function rod(a: readonly number[], b: readonly number[], radius: number, colour: string, topRadius = radius, segments = 8) {
  const from = new THREE.Vector3(a[0],a[1],a[2]), to = new THREE.Vector3(b[0],b[1],b[2]);
  const axis = to.clone().sub(from), length = axis.length();
  const g = new THREE.CylinderGeometry(topRadius,radius,length,segments);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()));
  g.translate(...from.add(to).multiplyScalar(0.5).toArray());
  return paint(g,colour);
}

/** A pitched roof and its solid gable, with the same footprint as the old roof. */
export function gableRoof(w: number, d: number, eave: number, rise: number, cx: number, cz: number, roof: string, wall: string) {
  const outline = new THREE.Shape();outline.moveTo(-w/2,0);outline.lineTo(w/2,0);outline.lineTo(0,rise);outline.closePath();
  const core = new THREE.ExtrudeGeometry(outline,{depth:d*0.84,bevelEnabled:false,steps:1});
  core.translate(cx,eave,cz-d*0.42);
  const angle = Math.atan2(rise,w/2), length = Math.hypot(w/2,rise);
  return [paint(core,wall), ...[-1,1].map(side => {
    const g = voxel.box(length,0.018,d,0,0,0,roof);
    return g.rotateZ(-side*angle).translate(cx+side*w/4,eave+rise/2,cz);
  })];
}
