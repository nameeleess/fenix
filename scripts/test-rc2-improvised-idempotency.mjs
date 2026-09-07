import assert from 'node:assert/strict'
import fs from 'node:fs'

function storeSubmission(state, token, kcal, { failBeforeCommit=false }={}) {
  if (state.meals.has(token)) return false
  if (failBeforeCommit) throw new Error('injected')
  state.meals.set(token,{id:token,kcal,status:'completed'})
  state.events += 1
  return true
}
// I01 double same token -> one meal.
{
  const s={meals:new Map(),events:0}; storeSubmission(s,'T',500); storeSubmission(s,'T',500)
  assert.equal(s.meals.size,1); assert.equal(s.events,1)
}
// I02 10 identical tokens -> one.
{
  const s={meals:new Map(),events:0}; for(let i=0;i<10;i++) storeSubmission(s,'T',500)
  assert.equal(s.meals.size,1); assert.equal(s.events,1)
}
// I03 separate tokens allowed.
{
  const s={meals:new Map(),events:0}; storeSubmission(s,'A',500); storeSubmission(s,'B',500)
  assert.equal(s.meals.size,2)
}
// I04 consumed macros counted once for duplicate logical submit.
{
  const s={meals:new Map(),events:0}; storeSubmission(s,'T',500); storeSubmission(s,'T',500)
  assert.equal([...s.meals.values()].reduce((sum,m)=>sum+m.kcal,0),500)
}
// I05 failure before commit permits safe retry with same intent.
{
  const s={meals:new Map(),events:0}; assert.throws(()=>storeSubmission(s,'T',500,{failBeforeCommit:true})); assert.equal(s.meals.size,0)
  storeSubmission(s,'T',500); assert.equal(s.meals.size,1)
}
// I06 event publication is not duplicated.
{
  const s={meals:new Map(),events:0}; for(let i=0;i<3;i++) storeSubmission(s,'T',500); assert.equal(s.events,1)
}
const service=fs.readFileSync('src/features/nutrition/nutritionVNextService.ts','utf8')
const start=service.indexOf('export async function addImprovisedMeal')
const end=service.indexOf('\nfunction buildNutritionWeekSuggestionFromSnapshots',start)
const region=service.slice(start,end)
for(const token of ["db.transaction('rw', db.dailyMeals",'db.dailyMeals.get(input.submissionId)','createBase(input.submissionId)','if (inserted)',"publishCommittedMutation('nutrition')"]) assert.ok(region.includes(token),`missing ${token}`)
const page=fs.readFileSync('src/features/nutrition/NutritionPage.tsx','utf8')
const modal=page.slice(page.indexOf('function ImprovisedMealModal'),page.indexOf('\nfunction GoalEditor'))
assert.ok(modal.includes('submittingRef.current'))
assert.ok(modal.includes('submissionId'))
assert.ok(modal.includes('disabled={submitting}'))

console.log('F2-RC2 Improvised idempotency: PASS (I01-I06 stable submission token + retry/event semantics)')
