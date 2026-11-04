import test from 'node:test'
import assert from 'node:assert/strict'
import {nextTarget,mapMarker,formatDistance,MINIMAP_RADIUS} from '../game/exploreGuide.js'
import {ZONES,RELICS,EXPLORE_SPAWN} from '../game/openWorld.js'

test('the guide points at the nearest undiscovered district first',()=>{
  const first=nextTarget(EXPLORE_SPAWN)
  assert.equal(first.kind,'district')
  assert.equal(first.id,'grove','Portal Grove is straight ahead of the explore spawn')
  const near=nextTarget({x:100,z:-50},[])
  assert.equal(near.id,'city')
  const skip=nextTarget({x:100,z:-50},['city'])
  assert.notEqual(skip.id,'city')
  // Bearing 0 is north (-z), pi/2 is east (+x).
  const east=nextTarget({x:0,z:-57},ZONES.map(z=>z.id).filter(id=>id!=='city'))
  assert.equal(east.id,'city');assert.ok(Math.abs(east.bearing-Math.PI/2)<.05)
})

test('after every district it hunts relics, then stops',()=>{
  const all=ZONES.map(z=>z.id)
  const relic=nextTarget({x:-60,z:0},all,[])
  assert.equal(relic.kind,'relic');assert.equal(relic.id,'relic-village');assert.match(relic.name,/BLOCKHAVEN VILLAGE RELIC/)
  assert.equal(nextTarget({x:0,z:0},all,RELICS.map(r=>r.id)),null)
  assert.equal(nextTarget({x:NaN,z:0}),null)
})

test('far targets are pinned to the map rim along their bearing',()=>{
  const pos={x:0,z:0}
  assert.deepEqual(mapMarker(pos,{x:30,z:40}),{x:30,z:40,edge:false})
  const far=mapMarker(pos,{x:300,z:-400})
  assert.ok(far.edge)
  assert.ok(Math.abs(Math.hypot(far.x,far.z)-MINIMAP_RADIUS*.86)<1e-9)
  assert.ok(Math.abs(far.x/far.z-300/-400)<1e-9,'same direction')
  assert.equal(formatDistance(243),'245 m');assert.equal(formatDistance(1260),'1.3 km')
})

import {advanceExplore} from '../game/openWorld.js'
import {initialRaceState} from '../game/simulation.js'
test('a race-state frame in explore mode does not crash',()=>{
  const next=advanceExplore(initialRaceState(),{forward:true},.016)
  assert.ok(Array.isArray(next.visited)&&Array.isArray(next.collected))
})
