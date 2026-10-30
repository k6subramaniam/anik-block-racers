import test from 'node:test'
import assert from 'node:assert/strict'
import {initialBattle,stepBattle} from '../battle/rules.js'
import {ITEM_BOXES,ITEM_KINDS,ITEM_RULES,rollItem,rocketTarget} from '../battle/items.js'
import {initialRaceState} from '../game/simulation.js'
import {makeNpcs} from '../game/npcAI.js'
import {nearestRoad,trackPoint,ROAD_WIDTH,LANE_OFFSETS} from '../game/track.js'

const empty=()=>({...initialBattle(),shield:0,hazards:[],supplies:[]})
const at=(index,lane=0,extra={})=>({...initialRaceState(),...trackPoint(index,lane),speed:15,...extra})
const tick=(s,p,bots=[],actions={},options={})=>stepBattle(s,p,bots,.05,actions,{ai:false,...options})
const rival=(id,index,lane,extra={})=>({...makeNpcs('race').find(n=>n.id===id),...trackPoint(index,lane),stun:0,respawn:0,blastShield:0,...extra})

test('three rows of item boxes span all four lanes on the road',()=>{
 assert.equal(ITEM_BOXES.length,12)
 for(const box of ITEM_BOXES)assert.ok(nearestRoad(box).distance<ROAD_WIDTH/2-1)
 assert.equal(new Set(ITEM_BOXES.map(b=>Math.round(nearestRoad(b).distance*10))).size,2,'boxes sit on the 1.8 m and 5.4 m lane lines')
})
test('item rolls are deterministic and every power-up can appear',()=>{
 assert.equal(rollItem(42),rollItem(42))
 const seen=new Set(Array.from({length:40},(_,i)=>rollItem(i)))
 assert.deepEqual([...seen].sort(),[...ITEM_KINDS].sort())
})
test('driving through a box grants one item; the box regrows and holding blocks a second pickup',()=>{
 const box=ITEM_BOXES[1],before={...initialRaceState(),...trackPoint(17,LANE_OFFSETS[1])},after={...before,...trackPoint(19,LANE_OFFSETS[1])}
 let r=stepBattle(empty(),after,[],.05,{},{ai:false,previousPlayer:before})
 assert.ok(ITEM_KINDS.includes(r.battle.item));assert.ok(r.battle.events.some(e=>e.kind==='item-pickup'))
 const taken=r.battle.itemBoxes.filter(b=>b.cooldown>0)
 assert.equal(taken.length,1);assert.equal(taken[0].id,box.id)
 const held=r.battle.item
 r=stepBattle(r.battle,after,[],.05,{},{ai:false,previousPlayer:before})
 assert.equal(r.battle.item,held)
})
test('turbo is used once per press and gives a speed boost',()=>{
 const p=at(40,0,{speed:10})
 let r=tick({...empty(),item:'turbo'},p,[],{item:1})
 assert.equal(r.battle.item,null);assert.ok(r.player.boostTimer>=ITEM_RULES.turbo-.01);assert.ok(r.player.speed>=26)
 r=tick({...r.battle,item:'turbo'},r.player,[],{item:1})
 assert.equal(r.battle.item,'turbo','the same press is not consumed twice')
})
test('a rocket homes in on the rival ahead and damages it',()=>{
 const p=at(40,LANE_OFFSETS[1]),target=rival('nova',50,LANE_OFFSETS[3])
 let r=tick({...empty(),item:'rocket'},p,[target],{item:1})
 assert.ok(r.battle.hazards.some(h=>h.kind==='rocket'&&h.target==='nova'))
 let bots=r.bots
 for(let i=0;i<40&&bots[0].health===target.health;i++){r=tick(r.battle,p,bots,{item:1});bots=r.bots}
 assert.ok(bots[0].health<target.health,'rocket hit');assert.equal(r.battle.health,100,'the shooter is outside the blast')
})
test('rockets never lock on to karts behind or too close',()=>{
 const shooter={id:'player',...trackPoint(60,0)}
 assert.equal(rocketTarget(shooter,[{id:'behind',...trackPoint(55,0)}]),null)
 assert.equal(rocketTarget(shooter,[{id:'touching',...trackPoint(61,0)}]),null)
 assert.equal(rocketTarget(shooter,[{id:'ahead',...trackPoint(66,0)}])?.id,'ahead')
})
test('oil slicks spin out rivals and the player, and a shield protects',()=>{
 const p=at(40,0)
 let r=tick({...empty(),item:'oil'},p,[],{item:1})
 const oil=r.battle.hazards.find(h=>h.kind==='oil');assert.ok(oil)
 let s={...r.battle,hazards:r.battle.hazards.map(h=>({...h,arm:0}))}
 const target=rival('bolt',40,0,{x:oil.x+1,z:oil.z}),old={...target,x:oil.x-1,z:oil.z}
 r=stepBattle(s,p,[target],.05,{item:1},{ai:false,previousBots:[old]})
 assert.ok(r.bots[0].stun>1,'rival spins');assert.ok(r.battle.events.some(e=>e.kind==='rival-spin'))
 const through={...p,x:oil.x+1,z:oil.z,speed:20},from={...p,x:oil.x-1,z:oil.z}
 r=stepBattle(s,through,[],.05,{item:1},{ai:false,previousPlayer:from})
 assert.ok(r.battle.stun>=1);assert.ok(r.player.speed<20)
 r=stepBattle({...s,shield:5},through,[],.05,{item:1},{ai:false,previousPlayer:from})
 assert.equal(r.battle.stun,0,'shield blocks the slick')
})
test('rivals collect boxes and fire rockets at a player ahead of them',()=>{
 const p=at(52,LANE_OFFSETS[2]),bot=rival('volt',40,LANE_OFFSETS[2])
 const s={...empty(),time:20,botItems:{volt:{kind:'rocket',since:19}}}
 let r=stepBattle(s,p,[bot],.05,{},{ai:true})
 assert.ok(r.battle.hazards.some(h=>h.kind==='rocket'&&h.owner==='volt'&&h.target==='player'))
 assert.ok(r.battle.events.some(e=>e.kind==='rival-rocket'))
 let damaged=false
 for(let i=0;i<40&&!damaged;i++){r=stepBattle(r.battle,p,r.bots,.05,{},{ai:false});damaged=r.battle.health<100}
 assert.ok(damaged,'the rival rocket hits the player')
})
