// Arcade announcer voice lines generated with Higgsfield (Seed Audio 1.0 TTS).
// Clips live in public/audio and are decoded once into Web Audio buffers so that
// playback is instant and never blocks the render loop.
import { LAPS_TO_WIN } from './track.js'

export const ANNOUNCER_CLIPS = {
  three: 'three.mp3',
  two: 'two.mp3',
  one: 'one.mp3',
  go: 'go.mp3',
  checkpoint: 'checkpoint.mp3',
  lap: 'lap.mp3',
  'final-lap': 'final-lap.mp3',
  finish: 'finish.mp3',
  turbo: 'turbo.mp3',
  smash: 'smash.mp3',
  discovery: 'discovery.mp3',
  relic: 'relic.mp3',
}

// Countdown values map to clips; 0 is the GO call.
export const COUNTDOWN_CLIPS = ['go', 'one', 'two', 'three']

// Frequent events would turn the announcer into noise, so they are rate limited.
const MIN_GAP_MS = { turbo: 6000, checkpoint: 1500, smash: 2500 }

export function announcerClipFor(event, race = {}) {
  switch (event) {
    case 'checkpoint-1':
    case 'checkpoint-2': return 'checkpoint'
    case 'lap': return race.lap >= LAPS_TO_WIN ? 'final-lap' : 'lap'
    case 'finished': return 'finish'
    case 'boost': return 'turbo'
    case 'npc-smash': return 'smash'
    case 'discovery': return 'discovery'
    case 'relic': return 'relic'
    default: return null
  }
}

export function shouldPlay(clip, now, lastPlayed = {}) {
  if (!clip || !ANNOUNCER_CLIPS[clip]) return false
  const gap = MIN_GAP_MS[clip] || 0
  return lastPlayed[clip] == null || now - lastPlayed[clip] >= gap
}

export function createAnnouncer(baseUrl = '/') {
  let ctx = null, gain = null, current = null, enabled = true, loading = null
  const buffers = {}, lastPlayed = {}

  function load() {
    if (loading || !ctx) return loading
    loading = Promise.all(Object.entries(ANNOUNCER_CLIPS).map(async ([name, file]) => {
      try {
        const response = await fetch(`${baseUrl}audio/${file}`)
        if (!response.ok) return
        buffers[name] = await ctx.decodeAudioData(await response.arrayBuffer())
      } catch { /* A missing clip simply stays silent. */ }
    }))
    return loading
  }

  return {
    // Browsers only allow audio after a user gesture, so call this from one.
    unlock() {
      const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      if (!AudioCtor) return
      if (!ctx) {
        ctx = new AudioCtor()
        gain = ctx.createGain()
        gain.gain.value = 0.9
        gain.connect(ctx.destination)
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      load()
    },
    setEnabled(value) {
      enabled = value
      if (!value && current) { try { current.stop() } catch {} current = null }
    },
    play(clip) {
      if (!enabled || !ctx || !buffers[clip]) return false
      const now = performance.now()
      if (!shouldPlay(clip, now, lastPlayed)) return false
      lastPlayed[clip] = now
      // One voice at a time: a new call cuts off the previous one.
      if (current) { try { current.stop() } catch {} }
      const source = ctx.createBufferSource()
      source.buffer = buffers[clip]
      source.connect(gain)
      source.onended = () => { if (current === source) current = null }
      source.start()
      current = source
      return true
    },
    suspend() { ctx?.suspend?.().catch(() => {}) },
    resume() { if (ctx?.state === 'suspended') ctx.resume().catch(() => {}) },
  }
}
