import { merge, roundBox, shape } from '../quality';
/** Swaddled infant with a rounded face and a folded blanket edge. */
export const babyGeometry=()=>merge([
  roundBox(.034,.030,.052,0,.11,.036,'#f6efe6',.008),
  shape('sphere',.026,.026,.026,0,.126,.062,'#f1c9a5','y',8),
  roundBox(.036,.008,.020,0,.119,.039,'#e1d6c7',.002),
]);
