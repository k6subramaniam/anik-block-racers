import React,{Suspense,useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import {Canvas,useFrame} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {createPixelTexture,voxelizeSceneMaterials} from '../game/VoxelVisuals.jsx'
import {WeatherParticles} from '../game/WorldAtmosphere.jsx'
import {STEP,stepShowdown,showdownWeather} from './rules.js'
import {recordReplay,sampleReplay} from './replay.js'
const MODEL='https://d2ol7oe51mr4n9.cloudfront.net/user_38xFRdnQaeZpG4RsfN9xIl0GlMG/26710d53-03e1-4327-b94a-59f07e46a89f.glb'

function Cube({at,size,color,map,...props}){
  return <mesh position={at} {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} map={map} roughness={.86} flatShading/></mesh>
}
function BlockBatch({items,color}){
  const ref=useRef()
  useEffect(()=>{
    const obj=new THREE.Object3D()
    for(let i=0;i<items.length;i++){
      const t=items[i];obj.position.set(t.x,t.y,t.z);obj.scale.set(t.w,t.h,t.d);obj.updateMatrix()
      ref.current.setMatrixAt(i,obj.matrix);ref.current.setColorAt(i,new THREE.Color(t.color||color))
    }
    ref.current.instanceMatrix.needsUpdate=true
    if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true
    ref.current.computeBoundingSphere()
  },[items,color])
  return <instancedMesh ref={ref} args={[null,null,items.length]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="white" roughness={1}/></instancedMesh>
}
function rampGeometry(r){
  const w=r.width/2,l=r.length/2,h=r.height
  const vertices=[-w,0,l, w,0,l, -w,0,-l, w,0,-l, -w,h,-l, w,h,-l]
  const indices=[0,4,1,1,4,5, 0,2,4, 1,5,3, 2,3,5,2,5,4, 0,1,3,0,3,2]
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices)
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat
}
function Ramp({r,map}){
  const geometry=useMemo(()=>rampGeometry(r),[r])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <group position={[r.x,.015,r.z]} rotation={[0,r.yaw,0]}>
    <mesh geometry={geometry}><meshStandardMaterial color="#ffad43" map={map} flatShading roughness={.9} side={THREE.DoubleSide}/></mesh>
    <Cube at={[0,r.height+.09,-r.length/2+.25]} size={[r.width,.18,.65]} color="#fff0b8"/>
    <Cube at={[-r.width/2,.6,-r.length/2]} size={[.25,1.2,.25]} color="#ffe46a"/>
    <Cube at={[r.width/2,.6,-r.length/2]} size={[.25,1.2,.25]} color="#ffe46a"/>
  </group>
}
function Arena({arena}){
  const half=arena.bounds.maxX,edge=half+2,size=half*2+4
  const texture=useMemo(()=>createPixelTexture('road',Math.ceil(size/2.4),Math.ceil(size/2.4)),[size])
  const block=useMemo(()=>createPixelTexture('stone'),[])
  const blocks=useMemo(()=>{
    const items=[]
    for(let i=-half+1;i<=half;i+=4)for(const s of [-1,1]){
      const stripe=Math.floor((i+half)/4)%2
      items.push({x:i,y:.4,z:s*edge,w:3.85,h:.8,d:1.5,color:stripe?'#c8fa58':'#f1f3d2'})
      items.push({x:s*edge,y:.4,z:i,w:1.5,h:.8,d:3.85,color:stripe?'#c8fa58':'#f1f3d2'})
    }
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12,x=Math.sin(a)*(half+19),z=Math.cos(a)*(half+19),h=3+i%4
      items.push({x,y:h/2,z,w:1.2,h,d:1.2,color:'#7c5b35'})
      items.push({x,y:h+1,z,w:4.3,h:2.5,d:4.3,color:i%2?'#639b37':'#347547'})
      items.push({x,y:h+3,z,w:2.8,h:1.5,d:2.8,color:'#78ad40'})
    }
    for(let i=0;i<26;i++){
      const x=(i%7-3)*13,z=-half-23-Math.floor(i/7)*12,h=6+(i*7%5)*4
      items.push({x,y:h/2,z,w:9,h,d:9,color:i%2?'#47748a':'#536887'})
      items.push({x,y:h+.6,z,w:10,h:1.2,d:10,color:arena.accent})
    }
    return items
  },[arena])
  useEffect(()=>()=>texture.dispose(),[texture])
  useEffect(()=>()=>block.dispose(),[block])
  return <group name="SHOWDOWN_ARENA">
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.035,0]} receiveShadow>
      <planeGeometry args={[size,size]}/><meshStandardMaterial map={texture} color="#4b6069" roughness={1}/>
    </mesh>
    <Cube at={[0,-.7,0]} size={[size+45,1.3,size+45]} color="#5c8546"/>
    <BlockBatch items={blocks} color="#c8fa58"/>
    {arena.ramps.map(r=><Ramp key={r.id} r={r} map={block}/>)}
    {arena.boosts.map(b=><group key={b.id} position={[b.x,.03,b.z]}>
      <Cube at={[0,0,0]} size={[4,.1,3]} color="#2fc5ce"/>
      {[-1,0,1].map(n=><Cube key={n} at={[n,.09,0]} size={[.45,.08,2]} color="#edff90"/>)}
    </group>)}
    <Cube at={[0,14,-half-6]} size={[24,4,1]} color="#132c38"/>
    <Cube at={[-12,7,-half-6]} size={[.6,14,.6]} color="#c8fa58"/>
    <Cube at={[12,7,-half-6]} size={[.6,14,.6]} color="#c8fa58"/>
  </group>
}
function Robot({def,rootRef,burstRef}){
  return <>
    <group ref={rootRef} name={`SHOWDOWN_${def.id}`}>
      <Cube at={[0,1,0]} size={[1.45,1.25,1]} color={def.color}/>
      <Cube at={[0,2,0]} size={[1.15,.82,1]} color="#263b46"/>
      <Cube at={[0,2.05,-.52]} size={[.8,.22,.08]} color="#f7ffa5"/>
      {[-1,1].map(s=><group key={s}>
        <Cube at={[s*.95,1.1,0]} size={[.4,1.2,.5]} color={def.color}/>
        <Cube at={[s*.4,.3,0]} size={[.48,.6,.6]} color="#263b46"/>
      </group>)}
      <group name="bar" position={[0,2.75,0]}>
        <Cube at={[0,0,0]} size={[1.65,.18,.08]} color="#172c36"/>
        <mesh name="fill" position={[0,0,.05]}><boxGeometry args={[1.55,.1,.06]}/><meshBasicMaterial color="#c8fa58"/></mesh>
      </group>
    </group>
    <group ref={burstRef} visible={false}>{Array.from({length:8},(_,i)=><Cube key={i} at={[0,1,0]} size={[.42,.42,.42]} color={i%2?def.color:'#f5e998'}/>)}</group>
  </>
}
function PlayField({engineRef,inputRef,phase,arena,budget,onReady,onHud,onFinish,onReplayEnd,cameraMode}){
  const gltf=useGLTF(MODEL)
  const kart=useMemo(()=>{
    const original=gltf.scene.getObjectByName('PREFAB_kart_emerald')
    if(!original)throw new Error('The kart asset could not be found. Please reload.')
    const model=original.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0)
    return {model,resources:voxelizeSceneMaterials(model)}
  },[gltf.scene])
  useEffect(()=>{onReady(true);return()=>kart.resources.dispose()},[kart,onReady])
  const kartRoot=useRef(),robots=useRef({}),bursts=useRef({}),hudTime=useRef(0),sun=useRef()
  const envRef=useRef(showdownWeather(arena,0)),playerRef=useRef(engineRef.current.state.player)
  const scratch=useMemo(()=>({target:new THREE.Vector3(),position:new THREE.Vector3(),sky:new THREE.Color(),overcast:new THREE.Color('#68818c')}),[])
  useLayoutEffect(()=>{
    if(phase!=='paused')return
    const engine=engineRef.current,s=engine.state,env=showdownWeather(engine.arena,s.ticks)
    onHud({remaining:Math.max(0,60-s.ticks/60),score:s.score,combo:s.combo,
      bestCombo:s.bestCombo,smashes:s.smashes,jumps:s.jumps,speed:s.player.speed,
      weather:env.label,notice:engine.notice})
    hudTime.current=0
  },[phase,onHud,engineRef])
  useFrame(({camera,scene},rawDt)=>{
    const engine=engineRef.current,dt=Math.min(.25,Math.max(0,rawDt))
    if(phase==='running'&&!engine.state.done){
      engine.accumulator+=dt
      while(engine.accumulator>=STEP&&!engine.state.done){
        engine.state=stepShowdown(engine.state,inputRef.current,engine.arena)
        recordReplay(engine.replay,engine.state)
        for(const event of engine.state.events)engine.notice={...event,at:performance.now()}
        engine.accumulator-=STEP
      }
    }
    let state=engine.state
    if((phase==='replay'||phase==='exporting')&&engine.range){
      engine.replayTick=Math.min(engine.range.end,engine.replayTick+dt*60*.65)
      state=sampleReplay(engine.replay,engine.replayTick)||state
      if(engine.replayTick>=engine.range.end&&!engine.replayDone)engine.replayDone=true
    }
    engine.visual=state
    const p=state.player;playerRef.current=p
    const env=showdownWeather(engine.arena,state.tick??state.ticks??0);envRef.current=env
    scratch.sky.set('#99cbd8').lerp(scratch.overcast,env.cloudCover*.55)
    scene.background?.copy(scratch.sky)
    if(scene.fog){scene.fog.color.copy(scratch.sky);scene.fog.near=110-env.rain*30;scene.fog.far=250-env.snow*55}
    if(sun.current)sun.current.intensity=2.2-env.cloudCover*.6
    if(kartRoot.current){
      kartRoot.current.position.set(p.x,p.y,p.z)
      kartRoot.current.rotation.set(p.grounded?0:Math.max(-.22,Math.min(.28,p.vy*.025)),p.yaw,0,'YXZ')
    }
    for(const n of state.bots){
      const root=robots.current[n.id],burst=bursts.current[n.id]
      if(root){
        root.visible=n.health>0&&n.respawn<=0;root.position.set(n.x,0,n.z);root.rotation.y=n.yaw
        const bar=root.getObjectByName('bar'),fill=root.getObjectByName('fill')
        if(bar)bar.rotation.y=camera.rotation.y-n.yaw
        if(fill){const ratio=Math.max(.01,n.health/65);fill.scale.x=ratio;fill.position.x=-(1-ratio)*.77}
      }
      if(burst){
        burst.visible=n.burst>0
        if(burst.visible){
          const progress=1-n.burst/.8;burst.position.set(n.x,0,n.z)
          burst.children.forEach((bit,i)=>{const a=i*Math.PI/4;bit.position.set(Math.cos(a)*(progress*4+.2),1+Math.sin(progress*Math.PI)*3.5+(i%2)*progress,Math.sin(a)*(progress*4+.2));bit.rotation.set(a+progress*4,progress*3,a);bit.scale.setScalar(Math.max(.05,1-progress))})
        }
      }
    }
    scratch.target.set(p.x,1.25+p.y,p.z)
    if(phase==='lobby'){scratch.position.set(32,31,53);scratch.target.set(0,1,3)}
    else if(cameraMode==='aerial')scratch.position.set(p.x,42,p.z+12)
    else{
      const replaying=phase==='replay'||phase==='exporting',d=replaying?11:8.8+Math.abs(p.speed)*.06
      scratch.position.set(p.x+Math.sin(p.yaw)*d+(replaying?2.8:0),p.y+6,p.z+Math.cos(p.yaw)*d)
    }
    camera.up.set(0,1,0)
    if(engine.snap){camera.position.copy(scratch.position);engine.snap=false}else camera.position.lerp(scratch.position,1-Math.exp(-6*dt))
    camera.lookAt(scratch.target)
    hudTime.current+=dt
    if(hudTime.current>.1){
      hudTime.current=0
      onHud({remaining:Math.max(0,60-engine.state.ticks/60),score:engine.state.score,combo:engine.state.combo,
        bestCombo:engine.state.bestCombo,smashes:engine.state.smashes,jumps:engine.state.jumps,speed:p.speed,
        weather:env.label,notice:engine.notice})
    }
  })
  useFrame(({gl,scene,camera})=>{
    gl.render(scene,camera)
    const engine=engineRef.current
    try{engine.capture?.draw(gl.domElement)}catch{engine.capture?.cancel();engine.capture=null}
    if(engine.state.done&&!engine.finishedSent){
      engine.finishedSent=true
      try{engine.screenshot=gl.domElement.toDataURL('image/png')}catch{engine.screenshot=null}
      onFinish(engine.state)
    }
    if(engine.replayDone&&!engine.replayEndSent){engine.replayEndSent=true;onReplayEnd()}
  },1)
  return <>
    <ambientLight intensity={1.25}/><hemisphereLight args={['#e1f5fa','#5c7451',.9]}/>
    <directionalLight ref={sun} position={[-15,36,22]} intensity={2.1} castShadow={budget.shadows} shadow-mapSize={[512,512]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45}/>
    <Arena arena={arena}/>
    <group ref={kartRoot}><primitive object={kart.model} dispose={null}/></group>
    {arena.bots.map(def=><Robot key={def.id} def={def} rootRef={node=>{robots.current[def.id]=node}} burstRef={node=>{bursts.current[def.id]=node}}/>)}
    <WeatherParticles clockRef={envRef} playerRef={playerRef} phase={phase==='running'||phase==='replay'||phase==='exporting'?'racing':'paused'} budget={budget}/>
  </>
}
export default function ShowdownScene(props){
  return <Canvas dpr={Math.min(1.3,props.budget.dpr)} shadows={props.budget.shadows} camera={{position:[32,31,53],fov:57,near:.1,far:380}}
    gl={{alpha:false,antialias:props.budget.antialias,powerPreference:'high-performance'}}>
    <color attach="background" args={['#99cbd8']}/><fog attach="fog" args={['#99cbd8',70,140]}/>
    <Suspense fallback={null}><PlayField {...props}/></Suspense>
  </Canvas>
}
