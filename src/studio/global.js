/** Optional verified global board. This client is read-only; replay submission is
 * disabled until a dedicated game backend/authentication is deployed and audited. */
export function rankingConfig(env=import.meta.env){
 const url=env?.VITE_ANIK_GAME_API_URL,key=env?.VITE_ANIK_GAME_PUBLISHABLE_KEY
 if(typeof url!=='string'||typeof key!=='string'||key.length<15)return null
 try{const u=new URL(url);if(u.protocol!=='https:'||u.pathname!=='/'||!u.hostname.endsWith('.supabase.co'))return null
   return {url:u.origin,key}
 }catch{return null}
}
export async function getVerifiedTimes(config=rankingConfig(),fetcher=fetch){
 if(!config)return null
 const route='/rest/v1/anik_verified_runs?select=track,laps,weather,ticks,stunt_points,finish_rank,created_at&order=ticks.asc&limit=20'
 const response=await fetcher(config.url+route,{method:'GET',headers:{apikey:config.key,Accept:'application/json'}})
 if(!response.ok)throw new Error('Verified rankings are temporarily unavailable')
 const rows=await response.json()
 if(!Array.isArray(rows))throw new Error('Invalid verified ranking response')
 return rows.filter(r=>Number.isInteger(r.ticks)&&r.ticks>0&&typeof r.track==='string'&&Number.isInteger(r.laps)).slice(0,20)
}
