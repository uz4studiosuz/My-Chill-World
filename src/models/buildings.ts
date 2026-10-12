import * as THREE from 'three';
import { box, merge } from '../utils/voxel';

// All models face +z (front door towards the road). Footprint: size 1 → ±0.5, size 2 → ±1.

const WALLS = ['#efe6d2', '#dbe5ec', '#f1dcc6', '#e8e0f0'];
const ROOFS = ['#c4553d', '#3f6fb5', '#6d4c3d', '#4f7d4a'];
const GLASS = '#a8d0e6';

export function houseGeometry(variant: number): THREE.BufferGeometry {
  const wall = WALLS[variant % 4], roof = ROOFS[(variant >> 2) % 4];
  return merge([
    box(0.22, 0.02, 0.32, 0.2, 0.01, 0.34, '#bdb7aa'),
    box(0.1, 0.015, 0.3, -0.12, 0.008, 0.35, '#cfc8b6'),
    box(0.62, 0.42, 0.52, 0, 0.21, -0.06, wall),
    box(0.72, 0.1, 0.62, 0, 0.47, -0.06, roof),
    box(0.56, 0.1, 0.46, 0, 0.57, -0.06, roof),
    box(0.36, 0.08, 0.28, 0, 0.66, -0.06, roof),
    box(0.08, 0.18, 0.08, 0.18, 0.68, -0.14, '#8a7d70'),
    box(0.12, 0.2, 0.02, 0, 0.1, 0.205, '#6b4a2e'),
    box(0.12, 0.1, 0.02, -0.19, 0.26, 0.205, GLASS),
    box(0.12, 0.1, 0.02, 0.19, 0.26, 0.205, GLASS),
    box(0.02, 0.1, 0.12, 0.315, 0.26, -0.06, GLASS),
    box(0.02, 0.1, 0.12, -0.315, 0.26, -0.06, GLASS),
  ]);
}

export function townHallGeometry(): THREE.BufferGeometry {
  const wall = '#eee6d4', roof = '#3567c4', trim = '#d8cdb5';
  const parts = [
    box(1.9, 0.02, 0.55, 0, 0.01, 0.68, '#9d9d9a'),
    box(1.5, 0.84, 1.0, 0, 0.42, -0.2, wall),
    box(1.6, 0.1, 1.1, 0, 0.89, -0.2, roof),
    box(1.2, 0.08, 0.8, 0, 0.98, -0.2, roof),
    box(0.36, 0.5, 0.36, 0, 1.25, -0.2, wall),
    box(0.42, 0.08, 0.42, 0, 1.53, -0.2, roof),
    box(0.24, 0.14, 0.24, 0, 1.64, -0.2, roof),
    box(0.16, 0.16, 0.02, 0, 1.3, -0.01, '#ffffff'),
    box(0.3, 0.24, 0.02, 0, 0.12, 0.305, '#5a7f9c'),
    box(0.06, 0.3, 0.06, -0.22, 0.15, 0.4, trim),
    box(0.06, 0.3, 0.06, 0.22, 0.15, 0.4, trim),
    box(0.6, 0.05, 0.22, 0, 0.32, 0.38, roof),
    box(0.03, 0.7, 0.03, 0.78, 0.35, 0.62, '#cccccc'),
    box(0.22, 0.13, 0.01, 0.9, 0.62, 0.62, '#d9443b'),
  ];
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      if (row === 0 && Math.abs(col) < 1) continue;
      parts.push(box(0.16, 0.12, 0.02, col * 0.28, 0.2 + row * 0.24, 0.305, GLASS));
    }
  }
  return merge(parts);
}

export function officeGeometry(): THREE.BufferGeometry {
  const glass = '#6f9fc8', frame = '#e9edf0', dark = '#2f3d4a';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#bcb8ae'),
    box(1.2, 1.5, 1.0, -0.15, 0.75, -0.3, glass),
    box(0.8, 0.6, 0.7, -0.15, 1.8, -0.3, glass),
    box(1.26, 0.06, 1.06, -0.15, 1.52, -0.3, frame),
    box(0.86, 0.06, 0.76, -0.15, 2.12, -0.3, frame),
    box(0.03, 0.4, 0.03, 0.05, 2.35, -0.35, '#cccccc'),
    box(0.22, 0.12, 0.16, 0.25, 1.61, -0.05, '#9aa3ab'),
    box(0.5, 0.04, 0.26, -0.15, 0.36, 0.32, dark),
    box(0.32, 0.3, 0.02, -0.15, 0.15, 0.205, dark),
    box(0.5, 0.45, 0.6, 0.7, 0.225, -0.4, frame),
    box(0.54, 0.05, 0.64, 0.7, 0.47, -0.4, '#8f979f'),
    box(0.08, 0.25, 0.08, 0.7, 0.125, 0.55, '#6b4a2e'),
    box(0.3, 0.3, 0.3, 0.7, 0.4, 0.55, '#5f9a3e'),
    box(0.08, 0.25, 0.08, -0.75, 0.125, 0.6, '#6b4a2e'),
    box(0.3, 0.3, 0.3, -0.75, 0.4, 0.6, '#6faa45'),
  ];
  for (let i = 0; i < 6; i++) parts.push(box(1.24, 0.035, 1.04, -0.15, 0.22 + i * 0.25, -0.3, frame));
  for (let i = 0; i < 2; i++) parts.push(box(0.84, 0.035, 0.74, -0.15, 1.72 + i * 0.2, -0.3, frame));
  for (const x of [-0.7, 0.4]) parts.push(box(0.04, 1.5, 1.04, x, 0.75, -0.3, frame));
  return merge(parts);
}

export { PARKING_LOT_SLOTS as PARKING_SLOTS } from '../buildings/BuildingTypes';

export function parkingGeometry(): THREE.BufferGeometry {
  const line = '#f2f2ee', curb = '#cdc9bd';
  const parts = [
    box(1.92, 0.03, 1.92, 0, 0.015, 0, '#565a62'),
    box(1.96, 0.05, 0.04, 0, 0.025, -0.97, curb),
    box(0.04, 0.05, 1.96, -0.97, 0.025, 0, curb),
    box(0.04, 0.05, 1.96, 0.97, 0.025, 0, curb),
    box(0.03, 0.6, 0.03, -0.92, 0.3, 0.08, '#8c8f94'),
    box(0.12, 0.03, 0.07, -0.87, 0.6, 0.08, '#ffe9a8'),
    box(0.03, 0.6, 0.03, 0.92, 0.3, 0.08, '#8c8f94'),
    box(0.12, 0.03, 0.07, 0.87, 0.6, 0.08, '#ffe9a8'),
    box(0.03, 0.45, 0.03, 0.9, 0.22, 0.92, '#8c8f94'),
    box(0.2, 0.2, 0.02, 0.9, 0.5, 0.92, '#2f6fd6'),
    box(0.06, 0.1, 0.021, 0.88, 0.5, 0.925, '#ffffff'),
  ];
  for (const x of [-0.96, -0.48, 0, 0.48, 0.96]) {
    parts.push(box(0.025, 0.005, 0.42, x, 0.033, -0.55, line));
    parts.push(box(0.025, 0.005, 0.42, x, 0.033, 0.7, line));
  }
  return merge(parts);
}

export function quarryGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.9, 0.03, 1.9, 0, 0.015, 0, '#a39d90'),
    box(1.8, 0.7, 0.35, 0, 0.35, -0.75, '#8d8a83'),
    box(1.4, 0.35, 0.3, -0.1, 0.875, -0.78, '#99958d'),
    box(0.6, 0.2, 0.4, 0.5, 0.8, -0.7, '#85827b'),
    box(0.42, 0.2, 0.42, -0.55, 0.1, 0.1, '#b4afa5'),
    box(0.28, 0.14, 0.28, -0.55, 0.27, 0.1, '#bdb8ae'),
    box(0.36, 0.16, 0.3, -0.1, 0.08, 0.3, '#aaa59b'),
    box(0.5, 0.35, 0.4, 0.55, 0.175, -0.25, '#e2b33a'),
    box(0.56, 0.06, 0.46, 0.55, 0.38, -0.25, '#6d5a48'),
    box(0.12, 0.2, 0.02, 0.55, 0.1, -0.04, '#5a4634'),
    box(0.06, 0.9, 0.06, -0.15, 0.45, -0.4, '#e8a13a'),
    box(0.7, 0.05, 0.05, 0.12, 0.88, -0.4, '#e8a13a'),
    box(0.015, 0.3, 0.015, 0.42, 0.72, -0.4, '#333333'),
    box(0.1, 0.06, 0.1, 0.42, 0.55, -0.4, '#c7c2b6'),
  ];
  for (let i = 0; i < 3; i++) {
    parts.push(box(0.15, 0.1, 0.15, 0.25 + i * 0.18, 0.05, 0.6, '#c7c2b6'));
    parts.push(box(0.15, 0.1, 0.15, 0.34 + i * 0.18, 0.15, 0.6, '#d0cbbf'));
  }
  return merge(parts);
}

export function schoolGeometry(): THREE.BufferGeometry {
  const wall = '#d9714a', trim = '#f2ede2', roof = '#5b6b7a';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#c9bfa6'),
    box(1.0, 0.02, 0.7, 0.4, 0.015, 0.25, '#8cb156'),
    box(1.5, 0.6, 0.8, -0.1, 0.3, -0.45, wall),
    box(1.6, 0.08, 0.9, -0.1, 0.64, -0.45, roof),
    box(0.4, 0.5, 0.4, -0.65, 0.85, -0.45, trim),
    box(0.46, 0.08, 0.46, -0.65, 1.12, -0.45, roof),
    box(0.15, 0.15, 0.02, -0.65, 0.9, -0.24, '#f1c232'),
    box(0.34, 0.3, 0.02, -0.1, 0.15, -0.045, '#6b4a2e'),
    box(0.5, 0.05, 0.2, -0.1, 0.33, 0.0, trim),
    box(0.03, 0.75, 0.03, -0.85, 0.375, 0.2, '#cccccc'),
    box(0.2, 0.12, 0.01, -0.74, 0.68, 0.2, '#3a6fd1'),
    // playground: slide and swing
    box(0.06, 0.22, 0.06, 0.1, 0.11, 0.2, '#e8a13a'),
    box(0.08, 0.02, 0.3, 0.1, 0.14, 0.38, '#d9443b'),
    box(0.03, 0.22, 0.03, 0.45, 0.11, 0.15, '#6d4c3d'),
    box(0.03, 0.22, 0.03, 0.75, 0.11, 0.15, '#6d4c3d'),
    box(0.33, 0.03, 0.03, 0.6, 0.22, 0.15, '#6d4c3d'),
    box(0.08, 0.015, 0.05, 0.52, 0.09, 0.15, '#3a6fd1'),
    box(0.08, 0.015, 0.05, 0.68, 0.09, 0.15, '#3a6fd1'),
  ];
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    parts.push(box(0.16, 0.14, 0.02, -0.1 + i * 0.28, 0.36, -0.045, GLASS));
  }
  return merge(parts);
}

export function woodcutterGeometry(): THREE.BufferGeometry {
  const log = '#8a5a35', dark = '#6b4a2e';
  const parts = [
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#a08a62'),
    box(0.5, 0.32, 0.4, -0.1, 0.16, -0.15, log),
    box(0.6, 0.06, 0.5, -0.1, 0.35, -0.15, '#3d5e3a'),
    box(0.42, 0.06, 0.32, -0.1, 0.41, -0.15, '#3d5e3a'),
    box(0.12, 0.2, 0.02, -0.1, 0.1, 0.055, dark),
    box(0.08, 0.08, 0.02, 0.06, 0.2, 0.055, GLASS),
    // stump with axe
    box(0.12, 0.08, 0.12, 0.28, 0.04, 0.25, dark),
    box(0.015, 0.12, 0.015, 0.28, 0.13, 0.25, '#c9a36b'),
    box(0.05, 0.03, 0.01, 0.3, 0.18, 0.25, '#9aa3ab'),
  ];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) {
    parts.push(box(0.05, 0.05, 0.3, 0.22 + j * 0.055 + i * 0.027, 0.025 + i * 0.05, -0.15, j % 2 ? log : '#9c6a40'));
  }
  return merge(parts);
}

export function powerPlantGeometry(): THREE.BufferGeometry {
  const brick = '#a65e43', dark = '#5a5f66';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#9d9d9a'),
    box(1.1, 0.55, 0.9, -0.3, 0.275, -0.35, brick),
    box(1.16, 0.06, 0.96, -0.3, 0.58, -0.35, dark),
    box(0.2, 1.3, 0.2, 0.45, 0.65, -0.55, brick),
    box(0.24, 0.06, 0.24, 0.45, 1.33, -0.55, dark),
    box(0.3, 0.3, 0.3, 0.55, 0.15, 0.1, '#8c8f94'),
    box(0.36, 0.04, 0.36, 0.55, 0.32, 0.1, '#6f7378'),
    box(0.03, 0.5, 0.03, 0.75, 0.25, 0.55, '#6f7378'),
    box(0.25, 0.03, 0.03, 0.75, 0.48, 0.55, '#6f7378'),
    box(0.3, 0.28, 0.02, -0.3, 0.14, 0.105, '#3d4148'),
  ];
  for (let i = 0; i < 4; i++) parts.push(box(0.14, 0.1, 0.02, -0.7 + i * 0.27, 0.38, 0.105, '#f2d27a'));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    parts.push(box(0.06, 0.06, 0.4, -0.85 + i * 0.07, 0.03 + j * 0.06, 0.55, j ? '#8a5a35' : '#9c6a40'));
  }
  return merge(parts);
}

/** Field base; the crops are a separate mesh so they can grow. */
export function farmGeometry(): THREE.BufferGeometry {
  const parts = [box(2.9, 0.03, 2.9, 0, 0.015, 0, '#7a5a3c')];
  for (let i = 0; i < 9; i++) parts.push(box(2.7, 0.02, 0.12, 0, 0.035, -1.2 + i * 0.3, '#5f4430'));
  parts.push(
    box(0.5, 0.4, 0.4, 1.1, 0.2, -1.1, '#b0402f'),
    box(0.56, 0.12, 0.46, 1.1, 0.46, -1.1, '#6d4c3d'),
    box(0.16, 0.22, 0.02, 1.1, 0.11, -0.895, '#f2ede2'),
  );
  for (const [x, z, w, d] of [[0, -1.45, 2.9, 0.03], [0, 1.45, 2.9, 0.03], [-1.45, 0, 0.03, 2.9], [1.45, 0, 0.03, 2.9]]) {
    parts.push(box(w, 0.06, d, x, 0.08, z, '#9c7a52'));
  }
  return merge(parts);
}

/** Rows of crops (white — tinted from green to gold as they ripen). */
export function cropGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (i < 2 && j > 6) continue; // barn corner
      parts.push(box(0.1, 0.16, 0.08, -1.2 + j * 0.3, 0.08, -1.2 + i * 0.3));
    }
  }
  return merge(parts);
}

export function orchardGeometry(): THREE.BufferGeometry {
  const parts = [box(1.9, 0.02, 1.9, 0, 0.01, 0, '#86ad4e')];
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.45], [0.5, 0.45]]) {
    parts.push(box(0.1, 0.35, 0.1, x, 0.175, z, '#6b4a2e'), box(0.55, 0.4, 0.55, x, 0.55, z, '#4f8a3a'), box(0.36, 0.2, 0.36, x, 0.82, z, '#5f9a3e'));
    for (const [fx, fz] of [[0.28, 0.1], [-0.1, 0.28], [-0.28, -0.12], [0.1, -0.28]]) parts.push(box(0.06, 0.06, 0.06, x + fx, 0.5, z + fz, '#d9443b'));
  }
  parts.push(box(0.16, 0.1, 0.12, 0, 0.05, 0, '#b08a5a'), box(0.12, 0.03, 0.08, 0, 0.11, 0, '#d9443b'));
  return merge(parts);
}

export function ranchGeometry(): THREE.BufferGeometry {
  const fence = '#9c7a52';
  const parts = [box(2.9, 0.02, 2.9, 0, 0.01, 0, '#9bc066')];
  for (const [x, z, w, d] of [[0, -1.42, 2.84, 0.03], [0, 1.42, 2.84, 0.03], [-1.42, 0, 0.03, 2.84], [1.42, 0, 0.03, 2.84]]) {
    parts.push(box(w, 0.025, d, x, 0.09, z, fence), box(w, 0.025, d, x, 0.16, z, fence));
  }
  for (let i = -1.4; i <= 1.41; i += 0.35) {
    for (const [x, z] of [[i, -1.42], [i, 1.42], [-1.42, i], [1.42, i]]) parts.push(box(0.04, 0.2, 0.04, x, 0.1, z, '#7a5a3c'));
  }
  parts.push(
    box(0.7, 0.5, 0.5, -0.9, 0.25, -0.95, '#b0402f'),
    box(0.76, 0.14, 0.56, -0.9, 0.57, -0.95, '#6d4c3d'),
    box(0.22, 0.3, 0.02, -0.9, 0.15, -0.695, '#f2ede2'),
    box(0.4, 0.08, 0.14, 0.7, 0.04, -0.9, '#8c8f94'),
    box(0.36, 0.02, 0.1, 0.7, 0.07, -0.9, '#4a9cc0'),
    box(0.3, 0.2, 0.3, 0.9, 0.1, 0.9, '#e2c26a'),
  );
  return merge(parts);
}

/** Traffic-light pole (the lamp head is a separate tinted mesh). */
export const trafficPoleGeometry = () => merge([
  box(0.025, 0.36, 0.025, 0, 0.18, 0, '#4a4f57'),
  box(0.06, 0.14, 0.05, 0, 0.36, 0, '#2d3138'),
]);
export const trafficLampGeometry = () => box(0.04, 0.04, 0.02, 0, 0.36, 0.03);

export function weddingHallGeometry(): THREE.BufferGeometry {
  const wall = '#f6efe6', roof = '#d97a9a', gold = '#e8c25a';
  return merge([
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#e6dccb'),
    box(0.16, 0.012, 0.42, 0, 0.022, 0.25, '#c84a5a'),
    box(0.6, 0.38, 0.5, 0, 0.19, -0.12, wall),
    box(0.68, 0.06, 0.58, 0, 0.41, -0.12, roof),
    box(0.4, 0.14, 0.34, 0, 0.5, -0.12, roof),
    box(0.16, 0.22, 0.16, 0, 0.66, -0.12, wall),
    box(0.2, 0.05, 0.2, 0, 0.79, -0.12, gold),
    box(0.03, 0.12, 0.03, 0, 0.88, -0.12, gold),
    box(0.16, 0.24, 0.02, 0, 0.12, 0.135, '#8a5a3c'),
    box(0.04, 0.3, 0.04, -0.14, 0.15, 0.17, wall),
    box(0.04, 0.3, 0.04, 0.14, 0.15, 0.17, wall),
    box(0.36, 0.04, 0.12, 0, 0.31, 0.17, roof),
    box(0.1, 0.1, 0.02, -0.2, 0.25, 0.135, GLASS),
    box(0.1, 0.1, 0.02, 0.2, 0.25, 0.135, GLASS),
    box(0.12, 0.14, 0.12, -0.33, 0.07, 0.3, '#5f9a3e'),
    box(0.12, 0.14, 0.12, 0.33, 0.07, 0.3, '#5f9a3e'),
    box(0.05, 0.05, 0.05, -0.33, 0.16, 0.3, '#e07ba8'),
    box(0.05, 0.05, 0.05, 0.33, 0.16, 0.3, '#f2efe2'),
  ]);
}

export function waterTowerGeometry(): THREE.BufferGeometry {
  const steel = '#8c9aa6', tank = '#5fa8d3';
  const parts = [
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#b9b5aa'),
    box(0.5, 0.36, 0.5, 0, 0.98, -0.05, tank),
    box(0.4, 0.08, 0.4, 0, 1.2, -0.05, '#4a8fbd'),
    box(0.2, 0.06, 0.2, 0, 1.27, -0.05, '#4a8fbd'),
    box(0.52, 0.04, 0.52, 0, 0.8, -0.05, steel),
    box(0.06, 0.6, 0.06, 0, 0.5, -0.05, steel),
    box(0.3, 0.2, 0.25, 0.22, 0.1, 0.22, '#d8d2c4'),
    box(0.08, 0.14, 0.02, 0.22, 0.07, 0.346, '#5a6470'),
    box(0.22, 0.1, 0.02, 0, 0.98, 0.205, '#ffffff'),
  ];
  for (const [x, z] of [[-0.2, -0.25], [0.2, -0.25], [-0.2, 0.15], [0.2, 0.15]]) parts.push(box(0.04, 0.8, 0.04, x, 0.4, z, steel));
  parts.push(box(0.44, 0.03, 0.03, 0, 0.45, -0.25, steel), box(0.44, 0.03, 0.03, 0, 0.45, 0.15, steel));
  return merge(parts);
}

export const GRAVE_OFFSETS: [number, number][] = [
  [-0.62, -0.2], [-0.35, -0.2], [0.35, -0.2], [0.62, -0.2],
  [-0.62, 0.1],  [-0.35, 0.1],  [0.35, 0.1],  [0.62, 0.1],
  [-0.62, 0.4],  [-0.35, 0.4],  [0.35, 0.4],  [0.62, 0.4],
  [-0.62, 0.7],  [-0.35, 0.7],  [0.35, 0.7],  [0.62, 0.7],
];

export function cemeteryGeometry(): THREE.BufferGeometry {
  const wall = '#7d7a75', pillar = '#5f5d59', path = '#bdb7aa';
  const parts = [
    // base lawn
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#658a42'),
    // boundary walls
    box(1.9, 0.2, 0.06, 0, 0.1, -0.92, wall),
    box(0.06, 0.2, 1.9, -0.92, 0.1, 0, wall),
    box(0.06, 0.2, 1.9, 0.92, 0.1, 0, wall),
    box(0.68, 0.2, 0.06, -0.58, 0.1, 0.92, wall),
    box(0.68, 0.2, 0.06, 0.58, 0.1, 0.92, wall),
    // entrance gate pillars & arch
    box(0.12, 0.32, 0.12, -0.24, 0.16, 0.92, pillar),
    box(0.12, 0.32, 0.12, 0.24, 0.16, 0.92, pillar),
    box(0.5, 0.03, 0.03, 0, 0.3, 0.92, '#2f3136'),
    // central cobblestone walkway
    box(0.24, 0.012, 1.4, 0, 0.016, 0.22, path),
    // chapel / caretaker shed in the back
    box(0.5, 0.4, 0.45, 0, 0.21, -0.65, '#8c8880'),
    box(0.56, 0.14, 0.5, 0, 0.48, -0.65, '#4a433d'),
    box(0.04, 0.16, 0.04, 0, 0.62, -0.65, '#d4af37'),
    box(0.12, 0.04, 0.04, 0, 0.66, -0.65, '#d4af37'),
    box(0.14, 0.22, 0.02, 0, 0.11, -0.42, '#5c3a21'),
    // decorative corner cypress trees
    box(0.04, 0.16, 0.04, -0.74, 0.08, -0.74, '#4a3525'),
    box(0.2, 0.6, 0.2, -0.74, 0.42, -0.74, '#2d4a25'),
    box(0.12, 0.2, 0.12, -0.74, 0.78, -0.74, '#2d4a25'),
    box(0.04, 0.16, 0.04, 0.74, 0.08, -0.74, '#4a3525'),
    box(0.2, 0.6, 0.2, 0.74, 0.42, -0.74, '#2d4a25'),
    box(0.12, 0.2, 0.12, 0.74, 0.78, -0.74, '#2d4a25'),
  ];
  return merge(parts);
}

export function headstoneGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.18, 0.02, 0.22, 0, 0.01, 0.02, '#554133'),
    box(0.13, 0.15, 0.04, 0, 0.085, -0.07, '#8f8e8b'),
    box(0.09, 0.03, 0.04, 0, 0.175, -0.07, '#8f8e8b'),
    box(0.04, 0.03, 0.04, 0.02, 0.03, 0.06, '#d9443b'),
  ]);
}

