import test from 'node:test'
import assert from 'node:assert/strict'
import {playerProgress,rivalProgress,standings,positionOf,projectedTime,ordinal,RACE_DISTANCE,DIFFICULTY,safeDifficulty} from '../game/standings.js'
import {initialRaceState} from '../game/simulation.js'
import {trackPoint,FINISH_INDEX,CHECKPOINT_1_INDEX,CHECKPOINT_2_INDEX,LAPS_TO_WIN} from '../game/track.js'
import {makeNpcs,advanceNpcs,TRACK_LENGTH,RIVALS} from '../game/npcAI.js'

const at=(index,extra={})=>({...initialRaceState(),...trackPoint(index,0),...extra})

test('the grid sits just behind the line and progress grows round the lap',()=>{
  const start=playerProgress(initialRaceState())
  assert.ok(start<0&&start>-30,`grid progress ${start}`)
  const afterLine=playerProgress(at(FINISH_INDEX+3))
  const cp1=playerProgress(at(CHECKPOINT_1_INDEX+2,{checkpoint:1}))
  const cp2=playerProgress(at(CHECKPOINT_2_INDEX+2,{checkpoint:2}))
  assert.ok(start<afterLine&&afterLine<cp1&&cp1<cp2&&cp2<TRACK_LENGTH)
  // Approaching the line on lap 2 counts as most of lap 2, not the start of lap 1.
  const lap2End=playerProgress(at(FINISH_INDEX-2,{checkpoint:2,lap:2}))
  assert.ok(lap2End>TRACK_LENGTH*1.9&&lap2End<TRACK_LENGTH*2,`${lap2End}`)
})

test('rivals and the player share one distance scale',()=>{
  const grid=makeNpcs('race').map(rivalProgress)
  for(const p of grid)assert.ok(p<0&&p>-30,`rival grid progress ${p}`)
  const player=playerProgress(initialRaceState())
  // The player starts in the back row: behind the front row, level with the back row.
  assert.ok(grid.filter(p=>p>player+1).length>=3)
})

test('standings rank finishers by time, then by distance',()=>{
  const order=standings([{id:'a',progress:10},{id:'b',progress:RACE_DISTANCE,finishTime:90},{id:'player',progress:50},{id:'c',progress:RACE_DISTANCE,finishTime:80}])
  assert.deepEqual(order.map(e=>e.id),['c','b','player','a'])
  assert.equal(positionOf(order),3)
  assert.equal(projectedTime({progress:RACE_DISTANCE-170,pace:17},100),110)
  assert.equal(projectedTime({finishTime:95,progress:RACE_DISTANCE},100),95)
})

test('ordinals and difficulty presets',()=>{
  assert.deepEqual([1,2,3,4,8,11,12,13,21].map(ordinal),['1ST','2ND','3RD','4TH','8TH','11TH','12TH','13TH','21ST'])
  assert.equal(safeDifficulty('bogus'),'normal')
  assert.ok(DIFFICULTY.easy.pace<DIFFICULTY.normal.pace&&DIFFICULTY.normal.pace<DIFFICULTY.hard.pace)
  const easy=makeNpcs('race',DIFFICULTY.easy.pace),hard=makeNpcs('race',DIFFICULTY.hard.pace)
  easy.forEach((n,i)=>assert.ok(n.speed<hard[i].speed))
  // Patrolling open-world rivals keep their usual pace.
  assert.deepEqual(makeNpcs('explore',.5).filter(n=>n.kind==='racer').map(n=>n.speed),RIVALS.filter(r=>r.patrol!=null).map(r=>r.speed))
})

test('a rival race reaches the full distance in a plausible time',()=>{
  let npcs=makeNpcs('race'),t=0
  const player={x:1e4,z:1e4,yaw:0,speed:0}
  while(npcs.some(n=>rivalProgress(n)<RACE_DISTANCE)&&t<400){npcs=advanceNpcs(npcs,.05,player,'race');t+=.05}
  assert.ok(t>40&&t<80,`all rivals finished ${LAPS_TO_WIN} laps in ${t.toFixed(1)}s`)
})

import {loadBest,recordResult,isBetter} from '../game/records.js'
function memory(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}}
test('personal bests prefer a better place, then a faster time',()=>{
  const store=memory()
  assert.equal(loadBest(store),null)
  let r=recordResult({position:4,time:80,bestLap:25,difficulty:'normal'},store)
  assert.ok(r.improved);assert.match(r.message,/FIRST/)
  r=recordResult({position:5,time:60,bestLap:22,difficulty:'normal'},store)
  assert.ok(!r.improved);assert.equal(r.best.position,4);assert.equal(r.best.bestLap,22,'the fastest lap is kept either way')
  r=recordResult({position:2,time:90,bestLap:30,difficulty:'hard'},store)
  assert.ok(r.improved);assert.match(r.message,/WAS 4TH/)
  assert.deepEqual({...loadBest(store)},{position:2,time:90,difficulty:'hard',bestLap:22,races:3,wins:0})
  assert.ok(isBetter({position:2,time:80},{position:2,time:90}))
  assert.equal(loadBest({getItem:()=>'{broken'}),null)
  assert.doesNotThrow(()=>recordResult({position:1,time:1},{getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}}))
})

import {finalStandings} from '../game/standings.js'
test('final standings mix real and projected finish times',()=>{
  let npcs=makeNpcs('race'),t=0
  const player={x:1e4,z:1e4,yaw:0,speed:0},finished={}
  while(t<52){npcs=advanceNpcs(npcs,.05,player,'race');t+=.05;for(const n of npcs)if(finished[n.id]==null&&rivalProgress(n)>=RACE_DISTANCE)finished[n.id]=t}
  const table=finalStandings(54,npcs,finished)
  assert.equal(table.length,RIVALS.length+1)
  assert.deepEqual(table.map(r=>r.time),[...table.map(r=>r.time)].sort((a,b)=>a-b))
  const me=table.find(r=>r.player)
  assert.equal(me.time,54);assert.equal(me.name,'YOU');assert.equal(me.projected,false)
  for(const r of table.filter(r=>!r.player))assert.equal(r.projected,finished[r.id]==null)
  assert.ok(table.some(r=>!r.projected&&!r.player),'some rivals beat 52 s')
})
