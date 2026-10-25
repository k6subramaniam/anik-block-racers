import test from 'node:test'
import assert from 'node:assert/strict'
import { createHeldInput, getRenderBudget, recommendQuality, safeStoredQuality } from '../game/mobile.js'

test('modern Samsung phone gets balanced mobile rendering', () => {
  assert.equal(recommendQuality({coarse:true,memory:12,cores:8}), 'balanced')
  const tier=getRenderBudget('auto',{coarse:true,memory:12,cores:8})
  assert.equal(tier.tier,'balanced')
  assert.ok(tier.dpr<=1.1)
  assert.equal(tier.shadows,false)
})
test('entry-level phones default to eco graphics', () => {
  assert.equal(recommendQuality({coarse:true,memory:4,cores:8}),'eco')
  assert.equal(recommendQuality({coarse:true,memory:8,cores:4}),'eco')
  assert.equal(getRenderBudget('auto',{coarse:true,cores:4}).dpr,.8)
})
test('high graphics intentionally increases resolution and shadows',()=>{
  const high=getRenderBudget('high',{coarse:true})
  const eco=getRenderBudget('eco',{coarse:true})
  assert.ok(high.dpr > eco.dpr)
  assert.equal(high.shadows,true)
  assert.equal(eco.shadows,false)
})
test('quality preference rejects invalid saved values',()=>{
  assert.equal(safeStoredQuality('ultra'), 'auto')
  assert.equal(safeStoredQuality('high'), 'high')
  assert.equal(safeStoredQuality(null), 'auto')
})
test('multiple fingers remain pressed until each pointer releases',()=>{
  const inputRef={current:{forward:false}}
  const held=createHeldInput(inputRef,'forward')
  held.down(3);held.down(8)
  assert.equal(inputRef.current.forward,true)
  assert.equal(held.size,2)
  held.up(3)
  assert.equal(inputRef.current.forward,true)
  held.up(8)
  assert.equal(inputRef.current.forward,false)
  assert.equal(held.size,0)
})
test('pointer cancellation and backgrounding release controls',()=>{
  const inputRef={current:{left:false}}
  const held=createHeldInput(inputRef,'left')
  held.down(12)
  held.reset()
  assert.equal(inputRef.current.left,false)
  assert.equal(held.size,0)
})
test('desktop defaults to high graphics without reducing quality',()=>{
  const opts=getRenderBudget('auto',{coarse:false})
  assert.equal(opts.tier,'high')
  assert.equal(opts.antialias,true)
})

test('Galaxy world map labels keep the small compass graphic compact', async()=>{
  const {readFileSync}=await import('node:fs')
  const {join,resolve}=await import('node:path')
  const css=readFileSync(join(resolve(import.meta.dirname,'../..'),'src/styles.css'),'utf8')
  assert.ok(css.includes('.map-graphic > svg{width:100%'))
  assert.ok(css.includes('.map-graphic p svg{width:14px;height:14px'))
})
