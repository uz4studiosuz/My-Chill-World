import * as THREE from 'three';
import { box, merge, shape, paint } from '../quality';

/** Gazebo: a wooden pavilion with a pointed roof and a bench inside. */
export function gazeboGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(0.94, 0.02, 0.94, 0, 0.01, 0, '#9cc77a'),
    shape('hexagon', 0.7, 0.05, 0.7, 0, 0.045, 0, '#c9b28a', 'y', 6),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(box(0.035, 0.36, 0.035, Math.cos(a) * 0.3, 0.25, Math.sin(a) * 0.3, '#8a5a35'));
  }
  parts.push(shape('cone', 0.86, 0.26, 0.86, 0, 0.56, 0, '#b0473b', 'y', 6));
  parts.push(box(0.36, 0.03, 0.1, 0, 0.12, -0.12, '#6b4a2e'), box(0.36, 0.1, 0.02, 0, 0.17, -0.17, '#6b4a2e'));
  return merge(parts);
}

/** Pond: blue water in a stone ring, lily pads, reeds and two ducks. */
export function pondGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#9cc77a'),
    shape('cylinder', 1.6, 0.06, 1.3, 0, 0.03, 0, '#a7a196', 'y', 20),
    shape('cylinder', 1.42, 0.07, 1.12, 0, 0.04, 0, '#4a95cf', 'y', 20),
  ];
  for (const [x, z] of [[-0.35, 0.2], [0.3, -0.25], [0.1, 0.32]]) parts.push(shape('cylinder', 0.16, 0.012, 0.16, x, 0.08, z, '#5c9e4a', 'y', 10));
  for (let i = 0; i < 6; i++) parts.push(box(0.02, 0.16 + (i % 3) * 0.04, 0.02, 0.62 + (i % 2) * 0.05, 0.1, -0.2 + i * 0.07, '#6f8f3a'));
  for (const [x, z] of [[-0.1, -0.1], [0.05, 0.05]]) parts.push(box(0.06, 0.04, 0.09, x, 0.1, z, '#f4f1ea'), box(0.035, 0.035, 0.035, x, 0.135, z + 0.04, '#3a7a42'));
  parts.push(box(0.4, 0.04, 0.12, -0.55, 0.06, 0.62, '#8a5a35'));
  return merge(parts);
}

/** Clock tower: a slim brick tower with four clock faces and a copper roof. */
export function clockTowerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(0.94, 0.02, 0.94, 0, 0.01, 0, '#c9c2b4'),
    box(0.42, 0.1, 0.42, 0, 0.06, 0, '#8e8a83'),
    box(0.34, 1.0, 0.34, 0, 0.6, 0, '#b9654a'),
    box(0.38, 0.05, 0.38, 0, 1.12, 0, '#e9e2d2'),
    shape('pyramid', 0.42, 0.3, 0.42, 0, 1.3, 0, '#4f9a8a', 'y', 4),
  ];
  for (const [x, z, ax] of [[0, 0.172, 'z'], [0, -0.172, 'z'], [0.172, 0, 'x'], [-0.172, 0, 'x']] as const) {
    parts.push(shape('cylinder', 0.2, 0.012, 0.2, x, 0.95, z, '#f4f1ea', ax, 16));
    parts.push(box(ax === 'z' ? 0.012 : 0.006, 0.08, ax === 'z' ? 0.006 : 0.012, x * 1.04, 0.97, z * 1.04, '#2a2016'));
  }
  return merge(parts);
}

/** Flag pole: a tall white pole with a waving green-white-blue flag. */
export function flagpoleGeometry(): THREE.BufferGeometry {
  const fabric=(y:number,h:number,colour:string)=>{
    const positions:number[]=[],indices:number[]=[];
    for(let i=0;i<=12;i++){
      const u=i/12,z=.01+u*.36,x=Math.sin(u*8)*.018*u;
      positions.push(x,y-h/2,z,x,y+h/2,z);
      if(i<12){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2,n,n+2,n+1,n+1,n+2,n+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);
    const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return paint(flat,colour);
  };
  return merge([
    box(0.5, 0.04, 0.5, 0, 0.02, 0, '#a7a196'),
    shape('cylinder', 0.03, 1.2, 0.03, 0, 0.62, 0, '#eef0f2', 'y', 8),
    shape('sphere', 0.05, 0.05, 0.05, 0, 1.24, 0, '#f2b33d', 'y', 8),
    fabric(1.12,.08,'#3f86c4'),
    fabric(1.04,.08,'#f4f1ea'),
    fabric(.96,.08,'#4f9a3e'),
  ]);
}

/** Flower planters: three big pots with colourful flowers. */
export function planterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [box(0.94, 0.02, 0.94, 0, 0.01, 0, '#c9c2b4')];
  const cols = ['#e85a7a', '#f2b33d', '#b9a3e0'];
  [[-0.25, -0.2], [0.25, -0.15], [0, 0.25]].forEach(([x, z], i) => {
    parts.push(shape('cylinder', 0.26, 0.18, 0.26, x, 0.11, z, '#b9654a', 'y', 10));
    parts.push(shape('sphere', 0.26, 0.16, 0.26, x, 0.24, z, '#4f8a3a', 'y', 8));
    for (let j = 0; j < 5; j++) parts.push(box(0.05, 0.05, 0.05, x + Math.cos(j * 1.3) * 0.08, 0.3, z + Math.sin(j * 1.3) * 0.08, cols[i]));
  });
  return merge(parts);
}

/** Archway: a decorated city gate with a tiled arch. */
export function archwayGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.94, 0.02, 0.94, 0, 0.01, 0, '#c9c2b4'),
    box(0.16, 0.7, 0.24, -0.34, 0.36, 0, '#e9dcc0'),
    box(0.16, 0.7, 0.24, 0.34, 0.36, 0, '#e9dcc0'),
    shape('arch', 0.84, 0.26, 0.26, 0, 0.82, 0, '#3f86c4'),
    box(0.9, 0.06, 0.3, 0, 0.98, 0, '#e9dcc0'),
    box(0.2, 0.08, 0.3, 0, 1.05, 0, '#f2b33d'),
    box(0.18, 0.04, 0.28, -0.34, 0.72, 0, '#3f86c4'), box(0.18, 0.04, 0.28, 0.34, 0.72, 0, '#3f86c4'),
  ]);
}
