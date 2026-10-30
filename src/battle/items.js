/** Arcade power-ups for Battle Race on the Grand Circuit. Drive through an item box to
 * hold one item, then use it: TURBO, SHIELD, ROCKET (homing) or OIL slick.
 * Rivals collect boxes and use items too. Pure, deterministic game rules.
 */
import {LANE_OFFSETS,trackPoint} from '../game/track.js'
// rules.js imports this module too; its helpers are only called at step time, not at load.
import {segmentGap,safeTrackPoint,BATTLE_LIMITS} from './rules.js'

export const ITEM_KINDS=Object.freeze(['turbo','shield','rocket','oil'])
export const ITEM_LABELS=Object.freeze({turbo:'TURBO',shield:'SHIELD',rocket:'ROCKET',oil:'OIL SLICK'})
export const ITEM_RULES=Object.freeze({
 boxRespawn:6,turbo:2.4,shield:6,rocketSpeed:38,rocketLife:3.2,rocketRange:70,
 oilLife:15,oilRadius:2.1,oilStun:1.1,botTurbo:2.5,aiHold:5,aiGrace:8,
})
// A row of four boxes spans the road at four points on the lap. Index 135 sits 11 m past
// the finish line, so the first power-up comes within seconds of the start; even
// a no-steering launch off the grid drives through one.
export const ITEM_BOX_ROWS=Object.freeze([18,66,112,135])
export const ITEM_BOXES=Object.freeze(ITEM_BOX_ROWS.flatMap(index=>LANE_OFFSETS.map((lane,i)=>({id:`item-${index}-${i}`,...trackPoint(index,lane)}))))

// Deterministic per pickup, so races replay identically and tests are stable.
export function rollItem(seed){
 let x=Math.imul(seed|0,2654435761)>>>0
 x=Math.imul(x^(x>>>15),2246822519)>>>0
 x=(x^(x>>>13))>>>0
 return ITEM_KINDS[x%ITEM_KINDS.length]
}

export function initialItems(){
 return {item:null,lastItem:0,itemBoxes:ITEM_BOXES.map(b=>({...b,cooldown:0})),botItems:{},itemRolls:0,turboUses:0,rocketsFired:0}
}

const forward=a=>({x:-Math.sin(a.yaw),z:-Math.cos(a.yaw)})
const aheadOf=(from,to)=>{const f=forward(from);return (to.x-from.x)*f.x+(to.z-from.z)*f.z}

// Nearest target in front of the shooter within range; rockets only fly forwards, and
// never lock on so close that the shooter would be caught in the blast.
export function rocketTarget(shooter,targets){
 let best=null,bestDistance=ITEM_RULES.rocketRange
 for(const t of targets){
  if(t.id===shooter.id)continue
  const d=Math.hypot(t.x-shooter.x,t.z-shooter.z)
  if(d>6&&d<bestDistance&&aheadOf(shooter,t)>2){best=t;bestDistance=d}
 }
 return best
}

function launchRocket(s,shooter,target){
 const f=forward(shooter),p=safeTrackPoint({x:shooter.x+f.x*2.2,z:shooter.z+f.z*2.2})
 s.serial++;s.rocketsFired++
 return {id:`rocket-${s.serial}`,kind:'rocket',owner:shooter.id,target:target?.id||null,fixed:false,
  x:p.x,z:p.z,y:.9,vx:f.x*ITEM_RULES.rocketSpeed,vz:f.z*ITEM_RULES.rocketSpeed,vy:0,
  arm:0,fuse:null,life:ITEM_RULES.rocketLife,cooldown:0}
}

function dropOil(s,actor){
 const f=forward(actor),p=safeTrackPoint({x:actor.x-f.x*3.2,z:actor.z-f.z*3.2})
 s.serial++
 return {id:`oil-${s.serial}`,kind:'oil',owner:actor.id,fixed:false,x:p.x,z:p.z,y:.2,arm:.6,fuse:null,life:ITEM_RULES.oilLife,cooldown:0,touched:{}}
}

/** Use the held item. Returns events; mutates the step's working copies only. */
export function useItem(s,actor,kind,targets,isPlayer){
 // Rockets and oil share the dynamic hazard pool with bombs and mines; when it is full,
 // the item becomes a turbo rather than overflowing the pool.
 if((kind==='rocket'||kind==='oil')&&s.hazards.filter(h=>!h.fixed).length>=BATTLE_LIMITS.dynamic)kind='turbo'
 if(kind==='turbo'){
  if(isPlayer){actor.boostTimer=Math.max(actor.boostTimer||0,ITEM_RULES.turbo);actor.speed=Math.max(actor.speed,26);s.turboUses++}
  else actor.turbo=ITEM_RULES.botTurbo
  return {kind:'item-turbo',name:actor.name}
 }
 if(kind==='shield'){
  if(isPlayer)s.shield=Math.max(s.shield,ITEM_RULES.shield)
  else actor.blastShield=s.time+ITEM_RULES.shield
  return {kind:'item-shield',name:actor.name}
 }
 if(kind==='rocket'){
  s.hazards.push(launchRocket(s,actor,rocketTarget(actor,targets)))
  return {kind:isPlayer?'rocket-launch':'rival-rocket',name:actor.name}
 }
 s.hazards.push(dropOil(s,actor))
 return {kind:isPlayer?'oil-dropped':'rival-oil',name:actor.name}
}

/** Item boxes, item use, rival item AI, rocket flight and oil slicks for one step.
 * `detonate` receives rockets that reach their target so the shared blast code applies.
 */
export function stepItems(s,p,before,ns,oldBots,step,token,recovering,detonate,ai=true){
 const racers=ns.filter(n=>n.kind==='racer'&&n.health>0&&n.respawn<=0)
 const playerActor={id:'player',name:'YOU',...p}
 // Use: one press per token, never a held-button repeat.
 if(token!==s.lastItem){
  s.lastItem=token
  if(s.item&&!recovering&&s.health>0){
   const kind=s.item;s.item=null
   s.events.push(useItem(s,p,kind,racers,true))
  }
 }
 // Boxes: the player and rivals both collect; a taken box regrows after a few seconds.
 for(const box of s.itemBoxes){
  box.cooldown=Math.max(0,box.cooldown-step)
  if(box.cooldown>0)continue
  if(!recovering&&s.health>0&&!s.item&&segmentGap(before,p,box)<1.9){
   s.item=rollItem(++s.itemRolls*31+s.serial);box.cooldown=ITEM_RULES.boxRespawn
   s.events.push({kind:'item-pickup',item:s.item});continue
  }
  for(const n of racers){
   if(s.botItems[n.id])continue
   const old=oldBots.find(o=>o.id===n.id)||n
   if(Math.hypot(n.x-old.x,n.z-old.z)>8||segmentGap(old,n,box)>1.9)continue
   // A rival's pickup leaves the box in place for the player, so the kart ahead in your
   // lane never empties it before you arrive.
   s.botItems[n.id]={kind:rollItem(++s.itemRolls*31+s.serial),since:s.time};break
  }
 }
 // Rival AI: buffs at once; rockets when you are ahead in range; oil when you are close behind.
 for(const n of racers){
  const held=s.botItems[n.id];if(!ai||!held||n.stun>0)continue
  const ahead=aheadOf(n,p),distance=Math.hypot(p.x-n.x,p.z-n.z),waited=s.time-held.since
  // The grid is bunched at the start: no rival rockets or oil until the field spreads out.
  if((held.kind==='rocket'||held.kind==='oil')&&s.time<ITEM_RULES.aiGrace)continue
  const fire=held.kind==='turbo'||held.kind==='shield'
   ||(held.kind==='rocket'&&!recovering&&ahead>2&&distance<45)
   ||(held.kind==='oil'&&ahead<-2&&distance<22)
   ||waited>ITEM_RULES.aiHold
  if(!fire)continue
  delete s.botItems[n.id]
  const kind=waited>ITEM_RULES.aiHold&&held.kind==='rocket'&&!(ahead>2&&distance<45)?'turbo':held.kind
  s.events.push(useItem(s,n,kind,recovering?[]:[playerActor],false))
 }
 // Rockets home in on their target and burst on contact, through the shared blast rules.
 const targetOf=id=>id==='player'?(recovering?null:p):ns.find(n=>n.id===id&&n.health>0&&n.respawn<=0)
 for(const h of s.hazards){
  if(h.kind==='rocket'&&!h.spent){
   const t=h.target&&targetOf(h.target)
   if(t){
    const dx=t.x-h.x,dz=t.z-h.z,l=Math.hypot(dx,dz)||1
    h.vx=dx/l*ITEM_RULES.rocketSpeed;h.vz=dz/l*ITEM_RULES.rocketSpeed
    if(l<1.8){h.x=t.x;h.z=t.z;detonate.push(h);continue}
   }
   const moved=safeTrackPoint({x:h.x+h.vx*step,z:h.z+h.vz*step});h.x=moved.x;h.z=moved.z
   if(h.life-step<=0)detonate.push(h)
  }
  if(h.kind==='oil'&&!h.spent){
   h.arm=Math.max(0,h.arm-step)
   if(h.arm>0)continue
   if(!recovering&&s.health>0&&s.shield<=0&&!(h.touched.player>s.time)&&segmentGap(before,p,h)<ITEM_RULES.oilRadius){
    h.touched.player=s.time+1.5
    s.stun=Math.max(s.stun,ITEM_RULES.oilStun);p.speed*=.4;p.boostTimer=0
    s.events.push({kind:'oil-spin'})
   }
   for(let i=0;i<ns.length;i++){
    const n=ns[i]
    if(n.kind!=='racer'||n.health<=0||n.respawn>0||(n.blastShield||0)>s.time||h.touched[n.id]>s.time)continue
    const old=oldBots.find(o=>o.id===n.id)||n
    if(segmentGap(old,n,h)>=ITEM_RULES.oilRadius)continue
    h.touched[n.id]=s.time+1.5;ns[i]={...n,stun:Math.max(n.stun||0,1.3)}
    s.events.push({kind:'rival-spin',name:n.name})
   }
  }
 }
 return p
}

