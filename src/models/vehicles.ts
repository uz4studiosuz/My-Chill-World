import { box, merge } from '../utils/voxel';

// Vehicles face +z. Car body is white so it can be tinted per instance.

export const carGeometry = () => merge([
  box(0.16, 0.07, 0.3, 0, 0.065, 0),
  box(0.14, 0.07, 0.15, 0, 0.135, -0.025, '#cfe0ec'),
  box(0.17, 0.045, 0.06, 0, 0.03, 0.09, '#26292e'),
  box(0.17, 0.045, 0.06, 0, 0.03, -0.09, '#26292e'),
  box(0.12, 0.02, 0.01, 0, 0.07, 0.151, '#fff6c8'),
  box(0.12, 0.02, 0.01, 0, 0.07, -0.151, '#d9443b'),
]);

export const truckGeometry = () => merge([
  box(0.19, 0.17, 0.12, 0, 0.115, 0.15, '#e8a23a'),
  box(0.17, 0.06, 0.02, 0, 0.16, 0.211, '#cfe0ec'),
  box(0.2, 0.05, 0.42, 0, 0.055, -0.02, '#3d4148'),
  box(0.2, 0.08, 0.27, 0, 0.11, -0.08, '#c98a2b'),
  box(0.21, 0.05, 0.07, 0, 0.03, 0.14, '#26292e'),
  box(0.21, 0.05, 0.07, 0, 0.03, -0.15, '#26292e'),
]);

export const cargoGeometry = () => merge([
  box(0.16, 0.07, 0.22, 0, 0.17, -0.08, '#aaa59b'),
  box(0.09, 0.05, 0.1, 0.02, 0.22, -0.1, '#bdb8ae'),
]);
