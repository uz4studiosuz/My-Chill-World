import { merge, organic } from '../quality';
/** Weathered facets. Tint is supplied by the terrain. */
export const rockGeometry=()=>{
  const g=merge([organic(.47,.31,.40,0,.14,0,'#ffffff',31,1),organic(.28,.20,.25,.16,.09,.13,'#ffffff',12)]);
  g.translate(0,-g.boundingBox!.min.y,0);g.computeBoundingBox();g.computeBoundingSphere();return g;
};
