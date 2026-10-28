/** Original arcade battle circuits; all distances are virtual game metres. */
export const BATTLE_TRACKS = Object.freeze([
  {id:'blast',name:'BLAST CIRCUIT',tag:'Balanced · clear',description:'Long straights, marked mine zones and explosive crates.',color:'#d4fa60',ground:'#64974a',sky:'#a3cfdf',grip:1,weather:'CLEAR',width:12,
    points:[[0,52],[48,52],[72,28],[72,-25],[45,-51],[-45,-51],[-72,-25],[-72,28],[-48,52]]},
  {id:'canyon',name:'CANYON FUSE',tag:'Twisting · dusty',description:'A wide canyon loop with tighter bends and more hazards.',color:'#ffba73',ground:'#b68057',sky:'#debea2',grip:.88,weather:'DUSTY',width:13,
    points:[[0,63],[55,63],[86,35],[78,0],[96,-35],[56,-67],[0,-54],[-58,-67],[-88,-26],[-66,10],[-86,43],[-50,63]]},
  {id:'frost',name:'FROST RUN',tag:'Slippery · snow',description:'Icy corners make every blast and steering correction matter.',color:'#96eaff',ground:'#bbd7db',sky:'#b2c8db',grip:.65,weather:'SNOW',width:13,
    points:[[0,57],[48,57],[76,25],[57,-5],[74,-42],[28,-64],[-30,-64],[-76,-32],[-56,5],[-76,34],[-45,57]]},
])
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
const cache=new Map()
export function battleTrack(id='blast'){
  if(cache.has(id))return cache.get(id)
  const spec=BATTLE_TRACKS.find(t=>t.id===id)
  if(!spec)throw new RangeError('Unknown battle circuit')
  const path=[],n=spec.points.length
  for(let i=0;i<n;i++)for(let j=0;j<20;j++){
    const t=j/20,[a,b,c,d]=[-1,0,1,2].map(k=>spec.points[(i+k+n)%n])
    const axis=k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)
    path.push({x:axis(0),z:axis(1)})
  }
  const arcs=[0]
  for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];arcs.push(arcs.at(-1)+Math.hypot(b.x-a.x,b.z-a.z))}
  const result={...spec,path,arcs,length:arcs.at(-1)}
  result.gates=Array.from({length:8},(_,i)=>({...atDistance(result,result.length*i/8),index:i}))
  result.repairs=[.36,.78].map((fraction,i)=>({...atDistance(result,result.length*fraction),id:`repair-${i}`}))
  cache.set(id,result);return result
}
export function atDistance(track,distance,lane=0){
  const s=((distance%track.length)+track.length)%track.length
  let lo=0,hi=track.path.length-1
  while(lo<hi){const m=Math.ceil((lo+hi)/2);if(track.arcs[m]<=s)lo=m;else hi=m-1}
  const a=track.path[lo],b=track.path[(lo+1)%track.path.length],len=track.arcs[lo+1]-track.arcs[lo]
  const dx=(b.x-a.x)/len,dz=(b.z-a.z)/len,t=(s-track.arcs[lo])/len
  return {x:a.x+(b.x-a.x)*t-dz*lane,z:a.z+(b.z-a.z)*t+dx*lane,dx,dz,yaw:Math.atan2(-dx,-dz),s}
}
export function nearestOnTrack(track,p){
  let best={distance:Infinity,s:0}
  for(let i=0;i<track.path.length;i++){
    const a=track.path[i],b=track.path[(i+1)%track.path.length],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz
    const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/len2,0,1),x=a.x+dx*t,z=a.z+dz*t,distance=Math.hypot(p.x-x,p.z-z)
    if(distance<best.distance)best={x,z,distance,s:track.arcs[i]+Math.sqrt(len2)*t,dx:dx/Math.sqrt(len2),dz:dz/Math.sqrt(len2)}
  }
  return best
}
export function segmentDistance(a,b,p){
  const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz
  const t=l>1e-9?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0
  return Math.hypot(a.x+t*dx-p.x,a.z+t*dz-p.z)
}
export function crossedGate(gate,a,b,width){
  const old=(a.x-gate.x)*gate.dx+(a.z-gate.z)*gate.dz
  const next=(b.x-gate.x)*gate.dx+(b.z-gate.z)*gate.dz
  return old<=0&&next>0&&segmentDistance(a,b,gate)<=width/2+.6&&Math.hypot(b.x-a.x,b.z-a.z)<5
}
