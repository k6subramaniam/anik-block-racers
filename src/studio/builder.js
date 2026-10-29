/** v4 original voxel track creator. Safe bounded share codes, no server needed. */
export const BLUEPRINT_VERSION=1
export const BLUEPRINT_STORAGE='anik-builder-tracks-v1'
export const MIN_NODES=6,MAX_NODES=20
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n))
export function newBlueprint(){
  return {v:1,name:'MY VOXEL CIRCUIT',theme:'forest',width:13,points:Array.from({length:10},(_,i)=>{
    const theta=-Math.PI/2+i*Math.PI*2/10
    return [Math.round(Math.cos(theta)*78),Math.round(Math.sin(theta)*62),0]
  })}
}
export function validateBlueprint(raw){
  if(!raw||raw.v!==1||!Array.isArray(raw.points)||raw.points.length<MIN_NODES||raw.points.length>MAX_NODES)return null
  const points=raw.points.map(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)?p.map((v,i)=>Math.round(clamp(v,i===2?0:-140,i===2?36:140))):null)
  if(points.some(p=>!p))return null
  if(points.some((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1])<12))return null
  const signedArea=points.reduce((a,p,i)=>a+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0)/2
  if(Math.abs(signedArea)<3000)return null
  const name=String(raw.name||'MY VOXEL CIRCUIT').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,28)||'MY VOXEL CIRCUIT'
  const theme=['forest','desert','snow','neon'].includes(raw.theme)?raw.theme:'forest'
  return {v:1,name,theme,width:Number.isFinite(raw.width)?Math.round(clamp(raw.width,10,17)):13,points}
}
function bytesToBase64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export function encodeBlueprint(raw){
  const obj=validateBlueprint(raw);if(!obj)throw new RangeError('Track needs 6–20 evenly spaced nodes covering an adequate area')
  const compact=[obj.v,obj.name,obj.theme,obj.width,obj.points]
  return 'vc1_'+bytesToBase64(new TextEncoder().encode(JSON.stringify(compact)))
}
export function decodeBlueprint(code){
  if(typeof code!=='string'||code.length>3000||!/^vc1_[A-Za-z0-9_-]{20,2800}$/.test(code))return null
  try{
    const source=code.slice(4).replaceAll('-','+').replaceAll('_','/'),bytes=Uint8Array.from(atob(source),c=>c.charCodeAt(0))
    if(bytes.length>2400)return null
    const [v,name,theme,width,points]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
    return validateBlueprint({v,name,theme,width,points})
  }catch{return null}
}
export function makeShareUrl(base,blueprint){
  const url=new URL(base);if(!['https:','http:'].includes(url.protocol))throw new RangeError('Only web links are supported')
  url.search='';url.hash='';url.searchParams.set('view','battle');url.searchParams.set('trackcode',encodeBlueprint(blueprint))
  return url.href
}
export function blueprintSpec(raw){
  const b=validateBlueprint(raw);if(!b)throw new RangeError('Invalid track')
  const skins={forest:['#c0ef6a','#5d9254','#9fcfce',1],desert:['#ffca74','#ba8862','#d9bea0',.87],snow:['#a6ecfa','#b6d8e1','#a2c7d8',.7],neon:['#ed82ff','#5668a0','#5d8bc3',.97]}
  const [color,ground,sky,grip]=skins[b.theme]
  return {id:'custom',name:b.name,level:6,tag:`CUSTOM · ${b.theme.toUpperCase()}`,description:'Original player-created voxel racetrack',color,ground,sky,grip,weather:b.theme==='snow'?'SNOW':'CLEAR',width:b.width,points:b.points,custom:true}
}
export function readBlueprints(storage=typeof localStorage==='undefined'?null:localStorage){
  try{const arr=JSON.parse(storage?.getItem(BLUEPRINT_STORAGE)||'[]');return Array.isArray(arr)?arr.map(validateBlueprint).filter(Boolean).slice(0,12):[]}catch{return []}
}
export function saveBlueprint(raw,storage=typeof localStorage==='undefined'?null:localStorage){
  const b=validateBlueprint(raw);if(!b)return false
  const others=readBlueprints(storage).filter(t=>encodeBlueprint(t)!==encodeBlueprint(b))
  try{storage?.setItem(BLUEPRINT_STORAGE,JSON.stringify([b,...others].slice(0,12)));return true}catch{return false}
}
export function editPoint(raw,index,changes){
  const b=validateBlueprint(raw);if(!b||!Number.isInteger(index)||index<0||index>=b.points.length)return null
  const points=b.points.map(p=>[...p]);points[index]=[...points[index]]
  for(const [axis,value] of Object.entries(changes))if(['0','1','2'].includes(axis)&&Number.isFinite(value)){
    const i=Number(axis);points[index][i]=Math.round(clamp(value,i===2?0:-140,i===2?36:140))
  }
  return {...b,points}
}
