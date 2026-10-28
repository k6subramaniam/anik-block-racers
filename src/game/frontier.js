/** Bigger World v3.1: deterministic expansion around the unchanged original map.
 * Metres, Y-up. These footprints drive rendering, map projection and collisions.
 */
export const ORIGINAL_BOUNDS=Object.freeze({minX:-151,maxX:151,minZ:-126,maxZ:126})
export const EXPANDED_BOUNDS=Object.freeze({minX:-453,maxX:453,minZ:-378,maxZ:378})
export const WORLD_SIZE=Object.freeze({width:906,depth:756,areaMultiplier:9})
export const CHUNK_SIZE=96
export const FRONTIER_ZONES=Object.freeze([
  {id:'evergreen',name:'EVERGREEN WILDS',label:'Giant oaks, cabins and forest roads',icon:'♣',color:'#a8e86c',x:-310,z:-220,radius:68,spawn:{x:-310,z:-198,yaw:0},biome:'forest'},
  {id:'aurora',name:'AURORA FIELDS',label:'Ice spires and a frozen watchtower',icon:'✦',color:'#9ce8ff',x:310,z:-220,radius:68,spawn:{x:310,z:-198,yaw:0},biome:'snow'},
  {id:'sunset',name:'SUNSET OUTPOST',label:'Sandstone arches and desert ruins',icon:'▲',color:'#ffc478',x:-310,z:230,radius:68,spawn:{x:-310,z:208,yaw:Math.PI},biome:'sand'},
  {id:'redrock',name:'REDROCK VALLEY',label:'Red mesas and the long canyon highway',icon:'◆',color:'#ff9873',x:310,z:230,radius:68,spawn:{x:310,z:208,yaw:Math.PI},biome:'redrock'},
])
export const FRONTIER_ROADS=Object.freeze([
  {id:'nw-approach',a:[-148,-60],b:[-195,-115],width:13},
  {id:'nw-highway',a:[-195,-115],b:[-310,-220],width:13},
  {id:'ne-approach',a:[148,-60],b:[195,-115],width:13},
  {id:'ne-highway',a:[195,-115],b:[310,-220],width:13},
  {id:'sw-approach',a:[-148,80],b:[-195,130],width:13},
  {id:'sw-highway',a:[-195,130],b:[-310,230],width:13},
  {id:'se-approach',a:[148,80],b:[195,130],width:13},
  {id:'se-highway',a:[195,130],b:[310,230],width:13},
  {id:'northern-ring',a:[-310,-220],b:[310,-220],width:15},
  {id:'eastern-ring',a:[310,-220],b:[310,230],width:15},
  {id:'southern-ring',a:[310,230],b:[-310,230],width:15},
  {id:'western-ring',a:[-310,230],b:[-310,-220],width:15},
])
export function roadDistance(x,z,road){
  const [ax,az]=road.a,[bx,bz]=road.b,dx=bx-ax,dz=bz-az
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)))
  return Math.hypot(x-ax-t*dx,z-az-t*dz)
}
export function biomeAt(x,z){return z<0?(x<0?'forest':'snow'):(x<0?'sand':'redrock')}
export function withinOriginal(x,z,margin=14){return Math.abs(x)<151+margin&&Math.abs(z)<126+margin}
export function safeFrontierPosition(x,z,padding=5){
  const b=EXPANDED_BOUNDS
  if(x<b.minX+12||x>b.maxX-12||z<b.minZ+12||z>b.maxZ-12||withinOriginal(x,z))return false
  if(FRONTIER_ZONES.some(a=>Math.hypot(x-a.x,z-a.z)<a.radius+8))return false
  return !FRONTIER_ROADS.some(r=>roadDistance(x,z,r)<r.width/2+padding)
}
function rng(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
export function generateFrontier(){
  const random=rng(314150),chunks=[],trees=[]
  for(let cx=-5;cx<5;cx++)for(let cz=-4;cz<4;cz++){
    const local=[]
    for(let t=0;t<80&&local.length<13;t++){
      const x=(cx+random())*CHUNK_SIZE,z=(cz+random())*CHUNK_SIZE
      if(!safeFrontierPosition(x,z)||local.some(p=>Math.hypot(p.x-x,p.z-z)<8))continue
      const biome=biomeAt(x,z),height=biome==='forest'?6+random()*6:4+random()*5
      const p={id:`frontier-${cx}-${cz}-${local.length}`,x,z,height,canopy:4.5+random()*2.5,biome,radius:biome==='sand'||biome==='redrock'?1.2:.85}
      local.push(p);trees.push(p)
    }
    if(local.length)chunks.push({id:`chunk-${cx}-${cz}`,x:(cx+.5)*CHUNK_SIZE,z:(cz+.5)*CHUNK_SIZE,trees:local})
  }
  return {chunks,trees}
}
const generated=generateFrontier()
export const FRONTIER_CHUNKS=Object.freeze(generated.chunks)
export const FRONTIER_TREES=Object.freeze(generated.trees)
export const FRONTIER_TREE_COLLIDERS=Object.freeze(FRONTIER_TREES.map(p=>({id:p.id,x:p.x,z:p.z,radius:p.radius})))
/** Each solid landmark is an assembly of editable cuboids and one conservative
 * collider. Its clear road/plaza centre is intentionally NOT collidable. */
export const FRONTIER_LANDMARKS=Object.freeze(FRONTIER_ZONES.flatMap(zone=>[
  {id:`${zone.id}-lookout`,zoneId:zone.id,kind:'tower',biome:zone.biome,x:zone.x+26,z:zone.z-54,radius:6.8},
  {id:`${zone.id}-cabin`,zoneId:zone.id,kind:'cabin',biome:zone.biome,x:zone.x-26,z:zone.z+54,radius:8.8},
  {id:`${zone.id}-monument`,zoneId:zone.id,kind:'monument',biome:zone.biome,x:zone.x+26,z:zone.z+54,radius:10.8},
  {id:`${zone.id}-giant`,zoneId:zone.id,kind:'giant',biome:zone.biome,x:zone.x-26,z:zone.z-54,radius:10.8},
]))
export const FRONTIER_OBSTACLES=Object.freeze([...FRONTIER_TREE_COLLIDERS,...FRONTIER_LANDMARKS.map(p=>({id:p.id,x:p.x,z:p.z,radius:p.radius}))])
export function frontierBudget(tier='balanced'){
  return tier==='eco'?{drawDistance:210,fogFar:280}:tier==='high'?{drawDistance:340,fogFar:480}:{drawDistance:270,fogFar:380}
}
/** Index by the full obstacle footprint so large objects crossing cells are not
 * missed. Query once per physics step instead of scanning a larger world. */
export function buildObstacleIndex(obstacles,cellSize=48){
  const cells=new Map()
  for(const o of obstacles){
    const r=(o.radius||1)+2
    for(let x=Math.floor((o.x-r)/cellSize);x<=Math.floor((o.x+r)/cellSize);x++)
      for(let z=Math.floor((o.z-r)/cellSize);z<=Math.floor((o.z+r)/cellSize);z++){
        const key=`${x}:${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o)
      }
  }
  return {cellSize,cells}
}
export function nearbyObstacles(index,position,radius=5){
  const result=new Set(),size=index.cellSize
  for(let x=Math.floor((position.x-radius)/size);x<=Math.floor((position.x+radius)/size);x++)
    for(let z=Math.floor((position.z-radius)/size);z<=Math.floor((position.z+radius)/size);z++)
      for(const o of index.cells.get(`${x}:${z}`)||[])result.add(o)
  return [...result]
}
