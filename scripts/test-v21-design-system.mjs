import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const ds=fs.readFileSync(new URL('../src/components/designSystem.tsx',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/styles/design-system.css',import.meta.url),'utf8')
for(const name of ['AppHeader','PhoenixHeaderArtwork','WeekDaySelector','SegmentedTabs','Surface','Card','PrimaryButton','SecondaryButton','GhostButton','IconButton','Pill','StatusBadge','MetricCard','EmptyState','MediaFrame','Dialog','Sheet','ConfirmAction','Toast','OfflineIndicator','UpdateAvailableBanner']){
  assert.match(ds,new RegExp(`export function ${name}|export const ${name}`),`${name} missing`)
}
assert.match(ds,/role="dialog"/)
assert.match(ds,/aria-modal="true"/)
assert.match(ds,/event\.key === 'Escape'/)
assert.match(ds,/event\.key !== 'Tab'/)
assert.match(ds,/document\.body\.style\.overflow = 'hidden'/)
assert.match(css,/--fenix-tap:44px/)
assert.match(css,/\.ds-button\{min-height:44px/)
assert.match(css,/\.ds-segmented button\{min-height:44px/)

const touched=[
 'src/features/today/TodayPage.tsx','src/features/training/TrainingPage.tsx','src/features/nutrition/NutritionPage.tsx','src/features/progress/ProgressPage.tsx','src/features/settings/SettingsPage.tsx'
]
for(const file of touched){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/window\.confirm\s*\(/,`${file} native confirm`);assert.match(s,/AppHeader/,`${file} missing AppHeader`)}
const allSrc=[]
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(e.name))allSrc.push(p)}}
walk('src')
for(const file of allSrc){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/window\.confirm\s*\(/,`${file}: window.confirm remains`)}
for(const file of fs.readdirSync('src/styles')) assert.ok(!/^final-v2/i.test(file),`new tactical override ${file}`)

const nutritionPage=fs.readFileSync('src/features/nutrition/NutritionPage.tsx','utf8')
assert.match(nutritionPage,/Dialog[\s\S]*title=\"Comida improvisada\"/,'Improvised meal must use shared Dialog')
assert.match(nutritionPage,/Dialog[\s\S]*title=\"Objetivos Nutrition\"/,'Nutrition goal must use shared Dialog')
assert.match(nutritionPage,/dismissible=\{!submitting\}/,'busy Nutrition dialogs must not dismiss during submit')
assert.doesNotMatch(nutritionPage,/nutrition-vnext-modalBackdrop/,'legacy Nutrition modal backdrop remains')
assert.match(ds,/dismissible = true/,'Dialog dismissible contract missing')
assert.match(ds,/event\.key === 'Escape' && dismissible/,'Dialog busy Escape guard missing')
for(const legacy of ['final-v1.css','mobile-density.css','render-parity.css','visual-polish.css']) assert.ok(!fs.existsSync(`src/styles/${legacy}`),`legacy override layer still present: ${legacy}`)

console.log('FÉNIX v2.1 Design System/accessibility source gate: PASS (shared primitives · dialog a11y · 44px floor · no native confirm/new final override)')
