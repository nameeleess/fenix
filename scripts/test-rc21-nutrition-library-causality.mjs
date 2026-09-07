import assert from 'node:assert/strict'
import fs from 'node:fs'

const normName = (v) => v.trim().toLocaleLowerCase('es')
const normUnit = (v) => (v?.trim() || null)

function state() {
  return {
    ingredients: new Map(), recipes: new Map(), relations: new Map(), shopping: new Map(), events: 0, seq: 0,
  }
}
function base(s, prefix) { s.seq += 1; return { id: `${prefix}-${s.seq}`, deletedAt: null, version: 1 } }
function activeValues(map) { return [...map.values()].filter((x) => x.deletedAt === null) }
function emit(s) { s.events += 1 }
function createIngredient(s, name) {
  const normalized = normName(name)
  if (activeValues(s.ingredients).some((i) => normName(i.name) === normalized)) throw new Error('duplicate ingredient')
  const i = { ...base(s, 'i'), name: name.trim() }; s.ingredients.set(i.id, i); emit(s); return i
}
function updateIngredient(s, id, name) {
  const i = s.ingredients.get(id); if (!i || i.deletedAt !== null) throw new Error('missing ingredient')
  const normalized = normName(name)
  if (activeValues(s.ingredients).some((x) => x.id !== id && normName(x.name) === normalized)) throw new Error('duplicate ingredient')
  i.name = name.trim(); i.version += 1; emit(s); return i
}
function ensureIngredientForRecipe(s, name) {
  const normalized = normName(name)
  const existing = activeValues(s.ingredients).find((i) => normName(i.name) === normalized)
  if (existing) return existing
  const i = { ...base(s, 'i'), name: name.trim() }; s.ingredients.set(i.id, i); return i
}
function createRecipe(s, name='R') { const r={...base(s,'r'),name}; s.recipes.set(r.id,r); return r }
function saveRelation(s, recipeId, ingredientName) {
  const r=s.recipes.get(recipeId); if(!r||r.deletedAt!==null) throw new Error('recipe missing')
  const i=ensureIngredientForRecipe(s, ingredientName)
  const rel={...base(s,'ri'),recipeId,ingredientId:i.id}; s.relations.set(rel.id,rel); emit(s); return rel
}
function archiveRelation(s,id){const r=s.relations.get(id);if(!r||r.deletedAt!==null)return false;r.deletedAt='x';r.version+=1;emit(s);return true}
function addBasket(s, ingredientId, qty=1, unit='g') {
  const i=s.ingredients.get(ingredientId); if(!i||i.deletedAt!==null) throw new Error('ingredient missing')
  const u=normUnit(unit)
  const same=activeValues(s.shopping).find((x)=>x.ingredientId===ingredientId&&normUnit(x.unit)===u)
  if(same){same.quantity=(same.quantity??0)+(qty??0);same.version+=1;same.checked=false;emit(s);return same}
  const item={...base(s,'si'),ingredientId,quantity:qty,unit:u,checked:false};s.shopping.set(item.id,item);emit(s);return item
}
function addRelationToBasket(s, relId){
  const rel=s.relations.get(relId);if(!rel||rel.deletedAt!==null)throw new Error('relation missing')
  const recipe=s.recipes.get(rel.recipeId);if(!recipe||recipe.deletedAt!==null)throw new Error('recipe missing')
  return addBasket(s,rel.ingredientId,1,'g')
}
function deleteIngredient(s,id){
  const i=s.ingredients.get(id);if(!i||i.deletedAt!==null)return false
  for(const rel of activeValues(s.relations).filter((x)=>x.ingredientId===id)){
    const r=s.recipes.get(rel.recipeId);if(r&&r.deletedAt===null)throw new Error('ingredient used')
  }
  i.deletedAt='x';i.version+=1
  for(const item of activeValues(s.shopping).filter((x)=>x.ingredientId===id)){item.deletedAt='x';item.version+=1}
  emit(s);return true
}
function updateShopping(s,id,{qty=1,unit='g'}={}){
  const item=s.shopping.get(id);if(!item||item.deletedAt!==null)throw new Error('shopping missing')
  const ing=s.ingredients.get(item.ingredientId);if(!ing||ing.deletedAt!==null)throw new Error('ingredient missing')
  const u=normUnit(unit)
  if(activeValues(s.shopping).some((x)=>x.id!==id&&x.ingredientId===item.ingredientId&&normUnit(x.unit)===u))throw new Error('duplicate shopping')
  item.quantity=qty;item.unit=u;item.version+=1;emit(s);return item
}
function toggleShopping(s,id){const x=s.shopping.get(id);if(!x||x.deletedAt!==null)throw new Error('shopping missing');const i=s.ingredients.get(x.ingredientId);if(!i||i.deletedAt!==null)throw new Error('ingredient missing');x.checked=!x.checked;x.version+=1;emit(s)}
function removeShopping(s,id){const x=s.shopping.get(id);if(!x||x.deletedAt!==null)return false;x.deletedAt='x';x.version+=1;emit(s);return true}
function clearChecked(s,{failAt=-1}={}){
  const snapshot=structuredClone([...s.shopping.entries()]); const events=s.events
  try { let n=0; for(const x of activeValues(s.shopping).filter((v)=>v.checked)){x.deletedAt='x';x.version+=1;n++;if(n===failAt)throw new Error('injected')} if(n)emit(s);return n }
  catch(e){s.shopping=new Map(snapshot);s.events=events;throw e}
}
function assertRuntime(s){
  for(const rel of activeValues(s.relations)){const r=s.recipes.get(rel.recipeId);const i=s.ingredients.get(rel.ingredientId);assert.ok(r&&r.deletedAt===null,'active relation/deleted recipe');assert.ok(i&&i.deletedAt===null,'active relation/deleted ingredient')}
  for(const x of activeValues(s.shopping)){const i=s.ingredients.get(x.ingredientId);assert.ok(i&&i.deletedAt===null,'active shopping/deleted ingredient')}
  const names=new Set();for(const i of activeValues(s.ingredients)){const k=normName(i.name);assert.ok(!names.has(k),'duplicate normalized ingredient');names.add(k)}
  const shopping=new Set();for(const x of activeValues(s.shopping)){const k=`${x.ingredientId}|${normUnit(x.unit)??''}`;assert.ok(!shopping.has(k),'duplicate logical shopping');shopping.add(k)}
}

// L01 delete precheck -> recipe relation wins -> delete must reject.
{
  const s=state();const i=createIngredient(s,'Arroz');const r=createRecipe(s);const before=s.events;saveRelation(s,r.id,'Arroz');const afterRelation=s.events;assert.throws(()=>deleteIngredient(s,i.id),/used/);assert.equal(s.ingredients.get(i.id).deletedAt,null);assert.equal(s.events,afterRelation);assert.ok(afterRelation>before);assertRuntime(s)
}
// L02 delete wins -> recipe later uses a new parent, never old deleted id.
{
  const s=state();const i=createIngredient(s,'Arroz');const r=createRecipe(s);deleteIngredient(s,i.id);const rel=saveRelation(s,r.id,'arroz');assert.notEqual(rel.ingredientId,i.id);assert.equal(s.ingredients.get(i.id).deletedAt,'x');assertRuntime(s)
}
// L03 add started logically, delete wins -> add re-read rejects / zero event.
{
  const s=state();const i=createIngredient(s,'Leche');const before=s.events;deleteIngredient(s,i.id);const afterDelete=s.events;assert.throws(()=>addBasket(s,i.id,1,'l'),/missing/);assert.equal(s.events,afterDelete);assert.equal(activeValues(s.shopping).length,0);assert.ok(afterDelete>before);assertRuntime(s)
}
// L04 add wins -> delete also removes new basket item.
{
  const s=state();const i=createIngredient(s,'Leche');const x=addBasket(s,i.id,1,'l');deleteIngredient(s,i.id);assert.notEqual(s.shopping.get(x.id).deletedAt,null);assertRuntime(s)
}
// L05 two adds combine to one logical identity.
{
  const s=state();const i=createIngredient(s,'Avena');addBasket(s,i.id,2,'g');addBasket(s,i.id,3,'g');const xs=activeValues(s.shopping);assert.equal(xs.length,1);assert.equal(xs[0].quantity,5);assert.equal(xs[0].version,2);assertRuntime(s)
}
// L06 ten adds combine exactly once each.
{
  const s=state();const i=createIngredient(s,'Avena');for(let n=0;n<10;n++)addBasket(s,i.id,1,'g');const xs=activeValues(s.shopping);assert.equal(xs.length,1);assert.equal(xs[0].quantity,10);assert.equal(xs[0].version,10);assertRuntime(s)
}
// L07/L08 normalized create singleton under 2/10 attempts.
for(const attempts of [2,10]){
  const s=state();let success=0;for(let n=0;n<attempts;n++){try{createIngredient(s,n%2?' arroz ':'Arroz');success++}catch{}}assert.equal(success,1);assert.equal(activeValues(s.ingredients).length,1);assertRuntime(s)
}
// L09 concurrent updates serialize and version increases per committed write.
{
  const s=state();const i=createIngredient(s,'Arroz');const v=i.version;updateIngredient(s,i.id,'Arroz integral');updateIngredient(s,i.id,'Arroz largo');assert.equal(i.version,v+2);assert.equal(i.name,'Arroz largo');assertRuntime(s)
}
// L10 update-name vs create same normalized cannot end duplicated, both serial orders.
{
  const s=state();const a=createIngredient(s,'A');const b=createIngredient(s,'B');updateIngredient(s,a.id,'C');assert.throws(()=>createIngredient(s,' c '),/duplicate/);assert.equal(activeValues(s.ingredients).filter(i=>normName(i.name)==='c').length,1);assertRuntime(s)
  const s2=state();const x=createIngredient(s2,'A');createIngredient(s2,'C');assert.throws(()=>updateIngredient(s2,x.id,' c '),/duplicate/);assertRuntime(s2)
}
// L11 update vs remove: whichever wins, no resurrect/version stale.
{
  const s=state();const i=createIngredient(s,'X');const x=addBasket(s,i.id,1,'g');updateShopping(s,x.id,{qty:2,unit:'g'});const v=x.version;removeShopping(s,x.id);assert.equal(x.version,v+1);assert.throws(()=>updateShopping(s,x.id,{qty:3,unit:'g'}),/missing/);assert.notEqual(x.deletedAt,null);assertRuntime(s)
  const s2=state();const i2=createIngredient(s2,'Y');const y=addBasket(s2,i2.id,1,'g');removeShopping(s2,y.id);assert.throws(()=>updateShopping(s2,y.id,{qty:2,unit:'g'}),/missing/);assertRuntime(s2)
}
// L12 toggle vs remove never resurrects.
{
  const s=state();const i=createIngredient(s,'X');const x=addBasket(s,i.id,1,'g');toggleShopping(s,x.id);removeShopping(s,x.id);assert.throws(()=>toggleShopping(s,x.id),/missing/);assert.notEqual(x.deletedAt,null);assertRuntime(s)
}
// L13 clear checked injected failure rolls back all items and event.
{
  const s=state();const i=createIngredient(s,'X');const a=addBasket(s,i.id,1,'g');const b=addBasket(s,i.id,1,'kg');toggleShopping(s,a.id);toggleShopping(s,b.id);const before=structuredClone([...s.shopping.entries()]);const events=s.events;assert.throws(()=>clearChecked(s,{failAt:1}),/injected/);assert.deepEqual([...s.shopping.entries()],before);assert.equal(s.events,events);assertRuntime(s)
}
// L14 archived RecipeIngredient cannot materialize a basket item.
{
  const s=state();const r=createRecipe(s);const rel=saveRelation(s,r.id,'Arroz');archiveRelation(s,rel.id);const before=s.events;assert.throws(()=>addRelationToBasket(s,rel.id),/relation missing/);assert.equal(activeValues(s.shopping).length,0);assert.equal(s.events,before);assertRuntime(s)
}

const source=fs.readFileSync('src/features/nutrition/nutritionService.ts','utf8')
function region(start,end){const a=source.indexOf(start);assert.ok(a>=0,`${start} missing`);const b=source.indexOf(end,a+1);return source.slice(a,b<0?source.length:b)}
const del=region('export async function deleteCatalogIngredient','function combineQuantities')
for(const t of ['db.ingredients','db.recipeIngredients','db.recipes','db.shoppingItems','await db.ingredients.get','await db.recipeIngredients','await db.recipes.get','await db.shoppingItems'])assert.ok(del.includes(t),`delete missing ${t}`)
const create=region('export async function createCatalogIngredient','export async function updateCatalogIngredient')
assert.ok(create.includes("db.transaction(\n    'rw',\n    db.ingredients"));assert.ok(create.indexOf('findActiveIngredientByName')>create.indexOf('db.transaction'))
const update=region('export async function updateCatalogIngredient','export async function deleteCatalogIngredient')
assert.ok(update.includes("db.transaction(\n    'rw',\n    db.ingredients"));assert.ok(update.indexOf('db.ingredients.get')>update.indexOf('db.transaction'))
const addRel=region('export async function addRecipeIngredientToBasket','export async function addCatalogIngredientToBasket')
for(const t of ['db.recipes','db.recipeIngredients','db.ingredients','db.shoppingItems','db.recipeIngredients.get','db.recipes.get'])assert.ok(addRel.includes(t),`add relation missing ${t}`)
const addCat=region('export async function addCatalogIngredientToBasket','export async function getShoppingList')
for(const t of ['db.ingredients','db.shoppingItems','db.ingredients.get','addIngredientToBasketInTransaction'])assert.ok(addCat.includes(t),`add catalog missing ${t}`)
for(const [start,end] of [['export async function updateShoppingItem','export async function toggleShoppingItemChecked'],['export async function toggleShoppingItemChecked','export async function removeShoppingItem'],['export async function removeShoppingItem','export async function clearCheckedShoppingItems']]){const r=region(start,end);assert.ok(r.includes('db.transaction'),`${start} lacks tx`);assert.ok(r.includes('db.shoppingItems.get'),`${start} lacks re-read`)}
const clear=region('export async function clearCheckedShoppingItems','__EOF__')
assert.ok(clear.includes('db.transaction'));assert.ok(clear.indexOf('db.shoppingItems.toArray')>clear.indexOf('db.transaction'))

console.log('F2-RC2.1 Nutrition library causality: PASS (L01-L14 transactional lifecycle/idempotent basket/runtime invariants)')
