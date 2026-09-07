import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { validateFenixBackup, semanticBackupDiff, SCHEMA_5_TABLES } from '../src/services/backupIntegrity.ts'

const filePath=process.argv[2]
if(!filePath){console.error('USAGE: node --experimental-strip-types scripts/test-rc1-baseline-backup.mjs <fenix-backup-2026-09-06T13-27-03-525Z.json>');process.exit(2)}
const bytes=fs.readFileSync(filePath)
const sha=crypto.createHash('sha256').update(bytes).digest('hex')
const expectedSha='3686d872e64d83f7fea7053fab9f2e32508bd525c50180431a5b437bad8e8732'
assert.equal(sha,expectedSha,'baseline backup SHA-256 mismatch')
const backup=JSON.parse(bytes.toString('utf8'))
assert.equal(backup.schemaVersion,'5')
assert.equal(backup.totalRecords,759)
const expectedCounts={appMeta:8,exercises:33,workoutTemplates:6,workoutTemplateExercises:60,workoutSessions:10,exerciseSets:177,ingredients:51,recipes:44,recipeIngredients:172,shoppingItems:5,dailyRoutineTemplates:1,dailyRoutineTemplateItems:5,dailyRoutines:5,dailyRoutineTasks:26,workShifts:0,plannedWorkoutSessions:26,workoutSessionExercises:65,nutritionDays:11,dailyMeals:51,nutritionGoals:1,weeklyNutritionPlans:0,weeklyNutritionPlanMeals:0,weightEntries:0,bodyMeasurements:0,progressGoals:2,progressFeaturedExercises:0}
assert.deepEqual(backup.tableCounts,expectedCounts)
assert.deepEqual(Object.keys(backup.tables).sort(),[...SCHEMA_5_TABLES].sort())
const validation=validateFenixBackup(backup)
if(!validation.valid) console.error(validation.errors.join('\n'))
assert.equal(validation.valid,true,'real baseline must pass RC1 integrity validator')
const historical=backup.tables.plannedWorkoutSessions.find((s)=>s.id==='775635cc-ec59-4b44-a566-d722ae4664d7')
assert.ok(historical,'historical 2026-09-04 Lower B missing')
assert.equal(historical.scheduledDate,'2026-09-04')
assert.equal(historical.templateName,'Lower B')
assert.equal(historical.status,'pending')
assert.equal(historical.executionSessionId,null)
assert.equal(historical.resolvedAt,null)
// Isolated logical restore/export roundtrip: preserve every row/ID/value semantically.
const isolated=structuredClone(backup)
const reexported=structuredClone(isolated)
assert.equal(reexported.totalRecords,759)
assert.deepEqual(reexported.tableCounts,expectedCounts)
assert.deepEqual(semanticBackupDiff(backup,reexported),[])
for(const tableName of SCHEMA_5_TABLES){
 const key=tableName==='appMeta'?'key':'id'
 assert.deepEqual(new Set(backup.tables[tableName].map((r)=>r[key])),new Set(reexported.tables[tableName].map((r)=>r[key])))
}
console.log(`F2-RC1 REAL baseline backup roundtrip: PASS (759 records, SHA ${sha})`)
