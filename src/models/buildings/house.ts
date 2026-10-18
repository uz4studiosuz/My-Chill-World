import * as THREE from 'three';
import { box, merge, gableRoof } from '../quality';
import { WALLS, ROOFS, GLASS } from './_shared';
import { door, windows } from '../details';

export function houseGeometry(variant: number, floors = 1): THREE.BufferGeometry {
  const wall = WALLS[variant % 4], roof = ROOFS[(variant >> 2) % 4];
  const up = (floors - 1) * 0.34;
  const extra: THREE.BufferGeometry[] = [];
  for (let f = 1; f < floors; f++) {
    const y = 0.26 + f * 0.34;
    extra.push(box(0.12, 0.1, 0.02, -0.19, y, 0.205, GLASS), box(0.12, 0.1, 0.02, 0.19, y, 0.205, GLASS), box(0.64, 0.025, 0.54, 0, 0.42 + (f - 1) * 0.34, -0.06, '#cfc8b6'));
  }
  return merge([
    ...extra,
    box(0.22, 0.02, 0.32, 0.2, 0.01, 0.34, '#bdb7aa'),
    box(0.1, 0.015, 0.3, -0.12, 0.008, 0.35, '#cfc8b6'),
    box(0.62, 0.42 + up, 0.52, 0, (0.42 + up) / 2, -0.06, wall),
    box(.70,.023,.60,0,.422+up,-.06,'#514c45'),
    ...gableRoof(.72,.62,.432+up,.26,0,-.06,roof,wall),
    box(0.08, 0.18, 0.08, 0.18, 0.68 + up, -0.14, '#8a7d70'),
    ...door(0,.211,.12,.20,'#6b4a2e',{canopy:roof,lamp:true}),
    ...windows('front',0,-.06,.31,.26,.26,2,{w:.12,h:.10,from:-.19,to:.19}),
    ...windows('left',0,-.06,.31,.26,.26,1,{w:.12,h:.10}),
    ...windows('right',0,-.06,.31,.26,.26,1,{w:.12,h:.10}),
    // window sills, shutters, step, porch lamp, chimney cap, mailbox and a little front garden
    box(0.15, 0.015, 0.03, -0.19, 0.205, 0.215, '#f4f1ea'), box(0.15, 0.015, 0.03, 0.19, 0.205, 0.215, '#f4f1ea'),
    box(0.025, 0.1, 0.01, -0.27, 0.26, 0.208, roof), box(0.025, 0.1, 0.01, -0.11, 0.26, 0.208, roof),
    box(0.025, 0.1, 0.01, 0.11, 0.26, 0.208, roof), box(0.025, 0.1, 0.01, 0.27, 0.26, 0.208, roof),
    box(0.18, 0.025, 0.06, 0, 0.012, 0.235, '#bdb7aa'),
    box(0.02, 0.025, 0.02, 0.085, 0.215, 0.215, '#ffe9a8'),
    box(0.1, 0.03, 0.1, 0.18, 0.79 + up, -0.14, '#5d544b'),
    box(0.02, 0.07, 0.02, -0.4, 0.035, 0.42, '#6b4a2e'), box(0.05, 0.035, 0.035, -0.4, 0.085, 0.42, '#3a6fd1'),
    box(0.03, 0.05, 0.3, -0.42, 0.025, 0.28, '#e8e3d6'),
    ...[-0.34, -0.28, -0.22].map((x, i) => box(0.04, 0.04, 0.04, x, 0.03, 0.4, ['#e85a7a', '#f2c230', '#f2efe2'][i])),
    box(0.18, 0.02, 0.08, -0.28, 0.012, 0.4, '#5f9a3e'),
  ]);
}
