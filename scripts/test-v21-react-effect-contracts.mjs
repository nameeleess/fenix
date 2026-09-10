import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const nutritionPath = path.resolve('src/features/nutrition/NutritionLibrary.tsx')
const todayPath = path.resolve('src/features/today/TodayPage.tsx')
const trainingPath = path.resolve('src/features/training/TrainingPage.tsx')
const eslintPath = path.resolve('node_modules/eslint/bin/eslint.js')

const nutrition = fs.readFileSync(nutritionPath, 'utf8')
const today = fs.readFileSync(todayPath, 'utf8')
const training = fs.readFileSync(trainingPath, 'utf8')

assert.doesNotMatch(nutrition, /useEffect\(\(\)\s*=>\s*\{\s*setSection\(initialSection\)/)
assert.match(nutrition, /const activeSection = hideSectionTabs \? initialSection : section/)
assert.match(nutrition, /\{activeSection === 'recipes' \? \(/)

assert.doesNotMatch(today, /useEffect\(\(\)\s*=>\s*\{\s*setWorkStart/)
assert.match(today, /const workShiftDraftKey = `\$\{dateKey\}:\$\{workShift\?\.id \?\? 'none'\}:\$\{workShift\?\.updatedAt \?\? 'none'\}`/)
assert.match(today, /workDraft\?\.key === workShiftDraftKey/)
assert.match(today, /updateWorkStart\(event\.target\.value\)/)
assert.match(today, /updateWorkEnd\(event\.target\.value\)/)

assert.match(training, /const activeSessionId = data\?\.active\?\.session\.id \?\? null/)
assert.match(training, /if \(!isActive \|\| activeSessionId === null \|\| !activeVisible\) return/)
assert.match(training, /\}, \[isActive, activeSessionId, activeVisible\]\)/)

const lint = spawnSync(
  process.execPath,
  [eslintPath, '--max-warnings=0', nutritionPath, todayPath, trainingPath],
  { stdio: 'inherit' },
)
assert.equal(lint.status, 0, `Focused React effect lint failed with exit ${lint.status ?? 'null'}`)

console.log('FÉNIX v2.1 React effect contracts: PASS (derived section · keyed work-shift draft · Wake Lock session identity)')
