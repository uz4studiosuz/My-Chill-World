import * as THREE from 'three';
import { merge, rod } from '../quality';
/** Low-cost stalks and tapered leaves, white for per-field ripening colours. */
export function cropGeometry():THREE.BufferGeometry{
  const parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<9;i++)for(let j=0;j<9;j++){
    if(i<2&&j>6)continue;
    for(let k=0;k<2;k++){
      const sign=k?1:-1,x=-1.2+j*.3+sign*.020,z=-1.2+i*.3,h=.13+((i+j+k)%3)*.015;
      parts.push(rod([x,0,z],[x,h,z],.004,'#ffffff',.0015,3));
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute([x,h*.45,z,x+sign*.022,h*.60,z-.008,x+sign*.039,h*.78,z,x+sign*.022,h*.60,z+.008],3));
      g.setIndex([0,1,2,0,2,3,0,2,1,0,3,2]);const leaf=g.toNonIndexed();g.dispose();leaf.computeVertexNormals();parts.push(leaf);
    }
  }
  return merge(parts);
}
