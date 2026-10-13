import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { BUILDINGS, BuildingKind, JOB_PRIORITY } from '../buildings/BuildingTypes';
import { CATS, ITEMS } from './Hud';
import { VERSION } from '../version';

type Section = 'basics' | 'resources' | 'buildings' | 'life';

const RESOURCES: [string, string, string][] = [
  ['coin', 'Money', 'Taxes (income, property, business), food sales and utility bills fill the treasury. Wages of public workers and upkeep cost money every day. Banks lend money; 8 months in debt means bankruptcy.'],
  ['stone', 'Stone', 'Needed for roads, bridges and most buildings. A Stone Quarry next to mountains produces it; trucks or miners on foot bring it to the Town Hall. Merchants sell 10 stone in an emergency.'],
  ['wood', 'Wood', 'Building material and fuel for the power plant. Woodcutters fell trees near forests and carry logs; felled trees grow back.'],
  ['iron', 'Iron', 'Needed by factories, hospitals, universities and other big buildings. An Iron Mine next to mountains produces it.'],
  ['food', 'Food', 'Everyone eats one portion a day. Crop farms (need irrigation, March–October), orchards (summer and autumn), cattle ranches and fishing huts produce it. Without food people starve.'],
  ['energy', 'Energy', 'Wood power plants supply every building connected to them by road. Without power wages halve and production slows.'],
  ['water', 'Water', 'Water towers give drinking water to 160 people each. Without water people fall ill and nobody moves in.'],
  ['heart', 'Happiness', 'Parks, shops, hospitals, schools, police, buses, jobs, health, low taxes and safety make people happy. Below 45% nobody moves in, below 30% families leave.'],
];

const LIFE: [string, string][] = [
  ['Cities', 'Every Town Hall is a separate city with its own treasury, citizens and mayor. Tap a Town Hall to build for that city. Trucks can carry goods between cities connected by road.'],
  ['Mayor', 'Every 4 years each city elects a mayor. Educated, well-off adults are the favourites. The mayor is shown in the Town Hall panel.'],
  ['Construction', 'New buildings are built step by step. Builders from a Construction Company walk to the site and work there — each builder makes it faster.'],
  ['Jobs and professions', 'People work in the nearest free job of their city; water, food, energy and materials are staffed first. School graduates may study 4 years at a university and earn more; others learn a trade.'],
  ['Families and business', 'Families earn wages, pay taxes, buy cars at a car market, shop at stores and save money. Rich families buy businesses, build shops or a home for their grown-up child, and add floors to their houses.'],
  ['Taxes', 'The Town Hall sets the income tax between 10% and 40%. Business tax is 80% of it. High taxes make people unhappy.'],
  ['Traffic', 'Cars stop at traffic lights and give way at junctions. Pedestrians walk on sidewalks and footpaths and cross only on zebra crossings when their light is green. A bus depot gives a ride to people without a car.'],
  ['Weather and seasons', 'Each day is one month. Crops grow from March to October; winter brings snow and cold snaps, summer can bring droughts. Thunderstorms may set buildings on fire — fire stations send trucks.'],
  ['Incidents', 'Now and then people fight, cars crash and, rarely, a murder happens. Police make the city safer and hospitals heal the injured.'],
  ['Emergency services', 'When someone falls seriously ill, an ambulance drives over with its siren on, paramedics carry the patient out on a stretcher and the hospital treats them. Fire trucks race to fires and spray water until the flames are out.'],
  ['Leisure', 'After school children play on playgrounds and in parks. In the evening people go to the open-air cinema. Every other day the city football team plays at the stadium — fans fill the stands and a win cheers up the whole city.'],
  ['Weddings and festivals', 'Newly-weds leave the Wedding Hall in a white car decorated with flowers, followed by their relatives. At Navruz a flower mound with a sumalak cauldron appears by the Town Hall, at New Year a decorated fir — people gather there and fireworks light up the night.'],
  ['Letters from residents', 'Residents write to the Town Hall when something is missing near their home: a shop, a school, street lamps, a park or a bus stop. Do it within 8 days and you get a reward and their trust; ignored letters make people unhappy.'],
  ['Decorations', 'Fountains, flower beds, trees, benches, lamps and monuments make the homes around them happier.'],
  ["Citizen's eyes", "Select a person or a vehicle and press \"Citizen's eyes\" to walk, ride and drive through your town in first person. Drag to look around, Esc to leave."],
  ['Buses', 'A bus depot runs one bus per two drivers (at most two) along its bus stops. People walk to a stop, wait, ride (up to 16 per bus) and pay a $2 ticket: the driver keeps a share and pays tax on it, the rest goes to the town. Build at least two bus stops.'],
  ['Money right now', 'Wages are paid when a shift ends, shops pay business tax at the till, and bus tickets, doctor visits and parking go straight to the town — the money readout shows every +$ and −$ as it happens.'],
  ['Energy', 'Work and walking tire people out; sleep at home, a rest on a bench or in a park and meals restore it. Tired people walk slower.'],
  ["Production chains", "Farms grow grain. Tractors take it to the flour mill, vans take the flour to the bakery and the bread to the shops: one flour makes 1.4 food, raw grain without a mill only 0.7. Woodcutters\u2019 logs go to the sawmill; planks make construction 40% faster. Trucks show what they carry."],
  ["Garbage", "Every home fills its bin every day. Garbage trucks from a landfill or a recycling plant empty the fullest bins nearby. Overflowing bins make people ill and unhappy. A landfill is cheap but pollutes; recycling recovers iron and money."],
  ["Needs and home levels", "Level 1: water and food. Level 2: electricity, bread from a bakery, a food shop and a school. Level 3: a park nearby, a hospital, a clothing store and a coffee cart. When a home has everything for the next level it grows a floor and pays more property tax."],
  ["Winter heating", "In winter (and half as much in March and November) every home buys firewood from the town hall. Without wood the home is cold: children and the elderly fall ill and people get unhappy."],
  ["Drivers and shifts", "Every bus, police car and train has a driver: a worker on shift. When the shift ends the vehicle returns and the next shift takes over \u2014 buses and patrols run day and night in shifts. Two police cars patrol different halves of the district; two buses run the route in opposite directions."],
  ["Signs over buildings", "Badges over buildings show what is wrong: no power, no water, hunger, illness, no road, no workers or a full bin. Tap a power plant to see every building it feeds; tap the police, fire station or a decoration to see how far it reaches."],
  ["Thoughts", "Every citizen thinks about their most pressing need \u2014 hunger, illness, tiredness, a cold home, a full bin, no job, high taxes \u2014 or how good life is. Their thought is in the person panel, and people walking nearby sometimes show it in a bubble."],
  ["Water and seasons", "Sailboats, fishing boats and a ferry sail the lakes, ducks paddle by the shore and in summer towels and umbrellas fill the beaches. In winter the water freezes and people skate on the ice; in spring some trees blossom pink."],
  ['Airport', 'Planes land every little while: tourists arrive and the city sells surplus food, wood, stone and iron abroad and buys what it lacks.'],
  ['Night shift', 'Factories, hospitals, police, fire stations, power plants and hotels work around the clock. Every third worker takes the night shift for 50% more pay and sleeps during the day.'],
  ['Life story', 'Every citizen keeps a diary: birth, school, university, jobs, wedding, children, the night shift, a trip in an ambulance. Open it with \"Life story\" in the person panel.'],
  ['Driving', 'Press the car button at the top (or \"Take the wheel\" on a vehicle) and drive with WASD or the arrow keys — on a phone with the on-screen pedals. C switches the camera, Esc gets you out.'],
  ['Model editor', 'Open /editor (editor.html) to build your own 3D model from boxes, start from any building in the game, import .glb/.gltf/.obj files and export the model as JSON, GLB or code.'],
];

/** In-game encyclopedia: what every building does, what it needs and how the systems connect. */
export class Guide {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs = new Map<Section, HTMLButtonElement>();
  private section: Section = 'basics';
  private query = '';
  visible = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'guide');
    const panel = el('div', 'guide-panel');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = t('Guide');
    const ver = el('span', 'guide-ver');
    ver.textContent = `v${VERSION}`;
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, ver, close);
    const tabs = el('div', 'stats-tabs');
    for (const [id, label, ic] of [['basics', 'Basics', 'play'], ['resources', 'Resources', 'coin'], ['buildings', 'Buildings', 'buildings'], ['life', 'City life', 'people']] as [Section, string, Parameters<typeof icon>[0]][]) {
      const b = el('button', 'stab');
      b.innerHTML = icon(ic) + `<span>${t(label)}</span>`;
      b.addEventListener('click', () => { this.section = id; this.render(); });
      this.tabs.set(id, b);
      tabs.appendChild(b);
    }
    this.body = el('div', 'guide-body');
    panel.append(head, tabs, this.body);
    this.root.appendChild(panel);
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.hide(); });
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else this.show(); }

  show() {
    this.visible = true;
    this.root.classList.add('show');
    this.render();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  private render() {
    this.tabs.forEach((b, id) => b.classList.toggle('active', id === this.section));
    this.body.replaceChildren();
    if (this.section === 'basics') this.basics();
    else if (this.section === 'resources') this.resources();
    else if (this.section === 'buildings') this.buildings();
    else this.life();
    this.body.scrollTop = 0;
  }

  private para(title: string, text: string, ic?: Parameters<typeof icon>[0]) {
    const box = el('div', 'guide-card');
    const h = el('div', 'guide-title');
    h.innerHTML = (ic ? icon(ic) : '') + `<span>${t(title)}</span>`;
    const p = el('p', '');
    p.textContent = t(text);
    box.append(h, p);
    this.body.appendChild(box);
  }

  private basics() {
    this.para('Goal', 'Grow a living town: build roads and homes, keep people fed, healthy and happy, and expand into new cities.', 'trophy');
    this.para('First steps', '1. Build roads (drag on the map). 2. Place houses next to roads. 3. Make sure there is food, water, wood, stone and power. 4. Add shops, a school and a park. 5. Watch the Town Hall panel and the goals.', 'play');
    this.para('Controls', 'Drag to move the camera, scroll or pinch to zoom, Q/E to rotate. Choose a building, tap the map, then confirm with Build. Tap a person or building to see details. Enter confirms, Esc cancels.', 'pan');
    this.para('Speed', 'Pause, 1×, 3×, 10×, 50× and 100×. At 1× one second is one game minute; one day is one month of the calendar.', 'calendar');
  }

  private resources() {
    for (const [ic, name, text] of RESOURCES) this.para(name, text, ic as Parameters<typeof icon>[0]);
  }

  private life() {
    for (const [name, text] of LIFE) this.para(name, text);
  }

  private buildings() {
    const search = el('input', 'log-search');
    search.placeholder = t('Search buildings…');
    search.value = this.query;
    search.addEventListener('input', () => { this.query = search.value.toLowerCase(); this.renderBuildings(list); });
    const list = el('div', 'guide-list');
    this.body.append(search, list);
    this.renderBuildings(list);
  }

  private renderBuildings(list: HTMLDivElement) {
    list.replaceChildren();
    for (const cat of CATS) {
      const items = ITEMS.filter((i: (typeof ITEMS)[number]) => i.cat === cat.id && (!this.query || t(i.name).toLowerCase().includes(this.query) || t(i.desc).toLowerCase().includes(this.query)));
      if (!items.length) continue;
      const h = el('div', 'guide-cat');
      h.innerHTML = icon(cat.icon) + `<span>${t(cat.label)}</span>`;
      list.appendChild(h);
      for (const it of items) {
        const card = el('div', 'guide-card');
        const title = el('div', 'guide-title');
        title.innerHTML = icon(it.icon) + `<span>${t(it.name)}</span>`;
        const p = el('p', '');
        p.textContent = t(it.desc);
        const facts = el('div', 'guide-facts');
        const add = (k: string, v: string) => {
          const f = el('span', '');
          f.innerHTML = `<i>${k}</i>${v}`;
          facts.appendChild(f);
        };
        const cost = [it.money ? `$${it.money}` : '', it.stone ? `${it.stone} ${t('stone')}` : '', it.wood ? `${it.wood} ${t('wood')}` : '', it.iron ? `${it.iron} ${t('iron')}` : ''].filter(Boolean).join(' · ');
        add(t('Cost'), (cost || t('Free')) + (it.perTile ? ` / ${t('tile')}` : ''));
        const d = (BUILDINGS as Record<string, (typeof BUILDINGS)[BuildingKind] | undefined>)[it.tool];
        if (d) {
          add(t('Size'), `${d.size}×${d.size}`);
          if (d.jobs) add(t('Jobs'), `${d.jobs} · $${d.salary}/${t('day')}${d.publicJob ? ` (${t('paid by town')})` : ''}`);
          if (d.upkeep) add(t('Upkeep'), `$${d.upkeep}/${t('day')}`);
          if (d.energy) add(t('Energy'), `${d.energy}/${t('day')}`);
          if (d.power) add(t('Produces'), `${d.power} ${t('energy')}/${t('day')}`);
          if (d.food) add(t('Produces'), `${d.food} ${t('food')}/${t('day')}`);
          if (d.water) add(t('Water'), t('for {n} people', { n: d.water }));
          if (d.students) add(t('Students'), `${d.students}`);
          if (d.housing) add(t('Home'), t('one family, up to {n} people', { n: d.housing }));
          if (d.revenue) add(t('Turnover'), `$${d.revenue}/${t('day')}`);
          add(t('Road'), d.needsRoad ? t('needs a road next to it') : t('no road needed'));
          if (JOB_PRIORITY[d.kind] !== undefined) add(t('Workers'), t('filled first'));
        }
        card.append(title, p, facts);
        list.appendChild(card);
      }
    }
  }
}
