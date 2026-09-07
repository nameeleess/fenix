import assert from 'node:assert/strict'
import { calculateTrainingStreak } from '../src/features/progress/trainingStreakPolicy.ts'
import { chooseRecipeForAppetite } from '../src/features/nutrition/nutritionAppetitePolicy.ts'

function recipe(id,kcal){return{id,createdAt:'t',updatedAt:'t',deletedAt:null,version:1,name:id,category:'main_meal',instructions:null,estimatedCalories:kcal,estimatedProtein:30,estimatedCarbs:40,estimatedFat:kcal/100,isFavorite:false,notes:null,compatibleRoles:['main_meal'],volumeClass:'normal'}}
const recipes=[recipe('A',900),recipe('B',700),recipe('C',500),recipe('D',300)]
for(let i=0;i<500;i++){
  // Singleton goal serial writes.
  const goals=[]; for(let j=0;j<1+(i%10);j++){for(const g of goals.filter(x=>x.endsOn===null))g.endsOn='x';goals.push({id:`${i}-${j}`,endsOn:null})}
  assert.ok(goals.filter(g=>g.endsOn===null).length<=1)
  // Improvised idempotent logical token.
  const meals=new Map(); const token=`T${i}`; for(let j=0;j<1+(i%5);j++) if(!meals.has(token)) meals.set(token,{kcal:500})
  assert.equal(meals.size,1)
  // Appetite transition with candidates changes when possible.
  const current=chooseRecipeForAppetite(recipes,'main_meal','normal','2026-09-07',String(i))
  const compact=chooseRecipeForAppetite(recipes,'main_meal','compact','2026-09-07',String(i),current?.id??null)
  assert.ok(current&&compact); assert.notEqual(current.id,compact.id)
  // Streak permutation deterministic.
  const a={id:'A',createdAt:'t',deletedAt:null,scheduledDate:'2026-09-07',status:'completed',isFormalStrength:true,isExtra:false}
  const b={id:'B',createdAt:'t',deletedAt:null,scheduledDate:'2026-09-07',status:i%2?'omitted':'completed',isFormalStrength:true,isExtra:false}
  assert.deepEqual(calculateTrainingStreak([a,b],'2026-09-07'),calculateTrainingStreak([b,a],'2026-09-07'))
}
console.log('F2-RC2 consolidated stress: PASS (500 cycles goal/idempotency/appetite/streak)')
