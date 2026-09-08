// Every sheet has its own verified direction convention. In the original
// resident sheet the second row faces RIGHT, not left.
const revisedActions=['walk','idle','sitting'];
const revisedLayers=['common-body','common-head','common-shoes','felix-shirt','felix-overalls',
  'felix-hair','tomas-shirt','tomas-pants','tomas-hair'];
const revisedSize=action=>({width:action==='walk'?512:192,height:256});

export const SPRITE_ASSETS = {
  nico: { file: 'resident-lpc-v1.png', width: 144, height: 256 },
  sara: { file: 'resident-sara-v1.png', width: 832, height: 1344 },
  visitor: { file: 'resident-george-v1.png', width: 192, height: 192 },
  'body-walk': { file:'lpc-body-walk.png', width:576, height:256 },
  'head-walk': { file:'lpc-head-walk.png', width:576, height:256 },
  'body-thrust': { file:'lpc-body-thrust.png', width:512, height:256 },
  'head-thrust': { file:'lpc-head-thrust.png', width:512, height:256 },
  pants: { file:'lpc-pants.png', width:832, height:1344 },
  shoes: { file:'lpc-shoes-brown.png', width:832, height:1344 },
  shirt: { file:'lpc-shirt.png', width:832, height:1344 },
  'jacket-brown': { file:'lpc-jacket-brown.png', width:832, height:1344 },
  'jacket-tan': { file:'lpc-jacket-tan.png', width:832, height:1344 },
  hat: { file:'lpc-hat.png', width:832, height:1344 },
  'hat-front': { file:'lpc-hat-front.png', width:832, height:1344 },
  'rod-bg': { file:'lpc-rod-bg.png', width:1664, height:512 },
  'rod-fg': { file:'lpc-rod-fg.png', width:1664, height:512 },
  dog: { file:'dog-lpc-v1.png', width:512, height:256 },
  'duck-1': { file: 'duck-paddle-1.png', width: 44, height: 44 },
  'duck-2': { file: 'duck-paddle-2.png', width: 44, height: 44 },
  'duck-3': { file: 'duck-paddle-3.png', width: 44, height: 44 },
  'rosa-dress': {file:'residents/rosa-dress-full.png',width:832,height:1344},
  'rosa-hair': {file:'residents/rosa-hair-full.png',width:832,height:1344},
  ...Object.fromEntries(revisedLayers.flatMap(layer=>revisedActions.map(action=>[
    `rev-${layer}-${action}`, {file:`residents/${layer}-${action}.png`,...revisedSize(action)},
  ]))),
};

const classicCompositions = {
  gentleman:{width:576,height:256},
  'fisher-walking':{width:576,height:256},
  'fisher-fishing':{width:1664,height:512},
};

export const COMPOSED_ASSETS = {
  ...classicCompositions,
  rosa:{width:576,height:256},
  ...Object.fromEntries(['felix','tomas'].flatMap(skin=>revisedActions.map(action=>[
    `${skin}-${action}`,revisedSize(action),
  ]))),
};

const lpcRows = {up:0,left:1,down:2,right:3};
export const FISHING_BODY_FRAMES = [0,1,2,3,4,5,4,4,4,5,4,2,3];

// Assemble compatible, unscaled LPC layers once after loading, using the
// upstream fishing-tool frame map. No per-frame color filters or asset edits.
export function composeLpcSprites(images, makeCanvas) {
  for (const [id, dimensions] of Object.entries(classicCompositions)) {
    if (images.has(id)) continue;
    const fishing = id === 'fisher-fishing';
    const action = fishing ? 'thrust' : 'walk';
    const jacket = id === 'gentleman' ? 'jacket-tan' : 'jacket-brown';
    const layers = [`body-${action}`,`head-${action}`,'shoes','pants','shirt',jacket,'hat','hat-front'];
    const required = fishing ? [...layers,'rod-bg','rod-fg'] : layers;
    if (!required.every(key => images.has(key))) continue;
    const canvas = makeCanvas();
    canvas.width=dimensions.width; canvas.height=dimensions.height; canvas.id=id;
    const ctx=canvas.getContext('2d');
    if (!ctx) continue;
    const cell=fishing?128:64, inset=fishing?32:0, columns=fishing?13:9;
    for (let row=0;row<4;row++) for (let column=0;column<columns;column++) {
      const frame = fishing ? FISHING_BODY_FRAMES[column] : column;
      const x=column*cell, y=row*cell;
      if (fishing) ctx.drawImage(images.get('rod-bg'),x,y,128,128,x,y,128,128);
      for (const key of layers) {
        const sourceRow = key.startsWith('body-') || key.startsWith('head-') ? row : row+(fishing?4:8);
        ctx.drawImage(images.get(key),frame*64,sourceRow*64,64,64,x+inset,y+inset,64,64);
      }
      if (fishing) ctx.drawImage(images.get('rod-fg'),x,y,128,128,x,y,128,128);
    }
    images.set(id,canvas);
  }
  if (!images.has('rosa') && images.has('rosa-dress') && images.has('rosa-hair')) {
    const canvas=makeCanvas();canvas.width=576;canvas.height=256;canvas.id='rosa';
    const ctx=canvas.getContext('2d');
    if (ctx) {
      for (const layer of ['rosa-dress','rosa-hair'])
        ctx.drawImage(images.get(layer),0,512,576,256,0,0,576,256);
      images.set('rosa',canvas);
    }
  }
  for (const skin of ['felix','tomas']) for (const action of revisedActions) {
    const id=`${skin}-${action}`;
    if (images.has(id)) continue;
    const layers=['common-body','common-shoes',`${skin}-shirt`,
      skin==='felix'?'felix-overalls':'tomas-pants','common-head',`${skin}-hair`]
      .map(layer=>`rev-${layer}-${action}`);
    if (!layers.every(layer=>images.has(layer))) continue;
    const canvas=makeCanvas();Object.assign(canvas,{id,...revisedSize(action)});
    const ctx=canvas.getContext('2d');
    if (!ctx) continue;
    for (const layer of layers) ctx.drawImage(images.get(layer),0,0,canvas.width,canvas.height,
      0,0,canvas.width,canvas.height);
    images.set(id,canvas);
  }
}

export function dogFrame(dog) {
  return {x:128+(dog.walking ? [0,1,2,1][Math.floor(dog.elapsed*8)%4] : 0)*32,
    y:{right:0,up:32,down:64,left:96}[dog.direction]};
}

export function residentFrame(resident) {
  const { direction, elapsed, walking } = resident;
  if (resident.skin==='felix' || resident.skin==='tomas') {
    const action=resident.activity==='sitting' && !walking ? 'sitting' : walking?'walk':'idle';
    const column=action==='sitting'?2:action==='walk'?Math.floor(elapsed*8)%8:0;
    return {image:`${resident.skin}-${action}`,x:column*64,y:lpcRows[direction]*64,width:64,height:64,
      anchorX:32,anchorY:62,multiplier:1,bodyWidth:28,bodyHeight:action==='sitting'?49:54,mirror:false};
  }
  if (resident.skin==='rosa') {
    return {image:'rosa',x:walking?(1+Math.floor(elapsed*8)%8)*64:0,y:lpcRows[direction]*64,
      width:64,height:64,anchorX:32,anchorY:61,multiplier:1,bodyWidth:28,bodyHeight:51,mirror:false};
  }
  if (resident.skin === 'sara') {
    return { image: 'sara', x: walking ? (1 + Math.floor(elapsed * 8) % 8) * 64 : 0,
      y: {up:512,left:576,down:640,right:704}[direction], width:64,height:64,
      anchorX:32,anchorY:61,multiplier:1,bodyWidth:28,bodyHeight:51,mirror:false };
  }
  if (resident.skin === 'visitor') {
    return { image:'visitor',x:{down:0,left:48,up:96,right:144}[direction],
      y: walking ? Math.floor(elapsed * 7) % 4 * 48 : 0,width:48,height:48,
      anchorX:24,anchorY:42,multiplier:1.13,bodyWidth:28,bodyHeight:32,mirror:false };
  }
  if (resident.skin === 'fisher' || resident.skin === 'gentleman') {
    if (resident.skin === 'fisher' && resident.activity === 'fishing' && !walking) {
      const cast=resident.activityElapsed;
      const column=resident.reaction>0 ? 11 : cast<.5 ? 2 : cast<.75 ? 3 : cast<.85 ? 4 : 5;
      return {image:'fisher-fishing',x:column*128,y:lpcRows[direction]*128,width:128,height:128,
        anchorX:64,anchorY:93,multiplier:1,bodyWidth:28,bodyHeight:51,mirror:false};
    }
    return {image:resident.skin==='fisher'?'fisher-walking':'gentleman',
      x:walking?(1+Math.floor(elapsed*8)%8)*64:0,y:lpcRows[direction]*64,width:64,height:64,
      anchorX:32,anchorY:61,multiplier:1,bodyWidth:28,bodyHeight:51,mirror:false};
  }
  const column = walking ? [0,1,2,1][Math.floor(elapsed * 7) % 4] : 1;
  return { image:'nico',x:column*48,y:{up:0,right:64,down:128,left:192}[direction],width:48,height:64,
    anchorX:24,anchorY:63,multiplier:1,bodyWidth:28,bodyHeight:50,mirror:false };
}

export function residentBounds(resident, pose, frame) {
  const scale = pose.scale * frame.multiplier;
  return { left:pose.x - frame.bodyWidth * scale / 2,top:pose.y - frame.bodyHeight * scale,
    width:frame.bodyWidth * scale,height:frame.bodyHeight * scale };
}
