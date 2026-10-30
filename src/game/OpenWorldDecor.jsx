import React, {useEffect, useMemo, useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {nearestRoad,ROAD_WIDTH} from './track.js'
import {LANDMARK_OBSTACLES,RELICS,WORLD_BOUNDS,ZONES} from './openWorld.js'

/** Instanced ambient vegetation adds life across the large world at just a
 * handful of draw calls, keeping Galaxy GPU load lower than hundreds of meshes.
 * These are small, non-collidable foliage pieces, not solid obstacles.
 */
function deterministicRandom(seed){
  let x=seed>>>0
  return ()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}
}

const PATCHES=(()=>{
  const rng=deterministicRandom(61029), bushes=[],rocks=[],mushrooms=[]
  for(let k=0;k<850;k++){
    const x=(rng()-.5)*285,z=(rng()-.5)*238
    if(nearestRoad({x,z}).distance<ROAD_WIDTH/2+2.6)continue
    if(Math.abs(x)<6 && z< -33 && z> -110)continue // central portal pathway
    if(ZONES.some(p=>Math.hypot(p.x-x,p.z-z)<13))continue
    if(LANDMARK_OBSTACLES.some(o=>Math.hypot(o.x-x,o.z-z)<o.radius+3))continue
    const item={x,z,scale:.6+rng()*1.2,heading:rng()*Math.PI*2}
    const count=bushes.length+rocks.length+mushrooms.length
    if(count>=260)break
    if(x < -39 && z>35)rocks.push(item)
    else if(x>39&&z>35)rocks.push(item)
    else if(x>39&&z< -34)mushrooms.push(item)
    else bushes.push(item)
  }
  return {bushes,rocks,mushrooms}
})()

function Scatter({items,color,size}){
  const ref=useRef()
  useEffect(()=>{
    if(!ref.current)return
    const temp=new THREE.Object3D()
    for(let i=0;i<items.length;i++){
      const p=items[i]
      temp.position.set(p.x,size[1]*.5*p.scale-.01,p.z)
      temp.rotation.set(0,p.heading,0)
      temp.scale.set(p.scale,p.scale,p.scale)
      temp.updateMatrix()
      ref.current.setMatrixAt(i,temp.matrix)
    }
    ref.current.instanceMatrix.needsUpdate=true
    ref.current.computeBoundingSphere?.()
  },[items,size[0],size[1],size[2]])
  return <instancedMesh ref={ref} args={[null,null,items.length]} castShadow={false} receiveShadow={false}>
    <boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.95}/>
  </instancedMesh>
}

export function OpenWorldDecor(){
  return <group name="OW_GPU_instanced_landscape">
    <Scatter items={PATCHES.bushes} color="#4a9561" size={[1.7,1.25,1.45]}/>
    <Scatter items={PATCHES.rocks} color="#967e70" size={[1.5,1.1,1.55]}/>
    <Scatter items={PATCHES.mushrooms} color="#b867e1" size={[1.3,.9,1.3]}/>
  </group>
}

export function RelicMarkers({collected=[]}){
  const groupRef=useRef()
  useFrame(({clock})=>{
    if(!groupRef.current)return
    groupRef.current.children.forEach((node,i)=>{
      node.rotation.y=clock.elapsedTime*.8+i*.7
      node.position.y=1.85+Math.sin(clock.elapsedTime*2+i*.6)*.3
    })
  })
  const found=useMemo(()=>new Set(collected),[collected])
  return <group ref={groupRef} name="OW_world_relics">
    {RELICS.map((relic,i)=>found.has(relic.id)?null:<group key={relic.id} name={`OW_PICKUP_${relic.id}`} position={[relic.x,1.85,relic.z]}>
      <mesh rotation={[.28,Math.PI/4,.28]}><octahedronGeometry args={[1.38,0]}/><meshStandardMaterial color={relic.color} roughness={.23} metalness={.1} emissive={relic.color} emissiveIntensity={.4}/></mesh>
      <mesh position={[0,-1.13,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.2,1.5,24]}/><meshBasicMaterial color={relic.color} transparent opacity={.78} side={THREE.DoubleSide}/></mesh>
    </group>)}
  </group>
}
