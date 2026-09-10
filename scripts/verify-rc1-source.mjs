import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'

const read=(p)=>fs.readFileSync(p,'utf8')
const training=read('src/features/training/trainingService.ts')
const nutrition=read('src/features/nutrition/nutritionVNextService.ts')
const nutritionCrud=read('src/features/nutrition/nutritionService.ts')
const nutritionPage=read('src/features/nutrition/NutritionPage.tsx')
const appetitePolicy=read('src/features/nutrition/nutritionAppetitePolicy.ts')
const appCss=read('src/styles/app.css')
const today=read('src/features/today/todayIntegrationService.ts')
const backup=read('src/services/backupService.ts')
const backupIntegrity=read('src/services/backupIntegrity.ts')
const db=read('src/db/database.ts')
const progress=read('src/features/progress/progressService.ts')
const vite=read('vite.config.ts')
const progressUi=read('src/features/progress/ProgressPage.tsx')
const settingsUi=read('src/features/settings/SettingsPage.tsx')
const designCss=read('src/styles/design-system.css')

assert.ok(!db.includes('version(6)'), 'schema 6 forbidden')
assert.ok(db.includes('version(5)'), 'schema 5 missing')
assert.ok(!read('package.json').includes('supabase'), 'cloud/supabase forbidden')

const remove=training.slice(training.indexOf('export async function removeExerciseSet'),training.indexOf('export async function startRestTimer'))
for(const t of ['db.workoutSessions','db.workoutSessionExercises','db.exerciseSets','set.completedAt !== null',"session.status !== 'active'",'version: set.version + 1']) assert.ok(remove.includes(t),`remove missing ${t}`)

for(const t of ['trainingSessions: PlannedWorkoutSession[]','desiredMealSpecsForDate','dailyMealIdentityKey','db.plannedWorkoutSessions,\n    db.recipes,\n    db.nutritionGoals,\n    db.nutritionDays,\n    db.dailyMeals',"meal.planningSource === 'manual'","meal.status !== 'pending'"]) assert.ok(nutrition.includes(t),`nutrition missing ${t}`)
assert.ok(nutrition.includes("if (changed) {\n    publishCommittedMutation('nutrition')"),'weekly apply must publish only after changed transaction')

assert.ok(nutrition.includes('export async function setNutritionDayAppetite'),'appetite action missing')
for(const t of ['db.nutritionDays','db.plannedWorkoutSessions','db.recipes','db.dailyMeals','chooseRecipeForAppetite']) assert.ok(nutrition.slice(nutrition.indexOf('export async function setNutritionDayAppetite'),nutrition.indexOf('export async function replaceDailyMealRecipe')).includes(t),`appetite transaction missing ${t}`)
assert.ok(appetitePolicy.includes('appetiteFallbackPool')&&appetitePolicy.includes('explicitMatches'),'appetite fallback policy missing')
assert.ok(nutritionPage.includes('setWeekAnchor(date)')&&nutritionPage.includes('preferredDate={date}'),'Nutrition Week must retain viewed-day context')
assert.ok(designCss.includes('.ds-app-header h1')&&designCss.includes('--fenix-tap:44px'),'v2.1 shared AppHeader/touch design missing')
for(const fn of ['updateRecipe','deleteRecipe','toggleRecipeFavorite']){const i=nutritionCrud.indexOf(`export async function ${fn}`);const j=nutritionCrud.indexOf('\nexport async function ',i+10);const r=nutritionCrud.slice(i,j<0?nutritionCrud.length:j);assert.ok(r.includes('db.transaction')&&r.includes('db.recipes.get'),`${fn} causal reread missing`)}

assert.ok(today.includes('?.sessions ?? []'),'Today must consume all same-day sessions')
assert.ok(today.includes('hasMultipleSessions'),'Today multiple-session indicator missing')
assert.ok(today.includes('getActiveWorkout()'),'Today active execution focus missing')
assert.ok(progress.includes('current.length >= 3 && previous.length >= 3'))
assert.ok(progress.includes('shiftDateKey(todayKey, -27)'))
assert.ok(progress.includes('session.isFormalStrength')&&progress.includes('!session.isExtra'))

for(const t of ["db.transaction('r', currentTables", "db.transaction('rw', currentTables", 'validateFenixBackup(backup)', 'semanticBackupDiff(normalizedBackup, restored)', 'table.clear()', 'buildBackupInsideCurrentTransaction']) assert.ok(backup.includes(t),`backup source missing ${t}`)
for(const t of ['SCHEMA_5_TABLES','validatePendingTrainingMealIdentity','validateCompletedExerciseSetDomain','validatePlannedExecutionIntegrity','dailyRoutines','nutritionDays','schemaVersion no coincide']) assert.ok(backupIntegrity.includes(t),`backup validator missing ${t}`)
assert.ok((progressUi.includes('type="file"')||settingsUi.includes('type="file"'))&&(progressUi.includes('accept="application/json,.json"')||settingsUi.includes('accept="application/json,.json"')),'restore file picker missing')
assert.ok(vite.includes('VitePWA')&&vite.includes("registerType: 'prompt'")&&vite.includes("display: 'standalone'")&&vite.includes('globPatterns'),'v2.1 PWA config incomplete')

const immutable={
 'src/db/database.ts':'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677',
}
for(const [p,expected] of Object.entries(immutable)){const actual=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(actual,expected,`${p} changed outside schema-preservation contract`)}

console.log('F2-RC1 source invariants: PASS (CORE semantics preserved under authorized v2.1 UI/PWA supersessions)')
