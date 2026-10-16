// Executes the actual editor service with a transactional in-memory DB double.
// This does not replace browser IndexedDB, backup/restore or offline tests.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const names = ['workoutTemplates', 'workoutTemplateExercises', 'exercises', 'plannedWorkoutSessions']
const state = Object.fromEntries(names.map(name => [name, new Map()]))
const clone = value => structuredClone(value)
const db = {}
for (const name of names) {
  db[name] = {
    get: async id => clone(state[name].get(id)),
    put: async row => { state[name].set(row.id, clone(row)); return row.id },
    add: async row => { if (state[name].has(row.id)) throw new Error('Duplicate key'); state[name].set(row.id, clone(row)); return row.id },
    update: async (id, patch) => {
      if (!state[name].has(id)) return 0
      state[name].set(id, { ...state[name].get(id), ...clone(patch) }); return 1
    },
    where: key => ({ equals: value => ({ toArray: async () => clone([...state[name].values()].filter(row => row[key] === value)) }) }),
  }
}
let tail = Promise.resolve()
db.transaction = async (...args) => {
  const action = args.at(-1)
  const run = tail.then(async () => {
    const before = clone(state)
    try { return await action() }
    catch (error) { for (const name of names) state[name] = before[name]; throw error }
  })
  tail = run.catch(() => undefined)
  return run
}
let events = 0
function loadModule(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, Date, Map, Set, Number, Error,
    require: id => { if (!(id in dependencies)) throw new Error('Unexpected dependency: ' + id); return dependencies[id] },
  }, { filename: file })
  return exports
}
const policy = loadModule('../src/features/training/trainingIntegrityPolicy.ts', {})
const service = loadModule('../src/features/training/trainingEditorService.ts', {
  '../../db/database': { db },
  '../../app/freshnessEvents': { publishCommittedMutation: () => { events++ } },
  './trainingIntegrityPolicy': policy,
})
const draft = { name: 'Routine', type: 'upper', description: '', estimatedDurationMinutes: 45, isFormalStrength: true }
const exercise = { name: 'Custom', primaryMuscle: 'Back', equipment: 'Band', exerciseType: 'compound', techniqueNotes: '' }
await service.saveCustomExercise('custom-exercise-one', null, exercise)
await assert.rejects(() => service.saveCustomExercise('system-one', null, exercise))
const item = { id: 'row-one', version: null, exerciseId: 'custom-exercise-one', targetSets: 3, minReps: 8, maxReps: 12, targetRirMin: 2, targetRirMax: 3, restSeconds: 90 }
await service.saveRoutineDefinition('routine-one', null, draft, [item], [])
const original = [{ id: 'row-one', version: 1 }]
const savedItem = { ...item, version: 1 }

// Two stale forms cannot both commit against the same version.
const writes = await Promise.allSettled([
  service.saveRoutineDefinition('routine-one', 1, { ...draft, name: 'First' }, [savedItem], original),
  service.saveRoutineDefinition('routine-one', 1, { ...draft, name: 'Second' }, [savedItem], original),
])
assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1)
assert.equal(state.workoutTemplates.get('routine-one').version, 2)
assert.equal(state.workoutTemplateExercises.get('row-one').version, 2)

// A bad child makes the entire definition unchanged.
const before = clone(state)
await assert.rejects(() => service.saveRoutineDefinition('routine-one', 2, draft, [{ ...savedItem, version: 2, exerciseId: 'missing' }], [{ id: 'row-one', version: 2 }]))
assert.deepEqual(state, before)
await assert.rejects(() => service.saveRoutineDefinition('routine-one', 2, draft, [{ ...savedItem, targetSets: NaN }], [{ id: 'row-one', version: 2 }]))

// Retrying a request is idempotent; a distinct same-day request is legitimate.
await Promise.all([
  service.planWorkout('request-one', 'routine-one', 2, '2026-10-16'),
  service.planWorkout('request-one', 'routine-one', 2, '2026-10-16'),
])
await service.planWorkout('request-two', 'routine-one', 2, '2026-10-16')
assert.equal(state.plannedWorkoutSessions.size, 2)
await assert.rejects(() => service.planWorkout('request-three', 'routine-one', 1, '2026-10-16'))
await assert.rejects(() => service.planWorkout('request-four', 'routine-one', 2, '2026-02-30'))

// Reordering and removing a definition row does not rewrite planned identity.
const plans = clone(state.plannedWorkoutSessions)
const rowTwo = { ...item, id: 'row-two', version: null }
await service.saveRoutineDefinition('routine-one', 2, draft, [rowTwo, { ...savedItem, version: 2 }], [{ id: 'row-one', version: 2 }])
assert.equal(state.workoutTemplateExercises.get('row-two').order, 1)
assert.equal(state.workoutTemplateExercises.get('row-one').order, 2)
await service.saveRoutineDefinition('routine-one', 3, draft, [{ ...rowTwo, version: 1 }], [{ id: 'row-one', version: 3 }, { id: 'row-two', version: 1 }])
assert.ok(state.workoutTemplateExercises.get('row-one').deletedAt)
assert.deepEqual(state.plannedWorkoutSessions, plans)

await service.saveCustomExercise('custom-exercise-one', 1, { ...exercise, name: 'Renamed' })
await assert.rejects(() => service.saveCustomExercise('custom-exercise-one', 1, exercise))
assert.equal(state.exercises.get('custom-exercise-one').name, 'Renamed')
assert.ok(events > 0)
console.log('PASS: actual editor service — stale writes, validation, request retries, same-day sessions, definition ordering and plan preservation')
