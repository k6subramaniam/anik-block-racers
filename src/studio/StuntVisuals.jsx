import React,{useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
const PROPS=20,PADS=8,BURSTS=24,BITS=7
/** All stunt props use static-size GPU pools to keep Galaxy draw calls bounded. */
export default function StuntVisuals({stateRef,reduced=false}){
 const crates=useRef(),ramps=useRef(),arrows=useRef(),debris=useRef(),glow=useRef()
 const temp=useMemo(()=>({obj:new THREE.Object3D(),color:new THREE.Color()}),[])
 useFrame(()=>{
  const s=stateRef.current.state,world=s.stunts
  if(!world||!crates.current||!ramps.current||!arrows.current||!debris.current||!glow.current)return
  const {obj,color}=temp
  const put=(mesh,i,x,y,z,w,h,d,c,yaw=0,tilt=0)=>{
   obj.position.set(x,y,z);obj.rotation.set(tilt,yaw,0,'YXZ');obj.scale.set(w,h,d);obj.updateMatrix()
   mesh.setMatrixAt(i,obj.matrix);mesh.setColorAt(i,color.set(c))
  }
  let i=0,j=0,b=0,g=0
  for(const prop of world.props){
   if(i>=PROPS)break
   const open=prop.cooldown<=0
   put(crates.current,i++,prop.x,prop.y+(open?.8:0),prop.z,open?1.7:.01,open?1.65:.01,open?1.7:.01,prop.variant%2?'#eb9a5a':'#c76f51')
  }
  for(;i<PROPS;i++)put(crates.current,i,0,0,0,.001,.001,.001,'#ffffff')
  for(const p of world.pads){
   if(j>=PADS)break
   const active=p.cooldown<=0,scale=active?1:.3
   put(ramps.current,j,p.x,p.y+.17,p.z,5*scale,.3,4.7*scale,active?'#4ee9dd':'#536d73',p.yaw,-.16)
   put(arrows.current,j,p.x,p.y+.4,p.z,2.3*scale,.15,.75*scale,'#dfff94',p.yaw,-.16)
   j++
  }
  for(;j<PADS;j++){put(ramps.current,j,0,0,0,.001,.001,.001,'#ffffff');put(arrows.current,j,0,0,0,.001,.001,.001,'#ffffff')}
  const limit=reduced?3:BITS
  for(const burst of world.bursts.slice(-BURSTS)){
   const t=Math.min(1,burst.age/.85),radius=t*4.5,scale=Math.max(.01,(1-t)*.68)
   if(g<BURSTS){put(glow.current,g++,burst.x,burst.y+.12,burst.z,.2+t*5,.05,.2+t*5,'#dbf98a')}
   for(let k=0;k<limit&&b<BURSTS*BITS;k++){
    const angle=k/limit*Math.PI*2
    put(debris.current,b++,burst.x+Math.sin(angle)*radius,burst.y+.5+Math.sin(t*Math.PI)*3,burst.z+Math.cos(angle)*radius,scale,scale,scale,k%2?'#ffe290':'#eb975a',angle+t*3)
   }
  }
  for(const [mesh,count] of [[crates.current,PROPS],[ramps.current,PADS],[arrows.current,PADS],[debris.current,b],[glow.current,g]]){
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true
  }
 })
 return <group name="ANIK_DESTRUCTIBLE_STUNTS_AND_JUMP_PADS">
  <instancedMesh ref={crates} args={[null,null,PROPS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#ffffff" roughness={.9} flatShading/></instancedMesh>
  <instancedMesh ref={ramps} args={[null,null,PADS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#ffffff" roughness={.62} emissive="#14504a" emissiveIntensity={.4}/></instancedMesh>
  <instancedMesh ref={arrows} args={[null,null,PADS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#ffffff"/></instancedMesh>
  <instancedMesh ref={debris} args={[null,null,BURSTS*BITS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#ffffff"/></instancedMesh>
  <instancedMesh ref={glow} args={[null,null,BURSTS]} frustumCulled={false}><ringGeometry args={[.94,1,20]}/><meshBasicMaterial color="#ffffff" transparent opacity={.75} depthWrite={false} side={THREE.DoubleSide}/></instancedMesh>
 </group>
}
