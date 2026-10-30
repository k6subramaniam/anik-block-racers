/** Power-ups for the five battle circuits: rows of ? boxes, one held item per kart,
 * and TURBO, SHIELD, homing ROCKET and OIL slick. Same items and dice as the Voxel Valley
 * race (itemKinds.js), adapted to this simulation's 3D tracks, decks and blast rules.
 */
import {atDistance,segmentDistance} from './tracks.js'
import {activateTurbo} from './powerups.js'
import {rollItem} from './itemKinds.js'

export const CIRCUIT_ITEM_RULES=Object.freeze({
 boxRespawn:6,pickupRadius:2.3,shield:6,rocketSpeed:40,rocketLife:3.2,rocketRange:70,rocketMin:6,
 oilLife:15,oilRadius:2.3,oilStun:1.1,aiGrace:8,aiHold:5,pickupPause:1,
})
// The first row sits 40 m in (past the start mine at 28 m); the rest spread round the lap,
// clear of the fixed mines and crates.
const ROW_FRACTIONS=[.27,.45,.75]

export function createItemBoxes(track){
 const rows=[40,...ROW_FRACTIONS.map(f=>track.length*f)]
 const lanes=[-.3,-.1,.1,.3].map(f=>f*track.width)
 return rows.flatMap((s,r)=>lanes.map((lane,i)=>{const p=atDistance(track,s,lane);return {id:`circuit-item-${r}-${i}`,x:p.x,y:p.y,z:p.z,s,cooldown:0}}))
}

const alive=a=>a.hp>0&&a.respawn<=0&&!a.finished
const forward=a=>({x:-Math.sin(a.yaw),z:-Math.cos(a.yaw)})
const ahead=(from,to)=>{const f=forward(from);return (to.x-from.x)*f.x+(to.z-from.z)*f.z}

export function circuitRocketTarget(shooter,actors){
 let best=null,bestDistance=CIRCUIT_ITEM_RULES.rocketRange
 for(const t of actors){
  if(t.id===shooter.id||!alive(t)||Math.abs((t.y||0)-(shooter.y||0))>4)continue
  const d=Math.hypot(t.x-shooter.x,t.z-shooter.z)
  if(d>CIRCUIT_ITEM_RULES.rocketMin&&d<bestDistance&&ahead(shooter,t)>2){best=t;bestDistance=d}
 }
 return best
}

/** Should an AI kart use its held item this tick? Nothing while the grid is still bunched;
 * then buffs at once, rockets at a kart ahead and oil when someone is close behind. */
export function aiWantsItem(actor,state){
 if(!actor.item||!alive(actor))return false
 const seconds=state.tick/60
 if(seconds<CIRCUIT_ITEM_RULES.aiGrace)return false
 if(actor.item==='turbo'||actor.item==='shield')return true
 if(seconds-(actor.itemSince??seconds)>CIRCUIT_ITEM_RULES.aiHold)return true
 if(actor.item==='rocket')return !!circuitRocketTarget(actor,state.actors)
 return state.actors.some(o=>o.id!==actor.id&&alive(o)&&ahead(actor,o)<-2&&Math.hypot(o.x-actor.x,o.z-actor.z)<22)
}

function useItem(state,actor,maxHazards){
 let kind=actor.item
 actor.item=null
 const full=state.hazards.filter(h=>!h.removed).length>=maxHazards
 if((kind==='rocket'||kind==='oil')&&full)kind='turbo'
 const f=forward(actor)
 if(kind==='rocket'){
  const target=circuitRocketTarget(actor,state.actors)
  if(!target)kind='turbo'
  else{
   state.hazards.push({id:`rocket-${state.nextId++}`,type:'rocket',owner:actor.id,target:target.id,x:actor.x+f.x*2,z:actor.z+f.z*2,y:(actor.y||0)+.9,groundY:actor.y||0,
    arm:0,fuse:-1,cooldown:0,persistent:false,life:CIRCUIT_ITEM_RULES.rocketLife})
   state.events.push({kind:'rocket-launch',actor:actor.id});return actor
  }
 }
 if(kind==='oil'){
  state.hazards.push({id:`oil-${state.nextId++}`,type:'oil',owner:actor.id,x:actor.x-f.x*3.2,z:actor.z-f.z*3.2,y:(actor.y||0)+.05,groundY:actor.y||0,
   arm:.6,fuse:-1,cooldown:0,persistent:false,life:CIRCUIT_ITEM_RULES.oilLife,touched:{}})
  state.events.push({kind:'oil-dropped',actor:actor.id});return actor
 }
 if(kind==='shield'){state.events.push({kind:'item-shield',actor:actor.id});return {...actor,shield:Math.max(actor.shield||0,CIRCUIT_ITEM_RULES.shield)}}
 state.events.push({kind:'item-turbo',actor:actor.id})
 return activateTurbo(actor)
}

/** One step: box pickups, item use, rocket flight and oil slicks. Boxes are only used up
 * by human drivers, so an AI kart ahead in your lane never empties your box. */
export function advanceCircuitItems(state,oldActors,commands,dt,explode,maxHazards){
 const R=CIRCUIT_ITEM_RULES,human=i=>i===0||(state.remoteActive&&i===1)
 // States from an older peer or replay may predate item boxes.
 state.itemBoxes=(state.itemBoxes||[]).map(b=>({...b,cooldown:Math.max(0,b.cooldown-dt)}))
 state.actors=state.actors.map((a,i)=>{
  const old=oldActors[i]||a
  let next={...a}
  // A short pause after any pickup stops one kart sweeping a whole row of boxes.
  next.itemPause=Math.max(0,(a.itemPause||0)-dt)
  if(alive(a)&&!a.item&&next.itemPause<=0&&Math.hypot(a.x-old.x,a.z-old.z)<6){
   const box=state.itemBoxes.find(b=>b.cooldown<=0&&Math.abs((a.y||0)-b.y)<2.5&&segmentDistance(old,a,b)<R.pickupRadius)
   if(box){
    state.itemRolls=(state.itemRolls||0)+1
    next.item=rollItem(state.itemRolls*31+state.nextId);next.itemSince=state.tick/60;next.itemPause=R.pickupPause
    if(human(i))box.cooldown=R.boxRespawn
    state.events.push({kind:'item-pickup',actor:a.id,item:next.item})
   }
  }
  const pressed=!!commands[i]?.item
  if(pressed&&!old.itemHeld&&next.item&&alive(next))next=useItem(state,next,maxHazards)
  next.itemHeld=pressed
  return next
 })
 const byId=id=>state.actors.find(a=>a.id===id)
 for(const h of state.hazards){
  if(h.removed)continue
  if(h.type==='rocket'){
   const t=byId(h.target)
   if(t&&alive(t)){
    const dx=t.x-h.x,dz=t.z-h.z,dy=(t.y||0)+.8-h.y,l=Math.hypot(dx,dz)||1
    if(l<2){h.x=t.x;h.z=t.z;h.y=(t.y||0)+.7;explode(state,h);continue}
    const stepLen=Math.min(l,R.rocketSpeed*dt)
    h.x+=dx/l*stepLen;h.z+=dz/l*stepLen;h.y+=dy*Math.min(1,dt*6);h.groundY=t.y||0
   }
   if(h.life-dt<=0)explode(state,h)
  }
  if(h.type==='oil'){
   h.arm=Math.max(0,h.arm-dt)
   if(h.arm>0)continue
   state.actors=state.actors.map((a,i)=>{
    const old=oldActors[i]||a
    if(!alive(a)||a.shield>0||(h.touched[a.id]||0)>state.tick||Math.abs((a.y||0)-(h.groundY||0))>1.8)return a
    if(Math.hypot(a.x-old.x,a.z-old.z)>6||segmentDistance(old,a,h)>=R.oilRadius)return a
    h.touched[a.id]=state.tick+90
    state.events.push({kind:'oil-spin',actor:a.id})
    return {...a,stun:Math.max(a.stun||0,R.oilStun),speed:a.speed*.4,turbo:0}
   })
  }
 }
}
