import { rod, roundBox } from '../quality';
/** Tapered legs and separate hooves. */
export function legs(x:number,z:number,h:number,colour:string){
  return [-x,x].flatMap(lx=>[-z,z].flatMap(lz=>[
    rod([lx,.012,lz],[lx,h,lz],.010,colour,.013,7),
    roundBox(.024,.014,.030,lx,.007,lz+.003,'#292824',.004),
  ]));
}
