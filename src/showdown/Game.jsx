import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {ArrowLeft,ArrowRight,ArrowUp,ArrowDown,Play,Pause,RotateCcw,Share2,Download,Trophy,X,Camera,Settings2,Film,Flag,Calendar,Shuffle,Check} from 'lucide-react'
import ShowdownScene from './Scene.jsx'
import {initialShowdown,makeArena,dailyChallenge,newChallenge,challengeTitle,makeChallengeUrl,resultFor} from './rules.js'
import {createReplay,recordReplay,bestMoment} from './replay.js'
import {localScores,saveResult,statsConsent,setStatsConsent,trackEvent,localStats,clearScores} from './storage.js'
import {shareChallenge,shareFile,makeScoreCard,beginClip,saveBlob} from './share.js'
import {getRenderBudget,isCoarsePointer,safeStoredQuality} from '../game/mobile.js'

const EMPTY={forward:false,backward:false,left:false,right:false,drift:false}
function engineFor(code){
  const state=initialShowdown(code),replay=createReplay();recordReplay(replay,state)
  return {state,arena:makeArena(code),replay,accumulator:0,snap:true,finishedSent:false,
    runId:globalThis.crypto?.randomUUID?.()||`run-${Date.now()}-${Math.random().toString(16).slice(2)}`}
}
function useControls(inputRef,callbacks){
  const api=useRef(callbacks);api.current=callbacks
  const held=useRef(new Map())
  const set=useCallback((action,id,down)=>{
    if(!held.current.has(action))held.current.set(action,new Set())
    const group=held.current.get(action);down?group.add(id):group.delete(id)
    inputRef.current[action]=group.size>0
  },[inputRef])
  const reset=useCallback(()=>{held.current.clear();inputRef.current={...EMPTY}},[inputRef])
  useEffect(()=>{
    const map={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'drift'}
    const down=e=>{
      if(e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||''))return
      if(map[e.code]){e.preventDefault();set(map[e.code],e.code,true);return}
      if(e.repeat)return
      if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();api.current.pause()}
      if(e.code==='KeyC'){e.preventDefault();api.current.camera()}
      if(e.code==='Enter'){e.preventDefault();api.current.start()}
    }
    const up=e=>{if(map[e.code]){e.preventDefault();set(map[e.code],e.code,false)}}
    const blur=()=>{reset();api.current.blur()}
    const hide=()=>{if(document.hidden)blur()}
    window.addEventListener('keydown',down,{passive:false});window.addEventListener('keyup',up,{passive:false})
    window.addEventListener('blur',blur);window.addEventListener('pagehide',blur);document.addEventListener('visibilitychange',hide)
    return()=>{reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',blur);document.removeEventListener('visibilitychange',hide)}
  },[reset,set])
  return {set,reset}
}
function Pedal({action,label,children,controls,className=''}){
  const begin=e=>{e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{};controls.set(action,e.pointerId,true);e.currentTarget.dataset.held='yes'}
  const end=e=>{e.preventDefault();controls.set(action,e.pointerId,false);delete e.currentTarget.dataset.held}
  return <button className={`sd-pedal ${className}`} data-testid={`sd-touch-${action}`} aria-label={label}
    onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onContextMenu={e=>e.preventDefault()}>{children}</button>
}
class SceneBoundary extends React.Component{
  state={error:null}
  static getDerivedStateFromError(error){return {error}}
  render(){return this.state.error?<div className="sd-load-error" role="alert"><h2>The 3D arena could not load</h2><p>Check your connection and WebGL support, then try again. Your saved scores are unchanged.</p><button onClick={()=>location.reload()}>Reload game</button></div>:this.props.children}
}
export default function ShowdownGame({invitation,onExit}){
  const [code,setCode]=useState(invitation.code),[target,setTarget]=useState(invitation.target)
  const [ready,setReady]=useState(false),[phase,setPhase]=useState('lobby'),[countdown,setCountdown]=useState(3)
  const [result,setResult]=useState(null),[board,setBoard]=useState(false),[settings,setSettings]=useState(false)
  const [consent,setConsent]=useState(()=>statsConsent()),[message,setMessage]=useState(''),[manualLink,setManualLink]=useState('')
  const [card,setCard]=useState(null),[clip,setClip]=useState(null),[camera,setCamera]=useState('chase')
  const [quality,setQuality]=useState(()=>{try{return safeStoredQuality(localStorage.getItem('anik-quality'))}catch{return 'auto'}})
  const [hud,setHud]=useState({remaining:60,score:0,combo:1,smashes:0,jumps:0,speed:0,weather:'CLEAR'})
  const engineRef=useRef(null);if(!engineRef.current)engineRef.current=engineFor(code)
  const phaseRef=useRef(phase);phaseRef.current=phase
  const inputRef=useRef({...EMPTY}),captureRef=useRef(null),messageTimer=useRef(null)
  const arena=useMemo(()=>makeArena(code),[code])
  const budget=getRenderBudget(quality,{coarse:isCoarsePointer(),memory:navigator.deviceMemory,cores:navigator.hardwareConcurrency})
  const notice=useCallback(copy=>{setMessage(copy);clearTimeout(messageTimer.current);messageTimer.current=setTimeout(()=>setMessage(''),6500)},[])
  const clearControls=useRef(()=>{})
  const stopReplay=useCallback(()=>{
    captureRef.current?.cancel();captureRef.current=null;engineRef.current.capture=null
    if(['replay','exporting'].includes(phaseRef.current))setPhase('results')
  },[])
  const pause=useCallback(()=>{
    clearControls.current()
    if(phaseRef.current==='running')setPhase('paused')
    else if(phaseRef.current==='paused'){setBoard(false);setSettings(false);setPhase('running')}
    else if(['replay','exporting'].includes(phaseRef.current))stopReplay()
    else if(phaseRef.current==='countdown')setPhase('lobby')
  },[stopReplay])
  const blur=useCallback(()=>{
    if(phaseRef.current==='running')setPhase('paused')
    else if(phaseRef.current==='countdown')setPhase('lobby')
    else if(['replay','exporting'].includes(phaseRef.current))stopReplay()
  },[stopReplay])
  const start=useCallback(()=>{
    if(!ready||!['lobby','results'].includes(phaseRef.current))return
    clearControls.current();stopReplay();engineRef.current=engineFor(code)
    setResult(null);setCard(null);setClip(null);setMessage('');setManualLink('');setCountdown(3)
    setHud({remaining:60,score:0,combo:1,smashes:0,jumps:0,speed:0,weather:'CLEAR'})
    setPhase('countdown');setSettings(false);setBoard(false)
  },[ready,code,stopReplay])
  const controls=useControls(inputRef,{start,pause,blur,camera:()=>setCamera(c=>c==='chase'?'aerial':'chase')})
  clearControls.current=controls.reset
  useEffect(()=>{trackEvent(invitation.invited?'challenge_open':'lobby_open',{code})},[])
  useEffect(()=>()=>{clearTimeout(messageTimer.current);captureRef.current?.cancel()},[])
  useEffect(()=>{
    if(phase!=='countdown')return
    const timers=[setTimeout(()=>setCountdown(2),1000),setTimeout(()=>setCountdown(1),2000),setTimeout(()=>{
      trackEvent('challenge_start',{code});setPhase('running')
    },3000)]
    return()=>timers.forEach(clearTimeout)
  },[phase,code])
  useEffect(()=>{if(phase!=='running')controls.reset()},[phase,controls.reset])
  useEffect(()=>{try{localStorage.setItem('anik-quality',quality)}catch{}},[quality])
  useEffect(()=>{
    if(!import.meta.env.PROD||!('serviceWorker' in navigator))return
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{})
  },[])
  useEffect(()=>{
    if(phase!=='running'||!navigator.wakeLock?.request)return
    let lock,closed=false
    navigator.wakeLock.request('screen').then(l=>{if(closed)l.release().catch(()=>{});else lock=l}).catch(()=>{})
    return()=>{closed=true;lock?.release().catch(()=>{})}
  },[phase])
  const finish=useCallback(state=>{
    const completed=resultFor(state),old=localScores(completed.code)[0]?.score??-1
    const saved=saveResult(completed,engineRef.current.runId)
    setResult({...completed,saved:saved.saved,newBest:completed.score>old})
    trackEvent('challenge_complete',{code:completed.code,score:completed.score})
    setPhase('results');clearControls.current()
    if(!saved.saved)notice('Run completed. Scores could not be saved on this device.')
  },[notice])
  useEffect(()=>{
    if(!result)return
    let cancelled=false
    makeScoreCard(result,engineRef.current.screenshot).then(file=>{if(!cancelled)setCard(file)}).catch(()=>{if(!cancelled)notice('Image sharing is unavailable. Your challenge link still works.')})
    return()=>{cancelled=true}
  },[result,notice])
  const replayEnd=useCallback(()=>{
    if(captureRef.current){captureRef.current.stop();captureRef.current=null;engineRef.current.capture=null}
    setPhase('results')
  },[])
  const watchReplay=async(exportVideo=false)=>{
    if(!result)return
    const engine=engineRef.current,range=bestMoment(engine.replay)
    if(!range){notice('Not enough replay frames. You can still share your score.');return}
    engine.range=range;engine.replayTick=range.start;engine.replayDone=false;engine.replayEndSent=false;engine.snap=true
    clearControls.current();setMessage('')
    if(exportVideo){
      try{
        const capture=beginClip(result);captureRef.current=capture;engine.capture=capture
        const id=engine.runId
        capture.promise.then(file=>{if(engineRef.current.runId===id){setClip(file);notice('Your vertical replay is ready. Tap Share clip or Download clip.')}})
          .catch(error=>{if(engineRef.current.runId===id)notice(error.message)})
          .finally(()=>{if(engineRef.current.runId===id){engine.capture=null;captureRef.current=null;setPhase('results')}})
        setPhase('exporting')
      }catch(error){notice(error.message);setPhase('results')}
    }else{trackEvent('replay_watch',{code});setPhase('replay')}
  }
  const changeChallenge=next=>{
    controls.reset();stopReplay();setCode(next);setTarget(null);setPhase('lobby');setResult(null);setClip(null);setCard(null);setMessage('');setManualLink('')
    engineRef.current=engineFor(next)
    const url=new URL(location.href);url.search='';url.searchParams.set('challenge',next);history.replaceState({},'',url)
  }
  const share=async()=>{
    if(!result)return
    trackEvent('share_intent',{code,score:result.score})
    const response=await shareChallenge(result)
    if(response.status==='shared'){trackEvent('share_handoff',{code});notice('Challenge sent to your selected sharing app.')}
    if(response.status==='cancelled'){trackEvent('share_cancelled',{code});return}
    if(response.status==='copied'){trackEvent('link_copied',{code});notice('Challenge link copied. Send it to a friend!')}
    if(response.status==='manual'){setManualLink(response.url);notice('Copy this link to challenge a friend.')}
  }
  const shareMedia=async(file,type)=>{
    if(!file)return
    const link=makeChallengeUrl(location.href,code,result.score)
    const outcome=await shareFile(file,`Beat my ${result.score} points in ANIK Bot Smash: ${link}`)
    if(outcome==='cancelled')return
    trackEvent(outcome==='shared'?'share_handoff':type==='clip'?'clip_saved':'card_saved',{code})
    notice(outcome==='shared'?'Opened your selected sharing app.':`${type==='clip'?'Replay':'Score card'} downloaded. Share it with your challenge link.`)
  }
  const leave=()=>{
    if(['running','paused'].includes(phaseRef.current))trackEvent('challenge_abandon',{code})
    controls.reset();stopReplay();onExit()
  }
  const openPanel=name=>{
    controls.reset();if(phaseRef.current==='running')setPhase('paused')
    if(name==='board')setBoard(true);else setSettings(true)
  }
  const scores=board?localScores(code):[],stats=board?localStats():null
  const replaying=phase==='replay'||phase==='exporting'
  const event=hud.notice&&performance.now()-hud.notice.at<1400?hud.notice:null
  const title=event?.kind==='smash'?'BOT SMASHED':event?.kind==='land'?'BIG AIR LANDED':event?.kind==='jump'?'SEND IT!':event?.kind==='boost'?'TURBO!':event?'DIRECT HIT':''
  return <div className={`showdown phase-${phase}`} data-testid="showdown-game" data-arena-width={arena.bounds.maxX-arena.bounds.minX} data-bots={arena.bots.length}>
    <div className="sd-world"><SceneBoundary><ShowdownScene engineRef={engineRef} inputRef={inputRef} phase={phase} arena={arena} budget={budget} onReady={setReady} onHud={setHud} onFinish={finish} onReplayEnd={replayEnd} cameraMode={camera}/></SceneBoundary></div>
    <header className="sd-top">
      <button className="sd-brand" onClick={leave} aria-label="Return to original race and open world"><span>A</span><b>ANIK <small>BOT SMASH</small></b></button>
      <div className="sd-challenge-label">{challengeTitle(code)} · {arena.rulesVersion===1?'CLASSIC':'XL ARENA'}</div>
      <nav>
        <button onClick={()=>openPanel('board')} aria-label="Local leaderboard" data-testid="sd-board"><Trophy/></button>
        <button onClick={()=>setCamera(c=>c==='chase'?'aerial':'chase')} aria-label="Change camera"><Camera/></button>
        <button onClick={()=>openPanel('settings')} aria-label="Showdown settings" data-testid="sd-settings"><Settings2/></button>
        <button onClick={pause} disabled={!['running','paused','replay','exporting'].includes(phase)} aria-label="Pause or resume challenge" data-testid="sd-pause">{phase==='paused'?<Play/>:<Pause/>}</button>
      </nav>
    </header>
    {['running','paused','countdown'].includes(phase)&&<>
      <div className="sd-scorebar">
        <div className="sd-stat sd-score"><small>SCORE</small><strong data-testid="sd-score">{hud.score.toLocaleString()}</strong><span>{hud.smashes} BOTS SMASHED</span></div>
        <div className={`sd-timer ${hud.remaining<10?'urgent':''}`}><small>TIME LEFT</small><strong data-testid="sd-time">{hud.remaining.toFixed(1)}</strong></div>
        <div className="sd-stat sd-combo"><small>COMBO</small><strong data-testid="sd-combo">{hud.combo}×</strong><span>{hud.weather}</span></div>
      </div>
      {target!==null&&<div className="sd-target" data-testid="sd-target">FRIEND'S TARGET: {target.toLocaleString()} <small>Shared score · unverified</small></div>}
      {event&&phase==='running'&&<div className="sd-event" key={event.tick}><strong>{title}</strong>{event.points>0&&<span>+{event.points.toLocaleString()} · {event.combo}×</span>}</div>}
    </>}
    {phase==='running'&&<div className="sd-controls">
      <div><Pedal action="left" label="Steer left" controls={controls}><ArrowLeft/></Pedal><Pedal action="right" label="Steer right" controls={controls}><ArrowRight/></Pedal></div>
      <span className="sd-speed">{Math.round(Math.abs(hud.speed||0)*3.6)}<small>KM/H</small></span>
      <div><Pedal action="drift" label="Drift" controls={controls} className="drift">DRIFT</Pedal><Pedal action="backward" label="Brake or reverse" controls={controls}><ArrowDown/></Pedal><Pedal action="forward" label="Accelerate" controls={controls} className="gas"><ArrowUp/><small>GAS</small></Pedal></div>
    </div>}
    {phase==='lobby'&&<div className="sd-lobby-wrap"><section className="sd-lobby">
      <div className="sd-eyebrow"><span/> {arena.rulesVersion===1?'CLASSIC CHALLENGE · ORIGINAL ARENA':'BIGGER ARENA · 4× PLAYABLE AREA'}</div>
      <h1>BOT SMASH<br/><em>SHOWDOWN.</em></h1>
      <p>Ram {arena.bots.length} robots across a {arena.bounds.maxX-arena.bounds.minX} × {arena.bounds.maxZ-arena.bounds.minZ} metre arena. Hit {arena.ramps.length} ramps. Stack a 5× combo. Then dare a friend to beat your score.</p>
      {invitation.invalid&&<p className="sd-warning">That challenge link is invalid. Today's daily arena is loaded instead.</p>}
      {target!==null&&<div className="sd-invite" data-testid="sd-invite"><b>BEAT {target.toLocaleString()} POINTS</b><small>Same arena seed. Shared score is not server verified.</small></div>}
      <div className="sd-mode-tabs"><button className={/^sd[12]-d/.test(code)?'selected':''} onClick={()=>changeChallenge(dailyChallenge())} data-testid="sd-daily"><Calendar size={16}/> DAILY</button><button onClick={()=>changeChallenge(newChallenge(crypto.getRandomValues(new Uint32Array(1))[0]))} data-testid="sd-remix"><Shuffle size={16}/> NEW CHALLENGE</button></div>
      <button className="sd-primary" onClick={start} disabled={!ready} data-testid="sd-start"><Play size={18} fill="currentColor"/>{ready?'PLAY · 60 SECONDS':'LOADING 3D ARENA…'}<span>↗</span></button>
      <div className="sd-lobby-bottom"><button onClick={leave}><Flag size={15}/> RACE & EXPLORE</button><button onClick={()=>openPanel('board')}><Trophy size={15}/> MY HIGH SCORES</button></div>
      <small className="sd-hint">WASD / arrows to drive · Space to drift · Or use two-thumb controls. No sign-in.</small>
    </section></div>}
    {phase==='countdown'&&<div className="sd-countdown"><span>MAKE IT COUNT</span><strong>{countdown}</strong><small>Hold GAS. Aim for the robot ahead.</small></div>}
    {phase==='paused'&&!board&&!settings&&<div className="sd-overlay"><section className="sd-panel sd-pause-panel"><div className="sd-eyebrow">CLOCK FROZEN</div><h2>TAKE A BREATHER.</h2><p>Your score and remaining time are safe.</p><button className="sd-primary" onClick={pause} data-testid="sd-resume"><Play/> RESUME</button><button className="sd-secondary" onClick={()=>{trackEvent('challenge_abandon',{code});setPhase('lobby')}}>END RUN</button></section></div>}
    {phase==='results'&&result&&!board&&!settings&&<div className="sd-overlay"><section className="sd-panel sd-results" data-testid="sd-results">
      <div className="sd-eyebrow">{result.newBest?'NEW DEVICE BEST':'60 SECONDS. ALL YOURS.'}</div><h2>THAT WAS <em>CHAOS.</em></h2>
      <strong className="sd-result-score" data-testid="sd-result-score">{result.score.toLocaleString()}</strong>
      {target!==null&&<p className="sd-comparison">{result.score>target?'YOU BEAT THE SHARED TARGET!':result.score===target?'YOU TIED THE SHARED TARGET.':`${(target-result.score).toLocaleString()} POINTS TO BEAT YOUR FRIEND.`}</p>}
      <div className="sd-result-stats"><span><b>{result.smashes}</b>BOTS</span><span><b>{result.bestCombo}×</b>BEST COMBO</span><span><b>{result.jumps}</b>JUMPS</span></div>
      <div className="sd-result-actions">
        <button className="sd-primary" onClick={share} data-testid="sd-share"><Share2 size={17}/> CHALLENGE A FRIEND</button>
        <button className="sd-secondary" onClick={start} data-testid="sd-retry"><RotateCcw size={17}/> GO AGAIN</button>
        <button className="sd-secondary" onClick={()=>watchReplay(false)} data-testid="sd-replay"><Film size={17}/> WATCH HIGHLIGHT</button>
        <button className="sd-secondary" onClick={()=>watchReplay(true)} data-testid="sd-export"><Download size={17}/> MAKE 9:16 CLIP</button>
        <button className="sd-secondary" onClick={()=>shareMedia(card,'card')} disabled={!card} data-testid="sd-card"><Share2 size={17}/> SHARE SCORE CARD</button>
        <button className="sd-secondary" onClick={()=>openPanel('board')}><Trophy size={17}/> DEVICE LEADERBOARD</button>
      </div>
      {clip&&<div className="sd-clip-ready" data-testid="sd-clip-ready"><Check size={16}/><span>Replay ready · {(clip.size/1e6).toFixed(1)} MB</span><button onClick={()=>shareMedia(clip,'clip')} data-testid="sd-share-clip">Share clip</button><button onClick={()=>{saveBlob(clip,clip.name);trackEvent('clip_saved',{code})}} data-testid="sd-download-clip">Download</button></div>}
      {manualLink&&<input className="sd-link" value={manualLink} readOnly onFocus={e=>e.target.select()} aria-label="Challenge link"/>}
      <small className="sd-hint">{result.saved?'Saved on this device.':'Not saved: device storage is blocked.'} Local and shared scores are unverified. No global ranking.</small>
      <button className="sd-text-button" onClick={()=>setPhase('lobby')}>BACK TO CHALLENGES</button>
    </section></div>}
    {replaying&&<div className="sd-replay-strip"><div><strong>{phase==='exporting'?'CREATING VERTICAL CLIP':engineRef.current.range?.label}</strong><small>Actual gameplay · 0.65× slow motion · no microphone</small></div><button onClick={stopReplay} data-testid="sd-stop-replay"><X size={18}/> {phase==='exporting'?'CANCEL':'BACK'}</button></div>}
    {board&&<div className="sd-overlay"><section className="sd-panel sd-board-panel" role="dialog" aria-modal="true" aria-labelledby="sd-board-title">
      <div className="sd-panel-top"><h2 id="sd-board-title">DEVICE LEADERBOARD</h2><button onClick={()=>setBoard(false)} aria-label="Close leaderboard"><X/></button></div>
      <p className="sd-board-scope">This browser only · not a global leaderboard.<br/>{challengeTitle(code)}</p>
      {scores.length?<ol className="sd-scores">{scores.slice(0,10).map((entry,i)=><li key={entry.id}><span>{String(i+1).padStart(2,'0')}</span><div><b>{entry.score.toLocaleString()}</b><small>{entry.smashes} bots · {entry.bestCombo}× combo · {new Date(entry.savedAt).toLocaleDateString()}</small></div>{i===0&&<Trophy size={19}/>}</li>)}</ol>:<p className="sd-empty">No completed runs for this challenge yet. Play a full 60 seconds to set the first score.</p>}
      <details className="sd-diagnostics"><summary>Local play stats & privacy</summary><p>Optional, device-local event log. Nothing is uploaded. These are not audience-wide retention metrics.</p>
        <label><input type="checkbox" checked={consent} onChange={e=>{const yes=e.target.checked;setConsent(yes);setStatsConsent(yes)}}/> Save local play statistics</label>
        <div className="sd-stats-mini"><span>Starts <b>{stats.counts.challenge_start||0}</b></span><span>Finishes <b>{stats.counts.challenge_complete||0}</b></span><span>Share handoffs <b>{stats.counts.share_handoff||0}</b></span><span>Links copied <b>{stats.counts.link_copied||0}</b></span></div>
        <button onClick={()=>saveBlob(new Blob([JSON.stringify(localStats(),null,2)],{type:'application/json'}),'anik-local-play-stats.json')}>Export local stats</button>
        <button onClick={()=>{if(confirm('Delete the Bot Smash scores saved on this device?')){clearScores();setBoard(false);notice('Local scores deleted.')}}}>Clear device scores</button>
      </details>
    </section></div>}
    {settings&&<div className="sd-overlay"><section className="sd-panel" role="dialog" aria-modal="true" aria-labelledby="sd-settings-title"><div className="sd-panel-top"><h2 id="sd-settings-title">GALAXY SETTINGS</h2><button onClick={()=>setSettings(false)} aria-label="Close settings"><X/></button></div><p>Same driving rules in every graphics mode. Eco reduces GPU load; it does not change your score.</p><div className="sd-quality">{['auto','eco','balanced','high'].map(q=><button key={q} className={quality===q?'selected':''} onClick={()=>setQuality(q)}>{q.toUpperCase()}</button>)}</div><p>Current: {budget.label}. Daily challenges reset at 00:00 UTC. Weather is fixed by the shared seed, not your device clock.</p><p>Replays use stored movement from your run. Video export depends on browser support; a PNG score card and link are always offered.</p><button className="sd-primary" onClick={()=>setSettings(false)}>DONE <Check size={17}/></button></section></div>}
    {message&&<div className="sd-message" role="status">{message}</div>}
  </div>
}
