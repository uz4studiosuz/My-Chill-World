import { dateLabel } from '../sim/Calendar';
import { exportWorld, importWorld } from '../save/Transfer';
import { SaveStore, WorldMeta } from '../save/SaveStore';
import { Online, OnlineWorld } from '../online/Online';
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
  newWorld: (name: string, seed: number, calm: boolean, towns: number, creative?: boolean) => void;
  loadWorld: (id: string) => void;
  resume: () => void;
  save: () => void;
  exitToMenu: () => void;
  openGallery: (from: 'main' | 'pause') => void;
  languageChanged: () => void;
  /** Save and export the world being played. */
  exportCurrent?: () => void;
  /** Open (or start) my town in an online world. */
  playOnline?: (w: OnlineWorld, city: string, slot: number) => void;
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

  /** The worlds kept on this device, without the online towns (those open from Online, on their server). */
  private offline() { return SaveStore.list().filter((w) => !w.online); }

  showMain() {
    const worlds = this.offline();
    const w = worlds[0];
    this.renderHome([
      w ? homeItem('Continue', () => this.h.loadWorld(w.id), `${w.name} · ${dateLabel(w.day)} · ${t('{n} people', { n: w.population })}`, true, 'play') : null,
      homeItem('New World', () => this.showNew(), t('A fresh valley, a small village'), !w, 'plus'),
      homeItem('Online', () => void this.showOnline(), t('Play with other people on a server'), false, 'globe'),
      worlds.length ? homeItem('Load World', () => this.showLoad(), t('{n} saved worlds', { n: worlds.length }), false, 'folder') : null,
      homeItem('Import a world', () => this.pickImport(), t('Open a world file from another computer or phone'), false, 'folder'),
      worlds.length ? homeItem('Records', () => this.showRecords(), undefined, false, 'trophy') : null,
      homeItem('Gallery', () => this.h.openGallery('main'), t('Every model in 3D'), false, 'gallery'),
      homeItem('Model editor', () => { location.href = 'editor.html'; }, undefined, false, 'office'),
      homeItem('Settings', () => this.showSettings(), undefined, false, 'dots'),
      homeItem('Credits', () => this.showCredits(), undefined, false, 'heart'),
    ]);
  }

  // ---------- online ----------

  /**
   * Online: sign in with email and password, then the server. Four servers of up to 8 people each (no AI towns); every
   * account chooses one server, once, and plays only there.
   */
  async showOnline(msg = '') {
    this.renderHome([this.note(t('Connecting…'))], 'Online');
    const s = await Online.session();
    if (!s) return this.showLogin(msg);
    const mine = await Online.myServer();
    const items: (HTMLElement | null)[] = [];
    if (msg) items.push(this.note(msg));
    items.push(this.note(t('Signed in as {email}', { email: s.user.email ?? '' })));
    if (typeof mine === 'string') items.push(this.note(mine, true));
    const list = await Online.servers();
    const box = el('div', 'worlds srv-list');
    if (typeof list === 'string') items.push(this.note(list, true));
    else if (mine && typeof mine !== 'string') {
      // my server: only this one
      const srv = list.find((x) => x.id === mine.id);
      const town = await Online.myTown(mine.id);
      const row = el('div', 'world srv-row mine');
      row.innerHTML = `<div class="world-thumb">${icon('globe')}</div><div class="world-info"><b></b><small></small></div>`;
      (row.querySelector('b') as HTMLElement).textContent = mine.name;
      (row.querySelector('small') as HTMLElement).textContent = `${t('Your town')}: ${town?.city ?? '—'} · ${t('{n} of {m} players', { n: srv?.players ?? 0, m: srv?.max_players ?? 8 })}`;
      box.appendChild(row);
      const rename = el('button', 'btn-mini ghost');
      rename.textContent = t('Rename');
      rename.addEventListener('click', async () => {
        const name = prompt(t('A new name for your town'), town?.city ?? '')?.trim();
        if (!name || name.length < 2) return;
        const err = await Online.renameTown(mine.id, name);
        void this.showOnline(err ? t(err) : t('Your town is now called {name}', { name }));
      });
      row.appendChild(rename);
      items.push(box, homeItem('Play', () => this.h.playOnline?.(mine, town?.city ?? t('My town'), town?.slot ?? 0), t('Your server — you play only here'), true, 'play'));
    } else if (typeof list !== 'string') {
      // choose a server: once and for all
      items.push(this.note(t('Choose your server. You can choose only once: afterwards you always play on it. Only people play there — no AI towns.')));
      const city = input('Your town name', '', 30);
      city.placeholder = t("Type your town's name");
      city.required = true;
      const form = el('div', 'home-form');
      form.appendChild(city.parentElement!);
      items.push(form);
      for (const v of list) {
        const full = v.players >= v.max_players;
        const row = el('div', `world srv-row${full ? ' full' : ''}`);
        row.innerHTML = `<div class="world-thumb">${icon('globe')}</div><div class="world-info"><b></b><small></small><div class="srv-bar"><i></i></div></div>`;
        (row.querySelector('b') as HTMLElement).textContent = v.name;
        (row.querySelector('small') as HTMLElement).textContent = full ? t('Full ({n} of {m})', { n: v.players, m: v.max_players }) : t('{n} of {m} players · {f} places free', { n: v.players, m: v.max_players, f: v.max_players - v.players });
        (row.querySelector('.srv-bar i') as HTMLElement).style.width = `${Math.round((v.players / v.max_players) * 100)}%`;
        const go = el('button', 'btn-mini');
        go.textContent = t('Choose');
        go.disabled = full;
        go.addEventListener('click', async () => {
          // every town needs a name of its own (else everyone is "My town")
          const name = city.value.trim();
          if (name.length < 2 || [t('My town'), 'My town'].includes(name)) {
            city.classList.add('bad');
            city.focus();
            this.flash(t('Type a name for your town first (at least 2 letters)'));
            return;
          }
          city.classList.remove('bad');
          if (!confirm(t('Play on {name}? You can choose a server only once — later you cannot move to another one.', { name: v.name }))) return;
          const w = await Online.joinServer(v.id, name);
          if (typeof w === 'string') { void this.showOnline(t(w)); return; }
          void this.showOnline(t('Welcome to {name}! Press Play to start your town.', { name: w.name }));
        });
        row.appendChild(go);
        box.appendChild(row);
      }
      items.push(box);
    }
    items.push(
      homeItem('Sign out', async () => { await Online.signOut(); void this.showOnline(); }, s.user.email ?? '', false, 'undo'),
      homeItem('Back', () => this.showMain()),
    );
    this.renderHome(items, 'Online');
  }

  /** Sign in or create an account: two tabs, the email remembered, the password can be shown, Enter sends. */
  private showLogin(msg = '', mode: 'in' | 'up' = 'in') {
    let saved = '';
    try { saved = localStorage.getItem('mcw_email') ?? ''; } catch { /* ignore */ }
    const tabs = el('div', 'auth-tabs');
    for (const [m, label] of [['in', 'Sign in'], ['up', 'Create an account']] as const) {
      const b = el('button', `auth-tab${mode === m ? ' on' : ''}`);
      b.textContent = t(label);
      b.addEventListener('click', () => this.showLogin('', m));
      tabs.appendChild(b);
    }
    const form = el('form', 'home-form auth-form') as HTMLFormElement;
    const name = input('Your name', '', 24);
    name.autocomplete = 'name';
    const email = input('Email', saved, 80);
    email.type = 'email';
    email.autocomplete = 'email';
    email.inputMode = 'email';
    const pass = input('Password', '', 72);
    pass.type = 'password';
    pass.autocomplete = mode === 'in' ? 'current-password' : 'new-password';
    const pass2 = input('Repeat the password', '', 72);
    pass2.type = 'password';
    pass2.autocomplete = 'new-password';
    // the eye shows or hides the password
    const eye = el('button', 'auth-eye');
    eye.type = 'button';
    eye.textContent = '👁';
    eye.title = t('Show the password');
    eye.addEventListener('click', () => { const show = pass.type === 'password'; pass.type = pass2.type = show ? 'text' : 'password'; eye.classList.toggle('on', show); });
    pass.parentElement!.classList.add('auth-pass');
    pass.parentElement!.appendChild(eye);
    if (mode === 'up') form.append(name.parentElement!);
    form.append(email.parentElement!, pass.parentElement!);
    if (mode === 'up') form.append(pass2.parentElement!);
    const status = this.note(msg, /wrong|not|must|exist|match|xato|yo'q|kerak/i.test(msg));
    const say = (text: string, bad = true) => { status.textContent = text; status.classList.toggle('bad', bad); };
    const send = el('button', 'auth-send');
    send.type = 'submit';
    send.textContent = t(mode === 'in' ? 'Sign in' : 'Create an account');
    form.append(send);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(em)) return say(t('Enter your email'));
      if (pass.value.length < 6) return say(t('The password must be at least 6 characters'));
      if (mode === 'up' && pass.value !== pass2.value) return say(t('The passwords do not match'));
      try { localStorage.setItem('mcw_email', em); } catch { /* ignore */ }
      send.disabled = true;
      say(t('Please wait…'), false);
      const err = mode === 'in' ? await Online.signIn(em, pass.value) : await Online.signUp(em, pass.value, name.value.trim() || em.split('@')[0]);
      send.disabled = false;
      if (err === 'confirm') return say(t('Account created: open the email we sent you, confirm it, then sign in here.'), false);
      if (err) return say(t(err));
      void this.showOnline(mode === 'up' ? t('Welcome! Your account is ready.') : '');
    });
    const items: (HTMLElement | null)[] = [tabs, form, status];
    if (mode === 'in') {
      const forgot = el('button', 'auth-link');
      forgot.type = 'button';
      forgot.textContent = t('Forgot your password?');
      forgot.addEventListener('click', async () => {
        const em = email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(em)) return say(t('Write your email above first'));
        say(t('Please wait…'), false);
        const err = await Online.resetPassword(em);
        say(err ? t(err) : t('A link to set a new password was sent to {email}', { email: em }), !!err);
      });
      items.push(forgot);
    }
    items.push(homeItem('Back', () => this.showMain()));
    this.renderHome(items, 'Online');
    setTimeout(() => (mode === 'up' ? name : saved ? pass : email).focus(), 50);
  }

  /** Back from the email link: choose a new password. */
  showNewPassword() {
    const form = el('form', 'home-form auth-form') as HTMLFormElement;
    const pass = input('New password', '', 72);
    pass.type = 'password';
    pass.autocomplete = 'new-password';
    const send = el('button', 'auth-send');
    send.type = 'submit';
    send.textContent = t('Save the password');
    form.append(pass.parentElement!, send);
    const status = this.note('');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (pass.value.length < 6) { status.textContent = t('The password must be at least 6 characters'); return; }
      const err = await Online.setPassword(pass.value);
      if (err) { status.textContent = t(err); return; }
      void this.showOnline(t('Your new password is saved.'));
    });
    this.renderHome([form, status, homeItem('Back', () => this.showMain())], 'Online');
  }

  /** A line of text on a menu page (an error in red). */
  private note(text: string, bad = false) {
    const n = el('div', `home-note${bad ? ' bad' : ''}`);
    n.textContent = text;
    return n;
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
    this.paintTip(this.home.querySelector('.home-caption') as HTMLDivElement);
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
    // creative mode: unlimited money and materials, every building open — just to build a beautiful city
    let creative = false;
    const creBtn = el('button', 'chipbtn calm-toggle');
    const paintCre = () => { creBtn.textContent = `${t('Creative mode')}: ${creative ? t('On') : t('Off')}`; creBtn.classList.toggle('active', creative); };
    paintCre();
    creBtn.addEventListener('click', () => { creative = !creative; paintCre(); });
    const creNote = el('small', 'calm-note');
    creNote.textContent = t('Unlimited money and materials, every building open from the start — build freely, no missions.');
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
    form.append(name.parentElement!, seed.parentElement!, hint, townRow, townNote, calmBtn, calmNote, creBtn, creNote);
    this.renderHome([
      form,
      homeItem('Create', () => {
        const s = parseInt(seed.value, 10);
        this.h.newWorld(name.value.trim() || t('My World {n}', { n }), Number.isFinite(s) ? Math.abs(s) : -1, calm, towns, creative);
      }, undefined, true),
      homeItem('Back', () => this.showMain()),
    ], 'New World');
  }

  showLoad() {
    const worlds = this.offline();
    if (!worlds.length) return this.showMain();
    const list = el('div', 'worlds');
    for (const w of worlds) list.appendChild(this.worldRow(w));
    this.renderHome([list, homeItem('Import a world', () => this.pickImport(), t('Open a world file from another computer or phone'), false, 'folder'), homeItem('Back', () => this.showMain())], 'Your Worlds');
  }

  /** Local records: every saved world ranked by its city score. */
  showRecords() {
    const worlds = this.offline().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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
      button('Export this world', () => { this.h.exportCurrent?.(); }, '', undefined, 'save'),
      button('Main Menu', () => this.h.exitToMenu(), '', undefined, 'home'),
      this.audioRow(),
      this.languagePicker(() => this.showPause()),
    ]);
  }

  /** Choose a world file (.mcw) and add it to the saved worlds. */
  private pickImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mcw,.json,application/json,application/gzip';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return;
      void importWorld(f).then((name) => { this.showLoad(); this.flash(t('World "{name}" imported — press Play to go on', { name })); },
        (e) => this.flash(t('Could not import: {why}', { why: t(String((e as Error).message ?? e)) })));
    });
    input.click();
  }

  /** A short message at the bottom of the menu. */
  private flash(text: string) {
    let f = document.querySelector('.menu-flash') as HTMLDivElement | null;
    if (!f) { f = el('div', 'menu-flash'); document.body.appendChild(f); }
    f.textContent = text;
    f.classList.add('show');
    clearTimeout(this.flashT);
    this.flashT = window.setTimeout(() => f!.classList.remove('show'), 4500);
  }
  private flashT = 0;

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
    thumb.innerHTML = icon('buildings');
    const exp = button('Export', () => { void exportWorld(w.id).then((f) => this.flash(t('Saved to your downloads: {f}', { f })), (e) => this.flash(String((e as Error).message ?? e))); }, 'small', undefined, 'save');
    exp.title = t('Save this world as a file to open it on another computer or phone');
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
    const acts = el('div', 'world-acts');
    acts.append(play, exp, del);
    row.append(thumb, info, acts);
    return row;
  }

  private audioRow() {
    const row = el('div', 'audio-settings');
    const mk = (label: string, on: () => boolean, set: (v: boolean) => void) => {
      const b = el('button', `chipbtn${on() ? ' active' : ''}`);
      const paint = () => { b.textContent = `${t(label)}: ${on() ? t('On') : t('Off')}`; b.classList.toggle('active', on()); b.setAttribute('aria-pressed', String(on())); };
      paint();
      b.addEventListener('click', () => { set(!on()); paint(); });
      return b;
    };
    row.append(
      mk('Sound', () => sound.sfxOn, (v) => sound.setSfx(v)),
      mk('Music', () => sound.musicOn, (v) => sound.setMusic(v)),
      mk('Nature sounds', () => sound.natureOn, (v) => sound.setNature(v)),
      mk('Newspaper', () => Newspaper.enabled, (v) => { Newspaper.enabled = v; }),
      mk('Morning card', () => { try { return localStorage.getItem('mcw_dayreport') !== '0'; } catch { return true; } }, (v) => { try { localStorage.setItem('mcw_dayreport', v ? '1' : '0'); } catch { /* ignore */ } }),
    );
    for (const [channel, label] of [['sfx', 'Sound'], ['music', 'Music'], ['nature', 'Nature sounds']] as const) {
      const field = el('label', 'audio-level');
      const text = el('span', ''); text.textContent = t(label);
      const slider = el('input', ''); slider.type = 'range'; slider.min = '0'; slider.max = '100';
      slider.value = String(Math.round(sound.levels[channel] * 100));
      const value = el('output', ''); value.textContent = slider.value + '%';
      slider.addEventListener('input', () => { sound.setLevel(channel, Number(slider.value) / 100); value.textContent = slider.value + '%'; });
      field.append(text, slider, value); row.append(field);
    }
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
      logo.innerHTML = icon('home');
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
