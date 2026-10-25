/** Deterministic, budget-friendly arcade NPC AI. No backend or network inference:
 * racers follow real 3D terrain roads while voxel wildlife wanders and flees.
 * All distances are in metres. Defeated bots burst into cubes and respawn.
 */
import { TRACK } from './track.js'

const RACE_ARC = [0]
for (let i=0;i<TRACK.length;i++) {
  const a=TRACK[i], b=TRACK[(i+1)%TRACK.length]
  RACE_ARC.push(RACE_ARC[i]+Math.hypot(b.x-a.x,b.z-a.z))
}
export const TRACK_LENGTH = RACE_ARC[RACE_ARC.length-1]

export const RIVALS=Object.freeze([
  {id:'bolt',name:'BOLT',kind:'racer',color:'#f97338',index:113,speed:17.4,lane:-.9,radius:1.24,maxHp:105},
  {id:'nova',name:'NOVA',kind:'racer',color:'#c15dff',index:119,speed:19.0,lane:.75,radius:1.24,maxHp:105},
  {id:'pixel',name:'PIXEL',kind:'racer',color:'#47daf5',index:125,speed:18.1,lane:0,radius:1.24,maxHp:105},
])

export const CRITTERS=Object.freeze([
  {id:'fox',name:'PIXEL FOX',kind:'animal',species:'fox',color:'#ff9848',home:{x:13,z:-43},radius:.95,maxHp:45,speed:2.4},
  {id:'boar',name:'BLOCK BOAR',kind:'animal',species:'boar',color:'#c98c63',home:{x:30,z:-47},radius:1.05,maxHp:55,speed:2.2},
  {id:'sheep',name:'CLOUD SHEEP',kind:'animal',species:'sheep',color:'#e6e8f5',home:{x:-33,z:-40},radius:.95,maxHp:40,speed:1.8},
  {id:'crystal',name:'CRYSTAL CUB',kind:'animal',species:'cub',color:'#55dcf8',home:{x:-91,z:-42},radius:1.1,maxHp:52,speed:2.2},
  {id:'neon',name:'NEON FOX',kind:'animal',species:'fox',color:'#e64ddc',home:{x:92,z:-40},radius:.95,maxHp:45,speed:2.6},
  {id:'canyon',name:'DUNE BOAR',kind:'animal',species:'boar',color:'#dfb16b',home:{x:-96,z:47},radius:1.05,maxHp:55,speed:2.0},
  {id:'ember',name:'EMBER CUB',kind:'animal',species:'cub',color:'#fc6741',home:{x:89,z:62},radius:1.1,maxHp:52,speed:2.2},
  {id:'grove',name:'MOSS SHEEP',kind:'animal',species:'sheep',color:'#a5df80',home:{x:16,z:-91},radius:.95,maxHp:40,speed:1.7},
])

const PATHS=[
  [{x:5,z:-39},{x:30,z:-42},{x:62,z:-38},{x:104,z:-55},{x:110,z:-83},{x:68,z:-72},{x:24,z:-55}],
  [{x:-12,z:-40},{x:-48,z:-35},{x:-82,z:-50},{x:-109,z:-64},{x:-117,z:-42},{x:-65,z:-23},{x:-19,z:-22}],
  [{x:15,z:38},{x:65,z:41},{x:98,z:70},{x:108,z:84},{x:52,z:60},{x:-12,z:36},{x:-66,z:60},{x:-102,z:82},{x:-56,z:45}],
]
function pathLength(path) {
  const sums=[0]
  for(let i=0;i<path.length;i++){
    const a=path[i],b=path[(i+1)%path.length]
    sums.push(sums[i]+Math.hypot(b.x-a.x,b.z-a.z))
  }
  return sums
}
const PATROL_ARCS=PATHS.map(pathLength)

function along(points,arcs,metres,lane=0) {
  const length=arcs[arcs.length-1]
  const d=((metres%length)+length)%length
  let i=0
  while(i<points.length-1&&arcs[i+1]<=d)i++
  const a=points[i],b=points[(i+1)%points.length]
  const segment=arcs[i+1]-arcs[i]
  const t=segment>0?(d-arcs[i])/segment:0
  const dx=(b.x-a.x)/Math.max(segment,.00001),dz=(b.z-a.z)/Math.max(segment,.00001)
  return {x:a.x+(b.x-a.x)*t-dz*lane,z:a.z+(b.z-a.z)*t+dx*lane,yaw:Math.atan2(-dx,-dz),tangentX:dx,tangentZ:dz}
}
export function trackAt(distance,lane=0){return along(TRACK,RACE_ARC,distance,lane)}

export function makeNpcs(mode='race') {
  const racers=RIVALS.map((def,i)=>{
    const arc=mode==='race'?RACE_ARC[def.index]:0
    const distance=mode==='race'?arc:12+i*20
    const at=mode==='race'?trackAt(distance,def.lane):along(PATHS[i],PATROL_ARCS[i],distance,def.lane)
    return {...def,...at,home:undefined,travel:distance,speed:def.speed,health:def.maxHp,hitCooldown:0,respawn:0,burst:0,stun:0,laps:0}
  })
  if(mode!=='explore')return racers
  const animals=CRITTERS.map((def,i)=>({
    ...def,x:def.home.x,z:def.home.z,yaw:i*.6,travel:i*.9,
    health:def.maxHp,hitCooldown:0,respawn:0,burst:0,stun:0,
  }))
  return [...racers,...animals]
}

export function advanceNpcs(npcs,dt,player,mode='race') {
  const step=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0))
  if(step<=0)return npcs
  return npcs.map(n=>{
    let hitCooldown=Math.max(0,n.hitCooldown-step)
    let stun=Math.max(0,(n.stun||0)-step)
    let burst=Math.max(0,(n.burst||0)-step)
    if(n.respawn>0){
      const respawn=Math.max(0,n.respawn-step)
      if(respawn>0)return {...n,hitCooldown,stun,burst,respawn}
      // Respawning restores the same actor. Destroyed bot score is not lost.
      const home=n.kind==='racer'
        ?mode==='race'?trackAt(n.travel,n.lane):along(PATHS[RIVALS.findIndex(x=>x.id===n.id)],PATROL_ARCS[RIVALS.findIndex(x=>x.id===n.id)],n.travel,n.lane)
        :{x:n.home.x,z:n.home.z,yaw:n.yaw}
      return {...n,...home,health:n.maxHp,respawn:0,burst:0,stun:0,hitCooldown:1.35}
    }
    if(n.kind==='racer'){
      const i=RIVALS.findIndex(r=>r.id===n.id)
      const path=mode==='race'?TRACK:PATHS[i]
      const arc=mode==='race'?RACE_ARC:PATROL_ARCS[i]
      const pathLen=arc[arc.length-1]
      const targetSpeed=n.speed*(1+.05*Math.sin(n.travel*.038+i*1.8))
      const advance=stun>0?0:targetSpeed*step
      const travel=n.travel+advance
      const wasLap=Math.floor(n.travel/pathLen),nowLap=Math.floor(travel/pathLen)
      const pose=along(path,arc,travel,n.lane)
      return {...n,...pose,travel,laps:n.laps+Math.max(0,nowLap-wasLap),hitCooldown,stun,burst}
    }
    // Wildlife returns to home territory, but flees from nearby fast cars.
    const age=n.travel+step
    const dx=n.x-player.x,dz=n.z-player.z
    const playerDist=Math.hypot(dx,dz)
    const homeDist=Math.hypot(n.x-n.home.x,n.z-n.home.z)
    let targetX=n.home.x+Math.sin(age*.45+n.name.length)*5.2
    let targetZ=n.home.z+Math.cos(age*.37+n.name.length)*5.2
    let speed=n.speed
    if(homeDist>12){targetX=n.home.x;targetZ=n.home.z}
    else if(playerDist<11 && playerDist>.03){
      targetX=n.x+dx/playerDist*13;targetZ=n.z+dz/playerDist*13;speed=n.speed+2.4
    }
    const ux=targetX-n.x,uz=targetZ-n.z,dd=Math.hypot(ux,uz)
    if(dd<.05)return {...n,travel:age,hitCooldown,stun,burst}
    const reach=Math.min(dd,speed*step)
    const yaw=Math.atan2(-ux,-uz)
    return {...n,x:n.x+ux/dd*reach,z:n.z+uz/dd*reach,yaw,travel:age,hitCooldown,stun,burst}
  })
}

export function applyRamming(player,npcs,dt=0.016) {
  const cars=[]
  let outcome=null, racerKnockouts=0, animalKnockouts=0, points=0
  let nextPlayer=player
  for(const n of npcs){
    if(n.respawn>0||n.health<=0){cars.push(n);continue}
    const dx=n.x-nextPlayer.x,dz=n.z-nextPlayer.z
    const distance=Math.hypot(dx,dz)
    const contact=n.radius+.84
    if(distance>contact){cars.push(n);continue}
    const ux=distance>.0001?dx/distance:Math.sin(n.yaw)
    const uz=distance>.0001?dz/distance:Math.cos(n.yaw)
    // Only a forward moving PLAYER ram deals damage: stationary or grazing
    // collisions are harmless. The opponent can still be a physical obstacle.
    const pvx=-Math.sin(nextPlayer.yaw)*nextPlayer.speed
    const pvz=-Math.cos(nextPlayer.yaw)*nextPlayer.speed
    const nvx=-Math.sin(n.yaw)*(n.kind==='racer'&&n.stun<=0?n.speed:0)
    const nvz=-Math.cos(n.yaw)*(n.kind==='racer'&&n.stun<=0?n.speed:0)
    const closing=(pvx-nvx)*ux+(pvz-nvz)*uz
    // Catch-up crashes into moving rival karts should still hurt them even
    // when both racers travel in the same direction at similar speeds.
    const minimumClosing=n.kind==='racer'?2.25:5
    const canHit=(nextPlayer.speed>7 && closing>=minimumClosing && n.hitCooldown<=0)
    const correction=Math.min(1.1,Math.max(0,contact-distance+.06))
    const trial={...nextPlayer,x:nextPlayer.x-ux*correction,z:nextPlayer.z-uz*correction}
    nextPlayer={...trial,speed:nextPlayer.speed*(canHit?.52:.86)}
    if(!canHit){cars.push(n);continue}
    const damage=Math.max(16,Math.min(105,Math.round(16+(closing-2)*(n.kind==='animal'?6.2:5.5))))
    const health=Math.max(0,n.health-damage)
    const destroyed=health===0
    cars.push({...n,health,hitCooldown:1.1,stun:destroyed?0:.36,
      respawn:destroyed?11:0,burst:destroyed?.72:0})
    const reward=destroyed?(n.kind==='racer'?100:40):0
    points+=reward
    if(destroyed){if(n.kind==='racer')racerKnockouts++;else animalKnockouts++}
    if(!outcome)outcome={kind:destroyed?'npc-smash':'npc-hit',npcName:n.name,npcKind:n.kind,damage,health,points:reward}
  }
  if(!outcome)return {player:nextPlayer,npcs:cars,event:null,points:0,racerKnockouts:0,animalKnockouts:0}
  return {player:nextPlayer,npcs:cars,event:outcome,points,racerKnockouts,animalKnockouts}
}
