import React from 'react'
import { TRACK, FINISH_GATE, ROAD_WIDTH } from './track.js'

// The circuit fills a fixed SVG box; world x maps right and world z maps down,
// matching the chase camera's "north is up" overhead view.
const PAD = ROAD_WIDTH / 2 + 4
const xs = TRACK.map(p => p.x), zs = TRACK.map(p => p.z)
const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD
const minZ = Math.min(...zs) - PAD, maxZ = Math.max(...zs) + PAD
const W = maxX - minX, H = maxZ - minZ
const OUTLINE = TRACK.map((p, i) => `${i ? 'L' : 'M'}${(p.x - minX).toFixed(1)} ${(p.z - minZ).toFixed(1)}`).join('') + 'Z'
const LINE = { x: FINISH_GATE.x - minX, z: FINISH_GATE.z - minZ, nx: -FINISH_GATE.tz, nz: FINISH_GATE.tx }
const half = ROAD_WIDTH / 2

/** Overhead map of the Grand Circuit with every kart. The player is the arrow. */
export default function RaceMinimap({ x, z, yaw, dots = [] }) {
  const px = (x ?? 0) - minX, pz = (z ?? 0) - minZ
  const deg = -(yaw ?? 0) * 180 / Math.PI
  return <svg className="gp-minimap" viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`} role="img" aria-label="Track map" data-testid="race-minimap">
    <path d={OUTLINE} fill="none" stroke="#0b1a1e" strokeOpacity=".75" strokeWidth={ROAD_WIDTH + 5} strokeLinejoin="round" />
    <path d={OUTLINE} fill="none" stroke="#5f7479" strokeWidth={ROAD_WIDTH} strokeLinejoin="round" />
    <line x1={LINE.x - LINE.nx * half} y1={LINE.z - LINE.nz * half} x2={LINE.x + LINE.nx * half} y2={LINE.z + LINE.nz * half} stroke="#fff" strokeWidth="3.4" strokeDasharray="3 3" />
    {dots.map(d => <circle key={d.id} cx={d.x - minX} cy={d.z - minZ} r="5.5" fill={d.color} stroke="#0b1a1e" strokeWidth="2" opacity={d.out ? .35 : 1} />)}
    <g transform={`translate(${px.toFixed(1)} ${pz.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
      <path d="M0 -10 L7.5 7 L0 3 L-7.5 7Z" fill="#c8fa58" stroke="#0b1a1e" strokeWidth="2.2" strokeLinejoin="round" />
    </g>
  </svg>
}
