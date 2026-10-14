import type { ShapeKind } from '../utils/voxel';

/** One part of a ready-made object in the model editor (same fields as an editor part). */
export interface PresetPart {
  w: number; h: number; d: number; x: number; y: number; z: number; color: string;
  name?: string; shape?: ShapeKind; axis?: 'x' | 'y' | 'z'; r?: number;
}

const TYRE = '#1f2226';
const HUB = '#aab4be';
const GLASS = '#6f9fc8';
const WOOD = '#8a5a35';
const LEAF = '#4f8a3a';

/** A wheel facing sideways: a round tyre and a hub. */
const wheel = (x: number, y: number, z: number, d = 0.065, w = 0.032): PresetPart[] => [
  { w, h: d, d, x, y, z, color: TYRE, shape: 'torus', axis: 'x', name: 'Tyre' },
  { w: w * 0.9, h: d * 0.55, d: d * 0.55, x, y, z, color: HUB, shape: 'cylinder', axis: 'x', name: 'Hub' },
];

/** Ready-made objects; sizes in tiles (a car is ~0.3 long), models face +z (the road). */
export const PRESETS: Record<string, PresetPart[]> = {
  Car: [
    { w: 0.16, h: 0.06, d: 0.3, x: 0, y: 0.065, z: 0, color: '#d9443b', r: 0.022, name: 'Body' },
    { w: 0.14, h: 0.055, d: 0.15, x: 0, y: 0.118, z: -0.02, color: GLASS, r: 0.02, name: 'Windows' },
    { w: 0.145, h: 0.014, d: 0.12, x: 0, y: 0.147, z: -0.02, color: '#d9443b', r: 0.006, name: 'Roof' },
    { w: 0.03, h: 0.014, d: 0.006, x: -0.05, y: 0.075, z: 0.15, color: '#fff6c8', name: 'Headlight' },
    { w: 0.03, h: 0.014, d: 0.006, x: 0.05, y: 0.075, z: 0.15, color: '#fff6c8', name: 'Headlight' },
    { w: 0.03, h: 0.014, d: 0.006, x: -0.05, y: 0.075, z: -0.15, color: '#ff3b30', name: 'Tail light' },
    { w: 0.03, h: 0.014, d: 0.006, x: 0.05, y: 0.075, z: -0.15, color: '#ff3b30', name: 'Tail light' },
    ...wheel(0.075, 0.033, 0.09), ...wheel(-0.075, 0.033, 0.09), ...wheel(0.075, 0.033, -0.09), ...wheel(-0.075, 0.033, -0.09),
  ],
  Bus: [
    { w: 0.18, h: 0.17, d: 0.5, x: 0, y: 0.11, z: 0, color: '#f2c230', r: 0.03, name: 'Body' },
    { w: 0.184, h: 0.055, d: 0.44, x: 0, y: 0.15, z: -0.01, color: GLASS, r: 0.01, name: 'Windows' },
    { w: 0.15, h: 0.07, d: 0.01, x: 0, y: 0.15, z: 0.248, color: GLASS, r: 0.005, name: 'Windscreen' },
    { w: 0.05, h: 0.1, d: 0.006, x: 0.05, y: 0.08, z: 0.25, color: '#3d4148', name: 'Door' },
    ...wheel(0.085, 0.035, 0.16, 0.07), ...wheel(-0.085, 0.035, 0.16, 0.07), ...wheel(0.085, 0.035, -0.16, 0.07), ...wheel(-0.085, 0.035, -0.16, 0.07),
  ],
  Truck: [
    { w: 0.17, h: 0.11, d: 0.12, x: 0, y: 0.09, z: 0.15, color: '#3a6fd1', r: 0.02, name: 'Cab' },
    { w: 0.15, h: 0.045, d: 0.01, x: 0, y: 0.115, z: 0.21, color: GLASS, r: 0.004, name: 'Windscreen' },
    { w: 0.18, h: 0.13, d: 0.26, x: 0, y: 0.1, z: -0.06, color: '#e9edf0', r: 0.008, name: 'Box' },
    { w: 0.17, h: 0.02, d: 0.4, x: 0, y: 0.035, z: 0.0, color: '#3d4148', name: 'Chassis' },
    ...wheel(0.085, 0.035, 0.15), ...wheel(-0.085, 0.035, 0.15), ...wheel(0.085, 0.035, -0.12), ...wheel(-0.085, 0.035, -0.12),
  ],
  Tree: [
    { w: 0.05, h: 0.22, d: 0.05, x: 0, y: 0.11, z: 0, color: '#6b4a2e', shape: 'cylinder', name: 'Trunk' },
    { w: 0.32, h: 0.3, d: 0.32, x: 0, y: 0.32, z: 0, color: LEAF, shape: 'sphere', name: 'Crown' },
    { w: 0.2, h: 0.18, d: 0.2, x: 0.06, y: 0.45, z: 0.03, color: '#5f9a3e', shape: 'sphere', name: 'Crown' },
  ],
  Pine: [
    { w: 0.05, h: 0.14, d: 0.05, x: 0, y: 0.07, z: 0, color: '#6b4a2e', shape: 'cylinder', name: 'Trunk' },
    { w: 0.3, h: 0.24, d: 0.3, x: 0, y: 0.24, z: 0, color: '#2d5a32', shape: 'cone', name: 'Branches' },
    { w: 0.23, h: 0.22, d: 0.23, x: 0, y: 0.38, z: 0, color: '#2f6a3a', shape: 'cone', name: 'Branches' },
    { w: 0.15, h: 0.18, d: 0.15, x: 0, y: 0.5, z: 0, color: '#357a40', shape: 'cone', name: 'Top' },
  ],
  House: [
    { w: 0.96, h: 0.02, d: 0.96, x: 0, y: 0.01, z: 0, color: '#9dc06a', name: 'Garden' },
    { w: 0.56, h: 0.34, d: 0.46, x: 0, y: 0.19, z: -0.08, color: '#efe6d2', r: 0.012, name: 'Walls' },
    { w: 0.66, h: 0.24, d: 0.56, x: 0, y: 0.48, z: -0.08, color: '#c4553d', shape: 'pyramid', name: 'Roof' },
    { w: 0.06, h: 0.14, d: 0.06, x: 0.16, y: 0.55, z: -0.16, color: '#8a5a35', name: 'Chimney' },
    { w: 0.11, h: 0.19, d: 0.02, x: 0, y: 0.115, z: 0.155, color: '#6b4a2e', r: 0.006, name: 'Door' },
    { w: 0.1, h: 0.09, d: 0.02, x: -0.17, y: 0.22, z: 0.155, color: '#a8d0e6', r: 0.005, name: 'Window' },
    { w: 0.1, h: 0.09, d: 0.02, x: 0.17, y: 0.22, z: 0.155, color: '#a8d0e6', r: 0.005, name: 'Window' },
    { w: 0.08, h: 0.012, d: 0.36, x: 0, y: 0.026, z: 0.33, color: '#d9cfae', name: 'Path' },
  ],
  'Lamp post': [
    { w: 0.025, h: 0.5, d: 0.025, x: 0, y: 0.25, z: 0, color: '#3d4148', shape: 'cylinder', name: 'Pole' },
    { w: 0.06, h: 0.02, d: 0.06, x: 0, y: 0.01, z: 0, color: '#3d4148', shape: 'cylinder', name: 'Base' },
    { w: 0.06, h: 0.07, d: 0.06, x: 0, y: 0.52, z: 0, color: '#fff3b0', shape: 'sphere', name: 'Lamp' },
    { w: 0.07, h: 0.025, d: 0.07, x: 0, y: 0.56, z: 0, color: '#3d4148', shape: 'dome', name: 'Cap' },
  ],
  Bench: [
    { w: 0.3, h: 0.02, d: 0.08, x: 0, y: 0.08, z: 0, color: WOOD, r: 0.006, name: 'Seat' },
    { w: 0.3, h: 0.06, d: 0.015, x: 0, y: 0.125, z: -0.035, color: WOOD, r: 0.005, name: 'Back' },
    { w: 0.02, h: 0.08, d: 0.07, x: -0.12, y: 0.04, z: 0, color: '#3d4148', name: 'Leg' },
    { w: 0.02, h: 0.08, d: 0.07, x: 0.12, y: 0.04, z: 0, color: '#3d4148', name: 'Leg' },
  ],
  Fence: [
    ...[-0.4, -0.2, 0, 0.2, 0.4].map((x) => ({ w: 0.03, h: 0.16, d: 0.03, x, y: 0.08, z: 0, color: '#f4f1ea', r: 0.006, name: 'Post' })),
    { w: 0.84, h: 0.02, d: 0.015, x: 0, y: 0.06, z: 0, color: '#f4f1ea', name: 'Rail' },
    { w: 0.84, h: 0.02, d: 0.015, x: 0, y: 0.12, z: 0, color: '#f4f1ea', name: 'Rail' },
  ],
  Person: [
    { w: 0.025, h: 0.07, d: 0.025, x: -0.015, y: 0.035, z: 0, color: '#3d4148', shape: 'capsule', name: 'Leg' },
    { w: 0.025, h: 0.07, d: 0.025, x: 0.015, y: 0.035, z: 0, color: '#3d4148', shape: 'capsule', name: 'Leg' },
    { w: 0.06, h: 0.08, d: 0.04, x: 0, y: 0.105, z: 0, color: '#3a6fd1', r: 0.012, name: 'Body' },
    { w: 0.045, h: 0.045, d: 0.045, x: 0, y: 0.17, z: 0, color: '#f1c9a5', shape: 'sphere', name: 'Head' },
  ],
  Barrel: [
    { w: 0.1, h: 0.14, d: 0.1, x: 0, y: 0.07, z: 0, color: '#8a5a35', shape: 'cylinder', name: 'Barrel' },
    { w: 0.105, h: 0.012, d: 0.105, x: 0, y: 0.03, z: 0, color: '#3d4148', shape: 'torus', name: 'Hoop' },
    { w: 0.105, h: 0.012, d: 0.105, x: 0, y: 0.11, z: 0, color: '#3d4148', shape: 'torus', name: 'Hoop' },
  ],
  Crate: [
    { w: 0.12, h: 0.12, d: 0.12, x: 0, y: 0.06, z: 0, color: '#c49a63', r: 0.006, name: 'Crate' },
    { w: 0.124, h: 0.02, d: 0.124, x: 0, y: 0.03, z: 0, color: '#9a7446', name: 'Band' },
    { w: 0.124, h: 0.02, d: 0.124, x: 0, y: 0.09, z: 0, color: '#9a7446', name: 'Band' },
  ],
  'Market umbrella': [
    { w: 0.015, h: 0.3, d: 0.015, x: 0, y: 0.15, z: 0, color: '#f4f1ea', shape: 'cylinder', name: 'Pole' },
    { w: 0.4, h: 0.09, d: 0.4, x: 0, y: 0.32, z: 0, color: '#d9443b', shape: 'cone', name: 'Canopy' },
    { w: 0.18, h: 0.015, d: 0.18, x: 0, y: 0.12, z: 0, color: '#f4f1ea', shape: 'cylinder', name: 'Table' },
  ],
  'Flower pot': [
    { w: 0.08, h: 0.07, d: 0.08, x: 0, y: 0.035, z: 0, color: '#c4553d', shape: 'cylinder', name: 'Pot' },
    { w: 0.09, h: 0.07, d: 0.09, x: 0, y: 0.09, z: 0, color: '#4f8a3a', shape: 'sphere', name: 'Leaves' },
    { w: 0.03, h: 0.03, d: 0.03, x: 0.02, y: 0.12, z: 0.02, color: '#f28cb8', shape: 'sphere', name: 'Flower' },
    { w: 0.03, h: 0.03, d: 0.03, x: -0.02, y: 0.125, z: -0.01, color: '#f2c230', shape: 'sphere', name: 'Flower' },
  ],
  Rock: [
    { w: 0.22, h: 0.12, d: 0.18, x: 0, y: 0.05, z: 0, color: '#9b978e', shape: 'sphere', name: 'Rock' },
    { w: 0.12, h: 0.08, d: 0.1, x: 0.08, y: 0.04, z: 0.05, color: '#827f78', shape: 'sphere', name: 'Rock' },
  ],
  'Road sign': [
    { w: 0.02, h: 0.3, d: 0.02, x: 0, y: 0.15, z: 0, color: '#aab4be', shape: 'cylinder', name: 'Pole' },
    { w: 0.12, h: 0.12, d: 0.012, x: 0, y: 0.3, z: 0.012, color: '#2f6fd6', r: 0.02, name: 'Sign' },
  ],
  Silo: [
    { w: 0.3, h: 0.6, d: 0.3, x: 0, y: 0.3, z: 0, color: '#e9edf0', shape: 'cylinder', name: 'Silo' },
    { w: 0.3, h: 0.12, d: 0.3, x: 0, y: 0.6, z: 0, color: '#c4553d', shape: 'dome', name: 'Top' },
    { w: 0.305, h: 0.02, d: 0.305, x: 0, y: 0.2, z: 0, color: '#9aa3ab', shape: 'torus', name: 'Ring' },
  ],
  Gate: [
    { w: 0.08, h: 0.4, d: 0.08, x: -0.25, y: 0.2, z: 0, color: '#efe6d2', r: 0.01, name: 'Pillar' },
    { w: 0.08, h: 0.4, d: 0.08, x: 0.25, y: 0.2, z: 0, color: '#efe6d2', r: 0.01, name: 'Pillar' },
    { w: 0.58, h: 0.16, d: 0.1, x: 0, y: 0.46, z: 0, color: '#2f7fc1', shape: 'arch', name: 'Arch' },
  ],
  'Water tank': [
    { w: 0.03, h: 0.4, d: 0.03, x: -0.1, y: 0.2, z: -0.1, color: '#5d6670', name: 'Leg' },
    { w: 0.03, h: 0.4, d: 0.03, x: 0.1, y: 0.2, z: -0.1, color: '#5d6670', name: 'Leg' },
    { w: 0.03, h: 0.4, d: 0.03, x: -0.1, y: 0.2, z: 0.1, color: '#5d6670', name: 'Leg' },
    { w: 0.03, h: 0.4, d: 0.03, x: 0.1, y: 0.2, z: 0.1, color: '#5d6670', name: 'Leg' },
    { w: 0.32, h: 0.24, d: 0.32, x: 0, y: 0.52, z: 0, color: '#4fa3d1', shape: 'capsule', name: 'Tank' },
  ],
  Wheel: wheel(0, 0.033, 0),
};
