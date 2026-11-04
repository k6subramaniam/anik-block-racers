import React, { useMemo } from 'react'
import { TRACK, ROAD_WIDTH } from './track.js'
import { ZONES, RELICS } from './openWorld.js'
import { WATER_BODIES } from './water.js'
import { FRONTIER_ROADS, EXPANDED_BOUNDS as W, ORIGINAL_BOUNDS as O } from './frontier.js'
import { nextTarget, mapMarker, formatDistance, MINIMAP_RADIUS as R } from './exploreGuide.js'

// Everything is drawn in world metres (x right, z down = north up); the viewBox simply
// follows the player, so the static layers never re-render. S converts screen pixels
// at the card's reference size (140 px across) into metres.
const S = (2 * R) / 140
const LOOP = TRACK.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.z.toFixed(1)}`).join('') + 'Z'
const BIOMES = [
  { x: W.minX, z: W.minZ, fill: '#2b4a2f' }, { x: 0, z: W.minZ, fill: '#3b5663' },
  { x: W.minX, z: 0, fill: '#5b4b2c' }, { x: 0, z: 0, fill: '#5a3529' },
]

function StaticLayers() {
  return <g>
    {BIOMES.map((b, i) => <rect key={i} x={b.x} y={b.z} width={W.maxX} height={W.maxZ} fill={b.fill} />)}
    <rect x={O.minX} y={O.minZ} width={O.maxX - O.minX} height={O.maxZ - O.minZ} fill="#35553a" />
    <rect x={W.minX} y={W.minZ} width={W.maxX - W.minX} height={W.maxZ - W.minZ} fill="none" stroke="#ff8a6a" strokeWidth={2 * S} strokeDasharray={`${5 * S} ${4 * S}`} />
    {FRONTIER_ROADS.map(r => <line key={r.id} x1={r.a[0]} y1={r.a[1]} x2={r.b[0]} y2={r.b[1]} stroke="#b9c79c" strokeWidth={r.width} strokeLinecap="round" />)}
    <path d={LOOP} fill="none" stroke="#6f8389" strokeWidth={ROAD_WIDTH} strokeLinejoin="round" />
    {WATER_BODIES.map(w => <ellipse key={w.id} cx={w.x} cy={w.z} rx={w.rx} ry={w.rz} fill="#49b9df" stroke="#c9f8ff" strokeWidth={S} />)}
  </g>
}

/** North-up radar around the player: districts, lakes, roads, relics still to find,
 * patrolling rivals and a pointer to the next undiscovered place. */
export default function ExploreMinimap({ x = 0, z = 0, yaw = 0, visited = [], collected = [], dots = [] }) {
  const staticLayers = useMemo(() => <StaticLayers />, [])
  const pos = { x, z }
  const target = nextTarget(pos, visited, collected)
  const marker = target && mapMarker(pos, target)
  const deg = v => (v * 180 / Math.PI).toFixed(1)
  return <>
    <svg className="ex-minimap" viewBox={`${(x - R).toFixed(1)} ${(z - R).toFixed(1)} ${2 * R} ${2 * R}`} role="img" aria-label="Map around you" data-testid="explore-minimap">
      <rect x={x - R} y={z - R} width={2 * R} height={2 * R} fill="#0d1b1f" />
      {staticLayers}
      {ZONES.map(zone => {
        const found = visited.includes(zone.id)
        return <g key={zone.id} opacity={found ? .75 : 1}>
          <circle cx={zone.x} cy={zone.z} r={zone.radius} fill={zone.color} fillOpacity={found ? .14 : .26} stroke={zone.color} strokeWidth={1.4 * S} strokeDasharray={found ? undefined : `${4 * S} ${3 * S}`} />
          <text x={zone.x} y={zone.z} dy={3.5 * S} textAnchor="middle" fontSize={11 * S} fontWeight="900" fill={zone.color}>{zone.icon}</text>
        </g>
      })}
      {RELICS.filter(r => !collected.includes(r.id)).map(r => <rect key={r.id} x={r.x - 2.6 * S} y={r.z - 2.6 * S} width={5.2 * S} height={5.2 * S} transform={`rotate(45 ${r.x} ${r.z})`} fill="#fff6b0" stroke={r.color} strokeWidth={1.2 * S} />)}
      {dots.map(d => <circle key={d.id} cx={d.x} cy={d.z} r={3.4 * S} fill={d.color} stroke="#0b1a1e" strokeWidth={1.2 * S} opacity={d.out ? .35 : 1} />)}
      {marker && (marker.edge
        ? <g transform={`translate(${marker.x.toFixed(1)} ${marker.z.toFixed(1)}) rotate(${deg(target.bearing)})`} data-testid="explore-target-edge">
            <path d={`M0 ${-7 * S} L${6 * S} ${4 * S} L0 ${1 * S} L${-6 * S} ${4 * S}Z`} fill={target.color} stroke="#0b1a1e" strokeWidth={1.3 * S} strokeLinejoin="round" />
          </g>
        : <circle cx={marker.x} cy={marker.z} r={9 * S} fill="none" stroke={target.color} strokeWidth={2 * S} className="ex-target-ring" />)}
      <text x={x} y={z - R * .9} dy={3 * S} textAnchor="middle" fontSize={9 * S} fontWeight="900" fill="#e9f5ee" opacity=".85">N</text>
      <g transform={`translate(${x.toFixed(1)} ${z.toFixed(1)}) rotate(${deg(-yaw)})`}>
        <path d={`M0 ${-8 * S} L${6 * S} ${6 * S} L0 ${2.5 * S} L${-6 * S} ${6 * S}Z`} fill="#c8fa58" stroke="#0b1a1e" strokeWidth={1.6 * S} strokeLinejoin="round" />
      </g>
    </svg>
    {target && <span className="ex-target" data-testid="explore-target" style={{ '--target': target.color }}>
      <i aria-hidden="true">{target.icon}</i><b>{target.name}</b><small>{formatDistance(target.distance)}</small>
    </span>}
  </>
}
