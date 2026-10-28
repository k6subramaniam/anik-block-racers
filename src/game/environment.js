/** Deterministic arcade weather and solar clock. No location or network needed. */
export const DAY_SECONDS = 540 // 9 real minutes for one complete simulated day
export const WEATHER_SEGMENT_SECONDS = 55
export const WEATHER_ORDER = Object.freeze(['clear','rain','snow','wind'])
const TAU=Math.PI*2
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n))
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t)}

export function nextWeatherTime(seconds){
  return (Math.floor(Math.max(0,seconds)/WEATHER_SEGMENT_SECONDS)+1)*WEATHER_SEGMENT_SECONDS+.5
}
export function nextNightTime(seconds){
  // Solar clock begins at 08:00. Jump to 22:00 without changing the pace afterward.
  const cycle=DAY_SECONDS*((22-8+24)%24)/24
  const base=Math.floor(Math.max(0,seconds)/DAY_SECONDS)*DAY_SECONDS
  return (base+cycle>seconds ? base+cycle : base+cycle+DAY_SECONDS)+.15
}
export function environmentAt(seconds=0){
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0)
  const slot=Math.floor(t/WEATHER_SEGMENT_SECONDS)%WEATHER_ORDER.length
  const segment=t%WEATHER_SEGMENT_SECONDS
  const blend=smooth((segment-(WEATHER_SEGMENT_SECONDS-10))/10)
  const kind=WEATHER_ORDER[slot],next=WEATHER_ORDER[(slot+1)%WEATHER_ORDER.length]
  const weights={clear:0,rain:0,snow:0,wind:0}
  weights[kind]+=1-blend
  weights[next]+=blend
  const gameHours=(8+24*t/DAY_SECONDS)%24
  const sunAngle=TAU*(gameHours-6)/24
  const elevation=Math.sin(sunAngle)
  const daylight=smooth((elevation+.19)/.44)
  const hour=Math.floor(gameHours)
  const minute=Math.floor((gameHours-hour)*60)
  const rain=weights.rain,snow=weights.snow,wind=weights.wind
  const gust=.68+.32*Math.sin(t*.45)+.2*Math.sin(t*1.17)
  const windSpeed=(.55+wind*7.4+rain*1.35+snow*.8)*Math.max(.15,gust)
  const bearing=.35+t*.014
  const windX=Math.cos(bearing)*windSpeed
  const windZ=Math.sin(bearing)*windSpeed
  return {
    seconds:t,kind,next,weights,blend,
    label:{clear:'CLEAR',rain:'RAIN',snow:'SNOW',wind:'WINDY'}[kind],
    time:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
    gameHours,daylight,night:daylight<.25,sunAngle,
    rain,snow,wind,windX,windZ,windSpeed,
    traction:clamp(1-.18*rain-.42*snow,.52,1),
    braking:clamp(1-.12*rain-.32*snow,.60,1),
    cloudCover:clamp(.10+.60*rain+.67*snow+.37*wind),
    timeToChange:WEATHER_SEGMENT_SECONDS-segment,
  }
}
