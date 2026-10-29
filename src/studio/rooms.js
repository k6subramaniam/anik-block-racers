/** Private two-player room invitations. The secret stays in the URL fragment,
 * which browsers do not send with ordinary HTTP requests to GitHub Pages.
 * Anyone with the link can join; this is capability access, not identity auth.
 */
export const ROOM_FORMAT = 1
export const ROOM_LENGTH = 32
export const ROOM_APP_ID = 'ca.github.k6subramaniam.anik-block-racers.rooms.v1'
export function validRoomId(value){return typeof value==='string'&&/^[0-9a-f]{32}$/.test(value)}
export function newRoomId(cryptoSource=globalThis.crypto){
  if(!cryptoSource?.getRandomValues)throw new Error('Secure random invitations require HTTPS or localhost.')
  const bytes=cryptoSource.getRandomValues(new Uint8Array(16))
  if(bytes.length!==16)throw new Error('Unable to generate a secure room invitation.')
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')
}
export function inviteFromHash(hash){
  if(typeof hash!=='string'||hash.length>200)return null
  const params=new URLSearchParams(hash.replace(/^#/,''))
  const value=params.get('race')
  return params.getAll('race').length===1&&validRoomId(value)?value:null
}
export function inviteFromUrl(input){
  if(typeof input!=='string'||input.length>2048)return null
  try{const url=new URL(input);return ['https:','http:'].includes(url.protocol)&&new URLSearchParams(url.search).get('view')==='battle'?inviteFromHash(url.hash):null}catch{return null}
}
export function createInviteUrl(base,roomId){
  if(!validRoomId(roomId))throw new RangeError('Invalid private race invitation')
  const url=new URL(base)
  if(!['https:','http:'].includes(url.protocol))throw new RangeError('The game needs an HTTP(S) address')
  url.search='';url.searchParams.set('view','battle');url.hash=`race=${roomId}`
  return url.href
}
export function clearInviteHash(current,replace){
  const url=new URL(current);if(inviteFromHash(url.hash)){
    url.hash='';replace(url.href)
  }
}
