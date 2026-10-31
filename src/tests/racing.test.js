import test from 'node:test'
import assert from 'node:assert/strict'
import { TRACK, ROAD_WIDTH, LANES, LANE_WIDTH, LANE_OFFSETS, GRID_LANES, CHECKPOINT_1, CHECKPOINT_2, FINISH_GATE, FINISH_INDEX, START_INDEX, BOOST_PADS, gateAt, COINS, crossedGate, nearestRoad, stepRace, trackBarriers } from '../game/track.js'
import { initialRaceState, moveKart, advanceKart, SPAWN, MAX_SPEED, SAFE_ROAD_HALF_WIDTH, formatTime, nearestObstacle } from '../game/simulation.js'

function before(g, distance=.55){return {x:g.x-g.tx*distance,z:g.z-g.tz*distance}}
function after(g, distance=.55){return {x:g.x+g.tx*distance,z:g.z+g.tz*distance}}

test('Grand Circuit is a 156-sample closed loop of six 3.6m lanes',()=>{
  assert.equal(TRACK.length,156)
  assert.equal(LANES,6);assert.equal(LANE_WIDTH,3.6);assert.ok(Math.abs(ROAD_WIDTH-21.6)<1e-9)
  assert.deepEqual(LANE_OFFSETS.map(x=>+x.toFixed(2)),[-9,-5.4,-1.8,1.8,5.4,9])
  assert.deepEqual(GRID_LANES.map(x=>+x.toFixed(2)),[-5.4,-1.8,1.8,5.4],'the grid uses the four middle lanes')
  const distances=TRACK.map((p,i)=>Math.hypot(p.x-TRACK[(i+1)%TRACK.length].x,p.z-TRACK[(i+1)%TRACK.length].z))
  assert.ok(Math.max(...distances)<2.8,'No gap between samples')
  const lap=distances.reduce((a,b)=>a+b,0)
  assert.ok(lap>300,`lap is ${lap.toFixed(1)}m, at least 1.7x the original 177m`)
})
test('circuit keeps clear of the castle, village and lagoon and never overlaps itself',()=>{
  const clear=(x,z,r)=>nearestRoad({x,z}).distance-ROAD_WIDTH/2-r
  assert.ok(clear(0,1,4.9)>5,'castle');assert.ok(clear(18,-2,4.5)>5,'lava pool')
  assert.ok(clear(-42,18,7.25)>2,'village house');assert.ok(clear(-42,-18,7.25)>2,'village house')
  assert.ok(clear(52,71,0)>5,'lagoon shore')
  const arc=[0];for(let i=1;i<TRACK.length;i++)arc.push(arc[i-1]+Math.hypot(TRACK[i].x-TRACK[i-1].x,TRACK[i].z-TRACK[i-1].z))
  const total=arc[arc.length-1]+Math.hypot(TRACK[0].x-TRACK[155].x,TRACK[0].z-TRACK[155].z)
  for(let i=0;i<TRACK.length;i+=2)for(let j=i+2;j<TRACK.length;j+=2){
    const along=Math.min(arc[j]-arc[i],total-(arc[j]-arc[i]))
    if(along>ROAD_WIDTH*3)assert.ok(Math.hypot(TRACK[i].x-TRACK[j].x,TRACK[i].z-TRACK[j].z)>ROAD_WIDTH*2,`samples ${i} and ${j} overlap`)
  }
})
test('player starts in the back row, right-hand lane, behind the finish line',()=>{
  const road=nearestRoad(SPAWN)
  assert.ok(Math.abs(road.distance-GRID_LANES[3])<.2)
  assert.ok(FINISH_INDEX-START_INDEX>=6&&FINISH_INDEX-START_INDEX<=10)
  const ahead=(FINISH_GATE.x-SPAWN.x)*FINISH_GATE.tx+(FINISH_GATE.z-SPAWN.z)*FINISH_GATE.tz
  assert.ok(ahead>12&&ahead<24,'finish line is ahead of the grid')
  const here=gateAt(START_INDEX)
  assert.ok(-Math.sin(SPAWN.yaw)*here.tx-Math.cos(SPAWN.yaw)*here.tz>.999,'faces race direction')
})
test('boost pads and coins sit in lanes across the whole road',()=>{
  for(const item of [...BOOST_PADS,...COINS])assert.ok(nearestRoad(item).distance<ROAD_WIDTH/2-1)
  assert.equal(new Set(COINS.map(c=>Math.round(nearestRoad(c).distance))).size>=2,true)
  assert.equal(BOOST_PADS.length,4);assert.equal(COINS.length,12)
})
test('kart builds speed with acceleration, brakes and stays within speed caps',()=>{
  let s=initialRaceState()
  for(let i=0;i<100;i++)s=moveKart(s,{forward:true},1/60)
  assert.ok(s.speed>10)
  assert.ok(s.speed<=MAX_SPEED)
  let b=s.speed
  for(let i=0;i<12;i++)s=moveKart(s,{backward:true},1/60)
  assert.ok(s.speed<b)
})
test('steering changes yaw, car starts oriented west',()=>{
  const start=initialRaceState()
  let s={...start,speed:10}
  s=moveKart(s,{right:true},.05)
  assert.ok(s.yaw<start.yaw)
})
test('wall collision clamps kart within drivable corridor and reduces speed',()=>{
  const s={...initialRaceState(),speed:18,yaw:0}
  let current=s;let bumped=false
  for(let i=0;i<120;i++){
    current=moveKart(current,{forward:true},.05)
    if(current.event==='wall'){bumped=true;break}
  }
  assert.ok(bumped,'Expected road-edge impact')
  assert.ok(nearestRoad(current).distance <= SAFE_ROAD_HALF_WIDTH+.001)
  assert.ok(current.collisions>0)
})
test('obstacle collider rejects interpenetration',()=>{
  const obstacle={id:'tree',x:SPAWN.x-2,z:SPAWN.z,radius:.8}
  assert.ok(nearestObstacle({...obstacle},[obstacle]))
  let s={...initialRaceState(),speed:11}
  for(let i=0;i<20;i++)s=moveKart(s,{forward:true},1/60,[obstacle])
  assert.ok(Math.hypot(s.x-obstacle.x,s.z-obstacle.z) >= 1.64-.03)
})
test('checkpoint crossing must be in race direction',()=>{
  assert.ok(crossedGate(before(CHECKPOINT_1),after(CHECKPOINT_1),CHECKPOINT_1))
  assert.ok(!crossedGate(after(CHECKPOINT_1),before(CHECKPOINT_1),CHECKPOINT_1))
  assert.ok(!crossedGate({x:100,z:100},{x:-100,z:-100},CHECKPOINT_1))
})
test('lap finish is impossible without ordered checkpoints',()=>{
  const race=initialRaceState()
  const noCheat=stepRace(race,before(FINISH_GATE),after(FINISH_GATE))
  assert.equal(noCheat.lap,1)
  assert.equal(noCheat.checkpoint,0)
  const cp2First=stepRace(race,before(CHECKPOINT_2),after(CHECKPOINT_2))
  assert.equal(cp2First.checkpoint,0)
})
test('three laps through ordered gates ends race',()=>{
  let s=initialRaceState()
  s={...s,elapsed:40}
  for(let round=1;round<=3;round++){
    s=stepRace(s,before(CHECKPOINT_1),after(CHECKPOINT_1))
    assert.equal(s.checkpoint,1)
    s=stepRace(s,before(CHECKPOINT_2),after(CHECKPOINT_2))
    assert.equal(s.checkpoint,2)
    s=stepRace(s,before(FINISH_GATE),after(FINISH_GATE))
    assert.equal(s.event,round===3?'finished':'lap')
    assert.equal(s.lap,Math.min(round+1,3))
    s={...s,elapsed:s.elapsed+40}
  }
  assert.ok(s.bestLap>=0)
})
test('barriers form a closed collision system with both road sides',()=>{
  const b=trackBarriers()
  assert.equal(b.length,104)
  assert.ok(b.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.yaw)&&x.length>0))
})
test('timer formatting includes hundredths',()=>{
  assert.equal(formatTime(79.156),'01:19.15')
  assert.equal(formatTime(null),'--:--.--')
})
test('hitting a wall glances the kart along it instead of bouncing it backwards',()=>{
 // Drive straight across the road from the grid: the right-hand wall is a few metres away.
 let s={...initialRaceState(),speed:18,yaw:initialRaceState().yaw-Math.PI/2},hit=null
 for(let i=0;i<120&&!hit;i++){s=moveKart(s,{forward:true},1/60);if(s.event==='wall')hit=s}
 assert.ok(hit,'reached the wall')
 assert.ok(hit.speed>8,'keeps most of its momentum (no reverse bounce)')
 const road=nearestRoad(hit),a=TRACK[road.index],b=TRACK[(road.index+1)%TRACK.length],len=Math.hypot(b.x-a.x,b.z-a.z)
 const along=Math.abs(-Math.sin(hit.yaw)*(b.x-a.x)/len-Math.cos(hit.yaw)*(b.z-a.z)/len)
 assert.ok(along>.85,'now heading mostly along the wall')
 // Keep the throttle on: the kart drives away instead of grinding the barrier.
 let walls=0
 for(let i=0;i<120;i++){s=moveKart(s,{forward:true},1/60);if(s.event==='wall')walls++}
 assert.ok(walls<12,`only ${walls} further wall frames`);assert.ok(s.speed>12)
})
