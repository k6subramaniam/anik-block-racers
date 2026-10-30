/** Two-device WebRTC game data channel. Browser-native, no signaling provider.
 * Manual offer/answer pairing is intentional: no hosted service, account or log.
 * A STUN-only connection may fail on restrictive mobile networks without TURN.
 */
export const P2P_PROTOCOL=1
export const P2P_MAX_MESSAGE=120000
const STUN=[{urls:'stun:stun.l.google.com:19302'}]
export function sanitizeInput(input){
 const o={};for(const key of ['forward','backward','left','right','drift','bomb','mine','item'])o[key]=input?.[key]===true
 if(Number.isFinite(input?.steer))o.steer=Math.max(-1,Math.min(1,input.steer))
 return o
}
export function validRacePacket(data){
 if(!data||typeof data!=='object'||data.v!==P2P_PROTOCOL)return false
 if(data.type==='input')return data.input&&typeof data.input==='object'
 if(data.type==='start')return typeof data.track==='string'&&data.track.length<=24&&Number.isInteger(data.laps)&&data.laps>=1&&data.laps<=10&&typeof data.weather==='string'&&data.weather.length<=20&&(!data.trackcode||data.trackcode.length<3000)
 if(data.type==='state'){
  const s=data.state
  return Number.isInteger(data.tick)&&data.tick>=0&&data.tick<1_000_000&&s&&Array.isArray(s.actors)&&s.actors.length===4&&
   s.actors.every(a=>a&&typeof a.id==='string'&&a.id.length<=24&&
     ['x','z','yaw','hp'].every(k=>Number.isFinite(a[k])&&Math.abs(a[k])<2000))&&
   Array.isArray(s.hazards)&&s.hazards.length<=40&&Array.isArray(s.powerups)&&s.powerups.length<=12&&
   Array.isArray(s.explosions)&&s.explosions.length<=24&&s.stunts&&Array.isArray(s.stunts.props)&&s.stunts.props.length<=20
 }
 if(data.type==='ping')return true
 return false
}
function bytesToText(payload){
 const json=JSON.stringify(payload),bytes=new TextEncoder().encode(json)
 if(bytes.length>12000)throw new RangeError('Pairing code exceeds the safe length limit')
 let text='';for(const c of bytes)text+=String.fromCharCode(c)
 return btoa(text).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
}
function textToBytes(code){
 if(typeof code!=='string'||code.length>20000||!/^[-_A-Za-z0-9]+$/.test(code))throw new Error('Invalid pairing code')
 const decoded=atob(code.replaceAll('-','+').replaceAll('_','/'))
 const bytes=Uint8Array.from(decoded,x=>x.charCodeAt(0))
 if(bytes.length>12000)throw new RangeError('Pairing code is too large')
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export function encodeSignal(description){
 if(!description||!['offer','answer'].includes(description.type)||typeof description.sdp!=='string'||description.sdp.length>11000)throw new Error('Unsupported pairing signal')
 return 'anik1_'+bytesToText({v:1,type:description.type,sdp:description.sdp})
}
export function decodeSignal(code,expect){
 if(typeof code!=='string'||!code.startsWith('anik1_'))throw new Error('Paste a valid ANIK pairing code')
 const data=textToBytes(code.slice(6))
 if(data.v!==1||data.type!==expect||typeof data.sdp!=='string'||data.sdp.length>11000||!data.sdp.includes('v=0'))throw new Error(`Expected an ANIK ${expect} code`)
 return {type:data.type,sdp:data.sdp}
}
export function waitForIce(peer,timeout=12000){
 return new Promise(resolve=>{
  if(peer.iceGatheringState==='complete')return resolve()
  let done=false
  const finish=()=>{if(done)return;done=true;clearTimeout(id);peer.removeEventListener('icegatheringstatechange',changed);resolve()}
  const changed=()=>{if(peer.iceGatheringState==='complete')finish()}
  const id=setTimeout(finish,timeout)
  peer.addEventListener('icegatheringstatechange',changed)
 })
}
export function createP2P(role,onMessage,onStatus){
 if(!['host','guest'].includes(role))throw new RangeError('Role must be host or guest')
 if(typeof RTCPeerConnection==='undefined')throw new Error('WebRTC is unavailable in this browser')
 const peer=new RTCPeerConnection({iceServers:STUN}),controller={role,peer,channel:null,connected:false,closed:false,
  send(message){if(!validRacePacket(message)||this.channel?.readyState!=='open')return false
   const text=JSON.stringify(message);if(text.length>P2P_MAX_MESSAGE)return false
   try{this.channel.send(text);return true}catch{return false}
  },
  close(){this.closed=true;try{this.channel?.close()}catch{};try{peer.close()}catch{};onStatus('closed')},
  async offer(){if(role!=='host')throw new Error('Only the host creates invitations')
   bind(peer.createDataChannel('anik-race',{ordered:true}));await peer.setLocalDescription(await peer.createOffer());await waitForIce(peer)
   return encodeSignal(peer.localDescription)
  },
  async answer(offer){if(role!=='guest')throw new Error('Only guests accept invitations')
   await peer.setRemoteDescription(decodeSignal(offer,'offer'))
   await peer.setLocalDescription(await peer.createAnswer());await waitForIce(peer)
   return encodeSignal(peer.localDescription)
  },
  async accept(answer){if(role!=='host')throw new Error('Only hosts accept answer codes')
   await peer.setRemoteDescription(decodeSignal(answer,'answer'))
  },
 }
 function bind(channel){
  controller.channel=channel
  channel.onopen=()=>{controller.connected=true;onStatus('connected')}
  channel.onclose=()=>{controller.connected=false;if(!controller.closed)onStatus('disconnected')}
  channel.onerror=()=>{if(!controller.closed)onStatus('connection-error')}
  channel.onmessage=event=>{
   if(typeof event.data!=='string'||event.data.length>P2P_MAX_MESSAGE)return
   try{const data=JSON.parse(event.data);if(validRacePacket(data))onMessage(data)}catch{/* Drop malformed packet. */}
  }
 }
 if(role==='guest')peer.ondatachannel=e=>bind(e.channel)
 peer.onconnectionstatechange=()=>{if(peer.connectionState==='failed'||peer.connectionState==='disconnected')onStatus(peer.connectionState)}
 return controller
}
