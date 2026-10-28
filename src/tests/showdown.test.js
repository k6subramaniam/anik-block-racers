import test from 'node:test'
import assert from 'node:assert/strict'
import {dailyChallenge,validChallenge,challengeFromSearch,makeChallengeUrl,newChallenge,hashSeed,makeArena,initialShowdown,stepShowdown,resultFor,ROUND_TICKS,BOUNDS,rampSample,showdownWeather,segmentDistance} from '../showdown/rules.js'
import {createReplay,recordReplay,bestMoment,sampleReplay,MAX_FRAMES} from '../showdown/replay.js'
import {localScores,saveResult,validResult,trackEvent,localStats,setStatsConsent,clearScores,SCORE_KEY} from '../showdown/storage.js'
const code='sd1-d20261028'
function run(input={forward:true},id=code){let state=initialShowdown(id);const arena=makeArena(id);for(let i=0;i<3600;i++)state=stepShowdown(state,input,arena);return state}
function memory(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
function hitFixture(speed=20){
 const s=initialShowdown(code);s.player={...s.player,speed};s.bots=s.bots.map((n,i)=>i?{...n,respawn:90}:{...n,homeX:0,homeZ:31.6,x:0,z:31.6,orbit:0,hitCooldown:0});return s
}
test('daily challenge uses UTC, not the player timezone',()=>{
 assert.equal(dailyChallenge('2026-10-27T23:30:00-04:00'),'sd2-d20261028')
 assert.equal(dailyChallenge('2026-10-28T23:59:59Z'),'sd2-d20261028')
 assert.equal(dailyChallenge('2026-10-29T00:00:00Z'),'sd2-d20261029')
})
test('challenge parser rejects invalid dates, versions and oversized input',()=>{
 for(const v of ['sd1-d20260230','sd1-d20261301','sd3-d20261028','<script>alert(1)</script>','sd1-cabcdefg0','x'.repeat(100)])assert.equal(validChallenge(v),false)
 assert.ok(validChallenge('sd1-d20240229'));assert.ok(validChallenge(newChallenge(22)))
})
test('friend links validate scores and preserve zero-score challenges',()=>{
 assert.equal(challengeFromSearch(`?challenge=${code}&score=0`).target,0)
 for(const score of ['-1','NaN','2e4','2000001','12.5','<b>'])assert.equal(challengeFromSearch(`?challenge=${code}&score=${score}`).target,null)
 const parsed=challengeFromSearch('?challenge=oops&score=100',code)
 assert.equal(parsed.code,code);assert.equal(parsed.invalid,true);assert.equal(parsed.target,null)
})
test('share links remove stale query parameters and preserve Pages base path',()=>{
 const url=makeChallengeUrl('https://example.github.io/anik-block-racers/?view=world#private',code,1234)
 assert.equal(url,`https://example.github.io/anik-block-racers/?challenge=${code}&score=1234`)
 assert.throws(()=>makeChallengeUrl('javascript:alert(1)',code,100));assert.throws(()=>makeChallengeUrl('https://example.org','bad',100))
})
test('same seed creates exactly the same arena, bot paths and weather',()=>{
 assert.deepEqual(makeArena(code),makeArena(code));assert.equal(hashSeed(code),hashSeed(code))
 assert.notDeepEqual(makeArena(code).bots,makeArena('sd1-d20261029').bots)
 assert.deepEqual(showdownWeather(makeArena(code),1200),showdownWeather(makeArena(code),1200))
})
test('arena has ten bounded uniquely named bots and three clear ramps',()=>{
 const a=makeArena(code);assert.equal(a.bots.length,10);assert.equal(a.ramps.length,3);assert.equal(new Set(a.bots.map(b=>b.id)).size,10)
 for(const b of a.bots){assert.ok(Math.abs(b.homeX)+b.orbit<BOUNDS.maxX);assert.ok(Math.abs(b.homeZ)+b.orbit<BOUNDS.maxZ)}
})
test('a full run ends at exactly 3600 fixed ticks and becomes immutable',()=>{
 const s=run();assert.equal(s.ticks,ROUND_TICKS);assert.ok(s.done);assert.strictEqual(stepShowdown(s,{forward:true}),s)
 assert.ok(s.smashes>=1);assert.ok(s.jumps>=1);assert.ok(s.score>0)
})
test('same inputs and seed reproduce the same score and final transforms',()=>{assert.deepEqual(run(),run())})
test('standing still cannot farm collision points',()=>{const s=run({});assert.equal(s.score,0);assert.equal(s.smashes,0)})
test('fast forward rams destroy a robot once and start a cube burst',()=>{
 const s=stepShowdown(hitFixture());assert.equal(s.smashes,1);assert.equal(s.bots[0].health,0);assert.ok(s.bots[0].burst>0);assert.ok(s.bots[0].respawn>0);assert.equal(stepShowdown(s).smashes,1)
})
test('slow and airborne contacts cannot award smash points',()=>{
 assert.equal(stepShowdown(hitFixture(1)).score,0)
 const s=hitFixture();s.player.y=4;s.player.grounded=false;s.player.vy=0;assert.equal(stepShowdown(s).score,0)
})
test('combo grows only through scored stunts and is capped at five',()=>{
 let s=hitFixture();s.combo=5;s.comboUntil=900;s.ticks=100
 const n=stepShowdown(s);assert.equal(n.combo,5);assert.equal(n.bestCombo,5);assert.equal(n.score,1000)
 const expired=hitFixture();expired.ticks=800;expired.combo=5;expired.comboUntil=300;assert.equal(stepShowdown(expired).combo,1)
})
test('ramp geometry and airborne physics produce real height and a landing score',()=>{
 let s=initialShowdown(code);const a=makeArena(code);let maxY=0,launch=false,land=false
 for(let i=0;i<330;i++){s=stepShowdown(s,{forward:true},a);maxY=Math.max(maxY,s.player.y);launch||=s.events.some(e=>e.kind==='jump');land||=s.events.some(e=>e.kind==='land')}
 assert.ok(maxY>4);assert.ok(launch&&land);assert.ok(s.player.y>=0)
 const r=a.ramps[0];assert.equal(rampSample(r,{x:0,z:r.z+r.length/2}).height,0);assert.equal(rampSample(r,{x:0,z:r.z-r.length/2}).height,r.height)
})
test('swept collision catches a target between two frame positions',()=>{
 assert.equal(segmentDistance({x:-10,z:0},{x:10,z:0},{x:0,z:0}).distance,0)
 assert.equal(segmentDistance({x:0,z:0},{x:0,z:0},{x:3,z:4}).distance,5)
})
test('randomized challenge driving remains finite and bounded',()=>{
 for(let seed=1;seed<=6;seed++){
  const id=newChallenge(seed),arena=makeArena(id);let s=initialShowdown(id)
  for(let i=0;i<3600;i++){
   s=stepShowdown(s,{forward:i%17!==0,left:(i+seed)%143<51,right:i%111>91,drift:i%271<60},arena)
   for(const v of [s.player.x,s.player.y,s.player.z,s.player.speed,s.score])assert.ok(Number.isFinite(v))
   assert.ok(Math.abs(s.player.x)<=arena.bounds.maxX&&Math.abs(s.player.z)<=arena.bounds.maxZ&&s.player.y>=0)
  }
 }
})
test('unfinished runs cannot become saved results',()=>{assert.throws(()=>resultFor(initialShowdown(code)));assert.ok(validResult(resultFor(run())))})
test('device leaderboard is persistent, seed-scoped and deduplicates run IDs',()=>{
 const storage=memory(),result=resultFor(run())
 assert.ok(saveResult(result,'one',storage).saved);assert.ok(saveResult(result,'one',storage).duplicate);saveResult({...result,score:result.score+5},'two',storage)
 assert.equal(localScores(code,storage).length,2);assert.equal(localScores(code,storage)[0].id,'two');assert.equal(localScores('sd1-d20261029',storage).length,0)
})
test('blocked or corrupt device storage is handled without crashing',()=>{
 const storage=memory();storage.setItem(SCORE_KEY,'{oops');assert.deepEqual(localScores(code,storage),[])
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}
 assert.deepEqual(localScores(code,blocked),[]);assert.equal(saveResult(resultFor(run()),'one',blocked).saved,false)
})
test('tampered stored scores are not blindly accepted',()=>{
 const storage=memory();storage.setItem(SCORE_KEY,JSON.stringify([{...resultFor(run()),score:Infinity,id:'bad'},{code,score:999999,id:'fake'}]))
 assert.deepEqual(localScores(code,storage),[]);assert.equal(saveResult({code,score:800},'fake',storage).saved,false)
})
test('score reset deletes only this game score key',()=>{const storage=memory();storage.setItem('other-app','safe');clearScores(storage);assert.equal(storage.getItem('other-app'),'safe')})
test('analytics are off by default and never record arbitrary URLs or names',()=>{
 const storage=memory();assert.equal(trackEvent('challenge_start',{code},storage),false);setStatsConsent(true,storage)
 assert.equal(trackEvent('challenge_start',{code,email:'private',url:'secret'},storage),true)
 const stats=localStats(storage);assert.equal(stats.scope,'this-device-only');assert.equal(stats.events.length,1)
 assert.equal('email' in stats.events[0],false);assert.equal('url' in stats.events[0],false);assert.equal(trackEvent('arbitrary-secret',{},storage),false)
})
test('turning analytics off clears the bounded local event log',()=>{
 const storage=memory();setStatsConsent(true,storage)
 for(let i=0;i<350;i++)trackEvent('challenge_start',{code},storage)
 assert.equal(localStats(storage).events.length,300);setStatsConsent(false,storage);assert.equal(localStats(storage).events.length,0)
})
test('replays store actual bounded movement and select a scored highlight',()=>{
 let s=initialShowdown(code);const a=makeArena(code),replay=createReplay();recordReplay(replay,s)
 for(let i=0;i<3600;i++){s=stepShowdown(s,{forward:true},a);recordReplay(replay,s)}
 assert.ok(replay.frames.length<=MAX_FRAMES);assert.equal(replay.frames.at(-1).tick,3600)
 assert.ok(replay.frames.some(f=>f.player.y>4));const range=bestMoment(replay)
 assert.ok(range.start>=0&&range.end<=3600&&range.end>range.start);assert.ok(range.points>0);assert.ok(sampleReplay(replay,range.start).bots.length===10)
})
test('replay interpolation takes the short path around angle wrap',()=>{
 const base={x:0,y:0,z:0,yaw:3.13},replay={frames:[{tick:0,player:base,bots:[]},{tick:5,player:{...base,x:10,yaw:-3.13},bots:[]}]}
 const sample=sampleReplay(replay,2.5);assert.equal(sample.player.x,5);assert.ok(Math.abs(sample.player.yaw)>3)
 assert.equal(sampleReplay({frames:[]},1),null);assert.equal(bestMoment({frames:[],moments:[]}),null)
})
