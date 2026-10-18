// Shared colours and helpers of the people models.
import { box, merge, roundBox } from '../quality';

// People face +z. One tile ≈ 6 m, so an adult is ~0.17 tiles tall.
export const SKIN = ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3b'];
export const SHIRTS = ['#3a6fd1', '#4c9a52', '#d9443b', '#e8a13a'];
export const DRESSES = ['#d9443b', '#8f5bd6', '#e07ba8', '#2f8f8f'];
/** Hair colours of the variants (dark brown, black, brown, sandy). */
export const HAIR = ['#3a2a20', '#1f1a17', '#6b4a2e', '#a8794d'];
/** Rounded heads, shoulders and limbs; collars, buttons and seams stay crisp. */
const soft=(w:number,h:number,d:number,x:number,y:number,z:number,c='#ffffff')=>
  Math.min(w,h,d)>=.014?roundBox(w,h,d,x,y,z,c,Math.min(w,h,d)*.20):box(w,h,d,x,y,z,c);
/** A man: trousers, shoes with soles, a belt, a shirt with a collar and buttons, hands, a neck, a face and short hair. */
export function maleShape(shirt: string, skin: string, hair = '#3a2a20', pants = '#3b4a63') {
  return merge([
    // legs and shoes
    soft(0.022, 0.06, 0.026, -0.014, 0.04, 0, pants), soft(0.022, 0.06, 0.026, 0.014, 0.04, 0, pants),
    soft(0.024, 0.01, 0.036, -0.014, 0.006, 0.005, '#2a2420'), soft(0.024, 0.01, 0.036, 0.014, 0.006, 0.005, '#2a2420'),
    soft(0.025, 0.003, 0.037, -0.014, 0.0015, 0.005, '#14110f'), soft(0.025, 0.003, 0.037, 0.014, 0.0015, 0.005, '#14110f'),
    // torso, belt with buckle, collar and buttons
    soft(0.06, 0.062, 0.034, 0, 0.102, 0, shirt),
    soft(0.062, 0.008, 0.036, 0, 0.072, 0, '#3a2a20'), soft(0.01, 0.007, 0.002, 0, 0.072, 0.019, '#d4af37'),
    soft(0.034, 0.008, 0.036, 0, 0.13, 0.001, '#f2efe2'),
    ...[0.08, 0.095, 0.11].map((y) => soft(0.004, 0.004, 0.002, 0, y, 0.0175, '#f2efe2')),
    // arms with cuffs and hands
    soft(0.016, 0.05, 0.02, -0.039, 0.103, 0, shirt), soft(0.016, 0.05, 0.02, 0.039, 0.103, 0, shirt),
    soft(0.017, 0.006, 0.021, -0.039, 0.079, 0, '#f2efe2'), soft(0.017, 0.006, 0.021, 0.039, 0.079, 0, '#f2efe2'),
    soft(0.014, 0.013, 0.016, -0.039, 0.069, 0, skin), soft(0.014, 0.013, 0.016, 0.039, 0.069, 0, skin),
    // neck, head, ears and face
    soft(0.016, 0.01, 0.016, 0, 0.137, 0, skin),
    soft(0.04, 0.04, 0.04, 0, 0.153, 0, skin),
    soft(0.006, 0.01, 0.008, -0.022, 0.152, 0, skin), soft(0.006, 0.01, 0.008, 0.022, 0.152, 0, skin),
    soft(0.006, 0.006, 0.004, -0.009, 0.157, 0.021, '#26292e'), soft(0.006, 0.006, 0.004, 0.009, 0.157, 0.021, '#26292e'),
    soft(0.009, 0.002, 0.003, -0.009, 0.163, 0.021, hair), soft(0.009, 0.002, 0.003, 0.009, 0.163, 0.021, hair),
    soft(0.005, 0.007, 0.005, 0, 0.151, 0.022, skin),
    soft(0.012, 0.0025, 0.003, 0, 0.143, 0.021, '#9b5a4a'),
    // short hair: top, back and the sides above the ears
    soft(0.043, 0.011, 0.043, 0, 0.177, -0.002, hair),
    soft(0.043, 0.024, 0.008, 0, 0.162, -0.0195, hair),
    soft(0.006, 0.016, 0.03, -0.021, 0.166, -0.006, hair), soft(0.006, 0.016, 0.03, 0.021, 0.166, -0.006, hair),
  ]);
}

/** A woman: a dress with a belt and a flared hem, sleeves, sandals, hands, a face and long hair (a bun for some). */
export function femaleShape(dress: string, skin: string, hair = '#4a2c1a', bun = false) {
  return merge([
    // legs and shoes
    soft(0.018, 0.04, 0.022, -0.012, 0.02, 0, skin), soft(0.018, 0.04, 0.022, 0.012, 0.02, 0, skin),
    soft(0.02, 0.008, 0.026, -0.012, 0.004, 0.004, '#6b2a3a'), soft(0.02, 0.008, 0.026, 0.012, 0.004, 0.004, '#6b2a3a'),
    // the dress: a flared skirt with a hem, the bodice, a belt and a neckline
    soft(0.07, 0.012, 0.044, 0, 0.046, 0, dress),
    soft(0.066, 0.042, 0.04, 0, 0.07, 0, dress),
    soft(0.054, 0.048, 0.032, 0, 0.111, 0, dress),
    soft(0.056, 0.006, 0.034, 0, 0.09, 0, '#f2efe2'),
    soft(0.02, 0.012, 0.002, 0, 0.13, 0.016, skin),
    // short sleeves, forearms and hands
    soft(0.016, 0.02, 0.02, -0.034, 0.122, 0, dress), soft(0.016, 0.02, 0.02, 0.034, 0.122, 0, dress),
    soft(0.013, 0.032, 0.016, -0.034, 0.096, 0, skin), soft(0.013, 0.032, 0.016, 0.034, 0.096, 0, skin),
    // neck, head, ears, face with lips
    soft(0.014, 0.01, 0.014, 0, 0.138, 0, skin),
    soft(0.038, 0.038, 0.038, 0, 0.155, 0, skin),
    soft(0.005, 0.008, 0.007, -0.021, 0.153, 0, skin), soft(0.005, 0.008, 0.007, 0.021, 0.153, 0, skin),
    soft(0.006, 0.006, 0.004, -0.008, 0.158, 0.02, '#26292e'), soft(0.006, 0.006, 0.004, 0.008, 0.158, 0.02, '#26292e'),
    soft(0.004, 0.006, 0.004, 0, 0.152, 0.021, skin),
    soft(0.01, 0.003, 0.003, 0, 0.145, 0.02, '#c4556a'),
    // hair: a fringe, the top and the back — long down to the shoulders, or tied up in a bun
    soft(0.042, 0.014, 0.042, 0, 0.177, -0.002, hair),
    soft(0.04, 0.006, 0.006, 0, 0.17, 0.019, hair),
    ...(bun
      ? [soft(0.042, 0.03, 0.01, 0, 0.162, -0.022, hair), soft(0.02, 0.02, 0.016, 0, 0.18, -0.03, hair)]
      : [soft(0.042, 0.05, 0.012, 0, 0.145, -0.022, hair), soft(0.008, 0.04, 0.03, -0.021, 0.152, -0.008, hair), soft(0.008, 0.04, 0.03, 0.021, 0.152, -0.008, hair)]),
  ]);
}
/** Visual variants: 0-3 men, 4-7 women. Children use the same shapes, scaled down per instance. */
export const PERSON_VARIANTS = 8;
