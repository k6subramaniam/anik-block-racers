/** Browser-only sharing. Native shares run only from explicit button gestures. */
import {challengeTitle,makeChallengeUrl} from './rules.js'
export function saveBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove()
  setTimeout(()=>URL.revokeObjectURL(url),30_000)
}
export async function shareChallenge(result,base=location.href){
  const url=makeChallengeUrl(base,result.code,result.score)
  const text=`I scored ${result.score.toLocaleString()} in ANIK Bot Smash. Beat my 60-second run!`
  if(navigator.share){
    try{await navigator.share({title:'Beat my ANIK score',text,url});return {status:'shared',url}}
    catch(error){if(error.name==='AbortError')return {status:'cancelled',url}}
  }
  try{await navigator.clipboard.writeText(url);return {status:'copied',url}}
  catch{return {status:'manual',url}}
}
export async function shareFile(file,text){
  if(navigator.canShare?.({files:[file]})&&navigator.share){
    try{await navigator.share({files:[file],title:'ANIK Bot Smash Showdown',text});return 'shared'}
    catch(error){if(error.name==='AbortError')return 'cancelled'}
  }
  saveBlob(file,file.name);return 'downloaded'
}
function panel(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function text(ctx,copy,x,y,size,color='#ffffff',weight='700'){
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui, sans-serif`;ctx.fillText(copy,x,y)
}
function baseCard(ctx,result){
  panel(ctx,0,0,540,960,'#101c26');panel(ctx,0,0,540,10,'#c8fa58')
  for(let i=0;i<10;i++)panel(ctx,380+(i%3)*44,45+Math.floor(i/3)*42,34,34,i%2?'#1f4041':'#274846')
  text(ctx,'ANIK / BLOCK RACERS',32,56,19,'#c8fa58')
  text(ctx,'BOT SMASH',32,112,48);text(ctx,'SHOWDOWN',32,160,44,'#c8fa58')
  text(ctx,challengeTitle(result.code),32,199,17,'#c6d8d8','500')
  text(ctx,'CAN YOU BEAT',32,730,21,'#bad2d5')
  text(ctx,result.score.toLocaleString(),30,811,76,'#c8fa58')
  text(ctx,`${result.smashes} BOTS  ·  ${result.bestCombo}× COMBO  ·  ${result.jumps} JUMPS`,32,855,17)
  text(ctx,'60 seconds. One score. Your turn.',32,899,20)
  text(ctx,'Play the challenge link shared with this card.',32,931,13,'#9cb4bb','500')
}
export function paintPortrait(canvas,source,result,tag='ACTUAL GAMEPLAY REPLAY'){
  const ctx=canvas.getContext('2d');baseCard(ctx,result)
  const area={x:16,y:224,w:508,h:456}
  panel(ctx,area.x,area.y,area.w,area.h,'#233e43')
  if(source&&source.width>0&&source.height>0){
    // Crop around the centered chase camera, retaining the kart and runway.
    const aspect=area.w/area.h,sw=Math.min(source.width,source.height*aspect),sh=Math.min(source.height,source.width/aspect)
    ctx.drawImage(source,(source.width-sw)/2,(source.height-sh)/2,sw,sh,area.x,area.y,area.w,area.h)
  }
  panel(ctx,24,238,Math.min(470,tag.length*8+22),30,'#10232de6')
  text(ctx,tag,34,258,13,'#ffffff')
}
export function canvasBlob(canvas,type='image/png'){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image export is unavailable')),type))
}
export async function makeScoreCard(result,screenshot){
  const canvas=document.createElement('canvas');canvas.width=540;canvas.height=960
  let image
  if(screenshot){
    image=new Image();image.src=screenshot
    try{await image.decode()}catch{image=null}
  }
  paintPortrait(canvas,image,result,'MY 60-SECOND SCORE')
  const blob=await canvasBlob(canvas)
  return new File([blob],`anik-${result.code}-${result.score}.png`,{type:'image/png'})
}
export function supportedVideoType(){
  if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream)return null
  return ['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||null
}
/** Captures only this game's 3D canvas; never microphone, camera or desktop. */
export function beginClip(result){
  const mimeType=supportedVideoType()
  if(!mimeType)throw new Error('This browser cannot export video. Share the score card instead.')
  const canvas=document.createElement('canvas');canvas.width=540;canvas.height=960
  const stream=canvas.captureStream(24),chunks=[]
  let recorder
  try{recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:1_600_000})}
  catch(error){stream.getTracks().forEach(t=>t.stop());throw error}
  let settled=false,resolve,reject
  const promise=new Promise((a,b)=>{resolve=a;reject=b})
  const cleanup=()=>{stream.getTracks().forEach(t=>t.stop());clearTimeout(timeout)}
  const fail=error=>{if(settled)return;settled=true;cleanup();reject(error)}
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
  recorder.onerror=e=>fail(e.error||new Error('Video export failed'))
  recorder.onstop=()=>{
    if(settled)return
    settled=true;cleanup()
    const blob=new Blob(chunks,{type:recorder.mimeType||mimeType})
    if(!blob.size){reject(new Error('No video frames were recorded'));return}
    const ext=mimeType.includes('mp4')?'mp4':'webm'
    resolve(new File([blob],`anik-${result.code}-${result.score}.${ext}`,{type:blob.type}))
  }
  const timeout=setTimeout(()=>{
    if(recorder.state==='recording')recorder.stop()
    // Safety timeout must not be presented as a completed highlight.
    fail(new Error('Video export took too long. Try Eco graphics or share the score card.'))
  },45_000)
  try{recorder.start(250)}catch(error){settled=true;cleanup();throw error}
  return {
    promise,
    draw:source=>{if(!settled&&recorder.state==='recording')paintPortrait(canvas,source,result)},
    stop:()=>{if(recorder.state==='recording')recorder.stop()},
    cancel:()=>{fail(new Error('Video export cancelled'));if(recorder.state==='recording')recorder.stop()},
  }
}
