import * as THREE from 'three';
import { cylX, merge, paint, rod, shape } from '../quality';
/** Swept-wing airliner, facing +Z. Fuselage, intakes and fins have actual profiles. */
export function planeGeometry():THREE.BufferGeometry{
  const profile=[[.008,-.36],[.035,-.31],[.059,-.17],[.061,.26],[.050,.345],[.025,.40],[0,.425]].map(([r,z])=>new THREE.Vector2(r,z));
  const parts:THREE.BufferGeometry[]=[paint(new THREE.LatheGeometry(profile,20).rotateX(Math.PI/2).translate(0,.12,0),'#f2f4f6')];
  const wing=(side:number,span:number,front:number,rootDepth:number,y:number)=>{
    const s=new THREE.Shape();s.moveTo(0,front);s.lineTo(side*span,front-.16*span/.37);s.lineTo(side*span,front-.22*span/.37);s.lineTo(0,front-rootDepth);s.closePath();
    return paint(new THREE.ExtrudeGeometry(s,{depth:.014,bevelEnabled:false}).rotateX(Math.PI/2).translate(0,y+.007,0),'#e9edf0');
  };
  for(const side of [-1,1]){
    parts.push(wing(side,.37,.10,.18,.10),wing(side,.15,-.267,.095,.145));
    parts.push(shape('tube',.059,.059,.13,side*.18,.068,.05,'#d0d7dd','z',14));
    parts.push(paint(new THREE.CircleGeometry(.025,14).translate(side*.18,.068,.116),'#343b43'));
    parts.push(shape('cylinder',.012,.012,.015,side*.18,.068,.119,'#89949f','z',8));
    for(let i=0;i<10;i++)parts.push(shape('sphere',.004,.013,.022,side*.059,.140,-.17+i*.044,'#31495d','y',6));
    parts.push(rod([side*.098,.032,-.025],[side*.098,.086,-.025],.004,'#8a929c',.004,6),cylX(.011,.014,side*.10,.012,-.025,'#26292e',10));
  }
  const fin=new THREE.Shape();fin.moveTo(-.36,.14);fin.lineTo(-.35,.31);fin.lineTo(-.28,.31);fin.lineTo(-.22,.14);fin.closePath();
  parts.push(paint(new THREE.ExtrudeGeometry(fin,{depth:.014,bevelEnabled:false}).rotateY(-Math.PI/2).translate(.007,0,0),'#3a6fd1'));
  parts.push(shape('sphere',.102,.035,.060,0,.158,.336,'#31495d','y',10));
  parts.push(rod([0,.021,.25],[0,.082,.25],.003,'#8a929c',.003,6),cylX(.010,.016,0,.012,.25,'#26292e',10));
  return merge(parts);
}
