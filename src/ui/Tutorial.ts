import { el } from './dom';
import { t } from '../i18n/i18n';

export interface TutorialContext {
  roads: number;
  houses: number;
  footpaths: number;
  shops: number;
  hallSelected: boolean;
  speed: number;
}

interface Step {
  text: string;
  done: (c: TutorialContext, start: TutorialContext) => boolean;
}

const STEPS: Step[] = [
  { text: 'Open “Roads” at the bottom and drag on the map to build a road.', done: (c, s) => c.roads >= s.roads + 3 },
  { text: 'Open “Town” and place a house next to a road. Confirm with “Build”.', done: (c, s) => c.houses > s.houses },
  { text: 'Lay a free footpath so people can walk faster.', done: (c, s) => c.footpaths > s.footpaths },
  { text: 'Open “Business” and build a grocery store — people shop and pay tax.', done: (c, s) => c.shops > s.shops },
  { text: 'Tap the Town Hall to see your whole city: money, people and happiness.', done: (c) => c.hallSelected },
  { text: 'Speed up time with the 3× button in the top right.', done: (c) => c.speed > 1 },
];

const KEY = 'mcw_tutorial_done';

/** A short step-by-step guide shown in a new world. */
export class Tutorial {
  private root: HTMLDivElement;
  private text: HTMLDivElement;
  private count: HTMLSpanElement;
  private step = 0;
  private start: TutorialContext;
  private last?: TutorialContext;
  finished = false;

  static wanted() {
    try { return localStorage.getItem(KEY) !== '1'; } catch { return true; }
  }

  constructor(parent: HTMLElement, ctx: TutorialContext, private onDone: () => void) {
    this.start = { ...ctx };
    this.root = el('div', 'tutorial');
    const head = el('div', 'tut-head');
    const label = el('b', '');
    label.textContent = t('Tutorial');
    this.count = el('span', 'tut-count');
    const skip = el('button', 'tut-skip');
    skip.textContent = t('Skip');
    skip.addEventListener('click', () => this.finish());
    const next = el('button', 'tut-next');
    next.textContent = t('Next');
    next.addEventListener('click', () => this.advance());
    head.append(label, this.count, skip, next);
    this.text = el('div', 'tut-text');
    this.root.append(head, this.text);
    parent.appendChild(this.root);
    this.render();
  }

  update(ctx: TutorialContext) {
    if (this.finished) return;
    this.last = ctx;
    if (STEPS[this.step].done(ctx, this.start)) this.advance();
  }

  /** Go to the next step (done automatically, or with the Next button). */
  advance() {
    if (this.finished) return;
    this.step++;
    if (this.last) this.start = { ...this.last };
    if (this.step >= STEPS.length) return this.finish(true);
    this.render();
    this.onDone();
  }

  private render() {
    this.count.textContent = `${this.step + 1}/${STEPS.length}`;
    this.text.textContent = t(STEPS[this.step].text);
  }

  private finish(completed = false) {
    this.finished = true;
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    if (completed) {
      this.count.textContent = '✓';
      this.text.textContent = t('Well done! Now complete the goals for rewards.');
      setTimeout(() => this.root.remove(), 5000);
    } else this.root.remove();
  }

  dispose() {
    this.root.remove();
  }
}
