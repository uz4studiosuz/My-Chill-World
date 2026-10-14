// Names: real given names (Uzbek, Central Asian and international) mixed with procedural fantasy names,
// so every town feels unique and people rarely share a name.

const M_REAL = [
  'Aziz', 'Bobur', 'Jasur', 'Sardor', 'Sherzod', 'Rustam', 'Farrux', 'Doniyor', 'Jahongir', 'Otabek', 'Ulugbek', 'Temur', 'Akmal', 'Bekzod',
  'Diyor', 'Eldor', 'Islom', 'Javohir', 'Komil', 'Laziz', 'Mansur', 'Nodir', 'Oybek', 'Rashid', 'Sanjar', 'Shoxrux', 'Timur', 'Umid',
  'Xurshid', 'Yusuf', 'Zafar', 'Alisher', 'Anvar', 'Behruz', 'Dilshod', 'Elyor', 'Fozil', 'Habib', 'Ilhom', 'Jamshid', 'Kamol', 'Muhammad',
  'Nurbek', 'Ravshan', 'Samandar', 'Shavkat', 'Tohir', 'Botir', 'Erkin', 'Asad', 'Murod', 'Sobir', 'Azamat', 'Daniyar', 'Arman', 'Ali',
  'Omar', 'Karim', 'Hasan', 'Husan', 'Adam', 'Leo', 'Noah', 'Lucas', 'Oliver', 'Ethan', 'Max', 'Felix', 'Hugo', 'Leon', 'Marco', 'Ivan',
  'Emil', 'Oscar', 'Victor', 'Arthur', 'Daniel', 'David', 'Samuel', 'Theo', 'Mateo', 'Luca', 'Elias', 'Kai', 'Ryan', 'Aron', 'Erik',
];
const F_REAL = [
  'Dilnoza', 'Madina', 'Nilufar', 'Shahnoza', 'Gulnora', 'Zarina', 'Malika', 'Sevara', 'Kamola', 'Feruza', 'Mohira', 'Nodira', 'Laylo',
  'Durdona', 'Gulbahor', 'Hilola', 'Iroda', 'Jasmina', 'Lola', 'Munisa', 'Nigora', 'Oydin', 'Rayhona', 'Sabina', 'Shoira', 'Umida',
  'Yulduz', 'Zuhra', 'Asal', 'Barno', 'Charos', 'Diyora', 'Farangiz', 'Gavhar', 'Komila', 'Mohinur', 'Nafisa', 'Ozoda', 'Robiya',
  'Sitora', 'Tamara', 'Xadicha', 'Zilola', 'Aisha', 'Amina', 'Aylin', 'Dana', 'Aliya', 'Saule', 'Emma', 'Mia', 'Sofia', 'Lina',
  'Nora', 'Ella', 'Clara', 'Ada', 'Iris', 'Luna', 'Maya', 'Alice', 'Anna', 'Eva', 'Lea', 'Zoe', 'Elena', 'Julia', 'Sara', 'Hana',
];
const M_START = ['Bor', 'Gar', 'Thor', 'Kal', 'Dur', 'Var', 'Ul', 'Ren', 'Tor', 'Bal', 'Mor', 'Os', 'Ar', 'Jor', 'Zan', 'Hal', 'Ed', 'Fen', 'Rag', 'Tam', 'Ik', 'Sar', 'Bek', 'Dag',
  'Al', 'Bran', 'Cor', 'Dar', 'Eld', 'Fal', 'Grim', 'Hak', 'Ivo', 'Kor', 'Lan', 'Mar', 'Nor', 'Per', 'Rol', 'Sten', 'Tib', 'Vel', 'Wil', 'Yar'];
const M_END = ['mund', 'vik', 'rik', 'dan', 'gar', 'mir', 'ok', 'us', 'an', 'tor', 'bert', 'gus', 'ras', 'ek', 'dor', 'win', 'ald', 'im', 'ur', 'son',
  'ric', 'ven', 'mar', 'ion', 'ard', 'iel', 'old', 'em', 'is', 'go'];
const F_START = ['Ely', 'Mi', 'Sa', 'Lu', 'Ka', 'Ze', 'Ny', 'Ari', 'Fe', 'Ila', 'Ro', 'Ve', 'Da', 'Ma', 'Li', 'Ae', 'Tes', 'Yo', 'Gul', 'Ni',
  'Bel', 'Ca', 'Del', 'Em', 'Fio', 'Gwe', 'Hel', 'Isa', 'Jo', 'Lyr', 'Mel', 'Oli', 'Pe', 'Rhi', 'Sel', 'Tal', 'Vi', 'Wyn'];
const F_END = ['ra', 'na', 'lia', 'sa', 'ndra', 'wen', 'ya', 'ssa', 'ri', 'la', 'nora', 'thea', 'ma', 'rin', 'ze', 'dira',
  'lie', 'ne', 'ssia', 'lyn', 'mira', 'vie', 'nna', 'ra', 'sha', 'tte'];
const CLAN_A = ['Stone', 'Oak', 'Iron', 'River', 'Ash', 'Bright', 'Wolf', 'Red', 'Silver', 'Frost', 'Green', 'Storm', 'Amber', 'Moss', 'Hill', 'Raven', 'Elm', 'Sun', 'Gold', 'Willow',
  'Black', 'White', 'Fox', 'Bear', 'Hawk', 'Thorn', 'Rose', 'Pine', 'Cedar', 'Copper', 'Star', 'Moon', 'Rain', 'Snow', 'Wind', 'Lake', 'Birch', 'Maple', 'Swift', 'Long'];
const CLAN_B = ['brook', 'heart', 'field', 'wood', 'vale', 'ford', 'hammer', 'mantle', 'hold', 'stream', 'crest', 'water', 'leaf', 'root', 'shield', 'barrow', 'thorn', 'wind', 'stone', 'gate',
  'well', 'bank', 'ridge', 'hill', 'wright', 'smith', 'more', 'dale', 'bloom', 'hand', 'feather', 'bridge', 'worth', 'land', 'by', 'mere'];
/** Family names in the Central Asian style (without the -ov / -ova ending, so they suit every member). */
const CLAN_REAL = ['Karim', 'Rashid', 'Usmon', 'Yusuf', 'Ergash', 'Tursun', 'Nazar', 'Sodiq', 'Qodir', 'Hamid', 'Mirzo', 'Alimjon', 'Toshpulat', 'Xolmat',
  'Ibrohim', 'Jalol', 'Zokir', 'Normat', 'Saidov', 'Abdulla', 'Umar', 'Sharif', 'Rahim', 'Bakir', 'Davlat', 'Nurali', 'Sultan', 'Akbar', 'Fayzi', 'Hakim'];

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

export function firstName(sex: 'm' | 'f') {
  // half real names, half invented ones
  if (Math.random() < 0.55) return pick(sex === 'm' ? M_REAL : F_REAL);
  const name = sex === 'm' ? pick(M_START) + pick(M_END) : pick(F_START) + pick(F_END);
  // avoid tongue-twisters → keep it short and pronounceable
  return name.length > 9 ? name.slice(0, 9) : name;
}

export function clanName() {
  if (Math.random() < 0.4) return pick(CLAN_REAL);
  let a = pick(CLAN_A), b = pick(CLAN_B);
  while (b.toLowerCase() === a.toLowerCase()) b = pick(CLAN_B);
  return a + b;
}

const TOWN_A = ['Oak', 'Stone', 'River', 'Iron', 'Silver', 'Amber', 'Frost', 'Green', 'Sun', 'Raven', 'Wolf', 'Gold', 'Ash', 'High', 'Fair', 'North', 'Bright', 'Mill', 'Lake', 'Red', 'Elder', 'Swan',
  'South', 'East', 'West', 'Rose', 'Pine', 'Cedar', 'Copper', 'Star', 'Moon', 'Wind', 'Hawk', 'Fox', 'Clear', 'Deep', 'Long', 'Old', 'New', 'Blue'];
const TOWN_B = ['haven', 'ford', 'bridge', 'burg', 'field', 'port', 'vale', 'ton', 'stead', 'wick', 'mouth', 'gate', 'hollow', 'crest', 'wood', 'shire', 'hold', 'brook', 'meadow',
  'dale', 'mere', 'ridge', 'well', 'stone', 'bay', 'fall', 'grove', 'hill', 'moor', 'reach', 'watch'];
const TOWN_REAL = ['Yangiobod', 'Oqtepa', "Bog'ishamol", 'Chorbog', 'Navbahor', 'Olmazor', 'Tinchlik', 'Qumqo\'rg\'on', 'Sohil', 'Gulobod', 'Shirin', 'Oltinsoy', 'Bodomzor', 'Yashnobod', 'Zarafshon'];

/** A random town name such as "Oakhaven", "Silverford" or "Navbahor". */
export function townName() {
  if (Math.random() < 0.3) return pick(TOWN_REAL);
  return pick(TOWN_A) + pick(TOWN_B);
}
