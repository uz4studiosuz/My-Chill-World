import { merge, rod, shape } from '../quality';
/** Overlapping tapered whorls form a readable conifer silhouette. */
export const pineGeometry=()=>merge([
  rod([0,0,0],[0,1.02,0],.052,'#6b4a2e',.014,7),
  ...[0,1,2,3,4,5].map(i=>{
    const width=.66-i*.095,h=.35-i*.017,y=.38+i*.13;
    return shape('cone',width,h,width,0,y,0,['#2a6236','#2f6b3c','#357543','#3a7a46','#3b7d48','#428650'][i],'y',9).rotateY(i*.38);
  }),
  shape('cone',.11,.23,.11,0,1.07,0,'#4a9058','y',7),
]);
