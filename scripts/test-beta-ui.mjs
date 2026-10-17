import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const phase=process.env.UI_PHASE||'after'
const origin=phase==='before'?'http://127.0.0.1:4178':'http://127.0.0.1:4179'
const out='../../outputs/ot04/'+phase
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext({viewport:{width:390,height:844}})
const page=await ctx.newPage()
const issues=[],errors=[]
page.on('pageerror',e=>errors.push(e.message))
const widths=[320,375,390,430,768,1280]
async function modules(){await page.evaluate(async()=>{window.qa={...(await import('/src/db/database.ts')),...(await import('/src/features/training/trainingService.ts')),...(await import('/src/features/training/trainingEditorService.ts')),...(await import('/src/services/backupService.ts'))}})}
async function shots(name){
  for(const width of widths){
    await page.setViewportSize({width,height:width>=768?960:844})
    await page.evaluate(()=>scrollTo(0,0))
    await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true})
    const checks=await page.evaluate(()=>{
      const visible=el=>!!(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
      const buttons=[...document.querySelectorAll('button')].filter(visible)
      const badButtons=buttons.filter(el=>{const b=el.getBoundingClientRect();return b.width<43.5||b.height<43.5||b.left<-.5||b.right>innerWidth+.5}).map(el=>el.textContent.trim())
      const smallInputs=[...document.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(visible).filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.getAttribute('aria-label')||el.type)
      const settings=document.querySelector('.fenix-settings-access')?.getBoundingClientRect()
      const header=[...document.querySelectorAll('main h1')].find(visible)?.getBoundingClientRect()
      const overlap=settings&&header&&settings.left<header.right&&settings.right>header.left&&settings.top<header.bottom&&settings.bottom>header.top
      return {overflow:document.documentElement.scrollWidth>innerWidth,badButtons,smallInputs,settingsOverlap:!!overlap}
    })
    if(checks.overflow||checks.badButtons.length||checks.smallInputs.length||checks.settingsOverlap)issues.push({name,width,...checks})
  }
  await page.setViewportSize({width:390,height:844})
  console.log('CAPTURE',phase,name)
}
async function training(){await page.getByRole('button',{name:'Training',exact:true}).click();await page.getByRole('heading',{name:'TRAINING',exact:true}).waitFor()}
try{
 await page.goto(origin);await page.getByRole('heading',{name:'HOME',exact:true}).waitFor();await modules()
 await shots('home-empty');await training();await shots('training-empty')
 // Real service fixtures on both candidates, identical definitions and dates.
 await page.evaluate(async()=>{
   const q=window.qa
   for(const [id,name] of [['a','Press con mancuernas en banco inclinado'],['b','Remo con mancuerna y apoyo en banco']])await q.saveCustomExercise('custom-exercise-ui-'+id,null,{name,primaryMuscle:'Tren superior',equipment:'Mancuernas',exerciseType:'compound',techniqueNotes:'Controla el movimiento y mantén una postura estable.'})
   const draft={name:'Sesión de fuerza · prueba visual',type:'upper',description:'Dos ejercicios para trabajar con calma, registrar cada serie y revisar la progresión.',estimatedDurationMinutes:35,isFormalStrength:true}
   const items=['a','b'].map((id,i)=>({id:'ui-item-'+id,version:null,exerciseId:'custom-exercise-ui-'+id,targetSets:2,minReps:8,maxReps:12,targetRirMin:1,targetRirMax:3,restSeconds:60}))
   await q.saveRoutineDefinition('ui-routine',null,draft,items,[])
   await q.saveRoutineDefinition('ui-routine',1,{...draft,description:draft.description+' Datos sintéticos.'},items.map(i=>({...i,version:1})),items.map(i=>({id:i.id,version:1})))
   await q.planWorkout('ui-plan','ui-routine',2,q.getLocalDateKey())
   await q.planWorkout('ui-plan-second','ui-routine',2,q.getLocalDateKey())
 })
 await page.reload();await page.getByRole('heading',{name:'HOME',exact:true}).waitFor();await modules()
 await page.getByRole('button',{name:'Iniciar día',exact:true}).click()
 await page.locator('.today-current-block').waitFor();await shots('home')
 await training();await shots('training')
 for(const [tab,name,ready] of [['Rutinas','routines','.training-routine-card'],['Ejercicios','exercises','.training-catalog-card'],['Historial','history-empty','.training-empty-card']]){
   await page.getByRole('button',{name:tab,exact:true}).click();await page.locator(ready).first().waitFor();await shots(name)
 }
 await page.getByRole('button',{name:'Rutinas',exact:true}).click()
 await page.getByRole('button',{name:'Crear rutina',exact:true}).click();await page.getByRole('heading',{name:'Crear rutina'}).waitFor();await shots('routine-form')
 await page.getByRole('button',{name:'Cerrar editor',exact:true}).click()
 await page.getByRole('button',{name:'Abrir Settings',exact:true}).click();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await shots('settings')
 assert.equal(await page.locator('input[type=file]').count(),1)
 await page.evaluate(()=>window.qa.startPlannedWorkout('ui-plan'))
 await page.reload();await page.getByRole('heading',{name:'HOME',exact:true}).waitFor();await modules()
 await page.getByRole('button',{name:'Training',exact:true}).click();await page.locator('.training-page--active').waitFor();await shots('active')
 let row=page.locator('.training-set-row:not(.is-warmup)').first()
 await row.locator('input').nth(0).fill('12.125');await row.locator('input').nth(1).fill('8');await row.locator('input').nth(2).fill('2')
 const id=await page.evaluate(async()=>{const a=await window.qa.getActiveWorkout();return a.exercises[0].sets.find(s=>s.setType==='working').id})
 // Pause only the real database update for a deterministic busy-state capture.
 await page.evaluate(()=>{const db=window.qa.db;window.qa.originalTransaction=db.transaction;db.transaction=async function(...args){if(args[0]==='rw')await new Promise(resolve=>{window.qa.releaseUpdate=resolve});return window.qa.originalTransaction.apply(this,args)}})
 const savePromise=row.getByRole('button',{name:'Guardar',exact:true}).click()
 await savePromise;await page.waitForFunction(()=>!!window.qa.releaseUpdate)
 await shots('saving')
 await page.evaluate(()=>{window.qa.db.transaction=window.qa.originalTransaction;window.qa.releaseUpdate()})
 await page.waitForFunction(async id=>(await window.qa.db.exerciseSets.get(id)).weight===12.125,id)
 await page.reload();await page.getByRole('heading',{name:'HOME',exact:true}).waitFor();await modules()
 await page.getByRole('button',{name:'Training',exact:true}).click();await page.locator('.training-page--active').waitFor()
 row=page.locator('.training-set-row:not(.is-warmup)').first()
 await page.waitForFunction(()=>document.querySelector('.training-set-row:not(.is-warmup) input')?.value==='12.125')
 // Revision conflict through the real service; local form keeps its old version.
 await page.evaluate(async id=>{const s=await window.qa.getSetForEditing(id);await window.qa.saveSetDraft(id,{weight:15,reps:9,rir:2},s.version)},id)
 await row.getByRole('button',{name:'Guardar',exact:true}).click();await row.getByRole('alert').waitFor();await shots('error')
 await row.getByRole('button',{name:'Descartar borrador y recargar serie'}).click()
 await page.waitForFunction(()=>document.querySelector('.training-set-row:not(.is-warmup) input')?.value==='15')
 await row.getByRole('button',{name:'Completar serie',exact:true}).click()
 await page.waitForFunction(()=>!!document.querySelector('.training-set-row.is-completed'))
 await shots('completed-set')
 await page.evaluate(async()=>{const a=await window.qa.getActiveWorkout();await window.qa.finishWorkout(a.session.id,'completed')})
 await page.reload();await page.getByRole('heading',{name:'HOME',exact:true}).waitFor();await modules();await training()
 await page.getByRole('button',{name:'Historial',exact:true}).click();await page.locator('.training-history-card').first().waitFor();await shots('history')
 assert.equal((await page.evaluate(()=>window.qa.getWorkoutHistory())).sessions?.length??await page.locator('.training-history-card').count(),1)
 assert.deepEqual(errors,[])
 await fs.writeFile(`${out}/checks.json`,JSON.stringify(issues,null,2))
 console.log('FUNCTIONAL PASS: routine create/edit/plan, same-day sessions, saved draft/reload, conflict recovery, complete/history, Backup UI; page errors=0')
 console.log('VISUAL CHECK ISSUES',JSON.stringify(issues))
 if(phase==='after')assert.equal(issues.length,0,'Responsive geometry/touch/input checks; see checks.json')
}finally{await browser.close()}
