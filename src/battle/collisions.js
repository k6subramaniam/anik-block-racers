/** Symmetric equal-mass arcade contacts; both player and AI use this solver.
 * Height gating prevents cars on stacked road decks colliding through the bridge.
 */
import {nearestOnTrack} from './tracks.js'
export const KART_RADIUS=1.12
const active=a=>a.hp>0&&a.respawn<=0&&!a.finished
const dot=(a,b)=>a.x*b.x+a.z*b.z
const velocity=a=>({x:-Math.sin(a.yaw)*a.speed+(a.kickX||0),z:-Math.cos(a.yaw)*a.speed+(a.kickZ||0)})
function bounded(actor,track){
 const p=nearestOnTrack(track,actor),limit=track.width/2-.95
 if(p.distance>limit){actor.x=p.x+(actor.x-p.x)/p.distance*limit;actor.z=p.z+(actor.z-p.z)/p.distance*limit}
 actor.y=p.y;actor.s=p.s;actor.grade=p.grade
}
function applyVelocity(a,v){
 const forward={x:-Math.sin(a.yaw),z:-Math.cos(a.yaw)},speed=dot(v,forward)
 a.speed=Math.max(-8,Math.min(a.topSpeed||27,speed))
 a.kickX=v.x-forward.x*a.speed;a.kickZ=v.z-forward.z*a.speed
 a.slipX=forward.x*a.speed;a.slipZ=forward.z*a.speed
}
function closestRelative(oldA,oldB,a,b){
 const x0=oldB.x-oldA.x,z0=oldB.z-oldA.z,dx=(b.x-a.x)-x0,dz=(b.z-a.z)-z0,len=dx*dx+dz*dz
 const t=len>1e-9?Math.max(0,Math.min(1,-(x0*dx+z0*dz)/len)):1
 return {x:x0+t*dx,z:z0+t*dz,t,distance:Math.hypot(x0+t*dx,z0+t*dz)}
}
export function resolveVehicleContacts(actors,previous,track,tick=0,pairCooldowns={}){
 const out=actors.map(a=>({...a})),events=[],locks={...pairCooldowns},range=KART_RADIUS*2
 for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
  const a=out[i],b=out[j],oldA=previous.find(p=>p.id===a.id)||a,oldB=previous.find(p=>p.id===b.id)||b
  if(!active(a)||!active(b)||Math.abs((a.y||0)-(b.y||0))>1.7)continue
  // Teleport recovery is not a swept collision. It may still resolve overlap.
  const canSweep=Math.hypot(a.x-oldA.x,a.z-oldA.z)<3&&Math.hypot(b.x-oldB.x,b.z-oldB.z)<3
  const closest=closestRelative(oldA,oldB,a,b),dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz)
  if(dist>=range&&(!canSweep||closest.distance>=range))continue
  let nx=dx,nz=dz,len=dist
  // At high speed use the pre-crossing normal, not the already-reversed endpoints.
  if(canSweep&&closest.distance<range&&closest.t<1){nx=oldB.x-oldA.x;nz=oldB.z-oldA.z;len=Math.hypot(nx,nz)}
  if(len<1e-7){nx=Math.cos(a.yaw);nz=-Math.sin(a.yaw);len=1}
  nx/=len;nz/=len
  const va=velocity(a),vb=velocity(b),closing=(va.x-vb.x)*nx+(va.z-vb.z)*nz
  const penetration=Math.max(0,range-((b.x-a.x)*nx+(b.z-a.z)*nz))
  if(penetration>0){
    const correction=Math.min(range,penetration+.015)/2
    a.x-=nx*correction;a.z-=nz*correction;b.x+=nx*correction;b.z+=nz*correction
  }
  if(closing>0){
    const impulse=closing*.56
    applyVelocity(a,{x:va.x-nx*impulse,z:va.z-nz*impulse})
    applyVelocity(b,{x:vb.x+nx*impulse,z:vb.z+nz*impulse})
  }
  const key=[a.id,b.id].sort().join('|')
  if(closing>3.5&&(locks[key]||0)<=tick){
    locks[key]=tick+40
    const damage=Math.min(34,Math.max(3,Math.round((closing-2)*1.5)))
    for(const [target,other] of [[a,b],[b,a]]){
      target.crashes=(target.crashes||0)+1
      const dealt=target.shield>0?0:Math.min(target.hp,damage)
      if(dealt){
        target.hp-=dealt;target.damageTaken+=dealt;target.collisionDamage=(target.collisionDamage||0)+dealt
        other.damageDealt=(other.damageDealt||0)+dealt
        if(target.hp===0)other.knockouts=(other.knockouts||0)+1
        target.contactStun=.18;target.shield=Math.max(target.shield,.3)
        if(target.hp===0){target.respawn=2;target.speed=0;target.kickX=0;target.kickZ=0}
      }
      events.push({kind:target.hp===0?'knockout':'crash',actor:target.id,other:other.id,damage:dealt,speed:closing,source:'collision'})
    }
  }
  bounded(a,track);bounded(b,track)
 }
 for(const key of Object.keys(locks))if(locks[key]<tick-120)delete locks[key]
 return {actors:out,events,pairCooldowns:locks}
}
