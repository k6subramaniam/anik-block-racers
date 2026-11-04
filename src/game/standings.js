/** Live race order for the Voxel Valley Grand Prix. Everyone is measured in metres
 * of race distance from the start/finish line, so the player and the rivals compare
 * directly. Pure functions: no Three.js, so the rules run under node --test.
 */
import { TRACK, nearestRoad, CHECKPOINT_1_INDEX, CHECKPOINT_2_INDEX, FINISH_INDEX, LAPS_TO_WIN } from './track.js'
import { RACE_ARC, TRACK_LENGTH } from './npcAI.js'

export const RACE_DISTANCE = TRACK_LENGTH * LAPS_TO_WIN
const FINISH_ARC = RACE_ARC[FINISH_INDEX]
const sinceLine = arc => ((arc - FINISH_ARC) % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH
const CP1 = sinceLine(RACE_ARC[CHECKPOINT_1_INDEX]), CP2 = sinceLine(RACE_ARC[CHECKPOINT_2_INDEX])

/** Metres of race the player has covered. Checkpoints decide which side of the line a
 * position near it belongs to, so the grid (behind the line) reads as slightly negative. */
export function playerProgress(race, road = nearestRoad(race)) {
  const a = TRACK[road.index], b = TRACK[(road.index + 1) % TRACK.length]
  let u = sinceLine(RACE_ARC[road.index] + Math.hypot(b.x - a.x, b.z - a.z) * road.t)
  if (race.checkpoint === 0 && u > CP1 + 20) u -= TRACK_LENGTH
  else if (race.checkpoint === 1) u = Math.min(Math.max(u, CP1 - 20), CP2 + 20)
  else if (race.checkpoint === 2 && u < CP2 - 20) u += TRACK_LENGTH
  return (race.lap - 1) * TRACK_LENGTH + u
}

/** Rivals store `travel`, metres from the start of the sampled loop; the grid sits a
 * few metres behind the line, so their race distance starts slightly negative too. */
export function rivalProgress(npc) {
  return npc.travel - FINISH_ARC
}

/** Sorted standings: finishers by time, then everyone else by distance covered. */
export function standings(entries) {
  return [...entries].sort((a, b) => {
    if (a.finishTime != null || b.finishTime != null) {
      if (a.finishTime == null) return 1
      if (b.finishTime == null) return -1
      return a.finishTime - b.finishTime
    }
    return b.progress - a.progress
  })
}

/** Position of the player (1-based) in a list of entries. */
export function positionOf(entries, id = 'player') {
  return standings(entries).findIndex(e => e.id === id) + 1
}

/** A rival that has not finished when the player does gets a projected time from its
 * remaining distance and pace, so the results table is complete and fair. */
export function projectedTime(entry, elapsed) {
  if (entry.finishTime != null) return entry.finishTime
  const left = Math.max(0, RACE_DISTANCE - entry.progress)
  return elapsed + left / Math.max(1, entry.pace || 17)
}

export function ordinal(n) {
  const s = ['TH', 'ST', 'ND', 'RD'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Rival pace multipliers for each difficulty. */
export const DIFFICULTY = Object.freeze({
  easy: { id: 'easy', label: 'EASY', pace: .86, note: 'Relaxed rivals' },
  normal: { id: 'normal', label: 'NORMAL', pace: 1, note: 'A fair fight' },
  hard: { id: 'hard', label: 'HARD', pace: 1.1, note: 'Rivals push hard' },
})
export function safeDifficulty(value) { return DIFFICULTY[value] ? value : 'normal' }

/** Every rival's race entry: distance covered, finish time if any, and pace. */
export function raceEntries(npcs, finished = {}) {
  return npcs.filter(n => n.kind === 'racer').map(n => ({ id: n.id, name: n.name, color: n.color, progress: rivalProgress(n), finishTime: finished[n.id] ?? null, pace: n.speed }))
}

/** The results table when the player crosses the line, fastest first. Rivals still
 * racing get a projected time (shown with a +). */
export function finalStandings(playerTime, npcs, finished = {}) {
  return [{ id: 'player', progress: RACE_DISTANCE, finishTime: playerTime }, ...raceEntries(npcs, finished)]
    .map(e => ({ id: e.id, name: e.name || 'YOU', color: e.color || '#c8fa58', time: projectedTime(e, playerTime), projected: e.finishTime == null, player: e.id === 'player' }))
    .sort((a, b) => a.time - b.time)
}
