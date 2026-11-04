import test from 'node:test'
import assert from 'node:assert/strict'
import {grandPrixShareText,grandPrixShareUrl} from '../game/shareResult.js'

test('winner share text leads with the win, the formatted time and the difficulty',()=>{
  const text=grandPrixShareText({position:1,fieldSize:8,time:272.5,difficulty:'normal'})
  assert.match(text,/won the ANIK Block Racers Grand Prix/)
  assert.match(text,/04:32\.50/)
  assert.match(text,/on NORMAL/)
  assert.match(text,/beat my time\?/)
})

test('non-winner share text states the place out of the field',()=>{
  const text=grandPrixShareText({position:3,fieldSize:8,time:301.5,difficulty:'hard'})
  assert.match(text,/finished 3RD of 8/)
  assert.match(text,/05:01\.50/)
  assert.match(text,/on HARD/)
})

test('unknown difficulty falls back to the NORMAL label',()=>{
  const text=grandPrixShareText({position:2,fieldSize:8,time:280,difficulty:'ludicrous'})
  assert.match(text,/on NORMAL/)
})

test('field size defaults to the eight-kart grid',()=>{
  const text=grandPrixShareText({position:5,time:290,difficulty:'easy'})
  assert.match(text,/finished 5TH of 8/)
})

test('share URL keeps origin and path but strips challenge codes and hashes',()=>{
  const url=grandPrixShareUrl('https://k6subramaniam.github.io/anik-block-racers/?challenge=ABC123&view=world#grid')
  assert.equal(url,'https://k6subramaniam.github.io/anik-block-racers/?view=world')
})

test('share URL leaves a plain game link untouched',()=>{
  assert.equal(grandPrixShareUrl('https://k6subramaniam.github.io/anik-block-racers/'),'https://k6subramaniam.github.io/anik-block-racers/')
})
