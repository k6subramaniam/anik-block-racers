import {defineConfig} from '@playwright/test'
export default defineConfig({
 testDir:'./e2e',timeout:240_000,fullyParallel:false,workers:1,retries:0,
 reporter:[['list']],outputDir:'test-results',
 use:{
  baseURL:'http://127.0.0.1:4173/anik-block-racers/',headless:true,
  viewport:{width:915,height:412},isMobile:true,hasTouch:true,deviceScaleFactor:1,
  screenshot:'only-on-failure',trace:'retain-on-failure',
  launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']},
 },
 webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173/anik-block-racers/',reuseExistingServer:!process.env.CI,timeout:30_000},
})
