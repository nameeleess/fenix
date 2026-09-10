import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const skip=new Set(['test-rc1-baseline-backup.mjs'])
const scripts=fs.readdirSync(here)
  .filter((name)=>/^test-(?:b01|b02|rc1|rc11|rc2|rc21|rc22)-.*\.mjs$/.test(name) && !skip.has(name))
  .sort()
const verifiers=fs.readdirSync(here).filter((name)=>/^verify-(?:b01|b02|rc1|rc11|rc2|rc21|rc22)-.*\.mjs$/.test(name)).sort()
for(const name of [...scripts,...verifiers]){
  const result=spawnSync(process.execPath,['--experimental-strip-types',path.join(here,name)],{stdio:'inherit'})
  if(result.status!==0)process.exit(result.status??1)
}
const backup=process.env.FENIX_BACKUP_PATH
if(backup){
  const result=spawnSync(process.execPath,['--experimental-strip-types',path.join(here,'test-rc1-baseline-backup.mjs'),backup],{stdio:'inherit'})
  if(result.status!==0)process.exit(result.status??1)
}else{
  console.log('FÉNIX CORE official-baseline path gate: DEFERRED (set FENIX_BACKUP_PATH for 759-record roundtrip)')
}
console.log(`FÉNIX CORE regression: PASS (${scripts.length+verifiers.length} scripts${backup?' + official backup':''})`)
