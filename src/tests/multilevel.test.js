import test from 'node:test'
import assert from 'node:assert/strict'
import {BATTLE_TRACKS,battleTrack,atDistance,nearestOnTrack,crossedGate} from '../battle/tracks.js'
import {createBattle,stepBattle,aiInput,integrateActor,damageBlast,advanceRaceProgress,deployHazard,advanceHazards} from '../battle/simulation.js'
import {resolveVehicleContacts,KART_RADIUS} from '../battle/collisions.js'
import {normalizeLaps,normalizeWeather,raceWeather,WEATHER_SECONDS,parseRacePreferences} from '../battle/weather.js'
function actor(id,s=32,lane=0){return {...createBattle().actors[0],id,...atDistance(battleTrack(),s,lane),speed:0,shield:0}}
function finish(trackId,laps,weather='dynamic'){
 let s=createBattle(trackId,{laps,weather}),track=battleTrack(trackId)
 for(let i=0;i<laps*6500+1000&&!s.done;i++)s=stepBattle(s,aiInput(s.actors[0],track,s))
 return s
}
test('lap selection accepts 1–10 and rejects corrupted URL/storage values',()=>{
 for(let i=1;i<=10;i++){assert.equal(normalizeLaps(i),i);assert.equal(normalizeLaps(String(i)),i);assert.equal(createBattle('blast',{laps:i}).laps,i)}
 for(const n of [0,-4,11,2.5,NaN,Infinity,'3.4','1e1','<script>',null,undefined])assert.equal(normalizeLaps(n),3)
 assert.equal(normalizeWeather('invalid'),'dynamic')
})
test('each selected lap count governs the finish condition, not only HUD text',()=>{
 const track=battleTrack(),gate=track.gates[0]
 for(let laps=1;laps<=10;laps++){
  const a={...actor('player'),...atDistance(track,track.length-1),lap:laps,nextGate:0,passed:laps*8-1}
  const b={...a,...atDistance(track,1)}
  const done=advanceRaceProgress(b,a,track,100,laps)
  assert.ok(done.finished);assert.equal(done.lap,laps+1);assert.equal(done.passed,8*laps)
  if(laps>1)assert.equal(advanceRaceProgress({...b,lap:laps-1},{...a,lap:laps-1},track,100,laps).finished,false)
 }
})
test('one and ten-lap races actually finish after the selected distance',()=>{
 for(const laps of [1,10]){const s=finish('blast',laps);assert.ok(s.done);assert.equal(s.actors[0].passed,laps*8);assert.equal(s.actors[0].lap,laps+1)}
})
test('all five track levels complete with dynamic weather and collisions enabled',()=>{
 for(const t of BATTLE_TRACKS){const s=finish(t.id,1);assert.ok(s.done,t.id);assert.equal(s.actors[0].passed,8);assert.ok(s.actors.slice(1).some(a=>a.passed>2),t.id)}
})
test('elevated levels have actual graded roads rather than decorative raised scenery',()=>{
 assert.equal(BATTLE_TRACKS.length,5)
 assert.equal(battleTrack('blast').maxHeight,0)
 for(const [id,height] of [['canyon',12],['frost',10],['skybridge',24],['summit',32]]){
  const t=battleTrack(id);assert.equal(t.maxHeight,height)
  assert.ok(t.path.some(p=>p.y>4));assert.ok(t.path.every(p=>p.y>=0))
  for(let s=0;s<t.length;s+=2){const p=atDistance(t,s);assert.ok(Math.abs(p.grade)<.7);assert.ok(Math.abs(nearestOnTrack(t,p).y-p.y)<.001)}
 }
})
test('bridge crossing selects upper and lower surfaces by elevation',()=>{
 const t=battleTrack('skybridge')
 assert.ok(nearestOnTrack(t,{x:0,z:0,y:0}).y<.1)
 assert.ok(nearestOnTrack(t,{x:0,z:0,y:24}).y>23.9)
})
test('cars on different bridge decks never collide or damage one another',()=>{
 const t=battleTrack('skybridge'),a={...actor('player'),x:0,z:0,y:0,speed:20},b={...actor('bolt'),x:0,z:0,y:24,speed:0}
 const r=resolveVehicleContacts([a,b],[a,b],t,100)
 assert.equal(r.events.length,0);assert.equal(r.actors[0].hp,100);assert.equal(r.actors[1].hp,100)
})
test('checkpoint under a bridge cannot be awarded while driving over it',()=>{
 const t=battleTrack('skybridge'),g=t.gates[0],a={x:g.x-g.dx,y:24,z:g.z-g.dz},b={x:g.x+g.dx,y:24,z:g.z+g.dz}
 assert.equal(crossedGate(g,a,b,t.width),false)
 assert.ok(crossedGate(g,{...a,y:0},{...b,y:0},t.width))
})
test('rear-end impact transfers speed and damages both player and rival',()=>{
 const a={...actor('player',32),speed:24},b={...actor('bolt',34),speed:5},t=battleTrack()
 const r=resolveVehicleContacts([a,b],[a,b],t,100)
 assert.ok(r.actors[0].speed<24);assert.ok(r.actors[1].speed>5)
 assert.ok(r.actors.every(a=>a.hp<100));assert.equal(r.events.length,2)
 assert.ok(Math.hypot(r.actors[0].x-r.actors[1].x,r.actors[0].z-r.actors[1].z)>=KART_RADIUS*2)
})
test('AI to AI collisions use the same physical response',()=>{
 const a={...actor('nova',32),speed:24},b={...actor('pixel',34),speed:5}
 const r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 assert.ok(r.actors.every(a=>a.hp<100));assert.ok(r.actors[0].speed<24)
})
test('head-on crashes produce separation and speed loss without numerical explosions',()=>{
 const a={...actor('player',32),speed:25},b={...actor('bolt',34),yaw:actor('bolt',34).yaw+Math.PI,speed:23}
 const r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 assert.ok(r.actors.every(a=>Number.isFinite(a.speed)&&a.hp<100))
 assert.ok(r.actors.every(a=>Math.abs(a.speed)<=27))
})
test('side collisions resolve without allowing vehicles to overlap',()=>{
 const a={...actor('player',32,0),speed:16},b={...actor('bolt',32,1.4),speed:16,yaw:actor('bolt',32).yaw+.7}
 const r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 assert.ok(Math.hypot(r.actors[0].x-r.actors[1].x,r.actors[0].z-r.actors[1].z)>1.4)
})
test('resting bumper contact does not repeatedly damage or farm crash counts',()=>{
 const a=actor('player',32),b=actor('bolt',34),r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 assert.equal(r.events.length,0);assert.ok(r.actors.every(a=>a.hp===100))
})
test('collision cooldown prevents damage spam while contact persists',()=>{
 const a={...actor('player',32),speed:24},b={...actor('bolt',34),speed:5}
 const r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 const next=resolveVehicleContacts([a,b],[a,b],battleTrack(),101,r.pairCooldowns)
 assert.equal(next.events.length,0)
})
test('shields prevent collision damage but still separate solid vehicles',()=>{
 const a={...actor('player',32),speed:24,shield:2},b={...actor('bolt',34),speed:5,shield:2}
 const r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 assert.ok(r.actors.every(a=>a.hp===100));assert.ok(r.actors[0].speed<24)
})
test('collision solver leaves input snapshots unchanged',()=>{
 const a={...actor('player',32),speed:24},b=actor('bolt',34),before=JSON.stringify([a,b]),locks={}
 resolveVehicleContacts([a,b],[a,b],battleTrack(),100,locks)
 assert.equal(JSON.stringify([a,b]),before);assert.deepEqual(locks,{})
})
test('respawned and finished cars cannot produce ghost collisions',()=>{
 const a={...actor('player',32),speed:24},b={...actor('bolt',34),hp:0,respawn:1}
 assert.equal(resolveVehicleContacts([a,b],[a,b],battleTrack(),100).events.length,0)
 assert.equal(resolveVehicleContacts([a,{...b,hp:100,respawn:0,finished:true}],[a,b],battleTrack(),100).events.length,0)
})
test('collision can disable a kart, while its checkpoint and lap progress remain intact',()=>{
 const a={...actor('player',32),speed:24,hp:2,passed:4,nextGate:5,lap:1},b=actor('bolt',34)
 const r=resolveVehicleContacts([a,b],[a,b],battleTrack(),100)
 assert.equal(r.actors[0].hp,0);assert.equal(r.actors[0].respawn,2);assert.equal(r.actors[0].passed,4);assert.equal(r.actors[0].nextGate,5)
})
test('weather cycles clear → rain → snow → wind with continuous transitions',()=>{
 assert.equal(raceWeather(0).label,'CLEAR')
 for(const [i,label] of ['RAIN','SNOW','WINDY','CLEAR'].entries())assert.equal(raceWeather((i+1)*WEATHER_SECONDS*60+600).label,label)
 for(let cycle=1;cycle<=4;cycle++){
  const n=cycle*WEATHER_SECONDS*60,a=raceWeather(n-1),b=raceWeather(n)
  assert.ok(Math.abs(a.grip-b.grip)<.01);assert.ok(Math.abs(a.rain-b.rain)<.01)
 }
})
test('fixed weather stays selected and does not secretly cycle',()=>{
 for(const kind of ['clear','rain','snow','windy'])for(const t of [0,1000,10000,50000])assert.equal(raceWeather(t,kind).kind,kind)
})
test('wet and snowy roads measurably reduce braking and steering response',()=>{
 const t=battleTrack(),a={...actor('player',32),speed:20}
 const dry=integrateActor(a,{backward:true,right:true},t,1/60,raceWeather(0,'clear'))
 const snow=integrateActor(a,{backward:true,right:true},t,1/60,raceWeather(0,'snow'))
 assert.ok(snow.speed>dry.speed);assert.ok(Math.abs(snow.yaw-a.yaw)<Math.abs(dry.yaw-a.yaw))
})
test('crosswinds cause lateral movement, including at exposed elevations',()=>{
 const t=battleTrack(),a=actor('player',32)
 const dry=integrateActor(a,{},t,1/60,raceWeather(0,'clear')),wind=integrateActor(a,{},t,1/60,raceWeather(0,'windy'))
 assert.ok(Math.hypot(dry.x-wind.x,dry.z-wind.z)>0.001)
})
test('slopes affect acceleration and vehicle elevation tracks the actual road',()=>{
 const t=battleTrack('skybridge');let s=0
 while(s<t.length&&atDistance(t,s).grade<.15)s+=1
 const p=atDistance(t,s),a={...actor('player'),...p,speed:15}
 const up=integrateActor(a,{forward:true},t,1/60,raceWeather(0,'clear'))
 const down=integrateActor({...a,yaw:a.yaw+Math.PI},{forward:true},t,1/60,raceWeather(0,'clear'))
 assert.ok(down.speed>up.speed);assert.ok(up.y>0)
})
test('height-aware blast damage cannot hit a kart through a distant upper deck',()=>{
 const a={...actor('player'),x:0,z:0,y:24},blast={x:0,z:0,y:.2,radius:9,power:85}
 assert.equal(damageBlast(a,blast).damage,0)
 assert.ok(damageBlast(a,{...blast,y:24.2}).damage>0)
})
test('mines and bombs are placed on the same elevated deck as their owner',()=>{
 const t=battleTrack('skybridge');let state=createBattle('skybridge'),p={...state.actors[0],...atDistance(t,t.length/2),shield:0}
 state.actors[0]=p;deployHazard(state,p,'mine');deployHazard(state,p,'bomb')
 const mine=state.hazards.find(h=>h.owner==='player'&&h.type==='mine'),bomb=state.hazards.find(h=>h.owner==='player'&&h.type==='bomb')
 assert.ok(mine.y>23);assert.ok(bomb.y>24)
})
test('restart state resets weather, contact locks and target laps together',()=>{
 let a=createBattle('summit',{laps:5,weather:'snow'});for(let i=0;i<120;i++)a=stepBattle(a,{forward:true})
 const fresh=createBattle(a.trackId,{laps:a.laps,weather:a.weatherMode})
 assert.equal(fresh.tick,0);assert.equal(fresh.laps,5);assert.equal(fresh.weather.label,'SNOW');assert.deepEqual(fresh.pairCooldowns,{})
})
test('extreme driving remains finite on every track in each fixed weather',()=>{
 for(const spec of BATTLE_TRACKS)for(const weather of ['clear','rain','snow','windy']){
  let s=createBattle(spec.id,{laps:1,weather});const track=battleTrack(spec.id)
  for(let i=0;i<900;i++){
   s=stepBattle(s,{forward:true,left:i%150<50,right:i%150>95,bomb:i%80===0,mine:i%150===0})
   for(const a of s.actors){assert.ok([a.x,a.y,a.z,a.hp,a.speed].every(Number.isFinite));assert.ok(a.y>=0);assert.ok(a.hp>=0&&a.hp<=100);assert.ok(nearestOnTrack(track,a).distance<track.width/2)}
  }
 }
})

test('corrupt saved race preferences cannot prevent the menu from loading',()=>{
 for(const value of ['null','[]','true','{broken','"bad"','{"laps":false,"weather":1}'])assert.deepEqual(parseRacePreferences(value),{laps:3,weather:'dynamic'})
 assert.deepEqual(parseRacePreferences('{"laps":7,"weather":"rain"}'),{laps:7,weather:'rain'})
})
