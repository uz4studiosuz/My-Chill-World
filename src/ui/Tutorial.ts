import { el } from './dom';
import { t } from '../i18n/i18n';

export interface TutorialContext {
  roads: number;
  houses: number;
  /** Finished houses. */
  builtHouses: number;
  footpaths: number;
  shops: number;
  hallSelected: boolean;
  speed: number;
  /** Homes without a water pipe, buildings without a power cable. */
  dry: number;
  unwired: number;
  layer: string;
  newsOpened: number;
  goalsOpened: number;
}

interface Step {
  title: string;
  text: string;
  /** Why it matters (one line). */
  why: string;
  /** CSS selector of what to press (it glows). */
  target?: string;
  /** Money for doing it. */
  reward: number;
  /** Done? (start = the town when the step began, first = when the tutorial began). Missing = press Next. */
  done?: (c: TutorialContext, start: TutorialContext, first: TutorialContext) => boolean;
}

const STEPS: Step[] = [
  { title: 'Welcome, mayor!', text: 'This little town is yours. People move in when there are homes, water, power, food and jobs. On the right is the town panel: what the town has and what it needs.',
    why: 'Time is paused — take your time. Press Next.', target: '.sidebar', reward: 0 },
  { title: 'Start the clock', text: 'Press ▶ / 1× at the top to let time run. Builders, families and cars only move while time runs.',
    why: 'Pause (⏸) whenever you want to think.', target: '.speeds .sbtn, .mobile-speed .sbtn', reward: 100, done: (c) => c.speed > 0 },
  { title: 'Build a road', text: 'At the bottom open the Roads tab, choose Road and drag from the end of a street. Then press Build. The builders lay it tile by tile.',
    why: 'Every home and shop needs a road at its door.', target: '[data-cat="roads"]', reward: 200, done: (c, s) => c.roads >= s.roads + 2 },
  { title: 'Build a house', text: 'Open the Town tab, choose House and tap next to a road, then Build. It needs money, stone, wood and bricks (the card shows what you have).',
    why: 'Each house brings a new family: workers and taxes.', target: '[data-cat="buildings"]', reward: 200, done: (c, s) => c.houses > s.houses },
  { title: 'Water for the house', text: 'When the house is finished, lay a Water Pipe (Roads tab) from the pipe under the street to under the house. The 💧 map on the left shows the pipes.',
    why: 'A home gets water only where a pipe runs under it.', target: '[data-cat="roads"], [data-layer="water"]', reward: 200, done: (c, _s, f) => c.builtHouses > f.builtHouses && c.dry === 0 },
  { title: 'Power for everyone', text: 'Buildings get electricity through power cables: lay a Power Cable (Roads tab) along the street to any building that has none.',
    why: 'Without power homes are unhappy and workplaces slow down.', target: '[data-cat="roads"], [data-layer="power"]', reward: 200, done: (c) => c.unwired === 0 },
  { title: 'Food and a shop', text: 'Open the Business tab and build a Grocery Store by a road. Families buy food there and the town earns tax.',
    why: 'Hungry people get sick and leave.', target: '[data-cat="business"]', reward: 250, done: (c, s) => c.shops > s.shops },
  { title: 'Read the newspaper', text: 'Open the Newspaper in the town panel: every day it says what the town needs most.',
    why: 'When you do not know what to build next, look there.', target: '[data-panel="news"]', reward: 100, done: (c, s) => c.newsOpened > s.newsOpened },
  { title: 'Look at a map', text: 'Tap one of the map buttons on the left (electricity, water, happiness, traffic…). A key explains the colours.',
    why: 'Red shows where something is missing.', target: '.layer-btn', reward: 100, done: (c) => c.layer !== 'none' },
  { title: 'Your town hall', text: 'Tap the Town Hall building on the map: it opens the full report of your town — money, people, jobs, trade and taxes.',
    why: 'Everything about the town is in one place.', target: '.sidebar', reward: 150, done: (c) => c.hallSelected },
  { title: 'Missions', text: 'Open Goals (in the town panel, under More): a campaign of missions with money rewards, chapter by chapter.',
    why: 'They show you the way from a village to a metropolis.', target: '[data-panel="trophy"]', reward: 150, done: (c, s) => c.goalsOpened > s.goalsOpened },
  { title: 'Faster!', text: 'Speed time up with 3× or 10× at the top. You are ready to build your city!',
    why: 'Watch the newspaper and the town panel as the town grows.', target: '.speeds .sbtn, .mobile-speed .sbtn', reward: 300, done: (c) => c.speed >= 3 },
];

const KEY = 'mcw_tutorial_done';

/** The tutorial: missions that teach the game step by step, each with a reward, pointing at what to press. */
export class Tutorial {
  private root: HTMLDivElement;
  private step = 0;
  private start: TutorialContext;
  private first: TutorialContext;
  private last?: TutorialContext;
  finished = false;

  static wanted() {
    try { return localStorage.getItem(KEY) !== '1'; } catch { return true; }
  }

  constructor(parent: HTMLElement, ctx: TutorialContext, private onDone: (reward: number) => void) {
    this.start = { ...ctx };
    this.first = { ...ctx };
    this.root = el('div', 'tutorial tut2');
    parent.appendChild(this.root);
    this.render();
  }

  update(ctx: TutorialContext) {
    if (this.finished) return;
    this.last = ctx;
    const s = STEPS[this.step];
    if (s.done?.(ctx, this.start, this.first)) this.advance(true);
    this.glow();
  }

  /** Go on to the next mission (done, or skipped with the button). */
  advance(earned = false) {
    if (this.finished) return;
    const s = STEPS[this.step];
    // move on first: the reward refreshes the game, which checks the (next) step again
    this.step++;
    if (this.last) this.start = { ...this.last };
    if (this.step >= STEPS.length) this.finish(true);
    else this.render();
    if (earned && s.reward) this.onDone(s.reward);
  }

  private render() {
    const s = STEPS[this.step];
    this.root.replaceChildren();
    const head = el('div', 'tut-head');
    head.innerHTML = '<span class="tut-badge">🎓</span><b></b><span class="tut-count"></span>';
    (head.querySelector('b') as HTMLElement).textContent = t('Learning');
    (head.querySelector('.tut-count') as HTMLElement).textContent = `${this.step + 1}/${STEPS.length}`;
    const skip = el('button', 'tut-skip');
    skip.textContent = t('Skip the tutorial');
    skip.addEventListener('click', () => this.finish());
    head.appendChild(skip);
    const bar = el('div', 'tut-bar');
    bar.innerHTML = `<i style="width:${Math.round((this.step / STEPS.length) * 100)}%"></i>`;
    const title = el('div', 'tut-title');
    title.textContent = t(s.title);
    const text = el('div', 'tut-text');
    text.textContent = t(s.text);
    const why = el('div', 'tut-why');
    why.textContent = `💡 ${t(s.why)}`;
    const foot = el('div', 'tut-foot');
    const reward = el('span', 'tut-reward');
    reward.textContent = s.reward ? `+$${s.reward}` : '';
    const next = el('button', `tut-next${s.done ? ' ghost' : ''}`);
    next.textContent = s.done ? t('Skip this step') : t('Next');
    next.addEventListener('click', () => this.advance(!s.done));
    foot.append(reward, next);
    this.root.append(head, bar, title, text, why, foot);
    this.glow();
  }

  /** Make what the player should press glow. */
  private glow() {
    document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow'));
    const s = STEPS[this.step];
    if (this.finished || !s?.target) return;
    document.querySelectorAll(s.target).forEach((e) => { if ((e as HTMLElement).offsetParent !== null) e.classList.add('tut-glow'); });
  }

  private finish(completed = false) {
    this.finished = true;
    document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow'));
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    if (completed) {
      this.root.replaceChildren();
      const d = el('div', 'tut-title');
      d.textContent = `🎉 ${t('Well done! Now follow the missions in Goals — chapter by chapter to a metropolis.')}`;
      this.root.appendChild(d);
      setTimeout(() => this.root.remove(), 7000);
    } else this.root.remove();
  }

  dispose() {
    document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow'));
    this.root.remove();
  }
}

/** The first screen of a new world: what the game is and a choice to learn it step by step. */
export function welcome(parent: HTMLElement, onTutorial: () => void, onPlay: () => void) {
  const back = el('div', 'welcome-back');
  const box = el('div', 'welcome');
  box.innerHTML = `<div class="wl-hero">🏙️</div><b></b><p></p><ul></ul><div class="wl-btns"></div>`;
  (box.querySelector('b') as HTMLElement).textContent = t('Welcome, mayor!');
  (box.querySelector('p') as HTMLElement).textContent = t('You run a small town that grows into a city. Time is paused until you are ready.');
  const ul = box.querySelector('ul') as HTMLElement;
  for (const line of ['Build roads, homes, water pipes and power cables — families move in', 'Give them food, jobs, schools and fun — they stay and grow', 'Trade with the neighbour towns and follow the missions to a metropolis']) {
    const li = el('li', '');
    li.textContent = t(line);
    ul.appendChild(li);
  }
  const btns = box.querySelector('.wl-btns') as HTMLElement;
  const a = el('button', 'wl-main');
  a.textContent = `🎓 ${t('Learn to play (recommended)')}`;
  a.addEventListener('click', () => { back.remove(); onTutorial(); });
  const b = el('button', 'wl-alt');
  b.textContent = t('I know how to play');
  b.addEventListener('click', () => { back.remove(); onPlay(); });
  btns.append(a, b);
  back.appendChild(box);
  parent.appendChild(back);
}
