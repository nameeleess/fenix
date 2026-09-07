import assert from 'node:assert/strict'
import { SCHEMA_5_TABLES, validateFenixBackup } from '../src/services/backupIntegrity.ts'

function baseBackup() {
  const tables = Object.fromEntries(SCHEMA_5_TABLES.map((name) => [name, []]))
  tables.appMeta = [{ key: 'schemaVersion', value: '5', updatedAt: 't' }]
  return recount({
    format: 'fenix-backup',
    formatVersion: 1,
    exportedAt: '2026-09-06T00:00:00.000Z',
    databaseName: 'fenix-db',
    schemaVersion: '5',
    totalRecords: 0,
    tableCounts: {},
    tables,
  })
}

function recount(backup) {
  backup.tableCounts = Object.fromEntries(SCHEMA_5_TABLES.map((name) => [name, backup.tables[name].length]))
  backup.totalRecords = Object.values(backup.tableCounts).reduce((sum, count) => sum + count, 0)
  return backup
}

function trainingFixture() {
  const b = baseBackup()
  b.tables.workoutTemplates = [{ id: 'template', deletedAt: null }]
  b.tables.plannedWorkoutSessions = [
    { id: 'A', workoutTemplateId: 'template', scheduledDate: '2026-09-08', status: 'pending', executionSessionId: null, deletedAt: null },
    { id: 'B', workoutTemplateId: 'template', scheduledDate: '2026-09-08', status: 'pending', executionSessionId: null, deletedAt: null },
  ]
  return recount(b)
}

function meal(id, sessionId, role = 'preworkout', status = 'pending', date = '2026-09-08') {
  return { id, date, role, status, trainingSessionId: sessionId, recipeId: null, deletedAt: null }
}

function expectInvalid(backup, label) {
  const result = validateFenixBackup(recount(backup))
  assert.equal(result.valid, false, label)
  return result
}

// B01 pending Training meal + missing parent -> reject.
{
  const b = trainingFixture()
  b.tables.dailyMeals = [meal('m', 'MISSING')]
  expectInvalid(b, 'B01 missing parent')
}

// B02 parent soft-deleted -> reject.
{
  const b = trainingFixture()
  b.tables.plannedWorkoutSessions[0].deletedAt = 'deleted'
  b.tables.dailyMeals = [meal('m', 'A')]
  const result = expectInvalid(b, 'B02 soft-deleted parent')
  assert.ok(result.errors.some((error) => error.includes('soft-deleted')))
}

// B03 parent omitted -> reject.
{
  const b = trainingFixture()
  b.tables.plannedWorkoutSessions[0].status = 'omitted'
  b.tables.dailyMeals = [meal('m', 'A')]
  const result = expectInvalid(b, 'B03 omitted parent')
  assert.ok(result.errors.some((error) => error.includes('omitted')))
}

// B04 meal date != scheduledDate -> reject.
{
  const b = trainingFixture()
  b.tables.dailyMeals = [meal('m', 'A', 'preworkout', 'pending', '2026-09-09')]
  const result = expectInvalid(b, 'B04 stale date')
  assert.ok(result.errors.some((error) => error.includes('distinta de su sesión')))
}

// B05 completed/skipped historical facts remain accepted despite later lifecycle/date changes, while parent still structurally exists.
{
  const b = trainingFixture()
  b.tables.plannedWorkoutSessions[0].status = 'omitted'
  b.tables.plannedWorkoutSessions[0].deletedAt = 'deleted'
  b.tables.dailyMeals = [
    meal('completed', 'A', 'preworkout', 'completed', '2026-09-01'),
    meal('skipped', 'A', 'postworkout', 'skipped', '2026-09-02'),
  ]
  assert.equal(validateFenixBackup(recount(b)).valid, true, 'B05 historical completed/skipped must remain valid')
}

// B06 Pre/Post A/B same-day are distinct legal identities.
{
  const b = trainingFixture()
  b.tables.dailyMeals = [
    meal('preA', 'A', 'preworkout'),
    meal('postA', 'A', 'postworkout'),
    meal('preB', 'B', 'preworkout'),
    meal('postB', 'B', 'postworkout'),
  ]
  assert.equal(validateFenixBackup(recount(b)).valid, true, 'B06 distinct same-day Training identities must coexist')
}

function setFixture() {
  const b = baseBackup()
  b.tables.workoutTemplates = [{ id: 'template', deletedAt: null }]
  b.tables.exercises = [{ id: 'exercise', deletedAt: null }]
  b.tables.workoutSessions = [{ id: 'session', workoutTemplateId: 'template', plannedWorkoutId: null, status: 'active', deletedAt: null }]
  b.tables.workoutSessionExercises = [{ id: 'snapshot', workoutSessionId: 'session', exerciseId: 'exercise', sourceTemplateExerciseId: null, deletedAt: null }]
  return b
}

function set(id, type, order, deletedAt = null) {
  return { id, workoutSessionId: 'session', exerciseId: 'exercise', workoutSessionExerciseId: 'snapshot', setType: type, order, reps: null, weight: null, rir: null, completedAt: null, deletedAt }
}

// C01 working 1,2,2 -> reject.
{
  const b = setFixture()
  b.tables.exerciseSets = [set('s1', 'working', 1), set('s2', 'working', 2), set('s3', 'working', 2)]
  const result = expectInvalid(b, 'C01 duplicate working order')
  assert.ok(result.errors.some((error) => error.includes('order activo duplicado')))
}

// C02 warmup 1,1 -> reject.
{
  const b = setFixture()
  b.tables.exerciseSets = [set('s1', 'warmup', 1), set('s2', 'warmup', 1)]
  expectInvalid(b, 'C02 duplicate warmup order')
}

// C03 working 1 + warmup 1 -> accept.
{
  const b = setFixture()
  b.tables.exerciseSets = [set('s1', 'working', 1), set('s2', 'warmup', 1)]
  assert.equal(validateFenixBackup(recount(b)).valid, true, 'C03 different setType orders may match')
}

// C04 duplicate where one is soft-deleted -> accept.
{
  const b = setFixture()
  b.tables.exerciseSets = [set('s1', 'working', 1), set('s2', 'working', 1, 'deleted')]
  assert.equal(validateFenixBackup(recount(b)).valid, true, 'C04 soft-deleted duplicate must be ignored')
}

console.log('F2-RC1.1 Backup hardening: PASS (B01-B06 pending Training lifecycle + C01-C04 active order)')
