import React,{useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {BATTLE_LIMITS} from './rules.js'
import {ITEM_BOXES} from './items.js'
/** Fixed-size GPU pools: blast effects never allocate meshes during play. */
const MAX=72,BITS=12,BOXES=ITEM_BOXES.length
export default function BattleFX({battleRef,enabledRef,playerRef}){
 const objects=useRef(),lights=useRef(),rings=useRef(),pieces=useRef(),supply=useRef(),boxes=useRef(),group=useRef()
 const work=useMemo(()=>({dummy:new THREE.Object3D(),color:new THREE.Color()}),[])
 useFrame(()=>{
  if(!objects.current||!lights.current||!rings.current||!pieces.current||!supply.current||!boxes.current)return
  const b=battleRef.current,enabled=enabledRef.current
  group.current.visible=enabled;if(!enabled)return
  const {dummy,color}=work,p=playerRef.current
  const put=(mesh,i,x,y,z,w,h,d,c,rz=0)=>{
   dummy.position.set(x,y,z)
   if(mesh===rings.current){dummy.scale.set(w,w,1);dummy.rotation.set(-Math.PI/2,0,0)}
   else if(mesh===boxes.current){dummy.scale.set(w,h,d);dummy.rotation.set(.62,rz,.62)}
   else {dummy.scale.set(w,h,d);dummy.rotation.set(0,rz,0)}
   dummy.updateMatrix()
   mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(c))
  }
  let oi=0,li=0,ri=0,bi=0,si=0,xi=0
  for(const h of b.hazards){
   if(h.cooldown>0||Math.hypot(h.x-p.x,h.z-p.z)>105)continue
   if(h.kind==='rocket'){
    const yaw=Math.atan2(h.vx,h.vz)
    put(objects.current,oi++,h.x,h.y,h.z,.38,.38,1.5,'#e8403a',yaw)
    put(lights.current,li++,h.x-Math.sin(yaw)*.95,h.y,h.z-Math.cos(yaw)*.95,.32,.32,.5,'#ffd37a',yaw)
    continue
   }
   if(h.kind==='oil'){
    put(objects.current,oi++,h.x,.19,h.z,3.4,.03,3.4,'#1a1626',b.time*.2)
    put(rings.current,ri++,h.x,.22,h.z,1.9,.02,1.9,h.arm>0?'#75e3f7':'#8a5cff')
    continue
   }
   const mine=h.kind==='mine',bomb=h.kind==='bomb',alert=h.fuse!==null&&h.kind!=='bomb'
   const shade=alert?'#ffce66':bomb?'#b485ff':mine?'#ffad4f':'#ed7352'
   put(objects.current,oi++,h.x,bomb?h.y:mine?.35:.85,h.z,mine?1.25:bomb?.65:1.1,mine?.25:bomb?.65:1.35,mine?1.25:bomb?.65:1.1,shade,bomb?b.time*3:0)
   put(lights.current,li++,h.x,bomb?h.y+.45:mine?.53:1.57,h.z,.4,.15,.4,h.arm>0?'#7fe1fd':alert?'#fff2bf':'#f6e29a')
   const radius=alert?(h.kind==='mine'?6:7):mine?1.9:.9
   const pulse=alert?1+.035*Math.sin(b.time*14):1
   put(rings.current,ri++,h.x,.205,h.z,radius*pulse,.025,radius*pulse,alert?'#ff9854':h.arm>0?'#75e3f7':'#e4c87e')
  }
  for(const pad of b.supplies){if(pad.cooldown>0)continue
   const c=pad.kind==='repair'?'#86ee99':'#81dcef'
   put(supply.current,si++,pad.x,.31,pad.z,2.6,.18,2.6,c)
   put(lights.current,li++,pad.x,1.0+Math.sin(b.time*2)*.1,pad.z,.65,.65,.65,c,b.time)
  }
  // Item boxes spin and bob in rainbow colours; a taken box is hidden while it regrows.
  for(const box of b.itemBoxes||[]){
   if(box.cooldown>0||Math.hypot(box.x-p.x,box.z-p.z)>105)continue
   color.setHSL((b.time*.25+xi*.13)%1,.85,.6)
   put(boxes.current,xi++,box.x,1.15+Math.sin(b.time*3+xi)*.15,box.z,1.15,1.15,1.15,color.getStyle(),b.time*1.6+xi)
  }
  for(const blast of b.bursts){
   const t=blast.age/.85
   put(rings.current,ri++,blast.x,.26,blast.z,Math.max(.1,t*blast.radius),.03,Math.max(.1,t*blast.radius),'#ffd08a')
   for(let i=0;i<BITS;i++){
    const a=i*Math.PI*2/BITS,travel=.3+t*blast.radius*.7,scale=Math.max(.03,(1-t)*.5)
    put(pieces.current,bi++,blast.x+Math.sin(a)*travel,.6+Math.sin(t*Math.PI)*2.8+(i%3)*.18,blast.z+Math.cos(a)*travel,scale,scale,scale,i%2?'#ffd791':'#f6a167',a+t*4)
   }
  }
  for(const [mesh,count] of [[objects.current,oi],[lights.current,li],[rings.current,ri],[pieces.current,bi],[supply.current,si],[boxes.current,xi]]){
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true
  }
 })
 return <group ref={group} name="BATTLE_RACE_MINES_BOMBS_AND_BLASTS">
  <instancedMesh ref={objects} args={[null,null,MAX]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={.8} flatShading/></instancedMesh>
  <instancedMesh ref={lights} args={[null,null,MAX+8]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial toneMapped={false}/></instancedMesh>
  <instancedMesh ref={rings} args={[null,null,MAX+BATTLE_LIMITS.bursts]} frustumCulled={false}><torusGeometry args={[1,.045,4,24]}/><meshBasicMaterial transparent opacity={.65} depthWrite={false}/></instancedMesh>
  <instancedMesh ref={pieces} args={[null,null,BATTLE_LIMITS.bursts*BITS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial/></instancedMesh>
  <instancedMesh ref={supply} args={[null,null,4]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={.9}/></instancedMesh>
  <instancedMesh ref={boxes} args={[null,null,BOXES]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={.35} metalness={.15} emissive="#3a2a55" emissiveIntensity={.6} transparent opacity={.92}/></instancedMesh>
 </group>
}
