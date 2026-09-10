import assert from 'node:assert/strict'
import fs from 'node:fs'
const src=fs.readFileSync(new URL('../src/features/progress/progressService.ts',import.meta.url),'utf8')
function region(name,next){const s=src.indexOf(`export async function ${name}`);assert.ok(s>=0,`${name} missing`);const e=next?src.indexOf(`export async function ${next}`,s+1):-1;return src.slice(s,e>s?e:src.length)}
for(const [fn,next,store] of [
 ['addWeightEntry','getWeightHistory','weightEntries'],
 ['updateWeightEntry','deleteWeightEntry','weightEntries'],
 ['deleteWeightEntry','addBodyMeasurement','weightEntries'],
 ['addBodyMeasurement','getBodyMeasurements','bodyMeasurements'],
 ['updateBodyMeasurement','deleteBodyMeasurement','bodyMeasurements'],
 ['deleteBodyMeasurement','getFeaturedExerciseOptions','bodyMeasurements'],
]){const r=region(fn,next);assert.match(r,new RegExp(`db\\.transaction\\('rw',\\s*db\\.${store}`),`${fn} missing ${store} tx`)}
const feature=region('setFeaturedExercises','getFeaturedExercisePerformance')
assert.match(feature,/db\.transaction\('rw',\s*db\.progressFeaturedExercises,\s*db\.exercises/)
assert.match(feature,/db\.exercises/)

const page=fs.readFileSync(new URL('../src/features/progress/ProgressPage.tsx',import.meta.url),'utf8')
assert.doesNotMatch(page,/window\.confirm\s*\(/)
for(const label of ['Resumen','Peso','Rendimiento','Adherencia']) assert.ok(page.includes(`label: '${label}'`),`progress ${label} missing`)
assert.match(page, /eyebrow="CUERPO"[\s\S]*?onClick=\{\(\) => setView\('body'\)\}/, 'Cuerpo remains reachable through its Golden summary card')
assert.match(page,/Peso corregido sin crear un registro nuevo/)
assert.match(page,/Medidas corregidas/)
assert.match(page,/ConfirmAction/)

console.log('FÉNIX v2.1 Progress mutation sweep: PASS (weight/body/featured transactions + correction/delete separation)')
