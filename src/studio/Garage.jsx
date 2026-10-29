import React from 'react'
import {KART_STYLES,UPGRADE_TYPES,garageModifiers,upgradeCost,upgradeSummary,buyKart,purchaseUpgrade,persistGarage} from './garage.js'
export default function Garage({value,onChange,onClose}){
 const mods=garageModifiers(value)
 const apply=next=>{persistGarage(next);onChange(next)}
 return <div className="studio-overlay"><section className="studio-panel studio-garage" role="dialog" aria-modal="true" aria-label="ANIK kart garage">
  <div className="studio-top"><div><small>ANIK CREATOR STUDIO</small><h2>KART GARAGE</h2></div><button onClick={onClose} aria-label="Close kart garage">✕</button></div>
  <div className="studio-balance"><span>EARNED RACE CREDITS</span><b data-testid="garage-credits">◈ {value.credits.toLocaleString()}</b><small>{value.races} finished races · {value.wins} victories</small></div>
  <p>Earn credits by finishing races and landing tricks. Spend them on engine, handling, armor and turbo capacity. Garage data is stored on this device, not a paid or global account.</p>
  <div className="studio-kart-grid">{KART_STYLES.map(s=>{
   const owned=value.owned.includes(s.id),selected=value.selected===s.id
   return <button key={s.id} className={`studio-kart ${selected?'selected':''}`} onClick={()=>apply(buyKart(value,s.id).garage)} disabled={!owned&&value.credits<s.price} aria-label={`${s.name}, ${owned?'owned':s.price+' credits'}`}>
    <span className="studio-kart-pic" style={{color:s.color}}>▰<i>◼</i></span><b>{s.name}</b><small>{selected?'EQUIPPED':owned?'SELECT':'◈ '+s.price}</small>
   </button>
  })}</div>
  <h3>PERFORMANCE UPGRADES</h3>
  <div className="studio-upgrades">{UPGRADE_TYPES.map(kind=>{
   const level=value.upgrades[kind],cost=upgradeCost(kind,level)
   const resultName={engine:'ENGINE',grip:'TIRES & GRIP',armor:'ARMOR',turbo:'TURBO SYSTEM'}[kind]
   return <div key={kind}><div><b>{resultName}</b><small>LEVEL {level} / 3</small></div><div className="studio-level"><i style={{width:`${level/3*100}%`}}/></div><button data-testid={`garage-upgrade-${kind}`} disabled={cost===null||value.credits<cost} onClick={()=>apply(purchaseUpgrade(value,kind).garage)}>{cost===null?'MAXED':'UPGRADE · ◈ '+cost}</button></div>
  })}</div>
  <div className="studio-garage-specs">{upgradeSummary(value).map(s=><span key={s}>{s}</span>)}</div>
  <button className="studio-primary" onClick={onClose}>RETURN TO THE TRACK</button>
  <small>Private peer-to-peer races use equalized stats, regardless of garage upgrades.</small>
 </section></div>
}
