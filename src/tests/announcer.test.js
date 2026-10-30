import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,statSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {ANNOUNCER_CLIPS,COUNTDOWN_CLIPS,announcerClipFor,shouldPlay} from '../game/announcer.js'
import {LAPS_TO_WIN} from '../game/track.js'
const projectRoot=resolve(import.meta.dirname,'../..')
test('every Higgsfield announcer clip ships as a real MP3 in public/audio',()=>{
 for(const file of Object.values(ANNOUNCER_CLIPS)){const path=join(projectRoot,'public/audio',file);assert.ok(existsSync(path),file);assert.ok(statSync(path).size>2000,file)}
 for(const clip of COUNTDOWN_CLIPS)assert.ok(ANNOUNCER_CLIPS[clip])
})
test('race events map to announcer lines, with a final lap call',()=>{
 assert.equal(announcerClipFor('checkpoint-1'),'checkpoint');assert.equal(announcerClipFor('checkpoint-2'),'checkpoint')
 assert.equal(announcerClipFor('lap',{lap:2}),'lap');assert.equal(announcerClipFor('lap',{lap:LAPS_TO_WIN}),'final-lap')
 assert.equal(announcerClipFor('finished'),'finish');assert.equal(announcerClipFor('boost'),'turbo');assert.equal(announcerClipFor('npc-smash'),'smash')
 assert.equal(announcerClipFor('coin'),null);assert.equal(announcerClipFor('wall'),null)
})
test('frequent announcer lines are rate limited',()=>{
 assert.equal(shouldPlay('turbo',1000,{}),true);assert.equal(shouldPlay('turbo',3000,{turbo:1000}),false);assert.equal(shouldPlay('turbo',8000,{turbo:1000}),true)
 assert.equal(shouldPlay('lap',1001,{lap:1000}),true);assert.equal(shouldPlay('nope',0,{}),false);assert.equal(shouldPlay(null,0,{}),false)
})
