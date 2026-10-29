import React,{useEffect,useRef,useState} from 'react'
import {createAutoRoom} from './roomTransport.js'
import {createInviteUrl,inviteFromUrl,newRoomId,validRoomId} from './rooms.js'
import ManualMultiplayer from './ManualMultiplayer.jsx'

const statusLabel={
 waiting:'Room ready — share your link. Waiting for your friend to join…',
 'peer-found':'Friend found — securing the game connection…',
 connected:'Friend connected! Return to the lobby and start racing.',
 disconnected:'Friend disconnected. Keep this room open for them to reconnect.',
 'connection-error':'Connection failed. Try another network or use advanced pairing below.',
 'room-full':'This room already has two racers. Ask for another invitation.',
 closed:'The room has been closed.',
}
export default function Multiplayer({networkRef,onConnected,onPacket,onClose,onReady,onLeave,autoInvite}){
 const active=networkRef.current?.roomId&&!networkRef.current.closed?networkRef.current:null
 const [role,setRole]=useState(active?.role||''),[secret,setSecret]=useState(active?.roomId||''),[stage,setStage]=useState(active?'room':autoInvite?'connecting':'choose')
 const [status,setStatus]=useState(active?.connected?'connected':active?'waiting':''),[manual,setManual]=useState(false),[paste,setPaste]=useState(''),[busy,setBusy]=useState(false)
 const controller=useRef(active),started=useRef(false),cancelled=useRef(false),callbacks=useRef({onConnected,onPacket,onReady,onLeave})
 callbacks.current={onConnected,onPacket,onReady,onLeave}
 useEffect(()=>()=>{cancelled.current=true},[])
 const update=s=>{
  if(!cancelled.current)setStatus(s)
  if(s==='connected')callbacks.current.onConnected(controller.current)
  if(s==='disconnected')callbacks.current.onLeave?.('disconnected')
 }
 const open=async(nextRole,code)=>{
  if(busy||controller.current&&!controller.current.closed)return
  setBusy(true);setRole(nextRole);setSecret(code);setStage('connecting');setStatus('Opening your private race room…')
  try{
   const conn=await createAutoRoom(nextRole,code,packet=>callbacks.current.onPacket(packet),update)
   controller.current=conn;networkRef.current=conn
   callbacks.current.onReady?.(conn)
   if(cancelled.current){/* The lobby owns this connection once created. */}
   else{setStage('room');setStatus(conn.connected?'connected':'waiting')}
  }catch(error){if(!cancelled.current){setStatus(error.message||'Unable to create the room');setStage('choose')}}
  finally{if(!cancelled.current)setBusy(false)}
 }
 useEffect(()=>{
  if(started.current||!autoInvite||!validRoomId(autoInvite)||controller.current)return
  started.current=true;void open('guest',autoInvite)
 // Start auto-joining only once for a freshly opened invitation.
 },[])
 const create=()=>{try{void open('host',newRoomId())}catch(error){setStatus(error.message)}}
 const link=secret&&validRoomId(secret)?createInviteUrl(location.href,secret):''
 const copy=async()=>{
  try{await navigator.clipboard.writeText(link);setStatus('Invitation copied. Send it through WhatsApp, Messages, or email.')}
  catch{setStatus('Select the invitation link and copy it manually.')}
 }
 const share=async()=>{
  if(!link)return
  if(navigator.share){
   try{await navigator.share({title:'Race me in ANIK Block Racers',text:'Join my private 2-player race — just tap the link!',url:link});setStatus('Invitation shared. Waiting for your friend.');return}
   catch(error){if(error?.name==='AbortError')return}
  }
  await copy()
 }
 const joinPaste=()=>{
  const code=inviteFromUrl(paste.trim())
  if(!code){setStatus('Paste the complete ANIK Battle Race invitation link.');return}
  try{history.replaceState({},'',createInviteUrl(location.href,code))}catch{}
  void open('guest',code)
 }
 const leave=()=>{
  controller.current?.close();if(networkRef.current===controller.current)networkRef.current=null
  controller.current=null;setRole('');setSecret('');setStage('choose');setStatus('Room closed.');callbacks.current.onLeave?.('left')
  if(location.hash.startsWith('#race='))try{const u=new URL(location.href);u.hash='';history.replaceState({},'',u)}catch{}
 }
 if(manual)return <ManualMultiplayer networkRef={networkRef} onConnected={onConnected} onPacket={onPacket} onClose={()=>setManual(false)}/>
 return <div className="studio-overlay"><section className="studio-panel studio-multiplayer" role="dialog" aria-modal="true" aria-label="Play with friends">
  <div className="studio-top"><div><small>ANIK FRIEND INVITES · NO SIGN-IN</small><h2>PLAY TOGETHER IN ONE TAP</h2></div><button onClick={onClose} aria-label="Close multiplayer">✕</button></div>
  <p><b>No more pairing codes.</b> Create a room, send a private link, and your friend joins automatically. The host chooses the racetrack, weather and laps. Currently supports <b>one friend (2 human racers)</b> plus AI opponents.</p>
  {stage==='choose'&&<>
    <div className="studio-room-actions"><button className="studio-primary" data-testid="studio-create-room" onClick={create} disabled={busy}>＋ CREATE RACE ROOM</button><button data-testid="studio-join-room" onClick={()=>{setStage('paste');setStatus('')}}>JOIN WITH AN INVITE</button></div>
    <small>On your Samsung, share directly to WhatsApp or Messages. Only people with your private invitation can attempt to join.</small>
  </>}
  {stage==='paste'&&<div className="studio-room-paste"><label htmlFor="studio-join-link">FRIEND'S GAME LINK</label><input type="text" id="studio-join-link" data-testid="studio-join-link" value={paste} onChange={e=>setPaste(e.target.value.slice(0,2048))} placeholder="https://k6subramaniam.github.io/anik-block-racers/?view=battle#race=…"/><div className="studio-buttons"><button className="studio-primary" onClick={joinPaste} disabled={!paste.trim()}>JOIN RACE</button><button onClick={()=>setStage('choose')}>BACK</button></div></div>}
  {stage==='connecting'&&<div className="studio-room-wait"><div className="studio-pulse" aria-hidden="true">◎</div><strong>CONNECTING TO PRIVATE RACE…</strong><small>No invitation codes or accounts needed.</small></div>}
  {stage==='room'&&<div className="studio-room-card" data-testid="studio-room-lobby">
   <div className="studio-room-ready"><span className={status==='connected'?'studio-online':'studio-searching'} aria-hidden="true">●</span><strong>{status==='connected'?'2 / 2 RACERS CONNECTED':status==='room-full'?'ROOM IS FULL':role==='host'?'ROOM READY · 1 / 2 RACERS':'FINDING YOUR FRIEND…'}</strong></div>
   {role==='host'?<>
    <p>1. Share this invitation link with your friend. 2. Once they connect, return to the lobby and tap <b>Start Battle Race</b>.</p>
    <label htmlFor="studio-room-url">INVITATION LINK</label>
    <input id="studio-room-url" type="text" data-testid="studio-room-link" value={link} readOnly onFocus={e=>e.target.select()}/>
    <div className="studio-room-actions"><button className="studio-primary" data-testid="studio-share-room" onClick={share}>↗ SHARE INVITE</button><button data-testid="studio-copy-room" onClick={copy}>COPY LINK</button></div>
   </>:<p>You're joining your friend's private race. Once connected, the host starts the match and selects the track, laps, and weather automatically.</p>}
   {status==='connected'&&<button className="studio-primary studio-room-start" onClick={onClose}>{role==='host'?'BACK TO LOBBY · START THE RACE':'BACK TO LOBBY · WAIT FOR HOST'}</button>}
   <button className="studio-room-leave" data-testid="studio-leave-room" onClick={leave}>LEAVE PRIVATE ROOM</button>
  </div>}
  <div className="studio-status" role="status" data-testid="studio-room-status">{statusLabel[status]||status||'Choose how to race together.'}</div>
  <details className="studio-room-help"><summary>Having trouble connecting?</summary><p>Both devices need an internet connection and compatible WebRTC networking. Public discovery relays may be temporarily unavailable, and some mobile networks require a TURN relay. You can try another Wi-Fi network or the manual backup method.</p><button data-testid="studio-manual-fallback" onClick={()=>{if(controller.current)leave();setManual(true)}}>ADVANCED · MANUAL PAIRING</button></details>
  <small>Rooms are private-link access, not password-protected user accounts. Do not forward invitations publicly. Game traffic is peer-to-peer encrypted; a dedicated matchmaking service is not included.</small>
 </section></div>
}
