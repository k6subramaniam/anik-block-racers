/** Rival chatter: each AI driver has its own Higgsfield voice (Seed Audio presets) and a
 * few short lines for close passes and bumps. Plays on its own channel so it never cuts
 * off the announcer, and is rate limited so the track never turns into a shouting match.
 */
import { getAudioContext } from './sound.js'

export const RIVAL_CHATTER = Object.freeze({
  bolt: { voice: 'Benji', near: ['Beep beep! Coming through!', 'You call that driving?'], bump: ['Hey! Watch the paint job!', 'Oof! My bolts are loose!'] },
  nova: { voice: 'Juno', near: ['Catch me if you can, slowpoke!', 'See you at the finish line. Maybe!'], bump: ['Rude! I was here first!', 'Did you even look?'] },
  pixel: { voice: 'Archie', near: ['Lagging behind, are we?', 'Press the gas pedal. It helps!'], bump: ['Ouch! You glitched me!', 'Hey! No clipping through me!'] },
  blaze: { voice: 'Desmond', near: ['Feel the heat!', 'Too hot to handle!'], bump: ['You just bumped a legend!', "That's gonna leave a scorch mark!"] },
  volt: { voice: 'Ginger', near: ['Zap! Out of my way!', "I'm fully charged. Are you?"], bump: ['Shocking driving!', 'Hey! That gave me a jolt!'] },
  rose: { voice: 'Isla', near: ['Smell you later!', 'Pretty fast for a flower, huh?'], bump: ['Watch the petals!', 'Thorns out, buddy!'] },
  onyx: { voice: 'Grady', near: ['Quiet. Like a rock.', 'You will not pass me.'], bump: ['I am a boulder. You bounce.', 'That tickled.'] },
})

// Seconds. A bump always beats a close-pass taunt, but nobody repeats themselves quickly.
export const CHATTER_RULES = Object.freeze({ nearDistance: 9, gap: 4.5, rivalCooldown: 14, bumpCooldown: 3 })

export const chatterFile = (id, kind, n) => `chatter/${id}-${kind}${n + 1}.mp3`

export function initialChatter() {
  return { lastAny: -Infinity, last: {}, lastBump: {}, turn: {} }
}

/** Decide who (if anyone) speaks now. `bumps` are rival ids that just touched the player;
 * `near` is [{id, distance}] for rivals close by. Returns {line, state}. */
export function pickChatter(state, now, { bumps = [], near = [] } = {}) {
  const known = id => !!RIVAL_CHATTER[id]
  const bumpId = bumps.find(id => known(id) && now - (state.lastBump[id] ?? -Infinity) >= CHATTER_RULES.bumpCooldown && now - state.lastAny >= 1)
  let id = bumpId, kind = 'bump'
  if (!id && now - state.lastAny >= CHATTER_RULES.gap) {
    const closest = near.filter(n => known(n.id) && n.distance <= CHATTER_RULES.nearDistance && now - (state.last[n.id] ?? -Infinity) >= CHATTER_RULES.rivalCooldown)
      .sort((a, b) => a.distance - b.distance)[0]
    id = closest?.id; kind = 'near'
  }
  if (!id) return { line: null, state }
  const key = `${id}:${kind}`, n = (state.turn[key] || 0) % RIVAL_CHATTER[id][kind].length
  const next = { lastAny: now, last: { ...state.last, [id]: now }, lastBump: kind === 'bump' ? { ...state.lastBump, [id]: now } : state.lastBump, turn: { ...state.turn, [key]: n + 1 } }
  return { line: { id, kind, n, text: RIVAL_CHATTER[id][kind][n], file: chatterFile(id, kind, n) }, state: next }
}

export function createChatter(baseUrl = '/') {
  let ctx = null, gain = null, current = null, enabled = true
  const buffers = new Map(), loading = new Map()
  const load = file => {
    if (!ctx || buffers.has(file) || loading.has(file)) return loading.get(file)
    const p = fetch(`${baseUrl}audio/${file}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing')))
      .then(d => ctx.decodeAudioData(d)).then(b => { buffers.set(file, b); return b }).catch(() => null)
    loading.set(file, p)
    return p
  }
  return {
    unlock() {
      if (!ctx) {
        ctx = getAudioContext(); if (!ctx) return
        gain = ctx.createGain(); gain.gain.value = .85; gain.connect(ctx.destination)
        // Warm every rival's first close-pass line so the first taunt is instant.
        for (const id of Object.keys(RIVAL_CHATTER)) load(chatterFile(id, 'near', 0))
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    },
    setEnabled(value) { enabled = value; if (!value && current) { try { current.stop() } catch {} current = null } },
    async say(line) {
      if (!enabled || !ctx || !line) return false
      const buffer = buffers.get(line.file) || await load(line.file)
      if (!buffer || !enabled) return false
      if (current) { try { current.stop() } catch {} }
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start()
      source.onended = () => { if (current === source) current = null }
      current = source
      return true
    },
  }
}
