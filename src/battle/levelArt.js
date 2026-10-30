import { atDistance, nearestOnTrack } from './tracks.js'

// Original, procedurally built voxel art inspired by five reference environments.
// IDs and physical tracks are unchanged, preserving race and multiplayer rules.
export const LEVEL_ART = Object.freeze({
  blast: {
    name: 'BLOCK KART GRAND PRIX', scene: 'Classic kart stadium',
    detail: 'Checkered paddocks, grandstands, tire walls and voxel crowds',
    road: '#65717c', ground: '#6e9b61', sky: '#a8d5e6',
    curbs: ['#e94e49', '#f7f9ef'],
  },
  canyon: {
    name: 'AUTUMN CANYON RALLY', scene: 'Autumn kart festival',
    detail: 'Amber forests, hay bales, wooden pit barns and stone mesas',
    road: '#897871', ground: '#a87957', sky: '#d2b6a5',
    curbs: ['#d9594d', '#fff0db'],
  },
  frost: {
    name: 'ALPINE LIGHTHOUSE RUN', scene: 'Snowy mountain coast',
    detail: 'Giant stepped ice peaks, lighthouses and snow-covered pines',
    road: '#a1c4d4', ground: '#c6e1e7', sky: '#a2c8e3',
    curbs: ['#d75d5a', '#f1fcff'],
  },
  skybridge: {
    name: 'RAINBOW SKYBRIDGE', scene: 'Rainbow block city',
    detail: 'Purple towers, rainbow curbs, overhead arches and floating roads',
    road: '#47475f', ground: '#8170a1', sky: '#b6b8e5',
    curbs: ['#f34d79', '#ffaf44', '#ffe256', '#6ce887', '#4bd7f3', '#7366ec', '#ec69e6'],
  },
  summit: {
    name: 'NEON NITRO SKYWAY', scene: 'Cyber-desert night race',
    detail: 'Glowing elevated roads, neon skyline, mesas and cactus fields',
    road: '#34334f', ground: '#ad745b', sky: '#21183d',
    curbs: ['#43e9f7', '#fe70d5', '#ffcc62'],
  },
})

const RAINBOW = ['#f34d79', '#ffb35c', '#ffe66d', '#7beb9b', '#62dcfc', '#8375ff', '#e76ce5']
const AUTUMN = ['#e89538', '#c55b39', '#f0b34d', '#ba6d32', '#e1773d']

function seeded(id) {
  let n = 2166136261
  for (const ch of id) n = Math.imul(n ^ ch.charCodeAt(0), 16777619) >>> 0
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296 }
}

export function makeLevelScenery(track, tier = 'balanced') {
  const art = LEVEL_ART[track.id]
  if (!art) return { solid: [], glow: [], theme: null }
  const rand = seeded(track.id)
  const density = tier === 'eco' ? .52 : tier === 'high' ? 1.12 : 1
  const solid = [], glow = []
  const block = (x, y, z, w, h, d, color, yaw = 0, luminous = false) => {
    if (![x, y, z, w, h, d, yaw].every(Number.isFinite) || w <= 0 || h <= 0 || d <= 0) return
    ;(luminous ? glow : solid).push({ x, y, z, w, h, d, color, yaw })
  }
  const safe = (x, z, radius = 5) => nearestOnTrack(track, { x, z }).distance > track.width / 2 + radius + 5
  const ring = (index, total, radius, phase = 0) => {
    const a = (index + phase) * Math.PI * 2 / total
    return { x: Math.cos(a) * radius, z: Math.sin(a) * radius, a }
  }
  const arch = (ratio, colors, height = 8.5) => {
    const base = atDistance(track, track.length * ratio)
    const spread = track.width / 2 + 2.2
    for (const side of [-1, 1]) {
      const p = atDistance(track, track.length * ratio, side * spread)
      block(p.x, p.y + height / 2, p.z, 1.2, height, 1.2, colors[0], base.yaw)
      block(p.x, p.y + height - .8, p.z, 1.5, .65, 1.5, colors[1] || colors[0], base.yaw, true)
    }
    for (let i = 0; i < colors.length; i++) {
      const lane = ((i + .5) / colors.length * 2 - 1) * spread
      const p = atDistance(track, track.length * ratio, lane)
      block(p.x, p.y + height, p.z, spread * 2 / colors.length + .05, .75, 1.6, colors[i], base.yaw, true)
    }
  }

  if (track.id === 'blast') {
    // Photo reference 4: racing paddock, grandstands, kart garages and crowds.
    for (const side of [-1, 1]) {
      const x = side * 120
      for (let step = 0; step < 4; step++) {
        block(x + side * step * 2.6, step * 1.2 + .75, 0, 5, 1.5 + step * .65, 80, step % 2 ? '#c6d5d1' : '#344751')
        for (let i = 0; i < 13 * density; i++) {
          const z = -36 + i * 5.7
          block(x + side * (step * 2.6 - .5), step * 1.8 + 1.9, z, 1.15, 1.5, 1.3, RAINBOW[(i + step * 3) % RAINBOW.length])
        }
      }
      for (let z = -65; z <= 65; z += 26) {
        block(x + side * 18, 2, z, 11, 4, 17, '#dfe6de')
        block(x + side * 18, 4.5, z, 13, 1, 18, '#dc614d')
        block(x + side * 13, 2, z, .5, 3, 9, '#203640')
      }
    }
    for (let i = 0; i < 26 * density; i++) {
      const p = ring(i, 26 * density, 99 + 18 * rand())
      if (!safe(p.x, p.z, 6)) continue
      for (let k = 0; k < 3; k++) block(p.x, .45 + k * .7, p.z, 2.3, .7, 2.3, '#2b3338')
    }
    for (const x of [-105, 105]) for (const z of [-70, 70]) {
      block(x, 5.5, z, 1.2, 11, 1.2, '#c8e2e4')
      block(x, 11.5, z, 5, 1.5, 5, '#ddfaff', 0, true)
    }
    arch(.02, ['#f9f4dd', '#e74b46', '#f9f4dd', '#e74b46', '#f9f4dd'], 9)
  }

  if (track.id === 'canyon') {
    // Photo reference 3: autumn voxel festival, wooden buildings and hay.
    const count = Math.round(49 * density)
    for (let i = 0; i < count; i++) {
      const p = ring(i, count, 123 + rand() * 41, .23)
      if (!safe(p.x, p.z, 7)) continue
      const height = 5 + rand() * 5
      block(p.x, height / 2, p.z, 1.6, height, 1.6, '#795238')
      block(p.x, height + 2.1, p.z, 6.3, 4.4, 6.3, AUTUMN[i % AUTUMN.length])
      block(p.x, height + 4.6, p.z, 4.3, 2.4, 4.3, AUTUMN[(i + 2) % AUTUMN.length])
    }
    for (let i = 0; i < 34 * density; i++) {
      const p = ring(i, 34 * density, 114 + rand() * 24, .56)
      if (!safe(p.x, p.z, 4)) continue
      block(p.x, 1.5, p.z, 4, 3, 2.7, '#d7a33e')
      block(p.x, 2.5, p.z, 4.4, .2, 2.9, '#8a5732')
    }
    for (const x of [-143, 145]) for (const z of [-54, 48]) {
      block(x, 6, z, 16, 12, 18, '#89533a')
      block(x, 13, z, 19, 3, 21, '#d76a43')
      block(x, 5.7, z + 9.2, 6, 7.5, .5, '#f7ce87')
    }
    for (let i = 0; i < 7; i++) {
      const p = ring(i, 7, 192)
      block(p.x, 6, p.z, 34, 12, 36, '#85655b')
      block(p.x, 16, p.z, 24, 8, 25, '#ad7d64')
    }
    arch(.18, ['#ffd870', '#e97f4d', '#ffe1a2'], 9)
  }

  if (track.id === 'frost') {
    // Photo reference 1: snowy peaks, tall pines and beacon lighthouses.
    for (const [x, z, scale] of [[-181, -144, 1], [178, -136, 1.23], [190, 124, 1.08], [-175, 121, .92]]) {
      const layers = [[64, 11], [51, 12], [38, 13], [26, 13], [15, 13], [7, 12]]
      let altitude = 0
      for (const [width, height] of layers) {
        block(x, altitude + height * scale / 2, z, width * scale, height * scale, width * scale,
          altitude > 20 ? '#f7fcff' : altitude > 8 ? '#d8eef0' : '#8ea5b1')
        altitude += height * scale
      }
    }
    const count = Math.round(58 * density)
    for (let i = 0; i < count; i++) {
      const p = ring(i, count, 111 + rand() * 45, .36)
      if (!safe(p.x, p.z, 6)) continue
      const h = 7 + rand() * 6
      block(p.x, h / 2, p.z, 1.6, h, 1.6, '#5e666b')
      block(p.x, h + 2.2, p.z, 7, 5, 7, '#2e6865')
      block(p.x, h + 4.8, p.z, 5.2, 4.8, 5.2, '#3a8373')
      block(p.x, h + 7.2, p.z, 2.9, 3.8, 2.9, '#f8ffff')
    }
    for (const [x, z, red] of [[-123, 104, false], [126, -110, true]]) {
      block(x, 6, z, 24, 12, 24, '#687480')
      for (let level = 0; level < 8; level++) {
        block(x, 15 + level * 4, z, 7.3 - level * .25, 4, 7.3 - level * .25,
          red ? level % 2 ? '#fff7ec' : '#d35154' : level % 2 ? '#effbff' : '#ffffff')
      }
      block(x, 48, z, 9, 3, 9, '#f0ba65')
      block(x, 50.8, z, 8, 2.4, 8, '#345569')
      for (const side of [-1, 1]) {
        block(x + side * 4.2, 49, z, .8, 2.6, 2.5, '#ffe29b', 0, true)
      }
      block(x, 53.1, z, 10.5, 2, 10.5, '#dbb84f')
    }
    arch(.19, ['#fff7f3', '#e26459', '#fff7f3'], 9.5)
  }

  if (track.id === 'skybridge') {
    // Photo reference 2: purple block town and the rainbow highway.
    const count = Math.round(32 * density)
    for (let i = 0; i < count; i++) {
      const p = ring(i, count, 130 + rand() * 51, .25)
      if (!safe(p.x, p.z, 14)) continue
      const height = 15 + 36 * rand()
      block(p.x, height / 2, p.z, 10 + rand() * 8, height, 10 + rand() * 6,
        i % 4 ? '#634080' : '#81539a')
      block(p.x, height + 1.3, p.z, 10, 2.6, 10, '#e1d3e9')
      for (let floor = 0; floor < 4; floor++) {
        const y = 5 + floor * (height - 5) / 4
        block(p.x + 5.2, y, p.z, .22, 1.4, 2.2, RAINBOW[(i + floor) % RAINBOW.length], 0, true)
      }
    }
    for (const s of [.1, .38, .68]) arch(s, RAINBOW, 10.5)
    const stride = tier === 'eco' ? 11 : 6.5
    for (let s = 0; s < track.length; s += stride) {
      for (const side of [-1, 1]) {
        const p = atDistance(track, s, side * (track.width / 2 - .7))
        block(p.x, p.y + .11, p.z, .65, .07, stride * .65, RAINBOW[Math.floor(s / stride) % RAINBOW.length], p.yaw, true)
      }
    }
    for (const [x, z] of [[-190, 0], [190, 0]]) {
      block(x, 8, z, 32, 16, 28, '#3e315f')
      block(x, 17, z, 34, 2, 31, '#a66bc0')
    }
  }

  if (track.id === 'summit') {
    // Photo reference 5: dark cyber-city, desert mesas and glowing sky lanes.
    for (let i = 0; i < 11; i++) {
      const p = ring(i, 11, 177 + rand() * 27, .4)
      const h = 11 + rand() * 16
      block(p.x, h / 2, p.z, 19, h, 18, '#bb7656')
      block(p.x, h + 3, p.z, 29, 6, 25, '#dd9963')
    }
    for (let i = 0; i < 20; i++) {
      const z = -157 + i * 16
      const x = -190 + rand() * 29
      const h = 19 + rand() * 58
      block(x, h / 2, z, 10 + rand() * 7, h, 10 + rand() * 7, i % 3 ? '#25355f' : '#6d3d79')
      block(x, h + 1, z, 12, 2, 12, i % 2 ? '#4ee8ff' : '#f577d6', 0, true)
      for (let floor = 0; floor < 5; floor++) {
        block(x + 6.2, 4 + floor * h / 5, z, .4, .7, 5, floor % 2 ? '#41d9fc' : '#f48bd8', 0, true)
      }
    }
    const cacti = Math.round(27 * density)
    for (let i = 0; i < cacti; i++) {
      const p = ring(i, cacti, 121 + rand() * 50, .14)
      if (!safe(p.x, p.z, 5)) continue
      const h = 5 + rand() * 5
      block(p.x, h / 2, p.z, 2, h, 2, '#4c915f')
      block(p.x + 2.2, h * .55, p.z, 4.5, 1.5, 1.6, '#42966b')
      block(p.x + 4.1, h * .72, p.z, 1.4, 3.6, 1.4, '#42966b')
    }
    for (const s of [.12, .43, .74]) arch(s, ['#58ebff', '#f06cb8', '#ffdc81', '#58ebff'], 10.5)
    const stride = tier === 'eco' ? 10 : 5.5
    for (let s = 0; s < track.length; s += stride) {
      for (const side of [-1, 1]) {
        const p = atDistance(track, s, side * (track.width / 2 - .95))
        block(p.x, p.y + .12, p.z, .38, .07, stride * .7, side > 0 ? '#45eeff' : '#ff78c7', p.yaw, true)
      }
    }
    for (let i = 0; i < 35 * density; i++) {
      const x = (rand() - .5) * 350, z = (rand() - .5) * 330
      block(x, 105 + rand() * 45, z, .3, .3, .3, '#c6caff', 0, true)
    }
  }

  return { solid, glow, theme: art }
}
