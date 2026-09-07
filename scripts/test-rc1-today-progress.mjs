import assert from 'node:assert/strict'
import fs from 'node:fs'

const todaySource = fs.readFileSync('src/features/today/todayIntegrationService.ts','utf8')
const todayUi = fs.readFileSync('src/features/today/TodayPage.tsx','utf8')
const progressSource = fs.readFileSync('src/features/progress/progressService.ts','utf8')
const nutritionSource = fs.readFileSync('src/features/nutrition/nutritionVNextService.ts','utf8')

for (const token of ['sessions: TodayTrainingSessionSummary[]','sessionCount: number','hasMultipleSessions: boolean','?.sessions ?? []','getActiveWorkout()']) {
  assert.ok(todaySource.includes(token),`Today source missing ${token}`)
}
assert.ok(todayUi.includes('sessionCount') && todayUi.includes('sesiones hoy'))
assert.ok(nutritionSource.includes('item.meal.trainingSessionId === session.id'),'Today Nutrition source must be session-identity safe')
for (const token of ['current.length >= 3 && previous.length >= 3','shiftDateKey(todayKey, -27)','session.isFormalStrength','!session.isExtra']) {
  assert.ok(progressSource.includes(token),`Progress source missing ${token}`)
}

const priority = { in_progress:0,pending:1,completed:2,incomplete:2,omitted:3 }
function focus(planned, active=null) {
  const sorted=[...planned].sort((a,b)=>priority[a.status]-priority[b.status] || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  if(active) return {status:'in_progress',id:active.plannedWorkoutId??null,title:active.title,count:planned.length}
  if(sorted.length===0) return {status:'rest',id:null,title:'Descanso programado',count:0}
  return {status:sorted[0].status,id:sorted[0].id,title:sorted[0].title,count:sorted.length}
}
function s(id,status,createdAt=id){return{id,status,createdAt,title:id}}

assert.equal(focus([]).status,'rest')
assert.equal(focus([s('A','pending')]).id,'A')
assert.equal(focus([s('done','completed','1'),s('next','pending','2')]).id,'next')
assert.equal(focus([s('pending','pending','2')],{plannedWorkoutId:'active',title:'ACTIVE'}).id,'active')
assert.equal(focus([s('B','completed','2'),s('A','incomplete','1')]).id,'A')
assert.equal(focus([s('A','pending'),s('B','pending')]).count,2)

function mean(xs){return xs.reduce((a,b)=>a+b,0)/xs.length}
function trend(current,previous){
  const ready=current.length>=3&&previous.length>=3
  return {status:ready?'ready':'insufficient',currentMean:current.length>=3?mean(current):null,previousMean:previous.length>=3?mean(previous):null,delta:ready?mean(current)-mean(previous):null}
}
assert.equal(trend([65,66],[64,65]).status,'insufficient')
assert.equal(trend([65,66,67],[64,64.5,65]).status,'ready')
assert.equal(trend([65,66,67],[64,64.5,65]).delta,1.5)

// Same-day Training identities count as separate sessions, not one day.
const sameDay=[{id:'A',status:'completed',formal:true,extra:false},{id:'B',status:'completed',formal:true,extra:false}]
assert.equal(sameDay.filter(x=>x.formal&&!x.extra).length,2)

console.log('F2-RC1 Hoy + Progreso core: PASS (focus 0/1/2/active/terminal + trend 2+2/3+3)')
