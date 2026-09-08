import test from 'node:test';
import assert from 'node:assert/strict';
import { createResident, advanceResident, shouldAnimate, WORLD_WIDTH, WORLD_HEIGHT, BOATS, boatOffset,
  perspectiveScale, residentPose, reactToResident, REACTION_SECONDS, DUCK_ROUTES,
  createDuck, advanceDuck, duckFrame } from '../js/village-motion.mjs';
import { residentFrame, residentBounds, SPRITE_ASSETS, COMPOSED_ASSETS, composeLpcSprites } from '../js/village-sprites.mjs';
import { createVillagers, advanceVillager, walkingPath, WALK_LINKS, WALK_NODES, DESTINATIONS,
  createCompanion, advanceCompanion, advanceConversations, conversationSpeaker } from '../js/village-navigation.mjs';

function randomSource(seed=72) {
  return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/2**32; };
}

test('boats remain within their tiny drift envelope and do not move in sync', () => {
  for (const boat of BOATS) {
    for (let t = 0; t < 600; t += .25) {
      const offset = boatOffset(boat, t);
      assert.ok(Math.abs(offset.x) <= 2.2);
      assert.ok(Math.abs(offset.y) <= 1);
    }
  }
  assert.equal(new Set(BOATS.map(boat => boatOffset(boat, 2).x)).size, BOATS.length);
  assert.deepEqual(boatOffset(BOATS[0], 15), boatOffset(BOATS[0], 15));
});

test('residents wait at a destination before walking and stop exactly at the next one', () => {
  const resident = createResident([[0, 0, .2], [1, 0, 2]], { speed: 10 });
  advanceResident(resident, .1);
  assert.equal(resident.x, 0);
  assert.equal(resident.walking, false);
  advanceResident(resident, .1);
  advanceResident(resident, .1);
  assert.equal(resident.x, 1);
  assert.equal(resident.index, 1);
  assert.equal(resident.wait, 2);
  for (let i = 0; i < 19; i++) advanceResident(resident, .1);
  assert.equal(resident.x, 1);
});

test('a long background-tab gap cannot teleport a resident across the map', () => {
  const resident = createResident([[0, 0, 0], [500, 0]], { speed: 20 });
  advanceResident(resident, 60 * 60);
  assert.equal(resident.x, 2);
  assert.equal(resident.walking, true);
});

test('diagonal movement has the same speed as horizontal movement', () => {
  const resident = createResident([[0, 0, 0], [100, 100]], { speed: 10 });
  advanceResident(resident, .1);
  assert.ok(Math.abs(Math.hypot(resident.x, resident.y) - 1) < 1e-10);
});

test('looping residents reverse direction and stay inside their path endpoints', () => {
  const resident = createResident([[0, 0, 0], [3, 0, 0]], { speed: 7, pause: 0 });
  const directions = new Set();
  for (let i = 0; i < 1000; i++) {
    advanceResident(resident, .1);
    assert.ok(resident.x >= 0 && resident.x <= 3);
    assert.equal(resident.y, 0);
    directions.add(resident.direction);
  }
  assert.ok(directions.has('left') && directions.has('right'));
});

test('mobile, reduced motion, manual pause, off-screen, modal and hidden tabs each stop animation', () => {
  const active = { loaded: true, visible: true, inView: true, smallScreen: false,
    reducedMotion: false, paused: false, dialogOpen: false };
  assert.equal(shouldAnimate(active), true);
  for (const key of Object.keys(active)) {
    assert.equal(shouldAnimate({ ...active, [key]: !active[key] }), false, key);
  }
});

test('eight residents take different trips without teleporting or leaving their paths', () => {
  const random=randomSource(), people=createVillagers(random);
  assert.equal(people.length,8);
  assert.equal(new Set(people.map(person=>person.skin)).size,8,'every resident has a distinct appearance');
  const destinations=new Map(people.filter(p=>p.destination).map(p=>[p.id,new Set()]));
  for (let i=0;i<16000;i++) for (const resident of people) {
    const {x,y,destination,tripCount}=resident;
    advanceVillager(resident,.1,random,people);
    assert.ok(resident.x>=-65&&resident.x<=WORLD_WIDTH);
    assert.ok(resident.y>=0&&resident.y<=WORLD_HEIGHT);
    assert.ok(Math.hypot(resident.x-x,resident.y-y)<=resident.speed*.1+.001);
    if(resident.destination)destinations.get(resident.id).add(resident.destination);
    if(resident.tripCount>tripCount)assert.notEqual(resident.destination,destination);
  }
  for (const visited of destinations.values()) assert.ok(visited.size>=4);
});

test('every destination is reachable using only pavement links', () => {
  const links=new Set(WALK_LINKS.flatMap(([a,b])=>[`${a}:${b}`,`${b}:${a}`]));
  const random=randomSource(125);
  for (const from of Object.keys(WALK_NODES)) for (const to of Object.keys(DESTINATIONS)) {
    const path=walkingPath(from,to,random);
    assert.equal(path[0],from);assert.equal(path.at(-1),to);
    for(let i=1;i<path.length;i++)assert.ok(links.has(`${path[i-1]}:${path[i]}`));
  }
});

test('paved routes leave room around the fountain and café furniture', () => {
  for(const [a,b] of WALK_LINKS) for(let t=0;t<=1;t+=.025) {
    const x=WALK_NODES[a][0]*(1-t)+WALK_NODES[b][0]*t;
    const y=WALK_NODES[a][1]*(1-t)+WALK_NODES[b][1]*t;
    assert.ok(((x-632)/43)**2+((y-400)/34)**2>1,'fountain base');
    assert.ok(!(x>562&&x<646&&y>710&&y<767),'café chairs and table');
    assert.ok(!(x>619&&x<652&&y>784&&y<808),'palm in front of terrace');
  }
});

test('horizontal movement selects the visually correct direction in each different sheet', () => {
  const person = createResident([[0,0,0],[100,0]], { skin:'nico' });
  advanceResident(person,.1);
  assert.equal(person.direction,'right');
  assert.equal(residentFrame(person).y,64); // The old sheet's second row faces right.
  person.direction='left';
  assert.equal(residentFrame(person).y,192);
  person.skin='sara';
  assert.equal(residentFrame(person).y,576);
  person.direction='right';
  assert.equal(residentFrame(person).y,704);
  person.skin='visitor';
  assert.equal(residentFrame(person).x,144);
  person.direction='left';
  assert.equal(residentFrame(person).x,48);
  person.skin='fisher';
  assert.equal(residentFrame(person).y,64);
  person.direction='right';
  assert.equal(residentFrame(person).y,192);
});

test('perspective grows smoothly toward the foreground and stays bounded', () => {
  assert.ok(perspectiveScale(850)>perspectiveScale(600));
  assert.ok(perspectiveScale(600)>perspectiveScale(330));
  assert.equal(perspectiveScale(-500),perspectiveScale(280));
  assert.equal(perspectiveScale(5000),perspectiveScale(920));
  assert.ok(perspectiveScale(601)-perspectiveScale(600)<.002);
  assert.ok(perspectiveScale(330)>=.95,'distant adults retain nearly their full size');
  const adult = createResident([[400,800,0],[450,800]], { skin:'nico' });
  const child = createResident([[400,800,0],[450,800]], { skin:'visitor' });
  const a=residentBounds(adult,residentPose(adult),residentFrame(adult));
  const c=residentBounds(child,residentPose(child),residentFrame(child));
  assert.ok(c.height<a.height);
  assert.equal(a.top+a.height,800);
  assert.equal(c.top+c.height,800);
});

test('a doorway visit enters, stays fully hidden, emerges, then continues along the path', () => {
  const clip={x:5,y:0,width:10,height:20};
  const r=createResident([[0,20,0],{x:10,y:20,portal:{kind:'door',stay:1,depth:5,clip}},[20,20,0]],{speed:20,pause:0});
  const phases=new Set();let hiddenSeen=false;let emerged=false;let continued=false;
  for(let i=0;i<140;i++){
    advanceResident(r,.1);phases.add(r.phase);
    if(r.phase==='inside'){hiddenSeen=true;assert.equal(residentPose(r).opacity,0);assert.equal(r.x,10)}
    if(['entering','emerging'].includes(r.phase)){assert.deepEqual(residentPose(r).clip,clip);assert.ok(residentPose(r).opacity>=0&&residentPose(r).opacity<=1)}
    if(hiddenSeen&&r.phase==='emerging')emerged=true;
    if(emerged&&r.x>10)continued=true;
  }
  for(const phase of ['entering','inside','emerging','walking'])assert.ok(phases.has(phase),phase);
  assert.ok(continued);
});

test('a visitor disappears only beyond the edge and walks back into view afterwards', () => {
  const r=createResident([[20,50,0],{x:-60,y:50,portal:{kind:'edge',stay:1}},[30,50,0]],{speed:40,pause:0});
  let left=false,returned=false;
  for(let i=0;i<130;i++){
    advanceResident(r,.1);
    if(r.phase==='inside'){left=true;assert.equal(r.x,-60);assert.equal(residentPose(r).opacity,0)}
    if(left&&r.x>0&&residentPose(r).opacity===1)returned=true;
  }
  assert.ok(left&&returned);
});

test('a greeting briefly stops a person, then their previous route resumes', () => {
  const r=createResident([[100,100,0],[300,100]],{speed:20});
  advanceResident(r,.1);
  assert.equal(reactToResident(r),true);
  const x=r.x;
  for(let i=0;i<10;i++)advanceResident(r,.1);
  assert.equal(r.x,x);assert.equal(r.walking,false);assert.ok(r.reaction>0);
  for(let i=0;i<Math.ceil(REACTION_SECONDS*10);i++)advanceResident(r,.1);
  assert.equal(r.reaction,0);assert.ok(r.x>x);
  r.phase='inside';assert.equal(reactToResident(r),false);
});

test('the fisherman spends over 94% of his time calmly fishing, with rare short walks', () => {
  const r=createVillagers(randomSource()).find(r=>r.skin==='fisher');
  assert.equal(residentFrame(r).image,'fisher-fishing');
  const states=new Set(), random=randomSource(12);
  let fishing=0,held=0;
  for(let i=0;i<9000;i++){
    advanceVillager(r,.1,random);
    const frame=residentFrame(r);
    states.add(frame.image);
    if(r.activity==='fishing') {
      fishing++;
      if(frame.x===5*128)held++;
    }
  }
  assert.ok(states.has('fisher-fishing')&&states.has('fisher-walking'));
  assert.ok(fishing/9000>.94);
  assert.ok(held/fishing>.99,'rod rests steadily after the initial cast');
});

test('two distinct residents can sit on the bench without taking an occupied seat', () => {
  const random=randomSource(31),people=createVillagers(random),sitters=new Set();
  const initial=people.find(r=>r.skin==='felix');
  assert.equal(initial.activity,'sitting');
  assert.equal(residentFrame(initial).image,'felix-sitting');
  for(let i=0;i<30000;i++){
    for(const person of people){
      const {x,y,activity,wait}=person;
      advanceVillager(person,.1,random,people);
      if(activity==='sitting'&&wait>.1)assert.deepEqual([person.x,person.y],[x,y]);
      if(person.activity==='sitting'){
        sitters.add(person.skin);
        const frame=residentFrame(person);
        assert.equal(frame.image,`${person.skin}-sitting`);
        assert.equal(frame.x,128);assert.equal(frame.y,128);
        assert.ok(person.seat==='seatLeft'||person.seat==='seatRight');
      }
    }
    for(const seat of ['seatLeft','seatRight']){
      const claims=people.filter(person=>person.seat===seat||person.destination===seat);
      assert.ok(claims.length<=1,`${seat} cannot be double booked`);
    }
  }
  assert.deepEqual([...sitters].sort(),['felix','tomas']);
});

test('nearby villagers stop, face each other, take speaking turns, then resume their routes', () => {
  const random=randomSource(92),people=createVillagers(random);
  const a=people.find(r=>r.id==='hugo'),b=people.find(r=>r.id==='tomas');
  const tick=()=>{advanceConversations(people,.1,random);people.forEach(r=>advanceVillager(r,.1,random,people));};
  for(let i=0;i<20;i++)tick();
  assert.ok(a.conversation&&a.conversation===b.conversation);
  assert.equal(a.direction,'left');assert.equal(b.direction,'right');
  const positions=[a.x,a.y,b.x,b.y],speakers=new Set();
  while(a.conversation){
    assert.deepEqual([a.x,a.y,b.x,b.y],positions);
    assert.equal(a.walking,false);assert.equal(b.walking,false);
    for(const person of [a,b])if(conversationSpeaker(person))speakers.add(person.id);
    tick();
  }
  assert.equal(speakers.size,2);
  assert.ok(a.socialCooldown>30&&b.socialCooldown>30);
  for(let i=0;i<50;i++)tick();
  assert.notDeepEqual([a.x,a.y,b.x,b.y],positions);
  assert.equal(people.find(r=>r.skin==='fisher').conversation,null);
});

test('the dog follows the fisherman along the jetty and rests nearby', () => {
  const fisherman=createVillagers(randomSource()).find(r=>r.skin==='fisher');
  const dog=createCompanion(fisherman), states=new Set();
  for(let i=0;i<3000;i++){
    advanceVillager(fisherman,.1);
    const {x,y}=dog;
    advanceCompanion(dog,fisherman,.1);
    states.add(dog.walking);
    assert.ok(dog.x>=874&&dog.x<=950&&dog.y>=803&&dog.y<=823);
    assert.ok(Math.hypot(dog.x-x,dog.y-y)<2);
    assert.ok(Math.hypot(dog.x-fisherman.x,dog.y-fisherman.y)<31);
    assert.ok(dog.trail.length<30,'footstep history is bounded');
  }
  assert.ok(states.has(true)&&states.has(false));
});

test('ducks normally hold folded wings and flutter only in brief irregular bursts', () => {
  const random=randomSource(), duck=createDuck(DUCK_ROUTES[0],random);
  const rests=[],initial=duck.nextFlutter;
  assert.equal(duckFrame(duck),2);
  let resting=0,fluttering=0,lastFlutter=0;
  for(let i=0;i<3000;i++){
    advanceDuck(duck,.1,random);
    if(duck.flutter>0)fluttering++;else {resting++;assert.equal(duckFrame(duck),2)}
    if(lastFlutter>0&&duck.flutter===0)rests.push(duck.nextFlutter);
    lastFlutter=duck.flutter;
  }
  assert.ok(initial>=5&&initial<=21);
  assert.ok(resting>fluttering*10&&fluttering>0);
  assert.ok(new Set(rests).size>3);
  assert.ok(rests.every(t=>t>=12&&t<=35));
});

test('LPC composition requires all layers and uses in-bounds source frames', () => {
  const images=new Map(Object.entries(SPRITE_ASSETS).map(([id,size])=>[id,{...size,id}]));
  const calls=[];
  const makeCanvas=()=>({getContext:()=>({drawImage(image,x,y,w,h){
    assert.ok(x>=0&&y>=0&&x+w<=image.width&&y+h<=image.height,image.id);
    calls.push(image.id);
  }})});
  const missing=new Map(images);missing.delete('head-thrust');
  composeLpcSprites(missing,makeCanvas);
  assert.ok(!missing.has('fisher-fishing'));
  composeLpcSprites(images,makeCanvas);
  for(const [id,size] of Object.entries(COMPOSED_ASSETS)){
    assert.equal(images.get(id).width,size.width);assert.equal(images.get(id).height,size.height);
  }
  const count=calls.length;
  composeLpcSprites(images,makeCanvas);
  assert.equal(calls.length,count,'sheets are built once');
});

test('the four ducks keep swimming within the foreground water', () => {
  for(const routine of DUCK_ROUTES){
    const duck=createResident(routine.route,routine);
    for(let i=0;i<6000;i++){
      advanceResident(duck,.1);
      assert.ok(duck.x>=500&&duck.x<=780);
      assert.ok(duck.y>=900&&duck.y<=980);
    }
  }
});

test('all resident animation frames fit their actual asset dimensions', () => {
  for(const skin of ['nico','sara','visitor','fisher','gentleman','rosa','felix','tomas'])for(const direction of ['up','left','down','right']){
    const r=createResident([[100,100,0],[200,100]],{skin});r.direction=direction;
    for(const state of [{walking:true},{walking:false},{walking:false,activity:'sitting'},
      {walking:false,activity:'fishing'},{walking:false,activity:'fishing',reaction:1}]){
      Object.assign(r,{activity:'idle',reaction:0},state);
      for(let t=0;t<3;t+=.05){
        r.elapsed=t;const f=residentFrame(r),a=SPRITE_ASSETS[f.image]||COMPOSED_ASSETS[f.image];
        assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<=a.width&&f.y+f.height<=a.height,`${skin} ${direction}`);
      }
    }
  }
});

test('invalid motion data fails early instead of producing NaN coordinates', () => {
  assert.throws(() => createResident([[0, 0]]));
  assert.throws(() => createResident([[0, 0], [NaN, 4]]));
  assert.throws(() => createResident([[0, 0], [4, 4]], { speed: 0 }));
  const resident = createResident([[0, 0, 0], [4, 4]]);
  for (const dt of [-1, NaN, Infinity]) advanceResident(resident, dt);
  assert.equal(resident.x, 0);
  assert.equal(resident.y, 0);
});
