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
test('Higgsfield music loop ships with loop points inside the track',async()=>{
 const {MUSIC_FILE,MUSIC_LOOP}=await import('../game/sound.js'),{statSync}=await import('node:fs'),{join,resolve}=await import('node:path')
 const size=statSync(join(resolve(import.meta.dirname,'../..'),'public/audio',MUSIC_FILE)).size
 assert.ok(size>50000&&size<600000)
 assert.ok(MUSIC_LOOP.start>0&&MUSIC_LOOP.end>MUSIC_LOOP.start&&MUSIC_LOOP.end<12.8)
 // 120 BPM: the loop must be a whole number of 2-second bars so the groove does not stumble.
 assert.equal(((MUSIC_LOOP.end-MUSIC_LOOP.start)/2)%1,0)
})
