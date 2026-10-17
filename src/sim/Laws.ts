/**
 * Laws and decrees of the town hall: each costs something a day (or nothing), changes how people feel and does
 * something real in the town. They can be passed and repealed at any time in the town hall window.
 */
export interface Law {
  id: string;
  /** English name and description (translated in the UI). */
  name: string;
  desc: string;
  icon: string;
  /** Mood points while the law is in force. */
  mood: number;
  /** Daily cost for the town ($) — from the people and the pupils of the town. */
  cost: (people: number, pupils: number) => number;
}

export const LAWS: Law[] = [
  { id: 'freebus', name: 'Free buses', icon: '🚌', mood: 3, cost: (p) => Math.round(p * 0.4),
    desc: 'Buses carry everyone for free: more families leave the car at home and the streets are calmer. The town pays the fares.' },
  { id: 'meals', name: 'Free school meals', icon: '🍲', mood: 2, cost: (_p, k) => Math.round(k * 0.6),
    desc: 'Every pupil gets a hot lunch: children learn 20% faster and stay healthier.' },
  { id: 'minwage', name: 'Minimum wage', icon: '💵', mood: 3, cost: () => 0,
    desc: 'No job pays less than the usual wage: workers are happier and strike less, business owners earn less.' },
  { id: 'nosmoke', name: 'No smoking in public', icon: '🚭', mood: -1, cost: () => 0,
    desc: 'People fall ill with the flu less often; some of them grumble.' },
  { id: 'quiet', name: 'Quiet nights', icon: '🌙', mood: 2, cost: () => 0,
    desc: 'No noise after 22:00: people sleep better, but casinos and teahouses take 20% less.' },
  { id: 'green', name: 'Year of greening', icon: '🌳', mood: 2, cost: (p) => Math.round(120 + p * 0.2),
    desc: 'Trees and flowers along the streets: land is worth more and people are happier.' },
  { id: 'curfew', name: 'Curfew for teenagers', icon: '🚨', mood: -2, cost: () => 0,
    desc: 'Teenagers must be home by 22:00: fewer thefts, but young people are unhappy.' },
  { id: 'recycle', name: 'Sorting rubbish', icon: '♻️', mood: 1, cost: () => 80,
    desc: 'Every home sorts its rubbish: bins fill up 30% more slowly.' },
];

/** Areas of the town budget the player sets (100% = the usual). */
export const BUDGET_AREAS: { id: 'edu' | 'health' | 'safety' | 'transport' | 'pension'; name: string; icon: string; kinds: string[]; effect: string }[] = [
  { id: 'edu', name: 'Education', icon: '🎓', kinds: ['school', 'kindergarten', 'university', 'academy'], effect: 'pupils learn faster or slower' },
  { id: 'health', name: 'Health', icon: '🏥', kinds: ['hospital', 'pharmacy'], effect: 'the sick recover faster or slower' },
  { id: 'safety', name: 'Safety', icon: '🚓', kinds: ['police', 'firestation', 'military'], effect: 'the police keep crime down better or worse' },
  { id: 'transport', name: 'Transport', icon: '🚍', kinds: ['busdepot', 'trainstation', 'metro'], effect: 'more or fewer families leave the car at home' },
  { id: 'pension', name: 'Pensions', icon: '👵', kinds: ['eldercare'], effect: 'old people get a bigger or smaller pension (and the care home more or less money)' },
];

export type BudgetArea = (typeof BUDGET_AREAS)[number]['id'];
