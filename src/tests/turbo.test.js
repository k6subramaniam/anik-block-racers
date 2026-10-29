import test from 'node:test'
import assert from 'node:assert/strict'
import {createBattle,stepBattle,integrateActor} from '../battle/simulation.js'
import {battleTrack} from '../battle/tracks.js'
import {createPowerups,advancePowerups,activateTurbo,TURBO_TOP_SPEED,AUTO_BURST_INTERVAL,POWERUP_RESPAWN} from '../battle/powerups.js'

test('eight collectible turbo crystals exist on every race level',()=>{
 for(const id of ['blast','canyon','frost','skybridge','summit']){
  const t=battleTrack(id),items=createPowerups(id)
  assert.equal(items.length,8);assert.equal(new Set(items.map(x=>x.id)).size,8)
  assert.ok(items.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)))
  assert.ok(t.length>0)
 }
})
test('turbo pickup grants a timed speed boost and cannot repeat during cooldown',()=>{
 const s=createBattle('blast');const p=s.powerups[0]
 s.actors[0]={...s.actors[0],x:p.x,y:p.y,z:p.z,shield:0}
 const old=structuredClone(s.actors)
 advancePowerups(s,old,1/60)
 assert.ok(s.actors[0].turbo>2.7);assert.equal(s.actors[0].turboCount,1)
 assert.ok(s.powerups[0].cooldown>14);assert.equal(s.events[0].kind,'turbo-pickup')
 advancePowerups(s,old,1/60);assert.equal(s.actors[0].turboCount,1)
})
test('turbo physics permits 43 m/s instead of the normal 27 m/s cap',()=>{
 const t=battleTrack('blast'),initial=createBattle('blast').actors[0]
 let car=activateTurbo({...initial,speed:28})
 for(let i=0;i<50;i++)car=integrateActor(car,{forward:true},t,1/60,{grip:1,braking:1,windX:0,windZ:0})
 assert.ok(car.speed>27);assert.ok(car.speed<=TURBO_TOP_SPEED)
})
test('bonus speed bursts periodically affect eligible player and AI racers',()=>{
 const s=createBattle('blast');s.tick=AUTO_BURST_INTERVAL
 advancePowerups(s,structuredClone(s.actors),1/60)
 assert.ok(s.actors.every(a=>a.turbo>1.7))
 assert.equal(s.events.filter(e=>e.kind==='turbo-bonus').length,4)
})
test('powerups and timed turbo stay deterministic in fixed-step racing',()=>{
 let a=createBattle('frost'),b=createBattle('frost')
 for(let i=0;i<500;i++){a=stepBattle(a,{forward:true});b=stepBattle(b,{forward:true})}
 assert.deepEqual(a,b)
})
