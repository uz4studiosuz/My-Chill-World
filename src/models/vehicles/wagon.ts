import { box, merge, roundBox } from '../quality';
import { wheel } from './_shared';
/** Passenger coach with individual glazing, end doors and two bogies. */
export const wagonGeometry=()=>merge([
  roundBox(.24,.18,.56,0,.15,0,'#3a6fd1',.012),
  roundBox(.247,.021,.555,0,.244,0,'#e8edf0',.009),
  box(.26,.025,.58,0,.047,0,'#26292e'),
  ...[-1,1].flatMap(side=>[
    ...[-.184,-.110,-.036,.038,.112,.186].map(z=>box(.003,.061,.055,side*.121,.179,z,'#a8d0e6')),
    box(.004,.007,.52,side*.122,.126,0,'#e8edf0'),
    ...[-.242,.242].flatMap(z=>[box(.004,.139,.037,side*.122,.139,z,'#294c87'),box(.005,.046,.025,side*.123,.173,z,'#a8d0e6')]),
    ...[-.235,-.17,.17,.235].flatMap(z=>wheel(side*.106,z,.023,.026)),
  ]),
  ...[-1,1].flatMap(end=>[
    box(.069,.134,.012,0,.140,end*.284,'#343b43'),
    box(.046,.105,.013,0,.141,end*.286,'#20262c'),
    box(.035,.012,.020,0,.034,end*.300,'#26292e'),
  ]),
]);
