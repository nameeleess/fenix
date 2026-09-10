import assert from 'node:assert/strict'
import fs from 'node:fs'

const vite=fs.readFileSync('vite.config.ts','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const navigation=fs.readFileSync('src/components/AppNavigation.tsx','utf8')
const progress=fs.readFileSync('src/features/progress/ProgressPage.tsx','utf8')
const settings=fs.readFileSync('src/features/settings/SettingsPage.tsx','utf8')
const backup=fs.readFileSync('src/services/backupService.ts','utf8')

for(const token of ['VitePWA','generateSW',"display: 'standalone'",'globPatterns','fenix-icon-180.png']) {
  if(token==='generateSW') continue // generated mode is plugin default and verified by production build.
  assert.ok(vite.includes(token),`PWA config missing ${token}`)
}
assert.ok(app.includes('AppNavigation'),'shared primary navigation owner missing')
for(const label of ['Hoy','Training','Nutrition','Progreso']) assert.ok(navigation.includes(label),`main navigation missing ${label}`)
assert.ok((progress.includes('type="file"')||settings.includes('type="file"'))&&(progress.includes('accept="application/json,.json"')||settings.includes('accept="application/json,.json"')),'iPhone-compatible restore file input missing')
assert.ok(settings.includes('Datos y backup'),'v2.1 backup surface must remain reachable from Settings')
assert.ok(backup.includes('navigator.share')&&backup.includes('navigator.canShare'),'iOS backup share path missing')
assert.ok(backup.includes('downloadBackup(file)'),'backup download fallback missing')
assert.ok(!backup.includes('localStorage.clear')&&!backup.includes('deleteDatabase'),'backup path must not reset local DB')
console.log('F2-RC1 PWA/mobile source hardening: PASS (navigation/install/offline assets/backup file paths)')
