import test from 'node:test'
import assert from 'node:assert/strict'
import {createBattle,stepBattle,aiInput} from '../battle/simulation.js'
import {BATTLE_TRACKS,battleTrack,atDistance,nearestOnTrack} from '../battle/tracks.js'
import {CIRCUIT_ITEM_RULES,circuitRocketTarget,aiWantsItem} from '../battle/circuitItems.js'
import {ITEM_KINDS} from '../battle/itemKinds.js'

// Put a kart at distance s along the circuit, facing the race direction.
const place=(actor,track,s,lane=0,extra={})=>{const p=atDistance(track,s,lane);return {...actor,x:p.x,y:p.y,z:p.z,yaw:p.yaw,s,speed:12,stun:0,shield:0,respawn:0,...extra}}
const calm=(id='blast')=>{const s=createBattle(id);return {...s,hazards:[]}}

test('every circuit has four rows of four item boxes on the road surface',()=>{
 for(const spec of BATTLE_TRACKS){
  const track=battleTrack(spec.id),s=createBattle(spec.id)
  assert.equal(s.itemBoxes.length,16,spec.id)
  for(const b of s.itemBoxes){const n=nearestOnTrack(track,b);assert.ok(n.distance<track.width/2-1,spec.id);assert.ok(Math.abs(n.y-b.y)<.5,`${spec.id} box sits on its deck`)}
  assert.ok(Math.min(...s.itemBoxes.map(b=>b.s))<=45,'first row comes soon after the start')
 }
})
test('the player collects a box and uses it once per press; a rival pickup leaves the box',()=>{
 const track=battleTrack('blast'),box=createBattle().itemBoxes[1]
 let s=calm();s.actors=s.actors.map((a,i)=>i===0?place(a,track,box.s-1.5,0):place(a,track,box.s+60+i*6,0))
 s.actors[0]={...s.actors[0],x:box.x-Math.sin(s.actors[0].yaw)*-1.5,z:box.z-Math.cos(s.actors[0].yaw)*-1.5,y:box.y}
 for(let i=0;i<10&&!s.actors[0].item;i++)s=stepBattle(s,{forward:true})
 assert.ok(ITEM_KINDS.includes(s.actors[0].item),'player holds an item');assert.ok(s.itemBoxes.find(b=>b.id===box.id).cooldown>0)
 const held=s.actors[0].item
 s=stepBattle(s,{forward:true,item:true});assert.equal(s.actors[0].item,null)
 assert.ok(s.events.some(e=>e.actor==='player'&&['item-turbo','item-shield','rocket-launch','oil-dropped'].includes(e.kind)),held)
 // AI: a rival driving through a fresh box gets an item but the box stays for the player.
 let r=calm();const b2=r.itemBoxes[5]
 r.actors=r.actors.map((a,i)=>i===1?place(a,track,b2.s-1.5,0,{x:b2.x+Math.sin(place(a,track,b2.s,0).yaw)*1.5,z:b2.z+Math.cos(place(a,track,b2.s,0).yaw)*1.5,y:b2.y}):place(a,track,b2.s+80+i*6,0))
 for(let i=0;i<10&&!r.actors[1].item;i++)r=stepBattle(r,{})
 assert.ok(r.actors[1].item,'rival collected');assert.equal(r.itemBoxes.find(b=>b.id===b2.id).cooldown,0,'box still there')
})
test('a rocket homes onto the kart ahead and damages it; a shield blocks it',()=>{
 const track=battleTrack('blast')
 let s=calm();s.actors=s.actors.map((a,i)=>i===0?place(a,track,60,0,{item:'rocket'}):i===1?place(a,track,80,0):place(a,track,200+i*10,0))
 assert.equal(circuitRocketTarget(s.actors[0],s.actors)?.id,s.actors[1].id)
 const hp=s.actors[1].hp
 s=stepBattle(s,{item:true});assert.ok(s.hazards.some(h=>h.type==='rocket'&&h.owner==='player'))
 for(let i=0;i<60&&s.actors[1].hp===hp;i++)s=stepBattle(s,{})
 assert.ok(s.actors[1].hp<hp,'rival hit');assert.equal(s.actors[0].damageTaken,0,'shooter safe')
 let g=calm();g.actors=g.actors.map((a,i)=>i===0?place(a,track,60,0,{item:'rocket'}):i===1?place(a,track,80,0,{shield:9}):place(a,track,200+i*10,0))
 g=stepBattle(g,{item:true});for(let i=0;i<60;i++)g=stepBattle(g,{})
 assert.equal(g.actors[1].damageTaken,0,'shield blocks the rocket')
})
test('oil spins out a kart that drives over it, and rockets never target karts behind or too close',()=>{
 const track=battleTrack('blast')
 let s=calm();s.actors=s.actors.map((a,i)=>i===0?place(a,track,100,0,{item:'oil'}):i===1?place(a,track,92,0,{speed:20}):place(a,track,250+i*10,0))
 s=stepBattle(s,{item:true});const oil=s.hazards.find(h=>h.type==='oil');assert.ok(oil)
 for(let i=0;i<90&&!s.events.some(e=>e.kind==='oil-spin');i++)s=stepBattle(s,{forward:true})
 assert.ok(s.actors[1].stun>0||s.events.some(e=>e.kind==='oil-spin'),'rival spun out')
 const shooter=place(createBattle().actors[0],track,100,0)
 assert.equal(circuitRocketTarget(shooter,[place(createBattle().actors[1],track,90,0)]),null,'behind')
 assert.equal(circuitRocketTarget(shooter,[place(createBattle().actors[1],track,103,0)]),null,'too close')
})
test('rivals hold items while the grid is bunched, then use them; one kart cannot sweep a row',()=>{
 const track=battleTrack('blast'),s=createBattle()
 const bot=place(s.actors[1],track,100,0,{item:'turbo',itemSince:0})
 assert.equal(aiWantsItem(bot,{...s,tick:60*3}),false)
 assert.equal(aiWantsItem(bot,{...s,tick:60*(CIRCUIT_ITEM_RULES.aiGrace+1)}),true)
 // Drive the AI through the first row: it collects at most one item there.
 let r=calm(),pickups=0;r.actors=r.actors.map((a,i)=>i===1?place(a,track,30,0,{speed:20}):place(a,track,300+i*10,0))
 for(let i=0;i<120;i++){r=stepBattle(r,{});pickups+=r.events.filter(e=>e.kind==='item-pickup'&&e.actor===r.actors[1].id).length}
 assert.ok(pickups<=1,`picked ${pickups} items from one row`)
})
test('full AI races with items still finish on every circuit',()=>{
 for(const spec of BATTLE_TRACKS){
  let s=createBattle(spec.id),t=battleTrack(spec.id),items=0
  for(let i=0;i<14000&&!s.done;i++){s=stepBattle(s,aiInput(s.actors[0],t,s));items+=s.events.filter(e=>e.kind==='item-pickup').length}
  assert.ok(s.done,spec.id);assert.ok(items>4,`${spec.id}: items collected`)
  assert.ok(s.hazards.length<=40,'hazard pool bounded')
 }
})
