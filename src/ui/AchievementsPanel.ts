import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { ACHIEVEMENTS, AchievementCtx } from '../game/Achievements';

/** The achievements: a grid of badges, the earned ones bright with their date, the others with how far along you are. */
export class AchievementsPanel {
  private back: HTMLDivElement;

  constructor(private parent: HTMLElement, private state: () => { ctx: AchievementCtx; got: Record<string, number>; dateOf: (d: number) => string }) {
    this.back = el('div', 'ach-back');
    this.back.addEventListener('click', (e) => { if (e.target === this.back) this.hide(); });
  }

  get visible() { return this.back.classList.contains('show'); }

  toggle() { if (this.visible) this.hide(); else this.open(); }

  open() {
    if (!this.back.parentElement) this.parent.appendChild(this.back);
    this.back.classList.add('show');
    this.render();
  }

  hide() { this.back.classList.remove('show'); }

  private render() {
    const { ctx, got, dateOf } = this.state();
    this.back.replaceChildren();
    const box = el('div', 'ach-box');
    const head = el('div', 'ach-head');
    const n = ACHIEVEMENTS.filter((a) => got[a.id] !== undefined).length;
    head.innerHTML = '<span>🏆</span><div><b></b><small></small></div>';
    (head.querySelector('b') as HTMLElement).textContent = t('Achievements');
    (head.querySelector('small') as HTMLElement).textContent = t('{n} of {m} earned', { n, m: ACHIEVEMENTS.length });
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.addEventListener('click', () => this.hide());
    head.appendChild(x);
    const bar = el('div', 'ach-total');
    bar.innerHTML = '<i></i>';
    (bar.querySelector('i') as HTMLElement).style.width = `${Math.round((n / ACHIEVEMENTS.length) * 100)}%`;
    const grid = el('div', 'ach-grid');
    const list = [...ACHIEVEMENTS].sort((a, b) => Number(got[b.id] !== undefined) - Number(got[a.id] !== undefined));
    for (const a of list) {
      const done = got[a.id] !== undefined;
      const [now, goal] = a.progress(ctx);
      const c = el('div', `ach-card${done ? ' done' : ''}`);
      c.innerHTML = '<span class="ach-ic"></span><div><b></b><small></small><div class="ach-bar"><i></i></div><em></em></div>';
      (c.querySelector('.ach-ic') as HTMLElement).textContent = a.icon;
      (c.querySelector('b') as HTMLElement).textContent = t(a.name);
      (c.querySelector('small') as HTMLElement).textContent = t(a.desc);
      const p = done ? 1 : Math.max(0, Math.min(1, now / goal));
      (c.querySelector('.ach-bar i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
      (c.querySelector('em') as HTMLElement).textContent = done ? t('Earned {date}', { date: dateOf(got[a.id]) }) : goal > 1 ? `${Math.floor(Math.min(now, goal)).toLocaleString('en-US')} / ${goal.toLocaleString('en-US')}` : t('Not yet');
      grid.appendChild(c);
    }
    box.append(head, bar, grid);
    this.back.appendChild(box);
  }
}
