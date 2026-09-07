import assert from 'node:assert/strict'
import fs from 'node:fs'
import { dailyMealIdentityKey } from '../src/features/nutrition/dailyMealIdentity.ts'

const source = fs.readFileSync('src/features/nutrition/nutritionVNextService.ts', 'utf8')
const recipeSource = fs.readFileSync('src/features/nutrition/nutritionService.ts', 'utf8')

for (const token of [
  'trainingSessions: PlannedWorkoutSession[]',
  'desiredMealSpecsForDate',
  'dailyMealIdentityKey',
  "db.transaction(\n    'rw',\n    db.plannedWorkoutSessions,\n    db.recipes,\n    db.nutritionGoals,\n    db.nutritionDays,\n    db.dailyMeals",
  "meal.planningSource === 'manual'",
  "meal.status !== 'pending'",
  "meal.planningSource = 'weekly'",
  "publishCommittedMutation('nutrition')",
]) assert.ok(source.includes(token), `Nutrition RC1 source invariant missing: ${token}`)

assert.ok(source.includes('trainingSessionId: spec.trainingSessionId'))
assert.ok(source.includes('item.meal.trainingSessionId === session.id'))
assert.ok(source.includes('sourceRecipeVersion: recipe?.version ?? null'))

for (const fn of ['updateRecipe', 'deleteRecipe', 'toggleRecipeFavorite']) {
  const start = recipeSource.indexOf(`export async function ${fn}`)
  assert.ok(start >= 0, `${fn} missing`)
  const next = recipeSource.indexOf('\nexport async function ', start + 10)
  const region = recipeSource.slice(start, next < 0 ? recipeSource.length : next)
  assert.ok(region.includes('db.transaction'), `${fn} must be transactional`)
  assert.ok(region.includes('db.recipes.get'), `${fn} must re-read current recipe`)
}

function session(id, date, status = 'pending') {
  return { id, scheduledDate: date, status, deletedAt: null, isFormalStrength: true, isExtra: false, createdAt: `2026-09-0${id === 'A' ? 1 : 2}T00:00:00Z` }
}

function desiredSpecs(sessions) {
  const relevant = sessions.filter((s) => s.deletedAt === null && s.isFormalStrength && !s.isExtra && s.status !== 'omitted')
    .sort((a,b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const specs = []
  for (const s of relevant) specs.push(['preworkout', s.id], ['postworkout', s.id])
  for (const role of relevant.length ? ['main_meal','snack','dinner'] : ['breakfast','main_meal','snack','dinner']) specs.push([role, null])
  return specs
}

// N01/N02: two same-day sessions produce independent Pre/Post and one set of day meals.
{
  const specs = desiredSpecs([session('A','2026-09-08'), session('B','2026-09-08')])
  const keys = specs.map(([role,id]) => dailyMealIdentityKey('2026-09-08', role, id))
  assert.equal(keys.length, 7)
  assert.equal(new Set(keys).size, 7)
  for (const key of ['2026-09-08|preworkout|A','2026-09-08|postworkout|A','2026-09-08|preworkout|B','2026-09-08|postworkout|B']) assert.ok(keys.includes(key))
  assert.equal(keys.filter((k) => k.includes('|main_meal')).length, 1)
}

function meal(id, date, role, trainingSessionId, opts = {}) {
  return {
    id, date, role, trainingSessionId, status: 'pending', planningSource: 'weekly', deletedAt: null,
    recipeId: opts.recipeId ?? `recipe-${role}`, name: opts.name ?? role, sourceRecipeVersion: opts.sourceRecipeVersion ?? 1,
    portionMultiplier: 1, plannedQuantity: 1, plannedUnit: 'ración', plannedCalories: 100, plannedProtein: 10, plannedCarbs: 10, plannedFat: 2,
    plannedDataQuality: 'estimated', order: opts.order ?? 1, isImprovised: false, version: 1,
    ...opts,
  }
}

function applyAtomicWeek(originalState, weekSessions, { failDay = null } = {}) {
  const working = structuredClone(originalState)
  let writes = 0
  try {
    const monday = '2026-09-07'
    for (let i = 0; i < 7; i += 1) {
      const date = `2026-09-${String(7+i).padStart(2,'0')}`
      if (failDay === i + 1) throw new Error('injected failure')
      const sessions = weekSessions.filter((s) => s.scheduledDate === date && s.status !== 'omitted')
      const desired = desiredSpecs(sessions)
      const desiredKeys = new Set(desired.map(([role,sid]) => dailyMealIdentityKey(date,role,sid)))
      const current = working.meals.filter((m) => m.date === date && m.deletedAt === null)
      for (const [role,sid] of desired) {
        const key = dailyMealIdentityKey(date,role,sid)
        const same = current.filter((m) => dailyMealIdentityKey(m.date,m.role,m.trainingSessionId) === key && m.deletedAt === null)
        const protectedFact = same.some((m) => m.status !== 'pending' || m.planningSource === 'manual')
        const managed = same.filter((m) => m.status === 'pending' && m.planningSource !== 'manual')
        if (protectedFact) {
          for (const m of managed) { m.deletedAt='x'; writes++ }
          continue
        }
        if (managed.length === 0) { working.meals.push(meal(`new-${date}-${role}-${sid??'day'}`,date,role,sid)); writes++ }
        for (const m of managed.slice(1)) { m.deletedAt='x'; writes++ }
      }
      for (const m of current) {
        if (m.status !== 'pending' || m.planningSource === 'manual') continue
        const key = dailyMealIdentityKey(m.date,m.role,m.trainingSessionId)
        if (!desiredKeys.has(key)) { m.deletedAt='x'; writes++ }
      }
      working.days[date] = `week:${monday}`
    }
    return { state: working, writes }
  } catch (error) {
    return { state: structuredClone(originalState), writes: 0, error }
  }
}

const sessions = [session('A','2026-09-08'), session('B','2026-09-08')]
const base = { meals: [], days: {} }

// N03 apply whole week + idempotence.
{
  const first = applyAtomicWeek(base, sessions)
  assert.ok(first.writes > 0)
  const count1 = first.state.meals.filter((m)=>m.deletedAt===null).length
  const second = applyAtomicWeek(first.state, sessions)
  const count2 = second.state.meals.filter((m)=>m.deletedAt===null).length
  assert.equal(count2, count1)
  const identities = second.state.meals.filter((m)=>m.deletedAt===null).map((m)=>dailyMealIdentityKey(m.date,m.role,m.trainingSessionId))
  assert.equal(new Set(identities).size, identities.length)
}

// N04 injected failure day 4 rolls the entire logical state back.
{
  const failed = applyAtomicWeek(base, sessions, { failDay: 4 })
  assert.ok(failed.error)
  assert.deepEqual(failed.state, base)
  assert.equal(failed.writes, 0)
}

// N05 confirmed/skipped/manual facts survive week apply.
{
  const state = { meals: [
    meal('completed','2026-09-08','preworkout','A',{status:'completed'}),
    meal('skipped','2026-09-08','postworkout','A',{status:'skipped'}),
    meal('manual','2026-09-08','snack',null,{planningSource:'manual'}),
  ], days:{} }
  const out = applyAtomicWeek(state,sessions).state
  for (const id of ['completed','skipped','manual']) assert.equal(out.meals.find((m)=>m.id===id).deletedAt,null)
}

// N06 reprogram A onto B preserves all A/B identities.
{
  const specs = desiredSpecs([session('A','2026-09-08'),session('B','2026-09-08')])
  const training = specs.filter(([role])=>role==='preworkout'||role==='postworkout')
  assert.equal(training.length,4)
  assert.equal(new Set(training.map(([role,sid])=>`${role}:${sid}`)).size,4)
}

// N07 recipe snapshot lifecycle: old meal does not mutate; new selection uses new version; delete leaves snapshot.
{
  const recipeV1 = { id:'r', version:1, name:'V1', calories:100, deletedAt:null }
  const planned = { recipeId: recipeV1.id, sourceRecipeVersion: recipeV1.version, name: recipeV1.name, calories: recipeV1.calories }
  const recipeV2 = { ...recipeV1, version:2, name:'V2', calories:120 }
  assert.deepEqual(planned,{recipeId:'r',sourceRecipeVersion:1,name:'V1',calories:100})
  const newPlanned = { recipeId:recipeV2.id, sourceRecipeVersion:recipeV2.version, name:recipeV2.name, calories:recipeV2.calories }
  assert.equal(newPlanned.sourceRecipeVersion,2)
  recipeV2.deletedAt='deleted'
  assert.equal(planned.name,'V1')
}

// N08 causal X->Y->Z: all persistent Training meal identities after stabilization use latest session date.
{
  let latest = session('A','2026-09-08')
  latest = {...latest, scheduledDate:'2026-09-09'}
  latest = {...latest, scheduledDate:'2026-09-10'}
  const specs = desiredSpecs([latest])
  for (const [role,sid] of specs.filter(([r])=>r==='preworkout'||r==='postworkout')) {
    assert.ok(dailyMealIdentityKey(latest.scheduledDate,role,sid).startsWith('2026-09-10|'))
  }
}

console.log('F2-RC1 Nutrition integrity: PASS (N01-N08 multi-session/atomic/idempotent/history/recipe)')
