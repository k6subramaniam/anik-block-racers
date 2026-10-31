import test from 'node:test'
import assert from 'node:assert/strict'
import {RIVAL_CHATTER,CHATTER_RULES,initialChatter,pickChatter,chatterFile} from '../game/chatter.js'
import {RIVALS} from '../game/npcAI.js'

test('every rival driver has a distinct voice with close-pass and bump lines',()=>{
 for(const r of RIVALS)assert.ok(RIVAL_CHATTER[r.id],r.id)
 const voices=Object.values(RIVAL_CHATTER).map(c=>c.voice)
 assert.equal(new Set(voices).size,voices.length,'no two rivals share a voice')
 for(const c of Object.values(RIVAL_CHATTER)){assert.ok(c.near.length>=2&&c.bump.length>=2)}
})
test('a bump speaks at once; a close pass waits its turn; nobody repeats too soon',()=>{
 let s=initialChatter()
 let r=pickChatter(s,10,{bumps:['bolt'],near:[{id:'nova',distance:3}]})
 assert.equal(r.line.id,'bolt');assert.equal(r.line.kind,'bump');assert.equal(r.line.file,chatterFile('bolt','bump',0));s=r.state
 r=pickChatter(s,11,{near:[{id:'nova',distance:3}]});assert.equal(r.line,null,'global gap after any line')
 r=pickChatter(s,10+CHATTER_RULES.gap,{near:[{id:'nova',distance:3},{id:'pixel',distance:8}]})
 assert.equal(r.line.id,'nova');assert.equal(r.line.kind,'near');s=r.state
 r=pickChatter(s,30,{near:[{id:'nova',distance:3}]});assert.equal(r.line.id,'nova')
 assert.equal(r.line.n,1,'lines alternate')
 r=pickChatter(r.state,31,{near:[{id:'nova',distance:3}]});assert.equal(r.line,null)
 assert.equal(pickChatter(initialChatter(),0,{near:[{id:'nova',distance:CHATTER_RULES.nearDistance+1}]}).line,null,'too far away')
 assert.equal(pickChatter(initialChatter(),0,{bumps:['unknown']}).line,null)
})
test('every chatter line ships as a short Higgsfield voice clip',async()=>{
 const {statSync}=await import('node:fs'),{join,resolve}=await import('node:path')
 const root=resolve(import.meta.dirname,'../..')
 for(const [id,c] of Object.entries(RIVAL_CHATTER))for(const kind of ['near','bump'])c[kind].forEach((_,n)=>{
  const size=statSync(join(root,'public/audio',chatterFile(id,kind,n))).size
  assert.ok(size>4000&&size<120000,`${chatterFile(id,kind,n)} is ${size} bytes`)
 })
})
