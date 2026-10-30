import test from 'node:test'
import assert from 'node:assert/strict'
import { BATTLE_TRACKS, battleTrack } from '../battle/tracks.js'
import { LEVEL_ART, makeLevelScenery } from '../battle/levelArt.js'

test('all five playable circuits have distinct reference-inspired environments', () => {
  const names = new Set()
  const colorSets = new Set()
  assert.equal(BATTLE_TRACKS.length, 5)
  for (const t of BATTLE_TRACKS) {
    const theme = LEVEL_ART[t.id]
    assert.ok(theme, 'missing art for ' + t.id)
    assert.ok(theme.name.length > 8)
    names.add(theme.name)
    colorSets.add(theme.curbs.join(','))
    const geometry = makeLevelScenery(battleTrack(t.id), 'balanced')
    assert.ok(geometry.solid.length > 50, t.id)
    assert.ok(geometry.glow.length > 0, t.id)
    assert.deepEqual(geometry.theme, theme)
    for (const p of [...geometry.solid, ...geometry.glow]) {
      assert.ok([p.x,p.y,p.z,p.w,p.h,p.d,p.yaw].every(Number.isFinite), t.id)
      assert.ok(p.w > 0 && p.h > 0 && p.d > 0, t.id)
      assert.match(p.color, /^#[\da-f]{6}$/i)
    }
  }
  assert.equal(names.size, 5)
  assert.equal(colorSets.size, 5)
})

test('eco graphics emits fewer objects without changing race physics or track data', () => {
  for (const spec of BATTLE_TRACKS) {
    const track = battleTrack(spec.id), length = track.length
    const eco = makeLevelScenery(track, 'eco')
    const high = makeLevelScenery(track, 'high')
    assert.ok(eco.solid.length + eco.glow.length <= high.solid.length + high.glow.length, spec.id)
    assert.equal(track.length, length)
    assert.equal(track.gates.length, 8)
    assert.equal(track.repairs.length, 2)
  }
})

test('recognizable 3D signatures exist in snow, rainbow and neon levels', () => {
  const alpine = makeLevelScenery(battleTrack('frost'), 'balanced')
  const rainbow = makeLevelScenery(battleTrack('skybridge'), 'balanced')
  const neon = makeLevelScenery(battleTrack('summit'), 'balanced')
  assert.ok(alpine.solid.some(p => p.y + p.h / 2 > 55), 'snowy mountain peaks')
  assert.ok(alpine.glow.some(p => p.color === '#ffe29b'), 'lighthouse lamps')
  assert.ok(rainbow.glow.length > 90, 'rainbow road light panels')
  assert.ok(new Set(rainbow.glow.map(p => p.color)).size >= 7, 'seven stripe colors')
  assert.ok(neon.glow.length > 100, 'neon roadside strips and skyscraper lighting')
  assert.ok(neon.solid.some(p => p.h > 40), 'night-city towers')
})

test('custom builder tracks retain their existing unthemed scenery fallback', () => {
  const custom = {...battleTrack('blast'), id:'custom'}
  const geometry = makeLevelScenery(custom)
  assert.equal(geometry.theme, null)
  assert.equal(geometry.solid.length, 0)
  assert.equal(geometry.glow.length, 0)
})
