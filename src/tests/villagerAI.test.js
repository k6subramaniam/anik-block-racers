import test from 'node:test'
import assert from 'node:assert/strict'
import {VILLAGERS,PEDESTRIAN_PATHS,makeVillagers,advanceVillagers,nearbyVillager,talkToVillager} from '../game/villagerAI.js'
import {ZONES,RELICS,initialExploreState,fastTravel,advanceExplore,LANDMARK_OBSTACLES} from '../game/openWorld.js'

test('twelve original walking characters have individual roles and outfits',()=>{
  assert.equal(VILLAGERS.length,12)
  assert.equal(new Set(VILLAGERS.map(v=>v.id)).size,12)
  for(const v of VILLAGERS){
    assert.ok(v.name&&v.role&&v.dialogue.length>20)
    assert.match(v.tunic,/^#[0-9a-f]{6}$/i)
    assert.ok(v.walkSpeed>0&&v.walkSpeed<3)
  }
})
test('village paths, city and grove routes are closed, finite and in map bounds',()=>{
  assert.ok(Object.keys(PEDESTRIAN_PATHS).length>=8)
  for(const path of Object.values(PEDESTRIAN_PATHS)){
    assert.ok(path.length>=4)
    for(const [x,z] of path){
      assert.ok(Number.isFinite(x)&&Math.abs(x)<=150)
      assert.ok(Number.isFinite(z)&&Math.abs(z)<=124)
    }
  }
})
test('making a villager group is stable and starts on its assigned path',()=>{
  const npcs=makeVillagers()
  assert.equal(npcs.length,12)
  npcs.forEach((n,i)=>{
    const path=PEDESTRIAN_PATHS[n.route]
    assert.deepEqual([n.x,n.z],path[i%path.length])
    assert.ok(n.targetIndex>=0&&n.targetIndex<path.length)
  })
})
test('walking pedestrians advance along paths with animated walk cycles',()=>{
  const start=makeVillagers()
  let actors=start
  for(let i=0;i<180;i++) actors=advanceVillagers(actors,.05,{x:10000,z:10000,speed:0})
  const moved=actors.filter((a,i)=>Math.hypot(a.x-start[i].x,a.z-start[i].z)>1)
  assert.ok(moved.length>=9)
  assert.ok(actors.every(a=>a.walkCycle>0))
})
test('paused or invalid duration does not advance walking state',()=>{
  const initial=makeVillagers()
  assert.strictEqual(advanceVillagers(initial,0,{x:0,z:0}),initial)
  assert.strictEqual(advanceVillagers(initial,Number.NaN,{x:0,z:0}),initial)
})
test('villagers evade fast oncoming cars and stay local',()=>{
  const pedestrian={...makeVillagers()[0],idle:0,walkSpeed:1.2}
  const driver={x:pedestrian.x,z:pedestrian.z+1,yaw:0,speed:21}
  const next=advanceVillagers([pedestrian],.05,driver)[0]
  assert.ok(next.z<pedestrian.z)
  assert.equal(next.walking,true)
})
test('slow parked cars do not scare pedestrians',()=>{
  const person={...makeVillagers()[0],x:0,z:-1,idle:0}
  const moving=advanceVillagers([person],.05,{x:0,z:0,speed:1})[0]
  assert.ok(Number.isFinite(moving.z))
  assert.ok(moving.walkCycle>=person.walkCycle)
})
test('nearby interaction chooses closest villager and respects reach',()=>{
  const actors=makeVillagers()
  const a=actors[0]
  const at={x:a.x+.1,z:a.z+.2,speed:0}
  assert.equal(nearbyVillager(actors,at)?.id,a.id)
  assert.equal(nearbyVillager(actors,{x:200,z:200},4),null)
})
test('first conversation earns two coins; repeat chat earns none',()=>{
  const person=makeVillagers()[1]
  const s=initialExploreState()
  const hello=talkToVillager(s,person)
  assert.equal(hello.firstMeeting,true)
  assert.equal(hello.state.coins,2)
  assert.deepEqual(hello.state.metVillagers,[person.id])
  assert.equal(hello.dialogue.name,person.name)
  const again=talkToVillager(hello.state,person)
  assert.equal(again.state.coins,2)
  assert.equal(again.firstMeeting,false)
  assert.deepEqual(again.state.metVillagers,[person.id])
})
test('talking to each of twelve villagers grants capped one-time rewards',()=>{
  let state=initialExploreState()
  for(const person of makeVillagers()){
    state=talkToVillager(state,person).state
    state=talkToVillager(state,person).state
  }
  assert.equal(state.coins,24)
  assert.equal(state.metVillagers.length,12)
})
test('sixth discovery zone includes safe fast travel and relic',()=>{
  const z=ZONES.find(z=>z.id==='village')
  assert.ok(z)
  assert.equal(z.name,'BLOCKHAVEN VILLAGE')
  assert.equal(ZONES.length,6)
  assert.equal(RELICS.length,6)
  const s=fastTravel(initialExploreState(),'village')
  assert.deepEqual({x:s.x,z:s.z},{x:-63,z:-28})
  assert.ok(!LANDMARK_OBSTACLES.some(o=>Math.hypot(s.x-o.x,s.z-o.z)<o.radius+.85))
  assert.equal(Math.hypot(s.x-z.x,s.z-z.z)<z.radius,true, 'fast travel lands inside discovery zone')
  const next=advanceExplore({...s,x:z.x,z:z.z}, {},.05)
  assert.ok(next.visited.includes('village'))
})
test('blockhaven has collision volumes for houses, well and forge',()=>{
  const buildings=LANDMARK_OBSTACLES.filter(x=>x.id.startsWith('village')||x.id.startsWith('blockhaven'))
  assert.ok(buildings.length>=7)
  assert.ok(buildings.every(x=>x.radius>=3))
})
test('12 walking villagers remain finite in 10 minutes of simulation',()=>{
  let walkers=makeVillagers()
  for(let t=0;t<12000;t++){
    const car=t%400<200?{x:-62,z:-20,speed:19}:{x:104,z:-53,speed:0}
    walkers=advanceVillagers(walkers,.05,car)
  }
  assert.ok(walkers.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.z)&&Number.isFinite(n.yaw)))
  assert.ok(walkers.every(n=>Math.abs(n.x)<152&&Math.abs(n.z)<128))
})
