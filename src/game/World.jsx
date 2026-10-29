import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { TRACK, trackBarriers } from './track.js'
import { advanceKart, initialRaceState, SPAWN, MAX_SPEED } from './simulation.js'
import { advanceExplore, fastTravel, initialExploreState, LANDMARK_OBSTACLES } from './openWorld.js'
import { OpenWorldDecor, RelicMarkers } from './OpenWorldDecor.jsx'
import {makeNpcs, advanceNpcs, applyRamming} from './npcAI.js'
import NpcActors from './NpcActors.jsx'
import VoxelVillagers from './VoxelVillagers.jsx'
import {makeVillagers,advanceVillagers,nearbyVillager,talkToVillager} from './villagerAI.js'
import {environmentAt} from './environment.js'
import {SkyAndWeather,WaterWorld,WeatherParticles} from './WorldAtmosphere.jsx'
import {VoxelLandscape,VoxelSky,voxelizeSceneMaterials} from './VoxelVisuals.jsx'
import {VOXEL_TREE_COLLIDERS} from './voxelStyle.js'
import FrontierWorld from './FrontierWorld.jsx'
import {buildObstacleIndex, nearbyObstacles} from './frontier.js'
import {initialBattle,stepBattle} from '../battle/rules.js'
import {useBattleStore,battleSnapshot} from '../battle/BattleUI.jsx'
import BattleFX from '../battle/BattleFX.jsx'

const MODEL_URL = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xFRdnQaeZpG4RsfN9xIl0GlMG/26710d53-03e1-4327-b94a-59f07e46a89f.glb'
const walls = trackBarriers()
const boostLocations = [28,70,105,143].map(index => ({index, ...TRACK[index]}))
const coinLocations = [12,21,34,42,57,64,81,93,116,123,133,151].map(index => ({index, ...TRACK[index]}))

function makeGameAssets(scene) {
  const track = scene.clone(true)
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
    if (child.type === 'Object3D' && (child.name.startsWith('OW_HERO_') || child.name.startsWith('OW_PROP_BLOCKHAVEN_') || child.name.startsWith('OW_PROP_VILLAGE_') || child.name.startsWith('OW_PROP_MARKET_')) && child.children.length) cullRoots.push(child)
    if (child.isMesh) {
      child.receiveShadow = child.name.startsWith('TRACK_') || child.name.startsWith('ENV_')
      child.castShadow = child.name.startsWith('CASTLE_') || child.name.includes('crown') || child.name.includes('hood')
      child.frustumCulled = true
    }
    if (child.type === 'Object3D' && (child.name.startsWith('PREFAB_voxel_pine_') || child.name.startsWith('PREFAB_stone_boulder_') || child.name === 'PREFAB_central_castle')) {
      const p = new THREE.Vector3()
      child.getWorldPosition(p)
      objects.push({ id: child.name, x: p.x, z: p.z, radius: child.name.includes('castle') ? 4.9 : child.name.includes('boulder') ? 1.15 : .6 })
    }
  })
  const voxelStyle = voxelizeSceneMaterials(track, kart)
  return { track, kart, objects, cullRoots, voxelStyle }
}

function StaticColliders({ objects, mode }) {
  return <>
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
    <mesh><torusGeometry args={[1.12,.045,8,48]} /><meshBasicMaterial color="#baff43" transparent opacity={.62} /></mesh>
  </group>
}

function Racer({ battleRef, battleEnabledRef, kart, objects, obstacleIndex, cullRoots, npcRef, villagerRef, playerRef, weatherClockRef, phase, mode, warpRequest, talkRequest, resetToken, inputRef, cameraMode, setHud, onEvent, onPhase }) {
  const battleStore=useBattleStore()
  const lastBattleEnabled=useRef(battleStore.enabled)
  const rigid = useRef(null)
  const race = playerRef
  const elapsedHudRefresh = useRef(0)
  const cameraTarget = useRef(new THREE.Vector3(SPAWN.x,1.1,SPAWN.z))
  const lastCollisionToast = useRef(-5)
  const lastCoinTick = useRef(new Map())
  const nextCull = useRef(0)
  const lastWeather = useRef('clear')
  const { camera } = useThree()
  // Freeze the visible timer on the exact simulation state at the pause
  // transition. The normal throttled HUD paints at ~10Hz and could otherwise
  // show a stale race time for one final update after the player pauses.
  useLayoutEffect(()=>{
    if(phase!=='paused')return
    const s=race.current
    elapsedHudRefresh.current=0
    setHud(old=>({...old,elapsed:s.elapsed,lap:s.lap,checkpoint:s.checkpoint,coins:s.coins||0}))
  },[phase,setHud,race])
  useLayoutEffect(()=>{
    battleStore.update(battleSnapshot(battleRef.current,phase,mode))
    if(phase!=='racing'){
      battleRef.current.lastBomb=battleStore.actions.bomb
      battleRef.current.lastMine=battleStore.actions.mine
    }
  },[phase,mode,battleStore,battleRef])

  useEffect(() => {
    const fresh = mode==='explore' ? initialExploreState() : initialRaceState()
    race.current = fresh
    battleRef.current=initialBattle()
    battleStore.actions={bomb:0,mine:0}
    battleStore.update(battleSnapshot(battleRef.current,phase,mode))
    npcRef.current=makeNpcs(mode)
    villagerRef.current=makeVillagers()
    elapsedHudRefresh.current = 0
    lastCoinTick.current = new Map()
    cameraTarget.current.set(fresh.x,1.1,fresh.z)
    nextCull.current=0
    lastWeather.current=weatherClockRef.current.kind
    if(rigid.current){
      rigid.current.setTranslation({ x: fresh.x, y: 0, z: fresh.z },true)
      rigid.current.setRotation({x:0,y:Math.sin(fresh.yaw/2),z:0,w:Math.cos(fresh.yaw/2)},true)
      rigid.current.setNextKinematicTranslation({x:fresh.x,y:0,z:fresh.z})
    }
    setHud({ ...fresh, countdown: 3, coins: 0, botsDefeated:0, smashScore:0, rivalKnockouts:0, wildlifeKnockouts:0, rivalsActive:3, wildlifeActive:mode==='explore'?8:0 })
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
    setHud({...fresh,botsDefeated:fresh.botsDefeated||0,smashScore:fresh.smashScore||0})
    onEvent('travel',fresh)
  },[mode,warpRequest,setHud,onEvent])

  useEffect(()=>{
    if(!talkRequest || mode!=='explore' || phase!=='exploring')return
    const friend=nearbyVillager(villagerRef.current,race.current,4.25)
    if(!friend)return
    if(Math.abs(race.current.speed)>4.5){
      onEvent('villager-slow',{...race.current,villagerName:friend.name})
      return
    }
    const spoken=talkToVillager(race.current,friend)
    race.current=spoken.state
    setHud(old=>({...old,coins:spoken.state.coins,metVillagers:spoken.state.metVillagers,nearbyVillager:{name:friend.name,role:friend.role}}))
    onEvent('villager-chat',{...spoken.state,villagerName:friend.name,villagerLine:spoken.dialogue?.line,firstMeeting:spoken.firstMeeting})
  },[talkRequest,mode,phase,villagerRef,setHud,onEvent,race])

  useFrame((_,rawDt) => {
    const frameDt=Math.min(Math.max(rawDt,0),.30)
    const smoothDt=Math.min(frameDt,.05)
    let next=race.current
    if(lastBattleEnabled.current!==battleStore.enabled){
      lastBattleEnabled.current=battleStore.enabled;battleRef.current=initialBattle()
      npcRef.current=npcRef.current.map(n=>({...n,blastOffsetX:0,blastOffsetZ:0,blastShield:0}))
    }
    const battling=battleStore.enabled&&mode==='race'
    battleEnabledRef.current=battling
    let frameEvent=null
    if(phase === 'racing' || phase==='exploring'){
      let remaining=frameDt
      while(remaining>0.00001){
        const dt=Math.min(.05,remaining)
        remaining-=dt
        const old=next
        const wasRecovering=battling&&battleRef.current.respawn>0
        const recoveringInput=battling&&(wasRecovering||battleRef.current.stun>0)?{}:inputRef.current
        next=mode==='explore'
          ? advanceExplore(old,inputRef.current,dt,nearbyObstacles(obstacleIndex,old),weatherClockRef.current)
          : wasRecovering?{...old,speed:0,event:null,elapsed:old.elapsed+dt}
          : advanceKart(old,recoveringInput,dt,objects,weatherClockRef.current)
        const oldNpcs=npcRef.current
        const moving=advanceNpcs(oldNpcs,dt,next,mode)
        if(mode==='explore')villagerRef.current=advanceVillagers(villagerRef.current,dt,next)
        const impact=(wasRecovering||next.event==='finished')?{player:next,npcs:moving,event:null}:applyRamming(next,moving,dt)
        npcRef.current=impact.npcs
        if(impact.event){
          next={...impact.player,event:impact.event.kind,npcName:impact.event.npcName,
            npcKind:impact.event.npcKind,hitDamage:impact.event.damage,
            botsDefeated:(old.botsDefeated||0)+impact.racerKnockouts+impact.animalKnockouts,
            rivalKnockouts:(old.rivalKnockouts||0)+impact.racerKnockouts,
            wildlifeKnockouts:(old.wildlifeKnockouts||0)+impact.animalKnockouts,
            smashScore:(old.smashScore||0)+impact.points}
          frameEvent=impact.event.kind
        }
        if(battling&&next.event!=='finished'){
          const combat=stepBattle(battleRef.current,next,npcRef.current,dt,battleStore.actions,{previousPlayer:old,previousBots:oldNpcs})
          battleRef.current=combat.battle;next=combat.player;npcRef.current=combat.bots
          const priority=['player-wreck','battle-respawn','player-blast','blast-knockout','repair','ammo','bomb-thrown','mine-dropped','rival-weapon']
          const notice=priority.map(kind=>combat.battle.events.find(e=>e.kind===kind)).find(Boolean)
          if(notice)battleRef.current.notice={...notice,time:combat.battle.time}
        }
        next.boostTimer=Math.max(0,(next.boostTimer||0)-dt)
        next.boostCooldown=Math.max(0,(old.boostCooldown||0)-dt)
        for(const pad of boostLocations){
          if(next.event!=='finished' && !(battling&&battleRef.current.respawn>0) && !next.inWater && next.boostCooldown<=0 && Math.hypot(next.x-pad.x,next.z-pad.z)<2.0){
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
            if(next.elapsed-lastCollisionToast.current>.9){lastCollisionToast.current=next.elapsed;frameEvent=next.event}
          }else frameEvent=next.event
          if(next.event==='finished')break
        }
      }
      race.current=next
      if(frameEvent) onEvent(frameEvent,next)
      if(weatherClockRef.current.kind!==lastWeather.current){
        lastWeather.current=weatherClockRef.current.kind
        onEvent('weather-change',{...next,weatherLabel:weatherClockRef.current.label})
      }
      if(mode==='race' && next.event==='finished') onPhase('finished')
    }
    if(cullRoots && (nextCull.current-=frameDt)<=0){
      nextCull.current=.35
      for(const root of cullRoots){
        const dx=root.position.x-next.x,dz=root.position.z-next.z
        root.visible=dx*dx+dz*dz < (mode==='explore'?150:140)**2
      }
    }
    if(kart){
      const b=battleRef.current
      kart.visible=!(battling&&b.respawn>0)
      kart.position.y=battling&&b.stun>0?Math.sin(b.stun/.65*Math.PI)*.55:0
      kart.rotation.z=battling&&b.stun>0?Math.sin(b.stun*20)*.12:0
    }
    if(rigid.current){
      rigid.current.setNextKinematicTranslation({x:next.x,y:-1.55*(next.submersion||0),z:next.z})
      rigid.current.setNextKinematicRotation({x:0,y:Math.sin(next.yaw/2),z:0,w:Math.cos(next.yaw/2)})
    }
    const front=new THREE.Vector3(-Math.sin(next.yaw),0,-Math.cos(next.yaw))
    const target=new THREE.Vector3(next.x,1.45-.47*(next.submersion||0),next.z)
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
      battleStore.update(battleSnapshot(battleRef.current,phase,mode))
      setHud({
        x:next.x,z:next.z,yaw:next.yaw,
        speed:next.speed,lap:next.lap,checkpoint:next.checkpoint,
        elapsed:next.elapsed,bestLap:next.bestLap,collisions:next.collisions,
        coins:next.coins||0, boostTimer:next.boostTimer||0,
        botsDefeated:next.botsDefeated||0, smashScore:next.smashScore||0,
        rivalKnockouts:next.rivalKnockouts||0, wildlifeKnockouts:next.wildlifeKnockouts||0,
        rivalsActive:npcRef.current.filter(n=>n.kind==='racer'&&n.health>0).length,
        wildlifeActive:npcRef.current.filter(n=>n.kind==='animal'&&n.health>0).length,
        zoneName:next.zoneName||'VOXEL VALLEY',
        visited:next.visited||[],collected:next.collected||[],
        metVillagers:next.metVillagers||[],
        nearbyVillager:mode==='explore'?(()=>{const person=nearbyVillager(villagerRef.current,next);return person?{name:person.name,role:person.role}:null})():null,
        weather:weatherClockRef.current.label,worldTime:weatherClockRef.current.time,
        rain:weatherClockRef.current.rain,snow:weatherClockRef.current.snow,
        windSpeed:weatherClockRef.current.windSpeed,daylight:weatherClockRef.current.daylight,
        inWater:!!next.inWater,waterTimer:next.waterTimer||0,
        submersion:next.submersion||0,waterId:next.waterId||null,
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
  const {track,kart,objects,cullRoots,voxelStyle}=useMemo(()=>makeGameAssets(gltf.scene),[gltf.scene])
  useEffect(()=>()=>voxelStyle.dispose(),[voxelStyle])
  const collidable=useMemo(()=>props.mode==='explore'?[...objects,...LANDMARK_OBSTACLES,...VOXEL_TREE_COLLIDERS]:objects,[props.mode,objects])
  const obstacleIndex=useMemo(()=>buildObstacleIndex(collidable),[collidable])
  const npcRef=useRef(makeNpcs(props.mode))
  const villagerRef=useRef(makeVillagers())
  const playerRef=props.environmentPlayerRef
  const battleRef=useRef(initialBattle()),battleEnabledRef=useRef(false)
  useEffect(()=>{
    track.traverse(child=>{if(child.isMesh) child.castShadow=!!props.budget.objectsCastShadows && (child.name.startsWith('CASTLE_')||child.name.includes('crown')||child.name.includes('hood'))})
    kart.traverse(child=>{if(child.isMesh) child.castShadow=!!props.budget.objectsCastShadows})
  },[track,kart,props.budget.objectsCastShadows])
  useEffect(()=>{props.onReady(true)},[props.onReady])
  return <>
    <primitive object={track} />
    <VoxelLandscape budget={props.budget} />
    <OpenWorldDecor />
    <FrontierWorld playerRef={playerRef} budget={props.budget}/>
    <WaterWorld clockRef={props.weatherClockRef} playerRef={playerRef} phase={props.phase} mode={props.mode}/>
    <NpcActors key={props.mode} npcRef={npcRef} playerRef={playerRef} kartSource={kart} mode={props.mode} />
    {props.mode==='explore' && <VoxelVillagers villagerRef={villagerRef} playerRef={playerRef} mode={props.mode} phase={props.phase} />}
    {props.mode==='explore' && <RelicMarkers collected={props.hudCollected||[]} />}
    <Physics gravity={[0,0,0]} timeStep={1/60} colliders={false} interpolation={false}>
      <StaticColliders objects={objects} mode={props.mode} />
      <Racer {...props} battleRef={battleRef} battleEnabledRef={battleEnabledRef} kart={kart} objects={collidable} obstacleIndex={obstacleIndex} cullRoots={cullRoots} npcRef={npcRef} villagerRef={villagerRef} playerRef={playerRef} />
    </Physics>
    <BattleFX battleRef={battleRef} enabledRef={battleEnabledRef} playerRef={playerRef}/>
  </>
}

export default function RacingScene(props){
  const budget=props.budget
  const weatherClockRef=useRef(environmentAt(0))
  const environmentPlayerRef=useRef(initialRaceState())
  const setHud=props.setHud
  const weatherPreviewHud=React.useCallback(env=>setHud(old=>({...old,worldTime:env.time,weather:env.label,daylight:env.daylight,windSpeed:env.windSpeed})),[setHud])
  return <Canvas className="game-canvas" shadows={budget.shadows} dpr={budget.dpr}
    camera={{position:[10,9,29],fov:54,near:.1,far:720}}
    gl={{alpha:false,antialias:budget.antialias,powerPreference:'high-performance',stencil:false}}>
    <color attach="background" args={['#adcee1']} />
    <fog attach="fog" args={['#adcee1',135,230]} />
    <SkyAndWeather clockRef={weatherClockRef} phase={props.phase} previewRequest={props.weatherPreviewRequest} budget={budget} onWeatherPreview={weatherPreviewHud}/>
    <VoxelSky clockRef={weatherClockRef}/>
    <WeatherParticles clockRef={weatherClockRef} playerRef={environmentPlayerRef} phase={props.phase} budget={budget}/>
    <React.Suspense fallback={null}>
      <LoadedLevel {...props} weatherClockRef={weatherClockRef} environmentPlayerRef={environmentPlayerRef} />
    </React.Suspense>
  </Canvas>
}
useGLTF.preload(MODEL_URL)
