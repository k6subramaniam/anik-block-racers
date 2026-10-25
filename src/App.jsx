import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Camera, Check, CircleHelp, Clock3, Coins, Flag, Gauge, Keyboard, Medal, Pause, Play, RotateCcw, Shield, Trophy, Volume2, X, Settings2, Smartphone, Maximize2, Download, Vibrate, BatteryCharging, GaugeCircle } from 'lucide-react'
import RacingScene from './game/World.jsx'
import { formatTime, INPUT_DEFAULT } from './game/simulation.js'
import { LAPS_TO_WIN } from './game/track.js'
import { createHeldInput, getRenderBudget, isCoarsePointer, safeStoredQuality, QUALITY_OPTIONS } from './game/mobile.js'

const phrases={
  'checkpoint-1':{heading:'CHECKPOINT 1',small:'Gate validated',color:'lime'},
  'checkpoint-2':{heading:'CHECKPOINT 2',small:'Head to the finish line',color:'lime'},
  lap:{heading:'LAP COMPLETE!',small:'Keep the momentum',color:'orange'},
  boost:{heading:'TURBO BOOST!',small:'Full throttle',color:'lime'},
  coin:{heading:'+10 POINTS',small:'Block coin collected',color:'orange'},
  wall:{heading:'WALL HIT',small:'Steer back into the racing line',color:'orange'},
  obstacle:{heading:'OBSTACLE!',small:'Find a better line',color:'orange'},
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
  const actions=useRef(callbacks)
  actions.current=callbacks
  useEffect(()=>{
    const maps={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'drift'}
    const down=e=>{
      if(maps[e.code]){e.preventDefault();inputs.current[maps[e.code]]=true;return}
      if(e.repeat)return
      if(e.code==='Enter'){e.preventDefault();actions.current.start()}
      if(e.code==='KeyR'){e.preventDefault();actions.current.restart()}
      if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();actions.current.togglePause()}
      if(e.code==='KeyC'){e.preventDefault();actions.current.toggleCamera()}
    }
    const up=e=>{if(maps[e.code]){e.preventDefault();inputs.current[maps[e.code]]=false}}
    const reset=()=>{inputs.current={...INPUT_DEFAULT};actions.current.onBlur?.()}
    const onVisibility = () => { if(document.hidden) reset() }
    window.addEventListener('keydown',down,{passive:false});window.addEventListener('keyup',up,{passive:false});window.addEventListener('blur',reset)
    window.addEventListener('pagehide',reset); document.addEventListener('visibilitychange',onVisibility)
    return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);window.removeEventListener('pagehide',reset);document.removeEventListener('visibilitychange',onVisibility)}
  },[inputs])
}

function TouchButton({action,children,variant='',inputRef,label}){
  const held = useRef(null)
  if (!held.current) held.current = createHeldInput(inputRef, action)
  useEffect(() => {
    const release = () => held.current?.reset()
    window.addEventListener('blur',release)
    document.addEventListener('visibilitychange',release)
    return () => {release();window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',release)}
  },[])
  const begin = e => {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {};
    held.current.down(e.pointerId)
    e.currentTarget.classList.add('is-pressed')
  }
  const finish = e => {
    e.preventDefault()
    held.current.up(e.pointerId)
    if (!held.current.size) e.currentTarget.classList.remove('is-pressed')
  }
  return <button type="button" className={`touch-btn ${variant}`} aria-label={label||`${action} control`} data-testid={`touch-${action}`}
    onContextMenu={e=>e.preventDefault()} onPointerDown={begin} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>{children}</button>
}

function Speedometer({speed,boost}){
  const kmh=Math.max(0,Math.round(Math.abs(speed)*3.6))
  const pct=Math.min(100,kmh/112*100)
  return <div className={`speedometer ${boost?'boost-on':''}`} data-testid="speedometer">
    <svg className="speed-arc" viewBox="0 0 148 148" aria-hidden="true"><circle cx="74" cy="74" r="62" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="8" strokeLinecap="round" strokeDasharray="296 390" transform="rotate(135 74 74)" /><circle cx="74" cy="74" r="62" fill="none" stroke={boost?'#ffb357':'#b9f65c'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct*2.96} 390`} transform="rotate(135 74 74)" /></svg>
    <div className="speed-content"><Gauge size={15} strokeWidth={2.5} /><span className="speed-numeral">{kmh}</span><span className="speed-label">KM / H</span></div>
  </div>
}

function IntroCard({loaded,onStart,mobile,onInstall,canInstall}){
  return <div className="dialog-backdrop">
    <div className="intro-panel">
      <div className="card-eyebrow"><span className="green-dot" /> HIGGSFIELD 3D WORLD · SPRINT 01</div>
      <div className="intro-heading"><span>RACE THE</span><strong>BLOCKS.</strong></div>
      <p className="intro-copy">Drift around Voxel Valley, chase your best lap, and cross every checkpoint to claim the finish.</p>
      {mobile && <div className="mobile-intro-tip"><Smartphone size={18}/><div><strong>BUILT FOR SAMSUNG GALAXY</strong><span>Rotate to landscape · Hold the glowing pedal to race</span></div></div>}
      <div className="map-details">
        <div><span>TRACK 01</span><strong>VOXEL VALLEY</strong></div>
        <div><span>RACE TYPE</span><strong>SOLO TIME TRIAL</strong></div>
        <div><span>DISTANCE</span><strong>3 LAPS</strong></div>
      </div>
      <button className="primary-button" onClick={onStart} disabled={!loaded} data-testid="start-race"><Play fill="currentColor" size={17} />{loaded?'START RACE':'LOADING THE WORLD'}<span>↗</span></button>
      <p className="intro-hint">{loaded?(mobile?'FULLSCREEN LANDSCAPE RECOMMENDED':'PRESS ENTER TO START'):'Loading Higgsfield 3D models and racing physics…'}</p>
      {mobile && <button className="install-secondary" onClick={onInstall}><Download size={16}/>{canInstall?'INSTALL GAME ON PHONE':'HOW TO INSTALL ON GALAXY'}</button>}
    </div>
    <div className="intro-lower"><div className="keys-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>DRIVE</span><span className="hint-divider" /><kbd>SPACE</kbd><span>DRIFT</span><span className="hint-divider" /><kbd>C</kbd><span>CAMERA</span></div></div>
  </div>
}

function CenterDialog({type,elapsed,bestLap,coins,onContinue,onRestart}){
  const finished=type==='finished'
  return <div className="dialog-backdrop"><div className="final-panel">
    <div className="result-medal">{finished?<Trophy size={32}/>:<Pause size={30}/>}</div>
    <div className="card-eyebrow">{finished?'RACE COMPLETE':'RACE PAUSED'}</div>
    <h1>{finished?<>VOXEL VALLEY <em>CONQUERED.</em></>:<>TAKE A <em>BREATHER.</em></>}</h1>
    <p>{finished?'You cleared every checkpoint and completed all three laps. Your time is on the board.':'The timer is frozen. Return to the race whenever you are ready.'}</p>
    <div className="finish-grid"><div><small>RACE TIME</small><strong>{formatTime(elapsed)}</strong></div><div><small>BEST LAP</small><strong>{formatTime(bestLap)}</strong></div><div><small>COINS</small><strong>{coins}</strong></div></div>
    <div className="finish-actions">{!finished&&<button className="primary-button" onClick={onContinue}><Play fill="currentColor" size={17}/> RESUME RACE</button>}<button className={finished?'primary-button':'secondary-button'} onClick={onRestart}><RotateCcw size={17}/> RACE AGAIN</button></div>
  </div></div>
}

export default function App(){
  const inputRef=useRef({...INPUT_DEFAULT})
  const [loaded,setLoaded]=useState(false)
  const [phase,setPhase]=useState('ready')
  const [resetToken,setResetToken]=useState(0)
  const [countdownValue,setCountdownValue]=useState(3)
  const [cameraMode,setCameraMode]=useState('chase')
  const [showHow,setShowHow]=useState(false)
  const [showSettings,setShowSettings]=useState(false)
  const [showInstallHelp,setShowInstallHelp]=useState(false)
  const [installPrompt,setInstallPrompt]=useState(null)
  const [standalone,setStandalone]=useState(false)
  const mobile = isCoarsePointer()
  const [quality,setQuality]=useState(()=>{
    try {return safeStoredQuality(localStorage.getItem('anik-quality'))} catch {return 'auto'}
  })
  const [haptics,setHaptics]=useState(()=>{
    try {return localStorage.getItem('anik-haptics')!=='off'}catch{return true}
  })
  const hapticsRef=useRef(haptics)
  hapticsRef.current=haptics
  const budget=getRenderBudget(quality,{coarse:mobile,memory:typeof navigator==='undefined'?undefined:navigator.deviceMemory,cores:typeof navigator==='undefined'?undefined:navigator.hardwareConcurrency})
  const [hud,setHud]=useState({lap:1,checkpoint:0,speed:0,elapsed:0,bestLap:null,coins:0,collisions:0,countdown:3})
  const [toast,setToast]=useState(null)
  const toastTime=useRef(null)
  const start=useCallback(()=>{
    if(loaded && (phase==='ready'||phase==='finished')){
      if(mobile && screen.orientation?.lock) screen.orientation.lock('landscape').catch(()=>{})
      if(phase==='finished')setResetToken(x=>x+1)
      setPhase('countdown');setToast(null)
    }
  },[loaded,phase,mobile])
  const restart=useCallback(()=>{setResetToken(x=>x+1);inputRef.current={...INPUT_DEFAULT};setPhase('countdown');setToast(null)},[])
  const togglePause=useCallback(()=>setPhase(s=>s==='racing'?'paused':s==='paused'?'racing':s),[])
  const toggleCamera=useCallback(()=>setCameraMode(c=>c==='chase'?'aerial':'chase'),[])
  const onBlur=useCallback(()=>setPhase(s=>s==='racing'?'paused':s),[])
  const openHow=()=>{setPhase(s=>s==='racing'?'paused':s);setShowHow(true)}
  const openSettings=()=>{setPhase(s=>s==='racing'?'paused':s);setShowSettings(true)}
  const enterFullscreen=async()=>{
    try {
      if(document.fullscreenElement) await document.exitFullscreen?.()
      else await document.documentElement.requestFullscreen?.({navigationUI:'hide'})
    } catch {}
    try { await screen.orientation?.lock?.('landscape') } catch {}
  }
  const installGame=async()=>{
    if(installPrompt){
      try {await installPrompt.prompt();await installPrompt.userChoice} catch {}
      setInstallPrompt(null)
    } else setShowInstallHelp(true)
  }
  const onWorldEvent=useCallback((event,race)=>{
    if(event==='finished')return
    if(hapticsRef.current && navigator.vibrate){
      try {
        if(event==='wall'||event==='obstacle')navigator.vibrate(28)
        else if(event==='checkpoint-1'||event==='checkpoint-2'||event==='lap')navigator.vibrate([24,45,24])
        else if(event==='coin'||event==='boost')navigator.vibrate(15)
      } catch {}
    }
    const details=phrases[event]
    if(!details)return
    setToast({id:Math.random(),...details})
    if(toastTime.current)clearTimeout(toastTime.current)
    toastTime.current=setTimeout(()=>setToast(null),1250)
  },[])
  useEffect(()=>()=>{if(toastTime.current)clearTimeout(toastTime.current)},[])
  useKeyboard(inputRef,{start,restart,togglePause,toggleCamera,onBlur})
  useEffect(()=>{
    try {localStorage.setItem('anik-quality',quality)} catch {}
  },[quality])
  useEffect(()=>{
    try {localStorage.setItem('anik-haptics',haptics?'on':'off')} catch {}
  },[haptics])
  useEffect(()=>{
    const handler=e=>{e.preventDefault();setInstallPrompt(e)}
    const installed=()=>{setStandalone(true);setInstallPrompt(null)}
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true)
    window.addEventListener('beforeinstallprompt',handler)
    window.addEventListener('appinstalled',installed)
    return ()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',installed)}
  },[])
  useEffect(()=>{
    if(!import.meta.env.PROD || !('serviceWorker' in navigator))return
    const onLoad=()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{})
    window.addEventListener('load',onLoad)
    if(document.readyState==='complete')onLoad()
    return ()=>window.removeEventListener('load',onLoad)
  },[])
  useEffect(()=>{
    if(phase!=='racing' || !navigator.wakeLock?.request)return
    let lock, released=false
    navigator.wakeLock.request('screen').then(l=>{
      if(released)l.release().catch(()=>{})
      else lock=l
    }).catch(()=>{})
    return ()=>{released=true;lock?.release?.().catch(()=>{})}
  },[phase])
  useEffect(()=>{
    if(phase!=='countdown') return
    setCountdownValue(3)
    const timers=[
      window.setTimeout(()=>setCountdownValue(2),1000),
      window.setTimeout(()=>setCountdownValue(1),2000),
      window.setTimeout(()=>setCountdownValue(0),3000),
      window.setTimeout(()=>setPhase('racing'),3400),
    ]
    return ()=>timers.forEach(window.clearTimeout)
  },[phase,resetToken])
  const isRacing=phase==='racing'
  return <div className="app-shell">
    <div className="world-layer"><WorldErrorBoundary><RacingScene onReady={setLoaded} phase={phase} inputRef={inputRef} setHud={setHud} resetToken={resetToken} quality={quality} budget={budget} cameraMode={cameraMode} onPhase={setPhase} onEvent={onWorldEvent}/></WorldErrorBoundary></div>
    <div className="atmospheric-vignette" />
    <header className="top-bar">
      <div className="brand-block"><div className="brand-mark">A<span>▰</span></div><div className="brand-wordmark"><strong>ANIK<span> / </span>BLOCK RACERS</strong><small>BUILD THE SPEED.</small></div></div>
      <div className="top-track-pill"><span className="pill-circle" /><div><span>NOW RACING</span><strong>VOXEL VALLEY</strong></div><i>01 / 04</i></div>
      <div className="top-buttons"><button title="How to play" aria-label="How to play" onClick={openHow}><CircleHelp size={19}/></button><button title="Galaxy graphics and controls" aria-label="Graphics and controls settings" data-testid="open-settings" onClick={openSettings}><Settings2 size={19}/></button><button title="Switch camera (C)" aria-label="Switch racing camera" onClick={toggleCamera}><Camera size={19}/></button><button title="Pause or resume (P)" aria-label="Pause or resume race" disabled={phase==='ready'||phase==='finished'} onClick={togglePause}>{phase==='paused'?<Play size={19}/>:<Pause size={19}/>}</button></div>
    </header>
    <main className="hud" aria-live="off">
      <div className="hud-top-row"><div className="stat-card lap-card"><div className="stat-caption"><Flag size={15}/> CURRENT LAP</div><div className="lap-value"><strong>{String(hud.lap).padStart(2,'0')}</strong><span> / {String(LAPS_TO_WIN).padStart(2,'0')}</span></div><div className="lap-progress"><span style={{width:`${((hud.lap-1 + hud.checkpoint/3)/LAPS_TO_WIN)*100}%`}}/></div></div><div className="stat-card timer-card"><div className="stat-caption"><Clock3 size={15}/> RACE TIME</div><div className="timer-value" data-testid="race-time">{formatTime(hud.elapsed)}</div><div className="stat-caption small-caption">BEST LAP <span>{formatTime(hud.bestLap)}</span></div></div></div>
      <div className="top-right-stats"><div className="mini-stat"><Coins size={17}/><div><small>COINS</small><b>{String(hud.coins||0).padStart(2,'0')}</b></div></div><div className="mini-stat"><Shield size={17}/><div><small>CHECKPOINT</small><b>{hud.checkpoint} <span>/ 2</span></b></div></div><div className="quality-indicator">{budget.tier.toUpperCase()}</div></div>
      <div className="bottom-left"><div className="waypoint"><span className="waypoint-icon"><Activity size={17}/></span><div><small>ACTIVE CIRCUIT</small><strong>VOXEL VALLEY <span>01</span></strong></div></div><div className="control-strip"><div><kbd>W</kbd><span>GAS</span></div><div><kbd>A</kbd><kbd>D</kbd><span>STEER</span></div><div><kbd>S</kbd><span>BRAKE</span></div><div><kbd>SPACE</kbd><span>DRIFT</span></div></div></div>
      <div className="bottom-right"><div className="gear-display"><span>DRIVE MODE</span><strong>{hud.speed<-.5?'REV':hud.boostTimer>0?'TURBO':'SPORT'}</strong></div><Speedometer speed={hud.speed||0} boost={hud.boostTimer>0}/></div>
      {isRacing&&<div className="mobile-controls" aria-label="Touch racing controls"><div className="mobile-steer"><TouchButton action="left" label="Steer left" inputRef={inputRef}><ArrowLeft/></TouchButton><TouchButton action="right" label="Steer right" inputRef={inputRef}><ArrowRight/></TouchButton></div><div className="mobile-pedals"><TouchButton action="drift" label="Drift while turning" inputRef={inputRef} variant="drift">DRIFT</TouchButton><TouchButton action="backward" label="Brake or reverse" inputRef={inputRef} variant="brake"><ArrowDown/></TouchButton><TouchButton action="forward" label="Accelerate" inputRef={inputRef} variant="gas"><ArrowUp/><small>GAS</small></TouchButton></div></div>}
    </main>
    <div className="foot-bar"><span>ANIK STUDIOS · GALAXY EDITION</span><span className="built-with"><span className="built-dot"/> 3D ENGINE ONLINE</span></div>
    {toast && isRacing && <div className={`event-toast ${toast.color}`} key={toast.id}><strong>{toast.heading}</strong><small>{toast.small}</small></div>}
    {phase==='countdown'&&<div className="countdown-overlay"><small>GET READY</small><strong>{countdownValue>0?countdownValue:'GO!'}</strong><span>{mobile?'HOLD GAS TO ACCELERATE':'HOLD W TO ACCELERATE'}</span></div>}
    {phase==='ready'&&<IntroCard loaded={loaded} onStart={start} mobile={mobile} onInstall={installGame} canInstall={!!installPrompt&&!standalone}/>}
    {(phase==='finished'||phase==='paused')&&<CenterDialog type={phase} elapsed={hud.elapsed} bestLap={hud.bestLap} coins={hud.coins} onContinue={togglePause} onRestart={restart}/>}
    {showSettings&&<div className="help-backdrop settings-backdrop" onClick={()=>setShowSettings(false)}><div className="help-panel settings-panel" onClick={e=>e.stopPropagation()}><div className="help-top"><h2>GALAXY SETTINGS</h2><button onClick={()=>setShowSettings(false)} aria-label="Close settings"><X/></button></div><p>Choose the best balance of smooth 3D gameplay and battery life for your phone.</p><div className="mobile-setting-caption"><GaugeCircle size={18}/> GRAPHICS QUALITY</div><div className="quality-options" role="group" aria-label="Graphics quality">{QUALITY_OPTIONS.map(mode=><button key={mode} data-testid={`quality-${mode}`} className={quality===mode?'selected':''} aria-pressed={quality===mode} onClick={()=>setQuality(mode)}>{mode.toUpperCase()}</button>)}</div><p className="quality-explain">Current renderer: {budget.label}. Render scale: {budget.dpr.toFixed(2)}×. {quality==='auto'?'Automatically chosen using available device hints.':''}</p><button className="settings-row-button" aria-pressed={haptics} onClick={()=>setHaptics(x=>!x)}><Vibrate size={20}/> VIBRATION FEEDBACK <strong>{haptics?'ON':'OFF'}</strong></button><button className="settings-row-button" onClick={enterFullscreen}><Maximize2 size={20}/> FULLSCREEN / LANDSCAPE <span>OPEN</span></button><button className="settings-row-button" onClick={installGame}><Download size={20}/> INSTALL TO HOME SCREEN <span>{standalone?'INSTALLED':installPrompt?'INSTALL':'HELP'}</span></button><button className="primary-button" onClick={()=>setShowSettings(false)}>BACK TO RACE <Check size={16}/></button></div></div>}
    {showInstallHelp&&<div className="help-backdrop settings-backdrop" onClick={()=>setShowInstallHelp(false)}><div className="help-panel" onClick={e=>e.stopPropagation()}><div className="help-top"><h2>INSTALL ON SAMSUNG</h2><button onClick={()=>setShowInstallHelp(false)} aria-label="Close installation help"><X/></button></div><p>Once the game is hosted over HTTPS, open it with <strong>Samsung Internet</strong> or <strong>Chrome</strong>. Tap the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Launch ANIK Racers from your Apps screen to play full screen.</p><p>Rotate the phone horizontally. The first play loads the 3D models; later launches can reuse cached game assets.</p><button className="primary-button" onClick={()=>setShowInstallHelp(false)}>GOT IT <Check size={16}/></button></div></div>}
    {showHow&&<div className="help-backdrop" onClick={()=>setShowHow(false)}><div className="help-panel" onClick={e=>e.stopPropagation()}><div className="help-top"><h2>HOW TO RACE</h2><button onClick={()=>setShowHow(false)} aria-label="Close help"><X size={21}/></button></div><p>Race three laps on Voxel Valley. Cross checkpoints 1 and 2 in order before the finish line. You cannot skip checkpoints to win.</p><div className="help-table"><div><kbd>W</kbd><kbd>↑</kbd><span>Accelerate</span></div><div><kbd>S</kbd><kbd>↓</kbd><span>Brake / reverse</span></div><div><kbd>A</kbd><kbd>D</kbd><span>Steer</span></div><div><kbd>SPACE</kbd><span>Drift / tighter turning</span></div><div><kbd>C</kbd><span>Chase / overhead camera</span></div><div><kbd>P</kbd><kbd>ESC</kbd><span>Pause / resume</span></div><div><kbd>R</kbd><span>Restart race</span></div></div><p className="help-note">On a Galaxy phone, use the on-screen arrows to steer, GAS to accelerate, BRAKE to slow down, and DRIFT for sharper turns. The lime and cyan blocks mark boosts. Gold blocks are bonus coins. Hitting road edges or obstacles slows you down.</p><button className="primary-button" onClick={()=>setShowHow(false)}>GOT IT <Check size={16}/></button></div></div>}
  </div>
}
