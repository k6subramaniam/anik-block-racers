/** Room discovery via Trystero's public Nostr relays; game packets use WebRTC.
 * A high-entropy URL capability is the room secret. Two humans maximum.
 * Public-relay and NAT connectivity are best effort, so retain manual fallback.
 */
import {P2P_MAX_MESSAGE,validRacePacket} from './p2p.js'
import {ROOM_APP_ID,validRoomId} from './rooms.js'

export async function createAutoRoom(role,secret,onPacket,onStatus,options={}){
 if(!['host','guest'].includes(role))throw new RangeError('Invalid role')
 if(!validRoomId(secret))throw new RangeError('Invalid private race invitation')
 if(typeof onPacket!=='function'||typeof onStatus!=='function')throw new TypeError('Room callbacks are required')
 const joinRoom=options.joinRoom||(await import('trystero')).joinRoom
 if(typeof joinRoom!=='function')throw new Error('Automatic multiplayer discovery is unavailable')
 let controller=null
 const room=joinRoom({appId:ROOM_APP_ID,password:secret},secret,{onJoinError:()=>{
  if(controller&&!controller.closed&&!controller.connected)onStatus('connection-error')
 }})
 const action=room.makeAction('race'),hello=room.makeAction('hello')
 controller={role,roomId:secret,connected:false,closed:false,peerId:null,remoteInput:null,
  send(packet){
   if(this.closed||!this.connected||!this.peerId||!validRacePacket(packet))return false
   let size;try{size=JSON.stringify(packet).length}catch{return false}
   if(size>P2P_MAX_MESSAGE)return false
   try{Promise.resolve(action.send(packet,{target:this.peerId})).catch(()=>{});return true}catch{return false}
  },
  close(){
   if(this.closed)return
   this.closed=true;this.connected=false;this.peerId=null
   room.onPeerJoin=null;room.onPeerLeave=null;action.onMessage=null;hello.onMessage=null
   try{Promise.resolve(room.leave()).catch(()=>{})}catch{}
   onStatus('closed')
  },
 }
 function announce(peerId,kind=role){
  if(controller.closed)return
  try{Promise.resolve(hello.send({role:kind,v:1},{target:peerId})).catch(()=>{})}catch{}
 }
 room.onPeerJoin=peerId=>{
  if(controller.closed)return
  if(role==='host'&&controller.peerId&&controller.peerId!==peerId)announce(peerId,'full')
  else announce(peerId)
  if(!controller.connected)onStatus('peer-found')
 }
 hello.onMessage=(value,{peerId}={})=>{
  if(controller.closed||typeof peerId!=='string'||!value||value.v!==1)return
  if(value.role==='full'&&role==='guest'&&!controller.connected){onStatus('room-full');return}
  // A guest only becomes a racer when explicitly accepted by the host.
  if(role==='guest'&&value.role==='host'){announce(peerId,'guest');return}
  if(role==='guest'&&value.role==='accepted'){
   if(controller.peerId&&controller.peerId!==peerId)return
   if(!controller.connected){controller.peerId=peerId;controller.connected=true;onStatus('connected')}
   return
  }
  if(role!=='host'||value.role!=='guest')return
  if(controller.peerId&&controller.peerId!==peerId){announce(peerId,'full');return}
  if(!controller.connected){controller.peerId=peerId;controller.connected=true;onStatus('connected')}
  announce(peerId,'accepted')
 }
 room.onPeerLeave=peerId=>{
  if(controller.closed||controller.peerId!==peerId)return
  controller.peerId=null;controller.connected=false;controller.remoteInput=null
  onStatus('disconnected')
 }
 action.onMessage=(packet,{peerId}={})=>{
  if(controller.closed||!controller.connected||peerId!==controller.peerId||!validRacePacket(packet))return
  try{if(JSON.stringify(packet).length>P2P_MAX_MESSAGE)return}catch{return}
  onPacket(packet)
 }
 onStatus('waiting')
 return controller
}
