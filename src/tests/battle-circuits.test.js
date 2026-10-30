import test from 'node:test'
import assert from 'node:assert/strict'
import {BATTLE_TRACKS,battleTrack,atDistance,nearestOnTrack,crossedGate} from '../battle/tracks.js'
import {createBattle,stepBattle,aiInput,damageBlast,deployHazard,advanceHazards,advanceRaceProgress,battleRanking,integrateActor,BOMB_COOLDOWN,MINE_COOLDOWN,MAX_HAZARDS} from '../battle/simulation.js'
import {makeArena} from '../showdown/rules.js'
const copy=value=>structuredClone(value)
function vulnerable(){const s=createBattle();s.actors=s.actors.map(a=>({...a,shield:0}));return s}
function explodeAt(s,p,type='bomb',owner=null){s.hazards=[{id:'fixture',type,owner,x:p.x,z:p.z,y:.2,fuse:0,arm:0,cooldown:0,persistent:false,life:5}];advanceHazards(s,copy(s.actors));return s}

test('five distinct closed circuits have safe start grids, gates, and repair pads',()=>{
 assert.equal(BATTLE_TRACKS.length,5)
 for(const spec of BATTLE_TRACKS){
  const t=battleTrack(spec.id);assert.ok(t.length>400);assert.equal(t.gates.length,8);assert.equal(t.repairs.length,2)
  assert.ok(t.path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)))
  assert.deepEqual(atDistance(t,0),atDistance(t,t.length))
  for(const actor of createBattle(spec.id).actors)assert.ok(nearestOnTrack(t,actor).distance<t.width/2-.9)
 }
 assert.throws(()=>battleTrack('unknown'))
})
test('every track is a real three-lap race with three AI opponents',()=>{
 for(const spec of BATTLE_TRACKS){
  let s=createBattle(spec.id),t=battleTrack(spec.id)
  for(let i=0;i<14000&&!s.done;i++)s=stepBattle(s,aiInput(s.actors[0],t,s))
  assert.ok(s.done,spec.id);assert.equal(s.actors[0].passed,24);assert.equal(s.actors[0].lap,4)
  assert.ok(s.actors.slice(1).every(a=>a.passed>8),spec.id)
  assert.ok(s.totalBlasts>0);assert.ok(s.actors.every(a=>a.damageTaken>0))
 }
})
test('simulation is deterministic for identical track and inputs',()=>{
 let a=createBattle(),b=createBattle()
 for(let i=0;i<500;i++){const input={forward:true,bomb:i===180,mine:i===240};a=stepBattle(a,input);b=stepBattle(b,input)}
 assert.deepEqual(a,b)
})
test('a simulation step never mutates its previous state',()=>{
 const a=vulnerable(),before=copy(a);stepBattle(a,{forward:true,bomb:true,mine:true});assert.deepEqual(a,before)
})
test('a nearby mine arms, warns, then damages a moving player with knockback',()=>{
 let s=createBattle(),warned=false,hit=false,knock=false
 for(let i=0;i<350;i++){
  s=stepBattle(s,{forward:true});warned||=s.hazards.some(h=>h.type==='mine'&&h.fuse>=0)
  hit||=s.actors[0].damageTaken>0;knock||=Math.hypot(s.actors[0].kickX,s.actors[0].kickZ)>1
 }
 assert.ok(warned&&hit&&knock)
})
test('blast falloff and knockback apply identically to player and AI',()=>{
 const s=vulnerable(),a={...s.actors[0],x:0,z:0},b={...s.actors[1],x:0,z:0}
 const blast={x:1,z:0,y:.2,radius:9,power:85}
 const left=damageBlast(a,blast),right=damageBlast(b,blast)
 assert.equal(left.damage,right.damage);assert.equal(left.actor.hp,right.actor.hp)
 assert.ok(left.actor.kickX<0);assert.ok(left.actor.stun>0)
 const far=damageBlast({...a,x:-6},blast);assert.ok(far.damage<left.damage)
 assert.equal(damageBlast({...a,x:50},blast).damage,0)
})
test('your own bombs can damage you; owner IDs grant no immunity',()=>{
 const s=vulnerable(),p=s.actors[0];s.actors.slice(1).forEach(a=>{a.x=1000;a.z=1000});explodeAt(s,p,'bomb','player')
 assert.ok(s.actors[0].hp<100);assert.equal(s.actors[0].knockouts,0);assert.equal(s.actors[0].damageDealt,0)
})
test('one explosion damages multiple unshielded racers in its radius',()=>{
 const s=vulnerable();s.actors=s.actors.map((a,i)=>({...a,x:i,z:0}))
 explodeAt(s,{x:0,z:0},'crate');assert.ok(s.actors.every(a=>a.hp<100));assert.equal(s.events.filter(e=>e.kind==='damage').length,4)
})
test('blast credit reaches its owner even if the owner also takes damage',()=>{
 const s=vulnerable();s.actors=s.actors.map((a,i)=>({...a,x:i,z:0,hp:20}))
 explodeAt(s,{x:0,z:0},'bomb','player');assert.equal(s.actors[0].knockouts,3);assert.equal(s.actors[0].damageDealt,60)
})
test('spawn shield and short hit immunity prevent repeated damage',()=>{
 const s=createBattle(),blast={x:s.actors[0].x,z:s.actors[0].z,y:.2,radius:9,power:85}
 assert.equal(damageBlast(s.actors[0],blast).damage,0)
 const once=damageBlast({...s.actors[0],shield:0},blast)
 assert.equal(damageBlast(once.actor,blast).damage,0)
})
test('destroyed player returns to last checkpoint without gaining race progress',()=>{
 let s=vulnerable();s.actors[0]={...s.actors[0],hp:1,passed:5,nextGate:6,safeS:160}
 explodeAt(s,s.actors[0]);assert.equal(s.actors[0].hp,0);assert.ok(s.actors[0].respawn>0)
 s.hazards=[]
 for(let i=0;i<125;i++)s=stepBattle(s,{})
 const a=s.actors[0];assert.equal(a.hp,100);assert.equal(a.respawn,0);assert.ok(a.shield>0)
 assert.equal(a.passed,5);assert.equal(a.nextGate,6);assert.equal(a.lap,1)
 assert.ok(Math.hypot(a.x-atDistance(battleTrack(),160).x,a.z-atDistance(battleTrack(),160).z)<1)
})
test('AI recovery restores health and resumes driving after a knockout',()=>{
 let s=vulnerable();s.actors[1]={...s.actors[1],hp:1}
 explodeAt(s,s.actors[1]);s.hazards=[]
 for(let i=0;i<250;i++)s=stepBattle(s,{})
 assert.equal(s.actors[1].hp,100);assert.ok(s.actors[1].speed>5)
})
test('bomb and mine controls have edge-triggered cooldowns, not unlimited spam',()=>{
 let s=createBattle();s=stepBattle(s,{bomb:true,mine:true})
 assert.equal(s.hazards.filter(h=>h.owner==='player').length,2)
 assert.ok(s.actors[0].bombCooldown>BOMB_COOLDOWN-.1);assert.ok(s.actors[0].mineCooldown>MINE_COOLDOWN-.1)
 for(let i=0;i<25;i++)s=stepBattle(s,{bomb:true,mine:true})
 assert.equal(s.hazards.filter(h=>h.owner==='player').length,2)
 assert.equal(s.events.filter(e=>e.kind==='deploy'&&e.actor==='player').length,0)
})
test('bombs move through a visible arc and explode once on their timer',()=>{
 let s=createBattle();s=stepBattle(s,{bomb:true});const h=s.hazards.find(h=>h.owner==='player'),id=h.id,origin={x:h.x,z:h.z},height=h.y
 let airborne=false
 for(let i=0;i<120;i++){s=stepBattle(s,{});const b=s.hazards.find(h=>h.id===id);if(b)airborne||=b.y>height+.2}
 assert.ok(airborne);assert.ok(!s.hazards.some(h=>h.id===id));assert.ok(s.totalBlasts>0)
 assert.ok(s.explosions.some(e=>e.owner==='player'&&Math.hypot(e.x-origin.x,e.z-origin.z)>5))
})
test('unarmed mines cannot immediately damage their deploying kart',()=>{
 const s=vulnerable(),p=s.actors[0];deployHazard(s,p,'mine')
 const m=s.hazards.at(-1);p.x=m.x;p.z=m.z
 advanceHazards(s,copy(s.actors));assert.equal(m.fuse,-1);assert.equal(p.hp,100)
})
test('contact warning applies to AI as well as the player',()=>{
 const s=vulnerable(),a=s.actors[2];s.hazards=[{id:'m',type:'mine',x:a.x,z:a.z,y:.2,arm:0,fuse:-1,cooldown:0,persistent:true,life:Infinity}]
 advanceHazards(s,copy(s.actors));assert.ok(s.hazards[0].fuse>0)
 for(let i=0;i<20;i++)advanceHazards(s,copy(s.actors))
 assert.ok(s.actors[2].hp<100)
})
test('persistent track hazards cool down before rearming; deployed hazards are bounded',()=>{
 let s=vulnerable();s.hazards=[{id:'mine',type:'mine',owner:null,x:0,z:0,y:.2,arm:0,fuse:0,cooldown:0,persistent:true,life:Infinity}]
 advanceHazards(s,copy(s.actors));assert.ok(s.hazards[0].cooldown>10)
 const blasts=s.totalBlasts;for(let i=0;i<30;i++)advanceHazards(s,copy(s.actors));assert.equal(s.totalBlasts,blasts)
 s.hazards=Array.from({length:MAX_HAZARDS},(_,i)=>({id:String(i)}));assert.equal(deployHazard(s,s.actors[0],'mine'),false)
 assert.equal(deployHazard(createBattle(),createBattle().actors[0],'invalid'),false)
})
test('explosions can chain nearby crates without applying recursive duplicate hits',()=>{
 const s=vulnerable();s.hazards=[0,1,2].map(i=>({id:`c${i}`,type:'crate',x:i*3,z:0,y:.6,owner:null,arm:0,fuse:i===0?0:-1,cooldown:0,persistent:true,life:Infinity}))
 advanceHazards(s,copy(s.actors));assert.equal(s.totalBlasts,1);assert.ok(s.hazards[1].fuse>=0)
 for(let i=0;i<35;i++)advanceHazards(s,copy(s.actors));assert.equal(s.totalBlasts,3)
})
test('teleport-like motion does not activate every mine along its path',()=>{
 const s=vulnerable();s.actors[0]={...s.actors[0],x:100,z:0};const old=copy(s.actors);old[0].x=-100
 s.hazards=[{id:'m',type:'mine',x:0,z:0,arm:0,fuse:-1,cooldown:0,persistent:true,life:Infinity}]
 advanceHazards(s,old);assert.equal(s.hazards[0].fuse,-1)
})
test('repair pads restore only 40 armor and respect their per-kart cooldown',()=>{
 let s=vulnerable(),t=battleTrack(),p=t.repairs[0];s.hazards=[];s.actors[0]={...s.actors[0],x:p.x,z:p.z,hp:20,speed:0}
 s=stepBattle(s,{});assert.equal(s.actors[0].hp,60)
 for(let i=0;i<60;i++)s=stepBattle(s,{})
 assert.equal(s.actors[0].hp,60)
})
test('checkpoints are directional and cannot be skipped by a teleport or reverse pass',()=>{
 const t=battleTrack(),g=t.gates[1],before=atDistance(t,g.s-1),after=atDistance(t,g.s+1)
 assert.ok(crossedGate(g,before,after,t.width));assert.equal(crossedGate(g,after,before,t.width),false)
 const a={...createBattle().actors[0],...after,shield:0}
 assert.equal(advanceRaceProgress(a,{...a,...before},t,100).passed,1)
 assert.equal(advanceRaceProgress({...a,nextGate:2},{...a,...before},t,100).passed,0)
 assert.equal(crossedGate(g,atDistance(t,g.s-10),atDistance(t,g.s+10),t.width),false)
})
test('finished races are immutable and have an unambiguous finishing order',()=>{
 const s=createBattle();s.done=true;assert.strictEqual(stepBattle(s,{bomb:true}),s)
 s.actors[2].finished=true;s.actors[2].finishTick=100;s.actors[1].finished=true;s.actors[1].finishTick=120
 assert.equal(battleRanking(s)[0].id,'nova');assert.equal(battleRanking(s)[1].id,'bolt')
})
test('existing sd1 and sd2 challenge geometry and rules are unchanged',()=>{
 assert.equal(makeArena('sd1-d20261028').bots.length,10);assert.equal(makeArena('sd1-d20261028').bounds.maxX,41)
 assert.equal(makeArena('sd2-d20261028').bots.length,16);assert.equal(makeArena('sd2-d20261028').bounds.maxX,82)
})
test('battle circuit barriers deflect a kart along the edge and keep its speed',()=>{
 const t=battleTrack('blast'),s=createBattle('blast'),p=atDistance(t,60,0)
 let a={...s.actors[0],x:p.x,z:p.z,y:p.y,yaw:p.yaw-Math.PI/2,speed:20,slipX:0,slipZ:0},hit=false
 for(let i=0;i<90;i++){a=integrateActor(a,{forward:true},t);if(nearestOnTrack(t,a).distance>t.width/2-1.4)hit=true}
 assert.ok(hit,'reached the barrier');assert.ok(a.speed>12,'kept momentum')
 const n=nearestOnTrack(t,a);assert.ok(Math.abs(-Math.sin(a.yaw)*n.dx-Math.cos(a.yaw)*n.dz)>.85,'heading along the track')
})
