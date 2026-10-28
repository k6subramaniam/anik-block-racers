import React,{Suspense,useState} from 'react'
import {challengeFromSearch} from './showdown/rules.js'
import './showdown/styles.css'
const OriginalGame=React.lazy(()=>import('./App.jsx'))
const ShowdownGame=React.lazy(()=>import('./showdown/Game.jsx'))

/** The existing race/open-world game is unchanged and mounted only when chosen. */
export default function Experience(){
  const [invitation]=useState(()=>challengeFromSearch(location.search))
  const [legacy,setLegacy]=useState(()=>{
    const params=new URLSearchParams(location.search)
    return !params.has('challenge') && (params.get('view')==='world'||['shortcut','shortcut-explore'].includes(params.get('source')))
  })
  const switchView=(world)=>{
    const url=new URL(location.href)
    if(world){url.search='';url.searchParams.set('view','world')}
    else {url.search='';url.searchParams.set('challenge',invitation.code);if(invitation.target!==null)url.searchParams.set('score',invitation.target)}
    history.replaceState({},'',url);setLegacy(world)
  }
  return <Suspense fallback={<div className="sd-boot">ANIK / BLOCK RACERS<br/><strong>LOADING YOUR GAME…</strong></div>}>
    {legacy?<div className="sd-legacy"><OriginalGame/><button className="sd-return" onClick={()=>switchView(false)} data-testid="back-to-showdown">↗ BOT SMASH · 60s</button></div>:<ShowdownGame invitation={invitation} onExit={()=>switchView(true)}/>}
  </Suspense>
}
