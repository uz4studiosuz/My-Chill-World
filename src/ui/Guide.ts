import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { BUILDINGS, BuildingKind, JOB_PRIORITY } from '../buildings/BuildingTypes';
import { CATS, ITEMS } from './Hud';
import { VERSION } from '../version';

type Section = 'basics' | 'resources' | 'chains' | 'buildings' | 'life';
type Ic = Parameters<typeof icon>[0];

/** Production chains: each step is a building (icon, name) and what it hands on; then what it is all for. */
const CHAINS: { title: string; ic: Ic; steps: [Ic, string, string][]; text: string }[] = [
  { title: 'Bread', ic: 'food', steps: [['farm', 'Crop Farm (wheat)', 'grain'], ['farm', 'Flour Mill', 'flour'], ['food', 'Bakery', 'bread'], ['food', 'Grocery / Supermarket / Market', 'food for families']],
    text: 'Wheat fields give grain; tractors take it to the mill, the bakery bakes bread (1.4 food from each flour) and vans bring it to the shops. Without a mill the grain is only cooked into porridge (70%).' },
  { title: 'Milk and cheese', ic: 'cow', steps: [['farm', 'Crop Farm (corn)', 'feed'], ['cow', 'Cattle Ranch', 'milk'], ['cow', 'Dairy', 'cheese and ice cream'], ['food', 'Shops', 'food for families']],
    text: 'Corn feed makes the cows give 30% more. The dairy makes 1.5 food from each milk; without a dairy the milk is drunk fresh.' },
  { title: 'Fresh food', ic: 'orchard', steps: [['orchard', 'Orchard / Fishing Hut / vegetable and melon fields', 'food'], ['food', 'Shops', 'food for families']],
    text: 'Fruit (summer and autumn), fish, vegetables and melons go straight into the stores. Families buy food only in an open food shop and keep it in the pantry at home.' },
  { title: 'Clothes', ic: 'people', steps: [['farm', 'Crop Farm (cotton)', 'cotton'], ['production', 'Factory', 'clothes'], ['people', 'Clothing Store', 'clothes for families']],
    text: 'The factory sews clothes from cotton. A clothing store with factory clothes takes 80% more from every sale, with raw cotton only 30% more, with nothing it sells little.' },
  { title: 'Furniture', ic: 'house', steps: [['woodcutter', 'Woodcutter', 'logs'], ['woodcutter', 'Sawmill', 'planks'], ['production', 'Factory', 'furniture'], ['food', 'Market / Supermarket', 'furniture for homes']],
    text: 'Families buy furniture in the market and the supermarket: every piece adds $30 to the sale (and to the business tax). Furniture and clothes are also dear goods to sell to the neighbour towns.' },
  { title: 'Planks for building', ic: 'woodcutter', steps: [['woodcutter', 'Woodcutter', 'wood'], ['woodcutter', 'Sawmill', 'planks'], ['buildings', 'Construction sites', '40% faster']],
    text: 'Trucks bring planks to the building sites and they go up 40% faster. So planks have two uses: faster building and furniture at the factory. Wood itself is a building material and fuel for the wood power plant.' },
  { title: 'Bricks', ic: 'quarry', steps: [['quarry', 'Stone Quarry', 'stone'], ['quarry', 'Brickworks', 'bricks'], ['buildings', 'Construction sites', '30% faster']],
    text: 'Stone is needed for roads and almost every building. The brickworks fires part of it into bricks that speed up building sites.' },
  { title: 'Iron', ic: 'iron', steps: [['iron', 'Iron Mine', 'iron'], ['buildings', 'Big construction sites', '30% faster']],
    text: 'Iron is needed for factories, hospitals, towers, railways and the car factory. Trucks bring iron beams from the iron mine to big building sites and they go up faster.' },
  { title: 'Bicycles', ic: 'car', steps: [['iron', 'Iron Mine', 'iron'], ['production', 'Bicycle Factory', 'bicycles'], ['people', 'Families without a car', 'ride to work']],
    text: 'A family that cannot afford a car buys bicycles ($60) and rides on the longer trips, twice as fast as walking. When it later buys a car, the factory takes the old bike back for $20.' },
  { title: 'Cars', ic: 'car', steps: [['iron', 'Iron Mine', 'iron'], ['car', 'Car Factory', 'cars'], ['car', 'Car Market', 'cars on sale'], ['people', 'Families', 'drive to work']],
    text: 'Car trucks bring new cars to the car market, where families buy them. Without a car factory cars can be imported in the Trade window; spare cars can be sold to other towns.' },
  { title: 'Electricity', ic: 'energy', steps: [['woodcutter', 'Wood / Coal Mine', 'fuel'], ['powerplant', 'Wood Power Plant / Coal Plant', 'electricity'], ['energy', 'Wind, Sun, Hydro', 'free electricity'], ['house', 'Homes and workplaces', 'light and work']],
    text: 'Fuel plants burn wood or coal; wind turbines, solar farms and dams need no fuel (wind and sun not even a road). A battery keeps what is left over for the night. Without power wages halve and work slows.' },
  { title: 'Water', ic: 'water', steps: [['watertower', 'Water Tower', 'water for 160 people'], ['roads', 'Mains under the roads / pipes', 'water'], ['house', 'Homes', 'drinking water'], ['water', 'Sewage Treatment', 'clean town']],
    text: 'Water runs under every road; pipes bring it to homes away from the roads. Without water people fall ill and nobody moves in.' },
  { title: 'Garbage', ic: 'bulldoze', steps: [['house', 'Homes and shops', 'garbage'], ['car', 'Garbage trucks', 'collect it'], ['bulldoze', 'Landfill / Recycling Plant', 'clean streets']],
    text: 'A landfill takes the garbage away (and smells); a recycling plant is cleaner. When the bins at home stay full, the family falls ill.' },
  { title: 'Stores and trade', ic: 'globe', steps: [['production', 'All producers', 'goods'], ['buildings', 'Town Hall / Warehouse', 'stores'], ['globe', 'Other towns', 'money']],
    text: 'The town hall keeps 800 of each good (1500 food); every warehouse 2000 more (2500 food). What does not fit spoils. Sell the surplus in the Trade window: every other town pays more for what it lacks and sells cheap what it has a lot of. There are no merchants — towns trade only with each other.' },
];

const RESOURCES: [string, string, string][] = [
  ['coin', 'Money', 'Taxes (income, property, business), food sales and utility bills fill the treasury. Wages of public workers and upkeep cost money every day. Banks lend money; 8 months in debt means bankruptcy.'],
  ['stone', 'Stone', 'Needed for roads, bridges and most buildings. A Stone Quarry next to mountains produces it; trucks or miners on foot bring it to the Town Hall. In an emergency the town hall buys 10 stone from a neighbour town that has plenty.'],
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
  ["Water mains and sewage", "Water flows from the towers through mains under every road; homes and towers off the road need a water pipe (tap a water tower to see the network). One tower serves 160 people. A town over 60 people also needs a sewage plant, or people fall ill."],
  ["Daily routine", "People have breakfast, a lunch break at noon (the coffee cart and bakery sell to workers nearby) and dinner with the family. In the evening friends visit each other; at weekends families walk in parks and markets. Retired people play chess in the park and pick up their grandchildren from kindergarten."],
  ["Jobs and pensions", "Skilled workers move to better-paid jobs when one is free. Everyone over 65 gets a pension from the town hall every day."],
  ["Flu", "In winter the flu can break out: it spreads within families and around town and keeps people in bed. A pharmacy halves the spread and speeds up recovery; a hospital helps too."],
  ["More chains", "Ranch milk goes to the dairy (cheese and ice cream: 1.5 food per milk). Brickworks make bricks from stone and the iron mine sends iron beams; trucks bring them to construction sites, which then go up faster. A coal mine feeds the coal power plant; a hydro dam on a river bank gives clean power all day."],
  ["Prices", "Food gets dearer when the stores run low and cheaper when they are full — this changes what families pay at the shop and how happy they are."],
  ["Weather", "Foggy mornings in spring and autumn, blizzards in winter (people stay home), heatwaves in summer (people look for fountains and ice cream; parks help)."],
  ["Decisions", "Now and then something happens and the town hall must decide: an investor, a strike, families asking for shelter, a concert, a loan… Every choice has its price."],
  ["Photo mode", "Press P (or Photo mode in the menu): the interface disappears so you can frame a beautiful shot. Enter saves a picture."],
  ["Electricity, water and happiness maps", "The buttons on the right side of the screen colour the whole town: who has power, who has water and how happy each home is."],
  ["Trade and the bank", "Open Trade to sell surplus goods to the other towns on the map or buy what you lack; each town pays more for what it is short of and sells cheap what it has a lot of. There are no merchants: towns trade only with each other, so a good nobody needs cannot be sold. A bank lets families save with interest and borrow to build houses and businesses; families buy the building materials from the town hall."],
  ["Crops", "Tap a crop farm to choose what it grows: wheat (grain for the mill), corn (feed: the cattle give 30% more), vegetables and melons (food straight to the shops) or cotton (the clothing stores sell much more)."],
  ["Mosque, teahouse, gym, barber, casino and rides", "Believers pray at the mosque at noon (crowded on Fridays) and in the evening. In the evening people drink tea at the choyxona, train at the gym or try their luck at the casino (40% tax). A haircut cheers people up; children ride the attractions after school. Every one of them makes the town happier."],
  ["Neighbour towns and climate", "At the start one or two neighbour towns appear on the map. They run themselves: their own mayor builds streets, homes, water, power, shops and services with the town's own money. Their buildings have their own colour. Trade with them in the Trade window, send gifts, answer their letters. The north is cold (snow stays longer, crops give less), the south is hot and dry."],
  ["Wages and jobs", "The town hall sets wages by itself: where workers are missing it pays more, where people look for work it pays less. In Statistics → Jobs you can switch to manual and set each wage. Newcomers spread evenly over the workplaces, and more families come when many jobs are open."],
  ["Neighbour towns, their mind and the World window", "When you create a world you choose how many neighbour towns there are (one to five, three by default). Every town has a mayor with its own character \u2014 a builder, a trader, an industrialist, a green or a thrifty one \u2014 who builds what the town needs and what he likes, raises or lowers taxes, takes loans in an emergency and sells the surplus. A town can boom or fall into a crisis, and its rich families grow into millionaires. The World window (the town name at the top, or More → World) shows every town, its numbers, its richest families and its own news. The villages are laid out differently in every new world."],
  ["Neighbours: their land", "Every neighbour town owns its streets, buildings and a strip of land around them. You cannot build there, draw roads there, hang your buildings on their streets, demolish or move anything of theirs. You can look at everything: tap their buildings and people, open their town hall, follow their news in the World window."],
  ["Neighbours: how to make friends", "Relations go from 0 to 100 and start at 40. They grow when you trade with a town (every deal), send gifts (Gift: 50 food, +8) and help when their mayor writes to you (a gift +15, selling +4). Refusing a request costs \u221210. Friendly towns pay more for what they need and sell their surplus cheaper."],
  ["Neighbours: trading", "Open Trade (globe button) \u2192 Neighbour towns. 'They need' lists what the town lacks \u2014 sell it to them for more than the traders pay. 'They sell' lists their surplus \u2014 buy it cheaper than from the traders. Goods and money move between the treasuries at once. A town with an empty treasury cannot pay."],
  ["Neighbours: watching them", "Tap the town name at the top (or More → World) to open the World window: every town, its mayor's character, how it is doing (boom, growing, stable, shrinking, crisis), people, treasury, taxes, loans, millionaires, richest families and its own news. 'Show on the map' flies there. Their news does not go into your newspaper."],
  ["Airport", "Planes fly in from the other towns on the map (towns with an airport fly more often): visitors arrive, and the plane takes what one town has far too much of to the other at that town's price. Alone on the map, planes come from abroad."],
  ['New towns', 'A very rich family ($25,000 or more) may leave to found a town of its own somewhere free on the map: the town hall and the first streets cost $12,000, the rest of the money becomes the new treasury, and the founder becomes the first mayor. The new town then runs itself like the other neighbours.'],
  ['Planes between towns', 'Planes fly from one town\'s airport to another\'s: you can watch them take off, cross the map and land. Visitors and goods come from the town the plane took off in.'],
  ['Joining towns', 'You may draw a road, a footpath or a railway onto a neighbour\'s land to join your town to theirs (but not build or demolish there). Towns joined this way trade, commute and visit each other.'],
  ['Working in another town', 'Someone who finds no work at home takes a job in a neighbour town joined by a road or a footpath; the town where they work pays the wage. On a road they come by car (or walk the sidewalk), on a footpath on foot or by bike. A neighbour town that cannot yet pay for a road lays a cheaper footpath first. When your town pays at least 25% more, workers of the neighbours leave their jobs and come to you. The Jobs panel shows how many come in and go out.'],
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
    for (const [id, label, ic] of [['basics', 'Basics', 'play'], ['resources', 'Resources', 'coin'], ['chains', 'Chains', 'production'], ['buildings', 'Buildings', 'buildings'], ['life', 'City life', 'people']] as [Section, string, Parameters<typeof icon>[0]][]) {
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
    else if (this.section === 'chains') this.chains();
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
    this.para('Speed', 'Pause, 1×, 3×, 10× and 50×. At 1× one second is one game minute; one day is one month of the calendar.', 'calendar');
  }

  private resources() {
    for (const [ic, name, text] of RESOURCES) this.para(name, text, ic as Parameters<typeof icon>[0]);
  }

  /** Every production chain as a row of steps with arrows, and what it is for. */
  private chains() {
    const intro = el('div', 'guide-card');
    const p = el('p', '');
    p.textContent = t('Raw goods become better goods step by step: each building hands its product to the next one. A building whose input is missing waits. Trucks show the goods moving between them.');
    intro.appendChild(p);
    this.body.appendChild(intro);
    for (const ch of CHAINS) {
      const box = el('div', 'guide-card chain-card');
      const h = el('div', 'guide-title');
      h.innerHTML = icon(ch.ic) + `<span>${t(ch.title)}</span>`;
      const flow = el('div', 'chain-flow');
      ch.steps.forEach(([ic, name, out], i) => {
        if (i) { const a = el('span', 'chain-arrow'); a.textContent = '→'; flow.appendChild(a); }
        const s = el('div', 'chain-step');
        s.innerHTML = `${icon(ic)}<span><b></b><small></small></span>`;
        (s.querySelector('b') as HTMLElement).textContent = t(name);
        (s.querySelector('small') as HTMLElement).textContent = t(out);
        flow.appendChild(s);
      });
      const txt = el('p', '');
      txt.textContent = t(ch.text);
      box.append(h, flow, txt);
      this.body.appendChild(box);
    }
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
