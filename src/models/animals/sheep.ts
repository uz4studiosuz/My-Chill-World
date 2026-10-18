import { merge, organic, shape } from '../quality';
import { legs } from './_shared';
export const sheepGeometry=()=>merge([
  shape('sphere',.145,.115,.19,0,.127,0,'#e5e0d5','y',10),
  ...[-1,1].flatMap(side=>[-.055,.018,.065].map((z,i)=>organic(.085,.080,.085,side*.035,.151,z,i%2?'#f8f6f0':'#f2efe6',i+4))),
  organic(.10,.07,.09,0,.182,-.015,'#f8f6f0',8),
  shape('sphere',.057,.066,.073,0,.151,.115,'#3b3531','y',10),
  shape('sphere',.041,.028,.036,0,.132,.148,'#514842','y',8),
  ...[-1,1].flatMap(side=>[
    shape('sphere',.035,.012,.021,side*.037,.166,.105,'#3b3531','y',8),
    shape('sphere',.006,.006,.004,side*.021,.159,.140,'#151714','y',6),
    shape('sphere',.002,.002,.002,side*.020,.161,.142,'#ffffff','y',6),
  ]),
  ...legs(.040,.055,.075,'#3b3531'),
  organic(.035,.035,.035,0,.134,-.101,'#f2efe6',6),
]);
