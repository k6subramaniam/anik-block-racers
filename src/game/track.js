// Voxel Valley Grand Circuit: a closed Catmull-Rom loop (13 segments x 12 samples)
// around the castle, kept clear of Blockhaven Village to the west and the lagoon to
// the south. Points use Blender X/Y and map to glTF X/-Z, like the original
// Higgsfield road it replaces. Game rules use metres and run in Node without Three.js.
export const CONTROL_POINTS = [
  [-22, -20], [-25, 0], [-21, 21], [-5, 39], [20, 43],
  [44, 35], [64, 28], [78, 10], [78, -14], [68, -36],
  [46, -55], [16, -57], [-6, -42],
]
export const SAMPLES_PER_SEGMENT = 12
export const LANES = 4
export const LANE_WIDTH = 3.6
export const ROAD_WIDTH = LANES * LANE_WIDTH
// Lane centres measured from the centre line; negative is the driver's left.
export const LANE_OFFSETS = Object.freeze(Array.from({ length: LANES }, (_, i) => (i - (LANES - 1) / 2) * LANE_WIDTH))
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

// Point `offset` metres to the side of sample `index` (negative is the driver's left).
export function trackPoint(index, offset = 0, path = TRACK) {
  const g = gateAt(index, path)
  return { x: g.x - g.tz*offset, z: g.z + g.tx*offset, yaw: Math.atan2(-g.tx, -g.tz) }
}

export const CHECKPOINT_1_INDEX = 46
export const CHECKPOINT_2_INDEX = 99
export const FINISH_INDEX = 130
export const START_INDEX = 122
export const CHECKPOINT_1 = gateAt(CHECKPOINT_1_INDEX)
export const CHECKPOINT_2 = gateAt(CHECKPOINT_2_INDEX)
export const FINISH_GATE = gateAt(FINISH_INDEX)
// The player starts in the back row of the grid, right-hand lane, about 17 m behind the line.
export const START_POSE = Object.freeze(trackPoint(START_INDEX, LANE_OFFSETS[LANES - 1]))

// Pickups cycle across the lanes so changing lanes is part of the racing line.
export const BOOST_PADS = Object.freeze([28,70,105,143].map((index, i) => ({ index, ...trackPoint(index, LANE_OFFSETS[[1,2,0,3][i]]) })))
export const COINS = Object.freeze([12,21,34,42,57,64,81,93,116,123,133,151].map((index, i) => ({ index, ...trackPoint(index, LANE_OFFSETS[i % LANES]) })))

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
    if(Math.hypot(q.x-p.x,q.z-p.z) < .01) continue
    for(const side of [-1,1]){
      // Offset each end by its own normal so walls on the outside of a bend stay closed.
      const a=trackPoint(i,(ROAD_WIDTH*.5+.20)*side,path), b=trackPoint(i+stride,(ROAD_WIDTH*.5+.20)*side,path)
      const dx=b.x-a.x, dz=b.z-a.z
      barriers.push({
        id:`wall-${i}-${side}`,
        x:(a.x+b.x)*.5, z:(a.z+b.z)*.5,
        yaw:Math.atan2(-dz,dx), length:Math.hypot(dx,dz) + .65,
      })
    }
  }
  return barriers
}
