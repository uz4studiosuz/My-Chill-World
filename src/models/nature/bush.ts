import { merge, organic } from '../quality';
/** Overlapping leaf clusters, tinted by the terrain. */
export const bushGeometry=()=>merge([
  organic(.24,.15,.22,0,.079,0,'#ffffff',3),
  organic(.16,.12,.16,.05,.146,.02,'#ffffff',9),
  organic(.14,.12,.14,-.085,.085,-.055,'#ffffff',15),
]);
