/** Fictional arcade race hazards. All values are game-balance parameters.
 * No real-world explosive modelling. Pure simulation, immutable inputs.
 */
import {TRACK,gateAt,nearestRoad} from '../game/track.js'
import {SPAWN,SAFE_ROAD_HALF_WIDTH} from '../game/simulation.js'
const cap=(n,a,b)=>Math.max(a,Math.min(b,n))
export const BATTLE_LIMITS=Object.freeze({health:100,bombs:5,mines:4,dynamic:24,bursts:16})
export function trackPose(index,lane=0){
 const g=gateAt(index),p=TRACK[index%TRACK.length]
 return {x:p.x-g.tz*lane,z:p.z+g.tx*lane,yaw:Math.atan2(-g.tx,-g.tz)}
}
export const TRACK_MINES=Object.freeze([5,20,37,55,73,89,106,133].map((index,i)=>({id:`track-mine-${i}`,kind:'mine',...trackPose(index,i%2?1.45:-1.45),owner:'track',fixed:true})))
export const TRACK_BARRELS=Object.freeze([13,31,63,82,101,145].map((index,i)=>({id:`track-barrel-${i}`,kind:'barrel',...trackPose(index,i%2?-2.3:2.3),owner:'track',fixed:true})))
export const SUPPLY_PADS=Object.freeze([8,49,92,124].map((index,i)=>({id:`supply-${i}`,...trackPose(index),kind:i%2?'repair':'ammo'})))
export const RACE_HAZARDS=Object.freeze([...TRACK_MINES,...TRACK_BARRELS])
export function initialBattle(){
 return {time:0,health:100,bombs:3,mines:2,weaponCooldown:0,shield:3,stun:0,respawn:0,
  wrecks:0,hits:0,botHits:0,botKnockouts:0,shots:0,serial:0,knockX:0,knockZ:0,
  lastBomb:0,lastMine:0,aiAt:{bolt:7,nova:10,pixel:13},lastSafe:{...SPAWN},
  hazards:RACE_HAZARDS.map(h=>({...h,arm:0,fuse:null,cooldown:0})),supplies:SUPPLY_PADS.map(p=>({...p,cooldown:0})),bursts:[],events:[]}
}
export function segmentGap(a,b,p){
 const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz
 const t=den?cap(((p.x-a.x)*dx+(p.z-a.z)*dz)/den,0,1):0
 return Math.hypot(a.x+t*dx-p.x,a.z+t*dz-p.z)
}
/** Clamp impulses to the road and do not let blast movement grant checkpoints. */
export function safeTrackPoint(point){
 const r=nearestRoad(point),dx=point.x-r.x,dz=point.z-r.z
 if(r.distance<=SAFE_ROAD_HALF_WIDTH)return {x:point.x,z:point.z}
 const k=SAFE_ROAD_HALF_WIDTH/Math.max(r.distance,1e-6)
 return {x:r.x+dx*k,z:r.z+dz*k}
}
export function resetAfterWarp(state,player){
 return {...state,health:100,shield:3,respawn:0,stun:0,knockX:0,knockZ:0,lastSafe:{x:player.x,z:player.z,yaw:player.yaw}}
}
function makeWeapon(state,actor,kind,owner){
 const mine=kind==='mine',distance=mine?-3.1:1.8,fx=-Math.sin(actor.yaw),fz=-Math.cos(actor.yaw)
 const p=safeTrackPoint({x:actor.x+fx*distance,z:actor.z+fz*distance})
 state.serial++
 return {id:`deployed-${state.serial}`,kind,owner,fixed:false,x:p.x,z:p.z,y:mine?.22:.8,
  vx:mine?0:fx*(12+Math.max(0,actor.speed)*.35),vz:mine?0:fz*(12+Math.max(0,actor.speed)*.35),vy:mine?0:5.2,
  arm:mine?.9:.15,fuse:mine?null:1.3,life:mine?18:4,cooldown:0}
}
function available(h){return h.cooldown<=0&&!h.spent}
function damageAt(explosion,actor){
 const radius=explosion.kind==='barrel'?7:explosion.kind==='bomb'?7.5:6
 const d=Math.hypot(actor.x-explosion.x,actor.z-explosion.z)
 if(d>radius)return 0
 return Math.round((explosion.kind==='barrel'?70:explosion.kind==='bomb'?72:58)*(.45+.55*(1-d/radius)))
}
function pushFrom(boom,actor){
 let dx=actor.x-boom.x,dz=actor.z-boom.z,l=Math.hypot(dx,dz)
 if(l<.001){dx=Math.sin(actor.yaw||0);dz=Math.cos(actor.yaw||0);l=1}
 return {x:dx/l*9,z:dz/l*9}
}
/** One bounded step, called ONLY while racing and battle mode is enabled.
 * prev poses enable swept triggers without teleport/fast-travel collisions.
 */
export function stepBattle(previous,player,bots,dt,actions={},options={}){
 const step=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0))
 if(!step)return {battle:previous,player,bots}
 const before=options.previousPlayer||player,oldBots=options.previousBots||bots
 let p={...player},ns=bots.map(n=>({...n}))
 const s={...previous,time:previous.time+step,events:[],aiAt:{...previous.aiAt},
  weaponCooldown:Math.max(0,previous.weaponCooldown-step),shield:Math.max(0,previous.shield-step),stun:Math.max(0,previous.stun-step),
  hazards:previous.hazards.map(h=>({...h})),supplies:previous.supplies.map(p=>({...p,cooldown:Math.max(0,p.cooldown-step)})),
  bursts:previous.bursts.map(b=>({...b,age:b.age+step})).filter(b=>b.age<.85)}
 const recovering=previous.respawn>0
 if(recovering){
  s.respawn=Math.max(0,previous.respawn-step);p={...p,x:before.x,z:before.z,yaw:before.yaw,speed:0}
  if(s.respawn===0){
   p={...p,...s.lastSafe,speed:0,boostTimer:0};s.health=100;s.shield=3;s.stun=0;s.knockX=0;s.knockZ=0
   s.bombs=Math.max(1,s.bombs);s.mines=Math.max(1,s.mines)
   s.events.push({kind:'battle-respawn'})
  }
 }else{
  if(previous.stun>0)p.speed*=Math.exp(-step*3)
  const impulse=Math.hypot(s.knockX,s.knockZ)
  if(impulse>.02){const pos=safeTrackPoint({x:p.x+s.knockX*step,z:p.z+s.knockZ*step});p={...p,...pos}}
  s.knockX*=Math.exp(-step*5);s.knockZ*=Math.exp(-step*5)
 }
 // Tokens are consumed once even while an action is blocked. No held-button spam.
 const bombToken=actions.bomb||0,mineToken=actions.mine||0
 let request=null
 if(bombToken!==s.lastBomb){s.lastBomb=bombToken;request='bomb'}
 if(mineToken!==s.lastMine){s.lastMine=mineToken;if(!request)request='mine'}
 if(request&&!recovering&&s.health>0&&s.weaponCooldown===0){
  const key=request==='bomb'?'bombs':'mines'
  if(s[key]>0&&s.hazards.filter(h=>!h.fixed).length<BATTLE_LIMITS.dynamic){
   s.hazards.push(makeWeapon(s,p,request,'player'));s[key]--;s.weaponCooldown=.8;s.shots++
   s.events.push({kind:request==='bomb'?'bomb-thrown':'mine-dropped'})
  }
 }
 // Each rival has a bounded, deterministic cadence and gives a visible warning.
 if(options.ai!==false&&!recovering&&s.time>5){
  for(let i=0;i<ns.length;i++){
   const n=ns[i]
   if(n.kind!=='racer'||n.health<=0||n.respawn>0||n.stun>0||s.time<(s.aiAt[n.id]??10))continue
   if(s.hazards.filter(h=>!h.fixed).length>=BATTLE_LIMITS.dynamic)break
   const distance=Math.hypot(n.x-p.x,n.z-p.z)
   if(distance<28){
    const dx=p.x-n.x,dz=p.z-n.z,ahead=dx*-Math.sin(n.yaw)+dz*-Math.cos(n.yaw)
    s.hazards.push(makeWeapon(s,n,ahead>2&&distance<20?'bomb':'mine',n.id))
    s.aiAt[n.id]=s.time+8+i*1.2
    s.events.push({kind:'rival-weapon',name:n.name})
   }
  }
 }
 const actors=[...(!recovering&&s.health>0?[{id:'player',...p,previous:before}]:[]),...ns.filter(n=>n.kind==='racer'&&n.health>0&&n.respawn<=0).map(n=>({...n,previous:oldBots.find(o=>o.id===n.id)||n}))]
 // Bots receive a fresh shield as they reappear; wrecked actors never retrigger mines.
 for(const n of ns)if(n.kind==='racer'&&(n.respawn>0||n.health<=0))n.blastShield=s.time+2.5
 const detonate=[]
 for(const h of s.hazards){
  if(h.cooldown>0){
   h.cooldown=Math.max(0,h.cooldown-step)
   if(h.cooldown===0){h.arm=2;h.fuse=null;h.spent=false}
   continue
  }
  const wasArming=h.arm>0
  h.arm=Math.max(0,h.arm-step)
  if(!h.fixed){h.life-=step;if(h.life<=0){h.spent=true;continue}}
  if(h.kind==='bomb'){
   h.vy-=12*step;h.x+=h.vx*step;h.z+=h.vz*step;h.y+=h.vy*step
   const bounded=safeTrackPoint(h);h.x=bounded.x;h.z=bounded.z
   if(h.y<.25){h.y=.25;h.vy=Math.abs(h.vy)*.3;h.vx*=.88;h.vz*=.88}
  }
  if(h.fuse!==null){h.fuse-=step;if(h.fuse<=0)detonate.push(h)}
  else if(!wasArming&&!h.spent){
   const trigger=actors.some(a=>{
    // An armed owner mine is dangerous to its owner too. Respawn shields prevent damage, not triggers.
    if(Math.hypot(a.x-a.previous.x,a.z-a.previous.z)>8)return false
    return segmentGap(a.previous,a,h)<(h.kind==='barrel'?1.8:1.65)
   })
   if(trigger)h.fuse=h.kind==='barrel'?.45:.35
  }
 }
 // Process explosions once, even if several triggers/chain effects happen together.
 const exploded=new Set()
 while(detonate.length&&exploded.size<32){
  const h=detonate.shift()
  if(exploded.has(h.id)||h.spent||h.cooldown>0)continue
  exploded.add(h.id);h.spent=true;h.fuse=null
  s.bursts.push({id:`burst-${s.serial++}`,x:h.x,z:h.z,kind:h.kind,age:0,radius:h.kind==='bomb'?7.5:h.kind==='barrel'?7:6})
  s.events.push({kind:'explosion',source:h.kind})
  // A half-second shield prevents one chain reaction consuming several lives.
  const damage=!recovering&&s.health>0&&s.shield<=0?damageAt(h,p):0
  if(damage){
   s.health=Math.max(0,s.health-damage);s.hits++;s.shield=.55;s.stun=.65
   const impulse=pushFrom(h,p);s.knockX=impulse.x;s.knockZ=impulse.z
   p.speed*=.35;p.boostTimer=0
   s.events.push({kind:'player-blast',damage})
   if(s.health===0){s.respawn=2.5;s.wrecks++;p.speed=0;s.knockX=s.knockZ=0;s.events.push({kind:'player-wreck'})}
  }
  for(let i=0;i<ns.length;i++){
   const n=ns[i]
   if(n.kind!=='racer'||n.health<=0||n.respawn>0||(n.blastShield||0)>s.time)continue
   const amount=damageAt(h,n);if(!amount)continue
   const impulse=pushFrom(h,n),pos=safeTrackPoint({x:n.x+impulse.x*.08,z:n.z+impulse.z*.08})
   const hp=Math.max(0,n.health-amount);s.botHits++
   ns[i]={...n,...pos,health:hp,hitCooldown:1.1,blastShield:s.time+.55,stun:hp>0?.75:0,
    blastOffsetX:pos.x-n.x,blastOffsetZ:pos.z-n.z,respawn:hp===0?5:0,burst:hp===0?.72:0}
   if(hp===0){s.botKnockouts++;if(h.owner==='player'){p.botsDefeated=(p.botsDefeated||0)+1;p.rivalKnockouts=(p.rivalKnockouts||0)+1;p.smashScore=(p.smashScore||0)+100}s.events.push({kind:'blast-knockout',name:n.name})}
  }
  // Only barrels chain-react; the visual warning gives nearby drivers time to evade.
  for(const barrel of s.hazards){
   if(barrel.kind==='barrel'&&available(barrel)&&barrel.arm<=0&&barrel.fuse===null&&Math.hypot(h.x-barrel.x,h.z-barrel.z)<7.5)barrel.fuse=.2
  }
  if(h.fixed){h.cooldown=16;h.spent=false}
 }
 s.bursts=s.bursts.slice(-BATTLE_LIMITS.bursts)
 s.hazards=s.hazards.filter(h=>!h.spent)
 // Supplies are per player. Repairs and ammunition have independent cooldown pads.
 if(!recovering&&s.health>0)for(const pad of s.supplies){
  if(pad.cooldown>0||segmentGap(before,p,pad)>2.1)continue
  if(pad.kind==='repair'&&s.health<100){s.health=Math.min(100,s.health+40);pad.cooldown=12;s.events.push({kind:'repair'})}
  if(pad.kind==='ammo'&&(s.bombs<BATTLE_LIMITS.bombs||s.mines<BATTLE_LIMITS.mines)){
   s.bombs=Math.min(BATTLE_LIMITS.bombs,s.bombs+2);s.mines=Math.min(BATTLE_LIMITS.mines,s.mines+1);pad.cooldown=12;s.events.push({kind:'ammo'})
  }
 }
 // Safe recovery is a recent genuinely driven position, never a shortcut forward.
 if(!recovering&&s.health>0&&s.time%1<step&&s.stun===0&&!s.hazards.some(h=>available(h)&&Math.hypot(h.x-p.x,h.z-p.z)<9))s.lastSafe={x:p.x,z:p.z,yaw:p.yaw}
 return {battle:s,player:p,bots:ns}
}
