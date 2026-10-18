import { shape } from '../quality';
/** Circular lens; remains white so the signal's existing material controls colour. */
export const trafficLampGeometry=()=>shape('cylinder',.040,.040,.014,0,.36,.031,'#ffffff','z',16);
