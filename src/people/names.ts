// Procedural fantasy-style names (WorldBox-like): syllables glued together, so every town feels unique.

const M_START = ['Bor', 'Gar', 'Thor', 'Kal', 'Dur', 'Var', 'Ul', 'Ren', 'Tor', 'Bal', 'Mor', 'Os', 'Ar', 'Jor', 'Zan', 'Hal', 'Ed', 'Fen', 'Rag', 'Tam', 'Ik', 'Sar', 'Bek', 'Dag'];
const M_END = ['mund', 'vik', 'rik', 'dan', 'gar', 'mir', 'ok', 'us', 'an', 'tor', 'bert', 'gus', 'ras', 'ek', 'dor', 'win', 'ald', 'im', 'ur', 'son'];
const F_START = ['Ely', 'Mi', 'Sa', 'Lu', 'Ka', 'Ze', 'Ny', 'Ari', 'Fe', 'Ila', 'Ro', 'Ve', 'Da', 'Ma', 'Li', 'Ae', 'Tes', 'Yo', 'Gul', 'Ni'];
const F_END = ['ra', 'na', 'lia', 'ra', 'sa', 'na', 'ndra', 'wen', 'ya', 'ssa', 'ri', 'la', 'nora', 'thea', 'ma', 'rin', 'ze', 'la', 'dira'];
const CLAN_A = ['Stone', 'Oak', 'Iron', 'River', 'Ash', 'Bright', 'Wolf', 'Red', 'Silver', 'Frost', 'Green', 'Storm', 'Amber', 'Moss', 'Hill', 'Raven', 'Elm', 'Sun', 'Gold', 'Willow'];
const CLAN_B = ['brook', 'heart', 'field', 'wood', 'vale', 'ford', 'hammer', 'mantle', 'hold', 'stream', 'crest', 'water', 'leaf', 'root', 'shield', 'barrow', 'thorn', 'wind', 'stone', 'gate'];

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

export function firstName(sex: 'm' | 'f') {
  const name = sex === 'm' ? pick(M_START) + pick(M_END) : pick(F_START) + pick(F_END);
  // avoid tongue-twisters like "Ullus" → keep it short and pronounceable
  return name.length > 9 ? name.slice(0, 9) : name;
}

export function clanName() {
  let a = pick(CLAN_A), b = pick(CLAN_B);
  while (b.toLowerCase() === a.toLowerCase()) b = pick(CLAN_B);
  return a + b;
}
