import { WORLD_WIDTH, WORLD_HEIGHT, BOATS, boatOffset, DUCK_ROUTES, REACTION_SECONDS,
  createDuck, advanceDuck, duckFrame, shouldAnimate, residentPose, perspectiveScale, reactToResident } from './village-motion.mjs?v=4';
import { SPRITE_ASSETS, residentFrame, residentBounds, composeLpcSprites, dogFrame } from './village-sprites.mjs?v=4';
import { createVillagers, advanceVillager, createCompanion, advanceCompanion,
  advanceConversations, conversationSpeaker } from './village-navigation.mjs?v=4';

const dialog = document.getElementById('chapter-dialog');
const journal = document.getElementById('journal');
const dialogContent = document.getElementById('dialog-content');
const closeButton = document.getElementById('close-chapter');
const dialogTitle = document.getElementById('chapter-dialog-title');

function openChapter(id) {
  const chapter = Array.from(journal.children).find(child => child.id === id);
  if (!chapter || typeof dialog.showModal !== 'function') return false;
  const copy = chapter.cloneNode(true);
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  dialogTitle.textContent = chapter.querySelector('h2')?.textContent || 'Other chapters';
  dialogContent.replaceChildren(copy);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  closeButton.focus();
  syncAnimation();
  return true;
}

if (typeof dialog.showModal === 'function') {
  document.body.classList.add('has-village-js');
  document.querySelectorAll('[data-chapter]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (openChapter(link.dataset.chapter)) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-city]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => openChapter(button.dataset.city));
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialogContent.replaceChildren(); syncAnimation(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}

const canvas = document.getElementById('village-residents');
const world = document.getElementById('village-world');
const artwork = document.getElementById('village-art');
const context = canvas.getContext('2d');
const motionToggle = document.getElementById('motion-toggle');
const peopleLayer = document.getElementById('village-people');
const announcement = document.getElementById('village-announcement');
const smallScreen = matchMedia('(max-width: 600px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let inView = true;
let paused = false;
let loaded = false;
let loading = false;
let frameId = 0;
let lastTime = null;
let lastPaint = 0;
const sprites = new Map();
let sceneTime = 0;
let boatPatches = [];
let lakePatches = [];
const residents = createVillagers();
const ducks = DUCK_ROUTES.map(routine => createDuck(routine));
const fisherman = residents.find(resident => resident.skin === 'fisher');
const dog = createCompanion(fisherman);
const peopleTargets = new Map();
const reactionTimers = new Map();

for (const resident of residents) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'person-hit';
  button.hidden = true;
  button.setAttribute('aria-label', `Say hello to ${resident.name}`);
  const bubble = document.createElement('span');
  bubble.className = 'person-reaction';
  bubble.setAttribute('aria-hidden', 'true');
  bubble.textContent = '!';
  button.append(bubble);
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (!reactToResident(resident)) return;
    announcement.textContent = `${resident.name} looks up in surprise!`;
    clearTimeout(reactionTimers.get(resident.id));
    drawScene();
    // Interactions still dismiss normally while ambient motion is paused or
    // reduced; they do not need to restart the animation loop.
    reactionTimers.set(resident.id, setTimeout(() => {
      resident.reaction = 0;
      if (!document.hidden && !smallScreen.matches) drawScene();
    }, REACTION_SECONDS * 1000));
  });
  peopleLayer.append(button);
  peopleTargets.set(resident.id, button);
}

function drawScene() {
  if (!context) return;
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawLake();
  for (const { boat, patch } of boatPatches) {
    const offset = boatOffset(boat, sceneTime);
    context.drawImage(patch, boat.x - boat.width / 2 + offset.x, boat.y - boat.height / 2 + offset.y);
  }
  ducks.forEach(drawDuck);
  for (const resident of [...residents, dog].sort((a, b) => a.y - b.y)) {
    if (resident === dog) drawDog();
    else drawResident(context, resident);
  }
}

function drawLake() {
  if (!lakePatches.length) return;
  context.save();
  context.imageSmoothingEnabled = true;
  for (const {region,patch,shine} of lakePatches) {
    // Drift the painted water, then brighten its own ripple crests with a
    // moving wash of reflected light. The shoreline and objects stay still.
    for (let y=0;y<region.height;y+=32) {
      const phase=sceneTime*.38+y*.007+region.phase;
      const offset=Math.sin(phase)*1.8;
      context.globalAlpha=.24+Math.sin(phase*.63)*.05;
      const height=Math.min(32,region.height-y);
      context.drawImage(patch,0,y,region.width,height,
        region.x+offset,region.y+y,region.width,height);
      if (shine) {
        const crest=(1+Math.sin(sceneTime*.65-y*.018+region.phase))/2;
        context.globalAlpha=.18+.62*crest*crest;
        context.drawImage(shine,0,y,region.width,height,
          region.x+offset*1.5,region.y+y,region.width,height);
      }
    }
  }
  context.restore();
}

function prepareLake() {
  if (!context || smallScreen.matches || lakePatches.length || !artwork.complete || !artwork.naturalWidth) return;
  // These windows contain open lake only, clear of the jetty, rowboat,
  // distant sailboats and shore. Their soft edges blend into the original art.
  const regions=[
    {x:1080,y:176,width:506,height:816,feather:44,phase:.3,highlight:68},
    {x:1020,y:500,width:120,height:492,feather:36,phase:1.2,highlight:68},
    {x:980,y:670,width:160,height:112,feather:28,phase:2.5,highlight:70},
    {x:512,y:910,width:305,height:82,feather:20,phase:1.8,highlight:73},
    {x:990,y:866,width:122,height:126,feather:24,phase:3.4,highlight:67},
    {x:816,y:948,width:240,height:44,feather:16,phase:4.2,highlight:71},
  ];
  lakePatches=regions.map(region=>{
    const patch=document.createElement('canvas');
    patch.width=region.width;patch.height=region.height;
    const ctx=patch.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(artwork,region.x,region.y,region.width,region.height,
      0,0,region.width,region.height);
    ctx.globalCompositeOperation='destination-in';
    for (const horizontal of [true,false]) {
      const length=horizontal?region.width:region.height;
      const fade=ctx.createLinearGradient(0,0,horizontal?length:0,horizontal?0:length);
      fade.addColorStop(0,'#0000');
      fade.addColorStop(region.feather/length,'#000');
      fade.addColorStop(1-region.feather/length,'#000');
      fade.addColorStop(1,'#0000');
      ctx.fillStyle=fade;ctx.fillRect(0,0,region.width,region.height);
    }
    // Cache a pale reflection mask from the existing bright water pixels.
    // It preserves the artwork's ripple shapes rather than drawing sparkles.
    let shine=null;
    try {
      const pixels=ctx.getImageData(0,0,region.width,region.height);
      for (let i=0;i<pixels.data.length;i+=4) {
        const light=pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722;
        pixels.data[i+3]*=Math.max(0,Math.min(1,(light-region.highlight)/12))*.75;
        pixels.data[i]=172;pixels.data[i+1]=235;pixels.data[i+2]=226;
      }
      shine=document.createElement('canvas');
      shine.id='lake-shine';shine.width=region.width;shine.height=region.height;
      const shineContext=shine.getContext('2d');
      if (shineContext) shineContext.putImageData(pixels,0,0);
      else shine=null;
    } catch {
      // The basic water motion still works if an external image host blocks
      // pixel access; it must never prevent the residents from loading.
    }
    return {region,patch,shine};
  }).filter(Boolean);
  loaded ||= lakePatches.length>0;
  syncAnimation();
}

function drawDuck(duck, index) {
  const frame = duckFrame(duck);
  const image = sprites.get(`duck-${frame}`) || sprites.get('duck-1');
  if (!image) return;
  const scale = duck.size;
  const bob = Math.sin(sceneTime * 2.1 + index * 1.4) * .7;
  if (duck.direction === 'left') duck.mirror = true;
  if (duck.direction === 'right') duck.mirror = false;
  context.save();
  context.translate(duck.x, duck.y + bob);
  // Short, faint trails sit behind moving ducks. No enclosing ellipse or
  // permanent ring: a resting duck leaves the painted water undisturbed.
  if (duck.walking) {
    context.fillStyle='#bfded326';
    for (const distance of [19,27]) {
      context.fillRect(Math.round(-duck.headingX*distance*scale)-2,
        Math.round(-duck.headingY*distance*scale*.5)+1, 4*scale, .8);
    }
  }
  if (duck.mirror) context.scale(-1, 1);
  // Source rows 33–43 contain the legs: never draw them. The cropped body
  // is slightly taller while its lower edge stays anchored to the waterline.
  const height = 37 * scale;
  context.drawImage(image, 0, 0, 44, 32, -22 * scale, -height, 44 * scale, height);
  context.restore();
}

function drawDog() {
  const sheet = sprites.get('dog');
  if (!sheet) return;
  const frame = dogFrame(dog);
  const scale = perspectiveScale(dog.y) * 1.05;
  context.drawImage(sheet, frame.x, frame.y, 32, 32,
    dog.x - 16 * scale, dog.y - 28 * scale, 32 * scale, 32 * scale);
}

function prepareBoats() {
  if (!context || smallScreen.matches || boatPatches.length || !artwork.complete || !artwork.naturalWidth) return;
  // Reuse tiny windows of the existing artwork as scene textures. Their opaque
  // centres cover the original boats; feathered water edges blend with the lake.
  // The source image stays untouched and no additional asset is downloaded.
  boatPatches = BOATS.map(boat => {
    const patch = document.createElement('canvas');
    patch.width = boat.width;
    patch.height = boat.height;
    const ctx = patch.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(artwork, boat.x - boat.width / 2, boat.y - boat.height / 2,
      boat.width, boat.height, 0, 0, boat.width, boat.height);
    ctx.globalCompositeOperation = 'destination-in';
    const radius = Math.min(boat.width, boat.height) / 2;
    const feather = ctx.createRadialGradient(boat.width / 2, boat.height / 2, radius * .72,
      boat.width / 2, boat.height / 2, radius);
    feather.addColorStop(0, '#000');
    feather.addColorStop(1, '#0000');
    ctx.fillStyle = feather;
    ctx.fillRect(0, 0, boat.width, boat.height);
    return { boat, patch };
  }).filter(Boolean);
  loaded ||= boatPatches.length > 0;
  syncAnimation();
}

function drawResident(ctx, resident) {
  const frame = residentFrame(resident);
  const sheet = sprites.get(frame.image);
  const pose = residentPose(resident);
  const target = peopleTargets.get(resident.id);
  const visible = Boolean(sheet && pose.opacity > .12 && pose.x > -40 && pose.x < WORLD_WIDTH + 40);
  target.hidden = !visible || smallScreen.matches;
  if (!visible) return;
  const scale = pose.scale * frame.multiplier;
  ctx.save();
  ctx.globalAlpha = pose.opacity;
  if (pose.clip) {
    ctx.beginPath();
    ctx.rect(pose.clip.x, pose.clip.y, pose.clip.width, pose.clip.height);
    ctx.clip();
  }
  ctx.translate(Math.round(pose.x), Math.round(pose.y));
  if (frame.mirror) ctx.scale(-1, 1);
  ctx.drawImage(sheet, frame.x, frame.y, frame.width, frame.height,
    -frame.anchorX * scale, -frame.anchorY * scale, frame.width * scale, frame.height * scale);
  if (conversationSpeaker(resident)) {
    const top=-frame.bodyHeight*scale-12;
    ctx.fillStyle='#4b483c99';
    ctx.fillRect(-10,top-1,20,12);
    ctx.fillStyle='#fff4d9eb';
    ctx.fillRect(-9,top,18,9);
    ctx.fillRect(-4,top+9,4,3);
    ctx.fillStyle='#655d4b';
    for (const x of [-5,0,5]) ctx.fillRect(x,top+4,2,2);
  }
  ctx.restore();
  const bounds = residentBounds(resident, pose, frame);
  target.style.left = `${pose.x / WORLD_WIDTH * 100}%`;
  target.style.top = `${pose.y / WORLD_HEIGHT * 100}%`;
  target.style.width = `${bounds.width / WORLD_WIDTH * 100}%`;
  target.style.height = `${bounds.height / WORLD_HEIGHT * 100}%`;
  target.classList.toggle('is-reacting', resident.reaction > 0);
}

function tick(time) {
  frameId = 0;
  if (lastTime === null) lastTime = time;
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  sceneTime += Math.min(dt, .1);
  advanceConversations(residents, dt);
  residents.forEach(resident => advanceVillager(resident, dt, Math.random, residents));
  advanceCompanion(dog, fisherman, dt);
  ducks.forEach(duck => advanceDuck(duck, dt));
  if (time - lastPaint >= 1000 / 30) {
    drawScene();
    lastPaint = time;
  }
  frameId = requestAnimationFrame(tick);
}

function syncAnimation() {
  const active = context && shouldAnimate({ loaded, visible: !document.hidden, inView,
    smallScreen: smallScreen.matches, reducedMotion: reducedMotion.matches, paused, dialogOpen: dialog.open });
  motionToggle.hidden = !loaded || smallScreen.matches || reducedMotion.matches;
  motionToggle.textContent = paused ? 'Resume village' : 'Pause village';
  motionToggle.setAttribute('aria-pressed', String(paused));
  canvas.hidden = !loaded || smallScreen.matches;
  peopleLayer.hidden = canvas.hidden;
  if (active && !frameId) {
    lastTime = null;
    lastPaint = 0;
    frameId = requestAnimationFrame(tick);
  } else if (!active) {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = null;
    if (loaded && !smallScreen.matches) drawScene();
  }
}

function resizeCanvas() {
  if (!context) return;
  if (smallScreen.matches) {
    canvas.width = 1;
    canvas.height = 1;
    return;
  }
  // Cap backing resolution at the source artwork; no multi-megapixel Retina
  // canvas or per-frame layout reads are needed for a handful of tiny sprites.
  const rect = world.getBoundingClientRect();
  const ratio = Math.min(1, rect.width * Math.min(devicePixelRatio || 1, 2) / WORLD_WIDTH);
  canvas.width = Math.max(1, Math.round(WORLD_WIDTH * ratio));
  canvas.height = Math.max(1, Math.round(WORLD_HEIGHT * ratio));
  context.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
  context.imageSmoothingEnabled = false;
  if (loaded) drawScene();
}

function loadResidents() {
  if (smallScreen.matches || sprites.size || loading || !context) return;
  // Assets are independent: a failed sprite never blocks the other residents,
  // the ducks, the artwork, or the ordinary HTML stories.
  loading = true;
  let pending = Object.keys(SPRITE_ASSETS).length;
  for (const [id, asset] of Object.entries(SPRITE_ASSETS)) {
    const image = new Image();
    const settled = () => { if (--pending === 0) loading = false; };
    image.onload = () => {
      if (image.naturalWidth === asset.width && image.naturalHeight === asset.height) {
        sprites.set(id, image);
        composeLpcSprites(sprites, () => document.createElement('canvas'));
        loaded = true;
        resizeCanvas();
        drawScene();
        syncAnimation();
      }
      settled();
    };
    image.onerror = settled;
    image.src = new URL(`../assets/village/${asset.file}`, import.meta.url).href;
  }
}

motionToggle.addEventListener('click', () => { paused = !paused; syncAnimation(); });
document.addEventListener('visibilitychange', syncAnimation);
smallScreen.addEventListener('change', () => { resizeCanvas(); prepareBoats(); prepareLake(); loadResidents(); syncAnimation(); });
reducedMotion.addEventListener('change', syncAnimation);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncAnimation(); }).observe(world);
}
if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(world);
else window.addEventListener('resize', resizeCanvas);
resizeCanvas();
artwork.addEventListener('load', prepareBoats);
artwork.addEventListener('load', prepareLake);
prepareBoats();
prepareLake();
loadResidents();
const initialChapter = location.hash.slice(1);
if (initialChapter) openChapter(initialChapter);
