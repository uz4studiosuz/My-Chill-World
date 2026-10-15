import { dateLabel } from '../sim/Calendar';
import { SaveStore, WorldMeta } from '../save/SaveStore';
import { el, icon, IconName } from './dom';
import { Lang, getLang, setLang, t } from '../i18n/i18n';
import { sound } from '../audio/Sound';
import { VERSION } from '../version';
import { Newspaper } from './Newspaper';
import homeArt from '../assets/home-art.jpg';

/** Tips shown on the artwork of the home page, one after another. */
const TIPS: [string, string][] = [
  ['A harbour town', 'Lay roads, build homes and watch families move in — every citizen has a name, a job and a story.'],
  ['Bread from the field', 'Farms grow grain, the mill grinds flour and the bakery feeds the town. Trucks show what they carry.'],
  ['Every worker is real', 'Bus drivers, soldiers and firefighters are citizens on their shift — tap anyone to see their day.'],
  ['Water and light', 'Water towers feed the mains under the roads; street lamps and windows light up the night.'],
  ['The town hall decides', 'Investors, strikes, concerts and letters from residents — every choice has its price.'],
  ['Seasons', 'Blossom in spring, beaches in summer, golden autumn and frozen lakes with skaters in winter.'],
];

export interface MenuHandlers {
  newWorld: (name: string, seed: number, calm: boolean, towns: number) => void;
  loadWorld: (id: string) => void;
  resume: () => void;
  save: () => void;
  exitToMenu: () => void;
  openGallery: (from: 'main' | 'pause') => void;
  languageChanged: () => void;
}

/** Main menu, new-world form, world list and the in-game pause menu. */
export class Menu {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  /** The home page: a side column with the menu and the town artwork. */
  private home: HTMLDivElement;
  private side: HTMLDivElement;
  private tip = 0;

  constructor(parent: HTMLElement, private h: MenuHandlers) {
    this.root = el('div', 'menu');
    this.panel = el('div', 'panel');
    this.root.appendChild(this.panel);
    this.home = el('div', 'home');
    this.side = el('div', 'home-side');
    const border = el('div', 'home-border');
    const art = el('div', 'home-art');
    art.style.backgroundImage = `url(${homeArt})`;
    const caption = el('div', 'home-caption');
    art.appendChild(caption);
    this.home.append(this.side, border, art);
    parent.append(this.root, this.home);
    this.paintTip(caption);
    window.setInterval(() => { if (this.home.classList.contains('show')) { this.tip = (this.tip + 1) % TIPS.length; this.paintTip(caption); } }, 9000);
  }

  private paintTip(caption: HTMLDivElement) {
    const [title, text] = TIPS[this.tip];
    caption.replaceChildren();
    const h = el('b', '');
    h.textContent = t(title);
    const p = el('p', '');
    p.textContent = t(text);
    const nav = el('div', 'home-cap-nav');
    const prev = el('button', '');
    prev.innerHTML = '&#8249;';
    prev.setAttribute('aria-label', t('Previous'));
    prev.addEventListener('click', () => { this.tip = (this.tip + TIPS.length - 1) % TIPS.length; this.paintTip(caption); });
    const next = el('button', '');
    next.innerHTML = '&#8250;';
    next.setAttribute('aria-label', t('Next'));
    next.addEventListener('click', () => { this.tip = (this.tip + 1) % TIPS.length; this.paintTip(caption); });
    const count = el('span', '');
    count.textContent = t('{a} of {b}', { a: this.tip + 1, b: TIPS.length });
    nav.append(prev, next, count);
    caption.append(h, p, nav);
  }

  hide() {
    this.root.classList.remove('show');
    this.home.classList.remove('show');
  }

  showMain() {
    const worlds = SaveStore.list();
    const w = worlds[0];
    this.renderHome([
      w ? homeItem('Continue', () => this.h.loadWorld(w.id), `${w.name} · ${dateLabel(w.day)} · ${t('{n} people', { n: w.population })}`, true, 'play') : null,
      homeItem('New World', () => this.showNew(), t('A fresh valley, a small village'), !w, 'plus'),
      worlds.length ? homeItem('Load World', () => this.showLoad(), t('{n} saved worlds', { n: worlds.length }), false, 'folder') : null,
      worlds.length ? homeItem('Records', () => this.showRecords(), undefined, false, 'trophy') : null,
      homeItem('Gallery', () => this.h.openGallery('main'), t('Every model in 3D'), false, 'gallery'),
      homeItem('Model editor', () => { location.href = 'editor.html'; }, undefined, false, 'office'),
      homeItem('Settings', () => this.showSettings(), undefined, false, 'dots'),
      homeItem('Credits', () => this.showCredits(), undefined, false, 'heart'),
    ]);
  }

  /** Language, sound and newspaper options. */
  showSettings() {
    this.renderHome([this.languagePicker(() => this.showSettings()), this.audioRow(), homeItem('Back', () => this.showMain(), undefined, false, 'undo')], 'Settings');
  }

  showCredits() {
    const p = el('div', 'home-credits');
    p.innerHTML = '';
    for (const [k, v] of [['Game', 'My Chill World'], ['Made by', 'UZ4 Studios'], ['Engine', 'Three.js · TypeScript'], ['Version', `v${VERSION}`]]) {
      const row = el('div', '');
      const a = el('small', '');
      a.textContent = t(k);
      const b = el('b', '');
      b.textContent = v;
      row.append(a, b);
      p.appendChild(row);
    }
    this.renderHome([p, homeItem('Back', () => this.showMain())], 'Credits');
  }

  /** The home layout: title, a list of menu entries (or a sub-page), the version at the bottom. */
  private renderHome(items: (HTMLElement | null)[], page?: string) {
    this.root.classList.remove('show');
    this.side.replaceChildren();
    const brand = el('div', 'home-brand');
    const logo = el('div', 'home-logo');
    logo.innerHTML = icon('house');
    const h = el('h1', '');
    h.textContent = 'My Chill World';
    const studio = el('div', 'home-studio');
    studio.textContent = 'UZ4 Studios';
    brand.append(logo, h, studio);
    const list = el('nav', 'home-menu');
    if (page) {
      const ph = el('div', 'home-page');
      ph.textContent = t(page);
      list.appendChild(ph);
    }
    for (const i of items) if (i) list.appendChild(i);
    const foot = el('div', 'home-foot');
    foot.textContent = t('Build roads, grow your town.');
    const ver = el('div', 'home-ver');
    ver.textContent = `v${VERSION}`;
    this.side.append(brand, list, foot, ver);
    this.home.classList.add('show');
  }

  showNew() {
    const n = SaveStore.list().length + 1;
    const name = input('World name', t('My World {n}', { n }), 24);
    const seed = input('Seed (optional)', '', 10);
    seed.inputMode = 'numeric';
    let calm = false;
    const calmBtn = el('button', 'chipbtn calm-toggle');
    const paintCalm = () => { calmBtn.textContent = `${t('Calm mode')}: ${calm ? t('On') : t('Off')}`; calmBtn.classList.toggle('active', calm); };
    paintCalm();
    calmBtn.addEventListener('click', () => { calm = !calm; paintCalm(); });
    const calmNote = el('small', 'calm-note');
    calmNote.textContent = t('No disasters, crime or bankruptcy — just build and watch.');
    // neighbour towns that run themselves: the world always has some (towns trade with each other)
    let towns = 3;
    const townRow = el('div', 'town-pick');
    const townLabel = el('span', '');
    townLabel.textContent = t('Neighbour towns (run themselves)');
    const seg = el('div', 'seg');
    const paintTowns = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', +(b as HTMLButtonElement).value === towns));
    for (const v of [1, 2, 3, 4, 5]) {
      const b = el('button', 'segbtn') as HTMLButtonElement;
      b.value = `${v}`;
      b.textContent = v ? `${v}` : t('None');
      b.addEventListener('click', () => { towns = v; paintTowns(); });
      seg.appendChild(b);
    }
    paintTowns();
    townRow.append(townLabel, seg);
    const townNote = el('small', 'calm-note');
    townNote.textContent = t('They grow on their own in other corners of the map: you can watch them in World and trade with them.');
    const form = el('div', 'home-form');
    const hint = el('small', 'calm-note');
    hint.textContent = t('Every seed makes a different landscape.');
    form.append(name.parentElement!, seed.parentElement!, hint, townRow, townNote, calmBtn, calmNote);
    this.renderHome([
      form,
      homeItem('Create', () => {
        const s = parseInt(seed.value, 10);
        this.h.newWorld(name.value.trim() || t('My World {n}', { n }), Number.isFinite(s) ? Math.abs(s) : Math.floor(Math.random() * 1e9), calm, towns);
      }, undefined, true),
      homeItem('Back', () => this.showMain()),
    ], 'New World');
  }

  showLoad() {
    const worlds = SaveStore.list();
    if (!worlds.length) return this.showMain();
    const list = el('div', 'worlds');
    for (const w of worlds) list.appendChild(this.worldRow(w));
    this.renderHome([list, homeItem('Back', () => this.showMain())], 'Your Worlds');
  }

  /** Local records: every saved world ranked by its city score. */
  showRecords() {
    const worlds = SaveStore.list().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const list = el('div', 'worlds');
    worlds.forEach((w, i) => {
      const row = el('div', 'world');
      const rank = el('div', 'world-thumb');
      rank.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      const info = el('div', 'world-info');
      const name = el('b', '');
      name.textContent = `${w.name}${w.calm ? ` · ${t('Calm mode')}` : ''}`;
      const meta = el('small', '');
      meta.textContent = `${t('Score')} ${(w.score ?? 0).toLocaleString('en-US')} · ${t('{n} people', { n: w.population })} · ${dateLabel(w.day)}`;
      info.append(name, meta);
      row.append(rank, info);
      list.appendChild(row);
    });
    this.renderHome([list, homeItem('Back', () => this.showMain())], 'Records');
  }

  showPause() {
    this.render('Paused', '', [
      button('Resume', () => this.h.resume(), 'primary', undefined, 'play'),
      button('Save', (b) => { this.h.save(); b.querySelector('.mtxt b')!.textContent = t('Saved ✓'); }, '', undefined, 'save'),
      button('Gallery', () => this.h.openGallery('pause'), '', undefined, 'gallery'),
      button('Main Menu', () => this.h.exitToMenu(), '', undefined, 'home'),
      this.audioRow(),
      this.languagePicker(() => this.showPause()),
    ]);
  }

  showLoading(text: string) {
    this.render(text, '', []);
  }

  private worldRow(w: WorldMeta) {
    const row = el('div', 'world');
    const info = el('div', 'world-info');
    const name = el('b', '');
    name.textContent = w.name;
    const meta = el('small', '');
    meta.textContent = `${dateLabel(w.day)} · ${t('{n} people', { n: w.population })} · $${Math.floor(w.money).toLocaleString('en-US')} · ${new Date(w.updated).toLocaleDateString()}`;
    info.append(name, meta);
    const play = button('Play', () => this.h.loadWorld(w.id), 'primary small', undefined, 'play');
    const thumb = el('div', 'world-thumb');
    thumb.textContent = '🏙️';
    const del = button('Delete', () => {
      if (del.dataset.confirm) {
        SaveStore.remove(w.id);
        this.showLoad();
      } else {
        del.dataset.confirm = '1';
        del.querySelector('.mtxt b')!.textContent = t('Sure?');
        del.classList.add('danger');
      }
    }, 'small');
    row.append(thumb, info, play, del);
    return row;
  }

  private audioRow() {
    const row = el('div', 'langs');
    const mk = (label: string, on: () => boolean, set: (v: boolean) => void) => {
      const b = el('button', `chipbtn${on() ? ' active' : ''}`);
      const paint = () => { b.textContent = `${t(label)}: ${on() ? t('On') : t('Off')}`; b.classList.toggle('active', on()); };
      paint();
      b.addEventListener('click', () => { set(!on()); paint(); });
      return b;
    };
    row.append(
      mk('Sound', () => sound.sfxOn, (v) => sound.setSfx(v)),
      mk('Nature', () => sound.natureOn, (v) => sound.setNature(v)),
      mk('Newspaper', () => Newspaper.enabled, (v) => { Newspaper.enabled = v; }),
      mk('Morning card', () => { try { return localStorage.getItem('mcw_dayreport') !== '0'; } catch { return true; } }, (v) => { try { localStorage.setItem('mcw_dayreport', v ? '1' : '0'); } catch { /* ignore */ } }),
    );
    return row;
  }

  private languagePicker(rerender: () => void) {
    const row = el('div', 'langs');
    const label = el('span', '');
    label.innerHTML = icon('globe');
    row.appendChild(label);
    for (const [code, name] of [['en', 'English'], ['uz', "O'zbekcha"]] as [Lang, string][]) {
      const b = el('button', `chipbtn${getLang() === code ? ' active' : ''}`);
      b.textContent = name;
      b.addEventListener('click', () => {
        setLang(code);
        this.h.languageChanged();
        rerender();
      });
      row.appendChild(b);
    }
    return row;
  }

  private render(title: string, sub: string, items: (HTMLElement | null)[], big = false) {
    this.home.classList.remove('show');
    this.panel.replaceChildren();
    this.panel.classList.toggle('main', big);
    if (big) {
      const logo = el('div', 'menu-logo');
      logo.textContent = '🏡';
      this.panel.appendChild(logo);
    }
    const h = el('h1', big ? 'big' : '');
    h.textContent = t(title);
    this.panel.appendChild(h);
    if (sub) {
      const p = el('p', '');
      p.textContent = t(sub);
      this.panel.appendChild(p);
    }
    for (const i of items) if (i) this.panel.appendChild(i);
    this.root.classList.add('show');
  }
}

function button(label: string, onClick: (b: HTMLButtonElement) => void, cls = '', sub?: string, ic?: IconName) {
  const b = el('button', `mbtn ${cls}`);
  if (ic) b.innerHTML = icon(ic);
  const txt = el('span', 'mtxt');
  const main = el('b', '');
  main.textContent = t(label);
  txt.appendChild(main);
  if (sub) {
    const s = el('small', '');
    s.textContent = t(sub);
    txt.appendChild(s);
  }
  b.appendChild(txt);
  b.addEventListener('click', () => onClick(b));
  return b;
}

/** A text entry of the home menu, with an optional line below it (e.g. the world to continue). */
function homeItem(label: string, onClick: () => void, sub?: string, primary = false, ic: IconName = label === 'Back' ? 'undo' : label === 'Create' ? 'check' : 'play') {
  const b = el('button', `home-item${primary ? ' primary' : ''}`);
  const badge = el('span', 'home-ic');
  badge.innerHTML = icon(ic);
  const txt = el('span', 'home-txt');
  const main = el('b', '');
  main.textContent = t(label);
  txt.appendChild(main);
  if (sub) {
    const s = el('small', '');
    s.textContent = sub;
    txt.appendChild(s);
  }
  b.append(badge, txt);
  b.addEventListener('click', onClick);
  return b;
}

function input(label: string, value: string, max: number) {
  const wrap = el('label', 'field');
  const span = el('span', '');
  span.textContent = t(label);
  const i = el('input', '');
  i.value = value;
  i.maxLength = max;
  wrap.append(span, i);
  return i;
}
