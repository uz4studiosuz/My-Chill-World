import type { City } from '../sim/Economy';

/** What a decision can do to the town (implemented by the game). */
export interface DecisionCtx {
  city: City;
  freeHomes: number;
  hasFactory: boolean;
  /** Change a resource and write it into the books. */
  add(res: 'money' | 'food' | 'iron' | 'wood' | 'stone', amount: number, reason: string): void;
  /** Happiness bonus (or malus) for some days. */
  mood(points: number, days: number): void;
  /** Families move into free homes. */
  families(n: number): number;
  /** Heal everyone a little. */
  heal(points: number): void;
  tourists(n: number): void;
  say(text: string): void;
  /** The town has a working building of one of these kinds (staffed, when it has jobs). */
  has(...kinds: string[]): boolean;
  /** People living in the town. */
  people: number;
}

export interface DecisionOption { label: string; note: string; act: (c: DecisionCtx) => void }
export interface Decision { id: string; title: string; text: string; when?: (c: DecisionCtx) => boolean; options: DecisionOption[] }

/**
 * Random events that ask the town hall for a decision. Texts are English keys (translated in the UI).
 */
export const DECISIONS: Decision[] = [
  {
    id: 'investor', title: 'An investor knocks on the door',
    when: (c) => c.people >= 30,
    text: 'A businessman wants to buy land at the edge of town for a workshop. He pays well, but people worry about smoke.',
    options: [
      { label: 'Sell the land', note: '+$2500, people a little unhappy for 5 days', act: (c) => { c.add('money', 2500, 'Land sold to an investor'); c.mood(-3, 5); } },
      { label: 'Refuse', note: 'People are glad (+2 for 3 days)', act: (c) => c.mood(2, 3) },
    ],
  },
  {
    id: 'teachers', title: 'Teachers ask for a raise',
    when: (c) => c.has('school', 'kindergarten', 'university') && c.city.money >= 600,
    text: 'The teachers say their wages are too low and the children deserve better lessons.',
    options: [
      { label: 'Give a bonus', note: '−$600, people happier for 5 days', act: (c) => { c.add('money', -600, 'Bonus for teachers'); c.mood(4, 5); } },
      { label: 'Not now', note: 'Parents are unhappy for 4 days', act: (c) => c.mood(-4, 4) },
    ],
  },
  {
    id: 'refugees', title: 'Families ask for shelter',
    text: 'A flood destroyed a village upriver. Three families ask to settle in our town.',
    when: (c) => c.freeHomes > 0,
    options: [
      { label: 'Welcome them', note: 'Up to 3 families move into free homes, +3 happiness', act: (c) => { c.families(3); c.mood(3, 4); } },
      { label: 'We have no room', note: 'Some people are ashamed (−2)', act: (c) => c.mood(-2, 3) },
    ],
  },
  {
    id: 'concert', title: 'A famous singer is on tour',
    when: (c) => c.has('concerthall') && c.city.money >= 900,
    text: 'A star offers to give a concert on the town square.',
    options: [
      { label: 'Book the concert', note: '−$900, +8 happiness for 3 days, tourists come', act: (c) => { c.add('money', -900, 'Concert'); c.mood(8, 3); c.tourists(30); } },
      { label: 'Too expensive', note: 'Nothing happens', act: () => {} },
    ],
  },
  {
    id: 'iron', title: 'A merchant with iron',
    when: (c) => c.city.money >= 450,
    text: 'A travelling merchant offers 60 iron at a good price.',
    options: [
      { label: 'Buy the iron', note: '−$450, +60 iron', act: (c) => { c.add('money', -450, 'Bought from merchants'); c.add('iron', 60, 'Bought from merchants'); } },
      { label: 'No, thanks', note: 'Nothing happens', act: () => {} },
    ],
  },
  {
    id: 'water', title: 'Residents ask for water',
    text: 'There is not enough clean water. People ask the town hall to bring water tankers until a new tower is built.',
    when: (c) => c.city.water < 0.9 && c.people > 0 && c.city.money >= 500,
    options: [
      { label: 'Send water tankers', note: '−$500, everyone feels better', act: (c) => { c.add('money', -500, 'Water tankers'); c.heal(20); c.mood(2, 3); } },
      { label: 'They must wait', note: 'People are angry (−4 for 4 days)', act: (c) => c.mood(-4, 4) },
    ],
  },
  {
    id: 'strike', title: 'Strike at the factory',
    text: 'Factory workers stopped the machines and demand higher wages.',
    when: (c) => c.hasFactory && c.city.money >= 700,
    options: [
      { label: 'Agree to their demands', note: '−$700, +3 happiness', act: (c) => { c.add('money', -700, 'Wage agreement'); c.mood(3, 4); } },
      { label: 'Refuse', note: 'Unrest: −5 happiness for 4 days', act: (c) => c.mood(-5, 4) },
    ],
  },
  {
    id: 'neighbour', title: 'A neighbouring town asks for help',
    text: 'After a bad harvest a neighbouring town asks for 60 food.',
    when: (c) => c.city.food > 120,
    options: [
      { label: 'Send the food', note: '−60 food, +$200 thanks, +4 happiness', act: (c) => { c.add('food', -60, 'Help for a neighbouring town'); c.add('money', 200, 'Thanks from a neighbouring town'); c.mood(4, 4); } },
      { label: 'We need it ourselves', note: 'Nothing happens', act: () => {} },
    ],
  },
  {
    id: 'trees', title: 'Children want to plant trees',
    when: (c) => c.has('school') && c.city.money >= 300,
    text: 'Schoolchildren want to plant trees along the streets and ask the town hall for saplings.',
    options: [
      { label: 'Buy the saplings', note: '−$300, +3 happiness for 6 days', act: (c) => { c.add('money', -300, 'Saplings for the children'); c.mood(3, 6); } },
      { label: 'Maybe next year', note: 'The children are sad (−1)', act: (c) => c.mood(-1, 3) },
    ],
  },
  {
    id: 'loan', title: 'The bank offers a cheap loan',
    when: (c) => c.has('bank') && c.city.loan < 6000,
    text: 'The bank offers $3000 now; the town pays back $3600 over the next days.',
    options: [
      { label: 'Take the money', note: '+$3000 now, −$3600 later', act: (c) => { c.add('money', 3000, 'Cheap loan'); c.city.loan += 3600; } },
      { label: 'No debts', note: 'Nothing happens', act: () => {} },
    ],
  },
];
