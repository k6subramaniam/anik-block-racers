import React,{useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {createPixelTexture} from './VoxelVisuals.jsx'
import {FRONTIER_CHUNKS,FRONTIER_LANDMARKS,FRONTIER_ROADS,FRONTIER_ZONES,frontierBudget} from './frontier.js'
const PALETTES={forest:{ground:'#639b42',wood:'#937044',leaf:'#4c8e40',stone:'#91a68b'},snow:{ground:'#b9d9dc',wood:'#718c9b',leaf:'#e0f6ee',stone:'#85c7d4'},sand:{ground:'#cda76b',wood:'#aa7844',leaf:'#bd884e',stone:'#d8b57e'},redrock:{ground:'#ad7453',wood:'#8d513d',leaf:'#a36342',stone:'#d28757'}}
const IDENTITY_COLOR='#ffffff'
function makeParts(chunk){
  const wood=[],leaf=[],stone=[]
  for(const p of chunk.trees){
    const c=PALETTES[p.biome],common={x:p.x,z:p.z}
    if(p.biome==='sand'||p.biome==='redrock'){
      stone.push({...common,y:p.height*.5,w:1.7,h:p.height,d:1.7,color:c.wood})
      stone.push({...common,y:p.height+.4,w:3.8,h:1.1,d:3.8,color:c.stone})
    }else{
      wood.push({...common,y:p.height*.5,w:1.3,h:p.height,d:1.3,color:c.wood})
      leaf.push({...common,y:p.height+.5,w:p.canopy,h:2.5,d:p.canopy,color:c.leaf})
      leaf.push({...common,y:p.height+2.35,w:p.canopy*.68,h:1.4,d:p.canopy*.68,color:c.leaf})
    }
  }
  return {wood,leaf,stone}
}
function Blocks({parts,material,name}){
  const ref=useRef()
  useEffect(()=>{
    const mesh=ref.current;if(!mesh)return
    const dummy=new THREE.Object3D(),color=new THREE.Color()
    parts.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,p.yaw||0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(p.color||IDENTITY_COLOR))})
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere()
    return()=>{mesh.geometry.dispose();mesh.dispose()}
  },[parts])
  if(!parts.length)return null
  return <instancedMesh ref={ref} args={[null,null,parts.length]} material={material} name={name} dispose={null}><boxGeometry args={[1,1,1]}/></instancedMesh>
}
function Chunk({chunk,materials,register}){
  const parts=useMemo(()=>makeParts(chunk),[chunk])
  return <group ref={node=>register(chunk.id,node)} name={chunk.id}>
    <Blocks parts={parts.wood} material={materials.wood} name="FRONTIER_TRUNKS"/>
    <Blocks parts={parts.leaf} material={materials.leaf} name="FRONTIER_CANOPIES"/>
    <Blocks parts={parts.stone} material={materials.stone} name="FRONTIER_STONE_COLUMNS"/>
  </group>
}
function landmarkParts(p){
  const c=PALETTES[p.biome],out=[]
  const box=(x,y,z,w,h,d,color)=>out.push({x:p.x+x,y,z:p.z+z,w,h,d,color})
  if(p.kind==='tower'){
    box(0,6,0,9,12,9,c.stone);box(0,12.7,0,11,1.4,11,c.wood);box(0,16.5,0,6,7,6,c.wood)
    box(0,20.5,0,9,1.4,9,c.leaf);box(0,21.8,0,5,1.2,5,'#c9ee8a')
    for(const x of [-3,3])box(x,9,-4.6,1.5,2.5,.2,'#b6edf5')
  }else if(p.kind==='cabin'){
    box(0,3.1,0,12,6.2,10,c.stone);box(0,6.6,0,14,1,12,c.wood);box(0,7.6,0,10,1,8,c.wood);box(0,8.6,0,6,1,5,c.wood)
    box(0,1.8,-5.08,2.1,3.5,.2,'#513c2e');for(const x of [-3.8,3.8])box(x,3.7,-5.08,2,1.8,.2,'#afe0d4')
  }else if(p.kind==='giant'&&p.biome==='forest'){
    box(0,9,0,5,18,5,c.wood);box(0,18,0,16,6,16,c.leaf);box(0,23,0,11,4,11,c.leaf);box(0,26,0,6,3,6,'#7ca94b')
  }else{
    for(let i=0;i<4;i++)box(0,2.5+i*5,0,15-i*3,5,15-i*3,i%2?c.stone:c.wood)
    box(0,21,0,5,2,5,p.biome==='snow'?'#a8efff':'#e4cb87')
  }
  return out
}
function Marker({zone}){
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128
    const c=canvas.getContext('2d');c.fillStyle='#173329';c.fillRect(0,0,512,128);c.strokeStyle=zone.color;c.lineWidth=8;c.strokeRect(4,4,504,120)
    c.textAlign='center';c.fillStyle='#f2ffeb';c.font='bold 32px system-ui';c.fillText(zone.name,256,58)
    c.font='20px system-ui';c.fillStyle=zone.color;c.fillText('FRONTIER DISTRICT',256,96)
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t
  },[zone])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <group position={[zone.x+24,0,zone.z+28]}>
    <mesh position={[0,4,0]}><planeGeometry args={[11,2.75]}/><meshBasicMaterial map={texture} side={THREE.DoubleSide}/></mesh>
    {[-4,4].map(x=><mesh key={x} position={[x,1.8,0]}><boxGeometry args={[.35,3.6,.35]}/><meshStandardMaterial color="#7c633d"/></mesh>)}
  </group>
}
export default function FrontierWorld({playerRef,budget}){
  const resources=useMemo(()=>{
    const textures={grass:createPixelTexture('grass',96,96),snow:createPixelTexture('ice',96,96),sand:createPixelTexture('sand',96,96),rock:createPixelTexture('dirt',96,96),oak:createPixelTexture('oak'),leaves:createPixelTexture('leaves'),stone:createPixelTexture('stone')}
    const m=map=>new THREE.MeshStandardMaterial({map,roughness:1,flatShading:true})
    return {textures,materials:{wood:m(textures.oak),leaf:m(textures.leaves),stone:m(textures.stone)}}
  },[])
  useEffect(()=>()=>{Object.values(resources.textures).forEach(t=>t.dispose());Object.values(resources.materials).forEach(m=>m.dispose())},[resources])
  const roots=useRef(new Map()),cooldown=useRef(0)
  const register=useMemo(()=>((id,node)=>{if(node)roots.current.set(id,node);else roots.current.delete(id)}),[])
  const landmarks=useMemo(()=>FRONTIER_LANDMARKS.map(l=>({...l,parts:landmarkParts(l)})),[])
  const {camera}=useThree(),previousPosition=useRef(null)
  const border=useMemo(()=>{const b=[];for(let x=-444;x<=444;x+=24)for(const z of [-380,380])b.push({x,y:.8,z,w:21,h:1.6,d:1,color:'#9e8058'});for(let z=-360;z<=360;z+=24)for(const x of [-455,455])b.push({x,y:.8,z,w:1,h:1.6,d:21,color:'#9e8058'});return b},[])
  useFrame((_,dt)=>{
    const p=playerRef.current;if(!p)return
    const previous=previousPosition.current
    if(previous&&Math.hypot(p.x-previous.x,p.z-previous.z)>80){
      if(camera.up.y<.5)camera.position.set(p.x,33,p.z+2)
      else camera.position.set(p.x+Math.sin(p.yaw)*9,5.85,p.z+Math.cos(p.yaw)*9)
      camera.lookAt(p.x,1.45,p.z);cooldown.current=0
    }
    previousPosition.current={x:p.x,z:p.z}
    cooldown.current-=dt;if(cooldown.current>0)return;cooldown.current=.25
    const distance=frontierBudget(budget.tier).drawDistance
    for(const chunk of FRONTIER_CHUNKS){const g=roots.current.get(chunk.id);if(g)g.visible=Math.hypot(p.x-chunk.x,p.z-chunk.z)<distance+68}
    for(const l of landmarks){const g=roots.current.get(l.id);if(g)g.visible=Math.hypot(p.x-l.x,p.z-l.z)<distance+45}
  })
  const tiles=[[-235,-200,'forest','grass'],[235,-200,'snow','snow'],[-235,200,'sand','sand'],[235,200,'redrock','rock']]
  return <group name="ANIK_EXPANDED_WORLD_906x756">
    {tiles.map(([x,z,biome,key])=><mesh key={biome} rotation={[-Math.PI/2,0,0]} position={[x,-.035,z]}>
      <planeGeometry args={[470,400]}/><meshStandardMaterial map={resources.textures[key]} color={PALETTES[biome].ground} roughness={1}/>
    </mesh>)}
    {FRONTIER_ROADS.map(r=>{
      const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz)
      return <group key={r.id} position={[(r.a[0]+r.b[0])/2,-.012,(r.a[1]+r.b[1])/2]} rotation={[0,-Math.atan2(dz,dx),0]}>
        <mesh><boxGeometry args={[length,.022,r.width]}/><meshStandardMaterial color="#8b8d75" roughness={1}/></mesh>
        <mesh position={[0,.013,0]}><boxGeometry args={[length,.008,.22]}/><meshBasicMaterial color="#ddd6a2"/></mesh>
      </group>
    })}
    <Blocks parts={border} material={resources.materials.wood} name="FRONTIER_VISIBLE_BOUNDARY"/>
    {FRONTIER_CHUNKS.map(chunk=><Chunk key={chunk.id} chunk={chunk} materials={resources.materials} register={register}/>)}
    {landmarks.map(l=><group key={l.id} ref={node=>register(l.id,node)} name={l.id}><Blocks parts={l.parts} material={resources.materials.stone}/></group>)}
    {FRONTIER_ZONES.map(z=><Marker key={z.id} zone={z}/>)}
  </group>
}
