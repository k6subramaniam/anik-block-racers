/** Original blocky pedestrian AI for Blockhaven and nearby biomes.
 * Waypoint movement, gentle traffic avoidance and conversations happen locally
 * on the Samsung device. No external inference, tracking, or NPC violence.
 * All coordinates are metres in the same x/z system as the kart and GLB.
 */
export const PEDESTRIAN_PATHS = Object.freeze({
  villageStreet:[[-63,-28],[-63,-16],[-54,-5],[-48,0],[-60,0],[-76,0],[-87,0],[-74,0],[-60,0],[-55,6],[-55,15],[-63,27],[-63,17],[-55,5],[-63,-5]],
  villageSquare:[[-72,-8],[-53,-8],[-53,1],[-74,1],[-72,-8]],
  villageMarket:[[-62,-26],[-62,-32],[-75,-30],[-78,-26],[-77,-14],[-68,-12],[-63,-22]],
  farmTrail:[[-111,25],[-115,14],[-106,8],[-92,8],[-91,20],[-101,25],[-111,25]],
  forestTrail:[[-105,-40],[-100,-45],[-87,-44],[-82,-29],[-97,-26],[-105,-40]],
  villageEast:[[-49,0],[-46,-8],[-51,-26],[-61,-29],[-61,-15],[-57,-7],[-49,0]],
  cityWalk:[[101,-53],[110,-53],[117,-59],[113,-66],[102,-64],[99,-58]],
  groveWalk:[[-4,-91],[8,-90],[11,-100],[0,-103],[-6,-98]],
})

const LINES={
  builder:'These oak houses are made from stacked blocks. The new road leads to Crystal Ridge!',
  farmer:'Welcome! The golden wheat is ready. Take a stroll past my fields and the stone well.',
  merchant:'Fresh crops and bright crystals! Visit the market stalls north of the village.',
  guard:'Blockhaven is safe for explorers. Slow down when you see villagers crossing the path.',
  blacksmith:'The forge is hot. Race your rivals, then stop here to cool down and explore.',
  baker:'The smell of block bread brings everyone to our little village square.',
  librarian:'Six districts to discover. Open your map to travel across the realm.',
  explorer:'The portal grove is full of mysteries. Look for the glowing relics.',
  cartographer:'I have mapped the crystal falls, desert temple and the lava dragon.',
  gardener:'Our square trees are enormous! Their leaf blocks glow in the afternoon.',
  engineer:'Watch the Neon City towers. Our robots are only models, not enemies.',
  mystic:'The portal can send a racer back to Voxel Valley in a flash.',
}
const DEFS=[
  ['ada','ADA','builder','villageStreet','#52aeeb','#b6744a','#694030',1.25],
  ['moss','MOSS','farmer','farmTrail','#98c75f','#dcaa7f','#806443',1.05],
  ['tavi','TAVI','merchant','villageMarket','#efad42','#aa7555','#693d24',1.2],
  ['ari','ARI','guard','villageSquare','#7398dc','#bd8967','#233049',1.42],
  ['jun','JUN','blacksmith','villageStreet','#a8a8b3','#946445','#3a3033',1.22],
  ['pip','PIP','baker','villageSquare','#f4d3ab','#cb9974','#ba7b4d',1.0],
  ['sol','SOL','librarian','villageEast','#9677c8','#e1ad84','#5d4538',1.1],
  ['noor','NOOR','explorer','forestTrail','#35b19f','#a87559','#393b44',1.5],
  ['bea','BEA','cartographer','villageMarket','#f39b96','#d1a17c','#74433c',1.16],
  ['mira','MIRA','gardener','farmTrail','#b7d169','#956a50','#aa7b41',1.02],
  ['coda','CODA','engineer','cityWalk','#43c9ef','#c29472','#38455a',1.3],
  ['lyra','LYRA','mystic','groveWalk','#bb74e9','#cf9d8d','#4c3472',1.16],
].map(([id,name,role,route,tunic,skin,hat,walkSpeed])=>({
   id,name,role,route,tunic,skin,hat,walkSpeed,
   dialogue:LINES[role],
 }))
export const VILLAGERS=Object.freeze(DEFS)

// Distance to the full walking path, not just its next corner. This avoids
// trapping a pedestrian when a long street segment has distant waypoints.
function distanceToPath(x,z,path){
  let nearest=Infinity
  for(let i=0;i<path.length;i++){
    const a=path[i],b=path[(i+1)%path.length]
    const dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz
    const t=den?Math.min(1,Math.max(0,((x-a[0])*dx+(z-a[1])*dz)/den)):0
    nearest=Math.min(nearest,Math.hypot(x-(a[0]+t*dx),z-(a[1]+t*dz)))
  }
  return nearest
}

export function makeVillagers(){
  return VILLAGERS.map((def,i)=>{
    const path=PEDESTRIAN_PATHS[def.route]
    const start=i%path.length
    return {...def,x:path[start][0],z:path[start][1],yaw:i*.4,
      targetIndex:(start+1)%path.length,idle:0,walking:false,walkCycle:i*.8,
      wanderDistance:0}
  })
}

export function advanceVillagers(villagers,dt,player){
  const step=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0))
  if(step<=0)return villagers
  return villagers.map(v=>{
    const path=PEDESTRIAN_PATHS[v.route]
    let targetIndex=v.targetIndex,idle=Math.max(0,v.idle-step)
    let dx=path[targetIndex][0]-v.x,dz=path[targetIndex][1]-v.z
    const distance=Math.hypot(dx,dz)
    if(distance<.45){
      targetIndex=(targetIndex+1)%path.length
      idle=v.idle>0?idle:.32+((v.id.length+targetIndex)%4)*.23
      dx=path[targetIndex][0]-v.x
      dz=path[targetIndex][1]-v.z
    }
    // Human-shaped villagers are friendly: they dodge approaching karts and
    // cannot be harmed or counted in the crash-bot system.
    const awayX=v.x-(player?.x??10000),awayZ=v.z-(player?.z??10000)
    const awayDist=Math.hypot(awayX,awayZ)
    const playerIsDriving=Math.abs(player?.speed||0)>5
    const evasive=playerIsDriving&&awayDist<6.1&&awayDist>.001
    if(evasive){
      dx=awayX/awayDist
      dz=awayZ/awayDist
      idle=0
    }
    const destDist=Math.hypot(dx,dz)
    if(destDist<.04||(!evasive&&idle>0))return {...v,idle,targetIndex,walking:false,walkCycle:v.walkCycle+step*.45}
    const speed=v.walkSpeed*(evasive?2.1:1)
    const dist=Math.min(speed*step,destDist)
    // Prevent a fleeing villager from wandering arbitrarily far from town.
    const x=v.x+dx/destDist*dist,z=v.z+dz/destDist*dist
    const limited=evasive && distanceToPath(x,z,path)>10
    return {
      ...v,x:limited?v.x:x,z:limited?v.z:z,
      yaw:Math.atan2(-dx,-dz),idle,targetIndex,
      walking:!limited,walkCycle:v.walkCycle+(limited?0:dist*6),
      wanderDistance:v.wanderDistance+(limited?0:dist),
    }
  })
}

export function nearbyVillager(villagers,player,maxDistance=4.25){
  if(!player||!villagers?.length)return null
  let best=null,bestDist=maxDistance
  for(const villager of villagers){
    const d=Math.hypot(villager.x-player.x,villager.z-player.z)
    if(d<bestDist){best=villager;bestDist=d}
  }
  return best
}

export function talkToVillager(state,villager){
  if(!villager)return {state,dialogue:null,firstMeeting:false}
  const met=state.metVillagers||[]
  const firstMeeting=!met.includes(villager.id)
  return {
    state:{...state,metVillagers:firstMeeting?[...met,villager.id]:met,
      coins:(state.coins||0)+(firstMeeting?2:0)},
    dialogue:{name:villager.name,role:villager.role,line:villager.dialogue},
    firstMeeting,
  }
}
