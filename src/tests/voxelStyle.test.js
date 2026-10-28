import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestRoad } from '../game/track.js'
import { WATER_BODIES,waterAt } from '../game/water.js'
import {
  PIXEL_SIZE, VOXEL_SURFACE_TYPES, VOXEL_TERRAIN, VOXEL_TREES, VOXEL_TREE_COLLIDERS,
  VOXEL_FLOWERS, VOXEL_HILLS, classifyVoxelSurface,
  pixelTileData, generateVoxelScenery, isSafeVoxelSceneryPosition,
} from '../game/voxelStyle.js'

test('original pixel materials are 16x16 deterministic opaque pixel art',()=>{
  for (const type of VOXEL_SURFACE_TYPES) {
    const t=pixelTileData(type)
    assert.equal(t.length,PIXEL_SIZE*PIXEL_SIZE*4,type)
    assert.ok(t.every((n,i)=>i%4!==3 || n===255),type)
    assert.ok(new Set(Array.from(t.filter((_,i)=>i%4===0))).size>3,type)
    assert.deepEqual(t,pixelTileData(type),`repeatable ${type}`)
  }
})
test('pixel patterns have visible geometry-like seams instead of smooth photo shading',()=>{
  const plank=pixelTileData('oak'),cobble=pixelTileData('cobble'),leaves=pixelTileData('leaves')
  assert.equal(plank[(0*PIXEL_SIZE+3)*4],162)
  assert.equal(cobble[(5*PIXEL_SIZE+3)*4],168)
  assert.notDeepEqual(leaves,pixelTileData('stone'))
})
test('voxel material classifier respects building materials and preserves lava and windows',()=>{
  assert.equal(classifyVoxelSurface('BLOCKHAVEN_dark_oak','house_beam'),'oak')
  assert.equal(classifyVoxelSurface('OW_neon_cyan','tower_light'),'glow')
  assert.equal(classifyVoxelSurface('MAT_road_charcoal','TRACK_main_road_ribbon'),'road')
  assert.equal(classifyVoxelSurface('BLOCKHAVEN_window','window_glass'),'glass')
  assert.equal(classifyVoxelSurface('OW_ice_crystal','gem'),'ice')
  assert.equal(classifyVoxelSurface('OW_basalt_charcoal','rock'),'road')
})
test('seven terrain palettes cover all districts and keep Blockhaven grassy',()=>{
  assert.equal(VOXEL_TERRAIN.length,7)
  assert.ok(VOXEL_TERRAIN.every(t=>t.w>35&&t.h>30&&t.y<.16))
  const unique=new Set(VOXEL_TERRAIN.map(t=>t.type))
  assert.ok(unique.size>=5)
  const village=VOXEL_TERRAIN.find(t=>t.id==='blockhaven')
  assert.ok(village&&village.type==='grass'&&village.y>.05)
})
test('133+ cubic trees are evenly spaced and outside the actual racing track',()=>{
  assert.ok(VOXEL_TREES.length>=130)
  assert.equal(VOXEL_TREES.length,VOXEL_TREE_COLLIDERS.length)
  for(const t of VOXEL_TREES){
    assert.equal(isSafeVoxelSceneryPosition(t.x,t.z),true)
    assert.ok(nearestRoad(t).distance>=10)
    assert.equal(waterAt(t),null)
    assert.ok(t.height>3&&t.canopy>3)
  }
  assert.deepEqual(generateVoxelScenery(),VOXEL_TREES)
})
test('flower clusters and terraced blocks stay bounded on land',()=>{
  assert.ok(VOXEL_FLOWERS.length>=150)
  assert.ok(VOXEL_HILLS.length>=65)
  assert.ok(VOXEL_FLOWERS.every(x=>isSafeVoxelSceneryPosition(x.x,x.z)))
  assert.ok(VOXEL_HILLS.every(x=>x.height>0&&Math.abs(x.x)<151&&Math.abs(x.z)<126))
})
test('all natural obstacles remain separate from the lakes and original NPC zones',()=>{
  for(const obstacle of VOXEL_TREE_COLLIDERS) {
    assert.ok(obstacle.radius>0&&obstacle.radius<2)
    for(const lake of WATER_BODIES) {
      const norm=((obstacle.x-lake.x)/(lake.rx+3))**2+((obstacle.z-lake.z)/(lake.rz+3))**2
      assert.ok(norm>1)
    }
  }
})
