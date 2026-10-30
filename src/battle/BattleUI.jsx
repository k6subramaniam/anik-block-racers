import React,{createContext,useContext,useMemo,useEffect,useSyncExternalStore} from 'react'
import './battle.css'
import {ITEM_LABELS} from './items.js'
const Context=createContext(null)
export function BattleProvider({children}){
 const store=useMemo(()=>{
  let value={enabled:true,phase:'ready',mode:'race',health:100,bombs:3,mines:2,item:null,shots:0,hits:0,botHits:0,botKnockouts:0,wrecks:0,respawn:0,shield:3,stun:0,time:0,hazards:0,bursts:0}
  const listeners=new Set()
  return {enabled:true,actions:{bomb:0,mine:0,item:0},getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},
   update(next){value={...value,...next,enabled:this.enabled};for(const fn of listeners)fn()},
   toggle(){this.enabled=!this.enabled;this.actions={bomb:0,mine:0,item:0};this.update({})},
   fire(kind){if(value.phase==='racing'&&this.enabled&&value.respawn<=0&&(kind==='item'?!!value.item:value.weaponCooldown<=0))this.actions[kind]++},
  }
 },[])
 return <Context.Provider value={store}>{children}</Context.Provider>
}
export const useBattleStore=()=>useContext(Context)
export function BattleChoice(){
 const store=useBattleStore(),s=useSyncExternalStore(store.subscribe,store.getSnapshot)
 return <button type="button" className="battle-choice" data-testid="battle-toggle" aria-pressed={s.enabled} onClick={()=>store.toggle()}>
  {s.enabled?'✹ BATTLE RACE: ON':'⚑ CLASSIC RACE: NO EXPLOSIVES'}<small>{s.enabled?'Power-ups · rockets · bombs · mines':'Tap to enable power-ups and weapons'}</small>
 </button>
}
const labels={
 'bomb-thrown':'BOMB AWAY!','mine-dropped':'MINE DROPPED · ARMING',
 'player-blast':'BLAST HIT','player-wreck':'KART WRECKED','battle-respawn':'REPAIRED · SHIELD ACTIVE',
 'blast-knockout':'RIVAL KNOCKED OUT','ammo':'AMMO REFILLED','repair':'+40 REPAIR',
 'rival-weapon':'RIVAL DEPLOYED A HAZARD',
 'item-pickup':'POWER-UP','item-turbo':'TURBO!','item-shield':'SHIELD UP · 6s','rocket-launch':'ROCKET AWAY!',
 'rival-rocket':'ROCKET INCOMING','oil-dropped':'OIL SLICK DROPPED','rival-oil':'OIL SLICK AHEAD','oil-spin':'OIL SLICK! SPUN OUT','rival-spin':'SPUN OUT',
}
const ITEM_ICONS={turbo:'»',shield:'◎',rocket:'➤',oil:'◍'}
export function BattleHud(){
 const store=useBattleStore(),s=useSyncExternalStore(store.subscribe,store.getSnapshot)
 const active=s.mode==='race'&&s.enabled&&['racing','countdown'].includes(s.phase)
 useEffect(()=>{
  const key=e=>{
   if(e.repeat||e.target?.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return
   if(e.code==='KeyB'||e.code==='KeyQ'){e.preventDefault();store.fire(e.code==='KeyB'?'bomb':'mine')}
   if(e.code==='KeyF'){e.preventDefault();store.fire('item')}
  }
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
 },[store])
 if(!active)return null
 const blocked=s.phase!=='racing'||s.respawn>0||s.weaponCooldown>0
 return <aside className="battle-overlay" aria-label="Battle racing controls" data-testid="battle-hud" data-health={s.health} data-hits={s.hits} data-bot-hits={s.botHits} data-shots={s.shots} data-wrecks={s.wrecks} data-hazards={s.hazards} data-bursts={s.bursts}>
  <div className={`battle-health ${s.health<35?'critical':''}`}>
   <strong>◈ KART {Math.round(s.health)} / 100</strong><div className="battle-meter"><i style={{width:`${s.health}%`}}/></div>
   <small>{s.respawn>0?`RECOVERING ${s.respawn.toFixed(1)}s`:s.shield>.6?'SHIELD ACTIVE':`BATTLE RACE · ${s.botKnockouts} KOs`}</small>
  </div>
  <div className="battle-weapons">
   <button type="button" data-testid="throw-bomb" disabled={blocked||s.bombs===0} onClick={()=>store.fire('bomb')} aria-label="Throw arcade bomb"><b>✹</b><span>BOMB {s.bombs}<small>B · THROW AHEAD</small></span></button>
   <button type="button" data-testid="use-item" className={`item-slot ${s.item?'has-item':''}`} disabled={s.phase!=='racing'||s.respawn>0||!s.item} onClick={()=>store.fire('item')} aria-label={s.item?`Use ${ITEM_LABELS[s.item]}`:'No power-up held'} data-item={s.item||''}><b>{s.item?ITEM_ICONS[s.item]:'?'}</b><span>{s.item?ITEM_LABELS[s.item]:'NO ITEM'}<small>{s.item?'F · USE':'DRIVE THROUGH A ? BOX'}</small></span></button>
   <button type="button" data-testid="drop-mine" disabled={blocked||s.mines===0} onClick={()=>store.fire('mine')} aria-label="Drop arcade mine"><b>⊗</b><span>MINE {s.mines}<small>Q · DROP BEHIND</small></span></button>
  </div>
  {s.notice&&s.time-s.notice.time<1.6&&<div className="battle-notice" role="status">{labels[s.notice.kind]}{s.notice.item?` · ${ITEM_LABELS[s.notice.item]}`:''}{s.notice.damage?` −${s.notice.damage} HP`:''}{s.notice.name?` · ${s.notice.name}`:''}</div>}
  {s.respawn>0&&<div className="battle-recovery"><b>KART WRECKED</b><span>Back on track in {s.respawn.toFixed(1)}s</span><small>Lap progress preserved · clock keeps running</small></div>}
 </aside>
}
export function battleSnapshot(b,phase,mode){
 return {phase,mode,health:b.health,bombs:b.bombs,mines:b.mines,item:b.item,respawn:b.respawn,shield:b.shield,stun:b.stun,
  weaponCooldown:b.weaponCooldown,shots:b.shots,hits:b.hits,botHits:b.botHits,botKnockouts:b.botKnockouts,wrecks:b.wrecks,time:b.time,
  hazards:b.hazards.filter(h=>!h.cooldown).length,bursts:b.bursts.length,notice:b.notice}
}
