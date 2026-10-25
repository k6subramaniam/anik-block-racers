import React,{useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {VILLAGERS} from './villagerAI.js'

/** Twelve animated humanoids in ten instanced GPU batches rather than
 * hundreds of separate meshes. A block-world silhouette without copying
 * protected game textures or character likenesses. */
const PARTS=[
  {name:'torso',size:[.84,.91,.47],n:1},
  {name:'head',size:[.74,.71,.66],n:1},
  {name:'hair',size:[.78,.20,.71],n:1},
  {name:'nose',size:[.15,.19,.22],n:1},
  {name:'eye',size:[.12,.12,.055],n:2},
  {name:'arm',size:[.29,.8,.34],n:2},
  {name:'leg',size:[.33,.85,.35],n:2},
  {name:'shoe',size:[.35,.2,.45],n:2},
  {name:'badge',size:[.23,.19,.06],n:1},
]
const tmp=new THREE.Object3D()
const turn=new THREE.Quaternion()
const swingQuaternion=new THREE.Quaternion()
const up=new THREE.Vector3(0,1,0)
const axis=new THREE.Vector3(1,0,0)
const pos=new THREE.Vector3()
const sc=new THREE.Vector3(1,1,1)
const mapColor=(value)=>new THREE.Color(value)
function piecePlacement(v,part,index,phase,bob){
  const x=part==='eye'?(index===0?-.2:.2):part==='arm'?(index===0?-.63:.63):part==='leg'||part==='shoe'?(index===0?-.25:.25):0
  let y=0,z=0,tilt=0
  if(part==='torso')y=1.38
  if(part==='head')y=2.27
  if(part==='hair')y=2.64
  if(part==='nose'){y=2.22;z=-.42}
  if(part==='eye'){y=2.37;z=-.345}
  if(part==='arm'){y=1.38;tilt=(index===0?-1:1)*phase*.58;z=Math.sin(tilt)*.28}
  if(part==='leg'){y=.54;tilt=(index===0?1:-1)*phase*.57;z=Math.sin(tilt)*.28}
  if(part==='shoe'){y=.12;z=-.06+(index===0?1:-1)*Math.sin(phase)*.18}
  if(part==='badge'){y=1.52;z=-.26}
  return {x,y:y+bob,z,tilt}
}
export default function VoxelVillagers({villagerRef,playerRef,mode,phase}){
  const batches=useRef({})
  const allocations=useMemo(()=>PARTS.map(part=>({...part,total:VILLAGERS.length*part.n})),[])
  useEffect(()=>{
    for(const part of allocations){
      const mesh=batches.current[part.name];if(!mesh)continue
      VILLAGERS.forEach((v,i)=>{
        for(let k=0;k<part.n;k++){
          const shade=part.name==='torso'||part.name==='arm'?v.tunic:part.name==='head'||part.name==='nose'?v.skin:part.name==='hair'?v.hat:part.name==='eye'?'#182229':part.name==='badge'?'#f1d36c':part.name==='leg'?'#3d5861':'#262936'
          mesh.setColorAt(i*part.n+k,mapColor(shade))
        }
      })
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true
    }
  },[allocations])
  useFrame(({clock})=>{
    const actors=villagerRef.current||[]
    const player=playerRef.current
    for(const part of allocations){
      const mesh=batches.current[part.name];if(!mesh)continue
      actors.forEach((v,i)=>{
        const far=mode!=='explore'||!player||Math.hypot(v.x-player.x,v.z-player.z)>66
        const phaseShift=v.walking?Math.sin(v.walkCycle):0
        const bob=v.walking?Math.abs(Math.sin(v.walkCycle))*0.045:Math.sin(clock.elapsedTime*.8+i)*.014
        turn.setFromAxisAngle(up,v.yaw)
        for(let k=0;k<part.n;k++){
          const pose=piecePlacement(v,part.name,k,phaseShift,bob)
          pos.set(pose.x,pose.y,pose.z).applyQuaternion(turn).add(new THREE.Vector3(v.x,0,v.z))
          swingQuaternion.setFromAxisAngle(axis,pose.tilt)
          tmp.position.copy(pos)
          tmp.quaternion.copy(turn).multiply(swingQuaternion)
          sc.setScalar(far ? 0.001 : 1)
          tmp.scale.copy(sc)
          tmp.updateMatrix()
          mesh.setMatrixAt(i*part.n+k,tmp.matrix)
        }
      })
      mesh.instanceMatrix.needsUpdate=true
      // Deliberately no bounding sphere culling: instances wander through six biomes.
      mesh.frustumCulled=false
    }
  })
  return <group name="ANIK_WALKING_BLOCK_VILLAGERS" visible={mode==='explore'}>
    {allocations.map(part=><instancedMesh
      key={part.name} ref={el=>{if(el)batches.current[part.name]=el}}
      args={[null,null,part.total]} castShadow={false} receiveShadow={false}
      name={`BLOCK_PEDESTRIAN_${part.name}`}>
      <boxGeometry args={part.size}/>
      <meshStandardMaterial color="#ffffff" roughness={.91} metalness={0}/>
    </instancedMesh>)}
  </group>
}
