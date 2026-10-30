import { nearestRoad, stepRace, ROAD_WIDTH, TRACK, START_POSE } from './track.js'
import { deflectAlongWall, wallSpeed, WALL_RECOVERY } from './wallRecovery.js'

export const SPAWN = START_POSE
export const MAX_SPEED = 23 // 82.8 km/h
export const MAX_REVERSE = -7
export const CAR_RADIUS = 0.84
export const SAFE_ROAD_HALF_WIDTH = ROAD_WIDTH/2 - CAR_RADIUS + .12
export const INPUT_DEFAULT = Object.freeze({ forward: false, backward: false, left: false, right: false, drift: false })

export function initialRaceState() {
  return {
    x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, speed: 0,
    lap: 1, checkpoint: 0, elapsed: 0, lastLapStart: 0,
    bestLap: null, event: null, collisions: 0,
  }
}

export function nearestObstacle(position, obstacles = []) {
  let closest=null
  for(const o of obstacles){
    const gap=Math.hypot(position.x-o.x,position.z-o.z)-(o.radius??1)-CAR_RADIUS
    if(gap<0 && (!closest || gap<closest.gap)) closest={ ...o, gap }
  }
  return closest
}

export function moveKart(state, input, delta, obstacles = [], options = {}) {
  const dt = Math.min(Math.max(0,delta), .05)
  if (!dt) return state
  let speed = state.speed
  const gas = Number(!!input.forward) - Number(!!input.backward)
  const steering = Number(!!input.right) - Number(!!input.left)
  const drifting = !!input.drift
  const weather = options.weather || {}
  const traction = Math.max(.5, Math.min(1, weather.traction ?? 1))
  const braking = Math.max(.5, Math.min(1, weather.braking ?? 1))
  const waterDrive = state.inWater ? .25 : 1

  if(gas === 1) speed += (speed < 0 ? 24 : 13.0)*dt*traction*waterDrive
  else if(gas === -1) speed -= (speed > 0 ? 26 : 9.0)*dt*braking*waterDrive
  else {
    const decel = (2.9 + speed*speed*.009)*dt*traction
    speed = Math.abs(speed) <= decel ? 0 : speed - Math.sign(speed)*decel
  }
  speed = Math.max(MAX_REVERSE,Math.min(state.boostTimer > 0 ? MAX_SPEED + 7 : MAX_SPEED,speed))
  const turnStrength = Math.min(1, Math.abs(speed)/10)
  const reverse = speed < 0 ? -1 : 1
  const turnRate = (drifting ? 2.05 : 1.37) * (.35 + .65*turnStrength)
  let yaw = state.yaw - steering*turnRate*dt*reverse*traction
  let x = state.x - Math.sin(yaw)*speed*dt
  let z = state.z - Math.cos(yaw)*speed*dt
  // Lateral gusts displace light karts; geometry constraints below still apply.
  const windInfluence = (.09 + Math.abs(speed)*.011)*(state.inWater ? .15 : 1)
  x += (weather.windX||0)*dt*windInfluence
  z += (weather.windZ||0)*dt*windInfluence
  let event=null
  let collisions = state.collisions

  const freeRoam=options.mode==='explore'
  const road = freeRoam ? null : nearestRoad({x,z}, TRACK)
  if (!freeRoam && road.distance > SAFE_ROAD_HALF_WIDTH) {
    const overshootX=x-road.x, overshootZ=z-road.z
    const inv=1/Math.max(road.distance,1e-6),edge=SAFE_ROAD_HALF_WIDTH-WALL_RECOVERY.inset
    x = road.x+overshootX*inv*edge
    z = road.z+overshootZ*inv*edge
    // Glance off the wall: turn to run along it and keep most of the speed.
    const a=TRACK[road.index],b=TRACK[(road.index+1)%TRACK.length],len=Math.hypot(b.x-a.x,b.z-a.z)||1
    yaw = deflectAlongWall(yaw,(b.x-a.x)/len,(b.z-a.z)/len)
    speed = wallSpeed(speed)
    event='wall'
    collisions++
  }

  // A bounded, driveable region keeps free roam safe without trapping the kart
  // inside the old race barriers. The racetrack uses its original corridor.
  if (freeRoam && options.bounds) {
    const b=options.bounds
    const clampedX=Math.max(b.minX,Math.min(b.maxX,x))
    const clampedZ=Math.max(b.minZ,Math.min(b.maxZ,z))
    if (clampedX !== x || clampedZ !== z) {
      x=clampedX;z=clampedZ
      speed=-Math.sign(speed)*Math.min(Math.abs(speed)*.14,2)
      event='border';collisions++
    }
  }
  const obstacle = nearestObstacle({x,z},obstacles)
  if(obstacle){
    // Resolve the circle collision instead of allowing model interpenetration.
    const dx=x-obstacle.x, dz=z-obstacle.z
    const len=Math.hypot(dx,dz)||1
    const safe=(obstacle.radius??1)+CAR_RADIUS+.03
    const candidate={x:obstacle.x+dx/len*safe,z:obstacle.z+dz/len*safe}
    // Never push a kart through the outside barriers while resolving an obstacle.
    if(freeRoam || nearestRoad(candidate).distance<=SAFE_ROAD_HALF_WIDTH+.03){
      x=candidate.x;z=candidate.z
    }else{
      x=state.x;z=state.z
    }
    speed = -Math.sign(speed)*Math.min(Math.abs(speed)*.18,2)
    event='obstacle'
    collisions++
  }
  return {...state,x,z,yaw,speed,collisions,event}
}

export function advanceKart(state, input, dt, obstacles=[], weather=null) {
  // Race clock advances only when actively racing; pause/countdown call moveKart no-op.
  const moved=moveKart(state,input,dt,obstacles,{weather})
  const elapsed=state.elapsed + Math.max(0,Math.min(dt,.05))
  const stepped=stepRace({ ...moved, elapsed }, state, moved)
  return { ...stepped, event: stepped.event || moved.event }
}

export function formatTime(seconds) {
  if (seconds == null) return '--:--.--'
  const hundredths=Math.floor(Math.max(0,seconds)*100)
  const mins=Math.floor(hundredths/6000)
  const secs=Math.floor((hundredths%6000)/100)
  const hundred=hundredths%100
  return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(hundred).padStart(2,'0')}`
}
