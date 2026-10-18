import { merge, rod, roundBox, shape } from '../quality';
/** Tapered bark, cut ends, growth rings and a raised supporting hand. */
export const logGeometry=()=>merge([
  rod([.043,.148,-.092],[.043,.148,.081],.017,'#7a4f2c',.014,12),
  ...[-1,1].flatMap(end=>{
    const z=end>0?.082:-.093;
    return [shape('cylinder',.027,.027,.0015,.043,.148,z,'#e2bf86','z',12),shape('cylinder',.017,.017,.0018,.043,.148,z+end*.001,'#b98a52','z',12),shape('cylinder',.006,.006,.002,.043,.148,z+end*.002,'#8a5a35','z',8)];
  }),
  rod([.050,.156,-.03],[.059,.176,-.03],.004,'#5c3a21',.0025,6),
  roundBox(.012,.035,.012,.045,.12,.035,'#c98f62',.003),roundBox(.014,.012,.016,.045,.135,.06,'#d9a77a',.003),
]);
