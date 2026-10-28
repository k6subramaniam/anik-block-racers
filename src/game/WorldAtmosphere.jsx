import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { environmentAt, nextNightTime, nextWeatherTime } from './environment.js'
import { WATER_BODIES } from './water.js'
import {frontierBudget} from './frontier.js'

const rainVertex=new THREE.Color('#6bbcd2')
const clearSky=new THREE.Color('#a9d0e6')
const overcast=new THREE.Color('#768d9f')
const nightSky=new THREE.Color('#09172c')
const fogShade=new THREE.Color()
const skyShade=new THREE.Color()

export function SkyAndWeather({clockRef,phase,previewRequest,budget,onWeatherPreview}){
  const {scene}=useThree()
  const sun=useRef(),moon=useRef(),ambient=useRef(),hemi=useRef()
  const requestId=useRef(null)
  useEffect(()=>{
    if(!previewRequest || previewRequest.id===requestId.current)return
    requestId.current=previewRequest.id
    const t=clockRef.current.seconds||0
    clockRef.current.seconds=previewRequest.kind==='night' ? nextNightTime(t) : nextWeatherTime(t)
    clockRef.current=environmentAt(clockRef.current.seconds)
    onWeatherPreview?.(clockRef.current)
  },[clockRef,previewRequest,onWeatherPreview])
  useFrame((_,dt)=>{
    const isPlaying=phase==='exploring'||phase==='racing'
    const t=(clockRef.current.seconds||0)+(isPlaying?Math.min(.07,Math.max(0,dt)):0)
    const env=environmentAt(t)
    clockRef.current=env
    const daylight=env.daylight
    skyShade.copy(clearSky).lerp(overcast,env.cloudCover*.63).lerp(nightSky,1-daylight)
    if(scene.background?.isColor) scene.background.copy(skyShade)
    if(scene.fog){
      fogShade.copy(skyShade).lerp(rainVertex,(env.rain+env.snow)*.09)
      scene.fog.color.copy(fogShade)
      const visibility=Math.max(0,1-env.rain*.4-env.snow*.46)
      scene.fog.near=55+85*visibility
      scene.fog.far=120+(frontierBudget(budget?.tier).fogFar-120)*visibility
    }
    if(sun.current){
      sun.current.position.set(25*Math.cos(env.sunAngle),9+45*Math.sin(env.sunAngle),25)
      sun.current.intensity=.10+2.25*daylight*(1-env.cloudCover*.39)
      sun.current.color.setRGB(1, .76+.23*daylight, .55+.43*daylight)
    }
    if(moon.current) moon.current.intensity=.09+.36*(1-daylight)
    if(ambient.current)ambient.current.intensity=.52+1.2*daylight
    if(hemi.current)hemi.current.intensity=.38+.74*daylight
  })
  return <>
    <ambientLight ref={ambient} intensity={1.75}/>
    <hemisphereLight ref={hemi} args={['#cfedff','#557b69',1.05]}/>
    <directionalLight ref={sun} position={[25,40,25]} castShadow={!!budget?.shadows} intensity={2.1} shadow-mapSize-width={budget?.shadowMap||512} shadow-mapSize-height={budget?.shadowMap||512} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} shadow-bias={-.0002}/>
    <directionalLight ref={moon} position={[-15,32,-18]} intensity={.15} color="#90b9f5"/>
  </>
}
const WAVE_VERTEX=`
  uniform float uTime;
  uniform float uWind;
  varying vec2 vUV;
  void main(){
    vUV=uv;
    vec3 p=position;
    p.z+=.028*sin((p.x*14.0+p.y*19.0)+uTime*2.2)*(1.0+uWind*.9);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }
`
const WAVE_FRAGMENT=`
  uniform float uTime;
  uniform float uDay;
  uniform float uRain;
  uniform float uWind;
  varying vec2 vUV;
  void main(){
    vec2 block=floor(vUV*vec2(96.0,96.0));
    vec2 p=(block/96.0-.5)*40.0;
    float blocks=mod(block.x+floor(block.y/3.0),4.0);
    float ripple=sin(p.x*1.7+uTime*1.3)+sin(p.y*2.0-uTime*.9);
    float rain=sin(length(fract(p*.47)-.5)*26.0-uTime*13.0);
    float foam=step(1.3,ripple)*.12+step(3.2,blocks)*.035+step(.90,rain)*uRain*.055;
    vec3 day=vec3(.055,.44,.65)+vec3(foam,foam,foam);
    vec3 night=vec3(.024,.11,.24);
    vec3 c=mix(night,day,.18+.82*uDay)+vec3(.012,.026,.035)*uWind;
    c=floor(c*16.0)/16.0;
    gl_FragColor=vec4(c,.962);
  }
`
export function WaterWorld({clockRef,playerRef,phase,mode}){
  const uniforms=useMemo(()=>({uTime:{value:0},uDay:{value:1},uRain:{value:0},uWind:{value:0}}),[])
  const splash=useRef()
  useFrame(()=>{
    const env=clockRef.current
    uniforms.uTime.value=env.seconds||0
    uniforms.uDay.value=env.daylight??1
    uniforms.uRain.value=env.rain||0
    uniforms.uWind.value=env.wind||0
    const state=playerRef.current
    if(splash.current){
      splash.current.visible=mode==='explore' && (phase==='exploring'||phase==='paused') && !!state?.inWater
      if(state?.inWater){
        const body=WATER_BODIES.find(b=>b.id===state.waterId)
        splash.current.position.set(state.x,(body?.level||.43)+.05,state.z)
        splash.current.scale.setScalar(1.0+(state.waterTimer||0)*.3)
      }
    }
  })
  return <group name="ANIK_3D_WATER_LAKES">
    {WATER_BODIES.map(body=><group key={body.id} name={`LAKE_${body.id}`}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[body.x,.16,body.z]} scale={[body.rx,body.rz,1]} receiveShadow={false}>
        <ringGeometry args={[.91,1.13,52]}/><meshStandardMaterial color="#a4aa85" roughness={1}/>
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[body.x,body.level,body.z]} scale={[body.rx,body.rz,1]} frustumCulled={true}>
        <circleGeometry args={[.96,60]}/><shaderMaterial uniforms={uniforms} vertexShader={WAVE_VERTEX} fragmentShader={WAVE_FRAGMENT} transparent depthWrite side={THREE.DoubleSide}/>
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[body.x,body.level+.03,body.z]} scale={[body.rx,body.rz,1]}>
        <ringGeometry args={[.90,.94,52]}/><meshBasicMaterial color="#bbf2d9" transparent opacity={.55} depthWrite={false}/>
      </mesh>
    </group>)}
    <group ref={splash} visible={false} rotation={[-Math.PI/2,0,0]}>
      <mesh><ringGeometry args={[1.1,1.24,32]}/><meshBasicMaterial color="#e2fcff" transparent opacity={.85} depthWrite={false} side={THREE.DoubleSide}/></mesh>
      <mesh><ringGeometry args={[1.6,1.72,32]}/><meshBasicMaterial color="#68dfff" transparent opacity={.47} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    </group>
  </group>
}

/** Three small GPU batches, recentered around the moving kart. */
export function WeatherParticles({clockRef,playerRef,phase,budget}){
  const rainCount=budget.tier==='eco'?70:budget.tier==='high'?200:120
  const snowCount=budget.tier==='eco'?45:budget.tier==='high'?125:75
  const windCount=budget.tier==='eco'?26:budget.tier==='high'?80:50
  const rain=useRef(),snow=useRef(),windRef=useRef()
  const {rainGeo,snowGeo,windGeo}=useMemo(()=>{
    const rand=(seed=>()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296})(1987)
    const rainy=new Float32Array(rainCount*6),snowing=new Float32Array(snowCount*3),windy=new Float32Array(windCount*6)
    for(let i=0;i<rainCount;i++){
      const p=i*6
      rainy[p]=(rand()-.5)*45;rainy[p+1]=rand()*21+1;rainy[p+2]=(rand()-.5)*45
      rainy[p+3]=rainy[p]+.2;rainy[p+4]=rainy[p+1]-.83;rainy[p+5]=rainy[p+2]-.10
    }
    for(let i=0;i<snowCount;i++){
      const p=i*3
      snowing[p]=(rand()-.5)*44;snowing[p+1]=rand()*18+1;snowing[p+2]=(rand()-.5)*44
    }
    for(let i=0;i<windCount;i++){
      const k=i*6
      windy[k]=(rand()-.5)*46;windy[k+1]=rand()*7+1;windy[k+2]=(rand()-.5)*46
      windy[k+3]=windy[k]+1;windy[k+4]=windy[k+1];windy[k+5]=windy[k+2]+.3
    }
    const rg=new THREE.BufferGeometry(),sg=new THREE.BufferGeometry(),wg=new THREE.BufferGeometry()
    rg.setAttribute('position',new THREE.BufferAttribute(rainy,3));sg.setAttribute('position',new THREE.BufferAttribute(snowing,3));wg.setAttribute('position',new THREE.BufferAttribute(windy,3))
    return {rainGeo:rg,snowGeo:sg,windGeo:wg}
  },[rainCount,snowCount,windCount])
  useEffect(()=>()=>{rainGeo.dispose();snowGeo.dispose();windGeo.dispose()},[rainGeo,snowGeo,windGeo])
  useFrame((_,dt)=>{
    const env=clockRef.current,active=phase==='racing'||phase==='exploring'
    const r=rain.current,s=snow.current,w=windRef.current
    if(!r||!s||!w)return
    r.visible=active&&env.rain>.03;s.visible=active&&env.snow>.03;w.visible=active&&env.wind>.06
    const p=playerRef.current||{x:0,z:0}
    r.position.set(p.x,0,p.z);s.position.set(p.x,0,p.z);w.position.set(p.x,0,p.z)
    const step=Math.min(.06,dt)
    if(r.visible){
      const a=rainGeo.attributes.position.array
      for(let i=0;i<rainCount;i++){
        const k=i*6
        a[k]+=env.windX*step*.2;a[k+1]-=22*step;a[k+2]+=env.windZ*step*.2
        if(a[k+1]<.25){a[k+1]+=21;a[k]=((a[k]+22)%44+44)%44-22;a[k+2]=((a[k+2]+22)%44+44)%44-22}
        a[k+3]=a[k]+env.windX*.04;a[k+4]=a[k+1]-.92;a[k+5]=a[k+2]+env.windZ*.04
      }
      rainGeo.attributes.position.needsUpdate=true
    }
    if(s.visible){
      const a=snowGeo.attributes.position.array
      for(let i=0;i<snowCount;i++){
        const k=i*3
        a[k]+=env.windX*step*.27+Math.sin(env.seconds+i)*step*.35;a[k+1]-=(2.2+(i%4)*.25)*step;a[k+2]+=env.windZ*step*.27
        if(a[k+1]<.35){a[k+1]+=18;a[k]=((a[k]+22)%44+44)%44-22;a[k+2]=((a[k+2]+22)%44+44)%44-22}
      }
      snowGeo.attributes.position.needsUpdate=true
    }
    if(w.visible){
      const a=windGeo.attributes.position.array,norm=Math.max(.0001,Math.hypot(env.windX,env.windZ)),dirX=env.windX/norm,dirZ=env.windZ/norm
      for(let i=0;i<windCount;i++){
        const k=i*6
        a[k]+=env.windX*step*2.8;a[k+2]+=env.windZ*step*2.8
        a[k]=((a[k]+25)%50+50)%50-25;a[k+2]=((a[k+2]+25)%50+50)%50-25
        a[k+3]=a[k]+dirX*(1.1+env.windSpeed*.12);a[k+4]=a[k+1]+.1*Math.sin(env.seconds*2+i);a[k+5]=a[k+2]+dirZ*(1.1+env.windSpeed*.12)
      }
      windGeo.attributes.position.needsUpdate=true
    }
  })
  return <group name="DYNAMIC_WEATHER_PARTICLES">
    <lineSegments ref={rain} geometry={rainGeo} visible={false} frustumCulled={false}><lineBasicMaterial color="#b6efff" transparent opacity={.76} depthWrite={false}/></lineSegments>
    <points ref={snow} geometry={snowGeo} visible={false} frustumCulled={false}><pointsMaterial color="#f5fcff" size={.27} transparent opacity={.9} depthWrite={false}/></points>
    <lineSegments ref={windRef} geometry={windGeo} visible={false} frustumCulled={false}><lineBasicMaterial color="#d3eac1" transparent opacity={.5} depthWrite={false}/></lineSegments>
  </group>
}
