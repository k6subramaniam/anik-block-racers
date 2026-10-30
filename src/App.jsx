import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Camera, Check, CircleHelp, Clock3, Coins, Flag, Gauge, Pause, Play, RotateCcw, Shield, Trophy, X, Settings2, Smartphone, Maximize2, Download, Vibrate, GaugeCircle, Map as MapIcon, Compass, Navigation, Bot, MessageCircle, CloudRain, CloudSnow, Wind, Sun as SunIcon, Moon, Waves, Volume2, VolumeX, Music, Music2, Speaker } from 'lucide-react'
import RacingScene from './game/World.jsx'
import {BattleProvider,BattleHud,BattleChoice} from './battle/BattleUI.jsx'
import { formatTime, INPUT_DEFAULT } from './game/simulation.js'
import { LAPS_TO_WIN } from './game/track.js'
import { ZONES, RELICS, mapPosition } from './game/openWorld.js'
import { WATER_DESTINATIONS, WATER_BODIES } from './game/water.js'
import {FRONTIER_ROADS,WORLD_SIZE} from './game/frontier.js'
import { createAnnouncer, announcerClipFor, COUNTDOWN_CLIPS } from './game/announcer.js'
import { createSoundEngine, sfxFor } from './game/sound.js'
import { createHeldInput, getRenderBudget, isCoarsePointer, safeStoredQuality, QUALITY_OPTIONS } from './game/mobile.js'

const phrases={
  'checkpoint-1':{heading:'CHECKPOINT 1',small:'Gate validated',color:'lime'},
  'checkpoint-2':{heading:'CHECKPOINT 2',small:'Head to the finish line',color:'lime'},
  lap:{heading:'LAP COMPLETE!',small:'Keep the momentum',color:'orange'},
  boost:{heading:'TURBO BOOST!',small:'Full throttle',color:'lime'},
  coin:{heading:'+10 POINTS',small:'Block coin collected',color:'orange'},
  wall:{heading:'WALL HIT',small:'Steer back into the racing line',color:'orange'},
  obstacle:{heading:'OBSTACLE!',small:'Find a better line',color:'orange'},
  border:{heading:'WORLD EDGE',small:'Turn around and keep exploring',color:'orange'},
  discovery:{heading:'AREA DISCOVERED',small:'New district on your map',color:'lime'},
  relic:{heading:'RARE RELIC!',small:'5 exploration coins collected',color:'orange'},
  portal:{heading:'PORTAL WARP!',small:'Returned to Voxel Valley',color:'lime'},
  travel:{heading:'FAST TRAVEL',small:'Enjoy your destination',color:'lime'},
  lava:{heading:'LAVA RESCUE',small:'Respawned safely near Ember Peaks',color:'orange'},
  'npc-hit':{heading:'DIRECT HIT!',small:'Ram the bot again to finish it',color:'orange'},
  'npc-smash':{heading:'BOT SMASHED!',small:'Voxel knockout! + points',color:'lime'},
  'villager-chat':{heading:'VILLAGER SAYS',small:'Welcome to Blockhaven!',color:'lime'},
  'villager-slow':{heading:'BRAKE TO TALK',small:'Villagers talk when the kart is stopped',color:'orange'},
  'water-splash':{heading:'SPLASH DOWN!',small:'Deep water absorbs speed and sinks the kart',color:'orange'},
  'water-rescue':{heading:'SHORE RESCUE',small:'Your kart has been recovered from deep water',color:'lime'},
  'weather-change':{heading:'WEATHER SHIFT',small:'Changing driving conditions',color:'lime'},
}
class WorldErrorBoundary extends React.Component {
  state={error:null}
  static getDerivedStateFromError(error){return {error}}
  render(){
    if(this.state.error) return <div className="error-ui"><h2>3D WORLD COULD NOT LOAD</h2><p>{this.state.error.message||'WebGL is not available on this device.'}</p><button onClick={()=>location.reload()}>Retry loading world</button></div>
    return this.props.children
  }
}
function useKeyboard(inputs, callbacks){
  const actions=useRef(callbacks);actions.current=callbacks
  useEffect(()=>{
    const maps={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'drift'}
    const down=e=>{
      if(maps[e.code]){e.preventDefault();inputs.current[maps[e.code]]=true;return}
      if(e.repeat)return
      if(e.code==='Enter'){e.preventDefault();actions.current.start()}
      if(e.code==='KeyR'){e.preventDefault();actions.current.restart()}
      if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();actions.current.togglePause()}
      if(e.code==='KeyC'){e.preventDefault();actions.current.toggleCamera()}
      if(e.code==='KeyM'){e.preventDefault();actions.current.openMap()}
      if(e.code==='KeyE'){e.preventDefault();actions.current.startExplore()}
      if(e.code==='KeyH'){e.preventDefault();actions.current.startRaceMode()}
      if(e.code==='KeyT'){e.preventDefault();actions.current.talk()}
    }
    const up=e=>{if(maps[e.code]){e.preventDefault();inputs.current[maps[e.code]]=false}}
    const reset=()=>{inputs.current={...INPUT_DEFAULT};actions.current.onBlur?.()}
    const onVisibility=()=>{if(document.hidden)reset()}
    window.addEventListener('keydown',down,{passive:false});window.addEventListener('keyup',up,{passive:false});window.addEventListener('blur',reset)
    window.addEventListener('pagehide',reset);document.addEventListener('visibilitychange',onVisibility)
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);window.removeEventListener('pagehide',reset);document.removeEventListener('visibilitychange',onVisibility)}
  },[inputs])
}
function TouchButton({action,children,variant='',inputRef,label}){
  const held=useRef(null)
  if(!held.current)held.current=createHeldInput(inputRef,action)
  useEffect(()=>{
    const release=()=>held.current?.reset()
    window.addEventListener('blur',release);document.addEventListener('visibilitychange',release)
    return()=>{release();window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',release)}
  },[])
  const begin=e=>{e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{};held.current.down(e.pointerId);e.currentTarget.classList.add('is-pressed')}
  const finish=e=>{e.preventDefault();held.current.up(e.pointerId);if(!held.current.size)e.currentTarget.classList.remove('is-pressed')}
  return <button type="button" className={`touch-btn ${variant}`} aria-label={label||`${action} control`} data-testid={`touch-${action}`}
    onContextMenu={e=>e.preventDefault()} onPointerDown={begin} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>{children}</button>
}
function Speedometer({speed,boost}){
  const kmh=Math.max(0,Math.round(Math.abs(speed)*3.6)),pct=Math.min(100,kmh/112*100)
  return <div className={`speedometer ${boost?'boost-on':''}`} data-testid="speedometer">
    <svg className="speed-arc" viewBox="0 0 148 148" aria-hidden="true"><circle cx="74" cy="74" r="62" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="8" strokeLinecap="round" strokeDasharray="296 390" transform="rotate(135 74 74)"/><circle cx="74" cy="74" r="62" fill="none" stroke={boost?'#ffb357':'#b9f65c'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct*2.96} 390`} transform="rotate(135 74 74)"/></svg>
    <div className="speed-content"><Gauge size={15} strokeWidth={2.5}/><span className="speed-numeral">{kmh}</span><span className="speed-label">KM / H</span></div>
  </div>
}
function IntroCard({loaded,onStart,onExplore,mobile,onInstall,canInstall}){
  return <div className="dialog-backdrop intro-backdrop"><div className="intro-panel">
    <div className="card-eyebrow"><span className="green-dot"/> ANIK VOXEL WORLD · BIGGER WORLD v3.1</div>
    <div className="intro-heading"><span>RACE THE</span><strong>BLOCKS.</strong></div>
    <p className="intro-copy">Race through pixel-textured landscapes or explore ten districts across a 906 × 756 metre world with cubic forests, walking villagers, lakes, creatures, and hidden relics!</p>
    {mobile&&<div className="mobile-intro-tip"><Smartphone size={18}/><div><strong>BUILT FOR SAMSUNG GALAXY</strong><span>Rotate to landscape · Hold the glowing pedal to race</span></div></div>}
    <div className="map-details"><div><span>TRACK 01</span><strong>VOXEL VALLEY</strong></div><div><span>RACE TYPE</span><strong>3 AI OPPONENTS</strong></div><div><span>DISTANCE</span><strong>3 LAPS</strong></div></div>
    <BattleChoice/><div className="intro-actions"><button className="primary-button" onClick={onExplore} disabled={!loaded} data-testid="start-explore"><Compass size={17}/>{loaded?'EXPLORE OPEN WORLD':'LOADING THE WORLD'}<span>↗</span></button>
      <button className="secondary-button intro-race-button" onClick={onStart} disabled={!loaded} data-testid="start-race"><Flag size={16}/> RACE 3 LAPS</button></div>
    <p className="intro-hint">{loaded?(mobile?'FULLSCREEN LANDSCAPE RECOMMENDED':'PRESS ENTER TO START'):'Loading the expanded voxel world and racing physics…'}</p>
    {mobile&&<button className="install-secondary" onClick={onInstall}><Download size={16}/>{canInstall?'INSTALL GAME ON PHONE':'HOW TO INSTALL ON GALAXY'}</button>}
  </div><div className="intro-lower"><div className="keys-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>DRIVE</span><span className="hint-divider"/><kbd>SPACE</kbd><span>DRIFT</span><span className="hint-divider"/><kbd>C</kbd><span>CAMERA</span></div></div></div>
}
function CenterDialog({type,elapsed,bestLap,coins,onContinue,onRestart,onExplore,mode}){
  const finished=type==='finished'
  return <div className="dialog-backdrop"><div className="final-panel">
    <div className="result-medal">{finished?<Trophy size={32}/>:<Pause size={30}/>}</div>
    <div className="card-eyebrow">{finished?'RACE COMPLETE':mode==='explore'?'EXPLORATION PAUSED':'RACE PAUSED'}</div>
    <h1>{finished?<>VOXEL VALLEY <em>CONQUERED.</em></>:<>TAKE A <em>BREATHER.</em></>}</h1>
    <p>{finished?'You cleared every checkpoint and completed all three laps. Your time is on the board.':mode==='explore'?'Your explorer is parked. Resume discovering the world whenever you are ready.':'The timer is frozen. Return to the race whenever you are ready.'}</p>
    <div className="finish-grid"><div><small>RACE TIME</small><strong>{formatTime(elapsed)}</strong></div><div><small>BEST LAP</small><strong>{formatTime(bestLap)}</strong></div><div><small>COINS</small><strong>{coins}</strong></div></div>
    <div className="finish-actions">{!finished&&<button className="primary-button" onClick={onContinue}><Play fill="currentColor" size={17}/> {mode==='explore'?'RESUME EXPLORING':'RESUME RACE'}</button>}<button className={finished?'primary-button':'secondary-button'} onClick={onRestart}><RotateCcw size={17}/> {mode==='explore'?'RESTART EXPLORATION':'RACE AGAIN'}</button>{finished&&<button className="secondary-button" onClick={onExplore}><Compass size={17}/> EXPLORE WORLD</button>}</div>
  </div></div>
}
function WorldMapPanel({hud,onClose,onTravel}){
  const me=mapPosition({x:hud.x??5,z:hud.z??-37})
  return <div className="map-backdrop" role="presentation" onClick={onClose}><section className="world-map-panel" role="dialog" aria-modal="true" aria-label="Explore world map" onClick={e=>e.stopPropagation()}>
    <header className="map-panel-header"><div><small>BIGGER WORLD · 906 × 756 METRES · 9× AREA</small><h2>EXPLORE THE REALM</h2></div><button aria-label="Close map" onClick={onClose}><X size={21}/></button></header>
    <div className="map-layout"><div className="map-graphic"><svg viewBox="0 0 240 190" role="img" aria-label="Map of ten districts and three lakes">
      <rect width="240" height="190" fill="#1e3336" rx="8"/><path d="M120 0V190 M0 95H240" stroke="#466065" strokeWidth=".8" strokeDasharray="4 5"/>
      <rect x="80" y="63.33" width="80" height="63.34" fill="#395c43" stroke="#9fe276" strokeWidth="1.2" strokeDasharray="3 2"/>
      {FRONTIER_ROADS.map(r=>{const a=mapPosition({x:r.a[0],z:r.a[1]}),b=mapPosition({x:r.b[0],z:r.b[1]});return <line key={r.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a5b98b" strokeWidth="1.7"/>})}
      <text x="120" y="98" textAnchor="middle" fill="#c3f2a8" fontSize="7" fontWeight="bold">VOXEL VALLEY</text>
      {WATER_BODIES.map(w=>{const p=mapPosition(w);return <ellipse key={w.id} cx={p.x} cy={p.y} rx={w.rx*240/WORLD_SIZE.width} ry={w.rz*190/WORLD_SIZE.depth} fill="#49b9df" stroke="#c9f8ff" strokeWidth="1.2" opacity=".8"/>})}
      {ZONES.map(z=>{const p=mapPosition(z);return <g key={z.id}><circle cx={p.x} cy={p.y} r={z.biome?15:6} fill={z.color} opacity=".23" stroke={z.color} strokeWidth="1.1"/><circle cx={p.x} cy={p.y} r="3" fill={z.color}/><text x={p.x} y={p.y-(z.biome?18:8)} textAnchor="middle" fill="white" fontSize={z.biome?6.5:3.6} fontWeight="700">{z.name}</text></g>})}
      <circle cx={me.x} cy={me.y} r="5" fill="#c4fa65" stroke="#102115" strokeWidth="2"/><text x={me.x} y={Math.min(185,me.y+15)} textAnchor="middle" fontSize="7" fill="#d4ff8b">YOU</text>
    </svg><p><Navigation size={14}/> Original world is outlined. New highways connect four frontier districts.</p></div>
    <div className="map-destinations"><p className="map-guide">Choose a destination to fast travel. Meet friendly Blockhaven villagers, discover all ten districts and collect ten relics.</p>
      {ZONES.map(zone=><button key={zone.id} className="map-place" data-testid={`travel-${zone.id}`} onClick={()=>onTravel(zone.id)}><span className="map-place-icon" style={{color:zone.color,borderColor:zone.color}}>{zone.icon}</span><span><b>{zone.name}</b><small>{zone.label}</small></span><span className="map-place-status">{(hud.visited||[]).includes(zone.id)?'VISITED':'DISCOVER'}<Navigation size={14}/></span></button>)}
      <p className="lake-map-heading"><Waves size={14}/> WATER EXPLORATION</p>
      {WATER_DESTINATIONS.map(zone=><button key={zone.id} className="map-place water-map-place" data-testid={`travel-${zone.id}`} onClick={()=>onTravel(zone.id)}><span className="map-place-icon" style={{color:zone.color,borderColor:zone.color}}>{zone.icon}</span><span><b>{zone.name}</b><small>Plunge, splash, sink and auto-rescue</small></span><span className="map-place-status">GO <Navigation size={14}/></span></button>)}
    </div></div><footer className="map-footer"><span>{(hud.visited||[]).length} / {ZONES.length} AREAS DISCOVERED · {(hud.collected||[]).length} / {RELICS.length} RELICS FOUND</span><button onClick={onClose}>CLOSE MAP</button></footer>
  </section></div>
}
function WorldApp(){
  const inputRef=useRef({...INPUT_DEFAULT})
  const [loaded,setLoaded]=useState(false),[phase,setPhase]=useState('ready'),[mode,setMode]=useState('race')
  const [showMap,setShowMap]=useState(false),[warpRequest,setWarpRequest]=useState(null),[talkRequest,setTalkRequest]=useState(0)
  const [weatherPreviewRequest,setWeatherPreviewRequest]=useState(null),[resetToken,setResetToken]=useState(0)
  const [countdownValue,setCountdownValue]=useState(3),[cameraMode,setCameraMode]=useState('chase')
  const [showHow,setShowHow]=useState(false),[showSettings,setShowSettings]=useState(false),[showInstallHelp,setShowInstallHelp]=useState(false)
  const [installPrompt,setInstallPrompt]=useState(null),[standalone,setStandalone]=useState(false)
  const mobile=isCoarsePointer()
  const [quality,setQuality]=useState(()=>{try{return safeStoredQuality(localStorage.getItem('anik-quality'))}catch{return 'auto'}})
  const [haptics,setHaptics]=useState(()=>{try{return localStorage.getItem('anik-haptics')!=='off'}catch{return true}})
  const hapticsRef=useRef(haptics);hapticsRef.current=haptics
  const [voice,setVoice]=useState(()=>{try{return localStorage.getItem('anik-voice')!=='off'}catch{return true}})
  const announcer=useRef(null);if(!announcer.current)announcer.current=createAnnouncer(import.meta.env.BASE_URL)
  const [sfx,setSfx]=useState(()=>{try{return localStorage.getItem('anik-sfx')!=='off'}catch{return true}})
  const [music,setMusic]=useState(()=>{try{return localStorage.getItem('anik-music')!=='off'}catch{return true}})
  const sound=useRef(null);if(!sound.current)sound.current=createSoundEngine()
  const budget=getRenderBudget(quality,{coarse:mobile,memory:typeof navigator==='undefined'?undefined:navigator.deviceMemory,cores:typeof navigator==='undefined'?undefined:navigator.hardwareConcurrency})
  const [hud,setHud]=useState({lap:1,checkpoint:0,speed:0,elapsed:0,bestLap:null,coins:0,collisions:0,countdown:3,visited:[],collected:[],zoneName:'VOXEL VALLEY',botsDefeated:0,smashScore:0,rivalsActive:3,wildlifeActive:8,worldTime:'08:00',weather:'CLEAR',daylight:1,windSpeed:0,submersion:0,inWater:false})
  const [toast,setToast]=useState(null),toastTime=useRef(null)
  const start=useCallback(()=>{
    if(loaded&&(phase==='ready'||phase==='finished')){
      if(mobile&&screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{})
      if(phase==='finished')setResetToken(x=>x+1)
      setMode('race');setWarpRequest(null);setPhase('countdown');setToast(null)
    }
  },[loaded,phase,mobile])
  const startExplore=useCallback(()=>{
    if(!loaded)return
    if(mobile&&screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{})
    inputRef.current={...INPUT_DEFAULT};setMode('explore');setWarpRequest(null)
    setResetToken(x=>x+1);setPhase('exploring');setShowMap(false);setToast(null)
  },[loaded,mobile])
  const startRaceMode=useCallback(()=>{
    if(!loaded)return
    inputRef.current={...INPUT_DEFAULT};setMode('race');setWarpRequest(null)
    setResetToken(x=>x+1);setPhase('countdown');setShowMap(false);setToast(null)
  },[loaded])
  const restart=useCallback(()=>{setResetToken(x=>x+1);inputRef.current={...INPUT_DEFAULT};setPhase(mode==='explore'?'exploring':'countdown');setToast(null)},[mode])
  const togglePause=useCallback(()=>setPhase(s=>(s==='racing'||s==='exploring')?'paused':s==='paused'?(mode==='explore'?'exploring':'racing'):s),[mode])
  const toggleCamera=useCallback(()=>setCameraMode(c=>c==='chase'?'aerial':'chase'),[])
  const onBlur=useCallback(()=>setPhase(s=>(s==='racing'||s==='exploring')?'paused':s),[])
  const talk=useCallback(()=>{if(mode==='explore'&&phase==='exploring')setTalkRequest(n=>n+1)},[mode,phase])
  const openHow=()=>{setPhase(s=>(s==='racing'||s==='exploring')?'paused':s);setShowHow(true)}
  const openSettings=()=>{setPhase(s=>(s==='racing'||s==='exploring')?'paused':s);setShowSettings(true)}
  const openMap=()=>{setPhase(s=>(s==='racing'||s==='exploring')?'paused':s);setShowMap(true)}
  const travelTo=zoneId=>{inputRef.current={...INPUT_DEFAULT};setMode('explore');setShowMap(false);setWarpRequest({zoneId,id:Date.now()});setPhase('exploring')}
  const enterFullscreen=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen?.();else await document.documentElement.requestFullscreen?.({navigationUI:'hide'})}catch{}
    try{await screen.orientation?.lock?.('landscape')}catch{}
  }
  const installGame=async()=>{
    if(installPrompt){try{await installPrompt.prompt();await installPrompt.userChoice}catch{};setInstallPrompt(null)}else setShowInstallHelp(true)
  }
  const onWorldEvent=useCallback((event,race)=>{
    const clip=announcerClipFor(event,race);if(clip)announcer.current.play(clip)
    const effect=sfxFor(event);if(effect)sound.current.play(effect)
    if(event==='finished')return
    if(hapticsRef.current&&navigator.vibrate){
      try{
        if(event==='wall'||event==='obstacle'||event==='npc-hit')navigator.vibrate(28)
        else if(event==='npc-smash')navigator.vibrate([35,35,60])
        else if(event==='water-splash'||event==='water-rescue')navigator.vibrate([24,32,56])
        else if(event==='checkpoint-1'||event==='checkpoint-2'||event==='lap')navigator.vibrate([24,45,24])
        else if(event==='coin'||event==='boost')navigator.vibrate(15)
      }catch{}
    }
    const details=phrases[event];if(!details)return
    setToast({id:Math.random(),...details,kind:event,heading:event==='villager-chat'?`${race.villagerName} SAYS`:details.heading,small:event==='villager-chat'?`${race.villagerLine}${race.firstMeeting?' · +2 COINS':''}`:event==='discovery'?(race.zoneName+' UNLOCKED'):event==='npc-smash'?`${race.npcName} DOWN · +${race.npcKind==='racer'?100:40} PTS`:event==='npc-hit'?`${race.npcName} · ${race.hitDamage||0} DAMAGE`:event==='weather-change'?`${race.weatherLabel} conditions ahead`:details.small})
    if(toastTime.current)clearTimeout(toastTime.current)
    toastTime.current=setTimeout(()=>setToast(null),event==='villager-chat'?4200:1250)
  },[])
  useEffect(()=>()=>{if(toastTime.current)clearTimeout(toastTime.current)},[])
  useKeyboard(inputRef,{start,restart,togglePause,toggleCamera,onBlur,openMap,startExplore,startRaceMode,talk})
  useEffect(()=>{if(!loaded||phase!=='ready')return;if(new URLSearchParams(window.location.search).get('source')==='shortcut-explore')startExplore()},[loaded,phase,startExplore])
  useEffect(()=>{try{localStorage.setItem('anik-quality',quality)}catch{}},[quality])
  useEffect(()=>{try{localStorage.setItem('anik-haptics',haptics?'on':'off')}catch{}},[haptics])
  useEffect(()=>{sound.current.setSfxEnabled(sfx);try{localStorage.setItem('anik-sfx',sfx?'on':'off')}catch{}},[sfx])
  useEffect(()=>{sound.current.setMusicEnabled(music);try{localStorage.setItem('anik-music',music?'on':'off')}catch{}},[music])
  useEffect(()=>{sound.current.setMusicState(loaded,phase==='racing'||phase==='exploring'||phase==='countdown')},[loaded,phase])
  useEffect(()=>{sound.current.setEngine(hud.speed||0,hud.boostTimer>0,phase==='racing'||phase==='exploring')},[hud.speed,hud.boostTimer,phase])
  useEffect(()=>{announcer.current.setEnabled(voice);try{localStorage.setItem('anik-voice',voice?'on':'off')}catch{}},[voice])
  useEffect(()=>{
    // Audio may only start after a user gesture; the first tap or key press unlocks it.
    const unlock=()=>{sound.current.unlock();announcer.current.unlock()}
    const hidden=()=>{if(document.hidden){sound.current.suspend();announcer.current.suspend()}else{sound.current.resume();announcer.current.resume()}}
    window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',hidden)
    return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',hidden)}
  },[])
  useEffect(()=>{
    const handler=e=>{e.preventDefault();setInstallPrompt(e)},installed=()=>{setStandalone(true);setInstallPrompt(null)}
    setStandalone(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)
    window.addEventListener('beforeinstallprompt',handler);window.addEventListener('appinstalled',installed)
    return()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',installed)}
  },[])
  useEffect(()=>{
    if(!import.meta.env.PROD||!('serviceWorker' in navigator))return
    const onLoad=()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{})
    window.addEventListener('load',onLoad);if(document.readyState==='complete')onLoad()
    return()=>window.removeEventListener('load',onLoad)
  },[])
  useEffect(()=>{
    if((phase!=='racing'&&phase!=='exploring')||!navigator.wakeLock?.request)return
    let lock,released=false
    navigator.wakeLock.request('screen').then(l=>{if(released)l.release().catch(()=>{});else lock=l}).catch(()=>{})
    return()=>{released=true;lock?.release?.().catch(()=>{})}
  },[phase])
  useEffect(()=>{
    if(phase!=='countdown')return
    const tick=value=>{setCountdownValue(value);announcer.current.play(COUNTDOWN_CLIPS[value]);sound.current.play(value?'countLow':'countHigh')}
    tick(3)
    const timers=[window.setTimeout(()=>tick(2),1000),window.setTimeout(()=>tick(1),2000),window.setTimeout(()=>tick(0),3000),window.setTimeout(()=>setPhase('racing'),3400)]
    return()=>timers.forEach(window.clearTimeout)
  },[phase,resetToken])
  const isRacing=phase==='racing'||phase==='exploring',exploring=mode==='explore'
  return <div className="app-shell">
    <div className="world-layer"><WorldErrorBoundary><RacingScene onReady={setLoaded} phase={phase} mode={mode} warpRequest={warpRequest} inputRef={inputRef} setHud={setHud} hudCollected={hud.collected} resetToken={resetToken} talkRequest={talkRequest} weatherPreviewRequest={weatherPreviewRequest} quality={quality} budget={budget} cameraMode={cameraMode} onPhase={setPhase} onEvent={onWorldEvent}/></WorldErrorBoundary></div>
    <div className="atmospheric-vignette"/>
    <header className="top-bar">
      <div className="brand-block"><div className="brand-mark">A<span>▰</span></div><div className="brand-wordmark"><strong>ANIK<span> / </span>BLOCK RACERS</strong><small>BUILD THE SPEED.</small></div></div>
      <div className="top-track-pill"><span className="pill-circle"/><div><span>{exploring?'FREE ROAM':'NOW RACING'}</span><strong>{exploring?hud.zoneName||'OPEN WORLD':'VOXEL VALLEY'}</strong></div><i>{exploring?'12 WALKING VILLAGERS':'3 AI RIVALS'}</i></div>
      <div className="top-buttons"><button title="Open world map (M)" aria-label="Open world map" data-testid="open-map" onClick={openMap}><MapIcon size={19}/></button><button title={exploring?'Return to 3-lap race':'Explore open world'} aria-label={exploring?'Return to race':'Explore open world'} data-testid="switch-mode" onClick={exploring?startRaceMode:startExplore}>{exploring?<Flag size={19}/>:<Compass size={19}/>}</button><button title="How to play" aria-label="How to play" onClick={openHow}><CircleHelp size={19}/></button><button title="Galaxy graphics and controls" aria-label="Graphics and controls settings" data-testid="open-settings" onClick={openSettings}><Settings2 size={19}/></button><button title="Switch camera (C)" aria-label="Switch racing camera" onClick={toggleCamera}><Camera size={19}/></button><button title="Pause or resume (P)" aria-label="Pause or resume race" disabled={phase==='ready'||phase==='finished'} onClick={togglePause}>{phase==='paused'?<Play size={19}/>:<Pause size={19}/>}</button></div>
    </header>
    <main data-testid="world-hud" data-world-x={hud.x} data-world-z={hud.z} className="hud" aria-live="off">
      <div className={`weather-hud ${hud.daylight<.25?'night':''}`} data-testid="weather-status" aria-label={`Game clock ${hud.worldTime||'08:00'}, weather ${hud.weather||'CLEAR'}`}>
        <span className="weather-glyph">{hud.weather==='RAIN'?<CloudRain size={18}/>:hud.weather==='SNOW'?<CloudSnow size={18}/>:hud.weather==='WINDY'?<Wind size={18}/>:hud.daylight<.25?<Moon size={18}/>:<SunIcon size={18}/>}</span>
        <strong data-testid="weather-label">{hud.weather||'CLEAR'}</strong><span className="weather-time"><Clock3 size={12}/>{hud.worldTime||'08:00'}</span><small>{Math.round(hud.windSpeed||0)} m/s</small>
      </div>
      {hud.inWater&&<div className="water-hud" data-testid="water-status"><Waves size={15}/><strong>SUBMERGING {Math.round((hud.submersion||0)*100)}%</strong><span>RESCUE IN {Math.max(0,4.1-(hud.waterTimer||0)).toFixed(1)}s</span></div>}
      <div className="hud-top-row">{exploring?<div className="stat-card explore-zone-card"><div className="stat-caption"><Compass size={15}/> DISCOVERED DISTRICTS</div><div className="explore-progress-number">{(hud.visited||[]).length} <span>/ {ZONES.length}</span></div><div className="lap-progress"><span style={{width:`${(hud.visited||[]).length/ZONES.length*100}%`}}/></div></div>:<div className="stat-card lap-card"><div className="stat-caption"><Flag size={15}/> CURRENT LAP</div><div className="lap-value"><strong>{String(hud.lap).padStart(2,'0')}</strong><span> / {String(LAPS_TO_WIN).padStart(2,'0')}</span></div><div className="lap-progress"><span style={{width:`${((hud.lap-1+hud.checkpoint/3)/LAPS_TO_WIN)*100}%`}}/></div></div>}<div className="stat-card timer-card"><div className="stat-caption"><Clock3 size={15}/> {exploring?'EXPLORE TIME':'RACE TIME'}</div><div className="timer-value" data-testid="race-time">{formatTime(hud.elapsed)}</div><div className="stat-caption small-caption">{exploring?'RELICS FOUND':'BEST LAP'} <span>{exploring?`${(hud.collected||[]).length} / ${RELICS.length}`:formatTime(hud.bestLap)}</span></div></div></div>
      <div className="top-right-stats"><div className="mini-stat"><Coins size={17}/><div><small>COINS</small><b>{String(hud.coins||0).padStart(2,'0')}</b></div></div><div className="mini-stat"><Shield size={17}/><div><small>{exploring?'RELICS':'CHECKPOINT'}</small><b>{exploring?(hud.collected||[]).length:hud.checkpoint} <span>/ {exploring?RELICS.length:2}</span></b></div></div><div className="mini-stat ai-smash-stat" data-testid="bot-score"><Bot size={17}/><div><small>BOTS SMASHED</small><b>{hud.botsDefeated||0} <span className="smash-points">· {hud.smashScore||0} PTS</span></b></div></div><div className="quality-indicator">{budget.tier.toUpperCase()}</div></div>
      <div className="bottom-left"><div className="waypoint"><span className="waypoint-icon">{exploring?<Compass size={17}/>:<Activity size={17}/>}</span><div><small>{exploring?'NOW EXPLORING':'ACTIVE CIRCUIT'}</small><strong>{exploring?hud.zoneName||'VOXEL WILDS':<>VOXEL VALLEY <span>01</span></>}</strong></div></div><div className="control-strip"><div><kbd>W</kbd><span>GAS</span></div><div><kbd>A</kbd><kbd>D</kbd><span>STEER</span></div><div><kbd>S</kbd><span>BRAKE</span></div><div><kbd>SPACE</kbd><span>DRIFT</span></div></div></div>
      <div className="bottom-right"><div className="gear-display"><span>DRIVE MODE</span><strong>{hud.speed<-.5?'REV':hud.boostTimer>0?'TURBO':'SPORT'}</strong></div><Speedometer speed={hud.speed||0} boost={hud.boostTimer>0}/></div>
      {exploring&&isRacing&&hud.nearbyVillager&&<button className="villager-talk-button" data-testid="talk-villager" onClick={talk} disabled={Math.abs(hud.speed)>4.5} aria-label={`Talk to ${hud.nearbyVillager.name}`}><MessageCircle size={15}/><span>{Math.abs(hud.speed)>4.5?'SLOW TO TALK':`TALK TO ${hud.nearbyVillager.name}`}</span><small>+2 COINS FIRST HELLO</small></button>}
      {isRacing&&<div className="mobile-controls" aria-label="Touch racing controls"><div className="mobile-steer"><TouchButton action="left" label="Steer left" inputRef={inputRef}><ArrowLeft/></TouchButton><TouchButton action="right" label="Steer right" inputRef={inputRef}><ArrowRight/></TouchButton></div><div className="mobile-pedals"><TouchButton action="drift" label="Drift while turning" inputRef={inputRef} variant="drift">DRIFT</TouchButton><TouchButton action="backward" label="Brake or reverse" inputRef={inputRef} variant="brake"><ArrowDown/></TouchButton><TouchButton action="forward" label="Accelerate" inputRef={inputRef} variant="gas"><ArrowUp/><small>GAS</small></TouchButton></div></div>}
    </main>
    <div className="foot-bar"><span>ANIK STUDIOS · BIGGER WORLD v3.1</span><span className="built-with"><span className="built-dot"/> PIXEL WORLD ONLINE</span></div>
    {toast&&isRacing&&<div className={`event-toast ${toast.color} ${toast.kind||''}`} key={toast.id}><strong>{toast.heading}</strong><small>{toast.small}</small></div>}
    {phase==='countdown'&&<div className="countdown-overlay"><small>GET READY</small><strong>{countdownValue>0?countdownValue:'GO!'}</strong><span>{mobile?'HOLD GAS TO ACCELERATE':'HOLD W TO ACCELERATE'}</span></div>}
    {phase==='ready'&&<IntroCard loaded={loaded} onStart={start} onExplore={startExplore} mobile={mobile} onInstall={installGame} canInstall={!!installPrompt&&!standalone}/>}
    {(phase==='finished'||phase==='paused')&&<CenterDialog type={phase} mode={mode} elapsed={hud.elapsed} bestLap={hud.bestLap} coins={hud.coins} onContinue={togglePause} onRestart={restart} onExplore={startExplore}/>}
    {showMap&&<WorldMapPanel hud={hud} onClose={()=>setShowMap(false)} onTravel={travelTo}/>}
    {showSettings&&<div className="help-backdrop settings-backdrop" onClick={()=>setShowSettings(false)}><div className="help-panel settings-panel" onClick={e=>e.stopPropagation()}><div className="help-top"><h2>GALAXY SETTINGS</h2><button onClick={()=>setShowSettings(false)} aria-label="Close settings"><X/></button></div><p>Choose the best 3D performance for your phone. Original 16-pixel textures and chunked voxel scenery are enabled in every preset.</p><div className="mobile-setting-caption"><GaugeCircle size={18}/> GRAPHICS QUALITY</div><div className="quality-options" role="group" aria-label="Graphics quality">{QUALITY_OPTIONS.map(q=><button key={q} data-testid={`quality-${q}`} className={quality===q?'selected':''} aria-pressed={quality===q} onClick={()=>setQuality(q)}>{q.toUpperCase()}</button>)}</div><p className="quality-explain">Current renderer: {budget.label}. Render scale: {budget.dpr.toFixed(2)}×. {quality==='auto'?'Automatically chosen using available device hints.':''}</p><BattleChoice/><div className="weather-preview-actions"><button data-testid="next-weather" onClick={()=>setWeatherPreviewRequest(old=>({id:(old?.id||0)+1,kind:'weather'}))}><CloudRain size={15}/> NEXT WEATHER</button><button data-testid="preview-night" onClick={()=>setWeatherPreviewRequest(old=>({id:(old?.id||0)+1,kind:'night'}))}><Moon size={15}/> PREVIEW NIGHT</button></div><button className="settings-row-button" aria-pressed={haptics} onClick={()=>setHaptics(x=>!x)}><Vibrate size={20}/> VIBRATION FEEDBACK <strong>{haptics?'ON':'OFF'}</strong></button><button className="settings-row-button" data-testid="toggle-voice" aria-pressed={voice} onClick={()=>setVoice(x=>!x)}>{voice?<Volume2 size={20}/>:<VolumeX size={20}/>} ANNOUNCER VOICE <strong>{voice?'ON':'OFF'}</strong></button><button className="settings-row-button" data-testid="toggle-sfx" aria-pressed={sfx} onClick={()=>setSfx(x=>!x)}><Speaker size={20}/> ENGINE &amp; EFFECTS <strong>{sfx?'ON':'OFF'}</strong></button><button className="settings-row-button" data-testid="toggle-music" aria-pressed={music} onClick={()=>setMusic(x=>!x)}>{music?<Music size={20}/>:<Music2 size={20}/>} MUSIC <strong>{music?'ON':'OFF'}</strong></button><button className="settings-row-button" onClick={enterFullscreen}><Maximize2 size={20}/> FULLSCREEN / LANDSCAPE <span>OPEN</span></button><button className="settings-row-button" onClick={installGame}><Download size={20}/> INSTALL TO HOME SCREEN <span>{standalone?'INSTALLED':installPrompt?'INSTALL':'HELP'}</span></button><button className="primary-button" onClick={()=>setShowSettings(false)}>BACK TO RACE <Check size={16}/></button></div></div>}
    {showInstallHelp&&<div className="help-backdrop settings-backdrop" onClick={()=>setShowInstallHelp(false)}><div className="help-panel" onClick={e=>e.stopPropagation()}><div className="help-top"><h2>INSTALL ON SAMSUNG</h2><button onClick={()=>setShowInstallHelp(false)} aria-label="Close installation help"><X/></button></div><p>Open the game over HTTPS in <strong>Samsung Internet</strong> or <strong>Chrome</strong>. Tap the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Launch ANIK Racers from your Apps screen to play full screen.</p><p>Rotate the phone horizontally. The first play loads the 3D models; later launches can reuse cached game assets.</p><button className="primary-button" onClick={()=>setShowInstallHelp(false)}>GOT IT <Check size={16}/></button></div></div>}
    {showHow&&<div className="help-backdrop" onClick={()=>setShowHow(false)}><div className="help-panel" onClick={e=>e.stopPropagation()}><div className="help-top"><h2>HOW TO RACE</h2><button onClick={()=>setShowHow(false)} aria-label="Close help"><X size={21}/></button></div><p>Race three laps on Voxel Valley. Cross checkpoints 1 and 2 in order before the finish line. You cannot skip checkpoints to win.</p><div className="help-table"><div><kbd>W</kbd><kbd>↑</kbd><span>Accelerate</span></div><div><kbd>S</kbd><kbd>↓</kbd><span>Brake / reverse</span></div><div><kbd>A</kbd><kbd>D</kbd><span>Steer</span></div><div><kbd>SPACE</kbd><span>Drift / tighter turning</span></div><div><kbd>C</kbd><span>Chase / overhead camera</span></div><div><kbd>P</kbd><kbd>ESC</kbd><span>Pause / resume</span></div><div><kbd>R</kbd><span>Restart race</span></div></div><p className="help-note">Battle Race adds warning mines, explosive barrels and BOMB / MINE controls to the Voxel Valley circuit. Press B to throw ahead or Q to drop behind. Blast damage reduces kart health; wrecked karts recover with a temporary shield without losing lap progress. Cyan pads refill ammo and green pads repair. Rival karts deploy hazards too. Turn Battle Race off for a classic race. Three AI racers drive around the track and patrol the world. Eight voxel creatures wander or flee from approaching racers. Crash into a bot at speed to reduce its health; a powerful smash knocks it out in an arcade-style burst. Bots reappear after a short cooldown. For open-world mode, press E or tap the compass, open the map with M to fast travel, find all ten relics, and follow the highways into four new frontier districts. Drive through the glowing grove portal to return to Voxel Valley. Blockhaven Village has 12 friendly walking AI characters. Approach at low speed, tap TALK or press T, and read their tips. Villagers step aside for traffic and cannot be damaged. Use the map to travel to three lakes; water causes splash, drag and gradual submersion before automatic shore rescue. Weather cycles through CLEAR → RAIN → SNOW → WINDY with changes to steering grip and wind drift. The clock progresses through day and night. Settings can preview the next weather or nighttime. On Galaxy, use the arrows to steer, GAS to accelerate, BRAKE to slow down, and DRIFT for sharper turns.</p><button className="primary-button" onClick={()=>setShowHow(false)}>GOT IT <Check size={16}/></button></div></div>}
  </div>
}

export default function App(){return <BattleProvider><WorldApp/><BattleHud/></BattleProvider>}
