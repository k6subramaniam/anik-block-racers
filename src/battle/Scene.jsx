import React,{Suspense,useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import {Canvas,useFrame} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {createPixelTexture,voxelizeSceneMaterials} from '../game/VoxelVisuals.jsx'
import {WeatherParticles} from '../game/WorldAtmosphere.jsx'
import {atDistance} from './tracks.js'
import StuntVisuals from '../studio/StuntVisuals.jsx'
import {recordRaceReplay} from '../studio/replay.js'
import {stepBattle,BATTLE_STEP,battleRanking,MAX_HAZARDS} from './simulation.js'
const MODEL='https://d2ol7oe51mr4n9.cloudfront.net/user_38xFRdnQaeZpG4RsfN9xIl0GlMG/26710d53-03e1-4327-b94a-59f07e46a89f.glb'
export function battleHud(state,viewerIndex=0){
  const p=state.actors[viewerIndex]||state.actors[0],warnings=state.hazards.filter(h=>h.fuse>=0&&Math.hypot(h.x-p.x,h.z-p.z)<13)
  return {tick:state.tick,seconds:state.tick/60,laps:state.laps,weather:state.weather.label,elevation:p.y||0,crashes:p.crashes||0,stuntScore:p.stuntScore||0,stuntCombo:p.stuntCombo||1,lap:Math.min(state.laps,p.lap),hp:p.hp,shield:p.shield,speed:p.speed,turbo:p.turbo||0,turboCount:p.turboCount||0,
    respawn:p.respawn,bombCooldown:p.bombCooldown,mineCooldown:p.mineCooldown,rank:battleRanking(state).findIndex(a=>a.id===p.id)+1,
    damageTaken:p.damageTaken,knockouts:p.knockouts,totalBlasts:state.totalBlasts,warning:warnings.length?Math.min(...warnings.map(h=>h.fuse)):null,
    actors:state.actors.map(a=>({id:a.id,name:a.name,x:a.x,z:a.z,y:a.y,yaw:a.yaw,s:a.s,hp:a.hp,color:a.color,lap:Math.min(state.laps,a.lap),finished:a.finished})),
    powerups:state.powerups.filter(p=>p.cooldown<=0).length,notice:state.notice}
}
function batchData(mesh,parts){
  const d=new THREE.Object3D(),c=new THREE.Color()
  parts.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(0,p.yaw||0,0);d.scale.set(p.w,p.h,p.d);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);mesh.setColorAt(i,c.set(p.color))})
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere()
}
function roadGeometry(track){
  const vertices=[],uv=[],indices=[],n=track.path.length
  for(let i=0;i<=n;i++){
    const p=atDistance(track,i===n?0:track.arcs[i]),nx=-p.dz,nz=p.dx
    for(const s of [-1,1]){vertices.push(p.x+nx*track.width/2*s,p.y+.03,p.z+nz*track.width/2*s);uv.push((s+1)/2,track.arcs[i]/8)}
    if(i<n){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g
}
function RaceTrack({track}){
  const edge=useRef()
  const resources=useMemo(()=>{
    const g=roadGeometry(track),road=createPixelTexture(track.id==='frost'?'ice':'road',3,1),grass=createPixelTexture(track.id==='canyon'?'sand':track.id==='frost'?'ice':'grass',80,80)
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128
    const c=canvas.getContext('2d');c.fillStyle='#152c33';c.fillRect(0,0,512,128);c.fillStyle=track.color;c.font='bold 46px system-ui';c.textAlign='center';c.fillText('BATTLE RACE',256,62);c.fillStyle='white';c.font='22px system-ui';c.fillText('START / FINISH',256,103)
    const sign=new THREE.CanvasTexture(canvas);sign.colorSpace=THREE.SRGBColorSpace
    return {g,road,grass,sign}
  },[track])
  const parts=useMemo(()=>{
    const list=[]
    for(let s=0;s<track.length;s+=3.8)for(const side of [-1,1]){
      const p=atDistance(track,s,side*(track.width/2+.1))
      list.push({x:p.x,y:p.y+(p.y>1?.65:.2),z:p.z,w:.45,h:p.y>1?1.3:.4,d:3.6,yaw:p.yaw,color:Math.floor(s/3.8)%2?track.color:'#f0f4dd'})
    }
    for(let s=0;s<track.length;s+=22){
      const p=atDistance(track,s)
      if(p.y>3)for(const side of [-1,1]){const q=atDistance(track,s,side*(track.width/2-1.5));list.push({x:q.x,y:q.y/2,z:q.z,w:1.4,h:q.y,d:1.4,color:'#59717b'})}
    }
    for(let i=0;i<75;i++){
      const a=i*Math.PI*2/75,x=Math.cos(a)*(105+(i%4)*5),z=Math.sin(a)*(94+(i%3)*8),h=4+i%5
      list.push({x,y:h/2,z,w:1.6,h,d:1.6,color:track.id==='canyon'?'#a7764d':'#805e3f'})
      list.push({x,y:h+1,z,w:5,h:3,d:5,color:track.id==='frost'?'#d6efeb':track.id==='canyon'?'#c98f62':'#477e3e'})
    }
    const start=track.gates[0]
    for(let x=-5;x<=5;x++)for(let z=-1;z<=1;z++)list.push({x:start.x-start.dz*x+start.dx*z,y:start.y+.055,z:start.z+start.dx*x+start.dz*z,w:.95,h:.015,d:.95,yaw:start.yaw,color:(x+z)%2?'#ffffff':'#1e3037'})
    return list
  },[track])
  useEffect(()=>{batchData(edge.current,parts)},[parts])
  useEffect(()=>()=>{resources.g.dispose();resources.road.dispose();resources.grass.dispose();resources.sign.dispose()},[resources])
  return <group name={`BATTLE_TRACK_${track.id}`}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,0]}><planeGeometry args={[300,280]}/><meshStandardMaterial map={resources.grass} color={track.ground} roughness={1}/></mesh>
    <mesh geometry={resources.g} receiveShadow><meshStandardMaterial map={resources.road} color={track.id==='frost'?'#a0c7d4':'#697578'} roughness={.9} side={THREE.DoubleSide}/></mesh>
    <instancedMesh ref={edge} args={[null,null,parts.length]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={1}/></instancedMesh>
    {track.gates.map(g=><group key={g.index} position={[g.x,g.y,g.z]} rotation={[0,g.yaw,0]}>
      {[-1,1].map(side=><group key={side} position={[side*(track.width/2+.7),0,0]}>
        <mesh position={[0,2.2,0]}><boxGeometry args={[.22,4.4,.22]}/><meshStandardMaterial color="#e2efd5"/></mesh>
        <mesh position={[side*-.5,3.75,0]}><boxGeometry args={[1,.7,.13]}/><meshBasicMaterial color={g.index===0?'#d4fa60':track.color}/></mesh>
      </group>)}
      {g.index===0&&<mesh position={[0,5,0]}><planeGeometry args={[12,3]}/><meshBasicMaterial map={resources.sign} side={THREE.DoubleSide}/></mesh>}
    </group>)}
    {track.repairs.map(p=><group key={p.id} position={[p.x,p.y+.07,p.z]} rotation={[0,p.yaw,0]}>
      <mesh><boxGeometry args={[4,.04,4]}/><meshBasicMaterial color="#3b9c85"/></mesh>
      <mesh position={[0,.03,0]}><boxGeometry args={[2.6,.02,.6]}/><meshBasicMaterial color="#c7ffe4"/></mesh>
      <mesh position={[0,.03,0]}><boxGeometry args={[.6,.02,2.6]}/><meshBasicMaterial color="#c7ffe4"/></mesh>
    </group>)}
  </group>
}
function HazardVisuals({stateRef,reduced}){
  const bodies=useRef(),lamps=useRef(),halos=useRef(),debris=useRef(),shock=useRef()
  const scratch=useMemo(()=>({d:new THREE.Object3D(),c:new THREE.Color()}),[])
  useFrame(()=>{
    const state=stateRef.current.state,{d,c}=scratch
    const set=(mesh,i,x,y,z,w,h,depth,color,rx=0)=>{d.position.set(x,y,z);d.rotation.set(rx,0,0);d.scale.set(w,h,depth);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);if(color)mesh.setColorAt(i,c.set(color))}
    for(let i=0;i<MAX_HAZARDS;i++){
      const h=state.hazards[i]
      if(!h||h.cooldown>0){set(bodies.current,i,0,0,0,0,0,0);set(lamps.current,i,0,0,0,0,0,0);set(halos.current,i,0,0,0,0,0,0);continue}
      const mine=h.type==='mine',crate=h.type==='crate',width=crate?1.45:mine?1.45:.75,height=crate?1.25:mine?.18:.75
      const warning=h.fuse>=0,color=h.arm>0?'#6bd5ff':warning?'#ffbd53':crate?'#ef8748':'#ff5b55'
      set(bodies.current,i,h.x,h.y,h.z,width,height,width,crate?'#ae5b37':'#273b44')
      set(lamps.current,i,h.x,h.y+height/2+.09,h.z,width*.58,.12,width*.58,color)
      const radius=warning?(mine?7.5:crate?10:9):mine?1.6:crate?2:.8
      set(halos.current,i,h.x,(h.groundY||0)+.08,h.z,radius, radius,1,warning?'#ffab45':'#f16163',-Math.PI/2)
    }
    let count=0
    for(let i=0;i<24;i++){
      const b=state.explosions[i]
      if(!b){set(shock.current,i,0,0,0,0,0,0);continue}
      const p=1-b.ttl/.7,r=(.15+p)*b.radius
      set(shock.current,i,b.x,(b.groundY||0)+.12,b.z,r,r,1,'#ffd078',-Math.PI/2)
      for(let j=0;j<(reduced?4:10);j++){
        const a=j*Math.PI*2/(reduced?4:10),spread=p*b.radius*.6,size=Math.max(.05,(1-p)*.65)
        set(debris.current,count++,b.x+Math.cos(a)*spread,b.y+.5+Math.sin(p*Math.PI)*3,b.z+Math.sin(a)*spread,size,size,size,j%2?'#ffc461':'#ef704a')
      }
    }
    debris.current.count=count
    for(const mesh of [bodies.current,lamps.current,halos.current,debris.current,shock.current]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}
  })
  return <group name="BATTLE_HAZARDS_AND_BLASTS">
    <instancedMesh ref={bodies} args={[null,null,MAX_HAZARDS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={1}/></instancedMesh>
    <instancedMesh ref={lamps} args={[null,null,MAX_HAZARDS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial/></instancedMesh>
    <instancedMesh ref={halos} args={[null,null,MAX_HAZARDS]} frustumCulled={false}><ringGeometry args={[.91,1,24]}/><meshBasicMaterial transparent opacity={.32} depthWrite={false} side={THREE.DoubleSide}/></instancedMesh>
    <instancedMesh ref={debris} args={[null,null,240]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial/></instancedMesh>
    <instancedMesh ref={shock} args={[null,null,24]} frustumCulled={false}><ringGeometry args={[.90,1,24]}/><meshBasicMaterial transparent opacity={.45} depthWrite={false} side={THREE.DoubleSide}/></instancedMesh>
  </group>
}
function TurboPickups({engineRef}){
  const refs=useRef([])
  useFrame(({clock})=>{
    const pads=engineRef.current.state.powerups
    refs.current.forEach((g,i)=>{if(!g)return;const p=pads[i];g.visible=!!p&&p.cooldown<=0;if(g.visible){g.position.set(p.x,p.y+.95+Math.sin(clock.elapsedTime*3+i)*.22,p.z);g.rotation.y=clock.elapsedTime*1.7+i*.4}})
  })
  return <group name="ARCADE_TURBO_PICKUPS">{engineRef.current.state.powerups.map((p,i)=><group key={p.id} ref={el=>{refs.current[i]=el}} position={[p.x,p.y+1,p.z]}>
    <mesh rotation={[0,0,Math.PI/4]}><octahedronGeometry args={[.9,0]}/><meshBasicMaterial color="#3fe7ff" toneMapped={false}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.84,0]}><ringGeometry args={[1.05,1.25,24]}/><meshBasicMaterial color="#f6ff79" side={THREE.DoubleSide} transparent opacity={.8}/></mesh>
  </group>)}</group>
}
function LoadedRace({engineRef,inputRef,phase,track,budget,cameraMode,reduced,onReady,onHud,onFinish,multiplayerRef,viewerIndex=0}){
  const {scene}=useGLTF(MODEL)
  const models=useMemo(()=>engineRef.current.state.actors.map(a=>{
    const source=scene.getObjectByName('PREFAB_kart_emerald');if(!source)throw new Error('Kart asset missing')
    const model=source.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.set(1,1,1)
    const resources=voxelizeSceneMaterials(model)
    model.traverse(n=>{if(n.isMesh&&/_(body|hood|helm|rear_wing)$/.test(n.name))n.material.color.set(a.color)})
    return {model,resources}
  }),[scene])
  const roots=useRef([]),bars=useRef([]),fills=useRef([]),shields=useRef([]),hudTime=useRef(0)
  const weatherRef=useRef({}),playerRef=useRef(engineRef.current.state.actors[0])
  const temp=useMemo(()=>({desired:new THREE.Vector3(),target:new THREE.Vector3(),sky:new THREE.Color(),cloud:new THREE.Color('#7b8c9d')}),[])
  useEffect(()=>{onReady(true);return()=>models.forEach(m=>m.resources.dispose())},[models,onReady])
  useLayoutEffect(()=>{if(phase==='paused')onHud(battleHud(engineRef.current.state,viewerIndex))},[phase,onHud,engineRef])
  useFrame(({camera,scene},rawDt)=>{
    const engine=engineRef.current,dt=Math.min(.25,Math.max(0,rawDt))
    if(phase==='racing'&&!engine.state.done&&viewerIndex!==1){
      engine.acc+=dt
      while(engine.acc>=BATTLE_STEP&&!engine.state.done){
        engine.state=stepBattle(engine.state,inputRef.current,multiplayerRef?.current?.connected&&multiplayerRef.current.role==='host'?multiplayerRef.current.remoteInput:null);engine.acc-=BATTLE_STEP
        if(engine.replay)recordRaceReplay(engine.replay,engine.state)
        inputRef.current.bomb=false;inputRef.current.mine=false
        const event=engine.state.events.find(e=>e.actor==='player'&&['crash','damage','knockout','repair','lap','finished','stunt-smash','stunt-land','stunt-launch','turbo-pickup','turbo-bonus'].includes(e.kind))||engine.state.events.find(e=>e.actor==='player'&&e.kind==='deploy')
        if(event)engine.state.notice={...event,until:engine.state.tick+110}
      }
    }
    const connection=multiplayerRef?.current
    if(phase==='racing'&&connection?.connected&&connection.role==='host'&&engine.state.tick%8===0&&engine.sentTick!==engine.state.tick){engine.sentTick=engine.state.tick;connection.send({v:1,type:'state',tick:engine.state.tick,state:engine.state})}
    const state=engine.state,player=state.actors[viewerIndex]||state.actors[0];playerRef.current=player
    weatherRef.current=state.weather
    temp.sky.set(track.sky).lerp(temp.cloud,state.weather.cloudCover*.7)
    scene.background.copy(temp.sky);scene.fog.color.copy(temp.sky)
    scene.fog.near=55+state.weather.visibility*45;scene.fog.far=150+state.weather.visibility*110
    state.actors.forEach((a,i)=>{
      const root=roots.current[i];if(root){root.visible=a.hp>0;root.position.set(a.x,a.y||0,a.z);root.rotation.set(a.pitch||0,a.yaw+(a.air?.spin||0),0,'YXZ')}
      const bar=bars.current[i];if(bar){bar.visible=a.hp>0;bar.position.set(a.x,(a.y||0)+2.7,a.z);bar.quaternion.copy(camera.quaternion)}
      const fill=fills.current[i];if(fill){const ratio=Math.max(.001,a.hp/100);fill.scale.x=ratio;fill.position.x=-(1-ratio)*.85;fill.material.color.set(a.shield>0?'#65d9ff':a.hp>40?'#b8ec73':'#ff8275')}
      if(shields.current[i]){shields.current[i].visible=a.shield>0&&a.hp>0;shields.current[i].position.set(a.x,(a.y||0)+.08,a.z)}
    })
    temp.target.set(player.x,(player.y||0)+1.3,player.z)
    if(phase==='lobby'){temp.desired.set(100,95,110);temp.target.set(0,1,0)}
    else if(cameraMode==='aerial')temp.desired.set(player.x,(player.y||0)+48,player.z+5)
    else {const d=9.5+Math.abs(player.speed)*.06;temp.desired.set(player.x+Math.sin(player.yaw)*d,(player.y||0)+6,player.z+Math.cos(player.yaw)*d)}
    if(engine.snap){camera.position.copy(temp.desired);engine.snap=false}else camera.position.lerp(temp.desired,1-Math.exp(-7*dt))
    camera.up.set(0,1,0);camera.lookAt(temp.target)
    hudTime.current+=dt
    if(hudTime.current>.1){hudTime.current=0;onHud(battleHud(state,viewerIndex))}
    if(state.done&&!engine.sent){engine.sent=true;onFinish(state)}
  })
  return <>
    <RaceTrack track={track}/>
    <TurboPickups engineRef={engineRef}/>
    {models.map((m,i)=><group key={i}>
      <group ref={n=>{roots.current[i]=n}}><primitive object={m.model} dispose={null}/></group>
      <group ref={n=>{bars.current[i]=n}}><mesh><planeGeometry args={[1.85,.23]}/><meshBasicMaterial color="#193038"/></mesh><mesh ref={n=>{fills.current[i]=n}} position={[0,0,.01]}><planeGeometry args={[1.7,.13]}/><meshBasicMaterial color="#cafa6a"/></mesh></group>
      <mesh ref={n=>{shields.current[i]=n}} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.3,1.42,24]}/><meshBasicMaterial color="#70ddff" transparent opacity={.5} depthWrite={false}/></mesh>
    </group>)}
    <HazardVisuals stateRef={engineRef} reduced={reduced}/>
    <StuntVisuals stateRef={engineRef} reduced={reduced}/>
    <WeatherParticles clockRef={weatherRef} playerRef={playerRef} phase={phase==='racing'?'racing':'paused'} budget={budget}/>
  </>
}
export default function BattleScene(props){
  return <Canvas dpr={Math.min(props.budget.dpr,1.35)} shadows={props.budget.shadows} camera={{position:[100,95,110],fov:56,near:.1,far:400}} gl={{alpha:false,antialias:props.budget.antialias,powerPreference:'high-performance'}}>
    <color attach="background" args={[props.track.sky]}/><fog attach="fog" args={[props.track.sky,100,260]}/>
    <ambientLight intensity={1.15}/><hemisphereLight args={['#e1efff','#70805a',.9]}/><directionalLight position={[-30,60,35]} intensity={1.9}/>
    <Suspense fallback={null}><LoadedRace {...props}/></Suspense>
  </Canvas>
}
