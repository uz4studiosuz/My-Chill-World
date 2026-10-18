import { merge, organic, rod, shape } from '../quality';
import { legs } from './_shared';
/** Rounded torso, flank patches, separate muzzle, horns and a tail. */
export const cowGeometry=()=>merge([
  shape('sphere',.145,.11,.23,0,.13,0,'#f4f1ea','y',12),
  shape('sphere',.075,.085,.085,0,.17,.14,'#f4f1ea','y',10),
  shape('sphere',.066,.034,.040,0,.151,.182,'#e7b3a8','y',10),
  ...[-1,1].flatMap(side=>[
    organic(.009,.046,.072,side*.066,.14,-.025,'#2b2622',3),
    organic(.008,.035,.045,side*.063,.12,.058,'#2b2622',8),
    shape('sphere',.037,.012,.025,side*.046,.192,.133,'#f4f1ea','y',8),
    shape('sphere',.020,.006,.014,side*.048,.197,.136,'#d7aba2','y',6),
    shape('sphere',.008,.008,.007,side*.029,.181,.169,'#242721','y',6),
    shape('sphere',.004,.004,.003,side*.028,.183,.173,'#f4f1ea','y',6),
    shape('sphere',.006,.005,.003,side*.017,.155,.201,'#775b56','y',6),
    rod([side*.025,.199,.125],[side*.043,.220,.118],.004,'#d8cfa8',.001,6),
  ]),
  ...legs(.042,.071,.085,'#e6e0d5'),
  rod([0,.16,-.104],[.006,.082,-.135],.004,'#f4f1ea',.0025,6),
  organic(.014,.022,.014,.006,.079,-.135,'#2b2622',6),
  shape('sphere',.044,.027,.047,0,.078,-.027,'#deb2a7','y',8),
]);
