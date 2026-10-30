import test from 'node:test'
import assert from 'node:assert/strict'
import {sfxFor,engineParams,MUSIC_BARS,MUSIC_BPM,midiToHz} from '../game/sound.js'
import {MAX_SPEED} from '../game/simulation.js'
test('game events trigger matching sound effects and quiet events stay silent',()=>{
 assert.equal(sfxFor('coin'),'coin');assert.equal(sfxFor('boost'),'boost');assert.equal(sfxFor('wall'),'bump')
 assert.equal(sfxFor('npc-smash'),'smash');assert.equal(sfxFor('lap'),'fanfare');assert.equal(sfxFor('water-splash'),'splash')
 assert.equal(sfxFor('villager-chat'),null);assert.equal(sfxFor('unknown'),null)
})
test('engine pitch, brightness and volume rise with speed and turbo',()=>{
 const idle=engineParams(0),half=engineParams(MAX_SPEED/2),full=engineParams(MAX_SPEED),boost=engineParams(MAX_SPEED,true)
 assert.ok(idle.frequency<half.frequency&&half.frequency<full.frequency&&full.frequency<boost.frequency)
 assert.ok(idle.gain<full.gain&&full.cutoff<boost.cutoff)
 assert.deepEqual(engineParams(-MAX_SPEED),full);assert.deepEqual(engineParams(MAX_SPEED*3),full)
})
test('soundtrack bars are 16-step patterns with playable notes',()=>{
 assert.ok(MUSIC_BPM>=100&&MUSIC_BPM<=160);assert.ok(MUSIC_BARS.length>=4)
 for(const bar of MUSIC_BARS)for(const line of [bar.bass,bar.lead]){assert.equal(line.length,16);for(const n of line)if(n!=null)assert.ok(n>=36&&n<=96)}
 assert.equal(midiToHz(69),440);assert.ok(Math.abs(midiToHz(57)-220)<1e-9)
})
test('every radio station ships a Higgsfield loop that repeats on whole bars',async()=>{
 const {RADIO_STATIONS}=await import('../game/sound.js'),{statSync}=await import('node:fs'),{join,resolve}=await import('node:path')
 const files=RADIO_STATIONS.filter(s=>!s.synth)
 assert.ok(files.length>=5);assert.equal(new Set(RADIO_STATIONS.map(s=>s.id)).size,RADIO_STATIONS.length)
 for(const station of files){
  const size=statSync(join(resolve(import.meta.dirname,'../..'),'public/audio',station.file)).size
  assert.ok(size>50000&&size<600000,station.id)
  assert.ok(station.loop.start>0&&station.loop.end>station.loop.start&&station.loop.end<14,station.id)
  // The loop must be a whole number of 4-beat bars or the groove stumbles at the seam.
  const bars=(station.loop.end-station.loop.start)/(4*60/station.bpm)
  assert.ok(Math.abs(bars-Math.round(bars))<.02&&Math.round(bars)>=2,`${station.id} loops ${bars.toFixed(3)} bars`)
 }
 assert.ok(RADIO_STATIONS.some(s=>s.synth),'a synthesized station needs no download')
})
test('radio stations cycle in both directions and unknown ids fall back',async()=>{
 const {RADIO_STATIONS,DEFAULT_STATION,nextStation,stationById}=await import('../game/sound.js')
 let id=DEFAULT_STATION;const seen=[]
 for(let i=0;i<RADIO_STATIONS.length;i++){seen.push(id);id=nextStation(id)}
 assert.equal(id,DEFAULT_STATION);assert.equal(new Set(seen).size,RADIO_STATIONS.length)
 assert.equal(nextStation(DEFAULT_STATION,-1),RADIO_STATIONS[RADIO_STATIONS.length-1].id)
 assert.equal(stationById('nope').id,DEFAULT_STATION);assert.equal(nextStation('nope'),RADIO_STATIONS[1].id)
})
