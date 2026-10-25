/** Original, bounded open-world expansion (metres in Three.js x/z coordinates).
 * Landmark meshes are authored in the Higgsfield 3D scene; this file defines
 * their gameplay locations without coupling deterministic tests to WebGL.
 */
import { moveKart, SPAWN } from './simulation.js'

export const WORLD_BOUNDS = Object.freeze({minX:-151,maxX:151,minZ:-126,maxZ:126})
export const EXPLORE_SPAWN = Object.freeze({x:5,z:-37,yaw:0})

export const ZONES = Object.freeze([
  {id:'city',name:'NEON CITY',label:'Skyline district',icon:'◆',color:'#fa62da',x:105,z:-57,radius:30,spawn:{x:105,z:-52,yaw:0}},
  {id:'crystal',name:'CRYSTAL RIDGE',label:'Ice crystal highlands',icon:'✦',color:'#74edff',x:-105,z:-62,radius:30,spawn:{x:-105,z:-60,yaw:0}},
  {id:'canyon',name:'SUNSET CANYON',label:'Temple and stone mesas',icon:'▲',color:'#ffc176',x:-107,z:79,radius:30,spawn:{x:-105,z:78,yaw:Math.PI/2}},
  {id:'ember',name:'EMBER PEAKS',label:'Lava volcano and dragon',icon:'♨',color:'#ff7452',x:104,z:78,radius:30,spawn:{x:102,z:76,yaw:-Math.PI/2}},
  {id:'grove',name:'PORTAL GROVE',label:'Ancient jump portal',icon:'◎',color:'#b4ff8b',x:0,z:-106,radius:24,spawn:{x:0,z:-91,yaw:0}},
])

// Navigable, individually collectible artifacts, at accessible ground-level positions.
export const RELICS = Object.freeze(ZONES.map(zone=>({
  id:'relic-'+zone.id,
  x:zone.id==='grove'?0:zone.x,
  z:zone.id==='grove'?-94:zone.z,
  zoneId:zone.id,color:zone.color,
})))

// Collision silhouettes for Higgsfield landmark parts; a lightweight circles-vs-kart
// resolution runs without a second expensive per-polygon physics mesh.
export const LANDMARK_OBSTACLES = Object.freeze([
  ...[[85,-73],[125,-74],[85,-40],[125,-40]].map(([x,z],i)=>({id:'city-tower-'+i,x,z,radius:7.5})),
  {id:'neon-robot',x:104,z:-94,radius:5},
  ...[[-126,-77],[-113,-86],[-94,-84],[-81,-71],[-126,-50],[-83,-46]].map(([x,z],i)=>({id:'crystal-'+i,x,z,radius:3.5})),
  {id:'glacier',x:-135,z:-85,radius:7.5},
  {id:'sunset-temple',x:-128,z:84,radius:12},
  {id:'canyon-rock-1',x:-97,z:62,radius:4.5},
  {id:'canyon-rock-2',x:-85,z:81,radius:4.5},
  {id:'canyon-rock-3',x:-117,z:55,radius:4.5},
  {id:'giant-cactus',x:-90,z:48,radius:2.6},
  {id:'ember-volcano',x:120,z:94,radius:19.5},
  {id:'ember-dragon',x:90,z:107,radius:6},
  {id:'portal-column-left',x:-7,z:-106,radius:1.9},
  {id:'portal-column-right',x:7,z:-106,radius:1.9},
])

export function zoneAt(pos) {
  return ZONES.find(z=>Math.hypot(pos.x-z.x,pos.z-z.z) <= z.radius) || null
}

export function clampWorld(pos,bounds=WORLD_BOUNDS) {
  return {
    x:Math.max(bounds.minX,Math.min(bounds.maxX,pos.x)),
    z:Math.max(bounds.minZ,Math.min(bounds.maxZ,pos.z)),
    blocked:pos.x<bounds.minX||pos.x>bounds.maxX||pos.z<bounds.minZ||pos.z>bounds.maxZ,
  }
}

export function mapPosition(pos,width=240,height=190,bounds=WORLD_BOUNDS){
  return {
    x:Math.max(0,Math.min(width,(pos.x-bounds.minX)/(bounds.maxX-bounds.minX)*width)),
    y:Math.max(0,Math.min(height,(pos.z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*height)),
  }
}

export function initialExploreState(){
  return {
    ...EXPLORE_SPAWN,speed:0,elapsed:0,lap:1,checkpoint:0,bestLap:null,lastLapStart:0,
    collisions:0,event:null,coins:0,boostTimer:0,boostCooldown:0,
    collected:[],visited:[],zoneName:'VOXEL WILDS',portalCooldown:0,
  }
}

export function fastTravel(state,zoneId){
  const dest=ZONES.find(z=>z.id===zoneId)
  if(!dest)return state
  return {...state,...dest.spawn,speed:0,event:'travel',portalCooldown:3,zoneName:dest.name}
}

/** Move in free-roam only. Never modifies race/lap progress. */
export function advanceExplore(state,input,dt,obstacles=[]){
  const delta=Math.min(Math.max(0,dt),.05)
  const moved=moveKart(state,input,delta,obstacles,{mode:'explore',bounds:WORLD_BOUNDS})
  let next={...moved,elapsed:state.elapsed+delta,portalCooldown:Math.max(0,(state.portalCooldown||0)-delta)}
  const region=zoneAt(next)
  next.zoneName=region?.name||'VOXEL WILDS'
  if(region && !state.visited.includes(region.id)){
    next.visited=[...state.visited,region.id]
    next.event='discovery'
  }
  for(const item of RELICS){
    if(next.collected.includes(item.id))continue
    if(Math.hypot(next.x-item.x,next.z-item.z)<3.2){
      next.collected=[...next.collected,item.id]
      next.coins=(next.coins||0)+5
      next.event='relic'
      break
    }
  }
  // Crossing the portal from the grove side returns to the familiar race hub.
  if(next.portalCooldown<=0 && Math.abs(next.x)<4 && state.z>=-107 && next.z< -107){
    next={...next,x:SPAWN.x,z:SPAWN.z,yaw:0,speed:0,portalCooldown:5,event:'portal',zoneName:'VOXEL VALLEY'}
  }
  // Lava is a collision hazard rather than a traversable road.
  if(Math.hypot(next.x-120,next.z-118)<10.5){
    next={...next,x:102,z:76,speed:0,portalCooldown:3,event:'lava'}
  }
  return next
}
