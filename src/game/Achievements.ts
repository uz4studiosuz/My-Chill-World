/** What the achievements look at (filled in by the game every morning for the player's towns). */
export interface AchievementCtx {
  people: number;
  happiness: number;
  money: number;
  days: number;
  kinds: Record<string, number>;
  tunnels: number;
  bridges: number;
  generations: number;
  famous: number;
  laws: number;
  bonds: number;
  cars: number;
  richestFamily: number;
  unemployed: number;
  workforce: number;
  friends: number;
  decor: number;
  chainsWorking: number;
  towns: number;
}

export interface Achievement {
  id: string;
  icon: string;
  /** English name and description (translated in the UI). */
  name: string;
  desc: string;
  /** How far the player is: [now, goal]. */
  progress: (c: AchievementCtx) => [number, number];
}

const has = (k: string) => (c: AchievementCtx): [number, number] => [Math.min(1, c.kinds[k] ?? 0), 1];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'house', icon: '🏠', name: 'First home', desc: 'Build the first house of your town.', progress: has('house') },
  { id: 'pop100', icon: '👪', name: 'A real town', desc: 'Reach 100 people.', progress: (c) => [c.people, 100] },
  { id: 'pop300', icon: '🏙️', name: 'City lights', desc: 'Reach 300 people.', progress: (c) => [c.people, 300] },
  { id: 'pop800', icon: '🌆', name: 'Metropolis', desc: 'Reach 800 people.', progress: (c) => [c.people, 800] },
  { id: 'pop1500', icon: '🌃', name: 'Megacity', desc: 'Reach 1,500 people.', progress: (c) => [c.people, 1500] },
  { id: 'happy80', icon: '😊', name: 'Happy town', desc: 'Happiness of 80% or more (with at least 50 people).', progress: (c) => [c.people >= 50 ? c.happiness : 0, 80] },
  { id: 'rich', icon: '💰', name: 'Full treasury', desc: 'Have $100,000 in the treasury.', progress: (c) => [c.money, 100000] },
  { id: 'millionaire', icon: '💎', name: 'A rich family', desc: 'One family saves up $50,000.', progress: (c) => [c.richestFamily, 50000] },
  { id: 'tunnel', icon: '⛰️', name: 'Tunnel master', desc: 'Run roads or railways through 5 tiles of mountain.', progress: (c) => [c.tunnels, 5] },
  { id: 'bridge', icon: '🌉', name: 'Bridge builder', desc: 'Build a road across the water.', progress: (c) => [Math.min(1, c.bridges), 1] },
  { id: 'gen3', icon: '🌳', name: 'Three generations', desc: 'Grandparents, their children and grandchildren all living in your town.', progress: (c) => [c.generations, 3] },
  { id: 'famous', icon: '⭐', name: 'A famous son', desc: 'One of your residents becomes famous.', progress: (c) => [Math.min(1, c.famous), 1] },
  { id: 'laws', icon: '📜', name: 'Lawmaker', desc: 'Have 3 laws in force at once.', progress: (c) => [c.laws, 3] },
  { id: 'bonds', icon: '🧾', name: 'Trusted by the people', desc: 'Sell town bonds to your residents.', progress: (c) => [Math.min(1, c.bonds), 1] },
  { id: 'cars', icon: '🚗', name: 'Car town', desc: '30 families own a car.', progress: (c) => [c.cars, 30] },
  { id: 'jobs', icon: '💼', name: 'Work for all', desc: 'Nobody is out of work (with a workforce of at least 50).', progress: (c) => [c.workforce >= 50 && c.unemployed === 0 ? 1 : 0, 1] },
  { id: 'friends', icon: '🤝', name: 'Good neighbours', desc: '10 pairs of families are friends.', progress: (c) => [c.friends, 10] },
  { id: 'green', icon: '🌷', name: 'Garden city', desc: 'Put up 30 parks, trees, fountains and other decorations.', progress: (c) => [c.decor, 30] },
  { id: 'chains', icon: '🏭', name: 'Industrialist', desc: 'Get 3 production chains working from field to shop.', progress: (c) => [c.chainsWorking, 3] },
  { id: 'metro', icon: '🚇', name: 'Underground', desc: 'Open a metro line (two stations).', progress: (c) => [Math.min(2, c.kinds.metro ?? 0), 2] },
  { id: 'airport', icon: '✈️', name: 'To the skies', desc: 'Build an airport.', progress: has('airport') },
  { id: 'zoo', icon: '🦒', name: 'Wild at heart', desc: 'Open a zoo.', progress: has('zoo') },
  { id: 'stadium', icon: '⚽', name: 'Matchday', desc: 'Build a football stadium.', progress: has('stadium') },
  { id: 'care', icon: '🧓', name: 'Nobody alone', desc: 'Open an elder care home.', progress: has('eldercare') },
  { id: 'forest', icon: '🌲', name: 'Forest keeper', desc: 'Build a forestry so the forest grows back.', progress: has('forestry') },
  { id: 'towns', icon: '🗺️', name: 'Founder', desc: 'Found a second town.', progress: (c) => [Math.min(2, c.towns), 2] },
  { id: 'year1', icon: '📅', name: 'One year on', desc: 'Play for one year.', progress: (c) => [c.days, 12] },
  { id: 'year5', icon: '🎂', name: 'Five years strong', desc: 'Play for five years.', progress: (c) => [c.days, 60] },
];
