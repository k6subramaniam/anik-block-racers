/** ANIK optional server-verified result endpoint.
 * Deploy only in a dedicated game Supabase project with backend/verified_scores.sql.
 * Secret service_role is available to the Edge Function ONLY, never GitHub Pages.
 */
import {verifySubmission} from '../verify-rules.js'
const allowed=['https://k6subramaniam.github.io','http://localhost:5173','http://127.0.0.1:5173']
const cors=origin=>({'Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'})
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',headers=cors(origin)
 if(req.method==='OPTIONS')return new Response('',{headers})
 if(req.method!=='POST'||!allowed.includes(origin))return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers})
 const url=Deno.env.get('SUPABASE_URL'),publicKey=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!publicKey||!service)return new Response(JSON.stringify({error:'Game ranking backend not configured'}),{status:503,headers})
 const authorization=req.headers.get('authorization')||''
 if(!authorization.startsWith('Bearer ')||authorization.length>2800)return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers})
 try{
  const me=await fetch(`${url}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:authorization}})
  if(!me.ok)return new Response(JSON.stringify({error:'Sign in to submit verified runs'}),{status:401,headers})
  const auth=await me.json()
  if(!auth.id||typeof auth.id!=='string')return new Response(JSON.stringify({error:'Invalid game identity'}),{status:401,headers})
  const length=Number(req.headers.get('content-length')||0)
  if(length>200000)return new Response(JSON.stringify({error:'Replay too large'}),{status:413,headers})
  const body=await req.text()
  if(body.length>200000)return new Response(JSON.stringify({error:'Replay too large'}),{status:413,headers})
  const payload=JSON.parse(body),verified=verifySubmission(payload)
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))
  const hash=Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('')
  const row={...verified,owner_id:auth.id,replay_hash:hash}
  const saved=await fetch(`${url}/rest/v1/anik_verified_runs`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row)})
  if(!saved.ok)throw new Error('Storage unavailable')
  return new Response(JSON.stringify({verified:true,track:verified.track,laps:verified.laps,ticks:verified.ticks,rank:verified.finish_rank}),{status:200,headers})
 }catch(e){
  const error=e instanceof SyntaxError?'Invalid replay JSON':e?.message||'Verification unavailable'
  const code=error==='Storage unavailable'?503:422
  return new Response(JSON.stringify({error}),{status:code,headers})
 }
})
