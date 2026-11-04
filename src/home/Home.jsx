import React, { useEffect, useMemo, useState } from 'react'
import { Flag, Swords, Bot, Compass, UserPlus, ChevronRight, Trophy, Download } from 'lucide-react'
import { loadBest } from '../game/records.js'
import { ordinal } from '../game/standings.js'
import { formatTime } from '../game/simulation.js'
import { readGarage } from '../studio/garage.js'
import { SCORE_KEY, validResult, browserStorage } from '../showdown/storage.js'
import './home.css'

function bestSmashScore(storage = browserStorage()) {
  try {
    const rows = JSON.parse(storage?.getItem(SCORE_KEY) || '[]')
    const scores = (Array.isArray(rows) ? rows : []).filter(validResult).map(r => r.score)
    return scores.length ? Math.max(...scores) : null
  } catch { return null }
}
function lastPlayed() { try { return localStorage.getItem('anik-last-mode') } catch { return null } }

/** The home screen: every way to play, one tap each, with your progress on each card. */
export default function Home({ onOpen }) {
  const [installPrompt, setInstallPrompt] = useState(null)
  const progress = useMemo(() => {
    const gp = loadBest(), garage = readGarage(), smash = bestSmashScore()
    return {
      grandprix: gp ? `BEST ${ordinal(gp.position)} · ${formatTime(gp.time)}` : 'NO RACES YET',
      battle: garage.races ? `${garage.wins} WINS · ${garage.races} RACES` : 'NO RACES YET',
      smash: smash != null ? `HIGH SCORE ${smash}` : 'NO SCORE YET',
    }
  }, [])
  const last = useMemo(lastPlayed, [])
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  const modes = [
    { id: 'grandprix', view: 'world', icon: Flag, title: 'GRAND PRIX', blurb: '8 karts · 3 laps · power-ups', accent: '#c8fa58', progress: progress.grandprix },
    { id: 'battle', view: 'battle', icon: Swords, title: 'BATTLE CIRCUITS', blurb: '5 worlds · bombs & mines · track creator', accent: '#ffb35c', progress: progress.battle },
    { id: 'smash', view: 'showdown', icon: Bot, title: 'BOT SMASH', blurb: '60-second arena · daily challenge', accent: '#5fd8ff', progress: progress.smash },
    { id: 'explore', view: 'world', options: { explore: true }, icon: Compass, title: 'EXPLORE', blurb: '10 districts · relics · villagers', accent: '#c58cff', progress: 'FREE ROAM' },
  ]
  const open = mode => {
    try { localStorage.setItem('anik-last-mode', mode.id) } catch {}
    onOpen(mode.view, mode.options)
  }
  return <div className="home" data-testid="home">
    <div className="home-bg" aria-hidden="true" />
    <header className="home-top">
      <div className="home-brand"><span>A</span><b>ANIK<small>BLOCK RACERS</small></b></div>
      {installPrompt && <button className="home-install" onClick={async () => { try { await installPrompt.prompt() } catch {} setInstallPrompt(null) }}><Download size={16} /> INSTALL</button>}
    </header>
    <main className="home-main">
      <section className="home-hero">
        <p className="home-eyebrow"><span /> VOXEL KART RACING</p>
        <h1>PICK YOUR <em>RACE.</em></h1>
      </section>
      <nav className="home-modes" aria-label="Game modes">
        {modes.map(mode => {
          const Icon = mode.icon
          return <button key={mode.id} className="home-card" style={{ '--accent': mode.accent }} onClick={() => open(mode)} data-testid={`home-${mode.id}`}>
            <span className="home-card-icon"><Icon size={26} strokeWidth={2.4} /></span>
            <span className="home-card-text">
              <b>{mode.title}{last === mode.id && <i>LAST PLAYED</i>}</b>
              <small>{mode.blurb}</small>
              <em><Trophy size={11} /> {mode.progress}</em>
            </span>
            <ChevronRight className="home-card-go" size={22} />
          </button>
        })}
      </nav>
      <button className="home-invite" onClick={() => onOpen('battle', { invite: true })} data-testid="quick-invite-friend">
        <UserPlus size={20} /><span><b>INVITE A FRIEND</b><small>Race together · one tap · private link</small></span><ChevronRight size={20} />
      </button>
    </main>
  </div>
}
