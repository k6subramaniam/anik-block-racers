import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
const projectRoot=resolve(import.meta.dirname, '../..')

test('Android PWA metadata and landscape orientation are configured',()=>{
  const manifest=JSON.parse(readFileSync(join(projectRoot,'public/manifest.webmanifest'),'utf8'))
  assert.match(manifest.name,/ANIK/)
  assert.equal(manifest.orientation,'landscape')
  assert.equal(manifest.display,'standalone')
  assert.equal(manifest.start_url,'./?source=pwa')
  assert.ok(manifest.icons.some(i=>i.sizes==='192x192'))
  assert.ok(manifest.icons.some(i=>i.sizes==='512x512' && i.purpose==='maskable'))
  const html=readFileSync(join(projectRoot,'index.html'),'utf8')
  assert.match(html, /rel="manifest"/)
  assert.match(html, /viewport-fit=cover/)
})
test('PWA launcher icons contain real PNG data',()=>{
  for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]) {
    const path=join(projectRoot,'public/icons',name)
    assert.ok(statSync(path).size>500)
    const header=readFileSync(path)
    assert.equal(header.subarray(1,4).toString(),'PNG')
    assert.equal(header.readUInt32BE(16),size)
    assert.equal(header.readUInt32BE(20),size)
  }
})
test('mobile controls, graphics chooser, offline registration, and visibility pause are wired',()=>{
  const app=readFileSync(join(projectRoot,'src/App.jsx'),'utf8')
  const world=readFileSync(join(projectRoot,'src/game/World.jsx'),'utf8')
  const worker=readFileSync(join(projectRoot,'scripts/generate-service-worker.mjs'),'utf8')
  for(const control of ['left','right','forward','backward','drift'])assert.ok(app.includes(`action="${control}"`))
  assert.match(app,/visibilitychange/)
  assert.match(app,/register\(`\$\{import\.meta\.env\.BASE_URL\}sw\.js`\)/)
  assert.match(app,/beforeinstallprompt/)
  assert.match(world,/dpr=\{budget\.dpr\}/)
  assert.match(worker,/const MODEL =/)
  assert.match(worker,/PRECACHE/)
})

test('offline caching is scoped to ANIK and revised when build assets change',()=>{
  const workerSource=readFileSync(join(projectRoot,'scripts/generate-service-worker.mjs'),'utf8')
  assert.match(workerSource,/createHash\('sha256'\)/)
  assert.match(workerSource,/fingerprint\.update\(await readFile/)
  assert.match(workerSource,/key\.startsWith\(CACHE_PREFIX\)/)
  assert.match(workerSource,/url\.href !== MODEL/)
  assert.doesNotMatch(workerSource,/keys\.filter\(key => !\[SHELL, GAME_ASSETS\]/)
})
