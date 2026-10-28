import test from 'node:test'
import assert from 'node:assert/strict'
import {DAY_SECONDS,WEATHER_ORDER,WEATHER_SEGMENT_SECONDS,environmentAt,nextNightTime,nextWeatherTime} from '../game/environment.js'
import {advanceKart,initialRaceState,moveKart} from '../game/simulation.js'

test('weather follows clear, rain, snow, windy in order and loops',()=>{
 assert.deepEqual(WEATHER_ORDER,['clear','rain','snow','wind'])
 for(let i=0;i<4;i++)assert.equal(environmentAt(i*WEATHER_SEGMENT_SECONDS+.4).kind,WEATHER_ORDER[i])
 assert.equal(environmentAt(4*WEATHER_SEGMENT_SECONDS+.25).kind,'clear')
})
test('precipitation and wind ease in rather than switching intensity suddenly',()=>{
 const start=environmentAt(WEATHER_SEGMENT_SECONDS-11)
 const middle=environmentAt(WEATHER_SEGMENT_SECONDS-5)
 const finish=environmentAt(WEATHER_SEGMENT_SECONDS+.1)
 assert.equal(start.rain,0)
 assert.ok(middle.rain>.35&&middle.rain<.65)
 assert.equal(finish.rain,1)
 assert.ok(middle.traction<1)
 assert.ok(environmentAt(WEATHER_SEGMENT_SECONDS*2+.1).traction<middle.traction)
})
test('sky gradually changes from day to twilight to night and back',()=>{
 const morning=environmentAt(0)
 const noon=environmentAt(DAY_SECONDS*4/24)
 const evening=environmentAt(DAY_SECONDS*11/24)
 const midnight=environmentAt(DAY_SECONDS*16/24)
 assert.equal(morning.time,'08:00')
 assert.equal(noon.time,'12:00')
 assert.ok(noon.daylight>.95)
 assert.ok(evening.daylight<noon.daylight)
 assert.ok(midnight.daylight<.25)
 assert.equal(environmentAt(DAY_SECONDS).time,'08:00')
})
test('weather and night preview time jumps are finite and advance forward',()=>{
 let weather=nextWeatherTime(0)
 assert.equal(environmentAt(weather).kind,'rain')
 for(let i=0;i<12;i++){weather=nextWeatherTime(weather);assert.ok(Number.isFinite(weather))}
 const night=nextNightTime(0)
 assert.ok(night>0)
 assert.ok(environmentAt(night).night)
 assert.ok(nextNightTime(night)>night)
})
test('snow reduces steering and acceleration, while the same kart remains driveable',()=>{
 const dry=environmentAt(.5),snow=environmentAt(WEATHER_SEGMENT_SECONDS*2+.5)
 const s={...initialRaceState(),speed:10}
 const a=moveKart(s,{forward:true,right:true},.05,[],{weather:dry})
 const b=moveKart(s,{forward:true,right:true},.05,[],{weather:snow})
 assert.ok(a.speed>b.speed)
 assert.ok(Math.abs(a.yaw-s.yaw)>Math.abs(b.yaw-s.yaw))
 assert.ok(Math.abs(b.yaw-s.yaw)>0)
})
test('wind gusts apply lateral force and do not bypass track boundaries',()=>{
 const baseline={...initialRaceState(),speed:14}
 const still=moveKart(baseline,{},.05)
 const windy=moveKart(baseline,{},.05,[],{weather:environmentAt(3*WEATHER_SEGMENT_SECONDS+.3)})
 assert.ok(Math.abs(windy.x-still.x)+Math.abs(windy.z-still.z)>.001)
 let s=baseline
 const env=environmentAt(3*WEATHER_SEGMENT_SECONDS+.3)
 for(let i=0;i<500;i++)s=advanceKart(s,{forward:true},1/60,[],env)
 assert.ok(s.speed<=30&&Number.isFinite(s.x)&&Number.isFinite(s.z))
})
