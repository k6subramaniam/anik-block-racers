import React,{useMemo,useState} from 'react'
import {newBlueprint,validateBlueprint,encodeBlueprint,decodeBlueprint,saveBlueprint,readBlueprints,makeShareUrl,editPoint,MIN_NODES,MAX_NODES} from './builder.js'
export default function TrackEditor({value,onUse,onClose}){
  const [draft,setDraft]=useState(()=>value||readBlueprints()[0]||newBlueprint())
  const [selected,setSelected]=useState(0),[drag,setDrag]=useState(false),[status,setStatus]=useState('')
  const [code,setCode]=useState('')
  const valid=useMemo(()=>validateBlueprint(draft),[draft])
  const points=draft.points||[]
  const poly=points.map(p=>`${p[0]},${p[1]}`).join(' ')
  const update=(patch)=>setDraft(old=>({...old,...patch}))
  const setPoint=(x,y)=>{
    const edit=editPoint(draft,selected,{'0':x,'1':y})
    if(edit)setDraft(edit)
  }
  const pointFromEvent=e=>{
    const svg=e.currentTarget,point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY
    const transformed=svg.getScreenCTM()?.inverse();if(!transformed)return null
    const v=point.matrixTransform(transformed);return {x:Math.round(v.x),z:Math.round(v.y)}
  }
  const save=()=>{if(saveBlueprint(draft)){setStatus('Saved on this device.');return true}setStatus('Track invalid or local storage unavailable.');return false}
  const launch=()=>{if(!valid){setStatus('Add 6–20 spaced nodes forming a full circuit.');return}save();onUse(valid)}
  const share=async()=>{
    if(!valid)return setStatus('Complete a valid track first.')
    const url=makeShareUrl(location.href,valid)
    try{if(navigator.share){await navigator.share({title:`ANIK: ${valid.name}`,url});setStatus('Shared track invitation.');return}}
    catch(e){if(e.name==='AbortError')return}
    try{await navigator.clipboard.writeText(url);setStatus('Track link copied. Send it to a friend!')}
    catch{setCode(url);setStatus('Copy the track link below.')}
  }
  const importCode=()=>{const text=code.trim(),candidate=decodeBlueprint(text)||decodeBlueprint(new URL(text,location.href).searchParams.get('trackcode'))
    if(candidate){setDraft(candidate);setSelected(0);setStatus('Shared track loaded. Press Test Drive to race it.')}
    else setStatus('Invalid share code or track link.')
  }
  return <div className="studio-overlay"><section className="studio-panel studio-editor" role="dialog" aria-modal="true" aria-label="Voxel track builder">
    <div className="studio-top"><div><small>ANIK CREATOR STUDIO</small><h2>BUILD YOUR TRACK</h2></div><button onClick={onClose} aria-label="Close track builder">✕</button></div>
    <p>Drag a waypoint to shape your circuit. Set heights to build bridges and climbs. Tracks use the full race physics, weather, hazards and laps.</p>
    <div className="studio-builder-layout"><svg viewBox="-150 -150 300 300" className="studio-editor-map" data-testid="studio-editor-map" role="img" aria-label="Editable top-down track map"
      onPointerMove={e=>{if(!drag)return;const p=pointFromEvent(e);if(p)setPoint(p.x,p.z)}} onPointerUp={()=>setDrag(false)} onPointerCancel={()=>setDrag(false)} onLostPointerCapture={()=>setDrag(false)}>
      <defs><pattern id="studio-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#85a3a4" strokeOpacity=".24" strokeWidth="1"/></pattern></defs>
      <rect x="-150" y="-150" width="300" height="300" fill="#182d35"/><rect x="-150" y="-150" width="300" height="300" fill="url(#studio-grid)"/>
      <polygon points={poly} fill="none" stroke="#0a2028" strokeWidth={draft.width+5} strokeLinejoin="round"/>
      <polygon points={poly} fill="none" stroke="#98ecba" strokeWidth={draft.width} strokeLinejoin="round"/>
      <polygon points={poly} fill="none" stroke="#eef9d4" strokeWidth=".7" strokeDasharray="3 5"/>
      {points.map((p,i)=><g key={i} transform={`translate(${p[0]} ${p[1]})`}>
        <circle r="13" fill="transparent" stroke="transparent" aria-label={`Move waypoint ${i+1}`} onPointerDown={e=>{e.stopPropagation();setSelected(i);setDrag(true);e.currentTarget.setPointerCapture(e.pointerId)}}/>
        <circle r={i===selected?6:4} pointerEvents="none" stroke={i===selected?'#ffcd76':'#11252d'} strokeWidth="2" fill={i===0?'#f1fc90':p[2]>0?'#d6a5fb':'#7ce5f6'}/>
        {i===selected&&<text y="-10" fill="white" textAnchor="middle" fontSize="9">{i+1} · {p[2]}m</text>}
      </g>)}
    </svg>
    <div className="studio-editor-tools">
      <label>TRACK NAME<input data-testid="studio-track-name" maxLength={28} value={draft.name} onChange={e=>update({name:e.target.value})}/></label>
      <label>BIOME<select value={draft.theme} onChange={e=>update({theme:e.target.value})}>{['forest','desert','snow','neon'].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label>
      <label>ROAD WIDTH<input type="range" min={10} max={17} step={1} value={draft.width} onChange={e=>update({width:Number(e.target.value)})}/><span>{draft.width} m</span></label>
      <label>SELECTED HEIGHT<input data-testid="studio-height" type="range" min={0} max={36} step={2} value={points[selected]?.[2]||0} onChange={e=>{const next=editPoint(draft,selected,{'2':Number(e.target.value)});if(next)setDraft(next)}}/><span>{points[selected]?.[2]||0} m</span></label>
      <div className="studio-buttons"><button disabled={points.length>=MAX_NODES} onClick={()=>{const a=points[selected],b=points[(selected+1)%points.length],next=[...points];next.splice(selected+1,0,[Math.round((a[0]+b[0])/2),Math.round((a[1]+b[1])/2),Math.round((a[2]+b[2])/2)]);setDraft({...draft,points:next});setSelected(selected+1)}}>+ WAYPOINT</button><button disabled={points.length<=MIN_NODES} onClick={()=>{setDraft({...draft,points:points.filter((_,i)=>i!==selected)});setSelected(0)}}>− WAYPOINT</button></div>
      <div className="studio-buttons"><button onClick={()=>{setDraft(newBlueprint());setSelected(0)}}>RESET</button><button onClick={save} disabled={!valid}>SAVE TRACK</button></div>
    </div></div>
    <div className="studio-buttons studio-main-actions"><button className="studio-primary" data-testid="studio-test-track" disabled={!valid} onClick={launch}>▶ TEST DRIVE TRACK</button><button onClick={share} disabled={!valid}>↗ SHARE TRACK</button></div>
    <details><summary>Import a friend's track code or link</summary><div className="studio-import"><textarea aria-label="Shared track code or link" value={code} rows={2} onChange={e=>setCode(e.target.value)} placeholder="Paste vc1_ code or link"/><button onClick={importCode}>IMPORT</button></div></details>
    {status&&<div className="studio-status" role="status">{status}</div>}
    <small>Saved tracks and designs remain on this device unless you share a code. No account is required.</small>
  </section></div>
}
