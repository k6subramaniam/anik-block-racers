import test from 'node:test'
import assert from 'node:assert/strict'
import {DEFAULT_GARAGE,garageModifiers,upgradeCost,readGarage,persistGarage,purchaseUpgrade,buyKart,sanitizeGarage,awardRace,KART_STYLES} from '../studio/garage.js'
import {createStuntWorld,advanceStunts} from '../studio/stunts.js'
import {newBlueprint,validateBlueprint,encodeBlueprint,decodeBlueprint,makeShareUrl,blueprintSpec,saveBlueprint,readBlueprints,editPoint} from '../studio/builder.js'
import {createRaceReplay,recordRaceReplay,replayRange,sampleRaceReplay,MAX_REPLAY_FRAMES} from '../studio/replay.js'
import {sanitizeInput,encodeSignal,decodeSignal,validRacePacket} from '../studio/p2p.js'
import {readTimes,recordTime,topTimes} from '../studio/leaderboards.js'
import {battleTrack,registerBuiltTrack} from '../battle/tracks.js'
import {createBattle,stepBattle,integrateActor,damageBlast} from '../battle/simulation.js'
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
test('new garage starts free and rejects corrupt persisted state',()=>{
 const s=storage();assert.equal(readGarage(s).credits,0);assert.equal(garageModifiers(null).maxHp,100)
 s.setItem('anik-racers-garage-v4','{"version":999,"credits":9999999}');assert.equal(readGarage(s).credits,0)
})
test('garage credits are capped, and upgrades cost money once',()=>{
 let g={...sanitizeGarage(null),credits:300};const u=purchaseUpgrade(g,'engine')
 assert.ok(u.ok);assert.equal(u.garage.credits,230);assert.equal(u.garage.upgrades.engine,1)
 const again=purchaseUpgrade(u.garage,'engine');assert.ok(again.ok);assert.equal(again.garage.credits,75)
 assert.ok(!purchaseUpgrade(again.garage,'engine').ok);assert.equal(upgradeCost('engine',3),null)
})
test('garage kart buying, selection, and ownership persist',()=>{
 const s=storage(),g={...sanitizeGarage(null),credits:1000};const out=buyKart(g,'nebula')
 assert.ok(out.ok);assert.equal(out.garage.selected,'nebula');assert.equal(out.garage.credits,600)
 assert.ok(persistGarage(out.garage,s));assert.equal(readGarage(s).selected,'nebula')
 assert.equal(buyKart(out.garage,'nebula').garage.credits,600)
 assert.equal(KART_STYLES.length,5)
})
test('upgrades influence race physics and health but not multiplayer fairness',()=>{
 const g={...sanitizeGarage(null),upgrades:{engine:3,grip:3,armor:3,turbo:3}}
 const normal=createBattle('blast',{garage:g}),fair=createBattle('blast',{garage:g,multiplayer:true})
 assert.ok(normal.actors[0].topSpeed>fair.actors[0].topSpeed)
 assert.equal(normal.actors[0].hp,145);assert.equal(fair.actors[0].hp,100)
 assert.ok(normal.actors[0].turboFactor>1)
})
test('race rewards are one-time per run and never awarded to untrusted string IDs twice',()=>{
 const a=awardRace(null,'run-1',1,3,900),b=awardRace(a.garage,'run-1',1,3,900)
 assert.ok(a.earned>0);assert.equal(b.earned,0);assert.equal(b.garage.races,1)
})
test('stunt world contains bounded unique pads and destructible blocks',()=>{
 const w=createStuntWorld('skybridge');assert.equal(w.pads.length,4);assert.equal(w.props.length,12)
 assert.equal(new Set(w.props.map(x=>x.id)).size,12);assert.ok(w.pads.some(x=>x.y>4))
})
test('car hits a breakable block and earns score and shards once',()=>{
 let s=createBattle(),p=s.stunts.props[0],old=structuredClone(s)
 s.actors[0]={...s.actors[0],x:p.x,z:p.z,y:p.y,speed:19};old.actors[0]={...s.actors[0],x:p.x,z:p.z+2}
 s.tick=420;advanceStunts(s,old,1/60)
 assert.ok(s.actors[0].stuntScore>0);assert.equal(s.stunts.props[0].cooldown>10,true)
 assert.ok(s.stunts.bursts.length>0)
})
test('jump pad generates real airborne height and a scored landing',()=>{
 let s=createBattle(),pad=s.stunts.pads[0],a=s.actors[0]
 s.actors[0]={...a,x:pad.x,z:pad.z,y:pad.y,speed:18};let old=structuredClone(s)
 old.actors[0].z+=3;s.tick=10;advanceStunts(s,old,1/60)
 assert.ok(s.actors[0].air.vy>0)
 let height=0,land=false
 for(let i=0;i<150;i++){old=structuredClone(s);s.tick++;advanceStunts(s,old,1/60);height=Math.max(height,s.actors[0].air.lift);land||=s.events.some(e=>e.kind==='stunt-land')}
 assert.ok(height>2);assert.ok(land)
})
test('block scores increase combo but cap the multiplier at five',()=>{
 let s=createBattle(),p=s.stunts.props[0],a=s.actors[0];s.tick=500;s.actors[0]={...a,x:p.x,z:p.z,y:p.y,speed:23,stuntCombo:5,lastStuntTick:499}
 let old=structuredClone(s);old.actors[0].z+=2;advanceStunts(s,old,1/60)
 assert.equal(s.actors[0].stuntCombo,5)
})
test('builder creates a valid share code and preserves elevation',()=>{
 const b=newBlueprint();b.name='MY HIGH ROAD';b.points[3][2]=24
 const code=encodeBlueprint(b),parsed=decodeBlueprint(code)
 assert.deepEqual(parsed,validateBlueprint(b));assert.equal(parsed.points[3][2],24)
 assert.match(makeShareUrl('https://example.github.io/anik-block-racers/?view=world',b),/trackcode=vc1_/)
})
test('builder rejects hostile or invalid tracks and limits code size',()=>{
 const b=newBlueprint();assert.equal(decodeBlueprint('javascript:alert(1)'),null)
 assert.equal(decodeBlueprint('vc1_'+'A'.repeat(5000)),null)
 assert.equal(validateBlueprint({...b,points:b.points.slice(0,3)}),null)
 assert.equal(validateBlueprint({...b,points:b.points.map(()=>[0,0,0])}),null)
 assert.equal(validateBlueprint({...b,name:'<img src=x onerror=alert(1)>'}).name.includes('<'),false)
})
test('custom track registry generates real 3D road geometry and checkpoints',()=>{
 const b=newBlueprint();b.points[3][2]=20;registerBuiltTrack(blueprintSpec(b))
 const t=battleTrack('custom');assert.equal(t.id,'custom');assert.ok(t.maxHeight>=19)
 assert.equal(t.gates.length,8);assert.ok(t.length>300)
 const race=createBattle('custom',{laps:2});assert.equal(race.trackId,'custom');assert.equal(race.laps,2)
})
test('builder drag and height editing are bounded, and saves are local',()=>{
 const b=newBlueprint(),s=storage(),edited=editPoint(b,0,{'0':999,'2':20})
 assert.equal(edited.points[0][0],140);assert.equal(edited.points[0][2],20)
 assert.ok(saveBlueprint(b,s));assert.equal(readBlueprints(s).length,1)
})
test('peer control sanitizer allows only driving inputs',()=>{
 assert.deepEqual(sanitizeInput({forward:true,left:1,bomb:true,private:'secret'}),{forward:true,backward:false,left:false,right:false,drift:false,bomb:true,mine:false,item:false})
})
test('peer SDP messages are versioned and reject wrong roles',()=>{
 const offer=encodeSignal({type:'offer',sdp:'v=0\r\no=- 123 1 IN IP4 0.0.0.0'})
 assert.equal(decodeSignal(offer,'offer').type,'offer');assert.throws(()=>decodeSignal(offer,'answer'))
 assert.equal(validRacePacket({v:1,type:'input',input:{forward:true}}),true)
 assert.equal(validRacePacket({v:1,type:'state',tick:4,state:{actors:[{},{}]}}),false)
})
test('local race board is isolated, time-sorted and rejects invalid runs',()=>{
 const s=storage(),first={id:'a',track:'blast',laps:3,ticks:12000,weather:'dynamic',stunts:0}
 assert.ok(recordTime(first,s));assert.ok(recordTime({...first,id:'b',ticks:11000},s))
 assert.equal(topTimes('blast',3,'dynamic',s)[0].id,'b');assert.equal(readTimes(s).length,2)
 assert.equal(recordTime({...first,ticks:-5},s),false)
})
test('actual run replay is bounded and samples real racer coordinates',()=>{
 const s=createBattle(),r=createRaceReplay();let game=s
 for(let i=0;i<1300;i++){game=stepBattle(game,{forward:true});recordRaceReplay(r,game)}
 assert.ok(r.frames.length<=MAX_REPLAY_FRAMES);assert.ok(replayRange(r))
 const sample=sampleRaceReplay(r,r.frames[0].tick);assert.equal(sample.actors.length,4)
})
