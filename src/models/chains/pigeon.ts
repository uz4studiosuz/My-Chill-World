import { merge, rod, shape } from '../quality';
/** Rounded body, folded wings, neck, bill and two visible feet. */
export function pigeonGeometry(){return merge([
  shape('sphere',.031,.029,.048,0,.024,0,'#8c8f94','y',8),
  shape('sphere',.021,.023,.022,0,.043,.022,'#5d6670','y',8),
  shape('sphere',.026,.014,.031,0,.027,-.009,'#6c737d','y',8),
  shape('cone',.007,.013,.006,0,.041,.039,'#d6a357','z',6),
  ...[-1,1].flatMap(s=>[shape('sphere',.003,.003,.003,s*.007,.046,.030,'#212620','y',6),rod([s*.006,0,.002],[s*.006,.013,.002],.0015,'#aa735d',.0015,4)]),
]);}
