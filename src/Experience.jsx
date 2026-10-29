import React,{Suspense,useState} from 'react'
import {challengeFromSearch} from './showdown/rules.js'
import './showdown/styles.css'
import './battle/styles.css'
import './studio/studio.css'
const OriginalGame=React.lazy(()=>import('./App.jsx'))
const ShowdownGame=React.lazy(()=>import('./showdown/Game.jsx'))
const BattleGame=React.lazy(()=>import('./battle/Game.jsx'))

/** Combat is a separate mode: published sd1/sd2 challenge rules stay unchanged. */
export default function Experience(){
  const [invitation]=useState(()=>challengeFromSearch(location.search))
  const [view,setView]=useState(()=>{
    const p=new URLSearchParams(location.search)
    if(p.get('view')==='battle'||p.get('source')==='shortcut-battle')return 'battle'
    return !p.has('challenge')&&(p.get('view')==='world'||['shortcut','shortcut-explore'].includes(p.get('source')))?'world':'showdown'
  })
  const switchView=(next,inviteFriend=false)=>{
    const url=new URL(location.href);url.search='';if(next!=='battle')url.hash=''
    if(next==='world'||next==='battle'){url.searchParams.set('view',next);if(next==='battle'&&inviteFriend)url.searchParams.set('invite','1')}
    else {url.searchParams.set('challenge',invitation.code);if(invitation.target!==null)url.searchParams.set('score',invitation.target)}
    history.replaceState({},'',url);setView(next)
  }
  return <Suspense fallback={<div className="sd-boot">ANIK / BLOCK RACERS<br/><strong>LOADING YOUR GAME…</strong></div>}>
    {view==='battle'?<BattleGame onExit={()=>switchView('showdown')}/>:view==='world'?<div className="sd-legacy"><OriginalGame/><button className="sd-return" onClick={()=>switchView('showdown')} data-testid="back-to-showdown">↗ BOT SMASH · 60s</button></div>:<div className="sd-hub"><ShowdownGame invitation={invitation} onExit={()=>switchView('world')}/><button className="br-friend-launch" onClick={()=>switchView('battle',true)} data-testid="quick-invite-friend"><span aria-hidden="true">◎</span><span>INVITE A FRIEND<small>One tap · Share a private link</small></span><span aria-hidden="true">↗</span></button><button className="br-launch" onClick={()=>switchView('battle')} data-testid="open-battle"><span aria-hidden="true">⚑</span><span>BATTLE RACE<small>5 levels · Crashes · Choose laps</small></span><span aria-hidden="true">↗</span></button></div>}
  </Suspense>
}
