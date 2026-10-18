import { box, merge, rod, roundBox } from '../quality';
import { wheel } from './_shared';
/** Diesel locomotive with a driver cab, bogies, vents and walkway rails. */
export const locoGeometry=()=>merge([
  box(.25,.032,.61,0,.048,0,'#26292e'),
  roundBox(.192,.145,.43,0,.154,.045,'#c4553d',.009),
  roundBox(.217,.205,.18,0,.236,-.18,'#c4553d',.008),
  roundBox(.235,.018,.20,0,.345,-.18,'#2d3138',.005),
  box(.205,.075,.043,0,.108,.279,'#c4553d'),
  box(.151,.045,.003,0,.278,-.087,'#2f3d4a'),
  box(.153,.050,.003,0,.278,-.273,'#2f3d4a'),
  ...[-1,1].flatMap(side=>[
    box(.003,.054,.116,side*.110,.278,-.18,'#2f3d4a'),
    box(.003,.057,.108,side*.098,.154,.079,'#343b43'),
    ...[0,1,2,3,4,5].map(i=>box(.004,.002,.092,side*.100,.131+i*.009,.079,'#6b737e')),
    rod([side*.119,.087,-.09],[side*.119,.087,.29],.002,'#d1ccc0',.002,5),
    ...[-.08,.08,.27].map(z=>rod([side*.119,.056,z],[side*.119,.087,z],.0016,'#d1ccc0',.0016,5)),
    box(.032,.018,.004,side*.065,.148,.303,'#fff6c8'),
    ...[-.235,-.17,.17,.235].flatMap(z=>wheel(side*.108,z,.024,.024)),
  ]),
  box(.065,.013,.004,0,.177,.269,'#e1d9c6'),
  // Two 0.31 half-lengths meet at Railway.GAP=0.62, without intersecting coaches.
  box(.036,.013,.020,0,.035,.300,'#26292e'),box(.036,.013,.020,0,.035,-.300,'#26292e'),
  box(.050,.018,.063,0,.235,.078,'#2d3138'),
]);
