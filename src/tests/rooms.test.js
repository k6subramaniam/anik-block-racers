import test from 'node:test'
import assert from 'node:assert/strict'
import {ROOM_APP_ID,newRoomId,validRoomId,inviteFromHash,inviteFromUrl,createInviteUrl,clearInviteHash} from '../studio/rooms.js'
import {createAutoRoom} from '../studio/roomTransport.js'
const token='ea984b34dbe802b7c23b369d83208a42'

function fakeSignaling(){
 const members=new Map();let counter=0
 const joinRoom=(config,id)=>{
  assert.equal(config.appId,ROOM_APP_ID);assert.equal(config.password,id)
  const peers=members.get(id)||[],self={id:`peer-${++counter}`,actions:new Map(),onPeerJoin:null,onPeerLeave:null,left:false,
   makeAction(name){const action={onMessage:null,send(message,{target}={}){
     for(const peer of peers){if(peer.left||peer===self||target&&peer.id!==target)continue
       queueMicrotask(()=>peer.actions.get(name)?.onMessage?.(message,{peerId:self.id}))
     }
     return Promise.resolve()
    }};self.actions.set(name,action);return action},
   leave(){if(self.left)return Promise.resolve();self.left=true;for(const p of peers)if(p!==self&&!p.left)queueMicrotask(()=>p.onPeerLeave?.(self.id));return Promise.resolve()}
  }
  peers.push(self);members.set(id,peers)
  queueMicrotask(()=>{for(const p of peers)if(p!==self&&!p.left){p.onPeerJoin?.(self.id);self.onPeerJoin?.(p.id)}})
  return self
 }
 return joinRoom
}
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>queueMicrotask(resolve))}

test('secure 128-bit room IDs require crypto entropy and reject weak invitations',()=>{
 const value=newRoomId({getRandomValues(arr){assert.equal(arr.length,16);arr.set([234,152,75,52,219,232,2,183,194,59,54,157,131,32,138,66]);return arr}})
 assert.equal(value,token)
 for(const invalid of ['bad','f'.repeat(31),'F'.repeat(32),'f'.repeat(33),'../../../admin',''])assert.equal(validRoomId(invalid),false)
 assert.throws(()=>newRoomId({}),/Secure random/)
})
test('friend link preserves GitHub Pages path and hides the secret in the fragment',()=>{
 const url=createInviteUrl('https://k6subramaniam.github.io/anik-block-racers/?view=world&score=400',token)
 assert.equal(url,`https://k6subramaniam.github.io/anik-block-racers/?view=battle#race=${token}`)
 assert.equal(inviteFromUrl(url),token)
 assert.equal(inviteFromHash(`#race=${token}`),token)
 assert.equal(inviteFromUrl(`https://other.example.com/?view=world#race=${token}`),null)
 assert.equal(inviteFromHash('#race='+token+'&race='+token),null)
 assert.equal(inviteFromUrl('javascript:alert(1)'),null)
 assert.throws(()=>createInviteUrl('file:///tmp/game.html',token))
 assert.throws(()=>createInviteUrl('https://example.com','bad'))
 let updated='';clearInviteHash(url,u=>{updated=u});assert.equal(updated,'https://k6subramaniam.github.io/anik-block-racers/?view=battle')
})
test('host and guest pair without SDP copy-paste; both send valid race packets',async()=>{
 const joinRoom=fakeSignaling(),hostStatuses=[],guestStatuses=[],hostPackets=[],guestPackets=[]
 const host=await createAutoRoom('host',token,p=>hostPackets.push(p),s=>hostStatuses.push(s),{joinRoom})
 const guest=await createAutoRoom('guest',token,p=>guestPackets.push(p),s=>guestStatuses.push(s),{joinRoom})
 await flush()
 assert.equal(host.connected,true);assert.equal(guest.connected,true)
 assert.equal(host.role,'host');assert.equal(guest.role,'guest')
 assert.ok(hostStatuses.includes('connected'));assert.ok(guestStatuses.includes('connected'))
 assert.equal(host.send({v:1,type:'start',track:'blast',laps:2,weather:'dynamic'}),true)
 assert.equal(guest.send({v:1,type:'input',input:{forward:true}}),true)
 assert.equal(host.send({v:1,type:'state',state:{actors:[]}}),false)
 await flush()
 assert.equal(guestPackets[0].type,'start');assert.equal(hostPackets[0].type,'input')
 guest.close();await flush()
 assert.equal(host.connected,false);assert.ok(hostStatuses.includes('disconnected'))
 assert.equal(host.send({v:1,type:'ping'}),false)
 host.close()
})
test('rooms ignore a third device and can reject a link used by too many guests',async()=>{
 const joinRoom=fakeSignaling(),received=[];const s1=[],s2=[],s3=[]
 const host=await createAutoRoom('host',token,p=>received.push(p),s=>s1.push(s),{joinRoom})
 const guest=await createAutoRoom('guest',token,()=>{},s=>s2.push(s),{joinRoom})
 await flush()
 const other=await createAutoRoom('guest',token,()=>{},s=>s3.push(s),{joinRoom})
 await flush()
 assert.equal(host.connected,true);assert.equal(host.peerId,'peer-2') // host remains paired with its first guest
 assert.equal(other.connected,false);assert.ok(s3.includes('room-full'))
 assert.equal(host.send({v:1,type:'ping'}),true)
 host.close();guest.close();other.close()
})
test('same rooms with different secrets cannot discover each other',async()=>{
 const joinRoom=fakeSignaling(),h=[],g=[]
 const host=await createAutoRoom('host',token,()=>{},s=>h.push(s),{joinRoom})
 const guest=await createAutoRoom('guest','a'.repeat(32),()=>{},s=>g.push(s),{joinRoom})
 await flush();assert.equal(host.connected,false);assert.equal(guest.connected,false)
 host.close();guest.close()
})
