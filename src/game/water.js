/** Playable lake footprints in metres (Three.js X/Z); water bodies are not solid obstacles. */
export const WATER_BODIES=Object.freeze([
  {id:'blockhaven-pond',name:'BLOCKHAVEN POND',x:-117,z:41,rx:12.0,rz:8.3,level:.43,rescue:{x:-100,z:39,yaw:Math.PI/2}},
  {id:'crystal-lake',name:'CRYSTAL LAKE',x:-56,z:-100,rx:20,rz:14.5,level:.43,rescue:{x:-32,z:-98,yaw:Math.PI/2}},
  {id:'blue-lagoon',name:'BLUE LAGOON',x:52,z:88,rx:22,rz:17,level:.43,rescue:{x:52,z:66,yaw:Math.PI}},
])
export const WATER_DESTINATIONS=Object.freeze(WATER_BODIES.map(b=>({id:b.id,name:b.name,label:'Drive into the lake · auto-rescue',icon:'≈',color:'#64dfff',spawn:b.rescue})))

export function waterAt(position, bodies=WATER_BODIES){
  for(const body of bodies){
    const dist=((position.x-body.x)/body.rx)**2+((position.z-body.z)/body.rz)**2
    if(dist<=.94**2) return {body,depth:1-Math.sqrt(dist)/.94}
  }
  return null
}

/** Enter -> splash -> hydrodynamic drag and sink -> safe shore rescue.
 * Simulates a water hazard, not a physically exhaustive fluid solver. Pure and testable.
 */
export function advanceWater(state,delta,bodies=WATER_BODIES){
  const dt=Math.min(.05,Math.max(0,Number.isFinite(delta)?delta:0))
  const contact=waterAt(state,bodies)
  if(!contact){
    return {...state,inWater:false,waterId:null,waterTimer:0,
      submersion:Math.max(0,(state.submersion||0)-dt*2.2),
      waterDepth:0}
  }
  const timer=(state.inWater?state.waterTimer||0:0)+dt
  const sink=Math.min(1,(state.submersion||0)+dt*(.37+Math.min(.2,contact.depth*.6)))
  if(timer>=4.1){
    return {...state,...contact.body.rescue,speed:0,inWater:false,waterId:null,
      waterTimer:0,submersion:0,waterDepth:0,boostTimer:0,event:'water-rescue'}
  }
  // Deep water rapidly absorbs forward momentum and disables turbo acceleration.
  return {...state, speed:state.speed*Math.exp(-dt*(2.15+sink*2.0)),
    inWater:true,waterId:contact.body.id,waterTimer:timer,submersion:sink,
    waterDepth:contact.depth,boostTimer:0,
    event:!state.inWater?'water-splash':state.event}
}
