import assert from 'node:assert/strict'

const normName=(v)=>v.trim().toLocaleLowerCase('es');const normUnit=(v)=>(v?.trim()||null)
let seq=0;const base=(p)=>({id:`${p}-${++seq}`,deletedAt:null,version:1})
function make(){return{ingredients:new Map(),recipes:new Map(),relations:new Map(),shopping:new Map(),versions:new Map()}}
const active=(m)=>[...m.values()].filter(x=>x.deletedAt===null)
function track(s,x){const old=s.versions.get(x.id)??0;assert.ok(x.version>=old,`version regression ${x.id}`);s.versions.set(x.id,x.version)}
function ingredient(s,name){const n=normName(name);const old=active(s.ingredients).find(x=>normName(x.name)===n);if(old)return old;const x={...base('i'),name};s.ingredients.set(x.id,x);track(s,x);return x}
function recipe(s,name){const r={...base('r'),name};s.recipes.set(r.id,r);track(s,r);return r}
function relation(s,r,ing){if(r.deletedAt!==null||ing.deletedAt!==null)throw new Error('parent');const x={...base('ri'),recipeId:r.id,ingredientId:ing.id};s.relations.set(x.id,x);track(s,x);return x}
function saveRecipeIngredient(s,r,name){const i=ingredient(s,name);return relation(s,r,i)}
function deleteIngredient(s,i){if(i.deletedAt!==null)return false;for(const rel of active(s.relations).filter(x=>x.ingredientId===i.id)){const r=s.recipes.get(rel.recipeId);if(r&&r.deletedAt===null)throw new Error('used')}i.deletedAt='x';i.version++;track(s,i);for(const x of active(s.shopping).filter(x=>x.ingredientId===i.id)){x.deletedAt='x';x.version++;track(s,x)}return true}
function add(s,i,q,u){if(i.deletedAt!==null)throw new Error('deleted');u=normUnit(u);let x=active(s.shopping).find(x=>x.ingredientId===i.id&&normUnit(x.unit)===u);if(x){x.quantity=(x.quantity??0)+q;x.version++;track(s,x);return x}x={...base('si'),ingredientId:i.id,quantity:q,unit:u,checked:false};s.shopping.set(x.id,x);track(s,x);return x}
function updateIng(s,i,name){if(i.deletedAt!==null)throw new Error('deleted');const n=normName(name);if(active(s.ingredients).some(x=>x.id!==i.id&&normName(x.name)===n))throw new Error('dup');i.name=name;i.version++;track(s,i)}
function toggle(s,x){if(x.deletedAt!==null)throw new Error('deleted');const i=s.ingredients.get(x.ingredientId);if(!i||i.deletedAt!==null)throw new Error('parent');x.checked=!x.checked;x.version++;track(s,x)}
function updateShop(s,x,q,u){if(x.deletedAt!==null)throw new Error('deleted');const i=s.ingredients.get(x.ingredientId);if(!i||i.deletedAt!==null)throw new Error('parent');u=normUnit(u);if(active(s.shopping).some(y=>y.id!==x.id&&y.ingredientId===x.ingredientId&&normUnit(y.unit)===u))throw new Error('dup shop');x.quantity=q;x.unit=u;x.version++;track(s,x)}
function remove(s,x){if(x.deletedAt!==null)return;x.deletedAt='x';x.version++;track(s,x)}
function clear(s){for(const x of active(s.shopping).filter(x=>x.checked)){x.deletedAt='x';x.version++;track(s,x)}}
function archiveRecipe(s,r){if(r.deletedAt!==null)return;r.deletedAt='x';r.version++;track(s,r);for(const rel of active(s.relations).filter(x=>x.recipeId===r.id)){rel.deletedAt='x';rel.version++;track(s,rel)}}
function invariant(s){for(const rel of active(s.relations)){const r=s.recipes.get(rel.recipeId),i=s.ingredients.get(rel.ingredientId);assert.ok(r&&r.deletedAt===null);assert.ok(i&&i.deletedAt===null)}for(const x of active(s.shopping)){const i=s.ingredients.get(x.ingredientId);assert.ok(i&&i.deletedAt===null)}const ns=new Set();for(const i of active(s.ingredients)){const k=normName(i.name);assert.ok(!ns.has(k));ns.add(k)}const bs=new Set();for(const x of active(s.shopping)){const k=`${x.ingredientId}|${normUnit(x.unit)??''}`;assert.ok(!bs.has(k));bs.add(k)}for(const x of [...s.ingredients.values(),...s.recipes.values(),...s.relations.values(),...s.shopping.values()])track(s,x)}

for(let cycle=0;cycle<350;cycle++){
  const s=make();const r=recipe(s,`R${cycle}`);let i=ingredient(s,`Arroz ${cycle}`);let rel=saveRecipeIngredient(s,r,i.name)
  // Mixed recipe update: archive relation then recreate through active catalog.
  rel.deletedAt='x';rel.version++;track(s,rel);rel=saveRecipeIngredient(s,r,i.name)
  // Adds combine instead of duplicating.
  for(let n=0;n<5;n++)add(s,i,1,n%2===0?'g':'kg')
  for(const x of active(s.shopping)){if((cycle+x.id.length)%2===0)toggle(s,x);else updateShop(s,x,(x.quantity??0)+1,x.unit)}
  if(cycle%3===0)clear(s)
  if(cycle%4===0){try{updateIng(s,i,` arroz ${cycle} `)}catch{}}
  if(cycle%5===0){archiveRecipe(s,r);deleteIngredient(s,i);assert.equal(active(s.shopping).filter(x=>x.ingredientId===i.id).length,0);i=ingredient(s,`Arroz ${cycle}`)}
  else if(cycle%7===0){for(const x of active(s.shopping).slice(0,1))remove(s,x)}
  invariant(s)
}
console.log('F2-RC2.1 Nutrition library root-cause stress: PASS (350 cycles recipe/ingredient/basket lifecycle invariants)')
