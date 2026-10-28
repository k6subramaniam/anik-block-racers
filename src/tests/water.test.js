import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceWater,WATER_BODIES,WATER_DESTINATIONS,waterAt} from '../game/water.js'
import {advanceExplore,fastTravel,initialExploreState,WORLD_BOUNDS} from '../game/openWorld.js'

test('three drivable 3D lakes have distinct footprints and safe shore points',()=>{
 assert.equal(WATER_BODIES.length,3)
 assert.equal(WATER_DESTINATIONS.length,3)
 assert.equal(new Set(WATER_BODIES.map(b=>b.id)).size,3)
 for(const b of WATER_BODIES){
  assert.ok(waterAt({x:b.x,z:b.z}))
  assert.equal(waterAt(b.rescue),null)
  assert.ok(b.rescue.x>WORLD_BOUNDS.minX&&b.rescue.x<WORLD_BOUNDS.maxX)
  assert.ok(b.rescue.z>WORLD_BOUNDS.minZ&&b.rescue.z<WORLD_BOUNDS.maxZ)
 }
})
test('splash triggers once and hydrodynamic drag reduces speed while sinking',()=>{
 const b=WATER_BODIES[1]
 const first=advanceWater({...initialExploreState(),x:b.x,z:b.z,speed:18},.05)
 assert.equal(first.event,'water-splash')
 assert.equal(first.inWater,true)
 assert.ok(first.speed<18)
 assert.ok(first.submersion>0)
 const second=advanceWater({...first,event:null},.05)
 assert.notEqual(second.event,'water-splash')
 assert.ok(second.submersion>first.submersion)
 assert.ok(second.speed<first.speed)
})
test('deep water auto-rescues to nearest safe shore and never traps the kart',()=>{
 const lake=WATER_BODIES[2]
 let s={...initialExploreState(),x:lake.x,z:lake.z,speed:0}
 let rescued=false,maxSink=0
 for(let i=0;i<140;i++){
  s=advanceExplore(s,{},.05)
  maxSink=Math.max(maxSink,s.submersion||0)
  if(s.event==='water-rescue'){rescued=true;break}
 }
 assert.ok(rescued)
 assert.ok(maxSink>.9)
 assert.equal(s.inWater,false)
 assert.equal(s.speed,0)
 assert.equal(waterAt(s),null)
 assert.equal(s.x,lake.rescue.x)
})
test('driving out of lake before rescue lets the kart surface',()=>{
 const b=WATER_BODIES[0]
 const s={...initialExploreState(),x:b.x,z:b.z,inWater:true,waterId:b.id,submersion:.6,waterTimer:2}
 const out=advanceWater({...s,x:b.x+b.rx+1},.05)
 assert.equal(out.inWater,false)
 assert.ok(out.submersion<.6)
 assert.equal(out.waterTimer,0)
})
test('fast travel to lakes starts on dry land and clears submersion',()=>{
 for(const w of WATER_DESTINATIONS){
  const start={...initialExploreState(),speed:19,inWater:true,waterTimer:3,submersion:1}
  const next=fastTravel(start,w.id)
  assert.equal(next.inWater,false)
  assert.equal(next.submersion,0)
  assert.equal(next.speed,0)
  assert.equal(next.zoneName,w.name)
  assert.equal(waterAt(next),null)
 }
})
test('rain, snow, and windy periods preserve stable explore physics at a lake',()=>{
 const l=WATER_BODIES[0]
 let s={...initialExploreState(),x:l.x,z:l.z}
 for(let i=0;i<300;i++){
  s=advanceExplore(s,{forward:i%3===0,left:i%5===0},1/60)
  assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.z)&&Number.isFinite(s.speed))
  assert.ok((s.submersion||0)>=0&&(s.submersion||0)<=1)
 }
})

test('lake fast-travel pads point the kart toward water, not away from it',()=>{
 for(const lake of WATER_BODIES){
  const p=lake.rescue
  const dx=-Math.sin(p.yaw),dz=-Math.cos(p.yaw)
  const toward=(lake.x-p.x)*dx+(lake.z-p.z)*dz
  assert.ok(toward>8,`${lake.id} must face its lake`)
 }
})
