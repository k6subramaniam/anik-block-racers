import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { TRACK, trackBarriers } from './track.js'
import { advanceKart, initialRaceState, SPAWN, MAX_SPEED } from './simulation.js'
import { advanceExplore, fastTravel, initialExploreState, LANDMARK_OBSTACLES } from './openWorld.js'
import { OpenWorldDecor, RelicMarkers } from './OpenWorldDecor.jsx'

const MODEL_URL = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xFRdnQaeZpG4RsfN9xIl0GlMG/0e25123b-02d4-42d1-bc43-5e507f5f3998.glb'
const walls = trackBarriers()
const boostLocations = [28,70,105,143].map(index => ({index, ...TRACK[index]}))
const coinLocations = [12,21,34,42,57,64,81,93,116,123,133,151].map(index => ({index, ...TRACK[index]}))

function makeGameAssets(scene) {
  const track = scene.clone(true)
  // The Higgsfield level includes kart prefabs in the editor; race mode draws
  // a separate playable clone so the parked display models do not double up.
  const kartSource = scene.getObjectByName('PREFAB_kart_emerald')
  if (!kartSource) throw new Error('The Higgsfield GLB is missing PREFAB_kart_emerald.')
  const kart = kartSource.clone(true)
  kart.position.set(0,0,0)
  kart.rotation.set(0,0,0)
  kart.scale.set(1,1,1)
  const objects = []
  const cullRoots = []
  track.updateMatrixWorld(true)
  track.traverse(child => {
    if (child.name === 'PREFAB_kart_emerald' || child.name === 'PREFAB_kart_amber' || child.isCamera || child.isLight) child.visible = false
    if (child.type === 'Object3D' && child.name.startsWith('OW_HERO_') && child.children.length) cullRoots.push(child)
    if (child.isMesh) {
      child.receiveShadow = child.name.startsWith('TRACK_') || child.name.startsWith('ENV_')
      child.castShadow = child.name.startsWith('CASTLE_') || child.name.includes('crown') || child.name.includes('hood')
      // Imported mesh geometries already contain their intended material colors.
      child.frustumCulled = true
    }
    if (child.type === 'Object3D' && (child.name.startsWith('PREFAB_voxel_pine_') || child.name.startsWith('PREFAB_stone_boulder_') || child.name === 'PREFAB_central_castle')) {
      const p = new THREE.Vector3()
      child.getWorldPosition(p)
      objects.push({ id: child.name, x: p.x, z: p.z, radius: child.name.includes('castle') ? 4.9 : child.name.includes('boulder') ? 1.15 : .6 })
    }
  })
  return { track, kart, objects, cullRoots }
}

function StaticColliders({ objects, mode }) {
  return <>
    {/* Invisible fixed Rapier volumes correspond to the visible Higgsfield curbs. */}
    {mode==='race' && walls.map(w => <CuboidCollider key={w.id} position={[w.x,.56,w.z]} rotation={[0,w.yaw,0]} args={[w.length/2,.65,.19]} />)}
    {objects.map(o => <CuboidCollider key={o.id} position={[o.x,.8,o.z]} args={[o.radius,.8,o.radius]} />)}
  </>
}

function TrackFx({ vehicleRef, phase }) {
  const ring = useRef()
  useFrame((_,dt) => {
    if(!ring.current) return
    ring.current.rotation.z += dt*1.6
    const v = vehicleRef.current
    ring.current.position.set(v.x,.36,v.z)
    ring.current.visible = (phase==='racing'||phase==='exploring') && (v.boostTimer||0)>0
  })
  return <group ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,.36,0]} visible={false}>
    <mesh>
      <torusGeometry args={[1.12,.045,8,48]} />
      <meshBasicMaterial color="#baff43" transparent opacity={.62} />
    </mesh>
  </group>
}

function Racer({ kart, objects, cullRoots, phase, mode, warpRequest, resetToken, inputRef, cameraMode, setHud, onEvent, onPhase }) {
  const rigid = useRef(null)
  const race = useRef(initialRaceState())
  const elapsedHudRefresh = useRef(0)
  const cameraTarget = useRef(new THREE.Vector3(SPAWN.x,1.1,SPAWN.z))
  const lastCollisionToast = useRef(-5)
  const lastCoinTick = useRef(new Map())
  const nextCull = useRef(0)
  const { camera } = useThree()

  useEffect(() => {
    const fresh = mode==='explore' ? initialExploreState() : initialRaceState()
    race.current = fresh
    elapsedHudRefresh.current = 0
    lastCoinTick.current = new Map()
    cameraTarget.current.set(fresh.x,1.1,fresh.z)
    nextCull.current=0
    if(rigid.current){
      rigid.current.setTranslation({ x: fresh.x, y: 0, z: fresh.z },true)
      rigid.current.setRotation({x:0,y:Math.sin(fresh.yaw/2),z:0,w:Math.cos(fresh.yaw/2)},true)
      rigid.current.setNextKinematicTranslation({x:fresh.x,y:0,z:fresh.z})
    }
    setHud({ ...fresh, countdown: 3, coins: 0 })
  }, [resetToken, mode, setHud])

  useEffect(()=>{
    if(mode!=='explore'||!warpRequest)return
    const fresh=fastTravel(race.current,warpRequest.zoneId)
    race.current=fresh
    if(rigid.current){
      rigid.current.setTranslation({x:fresh.x,y:0,z:fresh.z},true)
      rigid.current.setRotation({x:0,y:Math.sin(fresh.yaw/2),z:0,w:Math.cos(fresh.yaw/2)},true)
      rigid.current.setNextKinematicTranslation({x:fresh.x,y:0,z:fresh.z})
    }
    cameraTarget.current.set(fresh.x,1.2,fresh.z)
    setHud({...fresh})
    onEvent('travel',fresh)
  },[mode,warpRequest,setHud,onEvent])

  useFrame((_,rawDt) => {
    // Catch up on elapsed wall time in safe 50 ms simulation substeps. This also
    // keeps races responsive on phones or software-rendered WebGL devices.
    const frameDt=Math.min(Math.max(rawDt,0),.30)
    const smoothDt=Math.min(frameDt,.05)
    let next=race.current
    let frameEvent=null
    if(phase === 'racing' || phase==='exploring'){
      let remaining=frameDt
      while(remaining>0.00001){
        const dt=Math.min(.05,remaining)
        remaining-=dt
        const old=next
        next=mode==='explore'
          ? advanceExplore(old,inputRef.current,dt,objects)
          : advanceKart(old,inputRef.current,dt,objects)
        next.boostTimer=Math.max(0,(old.boostTimer||0)-dt)
        next.boostCooldown=Math.max(0,(old.boostCooldown||0)-dt)
        for(const pad of boostLocations){
          if(next.boostCooldown<=0 && Math.hypot(next.x-pad.x,next.z-pad.z)<2.0){
            next={...next,boostTimer:1.5,boostCooldown:2,speed:Math.min(MAX_SPEED+7,Math.max(12,Math.abs(next.speed)+8)),event:'boost'}
            break
          }
        }
        let coins=mode==='race' ? old.coins||0 : next.coins||0
        for(const coin of (mode==='race'?coinLocations:[])){
          if(!lastCoinTick.current.has(coin.index) && Math.hypot(next.x-coin.x,next.z-coin.z)<1.15){
            lastCoinTick.current.set(coin.index,true)
            coins++
            if(!next.event)next.event='coin'
          }
        }
        next.coins=coins
        if(next.event){
          if(next.event==='wall' || next.event==='obstacle'||next.event==='border'){
            if(next.elapsed-lastCollisionToast.current>.9){
              lastCollisionToast.current=next.elapsed
              frameEvent=next.event
            }
          }else{
            frameEvent=next.event
          }
          if(next.event==='finished')break
        }
      }
      race.current=next
      if(frameEvent) onEvent(frameEvent,next)
      if(mode==='race' && next.event==='finished') onPhase('finished')
    }
    // Coarse frustum-distance gating: distant hero districts don't cost phone
    // GPU draw calls when they are hundreds of metres from the camera.
    if(cullRoots && (nextCull.current-=frameDt)<=0){
      nextCull.current=.35
      for(const root of cullRoots){
        const dx=root.position.x-next.x,dz=root.position.z-next.z
        root.visible=dx*dx+dz*dz < (mode==='explore'?150:140)**2
      }
    }
    if(rigid.current){
      rigid.current.setNextKinematicTranslation({x:next.x,y:0,z:next.z})
      rigid.current.setNextKinematicRotation({x:0,y:Math.sin(next.yaw/2),z:0,w:Math.cos(next.yaw/2)})
    }

    // The camera follows vehicle orientation, never a fixed world-axis or flat 2D projection.
    const front=new THREE.Vector3(-Math.sin(next.yaw),0,-Math.cos(next.yaw))
    const target=new THREE.Vector3(next.x,1.45,next.z)
    const cameraLerp=1-Math.exp(-5*smoothDt)
    if(cameraMode==='aerial'){
      const desired=new THREE.Vector3(next.x,33,next.z+2)
      camera.position.lerp(desired,cameraLerp)
      camera.up.set(0,0,-1)
    }else{
      const chaseLength=Math.max(8,8+Math.abs(next.speed)*.065)
      const desired=target.clone().addScaledVector(front,-chaseLength).add(new THREE.Vector3(0,4.4,0))
      camera.position.lerp(desired,cameraLerp)
      camera.up.set(0,1,0)
    }
    cameraTarget.current.lerp(target,1-Math.exp(-7*smoothDt))
    camera.lookAt(cameraTarget.current)
    const desiredFov=cameraMode==='aerial'?48:Math.min(68,54+Math.abs(next.speed)*.45)
    if(Math.abs(camera.fov-desiredFov)>.12){camera.fov=THREE.MathUtils.lerp(camera.fov,desiredFov,cameraLerp);camera.updateProjectionMatrix()}

    elapsedHudRefresh.current+=frameDt
    if(elapsedHudRefresh.current>.105 || frameEvent){
      elapsedHudRefresh.current=0
      setHud({
        x:next.x,z:next.z,yaw:next.yaw,
        speed:next.speed,lap:next.lap,checkpoint:next.checkpoint,
        elapsed:next.elapsed,bestLap:next.bestLap,collisions:next.collisions,
        coins:next.coins||0, boostTimer:next.boostTimer||0,
        zoneName:next.zoneName||'VOXEL VALLEY',
        visited:next.visited||[],collected:next.collected||[],
      })
    }
  })

  return <>
    <RigidBody ref={rigid} type="kinematicPosition" colliders={false} position={[SPAWN.x,0,SPAWN.z]} rotation={[0,SPAWN.yaw,0]} ccd canSleep={false}>
      <CuboidCollider args={[.75,.46,1.2]} position={[0,.65,0]} friction={.8} restitution={.15} />
      <primitive object={kart} />
    </RigidBody>
    <TrackFx vehicleRef={race} phase={phase} />
  </>
}

function LoadedLevel(props){
  const gltf=useGLTF(MODEL_URL)
  const {track,kart,objects,cullRoots}=useMemo(()=>makeGameAssets(gltf.scene),[gltf.scene])
  const collidable=useMemo(()=>props.mode==='explore'?[...objects,...LANDMARK_OBSTACLES]:objects,[props.mode,objects])
  // Only the High preset renders real-time shadow maps on mobile GPUs.
  useEffect(()=>{
    track.traverse(child=>{if(child.isMesh) child.castShadow=!!props.budget.objectsCastShadows && (child.name.startsWith('CASTLE_')||child.name.includes('crown')||child.name.includes('hood'))})
    kart.traverse(child=>{if(child.isMesh) child.castShadow=!!props.budget.objectsCastShadows})
  },[track,kart,props.budget.objectsCastShadows])
  useEffect(()=>{props.onReady(true)},[props.onReady])
  return <>
    <primitive object={track} />
    <OpenWorldDecor />
    {props.mode==='explore' && <RelicMarkers collected={props.hudCollected||[]} />}
    <Physics gravity={[0,0,0]} timeStep={1/60} colliders={false} interpolation={false}>
      <StaticColliders objects={objects} mode={props.mode} />
      <Racer {...props} kart={kart} objects={collidable} cullRoots={cullRoots} />
    </Physics>
  </>
}

export default function RacingScene(props){
  const budget=props.budget
  return <Canvas className="game-canvas" shadows={budget.shadows} dpr={budget.dpr}
    camera={{position:[10,9,29],fov:54,near:.1,far:420}}
    gl={{alpha:false,antialias:budget.antialias,powerPreference:'high-performance',stencil:false}}>
    <color attach="background" args={['#adcee1']} />
    <fog attach="fog" args={['#adcee1',135,230]} />
    <ambientLight intensity={1.75} />
    <hemisphereLight args={['#e6f6ff','#619768',1.05]} />
    <directionalLight castShadow={budget.shadows} position={[-22,38,12]} intensity={2.2} shadow-mapSize-width={budget.shadowMap} shadow-mapSize-height={budget.shadowMap} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-bias={-.00015} />
    <React.Suspense fallback={null}>
      <LoadedLevel {...props} />
    </React.Suspense>
  </Canvas>
}

useGLTF.preload(MODEL_URL)
