import * as THREE from 'three';
import { box, cylX, paint } from '../quality';

/** Rounded tyre profile and an open five-spoke alloy wheel. Axis X, ground Y=0. */
export const wheel=(x:number,z:number,r=.024,w=.026):THREE.BufferGeometry[]=>{
  const side=x<0?-1:1,face=x+side*w*.51;
  const profile=[[.58,-.45],[.87,-.5],[1,-.29],[1,.29],[.87,.5],[.58,.45],[.58,-.45]].map(([radius,y])=>new THREE.Vector2(radius*r,y*w));
  return [
    paint(new THREE.LatheGeometry(profile,16).rotateZ(-Math.PI/2).translate(x,r,z),'#202329'),
    cylX(r*.60,w*.84,x,r,z,'#46505b',12),
    paint(new THREE.TorusGeometry(r*.64,r*.045,4,16).rotateY(Math.PI/2).translate(face,r,z),'#c9ced4'),
    ...[0,1,2,3,4].map(i=>box(w*.08,r*.56,r*.09,0,r*.35,0,'#c9ced4').rotateX(i*Math.PI*2/5).translate(face,r,z)),
    cylX(r*.19,w*.12,face,r,z,'#8a929c',10),
  ];
};

/** Lower body skins with real wheel openings; the narrow core clears inner tyre faces. */
export function archedBody(w:number,d:number,bottom:number,top:number,axles:number[],r:number,colour:string,z0=0){
  const parts:THREE.BufferGeometry[]=[
    box(w*.67,top-bottom,d-.008,0,(top+bottom)/2,z0,colour),
    ...[-1,1].map(end=>box(w,top-bottom,.004,0,(top+bottom)/2,z0+end*(d/2-.002),colour)),
  ];
  const stations=new Set<number>();
  for(let i=0;i<=32;i++)stations.add(z0-d/2+i*d/32);
  const arch=r*1.16;
  for(const axle of axles)for(let i=0;i<=12;i++){
    const z=axle+Math.cos(i*Math.PI/12)*arch;if(z>z0-d/2&&z<z0+d/2)stations.add(z);
  }
  const zs=[...stations].sort((a,b)=>a-b);
  for(const side of [-1,1]){
    const positions:number[]=[],indices:number[]=[],uv:number[]=[];
    for(const z of zs){
      let low=bottom;for(const axle of axles){const dz=z-axle;if(Math.abs(dz)<arch)low=Math.max(low,r+Math.sqrt(arch*arch-dz*dz));}
      positions.push(side*w/2,low,z,side*w/2,top,z);uv.push(0,0,0,1);
    }
    for(let i=0;i<zs.length-1;i++){const a=i*2;indices.push(...(side>0?[a,a+1,a+2,a+1,a+3,a+2]:[a,a+2,a+1,a+1,a+2,a+3]));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();parts.push(paint(g,colour));
  }
  return parts;
}
