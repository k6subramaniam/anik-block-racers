/** Non-realistic game rules only: damage, cartoon blasts and race recovery.
 * A single deterministic 60Hz step drives the player, AI and every hazard.
 */
import {battleTrack,atDistance,nearestOnTrack,crossedGate,segmentDistance} from './tracks.js'
import {raceWeather,normalizeLaps,normalizeWeather} from './weather.js'
import {resolveVehicleContacts} from './collisions.js'
import {garageModifiers} from '../studio/garage.js'
import {createStuntWorld,advanceStunts} from '../studio/stunts.js'
import {createPowerups,advancePowerups,TURBO_TOP_SPEED} from './powerups.js'
import {createItemBoxes,advanceCircuitItems,aiWantsItem} from './circuitItems.js'
export const BATTLE_STEP=1/60
export const BATTLE_LAPS=3
export const MAX_HAZARDS=40
export const BOMB_COOLDOWN=6
export const MINE_COOLDOWN=9
const DRIVERS=[
  {id:'player',name:'YOU',color:'#52e9b8',lane:0,topSpeed:27},
  {id:'bolt',name:'BOLT',color:'#ff9d56',lane:-2.6,topSpeed:22.6},
  {id:'nova',name:'NOVA',color:'#bc89ff',lane:2.6,topSpeed:23.1},
  {id:'pixel',name:'PIXEL',color:'#69d9ff',lane:2.3,topSpeed:22},
]
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x))
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x))
const alive=a=>a.hp>0&&a.respawn<=0&&!a.finished
const decay=(x,dt)=>Math.max(0,(x||0)-dt)
export function createBattle(trackId='blast',options={}){
  const track=battleTrack(trackId)
  const mods=garageModifiers(options.multiplayer?null:options.garage)
  const actors=DRIVERS.map((d,i)=>({...d,topSpeed:i===0?mods.topSpeed:options.multiplayer&&i===1?27:d.topSpeed,engineFactor:i===0?mods.acceleration:1,gripFactor:i===0?mods.grip:1,armorMult:i===0?mods.armorMultiplier:1,maxHp:i===0?mods.maxHp:100,turboFactor:i===0?mods.turboDuration:1,color:i===0?mods.color:d.color,...atDistance(track,i*4,d.lane),speed:0,hp:i===0?mods.maxHp:100,shield:1.5,stun:0,contactStun:0,kickX:0,kickZ:0,slipX:0,slipZ:0,crashes:0,collisionDamage:0,
    lap:1,nextGate:1,passed:0,safeS:i*4,respawn:0,knockouts:0,damageDealt:0,damageTaken:0,
    turbo:0,turboCount:0,bombCooldown:0,mineCooldown:0,repairCooldown:0,bombHeld:false,mineHeld:false,item:null,itemHeld:false,finished:false,finishTick:null}))
  const mines=[28,...[.22,.40,.56,.69,.89].map(f=>f*track.length)]
  if(trackId!=='blast')mines.push(track.length*.48,track.length*.95)
  const hazards=mines.map((s,i)=>({...atDistance(track,s,i===0?0:i%2?2.7:-2.7),groundY:atDistance(track,s).y,id:`track-mine-${i}`,type:'mine',owner:null,y:atDistance(track,s).y+.2,arm:.7,fuse:-1,cooldown:0,persistent:true,life:Infinity}))
  for(const [i,f] of [.15,.33,.63,.82].entries())hazards.push({...atDistance(track,track.length*f,i%2?-4:4),id:`track-crate-${i}`,type:'crate',owner:null,groundY:atDistance(track,track.length*f).y,y:atDistance(track,track.length*f).y+.6,arm:0,fuse:-1,cooldown:0,persistent:true,life:Infinity})
  const weatherMode=normalizeWeather(options.weather)
  return {trackId,stunts:createStuntWorld(trackId),remoteActive:!!options.multiplayer,laps:normalizeLaps(options.laps),weatherMode,weather:raceWeather(0,weatherMode,trackId),pairCooldowns:{},powerups:createPowerups(trackId),itemBoxes:createItemBoxes(track),itemRolls:0,tick:0,actors,hazards,explosions:[],events:[],nextId:0,done:false,finishOrder:[],totalBlasts:0}
}
export function aiInput(actor,track,state){
  if(!alive(actor))return {}
  const n=nearestOnTrack(track,actor),target=atDistance(track,n.s+8+Math.abs(actor.speed)*.23,actor.lane)
  const desired=Math.atan2(-(target.x-actor.x),-(target.z-actor.z)),error=angle(desired-actor.yaw)
  const index=state.actors.findIndex(a=>a.id===actor.id)
  const nearby=state.actors.some(a=>a.id!==actor.id&&alive(a)&&Math.hypot(a.x-actor.x,a.z-actor.z)<25)
  return {forward:true,backward:false,steer:clamp(-error*2.4,-1,1),speedLimit:Math.max(8,actor.topSpeed*(1-Math.min(.7,Math.abs(error)*.55))),
    bomb:nearby&&state.tick>180&&state.tick%(390+index*53)===0,
    mine:nearby&&state.tick>300&&state.tick%(610+index*67)===0,
    item:aiWantsItem(actor,state)}
}
export function integrateActor(actor,input,track,dt=BATTLE_STEP,weather=raceWeather(0,'clear')){
  let a={...actor,shield:decay(actor.shield,dt),stun:decay(actor.stun,dt),bombCooldown:decay(actor.bombCooldown,dt),mineCooldown:decay(actor.mineCooldown,dt),repairCooldown:decay(actor.repairCooldown,dt),turbo:decay(actor.turbo,dt),contactStun:decay(actor.contactStun,dt)}
  if(actor.finished)return {...a,speed:0}
  if(actor.respawn>0){
    a.respawn=decay(actor.respawn,dt)
    if(a.respawn<=0)return {...a,...atDistance(track,actor.safeS,actor.lane),hp:a.maxHp||100,shield:2.5,stun:0,contactStun:0,kickX:0,kickZ:0,slipX:0,slipZ:0,speed:0,turbo:0}
    return {...a,speed:0}
  }
  const gas=a.stun>0||a.contactStun>0?0:Number(!!input.forward)-Number(!!input.backward)
  let speed=a.speed
  if(gas>0)speed+=(speed<0?25:14)*(a.engineFactor||1)*(a.turbo>0?2.2:1)*dt*(.8+.2*weather.grip)
  else if(gas<0)speed-=(speed>0?27:8)*dt*weather.braking
  else speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-(3.5+Math.abs(speed)*.1)*dt)
  const surface=nearestOnTrack(track,a),along=-Math.sin(a.yaw)*surface.dx-Math.cos(a.yaw)*surface.dz
  if(Math.abs(speed)>.4||gas)speed-=9.81*surface.grade*along*dt
  speed=clamp(speed,-6,a.turbo>0?TURBO_TOP_SPEED:(Number.isFinite(input.speedLimit)?Math.min(a.topSpeed,input.speedLimit):a.topSpeed))
  const steer=Number.isFinite(input.steer)?clamp(input.steer,-1,1):Number(!!input.right)-Number(!!input.left)
  const yaw=a.yaw-steer*(input.drift?2.05:1.45)*Math.max(.47,track.grip*weather.grip)*(a.gripFactor||1)*Math.min(1,Math.abs(speed)/7)*dt*(speed<0?-1:1)
  const desiredX=-Math.sin(yaw)*speed,desiredZ=-Math.cos(yaw)*speed
  const traction=1-Math.exp(-dt*(18*track.grip*weather.grip)*(input.drift?.65:1))
  const slipX=(a.slipX??desiredX)+(desiredX-(a.slipX??desiredX))*traction
  const slipZ=(a.slipZ??desiredZ)+(desiredZ-(a.slipZ??desiredZ))*traction
  const exposure=1+Math.min(1,(a.y||0)/30)
  let x=a.x+(slipX+a.kickX+weather.windX*.28*exposure)*dt,z=a.z+(slipZ+a.kickZ+weather.windZ*.28*exposure)*dt
  const n=nearestOnTrack(track,{x,z,y:a.y}),half=track.width/2-.95
  let kickX=a.kickX*Math.exp(-4*dt),kickZ=a.kickZ*Math.exp(-4*dt)
  if(n.distance>half){
    x=n.x+(x-n.x)/n.distance*half;z=n.z+(z-n.z)/n.distance*half
    speed*=.65;kickX*=.25;kickZ*=.25
  }
  const deck=nearestOnTrack(track,{x,z,y:a.y})
  return {...a,x,z,y:deck.y,s:deck.s,grade:deck.grade,pitch:Math.atan(deck.grade*along),yaw,speed,kickX,kickZ,slipX,slipZ}
}
export function deployHazard(state,actor,type){
  if(!['bomb','mine'].includes(type)||!alive(actor)||state.hazards.filter(h=>!h.removed).length>=MAX_HAZARDS)return false
  if(type==='bomb'&&actor.bombCooldown>0||type==='mine'&&actor.mineCooldown>0)return false
  const forward={x:-Math.sin(actor.yaw),z:-Math.cos(actor.yaw)},id=`deployed-${state.nextId++}`
  if(type==='bomb'){
    actor.bombCooldown=BOMB_COOLDOWN
    state.hazards.push({id,type,owner:actor.id,x:actor.x+forward.x*1.5,z:actor.z+forward.z*1.5,groundY:actor.y||0,y:(actor.y||0)+1.15,
      vx:forward.x*(11.5+Math.max(0,actor.speed)*.8),vz:forward.z*(11.5+Math.max(0,actor.speed)*.8),vy:4.5,arm:0,fuse:1.7,cooldown:0,persistent:false,life:5})
  }else if(type==='mine'){
    actor.mineCooldown=MINE_COOLDOWN
    const p=nearestOnTrack(battleTrack(state.trackId),{x:actor.x-forward.x*3,z:actor.z-forward.z*3,y:actor.y})
    state.hazards.push({id,type,owner:actor.id,x:p.x,z:p.z,groundY:p.y,y:p.y+.2,arm:.8,fuse:-1,cooldown:0,persistent:false,life:28})
  }else return false
  state.events.push({kind:'deploy',actor:actor.id,type})
  return true
}
export function damageBlast(actor,blast){
  if(!alive(actor)||actor.shield>0)return {actor,damage:0}
  const dx=actor.x-blast.x,dz=actor.z-blast.z,dy=(actor.y||0)+.7-(blast.y||.2),distance=Math.hypot(dx,dy,dz)
  if(distance>=blast.radius)return {actor,damage:0}
  const damage=Math.min(actor.hp,Math.max(8,Math.round(blast.power*(1-.7*distance/blast.radius)*(actor.armorMult||1))))
  const len=Math.hypot(dx,dz),ux=len>.001?dx/len:Math.cos(actor.yaw),uz=len>.001?dz/len:-Math.sin(actor.yaw)
  const hp=actor.hp-damage,knock=8*(1-.5*distance/blast.radius)
  return {damage,actor:{...actor,hp,damageTaken:actor.damageTaken+damage,shield:.6,stun:.6,speed:actor.speed*.35,
    kickX:actor.kickX+ux*knock,kickZ:actor.kickZ+uz*knock,respawn:hp===0?2:0}}
}
function explode(state,hazard){
  const radius=hazard.type==='mine'?7.5:hazard.type==='crate'?10:hazard.type==='rocket'?5.5:9
  const power=hazard.type==='mine'?62:hazard.type==='crate'?90:hazard.type==='rocket'?60:85
  const blast={id:`blast-${state.nextId++}`,x:hazard.x,y:hazard.y,groundY:hazard.groundY||0,z:hazard.z,radius,power,type:hazard.type,owner:hazard.owner,ttl:.7}
  state.totalBlasts++;state.explosions.push(blast);state.events.push({kind:'explosion',...blast})
  hazard.fuse=-1
  if(hazard.persistent){hazard.cooldown=hazard.type==='mine'?12:18;hazard.arm=.8}else hazard.removed=true
  let creditedDamage=0,creditedKnockouts=0
  state.actors=state.actors.map(a=>{
    const {actor,damage}=damageBlast(a,blast)
    if(damage){
      state.events.push({kind:actor.hp===0?'knockout':'damage',actor:a.id,damage,source:hazard.owner,type:hazard.type})
      if(hazard.owner&&hazard.owner!==a.id){creditedDamage+=damage;if(actor.hp===0)creditedKnockouts++}
    }
    return actor
  })
  if(hazard.owner)state.actors=state.actors.map(a=>a.id===hazard.owner?{...a,damageDealt:a.damageDealt+creditedDamage,knockouts:a.knockouts+creditedKnockouts}:a)
  // Chain reactions are delayed and visibly warned, never recursive in one tick.
  for(const other of state.hazards){
    if(other===hazard||other.removed||other.cooldown>0||other.arm>0||other.type==='oil'||other.type==='rocket')continue
    if(Math.hypot(other.x-hazard.x,other.z-hazard.z,other.y-hazard.y)<radius&&other.fuse<0)other.fuse=.32
  }
}
export function advanceHazards(state,oldActors,dt=BATTLE_STEP){
  for(const h of state.hazards){
    if(h.removed)continue
    h.life-=dt
    if(h.life<=0){h.removed=true;continue}
    if(h.cooldown>0){h.cooldown=decay(h.cooldown,dt);continue}
    if(h.type==='bomb'&&h.y>(h.groundY||0)+.22){
      h.x+=h.vx*dt;h.z+=h.vz*dt;h.vy-=12*dt;h.y+=h.vy*dt
      const deck=nearestOnTrack(battleTrack(state.trackId),{x:h.x,z:h.z,y:h.groundY||0})
      h.groundY=deck.distance<battleTrack(state.trackId).width/2?deck.y:0
      if(h.y<=h.groundY+.22){h.y=h.groundY+.22;h.vx=0;h.vz=0;h.vy=0}
    }
    if(h.arm>0){h.arm=decay(h.arm,dt);continue}
    if(h.fuse>=0){h.fuse-=dt;if(h.fuse<=0)explode(state,h);continue}
    // Rockets and oil slicks are flown and triggered by advanceCircuitItems.
    if(h.type!=='bomb'&&h.type!=='rocket'&&h.type!=='oil'&&state.actors.some(a=>{
      if(!alive(a)||a.shield>0||Math.abs((a.y||0)-(h.groundY||0))>1.8)return false
      const old=oldActors.find(k=>k.id===a.id)||a
      // Teleport/rescue positions cannot trigger a swept trail of mines.
      return Math.hypot(a.x-old.x,a.z-old.z)<4&&segmentDistance(old,a,h)<(h.type==='mine'?1.7:2.1)
    }))h.fuse=h.type==='mine'?.3:.8
  }
  state.hazards=state.hazards.filter(h=>!h.removed)
}
export function advanceRaceProgress(actor,old,track,tick,laps=BATTLE_LAPS){
  if(!alive(actor)||old.respawn>0)return actor
  const gate=track.gates[actor.nextGate]
  if(!crossedGate(gate,old,actor,track.width))return actor
  const nextGate=(actor.nextGate+1)%8,lap=gate.index===0?actor.lap+1:actor.lap
  return {...actor,nextGate,lap,passed:actor.passed+1,safeS:gate.s+1.5,
    finished:lap>laps,finishTick:lap>laps?tick:null}
}
export function battleRanking(state){
  const track=battleTrack(state.trackId)
  return [...state.actors].sort((a,b)=>{
    if(a.finished||b.finished)return (a.finishTick??Infinity)-(b.finishTick??Infinity)
    if(a.passed!==b.passed)return b.passed-a.passed
    const target=track.gates[a.nextGate].s
    const remaining=x=>(target-nearestOnTrack(track,x).s+track.length)%track.length
    return remaining(a)-remaining(b)
  })
}
export function stepBattle(previous,input={},remoteInput=null){
  if(previous.done)return previous
  const track=battleTrack(previous.trackId),dt=BATTLE_STEP
  const state={...previous,tick:previous.tick+1,events:[],hazards:previous.hazards.map(h=>h.touched?{...h,touched:{...h.touched}}:{...h}),
    explosions:previous.explosions.filter(e=>e.ttl>dt).map(e=>({...e,ttl:e.ttl-dt})),powerups:previous.powerups.map(p=>({...p})),finishOrder:[...previous.finishOrder],stunts:{pads:previous.stunts.pads.map(p=>({...p})),props:previous.stunts.props.map(p=>({...p})),bursts:previous.stunts.bursts.map(b=>({...b}))}}
  state.weather=raceWeather(state.tick,state.weatherMode,state.trackId)
  const commands=previous.actors.map((a,i)=>i===0?input:i===1&&remoteInput?remoteInput:aiInput(a,track,previous))
  state.actors=previous.actors.map((a,i)=>integrateActor(a,commands[i],track,dt,state.weather))
  advancePowerups(state,previous.actors,dt)
  const contacts=resolveVehicleContacts(state.actors,previous.actors,track,state.tick,previous.pairCooldowns)
  state.actors=contacts.actors;state.pairCooldowns=contacts.pairCooldowns;state.events.push(...contacts.events)
  for(let i=0;i<state.actors.length;i++){
    const a=state.actors[i],before=previous.actors[i],cmd=commands[i]
    if(cmd.bomb&&!before.bombHeld)deployHazard(state,a,'bomb')
    if(cmd.mine&&!before.mineHeld)deployHazard(state,a,'mine')
    a.bombHeld=!!cmd.bomb;a.mineHeld=!!cmd.mine
  }
  advanceCircuitItems(state,previous.actors,commands,dt,explode,MAX_HAZARDS)
  state.playerSteer=Number(!!input.right)-Number(!!input.left)
  advanceHazards(state,previous.actors,dt)
  advanceStunts(state,previous,dt)
  state.actors=state.actors.map((a,i)=>{
    if(alive(a)&&a.repairCooldown<=0&&a.hp<100&&track.repairs.some(p=>Math.hypot(a.x-p.x,a.z-p.z,(a.y||0)-p.y)<2.8)){
      a={...a,hp:Math.min(100,a.hp+40),repairCooldown:8};state.events.push({kind:'repair',actor:a.id})
    }
    const next=advanceRaceProgress(a,previous.actors[i],track,state.tick,state.laps)
    if(next.finished&&!a.finished)state.finishOrder.push(next.id)
    if(next.lap>a.lap)state.events.push({kind:next.finished?'finished':'lap',actor:next.id})
    return next
  })
  state.explosions=state.explosions.slice(-24)
  state.done=state.actors[0].finished&&(!state.remoteActive||state.actors[1].finished)
  return state
}
