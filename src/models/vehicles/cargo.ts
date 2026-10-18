import { merge, organic } from '../quality';
/** An irregular load of quarried stone, sitting at the existing truck-bed height. */
export const cargoGeometry=()=>merge([
  organic(.17,.072,.22,0,.175,-.08,'#aaa59b',4,1),
  organic(.09,.055,.10,.023,.221,-.10,'#bdb8ae',9),
  organic(.072,.047,.09,-.044,.207,-.035,'#94958d',13),
]);
