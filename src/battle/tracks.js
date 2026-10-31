/** Original circuits in metres. The final coordinate of each point is elevation.
 * Height-aware nearest-surface queries keep bridge decks separate at crossings. */
export const BATTLE_TRACKS = Object.freeze([
  {id:'blast',name:'BLAST CIRCUIT',level:1,tag:'Level 1 · Ground circuit',description:'A flat training circuit for close-contact battle racing.',color:'#d4fa60',ground:'#64974a',sky:'#a3cfdf',grip:1,weather:'CLEAR',width:12,
    points:[[0,52,0],[48,52,0],[72,28,0],[72,-25,0],[45,-51,0],[-45,-51,0],[-72,-25,0],[-72,28,0],[-48,52,0]]},
  {id:'canyon',name:'CANYON FUSE',level:2,tag:'Level 2 · Elevated mesas',description:'Climb a 12 metre mesa and descend through dusty bends.',color:'#ffba73',ground:'#b68057',sky:'#debea2',grip:.88,weather:'DUSTY',width:13,
    points:[[0,63,0],[55,63,0],[86,35,5],[78,0,10],[96,-35,12],[56,-67,12],[0,-54,8],[-58,-67,4],[-88,-26,0],[-66,10,0],[-86,43,0],[-50,63,0]]},
  {id:'frost',name:'FROST RUN',level:3,tag:'Level 3 · Ice ridges',description:'Slippery ridges climb to a 10 metre snow platform.',color:'#96eaff',ground:'#bbd7db',sky:'#b2c8db',grip:.65,weather:'SNOW',width:13,
    points:[[0,57,0],[48,57,0],[76,25,3],[57,-5,8],[74,-42,10],[28,-64,10],[-30,-64,7],[-76,-32,3],[-56,5,0],[-76,34,0],[-45,57,0]]},
  {id:'skybridge',name:'SKYBRIDGE SPRINT',level:4,tag:'Level 4 · Two-deck crossover',description:'Cross under your own 24 metre bridge, then race across the upper deck.',color:'#c9a1ff',ground:'#648e82',sky:'#a1c6df',grip:.95,weather:'CLEAR',width:12,
    points:[[0,0,0],[38,32,0],[70,38,7],[87,8,16],[64,-25,22],[32,-20,24],[0,0,24],[-32,20,24],[-64,25,17],[-87,-8,7],[-70,-38,0],[-38,-32,0]]},
  {id:'summit',name:'SUMMIT SWITCHBACK',level:5,tag:'Level 5 · 32 m summit',description:'Long exposed climbs and descending switchbacks with strong crosswinds.',color:'#ffe19a',ground:'#718e65',sky:'#abc7d1',grip:.83,weather:'WINDY',width:14,
    points:[[0,74,0],[60,74,0],[100,45,6],[100,-10,16],[76,-54,26],[28,-78,32],[-30,-78,32],[-84,-48,25],[-94,-4,17],[-64,16,10],[-90,45,4],[-42,74,0]]},
])
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
export const TRACK_WIDTH_SCALE=1.5
const cache=new Map()
let customSpec=null
export function registerBuiltTrack(spec){
  if(!spec||spec.id!=='custom'||!Array.isArray(spec.points)||spec.points.length<6)throw new RangeError('A validated custom track is required')
  customSpec={...spec,points:spec.points.map(p=>[...p])}
  cache.delete('custom')
}
export function hasBuiltTrack(){return !!customSpec}
export function battleTrack(id='blast'){
  if(cache.has(id))return cache.get(id)
  const spec=id==='custom'?customSpec:BATTLE_TRACKS.find(t=>t.id===id)
  if(!spec)throw new RangeError('Unknown battle circuit')
  const path=[],n=spec.points.length
  for(let i=0;i<n;i++)for(let j=0;j<24;j++){
    const t=j/24,[a,b,c,d]=[-1,0,1,2].map(k=>spec.points[(i+k+n)%n])
    const axis=k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)
    const ease=t*t*(3-2*t)
    path.push({x:axis(0),z:axis(1),y:(b[2]||0)+((c[2]||0)-(b[2]||0))*ease})
  }
  const arcs=[0]
  for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];arcs.push(arcs.at(-1)+Math.hypot(b.x-a.x,b.z-a.z))}
  // Every circuit, built-in or player-made, races 50% wider than its authored width.
  const result={...spec,width:spec.width*TRACK_WIDTH_SCALE,authoredWidth:spec.width,path,arcs,length:arcs.at(-1),maxHeight:Math.max(...path.map(p=>p.y))}
  result.gates=Array.from({length:8},(_,i)=>({...atDistance(result,result.length*i/8),index:i}))
  result.repairs=[.36,.78].map((fraction,i)=>({...atDistance(result,result.length*fraction),id:`repair-${i}`}))
  cache.set(id,result);return result
}
export function atDistance(track,distance,lane=0){
  const s=((distance%track.length)+track.length)%track.length
  let lo=0,hi=track.path.length-1
  while(lo<hi){const m=Math.ceil((lo+hi)/2);if(track.arcs[m]<=s)lo=m;else hi=m-1}
  const a=track.path[lo],b=track.path[(lo+1)%track.path.length],len=track.arcs[lo+1]-track.arcs[lo]
  const dx=(b.x-a.x)/len,dz=(b.z-a.z)/len,t=(s-track.arcs[lo])/len,grade=(b.y-a.y)/len
  return {x:a.x+(b.x-a.x)*t-dz*lane,z:a.z+(b.z-a.z)*t+dx*lane,y:a.y+(b.y-a.y)*t,dx,dz,grade,yaw:Math.atan2(-dx,-dz),s}
}
export function nearestOnTrack(track,p){
  let best={distance:Infinity,s:0},bestCost=Infinity
  for(let i=0;i<track.path.length;i++){
    const a=track.path[i],b=track.path[(i+1)%track.path.length],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz
    const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/len2,0,1),x=a.x+dx*t,z=a.z+dz*t,y=a.y+(b.y-a.y)*t
    const distance=Math.hypot(p.x-x,p.z-z),vertical=Number.isFinite(p.y)?Math.abs(p.y-y):0
    const cost=distance*distance+vertical*vertical*2.8
    if(cost<bestCost){bestCost=cost;const len=Math.sqrt(len2);best={x,z,y,distance,s:track.arcs[i]+len*t,dx:dx/len,dz:dz/len,grade:(b.y-a.y)/len}}
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
  const rightDeck=!Number.isFinite(b.y)||Math.abs(b.y-(gate.y||0))<2.2
  return rightDeck&&old<=0&&next>0&&segmentDistance(a,b,gate)<=width/2+.6&&Math.hypot(b.x-a.x,b.z-a.z)<5
}
