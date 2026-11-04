/** Grand Prix personal bests, kept on this device only. Storage can be missing or
 * blocked (private windows, previews), so every access is guarded. */
import { ordinal } from './standings.js'

const KEY = 'anik-gp-best'

export function loadBest(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) || 'null')
    if (!value || !Number.isFinite(value.time) || !Number.isInteger(value.position)) return null
    return value
  } catch { return null }
}

/** Better = a higher finishing place, then a faster time. */
export function isBetter(result, best) {
  if (!best) return true
  if (result.position !== best.position) return result.position < best.position
  return result.time < best.time
}

/** Save a finished race. Returns the best result and a short line for the results screen. */
export function recordResult(result, storage = globalThis.localStorage) {
  const best = loadBest(storage)
  const lapBest = best?.bestLap == null ? result.bestLap : result.bestLap == null ? best.bestLap : Math.min(best.bestLap, result.bestLap)
  const races = (best?.races || 0) + 1, wins = (best?.wins || 0) + (result.position === 1 ? 1 : 0)
  const improved = isBetter(result, best)
  const next = improved
    ? { position: result.position, time: result.time, difficulty: result.difficulty, bestLap: lapBest, races, wins }
    : { ...best, bestLap: lapBest, races, wins }
  try { storage?.setItem(KEY, JSON.stringify(next)) } catch {}
  const message = !best ? 'FIRST GRAND PRIX ON THE BOARD'
    : improved ? `NEW PERSONAL BEST · WAS ${ordinal(best.position)}` : `PERSONAL BEST · ${ordinal(best.position)}`
  return { best: next, improved, message }
}
