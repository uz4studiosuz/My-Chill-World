import { merge, organic } from '../quality';
/** Asymmetric crown; white remains available for seasonal instance tinting. */
export const canopyGeometry=()=>merge([
  organic(.65,.47,.64,0,.66,0,'#ffffff',2,1),
  organic(.46,.34,.44,.04,.94,-.04,'#ffffff',5),
  organic(.33,.29,.33,-.23,.54,.18,'#ffffff',8),
  organic(.32,.29,.32,.25,.57,-.17,'#ffffff',11),
  organic(.31,.28,.30,.19,.76,.22,'#ffffff',17),
  organic(.27,.24,.25,-.17,.86,-.20,'#ffffff',22),
]);
