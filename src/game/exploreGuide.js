/** Where to go next in free roam: the nearest undiscovered district, then the nearest
 * relic still out there. Pure, so the minimap's pointer is covered by node tests. */
import { ZONES, RELICS } from './openWorld.js'

export const MINIMAP_RADIUS = 140 // metres from the player to the map's edge

function describe(pos, target, kind) {
  const dx = target.x - pos.x, dz = target.z - pos.z
  return { kind, id: target.id, name: target.name, icon: target.icon, color: target.color, x: target.x, z: target.z,
    distance: Math.hypot(dx, dz), bearing: Math.atan2(dx, -dz) }
}

export function nextTarget(pos, visited = [], collected = []) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return null
  const nearest = list => list.reduce((best, t) => {
    const d = Math.hypot(t.x - pos.x, t.z - pos.z)
    return !best || d < best.d ? { t, d } : best
  }, null)?.t
  const zone = nearest(ZONES.filter(z => !visited.includes(z.id)))
  if (zone) return describe(pos, zone, 'district')
  const relic = nearest(RELICS.filter(r => !collected.includes(r.id)))
  if (!relic) return null
  const home = ZONES.find(z => z.id === relic.zoneId)
  return describe(pos, { ...relic, name: `${home?.name || 'HIDDEN'} RELIC`, icon: '✧' }, 'relic')
}

/** Where a target sits on a north-up map of the given radius: inside, or pinned to the
 * rim (`edge`) along its bearing so the player knows which way to drive. */
export function mapMarker(pos, target, radius = MINIMAP_RADIUS, rim = .86) {
  const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz)
  if (d <= radius * rim) return { x: target.x, z: target.z, edge: false }
  const k = radius * rim / d
  return { x: pos.x + dx * k, z: pos.z + dz * k, edge: true }
}

export function formatDistance(metres) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres / 5) * 5} m`
}
