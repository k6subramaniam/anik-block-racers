import test from 'node:test'
import assert from 'node:assert/strict'
import {initialBattle,stepBattle,TRACK_MINES,TRACK_BARRELS,SUPPLY_PADS,RACE_HAZARDS,BATTLE_LIMITS,trackPose,segmentGap,safeTrackPoint} from '../battle/rules.js'
import {initialRaceState,advanceKart,SAFE_ROAD_HALF_WIDTH} from '../game/simulation.js'
import {makeNpcs,advanceNpcs} from '../game/npcAI.js'
import {nearestRoad,TRACK} from '../game/track.js'
const player=()=>initialRaceState()
const empty=()=>({...initialBattle(),shield:0,hazards:[],supplies:[]})
const weapon=(x,z,kind='bomb',owner='track')=>({id:'test-hazard',kind,x,z,y:.2,vx:0,vz:0,vy:0,owner,fixed:false,arm:0,fuse:.01,life:3,cooldown:0})
function tick(s,p=player(),bots=[],actions={},dt=.05,options={}){return stepBattle(s,p,bots,dt,actions,{ai:false,...options})}

test('track has eight visible lane mines, six barrels and four distinct supply pads',()=>{
 assert.equal(TRACK_MINES.length,8);assert.equal(TRACK_BARRELS.length,6);assert.equal(SUPPLY_PADS.length,4)
 assert.equal(new Set(RACE_HAZARDS.map(h=>h.id)).size,14)
 for(const h of RACE_HAZARDS){assert.ok(nearestRoad(h).distance<3);assert.ok(Math.hypot(h.x-8,h.z-18.2)>6)}
})
test('new race begins with full health, ammunition and safe-start shield',()=>{
 const b=initialBattle();assert.equal(b.health,100);assert.equal(b.bombs,3);assert.equal(b.mines,2);assert.equal(b.shield,3)
})
test('zero, negative and non-finite time do not mutate battle state',()=>{
 const b=empty(),p=player(),bots=makeNpcs()
 for(const dt of [0,-1,NaN,Infinity])assert.strictEqual(tick(b,p,bots,{},dt).battle,b)
})
test('one button token throws one bomb even when held for many steps',()=>{
 let b=empty(),p=player()
 for(let i=0;i<100;i++){const r=tick(b,p,[],{bomb:1});b=r.battle;p=r.player}
 assert.equal(b.shots,1);assert.equal(b.bombs,2)
})
test('weapons have ammunition limits and cooldowns, not unlimited firing',()=>{
 let b=empty(),p=player()
 for(let i=1;i<=200;i++){const r=tick(b,p,[],{bomb:i});b=r.battle;p=r.player}
 assert.equal(b.bombs,0);assert.equal(b.shots,3)
})
test('deployed mine begins behind kart, arms with a delay and is not owner-immune',()=>{
 const p=player(),r=tick(empty(),p,[],{mine:1}),m=r.battle.hazards[0]
 assert.equal(m.kind,'mine');assert.equal(m.owner,'player');assert.ok(m.arm>.8);assert.equal(m.fuse,null)
 const dx=m.x-p.x,dz=m.z-p.z
 assert.ok(dx*-Math.sin(p.yaw)+dz*-Math.cos(p.yaw)<0)
 let b={...empty(),hazards:[{...m,arm:0}]},s={...p,x:m.x,z:m.z}
 for(let i=0;i<10;i++){const out=tick(b,s);b=out.battle;s=out.player}
 assert.ok(b.health<100)
})
test('mine proximity warns before exploding and uses swept contact at speed',()=>{
 const p=trackPose(20),mine={...TRACK_MINES[1],arm:0,fuse:null,cooldown:0},before={...player(),x:mine.x-2,z:mine.z},after={...before,x:mine.x+2}
 const first=tick({...empty(),hazards:[mine]},after,[],{},.05,{previousPlayer:before})
 assert.equal(first.battle.health,100);assert.equal(first.battle.hazards[0].fuse,.35)
 assert.equal(segmentGap(before,after,mine),0)
})
test('teleport movement cannot sweep-trigger every hazard on its path',()=>{
 const m=TRACK_MINES[0],p={...player(),x:m.x+100,z:m.z},old={...p,x:m.x-100}
 const r=tick({...empty(),hazards:[{...m,arm:0,cooldown:0,fuse:null}]},p,[],{},.05,{previousPlayer:old})
 assert.equal(r.battle.hazards[0].fuse,null)
})
test('blast damages player and rival simultaneously with radial falloff',()=>{
 const p=player(),near={...makeNpcs()[0],x:p.x,z:p.z,health:105},far={...makeNpcs()[1],x:p.x+40,z:p.z}
 const r=tick({...empty(),hazards:[weapon(p.x,p.z)]},p,[near,far])
 assert.equal(r.battle.health,28);assert.equal(r.bots[0].health,33);assert.equal(r.bots[1].health,105)
 assert.ok(r.battle.stun>0);assert.ok(Math.hypot(r.battle.knockX,r.battle.knockZ)>0)
})
test('player-owned blast can hurt its owner and cannot hurt friendly villagers or wildlife',()=>{
 const p=player(),animal={...makeNpcs('explore').find(n=>n.kind==='animal'),x:p.x,z:p.z}
 const r=tick({...empty(),hazards:[weapon(p.x,p.z,'bomb','player')]},p,[animal])
 assert.ok(r.battle.health<100);assert.equal(r.bots[0].health,animal.health)
})
test('multiple overlapping blast visuals do not apply repeated same-tick damage',()=>{
 const p=player(),hazards=[0,1,2].map(i=>({...weapon(p.x,p.z),id:`b${i}`}))
 const r=tick({...empty(),hazards},p)
 assert.equal(r.battle.health,28);assert.equal(r.battle.hits,1);assert.equal(r.battle.bursts.length,3)
 assert.equal(r.battle.hazards.length,0)
})
test('start/respawn shield blocks damage but does not silently hide explosions',()=>{
 const p=player(),b={...initialBattle(),hazards:[weapon(p.x,p.z)],supplies:[]},r=tick(b,p)
 assert.equal(r.battle.health,100);assert.equal(r.battle.bursts.length,1)
})
test('blast knockout gives a player credit only for a player-owned explosion',()=>{
 const p=player(),bot={...makeNpcs()[0],x:p.x,z:p.z,health:10}
 for(const owner of ['player','track','nova']){
  const r=tick({...empty(),hazards:[weapon(p.x,p.z,'bomb',owner)]},p,[bot])
  assert.equal(r.bots[0].health,0);assert.equal(r.bots[0].respawn,5);assert.equal(r.battle.botKnockouts,1)
  assert.equal(r.player.smashScore||0,owner==='player'?100:0)
 }
})
test('wrecked player recovers at a safe prior position with checkpoint/lap preserved',()=>{
 let p={...player(),lap:2,checkpoint:1,elapsed:99},b={...empty(),health:20,lastSafe:{...trackPose(15)},hazards:[weapon(p.x,p.z)]}
 let r=tick(b,p);b=r.battle;p=r.player
 assert.equal(b.respawn,2.5);assert.equal(b.health,0);assert.equal(b.wrecks,1)
 for(let i=0;i<52;i++){r=tick(b,p);b=r.battle;p=r.player}
 assert.equal(b.health,100);assert.equal(b.respawn,0);assert.ok(b.shield>2.8)
 assert.equal(p.lap,2);assert.equal(p.checkpoint,1);assert.equal(p.x,b.lastSafe.x)
})
test('weapon requests during recovery cannot spend ammo or queue a delayed shot',()=>{
 let b={...empty(),respawn:.1,health:0},p=player()
 for(let i=0;i<10;i++){const r=tick(b,p,[],{bomb:1});b=r.battle;p=r.player}
 assert.equal(b.shots,0);assert.equal(b.bombs,3)
})
test('chain reaction marks a nearby barrel for delayed detonation exactly once',()=>{
 const p=player(),barrel={...TRACK_BARRELS[0],x:p.x+3,z:p.z,arm:0,fuse:null,cooldown:0}
 let r=tick({...empty(),hazards:[weapon(p.x,p.z),barrel]},p)
 assert.equal(r.battle.hazards[0].fuse,.2)
 for(let i=0;i<5;i++)r=tick(r.battle,{...r.player,x:p.x+30})
 assert.ok(r.battle.hazards[0].cooldown>15);assert.equal(r.battle.hazards[0].fuse,null)
})
test('static mine respawn includes a warning arm window instead of instant retrigger',()=>{
 const m={...TRACK_MINES[0],cooldown:.03,arm:0,fuse:null},p={...player(),x:m.x,z:m.z}
 const r=tick({...empty(),hazards:[m]},p)
 assert.equal(r.battle.hazards[0].arm,2);assert.equal(r.battle.hazards[0].fuse,null)
})
test('repair and ammo pickups refill with caps and cannot be farmed each frame',()=>{
 const repair=SUPPLY_PADS.find(p=>p.kind==='repair'),p={...player(),x:repair.x,z:repair.z}
 let r=tick({...empty(),health:40,supplies:[{...repair,cooldown:0}]},p)
 assert.equal(r.battle.health,80);r=tick(r.battle,r.player);assert.equal(r.battle.health,80)
 const ammo=SUPPLY_PADS.find(p=>p.kind==='ammo'),a={...p,x:ammo.x,z:ammo.z}
 r=tick({...empty(),bombs:4,mines:3,supplies:[{...ammo,cooldown:0}]},a)
 assert.equal(r.battle.bombs,5);assert.equal(r.battle.mines,4)
})
test('AI racers deploy weapons only at bounded cadence with nearby opposition',()=>{
 let p=player(),b={...empty(),time:8},n={...makeNpcs()[0],x:p.x,z:p.z+8,health:105,stun:0}
 let r=stepBattle(b,p,[n],.05,{},{});assert.ok(r.battle.hazards.some(h=>h.owner==='bolt'))
 const count=r.battle.hazards.length;r=stepBattle(r.battle,r.player,r.bots,.05,{},{});assert.equal(r.battle.hazards.length,count)
 const far={...n,x:300,z:300};assert.equal(stepBattle(b,p,[far],.05,{},{}).battle.hazards.length,0)
})
test('AI mines can trigger and damage both the player and another rival',()=>{
 const p=player(),m={...weapon(p.x,p.z,'mine','bolt'),fuse:.01},n={...makeNpcs()[1],x:p.x,z:p.z}
 const r=tick({...empty(),hazards:[m]},p,[n]);assert.ok(r.battle.health<100);assert.ok(r.bots[0].health<105)
})
test('knockback resolves within the road corridor and never modifies lap bookkeeping',()=>{
 const p={...player(),...trackPose(80),lap:2,checkpoint:2},b={...empty(),knockX:200,knockZ:200}
 const r=tick(b,p);assert.ok(nearestRoad(r.player).distance<=SAFE_ROAD_HALF_WIDTH+.001);assert.equal(r.player.checkpoint,2)
 assert.ok(nearestRoad(safeTrackPoint({x:100,z:100})).distance<=SAFE_ROAD_HALF_WIDTH+.001)
})
test('combat simulation does not mutate input snapshots',()=>{
 const p=player(),bots=makeNpcs(),b=empty(),before=JSON.stringify({p,bots,b})
 tick(b,p,bots,{bomb:1});assert.equal(JSON.stringify({p,bots,b}),before)
})
test('long battle remains finite, bounded and below hazard/effect pool limits',()=>{
 let b=initialBattle(),p=player(),bots=makeNpcs();let totalHits=0
 for(let i=0;i<18000;i++){
  const old=p,oldBots=bots
  p=b.respawn>0?{...p,elapsed:p.elapsed+1/60,speed:0}:advanceKart(p,{forward:true,right:i%500<100,left:i%500>400},1/60)
  bots=advanceNpcs(bots,1/60,p)
  const r=stepBattle(b,p,bots,1/60,{bomb:Math.floor(i/120),mine:Math.floor(i/210)},{previousPlayer:old,previousBots:oldBots});b=r.battle;p=r.player;bots=r.bots
  assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.speed))
  assert.ok(b.health>=0&&b.health<=100);assert.ok(b.hazards.length<=14+BATTLE_LIMITS.dynamic);assert.ok(b.bursts.length<=16)
  assert.ok(nearestRoad(p).distance<=SAFE_ROAD_HALF_WIDTH+.04)
  totalHits=Math.max(totalHits,b.hits+b.botHits)
 }
 assert.ok(totalHits>5)
})
