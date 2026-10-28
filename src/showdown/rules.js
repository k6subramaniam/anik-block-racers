/** Bot Smash Showdown versioned rules. Pure fixed-step simulation; no DOM or network.
 * Challenge IDs include the rules version. A seed fixes arena layout, bot paths,
 * and weather. Local/shared scores are NOT server-verified leaderboard entries.
 */
import { moveKart } from '../game/simulation.js'
import { environmentAt } from '../game/environment.js'

export const RULES_VERSION = 2
export const STEP = 1 / 60
export const ROUND_TICKS = 3600
export const ROUND_SECONDS = 60
export const LEGACY_BOUNDS = Object.freeze({ minX: -41, maxX: 41, minZ: -41, maxZ: 41 })
export const BOUNDS = Object.freeze({ minX: -82, maxX: 82, minZ: -82, maxZ: 82 })
export const rulesVersionFor = code => code?.startsWith('sd1-') ? 1 : 2
export const MAX_SCORE = 2_000_000
const TAU = Math.PI * 2
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const COLORS = ['#ffad39', '#ce76ff', '#56dbec', '#ffa4c6', '#bafb5b']

export function hashSeed(text) {
  let h = 2166136261
  for (const char of String(text)) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}
export function randomFor(seed) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
export function dailyChallenge(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (!Number.isFinite(d.getTime())) throw new RangeError('A valid date is required')
  return `sd2-d${d.toISOString().slice(0, 10).replaceAll('-', '')}`
}
export function validChallenge(code) {
  if (typeof code !== 'string' || code.length > 24) return false
  if (/^sd[12]-c[0-9a-f]{8}$/.test(code)) return true
  if (!/^sd[12]-d\d{8}$/.test(code)) return false
  const day = code.slice(5), iso = `${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}T00:00:00Z`
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) && dailyChallenge(date).slice(3) === code.slice(3)
}
export function newChallenge(entropy) {
  const n = Number.isFinite(entropy) ? entropy >>> 0 : hashSeed(String(Date.now()))
  return `sd2-c${n.toString(16).padStart(8,'0')}`
}
export function challengeTitle(code) {
  return /^sd[12]-d/.test(code) ? `Daily · ${code.slice(5,9)}-${code.slice(9,11)}-${code.slice(11,13)} UTC` : `Challenge · ${String(code).slice(-8).toUpperCase()}`
}
export function challengeFromSearch(search, fallback = dailyChallenge()) {
  const query = new URLSearchParams(String(search).slice(0, 2048))
  const candidate = query.get('challenge')
  const code = validChallenge(candidate) ? candidate : fallback
  const raw = query.get('score')
  const score = raw !== null && /^\d{1,7}$/.test(raw) ? Number(raw) : null
  return {
    code, invited: validChallenge(candidate), invalid: candidate !== null && !validChallenge(candidate),
    target: validChallenge(candidate) && score !== null && score <= MAX_SCORE ? score : null,
  }
}
export function makeChallengeUrl(base, code, score) {
  if (!validChallenge(code)) throw new RangeError('Invalid challenge ID')
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) throw new RangeError('Invalid score')
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol)) throw new RangeError('Unsupported link scheme')
  url.search = ''; url.hash = ''
  url.searchParams.set('challenge', code); url.searchParams.set('score', String(score))
  return url.href
}

export function makeArena(code) {
  if (!validChallenge(code)) throw new RangeError('Invalid challenge ID')
  const seed = hashSeed(code), rng = randomFor(seed), version = rulesVersionFor(code)
  const botHomes = [
    [0,22],[-20,23],[22,22],[-23,0],[23,0],[-22,-23],[22,-22],[0,-27],[-9,-13],[11,13],
  ]
  if(version===2)botHomes.push([-58,48],[58,48],[-58,-48],[58,-48],[0,-63],[63,0])
  const bots = botHomes.map(([x,z],i) => ({
    id: `bot-${i}`, index: i, color: COLORS[i % COLORS.length],
    homeX: x, homeZ: z, phase: rng() * TAU,
    orbit: i === 0 ? .55 : 1.4 + rng() * 2,
    rate: .35 + rng() * .35, maxHp: 65,
  }))
  const ramps = [
    { id:'north-ramp', x:0, z:6, yaw:0, width:8, length:12, height:2.6 },
    { id:'west-ramp', x:24, z:-14, yaw:Math.PI/2, width:7, length:10, height:3 },
    { id:'south-ramp', x:-16, z:-22, yaw:Math.PI, width:7, length:10, height:2.8 },
  ]
  const boosts = [{id:'boost-0',x:0,z:17}, {id:'boost-1',x:-24,z:-6}, {id:'boost-2',x:25,z:29}]
  if(version===2){
    ramps.push({id:'outer-north',x:0,z:-43,yaw:0,width:10,length:16,height:4},
      {id:'outer-east',x:48,z:32,yaw:-Math.PI/2,width:10,length:16,height:4},
      {id:'outer-west',x:-48,z:-32,yaw:Math.PI/2,width:10,length:16,height:4})
    boosts.push({id:'boost-3',x:0,z:-31},{id:'boost-4',x:35,z:32},{id:'boost-5',x:-35,z:-32})
  }
  return {code, seed, rulesVersion:version, bounds:version===1?LEGACY_BOUNDS:BOUNDS, bots, ramps, boosts, weatherOffset:(seed%4)*55, accent:COLORS[seed%COLORS.length]}
}
export function showdownWeather(arena, ticks) {
  return environmentAt(arena.weatherOffset + ticks * STEP * 3.65)
}
function botPose(def, ticks) {
  const age = ticks * STEP, a = def.phase + age * def.rate
  return {x:def.homeX + Math.sin(a)*def.orbit, z:def.homeZ + Math.cos(a*.81)*def.orbit,
    yaw:Math.atan2(-Math.cos(a), .81*Math.sin(a*.81))}
}
export function initialShowdown(code) {
  const arena = makeArena(code)
  return {
    code, ticks:0, done:false, score:0, combo:1, bestCombo:1, comboUntil:0,
    smashes:0, hits:0, jumps:0, bestAir:0, events:[],
    player:{x:0,y:0,z:33,yaw:0,speed:0,vy:0,collisions:0,boostTimer:0,boostCooldown:0,
      grounded:true,airTime:0,airStartX:0,airStartZ:0,jumpCooldown:0},
    bots:arena.bots.map(def=>({...def,...botPose(def,0),health:def.maxHp,hitCooldown:0,respawn:0,burst:0})),
  }
}
export function rampSample(ramp, point) {
  const fx=-Math.sin(ramp.yaw),fz=-Math.cos(ramp.yaw)
  const dx=point.x-ramp.x,dz=point.z-ramp.z
  const along=dx*fx+dz*fz,across=dx*Math.cos(ramp.yaw)-dz*Math.sin(ramp.yaw)
  const inside=Math.abs(across)<=ramp.width/2 && along>=-ramp.length/2 && along<=ramp.length/2
  return {inside,along,across,height:inside ? ramp.height*(along/ramp.length+.5):0,fx,fz}
}
export function segmentDistance(a,b,point) {
  const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz
  const t=len>1e-9?clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/len,0,1):0
  return {distance:Math.hypot(a.x+t*dx-point.x,a.z+t*dz-point.z),t}
}
function award(state, kind, base, position, extra={}) {
  let combo = state.combo
  if(kind==='smash'||kind==='land') {
    combo = state.comboUntil>=state.ticks && state.comboUntil>0 ? Math.min(5,combo+1):1
    state.comboUntil = state.ticks+300
  }
  const points = kind==='hit'?base:base*combo
  state.combo=combo;state.bestCombo=Math.max(state.bestCombo,combo)
  state.score=Math.min(MAX_SCORE,state.score+points)
  state.events.push({kind,points,combo,score:state.score,tick:state.ticks,
    x:position.x,y:position.y||1,z:position.z,...extra})
}

/** Exactly one 1/60s tick. Rendering frame rate never changes scoring rules. */
export function stepShowdown(previous, input={}, suppliedArena) {
  if(previous.done || previous.ticks>=ROUND_TICKS)return previous
  const arena=suppliedArena||makeArena(previous.code)
  const ticks=previous.ticks+1
  const state={...previous,ticks,events:[],player:{...previous.player}}
  if(ticks>state.comboUntil)state.combo=1
  const weather=showdownWeather(arena,ticks)
  const before=previous.player
  let p=moveKart(before,input,STEP,[],{mode:'explore',bounds:arena.bounds,weather})
  p.boostTimer=Math.max(0,(before.boostTimer||0)-STEP)
  p.boostCooldown=Math.max(0,(before.boostCooldown||0)-STEP)
  p.jumpCooldown=Math.max(0,(before.jumpCooldown||0)-STEP)
  const surface=arena.ramps.map(r=>({r,...rampSample(r,p)})).find(r=>r.inside)
  const oldSurface=arena.ramps.map(r=>({r,...rampSample(r,before)})).find(r=>r.inside)
  if(before.grounded){
    if(surface && surface.height<=before.y+.65){ p.y=surface.height;p.vy=0;p.grounded=true }
    else if(before.y>.12){
      const forward = oldSurface && (-Math.sin(p.yaw)*oldSurface.fx-Math.cos(p.yaw)*oldSurface.fz)*p.speed
      const launch = oldSurface && forward>7 && oldSurface.along>oldSurface.r.length*.30 && p.jumpCooldown<=0
      p.grounded=false;p.vy=launch?5.6+Math.abs(p.speed)*.13:0
      p.y=before.y;p.airTime=0;p.airStartX=p.x;p.airStartZ=p.z;p.jumpCooldown=1.0
      if(launch)state.events.push({kind:'jump',tick:ticks,x:p.x,y:p.y,z:p.z,points:0,score:state.score})
    } else {p.y=0;p.vy=0;p.grounded=true}
  } else {
    p.airTime=(before.airTime||0)+STEP;p.vy=before.vy-15*STEP;p.y=before.y+p.vy*STEP
    const ground=surface?.height||0
    if(p.y<=ground && p.vy<=0){
      p.y=ground;p.vy=0;p.grounded=true
      const distance=Math.hypot(p.x-p.airStartX,p.z-p.airStartZ)
      if(p.airTime>.35&&distance>4){
        state.jumps++;state.bestAir=Math.max(state.bestAir,p.airTime)
        award(state,'land',Math.min(450,100+Math.round(distance*8)),p,{distance,airTime:p.airTime})
      }
      p.airTime=0
    }
  }
  if(p.grounded&&p.boostCooldown<=0){
    const pad=arena.boosts.find(b=>Math.hypot(p.x-b.x,p.z-b.z)<2.2)
    if(pad && p.speed>2){
      p.speed=Math.min(30,p.speed+9);p.boostTimer=1.7;p.boostCooldown=3
      state.events.push({kind:'boost',tick:ticks,x:p.x,y:p.y,z:p.z,points:0,score:state.score})
    }
  }
  state.bots=previous.bots.map(n=>{
    const burst=Math.max(0,n.burst-STEP), hitCooldown=Math.max(0,n.hitCooldown-STEP)
    if(n.respawn>0){
      const respawn=Math.max(0,n.respawn-STEP)
      if(respawn>0)return {...n,respawn,burst,hitCooldown}
      return {...n,...botPose(n,ticks),respawn:0,burst:0,health:n.maxHp,hitCooldown:1.2}
    }
    let bot={...n,...botPose(n,ticks),burst,hitCooldown}
    if(p.y>2.25 || hitCooldown>0 || p.speed<6.5)return bot
    const relativeOld={x:before.x-n.x,z:before.z-n.z}
    const relativeNow={x:p.x-bot.x,z:p.z-bot.z}
    const contact=segmentDistance(relativeOld,relativeNow,{x:0,z:0})
    if(contact.distance>1.85)return bot
    const dx=n.x-before.x,dz=n.z-before.z,len=Math.hypot(dx,dz)
    const closing=len>.001?((-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/len)*p.speed:p.speed
    if(closing<4.5)return bot
    const damage=Math.min(100,Math.max(18,Math.round(closing*5.4)))
    bot.health=Math.max(0,bot.health-damage);bot.hitCooldown=.85
    state.hits++;p.speed*=bot.health===0?.86:.7
    if(bot.health===0){
      bot.respawn=5;bot.burst=.8;state.smashes++
      award(state,'smash',200,bot,{id:bot.id,damage})
    }else award(state,'hit',20,bot,{id:bot.id,damage})
    return bot
  })
  state.player=p
  if(ticks>=ROUND_TICKS)state.done=true
  return state
}
export function resultFor(state) {
  if(!state.done || state.ticks!==ROUND_TICKS)throw new Error('Only a finished 60-second run can be saved')
  return {code:state.code,rulesVersion:rulesVersionFor(state.code),score:state.score,smashes:state.smashes,
    jumps:state.jumps,bestCombo:state.bestCombo,bestAir:Math.round(state.bestAir*100)/100,ticks:state.ticks}
}
