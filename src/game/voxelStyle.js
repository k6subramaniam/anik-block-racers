/** Original 16 x 16 pixel-art materials and deterministic lightweight voxel scenery.
 * No Minecraft/Mojang art or texture assets are used. Pure, Node-testable data.
 */
import { nearestRoad, ROAD_WIDTH } from './track.js'
import { LANDMARK_OBSTACLES, ZONES } from './openWorld.js'
import { WATER_BODIES } from './water.js'

export const PIXEL_SIZE = 16
export const VOXEL_TERRAIN = Object.freeze([
  { id: 'meadow', x: 0, z: 0, w: 312, h: 264, y: .040, color: '#548e36', type: 'grass' },
  { id: 'neon', x: 86, z: -58, w: 105, h: 113, y: .050, color: '#566e80', type: 'stone' },
  { id: 'crystal', x: -86, z: -58, w: 105, h: 113, y: .050, color: '#84bbbf', type: 'ice' },
  { id: 'canyon', x: -86, z: 66, w: 105, h: 105, y: .050, color: '#d7ad66', type: 'sand' },
  { id: 'ember', x: 86, z: 66, w: 105, h: 105, y: .050, color: '#72575b', type: 'basalt' },
  { id: 'grove', x: 0, z: -110, w: 56, h: 37, y: .058, color: '#50954b', type: 'leaves' },
  { id: 'blockhaven', x: -77, z: 0, w: 92, h: 94, y: .062, color: '#67ac47', type: 'grass' },
])

const PALETTES = Object.freeze({
  grass: [244, 218, 236, 254, 204, 228, 241, 219, 248],
  dirt: [214, 233, 246, 193, 221, 240, 207, 232],
  stone: [216, 232, 244, 200, 226, 251, 211, 238],
  cobble: [191, 234, 244, 210, 253, 226, 205, 239],
  road: [200, 236, 251, 213, 245, 224, 208, 237],
  oak: [197, 228, 251, 209, 238, 223, 211, 247],
  leaves: [185, 231, 250, 214, 240, 194, 227, 247],
  sand: [209, 236, 251, 218, 250, 226, 204, 241],
  ice: [206, 241, 254, 228, 249, 213, 245, 251],
  snow: [230, 251, 254, 240, 252, 245, 233, 249],
  basalt: [191, 231, 253, 216, 239, 199, 227, 245],
  brick: [185, 216, 243, 206, 232, 251, 196, 225],
  glass: [219, 245, 254, 233, 250, 225, 242, 255],
  glow: [221, 250, 255, 237, 250, 243, 255, 247],
  wool: [226, 243, 255, 233, 252, 246, 231, 249],
})
export const VOXEL_SURFACE_TYPES = Object.freeze(Object.keys(PALETTES))

function mixHash(x, y, seed) {
  let h = (Math.imul(x + 41, 374761393) ^ Math.imul(y + 17, 668265263) ^ Math.imul(seed + 77, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Opaque deterministic greyscale; tint with the model's own color.
 * Four-pixel motifs are deliberate so the pixel work stays visible on Samsung.
 */
export function pixelTileData(kind = 'stone', size = PIXEL_SIZE, seed = 1987) {
  if (!Number.isInteger(size) || size < 4 || size > 64) throw new RangeError('pixel tile size must be 4..64')
  const palette = PALETTES[kind] || PALETTES.stone
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const noise = mixHash(x, y, seed)
      let shade = palette[noise % palette.length]
      // Planks, cobblestones and roof shingles show crisp inset seams.
      if (kind === 'oak' && y % 5 === 0) shade = 162
      if (kind === 'brick' && (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0)) shade = 169
      if (kind === 'cobble' && (x % 5 === 0 || y % 5 === 0)) shade = 168
      if (kind === 'road' && (x % 7 === 0 && y % 5 !== 0)) shade = 181
      if (kind === 'glass' && (x % 7 === 0 || y % 7 === 0)) shade = 174
      if (kind === 'sand' && noise % 11 === 0) shade = 183
      if (kind === 'leaves' && noise % 9 === 0) shade = 143
      if (kind === 'basalt' && noise % 7 === 0) shade = 151
      const j = (y * size + x) * 4
      data[j] = shade
      data[j + 1] = shade
      data[j + 2] = shade
      data[j + 3] = 255
    }
  }
  return data
}

export function classifyVoxelSurface(materialName = '', meshName = '') {
  const mat = String(materialName).toLowerCase(), mesh = String(meshName).toLowerCase()
  const both = `${mat} ${mesh}`
  if (/windshield|window|visor|glass/.test(both)) return 'glass'
  if (/lava|magma|fire|glow|neon|rune|light|gold/.test(both)) return 'glow'
  if (/ice|snow|crystal|glacier|frost/.test(both)) return 'ice'
  if (/sand|canyon|desert|dune|wheat/.test(both)) return 'sand'
  if (/wood|oak|plank|timber|bark|trunk|log|fence|beam|door/.test(both)) return 'oak'
  if (/leaf|foliage|pine|crown|bush|grass|meadow|emerald|moss/.test(both)) return 'leaves'
  if (/roof|brick|clay|terracotta|rust/.test(both)) return 'brick'
  if (/road|charcoal|asphalt|track_main|curb|checker|start_arch/.test(both)) return 'road'
  if (/cobble|path|plaza|cobblestone/.test(both)) return 'cobble'
  if (/basalt|obsidian|ember|volcano|iron/.test(both)) return 'basalt'
  if (/ivory|white|helmet|wool|sheep|snowcap/.test(both)) return 'wool'
  return 'stone'
}

function rngFor(seed) {
  let state = seed >>> 0
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296 }
}

const CONNECTOR_SEGMENTS = Object.freeze([
  [[34,-14],[63,-29]], [[63,-29],[105,-53]],
  [[-33,-17],[-62,-36]], [[-62,-36],[-104,-60]],
  [[-32,16],[-64,32]], [[-64,32],[-105,73]],
  [[34,13],[65,31]], [[65,31],[105,75]],
  [[-3,-24],[-3,-66]], [[-3,-66],[-3,-104]],
])
function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)
}
export function isSafeVoxelSceneryPosition(x, z) {
  if (Math.abs(x) > 143 || Math.abs(z) > 118) return false
  // Keep canopies well clear of the four-lane road edge.
  if (nearestRoad({ x, z }).distance < ROAD_WIDTH / 2 + 5) return false
  if (WATER_BODIES.some(b => ((x - b.x) / (b.rx + 4)) ** 2 + ((z - b.z) / (b.rz + 4)) ** 2 < 1)) return false
  if (ZONES.some(t => Math.hypot(t.x - x, t.z - z) < t.radius * .78)) return false
  if (LANDMARK_OBSTACLES.some(o => Math.hypot(o.x - x, o.z - z) < (o.radius || 2) + 4)) return false
  if (CONNECTOR_SEGMENTS.some(([a,b]) => distanceToSegment(x, z, a, b) < 8)) return false
  // Blockhaven is a walkable town: leave room for pedestrians, farm and shops.
  if (x > -131 && x < -32 && z > -56 && z < 46) return false
  return true
}

export function generateVoxelScenery(count = 135, seed = 7391) {
  const r = rngFor(seed), trees = []
  for (let i = 0; i < 4000 && trees.length < count; i++) {
    const x = (r() - .5) * 284, z = (r() - .5) * 232
    if (!isSafeVoxelSceneryPosition(x, z)) continue
    if (trees.some(p => (p.x-x)**2 + (p.z-z)**2 < 33)) continue
    trees.push({ id: `voxel-oak-${trees.length}`, x: Math.round(x * 10) / 10,
      z: Math.round(z * 10) / 10, height: 3.3 + r() * 2.5,
      canopy: 3.2 + r() * 1.9, shade: r() > .48 ? 0 : 1, radius: .85 })
  }
  return trees
}
export const VOXEL_TREES = Object.freeze(generateVoxelScenery())

export function generateVoxelFlowers(count = 170, seed = 4105) {
  const r = rngFor(seed), flowers = []
  for (let i = 0; i < 2200 && flowers.length < count; i++) {
    const x = (r() - .5) * 279, z = (r() - .5) * 225
    if (!isSafeVoxelSceneryPosition(x,z)) continue
    flowers.push({x, z, color:Math.floor(r()*4), size:.5+r()*.75})
  }
  return flowers
}
export const VOXEL_FLOWERS = Object.freeze(generateVoxelFlowers())

/** Stepped dirt/grass edges near the far corners (away from the active track). */
export const VOXEL_HILLS = Object.freeze([
  [-139, -109], [139, -109], [-139, 108], [139, 109],
  [-140, -18], [140, 16], [-17, 115], [14, 115],
].flatMap(([x,z],h) => Array.from({length:9},(_,i)=>({
  x:x+(i%3-1)*3.2,z:z+(Math.floor(i/3)-1)*3.2,
  height:.65+(3-Math.max(Math.abs(i%3-1),Math.abs(Math.floor(i/3)-1)))*.72+(h%3)*.2,
}))));

export const VOXEL_TREE_COLLIDERS = Object.freeze(VOXEL_TREES.map(tree => ({ id: tree.id, x: tree.x, z: tree.z, radius: tree.radius })))
