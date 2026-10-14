// Shared colours and helpers of the vehicles models.
import { cylX } from '../../utils/voxel';

// Vehicles face +z. Car body is white so it can be tinted per instance.
/** A round tyre with a silver rim and a dark hub. */
export const wheel = (x: number, z: number, r = 0.024, w = 0.026) => [
  cylX(r, w, x, r, z, '#1f2226', 14),
  cylX(r * 0.82, w * 0.6, x, r, z, '#2b2f35', 14),
  cylX(r * 0.56, w + 0.003, x, r, z, '#c9ced4', 10),
  cylX(r * 0.2, w + 0.006, x, r, z, '#5d6670', 6),
];
