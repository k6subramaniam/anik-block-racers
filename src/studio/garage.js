/** v4 Garage. Device-local progression; this is not an authoritative economy. */
export const GARAGE_KEY='anik-racers-garage-v4'
export const GARAGE_VERSION=4
export const UPGRADE_TYPES=Object.freeze(['engine','grip','armor','turbo'])
export const KART_STYLES=Object.freeze([
  {id:'emerald',name:'EMERALD RUSH',color:'#52e9b8',price:0},
  {id:'fire',name:'FIREBOLT',color:'#ff9c57',price:160},
  {id:'frost',name:'FROSTBITE',color:'#9be8ff',price:250},
  {id:'nebula',name:'NEBULA X',color:'#c58cff',price:400},
  {id:'gold',name:'GOLD COMET',color:'#f7d264',price:600},
])
export const DEFAULT_GARAGE=Object.freeze({version:GARAGE_VERSION,credits:0,selected:'emerald',owned:['emerald'],upgrades:{engine:0,grip:0,armor:0,turbo:0},awarded:[],races:0,wins:0})
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
export function sanitizeGarage(input){
  if(!input||input.version!==GARAGE_VERSION||typeof input!=='object')return {...DEFAULT_GARAGE,owned:['emerald'],upgrades:{...DEFAULT_GARAGE.upgrades},awarded:[]}
  const owned=['emerald',...new Set((Array.isArray(input.owned)?input.owned:[]).filter(x=>KART_STYLES.some(s=>s.id===x)))].filter((s,i,a)=>a.indexOf(s)===i)
  const upgrades=Object.fromEntries(UPGRADE_TYPES.map(k=>[k,Number.isInteger(input.upgrades?.[k])?clamp(input.upgrades[k],0,3):0]))
  return {version:4,credits:Number.isInteger(input.credits)?clamp(input.credits,0,999999):0,
    selected:owned.includes(input.selected)?input.selected:'emerald',owned,upgrades,
    awarded:(Array.isArray(input.awarded)?input.awarded:[]).filter(x=>typeof x==='string'&&x.length<120).slice(-80),
    races:Number.isInteger(input.races)?clamp(input.races,0,99999):0,wins:Number.isInteger(input.wins)?clamp(input.wins,0,99999):0}
}
export function readGarage(storage=typeof localStorage==='undefined'?null:localStorage){try{return sanitizeGarage(JSON.parse(storage?.getItem(GARAGE_KEY)||'null'))}catch{return sanitizeGarage(null)}}
export function persistGarage(value,storage=typeof localStorage==='undefined'?null:localStorage){
  const valid=sanitizeGarage(value);try{storage?.setItem(GARAGE_KEY,JSON.stringify(valid));return true}catch{return false}
}
export function upgradeCost(kind,level){return UPGRADE_TYPES.includes(kind)&&Number.isInteger(level)&&level>=0&&level<3?[70,155,290][level]:null}
export function purchaseUpgrade(raw,kind){
  const g=sanitizeGarage(raw),cost=upgradeCost(kind,g.upgrades[kind]);if(cost===null||g.credits<cost)return {garage:g,ok:false}
  const next={...g,credits:g.credits-cost,upgrades:{...g.upgrades,[kind]:g.upgrades[kind]+1}}
  return {garage:next,ok:true,cost}
}
export function buyKart(raw,id){
  const g=sanitizeGarage(raw),style=KART_STYLES.find(s=>s.id===id)
  if(!style)return {garage:g,ok:false}
  if(g.owned.includes(id))return {garage:{...g,selected:id},ok:true,cost:0}
  if(g.credits<style.price)return {garage:g,ok:false}
  return {garage:{...g,credits:g.credits-style.price,selected:id,owned:[...g.owned,id]},ok:true,cost:style.price}
}
export function garageModifiers(raw){
  const g=sanitizeGarage(raw),u=g.upgrades,style=KART_STYLES.find(s=>s.id===g.selected)||KART_STYLES[0]
  return {color:style.color,topSpeed:27+u.engine*1.8,acceleration:1+u.engine*.09,
    grip:1+u.grip*.09,maxHp:100+u.armor*15,armorMultiplier:1-u.armor*.06,
    turboDuration:1+u.turbo*.15,styleId:style.id}
}
export function raceReward(rank,laps,stuntScore=0,win=false){
  return Math.min(250,15+Math.min(10,laps)*5+Math.max(0,5-rank)*12+Math.min(90,Math.floor(stuntScore/250))+(win?25:0))
}
export function awardRace(raw,runId,rank,laps,stuntScore=0){
  const g=sanitizeGarage(raw)
  if(typeof runId!=='string'||!runId||runId.length>110||g.awarded.includes(runId))return {garage:g,earned:0,duplicate:true}
  const reward=raceReward(rank,laps,stuntScore,rank===1)
  return {garage:{...g,credits:clamp(g.credits+reward,0,999999),races:g.races+1,wins:g.wins+(rank===1?1:0),awarded:[...g.awarded,runId].slice(-80)},earned:reward,duplicate:false}
}
export function upgradeSummary(g){const m=garageModifiers(g);return [`Max speed ${Math.round(m.topSpeed*3.6)} km/h`,`Armor ${m.maxHp}`,`Grip +${Math.round((m.grip-1)*100)}%`,`Turbo +${Math.round((m.turboDuration-1)*100)}%`]}
