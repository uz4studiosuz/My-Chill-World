import * as THREE from 'three';
import { merge, organic, paint } from '../quality';
/** Curved water streams and droplets; keeps the existing jet's animation origin. */
export function fountainJetGeometry():THREE.BufferGeometry{
  const paths=[[[0,.25,0],[0,.43,0],[0,.55,0],[.010,.56,0]],
    ...[0,1,2,3].map(i=>{const a=i*Math.PI/2;return [[0,.49,0],[Math.cos(a)*.07,.52,Math.sin(a)*.07],[Math.cos(a)*.13,.43,Math.sin(a)*.13],[Math.cos(a)*.15,.35,Math.sin(a)*.15]];})];
  return merge([
    ...paths.map((points,i)=>paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),10,i===0?.008:.005,5,false),i===0?'#d8efff':'#bfe3ff')),
    ...[0,1,2,3].map(i=>organic(.015,.028,.015,Math.cos(i*Math.PI/2)*.15,.34,Math.sin(i*Math.PI/2)*.15,'#d8efff',i)),
  ]);
}
