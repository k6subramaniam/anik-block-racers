import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceExplore,clampWorld,EXPLORE_SPAWN,fastTravel,initialExploreState,LANDMARK_OBSTACLES,mapPosition,RELICS,WORLD_BOUNDS,zoneAt,ZONES} from '../game/openWorld.js'
import {initialRaceState,moveKart} from '../game/simulation.js'
import {nearestRoad} from '../game/track.js'

test('open world has six varied destinations and unique collectible relics',()=>{
 assert.equal(ZONES.length,6)
 assert.equal(RELICS.length,6)
 assert.equal(new Set(ZONES.map(x=>x.id)).size,6)
 assert.ok(ZONES.every(x=>x.spawn && x.name && x.radius>=20))
})
test('exploration spawns OFF the racetrack',()=>{
 const s=initialExploreState()
 assert.equal(s.x,EXPLORE_SPAWN.x)
 assert.ok(nearestRoad(s).distance>3.6)
 assert.equal(s.lap,1)
})
test('race edge collision unchanged with options default',()=>{
 let s={...initialRaceState(),speed:15,yaw:0}
 for(let i=0;i<100;i++) s=moveKart(s,{forward:true},1/60)
 assert.ok(nearestRoad(s).distance<3.6)
})
test('free roam drives through the original track edge',()=>{
 let s={...initialExploreState(),speed:9,yaw:0}
 for(let i=0;i<90;i++) s=advanceExplore(s,{forward:true},1/60)
 assert.ok(s.z< -45)
 assert.ok(s.elapsed>1)
 assert.equal(s.lap,1)
 assert.equal(s.checkpoint,0)
})
test('bounded open world stops kart at outer map edge',()=>{
 const p=clampWorld({x:10000,z:-10000})
 assert.equal(p.x,WORLD_BOUNDS.maxX)
 assert.equal(p.z,WORLD_BOUNDS.minZ)
 assert.equal(p.blocked,true)
 let s={...initialExploreState(),x:WORLD_BOUNDS.maxX-.7,z:0,yaw:-Math.PI/2,speed:22}
 s=advanceExplore(s,{forward:true},.05)
 assert.ok(s.x<=WORLD_BOUNDS.maxX)
})
test('landmark and decorative obstacles have finite circular footprints',()=>{
 assert.ok(LANDMARK_OBSTACLES.length>=12)
 for(const o of LANDMARK_OBSTACLES)assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.z)&&o.radius>1)
})
test('approaching zones registers discovery only once',()=>{
 let s={...initialExploreState(),x:105,z:-57,speed:0}
 s=advanceExplore(s,{},.05)
 assert.equal(s.visited.length,1)
 assert.equal(s.visited[0],'city')
 assert.equal(s.zoneName,'NEON CITY')
 const r=advanceExplore(s,{},.05)
 assert.equal(r.visited.length,1)
 assert.notEqual(r.event,'discovery')
})
test('six relics each grant one-time bonuses with no double award',()=>{
 let s={...initialExploreState(),x:-107,z:79}
 s=advanceExplore(s,{},.05)
 assert.ok(s.collected.includes('relic-canyon'))
 assert.equal(s.coins,5)
 s=advanceExplore(s,{},.05)
 assert.equal(s.coins,5)
})
test('fast travel moves to safe spawn and resets speed',()=>{
 const s={...initialExploreState(),speed:20}
 const next=fastTravel(s,'ember')
 assert.deepEqual({x:next.x,z:next.z},{x:102,z:76})
 assert.equal(next.speed,0)
 assert.strictEqual(fastTravel(s,'unknown'),s)
})
test('portal traversal returns explorer to Voxel Valley',()=>{
 const s={...initialExploreState(),x:0,z:-106.7,yaw:0,speed:10,portalCooldown:0}
 const next=advanceExplore(s,{forward:true},.05)
 assert.equal(next.event,'portal')
 assert.ok(Math.hypot(next.x-8,next.z-18.2)<.01)
})
test('lava hazard respawns at the safe Ember approach',()=>{
 const s={...initialExploreState(),x:120,z:118,speed:0}
 const next=advanceExplore(s,{},.05)
 assert.equal(next.event,'lava')
 assert.deepEqual({x:next.x,z:next.z},{x:102,z:76})
})
test('map projection preserves ordering and clamps points in bounds',()=>{
 const a=mapPosition({x:-151,z:-126}), b=mapPosition({x:151,z:126})
 assert.deepEqual(a,{x:0,y:0})
 assert.deepEqual(b,{x:240,y:190})
 assert.ok(mapPosition({x:400,z:400}).x<=240)
})
test('zone discovery distances are distinct',()=>{
 for(const zone of ZONES)assert.equal(zoneAt({x:zone.x,z:zone.z})?.id,zone.id)
 assert.equal(zoneAt({x:0,z:0}),null)
})

test('open world remains numerically stable during long wandering',()=>{
 let s=initialExploreState()
 for(let i=0;i<30000;i++){
  const cycle=Math.floor(i/280)%5
  s=advanceExplore(s,{forward:cycle!==4,left:cycle===1,right:cycle===3,drift:cycle===2},1/60,LANDMARK_OBSTACLES)
  assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.z)&&Number.isFinite(s.yaw)&&Number.isFinite(s.speed))
  assert.ok(s.x>=WORLD_BOUNDS.minX-.05&&s.x<=WORLD_BOUNDS.maxX+.05)
  assert.ok(s.z>=WORLD_BOUNDS.minZ-.05&&s.z<=WORLD_BOUNDS.maxZ+.05)
 }
 assert.equal(s.lap,1)
})
