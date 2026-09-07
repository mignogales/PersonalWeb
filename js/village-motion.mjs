// Routes use the artwork's native coordinates. Resize only the renderer, never
// the simulation: the residents and their paths stay attached to the village.
export const WORLD_WIDTH = 1586;
export const WORLD_HEIGHT = 992;

// Distant boats stay close to their painted moorings. Different periods and
// phases keep the motion from looking like a single synchronized wave.
export const BOATS = [
  { x: 1321, y: 100, width: 38, height: 42, drift: 1.6, bob: .75, period: 8.1, phase: .2 },
  { x: 1370, y: 101, width: 36, height: 42, drift: 2, bob: .9, period: 9.7, phase: 1.7 },
  { x: 1405, y: 122, width: 40, height: 42, drift: 1.4, bob: .7, period: 7.4, phase: 3.1 },
  { x: 1439, y: 89, width: 46, height: 50, drift: 2.2, bob: 1, period: 10.8, phase: 4.3 },
];

export function boatOffset(boat, seconds) {
  const phase = seconds * Math.PI * 2 / boat.period + boat.phase;
  return { x: Math.sin(phase) * boat.drift, y: Math.sin(phase * 1.7) * boat.bob };
}

export const DOOR_SECONDS = 1.15;
export const REACTION_SECONDS = 1.35;

export function perspectiveScale(y) {
  return .94 + Math.max(0, Math.min(1, (y - 280) / 640)) * .24;
}

function waypoint(point) {
  const result = Array.isArray(point) ? { x: point[0], y: point[1], wait: point[2] } : { ...point };
  if (!Number.isFinite(result.x) || !Number.isFinite(result.y) ||
      (result.wait !== undefined && (!Number.isFinite(result.wait) || result.wait < 0))) {
    throw new Error('Waypoints need finite positions and nonnegative waits.');
  }
  if (result.portal && (!['door', 'edge'].includes(result.portal.kind) ||
      !Number.isFinite(result.portal.stay) || result.portal.stay < 0)) {
    throw new Error('Portals need a supported type and a nonnegative stay.');
  }
  return result;
}

export function createResident(route, { speed = 18, start = 0, pause = 2, id = '', name = 'Villager', skin = 'nico', size = 1 } = {}) {
  if (route.length < 2) throw new Error('A resident needs at least two waypoints.');
  if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(pause) || pause < 0 || !Number.isFinite(start)) {
    throw new Error('Speed must be positive, pause nonnegative, and start finite.');
  }
  const points = route.map(waypoint);
  const index = ((Math.trunc(start) % points.length) + points.length) % points.length;
  const point = points[index];
  const resident = { id, name, skin, size, route: points, speed, pause, index, x: point.x, y: point.y,
    wait: point.wait ?? pause, walking: false, direction: point.facing ?? 'down', elapsed: 0,
    phase: 'waiting', phaseTime: 0, activity: point.activity ?? 'idle', activityElapsed:0,
    reaction: 0, portal: null, conversation:null, socialCooldown:0,
    seat:point.activity==='sitting' ? point.node : null };
  if (point.portal) {
    resident.portal = point.portal;
    resident.phase = 'inside';
  }
  return resident;
}

export function reactToResident(resident) {
  if (resident.phase === 'inside' || resident.x < 0 || resident.x > WORLD_WIDTH) return false;
  resident.reaction = REACTION_SECONDS;
  resident.walking = false;
  if (resident.activity !== 'fishing') resident.direction = 'down';
  return true;
}

export function residentPose(resident) {
  let opacity = resident.phase === 'inside' ? 0 : 1;
  let clip = null;
  let y = resident.y;
  if (['entering', 'emerging'].includes(resident.phase)) {
    const progress = Math.min(1, resident.phaseTime / DOOR_SECONDS);
    opacity = resident.phase === 'entering' ? 1 - progress : progress;
    y -= (1 - opacity) * (resident.portal.depth ?? 16);
    clip = resident.portal.clip;
  }
  return { x: resident.x, y, opacity, clip, scale: perspectiveScale(resident.y) * resident.size };
}

export function advanceResident(resident, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  // A sleeping device or background tab never teleports a resident or completes
  // a building visit all at once when the page becomes visible again.
  const dt = Math.min(seconds, .1);
  resident.elapsed += dt;
  if (resident.reaction > 0) {
    resident.reaction = Math.max(0, resident.reaction - dt);
    resident.walking = false;
    return;
  }
  resident.activityElapsed += dt;
  if (resident.conversation) {
    resident.walking = false;
    return;
  }
  if (resident.phase === 'inside') {
    resident.walking = false;
    resident.phaseTime += dt;
    if (resident.phaseTime >= resident.portal.stay) {
      resident.phase = resident.portal.kind === 'door' ? 'emerging' : 'waiting';
      resident.phaseTime = 0;
      resident.wait = .5;
      resident.direction = 'down';
    }
    return;
  }
  if (resident.phase === 'entering' || resident.phase === 'emerging') {
    resident.walking = true;
    resident.direction = resident.phase === 'entering' ? 'up' : 'down';
    resident.phaseTime += dt;
    if (resident.phaseTime >= DOOR_SECONDS) {
      resident.phase = resident.phase === 'entering' ? 'inside' : 'waiting';
      resident.phaseTime = 0;
      resident.wait = .6;
      resident.walking = false;
    }
    return;
  }
  if (resident.wait > 0) {
    resident.wait = Math.max(0, resident.wait - dt);
    resident.walking = false;
    return;
  }
  resident.phase = 'walking';
  if (resident.activity !== 'idle') resident.activityElapsed = 0;
  resident.activity = 'idle';
  resident.seat = null;
  const targetIndex = (resident.index + 1) % resident.route.length;
  const target = resident.route[targetIndex];
  const dx = target.x - resident.x;
  const dy = target.y - resident.y;
  const distance = Math.hypot(dx, dy);
  const step = resident.speed * dt;
  if (distance > 0) {
    resident.direction = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }
  if (distance <= step) {
    resident.x = target.x;
    resident.y = target.y;
    resident.index = targetIndex;
    resident.wait = target.wait ?? resident.pause;
    resident.walking = false;
    resident.phase = 'waiting';
    resident.activity = target.activity ?? 'idle';
    resident.activityElapsed = 0;
    resident.seat = target.activity==='sitting' ? target.node : null;
    if (target.facing) resident.direction = target.facing;
    if (target.portal) {
      resident.portal = target.portal;
      resident.phaseTime = 0;
      resident.phase = target.portal.kind === 'door' ? 'entering' : 'inside';
      resident.direction = 'up';
    }
  } else {
    resident.x += dx / distance * step;
    resident.y += dy / distance * step;
    resident.walking = true;
  }
}

export function shouldAnimate({ loaded, visible, inView, smallScreen, reducedMotion, paused, dialogOpen }) {
  return Boolean(loaded && visible && inView && !smallScreen && !reducedMotion && !paused && !dialogOpen);
}

export const DUCK_ROUTES = [
  { id:'duck-1', size:.83, speed:10, route:[[510,932,2],[549,914,0],[610,917,0],[658,943,1],[604,965,0],[548,956,0]] },
  { id:'duck-2', size:.7, speed:11, start:2, route:[[550,947,1],[591,930,0],[649,933,0],[687,956,2],[621,977,0],[576,966,0]] },
  { id:'duck-3', size:.59, speed:12, start:3, route:[[621,925,0],[665,908,0],[722,921,2],[745,948,0],[684,964,0],[644,950,0]] },
  { id:'duck-4', size:.62, speed:10, start:1, route:[[698,949,0],[736,935,1],[780,948,0],[762,973,2],[720,971,0]] },
];

// Ducks glide with their wings folded. Each one gets an independent, brief
// flutter after an irregular rest; only the above-water part is rendered.
export function createDuck(routine, random = Math.random) {
  return Object.assign(createResident(routine.route, routine), {
    flutter: 0, nextFlutter: 5 + random() * 16, headingX:1, headingY:0,
  });
}

export function advanceDuck(duck, seconds, random = Math.random) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const {x,y} = duck;
  advanceResident(duck, seconds);
  const distance = Math.hypot(duck.x-x,duck.y-y);
  if (distance > 0) { duck.headingX=(duck.x-x)/distance; duck.headingY=(duck.y-y)/distance; }
  const dt = Math.min(seconds, .1);
  if (duck.flutter > 0) {
    duck.flutter = Math.max(0, duck.flutter - dt);
    if (!duck.flutter) duck.nextFlutter = 12 + random() * 23;
  } else {
    duck.nextFlutter -= dt;
    if (duck.nextFlutter <= 0) duck.flutter = 1.2;
  }
}

export function duckFrame(duck) {
  return duck.flutter > 0 ? [2, 1, 3, 1][Math.floor((1.2 - duck.flutter) * 8) % 4] : 2;
}
