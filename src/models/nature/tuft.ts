import * as THREE from 'three';
/** Three tapered, bent grass blades, visible from both sides. */
export const tuftGeometry=()=>{
  const p:number[]=[],normals:number[]=[],indices:number[]=[];
  for(let blade=0;blade<3;blade++){
    const a=blade*Math.PI*2/3,height=.12-blade*.016;
    for(const facing of [1,-1]){
      const offset=p.length/3;
      for(let j=0;j<=3;j++){
        const t=j/3,width=.012*(1-t)+.0004,bend=.018*t*t;
        for(const side of [-1,1]){
          p.push(Math.cos(a)*bend-Math.sin(a)*width*side,height*t,Math.sin(a)*bend+Math.cos(a)*width*side);
          normals.push(facing*Math.sin(a),0,-facing*Math.cos(a));
        }
      }
      for(let j=0;j<3;j++){
        const n=offset+j*2;
        indices.push(...(facing>0?[n,n+1,n+2,n+1,n+3,n+2]:[n,n+2,n+1,n+1,n+2,n+3]));
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return g;
};
