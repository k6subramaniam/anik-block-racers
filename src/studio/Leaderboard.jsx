import React from 'react'
import {readTimes} from './leaderboards.js'
const fmt=t=>`${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}.${String(Math.round(t/6)%10)}`
export default function Leaderboard({onClose}){
 const rows=readTimes().sort((a,b)=>a.ticks-b.ticks)
 return <div className="studio-overlay"><section className="studio-panel studio-leaderboard" role="dialog" aria-modal="true" aria-label="Local race results">
  <div className="studio-top"><div><small>PERSONAL BEST TIMES</small><h2>RACE LEADERBOARD</h2></div><button onClick={onClose} aria-label="Close standings">✕</button></div>
  <p>Times saved on <b>this browser only</b>, not a global or server-verified leaderboard. Compare the same track, lap count and weather when racing friends.</p>
  {rows.length?<div className="studio-times">{rows.slice(0,20).map((r,i)=><div key={r.id}><span>{i+1}.</span><strong>{fmt(r.ticks)}</strong><span>{r.track.toUpperCase()} · {r.laps} laps · {r.weather}</span><b>{r.stunts} stunt pts</b></div>)}</div>:<p>No finished Battle Race times yet. Complete a race to set the first entry.</p>}
  <button className="studio-primary" onClick={onClose}>BACK TO RACING</button>
 </section></div>
}
