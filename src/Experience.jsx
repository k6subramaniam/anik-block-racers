import React,{Suspense,useEffect,useState} from 'react'
import {challengeFromSearch} from './showdown/rules.js'
import {viewFromSearch,urlForView} from './home/navigation.js'
import Home from './home/Home.jsx'
import './showdown/styles.css'
import './battle/styles.css'
import './studio/studio.css'
const OriginalGame=React.lazy(()=>import('./App.jsx'))
const ShowdownGame=React.lazy(()=>import('./showdown/Game.jsx'))
const BattleGame=React.lazy(()=>import('./battle/Game.jsx'))

/** One home screen leads to every mode. Each mode is its own browser history entry,
 * so the phone's back gesture returns home instead of leaving the game. Published
 * challenge links (sd1/sd2) still open Bot Smash directly with their rules unchanged. */
export default function Experience(){
  const [invitation]=useState(()=>challengeFromSearch(location.search))
  const [view,setView]=useState(()=>viewFromSearch(location.search))
  // Re-mounting a mode starts it fresh; the key changes whenever we open one.
  const [visit,setVisit]=useState(0)
  useEffect(()=>{
    const onPop=()=>{setView(viewFromSearch(location.search));setVisit(v=>v+1)}
    window.addEventListener('popstate',onPop)
    return()=>window.removeEventListener('popstate',onPop)
  },[])
  const open=(next,options={})=>{
    const extra=next==='showdown'?{challenge:invitation.code,score:invitation.target}:{}
    history.pushState({view:next},'',urlForView(location.href,next,{...extra,...options}))
    setView(next);setVisit(v=>v+1)
  }
  const goHome=()=>{
    // Return along history when we came from home, so back/forward stay consistent.
    if(history.state?.view&&history.state.view!=='home'){history.back();return}
    history.replaceState({view:'home'},'',urlForView(location.href,'home'));setView('home');setVisit(v=>v+1)
  }
  return <Suspense fallback={<div className="sd-boot">ANIK / BLOCK RACERS<br/><strong>LOADING YOUR GAME…</strong></div>}>
    {view==='home'?<Home onOpen={open}/>
      :view==='battle'?<BattleGame key={visit} onExit={goHome}/>
      :view==='world'?<OriginalGame key={visit} onHome={goHome}/>
      :<ShowdownGame key={visit} invitation={invitation} onExit={goHome}/>}
  </Suspense>
}
