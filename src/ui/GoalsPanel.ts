import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { CHAPTERS, GOALS, GoalContext, Goals, chapterOf } from '../sim/Goals';

/** Side panel listing goals, their progress and rewards. */
export class GoalsPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement, private goals: Goals, private ctx: () => GoalContext) {
    this.root = el('div', 'goals');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = t('Goals');
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    this.body = el('div', 'goals-body');
    this.root.append(head, this.body);
    parent.appendChild(this.root);
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    this.root.classList.add('show');
    this.render();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  render() {
    const scroll = this.body.scrollTop;
    const c = this.ctx();
    this.body.replaceChildren();
    const done = GOALS.filter((g) => this.goals.done.has(g.id)).length;
    const sum = el('div', 'goals-sum');
    sum.textContent = t('{a} of {b} completed', { a: done, b: GOALS.length });
    this.body.appendChild(sum);
    // the campaign: chapter by chapter; the next chapter opens when this one is done
    const cur = chapterOf(this.goals.done);
    const list = [...GOALS].sort((a, b) => a.chapter - b.chapter || Number(this.goals.done.has(a.id)) - Number(this.goals.done.has(b.id)));
    let chapter = 0;
    for (const g of list) {
      if (g.chapter !== chapter) {
        chapter = g.chapter;
        const h = el('div', `goal-chapter${chapter > cur ? ' locked' : chapter < cur ? ' done' : ' now'}`);
        const all = GOALS.filter((x) => x.chapter === chapter);
        h.textContent = `${chapter > cur ? '🔒 ' : chapter < cur ? '★ ' : '▶ '}${t(CHAPTERS[chapter])} · ${all.filter((x) => this.goals.done.has(x.id)).length}/${all.length}`;
        this.body.appendChild(h);
      }
      if (g.chapter > cur) continue;
      const finished = this.goals.done.has(g.id);
      const p = finished ? 1 : g.progress(c, this.goals.debtFree);
      const row = el('div', `goal${finished ? ' done' : ''}`);
      const top = el('div', 'goal-top');
      const name = el('span', 'goal-name');
      name.textContent = t(g.title);
      const reward = el('span', 'goal-reward');
      reward.textContent = finished ? '✓' : `+$${g.reward}`;
      top.append(name, reward);
      const track = el('div', 'ins-track');
      const fill = el('i', '');
      fill.style.width = `${Math.round(p * 100)}%`;
      track.appendChild(fill);
      row.append(top, track);
      this.body.appendChild(row);
    }
    this.body.scrollTop = scroll;
    requestAnimationFrame(() => { if (this.visible && scroll > 0) this.body.scrollTop = scroll; });
  }
}
