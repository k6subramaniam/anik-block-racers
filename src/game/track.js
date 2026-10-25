// Control points and interpolation reproduce Higgsfield's version-3 Blender road
// mesh (13 closed Catmull-Rom segments, 12 samples per segment, Blender X/Y -> glTF X/-Z).
// Game rules use metres; this data is independent of Three.js and testable in Node.
export const CONTROL_POINTS = [
  [-27, -13], [-31, -3], [-28, 12], [-18, 21], [-5, 19],
  [8, 17], [20, 22], [31, 13], [32, 0], [23, -12],
  [9, -19], [-9, -20], [-21, -18],
]
export const SAMPLES_PER_SEGMENT = 12
export const ROAD_WIDTH = 7.2
export const LAPS_TO_WIN = 3

function catmull(a, b, c, d, t) {
  const point = axis => 0.5 * (
    2 * b[axis] + (-a[axis] + c[axis]) * t +
    (2*a[axis] - 5*b[axis] + 4*c[axis] - d[axis]) * t*t +
    (-a[axis] + 3*b[axis] - 3*c[axis] + d[axis]) * t*t*t
  )
  return { x: point(0), z: -point(1) }
}

export const TRACK = Object.freeze(CONTROL_POINTS.flatMap((_, i) => {
  const n = CONTROL_POINTS.length
  return Array.from({ length: SAMPLES_PER_SEGMENT }, (_, step) => catmull(
    CONTROL_POINTS[(i - 1 + n) % n],
    CONTROL_POINTS[i],
    CONTROL_POINTS[(i + 1) % n],
    CONTROL_POINTS[(i + 2) % n],
    step / SAMPLES_PER_SEGMENT,
  ))
}))

export function nearestRoad(point, path = TRACK) {
  let best = { distance: Infinity, distanceSq: Infinity, x: 0, z: 0, index: 0, t: 0 }
  for (let i = 0; i < path.length; i++) {
    const a = path[i]
    const b = path[(i+1) % path.length]
    const vx = b.x - a.x
    const vz = b.z - a.z
    const len2 = vx*vx + vz*vz
    const t = len2 ? Math.max(0, Math.min(1, ((point.x-a.x)*vx + (point.z-a.z)*vz) / len2)) : 0
    const x = a.x + t * vx
    const z = a.z + t * vz
    const dx = point.x-x, dz = point.z-z
    const distanceSq = dx*dx + dz*dz
    if (distanceSq < best.distanceSq) best = { distanceSq, distance: Math.sqrt(distanceSq), x, z, index: i, t }
  }
  return best
}

export function gateAt(index, path = TRACK) {
  const n = path.length
  const p = path[index % n]
  const before = path[(index - 1 + n) % n]
  const after = path[(index + 1) % n]
  const tx = after.x - before.x, tz = after.z - before.z
  const length = Math.hypot(tx,tz)
  return { x: p.x, z: p.z, tx: tx/length, tz: tz/length, radius: ROAD_WIDTH/2 + .2 }
}

export const CHECKPOINT_1 = gateAt(46)
export const CHECKPOINT_2 = gateAt(99)
export const FINISH_GATE = { x: .5, z: 19.85, tx: -1, tz: 0, radius: ROAD_WIDTH/2 + .2 }

export function crossedGate(previous, current, gate) {
  // Signed plane crossing rejects approaching backwards and grazing the gate.
  const previousAlong = (previous.x - gate.x)*gate.tx + (previous.z-gate.z)*gate.tz
  const currentAlong = (current.x - gate.x)*gate.tx + (current.z-gate.z)*gate.tz
  const sideways = Math.abs((current.x-gate.x)*(-gate.tz) + (current.z-gate.z)*gate.tx)
  return previousAlong < 0 && currentAlong >= 0 && currentAlong < 2.0 && sideways <= gate.radius
}

export function stepRace(race, previous, current) {
  let { checkpoint, lap, elapsed, lastLapStart, bestLap } = race
  let event = null
  if (checkpoint === 0 && crossedGate(previous, current, CHECKPOINT_1)) {
    checkpoint = 1
    event = 'checkpoint-1'
  } else if (checkpoint === 1 && crossedGate(previous, current, CHECKPOINT_2)) {
    checkpoint = 2
    event = 'checkpoint-2'
  } else if (checkpoint === 2 && crossedGate(previous, current, FINISH_GATE)) {
    const lapTime = elapsed - lastLapStart
    bestLap = bestLap == null ? lapTime : Math.min(bestLap, lapTime)
    lastLapStart = elapsed
    checkpoint = 0
    event = lap >= LAPS_TO_WIN ? 'finished' : 'lap'
    if (lap < LAPS_TO_WIN) lap++
  }
  return { ...race, checkpoint, lap, lastLapStart, bestLap, event }
}

export function trackBarriers(path = TRACK, stride = 3) {
  const barriers=[]
  for(let i=0;i<path.length;i+=stride){
    const p=path[i]
    const q=path[(i + stride) % path.length]
    const dx=q.x-p.x, dz=q.z-p.z
    const length=Math.hypot(dx,dz)
    if(length < .01) continue
    const nx=-dz/length, nz=dx/length
    const yaw=Math.atan2(-dz,dx)
    for(const side of [-1,1]){
      barriers.push({
        id:`wall-${i}-${side}`,
        x:(p.x+q.x)*.5 + nx*(ROAD_WIDTH*.5+.20)*side,
        z:(p.z+q.z)*.5 + nz*(ROAD_WIDTH*.5+.20)*side,
        yaw, length: length + .65,
      })
    }
  }
  return barriers
}
