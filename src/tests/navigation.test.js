import test from 'node:test'
import assert from 'node:assert/strict'
import {viewFromSearch,urlForView} from '../home/navigation.js'

test('old links keep opening their modes; everything else lands home',()=>{
  assert.equal(viewFromSearch(''),'home')
  assert.equal(viewFromSearch('?utm=x'),'home')
  assert.equal(viewFromSearch('?challenge=sd2-d20261028&score=5'),'showdown')
  assert.equal(viewFromSearch('?source=shortcut-showdown'),'showdown')
  assert.equal(viewFromSearch('?view=showdown'),'showdown')
  assert.equal(viewFromSearch('?view=battle&invite=1'),'battle')
  for(const q of ['?view=world','?source=shortcut','?source=shortcut-explore'])assert.equal(viewFromSearch(q),'world')
})

test('mode URLs round-trip and carry their options',()=>{
  const base='https://example.test/anik-block-racers/?view=battle#room'
  for(const view of ['home','showdown','world','battle'])assert.equal(viewFromSearch(new URL(urlForView(base,view)).search),view)
  assert.equal(urlForView(base,'home'),'https://example.test/anik-block-racers/')
  assert.match(urlForView(base,'world',{explore:true}),/source=shortcut-explore/)
  assert.match(urlForView(base,'battle',{invite:true}),/invite=1#room$/)
  const smash=new URL(urlForView(base,'showdown',{challenge:'sd2-d20261028',score:250}))
  assert.equal(smash.searchParams.get('challenge'),'sd2-d20261028');assert.equal(smash.searchParams.get('score'),'250')
  assert.equal(new URL(urlForView(base,'showdown',{challenge:'sd2-d20261028',score:null})).searchParams.has('score'),false)
})
