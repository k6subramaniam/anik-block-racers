import {test,expect} from '@playwright/test'
import {battleTrack} from '../src/battle/tracks.js'
import {aiInput} from '../src/battle/simulation.js'

async function ready(page,query='?view=battle'){
  await page.goto(`./${query}`)
  await expect(page.getByTestId('battle-start')).toBeEnabled({timeout:60_000})
  await expect(page.locator('canvas')).toHaveCount(1)
}

test('lap/weather settings persist across all five tracks, reload, pause and restart',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await ready(page,'?view=battle&laps=7&weather=snow')
  for(const id of ['blast','canyon','frost','skybridge','summit']){
    await page.getByTestId(`battle-track-${id}`).click()
    await expect(page.getByTestId('battle-game')).toHaveAttribute('data-track',id)
    await expect(page.getByTestId('battle-laps')).toHaveValue('7')
    await expect(page.getByTestId('battle-weather-select')).toHaveValue('snow')
  }
  await page.reload()
  await expect(page.getByTestId('battle-start')).toBeEnabled({timeout:30_000})
  await expect(page.getByTestId('battle-laps')).toHaveValue('7')
  await expect(page.getByTestId('battle-weather-select')).toHaveValue('snow')
  await page.screenshot({path:info.outputPath('multilevel-race-setup.png'),animations:'disabled'})
  await page.getByTestId('battle-start').click()
  await expect(page.getByTestId('battle-forward')).toBeVisible({timeout:15_000})
  await expect(page.getByTestId('battle-lap')).toHaveText('1/7')
  await expect(page.getByTestId('battle-weather')).toHaveText('SNOW')
  await page.getByTestId('battle-pause').click()
  await expect(page.getByTestId('battle-resume')).toBeVisible()
  const time=await page.getByTestId('battle-time').innerText()
  await page.waitForTimeout(800)
  await expect(page.getByTestId('battle-time')).toHaveText(time)
  await page.getByRole('button',{name:'RESTART RACE',exact:true}).click()
  await expect(page.getByTestId('battle-forward')).toBeVisible({timeout:15_000})
  await expect(page.getByTestId('battle-lap')).toHaveText('1/7')
  await expect(page.getByTestId('battle-weather')).toHaveText('SNOW')
  expect(errors).toEqual([])
})

test('actual keyboard driving reaches the bridge deck and finishes the selected one-lap race',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await ready(page,'?view=battle&track=skybridge&laps=1&weather=dynamic')
  await page.getByTestId('battle-start').click()
  await expect(page.getByTestId('battle-forward')).toBeVisible({timeout:15_000})
  const track=battleTrack('skybridge'),start=Date.now(),held=new Set()
  let maxHeight=0,captured=false
  try{
    while(Date.now()-start<150_000){
      if(await page.getByTestId('battle-game').getAttribute('data-phase')==='results')break
      // Only read exposed HUD telemetry; drive through real keyboard input.
      // No test-only teleport or mutation of game state is used.
      const actor=await page.getByTestId('battle-game').evaluate(n=>({
        id:'player',x:+n.dataset.playerX,y:+n.dataset.playerY,z:+n.dataset.playerZ,
        yaw:+n.dataset.playerYaw,speed:+n.dataset.speed,hp:100,respawn:0,topSpeed:27,lane:0,
      }))
      const cmd=aiInput(actor,track,{tick:0,actors:[actor]}),next=new Set()
      if(cmd.steer>.13)next.add('d')
      if(cmd.steer<-.13)next.add('a')
      if(actor.speed<cmd.speedLimit+.5)next.add('w')
      else if(actor.speed>cmd.speedLimit+2)next.add('s')
      for(const key of held)if(!next.has(key)){await page.keyboard.up(key);held.delete(key)}
      for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key)}
      maxHeight=Math.max(maxHeight,actor.y)
      if(maxHeight>20&&!captured){
        captured=true
        await page.screenshot({path:info.outputPath('multilevel-elevated-driving.png'),animations:'disabled'})
      }
      await page.waitForTimeout(85)
    }
  }finally{for(const key of held)await page.keyboard.up(key)}
  expect(maxHeight).toBeGreaterThan(20)
  await expect(page.getByTestId('battle-results')).toBeVisible({timeout:5000})
  await expect(page.getByTestId('battle-results')).toContainText('1 lap ·')
  await page.getByTestId('battle-next-level').click()
  await expect(page.getByTestId('battle-game')).toHaveAttribute('data-track','summit')
  await expect(page.getByTestId('battle-laps')).toHaveValue('1')
  await expect(page.getByTestId('battle-weather-select')).toHaveValue('dynamic')
  expect(errors).toEqual([])
})
