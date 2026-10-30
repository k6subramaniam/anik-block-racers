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
