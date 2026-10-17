import { el, icon } from './dom';
import { t } from '../i18n/i18n';

/**
 * "A day in the life": while the camera follows one person, a card shows the time, what they are doing now and
 * a timeline of everything they did today, with buttons for the speed and to stop.
 */
export class DayWatch {
  private root: HTMLDivElement;
  private now!: HTMLElement;
  private list!: HTMLDivElement;
  private speedBtns: HTMLButtonElement[] = [];
  private shown = 0;

  constructor(parent: HTMLElement, private onStop: () => void, private onSpeed: (s: number) => void) {
    this.root = el('div', 'daywatch');
    parent.appendChild(this.root);
  }

  get visible() { return this.root.classList.contains('show'); }

  show(name: string, face: string, speed: number) {
    this.root.replaceChildren();
    this.shown = 0;
    const head = el('div', 'dw-head');
    head.innerHTML = '<span class="dw-face"></span><div><b></b><small></small></div>';
    (head.querySelector('.dw-face') as HTMLElement).textContent = face;
    (head.querySelector('b') as HTMLElement).textContent = name;
    (head.querySelector('small') as HTMLElement).textContent = t('A day in their life');
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.title = t('Stop watching');
    x.addEventListener('click', () => this.onStop());
    head.appendChild(x);
    this.now = el('div', 'dw-now');
    const sp = el('div', 'dw-speed');
    this.speedBtns = [1, 5, 20].map((s) => {
      const b = el('button', `dw-s${s === speed ? ' on' : ''}`);
      b.textContent = `${s}×`;
      b.addEventListener('click', () => { this.onSpeed(s); this.speedBtns.forEach((o) => o.classList.toggle('on', o === b)); });
      sp.appendChild(b);
      return b;
    });
    this.list = el('div', 'dw-list');
    this.root.append(head, this.now, sp, this.list);
    this.root.classList.add('show');
  }

  /** The clock, the current activity and the timeline (newest at the top). */
  update(clock: string, activity: string, log: { time: string; text: string; day: string }[]) {
    this.now.innerHTML = '<b></b><span></span>';
    (this.now.querySelector('b') as HTMLElement).textContent = clock;
    (this.now.querySelector('span') as HTMLElement).textContent = activity;
    if (log.length === this.shown) return;
    this.shown = log.length;
    this.list.replaceChildren();
    let day = '';
    for (const e of [...log].reverse()) {
      if (e.day !== day) { day = e.day; const d = el('div', 'dw-day'); d.textContent = day; this.list.appendChild(d); }
      const r = el('div', 'dw-row');
      r.innerHTML = '<i></i><span></span>';
      (r.querySelector('i') as HTMLElement).textContent = e.time;
      (r.querySelector('span') as HTMLElement).textContent = e.text;
      this.list.appendChild(r);
    }
  }

  hide() { this.root.classList.remove('show'); }
}
