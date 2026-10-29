/** Compact replay captures actual race positions/events, not staged animation. */
export const REPLAY_SAMPLE_TICKS=5
export const MAX_REPLAY_FRAMES=180
export function createRaceReplay(){return {frames:[],moments:[],lastTick:-REPLAY_SAMPLE_TICKS}}
export function recordRaceReplay(replay,state){
 if(state.tick-replay.lastTick>=REPLAY_SAMPLE_TICKS){
  replay.frames.push({tick:state.tick,actors:state.actors.map(a=>({id:a.id,x:a.x,z:a.z,y:a.y||0,yaw:a.yaw,hp:a.hp,color:a.color,air:a.air?.lift||0}))})
  replay.lastTick=state.tick
  if(replay.frames.length>MAX_REPLAY_FRAMES)replay.frames.shift()
 }
 for(const event of state.events)if(['crash','stunt-smash','stunt-land','damage','knockout','explosion'].includes(event.kind)){
  replay.moments.push({...event,tick:state.tick})
  if(replay.moments.length>100)replay.moments.shift()
 }
}
export function replayRange(replay){
 if(replay.frames.length<2)return null
 const first=replay.frames[0].tick,last=replay.frames.at(-1).tick
 const moment=[...replay.moments].reverse().find(m=>m.tick>=first&&['crash','stunt-land','stunt-smash','knockout'].includes(m.kind))
 const center=moment?.tick??last-90
 let start=Math.max(first,center-100),end=Math.min(last,center+90)
 if(end-start<100){start=Math.max(first,end-130);end=Math.min(last,start+130)}
 return {start,end,label:moment?.kind==='crash'?'KART COLLISION':moment?.kind==='stunt-land'?'BIG AIR':moment?.kind==='stunt-smash'?'BLOCK SMASH':'LAST RACE MOMENT'}
}
export function sampleRaceReplay(replay,tick){
 const frames=replay.frames;if(!frames.length)return null
 let lo=0,hi=frames.length-1
 while(lo<hi){const m=Math.ceil((lo+hi)/2);if(frames[m].tick<=tick)lo=m;else hi=m-1}
 const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],t=a===b?0:Math.min(1,Math.max(0,(tick-a.tick)/(b.tick-a.tick)))
 const mix=(x,y)=>({...x,x:x.x+(y.x-x.x)*t,y:x.y+(y.y-x.y)*t,z:x.z+(y.z-x.z)*t,
  yaw:x.yaw+Math.atan2(Math.sin(y.yaw-x.yaw),Math.cos(y.yaw-x.yaw))*t})
 return {tick,actors:a.actors.map((n,i)=>mix(n,b.actors[i]||n))}
}
