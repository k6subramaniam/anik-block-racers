import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {ArrowLeft,ArrowRight,ArrowUp,ArrowDown,Play,Pause,RotateCcw,Flag,Camera,Settings2,X,Shield,Bomb,TriangleAlert,HeartPulse} from 'lucide-react'
import BattleScene,{battleHud} from './Scene.jsx'
import {BATTLE_TRACKS,battleTrack} from './tracks.js'
import {createBattle,battleRanking} from './simulation.js'
import {getRenderBudget,isCoarsePointer,safeStoredQuality} from '../game/mobile.js'
import './styles.css'
const EMPTY={forward:false,backward:false,left:false,right:false,drift:false,bomb:false,mine:false}
const fresh=id=>({state:createBattle(id),acc:0,snap:true,sent:false})
const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}.${Math.floor((t%1)*10)}`
function useBattleControls(ref,actions){
  const callbacks=useRef(actions);callbacks.current=actions
  const held=useRef(new Map())
  const set=useCallback((action,id,down)=>{
    if(!held.current.has(action))held.current.set(action,new Set())
    const group=held.current.get(action);down?group.add(id):group.delete(id);ref.current[action]=group.size>0
  },[ref])
  const reset=useCallback(()=>{held.current.clear();ref.current={...EMPTY}},[ref])
  useEffect(()=>{
    const keys={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'drift'}
    const down=e=>{
      if(e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||''))return
      if(keys[e.code]){e.preventDefault();set(keys[e.code],e.code,true);return}
      if(e.repeat)return
      if(e.code==='KeyB'){e.preventDefault();callbacks.current.deploy('bomb')}
      if(e.code==='KeyV'){e.preventDefault();callbacks.current.deploy('mine')}
      if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();callbacks.current.pause()}
      if(e.code==='KeyC'){e.preventDefault();callbacks.current.camera()}
      if(e.code==='Enter'){e.preventDefault();callbacks.current.start()}
    }
    const up=e=>{if(keys[e.code]){e.preventDefault();set(keys[e.code],e.code,false)}}
    const blur=()=>{reset();callbacks.current.blur()}
    const visibility=()=>{if(document.hidden)blur()}
    window.addEventListener('keydown',down,{passive:false});window.addEventListener('keyup',up,{passive:false})
    window.addEventListener('blur',blur);window.addEventListener('pagehide',blur);document.addEventListener('visibilitychange',visibility)
    return()=>{reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur);document.removeEventListener('visibilitychange',visibility)}
  },[reset,set])
  return {set,reset}
}
function Pedal({action,label,children,controls,className=''}){
  const begin=e=>{e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{};controls.set(action,e.pointerId,true);e.currentTarget.dataset.held='yes'}
  const end=e=>{e.preventDefault();controls.set(action,e.pointerId,false);delete e.currentTarget.dataset.held}
  return <button aria-label={label} data-testid={`battle-${action}`} className={`br-pedal ${className}`} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onContextMenu={e=>e.preventDefault()}>{children}</button>
}
class Boundary extends React.Component{
  state={error:null}
  static getDerivedStateFromError(error){return {error}}
  render(){return this.state.error?<div className="br-error" role="alert"><h2>The battle track could not load</h2><p>Check your connection and reload. Your other game modes and saved scores have not changed.</p><button onClick={()=>location.reload()}>Reload</button></div>:this.props.children}
}
function TrackPreview({track,actors=[]}){
  const data=useMemo(()=>{
    const xs=track.path.map(p=>p.x),zs=track.path.map(p=>p.z),x=Math.min(...xs)-9,z=Math.min(...zs)-9,w=Math.max(...xs)-x+9,h=Math.max(...zs)-z+9
    return {box:`${x} ${z} ${w} ${h}`,points:track.path.map(p=>`${p.x},${p.z}`).join(' ')}
  },[track])
  return <svg viewBox={data.box} role="img" aria-label={`${track.name} circuit layout`}><polygon points={data.points} fill="none" stroke="#17303c" strokeWidth={track.width+3}/><polygon points={data.points} fill="none" stroke={track.color} strokeWidth="3"/>
    <circle cx={track.path[0].x} cy={track.path[0].z} r="5" fill="white"/>
    {actors.map(a=><circle key={a.id} cx={a.x} cy={a.z} r={a.id==='player'?5.5:3.5} fill={a.color} stroke="#10242e" strokeWidth="1.5"/>)}</svg>
}
export default function BattleGame({onExit}){
  const [trackId,setTrackId]=useState(()=>{const id=new URLSearchParams(location.search).get('track');return BATTLE_TRACKS.some(t=>t.id===id)?id:'blast'})
  const track=useMemo(()=>battleTrack(trackId),[trackId])
  const engineRef=useRef(null);if(!engineRef.current)engineRef.current=fresh(trackId)
  const inputRef=useRef({...EMPTY}),phaseRef=useRef('lobby'),resetRef=useRef(()=>{})
  const [phase,setPhase]=useState('lobby'),[ready,setReady]=useState(false),[count,setCount]=useState(3),[settings,setSettings]=useState(false)
  const [hud,setHud]=useState(()=>battleHud(engineRef.current.state)),[result,setResult]=useState(null),[camera,setCamera]=useState('chase')
  const [quality,setQuality]=useState(()=>{try{return safeStoredQuality(localStorage.getItem('anik-quality'))}catch{return 'auto'}})
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  phaseRef.current=phase
  const budget=getRenderBudget(quality,{coarse:isCoarsePointer(),memory:navigator.deviceMemory,cores:navigator.hardwareConcurrency})
  const start=useCallback(()=>{
    if(!ready||!['lobby','results','paused'].includes(phaseRef.current))return
    resetRef.current();engineRef.current=fresh(trackId);setHud(battleHud(engineRef.current.state));setResult(null);setCount(3);setSettings(false);setPhase('countdown')
  },[ready,trackId])
  const pause=useCallback(()=>{
    resetRef.current()
    if(phaseRef.current==='racing')setPhase('paused')
    else if(phaseRef.current==='paused'){setSettings(false);setPhase('racing')}
    else if(phaseRef.current==='countdown')setPhase('lobby')
  },[])
  const blur=useCallback(()=>{if(phaseRef.current==='racing')setPhase('paused');else if(phaseRef.current==='countdown')setPhase('lobby')},[])
  const deploy=useCallback(type=>{
    if(phaseRef.current!=='racing')return
    const p=engineRef.current.state.actors[0]
    if(p.hp>0&&p.respawn<=0&&p[`${type}Cooldown`]<=0)inputRef.current[type]=true
  },[])
  const controls=useBattleControls(inputRef,{start,pause,blur,deploy,camera:()=>setCamera(c=>c==='chase'?'aerial':'chase')});resetRef.current=controls.reset
  useEffect(()=>{if(phase!=='racing')controls.reset()},[phase,controls.reset])
  useEffect(()=>{
    if(phase!=='countdown')return
    const timers=[setTimeout(()=>setCount(2),1000),setTimeout(()=>setCount(1),2000),setTimeout(()=>setPhase('racing'),3000)]
    return()=>timers.forEach(clearTimeout)
  },[phase])
  useEffect(()=>{try{localStorage.setItem('anik-quality',quality)}catch{}},[quality])
  useEffect(()=>{
    if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{})
  },[])
  useEffect(()=>{
    if(phase!=='racing'||!navigator.wakeLock?.request)return
    let lock,closed=false
    navigator.wakeLock.request('screen').then(l=>{if(closed)l.release().catch(()=>{});else lock=l}).catch(()=>{})
    return()=>{closed=true;lock?.release().catch(()=>{})}
  },[phase])
  const finish=useCallback(state=>{setHud(battleHud(state));setResult({actors:battleRanking(state),time:state.tick/60});setPhase('results');resetRef.current()},[])
  const changeTrack=id=>{
    controls.reset();setTrackId(id);engineRef.current=fresh(id);setHud(battleHud(engineRef.current.state));setPhase('lobby');setResult(null)
    const url=new URL(location.href);url.search='';url.searchParams.set('view','battle');url.searchParams.set('track',id);history.replaceState({},'',url)
  }
  const openSettings=()=>{controls.reset();if(phase==='racing')setPhase('paused');if(phase==='countdown')setPhase('lobby');setSettings(true)}
  const event=hud.notice&&hud.notice.until>hud.tick?hud.notice:null
  const eventText=event?.kind==='damage'?`BLAST HIT −${event.damage} ARMOR`:event?.kind==='knockout'?'KART DISABLED':event?.kind==='repair'?'+40 ARMOR REPAIR':event?.kind==='lap'?'LAP COMPLETE':event?.kind==='deploy'?(event.type==='bomb'?'BOMB THROWN':'MINE DROPPED'):null
  return <div className={`battle-game br-phase-${phase}`} data-testid="battle-game" data-track={trackId} data-phase={phase}>
    <div className="br-world"><Boundary><BattleScene engineRef={engineRef} inputRef={inputRef} phase={phase} track={track} budget={budget} cameraMode={camera} reduced={reduced} onReady={setReady} onHud={setHud} onFinish={finish}/></Boundary></div>
    <header className="br-header"><button className="br-brand" onClick={()=>{controls.reset();onExit()}} aria-label="Back to ANIK game modes"><span>A</span><b>ANIK <small>BATTLE RACE</small></b></button><span className="br-track-label">{track.name} · {track.weather}</span><nav><button onClick={()=>setCamera(c=>c==='chase'?'aerial':'chase')} aria-label="Change battle camera"><Camera/></button><button onClick={openSettings} aria-label="Battle graphics settings"><Settings2/></button><button onClick={pause} disabled={!['racing','paused'].includes(phase)} aria-label="Pause or resume battle" data-testid="battle-pause">{phase==='paused'?<Play/>:<Pause/>}</button></nav></header>
    {phase!=='lobby'&&phase!=='results'&&<>
      <div className="br-stats"><div><small>LAP</small><b data-testid="battle-lap">{hud.lap}<em>/3</em></b></div><div><small>POSITION</small><b>{hud.rank}<em>/4</em></b></div><div><small>RACE TIME</small><b data-testid="battle-time">{clock(hud.seconds)}</b></div></div>
      <div className={`br-health ${hud.hp<=30?'low':''}`} data-testid="battle-armor" data-damage={hud.damageTaken} data-blasts={hud.totalBlasts}><div><Shield size={15}/><span>{hud.shield>0?'SHIELD ACTIVE':'KART ARMOR'}</span><b data-testid="battle-health">{hud.hp}</b></div><div className="br-health-track"><i style={{width:`${hud.hp}%`}}/></div></div>
      <aside className="br-rivals" aria-label="AI racer armor">{hud.actors.filter(a=>a.id!=='player').map(a=><div key={a.id} data-testid={`armor-${a.id}`} data-hp={a.hp}><i style={{background:a.color}}/><span>{a.name}</span><b>{a.finished?'FINISHED':`${a.hp} HP`}</b></div>)}</aside>
      <div className="br-minimap"><TrackPreview track={track} actors={hud.actors}/></div>
      {hud.warning!==null&&phase==='racing'&&<div className="br-danger" role="status"><TriangleAlert size={15}/> BLAST ZONE · {hud.warning.toFixed(1)}s — STEER CLEAR</div>}
    </>}
    {phase==='racing'&&<>
      <div className="br-deploy"><button onClick={()=>deploy('bomb')} data-testid="battle-bomb" disabled={hud.bombCooldown>0||hud.respawn>0}><Bomb size={18}/><span>BOMB <small>{hud.bombCooldown>0?`${hud.bombCooldown.toFixed(1)}s`:'READY · B'}</small></span></button><button onClick={()=>deploy('mine')} data-testid="battle-mine" disabled={hud.mineCooldown>0||hud.respawn>0}><TriangleAlert size={18}/><span>MINE <small>{hud.mineCooldown>0?`${hud.mineCooldown.toFixed(1)}s`:'READY · V'}</small></span></button></div>
      <div className="br-controls"><div><Pedal action="left" label="Steer battle kart left" controls={controls}><ArrowLeft/></Pedal><Pedal action="right" label="Steer battle kart right" controls={controls}><ArrowRight/></Pedal></div><div className="br-speed">{Math.round(Math.abs(hud.speed)*3.6)}<small>KM/H</small></div><div><Pedal action="drift" label="Drift battle kart" controls={controls} className="drift">DRIFT</Pedal><Pedal action="backward" label="Brake battle kart" controls={controls}><ArrowDown/></Pedal><Pedal action="forward" label="Accelerate battle kart" controls={controls} className="gas"><ArrowUp/><small>GAS</small></Pedal></div></div>
      {eventText&&<div className="br-event" role="status">{eventText}</div>}
      {hud.respawn>0&&<div className="br-recover" data-testid="battle-recovery"><RotateCcw size={26}/><strong>RECOVERING YOUR KART</strong><span>Back at your last checkpoint in {hud.respawn.toFixed(1)}s</span></div>}
    </>}
    {phase==='lobby'&&!settings&&<div className="br-lobby-wrap"><section className="br-lobby"><div className="br-eyebrow">NEW · 3-LAP ARCADE COMBAT</div><h1>RACE. DODGE.<br/><em>BLAST.</em></h1><p>Race Bolt, Nova and Pixel. Throw bombs, drop mines and dodge track hazards. Blasts damage <strong>every kart—including yours.</strong></p>
      <div className="br-track-select">{BATTLE_TRACKS.map(t=><button key={t.id} className={trackId===t.id?'selected':''} onClick={()=>changeTrack(t.id)} data-testid={`battle-track-${t.id}`} aria-pressed={trackId===t.id}><TrackPreview track={battleTrack(t.id)}/><span><b>{t.name}</b><small>{t.tag}</small></span></button>)}</div>
      <button className="br-primary" onClick={start} disabled={!ready} data-testid="battle-start"><Play size={18} fill="currentColor"/>{ready?'START BATTLE RACE':'LOADING KARTS…'}<span>↗</span></button>
      <div className="br-legend"><span><TriangleAlert size={13}/> Red tiles = mines</span><span><Bomb size={13}/> Orange rings = blast zone</span><span><HeartPulse size={13}/> Green pads = repair</span></div><small className="br-help">WASD / arrows · Space drift · B bomb · V mine · P pause. On phone, use the touch buttons. Bots use the same damage and weapon cooldowns.</small>
    </section></div>}
    {phase==='countdown'&&<div className="br-countdown"><small>ARMOR ON. EYES ON THE TRACK.</small><strong>{count}</strong><span>3 laps · Sequential checkpoints · Friendly fire is ON</span></div>}
    {phase==='paused'&&!settings&&<div className="br-overlay"><section className="br-panel"><div className="br-eyebrow">TIME AND FUSES FROZEN</div><h2>BATTLE PAUSED</h2><p>Your kart, AI and explosives are paused together.</p><button className="br-primary" onClick={pause} data-testid="battle-resume"><Play/> RESUME RACE</button><button className="br-secondary" onClick={start}><RotateCcw/> RESTART RACE</button><button className="br-secondary" onClick={()=>setPhase('lobby')}>CHANGE TRACK</button></section></div>}
    {phase==='results'&&result&&<div className="br-overlay"><section className="br-panel br-results" data-testid="battle-results"><div className="br-eyebrow">FINISH LINE REACHED</div><h2>{result.actors[0].id==='player'?'VICTORY!':'RACE COMPLETE'}</h2><p>{track.name} · {clock(result.time)} · Position {result.actors.findIndex(a=>a.id==='player')+1} / 4</p><ol>{result.actors.map(a=><li key={a.id}><i style={{background:a.color}}/><b>{a.name}</b><span>{a.finished?clock(a.finishTick/60):`Lap ${a.lap}`}</span><small>{a.knockouts} KOs</small></li>)}</ol><button className="br-primary" onClick={start}><RotateCcw/> RACE AGAIN</button><button className="br-secondary" onClick={()=>setPhase('lobby')}>CHOOSE ANOTHER TRACK</button><small className="br-help">Battle races are separate from daily challenges and their saved scores.</small></section></div>}
    {settings&&<div className="br-overlay"><section className="br-panel" role="dialog" aria-modal="true" aria-label="Battle race settings"><div className="br-panel-top"><h2>GALAXY SETTINGS</h2><button aria-label="Close battle settings" onClick={()=>setSettings(false)}><X/></button></div><p>Graphics quality changes rendering only. Race rules and blast effects stay the same.</p><div className="br-quality">{['auto','eco','balanced','high'].map(q=><button key={q} className={q===quality?'selected':''} onClick={()=>setQuality(q)}>{q.toUpperCase()}</button>)}</div><label className="br-checkbox"><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> Reduced blast particles</label><p>Mines arm after a short delay. Bombs recharge in 6 seconds; dropped mines recharge in 9 seconds. A destroyed kart returns to its last checkpoint with a temporary shield. Green repair pads restore 40 armor. Villagers and other game modes are unaffected.</p><button className="br-primary" onClick={()=>setSettings(false)}>DONE</button></section></div>}
  </div>
}
