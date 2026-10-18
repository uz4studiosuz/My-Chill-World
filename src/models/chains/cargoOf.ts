import * as THREE from 'three';
import { box, merge, shape, organic, rod } from '../quality';
import { moreCargo } from '../chains2';
import { CargoKind } from './_shared';

export function cargoOf(kind: CargoKind): THREE.BufferGeometry {
  switch (kind) {
    case 'bricks': case 'steel': case 'milk': case 'dairy': return moreCargo(kind);
    case 'logs': return merge([0,1,2,3,4].flatMap(i=>{
      const x=-.05+(i%3)*.05,y=.17+Math.floor(i/3)*.045;
      return [shape('cylinder',.05,.05,.25,x,y,-.08,'#8a5a35','z',14),shape('cylinder',.042,.042,.001,x,y,.046,'#d7b57f','z',12),shape('cylinder',.042,.042,.001,x,y,-.206,'#d7b57f','z',12)];
    }));
    case 'planks': return merge([
      ...[0,1,2,3].map(i=>box(.17,.022,.25,0,.165+i*.024,-.08,i%2?'#e2c48e':'#d4b27a')),
      ...[-.16,0].flatMap(z=>[box(.174,.002,.012,0,.249,z,'#7d6c52'),box(.002,.095,.012,-.086,.202,z,'#7d6c52'),box(.002,.095,.012,.086,.202,z,'#7d6c52')]),
    ]);
    case 'grain': return merge([0,1,2,3].flatMap(i=>{
      const x=-.04+(i%2)*.08,z=-.15+Math.floor(i/2)*.12;
      return [organic(.08,.065,.10,x,.18,z,'#d9b45a',i),shape('cylinder',.012,.012,.012,x,.211,z,'#b99a48','y',6)];
    }));
    case 'flour': return merge([0, 1, 2, 3, 4, 5].map((i) => box(0.075, 0.05, 0.1, -0.04 + (i % 2) * 0.08, 0.18 + Math.floor(i / 4) * 0.05, -0.15 + (Math.floor(i / 2) % 2) * 0.12, '#f4f1ea')));
    case 'bread': return merge([0, 1, 2, 3].flatMap((i) => [box(0.08, 0.05, 0.11, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#8a5a35'), box(0.06, 0.02, 0.09, -0.04 + (i % 2) * 0.08, 0.21, -0.15 + Math.floor(i / 2) * 0.12, '#d9a04a')]));
    case 'cotton': return merge([0, 1, 2, 3].map((i) => box(0.08, 0.07, 0.11, -0.04 + (i % 2) * 0.08, 0.19, -0.15 + Math.floor(i / 2) * 0.12, i % 2 ? '#f4f4f2' : '#e6e3dc')));
    case 'corn': return merge([0,1,2,3,4,5].map(i=>{
      const x=-.05+(i%3)*.05,z=-.14+Math.floor(i/3)*.10;
      return rod([x,.19,z-.046],[x,.19,z+.046],.016,'#e8c440',.009,10);
    }));
    case 'trash': return merge([box(0.18, 0.11, 0.26, 0, 0.2, -0.08, '#3a7a42'), box(0.19, 0.02, 0.27, 0, 0.26, -0.08, '#2d5a32')]);
    case 'veg': return merge([0, 1, 2, 3].flatMap((i) => [box(0.08, 0.05, 0.11, -0.04 + (i % 2) * 0.08, 0.18, -0.15 + Math.floor(i / 2) * 0.12, '#c98a5a'), box(0.06, 0.02, 0.09, -0.04 + (i % 2) * 0.08, 0.21, -0.15 + Math.floor(i / 2) * 0.12, i % 2 ? '#d9443b' : '#5f9a3e')]));
    default: return merge([box(0.16, 0.07, 0.22, 0, 0.17, -0.08, '#aaa59b'), box(0.09, 0.05, 0.1, 0.02, 0.22, -0.1, '#bdb8ae')]);
  }
}
