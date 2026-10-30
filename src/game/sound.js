// Game audio: kart engine, event sound effects and background music.
// The engine and effects are synthesized with Web Audio. Music is a Higgsfield-generated
// loop (public/audio/music.mp3); the synthesized chiptune plays if that file cannot load.
import { MAX_SPEED } from './simulation.js'

let sharedCtx = null
// One AudioContext for the whole game; mobile browsers limit how many may exist.
export function getAudioContext() {
  if (sharedCtx) return sharedCtx
  const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AudioCtor) return null
  sharedCtx = new AudioCtor()
  return sharedCtx
}

export const SFX_FOR_EVENT = {
  coin: 'coin',
  boost: 'boost',
  wall: 'bump',
  obstacle: 'bump',
  border: 'bump',
  lava: 'bump',
  'npc-hit': 'hit',
  'npc-smash': 'smash',
  'checkpoint-1': 'chime',
  'checkpoint-2': 'chime',
  lap: 'fanfare',
  finished: 'fanfare',
  discovery: 'sparkle',
  relic: 'sparkle',
  portal: 'sparkle',
  travel: 'sparkle',
  'water-splash': 'splash',
}

export function sfxFor(event) {
  return SFX_FOR_EVENT[event] || null
}

// Engine pitch and loudness follow kart speed; turbo adds a little extra whine.
export function engineParams(speed = 0, boosting = false) {
  const ratio = Math.min(1, Math.abs(speed) / MAX_SPEED)
  return {
    frequency: 48 + ratio * 104 + (boosting ? 26 : 0),
    gain: 0.03 + ratio * 0.05 + (boosting ? 0.015 : 0),
    cutoff: 380 + ratio * 1300 + (boosting ? 500 : 0),
  }
}

// 16-step patterns at 132 BPM in A minor. Numbers are MIDI notes, null is a rest.
export const MUSIC_BPM = 132
export const MUSIC_BARS = [
  { bass: [45, null, 45, 57, null, 45, 57, null, 45, null, 45, 57, null, 45, 52, 55], lead: [69, null, 72, null, 76, null, 74, 72, null, 69, null, 67, 69, null, null, null] },
  { bass: [41, null, 41, 53, null, 41, 53, null, 41, null, 41, 53, null, 41, 48, 52], lead: [65, null, 69, null, 72, null, 74, 72, null, 69, null, 72, 74, null, null, null] },
  { bass: [48, null, 48, 60, null, 48, 60, null, 48, null, 48, 60, null, 48, 55, 59], lead: [72, null, 76, null, 79, null, 76, 74, null, 72, null, 74, 76, null, 79, null] },
  { bass: [43, null, 43, 55, null, 43, 55, null, 43, null, 43, 55, null, 43, 50, 54], lead: [74, null, 71, null, 67, null, 71, 74, null, 76, null, 74, 71, null, 67, null] },
]
export const midiToHz = note => 440 * 2 ** ((note - 69) / 12)

// In-game radio. File stations are Higgsfield-generated loops (Seedance 2.0 Mini native
// audio): each plays its intro once, then loops whole bars between `loop.start` and `loop.end`.
export const RADIO_STATIONS = Object.freeze([
  { id: 'turbo', name: 'TURBO FM', genre: 'Electro racing', bpm: 120, file: 'music.mp3', loop: { start: 4.39, end: 12.39 } },
  { id: 'neon', name: 'NEON NIGHTS', genre: 'Synthwave', bpm: 100, file: 'radio-synthwave.mp3', loop: { start: 1.47, end: 11.07 } },
  { id: 'riff', name: 'RIFF RADIO', genre: 'Rock', bpm: 150.5, file: 'radio-rock.mp3', loop: { start: 6.917, end: 13.296 } },
  { id: 'chill', name: 'CHILL CRUISE', genre: 'Lo-fi beats', bpm: 85, file: 'radio-lofi.mp3', loop: { start: 5.717, end: 11.364 } },
  { id: 'bass', name: 'BASS DRIVE', genre: 'Drum & bass', bpm: 172.25, file: 'radio-dnb.mp3', loop: { start: 7.923, end: 13.497 } },
  { id: 'arcade', name: '8-BIT ARCADE', genre: 'Chiptune', bpm: MUSIC_BPM, synth: true },
])
export const DEFAULT_STATION = RADIO_STATIONS[0].id
export const stationById = id => RADIO_STATIONS.find(station => station.id === id) || RADIO_STATIONS[0]
export function nextStation(id, direction = 1) {
  const n = RADIO_STATIONS.length, i = Math.max(0, RADIO_STATIONS.findIndex(station => station.id === id))
  return RADIO_STATIONS[(i + direction + n) % n].id
}

export function createSoundEngine(baseUrl = '/') {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuffer = null
  let stationId = DEFAULT_STATION, musicSource = null, musicIntense = false
  const buffers = new Map(), loading = new Map(), failed = new Set()
  let engine = null, sfxOn = true, musicOn = true, musicActive = false, musicTimer = null
  let nextStepTime = 0, step = 0

  function noise() {
    if (noiseBuffer) return noiseBuffer
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return noiseBuffer
  }

  function tone({ type = 'square', from, to = from, start = 0, duration = 0.12, volume = 0.2, bus = sfxBus }) {
    const t = ctx.currentTime + start
    const osc = ctx.createOscillator(), env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + duration)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(volume, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(env).connect(bus)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  function burst({ start = 0, duration = 0.25, volume = 0.3, filter = 'lowpass', from = 1800, to = 200 }) {
    const t = ctx.currentTime + start
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), env = ctx.createGain()
    src.buffer = noise()
    f.type = filter
    f.frequency.setValueAtTime(from, t)
    f.frequency.exponentialRampToValueAtTime(to, t + duration)
    env.gain.setValueAtTime(volume, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(f).connect(env).connect(sfxBus)
    src.start(t)
    src.stop(t + duration + 0.02)
  }

  const SFX = {
    coin: () => { tone({ from: 988, duration: 0.07, volume: 0.12 }); tone({ from: 1319, start: 0.07, duration: 0.16, volume: 0.12 }) },
    boost: () => { tone({ type: 'sawtooth', from: 180, to: 900, duration: 0.45, volume: 0.13 }); burst({ duration: 0.5, volume: 0.12, filter: 'bandpass', from: 600, to: 3000 }) },
    bump: () => { tone({ type: 'triangle', from: 140, to: 50, duration: 0.18, volume: 0.35 }); burst({ duration: 0.16, volume: 0.25, from: 900, to: 120 }) },
    hit: () => { tone({ type: 'square', from: 260, to: 90, duration: 0.14, volume: 0.16 }); burst({ duration: 0.12, volume: 0.2, from: 2500, to: 400 }) },
    smash: () => { burst({ duration: 0.55, volume: 0.4, from: 3000, to: 80 }); tone({ type: 'triangle', from: 110, to: 40, duration: 0.5, volume: 0.35 }); [784, 988, 1175].forEach((f, i) => tone({ from: f, start: 0.12 + i * 0.06, duration: 0.1, volume: 0.08 })) },
    chime: () => { tone({ type: 'triangle', from: 880, duration: 0.12, volume: 0.18 }); tone({ type: 'triangle', from: 1175, start: 0.1, duration: 0.24, volume: 0.18 }) },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, start: i * 0.09, duration: i === 3 ? 0.42 : 0.1, volume: 0.13 })) },
    sparkle: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', from: f, start: i * 0.055, duration: 0.16, volume: 0.09 })) },
    splash: () => { burst({ duration: 0.7, volume: 0.35, filter: 'bandpass', from: 2400, to: 300 }); tone({ type: 'sine', from: 320, to: 90, duration: 0.3, volume: 0.15 }) },
    countLow: () => tone({ from: 440, duration: 0.18, volume: 0.14 }),
    countHigh: () => tone({ from: 880, duration: 0.4, volume: 0.16 }),
    tune: () => { burst({ duration: 0.28, volume: 0.16, filter: 'bandpass', from: 4200, to: 900 }); tone({ type: 'sine', from: 1400, to: 700, duration: 0.18, volume: 0.05 }) },
  }

  function startEngine() {
    if (engine) return
    const osc = ctx.createOscillator(), sub = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain()
    osc.type = 'sawtooth'; sub.type = 'square'
    osc.frequency.value = 48; sub.frequency.value = 24
    filter.type = 'lowpass'; filter.frequency.value = 380; filter.Q.value = 4
    gain.gain.value = 0
    osc.connect(filter); sub.connect(filter); filter.connect(gain).connect(sfxBus)
    osc.start(); sub.start()
    engine = { osc, sub, filter, gain }
  }

  function scheduleMusic() {
    // Look-ahead scheduler: queue notes slightly ahead of the audio clock.
    const stepLength = 60 / MUSIC_BPM / 4
    while (nextStepTime < ctx.currentTime + 0.12) {
      const bar = MUSIC_BARS[Math.floor(step / 16) % MUSIC_BARS.length], i = step % 16, start = nextStepTime - ctx.currentTime
      if (bar.bass[i] != null) tone({ type: 'triangle', from: midiToHz(bar.bass[i]), start, duration: stepLength * 0.9, volume: 0.32, bus: musicBus })
      if (bar.lead[i] != null) tone({ type: 'square', from: midiToHz(bar.lead[i]), start, duration: stepLength * 1.6, volume: 0.09, bus: musicBus })
      if (i % 4 === 0) tone({ type: 'sine', from: 150, to: 45, start, duration: 0.12, volume: 0.35, bus: musicBus })
      if (i % 4 === 2) tone({ type: 'square', from: 7000, start, duration: 0.025, volume: 0.025, bus: musicBus })
      nextStepTime += stepLength
      step++
    }
  }

  function applyMusicGain() {
    // A full mixed track needs more gain than the sparse synthesized voices.
    if (musicBus) musicBus.gain.setTargetAtTime((musicIntense ? 1 : 0.5) * (buffers.has(stationId) ? 0.5 : 0.32), ctx.currentTime, 0.3)
  }

  function loadStation(station) {
    if (station.synth || buffers.has(station.id) || loading.has(station.id)) return
    loading.set(station.id, fetch(`${baseUrl}audio/${station.file}`)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('missing station')))
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => buffers.set(station.id, buffer))
      .catch(() => failed.add(station.id))
      .then(() => {
        if (station.id !== stationId) return
        applyMusicGain()
        updateMusic()
        // Warm up the next station so the radio button switches instantly.
        loadStation(stationById(nextStation(station.id)))
      }))
  }

  function stopMusic() {
    if (musicSource) { try { musicSource.stop() } catch {} musicSource = null }
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null }
  }

  function updateMusic() {
    if (!ctx || !musicOn || !musicActive) { stopMusic(); return }
    const station = stationById(stationId), buffer = buffers.get(station.id)
    if (buffer) {
      if (musicSource) return
      musicSource = ctx.createBufferSource()
      musicSource.buffer = buffer
      musicSource.loop = true
      musicSource.loopStart = station.loop.start
      musicSource.loopEnd = station.loop.end
      musicSource.connect(musicBus)
      musicSource.start()
      return
    }
    // A station that is still loading stays quiet; the chiptune plays for its own
    // station and stands in for any file that failed to load.
    if (!station.synth && !failed.has(station.id)) { loadStation(station); return }
    if (!musicTimer) {
      nextStepTime = ctx.currentTime + 0.05
      musicTimer = setInterval(scheduleMusic, 25)
    }
  }

  return {
    unlock() {
      ctx = getAudioContext()
      if (!ctx) return
      if (!master) {
        master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination)
        sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master)
        musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master)
        startEngine()
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      updateMusic()
    },
    play(name) {
      if (!ctx || !sfxOn || !SFX[name] || ctx.state !== 'running') return false
      SFX[name]()
      return true
    },
    setEngine(speed, boosting, running) {
      if (!engine) return
      const p = engineParams(speed, boosting), t = ctx.currentTime
      engine.osc.frequency.setTargetAtTime(p.frequency, t, 0.08)
      engine.sub.frequency.setTargetAtTime(p.frequency / 2, t, 0.08)
      engine.filter.frequency.setTargetAtTime(p.cutoff, t, 0.08)
      engine.gain.gain.setTargetAtTime(running && sfxOn ? p.gain : 0, t, running ? 0.08 : 0.04)
    },
    setSfxEnabled(value) {
      sfxOn = value
      if (sfxBus) sfxBus.gain.setTargetAtTime(value ? 1 : 0, ctx.currentTime, 0.03)
    },
    setMusicEnabled(value) { musicOn = value; updateMusic() },
    setStation(id) {
      const station = stationById(id)
      if (station.id === stationId) return
      stationId = station.id
      stopMusic()
      if (!ctx) return
      if (musicOn && musicActive) SFX.tune()
      applyMusicGain()
      updateMusic()
    },
    // Racing gets the full soundtrack; menus and pause get a quieter bed.
    setMusicState(active, intense) {
      musicActive = active
      musicIntense = intense
      applyMusicGain()
      updateMusic()
    },
    suspend() { ctx?.suspend?.().catch(() => {}) },
    resume() { if (ctx?.state === 'suspended') ctx.resume().catch(() => {}) },
  }
}
