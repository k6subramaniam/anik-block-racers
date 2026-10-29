import React,{useEffect,useRef,useState} from 'react'
import {replayRange,sampleRaceReplay} from './replay.js'
import {battleTrack,atDistance} from '../battle/tracks.js'
export default function ReplayViewer({replay,trackId,onClose}){
 const range=replayRange(replay),track=battleTrack(trackId),canvasRef=useRef(),[playing,setPlaying]=useState(true)
 useEffect(()=>{
  if(!range)return
  let raf,old=performance.now(),t=range.start
  const canvas=canvasRef.current,ctx=canvas.getContext('2d')
  const xs=track.path.map(p=>p.x),zs=track.path.map(p=>p.z),minX=Math.min(...xs)-17,maxX=Math.max(...xs)+17,minZ=Math.min(...zs)-17,maxZ=Math.max(...zs)+17
  const x=p=>(p-minX)/(maxX-minX)*canvas.width,z=p=>(p-minZ)/(maxZ-minZ)*canvas.height
  const draw=now=>{
   const dt=Math.min(.08,(now-old)/1000);old=now
   if(playing)t=t+dt*60*.6>range.end?range.start:t+dt*60*.6
   ctx.fillStyle='#112b37';ctx.fillRect(0,0,canvas.width,canvas.height)
   ctx.strokeStyle='#59737b';ctx.lineWidth=track.width/(maxX-minX)*canvas.width+3;ctx.lineJoin='round';ctx.beginPath()
   track.path.forEach((p,i)=>i?ctx.lineTo(x(p.x),z(p.z)):ctx.moveTo(x(p.x),z(p.z)));ctx.closePath();ctx.stroke()
   ctx.strokeStyle='#98cbbb';ctx.lineWidth=Math.max(6,track.width/(maxX-minX)*canvas.width);ctx.stroke()
   const snap=sampleRaceReplay(replay,t)
   for(const a of snap?.actors||[]){
    ctx.save();ctx.translate(x(a.x),z(a.z));ctx.rotate(-a.yaw)
    ctx.fillStyle=a.hp>0?a.color:'#ffffff';ctx.fillRect(-6,-9,12,18)
    ctx.fillStyle='#1a3039';ctx.fillRect(-5,-4,10,4);ctx.restore()
   }
   ctx.fillStyle='#f1ffce';ctx.font='bold 20px system-ui';ctx.fillText(`${range.label}  ·  ${(t/60).toFixed(1)}s`,18,30)
   raf=requestAnimationFrame(draw)
  }
  raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf)
 },[replay,range?.start,range?.end,track,playing])
 return <div className="studio-overlay"><section className="studio-panel studio-replay" role="dialog" aria-modal="true" aria-label="Race collision replay"><div className="studio-top"><div><small>RECORDED FROM YOUR ACTUAL RACE</small><h2>SLOW-MOTION REPLAY</h2></div><button onClick={onClose}>✕</button></div>
  <p>A replay of the real kart positions recorded during this session at 12 frames per second. The camera is a top-down tactical view; no video is uploaded or shared.</p>
  <canvas ref={canvasRef} width={720} height={400} className="studio-replay-canvas"/>
  <div className="studio-buttons"><button className="studio-primary" onClick={()=>setPlaying(v=>!v)}>{playing?'PAUSE REPLAY':'PLAY REPLAY'}</button><button onClick={onClose}>BACK TO RACE</button></div>
 </section></div>
}
