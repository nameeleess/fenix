import assert from 'node:assert/strict'
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../src/features/today/todayService.ts', import.meta.url), 'utf8')

function region(name, next) {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `${name} missing`)
  const end = next ? src.indexOf(`export async function ${next}`, start + 1) : src.length
  return src.slice(start, end > start ? end : src.length)
}

const start = region('startDay', 'setDailyTaskStatus')
assert.match(start, /db\.transaction\('rw',\s*db\.dailyRoutines/)
assert.match(start, /db\.dailyRoutines\.get/)
assert.match(start, /startedAt/)

for (const [fn,next] of [
  ['setDailyTaskStatus','updateDailyTask'],
  ['updateDailyTask','addOneOffTask'],
  ['deleteOneOffTask','upsertWorkShift'],
]) {
  const r=region(fn,next)
  assert.match(r,/db\.transaction\('rw',\s*db\.dailyRoutineTasks/)
  assert.match(r,/\.get\(/)
  assert.match(r,/version:\s*[^,]+\.version\s*\+\s*1/)
}

const add = region('addOneOffTask','deleteOneOffTask')
assert.match(add,/db\.transaction\(\s*'rw',\s*db\.dailyRoutines,\s*db\.dailyRoutineTasks/)
assert.match(add,/dailyRoutines\.get/)
assert.match(add,/dailyRoutineTasks/)

for (const [fn,next] of [['upsertWorkShift','setWorkShiftStatus'],['setWorkShiftStatus','getRoutineTemplateEditorView']]) {
  const r=region(fn,next)
  assert.match(r,/db\.transaction\('rw',\s*db\.workShifts/)
  assert.match(r,/workShifts/)
}

const save = region('saveRoutineTemplate','promoteOneOffTaskToRoutine')
for (const store of ['dailyRoutineTemplates','dailyRoutineTemplateItems','dailyRoutines','dailyRoutineTasks','appMeta']) assert.match(save,new RegExp(`db\\.${store}`))
assert.match(save,/db\.transaction/)

const promote = region('promoteOneOffTaskToRoutine')
assert.match(promote,/db\.transaction/)
assert.match(promote,/dailyRoutineTasks/)
assert.match(promote,/dailyRoutineTemplateItems/)

// UI must not reintroduce native confirm in touched Today flow.
const page = fs.readFileSync(new URL('../src/features/today/TodayPage.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(page,/window\.confirm\s*\(/)
assert.match(page,/<AppHeader[^>]*title="Hoy"/)
assert.match(page,/Iniciar día/)
assert.match(page,/today-dashboard-grid/)

console.log('FÉNIX v2.1 Today mutation sweep: PASS (start/task/one-off/workshift/routine tx + Day0 truthfulness)')
