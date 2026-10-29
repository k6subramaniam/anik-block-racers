import React,{useEffect,useState} from 'react'
import {rankingConfig,getVerifiedTimes} from './global.js'
import {readTimes} from './leaderboards.js'
const fmt=t=>`${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}.${String(Math.round(t/6)%10)}`
export default function Leaderboard({onClose}){
 const rows=readTimes().sort((a,b)=>a.ticks-b.ticks)
 const [globalRows,setGlobalRows]=useState(null),[remoteStatus,setRemoteStatus]=useState('')
 useEffect(()=>{if(!rankingConfig()){setRemoteStatus('Not connected — a dedicated game ranking backend is required.');return}
  let closed=false;getVerifiedTimes().then(r=>{if(!closed){setGlobalRows(r);setRemoteStatus('Server-verified runs')}}).catch(e=>{if(!closed)setRemoteStatus(e.message)});return()=>{closed=true}
 },[])
 return <div className="studio-overlay"><section className="studio-panel studio-leaderboard" role="dialog" aria-modal="true" aria-label="Local race results">
  <div className="studio-top"><div><small>PERSONAL BEST TIMES</small><h2>RACE LEADERBOARD</h2></div><button onClick={onClose} aria-label="Close standings">✕</button></div>
  <p>Times saved on <b>this browser only</b>, not a global or server-verified leaderboard. Compare the same track, lap count and weather when racing friends.</p>
  {rows.length?<div className="studio-times">{rows.slice(0,20).map((r,i)=><div key={r.id}><span>{i+1}.</span><strong>{fmt(r.ticks)}</strong><span>{r.track.toUpperCase()} · {r.laps} laps · {r.weather}</span><b>{r.stunts} stunt pts</b></div>)}</div>:<p>No finished Battle Race times yet. Complete a race to set the first entry.</p>}
  <h3>GLOBAL VERIFIED RANKINGS</h3><div className="studio-status">{remoteStatus||'Checking the dedicated ranking backend…'}</div>
  {globalRows?.length>0&&<div className="studio-times">{globalRows.map((r,i)=><div key={i}><span>{i+1}.</span><strong>{fmt(r.ticks)}</strong><span>{r.track.toUpperCase()} · {r.laps} laps · {r.weather}</span><b>{r.stunt_points} stunt pts</b></div>)}</div>}
  <p>Unverified device scores never enter the global list. Browser-only multiplayer and custom tracks also stay separate from ranked verification.</p>
  <button className="studio-primary" onClick={onClose}>BACK TO RACING</button>
 </section></div>
}
