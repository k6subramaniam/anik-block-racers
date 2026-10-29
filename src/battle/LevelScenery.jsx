import React, { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeLevelScenery } from './levelArt.js'

// Two instanced batches keep the five level themes inexpensive on mobile GPUs.
// Decorative blocks never enter the physics solver or obstruct racing controls.
function applyInstances(mesh, parts) {
  if (!mesh || !parts.length) return
  const transform = new THREE.Object3D()
  const color = new THREE.Color()
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    transform.position.set(p.x, p.y, p.z)
    transform.rotation.set(0, p.yaw || 0, 0)
    transform.scale.set(p.w, p.h, p.d)
    transform.updateMatrix()
    mesh.setMatrixAt(i, transform.matrix)
    mesh.setColorAt(i, color.set(p.color))
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}

export default function LevelScenery({ track, budget }) {
  const solid = useRef()
  const lights = useRef()
  const data = useMemo(() => makeLevelScenery(track, budget?.tier), [track, budget?.tier])
  useLayoutEffect(() => {
    applyInstances(solid.current, data.solid)
    applyInstances(lights.current, data.glow)
  }, [data])
  if (!data.theme) return null
  return <group name={'ANIK_REFERENCE_LEVEL_' + track.id}>
    {data.solid.length > 0 && <instancedMesh ref={solid} args={[null, null, data.solid.length]} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[1, 1, 1]}/>
      <meshStandardMaterial color="#ffffff" roughness={.95} flatShading/>
    </instancedMesh>}
    {data.glow.length > 0 && <instancedMesh ref={lights} args={[null, null, data.glow.length]} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[1, 1, 1]}/>
      <meshBasicMaterial color="#ffffff" toneMapped={false}/>
    </instancedMesh>}
  </group>
}
