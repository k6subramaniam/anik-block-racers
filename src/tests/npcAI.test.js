import test from 'node:test'
import assert from 'node:assert/strict'
import {RIVALS,CRITTERS,makeNpcs,advanceNpcs,applyRamming,trackAt,TRACK_LENGTH} from '../game/npcAI.js'
import {nearestRoad} from '../game/track.js'
import {initialRaceState} from '../game/simulation.js'

test('three AI racers start safely on the real track',()=>{
  const n=makeNpcs('race')
  assert.equal(n.length,3)
  assert.deepEqual(n.map(a=>a.kind),['racer','racer','racer'])
  for(const npc of n){assert.ok(nearestRoad(npc).distance<3);assert.ok(npc.health>0)}
  assert.ok(TRACK_LENGTH>140)
})
test('free-roam includes eight unique intelligent wildlife bots',()=>{
  const n=makeNpcs('explore')
  assert.equal(n.length,11)
  assert.equal(new Set(n.map(a=>a.id)).size,11)
  assert.equal(n.filter(a=>a.kind==='animal').length,8)
  assert.ok(RIVALS.length===3 && CRITTERS.length===8)
})
test('AI racers move around the course without leaving the track',()=>{
  let n=makeNpcs('race')
  const player=initialRaceState()
  for(let i=0;i<5000;i++)n=advanceNpcs(n,.05,player,'race')
  for(const racer of n){
    assert.ok(Number.isFinite(racer.x)&&Number.isFinite(racer.z))
    assert.ok(nearestRoad(racer).distance<2.1)
    assert.ok(racer.travel>200)
  }
})
test('animals flee the approaching player and stay around their home',()=>{
  const base=makeNpcs('explore')
  const animal=base.find(n=>n.id==='fox')
  const near={x:animal.x+2,z:animal.z+2}
  let n=[animal]
  const distance0=Math.hypot(n[0].x-near.x,n[0].z-near.z)
  for(let i=0;i<10;i++)n=advanceNpcs(n,.05,near,'explore')
  assert.ok(Math.hypot(n[0].x-near.x,n[0].z-near.z)>distance0)
  assert.ok(Math.hypot(n[0].x-animal.home.x,n[0].z-animal.home.z)<12)
})
test('grazing at low speed cannot farm damage or points',()=>{
  const bot={...makeNpcs('explore').find(n=>n.id==='fox'),x:0,z:-1}
  const player={x:0,z:0,yaw:0,speed:4}
  const r=applyRamming(player,[bot])
  assert.equal(r.event,null)
  assert.equal(r.npcs[0].health,bot.health)
  assert.equal(r.points,0)
})
test('high-speed direct crash hurts animal bot and is debounced',()=>{
  const bot={...makeNpcs('explore').find(n=>n.id==='fox'),x:0,z:-1}
  const player={x:0,z:0,yaw:0,speed:15}
  const hit=applyRamming(player,[bot])
  assert.ok(hit.event)
  assert.ok(hit.event.damage>=12)
  assert.ok(hit.npcs[0].health<bot.health)
  const again=applyRamming(player,hit.npcs)
  assert.equal(again.event,null)
})
test('destructible bot bursts and respawns after cooldown with restored health',()=>{
  const bot={...makeNpcs('race')[0],x:0,z:-1,health:22,stun:1}
  const player={x:0,z:0,yaw:0,speed:23}
  const r=applyRamming(player,[bot])
  assert.equal(r.event.kind,'npc-smash')
  assert.equal(r.racerKnockouts,1)
  assert.equal(r.points,100)
  assert.ok(r.npcs[0].respawn>0 && r.npcs[0].burst>0)
  let cars=r.npcs
  for(let i=0;i<230;i++)cars=advanceNpcs(cars,.05,player,'race')
  assert.equal(cars[0].health,cars[0].maxHp)
  assert.equal(cars[0].respawn,0)
})
test('opponent movement is frozen during hit-stun and death',()=>{
  const player={x:100,z:100}
  let bot={...makeNpcs('race')[0],stun:1}
  let changed=advanceNpcs([bot],.05,player,'race')[0]
  assert.equal(changed.travel,bot.travel)
  bot={...bot,respawn:5,health:0}
  changed=advanceNpcs([bot],.05,player,'race')[0]
  assert.equal(changed.travel,bot.travel)
})
test('no NaN or runaway coordinates after long open-world AI patrol',()=>{
  let n=makeNpcs('explore')
  for(let i=0;i<12000;i++)n=advanceNpcs(n,.05,{x:i%200-100,z:0},'explore')
  assert.ok(n.every(a=>Number.isFinite(a.x)&&Math.abs(a.x)<150&&Number.isFinite(a.z)&&Math.abs(a.z)<130))
})

test('overtaking and rear-ending a moving AI rival damages the kart',()=>{
  const rival={...makeNpcs('race')[0],x:0,z:-1.5,yaw:0,speed:19,stun:0}
  const driver={x:0,z:0,yaw:0,speed:23}
  const hit=applyRamming(driver,[rival])
  assert.equal(hit.event.kind,'npc-hit')
  assert.ok(hit.event.damage>=17)
  assert.ok(hit.npcs[0].health<rival.health)
})
