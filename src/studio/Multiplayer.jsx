import React,{useEffect,useRef,useState} from 'react'
import {createP2P} from './p2p.js'
export default function Multiplayer({networkRef,onConnected,onPacket,onClose}){
 const [role,setRole]=useState(''),[step,setStep]=useState('choose'),[signal,setSignal]=useState(''),[incoming,setIncoming]=useState(''),[status,setStatus]=useState('')
 const controller=useRef(null)
 useEffect(()=>()=>{if(!controller.current?.connected)controller.current?.close()},[])
 const changed=s=>{setStatus(s);if(s==='connected')onConnected(controller.current);if(['disconnected','failed','connection-error'].includes(s))onPacket({type:'disconnect',v:1})}
 const init=async r=>{
  controller.current?.close();controller.current=null;setRole(r);setStatus('Preparing browser connection…');setSignal('');setIncoming('')
  try{const conn=createP2P(r,onPacket,changed);controller.current=conn;networkRef.current=conn
    if(r==='host'){setSignal(await conn.offer());setStep('host-answer');setStatus('Invite ready. Send the offer code to your friend.')}
    else{setStep('guest-offer');setStatus('Paste the host invitation to create your reply.')}
  }catch(e){setStatus(e.message);setStep('choose')}
 }
 const continuePair=async()=>{
  try{
   if(role==='host'){await controller.current.accept(incoming.trim());setStatus('Answer accepted. Checking peer connectivity…');setStep('connecting')}
   else{setSignal(await controller.current.answer(incoming.trim()));setStatus('Reply ready. Send it back to the host.');setStep('guest-reply')}
  }catch(e){setStatus(e.message)}
 }
 const copy=async()=>{try{await navigator.clipboard.writeText(signal);setStatus('Pairing code copied. Send it privately to your friend.')}catch{setStatus('Select and manually copy the code below.')}}
 return <div className="studio-overlay"><section className="studio-panel studio-multiplayer" role="dialog" aria-modal="true" aria-label="Private multiplayer pairing">
  <div className="studio-top"><div><small>ANIK PRIVATE RACING</small><h2>2-PLAYER LIVE RACE</h2></div><button onClick={onClose} aria-label="Close multiplayer">✕</button></div>
  <p>Race on two devices using a direct WebRTC connection. <b>The host controls the physics, collisions, weather and lap count.</b> Neither racer needs an account.</p>
  <div className="studio-steps"><span>1. Host creates an invite</span><span>2. Guest sends a reply</span><span>3. Host accepts reply</span><span>4. Host starts the race</span></div>
  {step==='choose'&&<div className="studio-buttons"><button className="studio-primary" onClick={()=>init('host')}>CREATE PRIVATE RACE</button><button onClick={()=>init('guest')}>JOIN A FRIEND</button></div>}
  {signal&&<div className="studio-signal"><label>{role==='host'?'INVITE CODE (SEND TO YOUR FRIEND)':'REPLY CODE (SEND TO HOST)'}<textarea data-testid="studio-offer-code" readOnly rows={3} value={signal} onFocus={e=>e.target.select()}/></label><button onClick={copy}>COPY CODE</button></div>}
  {['host-answer','guest-offer'].includes(step)&&<div className="studio-signal"><label>{role==='host'?'PASTE FRIEND REPLY CODE':'PASTE HOST INVITATION CODE'}<textarea data-testid="studio-pair-input" rows={3} value={incoming} onChange={e=>setIncoming(e.target.value)} placeholder="anik1_…"/></label><button className="studio-primary" onClick={continuePair} disabled={!incoming.trim()}>{role==='host'?'ACCEPT REPLY':'CREATE REPLY'}</button></div>}
  {step==='guest-reply'&&<p>After copying the reply, your host pastes it into their game. This window can be closed when the game reports Connected.</p>}
  {step==='connecting'&&<p>Peer negotiation in progress. The connection requires compatible internet routes.</p>}
  <div className="studio-status" role="status" data-testid="studio-p2p-status">{status||'Ready to connect'}</div>
  <small>A direct peer connection is not a publicly discoverable room. Pairing uses copy/paste; STUN-only networking may fail behind restrictive cellular NATs or firewalls. It has no chat, voice, or global rankings. Don't send pairing codes to people you don't trust.</small>
 </section></div>
}
