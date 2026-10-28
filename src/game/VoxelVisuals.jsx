import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { classifyVoxelSurface, pixelTileData, PIXEL_SIZE, VOXEL_TERRAIN, VOXEL_TREES, VOXEL_FLOWERS, VOXEL_HILLS } from './voxelStyle.js'

export function createPixelTexture(kind = 'stone', repeatX = 1, repeatY = 1) {
  const texture = new THREE.DataTexture(pixelTileData(kind), PIXEL_SIZE, PIXEL_SIZE, THREE.RGBAFormat)
  texture.name = `ANIK_${kind}_16px_original`
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapNearestFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 1
  texture.needsUpdate = true
  return texture
}
export function voxelizeSceneMaterials(...scenes) {
  const textures = new Map(), materials = new Map()
  function textureFor(kind) {
    if (!textures.has(kind)) textures.set(kind, createPixelTexture(kind))
    return textures.get(kind)
  }
  for (const scene of scenes) scene.traverse(child => {
    if (!child.isMesh || !child.material) return
    const recolor = orig => {
      if (!orig || !orig.isMaterial || orig.isShaderMaterial) return orig
      const kind = classifyVoxelSurface(orig.name, child.name)
      const key = `${orig.uuid}:${kind}`
      if (!materials.has(key)) {
        const mat = orig.clone()
        mat.name = `ANIK_pixel_${kind}_${orig.name || 'original'}`
        mat.map = textureFor(kind)
        mat.flatShading = true
        if ('roughness' in mat) mat.roughness = Math.max(.62, mat.roughness || .7)
        if ('metalness' in mat && kind !== 'glass' && kind !== 'glow') mat.metalness = Math.min(.15, mat.metalness || 0)
        mat.needsUpdate = true
        materials.set(key, mat)
      }
      return materials.get(key)
    }
    child.material = Array.isArray(child.material) ? child.material.map(recolor) : recolor(child.material)
  })
  return { materials: materials.size, textures: textures.size,
    dispose: () => { for (const m of materials.values()) m.dispose(); for (const t of textures.values()) t.dispose() } }
}
function InstancedBlocks({ items, transform, colorOf, palette = '#ffffff', texture, name }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < items.length; i++) {
      const p = transform(items[i], i)
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(0, p.rotation || 0, 0)
      dummy.scale.set(p.w, p.h, p.d)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      if (colorOf) ref.current.setColorAt(i, new THREE.Color(colorOf(items[i], i)))
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items, transform, colorOf])
  return <instancedMesh name={name} ref={ref} args={[null,null,items.length]} castShadow={false} receiveShadow={false} frustumCulled>
    <boxGeometry args={[1,1,1]}/>
    <meshStandardMaterial map={texture} color={palette} roughness={1} metalness={0} flatShading/>
  </instancedMesh>
}
const stem = t => ({x:t.x,y:t.height*.5,z:t.z,w:1.0,h:t.height,d:1.0})
const canopy = t => ({x:t.x,y:t.height+.35,z:t.z,w:t.canopy,h:2.2,d:t.canopy})
const canopyTop = t => ({x:t.x,y:t.height+1.78,z:t.z,w:t.canopy*.72,h:1.35,d:t.canopy*.72})
const crownColor = t => t.shade ? '#4c9c3c' : '#3f8a34'
const crownColorTop = t => t.shade ? '#65b84b' : '#4b9f43'
const hillDirt = h => ({x:h.x,y:h.height*.5,z:h.z,w:3.18,h:h.height,d:3.18})
const hillGrass = h => ({x:h.x,y:h.height+.06,z:h.z,w:3.23,h:.13,d:3.23})
const flowerStem = f => ({x:f.x,y:f.size*.48,z:f.z,w:.15,h:f.size,d:.15})
const flowerHead = f => ({x:f.x,y:f.size+.08,z:f.z,w:.54,h:.43,d:.54})
const petalColor = f => ['#f8d35a','#ef7793','#e2a0fa','#9de7f2'][f.color]
export function VoxelLandscape({ budget }) {
  const textures = useMemo(() => ({
    grass:createPixelTexture('grass'), dirt:createPixelTexture('dirt'),
    leaves:createPixelTexture('leaves'), oak:createPixelTexture('oak'),
    wool:createPixelTexture('wool'),
  }), [])
  const ground = useMemo(() => VOXEL_TERRAIN.map(t => ({
    ...t, texture:createPixelTexture(t.type, Math.max(1,Math.ceil(t.w/3.2)), Math.max(1,Math.ceil(t.h/3.2))),
  })), [])
  useEffect(() => () => { Object.values(textures).forEach(t=>t.dispose()); ground.forEach(g=>g.texture.dispose()) }, [textures,ground])
  const flowers = budget?.tier === 'eco' ? VOXEL_FLOWERS.slice(0,85) : VOXEL_FLOWERS
  return <group name="ANIK_ORIGINAL_PIXEL_WORLD_16PX">
    {ground.map(tile => <mesh key={tile.id} name={`VOXEL_TERRAIN_${tile.id}`}
      position={[tile.x,tile.y,tile.z]} rotation={[-Math.PI/2,0,0]} receiveShadow={false}>
      <planeGeometry args={[tile.w,tile.h]}/>
      <meshStandardMaterial color={tile.color} map={tile.texture} roughness={1} metalness={0} flatShading polygonOffset polygonOffsetFactor={-1}/>
    </mesh>)}
    <InstancedBlocks name="VOXEL_stepped_dirt_hills" items={VOXEL_HILLS} transform={hillDirt} texture={textures.dirt} palette="#a57948"/>
    <InstancedBlocks name="VOXEL_hill_grass_caps" items={VOXEL_HILLS} transform={hillGrass} texture={textures.grass} palette="#4a8c37"/>
    <InstancedBlocks name="VOXEL_oak_trunks" items={VOXEL_TREES} transform={stem} texture={textures.oak} palette="#9e754b"/>
    <InstancedBlocks name="VOXEL_oak_block_foliage" items={VOXEL_TREES} transform={canopy} colorOf={crownColor} texture={textures.leaves}/>
    <InstancedBlocks name="VOXEL_oak_crown_layers" items={VOXEL_TREES} transform={canopyTop} colorOf={crownColorTop} texture={textures.leaves}/>
    <InstancedBlocks name="VOXEL_flower_stems" items={flowers} transform={flowerStem} texture={textures.grass} palette="#4a9135"/>
    <InstancedBlocks name="VOXEL_flower_squares" items={flowers} transform={flowerHead} colorOf={petalColor} texture={textures.wool}/>
  </group>
}
const CLOUDS = Object.freeze(Array.from({length:22},(_,i)=>{
  const a=(i*1.6180339887498948)%1, b=(i*.41421356237)%1
  return { x:(a-.5)*345, z:(b-.5)*315, y:52+(i%4)*7, width:10+(i%5)*2 }
}))
const CLOUD_PARTS=Object.freeze(CLOUDS.flatMap((cloud,i)=>[
  {x:cloud.x,y:cloud.y,z:cloud.z,w:cloud.width,h:2.0,d:5.6},
  {x:cloud.x-cloud.width*.32,y:cloud.y+1.45,z:cloud.z+.7,w:cloud.width*.60,h:1.4,d:5.8},
  {x:cloud.x+cloud.width*.44,y:cloud.y-1.25,z:cloud.z-1.7,w:cloud.width*.66,h:1.7,d:4.1},
]))
const cloudPos = c => ({x:c.x,y:c.y,z:c.z,w:c.w,h:c.h,d:c.d})
export function VoxelSky({ clockRef }) {
  const drifting = useRef(), sun = useRef(), moon = useRef(), skyRoot = useRef()
  const {camera}=useThree()
  const cloudsMaterial = useMemo(() => new THREE.MeshBasicMaterial({color:'#eff9f3',transparent:true,opacity:.84,depthWrite:false,fog:true}),[])
  useEffect(()=>()=>cloudsMaterial.dispose(),[cloudsMaterial])
  const ref=useRef()
  useEffect(()=>{
    if(!ref.current)return
    const d=new THREE.Object3D()
    for(let i=0;i<CLOUD_PARTS.length;i++){
      const p=CLOUD_PARTS[i]
      d.position.set(p.x,p.y,p.z);d.scale.set(p.w,p.h,p.d);d.updateMatrix()
      ref.current.setMatrixAt(i,d.matrix)
    }
    ref.current.instanceMatrix.needsUpdate=true
    ref.current.computeBoundingSphere()
  },[])
  useFrame(()=>{
    const env=clockRef.current
    if(skyRoot.current)skyRoot.current.position.set(camera.position.x,0,camera.position.z)
    if(!env)return
    const time=env.seconds||0, daylight=env.daylight ?? 1
    if(drifting.current) drifting.current.position.x=Math.sin(time*.006)*13 + Math.cos(time*.003)*4
    cloudsMaterial.color.setRGB(.58+.36*daylight,.62+.34*daylight,.68+.30*daylight)
    cloudsMaterial.opacity=.55 + (env.cloudCover||0)*.42
    if(sun.current){
      sun.current.visible=daylight>.20
      sun.current.position.set(0+Math.cos(env.sunAngle)*85,55+Math.sin(env.sunAngle)*39,-72)
    }
    if(moon.current){
      moon.current.visible=daylight<.58
      moon.current.position.set(-65*Math.cos(env.sunAngle),65,-70)
    }
  })
  return <group ref={skyRoot} name="VOXEL_CUBIC_CLOUDS_AND_SKY">
    <group ref={drifting}>
      <instancedMesh ref={ref} name="VOXEL_sky_cloud_blocks" args={[null,null,CLOUD_PARTS.length]} frustumCulled={false}>
        <boxGeometry args={[1,1,1]}/><primitive object={cloudsMaterial} attach="material"/>
      </instancedMesh>
    </group>
    <mesh ref={sun} name="VOXEL_square_sun" position={[0,70,-72]}>
      <boxGeometry args={[10,10,2]}/><meshBasicMaterial color="#ffeb96" toneMapped={false} fog={false}/>
    </mesh>
    <mesh ref={moon} name="VOXEL_square_moon" position={[-45,67,-75]}>
      <boxGeometry args={[8,8,2]}/><meshBasicMaterial color="#d3e4ff" toneMapped={false} fog={false}/>
    </mesh>
  </group>
}
