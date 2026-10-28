import {validChallenge,ROUND_TICKS,MAX_SCORE,rulesVersionFor} from './rules.js'
export const SCORE_KEY='anik-showdown-scores-v1'
export const STATS_KEY='anik-showdown-local-events-v1'
export const CONSENT_KEY='anik-showdown-local-stats-consent-v1'
export const EVENT_NAMES=new Set(['lobby_open','challenge_start','challenge_complete','challenge_abandon','replay_watch','clip_saved','card_saved','share_intent','share_handoff','share_cancelled','link_copied','challenge_open'])
export function browserStorage(){try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}}
function read(key,storage){try{return JSON.parse(storage?.getItem(key)||'[]')}catch{return []}}
export function validResult(value){
  return !!value&&validChallenge(value.code)&&value.rulesVersion===rulesVersionFor(value.code)&&value.ticks===ROUND_TICKS&&
    Number.isInteger(value.score)&&value.score>=0&&value.score<=MAX_SCORE&&
    Number.isInteger(value.smashes)&&value.smashes>=0&&value.smashes<=150&&
    Number.isInteger(value.jumps)&&value.jumps>=0&&value.jumps<=180&&
    Number.isInteger(value.bestCombo)&&value.bestCombo>=1&&value.bestCombo<=5
}
export function localScores(code,storage=browserStorage()){
  const data=read(SCORE_KEY,storage)
  return (Array.isArray(data)?data:[]).filter(v=>validResult(v)&&v.code===code&&typeof v.id==='string')
    .sort((a,b)=>b.score-a.score||(a.savedAt||'').localeCompare(b.savedAt||'')).slice(0,20)
}
export function saveResult(result,id,storage=browserStorage()){
  if(!validResult(result)||typeof id!=='string'||id.length>96)return {saved:false,reason:'Invalid or unfinished run'}
  if(!storage)return {saved:false,reason:'Device storage is unavailable'}
  const rows=read(SCORE_KEY,storage)
  const valid=(Array.isArray(rows)?rows:[]).filter(validResult)
  if(valid.some(r=>r.id===id))return {saved:true,duplicate:true}
  const record={...result,id,savedAt:new Date().toISOString()}
  try{storage.setItem(SCORE_KEY,JSON.stringify([...valid,record].slice(-200)));return {saved:true,record}}
  catch{return {saved:false,reason:'Device storage is full or blocked'}}
}
export function statsConsent(storage=browserStorage()){try{return storage?.getItem(CONSENT_KEY)==='yes'}catch{return false}}
export function setStatsConsent(enabled,storage=browserStorage()){
  try{storage?.setItem(CONSENT_KEY,enabled?'yes':'no');if(!enabled)storage?.removeItem(STATS_KEY);return true}catch{return false}
}
/** Opt-in DEVICE-LOCAL diagnostics only. No endpoint, IDs, names or URLs are sent. */
export function trackEvent(name,details={},storage=browserStorage()){
  if(!EVENT_NAMES.has(name)||!statsConsent(storage))return false
  const event={event:name,at:new Date().toISOString()}
  if(validChallenge(details.code))event.code=details.code
  if(Number.isInteger(details.score)&&details.score>=0&&details.score<=MAX_SCORE)event.score=details.score
  const data=read(STATS_KEY,storage),rows=Array.isArray(data)?data:[]
  try{storage.setItem(STATS_KEY,JSON.stringify([...rows,event].slice(-300)));return true}catch{return false}
}
export function localStats(storage=browserStorage()){
  const data=read(STATS_KEY,storage),events=(Array.isArray(data)?data:[]).filter(r=>EVENT_NAMES.has(r?.event))
  const counts={};for(const r of events)counts[r.event]=(counts[r.event]||0)+1
  return {scope:'this-device-only',collection:'opt-in',counts,events}
}
export function clearScores(storage=browserStorage()){try{storage?.removeItem(SCORE_KEY);return true}catch{return false}}
