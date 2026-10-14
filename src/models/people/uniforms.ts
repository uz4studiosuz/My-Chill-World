// Work clothes worn over the person models: jackets, vests, coats and the hats of each trade.
// Drawn as a second instanced mesh with the same transform as the person, slightly larger so it covers the clothes.
import { box, merge } from '../../utils/voxel';
import type * as THREE from 'three';

export type Uniform =
  | 'soldier' | 'officer' | 'police' | 'policechief' | 'firefighter' | 'nurse' | 'doctor' | 'builder' | 'foreman'
  | 'miner' | 'farmer' | 'driver' | 'pilot' | 'chef' | 'cleaner' | 'clerk' | 'imam' | 'shop';

/** Jacket over the torso and sleeves (covers both the shirt of the men and the top of the women's dress). */
const jacket = (c: string, collar?: string) => [
  box(0.064, 0.068, 0.038, 0, 0.1, 0, c),
  box(0.018, 0.054, 0.022, -0.039, 0.102, 0, c),
  box(0.018, 0.054, 0.022, 0.039, 0.102, 0, c),
  ...(collar ? [box(0.03, 0.01, 0.04, 0, 0.13, 0.001, collar)] : []),
];
/** A long coat down to the knees. */
const coat = (c: string) => [...jacket(c), box(0.066, 0.05, 0.04, 0, 0.055, 0, c)];
const helmet = (c: string) => [box(0.046, 0.016, 0.046, 0, 0.178, 0, c), box(0.052, 0.004, 0.052, 0, 0.17, 0, c)];
const cap = (c: string, band?: string) => [
  box(0.046, 0.014, 0.046, 0, 0.18, 0, c),
  box(0.03, 0.004, 0.016, 0, 0.172, 0.027, '#1e2226'),
  ...(band ? [box(0.047, 0.004, 0.047, 0, 0.174, 0, band)] : []),
];
const epaulettes = (c: string) => [box(0.014, 0.005, 0.02, -0.03, 0.135, 0, c), box(0.014, 0.005, 0.02, 0.03, 0.135, 0, c)];
const stripes = (c: string) => [box(0.066, 0.006, 0.04, 0, 0.08, 0, c), box(0.066, 0.006, 0.04, 0, 0.115, 0, c)];

export const UNIFORMS: Record<Uniform, () => THREE.BufferGeometry> = {
  soldier: () => merge([...jacket('#5b6b3a'), box(0.02, 0.012, 0.004, 0.015, 0.11, 0.02, '#4a5a2e'), ...helmet('#4f5d33')]),
  officer: () => merge([...jacket('#4a5a32', '#e9e1c8'), ...epaulettes('#e5b93c'), box(0.008, 0.008, 0.004, -0.015, 0.115, 0.02, '#d9443b'), ...cap('#3e4c2a', '#e5b93c')]),
  police: () => merge([...jacket('#2f4f8f', '#d8e2f0'), box(0.012, 0.012, 0.004, -0.016, 0.112, 0.02, '#e5b93c'), ...cap('#1f2f55')]),
  policechief: () => merge([...jacket('#1f2f55', '#d8e2f0'), ...epaulettes('#e5b93c'), box(0.012, 0.012, 0.004, -0.016, 0.112, 0.02, '#e5b93c'), ...cap('#16213d', '#e5b93c')]),
  firefighter: () => merge([...jacket('#2d2f33'), ...stripes('#f2d23a'), ...helmet('#d9443b')]),
  nurse: () => merge([...jacket('#7fc4d6', '#ffffff'), box(0.03, 0.01, 0.03, 0, 0.18, 0.004, '#ffffff')]),
  doctor: () => merge([...coat('#f4f4f2'), box(0.004, 0.03, 0.004, -0.01, 0.11, 0.021, '#3a3d42'), box(0.01, 0.01, 0.004, -0.01, 0.094, 0.021, '#9aa3ab')]),
  builder: () => merge([...jacket('#f07a1e'), ...stripes('#f2efe2'), ...helmet('#f2c230')]),
  foreman: () => merge([...jacket('#f07a1e', '#3a6fd1'), ...stripes('#f2efe2'), ...helmet('#f2efe2')]),
  miner: () => merge([...jacket('#4a4f57'), ...stripes('#f2c230'), ...helmet('#f2c230'), box(0.01, 0.01, 0.006, 0, 0.182, 0.024, '#fff6c8')]),
  farmer: () => merge([box(0.064, 0.06, 0.038, 0, 0.098, 0, '#4f7fb0'), box(0.07, 0.006, 0.07, 0, 0.176, 0, '#d8b45a'), box(0.04, 0.014, 0.04, 0, 0.184, 0, '#d8b45a')]),
  driver: () => merge([...jacket('#2a3a5a', '#d8e2f0'), ...cap('#1f2f55')]),
  pilot: () => merge([...jacket('#f4f4f2', '#1f2f55'), ...epaulettes('#e5b93c'), box(0.008, 0.03, 0.004, 0, 0.11, 0.02, '#1f2f55'), ...cap('#1f2f55', '#e5b93c')]),
  chef: () => merge([...jacket('#f4f4f2'), box(0.034, 0.03, 0.034, 0, 0.19, 0, '#ffffff'), box(0.042, 0.008, 0.042, 0, 0.176, 0, '#ffffff')]),
  cleaner: () => merge([...jacket('#3f8f4f'), ...stripes('#f2d23a'), ...cap('#3f8f4f')]),
  clerk: () => merge([...jacket('#2e3440', '#f2efe2'), box(0.008, 0.03, 0.004, 0, 0.11, 0.02, '#a12b2b')]),
  imam: () => merge([...coat('#f4f2ea'), box(0.046, 0.018, 0.046, 0, 0.18, 0, '#ffffff'), box(0.03, 0.01, 0.03, 0, 0.192, 0, '#ffffff')]),
  shop: () => merge([box(0.05, 0.07, 0.006, 0, 0.09, 0.02, '#c4553d'), box(0.05, 0.004, 0.04, 0, 0.13, 0, '#c4553d')]),
};

export const UNIFORM_KINDS = Object.keys(UNIFORMS) as Uniform[];

/** The work clothes of a workplace: [ordinary staff, senior staff]. */
export const UNIFORM_OF: Record<string, [Uniform, Uniform?]> = {
  military: ['soldier', 'officer'], police: ['police', 'policechief'], firestation: ['firefighter'],
  hospital: ['nurse', 'doctor'], pharmacy: ['nurse', 'doctor'], construction: ['builder', 'foreman'],
  quarry: ['miner'], coalmine: ['miner'], ironmine: ['miner'], steelmill: ['miner'], brickworks: ['builder'],
  farm: ['farmer'], orchard: ['farmer'], ranch: ['farmer'], dairy: ['chef'], fishery: ['farmer'],
  busdepot: ['driver'], trainstation: ['driver'], airport: ['driver', 'pilot'],
  bakery: ['chef'], teahouse: ['chef'], hotel: ['clerk'], bank: ['clerk'], office: ['clerk'], townhall: ['clerk'], migration: ['clerk'],
  landfill: ['cleaner'], recycling: ['cleaner'], sewage: ['cleaner'], mosque: ['imam'],
  grocery: ['shop'], supermarket: ['shop'], market: ['shop'], clothes: ['shop'], kiosk: ['shop'], gasstation: ['cleaner'],
};
