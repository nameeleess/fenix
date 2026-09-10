import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SCHEMA_5_TABLES, validateFenixBackup } from '../src/services/backupIntegrity.ts'

function recount(b){b.tableCounts=Object.fromEntries(SCHEMA_5_TABLES.map(n=>[n,b.tables[n].length]));b.totalRecords=Object.values(b.tableCounts).reduce((a,b)=>a+b,0);return b}
function base(){const tables=Object.fromEntries(SCHEMA_5_TABLES.map(n=>[n,[]]));tables.appMeta=[{key:'schemaVersion',value:'5',updatedAt:'t'}];return recount({format:'fenix-backup',formatVersion:1,exportedAt:'2026-09-07T00:00:00.000Z',databaseName:'fenix-db',schemaVersion:'5',totalRecords:0,tableCounts:{},tables})}
function bad(b,label){const r=validateFenixBackup(recount(b));assert.equal(r.valid,false,`${label} accepted`)}
function good(b,label){const r=validateFenixBackup(recount(b));assert.equal(r.valid,true,`${label}: ${r.errors.join(' | ')}`)}

{const b=base();delete b.tables.shoppingItems;const r=validateFenixBackup(b);assert.equal(r.valid,false,'missing table accepted')}
{const b=base();b.tables.ingredients=[{id:'i1',name:'Arroz',category:'other',defaultUnit:null,notes:null,createdAt:'t',updatedAt:'t',deletedAt:null,version:1},{id:'i2',name:' arroz ',category:'other',defaultUnit:null,notes:null,createdAt:'t',updatedAt:'t',deletedAt:null,version:1}];bad(b,'logical Ingredient duplicate')}
{const b=base();b.tables.ingredients=[{id:'i1',name:'Arroz',category:'other',defaultUnit:null,notes:null,createdAt:'t',updatedAt:'t',deletedAt:null,version:1}];b.tables.shoppingItems=[{id:'s1',ingredientId:'i1',quantity:1,quantityMax:null,unit:'kg',checked:false,addedAt:'t',createdAt:'t',updatedAt:'t',deletedAt:null,version:1},{id:'s2',ingredientId:'i1',quantity:1,quantityMax:null,unit:' kg ',checked:false,addedAt:'t',createdAt:'t',updatedAt:'t',deletedAt:null,version:1}];bad(b,'logical Shopping duplicate')}
{const b=base();b.tables.ingredients=[{id:'i1',name:'Arroz',category:'other',defaultUnit:null,notes:null,createdAt:'t',updatedAt:'t',deletedAt:null,version:1}];good(b,'minimal healthy backup')}
const svc=fs.readFileSync(new URL('../src/services/backupService.ts',import.meta.url),'utf8')
const restore=svc.slice(svc.indexOf('export async function restoreFenixBackup'))
assert.ok(restore.indexOf('validateFenixBackup(backup)') < restore.indexOf("db.transaction('rw'"),'restore prevalidation must precede write transaction')
assert.match(restore,/semanticBackupDiff/)

console.log('FÉNIX v2.1 backup negative/corruption gate: PASS (prevalidation · logical uniqueness · semantic postcheck)')
