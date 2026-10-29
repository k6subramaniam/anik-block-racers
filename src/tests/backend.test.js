import test from 'node:test'
import assert from 'node:assert/strict'
import {validateSubmission,MAX_VERIFIED_TICKS,MAX_INPUT_SEGMENTS} from '../../backend/verify-rules.js'
const sample={track:'blast',laps:3,weather:'dynamic',commands:[[2,{forward:true}],[3,{left:true,forward:true}]]}
test('server verification accepts bounded versioned controller input segments',()=>{
 const s=validateSubmission(sample);assert.equal(s.total,5);assert.equal(s.segments[0].input.bomb,false)
})
test('server refuses untrusted scored values, arbitrary track names and invalid inputs',()=>{
 assert.throws(()=>validateSubmission({...sample,track:'custom'}));assert.throws(()=>validateSubmission({...sample,laps:20}))
 assert.throws(()=>validateSubmission({...sample,commands:[[2,{steer:100,forward:true}]]}))
 assert.throws(()=>validateSubmission({...sample,commands:[[3,{forward:4}]]}))
 assert.throws(()=>validateSubmission({...sample,commands:[[MAX_VERIFIED_TICKS+1,{}]]}))
 assert.throws(()=>validateSubmission({...sample,commands:Array(MAX_INPUT_SEGMENTS+1).fill([1,{}])}))
})
import {rankingConfig,getVerifiedTimes} from '../studio/global.js'
test('online rankings require a dedicated HTTPS project and a public key',()=>{
 assert.equal(rankingConfig({VITE_ANIK_GAME_API_URL:'http://evil.example',VITE_ANIK_GAME_PUBLISHABLE_KEY:'fake-key-123456789012'}),null)
 assert.equal(rankingConfig({}),null)
 assert.equal(rankingConfig({VITE_ANIK_GAME_API_URL:'https://example.supabase.co/',VITE_ANIK_GAME_PUBLISHABLE_KEY:'sb_publishable_dummy_123'}).url,'https://example.supabase.co')
})
test('online ranking fetch exposes only allowlisted public fields',async()=>{
 const cfg={url:'https://example.supabase.co',key:'sb_publishable_dummy_123'}
 const rows=await getVerifiedTimes(cfg,async(url,options)=>{
  assert.match(url,/select=track,laps,weather,ticks,stunt_points,finish_rank,created_at/)
  assert.ok(!url.includes('owner_id'));assert.equal(options.headers.apikey,cfg.key)
  return {ok:true,json:async()=>[{track:'blast',ticks:2100,laps:2,stunt_points:700}]}
 })
 assert.equal(rows.length,1)
})
