/** Compact transform replays: real gameplay snapshots, never a generated clip. */
export const REPLAY_HZ = 12
export const MAX_FRAMES = 60 * REPLAY_HZ + 4
export function snapshot(state){
  const p=state.player
  return {tick:state.ticks,score:state.score,combo:state.combo,
    player:{x:p.x,y:p.y,z:p.z,yaw:p.yaw,speed:p.speed,vy:p.vy,grounded:p.grounded,boostTimer:p.boostTimer},
    bots:state.bots.map(n=>({id:n.id,x:n.x,z:n.z,yaw:n.yaw,health:n.health,respawn:n.respawn,burst:n.burst})),
  }
}
export function createReplay(){return {frames:[],moments:[],lastTick:-5}}
export function recordReplay(replay,state){
  if(state.ticks-replay.lastTick>=5 || state.done){
    replay.frames.push(snapshot(state));replay.lastTick=state.ticks
    if(replay.frames.length>MAX_FRAMES)replay.frames.shift()
  }
  for(const event of state.events){
    if(['smash','land','jump'].includes(event.kind)){
      replay.moments.push({...event});if(replay.moments.length>100)replay.moments.shift()
    }
  }
}
export function bestMoment(replay){
  const frames=replay.frames
  if(frames.length<2)return null
  const first=frames[0].tick,last=frames.at(-1).tick
  const focal=replay.moments.reduce((a,b)=>!a||b.points>a.points?b:a,null)
  const center=focal?.tick??Math.max(first,last-180)
  let start=Math.max(first,center-180),end=Math.min(last,center+180)
  if(end-start<300)start=Math.max(first,end-360)
  if(end-start<300)end=Math.min(last,start+360)
  return {start,end,label:focal?(focal.kind==='smash'?'BEST SMASH':focal.kind==='land'?'BIG AIR':'TAKEOFF'):'FINAL RUN',points:focal?.points||0}
}
const lerp=(a,b,t)=>a+(b-a)*t
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t
export function sampleReplay(replay,tick){
  const frames=replay.frames
  if(!frames.length)return null
  let lo=0,hi=frames.length-1
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].tick<=tick)lo=mid;else hi=mid-1}
  const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)]
  const t=a===b?0:Math.max(0,Math.min(1,(tick-a.tick)/(b.tick-a.tick)))
  const mix=(x,y)=>({...x,x:lerp(x.x,y.x,t),y:lerp(x.y||0,y.y||0,t),z:lerp(x.z,y.z,t),yaw:angle(x.yaw,y.yaw,t)})
  return {...a,tick,player:mix(a.player,b.player),bots:a.bots.map((n,i)=>mix(n,b.bots[i]||n))}
}
