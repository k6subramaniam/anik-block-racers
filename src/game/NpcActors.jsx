import React, {useEffect, useMemo, useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {makeNpcs} from './npcAI.js'

/** Voxel pets are original, friendly fantasy creatures, not realistic animals.
 * They are small, legible meshes: eight NPCs cost less than one textured city.
 */
function VoxelCritter({def}){
  const isBoar=def.species==='boar'
  const isSheep=def.species==='sheep'
  const isCub=def.species==='cub'
  const bodyColor=def.color
  const eye='#13202e'
  return <group name={`voxel-${def.species}`}>
    <mesh position={[0,.91,.10]} castShadow={false}><boxGeometry args={[1.45,.93,1.96]}/><meshStandardMaterial color={bodyColor} roughness={.91}/></mesh>
    {isSheep&&<mesh position={[0,1.42,.1]}><boxGeometry args={[1.68,.45,1.7]}/><meshStandardMaterial color={bodyColor} roughness={1}/></mesh>}
    <mesh position={[0,1.24,-.78]}><boxGeometry args={[1.25,1.13,1.03]}/><meshStandardMaterial color={bodyColor} roughness={.85}/></mesh>
    {[-.37,.37].map(x=><mesh key={x} position={[x,1.45,-1.315]}><boxGeometry args={[.18,.20,.065]}/><meshBasicMaterial color={eye}/></mesh>)}
    {[-.43,.43].map(x=><mesh key={`ear-${x}`} position={[x,1.91,-.87]} rotation={[0,0,x*.22]}><boxGeometry args={[.31,isBoar?.49:.38,.27]}/><meshStandardMaterial color={bodyColor}/></mesh>)}
    {isBoar && <mesh position={[0,1.06,-1.43]}><boxGeometry args={[.53,.34,.37]}/><meshStandardMaterial color="#f5bcac"/></mesh>}
    {isCub && <mesh position={[0,1.0,-1.38]}><boxGeometry args={[.45,.3,.25]}/><meshStandardMaterial color="#f4e0ca"/></mesh>}
    {[-.47,.47].flatMap(x=>[-.48,.64].map(z=><mesh key={`leg-${x}-${z}`} position={[x,.34,z]}><boxGeometry args={[.36,.69,.43]}/><meshStandardMaterial color={bodyColor} roughness={1}/></mesh>))}
    <mesh position={[0,1.00,1.16]} rotation={[.45,0,0]}><boxGeometry args={[.37,.43,isSheep?.35:.72]}/><meshStandardMaterial color={isSheep?'#fffafa':bodyColor}/></mesh>
    <mesh position={[0,.2,-1.0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.15,12]}/><meshBasicMaterial color="#000000" transparent opacity={.12} depthWrite={false}/></mesh>
  </group>
}

function Burst({def,assign}){
  return <group ref={assign} visible={false} name={`NPC_BURST_${def.id}`}>
    {Array.from({length:10},(_,i)=>{
      const angle=(Math.PI*2*i)/10
      return <mesh key={i} userData={{angle}} position={[Math.cos(angle)*.2,1.05,Math.sin(angle)*.2]}>
        <boxGeometry args={[.28,.28,.28]}/>
        <meshBasicMaterial color={i%3===0?'#ffe79d':def.color} transparent opacity={.95}/>
      </mesh>
    })}
  </group>
}

function BotHealth({def,assign}){
  return <group ref={assign} position={[0,def.kind==='racer'?2.55:2.35,0]}>
    <mesh position={[0,0,-.015]}><planeGeometry args={[1.63,.25]}/><meshBasicMaterial color="#172431" depthTest={false} depthWrite={false}/></mesh>
    <mesh name="healthFill" position={[0,0,.015]}><planeGeometry args={[1.52,.14]}/><meshBasicMaterial color={def.kind==='racer'?'#76ffc3':'#d3f78c'} depthTest={false} depthWrite={false}/></mesh>
  </group>
}

function buildBotKart(source,def){
  const model=source.clone(true)
  model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.set(1,1,1)
  model.traverse(child=>{
    if(!child.isMesh)return
    child.castShadow=false;child.receiveShadow=false
    if(/_(body|hood|helm|rear_wing)$/.test(child.name)){
      child.material=child.material.clone()
      child.material.color.set(def.color)
      child.material.needsUpdate=true
    }
  })
  return model
}

/** Reads the fast-changing simulation refs without React state updates at 60fps. */
export default function NpcActors({npcRef,playerRef,kartSource,mode}){
  const defs=useMemo(()=>makeNpcs(mode),[mode])
  const models=useMemo(()=>Object.fromEntries(defs.filter(n=>n.kind==='racer').map(n=>[n.id,buildBotKart(kartSource,n)])),[defs,kartSource])
  const roots=useRef({}),bars=useRef({}),bursts=useRef({})
  useFrame(({camera,clock})=>{
    const states=npcRef.current||[]
    const near=playerRef.current
    for(const n of states){
      const actor=roots.current[n.id],bar=bars.current[n.id],burst=bursts.current[n.id]
      if(!actor)continue
      const visible=!near||((n.x-near.x)**2+(n.z-near.z)**2)<(n.kind==='racer'&&mode==='race'?115:100)**2
      actor.visible=visible&&n.health>0&&n.respawn<=0
      if(actor.visible){
        const hop=n.kind==='animal'?.055*Math.sin(clock.elapsedTime*6+n.name.length):0
        actor.position.set(n.x,hop,n.z)
        actor.rotation.y=n.yaw
        const pulse=n.hitCooldown>.78?1.07:1
        actor.scale.setScalar(pulse)
        if(bar){
          bar.quaternion.copy(camera.quaternion)
          const fill=bar.getObjectByName('healthFill')
          if(fill){const ratio=Math.max(0,Math.min(1,n.health/n.maxHp));fill.scale.x=Math.max(.001,ratio);fill.position.x=-(1-ratio)*.76}
          bar.visible=n.health<n.maxHp||n.kind==='racer'
        }
      }
      if(burst){
        burst.visible=visible&&n.respawn>0&&n.burst>0
        if(burst.visible){
          burst.position.set(n.x,0,n.z)
          const p=1-n.burst/.72
          for(const bit of burst.children){
            const angle=bit.userData.angle
            bit.position.set(Math.cos(angle)*(p*2.0+.28),1.1+p*2.4+Math.sin(angle*5)*p*.5,Math.sin(angle)*(p*2.0+.28))
            bit.rotation.set(p*4,p*3+angle,p*4)
            bit.scale.setScalar(Math.max(.08,1-p))
          }
        }
      }
    }
  })
  return <group name="AI_racers_and_voxel_wildlife">
    {defs.map(def=><group key={def.id}>
      <group ref={el=>{if(el)roots.current[def.id]=el}} name={`AI_${def.kind}_${def.id}`} position={[def.x,0,def.z]} rotation={[0,def.yaw,0]}>
        {def.kind==='racer'?<primitive object={models[def.id]} />:<VoxelCritter def={def}/>}
        <BotHealth def={def} assign={el=>{if(el)bars.current[def.id]=el}}/>
      </group>
      <Burst def={def} assign={el=>{if(el)bursts.current[def.id]=el}}/>
    </group>)}
  </group>
}
