import { box, merge, rod, roundBox, shape } from '../quality';
/** Tapered pole, rounded signal housing and recessed inactive lenses. */
export const trafficPoleGeometry=()=>merge([
  rod([0,.01,0],[0,.37,0],.012,'#4a4f57',.009,10),
  shape('cylinder',.045,.022,.045,0,.011,0,'#3a3f46','y',10),
  roundBox(.060,.140,.050,0,.36,0,'#2d3138',.007),
  ...[.315,.36,.405].flatMap(y=>[shape('cylinder',.044,.044,.004,0,y,.027,'#171e23','z',14),box(.048,.004,.022,0,y+.024,.031,'#262c32')]),
]);
