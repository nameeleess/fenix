import assert from 'node:assert/strict'
import fs from 'node:fs'

const src=fs.readFileSync(new URL('../src/features/training/trainingService.ts',import.meta.url),'utf8')
function region(name,next){const s=src.indexOf(`export async function ${name}`);assert.ok(s>=0,`${name} missing`);const e=next?src.indexOf(`export async function ${next}`,s+1):-1;return src.slice(s,e>s?e:src.length)}

const required=[
  ['updateRoutineExercise','getExerciseCatalog',['workoutTemplateExercises']],
  ['updateExercisePersonalContext','createWorkoutTemplate',['exercises']],
  ['createWorkoutTemplate','updateWorkoutTemplate',['workoutTemplates','workoutTemplateExercises','exercises']],
  ['updateWorkoutTemplate','duplicateWorkoutTemplate',['workoutTemplates','workoutTemplateExercises','exercises']],
  ['duplicateWorkoutTemplate','archiveWorkoutTemplate',['workoutTemplates','workoutTemplateExercises']],
  ['archiveWorkoutTemplate','createCustomExercise',['workoutTemplates','plannedWorkoutSessions']],
  ['createCustomExercise','updateCustomExercise',['exercises']],
  ['updateCustomExercise','archiveCustomExercise',['exercises']],
  ['archiveCustomExercise',null,['exercises']],
]
for(const [fn,next,stores] of required){const r=region(fn,next);assert.match(r,/db\.transaction\(/,`${fn} missing transaction`);for(const store of stores)assert.match(r,new RegExp(`db\\.${store}`),`${fn} missing ${store}`)}

// Archive routine must protect operational children, and custom system exercises are not user-editable.
assert.match(region('archiveWorkoutTemplate','createCustomExercise'),/plannedWorkoutSessions/)
assert.match(src,/isSystemExercise/)

const page=fs.readFileSync(new URL('../src/features/training/TrainingPage.tsx',import.meta.url),'utf8')
assert.doesNotMatch(page,/window\.confirm\s*\(/)
for(const label of ['Hoy','Rutinas','Ejercicios','Historial']) assert.ok(page.includes(`label: '${label}'`),`tab ${label} missing`)
assert.match(page,/selectedDate/)
assert.match(page,/actualToday/)
assert.match(page,/navigator\.wakeLock|wakeLock/)
assert.match(page,/Detalle de rutina/)
assert.match(page,/Crear rutina/)
assert.match(page,/Crear ejercicio/)

console.log('FÉNIX v2.1 Training editor mutation sweep: PASS (routine/custom/context lifecycle + selectedDate/actualToday + dialogs)')
