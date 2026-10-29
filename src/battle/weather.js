/** Deterministic arcade weather. Simulation time freezes with pause. */
export const WEATHER_OPTIONS = Object.freeze(['dynamic','clear','rain','snow','windy'])
export const WEATHER_SECONDS = 32
const STATES = Object.freeze([
  {kind:'clear',label:'CLEAR',rain:0,snow:0,wind:0,grip:1,braking:1,visibility:1},
  {kind:'rain',label:'RAIN',rain:1,snow:0,wind:.12,grip:.79,braking:.80,visibility:.68},
  {kind:'snow',label:'SNOW',rain:0,snow:1,wind:.18,grip:.58,braking:.64,visibility:.53},
  {kind:'windy',label:'WINDY',rain:0,snow:0,wind:1,grip:.92,braking:.94,visibility:.87},
])
export function normalizeWeather(value){return WEATHER_OPTIONS.includes(value)?value:'dynamic'}
export function normalizeLaps(value){
  if(typeof value!=='string'&&typeof value!=='number')return 3
  if(typeof value==='string'&&!/^\d{1,2}$/.test(value))return 3
  return Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=10?Number(value):3
}
export function raceWeather(tick=0,mode='dynamic',trackId='blast'){
  const seconds=Math.max(0,Number.isFinite(tick)?tick:0)/60,choice=normalizeWeather(mode)
  const offset=trackId==='frost'?2:trackId==='summit'?3:0
  const cycle=Math.floor(seconds/WEATHER_SECONDS)
  const index=choice==='dynamic'?(cycle+offset)%4:STATES.findIndex(s=>s.kind===choice)
  const current=STATES[index],prior=STATES[(index+3)%4]
  let t=choice==='dynamic'&&cycle>0?Math.min(1,(seconds%WEATHER_SECONDS)/5):1
  t=t*t*(3-2*t)
  const mixed={...current}
  for(const key of ['rain','snow','wind','grip','braking','visibility'])mixed[key]=prior[key]+(current[key]-prior[key])*t
  const gust=(.65+.35*Math.sin(seconds*1.2+.4))*mixed.wind
  return {...mixed,seconds,transition:t,next:STATES[(index+1)%4].label,
    windX:Math.sin(seconds*.19+.8)*gust*2.8,windZ:Math.cos(seconds*.17)*gust*2.1,
    windSpeed:gust*8,cloudCover:Math.min(1,mixed.rain*.8+mixed.snow*.85+mixed.wind*.35)}
}

export function parseRacePreferences(raw){
  try{
    const value=JSON.parse(raw||'{}')
    const object=value&&typeof value==='object'&&!Array.isArray(value)?value:{}
    return {laps:normalizeLaps(object.laps),weather:normalizeWeather(object.weather)}
  }catch{return {laps:3,weather:'dynamic'}}
}
