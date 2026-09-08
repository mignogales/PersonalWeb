import { createResident, advanceResident } from './village-motion.mjs?v=4';

// Foot positions traced on village-background-v3.png. Links are paved corridors,
// not free-form straight lines between attractions. In particular, the fountain
// has a ring of paths and the café is approached below its tables and chairs.
export const WALK_NODES = {
  gate: [203, 277], bridge: [211, 309], gateEast: [272, 316], laneWest: [315, 320],
  laneTurn: [367, 335], laneMiddle: [417, 360], laneSouth: [456, 390], laneEnd: [509, 414],
  squareWest: [552, 428], fountainWest: [571, 399], squareNW: [573, 356],
  squareNorth: [628, 349], churchFront: [694, 349], churchDoor: [694, 333],
  squareNE: [748, 353], fountainEast: [734, 393], squareSE: [712, 428],
  squareSouth: [670, 443], fountainSouth: [610, 447],
  roadTop: [513, 466], roadBend: [490, 511], riverTurn: [470, 557],
  roadMiddle: [447, 608], roadLower: [426, 656], garden: [419, 699],
  roadFoot: [430, 747], promenade: [460, 795], towerEast: [403, 823], bench: [400, 849],
  benchApproach:[368, 863], seatLeft:[295, 858], seatRight:[338, 846],
  quayWest: [317, 876], quayBend: [232, 906], quayLeft: [130, 933],
  quayEntry: [53, 957], exit: [-65, 979],
  cafeWest: [537, 782], cafeFront: [602, 774], terrace: [663, 768],
  cafeTurn: [687, 770], cafeApproach: [703, 748], cafeDoor: [714, 732],
};

export const WALK_LINKS = [
  ['gate','bridge'], ['bridge','gateEast'], ['gateEast','laneWest'], ['laneWest','laneTurn'],
  ['laneTurn','laneMiddle'], ['laneMiddle','laneSouth'], ['laneSouth','laneEnd'], ['laneEnd','squareWest'],
  ['squareWest','fountainWest'], ['fountainWest','squareNW'], ['squareNW','squareNorth'],
  ['squareNorth','churchFront'], ['churchFront','churchDoor'], ['churchFront','squareNE'],
  ['squareNE','fountainEast'], ['fountainEast','squareSE'], ['squareSE','squareSouth'],
  ['squareSouth','fountainSouth'], ['fountainSouth','squareWest'],
  ['squareWest','roadTop'], ['roadTop','roadBend'], ['roadBend','riverTurn'],
  ['riverTurn','roadMiddle'], ['roadMiddle','roadLower'], ['roadLower','garden'],
  ['garden','roadFoot'], ['roadFoot','promenade'], ['promenade','towerEast'], ['towerEast','bench'],
  ['bench','benchApproach'], ['benchApproach','seatRight'], ['quayWest','seatLeft'],
  ['bench','quayWest'], ['quayWest','quayBend'], ['quayBend','quayLeft'],
  ['quayLeft','quayEntry'], ['quayEntry','exit'],
  ['promenade','cafeWest'], ['cafeWest','cafeFront'], ['cafeFront','terrace'],
  ['terrace','cafeTurn'], ['cafeTurn','cafeApproach'], ['cafeApproach','cafeDoor'],
];

export const DESTINATIONS = {
  gate: { wait: 7, facing: 'up' }, squareWest: { wait: 5, facing: 'right' },
  squareSE: { wait: 6, facing: 'left' }, squareNorth: { wait: 4, facing: 'down' },
  garden: { wait: 4, facing: 'left' }, bench: { wait: 9, facing: 'down' },
  seatLeft: {wait:28, activity:'sitting', facing:'down'},
  seatRight: {wait:34, activity:'sitting', facing:'down'},
  terrace: { wait: 7, facing: 'down' },
  churchDoor: { portal: { kind:'door', stay:12, depth:19, clip:{x:679,y:276,width:30,height:63} } },
  cafeDoor: { portal: { kind:'door', stay:16, depth:17, clip:{x:696,y:669,width:36,height:65} } },
  exit: { portal: { kind:'edge', stay:10 } },
};

export const VILLAGERS = [
  { id:'nico', name:'Nico', skin:'nico', node:'squareWest', speed:22, pause:1 },
  { id:'clara', name:'Clara', skin:'sara', node:'cafeWest', speed:23, pause:2 },
  { id:'visitor', name:'Leo', skin:'visitor', node:'quayBend', speed:29, pause:.5 },
  { id:'hugo', name:'Hugo', skin:'gentleman', node:'squareSE', speed:21, pause:3 },
  { id:'rosa', name:'Rosa', skin:'rosa', node:'garden', speed:24, pause:5, size:.98 },
  { id:'felix', name:'Félix', skin:'felix', node:'seatLeft', speed:25, pause:24 },
  { id:'tomas', name:'Tomás', skin:'tomas', node:'squareSouth', speed:22, pause:4, size:.97 },
];

export const SEATED_SKINS = new Set(['felix','tomas']);

const neighbors = new Map(Object.keys(WALK_NODES).map(id => [id, []]));
for (const [a, b] of WALK_LINKS) {
  neighbors.get(a).push(b);
  neighbors.get(b).push(a);
}

export function walkingPath(from, to, random = Math.random) {
  if (!neighbors.has(from) || !neighbors.has(to)) throw new Error('Unknown village destination.');
  const pending = new Set(neighbors.keys());
  const distance = new Map([[from, 0]]), previous = new Map();
  // Different edge weights allow either paved side of the fountain to be used.
  const costs = new Map(WALK_LINKS.map(([a,b]) => [
    [a,b].sort().join(':'), Math.hypot(WALK_NODES[a][0]-WALK_NODES[b][0],
      WALK_NODES[a][1]-WALK_NODES[b][1]) * (.75 + random()),
  ]));
  while (pending.size) {
    const current = [...pending].reduce((best,id) =>
      (distance.get(id) ?? Infinity) < (distance.get(best) ?? Infinity) ? id : best);
    if (!distance.has(current)) throw new Error('Disconnected village path.');
    if (current === to) break;
    pending.delete(current);
    for (const next of neighbors.get(current)) {
      if (!pending.has(next)) continue;
      const cost = distance.get(current) + costs.get([current,next].sort().join(':'));
      if (cost < (distance.get(next) ?? Infinity)) {
        distance.set(next, cost);
        previous.set(next, current);
      }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(previous.get(path[0]));
  return path;
}

export function planTrip(resident, random = Math.random, population = []) {
  const from = resident.destination;
  const occupied = new Set(population.filter(r => r !== resident).flatMap(r => [r.destination,r.seat]));
  const choices = Object.keys(DESTINATIONS).filter(id => id !== from && id !== resident.previousDestination &&
    (!id.startsWith('seat') || (SEATED_SKINS.has(resident.skin) && !occupied.has(id))));
  const available = choices.filter(id => !occupied.has(id));
  const pool = available.length ? available : choices;
  const destination = pool[Math.min(pool.length-1, Math.floor(random() * pool.length))];
  const nodes = walkingPath(from, destination, random);
  resident.route = nodes.map((node, index) => ({ x:WALK_NODES[node][0], y:WALK_NODES[node][1],
    wait:0, node, ...(index === nodes.length-1 ? DESTINATIONS[node] : {}) }));
  resident.index = 0;
  resident.previousDestination = from;
  resident.destination = destination;
  resident.tripCount = (resident.tripCount ?? 0) + 1;
}

export function createVillagers(random = Math.random) {
  const population = [];
  for (const spec of VILLAGERS) {
    const point = WALK_NODES[spec.node];
    const initial = {x:point[0],y:point[1],node:spec.node,activity:DESTINATIONS[spec.node]?.activity,
      facing:DESTINATIONS[spec.node]?.facing,wait:spec.pause};
    const resident = createResident([initial,initial], spec);
    resident.destination = spec.node;
    planTrip(resident, random, population);
    resident.socialCooldown = ['hugo','tomas'].includes(spec.id) ? 1.5 : 5+random()*10;
    population.push(resident);
  }
  const fisherman = createResident([
    {x:949,y:822,wait:240,activity:'fishing',facing:'right'}, [915,815,0],
    [875,804,6], [915,815,0],
  ], {id:'mateo',name:'Mateo the fisherman',skin:'fisher',speed:15,pause:0});
  population.push(fisherman);
  return population;
}

export function advanceVillager(resident, seconds, random = Math.random, population = []) {
  if (resident.conversation) { advanceResident(resident, seconds); return; }
  if (resident.destination && resident.index === resident.route.length-1 && resident.phase === 'waiting'
      && resident.wait <= 0 && resident.reaction <= 0) planTrip(resident, random, population);
  if (resident.skin === 'fisher' && resident.activity === 'fishing' && resident.phase === 'waiting'
      && resident.wait <= 0 && resident.reaction <= 0) {
    const stops = [[875,804],[895,810],[915,815]].filter(point => point[0] !== resident.previousStroll);
    const stop = stops[Math.min(stops.length-1,Math.floor(random()*stops.length))];
    resident.previousStroll = stop[0];
    resident.route = [{x:resident.x,y:resident.y,wait:0}, {x:928,y:819,wait:0},
      {x:stop[0],y:stop[1],wait:1+random()*2}, {x:928,y:819,wait:0},
      {x:949,y:822,wait:180+random()*180,activity:'fishing',facing:'right'}];
    resident.index = 0;
  }
  advanceResident(resident, seconds);
}

function facePartner(person, partner) {
  const dx=partner.x-person.x, dy=partner.y-person.y;
  person.direction=Math.abs(dx)>Math.abs(dy) ? (dx<0?'left':'right') : (dy<0?'up':'down');
}

function canChat(person) {
  return !person.conversation && person.socialCooldown<=0 && person.reaction<=0 &&
    person.activity==='idle' && ['walking','waiting'].includes(person.phase) &&
    person.x>=540 && person.x<=760 && person.y>=348 && person.y<=458;
}

export function advanceConversations(population, seconds, random = Math.random) {
  if (!Number.isFinite(seconds) || seconds<=0) return;
  const dt=Math.min(seconds,.1), handled=new Set();
  for (const person of population) {
    person.socialCooldown=Math.max(0,person.socialCooldown-dt);
    const conversation=person.conversation;
    if (!conversation || handled.has(conversation)) continue;
    handled.add(conversation);
    const pair=conversation.people.map(id=>population.find(resident=>resident.id===id));
    if (pair.some(resident=>!resident || !['walking','waiting'].includes(resident.phase))) conversation.remaining=0;
    else if (pair.every(resident=>resident.reaction<=0)) {
      conversation.remaining=Math.max(0,conversation.remaining-dt);
      pair.forEach((resident,index)=>facePartner(resident,pair[1-index]));
    }
    if (conversation.remaining<=0) for (const resident of pair.filter(Boolean)) {
      resident.conversation=null;
      resident.socialCooldown=35+random()*40;
    }
  }
  for (let i=0;i<population.length;i++) {
    const first=population[i];
    if (!canChat(first)) continue;
    const second=population.slice(i+1).find(person=>canChat(person) &&
      Math.hypot(person.x-first.x,person.y-first.y)>=29 &&
      Math.hypot(person.x-first.x,person.y-first.y)<=55 && Math.abs(person.y-first.y)<=24);
    if (!second) continue;
    const duration=7+random()*6;
    const conversation={people:[first.id,second.id],duration,remaining:duration};
    first.conversation=second.conversation=conversation;
    first.walking=second.walking=false;
    facePartner(first,second);facePartner(second,first);
  }
}

export function conversationSpeaker(person) {
  if (!person.conversation || person.reaction>0) return false;
  const {people,duration,remaining}=person.conversation;
  const turn=(duration-remaining)/1.8;
  return people[Math.floor(turn)%2]===person.id && turn%1<.72;
}

// Store the fisherman's actual footsteps. The dog follows the same jetty route
// a short distance behind, without cutting corners across the water.
export function createCompanion(fisherman) {
  return { x:fisherman.x-25, y:fisherman.y-7, direction:'right', walking:false, elapsed:0,
    trail:[{x:fisherman.x-25,y:fisherman.y-7},{x:fisherman.x,y:fisherman.y}] };
}

export function advanceCompanion(dog, fisherman, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const dt = Math.min(seconds,.1);
  dog.elapsed += dt;
  const last = dog.trail.at(-1);
  if (Math.hypot(fisherman.x-last.x,fisherman.y-last.y) > 2) dog.trail.push({x:fisherman.x,y:fisherman.y});
  let remaining = 0;
  for (let i=1;i<dog.trail.length;i++) remaining += Math.hypot(dog.trail[i].x-dog.trail[i-1].x,dog.trail[i].y-dog.trail[i-1].y);
  dog.walking = remaining > 26 && dog.trail.length > 1;
  if (!dog.walking) { dog.direction=fisherman.direction; return; }
  const next = dog.trail[1], dx=next.x-dog.x, dy=next.y-dog.y, distance=Math.hypot(dx,dy);
  dog.direction = Math.abs(dx)>Math.abs(dy) ? (dx<0?'left':'right') : (dy<0?'up':'down');
  const step = Math.min(distance, fisherman.speed*1.15*dt);
  if (distance) { dog.x += dx/distance*step; dog.y += dy/distance*step; }
  dog.trail[0] = {x:dog.x,y:dog.y};
  if (step >= distance) dog.trail.shift();
}
