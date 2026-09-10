import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'

const training=fs.readFileSync('src/features/training/trainingService.ts','utf8')
const nutrition=fs.readFileSync('src/features/nutrition/nutritionVNextService.ts','utf8')
const page=fs.readFileSync('src/features/nutrition/NutritionPage.tsx','utf8')
const backup=fs.readFileSync('src/services/backupIntegrity.ts','utf8')
const streak=fs.readFileSync('src/features/progress/trainingStreakPolicy.ts','utf8')
const appetite=fs.readFileSync('src/features/nutrition/nutritionAppetitePolicy.ts','utf8')
const db=fs.readFileSync('src/db/database.ts','utf8')

function region(source,startName,endName){const a=source.indexOf(startName);assert.ok(a>=0,`${startName} missing`);const b=source.indexOf(endName,a+1);return source.slice(a,b<0?source.length:b)}
const sub=region(training,'export async function substituteSessionExercise','export async function getExerciseAlternatives')
for(const t of ['db.workoutSessions','db.workoutSessionExercises','db.exerciseSets','db.exercises','db.workoutTemplateExercises',"session.status !== 'active'",'set.completedAt !== null','snapshot.sourceTemplateExerciseId'])assert.ok(sub.includes(t),`substitute invariant ${t}`)
const tx=sub.indexOf('await db.transaction');assert.ok(tx>=0);for(const r of ['db.workoutSessionExercises.get','db.exerciseSets','db.exercises.get'])assert.ok(sub.indexOf(r)>=tx,`${r} pre-transaction`)

const goal=region(nutrition,'export async function updateNutritionGoal','export function nutritionRoleLabel')
assert.ok(goal.includes("db.transaction('rw', db.nutritionGoals"));assert.ok(goal.includes('await db.nutritionGoals.toArray()'));assert.ok(goal.includes('activeGoals.length > 1'))
const improvised=region(nutrition,'export async function addImprovisedMeal','function buildNutritionWeekSuggestionFromSnapshots')
for(const t of ['input.submissionId',"db.transaction('rw', db.dailyMeals",'db.dailyMeals.get(input.submissionId)','createBase(input.submissionId)','if (inserted)'])assert.ok(improvised.includes(t),`improvised ${t}`)
assert.ok(page.includes('submittingRef.current'));assert.ok(page.includes('disabled={submitting}'))
assert.ok(streak.includes('first.id.localeCompare(second.id)'))
assert.ok(appetite.includes('currentRecipeId'));assert.ok(appetite.includes('recipe.id !== currentRecipeId'))
for(const t of ['validateReversePlannedExecutionIntegrity','validateOperationalTemplateParents','validateTerminalSessionCompletedWork','validateNutritionGoalSingleton'])assert.ok(backup.includes(t),`backup ${t}`)
assert.ok(db.includes('export const CURRENT_SCHEMA_VERSION = 5'));assert.ok(!db.includes('this.version(6)'))

const protectedFiles=['src/db/database.ts']
const expected={
  'src/db/database.ts':'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677',
}
for(const f of protectedFiles){const h=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');assert.equal(h,expected[f],`${f} changed unexpectedly`)}

console.log('F2-RC2 source invariants: PASS (six QA-RC11 fixes + schema5 preserved; v2.1 package/PWA changes covered by v2.1 gates)')
