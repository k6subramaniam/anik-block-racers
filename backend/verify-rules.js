/** Server-side replay verification: deterministic local physics. Never trust a submitted score. */
import {createBattle,stepBattle,battleRanking} from '../src/battle/simulation.js'
export const MAX_VERIFIED_TICKS=18000
export const MAX_INPUT_SEGMENTS=1800
export const VERIFIABLE_TRACKS=Object.freeze(['blast','canyon','frost','skybridge','summit'])
const WEATHER=['clear','rain','snow','wind','dynamic']
const CONTROLS=['forward','backward','left','right','drift','bomb','mine']
export function validateSubmission(payload){
 if(!payload||typeof payload!=='object'||!VERIFIABLE_TRACKS.includes(payload.track)||!Number.isInteger(payload.laps)||payload.laps<1||payload.laps>5||!WEATHER.includes(payload.weather)||!Array.isArray(payload.commands)||payload.commands.length<1||payload.commands.length>MAX_INPUT_SEGMENTS)throw new Error('Invalid ranked race configuration')
 let total=0
 const segments=payload.commands.map(entry=>{
  if(!Array.isArray(entry)||entry.length!==2||!Number.isInteger(entry[0])||entry[0]<1||entry[0]>MAX_VERIFIED_TICKS||!entry[1]||typeof entry[1]!=='object')throw new Error('Invalid input replay segment')
  const input={};for(const key of CONTROLS){if(entry[1][key]!==undefined&&typeof entry[1][key]!=='boolean')throw new Error('Invalid controller value');input[key]=entry[1][key]===true}
  const extra=Object.keys(entry[1]).filter(k=>!CONTROLS.includes(k));if(extra.length)throw new Error('Unexpected input field')
  total+=entry[0];if(total>MAX_VERIFIED_TICKS)throw new Error('Race is too long to verify')
  return {ticks:entry[0],input}
 })
 return {track:payload.track,laps:payload.laps,weather:payload.weather,segments,total}
}
export function verifySubmission(payload){
 const cfg=validateSubmission(payload),state0=createBattle(cfg.track,{laps:cfg.laps,weather:cfg.weather,multiplayer:true})
 let game=state0,seen=0
 for(const segment of cfg.segments){
  for(let i=0;i<segment.ticks;i++){
   if(game.done)throw new Error('Replay continues after finish')
   game=stepBattle(game,segment.input);seen++
  }
 }
 if(!game.done||!game.actors[0].finished||game.tick!==seen)throw new Error('Run has not completed all verified checkpoints')
 const player=game.actors[0],rank=battleRanking(game).findIndex(a=>a.id==='player')+1
 return {track:cfg.track,laps:cfg.laps,weather:cfg.weather,ticks:game.tick,stunt_points:player.stuntScore||0,finish_rank:rank}
}
