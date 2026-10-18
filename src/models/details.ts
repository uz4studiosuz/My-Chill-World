// Small architectural details shared by the building models: framed windows, doors with canopies and steps,
// parapets, rooftop machinery, planters, lamps, benches, bins and signs. Every helper returns geometry parts
// (boxes and shapes with baked colours) to be merged into a model. Models face +z.
import * as THREE from 'three';
import { box, shape, organic, rod } from './quality';

/** Window glass — must stay exactly this colour so windows glow at night. */
export const GLASS = '#a8d0e6';
export const FRAME = '#f4f1ea';
export const DARK = '#3a3f46';

type Face = 'front' | 'back' | 'left' | 'right';
type P = THREE.BufferGeometry[];

/**
 * A row of framed windows on one face of a block (centre cx, cz, half sizes hw, hd), between x (or z) a…b.
 * Each window: glass, a frame around it, a lintel and a sill.
 */
export function windows(face: Face, cx: number, cz: number, hw: number, hd: number, y: number, n: number, opt: { w?: number; h?: number; frame?: string; sill?: string; from?: number; to?: number } = {}): P {
  const w = opt.w ?? 0.11, h = opt.h ?? 0.12, fr = opt.frame ?? FRAME, sill = opt.sill ?? fr;
  const along = face === 'front' || face === 'back' ? hw : hd;
  const a = opt.from ?? -along + 0.12, b = opt.to ?? along - 0.12;
  const out: P = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1);
    out.push(...pane(face, cx, cz, hw, hd, t, y, w, h, fr, sill));
  }
  return out;
}

function pane(face:Face,cx:number,cz:number,hw:number,hd:number,t:number,y:number,w:number,h:number,fr:string,sill:string):P {
  const frame=.014;
  const parts:P=[
    box(w+.018,h+.018,.006,0,0,-.004,DARK),
    box(w,h,.012,0,0,0,GLASS),
    box(w+frame*2,frame,.022,0,h/2+frame/2,0,fr),
    box(frame,h,.022,-w/2-frame/2,0,0,fr),box(frame,h,.022,w/2+frame/2,0,0,fr),
    box(w+.04,.014,.045,0,-h/2-.011,.010,sill),
    box(w+.025,.004,.026,0,-h/2-.020,.012,DARK),
    box(.006,h,.016,0,0,.002,fr),
    box(w*.30,.005,.001,-w*.22,h*.29,.0066,'#cfe0ec'),
  ];
  if(w>.18)parts.push(box(w,.006,.016,0,0,.002,fr));
  const rotation=face==='front'?0:face==='back'?Math.PI:face==='left'?-Math.PI/2:Math.PI/2;
  const x=face==='front'||face==='back'?cx+t:cx+(face==='right'?1:-1)*(hw+.012);
  const z=face==='left'||face==='right'?cz+t:cz+(face==='front'?1:-1)*(hd+.012);
  parts.forEach(g=>g.rotateY(rotation).translate(x,y,z));return parts;
}

/** A shop window: one wide pane with mullions, a stone base and a lintel. */
export function shopFront(x: number, y0: number, z: number, w: number, h: number, frame = DARK): P {
  const out: P = [
    box(w, h, 0.012, x, y0 + h / 2, z, GLASS),
    box(w + 0.03, 0.04, 0.03, x, y0 - 0.02, z, '#8d8a83'),
    box(w + 0.03, 0.02, 0.025, x, y0 + h + 0.01, z, frame),
  ];
  const n = Math.max(1, Math.round(w / 0.16));
  for (let i = 0; i <= n; i++) out.push(box(0.012, h, 0.02, x - w / 2 + (w * i) / n, y0 + h / 2, z, frame));
  return out;
}

/** A door with a frame, a step and (optionally) a little canopy and a lamp. */
export function door(x: number, z: number, w = 0.14, h = 0.24, color = '#5c3a21', opt: { canopy?: string; glass?: boolean; lamp?: boolean } = {}): P {
  const out: P = [
    box(w, h, 0.014, x, h / 2 + 0.02, z, opt.glass ? GLASS : color),
    box(w + 0.03, 0.02, 0.02, x, h + 0.03, z, FRAME), box(0.015, h, 0.02, x - w / 2 - 0.008, h / 2 + 0.02, z, FRAME), box(0.015, h, 0.02, x + w / 2 + 0.008, h / 2 + 0.02, z, FRAME),
    box(w + 0.08, 0.02, 0.07, x, 0.02, z + 0.035, '#cfc8b6'),
  ];
  if(opt.glass)out.push(box(.008,h,.018,x,h/2+.02,z+.002,DARK),rod([x+w*.28,h*.42,z+.014],[x+w*.28,h*.64,z+.014],.0025,'#aeb8c0',.0025,6));
  else out.push(box(0.015, 0.015, 0.01, x + w * 0.3, h * 0.5, z + 0.01, '#d4af37'));
  if (opt.canopy) out.push(box(w + 0.12, 0.02, 0.12, x, h + 0.07, z + 0.06, opt.canopy), box(0.012, 0.06, 0.012, x - w / 2 - 0.04, h + 0.04, z + 0.11, DARK), box(0.012, 0.06, 0.012, x + w / 2 + 0.04, h + 0.04, z + 0.11, DARK));
  if (opt.lamp) out.push(box(0.02, 0.03, 0.02, x + w / 2 + 0.05, h * 0.75, z + 0.015, '#ffe9a8'));
  return out;
}

/** A thin parapet around a flat roof at height y. */
export function parapet(cx: number, cz: number, w: number, d: number, y: number, color = '#cfc8b6', t = 0.03, h = 0.04): P {
  return [
    box(w, h, t, cx, y + h / 2, cz + d / 2 - t / 2, color), box(w, h, t, cx, y + h / 2, cz - d / 2 + t / 2, color),
    box(t, h, d, cx + w / 2 - t / 2, y + h / 2, cz, color), box(t, h, d, cx - w / 2 + t / 2, y + h / 2, cz, color),
  ];
}

/** Rooftop machinery: air-conditioning units with fan grilles, vent pipes and a hatch. */
export function roofKit(cx: number, cz: number, w: number, d: number, y: number, seed = 1): P {
  const r = (i: number) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
  const out: P = [];
  const n = 1 + Math.round(r(1) * 2);
  for (let i = 0; i < n; i++) {
    const x = cx + (r(i + 2) - 0.5) * w * 0.6, z = cz + (r(i + 5) - 0.5) * d * 0.6;
    out.push(box(.12,.07,.09,x,y+.035,z,'#c9ccd0'),shape('cylinder',.07,.008,.07,x,y+.074,z,'#5d6670','y',12));
    for(let blade=0;blade<3;blade++)out.push(box(.052,.0015,.004,0,0,0,'#9aa3ab').rotateY(blade*Math.PI/3).translate(x,y+.0785,z));
    out.push(box(.003,.036,.062,x+.061,y+.036,z,'#737d87'));
  }
  out.push(shape('cylinder', 0.025, 0.08, 0.025, cx - w * 0.3, y + 0.04, cz + d * 0.25, '#8a8f98', 'y', 8));
  out.push(box(0.09, 0.03, 0.09, cx + w * 0.28, y + 0.015, cz - d * 0.25, '#7d828a'));
  return out;
}

/** A round planter with a little bush. */
export function planter(x:number,z:number,leaf='#5f9a3e'):P {
  return [shape('cylinder',.08,.05,.08,x,.045,z,'#a89f90','y',12),shape('tube',.083,.010,.083,x,.069,z,'#c4b9a8','y',12),
    shape('cylinder',.069,.005,.069,x,.068,z,'#554637','y',10),organic(.085,.073,.085,x,.104,z,leaf,3),organic(.053,.048,.051,x+.017,.116,z+.01,leaf,7)];
}

/** A street lamp. */
export function lamp(x:number,z:number,h=.36):P {
  return [rod([x,.02,z],[x,h+.02,z],.009,DARK,.006,8),shape('cylinder',.035,.024,.035,x,.032,z,DARK,'y',8),
    box(.06,.018,.06,x,h+.025,z,DARK),box(.04,.025,.04,x,h+.003,z,'#ffe9a8'),
    ...[-1,1].flatMap(sx=>[-1,1].map(sz=>box(.003,.030,.003,x+sx*.022,h+.003,z+sz*.022,DARK)))];
}

/** A bench seen from the front. */
export function bench(x:number,z:number,rotY=false):P {
  const parts:P=[
    ...[0,1,2,3].map(i=>box(.16,.010,.010,0,.050,-.018+i*.012,'#8a5a35')),
    ...[0,1,2].map(i=>box(.16,.009,.009,0,.070+i*.012,-.025,'#8a5a35')),
    ...[-.057,.057].flatMap(lx=>[box(.009,.045,.043,lx,.026,0,DARK),box(.008,.051,.008,lx,.071,-.025,DARK)]),
  ];
  parts.forEach(g=>g.rotateY(rotY?Math.PI/2:0).translate(x,0,z));return parts;
}

/** A litter bin. */
export function bin(x:number,z:number):P {
  return [shape('cylinder',.035,.06,.035,x,.04,z,'#3f6b4a','y',10),shape('cylinder',.039,.006,.039,x,.073,z,DARK,'y',10),
    box(.018,.009,.002,x,.061,z+.0175,'#202825'),shape('cylinder',.037,.006,.037,x,.012,z,DARK,'y',10)];
}

/** A sign board on a wall (or a fascia): coloured board with a lighter strip of "letters". */
export function sign(x: number, y: number, z: number, w: number, h: number, bg: string, letters = '#f4f1ea'): P {
  const out: P = [box(w, h, 0.025, x, y, z, bg)];
  const n = Math.max(2, Math.round(w / 0.05));
  for (let i = 0; i < n; i++) out.push(box(w / n * 0.6, h * 0.45, 0.01, x - w / 2 + (w * (i + 0.5)) / n, y, z + 0.016, letters));
  return out;
}

/** A pavement strip in front of a building (with a kerb). */
export function pavement(cx: number, z: number, w: number, d: number): P {
  return [box(w, 0.012, d, cx, 0.021, z, '#cfc8b6'), box(w, 0.02, 0.02, cx, 0.02, z + d / 2, '#a8a294')];
}
