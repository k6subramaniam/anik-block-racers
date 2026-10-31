import React, {useLayoutEffect, useMemo, useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {TRACK, ROAD_WIDTH, LANE_OFFSETS, trackPoint, FINISH_INDEX, CHECKPOINT_1_INDEX, CHECKPOINT_2_INDEX, BOOST_PADS, COINS} from './track.js'

/** The six-lane Voxel Valley Grand Circuit, built from the track samples so the
 * visible road, lane markings, gates and pickups always match the race rules.
 * Everything is merged or instanced to keep draw calls low on Galaxy phones.
 */
const N = TRACK.length
const HALF = ROAD_WIDTH / 2

// A flat strip between two lateral offsets; `keep(i)` drops samples to make dashes.
function strip(inner, outer, y, keep = () => true) {
  const positions = []
  for (let i = 0; i < N; i++) {
    if (!keep(i)) continue
    const a0 = trackPoint(i, inner), a1 = trackPoint(i, outer), b0 = trackPoint(i + 1, inner), b1 = trackPoint(i + 1, outer)
    // inner < outer, so (a0, a1, b0) is counter-clockwise from above and faces up.
    positions.push(a0.x, y, a0.z, a1.x, y, a1.z, b0.x, y, b0.z, a1.x, y, a1.z, b1.x, y, b1.z, b0.x, y, b0.z)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function useStrips() {
  return useMemo(() => {
    const dividers = LANE_OFFSETS.slice(0, -1).map((o, i) => (o + LANE_OFFSETS[i + 1]) / 2)
    const merge = list => {
      const positions = list.flatMap(g => Array.from(g.getAttribute('position').array))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      g.computeVertexNormals()
      list.forEach(x => x.dispose())
      return g
    }
    return {
      // Same height as the original Higgsfield road ribbon: above terrain tiles (y <= .062)
      // and the dirt trails to each zone (top y .076) where they cross the circuit.
      road: strip(-HALF, HALF, .16),
      edges: merge([strip(-HALF + .25, -HALF + .5, .17), strip(HALF - .5, HALF - .25, .17)]),
      dashes: merge(dividers.map(d => strip(d - .09, d + .09, .17, i => i % 2 === 0))),
    }
  }, [])
}

function Curbs() {
  const ref = useRef()
  const count = N * 2
  useLayoutEffect(() => {
    const m = new THREE.Object3D(), red = new THREE.Color('#d8483c'), white = new THREE.Color('#f2eee6')
    let k = 0
    for (let i = 0; i < N; i++) for (const side of [-1, 1]) {
      const a = trackPoint(i, side * (HALF + .45)), b = trackPoint(i + 1, side * (HALF + .45))
      m.position.set((a.x + b.x) / 2, .17, (a.z + b.z) / 2)
      m.rotation.set(0, Math.atan2(-(b.x - a.x), -(b.z - a.z)), 0)
      m.scale.set(1, 1, Math.hypot(b.x - a.x, b.z - a.z) + .02)
      m.updateMatrix()
      ref.current.setMatrixAt(k, m.matrix)
      ref.current.setColorAt(k++, i % 2 ? red : white)
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [])
  return <instancedMesh ref={ref} args={[null, null, count]} receiveShadow>
    <boxGeometry args={[.9, .14, 1]}/><meshStandardMaterial roughness={.85}/>
  </instancedMesh>
}

function FinishLine() {
  const ref = useRef(), p = trackPoint(FINISH_INDEX), cols = 16
  useLayoutEffect(() => {
    const m = new THREE.Object3D(), black = new THREE.Color('#1d1f23'), white = new THREE.Color('#f4f4f0')
    for (let row = 0; row < 2; row++) for (let c = 0; c < cols; c++) {
      m.position.set(-HALF + (c + .5) * ROAD_WIDTH / cols, .175, (row - .5) * .9)
      m.updateMatrix()
      ref.current.setMatrixAt(row * cols + c, m.matrix)
      ref.current.setColorAt(row * cols + c, (row + c) % 2 ? black : white)
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [])
  return <group position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} name="GRAND_CIRCUIT_finish">
    <instancedMesh ref={ref} args={[null, null, cols * 2]}><boxGeometry args={[ROAD_WIDTH / cols, .02, .9]}/><meshStandardMaterial roughness={.7}/></instancedMesh>
    <Gantry color="#b8f65e" height={6} banner/>
  </group>
}

function Gantry({color, height = 5, banner = false}) {
  const span = ROAD_WIDTH + 2.2
  return <group>
    {[-1, 1].map(side => <mesh key={side} position={[side * span / 2, height / 2, 0]} castShadow>
      <boxGeometry args={[.8, height, .8]}/><meshStandardMaterial color="#2f3438" roughness={.8}/>
    </mesh>)}
    <mesh position={[0, height, 0]} castShadow><boxGeometry args={[span + .8, banner ? 1.4 : .8, .8]}/><meshStandardMaterial color="#2f3438" roughness={.8}/></mesh>
    <mesh position={[0, height, .42]}><boxGeometry args={[span - .6, banner ? .9 : .38, .05]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.55}/></mesh>
    <mesh position={[0, height, -.42]}><boxGeometry args={[span - .6, banner ? .9 : .38, .05]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.55}/></mesh>
  </group>
}

function Checkpoint({index, color}) {
  const p = trackPoint(index)
  return <group position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} name={`GRAND_CIRCUIT_checkpoint_${index}`}><Gantry color={color} height={4.6}/></group>
}

function BoostPad({pad}) {
  return <group position={[pad.x, .18, pad.z]} rotation={[0, pad.yaw, 0]}>
    <mesh><boxGeometry args={[3.1, .05, 3.6]}/><meshStandardMaterial color="#2b2f33" roughness={.6}/></mesh>
    {[-1, 0, 1].map(k => <group key={k} position={[0, .04, k * 1.05]}>
      {[-1, 1].map(s => <mesh key={s} position={[s * .52, 0, .3]} rotation={[0, s * Math.PI / 4, 0]}>
        <boxGeometry args={[1.35, .03, .32]}/><meshStandardMaterial color="#ffb347" emissive="#ff8a1f" emissiveIntensity={.9}/>
      </mesh>)}
    </group>)}
  </group>
}

function Coins() {
  const ref = useRef(), m = useMemo(() => new THREE.Object3D(), [])
  useFrame(({clock}) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    COINS.forEach((c, i) => {
      m.position.set(c.x, .95 + Math.sin(t * 2.2 + i) * .12, c.z)
      m.rotation.set(0, t * 1.8 + i, 0)
      m.updateMatrix()
      ref.current.setMatrixAt(i, m.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[null, null, COINS.length]} frustumCulled={false}>
    <boxGeometry args={[.7, .7, .18]}/><meshStandardMaterial color="#ffd23f" emissive="#c98a00" emissiveIntensity={.45} metalness={.3} roughness={.35}/>
  </instancedMesh>
}

export default function RaceCircuit() {
  const {road, edges, dashes} = useStrips()
  return <group name="GRAND_CIRCUIT">
    <mesh geometry={road} receiveShadow><meshStandardMaterial color="#454950" roughness={.93}/></mesh>
    <mesh geometry={edges}><meshStandardMaterial color="#f3f1ea" roughness={.8}/></mesh>
    <mesh geometry={dashes}><meshStandardMaterial color="#f3f1ea" roughness={.8}/></mesh>
    <Curbs/>
    <FinishLine/>
    <Checkpoint index={CHECKPOINT_1_INDEX} color="#74edff"/>
    <Checkpoint index={CHECKPOINT_2_INDEX} color="#ffb357"/>
    {BOOST_PADS.map(pad => <BoostPad key={pad.index} pad={pad}/>)}
    <Coins/>
  </group>
}
