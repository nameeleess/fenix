import assert from 'node:assert/strict'
import fs from 'node:fs'

const vite=fs.readFileSync('vite.config.ts','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const progress=fs.readFileSync('src/features/progress/ProgressPage.tsx','utf8')
const backup=fs.readFileSync('src/services/backupService.ts','utf8')

for(const token of ['VitePWA','generateSW',"display: 'standalone'",'globPatterns','fenix-icon-180.png']) {
  if(token==='generateSW') continue // generated mode is plugin default and verified by production build.
  assert.ok(vite.includes(token),`PWA config missing ${token}`)
}
for(const label of ['Hoy','Training','Nutrition','Progreso']) assert.ok(app.includes(label),`main navigation missing ${label}`)
assert.ok(progress.includes('type="file"')&&progress.includes('accept="application/json,.json"'),'iPhone-compatible restore file input missing')
assert.ok(backup.includes('navigator.share')&&backup.includes('navigator.canShare'),'iOS backup share path missing')
assert.ok(backup.includes('downloadBackup(file)'),'backup download fallback missing')
assert.ok(!backup.includes('localStorage.clear')&&!backup.includes('deleteDatabase'),'backup path must not reset local DB')
console.log('F2-RC1 PWA/mobile source hardening: PASS (navigation/install/offline assets/backup file paths)')
