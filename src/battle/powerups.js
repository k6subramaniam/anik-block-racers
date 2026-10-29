/** Deterministic arcade power-ups. Spawn/respawn rules are gameplay only. */
import {atDistance,battleTrack,segmentDistance} from './tracks.js'
export const TURBO_DURATION=2.8
export const TURBO_TOP_SPEED=43
export const TURBO_RECHARGE=13
export const AUTO_BURST_INTERVAL=37*60
export const POWERUP_INTERVAL=12
export const POWERUP_RESPAWN=15
export const POWERUP_COUNT=8
export function createPowerups(trackId){
  const track=battleTrack(trackId)
  return Array.from({length:POWERUP_COUNT},(_,i)=>{
    const fraction=(i+.62)/POWERUP_COUNT,position=atDistance(track,track.length*fraction,i%2?1.65:-1.65)
    return {id:`turbo-${i}`,x:position.x,y:position.y,z:position.z,cooldown:0}
  })
}
export function activateTurbo(actor,seconds=TURBO_DURATION){
  return {...actor,turbo:Math.max(actor.turbo||0,seconds*(actor.turboFactor||1)),speed:Math.min(TURBO_TOP_SPEED,Math.max(actor.speed,29)),turboCount:(actor.turboCount||0)+1}
}
export function advancePowerups(state,oldActors,dt){
  const pickups=[]
  state.powerups=state.powerups.map(p=>{
    const cooldown=Math.max(0,p.cooldown-dt)
    if(cooldown>0)return {...p,cooldown}
    const index=state.actors.findIndex((a,i)=>a.hp>0&&a.respawn<=0&&!a.finished&&Math.abs(a.y-p.y)<2.5&&
      Math.hypot(a.x-(oldActors[i]?.x??a.x),a.z-(oldActors[i]?.z??a.z))<4&&
      segmentDistance(oldActors[i]||a,a,p)<2.5)
    if(index<0)return {...p,cooldown:0}
    const a=state.actors[index]
    state.actors[index]=activateTurbo(a)
    state.events.push({kind:'turbo-pickup',actor:a.id})
    pickups.push(a.id)
    return {...p,cooldown:POWERUP_RESPAWN}
  })
  // Occasional bonus turbo is predictable per race rather than random or paid.
  if(state.tick>0&&state.tick%AUTO_BURST_INTERVAL===0){
    for(let i=0;i<state.actors.length;i++){
      const a=state.actors[i]
      if(a.hp<=0||a.respawn>0||a.finished)continue
      state.actors[i]=activateTurbo(a,1.8)
      state.events.push({kind:'turbo-bonus',actor:a.id})
    }
  }
  return pickups
}
