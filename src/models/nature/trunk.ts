import { merge, rod } from '../quality';
/** Tapered trunk, forked branches and exposed roots. */
export const trunkGeometry=()=>merge([
  rod([0,.02,0],[0,.46,0],.062,'#6b4a2e',.034,9),
  rod([0,.30,0],[.10,.49,.03],.026,'#765238',.012),
  rod([0,.35,0],[-.07,.53,-.035],.022,'#6b4a2e',.009),
  ...[0,1,2,3].map(i=>{const a=i*Math.PI/2+.3;
    return rod([0,.055,0],[Math.cos(a)*.085,.018,Math.sin(a)*.085],.027,'#5a3d26',.014,6);
  }),
]);
