import test from 'node:test'
import assert from 'node:assert/strict'
import { TRACK, ROAD_WIDTH, CHECKPOINT_1, CHECKPOINT_2, FINISH_GATE, crossedGate, nearestRoad, stepRace, trackBarriers } from '../game/track.js'
import { initialRaceState, moveKart, advanceKart, SPAWN, MAX_SPEED, SAFE_ROAD_HALF_WIDTH, formatTime, nearestObstacle } from '../game/simulation.js'

function before(g, distance=.55){return {x:g.x-g.tx*distance,z:g.z-g.tz*distance}}
function after(g, distance=.55){return {x:g.x+g.tx*distance,z:g.z+g.tz*distance}}

test('Higgsfield asset track has 156 continuous closed samples',()=>{
  assert.equal(TRACK.length,156)
  assert.equal(ROAD_WIDTH,7.2)
  const distances=TRACK.map((p,i)=>Math.hypot(p.x-TRACK[(i+1)%TRACK.length].x,p.z-TRACK[(i+1)%TRACK.length].z))
  assert.ok(Math.max(...distances)<2.8,'No gap between samples')
})
test('spawn matches original emerald kart and lies on 7.2m road',()=>{
  assert.deepEqual({x:SPAWN.x,z:SPAWN.z},{x:8,z:18.2})
  assert.ok(nearestRoad(SPAWN).distance<3.6)
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
