/** Stunt pads, cartoon breakable blocks, and trick combos. Pure simulation. */
import {atDistance,segmentDistance,battleTrack} from '../battle/tracks.js'
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
export const MAX_STUNT_PROPS=20
export function createStuntWorld(trackId){
  const track=battleTrack(trackId)
  const pads=[.13,.41,.68,.88].map((f,i)=>({...atDistance(track,track.length*f,i%2?1.7:-1.7),id:`ramp-${i}`,kind:'ramp',cooldown:0}))
  const props=Array.from({length:12},(_,i)=>({...atDistance(track,track.length*(i+.72)/12,i%2?2.65:-2.65),id:`block-${i}`,kind:'block',cooldown:0,variant:i%4}))
  return {pads,props,bursts:[]}
}
const actionable=a=>a.hp>0&&a.respawn<=0&&!a.finished
const atSameHeight=(a,p)=>Math.abs((a.y||0)-(p.y||0))<2.3
function award(actor,base,tick,type,state){
  const chain=tick-(actor.lastStuntTick||-9999)<=300?Math.min(5,(actor.stuntCombo||1)+1):1
  const points=base*chain
  actor.stuntScore=(actor.stuntScore||0)+points;actor.stuntCombo=chain;actor.bestStuntCombo=Math.max(actor.bestStuntCombo||1,chain);actor.lastStuntTick=tick
  state.events.push({kind:type,actor:actor.id,points,combo:chain})
}
export function advanceStunts(state,previous,dt){
  if(!state.stunts)return
  const world=state.stunts
  world.bursts=world.bursts.map(b=>({...b,age:b.age+dt})).filter(b=>b.age<.85).slice(-24)
  const live=state.actors
  for(let i=0;i<live.length;i++){
    const a=live[i],old=previous.actors[i]
    a.stuntCombo=state.tick-(a.lastStuntTick||-9999)>300?1:(a.stuntCombo||1)
    if(!actionable(a))continue
    const prior=old.air||{lift:0,vy:0,time:0,spin:0}
    if(prior.lift>0||prior.vy>0){
      const vy=prior.vy-15*dt,lift=Math.max(0,prior.lift+vy*dt)
      const spin=prior.spin+(i===0?(state.playerSteer||0)*dt*5:dt*1.9)
      a.air={lift,vy,time:prior.time+dt,spin}
      a.y=(a.y||0)+lift
      if(lift===0&&prior.lift>.001){
        const turns=Math.floor(Math.abs(spin)/(Math.PI*2)),base=120+turns*160+Math.floor(prior.time*90)
        award(a,base,state.tick,'stunt-land',state)
        world.bursts.push({x:a.x,y:a.y,z:a.z,age:0,kind:'land'})
        a.air={lift:0,vy:0,time:0,spin:0}
      }
    }else a.air={lift:0,vy:0,time:0,spin:0}
    if(a.air.lift===0&&a.air.vy<=0&&Math.abs(a.speed)>9){
      for(const p of world.pads){
        if(p.cooldown>0||!atSameHeight(a,p)||segmentDistance(old,a,p)>2)continue
        a.air={lift:.03,vy:8.4+Math.min(3,Math.abs(a.speed)*.11),time:0,spin:0};a.y+=.03
        p.cooldown=6
        state.events.push({kind:'stunt-launch',actor:a.id})
        break
      }
    }
    if(a.air.lift>.4)continue
    for(const prop of world.props){
      if(prop.cooldown>0||!atSameHeight(a,prop)||segmentDistance(old,a,prop)>1.9||Math.abs(a.speed)<9)continue
      prop.cooldown=18
      const magnitude=Math.abs(a.speed)
      a.speed*=.86
      award(a,80+Math.min(120,Math.round(magnitude*3)),state.tick,'stunt-smash',state)
      world.bursts.push({x:prop.x,y:prop.y,z:prop.z,age:0,kind:'smash'})
      break
    }
  }
  for(const p of world.pads)p.cooldown=clamp(p.cooldown-dt,0,100)
  for(const p of world.props)p.cooldown=clamp(p.cooldown-dt,0,100)
}
