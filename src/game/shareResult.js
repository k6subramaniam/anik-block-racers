/** Sharing a finished Grand Prix result. Bot Smash already has challenge codes,
 * score cards and clips (src/showdown/share.js); the Grand Prix had no way out of
 * the results screen, so a win ended on the device that earned it. The text and
 * URL builders are pure and unit-tested; the browser wrapper follows the same
 * gesture-only pattern as shareChallenge: native share sheet, then clipboard,
 * then manual. */
import { formatTime } from './simulation.js'
import { ordinal, DIFFICULTY, safeDifficulty } from './standings.js'

export function grandPrixShareText(result) {
  const label = DIFFICULTY[safeDifficulty(result?.difficulty)].label
  const time = formatTime(result?.time)
  if (result?.position === 1) return `I won the ANIK Block Racers Grand Prix — ${time} on ${label}. Think you can beat my time?`
  const place = ordinal(result?.position ?? 0)
  const field = result?.fieldSize ?? 8
  return `I finished ${place} of ${field} in the ANIK Block Racers Grand Prix — ${time} on ${label}. Think you can beat my time?`
}

/** The link a friend receives: the game itself, never a Bot Smash challenge
 * code or a leftover hash from the sender's session. */
export function grandPrixShareUrl(base) {
  const url = new URL(base)
  url.searchParams.delete('challenge')
  url.hash = ''
  return url.toString()
}

export async function shareGrandPrixResult(result, base = location.href) {
  const url = grandPrixShareUrl(base)
  const text = grandPrixShareText(result)
  if (navigator.share) {
    try { await navigator.share({ title: 'Beat my Grand Prix time', text, url }); return { status: 'shared', url } }
    catch (error) { if (error.name === 'AbortError') return { status: 'cancelled', url } }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); return { status: 'copied', url } }
  catch { return { status: 'manual', url } }
}
