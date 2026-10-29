/** Local and inspectable race boards. Never represented as globally verified. */
export const BOARD_KEY='anik-race-times-v4'
const normalize=r=>r&&typeof r==='object'&&typeof r.track==='string'&&r.track.length<=40&&Number.isInteger(r.laps)&&r.laps>=1&&r.laps<=10&&
 Number.isInteger(r.ticks)&&r.ticks>0&&r.ticks<=60*3600&&typeof r.id==='string'&&r.id.length<120&&
 typeof r.weather==='string'&&r.weather.length<=20&&Number.isFinite(r.stunts)&&r.stunts>=0&&r.stunts<=1000000
export function readTimes(storage=typeof localStorage==='undefined'?null:localStorage){
 try{const r=JSON.parse(storage?.getItem(BOARD_KEY)||'[]');return Array.isArray(r)?r.filter(normalize).slice(-100):[]}catch{return []}
}
export function recordTime(run,storage=typeof localStorage==='undefined'?null:localStorage){
 if(!normalize(run))return false
 const old=readTimes(storage);if(old.some(x=>x.id===run.id))return true
 try{storage?.setItem(BOARD_KEY,JSON.stringify([run,...old].slice(0,100)));return true}catch{return false}
}
export function topTimes(track,laps,weather,storage){return readTimes(storage).filter(x=>x.track===track&&x.laps===laps&&x.weather===weather).sort((a,b)=>a.ticks-b.ticks).slice(0,10)}
