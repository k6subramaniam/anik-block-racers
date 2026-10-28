import test from 'node:test'
import assert from 'node:assert/strict'
import {WORLD_SIZE,EXPANDED_BOUNDS,ORIGINAL_BOUNDS,FRONTIER_ZONES,FRONTIER_CHUNKS,FRONTIER_OBSTACLES,FRONTIER_ROADS,FRONTIER_TREES,generateFrontier,safeFrontierPosition,roadDistance,buildObstacleIndex,nearbyObstacles,frontierBudget} from '../game/frontier.js'
import {ZONES,RELICS,WORLD_BOUNDS,LANDMARK_OBSTACLES,initialExploreState,fastTravel,advanceExplore,mapPosition} from '../game/openWorld.js'
import {BOUNDS,LEGACY_BOUNDS,makeArena,dailyChallenge,newChallenge,initialShowdown,stepShowdown,resultFor,validChallenge} from '../showdown/rules.js'
import {validResult,saveResult,localScores} from '../showdown/storage.js'
import {waterAt} from '../game/water.js'
const area=b=>(b.maxX-b.minX)*(b.maxZ-b.minZ)
test('open-world driving bounds expand threefold on each axis, exactly nine times the area',()=>{
 assert.equal(area(WORLD_BOUNDS)/area(ORIGINAL_BOUNDS),9)
 assert.equal(WORLD_SIZE.width,906);assert.equal(WORLD_SIZE.depth,756)
 assert.deepEqual(WORLD_BOUNDS,EXPANDED_BOUNDS)
})
test('new districts are reachable beyond old boundaries and fast travel remains safe',()=>{
 for(const z of FRONTIER_ZONES){
  let s=fastTravel(initialExploreState(),z.id)
  assert.ok(Math.abs(s.x)>ORIGINAL_BOUNDS.maxX)
  assert.equal(waterAt(s),null)
  assert.ok(!LANDMARK_OBSTACLES.some(o=>Math.hypot(s.x-o.x,s.z-o.z)<o.radius+.85))
  s=advanceExplore(s,{},.05,LANDMARK_OBSTACLES)
  assert.ok(s.visited.includes(z.id));assert.equal(s.zoneName,z.name)
 }
})
test('drive across the old east boundary without an invisible wall',()=>{
 let s={...initialExploreState(),x:149,z:0,speed:23,yaw:-Math.PI/2}
 for(let i=0;i<150;i++)s=advanceExplore(s,{forward:true},1/60)
 assert.ok(s.x>190);assert.notEqual(s.event,'border')
})
test('four new district centres contain one-time relics on clear land',()=>{
 assert.equal(ZONES.length,10);assert.equal(RELICS.length,10)
 for(const z of FRONTIER_ZONES){
  const r=RELICS.find(r=>r.zoneId===z.id);assert.ok(r)
  assert.ok(!FRONTIER_OBSTACLES.some(o=>Math.hypot(r.x-o.x,r.z-o.z)<o.radius+.85))
  const s=advanceExplore({...initialExploreState(),x:r.x,z:r.z},{},.05)
  assert.ok(s.collected.includes(r.id));assert.equal(s.coins,5)
  assert.equal(advanceExplore(s,{},.05).coins,5)
 }
})
test('frontier forest is deterministic, chunked and keeps highways/plazas unobstructed',()=>{
 assert.deepEqual(generateFrontier().trees,FRONTIER_TREES)
 assert.ok(FRONTIER_TREES.length>500);assert.ok(FRONTIER_CHUNKS.length>40)
 for(const t of FRONTIER_TREES){assert.ok(safeFrontierPosition(t.x,t.z));assert.ok(FRONTIER_ROADS.every(r=>roadDistance(t.x,t.z,r)>r.width/2+4))}
 for(const chunk of FRONTIER_CHUNKS)assert.ok(chunk.trees.length<=13)
})
test('highway centre lines remain traversable around every new solid landmark',()=>{
 for(const r of FRONTIER_ROADS)for(let i=0;i<=40;i++){
  const x=r.a[0]+(r.b[0]-r.a[0])*i/40,z=r.a[1]+(r.b[1]-r.a[1])*i/40
  assert.ok(!FRONTIER_OBSTACLES.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+1.0),r.id)
 }
})
test('spatial index returns large and border-straddling obstacles once',()=>{
 const obstacles=[{id:'big',x:47,z:47,radius:12},{id:'edge',x:-49,z:0,radius:2},{id:'far',x:400,z:300,radius:3}]
 const index=buildObstacleIndex(obstacles)
 assert.ok(nearbyObstacles(index,{x:57,z:57}).some(o=>o.id==='big'))
 assert.ok(nearbyObstacles(index,{x:-47,z:0}).some(o=>o.id==='edge'))
 const list=nearbyObstacles(index,{x:48,z:48});assert.equal(new Set(list).size,list.length)
 assert.ok(!list.some(o=>o.id==='far'))
})
test('expanded-map projection agrees with all four corners and centre',()=>{
 assert.deepEqual(mapPosition({x:-453,z:-378}),{x:0,y:0})
 assert.deepEqual(mapPosition({x:453,z:378}),{x:240,y:190})
 assert.deepEqual(mapPosition({x:0,z:0}),{x:120,y:95})
})
test('Eco hides distant geometry earlier without reducing physical world size',()=>{
 assert.ok(frontierBudget('eco').drawDistance<frontierBudget('high').drawDistance)
 assert.ok(frontierBudget('high').fogFar<720)
})
test('new challenge version gets four times the arena area with more targets and ramps',()=>{
 const old=makeArena('sd1-d20261028'),wide=makeArena('sd2-d20261028')
 assert.equal(area(wide.bounds)/area(old.bounds),4)
 assert.equal(wide.bots.length,16);assert.equal(wide.ramps.length,6)
 assert.equal(old.bots.length,10);assert.equal(old.ramps.length,3)
 assert.deepEqual(old.bounds,LEGACY_BOUNDS);assert.deepEqual(wide.bounds,BOUNDS)
})
test('new challenges default to version 2 but old friend links remain valid',()=>{
 assert.match(dailyChallenge(new Date('2026-10-28T00:00:00Z')),/^sd2-d/)
 assert.match(newChallenge(123),/^sd2-c/)
 assert.ok(validChallenge('sd1-d20261028'));assert.ok(validChallenge('sd2-d20261028'))
})
test('new arena can be driven past old edge; classic challenges still stop there',()=>{
 for(const code of ['sd1-d20261028','sd2-d20261028']){
  let s=initialShowdown(code);s.player={...s.player,x:39,z:35,speed:23,yaw:-Math.PI/2}
  const arena=makeArena(code)
  for(let i=0;i<90;i++)s=stepShowdown(s,{forward:true},arena)
  if(code.startsWith('sd2'))assert.ok(s.player.x>55);else assert.ok(s.player.x<=41)
 }
})
test('old and new scores keep correct rules versions and separate local boards',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
 for(const v of [1,2]){
  const code=`sd${v}-d20261028`,arena=makeArena(code);let s=initialShowdown(code)
  for(let i=0;i<3600;i++)s=stepShowdown(s,{forward:true},arena)
  const result=resultFor(s);assert.equal(result.rulesVersion,v);assert.ok(validResult(result))
  assert.ok(!validResult({...result,rulesVersion:v===1?2:1}))
  saveResult(result,`v${v}`,storage);assert.equal(localScores(code,storage).length,1)
 }
})
